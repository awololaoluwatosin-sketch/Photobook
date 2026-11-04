'use strict';
/* Core model + math shared by the editor, previews and the exporter. */
window.PB = window.PB || {};
(function (PB) {
  PB.uid = (p = 'i') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  PB.clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // Small seeded RNG (mulberry32) so "shuffle" results are reproducible.
  PB.rng = function (seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  PB.newSpread = function (kind, bg) {
    return { id: PB.uid('s'), kind: kind || 'spread', bg: bg || '#ffffff', items: [], comment: '', approved: false, lm: null };
  };

  PB.newProject = function (o) {
    return {
      version: 1,
      name: o.name || 'Untitled album',
      pageW: o.pageW || 12,
      pageH: o.pageH || 12,
      margin: o.margin == null ? 0.5 : o.margin,
      gap: o.gap == null ? 0.2 : o.gap,
      photos: {},
      photoOrder: [],
      spreads: [PB.newSpread('cover'), PB.newSpread('spread')],
      created: Date.now()
    };
  };

  // Spread size in inches. The cover is a single page; spreads are two pages.
  PB.dims = function (p, s) {
    return s.kind === 'cover' ? { W: p.pageW, H: p.pageH } : { W: p.pageW * 2, H: p.pageH };
  };

  PB.photoItem = function (photoId, x, y, w, h) {
    return {
      id: PB.uid('f'), type: 'photo', x: x, y: y, w: w, h: h, photoId: photoId || null,
      zoom: 1, cx: 0.5, cy: 0.5, border: 0, borderColor: '#ffffff', radius: 0, opacity: 1
    };
  };
  PB.textItem = function (x, y, w, h) {
    return {
      id: PB.uid('t'), type: 'text', x: x, y: y, w: w, h: h, text: 'Your title',
      font: 'Switzer', size: 36, color: '#222222', align: 'center', bold: false, italic: false, opacity: 1
    };
  };
  PB.logoItem = function (url, path, ratio, x, y, w) {
    return { id: PB.uid('l'), type: 'logo', x: x, y: y, w: w, h: w, url: url, path: path, ratio: ratio || 1, opacity: 1 };
  };

  // Where the photo sits inside its frame. fW/fH = frame size in inches.
  // Returns the image-pixel crop and CSS percentages for an <img> inside the frame.
  PB.photoView = function (item, photo, fW, fH) {
    const iw = photo.w, ih = photo.h;
    const zoom = Math.max(1, item.zoom || 1);
    const s = Math.max(fW / iw, fH / ih) * zoom; // inches per image pixel
    const visW = fW / s, visH = fH / s;
    let cx = (item.cx == null ? 0.5 : item.cx) * iw;
    let cy = (item.cy == null ? 0.5 : item.cy) * ih;
    cx = PB.clamp(cx, visW / 2, iw - visW / 2);
    cy = PB.clamp(cy, visH / 2, ih - visH / 2);
    return {
      s: s, sx: cx - visW / 2, sy: cy - visH / 2, sw: visW, sh: visH, cx: cx / iw, cy: cy / ih,
      imgWpct: (iw * s) / fW * 100, imgHpct: (ih * s) / fH * 100,
      leftPct: -((cx - visW / 2) * s) / fW * 100, topPct: -((cy - visH / 2) * s) / fH * 100
    };
  };

  PB.loadImage = function (url) {
    return new Promise(function (res, rej) {
      const i = new Image();
      if (String(url).indexOf('pbfile:') === 0) i.crossOrigin = 'anonymous';
      i.onload = function () { res(i); };
      i.onerror = function () { rej(new Error('Could not load ' + url)); };
      i.src = url;
    });
  };

  PB.fonts = ['Switzer', 'Georgia', 'Times New Roman', 'Palatino Linotype', 'Arial', 'Helvetica', 'Verdana', 'Trebuchet MS', 'Courier New', 'Brush Script MT'];
  PB.sizes = [
    ['8 × 8 in', 8, 8], ['10 × 10 in', 10, 10], ['12 × 12 in', 12, 12], ['14 × 14 in', 14, 14],
    ['10 × 8 in (landscape)', 10, 8], ['12 × 9 in (landscape)', 12, 9], ['14 × 11 in (landscape)', 14, 11],
    ['8 × 10 in (portrait)', 8, 10], ['11 × 14 in (portrait)', 11, 14], ['Custom', 0, 0]
  ];
})(window.PB);
