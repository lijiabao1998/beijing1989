export type Confidence = 'documented' | 'testimony' | 'uncertain';
export type EventKind = 'historical' | 'testimony' | 'fiction';
export interface Source { title: string; publisher: string; url: string; note?: string }
export interface HistEvent {
  id: string; date: string; place: string; kind: EventKind; confidence: Confidence;
  title: { zh: string; en: string }; summary: { zh: string; en: string }; sources: Source[];
}

export type ViewpointId = 'student' | 'worker' | 'journalist' | 'resident';

export type SceneId =
  | 'campus'
  | 'street'
  | 'changan'
  | 'march'
  | 'square'
  | 'camp'
  | 'blockade'
  | 'statue'
  | 'hutong'
  | 'aftermath'
  | 'factory'
  | 'factory_dawn'
  | 'courtyard'
  | 'beijing_hotel_balcony'
  | 'newsroom'
  | 'overpass'
  | 'hospital_gate'
  | 'siheyuan_room'
  | 'morning_market'
  | 'xinhua_gate'
  | 'march_day'
  | 'changan_rain'
  | 'courtyard_day'
  | 'street_aftermath';

export type PlayerMode = 'walk' | 'bike' | 'tricycle' | 'camera_walk';

export type AtmospherePreset =
  | 'night'
  | 'dawn'
  | 'day_spring'
  | 'dusk_warm'
  | 'rain_overcast'
  | 'curfew_amber'
  | 'aftermath';

export type StepSurface = 'stone' | 'asphalt' | 'interior';

export type EvidenceKind = 'official_print' | 'rumor' | 'witness' | 'photo' | 'audio_tape';

export type EvidenceVerdict = 'corroborated' | 'contradiction' | 'unverified';

export interface EvidenceCard {
  id: string;
  kind: EvidenceKind;
  title: string;
  summary: string;
  sourceLabel?: string;
  dayKey?: string;
  chapterId?: string;
  event?: string;
  route?: ViewpointId;
  confidence?: Confidence;
  tags?: string[];
}

export interface EvidencePair {
  id: string;
  cards: [string, string];
  verdict: EvidenceVerdict;
  verdictLabel: string;
  summary: string;
  diary?: string;
  set?: string;
}

export interface PhotoTarget {
  id: string;
  scene: SceneId;
  pos3: [number, number, number];
  radius: number;
  maxDist: number;
  minFov?: number;
  evidenceId: string;
  label: string;
  event?: string;
  requires?: string;
}

export interface Choice {
  text: string; next?: string; set?: string; item?: string; diary?: string;
  rel?: Record<string, number>; requires?: string; end?: string; goto?: SceneId;
  consumeItem?: string;
  keepsake?: string;
  evidence?: string;
  timeCost?: number;
  worldEmit?: string;
  modeOverride?: PlayerMode;
  mechanic?: string;
  autoHint?: boolean;
}

/** variants: first whose `requires` holds replaces `text` (carry-over from earlier chapters). */
export interface DNode { speaker: string; text: string; event?: string; choices: Choice[]; variants?: { requires: string; text: string }[] }

export interface Hotspot {
  id: string; scene: SceneId; pos: [number, number]; label: string; start: string; requires?: string; npc?: string;
  kind?: 'dialogue' | 'inspect' | 'photo_vantage' | 'dispatch' | 'checkpoint' | 'portal';
  timeWindow?: [number, number];
  deadlineMin?: number;
  isExit?: boolean;
  autoHint?: boolean;
  mechanic?: string;
}

export interface Chapter {
  chapter: string; title: string; note: string; start: string;
  startScene?: SceneId;
  spawn?: Partial<Record<SceneId, [number, number]>>;
  labels: Partial<Record<SceneId, string>>; transitions: Partial<Record<SceneId, string>>;
  characters: Record<string, { name: string; role: string; fictional: boolean }>;
  hotspots: Hotspot[]; nodes: Record<string, DNode>;
  endings: Record<string, { title: string; text: string }>; epilogue: string; epilogueEvent?: string;
  clockStart?: number;
  photoTargets?: PhotoTarget[];
  evidenceCatalog?: Record<string, EvidenceCard>;
  evidencePairs?: EvidencePair[];
}

export interface SceneManifestEntry {
  id: SceneId;
  base: string;
  atmosphere: AtmospherePreset;
  spawn: [number, number];
  bounds: [number, number, number, number];
  camFar: number;
  defaultYaw: number;
  reach: number;
  markerScale: number;
  stepSurface: StepSurface;
  introDuration: number;
  defaultCue: string;
  ambientProfile: string;
  cam?: { dist?: number; h?: number; ahead?: number; y?: number };
}

export interface RouteChapterMeta {
  id: string;
  date: string;
  dayKey: string;
  shortId: string;
  assetKey: string;
  orderIndex: number;
  title: { zh: string; en: string };
  playable: boolean;
  events: string[];
}

export interface ViewpointMeta {
  id: ViewpointId;
  zh: string;
  en: string;
  playable: boolean;
}

export interface WorldFlagDef {
  id: string;
  dayKey: string;
  sourceRoute: ViewpointId;
  defaultVal: boolean;
  kind?: 'physical_handoff' | 'witness_overlap' | 'rumor_spread' | 'artifact_left' | 'editorial_choice';
  description?: string;
}
