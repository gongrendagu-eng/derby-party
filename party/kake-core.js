/* =====================================================================
   kake-core.js — 駆け引きゲーム(インカの黄金・ハゲタカのえじき・最小数ゲーム)の共通部分
   ---------------------------------------------------------------------
   trump-core.js と同じしくみ:先生のPCが親機、iPadが子機。
   ちがい:「班で参加(team)」と「一人ずつ参加(solo)」の2つに対応。
     team … 班の名前を先生が決め、iPadで自分の班をタッチ。下位の班から掃除場所。
     solo … 各自のiPadでニックネーム(または名簿の名前)で参加。下位○人が掃除当番。
   ゲームごとのルールと見た目は各HTMLの KC.game({...}) に書く。
   ===================================================================== */
(function(){
'use strict';
const KC = window.KC = {};
const FB_VER = '10.12.2';
const Q = new URLSearchParams(location.search);
const IS_PAD = Q.has('room');
const $ = s => document.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ls(k, v){ try{ if(v===undefined){ const x=localStorage.getItem(k); return x==null?null:JSON.parse(x); } localStorage.setItem(k, JSON.stringify(v)); }catch(e){ return null; } }
function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }
function code5(){ const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<5;i++) s+=A[Math.random()*A.length|0]; return s; }
const arr = v => v==null ? [] : Array.isArray(v) ? v : Object.values(v);   // Firebase は配列を物にすることがある
Object.assign(KC, {$, esc, ls, lsDel, shuffle, code5, arr, IS_PAD});

