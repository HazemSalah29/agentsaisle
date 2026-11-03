import { Buffer } from "node:buffer";

/** A mono 16-bit PCM WAV of silence with an exactly known length. */
export function wav(seconds: number, rate = 16000, extraChunk = false) {
  const data = Buffer.alloc(Math.round(seconds * rate) * 2);
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(1, 2);
  fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE(rate * 2, 8);
  fmt.writeUInt16LE(2, 12);
  fmt.writeUInt16LE(16, 14);
  const chunk = (id: string, body: Buffer) => {
    const h = Buffer.alloc(8);
    h.write(id, 0, "latin1");
    h.writeUInt32LE(body.length, 4);
    return Buffer.concat([h, body]);
  };
  const body = Buffer.concat([
    Buffer.from("WAVE", "latin1"),
    chunk("fmt ", fmt),
    ...(extraChunk ? [chunk("LIST", Buffer.alloc(5)), Buffer.alloc(1)] : []),
    chunk("data", data),
  ]);
  const riff = Buffer.alloc(8);
  riff.write("RIFF", 0, "latin1");
  riff.writeUInt32LE(body.length, 4);
  return Buffer.concat([riff, body]);
}

/** A small valid project: one voiced title scene, one fixed list scene and a fixed quote. */
export function fixtureVideo(over: Record<string, unknown> = {}) {
  return {
    version: 1,
    script: "script.md",
    meta: { title: "Fixture", type: "explainer", format: "reel-9x16", fps: 30, lang: "en" },
    scenes: [
      {
        id: "intro",
        kind: "title",
        narration: ["l1"],
        props: { text: "Rate limiting", subtitle: "in 10 seconds" },
      },
      {
        id: "rules",
        kind: "list",
        durationFrom: "fixed",
        seconds: 2,
        transitionIn: "fade",
        props: {
          heading: "Three rules",
          items: ["Count requests", "Refill slowly", "Reject with 429"],
          numbered: true,
        },
      },
      {
        id: "quote",
        kind: "quote",
        durationFrom: "fixed",
        seconds: 2,
        props: { text: "Be liberal.", by: "Fixture" },
      },
    ],
    ...over,
  };
}

/** A complete, valid explain-mode writer project as file texts. */
export function writerFiles(): Record<
  "brief" | "script" | "facts" | "storyboard" | "hooks",
  string
> {
  return {
    brief: JSON.stringify({
      title: "Rate limiting",
      mode: "explain",
      lang: "en",
      format: "reel-9x16",
      audience: "devs",
      goal: "Explain the token bucket",
      promise: "You will know why APIs return 429",
      lengthSeconds: 30,
      tone: "calm",
      cta: "Follow for more",
    }),
    script: `# Rate limiting
[l1] Your API needs a speed limit.
  beat: hook
[l2] Most people think blocking extra requests is the whole job.
  beat: misconception
[l3] It works like a bucket of tokens at a fair.
  beat: analogy
[l4] Each request takes one token from the bucket.
  beat: step
  fact: f1
[l5] Tokens refill at a steady rate.
  beat: step
  fact: f1
[l6] An empty bucket means the request gets a 429 error.
  beat: edge
  fact: f2
[l7] Buckets allow bursts but keep the average rate fixed.
  beat: takeaway
[l8] Follow for the next one.
  beat: cta
`,
    facts: `- [f1] A token bucket removes one token per request and refills at a fixed rate. Source: https://example.com/token-bucket
- [f2] HTTP 429 means too many requests. Source: https://example.com/http-429
`,
    storyboard: `| scene | kind | narration | visual | seconds | transition | props |
| --- | --- | --- | --- | --- | --- | --- |
| intro | title | l1 | big title | | | \`{"text":"Rate limiting"}\` |
| myth | quote | l2 | the myth | | fade | \`{"text":"Block extra requests."}\` |
| bucket | list | l3,l4,l5 | three steps | | fade | \`{"heading":"Token bucket","items":["Take a token","Refill slowly","Reject when empty"],"numbered":true}\` |
| fail | title | l6 | the error | | | \`{"text":"429","subtitle":"Too Many Requests"}\` |
| wrap | title | l7,l8 | takeaway | 1 | | \`{"text":"Bursts in, average fixed"}\` |
`,
    hooks: `1. Your API needs a speed limit.
2. Most rate limiters are set up wrong.
3. Why does an API say 429?
4. A bucket with no tokens.
5. One number protects your server.
`,
  };
}
