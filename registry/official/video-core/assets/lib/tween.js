// Our own tween helper for HyperFrames scenes (no GSAP). Plain script: the rendered page and the tests run
// the same bytes. Every animation is a paused Web Animation placed at an absolute time, so a frame depends on
// the clock alone; HyperFrames seeks the page, and the timeline object below does the same on request.
(function (g) {
  var EASE = {
    linear: "linear",
    out: "cubic-bezier(0.16, 1, 0.3, 1)",
    inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
    in: "cubic-bezier(0.7, 0, 0.84, 0)",
  };
  var easing = function (name) {
    return EASE[name] || EASE.out;
  };

  /**
   * plan: [{ id, frames, at, dur, ease }] with at/dur in seconds and frames as Web Animation keyframes.
   * opts: { id, duration, doc, win } - the composition id, its length in seconds, document and window.
   * Returns the timeline object that was registered on win.__timelines[id].
   */
  function run(plan, opts) {
    var doc = opts.doc || g.document;
    var win = opts.win || g;
    var anims = [];
    plan.forEach(function (p) {
      var el = doc.getElementById(p.id);
      if (!el) return;
      var a = el.animate(p.frames, {
        duration: Math.max(1, Math.round(p.dur * 1000)),
        delay: Math.round(p.at * 1000),
        easing: easing(p.ease),
        fill: "both",
      });
      a.pause();
      anims.push(a);
    });
    var tl = {
      _t: 0,
      duration: function () {
        return opts.duration;
      },
      paused: function () {
        return true;
      },
      pause: function () {
        return tl;
      },
      play: function () {
        return tl;
      },
      time: function (t) {
        if (t === undefined) return tl._t;
        tl._t = t;
        anims.forEach(function (a) {
          a.currentTime = t * 1000;
        });
        return tl;
      },
      seek: function (t) {
        return tl.time(t);
      },
      totalTime: function (t) {
        return tl.time(t);
      },
    };
    win.__timelines = win.__timelines || {};
    win.__timelines[opts.id] = tl;
    return tl;
  }

  g.VT = { EASE: EASE, easing: easing, run: run };
})(typeof globalThis !== "undefined" ? globalThis : this);
