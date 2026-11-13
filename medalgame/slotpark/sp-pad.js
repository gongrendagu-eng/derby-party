/* =========================================================
   スロットパーク iPad側の共通部分(sp-pad.js)
   ・各ページ(ロビー index.html、台ごとの index.html)が読み込む
   ・読み込む前に、ページ側で  const ASSET='assets/';  const SP_LOBBY='../';  を決めておく
   ・台ごとのコードは、各台のフォルダの index.html の中にある
   ========================================================= */
'use strict';
const GID='slotpark', NAME='スロットパーク', {esc,yen}=MG, $=s=>document.querySelector(s), app=$('#app');
let toastT=null; function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3500)}
// 画面番号:機種や画面がかわるたびに1つ増える。回の途中で画面がかわったら、その回の演出は打ち切る
const ABORT={abort:true}; let RUN=null;
const gone=()=>RUN!==null&&RUN!==G.scr;
const sleep=ms=>new Promise((r,j)=>setTimeout(()=>gone()?j(ABORT):r(),ms));
const MLIST=SP.MACHINES, MBY=Object.fromEntries(MLIST.map(m=>[m.id,m]));

/* ---------- 絵柄とキャラクター(SVG) ---------- */
const SYM={
seven:'<text x="50" y="84" text-anchor="middle" font-family="Dela Gothic One,sans-serif" font-size="88" fill="#e63946" stroke="#6b0d14" stroke-width="3">7</text>',
bar:'<rect x="8" y="32" width="84" height="36" rx="6" fill="#1b1b2f"/><text x="50" y="59" text-anchor="middle" font-family="Dela Gothic One,sans-serif" font-size="26" fill="#fff">BAR</text>',
cherry:'<path d="M34 66Q40 34 60 14Q62 40 66 70" fill="none" stroke="#2d6a4f" stroke-width="5" stroke-linecap="round"/><path d="M60 14Q76 8 84 20Q70 24 60 14Z" fill="#40916c"/><circle cx="32" cy="72" r="17" fill="#d62839"/><circle cx="66" cy="76" r="17" fill="#d62839"/><circle cx="26" cy="66" r="5" fill="#ff9aa2"/><circle cx="60" cy="70" r="5" fill="#ff9aa2"/>',
bell:'<path d="M50 12C28 12 26 40 24 58C22 70 14 74 14 78L86 78C86 74 78 70 76 58C74 40 72 12 50 12Z" fill="#f4c430" stroke="#9a7300" stroke-width="3"/><circle cx="50" cy="86" r="8" fill="#9a7300"/>',
lemon:'<ellipse cx="50" cy="52" rx="38" ry="28" fill="#ffe066" stroke="#b8960a" stroke-width="3"/><ellipse cx="40" cy="44" rx="10" ry="5" fill="#fff6bf"/>',
grape:'<path d="M50 22L54 8" stroke="#2d6a4f" stroke-width="5" stroke-linecap="round"/><circle cx="36" cy="34" r="12" fill="#7b2cbf"/><circle cx="60" cy="34" r="12" fill="#7b2cbf"/><circle cx="24" cy="54" r="12" fill="#7b2cbf"/><circle cx="48" cy="54" r="12" fill="#9d4edd"/><circle cx="72" cy="54" r="12" fill="#7b2cbf"/><circle cx="36" cy="74" r="12" fill="#9d4edd"/><circle cx="60" cy="74" r="12" fill="#7b2cbf"/><circle cx="48" cy="92" r="8" fill="#7b2cbf"/>',
star:'<polygon points="50,6 62,38 96,38 68,58 79,92 50,72 21,92 32,58 4,38 38,38" fill="#ffb703" stroke="#a0600a" stroke-width="3" stroke-linejoin="round"/>',
replay:'<circle cx="50" cy="50" r="38" fill="#3a86ff"/><text x="50" y="66" text-anchor="middle" font-family="Dela Gothic One,sans-serif" font-size="44" fill="#fff">R</text>',
gem:'<polygon points="26,22 74,22 92,42 50,90 8,42" fill="#4cc9f0" stroke="#0b6e8a" stroke-width="3" stroke-linejoin="round"/><polygon points="26,22 40,42 60,42 74,22" fill="#90e0ef"/><line x1="8" y1="42" x2="92" y2="42" stroke="#0b6e8a" stroke-width="3"/>',
crown:'<path d="M12 74L8 30L30 50L50 18L70 50L92 30L88 74Z" fill="#ffc83d" stroke="#9a6a00" stroke-width="3.5" stroke-linejoin="round"/><rect x="12" y="74" width="76" height="12" rx="3" fill="#f4a300" stroke="#9a6a00" stroke-width="3.5"/><circle cx="50" cy="56" r="7" fill="#e63946" stroke="#7a1520" stroke-width="2"/><circle cx="29" cy="62" r="5" fill="#4cc9f0" stroke="#0b6e8a" stroke-width="2"/><circle cx="71" cy="62" r="5" fill="#4cc9f0" stroke="#0b6e8a" stroke-width="2"/><circle cx="8" cy="30" r="5" fill="#ffc83d" stroke="#9a6a00" stroke-width="2.5"/><circle cx="50" cy="16" r="5" fill="#ffc83d" stroke="#9a6a00" stroke-width="2.5"/><circle cx="92" cy="30" r="5" fill="#ffc83d" stroke="#9a6a00" stroke-width="2.5"/>',
melon:'<path d="M8 34A42 42 0 0 0 92 34Z" fill="#2d8a4e" stroke="#1b5e33" stroke-width="3" stroke-linejoin="round"/><path d="M15 34A35 35 0 0 0 85 34Z" fill="#f4fbe9"/><path d="M19 34A31 31 0 0 0 81 34Z" fill="#ef4f5c"/><g fill="#2b2b2b"><ellipse cx="36" cy="44" rx="2.6" ry="4"/><ellipse cx="50" cy="50" rx="2.6" ry="4"/><ellipse cx="64" cy="44" rx="2.6" ry="4"/><ellipse cx="43" cy="56" rx="2.6" ry="4"/><ellipse cx="57" cy="56" rx="2.6" ry="4"/></g>',
orange:'<circle cx="50" cy="56" r="34" fill="#ff9f1c" stroke="#b35c00" stroke-width="3"/><ellipse cx="38" cy="44" rx="9" ry="5" fill="#ffd08a"/><path d="M50 24L50 14" stroke="#6b4a1a" stroke-width="4" stroke-linecap="round"/><path d="M52 18Q66 6 76 14Q66 26 52 18Z" fill="#40916c" stroke="#1e6b36" stroke-width="2"/>',
wild:'<rect x="4" y="20" width="92" height="60" rx="12" fill="#7c3aed" stroke="#ffcf3f" stroke-width="5"/><text x="50" y="62" text-anchor="middle" font-family="Dela Gothic One,sans-serif" font-size="30" fill="#ffcf3f" stroke="#3b0a8a" stroke-width="1.5">WILD</text><polygon points="14,12 17,20 25,22 17,24 14,32 11,24 3,22 11,20" fill="#fff6bf"/><polygon points="86,70 89,78 97,80 89,82 86,90 83,82 75,80 83,78" fill="#fff6bf"/>',
wl_dragon:'',wl_mimic:'',wl_golem:'',wl_ghost:'',wl_skeleton:'',wl_mushroom:'',wl_bat:'',wl_fluff:'',wl_flower:'',wl_chick:'',wl_egg:'',
wl_wild:'',
rocket:'<path d="M50 6C66 20 68 46 64 70L36 70C32 46 34 20 50 6Z" fill="#f1f1f1" stroke="#333355" stroke-width="3"/><circle cx="50" cy="36" r="8" fill="#3a86ff" stroke="#333355" stroke-width="3"/><path d="M36 54L22 74L36 70Z" fill="#e63946"/><path d="M64 54L78 74L64 70Z" fill="#e63946"/><path d="M42 72L50 94L58 72Z" fill="#ff9f1c"/>'
};
// KAGUYAのリール絵柄(紅月の7・刀のBAR・鈴・桜・三日月・竹)。光って見えるように、太い半透明の線を下にしいている
const KSYM={
seven:'<path d="M66 8A42 42 0 1 0 94 70A34 34 0 1 1 66 8Z" fill="#ffd86b" opacity=".85"/><text x="48" y="84" text-anchor="middle" font-family="Dela Gothic One,sans-serif" font-size="84" fill="none" stroke="#ff2d6a" stroke-width="12" opacity=".35">7</text><text x="48" y="84" text-anchor="middle" font-family="Dela Gothic One,sans-serif" font-size="84" fill="#ff2d55" stroke="#fff" stroke-width="2.5">7</text>',
bar:'<path d="M12 86L86 14" stroke="#cfd6ff" stroke-width="5" stroke-linecap="round"/><path d="M12 86L24 74" stroke="#2a1270" stroke-width="9" stroke-linecap="round"/><rect x="5" y="31" width="90" height="38" rx="5" fill="#5ff3ff" opacity=".25"/><rect x="9" y="34" width="82" height="32" rx="4" fill="#0b1440" stroke="#5ff3ff" stroke-width="3"/><text x="50" y="59" text-anchor="middle" font-family="Orbitron,monospace" font-weight="900" font-size="24" letter-spacing="2" fill="#e9fdff">BAR</text>',
bell:'<path d="M50 24V10" stroke="#e63946" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="9" r="5" fill="none" stroke="#e63946" stroke-width="3"/><path d="M44 20L38 30M56 20L62 30" stroke="#e63946" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="58" r="32" fill="#f2c14e" stroke="#8a5a00" stroke-width="3"/><path d="M20 52H80" stroke="#b07a10" stroke-width="3"/><path d="M34 72H66" stroke="#5a3a00" stroke-width="6" stroke-linecap="round"/><circle cx="34" cy="72" r="5" fill="#5a3a00"/><circle cx="66" cy="72" r="5" fill="#5a3a00"/><ellipse cx="38" cy="42" rx="9" ry="6" fill="#fff6c8" opacity=".75"/>',
cherry:'<g fill="#ffb7d0" stroke="#e0457b" stroke-width="2" stroke-linejoin="round">'+[0,72,144,216,288].map(a=>`<path transform="rotate(${a} 50 52)" d="M50 52C37 40 37 20 45 13L50 20L55 13C63 20 63 40 50 52Z"/>`).join('')+'</g><circle cx="50" cy="52" r="8" fill="#fff0a0"/>'+[0,72,144,216,288].map(a=>`<circle transform="rotate(${a} 50 52)" cx="50" cy="40" r="2" fill="#e0457b"/>`).join(''),
replay:'<path d="M60 10A40 40 0 1 0 90 66A32 32 0 1 1 60 10Z" fill="#7ab8ff" opacity=".3" transform="translate(-2 2) scale(1.04)"/><path d="M60 10A40 40 0 1 0 90 66A32 32 0 1 1 60 10Z" fill="#9fd0ff" stroke="#eef6ff" stroke-width="2.5"/><polygon points="78,22 80,28 86,30 80,32 78,38 76,32 70,30 76,28" fill="#fff"/><circle cx="70" cy="48" r="2.5" fill="#fff"/>',
lemon:'<path d="M66 30Q86 18 94 26Q80 36 66 30Z" fill="#7fd68f" stroke="#1e6b36" stroke-width="2"/><rect x="36" y="6" width="26" height="88" rx="7" fill="#4fbf6a" stroke="#1e6b36" stroke-width="3"/><path d="M36 36H62M36 66H62" stroke="#1e6b36" stroke-width="4"/><rect x="41" y="10" width="5" height="80" rx="2" fill="#a8ecb5" opacity=".7"/>'
};
const ksym=(k,s)=>`<svg viewBox="0 0 100 100" width="${s||'100%'}" height="${s||'100%'}" aria-hidden="true">${KSYM[k]||SYM[k]||''}</svg>`;
const sym=(k,s)=>`<svg viewBox="0 0 100 100" width="${s||'100%'}" height="${s||'100%'}" aria-hidden="true">${SYM[k]||''}</svg>`;
function chr(mood,s){
  const rival=mood==='rival', rim=rival?'#6b7385':'#d9a21b', face=rival?'#c9d0dc':'#ffd84d';
  let f='';
  if(mood==='fire') f=`<rect x="18" y="38" width="64" height="8" rx="2" fill="#e63946"/><line x1="34" y1="49" x2="44" y2="53" stroke="#3a2a10" stroke-width="3" stroke-linecap="round"/><line x1="66" y1="49" x2="56" y2="53" stroke="#3a2a10" stroke-width="3" stroke-linecap="round"/><circle cx="40" cy="58" r="4" fill="#3a2a10"/><circle cx="60" cy="58" r="4" fill="#3a2a10"/><path d="M42 70L58 70L54 76L46 76Z" fill="#3a2a10"/>`;
  else if(mood==='happy') f=`<path d="M35 57Q40 50 45 57" fill="none" stroke="#3a2a10" stroke-width="3" stroke-linecap="round"/><path d="M55 57Q60 50 65 57" fill="none" stroke="#3a2a10" stroke-width="3" stroke-linecap="round"/><path d="M41 65Q50 78 59 65Z" fill="#e63946" stroke="#3a2a10" stroke-width="2"/>`;
  else if(mood==='surprise') f=`<circle cx="40" cy="55" r="6" fill="#fff" stroke="#3a2a10" stroke-width="2.5"/><circle cx="60" cy="55" r="6" fill="#fff" stroke="#3a2a10" stroke-width="2.5"/><circle cx="40" cy="55" r="2.5" fill="#3a2a10"/><circle cx="60" cy="55" r="2.5" fill="#3a2a10"/><ellipse cx="50" cy="71" rx="5" ry="6" fill="#3a2a10"/>`;
  else if(mood==='sad') f=`<path d="M35 54L45 57" stroke="#3a2a10" stroke-width="3" stroke-linecap="round"/><path d="M65 54L55 57" stroke="#3a2a10" stroke-width="3" stroke-linecap="round"/><path d="M42 72Q50 66 58 72" fill="none" stroke="#3a2a10" stroke-width="2.5" stroke-linecap="round"/><path d="M36 60Q34 66 36 68" fill="none" stroke="#3a86ff" stroke-width="3"/>`;
  else if(rival) f=`<path d="M33 52L46 56L33 59Z" fill="#c41e3a"/><path d="M67 52L54 56L67 59Z" fill="#c41e3a"/><line x1="32" y1="47" x2="46" y2="52" stroke="#1e2230" stroke-width="3" stroke-linecap="round"/><line x1="68" y1="47" x2="54" y2="52" stroke="#1e2230" stroke-width="3" stroke-linecap="round"/><path d="M42 70Q50 66 58 70" fill="none" stroke="#1e2230" stroke-width="2.5" stroke-linecap="round"/>`;
  else f=`<ellipse cx="40" cy="56" rx="4" ry="5.5" fill="#3a2a10"/><ellipse cx="60" cy="56" rx="4" ry="5.5" fill="#3a2a10"/><circle cx="41.5" cy="54" r="1.5" fill="#fff"/><circle cx="61.5" cy="54" r="1.5" fill="#fff"/><path d="M43 67Q50 73 57 67" fill="none" stroke="#3a2a10" stroke-width="2.5" stroke-linecap="round"/>`;
  const flame=mood==='fire'?`<path d="M20 78C8 56 18 40 24 30C26 42 32 44 34 40C32 26 42 14 50 6C52 20 62 24 66 18C70 30 80 36 76 50C84 46 90 54 82 78Z" fill="#ff7a1a"/><path d="M30 78C24 62 30 52 34 46C38 54 42 54 44 50C44 40 50 32 54 26C56 36 62 40 66 36C70 48 74 56 70 78Z" fill="#ffd23f"/>`:'';
  return `<svg viewBox="0 0 100 100" width="${s}" height="${s}" aria-hidden="true">${flame}<ellipse cx="18" cy="56" rx="12" ry="8" fill="#fff" stroke="#c9d2e3" stroke-width="2" transform="rotate(-20 18 56)"/><ellipse cx="82" cy="56" rx="12" ry="8" fill="#fff" stroke="#c9d2e3" stroke-width="2" transform="rotate(20 82 56)"/><line x1="50" y1="22" x2="50" y2="10" stroke="${rim}" stroke-width="3"/><polygon points="50,0 53,7 60,7 54,11 56,18 50,14 44,18 46,11 40,7 47,7" fill="#ffd23f" stroke="#c99400" stroke-width="1.5"/><circle cx="50" cy="58" r="34" fill="${rim}"/><circle cx="50" cy="58" r="29" fill="${face}"/><circle cx="50" cy="58" r="25" fill="none" stroke="${rim}" stroke-width="1.5" stroke-dasharray="3 3"/>${f}${rival?'':'<ellipse cx="33" cy="66" rx="4" ry="2.5" fill="#ff9aa2"/><ellipse cx="67" cy="66" rx="4" ry="2.5" fill="#ff9aa2"/>'}</svg>`;
}

