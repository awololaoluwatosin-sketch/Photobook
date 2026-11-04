'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const { pathToFileURL } = require('url');

let exifr = null;
try { exifr = require('exifr'); } catch (e) { /* optional */ }

// Photos are served through a CORS-enabled custom scheme so canvas export never gets "tainted".
protocol.registerSchemesAsPrivileged([
  { scheme: 'pbfile', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);
const toUrl = (p) => 'pbfile://local/' + encodeURIComponent(p);

let PUBLIC_KEY = '';
let APP_CONFIG = {};
try { PUBLIC_KEY = JSON.parse(fs.readFileSync(path.join(__dirname, 'license-public.json'), 'utf8')).publicKey || ''; } catch (e) { /* none */ }
try { APP_CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'app-config.json'), 'utf8')); } catch (e) { /* none */ }
let lic = null;                 // license client, created once the app is ready
let licReady = Promise.resolve();
const requireLicense = () => { if (!lic || !lic.isActive()) throw new Error('LICENSE_REQUIRED'); };

const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);
let win = null;
let dirty = false;
let forceQuit = false;
let pendingOpen = process.argv.find((a) => a.toLowerCase().endsWith('.pbook')) || null;

const cacheDir = () => path.join(app.getPath('userData'), 'cache');
const autosavePath = () => path.join(app.getPath('userData'), 'autosave.pbook');

function send(cmd, arg) {
  if (win && !win.isDestroyed()) win.webContents.send('menu', cmd, arg);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1560,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#141518',
    title: 'Photobook Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
      spellcheck: false
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('did-finish-load', () => {
    if (pendingOpen) { send('openPath', pendingOpen); pendingOpen = null; }
  });
  win.on('close', (e) => {
    if (dirty && !forceQuit) {
      const r = dialog.showMessageBoxSync(win, {
        type: 'question',
        buttons: ['Cancel', 'Quit without saving'],
        defaultId: 0,
        cancelId: 0,
        message: 'You have unsaved changes.',
        detail: 'An autosaved copy is kept, so you can recover it from the start screen.'
      });
      if (r === 0) e.preventDefault();
    }
  });
  win.on('closed', () => { win = null; });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const tpl = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New project…', click: () => send('new') },
        { label: 'Open project…', click: () => send('open') },
        { label: 'Save', click: () => send('save') },
        { label: 'Save as…', click: () => send('saveAs') },
        { type: 'separator' },
        { label: 'Import photos…', click: () => send('importPhotos') },
        { label: 'Import folder…', click: () => send('importFolder') },
        { type: 'separator' },
        { label: 'Export…', click: () => send('export') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { label: 'Edit', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    {
      label: 'View',
      submenu: [
        { label: 'Preview', click: () => send('preview') },
        { label: 'Client view', click: () => send('client') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }])
      ]
    },
    {
      label: 'Help',
      submenu: [{ label: 'License…', click: () => send('license') }, { label: 'Keyboard shortcuts', click: () => send('help') }]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

// ---------- photo stat / cache ----------
function idFor(p, st) {
  return crypto.createHash('sha1').update(p + '|' + st.size + '|' + st.mtimeMs).digest('hex').slice(0, 14);
}

ipcMain.handle('photos:stat', async (_e, items) => {
  await fsp.mkdir(cacheDir(), { recursive: true });
  const out = [];
  for (const it of items) {
    const p = it.path;
    try {
      const st = await fsp.stat(p);
      const id = it.id || idFor(p, st);
      const dir = cacheDir();
      const thumbP = path.join(dir, id + '_t.jpg');
      const proxyP = path.join(dir, id + '_p.jpg');
      const metaP = path.join(dir, id + '.json');
      let meta = null;
      try { meta = JSON.parse(await fsp.readFile(metaP, 'utf8')); } catch (e) { /* none */ }
      const has = !!(meta && fs.existsSync(thumbP) && fs.existsSync(proxyP));
      let time = st.mtimeMs;
      if (meta && meta.time) time = meta.time;
      else if (exifr) {
        try {
          const ex = await exifr.parse(p, ['DateTimeOriginal', 'CreateDate']);
          const d = ex && (ex.DateTimeOriginal || ex.CreateDate);
          if (d) time = new Date(d).getTime();
        } catch (e) { /* ignore */ }
      }
      out.push({
        ok: true, path: p, id, name: path.basename(p),
        url: toUrl(p),
        thumbUrl: toUrl(thumbP),
        proxyUrl: toUrl(proxyP),
        has, meta, time
      });
    } catch (e) {
      out.push({ ok: false, path: p, id: it.id, name: path.basename(p) });
    }
  }
  return out;
});

ipcMain.handle('cache:write', async (_e, id, kind, buf) => {
  await fsp.mkdir(cacheDir(), { recursive: true });
  await fsp.writeFile(path.join(cacheDir(), id + '_' + kind + '.jpg'), Buffer.from(buf));
  return true;
});
ipcMain.handle('cache:meta', async (_e, id, meta) => {
  await fsp.mkdir(cacheDir(), { recursive: true });
  await fsp.writeFile(path.join(cacheDir(), id + '.json'), JSON.stringify(meta));
  return true;
});

async function walk(dir, depth, out) {
  let entries = [];
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const en of entries) {
    const full = path.join(dir, en.name);
    if (en.isDirectory() && depth > 0 && !en.name.startsWith('.')) await walk(full, depth - 1, out);
    else if (en.isFile() && IMG_EXT.has(path.extname(en.name).toLowerCase())) out.push(full);
  }
}

// ---------- dialogs ----------
ipcMain.handle('dialog:photos', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Import photos',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }]
  });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('dialog:folder', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Import a folder of photos', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return [];
  const out = [];
  await walk(r.filePaths[0], 3, out);
  out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return out;
});
ipcMain.handle('dialog:logo', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Choose a logo or graphic',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return { path: r.filePaths[0], url: toUrl(r.filePaths[0]) };
});
ipcMain.handle('dialog:relink', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Locate the folder with your original photos', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return {};
  const found = [];
  await walk(r.filePaths[0], 6, found);
  const map = {};
  for (const f of found) map[path.basename(f).toLowerCase()] = f;
  return map;
});

