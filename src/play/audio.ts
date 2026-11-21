import { SCENE_META } from '../data';
import type { SceneId } from '../types';

export type AudioMood = 'title' | 'explore' | 'dialog' | 'reel' | 'ending' | 'viewfinder';

export type ScoreCueId =
  | 'title_chronicle'
  | 'campus_night'
  | 'street_avenue'
  | 'march_anthem'
  | 'square_dawn'
  | 'camp_vigil'
  | 'martial_tension'
  | 'statue_twilight'
  | 'hutong_vigil'
  | 'aftermath_elegy'
  | 'worker_factory'
  | 'courtyard_home'
  | 'press_night'
  | 'xinhua_vigil'
  | 'march_day_surge'
  | 'rain_square'
  | 'market_morning'
  | 'hospital_watch';

export type StingerId = 'stinger_chapter' | 'stinger_ending' | 'stinger_shutter' | 'stinger_dispatch';
type AnyAudioId = ScoreCueId | StingerId;

export const MAX_SCORE_BUFFERS = 4;

const SCORE_CUES = new Set<string>([
  'title_chronicle',
  'campus_night',
  'street_avenue',
  'march_anthem',
  'square_dawn',
  'camp_vigil',
  'martial_tension',
  'statue_twilight',
  'hutong_vigil',
  'aftermath_elegy',
  'worker_factory',
  'courtyard_home',
  'press_night',
  'xinhua_vigil',
  'march_day_surge',
  'rain_square',
  'market_morning',
  'hospital_watch',
]);

const CUE_FALLBACKS: Partial<Record<ScoreCueId, ScoreCueId>> = {
  press_night: 'street_avenue',
  xinhua_vigil: 'hutong_vigil',
  march_day_surge: 'march_anthem',
  rain_square: 'square_dawn',
  market_morning: 'courtyard_home',
  hospital_watch: 'aftermath_elegy',
};

const NEXT_CUES: Record<ScoreCueId, readonly ScoreCueId[]> = {
  title_chronicle: ['campus_night', 'worker_factory'],
  campus_night: ['street_avenue', 'march_anthem', 'martial_tension'],
  street_avenue: ['march_anthem', 'square_dawn', 'camp_vigil'],
  march_anthem: ['square_dawn'],
  square_dawn: ['campus_night'],
  camp_vigil: ['campus_night'],
  martial_tension: ['street_avenue'],
  statue_twilight: ['street_avenue'],
  hutong_vigil: ['aftermath_elegy'],
  aftermath_elegy: [],
  worker_factory: ['street_avenue', 'march_anthem', 'courtyard_home'],
  courtyard_home: ['worker_factory', 'hutong_vigil'],
  press_night: ['street_avenue', 'aftermath_elegy'],
  xinhua_vigil: ['hutong_vigil', 'street_avenue'],
  march_day_surge: ['march_anthem', 'square_dawn'],
  rain_square: ['square_dawn', 'aftermath_elegy'],
  market_morning: ['courtyard_home', 'street_avenue'],
  hospital_watch: ['aftermath_elegy', 'street_avenue'],
};

interface NoiseLayerSpec {
  filter: BiquadFilterType;
  freq: number;
  q: number;
  gain: number;
  lfoRate?: number;
  lfoDepth?: number;
}

interface DroneLayerSpec {
  freq: number;
  wave: OscillatorType;
  gain: number;
  cutoff: number;
}

type PeriodicKind = 'cricket' | 'bird' | 'bell' | 'radio' | 'telex' | 'courtyardMix';

interface PeriodicEventSpec {
  intervalMs: number;
  chance: number;
  kind: PeriodicKind;
}

export interface AmbientProfileSpec {
  noise: readonly NoiseLayerSpec[];
  drones?: readonly DroneLayerSpec[];
  periodic?: PeriodicEventSpec;
}

