/* タワーバトル ゲーム処理(画面に依存しない部分)
   試作v9 の core/sim を切り出し、チーム戦(mode:'team' = 4チーム×役割4人)を足したもの。
   ブラウザでは window.TBSIM、Node では require() で読める(シミュレーション用) */
(function (root) {
'use strict';
// ===================== core: constants / map generation / path fields =====================
const CELL = 40;
const STEP = 1 / 60;
const MODES = {
  '1v1': { W: 1800, H: 1000, nTeams: 2, nPlayers: 2, label: '1対1' },
  '2v2': { W: 2320, H: 1240, nTeams: 2, nPlayers: 4, label: '2対2' },
  '4p':  { W: 2000, H: 1600, nTeams: 4, nPlayers: 4, label: '4人戦' },
  team:  { W: 2400, H: 1800, nTeams: 4, nPlayers: 16, label: 'チーム戦' }
};
const TEAM_COLORS = ['#ff4d88', '#3d8bff', '#3fc45f', '#ffb020'];
const TEAM_NAMES = ['ピンク', 'ブルー', 'グリーン', 'オレンジ'];
// ---- team mode: 4 roles per team. player slot = team * 4 + role index
const ROLES = ['front', 'back', 'eng', 'cmd'];
const ROLE_NAMES = { front: '前線', back: '後衛', eng: '工兵', cmd: '司令塔' };
// map definitions: dens = obstacle density, walls = long-wall multiplier, mix = share of small/medium/large round obstacles
const MAPS = {
  forest:  { label: '森林',     dens: 1.6, walls: 0.5, mix: [0.40, 0.40, 0.20], flat: true },
  rock:    { label: '岩石',     dens: 1.1, walls: 1.0, mix: [0.35, 0.40, 0.25], flat: false },
  desert:  { label: '砂漠',     dens: 1.0, walls: 1.0, mix: [0.45, 0.35, 0.20], flat: false },
  snow:    { label: '雪原',     dens: 1.0, walls: 1.0, mix: [0.35, 0.40, 0.25], flat: true },
  swamp:   { label: '沼地',     dens: 1.4, walls: 0.9, mix: [0.40, 0.40, 0.20], flat: true },
  volcano: { label: '火山',     dens: 1.0, walls: 1.2, mix: [0.30, 0.40, 0.30], flat: true },
  ruins:   { label: '古代遺跡', dens: 1.1, walls: 1.3, mix: [0.35, 0.40, 0.25], flat: false },
  grave:   { label: '墓場',     dens: 1.2, walls: 1.2, mix: [0.40, 0.40, 0.20], flat: false }
};
const MAP_ORDER = ['forest', 'rock', 'desert', 'snow', 'swamp', 'volcano', 'ruins', 'grave'];
const OB_R = { sm: 22, md: 30, lg: 42 };

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function layout(mk) {
  const M = MODES[mk], W = M.W, H = M.H;
  if (mk === '1v1') {
    const zw = Math.round(W * 0.30 / CELL) * CELL;
    return {
      zones: [{ x0: 0, y0: 0, x1: zw, y1: H }, { x0: W - zw, y0: 0, x1: W, y1: H }],
      crystals: [{ x: 140, y: H / 2 }, { x: W - 140, y: H / 2 }],
      teamOfPlayer: [0, 1], lanes: [H * 0.15, null, H * 0.85]
    };
  }
  if (mk === '2v2') {
    const zw = Math.round(W * 0.28 / CELL) * CELL, hh = H / 2;
    return {
      zones: [
        { x0: 0, y0: 0, x1: zw, y1: hh }, { x0: 0, y0: hh, x1: zw, y1: H },
        { x0: W - zw, y0: 0, x1: W, y1: hh }, { x0: W - zw, y0: hh, x1: W, y1: H }],
      crystals: [{ x: 140, y: H / 2 }, { x: W - 140, y: H / 2 }],
      teamOfPlayer: [0, 0, 1, 1], lanes: [H * 0.25, H * 0.75]
    };
  }
  const zw = Math.round(W * 0.30 / CELL) * CELL, zh = Math.round(H * 0.30 / CELL) * CELL;
  if (mk === 'team') {
    const z4 = [{ x0: 0, y0: 0, x1: zw, y1: zh }, { x0: W - zw, y0: 0, x1: W, y1: zh }, { x0: 0, y0: H - zh, x1: zw, y1: H }, { x0: W - zw, y0: H - zh, x1: W, y1: H }];
    const zones = [], top = [];
    for (let i = 0; i < 16; i++) { zones.push(z4[i >> 2]); top.push(i >> 2); }
    return { zones, crystals: [{ x: 150, y: 150 }, { x: W - 150, y: 150 }, { x: 150, y: H - 150 }, { x: W - 150, y: H - 150 }], teamOfPlayer: top, lanes: null };
  }
  return {
    zones: [
      { x0: 0, y0: 0, x1: zw, y1: zh }, { x0: W - zw, y0: 0, x1: W, y1: zh },
      { x0: 0, y0: H - zh, x1: zw, y1: H }, { x0: W - zw, y0: H - zh, x1: W, y1: H }],
    crystals: [{ x: 150, y: 150 }, { x: W - 150, y: 150 }, { x: 150, y: H - 150 }, { x: W - 150, y: H - 150 }],
    teamOfPlayer: [0, 1, 2, 3], lanes: null
  };
}

function itemAABB(it) {
  if (it.t === 'cliff') return { x0: it.x, y0: it.y, x1: it.x + it.w, y1: it.y + it.h };
  return { x0: it.x - it.r, y0: it.y - it.r, x1: it.x + it.r, y1: it.y + it.r };
}
function aabbOverlap(a, b, pad) {
  return a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.y0 < b.y1 + pad && a.y1 > b.y0 - pad;
}
function aabbNearDist(a, px, py) {
  const dx = Math.max(a.x0 - px, 0, px - a.x1), dy = Math.max(a.y0 - py, 0, py - a.y1);
  return Math.hypot(dx, dy);
}

function blockedFromItems(items, GW, GH) {
  const b = new Uint8Array(GW * GH);
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
    const px = cx * CELL + CELL / 2, py = cy * CELL + CELL / 2;
    for (const it of items) {
      let hit = false;
      if (it.t === 'cliff') hit = px > it.x - 4 && px < it.x + it.w + 4 && py > it.y - 4 && py < it.y + it.h + 4;
      else hit = Math.hypot(px - it.x, py - it.y) < it.r + 3;
      if (hit) { b[cy * GW + cx] = 1; break; }
    }
  }
  return b;
}

function connected(blocked, GW, GH, pts) {
  const seen = new Uint8Array(GW * GH);
  const sx = Math.floor(pts[0].x / CELL), sy = Math.floor(pts[0].y / CELL);
  const st = [sy * GW + sx]; seen[st[0]] = 1;
  while (st.length) {
    const i = st.pop(), cx = i % GW, cy = (i / GW) | 0;
    const nb = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of nb) {
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const j = ny * GW + nx; if (seen[j] || blocked[j]) continue;
      seen[j] = 1; st.push(j);
    }
  }
  for (const p of pts) {
    const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
    if (!seen[cy * GW + cx]) return false;
  }
  return true;
}

function genMap(mk, map, seed) {
  const M = MODES[mk], W = M.W, H = M.H, GW = W / CELL, GH = H / CELL, L = layout(mk);
  const D = MAPS[map] || MAPS.forest;
  const keeps = [];
  L.crystals.forEach(c => keeps.push({ x: c.x, y: c.y, r: 190 }));
  if (L.lanes) for (const y of L.lanes) if (y != null) for (const fx of [0.28, 0.5, 0.72]) keeps.push({ x: W * fx, y, r: fx === 0.5 ? 100 : 75 });
  const inZone = (x, y) => L.zones.some(z => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1);
  let last = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const R = mulberry32(seed * 7919 + attempt * 104729 + 17);
    const items = [];
    // center feature (pond / lake / boulder / oasis ...)
    items.push({ t: 'obs', k: 'ct', x: W / 2, y: H / 2, r: mk === '1v1' ? 90 : mk === '2v2' ? 95 : mk === 'team' ? 120 : 110 });
    const quadArea = (W / 2) * (H / 2);
    const nGroups = Math.round(quadArea / (72000 / D.dens));
    const nCliff = Math.max(1, Math.round(quadArea / 190000 * D.walls));
    const tryAdd = (cands) => {
      // cands = quadrant-space items; mirror to 4 copies
      const all = [];
      for (const sx of [0, 1]) for (const sy of [0, 1]) {
        for (const it of cands) {
          const c = Object.assign({}, it);
          if (it.t === 'cliff') {
            c.x = sx ? W - it.x - it.w : it.x; c.y = sy ? H - it.y - it.h : it.y;
          } else { c.x = sx ? W - it.x : it.x; c.y = sy ? H - it.y : it.y; }
          all.push(c);
        }
      }
      const out = [];
      for (const c of all) {
        const bb = itemAABB(c);
        if (bb.x0 < 6 || bb.y0 < 6 || bb.x1 > W - 6 || bb.y1 > H - 6) return false;
        for (const k of keeps) if (aabbNearDist(bb, k.x, k.y) < k.r) return false;
        for (const o of items.concat(out)) if (aabbOverlap(bb, itemAABB(o), 10)) return false;
        out.push(c);
      }
      for (const c of out) items.push(c);
      return true;
    };
    let placed = 0, tries = 0;
    while (placed < nGroups && tries < 500) {
      tries++;
      const x = 60 + R() * (W / 2 - 100), y = 60 + R() * (H / 2 - 100);
      if (inZone(x, y) && R() > 0.4) continue;
      const q = R(), k = q < D.mix[0] ? 'sm' : q < D.mix[0] + D.mix[1] ? 'md' : 'lg';
      if (tryAdd([{ t: 'obs', k, x, y, r: OB_R[k] + R() * 4 }])) placed++;
    }
    // long walls (cliffs / hedges / fences ...)
    let cp = 0; tries = 0;
    while (cp < nCliff && tries < 300) {
      tries++;
      const horiz = R() < 0.5, len = horiz ? 150 + R() * 80 : 120 + R() * 60;
      const x = 60 + R() * (W / 2 - 120), y = 60 + R() * (H / 2 - 120);
      if (inZone(x, y) && R() > 0.3) continue;
      const it = horiz ? { t: 'cliff', k: 'hw', x, y, w: len, h: 44 } : { t: 'cliff', k: 'vw', x, y, w: 56, h: len };
      if (tryAdd([it])) cp++;
    }
    const blocked = blockedFromItems(items, GW, GH);
    const pts = L.crystals.slice();
    if (L.lanes) for (const y of L.lanes) if (y != null) pts.push({ x: W / 2, y });
    pts.push({ x: W / 2 + 130, y: H / 2 + 130 });
    pts.push({ x: W / 2 - 130, y: H / 2 - 130 });
    // spawn / crystal neighbourhoods must be free
    let freeOK = true;
    for (const c of L.crystals) {
      const cx = Math.floor(c.x / CELL), cy = Math.floor(c.y / CELL);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        if (blocked[ny * GW + nx]) freeOK = false;
      }
    }
    const okc = freeOK && connected(blocked, GW, GH, pts);
    last = { items, blocked, GW, GH, W, H, L, attempt, ok: okc };
    if (okc) return last;
  }
  return last;
}

