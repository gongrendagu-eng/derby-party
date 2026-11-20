/* 一人称視点の描画（仮の絵）と効果音。
   画像を用意したときは Scenes.setImages({ '音楽室':'img/music.jpg', 'corridor':'img/corridor.jpg', ... }) で差し替え可能。 */
const Scenes = (function(){
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0;
  const P = { f: 600, cx: 0, cy: 0 };
  const fx = { flickerUntil: 0, blackUntil: 0, shadow: 0, shakeUntil: 0 };
  let hits = [];
  let getView = () => null;
  const imgs = {}; const imgReady = {};

  function resize(){
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  function setImages(map){
    Object.keys(map).forEach(k => {
      const im = new Image();
      im.onload = () => { imgReady[k] = true; };
      im.onerror = () => { imgReady[k] = false; };
      im.src = map[k]; imgs[k] = im;
    });
  }

  const rgb = (r, g, b, a) => 'rgba(' + (r|0) + ',' + (g|0) + ',' + (b|0) + ',' + (a == null ? 1 : a) + ')';
  const pr = (x, y, z) => { const zz = Math.max(z, 0.12); return [P.cx + x * P.f / zz, P.cy + y * P.f / zz]; };
  function poly(pts, fill, stroke, lw){
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    if (fill){ ctx.fillStyle = fill; ctx.fill(); }
    if (stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  const qX = (x, y0, y1, z0, z1) => [pr(x, y0, z0), pr(x, y0, z1), pr(x, y1, z1), pr(x, y1, z0)];
  const qY = (y, x0, x1, z0, z1) => [pr(x0, y, z0), pr(x1, y, z0), pr(x1, y, z1), pr(x0, y, z1)];
  const qZ = (z, x0, x1, y0, y1) => [pr(x0, y0, z), pr(x1, y0, z), pr(x1, y1, z), pr(x0, y1, z)];
  const bounds = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
  function inPoly(x, y, pts){
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++){
      const a = pts[i], b = pts[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }

  /* 扉：state 0=なし 1=鍵がかかっている 2=開く */
  function door(key, pts, state, t, label){
    if (!state) return;
    const open = state === 2;
    const pulse = 0.7 + 0.3 * Math.sin(t * 3);
    poly(pts, open ? rgb(88, 62, 36) : rgb(46, 32, 22), null);
    if (open) poly(pts, rgb(255, 196, 108, 0.20 + 0.22 * pulse), rgb(255, 214, 140, 0.95), 3);
    else poly(pts, null, rgb(110, 80, 48), 2);
    const b = bounds(pts), cxm = (b[0] + b[2]) / 2, cym = (b[1] + b[3]) / 2, h = b[3] - b[1];
    if (!open){
      ctx.fillStyle = rgb(190, 150, 70, 0.9);
      const s = Math.max(6, h * 0.06);
      ctx.fillRect(cxm - s, cym, s * 2, s * 1.5);
      ctx.strokeStyle = rgb(190, 150, 70, 0.9); ctx.lineWidth = Math.max(2, s * 0.3);
      ctx.beginPath(); ctx.arc(cxm, cym, s * 0.8, Math.PI, 0); ctx.stroke();
    } else {
      ctx.fillStyle = rgb(255, 230, 170, 0.95);
      ctx.beginPath(); ctx.arc(b[0] + (b[2] - b[0]) * 0.8, cym, Math.max(3, h * 0.012), 0, 7); ctx.fill();
    }
    hits.push({ key, pts, state });
  }

  function vignette(strength){
    const g = ctx.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.25, W / 2, H * 0.48, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + strength + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function box(x0, x1, y0, y1, z0, z1, col, l){
    poly(qY(y0, x0, x1, z0, z1), rgb(col[0] * 1.5 * l, col[1] * 1.5 * l, col[2] * 1.5 * l));
    if (x1 < 0) poly(qX(x1, y0, y1, z0, z1), rgb(col[0] * 0.8 * l, col[1] * 0.8 * l, col[2] * 0.8 * l));
    else if (x0 > 0) poly(qX(x0, y0, y1, z0, z1), rgb(col[0] * 0.8 * l, col[1] * 0.8 * l, col[2] * 0.8 * l));
    poly(qZ(z0, x0, x1, y0, y1), rgb(col[0] * l, col[1] * l, col[2] * l));
  }

  const TINT = {
    '教室': [1, 1, 1], '職員室': [1.1, 1, 0.9], '体育倉庫': [1, 0.9, 0.8], '美術室': [1.1, 0.95, 1.15],
    '音楽室': [1, 0.95, 1.25], '調理室': [1.15, 1.05, 0.9], '理科室': [0.9, 1.15, 1.1], '図書室': [1.15, 1, 0.85],
    '保健室': [1.15, 1.15, 1.2], '校長室': [1.2, 0.95, 0.85], '放送室': [0.95, 0.95, 1.25]
  };

  function plate(text, z, y){
    const p = pr(0, y, z), fs = Math.max(12, 0.13 * P.f / z);
    ctx.font = '500 ' + fs + 'px -apple-system,"Hiragino Sans","Yu Gothic",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + fs;
    ctx.fillStyle = 'rgba(20,28,24,0.9)'; ctx.fillRect(p[0] - w / 2, p[1] - fs * 0.8, w, fs * 1.6);
    ctx.strokeStyle = 'rgba(190,170,110,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(p[0] - w / 2, p[1] - fs * 0.8, w, fs * 1.6);
    ctx.fillStyle = 'rgba(235,225,190,0.95)'; ctx.fillText(text, p[0], p[1]);
  }

  function drawRoom(v, t, l){
    const hw = 1.6, yc = -0.8, yf = 0.8, zb = 4.6, tn = TINT[v.name] || [1, 1, 1];
    const T = (r, g, b) => rgb(r * tn[0] * l, g * tn[1] * l, b * tn[2] * l);
    poly(qY(yc, -hw, hw, 0.12, zb), T(18, 22, 32));
    for (let i = 0; i < 8; i++){
      const z0 = 0.12 + (zb - 0.12) * i / 8, z1 = 0.12 + (zb - 0.12) * (i + 1) / 8, k = 1 - 0.5 * (i / 8);
      poly(qY(yf, -hw, hw, z0, z1 + 0.01), T(32 * k, 36 * k, 48 * k));
    }
    poly(qX(-hw, yc, yf, 0.12, zb), T(36, 46, 70));
    poly(qX(hw, yc, yf, 0.12, zb), T(36, 46, 70));
    poly(qZ(zb, -hw, hw, yc, yf), T(24, 30, 46));
    ctx.strokeStyle = rgb(70 * l, 80 * l, 100 * l, 0.25); ctx.lineWidth = 1;
    for (let z = 0.8; z < zb; z += 0.6){ ctx.beginPath(); const a = pr(-hw, yf, z), b = pr(hw, yf, z); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    for (let x = -1.2; x <= 1.2; x += 0.8){ ctx.beginPath(); const a = pr(x, yf, 0.4), b = pr(x, yf, zb); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    const moon = 0.5 + 0.2 * Math.sin(t * 0.7);
    poly(qX(-hw, -0.5, 0.1, 0.7, 1.9), rgb(120, 150, 210, moon), rgb(60, 70, 100), 2);
    poly(qX(hw, -0.5, 0.1, 0.7, 1.9), rgb(120, 150, 210, moon * 0.8), rgb(60, 70, 100), 2);
    poly([pr(-hw, yf, 0.7), pr(-hw, yf, 1.9), pr(-0.3, yf, 2.9), pr(-0.3, yf, 1.7)], rgb(130, 160, 220, 0.09 * l));
    poly(qZ(zb, -1.45, -0.5, -0.5, 0.15), T(18, 44, 36), rgb(90, 70, 50), 3);
    ctx.strokeStyle = rgb(200, 210, 200, 0.35); ctx.lineWidth = 2;
    [[-1.3, -0.3, -1.0, -0.3], [-1.3, -0.15, -0.8, -0.15], [-1.3, 0.0, -0.9, 0.0]].forEach(s => { const a = pr(s[0], s[1], zb), b = pr(s[2], s[3], zb); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
    hits = [];
    const dr = v.doors || {};
    if (dr.front) door('front', qZ(zb, -0.3, 0.3, -0.55, yf), dr.front, t); else { const c = pr(0, -0.1, zb), r = 0.25 * P.f / zb; ctx.strokeStyle = rgb(160, 150, 120, 0.6); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0], c[1] - r * 0.8); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + r * 0.5, c[1]); ctx.stroke(); }
    if (dr.right) door('right', qX(hw, -0.55, yf, 2.4, 3.4), dr.right, t); else poly(qX(hw, -0.4, 0.1, 2.4, 3.4), rgb(58 * l, 52 * l, 40 * l), rgb(90, 80, 60), 2);
    if (dr.left) door('left', qX(-hw, -0.55, yf, 2.4, 3.4), dr.left, t); else poly(qX(-hw, -0.4, 0.1, 2.4, 3.4), rgb(58 * l, 52 * l, 40 * l), rgb(90, 80, 60), 2);
    const desks = [[-1.0, 1.7], [1.0, 1.9], [-0.95, 3.5], [0.95, 3.7]];
    desks.sort((a, b) => b[1] - a[1]).forEach(d => box(d[0] - 0.3, d[0] + 0.3, 0.3, 0.8, d[1], d[1] + 0.4, [40 * tn[0], 34 * tn[1], 30 * tn[2]], l));
    plate(v.name || '', zb, -0.68);
    const g = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.7);
    g.addColorStop(0, rgb(255, 230, 170, 0.10 * l)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function drawCorridor(v, t, l){
    const L = 14, hw = 1, yc = -0.78, yf = 0.78;
    const p = v.walk == null ? 1 : v.walk;
    const ease = 1 - Math.pow(1 - p, 1.7);
    const cam = (L - 3.2) - (1 - ease) * 9;
    const endRel = L - cam;
    P.cy += Math.sin(cam * 6.5) * H * 0.007 * (p < 1 ? 1 : 0);
    P.cx += Math.sin(cam * 3.2) * W * 0.003 * (p < 1 ? 1 : 0);
    const n = 26;
    for (let i = n - 1; i >= 0; i--){
      const z0 = 0.3 + (endRel - 0.3) * i / n, z1 = 0.3 + (endRel - 0.3) * (i + 1) / n;
      const k = Math.min(1, z0 / 9), q = l * (1 - 0.88 * k);
      poly(qX(-hw, yc, yf, z0, z1 + 0.01), rgb(34 * q, 44 * q, 66 * q));
      poly(qX(hw, yc, yf, z0, z1 + 0.01), rgb(34 * q, 44 * q, 66 * q));
      poly(qY(yc, -hw, hw, z0, z1 + 0.01), rgb(20 * q, 24 * q, 36 * q));
      poly(qY(yf, -hw, hw, z0, z1 + 0.01), rgb(28 * q, 32 * q, 44 * q));
    }
    const eq = l * (1 - 0.6 * Math.min(1, endRel / 9));
    poly(qZ(endRel, -hw, hw, yc, yf), rgb(20 * eq, 26 * eq, 38 * eq));
    const glow = ctx.createRadialGradient(...pr(0, 0, endRel), 0, ...pr(0, 0, endRel), P.f * 0.5 / endRel);
    glow.addColorStop(0, rgb(150, 170, 220, 0.18 * l)); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = rgb(80 * l, 90 * l, 110 * l, 0.3); ctx.lineWidth = 1;
    const off = cam % 0.7;
    for (let j = 0; j < 30; j++){
      const rel = j * 0.7 - off + 0.3; if (rel < 0.3 || rel > endRel) continue;
      const a = pr(-hw, yf, rel), b = pr(hw, yf, rel); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    const dr0 = v.doors || {};
    const doorZone = endRel - 2.1;
    for (let k = 6; k >= 0; k--){
      const zw = 2.5 + k * 3, rel = zw - cam;
      if (rel < 0.35 || rel > endRel - 0.8) continue;
      const q = l * (1 - 0.85 * Math.min(1, rel / 9));
      const lampOn = (fx.flickerUntil > performance.now() && Math.random() < 0.5) ? 0.15 : 1;
      if (!(dr0.left && rel + 1.9 > doorZone) && rel + 1.9 < endRel - 0.2){
        poly(qX(-hw, -0.35, 0.3, rel + 1.0, rel + 1.9), rgb(120 * q, 150 * q, 210 * q, 0.55), rgb(50, 60, 90), 1);
        poly(qY(yf, -hw, -0.15, rel + 1.0, rel + 1.9), rgb(120, 150, 210, 0.07 * q));
      }
      if (!(dr0.right && rel + 1.7 > doorZone) && rel + 1.7 < endRel - 0.2){
        for (let m = 0; m < 3; m++) poly(qX(hw, -0.45, 0.75, rel + 0.2 + m * 0.5, rel + 0.6 + m * 0.5), rgb(50 * q, 62 * q, 80 * q), rgb(20, 24, 34), 1);
      }
      poly(qY(yc + 0.002, -0.2, 0.2, rel, rel + 0.5), rgb(235 * lampOn, 225 * lampOn, 170 * lampOn, 0.95 * q + 0.05));
      const c = pr(0, yc, rel + 0.25), gr = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], P.f * 0.6 / rel);
      gr.addColorStop(0, rgb(255, 235, 170, 0.28 * q * lampOn)); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
    hits = [];
    const dr = v.doors || {};
    const dState = p < 1 ? (x => x ? 1 : 0) : (x => x);
    if (dr.front) door('front', qZ(endRel, -0.28, 0.28, -0.5, yf), dState(dr.front), t); else if (p >= 0) { const a = pr(-0.2, -0.2, endRel), b = pr(0.2, 0.35, endRel); ctx.fillStyle = rgb(140 * eq, 30 * eq, 30 * eq, 0.8); ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); }
    if (dr.right) door('right', qX(hw, -0.5, yf, endRel - 1.9, endRel - 0.9), dState(dr.right), t);
    if (dr.left) door('left', qX(-hw, -0.5, yf, endRel - 1.9, endRel - 0.9), dState(dr.left), t);
    if (fx.shadow > 0){
      const z = endRel - 1.2, a = fx.shadow;
      const hd = pr(0.1, -0.2, z), r = 0.09 * P.f / z;
      ctx.fillStyle = 'rgba(0,0,0,' + (0.95 * a) + ')';
      ctx.beginPath(); ctx.arc(hd[0], hd[1], r, 0, 7); ctx.fill();
      poly([pr(-0.05, -0.1, z), pr(0.25, -0.1, z), pr(0.3, yf, z), pr(-0.1, yf, z)], 'rgba(0,0,0,' + (0.95 * a) + ')');
      ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * a) + ')';
      ctx.beginPath(); ctx.arc(hd[0] - r * 0.35, hd[1], r * 0.12, 0, 7); ctx.arc(hd[0] + r * 0.35, hd[1], r * 0.12, 0, 7); ctx.fill();
    }
    return { zoom: endRel };
  }

  function drawExit(t){
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.7);
    g.addColorStop(0, '#fff4d0'); g.addColorStop(0.35, '#f0b865'); g.addColorStop(1, '#1c1424');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const w = Math.min(W, H) * 0.55, h = H * 0.7, x = W / 2 - w / 2, y = H * 0.12;
    ctx.fillStyle = 'rgba(18,14,24,0.9)';
    ctx.fillRect(x - 14, y - 14, 14, h + 14); ctx.fillRect(x + w, y - 14, 14, h + 14); ctx.fillRect(x - 14, y - 14, w + 28, 14);
    const sun = ctx.createLinearGradient(0, y, 0, y + h);
    sun.addColorStop(0, '#fff6d8'); sun.addColorStop(1, '#ffd48a');
    ctx.fillStyle = sun; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.15 + 0.1 * Math.sin(t * 2)) + ')'; ctx.fillRect(x, y, w, h);
  }

  function drawTitle(t){
    ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++){
      const x = (i * 97.3) % W, y = (i * 53.7) % (H * 0.6), tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + i));
      ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * tw) + ')'; ctx.fillRect(x, y, 2, 2);
    }
    ctx.fillStyle = '#e8d8a0'; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.17, Math.min(W, H) * 0.06, 0, 7); ctx.fill();
    const bw = Math.min(W * 0.8, H * 1.4), bx = W / 2 - bw / 2, by = H * 0.55;
    ctx.fillStyle = '#0b0f19'; ctx.fillRect(bx, by, bw, H * 0.45);
    ctx.fillRect(bx + bw * 0.4, by - H * 0.1, bw * 0.2, H * 0.1);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++){
      const lit = ((r * 7 + c * 3 + Math.floor(t * 0.5)) % 11) === 0;
      ctx.fillStyle = lit ? 'rgba(255,215,120,0.9)' : 'rgba(40,52,80,0.55)';
      ctx.fillRect(bx + bw * 0.05 + c * bw * 0.092, by + H * 0.04 + r * H * 0.1, bw * 0.05, H * 0.05);
    }
  }

  function frame(){
    requestAnimationFrame(frame);
    if (!W) resize();
    const t = performance.now() / 1000, now = performance.now();
    const v = getView();
    ctx.save();
    if (fx.shakeUntil > now){ ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10); }
    P.f = Math.min(H * 0.92, W * 0.8); P.cx = W / 2; P.cy = H * 0.46;
    if (!v || v.kind === 'title') drawTitle(t);
    else {
      let l = 1;
      if (fx.flickerUntil > now) l = Math.random() < 0.5 ? 0.25 : 0.9; else l = 0.92 + 0.08 * Math.sin(t * 9) * Math.random();
      if (v.kind === 'exit') drawExit(t);
      else if (v.kind === 'room') drawRoom(v, t, l);
      else drawCorridor(v, t, l);
      vignette(v.kind === 'exit' ? 0.2 : 0.78);
      if (fx.blackUntil > now){ ctx.fillStyle = 'rgba(0,0,0,0.96)'; ctx.fillRect(0, 0, W, H); }
    }
    ctx.restore();
  }

  function hit(x, y){
    const r = cv.getBoundingClientRect();
    const px = x - r.left, py = y - r.top;
    for (let i = hits.length - 1; i >= 0; i--) if (hits[i].state === 2 && inPoly(px, py, hits[i].pts)) return hits[i].key;
    return null;
  }

  function start(fn){ getView = fn; resize(); requestAnimationFrame(frame); }
  return { start, fx, hit, setImages, resize };
})();

