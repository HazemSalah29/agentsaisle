import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

interface Table {
  name: string;
  columns: Array<{ name: string; type: string; notNull: boolean; unique: boolean }>;
  primaryKey: string[];
  foreignKeys: Array<{ columns: string[]; refTable: string }>;
  indexes: Array<{ columns: string[]; unique: boolean }>;
}
interface Er {
  parseDdl(sql: string): Table[];
  analyze(t: Table[]): Array<{ table: string; rule: string }>;
  summarize(t: Table[]): string;
  splitTop(s: string, sep: string): string[];
  MAX_LINES: number;
}
interface Mig {
  detectEngine(sql: string): string;
  lintMigration(
    sql: string,
    o?: { engine?: string; requireDown?: boolean },
  ): { engine: string; findings: Array<{ line: number; rule: string; level: string }> };
  format(r: unknown, f?: string): string;
}
interface Ex {
  parsePlan(t: string): { plan: Record<string, unknown>; executionMs?: number };
  analyze(p: unknown): {
    findings: Array<{ rule: string }>;
    seqScans: number;
    executionMs?: number;
  };
  compare(a: unknown, b: unknown): string;
  summarize(a: unknown): string;
}
interface Seed {
  generate(spec: unknown, seed?: number): Record<string, Array<Record<string, unknown>>>;
  toSql(d: unknown, batch?: number): string;
  toCsv(rows: unknown[]): string;
  order(t: Array<{ name: string; columns: Record<string, unknown> }>): Array<{ name: string }>;
  rng(seed: number): () => number;
  GENERATORS: Record<string, unknown>;
}

let er: Er;
let mig: Mig;
let ex: Ex;
let seed: Seed;
beforeAll(async () => {
  er = await loadScript<Er>("db-schema", "scripts/er-summary.mjs");
  mig = await loadScript<Mig>("db-migrate", "scripts/migration-lint.mjs");
  ex = await loadScript<Ex>("db-optimize-query", "scripts/explain-summary.mjs");
  seed = await loadScript<Seed>("db-seed", "scripts/seed-data.mjs");
});

const DDL = `
-- shop
CREATE TABLE teams (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users (
  id bigserial PRIMARY KEY,
  email varchar(255) NOT NULL UNIQUE,
  team_id uuid REFERENCES teams(id),
  bio text
);
CREATE TABLE orders (
  id int,
  user_id bigint NOT NULL,
  total numeric(10,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_u FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT pk PRIMARY KEY (id)
);
CREATE INDEX idx_users_team ON users (team_id);
CREATE TABLE notes (a text, b text, c text, d text);
ALTER TABLE notes ADD CONSTRAINT x FOREIGN KEY (a) REFERENCES ghosts(id);
`;

