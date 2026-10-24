import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

// Fake credentials are assembled at runtime so no realistic token ever sits in this file.
const rep = (c: string, n: number) => c.repeat(n);
const FAKE = {
  anthropic: () => "sk-" + "ant-" + rep("a1", 15),
  openai: () => "sk-" + "proj-" + rep("Ab3", 12),
  aws: () => "AK" + "IA" + rep("Q7", 8),
  github: () => "gh" + "p_" + rep("x9", 20),
  githubFine: () => "github" + "_pat_" + rep("Zy8", 20),
  stripe: () => "sk_" + "live_" + rep("m4", 14),
  slack: () => "xo" + "xb-" + rep("1234567890", 2),
  google: () => "AI" + "za" + rep("Kd2", 11) + "_x",
  privateKey: () => "-----BEGIN " + "RSA PRIVATE KEY-----",
  jwt: () => "ey" + "J" + rep("h", 12) + ".ey" + "J" + rep("p", 12) + "." + rep("s", 12),
};

interface Finding {
  file: string;
  line: number;
  pattern: string;
  masked: string;
}
interface Secrets {
  PATTERNS: Array<{ name: string }>;
  mask(v: string): string;
  globToRegExp(g: string): RegExp;
  isIgnored(file: string, globs: string[]): boolean;
  scanLine(text: string): { pattern: string; masked: string } | null;
  parseDiff(d: string): Array<{ file: string; line: number; text: string }>;
  scanAdded(
    added: Array<{ file: string; line: number; text: string }>,
    ignore?: string[],
  ): Finding[];
  parseIgnoreFile(t: string): string[];
  report(f: Finding[], maxLines?: number): string;
}
interface Headers {
  REQUIRED: Array<{ name: string }>;
  findFiles(cwd: string, exists: (p: string) => boolean): { config?: string; extra: string[] };
  analyze(
    sources: string[],
    opts?: { ignore?: string[] },
  ): { missing: string[]; warnings: string[] };
  report(r: { file?: string; missing?: string[]; warnings?: string[]; noConfig?: boolean }): string;
}
interface Vuln {
  name: string;
  severity: string;
  range: string;
  direct: boolean;
  title: string;
  fix: string;
}
interface Audit {
  parseAudit(json: unknown): Vuln[] | null;
  onlySerious(list: Vuln[]): Vuln[];
  format(serious: Vuln[], maxLines?: number): string;
}

let secrets: Secrets;
let headers: Headers;
let audit: Audit;
beforeAll(async () => {
  secrets = await loadScript<Secrets>("web-security", "scripts/secrets-scan.mjs");
  headers = await loadScript<Headers>("web-security", "scripts/headers-check.mjs");
  audit = await loadScript<Audit>("web-security", "scripts/audit-summary.mjs");
});

describe("secrets-scan: patterns", () => {
  const cases: Array<[string, () => string]> = [
    ["anthropic-api-key", FAKE.anthropic],
    ["openai-api-key", FAKE.openai],
    ["aws-access-key-id", FAKE.aws],
    ["github-token", FAKE.github],
    ["github-fine-grained-token", FAKE.githubFine],
    ["stripe-live-key", FAKE.stripe],
    ["slack-token", FAKE.slack],
    ["google-api-key", FAKE.google],
    ["private-key-block", FAKE.privateKey],
    ["jwt", FAKE.jwt],
  ];
  it.each(cases)("detects %s", (name, make) => {
    const hit = secrets.scanLine(`const value = "${make()}";`);
    expect(hit?.pattern).toBe(name);
  });

  it("an Anthropic key is not reported as an OpenAI key", () => {
    expect(secrets.scanLine(FAKE.anthropic())?.pattern).toBe("anthropic-api-key");
  });

  it("flags a hardcoded credential assignment but not placeholders or env reads", () => {
    expect(secrets.scanLine(`const password = "Tr0ub4dor&3xK9"`)?.pattern).toBe(
      "hardcoded-credential",
    );
    expect(secrets.scanLine(`api_key: 'k8Jd02mXz91Qp4Lw'`)?.pattern).toBe("hardcoded-credential");
    for (const safe of [
      `const apiKey = "your-api-key-here"`,
      `token = "<paste token>"`,
      `secret: "changeme-please-1234"`,
      `const key = process.env.API_KEY`,
      `password = "xxxxxxxxxxxxxxxx"`,
      `const token = "short"`,
    ]) {
      expect(secrets.scanLine(safe), safe).toBeNull();
    }
  });

  it("flags a secret exposed through a NEXT_PUBLIC_ variable", () => {
    expect(secrets.scanLine("NEXT_PUBLIC_API_SECRET=abc123def456")?.pattern).toBe(
      "public-env-secret",
    );
    expect(secrets.scanLine("NEXT_PUBLIC_SITE_URL=https://example.dev")).toBeNull();
  });

  it("skips a line marked aisle-ignore", () => {
    expect(secrets.scanLine(`const k = "${FAKE.aws()}" // aisle-ignore`)).toBeNull();
  });

  it("finds nothing in ordinary code", () => {
    for (const line of [
      "const total = items.reduce((a, b) => a + b, 0);",
      "export function add(a: number, b: number) {",
      "",
    ]) {
      expect(secrets.scanLine(line)).toBeNull();
    }
  });
});

