// Reads JS/TS/JSX text with the vendored parser and lists the symbols of each file: functions, components, hooks,
// class methods, Next.js route handlers and tRPC procedures, with their calls, renders, fetches and loop/branch
// use. Pure functions over text; nothing here touches the disk or the network or runs project code.
import path from "node:path";
import { parse } from "../assets/vendor/babel-parser.mjs";

const EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const HTTP_VERBS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const LOOP_METHODS = new Set([
  "map",
  "forEach",
  "filter",
  "reduce",
  "flatMap",
  "some",
  "every",
  "find",
  "findLast",
]);
const RPC_VERBS = new Set([
  "useQuery",
  "useSuspenseQuery",
  "useInfiniteQuery",
  "useMutation",
  "query",
  "mutate",
  "mutateAsync",
  "fetch",
  "prefetch",
]);
const WRAPPERS = new Set(["memo", "forwardRef", "observer", "useCallback"]);
const SKIP_KEYS = new Set([
  "loc",
  "start",
  "end",
  "range",
  "extra",
  "leadingComments",
  "trailingComments",
  "innerComments",
  "comments",
  "errors",
  "tokens",
]);
// A comment that looks like it holds a credential is dropped instead of being copied into the model.
const SECRETISH =
  /sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{16,}|xox[abp]-|AKIA[0-9A-Z]{16}|:\/\/[^\s:@/]+:[^\s@/]+@/;
const DIRECTIVE =
  /^(eslint|prettier|istanbul|c8|@ts-|@license|license|copyright|biome|jshint|globals?\b)/i;

const isNode = (v) => v && typeof v === "object" && typeof v.type === "string";

/** Visit every AST node under `node` (children before nothing: pre-order). `visit(node, parent, key)`. */
function walk(node, visit, parent = null, key = null) {
  if (visit(node, parent, key) === false) return;
  for (const k of Object.keys(node)) {
    if (SKIP_KEYS.has(k)) continue;
    const v = node[k];
    if (Array.isArray(v)) {
      for (const c of v) if (isNode(c)) walk(c, visit, node, k);
    } else if (isNode(v)) walk(v, visit, node, k);
  }
}

/** Parse text as TypeScript (+ JSX where the extension allows it). Null when the file cannot be parsed. */
function parseText(text, file) {
  const base = /\.(ts|mts|cts)$/.test(file) ? ["typescript"] : ["typescript", "jsx"];
  // decorators (@Injectable()) are not standard syntax yet, so they are only enabled when the plain parse fails
  for (const plugins of [base, [...base, "decorators-legacy"]]) {
    try {
      return parse(text, {
        sourceType: "module",
        errorRecovery: true,
        allowReturnOutsideFunction: true,
        allowImportExportEverywhere: true,
        plugins,
      }).program;
    } catch {
      // try the next plugin set
    }
  }
  return null;
}

/** First sentence of the closest leading comment, or "". Directive and licence comments are skipped. */
function docOf(...nodes) {
  for (const n of nodes) {
    const cs = n?.leadingComments;
    if (!cs?.length) continue;
    const kept = [];
    for (let i = cs.length - 1; i >= 0; i--) {
      const c = cs[i];
      const lines = c.value
        .split(/\r?\n/)
        .map((l) => l.replace(/^\s*\*+\s?/, "").trim())
        .filter((l, idx, all) => l || (idx > 0 && idx < all.length - 1));
      if (lines.length === 0 || DIRECTIVE.test(lines[0] ?? "")) break;
      kept.unshift(...lines);
      if (c.type === "CommentBlock") break;
    }
    const text = [];
    for (const l of kept) {
      if (!l || l.startsWith("@")) break;
      text.push(l);
    }
    const doc = text.join(" ").replace(/\s+/g, " ").trim();
    if (!doc || SECRETISH.test(doc)) continue;
    const sentence = doc.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? doc;
    return sentence.length > 160 ? `${sentence.slice(0, 157).trimEnd()}...` : sentence;
  }
  return "";
}

