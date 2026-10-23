import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildRegistry,
  createShaResolver,
  fetchTagIndex,
  remoteTagSha,
  type SkillFetcher,
} from "./build";

const SHA1 = "a1".repeat(20);
const SHA2 = "b2".repeat(20);
const skillMd = (name: string) =>
  `---\nname: ${name}\ndescription: Does ${name}.\n---\n# ${name}\n`;
const fetchSkill: SkillFetcher = async (_repo, _sha, p) => skillMd(p.split("/").pop()!);
const resolveSha = () => "f".repeat(40);

let root: string;

async function official(name: string, mdName = name) {
  const dir = path.join(root, "official", name);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "SKILL.md"), skillMd(mdName));
  await writeFile(
    path.join(dir, "skill.meta.yaml"),
    "version: 1.0.0\ncategory: [code]\nclients: [claude-code]\nruns_scripts: false\n",
  );
}

async function community(name: string, extra = "") {
  await mkdir(path.join(root, "community"), { recursive: true });
  await writeFile(
    path.join(root, "community", `${name}.yaml`),
    `name: ${name}\nauthor: a\nrepo: a/b\npath: skills/${name}\nversions:\n  - {version: 1.0.0, ref: v1, sha: ${SHA1}}\n  - {version: 1.2.0, ref: v2, sha: ${SHA2}}\ncategory: [x]\nclients: [codex]\nruns_scripts: false\n${extra}`,
  );
}

const build = () => buildRegistry({ rootDir: root, fetchSkill, resolveSha, now: new Date(0) });

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "aisle-reg-"));
});

describe("buildRegistry", () => {
  it("merges official and community skills, sorted, with latest resolved", async () => {
    await official("explore");
    await community("zeta");
    const idx = await build();
    expect(idx.skills.map((s) => s.name)).toEqual(["explore", "zeta"]);
    const zeta = idx.skills[1]!;
    expect(zeta.latest).toBe("1.2.0");
    expect(zeta.versions[0]!.sha).toBe(SHA2);
    expect(zeta.description).toBe("Does zeta.");
    expect(idx.skills[0]).toMatchObject({ source: "official", verified: true });
  });

  it("flags official skills with a scripts/ folder", async () => {
    await official("risky");
    await mkdir(path.join(root, "official", "risky", "scripts"));
    expect((await build()).skills[0]!.runsScripts).toBe(true);
  });

  it("reports all problems with file names", async () => {
    await official("a", "wrong-name");
    await community("bad", "bogus: 1\n");
    await expect(build()).rejects.toThrow(
      /registry\/official\/a.*must match folder[\s\S]*registry\/community\/bad\.yaml/,
    );
  });

  it("rejects duplicate names across official and community", async () => {
    await official("dup");
    await community("dup");
    await expect(build()).rejects.toThrow(/duplicate skill name "dup"/);
  });

  it("fails when the fetched SKILL.md name differs from the entry", async () => {
    await community("one");
    await expect(
      buildRegistry({ rootDir: root, fetchSkill: async () => skillMd("other"), resolveSha }),
    ).rejects.toThrow(/must match entry name "one"/);
  });

  describe("profiles.yaml", () => {
    const profilesYaml = (skill: string, extra = "") =>
      `profiles:\n  - {id: starter, name: Starter, description: Basics, skills: [${skill}]}\n${extra}questions:\n  - id: kind\n    prompt: What?\n    options:\n      - {label: Code, adds: [${skill}]}\n      - {label: Other, adds: []}\n`;

    it("is optional", async () => {
      await official("explore");
      const idx = await build();
      expect(idx.profiles).toEqual([]);
      expect(idx.questions).toEqual([]);
    });

    it("is included in the index when valid", async () => {
      await official("explore");
      await writeFile(path.join(root, "profiles.yaml"), profilesYaml("explore"));
      const idx = await build();
      expect(idx.profiles[0]).toMatchObject({ id: "starter", skills: ["explore"] });
      expect(idx.questions[0]!.options).toHaveLength(2);
    });

    it("fails when a profile or answer names an unknown skill", async () => {
      await official("explore");
      await writeFile(path.join(root, "profiles.yaml"), profilesYaml("ghost"));
      await expect(build()).rejects.toThrow(
        /profile "starter" references unknown skill "ghost"[\s\S]*option "Code" references unknown skill "ghost"/,
      );
    });

    it("fails on duplicate profile ids and malformed files", async () => {
      await official("explore");
      await writeFile(
        path.join(root, "profiles.yaml"),
        profilesYaml(
          "explore",
          "  - {id: starter, name: Again, description: Dup, skills: [explore]}\n",
        ),
      );
      await expect(build()).rejects.toThrow(/duplicate profile id "starter"/);
      await writeFile(path.join(root, "profiles.yaml"), "profiles: []\nquestions: []\n");
      await expect(build()).rejects.toThrow(/registry\/profiles\.yaml/);
    });
  });
});

