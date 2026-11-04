'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const inv = (ch, ...a) => ipcRenderer.invoke(ch, ...a);

// Files dropped from the desktop: resolve real paths here (File objects can't cross the bridge).
let dropCb = null;
window.addEventListener('drop', (e) => {
  const files = e.dataTransfer && e.dataTransfer.files;
  if (!files || !files.length || !dropCb) return;
  const paths = [];
  for (const f of files) {
    try { const p = webUtils.getPathForFile(f); if (p && /\.(jpe?g|png|webp|bmp|gif)$/i.test(p)) paths.push(p); } catch (err) { /* ignore */ }
  }
  if (paths.length) dropCb(paths);
});

contextBridge.exposeInMainWorld('api', {
  stat: (items) => inv('photos:stat', items),
  cacheWrite: (id, kind, buf) => inv('cache:write', id, kind, buf),
  cacheMeta: (id, meta) => inv('cache:meta', id, meta),
  pickPhotos: () => inv('dialog:photos'),
  pickFolder: () => inv('dialog:folder'),
  pickLogo: () => inv('dialog:logo'),
  pickRelink: () => inv('dialog:relink'),
  saveProject: (filePath, data, suggested) => inv('project:save', filePath, data, suggested),
  openProject: (filePath) => inv('project:open', filePath),
  autosave: (data) => inv('project:autosave', data),
  getAutosave: () => inv('project:getAutosave'),
  pickExportDir: () => inv('export:dir'),
  pickPdfPath: (name) => inv('export:pdfPath', name),
  exportWrite: (o) => inv('export:write', o),
  exportPdf: (o) => inv('export:pdf', o),
  licenseStatus: () => inv('license:status'),
  licenseConfig: () => inv('license:config'),
  licenseActivate: (k) => inv('license:activate', k),
  licenseRemoveDevice: (k, ref) => inv('license:removeDevice', k, ref),
  licenseCheck: () => inv('license:check'),
  onLicenseChanged: (cb) => ipcRenderer.on('license:changed', (_e, info, reason) => cb(info, reason)),
  licenseDeactivate: () => inv('license:deactivate'),
  licenseBuy: () => inv('license:buy'),
  listFonts: () => inv('fonts:list'),
  reveal: (p) => inv('shell:reveal', p),
  setDirty: (v) => ipcRenderer.send('app:dirty', v),
  onMenu: (cb) => ipcRenderer.on('menu', (_e, cmd, arg) => cb(cmd, arg)),
  onDropFiles: (cb) => { dropCb = cb; }
});