/** Declarative environmental soundscape profiles keyed by SCENE_META[sceneId].ambientProfile. */
export const AMBIENT_PROFILES: Record<string, AmbientProfileSpec> = {
  campus_night: {
    noise: [{ filter: 'lowpass', freq: 380, q: 0.7, gain: 0.032, lfoRate: 0.12, lfoDepth: 0.012 }],
    periodic: { intervalMs: 1800, chance: 0.6, kind: 'cricket' },
  },
  street_avenue: {
    noise: [
      { filter: 'bandpass', freq: 210, q: 0.9, gain: 0.036, lfoRate: 0.08, lfoDepth: 0.012 },
      { filter: 'lowpass', freq: 500, q: 0.6, gain: 0.018, lfoRate: 0.14, lfoDepth: 0.006 },
    ],
    periodic: { intervalMs: 3600, chance: 0.35, kind: 'bell' },
  },
  crowd_march: {
    noise: [
      { filter: 'bandpass', freq: 340, q: 1.4, gain: 0.034, lfoRate: 0.16, lfoDepth: 0.012 },
      { filter: 'lowpass', freq: 280, q: 0.7, gain: 0.022, lfoRate: 0.09, lfoDepth: 0.008 },
    ],
  },
  square_open: {
    noise: [
      { filter: 'lowpass', freq: 340, q: 0.7, gain: 0.03, lfoRate: 0.11, lfoDepth: 0.01 },
      { filter: 'bandpass', freq: 480, q: 1.6, gain: 0.014, lfoRate: 0.15, lfoDepth: 0.005 },
    ],
  },
  curfew_static: {
    noise: [
      { filter: 'bandpass', freq: 1420, q: 3.2, gain: 0.012, lfoRate: 0.35, lfoDepth: 0.005 },
      { filter: 'lowpass', freq: 240, q: 0.8, gain: 0.02 },
    ],
    periodic: { intervalMs: 3200, chance: 0.4, kind: 'radio' },
  },
  aftermath_birds: {
    noise: [{ filter: 'lowpass', freq: 300, q: 0.6, gain: 0.022, lfoRate: 0.09, lfoDepth: 0.007 }],
    periodic: { intervalMs: 2800, chance: 0.55, kind: 'bird' },
  },
  factory_hum: {
    // Subtle 55Hz A-tuned workshop room hum sitting cleanly under A Dorian worker theme
    drones: [{ freq: 55, wave: 'sine', gain: 0.009, cutoff: 110 }],
    noise: [{ filter: 'bandpass', freq: 240, q: 1.3, gain: 0.024, lfoRate: 0.25, lfoDepth: 0.007 }],
  },
  courtyard_home: {
    noise: [{ filter: 'lowpass', freq: 350, q: 0.7, gain: 0.024, lfoRate: 0.11, lfoDepth: 0.009 }],
    periodic: { intervalMs: 2100, chance: 0.72, kind: 'courtyardMix' },
  },
  balcony_wind: {
    noise: [
      { filter: 'bandpass', freq: 420, q: 1.1, gain: 0.024, lfoRate: 0.13, lfoDepth: 0.009 },
      { filter: 'lowpass', freq: 290, q: 0.65, gain: 0.020, lfoRate: 0.08, lfoDepth: 0.006 },
    ],
    periodic: { intervalMs: 4200, chance: 0.25, kind: 'bell' },
  },
  newsroom_telex: {
    drones: [{ freq: 50, wave: 'sine', gain: 0.005, cutoff: 100 }],
    noise: [{ filter: 'lowpass', freq: 320, q: 0.8, gain: 0.014 }],
    periodic: { intervalMs: 2400, chance: 0.45, kind: 'telex' },
  },
  hospital_quiet: {
    noise: [{ filter: 'lowpass', freq: 260, q: 0.7, gain: 0.018, lfoRate: 0.09, lfoDepth: 0.005 }],
    periodic: { intervalMs: 3600, chance: 0.35, kind: 'bird' },
  },
  interior_room: {
    noise: [{ filter: 'lowpass', freq: 250, q: 0.75, gain: 0.015, lfoRate: 0.07, lfoDepth: 0.004 }],
    periodic: { intervalMs: 4000, chance: 0.22, kind: 'radio' },
  },
  market_morning: {
    noise: [
      { filter: 'bandpass', freq: 440, q: 1.1, gain: 0.024, lfoRate: 0.18, lfoDepth: 0.008 },
      { filter: 'lowpass', freq: 520, q: 0.65, gain: 0.015 },
    ],
    periodic: { intervalMs: 2500, chance: 0.5, kind: 'bell' },
  },
  rain_avenue: {
    noise: [
      { filter: 'highpass', freq: 1100, q: 0.6, gain: 0.018, lfoRate: 0.14, lfoDepth: 0.004 },
      { filter: 'lowpass', freq: 640, q: 0.7, gain: 0.028, lfoRate: 0.1, lfoDepth: 0.006 },
    ],
  },
};

const CROSSFADE_SEC = 2.2;
const FADE_CURVE_STEPS = 48;

const FADE_IN_CURVE = (() => {
  const arr = new Float32Array(FADE_CURVE_STEPS);
  for (let i = 0; i < FADE_CURVE_STEPS; i++) {
    arr[i] = Math.sin((i / (FADE_CURVE_STEPS - 1)) * (Math.PI / 2));
  }
  return arr;
})();

const FADE_OUT_CURVE = (() => {
  const arr = new Float32Array(FADE_CURVE_STEPS);
  for (let i = 0; i < FADE_CURVE_STEPS; i++) {
    arr[i] = Math.cos((i / (FADE_CURVE_STEPS - 1)) * (Math.PI / 2));
  }
  return arr;
})();

interface ActiveDeck {
  cue: ScoreCueId;
  src: AudioBufferSourceNode;
  gain: GainNode;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let musicFilter: BiquadFilterNode | null = null;
let ambGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let voiceBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

let enabled = true;
let narratorDuckFactor = 1.0;
let currentScene: SceneId = 'campus';
let currentChapterId: string | undefined;
let currentWeather: string | undefined;
let currentMood: AudioMood = 'title';
let activeStops: (() => void)[] = [];
let tickTimer: number | null = null;
let lastStepAt = 0;

let activeDeck: ActiveDeck | null = null;
let retiringDecks: ActiveDeck[] = [];
let scoreReqToken = 0;
let stingersPrimed = false;
let preloadTimer: number | null = null;

const bufferCache = new Map<AnyAudioId, AudioBuffer>();
const pendingLoads = new Map<AnyAudioId, Promise<AudioBuffer | null>>();
const missingAudioIds = new Set<AnyAudioId>();

function isScoreCue(id: AnyAudioId): id is ScoreCueId {
  return !id.startsWith('stinger_');
}

function touchBufferCache(id: AnyAudioId, buf: AudioBuffer): void {
  bufferCache.delete(id);
  bufferCache.set(id, buf);
  if (isScoreCue(id)) {
    evictScoreBuffers(id);
  }
}

function evictScoreBuffers(protectedCue?: ScoreCueId): void {
  let scoreCount = 0;
  for (const k of bufferCache.keys()) {
    if (isScoreCue(k)) scoreCount++;
  }
  if (scoreCount <= MAX_SCORE_BUFFERS) return;

  for (const k of bufferCache.keys()) {
    if (scoreCount <= MAX_SCORE_BUFFERS) break;
    if (!isScoreCue(k)) continue;
    if (k === activeDeck?.cue || k === protectedCue) continue;
    bufferCache.delete(k);
    scoreCount--;
  }
}

/** Resolve the logical score cue for a scene (plus optional chapterId / weather overrides) via SCENE_META. */
export function resolveCue(sceneId: SceneId, chapterId?: string, weather?: string): ScoreCueId {
  const w = weather?.toLowerCase();
  if ((w === 'rain' || w === 'rain_overcast') && (sceneId === 'changan' || sceneId === 'square' || sceneId === 'changan_rain')) {
    return 'rain_square';
  }
  if (w === 'curfew_amber' && (sceneId === 'street' || sceneId === 'blockade')) {
    return 'martial_tension';
  }
  const metaCue = SCENE_META[sceneId]?.defaultCue;
  if (metaCue && SCORE_CUES.has(metaCue)) {
    return metaCue as ScoreCueId;
  }
  if (chapterId?.startsWith('j')) return 'press_night';
  if (chapterId?.startsWith('w')) return 'worker_factory';
  return 'title_chronicle';
}

function targetCueForState(): ScoreCueId {
  if (currentMood === 'title' || currentMood === 'reel') return 'title_chronicle';
  return resolveCue(currentScene, currentChapterId, currentWeather);
}

function targetMoodGainAndCutoff(mood: AudioMood): [number, number] {
  switch (mood) {
    case 'dialog':
      return [0.58, 3600];
    case 'viewfinder':
      return [0.72, 9500];
    case 'reel':
    case 'title':
      return [1.02, 18000];
    case 'ending':
      return [1.0, 17000];
    case 'explore':
    default:
      return [0.92, 16500];
  }
}

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();