describe("secrets-scan: masking", () => {
  it("never reveals the whole value", () => {
    const v = FAKE.github();
    const m = secrets.mask(v);
    expect(m).not.toBe(v);
    expect(m.startsWith(v.slice(0, 4))).toBe(true);
    expect(m.endsWith(v.slice(-2))).toBe(true);
    expect(m).toContain("*");
    expect(m.length).toBeLessThan(v.length);
  });
  it("fully hides short values", () => {
    expect(secrets.mask("abc")).toBe("****");
    expect(secrets.mask("0123456789")).toBe("**********");
  });
});

describe("secrets-scan: diff parsing and ignores", () => {
  const diff = [
    "diff --git a/src/a.ts b/src/a.ts",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -1,0 +5,2 @@",
    "+const one = 1;",
    "+const two = 2;",
    "@@ -20 +30 @@",
    "-removed line",
    "+replaced line",
    "diff --git a/old.txt b/old.txt",
    "--- a/old.txt",
    "+++ /dev/null",
    "@@ -1 +0,0 @@",
    "-gone",
  ].join("\n");

  it("returns added lines with file and new line numbers, skipping removals and deleted files", () => {
    expect(secrets.parseDiff(diff)).toEqual([
      { file: "src/a.ts", line: 5, text: "const one = 1;" },
      { file: "src/a.ts", line: 6, text: "const two = 2;" },
      { file: "src/a.ts", line: 30, text: "replaced line" },
    ]);
  });

  it("scans added lines and reports file and line", () => {
    const found = secrets.scanAdded([
      { file: "src/a.ts", line: 9, text: `const k = "${FAKE.stripe()}"` },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ file: "src/a.ts", line: 9, pattern: "stripe-live-key" });
  });

  it("skips lockfiles and minified files by default, and custom globs", () => {
    const text = `x "${FAKE.github()}"`;
    const lines = [
      "pnpm-lock.yaml",
      "package-lock.json",
      "dist/app.min.js",
      "src/fixtures/keys.txt",
      "src/real.ts",
    ].map((file) => ({ file, line: 1, text }));
    expect(secrets.scanAdded(lines, ["src/fixtures/**"]).map((f) => f.file)).toEqual([
      "src/real.ts",
    ]);
  });

  it("glob matching: * stays in a folder, ** crosses folders, basenames match", () => {
    expect(secrets.globToRegExp("src/*.ts").test("src/a.ts")).toBe(true);
    expect(secrets.globToRegExp("src/*.ts").test("src/deep/a.ts")).toBe(false);
    expect(secrets.globToRegExp("src/**").test("src/deep/er/a.ts")).toBe(true);
    expect(secrets.globToRegExp("**/*.snap").test("a/b/c.snap")).toBe(true);
    expect(secrets.globToRegExp("**/*.snap").test("c.snap")).toBe(true);
    expect(secrets.isIgnored("deep/path/test.env.example", ["*.example"])).toBe(true);
    expect(secrets.isIgnored("a.ts", ["b.ts"])).toBe(false);
  });

  it("parses the ignore file: comments and blank lines dropped", () => {
    expect(secrets.parseIgnoreFile("# note\n\nfixtures/**\n  docs/*.md  \n")).toEqual([
      "fixtures/**",
      "docs/*.md",
    ]);
  });
});

