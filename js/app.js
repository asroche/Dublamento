// Dublamento — app principal: rotas, biblioteca, projetos, adicionar cenas
import { $, $$, h, uid, toast, fmtTime, norm, parseYouTube, parseSubtitles, escapeHtml, clamp } from './util.js';
import { db, kv, storageInfo, requestPersist } from './db.js';
import { SCENES, CATEGORIES, ytThumb, ytUrl, autoTime } from './scenes.js';
import { openStudio, charColor } from './studio.js';

const app = $('#app');
let destroyCurrent = null;
let favs = new Set();
let customScenes = [];
const state = { cat: 'Todas', q: '' };

async function boot() {
  favs = new Set(await kv.get('favs', []));
  customScenes = (await db.all('scenes')) || [];
  requestPersist();
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.__DUB_SINGLE) navigator.serviceWorker.register('sw.js').catch(() => {});
  setupInstall();
}

function allScenes() {
  const customs = customScenes.map(s => ({ ...s, custom: true }));
  return [...customs, ...SCENES];
}
const sceneById = id => allScenes().find(s => s.id === id);
const sceneDur = s => (s.kind === 'local' ? s.duration : (s.end || 60) - (s.start || 0));
const thumbOf = s => (s.kind === 'local' ? s.thumb : ytThumb(s.yt));

async function route() {
  if (destroyCurrent) { const d = destroyCurrent; destroyCurrent = null; await d(); }
  document.body.classList.remove('in-studio');
  const hash = location.hash.replace(/^#\/?/, '');
  const [page, arg] = hash.split('/');
  $$('.nav a').forEach(a => a.classList.toggle('on', a.dataset.page === (page || 'cenas')));
  window.scrollTo(0, 0);
  if (page === 'estudio' && arg) {
    document.body.classList.add('in-studio');
    destroyCurrent = await openStudio(app, arg, { onExit: () => (location.hash = '#/projetos') });
    return;
  }
  if (page === 'projetos') return renderProjects();
  if (page === 'adicionar') return renderAdd();
  if (page === 'sobre') return renderAbout();
  renderLibrary();
}

/* ---------------- Biblioteca ---------------- */
function imgErr(e) { const d = h('div', { class: 'noimg' }, '🎬'); e.target.replaceWith(d); }

function renderLibrary() {
  const grid = h('div', { class: 'grid cards' });
  const search = h('input', { class: 'search', type: 'search', placeholder: 'Buscar cena, meme, fala, canal…', value: state.q, oninput: e => { state.q = e.target.value; fill(); } });
  const cats = ['Todas', '⭐ Favoritas', ...CATEGORIES, 'Minhas cenas'];
  const chips = h('div', { class: 'chips' }, cats.map(c => h('button', { class: 'chip' + (state.cat === c ? ' on' : ''), onclick: e => { state.cat = c; $$('.chip', chips).forEach(b => b.classList.toggle('on', b === e.currentTarget)); fill(); } }, c)));
  function fill() {
    const q = norm(state.q);
    let list = allScenes();
    if (state.cat === '⭐ Favoritas') list = list.filter(s => favs.has(s.id));
    else if (state.cat === 'Minhas cenas') list = list.filter(s => s.custom);
    else if (state.cat !== 'Todas') list = list.filter(s => s.cat === state.cat);
    if (q) list = list.filter(s => norm([s.title, s.cat, s.tags, s.credit?.channel, s.credit?.title, ...(s.lines || []).map(l => l.t + ' ' + (l.o || '') + ' ' + l.c)].join(' ')).includes(q));
    grid.innerHTML = '';
    if (!list.length) grid.append(h('p', { class: 'muted empty' }, state.cat === '⭐ Favoritas' ? 'Nenhuma favorita ainda. Toque na ⭐ de uma cena.' : state.cat === 'Minhas cenas' ? 'Você ainda não adicionou cenas. Use “Adicionar”.' : 'Nada encontrado.'));
    list.forEach(s => grid.append(card(s)));
  }
  const random = () => { const l = allScenes(); openScene(l[Math.floor(Math.random() * l.length)]); };
  app.innerHTML = '';
  app.append(
    location.protocol === 'file:' ? h('div', { class: 'banner' }, h('span', {}, '⚠️ Você abriu o arquivo direto do aparelho. O visual e os vídeos próprios funcionam, mas o YouTube e o microfone podem ser bloqueados assim. Para usar tudo, abra pelo link https do Dublamento.')) : null,
    h('section', { class: 'hero' },
      h('div', {}, h('h1', {}, 'Escolha uma cena e ', h('span', { class: 'grad' }, 'solte a voz')), h('p', { class: 'muted' }, `${allScenes().length} cenas e memes famosos do YouTube, com créditos dos vídeos originais. Marque as falas uma vez e duble fala por fala.`)),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: random }, '🎲 Cena aleatória'), h('a', { class: 'btn primary', href: '#/adicionar' }, '+ Adicionar cena'))),
    h('div', { class: 'lib-tools' }, search, chips), grid);
  fill();
}

