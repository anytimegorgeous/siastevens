/* Help for older iPads (iOS 12 and similar). Every fix below checks first whether the browser
   already does the job itself; on any newer device this file does nothing at all. */
(function(){
  "use strict";
  var page = location.pathname;
  /* ?oldsafari=1 makes a new browser behave like an old one, for testing */
  var TEST = /[?&]oldsafari=1/.test(location.search);
  if (TEST) Element.prototype.animate = null;

  /* 1. Element.animate (used to move the hero and the arrows). Older Safari doesn't have it. */
  if (!Element.prototype.animate){
    var NUM = /-?\d*\.?\d+(?:e-?\d+)?/g;
    var EASE = {
      "linear": function(t){ return t; },
      "ease": function(t){ return bez(.25,.1,.25,1,t); },
      "ease-in": function(t){ return bez(.42,0,1,1,t); },
      "ease-out": function(t){ return bez(0,0,.58,1,t); },
      "ease-in-out": function(t){ return bez(.42,0,.58,1,t); }
    };
    function bez(x1,y1,x2,y2,x){
      var t = x, i;
      for (i = 0; i < 8; i++){
        var cx = 3*(1-t)*(1-t)*t*x1 + 3*(1-t)*t*t*x2 + t*t*t - x;
        var dx = 3*(1-t)*(1-t)*x1 + 6*(1-t)*t*(x2-x1) + 3*t*t*(1-x2);
        if (Math.abs(cx) < 1e-4 || !dx) break;
        t -= cx / dx; t = Math.max(0, Math.min(1, t));
      }
      return 3*(1-t)*(1-t)*t*y1 + 3*(1-t)*t*t*y2 + t*t*t;
    }
    function easing(e){
      if (!e) return EASE.linear;
      if (EASE[e]) return EASE[e];
      var m = /cubic-bezier\(([^)]+)\)/.exec(e);
      if (m){ var p = m[1].split(",").map(parseFloat); return function(t){ return bez(p[0],p[1],p[2],p[3],t); }; }
      return EASE.linear;
    }
    function mix(a, b, t){
      a = String(a); b = String(b);
      var na = a.match(NUM) || [], nb = b.match(NUM) || [];
      if (na.length !== nb.length) return t < 1 ? a : b;
      var i = 0;
      return b.replace(NUM, function(){ var x = parseFloat(na[i]), y = parseFloat(nb[i]); i++; return String(x + (y - x) * t); });
    }
    Element.prototype.animate = function(frames, opt){
      var el = this;
      opt = typeof opt === "number" ? {duration: opt} : (opt || {});
      var dur = opt.duration || 0, ease = easing(opt.easing), n = frames.length;
      var offs = frames.map(function(f, i){ return f.offset != null ? f.offset : (n === 1 ? 1 : i / (n - 1)); });
      var props = {};
      frames.forEach(function(f){ for (var k in f) if (k !== "offset" && k !== "easing" && k !== "composite") props[k] = 1; });
      var start = null, done = false, raf = 0;
      var anim = {onfinish: null, playState: "running",
        cancel: function(){ done = true; cancelAnimationFrame(raf); anim.playState = "idle"; },
        finish: function(){ step(1e12); }};
      function at(p){
        Object.keys(props).forEach(function(k){
          var i = 0;
          while (i < n - 2 && p > offs[i + 1]) i++;
          var a = frames[i], b = frames[Math.min(i + 1, n - 1)];
          var span = offs[Math.min(i + 1, n - 1)] - offs[i];
          var local = span > 0 ? Math.max(0, Math.min(1, (p - offs[i]) / span)) : 1;
          var va = a[k] != null ? a[k] : b[k], vb = b[k] != null ? b[k] : va;
          el.style[k] = mix(va, vb, local);
        });
      }
      function step(now){
        if (done) return;
        if (start == null) start = now;
        var t = dur ? Math.min(1, (now - start) / dur) : 1;
        at(ease(t));
        if (t < 1){ raf = requestAnimationFrame(step); return; }
        done = true; anim.playState = "finished";
        if (opt.fill !== "forwards" && opt.fill !== "both") Object.keys(props).forEach(function(k){ el.style[k] = ""; });
        if (typeof anim.onfinish === "function") anim.onfinish({});
      }
      at(0);
      raf = requestAnimationFrame(step);
      return anim;
    };
  }

  /* 2. Spacing between items in a row or column ("gap" in flexbox). Older Safari ignores it,
        so here the same space is added as a margin instead. */
  var flexGap = (function(){
    var d = document.createElement("div");
    d.style.cssText = "display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden";
    d.appendChild(document.createElement("div")); d.appendChild(document.createElement("div"));
    (document.body || document.documentElement).appendChild(d);
    var ok = d.scrollHeight === 1; d.parentNode.removeChild(d);
    return ok && !TEST;
  })();

  /* 3. Shapes that keep their proportions ("aspect-ratio"). Older Safari ignores it, so the height
        is set from the width. [what, width ÷ height, page it belongs to] */
  var hasAR = !TEST && window.CSS && CSS.supports && CSS.supports("aspect-ratio", "1 / 1");
  var SHAPES = [
    [".fl", 1, "/arcade"],
    [".buzz i", 1, "myth-or-fact"],
    [".field", 760 / 250, "consume-or-create"],
    [".harbor", 620 / 300, "sail-or-anchor"],
    [".harbor .sun", 1, "sail-or-anchor"],
    [".range", 700 / 220, "promise-or-proof"],
    [".range .target", 1, "promise-or-proof"],
    [".scene", 16 / 9, "skip-the-shortcut"],
    [".hero-hot", 1916 / 821, ""]
  ];

  if (flexGap && hasAR) return;

  function px(v){ v = parseFloat(v); return isNaN(v) ? 0 : v; }
  function shown(c){ var s = getComputedStyle(c); return s.display !== "none" && s.position !== "absolute" && s.position !== "fixed"; }
  function base(c){
    if (!c._og){ var s = getComputedStyle(c); c._og = {l: s.marginLeft, t: s.marginTop, r: s.marginRight, b: s.marginBottom}; }
    return c._og;
  }
  function gaps(){
    var all = document.body.getElementsByTagName("*");
    for (var i = 0; i < all.length; i++){
      var el = all[i], s = getComputedStyle(el);
      if (s.display !== "flex" && s.display !== "inline-flex") continue;
      if (TEST && !el._tg){ el._tg = {r: px(s.rowGap), c: px(s.columnGap)}; el.style.rowGap = el.style.columnGap = "0px"; }
      var rg = TEST ? el._tg.r : px(s.rowGap), cg = TEST ? el._tg.c : px(s.columnGap);
      if (!rg && !cg) continue;
      var kids = [];
      for (var j = 0; j < el.children.length; j++) if (shown(el.children[j])) kids.push(el.children[j]);
      var dir = s.flexDirection, wrap = s.flexWrap !== "nowrap";
      if (!wrap && (dir === "row" || dir === "row-reverse")){
        /* plain text next to an icon: the space goes on the icon's side facing the text */
        var nodes = el.childNodes, prev = null, side0 = dir === "row" ? "marginRight" : "marginLeft";
        for (var q = 0; q < nodes.length; q++){
          var nd = nodes[q];
          if (nd.nodeType === 3 && nd.textContent.trim() && prev){ var ob = base(prev); prev.style[side0] = (px(dir === "row" ? ob.r : ob.l) + cg) + "px"; }
          if (nd.nodeType === 1 && shown(nd)) prev = nd;
          else if (nd.nodeType === 3 && nd.textContent.trim()) prev = null;
        }
      }
      kids.forEach(function(c, k){
        var o = base(c);
        if (dir === "column" || dir === "column-reverse"){
          if (cg && wrap) c.style.marginLeft = o.l;
          if (dir === "column") c.style.marginTop = k ? (px(o.t) + rg) + "px" : o.t;
          else c.style.marginBottom = k ? (px(o.b) + rg) + "px" : o.b;
        } else {
          var side = dir === "row-reverse" ? "marginRight" : "marginLeft", ov = dir === "row-reverse" ? o.r : o.l;
          c.style[side] = k ? (px(ov) + cg) + "px" : ov;
          if (wrap) c.style.marginTop = o.t;
        }
      });
      if (wrap && kids.length > 1 && (dir === "row" || dir === "row-reverse")){
        /* items that start a new line lose their side space and get space above instead */
        var side2 = dir === "row-reverse" ? "marginRight" : "marginLeft";
        for (var k = 1; k < kids.length; k++){
          if (kids[k].offsetTop > kids[k - 1].offsetTop + 2){
            var o2 = base(kids[k]);
            kids[k].style[side2] = dir === "row-reverse" ? o2.r : o2.l;
          }
        }
        var top = kids[0].offsetTop;
        for (k = 1; k < kids.length; k++) if (kids[k].offsetTop > top + 2) kids[k].style.marginTop = (px(base(kids[k]).t) + rg) + "px";
      }
    }
  }
  function shapes(){
    SHAPES.forEach(function(x){
      if (x[2] && page.indexOf(x[2]) < 0) return;
      var els = document.querySelectorAll(x[0]);
      for (var i = 0; i < els.length; i++){ if (TEST) els[i].style.aspectRatio = "auto"; var w = els[i].offsetWidth; if (w) els[i].style.height = (w / x[1]) + "px"; }
    });
  }
  var queued = false;
  function run(){
    if (queued) return; queued = true;
    requestAnimationFrame(function(){ queued = false; if (!hasAR) shapes(); if (!flexGap) gaps(); });
  }
  function startUp(){
    run();
    new MutationObserver(run).observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"]});
    window.addEventListener("resize", run);
    window.addEventListener("orientationchange", function(){ setTimeout(run, 300); });
    window.addEventListener("load", run);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startUp); else startUp();
})();
