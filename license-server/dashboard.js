'use strict';
/* License dashboard. Talks to /admin/* with your ADMIN_TOKEN, kept only in this browser tab (sessionStorage).
   Everything from the server is inserted as text (never HTML) because customers control their computer names. */
(function () {
  const app = document.getElementById('app');
  let token = ''; try { token = sessionStorage.getItem('pb_admin') || ''; } catch (e) { /* ignore */ }
  let licenses = [], filter = '', open = {};

  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    for (const k in (attrs || {})) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v); }
    kids.flat(Infinity).forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return el;
  };
  const date = (t) => t ? new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '–';
  const ago = (t) => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 60000); if (m < 2) return 'just now'; if (m < 120) return m + ' min ago'; const hr = Math.round(m / 60); if (hr < 48) return hr + ' h ago'; return Math.round(hr / 24) + ' days ago'; };

  async function api(path, body) {
    const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { logout(); throw new Error('Wrong or missing admin token.'); }
    if (r.status === 429) throw new Error('Too many requests. Wait a minute and try again.');
    if (!r.ok) throw new Error(j.error === 'no_match' ? 'No matching license.' : (j.error || 'Error ' + r.status));
    return j;
  }
  function logout() { token = ''; try { sessionStorage.removeItem('pb_admin'); } catch (e) { /* ignore */ } renderLogin(); }

  function renderLogin(err) {
    const t = h('input', { type: 'password', placeholder: 'Admin token', autocomplete: 'off', 'aria-label': 'Admin token' });
    const msg = h('div', { class: 'msg' }, err || '');
    const go = async () => {
      token = t.value.trim(); if (!token) return;
      msg.textContent = 'Checking…';
      try { await load(); try { sessionStorage.setItem('pb_admin', token); } catch (e) { /* ignore */ } renderMain(); }
      catch (e) { token = ''; renderLogin(e.message); }
    };
    t.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    app.replaceChildren(h('div', { class: 'card login' }, h('h1', {}, 'License dashboard'), h('div', { class: 'mute' }, 'Enter your ADMIN_TOKEN to continue.'), t, h('button', { class: 'primary', onclick: go }, 'Sign in'), msg));
    t.focus();
  }

  async function load() { licenses = (await api('/admin/licenses')).licenses || []; licenses.sort((a, b) => (b.created || 0) - (a.created || 0)); }

  function shown() {
    const q = filter.trim().toLowerCase();
    return licenses.filter((l) => !q || l.email.toLowerCase().includes(q) || l.id.toLowerCase().includes(q) || l.devices.some((d) => (d.name || '').toLowerCase().includes(q)));
  }

  async function act(action, body, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    try { const r = await api('/admin/' + action, body); await load(); renderMain(); return r; }
    catch (e) { window.alert(e.message); }
  }

  function renderMain(note) {
    const act_ = licenses.filter((l) => l.status === 'active').length;
    const comps = licenses.reduce((n, l) => n + l.used, 0);
    const stat = (n, label) => h('div', { class: 'card stat' }, h('b', {}, n), h('span', {}, label));
    const search = h('input', { placeholder: 'Search by email, order id or computer name', value: filter, 'aria-label': 'Search' });
    search.addEventListener('input', () => { filter = search.value; const pos = search.selectionStart; renderMain(); const s = document.querySelector('input[aria-label=Search]'); s.focus(); s.setSelectionRange(pos, pos); });
    const rows = shown().map((l) => {
      const used = l.used + ' / ' + l.max;
      const tr = h('tr', {},
        h('td', {}, h('div', {}, l.email || '(not known yet)'), h('div', { class: 'mono mute' }, l.id)),
        h('td', {}, h('span', { class: 'pill ' + l.status }, l.status === 'active' ? 'Active' : 'Cancelled')),
        h('td', {}, h('button', { onclick: () => { open[l.id] = !open[l.id]; renderMain(); } }, used + (open[l.id] ? ' ▲' : ' ▼'))),
        h('td', { class: 'mute' }, date(l.created)),
        h('td', {}, h('div', { class: 'row-actions' },
          l.status === 'active'
            ? h('button', { class: 'danger', onclick: () => act('revoke', { q: l.id }, 'Cancel this license?\n' + (l.email || l.id) + '\n\nThe app goes back to the trial on their computers the next time it connects to the internet.') }, 'Cancel access')
            : h('button', { onclick: () => act('restore', { q: l.id }) }, 'Restore'),
          h('button', { onclick: () => act('reset', { q: l.id }, 'Free all computers for ' + (l.email || l.id) + '?\nThey will need to activate again.') }, 'Free all computers'),
          h('button', { onclick: () => { const n = window.prompt('How many computers may use this license?', String(l.max)); if (n && +n >= 1) act('limit', { q: l.id, max: +n }); } }, 'Change limit'))));
      const out = [tr];
      if (open[l.id]) {
        out.push(h('tr', {}, h('td', { colspan: 5, class: 'devs' },
          l.devices.length ? l.devices.map((d) => h('div', { class: 'dev' },
            h('div', {}, h('b', {}, d.name || 'Computer'), h('span', { class: 'mute' }, '  ·  added ' + date(d.at) + '  ·  last online ' + ago(d.seen))),
            h('button', { class: 'danger', onclick: () => act('removedevice', { id: l.id, ref: d.ref }, 'Remove "' + (d.name || 'Computer') + '" from this license?\nThat computer returns to the trial at its next check.') }, 'Remove')))
          : h('div', { class: 'mute', style: 'padding:8px 0' }, 'No computers have activated this license yet.'))));
      }
      return out;
    });
    const table = rows.length
      ? h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['Customer', 'Status', 'Computers', 'Created', 'Actions'].map((x) => h('th', {}, x)))), h('tbody', {}, rows)))
      : h('div', { class: 'empty' }, licenses.length ? 'No licenses match your search.' : 'No licenses yet. They appear here after a payment or when you issue a key.');
    app.replaceChildren(
      h('header', {}, h('h1', {}, 'License dashboard'), h('div', { class: 'bar', style: 'margin:0' },
        h('button', { class: 'primary', onclick: issueDialog }, '+ Issue a key'),
        h('button', { onclick: async () => { try { await load(); renderMain('Refreshed.'); } catch (e) { window.alert(e.message); } } }, 'Refresh'),
        h('button', { onclick: logout }, 'Sign out'))),
      h('div', { class: 'stats' }, stat(licenses.length, 'Licenses'), stat(act_, 'Active'), stat(licenses.length - act_, 'Cancelled'), stat(comps, 'Computers in use')),
      h('div', { class: 'bar' }, search), h('div', { class: 'card' }, table),
      h('p', { class: 'mute' }, 'A cancelled license or removed computer stops working the next time that computer connects (a few seconds after the app opens, then every 12 hours). Offline computers stop when their 30-day check-in runs out.'));
  }

  function issueDialog() {
    const email = h('input', { type: 'email', placeholder: 'customer@email.com', style: 'width:100%' });
    const send = h('input', { type: 'checkbox', checked: true, style: 'flex:0;min-width:0;margin-right:8px' });
    const out = h('div', {});
    const dlg = h('dialog', {}, h('h2', { style: 'margin:0 0 4px;font-size:17px' }, 'Issue a license key'),
      h('div', { class: 'mute' }, 'For sales outside Paystack (bank transfer, WhatsApp). Make sure you have been paid first.'),
      h('label', {}, 'Customer email'), email,
      h('label', { style: 'display:flex;align-items:center;font-weight:400' }, send, 'Email the key to the customer'), out,
      h('div', { class: 'btns' }, h('button', { onclick: () => dlg.close() }, 'Close'),
        h('button', { class: 'primary', onclick: async (e) => {
          e.target.disabled = true; out.replaceChildren(h('div', { class: 'mute' }, 'Working…'));
          try {
            const r = await api('/admin/issue', { email: email.value, send: send.checked });
            const ta = h('textarea', { readonly: true }); ta.value = r.key;
            out.replaceChildren(h('div', { class: 'msg ok' }, r.emailed ? 'Key created and emailed to ' + r.email + '.' : 'Key created.' + (r.emailError ? ' The email failed (' + r.emailError + '), so copy the key and send it yourself.' : '')),
              ta, h('button', { onclick: () => { ta.select(); navigator.clipboard && navigator.clipboard.writeText(r.key); } }, 'Copy key'));
            await load(); renderMain();
          } catch (err) { out.replaceChildren(h('div', { class: 'msg' }, err.message)); e.target.disabled = false; }
        } }, 'Create key')));
    document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove()); dlg.showModal(); email.focus();
  }

  if (token) load().then(() => renderMain()).catch((e) => renderLogin(e.message)); else renderLogin();
})();
