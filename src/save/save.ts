// localStorage save: per-route v2 state (with v1 auto-migration) + cross-route WorldTimelineLedger.
import type { RouteChapterMeta, SceneId, ViewpointId, WorldFlagDef } from '../types';
import chaptersJson from '../../data/events/chapters.json';
import worldFlagsJson from '../../data/worldFlags.json';

export interface ChapterRecord { ending?: string; taken: string[] }

export interface PhotoCaptureRecord {
  id: string;
  frameNo: number;
  chapterId: string;
  sceneId: SceneId;
  dateLabel: string;
  lensMm: 35 | 50 | 85;
  caption: string;
  dataUrl: string;
  selectedForPrint?: boolean;
  takenAt: number;
}

export interface SaveState {
  v: 2;
  viewpoint: ViewpointId;
  chapter: string;
  scene: SceneId;
  flags: string[];
  items: string[];
  keepsakes: string[];
  evidence: string[];
  dossiers: string[];
  photos: string[];
  capturedPhotos?: PhotoCaptureRecord[];
  clockMin: number;
  rel: Record<string, number>;
  diary: string[];
  ending?: string;
  taken?: string[];                       // "node#choiceIndex" taken in the current chapter
  history?: Record<string, ChapterRecord>; // finished chapters
}

export interface WorldCommit {
  id: string;
  val: boolean;
  dayKey: string;
  sourceRoute: ViewpointId;
  sourceChapter: string;
  epoch: number;
  updatedAt: number;
}

export interface WorldlineSnapshot {
  key: string;
  viewpoint: ViewpointId;
  chapter: string;
  dayKey: string;
  epochCursor: number;
  commitDigests: Record<string, { val: boolean; epoch: number }>;
  recordedAt: number;
}

export interface SnapshotDriftResult {
  hasDrift: boolean;
  staleFromDay?: string;
  changedFlags: string[];
}

export interface WorldTimelineLedger {
  v: 2;
  epoch: number;
  seenEvents: string[];
  commits: Record<string, WorldCommit>;
  snapshots: Record<string, WorldlineSnapshot>;
  routeRecords?: Partial<Record<ViewpointId, Record<string, ChapterRecord>>>;
}

const LEGACY_KEY = 'beijing1989.save.v1';
const LEGACY_KEY_WORKER = 'beijing1989.save.worker.v1';
const LEGACY_STARTS = 'beijing1989.starts.v1';
const STARTS_V2 = 'beijing1989.starts.v2';
const LEDGER_KEY = 'beijing1989.world.v2';

const WORLD_FLAGS = worldFlagsJson as unknown as Record<string, WorldFlagDef>;
const ROUTES = ((chaptersJson as unknown as { routes?: Record<ViewpointId, RouteChapterMeta[]> }).routes ?? {}) as Record<ViewpointId, RouteChapterMeta[]>;

const CHAPTER_TO_VP = new Map<string, ViewpointId>();
const CHAPTER_TO_DAY = new Map<string, string>();
for (const vp of ['student', 'worker', 'journalist', 'resident'] as const) {
  for (const m of ROUTES[vp] ?? []) {
    CHAPTER_TO_VP.set(m.id, vp);
    CHAPTER_TO_DAY.set(m.id, m.dayKey ?? m.date);
  }
}

const VALID_VIEWPOINTS = new Set<ViewpointId>(['student', 'worker', 'journalist', 'resident']);

function routeKey(vp: ViewpointId): string {
  return `beijing1989.route.${vp}.v2`;
}

function defaultStartFor(vp: ViewpointId): { chapter: string; scene: SceneId } {
  const first = ROUTES[vp]?.[0]?.id;
  switch (vp) {
    case 'worker':
      return { chapter: first ?? 'w0-0417', scene: 'factory' };
    case 'journalist':
      return { chapter: first ?? 'j-0417', scene: 'newsroom' };
    case 'resident':
      return { chapter: first ?? 'r-0417', scene: 'siheyuan_room' };
    case 'student':
    default:
      return { chapter: first ?? 'ch0-0417', scene: 'campus' };
  }
}

export function viewpointForChapter(chapter?: string): ViewpointId {
  if (chapter) {
    const mapped = CHAPTER_TO_VP.get(chapter);
    if (mapped) return mapped;
    if (chapter.startsWith('w')) return 'worker';
    if (chapter.startsWith('j')) return 'journalist';
    if (chapter.startsWith('r')) return 'resident';
  }
  return 'student';
}