function card(s) {
  const fav = h('button', { class: 'fav' + (favs.has(s.id) ? ' on' : ''), 'aria-label': 'Favoritar', onclick: e => { e.stopPropagation(); toggleFav(s.id); fav.classList.toggle('on', favs.has(s.id)); } }, '★');
  return h('article', { class: 'card', tabindex: 0, onclick: () => openScene(s), onkeydown: e => e.key === 'Enter' && openScene(s) },
    h('div', { class: 'thumb' }, thumbOf(s) ? h('img', { src: thumbOf(s), alt: '', loading: 'lazy', onerror: imgErr }) : h('div', { class: 'noimg' }, '🎬'),
      h('span', { class: 'dur' }, fmtTime(sceneDur(s))), h('span', { class: 'cat' }, s.cat), fav),
    h('div', { class: 'card-body' }, h('h3', {}, s.title), h('p', { class: 'small muted' }, (s.kind === 'local' ? '📱 ' : '▶ ') + (s.credit?.channel || (s.kind === 'local' ? 'Vídeo próprio' : 'YouTube')) + ((s.lines || []).length ? ` · ${s.lines.length} falas` : ''))));
}
async function toggleFav(id) { favs.has(id) ? favs.delete(id) : favs.add(id); await kv.set('favs', [...favs]); }

function modal(content, cls = '') {
  const m = h('div', { class: 'modal ' + cls, onclick: e => { if (e.target === m) m.remove(); } }, h('div', { class: 'sheet' }, content));
  document.body.append(m);
  return m;
}

