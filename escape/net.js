/* 通信(Firebase / お試しモード)。Firestore風の doc / collection で game.js から使う。
   保存先: rooms/{参加コード}/game/state と rooms/{参加コード}/groups/{A..D}
   (教室ダービーなどと同じ rooms/ 配下なので、既存のFirebaseルールのまま動く) */
const FB_VER = '10.12.2';
const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function rid(n){ let s = ''; for (let i = 0; i < n; i++) s += CODE_CH[Math.floor(Math.random() * CODE_CH.length)]; return s; }
function loadScript(src){ return new Promise((ok, ng) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ng(new Error('読み込めませんでした:' + src)); document.head.appendChild(s); }); }

/* バックエンド:set / update / remove / on(path, cb(value)) -> 解除関数 */
async function firebaseBackend(room){
  if (!window.FIREBASE_CONFIG) throw new Error('firebase-config.js が見つかりません');
  await loadScript('https://www.gstatic.com/firebasejs/' + FB_VER + '/firebase-app-compat.js');
  await loadScript('https://www.gstatic.com/firebasejs/' + FB_VER + '/firebase-database-compat.js');
  if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
  const db = firebase.database();
  const R = p => db.ref('rooms/' + room + (p ? '/' + p : ''));
  return {
    kind: 'firebase',
    set: (p, v) => R(p).set(v),
    update: (p, v) => R(p).update(v),
    remove: p => R(p).remove(),
    on(p, cb, err){ const r = R(p); const h = r.on('value', s => cb(s.val()), err || (() => {})); return () => r.off('value', h); }
  };
}

/* お試しモード:同じブラウザの別タブどうしで localStorage を共有する */
function localBackend(room){
  const K = 'esc.local.' + room;
  const read = () => { try { return JSON.parse(localStorage.getItem(K)) || {}; } catch (e) { return {}; } };
  const write = t => { try { localStorage.setItem(K, JSON.stringify(t)); } catch (e) {} };
  const get = (t, p) => p.split('/').filter(Boolean).reduce((o, k) => (o == null ? o : o[k]), t);
  const subs = [];
  const fire = () => { const t = read(); subs.forEach(s => s.cb(get(t, s.p) === undefined ? null : get(t, s.p))); };
  window.addEventListener('storage', e => { if (e.key === K) fire(); });
  const put = (p, fn) => { const t = read(); const ks = p.split('/').filter(Boolean); let o = t; ks.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || o[k] == null) o[k] = {}; o = o[k]; }); fn(o, ks[ks.length - 1]); write(t); setTimeout(fire, 0); };
  return {
    kind: 'local',
    set: (p, v) => { put(p, (o, k) => { o[k] = JSON.parse(JSON.stringify(v)); }); return Promise.resolve(); },
    update: (p, v) => { put(p, (o, k) => { o[k] = Object.assign({}, o[k] || {}, JSON.parse(JSON.stringify(v))); }); return Promise.resolve(); },
    remove: p => { put(p, (o, k) => { delete o[k]; }); return Promise.resolve(); },
    on(p, cb){ const s = { p, cb }; subs.push(s); setTimeout(() => { const v = get(read(), p); cb(v === undefined ? null : v); }, 0); return () => { const i = subs.indexOf(s); if (i >= 0) subs.splice(i, 1); }; }
  };
}

/* game.js が使う Firestore風の窓口 */
function wrapDb(be){
  const snapOf = v => ({ exists: v != null, data: () => v });
  return {
    kind: be.kind,
    doc: p => ({
      set: d => be.set(p, d),
      update: d => be.update(p, d),
      delete: () => be.remove(p),
      onSnapshot: (cb, err) => be.on(p, v => cb(snapOf(v)), err)
    }),
    collection: p => ({
      onSnapshot: (cb, err) => be.on(p, v => cb({ docs: Object.keys(v || {}).map(id => ({ id, data: () => v[id] })) }), err)
    })
  };
}
async function connectDb(room, local){
  const be = local ? localBackend(room) : await firebaseBackend(room);
  return wrapDb(be);
}
