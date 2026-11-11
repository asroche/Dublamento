// Players de cena: YouTube (player oficial) e vídeo local. Interface comum.
import { h } from './util.js';

let ytApi;
function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApi) return ytApi;
  ytApi = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => { ytApi = null; reject(new Error('Não foi possível carregar o player do YouTube. Verifique a internet.')); };
    document.head.append(s);
    setTimeout(() => { if (!(window.YT && window.YT.Player)) { ytApi = null; reject(new Error('O YouTube demorou demais para responder. Verifique a internet.')); } }, 20000);
  });
  return ytApi;
}

class Base {
  constructor() { this.listeners = new Set(); this.state = 'idle'; }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(st) { this.state = st; this.listeners.forEach(f => f(st)); }
  isPlaying() { return this.state === 'playing'; }
  waitPlaying(timeout = 15000) {
    if (this.state === 'playing') return Promise.resolve();
    return new Promise((res, rej) => {
      const off = this.on(st => { if (st === 'playing') { off(); clearTimeout(t); res(); } if (st === 'error') { off(); clearTimeout(t); rej(new Error(this.errorMsg || 'Erro no vídeo')); } });
      const t = setTimeout(() => { off(); rej(new Error('O vídeo não começou a tocar. Verifique a conexão e tente de novo.')); }, timeout);
    });
  }
}

export class YouTubePlayer extends Base {
  constructor(container, { id, start = 0, end = 0 }) {
    super();
    this.id = id; this.clipStart = start; this.clipEnd = end; this.container = container;
    this._t = 0; this._raw = -1; this._anchorT = 0; this._anchorP = 0;
    this.vol = 1;
    this.readyP = this._init();
  }
  async _init() {
    const YT = await loadYT();
    const el = h('div', { class: 'yt-target' });
    this.container.innerHTML = '';
    this.container.append(el);
    await new Promise((resolve, reject) => {
      this.p = new YT.Player(el, {
        videoId: this.id, width: '100%', height: '100%',
        playerVars: { controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0, start: Math.floor(this.clipStart), origin: location.origin.startsWith('http') ? location.origin : undefined },
        events: {
          onReady: () => resolve(),
          onError: (e) => {
            const map = { 2: 'Link de vídeo inválido.', 5: 'Este vídeo não pode tocar aqui.', 100: 'Vídeo removido ou privado.', 152: 'O YouTube recusou tocar o vídeo aqui. Abra o Dublamento pelo link https.', 153: 'O YouTube exige que o Dublamento seja aberto por um link https (não pelo arquivo direto).', 101: 'O dono do vídeo não permite que ele seja incorporado em outros sites.', 150: 'O dono do vídeo não permite que ele seja incorporado em outros sites.' };
            this.errorMsg = map[e.data] || 'Erro no vídeo do YouTube.';
            this.emit('error'); reject(new Error(this.errorMsg));
          },
          onStateChange: (e) => {
            const S = YT.PlayerState;
            const st = e.data === S.PLAYING ? 'playing' : e.data === S.BUFFERING ? 'buffering' : e.data === S.ENDED ? 'ended' : e.data === S.PAUSED ? 'paused' : 'idle';
            if (st === 'playing') this._reanchor(true);
            this.emit(st);
          },
        },
      });
    });
    const full = this.p.getDuration() || 0;
    if (full > 0 && (!this.clipEnd || this.clipEnd > full)) this.clipEnd = full;
    const vd = this.p.getVideoData ? this.p.getVideoData() : {};
    this.videoData = { title: vd.title, author: vd.author };
    this.applyVolume();
    // pré-carrega e para no início do corte
    this.p.seekTo(this.clipStart, true);
    this.p.pauseVideo();
    this.emit('ready');
  }
  ready() { return this.readyP; }
  get duration() { return Math.max(0.5, (this.clipEnd || (this.p?.getDuration?.() || 60)) - this.clipStart); }
  _reanchor(force) {
    const raw = this.p.getCurrentTime();
    this._raw = raw; this._anchorT = raw; this._anchorP = performance.now();
  }
  // Tempo interpolado (o YouTube atualiza o tempo em degraus; interpolamos para ficar suave)
  time() {
    if (!this.p || !this.p.getCurrentTime) return 0;
    const raw = this.p.getCurrentTime();
    const now = performance.now();
    if (this.state !== 'playing') { this._anchorT = raw; this._anchorP = now; this._raw = raw; return Math.max(0, raw - this.clipStart); }
    const pred = this._anchorT + (now - this._anchorP) / 1000;
    if (raw !== this._raw) {
      this._raw = raw;
      const err = raw - pred;
      if (Math.abs(err) > 0.2) { this._anchorT = raw; this._anchorP = now; }
      else this._anchorT += err * 0.15;
    }
    const t = this._anchorT + (now - this._anchorP) / 1000;
    return Math.max(0, t - this.clipStart);
  }
  play() { this.p?.playVideo(); }
  pause() { this.p?.pauseVideo(); }
  seek(t) { if (!this.p) return; const v = this.clipStart + Math.max(0, t); this.p.seekTo(v, true); this._anchorT = v; this._anchorP = performance.now(); this._raw = -1; }
  setVolume(v) { this.vol = v; this.applyVolume(); }
  applyVolume() {
    if (!this.p || !this.p.mute) return;
    if (this.vol <= 0.001 || this.forceMute) this.p.mute(); else { this.p.unMute(); this.p.setVolume(Math.round(this.vol * 100)); }
  }
  destroy() { try { this.p?.destroy(); } catch {} this.container.innerHTML = ''; this.listeners.clear(); }
}

