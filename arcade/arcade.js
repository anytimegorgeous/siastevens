/* The Love Arcade: the shared engine every booth uses.
   - Next player: back to the Arcade's front page, nothing kept.
   - Idle: in Event mode, a booth left alone for 75 seconds goes back to the front page (off in talk mode).
   - Talk mode: bigger type for a projector, no idle return. Switched on the front page.
   - Offline: registers the service worker that keeps every booth on the iPad.
   - The result footer: chapter, QR code to the book, Next player.
   Nothing a visitor answers is stored anywhere. */
(function () {
"use strict";
const QR_ECC = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];   /* error-correction codewords per block, level M */
const QR_BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];           /* blocks per version, level M */
function qrMatrix(text){
  const bytes = [...new TextEncoder().encode(text)];
  let ver = 1;
  const rawWords = v => { let r = (16 * v + 128) * v + 64; if (v >= 2){ const a = Math.floor(v / 7) + 2; r -= (25 * a - 10) * a - 55; if (v >= 7) r -= 36; } return r >> 3; };
  const dataWords = v => rawWords(v) - QR_ECC[v - 1] * QR_BLOCKS[v - 1];
  while (ver <= 10 && 4 + (ver < 10 ? 8 : 16) + bytes.length * 8 > dataWords(ver) * 8) ver++;
  if (ver > 10) throw new Error("too long for a QR code here");
  const size = ver * 4 + 17, cap = dataWords(ver);
  /* data bits */
  const bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
  put(0, Math.min(4, cap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xEC; bits.length < cap * 8; pad ^= 0xEC ^ 0x11) put(pad, 8);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  /* Reed-Solomon over GF(256) */
  const mul = (a, b) => { let z = 0; for (let i = 7; i >= 0; i--){ z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((b >>> i) & 1) * a; } return z; };
  const ecLen = QR_ECC[ver - 1], nBlocks = QR_BLOCKS[ver - 1], raw = rawWords(ver);
  let gen = [1];
  for (let i = 0, root = 1; i < ecLen; i++, root = mul(root, 2)){
    const g = new Array(gen.length + 1).fill(0);
    gen.forEach((c, j) => { g[j] ^= c; g[j + 1] ^= mul(c, root); });
    gen = g;
  }
  const ecc = block => { const r = new Array(ecLen).fill(0); for (const b of block){ const f = b ^ r.shift(); r.push(0); gen.slice(1).forEach((c, j) => { r[j] ^= mul(c, f); }); } return r; };
  const shortBlocks = nBlocks - raw % nBlocks, shortLen = Math.floor(raw / nBlocks) - ecLen;
  const blocks = []; let k = 0;
  for (let i = 0; i < nBlocks; i++){ const len = shortLen + (i < shortBlocks ? 0 : 1); const d = data.slice(k, k + len); k += len; blocks.push([...d, ...(i < shortBlocks ? [-1] : []), ...ecc(d)]); }
  const words = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach(b => { if (b[i] >= 0) words.push(b[i]); });
  /* function patterns */
  const m = Array.from({length: size}, () => new Array(size).fill(0)), fn = Array.from({length: size}, () => new Array(size).fill(false));
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < size && y < size){ m[y][x] = v ? 1 : 0; fn[y][x] = true; } };
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++){ const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); } };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  for (let i = 8; i < size - 8; i++){ set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const nAlign = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (nAlign * 2 - 2)) * 2, pos = [6];
  for (let p = size - 7; pos.length < nAlign; p -= step) pos.splice(1, 0, p);
  if (ver >= 2) pos.forEach((px, i) => pos.forEach((py, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === nAlign - 1) || (i === nAlign - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const format = mask => {
    const d = (0 << 3) | mask; let rem = d;                 /* level M is 00 */
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const f = ((d << 10) | rem) ^ 0x5412, bit = i => (f >>> i) & 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, 1);
  };
  format(0);
  if (ver >= 7){
    let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const v = (ver << 12) | rem;
    for (let i = 0; i < 18; i++){ const b = (v >>> i) & 1, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, b); set(c, a, b); }
  }
  /* data, zigzag */
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2){
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++){
      const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      if (!fn[y][x] && i < words.length * 8){ m[y][x] = (words[i >> 3] >>> (7 - (i & 7))) & 1; i++; }
    }
  }
  /* masks */
  const MASKS = [(x, y) => (x + y) % 2, (x, y) => y % 2, (x, y) => x % 3, (x, y) => (x + y) % 3, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2,
    (x, y) => (x * y) % 2 + (x * y) % 3, (x, y) => ((x * y) % 2 + (x * y) % 3) % 2, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2];
  const apply = mask => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y) === 0) m[y][x] ^= 1; };
  const penalty = () => {
    /* the four penalty rules of the standard: long runs, 2 by 2 blocks, finder look-alikes, dark balance */
    let p = 0;
    const addHist = (h, len) => { if (h[0] === 0) len += size; h.pop(); h.unshift(len); };
    const look = h => { const n = h[1], core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n; return (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) + (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0); };
    const line = get => {
      let color = 0, run = 0; const h = new Array(7).fill(0);
      for (let i = 0; i < size; i++){
        const v = get(i);
        if (v === color){ run++; if (run === 5) p += 3; else if (run > 5) p++; }
        else { addHist(h, run); if (!color) p += look(h) * 40; color = v; run = 1; }
      }
      if (color){ addHist(h, run); run = 0; }
      addHist(h, run + size); p += look(h) * 40;
    };
    for (let i = 0; i < size; i++){ line(x => m[i][x]); line(y => m[y][i]); }
    let dark = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++){
      dark += m[y][x];
      if (y < size - 1 && x < size - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    }
    const k = Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1;
    return p + Math.max(0, k) * 10;
  };
  let best = 0, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++){ format(mask); apply(mask); const p = penalty(); if (p < bestP){ bestP = p; best = mask; } apply(mask); }
  format(best); apply(best);
  return m;
}
function qrSvg(m, label){
  const d = m.map((row, y) => { let s = ""; for (let x = 0; x < row.length;){ if (!row[x]){ x++; continue; } let e = x; while (e < row.length && row[e]) e++; s += `M${x} ${y}h${e - x}v1h-${e - x}z`; x = e; } return s; }).join("");
  return `<svg viewBox="0 0 ${m.length} ${m.length}" shape-rendering="crispEdges" role="img" aria-label="${label}"><path d="${d}"/></svg>`;
}

