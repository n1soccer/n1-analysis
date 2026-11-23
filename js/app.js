(() => {
const $ = s => document.querySelector(s);
const video = $('#video'), ink = $('#ink'), stage = $('#stage');
const inkCtx = ink.getContext('2d'); let ctx = inkCtx;
const FPS = 30;
const COLORS = [['#ffd23f','黄'],['#ff2d78','ピンク'],['#ff4d4d','赤'],['#3ec9ff','青'],['#ffffff','白']];
const HINTS = {
  move: '<b>編集</b>：図形・分身・コメントをドラッグで動かす。矢印は両端の●で長さ、真ん中の○で曲がり具合を変える（○をダブルクリックでまっすぐに戻す）。エリアは角の●で形を変え、辺の○で角を追加。新しく追加するときはパス・選手などのツールを選ぶ。',
  arrow: '<b>パス</b>：ドラッグで矢印を描く。「移動」で真ん中の○を引くとカーブになる。',
  run: '<b>ラン</b>：ドラッグで点線矢印（人の動き）を描く。',
  space: '<b>スペース</b>：出し手から、ボールを出したいスペースへドラッグ。着地点に点線の円が付く。「移動」で真ん中の○を引くと浮き球・カーブに。',
  beam: '<b>ライト</b>：照らしたい選手の足元から外へドラッグ（タップだけでもOK）。上から光の柱が当たる。「編集」でドラッグして動かせる。',
  glow: '<b>発光</b>：光らせたい選手を四角で囲む。選手の形にそって色が光る（芝の色を見分けて選手だけ切り抜く）。一時停止中・フリーズ中に使うのがおすすめ。',
  zoom: '<b>ZOOM</b>：拡大したいところの中心から外へドラッグして円を描く（タップだけでもOK）。円の中が拡大される。「編集」で円のふちの●を引くと大きさ、場面リストで倍率を変えられる。',
  spot: '<b>スポットライト</b>：目立たせたい選手や場所を四角で囲むと、そこだけ明るく周りが暗くなる。選手マークの「スポット」を押すと、追いかけながら照らせる。',
  pulse: '<b>強調</b>：矢印・選手マーク・エリア・文字などをタップすると、膨らむ・縮むをくり返して目立つ。もう一度タップで解除。間隔はツール欄で選ぶ。',
  view: '<b>視野</b>：選手の足元（選手マーク）から、見ている方向へドラッグ。選手マークから描くと、選手が動いても視野がついていく。「移動」で先端の●で向きと距離、横の○で広さを変える。',
  link: '<b>つなぐ</b>：選手の足元を順にタップすると、黒い円盤ができて光る線でつながる（DFラインなど）。今ある選手マークをタップすればそれにつなぐ。終わるときは最後の丸をもう一度タップ（Esc か別のツールでも終了）。',
  ring: '<b>選手</b>：選手の足元から外へドラッグしてマーク。右の場面リストの「自動で追いかける」で映像の動きについていきます。',
  ghost: '<b>分身</b>：動かしたい選手を四角で囲む → 分身ができるので、本当にいてほしかった位置へドラッグ。',
  tri: '<b>三角</b>：ドラッグで三角のエリアを描く。描いたあと自動で「移動」になるので、角の●を引いて形を整えてください。',
  zone: '<b>四角</b>：ドラッグで四角のエリアを描く。描いたあと自動で「移動」になるので、角の●を引いて形を整えてください。',
  pen: '<b>フリー</b>：自由に線を描く。',
  text: '<b>文字</b>：タップした位置に文字を置く。Enterで改行、外をタップで確定。「移動」で文字をダブルクリックすると書き直せる。大きさと背景色はツール欄で選ぶ。置いた文字は右の場面リストで大きさ・背景を変えられる。',
  erase: '<b>消す</b>：消したい図形をタップ。'
};
const BGS = [['dark','黒','rgba(10,14,12,.82)',null],['white','白','rgba(255,255,255,.93)','#111'],['yellow','黄','#ffd23f','#111'],['pink','ピンク','#ff2d78','#fff'],['red','赤','#e5392f','#fff'],['blue','青','#1f7fd6','#fff'],['none','なし',null,null]];
const BG = Object.fromEntries(BGS.map(b => [b[0], { key:b[0], name:b[1], fill:b[2], tc:b[3] }]));
function bgDot(k){ const b = BG[k]; return `<i class="bgdot" style="background:${b.fill || 'transparent'};${k === 'none' ? 'border-style:dashed' : ''}"></i>`; }
const SIZES = [[0.7,'小'],[1,'中'],[1.4,'大'],[2,'特大']];
const sizeName = v => (SIZES.find(x => x[0] === (v || 1)) || [0,'中'])[1];
const nextSize = v => SIZES[(SIZES.findIndex(x => x[0] === (v || 1)) + 1) % SIZES.length][0];
const textFs = (s, W) => Math.max(10, W*.026*(s.fs || 1));
function textBox(s, W, H){
  const fs = textFs(s, W), pad = fs*.45, lh = fs*1.3, lines = String(s.s).split('\n');
  ctx.save(); ctx.font = `700 ${fs}px "Noto Sans JP", sans-serif`; const tw = Math.max(...lines.map(l => ctx.measureText(l).width)); ctx.restore();
  const bw = tw + pad*2, bh = (lines.length - 1)*lh + fs + pad*1.2;
  return { fs, pad, lh, lines, bw, bh, x:s.a[0]*W, top:s.a[1]*H - bh/2 };
}
const S = { open:new Set(), tool:'arrow', color:COLORS[0][0], moments:[], key:'', src:null, lastT:0, skipId:null, holdId:null, holdUntil:null,
  draft:null, drag:null, undo:[], redo:[], url:null, enter:new Map(), tracking:null, warnedQuota:false };
const clamp = (v,a,b) => Math.min(b, Math.max(a, v));
const esc = v => String(v).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
const uid = () => Math.random().toString(36).slice(2,9);
const ease = u => u*u*(3-2*u);
const fmt = t => { if (!isFinite(t) || t < 0) t = 0; const m = Math.floor(t/60), s = Math.floor(t%60), f = Math.floor((t%1)*FPS + 1e-6);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(f).padStart(2,'0')}`; };

let toastT;
function toast(msg, ms = 2600){ const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, ms); }

/* ---------- source ---------- */
function videoSource(v){
  return {
    get t(){ return v.currentTime }, set t(x){ v.currentTime = clamp(x, 0, v.duration || 0) },
    get dur(){ return isFinite(v.duration) ? v.duration : 0 }, get paused(){ return v.paused },
    play(){ const p = v.play(); if (p && p.catch) p.catch(() => {}); }, pause(){ v.pause() },
    set rate(r){ v.playbackRate = r }, aspect(){ return v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16/9 }
  };
}

/* ---------- storage / undo ---------- */
const IDB = (() => {
  let p;
  const open = () => p || (p = new Promise((res, rej) => {
    try { const r = indexedDB.open('n1va', 1); r.onupgradeneeded = () => r.result.createObjectStore('works', { keyPath:'key' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
    catch(e){ rej(e); }
  }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction('works', mode), q = fn(t.objectStore('works'));
    t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
  return { get:k => tx('readonly', st => st.get(k)), put:v => tx('readwrite', st => st.put(v)), all:() => tx('readonly', st => st.getAll()), del:k => tx('readwrite', st => st.delete(k)) };
})();
function legacyLoad(key){ try { const r = localStorage.getItem(key); if (r){ const d = JSON.parse(r); if (Array.isArray(d.moments)) return d.moments; } } catch(e){} return null; }
const hm = d => { const x = new Date(d); return `${x.getMonth()+1}/${x.getDate()} ${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`; };
function setSaveState(txt, cls){ const el = $('#saveState'); el.textContent = txt; el.className = 'saved' + (cls ? ' ' + cls : ''); }
function workRecord(){ return { key:S.key, name:S.fileName || '', dur:S.src ? S.src.dur : 0, updated:Date.now(), moments:S.moments, clips:S.clips }; }
let saveT; function save(){
  if (!S.src || S.loading) return;
  clearTimeout(saveT); setSaveState('保存中…');
  saveT = setTimeout(() => {
    const rec = workRecord();
    IDB.put(rec).then(() => { setSaveState(`自動保存済み ${hm(rec.updated)}`, 'ok'); try { localStorage.removeItem(rec.key); } catch(e){} })
      .catch(() => {
        try { localStorage.setItem(rec.key, JSON.stringify({ moments:rec.moments })); setSaveState(`自動保存済み ${hm(rec.updated)}`, 'ok'); }
        catch(e){ setSaveState('保存できませんでした', 'err'); if (!S.warnedQuota){ S.warnedQuota = true; toast('この端末の保存容量がいっぱいです。「作業をファイルに保存」で控えてください', 4500); } }
      });
  }, 300);
}
function cleanMoments(arr){
  return normMoments(arr.filter(m => m && typeof m.t === 'number' && Array.isArray(m.shapes))
    .map(m => ({ ...m, id:m.id || uid(), pause:m.pause ?? -1, show:m.show ?? 5, comment:m.comment || '' })))
    .sort((a,b) => a.t - b.t);
}
function applyWork(arr, msg, clips){
  snapshot(); S.moments = cleanMoments(arr); S.clips = Array.isArray(clips) && clips.length ? clips : null; select(null); S.open = new Set(); S.enter.clear(); S.loading = false;
  save(); renderList(); toast(msg || `${S.moments.length}件の場面を読み込みました`);
}
function updUndo(){ const u = document.getElementById('undo'), r = document.getElementById('redo'); if (u) u.disabled = !S.undo.length; if (r) r.disabled = !S.redo.length; }
const snapState = () => JSON.stringify({ m:S.moments, c:S.clips });
function restoreState(str){ const o = JSON.parse(str); if (Array.isArray(o)) S.moments = o; else { S.moments = o.m; S.clips = o.c || null; } }
function snapshot(){ S.undo.push(snapState()); if (S.undo.length > 40) S.undo.shift(); S.redo = []; updUndo(); }
function undo(){ const s = S.undo.pop(); if (!s){ toast('元に戻す操作はありません'); return; } S.redo.push(snapState()); restoreState(s); save(); renderList(); updUndo(); }
function redo(){ const s = S.redo.pop(); if (!s){ toast('やり直す操作はありません'); return; } S.undo.push(snapState()); if (S.undo.length > 40) S.undo.shift(); restoreState(s); save(); renderList(); updUndo(); }
try { $('#noAuto').checked = localStorage.getItem('n1va:noAuto') === '1'; } catch(e){}
S.protect = true; S.anim = true;
try { S.protect = localStorage.getItem('n1va:protect') !== '0'; S.anim = localStorage.getItem('n1va:anim') !== '0'; } catch(e){}
$('#protect').checked = S.protect; $('#anim').checked = S.anim;
$('#protect').onchange = e => { S.protect = e.target.checked; try { localStorage.setItem('n1va:protect', S.protect ? '1' : '0'); } catch(_){} };
$('#anim').onchange = e => { S.anim = e.target.checked; try { localStorage.setItem('n1va:anim', S.anim ? '1' : '0'); } catch(_){} };
$('#noAuto').onchange = e => { try { localStorage.setItem('n1va:noAuto', e.target.checked ? '1' : '0'); } catch(_){} if (e.target.checked) S.holdUntil = null; };

/* ---------- moments & shapes ---------- */
const momentAt = t => S.moments.find(m => Math.abs(m.t - t) < 0.045);
function ensureMoment(t){
  let m = momentAt(t);
  if (!m){ m = { id:uid(), t, pause:-1, show:5, comment:'', shapes:[] }; S.moments.push(m); S.open.add(m.id); S.moments.sort((a,b) => a.t - b.t); }
  return m;
}
const lastMomentBefore = t => { let r = null; for (const m of S.moments) if (m.t <= t + 0.045) r = m; return r; };
function trackEnd(s){ return s.track && s.track.length > 1 ? s.track[s.track.length-1][0] : -1; }
function nextMomentT(m){ let n = null; for (const x of S.moments) if (x.t > m.t + 0.045 && (n == null || x.t < n)) n = x.t; return n; }
function shapeEnd(m, s){
  if (s.until != null) return s.until;
  const e = s.ref ? (() => { const R = findShape(s.ref); return Math.max(m.t + m.show, R ? trackEnd(R.s) : -1); })() : Math.max(m.t + m.show, trackEnd(s));
  const nx = nextMomentT(m);
  return nx != null ? Math.min(e, nx) : e;
}
const GK = .42;
function viewOrigin(s, t){ if (s.ref){ const R = findShape(s.ref); if (R) return ringCenter(R.s, t); } return s.a; }
function viewGeom(s, t, W, H){
  const [ox,oy] = viewOrigin(s, t).map((v,i) => v*(i ? H : W)), dx = s.d[0]*W, dy = s.d[1]*H/GK;
  const R = Math.hypot(dx, dy), th = Math.atan2(dy, dx), w = s.w*Math.PI/180;
  const at = (ang, r) => [ox + Math.cos(ang)*r, oy + Math.sin(ang)*r*GK];
  return { ox, oy, R, th, w, tip:at(th, R), wing:at(th + w, R*.85), e1:at(th - w, R), e2:at(th + w, R) };
}
function hexA(hex, a){ const n = parseInt(hex.slice(1), 16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; }
function findShape(ref){ if (!ref) return null; const m = S.moments.find(x => x.id === ref[0]); if (!m) return null; const s = m.shapes.find(x => x.id === ref[1]); return s ? { m, s } : null; }
function pruneLinks(){ S.moments.forEach(m => { m.shapes = m.shapes.filter(s => s.type !== 'link' || (findShape(s.from) && findShape(s.to))); }); }
function arrowMid(s){ return s.ctl ? [.25*s.a[0] + .5*s.ctl[0] + .25*s.b[0], .25*s.a[1] + .5*s.ctl[1] + .25*s.b[1]] : [(s.a[0]+s.b[0])/2, (s.a[1]+s.b[1])/2]; }
function curvePts(s){ if (!s.ctl) return [s.a, s.b]; const out = []; for (let i = 0; i <= 20; i++){ const u = i/20, v = 1-u; out.push([v*v*s.a[0] + 2*v*u*s.ctl[0] + u*u*s.b[0], v*v*s.a[1] + 2*v*u*s.ctl[1] + u*u*s.b[1]]); } return out; }
function shapeStart(m, s){ return s.t0 ?? m.t; }
function shapeOn(m, s, t){
  if (t < shapeStart(m, s) - 0.045) return false;
  if (s.type === 'link'){ if (s.until != null && t >= s.until) return false; const A = findShape(s.from), B = findShape(s.to); return !!(A && B && shapeOn(A.m, A.s, t) && shapeOn(B.m, B.s, t)); }
  if (t < shapeEnd(m, s)) return true;
  return false;
}
function shapeAlpha(m, s, t){
  if (s.type === 'link'){ const A = findShape(s.from), B = findShape(s.to); return A && B ? Math.min(shapeAlpha(A.m, A.s, t), shapeAlpha(B.m, B.s, t)) : 0; }
  const e = shapeEnd(m, s); if (t >= e) return .45;
  const fade = Math.min(.3, Math.max(0, e - shapeStart(m, s)) * .3);
  return fade > 0 ? clamp((e - t) / fade, 0, 1) : 1; }
const momentOn = (m, t) => (t >= m.t - 0.045 && t < m.t + m.show) || m.shapes.some(s => shapeOn(m, s, t));
function ringCenter(s, t){
  const k = s.track; if (!k || !k.length) return s.a;
  if (t <= k[0][0]) return [k[0][1], k[0][2]];
  if (t >= k[k.length-1][0]){ const l = k[k.length-1]; return [l[1], l[2]]; }
  let i = 1; while (k[i][0] < t) i++;
  const a = k[i-1], b = k[i], u = (t - a[0]) / (b[0] - a[0] || 1);
  return [a[1] + (b[1]-a[1])*u, a[2] + (b[2]-a[2])*u];
}
function setKey(s, t, p){
  if (!s.track) s.track = [];
  s.track = s.track.filter(k => Math.abs(k[0] - t) > 1/60);
  s.track.push([t, p[0], p[1]]); s.track.sort((a,b) => a[0] - b[0]);
}
function boxPts(a, b, kind){
  const x0 = Math.min(a[0],b[0]), x1 = Math.max(a[0],b[0]), y0 = Math.min(a[1],b[1]), y1 = Math.max(a[1],b[1]);
  return kind === 'tri' ? [[(x0+x1)/2, y0], [x1, y1], [x0, y1]] : [[x0,y0], [x1,y0], [x1,y1], [x0,y1]];
}
const zonePts = s => s.pts || boxPts(s.a, s.b, s.kind);
function normZone(s){ if (!s.pts) s.pts = boxPts(s.a, s.b, s.kind); delete s.a; delete s.b; delete s.kind; return s; }
const normMoments = arr => { arr.forEach(m => m.shapes.forEach(s => { if (s.type === 'zone') normZone(s); if (s.type === 'ring' && !s.id) s.id = uid(); })); return arr; };
const imgCache = new Map();
function getImg(src){ let im = imgCache.get(src); if (!im){ im = new Image(); im.src = src; imgCache.set(src, im); } return im; }
function ghostPos(s, age){ const p = ease(clamp(age / 900, 0, 1)); return [s.a[0] + (s.b[0]-s.a[0])*p, s.a[1] + (s.b[1]-s.a[1])*p]; }

/* ---------- playback ---------- */
function clearHold(){ S.holdId = null; S.holdUntil = null; }
function hold(m){
  // 行き過ぎが少しなら戻さずにそのコマで止める（戻すとカクッとするため）
  const s = S.src; s.pause(); if (Math.abs(s.t - m.t) > .12) s.t = m.t; S.lastT = s.t; S.skipId = m.id; S.holdId = m.id;
  const ex = S.exporting, sec = m.pause > 0 ? m.pause : (ex ? ex.holdSec : 0);
  S.holdUntil = sec > 0 && (ex || !$('#noAuto').checked) ? performance.now() + sec * 1000 : null;
  S.holdTotal = sec * 1000;
  // フリーズ（自動で再開する停止）と書き出し中はフラッシュしない
  if (!ex && !S.holdUntil){ const fl = $('#flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); }
}
function togglePlay(){ const s = S.src; if (!s || S.tracking) return; clearHold();
  if (s.paused && S.clips){ const L = S.clips[S.clips.length-1], ci = curCi(); if (ci < 0 || (ci === S.clips.length - 1 && s.t >= L[1] - .06)){ seek(S.clips[0][0]); S.ci = 0; } }
  if (s.paused) s.play(); else s.pause(); }
function seek(t){ const s = S.src; if (!s) return; clearHold(); s.t = clamp(t, 0, s.dur || t); S.lastT = s.t; const m = momentAt(s.t); S.skipId = m ? m.id : null;
  if (S.clips){ const c = S.clips[S.ci], x = s.t; if (!(c && x >= c[0] - 1e-3 && x <= c[1] + 1e-3)) S.ci = Math.max(0, S.clips.findIndex(c => x >= c[0] - 1e-3 && x < c[1] - 1e-3)); } }
function step(d){ const s = S.src; if (!s || S.tracking) return; s.pause(); seek(s.t + d); }

function loop(now){
  const s = S.src;
  if (s){
    if (!s.paused && !S.tracking && S.clips && !S.holdId){
      const t0 = s.t, cs = S.clips, ci = curCi();
      const jump = x => { if (S.exporting) recWait(); s.t = x; S.lastT = x - .001; };
      if (ci < 0){ const n = cs.findIndex(c => c[0] > t0 - 1e-3); if (n >= 0){ S.ci = n; jump(cs[n][0]); } else s.pause(); }
      else {
        S.ci = ci;
        if (t0 >= cs[ci][1] - 1e-3){
          if (ci + 1 < cs.length){ S.ci = ci + 1; const nx = cs[ci + 1][0]; if (Math.abs(nx - cs[ci][1]) > .02 || t0 > nx + .1) jump(nx); }
          else s.pause();
        }
      }
    }
    const cur = s.t;
    if (!s.paused && !S.tracking){
      const prev = S.lastT;
      if (cur > prev && cur - prev < 1.5){
        // 「図形なし」の部分では押すまで停止を、「フリーズなし」の部分ではフリーズを飛ばす
        const fl = curFlag();
        const m = S.moments.find(m => m.id !== S.skipId && m.pause !== 0 && !((fl & NOFX) && m.pause < 0) && !((fl & NOFRZ) && m.pause > 0) && m.t > prev && m.t <= cur + 0.001);
        if (m) hold(m);
      }
    }
    if (S.holdId && S.holdUntil && now >= S.holdUntil){ S.holdId = null; S.holdUntil = null; if (S.exporting) recWait(); s.play(); }
    if (S.skipId){ const sm = S.moments.find(x => x.id === S.skipId); if (!sm || Math.abs(s.t - sm.t) > 0.3) S.skipId = null; }
    S.lastT = s.t;
    drawInk(now); updateUI(now);
    if (S.exporting) exportTick();
  }
  requestAnimationFrame(loop);
}

/* ---------- drawing ---------- */
function arrowHead(c, x1, y1, x2, y2, lw){
  const ang = Math.atan2(y2-y1, x2-x1), hl = lw*4.2;
  c.beginPath(); c.moveTo(x2,y2); c.lineTo(x2 - Math.cos(ang-.45)*hl, y2 - Math.sin(ang-.45)*hl); c.lineTo(x2 - Math.cos(ang+.45)*hl, y2 - Math.sin(ang+.45)*hl); c.closePath(); c.fill();
  return [x2 - Math.cos(ang)*hl*.8, y2 - Math.sin(ang)*hl*.8];
}
function shapeCenter(s, t, W, H){
  const P = q => [q[0]*W, q[1]*H];
  switch (s.type){
    case 'arrow': return P(arrowMid(s));
    case 'ring': return P(ringCenter(s, t));
    case 'zone': { const pts = zonePts(s); return P([pts.reduce((a,q) => a + q[0], 0)/pts.length, pts.reduce((a,q) => a + q[1], 0)/pts.length]); }
    case 'pen': return P([s.pts.reduce((a,q) => a + q[0], 0)/s.pts.length, s.pts.reduce((a,q) => a + q[1], 0)/s.pts.length]);
    case 'view': { const g = viewGeom(s, t, W, H); return [(g.ox + g.tip[0])/2, (g.oy + g.tip[1])/2]; }
    case 'ghost': return P(s.b);
    case 'link': { const A = findShape(s.from), B = findShape(s.to); if (A && B){ const a = ringCenter(A.s, t), b = ringCenter(B.s, t); return P([(a[0]+b[0])/2, (a[1]+b[1])/2]); } return [0,0]; }
    case 'text': { const tb = textBox(s, W, H); return [tb.x + tb.bw/2, tb.top + tb.bh/2]; }
    case 'glow': return P([(s.a[0]+s.b[0])/2, (s.a[1]+s.b[1])/2]);
    default: return s.a ? P(s.a) : [0,0];
  }
}
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
/* ---------- ZOOM・発光 ---------- */
// 動画の一部を描く（はみ出す部分は切り詰める。Safari ははみ出すと何も描かないため）
function drawVideoPart(c, sx, sy, sw, sh, dx, dy, dw, dh){
  const vw = video.videoWidth, vh = video.videoHeight, kx = dw / sw, ky = dh / sh;
  let x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(vw, sx + sw), y1 = Math.min(vh, sy + sh);
  if (x1 - x0 < 1 || y1 - y0 < 1) return;
  try { c.drawImage(video, x0, y0, x1 - x0, y1 - y0, dx + (x0 - sx)*kx, dy + (y0 - sy)*ky, (x1 - x0)*kx, (y1 - y0)*ky); } catch(e){}
}
const GLOW = new WeakMap();
/* ライト・発光・ZOOM の自動追尾：基準点（足元／中心）の動きをそのまま図形全体に足す */
const TRACKABLE = new Set(['beam', 'glow', 'zoom']);
function anchorOf(s){ return s.type === 'glow' ? [(s.a[0] + s.b[0]) / 2, Math.max(s.a[1], s.b[1])] : s.a; }
function shiftAt(s, t){ if (!s.track || !s.track.length) return [0, 0]; const c = ringCenter(s, t), a = anchorOf(s); return [c[0] - a[0], c[1] - a[1]]; }
function placed(s, t){
  if (!TRACKABLE.has(s.type) || !s.track || !s.track.length) return s;
  const d = shiftAt(s, t); return { ...s, a:[s.a[0] + d[0], s.a[1] + d[1]], b:[s.b[0] + d[0], s.b[1] + d[1]], _o:s };
}
// 四角の中で芝の色（緑系）以外を選手とみなし、その形にそって光る層を作る
function glowLayer(s, x0, y0, rw, rh, lw){
  const vw = video.videoWidth, vh = video.videoHeight; if (!vw) return null;
  const pad = Math.ceil(Math.max(8, lw*4)), key = [video.currentTime.toFixed(3), x0|0, y0|0, rw|0, rh|0, s.c].join(':');
  const so = s._o || s; let G = GLOW.get(so); if (G && G.key === key) return G;
  if (G && G.key && !video.paused && performance.now() - (G.at || 0) < 50) return G;
  if (!G){ G = { cv:document.createElement('canvas'), m:document.createElement('canvas'), tint:document.createElement('canvas'), pad }; GLOW.set(so, G); }
  const W = ink.width, H = ink.height, mw = Math.max(12, Math.min(200, Math.round(rw / 2))), mh = Math.max(12, Math.round(mw * rh / rw));
  const sx = x0 / W * vw, sy = y0 / H * vh, sw = rw / W * vw, sh = rh / H * vh;
  const m = G.m; m.width = mw; m.height = mh; const mc = m.getContext('2d', { willReadFrequently:true });
  mc.clearRect(0, 0, mw, mh);
  try { mc.drawImage(video, Math.max(0, sx), Math.max(0, sy), Math.min(sw, vw - Math.max(0, sx)), Math.min(sh, vh - Math.max(0, sy)), 0, 0, mw, mh); } catch(e){ return null; }
  let img; try { img = mc.getImageData(0, 0, mw, mh); } catch(e){ return null; }
  const d = img.data, n = mw*mh, A = new Uint8Array(n), B = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4){
    const R = d[j], Gc = d[j+1], Bl = d[j+2], mx = Math.max(R, Gc, Bl), df = mx - Math.min(R, Gc, Bl);
    let turf = false;
    if (mx >= 55 && df > mx*.14 && !(mx > 158 && df < mx*.25)){ let h = mx === Gc ? 60*((Bl - R)/df + 2) : mx === R ? 60*((Gc - Bl)/df) : 60*((R - Gc)/df + 4); if (h < 0) h += 360; turf = h >= 50 && h <= 175; }
    A[i] = turf ? 0 : 1;
  }
  const pass = (src, dst, er, horiz) => { const st = horiz ? 1 : mw;
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++){ const i = y*mw + x, lo = horiz ? x > 0 : y > 0, hi = horiz ? x < mw-1 : y < mh-1, v0 = src[i], v1 = lo ? src[i-st] : v0, v2 = hi ? src[i+st] : v0; dst[i] = er ? (v0 & v1 & v2) : (v0 | v1 | v2); } };
  pass(A, B, true, true); pass(B, A, true, false); pass(A, B, false, true); pass(B, A, false, false);
  for (let i = 0, j = 0; i < n; i++, j += 4){ d[j] = d[j+1] = d[j+2] = 255; d[j+3] = A[i] ? 255 : 0; }
  mc.putImageData(img, 0, 0);
  const tn = G.tint; tn.width = mw; tn.height = mh; const tc = tn.getContext('2d');
  tc.fillStyle = s.c; tc.fillRect(0, 0, mw, mh); tc.globalCompositeOperation = 'destination-in'; tc.drawImage(m, 0, 0); tc.globalCompositeOperation = 'source-over';
  G.pad = pad; const cv = G.cv; cv.width = Math.ceil(rw) + pad*2; cv.height = Math.ceil(rh) + pad*2; const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = true;
  g.shadowColor = s.c; g.shadowBlur = pad*.9;
  for (let k = 0; k < 3; k++) g.drawImage(tn, pad, pad, rw, rh);
  g.shadowBlur = pad*.25; for (let k = 0; k < 2; k++) g.drawImage(tn, pad, pad, rw, rh);
  g.shadowBlur = 0; g.globalCompositeOperation = 'destination-out'; g.drawImage(m, pad, pad, rw, rh); g.globalCompositeOperation = 'source-over';
  G.key = key; G.at = performance.now(); return G;
}
function drawShape(s, W, H, al, t, age){
  if (s.type === 'rlabel'){ drawRingLabel(s, W, H, al, t); return; }
  if (TRACKABLE.has(s.type) && s.track && s !== S.draft) s = placed(s, t);
  const c = ctx; let lw = Math.max(2, W*.0042);
  c.save(); c.globalAlpha = al;
  if (s.pulse && !REDUCED){
    const ph = .5 - .5*Math.cos(2*Math.PI * performance.now() / (s.pulse*1000)), k = 1 + .12*ph, [cx,cy] = shapeCenter(s, t, W, H);
    c.translate(cx, cy); c.scale(k, k); c.translate(-cx, -cy); lw *= 1 + .25*ph;
  } c.strokeStyle = s.c; c.fillStyle = s.c; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
  c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = lw*1.5;
  if (s.pulse && !REDUCED){ c.shadowColor = hexA(s.c, .9); c.shadowBlur = lw*3.5; }
  if (FX.flash > 0){ c.shadowColor = `rgba(255,255,255,${.95*FX.flash})`; c.shadowBlur = lw*7*FX.flash; }
  const P = p => [p[0]*W, p[1]*H];
  if (s.type === 'arrow'){
    const [x1,y1] = P(s.a); let q = s.ctl ? P(s.ctl) : null;
    let [x2,y2] = P(s.b);
    if (FX.grow < 1){
      const u = Math.max(.02, FX.grow);
      if (q){ const qx = x1 + (q[0]-x1)*u, qy = y1 + (q[1]-y1)*u, v = 1-u; x2 = v*v*x1 + 2*v*u*q[0] + u*u*x2; y2 = v*v*y1 + 2*v*u*q[1] + u*u*y2; q = [qx, qy]; }
      else { x2 = x1 + (x2-x1)*u; y2 = y1 + (y2-y1)*u; }
    }
    const fx = q ? q[0] : x1, fy = q ? q[1] : y1;
    if (s.space){
      const r = lw*6;
      c.save(); c.setLineDash([lw*1.4, lw*1.2]); c.beginPath(); c.arc(x2, y2, r, 0, Math.PI*2);
      c.globalAlpha = al*.25; c.fill(); c.globalAlpha = al; c.stroke(); c.restore();
      c.beginPath(); c.arc(x2, y2, lw*.9, 0, Math.PI*2); c.fill();
      const dl = Math.hypot(x2-fx, y2-fy) || 1; x2 -= (x2-fx)/dl*r*1.05; y2 -= (y2-fy)/dl*r*1.05;
    }
    const [ex,ey] = arrowHead(c, fx, fy, x2, y2, lw);
    if (s.dash) c.setLineDash([lw*2.2, lw*2]);
    c.beginPath(); c.moveTo(x1,y1); if (q) c.quadraticCurveTo(q[0], q[1], ex, ey); else c.lineTo(ex,ey); c.stroke(); c.setLineDash([]);
    if (S.tool === 'move' && S.src.paused && S.draft !== s){
      const hr = Math.max(5, W*.0055), mid = P(arrowMid(s)); c.shadowBlur = 0; c.lineWidth = 2; c.globalAlpha = 1;
      for (const [x,y] of [P(s.a), P(s.b)]){ c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.beginPath(); c.arc(x, y, hr, 0, Math.PI*2); c.fill(); c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,.55)'; c.strokeStyle = '#fff'; c.beginPath(); c.arc(mid[0], mid[1], hr*.9, 0, Math.PI*2); c.fill(); c.stroke();
    }
  } else if (s.type === 'link'){
    const A = findShape(s.from), B = findShape(s.to);
    if (A && B){
      const [x1,y1] = P(ringCenter(A.s, t)), [x2,y2] = P(ringCenter(B.s, t));
      const disc = A.s.st === 'disc' || B.s.st === 'disc';
      c.lineWidth = disc ? lw*1.15 : lw*.7; c.globalAlpha = al*Math.max(A.s.op ?? .6, B.s.op ?? .6);
      if (disc){ c.shadowColor = hexA(s.c, .9); c.shadowBlur = lw*3; }
      c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
    }
  } else if (s.type === 'ring'){
    const ctr = ringCenter(s, t), [cx,cy] = P(ctr), r = Math.max(lw*4, Math.hypot((s.b[0]-s.a[0])*W, (s.b[1]-s.a[1])*H));
    const op = s.op ?? .6;
    if (s.st === 'disc'){
      // 円盤：黒い丸＋色の光るふち
      c.save(); c.globalAlpha = al*Math.max(op, .6);
      c.shadowColor = hexA(s.c, .95); c.shadowBlur = lw*4.5; c.fillStyle = 'rgba(8,10,9,.92)';
      c.beginPath(); c.ellipse(cx, cy, r, r*.42, 0, 0, Math.PI*2); c.fill();
      c.shadowBlur = lw*2; c.lineWidth = lw*.55; c.strokeStyle = s.c; c.stroke(); c.restore();
      c.restore(); return;
    }
    c.lineWidth = lw*.7; c.shadowBlur = lw*.8;
    if (s.st === 'dash') c.setLineDash([lw*1.3, lw*1.1]);
    c.beginPath(); c.ellipse(cx, cy, r, r*.42, 0, 0, Math.PI*2);
    c.globalAlpha = al*op*.12; c.fill(); c.globalAlpha = al*op; c.stroke();
  } else if (s.type === 'gbox'){
    const [x1,y1] = P(s.a), [x2,y2] = P(s.b);
    c.setLineDash([lw*2, lw*1.6]); c.strokeRect(Math.min(x1,x2), Math.min(y1,y2), Math.abs(x2-x1), Math.abs(y2-y1));
  } else if (s.type === 'zone'){
    const pts = zonePts(s).map(P);
    c.beginPath(); pts.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath();
    c.globalAlpha = al*.2; c.fill(); c.globalAlpha = al;
    c.setLineDash([lw*2, lw*1.6]); c.stroke(); c.setLineDash([]);
    if (S.tool === 'move' && S.src.paused && s.pts){
      const hr = Math.max(6, W*.0065); c.shadowBlur = 0; c.lineWidth = 2;
      pts.forEach(([x,y], i) => {
        const [nx,ny] = pts[(i+1) % pts.length];
        c.fillStyle = 'rgba(0,0,0,.55)'; c.strokeStyle = '#fff';
        c.beginPath(); c.arc((x+nx)/2, (y+ny)/2, hr*.7, 0, Math.PI*2); c.fill(); c.stroke();
        c.fillStyle = '#fff'; c.strokeStyle = '#111';
        c.beginPath(); c.arc(x, y, hr, 0, Math.PI*2); c.fill(); c.stroke();
      });
    }
  } else if (s.type === 'pen'){
    c.beginPath(); s.pts.forEach((p,i) => { const [x,y] = P(p); i ? c.lineTo(x,y) : c.moveTo(x,y); }); c.stroke();
  } else if (s.type === 'text'){
    if (S.editText === s){ c.restore(); return; }
    const tb = textBox(s, W, H), { fs, pad, lh, lines, bw, bh, x, top } = tb, bg = BG[s.bg || 'dark'] || BG.dark;
    c.font = `700 ${fs}px "Noto Sans JP", sans-serif`; c.textBaseline = 'middle';
    c.shadowBlur = 0; c.globalAlpha = al;
    if (bg.fill){
      c.fillStyle = bg.fill;
      c.beginPath(); if (c.roundRect) c.roundRect(x, top, bw, bh, fs*.25); else c.rect(x, top, bw, bh); c.fill();
    }
    if (bg.key === 'dark'){ c.fillStyle = s.c; c.fillRect(x, top, Math.max(3, fs*.14), bh); }
    const ly = i => top + pad*.6 + fs*.5 + i*lh + 1;
    if (bg.key === 'none'){ c.lineWidth = fs*.2; c.strokeStyle = 'rgba(0,0,0,.85)'; lines.forEach((l, i) => c.strokeText(l, x + pad*1.2, ly(i))); }
    c.fillStyle = bg.tc || s.c;
    lines.forEach((l, i) => c.fillText(l, x + pad*1.2, ly(i)));
  } else if (s.type === 'view'){
    const g = viewGeom(s, t, W, H);
    if (g.R > 3){
      c.shadowBlur = 0;
      c.save(); c.translate(g.ox, g.oy); c.scale(1, GK);
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, g.R);
      gr.addColorStop(0, hexA(s.c, .5)); gr.addColorStop(.7, hexA(s.c, .22)); gr.addColorStop(1, hexA(s.c, 0));
      c.fillStyle = gr; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, g.R, g.th - g.w, g.th + g.w); c.closePath(); c.fill();
      c.restore();
      c.lineWidth = lw*.55; c.globalAlpha = al*.85;
      for (const e of [g.e1, g.e2]){
        const lg = c.createLinearGradient(g.ox, g.oy, e[0], e[1]); lg.addColorStop(0, hexA(s.c, 1)); lg.addColorStop(1, hexA(s.c, 0));
        c.strokeStyle = lg; c.beginPath(); c.moveTo(g.ox, g.oy); c.lineTo(e[0], e[1]); c.stroke();
      }
      c.globalAlpha = al; c.fillStyle = s.c; c.beginPath(); c.arc(g.ox, g.oy, lw*.9, 0, Math.PI*2); c.fill();
      if (S.tool === 'move' && S.src.paused){
        const hr = Math.max(5, W*.0055); c.lineWidth = 2;
        c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.beginPath(); c.arc(g.tip[0], g.tip[1], hr, 0, Math.PI*2); c.fill(); c.stroke();
        c.fillStyle = 'rgba(0,0,0,.55)'; c.strokeStyle = '#fff'; c.beginPath(); c.arc(g.wing[0], g.wing[1], hr*.9, 0, Math.PI*2); c.fill(); c.stroke();
      }
    }
  } else if (s.type === 'beam'){
    const [x, y] = P(s.a), rr = Math.max(lw*5, Math.hypot((s.b[0]-s.a[0])*W, (s.b[1]-s.a[1])*H)), wT = rr*.55;
    c.shadowBlur = 0;
    const g = c.createLinearGradient(0, 0, 0, y);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.1)'); g.addColorStop(1, 'rgba(255,255,255,.36)');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - wT, 0); c.lineTo(x + wT, 0); c.lineTo(x + rr, y); c.lineTo(x - rr, y); c.closePath(); c.fill();
    c.save(); c.translate(x, y); c.scale(1, .42);
    const rg = c.createRadialGradient(0, 0, 0, 0, 0, rr*1.15); rg.addColorStop(0, 'rgba(255,255,255,.5)'); rg.addColorStop(.7, 'rgba(255,255,255,.22)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = rg; c.beginPath(); c.arc(0, 0, rr*1.15, 0, Math.PI*2); c.fill(); c.restore();
    if (S.tool === 'move' && S.src.paused){ c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.7)'; c.setLineDash([5,4]); c.beginPath(); c.ellipse(x, y, rr, rr*.42, 0, 0, Math.PI*2); c.stroke(); c.setLineDash([]); }
  } else if (s.type === 'glow'){
    const x0 = Math.min(s.a[0], s.b[0])*W, y0 = Math.min(s.a[1], s.b[1])*H, rw = Math.abs(s.b[0]-s.a[0])*W, rh = Math.abs(s.b[1]-s.a[1])*H;
    if (S.draft === (s._o || s) || rw < 4 || rh < 4){ c.shadowBlur = 0; c.lineWidth = 1.5; c.setLineDash([6,4]); c.strokeRect(x0, y0, rw, rh); c.restore(); return; }
    const T = glowLayer(s, x0, y0, rw, rh, lw);
    if (T){ c.shadowBlur = 0; c.globalAlpha = al * (REDUCED ? 1 : .82 + .18*Math.sin(performance.now()/260)); c.drawImage(T.cv, x0 - T.pad, y0 - T.pad); }
    if (S.tool === 'move' && S.src.paused){ c.globalAlpha = 1; c.shadowBlur = 0; c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,255,255,.55)'; c.setLineDash([5,4]); c.strokeRect(x0, y0, rw, rh); c.setLineDash([]); }
  } else if (s.type === 'zoom'){
    const [cx, cy] = P(s.a), R = Math.max(16, Math.hypot((s.b[0]-s.a[0])*W, (s.b[1]-s.a[1])*H)), k = s.k || 2;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (vw){
      const sr = R / k * (vw / W);
      c.save(); c.shadowBlur = 0; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI*2); c.clip();
      c.fillStyle = '#000'; c.fillRect(cx - R, cy - R, R*2, R*2);
      drawVideoPart(c, s.a[0]*vw - sr, s.a[1]*vh - sr, sr*2, sr*2, cx - R, cy - R, R*2, R*2);
      c.restore();
    }
    c.lineWidth = lw*.9; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI*2); c.stroke();
    if (S.tool === 'move' && S.src.paused){ const hr = Math.max(5, W*.0055); c.shadowBlur = 0; c.lineWidth = 2; c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.beginPath(); c.arc(cx + R, cy, hr, 0, Math.PI*2); c.fill(); c.stroke(); }
  } else if (s.type === 'spot'){
    if (S.tool === 'move' && S.src.paused){
      const e = spotGeom(s, t, W, H); c.shadowBlur = 0; c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.7)'; c.setLineDash([5,4]);
      c.beginPath(); c.ellipse(e[0], e[1], e[2], e[3], 0, 0, Math.PI*2); c.stroke();
    }
  } else if (s.type === 'ghost'){
    if (s.erase && s.patch){ const pim = getImg(s.patch.url); if (pim.complete && pim.naturalWidth){ const [px0, py0, pw, ph] = s.patch.r; c.save(); c.shadowBlur = 0; c.globalAlpha = al; c.drawImage(pim, px0*W, py0*H, pw*W, ph*H); c.restore(); } }
    const pos = ghostPos(s, age), gw = s.w*s.k*W, gh = s.h*s.k*H;
    const ox = s.a[0]*W, oy = (s.a[1] + s.h/2)*H, fx = pos[0]*W, fy = (pos[1] + s.h*s.k/2)*H;
    const orx = s.w*W*.42;
    c.setLineDash([lw*1.6, lw*1.4]); c.lineWidth = lw*.8; c.strokeStyle = 'rgba(255,255,255,.85)';
    c.beginPath(); c.ellipse(ox, oy, orx, orx*.38, 0, 0, Math.PI*2); c.stroke();
    if (Math.hypot(fx-ox, fy-oy) > lw*8){
      c.strokeStyle = s.c; c.lineWidth = lw;
      const [ex,ey] = arrowHead(c, ox, oy, fx, fy - orx*.38*s.k, lw);
      c.beginPath(); c.moveTo(ox, oy); c.lineTo(ex, ey); c.stroke();
    }
    c.setLineDash([]); c.lineWidth = lw; c.strokeStyle = s.c;
    const grx = gw*.42; c.beginPath(); c.ellipse(fx, fy, grx, grx*.38, 0, 0, Math.PI*2);
    c.globalAlpha = al*.3; c.fill(); c.globalAlpha = al; c.stroke();
    const im = getImg(s.img);
    if (im.complete && im.naturalWidth){
      c.shadowColor = s.c; c.shadowBlur = lw*5; c.globalAlpha = al*.9;
      c.drawImage(im, fx - gw/2, fy - gh, gw, gh);
    }
    c.globalAlpha = al; c.shadowBlur = 0;
    const label = s.label && s.label !== 'ここ' ? s.label : '';
    if (label){
      const fs = Math.max(12, W*.018);
      c.font = `700 ${fs}px "Noto Sans JP", sans-serif`; c.textBaseline = 'middle'; c.textAlign = 'center';
      const tw = c.measureText(label).width + fs*.9, ty = fy - gh - fs*.9;
      c.fillStyle = s.c; c.beginPath(); if (c.roundRect) c.roundRect(fx - tw/2, ty - fs*.7, tw, fs*1.4, fs*.7); else c.rect(fx - tw/2, ty - fs*.7, tw, fs*1.4); c.fill();
      c.fillStyle = '#111'; c.fillText(label, fx, ty + 1);
    }
    if (S.tool === 'move' && S.src.paused){
      const hs = Math.max(10, W*.012); c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.lineWidth = 2;
      c.fillRect(fx + gw/2 - hs/2, fy - hs/2, hs, hs); c.strokeRect(fx + gw/2 - hs/2, fy - hs/2, hs, hs);
    }
  }
  c.restore();
}
function spotGeom(s, t, W, H){
  if (s.type === 'ring'){
    const [cx,cy] = ringCenter(s, t), r = Math.max(8, Math.hypot((s.b[0]-s.a[0])*W, (s.b[1]-s.a[1])*H));
    return [cx*W, cy*H - r*1.5, r*1.35, r*2.5];
  }
  const x0 = Math.min(s.a[0], s.b[0])*W, x1 = Math.max(s.a[0], s.b[0])*W, y0 = Math.min(s.a[1], s.b[1])*H, y1 = Math.max(s.a[1], s.b[1])*H;
  return [(x0+x1)/2, (y0+y1)/2, Math.max(8, (x1-x0)/2), Math.max(8, (y1-y0)/2)];
}
function drawSpots(t, W, H){
  const list = [];
  for (const m of S.moments) for (const s of m.shapes){
    if ((s.type === 'spot' || (s.type === 'ring' && s.hl)) && shapeOn(m, s, t)){ const al = shapeAlpha(m, s, t); if (al > .5 || t < shapeEnd(m, s)) list.push([spotGeom(s, t, W, H), al]); }
  }
  if (S.draft && S.draft.type === 'spot') list.push([spotGeom(S.draft, t, W, H), 1]);
  if (!list.length) return;
  const dim = Math.max(...list.map(x => x[1]));
  const ctx = inkCtx;
  ctx.save(); ctx.fillStyle = `rgba(0,0,0,${.6*dim})`; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'destination-out';
  for (const [[cx,cy,rx,ry]] of list){
    ctx.save(); ctx.translate(cx, cy); ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.15);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.78, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1.15, 0, Math.PI*2); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}
/* ---------- 登場アニメ・選手を前に ---------- */
const GROUND = new Set(['arrow', 'zone', 'pen', 'view', 'link', 'ring']);
const SENTER = new Map();
const FX = { grow:1, flash:0 };
function drawFx(s, W, H, al, t, age, sa){
  if (!S.anim || REDUCED || age >= 1e9 || sa > 600 || S.drag || s.type === 'spot'){ drawShape(s, W, H, al, t, age); return; }
  if (s.type === 'arrow' && !s.space){
    FX.grow = ease(clamp(sa / 420, 0, 1)); drawShape(s, W, H, al, t, age); FX.grow = 1; return;
  }
  // 矢印以外：パッと光って現れる
  const u = clamp(sa / 320, 0, 1), k = 1 + .18 * (1 - ease(u)), [cx, cy] = s.type === 'rlabel' ? [0, 0] : shapeCenter(s, t, W, H);
  ctx.save();
  if (s.type !== 'rlabel' && s.type !== 'text'){ ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); }
  FX.flash = 1 - u; drawShape(s, W, H, al * clamp(sa / 140, .15, 1), t, age); FX.flash = 0;
  ctx.restore();
}
const GR = { cv:document.createElement('canvas'), m:document.createElement('canvas'), t:null };
function groundCtx(W, H){
  if (GR.cv.width !== W || GR.cv.height !== H){ GR.cv.width = W; GR.cv.height = H; }
  const g = GR.cv.getContext('2d'); g.clearRect(0, 0, W, H); return g;
}
// 芝の色（緑系）以外＝選手・ボールとみなしてマスクを作る。細いライン（白線）は消す
function playerMask(){
  // 遠くに小さく映る選手も拾えるよう、細かめ（最大 800 px）で見る
  const vw = video.videoWidth, vh = video.videoHeight, mw = Math.min(800, vw), mh = Math.max(1, Math.round(mw * vh / vw));
  const t = video.currentTime;
  // 再生中は近いコマ（約1/20秒以内）なら前のマスクを使い回して軽くする
  if (GR.t != null && GR.mw === mw && (t === GR.t || (!video.paused && Math.abs(t - GR.t) < .05))) return GR.m;
  const m = GR.m; if (m.width !== mw || m.height !== mh){ m.width = mw; m.height = mh; }
  const c = m.getContext('2d', { willReadFrequently:true });
  c.globalCompositeOperation = 'source-over'; c.drawImage(video, 0, 0, mw, mh);
  let img; try { img = c.getImageData(0, 0, mw, mh); } catch(e){ return null; }
  const d = img.data, n = mw * mh;
  if (!GR.a || GR.a.length !== n){ GR.a = new Uint8Array(n); GR.b = new Uint8Array(n); GR.hr = new Uint16Array(n); GR.vr = new Uint16Array(n); GR.d1 = new Uint16Array(n); GR.d2 = new Uint16Array(n); }
  const A = GR.a, B = GR.b, HR = GR.hr, VR = GR.vr, D1 = GR.d1, D2 = GR.d2;
  // 0 = 芝、1 = 選手（白以外）、2 = 白（線かもしれない）
  for (let i = 0, j = 0; i < n; i++, j += 4){
    const R = d[j], G = d[j+1], Bl = d[j+2], mx = R > G ? (R > Bl ? R : Bl) : (G > Bl ? G : Bl), mn = R < G ? (R < Bl ? R : Bl) : (G < Bl ? G : Bl), df = mx - mn;
    // とても暗い所・ほぼ白い所は、少し緑がかっていても芝ではない（動画の圧縮で細い足やユニフォームに芝の色がにじむため）
    const white = mx > 158 && df < mx * .25;
    let turf = false;
    if (!white && mx >= 55 && df > mx * .14){
      let h; if (mx === G) h = 60 * ((Bl - R) / df + 2); else if (mx === R) h = 60 * ((G - Bl) / df); else h = 60 * ((R - G) / df + 4);
      if (h < 0) h += 360; turf = h >= 50 && h <= 175;
    }
    A[i] = turf ? 0 : white ? 2 : 1;
  }
  // 白い所の「横の長さ」「縦の長さ」を数える
  for (let y = 0; y < mh; y++){ let x = 0; while (x < mw){ const i0 = y*mw + x; if (A[i0] !== 2){ x++; continue; } let e = x; while (e < mw && A[y*mw + e] === 2) e++; for (let k = x; k < e; k++) HR[y*mw + k] = e - x; x = e; } }
  for (let x = 0; x < mw; x++){ let y = 0; while (y < mh){ if (A[y*mw + x] !== 2){ y++; continue; } let e = y; while (e < mh && A[e*mw + x] === 2) e++; for (let k = y; k < e; k++) VR[k*mw + x] = e - y; y = e; } }
  // ななめ方向（右下・左下）の長さも数える
  const diag = (D, dx) => {
    for (let s0 = 0; s0 < mw + mh; s0++){
      // 始点：上の辺と左（右）の辺
      let x = dx > 0 ? (s0 < mw ? s0 : 0) : (s0 < mw ? s0 : mw - 1), y = s0 < mw ? 0 : s0 - mw + 1;
      if (y >= mh) continue;
      let run = [];
      while (x >= 0 && x < mw && y < mh){
        const i = y*mw + x;
        if (A[i] === 2) run.push(i); else if (run.length){ for (const k of run) D[k] = run.length; run = []; }
        x += dx; y++;
      }
      if (run.length) for (const k of run) D[k] = run.length;
    }
  };
  diag(D1, 1); diag(D2, -1);
  // 線とみなす白：どこかの向きに長く続き、かつ細い（横線・縦線・ななめ線・円の線）。
  // それ以外の白（白いユニフォーム・ボール・ソックス）は選手
  const L = Math.max(14, Math.round(mw * .03));
  for (let i = 0; i < n; i++){
    if (A[i] !== 2){ B[i] = A[i]; continue; }
    const hr = HR[i], vr = VR[i], mxr = Math.max(hr, vr, D1[i], D2[i]);
    B[i] = (mxr >= L && Math.min(hr, vr) <= 7) ? 0 : 1;
  }
  // 輪郭を1回り広げて、選手のふちに図形が残らないようにする
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++){ const i = y*mw + x;
    A[i] = B[i] | (x > 0 ? B[i-1] : 0) | (x < mw-1 ? B[i+1] : 0) | (y > 0 ? B[i-mw] : 0) | (y < mh-1 ? B[i+mw] : 0); }
  for (let i = 0, j = 0; i < n; i++, j += 4){ d[j+3] = A[i] ? 255 : 0; }
  c.putImageData(img, 0, 0); GR.t = t; GR.mw = mw; return m;
}
function cutPlayers(W, H){
  const m = playerMask(); if (!m) return;
  const g = GR.cv.getContext('2d'); g.save(); g.globalCompositeOperation = 'destination-out'; g.imageSmoothingEnabled = true; g.drawImage(m, 0, 0, W, H); g.restore();
}
function drawRingLabel(s, W, H, al, t){
  const c = ctx, [cx, cy] = ringCenter(s.ring, t).map((v, i) => v * (i ? H : W)), rr = s.ring;
  const r = Math.max(Math.max(2, W*.0042)*4, Math.hypot((rr.b[0]-rr.a[0])*W, (rr.b[1]-rr.a[1])*H));
  const fs = Math.max(12, W*.017), label = rr.label;
  c.save(); c.globalAlpha = al; c.font = `700 ${fs}px "Noto Sans JP", sans-serif`; c.textBaseline = 'middle'; c.textAlign = 'center';
  const tw = c.measureText(label).width + fs*.9, ty = cy + r*.42 + fs*1.05;
  if (FX.flash > 0){ c.shadowColor = `rgba(255,255,255,${FX.flash})`; c.shadowBlur = fs * 1.2 * FX.flash; }
  c.fillStyle = rr.c; c.beginPath(); if (c.roundRect) c.roundRect(cx - tw/2, ty - fs*.72, tw, fs*1.44, fs*.72); else c.rect(cx - tw/2, ty - fs*.72, tw, fs*1.44); c.fill();
  c.shadowBlur = 0; c.fillStyle = ['#ffffff', '#ffd23f', '#3ec9ff'].includes(rr.c) ? '#111' : '#fff'; c.fillText(label, cx, ty + 1);
  c.restore();
}
function drawInk(now){
  const W = ink.width, H = ink.height; ctx.clearRect(0, 0, W, H);
  if (fxHidden()){ S.enter.clear(); SENTER.clear(); if (S.draft) drawShape(S.draft, W, H, 1, S.src.t, 1e9); return; }
  const t = S.src.t, seen = new Set();
  drawSpots(t, W, H);
  const ground = [], top = [], vis = new Set();
  for (const m of S.moments){
    if (!momentOn(m, t)) continue;
    seen.add(m.id); if (!S.enter.has(m.id)) S.enter.set(m.id, now);
    const age = now - S.enter.get(m.id);
    for (const s of m.shapes) if (shapeOn(m, s, t)){
      vis.add(s); if (!SENTER.has(s)) SENTER.set(s, now);
      const it = [s, shapeAlpha(m, s, t), (S.drag && S.drag.s === s) ? 1e9 : age, now - SENTER.get(s)];
      (GROUND.has(s.type) ? ground : top).push(it);
      if (s.type === 'ring' && s.label) top.push([{ type:'rlabel', ring:s, c:s.c }, it[1], it[2], it[3]]);
    }
  }
  for (const k of [...S.enter.keys()]) if (!seen.has(k)) S.enter.delete(k);
  for (const k of [...SENTER.keys()]) if (!vis.has(k)) SENTER.delete(k);
  const prot = S.protect && ground.length && !S.drag && video.videoWidth;
  if (prot){ ctx = groundCtx(W, H); }
  ground.sort((p, q) => (p[0].type === 'link' ? 0 : 1) - (q[0].type === 'link' ? 0 : 1));   // つなぐ線は円盤の下に
  for (const [s, al, age, sa] of ground) drawFx(s, W, H, al, t, age, sa);
  if (prot){ cutPlayers(W, H); ctx = inkCtx; ctx.drawImage(GR.cv, 0, 0); }
  for (const [s, al, age, sa] of top) drawFx(s, W, H, al, t, age, sa);
  if (S.draft) drawShape(S.draft, W, H, 1, t, 1e9);
  if (S.linkFrom){
    const f = findShape(S.linkFrom);
    if (f){
      const [cx,cy] = ringCenter(f.s, t), r = Math.max(10, Math.hypot((f.s.b[0]-f.s.a[0])*W, (f.s.b[1]-f.s.a[1])*H));
      ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([6,4]); ctx.lineDashOffset = -now/40;
      ctx.beginPath(); ctx.ellipse(cx*W, cy*H, r*1.45, r*.62, 0, 0, Math.PI*2); ctx.stroke();
      if (S.hover){ ctx.globalAlpha = .7; ctx.strokeStyle = S.color; ctx.beginPath(); ctx.moveTo(cx*W, cy*H); ctx.lineTo(S.hover[0]*W, S.hover[1]*H); ctx.stroke(); }
      ctx.restore();
    } else S.linkFrom = null;
  }
}

/* ---------- hit testing ---------- */
function segDist(p, a, b){ const dx = b[0]-a[0], dy = b[1]-a[1], l = dx*dx + dy*dy; let u = l ? ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / l : 0; u = clamp(u, 0, 1); return Math.hypot(p[0]-a[0]-u*dx, p[1]-a[1]-u*dy); }
function hitTest(np, only){
  const r = ink.getBoundingClientRect(), W = r.width, H = r.height, p = [np[0]*W, np[1]*H], P = q => [q[0]*W, q[1]*H], t = S.src.t;
  let best = null, bd = 18;
  for (const m of S.moments) m.shapes.forEach((s, i) => {
    if (!shapeOn(m, s, t) || (only && s.type !== only)) return;
    let d = Infinity, part = 'body';
    if (s.type === 'arrow'){
      if (S.tool === 'move'){
        const A = P(s.a), B = P(s.b), M = P(arrowMid(s));
        if (Math.hypot(p[0]-M[0], p[1]-M[1]) < 13){ d = -2; part = 'mid'; }
        else if (Math.hypot(p[0]-B[0], p[1]-B[1]) < 13){ d = -2; part = 'b'; }
        else if (Math.hypot(p[0]-A[0], p[1]-A[1]) < 13){ d = -2; part = 'a'; }
      }
      if (part === 'body'){ const cp = curvePts(s).map(P); for (let k = 1; k < cp.length; k++) d = Math.min(d, segDist(p, cp[k-1], cp[k])); if (s.space) d = Math.min(d, Math.max(0, Math.hypot(p[0]-P(s.b)[0], p[1]-P(s.b)[1]) - 12)); }
    }
    else if (s.type === 'view'){
      const g = viewGeom(s, t, W, H);
      if (S.tool === 'move' && Math.hypot(p[0]-g.tip[0], p[1]-g.tip[1]) < 13){ d = -2; part = 'tip'; }
      else if (S.tool === 'move' && Math.hypot(p[0]-g.wing[0], p[1]-g.wing[1]) < 13){ d = -2; part = 'wing'; }
      else {
        const gx = p[0]-g.ox, gy = (p[1]-g.oy)/GK, r = Math.hypot(gx, gy);
        let da = Math.atan2(gy, gx) - g.th; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (r <= g.R && Math.abs(da) <= g.w) d = 8;
      }
    }
    else if (s.type === 'beam'){ s = placed(s, t); const [x, y] = P(s.a), rr = Math.max(14, Math.hypot((s.b[0]-s.a[0])*W, (s.b[1]-s.a[1])*H)); d = (((p[0]-x)/rr)**2 + ((p[1]-y)/(rr*.42))**2 <= 1.6) ? 0 : (Math.abs(p[0]-x) < rr*.8 && p[1] < y && p[1] > y - rr*4 ? 6 : Infinity); }
    else if (s.type === 'glow'){ s = placed(s, t); const x0 = Math.min(s.a[0], s.b[0])*W, y0 = Math.min(s.a[1], s.b[1])*H, x1 = Math.max(s.a[0], s.b[0])*W, y1 = Math.max(s.a[1], s.b[1])*H; d = p[0] >= x0 - 6 && p[0] <= x1 + 6 && p[1] >= y0 - 6 && p[1] <= y1 + 6 ? 4 : Infinity; }
    else if (s.type === 'zoom'){ s = placed(s, t); const [cx, cy] = P(s.a), R = Math.max(16, Math.hypot((s.b[0]-s.a[0])*W, (s.b[1]-s.a[1])*H)), dc = Math.hypot(p[0]-cx, p[1]-cy);
      if (S.tool === 'move' && Math.hypot(p[0]-cx-R, p[1]-cy) < 14){ d = -1; part = 'r'; } else d = dc <= R ? 3 : Infinity; }
    else if (s.type === 'spot'){ const [cx,cy,rx,ry] = spotGeom(s, t, W, H); d = ((p[0]-cx)/rx)**2 + ((p[1]-cy)/ry)**2 <= 1 ? 6 : Infinity; }
    else if (s.type === 'link'){ const A = findShape(s.from), B = findShape(s.to); if (A && B) d = segDist(p, P(ringCenter(A.s, t)), P(ringCenter(B.s, t))) + 3; }
    else if (s.type === 'pen') for (let k = 1; k < s.pts.length; k++) d = Math.min(d, segDist(p, P(s.pts[k-1]), P(s.pts[k])));
    else if (s.type === 'ring'){ const [cx,cy] = P(ringCenter(s, t)), rr = Math.max(10, Math.hypot((s.b[0]-s.a[0])*W, (s.b[1]-s.a[1])*H)); const e = ((p[0]-cx)/rr)**2 + ((p[1]-cy)/(rr*.42))**2; d = e <= 1.6 ? 0 : (p[1] < cy && Math.abs(p[0]-cx) < rr*.5 && cy - p[1] < rr*1.6 ? 4 : Infinity); }
    else if (s.type === 'zone'){
      const pts = zonePts(s).map(P);
      if (S.tool === 'move'){
        pts.forEach(([x,y], k) => { const dv = Math.hypot(p[0]-x, p[1]-y); if (dv < 14 && dv - 3 < d){ d = dv - 3; part = 'v'; s._idx = k; } });
        if (part !== 'v') pts.forEach(([x,y], k) => { const [nx,ny] = pts[(k+1) % pts.length], dm = Math.hypot(p[0]-(x+nx)/2, p[1]-(y+ny)/2); if (dm < 12 && dm - 2 < d){ d = dm - 2; part = 'mid'; s._idx = k; } });
      }
      if (part === 'body'){
        let inside = false;
        for (let k = 0, j = pts.length-1; k < pts.length; j = k++){ const [xi,yi] = pts[k], [xj,yj] = pts[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj-xi)*(p[1]-yi)/(yj-yi) + xi) inside = !inside; }
        if (inside) d = 2; else for (let k = 0; k < pts.length; k++) d = Math.min(d, segDist(p, pts[k], pts[(k+1) % pts.length]));
      }
    }
    else if (s.type === 'text'){ const tb = textBox(s, W, H); d = p[0] >= tb.x - 4 && p[0] <= tb.x + tb.bw + 4 && p[1] >= tb.top - 4 && p[1] <= tb.top + tb.bh + 4 ? 0 : Infinity; }
    else if (s.type === 'ghost'){
      const fx = s.b[0]*W, fy = (s.b[1] + s.h*s.k/2)*H, gw = s.w*s.k*W, gh = s.h*s.k*H;
      if (Math.hypot(p[0] - (fx + gw/2), p[1] - fy) < 16){ d = -1; part = 'resize'; }
      else if (p[0] >= fx - gw/2 && p[0] <= fx + gw/2 && p[1] >= fy - gh - 20 && p[1] <= fy + 10) d = 0;
    }
    if (d < bd){ bd = d; best = { m, i, s:s._o || s, part, idx:s._idx }; }
    delete s._idx;
  });
  return best;
}

/* ---------- pointer input ---------- */
function norm(e){ const r = ink.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; }
ink.addEventListener('pointerdown', e => {
  if (!S.src){ toast('先に動画を開いてください'); return; }
  if (S.tracking) return;
  if (!S.src.paused){ S.src.pause(); clearHold(); }
  const p = norm(e);
  if (S.tool === 'text'){
    e.preventDefault();
    if (!textin.hidden){ commitText(); return; }
    const ht = hitTest(p);
    if (ht && ht.s.type === 'text'){ setTool('move'); startDrag(ht, p, e); return; }
    openText(p); return;
  }
  if (S.tool === 'erase'){ const h = hitTest(p); if (!h){ toast('消したい図形をタップしてください'); return; } snapshot(); h.m.shapes.splice(h.i, 1); pruneLinks(); save(); renderList(); return; }
  if (S.tool === 'link'){
    let h = hitTest(p, 'ring'), made = false;
    if (!h){
      // 何もない所をタップ：その場所に円盤（選手の足元に置く黒い丸）を作ってつなぐ
      const prev = S.linkFrom && findShape(S.linkFrom), pr = prev ? Math.hypot(prev.s.b[0]-prev.s.a[0], prev.s.b[1]-prev.s.a[1]) : .032;
      snapshot(); made = true;
      const m = ensureMoment(S.src.t), ring = { type:'ring', st:'disc', op:1, c:S.color, a:p, b:[p[0] + pr, p[1]], id:uid() };
      m.shapes.push(ring); h = { m, s:ring };
    }
    if (!h.s.id) h.s.id = uid();
    const ref = [h.m.id, h.s.id];
    if (!S.linkFrom){ S.linkFrom = ref; S.hover = p; if (made){ save(); renderList(); } toast('次の場所（または選手マーク）をタップ。終わるときは最後の丸をもう一度タップ'); return; }
    if (S.linkFrom[1] === ref[1]){ S.linkFrom = null; toast('つなぐのを終わりました。選手について動かすときは、線を選んで「つながりを全部追いかける」', 4500); return; }
    if (!made) snapshot();
    ensureMoment(S.src.t).shapes.push({ type:'link', c:S.color, from:S.linkFrom, to:ref });
    S.linkFrom = ref; save(); renderList(); return;
  }
  if (S.tool === 'pulse'){
    const h = hitTest(p);
    if (!h || h.s.type === 'spot'){ toast('強調したい矢印や選手マークをタップしてください'); return; }
    snapshot();
    if (h.s.pulse === S.pulseP){ delete h.s.pulse; toast('強調を外しました'); }
    else { h.s.pulse = S.pulseP; toast(`強調しました（${S.pulseP}秒ごとに膨らむ）`); }
    save(); return;
  }
  if (S.tool === 'view'){
    const h = hitTest(p, 'ring');
    if (h && !h.s.id) h.s.id = uid();
    const ref = h ? [h.m.id, h.s.id] : null;
    ink.setPointerCapture(e.pointerId);
    S.draft = { type:'view', c:S.color, a: h ? ringCenter(h.s, S.src.t) : p, d:[0,0], w:S.viewW };
    if (ref) S.draft.ref = ref;
    return;
  }
  if (S.tool === 'move'){ const h = hitTest(p); if (h) startDrag(h, p, e); return; }
  S.draftHit = hitTest(p);
  ink.setPointerCapture(e.pointerId);
  S.draft = S.tool === 'pen' ? { type:'pen', c:S.color, pts:[p] }
    : S.tool === 'ghost' ? { type:'gbox', c:'#ffffff', a:p, b:p }
    : S.tool === 'tri' || S.tool === 'zone' ? { type:'zone', kind:S.tool, c:S.color, a:p, b:p }
    : S.tool === 'space' ? { type:'arrow', space:true, c:S.color, a:p, b:p }
    : S.tool === 'ring' ? { type:'ring', st:S.ringSt, op:S.ringOp, hl:S.ringHl, c:S.color, a:p, b:p }
    : S.tool === 'spot' ? { type:'spot', c:S.color, a:p, b:p }
    : S.tool === 'beam' ? { type:'beam', c:S.color, a:p, b:p }
    : S.tool === 'glow' ? { type:'glow', c:S.color, a:p, b:p }
    : S.tool === 'zoom' ? { type:'zoom', c:S.color, a:p, b:p, k:2 }
    : { type: S.tool === 'run' ? 'arrow' : S.tool, dash: S.tool === 'run', c:S.color, a:p, b:p };
});
function startDrag(h, p, e){
    if (h.s.type === 'link') return;
    select(h.s, 's');
    snapshot(); ink.setPointerCapture(e.pointerId);
    if (h.s.type === 'zone' && h.part === 'mid'){
      const a = h.s.pts[h.idx], b = h.s.pts[(h.idx+1) % h.s.pts.length];
      h.s.pts.splice(h.idx+1, 0, [(a[0]+b[0])/2, (a[1]+b[1])/2]); h.part = 'v'; h.idx = h.idx + 1;
    }
    S.drag ={ ...h, start:p, orig:JSON.parse(JSON.stringify(h.s)), t:S.src.t, center: h.s.type === 'ring' || (TRACKABLE.has(h.s.type) && h.s.track) ? ringCenter(h.s, S.src.t) : null };
}
ink.addEventListener('dblclick', e => {
  if (S.tool !== 'move' || !S.src) return;
  const h = hitTest(norm(e));
  if (h && h.s.type === 'text'){ editText(h.s); return; }
  if (h && h.s.type === 'arrow' && h.part === 'mid' && h.s.ctl){ snapshot(); delete h.s.ctl; save(); return; }
  if (h && h.s.type === 'zone' && h.part === 'v'){
    if (h.s.pts.length <= 3){ toast('角は3つより減らせません'); return; }
    snapshot(); h.s.pts.splice(h.idx, 1); save();
  }
});
ink.addEventListener('pointermove', e => {
  const p = norm(e);
  if (S.tool === 'link') S.hover = p;
  if (S.drag){ applyDrag(p); return; }
  if (!S.draft) return;
  if (S.draft.type === 'view'){ const o = viewOrigin(S.draft, S.src.t); S.draft.d = [p[0]-o[0], p[1]-o[1]]; return; }
  if (S.draft.type === 'pen'){ const l = S.draft.pts[S.draft.pts.length-1]; if (Math.hypot(p[0]-l[0], p[1]-l[1]) > .003) S.draft.pts.push(p); }
  else S.draft.b = p;
});
function applyDrag(p){
  const D = S.drag, s = D.s, o = D.orig, d = [p[0]-D.start[0], p[1]-D.start[1]], add = q => [q[0]+d[0], q[1]+d[1]];
  if (s.type === 'ghost'){
    if (D.part === 'resize'){
      const fx = o.b[0], fy = o.b[1] + o.h*o.k/2;
      const d0 = Math.hypot(D.start[0]-fx, D.start[1]-fy) || .01, d1 = Math.hypot(p[0]-fx, p[1]-fy);
      s.k = clamp(o.k * d1 / d0, .3, 4); s.b = [o.b[0], fy - o.h*s.k/2];
    } else s.b = add(o.b);
  } else if (s.type === 'ring'){
    if (s.track || Math.abs(D.t - D.m.t) > 0.05){
      if (!s.track || !s.track.length) s.track = [[D.m.t, o.a[0], o.a[1]]];
      setKey(s, D.t, add(D.center));
    } else { s.a = add(o.a); s.b = add(o.b); }
  } else if (s.type === 'arrow'){
    if (D.part === 'a') s.a = p;
    else if (D.part === 'b') s.b = p;
    else if (D.part === 'mid') s.ctl = [2*p[0] - (o.a[0]+o.b[0])/2, 2*p[1] - (o.a[1]+o.b[1])/2];
    else { s.a = add(o.a); s.b = add(o.b); if (o.ctl) s.ctl = add(o.ctl); }
  } else if (s.type === 'view'){
    const org = viewOrigin(s, D.t);
    if (D.part === 'tip') s.d = [p[0]-org[0], p[1]-org[1]];
    else if (D.part === 'wing'){
      const ar = ink.width / ink.height, gx = (p[0]-org[0])*ar, gy = (p[1]-org[1])/GK, th = Math.atan2(s.d[1]/GK, s.d[0]*ar);
      let da = Math.atan2(gy, gx) - th; da = Math.atan2(Math.sin(da), Math.cos(da));
      s.w = clamp(Math.abs(da)*180/Math.PI, 5, 85);
    } else if (!s.ref) s.a = add(o.a);
  } else if (s.type === 'zone'){
    if (D.part === 'v') s.pts[D.idx] = p;
    else s.pts = o.pts.map(add);
  } else if (s.type === 'pen') s.pts = o.pts.map(add);
  else if (TRACKABLE.has(s.type) && s.track && s.track.length){
    if (s.type === 'zoom' && D.part === 'r'){ const sh = shiftAt(s, D.t); s.b = [p[0] - sh[0], p[1] - sh[1]]; }
    else setKey(s, D.t, add(D.center));
  }
  else if (s.type === 'zoom' && D.part === 'r') s.b = p;
  else { s.a = add(o.a); if (o.b) s.b = add(o.b); }
}
function endPointer(){
  if (S.drag){ S.drag = null; save(); renderList(); return; }
  const d = S.draft; if (!d) return; S.draft = null;
  const hit = S.draftHit; S.draftHit = null;
  const tiny = d.type === 'pen' ? d.pts.length <= 2 : d.type !== 'view' && Math.hypot(d.b[0]-d.a[0], d.b[1]-d.a[1]) <= .01;
  if (hit && tiny && hit.s.type !== 'link'){ editInstead(); return; }
  if (d.type === 'gbox'){ makeGhost(d); return; }
  if (d.type === 'view'){
    if (Math.hypot(d.d[0], d.d[1]) < .02){ toast('選手の足元から、見ている方向へドラッグしてください'); return; }
    snapshot(); ensureMoment(S.src.t).shapes.push(d); save(); renderList(); afterAdd(); return;
  }
  if ((d.type === 'beam' || d.type === 'zoom') && Math.hypot(d.b[0]-d.a[0], d.b[1]-d.a[1]) < .012) d.b = [d.a[0] + (d.type === 'zoom' ? .08 : .025), d.a[1]];
  if (d.type === 'glow'){
    if (Math.abs(d.b[0]-d.a[0]) < .012 || Math.abs(d.b[1]-d.a[1]) < .02){ toast('光らせたい選手を四角で囲んでください'); return; }
    const a0 = d.a, b0 = d.b; d.a = [Math.min(a0[0], b0[0]), Math.min(a0[1], b0[1])]; d.b = [Math.max(a0[0], b0[0]), Math.max(a0[1], b0[1])];
  }
  const ok = d.type === 'pen' ? d.pts.length > 2 : d.type === 'ring' || d.type === 'beam' || d.type === 'zoom' ? true : Math.hypot(d.b[0]-d.a[0], d.b[1]-d.a[1]) > .01;
  if (!ok) return;
  if (!d.dash) delete d.dash;
  if (d.type === 'ring'){ d.id = uid(); if (!d.hl) delete d.hl; }
  if (d.type === 'spot' && (Math.abs(d.b[0]-d.a[0]) < .015 || Math.abs(d.b[1]-d.a[1]) < .015)){ toast('照らしたいところを四角で囲んでください'); return; }
  const isZone = d.type === 'zone';
  if (isZone) normZone(d);
  snapshot(); ensureMoment(S.src.t).shapes.push(d); save(); renderList();
  if (isZone) setTool('move'); else afterAdd();
}
ink.addEventListener('pointerup', endPointer);
ink.addEventListener('pointercancel', () => { S.draft = null; S.draftHit = null; if (S.drag){ S.drag = null; } });

/* ---------- ghost (分身) ---------- */
// 元の選手を消す：四角のまわりを少し広めに取り、選手の形（芝ではない所）だけを周りの芝の色で埋めた「上ばり」を作る
function erasePatch(x0, y0, w, h){
  const vw = video.videoWidth, vh = video.videoHeight; if (!vw) return null;
  const ex = w * .35, ey = h * .2;
  const rx0 = Math.max(0, x0 - ex), ry0 = Math.max(0, y0 - ey), rx1 = Math.min(1, x0 + w + ex), ry1 = Math.min(1, y0 + h + ey);
  const sx = rx0 * vw, sy = ry0 * vh, sw = (rx1 - rx0) * vw, sh = (ry1 - ry0) * vh;
  const sc = Math.min(1, 240 / Math.max(sw, sh)), ow = Math.max(8, Math.round(sw * sc)), oh = Math.max(8, Math.round(sh * sc));
  const cv = document.createElement('canvas'); cv.width = ow; cv.height = oh; const c = cv.getContext('2d', { willReadFrequently:true });
  let img; try { c.drawImage(video, sx, sy, sw, sh, 0, 0, ow, oh); img = c.getImageData(0, 0, ow, oh); } catch(e){ return null; }
  const d = img.data, n = ow * oh;
  // 内側の四角の中で芝ではない所
  const ix0 = Math.floor((x0 - rx0) / (rx1 - rx0) * ow), iy0 = Math.floor((y0 - ry0) / (ry1 - ry0) * oh);
  const ix1 = Math.ceil((x0 + w - rx0) / (rx1 - rx0) * ow), iy1 = Math.ceil((y0 + h - ry0) / (ry1 - ry0) * oh);
  let A = new Uint8Array(n), B = new Uint8Array(n);
  for (let y = iy0; y < iy1; y++) for (let x = ix0; x < ix1; x++){ if (x < 0 || y < 0 || x >= ow || y >= oh) continue; const o = (y*ow + x)*4; A[y*ow + x] = turfPx(d[o], d[o+1], d[o+2]) ? 0 : 1; }
  const pass = (src, dst, er, horiz) => { const st = horiz ? 1 : ow;
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++){ const i = y*ow + x, lo = horiz ? x > 0 : y > 0, hi = horiz ? x < ow-1 : y < oh-1, v0 = src[i], v1 = lo ? src[i-st] : v0, v2 = hi ? src[i+st] : v0; dst[i] = er ? (v0 & v1 & v2) : (v0 | v1 | v2); } };
  // 細い白線は残す（収縮→膨張）、そのあと輪郭を2回り広げて、選手のふちが残らないようにする
  pass(A, B, true, true); pass(B, A, true, false); pass(A, B, false, true); pass(B, A, false, false);
  for (let k = 0; k < 2; k++){ pass(A, B, false, true); pass(B, A, false, false); }
  let cnt = 0; for (let i = 0; i < n; i++) cnt += A[i];
  if (cnt < 4) return null;
  // 埋める：横と縦それぞれ、一番近い芝の色をつないで、距離で重み付けして混ぜる
  const R = new Float32Array(n), G = new Float32Array(n), Bc = new Float32Array(n);
  for (let i = 0; i < n; i++){ R[i] = d[i*4]; G[i] = d[i*4+1]; Bc[i] = d[i*4+2]; }
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++){
    const i = y*ow + x; if (!A[i]) continue;
    let acc = [0,0,0], wt = 0;
    const tryDir = (dx, dy) => { let xx = x, yy = y, k = 0; while (true){ xx += dx; yy += dy; k++; if (xx < 0 || yy < 0 || xx >= ow || yy >= oh) return null; const j = yy*ow + xx; if (!A[j]) return [j, k]; } };
    for (const [a1, a2] of [[[-1,0],[1,0]], [[0,-1],[0,1]]]){
      const p = tryDir(...a1), q = tryDir(...a2);
      for (const hit of [p, q]) if (hit){ const [j, k] = hit, wv = 1 / k; acc[0] += d[j*4]*wv; acc[1] += d[j*4+1]*wv; acc[2] += d[j*4+2]*wv; wt += wv; }
    }
    if (wt){ R[i] = acc[0]/wt; G[i] = acc[1]/wt; Bc[i] = acc[2]/wt; }
  }
  // すじを消すために少しならし、芝らしいざらつきを少し足す
  for (let it = 0; it < 12; it++) for (let y = 1; y < oh-1; y++) for (let x = 1; x < ow-1; x++){ const i = y*ow + x; if (!A[i]) continue;
    R[i] = (R[i-1] + R[i+1] + R[i-ow] + R[i+ow]) / 4; G[i] = (G[i-1] + G[i+1] + G[i-ow] + G[i+ow]) / 4; Bc[i] = (Bc[i-1] + Bc[i+1] + Bc[i-ow] + Bc[i+ow]) / 4; }
  for (let i = 0; i < n; i++){
    if (!A[i]){ d[i*4+3] = 0; continue; }
    const nz = (Math.random() - .5) * 10, x = i % ow, y = (i / ow) | 0;
    const edge = (x > 0 && !A[i-1]) || (x < ow-1 && !A[i+1]) || (y > 0 && !A[i-ow]) || (y < oh-1 && !A[i+ow]);
    d[i*4] = clamp(R[i] + nz, 0, 255); d[i*4+1] = clamp(G[i] + nz, 0, 255); d[i*4+2] = clamp(Bc[i] + nz, 0, 255); d[i*4+3] = edge ? 170 : 255;
  }
  c.putImageData(img, 0, 0);
  let url; try { url = cv.toDataURL('image/png'); } catch(e){ return null; }
  return { url, r:[rx0, ry0, rx1 - rx0, ry1 - ry0] };
}
async function setGhostErase(m, s, on){
  if (on && !s.patch){
    S.src.pause(); clearHold();
    if (Math.abs(video.currentTime - m.t) > .04) await seekTo(m.t);
    const bx = s.a[0] - s.w/2, by = s.a[1] - s.h/2, pt = erasePatch(bx, by, s.w, s.h);
    if (!pt){ toast('元の選手を消せませんでした（芝の上の選手を四角で囲んでください）'); return; }
    s.patch = pt;
  }
  snapshot(); if (on) s.erase = true; else delete s.erase; save(); renderList();
}
function makeGhost(d){
  const x0 = Math.min(d.a[0], d.b[0]), y0 = Math.min(d.a[1], d.b[1]), w = Math.abs(d.b[0]-d.a[0]), h = Math.abs(d.b[1]-d.a[1]);
  if (w < .01 || h < .02){ toast('動かしたい選手を四角でしっかり囲んでください'); return; }
  const vw = video.videoWidth, vh = video.videoHeight;
  const sx = x0*vw, sy = y0*vh, sw = w*vw, sh = h*vh;
  const sc = Math.min(1, 260 / sh), ow = Math.max(8, Math.round(sw*sc)), oh = Math.max(8, Math.round(sh*sc));
  const cv = document.createElement('canvas'); cv.width = ow; cv.height = oh; const c = cv.getContext('2d');
  try { c.drawImage(video, sx, sy, sw, sh, 0, 0, ow, oh); } catch(e){ toast('この動画からは切り抜けませんでした'); return; }
  c.globalCompositeOperation = 'destination-in';
  const g = c.createRadialGradient(ow/2, oh*.52, Math.min(ow,oh)*.25, ow/2, oh*.52, Math.max(ow,oh)*.56);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.7, 'rgba(0,0,0,.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save(); c.translate(ow/2, oh/2); c.scale(ow/oh, 1); c.translate(-ow/2, -oh/2);
  c.fillStyle = g; c.fillRect(0, 0, ow, oh); c.restore();
  let url; try { url = cv.toDataURL('image/webp', .82); if (!url.startsWith('data:image/webp')) url = cv.toDataURL('image/png'); } catch(e){ toast('この動画からは切り抜けませんでした'); return; }
  const a = [x0 + w/2, y0 + h/2];
  const shape = { type:'ghost', c:S.color, img:url, w, h, k:1, a, b:[clamp(a[0] + w*1.4, .02, .98), a[1]] };
  const pt = erasePatch(x0, y0, w, h); if (pt){ shape.patch = pt; shape.erase = true; }
  snapshot(); const m = ensureMoment(S.src.t); m.shapes.push(shape); if (m.show < 5) m.show = 5; save(); renderList();
  setTool('move'); toast('分身ができました。ドラッグして本当にいてほしかった位置へ動かしてください', 3800);
}

/* ---------- text ---------- */
const textin = $('#textin'); let textPos = null;
function fitTextin(){ textin.style.height = 'auto'; textin.style.height = textin.scrollHeight + 'px'; }
function openText(p, edit){
  if (!textin.hidden) commitText();
  S.editText = edit || null;
  textPos = p; textin.value = edit ? edit.s : ''; textin.style.left = (p[0]*100) + '%'; textin.style.top = (p[1]*100) + '%';
  textin.style.borderColor = edit ? edit.c : S.color; textin.hidden = false; fitTextin(); setTimeout(() => { textin.focus(); fitTextin(); }, 0);
}
function commitText(){
  if (textin.hidden) return; const v = textin.value.replace(/\s+$/, '').replace(/^\n+/, ''); textin.hidden = true;
  const ed = S.editText; S.editText = null;
  if (ed){
    snapshot();
    if (v.trim()) ed.s = v; else S.moments.forEach(m => { const i = m.shapes.indexOf(ed); if (i >= 0) m.shapes.splice(i, 1); });
    save(); renderList(); return;
  }
  if (!v.trim() || !textPos) return;
  snapshot(); ensureMoment(S.src.t).shapes.push({ type:'text', c:S.color, bg:S.textBg, fs:S.textFs, a:textPos, s:v }); save(); renderList(); afterAdd();
}
function editText(s){ if (!S.src) return; S.src.pause(); clearHold(); openText([s.a[0], s.a[1]], s); }
textin.addEventListener('input', fitTextin);
textin.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.isComposing){ e.preventDefault(); commitText(); } else if (e.key === 'Escape'){ textin.hidden = true; S.editText = null; } });
textin.addEventListener('blur', commitText);

/* ---------- auto tracking (選手マークの追従) ---------- */
function seekTo(t){ return new Promise(res => { let done = false; const fin = () => { if (done) return; done = true; video.removeEventListener('seeked', fin); res(); }; video.addEventListener('seeked', fin); setTimeout(fin, 2000); video.currentTime = t; }); }
/* ---------- 自動追跡 ----------
   動きの予測 ＋ 見た目の照合（正規化相互相関）＋ 芝の色から切り出した選手の形 で追いかける。
   一瞬隠れても予測で進み、見えたら捕まえ直す。見失ったところで止まる。 */
const turfPx = (R, G, B) => {
  const mx = R > G ? (R > B ? R : B) : (G > B ? G : B), mn = R < G ? (R < B ? R : B) : (G < B ? G : B), df = mx - mn;
  if (mx < 55 || df <= mx * .14 || (mx > 158 && df < mx * .25)) return false;
  let h = mx === G ? 60 * ((B - R) / df + 2) : mx === R ? 60 * ((G - B) / df) : 60 * ((R - G) / df + 4);
  if (h < 0) h += 360; return h >= 50 && h <= 175;
};
// 範囲の中の「芝ではない」かたまりを探す
function blobsIn(data, cw, ch, x0, y0, x1, y1){
  x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0); x1 = Math.min(cw - 1, x1 | 0); y1 = Math.min(ch - 1, y1 | 0);
  const w = x1 - x0 + 1, h = y1 - y0 + 1; if (w < 2 || h < 2) return [];
  const mk = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const o = ((y0 + y) * cw + x0 + x) * 4; mk[y * w + x] = turfPx(data[o], data[o+1], data[o+2]) ? 0 : 1; }
  const out = [], st = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++){
    if (mk[i] !== 1) continue;
    let n = 0, sp = 0, minx = 1e9, maxx = -1, miny = 1e9, maxy = -1, sx = 0; st[sp++] = i; mk[i] = 2;
    while (sp){ const j = st[--sp], x = j % w, y = (j / w) | 0; n++; sx += x;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      if (x > 0 && mk[j-1] === 1){ mk[j-1] = 2; st[sp++] = j-1; } if (x < w-1 && mk[j+1] === 1){ mk[j+1] = 2; st[sp++] = j+1; }
      if (y > 0 && mk[j-w] === 1){ mk[j-w] = 2; st[sp++] = j-w; } if (y < h-1 && mk[j+w] === 1){ mk[j+w] = 2; st[sp++] = j+w; } }
    if (n >= 6) out.push({ n, x0:x0 + minx, x1:x0 + maxx, y0:y0 + miny, y1:y0 + maxy, cx:x0 + sx / n });
  }
  return out;
}
function retrack(m, s){
  const t = S.src.t; if (t < m.t - .05){ toast('この図形が出てくる位置より後ろで押してください'); return; }
  autoTrack(m, s, Math.max(t, m.t));
}
// 1人分の追跡（その場面の最初のコマから、体の形と動きを覚えて追う）
function makeTarget(s, t0, fromT, frame, cw, ch){
  const tr = TRACKABLE.has(s.type);
  const start = (s.track && s.track.length) ? ringCenter(s, t0) : (tr ? anchorOf(s) : s.a);
  const A = [start[0] * cw, start[1] * ch];
  // 大きさの目安
  let r = Math.hypot((s.b[0]-s.a[0])*cw, (s.b[1]-s.a[1])*ch);
  if (s.type === 'glow') r = Math.abs(s.b[0]-s.a[0])*cw / 2;
  if (s.type === 'zoom') r = r / 2;
  r = clamp(r, 4, 60);
  // 基準点の近くの選手（芝ではないかたまり）を探して、体の四角を決める
  const near = blobsIn(frame, cw, ch, A[0] - r*3, A[1] - r*7, A[0] + r*3, A[1] + r*1.5)
    .filter(b => b.n < r*r*40).map(b => ({ b, d:Math.hypot((b.x0 + b.x1)/2 - A[0], b.y1 - A[1]) }))
    .sort((p, q) => p.d - q.d)[0];
  let bw, bh, bx, by;   // 体の四角（左上と大きさ）
  if (near && near.d < r * 3){ const b = near.b; bw = b.x1 - b.x0 + 1; bh = b.y1 - b.y0 + 1; bx = b.x0; by = b.y0; }
  else { bw = Math.max(6, Math.round(r*1.6)); bh = Math.max(10, Math.round(r*2.8)); bx = A[0] - bw/2; by = A[1] - bh + r*.3; }
  const area0 = bw * bh;
  const M = 3, tw = Math.round(bw + M*2), th = Math.round(bh + M*2);   // 周りの芝も少し入れて形をはっきりさせる
  const off = [A[0] - (bx + bw/2), A[1] - (by + bh)];                 // 体の四角（下の真ん中）から基準点までのずれ
  const stp = Math.max(1, Math.round(Math.sqrt(tw * th / 260)));     // 照合に使う点を間引く
  const pts = []; for (let j = 0; j < th; j += stp) for (let i = 0; i < tw; i += stp) pts.push([i, j]);
  const np = pts.length;
  const sample = (data, x, y) => { const v = new Float32Array(np * 3);
    for (let k = 0; k < np; k++){ const xx = clamp(Math.round(x + pts[k][0]), 0, cw-1), yy = clamp(Math.round(y + pts[k][1]), 0, ch-1), o = (yy*cw + xx)*4; v[k*3] = data[o]; v[k*3+1] = data[o+1]; v[k*3+2] = data[o+2]; }
    return v; };
  const center = v => { const mu = [0,0,0]; for (let k = 0; k < np; k++){ mu[0] += v[k*3]; mu[1] += v[k*3+1]; mu[2] += v[k*3+2]; } mu[0] /= np; mu[1] /= np; mu[2] /= np;
    let nn = 0; for (let k = 0; k < np; k++) for (let c = 0; c < 3; c++){ v[k*3+c] -= mu[c]; nn += v[k*3+c]**2; } return Math.sqrt(nn) || 1; };
  let T = sample(frame, bx - M, by - M), Tn = center(T);
  const ncc = (data, x, y) => {
    let cr = 0, s1r = 0, s1g = 0, s1b = 0, s2 = 0;
    for (let k = 0; k < np; k++){
      const xx = clamp(Math.round(x + pts[k][0]), 0, cw-1), yy = clamp(Math.round(y + pts[k][1]), 0, ch-1), o = (yy*cw + xx)*4;
      const R = data[o], G = data[o+1], B = data[o+2];
      cr += T[k*3]*R + T[k*3+1]*G + T[k*3+2]*B; s1r += R; s1g += G; s1b += B; s2 += R*R + G*G + B*B;
    }
    const vr = s2 - (s1r*s1r + s1g*s1g + s1b*s1b) / np; return vr > 1 ? cr / (Tn * Math.sqrt(vr)) : 0;
  };
  // 追跡の状態
  let px = bx, py = by, vx = 0, vy = 0, lastT = t0, lostSince = null, lastGood = t0, n = 0;
  if (fromT != null && s.track) s.track = s.track.filter(k => k[0] < t0 - 1e-3); else s.track = [];
  const put = t => setKey(s, t, [clamp((px + bw/2 + off[0]) / cw, 0, 1), clamp((py + bh + off[1]) / ch, 0, 1)]);
  put(t0);
  const MAXLOST = 1.0;
  const step = (data, t) => {
    const dt = t - lastT; if (dt <= 1e-4) return true;
    if (dt > .5){ lostSince = lostSince ?? lastT; }
    // 予測した位置を中心に探す
    const qx = px + vx * dt, qy = py + vy * dt;
    // 探す範囲：ふだんは予測のすぐ近くだけ。隠れている時間が長いほど広げる（遠くの似た選手に飛び移らないため）
    const lostDur = lostSince != null ? t - lostSince : 0;
    const R = clamp(Math.max(bw, bh, 8) * (.7 + 2.5 * lostDur) + 3, 6, 140);
    // 予測から離れるほど点を引く（選手1人分ずれると −1）。似た選手が隣にいても乗り移りにくくする
    const sz = Math.max(bw, bh, 8), score = (x, y) => { const d = Math.hypot(x - qx, y - qy) / sz; return ncc(data, x - M, y - M) - d * d; };
    let best = -9, bxx = qx, byy = qy;
    const cs = R > 40 ? 3 : 2;
    for (let dy = -R; dy <= R; dy += cs) for (let dx = -R; dx <= R; dx += cs){ const v = score(qx + dx, qy + dy); if (v > best){ best = v; bxx = qx + dx; byy = qy + dy; } }
    const fx = bxx, fy = byy;
    for (let dy = -cs; dy <= cs; dy++) for (let dx = -cs; dx <= cs; dx++){ const v = score(fx + dx, fy + dy); if (v > best){ best = v; bxx = fx + dx; byy = fy + dy; } }
    const raw = ncc(data, bxx - M, byy - M);
    if (raw > .5 && best > .5){
      // 一部が隠れて照合が弱いときは、予測と半分ずつにして引っぱられないようにする
      if (raw < .8){ bxx = (bxx + qx) / 2; byy = (byy + qy) / 2; }
      // 見つかった：芝から切り出した形で足元を合わせる（隣とくっついているときは合わせない）
      const bl = blobsIn(data, cw, ch, bxx - 4, byy - 4, bxx + bw + 4, byy + bh + 6)
        .filter(b => b.n > area0 * .25 && b.n < area0 * 2.2 && (b.x1 - b.x0 + 1) < bw * 1.8).sort((a, c) => c.n - a.n)[0];
      if (bl && raw > .8){ const nx = (bl.x0 + bl.x1) / 2 - bw / 2, ny = bl.y1 + 1 - bh; bxx = bxx * .5 + nx * .5; byy = byy * .5 + ny * .5; }
      if (raw > .75){ const nvx = (bxx - px) / dt, nvy = (byy - py) / dt; vx = vx * .6 + nvx * .4; vy = vy * .6 + nvy * .4; }
      px = bxx; py = byy; lostSince = null; lastGood = t;
      if (raw > .7){ const nv = sample(data, px - M, py - M); center(nv); for (let k = 0; k < T.length; k++) T[k] = T[k] * .9 + nv[k] * .1; let nn = 0; for (let k = 0; k < T.length; k++) nn += T[k]*T[k]; Tn = Math.sqrt(nn) || 1; }
    } else {
      // 隠れた・見失った：しばらくは予測どおりに進める
      lostSince = lostSince ?? t; px = qx; py = qy; vx *= .9; vy *= .9;
      if (t - lostSince > MAXLOST) return false;
    }
    put(t); lastT = t; n++;
    return true;
  };
  const finish = () => {
    // 見失ったあとに予測で置いた分は消す
    const lost = lostSince != null;
    if (lost) s.track = s.track.filter(k => k[0] <= lastGood + 1e-3);
    // 細かいぶれをならす
    const ks = s.track; for (let pass = 0; pass < 2; pass++) for (let i = 1; i < ks.length - 1; i++){ if (ks[i][0] < t0) continue; ks[i][1] = (ks[i-1][1] + ks[i][1]*2 + ks[i+1][1]) / 4; ks[i][2] = (ks[i-1][2] + ks[i][2]*2 + ks[i+1][2]) / 4; }
    return { lost, secs:lastGood - t0 };
  };
  return { s, step, finish, alive:true };
}
// 何人でも同じ再生の中で一度に追いかける
async function autoTrackMany(list, fromT){
  if (!S.src || S.tracking || !list.length) return;
  S.src.pause(); clearHold();
  const vw = video.videoWidth, vh = video.videoHeight, cw = 640, ch = Math.round(vh * cw / vw);
  const oc = document.createElement('canvas'); oc.width = cw; oc.height = ch; const oc2 = oc.getContext('2d', { willReadFrequently:true });
  const grab = () => { oc2.drawImage(video, 0, 0, cw, ch); return oc2.getImageData(0, 0, cw, ch).data; };
  const t0 = fromT != null ? fromT : Math.min(...list.map(([m]) => m.t)); await seekTo(t0);
  let frame; try { frame = grab(); } catch(e){ toast('この動画では自動追跡が使えません'); return; }
  const tg = list.map(([m, s]) => makeTarget(s, t0, fromT, frame, cw, ch));
  S.tracking = { stop:false, s:list[0][1], t0, t:t0 };
  const MAXLEN = 180;
  const onFrame = t => {
    const live = tg.filter(x => x.alive); if (!live.length) return false;
    const data = grab();
    for (const x of live) x.alive = x.step(data, t);
    S.tracking.t = t;
    return tg.some(x => x.alive) && !S.tracking.stop && t < video.duration - .05 && t - t0 < MAXLEN;
  };
  // 動画を 0.5 倍速で流しながら、コマが来るたびに追いかける（使えない環境では 1/15 秒ずつ進める）
  if (video.requestVideoFrameCallback){
    const mu = video.muted; video.muted = true; video.playbackRate = .5;
    await new Promise(res => {
      let done = false; const fin = () => { if (!done){ done = true; res(); } };
      const cb = (now, md) => { if (done) return; let go = false; try { go = onFrame(md.mediaTime); } catch(e){ go = false; } if (!go || S.tracking.stop){ fin(); return; } video.requestVideoFrameCallback(cb); };
      video.requestVideoFrameCallback(cb); video.addEventListener('ended', fin, { once:true });
      const p = video.play(); if (p && p.catch) p.catch(fin);
    });
    video.pause(); video.muted = mu; video.playbackRate = +$('#speed').value;
  } else {
    let t = t0;
    while (!S.tracking.stop && t + 1/15 <= video.duration){ t += 1/15; await seekTo(t); if (!onFrame(t)) break; }
  }
  const res = tg.map(x => x.finish());
  const stopped = S.tracking.stop;
  S.tracking = null; save(); renderList(); seek(t0);
  const lostN = res.filter(r => r.lost).length, secs = Math.max(...res.map(r => r.secs)).toFixed(1);
  if (tg.length === 1) toast(lostN ? `${res[0].secs.toFixed(1)}秒まで追いかけました。見失ったところでマークを正しい位置に動かし「ここから追いかけ直す」を押すと続きを追えます` : stopped ? `${secs}秒分を追いかけて止めました` : `${secs}秒分を追いかけました`, 6000);
  else toast(lostN ? `${tg.length}人を追いかけました（${lostN}人は途中で見失いました。その丸を正しい位置に動かして「ここから追いかけ直す」で続きを追えます）` : `${tg.length}人を${secs}秒分 追いかけました`, 6000);
}
const autoTrack = (m, s, fromT) => autoTrackMany([[m, s]], fromT);
// つなぐ線でつながっている丸（選手マーク）を全部集める
function chainRings(start){
  const all = S.moments.flatMap(m => m.shapes.map(s => [m, s])), links = all.filter(([, s]) => s.type === 'link');
  const ids = new Set(), q = start.type === 'link' ? [start.from[1], start.to[1]] : start.id ? [start.id] : [];
  while (q.length){ const id = q.pop(); if (ids.has(id)) continue; ids.add(id); for (const [, l] of links){ if (l.from[1] === id) q.push(l.to[1]); if (l.to[1] === id) q.push(l.from[1]); } }
  return all.filter(([, s]) => s.type === 'ring' && ids.has(s.id));
}
const hasChain = s => s.type === 'link' || (s.type === 'ring' && s.id && S.moments.some(m => m.shapes.some(l => l.type === 'link' && (l.from[1] === s.id || l.to[1] === s.id))));
function trackChain(s, here){
  const list = chainRings(s); if (!list.length){ toast('つながっている丸が見つかりません'); return; }
  snapshot();
  if (here){ const t = S.src.t, t0 = Math.min(...list.map(([m]) => m.t)); if (t < t0 - .05){ toast('丸が出てくる位置より後ろで押してください'); return; } autoTrackMany(list, Math.max(t, t0)); }
  else autoTrackMany(list);
}
/* ---------- UI ---------- */
const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
let lastPaused = null, lastActive = null, badgeMode = '';
const IC_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
const IC_TRACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>';
function setBadge(mode, title, sub, keep, go, frac){
  const b = $('#badge');
  if (!mode){ if (badgeMode){ b.hidden = true; badgeMode = ''; } return; }
  b.hidden = false;
  if (badgeMode !== mode + keep){
    badgeMode = mode + keep; b.classList.toggle('track', mode === 'track');
    $('#badgeIc').innerHTML = mode === 'track' ? IC_TRACK : IC_PAUSE;
    $('#badgeKeep').hidden = !keep; $('#badgeGo').textContent = go;
  }
  $('#badgeText').textContent = title; $('#badgeSub').textContent = sub;
  const bar = $('#badgeBar'); bar.parentNode.hidden = frac == null; if (frac != null) bar.style.transform = `scaleX(${frac})`;
}
$('#badgeKeep').onclick = () => { S.holdUntil = null; };
$('#badgeGo').onclick = () => { if (S.tracking){ S.tracking.stop = true; return; } togglePlay(); };
function updateUI(now){
  const s = S.src, t = s.t, d = s.dur || 1;
  $('#tc').innerHTML = `${fmt(t)} <span>/ ${fmt(s.dur)}</span>`;
  const pc = clamp(t/d, 0, 1)*100; $('#fill').style.width = pc + '%'; $('#head').style.left = pc + '%';
  tlHead();
  if (lastPaused !== s.paused){ lastPaused = s.paused; $('#play').innerHTML = s.paused ? ICON_PLAY : ICON_PAUSE; }
  if (S.tracking) setBadge('track', '選手を追いかけ中', `${(S.tracking.t - S.tracking.t0).toFixed(1)}秒`, false, '止める', null);
  else if (S.holdId && S.holdUntil) setBadge('');   // フリーズ（自動で再開）は表示を出さず自然に止める
  else if (S.holdId) setBadge('hold', '一時停止中', '説明が終わったら再開', false, '再開 ▶', null);
  else setBadge('');
  stage.classList.toggle('held', !!S.holdId && !S.holdUntil && !S.tracking && !S.exporting);
  stage.classList.toggle('tracking', !!S.tracking);
  const vis = fxHidden() ? [] : S.moments.filter(m => t >= (m.ct0 ?? m.t) - 0.045 && t < (m.cuntil ?? m.t + m.show) && m.comment.trim());
  const cm = vis.length ? vis[vis.length-1] : null;
  const cap = $('#caption'), txt = cm ? cm.comment : '';
  S.capId = cm ? cm.id : null;
  cap.hidden = !txt; if (cap.textContent !== txt) cap.textContent = txt;
  const cbg = cm && cm.cbg ? cm.cbg : 'dark'; if (cap.dataset.bg !== cbg) cap.dataset.bg = cbg;
  const cfs = cm && cm.cfs ? cm.cfs : 1; if (cap.dataset.fs !== String(cfs)){ cap.dataset.fs = cfs; cap.style.setProperty('--cfs', cfs); }
  if (cm && cm.cpos){ cap.style.left = cm.cpos[0]*100 + '%'; cap.style.top = cm.cpos[1]*100 + '%'; cap.style.bottom = 'auto'; cap.style.transform = 'translate(-50%,-50%)'; }
  else { cap.style.left = ''; cap.style.top = ''; cap.style.bottom = ''; cap.style.transform = ''; }
  cap.classList.toggle('movable', !!cm && s.paused && !S.tracking);
  cap.title = cm && s.paused ? 'ドラッグで移動・ダブルクリックで下に戻す' : '';
  const act = momentAt(t), aid = act ? act.id : null;
  if (aid !== lastActive){ lastActive = aid; document.querySelectorAll('.moment').forEach(el => el.classList.toggle('on', el.dataset.id === aid)); }
}

/* ---------- timeline (表示期間・カット・フリーズ) ---------- */
S.sel = null; S.selKind = null; S.pps = 40; S.ppsSet = false; S.clips = null; S.ci = 0;
const SHAPE_NAMES = { arrow:'パス', ring:'選手マーク', zone:'エリア', pen:'フリー線', text:'文字', ghost:'分身', view:'視野', link:'つなぐ線', spot:'スポットライト', beam:'ライト', glow:'発光', zoom:'ZOOM' };
function shapeLabel(s){
  if (s.type === 'text') return '文字「' + s.s.replace(/\n/g, ' ') + '」';
  if (s.type === 'arrow') return s.space ? 'スペースへのパス' : s.dash ? 'ラン' : 'パス';
  if (s.type === 'zone') return s.kind === 'tri' ? '三角エリア' : 'エリア';
  return SHAPE_NAMES[s.type] || '図形';
}
function linkEnd(m, s){
  if (s.until != null) return s.until;
  const A = findShape(s.from), B = findShape(s.to);
  return A && B ? Math.min(shapeEnd(A.m, A.s), shapeEnd(B.m, B.s)) : m.t + m.show;
}
/* clips = 残す部分（元動画の時間）。null は全部残す */
const clipsOf = () => S.clips || (S.src && S.src.dur ? [[0, S.src.dur]] : []);
function ensureClips(){ if (!S.clips) S.clips = [[0, S.src.dur]]; return S.clips; }
const clipAt = t => clipsOf().find(c => t >= c[0] - 1e-3 && t < c[1] - 1e-3);
const inClip = (f, c) => f >= c[0] - 1e-3 && f < c[1] - .01;
// 今再生している部分（複製で同じ時間が何度も出てくるので、番号で覚えておく）
function curCi(){
  const cs = clipsOf(), t = S.src ? S.src.t : 0, c = cs[S.ci];
  if (c && t >= c[0] - .05 && t <= c[1] + .3) return S.ci;
  return cs.findIndex(c => t >= c[0] - 1e-3 && t < c[1] - 1e-3);
}
// 動画の部分の印（3つ目の数字）：1 = 図形なし、2 = フリーズなし、3 = 両方なし（手を加えていない映像）
const NOFX = 1, NOFRZ = 2;
const clipFlag = c => (c && c[2]) | 0;
function setFlag(c, bit, on){ const v = on ? (clipFlag(c) | bit) : (clipFlag(c) & ~bit); if (v) c[2] = v; else c.length = 2; }
const curFlag = () => { if (!S.clips || !S.src) return 0; const i = curCi(); return i >= 0 ? clipFlag(S.clips[i]) : 0; };
const fxHidden = () => !!(curFlag() & NOFX);
function freezeList(){ return S.moments.filter(m => m.pause > 0 && clipsOf().some(c => inClip(m.t, c))).sort((a, b) => a.t - b.t); }
let TL = { segs:[], dur:0 };
function buildTL(){
  const segs = [], fz = freezeList(); let o = 0;
  clipsOf().forEach((c, ci) => {
    const seg = { kind:'clip', c, ci, o, a:c[0], b:c[1], fz:[] }; segs.push(seg);
    let x = c[0];
    for (const m of fz) if (!(clipFlag(c) & NOFRZ) && inClip(m.t, c)){ const t = Math.max(m.t, x); o += t - x; x = t; const f = { kind:'f', m, t, dur:m.pause, o, ci }; segs.push(f); seg.fz.push(f); o += m.pause; }
    o += c[1] - x; seg.end = o;
  });
  TL = { segs, dur:o };
}
function srcToOutSeg(t, s){ let o = s.o + (clamp(t, s.a, s.b) - s.a); for (const f of s.fz) if (f.t < t - 1e-4) o += f.dur; return o; }
function srcToOut(t){
  const ci = curCi(), sg = ci >= 0 ? TL.segs.find(s => s.kind === 'clip' && s.ci === ci) : null;
  if (sg) return srcToOutSeg(t, sg);
  for (const s of TL.segs) if (s.kind === 'clip' && t < s.a) return s.o;
  return TL.dur;
}
function outLoc(x, end){
  for (const s of TL.segs){
    if (s.kind !== 'clip' || x > s.end + 1e-6) continue;
    if (x < s.o) return { t:s.a, ci:s.ci };
    let y = x - s.o, t = s.a;
    for (const f of s.fz){
      const v = f.t - t; if (y <= v) return { t:t + y, ci:s.ci };
      y -= v; if (y < f.dur) return { t:end ? f.t + .05 : f.t, ci:s.ci };
      y -= f.dur; t = f.t;
    }
    return { t:Math.min(s.b, t + y), ci:s.ci };
  }
  const cs = clipsOf(); return { t:cs.length ? cs[cs.length-1][1] : 0, ci:cs.length - 1 };
}
const outToSrc = (x, end) => outLoc(x, end).t;
function seekOut(x){ const L = outLoc(x); seek(L.t); if (S.clips) S.ci = L.ci; }
function outNow(){
  const s = S.src; let x = srcToOut(s.t);
  if (S.holdId){
    const m = S.moments.find(z => z.id === S.holdId);
    if (m && m.pause > 0 && Math.abs(m.t - s.t) < .06) x = srcToOut(m.t) + (S.holdUntil ? clamp(m.pause - (S.holdUntil - performance.now()) / 1000, 0, m.pause) : 0);
  }
  return x;
}
function tlItems(){
  const out = [];
  for (const m of S.moments){
    if (m.comment.trim()) out.push({ key:m, kind:'c', m, start:m.ct0 ?? m.t, end:m.cuntil ?? m.t + m.show, label:'コメント「' + m.comment.trim().replace(/\n/g, ' ') + '」', c:'#9aa5a0' });
    for (const s of m.shapes){
      const start = s.type === 'link' ? m.t : shapeStart(m, s);
      out.push({ key:s, kind:'s', m, s, start, end:Math.max(start + .1, s.type === 'link' ? linkEnd(m, s) : shapeEnd(m, s)), label:shapeLabel(s), c:s.c || '#ffffff' });
    }
  }
  // 動画の部分ごとに置く（複製した部分には同じ図形がもう一度並ぶ。「図形なし」の部分には並べない）
  const res = [];
  for (const g of TL.segs){
    if (g.kind !== 'clip' || (clipFlag(g.c) & NOFX)) continue;
    for (const it of out) if (it.start < g.b && it.end > g.a){
      const x0 = srcToOutSeg(Math.max(it.start, g.a), g), x1 = Math.max(srcToOutSeg(Math.min(it.end, g.b), g), x0 + .05);
      res.push({ ...it, x0, x1, ci:g.ci });
    }
  }
  return res.sort((a, b) => a.x0 - b.x0 || a.x1 - b.x1);
}
function setSpan(it, start, end, dt){
  if (it.kind === 'c'){ const m = it.m; if (Math.abs(start - m.t) < .02) delete m.ct0; else m.ct0 = start; m.cuntil = end; return; }
  const s = it.s, m = it.m;
  if (s.type !== 'link'){ if (Math.abs(start - m.t) < .02) delete s.t0; else s.t0 = start; }
  s.until = end;
  if (dt != null && it.origTrack) s.track = it.origTrack.map(k => [k[0] + dt, k[1], k[2]]);
}
/* サムネイル */
const TH = { url:null, step:1, imgs:new Map() };
function startThumbs(){
  const d = S.src && S.src.dur; if (!d || !S.url || TH.url === S.url) return;
  const url = TH.url = S.url; TH.imgs = new Map(); TH.step = Math.max(.5, d / 150);
  const v2 = document.createElement('video'); v2.muted = true; v2.playsInline = true; v2.preload = 'auto';
  const cv = document.createElement('canvas');
  const run = async () => {
    const n = Math.ceil(d / TH.step);
    for (let k = 0; k <= n; k++){
      if (TH.url !== url) break;
      while (TH.url === url && (!video.paused || S.exporting)) await new Promise(res => setTimeout(res, 400));
      await new Promise(res => { let done = false; const fin = () => { if (done) return; done = true; v2.removeEventListener('seeked', fin); res(); }; v2.addEventListener('seeked', fin); setTimeout(fin, 1500); v2.currentTime = Math.min(d - .05, k * TH.step + .01); });
      try {
        const h = 72, w = Math.round(h * ((v2.videoWidth / v2.videoHeight) || 16/9)); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(v2, 0, 0, w, h); const im = cv.toDataURL('image/jpeg', .6);
        TH.imgs.set(k, im); document.querySelectorAll(`.tl2-clip img[data-k="${k}"]`).forEach(e => e.src = im);
      } catch(e){ break; }
    }
    v2.removeAttribute('src'); try { v2.load(); } catch(e){}
  };
  v2.addEventListener('loadeddata', run, { once:true }); v2.src = url;
}
let tlList = [], tlDrag = null;
const LANE = 32, STRIP = 54;
function renderTracks(){
  const wrap = $('#tl2'), d0 = S.src && S.src.dur;
  wrap.hidden = !d0; if (!d0) return;
  startThumbs(); buildTL();
  const d = Math.max(TL.dur, .5), sc = $('#tl2Scroll');
  if (!S.ppsSet && sc.clientWidth) S.pps = clamp((sc.clientWidth - 24) / d, 20, 150);
  const pps = S.pps, W = Math.max(sc.clientWidth, Math.ceil(d * pps) + 24);
  $('#tl2Inner').style.width = W + 'px';
  const ru = $('#tl2Ruler'), stp = [.5,1,2,5,10,15,30,60,120].find(v => v * pps >= 56) || 300; let h = '';
  for (let t = 0; t <= d + 1e-6; t += stp) h += `<span style="left:${t*pps}px">${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}${t % 1 ? '.5' : ''}</span>`;
  ru.innerHTML = h;
  tlList = tlItems();
  const ends = [], lanes = $('#tl2Lanes'); lanes.innerHTML = '';
  if (!tlList.length) lanes.innerHTML = '<div class="tl2-empty">図形・文字・コメントを入れると、表示される期間がバーで並びます</div>';
  tlList.forEach((it, i) => {
    let ln = ends.findIndex(e => e <= it.x0 + .01); if (ln < 0){ ln = ends.length; ends.push(0); } ends[ln] = it.x1;
    const b = document.createElement('div'); b.className = 'tl2-b' + (S.sel === it.key && S.selKind === it.kind ? ' sel' : '');
    b.dataset.i = i; b.style.setProperty('--c', it.c);
    b.style.left = it.x0 * pps + 'px'; b.style.width = Math.max(10, (it.x1 - it.x0) * pps) + 'px'; b.style.top = (4 + ln * LANE) + 'px';
    b.title = `${it.label}  ${fmt(it.start)} 〜 ${fmt(it.end)}`;
    b.innerHTML = '<i class="hd l" data-h="l"></i><span></span><i class="hd r" data-h="r"></i>';
    b.querySelector('span').textContent = it.label;
    lanes.appendChild(b);
  });
  const lh = 8 + Math.max(1, ends.length) * LANE; lanes.style.height = lh + 'px';
  // 動画ストリップ
  const st = $('#tl2Strip'); st.innerHTML = '';
  const ar = S.src.aspect(), tw = Math.round((STRIP - 6) * ar);
  TL.segs.forEach((g, gi) => {
    const el = document.createElement('div'); el.dataset.g = gi;
    if (g.kind === 'clip'){
      const fl = clipFlag(g.c);
      el.className = 'tl2-clip' + (S.sel === g.c && S.selKind === 'clip' ? ' sel' : '') + (fl ? ' nofx' : '');
      if (fl) el.dataset.tag = fl === 3 ? '素の映像' : fl === 1 ? '図形なし' : 'フリーズなし';
      const w = (g.end - g.o) * pps; el.style.left = g.o * pps + 'px'; el.style.width = Math.max(6, w) + 'px';
      const n = Math.min(300, Math.ceil(w / tw)), sw = n ? w / n : tw; let hh = '';
      for (let i = 0; i < n; i++){ const t = outToSrc(g.o + (i + .5) * sw / pps), k = Math.round(t / TH.step), im = TH.imgs.get(k);
        hh += `<img alt="" draggable="false" data-k="${k}" style="left:${i*sw}px;width:${sw + .5}px"${im ? ` src="${im}"` : ''}>`; }
      el.innerHTML = hh + '<i class="hd l" data-h="l"></i><i class="hd r" data-h="r"></i>';
    } else {
      el.className = 'tl2-frz' + (S.sel === g.m && S.selKind === 'f' ? ' sel' : '');
      el.style.left = g.o * pps + 'px'; el.style.width = Math.max(10, g.dur * pps) + 'px';
      const k = Math.round(g.t / TH.step), im = TH.imgs.get(k);
      el.innerHTML = `<span>❄ ${g.dur.toFixed(1)}秒</span><i class="hd l" data-h="l"></i><i class="hd r" data-h="r"></i>`;
      if (im) el.style.backgroundImage = `linear-gradient(rgba(31,127,214,.55),rgba(31,127,214,.55)),url(${im})`;
    }
    st.appendChild(el);
  });
  if (S.sel && !selValid()) { S.sel = null; S.selKind = null; }
  renderTlBar();
  tlHead();
}
function selValid(){
  if (S.selKind === 'clip') return clipsOf().includes(S.sel);
  if (S.selKind === 'f') return S.moments.includes(S.sel) && S.sel.pause > 0;
  return tlList.some(it => it.key === S.sel && it.kind === S.selKind);
}
function selItem(){ return tlList.find(x => x.key === S.sel && x.kind === S.selKind); }
function select(key, kind){ S.sel = key; S.selKind = key ? kind : null; }
function renderTlBar(){
  const bar = $('#tl2Bar');
  let h = '<div class="tl2-row"><span class="tl2-title">タイムライン</span><button type="button" data-a="split" title="今の位置で動画を2つに分ける">✂ 分割</button><button type="button" data-a="dup" title="選んだ部分（または今の位置の部分）をすぐ後ろにもう一度入れる">⧉ 複製</button><button type="button" data-a="freeze" class="frzb" title="今の位置に3秒のフリーズ（静止画）を入れる">❄ フリーズ</button><span class="sp"></span><span style="display:flex;gap:4px"><button type="button" class="z" data-z="-1" title="縮小">−</button><button type="button" class="z" data-z="1" title="拡大">＋</button></span></div>';
  let name = '', range = '', acts = '';
  if (S.selKind === 'clip'){ const c = S.sel; name = '動画の部分'; range = `${fmt(c[0])}〜${fmt(c[1])}`; acts = `<button type="button" data-a="split">ここで分割</button><button type="button" data-a="dup">複製</button><button type="button" data-a="raw" title="図形もフリーズも入れていない元の映像のまま、すぐ後ろにもう一度入れる">素の映像で複製</button><button type="button" data-a="fx" aria-pressed="${!(clipFlag(c) & NOFX)}">図形：${clipFlag(c) & NOFX ? 'なし' : 'あり'}</button><button type="button" data-a="frz" aria-pressed="${!(clipFlag(c) & NOFRZ)}">フリーズ：${clipFlag(c) & NOFRZ ? 'なし' : 'あり'}</button><button type="button" class="del" data-a="delclip">この部分を削除</button>`; }
  else if (S.selKind === 'f'){ const m = S.sel; name = '❄ フリーズ'; range = `${m.pause.toFixed(1)}秒`; acts = '<button type="button" data-a="f-">−0.5秒</button><button type="button" data-a="f+">＋0.5秒</button><button type="button" class="del" data-a="delf">削除</button>'; }
  else { const it = selItem(); if (it){ name = it.label; range = `${fmt(it.start)}〜${fmt(it.end)}`; acts = (it.s && it.s.type === 'ring' ? '<input class="nm" type="text" maxlength="16" placeholder="名前・背番号" aria-label="選手の名前">' : '') + (it.s && hasChain(it.s) ? '<button type="button" data-a="trkall">つながりを全部追いかける</button>' + (chainRings(it.s).some(([, r]) => trackEnd(r) > 0) ? '<button type="button" data-a="trkall2">ここから全部追いかけ直す</button>' : '') : '') + (it.s && (it.s.type === 'ring' || TRACKABLE.has(it.s.type)) ? '<button type="button" data-a="trk">追いかける</button>' + (trackEnd(it.s) > 0 ? '<button type="button" data-a="retrk">ここから追いかけ直す</button>' : '') : '') + '<button type="button" data-a="from">今の位置から</button><button type="button" data-a="to">今の位置まで</button><button type="button" class="del" data-a="del">削除</button>'; } }
  if (name) h += `<div class="tl2-row"><span class="selname"></span><span class="rng">${range}</span>${acts}<button type="button" data-a="x">選択解除</button></div>`;
  else h += '<div class="tl2-row tl2-help">白い線をドラッグで動画を動かす・バーをタップで選択</div>';
  bar.innerHTML = h; const sn = bar.querySelector('.selname'); if (sn) sn.textContent = name;
  const nm = bar.querySelector('input.nm'), it = selItem();
  if (nm && it){ nm.value = it.s.label || '';
    nm.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) nm.blur(); };
    nm.onchange = () => { snapshot(); const v = nm.value.trim(); if (v) it.s.label = v; else delete it.s.label; save(); renderList(); }; }
}
function splitAt(t){
  const cs = ensureClips(), ok = c => c && t > c[0] + .1 && t < c[1] - .1;
  const pref = S.selKind === 'clip' ? cs.indexOf(S.sel) : curCi(), i = ok(cs[pref]) ? pref : cs.findIndex(ok);
  if (i < 0){ toast('動画の端に近すぎるか、削除した部分です。少し動かしてから押してください'); return false; }
  snapshot(); const c = cs[i]; cs.splice(i, 1, [c[0], t, ...c.slice(2)], [t, c[1], ...c.slice(2)]); select(cs[i + 1], 'clip'); save(); renderList(); toast('分割しました。いらない部分を選んで「この部分を削除」で消せます', 3200); return true;
}
function dupClip(raw){
  const cs = ensureClips(); let i = S.selKind === 'clip' ? cs.indexOf(S.sel) : curCi();
  if (i < 0){ toast('複製したい動画の部分を選ぶか、その部分に再生位置を合わせてください'); return; }
  snapshot(); const cp = cs[i].slice(0, 2); if (raw) cp[2] = NOFX | NOFRZ; else if (cs[i][2]) cp[2] = cs[i][2];
  cs.splice(i + 1, 0, cp); select(cp, 'clip'); save(); renderList();
  toast(raw ? '図形もフリーズもない元の映像を、すぐ後ろに入れました' : 'すぐ後ろに複製しました。「図形：なし」「フリーズ：なし」でその部分だけ外せます', 3600);
}
function addFreeze(t){
  if (!clipAt(t)){ toast('削除した部分にはフリーズを入れられません'); return; }
  snapshot(); const m = ensureMoment(t);
  m.pause = m.pause > 0 ? m.pause + 3 : 3; select(m, 'f'); save(); renderList();
  toast('3秒のフリーズを入れました。❄ の両端を引くと長さを変えられます', 3200);
}
$('#tl2Bar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !S.src) return;
  if (b.dataset.z){ const k = b.dataset.z === '1' ? 1.5 : 1/1.5, sc = $('#tl2Scroll'), mid = (sc.scrollLeft + sc.clientWidth/2) / S.pps;
    S.pps = clamp(S.pps * k, 4, 400); S.ppsSet = true; renderTracks(); sc.scrollLeft = mid * S.pps - sc.clientWidth/2; return; }
  const a = b.dataset.a, now = S.src.t;
  if (a === 'x'){ select(null); renderTracks(); return; }
  if (a === 'split'){ S.src.pause(); splitAt(now); return; }
  if (a === 'freeze'){ S.src.pause(); clearHold(); addFreeze(now); return; }
  if (a === 'dup'){ S.src.pause(); clearHold(); dupClip(); return; }
  if (a === 'fx' || a === 'frz'){ const c = S.sel; if (!c) return; const bit = a === 'fx' ? NOFX : NOFRZ; snapshot(); setFlag(c, bit, !(clipFlag(c) & bit)); save(); renderList(); return; }
  if (a === 'raw'){ S.src.pause(); clearHold(); dupClip(true); return; }
  if (a === 'delclip'){
    const cs = ensureClips(); if (cs.length <= 1){ toast('全部は削除できません。先に「分割」してから、いらない部分を削除してください', 3600); return; }
    snapshot(); cs.splice(cs.indexOf(S.sel), 1); select(null); save(); renderList(); toast('削除しました（元に戻すで戻せます）'); return;
  }
  if (a === 'f-' || a === 'f+'){ snapshot(); S.sel.pause = clamp(Math.round((S.sel.pause + (a === 'f+' ? .5 : -.5)) * 10) / 10, .5, 60); save(); renderList(); return; }
  if (a === 'delf'){
    snapshot(); const m = S.sel;
    if (!m.shapes.length && !m.comment.trim()) S.moments = S.moments.filter(x => x !== m); else m.pause = 0;
    select(null); save(); renderList(); return;
  }
  const it = selItem(); if (!it) return;
  if (a === 'trkall'){ trackChain(it.s, false); return; }
  if (a === 'trkall2'){ trackChain(it.s, true); return; }
  if (a === 'trk'){ snapshot(); autoTrack(it.m, it.s); return; }
  if (a === 'retrk'){ snapshot(); retrack(it.m, it.s); return; }
  if (a === 'del'){
    snapshot();
    if (it.kind === 'c'){ it.m.comment = ''; delete it.m.ct0; delete it.m.cuntil; }
    else { const i = it.m.shapes.indexOf(it.s); if (i >= 0) it.m.shapes.splice(i, 1); pruneLinks(); }
    select(null); save(); renderList(); return;
  }
  if (a === 'from'){ if (now >= it.end - .05){ toast('終わりより前の位置で押してください'); return; } snapshot(); setSpan(it, now, it.end); }
  if (a === 'to'){ if (now <= it.start + .05){ toast('始まりより後の位置で押してください'); return; } snapshot(); setSpan(it, it.start, now); }
  save(); renderList();
});
function tlHead(){
  const hd = $('#tl2Head'); if (!hd || $('#tl2').hidden || !S.src) return;
  const x = outNow() * S.pps; hd.style.left = x + 'px';
  if (!S.src.paused && !tlDrag){ const sc = $('#tl2Scroll'); if (x < sc.scrollLeft || x > sc.scrollLeft + sc.clientWidth - 30) sc.scrollLeft = x - 30; }
}
function tlX(e){ const r = $('#tl2Inner').getBoundingClientRect(); return clamp((e.clientX - r.left) / S.pps, 0, TL.dur); }
$('#tl2Inner').addEventListener('pointerdown', e => {
  if (!S.src || S.tracking || S.exporting) return;
  const el = e.target.closest('.tl2-b,.tl2-clip,.tl2-frz');
  const base = { x:e.clientX, y:e.clientY, moved:false };
  // 再生位置の線（つまみ）や目盛りをドラッグすると、指に合わせて動画が動く
  if (e.target.closest('.tl2-grip,.tl2-ruler')){
    e.preventDefault(); $('#tl2Inner').setPointerCapture(e.pointerId); S.src.pause(); clearHold();
    tlDrag = { ...base, mode:'scrub' }; seekOut(tlX(e)); tlHead(); return;
  }
  if (!el){ tlDrag = { ...base, mode:'seek' }; return; }
  let type, key, kind, it = null, g = null;
  if (el.classList.contains('tl2-b')){ it = tlList[+el.dataset.i]; if (!it) return; type = 'bar'; key = it.key; kind = it.kind; }
  else { g = TL.segs[+el.dataset.g]; if (!g) return; type = g.kind === 'clip' ? 'clip' : 'frz'; key = g.kind === 'clip' ? g.c : g.m; kind = g.kind === 'clip' ? 'clip' : 'f'; }
  const sel = S.sel === key && S.selKind === kind, part = e.target.dataset.h;
  const mode = !sel ? 'pick' : part || (type === 'bar' ? 'body' : 'tap');
  tlDrag = { ...base, type, key, kind, it, g, mode };
  if (mode === 'pick' || mode === 'tap') return;
  e.preventDefault(); $('#tl2Inner').setPointerCapture(e.pointerId); S.src.pause(); clearHold();
  if (type === 'bar'){ tlDrag.start = it.start; tlDrag.end = it.end; tlDrag.x0 = it.x0; tlDrag.x1 = it.x1; it.origTrack = it.s && it.s.track ? it.s.track.map(k => k.slice()) : null; }
  if (type === 'clip'){ const cs = clipsOf(), i = cs.indexOf(key); tlDrag.a = key[0]; tlDrag.b = key[1]; tlDrag.lo = 0; tlDrag.hi = S.src.dur; }
  if (type === 'frz') tlDrag.dur = key.pause;
});
$('#tl2Inner').addEventListener('pointermove', e => {
  const D = tlDrag; if (!D || D.mode === 'pick' || D.mode === 'tap' || D.mode === 'seek') return;
  if (D.mode === 'scrub'){
    D.moved = true; const x = tlX(e); seekOut(x); tlHead();
    const sc = $('#tl2Scroll'), r = sc.getBoundingClientRect();   // 端に来たら自動でスクロール
    if (e.clientX > r.right - 24) sc.scrollLeft += 12; else if (e.clientX < r.left + 24) sc.scrollLeft -= 12;
    return;
  }
  const dx = e.clientX - D.x; if (!D.moved && Math.abs(dx) < 3) return;
  if (!D.moved){ D.moved = true; snapshot(); if (D.type === 'clip') ensureClips(); }
  const dt = dx / S.pps;
  if (D.type === 'bar'){
    let a = D.start, z = D.end, sh = null;
    if (D.mode === 'l') a = Math.min(outToSrc(clamp(D.x0 + dt, 0, TL.dur)), D.end - .1);
    else if (D.mode === 'r') z = Math.max(outToSrc(clamp(D.x1 + dt, 0, TL.dur), true), D.start + .1);
    else { a = outToSrc(clamp(D.x0 + dt, 0, TL.dur)); sh = a - D.start; z = D.end + sh; if (z > S.src.dur){ z = S.src.dur; a = z - (D.end - D.start); sh = a - D.start; } }
    setSpan(D.it, a, z, sh); seek(D.mode === 'r' ? Math.max(a, z - .04) : a + .01);
  } else if (D.type === 'clip'){
    const c = D.key;
    if (D.mode === 'l'){ c[0] = clamp(D.a + dt, D.lo, D.b - .2); seek(c[0] + .01); }
    else { c[1] = clamp(D.b + dt, D.a + .2, D.hi); seek(c[1] - .04); }
  } else {
    D.key.pause = clamp(Math.round((D.dur + (D.mode === 'l' ? -dt : dt)) * 10) / 10, .5, 60);
  }
  renderTracks();
});
function tlUp(e){
  const D = tlDrag; tlDrag = null; if (!D) return;
  const tap = Math.hypot(e.clientX - D.x, e.clientY - D.y) < 8;
  if (D.mode === 'scrub'){ renderTracks(); return; }
  if (D.mode === 'seek'){ if (tap){ S.src.pause(); seekOut(tlX(e)); select(null); renderTracks(); } return; }
  if (D.mode === 'pick' || D.mode === 'tap'){
    if (!tap) return;
    S.src.pause();
    if (D.type === 'bar'){ select(D.key, D.kind); seekOut(D.it.x0 + Math.min(.02, (D.it.x1 - D.it.x0) / 2)); if (S.tool !== 'move' && D.kind === 's') setTool('move'); }
    else if (D.type === 'clip'){ select(D.key, 'clip'); seekOut(tlX(e)); }
    else { select(D.key, 'f'); seekOut(D.g.o); }
    renderTracks(); return;
  }
  if (D.moved){ save(); renderList(); }
}
$('#tl2Inner').addEventListener('pointerup', tlUp);
$('#tl2Inner').addEventListener('pointercancel', () => { if (tlDrag && tlDrag.moved){ save(); renderList(); } tlDrag = null; });
window.addEventListener('resize', () => { if (S.src) renderTracks(); });

function renderMarkers(){
  const d = S.src && S.src.dur; const box = $('#markers'); box.innerHTML = '';
  if (!d) return;
  for (const m of S.moments){ const el = document.createElement('div'); el.className = 'mk' + (m.pause > 0 ? ' timed' : m.pause === 0 ? ' pass' : ''); el.style.left = (m.t/d*100) + '%'; el.title = fmt(m.t); box.appendChild(el); }
  renderTracks();
}
const PAUSE_OPTS = [[-1,'押すまで停止'],[2,'2秒停止'],[3,'3秒停止'],[5,'5秒停止'],[8,'8秒停止'],[10,'10秒停止'],[15,'15秒停止'],[0,'止めずに流す']];
const SHOW_OPTS = [2,3,5,8,10,15];
function renderList(){
  const list = $('#list'); $('#count').textContent = S.moments.length; lastActive = undefined; renderMarkers();
  if (!S.moments.length){ list.innerHTML = '<p class="empty">まだ場面がありません。動画を開き、止めたいところで一時停止して矢印や円を描くと、その時点が場面として追加されます。</p>'; return; }
  list.innerHTML = '';
  for (const m of S.moments){
    const el = document.createElement('article'); el.className = 'moment'; el.dataset.id = m.id;
    const pOpts = PAUSE_OPTS.slice(); if (!pOpts.some(o => o[0] === m.pause)) pOpts.splice(-1, 0, [m.pause, m.pause + '秒停止']);
    const sOpts = SHOW_OPTS.slice(); if (!sOpts.includes(m.show)) sOpts.push(m.show);
    const open = S.open.has(m.id);
    el.innerHTML = `<div class="m-head"><button class="m-tog" type="button" aria-expanded="${open}" title="くわしく">▸</button><button class="m-time" type="button">${fmt(m.t)}</button><span class="m-sum"></span>
      <select class="psel" id="pause-${m.id}" aria-label="一時停止">${pOpts.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select>
      <button class="m-del" type="button">削除</button></div>
      <div class="m-body"${open ? '' : ' hidden'}>
      <textarea id="note-${m.id}" rows="2" placeholder="コメント（映像の下に表示）"></textarea>
      <div class="pz"><span class="pz-l">コメントの大きさ</span><div class="seg cfs">${SIZES.map(x => `<button type="button" data-v="${x[0]}" aria-pressed="${(m.cfs || 1) === x[0]}">${x[1]}</button>`).join('')}</div></div>
      <div class="pz"><span class="pz-l">コメントの背景</span><div class="seg cbg">${BGS.map(b => `<button type="button" data-v="${b[0]}" aria-pressed="${(m.cbg || 'dark') === b[0]}">${bgDot(b[0])}${b[1]}</button>`).join('')}</div></div>
      <div class="m-opts"><label>図の表示 <select id="show-${m.id}">${sOpts.map(v => `<option value="${v}">${v}秒</option>`).join('')}</select></label><button type="button" class="mini" data-a="allu" title="ここまでの位置を全部の図にまとめて設定">全部を今の位置まで</button></div>
      <div class="m-items"></div></div>`;
    const ta = el.querySelector('textarea'), ss =el.querySelector(`#show-${m.id}`), del = el.querySelector('.m-del'), items = el.querySelector('.m-items');
    ta.value = m.comment; ss.value = String(m.show);
    const psel = el.querySelector('.psel'), sum = el.querySelector('.m-sum'), tog = el.querySelector('.m-tog'), body = el.querySelector('.m-body');
    const pcls = () => { psel.className = 'psel ' + (m.pause > 0 ? 'p-timed' : m.pause === 0 ? 'p-pass' : 'p-hold'); };
    psel.value = String(m.pause); pcls();
    psel.onchange = () => { snapshot(); m.pause = +psel.value; pcls(); save(); renderMarkers(); };
    const setSum = () => { sum.textContent = m.comment.trim() ? m.comment.trim().replace(/\s+/g, ' ') : `図形 ${m.shapes.length}`; };
    setSum();
    tog.onclick = () => { const o = body.hidden; body.hidden = !o; tog.setAttribute('aria-expanded', o); if (o) S.open.add(m.id); else S.open.delete(m.id); };
    el.querySelectorAll('.cfs button').forEach(b => b.onclick = () => {
      snapshot(); const v = +b.dataset.v; if (v === 1) delete m.cfs; else m.cfs = v; save();
      el.querySelectorAll('.cfs button').forEach(x => x.setAttribute('aria-pressed', x === b));
    });
    el.querySelectorAll('.cbg button').forEach(b => b.onclick = () => {
      snapshot(); if (b.dataset.v === 'dark') delete m.cbg; else m.cbg = b.dataset.v; save();
      el.querySelectorAll('.cbg button').forEach(x => x.setAttribute('aria-pressed', x === b));
    });
    el.querySelector('.m-time').onclick = () => { S.src.pause(); seek(m.t); S.enter.delete(m.id); };
    ta.oninput = () => { m.comment = ta.value; setSum(); save(); };
    ss.onchange = () => { snapshot(); m.show = +ss.value; save(); };
    const untilHTML = (v) => v != null
      ? `<span class="until"><button type="button" data-a="u" class="set" title="今の位置に変更">〜${fmt(v)}</button><button type="button" data-a="ux" title="終わりの指定を外す">✕</button></span>`
      : `<span class="until"><button type="button" data-a="u" title="今の動画の位置で消す">ここまで</button></span>`;
    const bindUntil = (row, obj, key, after) => {
      row.querySelector('[data-a="u"]').onclick = () => {
        const now = S.src.t;
        if (now <= m.t + 0.05){ toast('消したい位置まで動画を進めてから押してください'); return; }
        snapshot(); obj[key] = now; save(); renderList(); toast(`${fmt(now)} まで表示します`);
        if (after) after();
      };
      const x = row.querySelector('[data-a="ux"]'); if (x) x.onclick = () => { snapshot(); delete obj[key]; save(); renderList(); };
    };
    { const row = document.createElement('div'); row.className = 'm-item';
      row.innerHTML = `<i class="dot" style="background:var(--muted)"></i><span>コメント</span>${untilHTML(m.cuntil)}`;
      bindUntil(row, m, 'cuntil'); items.appendChild(row); }
    const NAMES = { arrow:'パス', ring:'選手マーク', zone:'エリア', pen:'フリー線', text:'文字', ghost:'分身', view:'視野', link:'つなぐ線', spot:'スポットライト', beam:'ライト', glow:'発光', zoom:'ZOOM' };
    const cnt = {};
    m.shapes.forEach(s => {
      const row = document.createElement('div'); row.className = 'm-item';
      const nm = s.type === 'arrow' ? (s.space ? 'スペースへのパス' : s.dash ? 'ラン' : 'パス') : (NAMES[s.type] || '図形');
      cnt[nm] = (cnt[nm] || 0) + 1;
      let extra = '';
      if (s.type === 'text'){
        const cur = BG[s.bg || 'dark'] || BG.dark;
        extra = `<button type="button" data-a="edit">文字を直す</button><button type="button" data-a="fs">大きさ：${sizeName(s.fs)}</button><button type="button" data-a="bg">${bgDot(cur.key)}背景：${cur.name}</button>`;
      } else if (s.type === 'ring'){
        const opL = { 1:'濃い', 0.6:'普通', 0.3:'薄い' }[s.op ?? .6] || '普通', te = trackEnd(s);
        extra = `<button type="button" data-a="st">${s.st === 'dash' ? '点線' : s.st === 'disc' ? '円盤' : '実線'}</button><button type="button" data-a="op">${opL}</button><button type="button" data-a="hl" aria-pressed="${!!s.hl}">スポット</button><button type="button" data-a="label">${s.label ? '名前：' + esc(s.label) : '名前'}</button><button type="button" data-a="track">自動で追いかける</button>${te > 0 ? '<button type="button" data-a="retrack" title="今の位置からもう一度追いかける（それより前はそのまま）">ここから追いかけ直す</button><button type="button" data-a="clear">追従をやめる</button>' : ''}`;
      } else if (s.type === 'ghost'){
        extra = `<button type="button" data-a="replay">動きを見せる</button><button type="button" data-a="label">ラベル</button><button type="button" data-a="erase" aria-pressed="${!!s.erase}">元の選手：${s.erase ? '消す' : '残す'}</button>`;
      } else if (s.type === 'zoom'){
        extra = `<button type="button" data-a="zk">倍率：${s.k || 2}倍</button>`;
      } else if (s.type === 'link'){
        extra = `<button type="button" data-a="trkall">つながりを全部追いかける</button>`;
      }
      if (TRACKABLE.has(s.type)) extra += `<button type="button" data-a="track">自動で追いかける</button>${trackEnd(s) > 0 ? '<button type="button" data-a="retrack" title="今の位置からもう一度追いかける（それより前はそのまま）">ここから追いかけ直す</button><button type="button" data-a="clear">追従をやめる</button>' : ''}`;
      const te = s.type === 'ring' || TRACKABLE.has(s.type) ? trackEnd(s) : -1;
      row.innerHTML = `<i class="dot" style="background:${s.c || '#fff'}"></i><span></span>${extra}${untilHTML(s.until)}`;
      row.querySelector('span').textContent = s.type === 'text'
        ? `文字「${(t => t.length > 10 ? t.slice(0,10) + '…' : t)(s.s.replace(/\n/g, ' '))}」`
        : `${nm}${cnt[nm] > 1 || m.shapes.filter(x => x.type === s.type).length > 1 ? cnt[nm] : ''}${te > 0 ? `（${(te - m.t).toFixed(1)}秒 追従）` : ''}${s.pulse ? '・強調中' : ''}`;
      const q = k => row.querySelector(`[data-a="${k}"]`);
      if (s.type === 'text') q('edit').onclick = () => editText(s);
      if (s.type === 'text') q('fs').onclick = () => { snapshot(); s.fs = nextSize(s.fs); if (s.fs === 1) delete s.fs; save(); renderList(); };
      if (s.type === 'text') q('bg').onclick = () => { snapshot(); const i = BGS.findIndex(b => b[0] === (s.bg || 'dark')); s.bg = BGS[(i+1) % BGS.length][0]; save(); renderList(); };
      if (s.type === 'ring'){
        q('st').onclick = () => { snapshot(); s.st = s.st === 'dash' ? 'disc' : s.st === 'disc' ? 'solid' : 'dash'; save(); renderList(); };
        q('hl').onclick = () => { snapshot(); if (s.hl) delete s.hl; else s.hl = true; save(); renderList(); };
        q('op').onclick = () => { snapshot(); const cur = s.op ?? .6; s.op = cur === 1 ? .6 : cur === .6 ? .3 : 1; save(); renderList(); };
        q('track').onclick = () => { snapshot(); autoTrack(m, s); };
        if (q('retrack')) q('retrack').onclick = () => { snapshot(); retrack(m, s); };
        if (q('clear')) q('clear').onclick = () => { snapshot(); const c0 = ringCenter(s, m.t), dx = c0[0]-s.a[0], dy = c0[1]-s.a[1]; s.a = c0; s.b = [s.b[0]+dx, s.b[1]+dy]; delete s.track; save(); renderList(); };
      }
      if (TRACKABLE.has(s.type)){
        q('track').onclick = () => { snapshot(); autoTrack(m, s); };
        if (q('retrack')) q('retrack').onclick = () => { snapshot(); retrack(m, s); };
        if (q('clear')) q('clear').onclick = () => { snapshot(); delete s.track; save(); renderList(); };
      }
      if (s.type === 'link') q('trkall').onclick = () => trackChain(s, false);
      if (s.type === 'zoom') q('zk').onclick = () => { snapshot(); const z = [1.5, 2, 3], i = z.indexOf(s.k || 2); s.k = z[(i + 1) % z.length]; save(); renderList(); };
      if (s.type === 'ghost') q('erase').onclick = () => setGhostErase(m, s, !s.erase);
      if (s.type === 'ghost') q('replay').onclick = () => { S.src.pause(); seek(m.t); S.enter.delete(m.id); };
      if (s.type === 'ghost' || s.type === 'ring'){
        const lb = q('label');
        lb.onclick = () => {
          const inp = document.createElement('input'); inp.type = 'text'; inp.value = s.label && s.label !== 'ここ' ? s.label : ''; inp.placeholder = s.type === 'ring' ? '例：10 佐藤' : '例：ここ'; inp.id = 'lbl-' + m.id + '-' + m.shapes.indexOf(s); inp.style.cssText = 'width:110px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:2px 6px;font-size:12px';
          lb.replaceWith(inp); inp.focus(); inp.select();
          const done = () => { snapshot(); const v = inp.value.trim(); if (v) s.label = v; else delete s.label; save(); renderList(); };
          inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) inp.blur(); };
          inp.onblur = done;
        };
      }
      bindUntil(row, s, 'until');
      items.appendChild(row);
    });
    el.querySelector('[data-a="allu"]').onclick = () => {
      const now = S.src.t;
      if (now <= m.t + 0.05){ toast('消したい位置まで動画を進めてから押してください'); return; }
      snapshot(); m.shapes.forEach(x => x.until = now); if (m.comment.trim()) m.cuntil = now; save(); renderList(); toast(`この場面の図とコメントを ${fmt(now)} まで表示します`);
    };
    let armT;
    del.onclick = () => {
      if (!del.classList.contains('armed')){ del.classList.add('armed'); del.textContent = '本当に削除'; armT = setTimeout(() => { del.classList.remove('armed'); del.textContent = '削除'; }, 2500); return; }
      clearTimeout(armT); snapshot(); S.moments = S.moments.filter(x => x !== m); pruneLinks(); save(); renderList();
    };
    list.appendChild(el);
  }
}

