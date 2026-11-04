'use strict';
/* Photobook Studio — editor UI */
(function () {
  const api = window.api;
  const clamp = PB.clamp, uid = PB.uid;
  const $ = (s, r) => (r || document).querySelector(s);

  // ---------- tiny DOM helper ----------
  function h(tag, attrs) {
    const el = document.createElement(tag);
    for (const k in (attrs || {})) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
      else if (k === 'draggable') el.setAttribute('draggable', 'true');
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach((x) => add(el, x));
    else el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }

  const ICON = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    open: '<path d="M4 19l3-9h15l-3 9z"/><path d="M3 19V6a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v2"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    sparkle: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    export: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    shuffle: '<path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    minus: '<path d="M5 12h14"/>',
    guides: '<rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="3 3"/><path d="M12 4v16"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    up: '<path d="M5 15l7-7 7 7"/>',
    down: '<path d="M5 9l7 7 7-7"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>'
  };
  const ic = (n) => h('span', { html: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + ICON[n] + '</svg>', style: { display: 'inline-flex' } });

  function btn(label, icon, onclick, cls, title) {
    const b = h('button', { type: 'button', class: 'btn ' + (cls || ''), onclick: onclick, title: title || null, 'aria-label': label || title || 'Button' });
    if (icon) b.appendChild(ic(icon));
    if (label && !/\bicon\b/.test(cls || '')) b.appendChild(document.createTextNode(label));
    return b;
  }

  // ---------- state ----------
  let P = null;
  let filePath = null;
  let dirty = false;
  const U = { sel: 0, items: new Set(), psel: new Set(), plast: null, zoom: 1, crop: false, filter: 'all', sort: 'time', mode: 'design', safe: false, tab: 'layouts' };
  const HST = { undo: [], redo: [], lastKey: null, lastT: 0 };
  let LIC = { licensed: false, email: '', id: '' };
  let CFG = { price: '', buyUrl: '', supportEmail: '', productName: 'Photobook Studio' };
  let stageMeta = { W: 1, H: 1, ppi: 10 };
  const elMap = new Map();
  let gesture = null;

  const curSpread = () => P.spreads[U.sel];
  const selItems = () => curSpread().items.filter((i) => U.items.has(i.id));

  function setDirty(v) {
    dirty = v !== false;
    if (api && api.setDirty) api.setDirty(dirty);
    updateTop();
  }
  const snap = () => JSON.stringify(P);
  function checkpoint(key) {
    const now = Date.now();
    if (key && key === HST.lastKey && now - HST.lastT < 900) { HST.lastT = now; setDirty(); return; }
    HST.undo.push(snap());
    if (HST.undo.length > 80) HST.undo.shift();
    HST.redo = [];
    HST.lastKey = key || null; HST.lastT = now;
    setDirty();
  }
  function restore(json) {
    P = JSON.parse(json);
    U.sel = clamp(U.sel, 0, P.spreads.length - 1);
    pruneSel();
    setDirty();
    refresh('sfipt');
  }
  function undo() { if (!HST.undo.length) return; HST.redo.push(snap()); restore(HST.undo.pop()); HST.lastKey = null; }
  function redo() { if (!HST.redo.length) return; HST.undo.push(snap()); restore(HST.redo.pop()); HST.lastKey = null; }
  function pruneSel() {
    const ids = new Set(curSpread().items.map((i) => i.id));
    U.items.forEach((id) => { if (!ids.has(id)) U.items.delete(id); });
    if (!U.items.size) U.crop = false;
  }

  function refresh(parts) {
    if (!P) return;
    if (parts.indexOf('t') >= 0) updateTop();
    if (parts.indexOf('p') >= 0) renderPhotos();
    if (parts.indexOf('s') >= 0) { layoutStage(); syncStage(); }
    if (parts.indexOf('f') >= 0) renderFilm();
    if (parts.indexOf('i') >= 0) renderInspector();
    if (parts.indexOf('b') >= 0) renderToolbar();
  }
  let filmTimer = null;
  function touchFilm() {
    clearTimeout(filmTimer);
    filmTimer = setTimeout(renderFilm, 140);
  }

  function toast(msg, actionLabel, action, ms) {
    const t = h('div', { class: 't' }, h('span', {}, msg));
    if (actionLabel) t.appendChild(h('button', { type: 'button', onclick: () => { action(); t.remove(); } }, actionLabel));
    const root = $('#toast');
    while (root.children.length >= 2) root.firstChild.remove();
    root.appendChild(t);
    setTimeout(() => t.remove(), ms || 4200);
  }

  // ---------- modal ----------
  function modal(o) {
    const root = $('#modalRoot');
    const close = () => { scrim.remove(); if (o.onClose) o.onClose(); };
    const foot = h('footer', {});
    (o.buttons || []).forEach((b) => foot.appendChild(btn(b.label, null, () => { if (b.onclick) b.onclick(close); else close(); }, b.primary ? 'primary' : '')));
    const box = h('div', { class: 'modal' + (o.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title },
      h('header', {}, o.title), h('div', { class: 'mb' }, o.body), (o.buttons && o.buttons.length) ? foot : null);
    const scrim = h('div', { class: 'scrim' }, box);
    if (!o.persist) scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
    root.appendChild(scrim);
    const first = box.querySelector('input,select,textarea');
    if (first) first.focus();
    return { close: close, el: box };
  }
  const fld = (label, input) => h('div', { class: 'fld' }, h('label', {}, label), input);

  // ---------- recents ----------
  function recents() { try { return JSON.parse(localStorage.getItem('pb.recent') || '[]'); } catch (e) { return []; } }
  function addRecent(path, name) {
    if (!path) return;
    const list = recents().filter((r) => r.path !== path);
    list.unshift({ path: path, name: name, t: Date.now() });
    try { localStorage.setItem('pb.recent', JSON.stringify(list.slice(0, 8))); } catch (e) { /* ignore */ }
  }

  // ---------- top bar ----------
  function buildTop() {
    const f = $('#grpFile'); f.innerHTML = '';
    f.append(btn('New', 'file', () => newProjectDialog(), '', 'New project'),
      btn('Open', 'open', () => openProject(), '', 'Open project'),
      btn('Save', 'save', () => saveProject(false), '', 'Save (Ctrl+S)'));
    const u = $('#grpUndo'); u.innerHTML = '';
    u.append(btn('Undo', 'undo', undo, 'icon', 'Undo (Ctrl+Z)'), btn('Redo', 'redo', redo, 'icon', 'Redo (Ctrl+Y)'));
    u.children[0].id = 'btnUndo'; u.children[1].id = 'btnRedo';
    const t = $('#modeTabs'); t.innerHTML = '';
    [['design', 'Design'], ['preview', 'Preview'], ['client', 'Client view']].forEach((m) => {
      t.appendChild(h('button', { type: 'button', 'aria-current': String(U.mode === m[0]), onclick: () => setMode(m[0]) }, m[1]));
    });
    const m = $('#grpMain'); m.innerHTML = '';
    m.append(btn('Trial', 'key', licenseDialog, 'sm', 'License'),
      btn('Auto design', 'sparkle', autoDesignDialog, 'primary', 'Design the whole album automatically'),
      btn('Export', 'export', exportDialog, '', 'Export print files'),
      btn('', 'help', helpDialog, 'icon', 'Keyboard shortcuts'));
    m.children[0].id = 'btnLic'; m.children[2].id = 'btnExport';
  }
  function updateTop() {
    if (!P) return;
    $('#projName').textContent = P.name + (dirty ? ' •' : '');
    const nSp = P.spreads.length - 1;
    $('#projMeta').textContent = P.pageW + ' × ' + P.pageH + ' in pages · ' + nSp + ' spread' + (nSp === 1 ? '' : 's') + ' · ' + P.photoOrder.length + ' photos';
    document.title = P.name + (dirty ? ' •' : '') + ' — Photobook Studio';
    const ex = $('#btnExport'), lb = $('#btnLic');
    if (ex) {
      ex.classList.toggle('locked', !LIC.licensed);
      ex.title = LIC.licensed ? 'Export print files' : 'Export is locked in the trial. Click to unlock.';
      const sv = ex.querySelector('svg');
      if (sv) sv.innerHTML = LIC.licensed ? ICON.export : ICON.lock;
    }
    if (lb) {
      lb.classList.toggle('lic-on', LIC.licensed);
      const txt = LIC.licensed ? 'Licensed' : 'Trial';
      lb.lastChild.nodeType === 3 ? (lb.lastChild.nodeValue = txt) : lb.appendChild(document.createTextNode(txt));
      lb.title = LIC.licensed ? 'Licensed to ' + LIC.email : 'Trial version: click to buy or enter a license key';
    }
    const un = $('#btnUndo'), re = $('#btnRedo');
    if (un) un.disabled = !HST.undo.length;
    if (re) re.disabled = !HST.redo.length;
    Array.from($('#modeTabs').children).forEach((b, i) => b.setAttribute('aria-current', String(['design', 'preview', 'client'][i] === U.mode)));
  }

  // ---------- project lifecycle ----------
  function loadProject(proj, path) {
    P = proj; filePath = path || null;
    HST.undo = []; HST.redo = []; HST.lastKey = null;
    U.sel = 0; U.items.clear(); U.psel.clear(); U.crop = false; U.zoom = 1;
    elMap.clear(); $('#stage').innerHTML = '';
    setDirty(false);
    refresh('tpsfib');
  }

  function newProjectDialog(first) {
    const name = h('input', { type: 'text', value: 'My photobook' });
    const sel = h('select', {});
    PB.sizes.forEach((s, i) => sel.appendChild(h('option', { value: i, selected: i === 2 }, s[0])));
    const w = h('input', { type: 'number', min: 4, max: 24, step: 0.5, value: 12 });
    const hh = h('input', { type: 'number', min: 4, max: 24, step: 0.5, value: 12 });
    const m = h('input', { type: 'number', min: 0, max: 3, step: 0.05, value: 0.5 });
    const g = h('input', { type: 'number', min: 0, max: 2, step: 0.05, value: 0.2 });
    const custom = h('div', { class: 'two', style: { display: 'none' } }, fld('Page width (in)', w), fld('Page height (in)', hh));
    sel.addEventListener('change', () => {
      const s = PB.sizes[sel.value];
      if (s[1]) { w.value = s[1]; hh.value = s[2]; }
      custom.style.display = s[1] ? 'none' : 'grid';
    });
    const body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      fld('Album name', name), fld('Page size (a spread is two pages wide)', sel), custom,
      h('div', { class: 'two' }, fld('Margin (in)', m), fld('Gap between photos (in)', g)),
      h('div', { class: 'hint' }, 'Check your print lab’s album size list and use the same page size here. You can change these later in Album settings.'));
    modal({
      title: 'New album', body: body,
      buttons: [{ label: 'Cancel' }, {
        label: 'Create album', primary: true, onclick: (close) => {
          const proj = PB.newProject({ name: name.value.trim() || 'My photobook', pageW: parseFloat(w.value) || 12, pageH: parseFloat(hh.value) || 12, margin: parseFloat(m.value), gap: parseFloat(g.value) });
          close();
          loadProject(proj, null);
          toast('Album created. Import photos to begin.', 'Import', importPhotos);
        }
      }]
    });
  }

  function albumSettingsDialog() {
    const name = h('input', { type: 'text', value: P.name });
    const w = h('input', { type: 'number', min: 4, max: 24, step: 0.5, value: P.pageW });
    const hh = h('input', { type: 'number', min: 4, max: 24, step: 0.5, value: P.pageH });
    const m = h('input', { type: 'number', min: 0, max: 3, step: 0.05, value: P.margin });
    const g = h('input', { type: 'number', min: 0, max: 2, step: 0.05, value: P.gap });
    modal({
      title: 'Album settings',
      body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        fld('Album name', name),
        h('div', { class: 'two' }, fld('Page width (in)', w), fld('Page height (in)', hh)),
        h('div', { class: 'two' }, fld('Default margin (in)', m), fld('Default gap (in)', g)),
        h('div', { class: 'hint' }, 'Changing the page size keeps your layouts proportional. Check photos still crop the way you want.')),
      buttons: [{ label: 'Cancel' }, {
        label: 'Apply', primary: true, onclick: (close) => {
          checkpoint();
          P.name = name.value.trim() || P.name; P.pageW = parseFloat(w.value) || P.pageW; P.pageH = parseFloat(hh.value) || P.pageH;
          P.margin = parseFloat(m.value); P.gap = parseFloat(g.value);
          close(); refresh('tsfib');
        }
      }]
    });
  }

  async function saveProject(as) {
    if (!P) return;
    try {
      const target = await api.saveProject(as ? null : filePath, JSON.stringify(P), P.name);
      if (!target) return;
      filePath = target; setDirty(false); addRecent(target, P.name);
      toast('Saved');
    } catch (e) { toast('Could not save: ' + e.message); }
  }

  async function openProject(path) {
    try {
      const r = await api.openProject(path || null);
      if (!r) return;
      const proj = JSON.parse(r.data);
      if (!proj.spreads || !proj.photos) throw new Error('This is not a Photobook Studio project.');
      loadProject(proj, r.path);
      addRecent(r.path, proj.name);
      await verifyPhotos();
    } catch (e) { toast('Could not open: ' + e.message, null, null, 6000); }
  }

  async function startScreen() {
    let auto = null;
    try { auto = await api.getAutosave(); } catch (e) { /* none */ }
    const rec = recents();
    const body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      h('div', { class: 'hint', style: { fontSize: '13px' } }, 'Free trial: design everything, then unlock exporting when you’re ready. Import your edited photos, let Auto design lay out the album, then fine-tune every spread and export print-ready files for your lab.'),
      h('div', { class: 'btns' }, btn('New album', 'file', () => { m.close(); newProjectDialog(true); }, 'primary'), btn('Open project…', 'open', () => { m.close(); openProject(); })),
      auto ? h('div', {}, h('div', { class: 'hint', style: { marginBottom: '6px' } }, 'Unsaved work found (' + new Date(auto.time).toLocaleString() + ')'),
        btn('Recover autosaved album', 'undo', async () => { m.close(); try { loadProject(JSON.parse(auto.data), null); setDirty(true); await verifyPhotos(); } catch (e) { toast('Could not recover.'); } })) : null,
      rec.length ? h('div', {}, h('div', { class: 'hint', style: { marginBottom: '6px' } }, 'Recent'),
        h('div', { class: 'recent' }, rec.map((r) => h('button', { type: 'button', onclick: () => { m.close(); openProject(r.path); } }, h('span', {}, r.name), h('small', {}, r.path))))) : null);
    const m = modal({ title: 'Welcome to Photobook Studio', body: body, buttons: [] });
  }

  // ---------- photo ingest ----------
  async function makeCache(info) {
    const img = await PB.loadImage(info.url);
    const w = img.naturalWidth, hgt = img.naturalHeight;
    const mk = (max, q) => new Promise((res, rej) => {
      const sc = Math.min(1, max / Math.max(w, hgt));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * sc)); c.height = Math.max(1, Math.round(hgt * sc));
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.imageSmoothingQuality = 'high';
      x.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => b ? b.arrayBuffer().then(res, rej) : rej(new Error('encode')), 'image/jpeg', q);
    });
    await api.cacheWrite(info.id, 't', await mk(420, 0.82));
    await api.cacheWrite(info.id, 'p', await mk(2000, 0.9));
    await api.cacheMeta(info.id, { w: w, h: hgt, time: info.time });
    img.src = '';
    return { w: w, h: hgt };
  }

  async function pool(list, n, fn) {
    let i = 0;
    const workers = Array.from({ length: n }, async () => {
      while (i < list.length) { const k = i++; await fn(list[k], k); }
    });
    await Promise.all(workers);
  }

  function progressModal(title) {
    const bar = h('i', {});
    const label = h('div', { class: 'hint' }, 'Starting…');
    const m = modal({ title: title, body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, h('div', { class: 'bar' }, bar), label), buttons: [], persist: true });
    return { set: (f, t) => { bar.style.width = Math.round(f * 100) + '%'; label.textContent = t; }, close: m.close };
  }

  async function importPaths(paths) {
    if (!paths || !paths.length || !P) return;
    const infos = (await api.stat(paths.map((p) => ({ path: p })))).filter((i) => i.ok);
    const known = new Set(P.photoOrder);
    const fresh = infos.filter((i) => !known.has(i.id));
    if (!fresh.length) { toast('Those photos are already in the album.'); return; }
    const pm = progressModal('Importing ' + fresh.length + ' photos');
    let done = 0, failed = 0;
    const added = [];
    await pool(fresh, 2, async (info) => {
      try {
        let meta = info.meta;
        if (!info.has || !meta) meta = await makeCache(info);
        P.photos[info.id] = {
          id: info.id, path: info.path, name: info.name, w: meta.w, h: meta.h, time: info.time,
          url: info.url, thumb: info.thumbUrl, proxy: info.proxyUrl, rating: 0,
          flags: { pano: meta.w / meta.h >= 2.2 }
        };
        added.push(info.id);
      } catch (e) { failed++; }
      done++;
      pm.set(done / fresh.length, done + ' of ' + fresh.length + ' · ' + info.name);
    });
    fresh.forEach((i) => { if (P.photos[i.id]) P.photoOrder.push(i.id); });
    pm.close();
    setDirty();
    refresh('tp');
    toast('Imported ' + added.length + ' photo' + (added.length === 1 ? '' : 's') + (failed ? ' (' + failed + ' could not be read)' : ''),
      added.length ? 'Auto design' : null, autoDesignDialog, 6000);
  }
  async function importPhotos() { importPaths(await api.pickPhotos()); }
  async function importFolder() { importPaths(await api.pickFolder()); }

  async function verifyPhotos() {
    const ids = P.photoOrder.slice();
    if (!ids.length) { refresh('sfipt'); return; }
    const res = await api.stat(ids.map((id) => ({ id: id, path: P.photos[id].path })));
    let missing = 0;
    const pm = progressModal('Checking photos');
    let n = 0;
    await pool(res, 2, async (r) => {
      const ph = P.photos[r.id];
      if (!ph) return;
      if (!r.ok) { ph.missing = true; missing++; } else {
        ph.missing = false; ph.url = r.url; ph.thumb = r.thumbUrl; ph.proxy = r.proxyUrl;
        if (!r.has) { try { await makeCache(r); } catch (e) { ph.missing = true; missing++; } }
      }
      n++; pm.set(n / res.length, n + ' of ' + res.length);
    });
    pm.close();
    refresh('sfipt');
    if (missing) toast(missing + ' photo' + (missing === 1 ? ' is' : 's are') + ' missing from their original location.', 'Locate…', relink, 9000);
  }

  async function relink() {
    const map = await api.pickRelink();
    const names = Object.keys(map || {});
    if (!names.length) return;
    let fixed = 0;
    const items = [];
    P.photoOrder.forEach((id) => {
      const ph = P.photos[id];
      if (ph.missing && map[ph.name.toLowerCase()]) { ph.path = map[ph.name.toLowerCase()]; items.push({ id: id, path: ph.path }); fixed++; }
    });
    checkpoint();
    await verifyPhotos();
    toast('Relinked ' + fixed + ' photo' + (fixed === 1 ? '' : 's'));
  }

  // ---------- photo panel ----------
  function usedCounts() {
    const m = {};
    P.spreads.forEach((s) => s.items.forEach((i) => { if (i.type === 'photo' && i.photoId) m[i.photoId] = (m[i.photoId] || 0) + 1; }));
    return m;
  }
  function visiblePhotos() {
    const used = usedCounts();
    let ids = P.photoOrder.slice();
    const f = U.filter;
    ids = ids.filter((id) => {
      const p = P.photos[id];
      if (f === 'unused') return !used[id];
      if (f === 'used') return !!used[id];
      if (f === 'starred') return (p.rating || 0) >= 3;
      if (f === 'main') return p.flags && p.flags.main;
      if (f === 'cover') return p.flags && p.flags.cover;
      if (f === 'pano') return p.flags && p.flags.pano;
      return true;
    });
    const cmp = {
      time: (a, b) => (P.photos[a].time - P.photos[b].time) || P.photos[a].name.localeCompare(P.photos[b].name, undefined, { numeric: true }),
      name: (a, b) => P.photos[a].name.localeCompare(P.photos[b].name, undefined, { numeric: true }),
      rating: (a, b) => (P.photos[b].rating || 0) - (P.photos[a].rating || 0)
    }[U.sort];
    return ids.sort(cmp);
  }

  function renderPhotos() {
    const box = $('#photos');
    const oldGrid = $('#photoGrid');
    const st = oldGrid ? oldGrid.scrollTop : 0;
    box.innerHTML = '';
    if (!P) return;
    const used = usedCounts();
    const unused = P.photoOrder.filter((id) => !used[id]).length;
    const fSel = h('select', { 'aria-label': 'Filter photos', onchange: (e) => { U.filter = e.target.value; renderPhotos(); } },
      [['all', 'All photos'], ['unused', 'Unused'], ['used', 'Used'], ['starred', '★ 3 and up'], ['main', 'Main images'], ['cover', 'Cover photos'], ['pano', 'Panoramic']].map((o) => h('option', { value: o[0], selected: U.filter === o[0] }, o[1])));
    const sSel = h('select', { 'aria-label': 'Sort photos', onchange: (e) => { U.sort = e.target.value; renderPhotos(); } },
      [['time', 'By time taken'], ['name', 'By name'], ['rating', 'By rating']].map((o) => h('option', { value: o[0], selected: U.sort === o[0] }, o[1])));
    box.appendChild(h('div', { class: 'ph-head' },
      h('div', { class: 'top' }, h('h2', {}, 'Photos'), h('span', { class: 'hint' }, unused + ' unused of ' + P.photoOrder.length)),
      h('div', { class: 'btns' }, btn('Add photos', 'image', importPhotos, 'sm primary'), btn('Add folder', 'folder', importFolder, 'sm')),
      h('div', { class: 'ph-ctrl' }, fSel, sSel)));

    const ids = visiblePhotos();
    const grid = h('div', { id: 'photoGrid' });
    if (!P.photoOrder.length) {
      grid.appendChild(h('div', { class: 'ph-empty' }, 'No photos yet.', h('br'), 'Add photos or a whole folder, or drag image files here.'));
    } else if (!ids.length) {
      grid.appendChild(h('div', { class: 'ph-empty' }, 'No photos match this filter.'));
    }
    ids.forEach((id) => {
      const p = P.photos[id];
      const t = h('div', {
        class: 'tile' + (U.psel.has(id) ? ' sel' : '') + (p.missing ? ' missing' : ''), draggable: true, title: p.name + (p.missing ? ' (missing)' : ''),
        onclick: (e) => photoClick(e, id, ids),
        ondblclick: () => placeSmart(id),
        ondragstart: (e) => {
          const drag = U.psel.has(id) ? Array.from(U.psel) : [id];
          if (!U.psel.has(id)) { U.psel.clear(); U.psel.add(id); }
          e.dataTransfer.setData('text/pb', JSON.stringify(drag)); e.dataTransfer.effectAllowed = 'copy';
        }
      }, h('img', { src: p.thumb, alt: p.name, loading: 'lazy', draggable: false }));
      const fl = p.flags || {};
      const flags = [fl.main ? 'M' : null, fl.cover ? 'C' : null, fl.pano ? 'P' : null].filter(Boolean);
      if (flags.length) t.appendChild(h('div', { class: 'flags' }, flags.map((f) => h('b', {}, f))));
      if (used[id]) t.appendChild(h('div', { class: 'used', title: 'Used ' + used[id] + '×' }, h('span', { html: '<svg class="i" viewBox="0 0 24 24">' + ICON.check + '</svg>' }), used[id] > 1 ? String(used[id]) : ''));
      if (p.rating) t.appendChild(h('div', { class: 'stars' }, '★'.repeat(p.rating)));
      if (p.missing) t.appendChild(h('div', { class: 'miss' }, 'Missing'));
      grid.appendChild(t);
    });
    box.appendChild(grid);
    grid.scrollTop = st;

    if (U.psel.size) {
      const sel = Array.from(U.psel);
      const r0 = P.photos[sel[0]].rating || 0;
      const stars = h('div', { class: 'line' }, [1, 2, 3, 4, 5].map((n) => h('button', { type: 'button', class: 'star-btn' + (n <= r0 ? ' on' : ''), 'aria-label': n + ' star' + (n > 1 ? 's' : ''), onclick: () => setRating(sel, n === r0 ? 0 : n) }, '★')));
      const flag = (key, label) => {
        const on = sel.every((id) => P.photos[id].flags && P.photos[id].flags[key]);
        return btn(label, null, () => toggleFlag(sel, key, !on), 'sm' + (on ? ' on' : ''));
      };
      box.appendChild(h('div', { class: 'ph-sel' },
        h('div', { class: 'hint' }, sel.length + ' selected' + (sel.length === 1 ? ' · ' + P.photos[sel[0]].name : '')),
        stars,
        h('div', { class: 'line' }, flag('main', 'Main'), flag('cover', 'Cover'), flag('pano', 'Panoramic')),
        h('div', { class: 'line' }, btn('Make spread', 'sparkle', makeSpreadFromSelection, 'sm primary', 'Create a new spread from the selected photos'), btn('Remove', 'trash', removePhotos, 'sm danger', 'Remove from album'))));
    } else {
      box.appendChild(h('div', { class: 'ph-sel' }, h('div', { class: 'hint' }, 'Drag photos onto the spread, or double-click to fill the next empty frame. Ctrl/Shift-click to select several.')));
    }
  }

  function photoClick(e, id, ids) {
    if (e.shiftKey && U.plast && ids.indexOf(U.plast) >= 0) {
      const a = ids.indexOf(U.plast), b = ids.indexOf(id);
      if (!(e.ctrlKey || e.metaKey)) U.psel.clear();
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) U.psel.add(ids[i]);
    } else if (e.ctrlKey || e.metaKey) {
      if (U.psel.has(id)) U.psel.delete(id); else U.psel.add(id);
    } else { U.psel.clear(); U.psel.add(id); }
    U.plast = id;
    renderPhotos();
  }
  function setRating(ids, n) { checkpoint(); ids.forEach((id) => { P.photos[id].rating = n; }); refresh('p'); }
  function toggleFlag(ids, key, on) {
    checkpoint();
    ids.forEach((id) => {
      const f = P.photos[id].flags = P.photos[id].flags || {};
      if (on) { if (key === 'cover') P.photoOrder.forEach((o) => { if (P.photos[o].flags) P.photos[o].flags.cover = false; }); f[key] = true; } else f[key] = false;
    });
    refresh('p');
  }
  function removePhotos() {
    const ids = Array.from(U.psel);
    if (!ids.length) return;
    checkpoint();
    const set = new Set(ids);
    P.spreads.forEach((s) => s.items.forEach((i) => { if (i.type === 'photo' && set.has(i.photoId)) i.photoId = null; }));
    ids.forEach((id) => delete P.photos[id]);
    P.photoOrder = P.photoOrder.filter((id) => !set.has(id));
    U.psel.clear();
    refresh('psfi');
    touchFilm();
  }
  function placePhotoInto(item, photoId) {
    item.photoId = photoId; item.zoom = 1; item.cx = 0.5; item.cy = 0.5;
  }
  function placeSmart(id) {
    const sp = curSpread();
    let target = selItems().find((i) => i.type === 'photo');
    if (!target) target = sp.items.find((i) => i.type === 'photo' && !i.photoId);
    if (!target) { toast('No empty frame on this spread. Drag the photo onto the spread, or use Make spread.'); return; }
    checkpoint();
    placePhotoInto(target, id);
    sp.lm = sp.lm; // keep
    refresh('sipb'); touchFilm();
  }
  function makeSpreadFromSelection() {
    const ids = Array.from(U.psel);
    if (!ids.length) return;
    checkpoint();
    const sp = PB.newSpread('spread', curSpread().bg);
    PB.relayout(P, sp, Date.now(), ids.slice(0, 8));
    const at = Math.max(1, U.sel + 1);
    P.spreads.splice(at, 0, sp);
    U.sel = at; U.items.clear();
    refresh('sfipt');
  }

  // ---------- stage ----------
  function layoutStage() {
    const wrap = $('#stageWrap'), stage = $('#stage');
    const sp = curSpread(), d = PB.dims(P, sp);
    const aw = Math.max(100, wrap.clientWidth - 62), ah = Math.max(100, wrap.clientHeight - 62);
    const fit = Math.min(aw / d.W, ah / d.H);
    const ppi = Math.max(3, fit * U.zoom);
    stage.style.width = d.W * ppi + 'px'; stage.style.height = d.H * ppi + 'px';
    stage.style.setProperty('--ppi', ppi + 'px');
    stageMeta = { W: d.W, H: d.H, ppi: ppi };
  }

  function updateItemEl(el, it, sp, o) {
    const d = PB.dims(P, sp);
    const s = el.style;
    s.left = it.x * 100 + '%'; s.top = it.y * 100 + '%'; s.width = it.w * 100 + '%'; s.height = it.h * 100 + '%';
    s.opacity = it.opacity == null ? 1 : it.opacity;
    if (o.thumb) s.cursor = 'pointer';
    if (el._type !== it.type) {
      el.innerHTML = ''; el._type = it.type; el._hs = null;
      if (it.type === 'photo') {
        el._img = h('img', { class: 'pimg', draggable: false, alt: '' });
        el._clip = h('div', { class: 'clip' }, el._img);
        el._ph = h('div', { class: 'ph' });
        el._bd = h('div', { class: 'bd' });
        el.append(el._clip, el._ph, el._bd);
      } else if (it.type === 'text') {
        el._txt = h('div', { class: 'txt' }); el.appendChild(el._txt);
      } else {
        el._lg = h('img', { class: 'lg', alt: '', draggable: false }); el.appendChild(el._lg);
      }
    }
    el.classList.toggle('sel', !!o.sel);
    el.classList.toggle('crop', !!(o.sel && o.crop));
    if (it.type === 'photo') {
      const photo = it.photoId ? P.photos[it.photoId] : null;
      const rad = 'calc(var(--ppi) * ' + (it.radius || 0) + ')';
      el._clip.style.borderRadius = rad; el._bd.style.borderRadius = rad;
      el._bd.style.boxShadow = it.border > 0 ? 'inset 0 0 0 calc(var(--ppi) * ' + it.border + ') ' + it.borderColor : 'none';
      if (photo) {
        const src = o.thumb ? photo.thumb : (photo.proxy || photo.thumb);
        if (el._img.dataset.src !== src) { el._img.dataset.src = src; el._img.src = src; }
        const v = PB.photoView(it, photo, it.w * d.W, it.h * d.H);
        const im = el._img.style;
        im.width = v.imgWpct + '%'; im.height = v.imgHpct + '%'; im.left = v.leftPct + '%'; im.top = v.topPct + '%'; im.display = 'block';
        el._ph.style.display = photo.missing ? 'flex' : 'none';
        el._ph.textContent = photo.missing ? 'Missing file' : '';
      } else {
        el._img.style.display = 'none'; el._img.removeAttribute('src'); delete el._img.dataset.src;
        el._ph.style.display = 'flex'; el._ph.textContent = o.thumb ? '' : 'Drop a photo';
      }
    } else if (it.type === 'text') {
      const t = el._txt.style;
      t.fontSize = 'calc(var(--ppi) * ' + (it.size / 72) + ')'; t.fontFamily = '"' + it.font + '", serif'; t.color = it.color;
      t.textAlign = it.align; t.fontWeight = it.bold ? '700' : '400'; t.fontStyle = it.italic ? 'italic' : 'normal';
      el._txt.textContent = it.text;
    } else if (it.type === 'logo') {
      if (el._lg.getAttribute('src') !== it.url) el._lg.src = it.url;
    }
    const wantH = !!(o.sel && o.handles && !o.crop);
    if (wantH && !el._hs) {
      el._hs = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((k) => { const x = h('div', { class: 'h ' + k }); x.dataset.h = k; el.appendChild(x); return x; });
    } else if (!wantH && el._hs) { el._hs.forEach((x) => x.remove()); el._hs = null; }
  }

  function syncStage() {
    const stage = $('#stage'), sp = curSpread();
    if (stage._spreadId !== sp.id) {
      stage.querySelectorAll('.item').forEach((e) => e.remove());
      elMap.clear(); stage._spreadId = sp.id; U.crop = false;
    }
    stage.style.background = sp.bg;
    const seen = new Set();
    sp.items.forEach((it, idx) => {
      let el = elMap.get(it.id);
      if (!el || el.parentNode !== stage) { el = h('div', { class: 'item' }); el.dataset.id = it.id; elMap.set(it.id, el); stage.appendChild(el); }
      updateItemEl(el, it, sp, { sel: U.items.has(it.id), handles: true, crop: U.crop && U.items.size === 1 });
      el.style.zIndex = idx + 1;
      seen.add(it.id);
    });
    elMap.forEach((el, id) => { if (!seen.has(id)) { el.remove(); elMap.delete(id); } });
    // overlays
    stage.querySelectorAll('.gutter,.safe,.snap,.cropnote').forEach((e) => e.remove());
    if (sp.kind !== 'cover') stage.appendChild(h('div', { class: 'gutter' }));
    if (U.safe) {
      const d = PB.dims(P, sp), m = sp.margin == null ? P.margin : sp.margin, tr = 0.25;
      stage.appendChild(h('div', { class: 'safe m', style: { left: m / d.W * 100 + '%', right: m / d.W * 100 + '%', top: m / d.H * 100 + '%', bottom: m / d.H * 100 + '%' } }));
      stage.appendChild(h('div', { class: 'safe t', style: { left: tr / d.W * 100 + '%', right: tr / d.W * 100 + '%', top: tr / d.H * 100 + '%', bottom: tr / d.H * 100 + '%' } }));
    }
    const sv = h('div', { class: 'snap', id: 'snapV', style: { width: '1px', top: 0, bottom: 0 } });
    const sh = h('div', { class: 'snap', id: 'snapH', style: { height: '1px', left: 0, right: 0 } });
    stage.append(sv, sh);
    if (U.crop && U.items.size === 1) stage.appendChild(h('div', { class: 'cropnote' }, 'Drag to reposition · scroll to zoom · Esc or double-click to finish'));
  }

  // ----- stage interactions -----
  function stageRect() { return $('#stage').getBoundingClientRect(); }

  function snapCandidates(sp, skip, axis) {
    const d = PB.dims(P, sp), m = sp.margin == null ? P.margin : sp.margin;
    const c = [0, 1];
    if (axis === 'x') {
      c.push(m / d.W, 1 - m / d.W);
      if (sp.kind !== 'cover') c.push(0.5, 0.5 - m / d.W, 0.5 + m / d.W);
    } else c.push(m / d.H, 1 - m / d.H, 0.5);
    sp.items.forEach((o) => {
      if (skip.has(o.id)) return;
      if (axis === 'x') c.push(o.x, o.x + o.w, o.x + o.w / 2); else c.push(o.y, o.y + o.h, o.y + o.h / 2);
    });
    return c;
  }
  function snapAxis(edges, cands, thr) {
    let best = null;
    edges.forEach((e) => cands.forEach((c) => {
      const dd = c - e;
      if (Math.abs(dd) < thr && (!best || Math.abs(dd) < Math.abs(best.d))) best = { d: dd, line: c };
    }));
    return best;
  }
  function showSnap(x, y) {
    const v = $('#snapV'), hh = $('#snapH');
    if (v) { v.style.display = x == null ? 'none' : 'block'; if (x != null) v.style.left = x * 100 + '%'; }
    if (hh) { hh.style.display = y == null ? 'none' : 'block'; if (y != null) hh.style.top = y * 100 + '%'; }
  }

  function onStageDown(e) {
    if (e.button !== 0 || U.mode !== 'design') return;
    const sp = curSpread();
    const hEl = e.target.closest('.h');
    const iEl = e.target.closest('.item');
    if (!iEl) {
      if (!e.shiftKey && (U.items.size || U.crop)) { U.items.clear(); U.crop = false; selChanged(); }
      return;
    }
    const id = iEl.dataset.id;
    const it = sp.items.find((x) => x.id === id);
    if (!it) return;
    if (e.shiftKey && !hEl) {
      if (U.items.has(id)) U.items.delete(id); else U.items.add(id);
      selChanged(); return;
    }
    if (!U.items.has(id)) { U.items.clear(); U.items.add(id); U.crop = false; selChanged(); }
    $('#stage').setPointerCapture(e.pointerId);
    const rect = stageRect();
    const pre = snap();
    if (hEl) {
      gesture = { type: 'resize', dir: hEl.dataset.h, sx: e.clientX, sy: e.clientY, rect: rect, pre: pre, moved: false, start: { x: it.x, y: it.y, w: it.w, h: it.h }, it: it };
    } else if (U.crop && U.items.size === 1 && it.type === 'photo' && it.photoId) {
      gesture = { type: 'pan', sx: e.clientX, sy: e.clientY, rect: rect, pre: pre, moved: false, it: it, cx: it.cx, cy: it.cy };
      iEl.classList.add('panning');
    } else {
      gesture = {
        type: 'move', sx: e.clientX, sy: e.clientY, rect: rect, pre: pre, moved: false, e: e,
        items: selItems().map((x) => ({ it: x, x: x.x, y: x.y, w: x.w, h: x.h }))
      };
    }
    e.preventDefault();
  }

  function gestureStart(g) {
    if (g.moved) return;
    g.moved = true;
    HST.undo.push(g.pre); if (HST.undo.length > 80) HST.undo.shift();
    HST.redo = []; HST.lastKey = null;
    setDirty();
    if (g.type !== 'pan') curSpread().lm = null;
  }

  function onStageMove(e) {
    const g = gesture;
    if (!g) return;
    const dxp = e.clientX - g.sx, dyp = e.clientY - g.sy;
    if (!g.moved && Math.hypot(dxp, dyp) < 3) return;
    gestureStart(g);
    const sp = curSpread(), r = g.rect;
    const dx = dxp / r.width, dy = dyp / r.height;
    const thrX = 7 / r.width, thrY = 7 / r.height;
    let sx = null, sy = null;
    if (g.type === 'move') {
      let ddx = dx, ddy = dy;
      if (g.items.length === 1 && !e.altKey) {
        const a = g.items[0], skip = new Set([a.it.id]);
        const nx = a.x + dx, ny = a.y + dy;
        const bx = snapAxis([nx, nx + a.w / 2, nx + a.w], snapCandidates(sp, skip, 'x'), thrX);
        const by = snapAxis([ny, ny + a.h / 2, ny + a.h], snapCandidates(sp, skip, 'y'), thrY);
        if (bx) { ddx += bx.d; sx = bx.line; }
        if (by) { ddy += by.d; sy = by.line; }
      }
      g.items.forEach((a) => {
        a.it.x = clamp(a.x + ddx, -a.w + 0.04, 0.96);
        a.it.y = clamp(a.y + ddy, -a.h + 0.04, 0.96);
        const el = elMap.get(a.it.id);
        if (el) updateItemEl(el, a.it, sp, { sel: true, handles: true });
      });
    } else if (g.type === 'resize') {
      const s = g.start, it = g.it, dir = g.dir, skip = new Set([it.id]);
      let l = s.x, t = s.y, rr = s.x + s.w, b = s.y + s.h;
      if (dir.indexOf('w') >= 0) l = s.x + dx;
      if (dir.indexOf('e') >= 0) rr = s.x + s.w + dx;
      if (dir.indexOf('n') >= 0) t = s.y + dy;
      if (dir.indexOf('s') >= 0) b = s.y + s.h + dy;
      if (!e.altKey) {
        const cx = snapCandidates(sp, skip, 'x'), cy = snapCandidates(sp, skip, 'y');
        if (dir.indexOf('w') >= 0) { const q = snapAxis([l], cx, thrX); if (q) { l += q.d; sx = q.line; } }
        if (dir.indexOf('e') >= 0) { const q = snapAxis([rr], cx, thrX); if (q) { rr += q.d; sx = q.line; } }
        if (dir.indexOf('n') >= 0) { const q = snapAxis([t], cy, thrY); if (q) { t += q.d; sy = q.line; } }
        if (dir.indexOf('s') >= 0) { const q = snapAxis([b], cy, thrY); if (q) { b += q.d; sy = q.line; } }
      }
      const keep = (it.type === 'logo' || e.shiftKey) && dir.length === 2;
      if (keep) {
        const ar = (s.w * stageMeta.W) / (s.h * stageMeta.H);
        const w = Math.max(0.02, rr - l);
        const hh = w * stageMeta.W / ar / stageMeta.H;
        if (dir.indexOf('w') >= 0) l = rr - w; else rr = l + w;
        if (dir.indexOf('n') >= 0) t = b - hh; else b = t + hh;
      }
      if (rr - l < 0.02) { if (dir.indexOf('w') >= 0) l = rr - 0.02; else rr = l + 0.02; }
      if (b - t < 0.02) { if (dir.indexOf('n') >= 0) t = b - 0.02; else b = t + 0.02; }
      it.x = l; it.y = t; it.w = rr - l; it.h = b - t;
      const el = elMap.get(it.id);
      if (el) updateItemEl(el, it, sp, { sel: true, handles: true });
    } else if (g.type === 'pan') {
      const it = g.it, photo = P.photos[it.photoId];
      const fW = it.w * stageMeta.W, fH = it.h * stageMeta.H;
      const v = PB.photoView(it, photo, fW, fH);
      const k = v.s * stageMeta.ppi; // screen px per image px
      it.cx = g.cx - (dxp / k) / photo.w;
      it.cy = g.cy - (dyp / k) / photo.h;
      const el = elMap.get(it.id);
      if (el) updateItemEl(el, it, sp, { sel: true, handles: false, crop: true });
    }
    showSnap(sx, sy);
    touchFilm();
  }

  function onStageUp(e) {
    const g = gesture;
    gesture = null;
    showSnap(null, null);
    $('#stage').querySelectorAll('.panning').forEach((x) => x.classList.remove('panning'));
    if (!g || !g.moved) { if (g) { /* click only */ } return; }
    const sp = curSpread();
    if (g.type === 'move' && g.items.length === 1 && (e.ctrlKey || e.metaKey)) {
      // Ctrl-drop onto another frame swaps their photos.
      const a = g.items[0].it;
      const under = document.elementsFromPoint(e.clientX, e.clientY).map((x) => x.closest && x.closest('.item')).filter(Boolean)
        .map((x) => sp.items.find((i) => i.id === x.dataset.id)).find((i) => i && i.id !== a.id && i.type === 'photo');
      if (a.type === 'photo' && under) {
        const keys = ['photoId', 'zoom', 'cx', 'cy'];
        keys.forEach((k) => { const tmp = a[k]; a[k] = under[k]; under[k] = tmp; });
        a.x = g.items[0].x; a.y = g.items[0].y;
      }
    }
    refresh('sib'); touchFilm();
  }

  function onStageDbl(e) {
    if (U.mode !== 'design') return;
    const hit = document.elementsFromPoint(e.clientX, e.clientY).map((x) => x.closest && x.closest('.item')).find(Boolean);
    if (!hit) return;
    const it = curSpread().items.find((x) => x.id === hit.dataset.id);
    if (!it) return;
    if (!U.items.has(it.id)) { U.items.clear(); U.items.add(it.id); }
    if (it.type === 'photo') {
      if (it.photoId) { U.crop = !U.crop; selChanged(); }
      else if (U.psel.size) { placeSmart(Array.from(U.psel)[0]); }
      else importPhotos();
    } else if (it.type === 'text') {
      U.tab = 'frame'; renderInspector();
      const ta = $('#inspector textarea'); if (ta) { ta.focus(); ta.select(); }
    }
  }

  function onWheel(e) {
    if (U.mode !== 'design') return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      U.zoom = clamp(U.zoom * (e.deltaY < 0 ? 1.1 : 0.9), 0.3, 6);
      refresh('sb'); return;
    }
    if (U.crop && U.items.size === 1) {
      const it = selItems()[0];
      if (it && it.type === 'photo' && it.photoId) {
        e.preventDefault();
        checkpoint('zoom');
        it.zoom = clamp((it.zoom || 1) * (e.deltaY < 0 ? 1.06 : 0.94), 1, 6);
        const el = elMap.get(it.id);
        if (el) updateItemEl(el, it, curSpread(), { sel: true, crop: true });
        touchFilm();
      }
    }
  }

  function selChanged() {
    if (U.items.size && U.tab === 'layouts') U.tab = 'frame';
    refresh('si');
  }

  // external drops on the stage (photos from the panel)
  function onStageDrop(e) {
    const raw = e.dataTransfer.getData('text/pb');
    if (!raw) return;
    e.preventDefault();
    let ids = [];
    try { ids = JSON.parse(raw); } catch (er) { return; }
    ids = ids.filter((id) => P.photos[id]);
    if (!ids.length) return;
    const sp = curSpread();
    const el = document.elementsFromPoint(e.clientX, e.clientY).map((x) => x.closest && x.closest('.item')).find(Boolean);
    const target = el ? sp.items.find((i) => i.id === el.dataset.id) : null;
    checkpoint();
    if (target && target.type === 'photo') {
      placePhotoInto(target, ids[0]);
      U.items.clear(); U.items.add(target.id);
    } else if (ids.length > 1 || !sp.items.length) {
      PB.relayout(P, sp, Date.now(), ids);
      U.items.clear();
    } else {
      const r = stageRect(), p = P.photos[ids[0]];
      const hh = 0.5, w = Math.min(0.5, hh * stageMeta.H * (p.w / p.h) / stageMeta.W);
      const x = clamp((e.clientX - r.left) / r.width - w / 2, 0, 1 - w), y = clamp((e.clientY - r.top) / r.height - hh / 2, 0, 1 - hh);
      const it = PB.photoItem(ids[0], x, y, w, hh);
      sp.items.push(it); sp.lm = null;
      U.items.clear(); U.items.add(it.id);
    }
    refresh('sfipb');
  }

  // ---------- toolbar ----------
  function renderToolbar() {
    const tb = $('#toolbar');
    tb.innerHTML = '';
    if (!P) return;
    const sp = curSpread();
    const pg = sp.kind === 'cover' ? 'Cover' : 'Pages ' + ((U.sel - 1) * 2 + 2) + '–' + ((U.sel - 1) * 2 + 3);
    tb.append(
      btn('Frame', 'image', addFrame, 'sm', 'Add an empty photo frame'),
      btn('Text', 'text', addText, 'sm', 'Add a text box'),
      btn('Logo', 'plus', addLogo, 'sm', 'Add a logo or graphic (PNG)'),
      h('span', { class: 'cap' }, '|'),
      btn('Add spread', 'plus', addSpread, 'sm'),
      btn('', 'copy', dupSpread, 'sm icon', 'Duplicate spread'),
      btn('', 'trash', delSpread, 'sm icon', 'Delete spread'),
      btn('', 'left', () => moveSpread(-1), 'sm icon', 'Move spread earlier'),
      btn('', 'right', () => moveSpread(1), 'sm icon', 'Move spread later'),
      h('span', { class: 'sp' }),
      h('span', { class: 'cap' }, (sp.kind === 'cover' ? 'Cover' : 'Spread ' + U.sel + ' of ' + (P.spreads.length - 1)) + ' · ' + pg),
      btn('Guides', 'guides', () => { U.safe = !U.safe; refresh('sb'); }, 'sm' + (U.safe ? ' on' : ''), 'Show margins and safe zone'),
      btn('', 'minus', () => { U.zoom = clamp(U.zoom * 0.85, 0.3, 6); refresh('sb'); }, 'sm icon', 'Zoom out'),
      h('span', { class: 'cap' }, Math.round(U.zoom * 100) + '%'),
      btn('', 'plus', () => { U.zoom = clamp(U.zoom * 1.15, 0.3, 6); refresh('sb'); }, 'sm icon', 'Zoom in'),
      btn('', 'fit', () => { U.zoom = 1; refresh('sb'); }, 'sm icon', 'Fit to window'));
    [5, 6, 7, 8].forEach((k) => { tb.children[k].disabled = sp.kind === 'cover'; });
  }

  function addFrame() {
    checkpoint();
    const sp = curSpread(), it = PB.photoItem(null, 0.3, 0.2, 0.3, 0.6);
    sp.items.push(it); sp.lm = null; U.items.clear(); U.items.add(it.id);
    refresh('sfib'); selChanged();
  }
  function addText() {
    checkpoint();
    const sp = curSpread(), it = PB.textItem(0.25, 0.42, 0.5, 0.16);
    sp.items.push(it); U.items.clear(); U.items.add(it.id); U.tab = 'frame';
    refresh('sfib'); selChanged();
  }
  async function addLogo() {
    const f = await api.pickLogo();
    if (!f) return;
    let ratio = 1;
    try { const im = await PB.loadImage(f.url); ratio = im.naturalWidth / im.naturalHeight; } catch (e) { toast('Could not read that image.'); return; }
    checkpoint();
    const sp = curSpread(), w = 0.16;
    const it = PB.logoItem(f.url, f.path, ratio, 0.42, 0.4, w);
    it.h = w * stageMeta.W / ratio / stageMeta.H;
    sp.items.push(it); U.items.clear(); U.items.add(it.id); U.tab = 'frame';
    refresh('sfib'); selChanged();
  }
  function addSpread() {
    checkpoint();
    const sp = PB.newSpread('spread', curSpread().bg);
    const at = Math.max(1, U.sel + 1);
    P.spreads.splice(at, 0, sp); U.sel = at; U.items.clear();
    refresh('sfipt');
  }
  function dupSpread() {
    checkpoint();
    const src = curSpread(), cp = JSON.parse(JSON.stringify(src));
    cp.id = PB.uid('s'); cp.items.forEach((i) => { i.id = PB.uid('f'); });
    cp.kind = 'spread';
    const at = Math.max(1, U.sel + 1);
    P.spreads.splice(at, 0, cp); U.sel = at; U.items.clear();
    refresh('sfipt');
  }
  function delSpread() {
    if (curSpread().kind === 'cover') { toast('The cover can’t be deleted — change its photos or layout instead.'); return; }
    checkpoint();
    P.spreads.splice(U.sel, 1);
    U.sel = clamp(U.sel, 0, P.spreads.length - 1); U.items.clear();
    refresh('sfipt');
  }
  function moveSpread(dir) {
    const to = U.sel + dir;
    if (U.sel < 1 || to < 1 || to >= P.spreads.length) return;
    checkpoint();
    const t = P.spreads[U.sel]; P.spreads[U.sel] = P.spreads[to]; P.spreads[to] = t;
    U.sel = to; refresh('sfbt');
  }
  function gotoSpread(i) {
    if (i < 0 || i >= P.spreads.length) return;
    U.sel = i; U.items.clear(); U.crop = false;
    refresh('sfibt');
  }

  // ---------- filmstrip ----------
  function renderFilm() {
    const f = $('#filmstrip');
    if (!P) return;
    const sx = f.scrollLeft;
    f.innerHTML = '';
    P.spreads.forEach((sp, i) => {
      const d = PB.dims(P, sp);
      const wpx = 168 * d.W / (P.pageW * 2);
      const hpx = wpx * d.H / d.W;
      const box = h('div', { class: 'sp', style: { width: wpx + 'px', height: hpx + 'px', background: sp.bg } });
      box.style.setProperty('--ppi', wpx / d.W + 'px');
      sp.items.forEach((it) => {
        const el = h('div', { class: 'item' });
        updateItemEl(el, it, sp, { thumb: true });
        box.appendChild(el);
      });
      if (sp.kind !== 'cover') box.appendChild(h('div', { class: 'gutter' }));
      const label = i === 0 ? 'Cover' : 'Pages ' + ((i - 1) * 2 + 2) + '–' + ((i - 1) * 2 + 3);
      const t = h('div', {
        class: 'thumb' + (i === U.sel ? ' sel' : ''), tabindex: 0, role: 'button', 'aria-label': label,
        draggable: i > 0,
        onclick: () => gotoSpread(i),
        onkeydown: (e) => { if (e.key === 'Enter') gotoSpread(i); },
        ondragstart: (e) => { e.dataTransfer.setData('text/pb-sp', String(i)); },
        ondragover: (e) => { if (e.dataTransfer.types.indexOf('text/pb-sp') >= 0 && i > 0) { e.preventDefault(); t.classList.add('dragover'); } },
        ondragleave: () => t.classList.remove('dragover'),
        ondrop: (e) => {
          t.classList.remove('dragover');
          const from = parseInt(e.dataTransfer.getData('text/pb-sp'), 10);
          if (isNaN(from) || from < 1 || i < 1 || from === i) return;
          e.preventDefault();
          checkpoint();
          const mv = P.spreads.splice(from, 1)[0];
          P.spreads.splice(i, 0, mv);
          U.sel = i; refresh('sfibt');
        }
      }, box, h('div', { class: 'lbl' }, label, sp.approved ? h('span', { class: 'ok' }, '✓ approved') : null));
      f.appendChild(t);
    });
    f.appendChild(h('button', { type: 'button', class: 'addsp', onclick: addSpread, 'aria-label': 'Add spread' }, ic('plus'), 'Add'));
    f.scrollLeft = sx;
    const sel = f.querySelector('.thumb.sel');
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ---------- inspector ----------
  function rangeRow(label, min, max, step, val, fmt, onInput) {
    const out = h('span', { class: 'val' }, fmt(val));
    const inp = h('input', {
      type: 'range', min: min, max: max, step: step, value: val, 'aria-label': label,
      oninput: () => { const v = parseFloat(inp.value); out.textContent = fmt(v); onInput(v); }
    });
    return h('div', { class: 'row' }, h('label', {}, label), inp, out);
  }
  function colorRow(label, val, onInput) {
    const inp = h('input', { type: 'color', value: val, 'aria-label': label, oninput: () => onInput(inp.value) });
    return h('div', { class: 'row' }, h('label', {}, label), inp);
  }

  function renderInspector() {
    const box = $('#inspector');
    box.innerHTML = '';
    if (!P) return;
    const tabs = [['layouts', 'Layout'], ['frame', 'Frame'], ['spread', 'Spread']];
    box.appendChild(h('div', { class: 'tabs2', role: 'tablist' }, tabs.map((t) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(U.tab === t[0]), onclick: () => { U.tab = t[0]; renderInspector(); } }, t[1]))));
    const body = h('div', { class: 'insp-body' });
    box.appendChild(body);
    if (U.tab === 'layouts') inspLayouts(body);
    else if (U.tab === 'frame') inspFrame(body);
    else inspSpread(body);
  }

  function inspLayouts(body) {
    const sp = curSpread();
    const list = PB.presets[sp.kind === 'cover' ? 'cover' : 'spread'];
    const d = PB.dims(P, sp);
    const nPh = sp.items.filter((i) => i.type === 'photo').length;
    const lf = U.lf || 'auto';
    const match = (p) => {
      const n = p.cells.length;
      if (lf === 'all') return true;
      if (lf === 'auto') return nPh ? n === nPh : true;
      return lf === 7 ? n >= 7 : n === lf;
    };
    let shown = list.map((p, i) => ({ p: p, i: i })).filter((x) => match(x.p));
    let note = null;
    if (!shown.length) { shown = list.map((p, i) => ({ p: p, i: i })); note = 'No layouts for ' + nPh + ' photos, showing all.'; }
    const chips = ['auto', 'all', 1, 2, 3, 4, 5, 6, 7].map((c) => {
      const label = c === 'auto' ? (nPh ? 'Fits ' + nPh : 'Fits') : c === 'all' ? 'All' : c === 7 ? '7+' : String(c);
      return h('button', { type: 'button', class: 'btn sm' + (lf === c ? ' on' : ''), 'aria-pressed': String(lf === c), onclick: () => { U.lf = c; renderInspector(); } }, label);
    });
    const sec = h('div', { class: 'sec' }, h('h2', {}, 'Layouts · ' + shown.length), h('div', { class: 'btns' }, chips));
    if (note) sec.appendChild(h('div', { class: 'hint' }, note));
    let lastN = null;
    let grid = null;
    shown.forEach((x) => {
      const pr = x.p, i = x.i, n = pr.cells.length;
      if (n !== lastN) {
        lastN = n;
        sec.appendChild(h('div', { class: 'hint', style: { marginTop: '4px', fontWeight: '600' } }, n + (n === 1 ? ' photo' : ' photos')));
        grid = h('div', { class: 'presets' });
        sec.appendChild(grid);
      }
      const rects = PB.applyPreset(pr, d.W, d.H, P.margin * 0.6, P.gap * 0.6);
      const pv = h('span', { class: 'pv', style: { aspectRatio: d.W + '/' + d.H } }, rects.map((r) => h('i', { style: { left: r.x * 100 + '%', top: r.y * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%' } })));
      const on = sp.lm && sp.lm.kind === 'preset' && sp.lm.idx === i;
      grid.appendChild(h('button', {
        type: 'button', class: 'preset' + (on ? ' on' : ''), 'aria-label': pr.name + ' layout',
        onclick: () => {
          checkpoint();
          const lost = PB.applyPresetToSpread(P, sp, i);
          U.items.clear(); refresh('sfi'); touchFilm();
          if (lost > 0) toast(lost + ' photo' + (lost === 1 ? ' was' : 's were') + ' removed from this spread. Pick a layout with more frames to keep them.');
        }
      }, pv, h('span', { class: 'nm' }, pr.name)));
    });
    body.appendChild(sec);
    body.appendChild(h('div', { class: 'sec' }, h('h2', {}, 'Smart layout'),
      h('div', { class: 'btns' },
        btn('Shuffle', 'shuffle', () => {
          if (!sp.items.some((i) => i.type === 'photo' && i.photoId)) { toast('Add photos to this spread first.'); return; }
          checkpoint(); PB.relayout(P, sp, Math.floor(Math.random() * 1e9)); U.items.clear(); refresh('sfi');
        }, '', 'Try a new arrangement of the same photos'),
        btn('Edge-to-edge', 'shuffle', () => {
          if (!sp.items.some((i) => i.type === 'photo' && i.photoId)) { toast('Add photos to this spread first.'); return; }
          checkpoint(); sp.margin = 0; PB.relayout(P, sp, Math.floor(Math.random() * 1e9)); U.items.clear(); refresh('sfi');
        }, '', 'Arrange the same photos so they fill the whole sheet, edge to edge'),
        btn('Add selected photos', 'plus', () => {
          const ids = Array.from(U.psel);
          if (!ids.length) { toast('Select photos in the left panel first.'); return; }
          checkpoint(); PB.relayout(P, sp, Math.floor(Math.random() * 1e9), ids); U.items.clear(); refresh('sfipb');
        }, '', 'Re-flow this spread to include the selected photos')),
      h('div', { class: 'hint' }, 'Smart layout keeps the photos in order and picks frame sizes that crop them least.')));
  }

  function alignSel(kind) {
    const items = selItems();
    if (!items.length) return;
    checkpoint();
    let l = 0, t = 0, r = 1, b = 1;
    if (items.length > 1) {
      l = Math.min.apply(null, items.map((i) => i.x)); t = Math.min.apply(null, items.map((i) => i.y));
      r = Math.max.apply(null, items.map((i) => i.x + i.w)); b = Math.max.apply(null, items.map((i) => i.y + i.h));
    }
    items.forEach((i) => {
      if (kind === 'l') i.x = l; if (kind === 'r') i.x = r - i.w; if (kind === 'c') i.x = (l + r) / 2 - i.w / 2;
      if (kind === 't') i.y = t; if (kind === 'b') i.y = b - i.h; if (kind === 'm') i.y = (t + b) / 2 - i.h / 2;
    });
    curSpread().lm = null;
    refresh('sib'); touchFilm();
  }

  function inspFrame(body) {
    const sp = curSpread(), items = selItems();
    if (!items.length) {
      body.appendChild(h('div', { class: 'empty' }, 'Select a frame on the spread to edit it.', h('br'), h('br'),
        'Click to select · drag to move · drag the handles to resize · double-click a photo to adjust its crop · Ctrl-drag one frame onto another to swap photos · Shift-click to select several.'));
      return;
    }
    const one = items.length === 1 ? items[0] : null;
    const live = (key, fn) => (v) => { checkpoint(key); items.forEach((i) => fn(i, v)); const e = elMap; items.forEach((i) => { const el = e.get(i.id); if (el) updateItemEl(el, i, sp, { sel: true, handles: true, crop: U.crop }); }); touchFilm(); };

    const photos = items.filter((i) => i.type === 'photo');
    if (photos.length) {
      const sec = h('div', { class: 'sec' }, h('h2', {}, photos.length > 1 ? 'Photo frames' : 'Photo'));
      const p1 = photos[0], ph1 = p1.photoId ? P.photos[p1.photoId] : null;
      if (one && ph1) {
        sec.appendChild(h('div', { class: 'hint' }, ph1.name + ' · ' + ph1.w + ' × ' + ph1.h + ' px'));
        sec.appendChild(h('div', { class: 'btns' },
          btn(U.crop ? 'Done cropping' : 'Adjust crop', 'crop', () => { U.crop = !U.crop; selChanged(); }, 'sm' + (U.crop ? ' on' : '')),
          btn('Reset crop', null, () => { checkpoint(); p1.zoom = 1; p1.cx = 0.5; p1.cy = 0.5; refresh('si'); touchFilm(); }, 'sm'),
          btn('Match photo shape', null, () => {
            checkpoint();
            const area = p1.w * p1.h * stageMeta.W * stageMeta.H, a = ph1.w / ph1.h;
            const nh = Math.sqrt(area / a), nw = nh * a;
            const cx = p1.x + p1.w / 2, cy = p1.y + p1.h / 2;
            p1.w = nw / stageMeta.W; p1.h = nh / stageMeta.H; p1.x = cx - p1.w / 2; p1.y = cy - p1.h / 2;
            sp.lm = null; refresh('sib'); touchFilm();
          }, 'sm', 'Resize the frame to the photo’s own proportions so nothing is cropped')));
        sec.appendChild(rangeRow('Zoom', 1, 5, 0.01, p1.zoom || 1, (v) => v.toFixed(2) + '×', live('zoom', (i, v) => { if (i.type === 'photo') i.zoom = v; })));
      }
      sec.appendChild(rangeRow('Border', 0, 0.5, 0.01, p1.border || 0, (v) => v.toFixed(2) + ' in', live('border', (i, v) => { if (i.type === 'photo') i.border = v; })));
      sec.appendChild(colorRow('Border colour', p1.borderColor || '#ffffff', live('bcolor', (i, v) => { if (i.type === 'photo') i.borderColor = v; })));
      sec.appendChild(rangeRow('Corner radius', 0, 3, 0.05, p1.radius || 0, (v) => v.toFixed(2) + ' in', live('radius', (i, v) => { if (i.type === 'photo') i.radius = v; })));
      const act = h('div', { class: 'btns' });
      if (one) {
        act.appendChild(btn('Use selected photo', 'image', () => {
          const id = Array.from(U.psel)[0];
          if (!id) { toast('Select a photo in the left panel first.'); return; }
          checkpoint(); placePhotoInto(one, id); refresh('sipb'); touchFilm();
        }, 'sm'));
        if (one.photoId) act.appendChild(btn('Empty frame', null, () => { checkpoint(); one.photoId = null; refresh('sipb'); touchFilm(); }, 'sm'));
      }
      sec.appendChild(act);
      body.appendChild(sec);
    }

    const texts = items.filter((i) => i.type === 'text');
    if (one && one.type === 'text') {
      const t = one;
      const ta = h('textarea', { 'aria-label': 'Text', value: t.text, oninput: () => { checkpoint('text'); t.text = ta.value; const el = elMap.get(t.id); if (el) updateItemEl(el, t, sp, { sel: true, handles: true }); touchFilm(); } });
      const fsel = fontPicker(t, sp);
      const mkTog = (label, key) => btn(label, null, () => { checkpoint(); t[key] = !t[key]; refresh('si'); touchFilm(); }, 'sm' + (t[key] ? ' on' : ''));
      const mkAl = (label, v) => btn(label, null, () => { checkpoint(); t.align = v; refresh('si'); touchFilm(); }, 'sm' + (t.align === v ? ' on' : ''));
      body.appendChild(h('div', { class: 'sec' }, h('h2', {}, 'Text'), ta,
        h('div', { class: 'row' }, h('label', {}, 'Font'), fsel),
        rangeRow('Size', 6, 200, 1, t.size, (v) => Math.round(v) + ' pt', live('size', (i, v) => { if (i.type === 'text') i.size = v; })),
        colorRow('Colour', t.color, live('tcolor', (i, v) => { if (i.type === 'text') i.color = v; })),
        h('div', { class: 'btns' }, mkTog('Bold', 'bold'), mkTog('Italic', 'italic'), mkAl('Left', 'left'), mkAl('Centre', 'center'), mkAl('Right', 'right'))));
    }
    if (one && one.type === 'logo') {
      body.appendChild(h('div', { class: 'sec' }, h('h2', {}, 'Logo / graphic'),
        h('div', { class: 'btns' }, btn('Replace…', null, async () => {
          const f = await api.pickLogo(); if (!f) return;
          checkpoint(); one.url = f.url; one.path = f.path; refresh('si'); touchFilm();
        }, 'sm')),
        h('div', { class: 'hint' }, 'Use a PNG with a transparent background for the cleanest result.')));
    }
    if (texts.length || items.some((i) => i.type === 'logo')) {
      body.appendChild(h('div', { class: 'sec' }, rangeRow('Opacity', 0.05, 1, 0.05, items[0].opacity == null ? 1 : items[0].opacity, (v) => Math.round(v * 100) + '%', live('opacity', (i, v) => { i.opacity = v; }))));
    } else {
      body.appendChild(h('div', { class: 'sec' }, rangeRow('Opacity', 0.05, 1, 0.05, items[0].opacity == null ? 1 : items[0].opacity, (v) => Math.round(v * 100) + '%', live('opacity', (i, v) => { i.opacity = v; }))));
    }

    body.appendChild(h('div', { class: 'sec' }, h('h2', {}, 'Arrange'),
      h('div', { class: 'btns' },
        btn('Left', null, () => alignSel('l'), 'sm'), btn('Centre', null, () => alignSel('c'), 'sm'), btn('Right', null, () => alignSel('r'), 'sm'),
        btn('Top', null, () => alignSel('t'), 'sm'), btn('Middle', null, () => alignSel('m'), 'sm'), btn('Bottom', null, () => alignSel('b'), 'sm')),
      h('div', { class: 'btns' },
        btn('Fill spread', null, () => setRect(0, 0, 1, 1), 'sm'),
        sp.kind !== 'cover' ? btn('Left page', null, () => setRect(0, 0, 0.5, 1), 'sm') : null,
        sp.kind !== 'cover' ? btn('Right page', null, () => setRect(0.5, 0, 0.5, 1), 'sm') : null),
      h('div', { class: 'btns' },
        btn('Forward', 'up', () => zOrder(1), 'sm'), btn('Back', 'down', () => zOrder(-1), 'sm'),
        btn('Duplicate', 'copy', dupItems, 'sm'), btn('Delete', 'trash', delItems, 'sm danger'))));
  }
  // Font picker: every font is shown in its own face; hovering or arrowing through the list
  // previews the font live on the selected text, and it only sticks when you click / press Enter.
  function fontPicker(t, sp) {
    let committed = t.font, pop = null, active = -1, rows = [];
    const label = h('span', { style: { fontFamily: '"' + t.font + '"', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t.font);
    const button = h('button', { type: 'button', class: 'btn fontbtn', 'aria-haspopup': 'listbox', 'aria-label': 'Font: ' + t.font, onclick: () => (pop ? close(true) : open()) }, label, ic('down'));
    const preview = (f) => {
      t.font = f;
      const el = elMap.get(t.id);
      if (el) updateItemEl(el, t, sp, { sel: true, handles: true });
    };
    const outside = (e) => { if (pop && !pop.contains(e.target) && !button.contains(e.target)) close(true); };
    function close(revert) {
      if (pop) { pop.remove(); pop = null; }
      document.removeEventListener('mousedown', outside, true);
      if (revert) preview(committed);
    }
    function commit(f) {
      checkpoint();
      committed = f; preview(f);
      label.textContent = f; label.style.fontFamily = '"' + f + '"';
      close(false);
      refresh('s'); touchFilm();
    }
    function open() {
      const fonts = PB.fonts.indexOf(committed) >= 0 ? PB.fonts : [committed].concat(PB.fonts);
      const search = h('input', { type: 'text', placeholder: 'Search ' + fonts.length + ' fonts…', 'aria-label': 'Search fonts' });
      const list = h('div', { class: 'fp-list', role: 'listbox' });
      const setActive = (i, scroll) => {
        active = clamp(i, 0, rows.length - 1);
        rows.forEach((r, k) => r.el.classList.toggle('act', k === active));
        if (rows[active]) {
          preview(rows[active].f);
          if (scroll) rows[active].el.scrollIntoView({ block: 'nearest' });
        }
      };
      const fill = (q) => {
        list.innerHTML = ''; rows = [];
        fonts.filter((f) => !q || f.toLowerCase().indexOf(q.toLowerCase()) >= 0).forEach((f) => {
          const el = h('button', {
            type: 'button', role: 'option', class: 'fp-item' + (f === committed ? ' cur' : ''), style: { fontFamily: '"' + f + '"' },
            onmouseenter: () => setActive(rows.findIndex((r) => r.f === f), false),
            onclick: () => commit(f)
          }, f);
          rows.push({ f: f, el: el }); list.appendChild(el);
        });
        if (!rows.length) list.appendChild(h('div', { class: 'hint', style: { padding: '10px 12px' } }, 'No fonts match.'));
      };
      fill('');
      pop = h('div', { class: 'fontpick-pop' }, h('div', { style: { padding: '6px 8px' } }, search), list);
      document.body.appendChild(pop);
      const r = button.getBoundingClientRect(), ph = 380;
      pop.style.width = Math.max(260, r.width) + 'px';
      pop.style.left = Math.min(r.left, window.innerWidth - Math.max(260, r.width) - 8) + 'px';
      if (r.bottom + ph > window.innerHeight && r.top > ph) pop.style.bottom = (window.innerHeight - r.top + 4) + 'px'; else pop.style.top = (r.bottom + 4) + 'px';
      list.addEventListener('mouseleave', () => { preview(committed); });
      search.addEventListener('input', () => { fill(search.value); active = -1; });
      search.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1, true); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1, true); }
        else if (e.key === 'Enter') { e.preventDefault(); if (rows[active]) commit(rows[active].f); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); button.focus(); }
      });
      document.addEventListener('mousedown', outside, true);
      search.focus();
      const cur = rows.findIndex((x) => x.f === committed);
      if (cur >= 0) rows[cur].el.scrollIntoView({ block: 'center' });
    }
    return button;
  }

  function setRect(x, y, w, hh) {
    const items = selItems();
    if (!items.length) return;
    checkpoint(); items.forEach((i) => { i.x = x; i.y = y; i.w = w; i.h = hh; }); curSpread().lm = null; refresh('sib'); touchFilm();
  }
  function zOrder(dir) {
    const sp = curSpread();
    checkpoint();
    const ids = new Set(U.items);
    const arr = sp.items;
    if (dir > 0) { for (let i = arr.length - 2; i >= 0; i--) if (ids.has(arr[i].id) && !ids.has(arr[i + 1].id)) { const t = arr[i]; arr[i] = arr[i + 1]; arr[i + 1] = t; } }
    else { for (let i = 1; i < arr.length; i++) if (ids.has(arr[i].id) && !ids.has(arr[i - 1].id)) { const t = arr[i]; arr[i] = arr[i - 1]; arr[i - 1] = t; } }
    refresh('s'); touchFilm();
  }
  function dupItems() {
    const sp = curSpread(), items = selItems();
    if (!items.length) return;
    checkpoint();
    const ids = [];
    items.forEach((i) => { const c = JSON.parse(JSON.stringify(i)); c.id = PB.uid('f'); c.x = Math.min(0.9, c.x + 0.03); c.y = Math.min(0.9, c.y + 0.03); sp.items.push(c); ids.push(c.id); });
    sp.lm = null; U.items.clear(); ids.forEach((id) => U.items.add(id)); refresh('sfip');
  }
  function delItems() {
    const sp = curSpread();
    if (!U.items.size) return;
    checkpoint();
    sp.items = sp.items.filter((i) => !U.items.has(i.id)); sp.lm = null;
    U.items.clear(); U.crop = false; refresh('sfip');
  }

  function inspSpread(body) {
    const sp = curSpread();
    const swatches = ['#ffffff', '#faf8f4', '#e9e2d4', '#cfd6dd', '#2b2d31', '#000000'];
    const setBg = (v) => { checkpoint('bg'); sp.bg = v; $('#stage').style.background = v; touchFilm(); };
    const sw = h('div', { class: 'swatches' }, swatches.map((c) => h('button', { type: 'button', class: 'swatch' + (sp.bg.toLowerCase() === c ? ' on' : ''), style: { background: c }, 'aria-label': 'Background ' + c, onclick: () => { setBg(c); renderInspector(); } })));
    const m = sp.margin == null ? P.margin : sp.margin, g = sp.gap == null ? P.gap : sp.gap;
    const reflow = () => {
      if (!sp.lm) return;
      if (sp.lm.kind === 'preset') PB.applyPresetToSpread(P, sp, sp.lm.idx);
      else PB.relayout(P, sp, sp.lm.seed);
      refresh('s'); touchFilm();
    };
    body.appendChild(h('div', { class: 'sec' }, h('h2', {}, 'Background'), sw, colorRow('Custom colour', /^#[0-9a-f]{6}$/i.test(sp.bg) ? sp.bg : '#ffffff', setBg)));
    body.appendChild(h('div', { class: 'sec' }, h('h2', {}, 'Spacing'),
      rangeRow('Margin', 0, 2, 0.05, m, (v) => v.toFixed(2) + ' in', (v) => { checkpoint('margin'); sp.margin = v; reflow(); }),
      rangeRow('Gap', 0, 1, 0.025, g, (v) => v.toFixed(2) + ' in', (v) => { checkpoint('gap'); sp.gap = v; reflow(); }),
      h('div', { class: 'hint' }, sp.lm ? 'Margin and gap re-flow this spread’s layout.' : 'This spread has custom positions. Pick a layout in the Layout tab to use margin and gap again.')));
    const notes = h('textarea', { 'aria-label': 'Notes', value: sp.comment || '', oninput: () => { checkpoint('note'); sp.comment = notes.value; } });
    body.appendChild(h('div', { class: 'sec' }, h('h2', {}, 'Notes / client comments'), notes,
      h('div', { class: 'btns' }, btn(sp.approved ? 'Approved ✓' : 'Mark approved', null, () => { checkpoint(); sp.approved = !sp.approved; refresh('sif'); }, 'sm' + (sp.approved ? ' on' : '')))));
    body.appendChild(h('div', { class: 'sec' }, h('h2', {}, 'Album'),
      h('div', { class: 'btns' }, btn('Album settings…', null, albumSettingsDialog, 'sm'), btn('Save as…', 'save', () => saveProject(true), 'sm'))));
  }

  // ---------- auto design ----------
  function autoDesignDialog() {
    if (!P) return;
    if (!P.photoOrder.length) { toast('Import some photos first.', 'Add photos', importPhotos); return; }
    const used = usedCounts();
    const unused = P.photoOrder.filter((id) => !used[id]).length;
    const src = h('select', {},
      [['all', 'All photos (' + P.photoOrder.length + ')'], ['unused', 'Unused photos (' + unused + ')'], ['starred', 'Rated ★3 and up'], ['sel', 'Selected photos (' + U.psel.size + ')']].map((o) => h('option', { value: o[0], selected: o[0] === (unused && unused < P.photoOrder.length ? 'unused' : 'all') }, o[1])));
    const mode = h('select', {}, [['replace', 'Replace all spreads'], ['append', 'Add after existing spreads']].map((o) => h('option', { value: o[0] }, o[1])));
    const mn = h('input', { type: 'number', min: 1, max: 8, value: 2 });
    const mx = h('input', { type: 'number', min: 1, max: 10, value: 4 });
    const tgt = h('input', { type: 'number', min: 1, max: 200, placeholder: 'Auto' });
    const mg = h('input', { type: 'number', min: 0, max: 3, step: 0.05, value: P.margin });
    const gp = h('input', { type: 'number', min: 0, max: 2, step: 0.05, value: P.gap });
    const cover = h('input', { type: 'checkbox', checked: true });
    const bg = h('input', { type: 'color', value: '#ffffff' });
    modal({
      title: 'Auto design', wide: true,
      body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        h('div', { class: 'hint', style: { fontSize: '13px' } }, 'Photos are ordered by time taken, grouped into spreads (a long pause starts a new spread), and laid out so every photo is cropped as little as possible. Photos flagged Main get a bigger frame, Panoramic photos get a wide one, and a Cover photo is used for the cover.'),
        h('div', { class: 'two' }, fld('Photos to use', src), fld('Existing spreads', mode)),
        h('div', { class: 'two' }, fld('Fewest photos per spread', mn), fld('Most photos per spread', mx)),
        h('div', { class: 'two' }, fld('Target number of spreads (optional)', tgt), fld('Page colour', bg)),
        h('div', { class: 'two' }, fld('Margin (in)', mg), fld('Gap (in)', gp)),
        h('label', { class: 'chk' }, cover, 'Design the cover from a Cover/Main/top-rated photo')),
      buttons: [{ label: 'Cancel' }, {
        label: 'Design album', primary: true, onclick: (close) => {
          let ids = P.photoOrder.slice();
          if (src.value === 'unused') ids = ids.filter((id) => !used[id]);
          else if (src.value === 'starred') ids = ids.filter((id) => (P.photos[id].rating || 0) >= 3);
          else if (src.value === 'sel') ids = ids.filter((id) => U.psel.has(id));
          ids = ids.filter((id) => !P.photos[id].missing);
          if (!ids.length) { toast('No photos match that choice.'); return; }
          ids.sort((a, b) => (P.photos[a].time - P.photos[b].time) || P.photos[a].name.localeCompare(P.photos[b].name, undefined, { numeric: true }));
          checkpoint();
          const out = PB.autoDesign(P, ids, {
            perMin: parseInt(mn.value, 10) || 2, perMax: parseInt(mx.value, 10) || 4, target: parseInt(tgt.value, 10) || 0,
            margin: parseFloat(mg.value), gap: parseFloat(gp.value), cover: cover.checked, bg: bg.value, seed: Date.now()
          });
          const hasCover = out.length && out[0].kind === 'cover';
          if (mode.value === 'replace') {
            const oldCover = P.spreads[0];
            P.spreads = hasCover ? out : [oldCover].concat(out);
          } else {
            P.spreads = P.spreads.concat(hasCover ? out.slice(1) : out);
          }
          U.sel = Math.min(1, P.spreads.length - 1); U.items.clear();
          close(); refresh('sfipt');
          toast('Designed ' + (P.spreads.length - 1) + ' spreads. Use Shuffle or Layout to refine any spread.');
        }
      }]
    });
  }

  // ---------- preview / client view ----------
  let slideTimer = null;
  function setMode(m) {
    if (!P) return;
    if (m === 'design') { closePreview(); return; }
    openPreview(m === 'client');
  }
  function openPreview(client) {
    U.mode = client ? 'client' : 'preview';
    const pv = $('#preview');
    pv.hidden = false;
    let idx = U.sel, playing = false;
    const draw = () => {
      pv.innerHTML = '';
      const sp = P.spreads[idx], d = PB.dims(P, sp);
      const bar = h('div', { class: 'pbar' },
        btn('Close', 'close', closePreview, 'sm'),
        h('div', { class: 't' }, P.name + ' — ' + (idx === 0 ? 'Cover' : 'Pages ' + ((idx - 1) * 2 + 2) + '–' + ((idx - 1) * 2 + 3))),
        btn(playing ? 'Pause' : 'Slideshow', playing ? 'pause' : 'play', () => { playing = !playing; clearInterval(slideTimer); if (playing) slideTimer = setInterval(() => go(1, true), 4000); draw(); }, 'sm'));
      const stage = h('div', { class: 'pstage' });
      const nav = (cls, icon, dir) => h('button', { type: 'button', class: 'nav ' + cls, 'aria-label': dir < 0 ? 'Previous spread' : 'Next spread', onclick: () => go(dir) }, ic(icon));
      const fit = () => {
        const aw = stage.clientWidth * 0.86, ah = stage.clientHeight * 0.9;
        const ppi = Math.min(aw / d.W, ah / d.H);
        spEl.style.width = d.W * ppi + 'px'; spEl.style.height = d.H * ppi + 'px'; spEl.style.setProperty('--ppi', ppi + 'px');
      };
      const spEl = h('div', { class: 'sp', style: { background: sp.bg } });
      sp.items.forEach((it) => { const el = h('div', { class: 'item', style: { cursor: 'default' } }); updateItemEl(el, it, sp, {}); spEl.appendChild(el); });
      if (sp.kind !== 'cover') spEl.appendChild(h('div', { class: 'gutter', style: { opacity: 0.5 } }));
      stage.append(spEl, nav('l', 'left', -1), nav('r', 'right', 1));
      pv.append(bar, stage);
      if (client) {
        const ta = h('textarea', { 'aria-label': 'Comment on this spread', placeholder: 'Comments on this spread…', value: sp.comment || '', oninput: () => { sp.comment = ta.value; setDirty(); } });
        pv.appendChild(h('div', { class: 'client' }, ta,
          btn(sp.approved ? 'Approved ✓' : 'Approve spread', null, () => { sp.approved = !sp.approved; setDirty(); draw(); }, sp.approved ? 'on' : 'primary')));
      }
      requestAnimationFrame(fit);
      pv._fit = fit;
    };
    const go = (dir, wrap) => {
      let n = idx + dir;
      if (n >= P.spreads.length) n = wrap ? 0 : P.spreads.length - 1;
      if (n < 0) n = 0;
      idx = n; U.sel = n; draw();
    };
    pv._go = go;
    draw();
    updateTop();
    pv.focus();
  }
  function closePreview() {
    clearInterval(slideTimer);
    U.mode = 'design';
    const pv = $('#preview'); pv.hidden = true; pv.innerHTML = ''; pv._go = null;
    U.items.clear();
    refresh('sfibit'); renderFilm();
    updateTop();
  }

  // ---------- export ----------
  // ---------- licensing / payment wall ----------
  async function refreshLicense() {
    try { LIC = await api.licenseStatus(); } catch (e) { LIC = { licensed: false, email: '', id: '' }; }
    try { CFG = Object.assign(CFG, await api.licenseConfig()); } catch (e) { /* keep defaults */ }
    updateTop();
  }

  function unlockDialog(opts) {
    opts = opts || {};
    const key = h('textarea', { placeholder: 'Paste your license key here (starts with PBS1.)', 'aria-label': 'License key', style: { minHeight: '84px', fontSize: '12px', wordBreak: 'break-all' } });
    const msg = h('div', { class: 'hint', style: { minHeight: '16px' } });
    const devs = h('div', { class: 'devlist' });
    const perks = ['Export print-ready JPGs and PDFs at up to 300 dpi', 'Every layout, font and editing feature, no limits', 'Free updates to this version', 'Use it on your own computers, no subscription'];
    const body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      h('div', { class: 'hint', style: { fontSize: '13px', lineHeight: '1.6' } }, opts.fromExport
        ? 'Exporting is part of the full version. You can design, arrange and preview freely in the trial, and exporting unlocks as soon as you buy.'
        : 'You’re using the free trial. Design, arrange and preview as much as you like. Exporting your finished album needs the full version.'),
      h('ul', { class: 'perks' }, perks.map((p) => h('li', {}, p))),
      h('div', { class: 'buyrow' },
        h('div', {}, h('div', { class: 'price' }, CFG.price || 'Full version'), h('div', { class: 'hint' }, 'One-time payment. Your license key is emailed to you right after you pay.')),
        btn('Buy now', 'key', async () => {
          const ok = await api.licenseBuy();
          if (!ok) msg.textContent = 'The purchase page isn’t set up in this build yet. Contact ' + (CFG.supportEmail || 'the seller') + ' to buy.';
          else msg.textContent = 'Your browser has opened the secure payment page. After paying, come back and paste the key you receive by email.';
        }, 'primary')),
      h('div', { class: 'fld' }, h('label', {}, 'Already paid? Enter your license key'), key), msg, devs);
    modal({
      title: 'Unlock Photobook Studio', body: body, wide: true,
      buttons: [{ label: 'Not now' }, {
        label: 'Activate license', primary: true, onclick: async (close) => {
          const k = key.value.trim();
          if (!k) { msg.textContent = 'Paste your license key first.'; return; }
          msg.textContent = 'Checking…';
          const r = await api.licenseActivate(k);
          if (!r || !r.ok) {
            msg.style.color = '#e5645c'; msg.textContent = (r && r.error) || 'That key didn’t work.';
            devs.innerHTML = '';
            if (r && r.code === 'device_limit') {
              (r.devices || []).forEach((d) => devs.append(h('div', { class: 'devrow' },
                h('span', {}, (d.name || 'Computer') + (d.lastSeen ? ' · last used ' + new Date(d.lastSeen).toLocaleDateString() : '')),
                btn('Remove', 'x', async () => {
                  const rr = await api.licenseRemoveDevice(k, d.ref);
                  if (rr && rr.ok) { msg.style.color = ''; msg.textContent = 'Removed. Click Activate license again.'; devs.innerHTML = ''; }
                  else { msg.textContent = (rr && rr.error) || 'Could not remove that computer.'; }
                }, 'sm'))));
            }
            return;
          }
          LIC = r;
          close(); updateTop();
          toast('Thank you! Photobook Studio is unlocked for ' + r.email + '.');
          if (opts.fromExport) exportDialog();
        }
      }]
    });
  }

  function licenseDialog() {
    if (!LIC.licensed) { unlockDialog({}); return; }
    modal({
      title: 'Your license',
      body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        h('div', {}, 'Full version unlocked.'),
        h('div', { class: 'hint' }, 'Licensed to ' + LIC.email), h('div', { class: 'hint' }, 'Order: ' + LIC.id),
        LIC.serverMode ? h('div', { class: 'hint' }, 'Computers using this license: ' + (LIC.used || 1) + ' of ' + (LIC.max || '?') + '. This computer: ' + (LIC.deviceName || '')) : null,
        LIC.serverMode && LIC.expires ? h('div', { class: 'hint' }, 'Works offline until ' + new Date(LIC.expires).toLocaleDateString() + '. It renews automatically whenever you’re online.') : null,
        h('div', { class: 'hint' }, 'Deactivating returns this computer to the trial. You can enter the same key again at any time.')),
      buttons: [{ label: 'Deactivate this computer', onclick: async (close) => { LIC = await api.licenseDeactivate(); close(); updateTop(); toast('License removed from this computer.'); } }, { label: 'Close', primary: true }]
    });
  }

  function exportDialog() {
    if (!P) return;
    if (!LIC.licensed) { unlockDialog({ fromExport: true }); return; }
    const used = usedCounts();
    const missing = Object.keys(used).filter((id) => P.photos[id] && P.photos[id].missing).length;
    const fmt = h('select', {}, [['jpg', 'JPG — one file per spread (most labs)'], ['pdf', 'PDF — all spreads in one file']].map((o) => h('option', { value: o[0] }, o[1])));
    const dpi = h('select', {}, [[300, '300 dpi (print)'], [200, '200 dpi'], [150, '150 dpi (proofing)']].map((o) => h('option', { value: o[0] }, o[1])));
    const q = h('input', { type: 'range', min: 70, max: 100, step: 1, value: 92 });
    const qv = h('span', { class: 'val' }, '92%');
    q.addEventListener('input', () => { qv.textContent = q.value + '%'; });
    const bleed = h('select', {}, [[0, 'None'], [0.125, '0.125 in (3 mm)'], [0.25, '0.25 in (6 mm)']].map((o) => h('option', { value: o[0] }, o[1])));
    const cover = h('input', { type: 'checkbox', checked: true });
    const prefix = h('input', { type: 'text', value: P.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'album' });
    const d0 = PB.dims(P, P.spreads[1] || P.spreads[0]);
    const info = h('div', { class: 'hint' });
    const upd = () => { const bl = parseFloat(bleed.value); info.textContent = 'Each spread: ' + Math.round((d0.W + 2 * bl) * dpi.value) + ' × ' + Math.round((d0.H + 2 * bl) * dpi.value) + ' px'; };
    [dpi, bleed].forEach((e) => e.addEventListener('change', upd)); upd();
    modal({
      title: 'Export print files', wide: true,
      body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        missing ? h('div', { class: 'hint', style: { color: '#e5645c' } }, missing + ' used photo(s) are missing from disk and will print as low-resolution previews. Relink them first.') : null,
        fld('Format', fmt),
        h('div', { class: 'two' }, fld('Resolution', dpi), fld('Bleed (check your lab)', bleed)),
        fld('JPG quality', h('div', { class: 'row' }, q, qv)),
        info,
        fld('File name prefix', prefix),
        h('label', { class: 'chk' }, cover, 'Include the cover'),
        h('div', { class: 'hint' }, 'JPGs are numbered in order and tagged with the chosen dpi. Upload them to your lab’s album ordering page, or send the PDF for proofing.')),
      buttons: [{ label: 'Cancel' }, { label: 'Export…', primary: true, onclick: (close) => { close(); doExport({ format: fmt.value, dpi: parseInt(dpi.value, 10), quality: parseInt(q.value, 10), bleed: parseFloat(bleed.value), cover: cover.checked, prefix: prefix.value || 'album' }); } }]
    });
  }

  async function doExport(o) {
    if (!LIC.licensed) { unlockDialog({ fromExport: true }); return; }
    const spreads = P.spreads.filter((s) => o.cover || s.kind !== 'cover');
    if (!spreads.length) { toast('Nothing to export.'); return; }
    let dir = null, pdfPath = null;
    try {
      if (o.format === 'jpg') { dir = await api.pickExportDir(); if (!dir) return; }
      else { pdfPath = await api.pickPdfPath(P.name); if (!pdfPath) return; }
    } catch (e) { LIC = { licensed: false, email: '', id: '' }; updateTop(); unlockDialog({ fromExport: true }); return; }
    let cancelled = false;
    const bar = h('i', {}), label = h('div', { class: 'hint' }, 'Rendering…');
    const m = modal({ title: 'Exporting', persist: true, body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, h('div', { class: 'bar' }, bar), label), buttons: [{ label: 'Cancel', onclick: () => { cancelled = true; } }] });
    try {
      const pages = [];
      for (let i = 0; i < spreads.length; i++) {
        if (cancelled) break;
        const sp = spreads[i];
        label.textContent = 'Rendering ' + (i + 1) + ' of ' + spreads.length + '…';
        bar.style.width = (i / spreads.length * 100) + '%';
        const canvas = await PB.renderSpread(P, sp, { dpi: o.dpi, bleed: o.bleed, cancelled: () => cancelled });
        if (cancelled) break;
        const buf = await PB.canvasToBuffer(canvas, o.quality / 100);
        if (o.format === 'jpg') {
          const num = String(i + 1).padStart(2, '0');
          await api.exportWrite({ dir: dir, name: o.prefix + '_' + num + (sp.kind === 'cover' ? '_cover' : '') + '.jpg', data: buf, dpi: o.dpi });
        } else pages.push({ wIn: canvas.width / o.dpi, hIn: canvas.height / o.dpi, wPx: canvas.width, hPx: canvas.height, data: buf });
        canvas.width = canvas.height = 0;
      }
      if (!cancelled && o.format === 'pdf') { label.textContent = 'Writing PDF…'; await api.exportPdf({ file: pdfPath, pages: pages }); }
      m.close();
      if (cancelled) { toast('Export cancelled.'); return; }
      toast('Export finished', 'Show', () => api.reveal(o.format === 'jpg' ? dir : pdfPath), 8000);
    } catch (e) {
      m.close(); toast('Export failed: ' + e.message, null, null, 8000);
    }
  }

  function helpDialog() {
    const rows = [
      ['Ctrl+N / O / S', 'New / open / save'], ['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl+E', 'Export'],
      ['← / → (nothing selected)', 'Previous / next spread'], ['Arrows (frame selected)', 'Nudge (Shift = bigger)'],
      ['Delete', 'Delete selected frame(s)'], ['Ctrl+D', 'Duplicate frame'], ['Double-click a photo', 'Adjust crop (drag, scroll to zoom)'],
      ['Ctrl-drag frame onto frame', 'Swap the two photos'], ['Shift-click', 'Select several frames'], ['Alt while dragging', 'Turn off snapping'],
      ['Ctrl + scroll', 'Zoom the spread'], ['Esc', 'Finish crop / close preview'], ['1–5 (photo selected)', 'Star rating'], ['M / C / P', 'Flag Main / Cover / Panoramic'], ['F5', 'Preview']
    ];
    modal({
      title: 'Keyboard shortcuts', body: h('div', { class: 'kbd' }, rows.map((r) => [h('code', {}, r[0]), h('span', {}, r[1])])), buttons: [{ label: 'Close', primary: true }]
    });
  }

  // ---------- keyboard ----------
  function onKey(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' && e.target.type !== 'range' && e.target.type !== 'checkbox' || tag === 'textarea' || tag === 'select';
    const mod = e.ctrlKey || e.metaKey;
    const pv = $('#preview');
    if (!pv.hidden) {
      if (e.key === 'Escape') closePreview();
      else if (typing) return;
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') pv._go && pv._go(1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') pv._go && pv._go(-1);
      return;
    }
    if ($('#modalRoot').firstChild) { if (e.key === 'Escape') $('#modalRoot').lastChild.remove(); return; }
    if (mod && !typing) {
      const k = e.key.toLowerCase();
      if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (k === 'y') { e.preventDefault(); redo(); return; }
      if (k === 's') { e.preventDefault(); saveProject(e.shiftKey); return; }
      if (k === 'o') { e.preventDefault(); openProject(); return; }
      if (k === 'n') { e.preventDefault(); newProjectDialog(); return; }
      if (k === 'e') { e.preventDefault(); exportDialog(); return; }
      if (k === 'd') { e.preventDefault(); dupItems(); return; }
    }
    if (typing || !P) return;
    if (e.key === 'Escape') { if (U.crop) { U.crop = false; selChanged(); } else if (U.items.size) { U.items.clear(); selChanged(); } return; }
    if (e.key === 'F5') { e.preventDefault(); openPreview(false); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { if (U.items.size) { e.preventDefault(); delItems(); } return; }
    if (e.key.indexOf('Arrow') === 0) {
      e.preventDefault();
      if (U.items.size) {
        const st = (e.shiftKey ? 0.01 : 0.002), dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, dy = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0;
        checkpoint('nudge'); selItems().forEach((i) => { i.x += dx; i.y += dy; }); curSpread().lm = null; refresh('s'); touchFilm();
      } else if (e.key === 'ArrowLeft') gotoSpread(U.sel - 1);
      else if (e.key === 'ArrowRight') gotoSpread(U.sel + 1);
      return;
    }
    if (U.psel.size && /^[1-5]$/.test(e.key)) { setRating(Array.from(U.psel), parseInt(e.key, 10)); return; }
    if (U.psel.size && /^[mcp]$/i.test(e.key)) {
      const key = { m: 'main', c: 'cover', p: 'pano' }[e.key.toLowerCase()], ids = Array.from(U.psel);
      toggleFlag(ids, key, !ids.every((id) => P.photos[id].flags && P.photos[id].flags[key]));
    }
  }

  // ---------- init ----------
  function init() {
    buildTop();
    const stage = $('#stage');
    stage.addEventListener('pointerdown', onStageDown);
    stage.addEventListener('pointermove', onStageMove);
    stage.addEventListener('pointerup', onStageUp);
    stage.addEventListener('pointercancel', onStageUp);
    stage.addEventListener('dblclick', onStageDbl);
    const wrap = $('#stageWrap');
    wrap.addEventListener('wheel', onWheel, { passive: false });
    wrap.addEventListener('dragover', (e) => { if (e.dataTransfer.types.indexOf('text/pb') >= 0) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    wrap.addEventListener('drop', onStageDrop);
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap && U.items.size) { U.items.clear(); U.crop = false; selChanged(); } });
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', () => {
      if (P) { layoutStage(); if (!$('#preview').hidden && $('#preview')._fit) $('#preview')._fit(); }
    });
    if (window.ResizeObserver) new ResizeObserver(() => { if (P) layoutStage(); }).observe(wrap);
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());
    if (api.onDropFiles) api.onDropFiles((paths) => { if (P && paths.length) importPaths(paths); });
    setInterval(() => { if (P && dirty) api.autosave(JSON.stringify(P)).catch(() => {}); }, 30000);

    api.onMenu((cmd, arg) => {
      if (cmd === 'new') newProjectDialog();
      else if (cmd === 'open') openProject();
      else if (cmd === 'openPath') openProject(arg);
      else if (cmd === 'save') saveProject(false);
      else if (cmd === 'saveAs') saveProject(true);
      else if (cmd === 'importPhotos') { if (P) importPhotos(); }
      else if (cmd === 'importFolder') { if (P) importFolder(); }
      else if (cmd === 'export') exportDialog();
      else if (cmd === 'preview') { if (P) openPreview(false); }
      else if (cmd === 'client') { if (P) openPreview(true); }
      else if (cmd === 'help') helpDialog();
      else if (cmd === 'license') licenseDialog();
    });

    refreshLicense();
    if (api.onLicenseChanged) api.onLicenseChanged((info, reason) => {
      LIC = info; updateTop();
      toast(reason === 'revoked' ? 'This license was cancelled. The app is back in trial mode.'
        : reason === 'removed' ? 'This computer was removed from your license. Re-enter your key to activate it again.'
        : 'Please connect to the internet to renew your license.');
    });
    // empty placeholder project so the layout is visible behind the welcome dialog
    loadProject(PB.newProject({ name: 'Untitled album' }), null);
    startScreen();
    // use every font installed on this computer in the Text tool
    if (api.listFonts) {
      api.listFonts().then((list) => {
        if (!list || !list.length) return;
        const preferred = ['Switzer', 'Georgia', 'Times New Roman', 'Palatino', 'Helvetica Neue', 'Helvetica', 'Arial'];
        const have = new Set(list);
        const first = preferred.filter((f) => have.has(f));
        PB.fonts = ['Switzer'].concat(first.filter((f) => f !== 'Switzer'), list.filter((f) => first.indexOf(f) < 0 && f !== 'Switzer'));
        PB.fonts = PB.fonts.filter((f, i, a) => a.indexOf(f) === i);
        if (U.tab === 'frame') renderInspector();
      }).catch(() => {});
    }
  }

  window.PBApp = {
    get project() { return P; },
    state: U,
    loadProject: loadProject, importPaths: importPaths, doExport: doExport, newProjectDialog: newProjectDialog,
    refresh: refresh, gotoSpread: gotoSpread, undo: undo, redo: redo, checkpoint: checkpoint
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
