// The play engine of the interactive page: a small state machine with no DOM, so the page and the tests run
// the same bytes. It owns the film clock (play, pause, seek, speed) and the branch points. The page feeds it
// elapsed seconds with tick(dt) and draws whatever it reports.
(function (g) {
  var EPS = 1e-6;
  // A question holds the clock a hair before its gate, so the last frame of the scene stays on screen.
  var HOLD = 0.001;

  /**
   * opts: { duration, branches: [{ id, question, gate, options: [{ label, start, end }], then }], onTime, onBranch, onEnd }
   * `gate` is the time a question appears; `then` is the time every path continues at (null = the film ends).
   */
  function create(opts) {
    var duration = opts.duration;
    var branches = opts.branches || [];
    var s = { t: 0, playing: false, rate: 1, open: null, run: null };
    var emit = function () {
      if (opts.onTime) opts.onTime(s.t);
    };
    var clamp = function (t) {
      return Math.max(0, Math.min(duration, t));
    };
    // The run an option plays: from its start to its end, then on to `then`.
    var runOf = function (b, o) {
      return { end: o.end, then: b.then };
    };
    var finish = function () {
      s.t = duration;
      s.playing = false;
      s.run = null;
      emit();
      if (opts.onEnd) opts.onEnd();
    };
    var api = {
      state: function () {
        return { t: s.t, playing: s.playing, rate: s.rate, branch: s.open };
      },
      play: function () {
        if (s.open) return;
        if (s.t >= duration - EPS) api.seek(0);
        s.playing = true;
      },
      pause: function () {
        s.playing = false;
      },
      setRate: function (r) {
        s.rate = Math.max(0.25, Math.min(2, r));
      },
      // Free scrubbing. Landing inside an option plays that option, then continues like a chosen answer.
      seek: function (t) {
        s.t = clamp(t);
        s.run = null;
        if (s.open) {
          s.open = null;
          if (opts.onBranch) opts.onBranch(null);
        }
        branches.forEach(function (b) {
          b.options.forEach(function (o) {
            if (s.t >= o.start - EPS && s.t < o.end - EPS) s.run = runOf(b, o);
          });
        });
        emit();
      },
      choose: function (i) {
        var b = s.open;
        if (!b || !b.options[i]) return;
        s.open = null;
        s.t = b.options[i].start;
        s.run = runOf(b, b.options[i]);
        s.playing = true;
        if (opts.onBranch) opts.onBranch(null);
        emit();
      },
      // Advance by `dt` real seconds (the film moves dt * rate). Stops at the first thing that interrupts it.
      tick: function (dt) {
        if (!s.playing || s.open) return;
        var from = s.t;
        var to = from + dt * s.rate;
        if (s.run && to >= s.run.end - EPS) {
          var then = s.run.then;
          s.run = null;
          if (then === null) return finish();
          s.t = then;
          return emit();
        }
        var gate = null;
        branches.forEach(function (b) {
          if (b.gate > from + EPS && b.gate <= to + EPS && (!gate || b.gate < gate.gate)) gate = b;
        });
        if (gate && !s.run) {
          s.t = gate.gate - HOLD;
          s.playing = false;
          s.open = gate;
          emit();
          if (opts.onBranch) opts.onBranch(gate);
          return;
        }
        if (to >= duration - EPS) return finish();
        s.t = to;
        emit();
      },
    };
    return api;
  }

  g.VP = { create: create };
})(typeof globalThis !== "undefined" ? globalThis : this);