/* ---------- caption drag ---------- */
const capEl = $('#caption'); let capDrag = null;
capEl.addEventListener('pointerdown', e => {
  if (!S.capId || !S.src || !S.src.paused) return;
  e.preventDefault(); e.stopPropagation(); capEl.setPointerCapture(e.pointerId);
  const cr = capEl.getBoundingClientRect();
  capDrag = { id:S.capId, dx:e.clientX - (cr.left + cr.width/2), dy:e.clientY - (cr.top + cr.height/2) }; snapshot();
});
capEl.addEventListener('pointermove', e => {
  if (!capDrag) return; const m = S.moments.find(x => x.id === capDrag.id); if (!m) return;
  const r = stage.getBoundingClientRect();
  m.cpos = [clamp((e.clientX - capDrag.dx - r.left) / r.width, .08, .92), clamp((e.clientY - capDrag.dy - r.top) / r.height, .05, .95)];
});
capEl.addEventListener('pointerup', () => { if (capDrag){ capDrag = null; save(); } });
capEl.addEventListener('dblclick', () => { const m = S.moments.find(x => x.id === S.capId); if (m && m.cpos){ snapshot(); delete m.cpos; save(); } });

function setTool(t){
  S.tool = t; S.linkFrom = null; S.hover = null;
  $('#ringOpts').hidden = t !== 'ring';
  $('#textOpts').hidden = t !== 'text';
  $('#viewOpts').hidden = t !== 'view';
  $('#pulseOpts').hidden = t !== 'pulse'; document.querySelectorAll('.tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t));
  ink.style.cursor = t === 'erase' || t === 'move' ? 'pointer' : t === 'text' ? 'text' : 'crosshair';
  $('#hint').innerHTML = HINTS[t] || '';
  if (t !== 'move' && !S.exporting) S.lastAdd = t;
  updMode();
}
const TOOL_NAMES = { arrow:'パス', run:'ラン', space:'スペース', ring:'選手', spot:'スポットライト', beam:'ライト', glow:'発光', zoom:'ZOOM', pulse:'強調', view:'視野', link:'つなぐ', ghost:'分身', tri:'三角', zone:'四角', pen:'フリー', text:'文字', erase:'消す' };
function updMode(){
  const b = $('#modeb'); if (!b) return;
  b.hidden = !S.src;
  const edit = S.tool === 'move'; b.classList.toggle('edit', edit);
  $('#mbText').textContent = edit ? '編集中' : `追加：${TOOL_NAMES[S.tool] || ''}`;
  $('#mbBtn').textContent = edit ? `＋ ${TOOL_NAMES[S.lastAdd] || 'パス'}を追加` : '✋ 編集';
}
$('#mbBtn').onclick = () => setTool(S.tool === 'move' ? (S.lastAdd || 'arrow') : 'move');
S.keepAdd = false;
try { S.keepAdd = localStorage.getItem('n1va:keepAdd') === '1'; } catch(e){}
$('#keepAdd').checked = S.keepAdd;
$('#keepAdd').onchange = e => { S.keepAdd = e.target.checked; try { localStorage.setItem('n1va:keepAdd', S.keepAdd ? '1' : '0'); } catch(err){} };
let addTipShown = false;
function afterAdd(){
  if (S.keepAdd || S.exporting) return;
  setTool('move');
  if (!addTipShown){ addTipShown = true; toast('追加しました。そのままドラッグで位置を直せます（続けて追加するときはツールを選び直す）', 3200); }
}
function editInstead(){ setTool('move'); toast('入れてある図形をタップしたので「編集」にしました。ドラッグで動かせます', 2600); }
document.querySelectorAll('.tool').forEach(b => b.onclick = () => setTool(b.dataset.tool));
S.ringSt = 'solid'; S.ringOp = .6;
try { S.ringSt = localStorage.getItem('n1va:ringSt') || 'solid'; S.ringOp = +(localStorage.getItem('n1va:ringOp') || .6); } catch(e){}
function syncRingOpts(){
  document.querySelectorAll('#ringSt button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S.ringSt));
  document.querySelectorAll('#ringOp button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === S.ringOp));
  $('#ringHl').setAttribute('aria-pressed', !!S.ringHl);
  document.querySelectorAll('#textBg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S.textBg));
  document.querySelectorAll('#textFs button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === S.textFs));
  document.querySelectorAll('#viewW button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === S.viewW));
  document.querySelectorAll('#pulseP button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === S.pulseP));
}
S.viewW = 30; S.pulseP = 1;
document.querySelectorAll('#pulseP button').forEach(b => b.onclick = () => { S.pulseP = +b.dataset.v; syncRingOpts(); });
document.querySelectorAll('#viewW button').forEach(b => b.onclick = () => { S.viewW = +b.dataset.v; syncRingOpts(); });
S.ringHl = false; S.textBg = 'dark'; S.textFs = 1;
try { S.textFs = +(localStorage.getItem('n1va:textFs') || 1); if (!SIZES.some(x => x[0] === S.textFs)) S.textFs = 1; } catch(e){}
$('#textFs').innerHTML = SIZES.map(x => `<button type="button" data-v="${x[0]}">${x[1]}</button>`).join('');
document.querySelectorAll('#textFs button').forEach(b => b.onclick = () => { S.textFs = +b.dataset.v; try { localStorage.setItem('n1va:textFs', S.textFs); } catch(e){} syncRingOpts(); });
try { S.textBg = localStorage.getItem('n1va:textBg') || 'dark'; if (!BG[S.textBg]) S.textBg = 'dark'; } catch(e){}
$('#ringHl').onclick = () => { S.ringHl = !S.ringHl; syncRingOpts(); };
$('#textBg').innerHTML = BGS.map(b => `<button type="button" data-v="${b[0]}">${bgDot(b[0])}${b[1]}</button>`).join('');
document.querySelectorAll('#textBg button').forEach(b => b.onclick = () => { S.textBg = b.dataset.v; try { localStorage.setItem('n1va:textBg', S.textBg); } catch(e){} syncRingOpts(); });
document.querySelectorAll('#ringSt button').forEach(b => b.onclick = () => { S.ringSt = b.dataset.v; try { localStorage.setItem('n1va:ringSt', S.ringSt); } catch(e){} syncRingOpts(); });
document.querySelectorAll('#ringOp button').forEach(b => b.onclick = () => { S.ringOp = +b.dataset.v; try { localStorage.setItem('n1va:ringOp', S.ringOp); } catch(e){} syncRingOpts(); });
syncRingOpts();
const sw = $('#swatches');
COLORS.forEach(([c, name]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sw'; b.style.background = c; b.title = name; b.setAttribute('aria-label', name);
  b.onclick = () => { S.color = c; sw.querySelectorAll('.sw').forEach(x => x.setAttribute('aria-pressed', x === b)); }; sw.appendChild(b); });
sw.firstChild.setAttribute('aria-pressed', 'true');
setTool('arrow');

$('#play').onclick = togglePlay;
function nextScene(){
  if (!S.src) return; const t = S.src.t;
  const n = S.moments.filter(m => m.t > t + .05 && clipAt(m.t)).sort((a, b) => a.t - b.t)[0];
  if (!n){ toast('この先に場面はありません'); return; }
  S.src.pause(); seek(n.t);
}
$('#nextM').onclick = nextScene;
$('#prevF').onclick = () => step(-1/FPS); $('#nextF').onclick = () => step(1/FPS);
$('#back1').onclick = () => step(-1); $('#fwd1').onclick = () => step(1);
$('#speed').onchange = e => { if (S.src) S.src.rate = +e.target.value; };
$('#undo').onclick = undo; $('#redo').onclick = redo; updUndo();
$('#fs').onclick = () => { const w = $('#wrap'); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (w.requestFullscreen) w.requestFullscreen().catch(() => toast('この環境では全画面にできません')); else toast('この環境では全画面にできません'); };
$('#addNote').onclick = () => { if (!S.src){ toast('先に動画を開いてください'); return; } S.src.pause(); clearHold(); snapshot(); const m = ensureMoment(S.src.t); S.open.add(m.id); save(); renderList(); const ta = document.getElementById('note-' + m.id); if (ta){ ta.focus(); ta.scrollIntoView({ block:'nearest' }); } };

const tl = $('#timeline'); let scrub = false;
const tlSeek = e => { const r = tl.getBoundingClientRect(); if (S.src && S.src.dur) seek(clamp((e.clientX - r.left) / r.width, 0, 1) * S.src.dur); };
tl.addEventListener('pointerdown', e => { if (S.tracking) return; scrub = true; tl.setPointerCapture(e.pointerId); if (S.src) S.src.pause(); tlSeek(e); });
tl.addEventListener('pointermove', e => { if (scrub) tlSeek(e); });
tl.addEventListener('pointerup', () => scrub = false);

document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (S.exporting || !$('#exModal').hidden || !$('#workModal').hidden) return;
  if (e.key === 'Escape'){ S.linkFrom = null; }
  else if (e.key === ' '){ e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowLeft'){ e.preventDefault(); step(e.shiftKey ? -1 : -1/FPS); }
  else if (e.key === 'ArrowRight'){ e.preventDefault(); step(e.shiftKey ? 1 : 1/FPS); }
  else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'f'){ e.preventDefault(); if (S.src){ S.src.pause(); clearHold(); addFreeze(S.src.t); } }
  else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n'){ e.preventDefault(); nextScene(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'){ e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y'){ e.preventDefault(); redo(); }
});

/* ---------- work files ---------- */
const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IN_FRAME = (() => { try { return window.self !== window.top; } catch(e){ return true; } })();
async function saveFile(name, blob, opt){
  const isVideo = /^video\//.test(blob.type || ''), wantShare = opt && opt.share;
  // スマホは共有メニューを優先（iPhone は「ビデオを保存」で写真アプリに入る）。
  // claude.ai の中（iframe）では共有メニューが出ないことがあるので、明示的に押したときだけ試す
  if (IS_MOBILE && navigator.share && navigator.canShare && (!IN_FRAME || wantShare)){
    const f = new File([blob], name, { type:blob.type || 'application/octet-stream' });
    let ok = false; try { ok = navigator.canShare({ files:[f] }); } catch(e){}
    if (ok){
      try { await navigator.share({ files:[f] }); return true; }
      catch(e){ if (e && e.name === 'AbortError') return false; if (wantShare){ toast('この画面では共有メニューが使えませんでした。「保存する」でファイルアプリに保存してください', 6000); return false; } }
    } else if (wantShare){ toast('この画面では共有メニューが使えません。「保存する」でファイルアプリに保存してください', 6000); return false; }
  }
  if (window.claude){
    const dl = downloadsP ? await downloadsP : null;
    if (!dl){ toast('この画面（claude.ai の中）では保存できません。Safari で claude.ai を開いて試すか、GitHub Pages 版のアプリで書き出してください', 8000); return false; }
    try { await dl.save({ filename:name, data:blob });
      if (isVideo && IS_IOS) toast('「ファイル」アプリに保存しました。写真に入れるには、ファイルアプリでその動画を開き、共有ボタン →「ビデオを保存」を押してください', 9000); else toast('保存しました');
      return true; }
    catch(e){
      const code = e && e.code;
      if (code === 'declined') return false;
      if (code === 'rate_limited'){ toast('保存の確認が開いています。少し待ってからもう一度押してください'); return false; }
      if (code === 'too_large'){ toast('ファイルが大きすぎて保存できませんでした', 4500); return false; }
      toast('保存できませんでした'); return false;
    }
  }
  const url = URL.createObjectURL(blob), el = document.createElement('a');
  el.href = url; el.download = name; document.body.appendChild(el); el.click(); el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast('保存しました（ダウンロードを確認してください）'); return true;
}
$('#workSave').onclick = () => {
  if (!S.src){ toast('先に動画を開いてください'); return; }
  if (!S.moments.length && !S.clips){ toast('まだ保存する場面がありません'); return; }
  const data = { app:'n1-analysis', v:1, name:S.fileName || '', dur:S.src.dur, saved:new Date().toISOString(), moments:S.moments, clips:S.clips };
  const base = (S.fileName || 'video').replace(/\.[^.]+$/, '');
  saveFile(`${base}_Kwork.json`, new Blob([JSON.stringify(data)], { type:'application/json' }));
};
$('#workOpen').onclick = () => $('#workFile').click();
$('#workFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  let d; try { d = JSON.parse(await f.text()); } catch(err){ toast('作業ファイルを読み込めませんでした'); return; }
  const arr = Array.isArray(d) ? d : d && d.moments;
  if (!Array.isArray(arr)){ toast('N1分析の作業ファイルではないようです'); return; }
  const label = (d && d.name) || f.name;
  if (!S.src){ S.pendingWork = { moments:arr, label, clips:d && d.clips }; toast(`「${label}」の作業を用意しました。続けて元の動画を開いてください`, 4500); $('#file').click(); return; }
  if (d && d.dur && Math.abs(d.dur - S.src.dur) > 1) toast('動画の長さが作業ファイルと違います。別の動画かもしれません', 4500);
  setTimeout(() => applyWork(arr, `作業ファイル「${label}」を読み込みました`, d && d.clips), d && d.dur && Math.abs(d.dur - S.src.dur) > 1 ? 1200 : 0);
});
async function openWorkList(){
  let all = []; try { all = await IDB.all(); } catch(e){}
  all = all.filter(r => r.moments && r.moments.length).sort((a,b) => b.updated - a.updated);
  const box = $('#wlist'); box.innerHTML = '';
  $('#wmNote').textContent = !all.length ? 'この端末に保存した作業はまだありません。' : S.src ? '今開いている動画に読み込む作業を選んでください。' : '読み込むには、先に動画を開いてください。';
  for (const r of all){
    const row = document.createElement('div'); row.className = 'witem';
    const durTxt = r.dur ? fmt(r.dur).replace(/\.\d+$/, '') : '';
    row.innerHTML = `<div class="wi-t"><b></b><small>場面${r.moments.length}件・動画 ${durTxt}・${hm(r.updated)} 保存</small></div>${r.key === S.key ? '<span class="cur">今の動画</span>' : ''}<button class="btn" type="button" data-a="load">読み込む</button><button class="btn" type="button" data-a="del">削除</button>`;
    row.querySelector('b').textContent = r.name || '名前なし';
    const ld = row.querySelector('[data-a="load"]'); ld.disabled = !S.src || r.key === S.key;
    ld.onclick = () => { $('#workModal').hidden = true; applyWork(r.moments, `「${r.name || '保存した作業'}」の作業を読み込みました`, r.clips); };
    const del = row.querySelector('[data-a="del"]'); let armT;
    del.onclick = async () => {
      if (!del.classList.contains('primary')){ del.classList.add('primary'); del.textContent = '本当に削除'; armT = setTimeout(() => { del.classList.remove('primary'); del.textContent = '削除'; }, 2500); return; }
      clearTimeout(armT); try { await IDB.del(r.key); } catch(e){} try { localStorage.removeItem(r.key); } catch(e){}
      if (r.key === S.key){ S.moments = []; renderList(); setSaveState('まだ保存する作業はありません'); }
      openWorkList();
    };
    box.appendChild(row);
  }
  $('#workModal').hidden = false;
}
$('#workList').onclick = openWorkList;
let newArmT;
$('#workNew').onclick = async () => {
  const btn = $('#workNew');
  if (!S.src){ toast('先に動画を開いてください'); return; }
  if (!S.moments.length){ toast('すでに新しい作業です。描き始めてください'); return; }
  if (!btn.classList.contains('primary')){
    btn.classList.add('primary'); btn.textContent = 'もう一度押すと新しく始めます';
    newArmT = setTimeout(() => { btn.classList.remove('primary'); btn.textContent = '新しい作業を始める'; }, 3000); return;
  }
  clearTimeout(newArmT); btn.classList.remove('primary'); btn.textContent = '新しい作業を始める';
  const now = Date.now(), arc = { ...workRecord(), key:S.key + ':' + now, name:`${S.fileName || '名前なし'}（${hm(now)} までの作業）`, updated:now };
  try { await IDB.put(arc); } catch(e){ toast('今の作業を残せませんでした。先に「作業をファイルに保存」してください', 4500); return; }
  S.src.pause(); clearHold(); snapshot(); S.moments = []; S.clips = null; select(null); S.open = new Set(); S.enter.clear(); save(); renderList();
  toast('新しい作業を始めました。前の作業は「保存した作業の一覧」に残っています', 4500);
};
$('#wmClose').onclick = () => { $('#workModal').hidden = true; };

/* ---------- open video ---------- */
function resize(){ const r = stage.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); ink.width = Math.round(r.width*d); ink.height = Math.round(r.height*d); }
new ResizeObserver(resize).observe(stage);
function setSource(src, key, name){
  if (S.src) S.src.pause(); clearHold();
  S.src = src; S.key = key; S.fileName = name; S.moments = []; S.undo = []; S.redo = []; S.sel = null; S.selKind = null; S.clips = null; S.ppsSet = false; updUndo(); updMode(); S.enter.clear(); S.open = new Set(); src.rate = +$('#speed').value;
  stage.style.setProperty('--ar', src.aspect()); $('#clip').textContent = name;
  $('#found').hidden = true; S.loading = true; setSaveState('読み込み中…');
  seek(0); renderList(); resize();
  loadWork(key);
}
async function loadWork(key){
  let rec = null;
  try { rec = await IDB.get(key); } catch(e){}
  if (S.key !== key) return;
  let arr = rec && Array.isArray(rec.moments) ? rec.moments : legacyLoad(key);
  if (S.pendingWork){ const pw = S.pendingWork; S.pendingWork = null; S.loading = false; applyWork(pw.moments, `作業ファイル「${pw.label}」を読み込みました`, pw.clips); return; }
  if ((arr && arr.length) || (rec && rec.clips)){
    S.moments = cleanMoments(arr || []); S.clips = rec && rec.clips || null; S.loading = false; renderList();
    setSaveState(`自動保存済み ${rec ? hm(rec.updated) : ''}`.trim(), 'ok');
    toast(`前回の作業（場面${S.moments.length}件）を読み込みました`); return;
  }
  S.loading = false; setSaveState('まだ保存する作業はありません');
  // 同じ長さの動画で保存した作業を探す（名前が変わっていても見つける）
  let all = []; try { all = await IDB.all(); } catch(e){}
  if (S.key !== key || S.moments.length) return;
  const d = S.src.dur, cands = all.filter(r => r.key !== key && r.moments && r.moments.length && Math.abs((r.dur || 0) - d) < 0.6).sort((a,b) => b.updated - a.updated);
  if (cands.length){
    const c = cands[0];
    $('#foundText').textContent = `同じ長さの動画で保存した作業が見つかりました：「${c.name || '名前なし'}」場面${c.moments.length}件（${hm(c.updated)}）`;
    $('#found').hidden = false;
    $('#foundLoad').onclick = () => { $('#found').hidden = true; applyWork(c.moments, `「${c.name || '保存した作業'}」の作業を読み込みました`, c.clips); };
    $('#foundSkip').onclick = () => { $('#found').hidden = true; };
  }
}
function openFile(f){
  if (!f) return;
  if (S.tracking){ toast('追いかけ中は動画を切り替えられません'); return; }
  if (!/^video\//.test(f.type) && !/\.(mp4|mov|m4v|webm)$/i.test(f.name)){ toast('動画ファイルを選んでください'); return; }
  if (S.url) URL.revokeObjectURL(S.url);
  S.url = URL.createObjectURL(f);
  video.onloadedmetadata = () => { video.hidden = false; $('#drop').hidden = true; setSource(videoSource(video), 'n1va:' + f.name + ':' + f.size, f.name); S.fileName = f.name; $('#exportBtn').disabled = false; toast('動画を読み込みました'); };
  video.onerror = () => toast('この動画は再生できません。MP4（H.264）で試してください');
  video.src = S.url;
}
$('#file').addEventListener('change', e => { openFile(e.target.files[0]); e.target.value = ''; });
const drop = $('#drop');
['dragenter','dragover'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); if (ev === 'drop' || !e.relatedTarget) drop.classList.remove('over'); }));
document.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) openFile(f); });

