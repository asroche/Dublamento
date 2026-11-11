// Motor de áudio: contexto, microfone sincronizado, efeitos de voz, SFX, trilhas e mixagem
let ctx;
export function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
  }
  return ctx;
}
export async function resumeCtx() {
  const c = getCtx();
  if (c.state !== 'running') { try { await c.resume(); } catch {} }
  return c;
}
export function outLatency() {
  const c = getCtx();
  return Math.min(0.3, (c.outputLatency || 0) + (c.baseLatency || 0));
}

/* ---------------- Microfone (captura PCM com carimbo de tempo do AudioContext) ---------------- */
const WORKLET = `
class CapProc extends AudioWorkletProcessor {
  constructor(){ super(); this.on = true; this.port.onmessage = e => { if (e.data === 'stop') this.on = false; }; }
  process(inputs){
    const inp = inputs[0];
    if (inp && inp[0] && inp[0].length) {
      const ch = inp.length > 1 ? inp[0].map((v,i)=> (v + inp[1][i]) * 0.5) : inp[0].slice(0);
      this.port.postMessage({ f: currentFrame, d: ch }, [ch.buffer]);
    }
    return this.on;
  }
}
registerProcessor('cap-proc', CapProc);`;

export class Mic {
  constructor() { this.stream = null; this.recording = false; this.chunks = []; this.level = 0; }
  get ready() { return !!this.stream && this.stream.active; }
  async init(opts = {}) {
    const c = await resumeCtx();
    if (this.ready && this._opts === JSON.stringify(opts)) return;
    this.release();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Seu navegador não permite usar o microfone aqui. Abra o site em HTTPS (ou localhost).');
    this._opts = JSON.stringify(opts);
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: opts.echo !== false,
        noiseSuppression: opts.noise !== false,
        autoGainControl: !!opts.agc,
        channelCount: 1,
      },
    });
    this.src = c.createMediaStreamSource(this.stream);
    this.analyser = c.createAnalyser();
    this.analyser.fftSize = 1024;
    this.src.connect(this.analyser);
    this.sink = c.createGain(); this.sink.gain.value = 0; this.sink.connect(c.destination);
    const track = this.stream.getAudioTracks()[0];
    const st = track.getSettings ? track.getSettings() : {};
    this.inputLatency = typeof st.latency === 'number' ? Math.min(0.25, st.latency) : 0.015;
    try {
      if (!c.audioWorklet) throw 0;
      if (!Mic._wl) {
        const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
        Mic._wl = c.audioWorklet.addModule(url);
      }
      await Mic._wl;
      this.node = new AudioWorkletNode(c, 'cap-proc', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
      this.node.port.onmessage = e => { if (this.recording) this.chunks.push(e.data); };
      this.mode = 'worklet';
    } catch {
      this.node = c.createScriptProcessor(2048, 1, 1);
      this.node.onaudioprocess = e => {
        if (!this.recording) return;
        const f = Math.round((e.playbackTime || c.currentTime) * c.sampleRate) - 2048;
        this.chunks.push({ f, d: new Float32Array(e.inputBuffer.getChannelData(0)) });
      };
      this.mode = 'script';
    }
    this.src.connect(this.node);
    this.node.connect(this.sink);
  }
  getLevel() {
    if (!this.analyser) return 0;
    const a = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(a);
    let p = 0; for (const v of a) p = Math.max(p, Math.abs(v));
    return p;
  }
  start() { this.chunks = []; this.recording = true; }
  // Devolve o áudio gravado a partir do instante (tempo do AudioContext) fromCtxTime
  stop(fromCtxTime) {
    this.recording = false;
    const c = getCtx();
    const sr = c.sampleRate;
    const chunks = this.chunks; this.chunks = [];
    if (!chunks.length) return null;
    const f0 = Math.round(fromCtxTime * sr);
    const last = chunks[chunks.length - 1];
    const end = last.f + last.d.length;
    const len = Math.max(0, end - f0);
    if (len < sr * 0.1) return null;
    const out = new Float32Array(len);
    for (const ch of chunks) {
      const off = ch.f - f0;
      for (let i = 0; i < ch.d.length; i++) { const j = off + i; if (j >= 0 && j < len) out[j] = ch.d[i]; }
    }
    const buf = c.createBuffer(1, len, sr);
    buf.copyToChannel(out, 0);
    return buf;
  }
  release() {
    try { this.src?.disconnect(); this.node?.disconnect(); this.sink?.disconnect(); } catch {}
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null; this.node = null;
  }
}

