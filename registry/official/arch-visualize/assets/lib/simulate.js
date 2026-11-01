// What-if simulation: if these components go down, what else fails, what only slows down, and which
// request flows break. It reads the model only, so it shows what the model says and nothing more: it is
// not a prediction about production. Pure; the same input always gives the same result.
//
//   a down component is "failed"
//   a caller over a synchronous connection to a failed component fails too (and so on, up the chain)
//   a caller over a connection marked `optional` (it has a fallback) is "degraded", and the spread stops
//   a caller over an asynchronous connection is "degraded": its work is delayed, the queue builds up
(function (root) {
  "use strict";

  function byId(a, b) {
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }

  /** `downIds`: one id or a list. Unknown ids are ignored and reported in `ignored`. */
  function simulate(model, downIds) {
    var nodes = {};
    (model.nodes || []).forEach(function (n) {
      nodes[n.id] = n;
    });
    var edgeList = (model.edges || [])
      .filter(function (e) {
        return nodes[e.from] && nodes[e.to];
      })
      .slice()
      .sort(byId);
    var edgeById = {};
    var incoming = {};
    edgeList.forEach(function (e) {
      edgeById[e.id] = e;
      (incoming[e.to] = incoming[e.to] || []).push(e);
    });
    var wanted = (Array.isArray(downIds) ? downIds : [downIds]).filter(function (id) {
      return typeof id === "string";
    });
    var down = [];
    var ignored = [];
    wanted.forEach(function (id) {
      if (nodes[id]) {
        if (down.indexOf(id) < 0) down.push(id);
      } else if (ignored.indexOf(id) < 0) ignored.push(id);
    });
    down.sort();

    var failed = {};
    var degraded = {};
    var cause = {}; // node id -> { kind, edge, cause }
    var queue = [];
    down.forEach(function (id) {
      failed[id] = true;
      cause[id] = { kind: "down", edge: null, cause: null };
      queue.push(id);
    });
    for (var q = 0; q < queue.length; q++) {
      var at = queue[q];
      (incoming[at] || []).forEach(function (e) {
        var caller = e.from;
        if (failed[caller]) return;
        if (e.optional === true) {
          if (!degraded[caller]) {
            degraded[caller] = true;
            cause[caller] = { kind: "fallback", edge: e.id, cause: at };
          }
        } else if (e.sync === false) {
          if (!degraded[caller]) {
            degraded[caller] = true;
            cause[caller] = { kind: "delayed", edge: e.id, cause: at };
          }
        } else {
          delete degraded[caller];
          failed[caller] = true;
          cause[caller] = { kind: "sync", edge: e.id, cause: at };
          queue.push(caller);
        }
      });
    }

    function evidenceOf(edgeId) {
      var e = edgeId && edgeById[edgeId];
      var ev = e && e.evidence && e.evidence[0];
      return ev ? { file: ev.file, line: ev.line || null } : null;
    }
    /** The links from `id` back to a component that is down. */
    function chain(id) {
      var out = [];
      var seen = {};
      var cur = id;
      while (cur && cause[cur] && !seen[cur]) {
        seen[cur] = true;
        var c = cause[cur];
        if (c.kind === "down") break;
        out.push({
          node: cur,
          kind: c.kind,
          edge: c.edge,
          cause: c.cause,
          evidence: evidenceOf(c.edge),
        });
        cur = c.cause;
      }
      return out;
    }

    var result = { down: down, ignored: ignored, nodes: {}, edges: {}, flows: [], counts: null };
    var counts = { failed: 0, degraded: 0, unaffected: 0 };
    Object.keys(nodes)
      .sort()
      .forEach(function (id) {
        var status = failed[id] ? "failed" : degraded[id] ? "degraded" : "unaffected";
        counts[status]++;
        result.nodes[id] = {
          status: status,
          kind: cause[id] ? cause[id].kind : null,
          chain: chain(id),
        };
      });
    result.counts = counts;
    edgeList.forEach(function (e) {
      if (!failed[e.to]) return;
      result.edges[e.id] =
        e.optional === true ? "fallback" : e.sync === false ? "delayed" : "broken";
    });

    (model.flows || []).forEach(function (flow) {
      var step = 0;
      var out = { id: flow.id, name: flow.name, status: "ok", step: null, node: null };
      (flow.steps || []).forEach(function (s) {
        if (!(s.together === true && s.edge)) step++;
        var touched = [];
        if (s.edge && edgeById[s.edge]) touched = [edgeById[s.edge].from, edgeById[s.edge].to];
        else if (s.event && s.node && nodes[s.node]) touched = [s.node];
        touched.forEach(function (id) {
          if (failed[id] && out.status !== "broken") {
            out.status = "broken";
            out.step = step;
            out.node = id;
          } else if (degraded[id] && out.status === "ok") {
            out.status = "degraded";
            out.step = step;
            out.node = id;
          }
        });
      });
      result.flows.push(out);
    });
    return result;
  }

  root.ArchSim = { simulate: simulate };
})(typeof globalThis !== "undefined" ? globalThis : this);
