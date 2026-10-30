/* =====================================================================
   trump-core.js — トランプ関連ゲームの共通部分
   ---------------------------------------------------------------------
   先生のPCが親機、各班のiPadが子機(ラストワンと同じしくみ)。
   ここには、通信(Firebase / お試し)・設定画面・QR参加・結果と掃除場所・
   iPadの参加画面・トランプの絵柄 をまとめている。
   ゲームごとのルールと見た目は各HTMLの TC.game({...}) に書く。
   ===================================================================== */
(function(){
'use strict';
const TC = window.TC = {};
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
Object.assign(TC, {$, esc, ls, lsDel, shuffle, code5, arr, IS_PAD});

/* ---------- トランプ ---------- */
// id 0〜51:マーク = floor(id/13)(0♠ 1♥ 2♦ 3♣)、数字 = id%13+1(1=A … 13=K)。52・53 はジョーカー
const SUITS = ['s','h','d','c'];
const SYM = {s:'♠', h:'♥', d:'♦', c:'♣'};
const SNAME = {s:'スペード', h:'ハート', d:'ダイヤ', c:'クラブ'};
const RN = ['','A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const suitOf = id => id>=52 ? 'j' : SUITS[Math.floor(id/13)];
const rankOf = id => id>=52 ? 0 : id%13+1;
const isJk = id => id>=52;
const cid = (suit, rank) => SUITS.indexOf(suit)*13 + rank - 1;
const cardName = id => isJk(id) ? 'ジョーカー' : SYM[suitOf(id)] + RN[rankOf(id)];
function card(id, cls='', attr=''){
  if(id==null || id<0) return `<div class="pc back ${cls}" ${attr}><i></i></div>`;
  if(isJk(id)) return `<div class="pc jk ${cls}" ${attr}><span class="ix tl">J<br>K</span><span class="pip">★</span><span class="ix br">J<br>K</span></div>`;
  const s = suitOf(id), r = RN[rankOf(id)];
  return `<div class="pc s${s} ${cls}" ${attr}><span class="ix tl">${r}<br>${SYM[s]}</span><span class="pip"><b class="${r.length>1?'w':''}">${r}</b><i>${SYM[s]}</i></span><span class="ix br">${r}<br>${SYM[s]}</span></div>`;
}
Object.assign(TC, {SUITS, SYM, SNAME, RN, suitOf, rankOf, isJk, cid, cardName, card});
// 班の色(席・取ったカードの目印)
TC.GC = ['#e5484d','#3e8ef7','#30a46c','#f5a524','#8e4ec6','#12a594','#e93d82','#a18072'];

/* ---------- 共通の見た目(配置だけ。色はゲーム側の CSS 変数で決める) ---------- */
const BASE_CSS = `
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font-family:var(--sys,'Hiragino Sans','Yu Gothic','Meiryo',sans-serif)}
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
button{font:inherit;color:inherit;cursor:pointer;touch-action:manipulation}
button:focus-visible,a:focus-visible{outline:3px solid var(--acc);outline-offset:2px}
[hidden]{display:none!important}
.scr{min-height:100%}
/* トランプ */
.pc{--cw:80px;width:var(--cw);height:calc(var(--cw)*1.42);border-radius:calc(var(--cw)*.1);background:#fffdf8;position:relative;flex:none;
  color:#1b1b1f;box-shadow:0 calc(var(--cw)*.02) 0 rgba(0,0,0,.25),0 calc(var(--cw)*.06) calc(var(--cw)*.14) rgba(0,0,0,.28);
  font-family:var(--cf,'Hiragino Sans','Yu Gothic',sans-serif);font-weight:700;user-select:none;-webkit-user-select:none;border:1px solid rgba(0,0,0,.12)}
.pc.sh,.pc.sd{color:#c8102e}
.pc .ix{position:absolute;font-size:calc(var(--cw)*.2);line-height:.95;text-align:center;letter-spacing:-.04em}
.pc .ix.tl{left:calc(var(--cw)*.07);top:calc(var(--cw)*.07)}
.pc .ix.br{right:calc(var(--cw)*.07);bottom:calc(var(--cw)*.07);transform:rotate(180deg)}
.pc .pip{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:.9}
.pc .pip b{font-size:calc(var(--cw)*.5);font-family:var(--cf2,var(--cf,serif));letter-spacing:-.05em}
.pc .pip b.w{font-size:calc(var(--cw)*.42)}
.pc .pip i{font-style:normal;font-size:calc(var(--cw)*.34)}
.pc.jk{color:#6b2fb3}
.pc.jk .pip{font-size:calc(var(--cw)*.6);background:radial-gradient(circle at 50% 50%,rgba(255,200,0,.35),transparent 60%)}
.pc.back{background:var(--back,#24325c)}
.pc.back i{position:absolute;inset:calc(var(--cw)*.07);border-radius:calc(var(--cw)*.06);border:calc(var(--cw)*.02) solid var(--backline,rgba(255,255,255,.4));background:var(--backpat,none)}
/* 設定 */
#setup{display:grid;place-items:center;padding:4vh 16px}
.panel{width:min(900px,100%);background:var(--panel);border:2px solid var(--line);border-radius:18px;padding:28px 32px}
.hero{display:flex;align-items:center;gap:22px;margin-bottom:20px}
.hero h1{font-family:var(--disp);font-weight:400;font-size:52px;margin:0;color:var(--acc);line-height:1.1}
.hero p{margin:4px 0 0;color:var(--dim)}
.hero .art{display:flex;flex:none}
.hero .art .pc{--cw:56px;margin-left:-22px}
.hero .art .pc:first-child{margin-left:0;transform:rotate(-10deg) translateY(4px)}
.hero .art .pc:last-child{transform:rotate(10deg) translateY(4px)}
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
#lobby{display:grid;grid-template-columns:auto 1fr;gap:5vmin;align-items:center;padding:5vmin 6vmin;min-height:100vh}
.qrbox{background:#fff;border-radius:18px;padding:18px;display:grid;place-items:center;min-width:300px;min-height:300px;color:#222}
.qrbox img,.qrbox canvas{display:block}
.code{font-family:var(--disp);font-size:clamp(40px,8vmin,96px);letter-spacing:.14em;color:var(--acc)}
.lobbyInfo h2{font-family:var(--disp);font-weight:400;font-size:clamp(26px,4vmin,44px);margin:0 0 6px}
.lobbyInfo .url{color:var(--dim);word-break:break-all;margin:6px 0 18px;font-size:14px}
.jlist{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin:10px 0 22px}
.jl{background:var(--panel);border:2px solid var(--line);border-radius:14px;padding:14px 16px;font-size:22px;font-weight:700;display:flex;justify-content:space-between;align-items:center}
.jl.ok{border-color:var(--acc)}
.jl small{font-size:15px;color:var(--dim)}
.jl.ok small{color:var(--acc)}
.warn{color:var(--bad);font-weight:700}
/* 先生のゲーム画面 */
#table{display:flex;flex-direction:column;height:100vh;overflow:hidden}
#table>header{display:flex;align-items:center;gap:1.2vmin;padding:1.1vmin 2vmin;background:var(--bar);border-bottom:2px solid var(--line);flex:none;flex-wrap:wrap}
#table>header .ttl{font-family:var(--disp);color:var(--acc);font-size:3.2vmin;margin-right:auto}
.hb{background:var(--btn);border:1px solid var(--line);border-radius:10px;padding:.9vmin 1.5vmin;font-size:max(14px,1.8vmin);font-weight:700;color:var(--btnink,var(--ink));text-decoration:none}
.hb.code{letter-spacing:.1em;color:var(--acc)}
.hb:disabled{opacity:.4}
#stage{position:relative;flex:1;overflow:hidden;min-height:0}
#telop{position:fixed;left:0;right:0;top:50%;transform:translateY(-50%);pointer-events:none;display:grid;place-items:center;z-index:30}
#telop div{font-family:var(--disp);font-size:9vmin;padding:1vmin 8vmin;background:linear-gradient(90deg,transparent,rgba(0,0,0,.82) 20%,rgba(0,0,0,.82) 80%,transparent);color:var(--tc,#fff);text-shadow:0 .5vmin 0 #000;white-space:nowrap;animation:tcTel 1.6s ease both}
@keyframes tcTel{0%{transform:scaleX(0);opacity:0}12%{transform:scaleX(1.08);opacity:1}20%{transform:none}82%{opacity:1}100%{opacity:0;transform:translateY(-2vmin)}}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.78);display:grid;place-items:center;z-index:40;padding:3vmin}
.mbox{background:var(--panel);color:var(--ink);border:3px solid var(--acc);border-radius:22px;padding:3vmin 4vmin;max-width:min(1150px,96vw);max-height:94vh;overflow:auto}
.mbox h2{font-family:var(--disp);font-weight:400;color:var(--acc);font-size:5vmin;margin:0 0 2vmin;text-align:center}
.res{width:100%;border-collapse:collapse;font-size:2.4vmin}
.res td,.res th{padding:1vmin 1.4vmin;border-bottom:1px solid var(--line);vertical-align:middle;text-align:left}
.res th{font-size:1.8vmin;color:var(--dim);font-weight:700}
.res .rk{font-family:var(--disp);font-size:3.4vmin;color:var(--acc);white-space:nowrap}
.res .nm{font-family:var(--disp);font-size:3vmin;white-space:nowrap}
.res .pl{font-family:var(--disp);color:var(--bad);font-size:3vmin;white-space:nowrap}
.res .cards{display:flex;flex-wrap:wrap;gap:.4vmin;max-width:50vmin}
.res .cards .pc{--cw:3.4vmin}
.tie{margin-top:2vmin;text-align:center;color:var(--bad);font-weight:700;font-size:2.4vmin}
.tie.sub{color:var(--dim)}
/* iPad */
#pad{min-height:100vh;display:flex;flex-direction:column;padding:12px;gap:10px}
.pjoin{max-width:760px;margin:6vh auto 0;text-align:center}
.pjoin h1{font-family:var(--disp);font-weight:400;color:var(--acc);font-size:clamp(40px,7vw,64px);margin:0}
.pjoin p{font-size:18px}
.gpick{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-top:22px}
.gpick button{background:var(--panel);border:3px solid var(--line);border-radius:16px;padding:22px 10px;font-family:var(--disp);font-size:28px;box-shadow:0 5px 0 rgba(0,0,0,.3)}
.gpick button small{display:block;font-family:var(--sys,sans-serif);font-size:15px;color:var(--dim);margin-top:6px}
.wait{color:var(--dim);font-size:22px;margin-top:26px;font-weight:700}
.linkbtn{background:none;border:0;color:var(--dim);text-decoration:underline;margin-top:24px;font-size:16px}
.pres{font-family:var(--disp);font-size:clamp(28px,5vw,48px);color:var(--acc);text-align:center;margin:10px 0}
.oldver{position:fixed;left:0;right:0;bottom:0;background:var(--bad);color:#fff;text-align:center;padding:10px;font-weight:700;z-index:50}
.pbar{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.pb{border:0;border-radius:14px;padding:16px 22px;font-family:var(--disp);font-size:clamp(18px,2.8vw,26px);min-width:150px;background:var(--btn);color:var(--btnink,var(--ink));box-shadow:0 5px 0 rgba(0,0,0,.35)}
.pb:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.35)}
.pb:disabled{opacity:.35}
.pb.go{background:var(--acc);color:var(--accink);box-shadow:0 5px 0 var(--accsh)}
.ptick{border-radius:12px;padding:10px 16px;font-size:clamp(18px,3vw,26px);font-weight:700;display:flex;align-items:center;gap:12px;min-height:1.8em;background:var(--bar);border:2px solid var(--line)}
.ptick .me{margin-left:auto;color:var(--acc);font-size:.85em;white-space:nowrap}
.ptick.mine{border-color:var(--acc);box-shadow:0 0 0 3px var(--acc) inset}
.pothers{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px}
.poc{flex:none;background:var(--panel);border:2px solid var(--line);border-radius:12px;padding:6px 12px;text-align:center;min-width:92px}
.poc b{display:block;font-size:15px;white-space:nowrap}
.poc span{font-family:var(--disp);font-size:22px}
.poc.turn{border-color:var(--acc)}
.poc.me{border-style:dashed}
.poc.out{opacity:.5}
.phand{flex:1;overflow-y:auto;border-radius:16px;padding:30px 10px 12px;background:rgba(0,0,0,.18)}
.phand .cards{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.phand .pc{--cw:clamp(62px,9vw,96px);transition:transform .15s,opacity .15s}
.phand .pc.dim{opacity:.4;filter:saturate(.4)}
.phand .pc.sel{transform:translateY(-16px);box-shadow:0 0 0 4px var(--acc),0 14px 22px rgba(0,0,0,.5)}
.phand .pc.new::after{content:"NEW";position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:var(--acc);color:var(--accink);font-size:12px;padding:1px 7px;border-radius:99px;font-family:sans-serif}
.pmsg{border-radius:12px;padding:8px 14px;text-align:center;font-weight:700;background:var(--panel);border:2px solid var(--acc)}
@media (max-width:760px){ .form{grid-template-columns:1fr} #lobby{grid-template-columns:1fr} }
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

/* ---------- 通信(Firebase / お試し) ---------- */
function loadScript(src){ return new Promise((ok,ng)=>{ const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=()=>ng(new Error('読み込めませんでした:'+src)); document.head.appendChild(s); }); }
async function firebaseBackend(root){
  if(window.NO_FB_CFG || !window.FIREBASE_CONFIG) throw new Error('firebase-config.js が見つかりません。ほかのゲームと同じフォルダに置いてください。');
  await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`);
  await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-database-compat.js`);
  if(!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
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
function presCount(pres, gi, net){
  const o = pres && pres[gi]; if(!o) return 0;
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
  else if(k==='bad'){ tone(200,t,.35,'sawtooth',.12); tone(150,t+.05,.35,'square',.05); }
  else if(k==='big'){ [392,523,659,784].forEach((f,i)=>tone(f,t+i*.08,.16,'square',.08)); }
  else if(k==='alarm'){ [0,.16,.32].forEach(d=>tone(1250,t+d,.1,'square',.09)); }
  else if(k==='stamp'){ noise(t,.18,.5,500); tone(90,t,.25,'sine',.4); }
  else if(k==='win'){ [523,659,784,1047,784,1047].forEach((f,i)=>tone(f,t+i*.12,.18,'square',.08)); }
  else if(k==='tick'){ tone(1800,t,.03,'square',.04); }
}
TC.sfx = sfx;

/* =====================================================================
   先生のPC(親機)
   ===================================================================== */
let G = null;            // ゲームの定義
let NET=null, ROOM='', CFG=null, H=null, PRES=null, unsub=[], lastJ={}, timers=[];
const BACK = 'trump.html';
function show(id){ ['setup','lobby','table','pad'].forEach(s => { const el=$('#'+s); if(el) el.hidden = (s!==id); }); }

TC.game = function(def){
  G = def;
  const st = document.createElement('style'); st.textContent = BASE_CSS; document.head.prepend(st);
  document.body.insertAdjacentHTML('afterbegin', `
<section id="setup" class="scr" hidden></section>
<section id="lobby" class="scr" hidden>
  <div class="qrbox" id="qr"></div>
  <div class="lobbyInfo">
    <h2>iPadでQRコードを読み取ってください</h2><div>参加コード</div><div class="code" id="lobbyCode"></div>
    <div class="url" id="lobbyUrl"></div><div id="lobbyNote" class="warn"></div>
    <div class="jlist" id="jlist"></div>
    <div class="row" style="justify-content:flex-start">
      <button class="btn" id="lobbyBack">設定にもどる</button>
      <a class="btn" id="tryPad" target="_blank" hidden>班の画面を開く(お試し)</a>
      <button class="btn main" id="startBtn">カードを配る</button>
    </div>
  </div>
</section>
<section id="table" class="scr ${def.tableClass||''}" hidden>
  <header>
    <button class="hb" id="menuBtn">🃏 トランプ関連</button>
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

const DEF = {names:'1班\n2班\n3班\n4班\n5班\n6班', places:'教室\n廊下・トイレ', net:'firebase'};
function initHost(){
  const c = Object.assign({}, DEF, G.defaults||{}, ls(G.key+'.cfg')||{});
  $('#setup').innerHTML = `<div class="panel">
    <div class="hero"><div class="art">${G.heroHTML||''}</div><div><h1>${esc(G.title)}</h1><p>${G.tagline||''}</p></div></div>
    <div class="form">
      <div><label class="t" for="fNames">班の名前(1行に1つ・${G.minG||2}〜${G.maxG||8}班)</label><textarea id="fNames"></textarea></div>
      <div><label class="t" for="fPlaces">掃除場所(1行に1つ・班の数より少なく)</label><textarea id="fPlaces"></textarea><div class="hint">負けた班から、上の場所から順に割り当てます。</div></div>
      ${G.setupHTML()}
      <div><label class="t">つなぎ方</label>
        <label class="opt"><input type="radio" name="fNet" value="firebase"><span>各班のiPadで遊ぶ(本番)</span></label>
        <label class="opt"><input type="radio" name="fNet" value="local"><span>お試し(このPCの別タブを班のiPadに見立てる)</span></label></div>
    </div>
    <details class="rules"><summary>ルールの説明(学生への説明用)</summary>${G.rulesHTML}</details>
    <div class="err" id="setupErr"></div>
    <div class="row"><button class="btn" id="resumeBtn" hidden>前のゲームの続きから</button><a class="btn" href="${BACK}">🃏 トランプ関連</a><button class="btn main" id="toLobby">iPadを集める</button></div>
    <div class="ver">ver ${G.ver}</div></div>`;
  $('#fNames').value = c.names; $('#fPlaces').value = c.places;
  document.querySelector(`input[name=fNet][value=${c.net==='local'?'local':'firebase'}]`).checked = true;
  G.fillSetup(c);
  const sv = ls(G.key+'.save');
  if(sv && sv.H && sv.H.phase!=='end') $('#resumeBtn').hidden = false;
  $('#toLobby').onclick = toLobby;
  $('#resumeBtn').onclick = resume;
  $('#lobbyBack').onclick = () => { closeRoom(); show('setup'); };
  $('#startBtn').onclick = startGame;
  $('#menuBtn').onclick = () => { if(confirm('ゲームをやめて「トランプ関連」にもどりますか?')){ closeRoom(); lsDel(G.key+'.save'); location.href=BACK; } };
  $('#quitBtn').onclick = () => { if(confirm('このゲームをやめて設定にもどりますか?')){ closeRoom(); lsDel(G.key+'.save'); $('#endModal').hidden=true; $('#gModal').hidden=true; show('setup'); $('#resumeBtn').hidden=true; } };
  $('#codeBtn').onclick = () => { $('#qrModal').hidden=false; makeQR($('#qr2'), padURL()); $('#qr2code').textContent=ROOM; };
  $('#qr2close').onclick = () => { $('#qrModal').hidden=true; };
  $('#sndBtn').onclick = () => { soundOn=!soundOn; $('#sndBtn').textContent = soundOn?'🔊':'🔇'; };
  show('setup');
}
function readCfg(){
  const names = $('#fNames').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const places = $('#fPlaces').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const c = { names:$('#fNames').value, places:$('#fPlaces').value, net:document.querySelector('input[name=fNet]:checked').value };
  Object.assign(c, G.readSetup());
  ls(G.key+'.cfg', c);
  const mn=G.minG||2, mx=G.maxG||8;
  if(names.length<mn || names.length>mx) return {err:`班は${mn}〜${mx}班にしてください。`};
  if(new Set(names).size !== names.length) return {err:'同じ名前の班があります。'};
  if(places.length >= names.length) return {err:'掃除場所は班の数より少なくしてください。'};
  const e = G.checkSetup ? G.checkSetup(c, names.length) : '';
  if(e) return {err:e};
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
  H = null; lastJ = {};
  listenHost();
  NET.set('state', {v:G.ver, phase:'lobby', gid:'', seq:Date.now(), names:CFG.nameList});
  $('#lobbyCode').textContent = ROOM;
  $('#lobbyUrl').textContent = padURL();
  $('#lobbyNote').textContent = (NET.kind==='firebase' && location.protocol==='file:') ? 'パソコンのファイルから開いているため、iPadはこのQRコードで参加できません。GitHub Pages のアドレスで開いてください。' : '';
  const tp = $('#tryPad'); tp.hidden = NET.kind!=='local'; tp.href = padURL();
  makeQR($('#qr'), padURL());
  renderLobby();
  show('lobby');
}
function listenHost(){
  unsub.forEach(f=>f()); unsub = [];
  unsub.push(NET.on('presence', v => { PRES = v; if(!$('#lobby').hidden) renderLobby(); else if(H && !$('#table').hidden) renderTable(); }));
  unsub.push(NET.on('act', v => { if(!v) return; for(const [k,a] of Object.entries(v)) if(a) onAct(+k, a); }));
  if(NET.kind==='local'){ const t=setInterval(()=>{ if(!$('#lobby').hidden) renderLobby(); }, 2000); unsub.push(()=>clearInterval(t)); }
}
function closeRoom(){ clearTimers(); unsub.forEach(f=>f()); unsub=[]; if(NET) NET.remove(''); NET=null; H=null; }
function renderLobby(){
  const n = CFG.nameList.length; let ok = 0;
  $('#jlist').innerHTML = CFG.nameList.map((nm,i) => { const k=presCount(PRES,i,NET); if(k) ok++; return `<div class="jl ${k?'ok':''}"><span>${esc(nm)}</span><small>${k?'📱 参加'+(k>1?' ×'+k:''):'まだ'}</small></div>`; }).join('');
  $('#startBtn').textContent = `カードを配る(${ok}/${n}班)`;
}
function startGame(){
  const n = CFG.nameList.length;
  const ok = CFG.nameList.filter((_,i)=>presCount(PRES,i,NET)).length;
  if(ok<n && !confirm(`まだiPadがつながっていない班があります(${ok}/${n})。このまま配りますか?`)) return;
  newGame(); show('table');
}
function newGame(){
  ac(); clearTimers();
  NET.remove('act'); NET.remove('hands'); lastJ = {};
  $('#endModal').hidden = true; $('#gModal').hidden = true;
  H = { v:G.ver, gid:code5()+Date.now().toString(36), cfg:CFG, phase:'play', names:CFG.nameList.slice(),
        tid:1, seq:0, fx:null, fxq:[], lastN:{}, res:null };
  G.newGame(H);
  commit();
}
TC.newGame = newGame;
function onAct(gi, a){
  if(!H || !a || gi<0 || gi>=H.names.length) return;
  if(a.gid !== H.gid) return;
  if(!(a.n > (H.lastN[gi]||0))) return;
  H.lastN[gi] = a.n;
  if(H.phase==='end') return;
  if(G.onAct(H, gi, a)) commit();
}
// 演出の予約(テロップ・効果音)。k は効果音、big を付けるとテロップ
TC.fx = function(t, o={}){ H.fxq.push({t, k:o.k||'', big:!!o.big, c:o.c||''}); };
function commit(){
  H.seq++;
  H.fx = {id:(H.fx?H.fx.id:0)+1, items:H.fxq}; H.fxq = [];
  ls(G.key+'.save', {H, room:ROOM, net:NET.kind});
  renderTable(); pushState(); playFx();
}
TC.commit = () => { if(H) commit(); };
// 先生側のタイマー(ゲームが変わったら無効)
TC.later = function(ms, fn){ const gid=H.gid; const t=setTimeout(()=>{ timers=timers.filter(x=>x!==t); if(H && H.gid===gid) fn(H); }, ms); timers.push(t); return t; };
function clearTimers(){ timers.forEach(clearTimeout); timers=[]; }
TC.clearTimers = clearTimers;
function pushState(){
  const st = Object.assign({ v:G.ver, gid:H.gid, phase:H.phase, seq:H.seq, tid:H.tid, names:H.names, fx:H.fx, res:H.res }, G.pub(H));
  NET.set('state', JSON.parse(JSON.stringify(st)));
  if(G.hand) H.names.forEach((_,i) => {
    const o = G.hand(H, i); const j = JSON.stringify(o);
    if(lastJ[i]!==j){ lastJ[i]=j; NET.set('hands/'+i, JSON.parse(j)); }
  });
}
async function resume(){
  const sv = ls(G.key+'.save'); if(!sv) return;
  try{ NET = await connectNet(sv.net, sv.room); }catch(e){ $('#setupErr').textContent=e.message; return; }
  ROOM = sv.room; H = sv.H; H.fxq = []; CFG = H.cfg; lastJ = {}; ac();
  listenHost(); show('table');
  if(G.onResume) G.onResume(H);
  TC.fx('続きから再開'); commit();
}
function renderTable(){
  $('#codeBtn').textContent = '参加コード '+ROOM;
  G.renderTable(H, $('#stage'), $('#hx'));
  if(H.phase==='end'){ if($('#endModal').hidden) setTimeout(renderEnd, 1500); } else $('#endModal').hidden = true;
}
TC.dev = gi => PRES ? presCount(PRES, gi, NET) : 0;
let prevFx = 0;
function playFx(){
  if(!H.fx || H.fx.id===prevFx) return; prevFx = H.fx.id;
  H.fx.items.filter(x=>x.k && !x.big).forEach(x=>sfx(x.k));
  H.fx.items.filter(x=>x.big).forEach((x,i) => setTimeout(() => {
    $('#telop').innerHTML = `<div style="--tc:${x.c||'#fff'}">${esc(x.t)}</div>`; sfx(x.k||'good');
  }, 150 + i*1050));
}

/* ---------- 結果と掃除場所 ---------- */
// order:[{g, score(大きいほど上), info:'表示用'}] → 同点は同順位。下位から掃除場所を割り当てる
TC.finish = function(H, list, note){
  const N = H.names.length;
  const order = list.slice().sort((a,b) => b.score - a.score);
  let r=0, prev=null; order.forEach((x,i)=>{ if(x.score!==prev){ r=i+1; prev=x.score; } x.rank=r; x.place=''; });
  const P = H.cfg.placeList.length;
  for(let k=0;k<P;k++) order[N-1-k].place = H.cfg.placeList[k];
  let tie = null;
  if(P>0 && P<N){ const a=order[N-P-1], b=order[N-P]; if(a.rank===b.rank) tie = order.filter(x=>x.rank===a.rank).map(x=>H.names[x.g]); }
  H.res = {order, tie, note:note||''};
  H.phase = 'end';
  TC.fx(`${H.names[order[0].g]}の勝ち!`, {big:true, k:'win', c:'var(--acc)'});
};
function renderEnd(){
  if(!H || H.phase!=='end') return;
  const r = H.res;
  $('#endBox').innerHTML = `<h2>結果発表</h2><table class="res">${r.order.map(x=>`<tr><td class="rk">${x.rank}位</td><td class="nm">${esc(H.names[x.g])}</td><td>${x.info||''}</td><td class="pl">${x.place?'🧹 '+esc(x.place):''}</td></tr>`).join('')}</table>
    ${r.tie?`<div class="tie">同点のため、${r.tie.map(esc).join('・')}でじゃんけんして掃除場所を決めましょう</div>`:''}
    ${r.note?`<div class="tie sub">${r.note}</div>`:''}
    <div class="row" style="justify-content:center"><button class="btn" id="endSetup">設定にもどる</button><button class="btn main" id="endAgain">同じ班でもう1回</button></div>`;
  $('#endModal').hidden = false;
  $('#endSetup').onclick = () => { closeRoom(); lsDel(G.key+'.save'); $('#endModal').hidden=true; show('setup'); $('#resumeBtn').hidden=true; };
  $('#endAgain').onclick = () => { $('#endModal').hidden=true; newGame(); };
}
// ゲーム側が使う汎用ウィンドウ
TC.modal = function(html){ if(html==null){ $('#gModal').hidden=true; return null; } $('#gBox').innerHTML = html; $('#gModal').hidden = false; return $('#gBox'); };
TC.H = () => H;

/* =====================================================================
   iPad(班の画面)
   ===================================================================== */
function ps(k, v){ if(Q.get('local')!=='1') return ls(k, v); try{ if(v===undefined){ const x=sessionStorage.getItem(k); return x==null?null:JSON.parse(x); } sessionStorage.setItem(k, JSON.stringify(v)); }catch(e){ return null; } }
function psDel(k){ if(Q.get('local')!=='1') return lsDel(k); try{ sessionStorage.removeItem(k); }catch(e){} }
const PD = TC.PD = { code:'', net:null, g:-1, st:null, hd:null, pres:null, busy:false, busyT:0, n:Date.now(), ui:{}, unh:null, unp:null };
async function initPad(){
  show('pad');
  PD.code = (Q.get('room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const kind = Q.get('local')==='1' ? 'local' : 'firebase';
  $('#pad').innerHTML = `<div class="pjoin"><h1>${esc(G.title)}</h1><p>先生の画面につないでいます…</p></div>`;
  try{ PD.net = await connectNet(kind, PD.code); }
  catch(e){ $('#pad').innerHTML = `<div class="pjoin"><h1>${esc(G.title)}</h1><p class="warn">${esc(e.message)}</p></div>`; return; }
  const saved = ps(G.key+'.join.'+PD.code);
  PD.net.on('state', onPadState);
  PD.net.on('presence', v => { PD.pres = v; if(PD.g<0) renderPad(); });
  if(saved!=null) choose(saved, true);
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
  if(st){ st.recvAt = Date.now(); }
  if(st && PD.g >= (st.names||[]).length) choose(-1);
  if(G.onPadState && st) G.onPadState(padCtx(), prev);
  renderPad();
}
function choose(g, silent){
  if(PD.unh){ PD.unh(); PD.unh=null; } if(PD.unp){ PD.unp(); PD.unp=null; }
  PD.g = g; PD.hd = null; PD.ui = {};
  if(g<0){ psDel(G.key+'.join.'+PD.code); renderPad(); return; }
  ps(G.key+'.join.'+PD.code, g);
  const dev = ps('tc.dev') || (()=>{ const d=code5()+code5(); ps('tc.dev',d); return d; })();
  PD.unp = PD.net.presence('presence/'+g+'/'+dev);
  if(G.hand) PD.unh = PD.net.on('hands/'+g, v => {
    const prev = PD.hd; PD.hd = v || null; PD.busy = false;
    if(G.onPadHand) G.onPadHand(padCtx(), prev);
    renderPad();
  });
  if(!silent) renderPad();
}
function send(t, extra={}){
  if(PD.busy || !PD.st) return;
  PD.busy = true; clearTimeout(PD.busyT); PD.busyT = setTimeout(()=>{ PD.busy=false; renderPad(); }, 3000);
  PD.n = Math.max(PD.n+1, Date.now());
  PD.net.set('act/'+PD.g, {t, n:PD.n, gid:PD.st.gid, tid:PD.st.tid, ...extra});
  renderPad();
}
// 早押しなど、待たずに送るもの
function sendNow(t, extra={}){ PD.busy=false; send(t, extra); }
function padCtx(){ return { st:PD.st, hd:PD.hd, me:PD.g, ui:PD.ui, busy:PD.busy, send, sendNow, render:renderPad, el:$('#pad') }; }
function renderPad(){
  const el = $('#pad'); const st = PD.st;
  el.className = '';
  if(!st){ el.innerHTML = `<div class="pjoin"><h1>${esc(G.title)}</h1><p>参加コード <b>${esc(PD.code)}</b> の部屋が見つかりません。<br>先生の画面が「iPadを集める」になっているか確認してください。</p></div>`; return; }
  const old = st.v < G.ver ? `<div class="oldver">先生のPCの画面を更新してください(Ctrl+Shift+R)</div>` : '';
  if(PD.g < 0){
    el.innerHTML = `<div class="pjoin"><h1>${esc(G.title)}</h1><p>自分の班をタッチしてください</p><div class="gpick">${st.names.map((nm,i)=>{ const k=presCount(PD.pres,i,PD.net); return `<button data-g="${i}">${esc(nm)}<small>${k?'📱×'+k+' 参加中':'まだだれもいない'}</small></button>`; }).join('')}</div></div>${old}`;
    el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => choose(+b.dataset.g));
    return;
  }
  const myName = st.names[PD.g];
  if(st.phase==='lobby'){
    el.innerHTML = `<div class="pjoin"><h1>${esc(G.title)}</h1><div class="pres">${esc(myName)}</div><div class="cards" style="display:flex;justify-content:center;gap:10px;margin-top:20px">${[0,1,2,3].map(()=>card(null,'','style="--cw:70px"')).join('')}</div><div class="wait">先生がカードを配るまで待ってね</div><button class="linkbtn" id="rechoose">班をえらびなおす</button></div>${old}`;
    $('#rechoose').onclick = () => choose(-1);
    return;
  }
  if(st.phase==='end' && st.res){
    const r = st.res, order = arr(r.order), mine = order.find(x=>x.g===PD.g) || {rank:'-'};
    const tie = arr(r.tie);
    el.innerHTML = `<div class="ptick">結果発表<span class="me">${esc(myName)}</span></div>
      <div class="pjoin" style="margin-top:3vh"><div class="pres" style="font-size:clamp(48px,9vw,90px)">${mine.rank}位</div>
      ${mine.place?`<p style="font-size:28px;color:var(--bad);font-family:var(--disp)">🧹 ${esc(mine.place)}</p>`:'<p style="font-size:24px">掃除はありません!</p>'}
      ${tie.includes(myName)?'<p class="warn">同点の班とじゃんけんで決めます</p>':''}
      <div class="pothers" style="justify-content:center;flex-wrap:wrap">${order.map(x=>`<div class="poc ${x.g===PD.g?'me':''}"><b>${esc(st.names[x.g])}</b><span>${x.rank}位</span></div>`).join('')}</div>
      <div class="wait">先生の画面を見てね</div></div>${old}`;
    return;
  }
  G.renderPad(padCtx());
  if(old) el.insertAdjacentHTML('beforeend', old);
}
TC.renderPad = renderPad;
// iPadの共通部品:上の帯・ほかの班
TC.padTop = function(P, text, mine){ return `<div class="ptick ${mine?'mine':''}"><span>${esc(text)}</span><span class="me">${esc(P.st.names[P.me])}</span></div>`; };
})();