const BOOK_URL = "https://siastevens.com/amgf/";
const HUB = "index.html";
const IDLE_MS = 75000;
let qrCache = "";

function store(k, v){ try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
const talk = () => store("loveArcade.talk") === "1";
/* Event mode: on the booth iPad only. Booths reset after 75 quiet seconds and the front page shows the
   waiting screen. Off for everyone else, so a visitor playing at home is never sent back mid-game. */
const eventMode = () => store("loveArcade.event") === "1";

function shuffle(a){ a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function qr(){ if (!qrCache) qrCache = qrSvg(qrMatrix(BOOK_URL), "QR code for the book A Million Green Flags"); return qrCache; }

function home(){ location.href = HUB; }

/* the result footer every booth ends with */
function footer(o){
  o = o || {};
  const ch = o.chapter ? `Chapter ${o.chapter}` : "The book";
  return `<div class="ac-foot">
    <div class="ac-qr">${qr()}</div>
    <div class="ac-foot-txt">
      <p class="ac-k">${esc(ch)} of <em>A Million Green Flags</em></p>
      <p class="ac-t">${esc(o.line || "Scan to see what the book says about you.")}</p>
    </div>
  </div>
  <div class="ac-btns">
    <button type="button" class="ac-btn ac-next" data-ac="next">Next player</button>
    <button type="button" class="ac-btn ac-again" data-ac="again">${esc(o.againLabel || "Play again")}</button>
  </div>`;
}

let idleT = 0, opts = {};
function poke(){
  clearTimeout(idleT);
  if (opts.hub || talk() || !eventMode()) return;
  idleT = setTimeout(home, IDLE_MS);
}

function init(o){
  opts = o || {};
  document.documentElement.classList.toggle("talk", talk());
  try { sessionStorage.setItem("loveArcade", "1"); } catch (e) {}
  if (!opts.hub){
    const a = document.createElement("a");
    a.href = HUB; a.className = "ac-home"; a.innerHTML = '<span aria-hidden="true">&#9664;</span> Arcade';
    document.body.appendChild(a);
  }
  ["pointerdown", "keydown", "touchstart"].forEach(ev => window.addEventListener(ev, poke, {passive: true}));
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-ac]");
    if (!b) return;
    if (b.dataset.ac === "next") home();
    else if (b.dataset.ac === "again" && opts.again) opts.again();
  });
  poke();
  /* keep the arcade on the device for markets with no signal */
  if ("serviceWorker" in navigator && location.protocol === "https:"){
    navigator.serviceWorker.register("../arcade-sw.js", {scope: "../"}).catch(() => {});
  }
}

window.Arcade = {init, footer, shuffle, esc, qr, home, talk, eventMode, store, qrMatrix, qrSvg};
})();