/* ---------- 共通の見た目(配置だけ。色はゲーム側の CSS 変数で決める) ---------- */
const BASE_CSS = `
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font-family:var(--sys,'BIZ UDPGothic','Hiragino Sans','Yu Gothic','Meiryo',sans-serif)}
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
button{font:inherit;color:inherit;cursor:pointer;touch-action:manipulation}
button:focus-visible,a:focus-visible{outline:3px solid var(--acc);outline-offset:2px}
[hidden]{display:none!important}
.scr{min-height:100%}
/* 設定 */
#setup{display:grid;place-items:center;padding:4vh 16px}
.panel{width:min(900px,100%);background:var(--panel);border:2px solid var(--line);border-radius:18px;padding:28px 32px}
.hero{display:flex;align-items:center;gap:22px;margin-bottom:20px}
.hero h1{font-family:var(--disp);font-weight:400;font-size:52px;margin:0;color:var(--acc);line-height:1.1}
.hero p{margin:4px 0 0;color:var(--dim)}
.hero .art{display:flex;flex:none;font-size:64px;line-height:1}
.form{display:grid;grid-template-columns:1fr 1fr;gap:18px 26px}
.form label.t{display:block;font-weight:700;margin-bottom:6px}
.form textarea,.form select{width:100%;background:var(--field);color:var(--ink);border:2px solid var(--line);border-radius:10px;padding:10px;font:inherit;font-size:16px}
.form textarea{height:150px;resize:vertical}
.form .hint{font-size:13px;color:var(--dim);margin-top:4px}
.opt{display:flex;gap:8px;align-items:flex-start;margin:6px 0;font-size:15px}
.opt input{margin-top:4px;width:18px;height:18px;flex:none;accent-color:var(--acc)}
.rules{margin-top:18px;background:var(--field);border-radius:12px;padding:12px 16px;font-size:14px;line-height:1.75;color:var(--ink)}
.rules summary{cursor:pointer;font-weight:700}
.row{display:flex;gap:12px;align-items:center;justify-content:flex-end;margin-top:22px;flex-wrap:wrap}
.btn{border:0;border-radius:12px;padding:14px 24px;font-size:18px;font-weight:700;background:var(--btn);color:var(--btnink,var(--ink));text-decoration:none;display:inline-block}
.btn.main{background:var(--acc);color:var(--accink);font-family:var(--disp);font-weight:400;font-size:22px;box-shadow:0 5px 0 var(--accsh)}
.btn.main:active{transform:translateY(3px);box-shadow:0 2px 0 var(--accsh)}
.btn:disabled{opacity:.45;cursor:default}
.err{color:var(--bad);font-weight:700;min-height:1.4em;margin-top:10px}
.ver{color:var(--dim);opacity:.7;font-size:12px;text-align:right;margin-top:8px}
/* 参加受付 */
#lobby{display:grid;grid-template-columns:auto 1fr;gap:5vmin;align-items:start;padding:5vmin 6vmin;min-height:100vh}
.qrbox{background:#fff;border-radius:18px;padding:18px;display:grid;place-items:center;min-width:300px;min-height:300px;color:#222}
.qrbox img,.qrbox canvas{display:block}
.code{font-family:var(--disp);font-size:clamp(40px,8vmin,96px);letter-spacing:.14em;color:var(--acc)}
.lobbyInfo h2{font-family:var(--disp);font-weight:400;font-size:clamp(26px,4vmin,44px);margin:0 0 6px}
.lobbyInfo .url{color:var(--dim);word-break:break-all;margin:6px 0 18px;font-size:14px}
.jlist{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin:10px 0 22px}
.jl{background:var(--panel);border:2px solid var(--line);border-radius:14px;padding:12px 14px;font-size:22px;font-weight:700;display:flex;justify-content:space-between;align-items:center;gap:8px}
.jl.ok{border-color:var(--acc)}
.jl small{font-size:15px;color:var(--dim)}
.jl.ok small{color:var(--acc)}
.jl .x{border:0;background:none;color:var(--dim);font-size:20px;padding:0 4px}
.jl .x:hover{color:var(--bad)}
.jl.solo{font-size:20px;padding:10px 12px}
.jl.solo .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.jl.solo .dot{width:10px;height:10px;border-radius:50%;background:var(--line);flex:none}
.jl.solo.ok .dot{background:var(--acc)}
.jcount{font-family:var(--disp);font-size:clamp(22px,3vmin,32px);color:var(--acc)}
.warn{color:var(--bad);font-weight:700}
/* 先生のゲーム画面 */
#table{display:flex;flex-direction:column;height:100vh;overflow:hidden}
#table>header{display:flex;align-items:center;gap:1.2vmin;padding:1.1vmin 2vmin;background:var(--bar);border-bottom:2px solid var(--line);flex:none;flex-wrap:wrap}
#table>header .ttl{font-family:var(--disp);color:var(--acc);font-size:3.2vmin;margin-right:auto}
.hb{background:var(--btn);border:1px solid var(--line);border-radius:10px;padding:.9vmin 1.5vmin;font-size:max(14px,1.8vmin);font-weight:700;color:var(--btnink,var(--ink));text-decoration:none}
.hb.code{letter-spacing:.1em;color:var(--acc)}
.hb.go{background:var(--acc);color:var(--accink);border-color:var(--acc);font-family:var(--disp);font-weight:400;font-size:max(16px,2.2vmin);padding:.9vmin 2.4vmin;box-shadow:0 .5vmin 0 var(--accsh)}
.hb:disabled{opacity:.4}
#stage{position:relative;flex:1;overflow:hidden;min-height:0}
#telop{position:fixed;left:0;right:0;top:50%;transform:translateY(-50%);pointer-events:none;display:grid;place-items:center;z-index:30}
#telop div{font-family:var(--disp);font-size:9vmin;padding:1vmin 8vmin;background:linear-gradient(90deg,transparent,rgba(0,0,0,.82) 20%,rgba(0,0,0,.82) 80%,transparent);color:var(--tc,#fff);text-shadow:0 .5vmin 0 #000;white-space:nowrap;animation:kcTel 1.8s ease both}
@keyframes kcTel{0%{transform:scaleX(0);opacity:0}12%{transform:scaleX(1.08);opacity:1}20%{transform:none}82%{opacity:1}100%{opacity:0;transform:translateY(-2vmin)}}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.78);display:grid;place-items:center;z-index:40;padding:3vmin}
.mbox{background:var(--panel);color:var(--ink);border:3px solid var(--acc);border-radius:22px;padding:3vmin 4vmin;max-width:min(1250px,96vw);max-height:94vh;overflow:auto}
.mbox h2{font-family:var(--disp);font-weight:400;color:var(--acc);font-size:5vmin;margin:0 0 2vmin;text-align:center}
.res{width:100%;border-collapse:collapse;font-size:2.4vmin}
.res td,.res th{padding:1vmin 1.4vmin;border-bottom:1px solid var(--line);vertical-align:middle;text-align:left}
.res .rk{font-family:var(--disp);font-size:3.4vmin;color:var(--acc);white-space:nowrap}
.res .nm{font-family:var(--disp);font-size:3vmin;white-space:nowrap}
.res .pl{font-family:var(--disp);color:var(--bad);font-size:3vmin;white-space:nowrap}
.cleaners{text-align:center;margin:0 0 2.4vmin}
.cleaners .lb{font-size:2.2vmin;color:var(--dim);font-weight:700}
.cleaners .nms{display:flex;flex-wrap:wrap;justify-content:center;gap:1vmin;margin-top:1vmin}
.cleaners .nms span{font-family:var(--disp);font-size:3.6vmin;color:#fff;background:var(--bad);border-radius:1.2vmin;padding:.4vmin 1.6vmin}
.rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(26vmin,1fr));gap:1vmin}
.rcell{display:flex;align-items:center;gap:1.2vmin;background:var(--field);border:2px solid var(--line);border-radius:1.2vmin;padding:.8vmin 1.2vmin;font-size:2.3vmin}
.rcell .rk{font-family:var(--disp);color:var(--acc);font-size:2.8vmin;min-width:4.6vmin}
.rcell .nm{font-weight:700;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcell .sc{color:var(--dim);white-space:nowrap}
.rcell.cl{border-color:var(--bad);background:color-mix(in srgb,var(--bad) 22%,var(--field))}
.tie{margin-top:2vmin;text-align:center;color:var(--bad);font-weight:700;font-size:2.4vmin}
.tie.sub{color:var(--dim)}
.cd{font-variant-numeric:tabular-nums}
.cd.low{color:var(--bad)}
/* iPad */
#pad{min-height:100vh;display:flex;flex-direction:column;padding:12px;gap:10px}
.pjoin{max-width:760px;margin:6vh auto 0;text-align:center;width:100%}
.pjoin h1{font-family:var(--disp);font-weight:400;color:var(--acc);font-size:clamp(40px,7vw,64px);margin:0}
.pjoin p{font-size:18px}
.gpick{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-top:22px}
.gpick button{background:var(--panel);border:3px solid var(--line);border-radius:16px;padding:22px 10px;font-family:var(--disp);font-size:28px;box-shadow:0 5px 0 rgba(0,0,0,.3)}
.gpick button small{display:block;font-family:var(--sys,sans-serif);font-size:15px;color:var(--dim);margin-top:6px}
.gpick button:disabled{opacity:.35}
.gpick.rost button{font-size:22px;padding:16px 8px}
.nick{display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap}
.nick input{font:inherit;font-size:26px;padding:12px 16px;border-radius:14px;border:3px solid var(--line);background:var(--field);color:var(--ink);width:min(420px,90vw);text-align:center}
.wait{color:var(--dim);font-size:22px;margin-top:26px;font-weight:700}
.linkbtn{background:none;border:0;color:var(--dim);text-decoration:underline;margin-top:24px;font-size:16px}
.pres{font-family:var(--disp);font-size:clamp(28px,5vw,48px);color:var(--acc);text-align:center;margin:10px 0}
.oldver{position:fixed;left:0;right:0;bottom:0;background:var(--bad);color:#fff;text-align:center;padding:10px;font-weight:700;z-index:50}
.pb{border:0;border-radius:14px;padding:16px 22px;font-family:var(--disp);font-size:clamp(18px,2.8vw,26px);min-width:150px;background:var(--btn);color:var(--btnink,var(--ink));box-shadow:0 5px 0 rgba(0,0,0,.35)}
.pb:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.35)}
.pb:disabled{opacity:.35}
.pb.go{background:var(--acc);color:var(--accink);box-shadow:0 5px 0 var(--accsh)}
.ptick{border-radius:12px;padding:10px 16px;font-size:clamp(18px,3vw,26px);font-weight:700;display:flex;align-items:center;gap:12px;min-height:1.8em;background:var(--bar);border:2px solid var(--line)}
.ptick .me{margin-left:auto;color:var(--acc);font-size:.85em;white-space:nowrap}
.pothers{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px}
.poc{flex:none;background:var(--panel);border:2px solid var(--line);border-radius:12px;padding:6px 12px;text-align:center;min-width:92px}
.poc b{display:block;font-size:15px;white-space:nowrap}
.poc span{font-family:var(--disp);font-size:22px}
.poc.me{border-color:var(--acc);border-style:dashed}
.pmsg{border-radius:12px;padding:10px 14px;text-align:center;font-weight:700;background:var(--panel);border:2px solid var(--acc);font-size:clamp(16px,2.6vw,22px)}
@media (max-width:760px){ .form{grid-template-columns:1fr} #lobby{grid-template-columns:1fr} }
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

/* ---------- 通信(Firebase / お試し) ---------- */
function loadScript(src){ return new Promise((ok,ng)=>{ const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=()=>ng(new Error('読み込めませんでした:'+src)); document.head.appendChild(s); }); }
function fbCfg(){
  if(window.FIREBASE_CONFIG) return window.FIREBASE_CONFIG;
  try{ if(typeof firebaseConfig!=='undefined') return firebaseConfig; }catch(e){}   // eslint-disable-line no-undef
  return window.FB_CONFIG || window.fbConfig || null;
}
async function firebaseBackend(root){
  const cfg = fbCfg();
  if(!cfg) throw new Error('firebase-config.js が見つかりません。ほかのゲームと同じフォルダに置いてください。');
  await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`);
  await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-database-compat.js`);
  if(!firebase.apps.length) firebase.initializeApp(cfg);
  const db = firebase.database();
  const R = p => db.ref(root + (p ? '/'+p : ''));
  return {
    kind:'firebase',
    set:(p,v)=>R(p).set(v).catch(e=>console.warn(e)),
    remove:p=>R(p).remove().catch(e=>console.warn(e)),
    on:(p,cb)=>{ const r=R(p), f=s=>cb(s.val()); r.on('value',f); return ()=>r.off('value',f); },
    presence:p=>{ const r=R(p); const c=db.ref('.info/connected'); const f=s=>{ if(s.val()){ r.onDisconnect().remove(); r.set(Date.now()); } }; c.on('value',f); return ()=>{ c.off('value',f); r.remove(); }; },
  };
}
function localBackend(root){
  const P = 'lo:'+root+'/';
  const subs = [];
  const keys = () => { const a=[]; try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k.startsWith(P)) a.push(k.slice(P.length)); } }catch(e){} return a; };
  function build(path){
    const ex = ls(P+path); if(ex!=null) return ex;
    let out = null;
    for(const k of keys()){
      if(!k.startsWith(path+'/')) continue;
      const parts = k.slice(path.length+1).split('/');
      out = out || {}; let o = out;
      for(let i=0;i<parts.length-1;i++){ o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
      o[parts[parts.length-1]] = ls(P+k);
    }
    return out;
  }
  const rel = (a,b) => a===b || a.startsWith(b+'/') || b.startsWith(a+'/');
  function notify(changed){ for(const s of subs.slice()) if(rel(changed, s.p)) s.cb(build(s.p)); }
  function clear(p){ for(const k of keys()) if(k===p || k.startsWith(p+'/') || p==='') lsDel(P+k); }
  window.addEventListener('storage', e => { if(e.key && e.key.startsWith(P)) notify(e.key.slice(P.length)); else if(e.key===null) subs.forEach(s=>s.cb(build(s.p))); });
  return {
    kind:'local',
    set:(p,v)=>{ clear(p); if(v!=null) ls(P+p, v); notify(p); },
    remove:p=>{ clear(p); notify(p); },
    on:(p,cb)=>{ const s={p,cb}; subs.push(s); setTimeout(()=>cb(build(p)),0); return ()=>{ const i=subs.indexOf(s); if(i>=0) subs.splice(i,1); }; },
    presence:p=>{ const put=()=>{ ls(P+p, Date.now()); notify(p); }; put(); const t=setInterval(put,3000); const bye=()=>{ lsDel(P+p); notify(p); }; addEventListener('pagehide',bye); return ()=>{ clearInterval(t); removeEventListener('pagehide',bye); bye(); }; },
  };
}
async function connectNet(kind, room){ const root='rooms/'+room; return kind==='local' ? localBackend(root) : await firebaseBackend(root); }
// presence/{参加キー}/{端末} の数
function presCount(pres, key, net){
  const o = pres && pres[key]; if(!o) return 0;
  const now = Date.now();
  return Object.values(o).filter(t => t && (net.kind!=='local' || now - t < 8000)).length;
}
function makeQR(el, text){
  el.innerHTML = '';
  const draw = () => { try{ new QRCode(el, {text, width:280, height:280, correctLevel:QRCode.CorrectLevel.M}); }catch(e){ el.textContent='QRコードを作れませんでした。参加コードを入力してください。'; } };
  if(window.QRCode) draw();
  else loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js').then(draw).catch(()=>{ el.textContent='QRコードを読み込めませんでした(ネット接続を確認)。'; });
}

/* ---------- 効果音(先生のPCだけ) ---------- */
let AC = null, soundOn = true;
function ac(){ if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(AC && AC.state==='suspended') AC.resume(); return AC; }
function tone(f, t, d, type='square', v=.1){ const o=AC.createOscillator(), g=AC.createGain(); o.type=type; o.frequency.value=f; g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.001,t+d); o.connect(g).connect(AC.destination); o.start(t); o.stop(t+d+.02); }
function noise(t, d, v=.15, fq=2400){ const b=AC.createBuffer(1, Math.max(1,AC.sampleRate*d|0), AC.sampleRate), a=b.getChannelData(0); for(let i=0;i<a.length;i++) a[i]=(Math.random()*2-1)*(1-i/a.length); const s=AC.createBufferSource(), f=AC.createBiquadFilter(), g=AC.createGain(); f.type='bandpass'; f.frequency.value=fq; g.gain.value=v; s.buffer=b; s.connect(f).connect(g).connect(AC.destination); s.start(t); }
function sfx(k){
  if(!soundOn || IS_PAD || !ac()) return; const t = AC.currentTime;
  if(k==='card'){ noise(t,.07,.22,3200); tone(220,t,.06,'sine',.15); }
  else if(k==='flip'){ noise(t,.05,.18,4200); }
  else if(k==='good'){ tone(660,t,.09); tone(990,t+.09,.18); }
  else if(k==='coin'){ tone(988,t,.06,'square',.07); tone(1319,t+.06,.22,'square',.07); }
  else if(k==='bad'){ tone(200,t,.35,'sawtooth',.12); tone(150,t+.05,.35,'square',.05); }
  else if(k==='crash'){ noise(t,.9,.6,300); noise(t+.05,.6,.35,900); tone(70,t,.8,'sine',.5); }
  else if(k==='big'){ [392,523,659,784].forEach((f,i)=>tone(f,t+i*.08,.16,'square',.08)); }
  else if(k==='alarm'){ [0,.16,.32].forEach(d=>tone(1250,t+d,.1,'square',.09)); }
  else if(k==='stamp'){ noise(t,.18,.5,500); tone(90,t,.25,'sine',.4); }
  else if(k==='drum'){ for(let i=0;i<22;i++) noise(t+i*.055,.05,.12+i*.006,700); }
  else if(k==='win'){ [523,659,784,1047,784,1047].forEach((f,i)=>tone(f,t+i*.12,.18,'square',.08)); }
  else if(k==='tick'){ tone(1800,t,.03,'square',.04); }
  else if(k==='pop'){ tone(520,t,.05,'sine',.2); tone(780,t+.04,.06,'sine',.12); }
}
KC.sfx = sfx;

/* ---------- 残り時間の表示(先生もiPadも共通) ---------- */
KC.cd = end => { const s = end ? Math.max(0, Math.ceil((end-Date.now())/1000)) : 0; return `<span class="cd ${s<=5?'low':''}" data-end="${end||0}">${s}</span>`; };
// <span class="cd" data-end="ミリ秒(その端末の時計)"></span> を置くと、自動で残り秒数が入る
setInterval(() => {
  const now = Date.now();
  document.querySelectorAll('.cd[data-end]').forEach(el => {
    const s = Math.max(0, Math.ceil((+el.dataset.end - now)/1000));
    if(el.textContent !== String(s)) el.textContent = s;
    el.classList.toggle('low', s<=5);
  });
}, 200);

/* =====================================================================
   先生のPC(親機)
   ===================================================================== */
let G = null;            // ゲームの定義
let NET=null, ROOM='', CFG=null, H=null, PRES=null, unsub=[], lastJ={}, timers=[];
let JOINED = [];         // solo:参加した人 [{pid, n, t}]
const BACK = 'kake.html';
const SOLO = () => G.mode === 'solo';
function show(id){ ['setup','lobby','table','pad'].forEach(s => { const el=$('#'+s); if(el) el.hidden = (s!==id); }); }

KC.game = function(def){
  G = def;
  const st = document.createElement('style'); st.textContent = BASE_CSS; document.head.prepend(st);
  document.body.insertAdjacentHTML('afterbegin', `