// ---------- project files ----------
ipcMain.handle('project:save', async (_e, filePath, data, suggested) => {
  let target = filePath;
  if (!target) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Save project',
      defaultPath: (suggested || 'Album') + '.pbook',
      filters: [{ name: 'Photobook project', extensions: ['pbook'] }]
    });
    if (r.canceled || !r.filePath) return null;
    target = r.filePath;
  }
  await fsp.writeFile(target, data, 'utf8');
  return target;
});
ipcMain.handle('project:open', async (_e, filePath) => {
  let target = filePath;
  if (!target) {
    const r = await dialog.showOpenDialog(win, {
      title: 'Open project',
      properties: ['openFile'],
      filters: [{ name: 'Photobook project', extensions: ['pbook'] }]
    });
    if (r.canceled || !r.filePaths[0]) return null;
    target = r.filePaths[0];
  }
  const data = await fsp.readFile(target, 'utf8');
  return { path: target, data };
});
ipcMain.handle('project:autosave', async (_e, data) => {
  await fsp.writeFile(autosavePath(), data, 'utf8');
  return true;
});
ipcMain.handle('project:getAutosave', async () => {
  try {
    const st = await fsp.stat(autosavePath());
    const data = await fsp.readFile(autosavePath(), 'utf8');
    return { data, time: st.mtimeMs };
  } catch (e) { return null; }
});

// ---------- export ----------
function setJpegDpi(buf, dpi) {
  // Patch JFIF header density so print labs read the right resolution.
  if (buf.length > 18 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff && buf[3] === 0xe0 &&
      buf.toString('ascii', 6, 10) === 'JFIF') {
    buf[13] = 1;
    buf.writeUInt16BE(dpi, 14);
    buf.writeUInt16BE(dpi, 16);
  }
  return buf;
}