/* ---------- 効果音(プログラムで合成。ファイルは使わない) ---------- */
let AC=null; const snd={on:true};
const SE_VOL=2.6; // 効果音の大きさ(BGMは0.35)。大きすぎる分はコンプレッサーでおさえる
let SE=null; // {out:効果音の出口, rev:響き}
function seBus(){ AC=AC||new (window.AudioContext||window.webkitAudioContext)(); if(SE) return SE;
  const comp=AC.createDynamicsCompressor(); comp.threshold.value=-9; comp.knee.value=6; comp.ratio.value=8; comp.attack.value=.003; comp.release.value=.2; comp.connect(AC.destination);
  const out=AC.createGain(); out.gain.value=SE_VOL; out.connect(comp);
  // 響き(小さなホールの残響)
  const len=Math.floor(AC.sampleRate*1.6), ir=AC.createBuffer(2,len,AC.sampleRate);
  for(let ch=0;ch<2;ch++){ const d=ir.getChannelData(ch); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2); }
  const conv=AC.createConvolver(); conv.buffer=ir; const rg=AC.createGain(); rg.gain.value=.32; conv.connect(rg); rg.connect(out);
  SE={out,rev:conv}; return SE; }
let NOISE=null; function noiseBuf(){ if(NOISE) return NOISE; const n=AC.sampleRate, b=AC.createBuffer(1,n,AC.sampleRate), d=b.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1; return NOISE=b; }
// 1つの音:o=音の形, f=高さ(配列なら高さを変える), a=立ち上がり, d=消えるまで, v=大きさ, w=響きの量
function nt(o){ if(!snd.on) return; try{ const B=seBus(), t=AC.currentTime+(o.at||0), g=AC.createGain();
    let src;
    if(o.noise){ src=AC.createBufferSource(); src.buffer=noiseBuf(); src.loop=true; }
    else { src=AC.createOscillator(); src.type=o.type||'sine'; const f=[].concat(o.f); src.frequency.setValueAtTime(f[0],t); if(f[1]) src.frequency.exponentialRampToValueAtTime(f[1],t+(o.fd||o.d)); if(o.det) src.detune.value=o.det; }
    let node=src;
    if(o.fm){ const m=AC.createOscillator(), mg=AC.createGain(); m.frequency.value=[].concat(o.f)[0]*o.fm; mg.gain.setValueAtTime([].concat(o.f)[0]*(o.fmi||2),t); mg.gain.exponentialRampToValueAtTime(1,t+o.d); m.connect(mg); mg.connect(src.frequency); m.start(t); m.stop(t+o.d+.05); }
    if(o.lp||o.bp||o.hp){ const fl=AC.createBiquadFilter(); fl.type=o.lp?'lowpass':o.bp?'bandpass':'highpass'; const fr=[].concat(o.lp||o.bp||o.hp); fl.frequency.setValueAtTime(fr[0],t); if(fr[1]) fl.frequency.exponentialRampToValueAtTime(fr[1],t+o.d); fl.Q.value=o.q||1; node.connect(fl); node=fl; }
    const at=o.a||.004, v=o.v||.3; g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(v,t+at); g.gain.exponentialRampToValueAtTime(.0001,t+at+o.d);
    node.connect(g); g.connect(B.out); if(o.w){ const wg=AC.createGain(); wg.gain.value=o.w; g.connect(wg); wg.connect(B.rev); }
    src.start(t); src.stop(t+at+o.d+.05); }catch(e){} }