describe("secrets-scan: report", () => {
  it("says so when clean", () => {
    expect(secrets.report([])).toBe("secrets-scan: no secrets found in added lines.");
  });
  it("lists findings with masked values only", () => {
    const secret = FAKE.github();
    const [f] = secrets.scanAdded([{ file: "a.ts", line: 3, text: `t = "${secret}"` }]);
    const text = secrets.report([f!]);
    expect(text).toContain("1 possible secret (values masked)");
    expect(text).toContain("a.ts:3  github-token");
    expect(text).not.toContain(secret);
    expect(text).toContain("rotate it");
  });
  it("never exceeds 40 lines", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({
      file: `f${i}.ts`,
      line: 1,
      pattern: "jwt",
      masked: "eyJh****",
    }));
    const lines = secrets.report(many, 40).split("\n");
    expect(lines.length).toBeLessThanOrEqual(40);
    expect(lines.at(-1)).toContain("rotate it");
    expect(lines.some((l) => /\.\.\. \d+ more/.test(l))).toBe(true);
  });
});

describe("secrets-scan: as a command in a real git repo", () => {
  const script = skillFile("web-security", "scripts/secrets-scan.mjs");
  const git = (cwd: string, ...args: string[]) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=t",
        "-c",
        "user.email=t@example.dev",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd, stdio: "pipe" },
    );
  const run = (cwd: string, ...args: string[]) => {
    const r = spawnSync(process.execPath, [script, "--cwd", cwd, ...args], { encoding: "utf8" });
    return { code: r.status, out: r.stdout };
  };
  async function repo() {
    const dir = await mkdtemp(path.join(os.tmpdir(), "aisle-secrets-"));
    git(dir, "init", "-q");
    await writeFile(path.join(dir, "readme.md"), "hello\n");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "init");
    return dir;
  }

  it("passes on a clean change, then fails on a new file and a modified file, with masked output", async () => {
    const dir = await repo();
    await writeFile(path.join(dir, "readme.md"), "hello\nmore text\n");
    expect(run(dir)).toMatchObject({ code: 0 });

    const secret = FAKE.anthropic();
    await writeFile(path.join(dir, "config.ts"), `export const k = "${secret}";\n`);
    const created = run(dir);
    expect(created.code).toBe(1);
    expect(created.out).toContain("config.ts:1  anthropic-api-key");
    expect(created.out).not.toContain(secret);

    await writeFile(path.join(dir, "readme.md"), `hello\nkey = "${FAKE.aws()}"\n`);
    const modified = run(dir);
    expect(modified.code).toBe(1);
    expect(modified.out).toContain("readme.md:2  aws-access-key-id");
    expect(modified.out).toContain("2 possible secrets");
  });

  it("respects .secretsignore and --staged", async () => {
    const dir = await repo();
    await mkdir(path.join(dir, "fixtures"));
    await writeFile(path.join(dir, "fixtures", "keys.txt"), `${FAKE.github()}\n`);
    await writeFile(path.join(dir, ".secretsignore"), "fixtures/**\n");
    expect(run(dir).code).toBe(0);

    await writeFile(path.join(dir, "app.ts"), `const t = "${FAKE.github()}"\n`);
    expect(run(dir, "--staged").code).toBe(0); // nothing staged yet
    git(dir, "add", "app.ts");
    expect(run(dir, "--staged").code).toBe(1);
  });

  it("explains itself outside a git repository", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "aisle-nogit-"));
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("not a git repository");
  });
});

