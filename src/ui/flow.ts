import type { Chapter, Hotspot } from '../types';
import type { ChapterRecord } from '../save/save';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function formatClockRange(win?: [number, number]): string {
  if (!win) return '';
  const fmt = (m: number) => {
    const wrapped = ((m % 1440) + 1440) % 1440;
    const hh = String(Math.floor(wrapped / 60)).padStart(2, '0');
    const mm = String(wrapped % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  };
  return ` [${fmt(win[0])}–${fmt(win[1])}]`;
}

function hotspotBadge(hs: Hotspot): string {
  const kindTag = hs.kind === 'photo_vantage' ? ' 📷' : hs.kind === 'dispatch' ? ' 📡' : '';
  const timeTag = hs.timeWindow ? formatClockRange(hs.timeWindow) : '';
  return `${kindTag}${timeTag}`;
}

/** Detroit-style branch chart: per hotspot, the chain of nodes and choices; taken = lit, seen-but-not-taken = dim, unseen = "？？？". */
export function flowHtml(ch: Chapter, rec: ChapterRecord): string {
  const taken = new Set(rec.taken ?? []);
  const seenNodes = new Set([...taken].map(k => k.split('#')[0]));
  const walk = (id: string, depth: number, seen: Set<string>): string => {
    if (seen.has(id) || !ch.nodes[id]) return '';
    seen.add(id);
    const n = ch.nodes[id];
    const vis = seenNodes.has(id);
    let h = '';
    n.choices.forEach((c, i) => {
      const t = taken.has(id + '#' + i);
      const label = t ? esc(c.text) : vis ? esc(c.text) : '？？？';
      const endTitle = c.end ? (ch.endings?.[c.end]?.title ?? c.end) : '';
      const tail = c.end
        ? ` → 結局「${t ? esc(endTitle) : '？'}」`
        : c.goto
          ? ' → 移動'
          : '';
      const tags = t
        ? [
            c.evidence ? '＋線索' : '',
            c.keepsake ? '＋留存物' : '',
            c.worldEmit ? '＋跨線交會' : '',
          ].filter(Boolean).join(' ')
        : '';
      const tagHtml = tags ? ` <span class="small">${esc(tags)}</span>` : '';
      h += `<div class="fc ${t ? 'on' : vis ? 'dim' : 'lock'}" style="margin-left:${depth * 14}px">${t ? '●' : '○'} ${label}${tail}${tagHtml}</div>`;
      if (c.next) h += walk(c.next, depth + 1, seen);
    });
    return h;
  };

  const seen = new Set<string>();
  let html = `<h3>${esc(ch.title)}</h3>` + `<div class="fh">開場</div>` + walk(ch.start, 0, seen);
  for (const hs of ch.hotspots) {
    const body = walk(hs.start, 1, seen);
    if (!body) continue;
    const badge = hotspotBadge(hs);
    html += `<div class="fh">${esc(hs.label)}${badge ? `<span class="small">${esc(badge)}</span>` : ''}${seenNodes.has(hs.start) ? '' : '　<span class="small">未探索</span>'}</div>` + body;
  }
  html += '<div class="fh">結局</div>' + Object.entries(ch.endings).map(([k, e]) =>
    `<div class="fc ${rec.ending === k ? 'on' : 'lock'}">${rec.ending === k ? '◆ ' + esc(e.title) : '◇ ？？？'}</div>`).join('');
  const total = Object.values(ch.nodes).reduce((a, n) => a + n.choices.length, 0);
  return html + `<p class="small">已走過 ${taken.size} / ${total} 個選擇。灰色是看過但沒選的，？？？是還沒走到的。</p>`;
}

export function flowMultiChapterHtml(
  chapters: Record<string, Chapter>,
  order: string[],
  currentChapterId: string,
  currentRecord: ChapterRecord,
  history?: Record<string, ChapterRecord>
): string {
  const parts = order
    .filter(id => id === currentChapterId || Boolean(history?.[id]))
    .map(id => {
      const ch = chapters[id];
      const rec = id === currentChapterId ? currentRecord : history?.[id];
      return ch && rec ? flowHtml(ch, rec) : '';
    })
    .filter(Boolean);
  return parts.length ? parts.join('') : '<p class="small">尚未留下分支探索紀錄。</p>';
}