const bell=(f,at,v,d)=>{ nt({f,fm:3.5,fmi:1.6,d:d||.9,v:v||.16,at,w:.8}); nt({f:f*2,d:(d||.9)*.5,v:(v||.16)*.25,at,w:.6}); };
const brass=(f,at,d,v)=>{ [-6,6].forEach(det=>nt({type:'sawtooth',f,det,a:.04,d:d||.5,v:(v||.09),lp:[900,2600],q:.7,at,w:.5})); };
const sfx={
  // 回しはじめ:リールが回り出す「シュルッ」
  spin:()=>{ nt({noise:true,bp:[500,1600],q:1.2,a:.03,d:.22,v:.18,w:.2}); nt({type:'triangle',f:[180,320],d:.18,v:.12}); },
  // リールが止まる:「ガコン」(低い打音+金具の音)
  stop:()=>{ nt({type:'sine',f:[160,55],fd:.12,d:.18,v:.8}); nt({noise:true,bp:2200,q:2.5,d:.05,v:.6,w:.25}); nt({type:'triangle',f:[1250,1180],d:.09,v:.06,w:.4}); },
  // 当たり:鐘のチャイム+キラキラ
  win:()=>{ [1047,1319,1568,2093].forEach((f,i)=>bell(f,i*.09,.17,1.0)); for(let i=0;i<6;i++) nt({f:2600+Math.random()*1800,d:.12,v:.05,at:.3+i*.06,w:.9}); },
  // 大当たり・フリースピン:ブラスのファンファーレ+ティンパニ+鐘
  big:()=>{ nt({noise:true,lp:[260,120],q:.8,a:.02,d:.5,v:.5,w:.3}); nt({type:'sine',f:[90,60],d:.6,v:.45});
    const C=[[523,659,784],[587,740,880],[659,831,988],[784,988,1175,1568]], T=[0,.18,.36,.6];
    C.forEach((ch,i)=>ch.forEach(f=>brass(f,T[i],i===3?1.3:.3,i===3?.08:.07)));
    [0,.18,.36].forEach(at=>nt({noise:true,lp:600,q:.7,d:.12,v:.25,at}));
    nt({noise:true,lp:[400,180],d:1.0,v:.45,at:.6,w:.4}); nt({type:'sine',f:[80,55],d:1.0,v:.4,at:.6});
    [1568,2093,2637,3136].forEach((f,i)=>bell(f,.7+i*.08,.12,1.2)); },
  // メダルが落ちる:「チャリン」
  coin:()=>{ nt({f:2637,d:.25,v:.12,w:.6}); nt({f:3951,d:.18,v:.07,at:.02,w:.6}); },
  // PUSHボタン:重い一撃
  push:()=>{ nt({type:'sine',f:[120,40],fd:.4,d:.5,v:.6}); nt({noise:true,lp:[1800,200],d:.4,v:.35,w:.5}); }
};
// 連チャンロケットの効果音
Object.assign(sfx,{
  // 地鳴り(エンジンのごう音)
  rumble:(d,v)=>{ d=d||2.2; v=v||.5; nt({noise:true,lp:[260,70],q:.7,a:.15,d,v,w:.3}); nt({type:'sine',f:[52,36],a:.1,d,v:v*.8}); nt({type:'sawtooth',f:[40,30],a:.2,d:d*.8,v:v*.1,lp:180}); },
  // 発射:地鳴り+バリバリという音
  launch:()=>{ sfx.rumble(3,.65); nt({noise:true,bp:[900,250],q:.6,a:.01,d:1.1,v:.45,w:.4}); for(let i=0;i<12;i++) nt({noise:true,hp:2400,d:.04,v:.16,at:.1+Math.random()*1.6}); },
  // 上昇:「ゴーッ」と上がっていく
  whoosh:()=>{ nt({noise:true,bp:[280,2600],q:1.3,a:.25,d:.75,v:.4,w:.3}); nt({type:'sine',f:[110,55],a:.05,d:.8,v:.3}); },
  // 切り離し:「ガコン」+「プシュー」
  sep:()=>{ nt({type:'sine',f:[150,40],fd:.25,d:.35,v:.75}); nt({type:'triangle',f:[900,640],d:.18,v:.14,w:.6}); nt({noise:true,bp:2400,q:2,d:.06,v:.5,w:.3}); nt({noise:true,hp:3000,a:.03,d:.7,v:.22,at:.08}); },
  // カウントダウンの電子音(最後は高く長く)
  beep:(hi)=>{ nt({type:'sine',f:hi?1760:1046,d:hi?.55:.14,v:.24,w:.3}); },
  // 発射延期
  abort:()=>{ nt({type:'triangle',f:[520,170],d:.6,v:.2}); nt({noise:true,hp:2200,a:.05,d:.8,v:.16}); },
  // 月に到着
  moon:()=>{ sfx.big(); [1047,1319,1568,2093,2637].forEach((f,i)=>bell(f,1.1+i*.12,.14,1.6)); [523,659,784,1047].forEach(f=>brass(f,1.8,1.6,.07)); },
  // エンジン停止(連チャン終了)
  sputter:()=>{ [0,.18,.34,.62].forEach((at,i)=>nt({noise:true,lp:[500,120],d:.14,v:.35-i*.06,at})); nt({type:'sine',f:[90,40],d:.9,v:.3}); }
});
function tone(f,d,type,vol,delay){ nt({type:type==='square'?'triangle':(type||'triangle'),f,d,v:Math.min(.3,(vol||.04)*3),at:delay||0}); } // 前の書き方の呼び出し用