// ---------- path fields (Dijkstra from destination) ----------
const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
function makeField(blocked, GW, GH, cost, dx0, dy0) {
  const N = GW * GH, dist = new Float64Array(N).fill(1e9);
  const hd = [], hi = []; // binary heap (parallel arrays)
  function push(d, i) {
    let k = hd.length; hd.push(d); hi.push(i);
    while (k > 0) { const p = (k - 1) >> 1; if (hd[p] <= hd[k]) break; [hd[p], hd[k]] = [hd[k], hd[p]]; [hi[p], hi[k]] = [hi[k], hi[p]]; k = p; }
  }
  function pop() {
    const d = hd[0], i = hi[0], ld = hd.pop(), li = hi.pop();
    if (hd.length) {
      hd[0] = ld; hi[0] = li; let k = 0;
      for (;;) {
        let l = 2 * k + 1, r = l + 1, m = k;
        if (l < hd.length && hd[l] < hd[m]) m = l;
        if (r < hd.length && hd[r] < hd[m]) m = r;
        if (m === k) break;
        [hd[m], hd[k]] = [hd[k], hd[m]]; [hi[m], hi[k]] = [hi[k], hi[m]]; k = m;
      }
    }
    popD = d; return i;
  }
  let popD = 0;
  const s = dy0 * GW + dx0; dist[s] = 0; push(0, s);
  while (hd.length) {
    const i = pop(), d = popD; if (d > dist[i]) continue;
    const cx = i % GW, cy = (i / GW) | 0;
    for (let k = 0; k < 8; k++) {
      const nx = cx + NB[k][0], ny = cy + NB[k][1];
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const j = ny * GW + nx; if (blocked[j]) continue;
      if (k >= 4 && (blocked[cy * GW + nx] || blocked[ny * GW + cx])) continue;
      const nd = d + NB[k][2] * cost[i === s ? j : j];
      if (nd < dist[j]) { dist[j] = nd; push(nd, j); }
    }
  }
  return dist;
}
let bnx = 0, bny = 0;
function bestNeighbor(dist, blocked, GW, GH, cx, cy, fx, fy) {
  let best = dist[cy * GW + cx], found = false;
  fx = fx || 1; fy = fy || 1;
  for (let k = 0; k < 8; k++) {
    const nx = cx + NB[k][0] * fx, ny = cy + NB[k][1] * fy;
    if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
    const j = ny * GW + nx; if (blocked[j]) continue;
    if (k >= 4 && (blocked[cy * GW + nx] || blocked[ny * GW + cx])) continue;
    if (dist[j] < best - 1e-4) { best = dist[j]; bnx = nx; bny = ny; found = true; }
  }
  return found;
}

// ===================== sim: rules / units / structures / CPU =====================
const PREP = 20, TIME_LIMIT = 360, SPEEDK = 1.25, CRY_HP = 2500, CRY_R = 46;
const START_GOLD = 250, BASE_INC = 5, INC_CAP = 45;
// ---- gold mine: each one raises income. cost rises with each mine you own. attackers can destroy it
const MINE = { name: '金鉱', sn: '金鉱', cost: 150, costStep: 50, hp: 420, inc: 4, max: 4, front: 200, h: 62, desc: '建てるほど収入アップ。自陣の前のほうにだけ置ける。壊されると収入が減る' };
// ---- map items: announced ITEM.warn s before they appear at a spot equally far from everyone; first unit to touch it takes it
const ITEM = { first: 60, every: 45, warn: 5, life: 30, detour: 160, buff: 20, gold: 100, steal: 80, horn: 3, sand: 4, bolt: 0.4 };
const ITEMS = {
  gold:   { name: '金貨袋',     icon: '💰', col: '#ffd23f', desc: '+100G！' },
  potion: { name: '回復の薬',   icon: '🧪', col: '#ff6fae', desc: 'ユニット全回復・建物も半分回復' },
  power:  { name: '力の巻物',   icon: '⚔', col: '#ff5a4a', desc: '20秒間 攻撃力1.5倍' },
  shield: { name: '守りの盾',   icon: '🛡', col: '#7fb2ff', desc: '20秒間 受けるダメージ半分' },
  boots:  { name: '風のブーツ', icon: '👟', col: '#5fe08a', desc: '20秒間 移動速度1.5倍' },
  bolt:   { name: 'いかずち',   icon: '⚡', col: '#ffe14a', desc: '相手のユニット全員に大ダメージ' },
  sand:   { name: '時の砂時計', icon: '⏳', col: '#e8c27a', desc: '相手のユニットが4秒間止まる' },
  horn:   { name: '援軍の角笛', icon: '📯', col: '#e0a95e', desc: '攻撃キャラ3体が無料で出撃' },
  thief:  { name: 'どろぼう袋', icon: '🦝', col: '#b48cff', desc: '相手のゴールドをうばう' },
  chest:  { name: 'ふしぎな宝箱', icon: '🎁', col: '#ff9a3c', desc: '中身はどれかひとつ' }
};
const ITEM_ORDER = ['gold', 'potion', 'power', 'shield', 'boots', 'bolt', 'sand', 'horn', 'thief', 'chest'];
// how far toward the map centre a point is from a team's crystal (mines must be at least MINE.front ahead)
function aheadOf(team, x, y) { const c = G.teams[team].crystal, dx = G.W / 2 - c.x, dy = G.H / 2 - c.y, d = Math.hypot(dx, dy) || 1; return ((x - c.x) * dx + (y - c.y) * dy) / d; }
// ---- defenders (towers). nf = which way the picture faces by default (1 right / -1 left / 0 front)
const TT = {
  archer:   { name: 'アーチャー', sn: 'アーチャー', cost: 50,  hp: 140, range: 190, dmg: 16, cd: 0.55, h: 70, nf: 1, desc: '連射できる万能タワー' },
  cannon:   { name: '大砲',       sn: '大砲',       cost: 80,  hp: 190, range: 230, dmg: 46, cd: 1.7, splash: 55, ground: true, h: 58, nf: 1, desc: '地上の敵をまとめて攻撃（空は不可）' },
  ice:      { name: 'アイス',     sn: 'アイス',     cost: 60,  hp: 120, range: 140, slowF: 0.5, dps: 13, h: 60, nf: 0, desc: '近くの敵をゆっくりにする' },
  mage:     { name: 'まほう',     sn: 'まほう',     cost: 100, hp: 130, range: 200, dmg: 24, cd: 1.2, chain: 3, h: 74, nf: 1, desc: '電撃が敵から敵へ飛び移る' },
  wall:     { name: '石壁',       sn: '石壁',       cost: 45,  hp: 380, range: 0, noAtk: true, h: 56, nf: 0, desc: '攻撃しないが硬い。敵の道をふさぐ' },
  ballista: { name: 'バリスタ',   sn: 'バリスタ',   cost: 110, hp: 150, range: 310, dmg: 46, cd: 2.4, h: 62, nf: 1, desc: '遠くまで届く強い一撃（空もOK）' },
  catapult: { name: '投石機',     sn: '投石機',     cost: 120, hp: 170, range: 340, dmg: 52, cd: 3.0, splash: 70, minRange: 100, ground: true, h: 64, nf: 1, desc: '超長射程で範囲攻撃。近くは苦手' },
  fountain: { name: '癒やしの泉', sn: '癒泉',       cost: 90,  hp: 130, range: 130, hps: 11, noAtk: true, h: 60, nf: 0, desc: '近くの防御・罠のHPを回復する' },
  venom:    { name: 'ポイズン',   sn: '毒塔',       cost: 90,  hp: 120, range: 150, dmg: 8, cd: 1.5, poison: 14, poisonT: 3.5, h: 76, nf: 0, desc: '毒で敵をじわじわ弱らせる' },
  flame:    { name: 'フレイム',   sn: '炎塔',       cost: 100, hp: 150, range: 105, dps: 44, h: 76, nf: 0, desc: '近距離でとても強い炎（空もOK）' },
  block:    { name: '障害物',     sn: '障害物',     cost: 25,  hp: 240, range: 0, noAtk: true, h: 50, nf: 0, desc: '安い障害物。敵の道をふさぐ（工兵）' }
};
// ---- traps. kind of trap: one-shot / multi-use (charges) / sustained (hp drains while working)
const TRAPS = {
  spike:  { name: 'とげ罠',   sn: 'とげ',     cost: 30, hp: 40,  h: 34, desc: '踏まれたら大ダメージ→壊れる（1回）' },
  shock:  { name: '電撃罠',   sn: '電撃',     cost: 40, hp: 60,  charges: 3, h: 38, desc: '3回まで感電させる（スタン）→壊れる' },
  fire:   { name: '火の罠',   sn: '火',       cost: 50, hp: 90,  h: 38, desc: '上にいる間ずっと燃やす。耐久が尽きると壊れる' },
  pit:    { name: '落とし穴', sn: '落とし穴', cost: 35, hp: 40,  h: 34, desc: '落ちた敵をしばらく動けなくする（1回・地上のみ）' },
  barrel: { name: '爆弾樽',   sn: '爆弾樽',   cost: 55, hp: 50,  h: 44, desc: '踏むと大爆発（1回・広い範囲）' },
  web:    { name: 'クモの巣', sn: 'クモの巣', cost: 35, hp: 50,  charges: 4, h: 34, desc: '4回まで敵をとても遅くする' },
  bog:    { name: '毒沼',     sn: '毒沼',     cost: 50, hp: 100, h: 34, desc: '上にいる間、毒で削って少し遅くする' },
  freeze: { name: 'フリーズ', sn: '凍結',     cost: 55, hp: 60,  charges: 3, h: 36, desc: '3回まで敵を凍らせて止める' },
  curse:  { name: '呪いのルーン', sn: '呪い', cost: 60, hp: 110, h: 38, desc: '上にいる敵の攻撃力を半分にする' },
  saw:    { name: '回転ノコギリ', sn: 'ノコギリ', cost: 65, hp: 70, charges: 6, h: 40, desc: '6回まで連続でズバズバ切る' }
};
// ---- attackers. ranged = can hit flyers. uagg = distance at which it notices enemy units
// nf = native facing of the picture, phase = passes obstacles and traps (not flying), boom = suicide blast, heal = aura
const UT = {
  slime:    { name: 'スライム', cost: 20, hp: 70, spd: 62, dps: 14, range: 24, passive: true, aggro: 0, uagg: 30, sm: 1, inc: 1, h: 38, fly: false, nf: 0, desc: '最短でクリスタルへ' },
  goblin:   { name: 'ゴブリン', cost: 40, hp: 100, spd: 58, dps: 20, range: 26, aggro: 170, uagg: 110, sm: 1.8, inc: 2, h: 50, fly: false, nf: -1, desc: '建物をこわす' },
  gargoyle: { name: 'ガーゴイル', cost: 60, hp: 85, spd: 80, dps: 16, range: 28, aggro: 120, uagg: 100, sm: 1, inc: 3, h: 52, fly: true, nf: -1, intercept: true, desc: '【迎撃】空から敵ユニットを襲う・障害物を越える' },
  dragon:   { name: 'ドラゴン', cost: 150, hp: 520, spd: 42, dps: 34, range: 80, aggro: 190, uagg: 140, sm: 1.2, splash: 55, inc: 8, h: 78, fly: false, ranged: true, nf: -1, desc: '建物や敵をまとめて燃やす' },
  skeleton: { name: 'スケルトン', cost: 45, hp: 75, spd: 52, dps: 15, range: 125, aggro: 150, uagg: 150, sm: 1.2, inc: 2, h: 52, fly: false, ranged: true, nf: 1, intercept: true, desc: '【迎撃】遠くから矢で敵ユニットを撃つ（空もOK）' },
  orc:      { name: 'オーク', cost: 90, hp: 340, spd: 36, dps: 26, range: 30, aggro: 140, uagg: 110, sm: 2.2, inc: 5, h: 70, fly: false, nf: 1, desc: 'とても頑丈で建物にも強い' },
  ghost:    { name: 'ゴースト', cost: 70, hp: 120, spd: 56, dps: 15, range: 26, aggro: 130, uagg: 110, sm: 1.2, inc: 3, h: 50, fly: false, phase: true, nf: 0, desc: '障害物も罠もすり抜ける' },
  wolf:     { name: 'ウルフ', cost: 50, hp: 90, spd: 112, dps: 14, range: 26, aggro: 110, uagg: 100, sm: 1, inc: 2, h: 52, fly: false, nf: 1, intercept: true, desc: '【迎撃】足が速く、敵の攻撃隊に追いつく' },
  healer:   { name: 'ヒーラー', cost: 65, hp: 80, spd: 50, dps: 4, range: 24, passive: true, aggro: 0, uagg: 30, sm: 1, inc: 3, h: 54, fly: false, heal: { r: 90, hps: 9 }, nf: 1, desc: '近くの味方を回復する' },
  bomber:   { name: 'ボム', cost: 35, hp: 55, spd: 78, dps: 0, range: 30, aggro: 140, uagg: 110, sm: 1, inc: 1, h: 46, fly: false, boom: { r: 62, ds: 150, du: 100 }, nf: 1, intercept: true, desc: '【迎撃】敵の集団に飛びこんで自爆する' }
};
const TOWER_ORDER = ['archer', 'cannon', 'ice', 'mage', 'wall', 'ballista', 'catapult', 'fountain', 'venom', 'flame'];
const TRAP_ORDER = ['spike', 'shock', 'fire', 'pit', 'barrel', 'web', 'bog', 'freeze', 'curse', 'saw'];
const UNIT_ORDER = ['slime', 'goblin', 'gargoyle', 'dragon', 'skeleton', 'orc', 'ghost', 'wolf', 'healer', 'bomber'];
// ---- decks: 5 defenders/traps + 5 attackers (the gold mine is always available)
const DECK_N = 5;
const DECK_PRESETS = [
  { id: 'balance', name: 'バランス型', desc: '攻めも守りも平均的。はじめての人におすすめ', def: ['archer', 'cannon', 'mage', 'ice', 'spike'], atk: ['goblin', 'orc', 'skeleton', 'wolf', 'healer'] },
  { id: 'rush', name: '攻め型', desc: '安いユニットを数で送りこみ、ドラゴンでまとめて焼きはらう', def: ['archer', 'cannon', 'mage', 'spike', 'shock'], atk: ['slime', 'goblin', 'wolf', 'ghost', 'dragon'] },
  { id: 'guard', name: '守り型', desc: 'バリスタと石壁のかたい守り。オークとヒーラーでじわじわ攻める', def: ['archer', 'cannon', 'ballista', 'wall', 'freeze'], atk: ['orc', 'goblin', 'healer', 'skeleton', 'slime'] },
  { id: 'trap', name: '罠型', desc: '罠とアイスで足止めして、タワーでしとめる', def: ['archer', 'mage', 'ice', 'spike', 'barrel'], atk: ['goblin', 'orc', 'ghost', 'skeleton', 'gargoyle'] },
  { id: 'sky', name: '空中型', desc: '空とすり抜けで、障害物や罠を無視して攻める', def: ['archer', 'ballista', 'mage', 'venom', 'web'], atk: ['gargoyle', 'dragon', 'ghost', 'skeleton', 'healer'] }
];
const airOK = k => !!(TT[k] && !TT[k].ground && !TT[k].noAtk);   // defender that can hit flyers
function deckOK(d) { return !!(d && Array.isArray(d.def) && Array.isArray(d.atk) && d.def.length === DECK_N && d.atk.length === DECK_N && d.def.every(k => TT[k] || TRAPS[k]) && d.atk.every(k => UT[k])); }
function copyDeck(d) { return { def: d.def.slice(), atk: d.atk.slice(), name: d.name }; }
const DMULT = [1, 1, 1.45, 2.0], HMULT = [1, 1, 1.4, 1.9];
// ---- team mode settings. start = starting gold of the team safe (bank) and each role's wallet
const TEAM_CFG = { start: { bank: 150, front: 120, back: 160, eng: 100 }, inc: 20, tgtCd: 30, give: [10, 50, 100], wallCost: 30, prep: 30, deckN: 3 };
const COURIER = { cost: 40, type: 'wolf', name: '回収隊' };
// cards each role can choose (3 of them). the engineer always has the wall and the obstacle; the commander has no cards
const ROLE_POOL = { front: UNIT_ORDER.slice(), back: TOWER_ORDER.filter(k => k !== 'wall'), eng: TRAP_ORDER.slice(), cmd: [] };
const ROLE_FIXED = { front: [], back: [], eng: ['wall', 'block'], cmd: ['mine'] };
const ROLE_DEFAULT = { front: ['goblin', 'skeleton', 'orc'], back: ['archer', 'cannon', 'mage'], eng: ['spike', 'freeze', 'barrel'], cmd: [] };
function roleDeckOK(role, cards) { return Array.isArray(cards) && cards.length === TEAM_CFG.deckN && new Set(cards).size === cards.length && cards.every(k => ROLE_POOL[role].indexOf(k) >= 0); }
function roleDeck(role, cards) {
  const c = role === 'cmd' ? [] : roleDeckOK(role, cards) ? cards.slice() : ROLE_DEFAULT[role].slice();
  return role === 'front' ? { def: [], atk: c, cards: c } : { def: c.concat(ROLE_FIXED[role]), atk: [], cards: c };
}
const TUNE = { spurt: 120, spurtInc: 1, spurtCry: 1, spurtTow: 0.5, towerCap: { '1v1': 0, '2v2': 0, '4p': 0, team: 0 }, sendCap: 12, baseInc: 8, cryHp: 1800, hpGrow: 140, towerDmg: 0.8, unitDps: 1.3, uuDps: 1.0, maxTMul: 1, sendMul: 1, startGold: 250, cryMul: { '1v1': 1, '2v2': 0.55, '4p': 1.0, team: 1.6 } };
const hpMult = t => 1 + t / TUNE.hpGrow;
const CPU_CFG = [
  { interval: 2.2, sendP: 0.30, maxT: 8, grow: 55, upP: 0.05, mineP: 0.04 },
  { interval: 1.5, sendP: 0.50, maxT: 14, grow: 38, upP: 0.12, mineP: 0.06 },
  { interval: 1.0, sendP: 0.70, maxT: 22, grow: 26, upP: 0.22, mineP: 0.08 }
];

