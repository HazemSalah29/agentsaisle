// Search over a model: labels, ids, technology, file paths, connection protocols and risk ids. Pure.
// Every word of the query must match somewhere; results are ranked, with ties broken by kind and id.
(function (root) {
  "use strict";

  var KIND_ORDER = { node: 0, edge: 1, risk: 2 };

  function lower(v) {
    return String(v === undefined || v === null ? "" : v).toLowerCase();
  }
  function score(fieldText, word, weight) {
    var at = fieldText.indexOf(word);
    if (at < 0) return 0;
    return weight + (at === 0 ? weight / 2 : 0);
  }

  /** The fields of one item as [name, text, weight]. */
  function fieldsOf(kind, item) {
    var out = [];
    var files = (item.evidence || []).map(function (e) {
      return e.file;
    });
    if (kind === "node") {
      out.push(["label", item.label, 10], ["id", item.id, 8], ["tech", item.tech, 6]);
      out.push(["role", item.role, 4]);
    } else if (kind === "edge") {
      out.push(["protocol", item.protocol, 6], ["id", item.id, 6]);
    } else {
      out.push(["id", item.id, 8], ["title", item.title, 5]);
    }
    files.forEach(function (f) {
      out.push(["file", f, 5]);
    });
    return out;
  }

  /**
   * Search `model`. Returns [{ kind: "node" | "edge" | "risk", id, field, score, nodes }] best first,
   * at most `limit` (default 20). `nodes` lists the nodes to highlight for that result.
   */
  function search(model, query, limit) {
    var words = lower(query)
      .split(/\s+/)
      .filter(function (w) {
        return w;
      });
    if (!words.length) return [];
    var results = [];
    function consider(kind, item, nodes) {
      var fields = fieldsOf(kind, item);
      var total = 0;
      var field = "";
      var bestForField = 0;
      for (var w = 0; w < words.length; w++) {
        var best = 0;
        var bestName = "";
        for (var f = 0; f < fields.length; f++) {
          var sc = score(lower(fields[f][1]), words[w], fields[f][2]);
          if (sc > best) {
            best = sc;
            bestName = fields[f][0];
          }
        }
        if (!best) return;
        total += best;
        if (best > bestForField) {
          bestForField = best;
          field = bestName;
        }
      }
      results.push({ kind: kind, id: item.id, field: field, score: total, nodes: nodes });
    }
    (model.nodes || []).forEach(function (n) {
      consider("node", n, [n.id]);
    });
    (model.edges || []).forEach(function (e) {
      consider("edge", e, [e.from, e.to]);
    });
    (model.risks || []).forEach(function (r) {
      consider("risk", r, (r.nodes || []).slice());
    });
    results.sort(function (a, b) {
      return (
        b.score - a.score ||
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      );
    });
    return results.slice(0, limit || 20);
  }

  root.ArchSearch = { search: search };
})(typeof globalThis !== "undefined" ? globalThis : this);