/* ---------- 絵と音のファイル(ASSET と BGM の曲名は各ページが決める) ---------- */
// 機種ごとのBGM(lobby=機種選びの画面)
const BGM={}; // 曲の名前は、各ページが Object.assign(BGM,{...}) で足す
const BGM_VOL=0.35; // 小さめ
const bgm={on:(()=>{ try{ return localStorage.getItem('mg.slotpark.bgm')!=='0'; }catch(e){ return true; } })(),el:null,file:null};
function acx(){ AC=AC||new (window.AudioContext||window.webkitAudioContext)(); if(AC.state==='suspended') AC.resume().catch(()=>{}); return AC; }
// iPadは画面にさわったときでないと音が出ないので、さわるたびに音の準備を確かめる
document.addEventListener('pointerdown',()=>{ try{ if(AC&&AC.state==='suspended') AC.resume(); if(bgm.el&&bgm.on&&bgm.el.paused&&!document.hidden) bgm.el.play().catch(()=>{}); }catch(e){} },true);
const bgmMiss={}; // 置いていない曲(読みこめなかった曲)
function bgmPlay(mid){
  // ワイドラインはフリースピン中だけ別の曲(bgm_wide_fs.mp3)。まだ置いていなければ、ふだんの曲のまま
  if(mid==='wide'&&((G.st.wide||{}).fs||0)>0&&!bgmMiss.wide_fs) mid='wide_fs';
  // 連チャンロケット:連チャン中は別の曲、7連からはさらに別の曲。置いていなければ1つ前の曲
  // GUILD RUSH:ボーナス中は別の曲(bgm_guild_bonus.mp3)。置いていなければ、ふだんの曲のまま
  if(mid==='battle'&&((G.st.battle||{}).bonus)&&!bgmMiss.battle_bonus) mid='battle_bonus';
  if(mid==='rocket'){ const c=(G.st.rocket||{}).chain; if(c){ if(c.lv>=7&&!bgmMiss.rocket_final) mid='rocket_final'; else if(!bgmMiss.rocket_chain) mid='rocket_chain'; } }
  // ジングル(月に到着)が鳴っている間は、同じ機種ならそのまま。ほかの画面に移ったら止める
  if(JG){ if(G.mid==='rocket'&&mid.startsWith('rocket')) return; try{ JG.pause(); }catch(e){} JG=null; }
  const f=BGM[mid]; if(!f||!bgm.on){ bgmStop(); return; }
  if(bgm.file===f&&bgm.el){ if(bgm.el.paused&&!document.hidden) bgm.el.play().catch(()=>{}); return; }
  bgmStop();
  const a=new Audio(ASSET+f); a.loop=true; a.preload='auto';
  // iPadは音量の指定がきかないので、Web Audio を通して小さくする
  try{ const ctx=acx(), src=ctx.createMediaElementSource(a), g=ctx.createGain(); g.gain.value=BGM_VOL; src.connect(g); g.connect(ctx.destination); }catch(e){ a.volume=BGM_VOL; }
  a.onerror=()=>{ if(bgm.el!==a) return; bgmMiss[mid]=1; const base=mid.split('_')[0]; if(base!==mid&&G.mid===base) bgmPlay(base); };
  bgm.el=a; bgm.file=f; a.play().catch(()=>{});
}
function bgmStop(){ if(JG){ try{ JG.pause(); }catch(e){} JG=null; } if(bgm.el){ try{ bgm.el.pause(); bgm.el.removeAttribute('src'); bgm.el.load(); }catch(e){} } bgm.el=null; bgm.file=null; }
// ジングル:BGMを止めて1回だけ鳴らし、終わったらBGMにもどる(♪OFFのときは鳴らさない)
let JG=null;
function jingle(name){ if(!bgm.on) return; try{ bgmStop(); const a=new Audio(ASSET+name+'.mp3');
  try{ const ctx=acx(), s=ctx.createMediaElementSource(a), g=ctx.createGain(); g.gain.value=BGM_VOL*1.5; s.connect(g); g.connect(ctx.destination); }catch(e){ a.volume=BGM_VOL; }
  JG=a; const done=()=>{ if(JG!==a) return; JG=null; if(G.mid) bgmPlay(G.mid); }; a.onended=done; a.onerror=done; a.play().catch(done); }catch(e){} }