describe("headers-check", () => {
  const all = `
    const nextConfig = {
      poweredByHeader: false,
      async headers() { return [{ source: "/(.*)", headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; frame-ancestors 'none'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000" },
      ] }]; },
    };
    export default nextConfig;`;

  it("passes when every header is set (frame-ancestors counts as frame protection)", () => {
    expect(headers.analyze([all])).toEqual({ missing: [], warnings: [] });
  });
  it("lists exactly what is missing", () => {
    const partial = `export default { async headers() { return [{ headers: [{ key: "X-Content-Type-Options", value: "nosniff" }] }]; } }`;
    expect(headers.analyze([partial]).missing).toEqual([
      "Content-Security-Policy",
      "Referrer-Policy",
      "Permissions-Policy",
      "Strict-Transport-Security",
      "X-Frame-Options or frame-ancestors",
    ]);
  });
  it("counts headers set in middleware or proxy files too", () => {
    const config = `export default { poweredByHeader: false }`;
    const proxy = `res.headers.set("Content-Security-Policy", csp); res.headers.set("X-Frame-Options", "DENY");`;
    const m = headers.analyze([config, proxy]).missing;
    expect(m).not.toContain("Content-Security-Policy");
    expect(m).not.toContain("X-Frame-Options or frame-ancestors");
    expect(m).toContain("Referrer-Policy");
  });
  it("can ignore a header the host already sets", () => {
    expect(
      headers.analyze(["export default {}"], { ignore: ["strict-transport-security"] }).missing,
    ).not.toContain("Strict-Transport-Security");
  });
  it("warns about weak settings without failing", () => {
    const weak = `${all} const csp = "script-src 'self' 'unsafe-inline' 'unsafe-eval'"`;
    const w = headers.analyze([weak]).warnings.join("\n");
    expect(w).toContain("unsafe-eval");
    expect(w).toContain("unsafe-inline");
    expect(headers.analyze([all.replace("poweredByHeader: false", "")]).warnings.join()).toContain(
      "poweredByHeader: false",
    );
  });
  it("finds the config file by name", () => {
    const exists = (p: string) =>
      p === path.join("/p", "next.config.mjs") || p === path.join("/p", "proxy.ts");
    expect(headers.findFiles("/p", exists)).toEqual({
      config: "next.config.mjs",
      extra: ["proxy.ts"],
    });
    expect(headers.findFiles("/p", () => false)).toEqual({ config: undefined, extra: [] });
  });
  it("formats results", () => {
    expect(headers.report({ noConfig: true })).toContain("no next.config file");
    expect(headers.report({ file: "next.config.ts", missing: [], warnings: [] })).toBe(
      "headers-check: all security headers are set in next.config.ts",
    );
    const text = headers.report({
      file: "next.config.ts",
      missing: ["Referrer-Policy"],
      warnings: ["w"],
    });
    expect(text).toContain("1 missing in next.config.ts");
    expect(text).toContain("missing Referrer-Policy");
    expect(text).toContain("note: w");
  });

  describe("as a command", () => {
    const script = skillFile("web-security", "scripts/headers-check.mjs");
    const run = (cwd: string, ...args: string[]) => {
      const r = spawnSync(process.execPath, [script, "--cwd", cwd, ...args], { encoding: "utf8" });
      return { code: r.status, out: r.stdout };
    };
    it("reads the config as text and never executes it", async () => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "aisle-headers-"));
      // If this file were imported or run, the process would exit with code 9 before printing anything.
      await writeFile(path.join(dir, "next.config.mjs"), `process.exit(9);\n${all}\n`);
      const ok = run(dir);
      expect(ok.code).toBe(0);
      expect(ok.out).toContain("all security headers are set");

      await writeFile(path.join(dir, "next.config.mjs"), `process.exit(9);\nexport default {};\n`);
      const bad = run(dir);
      expect(bad.code).toBe(1);
      expect(bad.out).toContain("missing Content-Security-Policy");
      expect(
        run(
          dir,
          "--ignore",
          "content-security-policy,x-content-type,referrer,permissions,strict,frame",
        ).code,
      ).toBe(0);
    });
    it("fails when there is no next.config", async () => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "aisle-headers-none-"));
      const r = run(dir);
      expect(r.code).toBe(1);
      expect(r.out).toContain("no next.config file");
    });
  });
});