let G = null;
const cellOf = v => Math.floor(v / CELL);
const hyp = Math.hypot;

function structInfo(type) { return type === 'mine' ? MINE : (TT[type] || TRAPS[type] || null); }
function mineCount(p) { let n = 0; for (const s of G.structs) if (s.kind === 'mine' && !s.dead && s.owner === p.id) n++; return n; }
function mineCost(p) { return MINE.cost + MINE.costStep * mineCount(p); }
function costFor(p, type) { return type === 'mine' ? mineCost(p) : structCost(type); }
function structCost(type) { return (structInfo(type) || {}).cost || 0; }
function upgradeCost(s) { if (s.kind !== 'tower' || s.lvl >= 3) return 0; return Math.round(TT[s.type].cost * (s.lvl === 1 ? 0.7 : 1.0)); }
function sellValue(s) { return Math.floor(s.spent * 0.6); }
function towerRange(s) { return TT[s.type].range * (1 + 0.08 * (s.lvl - 1)); }

function newGame(opts) {
  opts = opts || {};
  const mk = MODES[opts.mode] ? opts.mode : '1v1', map = MAPS[opts.map] ? opts.map : 'forest';
  const seed = opts.seed != null ? opts.seed : ((Math.random() * 1e9) | 0);
  const mp = genMap(mk, map, seed), L = mp.L, M = MODES[mk];
  G = {
    mode: mk, map, seed, W: M.W, H: M.H, GW: mp.GW, GH: mp.GH, blocked: mp.blocked, items: mp.items, L,
    rng: mulberry32(seed ^ 0x9e3779b9), t: 0, teams: [], players: [], structs: [], units: [], effects: [], msgs: [],
    occ: new Array(mp.GW * mp.GH).fill(null), bver: 1, fields: new Map(), costs: [null, null, null, null],
    nextId: 1, speed: 1, over: false, result: null, spectate: !!opts.spectate, attract: !!opts.attract,
    elimCount: 0, item: null, nextItem: ITEM.first, noItems: opts.items === false, prep: opts.prep != null ? opts.prep : PREP, timeLimit: opts.timeLimit || TIME_LIMIT, paths: {}, human: -1
  };
  const nT = M.nTeams;
  for (let i = 0; i < nT; i++) {
    const c = L.crystals[i];
    const cs = { id: G.nextId++, kind: 'crystal', type: 'crystal', team: i, owner: -1, x: c.x, y: c.y, r: CRY_R, hp: Math.round(TUNE.cryHp * TUNE.cryMul[mk]), max: Math.round(TUNE.cryHp * TUNE.cryMul[mk]), cx: cellOf(c.x), cy: cellOf(c.y), lvl: 1, spent: 0 };
    G.teams.push({ id: i, color: TEAM_COLORS[mk === '4p' ? i : i], name: TEAM_NAMES[i], crystal: cs, alive: true, elimAt: -1, elimOrder: 0, players: [], bank: 0, target: -1, tgtNext: 0, cmd: -1 });
    G.structs.push(cs);
  }
  const levels = opts.levels || [];
  for (let i = 0; i < M.nPlayers; i++) {
    const team = L.teamOfPlayer[i];
    const TM = mk === 'team', role = TM ? ROLES[i & 3] : null;
    const human = TM ? !!(opts.humans && opts.humans[i]) : !G.spectate && i === 0;
    const p = {
      id: i, team, human, name: human ? 'あなた' : 'CPU' + i, zone: L.zones[i], gold: TUNE.startGold, bonus: 0, lane: (L.lanes && L.lanes.length === 3) ? 1 : i % 2,
      target: -1, level: levels[i] != null ? levels[i] : (opts.cpuLevel != null ? opts.cpuLevel : 1),
      st: { sent: 0, built: 0, dmg: 0, structDmg: 0, kills: 0, lost: 0 }, cpu: { timer: 1 + G.rng() * 2 }
    };
    if (TM) {
      p.role = role; p.name = TEAM_NAMES[team] + 'の' + ROLE_NAMES[role]; p.gold = TEAM_CFG.start[role] || 0;
      if (role === 'cmd') {   // the commander spends straight out of the team safe
        G.teams[team].cmd = i; G.teams[team].bank = TEAM_CFG.start.bank;
        Object.defineProperty(p, 'gold', { get() { return G.teams[team].bank; }, set(v) { G.teams[team].bank = v; }, enumerable: true });
      }
    }
    if (human && G.human < 0) G.human = i;
    G.players.push(p); G.teams[team].players.push(i);
  }
  for (const p of G.players) p.target = firstEnemyTeam(p.team);
  const dk = opts.decks || [];
  for (const p of G.players) p.deck = mk === 'team' ? roleDeck(p.role, dk[p.id]) : deckOK(dk[p.id]) ? copyDeck(dk[p.id]) : copyDeck(DECK_PRESETS[(G.rng() * DECK_PRESETS.length) | 0]);
  if (mk === 'team') for (const t of G.teams) t.target = firstEnemyTeam(t.id);
  return G;
}
function firstEnemyTeam(team, fx, fy) {
  const me = G.teams[team].crystal; let best = -1, bd = 1e12;
  for (const t of G.teams) {
    if (t.id === team || !t.alive) continue;
    const d = hyp(t.crystal.x - (fx != null ? fx : me.x), t.crystal.y - (fy != null ? fy : me.y));
    if (d < bd - 1e-6) { bd = d; best = t.id; }
  }
  return best;
}
function towMul() { return inSpurt() ? TUNE.spurtTow : 1; }
function inSpurt() { return TUNE.spurt > 0 && G.t >= G.timeLimit - TUNE.spurt; }
function roleP(team, role) { return G.players[team * 4 + ROLES.indexOf(role)]; }
function teamIncome(t) { const tm = G.teams[t], f = roleP(t, 'front'), c = roleP(t, 'cmd'); return (TEAM_CFG.inc + Math.min(TUNE.sendCap, f.bonus) + mineCount(c) * MINE.inc) * (inSpurt() ? TUNE.spurtInc : 1); }
function income(p) { return (TUNE.baseInc + Math.min(TUNE.sendCap, p.bonus) + mineCount(p) * MINE.inc) * (inSpurt() ? TUNE.spurtInc : 1); }
function towerCount(p) { let n = 0; for (const s of G.structs) if (s.kind === 'tower' && !s.dead && s.owner === p.id) n++; return n; }
function towerCap() { return TUNE.towerCap[G.mode] || 0; }