/** `a.b.c` for an identifier or member chain; ".then" style for a chain that starts at a call. */
function calleeName(node) {
  switch (node.type) {
    case "Identifier":
      return { name: node.name, root: node.name };
    case "ThisExpression":
      return { name: "this", root: "this" };
    case "Super":
      return { name: "super", root: "super" };
    case "TSNonNullExpression":
    case "TSAsExpression":
    case "AwaitExpression":
      return calleeName(node.expression ?? node.argument);
    case "CallExpression":
    case "OptionalCallExpression":
      // a chain such as load(x).then(...): the root is the inner call's callee
      return calleeName(node.callee);
    case "MemberExpression":
    case "OptionalMemberExpression": {
      const prop = node.computed
        ? node.property.type === "StringLiteral"
          ? node.property.value
          : "[]"
        : (node.property.name ?? "?");
      const base = calleeName(node.object);
      return base
        ? { name: `${base.name}.${prop}`, root: base.root }
        : { name: `.${prop}`, root: null };
    }
    default:
      return null;
  }
}

const jsxName = (n) =>
  n.type === "JSXIdentifier"
    ? n.name
    : n.type === "JSXMemberExpression"
      ? `${jsxName(n.object)}.${n.property.name}`
      : null;

/** The URL path of a fetch-style first argument, with ${...} turned into :param. Null when it is not a path. */
function urlPath(arg) {
  const text = (n) => {
    if (n?.type === "StringLiteral") return n.value;
    if (n?.type === "TemplateLiteral")
      return n.quasis
        .map((q, i) => q.value.cooked + (i < n.expressions.length ? ":param" : ""))
        .join("");
    if (n?.type === "BinaryExpression" && n.operator === "+") {
      const l = text(n.left);
      return l === null ? null : l + (text(n.right) ?? ":param");
    }
    return null;
  };
  const s = text(arg);
  if (s === null) return null;
  const m = s.match(/^\/(?!\/)[\w\-./:%]*/);
  return m ? m[0].replace(/\/+$/, "") || "/" : null;
}

const objectProp = (obj, name) =>
  obj?.type === "ObjectExpression"
    ? obj.properties.find(
        (p) => p.type === "ObjectProperty" && (p.key.name === name || p.key.value === name),
      )
    : undefined;

/** The module of `import("x")` or `await import("x")`, or null. */
function dynamicSource(init) {
  const e = init?.type === "AwaitExpression" ? init.argument : init;
  if (e?.type === "ImportExpression" && e.source?.type === "StringLiteral") return e.source.value;
  if (
    e?.type === "CallExpression" &&
    e.callee.type === "Import" &&
    e.arguments[0]?.type === "StringLiteral"
  )
    return e.arguments[0].value;
  return null;
}