function openScene(s) {
  const close = () => m.remove();
  const credit = s.kind === 'local'
    ? h('div', { class: 'credit-box' }, h('b', {}, 'Vídeo próprio'), s.credit?.channel ? h('div', {}, 'Crédito: ' + s.credit.channel) : null)
    : h('div', { class: 'credit-box' }, h('div', { class: 'small muted' }, 'Créditos do vídeo original'), h('b', {}, s.credit?.title || s.title),
        h('div', {}, 'Canal: ', s.credit?.channelUrl ? h('a', { href: s.credit.channelUrl, target: '_blank', rel: 'noopener' }, s.credit.channel) : (s.credit?.channel || '—')),
        h('a', { href: ytUrl(s.yt, s.start), target: '_blank', rel: 'noopener' }, 'Assistir no YouTube ↗'),
        h('div', { class: 'small muted' }, `Trecho usado: ${fmtTime(s.start || 0)} a ${fmtTime(s.end || 0)}`));
  const fav = h('button', { class: 'btn' + (favs.has(s.id) ? ' on' : ''), onclick: async () => { await toggleFav(s.id); fav.classList.toggle('on'); fav.textContent = favs.has(s.id) ? '★ Favorita' : '☆ Favoritar'; if (location.hash === '' || location.hash === '#/') renderLibrary(); } }, favs.has(s.id) ? '★ Favorita' : '☆ Favoritar');
  const m = modal([
    h('div', { class: 'sheet-head' }, h('h3', {}, s.title), h('button', { class: 'iconbtn', onclick: close }, '✕')),
    h('div', { class: 'scene-hero' }, thumbOf(s) ? h('img', { src: thumbOf(s), alt: '', onerror: imgErr }) : h('div', { class: 'noimg' }, '🎬')),
    h('div', { class: 'row wrap' }, h('button', { class: 'btn primary big', onclick: async () => { close(); await startProject(s); } }, '🎙️ Dublar esta cena'), fav,
      s.custom ? h('button', { class: 'btn danger', onclick: async () => { if (!confirm('Apagar esta cena da sua biblioteca? Os projetos já criados continuam.')) return; await db.del('scenes', s.id); customScenes = customScenes.filter(x => x.id !== s.id); close(); renderLibrary(); } }, '🗑 Apagar cena') : null),
    credit,
    h('h4', {}, 'Falas'),
    (s.lines || []).length ? null : h('p', { class: 'small' }, 'Na primeira vez você marca as falas reais do vídeo: assiste e segura um botão enquanto o personagem fala, depois digita o texto. Fica salvo para as próximas dublagens desta cena.'),
    h('ol', { class: 'script' }, (s.lines || []).map(l => h('li', {}, l.c ? h('span', { class: 'who', style: { background: charColor(l.c) } }, l.c) : null, ' ', l.t, l.o ? h('span', { class: 'muted small' }, ` — “${l.o}”`) : null))),

  ]);
}

async function startProject(s) {
  const override = s.custom ? null : await kv.get('timing:' + s.id, null);
  let lines = (override || s.lines || []).map(l => ({ ...l, id: l.id || uid('ln_') }));
  const dur = sceneDur(s);
  const timed = !!override || (lines.length > 0 && lines.every(l => typeof l.s === 'number' && typeof l.e === 'number'));
  if (!timed && lines.length) lines = autoTime(lines, dur);
  const p = {
    id: uid('pj_'), name: s.title, sceneId: s.id,
    scene: { kind: s.kind === 'local' ? 'local' : 'yt', yt: s.yt, start: s.start || 0, end: s.end || 0, blobKey: s.blobKey, credit: s.credit || {}, custom: !!s.custom, title: s.title },
    duration: dur, lines, approx: false, timed: true, takes: [], sfx: [], music: 'none',
    mix: { orig: 0.25, voice: 1, sfx: 0.8, music: 0.35, master: 1 },
    thumb: s.kind === 'local' ? s.thumb : ytThumb(s.yt), createdAt: Date.now(), updatedAt: Date.now(),
  };
  await db.put('projects', p);
  location.hash = '#/estudio/' + p.id;
}