function msg(text, col) { G.msgs.push({ text, col: col || '#fff', t: G.t }); if (G.msgs.length > 6) G.msgs.shift(); }
function fx(o) { if (G.effects.length < 260) { o.t = 0; G.effects.push(o); } }

// ---------- pathing helpers ----------
function costArr(team) {
  let c = G.costs[team];
  if (c && c.ver === G.bver) return c.arr;
  const arr = new Float32Array(G.GW * G.GH).fill(1);
  for (const s of G.structs) if (s.kind === 'tower' && !s.dead && s.team !== team) arr[s.cy * G.GW + s.cx] = G.mode === 'team' && TT[s.type].noAtk ? TEAM_CFG.wallCost : 14;
  G.costs[team] = { ver: G.bver, arr };
  return arr;
}
function getField(team, cx, cy) {
  const key = team + ':' + cx + ':' + cy;
  let f = G.fields.get(key);
  if (f && f.ver === G.bver) return f.dist;
  const dist = makeField(G.blocked, G.GW, G.GH, costArr(team), cx, cy);
  G.fields.set(key, { ver: G.bver, dist });
  if (G.fields.size > 80) { const k0 = G.fields.keys().next().value; G.fields.delete(k0); }
  return dist;
}
function nearestFree(x, y) {
  const cx0 = cellOf(x), cy0 = cellOf(y);
  for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const cx = cx0 + dx, cy = cy0 + dy;
    if (cx < 0 || cy < 0 || cx >= G.GW || cy >= G.GH) continue;
    if (!G.blocked[cy * G.GW + cx]) return [cx * CELL + CELL / 2, cy * CELL + CELL / 2];
  }
  return [x, y];
}
function flips(team) { const c = G.teams[team].crystal; return [c.x > G.W / 2 ? -1 : 1, c.y > G.H / 2 + 1 ? -1 : 1]; }
function spawnPos(team) {
  const c = G.teams[team].crystal, mx = G.W / 2 - c.x, my = G.H / 2 - c.y, d = hyp(mx, my) || 1;
  return nearestFree(c.x + mx / d * 72, c.y + my / d * 72);
}

// ---------- structures ----------
function inZone(p, x, y) { const z = p.zone; return x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1; }
function buildReason(p, type, cx, cy) {
  if (G.over) return 'over';
  if (!structInfo(type)) return 'type';
  if (cx < 0 || cy < 0 || cx >= G.GW || cy >= G.GH) return 'range';
  const x = cx * CELL + CELL / 2, y = cy * CELL + CELL / 2;
  if (!inZone(p, x, y)) return 'zone';
  if (G.mode === '2v2' && Math.abs(y - G.H / 2) < 1) return 'zone';
  if (G.blocked[cy * G.GW + cx]) return 'blocked';
  if (G.occ[cy * G.GW + cx]) return 'occupied';
  for (const t of G.teams) if (hyp(x - t.crystal.x, y - t.crystal.y) < 92) return 'crystal';
  if (p.deck && (type !== 'mine' || G.mode === 'team') && p.deck.def.indexOf(type) < 0) return 'deck';
  if (TT[type] && towerCap() && towerCount(p) >= towerCap()) return 'tcap';
  if (type === 'mine') {
    if (mineCount(p) >= MINE.max) return 'mmax';
    if (aheadOf(p.team, x, y) < MINE.front) return 'mfar';
  }
  if (p.gold < costFor(p, type)) return 'gold';
  return null;
}
function buildStruct(p, type, cx, cy) {
  const r = buildReason(p, type, cx, cy); if (r) return r;
  const isTower = !!TT[type], isMine = type === 'mine', info = structInfo(type), cost = costFor(p, type);
  const s = {
    id: G.nextId++, kind: isTower ? 'tower' : isMine ? 'mine' : 'trap', type, team: p.team, owner: p.id, cx, cy,
    x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2, r: isTower || isMine ? 18 : 14, hp: info.hp, max: info.hp, lvl: 1,
    cd: 0, charges: info.charges || 0, spent: cost, dead: false, born: G.t,
    face: G.teams[p.team].crystal.x > G.W / 2 ? -1 : 1
  };
  p.gold -= cost; p.st.built++;
  G.structs.push(s); G.occ[cy * G.GW + cx] = s;
  if (isTower) G.bver++;
  fx({ k: 'ring', x: s.x, y: s.y, r: 30, dur: 0.35, col: '#fff' });
  return null;
}
function upgradeStruct(p, s) {
  if (!s || s.dead || s.owner !== p.id || s.kind !== 'tower' || s.lvl >= 3) return 'x';
  const c = upgradeCost(s); if (p.gold < c) return 'gold';
  p.gold -= c; s.spent += c;
  const ratio = s.hp / s.max; s.lvl++; s.max = Math.round(TT[s.type].hp * HMULT[s.lvl]); s.hp = Math.max(s.hp, s.max * ratio);
  fx({ k: 'ring', x: s.x, y: s.y, r: 40, dur: 0.5, col: '#ffd23f' });
  return null;
}
function sellStruct(p, s) {
  if (!s || s.dead || s.owner !== p.id || s.kind === 'crystal') return 'x';
  p.gold += sellValue(s); removeStruct(s);
  return null;
}
function removeStruct(s) {
  s.dead = true; s.hp = 0; G.occ[s.cy * G.GW + s.cx] = null;
  if (s.kind === 'tower') G.bver++;
}
function destroyStruct(s, byUnit) {
  if (s.dead) return;
  const owner = G.players[s.owner];
  if (s.kind === 'crystal') {
    s.dead = true; s.hp = 0; fx({ k: 'burst', x: s.x, y: s.y, dur: 1.0, big: true }); eliminateTeam(s.team); return;
  }
  removeStruct(s);
  if (owner) owner.st.lost++;
  fx({ k: 'burst', x: s.x, y: s.y - 10, dur: 0.7 });
  fx({ k: 'text', x: s.x, y: s.y - 34, dur: 0.9, text: '破壊!' });
  if (s.kind === 'mine' && owner) msg(owner.name + 'の金鉱がこわされた！', '#ffd23f');
}
function damageStruct(s, dmg, u) {
  if (s.dead || s.hp <= 0) return;
  if (s.kind !== 'crystal') { const op = G.players[s.owner]; if (op && op.bDef > G.t) dmg *= 0.5; }
  else if (inSpurt()) dmg *= TUNE.spurtCry;
  s.hp -= dmg;
  if (s.kind === 'crystal') s.lastHit = G.t;
  if (u) { const o = G.players[u.owner]; if (o) o.st.structDmg += dmg; }
  if (s.hp <= 0) destroyStruct(s, u);
}
function eliminateTeam(tid) {
  const tm = G.teams[tid]; if (!tm.alive) return;
  tm.alive = false; tm.elimAt = G.t; tm.elimOrder = ++G.elimCount;
  msg(tm.name + 'のクリスタルが壊れた！', tm.color);
  for (const s of G.structs) if (s.team === tid && !s.dead && s.kind !== 'crystal') {
    removeStruct(s); fx({ k: 'burst', x: s.x, y: s.y - 10, dur: 0.6 });
  }
  for (const u of G.units) if (u.team === tid) u.dead = true;
  G.bver++;
}

