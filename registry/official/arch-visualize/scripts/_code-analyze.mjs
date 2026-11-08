// Turns the symbols of many files into one linked picture: resolves imports (relative, tsconfig paths, workspace
// packages, barrel files), links fetches to routes and tRPC calls to procedures, ranks symbols, and keeps the most
// connected ones, or those an entry point reaches. Pure: sources in, plain data out.
import path from "node:path";
import {
  EXTS,
  HTTP_VERBS,
  collectImports,
  collectProcedures,
  collectSymbols,
  parseText,
  routeOf,
  scanBody,
  trpcPath,
} from "./_code-ast.mjs";

const countBy = (list, key) => {
  const out = {};
  for (const x of list) out[key(x)] = (out[key(x)] ?? 0) + 1;
  return out;
};

/**
 * Analyse a set of source files given as { "path/from/root.ts": "text" } (pure: no disk, no network).
 * `aliases` is [{ prefix: "@/", dirs: ["src/"] }] from a tsconfig; paths are relative to the project root.
 */
export function analyzeSources(
  sources,
  { aliases = [], maxSymbols = 40, scope = ".", focus = null, only = null, perFile = false } = {},
) {
  const fileSet = new Set(Object.keys(sources));
  const fileInfo = new Map();
  const failed = [];
  for (const file of [...fileSet].sort()) {
    const program = parseText(sources[file], file);
    if (!program) {
      failed.push(file);
      continue;
    }
    fileInfo.set(file, { program, ...collectImports(program) });
  }

  const resolveFile = (base) => {
    const stripped = base.replace(/\.(m|c)?js$/, "");
    for (const cand of [
      base,
      ...EXTS.map((e) => base + e),
      ...EXTS.map((e) => `${stripped}${e}`),
      ...EXTS.map((e) => `${base}/index${e}`),
    ])
      if (fileSet.has(cand)) return cand;
    return null;
  };
  /** { file } when it points at a scanned file, { module, outside } otherwise. */
  const resolveSpec = (spec, from) => {
    if (spec.startsWith(".")) {
      const file = resolveFile(
        path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)),
      );
      return file ? { file } : { module: spec, outside: true };
    }
    for (const a of aliases) {
      if (spec === a.prefix.replace(/\/$/, "") || spec.startsWith(a.prefix)) {
        const rest = spec.slice(a.prefix.length);
        for (const d of a.dirs) {
          const file = resolveFile(path.posix.normalize(path.posix.join(d, rest)));
          if (file) return { file };
        }
        return { module: spec, outside: true };
      }
    }
    return { module: spec };
  };

  // symbols
  const symbols = new Map(); // id -> symbol
  const byFile = new Map(); // file -> Map(name -> id)
  for (const [file, info] of fileInfo) {
    const names = new Map();
    byFile.set(file, names);
    for (const raw of [
      ...collectSymbols(info.program, file),
      ...collectProcedures(info.program, file),
    ]) {
      const id = `${file}#${raw.name}`;
      if (symbols.has(id)) continue;
      names.set(raw.name, id);
      symbols.set(id, { id, file, ...raw });
    }
  }
  const resolveExport = (file, name, depth = 0) => {
    const names = byFile.get(file);
    if (name === "default") {
      const local = fileInfo.get(file)?.defaultName;
      if (local && names?.has(local)) return names.get(local);
    }
    if (names?.has(name)) {
      const id = names.get(name);
      if (symbols.get(id).exported || name === "default") return id;
    }
    if (depth > 4) return null;
    const info = fileInfo.get(file);
    for (const re of info?.reexports ?? []) {
      const r = resolveSpec(re.from, file);
      if (!r.file) continue;
      if (re.names === null) {
        const hit = resolveExport(r.file, name, depth + 1);
        if (hit) return hit;
      } else if (re.names.has(name)) {
        const hit = resolveExport(r.file, re.names.get(name), depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  };

  // analyse bodies with each file's real imports
  for (const sym of symbols.values()) {
    const info = fileInfo.get(sym.file);
    const scan = scanBody(sym.fn.body, info.imports);
    const names = byFile.get(sym.file);
    const classPrefix = sym.isMethod ? `${sym.name.split(".")[0]}.` : "";
    const resolveName = (name, root) => {
      const imp = root ? (scan.localImports.get(root) ?? info.imports.get(root)) : undefined;
      if (imp) {
        const r = resolveSpec(imp.from, sym.file);
        if (r.file) {
          const direct = name === root;
          const target = direct
            ? resolveExport(r.file, imp.imported === "*" ? "default" : imp.imported)
            : imp.imported === "*"
              ? resolveExport(r.file, name.split(".")[1])
              : null;
          if (target) return { to: target };
          return { module: r.file, outside: false, unresolved: true };
        }
        return { module: r.module, outside: Boolean(r.outside) };
      }
      const local =
        names.get(name) ??
        (classPrefix && name.startsWith("this.")
          ? names.get(classPrefix + name.slice(5))
          : undefined);
      if (local) return { to: local };
      return null;
    };
    const calls = [];
    const external = [];
    for (const c of scan.calls) {
      const r = resolveName(c.name, c.root);
      if (r?.to) calls.push({ to: r.to, name: c.name, line: c.line, in: c.in });
      else if (r?.module)
        external.push({
          name: c.name,
          module: r.module,
          line: c.line,
          in: c.in,
          outside: r.outside,
        });
      else external.push({ name: c.name, line: c.line, in: c.in });
    }
    const renders = [];
    for (const rn of scan.renders) {
      const root = rn.name.split(".")[0];
      const r =
        resolveName(rn.name, root) ?? (names.has(rn.name) ? { to: names.get(rn.name) } : null);
      renders.push(
        r?.to
          ? { to: r.to, name: rn.name, line: rn.line, in: rn.in }
          : { name: rn.name, module: r?.module, line: rn.line, in: rn.in },
      );
    }
    sym.calls = calls;
    sym.external = external;
    sym.renders = renders;
    sym.fetches = scan.fetches;
    sym.rpc = scan.rpc;
    sym.loops = scan.loops;
    sym.branches = scan.branches;
    const route = routeOf(sym.file);
    const upper = sym.name.toUpperCase();
    const isHandler =
      route !== null &&
      (HTTP_VERBS.has(sym.name) || (sym.name === "default" && /\/pages\//.test(`/${sym.file}`)));
    sym.kind = sym.forcedKind
      ? sym.forcedKind
      : isHandler
        ? "route"
        : /^use[A-Z0-9]/.test(sym.name)
          ? "hook"
          : sym.isMethod
            ? "method"
            : scan.hasJsx && (sym.name === "default" || /^[A-Z]/.test(sym.name))
              ? "component"
              : "function";
    if (isHandler) sym.route = { path: route, method: HTTP_VERBS.has(upper) ? upper : "ANY" };
    if (sym.procedure) {
      const tp = trpcPath(sym.file, sym.name);
      if (tp) sym.procedure.path = tp;
    }
    if (sym.name === "default" && sym.kind === "component") sym.name = sym.fileBase;
  }

  // link a page's HTTP call to the Next.js route that serves it, and tRPC calls to the procedure with that path
  const routes = [...symbols.values()].filter((x) => x.route);
  const procs = new Map();
  for (const x of symbols.values())
    if (x.procedure?.path)
      procs.set(x.procedure.path, [...(procs.get(x.procedure.path) ?? []), x.id]);
  const matchRoute = (url, method) => {
    const u = url.split("/");
    const hits = routes.filter((r) => {
      const rp = r.route.path.split("/");
      return (
        rp.length === u.length &&
        rp.every((seg, i) => seg === u[i] || seg.startsWith(":") || u[i].startsWith(":")) &&
        (r.route.method === "ANY" || r.route.method === method)
      );
    });
    return hits.length === 1 ? hits[0].id : null;
  };
  for (const x of symbols.values()) {
    x.fetches = x.fetches.map((f) => {
      const to = matchRoute(f.url, f.method);
      return to ? { ...f, to } : f;
    });
    x.rpc = x.rpc.map((r) => {
      const hits = procs.get(r.path);
      return hits?.length === 1 ? { ...r, to: hits[0], inferred: true } : r;
    });
  }
  const refsOf = (x) => [
    ...x.calls.map((e) => e.to),
    ...x.renders.filter((e) => e.to).map((e) => e.to),
    ...x.fetches.filter((e) => e.to).map((e) => e.to),
    ...x.rpc.filter((e) => e.to).map((e) => e.to),
  ];

  // fan-in from other symbols in the scanned files
  const calledBy = new Map();
  for (const x of symbols.values())
    for (const to of refsOf(x))
      if (to !== x.id) {
        if (!calledBy.has(to)) calledBy.set(to, new Set());
        calledBy.get(to).add(x.id);
      }
  const score = (x) =>
    (calledBy.get(x.id)?.size ?? 0) * 2 +
    (x.exported ? 3 : 0) +
    (["route", "component", "procedure"].includes(x.kind) ? 2 : 0) +
    Math.min(x.calls.length + x.external.length, 5) * 0.2;

  // --focus: keep what an entry point reaches (calls, renders, fetches, rpc), nearest first
  let candidates = [...symbols.values()];
  let focusInfo;
  const dist = new Map();
  if (focus?.entries?.length) {
    const queue = [];
    for (const x of symbols.values())
      if (focus.entries.some((e) => x.id === e || x.file === e)) {
        dist.set(x.id, 0);
        queue.push(x.id);
      }
    for (let i = 0; i < queue.length; i++) {
      const d = dist.get(queue[i]);
      if (d >= (focus.depth ?? 4)) continue;
      for (const to of refsOf(symbols.get(queue[i])))
        if (symbols.has(to) && !dist.has(to)) {
          dist.set(to, d + 1);
          queue.push(to);
        }
    }
    candidates = candidates.filter((x) => dist.has(x.id));
    focusInfo = { entries: focus.entries, depth: focus.depth ?? 4, reached: candidates.length };
  }
  if (only)
    candidates = candidates.filter((x) =>
      only.some((d) => d === "." || x.file === d || x.file.startsWith(`${d}/`)),
    );
  const ranked = candidates.sort(
    (a, b) =>
      (dist.get(a.id) ?? 0) - (dist.get(b.id) ?? 0) ||
      score(b) - score(a) ||
      (a.id < b.id ? -1 : 1),
  );
  const keep = new Set(ranked.slice(0, maxSymbols).map((x) => x.id));

  const withoutTo = (e) => {
    if (!e.to || keep.has(e.to)) return e;
    const rest = { ...e };
    delete rest.to;
    return rest;
  };
  const out = [...symbols.values()]
    .filter((x) => keep.has(x.id))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line))
    .map((x) => {
      const hidden = refsOf(x).filter((to) => !keep.has(to)).length;
      const ext = new Map();
      for (const e of x.external) {
        const key = `${e.module ?? ""}|${e.name}`;
        if (!ext.has(key)) ext.set(key, e);
      }
      return {
        id: x.id,
        name: x.name,
        kind: x.kind,
        file: x.file,
        line: x.line,
        endLine: x.endLine,
        exported: x.exported,
        async: x.async,
        ...(x.doc ? { doc: x.doc } : {}),
        ...(x.route ? { route: x.route } : {}),
        ...(x.procedure ? { procedure: x.procedure } : {}),
        calls: x.calls.filter((e) => keep.has(e.to)),
        renders: x.renders.filter((r) => !r.to || keep.has(r.to)),
        external: [...ext.values()].slice(0, 8),
        fetches: x.fetches.map(withoutTo),
        rpc: x.rpc.map(withoutTo),
        calledBy: [...(calledBy.get(x.id) ?? [])].filter((id) => keep.has(id)).sort(),
        loops: x.loops,
        branches: x.branches,
        ...(hidden ? { hiddenCalls: hidden } : {}),
      };
    });

  return {
    version: 1,
    scope,
    files: fileSet.size,
    parsed: fileInfo.size,
    failed: failed.sort(),
    symbolsFound: symbols.size,
    symbolsKept: out.length,
    truncated: (focusInfo ? focusInfo.reached : symbols.size) > out.length,
    ...(focusInfo ? { focus: focusInfo } : {}),
    ...(perFile ? { foundPerFile: countBy([...symbols.values()], (x) => x.file) } : {}),
    symbols: out,
  };
}

/**
 * Which calls between two nodes implement a connection: for every edge A -> B, the symbols of A's detail that
 * call, render, fetch or send an rpc to a symbol of B's detail. Pure; returns { edgeId: via[] } (at most 20 each).
 */
export function deriveVia(model) {
  const owner = new Map();
  for (const n of model.nodes) for (const x of n.detail?.symbols ?? []) owner.set(x.id, n.id);
  const edgeOf = new Map(model.edges.map((e) => [`${e.from}>${e.to}`, e]));
  const out = new Map();
  for (const n of model.nodes)
    for (const x of n.detail?.symbols ?? []) {
      const refs = [
        ...x.calls.map((e) => ({ to: e.to, kind: "call", label: e.name })),
        ...x.renders.filter((e) => e.to).map((e) => ({ to: e.to, kind: "render", label: e.name })),
        ...x.fetches
          .filter((e) => e.to)
          .map((e) => ({ to: e.to, kind: "fetch", label: `${e.method} ${e.url}` })),
        ...x.rpc.filter((e) => e.to).map((e) => ({ to: e.to, kind: "rpc", label: e.path })),
      ];
      for (const r of refs) {
        const target = owner.get(r.to);
        const edge = target && target !== n.id ? edgeOf.get(`${n.id}>${target}`) : undefined;
        if (!edge) continue;
        const list = out.get(edge.id) ?? [];
        if (list.length < 20 && !list.some((v) => v.from === x.id && v.to === r.to))
          list.push({ from: x.id, to: r.to, kind: r.kind, label: r.label.slice(0, 60) });
        out.set(edge.id, list);
      }
    }
  return out;
}