/* ---------------- Projetos ---------------- */
async function renderProjects() {
  const list = ((await db.all('projects')) || []).sort((a, b) => b.updatedAt - a.updatedAt);
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: e => importProjectFile(e.target.files[0]) });
  app.innerHTML = '';
  app.append(
    h('section', { class: 'page-head' }, h('h2', {}, 'Meus projetos'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => fileIn.click() }, '📦 Abrir arquivo de projeto'), fileIn)),
    list.length ? h('div', { class: 'grid cards' }, list.map(p => {
      const done = p.lines.filter(l => p.takes.some(t => t.lineId === l.id && t.active)).length;
      return h('article', { class: 'card' },
        h('div', { class: 'thumb', onclick: () => (location.hash = '#/estudio/' + p.id) }, p.thumb ? h('img', { src: p.thumb, alt: '', loading: 'lazy', onerror: imgErr }) : h('div', { class: 'noimg' }, '🎬'),
          h('span', { class: 'dur' }, `${done}/${p.lines.length} falas`)),
        h('div', { class: 'card-body' },
          h('h3', {}, p.name), h('p', { class: 'small muted' }, `${p.scene.title || ''} · ${new Date(p.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`),
          h('div', { class: 'progress' }, h('i', { style: { width: (done / Math.max(1, p.lines.length) * 100) + '%' } })),
          h('div', { class: 'row wrap' },
            h('a', { class: 'btn sm primary', href: '#/estudio/' + p.id }, 'Abrir'),
            h('button', { class: 'btn sm', onclick: async () => { const n = prompt('Novo nome:', p.name); if (n) { p.name = n.trim(); await db.put('projects', p); renderProjects(); } } }, 'Renomear'),
            h('button', { class: 'btn sm', onclick: () => duplicate(p) }, 'Duplicar'),
            h('button', { class: 'btn sm danger', onclick: async () => { if (!confirm(`Apagar o projeto "${p.name}" e todos os takes?`)) return; for (const t of p.takes) await db.del('blobs', t.blobKey); await db.del('projects', p.id); renderProjects(); } }, 'Apagar'))));
    })) : h('div', { class: 'empty-state' }, h('div', { class: 'big-emoji' }, '🎙️'), h('p', {}, 'Nenhum projeto ainda.'), h('a', { class: 'btn primary', href: '#/' }, 'Escolher uma cena')));
}

async function duplicate(p) {
  const np = JSON.parse(JSON.stringify(p));
  np.id = uid('pj_'); np.name = p.name + ' (cópia)'; np.createdAt = np.updatedAt = Date.now();
  for (const t of np.takes) { const blob = await db.get('blobs', t.blobKey); const nid = uid('tk_'); t.id = nid; t.blobKey = 'take:' + nid; if (blob) await db.put('blobs', blob, t.blobKey); }
  await db.put('projects', np); toast('Projeto duplicado', 'ok'); renderProjects();
}

async function importProjectFile(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.format !== 'dublamento') throw new Error('Arquivo não é um projeto do Dublamento.');
    const p = data.project; p.id = uid('pj_'); p.takes = []; p.updatedAt = Date.now(); p.name = p.name || 'Projeto importado';
    for (const t of data.takes || []) {
      const bin = Uint8Array.from(atob(t.wav), ch => ch.charCodeAt(0));
      const nid = uid('tk_'); const key = 'take:' + nid;
      await db.put('blobs', new Blob([bin], { type: 'audio/wav' }), key);
      const { wav, ...rest } = t; p.takes.push({ ...rest, id: nid, blobKey: key });
    }
    if (p.scene.kind === 'local') {
      const sc = customScenes.find(s => s.id === p.sceneId);
      if (!sc) { toast('Este projeto usa um vídeo do celular de outra pessoa. Importe o mesmo vídeo em “Adicionar” e depois abra o projeto.', 'warn'); }
      else p.scene.blobKey = sc.blobKey;
    }
    p.thumb = p.scene.kind === 'yt' ? ytThumb(p.scene.yt) : p.thumb;
    await db.put('projects', p);
    toast('Projeto importado ✓', 'ok');
    location.hash = '#/estudio/' + p.id;
  } catch (e) { toast(e.message || 'Arquivo inválido', 'err'); }
}

/* ---------------- Adicionar cena ---------------- */
const parseTime = s => { s = String(s || '').trim(); if (!s) return 0; if (/^\d+(\.\d+)?$/.test(s)) return +s; const p = s.split(':').map(Number); return p.reduce((a, v) => a * 60 + (v || 0), 0); };
function parseScript(text, dur) {
  const out = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim(); if (!line) continue;
    const m = line.match(/^(?:\[?(\d{1,2}:\d{2}(?:\.\d+)?)\s*[-–]\s*(\d{1,2}:\d{2}(?:\.\d+)?)\]?\s*)?(?:([^:]{1,24}):\s+)?(.+)$/);
    const l = { id: uid('ln_'), c: m[3] || '', t: m[4] };
    if (m[1]) { l.s = parseTime(m[1]); l.e = parseTime(m[2]); }
    out.push(l);
  }
  const timed = out.length && out.every(l => typeof l.s === 'number');
  return { lines: timed ? out : autoTime(out, dur), timed };
}