// ---------- units ----------
function targetTeamOf(p) {
  if (G.mode === 'team') { const tm = G.teams[p.team]; if (tm.target >= 0 && tm.target !== p.team && G.teams[tm.target].alive) return tm.target; return firstEnemyTeam(p.team); }
  if (G.mode !== '4p') return G.teams.find(t => t.id !== p.team && t.alive) ? G.teams.find(t => t.id !== p.team && t.alive).id : -1;
  if (p.target >= 0 && p.target !== p.team && G.teams[p.target].alive) return p.target;
  return firstEnemyTeam(p.team);
}
function laneWps(team, lane) {
  const left = G.teams[team].crystal.x < G.W / 2, fr = left ? [0.28, 0.5, 0.72] : [0.72, 0.5, 0.28], out = [];
  for (const f of fr) { const [wx, wy] = nearestFree(G.W * f, G.L.lanes[lane]); out.push({ x: wx, y: wy, cx: cellOf(wx), cy: cellOf(wy) }); }
  return out;
}
function itemSpots() {
  const L = G.L, W = G.W, H = G.H;
  if (G.mode === '1v1') return [{ x: W / 2, y: L.lanes[0], label: '上ルート', lane: 0 }, { x: W / 2, y: H / 2, label: '中央', lane: 1 }, { x: W / 2, y: L.lanes[2], label: '下ルート', lane: 2 }];
  if (G.mode === '2v2') return [{ x: W / 2, y: L.lanes[0], label: '上ルート', lane: 0 }, { x: W / 2, y: L.lanes[1], label: '下ルート', lane: 1 }];
  return [{ x: W / 2, y: H / 2, label: 'マップの中央', lane: null }];
}
function itemGoals(it) {   // per team: free cell nearest the item (ties broken toward that team) + pickup radius that reaches it
  it.tg = []; let far = 0;
  for (const t of G.teams) {
    const c = t.crystal; let best = null, bs = 1e9;
    const cx0 = cellOf(it.x), cy0 = cellOf(it.y);
    for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
      const cx = cx0 + dx, cy = cy0 + dy; if (cx < 0 || cy < 0 || cx >= G.GW || cy >= G.GH || G.blocked[cy * G.GW + cx]) continue;
      const x = cx * CELL + CELL / 2, y = cy * CELL + CELL / 2, sc = hyp(x - it.x, y - it.y) + 0.15 * hyp(x - c.x, y - c.y);
      if (sc < bs) { bs = sc; best = { cx, cy, x, y }; }
    }
    if (!best) best = { cx: cx0, cy: cy0, x: it.x, y: it.y };
    it.tg[t.id] = best; far = Math.max(far, hyp(best.x - it.x, best.y - it.y));
  }
  it.pickR = Math.max(40, far + 30);
}
function itemNear(u) { const it = G.item; return it && it.state === 'live' && hyp(u.x - it.x, u.y - it.y) < ITEM.detour + it.pickR ? it : null; }
function updateItems() {
  if (G.noItems || G.over) return;
  if (!G.item && G.t >= G.nextItem - ITEM.warn) {
    const sp = itemSpots(), spot = sp[(G.rng() * sp.length) | 0];
    G.item = Object.assign({ id: G.nextId++, state: 'warn', at: G.nextItem }, spot); itemGoals(G.item);
    msg('まもなく' + spot.label + 'にアイテム出現！', '#ffe14a');
  }
  const it = G.item; if (!it) return;
  if (it.state === 'warn' && G.t >= it.at) {
    it.state = 'live'; it.type = ITEM_ORDER[(G.rng() * ITEM_ORDER.length) | 0]; it.until = G.t + ITEM.life; G.nextItem += ITEM.every;
    fx({ k: 'ring', x: it.x, y: it.y, r: 60, dur: 0.6, col: ITEMS[it.type].col });
    return;
  }
  if (it.state !== 'live') return;
  if (G.t >= it.until) { G.item = null; msg('アイテムは消えてしまった…', '#aab3cc'); return; }
  for (const u of G.units) if (!u.dead && hyp(u.x - it.x, u.y - it.y) < it.pickR) { const p = G.players[u.owner]; G.item = null; applyItem(p, it.type, it); return; }
}
function applyItem(p, type, it) {
  const TM = G.mode === 'team', mates = TM ? G.players.filter(q => q.team === p.team) : [p];
  if (TM) p = roleP(p.team, 'cmd');   // gold goes into the team safe; buffs work for the whole team
  let t = type; const chest = t === 'chest';
  if (chest) { const ks = ITEM_ORDER.filter(k => k !== 'chest'); t = ks[(G.rng() * ks.length) | 0]; }
  const I = ITEMS[t]; p.st.items = (p.st.items || 0) + 1;
  let extra = '';
  if (t === 'gold') p.gold += ITEM.gold;
  else if (t === 'potion') {
    for (const u of G.units) if (!u.dead && (TM ? u.team === p.team : u.owner === p.id)) { u.hp = u.max; fx({ k: 'plus', x: u.x, y: u.y - 30, dur: 0.7 }); }
    for (const s of G.structs) if (!s.dead && (TM ? s.team === p.team : s.owner === p.id) && s.kind !== 'crystal') s.hp = Math.min(s.max, s.hp + s.max * 0.5);
  }
  else if (t === 'power') mates.forEach(q => q.bAtk = G.t + ITEM.buff);
  else if (t === 'shield') mates.forEach(q => q.bDef = G.t + ITEM.buff);
  else if (t === 'boots') mates.forEach(q => q.bSpd = G.t + ITEM.buff);
  else if (t === 'bolt') { for (const u of G.units) if (!u.dead && hostileTeam(p.team, u.team)) { fx({ k: 'bolt', x: u.x + 30, y: u.y - 320, x2: u.x, y2: u.y - 10, dur: 0.35 }); dmgUnit(u, u.max * ITEM.bolt, p); } }
  else if (t === 'sand') { for (const u of G.units) if (!u.dead && hostileTeam(p.team, u.team)) { u.stun = Math.max(u.stun, ITEM.sand); u.stunK = 'sand'; } }
  else if (t === 'horn') {
    const hp = TM ? roleP(p.team, 'front') : p, ks = hp.deck && hp.deck.atk.length ? hp.deck.atk : UNIT_ORDER;
    for (let i = 0; i < ITEM.horn; i++) { const k = ks[(G.rng() * ks.length) | 0]; hp.gold += UT[k].cost; if (sendUnit(hp, k)) hp.gold -= UT[k].cost; }
  }
  else if (t === 'thief') {
    const vs = G.players.filter(v => hostileTeam(p.team, v.team)); let got = 0;
    for (const v of vs) { const take = Math.min(v.gold, ITEM.steal / Math.max(1, vs.length)); v.gold -= take; got += take; }
    p.gold += got; extra = '（' + Math.round(got) + 'G）';
  }
  msg((TM ? TEAM_NAMES[p.team] + 'チーム' : p.name) + (chest ? 'の宝箱から ' : 'が ') + I.icon + I.name + '！', I.col);
  msg(I.desc + extra, I.col);
  fx({ k: 'text', x: it.x, y: it.y - 30, dur: 1.2, text: I.icon + I.name });
  fx({ k: 'ring', x: it.x, y: it.y, r: 70, dur: 0.5, col: I.col });
}
function sendUnit(p, type) {
  const T = UT[type]; if (!T || G.over) return 'x';
  if (!G.teams[p.team].alive) return 'dead';
  if (p.deck && p.deck.atk.indexOf(type) < 0) return 'deck';
  if (G.t < G.prep) return 'prep';
  if (p.gold < T.cost) return 'gold';
  const dest = targetTeamOf(p); if (dest < 0) return 'x';
  p.gold -= T.cost; p.bonus = Math.min(TUNE.sendCap, p.bonus + T.inc); p.st.sent++;
  const [sx, sy] = spawnPos(p.team), j = () => (G.rng() - 0.5) * 36;
  const m = hpMult(G.t);
  const u = {
    id: G.nextId++, type, team: p.team, owner: p.id, x: sx + j(), y: sy + j(), hp: T.hp * m, max: T.hp * m, fly: T.fly,
    dest, tgt: null, utgt: null, chase: false, rt: G.rng() * 0.3, stun: 0, stunK: null, slowT: 0, slowF: 1, weakT: 0, poT: 0, poDps: 0, poOwner: p.id,
    phase: !!T.phase, face: G.teams[p.team].crystal.x > G.W / 2 ? -1 : 1, atk: 0, dead: false, wp: null, born: G.t
  };
  if (G.L.lanes && !T.fly && !T.phase && G.L.lanes[p.lane] != null) {
    const q = laneWps(p.team, p.lane); u.wp = q.shift(); u.wq = q;
  }
  G.units.push(u);
  return null;
}
function hostileTeam(a, b) { return a !== b && G.teams[b].alive; }
function tick(rate, dt) { return ((G.t * rate) | 0) !== (((G.t - dt) * rate) | 0); }
function lineClear(x0, y0, x1, y1) {
  const d = hyp(x1 - x0, y1 - y0), n = Math.ceil(d / 18);
  for (let i = 1; i < n; i++) {
    const f = i / n, cx = cellOf(x0 + (x1 - x0) * f), cy = cellOf(y0 + (y1 - y0) * f);
    if (G.blocked[cy * G.GW + cx]) return false;
  }
  return true;
}
function canHit(T, o) { return !o.fly || !!T.fly || !!T.ranged; }   // melee ground units cannot reach flyers
function acquireUnitTarget(u, T) {
  const eng = T.uagg || 100, cur = u.utgt;
  if (cur && !cur.dead && cur.hp > 0 && canHit(T, cur) && hyp(cur.x - u.x, cur.y - u.y) <= eng * 1.35) return cur;
  let best = null, bd = eng;
  const free = u.fly || u.phase;
  for (const o of G.units) {
    if (o.dead || o.team === u.team || !hostileTeam(u.team, o.team) || !canHit(T, o)) continue;
    if (!T.intercept && o.utgt !== u) continue;   // attackers ignore enemy units unless that unit is attacking them
    const d = hyp(o.x - u.x, o.y - u.y);
    if (d >= bd) continue;
    if (d > T.range + 14 && !free && !lineClear(u.x, u.y, o.x, o.y)) continue;
    bd = d; best = o;
  }
  return best;
}
function acquire(u, T) {
  // keep current target while it stays in reach
  if (u.tgt && !u.tgt.dead && u.tgt.hp > 0) {
    const d = hyp(u.tgt.x - u.x, u.tgt.y - u.y) - u.tgt.r;
    if (d <= T.range) return;
  }
  let best = null, bs = 1e9, chase = false;
  const lim = T.passive ? 0 : Math.max(T.range, T.aggro);
  const free = u.fly || u.phase;
  for (const s of G.structs) {
    if (s.dead || s.hp <= 0 || !hostileTeam(u.team, s.team)) continue;
    const d = hyp(s.x - u.x, s.y - u.y) - s.r;
    if (T.passive) {
      if (!(s.kind === 'crystal' && d <= T.range)) continue;
    } else {
      if (d > lim) continue;
      if (d > T.range && !free && !lineClear(u.x, u.y, s.x, s.y)) continue;
    }
    const sc = d - (s.kind === 'crystal' ? 60 : 0);
    if (sc < bs) { bs = sc; best = s; chase = d > T.range; }
  }
  u.tgt = best; u.chase = chase;
}
function moveStraight(u, tx, ty, step) {
  const dx = tx - u.x, dy = ty - u.y, d = hyp(dx, dy);
  if (d < 0.001) return;
  if (Math.abs(dx) > 0.2) u.face = dx < 0 ? -1 : 1;
  const m = Math.min(step, d);
  u.x += dx / d * m; u.y += dy / d * m;
}
function explode(u) {
  const T = UT[u.type], B = T.boom, p = G.players[u.owner];
  fx({ k: 'boom', x: u.x, y: u.y, r: B.r, dur: 0.4, col: '#ff7a1a' });
  fx({ k: 'burst', x: u.x, y: u.y - 8, dur: 0.5 });
  for (const s of G.structs) if (!s.dead && s.hp > 0 && hostileTeam(u.team, s.team) && hyp(s.x - u.x, s.y - u.y) - s.r < B.r) damageStruct(s, B.ds, u);
  for (const o of G.units) if (!o.dead && o.team !== u.team && !o.fly && hyp(o.x - u.x, o.y - u.y) < B.r) dmgUnit(o, B.du, p);
  u.dead = true;
}
function updateUnit(u, dt) {
  const T = UT[u.type], pl = G.players[u.owner];
  if (u.poT > 0) { u.poT -= dt; dmgUnit(u, u.poDps * dt, G.players[u.poOwner]); if (u.dead) return; }
  if (u.weakT > 0) u.weakT -= dt;
  if (u.stun > 0) { u.stun -= dt; return; }
  if (u.slowT > 0) u.slowT -= dt; else u.slowF = 1;
  if (u.atk > 0) u.atk -= dt;
  if (u.cour) {   // item runner: heads straight for the item and ignores fights until it is gone
    const it = G.item;
    if (it && it.tg && G.teams[u.team].alive) {
      const step = T.spd * SPEEDK * (u.slowT > 0 ? u.slowF : 1) * dt, g = it.tg[u.team];
      if (hyp(u.x - it.x, u.y - it.y) < it.pickR * 0.8) return;
      let cx = Math.max(0, Math.min(G.GW - 1, cellOf(u.x))), cy = Math.max(0, Math.min(G.GH - 1, cellOf(u.y)));
      if (cx === g.cx && cy === g.cy) { moveStraight(u, it.x, it.y, step); return; }
      const fl = flips(u.team);
      if (bestNeighbor(getField(u.team, g.cx, g.cy), G.blocked, G.GW, G.GH, cx, cy, fl[0], fl[1])) moveStraight(u, bnx * CELL + CELL / 2, bny * CELL + CELL / 2, step);
      else moveStraight(u, it.x, it.y, step);
      return;
    }
    u.cour = false;
  }
  if (T.heal) {
    let any = false;
    for (const o of G.units) if (o !== u && !o.dead && o.team === u.team && o.hp < o.max && hyp(o.x - u.x, o.y - u.y) < T.heal.r) { o.hp = Math.min(o.max, o.hp + T.heal.hps * dt); any = true; }
    if (any && tick(2, dt)) fx({ k: 'plus', x: u.x, y: u.y - 30, dur: 0.6 });
  }
  if (u.tgt && (u.tgt.dead || u.tgt.hp <= 0)) u.tgt = null;
  if (u.utgt && (u.utgt.dead || u.utgt.hp <= 0)) u.utgt = null;
  u.rt -= dt;
  if (u.rt <= 0) {
    u.rt = 0.25 + G.rng() * 0.1;
    u.utgt = acquireUnitTarget(u, T);
    if (u.utgt) u.tgt = null; else acquire(u, T);
  }
  const weak = (u.weakT > 0 ? 0.5 : 1) * (pl && pl.bAtk > G.t ? 1.5 : 1);
  const step = T.spd * SPEEDK * (u.slowT > 0 ? u.slowF : 1) * (pl && pl.bSpd > G.t ? 1.5 : 1) * dt;
  // ---- fight an enemy unit
  if (u.utgt) {
    const o = u.utgt, d = hyp(o.x - u.x, o.y - u.y) - 8;
    if (d <= T.range) {
      if (Math.abs(o.x - u.x) > 0.5) u.face = o.x < u.x ? -1 : 1;
      u.atk = 0.2;
      if (T.boom) { explode(u); return; }
      const dmg = T.dps * TUNE.uuDps * weak * dt;
      dmgUnit(o, dmg, pl);
      if (T.splash) {
        for (const v of G.units) if (v !== o && !v.dead && v.team !== u.team && hyp(v.x - o.x, v.y - o.y) < T.splash) dmgUnit(v, dmg * 0.5, pl);
        if (tick(7, dt)) fx({ k: 'flame', x: u.x, y: u.y - 20, x2: o.x, y2: o.y - 10, dur: 0.18 });
      } else if (T.ranged && tick(2.5, dt)) fx({ k: 'arrow', x: u.x, y: u.y - 22, x2: o.x, y2: o.y - 12, dur: 0.14 });
      return;
    }
    moveStraight(u, o.x, o.y, step); return;
  }
  // ---- attack a structure
  if (u.tgt) {
    const s = u.tgt, d = hyp(s.x - u.x, s.y - u.y) - s.r;
    if (d <= T.range) {
      if (Math.abs(s.x - u.x) > 0.5) u.face = s.x < u.x ? -1 : 1;
      u.atk = 0.2;
      if (T.boom) { explode(u); return; }
      const dmg = T.dps * TUNE.unitDps * weak * (s.kind === 'crystal' ? 1 : T.sm) * dt;
      damageStruct(s, dmg, u);
      if (T.splash) {
        for (const o of G.structs) if (o !== s && !o.dead && o.hp > 0 && hostileTeam(u.team, o.team) && hyp(o.x - s.x, o.y - s.y) < T.splash) damageStruct(o, dmg * 0.5, u);
        if (tick(7, dt)) fx({ k: 'flame', x: u.x, y: u.y - 20, x2: s.x, y2: s.y, dur: 0.18 });
      } else if (T.ranged && tick(2.5, dt)) fx({ k: 'arrow', x: u.x, y: u.y - 22, x2: s.x, y2: s.y - 12, dur: 0.14 });
      return;
    }
    if (u.chase) { moveStraight(u, s.x, s.y, step); return; }
    u.tgt = null;
  }
  // ---- route
  let dt0 = G.teams[u.dest];
  if (!dt0.alive) { const n = firstEnemyTeam(u.team, u.x, u.y); if (n < 0) return; u.dest = n; dt0 = G.teams[n]; u.wp = null; }
  const dest = dt0.crystal;
  const itn = itemNear(u);
  if (u.fly || u.phase) { moveStraight(u, itn ? itn.x : dest.x, itn ? itn.y : dest.y, step); return; }
  let cx = cellOf(u.x), cy = cellOf(u.y);
  cx = Math.max(0, Math.min(G.GW - 1, cx)); cy = Math.max(0, Math.min(G.GH - 1, cy));
  if (G.blocked[cy * G.GW + cx]) { const [fx2, fy2] = nearestFree(u.x, u.y); u.x = fx2; u.y = fy2; return; }
  if (u.wp && hyp(u.x - u.wp.x, u.y - u.wp.y) < 70) u.wp = null;
  if (!u.wp && u.wq && u.wq.length) u.wp = u.wq.shift();
  const itg = itn && itn.tg[u.team];
  const field = itg ? getField(u.team, itg.cx, itg.cy) : u.wp ? getField(u.team, u.wp.cx, u.wp.cy) : getField(u.team, dest.cx, dest.cy);
  const fl = flips(u.team);
  if (bestNeighbor(field, G.blocked, G.GW, G.GH, cx, cy, fl[0], fl[1])) {
    const nx = bnx, ny = bny, o = G.occ[ny * G.GW + nx];
    if (o && o.kind === 'tower' && o.team !== u.team && !o.dead) { u.tgt = o; u.chase = true; return; }
    moveStraight(u, nx * CELL + CELL / 2, ny * CELL + CELL / 2, step);
  } else if (u.wp) { u.wp = null; }
}