<section id="setup" class="scr" hidden></section>
<section id="lobby" class="scr" hidden>
  <div class="qrbox" id="qr"></div>
  <div class="lobbyInfo">
    <h2>iPadでQRコードを読み取ってください</h2><div>参加コード</div><div class="code" id="lobbyCode"></div>
    <div class="url" id="lobbyUrl"></div><div id="lobbyNote" class="warn"></div>
    <div class="jcount" id="jcount"></div>
    <div class="jlist" id="jlist"></div>
    <div class="row" style="justify-content:flex-start">
      <button class="btn" id="lobbyBack">設定にもどる</button>
      <a class="btn" id="tryPad" target="_blank" hidden>iPadの画面を開く(お試し)</a>
      <button class="btn main" id="startBtn">スタート</button>
    </div>
  </div>
</section>
<section id="table" class="scr ${def.tableClass||''}" hidden>
  <header>
    <button class="hb" id="menuBtn">🎲 駆け引きゲーム</button>
    <div class="ttl">${esc(def.title)}</div>
    <span id="hx" style="display:contents"></span>
    <button class="hb code" id="codeBtn" title="QRコードをもう一度表示"></button>
    <button class="hb" id="sndBtn">🔊</button>
    <button class="hb" id="quitBtn">やめる</button>
  </header>
  <div id="stage"></div>
