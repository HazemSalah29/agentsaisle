/* global document, window, VP, requestAnimationFrame, location */
// The browser glue of the interactive page: controls, the branch question and the clock. All text that came
// from a project is written with textContent, never as markup. Nothing here touches the network.
(function () {
  var film = JSON.parse(document.getElementById("film").textContent);
  var tl = window.__timelines.main;
  var $ = function (id) {
    return document.getElementById(id);
  };
  var root = $("root");
  var wrap = $("stage");
  var scrub = $("scrub");
  var pp = $("pp");
  var clock = $("clock");
  var audio = $("audio");
  var ask = $("ask");
  var fmt = function (t) {
    var s = Math.floor(t);
    return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
  };
  var total = fmt(film.duration);
  // A scene (or caption) is on screen only between its data-start and data-start + data-duration, as in a render.
  var clips = Array.prototype.map.call(root.querySelectorAll(".clip"), function (el) {
    var start = Number(el.getAttribute("data-start"));
    return { el: el, start: start, end: start + Number(el.getAttribute("data-duration")) };
  });
  var showClips = function (t) {
    clips.forEach(function (c) {
      c.el.style.visibility = t >= c.start && t < c.end ? "visible" : "hidden";
    });
  };
  scrub.max = String(Math.round(film.duration * 1000));

  var syncAudio = function (st) {
    if (!audio) return;
    audio.playbackRate = st.rate;
    if (st.playing) {
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    } else audio.pause();
  };
  var eng = VP.create({
    duration: film.duration,
    branches: film.branches,
    onTime: function (t) {
      // Draw the last frame of the film, not the empty moment after it.
      var shown = Math.min(t, film.duration - 0.001);
      tl.time(shown);
      showClips(shown);
      scrub.value = String(Math.round(t * 1000));
      clock.textContent = fmt(t) + " / " + total;
      if (audio && Math.abs(audio.currentTime - t) > 0.3) audio.currentTime = t;
    },
    onBranch: function (b) {
      ask.hidden = !b;
      $("opts").textContent = "";
      if (!b) return fit();
      $("q").textContent = b.question;
      b.options.forEach(function (o, i) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = o.label;
        btn.addEventListener("click", function () {
          eng.choose(i);
          show();
        });
        $("opts").appendChild(btn);
      });
      $("opts").firstChild.focus();
      show();
      fit();
    },
    onEnd: function () {
      show();
    },
  });
  var show = function () {
    var st = eng.state();
    pp.textContent = st.playing ? "Pause" : st.t >= film.duration ? "Replay" : "Play";
    pp.setAttribute("aria-label", pp.textContent);
    syncAudio(st);
  };
  var fit = function () {
    var vw = $("viewport").clientWidth;
    var vh = Math.max(200, window.innerHeight - $("panel").offsetHeight - 24);
    var sc = Math.min(vw / film.w, vh / film.h);
    root.style.transform = "scale(" + sc + ")";
    wrap.style.width = Math.floor(film.w * sc) + "px";
    wrap.style.height = Math.floor(film.h * sc) + "px";
  };

  pp.addEventListener("click", function () {
    if (eng.state().playing) eng.pause();
    else eng.play();
    show();
  });
  scrub.addEventListener("input", function () {
    eng.seek(Number(scrub.value) / 1000);
    show();
  });
  $("rate").addEventListener("change", function () {
    eng.setRate(Number($("rate").value));
    show();
  });
  document.addEventListener("keydown", function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === "BUTTON" || tag === "SELECT" || tag === "INPUT") return;
    if (e.key === " ") {
      e.preventDefault();
      pp.click();
    } else if (e.key === "ArrowRight") eng.seek(eng.state().t + 5);
    else if (e.key === "ArrowLeft") eng.seek(eng.state().t - 5);
  });
  window.addEventListener("resize", fit);
  // A handle for the page that embeds this one, and for tests: play, pause, seek, choose, state.
  window.__player = eng;

  var last = null;
  var frame = function (now) {
    if (last !== null) eng.tick(Math.min(0.25, (now - last) / 1000));
    last = now;
    requestAnimationFrame(frame);
  };
  var m = /^#t=(\d+(?:\.\d+)?)(&play)?$/.exec(location.hash);
  fit();
  eng.seek(m ? Number(m[1]) : 0);
  if (m && m[2]) eng.play();
  show();
  requestAnimationFrame(frame);
})();