/** Describe the body of one function: calls, renders, fetches, rpc calls, loop and branch use. */
function scanBody(body, imports) {
  const localImports = new Map(); // const { x } = await import("./y")
  const calls = [];
  const renders = [];
  const fetches = [];
  const rpc = [];
  let hasJsx = false;
  let loops = 0;
  let branches = 0;

  const visit = (node, ctx) => {
    walk(node, (n, parent, key) => {
      // a loop callback (.map(x => ...)) runs once per item, so its body counts as inside a loop
      if (
        (n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression") &&
        parent?.type === "CallExpression" &&
        key === "arguments" &&
        parent.callee.type === "MemberExpression" &&
        LOOP_METHODS.has(parent.callee.property?.name) &&
        ctx.where !== "loop"
      ) {
        loops++;
        visit(n.body, { where: "loop" });
        return false;
      }
      if (/^(For|ForIn|ForOf|While|DoWhile)Statement$/.test(n.type) && ctx.where !== "loop") {
        loops++;
        visit(n.body, { where: "loop" });
        // the loop header (what is iterated) runs once, outside the loop
        for (const k of ["init", "test", "update", "left", "right"])
          if (isNode(n[k])) visit(n[k], ctx);
        return false;
      }
      if (ctx.where === null) {
        if (n.type === "IfStatement") {
          branches++;
          visit(n.test, ctx);
          visit(n.consequent, { where: "branch" });
          if (n.alternate) visit(n.alternate, { where: "branch" });
          return false;
        }
        if (n.type === "ConditionalExpression") {
          branches++;
          visit(n.test, ctx);
          visit(n.consequent, { where: "branch" });
          visit(n.alternate, { where: "branch" });
          return false;
        }
        if (n.type === "SwitchStatement") {
          branches++;
          visit(n.discriminant, ctx);
          for (const c of n.cases) for (const s of c.consequent) visit(s, { where: "branch" });
          return false;
        }
        if (n.type === "LogicalExpression") {
          visit(n.left, ctx);
          visit(n.right, { where: "branch" });
          return false;
        }
        if (n.type === "CatchClause") {
          branches++;
          visit(n.body, { where: "branch" });
          return false;
        }
      }
      if (n.type === "VariableDeclarator" && n.init) {
        const from = dynamicSource(n.init);
        if (from && n.id.type === "ObjectPattern") {
          for (const pr of n.id.properties)
            if (pr.type === "ObjectProperty" && pr.value.type === "Identifier")
              localImports.set(pr.value.name, { from, imported: pr.key.name ?? pr.key.value });
        } else if (from && n.id.type === "Identifier") {
          localImports.set(n.id.name, { from, imported: "*" });
        }
      }
      if (n.type === "JSXElement" || n.type === "JSXFragment") hasJsx = true;
      if (n.type === "JSXOpeningElement") {
        const name = jsxName(n.name);
        if (name && /^[A-Z]/.test(name))
          renders.push({ name, line: n.loc.start.line, in: ctx.where });
      }
      if (
        n.type === "CallExpression" ||
        n.type === "OptionalCallExpression" ||
        n.type === "NewExpression"
      ) {
        const callee = calleeName(n.callee);
        const line = n.loc.start.line;
        if (callee && callee.name !== "super") {
          const isNew = n.type === "NewExpression";
          if (!isNew || /^[A-Z]/.test(callee.name.split(".").pop()))
            calls.push({ name: callee.name, root: callee.root, line, in: ctx.where, isNew });
          const last = callee.name.split(".").pop();
          const rootImport = callee.root ? imports.get(callee.root) : undefined;
          if (RPC_VERBS.has(last) && callee.name.includes(".")) {
            const isTrpc = callee.root === "trpc" || (rootImport && /trpc/i.test(rootImport.from));
            if (isTrpc) {
              const parts = callee.name.split(".").slice(1, -1);
              if (parts.length)
                rpc.push({
                  path: parts.join("."),
                  kind: /mutat/i.test(last) ? "mutation" : "query",
                  line,
                  in: ctx.where,
                });
            }
          }
          const verb = last.toUpperCase();
          const isFetch = callee.name === "fetch";
          const isHttpLib =
            callee.root &&
            /^(axios|ky|api|http|client)$/i.test(callee.root) &&
            HTTP_VERBS.has(verb) &&
            callee.name.includes(".");
          if (isFetch || isHttpLib) {
            const url = urlPath(n.arguments[0]);
            if (url) {
              let method = isHttpLib ? verb : "GET";
              const m = objectProp(n.arguments[1], "method");
              if (m?.value?.type === "StringLiteral") method = m.value.value.toUpperCase();
              fetches.push({ url, method, line, in: ctx.where });
            }
          }
        }
      }
      return true;
    });
  };
  visit(body, { where: null });
  return { calls, renders, fetches, rpc, hasJsx, loops, branches, localImports };
}

/** Next.js route path for a file: app/api/x/[id]/route.ts -> /api/x/:id, pages/api/y.ts -> /api/y. */
function routeOf(file) {
  const app = file.match(/(?:^|\/)app\/(.*?)\/?route\.[cm]?[jt]sx?$/);
  const pages = file.match(/(?:^|\/)pages\/(api\/.*?)(?:\/index)?\.[cm]?[jt]sx?$/);
  const raw = app ? app[1] : pages ? pages[1] : null;
  if (raw === null) return null;
  const segs = raw
    .split("/")
    .filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith("@"))
    .map((s) => s.replace(/^\[\.\.\.(.+)\]$/, ":$1*").replace(/^\[(.+)\]$/, ":$1"));
  return `/${segs.join("/")}`;
}