/* ---------------- WAV ---------------- */
export function encodeWAV(buffer, sampleRate) {
  const ch = Math.min(2, buffer.numberOfChannels);
  const sr = sampleRate || buffer.sampleRate;
  const len = buffer.length;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true); ws(36, 'data'); data.setUint32(40, len * ch * 2, true);
  const chans = []; for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-1, Math.min(1, chans[c][i]));
    data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
  }
  return new Blob([data], { type: 'audio/wav' });
}
export async function decodeBlob(blob) {
  const ab = await blob.arrayBuffer();
  const c = getCtx();
  return await new Promise((res, rej) => {
    const p = c.decodeAudioData(ab, res, rej);
    if (p && p.then) p.then(res, rej);
  });
}

/* ---------------- Efeitos de voz ---------------- */
export const EFFECTS = [
  { id: 'normal', name: 'Natural', icon: '🎤' },
  { id: 'grave', name: 'Grave', icon: '🐻', pitch: -5 },
  { id: 'monstro', name: 'Monstro', icon: '👹', pitch: -9, dist: 30 },
  { id: 'esquilo', name: 'Esquilo', icon: '🐿️', pitch: 8 },
  { id: 'helio', name: 'Gás hélio', icon: '🎈', pitch: 12 },
  { id: 'robo', name: 'Robô', icon: '🤖', ring: 55, comb: true },
  { id: 'alien', name: 'Alienígena', icon: '👽', pitch: 4, ring: 28, vibrato: true },
  { id: 'eco', name: 'Eco', icon: '🏔️', echo: true },
  { id: 'reverb', name: 'Reverb', icon: '⛪', reverb: 2.6 },
  { id: 'caverna', name: 'Caverna', icon: '🕳️', reverb: 4.5, echo: true, pitch: -2 },
  { id: 'radio', name: 'Rádio', icon: '📻', band: [500, 3200], dist: 12 },
  { id: 'telefone', name: 'Telefone', icon: '☎️', band: [380, 2600], dist: 6 },
  { id: 'megafone', name: 'Megafone', icon: '📢', band: [800, 4000], dist: 60 },
  { id: 'fantasma', name: 'Fantasma', icon: '👻', pitch: 3, reverb: 3.5, tremolo: true },
  { id: 'narrador', name: 'Narrador', icon: '🎬', pitch: -2, reverb: 0.8, comp: true },
];
export const effectById = id => EFFECTS.find(e => e.id === id) || EFFECTS[0];

// Pitch shift granular (mantém a duração, portanto mantém a sincronia)
export function pitchShift(input, sr, semis) {
  if (!semis) return input;
  const ratio = Math.pow(2, semis / 12);
  const grain = Math.round(sr * 0.046);
  const hop = Math.round(grain / 4);
  const out = new Float32Array(input.length);
  const norm = new Float32Array(input.length);
  const win = new Float32Array(grain);
  for (let i = 0; i < grain; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (grain - 1));
  const n = input.length;
  for (let o = 0; o < n; o += hop) {
    // centraliza a leitura para não deslocar o tempo
    const base = o + (grain / 2) * (1 - ratio);
    for (let k = 0; k < grain; k++) {
      const idx = o + k;
      if (idx >= n) break;
      const pos = base + k * ratio;
      const i0 = Math.floor(pos);
      if (i0 < 0 || i0 + 1 >= n) continue;
      const fr = pos - i0;
      const v = input[i0] * (1 - fr) + input[i0 + 1] * fr;
      out[idx] += v * win[k];
      norm[idx] += win[k];
    }
  }
  for (let i = 0; i < n; i++) if (norm[i] > 1e-3) out[i] /= norm[i];
  return out;
}

function impulse(c, seconds, decay = 3) {
  const len = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}
