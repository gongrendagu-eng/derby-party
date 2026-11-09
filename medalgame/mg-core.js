/* =========================================================
   メダルゲーム 共通ライブラリ(mg-core.js)
   - 口座(貯金)・ログイン・持ち込み・追加・一部もどす・やめる・精算
   - 先生のPC(管理画面・各ゲーム)が「ホスト」、iPadが「パッド」
   - メダルを増減させるのはホストだけ。iPadは申請を送るだけ
   ---------------------------------------------------------
   データの置き場所
     mg/s_<秘密の鍵>/acc/<学籍番号>   口座(名前・クラス・合言葉ハッシュ・貯金・seat)
     mg/s_<秘密の鍵>/log/<学籍番号>   履歴
     mg/p_<公開の鍵>/games/<ゲームID> 稼働中のゲーム(タブを閉じると自動で消える)
     mg/p_<公開の鍵>/req/<端末>/<id>  iPadからの申請
     mg/p_<公開の鍵>/res/<端末>       申請への返事
     mg/p_<公開の鍵>/view/<本人の鍵>  本人だけが見る画面用の情報
   ========================================================= */
(function(){
'use strict';
const VER=1, FB_VER='10.12.2';
const CORE_SRC=(document.currentScript&&document.currentScript.src)||location.href;
const qs=new URLSearchParams(location.search);
let LOCAL=qs.get('local')==='1';
const now=()=>Date.now();
const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
function rid(n){n=n||10;const A='abcdefghijkmnpqrstuvwxyz23456789';const a=new Uint8Array(n);(window.crypto||{}).getRandomValues?crypto.getRandomValues(a):a.forEach((_,i)=>a[i]=Math.random()*256|0);let s='';for(const x of a)s+=A[x%A.length];return s}
const normSid=s=>String(s==null?'':s).replace(/[０-９Ａ-Ｚａ-ｚ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/\s+/g,'').toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,20);
const yen=n=>Math.round(+n||0).toLocaleString('ja-JP');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function loadScript(src){return new Promise((ok,ng)=>{const s=document.createElement('script');s.src=src;s.onload=()=>ok();s.onerror=()=>{s.remove();ng(new Error('load '+src))};document.head.appendChild(s)})}
async function loadConfig(){
  if(window.FIREBASE_CONFIG) return window.FIREBASE_CONFIG;
  // medalgame フォルダの1つ上(リポジトリの一番上)→ 同じフォルダ の順に探す
  for(const p of ['../firebase-config.js','firebase-config.js']){
    try{await loadScript(new URL(p,CORE_SRC).href);if(window.FIREBASE_CONFIG)return window.FIREBASE_CONFIG}catch(e){}
  }
  return null;
}

/* ---------- 通信(Firebase / お試し) ---------- */
async function firebaseBackend(){
  const cfg=await loadConfig();
  if(!cfg||!cfg.databaseURL) throw new Error('firebase-config.js が見つかりません(medalgame フォルダの1つ上か、同じフォルダに置いてください)');
  if(!window.firebase||!firebase.database){
    await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`);
    await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-database-compat.js`);
  }
  const app=firebase.apps.length?firebase.app():firebase.initializeApp(cfg), db=app.database();
  return {kind:'firebase',
    get:p=>db.ref(p).once('value').then(s=>s.val()),
    set:(p,v)=>db.ref(p).set(clone(v)),
    update:(p,v)=>db.ref(p).update(clone(v)),
    remove:p=>db.ref(p).remove(),
    push:(p,v)=>db.ref(p).push(clone(v)),
    on:(p,cb)=>{const r=db.ref(p),h=s=>cb(s.val());r.on('value',h);return()=>r.off('value',h)},
    tx:(p,fn)=>db.ref(p).transaction(fn,null,false).then(r=>({committed:r.committed,val:r.snapshot.val()})),
    presence:(p,v)=>{const r=db.ref(p),c=db.ref('.info/connected');const h=s=>{if(s.val()===true){r.onDisconnect().remove();r.set(clone(v))}};c.on('value',h);
      return()=>{c.off('value',h);r.onDisconnect().cancel();return r.remove()}},
    connected:cb=>{const c=db.ref('.info/connected'),h=s=>cb(s.val()===true);c.on('value',h);return()=>c.off('value',h)}};
}
function localBackend(){
  // お試しモード:同じPCの別タブ同士を localStorage でつなぐ
  const KEY='mg.localdb', subs=new Set();
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return{}}};
  const ks=p=>p.split('/').filter(Boolean);
  const get=(t,p)=>ks(p).reduce((o,k)=>o==null?null:(o[k]??null),t);
  const fire=()=>{const t=read();subs.forEach(s=>{const v=get(t,s.p),j=JSON.stringify(v);if(j!==s.last){s.last=j;s.cb(clone(v))}})};
  const put=(p,v)=>{const t=read(),k=ks(p);let o=t;for(let i=0;i<k.length-1;i++){if(typeof o[k[i]]!=='object'||!o[k[i]])o[k[i]]={};o=o[k[i]]}
    if(v==null)delete o[k[k.length-1]];else o[k[k.length-1]]=clone(v);try{localStorage.setItem(KEY,JSON.stringify(t))}catch(e){}setTimeout(fire,0)};
  addEventListener('storage',e=>{if(e.key===KEY)fire()});
  const mine=[];addEventListener('pagehide',()=>mine.forEach(p=>put(p,null)));
  return {kind:'local',
    get:p=>Promise.resolve(clone(get(read(),p))),
    set:(p,v)=>{put(p,v);return Promise.resolve()},
    update:(p,v)=>{Object.keys(v).forEach(k=>put(p+'/'+k,v[k]));return Promise.resolve()},
    remove:p=>{put(p,null);return Promise.resolve()},
    push:(p,v)=>{put(p+'/'+now().toString(36)+rid(4),v);return Promise.resolve()},
    on:(p,cb)=>{const s={p,cb,last:undefined};subs.add(s);setTimeout(fire,0);return()=>subs.delete(s)},
    tx:(p,fn)=>{const cur=clone(get(read(),p));const n=fn(cur);if(n===undefined)return Promise.resolve({committed:false,val:cur});put(p,n);return Promise.resolve({committed:true,val:clone(n)})},
    presence:(p,v)=>{mine.push(p);put(p,v);return()=>{put(p,null);return Promise.resolve()}},
    connected:cb=>{setTimeout(()=>cb(true),0);return()=>{}}};
}
let bePromise=null;
const connect=()=>bePromise||(bePromise=(LOCAL?Promise.resolve(localBackend()):firebaseBackend()).catch(e=>{bePromise=null;throw e}));

