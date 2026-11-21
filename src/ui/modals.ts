import { CH, EVENTS, SCENE_META, WORLD_FLAGS, viewpointOfChapter } from '../data';
import { VIEWPOINT_LABELS } from '../data/routeMetas';
import {
  checkSnapshotDrift,
  loadLedger,
  starts,
  type SaveState,
  type WorldTimelineLedger,
} from '../save/save';
import type {
  Chapter,
  Confidence,
  EvidenceCard,
  EvidenceVerdict,
  RouteChapterMeta,
  SceneId,
  ViewpointId,
} from '../types';
import { ITEM_LABELS, summarizeCharactersForViewpoint } from './chronicle';
import { bindDarkroomModal, renderDarkroomHtml } from './darkroom';
import { renderEvidenceCardHtml } from './sources';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

let baseStylesInjected = false;
function ensureModalBaseStyles(): void {
  if (baseStylesInjected || typeof document === 'undefined') return;
  if (document.getElementById('b89-modals-base')) {
    baseStylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'b89-modals-base';
  style.textContent = `
    :where(.diary-tabs, .map-subtabs) { display:flex; gap:6px; flex-wrap:wrap; margin:8px 0 12px; }
    :where(.diary-tab, .map-subtab) { padding:6px 12px; font-size:13px; border-radius:6px; }
    :where(.diary-tab.active, .map-subtab.active) { background:rgba(138,52,32,.9); border-color:#e9c27a; color:#fff5d6; font-weight:bold; }
    :where(.diary-pane[hidden], .map-pane[hidden]) { display:none; }
    :where(.ev-grid) { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:8px; margin:8px 0; }
    :where(.ev-card-btn) { display:block; width:100%; text-align:left; padding:0; background:none; border:none; color:inherit; }
    :where(.ev-card) { padding:10px 12px; border:1px solid #5a472e; border-radius:8px; background:rgba(28,22,16,.78); transition:border-color .15s,background .15s; }
    :where(.ev-card.selected) { border-color:#e9c27a; background:rgba(92,58,28,.45); box-shadow:0 0 0 1px rgba(233,194,122,.35); }
    :where(.ev-card.paired) { border-color:#789c7f; }
    :where(.ev-card-head) { display:flex; flex-wrap:wrap; gap:4px 6px; align-items:center; margin-bottom:4px; }
    :where(.ev-card-title) { margin:2px 0 4px; font-size:14px; color:#f3ead2; }
    :where(.ev-card-summary) { margin:0; font-size:13px; line-height:1.5; color:#d8cbb0; }
    :where(.ev-tray) { margin:12px 0; padding:10px 12px; border:1px solid #8a6f48; border-radius:8px; background:rgba(20,16,12,.9); }
    :where(.ev-slots) { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:8px 0; }
    :where(.ev-slot) { padding:8px; border:1px dashed #6b5438; border-radius:6px; font-size:12px; min-height:46px; color:#cbbd9e; }
    :where(.ev-deduction) { margin-top:8px; padding:8px 10px; border-radius:6px; background:rgba(38,30,22,.88); border-left:3px solid #e9c27a; }
    :where(.map-svg-wrap) { border:1px solid #5a472e; border-radius:8px; background:#0d1018; padding:6px; overflow:hidden; }
    :where(.map-svg) { display:block; width:100%; height:auto; }
    :where(.map-hub-list) { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
    :where(.map-hub-btn.current) { border-color:#e9c27a; background:rgba(122,52,32,.85); }
    :where(.tl-matrix-scroll, .rashomon-scroll) { overflow-x:auto; margin-top:8px; }
    :where(.tl-matrix, .rashomon-table) { width:100%; border-collapse:collapse; font-size:12px; }
    :where(.tl-matrix th, .tl-matrix td, .rashomon-table th, .rashomon-table td) { border:1px solid #4a3a28; padding:6px 8px; text-align:left; vertical-align:top; }
    :where(.tl-cell-actions) { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; }
    :where(.tl-cell-actions button, .rashomon-jump) { padding:2px 7px; font-size:11px; }
    :where(.drift-box) { margin-top:4px; padding:4px 6px; border-radius:5px; background:rgba(138,68,30,.28); border:1px solid #d49456; font-size:11px; }
    :where(.sw-tuner) { padding:12px; border:1px solid #8a6f48; border-radius:10px; background:linear-gradient(180deg,#1f1a14,#13100c); }
    :where(.sw-scale) { position:relative; height:26px; margin:8px 0; border:1px solid #5a472e; border-radius:4px; background:#0b0d12; overflow:hidden; }
    :where(.sw-needle) { position:absolute; top:0; bottom:0; width:2px; background:#e9c27a; box-shadow:0 0 6px #e9c27a; }
    :where(.sw-controls) { display:flex; align-items:center; gap:8px; }
    :where(.sw-controls input[type="range"]) { flex:1; }
    :where(.sw-sig-bar) { height:5px; border-radius:3px; background:#2a2219; margin:6px 0; overflow:hidden; }
    :where(.sw-sig-fill) { height:100%; width:10%; background:#87b57c; transition:width .1s; }
    :where(.vf-overlay) { position:fixed; inset:0; z-index:20; pointer-events:none; display:flex; flex-direction:column; justify-content:space-between; padding:14px; font-family:monospace; }
    :where(.vf-overlay[hidden]) { display:none !important; }
    :where(.vf-top, .vf-bot) { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; }
    :where(.vf-top button, .vf-bot button) { pointer-events:auto; padding:5px 10px; font-size:12px; }
    :where(.vf-lens-pills) { display:flex; gap:4px; pointer-events:auto; }
    :where(.vf-lens-btn.on) { background:rgba(156,74,30,.92); border-color:#f0c470; color:#fff7de; font-weight:bold; }
    :where(.vf-frame) { position:relative; flex:1; margin:10px 0; border:1px solid rgba(240,224,184,.35); }
    :where(.vf-grid-h1, .vf-grid-h2) { position:absolute; left:0; right:0; height:1px; background:rgba(240,224,184,.16); }
    :where(.vf-grid-h1) { top:33.33%; }
    :where(.vf-grid-h2) { top:66.66%; }
    :where(.vf-grid-v1, .vf-grid-v2) { position:absolute; top:0; bottom:0; width:1px; background:rgba(240,224,184,.16); }
    :where(.vf-grid-v1) { left:33.33%; }
    :where(.vf-grid-v2) { left:66.66%; }
    :where(.vf-reticle) { position:absolute; left:50%; top:50%; width:64px; height:64px; transform:translate(-50%,-50%); border:1.5px solid rgba(240,224,184,.65); border-radius:50%; display:flex; align-items:center; justify-content:center; }
    :where(.vf-reticle.locked) { border-color:#8fe08a; box-shadow:0 0 12px rgba(143,224,138,.45); }
    :where(.vf-lock-lbl) { position:absolute; top:calc(100% + 6px); left:50%; transform:translateX(-50%); white-space:nowrap; font-size:11px; padding:2px 6px; border-radius:4px; background:rgba(10,12,18,.82); color:#f3ead2; }
    :where(.vf-flash) { position:fixed; inset:0; z-index:22; background:#fff8e6; opacity:0; pointer-events:none; transition:opacity .18s ease-out; }
    :where(.vf-flash.on) { opacity:0.85; transition:none; }
  `;
  document.head.appendChild(style);
  baseStylesInjected = true;
}

export interface CrossReferenceResult {
  id: string;
  cards: [string, string];
  verdict: EvidenceVerdict;
  verdictLabel: '兩份紀錄吻合' | '說法存在出入' | '尚無旁證';
  summary: string;
  diary?: string;
  set?: string;
}

const VERDICT_LABELS: Record<EvidenceVerdict, CrossReferenceResult['verdictLabel']> = {
  corroborated: '兩份紀錄吻合',
  contradiction: '說法存在出入',
  unverified: '尚無旁證',
};

/** Resolve EvidenceCard objects for all collected evidence/photo IDs on a save. */
export function resolveCollectedCards(ch: Chapter, state: SaveState): EvidenceCard[] {
  const collected = new Set<string>([...(state.evidence ?? []), ...(state.photos ?? [])]);
  const out: EvidenceCard[] = [];
  const findInCatalogs = (id: string): EvidenceCard | undefined => {
    if (ch.evidenceCatalog?.[id]) return ch.evidenceCatalog[id];
    for (const c of Object.values(CH)) {
      if (c.evidenceCatalog?.[id]) return c.evidenceCatalog[id];
    }
    const photoTarget = ch.photoTargets?.find(p => p.evidenceId === id || p.id === id);
    if (photoTarget) {
      return {
        id,
        kind: 'photo',
        title: photoTarget.label,
        summary: `於「${SCENE_META[photoTarget.scene]?.id ?? photoTarget.scene}」拍下的 35mm 底片紀錄。`,
        dayKey: undefined,
        chapterId: ch.chapter,
        event: photoTarget.event,
        route: state.viewpoint ?? viewpointOfChapter(ch.chapter),
        confidence: 'testimony',
      };
    }
    return undefined;
  };

  for (const id of collected) {
    const found = findInCatalogs(id);
    if (found) {
      out.push(found);
    } else {
      out.push({
        id,
        kind: (state.photos ?? []).includes(id) ? 'photo' : 'witness',
        title: id,
        summary: '已收錄於隨身筆記的見聞片段。',
        chapterId: ch.chapter,
        route: state.viewpoint ?? viewpointOfChapter(ch.chapter),
        confidence: 'testimony',
      });
    }
  }
  return out;
}

/** Pure cross-reference evaluator: pairs 2 cards into a neutral corroborated / contradiction / unverified deduction. */
export function evaluateEvidencePair(
  cardA: EvidenceCard,
  cardB: EvidenceCard,
  ch?: Chapter
): CrossReferenceResult {
  const pairIdSorted = [cardA.id, cardB.id].sort().join('__');
  const authored = ch?.evidencePairs?.find(
    p => (p.cards[0] === cardA.id && p.cards[1] === cardB.id) || (p.cards[0] === cardB.id && p.cards[1] === cardA.id)
  );
  if (authored) {
    return {
      id: authored.id,
      cards: [cardA.id, cardB.id],
      verdict: authored.verdict,
      verdictLabel: VERDICT_LABELS[authored.verdict] ?? '尚無旁證',
      summary: authored.summary,
      diary: authored.diary,
      set: authored.set,
    };
  }

  const evA = cardA.event ? EVENTS[cardA.event] : undefined;
  const evB = cardB.event ? EVENTS[cardB.event] : undefined;
  const isUncertainA = cardA.kind === 'rumor' || cardA.confidence === 'uncertain' || evA?.kind === 'fiction';
  const isUncertainB = cardB.kind === 'rumor' || cardB.confidence === 'uncertain' || evB?.kind === 'fiction';

  const sameEvent = Boolean(cardA.event && cardB.event && cardA.event === cardB.event);
  const sameDay = Boolean(cardA.dayKey && cardB.dayKey && cardA.dayKey === cardB.dayKey);
  const sharedTags = (cardA.tags ?? []).some(t => (cardB.tags ?? []).includes(t));
  const related = sameEvent || sameDay || sharedTags;

  if (isUncertainA && isUncertainB) {
    return {
      id: `pair_${pairIdSorted}`,
      cards: [cardA.id, cardB.id],
      verdict: 'unverified',
      verdictLabel: '尚無旁證',
      summary: '兩份線索皆屬街巷聽聞或未經證實的片段，暫缺獨立文獻或現場影像可交叉印證。',
    };
  }

  if ((isUncertainA !== isUncertainB) && related) {
    return {
      id: `pair_${pairIdSorted}`,
      cards: [cardA.id, cardB.id],
      verdict: 'contradiction',
      verdictLabel: '說法存在出入',
      summary: '傳聞描述與公開文獻或現場目擊存在落差；當下無法將兩者畫上等號，需保留各自出處。',
    };
  }

  if (!isUncertainA && !isUncertainB && related) {
    return {
      id: `pair_${pairIdSorted}`,
      cards: [cardA.id, cardB.id],
      verdict: 'corroborated',
      verdictLabel: '兩份紀錄吻合',
      summary: '兩份不同來源的紀錄在時間與現場脈絡上彼此吻合，有助於還原當日所見。',
    };
  }

  return {
    id: `pair_${pairIdSorted}`,
    cards: [cardA.id, cardB.id],
    verdict: 'unverified',
    verdictLabel: '尚無旁證',
    summary: '這兩則紀錄涉及不同時段或線索脈絡，尚無足夠旁證可以彼此證實或推翻。',
  };
}

function qualitativeRel(val: number): string {
  if (val >= 3) return '深厚互信';
  if (val >= 1) return '熟識友善';
  if (val <= -1) return '意見分歧・保持距離';
  return '曾經照面';
}

/** Build the 3-tab Diary + Evidence Dossier & Cross-Reference Tray + Character Context modal HTML. */
export function renderDiaryModalHtml(
  ch: Chapter,
  state: SaveState,
  ledger?: WorldTimelineLedger,
  onPair?: (result: CrossReferenceResult) => void
): string {
  void onPair;
  let activeLedger = ledger;
  if (!activeLedger) {
    try {
      activeLedger = loadLedger();
    } catch {
      activeLedger = undefined;
    }
  }

  const diary = state.diary ?? [];
  const diaryListHtml = diary.length
    ? `<ol>${diary.map(d => `<li>${esc(d)}</li>`).join('')}</ol>`
    : '<p class="small">還沒有寫下什麼。</p>';

  const keepsakes = [...new Set([...(state.keepsakes ?? []), ...(state.items ?? [])])];
  const keepsakesHtml = keepsakes.length
    ? `<p class="small">隨身留存與攜帶物件：${keepsakes.map(k => esc(ITEM_LABELS[k] ?? k)).join('、')}</p>`
    : '';

  const cards = resolveCollectedCards(ch, state);
  const dossiers = state.dossiers ?? [];
  const cardsHtml = cards.length
    ? `<div class="ev-grid">${cards.map(c =>
        `<button type="button" class="ev-card-btn" data-card-id="${esc(c.id)}">${renderEvidenceCardHtml(c, { paired: dossiers.some(d => d.includes(c.id)) })}</button>`
      ).join('')}</div>`
    : '<p class="small">目前尚未收錄證據線索卡。在對話、取景攝影、閱讀報刊或收聽短波時可收錄線索並於此比對。</p>';

  const savedDossiersHtml = dossiers.length
    ? `<div class="ev-saved-dossiers"><h4>已整理的比對筆記</h4><ul>${dossiers.map(dId => {
        const pair = ch.evidencePairs?.find(p => p.id === dId);
        if (!pair) return `<li class="small">${esc(dId)}</li>`;
        const lbl = VERDICT_LABELS[pair.verdict] ?? pair.verdictLabel;
        return `<li><span class="tag ${pair.verdict === 'corroborated' ? 'documented' : pair.verdict === 'contradiction' ? 'testimony' : 'uncertain'}">${esc(lbl)}</span> ${esc(pair.summary)}</li>`;
      }).join('')}</ul></div>`
    : '';

  const arcRows = summarizeCharactersForViewpoint(state)
    .map(c => `<li><strong>${esc(c.name)}：</strong>${esc(c.status)}</li>`)
    .join('');

  const chChars = Object.entries(ch.characters ?? {})
    .filter(([id]) => id !== 'narr' && id !== 'me')
    .map(([id, info]) => {
      const relVal = state.rel?.[id] ?? 0;
      const hasMet = relVal !== 0 || (state.flags ?? []).some(f => f.includes(id));
      const relLabel = hasMet ? qualitativeRel(relVal) : '未深談';
      return `<li><strong>${esc(info.name)}</strong>（${esc(info.role)}）— <span class="tag ${relVal < 0 ? 'uncertain' : relVal > 0 ? 'documented' : 'testimony'}">${esc(relLabel)}</span></li>`;
    })
    .join('');

  const seenCount = activeLedger?.seenEvents?.length ?? 0;
  const capturedPhotos = state.capturedPhotos ?? [];

  return `<h2>隨身筆記與線索整理</h2>
    <div class="diary-tabs" role="tablist" aria-label="筆記本分頁">
      <button type="button" class="diary-tab active" data-diary-tab="diary">日記</button>
      <button type="button" class="diary-tab" data-diary-tab="evidence">證據線索 &amp; 比對盤（${cards.length}）</button>
      <button type="button" class="diary-tab" data-diary-tab="characters">人物脈絡</button>
      <button type="button" class="diary-tab" data-diary-tab="darkroom">暗房底片（${capturedPhotos.length}）</button>
    </div>

    <section class="diary-pane" data-diary-pane="diary">
      ${keepsakesHtml}
      ${diaryListHtml}
    </section>

    <section class="diary-pane" data-diary-pane="evidence" hidden>
      <p class="small">選取任意兩張線索卡放進比對盤，可交叉檢視紀錄是否吻合（結論僅呈現「兩份紀錄吻合」、「說法存在出入」或「尚無旁證」，不作是非評分）。${seenCount ? `（已紀錄史料條目：${seenCount} 則）` : ''}</p>
      <div class="ev-tray" id="ev-tray">
        <div class="small"><strong>交叉比對盤</strong>（點擊下方卡片選取兩份紀錄）</div>
        <div class="ev-slots">
          <div class="ev-slot" id="ev-slot-a">線索甲：未選擇</div>
          <div class="ev-slot" id="ev-slot-b">線索乙：未選擇</div>
        </div>
        <div class="row" style="justify-content:flex-start;margin-top:6px">
          <button type="button" id="ev-compare-btn" disabled>比對兩份紀錄</button>
          <button type="button" id="ev-clear-btn">清空比對盤</button>
        </div>
        <div class="ev-deduction" id="ev-deduction-out" hidden></div>
      </div>
      ${cardsHtml}
      ${savedDossiersHtml}
    </section>

    <section class="diary-pane" data-diary-pane="characters" hidden>
      <h3>本章人物</h3>
      <ul>${chChars || '<li class="small">本章無其他登場人物。</li>'}</ul>
      <h3>整體人物脈絡</h3>
      <ul>${arcRows}</ul>
    </section>

    <section class="diary-pane" data-diary-pane="darkroom" hidden>
      ${renderDarkroomHtml(capturedPhotos)}
    </section>`;
}

/** Attach interactive tab switching and 2-card Evidence Comparison behavior onto a rendered Diary modal host. */
export function bindDiaryModal(
  container: HTMLElement,
  ch: Chapter,
  state: SaveState,
  ledger?: WorldTimelineLedger,
  onPair?: (result: CrossReferenceResult) => void,
  onPhotosChange?: () => void
): () => void {
  ensureModalBaseStyles();
  const cards = resolveCollectedCards(ch, state);
  const cardMap = new Map(cards.map(c => [c.id, c]));
  const selected: string[] = [];
  const drCleanup = bindDarkroomModal(container, state.capturedPhotos ?? [], onPhotosChange);

  const tabs = [...container.querySelectorAll<HTMLButtonElement>('[data-diary-tab]')];
  const panes = [...container.querySelectorAll<HTMLElement>('[data-diary-pane]')];
  const cardBtns = [...container.querySelectorAll<HTMLButtonElement>('.ev-card-btn[data-card-id]')];
  const slotA = container.querySelector<HTMLElement>('#ev-slot-a');
  const slotB = container.querySelector<HTMLElement>('#ev-slot-b');
  const compareBtn = container.querySelector<HTMLButtonElement>('#ev-compare-btn');
  const clearBtn = container.querySelector<HTMLButtonElement>('#ev-clear-btn');
  const outEl = container.querySelector<HTMLElement>('#ev-deduction-out');

  const syncTray = () => {
    const a = selected[0] ? cardMap.get(selected[0]) : undefined;
    const b = selected[1] ? cardMap.get(selected[1]) : undefined;
    if (slotA) slotA.textContent = a ? `線索甲：${a.title}` : '線索甲：未選擇';
    if (slotB) slotB.textContent = b ? `線索乙：${b.title}` : '線索乙：未選擇';
    if (compareBtn) compareBtn.disabled = !(a && b);
    cardBtns.forEach(btn => {
      const cardEl = btn.querySelector('.ev-card');
      cardEl?.classList.toggle('selected', selected.includes(btn.dataset.cardId ?? ''));
    });
  };

  for (const tab of tabs) {
    tab.onclick = () => {
      const target = tab.dataset.diaryTab;
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      panes.forEach(p => { p.hidden = p.dataset.diaryPane !== target; });
      const card = container.closest('.card') as HTMLElement | null;
      if (card) card.scrollTop = 0;
    };
  }

  for (const btn of cardBtns) {
    btn.onclick = () => {
      const id = btn.dataset.cardId;
      if (!id) return;
      const idx = selected.indexOf(id);
      if (idx >= 0) {
        selected.splice(idx, 1);
      } else {
        if (selected.length >= 2) selected.shift();
        selected.push(id);
      }
      syncTray();
    };
  }

  if (clearBtn) {
    clearBtn.onclick = () => {
      selected.length = 0;
      if (outEl) outEl.hidden = true;
      syncTray();
    };
  }

  if (compareBtn) {
    compareBtn.onclick = () => {
      const a = selected[0] ? cardMap.get(selected[0]) : undefined;
      const b = selected[1] ? cardMap.get(selected[1]) : undefined;
      if (!a || !b) return;
      const res = evaluateEvidencePair(a, b, ch);
      if (outEl) {
        const tagCls = res.verdict === 'corroborated' ? 'documented' : res.verdict === 'contradiction' ? 'testimony' : 'uncertain';
        outEl.hidden = false;
        outEl.innerHTML = `<p><span class="tag ${tagCls}">${esc(res.verdictLabel)}</span> <strong>${esc(a.title)} × ${esc(b.title)}</strong></p><p class="small">${esc(res.summary)}</p>`;
      }
      onPair?.(res);
    };
  }

  void ledger;
  syncTray();
  return () => {
    drCleanup();
    tabs.forEach(t => { t.onclick = null; });
    cardBtns.forEach(b => { b.onclick = null; });
    if (clearBtn) clearBtn.onclick = null;
    if (compareBtn) compareBtn.onclick = null;
  };
}

/** Render and bind the 4-tab Diary, Evidence Dossier & Darkroom modal in a single call. */
export function mountDiaryModal(
  container: HTMLElement,
  ch: Chapter,
  state: SaveState,
  ledger?: WorldTimelineLedger,
  onPair?: (result: CrossReferenceResult) => void,
  onPhotosChange?: () => void
): () => void {
  container.innerHTML = renderDiaryModalHtml(ch, state, ledger, onPair);
  return bindDiaryModal(container, ch, state, ledger, onPair, onPhotosChange);
}

interface CartogramNode {
  id: SceneId;
  label: string;
  x: number;
  y: number;
}

// Schematic 1989 Beijing geography (Haidian -> Xidan/Muxidi -> Tiananmen/East Chang'an, not modern OSM).
const CARTOGRAM_NODES: CartogramNode[] = [
  { id: 'campus', label: '北大校園', x: 76, y: 42 },
  { id: 'aftermath', label: '六月五日校園', x: 146, y: 42 },
  { id: 'factory', label: '機床二廠', x: 76, y: 88 },
  { id: 'factory_dawn', label: '廠房清晨', x: 146, y: 88 },
  { id: 'street', label: '海淀街道', x: 175, y: 126 },
  { id: 'march', label: '夜間遊行長街', x: 256, y: 126 },
  { id: 'march_day', label: '日間遊行長街', x: 256, y: 92 },
  { id: 'courtyard', label: '海淀大雜院', x: 112, y: 158 },
  { id: 'courtyard_day', label: '大雜院日間', x: 112, y: 194 },
  { id: 'hutong', label: '紅門胡同口', x: 186, y: 194 },
  { id: 'street_aftermath', label: '六月街角', x: 186, y: 230 },
  { id: 'overpass', label: '木樨地立交', x: 266, y: 172 },
  { id: 'hospital_gate', label: '醫院外門', x: 266, y: 220 },
  { id: 'blockade', label: '西單電車路障', x: 344, y: 162 },
  { id: 'siheyuan_room', label: '西單正房', x: 344, y: 206 },
  { id: 'morning_market', label: '胡同早市', x: 344, y: 242 },
  { id: 'xinhua_gate', label: '新華門前', x: 406, y: 162 },
  { id: 'changan', label: '長安街', x: 472, y: 144 },
  { id: 'changan_rain', label: '雨夜長安街', x: 472, y: 104 },
  { id: 'statue', label: '廣場北側雕像', x: 472, y: 186 },
  { id: 'square', label: '天安門廣場', x: 472, y: 224 },
  { id: 'camp', label: '廣場帳篷營地', x: 540, y: 224 },
  { id: 'beijing_hotel_balcony', label: '北京飯店陽台', x: 562, y: 144 },
  { id: 'newsroom', label: '報社編輯部', x: 562, y: 88 },
];

const ALL_VIEWPOINTS: ViewpointId[] = ['student', 'worker', 'journalist', 'resident'];

/** Build 1989 Schematic City Cartogram + date × route Temporal Switcher HTML. */
export function renderMapTimelineModalHtml(
  routes: Record<ViewpointId, RouteChapterMeta[]>,
  activeVp: ViewpointId,
  activeCh: string,
  state: SaveState,
  ledger?: WorldTimelineLedger
): string {
  let activeLedger = ledger;
  if (!activeLedger) {
    try {
      activeLedger = loadLedger();
    } catch {
      activeLedger = undefined;
    }
  }
  let startSnapshots: Record<string, SaveState> = {};
  try {
    startSnapshots = starts();
  } catch {
    startSnapshots = {};
  }

  const chapterObj = CH[activeCh];
  const chapterScenes = new Set<SceneId>();
  if (chapterObj) {
    if (chapterObj.startScene) chapterScenes.add(chapterObj.startScene);
    for (const s of Object.keys(chapterObj.labels ?? {})) chapterScenes.add(s as SceneId);
    for (const h of chapterObj.hotspots ?? []) chapterScenes.add(h.scene);
  } else {
    chapterScenes.add(state.scene);
  }

  const svgNodes = CARTOGRAM_NODES.map(n => {
    const isCurrent = n.id === state.scene;
    const isChapterScene = chapterScenes.has(n.id);
    if (!isChapterScene && !isCurrent) {
      return `<g class="map-node dim" opacity="0.32">
        <circle cx="${n.x}" cy="${n.y}" r="4.2" fill="#6b5c48" />
        <text x="${n.x}" y="${n.y + 12}" text-anchor="middle" fill="#8d846f" font-size="8.5">${esc(n.label)}</text>
      </g>`;
    }
    const fill = isCurrent ? '#e9c27a' : '#9cc3e6';
    const stroke = isCurrent ? '#fff2cf' : '#587494';
    return `<g class="map-node active${isCurrent ? ' current' : ''}" data-travel-scene="${esc(n.id)}">
      ${isCurrent ? `<circle cx="${n.x}" cy="${n.y}" r="10.5" fill="none" stroke="#e9c27a" stroke-width="1.2" opacity="0.7" />` : ''}
      <circle cx="${n.x}" cy="${n.y}" r="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />
      <text x="${n.x}" y="${n.y - 10}" text-anchor="middle" fill="${isCurrent ? '#fff5d6' : '#dfe7f2'}" font-size="10" font-weight="${isCurrent ? 'bold' : 'normal'}">${esc(n.label)}</text>
    </g>`;
  }).join('');

  const hubButtons = [...chapterScenes].map(sid => {
    const label = chapterObj?.labels?.[sid] ?? CARTOGRAM_NODES.find(n => n.id === sid)?.label ?? sid;
    const isCur = sid === state.scene;
    return `<button type="button" class="map-hub-btn${isCur ? ' current' : ''}" data-travel-scene="${esc(sid)}">${isCur ? '📍 ' : ''}${esc(label)}</button>`;
  }).join('');

  // Collect all unique calendar dates across routes in chronological order.
  const dateSet = new Set<string>();
  for (const vp of ALL_VIEWPOINTS) {
    for (const r of routes[vp] ?? []) dateSet.add(r.date);
  }
  const dates = [...dateSet].sort();

  const matrixRows = dates.map(date => {
    const cells = ALL_VIEWPOINTS.map(vp => {
      const meta = (routes[vp] ?? []).find(r => r.date === date);
      if (!meta) return '<td class="tl-cell empty"><span class="small">—</span></td>';

      const isActive = vp === activeVp && meta.id === activeCh;
      const rec = (vp === activeVp && meta.id === state.chapter && state.ending)
        ? { ending: state.ending, taken: state.taken ?? [] }
        : activeLedger?.routeRecords?.[vp]?.[meta.id]
          ?? (vp === activeVp ? state.history?.[meta.id] : undefined);
      const hasSnap = Boolean(startSnapshots[meta.id]);
      const drift = checkSnapshotDrift(vp, meta.id, meta.dayKey);

      let statusBadge = '<span class="small">尚未展開</span>';
      if (isActive) statusBadge = '<span class="tag documented">當前章節</span>';
      else if (rec?.ending) statusBadge = '<span class="tag documented">已完成</span>';
      else if (hasSnap) statusBadge = '<span class="tag testimony">有開頭快照</span>';
      else if (!meta.playable) statusBadge = '<span class="small">待開放</span>';

      const jumpBtn = meta.playable
        ? `<button type="button" class="tl-jump-btn" data-jump-vp="${vp}" data-jump-ch="${esc(meta.id)}">${isActive ? '所在章節' : hasSnap || rec?.ending ? '跳轉快照' : '前往此章'}</button>`
        : '';

      const driftHtml = drift.hasDrift
        ? `<div class="drift-box" data-drift-ch="${esc(meta.id)}">
            <div>世界線自 ${esc(drift.staleFromDay ?? meta.dayKey)} 起已有新因果</div>
            <div class="tl-cell-actions">
              <button type="button" data-drift-action="sync" data-jump-vp="${vp}" data-jump-ch="${esc(meta.id)}">匯入新世界線因果</button>
              <button type="button" data-drift-action="keep" data-jump-vp="${vp}" data-jump-ch="${esc(meta.id)}">保留原紀錄</button>
            </div>
          </div>`
        : '';

      return `<td class="tl-cell${isActive ? ' active' : ''}" data-vp="${vp}" data-ch="${esc(meta.id)}">
        <div><strong>${esc(meta.title.zh)}</strong></div>
        <div>${statusBadge}</div>
        <div class="tl-cell-actions">${jumpBtn}</div>
        ${driftHtml}
      </td>`;
    }).join('');

    return `<tr><th scope="row">${esc(date)}</th>${cells}</tr>`;
  }).join('');

  const commits = Object.values(activeLedger?.commits ?? {}).filter(c => c.val);
  const commitsSummary = commits.length
    ? `<p class="small">已記錄跨線交會：${commits.map(c => esc(WORLD_FLAGS[c.id]?.description ?? c.id)).join('；')}</p>`
    : '<p class="small">尚未觸發跨線交會紀錄；切換體驗不同視角並於相同日期留下行動後，因果會於此匯聚。</p>';

  return `<h2>1989 街區示意圖與多線時間軸</h2>
    <div class="map-subtabs" role="tablist" aria-label="地圖與時間軸檢視">
      <button type="button" class="map-subtab active" data-map-tab="both">全景檢視</button>
      <button type="button" class="map-subtab" data-map-tab="cartogram">1989 街區示意圖</button>
      <button type="button" class="map-subtab" data-map-tab="timeline">多線時間軸矩陣</button>
    </div>

    <section class="map-pane" data-map-pane="cartogram">
      <p class="small">依 1989 年海淀—西單—長安街與天安門廣場歷史空間方位繪製（非現代街道比例）。高亮節點為本章可抵達地點。</p>
      <div class="map-svg-wrap">
        <svg class="map-svg" viewBox="0 0 640 270" role="img" aria-label="1989 北京街區示意圖">
          <rect x="0" y="0" width="640" height="270" fill="#0d1018" />
          <line x1="30" y1="154" x2="615" y2="154" stroke="#4c3e2c" stroke-width="5" />
          <line x1="76" y1="42" x2="180" y2="154" stroke="#36322c" stroke-width="3" />
          <rect x="442" y="170" width="66" height="72" fill="rgba(200,175,130,0.08)" stroke="#625139" stroke-width="1.2" />
          <text x="64" y="146" fill="#8b7d65" font-size="9">海淀方向</text>
          <text x="344" y="143" fill="#8b7d65" font-size="9" text-anchor="middle">西單・復外大街</text>
          <text x="475" y="166" fill="#c9b78f" font-size="9.5" text-anchor="middle">天安門廣場</text>
          ${svgNodes}
        </svg>
      </div>
      <div class="map-hub-list">${hubButtons}</div>
    </section>

    <section class="map-pane" data-map-pane="timeline">
      <h3>四線編年時間軸（日期 × 視角）</h3>
      ${commitsSummary}
      <div class="tl-matrix-scroll">
        <table class="tl-matrix">
          <thead>
            <tr>
              <th>日期</th>
              <th>${esc(VIEWPOINT_LABELS.student.role)}（${esc(VIEWPOINT_LABELS.student.lead)}）</th>
              <th>${esc(VIEWPOINT_LABELS.worker.role)}（${esc(VIEWPOINT_LABELS.worker.lead)}）</th>
              <th>${esc(VIEWPOINT_LABELS.journalist.role)}（${esc(VIEWPOINT_LABELS.journalist.lead)}）</th>
              <th>${esc(VIEWPOINT_LABELS.resident.role)}（${esc(VIEWPOINT_LABELS.resident.lead)}）</th>
            </tr>
          </thead>
          <tbody>${matrixRows}</tbody>
        </table>
      </div>
    </section>`;
}

/** Bind interactive Cartogram travel and Timeline Snapshot / Drift hooks onto a Map/Timeline container. */
export function bindMapTimelineModal(
  container: HTMLElement,
  handlers: {
    onTravelScene?: (sceneId: SceneId) => void;
    onJumpChapter?: (vp: ViewpointId, chapterId: string) => void;
    onResolveDrift?: (vp: ViewpointId, chapterId: string, action: 'sync' | 'keep') => void;
  }
): () => void {
  ensureModalBaseStyles();
  const subtabs = [...container.querySelectorAll<HTMLButtonElement>('[data-map-tab]')];
  const panes = [...container.querySelectorAll<HTMLElement>('[data-map-pane]')];
  const travelEls = [...container.querySelectorAll<HTMLElement>('[data-travel-scene]')];
  const jumpBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-jump-ch]:not([data-drift-action])')];
  const driftBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-drift-action]')];

  for (const tab of subtabs) {
    tab.onclick = () => {
      const mode = tab.dataset.mapTab ?? 'both';
      subtabs.forEach(t => t.classList.toggle('active', t === tab));
      panes.forEach(p => {
        p.hidden = mode !== 'both' && p.dataset.mapPane !== mode;
      });
    };
  }

  for (const el of travelEls) {
    el.onclick = () => {
      const sid = el.dataset.travelScene as SceneId | undefined;
      if (sid) handlers.onTravelScene?.(sid);
    };
  }

  for (const btn of jumpBtns) {
    btn.onclick = () => {
      const vp = btn.dataset.jumpVp as ViewpointId | undefined;
      const chId = btn.dataset.jumpCh;
      if (vp && chId) handlers.onJumpChapter?.(vp, chId);
    };
  }

  for (const btn of driftBtns) {
    btn.onclick = () => {
      const vp = btn.dataset.jumpVp as ViewpointId | undefined;
      const chId = btn.dataset.jumpCh;
      const action = btn.dataset.driftAction as 'sync' | 'keep' | undefined;
      if (vp && chId && action) handlers.onResolveDrift?.(vp, chId, action);
    };
  }

  return () => {
    subtabs.forEach(t => { t.onclick = null; });
    travelEls.forEach(el => { el.onclick = null; });
    jumpBtns.forEach(b => { b.onclick = null; });
    driftBtns.forEach(b => { b.onclick = null; });
  };
}

