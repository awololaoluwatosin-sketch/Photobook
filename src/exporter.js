'use strict';
/* Renders a spread to a canvas at print resolution, then exports JPGs / PDF. */
(function (PB) {
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    if (r > 0 && ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }

  function wrapLines(ctx, text, maxW) {
    const lines = [];
    String(text).split('\n').forEach(function (para) {
      const words = para.split(' ');
      let line = '';
      words.forEach(function (w) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
      });
      lines.push(line);
    });
    return lines;
  }

  // opts: dpi, bleed (inches). Returns a canvas.
  PB.renderSpread = async function (project, spread, opts) {
    const dpi = opts.dpi || 300, b = opts.bleed || 0;
    const d = PB.dims(project, spread);
    const cw = Math.round((d.W + 2 * b) * dpi), ch = Math.round((d.H + 2 * b) * dpi);
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = spread.bg || '#fff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingQuality = 'high';
    const E = 0.002;

    for (let n = 0; n < spread.items.length; n++) {
      if (opts.cancelled && opts.cancelled()) break;
      const it = spread.items[n];
      let x0 = it.x * d.W, y0 = it.y * d.H, x1 = (it.x + it.w) * d.W, y1 = (it.y + it.h) * d.H;
      if (it.type === 'photo') { // frames that touch the trim edge run out into the bleed
        if (it.x <= E) x0 -= b;
        if (it.y <= E) y0 -= b;
        if (it.x + it.w >= 1 - E) x1 += b;
        if (it.y + it.h >= 1 - E) y1 += b;
      }
      const fW = x1 - x0, fH = y1 - y0;
      const X = (x0 + b) * dpi, Y = (y0 + b) * dpi, Wp = fW * dpi, Hp = fH * dpi;
      ctx.save();
      ctx.globalAlpha = it.opacity == null ? 1 : it.opacity;
      if (it.type === 'photo') {
        const photo = it.photoId ? project.photos[it.photoId] : null;
        if (photo) {
          roundRect(ctx, X, Y, Wp, Hp, (it.radius || 0) * dpi);
          ctx.clip();
          let img = null;
          try { img = await PB.loadImage(photo.missing ? photo.proxy : photo.url); }
          catch (e) { try { img = await PB.loadImage(photo.proxy); } catch (e2) { img = null; } }
          if (img) {
            const v = PB.photoView(it, { w: img.naturalWidth, h: img.naturalHeight }, fW, fH);
            ctx.drawImage(img, v.sx, v.sy, v.sw, v.sh, X, Y, Wp, Hp);
            img.src = '';
          } else {
            ctx.fillStyle = '#cccccc'; ctx.fillRect(X, Y, Wp, Hp);
          }
          if (it.border > 0) {
            ctx.restore(); ctx.save();
            ctx.globalAlpha = it.opacity == null ? 1 : it.opacity;
            const bw = it.border * dpi;
            ctx.strokeStyle = it.borderColor || '#fff';
            ctx.lineWidth = bw * 2;
            roundRect(ctx, X, Y, Wp, Hp, (it.radius || 0) * dpi);
            ctx.clip();
            ctx.stroke();
          }
        }
        // empty frames are not printed
      } else if (it.type === 'logo') {
        try {
          const img = await PB.loadImage(it.url);
          const ar = img.naturalWidth / img.naturalHeight;
          let w = Wp, h = w / ar;
          if (h > Hp) { h = Hp; w = h * ar; }
          ctx.drawImage(img, X + (Wp - w) / 2, Y + (Hp - h) / 2, w, h);
          img.src = '';
        } catch (e) { /* skip missing graphic */ }
      } else if (it.type === 'text') {
        try { await document.fonts.load('16px "' + (it.font || 'Georgia') + '"'); } catch (er) { /* ignore */ }
        const size = (it.size || 24) / 72 * dpi;
        ctx.fillStyle = it.color || '#000';
        ctx.font = (it.italic ? 'italic ' : '') + (it.bold ? 'bold ' : '') + size + 'px "' + (it.font || 'Georgia') + '", serif';
        ctx.textBaseline = 'top';
        ctx.textAlign = it.align || 'left';
        const lines = wrapLines(ctx, it.text || '', Wp);
        const lh = size * 1.25;
        const tx = it.align === 'center' ? X + Wp / 2 : it.align === 'right' ? X + Wp : X;
        lines.forEach(function (ln, i) { ctx.fillText(ln, tx, Y + i * lh + (lh - size) / 2 * 0.5); });
      }
      ctx.restore();
    }
    return canvas;
  };

  PB.canvasToBuffer = function (canvas, quality) {
    return new Promise(function (res, rej) {
      canvas.toBlob(function (blob) {
        if (!blob) return rej(new Error('Could not encode image'));
        blob.arrayBuffer().then(res, rej);
      }, 'image/jpeg', quality);
    });
  };
})(window.PB);
