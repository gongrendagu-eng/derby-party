/* ===== 見取り図の自動生成（シードから毎回同じ形を再現） ===== */
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, rng){ const a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const COLS = 5, ROWS = 4, NCELL = 20;
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];           // 北・東・南・西（北＝図の上）
const REL = ['front', 'right', 'back', 'left'];
const idx = (c, r) => r * COLS + c;
const cr = i => [i % COLS, Math.floor(i / COLS)];
const ROOM_NAMES = ['職員室', '体育倉庫', '美術室', '音楽室', '調理室', '理科室', '図書室', '保健室', '校長室', '放送室'];
const MIN_DIST = 6;

function bfs(adj, s){
  const d = new Array(NCELL).fill(-1); d[s] = 0; const q = [s];
  while (q.length){ const a = q.shift(); for (let k = 0; k < 4; k++){ const b = adj[a][k]; if (b != null && d[b] < 0){ d[b] = d[a] + 1; q.push(b); } } }
  return d;
}

function genMap(seed){
  for (let attempt = 0; attempt < 300; attempt++){
    const rng = mulberry32((seed + attempt * 7919) >>> 0);
    const adj = Array.from({ length: NCELL }, () => [null, null, null, null]);
    const link = (a, b, d) => { adj[a][d] = b; adj[b][(d + 2) % 4] = a; };
    const seen = new Array(NCELL).fill(false);
    const stack = [Math.floor(rng() * NCELL)]; seen[stack[0]] = true;
    while (stack.length){
      const a = stack[stack.length - 1], [c, r] = cr(a), opts = [];
      for (let d = 0; d < 4; d++){
        const nc = c + DIRS[d][0], nr = r + DIRS[d][1];
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        const b = idx(nc, nr); if (!seen[b]) opts.push([d, b]);
      }
      if (!opts.length){ stack.pop(); continue; }
      const o = opts[Math.floor(rng() * opts.length)]; link(a, o[1], o[0]); seen[o[1]] = true; stack.push(o[1]);
    }
    const extras = [];
    for (let a = 0; a < NCELL; a++){
      const [c, r] = cr(a);
      [0, 1].forEach(d => { const nc = c + DIRS[d][0], nr = r + DIRS[d][1]; if (nc < COLS && nr < ROWS && adj[a][d] == null) extras.push([a, idx(nc, nr), d]); });
    }
    shuffle(extras, rng).slice(0, 7).forEach(e => link(e[0], e[1], e[2]));
    const start = Math.floor(rng() * NCELL);
    const dist = bfs(adj, start);
    const far = []; for (let i = 0; i < NCELL; i++) if (dist[i] >= MIN_DIST) far.push(i);
    if (!far.length) continue;
    const exit = far[Math.floor(rng() * far.length)];
    const deg = i => adj[i].filter(x => x != null).length;
    const rest = []; for (let i = 0; i < NCELL; i++) if (i !== start && i !== exit) rest.push(i);
    rest.sort((a, b) => (deg(b) + rng() * 1.5) - (deg(a) + rng() * 1.5));
    const roomCells = rest.slice(0, 10), names = shuffle(ROOM_NAMES, rng);
    const cells = new Array(NCELL);
    cells[start] = { type: 'room', name: '教室' };
    cells[exit] = { type: 'exit', name: '玄関' };
    roomCells.forEach((ci, k) => { cells[ci] = { type: 'room', name: names[k] }; });
    rest.slice(10).forEach(ci => { cells[ci] = { type: 'corridor', name: '廊下' }; });
    return { seed, adj, start, exit, cells, dist };
  }
  throw new Error('map generation failed');
}

/* ===== 共通 ===== */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GROUPS = ['A', 'B', 'C', 'D'];
const GCOLOR = { A: '#ff6b6b', B: '#4dabf7', C: '#69db7c', D: '#ffd43b' };
const PENALTY_MS = 30000;
const TEACHER_PIN = '2026';
const Q = new URLSearchParams(location.search);
const LOCAL = Q.has('local');
const MODE = (Q.has('host') || location.hash === '#teacher') ? 'teacher' : (location.hash === '#test' ? 'test' : 'student');
function lsGet(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
/* 参加コード:生徒はURLの ?room=、先生は保存してある(なければ新規作成) */
let ROOM = (Q.get('room') || '').toUpperCase();
if (MODE === 'teacher' && !ROOM){ ROOM = lsGet('esc.room') || rid(5); }
if (MODE === 'teacher') lsSet('esc.room', ROOM);
function studentUrl(){ return location.origin + location.pathname + '?room=' + ROOM + (LOCAL ? '&local=1' : ''); }
/* 参加URLをコピー(Clipboard API → だめなら選択コピー → それもだめなら表示だけ) */
function copyText(text){
  return new Promise(res => {
    const fb = () => {
      try {
        const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', '');
        t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
        document.body.appendChild(t); t.focus(); t.select(); t.setSelectionRange(0, text.length);
        const ok = document.execCommand('copy'); t.remove(); res(!!ok);
      } catch (e) { res(false); }
    };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => res(true), fb); else fb(); } catch (e) { fb(); }
  });
}
function copyUrlBtn(btn){
  const label = btn.dataset.label || btn.textContent; btn.dataset.label = label;
  copyText(studentUrl()).then(ok => {
    btn.textContent = ok ? 'コピーしました' : 'コピーできませんでした（アドレスを長押しで選択）';
    setTimeout(() => { btn.textContent = label; }, 2000);
  });
}
window.addEventListener('hashchange', () => location.reload());
const fmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

