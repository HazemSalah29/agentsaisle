import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Scenes = { renderScene: (scene: Loose, ctx: Loose) => { html: string; plan: Loose[] } };
type Parse = {
  parseSequence: (s: string) => { participants: Loose[]; items: Loose[]; problems: string[] };
};
type Seq = { sequenceProblems: (p: Loose) => string[] };
const scenes = () => loadScript<Scenes>("video-core", "assets/engine/hyperframes/scenes.mjs");
const parse = () => loadScript<Parse>("video-core", "assets/seq/parse.mjs");
const seq = () => loadScript<Seq>("video-core", "assets/engine/hyperframes/sequence.mjs");

const ctx = (o: Record<string, unknown> = {}) => ({
  prefix: "sc-a",
  at: 1,
  seconds: 10,
  lines: [],
  lang: "en",
  first: false,
  rise: 24,
  assets: new Map(),
  ...o,
});
const SRC = `participant C as Client
participant S as Server
C->S: GET /api
S->S: check the bucket
S-->C: 429 Too Many
Note over C,S: retry after 1 s`;

describe("sequence parser", () => {
  it("reads our format", async () => {
    const { parseSequence } = await parse();
    const r = parseSequence(SRC);
    expect(r.problems).toEqual([]);
    expect(r.participants).toEqual([
      { id: "C", label: "Client" },
      { id: "S", label: "Server" },
    ]);
    expect(r.items.map((i) => i.type)).toEqual(["msg", "msg", "msg", "note"]);
    expect(r.items[2]).toMatchObject({ from: "S", to: "C", dashed: true, text: "429 Too Many" });
    expect(r.items[3]).toMatchObject({ over: ["C", "S"] });
  });

  it("reads the Mermaid subset", async () => {
    const { parseSequence } = await parse();
    const r = parseSequence(
      "sequenceDiagram\n%% a comment\nparticipant B as Browser\nB->>A: hi\nA-->>B: hello\nNote right of A: thinking",
    );
    expect(r.problems).toEqual([]);
    expect(r.participants.map((p) => p.id)).toEqual(["B", "A"]);
    expect(r.items).toHaveLength(3);
    expect(r.items[1]!.dashed).toBe(true);
  });

  it("says what it cannot read and what is not supported", async () => {
    const { parseSequence } = await parse();
    const p = parseSequence("A->B: ok\nloop forever\nthis is not a line\nactivate A").problems.join(
      "\n",
    );
    expect(p).toContain('line 2: "loop" is not supported');
    expect(p).toContain("line 3: cannot read");
    expect(p).toContain('line 4: "activate"');
    expect(parseSequence("").problems.join()).toContain("no messages");
    const many = Array.from({ length: 13 }, (_, i) => `A->B: m${i}`).join("\n");
    expect(parseSequence(many).problems.join()).toContain("more than 12");
  });
});

describe("sequence scene", () => {
  it("draws one row per message and note, in order, one reveal each", async () => {
    const { renderScene } = await scenes();
    const r = renderScene(
      { kind: "sequence", props: { source: SRC, title: "A limited call" } },
      ctx(),
    );
    expect(r.html.match(/class="arr /g)).toHaveLength(3);
    expect(r.html).toContain('class="note"');
    expect(r.html).toContain("Client");
    const reveals = r.plan.filter((p) => /-i\d$/.test(p.id));
    expect(reveals).toHaveLength(4);
    const ats = reveals.map((p) => p.at);
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
    // every earlier row dims when the next one arrives, the last never does
    expect(r.plan.filter((p) => /-w\d$/.test(p.id))).toHaveLength(3);
  });

  it("times rows by narration when there is one line per row", async () => {
    const { renderScene } = await scenes();
    const lines = [{ start: 0.2 }, { start: 2 }, { start: 4 }, { start: 6 }];
    const r = renderScene({ kind: "sequence", props: { source: SRC } }, ctx({ lines }));
    const reveals = r.plan.filter((p) => /-i\d$/.test(p.id)).map((p) => p.at);
    expect(reveals).toEqual([1.2, 3, 5, 7]);
  });

  it("shows hostile text as text", async () => {
    const { renderScene } = await scenes();
    const r = renderScene(
      { kind: "sequence", props: { source: "A->B: <img onerror=x>", title: "</script><b>" } },
      ctx(),
    );
    expect(r.html).not.toContain("<img");
    expect(r.html).not.toContain("</script");
    expect(r.html).toContain("&lt;img");
  });

  it("is identical for the same source", async () => {
    const { renderScene } = await scenes();
    const run = () =>
      JSON.stringify(renderScene({ kind: "sequence", props: { source: SRC } }, ctx()));
    expect(run()).toBe(run());
  });

  it("refuses a label that cannot fit, and a parse problem, in check", async () => {
    const { sequenceProblems } = await seq();
    expect(sequenceProblems({ source: SRC })).toEqual([]);
    const crowded =
      "participant A\nparticipant B\nparticipant C\nparticipant D\nparticipant E\nparticipant F\nA->B: a long message with many words";
    expect(sequenceProblems({ source: crowded }).join()).toContain("too long for the space");
    expect(sequenceProblems({ source: "x" }).join()).toContain("cannot read");
    expect(sequenceProblems({}).join()).toContain("source");
  });
});