describe("db-schema: er-summary", () => {
  it("parses tables, columns, keys, foreign keys and indexes", () => {
    const t = er.parseDdl(DDL);
    expect(t.map((x) => x.name)).toEqual(["teams", "users", "orders", "notes"]);
    const users = t.find((x) => x.name === "users")!;
    expect(users.primaryKey).toEqual(["id"]);
    expect(users.columns.find((c) => c.name === "email")).toMatchObject({
      notNull: true,
      unique: true,
      type: "varchar(255)",
    });
    expect(users.foreignKeys).toEqual([
      { columns: ["team_id"], refTable: "teams", refColumns: ["id"] },
    ]);
    expect(users.indexes.some((i) => i.columns[0] === "team_id")).toBe(true);
    const orders = t.find((x) => x.name === "orders")!;
    expect(orders.primaryKey).toEqual(["id"]);
    expect(orders.foreignKeys[0]).toMatchObject({ columns: ["user_id"], refTable: "users" });
  });

  it("flags missing keys, unindexed foreign keys, unknown references and all-nullable tables", () => {
    const found = er.analyze(er.parseDdl(DDL)).map((f) => `${f.rule}:${f.table}`);
    expect(found).toContain("fk-without-index:orders");
    expect(found).toContain("no-primary-key:notes");
    expect(found).toContain("unknown-reference:notes");
    expect(found).toContain("all-nullable:notes");
    expect(found).not.toContain("fk-without-index:users"); // covered by idx_users_team
    expect(found).not.toContain("no-primary-key:orders");
  });

  it("an index whose first column is the foreign key counts as covering it", () => {
    const sql = `CREATE TABLE a (id int PRIMARY KEY); CREATE TABLE b (id int PRIMARY KEY, a_id int REFERENCES a(id)); CREATE INDEX i ON b (a_id, id);`;
    expect(er.analyze(er.parseDdl(sql))).toEqual([]);
  });

  it("handles quoted names, IF NOT EXISTS, comments and table-level UNIQUE", () => {
    const t = er.parseDdl(
      `/* c */ CREATE TABLE IF NOT EXISTS "public"."Users" ("Id" int PRIMARY KEY, "Mail" text NOT NULL, UNIQUE ("Mail")); -- x`,
    );
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ name: "Users", primaryKey: ["Id"] });
    expect(t[0]!.indexes[0]).toMatchObject({ columns: ["Mail"], unique: true });
  });

  it("splitTop respects parentheses and quotes", () => {
    expect(er.splitTop("a, b(c, d), 'e,f', g", ",").map((s) => s.trim())).toEqual([
      "a",
      "b(c, d)",
      "'e,f'",
      "g",
    ]);
  });

  it("prints a compact summary within 40 lines", () => {
    const out = er.summarize(er.parseDdl(DDL));
    expect(out).toContain("er-summary: 4 tables");
    expect(out).toContain("users: id bigserial PK");
    expect(out.split("\n").length).toBeLessThanOrEqual(er.MAX_LINES);
    const big = Array.from({ length: 60 }, (_, i) => `CREATE TABLE t${i} (id int);`).join("\n");
    expect(er.summarize(er.parseDdl(big)).split("\n").length).toBeLessThanOrEqual(er.MAX_LINES);
  });

  it("runs as a command: exit 1 with findings, 1 with no tables, 0 when clean", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "er-"));
    const run = (file: string) =>
      spawnSync(process.execPath, [skillFile("db-schema", "scripts/er-summary.mjs"), file], {
        encoding: "utf8",
      });
    await writeFile(path.join(dir, "bad.sql"), DDL);
    expect(run(path.join(dir, "bad.sql")).status).toBe(1);
    await writeFile(path.join(dir, "empty.sql"), "SELECT 1;");
    expect(run(path.join(dir, "empty.sql")).stdout).toMatch(/no CREATE TABLE/);
    await writeFile(
      path.join(dir, "ok.sql"),
      "CREATE TABLE a (id int PRIMARY KEY, n text NOT NULL);",
    );
    const ok = run(path.join(dir, "ok.sql"));
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain("no problems found");
  });
});