// ボイス(各台のassets/vo_rk_*.mp3)。置いていなければ何もしない。♪OFFのときは鳴らさない
const voMiss={};
function vo(n){ if(!bgm.on||!snd.on||voMiss[n]) return; try{ const a=new Audio(ASSET+'vo_rk_'+n+'.mp3'); a.onerror=()=>{ voMiss[n]=1; };
  try{ const ctx=acx(), s=ctx.createMediaElementSource(a), g=ctx.createGain(); g.gain.value=1; s.connect(g); g.connect(ctx.destination); }catch(e){}
  a.play().catch(()=>{}); }catch(e){} }
function bgmToggle(){ bgm.on=!bgm.on; try{ localStorage.setItem('mg.slotpark.bgm',bgm.on?'1':'0'); }catch(e){}
  if(bgm.on) bgmPlay(G.mid||'lobby'); else bgmStop(); const b=$('#tBgm'); if(b){ b.textContent=bgm.on?'♪ ON':'♪ OFF'; b.classList.toggle('gray',!bgm.on); } }
document.addEventListener('visibilitychange',()=>{ if(!bgm.el) return; if(document.hidden) bgm.el.pause(); else if(bgm.on) bgm.el.play().catch(()=>{}); });


/* =========================================================
   iPad
   ========================================================= */