describe("audit-summary", () => {
  const npmV2 = {
    vulnerabilities: {
      lodash: {
        name: "lodash",
        severity: "high",
        isDirect: true,
        range: "<4.17.21",
        via: [{ title: "Prototype pollution" }],
        fixAvailable: { name: "lodash", version: "4.17.21", isSemVerMajor: false },
      },
      minimist: {
        name: "minimist",
        severity: "critical",
        isDirect: false,
        range: "<1.2.6",
        via: ["other"],
        fixAvailable: true,
      },
      debug: {
        name: "debug",
        severity: "low",
        isDirect: false,
        range: "<2",
        via: [],
        fixAvailable: false,
      },
      semver: {
        name: "semver",
        severity: "moderate",
        isDirect: false,
        range: "<7.5",
        via: [],
        fixAvailable: false,
      },
      old: {
        name: "old",
        severity: "high",
        isDirect: false,
        range: "*",
        via: [{ title: "ReDoS" }],
        fixAvailable: false,
      },
    },
  };
  const legacy = {
    advisories: {
      "1": {
        module_name: "tar",
        severity: "high",
        title: "Arbitrary file write",
        vulnerable_versions: "<6.1.9",
        patched_versions: ">=6.1.9",
      },
      "2": {
        module_name: "ws",
        severity: "critical",
        title: "DoS",
        vulnerable_versions: "<7.4.6",
        patched_versions: "<0.0.0",
      },
      "3": {
        module_name: "x",
        severity: "info",
        title: "n",
        vulnerable_versions: "*",
        patched_versions: "*",
      },
    },
  };

  it("reads npm's current format", () => {
    const list = audit.parseAudit(npmV2)!;
    expect(list).toHaveLength(5);
    expect(list.find((v) => v.name === "lodash")).toMatchObject({
      severity: "high",
      direct: true,
      title: "Prototype pollution",
      fix: "upgrade lodash to 4.17.21",
    });
    expect(list.find((v) => v.name === "minimist")?.fix).toBe("npm audit fix");
    expect(list.find((v) => v.name === "old")?.fix).toBe("no fix available");
  });
  it("reads the older advisories format", () => {
    const list = audit.parseAudit(legacy)!;
    expect(list.find((v) => v.name === "tar")?.fix).toBe("upgrade to >=6.1.9");
    expect(list.find((v) => v.name === "ws")?.fix).toBe("no fix available");
  });
  it("returns null for JSON it does not recognize", () => {
    expect(audit.parseAudit({ nope: 1 })).toBeNull();
    expect(audit.parseAudit(null)).toBeNull();
  });
  it("keeps only high and critical, critical first", () => {
    expect(
      audit.onlySerious(audit.parseAudit(npmV2)!).map((v) => `${v.severity}:${v.name}`),
    ).toEqual(["critical:minimist", "high:lodash", "high:old"]);
  });
  it("formats a short summary, and a clean one", () => {
    const text = audit.format(audit.onlySerious(audit.parseAudit(npmV2)!));
    expect(text.split("\n")[0]).toBe("audit: 1 critical, 2 high");
    expect(text).toContain("high lodash <4.17.21 (direct): Prototype pollution");
    expect(text).toContain("fix: upgrade lodash to 4.17.21");
    expect(text).not.toContain("debug");
    expect(audit.format([])).toBe(
      "audit: no high or critical vulnerabilities in production dependencies.",
    );
  });
  it("never exceeds 20 lines", () => {
    const many = Array.from({ length: 50 }, (_, i): Vuln => ({
      name: `p${i}`,
      severity: "high",
      range: "*",
      direct: false,
      title: "t",
      fix: "x",
    }));
    expect(audit.format(many, 20).split("\n").length).toBeLessThanOrEqual(20);
  });

  describe("as a command", () => {
    const script = skillFile("web-security", "scripts/audit-summary.mjs");
    const run = (input: string) => {
      const r = spawnSync(process.execPath, [script], { input, encoding: "utf8" });
      return { code: r.status, out: r.stdout };
    };
    it("exits 1 with serious findings, 0 without, 2 for unreadable input", () => {
      const serious = run(JSON.stringify(npmV2));
      expect(serious.code).toBe(1);
      expect(serious.out).toContain("audit: 1 critical, 2 high");
      expect(
        run(JSON.stringify({ vulnerabilities: { a: { name: "a", severity: "low", via: [] } } }))
          .code,
      ).toBe(0);
      const bad = run("not json");
      expect(bad.code).toBe(2);
      expect(bad.out).toContain("could not read the audit output");
      expect(run('{"hello":1}').code).toBe(2);
    });
  });
});