/* ---------- export (書き出し) ---------- */
let downloadsP = null;
try { downloadsP = window.claude && window.claude.use ? window.claude.use('downloads') : null; } catch(e){}
let exHoldSec = 5, exRes = 1080;
try { exRes = +(localStorage.getItem('n1va:exRes') || 1080) === 720 ? 720 : 1080; } catch(e){}
const syncExRes = () => document.querySelectorAll('#exRes button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === exRes));
document.querySelectorAll('#exRes button').forEach(b => b.onclick = () => { exRes = +b.dataset.v; try { localStorage.setItem('n1va:exRes', exRes); } catch(e){} syncExRes(); });
syncExRes();
const syncExHold = () => document.querySelectorAll('#exHold button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === exHoldSec));
document.querySelectorAll('#exHold button').forEach(b => b.onclick = () => { exHoldSec = +b.dataset.v; syncExHold(); });
syncExHold();
function pickMime(){
  const list = [['video/mp4;codecs=avc1.42E01F,mp4a.40.2','mp4'],['video/mp4;codecs=avc1','mp4'],['video/mp4','mp4'],['video/webm;codecs=vp9,opus','webm'],['video/webm;codecs=vp8,opus','webm'],['video/webm','webm']];
  if (!window.MediaRecorder) return null;
  for (const [m, ext] of list) if (MediaRecorder.isTypeSupported(m)) return { mime:m, ext };
  return null;
}
// iPad の Safari は video.captureStream が無いので、Web Audio で動画の音を取り出す
let AUD = null;
function audioGraph(){
  if (AUD) return AUD;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  try {
    const actx = new AC(), src = actx.createMediaElementSource(video), dst = actx.createMediaStreamDestination();
    src.connect(actx.destination); // ふだんの再生音もそのまま聞こえるように
    src.connect(dst);
    AUD = { actx, dst };
  } catch(e){ AUD = null; }
  return AUD;
}
const canAudio = () => !!(video.captureStream || video.mozCaptureStream || window.AudioContext || window.webkitAudioContext);
$('#exportBtn').onclick = () => {
  if (!S.src){ toast('先に動画を開いてください'); return; }
  if (!pickMime() || !HTMLCanvasElement.prototype.captureStream){ toast('このブラウザは動画の書き出しに対応していません。パソコンのChromeかSafariで試してください', 4500); return; }
  $('#exAudioWrap').hidden = !canAudio();
  S.src.pause(); clearHold(); $('#exModal').hidden = false;
};
$('#exCancel').onclick = () => { $('#exModal').hidden = true; };
$('#exStart').onclick = () => { if ($('#exAudio').checked && !(video.captureStream || video.mozCaptureStream)){ const g = audioGraph(); if (g) g.actx.resume(); } startExport(); };
$('#exStop').onclick = () => { if (S.exporting) finishExport(true); else { $('#exProg').hidden = true; S.exportBlob = null; } };
$('#exSave').onclick = saveExport;
$('#exShare').onclick = () => { const X = S.exportBlob; if (X) saveFile(X.name, X.blob, { share:true }); };

function wrapLines(c, text, maxW){
  const out = [];
  for (const para of text.split('\n')){
    let line = '';
    for (const ch of para){ if (c.measureText(line + ch).width > maxW && line){ out.push(line); line = ch; } else line += ch; }
    out.push(line);
  }
  return out;
}
const CAP_BG = { dark:['rgba(8,11,10,.82)','#e8eee9','#ffd23f'], white:['rgba(255,255,255,.93)','#111','#111'], yellow:['#ffd23f','#111','#111'], pink:['#ff2d78','#fff','#fff'], red:['#e5392f','#fff','#fff'], blue:['#1f7fd6','#fff','#fff'], none:[null,'#fff',null] };
// 書き出し中、動画が実際に動き出すまで（フリーズ明け・カットの飛び先・読み込みの詰まり）は録画を一時停止して、
// 止まったコマが余分に入って動画がカクつくのを防ぐ
function recWait(){ const E = S.exporting; if (!E) return; E.wait = true; E.waitT = S.src.t; try { if (E.rec.state === 'recording') E.rec.pause(); } catch(e){} }
function recCheck(held){
  const E = S.exporting, now = performance.now(), t = S.src.t;
  if (held){ E.wait = false; E.lastT = t; E.lastAdv = now; try { if (E.rec.state === 'paused') E.rec.resume(); } catch(e){} return; }
  if (t !== E.lastT){
    const moved = !E.wait || Math.abs(t - E.waitT) > 1e-3;
    E.lastT = t; E.lastAdv = now;
    if (moved){ E.wait = false; try { if (E.rec.state === 'paused') E.rec.resume(); } catch(e){} }
  } else if (!video.paused && now - (E.lastAdv || now) > 90){ try { if (E.rec.state === 'recording') E.rec.pause(); } catch(e){} }
}
function exportTick(){
  const E = S.exporting, c = E.ctx, W = E.cv.width, H = E.cv.height, k = W / stage.getBoundingClientRect().width;
  c.drawImage(video, 0, 0, W, H);
  const held = !!S.holdId;
  recCheck(held);
  c.drawImage(ink, 0, 0, W, H);
  const cap = $('#caption');
  if (!cap.hidden && cap.textContent){
    const sr = stage.getBoundingClientRect(), cr = cap.getBoundingClientRect(), cs = getComputedStyle(cap);
    const fs = parseFloat(cs.fontSize) * k, pad = fs * .55, [bg, fg, bar] = CAP_BG[cap.dataset.bg] || CAP_BG.dark;
    c.font = `700 ${fs}px "Noto Sans JP", sans-serif`; c.textBaseline = 'middle'; c.textAlign = 'left';
    const lines = wrapLines(c, cap.textContent, cr.width * k - pad * 2.2), lh = fs * 1.45;
    const bw = Math.max(...lines.map(l => c.measureText(l).width)) + pad * 2.2, bh = lines.length * lh + pad * 1.1;
    const cx = (cr.left + cr.width / 2 - sr.left) * k, cy = (cr.top + cr.height / 2 - sr.top) * k, x = cx - bw / 2, y = cy - bh / 2;
    if (bg){ c.fillStyle = bg; c.beginPath(); if (c.roundRect) c.roundRect(x, y, bw, bh, 6 * k); else c.rect(x, y, bw, bh); c.fill(); }
    if (bar){ c.fillStyle = bar; c.fillRect(x, y, 4 * k, bh); }
    if (!bg){ c.lineWidth = fs * .22; c.strokeStyle = 'rgba(0,0,0,.85)'; lines.forEach((l, i) => c.strokeText(l, x + pad * 1.2, y + pad * .55 + lh * (i + .5))); }
    c.fillStyle = fg; lines.forEach((l, i) => c.fillText(l, x + pad * 1.2, y + pad * .55 + lh * (i + .5)));
  }
  const d = S.src.dur || 1;
  $('#exBar').style.width = (clamp(S.src.t / d, 0, 1) * 100).toFixed(1) + '%';
  $('#exNote').textContent = `${fmt(S.src.t)} / ${fmt(d)}　${held ? '一時停止の場面を録画中' : '再生しながら録画中'}`;
  const atEnd = S.clips ? (curCi() === S.clips.length - 1 && S.src.t >= S.clips[S.clips.length-1][1] - .06) : S.src.t >= d - .06;
  if (!held && (video.ended || (video.paused && atEnd))) finishExport(false);
}
async function startExport(){
  $('#exModal').hidden = true;
  const mm = pickMime(); if (!mm) return;
  const vw = video.videoWidth, vh = video.videoHeight, sc = Math.min(1, exRes / Math.min(vw, vh));
  const cv = document.createElement('canvas'); cv.width = Math.round(vw * sc / 2) * 2; cv.height = Math.round(vh * sc / 2) * 2;
  const stream = cv.captureStream(30);
  if ($('#exAudio').checked && !$('#exAudioWrap').hidden){
    let ok = false;
    if (video.captureStream || video.mozCaptureStream){
      try { const vs = video.captureStream ? video.captureStream() : video.mozCaptureStream(); vs.getAudioTracks().forEach(t => { stream.addTrack(t); ok = true; }); } catch(e){}
    }
    if (!ok){
      const g = audioGraph();
      if (g){ try { await g.actx.resume(); } catch(e){} g.dst.stream.getAudioTracks().forEach(t => stream.addTrack(t.clone())); }
    }
  }
  let rec;
  try { rec = new MediaRecorder(stream, { mimeType:mm.mime, videoBitsPerSecond:16000000 }); }
  catch(e){ try { rec = new MediaRecorder(stream); } catch(e2){ toast('このブラウザでは書き出せませんでした'); return; } }
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  S.prevTool = S.tool; { const la = S.lastAdd; setTool('arrow'); S.lastAdd = la; }
  S.exportBlob = null; S.exporting = { cv, ctx:cv.getContext('2d'), rec, chunks, mm, holdSec:exHoldSec, cancelled:false };
  $('#exTitle').textContent = '書き出し中…'; $('#exBar').style.width = '0%'; $('#exStop').textContent = '中止'; $('#exSave').hidden = true; $('#exShare').hidden = true; $('#exHint').hidden = true; $('#exProg').hidden = false;
  S.src.rate = 1; S.enter.clear();
  await new Promise(res => { const fin = () => { video.removeEventListener('seeked', fin); res(); }; video.addEventListener('seeked', fin); setTimeout(fin, 1500); seek(S.clips ? S.clips[0][0] : 0); S.ci = 0; });
  if (!S.exporting) return;
  exportTick();
  rec.start(1000);
  const t00 = S.clips ? S.clips[0][0] : 0, first = S.moments.find(m => Math.abs(m.t - t00) < 0.05 && m.pause !== 0);
  if (first){ S.skipId = null; hold(first); } else S.src.play();
}
function finishExport(cancel){
  const E = S.exporting; if (!E) return;
  S.exporting = null; E.cancelled = cancel;
  S.src.pause(); clearHold(); S.src.rate = +$('#speed').value; setTool(S.prevTool || 'arrow');
  E.rec.onstop = () => {
    E.rec.stream.getTracks().forEach(t => t.stop());
    if (E.cancelled){ $('#exProg').hidden = true; toast('書き出しを中止しました'); return; }
    const blob = new Blob(E.chunks, { type:E.mm.mime.split(';')[0] });
    const base = (S.fileName || 'video').replace(/\.[^.]+$/, '');
    S.exportBlob = { blob, name:`${base}_K.${E.mm.ext}` };
    $('#exTitle').textContent = 'できました'; $('#exBar').style.width = '100%';
    $('#exNote').textContent = `${S.exportBlob.name}（${(blob.size / 1048576).toFixed(1)}MB）`;
    $('#exStop').textContent = '閉じる'; $('#exSave').hidden = false; $('#exHint').hidden = !IS_IOS; $('#exShare').hidden = !(IS_IOS && IN_FRAME && navigator.share);
    $('#exHint').innerHTML = IN_FRAME
      ? '「保存する」で<b>「ファイル」アプリ</b>のダウンロードに入ります。写真に入れるには、ファイルアプリでその動画を開き、共有ボタン →<b>「ビデオを保存」</b>。'
      : '「保存する」を押して、出てきたメニューで<b>「ビデオを保存」</b>を選ぶと写真アプリに入ります。';
  };
  try { E.rec.state !== 'inactive' ? E.rec.stop() : E.rec.onstop(); } catch(e){ E.rec.onstop(); }
}
async function saveExport(){
  const X = S.exportBlob; if (!X) return;
  await saveFile(X.name, X.blob);
}
/* ---------- app (PWA) ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:'){
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'activated' && navigator.serviceWorker.controller) toast('アプリを新しいバージョンにしました'); });
    });
  }).catch(() => {});
}
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch(e){}

renderList();
$('#play').innerHTML = ICON_PLAY;
requestAnimationFrame(loop);
})();