      master = ctx.createGain();
      master.gain.value = enabled ? 0.68 : 0;
      master.connect(ctx.destination);

      musicFilter = ctx.createBiquadFilter();
      musicFilter.type = 'lowpass';
      const [mGain, mCutoff] = targetMoodGainAndCutoff(currentMood);
      musicFilter.frequency.value = mCutoff;
      musicFilter.Q.value = 0.55;
      musicFilter.connect(master);

      musicBus = ctx.createGain();
      musicBus.gain.value = mGain;
      musicBus.connect(musicFilter);

      ambGain = ctx.createGain();
      ambGain.gain.value = 0.48;
      ambGain.connect(master);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.85;
      sfxGain.connect(master);

      // Dedicated 1980s documentary broadcast bus (110Hz HPF -> 2.8kHz presence -> 7.2kHz silk LPF -> master)
      const vHpf = ctx.createBiquadFilter();
      vHpf.type = 'highpass';
      vHpf.frequency.value = 110;
      const vPres = ctx.createBiquadFilter();
      vPres.type = 'peaking';
      vPres.frequency.value = 2800;
      vPres.Q.value = 1.1;
      vPres.gain.value = 1.5;
      const vLpf = ctx.createBiquadFilter();
      vLpf.type = 'lowpass';
      vLpf.frequency.value = 7200;
      voiceBus = ctx.createGain();
      voiceBus.gain.value = 1.05;
      voiceBus.connect(vHpf);
      vHpf.connect(vPres);
      vPres.connect(vLpf);
      vLpf.connect(master);
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  } catch {
    return null;
  }
}

function getNoiseBuffer(c: AudioContext): AudioBuffer | null {
  try {
    if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
    const len = Math.floor(c.sampleRate * 2);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    // Soft pink-weighted noise for warm wind/crowd/paper textures
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.18) * 0.8));
    }
    noiseBuf = buf;
    return buf;
  } catch {
    return null;
  }
}

function loadAudioBuffer(c: AudioContext, id: AnyAudioId): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(id);
  if (cached) {
    touchBufferCache(id, cached);
    return Promise.resolve(cached);
  }
  if (missingAudioIds.has(id)) return Promise.resolve(null);
  const inflight = pendingLoads.get(id);
  if (inflight) return inflight;

  const p = (async (): Promise<AudioBuffer | null> => {
    try {
      const resp = await fetch(`./audio/${id}.mp3`, { cache: 'force-cache' });
      if (!resp.ok) {
        missingAudioIds.add(id);
        return null;
      }
      const arr = await resp.arrayBuffer();
      const decoded = await c.decodeAudioData(arr);
      touchBufferCache(id, decoded);
      return decoded;
    } catch {
      return null;
    } finally {
      pendingLoads.delete(id);
    }
  })();
  pendingLoads.set(id, p);
  return p;
}

async function loadScoreCueWithFallback(
  c: AudioContext,
  wanted: ScoreCueId,
): Promise<{ cue: ScoreCueId; buf: AudioBuffer } | null> {
  const primary = await loadAudioBuffer(c, wanted);
  if (primary) return { cue: wanted, buf: primary };

  const fallback = CUE_FALLBACKS[wanted];
  if (fallback) {
    const fbBuf = await loadAudioBuffer(c, fallback);
    if (fbBuf) return { cue: fallback, buf: fbBuf };
  }
  return null;
}

function primeStingers(c: AudioContext): void {
  if (stingersPrimed) return;
  stingersPrimed = true;
  void loadAudioBuffer(c, 'stinger_chapter');
  void loadAudioBuffer(c, 'stinger_ending');
}

