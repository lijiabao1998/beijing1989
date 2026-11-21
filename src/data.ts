import type {
  Chapter,
  HistEvent,
  RouteChapterMeta,
  SceneId,
  SceneManifestEntry,
  ViewpointId,
  ViewpointMeta,
  WorldFlagDef,
} from './types';
import chapters from '../data/events/chapters.json';
import scenesJson from '../data/scenes.json';
import worldFlagsJson from '../data/worldFlags.json';

const eventFiles = import.meta.glob('../data/events/1989-*.json', { eager: true, import: 'default' });
const dialogueFiles = import.meta.glob('../data/dialogue/*.json', { eager: true, import: 'default' });

export const EVENTS: Record<string, HistEvent> = {};
for (const e of Object.values(eventFiles) as HistEvent[]) EVENTS[e.id] = e;

export const CH: Record<string, Chapter> = {};
for (const [path, mod] of Object.entries(dialogueFiles)) {
  const ch = mod as unknown as Chapter;
  const fallbackId = path.split('/').pop()?.replace(/\.json$/, '') ?? '';
  const id = ch?.chapter || fallbackId;
  if (id) CH[id] = ch;
}

export const SCENE_META = scenesJson as unknown as Record<SceneId, SceneManifestEntry>;
export const WORLD_FLAGS = worldFlagsJson as unknown as Record<string, WorldFlagDef>;
export const CHAPTERS = chapters;
export const VIEWPOINTS: ViewpointMeta[] =
  ((chapters as unknown as { viewpoints?: ViewpointMeta[] }).viewpoints ?? []);
export const ROUTES: Record<ViewpointId, RouteChapterMeta[]> =
  ((chapters as unknown as { routes?: Record<ViewpointId, RouteChapterMeta[]> }).routes ?? {
    student: [],
    worker: [],
    journalist: [],
    resident: [],
  });

const CHAPTER_META_BY_ID = new Map<string, RouteChapterMeta>();
const CHAPTER_VIEWPOINT = new Map<string, ViewpointId>();
const ORDER_BY_VIEWPOINT: Record<ViewpointId, string[]> = {
  student: [],
  worker: [],
  journalist: [],
  resident: [],
};

for (const vp of ['student', 'worker', 'journalist', 'resident'] as const) {
  const list = [...(ROUTES[vp] ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
  for (const meta of list) {
    CHAPTER_META_BY_ID.set(meta.id, meta);
    CHAPTER_VIEWPOINT.set(meta.id, vp);
    if (meta.playable && CH[meta.id]) {
      ORDER_BY_VIEWPOINT[vp].push(meta.id);
    }
  }
}

export const STUDENT_ORDER: string[] = ORDER_BY_VIEWPOINT.student;
export const WORKER_ORDER: string[] = ORDER_BY_VIEWPOINT.worker;
export const JOURNALIST_ORDER: string[] = ORDER_BY_VIEWPOINT.journalist;
export const RESIDENT_ORDER: string[] = ORDER_BY_VIEWPOINT.resident;
export const ORDER: string[] = STUDENT_ORDER;

export function viewpointOfChapter(id: string): ViewpointId {
  const mapped = CHAPTER_VIEWPOINT.get(id);
  if (mapped) return mapped;
  if (id.startsWith('w')) return 'worker';
  if (id.startsWith('j')) return 'journalist';
  if (id.startsWith('r')) return 'resident';
  return 'student';
}

export function orderForViewpoint(vp: ViewpointId): string[] {
  return [...(ORDER_BY_VIEWPOINT[vp] ?? [])];
}

export function orderForChapter(id: string): string[] {
  return orderForViewpoint(viewpointOfChapter(id));
}

export function shortIdOf(id: string): string {
  return CHAPTER_META_BY_ID.get(id)?.shortId ?? id.split('-')[0];
}

export function assetKeyOf(id: string): string {
  return CHAPTER_META_BY_ID.get(id)?.assetKey ?? shortIdOf(id);
}

export function dayKeyOf(id: string): string {
  const meta = CHAPTER_META_BY_ID.get(id);
  return meta?.dayKey ?? meta?.date ?? '1989-04-17';
}

export function chapterMetaOf(id: string): RouteChapterMeta | undefined {
  return CHAPTER_META_BY_ID.get(id);
}

export function firstChapterFor(vp: ViewpointId): string {
  return ORDER_BY_VIEWPOINT[vp]?.[0]
    ?? ROUTES[vp]?.[0]?.id
    ?? (vp === 'worker' ? 'w0-0417' : vp === 'journalist' ? 'j-0417' : vp === 'resident' ? 'r-0417' : 'ch0-0417');
}

export const CHAPTER0 = CH['ch0-0417'];
