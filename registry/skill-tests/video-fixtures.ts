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
