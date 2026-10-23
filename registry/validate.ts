/**
 * Checks for community registry entries (brief section 8). Used by CI on every pull request.
 * Safety: this only reads text and file listings from GitHub. Nothing from a submitted skill is
 * ever executed, installed or imported.
 */
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { CommunityEntry, SkillFrontmatter, splitFrontmatter } from "@agentsaisle/registry-schema";

export interface Finding {
  level: "error" | "warning" | "notice";
  file: string;
  message: string;
}

/** The slice of GitHub the checks need. Injected so tests never touch the network. */
export interface GitHubApi {
  /** Whether the repository exists and is public. */
  repoIsPublic(repo: string): Promise<boolean>;
  commitExists(repo: string, sha: string): Promise<boolean>;
  /** Raw text of a file at a commit, or undefined when it doesn't exist. */
  rawFile(repo: string, sha: string, filePath: string): Promise<string | undefined>;
  /** Every file path in the commit's tree. `truncated` means GitHub cut the list short. */
  listFiles(repo: string, sha: string): Promise<{ paths: string[]; truncated: boolean }>;
}

export interface ValidateContext {
  github: GitHubApi;
  /** Names already taken by official skills and by other community entries. */
  takenNames: Set<string>;
  /** Maintainers only: allow `verified: true`. */
  allowVerified: boolean;
}

export function createGitHubApi(token = process.env.GITHUB_TOKEN): GitHubApi {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const api = (p: string) => fetch(`https://api.github.com${p}`, { headers });
  const fail = (what: string, res: Response) => {
    throw new Error(
      `${what} (HTTP ${res.status}${res.status === 403 ? ", possibly rate limited" : ""})`,
    );
  };
  return {
    async repoIsPublic(repo) {
      const res = await api(`/repos/${repo}`);
      if (res.status === 404) return false;
      if (!res.ok) fail(`could not look up ${repo}`, res);
      return ((await res.json()) as { private?: boolean }).private !== true;
    },
    async commitExists(repo, sha) {
      const res = await api(`/repos/${repo}/commits/${sha}`);
      if (res.status === 404 || res.status === 422) return false;
      if (!res.ok) fail(`could not look up commit ${sha.slice(0, 7)}`, res);
      return true;
    },
    async rawFile(repo, sha, filePath) {
      const res = await fetch(`https://raw.githubusercontent.com/${repo}/${sha}/${filePath}`, {
        headers,
      });
      if (res.status === 404) return undefined;
      if (!res.ok) fail(`could not read ${filePath}`, res);
      return res.text();
    },
    async listFiles(repo, sha) {
      const res = await api(`/repos/${repo}/git/trees/${sha}?recursive=1`);
      if (!res.ok) fail(`could not list files for ${sha.slice(0, 7)}`, res);
      const body = (await res.json()) as {
        tree: Array<{ path: string; type: string }>;
        truncated?: boolean;
      };
      return {
        paths: body.tree.filter((t) => t.type === "blob").map((t) => t.path),
        truncated: body.truncated === true,
      };
    },
  };
}

const short = (sha: string) => sha.slice(0, 7);

/** Run every check on one registry/community/*.yaml file. */
export async function validateEntryFile(
  file: string,
  text: string,
  ctx: ValidateContext,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const add = (level: Finding["level"], message: string) => findings.push({ level, file, message });

  if (!file.endsWith(".yaml")) {
    add("error", "Community entries must be .yaml files.");
    return findings;
  }

  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (e) {
    add("error", `Not valid YAML: ${(e as Error).message.split("\n")[0]}`);
    return findings;
  }

  const parsed = CommunityEntry.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const where = issue.path.map(String).join(".") || "(entry)";
      const numeric = /received number/.test(issue.message) && /\b(sha|version|ref)\b/.test(where);
      add(
        "error",
        `${where}: ${issue.message}.` +
          (numeric
            ? ' YAML read this as a number. Put the value in quotes, for example sha: "3f9c2e1...".'
            : ""),
      );
    }
    return findings;
  }
  const entry = parsed.data;

  const expected = `${entry.name}.yaml`;
  if (path.basename(file) !== expected)
    add("error", `File name must be "${expected}" to match name: ${entry.name}.`);
  if (ctx.takenNames.has(entry.name))
    add("error", `A skill named "${entry.name}" already exists. Names must be unique.`);
  if (entry.verified && !ctx.allowVerified) {
    add(
      "error",
      "verified: true can only be set by a maintainer after reviewing the skill. Remove it or set it to false.",
    );
  }
  const versions = entry.versions.map((v) => v.version);
  for (const v of versions.filter((x, i) => versions.indexOf(x) !== i))
    add("error", `Version ${v} is listed more than once.`);

  try {
    if (!(await ctx.github.repoIsPublic(entry.repo))) {
      add(
        "error",
        `Repository ${entry.repo} was not found, or it is private. Skills must live in a public repository.`,
      );
      return findings;
    }
    const skillPath = entry.path.replace(/^\/+|\/+$/g, "");
    for (const v of entry.versions) {
      const label = `Version ${v.version} (${short(v.sha)})`;
      if (!(await ctx.github.commitExists(entry.repo, v.sha))) {
        add(
          "error",
          `${label}: commit not found in ${entry.repo}. Use the full 40-character SHA of a commit that exists.`,
        );
        continue;
      }
      const md = await ctx.github.rawFile(
        entry.repo,
        v.sha,
        `${skillPath ? skillPath + "/" : ""}SKILL.md`,
      );
      if (md === undefined) {
        add(
          "error",
          `${label}: no SKILL.md at "${skillPath}/SKILL.md" in that commit. Check the path.`,
        );
      } else {
        const fm = splitFrontmatter(md);
        let data: unknown;
        try {
          data = fm ? parseYaml(fm.frontmatter) : undefined;
        } catch {
          data = undefined;
        }
        const checked = SkillFrontmatter.safeParse(data);
        if (!fm)
          add(
            "error",
            `${label}: SKILL.md has no frontmatter (--- block with name and description).`,
          );
        else if (!checked.success) {
          const why = checked.error.issues
            .map((i) => `${i.path.join(".") || "frontmatter"}: ${i.message}`)
            .join("; ");
          add("error", `${label}: SKILL.md frontmatter is invalid (${why}).`);
        } else if (checked.data.name !== entry.name) {
          add(
            "error",
            `${label}: SKILL.md name is "${checked.data.name}" but the entry name is "${entry.name}". They must match.`,
          );
        }
      }

      const { paths, truncated } = await ctx.github.listFiles(entry.repo, v.sha);
      const prefix = `${skillPath ? skillPath + "/" : ""}scripts/`;
      const scripts = paths.filter((p) => p.startsWith(prefix));
      if (scripts.length > 0) {
        const list =
          scripts
            .slice(0, 5)
            .map((s) => s.slice(prefix.length - "scripts/".length))
            .join(", ") + (scripts.length > 5 ? ", ..." : "");
        if (!entry.runs_scripts) {
          add(
            "error",
            `${label}: contains a scripts/ folder (${list}) but runs_scripts is false. Set runs_scripts: true so users are warned.`,
          );
        } else {
          add("notice", `${label}: scripts to review in full before verifying: ${list}.`);
        }
      } else if (truncated) {
        add(
          "warning",
          `${label}: GitHub cut the file list short, so scripts/ could not be checked. A maintainer should check by hand.`,
        );
      }
    }
  } catch (e) {
    add(
      "error",
      `Could not verify against GitHub: ${(e as Error).message}. Re-run the check; if it keeps failing, ask a maintainer.`,
    );
  }
  return findings;
}