function distCurve(amount) {
  const n = 2048, curve = new Float32Array(n), k = amount;
  for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x)); }
  return curve;
}

const fxCache = new Map();
export function clearFxCache(prefix) { for (const k of [...fxCache.keys()]) if (!prefix || k.startsWith(prefix)) fxCache.delete(k); }

// Aplica o efeito offline e devolve um novo AudioBuffer (mesma duração/alinhamento)
export async function applyEffect(buffer, fxId, extraPitch = 0, cacheKey) {
  const key = cacheKey ? `${cacheKey}|${fxId}|${extraPitch}` : null;
  if (key && fxCache.has(key)) return fxCache.get(key);
  const fx = effectById(fxId);
  const sr = buffer.sampleRate;
  const semis = (fx.pitch || 0) + (+extraPitch || 0);
  let data = buffer.getChannelData(0);
  if (semis) data = pitchShift(data, sr, semis);
  const simple = fx.id === 'normal' && !semis;
  if (simple) { if (key) fxCache.set(key, buffer); return buffer; }
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const tail = fx.reverb ? fx.reverb : fx.echo ? 1.5 : 0;
  const len = buffer.length; // mantemos o tamanho para alinhar (cauda curta é cortada)
  const total = len + Math.floor(tail * sr);
  const oc = new OAC(1, total, sr);
  const b = oc.createBuffer(1, len, sr); b.copyToChannel(data instanceof Float32Array ? data : new Float32Array(data), 0);
  const src = oc.createBufferSource(); src.buffer = b;
  let node = src;
  const chain = n => { node.connect(n); node = n; return n; };
  if (fx.band) {
    const hp = oc.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = fx.band[0]; hp.Q.value = 0.9; chain(hp);
    const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = fx.band[1]; lp.Q.value = 0.9; chain(lp);
  }
  if (fx.dist) { const ws = oc.createWaveShaper(); ws.curve = distCurve(fx.dist); ws.oversample = '2x'; chain(ws); }
  if (fx.comp) { const cp = oc.createDynamicsCompressor(); cp.threshold.value = -24; cp.ratio.value = 4; chain(cp); const g = oc.createGain(); g.gain.value = 1.6; chain(g); }
  if (fx.ring) {
    const ring = oc.createGain(); ring.gain.value = 0;
    const osc = oc.createOscillator(); osc.frequency.value = fx.ring; osc.type = 'sine';
    osc.connect(ring.gain); osc.start();
    const dry = oc.createGain(); dry.gain.value = 0.35;
    const mix = oc.createGain();
    node.connect(ring); node.connect(dry); ring.connect(mix); dry.connect(mix);
    node = mix;
    if (fx.comb) {
      const d = oc.createDelay(0.05); d.delayTime.value = 0.006;
      const fb = oc.createGain(); fb.gain.value = 0.55;
      const out = oc.createGain();
      node.connect(d); d.connect(fb); fb.connect(d); d.connect(out); node.connect(out);
      node = out;
    }
  }
  if (fx.vibrato) {
    const d = oc.createDelay(0.05); d.delayTime.value = 0.008;
    const lfo = oc.createOscillator(); lfo.frequency.value = 6;
    const depth = oc.createGain(); depth.gain.value = 0.003;
    lfo.connect(depth); depth.connect(d.delayTime); lfo.start();
    chain(d);
  }
  if (fx.tremolo) {
    const g = oc.createGain(); g.gain.value = 0.75;
    const lfo = oc.createOscillator(); lfo.frequency.value = 5;
    const dep = oc.createGain(); dep.gain.value = 0.25; lfo.connect(dep); dep.connect(g.gain); lfo.start();
    chain(g);
  }
  const outMix = oc.createGain();
  node.connect(outMix);
  if (fx.echo) {
    const d = oc.createDelay(1); d.delayTime.value = 0.28;
    const fb = oc.createGain(); fb.gain.value = 0.42;
    const wet = oc.createGain(); wet.gain.value = 0.5;
    node.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(outMix);
  }
  if (fx.reverb) {
    const cv = oc.createConvolver(); cv.buffer = impulse(oc, fx.reverb, 2.8);
    const wet = oc.createGain(); wet.gain.value = fx.reverb > 3 ? 0.55 : 0.4;
    node.connect(cv); cv.connect(wet); wet.connect(outMix);
  }
  outMix.connect(oc.destination);
  src.start(0);
  const rendered = await oc.startRendering();
  normalizePeak(rendered, 0.97);
  if (key) fxCache.set(key, rendered);
  return rendered;
}