// ---------- towers / traps ----------
function dmgUnit(u, amount, p) {
  if (u.dead) return 0;
  { const op = G.players[u.owner]; if (op && op.bDef > G.t) amount *= 0.5; }
  u.hp -= amount;
  if (p) p.st.dmg += amount;
  if (u.hp <= 0) { u.dead = true; if (p) p.st.kills++; fx({ k: 'puff', x: u.x, y: u.y, dur: 0.4 }); }
  return amount;
}
// gl: 0 = everything, 1 = no flyers, 2 = no flyers and no phasing units (ground traps)
function nearestHostileUnit(team, x, y, range, gl, skip, minR) {
  let best = null, bd = range;
  for (const u of G.units) {
    if (u.dead || u.team === team) continue;
    if (gl >= 1 && u.fly) continue;
    if (gl >= 2 && u.phase) continue;
    if (skip && skip.has(u)) continue;
    const d = hyp(u.x - x, u.y - y);
    if (d < bd && d >= (minR || 0)) { bd = d; best = u; }
  }
  return best;
}
function updateTower(s, dt) {
  const T = TT[s.type], p = G.players[s.owner], lv = s.lvl;
  if (s.type === 'wall') return;
  if (s.type === 'fountain') {
    const R = towerRange(s), hh = T.hps * DMULT[lv] * dt; let any = false;
    for (const o of G.structs) if (o !== s && !o.dead && o.team === s.team && o.kind !== 'crystal' && o.hp < o.max && hyp(o.x - s.x, o.y - s.y) < R) { o.hp = Math.min(o.max, o.hp + hh); any = true; }
    if (any && tick(2, dt)) fx({ k: 'plus', x: s.x, y: s.y - 30, dur: 0.7 });
    return;
  }
  if (s.type === 'ice') {
    const R = towerRange(s);
    for (const u of G.units) {
      if (u.dead || u.team === s.team) continue;
      if (hyp(u.x - s.x, u.y - s.y) < R) { u.slowF = u.slowT > 0 ? Math.min(u.slowF, T.slowF) : T.slowF; u.slowT = 0.25; dmgUnit(u, T.dps * DMULT[lv] * dt, p); }
    }
    return;
  }
  if (s.type === 'flame') {
    const tgt = nearestHostileUnit(s.team, s.x, s.y, towerRange(s), 0);
    if (!tgt) return;
    s.face = tgt.x < s.x ? -1 : 1;
    const dm = T.dps * DMULT[lv] * TUNE.towerDmg * towMul() * dt;
    dmgUnit(tgt, dm, p);
    for (const o of G.units) if (o !== tgt && !o.dead && o.team !== s.team && hyp(o.x - tgt.x, o.y - tgt.y) < 40) dmgUnit(o, dm * 0.5, p);
    if (tick(7, dt)) fx({ k: 'flame', x: s.x, y: s.y - 36, x2: tgt.x, y2: tgt.y - 8, dur: 0.16 });
    return;
  }
  s.cd -= dt; if (s.cd > 0) return;
  const R = towerRange(s), tgt = nearestHostileUnit(s.team, s.x, s.y, R, T.ground ? 1 : 0, null, T.minRange);
  if (!tgt) return;
  s.face = tgt.x < s.x ? -1 : 1;
  s.cd = T.cd; const dm = T.dmg * DMULT[lv] * TUNE.towerDmg * towMul();
  if (s.type === 'archer') {
    dmgUnit(tgt, dm, p); fx({ k: 'arrow', x: s.x, y: s.y - 28, x2: tgt.x, y2: tgt.y - 10, dur: 0.12 });
  } else if (s.type === 'ballista') {
    dmgUnit(tgt, dm, p); fx({ k: 'arrow', x: s.x, y: s.y - 24, x2: tgt.x, y2: tgt.y - 10, dur: 0.18, thick: true });
  } else if (s.type === 'cannon' || s.type === 'catapult') {
    for (const u of G.units) if (!u.dead && u.team !== s.team && !u.fly) {
      const d = hyp(u.x - tgt.x, u.y - tgt.y); if (d < T.splash) dmgUnit(u, d < 8 ? dm : dm * 0.6, p);
    }
    fx({ k: 'boom', x: tgt.x, y: tgt.y, r: T.splash, dur: 0.3, col: s.type === 'cannon' ? '#ffb347' : '#c9a36a' });
    fx({ k: 'arrow', x: s.x, y: s.y - 20, x2: tgt.x, y2: tgt.y, dur: s.type === 'cannon' ? 0.1 : 0.2, thick: true });
  } else if (s.type === 'venom') {
    dmgUnit(tgt, dm, p);
    tgt.poT = T.poisonT; tgt.poDps = T.poison * DMULT[lv] * TUNE.towerDmg * towMul(); tgt.poOwner = s.owner;
    fx({ k: 'arrow', x: s.x, y: s.y - 40, x2: tgt.x, y2: tgt.y - 10, dur: 0.16, col: '#8be03a' });
    fx({ k: 'boom', x: tgt.x, y: tgt.y, r: 26, dur: 0.3, col: '#8be03a' });
  } else if (s.type === 'mage') {
    const hit = new Set([tgt]); let cur = tgt, d0 = dm; dmgUnit(cur, d0, p);
    fx({ k: 'bolt', x: s.x, y: s.y - 34, x2: cur.x, y2: cur.y - 10, dur: 0.18 });
    for (let i = 1; i < T.chain; i++) {
      const nx = nearestHostileUnit(s.team, cur.x, cur.y, 110, 0, hit); if (!nx) break;
      d0 *= 0.7; dmgUnit(nx, d0, p); hit.add(nx);
      fx({ k: 'bolt', x: cur.x, y: cur.y - 10, x2: nx.x, y2: nx.y - 10, dur: 0.18 }); cur = nx;
    }
  }
}
function updateTrap(s, dt) {
  const p = G.players[s.owner], tm = s.team;
  const near = (d, skip) => nearestHostileUnit(tm, s.x, s.y, d, 2, skip);
  const each = (d, f) => { for (const v of G.units) if (!v.dead && v.team !== tm && !v.fly && !v.phase && hyp(v.x - s.x, v.y - s.y) < d) f(v); };
  const wear = (rate) => { s.hp -= rate * dt; if (s.hp <= 0) destroyStruct(s, null); };
  const t = s.type;
  if (t === 'spike') {
    if (!near(32)) return;
    each(72, v => dmgUnit(v, 85, p));
    fx({ k: 'boom', x: s.x, y: s.y, r: 72, dur: 0.35, col: '#ffd23f' });
    destroyStruct(s, null);
  } else if (t === 'pit') {
    if (!near(26)) return;
    each(34, v => { dmgUnit(v, 70, p); v.stun = Math.max(v.stun, 1.8); v.stunK = 'pit'; });
    fx({ k: 'boom', x: s.x, y: s.y, r: 34, dur: 0.4, col: '#8a6a44' });
    destroyStruct(s, null);
  } else if (t === 'barrel') {
    if (!near(30)) return;
    for (const v of G.units) if (!v.dead && v.team !== tm && !v.fly && hyp(v.x - s.x, v.y - s.y) < 95) dmgUnit(v, 150, p);
    fx({ k: 'boom', x: s.x, y: s.y, r: 95, dur: 0.45, col: '#ff7a1a' }); fx({ k: 'burst', x: s.x, y: s.y - 8, dur: 0.5 });
    destroyStruct(s, null);
  } else if (t === 'shock') {
    s.cd -= dt; if (s.cd > 0) return;
    const u = near(72); if (!u) return;
    s.cd = 1.0; s.charges--;
    const hit = new Set([u]); let cur = u;
    dmgUnit(cur, 38, p); cur.stun = Math.max(cur.stun, 0.5);
    fx({ k: 'bolt', x: s.x, y: s.y - 16, x2: cur.x, y2: cur.y - 10, dur: 0.22 });
    for (let i = 1; i < 3; i++) {
      const nx = nearestHostileUnit(tm, cur.x, cur.y, 90, 2, hit); if (!nx) break;
      dmgUnit(nx, 38, p); nx.stun = Math.max(nx.stun, 0.5); hit.add(nx);
      fx({ k: 'bolt', x: cur.x, y: cur.y - 10, x2: nx.x, y2: nx.y - 10, dur: 0.22 }); cur = nx;
    }
    if (s.charges <= 0) destroyStruct(s, null);
  } else if (t === 'web') {
    s.cd -= dt; if (s.cd > 0) return;
    if (!near(54)) return;
    s.cd = 1.2; s.charges--;
    each(54, v => { v.slowF = v.slowT > 0 ? Math.min(v.slowF, 0.3) : 0.3; v.slowT = 2.5; });
    fx({ k: 'ring', x: s.x, y: s.y, r: 54, dur: 0.4, col: '#ffffff' });
    if (s.charges <= 0) destroyStruct(s, null);
  } else if (t === 'freeze') {
    s.cd -= dt; if (s.cd > 0) return;
    if (!near(56)) return;
    s.cd = 1.5; s.charges--;
    each(64, v => { dmgUnit(v, 12, p); v.stun = Math.max(v.stun, 1.6); v.stunK = 'ice'; });
    fx({ k: 'ring', x: s.x, y: s.y, r: 64, dur: 0.45, col: '#8fe3ff' }); fx({ k: 'boom', x: s.x, y: s.y, r: 64, dur: 0.3, col: '#8fe3ff' });
    if (s.charges <= 0) destroyStruct(s, null);
  } else if (t === 'saw') {
    s.cd -= dt; if (s.cd > 0) return;
    const u = near(44); if (!u) return;
    s.cd = 0.55; s.charges--;
    const hit = new Set(); let n = 0;
    for (const v of G.units) if (n < 3 && !v.dead && v.team !== tm && !v.fly && !v.phase && hyp(v.x - s.x, v.y - s.y) < 46) { dmgUnit(v, 42, p); n++; }
    fx({ k: 'boom', x: s.x, y: s.y, r: 46, dur: 0.22, col: '#e5e7eb' });
    if (s.charges <= 0) destroyStruct(s, null);
  } else if (t === 'fire') {
    let any = false;
    each(56, v => { dmgUnit(v, 22 * dt, p); any = true; });
    if (any) { if (tick(4, dt)) fx({ k: 'fire', x: s.x, y: s.y, r: 56, dur: 0.3 }); wear(9); }
  } else if (t === 'bog') {
    let any = false;
    each(52, v => { dmgUnit(v, 15 * dt, p); v.slowF = v.slowT > 0 ? Math.min(v.slowF, 0.65) : 0.65; v.slowT = 0.3; any = true; });
    if (any) { if (tick(4, dt)) fx({ k: 'fire', x: s.x, y: s.y, r: 52, dur: 0.3, col: 'rgba(120,220,60,.5)' }); wear(6); }
  } else if (t === 'curse') {
    let any = false;
    for (const v of G.units) if (!v.dead && v.team !== tm && !v.fly && !v.phase && hyp(v.x - s.x, v.y - s.y) < 62) { v.weakT = 0.5; any = true; }
    if (any) { if (tick(3, dt)) fx({ k: 'ring', x: s.x, y: s.y, r: 62, dur: 0.4, col: '#c28bff' }); wear(5); }
  }
}