</section>
<section id="pad" hidden></section>
<div id="telop"></div>
<div class="modal" id="endModal" hidden><div class="mbox" id="endBox"></div></div>
<div class="modal" id="qrModal" hidden><div class="mbox" style="text-align:center"><div class="qrbox" id="qr2" style="margin:0 auto 16px;display:inline-grid"></div><div class="code" id="qr2code"></div><div class="row" style="justify-content:center"><button class="btn" id="qr2close">閉じる</button></div></div></div>
<div class="modal" id="gModal" hidden><div class="mbox" id="gBox"></div></div>`);
  if(IS_PAD) initPad(); else initHost();
};

const DEF = {names:'1班\n2班\n3班\n4班\n5班\n6班', places:'教室\n廊下・トイレ', roster:'', clean:5, net:'firebase'};
function initHost(){
  const c = Object.assign({}, DEF, G.defaults||{}, ls(G.key+'.cfg')||{});
  const who = SOLO()
    ? `<div><label class="t" for="fRoster">名簿(1行に1人・空欄でもOK)</label><textarea id="fRoster" placeholder="空欄のときは、各自がiPadでニックネームを入れて参加します"></textarea><div class="hint">名簿を入れると、iPadで名前をタッチして参加できます(ニックネームでの参加もできます)。</div></div>
       <div><label class="t" for="fClean">掃除当番の人数</label><select id="fClean">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}">${n}人</option>`).join('')}</select><div class="hint">得点の少ない人から、この人数が掃除当番になります。</div></div>`
    : `<div><label class="t" for="fNames">班の名前(1行に1つ・${G.minG||2}〜${G.maxG||8}班)</label><textarea id="fNames"></textarea></div>
       <div><label class="t" for="fPlaces">掃除場所(1行に1つ・班の数より少なく)</label><textarea id="fPlaces"></textarea><div class="hint">負けた班から、上の場所から順に割り当てます。</div></div>`;
  $('#setup').innerHTML = `<div class="panel">
    <div class="hero"><div class="art">${G.heroHTML||''}</div><div><h1>${esc(G.title)}</h1><p>${G.tagline||''}</p></div></div>
    <div class="form">
      ${who}
      ${G.setupHTML()}
      <div><label class="t">つなぎ方</label>
        <label class="opt"><input type="radio" name="fNet" value="firebase"><span>iPadで遊ぶ(本番)</span></label>
        <label class="opt"><input type="radio" name="fNet" value="local"><span>お試し(このPCの別タブをiPadに見立てる)</span></label></div>
    </div>
    <details class="rules"><summary>ルールの説明(学生への説明用)</summary>${G.rulesHTML}</details>
    <div class="err" id="setupErr"></div>
    <div class="row"><button class="btn" id="resumeBtn" hidden>前のゲームの続きから</button><a class="btn" href="${BACK}">🎲 駆け引きゲーム</a><button class="btn main" id="toLobby">${SOLO()?'参加者を集める':'iPadを集める'}</button></div>
    <div class="ver">ver ${G.ver}</div></div>`;
  if(SOLO()){ $('#fRoster').value = c.roster||''; $('#fClean').value = String(c.clean||5); }
  else { $('#fNames').value = c.names; $('#fPlaces').value = c.places; }
  document.querySelector(`input[name=fNet][value=${c.net==='local'?'local':'firebase'}]`).checked = true;
  G.fillSetup(c);
  const sv = ls(G.key+'.save');
  if(sv && sv.H && sv.H.phase!=='end') $('#resumeBtn').hidden = false;
  $('#toLobby').onclick = toLobby;
  $('#resumeBtn').onclick = resume;
  $('#lobbyBack').onclick = () => { closeRoom(); show('setup'); };
  $('#startBtn').onclick = startGame;
  $('#menuBtn').onclick = () => { if(confirm('ゲームをやめて「駆け引きゲーム」にもどりますか?')){ closeRoom(); lsDel(G.key+'.save'); location.href=BACK; } };
  $('#quitBtn').onclick = () => { if(confirm('このゲームをやめて設定にもどりますか?')){ closeRoom(); lsDel(G.key+'.save'); $('#endModal').hidden=true; $('#gModal').hidden=true; show('setup'); $('#resumeBtn').hidden=true; } };
  $('#codeBtn').onclick = () => { $('#qrModal').hidden=false; makeQR($('#qr2'), padURL()); $('#qr2code').textContent=ROOM; };
  $('#qr2close').onclick = () => { $('#qrModal').hidden=true; };
  $('#sndBtn').onclick = () => { soundOn=!soundOn; $('#sndBtn').textContent = soundOn?'🔊':'🔇'; };
  document.addEventListener('keydown', e => {
    if(e.ctrlKey||e.metaKey||e.altKey) return;
    if(!$('#table').hidden && H && $('#endModal').hidden && G.onKey && !/INPUT|TEXTAREA|SELECT/.test((e.target.tagName||''))) G.onKey(H, e);
  });
  show('setup');
}
function readCfg(){
  const c = { net:document.querySelector('input[name=fNet]:checked').value };
  if(SOLO()){ c.roster = $('#fRoster').value; c.clean = +$('#fClean').value; }
  else { c.names = $('#fNames').value; c.places = $('#fPlaces').value; }
  Object.assign(c, G.readSetup());
  ls(G.key+'.cfg', c);
  if(SOLO()){
    const roster = c.roster.split('\n').map(s=>s.trim()).filter(Boolean);
    if(new Set(roster).size !== roster.length) return {err:'名簿に同じ名前があります。'};
    const e = G.checkSetup ? G.checkSetup(c) : ''; if(e) return {err:e};
    return { ...c, rosterList:roster };
  }
  const names = c.names.split('\n').map(s=>s.trim()).filter(Boolean);
  const places = c.places.split('\n').map(s=>s.trim()).filter(Boolean);
  const mn=G.minG||2, mx=G.maxG||8;
  if(names.length<mn || names.length>mx) return {err:`班は${mn}〜${mx}班にしてください。`};
  if(new Set(names).size !== names.length) return {err:'同じ名前の班があります。'};
  if(places.length >= names.length) return {err:'掃除場所は班の数より少なくしてください。'};
  const e = G.checkSetup ? G.checkSetup(c, names.length) : ''; if(e) return {err:e};
  return { ...c, nameList:names, placeList:places };
}
function padURL(){ const base = location.href.split('#')[0].split('?')[0]; return base+'?room='+ROOM+(NET && NET.kind==='local'?'&local=1':''); }
async function toLobby(){
  const c = readCfg();
  if(c.err){ $('#setupErr').textContent = c.err; return; }
  $('#setupErr').textContent = '';
  CFG = c; ac();
  ROOM = code5();
  $('#toLobby').disabled = true;
  try{ NET = await connectNet(c.net, ROOM); }
  catch(e){ $('#setupErr').textContent = e.message; $('#toLobby').disabled=false; return; }
  $('#toLobby').disabled = false;
  H = null; lastJ = {}; JOINED = [];
  listenHost();
  lobbyState();
  $('#lobbyCode').textContent = ROOM;
  $('#lobbyUrl').textContent = padURL();
  $('#lobbyNote').textContent = (NET.kind==='firebase' && location.protocol==='file:') ? 'パソコンのファイルから開いているため、iPadはこのQRコードで参加できません。GitHub Pages のアドレスで開いてください。' : '';
  const tp = $('#tryPad'); tp.hidden = NET.kind!=='local'; tp.href = padURL();
  makeQR($('#qr'), padURL());
  renderLobby();
  show('lobby');
}
function lobbyState(){
  NET.set('state', {v:G.ver, mode:G.mode, phase:'lobby', gid:'', seq:Date.now(), names:SOLO()?[]:CFG.nameList, roster:SOLO()?CFG.rosterList:[], joined:JOINED.map(j=>({pid:j.pid,n:j.n}))});
}
function listenHost(){
  unsub.forEach(f=>f()); unsub = [];
  unsub.push(NET.on('presence', v => { PRES = v; if(!$('#lobby').hidden) renderLobby(); else if(H && !$('#table').hidden) renderTable(); }));
  unsub.push(NET.on('act', v => { if(!v) return; for(const [k,a] of Object.entries(v)) if(a) onAct(k, a); }));
  if(SOLO()) unsub.push(NET.on('join', onJoin));
  if(NET.kind==='local'){ const t=setInterval(()=>{ if(!$('#lobby').hidden) renderLobby(); }, 2000); unsub.push(()=>clearInterval(t)); }
}
// solo:iPadからの参加(join/{pid} = {n, t})
function onJoin(v){
  const list = Object.entries(v||{}).filter(([,j])=>j && j.n).map(([pid,j])=>({pid, n:String(j.n).trim().slice(0,12), t:+j.t||0})).sort((a,b)=>a.t-b.t);
  const out = [], used = new Set();
  for(const j of list){
    if(!j.n) continue;
    if(used.has(j.n)){ NET.set('jerr/'+j.pid, 'その名前はもう使われています。ちがう名前にしてください。'); NET.remove('join/'+j.pid); continue; }
    used.add(j.n); out.push(j);
  }
  const before = JSON.stringify(JOINED.map(j=>[j.pid,j.n]));
  JOINED = out;
  if(before === JSON.stringify(JOINED.map(j=>[j.pid,j.n]))) return;
  if(H) pushState(); else lobbyState();
  if(!$('#lobby').hidden) renderLobby();
}
function kick(pid){
  NET.set('jerr/'+pid, '先生が参加を取り消しました。');
  NET.remove('join/'+pid);
}
function closeRoom(){ clearTimers(); unsub.forEach(f=>f()); unsub=[]; if(NET) NET.remove(''); NET=null; H=null; JOINED=[]; }
function renderLobby(){
  if(SOLO()){
    const n = JOINED.length;
    $('#jcount').textContent = `参加 ${n}人`;
    $('#jlist').innerHTML = JOINED.map(j => { const k=presCount(PRES,j.pid,NET); return `<div class="jl solo ${k?'ok':''}"><span class="dot"></span><span class="nm">${esc(j.n)}</span><button class="x" data-kick="${esc(j.pid)}" title="参加を取り消す">×</button></div>`; }).join('') || `<div class="wait">まだだれも参加していません</div>`;
    $('#jlist').querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { const j=JOINED.find(x=>x.pid===b.dataset.kick); if(j && confirm(`${j.n} さんの参加を取り消しますか?`)) kick(j.pid); });
    $('#startBtn').textContent = `スタート(${n}人)`;
    return;
  }
  const n = CFG.nameList.length; let ok = 0;
  $('#jcount').textContent = '';
  $('#jlist').innerHTML = CFG.nameList.map((nm,i) => { const k=presCount(PRES,String(i),NET); if(k) ok++; return `<div class="jl ${k?'ok':''}"><span>${esc(nm)}</span><small>${k?'📱 参加'+(k>1?' ×'+k:''):'まだ'}</small></div>`; }).join('');
  $('#startBtn').textContent = `スタート(${ok}/${n}班)`;
}
function startGame(){
  if(SOLO()){
    const n = JOINED.length, mn = G.minP||2;
    if(n < mn){ alert(`${mn}人以上で遊べます(いま${n}人)。`); return; }
    if(CFG.clean >= n && !confirm(`掃除当番(${CFG.clean}人)が参加人数(${n}人)以上です。このまま始めますか?(全員が掃除当番になります)`)) return;
  } else {
    const n = CFG.nameList.length;
    const ok = CFG.nameList.filter((_,i)=>presCount(PRES,String(i),NET)).length;
    if(ok<n && !confirm(`まだiPadがつながっていない班があります(${ok}/${n})。このまま始めますか?`)) return;
  }
  newGame(); show('table');
}
function newGame(){
  ac(); clearTimers();
  NET.remove('act'); NET.remove('hands'); lastJ = {};
  $('#endModal').hidden = true; $('#gModal').hidden = true;
  const names = SOLO() ? JOINED.map(j=>j.n) : CFG.nameList.slice();
  const keys  = SOLO() ? JOINED.map(j=>j.pid) : CFG.nameList.map((_,i)=>String(i));
  H = { v:G.ver, gid:code5()+Date.now().toString(36), cfg:CFG, mode:G.mode, phase:'play', names, keys,
        tid:1, seq:0, fx:null, fxq:[], lastN:{}, res:null, dl:0 };
  G.newGame(H);
  commit();
}
KC.newGame = newGame;
function onAct(key, a){
  if(!H || !a) return;
  const gi = H.keys.indexOf(key);
  if(gi<0) return;
  if(a.gid !== H.gid) return;
  if(!(a.n > (H.lastN[key]||0))) return;
  H.lastN[key] = a.n;
  if(H.phase==='end') return;
  if(G.onAct(H, gi, a)) commit();
}
// 演出の予約(テロップ・効果音)。k は効果音、big を付けるとテロップ
KC.fx = function(t, o={}){ H.fxq.push({t, k:o.k||'', big:!!o.big, c:o.c||''}); };
function commit(){
  H.seq++;
  H.fx = {id:(H.fx?H.fx.id:0)+1, items:H.fxq}; H.fxq = [];
  ls(G.key+'.save', {H, room:ROOM, net:NET.kind, joined:JOINED});
  renderTable(); pushState(); playFx();
}
KC.commit = () => { if(H) commit(); };
// 先生側のタイマー(ゲームが変わったら無効)
KC.later = function(ms, fn){ const gid=H.gid; const t=setTimeout(()=>{ timers=timers.filter(x=>x!==t); if(H && H.gid===gid) fn(H); }, ms); timers.push(t); return t; };
function clearTimers(){ timers.forEach(clearTimeout); timers=[]; }
KC.clearTimers = clearTimers;
// 締め切りタイマー:H.dl に締め切り時刻を入れ、時間が来たら fn
let dlTimer = 0;
KC.deadline = function(ms, fn){ clearTimeout(dlTimer); H.dl = Date.now()+ms; const gid=H.gid; dlTimer = setTimeout(()=>{ if(H && H.gid===gid){ H.dl=0; fn(H); } }, ms); };
KC.cancelDeadline = function(){ clearTimeout(dlTimer); if(H) H.dl = 0; };
function pushState(){
  if(!H || !NET) return;
  const st = Object.assign({ v:G.ver, mode:G.mode, gid:H.gid, phase:H.phase, seq:H.seq, tid:H.tid, names:H.names, keys:H.keys,
    joined:SOLO()?JOINED.map(j=>({pid:j.pid,n:j.n})):[], fx:H.fx, res:H.res, left:H.dl?Math.max(0,H.dl-Date.now()):0 }, G.pub(H));
  NET.set('state', JSON.parse(JSON.stringify(st)));
  if(G.hand) H.keys.forEach((k,i) => {
    const o = G.hand(H, i); const j = JSON.stringify(o);
    if(lastJ[k]!==j){ lastJ[k]=j; NET.set('hands/'+k, JSON.parse(j)); }
  });
}
async function resume(){
  const sv = ls(G.key+'.save'); if(!sv) return;
  try{ NET = await connectNet(sv.net, sv.room); }catch(e){ $('#setupErr').textContent=e.message; return; }
  ROOM = sv.room; H = sv.H; H.fxq = []; CFG = H.cfg; lastJ = {}; JOINED = sv.joined||[]; ac();
  listenHost(); show('table');
  H.dl = 0;
  if(G.onResume) G.onResume(H);
  KC.fx('続きから再開'); commit();
}
function renderTable(){
  $('#codeBtn').textContent = '参加コード '+ROOM;
  G.renderTable(H, $('#stage'), $('#hx'));
  if(H.phase==='end'){ if($('#endModal').hidden) setTimeout(renderEnd, 1800); } else $('#endModal').hidden = true;
}
KC.dev = gi => (PRES && H) ? presCount(PRES, H.keys[gi], NET) : 0;
let prevFx = 0;
function playFx(){
  if(!H.fx || H.fx.id===prevFx) return; prevFx = H.fx.id;
  H.fx.items.filter(x=>x.k && !x.big).forEach(x=>sfx(x.k));
  H.fx.items.filter(x=>x.big).forEach((x,i) => setTimeout(() => {
    $('#telop').innerHTML = `<div style="--tc:${x.c||'#fff'}">${esc(x.t)}</div>`; sfx(x.k||'good');
  }, 150 + i*1150));
}

