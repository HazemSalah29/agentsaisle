// Every path from one component to another, following the direction of the connections. Pure.
(function (root) {
  "use strict";

  var BUDGET = 200000; // steps the search may take before it stops and says the list is cut short

  /**
   * Directed simple paths (no component twice) from `from` to `to`, shortest first, ties by connection ids.
   * Returns { paths: [{ nodes, edges, hops, sync, asyncCount }], truncated }.
   * `sync[i]` is true, false or null (unknown) for the i-th connection.
   */
  function findPaths(model, from, to, options) {
    var maxPaths = (options && options.maxPaths) || 50;
    var maxHops = (options && options.maxHops) || 12;
    var out = { paths: [], truncated: false };
    var known = {};
    (model.nodes || []).forEach(function (n) {
      known[n.id] = true;
    });
    if (!known[from] || !known[to] || from === to) return out;
    var next = {};
    (model.edges || [])
      .slice()
      .sort(function (a, b) {
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      })
      .forEach(function (e) {
        if (!known[e.from] || !known[e.to]) return;
        (next[e.from] = next[e.from] || []).push(e);
      });
    var found = [];
    var steps = 0;
    var onPath = {};
    var nodes = [from];
    var edges = [];
    var syncs = [];
    onPath[from] = true;
    function walk(at) {
      if (steps++ > BUDGET) {
        out.truncated = true;
        return;
      }
      if (at === to) {
        found.push({ nodes: nodes.slice(), edges: edges.slice(), sync: syncs.slice() });
        return;
      }
      if (edges.length >= maxHops) return;
      (next[at] || []).forEach(function (e) {
        if (onPath[e.to] || out.truncated) return;
        onPath[e.to] = true;
        nodes.push(e.to);
        edges.push(e.id);
        syncs.push(e.sync === true ? true : e.sync === false ? false : null);
        walk(e.to);
        syncs.pop();
        edges.pop();
        nodes.pop();
        onPath[e.to] = false;
      });
    }
    walk(from);
    found.sort(function (a, b) {
      if (a.edges.length !== b.edges.length) return a.edges.length - b.edges.length;
      var x = a.edges.join(","),
        y = b.edges.join(",");
      return x < y ? -1 : x > y ? 1 : 0;
    });
    if (found.length > maxPaths) out.truncated = true;
    out.paths = found.slice(0, maxPaths).map(function (p) {
      return {
        nodes: p.nodes,
        edges: p.edges,
        hops: p.edges.length,
        sync: p.sync,
        asyncCount: p.sync.filter(function (s) {
          return s === false;
        }).length,
      };
    });
    return out;
  }

  root.ArchPaths = { findPaths: findPaths };
})(typeof globalThis !== "undefined" ? globalThis : this);