// ---------- CPU ----------
function enemyPathPts(team) {
  const c = G.paths[team]; if (c && c.ver === G.bver) return c.pts;
  const pts = [], my = G.teams[team].crystal;
  for (const e of G.teams) {
    if (e.id === team || !e.alive) continue;
    const [sx, sy] = spawnPos(e.id), fl = flips(e.id);
    const routes = G.L.lanes && G.L.lanes.length === 3 ? [0, 1, 2] : G.L.lanes ? [0, 1] : [-1];
    for (const ln of routes) {
      let wpc = null;
      if (ln >= 0 && G.L.lanes[ln] != null) wpc = laneWps(e.id, ln).map(w => [w.cx, w.cy]);
      let cx = cellOf(sx), cy = cellOf(sy);
      for (const tg of wpc ? wpc.concat([[my.cx, my.cy]]) : [[my.cx, my.cy]]) {
        const f = getField(e.id, tg[0], tg[1]);
        for (let i = 0; i < 600; i++) {
          if (!bestNeighbor(f, G.blocked, G.GW, G.GH, cx, cy, fl[0], fl[1])) break;
          cx = bnx; cy = bny; pts.push([cx * CELL + CELL / 2, cy * CELL + CELL / 2]);
          if (cx === tg[0] && cy === tg[1]) break;
        }
      }
    }
  }
  G.paths[team] = { ver: G.bver, pts };
  return pts;
}
const TW_W = { archer: 4, cannon: 2.5, mage: 2.5, ice: 2, wall: 1, ballista: 2, catapult: 1.5, fountain: 1, venom: 2, flame: 1.5 };
const TR_W = { spike: 3, shock: 2, fire: 2, pit: 2, barrel: 1.5, web: 1.5, bog: 1.5, freeze: 1.5, curse: 1, saw: 1.5 };
const UN_W = { slime: 3, goblin: 3, gargoyle: 2, dragon: 1.2, skeleton: 2, orc: 1.8, ghost: 1.5, wolf: 2, healer: 1, bomber: 1.8 };
function wpickIn(w, list) { const f = {}; let any = false; for (const k in w) if (!list || list.indexOf(k) >= 0) { f[k] = w[k]; any = true; } return any ? wpick(f) : null; }
function wpick(w) {
  let tot = 0; for (const k in w) tot += w[k];
  let r = G.rng() * tot;
  for (const k in w) { if ((r -= w[k]) <= 0) return k; }
  return Object.keys(w)[0];
}
function pickCell(p, type) {
  const pts = enemyPathPts(p.team), z = p.zone, isTrap = !!TRAPS[type], isMine = type === 'mine', myC = G.teams[p.team].crystal;
  const mine = G.structs.filter(s => s.owner === p.id && !s.dead);
  let best = null, bs = -1e9;
  for (let k = 0; k < 90; k++) {
    const cx = cellOf(z.x0 + G.rng() * (z.x1 - z.x0)), cy = cellOf(z.y0 + G.rng() * (z.y1 - z.y0));
    if (buildReason({ zone: z, gold: 1e9, id: p.id, team: p.team }, type, cx, cy)) continue;
    const x = cx * CELL + 20, y = cy * CELL + 20;
    let dmin = 1e9;
    for (let i = 0; i < pts.length; i += 2) { const d = hyp(pts[i][0] - x, pts[i][1] - y); if (d < dmin) dmin = d; }
    let sc;
    if (isTrap) { if (dmin > 60) continue; sc = -dmin + G.rng() * 6; }
    else if (isMine) sc = Math.min(dmin, 220) - hyp(x - myC.x, y - myC.y) * 0.25 + G.rng() * 12;
    else {
      let near = 0; for (const s of mine) if (s.kind === 'tower' && hyp(s.x - x, s.y - y) < 80) near++;
      sc = -Math.abs(dmin - 110) - near * 14 - hyp(x - myC.x, y - myC.y) * 0.03 + G.rng() * 10;
      if (pts.length === 0) sc = G.rng() * 10 - hyp(x - myC.x, y - myC.y) * 0.05;
    }
    if (sc > bs) { bs = sc; best = [cx, cy]; }
  }
  return best;
}
function cpuThink(p, dt) {
  if (!G.teams[p.team].alive) return;
  const cfg = CPU_CFG[p.level], c = p.cpu;
  c.timer -= dt; if (c.timer > 0) return;
  c.timer = cfg.interval * (0.8 + G.rng() * 0.4);
  const mine = G.structs.filter(s => s.owner === p.id && !s.dead && s.kind === 'tower');
  const traps = G.structs.filter(s => s.owner === p.id && !s.dead && s.kind === 'trap');
  const wantT = Math.min(Math.round(cfg.maxT * TUNE.maxTMul), 3 + Math.floor(G.t / cfg.grow), towerCap() || 999);
  let acts = 0;
  // react to an announced item: send a cheap unit down that route
  const itm = G.item;
  if (itm && c.itemSeen !== itm.id) { c.itemSeen = itm.id; if (G.rng() < [0.3, 0.5, 0.75][p.level]) c.goItem = itm.id; }
  if (itm && c.goItem === itm.id && G.t >= G.prep) {
    const ks = (p.deck ? p.deck.atk : UNIT_ORDER).slice().sort((a, b) => UT[b].spd - UT[a].spd);
    for (const k of ks) if (p.gold >= UT[k].cost) { if (G.L.lanes && itm.lane != null) p.lane = itm.lane; if (!sendUnit(p, k)) c.goItem = null; break; }
  }
  // gold mine
  const mineP = p.mineP != null ? p.mineP : cfg.mineP;
  if (!c.saveMine && mineCount(p) < MINE.max && mine.length >= 3 && G.t >= G.prep && G.rng() < mineP) c.saveMine = G.t;   // decide to save up for a mine (gives up after 25s)
  if (c.saveMine) {
    if (mineCount(p) >= MINE.max || G.t - c.saveMine > 25) c.saveMine = false;
    else if (p.gold >= mineCost(p)) { const cell = pickCell(p, 'mine'); if (cell && !buildStruct(p, 'mine', cell[0], cell[1])) acts++; c.saveMine = false; }
  }
  const saving = !!c.saveMine;
  // build
  while (acts < 2 && mine.length < wantT && !(saving && mine.length >= 3)) {
    const type = wpickIn(TW_W, p.deck && p.deck.def);
    if (!type || p.gold < structCost(type)) break;
    const cell = pickCell(p, type); if (!cell) break;
    if (buildStruct(p, type, cell[0], cell[1])) break;
    mine.push({}); acts++;
  }
  // traps
  const nTr = p.deck ? p.deck.def.filter(k => TRAPS[k]).length : 2;   // trap-heavy decks lay more traps
  if (!saving && nTr > 0 && traps.length < 1 + nTr + Math.floor(G.t * nTr / 110) && G.rng() < 0.2 + 0.08 * nTr && acts < 2) {
    const type = wpickIn(TR_W, p.deck && p.deck.def);
    if (type && p.gold >= structCost(type) + 20) { const cell = pickCell(p, type); if (cell && !buildStruct(p, type, cell[0], cell[1])) acts++; }
  }
  // send
  if (!saving && G.t >= G.prep && mine.length >= Math.min(wantT, 3) && G.rng() < Math.min(1, cfg.sendP * TUNE.sendMul * (p.gold > 400 ? 2.5 : 1))) {
    for (let tries = 0; tries < 3; tries++) {
      const type = wpickIn(UN_W, p.deck && p.deck.atk);
      if (!type) break;
      if (p.gold < UT[type].cost + (mine.length < wantT ? 40 : 0)) continue;
      // choose target / lane
      if (G.mode === '4p') {
        const alive = G.teams.filter(t => t.id !== p.team && t.alive);
        if (alive.length) {
          if (p.level === 0 || G.rng() < 0.3) p.target = alive[(G.rng() * alive.length) | 0].id;
          else { const lo = Math.min(...alive.map(t => t.crystal.hp)); const ties = alive.filter(t => t.crystal.hp <= lo + 1); p.target = ties[(G.rng() * ties.length) | 0].id; }
        }
      }
      if (G.L.lanes) p.lane = G.L.lanes.length === 3 ? (G.rng() < 0.4 ? 1 : G.rng() < 0.5 ? 0 : 2) : (G.rng() < 0.5 ? 0 : 1);
      if (!sendUnit(p, type)) break;
    }
  }
  // upgrade
  if (!saving && G.rng() < cfg.upP && mine.length) {
    const cand = G.structs.filter(s => s.owner === p.id && !s.dead && s.kind === 'tower' && s.lvl < 3).sort((a, b) => a.lvl - b.lvl);
    if (cand.length && p.gold > upgradeCost(cand[0]) + 60) upgradeStruct(p, cand[0]);
  }
}