let PAD=null;
// ロビー(機種選び)のページへ移る。?mg=…(と local=1)はそのまま引きつぐ。SP_LOBBY は各ページが決める
function goLobby(){ location.href=SP_LOBBY+location.search; }
const G={view:undefined,live:true,mid:null,busy:false,cred:0,hold:false,auto:false,jp:0,st:{},bet:{},after:null,scr:0,screen:'',fail:0};
try{ Object.assign(G.bet,JSON.parse(localStorage.getItem('mg.slotpark.bet'))||{}); }catch(e){}
MLIST.forEach(m=>{ const B=m.bet, v=+G.bet[m.id]; G.bet[m.id]=(v>=B.min&&v<=B.max&&!(v%B.step))?v:B.def; });
// BETの枚数をえらぶ部品
function betBox(mid){ return `<div class="betbox" id="betbox"><button class="bb" data-bm="-" aria-label="BETを減らす">−</button><button class="bv" id="betVal" aria-label="BETの枚数を入力する"><small>BET</small><b id="betNum">${G.bet[mid]}</b></button><button class="bb" data-bm="+" aria-label="BETを増やす">＋</button><button class="bb max" data-bm="max">MAX</button></div>`; }
function setBet(mid,v){ const B=MBY[mid].bet; v=Math.round(v/B.step)*B.step; G.bet[mid]=Math.max(B.min,Math.min(B.max,v));
  try{ localStorage.setItem('mg.slotpark.bet',JSON.stringify(G.bet)); }catch(e){} updTop(); }
function bindBet(mid,locked){ const B=MBY[mid].bet;
  document.querySelectorAll('[data-bm]').forEach(b=>b.onclick=()=>{ if(locked&&locked()) return toast('いまはBETを変えられません'); let v=G.bet[mid];
    if(b.dataset.bm==='+') v+=B.step; else if(b.dataset.bm==='-') v-=B.step; else v=Math.max(B.min,Math.min(B.max,Math.floor(G.cred/B.step)*B.step));
    setBet(mid,v); });
  $('#betVal').onclick=()=>{ if(locked&&locked()) return toast('いまはBETを変えられません'); betModal(mid); }; }
function updBet(mid,locked,shown){ const n=$('#betNum'); if(!n) return; n.textContent=shown??G.bet[mid]; const l=$('#ledBet'); if(l) l.textContent=shown??G.bet[mid];
  document.querySelectorAll('#betbox button').forEach(b=>b.disabled=!!locked); }
function betModal(mid){
  const B=MBY[mid].bet; let amt=G.bet[mid];
  const pre=(B.step===1?[1,2,3,5,10,20,50,100]:B.step===3?[3,6,9,15,30]:[5,10,20,30,50]).filter(n=>n<=B.max);
  const box=document.createElement('div'); box.className='msgbox'; box.style.background='rgba(40,20,30,.45)'; box.style.zIndex=50; $('#stage').appendChild(box);
  box.innerHTML=`<div class="card" style="width:560px"><h2>BETの枚数</h2><p class="note">1回あたり ${B.min}〜${B.max}枚${B.step>1?`(${B.step}枚きざみ)`:''}。BETを増やすと、当たったときの配当も同じ倍率で増えます。</p>
    <div style="display:flex;gap:10px;align-items:center;margin:12px 0"><input id="bIn" type="number" inputmode="numeric" value="${amt}" min="${B.min}" max="${B.max}" step="${B.step}" style="flex:1;min-width:0;width:100%;border:3px solid #ff5c8a;border-radius:18px;padding:8px 14px;font-family:var(--f-num);font-size:34px;text-align:right"><span style="flex-shrink:0;font-size:18px;font-weight:800">枚</span></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${pre.map(n=>`<button class="pbtn" data-q="${n}">${n}枚</button>`).join('')}</div>
    <p id="bErr" style="color:#d63c5e;font-weight:800;min-height:1.4em"></p><div style="display:flex;gap:10px;justify-content:flex-end"><button class="pbtn" id="bNo">やめる</button><button class="pbtn go" id="bGo">決める</button></div></div>`;
  const inp=box.querySelector('#bIn');
  box.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{ inp.value=b.dataset.q; });
  box.querySelector('#bNo').onclick=()=>box.remove();
  box.querySelector('#bGo').onclick=()=>{ const v=Math.floor(+inp.value||0);
    if(v<B.min||v>B.max||v%B.step){ box.querySelector('#bErr').textContent=`${B.min}〜${B.max}枚${B.step>1?`の${B.step}枚きざみ`:''}で入れてください`; return; }
    setBet(mid,v); box.remove(); };
}
// 回っているあいだに押されたボタンは、AUTOを止めて、今の回が終わってから実行する
function whenFree(fn,label,now){ if(!G.busy){ G.auto=false; return fn(); }
  const M=MACH[G.mid], pachi=G.mid==='oshi'||G.mid==='battle';
  // 機種をかえる:結果は先生のPCで確定しているので、演出を待たずにすぐ移る(パチスロは残りのリールを止めてから)
  if(now&&!pachi){ G.auto=false; G.after=null; return fn(); }
  const wasAuto=G.auto; G.auto=false; G.after=fn; if(M&&M.upd) try{M.upd()}catch(e){}
  if(pachi&&M.hurry) M.hurry();
  toast(wasAuto?`AUTOを止めました。今の回が終わったら${label}`:`今の回が終わったら${label}`); }
// 回の途中で画面がかわった・エラーが出たときの後始末(ボタンが押せないままにならないように)
function recover(e){ if(e&&e!==ABORT) console.error(e); RUN=null; G.busy=false; G.hold=false; G.cred=seatA()??G.cred; try{ updTop(); }catch(x){}
  if(G.after){ const f=G.after; G.after=null; G.auto=false; setTimeout(f,50); } }
function fit(){ const s=Math.min(innerWidth/1180,innerHeight/820), st=$('#stage'); if(!st) return;
  st.style.transform=`scale(${s})`; st.style.left=((innerWidth-1180*s)/2)+'px'; st.style.top=((innerHeight-820*s)/2)+'px'; }
