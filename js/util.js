// Utilidades gerais
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function fmtTime(t, ms = false) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const base = `${m}:${String(s).padStart(2, '0')}`;
  return ms ? base + '.' + String(Math.floor((t % 1) * 10)) : base;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

let toastTimer;
export function toast(msg, type = '') {
  let el = document.getElementById('toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status' }); document.body.append(el); }
  el.className = 'show ' + type;
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ''), 2800);
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function shareBlob(blob, name, text) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name, text }); return true; }
    catch (e) { if (e.name === 'AbortError') return true; }
  }
  return false;
}

export function slug(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dublagem';
}

export function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Extrai ID e tempo de qualquer formato de link do YouTube
export function parseYouTube(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return { id: s, start: 0 };
  let url;
  try { url = new URL(s.startsWith('http') ? s : 'https://' + s); } catch { return null; }
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.slice(1, 12);
  else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    if (url.searchParams.get('v')) id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      if (m) id = m[1];
    }
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  const t = url.searchParams.get('t') || url.searchParams.get('start') || '';
  let start = 0;
  if (t) {
    const mm = String(t).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?/);
    start = /^\d+$/.test(t) ? +t : (+(mm[1] || 0)) * 3600 + (+(mm[2] || 0)) * 60 + (+(mm[3] || 0));
  }
  return { id, start };
}

// Legendas SRT / VTT
export function parseSubtitles(text) {
  const out = [];
  const blocks = String(text).replace(/\r/g, '').split(/\n\n+/);
  const tc = /(\d{1,2}:)?(\d{1,2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{1,2}:)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;
  const toS = (h, m, s, ms) => (+(h || '0').replace(':', '')) * 3600 + (+m) * 60 + (+s) + (+ms.padEnd(3, '0')) / 1000;
  for (const b of blocks) {
    const lines = b.split('\n');
    const i = lines.findIndex(l => tc.test(l));
    if (i < 0) continue;
    const m = lines[i].match(tc);
    const text = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (!text) continue;
    let speaker = '';
    let t = text;
    const sp = text.match(/^([^:]{1,24}):\s+(.+)$/);
    if (sp) { speaker = sp[1]; t = sp[2]; }
    out.push({ s: toS(m[1], m[2], m[3], m[4]), e: toS(m[5], m[6], m[7], m[8]), c: speaker, t });
  }
  return out;
}

export function toSRT(lines) {
  const f = t => {
    const ms = Math.round(t * 1000);
    const hh = Math.floor(ms / 3600000), mm = Math.floor(ms / 60000) % 60, ss = Math.floor(ms / 1000) % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  };
  return lines.map((l, i) => `${i + 1}\n${f(l.s)} --> ${f(l.e)}\n${l.c ? l.c + ': ' : ''}${l.t}\n`).join('\n');
}

export const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