export function dayKeyForChapter(chapter?: string): string {
  if (chapter && CHAPTER_TO_DAY.has(chapter)) return CHAPTER_TO_DAY.get(chapter)!;
  const m = chapter?.match(/(\d{2})(\d{2})$/);
  if (m) return `1989-${m[1]}-${m[2]}`;
  return '1989-04-17';
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function numRecord(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'number' && Number.isFinite(val)) out[k] = val;
    }
  }
  return out;
}

function historyRecord(v: unknown): Record<string, ChapterRecord> {
  const out: Record<string, ChapterRecord> = {};
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val && typeof val === 'object') {
        const rec = val as Record<string, unknown>;
        out[k] = {
          ending: typeof rec.ending === 'string' ? rec.ending : undefined,
          taken: strArray(rec.taken),
        };
      }
    }
  }
  return out;
}

function capturedPhotoArray(v: unknown): PhotoCaptureRecord[] {
  if (!Array.isArray(v)) return [];
  const out: PhotoCaptureRecord[] = [];
  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.dataUrl !== 'string' || !r.dataUrl.startsWith('data:image/')) continue;
    const mm = r.lensMm === 50 || r.lensMm === 85 ? r.lensMm : 35;
    out.push({
      id: r.id,
      frameNo: typeof r.frameNo === 'number' && Number.isFinite(r.frameNo) ? r.frameNo : out.length + 1,
      chapterId: typeof r.chapterId === 'string' ? r.chapterId : 'ch0-0417',
      sceneId: (typeof r.sceneId === 'string' && r.sceneId ? r.sceneId : 'campus') as SceneId,
      dateLabel: typeof r.dateLabel === 'string' ? r.dateLabel : '',
      lensMm: mm,
      caption: typeof r.caption === 'string' ? r.caption : '35mm 底片',
      dataUrl: r.dataUrl,
      selectedForPrint: typeof r.selectedForPrint === 'boolean' ? r.selectedForPrint : undefined,
      takenAt: typeof r.takenAt === 'number' && Number.isFinite(r.takenAt) ? r.takenAt : Date.now(),
    });
  }
  return out;
}

function normalizeSave(raw: unknown, fallbackVp?: ViewpointId): SaveState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if ((r.v !== 1 && r.v !== 2) || typeof r.chapter !== 'string') return null;
  const rawVp = typeof r.viewpoint === 'string' && VALID_VIEWPOINTS.has(r.viewpoint as ViewpointId)
    ? (r.viewpoint as ViewpointId)
    : undefined;
  const vp = rawVp ?? (r.chapter ? viewpointForChapter(r.chapter) : undefined) ?? fallbackVp ?? 'student';
  const def = defaultStartFor(vp);
  return {
    v: 2,
    viewpoint: vp,
    chapter: r.chapter || def.chapter,
    scene: (typeof r.scene === 'string' && r.scene ? r.scene : def.scene) as SceneId,
    flags: strArray(r.flags),
    items: strArray(r.items),
    keepsakes: strArray(r.keepsakes),
    evidence: strArray(r.evidence),
    dossiers: strArray(r.dossiers),
    photos: strArray(r.photos),
    capturedPhotos: capturedPhotoArray(r.capturedPhotos),
    clockMin: typeof r.clockMin === 'number' && Number.isFinite(r.clockMin) ? r.clockMin : 0,
    rel: numRecord(r.rel),
    diary: strArray(r.diary),
    ending: typeof r.ending === 'string' ? r.ending : undefined,
    taken: strArray(r.taken),
    history: historyRecord(r.history),
  };
}

export function fresh(viewpoint: ViewpointId = 'student'): SaveState {
  const def = defaultStartFor(viewpoint);
  return {
    v: 2,
    viewpoint,
    chapter: def.chapter,
    scene: def.scene,
    flags: [],
    items: [],
    keepsakes: [],
    evidence: [],
    dossiers: [],
    photos: [],
    capturedPhotos: [],
    clockMin: 0,
    rel: {},
    diary: [],
    taken: [],
    history: {},
  };
}

