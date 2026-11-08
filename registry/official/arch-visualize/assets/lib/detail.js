// What is inside a component: turns `node.detail` (symbols and what they call) into a model the layout module
// can draw, and answers questions about symbols across the whole model. Pure: no DOM, no network.
(function (root) {
  "use strict";

  var COLUMNS = ["clients", "edge", "frontend", "backend", "async", "data", "external"];

  /** { byId, nodeOf }: every symbol of every node by id, and the node each one belongs to. */
  function index(model) {
    var byId = {},
      nodeOf = {};
    (model.nodes || []).forEach(function (n) {
      ((n.detail && n.detail.symbols) || []).forEach(function (x) {
        byId[x.id] = x;
        nodeOf[x.id] = n.id;
      });
    });
    return { byId: byId, nodeOf: nodeOf };
  }

  /** Everything a symbol points at: [{ to, kind, label, in, inferred }], in a fixed order. */
  function refs(x) {
    var out = [];
    (x.calls || []).forEach(function (c) {
      out.push({ to: c.to, kind: "call", label: c.name, in: c.in || null, line: c.line });
    });
    (x.renders || []).forEach(function (r) {
      if (r.to)
        out.push({ to: r.to, kind: "render", label: r.name, in: r.in || null, line: r.line });
    });
    (x.fetches || []).forEach(function (f) {
      if (f.to)
        out.push({
          to: f.to,
          kind: "fetch",
          label: f.method + " " + f.url,
          in: f.in || null,
          line: f.line,
        });
    });
    (x.rpc || []).forEach(function (r) {
      if (r.to)
        out.push({
          to: r.to,
          kind: "rpc",
          label: r.path,
          in: r.in || null,
          inferred: !!r.inferred,
          line: r.line,
        });
    });
    return out;
  }

  function baseName(file) {
    var parts = file.split("/");
    return parts.slice(-2).join("/");
  }

  /**
   * The layout model for one node's detail. Columns are call depth from the entry points (symbols nothing else
   * in the node calls), so a request reads left to right. Symbols of one file share a group box.
   * labels: { loop, branch, render, fetch, rpc } text for the edge labels.
   */
  function build(node, labels) {
    var symbols = (node.detail && node.detail.symbols) || [];
    var ids = {};
    symbols.forEach(function (x) {
      ids[x.id] = x;
    });
    var out = {},
      incoming = {};
    symbols.forEach(function (x) {
      incoming[x.id] = 0;
      out[x.id] = [];
    });
    symbols.forEach(function (x) {
      refs(x).forEach(function (r) {
        if (!ids[r.to] || r.to === x.id) return;
        out[x.id].push(r.to);
        incoming[r.to]++;
      });
    });
    var roots = symbols
      .filter(function (x) {
        return incoming[x.id] === 0;
      })
      .map(function (x) {
        return x.id;
      });
    if (!roots.length && symbols.length) {
      var least = Math.min.apply(
        null,
        symbols.map(function (x) {
          return incoming[x.id];
        }),
      );
      roots = symbols
        .filter(function (x) {
          return incoming[x.id] === least;
        })
        .map(function (x) {
          return x.id;
        });
    }
    var depth = {};
    var queue = roots.slice();
    roots.forEach(function (id) {
      depth[id] = 0;
    });
    for (var i = 0; i < queue.length; i++)
      out[queue[i]].forEach(function (to) {
        if (depth[to] === undefined) {
          depth[to] = depth[queue[i]] + 1;
          queue.push(to);
        }
      });
    var files = [];
    symbols.forEach(function (x) {
      if (files.indexOf(x.file) < 0) files.push(x.file);
    });
    files.sort();
    var nodes = symbols.map(function (x) {
      var d = Math.min(depth[x.id] === undefined ? 1 : depth[x.id], COLUMNS.length - 1);
      return {
        id: x.id,
        label: x.name,
        role: "backend",
        tech: "generic-backend",
        tier: COLUMNS[d],
        group: "f" + files.indexOf(x.file),
      };
    });
    var groups = files.map(function (f, ix) {
      return { id: "f" + ix, label: baseName(f), kind: "other" };
    });
    var seen = {},
      edges = [],
      info = {};
    symbols.forEach(function (x) {
      refs(x).forEach(function (r) {
        if (!ids[r.to] || r.to === x.id) return;
        var key = x.id + ">" + r.to + ":" + r.kind;
        if (seen[key]) {
          // the same link from several call sites: a loop or branch anywhere shows on the link
          var prior = info[seen[key]];
          if (r.in === "loop" || (r.in === "branch" && prior.in !== "loop")) prior.in = r.in;
          return;
        }
        var id = "e" + edges.length;
        seen[key] = id;
        info[id] = { id: id, from: x.id, to: r.to, kind: r.kind, in: r.in, inferred: !!r.inferred };
        edges.push({ id: id, from: x.id, to: r.to });
      });
    });
    var list = edges.map(function (e) {
      var i = info[e.id];
      var text =
        i.in === "loop"
          ? labels.loop
          : i.in === "branch"
            ? labels.branch
            : i.kind === "render"
              ? labels.render
              : i.kind === "fetch"
                ? labels.fetch
                : i.kind === "rpc"
                  ? labels.rpc
                  : "";
      e.protocol = text;
      i.label = text;
      return i;
    });
    return {
      layoutModel: { nodes: nodes, edges: edges, groups: groups },
      edges: list,
      depth: depth,
      columns: COLUMNS,
    };
  }

  /**
   * Links of one symbol across the whole model: { out: [{ to, kind, label, in, node, inferred }], in: [{ from, ... }] }.
   * `node` is the id of the component the other symbol belongs to, so a link can cross components.
   */
  function links(model, id, idx) {
    idx = idx || index(model);
    var x = idx.byId[id];
    var out = [],
      inc = [];
    if (!x) return { out: out, in: inc };
    refs(x).forEach(function (r) {
      if (idx.byId[r.to])
        out.push({
          to: r.to,
          kind: r.kind,
          label: r.label,
          in: r.in,
          node: idx.nodeOf[r.to],
          inferred: !!r.inferred,
        });
    });
    Object.keys(idx.byId)
      .sort()
      .forEach(function (other) {
        if (other === id) return;
        refs(idx.byId[other]).forEach(function (r) {
          if (r.to === id)
            inc.push({
              from: other,
              kind: r.kind,
              label: r.label,
              in: r.in,
              node: idx.nodeOf[other],
              inferred: !!r.inferred,
            });
        });
      });
    return { out: out, in: inc };
  }

  /**
   * The steps of one symbol, in the order the code makes them: what it calls, renders, fetches or sends, in line
   * order, and what each of those does in turn (depth first, across components). Returns { steps, truncated }.
   * A step is { n, from, to, kind, label, in, line, inferred, depth, again }. `again` marks a call to a symbol whose
   * own steps were already listed. Never revisits a symbol on the path it is following, so cycles end.
   */
  function trace(model, startId, opts, idx) {
    idx = idx || index(model);
    var maxDepth = (opts && opts.maxDepth) || 5;
    var maxSteps = (opts && opts.maxSteps) || 30;
    var steps = [],
      expanded = {},
      truncated = false;
    function walk(id, depth, onPath) {
      var x = idx.byId[id];
      if (!x) return;
      expanded[id] = true;
      var list = refs(x)
        .map(function (r, i) {
          r.order = i;
          return r;
        })
        .sort(function (a, b) {
          return (a.line || 0) - (b.line || 0) || a.order - b.order;
        });
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (!idx.byId[r.to] || onPath[r.to]) continue;
        if (steps.length >= maxSteps) {
          truncated = true;
          return;
        }
        var again = !!expanded[r.to];
        steps.push({
          n: steps.length + 1,
          from: id,
          to: r.to,
          kind: r.kind,
          label: r.label,
          in: r.in,
          line: r.line,
          inferred: !!r.inferred,
          depth: depth,
          again: again,
        });
        if (!again && depth < maxDepth) {
          onPath[r.to] = true;
          walk(r.to, depth + 1, onPath);
          delete onPath[r.to];
        }
      }
    }
    var start = {};
    start[startId] = true;
    walk(startId, 1, start);
    return { steps: steps, truncated: truncated };
  }

  var LIST_KINDS = {
    all: null,
    components: ["component"],
    functions: ["function", "method"],
    routes: ["route", "procedure"],
    hooks: ["hook"],
  };
  function lower(v) {
    return String(v === undefined || v === null ? "" : v).toLowerCase();
  }
  /** How many symbols each list tab holds: { all, components, functions, routes, hooks }. */
  function kindCounts(symbols) {
    var out = {};
    Object.keys(LIST_KINDS).forEach(function (tab) {
      out[tab] = symbols.filter(function (x) {
        return !LIST_KINDS[tab] || LIST_KINDS[tab].indexOf(x.kind) >= 0;
      }).length;
    });
    return out;
  }
  /**
   * The symbols of a list tab that match every word of `query` (name, file, description, route, tRPC path).
   * With no query the order is file then line; with one, best match first. Pure.
   */
  function filter(symbols, query, tab) {
    var kinds = LIST_KINDS[tab] === undefined ? null : LIST_KINDS[tab];
    var words = lower(query)
      .split(/\s+/)
      .filter(function (w) {
        return w;
      });
    var out = [];
    symbols.forEach(function (x) {
      if (kinds && kinds.indexOf(x.kind) < 0) return;
      var fields = [
        [lower(x.name), 10],
        [lower(x.file), 4],
        [lower(x.doc), 3],
        [lower(x.route && x.route.path), 5],
        [lower(x.procedure && x.procedure.path), 5],
        [lower(x.kind), 2],
      ];
      var total = 0;
      for (var w = 0; w < words.length; w++) {
        var best = 0;
        for (var f = 0; f < fields.length; f++) {
          var at = fields[f][0].indexOf(words[w]);
          if (at >= 0) best = Math.max(best, fields[f][1] + (at === 0 ? fields[f][1] / 2 : 0));
        }
        if (!best) return;
        total += best;
      }
      out.push({ x: x, score: total });
    });
    out.sort(function (a, b) {
      if (words.length && b.score !== a.score) return b.score - a.score;
      return a.x.file < b.x.file
        ? -1
        : a.x.file > b.x.file
          ? 1
          : a.x.line - b.x.line || (a.x.id < b.x.id ? -1 : 1);
    });
    return out.map(function (o) {
      return o.x;
    });
  }

  root.ArchDetail = {
    index: index,
    refs: refs,
    build: build,
    links: links,
    trace: trace,
    filter: filter,
    kindCounts: kindCounts,
    COLUMNS: COLUMNS,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