async function padMain(){
  document.body.className='pad';
  document.querySelector('meta[name=viewport]').content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
  app.innerHTML='<div id="stage"><div class="msgbox"><div class="card">接続しています…</div></div></div>'; fit(); addEventListener('resize',fit);
  try{ PAD=await MG.startPad(); }catch(e){ msg('つながりません',esc(e.message)); return; }
  if(!PAD.vk()){ location.href=PAD.indexUrl(); return; }
  PAD.onView(v=>{ if(!v){ location.href=PAD.indexUrl(); return; } const first=G.view===undefined; G.view=v; if(!G.hold) G.cred=seatA()||0; if(first) route(); else { if(!inGame()) route(); else updTop(); } });
  PAD.onGames(g=>{ const was=G.live; G.live=!!g[GID]; if(was!==G.live) route(); });
}
const seatA=()=>{const s=G.view&&G.view.seat;return s&&s.g===GID?s.a||0:null};
const inGame=()=>seatA()!==null&&G.live;
function msg(h,body,link){ bgmStop(); G.scr++; G.screen='msg'; $('#stage').innerHTML=`<div class="msgbox"><div class="card"><h2>${h}</h2><p class="note">${body}</p>${link?`<p style="margin-top:18px"><a class="pbtn go" href="${esc(PAD.indexUrl())}">トップへ</a></p>`:''}</div></div>`; }
function route(){
  if(G.view===undefined) return;
  if(seatA()===null){ G.auto=false; msg(`${NAME}にはまだ入っていません`,'メダルゲームのトップで、持ち込む枚数を選んでから入ってください。',true); return; }
  if(!G.live){ G.auto=false; msg(`${NAME}は止まりました`,'先生がゲームを止めました。メダルは貯金にもどっています(もどっていないときは、トップで「貯金にもどす」を押してください)。',true); return; }
  if(G.mid){ if(G.screen!=='m:'+G.mid) openMachine(G.mid); else updTop(); } else if(G.screen!=='lobby') openLobby();
}
function setTheme(mid){ const m=mid&&MBY[mid]; document.body.className='pad '+(m&&m.style==='chic'?'chic':''); }
function topbarHtml(title){
  return `<div class="topbar">${G.mid?'<button class="tbtn" id="tBackL">機種をかえる</button>':''}<div class="t">${esc(title)}</div><span class="nm">${esc(G.view.n)} さん</span><span class="sp" style="flex:1"></span>
    <span class="bank" id="tBank"></span><span class="cred">持ち込み <b id="tCred">0</b> 枚</span>
    ${BGM[G.mid||'lobby']?`<button class="tbtn${bgm.on?'':' gray'}" id="tBgm" aria-label="BGMを切りかえる" title="BGM">${bgm.on?'♪ ON':'♪ OFF'}</button>`:''}<button class="tbtn" id="tAdd">貯金から追加</button><button class="tbtn" id="tBack">一部もどす</button><button class="tbtn gray" id="tQuit">やめる</button></div>`;
}
function bindTop(){
  const bg=$('#tBgm'); if(bg) bg.onclick=bgmToggle;
  const b=$('#tBackL'); if(b) b.onclick=()=>whenFree(()=>{ G.auto=false; goLobby(); },'機種選びにもどります',true);
  $('#tAdd').onclick=()=>amtModal('add'); $('#tBack').onclick=()=>whenFree(()=>amtModal('back'),'「一部もどす」を開きます');
  $('#tQuit').onclick=()=>whenFree(quitNow,'「やめる」を確かめます'); updTop();
}
async function quitNow(){ G.auto=false;
    if(!confirm(`やめますか?\n${yen(seatA())}枚を貯金にもどします。`)) return; const r=await PAD.req('quit',{},GID); toast(r.msg); if(r.ok) setTimeout(()=>location.href=PAD.indexUrl(),700);
}
function updTop(){ const c=$('#tCred'); if(c) c.textContent=yen(G.cred); const b=$('#tBank'); if(b) b.textContent=`貯金 ${yen(G.view.b)}枚`; const l=$('#ledCred'); if(l) l.textContent=G.cred; if(MACH[G.mid]&&MACH[G.mid].upd) try{ MACH[G.mid].upd(); }catch(e){} }
function amtModal(kind){
  const v=G.view, a=seatA(), max=kind==='add'?v.b||0:a; let amt=Math.min(kind==='add'?100:a,max);
  const box=document.createElement('div'); box.className='msgbox'; box.style.background='rgba(40,20,30,.45)'; box.style.zIndex=50; $('#stage').appendChild(box);
  const draw=()=>{ box.innerHTML=`<div class="card" style="width:520px"><h2>${kind==='add'?'貯金から追加':'一部だけ貯金にもどす'}</h2><p class="note">${kind==='add'?`貯金 ${yen(max)}枚`:`持ち込み ${yen(max)}枚`}</p>
    <div style="display:flex;gap:10px;align-items:center;margin:12px 0"><input id="mIn" type="number" inputmode="numeric" value="${amt}" style="flex:1;min-width:0;width:100%;border:3px solid #ff5c8a;border-radius:18px;padding:8px 14px;font-family:var(--f-num);font-size:34px;text-align:right"><span style="flex-shrink:0;font-size:18px;font-weight:800">枚</span></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${[10,50,100].map(n=>`<button class="pbtn" data-q="${n}" ${n>max?'disabled':''}>${n}枚</button>`).join('')}<button class="pbtn" data-q="${max}">全部</button></div>
    <p id="mErr" style="color:#d63c5e;font-weight:800;min-height:1.4em"></p><div style="display:flex;gap:10px;justify-content:flex-end"><button class="pbtn" id="mNo">やめる</button><button class="pbtn go" id="mGo">${kind==='add'?'追加する':'もどす'}</button></div></div>`;
    box.querySelector('#mIn').oninput=e=>{amt=e.target.value};
    box.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{amt=+b.dataset.q;draw()});
    box.querySelector('#mNo').onclick=()=>box.remove();
    box.querySelector('#mGo').onclick=async()=>{ amt=Math.floor(+box.querySelector('#mIn').value||0); if(amt<1) return; box.querySelector('#mGo').disabled=true;
      const r=await PAD.req(kind,{amt},GID); if(!r.ok){ box.querySelector('#mErr').textContent=r.msg; box.querySelector('#mGo').disabled=false; return; } box.remove(); toast(r.msg); };
  }; draw();
}
async function info(m){ const r=await PAD.req('g:info',{m},GID); if(r.ok){ G.jp=r.d.jp; G.st[m]=r.d.st; } return r; }
// Firebaseは中身が空のリスト([])を消して送ってくるので、iPad側で空のリストにもどす
function fbFix(m,d){ if(!d) return d;
  if(m==='wide'){ d.wins=(d.wins||[]).map(w=>({...w,cells:w.cells||[]})); d.starCells=d.starCells||[]; d.stars=d.stars||0; }
  if(m==='drop'){ d.steps=(d.steps||[]).map(x=>({...x,hit:x.hit||[]})); if(!d.steps.length) d.steps=[{grid:MACH.drop.g,hit:[]}]; d.combo=d.combo||0; }
  if(d.pay==null) d.pay=0;
  return d; }