/* ---------- 結果と掃除 ---------- */
// list:[{g, score(大きいほど上), info:'表示用'}] → 同点は同順位。
// team:下位の班から掃除場所 / solo:下位○人が掃除当番
KC.finish = function(H, list, note){
  KC.cancelDeadline();
  const N = H.names.length;
  const order = list.slice().sort((a,b) => b.score - a.score);
  let r=0, prev=null; order.forEach((x,i)=>{ if(x.score!==prev){ r=i+1; prev=x.score; } x.rank=r; x.place=''; });
  const places = H.mode==='solo' ? Array(Math.min(H.cfg.clean, N)).fill('掃除当番') : H.cfg.placeList;
  const P = places.length;
  for(let k=0;k<P;k++) order[N-1-k].place = places[k];
  let tie = null;
  if(P>0 && P<N){ const a=order[N-P-1], b=order[N-P]; if(a.rank===b.rank) tie = order.filter(x=>x.rank===a.rank).map(x=>H.names[x.g]); }
  H.res = {order, tie, note:note||''};
  H.phase = 'end';
  KC.fx(`${H.names[order[0].g]}の勝ち!`, {big:true, k:'win', c:'var(--acc)'});
};
function renderEnd(){
  if(!H || H.phase!=='end') return;
  const r = H.res, solo = H.mode==='solo';
  const tieMsg = r.tie ? `<div class="tie">同点のため、${r.tie.map(esc).join('・')}でじゃんけんして${solo?'掃除当番':'掃除場所'}を決めましょう</div>` : '';
  let body;
  if(solo){
    const cl = r.order.filter(x=>x.place);
    body = `${cl.length?`<div class="cleaners"><div class="lb">🧹 掃除当番</div><div class="nms">${cl.map(x=>`<span>${esc(H.names[x.g])}</span>`).join('')}</div></div>`:''}
      <div class="rgrid">${r.order.map(x=>`<div class="rcell ${x.place?'cl':''}"><span class="rk">${x.rank}位</span><span class="nm">${esc(H.names[x.g])}</span><span class="sc">${x.info||''}</span></div>`).join('')}</div>`;
  } else {
    body = `<table class="res">${r.order.map(x=>`<tr><td class="rk">${x.rank}位</td><td class="nm">${esc(H.names[x.g])}</td><td>${x.info||''}</td><td class="pl">${x.place?'🧹 '+esc(x.place):''}</td></tr>`).join('')}</table>`;
  }
  $('#endBox').innerHTML = `<h2>結果発表</h2>${body}${tieMsg}
    ${r.note?`<div class="tie sub">${r.note}</div>`:''}
    <div class="row" style="justify-content:center"><button class="btn" id="endSetup">設定にもどる</button><button class="btn main" id="endAgain">${solo?'同じメンバーでもう1回':'同じ班でもう1回'}</button></div>`;
  $('#endModal').hidden = false;
  $('#endSetup').onclick = () => { closeRoom(); lsDel(G.key+'.save'); $('#endModal').hidden=true; show('setup'); $('#resumeBtn').hidden=true; };
  $('#endAgain').onclick = () => {
    if(solo && JOINED.length < (G.minP||2)){ alert('参加者が足りません。'); return; }
    $('#endModal').hidden=true; newGame();
  };
}
// ゲーム側が使う汎用ウィンドウ
KC.modal = function(html){ if(html==null){ $('#gModal').hidden=true; return null; } $('#gBox').innerHTML = html; $('#gModal').hidden = false; return $('#gBox'); };
KC.H = () => H;