let DB = null;
async function initDb(){
  try {
    if (!ROOM) return null;
    DB = await Promise.race([connectDb(ROOM, LOCAL), new Promise(r => setTimeout(() => r(null), 10000))]);
  } catch (e) { console.warn(e); DB = null; }
  return DB;
}

/* ===== 学生側 ===== */
const KEY = 'escape_v2_' + (ROOM || 'none');
let S = null, MAP = null, G = null, walkStart = 0, walkP = 1, dbTried = false;
let dbOk = false, introSeen = false;
let GD = {}, seenFin = null, CLEAN = null, annTimer = null;

function blank(group){ return { group, introDone: false, resetId: null, seed: null, cell: null, facing: 0, phase: 'idle', solved: {}, assigned: {}, queue: [], hintCells: {}, hints: 0, wrong: 0, startedAt: 0, finishedAt: 0 }; }
function save(){ if (MODE === 'test') return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function load(){ if (MODE === 'test') return null; try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }

let sTimer = null;
function sub(text, ms){
  const el = $('sub'); el.textContent = text; el.classList.add('on');
  clearTimeout(sTimer); sTimer = setTimeout(() => el.classList.remove('on'), ms || 2600);
}

/* --- 共有（先生画面へ） --- */
let syncing = false, pending = null;
function snapshotData(){
  const info = MAP && S.cell != null ? MAP.cells[S.cell] : null;
  const p = S.assigned && S.assigned[S.cell] ? PUZZLES.find(x => x.id === S.assigned[S.cell]) : null;
  return {
    group: S.group, cell: S.cell, facing: S.facing, phase: S.phase,
    type: info ? info.type : null, name: info ? info.name : null,
    puzzleTitle: S.phase === 'puzzle' && p ? p.title : null,
    solved: Object.keys(S.solved).length, hints: S.hints, wrong: S.wrong,
    startedAt: S.startedAt, finishedAt: S.finishedAt, updatedAt: Date.now()
  };
}
async function sync(){
  if (MODE !== 'student' || !DB || !S || !S.group || !S.startedAt) return;
  pending = snapshotData();
  if (syncing) return;
  syncing = true;
  try { while (pending){ const d = pending; pending = null; await DB.doc('groups/' + S.group).set(d); } } catch (e) { /* 共有できなくてもゲームは続ける */ }
  syncing = false;
}


/* --- 読み物（物語・ルール・マップの描き方） --- */
const INTRO = [
  { t: '消えた放課後', h:
    '<p>今日の授業が終わったあと、君たちは教室に残って、課題を片づけていた。</p>' +
    '<p>気がつくと、窓の外はまっ暗。壁の時計は止まり、校内放送も聞こえない。<br>遠くで、チャイムが一度だけ鳴った。</p>' +
    '<p>扉を開けると、そこは見慣れた廊下ではなかった。いつもの校舎のはずなのに、扉と廊下がどこまでも続いている。</p>' +
    '<p>「夜になると、学校は迷宮に変わる」――生徒たちのあいだで語り継がれてきた、あの噂は本当だったのだ。</p>' +
    '<p>出口は、ただ一つ。「玄関」だけ。けれど、どの扉にも鍵がかかっている。鍵を開けられるのは、部屋に残された謎を解いた者だけだ。</p>' +
    '<p>夜が明ける前に、仲間と力を合わせて、校舎から脱出せよ。</p>' +
    '<p class="dim">……ただし、暗い廊下では、何かが君たちを見ているかもしれない。</p>' },
  { t: 'ルール', h:
    '<ul>' +
    '<li>部屋に入ると<b>お題</b>が出ます。みんなで話し合って、答えを入力しましょう。</li>' +
    '<li>正解すると鍵が開き、<b>扉</b>が現れます。扉は「正面・右・左・後ろ」のうち、つながっている方向にだけあります。</li>' +
    '<li>通ってきた扉は「後ろ」に残ります。迷ったら戻ってもかまいません。一度解いた部屋は、お題が出ません。</li>' +
    '<li><b>廊下</b>にお題はありません。ただ歩くだけ……のはずですが、何かが起こるかもしれません。</li>' +
    '<li>お題で詰まったら<b>ヒント</b>を見られます。ただし、1回につき<b>30秒</b>がタイムに加わります。</li>' +
    '<li>全グループが同じ校舎に閉じ込められています。</li>' +
    '<li>最初に<b>玄関</b>にたどり着いたグループの勝ちです（ヒントの30秒を足したタイムで決めます）。</li>' +
    '<li>脱出したグループがあると、ほかのグループの画面にお知らせが出ます。<b>最後まで脱出できなかったグループが、本日の掃除当番</b>です。</li>' +
    '<li><b>iPadやその他のデバイスを使って、検索することは一切禁止します。</b></li>' +
    '<li><b>使用できるのは、紙とペンのみです。</b></li>' +
    '<li>みんなで協力して脱出しましょう。</li>' +
    '</ul>' },
  { t: '地図を描こう', h:
    '<p>この学校は、迷宮です。しかも、ゲームのたびに形が変わります。<b>画面に地図は出ません。</b>自分たちで地図を描くことが、脱出への近道です。</p>' +
    '<ol>' +
    '<li>紙とペンを用意します。</li>' +
    '<li>最初にいる教室を「スタート」として、紙の中ほどに四角で描きます。そのとき向いている方向を、地図の<b>「上」</b>と決めます。</li>' +
    '<li>部屋は実線の四角、廊下は点線の四角で描き、部屋の名前（音楽室など）を書き込みます。</li>' +
    '<li>扉を通ったら、進んだ方角に新しいマスを描いて、線でつなぎます。</li>' +
    '<li>注意：<b>進んだ向きが、次の部屋の「正面」になります。</b>右の扉から出たら、次の部屋の「正面」は地図の「右」です。向きが変わるたびに、地図のどちらへ進んだのかを確かめましょう。</li>' +
    '<li>行き止まりや、お題を解いた部屋にしるしをつけておくと、迷いません。</li>' +
    '</ol>' +
    '<svg viewBox="0 0 360 86" class="ex" role="img"><title>地図の描き方の例</title>' +
    '<rect x="8" y="20" width="96" height="46" rx="8" fill="#5a4210" stroke="#e8c36a" stroke-width="2"/><text x="56" y="48" text-anchor="middle" font-size="14" fill="#ffe9b0">スタート</text>' +
    '<line x1="104" y1="43" x2="132" y2="43" stroke="#8a95b8" stroke-width="4"/>' +
    '<rect x="132" y="20" width="96" height="46" rx="8" fill="#1a1e30" stroke="#6b78a6" stroke-width="2" stroke-dasharray="6 5"/><text x="180" y="48" text-anchor="middle" font-size="14" fill="#aab3cc">廊下</text>' +
    '<line x1="228" y1="43" x2="256" y2="43" stroke="#8a95b8" stroke-width="4"/>' +
    '<rect x="256" y="20" width="96" height="46" rx="8" fill="#2d3350" stroke="#6b78a6" stroke-width="2"/><text x="304" y="48" text-anchor="middle" font-size="14" fill="#e6ebff">音楽室</text>' +
    '<text x="118" y="14" text-anchor="middle" font-size="11" fill="#cdb98a">右の扉</text><text x="242" y="14" text-anchor="middle" font-size="11" fill="#cdb98a">正面の扉</text>' +
    '</svg>' +
    '<p class="dim">役割を分けると、うまくいきます。例：地図係、お題を読む係、答えを入力する係、時間を見る係。</p>' }
];
function screenIntro(i, ro){
  if (!ro) hideUI();
  const pg = INTRO[i], last = i === INTRO.length - 1;
  showScreen('<div class="card intro"><div class="pg">' + (i + 1) + ' / ' + INTRO.length + '</div><h1>' + pg.t + '</h1><div class="itext">' + pg.h + '</div><div class="introbtns">' +
    (i > 0 ? '<button id="inPrev">戻る</button>' : '<span></span>') +
    (last ? '<button class="pri" id="inDone">' + (ro ? 'ゲームに戻る' : '読み終わった') + '</button>' : '<button class="pri" id="inNext">次へ</button>') + '</div></div>');
  const pv = $('inPrev'); if (pv) pv.onclick = () => screenIntro(i - 1, ro);
  const nx = $('inNext'); if (nx) nx.onclick = () => screenIntro(i + 1, ro);
  const dn = $('inDone');
  if (dn) dn.onclick = () => {
    if (ro){ showScreen(''); return; }
    S.introDone = true; introSeen = true; save(); screenWait();
    if (MODE === 'student') onGameState();
  };
}

/* --- 画面の切り替え --- */
function showScreen(html){ const s = $('screen'); s.innerHTML = html; s.hidden = !html; }
function hideUI(){ $('panel').hidden = true; $('doors').hidden = true; }

function screenSelect(){
  hideUI();
  showScreen('<div class="card"><h1>夜の校舎から脱出せよ</h1><p>グループを選んでください</p><div class="grid4">' +
    GROUPS.map(g => '<button class="gbtn" data-g="' + g + '" style="border-color:' + GCOLOR[g] + ';color:' + GCOLOR[g] + '">' + g + '</button>').join('') + '</div></div>');
  document.querySelectorAll('.gbtn').forEach(b => b.onclick = () => { Sound.init(); chooseGroup(b.dataset.g); });
}
function screenRoomCode(){
  hideUI();
  showScreen('<div class="card"><h1>夜の校舎から脱出せよ</h1><p>先生の画面に出ている参加コード（5文字）を入力してください</p><p><input id="rc" maxlength="5" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase;text-align:center;letter-spacing:.3em;width:9em"></p><p><button class="pri" id="rcOk">決定</button></p><p class="dim">先生のQRコードを読み取っても入れます</p></div>');
  const go = () => { const v = $('rc').value.trim().toUpperCase(); if (v.length >= 4) location.search = '?room=' + encodeURIComponent(v) + (LOCAL ? '&local=1' : ''); };
  $('rcOk').onclick = go; $('rc').onkeydown = e => { if (e.key === 'Enter') go(); };
}
function chooseGroup(g){ S = blank(g); S.introDone = introSeen; save(); afterGroup(); }

function screenWait(){
  hideUI();
  let msg, extra = '';
  if (MODE === 'test'){ msg = '練習モード（先生画面とはつながりません）'; extra = '<button class="pri" id="btnLocal">ゲーム開始</button>'; }
  else if (!dbTried) msg = '接続しています…';
  else if (!dbOk){ msg = '先生の画面と接続できません。ネットワークを確認してください。'; extra = '<button id="btnLocal">練習モードで始める</button>'; }
  else if (G && Array.isArray(G.active) && !G.active.includes(S.group)) msg = 'グループ ' + S.group + ' は、今回のゲームには参加しません。グループを選び直してください。';
  else msg = '先生の合図を待っています…';
  showScreen('<div class="card"><h1>グループ ' + esc(S.group) + '</h1><p>' + msg + '</p>' + extra + '<p><button class="ghost" id="btnReadAgain">物語とルールをもう一度読む</button> <button class="ghost" id="btnChg">グループを選び直す</button></p></div>');
  const l = $('btnLocal'); if (l) l.onclick = () => { Sound.init(); begin(Math.floor(Math.random() * 1e9), Date.now(), 'local'); };
  $('btnChg').onclick = () => { S = null; save(); screenSelect(); };
  const rd = $('btnReadAgain'); if (rd) rd.onclick = () => screenIntro(0, false);
}

function afterGroup(){
  if (S.startedAt && S.seed != null) resume();
  else if (!S.introDone) screenIntro(0, false);
  else screenWait();
  if (MODE === 'student') connectStudent();
}

async function connectStudent(){
  if (!dbTried){
    await initDb(); dbTried = true; dbOk = !!DB;
    if (DB){
      DB.doc('game/state').onSnapshot(snap => { G = snap.exists ? snap.data() : null; onGameState(); onGroups(); }, () => {});
      DB.collection('groups').onSnapshot(snap => { GD = {}; snap.docs.forEach(d => { GD[d.id] = d.data(); }); onGroups(); }, () => {});
    }
  }
  if (!S.startedAt && S.introDone) screenWait();
}

function onGameState(){
  if (MODE !== 'student' || !S || !S.group) return;
  if (G && S.resetId !== G.resetId){
    const had = S.resetId != null && (S.startedAt || S.seed != null);
    if (had) { const g = S.group, ib = S.introDone; S = blank(g); S.introDone = ib; MAP = null; seenFin = null; CLEAN = null; hideUI(); }
    S.resetId = G.resetId; save();
    if (had && S.introDone) screenWait();
  }
  if (!S.introDone) return;
  if (G && G.status === 'running' && !S.startedAt && G.seed != null && (!Array.isArray(G.active) || G.active.includes(S.group))) begin(G.seed, G.startedAt || Date.now(), G.resetId);
  else if (!S.startedAt) screenWait();
}

function begin(seed, startedAt, resetId){
  MAP = genMap(seed);
  S.seed = seed; S.resetId = resetId; S.startedAt = startedAt; S.finishedAt = 0;
  S.solved = {}; S.assigned = {}; S.hintCells = {}; S.hints = 0; S.wrong = 0;
  S.queue = shuffle(PUZZLES.map(p => p.id), Math.random);
  S.facing = Math.floor(Math.random() * 4);
  showScreen('');
  sub('気がつくと、真夜中の教室に閉じ込められていた…', 3600);
  enterCell(MAP.start, true);
}

function resume(){
  MAP = genMap(S.seed); showScreen('');
  if (S.phase === 'finished'){ finishScreen(); return; }
  if (S.phase === 'cleaning'){ screenCleaning(); return; }
  if (S.phase === 'puzzle') { showPuzzle(); return; }
  S.phase = 'choose'; showDoors(); sync();
}

/* --- マスへの進入 --- */
function enterCell(cell, first){
  S.cell = cell; const info = MAP.cells[cell];
  hideUI();
  if (info.type === 'exit'){ finish(); return; }
  if (info.type === 'room'){
    if (!first && Math.random() < 0.3){ Math.random() < 0.5 ? (Sound.whisper(), sub('……だれか いる……？')) : (Sound.creak(), sub('どこかで床がきしんだ…')); }
    if (S.solved[cell]){ S.phase = 'choose'; showDoors(); }
    else {
      if (!S.assigned[cell]){ if (!S.queue.length) S.queue = shuffle(PUZZLES.map(p => p.id), Math.random); S.assigned[cell] = S.queue.shift(); }
      S.phase = 'puzzle'; showPuzzle();
    }
  } else { startWalk(); }
  save(); sync();
}

function startWalk(){
  S.phase = 'walk'; walkStart = performance.now(); walkP = 0;
  const DUR = 5200;
  sub('ひんやりした廊下だ。足音がやけに響く…', 2800);
  const st = setInterval(() => { Sound.step(); }, 560);
  const pool = ['flicker', 'shadow', 'knock', 'whisper'].sort(() => Math.random() - 0.5).slice(0, 2);
  [1500, 3300].forEach((ms, i) => setTimeout(() => horror(pool[i]), ms));
  const tick = setInterval(() => {
    walkP = Math.min(1, (performance.now() - walkStart) / DUR);
    if (walkP >= 1){ clearInterval(tick); clearInterval(st); S.phase = 'choose'; showDoors(); save(); sync(); }
  }, 50);
}

function horror(kind){
  const fx = Scenes.fx, now = performance.now();
  if (kind === 'flicker'){ fx.flickerUntil = now + 1100; Sound.zap(); sub('照明がチカチカと点滅している…'); }
  else if (kind === 'shadow'){
    fx.shadow = 1; Sound.stinger(); sub('いま、廊下の奥に誰かいた……？', 2200);
    setTimeout(() => { fx.flickerUntil = performance.now() + 700; }, 700);
    setTimeout(() => { fx.blackUntil = performance.now() + 220; fx.shadow = 0; }, 1100);
  }
  else if (kind === 'knock'){ Sound.knock(); fx.shakeUntil = now + 700; sub('……コン、コン、コン。どこかの扉が叩かれている。'); }
  else { Sound.whisper(); sub('……だれか いる……？'); }
}

/* --- 扉 --- */
function exitsNow(){
  const out = [];
  for (let d = 0; d < 4; d++){ if (MAP.adj[S.cell][d] != null) out.push({ d, rel: REL[(d - S.facing + 4) % 4] }); }
  return out;
}
const REL_LABEL = { left: '左の扉', front: '正面の扉', right: '右の扉', back: '後ろの扉（戻る）' };
function showDoors(){
  $('panel').hidden = true;
  const box = $('doors'), ex = exitsNow(), order = ['left', 'front', 'right', 'back'];
  box.innerHTML = order.map(r => { const e = ex.find(x => x.rel === r); return e ? '<button class="dbtn" data-d="' + e.d + '" data-r="' + r + '">' + REL_LABEL[r] + '</button>' : ''; }).join('');
  box.hidden = false;
  box.querySelectorAll('.dbtn').forEach(b => b.onclick = () => go(Number(b.dataset.d), b.dataset.r));
}
function go(d, rel){
  if (S.phase !== 'choose') return;
  S.phase = 'moving'; $('doors').hidden = true;
  Sound.creak();
  const w = $('cvwrap'); w.className = 'mv-' + rel;
  setTimeout(() => {
    S.facing = d;
    const next = MAP.adj[S.cell][d];
    w.className = 'noanim'; void w.offsetWidth; w.className = 'fadein';
    enterCell(next);
  }, 880);
}
$('cv').addEventListener('pointerup', e => {
  if (!S || S.phase !== 'choose') return;
  const k = Scenes.hit(e.clientX, e.clientY); if (!k) return;
  const ex = exitsNow().find(x => x.rel === k); if (ex) go(ex.d, k);
});

/* --- お題 --- */
function curPuzzle(){ return PUZZLES.find(p => p.id === S.assigned[S.cell]); }
function showPuzzle(){
  const p = curPuzzle(), info = MAP.cells[S.cell], panel = $('panel');
  $('doors').hidden = true;
  let inp = '';
  if (p.type === 'choice') inp = '<div class="opts">' + p.options.map((o, i) => '<button class="opt" data-i="' + i + '">' + esc(o) + '</button>').join('') + '</div>';
  else inp = '<div class="prow"><input id="ans" type="text" inputmode="' + (p.type === 'num' ? 'numeric' : 'text') + '" autocomplete="off" autocapitalize="off" placeholder="答えを入力"><button class="pri" id="btnOk">鍵を試す</button></div>';
  const hintShown = S.hintCells[S.cell];
  panel.innerHTML = '<div class="ptitle">' + esc(info.name) + ' ・ ' + esc(p.title) + '</div><div class="pbody">' + p.body + '</div>' + inp +
    '<div class="prow"><button id="btnHint" class="ghost">ヒントを見る（+30秒）</button></div><div id="hint" class="hint">' + (hintShown ? 'ヒント：' + esc(p.hint) : '') + '</div><div id="pmsg"></div>';
  panel.hidden = false;
  const submit = v => answer(p, v);
  const ok = $('btnOk'); if (ok) ok.onclick = () => submit($('ans').value);
  const a = $('ans'); if (a) a.onkeydown = e => { if (e.key === 'Enter') submit(a.value); };
  panel.querySelectorAll('.opt').forEach(b => b.onclick = () => submit(b.dataset.i));
  $('btnHint').onclick = () => {
    if (!S.hintCells[S.cell]){ S.hintCells[S.cell] = true; S.hints++; save(); sync(); }
    $('hint').textContent = 'ヒント：' + p.hint;
  };
}
function answer(p, v){
  const msg = $('pmsg');
  if (p.type !== 'choice' && !String(v).trim()){ msg.textContent = '答えを入力してください'; msg.className = 'bad'; return; }
  if (checkAnswer(p, v)){
    Sound.chime(); setTimeout(() => Sound.unlock(), 350);
    S.solved[S.cell] = true; msg.textContent = 'カチッ…扉の鍵が開いた！'; msg.className = 'good';
    S.phase = 'choose'; save(); sync();
    setTimeout(() => { if (S.phase === 'choose') showDoors(); }, 1100);
  } else {
    S.wrong++; Sound.buzz(); msg.textContent = 'ガチャガチャ…鍵は開かない。もう一度みんなで考えよう。'; msg.className = 'bad';
    const pn = $('panel'); pn.classList.remove('shake'); void pn.offsetWidth; pn.classList.add('shake');
    save(); sync();
  }
}


/* --- 脱出のお知らせ・掃除当番 --- */
function activeList(){ return (G && Array.isArray(G.active) && G.active.length) ? G.active : GROUPS; }
function announce(text, kind, ms){
  const el = $('announce'); el.textContent = text; el.className = 'on ' + (kind || '');
  clearTimeout(annTimer); annTimer = setTimeout(() => { el.className = ''; }, ms || 7000);
}
function onGroups(){
  if (MODE !== 'student' || !S || !S.group || !S.startedAt) return;
  const act = activeList();
  const fin = act.filter(g => GD[g] && GD[g].finishedAt > 0 && GD[g].startedAt > 0);
  if (seenFin === null) seenFin = new Set(fin);
  [...seenFin].forEach(g => { if (!fin.includes(g)) seenFin.delete(g); });
  fin.forEach(g => {
    if (seenFin.has(g)) return;
    seenFin.add(g);
    if (g !== S.group && Date.now() - GD[g].finishedAt < 30000){ announce(g + 'グループが脱出に成功しました！', 'escape'); Sound.chime(); setTimeout(() => Sound.chime(), 450); }
  });
  let clean = null;
  if (act.length >= 2 && fin.length === act.length - 1){ const rest = act.filter(g => !fin.includes(g)); if (rest.length === 1) clean = rest[0]; }
  if (clean === CLEAN) return;
  CLEAN = clean;
  if (!clean) return;
  if (clean === S.group && S.phase !== 'finished'){
    S.phase = 'cleaning'; save(); sync(); hideUI(); Sound.stinger(); screenCleaning();
  } else {
    announce('最後に残ったのは ' + clean + 'グループ。本日の掃除当番は ' + clean + 'グループです。', 'clean', 12000);
    if (S.phase === 'finished') finishScreen();
  }
}
function screenCleaning(){
  hideUI();
  showScreen('<div class="card"><h1>脱出ならず…</h1><p>ほかのグループが、すべて脱出しました。</p><div class="big sm2">本日の掃除当番は<br>グループ ' + esc(S.group) + '</div><p>夜の校舎に、最後まで残ったのは君たちでした。</p></div>');
}

/* --- ゴール --- */
function finish(){
  S.phase = 'finished'; S.finishedAt = Date.now(); save(); sync();
  Sound.chime(); setTimeout(() => Sound.chime(), 500);
  finishScreen();
}
function finishScreen(){
  hideUI();
  const t = S.finishedAt - S.startedAt + S.hints * PENALTY_MS;
  showScreen('<div class="card"><h1>脱出成功！</h1><p>グループ ' + esc(S.group) + ' のタイム</p><div class="big">' + fmt(t) + '</div><p class="sm">ヒント ' + S.hints + '回（+' + (S.hints * 30) + '秒を含む）</p><p>ほかのグループの結果は、先生が発表します。</p>' + (CLEAN ? '<p class="clean">本日の掃除当番：' + esc(CLEAN) + 'グループ</p>' : '') + '</div>');
}

/* --- 画面の絵 --- */
function currentView(){
  if (!S || !MAP || S.cell == null || S.phase === 'idle' || S.phase === 'cleaning') return { kind: 'title' };
  const info = MAP.cells[S.cell];
  if (info.type === 'exit' || S.phase === 'finished') return { kind: 'exit' };
  const doors = {};
  exitsNow().forEach(e => { if (e.rel === 'back') return; doors[e.rel] = info.type === 'room' ? (S.solved[S.cell] ? 2 : 1) : (S.phase === 'choose' ? 2 : 1); });
  if (info.type === 'room') return { kind: 'room', name: info.name, doors };
  return { kind: 'corridor', walk: S.phase === 'walk' ? walkP : 1, doors };
}

function startStudent(){
  $('game').hidden = false;
  Scenes.start(currentView);
  document.addEventListener('pointerdown', () => Sound.init(), { once: true });
  $('btnSound').onclick = () => { Sound.init(); $('btnSound').textContent = Sound.toggle() ? '音：OFF' : '音：ON'; };
  setInterval(() => {
    const hud = $('hudTime');
    if (S && S.startedAt){
      const el = (S.finishedAt || Date.now()) - S.startedAt + S.hints * PENALTY_MS;
      hud.textContent = fmt(el); $('hudGroup').textContent = 'グループ ' + S.group;
    } else { hud.textContent = ''; $('hudGroup').textContent = S && S.group ? 'グループ ' + S.group : ''; }
  }, 500);
  $('btnRead').onclick = () => { if ($('screen').hidden && S && S.startedAt && S.phase !== 'finished') screenIntro(0, true); };
  if (MODE === 'student' && !ROOM){ screenRoomCode(); return; }
  const saved = load();
  if (saved && saved.group){ S = saved; if (S.introDone) introSeen = true; afterGroup(); }
  else screenSelect();
}

/* ===== 先生側 ===== */
let TG = {}, TS = null, TMAP = null, tCreating = false, tErr = '', resetArmed = 0;

function startTeacher(){
  const root = $('teacher'); root.hidden = false;
  let ok = false; try { ok = sessionStorage.getItem('esc_pin') === '1'; } catch (e) {}
  if (!ok){
    root.innerHTML = '<div class="tgate"><h1>先生用画面</h1><p>PINを入力してください</p><input id="pin" type="password" inputmode="numeric" autocomplete="off"><button class="pri" id="pinOk">開く</button><div id="pinMsg" class="bad"></div></div>';
    const go = () => { if ($('pin').value === TEACHER_PIN){ try { sessionStorage.setItem('esc_pin', '1'); } catch (e) {} startTeacherMain(); } else $('pinMsg').textContent = 'PINが違います'; };
    $('pinOk').onclick = go; $('pin').onkeydown = e => { if (e.key === 'Enter') go(); };
    return;
  }
  startTeacherMain();
}

async function startTeacherMain(){
  const root = $('teacher');
  root.innerHTML = '<div class="tgate"><p>接続しています…</p></div>';
  await initDb();
  if (!DB){ root.innerHTML = '<div class="tgate"><h1>先生用画面</h1><p>共有データに接続できません。ネットワークを確認して、ページを開き直してください。</p></div>'; return; }
  DB.doc('game/state').onSnapshot(snap => {
    TS = snap.exists ? snap.data() : null;
    if (!TS && !tCreating){ tCreating = true; newGame(false); }
    if (TS) TMAP = (TMAP && TMAP.seed === TS.seed) ? TMAP : genMap(TS.seed);
    renderTeacher();
  }, e => { tErr = '状態の取得に失敗: ' + e.code; renderTeacher(); });
  DB.collection('groups').onSnapshot(snap => {
    TG = {}; snap.docs.forEach(d => { TG[d.id] = d.data(); }); renderTeacher();
  }, e => { tErr = 'グループ情報の取得に失敗: ' + e.code; renderTeacher(); });
  setInterval(renderTeacher, 1000);
}

async function newGame(clear){
  try {
    await DB.doc('game/state').set({ status: 'waiting', seed: Math.floor(Math.random() * 1e9), resetId: Date.now(), startedAt: 0, active: (TS && TS.active) || GROUPS });
    if (clear) for (const g of GROUPS) await DB.doc('groups/' + g).delete();
    tErr = '';
  } catch (e) { tErr = '書き込みできません（先生のアカウントで開いていますか？）: ' + (e.code || e.message); renderTeacher(); }
}
async function toggleActive(g){
  const cur = (TS && TS.active) || GROUPS, next = cur.includes(g) ? cur.filter(x => x !== g) : GROUPS.filter(x => cur.includes(x) || x === g);
  if (next.length < 2){ tErr = '参加グループは2つ以上にしてください'; renderTeacher(); return; }
  try { await DB.doc('game/state').update({ active: next }); tErr = ''; } catch (e) { tErr = '変更できません: ' + (e.code || e.message); renderTeacher(); }
}
async function startGame(){
  try { await DB.doc('game/state').update({ status: 'running', startedAt: Date.now() }); tErr = ''; }
  catch (e) { tErr = '開始できません: ' + (e.code || e.message); renderTeacher(); }
}

function teacherMapSvg(){
  const M = TMAP, cw = 118, ch = 74, gx = 24, gy = 22, pad = 16;
  const X = c => pad + c * (cw + gx), Y = r => pad + (ROWS - 1 - r) * (ch + gy);
  const w = pad * 2 + COLS * cw + (COLS - 1) * gx, h = pad * 2 + ROWS * ch + (ROWS - 1) * gy;
  let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" class="tmap">';
  for (let a = 0; a < NCELL; a++){
    const [c, r] = cr(a);
    [1, 0].forEach(d => { const b = M.adj[a][d]; if (b == null) return; const [c2, r2] = cr(b); s += '<line x1="' + (X(c) + cw / 2) + '" y1="' + (Y(r) + ch / 2) + '" x2="' + (X(c2) + cw / 2) + '" y2="' + (Y(r2) + ch / 2) + '" stroke="#5b6785" stroke-width="5" stroke-linecap="round"/>'; });
  }
  for (let a = 0; a < NCELL; a++){
    const [c, r] = cr(a), info = M.cells[a];
    let fill = '#2d3350', stroke = '#6b78a6', tc = '#e6ebff';
    if (info.type === 'corridor'){ fill = '#1a1e30'; stroke = '#4a5170'; tc = '#9aa3c2'; }
    if (a === M.start){ fill = '#5a4210'; stroke = '#e8c36a'; tc = '#ffe9b0'; }
    if (info.type === 'exit'){ fill = '#1b4a34'; stroke = '#69db7c'; tc = '#c8f7d4'; }
    s += '<rect x="' + X(c) + '" y="' + Y(r) + '" width="' + cw + '" height="' + ch + '" rx="10" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2" ' + (info.type === 'corridor' ? 'stroke-dasharray="6 5"' : '') + '/>';
    s += '<text x="' + (X(c) + 10) + '" y="' + (Y(r) + 22) + '" fill="' + tc + '" font-size="15" font-weight="500">' + info.name + (a === M.start ? '（スタート）' : '') + '</text>';
  }
  const at = {};
  GROUPS.forEach(g => { const d = TG[g]; if (d && d.cell != null && d.startedAt){ (at[d.cell] = at[d.cell] || []).push(g); } });
  Object.keys(at).forEach(k => {
    const [c, r] = cr(Number(k));
    at[k].forEach((g, i) => {
      const cx = X(c) + 24 + i * 30, cy = Y(r) + ch - 22, fcg = TG[g].facing || 0;
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="13" fill="' + GCOLOR[g] + '"/><text x="' + cx + '" y="' + (cy + 5) + '" text-anchor="middle" font-size="14" font-weight="700" fill="#10131f">' + g + '</text>';
      const arrow = ['▲', '▶', '▼', '◀'][fcg];
      s += '<text x="' + cx + '" y="' + (cy - 17) + '" text-anchor="middle" font-size="9" fill="' + GCOLOR[g] + '">' + arrow + '</text>';
    });
  });
  return s + '</svg>';
}

function showQr(){
  const ov = document.createElement('div'); ov.className = 'qrov';
  ov.innerHTML = '<div class="qrcard"><h2>参加コード　' + ROOM + '</h2><div id="qrBox"></div><p>各グループのiPadでQRコードを読み取るか、URLをコピーして送ってください</p><p class="dim" style="word-break:break-all;user-select:all;-webkit-user-select:all">' + esc(studentUrl()) + '</p><p><button class="pri" id="qrCopy">参加URLをコピー</button> <button class="ghost" id="qrClose">閉じる</button></p></div>';
  document.body.appendChild(ov); $('qrCopy').onclick = e => copyUrlBtn(e.currentTarget); $('qrClose').onclick = () => ov.remove(); ov.onclick = e => { if (e.target === ov) ov.remove(); };
  if (window.QRCode) new QRCode($('qrBox'), { text: studentUrl(), width: 280, height: 280, correctLevel: QRCode.CorrectLevel.M });
  else $('qrBox').textContent = '（QRを作れませんでした。上のアドレスを使ってください）';
}
function renderTeacher(){
  const root = $('teacher'); if (!TS || !TMAP || !DB) return;
  const running = TS.status === 'running', now = Date.now();
  const act = TS.active || GROUPS;
  const rank = act.filter(g => TG[g] && TG[g].finishedAt && TG[g].startedAt).map(g => ({ g, t: TG[g].finishedAt - TG[g].startedAt + (TG[g].hints || 0) * PENALTY_MS })).sort((a, b) => a.t - b.t);
  let cards = '';
  let clean = null;
  if (act.length >= 2 && rank.length === act.length - 1){ const rest = act.filter(g => !rank.some(x => x.g === g)); if (rest.length === 1) clean = rest[0]; }
  GROUPS.forEach(g => {
    const d = TG[g]; let body;
    if (!act.includes(g)) body = '<div class="tsub">今回は不参加</div>';
    else if (!d || !d.startedAt) body = '<div class="tsub">' + (running ? '未参加' : '待機中') + '</div>';
    else {
      const [c, r] = d.cell != null ? cr(d.cell) : [0, 0];
      const fin = d.finishedAt > 0, el = (fin ? d.finishedAt : now) - d.startedAt + (d.hints || 0) * PENALTY_MS;
      const place = rank.findIndex(x => x.g === g);
      const st = fin ? '脱出！ ' + (place + 1) + '位' : (d.phase === 'cleaning' ? '本日の掃除当番に決定' : d.phase === 'puzzle' ? 'お題に挑戦中' : d.phase === 'walk' ? '廊下を歩いている' : d.phase === 'moving' ? '扉を開けた' : '扉を選んでいる');
      const idle = Math.floor((now - (d.updatedAt || now)) / 1000);
      body = '<div class="tstat">' + st + '</div><div class="tsub">現在地：' + esc(d.name || '') + '（' + (c + 1) + '列' + (r + 1) + '行）</div>' +
        (d.puzzleTitle ? '<div class="tsub">お題：' + esc(d.puzzleTitle) + '</div>' : '') +
        '<div class="tsub">解いた部屋 ' + (d.solved || 0) + ' ・ ヒント ' + (d.hints || 0) + ' ・ 誤答 ' + (d.wrong || 0) + '</div>' +
        '<div class="tsub">経過 ' + fmt(el) + (!fin && idle > 90 ? ' ・ <span class="bad">' + idle + '秒間 動きなし</span>' : '') + '</div>';
    }
    cards += '<div class="tcard" style="border-color:' + GCOLOR[g] + '"><div class="tname" style="color:' + GCOLOR[g] + '">グループ ' + g + '</div>' + body + '</div>';
  });
  root.innerHTML = '<div class="thead"><div><b>先生用 進行状況</b> <span class="pill ' + (running ? 'run' : '') + '">' + (running ? '進行中' : '待機中') + '</span> <span class="roomcode">参加コード <b>' + ROOM + '</b>' + (LOCAL ? '（お試し）' : '') + '</span> <button class="ghost" id="tQr">QRを表示</button> <button class="ghost" id="tCopy">参加URLをコピー</button></div><div class="tbtns">' +
    (running ? '' : '<button id="tRegen">マップを作り直す</button><button class="pri" id="tStart">ゲーム開始</button>') +
    '<button id="tReset">' + (now - resetArmed < 4000 ? 'もう一度押すとリセット' : 'リセット（新しいゲーム）') + '</button></div></div>' +
    (tErr ? '<div class="bad tmsg">' + esc(tErr) + '</div>' : '') +
    (running ? '' : '<div class="tchips">参加グループ：' + GROUPS.map(g => '<button class="chip' + (act.includes(g) ? ' on' : '') + '" data-g="' + g + '" style="--c:' + GCOLOR[g] + '">' + g + '</button>').join('') + '</div>') +
    (clean ? '<div class="tclean">本日の掃除当番：' + clean + 'グループ</div>' : '') +
    '<div class="tbody"><div class="tmapwrap">' + teacherMapSvg() + '<div class="tleg">点線＝廊下 ／ 実線＝部屋 ／ 線＝扉でつながっている ／ 矢印＝向いている方角</div></div><div class="tside">' + cards + '</div></div>';
  root.querySelectorAll('.chip').forEach(b => b.onclick = () => toggleActive(b.dataset.g));
  $('tQr').onclick = showQr;
  $('tCopy').onclick = e => copyUrlBtn(e.currentTarget);
  const b1 = $('tStart'); if (b1) b1.onclick = startGame;
  const b2 = $('tRegen'); if (b2) b2.onclick = () => newGame(true);
  $('tReset').onclick = () => {
    if (!running || Date.now() - resetArmed < 4000){ resetArmed = 0; newGame(true); }
    else { resetArmed = Date.now(); renderTeacher(); }
  };
}

/* ===== 起動 ===== */
if (MODE === 'teacher') startTeacher();
else startStudent();
