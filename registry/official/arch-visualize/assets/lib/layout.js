// Layered layout and orthogonal edge routing. Pure: no DOM, no network, no timers, never changes its
// input, and the same model always gives the same numbers (every tie is broken by id).
//
//   layers   one column per tier, in request order
//   order    barycenter sweeps, keeping the order with the fewest crossings; groups are vertical bands
//   y        nodes stacked inside their band, then pulled towards the middle of their neighbours
//   routes   horizontal runs in the node rows, vertical runs on separate tracks between the columns
//
// Edges that skip a column get a one-lane "dummy" slot in each column they cross, so they can never run
// through a box. Needs ArchGeometry (geometry.js) loaded first.
(function (root) {
  "use strict";
  var G = root.ArchGeometry;

  var TIERS = ["clients", "edge", "frontend", "backend", "async", "data", "external"];
  var DIRECT = "\u0001"; // the pseudo band that holds a group's own nodes
  var SEP = "\u0002";
  var DEFAULTS = {
    nodeW: 190,
    nodeH: 64,
    laneH: 12, // height of the slot a long edge takes in a column it passes through
    gapY: 28, // between two nodes
    gapLane: 8, // between a lane and its neighbour
    gapBand: 20, // between bands
    channelMin: 72, // narrowest gap between two columns
    track: 10, // spacing of the vertical runs
    pad: 28,
    head: 44, // room for the tier labels
    groupPad: 14,
    groupHead: 24, // room for the group label
    portMargin: 10,
    radius: 8,
    sweeps: 8,
    labels: true,
  };

  function opt(o) {
    var out = {};
    for (var k in DEFAULTS) out[k] = o && o[k] !== undefined ? o[k] : DEFAULTS[k];
    return out;
  }
  function byId(a, b) {
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }
  function cmpArr(a, b) {
    for (var i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
  }
  function median(list) {
    var s = list.slice().sort(function (a, b) {
      return a - b;
    });
    var n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }

  /** Lay out `model` ({ nodes, edges, groups? }). See the header for the shape of the result. */
  function layout(model, options) {
    var o = opt(options);
    var tierList = (options && options.tiers) || TIERS;

    // ---- normalise: sorted copies, unknown ends dropped
    var nodes = (model.nodes || []).slice().sort(byId);
    var byNode = {};
    nodes.forEach(function (n) {
      byNode[n.id] = n;
    });
    var edges = (model.edges || [])
      .filter(function (e) {
        return byNode[e.from] && byNode[e.to];
      })
      .slice()
      .sort(byId);
    var groupById = {};
    (model.groups || []).forEach(function (g) {
      groupById[g.id] = g;
    });
    function groupPath(gid) {
      var path = [];
      var seen = {};
      while (gid && groupById[gid] && !seen[gid]) {
        seen[gid] = true;
        path.unshift(gid);
        gid = groupById[gid].parent;
      }
      return path;
    }

    var present = tierList.filter(function (t) {
      return nodes.some(function (n) {
        return n.tier === t;
      });
    });
    var other = nodes.filter(function (n) {
      return tierList.indexOf(n.tier) < 0;
    });
    if (other.length) present = present.concat(["other"]);
    var layerOf = {};
    nodes.forEach(function (n) {
      var i = present.indexOf(n.tier);
      layerOf[n.id] = i < 0 ? present.length - 1 : i;
    });
    var nLayers = present.length;

    // ---- vertices: the nodes plus one lane slot per column a long edge crosses
    var V = {}; // id -> { id, layer, dummy, h, path, up: [], down: [] }
    nodes.forEach(function (n) {
      var path = groupPath(n.group);
      V[n.id] = {
        id: n.id,
        layer: layerOf[n.id],
        dummy: false,
        h: o.nodeH,
        path: path.concat([DIRECT]),
        up: [],
        down: [],
      };
    });
    var info = []; // per edge: { e, chain, rev, same }
    edges.forEach(function (e) {
      var la = layerOf[e.from],
        lb = layerOf[e.to];
      if (la === lb) {
        info.push({ e: e, same: true, chain: [e.from], rev: false });
        return;
      }
      var lo = Math.min(la, lb),
        hi = Math.max(la, lb);
      var lowEnd = la < lb ? e.from : e.to,
        highEnd = la < lb ? e.to : e.from;
      var chain = [lowEnd];
      for (var k = lo + 1; k < hi; k++) {
        var id = "~" + e.id + "@" + k;
        V[id] = {
          id: id,
          layer: k,
          dummy: true,
          h: o.laneH,
          path: V[e.from].path,
          up: [],
          down: [],
        };
        chain.push(id);
      }
      chain.push(highEnd);
      for (var c = 0; c + 1 < chain.length; c++) {
        V[chain[c]].down.push(chain[c + 1]);
        V[chain[c + 1]].up.push(chain[c]);
      }
      info.push({ e: e, same: false, chain: chain, rev: la > lb });
    });
    var layers = [];
    for (var li = 0; li < nLayers; li++) layers.push([]);
    Object.keys(V)
      .sort()
      .forEach(function (id) {
        layers[V[id].layer].push(V[id]);
      });

    // ---- bands: every prefix of a path is a band; siblings are ranked, vertices compare by rank
    var bandMembers = {}; // band key -> vertices below it
    function prefixes(path) {
      var out = [];
      for (var i = 1; i <= path.length; i++) out.push(path.slice(0, i).join(SEP));
      return out;
    }
    Object.keys(V).forEach(function (id) {
      prefixes(V[id].path).forEach(function (key) {
        (bandMembers[key] = bandMembers[key] || []).push(V[id]);
      });
    });
    var bandKeys = Object.keys(bandMembers).sort();
    function parentKey(key) {
      var i = key.lastIndexOf(SEP);
      return i < 0 ? "" : key.slice(0, i);
    }
    function rankBands(posOf) {
      var rank = {};
      var kids = { "": [] };
      bandKeys.forEach(function (k) {
        (kids[parentKey(k)] = kids[parentKey(k)] || []).push(k);
      });
      Object.keys(kids).forEach(function (pk) {
        var mean = {};
        kids[pk].forEach(function (k) {
          var sum = 0;
          bandMembers[k].forEach(function (v) {
            sum += posOf(v);
          });
          mean[k] = sum / bandMembers[k].length;
        });
        kids[pk]
          .slice()
          .sort(function (a, b) {
            return mean[a] - mean[b] || (a < b ? -1 : 1);
          })
          .forEach(function (k, i) {
            rank[k] = i;
          });
      });
      return rank;
    }
    function keyOf(v, rank) {
      return prefixes(v.path).map(function (k) {
        return rank[k];
      });
    }

    // ---- ordering
    var idx = {}; // vertex id -> index in its layer
    function reindex(ord) {
      ord.forEach(function (list) {
        list.forEach(function (v, i) {
          idx[v.id] = i;
        });
      });
    }
    function normPos(v) {
      return (idx[v.id] + 0.5) / layers[v.layer].length;
    }
    function countCrossings(ord) {
      var total = 0;
      for (var k = 0; k + 1 < ord.length; k++) {
        var links = [];
        ord[k].forEach(function (v) {
          v.down.forEach(function (d) {
            links.push([idx[v.id], idx[d]]);
          });
        });
        for (var a = 0; a < links.length; a++)
          for (var b = a + 1; b < links.length; b++)
            if (
              (links[a][0] < links[b][0] && links[a][1] > links[b][1]) ||
              (links[a][0] > links[b][0] && links[a][1] < links[b][1])
            )
              total++;
      }
      return total;
    }
    var order = layers.map(function (l) {
      return l.slice();
    });
    var rank = rankBands(function () {
      return 0;
    });
    order.forEach(function (list) {
      list.sort(function (a, b) {
        return cmpArr(keyOf(a, rank), keyOf(b, rank)) || byId(a, b);
      });
    });
    reindex(order);
    var best = {
      cross: countCrossings(order),
      order: order.map(function (l) {
        return l.slice();
      }),
      rank: rank,
    };
    for (var sweep = 0; sweep < o.sweeps && nLayers > 1; sweep++) {
      var down = sweep % 2 === 0;
      rank = rankBands(normPos);
      order.forEach(function (list) {
        list.sort(function (a, b) {
          return cmpArr(keyOf(a, rank), keyOf(b, rank)) || idx[a.id] - idx[b.id];
        });
      });
      reindex(order);
      var ks = [];
      for (var q = 0; q < nLayers; q++) ks.push(q);
      if (!down) ks.reverse();
      for (var qi = 0; qi < ks.length; qi++) {
        var k2 = ks[qi];
        var bary = {};
        order[k2].forEach(function (v) {
          var nb = down ? v.up : v.down;
          if (!nb.length) {
            bary[v.id] = idx[v.id];
            return;
          }
          var sum = 0;
          nb.forEach(function (x) {
            sum += idx[x];
          });
          bary[v.id] = sum / nb.length;
        });
        order[k2].sort(function (a, b) {
          return cmpArr(keyOf(a, rank), keyOf(b, rank)) || bary[a.id] - bary[b.id] || byId(a, b);
        });
        order[k2].forEach(function (v, i) {
          idx[v.id] = i;
        });
      }
      var c = countCrossings(order);
      if (c < best.cross)
        best = {
          cross: c,
          order: order.map(function (l) {
            return l.slice();
          }),
          rank: rank,
        };
    }
    order = best.order;
    rank = best.rank;
    reindex(order);

    // ---- y: stack inside bands, then pull towards the neighbours
    var gapBetween = function (a, b) {
      return a.dummy || b.dummy ? o.gapLane : o.gapY;
    };
    function stackHeight(list) {
      var h = 0;
      list.forEach(function (v, i) {
        h += v.h + (i ? gapBetween(list[i - 1], v) : 0);
      });
      return h;
    }
    var kidsOf = { "": [] };
    bandKeys.forEach(function (k) {
      (kidsOf[parentKey(k)] = kidsOf[parentKey(k)] || []).push(k);
    });
    Object.keys(kidsOf).forEach(function (k) {
      kidsOf[k].sort(function (a, b) {
        return rank[a] - rank[b];
      });
    });
    var band = {}; // key -> { y, h, leaf }
    function isLeaf(key) {
      return key.slice(-1) === DIRECT;
    }
    function measure(key) {
      if (isLeaf(key)) {
        var h = 0;
        order.forEach(function (list) {
          h = Math.max(
            h,
            stackHeight(
              list.filter(function (v) {
                return v.path.join(SEP) === key;
              }),
            ),
          );
        });
        band[key] = { h: h, leaf: true };
        return h;
      }
      var kids = kidsOf[key] || [];
      var total = key === "" ? 0 : o.groupHead + o.groupPad;
      kids.forEach(function (kid, i) {
        total += measure(kid) + (i ? o.gapBand : 0);
      });
      band[key] = { h: total, leaf: false };
      return total;
    }
    measure("");
    var top0 = o.pad + o.head;
    function place(key, y) {
      band[key].y = y;
      if (band[key].leaf) return;
      var cur = y + (key === "" ? 0 : o.groupHead);
      (kidsOf[key] || []).forEach(function (kid) {
        place(kid, cur);
        cur += band[kid].h + o.gapBand;
      });
    }
    place("", top0);
    var cy = {}; // vertex id -> top y
    var cells = []; // { list, top, bottom } per leaf band and layer
    order.forEach(function (list) {
      var byBand = {};
      list.forEach(function (v) {
        var key = v.path.join(SEP);
        (byBand[key] = byBand[key] || []).push(v);
      });
      Object.keys(byBand)
        .sort()
        .forEach(function (key) {
          var y = band[key].y;
          byBand[key].forEach(function (v, i) {
            if (i) y += gapBetween(byBand[key][i - 1], v);
            cy[v.id] = y;
            y += v.h;
          });
          cells.push({ list: byBand[key], top: band[key].y, bottom: band[key].y + band[key].h });
        });
    });
    var centre = function (v) {
      return cy[v.id] + v.h / 2;
    };
    for (var pass = 0; pass < 6; pass++) {
      var seq = pass % 2 ? cells.slice().reverse() : cells;
      seq.forEach(function (cell) {
        var list = cell.list;
        var want = list.map(function (v) {
          var nb = v.up.concat(v.down).map(function (id) {
            return centre(V[id]);
          });
          return nb.length ? median(nb) - v.h / 2 : cy[v.id];
        });
        var y = [];
        list.forEach(function (v, i) {
          y[i] = Math.max(
            want[i],
            i ? y[i - 1] + list[i - 1].h + gapBetween(list[i - 1], v) : cell.top,
          );
        });
        for (var i2 = list.length - 1; i2 >= 0; i2--) {
          var limit =
            i2 === list.length - 1
              ? cell.bottom - list[i2].h
              : y[i2 + 1] - list[i2].h - gapBetween(list[i2], list[i2 + 1]);
          y[i2] = Math.min(y[i2], limit);
        }
        list.forEach(function (v, i) {
          cy[v.id] = y[i];
        });
      });
    }

    // ---- ports: spread the ends along the right (leaving) and left (arriving) side of each node
    var ports = {}; // "<node>|r" or "|l" -> [{ key, other }]
    function addPort(node, side, key, otherY) {
      (ports[node + "|" + side] = ports[node + "|" + side] || []).push({ key: key, other: otherY });
    }
    var hops = []; // { edge, from, to, ch (channel index) }
    info.forEach(function (it) {
      var id = it.e.id;
      if (it.same) {
        var a = V[it.e.from],
          b = V[it.e.to];
        if (a === b) {
          addPort(a.id, "r", id + "#a", centre(a) - 10);
          addPort(a.id, "r", id + "#b", centre(a) + 10);
        } else {
          addPort(a.id, "r", id + "#a", centre(b));
          addPort(b.id, "r", id + "#b", centre(a));
        }
        return;
      }
      for (var c = 0; c + 1 < it.chain.length; c++) {
        var lo = V[it.chain[c]],
          hi = V[it.chain[c + 1]];
        if (!lo.dummy) addPort(lo.id, "r", id + "#" + c + "o", centre(hi));
        if (!hi.dummy) addPort(hi.id, "l", id + "#" + c + "i", centre(lo));
        hops.push({ key: id + "#" + c, edge: id, lo: lo, hi: hi, ch: lo.layer });
      }
    });
    var portY = {}; // port key -> y
    Object.keys(ports)
      .sort()
      .forEach(function (k) {
        var list = ports[k].slice().sort(function (p, q) {
          return p.other - q.other || (p.key < q.key ? -1 : 1);
        });
        var v = V[k.split("|")[0]];
        var m = o.portMargin;
        list.forEach(function (p, i) {
          portY[p.key] = cy[v.id] + m + ((i + 0.5) * (v.h - 2 * m)) / list.length;
        });
      });
    var py = function (v, key) {
      return v.dummy ? centre(v) : portY[key];
    };

    // ---- tracks: vertical runs between two columns get their own x
    var runs = []; // { id, ch, lo, hi, left: [y], right: [y] }
    var hopY = {};
    hops.forEach(function (h) {
      var n = h.key.split("#")[1];
      var a = py(h.lo, h.edge + "#" + n + "o"),
        b = py(h.hi, h.edge + "#" + n + "i");
      hopY[h.key] = [a, b];
      if (Math.abs(a - b) > 0.5)
        runs.push({
          id: h.key,
          ch: h.ch,
          lo: Math.min(a, b),
          hi: Math.max(a, b),
          left: [a],
          right: [b],
        });
    });
    var loops = {}; // same-column edges: edge id -> [ya, yb]
    info.forEach(function (it) {
      if (!it.same) return;
      var a = portY[it.e.id + "#a"],
        b = portY[it.e.id + "#b"];
      loops[it.e.id] = [a, b];
      runs.push({
        id: it.e.id,
        ch: layerOf[it.e.from],
        lo: Math.min(a, b),
        hi: Math.max(a, b),
        left: [a, b],
        right: [],
      });
    });
    // Each vertical run gets its own track. With run i left of run j, j's left-hand horizontals cross i's
    // vertical and i's right-hand horizontals cross j's vertical; order the runs to cross least.
    var inSpan = function (y, r) {
      return y > r.lo + 0.5 && y < r.hi - 0.5 ? 1 : 0;
    };
    var cost = function (i, j) {
      var c = 0;
      j.left.forEach(function (y) {
        c += inSpan(y, i);
      });
      i.right.forEach(function (y) {
        c += inSpan(y, j);
      });
      return c;
    };
    var trackOf = {};
    var tracksIn = [];
    for (var ch = 0; ch < nLayers; ch++) {
      var rs = runs
        .filter(function (r) {
          return r.ch === ch;
        })
        .sort(function (p, q) {
          return p.lo - q.lo || p.hi - q.hi || (p.id < q.id ? -1 : 1);
        });
      for (var sw = 0, moved = true; moved && sw < 30; sw++) {
        moved = false;
        for (var m = 0; m + 1 < rs.length; m++)
          if (cost(rs[m + 1], rs[m]) < cost(rs[m], rs[m + 1])) {
            var tmp = rs[m];
            rs[m] = rs[m + 1];
            rs[m + 1] = tmp;
            moved = true;
          }
      }
      rs.forEach(function (r, t) {
        trackOf[r.id] = t;
      });
      tracksIn[ch] = rs.length;
    }

    // ---- x
    var xs = [];
    var widthOf = [];
    var x = o.pad;
    for (var lx = 0; lx < nLayers; lx++) {
      xs[lx] = x;
      var need = 2 * 14 + Math.max(0, tracksIn[lx] - 1) * o.track;
      widthOf[lx] = lx === nLayers - 1 ? Math.max(need, 40) : Math.max(o.channelMin, need);
      x += o.nodeW + widthOf[lx];
    }
    var trackX = function (ch, t) {
      return xs[ch] + o.nodeW + 14 + t * o.track;
    };
    var pos = {};
    nodes.forEach(function (n) {
      var v = V[n.id];
      pos[n.id] = { x: xs[v.layer], y: cy[v.id], w: o.nodeW, h: o.nodeH, layer: v.layer };
    });

    // ---- routes
    var routes = {};
    info.forEach(function (it) {
      var id = it.e.id;
      var pts = [];
      if (it.same) {
        var v = V[it.e.from],
          w = V[it.e.to];
        var tx = trackX(v.layer, trackOf[id]);
        var rx = xs[v.layer] + o.nodeW;
        pts = [
          [rx, loops[id][0]],
          [tx, loops[id][0]],
          [tx, loops[id][1]],
          [rx, loops[id][1]],
        ];
        if (w !== v) pts[3] = [xs[w.layer] + o.nodeW, loops[id][1]];
      } else {
        for (var c = 0; c + 1 < it.chain.length; c++) {
          var lo = V[it.chain[c]],
            hi = V[it.chain[c + 1]];
          var ys = hopY[id + "#" + c];
          pts.push([xs[lo.layer] + (lo.dummy ? 0 : o.nodeW), ys[0]]);
          if (lo.dummy) pts.push([xs[lo.layer] + o.nodeW, ys[0]]);
          if (Math.abs(ys[0] - ys[1]) > 0.5) {
            var t2 = trackX(lo.layer, trackOf[id + "#" + c]);
            pts.push([t2, ys[0]], [t2, ys[1]]);
          }
          pts.push([xs[hi.layer], ys[1]]);
          if (hi.dummy) pts.push([xs[hi.layer] + o.nodeW, ys[1]]);
        }
        // the first point of a chain that starts at a dummy never happens; the chain starts at a node
      }
      pts = G.simplify(pts);
      if (it.rev) pts.reverse();
      routes[id] = { points: pts, d: G.roundedPath(pts, o.radius), from: it.e.from, to: it.e.to };
    });

    // ---- group boxes
    var groups = [];
    bandKeys.forEach(function (key) {
      if (isLeaf(key)) return;
      var gid = key.split(SEP).pop();
      var real = bandMembers[key].filter(function (v) {
        return !v.dummy;
      });
      if (!real.length) return;
      var x0 = Infinity,
        x1 = -Infinity;
      real.forEach(function (v) {
        x0 = Math.min(x0, xs[v.layer]);
        x1 = Math.max(x1, xs[v.layer] + o.nodeW);
      });
      var g = groupById[gid] || {};
      groups.push({
        id: gid,
        label: g.label || gid,
        parent: g.parent && groupById[g.parent] ? g.parent : null,
        depth: key.split(SEP).length,
        x: x0 - o.groupPad,
        y: band[key].y,
        w: x1 - x0 + 2 * o.groupPad,
        h: band[key].h,
      });
    });
    groups.sort(function (a, b) {
      return a.depth - b.depth || byId(a, b);
    });

    // ---- labels: the first spot beside a line where the text collides with nothing
    var labels = {};
    var labelStats = { placed: 0, omitted: 0 };
    if (o.labels) {
      var rects = nodes.map(function (n) {
        return pos[n.id];
      });
      var segs = [];
      Object.keys(routes).forEach(function (id) {
        var p = routes[id].points;
        for (var s = 0; s + 1 < p.length; s++) segs.push({ id: id, a: p[s], b: p[s + 1] });
      });
      var placed = [];
      edges.forEach(function (e) {
        if (!e.protocol) return;
        var text = String(e.protocol);
        var w = Math.min(text.length, 18) * 6.4 + 10,
          h = 16;
        var p = routes[e.id].points;
        var cands = [];
        for (var s = 0; s + 1 < p.length; s++) {
          var horiz = p[s][1] === p[s + 1][1];
          var len = Math.abs(p[s + 1][0] - p[s][0]) + Math.abs(p[s + 1][1] - p[s][1]);
          cands.push({ s: s, horiz: horiz, len: len });
        }
        cands.sort(function (a, b) {
          return (b.horiz ? 1 : 0) - (a.horiz ? 1 : 0) || b.len - a.len || a.s - b.s;
        });
        var spot = null;
        cands.slice(0, 3).forEach(function (cd) {
          if (spot) return;
          var a = p[cd.s],
            b = p[cd.s + 1];
          [0.5, 0.3, 0.7].forEach(function (f) {
            [-1, 1].forEach(function (side) {
              if (spot) return;
              var mx = a[0] + (b[0] - a[0]) * f,
                my = a[1] + (b[1] - a[1]) * f;
              var r = cd.horiz
                ? { x: mx - w / 2, y: side < 0 ? my - h - 2 : my + 2, w: w, h: h }
                : { x: side < 0 ? mx - w - 4 : mx + 4, y: my - h / 2, w: w, h: h };
              var clash =
                rects.some(function (n) {
                  return G.rectsOverlap(r, n, 0);
                }) ||
                placed.some(function (q) {
                  return G.rectsOverlap(r, q, 0);
                }) ||
                segs.some(function (sg) {
                  return G.segmentHitsRect(sg.a, sg.b, r, -1);
                });
              if (!clash) spot = r;
            });
          });
        });
        if (spot) {
          labels[e.id] = { x: spot.x, y: spot.y, w: spot.w, h: spot.h };
          placed.push(spot);
          labelStats.placed++;
        } else labelStats.omitted++;
      });
    }

    var maxY = 0;
    Object.keys(band).forEach(function (k) {
      if (k === "") maxY = band[k].y + band[k].h;
    });
    var size = { w: x + o.pad, h: maxY + o.pad };
    if (!nLayers) size = { w: o.pad * 2, h: o.pad * 2 + o.head };

    var lines = Object.keys(routes)
      .sort()
      .map(function (id) {
        return routes[id].points;
      });
    var out = {
      pos: pos,
      layers: present.map(function (t, i) {
        return {
          tier: t,
          index: i,
          x: xs[i],
          w: o.nodeW,
          nodes: order[i]
            .filter(function (v) {
              return !v.dummy;
            })
            .map(function (v) {
              return v.id;
            }),
        };
      }),
      routes: routes,
      groups: groups,
      labels: labels,
      size: size,
      stats: {
        layers: nLayers,
        dummies: Object.keys(V).length - nodes.length,
        crossings: G.polylineCrossings(lines),
        labelsPlaced: labelStats.placed,
        labelsOmitted: labelStats.omitted,
      },
    };
    return out;
  }

  /** A short fingerprint of a layout (positions, routes, groups, labels), to compare two runs. */
  function layoutHash(result) {
    var r = G.round;
    var parts = [];
    Object.keys(result.pos)
      .sort()
      .forEach(function (id) {
        var p = result.pos[id];
        parts.push(id + ":" + r(p.x) + "," + r(p.y));
      });
    Object.keys(result.routes)
      .sort()
      .forEach(function (id) {
        parts.push(id + ":" + result.routes[id].d);
      });
    result.groups.forEach(function (g) {
      parts.push("g" + g.id + ":" + r(g.x) + "," + r(g.y) + "," + r(g.w) + "," + r(g.h));
    });
    Object.keys(result.labels)
      .sort()
      .forEach(function (id) {
        var l = result.labels[id];
        parts.push("l" + id + ":" + r(l.x) + "," + r(l.y));
      });
    return G.hash(parts.join("|"));
  }

  root.ArchLayout = { layout: layout, layoutHash: layoutHash, TIERS: TIERS, DEFAULTS: DEFAULTS };
})(typeof globalThis !== "undefined" ? globalThis : this);
