import type { Chapter, Choice, DNode } from '../types';
import type { SaveState } from '../save/save';

/** Data-driven dialogue runner. No scores, no "correct" choice: choices only change flags, items, relationships and the diary. */
export class Story {
  constructor(public ch: Chapter, public s: SaveState) {}
  has(flag: string) {
    if (flag === 'has_item') return this.s.items.length > 0;
    return this.s.flags.includes(flag);
  }
  node(id: string): DNode { const n = this.ch.nodes[id]; if (!n) throw new Error('missing node ' + id); return n; }
  available(n: DNode): Choice[] { return n.choices.filter(c => !c.requires || this.has(c.requires)); }
  apply(c: Choice) {
    if (c.set && !this.s.flags.includes(c.set)) this.s.flags.push(c.set);
    if (c.item && !this.s.items.includes(c.item)) this.s.items.push(c.item);
    if (c.diary && !this.s.diary.includes(c.diary)) this.s.diary.push(c.diary);
    for (const [k, v] of Object.entries(c.rel || {})) this.s.rel[k] = (this.s.rel[k] || 0) + v;
    if (c.end) this.s.ending = c.end;
    if (c.goto) this.s.scene = c.goto;
  }
  speakerName(id: string) { return this.ch.characters[id]?.name ?? ''; }
}
