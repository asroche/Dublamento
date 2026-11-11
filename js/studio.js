// Estúdio de dublagem
import { $, $$, h, uid, clamp, fmtTime, toast, debounce, escapeHtml, parseSubtitles, toSRT, downloadBlob, slug } from './util.js';
import { db, kv } from './db.js';
import { YouTubePlayer, LocalPlayer } from './player.js';
import { getCtx, resumeCtx, outLatency, Mic, encodeWAV, decodeBlob, EFFECTS, effectById, applyEffect, clearFxCache, SFX, sfxBuffer, MUSIC, musicBuffer, scheduleMix, peaks, autoGain, scoreTake, removeVoice } from './audio.js';
import { ytUrl, autoTime } from './scenes.js';
import { openExport } from './export.js';

const COLORS = ['#ff4d6d', '#4dabff', '#ffd23f', '#3ddc97', '#c77dff', '#ff9f1c', '#2ec4b6', '#f72585', '#a3e635', '#fb7185'];
export function charColor(name) { let x = 0; for (const ch of String(name || '?')) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return COLORS[x % COLORS.length]; }
const fmtD = d => (Math.round(d * 10) / 10).toFixed(1).replace('.', ',') + ' s';
const fmtT = t => fmtTime(t, true);

export const mic = new Mic();

export async function loadSettings() {
  return {
    latencyMs: await kv.get('latencyMs', 0),
    countdown: await kv.get('countdown', 3),
    preroll: await kv.get('preroll', 2),
    recOrig: await kv.get('recOrig', true),
    recOthers: await kv.get('recOthers', true),
    echo: await kv.get('echo', true),
    noise: await kv.get('noise', true),
  };
}