function renderAdd() {
  app.innerHTML = '';
  const tabs = h('div', { class: 'seg big' });
  const body = h('div');
  const show = which => { $$('button', tabs).forEach(b => b.classList.toggle('on', b.dataset.k === which)); body.innerHTML = ''; body.append(which === 'yt' ? formYT() : formLocal()); };
  tabs.append(h('button', { 'data-k': 'yt', onclick: () => show('yt') }, '▶ Link do YouTube'), h('button', { 'data-k': 'local', onclick: () => show('local') }, '📱 Vídeo do celular'));
  app.append(h('section', { class: 'page-head' }, h('h2', {}, 'Adicionar cena')), tabs, body);
  show('yt');
}

function catSelect(v) { return h('select', {}, [...CATEGORIES, 'Outros'].map(c => h('option', { value: c, selected: c === v }, c))); }

function formYT() {
  const url = h('input', { placeholder: 'Cole o link do YouTube (vídeo, Shorts ou link com tempo)', inputmode: 'url' });
  const title = h('input', { placeholder: 'Título da cena' });
  const cat = catSelect('Memes BR');
  const start = h('input', { placeholder: '0:00', value: '0:00' });
  const end = h('input', { placeholder: '0:30', value: '0:30' });
  const channel = h('input', { placeholder: 'Canal (preenchido automaticamente quando possível)' });
  const vtitle = h('input', { placeholder: 'Título original do vídeo' });
  const script = h('textarea', { rows: 6, placeholder: 'Uma fala por linha. Formatos aceitos:\nPersonagem: texto da fala\n0:03-0:07 Personagem: fala com tempo\n(sem tempos, o app distribui e você ajusta no Editor de cena)' });
  const preview = h('div', { class: 'yt-prev' });
  let parsed = null;
  const check = async () => {
    parsed = parseYouTube(url.value);
    preview.innerHTML = '';
    if (!parsed) { if (url.value.trim()) preview.append(h('p', { class: 'err small' }, 'Link do YouTube não reconhecido.')); return; }
    if (parsed.start) { start.value = fmtTime(parsed.start); end.value = fmtTime(parsed.start + 30); }
    preview.append(h('img', { src: ytThumb(parsed.id), alt: '' }));
    try {
      const r = await fetch('https://noembed.com/embed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + parsed.id));
      const j = await r.json();
      if (j.title) { vtitle.value = j.title; if (!title.value) title.value = j.title.slice(0, 60); }
      if (j.author_name) channel.value = j.author_name;
      if (j.error) preview.append(h('p', { class: 'err small' }, 'Vídeo não encontrado ou privado.'));
    } catch { /* sem internet ou serviço indisponível: o crédito será preenchido pelo player */ }
  };
  url.addEventListener('change', check); url.addEventListener('paste', () => setTimeout(check, 50));
  const save = async (andDub) => {
    if (!parsed) return toast('Cole um link válido do YouTube.', 'err');
    const s0 = parseTime(start.value), e0 = parseTime(end.value);
    if (!(e0 > s0)) return toast('O fim do trecho precisa ser depois do início.', 'err');
    if (e0 - s0 > 600) return toast('Use trechos de até 10 minutos.', 'err');
    const { lines, timed } = parseScript(script.value || 'Personagem: Primeira fala', e0 - s0);
    const sc = { id: uid('sc_'), kind: 'yt', yt: parsed.id, start: s0, end: e0, title: title.value.trim() || vtitle.value || 'Cena do YouTube', cat: cat.value,
      credit: { title: vtitle.value.trim(), channel: channel.value.trim(), url: ytUrl(parsed.id, s0) }, lines, timed, tags: '', createdAt: Date.now() };
    await db.put('scenes', sc); customScenes.unshift(sc);
    toast('Cena adicionada ✓', 'ok');
    if (andDub) startProject({ ...sc, custom: true }); else { state.cat = 'Minhas cenas'; location.hash = '#/'; }
  };
  return h('div', { class: 'form' },
    h('label', {}, 'Link do YouTube'), url, preview,
    h('div', { class: 'two' }, h('div', {}, h('label', {}, 'Início do trecho'), start), h('div', {}, h('label', {}, 'Fim do trecho'), end)),
    h('label', {}, 'Título da cena'), title,
    h('label', {}, 'Categoria'), cat,
    h('label', {}, 'Créditos: canal'), channel,
    h('label', {}, 'Créditos: título original'), vtitle,
    h('label', {}, 'Roteiro (opcional)'), script,
    h('div', { class: 'row wrap' }, h('button', { class: 'btn primary', onclick: () => save(true) }, '🎙️ Salvar e dublar'), h('button', { class: 'btn', onclick: () => save(false) }, 'Só salvar')),
    h('p', { class: 'small muted' }, 'O vídeo toca pelo player oficial do YouTube e os créditos aparecem na cena e nas exportações. Se o dono do vídeo bloquear a incorporação, o app avisa.'));
}

function formLocal() {
  const file = h('input', { type: 'file', accept: 'video/*' });
  const title = h('input', { placeholder: 'Título da cena' });
  const cat = catSelect('Filmes');
  const credit = h('input', { placeholder: 'De quem é o vídeo (créditos)' });
  const script = h('textarea', { rows: 6, placeholder: 'Uma fala por linha (Personagem: fala) — ou importe uma legenda .srt abaixo' });
  const srt = h('input', { type: 'file', accept: '.srt,.vtt' });
  const info = h('p', { class: 'small muted' });
  let meta = null;
  file.addEventListener('change', async () => {
    const f = file.files[0]; if (!f) return;
    if (!title.value) title.value = f.name.replace(/\.[^.]+$/, '').slice(0, 60);
    info.textContent = 'Lendo vídeo…';
    try { meta = await videoMeta(f); info.textContent = `Duração ${fmtTime(meta.duration)} · ${(f.size / 1048576).toFixed(1)} MB`; }
    catch { meta = null; info.textContent = 'O navegador não conseguiu abrir este vídeo. Tente MP4 (H.264).'; }
  });
  const save = async () => {
    const f = file.files[0];
    if (!f || !meta) return toast('Escolha um vídeo válido.', 'err');
    let lines, timed;
    if (srt.files[0]) { lines = parseSubtitles(await srt.files[0].text()).map(l => ({ ...l, id: uid('ln_') })); timed = true; }
    else ({ lines, timed } = parseScript(script.value || 'Personagem: Primeira fala', meta.duration));
    const id = uid('sc_'); const blobKey = 'video:' + id;
    try { await db.put('blobs', f, blobKey); } catch { return toast('Sem espaço para salvar este vídeo no aparelho.', 'err'); }
    const sc = { id, kind: 'local', blobKey, duration: meta.duration, thumb: meta.thumb, title: title.value.trim() || 'Meu vídeo', cat: cat.value, credit: { channel: credit.value.trim() }, lines, timed, createdAt: Date.now() };
    await db.put('scenes', sc); customScenes.unshift(sc);
    toast('Cena importada ✓', 'ok');
    startProject({ ...sc, custom: true });
  };
  return h('div', { class: 'form' },
    h('label', {}, 'Arquivo de vídeo'), file, info,
    h('label', {}, 'Título'), title, h('label', {}, 'Categoria'), cat, h('label', {}, 'Créditos'), credit,
    h('label', {}, 'Roteiro'), script, h('label', {}, 'Ou legenda .srt/.vtt com os tempos'), srt,
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: save }, '🎙️ Importar e dublar')),
    h('p', { class: 'small muted' }, 'O vídeo fica salvo só neste aparelho e funciona offline. Com vídeo próprio dá para exportar o vídeo dublado completo direto no app.'));
}

