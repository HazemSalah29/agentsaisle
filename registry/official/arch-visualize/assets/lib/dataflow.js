// Where does a kind of data (a label such as "pii") travel? Reads the `data` labels on components and the
// `carries` labels on connections, nothing else. Pure.
(function (root) {
  "use strict";

  function has(list, label) {
    return Array.isArray(list) && list.indexOf(label) >= 0;
  }

  /**
   * { label, sources, nodes, edges, unlabelled }.
   *  sources    components that hold the data
   *  edges      connections that carry it (recorded in `carries`)
   *  nodes      the sources plus both ends of every carrying connection and everything reached from them
   *             along carrying connections
   *  unlabelled connections that leave a reached component with no `carries` recorded at all: the model
   *             does not say whether the data goes along them
   */
  function trace(model, label) {
    var nodes = (model.nodes || []).filter(function (n) {
      return n && n.id;
    });
    var known = {};
    nodes.forEach(function (n) {
      known[n.id] = true;
    });
    var edges = (model.edges || []).filter(function (e) {
      return known[e.from] && known[e.to];
    });
    var reached = {};
    var sources = [];
    nodes.forEach(function (n) {
      if (has(n.data, label)) {
        reached[n.id] = true;
        sources.push(n.id);
      }
    });
    var carrying = edges.filter(function (e) {
      return has(e.carries, label);
    });
    carrying.forEach(function (e) {
      reached[e.from] = true;
      reached[e.to] = true;
    });
    var unlabelled = edges.filter(function (e) {
      return reached[e.from] && e.carries === undefined;
    });
    function ids(list) {
      return list
        .map(function (x) {
          return x.id || x;
        })
        .sort();
    }
    return {
      label: label,
      sources: sources.sort(),
      nodes: Object.keys(reached).sort(),
      edges: ids(carrying),
      unlabelled: ids(unlabelled),
    };
  }

  root.ArchData = { trace: trace };
})(typeof globalThis !== "undefined" ? globalThis : this);