/** Top-level symbols of one file: functions, components, hooks, classes' methods and route handlers. */
function collectSymbols(program, file) {
  const out = [];
  const isRouteFile = routeOf(file) !== null;
  const fileBase = path.posix.basename(file).replace(/\.[^.]+$/, "");
  const add = (name, fn, exported, declNode, wrapperNode, className) => {
    out.push({
      name: className ? `${className}.${name}` : name,
      fn,
      exported,
      doc: docOf(wrapperNode, declNode, fn),
      line: (declNode ?? fn).loc.start.line,
      endLine: (declNode ?? fn).loc.end.line,
      async: Boolean(fn.async),
      isMethod: Boolean(className),
      isRouteFile,
      fileBase,
    });
  };
  const fnOf = (init) => {
    let e = init;
    while (
      e &&
      (e.type === "TSAsExpression" ||
        e.type === "TSSatisfiesExpression" ||
        e.type === "ParenthesizedExpression")
    )
      e = e.expression;
    if (!e) return null;
    if (e.type === "ArrowFunctionExpression" || e.type === "FunctionExpression") return e;
    if (e.type === "CallExpression") {
      const c = calleeName(e.callee);
      const base = c?.name.split(".").pop();
      if (base && WRAPPERS.has(base)) return fnOf(e.arguments[0]);
    }
    return null;
  };
  const decl = (node, exported, wrapper) => {
    if (!node) return;
    if (node.type === "FunctionDeclaration") {
      add(node.id?.name ?? "default", node, exported, node, wrapper);
    } else if (node.type === "ClassDeclaration") {
      const cname = node.id?.name ?? "default";
      for (const m of node.body.body)
        if (m.type === "ClassMethod" && m.key?.name && m.kind !== "constructor")
          add(m.key.name, m, exported, m, wrapper, cname);
    } else if (node.type === "VariableDeclaration") {
      for (const d of node.declarations) {
        const fn = fnOf(d.init);
        if (fn && d.id.type === "Identifier") add(d.id.name, fn, exported, node, wrapper);
      }
    } else if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") {
      add("default", node, exported, node, wrapper);
    } else if (node.type === "CallExpression") {
      const fn = fnOf(node);
      if (fn) add("default", fn, exported, node, wrapper);
    }
  };
  for (const st of program.body) {
    if (st.type === "ExportNamedDeclaration") decl(st.declaration, true, st);
    else if (st.type === "ExportDefaultDeclaration") decl(st.declaration, true, st);
    else decl(st, false, null);
  }
  return out;
}

const PROC_VERBS = new Set(["query", "mutation", "subscription"]);

/** True for a chain like authedProcedure.input(x).query(...): a procedure builder, not any object with a query method. */
function isProcedureChain(call) {
  const links = [];
  let cur = call.callee.object;
  for (let hops = 0; cur && hops < 20; hops++) {
    if (cur.type === "CallExpression") {
      links.push(cur.callee.property?.name);
      cur = cur.callee.object;
    } else if (cur.type === "MemberExpression") cur = cur.object;
    else break;
  }
  const root = cur?.type === "Identifier" ? cur.name : "";
  return (
    /procedure$/i.test(root) || links.some((n) => ["input", "output", "use", "meta"].includes(n))
  );
}

/** tRPC path of a procedure from its file layout: routers/viewer/bookings/_router.tsx + "get" -> viewer.bookings.get. */
function trpcPath(file, name) {
  const m = file.match(/(?:^|\/)routers?\/(.+)$/);
  if (!m) return null;
  const parts = m[1].split("/");
  const base = parts.pop().replace(/\.[^.]+$/, "");
  if (!/^(_?router|index|_app)$/i.test(base)) parts.push(base.replace(/\.router$/i, ""));
  return [...parts, name].join(".");
}

