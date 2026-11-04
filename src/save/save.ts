// localStorage save: chapter, flags, items, relationships, diary, current scene, chapter history (for the flowchart).
import type { SceneId } from '../types';
export interface ChapterRecord { ending?: string; taken: string[] }
export interface SaveState {
  v: 1; chapter: string; scene: SceneId; flags: string[]; items: string[];
  rel: Record<string, number>; diary: string[]; ending?: string;
  taken?: string[];                       // "node#choiceIndex" taken in the current chapter
  history?: Record<string, ChapterRecord>; // finished chapters
}
const KEY = 'beijing1989.save.v1', STARTS = 'beijing1989.starts.v1';
export function fresh(): SaveState {
  return { v: 1, chapter: 'ch0-0417', scene: 'campus', flags: [], items: [], rel: {}, diary: [], taken: [], history: {} };
}
export function load(): SaveState | null {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.v === 1 ? s : null; } catch { return null; }
}
export function store(s: SaveState) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }
export function clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
/** Snapshot of the state at the start of each chapter (chapter select). */
export function starts(): Record<string, SaveState> { try { return JSON.parse(localStorage.getItem(STARTS) || '{}'); } catch { return {}; } }
export function storeStart(s: SaveState) { try { const a = starts(); a[s.chapter] = JSON.parse(JSON.stringify(s)); localStorage.setItem(STARTS, JSON.stringify(a)); } catch { /* ignore */ } }