export function normalizePeak(buf, target = 0.97) {
  let p = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > p) p = a; } }
  if (p > target) { const k = target / p; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } }
}

// Auto-ganho: deixa a voz com volume bom (sem estourar)
export function autoGain(buf, targetPeak = 0.85) {
  const d = buf.getChannelData(0);
  let p = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > p) p = a; }
  if (p < 0.01) return 1;
  return Math.min(6, targetPeak / p);
}

/* ---------------- Efeitos sonoros (sintetizados, sem direitos autorais) ---------------- */
export const SFX = [
  { id: 'aplausos', name: 'Aplausos', icon: '👏', dur: 2.6 },
  { id: 'risadas', name: 'Risada', icon: '😂', dur: 1.8 },
  { id: 'badumtss', name: 'Ba-dum-tss', icon: '🥁', dur: 1.6 },
  { id: 'buzina', name: 'Buzina', icon: '📯', dur: 1.6 },
  { id: 'explosao', name: 'Explosão', icon: '💥', dur: 2.4 },
  { id: 'drama', name: 'Dun dun dun', icon: '😱', dur: 2.6 },
  { id: 'fail', name: 'Fracasso', icon: '🎺', dur: 2.4 },
  { id: 'vitoria', name: 'Vitória', icon: '🏆', dur: 1.6 },
  { id: 'grilos', name: 'Grilos', icon: '🦗', dur: 2.5 },
  { id: 'boing', name: 'Boing', icon: '🌀', dur: 0.9 },
  { id: 'tapa', name: 'Tapa', icon: '🖐️', dur: 0.4 },
  { id: 'sino', name: 'Ding!', icon: '🔔', dur: 1.8 },
  { id: 'whoosh', name: 'Whoosh', icon: '💨', dur: 0.8 },
  { id: 'pop', name: 'Pop', icon: '🫧', dur: 0.3 },
  { id: 'suspense', name: 'Suspense', icon: '🎻', dur: 3 },
  { id: 'bip', name: 'Censura', icon: '🤬', dur: 0.8 },
];
const sfxBufs = new Map();
export async function sfxBuffer(id) {
  if (sfxBufs.has(id)) return sfxBufs.get(id);
  const p = renderSfx(id);
  sfxBufs.set(id, p);
  return p;
}
async function renderSfx(id) {
  const def = SFX.find(s => s.id === id) || SFX[0];
  const sr = 44100;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oc = new OAC(2, Math.ceil(def.dur * sr), sr);
  const out = oc.createGain(); out.gain.value = 0.9; out.connect(oc.destination);
  const noise = (dur) => { const b = oc.createBuffer(1, Math.ceil(dur * sr), sr); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = oc.createBufferSource(); s.buffer = b; return s; };
  const env = (g, t, a, peak, d, end = 0.0001) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); };
  const tone = (type, f, t, dur, peak = 0.3, dest = out, a = 0.01) => { const o = oc.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); const g = oc.createGain(); env(g, t, a, peak, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dur + 0.05); return o; };
  const nhit = (t, dur, f, type = 'bandpass', peak = 0.5, q = 1) => { const n = noise(dur + 0.05); const bf = oc.createBiquadFilter(); bf.type = type; bf.frequency.value = f; bf.Q.value = q; const g = oc.createGain(); env(g, t, 0.002, peak, dur); n.connect(bf); bf.connect(g); g.connect(out); n.start(t); };
  switch (id) {
    case 'aplausos': for (let i = 0; i < 160; i++) { const t = Math.random() * 2.1; nhit(t, 0.05 + Math.random() * 0.04, 1200 + Math.random() * 2400, 'bandpass', 0.25 + Math.random() * 0.25, 0.8); } break;
    case 'risadas': {
      for (let v = 0; v < 3; v++) for (let i = 0; i < 6; i++) {
        const t = 0.05 + i * 0.22 + v * 0.07 + Math.random() * 0.03;
        const f0 = (v === 0 ? 260 : v === 1 ? 190 : 330) * (1 - i * 0.03);
        const o = oc.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * 1.1, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.85, t + 0.15);
        const f1 = oc.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 850; f1.Q.value = 4;
        const f2 = oc.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1300; f2.Q.value = 5;
        const g = oc.createGain(); env(g, t, 0.02, 0.5, 0.14);
        o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2);
        nhit(t, 0.06, 2500, 'highpass', 0.08);
      }
    } break;
    case 'badumtss': {
      const kick = (t) => { const o = oc.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.2); const g = oc.createGain(); env(g, t, 0.002, 0.9, 0.3); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.4); };
      nhit(0.05, 0.15, 1800, 'bandpass', 0.6, 0.7); tone('triangle', 180, 0.05, 0.12, 0.3);
      kick(0.32); nhit(0.62, 1, 8000, 'highpass', 0.45, 0.5);
    } break;
    case 'buzina': [0, 0.16, 0.32, 0.62].forEach((t, i) => { [440, 554, 659].forEach(f => { const o = tone('sawtooth', f * (i === 3 ? 1 : 1), t, i === 3 ? 0.85 : 0.1, 0.12, out, 0.01); }); }); break;
    case 'explosao': { const n = noise(2.4); const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, 0); lp.frequency.exponentialRampToValueAtTime(120, 2); const g = oc.createGain(); env(g, 0, 0.01, 1, 2.2); n.connect(lp); lp.connect(g); g.connect(out); n.start(0); const o = oc.createOscillator(); o.frequency.setValueAtTime(90, 0); o.frequency.exponentialRampToValueAtTime(30, 1.5); const g2 = oc.createGain(); env(g2, 0, 0.005, 0.8, 1.4); o.connect(g2); g2.connect(out); o.start(0); o.stop(1.6); } break;
    case 'drama': [[0, 293.7, 0.35], [0.45, 261.6, 0.35], [0.9, 207.7, 1.5]].forEach(([t, f, d]) => { ['sawtooth', 'square'].forEach((ty, k) => { const o = oc.createOscillator(); o.type = ty; o.frequency.value = f / (k + 1); const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; const g = oc.createGain(); env(g, t, 0.02, 0.22, d); o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.1); }); }); break;
    case 'fail': [[0, 311], [0.45, 293.7], [0.9, 277.2], [1.35, 261.6]].forEach(([t, f], i) => { const o = oc.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); if (i === 3) { const l = oc.createOscillator(); l.frequency.value = 6; const dg = oc.createGain(); dg.gain.value = 8; l.connect(dg); dg.connect(o.frequency); l.start(t); l.stop(t + 1); } const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; const g = oc.createGain(); env(g, t, 0.03, 0.3, i === 3 ? 0.95 : 0.38); o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + 1.1); }); break;
    case 'vitoria': [[0, 523], [0.12, 659], [0.24, 784], [0.4, 1047]].forEach(([t, f], i) => { tone('square', f, t, i === 3 ? 1 : 0.12, 0.12); tone('triangle', f / 2, t, i === 3 ? 1 : 0.12, 0.15); }); break;
    case 'grilos': for (let i = 0; i < 9; i++) { const t = i * 0.27; for (let k = 0; k < 3; k++) tone('sine', 4400 + (i % 2) * 300, t + k * 0.035, 0.025, 0.15, out, 0.004); } break;
    case 'boing': { const o = oc.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, 0); o.frequency.exponentialRampToValueAtTime(520, 0.5); const l = oc.createOscillator(); l.frequency.value = 22; const dg = oc.createGain(); dg.gain.value = 60; l.connect(dg); dg.connect(o.frequency); l.start(0); const g = oc.createGain(); env(g, 0, 0.005, 0.6, 0.8); o.connect(g); g.connect(out); o.start(0); o.stop(0.9); l.stop(0.9); } break;
    case 'tapa': nhit(0.005, 0.12, 2600, 'bandpass', 1, 0.6); nhit(0.005, 0.05, 6000, 'highpass', 0.6); break;
    case 'sino': [1, 2.76, 5.4].forEach((m, i) => tone('sine', 1320 * m, 0, 1.6 / (i + 1), 0.25 / (i + 1), out, 0.002)); break;
    case 'whoosh': { const n = noise(0.8); const bp = oc.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.setValueAtTime(300, 0); bp.frequency.exponentialRampToValueAtTime(3500, 0.35); bp.frequency.exponentialRampToValueAtTime(600, 0.75); const g = oc.createGain(); g.gain.setValueAtTime(0.001, 0); g.gain.exponentialRampToValueAtTime(0.9, 0.35); g.gain.exponentialRampToValueAtTime(0.001, 0.78); n.connect(bp); bp.connect(g); g.connect(out); n.start(0); } break;
    case 'pop': { const o = oc.createOscillator(); o.frequency.setValueAtTime(400, 0); o.frequency.exponentialRampToValueAtTime(1400, 0.06); const g = oc.createGain(); env(g, 0, 0.002, 0.7, 0.1); o.connect(g); g.connect(out); o.start(0); o.stop(0.2); } break;
    case 'suspense': for (let i = 0; i < 4; i++) { const f = [220, 233, 311, 330][i]; const o = oc.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const tr = oc.createGain(); const l = oc.createOscillator(); l.frequency.value = 13 + i; const dg = oc.createGain(); dg.gain.value = 0.5; l.connect(dg); dg.connect(tr.gain); l.start(0); const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; const g = oc.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.09, 1.5); g.gain.exponentialRampToValueAtTime(0.0001, 3); o.connect(tr); tr.connect(lp); lp.connect(g); g.connect(out); o.start(0); o.stop(3); l.stop(3); } break;
    case 'bip': tone('sine', 1000, 0, 0.7, 0.4, out, 0.005); break;
  }
  return oc.startRendering();
}