export async function openStudio(root, projectId, { onExit }) {
  const project = await db.get('projects', projectId);
  if (!project) { toast('Projeto não encontrado', 'err'); onExit(); return () => {}; }
  const settings = await loadSettings();
  const S = {
    project, settings, player: null, mixH: null, playing: false, recording: null, editing: false,
    selLine: project.lines[0]?.id || null, selTake: null, selSfx: null, cursor: 0, loop: false,
    playEnd: null, raf: 0, destroyed: false, pps: 60, anchor: null, tab: 'roteiro', tap: null, undo: [],
  };
  let subLine = null;
  const TL = { ruler: 20, lines: 38, takes: 44, sfx: 18 };
  TL.h = TL.ruler + TL.lines + TL.takes + TL.sfx + 6;
  let tlW = 0, origPeaks = null;
  let tlDrag = null;
  const assets = { takes: new Map(), raw: new Map(), peaks: new Map(), sfx: new Map(), music: null, original: null };
  const c = getCtx();
  const outBus = c.createGain(); outBus.connect(c.destination);
  S.outBus = outBus;

  /* ---------- Layout ---------- */
  const nameInput = h('input', { class: 'st-name', value: project.name, 'aria-label': 'Nome do projeto', onchange: e => { project.name = e.target.value.trim() || 'Minha dublagem'; save(); } });
  const savedEl = h('span', { class: 'saved' }, 'Salvo');
  const playerBox = h('div', { class: 'player-box' });
  const subEl = h('div', { class: 'ov-sub' });
  const countEl = h('div', { class: 'ov-count' });
  const recEl = h('div', { class: 'ov-rec' }, h('span', { class: 'dot' }), h('b', {}, 'REC'), h('span', { class: 'rec-left' }), h('div', { class: 'rec-bar' }, h('i')));
  const creditEl = h('a', { class: 'ov-credit', target: '_blank', rel: 'noopener' });
  const msgEl = h('div', { class: 'ov-msg' });
  const shield = h('div', { class: 'ov-shield', onclick: () => (S.playing ? stop() : play()) });
  const bigPlay = h('div', { class: 'ov-bigplay' }, '▶');
  const stage = h('div', { class: 'stage' }, playerBox, shield, bigPlay, subEl, countEl, recEl, creditEl, msgEl);
  const timeEl = h('span', { class: 'tc' }, '0:00.0 / 0:00.0');
  const playBtn = h('button', { class: 'tbtn main', title: 'Tocar / pausar', onclick: () => (S.playing ? stop() : play()) }, '▶');
  const loopBtn = h('button', { class: 'tbtn', title: 'Repetir a fala selecionada', onclick: () => { S.loop = !S.loop; loopBtn.classList.toggle('on', S.loop); } }, '🔁');
  const transport = h('div', { class: 'transport' },
    h('button', { class: 'tbtn', title: 'Início', onclick: () => seek(0) }, '⏮'),
    h('button', { class: 'tbtn', title: 'Fala anterior', onclick: () => stepLine(-1) }, '⏪'),
    playBtn,
    h('button', { class: 'tbtn', title: 'Próxima fala', onclick: () => stepLine(1) }, '⏩'),
    loopBtn, timeEl);
  const tlCanvas = h('canvas', { class: 'tl' });
  const tlInner = h('div', { class: 'tl-inner' }, tlCanvas);
  const tlWrap = h('div', { class: 'tl-wrap' }, tlInner);
  const zoomBar = h('div', { class: 'tl-zoom' },
    h('span', { class: 'muted small' }, 'Régua de tempo'),
    h('span', { class: 'tl-sel small' }),
    h('button', { class: 'chip', onclick: () => setZoom(S.pps / 1.5) }, '−'),
    h('button', { class: 'chip', onclick: () => setZoom(S.pps * 1.5) }, '+'));
  const approxBanner = h('div', { class: 'banner', hidden: true },
    h('span', {}, '✍️ Esta cena ainda não tem falas. Marque as falas reais do vídeo uma vez e elas ficam salvas.'),
    h('button', { class: 'btn sm', onclick: () => { setTab('editor'); startTap(true); } }, 'Marcar falas'));
  const TABS = [['roteiro', '📜 Roteiro'], ['gravar', '🎙️ Gravar'], ['takes', '🎚️ Takes'], ['efeitos', '✨ Efeitos'], ['sons', '🔊 Sons'], ['mixer', '🎛️ Mixer'], ['sync', '⏱ Sincronia'], ['editor', '✂️ Editor de cena']];
  const tabBar = h('div', { class: 'tabs', role: 'tablist' }, TABS.map(([id, label]) => h('button', { class: 'tab', 'data-tab': id, role: 'tab', onclick: () => setTab(id) }, label)));
  const panel = h('div', { class: 'panel' });
  const exportBtn = h('button', { class: 'btn primary', onclick: () => doExport() }, '⬇ Exportar');
  const presentBtn = h('button', { class: 'btn ghost', title: 'Modo apresentação', onclick: () => present() }, '⛶');
  const el = h('div', { class: 'studio' },
    h('header', { class: 'st-top' },
      h('button', { class: 'iconbtn', 'aria-label': 'Voltar', onclick: () => onExit() }, '←'),
      nameInput, savedEl, presentBtn, exportBtn),
    h('div', { class: 'st-main' },
      h('div', { class: 'st-left' }, stage, transport, zoomBar, tlWrap, approxBanner),
      h('div', { class: 'st-right' }, tabBar, panel)));
  root.innerHTML = ''; root.append(el);

  /* ---------- Persistência ---------- */
  const saveNow = async () => { project.updatedAt = Date.now(); await db.put('projects', project); savedEl.textContent = 'Salvo'; savedEl.classList.remove('dirty'); };
  const saveDeb = debounce(saveNow, 500);
  function save() { savedEl.textContent = 'Salvando…'; savedEl.classList.add('dirty'); saveDeb(); }

  async function loadTake(tk) {
    try {
      if (!assets.raw.has(tk.id)) {
        const blob = await db.get('blobs', tk.blobKey);
        if (!blob) return;
        assets.raw.set(tk.id, await decodeBlob(blob));
      }
      await processTake(tk);
    } catch (e) { console.warn('take', e); }
  }
  async function processTake(tk) {
    const raw = assets.raw.get(tk.id); if (!raw) return;
    const buf = await applyEffect(raw, tk.fx || 'normal', tk.pitch || 0, tk.id);
    assets.takes.set(tk.id, buf);
    assets.peaks.set(tk.id, peaks(buf, Math.max(20, Math.ceil(buf.duration * 50))));
  }

  /* ---------- Utilidades de falas/takes ---------- */
  const lineById = id => project.lines.find(l => l.id === id);
  const chars = () => [...new Set(project.lines.map(l => l.c).filter(Boolean))];
  const roleLines = () => project.role ? project.lines.filter(l => l.c === project.role) : project.lines;
  function sceneScore() {
    const ls = roleLines(); if (!ls.length) return 0;
    const sum = ls.reduce((a, l) => a + (activeTake(l.id)?.score ?? 0), 0);
    return Math.round(sum / ls.length) / 10;
  }
  const sortLines = () => project.lines.sort((a, b) => a.s - b.s);
  const activeTake = lineId => project.takes.find(t => t.lineId === lineId && t.active);
  const takesOf = lineId => project.takes.filter(t => t.lineId === lineId);
  function lineAt(t) { return project.lines.find(l => t >= l.s && t < l.e); }
  function mixProject(opts = {}) {
    const takes = [];
    for (const tk of project.takes) {
      if (!tk.active && opts.solo !== tk.id) continue;
      const l = lineById(tk.lineId); if (!l) continue;
      if (opts.skipLine && l.id === opts.skipLine) continue;
      if (opts.skipRole && l.c === opts.skipRole) continue;
      if (opts.noVoice) continue;
      const nud = (tk.nudge || 0) / 1000;
      takes.push({ id: tk.id, gain: tk.gain ?? 1, start: l.s + nud, maxDur: (l.e - l.s) + Math.max(0, -nud) });
    }
    return { duration: project.duration, mix: project.mix, sfx: project.sfx, latencyMs: settings.latencyMs, takes };
  }

  /* ---------- Reprodução sincronizada ---------- */
  function onPlayerState(st) {
    if (S.destroyed) return;
    if (st === 'playing' && S.playing) startMix();
    if ((st === 'buffering' || st === 'paused') && S.playing) {
      stopMix();
      if (S.recording && st === 'buffering' && S.recording.capStart && S.recording.lines.some(l => S.cursor >= l.s - 0.1 && S.cursor <= l.e)) S.recording.stalled = true;
    }
    if (st === 'ended' && S.playing) finishPlayback();
  }
  function startMix() {
    stopMix();
    const t = S.player.time();
    const lat = outLatency();
    const when = c.currentTime + 0.02;
    S.anchor = { scene: t, ctx: c.currentTime };
    S.mixH = scheduleMix(c, outBus, mixProject(S.mixOpts || {}), assets, t + lat + 0.02, when, { includeOriginal: sc.kind === 'local' && !S.player.useElementAudio, solo: S.mixOpts?.solo });
    applyMixLive();
  }
  function stopMix() { if (S.mixH) { S.mixH.stop(); S.mixH = null; } }
  function applyMixLive() {
    const m = project.mix;
    const origVol = S.recording ? (settings.recOrig ? m.orig : 0) : m.orig;
    if (S.player) {
      if (sc.kind === 'yt') S.player.setVolume(origVol * (m.master ?? 1));
      else S.player.setVolume(origVol);
    }
    if (S.mixH) {
      S.mixH.master.gain.value = m.master ?? 1;
      S.mixH.bus.voice.gain.value = m.voice; S.mixH.bus.sfx.gain.value = m.sfx; S.mixH.bus.music.gain.value = m.music;
      S.mixH.bus.orig.gain.value = (sc.kind === 'local' && !S.player.useElementAudio) ? origVol : 0;
    }
  }

  async function play(from, opts = {}) {
    if (!S.player || S.player.state === 'error') return;
    await resumeCtx();
    if (S.playing) await stop();
    S.mixOpts = opts.mix || {};
    S.playEnd = opts.end ?? null;
    S.onEnd = opts.onEnd || null;
    let start = from ?? S.cursor;
    if (start >= project.duration - 0.1) start = 0;
    S.player.seek(start);
    S.cursor = start;
    S.playing = true; playBtn.textContent = '⏸'; bigPlay.classList.remove('show');
    applyMixLive();
    S.player.play();
    try { await S.player.waitPlaying(sc.kind === 'yt' && !S.player.forceMute ? 4000 : 15000); }
    catch (e) {
      // Celulares (principalmente iPhone) podem bloquear o vídeo com som quando não foi um toque direto.
      // Tentamos de novo com o som original mudo, que sempre é permitido.
      let ok = false;
      if (sc.kind === 'yt' && !S.player.forceMute && S.playing) {
        S.player.forceMute = true; S.player.applyVolume(); S.player.play();
        try { await S.player.waitPlaying(12000); ok = true; toast('O navegador bloqueou o som do vídeo do YouTube: o original ficou mudo. Sua voz, sons e trilha tocam normalmente.', 'warn'); } catch {}
      }
      if (!ok) { toast(e.message, 'err'); S.playing = false; playBtn.textContent = '▶'; return false; }
    }
    if (S.player.state === 'playing' && !S.mixH) startMix();
    return true;
  }
  async function stop(keepCursor = true) {
    if (!S.playing) return;
    S.playing = false; playBtn.textContent = '▶';
    stopMix();
    S.player?.pause();
    if (keepCursor) S.cursor = S.player.time();
    if (S.recording) await finishRecording(true);
  }
  function finishPlayback() {
    const cb = S.onEnd; S.onEnd = null;
    stop();
    if (S.loop && !S.recording && S.selLine && !cb) { const l = lineById(S.selLine); if (l) setTimeout(() => play(Math.max(0, l.s - 0.5), { end: l.e + 0.3 }), 120); return; }
    cb && cb();
  }
  function seek(t) {
    t = clamp(t, 0, project.duration);
    S.cursor = t;
    if (S.playing) play(t, { end: S.playEnd });
    else S.player?.seek(t);
    drawTL();
  }
  function stepLine(dir) {
    sortLines();
    const t = S.playing ? S.player.time() : S.cursor;
    let idx = project.lines.findIndex(l => l.s > t + 0.05);
    if (dir < 0) { const prev = [...project.lines].reverse().find(l => l.s < t - 0.3); if (prev) selectLine(prev.id, true); else seek(0); return; }
    if (idx >= 0) selectLine(project.lines[idx].id, true);
  }
  function selectLine(id, seekTo = false) {
    S.selLine = id;
    const tk = activeTake(id); S.selTake = tk ? tk.id : null;
    const l = lineById(id);
    if (seekTo && l) seek(Math.max(0, l.s - (S.playing ? 0 : 0.0)));
    renderPanel(); drawTL();
  }
  function playLine(id, opts = {}) {
    const l = lineById(id); if (!l) return;
    S.selLine = id;
    play(Math.max(0, l.s - 0.6), { end: l.e + 0.35, mix: opts.mix });
  }

  /* ---------- Loop de animação ---------- */
  function loop() {
    if (S.destroyed) return;
    S.raf = requestAnimationFrame(loop);
    const t = S.player && S.playing ? S.player.time() : S.cursor;
    if (S.playing) {
      if (S.player.state === 'playing' && S.mixH && S.anchor && !S.recording) {
        const expected = S.anchor.scene + (c.currentTime - S.anchor.ctx);
        if (Math.abs(expected - t) > 0.2) startMix();
      }
      if (S.recording) recTick(t);
      const end = S.playEnd ?? project.duration;
      if (t >= end - 0.02) finishPlayback();
      else S.cursor = t;
    }
    timeEl.textContent = `${fmtT(t)} / ${fmtT(project.duration)}`;
    drawSubs(t);
    drawTL(t);
    if (S.tab === 'gravar') { const m = $('.meter i', panel); if (m) m.style.width = Math.min(100, mic.getLevel() * 140) + '%'; }
  }

  /* ---------- Legenda karaokê ---------- */
  function drawSubs(t) {
    let l = lineAt(t);
    let upcoming = false;
    if (!l) { const nx = project.lines.find(x => x.s > t && x.s - t < 1.2); if (nx && (S.playing)) { l = nx; upcoming = true; } }
    if (!l) { if (subLine) { subEl.innerHTML = ''; subLine = null; } subEl.classList.remove('show'); return; }
    if (subLine !== l.id + '|' + l.t + '|' + l.c) {
      subLine = l.id + '|' + l.t + '|' + l.c;
      const words = String(l.t || '🎙️').split(/\s+/).filter(Boolean);
      subEl.innerHTML = '';
      if (l.c) subEl.append(h('span', { class: 'who', style: { background: charColor(l.c) } }, l.c));
      const tx = h('div', { class: 'words' }, words.map(w => h('span', { class: 'w' }, w + ' ')));
      subEl.append(tx);
      if (l.o) subEl.append(h('div', { class: 'orig' }, l.o));
      let acc = 0; const total = words.reduce((a, w) => a + w.length + 1, 0) || 1;
      subEl._w = words.map((w, i) => { const a = acc / total; acc += w.length + 1; return [a, acc / total]; });
    }
    subEl.classList.add('show');
    subEl.classList.toggle('upcoming', upcoming);
    const p = upcoming ? 0 : clamp((t - l.s) / Math.max(0.05, l.e - l.s), 0, 1);
    const spans = subEl.querySelectorAll('.w');
    spans.forEach((sp, i) => {
      const [a, b] = subEl._w[i] || [0, 1];
      const f = clamp((p - a) / Math.max(1e-3, b - a), 0, 1);
      sp.style.setProperty('--p', (f * 100).toFixed(1) + '%');
    });
  }

  /* ---------- Gravação ---------- */
  async function record(mode) {
    if (S.recording) return finishRecording(true);
    if (!S.player || S.player.state === 'error') return toast('A cena não carregou.', 'err');
    sortLines();
    let lines;
    if (mode === 'line') { const l = lineById(S.selLine); if (!l) return toast('Selecione uma fala no roteiro.', 'err'); lines = [l]; }
    else if (mode === 'pending') { lines = roleLines().filter(l => !activeTake(l.id)); if (!lines.length) return toast('Todas as falas já têm take. 🎉'); }
    else lines = [...roleLines()];
    if (!lines.length) return toast('Esta cena não tem falas. Adicione no Editor de cena.', 'err');
    try { await mic.init({ echo: settings.echo, noise: settings.noise }); }
    catch (e) { return toast(e.name === 'NotAllowedError' ? 'Permissão do microfone negada. Libere nas configurações do navegador.' : (e.message || 'Microfone indisponível'), 'err'); }
    await stop();
    const from = Math.max(0, lines[0].s - (settings.preroll ?? 2));
    const stopAt = Math.min(project.duration, lines[lines.length - 1].e + 0.15);
    S.player.seek(from); S.cursor = from;
    // contagem regressiva
    const n = settings.countdown ?? 3;
    el.classList.add('is-rec');
    for (let i = n; i > 0; i--) {
      countEl.textContent = i; countEl.classList.remove('pop'); void countEl.offsetWidth; countEl.classList.add('show', 'pop');
      await new Promise(r => setTimeout(r, 1000));
      if (S.destroyed) return;
    }
    countEl.classList.remove('show', 'pop');
    const mixOpts = mode === 'line' && settings.recOthers ? { skipLine: lines[0].id } : project.role && settings.recOthers ? { skipRole: project.role } : { noVoice: true };
    S.recording = { lines, pairs: [], stalled: false, stopAt, capStart: 0, mode };
    applyMixLive();
    const ok = await play(from, { end: stopAt, mix: mixOpts, onEnd: () => {} });
    if (!ok || !S.recording) { S.recording = null; el.classList.remove('is-rec'); applyMixLive(); return; }
    S.recording.capStart = c.currentTime;
    mic.start();
  }
  function recTick(t) {
    const R = S.recording;
    if (S.player.state === 'playing') R.pairs.push([c.currentTime, t]);
    const cur = R.lines.find(l => t >= l.s && t < l.e);
    if (cur) {
      recEl.classList.add('show'); recEl.classList.remove('wait');
      recEl.querySelector('.rec-left').textContent = fmtD(Math.max(0, cur.e - t));
      recEl.querySelector('.rec-bar i').style.width = (clamp((t - cur.s) / (cur.e - cur.s), 0, 1) * 100) + '%';
    } else {
      const nx = R.lines.find(l => l.s >= t);
      recEl.classList.add('show', 'wait');
      recEl.querySelector('.rec-left').textContent = nx ? `prepare-se ${fmtD(nx.s - t)}` : 'finalizando…';
      recEl.querySelector('.rec-bar i').style.width = '0%';
    }
  }
  // converte tempo da cena → tempo do AudioContext usando os pares registrados durante a gravação
  function sceneToCtx(pairs, t) {
    for (let i = 1; i < pairs.length; i++) {
      const [c0, t0] = pairs[i - 1], [c1, t1] = pairs[i];
      if (t1 >= t && t0 <= t) return t1 === t0 ? c0 : c0 + (t - t0) * (c1 - c0) / (t1 - t0);
    }
    return null;
  }
  async function finishRecording(aborted) {
    const R = S.recording; if (!R) return;
    S.recording = null;
    el.classList.remove('is-rec'); recEl.classList.remove('show', 'wait');
    const raw = mic.stop(R.capStart);
    if (S.playing) { S.playing = false; playBtn.textContent = '▶'; stopMix(); S.player.pause(); }
    applyMixLive();
    if (!raw) { toast('Nada foi gravado.', 'err'); return; }
    const sr = raw.sampleRate;
    const data = raw.getChannelData(0);
    const inLat = mic.inputLatency || 0;
    const lastT = R.pairs.length ? R.pairs[R.pairs.length - 1][1] : 0;
    let made = 0;
    for (const l of R.lines) {
      if (lastT < l.e - 0.02) continue; // janela incompleta: descarta
      const cs = sceneToCtx(R.pairs, l.s);
      if (cs == null) continue;
      const off = Math.round((cs - R.capStart + inLat) * sr);
      const len = Math.max(1, Math.round((l.e - l.s) * sr));
      const buf = c.createBuffer(1, len, sr);
      const out = buf.getChannelData(0);
      for (let i = 0; i < len; i++) { const j = off + i; out[i] = j >= 0 && j < data.length ? data[j] : 0; }
      // micro fade para evitar estalos nas bordas da janela
      const fade = Math.min(len >> 1, Math.round(sr * 0.008));
      for (let i = 0; i < fade; i++) { out[i] *= i / fade; out[len - 1 - i] *= i / fade; }
      const g = autoGain(buf, 0.9);
      if (Math.abs(g - 1) > 0.01) for (let i = 0; i < len; i++) out[i] *= g;
      const id = uid('tk_');
      const blobKey = 'take:' + id;
      await db.put('blobs', encodeWAV(buf), blobKey);
      takesOf(l.id).forEach(t => (t.active = false));
      const prevFx = project.lastFx || 'normal';
      const tk = { id, lineId: l.id, active: true, blobKey, nudge: 0, fx: prevFx, pitch: 0, gain: 1, createdAt: Date.now(), n: takesOf(l.id).length + 1, warn: R.stalled, score: scoreTake(buf) };
      project.takes.push(tk);
      assets.raw.set(id, buf);
      await processTake(tk);
      made++;
      if (l.id === S.selLine) S.selTake = id;
    }
    save();
    if (made) toast(`${made} take${made > 1 ? 's' : ''} gravado${made > 1 ? 's' : ''}${R.stalled ? ' (a conexão travou: confira a sincronia)' : ''} ✓`, R.stalled ? 'warn' : 'ok');
    else toast(aborted ? 'Gravação interrompida antes do fim da fala. Nada foi salvo.' : 'Nenhuma fala completa foi gravada.', 'err');
    renderPanel(); drawTL();
    if (made && (R.mode === 'all' || R.mode === 'pending')) showScore();
    else if (made === 1) { const t = project.takes[project.takes.length - 1]; toast(`Nota do take: ${(t.score / 10).toFixed(1).replace('.', ',')} ${t.score >= 80 ? '🔥' : t.score >= 50 ? '👍' : '— tente de novo ocupando a fala toda'}`, t.score >= 50 ? 'ok' : 'warn'); }
  }

  function showScore() {
    const nota = sceneScore();
    const ls = roleLines();
    const m = h('div', { class: 'modal', onclick: e => { if (e.target === m) m.remove(); } }, h('div', { class: 'sheet score-sheet' },
      h('div', { class: 'sheet-head' }, h('h3', {}, 'Sua nota'), h('button', { class: 'iconbtn', onclick: () => m.remove() }, '✕')),
      h('div', { class: 'score-big' }, nota.toFixed(1).replace('.', ',')),
      h('p', { class: 'muted', style: { textAlign: 'center' } }, nota >= 8 ? 'Dublagem de estúdio! 🔥' : nota >= 6 ? 'Mandou bem! Dá pra lapidar algumas falas.' : 'Bom começo! Regrave as falas com nota baixa.'),
      h('ol', { class: 'score-list' }, ls.map(l => { const t = activeTake(l.id); const sc = t?.score ?? 0; return h('li', {}, h('span', {}, l.t), h('b', { class: sc >= 80 ? 'ok' : sc >= 50 ? '' : 'bad' }, t ? (sc / 10).toFixed(1).replace('.', ',') : '—')); })),
      h('p', { class: 'small muted' }, 'A nota mede se a sua voz ocupou a janela de cada fala: começou no tempo, preencheu a fala e terminou junto.'),
      h('div', { class: 'row wrap' }, h('button', { class: 'btn primary', onclick: () => { m.remove(); play(0); } }, '▶ Assistir minha dublagem'), h('button', { class: 'btn', onclick: () => { m.remove(); doExport(); } }, '⬇ Exportar'))));
    document.body.append(m);
  }

  /* ---------- Timeline ---------- */
  function setZoom(pps) {
    const vw = tlWrap.clientWidth || 340;
    const fit = (vw - 16) / Math.max(1, project.duration);
    S.pps = pps == null ? Math.max(fit, Math.min(80, Math.max(30, fit))) : clamp(pps, fit, 400);
    drawTL();
  }
  function drawTL(tNow) {
    const t = tNow ?? (S.playing ? S.player.time() : S.cursor);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(tlWrap.clientWidth || 300, Math.ceil(project.duration * S.pps) + 16);
    if (W !== tlW || tlCanvas.height !== TL.h * dpr) {
      tlW = W; tlCanvas.width = W * dpr; tlCanvas.height = TL.h * dpr;
      tlCanvas.style.width = W + 'px'; tlCanvas.style.height = TL.h + 'px'; tlInner.style.width = W + 'px';
    }
    const g = tlCanvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, TL.h);
    const X = s => 8 + s * S.pps;
    const y1 = TL.ruler, y2 = y1 + TL.lines, y3 = y2 + TL.takes, y4 = y3 + TL.sfx;
    // faixas
    g.fillStyle = '#15151d'; g.fillRect(0, y1, W, TL.lines); g.fillStyle = '#111118'; g.fillRect(0, y2, W, TL.takes); g.fillStyle = '#15151d'; g.fillRect(0, y3, W, TL.sfx);
    // régua
    g.fillStyle = '#8a8aa0'; g.font = '10px system-ui, sans-serif'; g.textBaseline = 'top';
    const step = S.pps > 120 ? 0.5 : S.pps > 40 ? 1 : S.pps > 15 ? 5 : 10;
    for (let s = 0; s <= project.duration + 0.001; s += step) {
      const x = X(s); const major = Math.abs(s % (step * 5)) < 1e-6 || step >= 5;
      g.fillStyle = major ? '#8a8aa0' : '#4a4a5c';
      g.fillRect(x, major ? 10 : 14, 1, major ? 10 : 6);
      if (major || S.pps > 60) g.fillText(fmtTime(s) + (step < 1 && s % 1 ? '.5' : ''), x + 2, 0);
    }
    // waveform do áudio original (vídeo local)
    if (assets.original) {
      if (!origPeaks || origPeaks.length !== Math.ceil(project.duration * S.pps)) origPeaks = peaks(assets.original, Math.max(10, Math.ceil(project.duration * S.pps)));
      g.fillStyle = 'rgba(140,140,170,.35)';
      const mid = y1 + TL.lines / 2;
      for (let i = 0; i < origPeaks.length; i++) { const a = origPeaks[i] * (TL.lines / 2 - 2); g.fillRect(8 + i, mid - a, 1, a * 2); }
    }
    // falas
    for (const l of project.lines) {
      const x0 = X(l.s), x1 = X(l.e), w = Math.max(2, x1 - x0);
      const col = charColor(l.c);
      const sel = l.id === S.selLine;
      const rec = S.recording && S.recording.lines.includes(l);
      const other = project.role && l.c !== project.role;
      g.fillStyle = col + (sel ? 'cc' : other ? '22' : '55');
      roundRect(g, x0, y1 + 3, w, TL.lines - 6, 5); g.fill();
      if (sel) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
      if (rec) { g.strokeStyle = '#ff3b3b'; g.lineWidth = 2; g.stroke(); }
      if (S.tab === 'editor') { g.fillStyle = '#fff'; g.fillRect(x0, y1 + 6, 3, TL.lines - 12); g.fillRect(x1 - 3, y1 + 6, 3, TL.lines - 12); }
      g.save(); g.beginPath(); g.rect(x0 + 4, y1, w - 8, TL.lines); g.clip();
      g.fillStyle = '#fff'; g.font = '600 10px system-ui, sans-serif';
      g.fillText((l.c ? l.c + ' · ' : '') + fmtD(l.e - l.s), x0 + 6, y1 + 6);
      g.font = '10px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.8)';
      g.fillText(l.t, x0 + 6, y1 + 19);
      g.restore();
      // janela do take (área tracejada) + take ativo
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.setLineDash([3, 3]); g.lineWidth = 1;
      g.strokeRect(x0 + 0.5, y2 + 3.5, w - 1, TL.takes - 7); g.setLineDash([]);
      const tk = activeTake(l.id);
      if (tk && assets.peaks.has(tk.id)) {
        const pk = assets.peaks.get(tk.id); const buf = assets.takes.get(tk.id);
        const st = l.s + (tk.nudge || 0) / 1000 + settings.latencyMs / 1000;
        const dur = Math.min(buf.duration, l.e - st + Math.max(0, -(tk.nudge || 0) / 1000));
        const tx0 = X(st), tw = dur * S.pps;
        const selT = tk.id === S.selTake;
        g.fillStyle = selT ? 'rgba(77,171,255,.28)' : 'rgba(61,220,151,.18)';
        roundRect(g, tx0, y2 + 4, tw, TL.takes - 8, 4); g.fill();
        g.fillStyle = selT ? '#7cc4ff' : '#3ddc97';
        const mid = y2 + TL.takes / 2, amp = TL.takes / 2 - 6;
        const n = Math.max(1, Math.floor(tw));
        for (let i = 0; i < n; i++) { const a = pk[Math.floor(i / n * pk.length * (dur / buf.duration))] || 0; const hh = Math.max(0.5, a * amp); g.fillRect(tx0 + i, mid - hh, 1, hh * 2); }
        if (tk.warn) { g.fillStyle = '#ffd23f'; g.fillText('⚠', tx0 + 3, y2 + 6); }
      }
    }
    // sfx
    for (const ev of project.sfx) {
      const def = SFX.find(s => s.id === ev.key); const x = X(ev.t);
      g.fillStyle = ev.id === S.selSfx ? '#ffd23f' : '#c77dff';
      roundRect(g, x, y3 + 2, Math.max(14, (def?.dur || 1) * S.pps), TL.sfx - 4, 3); g.globalAlpha = 0.35; g.fill(); g.globalAlpha = 1;
      g.fillRect(x, y3 + 2, 2, TL.sfx - 4);
      g.font = '11px system-ui'; g.fillText(def?.icon || '♪', x + 4, y3 + 3);
    }
    // seleção de gravação
    // playhead
    const px = X(t);
    g.fillStyle = S.recording ? '#ff3b3b' : '#ffffff';
    g.fillRect(px - 1, 0, 2, TL.h);
    g.beginPath(); g.moveTo(px - 5, 0); g.lineTo(px + 5, 0); g.lineTo(px, 7); g.fill();
    // rolagem automática
    if (S.playing && !tlDrag) {
      const vw = tlWrap.clientWidth;
      if (px < tlWrap.scrollLeft + 20 || px > tlWrap.scrollLeft + vw - 40) tlWrap.scrollLeft = Math.max(0, px - vw * 0.3);
    }
    const sl = lineById(S.selLine);
    const selInfo = $('.tl-sel', zoomBar);
    if (selInfo) selInfo.textContent = sl ? `Fala: ${fmtT(sl.s)} → ${fmtT(sl.e)} · ${fmtD(sl.e - sl.s)}` : '';
  }
  function roundRect(g, x, y, w, hh, r) { r = Math.min(r, w / 2, hh / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // Interação na timeline: tocar = pular; arrastar no vazio = rolar; no editor, arrastar bordas = ajustar fala
  tlCanvas.addEventListener('pointerdown', e => {
    const r = tlCanvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const t = (x - 8) / S.pps;
    tlDrag = { x0: e.clientX, sl0: tlWrap.scrollLeft, t, y, moved: false, kind: 'pan', id: e.pointerId };
    const y1 = TL.ruler, y2 = y1 + TL.lines, y3 = y2 + TL.takes;
    if (y >= y1 && y < y2) {
      const l = project.lines.find(l => t >= l.s - 6 / S.pps && t <= l.e + 6 / S.pps);
      if (l) {
        tlDrag.line = l;
        if (S.tab === 'editor') {
          const edge = 10 / S.pps;
          tlDrag.kind = Math.abs(t - l.s) < edge ? 'ls' : Math.abs(t - l.e) < edge ? 'le' : 'lm';
          tlDrag.orig = { s: l.s, e: l.e };
          pushUndo();
        }
      }
    } else if (y >= y2 && y < y3) {
      const l = project.lines.find(l => t >= l.s && t <= l.e);
      if (l) { tlDrag.line = l; const tk = activeTake(l.id); if (tk) { tlDrag.take = tk; tlDrag.kind = 'take'; tlDrag.nud0 = tk.nudge || 0; } }
    } else if (y >= y3) {
      const ev = project.sfx.find(ev => t >= ev.t - 0.15 && t <= ev.t + Math.max(0.3, (SFX.find(s => s.id === ev.key)?.dur || 1)));
      if (ev) { tlDrag.sfx = ev; tlDrag.kind = 'sfx'; tlDrag.t0 = ev.t; }
    }
    tlCanvas.setPointerCapture(e.pointerId);
  });
  tlCanvas.addEventListener('pointermove', e => {
    if (!tlDrag) return;
    const dx = e.clientX - tlDrag.x0;
    if (Math.abs(dx) > 6) tlDrag.moved = true;
    if (!tlDrag.moved) return;
    const dt = dx / S.pps;
    const d = tlDrag;
    if (d.kind === 'pan') tlWrap.scrollLeft = d.sl0 - dx;
    else if (d.kind === 'ls') { d.line.s = +clamp(d.orig.s + dt, 0, d.line.e - 0.2).toFixed(2); project.timed = true; }
    else if (d.kind === 'le') { d.line.e = +clamp(d.orig.e + dt, d.line.s + 0.2, project.duration).toFixed(2); project.timed = true; }
    else if (d.kind === 'lm') { const len = d.orig.e - d.orig.s; const s = clamp(d.orig.s + dt, 0, project.duration - len); d.line.s = +s.toFixed(2); d.line.e = +(s + len).toFixed(2); project.timed = true; }
    else if (d.kind === 'take') { d.take.nudge = Math.round(clamp(d.nud0 + dt * 1000, -1000, 1000) / 5) * 5; }
    else if (d.kind === 'sfx') { d.sfx.t = +clamp(d.t0 + dt, 0, project.duration).toFixed(2); }
    drawTL();
  });
  const endDrag = e => {
    const d = tlDrag; tlDrag = null; if (!d) return;
    if (!d.moved) {
      if (d.line) { S.selLine = d.line.id; const tk = activeTake(d.line.id); S.selTake = tk?.id || null; }
      if (d.sfx) S.selSfx = d.sfx.id;
      seek(Math.max(0, d.t));
      renderPanel();
    } else if (d.kind !== 'pan') {
      if (d.kind === 'ls' || d.kind === 'le' || d.kind === 'lm') sortLines();
      save(); renderPanel();
    } else if (d.kind === 'pan' && S.undo.length && false) {}
  };
  tlCanvas.addEventListener('pointerup', endDrag);
  tlCanvas.addEventListener('pointercancel', () => (tlDrag = null));
  const onResize = () => setZoom(S.pps);
  window.addEventListener('resize', onResize);

  /* ---------- Painéis ---------- */
  function setTab(id) {
    if (S.tap) endTap();
    S.tab = id;
    $$('.tab', tabBar).forEach(b => b.classList.toggle('on', b.dataset.tab === id));
    const btn = $(`.tab[data-tab="${id}"]`, tabBar); btn?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    renderPanel(); drawTL();
  }
  function renderPanel() {
    const fn = { roteiro: pRoteiro, gravar: pGravar, takes: pTakes, efeitos: pEfeitos, sons: pSons, mixer: pMixer, sync: pSync, editor: pEditor }[S.tab];
    const scroll = panel.scrollTop;
    panel.innerHTML = '';
    panel.append(fn());
    panel.scrollTop = scroll;
  }
  const lineLabel = l => `${fmtT(l.s)} → ${fmtT(l.e)} · ${fmtD(l.e - l.s)}`;

  function speak(l) {
    if (!('speechSynthesis' in window)) return toast('Seu navegador não tem voz sintetizada.');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(l.t.replace(/\([^)]*\)/g, ''));
    u.lang = 'pt-BR';
    const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('pt'));
    if (v) u.voice = v;
    u.rate = clamp(l.t.length / ((l.e - l.s) * 14), 0.8, 1.9);
    speechSynthesis.speak(u);
  }

  function pRoteiro() {
    sortLines();
    const done = roleLines().filter(l => activeTake(l.id)).length;
    const cs = chars();
    return h('div', {},
      cs.length > 1 ? h('div', { class: 'role-pick' }, h('span', { class: 'small muted' }, 'Quem você vai dublar?'),
        h('div', { class: 'chips' }, [null, ...cs].map(c => h('button', { class: 'chip' + ((project.role || null) === c ? ' on' : ''), onclick: () => { project.role = c; save(); renderPanel(); drawTL(); } }, c || 'Todos os personagens')))) : null,
      h('div', { class: 'row between' },
        h('div', {}, h('b', {}, `${roleLines().length} falas${project.role ? ' de ' + project.role : ''}`), h('span', { class: 'muted' }, ` · ${done} gravadas`), done ? h('span', { class: 'nota-chip', onclick: showScore }, '⭐ ' + sceneScore().toFixed(1).replace('.', ',')) : null),
        h('div', { class: 'row' },
          h('button', { class: 'btn sm', onclick: () => setTab('editor') }, '✂️ Editar cena'),
          h('button', { class: 'btn sm rec', onclick: () => { setTab('gravar'); } }, '🎙️ Gravar'))),
      h('div', { class: 'progress' }, h('i', { style: { width: (done / Math.max(1, roleLines().length) * 100) + '%' } })),
      project.lines.length ? null : h('div', { class: 'empty-state' }, h('p', {}, 'Esta cena ainda não tem falas.'), h('button', { class: 'btn primary', onclick: () => { setTab('editor'); startTap(true); } }, '➕ Marcar as falas do vídeo')),
      h('ol', { class: 'lines' }, project.lines.map((l, i) => {
        const tk = activeTake(l.id);
        return h('li', { class: 'line' + (l.id === S.selLine ? ' sel' : '') + (project.role && l.c !== project.role ? ' other' : ''), onclick: () => selectLine(l.id, true) },
          h('div', { class: 'line-head' },
            h('span', { class: 'num' }, i + 1),
            l.c ? h('span', { class: 'who', style: { background: charColor(l.c) } }, l.c) : null,
            h('span', { class: 'time' }, lineLabel(l)),
            h('span', { class: 'status ' + (tk ? 'ok' : '') }, tk ? `✓ nota ${((tk.score ?? 0) / 10).toFixed(1).replace('.', ',')}` : 'pendente')),
          h('div', { class: 'line-text' + (l.t ? '' : ' muted') }, l.t || '(sem texto — digite no Editor de cena)'),
          l.o ? h('div', { class: 'line-orig' }, '“' + l.o + '”') : null,
          h('div', { class: 'line-actions', onclick: e => e.stopPropagation() },
            h('button', { class: 'btn sm', title: 'Ver a cena nesta fala', onclick: () => playLine(l.id) }, '▶ Cena'),
            h('button', { class: 'btn sm', title: 'Ouvir a sugestão falada', onclick: () => speak(l) }, '🗣 Ouvir texto'),
            tk ? h('button', { class: 'btn sm', title: 'Ouvir só a sua voz', onclick: () => soloTake(tk) }, '🎧 Meu take') : null,
            h('button', { class: 'btn sm rec', onclick: () => { S.selLine = l.id; record('line'); } }, tk ? '🔄 Regravar' : '🎙️ Gravar')));
      })));
  }

  function setSetting(k, v) { settings[k] = v; kv.set(k, v); }
  function pGravar() {
    const l = lineById(S.selLine);
    const opt = (k, vals, label) => h('div', { class: 'field' }, h('label', {}, label), h('div', { class: 'seg' }, vals.map(([v, t]) => h('button', { class: settings[k] === v ? 'on' : '', onclick: () => { setSetting(k, v); renderPanel(); } }, t))));
    const tog = (k, label, extra) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: !!settings[k], onchange: e => { setSetting(k, e.target.checked); extra && extra(); } }), h('span', {}, label));
    const pending = roleLines().filter(x => !activeTake(x.id)).length;
    return h('div', {},
      h('div', { class: 'rec-card' },
        h('div', { class: 'muted small' }, 'Fala selecionada'),
        l ? h('div', {}, h('b', {}, l.c ? l.c + ': ' : ''), l.t, h('div', { class: 'muted small' }, 'Janela do take: ' + lineLabel(l) + ' — a gravação para sozinha no fim.')) : h('div', { class: 'muted' }, 'Nenhuma'),
        h('div', { class: 'rec-buttons' },
          h('button', { class: 'bigrec', onclick: () => record('line') }, h('span', { class: 'dot' }), S.recording ? 'Parar' : 'Gravar esta fala'),
          h('button', { class: 'btn', onclick: () => record('all') }, project.role ? `🎬 Gravar todas as falas de ${project.role}` : '🎬 Gravar a cena inteira'),
          h('button', { class: 'btn', disabled: !pending, onclick: () => record('pending') }, `⏭ Só as pendentes (${pending})`)),
        h('div', { class: 'meter', title: 'Nível do microfone' }, h('i')),
        mic.ready ? null : h('button', { class: 'btn sm', onclick: async () => { try { await mic.init({ echo: settings.echo, noise: settings.noise }); toast('Microfone pronto 🎙️', 'ok'); renderPanel(); } catch (e) { toast(e.message || 'Microfone indisponível', 'err'); } } }, 'Testar microfone')),
      opt('countdown', [[0, 'Sem'], [3, '3 s'], [5, '5 s']], 'Contagem regressiva'),
      opt('preroll', [[0, '0 s'], [1, '1 s'], [2, '2 s'], [3, '3 s']], 'Pré-rolagem (vídeo antes da fala, sem gravar)'),
      tog('recOrig', 'Ouvir o áudio original enquanto grava (use fone)', () => applyMixLive()),
      tog('recOthers', 'Ouvir meus outros takes enquanto gravo uma fala'),
      tog('echo', 'Cancelamento de eco (ligue se estiver sem fone)'),
      tog('noise', 'Redução de ruído'),
      h('p', { class: 'muted small' }, 'Dica: com fone com fio a sincronia fica perfeita. Se usar fone Bluetooth, ajuste a latência na aba Sincronia.'));
  }

  async function soloTake(tk) {
    await resumeCtx(); await stop();
    const buf = assets.takes.get(tk.id); if (!buf) return;
    if (S.soloSrc) try { S.soloSrc.stop(); } catch {}
    const s = c.createBufferSource(); s.buffer = buf; const g = c.createGain(); g.gain.value = (tk.gain ?? 1) * project.mix.voice; s.connect(g); g.connect(outBus); s.start();
    S.soloSrc = s;
  }

  function pTakes() {
    sortLines();
    const any = project.takes.length;
    return h('div', {},
      any ? null : h('p', { class: 'muted' }, 'Nenhum take ainda. Vá em 🎙️ Gravar.'),
      project.lines.filter(l => takesOf(l.id).length).map(l => h('div', { class: 'take-group' + (l.id === S.selLine ? ' sel' : '') },
        h('div', { class: 'row between' }, h('div', {}, l.c ? h('span', { class: 'who', style: { background: charColor(l.c) } }, l.c) : null, ' ', h('span', { class: 'small' }, l.t)), h('span', { class: 'muted small' }, fmtD(l.e - l.s))),
        takesOf(l.id).map((tk, i) => h('div', { class: 'take' + (tk.active ? ' active' : '') + (tk.id === S.selTake ? ' sel' : '') },
          h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'act-' + l.id, checked: tk.active, onchange: () => { takesOf(l.id).forEach(t => (t.active = false)); tk.active = true; S.selTake = tk.id; save(); renderPanel(); } }), `Take ${i + 1}`),
          h('span', { class: 'muted small' }, (tk.score != null ? `⭐ ${(tk.score / 10).toFixed(1).replace('.', ',')} · ` : '') + effectById(tk.fx).icon + ' ' + effectById(tk.fx).name + (tk.nudge ? ` · ${tk.nudge > 0 ? '+' : ''}${tk.nudge} ms` : '') + (tk.warn ? ' · ⚠' : '')),
          h('div', { class: 'row' },
            h('button', { class: 'btn sm', title: 'Ouvir sozinho', onclick: () => soloTake(tk) }, '🎧'),
            h('button', { class: 'btn sm', title: 'Ouvir com a cena', onclick: () => { S.selTake = tk.id; playLine(l.id, { mix: { solo: tk.active ? undefined : tk.id } }); } }, '▶'),
            h('input', { type: 'range', min: 0, max: 2, step: 0.05, value: tk.gain ?? 1, title: 'Volume do take', oninput: e => { tk.gain = +e.target.value; save(); } }),
            h('button', { class: 'btn sm danger', title: 'Apagar take', onclick: () => delTake(tk) }, '🗑')))))));
  }
  async function delTake(tk) {
    if (!confirm('Apagar este take?')) return;
    project.takes = project.takes.filter(t => t !== tk);
    if (tk.active) { const other = takesOf(tk.lineId).pop(); if (other) other.active = true; }
    db.del('blobs', tk.blobKey); assets.takes.delete(tk.id); assets.raw.delete(tk.id); clearFxCache(tk.id);
    save(); renderPanel(); drawTL();
  }

  function pEfeitos() {
    const tk = project.takes.find(t => t.id === S.selTake) || activeTake(S.selLine);
    const l = tk ? lineById(tk.lineId) : null;
    const apply = async (fx, all) => {
      const list = all ? project.takes : tk ? [tk] : [];
      if (!list.length) return toast('Grave um take primeiro.');
      msgEl.textContent = 'Aplicando efeito…'; msgEl.classList.add('show');
      for (const t of list) { t.fx = fx; await processTake(t); }
      msgEl.classList.remove('show');
      project.lastFx = fx; save(); renderPanel(); drawTL();
      if (!all && l) playLine(l.id);
    };
    return h('div', {},
      h('p', { class: 'small' }, tk ? h('span', {}, 'Take selecionado: ', h('b', {}, l?.t || '')) : h('span', { class: 'muted' }, 'Selecione uma fala com take (toque na fala na régua ou no roteiro).')),
      h('div', { class: 'grid fx' }, EFFECTS.map(fx => h('button', { class: 'pad' + (tk?.fx === fx.id ? ' on' : ''), onclick: () => apply(fx.id) }, h('span', { class: 'ic' }, fx.icon), fx.name))),
      tk ? h('div', { class: 'field' }, h('label', {}, `Tom extra: ${tk.pitch > 0 ? '+' : ''}${tk.pitch || 0} semitons`),
        h('input', { type: 'range', min: -12, max: 12, step: 1, value: tk.pitch || 0, onchange: async e => { tk.pitch = +e.target.value; await processTake(tk); save(); renderPanel(); drawTL(); playLine(tk.lineId); } })) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn sm', onclick: () => tk && apply(tk.fx, true) }, 'Aplicar este efeito em todos os takes'),
        h('button', { class: 'btn sm', onclick: () => apply('normal', true) }, 'Tirar efeitos de todos')),
      h('p', { class: 'muted small' }, 'Os efeitos não mudam a duração do take, então a sincronia continua certa.'));
  }

  function pSons() {
    const addAt = async (key, t) => {
      const ev = { id: uid('sx_'), t: +t.toFixed(2), key };
      assets.sfx.set(key, await sfxBuffer(key));
      project.sfx.push(ev); S.selSfx = ev.id; save(); renderPanel(); drawTL();
    };
    const preview = async key => { await resumeCtx(); const b = await sfxBuffer(key); const s = c.createBufferSource(); s.buffer = b; const g = c.createGain(); g.gain.value = project.mix.sfx; s.connect(g); g.connect(outBus); s.start(); };
    return h('div', {},
      h('p', { class: 'small muted' }, S.playing ? 'Toque num som para colocá-lo no ponto atual do vídeo.' : 'Com o vídeo parado: toque para ouvir e “+” para colocar no cursor. Com o vídeo tocando: toque para colocar no ponto exato.'),
      h('div', { class: 'grid sfx' }, SFX.map(sx => h('div', { class: 'pad sfxpad' },
        h('button', { class: 'pad-main', onclick: async () => { preview(sx.id); if (S.playing) addAt(sx.id, S.player.time()); } }, h('span', { class: 'ic' }, sx.icon), sx.name),
        h('button', { class: 'pad-add', title: 'Adicionar no cursor', onclick: () => addAt(sx.id, S.playing ? S.player.time() : S.cursor) }, '+')))),
      h('h4', {}, 'Sons na cena'),
      project.sfx.length ? h('ul', { class: 'sfx-list' }, [...project.sfx].sort((a, b) => a.t - b.t).map(ev => {
        const def = SFX.find(s => s.id === ev.key);
        return h('li', { class: ev.id === S.selSfx ? 'sel' : '' },
          h('span', {}, `${def?.icon} ${def?.name}`), h('span', { class: 'muted small' }, fmtT(ev.t)),
          h('button', { class: 'btn sm', onclick: () => { ev.t = Math.max(0, +(ev.t - 0.1).toFixed(2)); save(); renderPanel(); } }, '−0,1'),
          h('button', { class: 'btn sm', onclick: () => { ev.t = +(ev.t + 0.1).toFixed(2); save(); renderPanel(); } }, '+0,1'),
          h('button', { class: 'btn sm', onclick: () => play(Math.max(0, ev.t - 1), { end: ev.t + (def?.dur || 1) + 0.5 }) }, '▶'),
          h('button', { class: 'btn sm danger', onclick: () => { project.sfx = project.sfx.filter(x => x !== ev); save(); renderPanel(); drawTL(); } }, '🗑'));
      })) : h('p', { class: 'muted small' }, 'Nenhum som adicionado.'),
      h('h4', {}, 'Trilha de fundo'),
      h('div', { class: 'grid music' }, MUSIC.map(m => h('button', { class: 'pad' + ((project.music || 'none') === m.id ? ' on' : ''), onclick: async () => { project.music = m.id; assets.music = await musicBuffer(m.id, project.duration); save(); renderPanel(); if (S.playing) startMix(); else if (m.id !== 'none') play(S.cursor, { end: Math.min(project.duration, S.cursor + 6) }); } }, h('span', { class: 'ic' }, m.icon), m.name))));
  }

  function pMixer() {
    const sl = (k, label, max = 1) => h('div', { class: 'field mix' },
      h('label', {}, label, h('span', { class: 'val' }, Math.round((project.mix[k] ?? 0) * 100) + '%')),
      h('input', { type: 'range', min: 0, max, step: 0.01, value: project.mix[k] ?? 0, oninput: e => { project.mix[k] = +e.target.value; e.target.previousSibling.lastChild.textContent = Math.round(project.mix[k] * 100) + '%'; applyMixLive(); save(); } }));
    return h('div', {},
      sl('orig', sc.kind === 'yt' ? '🎬 Áudio original da cena (YouTube)' : '🎬 Áudio original do vídeo'),
      sl('voice', '🎙️ Sua voz', 2), sl('sfx', '🔊 Efeitos sonoros', 1.5), sl('music', '🎵 Trilha de fundo'), sl('master', '🎚️ Volume geral', 1.5),
      h('div', { class: 'row' },
        h('button', { class: 'btn sm', onclick: () => { project.mix.orig = 0; applyMixLive(); save(); renderPanel(); } }, '🔇 Original mudo'),
        h('button', { class: 'btn sm', onclick: () => { project.mix.orig = 0.12; applyMixLive(); save(); renderPanel(); } }, 'Original de fundo')),
      sc.kind === 'local' ? h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: !!project.removeVoice, onchange: async e => {
        project.removeVoice = e.target.checked; save();
        if (assets.origRaw) { msgEl.textContent = 'Processando áudio…'; msgEl.classList.add('show'); assets.original = project.removeVoice ? await removeVoice(assets.origRaw) : assets.origRaw; origPeaks = null; msgEl.classList.remove('show'); drawTL(); if (S.playing) startMix(); }
      } }), h('span', {}, 'Tirar a voz original e manter música/efeitos (aproximado; funciona melhor em vídeos estéreo)')) : null,
      sc.kind === 'yt' ? h('p', { class: 'muted small' }, 'Vídeos do YouTube não permitem separar a voz da música: use o volume do original no mínimo ao dublar. No iPhone o YouTube só permite ligar ou desligar o som original. No Android e no computador o volume é gradual.') : null);
  }

  function pSync() {
    const tk = project.takes.find(t => t.id === S.selTake) || activeTake(S.selLine);
    const l = tk ? lineById(tk.lineId) : lineById(S.selLine);
    const nudge = async d => { if (!tk) return; tk.nudge = clamp((tk.nudge || 0) + d, -1000, 1000); save(); renderPanel(); drawTL(); playLine(tk.lineId); };
    const autoFit = () => {
      if (!tk) return;
      const b = assets.raw.get(tk.id); if (!b) return;
      const d = b.getChannelData(0); let p = 0; for (const v of d) p = Math.max(p, Math.abs(v));
      const th = p * 0.12; let i = 0; while (i < d.length && Math.abs(d[i]) < th) i++;
      const onset = i / b.sampleRate;
      tk.nudge = Math.round(-Math.max(0, onset - 0.03) * 1000);
      save(); renderPanel(); drawTL(); playLine(tk.lineId);
      toast(`Voz encaixada no início da fala (${tk.nudge} ms)`, 'ok');
    };
    return h('div', {},
      h('h4', {}, 'Bater o take da fala'),
      tk ? h('div', {},
        h('p', { class: 'small' }, h('b', {}, l?.t), h('br'), h('span', { class: 'muted' }, `Deslocamento: ${tk.nudge > 0 ? '+' : ''}${tk.nudge || 0} ms (positivo = mais tarde)`)),
        h('div', { class: 'row wrap' }, [-50, -10, 10, 50].map(d => h('button', { class: 'btn', onclick: () => nudge(d) }, (d > 0 ? '+' : '') + d + ' ms')),
          h('button', { class: 'btn', onclick: () => { tk.nudge = 0; save(); renderPanel(); drawTL(); } }, 'Zerar')),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn sm', onclick: () => playLine(tk.lineId) }, '▶ Ouvir a fala com a cena'),
          h('button', { class: 'btn sm', onclick: autoFit }, '🧲 Encaixar voz no início da fala'),
          h('button', { class: 'btn sm' + (S.loop ? ' on' : ''), onclick: () => { S.loop = !S.loop; loopBtn.classList.toggle('on', S.loop); renderPanel(); } }, '🔁 Repetir fala')),
        h('p', { class: 'muted small' }, 'Também dá para arrastar o take na régua de tempo (faixa do meio). O que passar do fim da janela é cortado.'))
        : h('p', { class: 'muted small' }, 'Selecione uma fala que já tenha take.'),
      h('h4', {}, 'Latência do aparelho (vale para todos os takes)'),
      h('div', { class: 'field mix' },
        h('label', {}, 'Ajuste geral', h('span', { class: 'val' }, `${settings.latencyMs > 0 ? '+' : ''}${settings.latencyMs} ms`)),
        h('input', { type: 'range', min: -400, max: 400, step: 5, value: settings.latencyMs, oninput: e => { setSetting('latencyMs', +e.target.value); e.target.previousSibling.lastChild.textContent = `${settings.latencyMs > 0 ? '+' : ''}${settings.latencyMs} ms`; drawTL(); }, onchange: () => { if (S.playing) startMix(); } })),
      h('p', { class: 'muted small' }, 'Se a sua voz sempre sai atrasada em relação à boca, puxe para negativo. Fone Bluetooth costuma precisar de −150 a −250 ms.'));
  }

  /* ---------- Editor de cena ---------- */
  function pushUndo() { S.undo.push(JSON.stringify(project.lines)); if (S.undo.length > 50) S.undo.shift(); }
  function undo() { const s = S.undo.pop(); if (!s) return toast('Nada para desfazer.'); project.lines = JSON.parse(s); save(); renderPanel(); drawTL(); }
  const persistDefault = debounce(async () => {
    const lines = project.lines.map(({ id, s, e, c, t, o }) => ({ id, s, e, c, t, o }));
    if (sc.custom) { const scene = await db.get('scenes', project.sceneId); if (scene) { scene.lines = lines; scene.timed = true; await db.put('scenes', scene); } }
    else await kv.set('timing:' + project.sceneId, lines);
  }, 800);
  function edited() { project.timed = true; approxBanner.hidden = project.lines.length > 0; sortLines(); save(); drawTL(); persistDefault(); }
  function startTap(create) {
    sortLines();
    if (!project.lines.length) create = true;
    pushUndo();
    if (create) {
      S.tap = { create: true, down: false, count: 0, char: S.tapChar || '' };
      approxBanner.hidden = true; panel.scrollTop = 0;
      S.tab = 'editor'; $$('.tab', tabBar).forEach(b => b.classList.toggle('on', b.dataset.tab === 'editor'));
      renderPanel();
      play(S.cursor >= project.duration - 0.5 ? 0 : S.cursor, { onEnd: () => endTap() });
      return;
    }
    const startIdx = Math.max(0, project.lines.findIndex(l => l.id === S.selLine));
    const from = Math.max(0, project.lines[startIdx].s - 2);
    S.tap = { idx: startIdx, down: false };
    renderPanel();
    play(from, { onEnd: () => endTap() });
  }
  function endTap() {
    if (!S.tap) return;
    const created = S.tap.create ? S.tap.count : 0;
    S.tap = null; edited(); stop(); renderPanel();
    toast(created ? `${created} falas marcadas ✓ Agora digite o texto de cada uma.` : 'Tempos marcados ✓', 'ok');
    if (created) { const first = project.lines.find(l => !l.t); if (first) { S.selLine = first.id; renderPanel(); setTimeout(() => $('.line.sel textarea', panel)?.focus(), 100); } }
  }
  function tapDown(e) {
    e.preventDefault();
    if (!S.tap || !S.playing) return;
    if (!S.tap.create && !project.lines[S.tap.idx]) return;
    S.tap.down = true; S.tap.t0 = S.player.time();
    e.currentTarget.classList.add('down');
  }
  function tapUp(e) {
    e.preventDefault();
    if (!S.tap || !S.tap.down) return;
    S.tap.down = false; e.currentTarget.classList.remove('down');
    const t1 = S.player.time();
    if (S.tap.create) {
      const nl = { id: uid('ln_'), s: +S.tap.t0.toFixed(2), e: +Math.max(S.tap.t0 + 0.3, t1).toFixed(2), c: S.tap.char || '', t: '' };
      project.lines.push(nl); S.tap.count++; sortLines(); drawTL(); save();
      const cnt = $('.tap-count', panel); if (cnt) cnt.textContent = `${S.tap.count} falas marcadas`;
      return;
    }
    const l = project.lines[S.tap.idx];
    l.s = +S.tap.t0.toFixed(2); l.e = +Math.max(S.tap.t0 + 0.3, t1).toFixed(2);
    // empurra as seguintes se houver sobreposição
    S.tap.idx++;
    drawTL();
    if (S.tap.idx >= project.lines.length) { setTimeout(endTap, 300); return; }
    renderPanel();
  }
  function pEditor() {
    sortLines();
    if (S.tap && S.tap.create) {
      const cs = chars();
      return h('div', { class: 'tap-mode' },
        h('p', { class: 'small' }, h('b', {}, 'Marcando falas: '), 'SEGURE o botão enquanto alguém fala. Soltou = fim da fala.'),
        h('button', { class: 'tapbtn', onpointerdown: tapDown, onpointerup: tapUp, onpointerleave: tapUp, oncontextmenu: e => e.preventDefault() }, 'SEGURE enquanto alguém fala'),
        h('p', { class: 'tap-count' }, `${S.tap.count} falas marcadas`),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: endTap }, 'Concluir'), h('button', { class: 'btn ghost', onclick: () => { S.tap = null; stop(); undo(); } }, 'Cancelar')),
        h('div', { class: 'field' }, h('label', {}, 'Quem está falando (opcional)'),
          h('input', { value: S.tap.char, placeholder: 'Nome do personagem', oninput: e => { S.tap.char = S.tapChar = e.target.value.trim(); } }),
          cs.length ? h('div', { class: 'chips' }, cs.map(c => h('button', { class: 'chip', onclick: e => { S.tap.char = S.tapChar = c; e.target.closest('.field').querySelector('input').value = c; } }, c))) : null));
    }
    if (S.tap) {
      const l = project.lines[S.tap.idx];
      return h('div', { class: 'tap-mode' },
        h('p', {}, h('b', {}, `Fala ${S.tap.idx + 1} de ${project.lines.length}`)),
        h('div', { class: 'tap-text' }, l ? (l.c ? l.c + ': ' : '') + l.t : '—'),
        h('button', { class: 'tapbtn', onpointerdown: tapDown, onpointerup: tapUp, onpointerleave: tapUp, oncontextmenu: e => e.preventDefault() }, 'SEGURE enquanto o personagem fala'),
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: endTap }, 'Concluir'), h('button', { class: 'btn ghost', onclick: () => { S.tap = null; stop(); undo(); } }, 'Cancelar')),
        h('p', { class: 'muted small' }, 'Apertou = início da fala. Soltou = fim. O editor pula para a próxima fala sozinho.'));
    }
    const num = (l, k) => h('div', { class: 'tnum' },
      h('button', { class: 'btn xs', onclick: () => { pushUndo(); l[k] = +clamp(l[k] - 0.1, 0, project.duration).toFixed(2); fix(l, k); } }, '−.1'),
      h('button', { class: 'btn xs', onclick: () => { pushUndo(); l[k] = +clamp(l[k] - 0.01, 0, project.duration).toFixed(2); fix(l, k); } }, '−.01'),
      h('input', { type: 'number', step: 0.01, min: 0, max: project.duration, value: l[k].toFixed(2), onchange: e => { pushUndo(); l[k] = +clamp(+e.target.value || 0, 0, project.duration).toFixed(2); fix(l, k); } }),
      h('button', { class: 'btn xs', onclick: () => { pushUndo(); l[k] = +clamp(l[k] + 0.01, 0, project.duration).toFixed(2); fix(l, k); } }, '+.01'),
      h('button', { class: 'btn xs', onclick: () => { pushUndo(); l[k] = +clamp(l[k] + 0.1, 0, project.duration).toFixed(2); fix(l, k); } }, '+.1'),
      h('button', { class: 'btn xs', title: 'Usar o tempo atual do vídeo', onclick: () => { pushUndo(); l[k] = +(S.playing ? S.player.time() : S.cursor).toFixed(2); fix(l, k); } }, '⏱ agora'));
    function fix(l, k) { if (l.e - l.s < 0.2) { if (k === 's') l.s = +(l.e - 0.2).toFixed(2); else l.e = +(l.s + 0.2).toFixed(2); } l.s = Math.max(0, l.s); edited(); renderPanel(); }
    const addLine = after => {
      pushUndo();
      const t = S.playing ? S.player.time() : S.cursor;
      const s = after ? after.e + 0.1 : t;
      const nl = { id: uid('ln_'), s: +Math.min(s, project.duration - 0.5).toFixed(2), e: +Math.min(s + 2, project.duration).toFixed(2), c: after?.c || '', t: 'Nova fala' };
      project.lines.push(nl); S.selLine = nl.id; edited(); renderPanel();
    };
    const split = l => {
      const t = S.cursor;
      if (t <= l.s + 0.2 || t >= l.e - 0.2) return toast('Posicione o cursor dentro da fala para dividir.');
      pushUndo();
      const words = l.t.split(' '); const half = Math.ceil(words.length / 2);
      const nl = { id: uid('ln_'), s: +t.toFixed(2), e: l.e, c: l.c, t: words.slice(half).join(' ') || '...' };
      l.e = +t.toFixed(2); l.t = words.slice(0, half).join(' ');
      project.lines.push(nl); edited(); renderPanel();
    };
    const merge = l => {
      const i = project.lines.indexOf(l); const nx = project.lines[i + 1]; if (!nx) return;
      pushUndo(); l.e = nx.e; l.t = l.t + ' ' + nx.t;
      project.takes.filter(t => t.lineId === nx.id).forEach(t => { t.lineId = l.id; t.active = false; });
      project.lines.splice(i + 1, 1); edited(); renderPanel();
    };
    const del = l => {
      if (!confirm('Apagar esta fala (e os takes dela)?')) return;
      pushUndo();
      project.takes.filter(t => t.lineId === l.id).forEach(t => db.del('blobs', t.blobKey));
      project.takes = project.takes.filter(t => t.lineId !== l.id);
      project.lines = project.lines.filter(x => x !== l); edited(); renderPanel();
    };
    const fileIn = h('input', { type: 'file', accept: '.srt,.vtt,text/vtt,application/x-subrip,text/plain', hidden: true, onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      const lines = parseSubtitles(await f.text());
      if (!lines.length) return toast('Não encontrei legendas nesse arquivo.', 'err');
      pushUndo();
      project.lines = lines.filter(l => l.s < project.duration).map(l => ({ ...l, id: uid('ln_'), e: Math.min(l.e, project.duration) }));
      edited(); renderPanel(); toast(`${project.lines.length} falas importadas`, 'ok');
    } });
    const saveDefault = async () => {
      const lines = project.lines.map(({ id, s, e, c, t, o }) => ({ id, s, e, c, t, o }));
      if (sc.custom) { const scene = await db.get('scenes', project.sceneId); if (scene) { scene.lines = lines; scene.timed = true; await db.put('scenes', scene); } }
      else await kv.set('timing:' + project.sceneId, lines);
      toast('Tempos salvos como padrão desta cena ✓', 'ok');
    };
    return h('div', {},
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn primary', onclick: () => startTap(true) }, project.lines.length ? '➕ Marcar mais falas' : '➕ Marcar as falas do vídeo'),
        project.lines.length ? h('button', { class: 'btn', onclick: () => startTap(false) }, '👆 Reajustar tempos no ritmo') : null,
        h('button', { class: 'btn', onclick: () => addLine(null) }, '+ Fala no cursor'),
        h('button', { class: 'btn', onclick: undo }, '↶ Desfazer'),
        h('button', { class: 'btn', onclick: () => fileIn.click() }, 'Importar .srt/.vtt'),
        h('button', { class: 'btn', onclick: () => downloadBlob(new Blob([toSRT(project.lines)], { type: 'application/x-subrip' }), slug(project.name) + '.srt') }, 'Exportar .srt'),
        h('button', { class: 'btn', onclick: saveDefault }, '💾 Salvar como padrão da cena'), fileIn),
      h('p', { class: 'muted small' }, project.lines.length ? 'Tudo que você marca aqui fica salvo para esta cena. Na régua: arraste as bordas brancas de uma fala para mudar início/fim, ou o meio para mover.' : 'Esta cena ainda não tem falas. Toque em “Marcar as falas do vídeo”, assista e segure o botão enquanto alguém fala. Depois é só digitar o texto de cada fala.'),
      h('ol', { class: 'lines edit' }, project.lines.map((l, i) => h('li', { class: 'line' + (l.id === S.selLine ? ' sel' : ''), onclick: () => { if (S.selLine !== l.id) selectLine(l.id, true); } },
        h('div', { class: 'line-head' }, h('span', { class: 'num' }, i + 1), h('span', { class: 'time' }, lineLabel(l)),
          h('button', { class: 'btn xs', onclick: e => { e.stopPropagation(); playLine(l.id); } }, '▶')),
        h('div', { class: 'edit-grid', onclick: e => e.stopPropagation() },
          h('label', {}, 'Início'), num(l, 's'),
          h('label', {}, 'Fim'), num(l, 'e'),
          h('label', {}, 'Personagem'), h('input', { value: l.c || '', placeholder: 'Nome', onchange: e => { l.c = e.target.value.trim(); edited(); renderPanel(); } }),
          h('label', {}, 'Fala'), h('textarea', { rows: 2, value: l.t, placeholder: 'Digite exatamente o que é falado no vídeo', onchange: e => { l.t = e.target.value.trim(); edited(); } }),
          h('label', {}, 'Original'), h('input', { value: l.o || '', placeholder: '(opcional)', onchange: e => { l.o = e.target.value.trim(); edited(); } })),
        h('div', { class: 'row wrap', onclick: e => e.stopPropagation() },
          h('button', { class: 'btn xs', onclick: () => addLine(l) }, '+ depois'),
          h('button', { class: 'btn xs', onclick: () => split(l) }, '✂ Dividir no cursor'),
          h('button', { class: 'btn xs', disabled: i === project.lines.length - 1, onclick: () => merge(l) }, '⤵ Juntar com a próxima'),
          h('button', { class: 'btn xs danger', onclick: () => del(l) }, '🗑 Apagar'))))));
  }

  /* ---------- Exportar / apresentação ---------- */
  async function present(opts = {}) {
    await stop();
    el.classList.add('presenting');
    try { if (!opts.noFullscreen && stage.requestFullscreen) await stage.requestFullscreen(); } catch {}
    S.cursor = 0;
    const exit = () => { el.classList.remove('presenting'); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
    const n = opts.countdown ?? 3;
    for (let i = n; i > 0; i--) { countEl.textContent = i; countEl.classList.add('show'); await new Promise(r => setTimeout(r, 1000)); }
    countEl.classList.remove('show');
    return new Promise(res => {
      play(0, { onEnd: () => { exit(); res(); } }).then(ok => { if (!ok) { exit(); res(); } });
      const onFs = () => { if (!document.fullscreenElement && el.classList.contains('presenting') && !opts.noFullscreen) { document.removeEventListener('fullscreenchange', onFs); stop(); exit(); res(); } };
      document.addEventListener('fullscreenchange', onFs);
    });
  }
  function doExport() {
    stop();
    openExport({ project, assets, scene: sc, mixProject, stage, present, player: S.player, outBus, save });
  }

  /* ---------- Teclado (desktop) ---------- */
  const onKey = e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); S.playing ? stop() : play(); }
    else if (e.key === 'r' || e.key === 'R') record('line');
    else if (e.key === 'ArrowRight') stepLine(1);
    else if (e.key === 'ArrowLeft') stepLine(-1);
  };
  document.addEventListener('keydown', onKey);
  const onVis = () => { if (document.hidden) stop(); };
  document.addEventListener('visibilitychange', onVis);

  /* ---------- Carregar cena ---------- */
  const sc = project.scene;
  creditEl.textContent = sc.kind === 'yt' ? `▶ ${sc.credit?.channel || 'YouTube'} · ${sc.credit?.title || ''}` : (sc.credit?.channel ? `© ${sc.credit.channel}` : '');
  if (sc.kind === 'yt') creditEl.href = ytUrl(sc.yt, sc.start);
  else creditEl.removeAttribute('href');
  msgEl.textContent = 'Carregando cena…'; msgEl.classList.add('show');
  try {
    if (sc.kind === 'yt') S.player = new YouTubePlayer(playerBox, { id: sc.yt, start: sc.start || 0, end: sc.end || 0 });
    else {
      const blob = await db.get('blobs', sc.blobKey);
      if (!blob) throw new Error('O vídeo desta cena não está mais salvo neste aparelho. Importe o vídeo de novo.');
      S.player = new LocalPlayer(playerBox, { blob });
      decodeBlob(blob).then(async b => { assets.origRaw = b; assets.original = project.removeVoice ? await removeVoice(b) : b; drawTL(); }).catch(() => { S.player.useElementAudio = true; applyMixLive(); });
    }
    await S.player.ready();
    msgEl.classList.remove('show');
    const d = S.player.duration;
    if (!project.duration || Math.abs(project.duration - d) > 0.05) {
      project.duration = d;
      if (project.approx && !project.timed) project.lines = autoTime(project.lines, d);
      project.lines.forEach(l => { l.e = Math.min(l.e, d); l.s = Math.min(l.s, Math.max(0, l.e - 0.2)); });
      save();
    }
    if (sc.kind === 'yt' && S.player.videoData?.author && !sc.credit?.channel) { sc.credit = { ...(sc.credit || {}), channel: S.player.videoData.author, title: S.player.videoData.title }; creditEl.textContent = `▶ ${sc.credit.channel} · ${sc.credit.title}`; save(); }
  } catch (e) {
    msgEl.innerHTML = `<b>Não foi possível carregar a cena.</b><br>${escapeHtml(e.message)}${sc.kind === 'yt' ? `<br><a href="${ytUrl(sc.yt, sc.start)}" target="_blank" rel="noopener">Abrir no YouTube</a>` : ''}`;
    msgEl.classList.add('show', 'err');
    if (!project.duration) project.duration = 30;
  }
  S.player?.on(st => onPlayerState(st));
  approxBanner.hidden = project.lines.length > 0;
  applyMixLive();

  // carregar takes
  await Promise.all(project.takes.map(loadTake));
  if (project.music && project.music !== 'none') assets.music = await musicBuffer(project.music, project.duration);
  for (const ev of project.sfx) assets.sfx.set(ev.key, await sfxBuffer(ev.key));
  setZoom(null);
  setTab(project.lines.length ? 'roteiro' : 'editor');
  loop();
  bigPlay.classList.add('show');

  // API de teste/depuração
  window.__studio = { S, project, assets, play, stop, record, seek, finishRecording, selectLine, setTab };

  return async function destroy() {
    S.destroyed = true;
    cancelAnimationFrame(S.raf);
    await stop();
    try { S.soloSrc?.stop(); } catch {}
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVis);
    S.player?.destroy();
    try { outBus.disconnect(); } catch {}
    await saveNow();
  };
}