/* =====================================================================
   iPad
   ===================================================================== */
function ps(k, v){ if(Q.get('local')!=='1') return ls(k, v); try{ if(v===undefined){ const x=sessionStorage.getItem(k); return x==null?null:JSON.parse(x); } sessionStorage.setItem(k, JSON.stringify(v)); }catch(e){ return null; } }
function psDel(k){ if(Q.get('local')!=='1') return lsDel(k); try{ sessionStorage.removeItem(k); }catch(e){} }
const PD = KC.PD = { code:'', net:null, key:null, pid:'', st:null, hd:null, pres:null, busy:false, busyT:0, n:Date.now(), ui:{}, unh:null, unp:null, jerr:'', pending:false };
async function initPad(){
  show('pad');
  PD.code = (Q.get('room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const kind = Q.get('local')==='1' ? 'local' : 'firebase';
  $('#pad').innerHTML = `<div class="pjoin"><h1>${esc(G.title)}</h1><p>先生の画面につないでいます…</p></div>`;
  try{ PD.net = await connectNet(kind, PD.code); }
  catch(e){ $('#pad').innerHTML = `<div class="pjoin"><h1>${esc(G.title)}</h1><p class="warn">${esc(e.message)}</p></div>`; return; }
  PD.pid = ps('kc.pid') || (()=>{ const d='p'+code5()+code5(); ps('kc.pid',d); return d; })();
  PD.net.on('state', onPadState);
  PD.net.on('presence', v => { PD.pres = v; if(PD.key==null) renderPad(); });
  if(SOLO()){
    PD.net.on('jerr/'+PD.pid, v => { if(v){ PD.jerr = String(v); PD.pending = false; psDel(G.key+'.nick.'+PD.code); setKey(null); PD.net.remove('jerr/'+PD.pid); renderPad(); } });
  } else {
    const saved = ps(G.key+'.join.'+PD.code);
    if(saved!=null) setKey(String(saved), true);
  }
  renderPad();
  setInterval(() => { if(G.padTick && PD.st && PD.st.phase==='play') G.padTick(padCtx()); }, 250);
}
function onPadState(st){
  if(st && st.v > G.ver){
    const key = G.key+'.reload.'+st.v;
    if(!sessionStorage.getItem(key)){ sessionStorage.setItem(key,'1'); const u=new URL(location.href); u.searchParams.set('r', Date.now()); location.replace(u.toString()); return; }
  }
  const prev = PD.st;
  if(prev && st && prev.gid !== st.gid){ PD.ui = {}; }
  PD.st = st;
  if(st && (!prev || st.seq !== prev.seq)) PD.busy = false;
  if(st){ st.recvAt = Date.now(); st.endAt = st.left ? st.recvAt + st.left : 0; }
  if(st && SOLO()){
    const me = arr(st.joined).find(j=>j.pid===PD.pid);
    if(me){ PD.pending = false; if(PD.key!==PD.pid) setKey(PD.pid, true); }
    else if(PD.key===PD.pid){ setKey(null, true); }
  }
  if(st && !SOLO() && PD.key!=null && +PD.key >= arr(st.names).length) setKey(null);
  if(G.onPadState && st) G.onPadState(padCtx(), prev);
  renderPad();
}
function sendJoin(name){
  name = String(name||'').trim().slice(0,12);
  if(!name){ PD.jerr = '名前を入れてください。'; renderPad(); return; }
  PD.jerr = ''; PD.pending = true;
  ps(G.key+'.nick.'+PD.code, name);
  PD.net.remove('jerr/'+PD.pid);
  PD.net.set('join/'+PD.pid, {n:name, t:Date.now()});
  renderPad();
}
function setKey(k, silent){
  if(PD.unh){ PD.unh(); PD.unh=null; } if(PD.unp){ PD.unp(); PD.unp=null; }
  PD.key = k; PD.hd = null; PD.ui = {};
  if(k==null){ if(!SOLO()) psDel(G.key+'.join.'+PD.code); if(!silent) renderPad(); return; }
  if(!SOLO()) ps(G.key+'.join.'+PD.code, k);
  const dev = ps('kc.dev') || (()=>{ const d=code5()+code5(); ps('kc.dev',d); return d; })();
  PD.unp = PD.net.presence('presence/'+k+'/'+dev);
  if(G.hand) PD.unh = PD.net.on('hands/'+k, v => {
    const prev = PD.hd; PD.hd = v || null; PD.busy = false;
    if(G.onPadHand) G.onPadHand(padCtx(), prev);
    renderPad();
  });
  if(!silent) renderPad();
}
function send(t, extra={}){
  if(PD.busy || !PD.st || PD.key==null) return;
  PD.busy = true; clearTimeout(PD.busyT); PD.busyT = setTimeout(()=>{ PD.busy=false; renderPad(); }, 3000);
  PD.n = Math.max(PD.n+1, Date.now());
  PD.net.set('act/'+PD.key, {t, n:PD.n, gid:PD.st.gid, tid:PD.st.tid, ...extra});
  renderPad();
}
// 選び直しなど、待たずに送るもの
function sendNow(t, extra={}){ PD.busy=false; send(t, extra); }
function myIndex(){ return (PD.st && PD.key!=null) ? arr(PD.st.keys).indexOf(PD.key) : -1; }
function padCtx(){ return { st:PD.st, hd:PD.hd, me:myIndex(), key:PD.key, ui:PD.ui, busy:PD.busy, send, sendNow, render:renderPad, el:$('#pad') }; }
function myName(){ const st=PD.st; if(!st) return ''; if(SOLO()){ const j=arr(st.joined).find(j=>j.pid===PD.pid); return j?j.n:''; } return arr(st.names)[+PD.key]||''; }
function renderPad(){
  const el = $('#pad'); const st = PD.st;
  el.className = '';
  if(!st){ el.innerHTML = `<div class="pjoin"><h1>${esc(G.title)}</h1><p>参加コード <b>${esc(PD.code)}</b> の部屋が見つかりません。<br>先生の画面が「${SOLO()?'参加者を集める':'iPadを集める'}」になっているか確認してください。</p></div>`; return; }
  const old = st.v < G.ver ? `<div class="oldver">先生のPCの画面を更新してください(Ctrl+Shift+R)</div>` : '';
  // ---- 参加 ----
  if(SOLO() && PD.key==null){
    if(PD.pending){ el.innerHTML = `<div class="pjoin"><h1>${esc(G.title)}</h1><div class="wait">参加しています…</div></div>${old}`; return; }
    const taken = new Set(arr(st.joined).map(j=>j.n));
    const roster = arr(st.roster);
    const rost = roster.length?`<p>自分の名前をタッチしてください</p><div class="gpick rost">${roster.map(nm=>`<button data-nm="${esc(nm)}" ${taken.has(nm)?'disabled':''}>${esc(nm)}${taken.has(nm)?'<small>参加ずみ</small>':''}</button>`).join('')}</div><p style="margin-top:28px">名簿にないときは、ニックネームで参加</p>`:'<p>ニックネームを入れて参加してください(12文字まで)</p>';
    const warn = (st.phase!=='lobby'?'<p class="warn">いまゲーム中です。参加すると次のゲームから遊べます。</p>':'') + (PD.jerr?`<p class="warn">${esc(PD.jerr)}</p>`:'');
    // 入力中にほかの人が参加しても、入力欄は作り直さない(キーボードが閉じないように)
    if(!$('#nickIn')){
      el.innerHTML = `<div class="pjoin"><h1>${esc(G.title)}</h1><div id="jWarn"></div><div id="jRost"></div>
        <div class="nick"><input id="nickIn" maxlength="12" placeholder="ニックネーム" autocomplete="off"><button class="pb go" id="nickGo">参加する</button></div>
        <div id="jOld"></div></div>`;
      const inp = $('#nickIn');
      inp.value = PD.ui.nick||'';
      inp.oninput = () => { PD.ui.nick = inp.value; };
      inp.onkeydown = e => { if(e.key==='Enter') sendJoin(inp.value); };
      $('#nickGo').onclick = () => sendJoin(inp.value);
    }
    if($('#jRost').innerHTML !== rost){ $('#jRost').innerHTML = rost; el.querySelectorAll('[data-nm]').forEach(b => b.onclick = () => sendJoin(b.dataset.nm)); }
    if($('#jWarn').innerHTML !== warn) $('#jWarn').innerHTML = warn;
    if($('#jOld').innerHTML !== old) $('#jOld').innerHTML = old;
    return;
  }
  if(!SOLO() && PD.key==null){
    el.innerHTML = `<div class="pjoin"><h1>${esc(G.title)}</h1><p>自分の班をタッチしてください</p><div class="gpick">${arr(st.names).map((nm,i)=>{ const k=presCount(PD.pres,String(i),PD.net); return `<button data-g="${i}">${esc(nm)}<small>${k?'📱×'+k+' 参加中':'まだだれもいない'}</small></button>`; }).join('')}</div></div>${old}`;
    el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => setKey(b.dataset.g));
    return;
  }
  const nm = myName();
  const leave = () => {
    if(SOLO()){ if(!confirm('参加をやめますか?')) return; PD.net.remove('join/'+PD.pid); psDel(G.key+'.nick.'+PD.code); setKey(null); }
    else setKey(null);
  };
  if(st.phase==='lobby'){
    el.innerHTML = `<div class="pjoin"><h1>${esc(G.title)}</h1><div class="pres">${esc(nm)}</div><div style="font-size:60px;margin-top:10px">${G.padWaitArt||''}</div><div class="wait">先生がスタートするまで待ってね</div><button class="linkbtn" id="rechoose">${SOLO()?'参加をやめる':'班をえらびなおす'}</button></div>${old}`;
    $('#rechoose').onclick = leave;
    return;
  }
  const me = myIndex();
  if(me<0){
    el.innerHTML = `<div class="pjoin"><h1>${esc(G.title)}</h1><div class="pres">${esc(nm)}</div><div class="wait">いまのゲームが終わったら参加できます。<br>先生の画面を見て待っていてね。</div><button class="linkbtn" id="rechoose">参加をやめる</button></div>${old}`;
    $('#rechoose').onclick = leave;
    return;
  }
  if(st.phase==='end' && st.res){
    const r = st.res, order = arr(r.order), mine = order.find(x=>x.g===me) || {rank:'-'};
    const tie = arr(r.tie);
    const others = SOLO() ? '' : `<div class="pothers" style="justify-content:center;flex-wrap:wrap">${order.map(x=>`<div class="poc ${x.g===me?'me':''}"><b>${esc(arr(st.names)[x.g])}</b><span>${x.rank}位</span></div>`).join('')}</div>`;
    el.innerHTML = `<div class="ptick">結果発表<span class="me">${esc(nm)}</span></div>
      <div class="pjoin" style="margin-top:3vh"><div class="pres" style="font-size:clamp(48px,9vw,90px)">${mine.rank}位</div>
      ${mine.info?`<p style="font-size:24px">${mine.info}</p>`:''}
      ${mine.place?`<p style="font-size:30px;color:var(--bad);font-family:var(--disp)">🧹 ${esc(mine.place)}</p>`:'<p style="font-size:24px">掃除はありません!</p>'}
      ${tie.includes(nm)?`<p class="warn">同点の${SOLO()?'人':'班'}とじゃんけんで決めます</p>`:''}
      ${others}
      <div class="wait">先生の画面を見てね</div></div>${old}`;
    return;
  }
  G.renderPad(padCtx());
  if(old) el.insertAdjacentHTML('beforeend', old);
}
KC.renderPad = renderPad;
// iPadの共通部品:上の帯
KC.padTop = function(P, text){ return `<div class="ptick"><span>${text}</span><span class="me">${esc(myName())}</span></div>`; };
})();