/** Render and bind the 1989 Cartogram & Temporal Switcher modal in a single call. */
export function mountMapTimelineModal(
  container: HTMLElement,
  routes: Record<ViewpointId, RouteChapterMeta[]>,
  activeVp: ViewpointId,
  activeCh: string,
  state: SaveState,
  ledger: WorldTimelineLedger | undefined,
  handlers: {
    onTravelScene?: (sceneId: SceneId) => void;
    onJumpChapter?: (vp: ViewpointId, chapterId: string) => void;
    onResolveDrift?: (vp: ViewpointId, chapterId: string, action: 'sync' | 'keep') => void;
  }
): () => void {
  container.innerHTML = renderMapTimelineModalHtml(routes, activeVp, activeCh, state, ledger);
  return bindMapTimelineModal(container, handlers);
}

export interface ShortwaveStation {
  id: string;
  freqMhz: number;
  label: string;
  band?: string;
  transcript: string;
  evidenceId?: string;
  confidence?: Confidence;
  isRumor?: boolean;
}

const SW_MIN_MHZ = 4.8;
const SW_MAX_MHZ = 15.5;

/** Mount a lightweight 4.8–15.5 MHz Shortwave Radio Dial Tuner for Resident investigation. */
export function mountShortwaveTuner(
  container: HTMLElement,
  stations: ShortwaveStation[],
  onTune: (station: ShortwaveStation | null, freqMhz: number, signalStrength: number) => void
): () => void {
  ensureModalBaseStyles();
  const clampFreq = (f: number) => Math.max(SW_MIN_MHZ, Math.min(SW_MAX_MHZ, Math.round(f * 20) / 20));
  let curFreq = stations[0] ? clampFreq(stations[0].freqMhz - 0.6) : 7.2;

  const pctFor = (f: number) => ((f - SW_MIN_MHZ) / (SW_MAX_MHZ - SW_MIN_MHZ)) * 100;
  const pipsHtml = stations.map(s =>
    `<span title="${esc(s.freqMhz.toFixed(2))} MHz" style="position:absolute;left:${pctFor(s.freqMhz).toFixed(2)}%;top:3px;bottom:3px;width:2px;background:rgba(156,210,248,0.65);box-shadow:0 0 4px rgba(130,200,255,0.6)"></span>`
  ).join('');
  const meterMarksHtml = [
    [5.0, '49m'],
    [7.2, '41m'],
    [9.6, '31m'],
    [11.8, '25m'],
    [13.8, '22m'],
    [15.2, '19m'],
  ].map(([f, lbl]) =>
    `<b class="sw-band-mark" style="left:${pctFor(Number(f)).toFixed(2)}%">${lbl}</b>`
  ).join('');

  container.innerHTML = `
    <div class="sw-tuner sw-bakelite" role="region" aria-label="短波收音機調頻">
      <div class="chron-head">
        <strong>牡丹牌・晶體管短波收音機（4.8 – 15.5 MHz）</strong>
        <div class="sw-status-right">
          <div class="sw-magic-eye" id="sw-magic-eye" aria-label="電台訊號調諧貓眼"><div class="sw-eye-core"></div></div>
          <span class="cine-stamp" id="sw-freq-readout">${curFreq.toFixed(2)} MHz</span>
        </div>
      </div>
      <div class="sw-bakelite-grid">
        <div class="sw-speaker" aria-hidden="true">
          <span>PEONY · 1989</span>
        </div>
        <div class="sw-chassis">
          <div class="sw-scale sw-dial-glass">
            ${meterMarksHtml}
            ${pipsHtml}
            <div class="sw-needle" id="sw-needle" style="left:${pctFor(curFreq).toFixed(2)}%"></div>
          </div>
          <div class="sw-controls">
            <button type="button" id="sw-down">-0.1</button>
            <input id="sw-slider" type="range" min="${SW_MIN_MHZ}" max="${SW_MAX_MHZ}" step="0.05" value="${curFreq.toFixed(2)}" aria-label="短波頻率旋鈕" />
            <button type="button" id="sw-up">+0.1</button>
            <button type="button" class="sw-knob" id="sw-knob" aria-label="左右拖曳旋轉調諧飛輪" title="按住左右拖曳微調頻率"><span class="sw-knob-dot"></span></button>
          </div>
          <div class="sw-sig-bar"><div class="sw-sig-fill" id="sw-sig-fill"></div></div>
          <div id="sw-station-title" style="font-weight:bold;font-size:14px"></div>
          <p id="sw-transcript" class="small" style="margin:6px 0;min-height:40px"></p>
          <div class="row" style="justify-content:flex-start;margin-top:6px">
            <button type="button" id="sw-confirm" disabled>記錄此段電台訊息</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const readoutEl = container.querySelector<HTMLElement>('#sw-freq-readout')!;
  const needleEl = container.querySelector<HTMLElement>('#sw-needle')!;
  const sliderEl = container.querySelector<HTMLInputElement>('#sw-slider')!;
  const downBtn = container.querySelector<HTMLButtonElement>('#sw-down')!;
  const upBtn = container.querySelector<HTMLButtonElement>('#sw-up')!;
  const knobEl = container.querySelector<HTMLButtonElement>('#sw-knob')!;
  const eyeEl = container.querySelector<HTMLElement>('#sw-magic-eye')!;
  const sigFill = container.querySelector<HTMLElement>('#sw-sig-fill')!;
  const titleEl = container.querySelector<HTMLElement>('#sw-station-title')!;
  const transcriptEl = container.querySelector<HTMLElement>('#sw-transcript')!;
  const confirmBtn = container.querySelector<HTMLButtonElement>('#sw-confirm')!;

  let lastMatchedId: string | null = null;
  let knobDragging = false;
  let knobStartX = 0;
  let knobStartFreq = curFreq;

  const evaluateAt = (freq: number): { matched: ShortwaveStation | null; near: ShortwaveStation | null; bestDiff: number; strength: number } => {
    let nearest: ShortwaveStation | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const s of stations) {
      const diff = Math.abs(freq - s.freqMhz);
      if (diff < bestDiff) {
        bestDiff = diff;
        nearest = s;
      }
    }
    if (!nearest) return { matched: null, near: null, bestDiff: 10, strength: 0.08 };
    const strength = Math.max(0.06, Math.min(1, Math.exp(-(bestDiff * bestDiff) / 0.018)));
    return {
      matched: bestDiff <= 0.2 ? nearest : null,
      near: bestDiff <= 0.58 ? nearest : null,
      bestDiff,
      strength,
    };
  };

  const renderFreq = (notifyAlways: boolean) => {
    readoutEl.textContent = `${curFreq.toFixed(2)} MHz`;
    needleEl.style.left = `${pctFor(curFreq).toFixed(2)}%`;
    sliderEl.value = curFreq.toFixed(2);
    knobEl.style.transform = `rotate(${((curFreq - SW_MIN_MHZ) * 140).toFixed(1)}deg)`;
    const { matched, near, strength } = evaluateAt(curFreq);
    sigFill.style.width = `${Math.round(strength * 100)}%`;
    eyeEl.style.setProperty('--sw-eye', strength.toFixed(2));
    eyeEl.classList.toggle('locked', Boolean(matched));

    if (matched) {
      titleEl.textContent = `${matched.label}${matched.band ? `（${matched.band}）` : ''}`;
      transcriptEl.textContent = matched.transcript;
      confirmBtn.disabled = false;
    } else if (near) {
      const mid = Math.min(near.transcript.length, Math.max(8, Math.floor(near.transcript.length * 0.48)));
      const snippet = near.transcript.slice(0, mid);
      titleEl.textContent = `訊號飄移干擾（鄰近 ${near.freqMhz.toFixed(2)} MHz）……`;
      transcriptEl.textContent = `……沙沙……「${snippet}……」—— 電台載波尚不穩定，請再微調旋鈕對準藍線。`;
      confirmBtn.disabled = true;
    } else {
      titleEl.textContent = '沙沙電流雜音……';
      transcriptEl.textContent = '緩慢微調旋鈕或拖曳右側飛輪至藍色刻度附近以鎖定清晰訊號。';
      confirmBtn.disabled = true;
    }

    const matchedId = matched?.id ?? null;
    if (notifyAlways || matchedId !== lastMatchedId) {
      lastMatchedId = matchedId;
      onTune(matched, curFreq, strength);
    }
  };

  const onKnobDown = (e: PointerEvent) => {
    knobDragging = true;
    knobStartX = e.clientX;
    knobStartFreq = curFreq;
    try { knobEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onKnobMove = (e: PointerEvent) => {
    if (!knobDragging) return;
    curFreq = clampFreq(knobStartFreq + (e.clientX - knobStartX) * 0.014);
    renderFreq(false);
  };
  const onKnobUp = () => {
    if (!knobDragging) return;
    knobDragging = false;
    renderFreq(true);
  };

  knobEl.addEventListener('pointerdown', onKnobDown);
  window.addEventListener('pointermove', onKnobMove);
  window.addEventListener('pointerup', onKnobUp);

  sliderEl.oninput = () => {
    curFreq = clampFreq(Number(sliderEl.value));
    renderFreq(false);
  };
  sliderEl.onchange = () => {
    curFreq = clampFreq(Number(sliderEl.value));
    renderFreq(true);
  };
  downBtn.onclick = () => {
    curFreq = clampFreq(curFreq - 0.1);
    renderFreq(true);
  };
  upBtn.onclick = () => {
    curFreq = clampFreq(curFreq + 0.1);
    renderFreq(true);
  };
  confirmBtn.onclick = () => {
    const { matched, strength } = evaluateAt(curFreq);
    if (matched) onTune(matched, curFreq, strength);
  };

  renderFreq(false);

  return () => {
    knobEl.removeEventListener('pointerdown', onKnobDown);
    window.removeEventListener('pointermove', onKnobMove);
    window.removeEventListener('pointerup', onKnobUp);
    sliderEl.oninput = null;
    sliderEl.onchange = null;
    downBtn.onclick = null;
    upBtn.onclick = null;
    confirmBtn.onclick = null;
  };
}

export interface ViewfinderOptions {
  container?: HTMLElement;
  initialLens?: 35 | 50 | 85;
  framesLeft?: number;
  maxFrames?: number;
  onLensChange?: (mm: 35 | 50 | 85) => void;
  onShutter?: () => void;
  onExit?: () => void;
}

export interface ViewfinderController {
  el: HTMLElement;
  setLens: (mm: 35 | 50 | 85) => void;
  setFramesLeft: (n: number) => void;
  setTargetLock: (label: string | null) => void;
  triggerShutter: (caption?: string) => void;
  setVisible: (visible: boolean) => void;
  destroy: () => void;
}

/** Mount pure DOM 35mm Viewfinder HUD overlay (reticle, 35/50/85mm lens pills, frame badge, shutter flash). */
export function mountViewfinderOverlay(opts?: ViewfinderOptions): ViewfinderController {
  ensureModalBaseStyles();
  const host = opts?.container ?? document.body;
  const maxFrames = opts?.maxFrames ?? 36;
  let curFrames = opts?.framesLeft ?? 24;
  let curLens: 35 | 50 | 85 = opts?.initialLens ?? 50;
  let flashTimer: number | null = null;

  const root = document.createElement('div');
  root.id = 'vf-overlay';
  root.className = 'vf-overlay';
  root.setAttribute('aria-label', '35mm 相機取景框');
  root.innerHTML = `
    <div class="vf-top">
      <span class="cine-stamp" id="vf-frames">🎞 餘 ${curFrames}/${maxFrames} 張</span>
      <div class="vf-lens-pills" id="vf-lens-pills" role="group" aria-label="鏡頭焦段">
        <button type="button" class="vf-lens-btn${curLens === 35 ? ' on' : ''}" data-lens="35">35mm</button>
        <button type="button" class="vf-lens-btn${curLens === 50 ? ' on' : ''}" data-lens="50">50mm</button>
        <button type="button" class="vf-lens-btn${curLens === 85 ? ' on' : ''}" data-lens="85">85mm</button>
      </div>
      <button type="button" id="vf-exit">退出取景 (F)</button>
    </div>
    <div class="vf-frame">
      <div class="vf-grid-h1"></div>
      <div class="vf-grid-h2"></div>
      <div class="vf-grid-v1"></div>
      <div class="vf-grid-v2"></div>
      <div class="vf-reticle" id="vf-reticle">
        <span class="vf-lock-lbl" id="vf-lock-lbl" hidden></span>
      </div>
    </div>
    <div class="vf-bot">
      <span class="cine-stamp" id="vf-meter">1/125s · f/4 · ${curLens}mm</span>
      <button type="button" id="vf-shutter-btn">📷 快門 (E / Space)</button>
    </div>
    <div class="vf-flash" id="vf-flash" aria-hidden="true"></div>
  `;

  host.appendChild(root);

  const framesEl = root.querySelector<HTMLElement>('#vf-frames')!;
  const meterEl = root.querySelector<HTMLElement>('#vf-meter')!;
  const reticleEl = root.querySelector<HTMLElement>('#vf-reticle')!;
  const lockLblEl = root.querySelector<HTMLElement>('#vf-lock-lbl')!;
  const flashEl = root.querySelector<HTMLElement>('#vf-flash')!;
  const lensBtns = [...root.querySelectorAll<HTMLButtonElement>('.vf-lens-btn[data-lens]')];
  const shutterBtn = root.querySelector<HTMLButtonElement>('#vf-shutter-btn')!;
  const exitBtn = root.querySelector<HTMLButtonElement>('#vf-exit')!;

  const setLens = (mm: 35 | 50 | 85) => {
    curLens = mm;
    lensBtns.forEach(b => b.classList.toggle('on', Number(b.dataset.lens) === mm));
    meterEl.textContent = `1/125s · f/4 · ${mm}mm`;
  };

  const setFramesLeft = (n: number) => {
    curFrames = Math.max(0, Math.floor(n));
    framesEl.textContent = `🎞 餘 ${curFrames}/${maxFrames} 張`;
  };

  const setTargetLock = (label: string | null) => {
    reticleEl.classList.toggle('locked', Boolean(label));
    if (label) {
      lockLblEl.hidden = false;
      lockLblEl.textContent = `對焦：${label}`;
    } else {
      lockLblEl.hidden = true;
      lockLblEl.textContent = '';
    }
  };

  const triggerShutter = (caption?: string) => {
    if (flashTimer !== null) {
      window.clearTimeout(flashTimer);
      flashTimer = null;
    }
    flashEl.classList.add('on');
    if (caption) {
      lockLblEl.hidden = false;
      lockLblEl.textContent = caption;
    }
    flashTimer = window.setTimeout(() => {
      flashEl.classList.remove('on');
      flashTimer = null;
    }, 120);
  };

  const setVisible = (visible: boolean) => {
    root.hidden = !visible;
  };

  for (const btn of lensBtns) {
    btn.onclick = () => {
      const mm = Number(btn.dataset.lens) as 35 | 50 | 85;
      if (mm === 35 || mm === 50 || mm === 85) {
        setLens(mm);
        opts?.onLensChange?.(mm);
      }
    };
  }
  shutterBtn.onclick = () => {
    opts?.onShutter?.();
  };
  exitBtn.onclick = () => {
    opts?.onExit?.();
  };

  const destroy = () => {
    if (flashTimer !== null) {
      window.clearTimeout(flashTimer);
      flashTimer = null;
    }
    lensBtns.forEach(b => { b.onclick = null; });
    shutterBtn.onclick = null;
    exitBtn.onclick = null;
    root.remove();
  };

  return {
    el: root,
    setLens,
    setFramesLeft,
    setTargetLock,
    triggerShutter,
    setVisible,
    destroy,
  };
}
