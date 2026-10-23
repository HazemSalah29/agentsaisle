import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { buildRegistry, type SkillFetcher } from "./build";

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
});