/* ---------- 鍵(先生のPCに保存) ---------- */
const KEYS_LS=()=>LOCAL?'mg.keys.local':'mg.keys';
const keys={
  get(){try{const k=JSON.parse(localStorage.getItem(KEYS_LS()));return k&&k.secret&&k.pub?k:null}catch(e){return null}},
  set(k){localStorage.setItem(KEYS_LS(),JSON.stringify({secret:k.secret,pub:k.pub}))},
  create(){const k={secret:rid(24),pub:rid(10)};keys.set(k);return k},
  text(k){k=k||keys.get();return k?`MGKEY-${k.secret}-${k.pub}`:''},
  parse(t){const m=String(t||'').trim().match(/^MGKEY-([a-z0-9]{16,40})-([a-z0-9]{6,20})$/);return m?{secret:m[1],pub:m[2]}:null},
  clear(){localStorage.removeItem(KEYS_LS())}
};

async function pinHash(sid,pin){
  const t='mg1|'+sid+'|'+pin;
  if(window.crypto&&crypto.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619)}return 'x'+(h>>>0).toString(16);
}
const indexUrl=pub=>{const u=new URL('index.html',CORE_SRC);if(pub)u.searchParams.set('mg',pub);if(LOCAL)u.searchParams.set('local','1');return u.href};

