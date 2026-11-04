// localStorage save: chapter, flags, items, relationships, diary, current scene.
export interface SaveState {
  v: 1; chapter: string; scene: 'campus' | 'street' | 'changan'; flags: string[]; items: string[];
  rel: Record<string, number>; diary: string[]; ending?: string;
}
const KEY = 'beijing1989.save.v1';
export function fresh(): SaveState {
  return { v: 1, chapter: 'ch0-0417', scene: 'campus', flags: [], items: [], rel: {}, diary: [] };
}
export function load(): SaveState | null {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.v === 1 ? s : null; } catch { return null; }
}
export function store(s: SaveState) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }
export function clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
