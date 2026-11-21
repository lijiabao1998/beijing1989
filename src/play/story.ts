import type { Chapter, Choice, DNode } from '../types';
import { commitWorldFlag, dayKeyForChapter, queryWorldFlag, type SaveState } from '../save/save';

/** Data-driven dialogue runner. Choices change flags, items, keepsakes, evidence, relationships, clock, and the diary. */
export class Story {
  public dayKey: string;

  constructor(public ch: Chapter, public s: SaveState, dayKey?: string) {
    this.dayKey = dayKey ?? dayKeyForChapter(ch.chapter);
    this.s.keepsakes ??= [];
    this.s.evidence ??= [];
    this.s.dossiers ??= [];
    this.s.photos ??= [];
    if (this.s.clockMin === undefined) this.s.clockMin = ch.clockStart ?? 0;
    else if (this.s.clockMin === 0 && ch.clockStart !== undefined) this.s.clockMin = ch.clockStart;
  }

  /**
   * Conditions:
   * - "!cond" (negation)
   * - "has_item" / "item:<id>"
   * - "world:<id>" (cross-route causal commit respecting dayKey horizon + fallback)
   * - "evidence:<id>" / "dossier:<id>" / "photo:<id>" / "keepsake:<id>"
   * - "time:<lo>-<hi>" (in-chapter clockMin window, supports midnight wraparound)
   * - "rel:<who>>=n" / "rel:<who><=n"
   * - "<flag>" (including "<shortId>:end:<endingId>")
   */
  has(cond: string): boolean {
    if (cond.startsWith('!')) return !this.has(cond.slice(1));
    if (cond === 'has_item') return this.s.items.length > 0;
    if (cond.startsWith('item:')) return this.s.items.includes(cond.slice(5));
    if (cond.startsWith('world:')) return queryWorldFlag(cond.slice(6), this.dayKey);
    if (cond.startsWith('evidence:')) return (this.s.evidence ?? []).includes(cond.slice(9));
    if (cond.startsWith('dossier:')) return (this.s.dossiers ?? []).includes(cond.slice(8));
    if (cond.startsWith('photo:')) return (this.s.photos ?? []).includes(cond.slice(6));
    if (cond.startsWith('keepsake:')) return (this.s.keepsakes ?? []).includes(cond.slice(9));
    const tm = cond.match(/^time:(\d+)-(\d+)$/);
    if (tm) {
      const cur = this.s.clockMin ?? 0;
      const lo = +tm[1];
      const hi = +tm[2];
      return lo <= hi ? (cur >= lo && cur <= hi) : (cur >= lo || cur <= hi);
    }
    const m = cond.match(/^rel:(\w+)(>=|<=)(-?\d+)$/);
    if (m) {
      const v = this.s.rel[m[1]] || 0;
      const n = +m[3];
      return m[2] === '>=' ? v >= n : v <= n;
    }
    return this.s.flags.includes(cond);
  }

  node(id: string): DNode {
    const n = this.ch.nodes[id];
    if (!n) throw new Error('missing node ' + id);
    return n;
  }

  text(n: DNode) {
    return n.variants?.find(v => this.has(v.requires))?.text ?? n.text;
  }

  available(n: DNode): Choice[] {
    return n.choices.filter(c => !c.requires || this.has(c.requires));
  }

  apply(c: Choice, nodeId?: string) {
    if (nodeId) {
      const k = nodeId + '#' + this.node(nodeId).choices.indexOf(c);
      (this.s.taken ??= []).includes(k) || this.s.taken.push(k);
    }
    if (c.set && !this.s.flags.includes(c.set)) this.s.flags.push(c.set);
    if (c.item && !this.s.items.includes(c.item)) this.s.items.push(c.item);
    if (c.consumeItem) {
      this.s.items = this.s.items.filter(x => x !== c.consumeItem);
    }
    if (c.keepsake) {
      const ks = (this.s.keepsakes ??= []);
      if (!ks.includes(c.keepsake)) ks.push(c.keepsake);
    }
    if (c.evidence) {
      const ev = (this.s.evidence ??= []);
      if (!ev.includes(c.evidence)) ev.push(c.evidence);
    }
    if (c.diary && !this.s.diary.includes(c.diary)) this.s.diary.push(c.diary);
    for (const [k, v] of Object.entries(c.rel || {})) this.s.rel[k] = (this.s.rel[k] || 0) + v;
    if (c.timeCost && Number.isFinite(c.timeCost)) {
      this.s.clockMin = (this.s.clockMin ?? this.ch.clockStart ?? 0) + c.timeCost;
    }
    if (c.worldEmit) {
      for (const token of c.worldEmit.split(',').map(x => x.trim()).filter(Boolean)) {
        const neg = token.startsWith('!');
        const raw = neg ? token.slice(1) : token;
        const [id, valStr] = raw.split('=');
        const val = neg ? false : valStr === undefined ? true : valStr !== 'false';
        commitWorldFlag(id, val, {
          dayKey: this.dayKey,
          sourceRoute: this.s.viewpoint,
          sourceChapter: this.ch.chapter,
        });
      }
    }
    if (c.end) this.s.ending = c.end;
    if (c.goto) this.s.scene = c.goto;
  }

  speakerName(id: string) {
    return this.ch.characters[id]?.name ?? '';
  }
}