describe("db-migrate: migration-lint", () => {
  const lint = (sql: string, engine?: string, requireDown = false) =>
    mig.lintMigration(sql, { engine, requireDown }).findings.map((f) => f.rule);

  it.each([
    ["DROP TABLE users;", "drop-table"],
    ["ALTER TABLE t DROP COLUMN c;", "drop-column"],
    ["TRUNCATE orders;", "truncate"],
    ["DELETE FROM sessions;", "delete-no-where"],
    ["UPDATE users SET plan = 'free';", "update-no-where"],
    ["ALTER TABLE t ADD COLUMN n text NOT NULL;", "not-null-no-default"],
    ["ALTER TABLE t ALTER COLUMN n TYPE bigint;", "alter-type"],
    ["ALTER TABLE t RENAME COLUMN a TO b;", "rename"],
  ])("flags %s as %s on any engine", (sql, rule) => {
    expect(lint(sql, "generic")).toContain(rule);
  });

  it("does not flag safe statements", () => {
    expect(lint("ALTER TABLE t ADD COLUMN n text;", "generic")).toEqual([]);
    expect(lint("ALTER TABLE t ADD COLUMN n text NOT NULL DEFAULT 'x';", "generic")).toEqual([]);
    expect(lint("DELETE FROM sessions WHERE expired;", "generic")).toEqual([]);
    expect(lint("UPDATE users SET plan = 'free' WHERE id = 1;", "generic")).toEqual([]);
  });

  it("applies the PostgreSQL rules only to PostgreSQL", () => {
    const sql =
      "CREATE INDEX idx ON t (a);\nALTER TABLE t ALTER COLUMN a SET NOT NULL;\nALTER TABLE t ADD FOREIGN KEY (a) REFERENCES u(id);";
    expect(lint(sql, "postgres")).toEqual(
      expect.arrayContaining(["index-not-concurrent", "set-not-null", "fk-not-valid"]),
    );
    expect(lint(sql, "mysql")).not.toContain("index-not-concurrent");
    expect(lint("CREATE INDEX CONCURRENTLY idx ON t (a);", "postgres")).toEqual([]);
    expect(
      lint("ALTER TABLE t ADD FOREIGN KEY (a) REFERENCES u(id) NOT VALID;", "postgres"),
    ).toEqual([]);
  });

  it("flags CONCURRENTLY inside a transaction", () => {
    expect(lint("BEGIN;\nCREATE INDEX CONCURRENTLY i ON t (a);\nCOMMIT;", "postgres")).toContain(
      "concurrent-in-transaction",
    );
  });

  it("has MySQL, SQLite and MongoDB specifics", () => {
    expect(
      mig.lintMigration("ALTER TABLE t ADD COLUMN n int;", { engine: "mysql" }).findings[0],
    ).toMatchObject({ rule: "mysql-algorithm", level: "info" });
    expect(lint("ALTER TABLE t ALTER COLUMN a TYPE text;", "sqlite")).toContain(
      "sqlite-alter-column",
    );
    expect(lint("db.users.deleteMany({})", "mongodb")).toContain("mongo-unbounded-write");
    expect(lint("db.users.drop()", "mongodb")).toContain("mongo-drop");
    expect(lint("db.users.deleteMany({ expired: true })", "mongodb")).toEqual([]);
  });

  it("reports the line each statement starts on and ignores comments", () => {
    const r = mig.lintMigration("-- DROP TABLE nope;\n\nSELECT 1;\nDROP TABLE x;", {
      engine: "generic",
    });
    expect(r.findings).toEqual([expect.objectContaining({ rule: "drop-table", line: 4 })]);
  });

  it("flags a missing down step only when asked", () => {
    expect(lint("ALTER TABLE t ADD COLUMN n text;", "generic", false)).toEqual([]);
    expect(lint("ALTER TABLE t ADD COLUMN n text;", "generic", true)).toContain("no-down");
    expect(
      lint(
        "-- up\nALTER TABLE t ADD COLUMN n text;\n-- down\nALTER TABLE t DROP COLUMN n;",
        "generic",
        true,
      ),
    ).not.toContain("no-down");
  });

  it("detects the engine from the SQL", () => {
    expect(mig.detectEngine("CREATE INDEX CONCURRENTLY i ON t (a)")).toBe("postgres");
    expect(mig.detectEngine("CREATE TABLE `t` (id int AUTO_INCREMENT)")).toBe("mysql");
    expect(mig.detectEngine("PRAGMA foreign_keys = ON;")).toBe("sqlite");
    expect(mig.detectEngine("db.users.createIndex({a:1})")).toBe("mongodb");
    expect(mig.detectEngine("SELECT 1")).toBe("generic");
  });

  it("formats within 40 lines and exits non-zero on warnings", async () => {
    const many = Array.from({ length: 80 }, () => "DROP TABLE x;").join("\n");
    expect(
      mig.format(mig.lintMigration(many, { engine: "generic" })).split("\n").length,
    ).toBeLessThanOrEqual(40);
    const dir = await mkdtemp(path.join(os.tmpdir(), "mig-"));
    await writeFile(path.join(dir, "1.sql"), "DROP TABLE x;");
    const r = spawnSync(
      process.execPath,
      [
        skillFile("db-migrate", "scripts/migration-lint.mjs"),
        path.join(dir, "1.sql"),
        "--engine",
        "postgres",
      ],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/line 1\s+warn\s+drop-table/);
    await writeFile(path.join(dir, "2.sql"), "ALTER TABLE t ADD COLUMN n text;");
    expect(
      spawnSync(
        process.execPath,
        [skillFile("db-migrate", "scripts/migration-lint.mjs"), path.join(dir, "2.sql")],
        { encoding: "utf8" },
      ).status,
    ).toBe(0);
  });
});