/* ---------------- Trilhas de fundo (geradas, livres de direitos) ---------------- */
export const MUSIC = [
  { id: 'none', name: 'Sem trilha', icon: '🔇' },
  { id: 'suspense', name: 'Suspense', icon: '🕵️', bpm: 70 },
  { id: 'epica', name: 'Épica', icon: '⚔️', bpm: 96 },
  { id: 'comedia', name: 'Comédia', icon: '🤡', bpm: 120 },
  { id: 'romantica', name: 'Romântica', icon: '💘', bpm: 72 },
  { id: 'triste', name: 'Triste', icon: '😢', bpm: 60 },
  { id: 'acao', name: 'Ação', icon: '💣', bpm: 140 },
  { id: 'lofi', name: 'Lo-fi', icon: '🎧', bpm: 84 },
  { id: 'novela', name: 'Novela', icon: '🌹', bpm: 66 },
];
const musicCache = new Map();
export async function musicBuffer(id, dur) {
  if (!id || id === 'none') return null;
  const k = id + '|' + Math.ceil(dur);
  if (musicCache.has(k)) return musicCache.get(k);
  const p = renderMusic(id, Math.ceil(dur) + 1);
  musicCache.set(k, p);
  return p;
}
async function renderMusic(id, dur) {
  const def = MUSIC.find(m => m.id === id);
  const sr = 32000;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oc = new OAC(2, Math.ceil(dur * sr), sr);
  const master = oc.createGain(); master.gain.value = 0.6;
  const comp = oc.createDynamicsCompressor(); master.connect(comp); comp.connect(oc.destination);
  const beat = 60 / def.bpm;
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const noiseBuf = (() => { const b = oc.createBuffer(1, sr, sr); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const note = (n, t, d, type = 'triangle', vol = 0.1, cutoff = 2500, a = 0.02) => {
    if (t > dur) return;
    const o = oc.createOscillator(); o.type = type; o.frequency.value = hz(n);
    const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff;
    const g = oc.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.setValueAtTime(vol, t + Math.max(a, d * 0.6)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
  };
  const kick = t => { if (t > dur) return; const o = oc.createOscillator(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); const g = oc.createGain(); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3); };
  const hat = (t, v = 0.08, d = 0.05) => { if (t > dur) return; const s = oc.createBufferSource(); s.buffer = noiseBuf; const hp = oc.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000; const g = oc.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(hp); hp.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02); };
  const snare = t => { if (t > dur) return; const s = oc.createBufferSource(); s.buffer = noiseBuf; const bp = oc.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; const g = oc.createGain(); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); s.connect(bp); bp.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + 0.2); };
  const progs = {
    suspense: [[45, 48, 52], [44, 48, 51], [45, 48, 52], [46, 49, 53]],
    epica: [[50, 57, 62], [46, 53, 58], [48, 55, 60], [45, 52, 57]],
    comedia: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]],
    romantica: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]],
    triste: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    acao: [[52, 59, 64], [52, 59, 64], [48, 55, 60], [50, 57, 62]],
    lofi: [[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71], [57, 60, 64, 67]],
    novela: [[57, 61, 64, 68], [54, 57, 61, 64], [50, 54, 57, 61], [52, 56, 59, 62]],
  };
  const prog = progs[id];
  const bar = beat * 4;
  for (let b = 0; b * bar < dur; b++) {
    const t = b * bar; const ch = prog[b % prog.length];
    switch (id) {
      case 'suspense':
        ch.forEach(n => note(n, t, bar, 'sawtooth', 0.025, 700, 0.6));
        for (let i = 0; i < 8; i++) note(ch[0] - 12, t + i * beat / 2, beat * 0.4, 'triangle', 0.12, 400);
        if (b % 2) note(ch[2] + 24, t + beat * 3, beat, 'sine', 0.04, 4000);
        break;
      case 'epica':
        ch.forEach(n => note(n, t, bar, 'sawtooth', 0.04, 1200, 0.3));
        note(ch[0] - 12, t, bar, 'sawtooth', 0.08, 300);
        [0, 1.5, 2, 3].forEach(x => kick(t + x * beat)); [1, 3].forEach(x => snare(t + x * beat));
        break;
      case 'comedia':
        for (let i = 0; i < 8; i++) note((i % 2 ? ch[1 + (i % 2)] : ch[0]) - (i % 2 ? 0 : 12), t + i * beat / 2, beat * 0.25, 'square', 0.06, 2200, 0.005);
        [0, 2].forEach(x => note(ch[0] - 24, t + x * beat, beat * 0.4, 'triangle', 0.18, 600));
        [1, 3].forEach(x => note(ch[2] + 12, t + x * beat, beat * 0.2, 'sine', 0.06, 5000, 0.005));
        break;
      case 'romantica':
        ch.forEach((n, i) => note(n, t + i * beat * 0.5, bar - i * beat * 0.5, 'sine', 0.06, 3000, 0.05));
        note(ch[0] - 12, t, bar, 'triangle', 0.08, 800);
        break;
      case 'triste':
        for (let i = 0; i < 4; i++) note(ch[i % 3] + (i === 3 ? 12 : 0), t + i * beat, beat * 1.5, 'triangle', 0.07, 1800);
        note(ch[0] - 12, t, bar, 'sine', 0.08, 600);
        break;
      case 'acao':
        for (let i = 0; i < 16; i++) note(ch[0] - 12, t + i * beat / 4, beat / 5, 'sawtooth', 0.06, 800, 0.005);
        if (b % 2 === 0) ch.forEach(n => note(n + 12, t, beat * 2, 'square', 0.025, 2000));
        [0, 2, 2.5].forEach(x => kick(t + x * beat)); [1, 3].forEach(x => snare(t + x * beat));
        for (let i = 0; i < 8; i++) hat(t + i * beat / 2);
        break;
      case 'lofi':
        ch.forEach(n => note(n, t, bar * 0.95, 'triangle', 0.035, 1200, 0.08));
        note(ch[0] - 24, t, beat * 2, 'sine', 0.15, 400); note(ch[0] - 24, t + beat * 2.5, beat, 'sine', 0.12, 400);
        [0, 2.5].forEach(x => kick(t + x * beat)); [1, 3].forEach(x => snare(t + x * beat));
        for (let i = 0; i < 8; i++) hat(t + i * beat / 2 + (i % 2 ? beat * 0.08 : 0), 0.04);
        break;
      case 'novela':
        ch.forEach(n => note(n, t, bar, 'sawtooth', 0.02, 1500, 0.8));
        for (let i = 0; i < 4; i++) note(ch[(i + 1) % 4] + 12, t + i * beat, beat * 0.9, 'sine', 0.05, 4000);
        note(ch[0] - 12, t, bar, 'triangle', 0.08, 600);
        break;
    }
  }
  return oc.startRendering();
}