function scheduleAdjacentPreload(c: AudioContext, cue: ScoreCueId): void {
  if (preloadTimer !== null) {
    clearTimeout(preloadTimer);
    preloadTimer = null;
  }
  const nextList = NEXT_CUES[cue];
  if (!nextList.length) return;
  const maxPreloads = Math.max(0, MAX_SCORE_BUFFERS - 1);
  preloadTimer = window.setTimeout(() => {
    preloadTimer = null;
    if (!enabled || ctx !== c || c.state !== 'running') return;
    void (async () => {
      let loaded = 0;
      for (const nextCue of nextList) {
        if (loaded >= maxPreloads) break;
        if (!enabled || ctx !== c || c.state !== 'running') break;
        if (!bufferCache.has(nextCue) && !missingAudioIds.has(nextCue)) {
          await loadAudioBuffer(c, nextCue);
        }
        loaded++;
      }
      // Keep the active deck marked most-recently-used after background preloads
      if (activeDeck) {
        const activeBuf = bufferCache.get(activeDeck.cue);
        if (activeBuf) touchBufferCache(activeDeck.cue, activeBuf);
      }
    })();
  }, 450);
}

function applyMoodParams(c: AudioContext): void {
  if (!musicBus || !musicFilter) return;
  const now = c.currentTime;
  const [mGain, mCutoff] = targetMoodGainAndCutoff(currentMood);
  try {
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setTargetAtTime(mGain * narratorDuckFactor, now, 0.24);
    musicFilter.frequency.cancelScheduledValues(now);
    musicFilter.frequency.setTargetAtTime(mCutoff, now, 0.24);
    if (ambGain) {
      ambGain.gain.cancelScheduledValues(now);
      ambGain.gain.setTargetAtTime(0.48 * (narratorDuckFactor < 1 ? 0.65 : 1), now, 0.24);
    }
  } catch {}
}

/** Smoothly duck score and ambient buses while documentary/dialogue voiceover speaks. */
export function setNarratorDucking(active: boolean): void {
  narratorDuckFactor = active ? 0.5 : 1.0;
  if (ctx && ctx.state === 'running') {
    applyMoodParams(ctx);
  }
}

function retireDeck(deck: ActiveDeck, c: AudioContext, fadeSec: number): void {
  const now = c.currentTime;
  try {
    const cur = deck.gain.gain.value;
    deck.gain.gain.cancelScheduledValues(now);
    deck.gain.gain.setValueAtTime(cur, now);
    if (fadeSec > 0.08 && cur > 0.001) {
      const scaledOut = new Float32Array(FADE_OUT_CURVE.length);
      for (let i = 0; i < FADE_OUT_CURVE.length; i++) scaledOut[i] = cur * FADE_OUT_CURVE[i];
      deck.gain.gain.setValueCurveAtTime(scaledOut, now, fadeSec);
    } else {
      deck.gain.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.04, fadeSec));
    }
    retiringDecks.push(deck);
    deck.src.onended = () => {
      try { deck.src.disconnect(); deck.gain.disconnect(); } catch {}
      retiringDecks = retiringDecks.filter(d => d !== deck);
    };
    deck.src.stop(now + fadeSec + 0.08);
  } catch {
    try { deck.src.stop(); deck.src.disconnect(); deck.gain.disconnect(); } catch {}
  }
}

function stopScore(fadeSec = 0.35): void {
  scoreReqToken++;
  if (preloadTimer !== null) {
    clearTimeout(preloadTimer);
    preloadTimer = null;
  }
  if (!ctx) return;
  if (activeDeck) {
    retireDeck(activeDeck, ctx, fadeSec);
    activeDeck = null;
  }
}

async function syncScoreDeck(): Promise<void> {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c || !musicBus || c.state !== 'running') return;
  primeStingers(c);

  const wanted = targetCueForState();
  applyMoodParams(c);
  if (activeDeck && activeDeck.cue === wanted) {
    const existingBuf = bufferCache.get(wanted);
    if (existingBuf) touchBufferCache(wanted, existingBuf);
    scheduleAdjacentPreload(c, wanted);
    return;
  }

  const myToken = ++scoreReqToken;
  const loaded = await loadScoreCueWithFallback(c, wanted);
  if (!loaded || !enabled || myToken !== scoreReqToken || !ctx || !musicBus || ctx.state !== 'running') {
    return;
  }
  const { cue: resolvedCue, buf } = loaded;
  if (activeDeck && activeDeck.cue === resolvedCue) return;

  try {
    const now = ctx.currentTime;
    const prev = activeDeck;
    const fadeSec = prev ? CROSSFADE_SEC : 1.1;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = buf.duration;
    src.playbackRate.value = 1.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.setValueCurveAtTime(FADE_IN_CURVE, now, fadeSec);

    src.connect(gain);
    gain.connect(musicBus);
    src.start(now);

    activeDeck = { cue: resolvedCue, src, gain };
    touchBufferCache(resolvedCue, buf);
    if (prev) retireDeck(prev, ctx, fadeSec);
    scheduleAdjacentPreload(ctx, resolvedCue);
  } catch {}
}