/* =========================================================
   ホスト(先生のPC):管理画面も各ゲームもこれを使う
   opt = { gid, name, art, hooks:{ onEnter(sid,amt), reserved(sid)→枚数,
           beforeQuit(sid)→true|'later', onLeave(sid,acc), onReq(sid,req,acc)→{ok,msg,d},
           flush(sid)(一部もどす・やめるの前に、ゲームの中の枚数を口座へ送る), onBack(sid,amt) }, url }
   gid を入れないと管理画面(ゲームではない)として動く
   ========================================================= */
async function startHost(opt){
  opt=opt||{};
  const be=await connect(), k=keys.get();
  if(!k) throw new Error('NOKEY');
  const S='mg/s_'+k.secret, P='mg/p_'+k.pub, gid=opt.gid||null, hooks=opt.hooks||{};
  const H={acc:{},games:{},ready:false,tab:rid(8),online:true,on:{},clean:{}};
  const subs={acc:new Set(),games:new Set(),conn:new Set(),on:new Set(),clean:new Set()};
  const offs=[];
  const fire=(k2,...a)=>subs[k2].forEach(f=>{try{f(...a)}catch(e){console.error(e)}});

  const writeView=(sid,a)=>{ if(!a||!a.vk) return;
    be.set(P+'/view/'+a.vk,{sid,n:a.n||'',c:a.c||'',b:a.b||0,seat:a.seat||null,cl:a.cl||'',ps:!!a.h,lg:a.lg||[],t:now()}).catch(()=>{}); };
  const addLg=(a,w,d)=>{const e={t:now(),w,d:d||0,b:a.b||0};a.lg=[{t:e.t,w,d:e.d}].concat(a.lg||[]).slice(0,6);return e};

  // 口座をトランザクションで書き換える(fn の中で throw するとやめる)
  async function accTx(sid,fn){
    let err=null, logs=[];
    const r=await be.tx(S+'/acc/'+sid,cur=>{ err=null; logs=[];
      if(cur===null) return null;
      try{ return fn(cur,(w,d)=>logs.push(addLg(cur,w,d))); }catch(e){ err=e.message||String(e); return; } });
    if(err) throw new Error(err);
    if(!r.committed||!r.val) throw new Error('口座が見つかりません');
    H.acc[sid]=r.val; writeView(sid,r.val);
    logs.forEach(e=>be.push(S+'/log/'+sid,{...e,g:gid||''}).catch(()=>{}));
    return r.val;
  }
  const sidByVk=vk=>vk&&Object.keys(H.acc).find(s=>H.acc[s].vk===vk);

  // 精算:ゲームの中のメダルを全部貯金にもどす
  async function settle(sid,why){
    let got=0,net=0,gn='',here=false;
    await accTx(sid,(a,log)=>{ const s=a.seat; got=0; here=false; if(!s) return a; here=!!gid&&s.g===gid;
      got=s.a||0; net=got+(s.out||0)-(s.in||0); gn=s.gn||'';
      a.b=(a.b||0)+got; a.seat=null;
      log(`${gn}から貯金にもどす${why?'('+why+')':''}(収支 ${net>=0?'+':''}${net})`,got); return a; });
    if(here&&hooks.onLeave) try{ hooks.onLeave(sid,H.acc[sid]); }catch(e){ console.error(e); }
    return {amt:got,net,gn};
  }
  const seatedHere=()=>Object.keys(H.acc).filter(s=>{const x=H.acc[s].seat;return x&&x.g===gid});

  /* ---- iPadからの申請 ---- */
  const DONE=new Set(); let lastReq=null;
  function onReq(v){ lastReq=v; if(!H.ready||!v) return;
    Object.keys(v).forEach(dev=>Object.keys(v[dev]||{}).forEach(id=>{
      const key=dev+'/'+id, r=v[dev][id]; if(!r||DONE.has(key)||r.by) return;
      if(now()-(r.t||0)>60000){ DONE.add(key); be.remove(P+'/req/'+key).catch(()=>{}); return; }
      const mine=!!gid&&r.to===gid;
      const generic=r.to==='*'||(r.to&&r.to!==gid&&!H.games[r.to]&&r.type==='quit');
      if(!mine&&!generic) return;
      DONE.add(key); handle(dev,id,r,mine);
    }));
  }
  async function handle(dev,id,r,mine){
    const path=P+'/req/'+dev+'/'+id;
    const c=await be.tx(path,cur=>{ if(cur===null) return null; if(cur.by) return; cur.by=H.tab; return cur; }).catch(()=>null);
    if(!c||!c.committed||!c.val||c.val.by!==H.tab) return;
    let res;
    try{ res=await (mine?gameOp(r):genericOp(r)); }catch(e){ res={ok:false,msg:e.message||String(e)}; }
    res=res||{ok:false,msg:'できませんでした'};
    await be.set(P+'/res/'+dev,{id,ok:!!res.ok,msg:res.msg||'',d:res.d==null?null:res.d,t:now()}).catch(()=>{});
    be.remove(path).catch(()=>{});
  }
  async function genericOp(r){
    if(r.type==='check'){ const sid=normSid(r.sid), a=H.acc[sid];
      if(!a) return {ok:false,msg:'その学籍番号は登録されていません。先生に確認してください'};
      return {ok:true,d:{ps:!!a.h,lock:(a.lock||0)>now()}}; }
    if(r.type==='login'){
      const sid=normSid(r.sid), pin=String(r.pin||''), a=H.acc[sid];
      if(!a) return {ok:false,msg:'その学籍番号は登録されていません'};
      if(!/^\d{4}$/.test(pin)) return {ok:false,msg:'合言葉は4桁の数字です'};
      if((a.lock||0)>now()) return {ok:false,msg:`まちがいが続いたので、あと${Math.ceil((a.lock-now())/60000)}分待ってください`};
      const h=await pinHash(sid,pin);
      if(!a.h){
        if(!r.set) return {ok:false,msg:'合言葉がまだ決まっていません',d:{needSet:true}};
        const n=await accTx(sid,x=>{ if(x.h) throw new Error('合言葉はもう決まっています。もう一度ログインしてください'); x.h=h; x.vk=x.vk||rid(18); x.fail=0; x.lock=0; return x; });
        return {ok:true,msg:'合言葉を決めました',d:{vk:n.vk,n:n.n}};
      }
      if(h!==a.h){
        let left=0;
        await accTx(sid,x=>{ x.fail=(x.fail||0)+1; left=5-x.fail; if(x.fail>=5){ x.fail=0; x.lock=now()+5*60000; } return x; });
        return {ok:false,msg:left>0?`学籍番号か合言葉がちがいます(あと${left}回まちがえると5分間ログインできません)`:'まちがいが続いたので、5分間ログインできません'};
      }
      const n=await accTx(sid,x=>{ x.fail=0; x.lock=0; x.vk=x.vk||rid(18); return x; });
      return {ok:true,d:{vk:n.vk,n:n.n}};
    }
    const sid=sidByVk(r.vk); if(!sid) return {ok:false,msg:'もう一度ログインしてください',d:{relogin:true}};
    if(r.type==='hello'){ writeView(sid,H.acc[sid]); return {ok:true}; }
    if(r.type==='quit'){ // 停止中のゲームに残っているメダルを貯金にもどす
      const s=H.acc[sid].seat; if(!s) return {ok:true,msg:'メダルはもう貯金にもどっています'};
      if(H.games[s.g]) return {ok:false,msg:`${s.gn}は動いています。ゲームの画面から「やめる」を押してください`};
      const x=await settle(sid,'停止中'); return {ok:true,msg:`${yen(x.amt)}枚を貯金にもどしました`};
    }
    return {ok:false,msg:'その操作はできません'};
  }
  const toInt=v=>Math.floor(+v||0);
  async function gameOp(r){
    const sid=sidByVk(r.vk); if(!sid) return {ok:false,msg:'もう一度ログインしてください',d:{relogin:true}};
    const t=r.type, amt=toInt(r.amt);
    if(t==='enter'||t==='add'){
      if(amt<0) return {ok:false,msg:'枚数がおかしいです'};
      await accTx(sid,(a,log)=>{
        if(a.cl) throw new Error('掃除決めに参加しているので、いまは遊べません');
        const s=a.seat;
        if(s&&s.g!==gid) throw new Error(`${s.gn}で遊んでいます。先にそちらをやめてください`);
        if(t==='add'&&!s) throw new Error('まだこのゲームに入っていません');
        if(!s&&amt<1) throw new Error('1枚以上持ち込んでください');
        if(amt>(a.b||0)) throw new Error(`貯金が足りません(貯金 ${yen(a.b)}枚)`);
        a.b=(a.b||0)-amt;
        a.seat={g:gid,gn:opt.name||gid,a:(s?s.a:0)+amt,in:(s?s.in||0:0)+amt,out:s?s.out||0:0,t:s?s.t:now()};
        if(amt) log(`${opt.name||gid}に${t==='add'?'追加':'持ち込み'}`,-amt);
        return a; });
      if(hooks.onEnter) await hooks.onEnter(sid,amt,t);
      return {ok:true,msg:amt?`${yen(amt)}枚を${t==='add'?'追加しました':'持ち込みました'}`:''};
    }
    // 掃除決めのゲーム(opt.anyone)は、席がなくても 'g:〜' の申請を受け付ける(本人かどうかはゲーム側で確かめる)
    if(opt.anyone&&t.startsWith('g:')&&hooks.onReq) return await hooks.onReq(sid,r,H.acc[sid]);
    const s0=H.acc[sid].seat;
    if(!s0||s0.g!==gid) return {ok:false,msg:'このゲームには入っていません',d:{noseat:true}};
    if(hooks.flush&&(t==='back'||t==='quit')) await hooks.flush(sid);   // ゲームの中の枚数を口座にそろえてから
    if(t==='back'){
      if(amt<1) return {ok:false,msg:'1枚以上にしてください'};
      const rsv=hooks.reserved?toInt(await hooks.reserved(sid)):0;
      await accTx(sid,(a,log)=>{ const s=a.seat; if(!s||s.g!==gid) throw new Error('このゲームには入っていません');
        const can=Math.max(0,(s.a||0)-rsv); if(amt>can) throw new Error(`もどせるのは ${yen(can)}枚までです${rsv?`(賭けている ${yen(rsv)}枚はもどせません)`:''}`);
        s.a-=amt; s.out=(s.out||0)+amt; a.b=(a.b||0)+amt; log(`${s.gn}から一部もどす`,amt); return a; });
      if(hooks.onBack) await hooks.onBack(sid,amt);
      return {ok:true,msg:`${yen(amt)}枚を貯金にもどしました`};
    }
    if(t==='quit'){
      const w=hooks.beforeQuit?await hooks.beforeQuit(sid):true;
      if(w==='later'){ await accTx(sid,a=>{ if(a.seat) a.seat.leave=1; return a; });
        return {ok:true,msg:'払い戻しが終わったら、自動で貯金にもどします',d:{later:true}}; }
      const x=await settle(sid); return {ok:true,msg:`${yen(x.amt)}枚を貯金にもどしました`,d:{amt:x.amt}};
    }
    if(t.startsWith('g:')&&hooks.onReq) return await hooks.onReq(sid,r,H.acc[sid]);
    return {ok:false,msg:'その操作はできません'};
  }

  /* ---- 監視の開始 ---- */
  offs.push(be.connected(ok=>{H.online=ok;fire('conn',ok)}));
  offs.push(be.on(S+'/acc',v=>{
    const old=H.acc; H.acc=v||{};
    if(gid&&hooks.onLeave) Object.keys(old).forEach(sid=>{ const o=old[sid].seat, n=H.acc[sid]&&H.acc[sid].seat;
      if(o&&o.g===gid&&!(n&&n.g===gid)) try{hooks.onLeave(sid,old[sid])}catch(e){console.error(e)} });
    const first=!H.ready; H.ready=true; fire('acc',H.acc); if(first&&lastReq) onReq(lastReq);
  }));
  offs.push(be.on(P+'/games',v=>{H.games=v||{};fire('games',H.games)}));
  offs.push(be.on(P+'/req',onReq));
  offs.push(be.on(P+'/on',v=>{H.on=v||{};fire('on',H.on)}));
  offs.push(be.on(S+'/clean',v=>{H.clean=v||{};fire('clean',H.clean)}));
  let stopPres=null;
  if(gid){ const url=opt.url||(location.origin+location.pathname);
    stopPres=be.presence(P+'/games/'+gid,{...(opt.info||{}),n:opt.name||gid,art:opt.art||'medal',url,t:now()}); }
  be.update(S+'/cfg',{pub:k.pub,ver:VER}).catch(()=>{});

  const api={
    be,S,P,pub:k.pub,gid,keys:k,
    acc:()=>H.acc, games:()=>H.games, ready:()=>H.ready, online:()=>H.online,
    onAcc(f){subs.acc.add(f);if(H.ready)f(H.acc);return()=>subs.acc.delete(f)},
    onGames(f){subs.games.add(f);f(H.games);return()=>subs.games.delete(f)},
    onConn(f){subs.conn.add(f);f(H.online);return()=>subs.conn.delete(f)},
    onOnline(f){subs.on.add(f);f(H.on);return()=>subs.on.delete(f)},
    onClean(f){subs.clean.add(f);f(H.clean);return()=>subs.clean.delete(f)},
    // いまメダルゲームにログインしているiPadの学籍番号
    onlineSids(){ const vks=new Set(Object.keys(H.on)); return new Set(Object.keys(H.acc).filter(s=>H.acc[s].vk&&vks.has(H.acc[s].vk))); },
    seated:seatedHere,
    padUrl:()=>indexUrl(k.pub),
    // ゲームの中でメダルを増減(賭け・払い戻し)。マイナスで減る。もどり値は新しい枚数
    async change(sid,delta,note){ delta=toInt(delta); let na=0;
      await accTx(sid,a=>{ const s=a.seat; if(!s||s.g!==gid) throw new Error('このゲームには入っていません');
        if((s.a||0)+delta<0) throw new Error('メダルが足りません'); s.a=(s.a||0)+delta; na=s.a; return a; });
      return na; },
    settle, accTx,
    async settleAll(why){ const list=seatedHere(); for(const sid of list){ try{await settle(sid,why)}catch(e){console.warn(e)} } return list.length; },
    async stop(){ const n=await api.settleAll('停止'); if(stopPres) await stopPres(); offs.forEach(f=>f()); return n; },
    async getLog(sid){ const v=await be.get(S+'/log/'+sid)||{}; return Object.values(v).sort((a,b)=>b.t-a.t); },
    writeView,
    /* ---- 掃除決め ----
       mg/s_/clean/<id> = {id,g,gn,cls,at,m:{学籍番号:配るメダル},games,clean,st:'ready'|'playing'|'done'|'banked'|'cancel',room,res:{f:{学籍番号:残り},cl:[掃除当番]},bk:{学籍番号:1}}
       参加者の口座には cl:<id> が付き、そのあいだフリーモードのゲームに入れない */
    clean:{
      all:()=>H.clean,
      get:id=>be.get(S+'/clean/'+id),
      async create(spec){
        const id=now().toString(36)+rid(4), m={};
        Object.keys(spec.m||{}).forEach(sid=>{ if(H.acc[sid]) m[sid]=Math.max(0,toInt(spec.m[sid])); });
        if(!Object.keys(m).length) throw new Error('参加者がいません');
        for(const sid of Object.keys(m)){ if(H.acc[sid].seat){ try{ await settle(sid,'掃除決めのため'); }catch(e){ console.warn(e); } } }
        const c={id,g:spec.g||'roulettepark',gn:spec.gn||'ルーレットパーク',cls:spec.cls||'',at:now(),m,games:toInt(spec.games)||5,clean:toInt(spec.clean)||1,st:'ready'};
        await be.set(S+'/clean/'+id,c);
        for(const sid of Object.keys(m)) await accTx(sid,a=>{ a.cl=id; return a; }).catch(e=>console.warn(e));
        return c; },
      async update(id,ch){ await be.update(S+'/clean/'+id,ch); },
      async setResult(id,res){ const r=await be.tx(S+'/clean/'+id,c=>{ if(c===null) return null; if(c.st==='banked'||c.st==='cancel') return; c.st='done'; c.res=res; c.end=now(); return c; }); return r.val; },
      // 残ったメダルを貯金に入れて、掃除決めの印を外す(2回押しても1回分だけ)
      async bank(id){
        const r=await be.tx(S+'/clean/'+id,c=>{ if(c===null) return null; if(c.st!=='done'&&c.st!=='banking') return; c.st='banking'; return c; });
        if(!r.committed||!r.val) throw new Error('まだ結果が出ていないか、もう貯金に入れてあります');
        const c=r.val, f=(c.res&&c.res.f)||{}, bk=c.bk||{}; let n=0;
        for(const sid of Object.keys(c.m||{})){
          if(bk[sid]||!H.acc[sid]) continue;
          const amt=Math.max(0,toInt(f[sid]));
          await accTx(sid,(a,log)=>{ if(a.cl===id) delete a.cl; if(amt){ a.b=(a.b||0)+amt; log(`掃除決め(${c.gn})の残り`,amt); } return a; }).catch(e=>console.warn(e));
          await be.set(S+'/clean/'+id+'/bk/'+sid,1); n++;
        }
        await be.update(S+'/clean/'+id,{st:'banked',bankAt:now()}); return n; },
      async cancel(id){
        const c=await be.get(S+'/clean/'+id); if(!c) return;
        for(const sid of Object.keys(c.m||{})){ if(H.acc[sid]&&H.acc[sid].cl===id) await accTx(sid,a=>{ if(a.cl===id) delete a.cl; return a; }).catch(()=>{}); }
        await be.update(S+'/clean/'+id,{st:'cancel',endAt:now()}); },
      async remove(id){ await be.remove(S+'/clean/'+id); }
    },
    /* ---- 管理画面用 ---- */
    admin:{
      async addRows(rows,overwriteName){ const up={}; const fresh=[],changed=[];
        rows.forEach(r=>{ const a=H.acc[r.sid];
          if(!a){ up[r.sid]={n:r.n,c:r.c||'',b:0,h:'',vk:rid(18),o:now()}; fresh.push(r.sid); }
          else { if((a.c||'')!==(r.c||'')) up[r.sid+'/c']=r.c||''; if(overwriteName&&r.n&&a.n!==r.n) up[r.sid+'/n']=r.n; if(up[r.sid+'/c']!=null||up[r.sid+'/n']) changed.push(r.sid); } });
        if(Object.keys(up).length) await be.update(S+'/acc',up);
        changed.forEach(sid=>{ const a={...H.acc[sid]}; if(up[sid+'/c']!=null)a.c=up[sid+'/c']; if(up[sid+'/n'])a.n=up[sid+'/n']; writeView(sid,a); });
        return {fresh:fresh.length,changed:changed.length}; },
      async edit(sid,ch){ return accTx(sid,a=>{ if(ch.n!=null)a.n=ch.n; if(ch.c!=null)a.c=ch.c; return a; }); },
      async resetPin(sid){ let old=''; const a=await accTx(sid,x=>{ old=x.vk; x.h=''; x.fail=0; x.lock=0; x.vk=rid(18); return x; });
        if(old&&old!==a.vk) be.remove(P+'/view/'+old).catch(()=>{}); return a; },
      async adjust(sid,delta,why){ delta=toInt(delta);
        return accTx(sid,(a,log)=>{ const nb=(a.b||0)+delta; if(nb<0) throw new Error('貯金がマイナスになります'); a.b=nb; log(why||'先生が調整',delta); return a; }); },
      settle:(sid)=>settle(sid,'先生が精算'),
      async remove(sid){ const a=H.acc[sid]; if(!a) return; if(a.seat) throw new Error('ゲームにメダルが残っています。先に精算してください');
        await be.remove(S+'/acc/'+sid); await be.remove(S+'/log/'+sid); if(a.vk) await be.remove(P+'/view/'+a.vk); },
      async renameClass(from,to){ const up={}; Object.keys(H.acc).forEach(s=>{ if((H.acc[s].c||'')===from) up[s+'/c']=to; });
        if(Object.keys(up).length) await be.update(S+'/acc',up);
        Object.keys(up).forEach(k2=>{ const s=k2.split('/')[0]; writeView(s,{...H.acc[s],c:to}); }); return Object.keys(up).length; },
      async exportAll(){ return {v:VER,at:new Date().toISOString(),acc:await be.get(S+'/acc')||{},log:await be.get(S+'/log')||{}}; },
      async importAll(d){ if(!d||!d.acc) throw new Error('メダルゲームのバックアップではありません');
        await be.set(S+'/acc',d.acc); await be.set(S+'/log',d.log||{}); Object.keys(d.acc).forEach(s=>writeView(s,d.acc[s])); }
    }
  };
  return api;
}

