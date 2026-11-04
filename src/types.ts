export type Confidence = 'documented' | 'testimony' | 'uncertain';
export type EventKind = 'historical' | 'testimony' | 'fiction';
export interface Source { title: string; publisher: string; url: string; note?: string }
export interface HistEvent {
  id: string; date: string; place: string; kind: EventKind; confidence: Confidence;
  title: { zh: string; en: string }; summary: { zh: string; en: string }; sources: Source[];
}
export interface Choice {
  text: string; next?: string; set?: string; item?: string; diary?: string;
  rel?: Record<string, number>; requires?: string; end?: string; goto?: SceneId;
}
export interface DNode { speaker: string; text: string; event?: string; choices: Choice[] }
export interface Hotspot { id: string; scene: SceneId; pos: [number, number]; label: string; start: string }
export interface Chapter {
  chapter: string; note: string; start: string;
  characters: Record<string, { name: string; role: string; fictional: boolean }>;
  hotspots: Hotspot[]; nodes: Record<string, DNode>;
  endings: Record<string, { title: string; text: string }>; epilogue: string;
}
export type SceneId = 'campus' | 'street' | 'changan';
