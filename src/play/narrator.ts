import { getAudioContextForVoice, isAudioOn, playTapeClick, setNarratorDucking } from './audio';
import type { ViewpointId } from '../types';

export type NarratorVoiceMode = 'studio' | 'tts';

const MAX_VOICE_BUFFERS = 4;

let narratorEnabled = false;
let voiceMode: NarratorVoiceMode = 'studio';
let cachedZhVoice: SpeechSynthesisVoice | null = null;
let voiceHooked = false;
let safetyTimer: number | null = null;

let activeVoiceSource: AudioBufferSourceNode | null = null;
let activeVoiceReqToken = 0;
const voiceBufferCache = new Map<string, AudioBuffer>();
const pendingVoiceLoads = new Map<string, Promise<AudioBuffer | null>>();

function touchVoiceCache(chapterId: string, buf: AudioBuffer): void {
  voiceBufferCache.delete(chapterId);
  voiceBufferCache.set(chapterId, buf);
  while (voiceBufferCache.size > MAX_VOICE_BUFFERS) {
    const oldest = voiceBufferCache.keys().next().value;
    if (oldest === undefined) break;
    voiceBufferCache.delete(oldest);
  }
}

async function loadVoiceBuffer(chapterId: string, ctx: AudioContext): Promise<AudioBuffer | null> {
  const cached = voiceBufferCache.get(chapterId);
  if (cached) {
    touchVoiceCache(chapterId, cached);
    return cached;
  }
  const existing = pendingVoiceLoads.get(chapterId);
  if (existing) return existing;

  const p = (async () => {
    try {
      const resp = await fetch(`./audio/voice/${encodeURIComponent(chapterId)}.mp3`);
      if (!resp.ok) return null;
      const ab = await resp.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      touchVoiceCache(chapterId, buf);
      return buf;
    } catch {
      return null;
    } finally {
      pendingVoiceLoads.delete(chapterId);
    }
  })();
  pendingVoiceLoads.set(chapterId, p);
  return p;
}

function pickBestZhVoice(): SpeechSynthesisVoice | null {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const score = (v: SpeechSynthesisVoice): number => {
      const lang = (v.lang || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      if (!lang.startsWith('zh')) return 0;
      let s = 10;
      if (lang.includes('tw') || lang.includes('hant')) s += 8;
      else if (lang.includes('cn') || lang.includes('hans')) s += 6;
      else if (lang.includes('hk')) s += 4;
      if (name.includes('natural') || name.includes('online') || name.includes('neural')) s += 6;
      return s;
    };
    let best: SpeechSynthesisVoice | null = null;
    let bestScore = 0;
    for (const v of voices) {
      const s = score(v);
      if (s > bestScore) {
        bestScore = s;
        best = v;
      }
    }
    return best;
  } catch {
    return null;
  }
}

function ensureVoiceHooks(): void {
  if (voiceHooked) return;
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    voiceHooked = true;
    cachedZhVoice = pickBestZhVoice();
    window.speechSynthesis.addEventListener?.('voiceschanged', () => {
      cachedZhVoice = pickBestZhVoice();
    });
  } catch { /* ignore */ }
}

export function isNarratorSupported(): boolean {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  } catch {
    return false;
  }
}

export function isNarratorEnabled(): boolean {
  return narratorEnabled;
}

export function setNarratorEnabled(on: boolean): boolean {
  narratorEnabled = Boolean(on);
  if (!narratorEnabled) stopNarrator();
  return narratorEnabled;
}

export function toggleNarrator(): boolean {
  return setNarratorEnabled(!narratorEnabled);
}

export function getNarratorVoiceMode(): NarratorVoiceMode {
  return voiceMode;
}

export function setNarratorVoiceMode(mode: NarratorVoiceMode): NarratorVoiceMode {
  voiceMode = mode === 'tts' ? 'tts' : 'studio';
  return voiceMode;
}

