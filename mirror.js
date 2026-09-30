/* =========================================================
   iPad配信(先生の画面をそのまま iPad に映す) mirror.js
   ---------------------------------------------------------
   使い方:ゲームのHTMLの最後に <script src="mirror.js"></script> を1行入れるだけ。
   ・先生の画面の左下に「📱 iPadに映す」ボタンが出る
   ・押すとQRコードが出て、iPadで読み取ると view.html で先生の画面が見られる
   ・iPadは見るだけ(ゲームのプログラムは動かさず、見た目だけを受け取る)
   データは Firebase の rooms/{参加コード}/mv/ に置く(教室ダービーと同じルールで動く)
   ========================================================= */
(function () {
  'use strict';
  if (window.__MV_LOADED) return;
  window.__MV_LOADED = true;

  var MV_VER = '1.1';
  var FB_VER = '10.12.2';
  var PAKO_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';
  var QR_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  var INTERVAL = 120;            // 送る間隔の最小値(ミリ秒)。サイコロやルーレットはこの間隔でコマ送りになる
  var CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // I・O・0・1 は使わない
  var ME = (document.currentScript && document.currentScript.src) || location.href;
  var BASE = ME.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  var GAME = document.title || 'game';
  var TAB = Math.random().toString(36).slice(2, 10);
  var LS_CODE = 'mv.code';       // 参加コードは全ゲーム共通(ゲームを切り替えてもiPadはそのまま)
  var SS_ON = 'mv.on';           // このタブで配信中か(再読み込みしたら自動で再開)

  var db = null, ref = null, code = null, live = false, pending = null, lastPush = 0, lastKey = '';
  var claimed = false, observer = null, viewers = 0, connOff = null, hostOff = null, viewOff = null, modalOpen = false, busy = false;

  /* ---------- 読み込み ---------- */
  function load(src) {
    return new Promise(function (ok, ng) {
      var s = document.createElement('script');
      s.src = src; s.async = true; s.dataset.mv = '1';
      s.onload = ok; s.onerror = function () { ng(new Error(src)); };
      document.head.appendChild(s);
    });
  }
  function loadConfig() {
    if (window.FIREBASE_CONFIG) return Promise.resolve();
    var tries = [BASE + 'firebase-config.js', BASE + '../firebase-config.js'];
    var i = 0;
    function next() {
      if (window.FIREBASE_CONFIG) return Promise.resolve();
      if (i >= tries.length) return Promise.reject(new Error('firebase-config.js が見つかりません'));
      return load(tries[i++]).catch(function () {}).then(next);
    }
    return next();
  }
  function connect() {
    if (db) return Promise.resolve(db);
    return loadConfig().then(function () {
      if (window.firebase && window.firebase.database) return;
      return load('https://www.gstatic.com/firebasejs/' + FB_VER + '/firebase-app-compat.js')
        .then(function () { return load('https://www.gstatic.com/firebasejs/' + FB_VER + '/firebase-database-compat.js'); });
    }).then(function () {
      if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      db = firebase.database();
      return db;
    });
  }
  function loadPako() { return window.pako ? Promise.resolve() : load(PAKO_URL).catch(function () {}); }
  function loadQR() { return window.QRCode ? Promise.resolve() : load(QR_URL).catch(function () {}); }

  /* ---------- 画面を文字にする ---------- */
  function skip(el) {
    return el.nodeType === 1 && ((el.id && el.id.indexOf('mv-') === 0) || /^(SCRIPT|NOSCRIPT|TEMPLATE)$/.test(el.tagName));
  }
  function kids(el) {
    var out = [];
    for (var i = 0; i < el.children.length; i++) if (!skip(el.children[i])) out.push(el.children[i]);
    return out;
  }
  function pathOf(el) {
    var p = [];
    while (el && el !== document.body) {
      var par = el.parentElement;
      if (!par) return null;
      p.unshift(kids(par).indexOf(el));
      el = par;
    }
    return p.join('.');
  }
  function serialize() {
    var clone = document.body.cloneNode(true);
    // 入力欄の中身(value)は innerHTML に出ないので属性に写す
    var src = document.body.querySelectorAll('input,textarea,select');
    var dst = clone.querySelectorAll('input,textarea,select');
    for (var i = 0; i < src.length && i < dst.length; i++) {
      var a = src[i], b = dst[i];
      if (a.tagName === 'TEXTAREA') b.textContent = a.value;
      else if (a.tagName === 'SELECT') {
        for (var k = 0; k < a.options.length; k++) {
          if (a.options[k].selected) b.options[k].setAttribute('selected', ''); else b.options[k].removeAttribute('selected');
        }
      } else if (a.type === 'checkbox' || a.type === 'radio') {
        if (a.checked) b.setAttribute('checked', ''); else b.removeAttribute('checked');
      } else b.setAttribute('value', a.value);
    }
    var rm = clone.querySelectorAll('[id^="mv-"],script,noscript,template');
    for (var j = 0; j < rm.length; j++) if (rm[j].parentNode) rm[j].parentNode.removeChild(rm[j]);
    return clone.innerHTML;
  }
  function attrs(el) {
    var o = [];
    for (var i = 0; i < el.attributes.length; i++) o.push([el.attributes[i].name, el.attributes[i].value]);
    return o;
  }
  function htmlAttrs() {
    var o = attrs(document.documentElement);
    // テーマを端末の設定に任せている場合、iPadと色が変わらないよう明示する
    var has = o.some(function (p) { return p[0] === 'data-theme'; });
    if (!has) o.push(['data-theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light']);
    return o;
  }
  function scrolls() {
    var out = [];
    var se = document.scrollingElement || document.documentElement;
    if (se.scrollTop || se.scrollLeft) out.push(['', Math.round(se.scrollTop), Math.round(se.scrollLeft), se.scrollHeight - se.clientHeight, se.scrollWidth - se.clientWidth]);
    var all = document.body.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!(el.scrollTop || el.scrollLeft)) continue;
      if (el.closest('[id^="mv-"]')) continue;
      var p = pathOf(el);
      if (p !== null) out.push([p, Math.round(el.scrollTop), Math.round(el.scrollLeft), el.scrollHeight - el.clientHeight, el.scrollWidth - el.clientWidth]);
    }
    return out;
  }
  function headHTML() {
    var els = document.head.querySelectorAll('link[rel~="stylesheet"],link[rel="preconnect"],style');
    var out = [];
    for (var i = 0; i < els.length; i++) if (!(els[i].id || '').match(/^mv-/)) out.push(els[i].outerHTML);
    return out.join('\n');
  }
  function b64(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  function pack(str) {
    if (window.pako) return { z: 1, d: b64(window.pako.deflate(str)) };
    return { z: 0, d: str };
  }

  /* ---------- 送信 ---------- */
  function schedule() {
    if (!live || pending) return;
    var wait = Math.max(30, lastPush + INTERVAL - Date.now());
    pending = setTimeout(push, wait);
  }
  function push(force) {
    pending = null;
    if (!live || !ref) return;
    lastPush = Date.now();
    var body = serialize();
    var frame = {
      w: window.innerWidth, h: window.innerHeight,
      ha: htmlAttrs(), ba: attrs(document.body), sc: scrolls()
    };
    var key = JSON.stringify(frame) + '\u0000' + body;
    if (!force && key === lastKey) return;
    lastKey = key;
    var p = pack(body);
    frame.z = p.z; frame.d = p.d;
    frame.t = firebase.database.ServerValue.TIMESTAMP;
    ref.child('frame').set(frame).catch(function () {});
  }
  function pushHead() {
    var p = pack(headHTML());
    var base = /^https?:/.test(location.protocol) ? location.href.replace(/[?#].*$/, '') : '';
    return ref.child('head').set({ z: p.z, d: p.d, base: base, title: GAME, ver: MV_VER });
  }
  function claimHost() {
    return ref.child('host').set({ tab: TAB, game: GAME, t: firebase.database.ServerValue.TIMESTAMP })
      .then(function () { claimed = true; });
  }
  function armDisconnect() {
    ['frame', 'head', 'host'].forEach(function (k) { ref.child(k).onDisconnect().remove(); });
  }
  function disarmDisconnect() {
    ['frame', 'head', 'host'].forEach(function (k) { try { ref.child(k).onDisconnect().cancel(); } catch (e) {} });
  }
  function fullResend() {
    if (!live) return;
    armDisconnect();
    Promise.all([pushHead(), claimHost()]).then(function () { lastKey = ''; push(true); }).catch(function () {});
  }

  function newCode() {
    function rand() { var s = ''; for (var i = 0; i < 5; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)]; return s; }
    var n = 0;
    function tryOne() {
      var c = rand();
      if (++n > 8) return Promise.resolve(c);
      return db.ref('rooms/' + c).once('value').then(function (s) { return s.exists() ? tryOne() : c; });
    }
    return tryOne();
  }

  function start() {
    if (live || busy) return Promise.resolve();
    busy = true; updBtn('つないでいます…');
    return Promise.all([connect(), loadPako()]).then(function () {
      var saved = null;
      try { saved = localStorage.getItem(LS_CODE); } catch (e) {}
      return saved && /^[A-Z0-9]{4,8}$/.test(saved) ? saved : newCode();
    }).then(function (c) {
      code = c;
      try { localStorage.setItem(LS_CODE, c); sessionStorage.setItem(SS_ON, '1'); } catch (e) {}
      ref = db.ref('rooms/' + code + '/mv');
      live = true; busy = false;
      // 接続が切れて戻ったとき・別のタブ/ページが消した直後にも出し直す
      var connRef = db.ref('.info/connected');
      var onConn = function (s) { if (s.val() === true) fullResend(); };
      connRef.on('value', onConn); connOff = function () { connRef.off('value', onConn); };
      var hostRef = ref.child('host');
      var onHost = function (s) {
        var h = s.val();
        if (!live) return;
        if (h && h.tab && h.tab !== TAB) { if (claimed) handOver(); return; }   // 別のタブが配信を始めた
        if (!h) setTimeout(function () { if (live) hostRef.once('value').then(function (s2) { if (live && !s2.val()) fullResend(); }); }, 300);
      };
      hostRef.on('value', onHost); hostOff = function () { hostRef.off('value', onHost); };
      var vRef = ref.child('viewers');
      var onV = function (s) { viewers = s.numChildren(); updBtn(); updModal(); };
      vRef.on('value', onV); viewOff = function () { vRef.off('value', onV); };
      observe(true);
      updBtn(); updModal();
    }).catch(function (e) {
      busy = false; live = false;
      updBtn();
      alert('iPad配信を始められませんでした。\n' + (e && e.message ? e.message : e) +
        '\n\n・インターネットにつながっているか\n・firebase-config.js が同じ場所にあるか\nを確かめてください。');
      throw e;
    });
  }
  function detach() {
    live = false;
    observe(false);
    if (pending) { clearTimeout(pending); pending = null; }
    if (connOff) connOff(); if (hostOff) hostOff(); if (viewOff) viewOff();
    connOff = hostOff = viewOff = null;
    viewers = 0; lastKey = ''; claimed = false;
  }
  function stop() {
    if (!live) return;
    var r = ref;
    disarmDisconnect();
    detach();
    try { sessionStorage.removeItem(SS_ON); } catch (e) {}
    r.child('frame').remove(); r.child('head').remove(); r.child('host').remove();
    updBtn(); updModal();
  }
  function handOver() {
    disarmDisconnect();
    detach();
    try { sessionStorage.removeItem(SS_ON); } catch (e) {}
    updBtn('別の画面で配信中'); updModal();
  }

  function observe(on) {
    if (observer) { observer.disconnect(); observer = null; }
    window.removeEventListener('resize', schedule);
    document.removeEventListener('scroll', schedule, true);
    if (!on) return;
    observer = new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var t = recs[i].target;
        var el = t.nodeType === 1 ? t : t.parentElement;
        if (!el || !el.closest || !el.closest('[id^="mv-"]')) { schedule(); return; }
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, true);
  }

  /* ---------- 先生の画面のボタンとQR ---------- */
  var CSS = '' +
    '#mv-ui{all:initial;font-family:"BIZ UDPGothic","Hiragino Sans","Yu Gothic UI",Meiryo,sans-serif}' +
    '#mv-bar{position:fixed;left:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:2147483000;display:flex;gap:8px}' +
    '#mv-btn{display:flex;align-items:center;gap:6px;' +
    'font:700 13px/1 "BIZ UDPGothic","Hiragino Sans","Yu Gothic UI",Meiryo,sans-serif;color:#fff;background:rgba(20,24,32,.78);border:1px solid rgba(255,255,255,.25);' +
    'border-radius:999px;padding:7px 12px;cursor:pointer;opacity:.55;transition:opacity .2s,transform .2s;box-shadow:0 2px 10px rgba(0,0,0,.25)}' +
    '#mv-btn:hover,#mv-home:hover{opacity:1;transform:translateY(-1px)}' +
    '#mv-home{display:flex;align-items:center;' +
    'font:700 13px/1 "BIZ UDPGothic","Hiragino Sans","Yu Gothic UI",Meiryo,sans-serif;color:#fff;background:rgba(20,24,32,.78);border:1px solid rgba(255,255,255,.25);' +
    'border-radius:999px;padding:7px 12px;cursor:pointer;opacity:.55;transition:opacity .2s,transform .2s;box-shadow:0 2px 10px rgba(0,0,0,.25);text-decoration:none}' +
    '#mv-btn.on{opacity:.9;background:rgba(10,90,60,.88)}' +
    '#mv-btn .dot{width:8px;height:8px;border-radius:50%;background:#777}' +
    '#mv-btn.on .dot{background:#5dff9c;box-shadow:0 0 8px #5dff9c;animation:mvp 1.6s infinite}' +
    '@keyframes mvp{50%{opacity:.35}}' +
    '#mv-modal{position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px}' +
    '#mv-modal[hidden]{display:none}' +
    '#mv-card{background:#fff;color:#1b2430;border-radius:18px;padding:26px 30px;max-width:760px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4);' +
    'font:16px/1.6 "BIZ UDPGothic","Hiragino Sans","Yu Gothic UI",Meiryo,sans-serif}' +
    '#mv-card h2{margin:0 0 16px;font-size:24px}' +
    '#mv-card .row{display:flex;gap:28px;align-items:center;flex-wrap:wrap}' +
    '#mv-qr{background:#fff;padding:10px;border-radius:10px;border:1px solid #dde3ea;line-height:0;min-width:240px;min-height:240px;display:flex;align-items:center;justify-content:center}' +
    '#mv-qr img,#mv-qr canvas{width:240px;height:240px}' +
    '#mv-card .code{font-size:15px;color:#5a6776;margin-top:8px}' +
    '#mv-card .code b{display:block;font:800 54px/1.1 "DotGothic16",ui-monospace,Menlo,Consolas,monospace;letter-spacing:.12em;color:#1b2430}' +
    '#mv-card .url{font-size:13px;color:#5a6776;word-break:break-all;margin:6px 0 0}' +
    '#mv-card .cnt{margin-top:12px;font-weight:700}' +
    '#mv-card .note{font-size:13px;color:#5a6776;margin:10px 0 0}' +
    '#mv-card .warn{background:#fff3cd;color:#7a5200;border-radius:8px;padding:8px 12px;font-size:14px;margin-top:12px}' +
    '#mv-card .btns{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}' +
    '#mv-card button{font:700 16px/1 inherit;font-family:inherit;border-radius:10px;padding:12px 20px;cursor:pointer;border:1px solid #c9d2dc;background:#f4f6f8;color:#1b2430}' +
    '#mv-card button.pri{background:#1b6ef3;border-color:#1b6ef3;color:#fff}' +
    '#mv-card button.stop{color:#b3261e}';

  var ui, btn, modal;
  function buildUI() {
    var st = document.createElement('style'); st.id = 'mv-style'; st.textContent = CSS;
    document.head.appendChild(st);
    ui = document.createElement('div'); ui.id = 'mv-ui';
    var showHome = !window.MV_IS_MENU;
    ui.innerHTML = '<div id="mv-bar">' + (showHome ? '<a id="mv-home" href="' + BASE + 'menu.html" tabindex="-1" title="ゲームメニューにもどる">🏠 メニュー</a>' : '') +
      '<button id="mv-btn" type="button" tabindex="-1" title="生徒のiPadにこの画面を映します"><span class="dot"></span><span id="mv-lbl">📱 iPadに映す</span></button></div>' +
      '<div id="mv-modal" hidden><div id="mv-card" role="dialog" aria-modal="true">' +
      '<h2>📱 iPadでこの画面を見る</h2>' +
      '<div class="row"><div id="mv-qr"></div><div style="flex:1;min-width:240px">' +
      '<div>iPadのカメラでQRコードを読み取ってください。</div>' +
      '<div class="code">参加コード<b id="mv-code">-----</b></div>' +
      '<p class="url" id="mv-url"></p>' +
      '<div class="cnt" id="mv-cnt"></div>' +
      '<p class="note">iPadは見るだけで、操作はできません。ほかのゲームに切り替えても同じコードのまま映ります。</p>' +
      '<div class="warn" id="mv-warn" hidden></div>' +
      '</div></div>' +
      '<div class="btns"><button type="button" class="stop" id="mv-stop">配信を止める</button><button type="button" class="pri" id="mv-close">閉じる</button></div>' +
      '</div></div>';
    document.body.appendChild(ui);
    btn = ui.querySelector('#mv-btn'); modal = ui.querySelector('#mv-modal');
    var home = ui.querySelector('#mv-home');
    if (home) {
      home.addEventListener('mousedown', function (e) { e.preventDefault(); });
      home.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!confirm('ゲームメニューにもどりますか?\nいま遊んでいるゲームは終了します。')) e.preventDefault();
      });
    }
    btn.addEventListener('mousedown', function (e) { e.preventDefault(); });   // フォーカスを奪わない(スペースキーの誤作動防止)
    btn.addEventListener('click', function (e) {
      e.stopPropagation(); btn.blur();
      openModal();
      if (!live) start().catch(function () { closeModal(); });
    });
    ui.querySelector('#mv-close').addEventListener('click', function (e) { e.stopPropagation(); closeModal(); });
    ui.querySelector('#mv-stop').addEventListener('click', function (e) { e.stopPropagation(); stop(); closeModal(); });
    modal.addEventListener('click', function (e) { e.stopPropagation(); if (e.target === modal) closeModal(); });
    // モーダルを開いている間はキー操作をゲームに渡さない
    window.addEventListener('keydown', function (e) {
      if (!modalOpen) return;
      e.stopImmediatePropagation();
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeModal(); }
    }, true);
  }
  function viewURL() { return BASE + 'view.html?r=' + (code || ''); }
  function updBtn(txt) {
    if (!btn) return;
    btn.classList.toggle('on', live);
    ui.querySelector('#mv-lbl').textContent = txt || (live ? '📱 配信中 ' + code + (viewers ? '・' + viewers + '台' : '') : '📱 iPadに映す');
  }
  var qrFor = null;
  function updModal() {
    if (!modal || !modalOpen) return;
    ui.querySelector('#mv-code').textContent = code || '-----';
    ui.querySelector('#mv-url').textContent = code ? viewURL() : '';
    ui.querySelector('#mv-cnt').textContent = live ? '見ているiPad:' + viewers + '台' : (busy ? 'つないでいます…' : '配信は止まっています');
    ui.querySelector('#mv-stop').hidden = !live;
    var warn = ui.querySelector('#mv-warn');
    if (!/^https?:/.test(location.protocol)) {
      warn.hidden = false;
      warn.textContent = 'このページはパソコンのファイルから開かれているため、QRコードではiPadから開けません。GitHub Pages のアドレスでゲームを開いてください。';
    } else warn.hidden = true;
    if (code && qrFor !== code) {
      loadQR().then(function () {
        var box = ui.querySelector('#mv-qr'); box.innerHTML = '';
        if (window.QRCode) {
          new window.QRCode(box, { text: viewURL(), width: 240, height: 240, correctLevel: window.QRCode.CorrectLevel.M });
          qrFor = code;
        } else box.textContent = 'QRコードを表示できません';
      });
    }
  }
  function openModal() { modalOpen = true; modal.hidden = false; updModal(); }
  function closeModal() { modalOpen = false; modal.hidden = true; }

  function init() {
    buildUI();
    updBtn();
    var resume = false;
    try { resume = sessionStorage.getItem(SS_ON) === '1'; } catch (e) {}
    if (resume) start().catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // テスト・確認用
  window.MV = { start: start, stop: stop, get code() { return code; }, get live() { return live; }, push: function () { push(true); } };
})();
