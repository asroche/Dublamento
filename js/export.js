// Exportação: vídeo (arquivo local ou captura da aba), áudio WAV, legendas e arquivo de projeto
import { h, toast, downloadBlob, shareBlob, slug, toSRT, fmtTime, clamp, isIOS } from './util.js';
import { db } from './db.js';
import { getCtx, resumeCtx, renderMixOffline, encodeWAV } from './audio.js';
import { ytUrl } from './scenes.js';
import { charColor } from './studio.js';

function pickMime() {
  const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs="avc1,mp4a"', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  if (!window.MediaRecorder) return null;
  return list.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || '';
}
const extOf = mime => (mime && mime.includes('mp4') ? 'mp4' : 'webm');

export function creditText(sc) {
  if (sc.kind === 'yt') return `Vídeo original: "${sc.credit?.title || ''}" — ${sc.credit?.channel || 'YouTube'} · ${ytUrl(sc.yt, sc.start)}`;
  return sc.credit?.channel ? `Vídeo original: ${sc.credit.channel}${sc.credit.url ? ' · ' + sc.credit.url : ''}` : '';
}

export function openExport(ctx) {
  const { project, scene: sc } = ctx;
  const out = h('div', { class: 'exp-result' });
  const prog = h('div', { class: 'progress big', hidden: true }, h('i'));
  const status = h('p', { class: 'small muted' });
  const close = () => { overlay.remove(); };
  const busy = (on, msg = '') => { prog.hidden = !on; status.textContent = msg; overlay.querySelectorAll('.exp-opt button').forEach(b => (b.disabled = on)); };
  const setProg = p => (prog.firstChild.style.width = clamp(p, 0, 1) * 100 + '%');
  const base = slug(project.name);
  const shareText = `Minha dublagem "${project.name}" feita no Dublamento 🎙️\n${creditText(sc)}`;

  const showResult = (blob, name, kind) => {
    out.innerHTML = '';
    const url = URL.createObjectURL(blob);
    if (kind === 'video') out.append(h('video', { src: url, controls: true, playsinline: true, class: 'exp-preview' }));
    else if (kind === 'audio') out.append(h('audio', { src: url, controls: true, class: 'exp-preview' }));
    out.append(h('div', { class: 'row wrap' },
      h('button', { class: 'btn primary', onclick: () => downloadBlob(blob, name) }, '⬇ Baixar'),
      h('button', { class: 'btn', onclick: async () => { const ok = await shareBlob(blob, name, shareText); if (!ok) { downloadBlob(blob, name); toast('Este navegador não compartilha arquivos: baixei o arquivo para você enviar.'); } } }, '📤 Compartilhar')),
      h('p', { class: 'small muted' }, `${name} · ${(blob.size / 1048576).toFixed(1)} MB`));
  };

  async function wav(includeOriginal) {
    busy(true, 'Mixando o áudio…'); setProg(0.3);
    try {
      const buf = await renderMixOffline(ctx.mixProject(), ctx.assets, includeOriginal);
      setProg(1);
      showResult(encodeWAV(buf), `${base}.wav`, 'audio');
      busy(false, 'Áudio pronto.');
    } catch (e) { busy(false, 'Erro: ' + e.message); }
  }

  async function projectFile() {
    busy(true, 'Empacotando o projeto…');
    const takes = [];
    for (const tk of project.takes.filter(t => t.active)) {
      const blob = await db.get('blobs', tk.blobKey); if (!blob) continue;
      const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
      takes.push({ ...tk, wav: b64 });
    }
    const data = { format: 'dublamento', v: 1, project: { ...project, takes: undefined, thumb: undefined }, takes };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    showResult(blob, `${base}.dublamento.json`, 'file');
    busy(false, sc.kind === 'local' ? 'Projeto pronto. Atenção: o vídeo importado não vai junto (quem abrir precisa importar o mesmo vídeo).' : 'Projeto pronto. Quem abrir no Dublamento assiste sua dublagem por cima do vídeo do YouTube.');
  }

  function drawFrame(g, W, H, t, video) {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    if (video) g.drawImage(video, 0, 0, W, H);
    const l = project.lines.find(x => t >= x.s && t < x.e);
    const fs = Math.round(H / 16);
    if (l && ctx.burnSubs !== false) {
      g.font = `700 ${fs}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      const maxW = W * 0.9;
      const words = l.t.split(' '); const rows = []; let cur = '';
      for (const w of words) { const test = cur ? cur + ' ' + w : w; if (g.measureText(test).width > maxW && cur) { rows.push(cur); cur = w; } else cur = test; }
      rows.push(cur);
      const y0 = H - fs * 0.8 - (rows.length - 1) * fs * 1.2;
      const p = clamp((t - l.s) / (l.e - l.s), 0, 1);
      const total = l.t.length; let done = 0;
      rows.forEach((r, i) => {
        const y = y0 + i * fs * 1.2;
        const w = g.measureText(r).width;
        g.lineWidth = fs * 0.18; g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineJoin = 'round'; g.strokeText(r, W / 2, y);
        g.fillStyle = '#fff'; g.fillText(r, W / 2, y);
        const rp = clamp((p * total - done) / r.length, 0, 1); done += r.length + 1;
        if (rp > 0) { g.save(); g.beginPath(); g.rect(W / 2 - w / 2, y - fs, w * rp, fs * 1.4); g.clip(); g.fillStyle = '#ffd23f'; g.fillText(r, W / 2, y); g.restore(); }
      });
      if (l.c) { g.font = `700 ${Math.round(fs * 0.6)}px system-ui`; const tw = g.measureText(l.c).width + fs * 0.6; const y = y0 - fs * 1.35; g.fillStyle = charColor(l.c); g.fillRect(W / 2 - tw / 2, y - fs * 0.55, tw, fs * 0.8); g.fillStyle = '#fff'; g.fillText(l.c, W / 2, y + fs * 0.05); }
    }
    g.textAlign = 'left'; g.font = `600 ${Math.round(fs * 0.5)}px system-ui`; g.fillStyle = 'rgba(255,255,255,.75)';
    const cr = sc.credit?.channel ? `Original: ${sc.credit.channel}` : '';
    if (cr) g.fillText(cr, fs * 0.4, fs * 0.8);
    g.textAlign = 'right'; g.fillText('🎙 Dublamento', W - fs * 0.4, fs * 0.8);
  }

  async function localVideo() {
    const mime = pickMime();
    if (mime === null || !HTMLCanvasElement.prototype.captureStream) return toast('Este navegador não grava vídeo. Exporte o áudio ou use o modo apresentação.', 'err');
    busy(true, 'Preparando…'); setProg(0);
    const c = await resumeCtx();
    try {
      const blobSrc = await db.get('blobs', sc.blobKey);
      const mixBuf = await renderMixOffline(ctx.mixProject(), ctx.assets, true);
      const v = h('video', { muted: true, playsinline: true, preload: 'auto' }); v.muted = true; v.playsInline = true;
      v.src = URL.createObjectURL(blobSrc);
      await new Promise((r, j) => { v.onloadeddata = r; v.onerror = () => j(new Error('vídeo')); });
      let W = v.videoWidth || 1280, H = v.videoHeight || 720;
      const k = Math.min(1, 1280 / Math.max(W, H)); W = Math.round(W * k / 2) * 2; H = Math.round(H * k / 2) * 2;
      const canvas = h('canvas', { width: W, height: H });
      const g = canvas.getContext('2d');
      drawFrame(g, W, H, 0, v);
      const dest = c.createMediaStreamDestination();
      const src = c.createBufferSource(); src.buffer = mixBuf; src.connect(dest);
      const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined);
      const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      const done = new Promise(r => (rec.onstop = r));
      v.currentTime = 0; await new Promise(r => { v.onseeked = r; setTimeout(r, 800); });
      status.textContent = 'Gravando o vídeo em tempo real… (não feche esta tela)';
      rec.start(250);
      const t0 = c.currentTime + 0.05;
      src.start(t0);
      await v.play().catch(() => {});
      const dur = project.duration;
      await new Promise(res => {
        const step = () => {
          const t = c.currentTime - t0;
          if (t >= dur || v.ended) return res();
          if (Math.abs(v.currentTime - t) > 0.2 && t > 0) v.currentTime = t;
          drawFrame(g, W, H, Math.max(0, t), v);
          setProg(t / dur);
          requestAnimationFrame(step);
        };
        step();
      });
      rec.stop(); v.pause(); try { src.stop(); } catch {}
      await done;
      const type = (mime || 'video/webm').split(';')[0];
      const blob = new Blob(chunks, { type });
      showResult(blob, `${base}.${extOf(type)}`, 'video');
      busy(false, 'Vídeo pronto!');
      URL.revokeObjectURL(v.src);
    } catch (e) { console.error(e); busy(false, 'Erro ao gerar vídeo: ' + e.message); }
  }

  async function tabCapture() {
    const mime = pickMime();
    if (!navigator.mediaDevices?.getDisplayMedia || mime === null) return toast('Seu navegador não permite gravar a aba. Use o modo apresentação + gravador de tela.', 'err');
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: { suppressLocalAudioPlayback: false }, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', systemAudio: 'include' });
    } catch (e) { return toast('Gravação de aba cancelada.'); }
    busy(true, 'Gravando… a dublagem vai tocar do início ao fim.');
    const vt = stream.getVideoTracks()[0];
    try { if (window.CropTarget && vt.cropTo) { const ct = await CropTarget.fromElement(ctx.stage); await vt.cropTo(ct); } } catch (e) { console.warn('crop', e); }
    const c = getCtx();
    let tracks = [vt];
    if (stream.getAudioTracks().length) tracks.push(...stream.getAudioTracks());
    else { const dest = c.createMediaStreamDestination(); ctx.outBus.connect(dest); tracks.push(...dest.stream.getAudioTracks()); toast('Sem áudio da aba: o vídeo terá só sua voz, sons e trilha. Marque “compartilhar áudio da aba” para incluir o original.', 'warn'); }
    const rec = new MediaRecorder(new MediaStream(tracks), mime ? { mimeType: mime } : undefined);
    const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(r => (rec.onstop = r));
    overlay.classList.add('hidden-during-capture');
    rec.start(250);
    const iv = setInterval(() => setProg((ctx.player?.time() || 0) / project.duration), 250);
    vt.onended = () => { if (rec.state === 'recording') rec.stop(); };
    await ctx.present({ noFullscreen: true, countdown: 1 });
    clearInterval(iv);
    if (rec.state === 'recording') rec.stop();
    await done;
    stream.getTracks().forEach(t => t.stop());
    overlay.classList.remove('hidden-during-capture');
    const type = (mime || 'video/webm').split(';')[0];
    showResult(new Blob(chunks, { type }), `${base}.${extOf(type)}`, 'video');
    busy(false, 'Vídeo pronto!');
  }

  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || isIOS();
  const canTab = !!navigator.mediaDevices?.getDisplayMedia && !mobile;
  let includeOrig = sc.kind === 'local';

  const videoOpt = sc.kind === 'local'
    ? h('div', { class: 'exp-opt' }, h('div', {}, h('b', {}, '🎬 Vídeo dublado completo'), h('p', { class: 'small muted' }, 'Vídeo + sua voz + sons + trilha + legendas + crédito. Gera em tempo real (leva a duração da cena).')),
      h('button', { class: 'btn primary', onclick: localVideo }, 'Gerar vídeo'))
    : h('div', { class: 'exp-opt col' },
      h('div', {}, h('b', {}, '🎬 Vídeo dublado completo'),
        h('p', { class: 'small muted' }, 'O YouTube não deixa sites copiarem a imagem dos vídeos dele. ' + (canTab ? 'Aqui no computador o app grava a própria aba, recortada no vídeo (escolha “Esta aba” e marque “Compartilhar áudio da aba”).' : 'No celular: abra o Modo apresentação e grave com o gravador de tela do aparelho (Android: puxe a barra de notificações → Gravar tela; iPhone: Central de Controle → Gravação de Tela).'))),
      h('div', { class: 'row wrap' },
        canTab ? h('button', { class: 'btn primary', onclick: tabCapture }, 'Gravar vídeo da aba') : null,
        h('button', { class: canTab ? 'btn' : 'btn primary', onclick: () => { close(); ctx.present({}); } }, '⛶ Modo apresentação')));

  const overlay = h('div', { class: 'modal', onclick: e => { if (e.target === overlay) close(); } },
    h('div', { class: 'sheet' },
      h('div', { class: 'sheet-head' }, h('h3', {}, 'Exportar dublagem'), h('button', { class: 'iconbtn', onclick: close }, '✕')),
      videoOpt,
      h('div', { class: 'exp-opt' }, h('div', {}, h('b', {}, '🎵 Áudio da dublagem (.wav)'), h('p', { class: 'small muted' }, 'Sua voz + sons + trilha' + (sc.kind === 'local' ? '' : ' (sem o áudio do YouTube)') + '.'),
        sc.kind === 'local' ? h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: includeOrig, onchange: e => (includeOrig = e.target.checked) }), h('span', {}, 'Incluir áudio original')) : null),
        h('button', { class: 'btn', onclick: () => wav(includeOrig) }, 'Gerar áudio')),
      h('div', { class: 'exp-opt' }, h('div', {}, h('b', {}, '📦 Arquivo do projeto'), h('p', { class: 'small muted' }, 'Mande para um amigo abrir no Dublamento e assistir (ou continuar a dublagem).')), h('button', { class: 'btn', onclick: projectFile }, 'Gerar arquivo')),
      h('div', { class: 'exp-opt' }, h('div', {}, h('b', {}, '📝 Legendas (.srt)'), h('p', { class: 'small muted' }, 'O roteiro com os tempos das falas.')), h('button', { class: 'btn', onclick: () => downloadBlob(new Blob([toSRT(project.lines)], { type: 'application/x-subrip' }), base + '.srt') }, 'Baixar')),
      prog, status, out,
      h('p', { class: 'credit-note small' }, '© ' + creditText(sc))));
  document.body.append(overlay);
}
