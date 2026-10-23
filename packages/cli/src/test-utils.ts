import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";

export const SHA = "a1b2c3d4e5".repeat(4);

export async function tmpDir(prefix = "aisle-test-"): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

/** Build a codeload-style tar.gz: everything lives under "<repo>-<sha>/". */
export async function makeTarball(
  files: Record<string, string>,
  opts: { symlinks?: Record<string, string> } = {},
): Promise<Buffer> {
  const work = await tmpDir("aisle-tarball-");
  const root = "repo-" + SHA;
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(work, root, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  for (const [rel, target] of Object.entries(opts.symlinks ?? {})) {
    const file = path.join(work, root, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await symlink(target, file);
  }
  const chunks: Buffer[] = [];
  const stream = tar.c({ gzip: true, cwd: work }, [root]);
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export const skillMd = (name: string, extra = "") =>
  `---\nname: ${name}\ndescription: Test skill ${name}.\n${extra}---\n# ${name}\n`;

/** Serve one tarball for any `/<owner>/<repo>/tar.gz/<sha>` request. */
export async function serveTarball(
  body: Buffer,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    if (!/\/tar\.gz\/[0-9a-f]{40}$/.test(req.url ?? "")) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": "application/gzip" }).end(body);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