/* 効果音（WebAudioで合成） */
const Sound = (function(){
  let AC = null, master = null, muted = false, nb = null;
  function init(){
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(AC.destination);
      const len = AC.sampleRate; nb = AC.createBuffer(1, len, AC.sampleRate);
      const d = nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      [48, 51.2].forEach(f => {
        const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const fl = AC.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 110;
        const g = AC.createGain(); g.gain.value = 0.05;
        o.connect(fl); fl.connect(g); g.connect(master); o.start();
      });
    } catch (e) { AC = null; }
  }
  function noise(dur, type, freq, vol, delay){
    if (!AC) return;
    const s = AC.createBufferSource(); s.buffer = nb; s.loop = true;
    const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = AC.createGain(); const t0 = AC.currentTime + (delay || 0);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + 0.05);
  }
  function tone(type, f0, f1, dur, vol, delay){
    if (!AC) return;
    const o = AC.createOscillator(); o.type = type; const g = AC.createGain(); const t0 = AC.currentTime + (delay || 0);
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  return {
    init,
    toggle(){ muted = !muted; if (master) master.gain.value = muted ? 0 : 0.6; return muted; },
    isMuted(){ return muted; },
    step(){ noise(0.09, 'lowpass', 260, 0.5); },
    thump(){ tone('sine', 80, 30, 0.3, 0.9); },
    knock(){ [0, 0.22, 0.44].forEach(d => tone('sine', 110, 50, 0.12, 0.8, d)); },
    creak(){ tone('sawtooth', 180, 110, 0.9, 0.12); noise(0.9, 'bandpass', 900, 0.05); },
    zap(){ noise(0.18, 'highpass', 3000, 0.4); tone('square', 90, 60, 0.15, 0.15); },
    whisper(){ noise(1.4, 'bandpass', 1800, 0.12); },
    chime(){ tone('sine', 660, 660, 0.5, 0.25); tone('sine', 880, 880, 0.7, 0.25, 0.12); },
    buzz(){ tone('square', 120, 100, 0.28, 0.2); },
    unlock(){ tone('triangle', 400, 400, 0.08, 0.4); tone('triangle', 600, 600, 0.12, 0.4, 0.1); },
    stinger(){ tone('sawtooth', 70, 35, 0.8, 0.25); noise(0.5, 'lowpass', 500, 0.4); }
  };
})();