function stopAmbient() {
  try {
    if (tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    for (const stop of activeStops) {
      try { stop(); } catch {}
    }
    activeStops = [];
  } catch {}
}

function spawnNoiseLayer(
  c: AudioContext,
  type: BiquadFilterType,
  freq: number,
  q: number,
  gainVal: number,
  lfoRate = 0,
  lfoDepth = 0,
) {
  try {
    if (!ambGain) return;
    const buf = getNoiseBuffer(c);
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const flt = c.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = freq;
    flt.Q.value = q;

    const g = c.createGain();
    g.gain.value = gainVal;

    let lfo: OscillatorNode | null = null;
    if (lfoRate > 0 && lfoDepth > 0) {
      lfo = c.createOscillator();
      lfo.frequency.value = lfoRate;
      const lg = c.createGain();
      lg.gain.value = lfoDepth;
      lfo.connect(lg);
      lg.connect(g.gain);
      lfo.start();
    }

    src.connect(flt);
    flt.connect(g);
    g.connect(ambGain);
    src.start();

    activeStops.push(() => {
      try { src.stop(); src.disconnect(); } catch {}
      try { lfo?.stop(); lfo?.disconnect(); } catch {}
      try { flt.disconnect(); g.disconnect(); } catch {}
    });
  } catch {}
}

function spawnDroneLayer(c: AudioContext, freq: number, type: OscillatorType, gainVal: number, cutoff = 180) {
  try {
    if (!ambGain) return;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const flt = c.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.value = gainVal;
    osc.connect(flt);
    flt.connect(g);
    g.connect(ambGain);
    osc.start();
    activeStops.push(() => {
      try { osc.stop(); osc.disconnect(); flt.disconnect(); g.disconnect(); } catch {}
    });
  } catch {}
}

function playCricket(c: AudioContext) {
  try {
    if (!ambGain || !enabled) return;
    const now = c.currentTime;
    const base = 3850 + Math.random() * 480;
    const pulses = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < pulses; i++) {
      const t0 = now + i * 0.055;
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base, t0);
      osc.frequency.exponentialRampToValueAtTime(base * 0.94, t0 + 0.032);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.015, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.036);
      osc.connect(g);
      g.connect(ambGain);
      osc.start(t0);
      osc.stop(t0 + 0.04);
    }
  } catch {}
}

function playBird(c: AudioContext) {
  try {
    if (!ambGain || !enabled) return;
    const now = c.currentTime;
    const notes = 2 + Math.floor(Math.random() * 2);
    const f0 = 2100 + Math.random() * 900;
    for (let i = 0; i < notes; i++) {
      const t0 = now + i * 0.13;
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0 * (0.9 + Math.random() * 0.2), t0);
      osc.frequency.exponentialRampToValueAtTime(f0 * (1.25 + Math.random() * 0.25), t0 + 0.05);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.95, t0 + 0.10);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.024, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
      osc.connect(g);
      g.connect(ambGain);
      osc.start(t0);
      osc.stop(t0 + 0.12);
    }
  } catch {}
}

function playDistantBell(c: AudioContext) {
  try {
    if (!ambGain || !enabled) return;
    const now = c.currentTime;
    for (let i = 0; i < 2; i++) {
      const t0 = now + i * 0.11;
      for (const [freq, amp] of [[2240, 0.012], [4490, 0.005]] as const) {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq + (Math.random() - 0.5) * 35;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(amp, t0 + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
        osc.connect(g);
        g.connect(ambGain);
        osc.start(t0);
        osc.stop(t0 + 0.34);
      }
    }
  } catch {}
}

function playRadioBurst(c: AudioContext) {
  try {
    if (!ambGain || !enabled) return;
    const buf = getNoiseBuffer(c);
    if (!buf) return;
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = buf;
    const flt = c.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(950 + Math.random() * 900, now);
    flt.frequency.exponentialRampToValueAtTime(1600 + Math.random() * 600, now + 0.25);
    flt.Q.value = 5.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.02, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    src.connect(flt);
    flt.connect(g);
    g.connect(ambGain);
    src.start(now);
    src.stop(now + 0.3);
  } catch {}
}

function playAmbientTelexBurst(c: AudioContext) {
  try {
    if (!ambGain || !enabled) return;
    const buf = getNoiseBuffer(c);
    if (!buf) return;
    const now = c.currentTime;
    const hits = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < hits; i++) {
      const t0 = now + i * (0.065 + Math.random() * 0.04);
      const src = c.createBufferSource();
      src.buffer = buf;
      const flt = c.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = 2600 + Math.random() * 500;
      flt.Q.value = 3.2;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.016, t0 + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.022);
      src.connect(flt);
      flt.connect(g);
      g.connect(ambGain);
      src.start(t0);
      src.stop(t0 + 0.03);
    }
  } catch {}
}

function triggerPeriodicAmbient(c: AudioContext, kind: PeriodicKind) {
  switch (kind) {
    case 'cricket':
      playCricket(c);
      break;
    case 'bird':
      playBird(c);
      break;
    case 'bell':
      playDistantBell(c);
      break;
    case 'radio':
      playRadioBurst(c);
      break;
    case 'telex':
      playAmbientTelexBurst(c);
      break;
    case 'courtyardMix':
      if (Math.random() < 0.72) playCricket(c);
      else playDistantBell(c);
      break;
  }
}

function rebuildAmbient() {
  stopAmbient();
  if (!enabled || !ctx || ctx.state !== 'running') return;
  if (currentMood === 'title' || currentMood === 'reel') return;
  const c = ctx;
  try {
    const profileKey = SCENE_META[currentScene]?.ambientProfile ?? 'campus_night';
    const profile = AMBIENT_PROFILES[profileKey] ?? AMBIENT_PROFILES.campus_night;

    if (profile.drones) {
      for (const d of profile.drones) {
        spawnDroneLayer(c, d.freq, d.wave, d.gain, d.cutoff);
      }
    }
    for (const n of profile.noise) {
      spawnNoiseLayer(c, n.filter, n.freq, n.q, n.gain, n.lfoRate ?? 0, n.lfoDepth ?? 0);
    }
    if (profile.periodic) {
      const { intervalMs, chance, kind } = profile.periodic;
      tickTimer = window.setInterval(() => {
        if (enabled && ctx?.state === 'running' && Math.random() < chance) {
          triggerPeriodicAmbient(ctx, kind);
        }
      }, intervalMs);
    }
  } catch {}
}

export function isAudioOn(): boolean {
  return enabled;
}

export function getActiveScoreTrack(): string | null {
  return enabled ? (activeDeck?.cue ?? targetCueForState()) : null;
}