function videoMeta(file) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto';
    const url = URL.createObjectURL(file); v.src = url;
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('video')); };
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); };
    v.onseeked = () => {
      let thumb = null;
      try { const c = document.createElement('canvas'); const k = 320 / (v.videoWidth || 320); c.width = 320; c.height = Math.round((v.videoHeight || 180) * k); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); thumb = c.toDataURL('image/jpeg', 0.7); } catch {}
      resolve({ duration: v.duration, thumb }); URL.revokeObjectURL(url);
    };
  });
}

/* ---------------- Sobre / ajuda ---------------- */
async function renderAbout() {
  const info = await storageInfo();
  app.innerHTML = '';
  app.append(h('section', { class: 'about' },
    h('h2', {}, 'Como funciona'),
    h('ol', {},
      h('li', {}, 'Escolha uma cena. Cada cena vem dividida em falas com janela de tempo fixa.'),
      h('li', {}, 'Grave fala por fala (ou a cena inteira). A gravação começa e para sozinha na janela exata da fala.'),
      h('li', {}, 'Ouça, regrave, “bata” o áudio na aba Sincronia, coloque efeitos de voz, sons e trilha.'),
      h('li', {}, 'Assista e exporte: vídeo, áudio, legendas ou arquivo de projeto para compartilhar.')),
    h('h3', {}, 'Dicas'),
    h('ul', {},
      h('li', {}, 'Use fone com fio para a melhor sincronia. Com Bluetooth, ajuste a latência na aba Sincronia.'),
      h('li', {}, 'O microfone só funciona em site HTTPS (ou localhost).'),
      h('li', {}, 'Instale na tela inicial: Android → menu do Chrome → Instalar app. iPhone → Safari → Compartilhar → Adicionar à Tela de Início.'),
      h('li', {}, 'Atalhos no computador: Espaço = play/pause, R = gravar fala, ← → = fala anterior/próxima.')),
    h('h3', {}, 'Créditos dos vídeos'),
    h('p', { class: 'small muted' }, 'Os vídeos pertencem aos seus autores e são exibidos pelo player oficial do YouTube, sem download. Uso para criação de conteúdo não comercial.'),
    h('ul', { class: 'credits' }, SCENES.map(s => h('li', {}, h('b', {}, s.title), ' — ', h('a', { href: ytUrl(s.yt, s.start), target: '_blank', rel: 'noopener' }, s.credit.title), ' · ', h('a', { href: s.credit.channelUrl, target: '_blank', rel: 'noopener' }, s.credit.channel)))),
    h('p', { class: 'small muted' }, 'Efeitos sonoros e trilhas são gerados pelo próprio app (livres de direitos).'),
    h('h3', {}, 'Armazenamento'),
    h('p', { class: 'small' }, info ? `Usando ${(info.used / 1048576).toFixed(1)} MB de ${(info.quota / 1048576 / 1024).toFixed(1)} GB disponíveis neste aparelho.` : 'Projetos salvos neste aparelho.'),
    h('button', { class: 'btn danger', onclick: async () => { if (!confirm('Apagar TODOS os projetos, takes e cenas próprias deste aparelho?')) return; await db.clear('projects'); await db.clear('blobs'); await db.clear('scenes'); await db.clear('kv'); customScenes = []; favs = new Set(); toast('Tudo apagado.'); location.hash = '#/'; } }, 'Apagar todos os dados')));
}

/* ---------------- Instalar (PWA) ---------------- */
function setupInstall() {
  let deferred;
  const btn = $('#installBtn');
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; btn.hidden = false; });
  btn?.addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; btn.hidden = true; });
}

window.addEventListener('error', e => console.error('Erro:', e.message));
boot();