export function load(viewpoint: ViewpointId = 'student'): SaveState | null {
  try {
    const rawV2 = localStorage.getItem(routeKey(viewpoint));
    if (rawV2) {
      const migrated = normalizeSave(JSON.parse(rawV2), viewpoint);
      if (migrated) return migrated;
    }
    if (viewpoint === 'student' || viewpoint === 'worker') {
      const legacyKey = viewpoint === 'worker' ? LEGACY_KEY_WORKER : LEGACY_KEY;
      const rawV1 = localStorage.getItem(legacyKey);
      if (rawV1) {
        const migrated = normalizeSave(JSON.parse(rawV1), viewpoint);
        if (migrated) {
          try {
            localStorage.setItem(routeKey(viewpoint), JSON.stringify(migrated));
          } catch { /* private mode */ }
          return migrated;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function syncRouteProgressIfNeeded(s: SaveState): void {
  const hasEnded = Boolean(s.ending);
  const histKeys = s.history ? Object.keys(s.history) : [];
  if (!hasEnded && histKeys.length === 0) return;
  try {
    const ledger = loadLedger();
    const prev = ledger.routeRecords?.[s.viewpoint] ?? {};
    const next: Record<string, ChapterRecord> = { ...prev, ...(s.history ?? {}) };
    if (s.ending) {
      next[s.chapter] = { ending: s.ending, taken: [...(s.taken ?? [])] };
    }
    const prevJson = JSON.stringify(prev);
    const nextJson = JSON.stringify(next);
    if (prevJson !== nextJson) {
      ledger.routeRecords = { ...(ledger.routeRecords ?? {}), [s.viewpoint]: next };
      storeLedger(ledger);
    }
  } catch { /* ignore */ }
}

export function store(s: SaveState): void {
  const vp = s.viewpoint ?? viewpointForChapter(s.chapter);
  const normalized = normalizeSave({ ...s, v: 2, viewpoint: vp }, vp) ?? fresh(vp);
  try {
    localStorage.setItem(routeKey(vp), JSON.stringify(normalized));
  } catch {
    // QuotaExceededError fallback: trim oldest unselected B&W photo dataUrls and retry
    while (normalized.capturedPhotos && normalized.capturedPhotos.length > 0) {
      const idx = normalized.capturedPhotos.findIndex(p => !p.selectedForPrint);
      normalized.capturedPhotos.splice(idx >= 0 ? idx : 0, 1);
      try {
        localStorage.setItem(routeKey(vp), JSON.stringify(normalized));
        break;
      } catch { /* keep trimming */ }
    }
  }
  try {
    syncRouteProgressIfNeeded(normalized);
  } catch { /* private mode */ }
}

export function clear(viewpoint: ViewpointId = 'student'): void {
  try {
    localStorage.removeItem(routeKey(viewpoint));
    if (viewpoint === 'student') localStorage.removeItem(LEGACY_KEY);
    if (viewpoint === 'worker') localStorage.removeItem(LEGACY_KEY_WORKER);
    const rawLedger = localStorage.getItem(LEDGER_KEY);
    if (rawLedger) {
      const ledger = loadLedger();
      if (ledger.routeRecords && ledger.routeRecords[viewpoint]) {
        delete ledger.routeRecords[viewpoint];
        storeLedger(ledger);
      }
    }
  } catch { /* ignore */ }
}

/** Snapshot of the state at the start of each chapter (chapter select). */
export function starts(): Record<string, SaveState> {
  const out: Record<string, SaveState> = {};
  try {
    const rawV1 = JSON.parse(localStorage.getItem(LEGACY_STARTS) || '{}') as Record<string, unknown>;
    if (rawV1 && typeof rawV1 === 'object') {
      for (const [k, v] of Object.entries(rawV1)) {
        const m = normalizeSave(v, viewpointForChapter(k));
        if (m) out[k] = m;
      }
    }
  } catch { /* ignore */ }
  try {
    const rawV2 = JSON.parse(localStorage.getItem(STARTS_V2) || '{}') as Record<string, unknown>;
    if (rawV2 && typeof rawV2 === 'object') {
      for (const [k, v] of Object.entries(rawV2)) {
        const m = normalizeSave(v, viewpointForChapter(k));
        if (m) out[k] = m;
      }
    }
  } catch { /* ignore */ }
  return out;
}

export function storeStart(s: SaveState): void {
  try {
    const vp = s.viewpoint ?? viewpointForChapter(s.chapter);
    const normalized = normalizeSave({ ...s, v: 2, viewpoint: vp }, vp);
    if (!normalized) return;
    const all = starts();
    all[normalized.chapter] = JSON.parse(JSON.stringify(normalized)) as SaveState;
    localStorage.setItem(STARTS_V2, JSON.stringify(all));
    recordSnapshot(normalized);
  } catch { /* ignore */ }
}

// ── Cross-Route WorldTimelineLedger (beijing1989.world.v2) ──

function emptyLedger(): WorldTimelineLedger {
  return { v: 2, epoch: 0, seenEvents: [], commits: {}, snapshots: {}, routeRecords: {} };
}

export function loadLedger(): WorldTimelineLedger {
  try {
    const raw = JSON.parse(localStorage.getItem(LEDGER_KEY) || 'null') as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object' || raw.v !== 2) return emptyLedger();
    const commits: Record<string, WorldCommit> = {};
    if (raw.commits && typeof raw.commits === 'object') {
      for (const [k, val] of Object.entries(raw.commits as Record<string, unknown>)) {
        if (val && typeof val === 'object') {
          const c = val as Record<string, unknown>;
          if (typeof c.id === 'string' && typeof c.val === 'boolean') {
            commits[k] = {
              id: c.id,
              val: c.val,
              dayKey: typeof c.dayKey === 'string' ? c.dayKey : (WORLD_FLAGS[c.id]?.dayKey ?? '1989-04-17'),
              sourceRoute: VALID_VIEWPOINTS.has(c.sourceRoute as ViewpointId) ? (c.sourceRoute as ViewpointId) : 'student',
              sourceChapter: typeof c.sourceChapter === 'string' ? c.sourceChapter : '',
              epoch: typeof c.epoch === 'number' ? c.epoch : 0,
              updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : 0,
            };
          }
        }
      }
    }
    const snapshots: Record<string, WorldlineSnapshot> = {};
    if (raw.snapshots && typeof raw.snapshots === 'object') {
      for (const [k, val] of Object.entries(raw.snapshots as Record<string, unknown>)) {
        if (val && typeof val === 'object') {
          const sn = val as Record<string, unknown>;
          if (typeof sn.chapter === 'string' && typeof sn.dayKey === 'string') {
            snapshots[k] = {
              key: typeof sn.key === 'string' ? sn.key : k,
              viewpoint: VALID_VIEWPOINTS.has(sn.viewpoint as ViewpointId) ? (sn.viewpoint as ViewpointId) : viewpointForChapter(sn.chapter),
              chapter: sn.chapter,
              dayKey: sn.dayKey,
              epochCursor: typeof sn.epochCursor === 'number' ? sn.epochCursor : 0,
              commitDigests: (sn.commitDigests && typeof sn.commitDigests === 'object' ? sn.commitDigests : {}) as Record<string, { val: boolean; epoch: number }>,
              recordedAt: typeof sn.recordedAt === 'number' ? sn.recordedAt : 0,
            };
          }
        }
      }
    }
    const routeRecords: Partial<Record<ViewpointId, Record<string, ChapterRecord>>> = {};
    if (raw.routeRecords && typeof raw.routeRecords === 'object') {
      for (const vp of ['student', 'worker', 'journalist', 'resident'] as const) {
        const rec = (raw.routeRecords as Record<string, unknown>)[vp];
        if (rec) routeRecords[vp] = historyRecord(rec);
      }
    }
    return {
      v: 2,
      epoch: typeof raw.epoch === 'number' ? raw.epoch : 0,
      seenEvents: strArray(raw.seenEvents),
      commits,
      snapshots,
      routeRecords,
    };
  } catch {
    return emptyLedger();
  }
}

export function storeLedger(ledger: WorldTimelineLedger): void {
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
  } catch { /* private mode */ }
}

export function clearLedger(): void {
  try {
    localStorage.removeItem(LEDGER_KEY);
  } catch { /* ignore */ }
}

export function commitWorldFlag(
  id: string,
  val = true,
  meta?: { dayKey?: string; sourceRoute?: ViewpointId; sourceChapter?: string },
): WorldTimelineLedger {
  const ledger = loadLedger();
  const def = WORLD_FLAGS[id];
  const dayKey = meta?.dayKey ?? def?.dayKey ?? (meta?.sourceChapter ? dayKeyForChapter(meta.sourceChapter) : '1989-04-17');
  const sourceRoute = meta?.sourceRoute ?? def?.sourceRoute ?? (meta?.sourceChapter ? viewpointForChapter(meta.sourceChapter) : 'student');
  const sourceChapter = meta?.sourceChapter ?? '';
  ledger.epoch = (ledger.epoch || 0) + 1;
  ledger.commits[id] = {
    id,
    val,
    dayKey,
    sourceRoute,
    sourceChapter,
    epoch: ledger.epoch,
    updatedAt: Date.now(),
  };
  storeLedger(ledger);
  return ledger;
}

/** Resolve cross-route commit respecting causal horizon (dayKey <= currentDayKey) with WORLD_FLAGS fallback. */
export function queryWorldFlag(
  id: string,
  currentDayKey?: string,
  ledger?: WorldTimelineLedger,
): boolean {
  const activeLedger = ledger ?? loadLedger();
  const def = WORLD_FLAGS[id];
  const fallback = def?.defaultVal ?? false;
  const commit = activeLedger.commits[id];
  if (!commit) return fallback;
  if (currentDayKey && commit.dayKey > currentDayKey) return fallback;
  return commit.val;
}

export function markSeenEvent(id: string): WorldTimelineLedger {
  const ledger = loadLedger();
  if (id && !ledger.seenEvents.includes(id)) {
    ledger.seenEvents.push(id);
    storeLedger(ledger);
  }
  return ledger;
}

export function recordSnapshot(state: SaveState, dayKey?: string): WorldTimelineLedger {
  const vp = state.viewpoint ?? viewpointForChapter(state.chapter);
  const dk = dayKey ?? dayKeyForChapter(state.chapter);
  const ledger = loadLedger();
  const commitDigests: Record<string, { val: boolean; epoch: number }> = {};
  for (const [id, c] of Object.entries(ledger.commits)) {
    if (c.dayKey <= dk) {
      commitDigests[id] = { val: c.val, epoch: c.epoch };
    }
  }
  const key = `${vp}:${state.chapter}`;
  ledger.snapshots[key] = {
    key,
    viewpoint: vp,
    chapter: state.chapter,
    dayKey: dk,
    epochCursor: ledger.epoch,
    commitDigests,
    recordedAt: Date.now(),
  };
  if (state.history || state.ending) {
    const prev = ledger.routeRecords?.[vp] ?? {};
    const next: Record<string, ChapterRecord> = { ...prev, ...(state.history ?? {}) };
    if (state.ending) next[state.chapter] = { ending: state.ending, taken: [...(state.taken ?? [])] };
    ledger.routeRecords = { ...(ledger.routeRecords ?? {}), [vp]: next };
  }
  storeLedger(ledger);
  return ledger;
}

export function checkSnapshotDrift(
  stateOrViewpoint: SaveState | ViewpointId | string,
  chapterOrDayKey?: string,
  dayKey?: string,
): SnapshotDriftResult {
  let vp: ViewpointId;
  let chapter: string;
  let dk: string;
  if (typeof stateOrViewpoint === 'object' && stateOrViewpoint !== null) {
    vp = stateOrViewpoint.viewpoint ?? viewpointForChapter(stateOrViewpoint.chapter);
    chapter = stateOrViewpoint.chapter;
    dk = chapterOrDayKey ?? dayKeyForChapter(chapter);
  } else if (VALID_VIEWPOINTS.has(stateOrViewpoint as ViewpointId) && chapterOrDayKey) {
    vp = stateOrViewpoint as ViewpointId;
    chapter = chapterOrDayKey;
    dk = dayKey ?? dayKeyForChapter(chapter);
  } else {
    chapter = stateOrViewpoint;
    vp = viewpointForChapter(chapter);
    dk = chapterOrDayKey ?? dayKeyForChapter(chapter);
  }

  const ledger = loadLedger();
  const snap = ledger.snapshots[`${vp}:${chapter}`];
  if (!snap) return { hasDrift: false, changedFlags: [] };

  const changedFlags: string[] = [];
  let staleFromDay: string | undefined;
  const noteDrift = (id: string, commitDay: string) => {
    if (!changedFlags.includes(id)) changedFlags.push(id);
    if (!staleFromDay || commitDay < staleFromDay) staleFromDay = commitDay;
  };

  for (const [id, c] of Object.entries(ledger.commits)) {
    if (c.dayKey > dk) continue;
    const prev = snap.commitDigests[id];
    const baseline = WORLD_FLAGS[id]?.defaultVal ?? false;
    if (prev ? prev.val !== c.val : c.val !== baseline) {
      noteDrift(id, c.dayKey);
    }
  }
  for (const [id, prev] of Object.entries(snap.commitDigests)) {
    if (!ledger.commits[id]) {
      const baseline = WORLD_FLAGS[id]?.defaultVal ?? false;
      if (prev.val !== baseline) {
        noteDrift(id, WORLD_FLAGS[id]?.dayKey ?? snap.dayKey);
      }
    }
  }

  return { hasDrift: changedFlags.length > 0, staleFromDay, changedFlags };
}