export function getCachedScoreBufferKeys(): string[] {
  return [...bufferCache.keys()].filter(k => isScoreCue(k));
}

export function unlockAudio(): void {
  try {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    if (c.state === 'running') {
      if (activeStops.length === 0) rebuildAmbient();
      void syncScoreDeck();
    } else {
      c.resume()
        .then(() => {
          if (!enabled) return;
          if (activeStops.length === 0) rebuildAmbient();
          void syncScoreDeck();
        })
        .catch(() => {});
    }
  } catch {}
}

export function toggleAudio(): boolean {
  try {
    enabled = !enabled;
    const c = ensureCtx();
    if (c && master) {
      master.gain.setTargetAtTime(enabled ? 0.68 : 0, c.currentTime, 0.08);
    }
    if (enabled) {
      if (c?.state === 'suspended') {
        c.resume()
          .then(() => {
            rebuildAmbient();
            void syncScoreDeck();
          })
          .catch(() => {});
      } else {
        rebuildAmbient();
        void syncScoreDeck();
      }
    } else {
      stopAmbient();
      stopShortwaveAudio();
      stopScore(0.25);
    }
  } catch {}
  return enabled;
}

export function setAudioScene(scene: SceneId, chapterId?: string, weather?: string): void {
  try {
    currentScene = scene;
    currentChapterId = chapterId;
    currentWeather = weather;
    if (enabled && ctx?.state === 'running') {
      rebuildAmbient();
      void syncScoreDeck();
    }
  } catch {}
}

export function setAudioMood(mood: AudioMood): void {
  try {
    const prev = currentMood;
    currentMood = mood;
    if (enabled && ctx?.state === 'running') {
      applyMoodParams(ctx);
      if (prev !== mood && (prev === 'title' || prev === 'reel' || mood === 'title' || mood === 'reel')) {
        rebuildAmbient();
        void syncScoreDeck();
      }
    }
  } catch {}
}

/** Authentic 28-inch bicycle bell dual-ring. */
export function playBell(): void {
  try {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c || !sfxGain || c.state !== 'running') return;
    const now = c.currentTime;
    for (let ring = 0; ring < 2; ring++) {
      const t0 = now + ring * 0.115;
      for (const [freq, amp, dur] of [[2140, 0.11, 0.42], [4310, 0.055, 0.28], [5680, 0.028, 0.18]] as const) {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(amp, t0 + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g);
        g.connect(sfxGain);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      }
    }
  } catch {}
}

/** Soft footstep or bike freewheel click, rate-limited. */
export function playStep(riding = false): void {
  try {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c || !sfxGain || c.state !== 'running') return;
    const now = c.currentTime;
    if (now - lastStepAt < (riding ? 0.48 : 0.38)) return;
    lastStepAt = now;
    const buf = getNoiseBuffer(c);
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    const flt = c.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = riding ? 1850 : 320 + Math.random() * 90;
    flt.Q.value = riding ? 3.5 : 1.4;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(riding ? 0.018 : 0.032, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (riding ? 0.022 : 0.055));
    src.connect(flt);
    flt.connect(g);
    g.connect(sfxGain);
    src.start(now);
    src.stop(now + 0.07);
  } catch {}
}

/** Soft paper/diary turn sound for dialogue and notes. */
export function playPaper(): void {
  try {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c || !sfxGain || c.state !== 'running') return;
    const buf = getNoiseBuffer(c);
    if (!buf) return;
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = buf;
    const flt = c.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(1250, now);
    flt.frequency.exponentialRampToValueAtTime(2400, now + 0.085);
    flt.Q.value = 1.6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
    src.connect(flt);
    flt.connect(g);
    g.connect(sfxGain);
    src.start(now);
    src.stop(now + 0.11);
  } catch {}
}

/** Crisp 1989 mechanical 35mm SLR mirror slap + focal-plane shutter curtain release. */
export function playShutter(): void {
  try {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c || !sfxGain || c.state !== 'running') return;
    const buf = getNoiseBuffer(c);
    const now = c.currentTime;

    // 1. Mirror box thump
    const mirrorOsc = c.createOscillator();
    mirrorOsc.type = 'triangle';
    mirrorOsc.frequency.setValueAtTime(195, now);
    mirrorOsc.frequency.exponentialRampToValueAtTime(72, now + 0.028);
    const mirrorGain = c.createGain();
    mirrorGain.gain.setValueAtTime(0.0001, now);
    mirrorGain.gain.linearRampToValueAtTime(0.11, now + 0.002);
    mirrorGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
    mirrorOsc.connect(mirrorGain);
    mirrorGain.connect(sfxGain);
    mirrorOsc.start(now);
    mirrorOsc.stop(now + 0.036);

    if (!buf) return;

    // 2. First curtain metallic snap + second curtain release + mirror return tick
    const bursts: [number, BiquadFilterType, number, number, number, number][] = [
      [0.0, 'bandpass', 3400, 2.8, 0.14, 0.016],
      [0.022, 'highpass', 2500, 1.2, 0.12, 0.018],
      [0.064, 'bandpass', 1950, 2.4, 0.055, 0.015],
    ];
    for (const [offset, type, freq, q, amp, dur] of bursts) {
      const t0 = now + offset;
      const src = c.createBufferSource();
      src.buffer = buf;
      const flt = c.createBiquadFilter();
      flt.type = type;
      flt.frequency.value = freq;
      flt.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(amp, t0 + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(flt);
      flt.connect(g);
      g.connect(sfxGain);
      src.start(t0);
      src.stop(t0 + dur + 0.01);
    }
  } catch {}
}

