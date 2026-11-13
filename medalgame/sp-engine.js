/* スロットパーク:抽選と配当(先生のPCで動く。iPadは表示に使う定数だけ読む) */
/* スロットパーク：抽選と配当（先生のPCで動く。iPadは表示に使う定数だけ読む） */
(function (root) {
  'use strict';
  const R = () => Math.random();
  const ri = (n) => Math.floor(R() * n);
  const wpick = (list) => { // [[item, weight], ...]
    let t = 0; for (const x of list) t += x[1];
    let r = R() * t;
    for (const x of list) { r -= x[1]; if (r < 0) return x[0]; }
    return list[list.length - 1][0];
  };
  // 端数を持ち越して払う（還元率を正確に保つ）
  const payFrac = (st, v) => { const t = v + (st.frac || 0); const p = Math.floor(t + 1e-9); st.frac = t - p; return p; };

  const MACHINES = [
    // BETは min〜max を step きざみで自由に選べる。配当はBETに比例するので、還元率はBETに関係なく同じ
    // いったん休止中の台(行頭の // を消せば元にもどる。中身のプログラムは残してある)
    // { id: 'classic', name: 'フルーツクラシック', style: 'pop', bet: { min: 1, max: 100, step: 1, def: 1 } },
    // { id: 'oshi', name: '目押しチャレンジ', style: 'chic', bet: { min: 3, max: 30, step: 3, def: 3 } },
    { id: 'wide', name: 'ドラゴンレギオン', style: 'pop', bet: { min: 1, max: 100, step: 1, def: 1 } },
    { id: 'rocket', name: '連チャンロケット', style: 'chic', bet: { min: 1, max: 100, step: 1, def: 2 } },
    // { id: 'jackpot', name: 'ジャックポット777', style: 'chic', bet: { min: 5, max: 50, step: 5, def: 5 } },
    // { id: 'drop', name: 'キラリドロップ', style: 'pop', bet: { min: 1, max: 100, step: 1, def: 1 } },
    // ⑦ は id を 'battle' のまま、中身を GUILD RUSH に差し替え(先生のPCに保存した台の状態をそのまま使うため)
    { id: 'battle', name: 'GUILD RUSH', style: 'chic', bet: { min: 3, max: 30, step: 3, def: 3 } }
  ];

  /* ---------- ① フルーツクラシック ---------- */
  const C_SYMS = ['seven', 'bar', 'bell', 'grape', 'lemon', 'cherry'];
  const C_OUT = [ // [結果, 倍率(BETに対して), 確率]
    ['seven', 100, 1 / 2000], ['bar', 30, 1 / 400], ['bell', 15, 1 / 70], ['grape', 8, 1 / 40],
    ['lemon', 6, 1 / 30], ['cherry3', 5, 1 / 100], ['cherry', 2, 1 / 12]
  ];
  const C_LINES = [1, 0, 2]; // ライン1=中段, 2=上段, 3=下段
  function classicGrid(out, lineIdx, bet) {
    for (let tries = 0; tries < 500; tries++) {
      const g = [0, 1, 2].map(() => [0, 1, 2].map(() => C_SYMS[ri(C_SYMS.length)]));
      if (out) {
        const r = C_LINES[lineIdx];
        if (out === 'cherry') { g[r][0] = 'cherry'; } else { const s = out === 'cherry3' ? 'cherry' : out; g[r] = [s, s, s]; }
      }
      let ok = true;
      for (let i = 0; i < bet; i++) {
        const row = g[C_LINES[i]];
        const win = out && i === lineIdx;
        if (win && out === 'cherry') { if (row[1] === 'cherry' || (row[1] === row[2] && row[1] === row[0])) ok = false; continue; }
        if (win) continue;
        if (row[0] === 'cherry' || (row[0] === row[1] && row[1] === row[2])) ok = false;
      }
      if (ok) return g;
    }
    return [['lemon', 'grape', 'bell'], ['grape', 'bell', 'lemon'], ['bell', 'lemon', 'grape']];
  }
  function classicSpin(st, bet) {
    let r = R(), out = null, mult = 0;
    for (const o of C_OUT) { if (r < o[2]) { out = o[0]; mult = o[1]; break; } r -= o[2]; }
    const lines = Math.min(bet, 3); // 光るラインは最大3本(BETが多いほど配当が大きい)
    const line = out ? ri(lines) : -1;
    const pay = mult * bet;
    return { pay, bet, out, line, lines, grid: classicGrid(out, line, lines) };
  }

  /* ---------- ② 目押し / ⑦ GUILD RUSH（パチスロ） ---------- */
  const P_STRIP = ['seven', 'bell', 'replay', 'lemon', 'bell', 'replay', 'cherry', 'bell', 'replay', 'bar', 'bell',
    'replay', 'lemon', 'bell', 'replay', 'cherry', 'bell', 'replay', 'lemon', 'bell', 'replay'];
  // GUILD RUSH(5ライン)用のリールの並び。絵柄の数は P_STRIP と同じで、並び順だけ5ライン向けに変えた
  // (よこのラインでベルとリプレイが同時にそろわない・どこで押しても当たった絵柄をそろえやすい並びを、シミュレーションで探した)
  const G_STRIP = ['bar', 'lemon', 'replay', 'lemon', 'bell', 'bell', 'cherry', 'replay', 'replay', 'seven', 'bell', 'bell', 'replay', 'bell', 'lemon',
    'cherry', 'replay', 'replay', 'bell', 'replay', 'bell'];
  const P_PROB = { replay: 1 / 7.3, bell: 1 / 7.5, cherry: 1 / 36, big: 1 / 280, reg: 1 / 400 };
  const P_PAY = { replay: 3, bell: 8, cherry: 4, bonusGame: 12 };
  const P_GAMES = { big: 30, reg: 12 };
  function pachiLever(st, bet) {
    let k = Math.max(1, Math.round(bet / 3));
    // ボーナスが当たってから終わるまでは、当たったときのBETで固定(当たってからBETを上げて増やすのを防ぐ)
    if (st.held || st.bonus) { if (!st.hk) st.hk = k; k = st.hk; }
    st.k = k;
    const res = { bet: 3 * k, pay: 0, newHit: false, k };
    if (st.bonus) {
      st.bonus.left--; res.flag = 'bonusGame'; res.pay = P_PAY.bonusGame * k;
      res.bonus = { type: st.bonus.type, left: st.bonus.left };
      st.bonusGet = (st.bonusGet || 0) + res.pay - 3 * k;
      res.bonusGet = st.bonusGet;
      if (st.bonus.left <= 0) { res.bonusEnd = true; st.bonus = null; st.bonusGet = 0; if (!st.held) st.hk = null; }
      st.last = null; res.held = st.held || null; return res;
    }
    let r = R(), flag = 'none';
    for (const f of ['replay', 'bell', 'cherry']) { if (r < P_PROB[f]) { flag = f; break; } r -= P_PROB[f]; }
    if (!st.held) {
      const b = R();
      if (b < P_PROB.big) { st.held = 'big'; res.newHit = true; st.hk = k; }
      else if (b < P_PROB.big + P_PROB.reg) { st.held = 'reg'; res.newHit = true; st.hk = k; }
    }
    res.flag = flag; res.held = st.held || null;
    if (flag === 'replay') res.pay = P_PAY.replay * k;
    if (flag === 'bell') res.pay = P_PAY.bell * k;
    st.last = flag; st.games = (st.games || 0) + 1;
    return res;
  }
  function pachiStop(st, d) {
    const res = { bet: 0, pay: 0 };
    if (st.last === 'cherry' && d.cherryOk) res.pay = P_PAY.cherry * (st.k || 1);
    st.last = null;
    if (d.aligned && st.held && !st.bonus) {
      st.bonus = { type: st.held, left: P_GAMES[st.held] }; st.bonusGet = 0;
      st.count = st.count || { big: 0, reg: 0 }; st.count[st.held]++;
      res.bonusStart = st.held; st.held = null; st.games = 0; st.lampOn = false;
    }
    res.held = st.held || null;
    return res;
  }
  // 液晶演出（GUILD RUSH）。期待度 tier: 0=なし 1=青 2=緑 3=赤 4=金 5=虹。prem=プレミア(当たり確定)
  // 当たりの確率・配当には関係しない(見せ方だけ)。当たったときは緑以上
  const G_HIT = [[2, 10], [3, 30], [4, 40], [5, 20]];
  const G_MISS = [[1, 0.10], [2, 0.04], [3, 0.012], [4, 0.0015]];
  function battleEffect(res) {
    if (res.flag === 'bonusGame') return { scene: 'bonusGame' };
    const ch = res.flag === 'cherry';
    if (res.newHit) return { tier: wpick(G_HIT), hit: true, prem: R() < 0.05, ch };
    let r = R(), tier = 0;
    for (const [t, p] of G_MISS) { if (r < p) { tier = t; break; } r -= p; }
    return { tier, hit: false, ch };
  }
  // ダンジョンの階層(30ゲームごとに1つ深く。B1〜B5)とギルドランク(ボーナスが終わるたびに1つ上がる。F〜S)
  function guildMove(st, res) {
    if (res.flag === 'bonusGame') {
      if (res.bonusEnd) { st.rank = (st.rank || 0) + 1; res.rankNew = st.rank; if (st.rank >= 6) { res.rankS = true; st.rank = 0; } st.floor = 0; st.fg = 0; }
      return;
    }
    st.fg = (st.fg || 0) + 1;
    if (st.fg >= 30) { st.fg = 0; if ((st.floor || 0) < 4) { st.floor = (st.floor || 0) + 1; res.floorUp = st.floor; } }
  }

  /* ---------- ③ ワイドライン（5リール・243ウェイ） ---------- */
  // 左のリールから、となりの列のどこかに同じ絵柄があればつながる(ラインなし)。同じ列に2つあれば2通り。
  // 1本のリールに同じ絵柄は1つまで。WILDはフリースピン中だけ2〜5列目に出て、ほし以外の代わりになり、WILDを含む当たりは配当2倍。
  // 配当表の数字は「BETに対して何倍か」。いちばん小さい当たりでもBETと同じ枚数(BET割れの当たりはない)。
  const W_SYMS = [['seven', 2], ['crown', 2.5], ['gem', 3], ['bell', 3.5], ['bar', 3.5], ['melon', 4], ['grape', 4], ['orange', 4], ['cherry', 4.5], ['lemon', 4.5], ['star', 1.4]];
  const W_FSYMS = [['seven', 2], ['crown', 2.5], ['gem', 3], ['bell', 3.5], ['bar', 3.5], ['melon', 4], ['grape', 4], ['orange', 4], ['cherry', 4.5], ['lemon', 4.5], ['star', 1.4], ['wild', 1.05]];
  const W_PAY = { // [_,_,_, 3つ, 4つ, 5つ]
    seven: [0, 0, 0, 3, 10, 50], crown: [0, 0, 0, 2, 5, 30], gem: [0, 0, 0, 2, 4, 20], bell: [0, 0, 0, 1.5, 3, 12], bar: [0, 0, 0, 1.5, 3, 12],
    melon: [0, 0, 0, 1, 3, 8], grape: [0, 0, 0, 1, 2, 6], orange: [0, 0, 0, 1, 2, 6], cherry: [0, 0, 0, 1, 1.5, 4], lemon: [0, 0, 0, 1, 1.5, 4]
  };
  const W_SCAT = [0, 0, 0, 2, 5, 20];   // ほしの数ごとの配当(どこに出てもよい)
  const W_FSN = [0, 0, 0, 10, 15, 20];  // ほしの数ごとのフリースピン回数(フリースピン中も上乗せ)
  const W_WILDX = 2;
  const W_FS = 10;
  function wideGrid(free) { // grid[row][reel]
    const g = [[], [], []];
    for (let c = 0; c < 5; c++) {
      const used = {};
      for (let r = 0; r < 3; r++) {
        let s; do { s = wpick(free && c > 0 ? W_FSYMS : W_SYMS); } while (used[s]);
        used[s] = 1; g[r][c] = s;
      }
    }
    return g;
  }
  function wideEval(g) {
    let m = 0; const wins = [];
    for (const s of Object.keys(W_PAY)) {
      let n = 0, ways = 1; const cells = [];
      for (let c = 0; c < 5; c++) {
        let k = 0;
        for (let r = 0; r < 3; r++) { const x = g[r][c]; if (x === s || (x === 'wild' && c > 0)) { k++; cells.push([r, c]); } }
        if (!k) break;
        n++; ways *= k;
      }
      const v = W_PAY[s][n] || 0;
      if (v > 0) {
        const wild = cells.some(([r, c]) => g[r][c] === 'wild');
        const mul = wild ? W_WILDX : 1;
        m += v * ways * mul;
        wins.push({ sym: s, n, ways, wild, x: v * ways * mul, cells });
      }
    }
    let stars = 0; const starCells = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) if (g[r][c] === 'star') { stars++; starCells.push([r, c]); }
    m += W_SCAT[Math.min(stars, 5)] || 0;
    return { m, wins, stars, starCells };
  }
  function wideSpin(st, bet) {
    const free = st.fs > 0;
    if (free) { bet = st.fsBet; st.fs--; }
    const g = wideGrid(free); const ev = wideEval(g);
    const pay = payFrac(st, ev.m * bet);
    const res = { bet: free ? 0 : bet, pay, grid: g, wins: ev.wins, stars: ev.stars, starCells: ev.starCells, free };
    if (free) st.fsWin = (st.fsWin || 0) + pay;
    if (ev.stars >= 3) {
      if (!free) { st.fsBet = bet; st.fsWin = 0; }
      const add = W_FSN[Math.min(ev.stars, 5)];
      st.fs = (st.fs || 0) + add; res.fsStart = !free; res.fsAdd = add; res.fsMore = free;
    }
    res.fs = st.fs || 0; res.fsWin = st.fsWin || 0; res.fsBet = (free || st.fs > 0) ? st.fsBet : bet; // ふだんの回は今のBET(前のフリースピンのBETを使わない)
    if (free && st.fs === 0) res.fsEnd = true;
    return res;
  }

  /* ---------- ④ 連チャンロケット ---------- */
  const K_LV = [0, 3, 4, 5, 6, 8, 10, 12, 15, 20, 50]; // レベルごとの配当（BETの倍）
  const K_CONT = 0.8, K_SUP = 0.9; // 連チャンの続く確率(ふつうの発射/7で発射=スーパー発射)
  // 当たり:[エンジン名, 配当(BETの倍), 確率]。rocket=発射、seven=スーパー発射、ほかは配当だけ
  //  star=惑星×10 / bell=衛星×5 / gem=エネルギーコア×3 / lemon=ヘルメット×2 / cherry=彗星(左に1つ)×1
  const K_OUT = [['rocket', 0, 1 / 61.5], ['seven', 0, 1 / 800], ['star', 10, 1 / 250], ['bell', 5, 1 / 80], ['gem', 3, 1 / 50], ['lemon', 2, 1 / 25], ['cherry', 1, 1 / 20]];
  const K_FILL = ['seven', 'star', 'gem', 'bell', 'cherry', 'lemon', 'rocket'];
  const K_FAKE = 0.035; // はずれのうち、ロケット(または7)が2つ並ぶリーチになる割合(演出だけ)
  function rocketReels(sym) {
    const cnt = (x, k) => x.filter((v) => v === k).length;
    const bad = (x) => x[0] === 'cherry' || (x[0] === x[1] && x[1] === x[2]) || cnt(x, 'rocket') > 1 || cnt(x, 'seven') > 1 || (x[0] === x[1] && (x[0] === 'rocket' || x[0] === 'seven'));
    let a, tries = 0;
    do { a = [0, 1, 2].map(() => K_FILL[ri(K_FILL.length)]); tries++; } while (tries < 300 && bad(a));
    if (sym === 'cherry') { a[0] = 'cherry'; if (a[1] === 'cherry') a[1] = 'lemon'; }
    else if (sym === 'miss') a = ['rocket', 'rocket', K_FILL.filter((k) => k !== 'rocket')[ri(6)]];
    else if (sym === 'fake') { const k = R() < 0.75 ? 'rocket' : 'seven'; a = [k, k, K_FILL.filter((v) => v !== k && v !== 'cherry')[ri(5)]]; }
    else if (sym) a = [sym, sym, sym];
    return a;
  }
  function rocketSpin(st, bet) {
    if (st.chain) { // 連チャン中(BETなし)
      const c = st.chain;
      if (R() < (c.cont || K_CONT) && c.lv < 10) {
        c.lv++; const pay = K_LV[c.lv] * c.bet; c.win += pay;
        const res = { bet: 0, pay, chain: true, sup: !!c.sup, lv: c.lv, win: c.win, reels: rocketReels('rocket'), chainBet: c.bet };
        if (c.lv >= 10) { res.end = true; res.moon = true; st.best = Math.max(st.best || 0, c.lv); st.last = c.lv; st.chain = null; }
        return res;
      }
      const res = { bet: 0, pay: 0, chain: true, sup: !!c.sup, end: true, lv: c.lv, win: c.win, reels: rocketReels('miss'), chainBet: c.bet };
      st.best = Math.max(st.best || 0, c.lv); st.last = c.lv; st.chain = null; return res;
    }
    let r = R(), out = null, mult = 0;
    for (const o of K_OUT) { if (r < o[2]) { out = o[0]; mult = o[1]; break; } r -= o[2]; }
    if (out === 'rocket' || out === 'seven') {
      const sup = out === 'seven';
      st.chain = { lv: 1, bet, win: K_LV[1] * bet, cont: sup ? K_SUP : K_CONT, sup };
      return { bet, pay: K_LV[1] * bet, start: true, sup, lv: 1, win: st.chain.win, reels: rocketReels(out), chainBet: bet };
    }
    return { bet, pay: mult * bet, out, reels: rocketReels(out || (R() < K_FAKE ? 'fake' : null)) };
  }

  /* ---------- ⑤ ジャックポット777 ---------- */
  const J_BET = 5, J_ADD = 1, J_SEED = 1000;
  const J_OUT = [['jp', 0, 1 / 5000], ['bar3', 10, 1 / 40], ['seven2', 4, 1 / 25], ['bar2', 2, 1 / 12], ['cherry', 1, 1 / 7]];
  const J_FILL = ['seven', 'bar', 'cherry', 'bell', 'lemon'];
  function jpReels(out) {
    let a, tries = 0;
    const bad = (x) => x[0] === 'cherry' || (x[0] === x[1] && (x[0] === 'seven' || x[0] === 'bar')) || (x[0] === x[1] && x[1] === x[2]) ||
      (x.filter((s) => s === 'seven').length >= 2) || (x.filter((s) => s === 'bar').length >= 2);
    do { a = [0, 1, 2].map(() => J_FILL[ri(J_FILL.length)]); tries++; } while (tries < 300 && bad(a));
    if (out === 'jp') a = ['seven', 'seven', 'seven'];
    if (out === 'bar3') a = ['bar', 'bar', 'bar'];
    if (out === 'seven2') a = ['seven', 'seven', ['bar', 'cherry', 'bell', 'lemon'][ri(4)]];
    if (out === 'bar2') a = ['bar', 'bar', ['cherry', 'bell', 'lemon'][ri(3)]];
    if (out === 'cherry') { a[0] = 'cherry'; }
    return a;
  }
  function jackpotSpin(st, bet, jp) {
    const k = Math.max(1, Math.round(bet / J_BET)); // BET5枚ごとに1倍:JPへの積み立てと7・7・7の当たりやすさがk倍
    jp.add(J_ADD * k);
    let r = R(), out = null, mult = 0;
    for (const o of J_OUT) { const pr = o[0] === 'jp' ? o[2] * k : o[2]; if (r < pr) { out = o[0]; mult = o[1]; break; } r -= pr; }
    let pay = mult * J_BET * k;
    if (out === 'jp') { pay = jp.take(); }
    const reach = !out && R() < 0.06; // 7・7のリーチ演出（ハズレ）
    const reels = jpReels(out);
    if (reach) { reels[0] = 'seven'; reels[1] = 'seven'; reels[2] = ['bell', 'lemon'][ri(2)]; }
    return { bet: J_BET * k, pay, out, reels, reach: reach || out === 'jp' || out === 'seven2', pool: jp.get() };
  }

  /* ---------- ⑥ キラリドロップ（3×3 連鎖） ---------- */
  const D_SYMS = [['seven', 1], ['bar', 2], ['star', 3], ['bell', 5], ['grape', 7], ['gem', 8], ['lemon', 11], ['cherry', 14]];
  const D_ODDS = { seven: 6, bar: 4, star: 2.5, bell: 1.8, grape: 1.2, gem: 1, lemon: 0.8, cherry: 0.6 };
  const D_COMBO = [1, 1, 2, 3, 4, 6, 8, 10, 15, 20, 30];
  const D_K = 2.05;
  const D_LINES = [[[0, 0], [0, 1], [0, 2]], [[1, 0], [1, 1], [1, 2]], [[2, 0], [2, 1], [2, 2]], [[0, 0], [1, 0], [2, 0]],
    [[0, 1], [1, 1], [2, 1]], [[0, 2], [1, 2], [2, 2]], [[0, 0], [1, 1], [2, 2]], [[0, 2], [1, 1], [2, 0]]];
  const dCombo = (k) => D_COMBO[Math.min(k, D_COMBO.length - 1)];
  function dropSpin(st, bet) {
    let g = [0, 1, 2].map(() => [0, 1, 2].map(() => wpick(D_SYMS)));
    const steps = []; let total = 0, k = 0;
    for (; ;) {
      const hit = [];
      D_LINES.forEach((ln, i) => { const s = g[ln[0][0]][ln[0][1]]; if (ln.every(([r, c]) => g[r][c] === s)) hit.push({ line: i, sym: s }); });
      if (!hit.length || k >= 30) { steps.push({ grid: g.map((r) => r.slice()), hit: [] }); break; }
      k++;
      const connect = hit.length;
      let m = 0; hit.forEach((h) => { m += D_ODDS[h.sym]; });
      const raw = m * dCombo(k) * connect * D_K * bet;
      const pay = payFrac(st, raw);
      total += pay;
      const clear = {}; hit.forEach((h) => D_LINES[h.line].forEach(([r, c]) => { clear[r + ',' + c] = 1; }));
      steps.push({ grid: g.map((r) => r.slice()), hit, combo: k, connect, pay });
      // 消して落とす
      const ng = [[], [], []];
      for (let c = 0; c < 3; c++) {
        const keep = []; for (let r = 2; r >= 0; r--) if (!clear[r + ',' + c]) keep.push(g[r][c]);
        while (keep.length < 3) keep.push(wpick(D_SYMS));
        for (let r = 2, i = 0; r >= 0; r--, i++) ng[r][c] = keep[i];
      }
      g = ng;
    }
    st.best = Math.max(st.best || 0, k);
    return { bet, pay: total, steps, combo: k };
  }

  /* ---------- まとめ ---------- */
  function play(mid, st, d, ctx) {
    const bet = d.bet | 0;
    const m = MACHINES.find((x) => x.id === mid);
    if (!m) throw new Error('機種がありません');
    const needBet = !(mid === 'wide' && st.fs > 0) && !(mid === 'rocket' && st.chain) && !(d.type === 'stop');
    const B = m.bet;
    if (needBet && (!(bet >= B.min && bet <= B.max) || bet % B.step)) throw new Error('BETは' + B.min + '〜' + B.max + '枚' + (B.step > 1 ? '(' + B.step + '枚きざみ)' : '') + 'で選んでください');
    switch (mid) {
      case 'classic': return classicSpin(st, bet);
      case 'wide': return wideSpin(st, bet);
      case 'rocket': return rocketSpin(st, bet);
      case 'jackpot': return jackpotSpin(st, bet, ctx.jp);
      case 'drop': return dropSpin(st, bet);
      case 'oshi': case 'battle': {
        if (d.type === 'stop') return pachiStop(st, d);
        const res = pachiLever(st, bet);
        if (mid === 'battle') { res.fx = battleEffect(res); guildMove(st, res); if (res.newHit) res.lamp = true; }
        else if (res.newHit) res.lamp = R() < 0.6; // 目押し：告知ランプ（すぐ光る／あとで光る）
        if (mid === 'oshi' && !res.newHit && st.held && !st.lampOn) { if (R() < 0.35) res.lamp = true; }
        if (res.lamp) st.lampOn = true;
        if (!st.held) st.lampOn = false;
        res.lampOn = !!st.lampOn;
        return res;
      }
    }
  }
  // 何を払うのにいくら必要か（ゲーム前のチェック用）
  function cost(mid, st, d) {
    if (d.type === 'stop') return 0;
    if (mid === 'wide' && st.fs > 0) return 0;
    if (mid === 'rocket' && st.chain) return 0;
    if ((mid === 'oshi' || mid === 'battle') && (st.held || st.bonus) && st.hk) return 3 * st.hk;
    return d.bet | 0;
  }

  const API = {
    MACHINES, play, cost,
    consts: { C_LINES, P_STRIP, G_STRIP, D_LINES, D_ODDS, D_COMBO, D_K, K_LV, K_CONT, K_SUP, K_OUT, J_SEED, C_OUT, P_PAY, P_GAMES, W_PAY, W_SCAT, W_FS, W_FSN, W_WILDX }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.SP = API;
})(typeof window !== 'undefined' ? window : globalThis);