describe("official SHA resolution", () => {
  const TAG_SHA = "c".repeat(40);
  const base = {
    local: () => undefined as string | undefined,
    remote: async () => undefined as string | undefined,
    head: () => "d".repeat(40),
    warn: () => {},
  };

  it("prefers the local tag", async () => {
    const resolve = createShaResolver({
      ...base,
      local: () => TAG_SHA,
      remote: async () => "e".repeat(40),
      strict: true,
    });
    expect(await resolve("explore@1.0.0")).toBe(TAG_SHA);
  });

  it("falls back to GitHub when the checkout has no tags", async () => {
    const resolve = createShaResolver({ ...base, remote: async () => TAG_SHA, strict: true });
    expect(await resolve("explore@1.0.0")).toBe(TAG_SHA);
  });

  it("fails the build in strict mode instead of pinning HEAD", async () => {
    const resolve = createShaResolver({ ...base, strict: true });
    await expect(resolve("explore@1.0.0")).rejects.toThrow(
      /Cannot resolve git tag "explore@1\.0\.0".*git push origin explore@1\.0\.0/,
    );
  });

  it("pins HEAD with a warning in local development", async () => {
    const warnings: string[] = [];
    const resolve = createShaResolver({ ...base, strict: false, warn: (m) => warnings.push(m) });
    expect(await resolve("explore@1.0.0")).toBe("d".repeat(40));
    expect(warnings[0]).toMatch(/no git tag "explore@1\.0\.0"/);
  });
});