/** Crisp 1980s teleprinter / mechanical typewriter hammer strike. */
export function playTelexClick(): void {
  try {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c || !sfxGain || c.state !== 'running') return;
    const now = c.currentTime;

    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(840 + Math.random() * 140, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.016);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, now);
    og.gain.linearRampToValueAtTime(0.05, now + 0.002);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);
    osc.connect(og);
    og.connect(sfxGain);
    osc.start(now);
    osc.stop(now + 0.026);

    const buf = getNoiseBuffer(c);
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    const flt = c.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = 2850 + Math.random() * 450;
    flt.Q.value = 3.4;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.075, now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
    src.connect(flt);
    flt.connect(g);
    g.connect(sfxGain);
    src.start(now);
    src.stop(now + 0.024);
  } catch {}
}

/** Shortwave radio dial static burst + faint tuning heterodyne sweep. */
export function playRadioStatic(durationSec = 0.22): void {
  try {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c || !sfxGain || c.state !== 'running') return;
    const buf = getNoiseBuffer(c);
    if (!buf) return;
    const dur = Math.max(0.08, Math.min(1.2, durationSec));
    const now = c.currentTime;

    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const flt = c.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(880 + Math.random() * 400, now);
    flt.frequency.exponentialRampToValueAtTime(1950 + Math.random() * 500, now + dur * 0.85);
    flt.Q.value = 4.2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(sfxGain);
    src.start(now);
    src.stop(now + dur + 0.02);

    // Subtle shortwave carrier heterodyne whistle
    const het = c.createOscillator();
    het.type = 'sine';
    het.frequency.setValueAtTime(1320 + Math.random() * 260, now);
    het.frequency.exponentialRampToValueAtTime(1680, now + dur);
    const hg = c.createGain();
    hg.gain.setValueAtTime(0.0001, now);
    hg.gain.linearRampToValueAtTime(0.012, now + 0.025);
    hg.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    het.connect(hg);
    hg.connect(sfxGain);
    het.start(now);
    het.stop(now + dur + 0.02);
  } catch {}
}

function playProceduralChord(c: AudioContext, notes: readonly number[], gainScale = 0.045): void {
  if (!sfxGain) return;
  const now = c.currentTime;
  const flt = c.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.setValueAtTime(1450, now);
  flt.frequency.exponentialRampToValueAtTime(520, now + 2.4);
  flt.connect(sfxGain);

  notes.forEach((freq, idx) => {
    const t0 = now + idx * 0.065;
    const osc = c.createOscillator();
    osc.type = idx < 2 ? 'triangle' : 'sine';
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gainScale / (1 + idx * 0.18), t0 + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.3);
    osc.connect(g);
    g.connect(flt);
    osc.start(t0);
    osc.stop(t0 + 2.45);
  });
}

function playCachedStinger(id: StingerId, fallbackNotes: readonly number[], gainVal: number): void {
  try {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c || !sfxGain || c.state !== 'running') return;
    const cached = bufferCache.get(id);
    if (cached) {
      const src = c.createBufferSource();
      src.buffer = cached;
      const g = c.createGain();
      g.gain.value = gainVal;
      src.connect(g);
      g.connect(sfxGain);
      src.start();
      return;
    }
    void loadAudioBuffer(c, id);
    playProceduralChord(c, fallbackNotes);
  } catch {}
}

/** Orchestral harp + horn chapter transition stinger (real mastered cue with instant fallback). */
export function playTransitionChord(): void {
  playCachedStinger('stinger_chapter', [146.83, 220.0, 261.63, 349.23, 523.25], 0.56);
}

/** Solemn monument bell + erhu resolve stinger for chapter endings. */
export function playEndingStinger(): void {
  playCachedStinger('stinger_ending', [146.83, 220.0, 293.66, 369.99, 587.33], 0.62);
}

/** Press darkroom / viewfinder photo capture stinger (mastered cue if present, procedural fallback). */
export function playShutterStinger(): void {
  playCachedStinger('stinger_shutter', [196.0, 293.66, 349.23, 440.0], 0.54);
}

/** Newsroom telex / dispatch transition stinger (mastered cue if present, procedural fallback). */
export function playDispatchStinger(): void {
  playCachedStinger('stinger_dispatch', [164.81, 246.94, 293.66, 392.0], 0.56);
}

/** Mechanical 1980s cassette / reel-to-reel switch click & brief magnetic tape transient. */
export function playTapeClick(): void {
  try {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c || !sfxGain || c.state !== 'running') return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.032);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, now);
    og.gain.linearRampToValueAtTime(0.055, now + 0.003);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);
    osc.connect(og);
    og.connect(sfxGain);
    osc.start(now);
    osc.stop(now + 0.045);

    const buf = getNoiseBuffer(c);
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    const flt = c.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = 3200;
    flt.Q.value = 2.6;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.linearRampToValueAtTime(0.025, now + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
    src.connect(flt);
    flt.connect(ng);
    ng.connect(sfxGain);
    src.start(now);
    src.stop(now + 0.035);
  } catch {}
}

interface ShortwaveNodes {
  noiseSrc: AudioBufferSourceNode;
  noiseFlt: BiquadFilterNode;
  noiseGain: GainNode;
  qsbLfo: OscillatorNode;
  qsbGain: GainNode;
  hetOsc: OscillatorNode;
  hetGain: GainNode;
  pipTimer: number | null;
  curFreqMhz: number;
  curStrength: number;
}

let swNodes: ShortwaveNodes | null = null;