const node = (type: string, extra: Record<string, unknown> = {}) => ({
  "Node Type": type,
  "Actual Total Time": 1,
  "Actual Rows": 10,
  "Plan Rows": 10,
  "Actual Loops": 1,
  ...extra,
});
const explain = (plan: Record<string, unknown>, exec = 10) =>
  JSON.stringify([{ Plan: plan, "Planning Time": 0.1, "Execution Time": exec }]);

describe("db-optimize-query: explain-summary", () => {
  it("extracts the JSON from raw psql output", () => {
    const raw = ` QUERY PLAN\n----\n ${explain(node("Result"))}\n(1 row)\n`;
    expect(ex.parsePlan(raw).executionMs).toBe(10);
  });

  it("rejects text without a plan", () => {
    expect(() => ex.parsePlan("no plan here")).toThrow(/no JSON plan/);
    expect(() => ex.parsePlan("[{}]")).toThrow(/no Plan/);
  });

  it("flags a big sequential scan with its discarded rows", () => {
    const p = ex.parsePlan(
      explain(
        node("Seq Scan", {
          "Relation Name": "orders",
          "Actual Rows": 50,
          "Rows Removed by Filter": 99950,
          Filter: "(user_id = 7)",
          "Plan Rows": 50,
        }),
      ),
    );
    const a = ex.analyze(p);
    expect(a.findings.map((f) => f.rule)).toContain("seq-scan");
    expect(ex.summarize(a)).toMatch(/orders.*read 100,000 rows.*discarded 99,950/);
  });

  it("ignores a small sequential scan", () => {
    expect(
      ex.analyze(
        ex.parsePlan(explain(node("Seq Scan", { "Relation Name": "tiny", "Actual Rows": 20 }))),
      ).findings,
    ).toEqual([]);
  });

  it("flags bad row estimates, many loops, disk sorts and hash spills", () => {
    const plan = node("Sort", {
      "Sort Method": "external merge",
      "Sort Space Type": "Disk",
      Plans: [
        node("Hash Join", {
          "Hash Batches": 4,
          "Plan Rows": 5,
          "Actual Rows": 5000,
          Plans: [
            node("Index Scan", {
              "Relation Name": "items",
              "Index Name": "items_pkey",
              "Actual Loops": 5000,
            }),
          ],
        }),
      ],
    });
    const rules = ex.analyze(ex.parsePlan(explain(plan))).findings.map((f) => f.rule);
    expect(rules).toEqual(
      expect.arrayContaining(["sort-on-disk", "hash-spill", "bad-estimate", "many-loops"]),
    );
  });

  it("compares before and after, naming what was fixed", () => {
    const before = ex.parsePlan(
      explain(
        node("Seq Scan", {
          "Relation Name": "orders",
          "Actual Rows": 10,
          "Rows Removed by Filter": 99990,
          "Plan Rows": 10,
        }),
        120,
      ),
    );
    const after = ex.parsePlan(
      explain(
        node("Index Scan", { "Relation Name": "orders", "Index Name": "idx_orders_user" }),
        3,
      ),
    );
    const out = ex.compare(before, after);
    expect(out).toMatch(/execution 120\.0 ms -> 3\.00 ms \(-98%\)/);
    expect(out).toContain("sequential scans 1 -> 0");
    expect(out).toMatch(/fixed: seq-scan/);
  });

  it("runs as a command on a file and on stdin, and reports bad input without crashing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ex-"));
    const a = path.join(dir, "a.json");
    const b = path.join(dir, "b.json");
    await writeFile(
      a,
      explain(
        node("Seq Scan", {
          "Relation Name": "o",
          "Actual Rows": 1,
          "Rows Removed by Filter": 5000,
          "Plan Rows": 1,
        }),
        50,
      ),
    );
    await writeFile(b, explain(node("Index Scan", { "Relation Name": "o", "Index Name": "i" }), 5));
    const script = skillFile("db-optimize-query", "scripts/explain-summary.mjs");
    expect(spawnSync(process.execPath, [script, a], { encoding: "utf8" }).status).toBe(1);
    expect(spawnSync(process.execPath, [script, a, b], { encoding: "utf8" }).stdout).toContain(
      "before and after",
    );
    expect(
      spawnSync(process.execPath, [script], { input: explain(node("Result")), encoding: "utf8" })
        .status,
    ).toBe(0);
    const bad = spawnSync(process.execPath, [script], { input: "garbage", encoding: "utf8" });
    expect(bad.status).toBe(1);
    expect(bad.stdout).toMatch(/no JSON plan/);
  });
});