export function stopNarrator(): void {
  activeVoiceReqToken++;
  if (safetyTimer !== null) {
    clearTimeout(safetyTimer);
    safetyTimer = null;
  }
  if (activeVoiceSource) {
    try {
      activeVoiceSource.onended = null;
      activeVoiceSource.stop();
      activeVoiceSource.disconnect();
    } catch { /* ignore */ }
    activeVoiceSource = null;
  }
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch { /* ignore */ }
  setNarratorDucking(false);
}

export function speakLine(
  text: string,
  opts?: { viewpoint?: ViewpointId; speaker?: string; rate?: number; onEnd?: () => void }
): void {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return;
  stopNarrator();
  if (!isNarratorSupported()) return;

  try {
    ensureVoiceHooks();
    if (!cachedZhVoice) cachedZhVoice = pickBestZhVoice();

    const u = new SpeechSynthesisUtterance(clean);
    u.lang = cachedZhVoice?.lang || 'zh-TW';
    if (cachedZhVoice) u.voice = cachedZhVoice;

    const vp = opts?.viewpoint;
    const isFemaleSpeaker = Boolean(opts?.speaker && /(淑芬|阿姨|女|大嫂|大媽|妹|同學)/.test(opts.speaker));
    const baseRate = opts?.rate ?? (vp === 'worker' ? 0.94 : vp === 'resident' ? 0.92 : vp === 'journalist' ? 0.98 : 0.97);
    const pitch = isFemaleSpeaker ? 1.06 : vp === 'worker' ? 0.90 : vp === 'resident' ? 1.02 : vp === 'journalist' ? 0.97 : 1.01;
    u.rate = Math.max(0.7, Math.min(1.5, baseRate));
    u.pitch = pitch;
    u.volume = 0.95;

    const finish = () => {
      if (safetyTimer !== null) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
      }
      setNarratorDucking(false);
      opts?.onEnd?.();
    };

    u.onstart = () => setNarratorDucking(true);
    u.onend = finish;
    u.onerror = finish;

    safetyTimer = window.setTimeout(finish, Math.max(4000, Math.min(25000, clean.length * 240)));
    setNarratorDucking(true);
    window.speechSynthesis.speak(u);
  } catch {
    setNarratorDucking(false);
  }
}

/**
 * Play mastered 1980s documentary chapter voiceover MP3 via WebAudio broadcast bus, falling back cleanly to TTS.
 */
export function playChapterVoiceover(
  chapterId: string,
  fallbackText: string,
  opts?: { viewpoint?: ViewpointId; speaker?: string; rate?: number; onEnd?: () => void },
): void {
  stopNarrator();
  const reqToken = activeVoiceReqToken;

  if (voiceMode !== 'studio' || !isAudioOn()) {
    if (isAudioOn()) speakLine(fallbackText, opts);
    return;
  }

  const bus = getAudioContextForVoice();
  if (!bus) {
    speakLine(fallbackText, opts);
    return;
  }

  playTapeClick();
  void loadVoiceBuffer(chapterId, bus.ctx).then(buf => {
    if (reqToken !== activeVoiceReqToken) return;
    if (!buf) {
      speakLine(fallbackText, opts);
      return;
    }
    const latestBus = getAudioContextForVoice();
    if (!latestBus) {
      speakLine(fallbackText, opts);
      return;
    }
    try {
      const src = latestBus.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = Math.max(0.8, Math.min(1.45, opts?.rate ?? 1));
      src.connect(latestBus.out);
      activeVoiceSource = src;
      setNarratorDucking(true);
      src.onended = () => {
        if (activeVoiceSource === src) activeVoiceSource = null;
        if (reqToken === activeVoiceReqToken) {
          setNarratorDucking(false);
          opts?.onEnd?.();
        }
      };
      src.start();
    } catch {
      setNarratorDucking(false);
      speakLine(fallbackText, opts);
    }
  });
}