/** Start continuous WebAudio 1989 shortwave receiver noise, QSB ionosphere fading & carrier whistle. */
export function startShortwaveAudio(): void {
  try {
    stopShortwaveAudio();
    if (!enabled) return;
    const c = ensureCtx();
    if (!c || !sfxGain || c.state !== 'running') return;
    const buf = getNoiseBuffer(c);
    if (!buf) return;

    const noiseSrc = c.createBufferSource();
    noiseSrc.buffer = buf;
    noiseSrc.loop = true;

    const noiseFlt = c.createBiquadFilter();
    noiseFlt.type = 'bandpass';
    noiseFlt.frequency.value = 1350;
    noiseFlt.Q.value = 2.8;

    const noiseGain = c.createGain();
    noiseGain.gain.value = 0.045;

    const qsbLfo = c.createOscillator();
    qsbLfo.frequency.value = 0.24;
    const qsbGain = c.createGain();
    qsbGain.gain.value = 0.014;
    qsbLfo.connect(qsbGain);
    qsbGain.connect(noiseGain.gain);

    noiseSrc.connect(noiseFlt);
    noiseFlt.connect(noiseGain);
    noiseGain.connect(sfxGain);
    noiseSrc.start();
    qsbLfo.start();

    const hetOsc = c.createOscillator();
    hetOsc.type = 'sine';
    hetOsc.frequency.value = 880;
    const hetGain = c.createGain();
    hetGain.gain.value = 0.0001;
    hetOsc.connect(hetGain);
    hetGain.connect(sfxGain);
    hetOsc.start();

    const nodes: ShortwaveNodes = {
      noiseSrc,
      noiseFlt,
      noiseGain,
      qsbLfo,
      qsbGain,
      hetOsc,
      hetGain,
      pipTimer: null,
      curFreqMhz: 7.35,
      curStrength: 0.2,
    };

    nodes.pipTimer = window.setInterval(() => {
      try {
        if (!enabled || !ctx || !sfxGain || ctx.state !== 'running' || !swNodes) return;
        const f = swNodes.curFreqMhz;
        // Faint shortwave standard time-signal pip near 7.35 / 9.65 MHz or clear carrier lock
        if (Math.abs(f - 7.35) < 0.85 || Math.abs(f - 9.65) < 0.85) {
          const t0 = ctx.currentTime;
          const pip = ctx.createOscillator();
          pip.type = 'sine';
          pip.frequency.value = 1000;
          const pg = ctx.createGain();
          pg.gain.setValueAtTime(0.0001, t0);
          pg.gain.linearRampToValueAtTime(0.006 + swNodes.curStrength * 0.008, t0 + 0.005);
          pg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);
          pip.connect(pg);
          pg.connect(sfxGain);
          pip.start(t0);
          pip.stop(t0 + 0.07);
        }
      } catch {}
    }, 1000);

    swNodes = nodes;
  } catch {}
}

/** Dynamically sweep shortwave static, selectivity bandpass, and carrier heterodyne whistle. */
export function updateShortwaveAudio(freqMhz: number, nearestDiffMhz: number, signalStrength: number): void {
  try {
    if (!swNodes || !ctx || ctx.state !== 'running' || !enabled) return;
    swNodes.curFreqMhz = freqMhz;
    swNodes.curStrength = signalStrength;
    const now = ctx.currentTime;

    const locked = nearestDiffMhz < 0.06;
    const nGain = locked ? 0.015 : Math.max(0.022, 0.072 * (1 - signalStrength * 0.6));
    const fltFreq = 900 + ((freqMhz - 4.8) / 10.7) * 1450;
    swNodes.noiseGain.gain.setTargetAtTime(nGain, now, 0.05);
    swNodes.noiseFlt.frequency.setTargetAtTime(fltFreq, now, 0.05);
    swNodes.qsbGain.gain.setTargetAtTime(locked ? 0.004 : 0.015, now, 0.08);

    // Classic superheterodyne beat whistle rises with frequency offset from carrier, drops cleanly at zero-beat lock
    const inCaptureZone = nearestDiffMhz >= 0.045 && nearestDiffMhz <= 0.65;
    const hetPitch = Math.max(220, Math.min(2600, 240 + nearestDiffMhz * 2100));
    const hetAmp = inCaptureZone ? Math.max(0.002, (0.65 - nearestDiffMhz) * 0.024) : 0.0001;
    swNodes.hetOsc.frequency.setTargetAtTime(hetPitch, now, 0.03);
    swNodes.hetGain.gain.setTargetAtTime(hetAmp, now, 0.04);
  } catch {}
}

/** Tear down shortwave receiver audio cleanly when tuner modal closes or sound mutes. */
export function stopShortwaveAudio(): void {
  try {
    if (!swNodes) return;
    if (swNodes.pipTimer !== null) {
      clearInterval(swNodes.pipTimer);
    }
    try { swNodes.noiseSrc.stop(); swNodes.noiseSrc.disconnect(); } catch {}
    try { swNodes.qsbLfo.stop(); swNodes.qsbLfo.disconnect(); } catch {}
    try { swNodes.hetOsc.stop(); swNodes.hetOsc.disconnect(); } catch {}
    try {
      swNodes.noiseFlt.disconnect();
      swNodes.noiseGain.disconnect();
      swNodes.qsbGain.disconnect();
      swNodes.hetGain.disconnect();
    } catch {}
    swNodes = null;
  } catch {}
}

/** Expose the WebAudio context & warm broadcast voice bus for studio documentary narration. */
export function getAudioContextForVoice(): { ctx: AudioContext; out: GainNode } | null {
  try {
    if (!enabled) return null;
    const c = ensureCtx();
    if (!c || !voiceBus || c.state !== 'running') return null;
    return { ctx: c, out: voiceBus };
  } catch {
    return null;
  }
}