describe("remoteTagSha", () => {
  const json = (body: unknown, status = 200) =>
    (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

  it("returns the commit for a tag, encoding the @ in the name", async () => {
    let url = "";
    const sha = "a".repeat(40);
    const f = (async (u: string) => {
      url = u;
      return new Response(JSON.stringify({ sha }));
    }) as unknown as typeof fetch;
    expect(await remoteTagSha("o/r", "explore@1.0.0", { fetch: f })).toBe(sha);
    expect(url).toBe("https://api.github.com/repos/o/r/commits/explore%401.0.0");
  });

  it("returns undefined for a missing tag, a bad payload or a network error", async () => {
    expect(
      await remoteTagSha("o/r", "x@1.0.0", { fetch: json({ message: "No commit found" }, 422) }),
    ).toBeUndefined();
    expect(await remoteTagSha("o/r", "x@1.0.0", { fetch: json({ sha: "short" }) })).toBeUndefined();
    const boom = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    expect(await remoteTagSha("o/r", "x@1.0.0", { fetch: boom })).toBeUndefined();
  });
});

describe("house standard in the index", () => {
  const richMeta = `version: 1.0.0
category: [code]
clients: [claude-code]
runs_scripts: false
niche: code
kind: saver
tier: baseline
tested:
  model: claude-sonnet-5-5
  date: "2026-10-23"
  tasks: 30
  token_savings_median: 0.42
  success_rate: 0.9
  baseline_success_rate: 0.7
  preferred_in_blind_test: 0.65
permissions:
  tools: [Read, Bash]
  writes_files: false
  runs_scripts: false
  network: false
  needs_api_keys: []
demo:
  url: https://demo.example.dev
  screenshots: [preview/home.png]
`;

  it("carries the new meta fields into the index in camelCase", async () => {
    await official("code-quality");
    await writeFile(path.join(root, "official", "code-quality", "skill.meta.yaml"), richMeta);
    const skill = (await build()).skills[0]!;
    expect(skill).toMatchObject({ niche: "code", kind: "saver", tier: "baseline" });
    expect(skill.tested).toEqual({
      model: "claude-sonnet-5-5",
      date: "2026-10-23",
      tasks: 30,
      tokenSavingsMedian: 0.42,
      successRate: 0.9,
      baselineSuccessRate: 0.7,
      preferredInBlindTest: 0.65,
    });
    expect(skill.permissions).toEqual({
      tools: ["Read", "Bash"],
      writesFiles: false,
      runsScripts: false,
      network: false,
      needsApiKeys: [],
    });
    expect(skill.demo).toEqual({
      url: "https://demo.example.dev",
      screenshots: ["preview/home.png"],
    });
  });

  it("leaves the new fields out for skills that don't set them", async () => {
    await official("explore");
    const skill = (await build()).skills[0]!;
    for (const key of ["niche", "kind", "tier", "tested", "permissions", "demo"])
      expect(skill).not.toHaveProperty(key);
  });

  it("includes the house rules text when _shared/house-rules.md exists", async () => {
    await official("explore");
    expect((await build()).houseRules).toBeUndefined();
    await mkdir(path.join(root, "_shared"), { recursive: true });
    await writeFile(path.join(root, "_shared", "house-rules.md"), "\n## Rules\n- Be brief.\n\n");
    expect((await build()).houseRules).toBe("## Rules\n- Be brief.");
  });

  it("builds from a generated SKILL.md and fails when it is stale", async () => {
    await official("explore");
    const dir = path.join(root, "official", "explore");
    await mkdir(path.join(root, "_shared"), { recursive: true });
    await writeFile(path.join(root, "_shared", "budget.md"), "- Read line ranges.\n");
    const src = `---\nname: explore\ndescription: Does explore.\n---\n# explore\n<!-- include: _shared/budget.md -->\n`;
    await writeFile(path.join(dir, "SKILL.src.md"), src);

    await expect(build()).rejects.toThrow(
      /registry\/official\/explore: SKILL\.md is out of date with SKILL\.src\.md\. Run: pnpm skills:build/,
    );

    await writeFile(
      path.join(dir, "SKILL.md"),
      src.replace("<!-- include: _shared/budget.md -->", "- Read line ranges."),
    );
    expect((await build()).skills[0]!.name).toBe("explore");
  });

  it("reports a broken include as a build error", async () => {
    await official("explore");
    await writeFile(
      path.join(root, "official", "explore", "SKILL.src.md"),
      "<!-- include: _shared/missing.md -->\n",
    );
    await expect(build()).rejects.toThrow(/unknown fragment "_shared\/missing\.md"/);
  });
});

describe("fetchTagIndex", () => {
  const sha = (n: number) => n.toString(16).padStart(40, "0");
  const ref = (name: string, n: number, type = "commit") => ({
    ref: `refs/tags/${name}`,
    object: { sha: sha(n), type },
  });
  const pages = (all: unknown[][]) => {
    const urls: string[] = [];
    const f = (async (url: string) => {
      urls.push(url);
      const page = Number(new URL(url).searchParams.get("page"));
      return new Response(JSON.stringify(all[page - 1] ?? []));
    }) as unknown as typeof fetch;
    return { f, urls };
  };

  it("maps every tag to its commit with a single request when they fit on one page", async () => {
    const { f, urls } = pages([[ref("plan@1.1.0", 1), ref("verify@1.0.0", 2)]]);
    const index = await fetchTagIndex("o/r", { fetch: f });
    expect(index.get("plan@1.1.0")).toBe(sha(1));
    expect(index.get("verify@1.0.0")).toBe(sha(2));
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/repos/o/r/git/matching-refs/tags?per_page=100&page=1");
  });

  it("follows pages until one has fewer than 100 tags", async () => {
    const first = Array.from({ length: 100 }, (_, i) => ref(`a${i}@1.0.0`, i + 1));
    const { f, urls } = pages([first, [ref("last@1.0.0", 999)]]);
    const index = await fetchTagIndex("o/r", { fetch: f });
    expect(index.size).toBe(101);
    expect(index.get("last@1.0.0")).toBe(sha(999));
    expect(urls).toHaveLength(2);
  });

  it("skips annotated tags (they point at a tag object, not a commit) and non-tag refs", async () => {
    const { f } = pages([
      [
        ref("ok@1.0.0", 1),
        ref("annotated@1.0.0", 2, "tag"),
        { ref: "refs/heads/main", object: { sha: sha(3), type: "commit" } },
      ],
    ]);
    const index = await fetchTagIndex("o/r", { fetch: f });
    expect([...index.keys()]).toEqual(["ok@1.0.0"]);
  });

  it("returns what it has, or nothing, when GitHub fails", async () => {
    const limited = (async () => new Response("{}", { status: 403 })) as unknown as typeof fetch;
    expect((await fetchTagIndex("o/r", { fetch: limited })).size).toBe(0);
    const boom = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect((await fetchTagIndex("o/r", { fetch: boom })).size).toBe(0);
  });

  it("sends the token when given", async () => {
    let auth: string | undefined;
    const f = (async (_u: string, init?: RequestInit) => {
      auth = (init?.headers as Record<string, string>).Authorization;
      return new Response("[]");
    }) as unknown as typeof fetch;
    await fetchTagIndex("o/r", { fetch: f, token: "t0k" });
    expect(auth).toBe("Bearer t0k");
  });
});

describe("aisles.yaml and elsewhere.yaml", () => {
  const officialWithNiche = async (name: string, niche: string) => {
    await official(name);
    const meta = path.join(root, "official", name, "skill.meta.yaml");
    await writeFile(
      meta,
      `version: 1.0.0\ncategory: [code]\nclients: [claude-code]\nruns_scripts: false\nniche: ${niche}\n`,
    );
  };
  const aisles = `aisles:
  - {id: database, name: Database, description: Schemas and queries, niches: [db]}
  - {id: testing, name: Testing, description: Tests, niches: [test, debug]}
`;

  it("are optional and default to empty lists", async () => {
    await official("explore");
    const idx = await build();
    expect(idx.aisles).toEqual([]);
    expect(idx.elsewhere).toEqual([]);
  });

  it("loads aisles and elsewhere entries into the index", async () => {
    await officialWithNiche("db-schema", "db");
    await writeFile(path.join(root, "aisles.yaml"), aisles);
    await writeFile(
      path.join(root, "elsewhere.yaml"),
      "entries:\n  - {name: Debugging, author: someone, repo: someone/skills, path: debug, description: Hypothesis-led debugging., license: MIT, aisle: testing}\n",
    );
    const idx = await build();
    expect(idx.aisles.map((a) => a.id)).toEqual(["database", "testing"]);
    expect(idx.elsewhere[0]).toMatchObject({
      repo: "someone/skills",
      aisle: "testing",
      license: "MIT",
    });
  });

  it("fails when an official skill's niche is in no aisle", async () => {
    await officialWithNiche("db-schema", "db");
    await officialWithNiche("img-thing", "image");
    await writeFile(path.join(root, "aisles.yaml"), aisles);
    await expect(build()).rejects.toThrow(/img-thing: niche "image" is not in any aisle/);
  });

  it("fails on duplicate aisle ids and on a niche used by two aisles", async () => {
    await writeFile(
      path.join(root, "aisles.yaml"),
      "aisles:\n  - {id: a, name: A, description: d, niches: [x]}\n  - {id: a, name: B, description: d, niches: [x]}\n",
    );
    await expect(build()).rejects.toThrow(/duplicate aisle id "a"/);
    await expect(build()).rejects.toThrow(/niche "x" is in both/);
  });

  it("rejects malformed aisles and elsewhere files", async () => {
    await writeFile(path.join(root, "aisles.yaml"), "aisles: []\n");
    await expect(build()).rejects.toThrow(/registry\/aisles\.yaml/);
    await writeFile(path.join(root, "aisles.yaml"), aisles);
    await writeFile(path.join(root, "elsewhere.yaml"), "entries:\n  - {name: X}\n");
    await expect(build()).rejects.toThrow(/registry\/elsewhere\.yaml/);
  });

  it("rejects elsewhere entries with an unknown aisle or a duplicate repo path", async () => {
    await writeFile(path.join(root, "aisles.yaml"), aisles);
    const entry = (aisle: string) =>
      `  - {name: N, author: a, repo: o/r, path: p, description: d, license: MIT, aisle: ${aisle}}\n`;
    await writeFile(path.join(root, "elsewhere.yaml"), `entries:\n${entry("ghost")}`);
    await expect(build()).rejects.toThrow(/unknown aisle "ghost"/);
    await writeFile(
      path.join(root, "elsewhere.yaml"),
      `entries:\n${entry("testing")}${entry("database")}`,
    );
    await expect(build()).rejects.toThrow(/duplicates o\/r\/p/);
  });

  it("limits the one-line description to 160 characters", async () => {
    await writeFile(path.join(root, "aisles.yaml"), aisles);
    await writeFile(
      path.join(root, "elsewhere.yaml"),
      `entries:\n  - {name: N, author: a, repo: o/r, description: "${"x".repeat(161)}", license: MIT, aisle: testing}\n`,
    );
    await expect(build()).rejects.toThrow(/registry\/elsewhere\.yaml/);
  });

  describe("kits (profiles with an aisle)", () => {
    const aislesYaml =
      "aisles:\n  - {id: web-design, name: Web design, description: d, niches: [design]}\n";
    const profileYaml = (aisle: string) =>
      `profiles:\n  - {id: kit, name: Kit, description: d, skills: [explore], aisle: ${aisle}}\nquestions:\n  - id: q\n    prompt: What?\n    options:\n      - {label: A, adds: [explore]}\n      - {label: B, adds: []}\n`;

    it("keeps the aisle on the profile", async () => {
      await official("explore");
      await writeFile(path.join(root, "aisles.yaml"), aislesYaml);
      await writeFile(path.join(root, "profiles.yaml"), profileYaml("web-design"));
      expect((await build()).profiles[0]).toMatchObject({ id: "kit", aisle: "web-design" });
    });

    it("rejects a kit whose aisle does not exist", async () => {
      await official("explore");
      await writeFile(path.join(root, "aisles.yaml"), aislesYaml);
      await writeFile(path.join(root, "profiles.yaml"), profileYaml("ghost"));
      await expect(build()).rejects.toThrow(/profile "kit" uses unknown aisle "ghost"/);
    });
  });
});