ipcMain.handle('export:dir', async () => {
  requireLicense();
  const r = await dialog.showOpenDialog(win, {
    title: 'Choose export folder', properties: ['openDirectory', 'createDirectory']
  });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('export:pdfPath', async (_e, name) => {
  requireLicense();
  const r = await dialog.showSaveDialog(win, {
    title: 'Export PDF', defaultPath: (name || 'Album') + '.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('export:write', async (_e, o) => {
  requireLicense();
  const safe = o.name.replace(/[\\/:*?"<>|]/g, '_');
  const target = path.join(o.dir, safe);
  await fsp.writeFile(target, setJpegDpi(Buffer.from(o.data), o.dpi || 300));
  return target;
});

function buildPdf(pages) {
  const chunks = [];
  const offsets = [];
  let pos = 0;
  const push = (b) => { const buf = Buffer.isBuffer(b) ? b : Buffer.from(b, 'latin1'); chunks.push(buf); pos += buf.length; };
  const obj = (n, body) => { offsets[n] = pos; push(`${n} 0 obj\n`); push(body); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const total = 2 + pages.length * 3;
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  pages.forEach((pg, i) => {
    const pn = 3 + i * 3, cn = pn + 1, im = pn + 2;
    const wPt = (pg.wIn * 72).toFixed(2), hPt = (pg.hIn * 72).toFixed(2);
    obj(pn, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${cn} 0 R >>`);
    const content = `q ${wPt} 0 0 ${hPt} 0 0 cm /Im0 Do Q`;
    obj(cn, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    offsets[im] = pos;
    push(`${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pg.wPx} /Height ${pg.hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.data.length} >>\nstream\n`);
    push(Buffer.from(pg.data));
    push('\nendstream\nendobj\n');
  });
  const xref = pos;
  push(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= total; n++) push(String(offsets[n]).padStart(10, '0') + ' 00000 n \n');
  push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(chunks);
}

ipcMain.handle('export:pdf', async (_e, o) => {
  requireLicense();
  await fsp.writeFile(o.file, buildPdf(o.pages));
  return o.file;
});

ipcMain.handle('license:status', async () => { await licReady; return lic.info(); });
ipcMain.handle('license:config', async () => ({
  productName: APP_CONFIG.productName || 'Photobook Studio', price: APP_CONFIG.price || '',
  buyUrl: /^https:\/\//i.test(APP_CONFIG.buyUrl || '') ? APP_CONFIG.buyUrl : '', supportEmail: APP_CONFIG.supportEmail || ''
}));
ipcMain.handle('license:activate', async (_e, key) => { await licReady; return lic.activate(key); });
ipcMain.handle('license:removeDevice', async (_e, key, ref) => { await licReady; return lic.removeDevice(key, ref); });
ipcMain.handle('license:check', async () => {
  await licReady;
  const r = await lic.check();
  return Object.assign({}, lic.info(), { changed: r.changed, reason: r.reason || '', offline: !!r.offline });
});
ipcMain.handle('license:deactivate', async () => { await licReady; return lic.deactivate(); });
ipcMain.handle('license:buy', async () => {
  const u = APP_CONFIG.buyUrl || '';
  if (!/^https:\/\//i.test(u)) return false;
  await shell.openExternal(u);
  return true;
});
ipcMain.handle('fonts:list', async () => {
  try {
    const { getFonts } = require('font-list');
    const list = await getFonts({ disableQuoting: true });
    return Array.from(new Set(list.map((f) => String(f).replace(/^"|"$/g, '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  } catch (e) { return []; }
});
ipcMain.handle('shell:reveal', async (_e, p) => { shell.showItemInFolder(p); return true; });
ipcMain.on('app:dirty', (_e, v) => { dirty = !!v; });

app.on('open-file', (e, p) => { e.preventDefault(); if (win) send('openPath', p); else pendingOpen = p; });

app.whenReady().then(() => {
  lic = require('./license-client').create({
    userData: app.getPath('userData'), net, publicKey: PUBLIC_KEY, config: APP_CONFIG,
    onChange: (info, reason) => { if (win && !win.isDestroyed()) win.webContents.send('license:changed', info, reason); }
  });
  licReady = lic.init().then(() => lic.startTimers());
  protocol.handle('pbfile', async (req) => {
    try {
      const p = decodeURIComponent(new URL(req.url).pathname.slice(1));
      if (!IMG_EXT.has(path.extname(p).toLowerCase())) return new Response('Forbidden', { status: 403 });
      const res = await net.fetch(pathToFileURL(p).href);
      const headers = new Headers(res.headers);
      headers.set('access-control-allow-origin', '*');
      return new Response(res.body, { status: res.status, headers });
    } catch (e) { return new Response('Not found', { status: 404 }); }
  });
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('before-quit', () => { forceQuit = false; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
