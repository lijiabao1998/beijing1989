import { EVENTS } from '../data';
import { VIEWPOINT_LABELS } from '../data/routeMetas';
import type { WorldTimelineLedger } from '../save/save';
import type { EvidenceCard, EvidenceKind, HistEvent } from '../types';

const KIND: Record<string, string> = { historical: '史實', testimony: '親歷證言', fiction: '遊戲虛構' };
const CONF: Record<string, string> = { documented: '有文獻記載', testimony: '證言（單一來源）', uncertain: '無法確認' };
const EV_KIND: Record<EvidenceKind, string> = {
  official_print: '報刊文獻',
  rumor: '街頭傳言',
  witness: '目擊證詞',
  photo: '底片影像',
  audio_tape: '錄音磁帶',
};
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function eventHtml(e: HistEvent): string {
  const src = e.sources.length
    ? '<ol>' + e.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a><br><span class="small">${esc(s.publisher)}${s.note ? '・' + esc(s.note) : ''}</span></li>`).join('') + '</ol>'
    : '<p class="small">此條為遊戲虛構內容，沒有史料來源。</p>';
  const tagHtml = e.kind === 'fiction'
    ? '<span class="tag fiction uncertain">遊戲虛構・無法確認</span>'
    : `<span class="tag ${esc(e.kind)}">${esc(KIND[e.kind] ?? e.kind)}</span><span class="tag ${esc(e.confidence)}">${esc(CONF[e.confidence] ?? e.confidence)}</span>`;
  return `<h3>${esc(e.title.zh)} <span class="small">${esc(e.date)}・${esc(e.place)}</span></h3>
  <p>${tagHtml}</p>
  <p>${esc(e.summary.zh)}</p><h4>來源</h4>${src}`;
}

export function renderEvidenceCardHtml(
  card: EvidenceCard,
  opts?: { selected?: boolean; paired?: boolean; compact?: boolean }
): string {
  const linkedEvent = card.event ? EVENTS[card.event] : undefined;
  const isFiction = linkedEvent?.kind === 'fiction' || (card.kind === 'rumor' && (!card.confidence || card.confidence === 'uncertain'));
  const confTag = isFiction
    ? '<span class="tag fiction uncertain">遊戲虛構・無法確認</span>'
    : card.confidence
      ? `<span class="tag ${esc(card.confidence)}">${esc(CONF[card.confidence] ?? card.confidence)}</span>`
      : '';
  const routeLabel = card.route ? (VIEWPOINT_LABELS[card.route]?.role ?? card.route) : '';
  const metaParts = [card.dayKey, routeLabel, card.sourceLabel].filter(Boolean) as string[];
  const tagsHtml = card.tags?.length
    ? `<div class="ev-tags">${card.tags.map(t => `<span class="tag ev-tag">${esc(t)}</span>`).join('')}</div>`
    : '';
  const eventNote = linkedEvent
    ? `<div class="small ev-event-ref">關聯條目：${esc(linkedEvent.title.zh)}（${linkedEvent.kind === 'fiction' ? '遊戲虛構・無法確認' : (KIND[linkedEvent.kind] ?? linkedEvent.kind)}）</div>`
    : '';

  const cls = [
    'ev-card',
    opts?.selected ? 'selected' : '',
    opts?.paired ? 'paired' : '',
    opts?.compact ? 'compact' : '',
  ].filter(Boolean).join(' ');

  return `<article class="${cls}" data-evidence-id="${esc(card.id)}">
    <div class="ev-card-head">
      <span class="tag ev-kind-${esc(card.kind)}">${esc(EV_KIND[card.kind] ?? card.kind)}</span>
      ${confTag}
      ${metaParts.length ? `<span class="small ev-meta">${esc(metaParts.join('・'))}</span>` : ''}
    </div>
    <h4 class="ev-card-title">${esc(card.title)}</h4>
    <p class="ev-card-summary">${esc(card.summary)}</p>
    ${tagsHtml}
    ${eventNote}
  </article>`;
}

export function allSourcesHtml(seen: string[], ledger?: WorldTimelineLedger): string {
  const seenSet = new Set(seen);
  if (ledger?.seenEvents) {
    for (const id of ledger.seenEvents) seenSet.add(id);
  }
  const ids = Object.keys(EVENTS).sort();
  return '<h2>史料</h2><p class="small">分成史實、證言與「遊戲虛構・無法確認」三類。連結會在新分頁打開。</p>' +
    ids.map(id => `<div data-ev="${esc(id)}" style="border-top:1px solid #4a3a28;padding-top:6px;${seenSet.has(id) ? '' : 'opacity:.55'}">${eventHtml(EVENTS[id]!)}</div>`).join('');
}