async function play(m,data){
  const r=await PAD.req(data&&data.type||'g:spin',{m,...(data||{})},GID);
  if(!r.ok){
    if(r.timeout){ G.fail++;
      if(G.fail>=2||!G.auto){ G.auto=false; G.fail=0; toast('通信が遅れています。少し待ってから、もう一度回してください'); }
      else { const mid=G.mid; setTimeout(()=>{ if(G.auto&&!G.busy&&!G.after&&G.mid===mid&&MACH[mid].spin) MACH[mid].spin(); },1500); }
    } else { toast(r.msg); G.auto=false; }
    if(gone()) throw ABORT; return null; }
  G.fail=0; fbFix(m,r.d);
  if(r.d.jp!=null) G.jp=r.d.jp; if(r.d.st) G.st[m]=r.d.st;
  if(gone()) throw ABORT;
  return r.d;
}
// 払い戻しを数えながら増やす
async function countUp(to){ const from=G.cred; if(to<=from){ G.cred=to; updTop(); return; }
  const n=to-from, steps=Math.min(n,30), dt=Math.max(15,Math.min(60,900/steps));
  for(let i=1;i<=steps;i++){ G.cred=from+Math.round(n*i/steps); updTop(); if(i%2) sfx.coin(); await sleep(dt); }
  const t=$('#tray'); if(t){ t.querySelectorAll('i').forEach((c,i)=>{ c.classList.remove('drop'); void c.offsetWidth; c.style.animationDelay=(i*60)+'ms'; c.classList.add('drop'); }); } }
function begin(cost){ RUN=G.scr; G.busy=true; G.hold=true; G.cred=Math.max(0,G.cred-cost); updTop(); }
async function finish(d){ await countUp(d.a); RUN=null; G.hold=false; G.busy=false; G.cred=seatA()??d.a; updTop();
  if(G.after){ const f=G.after; G.after=null; G.auto=false; setTimeout(f,50); } }

/* ---------- 機種の画面(共通の部品) ---------- */
const lampsHtml=(n,pos)=>`<div class="lamps chase" style="${pos}">${'<i></i>'.repeat(n)}</div>`;
const ledsHtml=list=>`<div class="leds">${list.map(([l,id,v])=>`<div class="led"><small>${l}</small><b id="${id}">${v}</b></div>`).join('')}</div>`;
const trayHtml=n=>`<div class="tray" id="tray">${'<i></i>'.repeat(n||7)}</div>`;
function screen(theme,cab,left,right){
  setTheme(G.mid);
  $('#stage').innerHTML=`<div class="${theme}" style="position:absolute;inset:0">${topbarHtml(MBY[G.mid].name)}<div class="mscr"><div class="side l">${left}</div><div class="cab" id="cab">${cab}</div><div class="side r">${right}</div></div></div>`;
  bindTop();
}
function openMachine(mid){ G.auto=false; G.after=null; G.scr++; G.screen='m:'+mid; const M=MACH[mid]; M.open(); bgmPlay(mid); info(mid).then(r=>{ if(r.ok&&G.mid===mid&&M.restore) M.restore(); }); }

// 結果が決まっているリール(縦に回して止める)
function makeReel(el,h,w,ss,syms){ el.style.width=w+'px'; el.style.height=(h*3)+'px'; el._h=h; el._ss=ss; el._cur=syms; drawCol(el,syms,0); }
function drawCol(el,list,ty){ el.innerHTML=`<div class="col" style="transform:translateY(${ty}px)">${list.map(k=>`<div class="cell" style="height:${el._h}px">${sym(k,el._ss)}</div>`).join('')}</div>`; }
function spinStart(els,pool){ els.forEach(el=>{ const list=[]; for(let i=0;i<24;i++) list.push(pool[Math.floor(Math.random()*pool.length)]);
  drawCol(el,list.concat(el._cur),-(list.length)*el._h); el.classList.add('blur');
  const col=el.firstChild; col.animate([{transform:`translateY(${-(list.length)*el._h}px)`},{transform:`translateY(${-(list.length-12)*el._h}px)`}],{duration:380,iterations:Infinity}); }); }
function spinStop(el,fin,pool,ms){ return new Promise((res0,rej)=>{ let done=false; const res=()=>{ if(done) return; done=true; gone()?rej(ABORT):res0(); };
  const fill=[]; for(let i=0;i<14;i++) fill.push(pool[Math.floor(Math.random()*pool.length)]);
  const list=fin.concat(fill).concat(el._cur.slice(0,3)); drawCol(el,list,-(list.length-3)*el._h); el.classList.add('blur');
  const col=el.firstChild; const a=col.animate([{transform:`translateY(${-(list.length-3)*el._h}px)`},{transform:'translateY(10px)',offset:.88},{transform:'translateY(0px)'}],{duration:ms,easing:'cubic-bezier(.25,.6,.35,1)',fill:'forwards'});
  setTimeout(()=>el.classList.remove('blur'),ms*.7);
  const end=()=>{ if(done) return; el._cur=fin; drawCol(el,fin,0); el.classList.remove('blur'); sfx.stop(); res(); };
  a.onfinish=end; setTimeout(end,ms+400); }); }
function winText(parent,text,top){ const d=document.createElement('div'); d.className='winmsg'; d.style.top=(top||120)+'px'; d.textContent=text; parent.appendChild(d); setTimeout(()=>d.remove(),2200); }
function autoNext(fn){ const mid=G.mid, scr=G.scr; if(G.auto&&mid) setTimeout(()=>{ if(G.auto&&!G.busy&&!G.after&&G.mid===mid&&G.scr===scr) fn(); },450); }
function toggleAuto(M){ G.auto=!G.auto; M.upd(); if(G.auto&&!G.busy) M.spin(); else if(!G.auto&&G.busy) toast('今の回で止まります'); }

// KAGUYAの絵(先に読みこんでおく)
const MACH={};
