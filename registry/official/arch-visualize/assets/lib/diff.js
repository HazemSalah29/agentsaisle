// What changed between two architecture models? Matches components by id, then by technology and shared
// evidence file (renames), and lists what was added, removed or changed. Reads the two models and nothing
// else. Pure; the same bytes run in the page and in diff.mjs.
(function (root) {
  "use strict";

  var NODE_FIELDS = ["label", "tech", "role", "zone", "replicas", "owner", "ai", "data"];
  var EDGE_FIELDS = [
    "protocol",
    "sync",
    "auth",
    "tls",
    "timeoutMs",
    "retries",
    "optional",
    "carries",
  ];
  var SET_FIELDS = { data: 1, carries: 1 };

  function byId(a, b) {
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }
  function list(x) {
    return Array.isArray(x) ? x : [];
  }
  /** A stable text for a fact so two values can be compared; sets are sorted, objects have sorted keys. */
  function canon(v, asSet) {
    if (v === undefined || v === null) return "";
    if (Array.isArray(v)) {
      var parts = v.map(function (x) {
        return canon(x, false);
      });
      return JSON.stringify(asSet ? parts.sort() : parts);
    }
    if (typeof v === "object") {
      return JSON.stringify(
        Object.keys(v)
          .sort()
          .map(function (k) {
            return [k, canon(v[k], false)];
          }),
      );
    }
    return JSON.stringify(v);
  }
  function plainValue(v, asSet) {
    if (Array.isArray(v) && asSet) return v.slice().sort();
    return v === undefined ? null : v;
  }
  function changes(a, b, fields) {
    var out = [];
    fields.forEach(function (f) {
      var set = !!SET_FIELDS[f];
      if (canon(a[f], set) !== canon(b[f], set))
        out.push({ field: f, before: plainValue(a[f], set), after: plainValue(b[f], set) });
    });
    return out;
  }
  function files(n) {
    var seen = {};
    list(n.evidence).forEach(function (e) {
      if (e && e.file) seen[e.file] = true;
    });
    return Object.keys(seen);
  }
  function shareFile(a, b) {
    var fb = files(b);
    return files(a).some(function (f) {
      return fb.indexOf(f) >= 0;
    });
  }
  function summaryOf(n) {
    return { id: n.id, label: n.label, tech: n.tech, role: n.role };
  }

  /**
   * Pair removed and added components that are the same thing under a new id: same technology and a shared
   * evidence file, and no other candidate on either side. Anything ambiguous stays added and removed.
   */
  function findRenames(removed, added) {
    var pairs = [];
    removed.forEach(function (r) {
      var hits = added.filter(function (a) {
        return a.tech && a.tech === r.tech && shareFile(r, a);
      });
      if (hits.length !== 1) return;
      var back = removed.filter(function (x) {
        return x.tech === r.tech && shareFile(x, hits[0]);
      });
      if (back.length === 1) pairs.push([r, hits[0]]);
    });
    return pairs;
  }

  function diff(base, head) {
    var bn = list(base && base.nodes),
      hn = list(head && head.nodes);
    var be = list(base && base.edges),
      he = list(head && head.edges);
    var baseIds = {},
      headIds = {};
    bn.forEach(function (n) {
      baseIds[n.id] = n;
    });
    hn.forEach(function (n) {
      headIds[n.id] = n;
    });
    var removedNodes = bn.filter(function (n) {
      return !headIds[n.id];
    });
    var addedNodes = hn.filter(function (n) {
      return !baseIds[n.id];
    });
    var pairs = findRenames(removedNodes, addedNodes);
    var rename = {}; // old id -> new id
    var renamedNew = {};
    pairs.forEach(function (p) {
      rename[p[0].id] = p[1].id;
      renamedNew[p[1].id] = p[0].id;
    });

    var nodes = { added: [], removed: [], changed: [], renamed: [] };
    removedNodes.forEach(function (n) {
      if (!rename[n.id]) nodes.removed.push(n);
    });
    addedNodes.forEach(function (n) {
      if (!renamedNew[n.id]) nodes.added.push(n);
    });
    pairs.forEach(function (p) {
      nodes.renamed.push({
        from: p[0].id,
        to: p[1].id,
        label: p[1].label,
        changes: changes(p[0], p[1], NODE_FIELDS),
      });
    });
    hn.forEach(function (n) {
      var old = baseIds[n.id];
      if (!old) return;
      var c = changes(old, n, NODE_FIELDS);
      if (c.length) nodes.changed.push({ id: n.id, label: n.label, changes: c });
    });

    var through = function (id) {
      return rename[id] || id;
    };
    var headEdgeIds = {},
      baseEdgeIds = {};
    he.forEach(function (e) {
      headEdgeIds[e.id] = e;
    });
    be.forEach(function (e) {
      baseEdgeIds[e.id] = e;
    });
    var key = function (e, f) {
      return f(e.from) + ">" + f(e.to) + ">" + (e.protocol || "");
    };
    var same = function (x) {
      return x;
    };
    var headByKey = {};
    he.forEach(function (e) {
      headByKey[key(e, same)] = headByKey[key(e, same)] ? null : e; // null: not unique
    });
    var matchedHead = {};
    var edges = { added: [], removed: [], changed: [] };
    be.forEach(function (old) {
      var now = headEdgeIds[old.id];
      if (!now) {
        var k = key(old, through);
        var cand = headByKey[k];
        if (cand && !baseEdgeIds[cand.id]) now = cand;
      }
      if (!now) {
        edges.removed.push(old);
        return;
      }
      matchedHead[now.id] = true;
      var c = changes(old, now, EDGE_FIELDS);
      if (c.length) edges.changed.push({ id: now.id, from: now.from, to: now.to, changes: c });
    });
    he.forEach(function (e) {
      if (!matchedHead[e.id]) edges.added.push(e);
    });

    var baseRisks = {},
      headRisks = {};
    list(base && base.risks).forEach(function (r) {
      baseRisks[r.id] = r;
    });
    list(head && head.risks).forEach(function (r) {
      headRisks[r.id] = r;
    });
    var risks = {
      added: list(head && head.risks).filter(function (r) {
        return !baseRisks[r.id];
      }),
      removed: list(base && base.risks).filter(function (r) {
        return !headRisks[r.id];
      }),
    };

    nodes.added.sort(byId);
    nodes.removed.sort(byId);
    nodes.changed.sort(byId);
    nodes.renamed.sort(function (a, b) {
      return a.from < b.from ? -1 : a.from > b.from ? 1 : 0;
    });
    edges.added.sort(byId);
    edges.removed.sort(byId);
    edges.changed.sort(byId);
    risks.added.sort(byId);
    risks.removed.sort(byId);

    var counts = {
      nodesAdded: nodes.added.length,
      nodesRemoved: nodes.removed.length,
      nodesChanged: nodes.changed.length,
      nodesRenamed: nodes.renamed.length,
      edgesAdded: edges.added.length,
      edgesRemoved: edges.removed.length,
      edgesChanged: edges.changed.length,
      risksAdded: risks.added.length,
      risksRemoved: risks.removed.length,
    };
    var total = 0;
    Object.keys(counts).forEach(function (k) {
      total += counts[k];
    });
    return {
      kind: "arch-diff",
      version: 1,
      base: { project: base && base.project },
      head: { project: head && head.project },
      nodes: nodes,
      edges: edges,
      risks: risks,
      counts: counts,
      empty: total === 0,
    };
  }

  root.ArchDiff = {
    diff: diff,
    summaryOf: summaryOf,
    NODE_FIELDS: NODE_FIELDS,
    EDGE_FIELDS: EDGE_FIELDS,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