// ---------- team mode: commander actions ----------
function giveGold(cp, role, amt) {
  if (G.mode !== 'team' || !cp || cp.role !== 'cmd') return 'x';
  if (G.over) return 'over';
  if (!G.teams[cp.team].alive) return 'dead';
  if (['front', 'back', 'eng'].indexOf(role) < 0) return 'x';
  amt = Math.floor(+amt || 0); if (amt <= 0) return 'x';
  const tm = G.teams[cp.team]; if (tm.bank < amt) return 'gold';
  tm.bank -= amt; roleP(cp.team, role).gold += amt; cp.st.given = (cp.st.given || 0) + amt;
  return null;
}
function setTarget(cp, team) {
  if (G.mode !== 'team' || !cp || cp.role !== 'cmd') return 'x';
  const tm = G.teams[cp.team];
  if (team === cp.team || !G.teams[team] || !G.teams[team].alive) return 'bad';
  if (tm.target === team) return null;
  if (G.t < tm.tgtNext) return 'wait';
  tm.target = team; tm.tgtNext = G.t + TEAM_CFG.tgtCd;
  return null;
}
function sendCourier(cp) {
  if (G.mode !== 'team' || !cp || cp.role !== 'cmd') return 'x';
  if (G.over) return 'over';
  if (!G.teams[cp.team].alive) return 'dead';
  if (G.t < G.prep) return 'prep';
  if (!G.item) return 'noitem';
  if (G.units.some(u => u.cour && u.team === cp.team && !u.dead)) return 'already';
  if (cp.gold < COURIER.cost) return 'gold';
  const T = UT[COURIER.type], [sx, sy] = spawnPos(cp.team), m = hpMult(G.t);
  cp.gold -= COURIER.cost;
  G.units.push({
    id: G.nextId++, type: COURIER.type, team: cp.team, owner: cp.id, x: sx, y: sy, hp: T.hp * m, max: T.hp * m, fly: false,
    dest: targetTeamOf(cp), tgt: null, utgt: null, chase: false, rt: 0.3, stun: 0, stunK: null, slowT: 0, slowF: 1, weakT: 0, poT: 0, poDps: 0, poOwner: cp.id,
    phase: false, face: G.teams[cp.team].crystal.x > G.W / 2 ? -1 : 1, atk: 0, dead: false, wp: null, born: G.t, cour: true
  });
  return null;
}
// ---------- team mode: CPU for a role nobody plays (or whose iPad dropped out) ----------
function cpuTeam(p, dt) {
  const tm = G.teams[p.team]; if (!tm.alive) return;
  const cfg = CPU_CFG[p.level], c = p.cpu;
  c.timer -= dt; if (c.timer > 0) return;
  c.timer = cfg.interval * (0.8 + G.rng() * 0.4);
  const mineOf = (q, kind) => G.structs.filter(s => s.owner === q.id && !s.dead && s.kind === kind);
  if (p.role === 'front') {
    if (G.t < G.prep) return;
    if (G.rng() < Math.min(1, cfg.sendP * (p.gold > 220 ? 2.5 : 1.3))) {
      for (let tries = 0; tries < 3; tries++) {
        const type = wpickIn(UN_W, p.deck.atk); if (!type) break;
        if (p.gold < UT[type].cost) continue;
        if (!sendUnit(p, type)) break;
      }
    }
  } else if (p.role === 'back') {
    const tw = mineOf(p, 'tower'), wantT = Math.min(cfg.maxT + 4, 3 + Math.floor(G.t / (cfg.grow * 0.8)));
    let acts = 0;
    while (acts < 2 && tw.length < wantT) {
      const type = wpickIn(TW_W, p.deck.def); if (!type || p.gold < structCost(type)) break;
      const cell = pickCell(p, type); if (!cell || buildStruct(p, type, cell[0], cell[1])) break;
      tw.push({}); acts++;
    }
    if (!acts && G.rng() < cfg.upP * 1.5 && tw.length >= Math.min(wantT, 4)) {
      const cand = mineOf(p, 'tower').filter(s => s.lvl < 3).sort((a, b) => a.lvl - b.lvl);
      if (cand.length && p.gold >= upgradeCost(cand[0])) upgradeStruct(p, cand[0]);
    }
  } else if (p.role === 'eng') {
    const tr = mineOf(p, 'trap'), walls = mineOf(p, 'tower');
    if (tr.length < 3 + Math.floor(G.t / 35) && G.rng() < 0.6) {
      const type = wpickIn(TR_W, p.deck.def);
      if (type && p.gold >= structCost(type)) { const cell = pickCell(p, type); if (cell) buildStruct(p, type, cell[0], cell[1]); }
    } else if (walls.length < 2 + Math.floor(G.t / 50) && G.rng() < 0.35) {
      const type = G.rng() < 0.5 ? 'wall' : 'block';
      if (p.gold >= structCost(type)) { const cell = pickCell(p, 'spike'); if (cell) buildStruct(p, type, cell[0], cell[1]); }
    }
  } else if (p.role === 'cmd') {
    // pick a target every so often: the weakest enemy crystal (or a random one for easy CPUs)
    if (G.t >= tm.tgtNext && G.t >= G.prep) {
      const alive = G.teams.filter(t => t.id !== p.team && t.alive);
      if (alive.length && G.rng() < 0.5) {
        let tg;
        if (p.level === 0 || G.rng() < 0.3) tg = alive[(G.rng() * alive.length) | 0].id;
        else { const lo = Math.min(...alive.map(t => t.crystal.hp / t.crystal.max)), ties = alive.filter(t => t.crystal.hp / t.crystal.max <= lo + 0.02); tg = ties[(G.rng() * ties.length) | 0].id; }
        if (tg !== tm.target) setTarget(p, tg); else tm.tgtNext = G.t + 8;
      }
    }
    // runner for an announced item
    const itm = G.item;
    if (itm && c.itemSeen !== itm.id) { c.itemSeen = itm.id; if (G.rng() < [0.3, 0.5, 0.75][p.level]) c.goItem = itm.id; }
    if (itm && c.goItem === itm.id && !sendCourier(p)) c.goItem = null;
    // gold mine
    const backTw = mineOf(roleP(p.team, 'back'), 'tower').length;
    if (!c.saveMine && mineCount(p) < MINE.max && backTw >= 3 && G.t >= G.prep && G.rng() < cfg.mineP * 2) c.saveMine = G.t;
    if (c.saveMine) {
      if (mineCount(p) >= MINE.max || G.t - c.saveMine > 25) c.saveMine = false;
      else if (p.gold >= mineCost(p)) { const cell = pickCell(p, 'mine'); if (cell) buildStruct(p, 'mine', cell[0], cell[1]); c.saveMine = false; }
      if (c.saveMine) return;
    }
    // hand out the safe: whoever is furthest below what they want
    const want = { front: 220, back: 200, eng: 110 };
    for (let k = 0; k < 3 && tm.bank >= 10; k++) {
      let best = null, bs = -1e9;
      for (const r of ['front', 'back', 'eng']) { const q = roleP(p.team, r), sc = (want[r] - q.gold) / want[r] + G.rng() * 0.2; if (sc > bs) { bs = sc; best = r; } }
      if (bs < 0) break;
      giveGold(p, best, tm.bank >= 100 ? 50 : 10);
    }
  }
}

// ---------- main step ----------
function checkEnd() {
  const alive = G.teams.filter(t => t.alive);
  const need = G.mode === '4p' ? 1 : 1;
  let reason = null;
  if (alive.length <= need) reason = 'crystal';
  else if (G.t >= G.timeLimit) reason = 'time';
  if (!reason) return;
  G.over = true;
  const teamDmg = t => G.players.filter(p => p.team === t.id).reduce((a, p) => a + p.st.dmg, 0);
  const frac = t => Math.max(0, t.crystal.hp) / t.crystal.max;
  const alv = alive.slice().sort((a, b) => (frac(b) - frac(a)) || (teamDmg(b) - teamDmg(a)));
  const dead = G.teams.filter(t => !t.alive).sort((a, b) => b.elimOrder - a.elimOrder);
  const ranks = alv.concat(dead).map((t, i) => ({ team: t.id, rank: i + 1, alive: t.alive, hp: Math.max(0, t.crystal.hp), frac: Math.max(0, t.crystal.hp) / t.crystal.max }));
  let tie = false;
  let byDmg = false;
  if (reason === 'time' && alv.length > 1 && Math.abs(alv[0].crystal.hp - alv[1].crystal.hp) < 1) { if (Math.abs(teamDmg(alv[0]) - teamDmg(alv[1])) < 1) tie = true; else byDmg = true; }
  G.result = { reason, ranks, byDmg, winner: tie ? -1 : ranks[0].team, time: G.t };
}
function stepGame(dt) {
  if (!G || G.over) return;
  G.t += dt;
  if (TUNE.spurt > 0 && G.t >= G.timeLimit - TUNE.spurt && G.t - dt < G.timeLimit - TUNE.spurt) msg('🔥ラストスパート！タワーの攻撃力が半分に！', '#ff8a3c');
  if (G.mode === 'team') {
    for (const t of G.teams) if (t.alive) t.bank += teamIncome(t.id) * dt;
    for (const p of G.players) if (!p.human) cpuTeam(p, dt);
  } else for (const p of G.players) {
    if (G.teams[p.team].alive) p.gold += income(p) * dt;
    if (!p.human) cpuThink(p, dt);
  }
  updateItems();
  for (const s of G.structs) {
    if (s.dead || s.hp <= 0) continue;
    if (s.kind === 'tower') updateTower(s, dt); else if (s.kind === 'trap') updateTrap(s, dt);
    else if (s.kind === 'mine' && (((G.t + s.id * 0.37) * 0.8) | 0) !== (((G.t + s.id * 0.37 - dt) * 0.8) | 0)) fx({ k: 'coin', x: s.x + 8, y: s.y - 30, dur: 0.9 });
  }
  for (const u of G.units) if (!u.dead) updateUnit(u, dt);
  for (const e of G.effects) e.t += dt;
  if (G.units.some(u => u.dead)) G.units = G.units.filter(u => !u.dead);
  if (G.structs.some(s => s.dead)) G.structs = G.structs.filter(s => !s.dead);
  if (G.effects.length) G.effects = G.effects.filter(e => e.t < e.dur);
  checkEnd();
}
function runGame(opts, maxSec) {
  newGame(opts);
  const lim = maxSec || G.timeLimit + 5;
  while (!G.over && G.t < lim) stepGame(STEP);
  return G;
}

const SIM = { ROLES, ROLE_NAMES, TEAM_CFG, COURIER, ROLE_POOL, ROLE_FIXED, ROLE_DEFAULT, roleDeckOK, roleDeck, roleP, teamIncome, giveGold, setTarget, sendCourier, structInfo, costFor, firstEnemyTeam, inSpurt, towerRange, aheadOf, TEAM_COLORS, TEAM_NAMES, ITEMS, cellOf, towerCount, ITEM, ITEMS, ITEM_ORDER, DECK_PRESETS, airOK, deckOK, MINE, mineCount, mineCost, TUNE, newGame, stepGame, runGame, buildStruct, upgradeStruct, sellStruct, sendUnit, buildReason, getG: () => G, TT, TRAPS, UT, TOWER_ORDER, TRAP_ORDER, UNIT_ORDER, MAPS, MAP_ORDER, MODES, CELL, STEP, PREP, TIME_LIMIT, CRY_HP, hpMult, income, upgradeCost, sellValue, structCost, targetTeamOf, enemyPathPts, genMap, layout };

root.TBSIM = SIM;
if (typeof module !== 'undefined' && module.exports) module.exports = SIM;
})(typeof window !== 'undefined' ? window : globalThis);
