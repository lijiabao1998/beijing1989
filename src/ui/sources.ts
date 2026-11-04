import { EVENTS } from '../data';
import type { HistEvent } from '../types';

const KIND: Record<string, string> = { historical: '史實', testimony: '親歷證言', fiction: '遊戲虛構' };
const CONF: Record<string, string> = { documented: '有文獻記載', testimony: '證言（單一來源）', uncertain: '無法確認' };
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function eventHtml(e: HistEvent) {
  const src = e.sources.length
    ? '<ol>' + e.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a><br><span class="small">${esc(s.publisher)}${s.note ? '・' + esc(s.note) : ''}</span></li>`).join('') + '</ol>'
    : '<p class="small">此條為遊戲虛構內容，沒有史料來源。</p>';
  return `<h3>${esc(e.title.zh)} <span class="small">${esc(e.date)}・${esc(e.place)}</span></h3>
  <p><span class="tag ${e.kind}">${KIND[e.kind]}</span><span class="tag ${e.confidence}">${CONF[e.confidence]}</span></p>
  <p>${esc(e.summary.zh)}</p><h4>來源</h4>${src}`;
}

export function allSourcesHtml(seen: string[]) {
  const ids = Object.keys(EVENTS).sort();
  return '<h2>史料</h2><p class="small">分成史實、證言與遊戲虛構三類。連結會在新分頁打開。</p>' +
    ids.map(id => `<div data-ev="${id}" style="border-top:1px solid #4a3a28;padding-top:6px;${seen.includes(id) ? '' : 'opacity:.55'}">${eventHtml(EVENTS[id])}</div>`).join('');
}
