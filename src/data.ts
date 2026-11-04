import type { Chapter, HistEvent } from './types';
import ch0 from '../data/dialogue/ch0-0417.json';
import chapters from '../data/events/chapters.json';

const eventFiles = import.meta.glob('../data/events/1989-*.json', { eager: true, import: 'default' });
export const EVENTS: Record<string, HistEvent> = {};
for (const e of Object.values(eventFiles) as HistEvent[]) EVENTS[e.id] = e;
export const CHAPTER0 = ch0 as unknown as Chapter;
export const CHAPTERS = chapters;