/* ---------------- Mixagem ---------------- */
// assets: { takes: Map(takeId -> AudioBuffer já com efeito), original: AudioBuffer|null, music: AudioBuffer|null, sfx: Map(id->AudioBuffer) }
// Agenda tudo no contexto `c` a partir do tempo de cena `from`, começando no instante `when` do contexto.
export function scheduleMix(c, dest, project, assets, from, when, opts = {}) {
  const mix = project.mix;
  const nodes = [];
  const master = c.createGain(); master.gain.value = mix.master ?? 1; master.connect(dest);
  const bus = { voice: c.createGain(), sfx: c.createGain(), music: c.createGain(), orig: c.createGain() };
  bus.voice.gain.value = mix.voice ?? 1; bus.sfx.gain.value = mix.sfx ?? 0.8; bus.music.gain.value = mix.music ?? 0.35; bus.orig.gain.value = opts.includeOriginal ? (mix.orig ?? 0.3) : 0;
  Object.values(bus).forEach(g => g.connect(master));
  const play = (buf, sceneStart, gainNode, gain = 1, maxDur) => {
    if (!buf) return;
    let offset = from - sceneStart; let at = when;
    if (offset < 0) { at = when - offset; offset = 0; }
    if (offset >= buf.duration) return;
    const s = c.createBufferSource(); s.buffer = buf;
    const g = c.createGain(); g.gain.value = gain;
    s.connect(g); g.connect(gainNode);
    const dur = maxDur != null ? Math.max(0, maxDur - offset) : undefined;
    if (dur === 0) return;
    dur != null ? s.start(at, offset, dur) : s.start(at, offset);
    nodes.push(s);
  };
  const lat = (project.latencyMs || 0) / 1000;
  const end = project.duration || 1e9;
  for (const tk of project.takes) {
    if (tk.mute || opts.skipTake === tk.id) continue;
    if (opts.solo && opts.solo !== tk.id) continue;
    const buf = assets.takes.get(tk.id); if (!buf) continue;
    // tk.start já inclui o início da fala + ajuste fino; tk.maxDur limita o take à janela da fala
    const st = tk.start + lat;
    play(buf, st, bus.voice, tk.gain ?? 1, Math.max(0, Math.min(tk.maxDur ?? 1e9, end - st)));
  }
  if (!opts.solo) {
    for (const ev of project.sfx || []) play(assets.sfx.get(ev.key), ev.t, bus.sfx, ev.gain ?? 1);
    if (assets.music) play(assets.music, 0, bus.music, 1, end);
    if (assets.original) play(assets.original, 0, bus.orig, 1, end);
  }
  return {
    master, bus,
    stop() { nodes.forEach(n => { try { n.stop(); } catch {} }); try { master.disconnect(); } catch {} },
  };
}

export async function renderMixOffline(project, assets, includeOriginal = false, sr = 44100) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const dur = Math.max(0.5, project.duration);
  const oc = new OAC(2, Math.ceil(dur * sr), sr);
  const lim = oc.createDynamicsCompressor(); lim.threshold.value = -3; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.15;
  lim.connect(oc.destination);
  scheduleMix(oc, lim, project, assets, 0, 0, { includeOriginal });
  return oc.startRendering();
}

export function peaks(buf, n) {
  const d = buf.getChannelData(0);
  const step = Math.max(1, Math.floor(d.length / n));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let m = 0; const s = i * step; for (let j = 0; j < step; j += 4) { const a = Math.abs(d[s + j] || 0); if (a > m) m = a; } out[i] = m; }
  return out;
}