const SPEC = {
  seed: 7,
  tables: [
    {
      name: "orders",
      rows: 6,
      columns: {
        id: "serial",
        user_id: { ref: "users.id" },
        total: { type: "decimal", min: 5, max: 200 },
      },
    },
    {
      name: "users",
      rows: 5,
      columns: {
        id: "uuid",
        email: "email",
        name: "fullName",
        plan: { oneOf: ["free", "pro"] },
        age: { type: "int", min: 18, max: 80 },
        active: { type: "bool", chance: 0.5 },
        created_at: { type: "timestamp", from: "2024-01-01", to: "2024-12-31" },
        bio: "sentence",
      },
    },
  ],
};

describe("db-seed: seed-data", () => {
  it("is deterministic: the same seed gives identical data, a different seed differs", () => {
    expect(seed.generate(SPEC)).toEqual(seed.generate(SPEC));
    expect(seed.generate(SPEC, 1)).not.toEqual(seed.generate(SPEC, 2));
    expect(seed.generate(SPEC, 7)).toEqual(seed.generate(SPEC));
  });

  it("generates tables in dependency order and every foreign key points at a real row", () => {
    const data = seed.generate(SPEC);
    expect(Object.keys(data)).toEqual(["users", "orders"]);
    const ids = new Set(data.users!.map((u) => u.id));
    expect(data.orders!.every((o) => ids.has(o.user_id))).toBe(true);
    expect(data.orders!.map((o) => o.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("respects types and ranges", () => {
    const { users, orders } = seed.generate({
      ...SPEC,
      tables: [
        { ...SPEC.tables[1]!, rows: 200 },
        { ...SPEC.tables[0]!, rows: 200 },
      ],
    });
    for (const u of users!) {
      expect(u.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(u.email).toMatch(/^[a-z]+\.[a-z]+\d+@example\.com$/);
      expect(["free", "pro"]).toContain(u.plan);
      expect(u.age as number).toBeGreaterThanOrEqual(18);
      expect(u.age as number).toBeLessThanOrEqual(80);
      expect(u.created_at).toMatch(/^2024-\d\d-\d\d \d\d:\d\d:\d\d$/);
      expect(typeof u.active).toBe("boolean");
      expect(u.bio).toMatch(/^[A-Z].*\.$/);
    }
    for (const o of orders!) {
      expect(o.total as number).toBeGreaterThanOrEqual(5);
      expect(o.total as number).toBeLessThanOrEqual(200);
    }
    expect(new Set(users!.map((u) => u.email)).size).toBe(200); // emails stay unique
  });

  it("explains spec mistakes clearly", () => {
    expect(() => seed.generate({})).toThrow(/tables/);
    expect(() => seed.generate({ tables: [{ name: "a", columns: { x: "nope" } }] })).toThrow(
      /unknown generator "nope"/,
    );
    expect(() =>
      seed.generate({ tables: [{ name: "a", columns: { x: { ref: "ghost.id" } } }] }),
    ).toThrow(/not in the spec/);
    expect(() => seed.generate({ tables: [{ name: "a", columns: { x: 5 } }] })).toThrow(
      /expected a generator/,
    );
    expect(() =>
      seed.generate({
        tables: [
          { name: "a", columns: { b_id: { ref: "b.id" } } },
          { name: "b", columns: { a_id: { ref: "a.id" } } },
        ],
      }),
    ).toThrow(/loop/);
  });

  it("writes SQL with escaped quotes and batches, and CSV with quoting", () => {
    const sql = seed.toSql(
      {
        t: [
          { id: 1, name: "O'Brien", ok: true, n: null },
          { id: 2, name: "x", ok: false, n: 3 },
        ],
      },
      1,
    );
    expect(sql).toContain("(1, 'O''Brien', TRUE, NULL)");
    expect(sql.match(/INSERT INTO/g)).toHaveLength(2);
    expect(seed.toCsv([{ a: "x,y", b: 'say "hi"' }])).toBe('a,b\n"x,y","say ""hi"""\n');
    expect(seed.toCsv([])).toBe("");
  });

  it("runs as a command in all three formats and rejects bad input", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "seed-"));
    await writeFile(path.join(dir, "spec.json"), JSON.stringify(SPEC));
    const script = skillFile("db-seed", "scripts/seed-data.mjs");
    const run = (...a: string[]) =>
      spawnSync(process.execPath, [script, path.join(dir, "spec.json"), ...a], {
        encoding: "utf8",
      });
    const sql1 = run("--seed", "3");
    expect(sql1.stdout).toContain("INSERT INTO users");
    expect(run("--seed", "3").stdout).toBe(sql1.stdout);
    expect(run("--format", "json").stdout).toContain('"orders"');
    const csv = run("--format", "csv", "--out", path.join(dir, "csv"));
    expect(csv.stdout).toMatch(/wrote 2 CSV files/);
    expect(await readFile(path.join(dir, "csv", "users.csv"), "utf8")).toMatch(/^id,email,name/);
    expect(run("--format", "csv").stdout).toMatch(/needs --out/);
    expect(run("--format", "xml").status).toBe(1);
    await writeFile(path.join(dir, "bad.json"), "{nope");
    expect(
      spawnSync(process.execPath, [script, path.join(dir, "bad.json")], { encoding: "utf8" })
        .status,
    ).toBe(1);
  });

  it("rng is repeatable and stays in [0, 1)", () => {
    const a = seed.rng(5);
    const b = seed.rng(5);
    for (let i = 0; i < 50; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("db skills: shared checks", () => {
  const scripts: Array<[string, string, string[]]> = [
    ["db-schema", "scripts/er-summary.mjs", []],
    ["db-migrate", "scripts/migration-lint.mjs", []],
    ["db-optimize-query", "scripts/explain-summary.mjs", []],
    ["db-seed", "scripts/seed-data.mjs", []],
  ];

  // Regression: a script reached through a symlinked folder must still run and print something.
  it.each(scripts)(
    "%s/%s still runs when started through a symlinked path",
    async (skill, file, args) => {
      const real = await mkdtemp(path.join(os.tmpdir(), "dbs-real-"));
      await mkdir(path.join(real, "scripts"), { recursive: true });
      await cp(skillFile(skill, file), path.join(real, "scripts", path.basename(file)));
      const link = path.join(await mkdtemp(path.join(os.tmpdir(), "dbs-link-")), "linked");
      await symlink(real, link);
      const r = spawnSync(
        process.execPath,
        [path.join(link, "scripts", path.basename(file)), ...args],
        {
          cwd: await mkdtemp(path.join(os.tmpdir(), "dbs-proj-")),
          input: "",
          encoding: "utf8",
        },
      );
      expect(r.stdout.trim().length, `${file} printed nothing: ${r.stderr}`).toBeGreaterThan(0);
    },
  );

  it("db-migrate ships notes for the four engines", async () => {
    for (const e of ["postgres", "mysql", "sqlite", "mongodb"])
      expect(
        (await readFile(skillFile("db-migrate", `references/${e}.md`), "utf8")).length,
      ).toBeGreaterThan(200);
  });

  it("db-seed documents every generator it supports", async () => {
    const doc = await readFile(skillFile("db-seed", "references/spec.md"), "utf8");
    const skill = await readFile(skillFile("db-seed", "SKILL.md"), "utf8");
    for (const g of Object.keys(seed.GENERATORS)) expect(skill + doc, g).toContain(g);
  });
});