export class LocalPlayer extends Base {
  constructor(container, { blob, url }) {
    super();
    this.container = container;
    this.v = h('video', { playsinline: true, 'webkit-playsinline': true, preload: 'auto', muted: true });
    this.v.muted = true; this.v.playsInline = true;
    this.url = blob ? URL.createObjectURL(blob) : url;
    if (!blob) this.v.crossOrigin = 'anonymous';
    this.v.src = this.url;
    container.innerHTML = ''; container.append(this.v);
    this.vol = 1;
    this.v.addEventListener('playing', () => this.emit('playing'));
    this.v.addEventListener('pause', () => this.emit('paused'));
    this.v.addEventListener('waiting', () => this.emit('buffering'));
    this.v.addEventListener('ended', () => this.emit('ended'));
    this.v.addEventListener('error', () => { this.errorMsg = 'Não foi possível abrir este vídeo (formato não suportado pelo navegador?).'; this.emit('error'); });
    this.readyP = new Promise((res, rej) => {
      if (this.v.readyState >= 1) return res();
      this.v.addEventListener('loadedmetadata', () => res(), { once: true });
      this.v.addEventListener('error', () => rej(new Error(this.errorMsg)), { once: true });
    }).then(() => this.emit('ready'));
  }
  ready() { return this.readyP; }
  get duration() { return this.v.duration && isFinite(this.v.duration) ? this.v.duration : 1; }
  time() { return this.v.currentTime; }
  play() { const p = this.v.play(); p && p.catch(() => {}); }
  pause() { this.v.pause(); }
  seek(t) { this.v.currentTime = Math.max(0, Math.min(t, this.duration - 0.01)); }
  // O áudio original do vídeo local é tocado pelo mixer (decodificado); o elemento fica mudo.
  // Se não der para decodificar, usamos o volume do próprio vídeo.
  setVolume(v) { this.vol = v; if (this.useElementAudio) { this.v.muted = v <= 0.001; this.v.volume = Math.min(1, v); } }
  destroy() { this.v.pause(); this.v.removeAttribute('src'); this.v.load(); if (this.url?.startsWith('blob:')) URL.revokeObjectURL(this.url); this.container.innerHTML = ''; this.listeners.clear(); }
}