/* =========================================================
   パッド(iPad)
   ========================================================= */
async function startPad(){
  const pub=(qs.get('mg')||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(!pub) return null;
  const be=await connect(), P='mg/p_'+pub;
  let dev; try{ dev=localStorage.getItem('mg.dev'); if(!dev){ dev='d'+rid(10); localStorage.setItem('mg.dev',dev); } }catch(e){ dev='d'+rid(10); }
  if(LOCAL){ try{ dev=sessionStorage.getItem('mg.dev')||('d'+rid(10)); sessionStorage.setItem('mg.dev',dev); }catch(e){} }
  const VK=(LOCAL?'mg.vk.local.':'mg.vk.')+pub, ST=LOCAL?sessionStorage:localStorage;
  const pend={};
  be.on(P+'/res/'+dev,v=>{ if(v&&pend[v.id]){ const f=pend[v.id]; delete pend[v.id]; f(v); } });
  be.presence(P+'/pads/'+dev,{t:now()});
  let stopOn=null;
  const presOn=()=>{ if(stopOn){ try{stopOn()}catch(e){} stopOn=null; } const v=pad.vk(); if(v) stopOn=be.presence(P+'/on/'+v,{t:now()}); };
  const pad={
    be,P,pub,dev,
    vk:()=>{try{return ST.getItem(VK)||''}catch(e){return''}},
    setVk:v=>{try{v?ST.setItem(VK,v):ST.removeItem(VK)}catch(e){} presOn();},
    logout(){pad.setVk('')},
    // 申請を送る(to:ゲームID か '*')。返事 {ok,msg,d}
    req(type,data,to){ const id='r'+now().toString(36)+rid(5);
      return new Promise(res=>{
        const tm=setTimeout(()=>{ if(!pend[id]) return; delete pend[id]; be.remove(P+'/req/'+dev+'/'+id).catch(()=>{});
          res({ok:false,msg:to&&to!=='*'?'ゲームから返事がありません。先生のPCでゲームが開いているか確認してください':'先生のPCから返事がありません。先生のPCでメダルゲームかゲームを開いてもらってください',timeout:true}); },10000);
        pend[id]=v=>{clearTimeout(tm);res(v)};
        be.set(P+'/req/'+dev+'/'+id,{...(data||{}),type,to:to||'*',vk:pad.vk(),t:now()}).catch(()=>{ clearTimeout(tm); delete pend[id]; res({ok:false,msg:'送信できませんでした'}); });
      }); },
    onView(f){ const vk=pad.vk(); if(!vk){ f(null); return()=>{}; } return be.on(P+'/view/'+vk,f); },
    onGames(f){ return be.on(P+'/games',v=>f(v||{})); },
    onConn(f){ return be.connected(f); },
    indexUrl:()=>indexUrl(pub)
  };
  presOn();
  return pad;
}
// 掃除決めの一覧(ゲームの設定画面用。ホストを立てずに読む)
async function cleanList(){ const be=await connect(), k=keys.get(); if(!k) throw new Error('NOKEY'); return (await be.get('mg/s_'+k.secret+'/clean'))||{}; }

window.MG={VER,get LOCAL(){return LOCAL},setLocal(v){ if(!!v!==LOCAL){ LOCAL=!!v; bePromise=null; } },connect,cleanList,keys,startHost,startPad,normSid,yen,esc,rid,indexUrl,qs};
})();
