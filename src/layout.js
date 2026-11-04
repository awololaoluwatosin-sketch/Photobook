'use strict';
/* Layout engine: preset layouts, a template-free layout generator, and the album auto-designer. */
(function (PB) {
  const clamp = PB.clamp;
  const E = 1e-6;

  // ---------- presets (cells are fractions of the spread / page) ----------
  const t3 = 1 / 3;
  function grid(c, r) {
    const a = [];
    for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) a.push([i / c, j / r, 1 / c, 1 / r]);
    return a;
  }
  function build(defs) {
    const out = [];
    defs.forEach(function (d) {
      const o = d[2] || {};
      out.push(Object.assign({ name: d[0], cells: d[1] }, o.edgeToo ? Object.assign({}, o, { edgeToo: undefined }) : o));
      // edge-to-edge twin: photos run to the sheet edge, only the gap between photos remains
      if (o.edgeToo && !o.full) out.push({ name: d[0] + ' · edge', cells: d[1], edge: true });
    });
    return out;
  }
  PB.presets = {
    spread: build([
      ['Full bleed', [[0, 0, 1, 1]], { full: true }],
      ['Framed spread', [[0, 0, 1, 1]]],
      ['Right page', [[0.5, 0, 0.5, 1]], { perPage: true }],
      ['Left page', [[0, 0, 0.5, 1]], { perPage: true }],
      ['Centre panel', [[0.2, 0, 0.6, 1]]],
      ['Wide band', [[0, 0.16, 1, 0.68]]],
      ['Two pages', [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]], { perPage: true, edgeToo: true }],
      ['Two full bleed', [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]], { full: true }],
      ['Big + small', [[0, 0, 0.65, 1], [0.65, 0, 0.35, 1]], { edgeToo: true }],
      ['Small + big', [[0, 0, 0.35, 1], [0.35, 0, 0.65, 1]], { edgeToo: true }],
      ['Stacked', [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]], { edgeToo: true }],
      ['Wide + strip', [[0, 0, 1, 0.7], [0, 0.7, 1, 0.3]], { edgeToo: true }],
      ['Hero + 2', [[0, 0, 0.62, 1], [0.62, 0, 0.38, 0.5], [0.62, 0.5, 0.38, 0.5]], { edgeToo: true }],
      ['2 + Hero', [[0, 0, 0.38, 0.5], [0, 0.5, 0.38, 0.5], [0.38, 0, 0.62, 1]], { edgeToo: true }],
      ['Page + 2', [[0, 0, 0.5, 1], [0.5, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]], { perPage: true }],
      ['Wide + 2', [[0, 0, 1, 0.62], [0, 0.62, 0.5, 0.38], [0.5, 0.62, 0.5, 0.38]], { edgeToo: true }],
      ['Triptych', [[0, 0, 0.25, 1], [0.25, 0, 0.5, 1], [0.75, 0, 0.25, 1]], { edgeToo: true }],
      ['Three across', [[0, 0, t3, 1], [t3, 0, t3, 1], [2 * t3, 0, t3, 1]], { edgeToo: true }],
      ['Three rows', [[0, 0, 1, t3], [0, t3, 1, t3], [0, 2 * t3, 1, t3]], { edgeToo: true }],
      ['Hero + 3', [[0, 0, 0.55, 1], [0.55, 0, 0.45, 0.5], [0.55, 0.5, 0.225, 0.5], [0.775, 0.5, 0.225, 0.5]], { edgeToo: true }],
      ['Wide + 3', [[0, 0, 1, 0.6], [0, 0.6, t3, 0.4], [t3, 0.6, t3, 0.4], [2 * t3, 0.6, t3, 0.4]], { edgeToo: true }],
      ['Large + 3 stack', [[0, 0, 0.7, 1], [0.7, 0, 0.3, t3], [0.7, t3, 0.3, t3], [0.7, 2 * t3, 0.3, t3]], { edgeToo: true }],
      ['Page + 3', [[0, 0, 0.5, 1], [0.5, 0, 0.5, 0.5], [0.5, 0.5, 0.25, 0.5], [0.75, 0.5, 0.25, 0.5]], { perPage: true }],
      ['Four columns', grid(4, 1), { edgeToo: true }],
      ['Four grid', grid(2, 2), { edgeToo: true }],
      ['Mosaic 5', [[0, 0, 0.5, 1], [0.5, 0, 0.25, 0.5], [0.75, 0, 0.25, 0.5], [0.5, 0.5, 0.25, 0.5], [0.75, 0.5, 0.25, 0.5]], { perPage: true, edgeToo: true }],
      ['Centre hero + 4', [[0.25, 0, 0.5, 1], [0, 0, 0.25, 0.5], [0, 0.5, 0.25, 0.5], [0.75, 0, 0.25, 0.5], [0.75, 0.5, 0.25, 0.5]], { edgeToo: true }],
      ['2 over 3', [[0, 0, 0.5, 0.55], [0.5, 0, 0.5, 0.55], [0, 0.55, t3, 0.45], [t3, 0.55, t3, 0.45], [2 * t3, 0.55, t3, 0.45]], { edgeToo: true }],
      ['Wide + 4', [[0, 0, 1, 0.55], [0, 0.55, 0.25, 0.45], [0.25, 0.55, 0.25, 0.45], [0.5, 0.55, 0.25, 0.45], [0.75, 0.55, 0.25, 0.45]], { edgeToo: true }],
      ['Five columns', grid(5, 1), { edgeToo: true }],
      ['Grid of 6', grid(3, 2), { edgeToo: true }],
      ['Hero + 5', [[0, 0, 0.5, 1], [0.5, 0, 0.5, 0.4], [0.5, 0.4, 0.25, 0.3], [0.75, 0.4, 0.25, 0.3], [0.5, 0.7, 0.25, 0.3], [0.75, 0.7, 0.25, 0.3]], { edgeToo: true }],
      ['Pages 3 + 3', [[0, 0, 0.5, t3], [0, t3, 0.5, t3], [0, 2 * t3, 0.5, t3], [0.5, 0, 0.5, t3], [0.5, t3, 0.5, t3], [0.5, 2 * t3, 0.5, t3]], { perPage: true }],
      ['Hero + 6', [[0, 0, 0.4, 1], [0.4, 0, 0.2, 0.5], [0.6, 0, 0.2, 0.5], [0.8, 0, 0.2, 0.5], [0.4, 0.5, 0.2, 0.5], [0.6, 0.5, 0.2, 0.5], [0.8, 0.5, 0.2, 0.5]], { edgeToo: true }],
      ['Grid of 8', grid(4, 2), { edgeToo: true }],
      ['Grid of 9', grid(3, 3), { edgeToo: true }],
      ['Grid of 10', grid(5, 2), { edgeToo: true }],
      ['Grid of 12', grid(4, 3), { edgeToo: true }]
    ]),
    cover: build([
      ['Full bleed', [[0, 0, 1, 1]], { full: true }],
      ['Framed', [[0, 0, 1, 1]]],
      ['Centre frame', [[0.12, 0.12, 0.76, 0.76]], { full: true }],
      ['Top band', [[0, 0, 1, 0.58]], { full: true }],
      ['Two stacked', [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]], { edgeToo: true }],
      ['Side by side', [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]], { edgeToo: true }],
      ['Hero + 2', [[0, 0, 1, 0.64], [0, 0.64, 0.5, 0.36], [0.5, 0.64, 0.5, 0.36]], { edgeToo: true }],
      ['Wide + strip', [[0, 0, 1, 0.75], [0, 0.75, 1, 0.25]], { edgeToo: true }],
      ['Three rows', [[0, 0, 1, t3], [0, t3, 1, t3], [0, 2 * t3, 1, t3]], { edgeToo: true }],
      ['Hero + 3', [[0, 0, 1, 0.6], [0, 0.6, t3, 0.4], [t3, 0.6, t3, 0.4], [2 * t3, 0.6, t3, 0.4]], { edgeToo: true }],
      ['Grid of 4', grid(2, 2), { edgeToo: true }],
      ['Grid of 6', grid(2, 3), { edgeToo: true }],
      ['Grid of 9', grid(3, 3), { edgeToo: true }]
    ])
  };

  function inset(cells, W, H, m, g) {
    const cx = m / W, cy = m / H, cw = 1 - 2 * cx, ch = 1 - 2 * cy;
    const hx = g / 2 / (cw * W), hy = g / 2 / (ch * H);
    return cells.map(function (c) {
      let l = c[0], t = c[1], r = c[0] + c[2], b = c[1] + c[3];
      if (l > E) l += hx;
      if (t > E) t += hy;
      if (r < 1 - E) r -= hx;
      if (b < 1 - E) b -= hy;
      return { x: cx + l * cw, y: cy + t * ch, w: (r - l) * cw, h: (b - t) * ch };
    });
  }

  // Returns rects (fractions of the spread) for a preset, honouring margin + gap in inches.
  PB.applyPreset = function (preset, W, H, m, g) {
    const cells = preset.cells;
    if (preset.full) return cells.map(function (c) { return { x: c[0], y: c[1], w: c[2], h: c[3] }; });
    if (preset.edge) return inset(cells, W, H, 0, g);
    if (!preset.perPage) return inset(cells, W, H, m, g);
    const res = new Array(cells.length);
    [0, 1].forEach(function (pg) {
      const px = pg * 0.5;
      const idx = [];
      cells.forEach(function (c, i) { if ((c[0] < 0.5 - E ? 0 : 1) === pg) idx.push(i); });
      if (!idx.length) return;
      const local = idx.map(function (i) { const c = cells[i]; return [(c[0] - px) / 0.5, c[1], c[2] / 0.5, c[3]]; });
      const r = inset(local, W / 2, H, m, g);
      idx.forEach(function (i, k) { res[i] = { x: px + r[k].x * 0.5, y: r[k].y, w: r[k].w * 0.5, h: r[k].h }; });
    });
    return res;
  };

  // ---------- template-free generator ----------
  const leafA = function (p) { return clamp(p.w / p.h, 0.4, 3.5); };
  function nat(n) {
    if (n.leaf) return leafA(n.leaf);
    const a = nat(n.a), b = nat(n.b);
    return n.dir === 'h' ? a + b : 1 / (1 / a + 1 / b);
  }
  function place(n, x, y, w, h, g, out) {
    if (n.leaf) { out.push({ p: n.leaf, x: x, y: y, w: w, h: h }); return; }
    const a = nat(n.a), b = nat(n.b);
    if (n.dir === 'h') {
      const av = Math.max(0, w - g), wa = av * a / (a + b);
      place(n.a, x, y, wa, h, g, out);
      place(n.b, x + wa + g, y, av - wa, h, g, out);
    } else {
      const av = Math.max(0, h - g), ia = 1 / a, ib = 1 / b, ha = av * ia / (ia + ib);
      place(n.a, x, y, w, ha, g, out);
      place(n.b, x, y + ha + g, w, av - ha, g, out);
    }
  }
  function randTree(list, rng) {
    if (list.length === 1) return { leaf: list[0] };
    let k = rng() < 0.6 ? Math.round(list.length / 2) : 1 + Math.floor(rng() * (list.length - 1));
    k = clamp(k, 1, list.length - 1);
    return { dir: rng() < 0.5 ? 'h' : 'v', a: randTree(list.slice(0, k), rng), b: randTree(list.slice(k), rng) };
  }
  function score(fr, W, H, single, rng) {
    let s = 0;
    const areas = fr.map(function (f) { return f.w * f.h; });
    const avg = areas.reduce(function (a, b) { return a + b; }, 0) / fr.length;
    fr.forEach(function (f, i) {
      const fl = f.p.flags || {};
      const fa = f.w / f.h, pa = f.p.w / f.p.h;
      s += Math.abs(Math.log(fa / pa)) * (fl.pano ? 2 : 1);
      if (Math.min(f.w, f.h) < 1.3) s += 1.5;
      if (fl.main && areas[i] < avg * 1.25) s += 0.6;
      if (!single && !fl.pano && f.x < W / 2 - 0.4 && f.x + f.w > W / 2 + 0.4) s += 0.5;
    });
    const mx = Math.max.apply(null, areas), mn = Math.min.apply(null, areas);
    s += Math.max(0, Math.log(mx / mn) - 1.2) * 0.4;
    return s + rng() * 0.2;
  }

  // photos: [{id,w,h,flags}] in reading order. Returns frames as fractions of the spread.
  PB.genLayout = function (photos, W, H, o, rng) {
    const m = o.margin, g = o.gap, n = photos.length, single = !!o.single;
    const toFrac = function (fr) {
      return fr.map(function (f) { return { photoId: f.p.id, x: f.x / W, y: f.y / H, w: f.w / W, h: f.h / H }; });
    };
    if (n === 0) return [];
    if (n === 1) {
      const p = photos[0], a = p.w / p.h, fl = p.flags || {};
      if (single || a >= 1.8 || fl.pano) return [{ photoId: p.id, x: 0, y: 0, w: 1, h: 1 }];
      if (a >= 1.25) {
        const cw = W - 2 * m, ch = H - 2 * m;
        let w = cw, h = w / a;
        if (h > ch) { h = ch; w = h * a; }
        return [{ photoId: p.id, x: (W - w) / 2 / W, y: (H - h) / 2 / H, w: w / W, h: h / H }];
      }
      const pg = rng() < 0.5 ? 0 : 1, cw = W / 2 - 2 * m, ch = H - 2 * m;
      let h = ch, w = h * a;
      if (w > cw) { w = cw; h = w / a; }
      const px = pg * W / 2 + W / 4;
      return [{ photoId: p.id, x: (px - w / 2) / W, y: (H - h) / 2 / H, w: w / W, h: h / H }];
    }
    let best = null, bs = 1e9;
    const tries = n <= 2 ? 40 : n <= 4 ? 120 : 240;
    for (let t = 0; t < tries; t++) {
      const frames = [];
      const split = !single && rng() < 0.45;
      if (split) {
        const k = 1 + Math.floor(rng() * (n - 1));
        const pw = W / 2 - 2 * m, ph = H - 2 * m;
        place(randTree(photos.slice(0, k), rng), m, m, pw, ph, g, frames);
        place(randTree(photos.slice(k), rng), W / 2 + m, m, pw, ph, g, frames);
      } else {
        place(randTree(photos, rng), m, m, W - 2 * m, H - 2 * m, g, frames);
      }
      const s = score(frames, W, H, single, rng);
      if (s < bs) { bs = s; best = frames; }
    }
    return toFrac(best);
  };

  // Rebuild the photo frames of one spread with the generator (keeps text/logos).
  PB.relayout = function (project, spread, seed, extraIds) {
    const d = PB.dims(project, spread);
    const rng = PB.rng(seed || Date.now());
    const ids = spread.items.filter(function (i) { return i.type === 'photo' && i.photoId; }).map(function (i) { return i.photoId; });
    (extraIds || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    const photos = ids.map(function (id) { return Object.assign({ id: id }, project.photos[id]); }).filter(function (p) { return p.w; });
    const o = { margin: spread.margin == null ? project.margin : spread.margin, gap: spread.gap == null ? project.gap : spread.gap, single: spread.kind === 'cover' };
    const frames = PB.genLayout(photos, d.W, d.H, o, rng);
    const old = {};
    spread.items.forEach(function (i) { if (i.type === 'photo' && i.photoId) old[i.photoId] = i; });
    const others = spread.items.filter(function (i) { return i.type !== 'photo'; });
    const items = frames.map(function (f) {
      const it = PB.photoItem(f.photoId, f.x, f.y, f.w, f.h);
      const prev = old[f.photoId];
      if (prev) { it.border = prev.border; it.borderColor = prev.borderColor; it.radius = prev.radius; it.opacity = prev.opacity; }
      return it;
    });
    spread.items = items.concat(others);
    spread.lm = { kind: 'gen', seed: seed };
  };

  PB.applyPresetToSpread = function (project, spread, idx) {
    const list = PB.presets[spread.kind === 'cover' ? 'cover' : 'spread'];
    const preset = list[idx];
    const d = PB.dims(project, spread);
    const m = spread.margin == null ? project.margin : spread.margin;
    const g = spread.gap == null ? project.gap : spread.gap;
    const rects = PB.applyPreset(preset, d.W, d.H, m, g);
    const photoItems = spread.items.filter(function (i) { return i.type === 'photo'; });
    const others = spread.items.filter(function (i) { return i.type !== 'photo'; });
    const items = rects.map(function (r, i) {
      const old = photoItems[i];
      if (old) { old.x = r.x; old.y = r.y; old.w = r.w; old.h = r.h; return old; }
      return PB.photoItem(null, r.x, r.y, r.w, r.h);
    });
    spread.items = items.concat(others);
    spread.lm = { kind: 'preset', idx: idx };
    return photoItems.length - rects.length; // >0 = photos that no longer fit
  };

  // ---------- album auto-designer ----------
  PB.autoDesign = function (project, ids, o) {
    const rng = PB.rng(o.seed || Date.now());
    const photos = ids.map(function (id) { return Object.assign({ id: id }, project.photos[id]); }).filter(function (p) { return p.w; });
    const out = [];
    const list = photos.slice();
    const bg = o.bg || '#ffffff';
    if (o.cover && list.length) {
      let ci = list.findIndex(function (p) { return p.flags && p.flags.cover; });
      if (ci < 0) {
        let bs = -1;
        list.forEach(function (p, i) {
          const a = p.w / p.h;
          const s = (p.flags && p.flags.main ? 10 : 0) + (p.rating || 0) + (a > 0.8 && a < 1.6 ? 1 : 0);
          if (s > bs) { bs = s; ci = i; }
        });
      }
      const c = list.splice(ci, 1)[0];
      const cv = PB.newSpread('cover', bg);
      cv.items = [PB.photoItem(c.id, 0, 0, 1, 1)];
      cv.lm = { kind: 'preset', idx: 0 };
      out.push(cv);
    }
    const min = Math.max(1, o.perMin || 2), max = Math.max(min, o.perMax || 4);
    let avg = (min + max) / 2;
    if (o.target) avg = Math.max(1, list.length / o.target);
    const groups = [];
    let i = 0;
    while (i < list.length) {
      const p = list[i], fl = p.flags || {};
      let want;
      if (fl.pano) want = 1 + (rng() < 0.5 ? 1 : 0);
      else if (fl.main) want = 2 + (rng() < 0.4 ? 1 : 0);
      else want = Math.round(avg + (rng() - 0.5) * (max - min + 0.9));
      want = clamp(want, 1, Math.max(max, 3));
      const g = [p];
      let j = i + 1;
      while (g.length < want && j < list.length) {
        const q = list[j];
        if (q.time && g[g.length - 1].time && q.time - g[g.length - 1].time > 40 * 60000 && g.length >= min) break;
        if (q.flags && q.flags.pano && g.length >= 1) break;
        g.push(q); j++;
      }
      groups.push(g);
      i = j;
    }
    if (groups.length > 1) {
      const last = groups[groups.length - 1];
      if (last.length < min && groups[groups.length - 2].length + last.length <= max + 1) {
        groups[groups.length - 2] = groups[groups.length - 2].concat(groups.pop());
      }
    }
    groups.forEach(function (g) {
      const sp = PB.newSpread('spread', bg);
      sp.margin = o.margin; sp.gap = o.gap;
      const seed = Math.floor(rng() * 1e9);
      const d = PB.dims(project, sp);
      const frames = PB.genLayout(g, d.W, d.H, { margin: o.margin, gap: o.gap }, PB.rng(seed));
      sp.items = frames.map(function (f) { return PB.photoItem(f.photoId, f.x, f.y, f.w, f.h); });
      sp.lm = { kind: 'gen', seed: seed };
      out.push(sp);
    });
    return out;
  };
})(window.PB);