/** tRPC procedures: object properties whose value is a chain ending in .query(), .mutation() or .subscription(). */
function collectProcedures(program, file) {
  const out = [];
  const keyOf = (p) => (p.computed ? null : (p.key.name ?? p.key.value ?? null));
  const visit = (node, keys) => {
    walk(node, (n, parent, key) => {
      if (n.type !== "ObjectProperty" || key !== "properties") return true;
      const k = keyOf(n);
      if (k === null) return true;
      let v = n.value;
      while (v?.type === "TSAsExpression" || v?.type === "TSSatisfiesExpression") v = v.expression;
      if (
        v?.type === "CallExpression" &&
        v.callee.type === "MemberExpression" &&
        PROC_VERBS.has(v.callee.property?.name) &&
        isProcedureChain(v)
      ) {
        const arg = v.arguments[v.arguments.length - 1];
        let fn = null;
        if (arg?.type === "ArrowFunctionExpression" || arg?.type === "FunctionExpression") fn = arg;
        else if (arg?.type === "Identifier")
          fn = {
            body: { type: "CallExpression", callee: arg, arguments: [], loc: arg.loc },
            async: false,
          };
        out.push({
          name: [...keys, k].join("."),
          fn: fn ?? { body: { type: "BlockStatement", body: [] }, async: false },
          exported: true,
          doc: docOf(n),
          line: n.loc.start.line,
          endLine: n.loc.end.line,
          async: Boolean(fn?.async),
          isMethod: false,
          isRouteFile: false,
          fileBase: path.posix.basename(file).replace(/\.[^.]+$/, ""),
          forcedKind: "procedure",
          procedure: { kind: v.callee.property.name },
        });
        return false; // do not look for procedures inside a procedure
      }
      // descend into nested routers, remembering the key
      if (isNode(n.value)) visit(n.value, [...keys, k]);
      return false;
    });
  };
  visit(program, []);
  return out;
}

/** Imports and re-exports of one file. */
function collectImports(program) {
  const imports = new Map(); // local name -> { from, imported }
  const reexports = []; // { from, names: Map(exportedName -> importedName) | null (export *) }
  let defaultName = null; // local name of the default export; "default" for an anonymous one
  for (const st of program.body) {
    if (st.type === "ExportDefaultDeclaration") {
      const d = st.declaration;
      defaultName = d.type === "Identifier" ? d.name : (d.id?.name ?? "default");
    } else if (st.type === "ExportNamedDeclaration" && !st.source) {
      for (const sp of st.specifiers)
        if (sp.type === "ExportSpecifier" && (sp.exported.name ?? sp.exported.value) === "default")
          defaultName = sp.local.name ?? sp.local.value;
    }
    if (st.type === "ImportDeclaration" && st.importKind !== "type") {
      for (const s of st.specifiers) {
        if (s.importKind === "type") continue;
        const imported =
          s.type === "ImportDefaultSpecifier"
            ? "default"
            : s.type === "ImportNamespaceSpecifier"
              ? "*"
              : (s.imported.name ?? s.imported.value);
        imports.set(s.local.name, { from: st.source.value, imported });
      }
    } else if (st.type === "ExportNamedDeclaration" && st.source && st.exportKind !== "type") {
      const names = new Map();
      for (const s of st.specifiers)
        if (s.type === "ExportSpecifier")
          names.set(s.exported.name ?? s.exported.value, s.local.name ?? s.local.value);
      reexports.push({ from: st.source.value, names });
    } else if (st.type === "ExportAllDeclaration" && st.exportKind !== "type") {
      reexports.push({ from: st.source.value, names: null });
    }
  }
  return { imports, reexports, defaultName };
}

export {
  EXTS,
  HTTP_VERBS,
  collectImports,
  collectProcedures,
  collectSymbols,
  parseText,
  routeOf,
  scanBody,
  trpcPath,
};
