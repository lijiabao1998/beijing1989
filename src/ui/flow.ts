import type { Chapter } from '../types';
import type { ChapterRecord } from '../save/save';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Detroit-style branch chart: per hotspot, the chain of nodes and choices; taken = lit, seen-but-not-taken = dim, unseen = "？？？". */
export function flowHtml(ch: Chapter, rec: ChapterRecord) {
  const taken = new Set(rec.taken);
  const seenNodes = new Set([...taken].map(k => k.split('#')[0]));
  const walk = (id: string, depth: number, seen: Set<string>): string => {
    if (seen.has(id) || !ch.nodes[id]) return ''; seen.add(id);
    const n = ch.nodes[id], vis = seenNodes.has(id);
    let h = '';
    n.choices.forEach((c, i) => {
      const t = taken.has(id + '#' + i);
      const label = t ? esc(c.text) : vis ? esc(c.text) : '？？？';
      const tail = c.end ? ` → 結局「${t ? esc(ch.endings[c.end].title) : '？'}」` : c.goto ? ' → 移動' : '';
      h += `<div class="fc ${t ? 'on' : vis ? 'dim' : 'lock'}" style="margin-left:${depth * 14}px">${t ? '●' : '○'} ${label}${tail}</div>`;
      if (c.next) h += walk(c.next, depth + 1, seen);
    });
    return h;
  };
  const seen = new Set<string>();
  let html = `<h3>${esc(ch.title)}</h3>` + `<div class="fh">開場</div>` + walk(ch.start, 0, seen);
  for (const hs of ch.hotspots) {
    const body = walk(hs.start, 1, seen); if (!body) continue;
    html += `<div class="fh">${esc(hs.label)}${seenNodes.has(hs.start) ? '' : '　<span class="small">未探索</span>'}</div>` + body;
  }
  html += '<div class="fh">結局</div>' + Object.entries(ch.endings).map(([k, e]) =>
    `<div class="fc ${rec.ending === k ? 'on' : 'lock'}">${rec.ending === k ? '◆ ' + esc(e.title) : '◇ ？？？'}</div>`).join('');
  const total = Object.values(ch.nodes).reduce((a, n) => a + n.choices.length, 0);
  return html + `<p class="small">已走過 ${taken.size} / ${total} 個選擇。灰色是看過但沒選的，？？？是還沒走到的。</p>`;
}
