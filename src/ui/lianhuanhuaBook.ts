import { CH, EVENTS, WORLD_FLAGS, assetKeyOf, chapterMetaOf, dayKeyOf, orderForViewpoint, viewpointOfChapter } from '../data';
import { VIEWPOINT_LABELS, getChapterMeta, type ChapterMeta } from '../data/routeMetas';
import { load, loadLedger, type ChapterRecord, type PhotoCaptureRecord, type SaveState, type WorldTimelineLedger } from '../save/save';
import type { ViewpointId } from '../types';
import { ITEM_LABELS, summarizeCharactersForViewpoint } from './chronicle';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const CN_NUM = ['壹', '貳', '叁', '肆', '伍', '陸', '柒', '捌', '玖', '拾'];
const VIEWPOINTS_ORDER: readonly ViewpointId[] = ['student', 'worker', 'journalist', 'resident'];

export interface BookOptions {
  viewpoint?: ViewpointId;
  state?: SaveState;
  ledger?: WorldTimelineLedger;
  allRoutes?: boolean;
  onBack?: () => void;
}

interface BookSpread {
  kind: 'cover' | 'chapter' | 'colophon';
  meta?: ChapterMeta;
  viewpoint?: ViewpointId;
  plateNo: number;
}

function buildSpreads(vp: ViewpointId, allRoutes: boolean): BookSpread[] {
  const spreads: BookSpread[] = [{ kind: 'cover', plateNo: 0, viewpoint: vp }];
  let n = 1;
  if (allRoutes) {
    const entries: Array<{ vp: ViewpointId; meta: ChapterMeta }> = [];
    for (const rVp of VIEWPOINTS_ORDER) {
      for (const id of orderForViewpoint(rVp)) {
        entries.push({ vp: rVp, meta: getChapterMeta(id) });
      }
    }
    entries.sort((a, b) => {
      const da = a.meta.dayKey ?? dayKeyOf(a.meta.id);
      const db = b.meta.dayKey ?? dayKeyOf(b.meta.id);
      if (da !== db) return da < db ? -1 : 1;
      return VIEWPOINTS_ORDER.indexOf(a.vp) - VIEWPOINTS_ORDER.indexOf(b.vp);
    });
    for (const e of entries) {
      spreads.push({ kind: 'chapter', viewpoint: e.vp, meta: e.meta, plateNo: n++ });
    }
  } else {
    for (const id of orderForViewpoint(vp)) {
      spreads.push({ kind: 'chapter', viewpoint: vp, meta: getChapterMeta(id), plateNo: n++ });
    }
  }
  spreads.push({ kind: 'colophon', plateNo: n, viewpoint: vp });
  return spreads;
}

function plateNumeral(n: number): string {
  if (n <= 10) return CN_NUM[n - 1] ?? String(n);
  return String(n);
}

function collectStatesByViewpoint(activeState?: SaveState): Partial<Record<ViewpointId, SaveState>> {
  const map: Partial<Record<ViewpointId, SaveState>> = {};
  for (const vp of VIEWPOINTS_ORDER) {
    const saved = load(vp);
    if (saved) map[vp] = saved;
  }
  if (activeState) {
    const activeVp = activeState.viewpoint ?? viewpointOfChapter(activeState.chapter);
    map[activeVp] = activeState;
  }
  return map;
}

function recordForChapter(
  vp: ViewpointId,
  chId: string,
  vpState?: SaveState,
  ledger?: WorldTimelineLedger,
): ChapterRecord | undefined {
  if (vpState) {
    return chId === vpState.chapter
      ? { ending: vpState.ending, taken: vpState.taken ?? [] }
      : vpState.history?.[chId];
  }
  return ledger?.routeRecords?.[vp]?.[chId];
}

function renderRouteChaptersHtml(vp: ViewpointId, vpState?: SaveState, ledger?: WorldTimelineLedger): string {
  const order = orderForViewpoint(vp);
  return order.map((id, i) => {
    const ch = CH[id];
    const meta = getChapterMeta(id);
    const rec = recordForChapter(vp, id, vpState, ledger);
    const end = rec?.ending && ch?.endings?.[rec.ending] ? ch.endings[rec.ending] : undefined;
    const chPhotos = (vpState?.capturedPhotos ?? []).filter(p => p.chapterId === id);
    const photosHtml = chPhotos.length
      ? `<div class="photo-row">${chPhotos.map(p =>
          `<figure><img src="${esc(p.dataUrl)}" alt="${esc(p.caption)}" /><figcaption>#${String(p.frameNo).padStart(2, '0')}A ${p.lensMm}mm ・ ${esc(p.caption)}</figcaption></figure>`
        ).join('')}</div>`
      : '';
    return `<article class="chap">
      <div class="chap-head">
        <span class="badge">第 ${i + 1} 章</span>
        <h3>${esc(ch?.title ?? meta.title)}</h3>
        <span class="meta">${esc(meta.dateStamp)} ・ ${esc(end ? end.title : '尚未完結')}</span>
      </div>
      ${end ? `<p class="ending">${esc(end.text)}</p>` : ''}
      ${ch?.epilogue ? `<p class="epilogue">${esc(ch.epilogue)}</p>` : ''}
      ${photosHtml}
    </article>`;
  }).join('');
}

/** Generate an offline archival HTML commemorative booklet and trigger download. */
export function downloadPersonalKeepsake(
  state: SaveState,
  ledger?: WorldTimelineLedger,
  allRoutes = false,
): void {
  const activeLedger = ledger ?? (() => { try { return loadLedger(); } catch { return undefined; } })();
  const vp = state.viewpoint ?? viewpointOfChapter(state.chapter);
  const vpInfo = VIEWPOINT_LABELS[vp] ?? { short: vp, role: vp, lead: '' };
  const stateByVp = collectStatesByViewpoint(state);
  const targetVps: readonly ViewpointId[] = allRoutes ? VIEWPOINTS_ORDER : [vp];

  const routeSectionsHtml = targetVps.map(rVp => {
    const info = VIEWPOINT_LABELS[rVp] ?? { short: rVp, role: rVp, lead: '' };
    const vpState = stateByVp[rVp];
    const prefix = allRoutes ? `<h2 class="route-title">${esc(info.short)}・${esc(info.lead)}</h2>` : '';
    return `${prefix}${renderRouteChaptersHtml(rVp, vpState, activeLedger)}`;
  }).join('');

  const combinedPhotos = targetVps.flatMap(rVp => stateByVp[rVp]?.capturedPhotos ?? []);
  const selectedPhotos = combinedPhotos.filter(p => p.selectedForPrint);
  const extraPhotos = selectedPhotos.length ? selectedPhotos : combinedPhotos.slice(0, allRoutes ? 16 : 8);
  const darkroomSheetHtml = extraPhotos.length
    ? `<section class="sheet"><h2>35mm 銀鹽底片印樣精選</h2><div class="photo-grid">${extraPhotos.map(p =>
        `<figure><img src="${esc(p.dataUrl)}" alt="${esc(p.caption)}" /><figcaption>#${String(p.frameNo).padStart(2, '0')}A ｜ ${p.lensMm}mm ｜ ${esc(p.caption)}</figcaption></figure>`
      ).join('')}</div></section>`
    : '';

  const combinedDiary = targetVps.flatMap(rVp => {
    const entries = stateByVp[rVp]?.diary ?? [];
    if (!allRoutes) return entries;
    const lbl = VIEWPOINT_LABELS[rVp]?.short ?? rVp;
    return entries.map(line => `【${lbl}】${line}`);
  });
  const diaryHtml = combinedDiary.length
    ? `<ol class="diary">${combinedDiary.map(d => `<li>${esc(d)}</li>`).join('')}</ol>`
    : '<p class="small">這一個春天，筆記本裡留下一頁空白。</p>';

  const keepsakes = [...new Set(targetVps.flatMap(rVp => [...(stateByVp[rVp]?.keepsakes ?? []), ...(stateByVp[rVp]?.items ?? [])]))]
    .map(k => ITEM_LABELS[k] ?? k);
  const chars = targetVps
    .flatMap(rVp => {
      const vpState = stateByVp[rVp];
      return vpState ? summarizeCharactersForViewpoint(vpState) : [];
    })
    .map(c => `<li><strong>${esc(c.name)}：</strong>${esc(c.status)}</li>`).join('');
  const commits = Object.values(activeLedger?.commits ?? {})
    .filter(c => c.val)
    .map(c => `<li><strong>${esc(c.dayKey)}：</strong>${esc(WORLD_FLAGS[c.id]?.description ?? c.id)}</li>`).join('');

  const subtitle = allRoutes ? '四線三十二章合訂典藏紀念冊（學生・工人・記者・市民）' : `${esc(vpInfo.short)} ・ ${esc(vpInfo.lead)}`;
  const docTitle = allRoutes ? '北京，一九八九・四線三十二章合訂典藏紀念冊' : `北京，一九八九・個人春日紀念冊（${esc(vpInfo.short)}）`;

  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<title>${docTitle}</title>
<style>
  body{margin:0;padding:36px 24px;background:#f5efe3;color:#221c15;font-family:"Noto Serif CJK TC","Songti TC","PMingLiU",serif;line-height:1.75}
  .book{max-width:860px;margin:0 auto;background:#fbf7ee;border:2px solid #8a2e22;padding:34px 38px;box-shadow:0 8px 28px rgba(0,0,0,.08)}
  .cover{text-align:center;border-bottom:2px double #8a2e22;padding-bottom:22px;margin-bottom:26px}
  .seal{display:inline-block;padding:4px 12px;border:2px solid #9c2b22;color:#9c2b22;font-weight:bold;letter-spacing:3px;font-size:13px;margin-bottom:10px}
  h1{margin:6px 0;font-size:32px;letter-spacing:6px}
  h2{font-size:19px;color:#7a2b20;border-bottom:1px solid #cbb99a;padding-bottom:4px;margin-top:26px}
  .route-title{font-size:17px;color:#3d2b18;background:#efe6d4;padding:6px 12px;border-left:4px solid #8a2e22;margin-top:22px}
  .chap{margin:16px 0;padding:12px 16px;border-left:3px solid #9c6f3e;background:#f7f1e4}
  .chap-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
  .chap-head h3{margin:0;font-size:17px}.badge{font-size:12px;padding:1px 7px;background:#8a2e22;color:#fff7e8;border-radius:3px}
  .meta,.small{font-size:13px;color:#6c5c46}.ending{margin:8px 0 4px}.epilogue{margin:4px 0 0;font-size:13px;color:#5a4d3c}
  .photo-row,.photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-top:12px}
  figure{margin:0;background:#161412;color:#eee6d2;padding:8px 8px 10px;border-radius:3px}
  figure img{display:block;width:100%;height:auto;aspect-ratio:3/2;object-fit:cover}
  figcaption{font-size:12px;margin-top:6px;color:#d6cbb2}
  .print-btn{display:inline-block;margin-top:10px;padding:8px 18px;background:#8a2e22;color:#fff7e8;border:none;border-radius:4px;cursor:pointer;font:inherit}
  @media print{.print-btn{display:none}body{background:#fff;padding:0}.book{box-shadow:none;border-width:1px}}
</style>
</head>
<body>
<div class="book">
  <header class="cover">
    <div class="seal">一九八九・京華個人紀事</div>
    <h1>北京，一九八九</h1>
    <div>${subtitle}</div>
    <p class="small">所有對話人物均為虛構，僅以此冊存留你在那個春天走過的巷弄、記下的筆記與定影的底片。</p>
    <button class="print-btn" onclick="window.print()">列印 / 另存 PDF 紀念冊</button>
  </header>
  <section><h2>一、章節行跡</h2>${routeSectionsHtml}</section>
  ${darkroomSheetHtml}
  <section><h2>二、人物聚散與隨身物件</h2><p><strong>隨身物件：</strong>${keepsakes.length ? keepsakes.map(esc).join('、') : '兩手空空，只帶記憶'}</p><ul>${chars}</ul></section>
  <section><h2>三、春日日記（${combinedDiary.length} 則）</h2>${diaryHtml}</section>
  ${commits ? `<section><h2>四、四線跨線印記</h2><ul>${commits}</ul></section>` : ''}
</div>
</body>
</html>`;

  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = allRoutes ? 'beijing1989-all-routes-keepsake.html' : `beijing1989-${vp}-keepsake.html`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch { /* ignore */ }
}

export function mountLianhuanhuaBook(container: HTMLElement, opts?: BookOptions): () => void {
  const baseVp = opts?.viewpoint ?? viewpointOfChapter(opts?.state?.chapter ?? 'ch0-0417');
  let allRoutes = Boolean(opts?.allRoutes);
  const ledger = opts?.ledger ?? (() => { try { return loadLedger(); } catch { return undefined; } })();
  const state = opts?.state;
  const stateByVp = collectStatesByViewpoint(state);

  let spreads = buildSpreads(baseVp, allRoutes);
  let spreadIdx = 0;
  let lastTurnDir: 'next' | 'prev' | '' = '';

  const curChapterId = state?.chapter;
  if (curChapterId) {
    const found = spreads.findIndex(s => s.meta?.id === curChapterId);
    if (found > 0) spreadIdx = found;
  }

  container.innerHTML = `
    <div class="lh-book" role="region" aria-label="1980年代六十四開連環畫冊">
      <div class="lh-bar">
        <div class="lh-bar-title">
          <strong>六十四開小人書・連環畫冊</strong>
          <span class="cine-stamp" id="book-page-ind"></span>
        </div>
        <div class="lh-bar-ctrl">
          <button type="button" id="book-scope"></button>
          <button type="button" id="book-prev">◀ 上一頁</button>
          <button type="button" id="book-next">下一頁 ▶</button>
          <button type="button" id="book-export">匯出紀念冊</button>
          ${opts?.onBack ? '<button type="button" id="book-back">返回</button>' : ''}
        </div>
      </div>
      <div class="lh-stage" id="book-stage"></div>
      <div class="lh-thumbs" id="book-thumbs" aria-label="畫頁目錄"></div>
    </div>
  `;

  const stageEl = container.querySelector<HTMLElement>('#book-stage')!;
  const indEl = container.querySelector<HTMLElement>('#book-page-ind')!;
  const scopeBtn = container.querySelector<HTMLButtonElement>('#book-scope')!;
  const prevBtn = container.querySelector<HTMLButtonElement>('#book-prev')!;
  const nextBtn = container.querySelector<HTMLButtonElement>('#book-next')!;
  const exportBtn = container.querySelector<HTMLButtonElement>('#book-export')!;
  const backBtn = container.querySelector<HTMLButtonElement>('#book-back');
  const thumbsEl = container.querySelector<HTMLElement>('#book-thumbs')!;

  const renderCoverHtml = (vp: ViewpointId): string => {
    const info = VIEWPOINT_LABELS[vp] ?? { short: vp, role: '', lead: '' };
    const statVps: readonly ViewpointId[] = allRoutes ? VIEWPOINTS_ORDER : [vp];
    const visitedIds = new Set<string>();
    let diaryCount = 0;
    let photoCount = 0;
    for (const rVp of statVps) {
      const vpState = stateByVp[rVp];
      if (vpState) {
        for (const hId of Object.keys(vpState.history ?? {})) visitedIds.add(hId);
        if (vpState.ending && vpState.chapter) visitedIds.add(vpState.chapter);
        diaryCount += vpState.diary?.length ?? 0;
        photoCount += vpState.capturedPhotos?.length ?? 0;
      } else {
        for (const hId of Object.keys(ledger?.routeRecords?.[rVp] ?? {})) visitedIds.add(hId);
      }
    }
    const visitedCount = visitedIds.size;
    return `
      <div class="lh-spread lh-cover-spread">
        <div class="lh-page lh-left lh-cover">
          <div class="lh-cover-frame">
            <div class="lh-seal">一九八九・京華紀事</div>
            <h2 class="lh-book-title">北京，一九八九</h2>
            <div class="lh-book-sub">AN ORDINARY SPRING ・ 六十四開連環畫冊</div>
            <div class="lh-cover-vp">${allRoutes ? '四線三十二章合訂典藏本' : `${esc(info.short)} ・ ${esc(info.lead)}`}</div>
            <p class="small">依真實年份歷史框架改編，所有對話人物均為虛構。</p>
          </div>
        </div>
        <div class="lh-page lh-right lh-toc">
          <h3>本冊個人印記</h3>
          <ul class="lh-stats">
            <li>已完整走過章節：<strong>${visitedCount}</strong> 章</li>
            <li>寫下的春日筆記：<strong>${diaryCount}</strong> 則</li>
            <li>暗房 35mm 銀鹽底片：<strong>${photoCount}</strong> 格</li>
          </ul>
          <p class="small">向右翻頁，可逐幅欣賞傳統連環畫插圖，並對照你在這座城市留下的日記、事件線索與親手定影的底片。</p>
          <button type="button" class="lh-open-first" id="book-start-read">翻開第一頁 ▶</button>
        </div>
      </div>
    `;
  };

  const renderChapterHtml = (sp: BookSpread): string => {
    const meta = sp.meta!;
    const vp = sp.viewpoint ?? 'student';
    const ch = CH[meta.id];
    const vpLabel = VIEWPOINT_LABELS[vp]?.short ?? vp;
    const dayKey = meta.dayKey ?? dayKeyOf(meta.id);
    const vpState = stateByVp[vp];
    const rec = recordForChapter(vp, meta.id, vpState, ledger);
    const endObj = rec?.ending && ch?.endings?.[rec.ending] ? ch.endings[rec.ending] : undefined;

    const matchingDiary = (vpState?.diary ?? []).filter(d => {
      const m = meta.shortDate;
      return d.includes(m) || (meta.id === vpState?.chapter);
    }).slice(0, 5);

    const chPhotos: PhotoCaptureRecord[] = (vpState?.capturedPhotos ?? []).filter(p => p.chapterId === meta.id);
    const dayCommits = Object.values(ledger?.commits ?? {})
      .filter(c => c.val && c.dayKey === dayKey)
      .map(c => WORLD_FLAGS[c.id]?.description ?? c.id);

    const evIds: string[] = chapterMetaOf(meta.id)?.events ?? [];
    const evTags = evIds.slice(0, 2).map((eid: string) => EVENTS[eid]?.title.zh).filter((t): t is string => Boolean(t));
    const assetKey = meta.assetKey ?? assetKeyOf(meta.id);

    const beatsSummary = meta.storyBeats
      .map(b => `<li><span class="lh-beat-time">${esc(b.time)}</span> ${esc(b.text)}</li>`)
      .join('');

    const photosHtml = chPhotos.length
      ? `<div class="lh-clip-photos">${chPhotos.map(p =>
          `<div class="lh-clip-photo"><img src="${esc(p.dataUrl)}" alt="${esc(p.caption)}" /><span>#${String(p.frameNo).padStart(2, '0')}A ${p.lensMm}mm ・ ${esc(p.caption)}</span></div>`
        ).join('')}</div>`
      : '';

    return `
      <div class="lh-spread${lastTurnDir ? ` turn-${lastTurnDir}` : ''}">
        <div class="lh-page lh-left">
          <div class="lh-plate-head">
            <span class="lh-plate-no">第 ${plateNumeral(sp.plateNo)} 幅</span>
            <span class="lh-plate-vp">${esc(vpLabel)} ・ ${esc(meta.dateStamp)}</span>
          </div>
          <div class="lh-plate-frame">
            <img src="./assets/${esc(assetKey)}.jpg" alt="${esc(meta.title)}" />
          </div>
          <div class="lh-plate-caption">
            <strong>${esc(meta.title)}</strong>
            <p class="small">${esc(meta.context)}</p>
          </div>
        </div>
        <div class="lh-page lh-right">
          <div class="lh-clip-head">
            <span class="lh-seal-sm">京華記憶剪報</span>
            <span class="tag ${endObj ? 'documented' : 'testimony'}">${endObj ? esc(endObj.title) : '未完待續 / 旁觀片段'}</span>
          </div>
          ${endObj ? `<p class="lh-ending-quote">「${esc(endObj.text)}」</p>` : ''}
          ${photosHtml}
          <h4>本章分鏡與時刻</h4>
          <ul class="lh-beats">${beatsSummary}</ul>
          ${matchingDiary.length ? `<h4>隨手筆記摘錄</h4><ul class="lh-diary">${matchingDiary.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
          ${dayCommits.length ? `<p class="small lh-world-note">跨線見聞：${dayCommits.map(esc).join('；')}</p>` : ''}
          ${evTags.length ? `<p class="small lh-ev-note">公開史料對應：${evTags.map(esc).join('・')}</p>` : ''}
        </div>
      </div>
    `;
  };

  const renderColophonHtml = (): string => `
    <div class="lh-spread">
      <div class="lh-page lh-left">
        <h3>版權與史料說明</h3>
        <p>本書根據一九八九年四月至六月北京之公開歷史時間線整理編排；所有對話角色（陳立、王建國、顧明遠、沈淑芬及巷陌鄰里）皆屬文學虛構。</p>
        <p class="small">六十四開小人書排版致敬一九八〇年代中國民間連環畫裝幀傳統：宣紙雙欄框線、方章題記與分幅敘事。</p>
      </div>
      <div class="lh-page lh-right">
        <h3>典藏與離線保存</h3>
        <p>可將你在四條視角線中走過的抉擇、春日日記與暗房 35mm 銀鹽相片一併匯出為單一離線紀念冊（支援瀏覽器直接列印 / 另存 PDF）。</p>
        <button type="button" id="book-export-colophon">下載可列印個人紀念冊 (HTML)</button>
      </div>
    </div>
  `;

  const render = () => {
    const sp = spreads[spreadIdx] ?? spreads[0]!;
    indEl.textContent = `第 ${spreadIdx + 1} / ${spreads.length} 頁`;
    scopeBtn.textContent = allRoutes ? '切換：單篇八章冊' : '切換：四線合訂本';
    prevBtn.disabled = spreadIdx <= 0;
    nextBtn.disabled = spreadIdx >= spreads.length - 1;

    if (sp.kind === 'cover') stageEl.innerHTML = renderCoverHtml(baseVp);
    else if (sp.kind === 'chapter') stageEl.innerHTML = renderChapterHtml(sp);
    else stageEl.innerHTML = renderColophonHtml();

    stageEl.querySelector<HTMLButtonElement>('#book-start-read')?.addEventListener('click', () => {
      if (spreads.length > 1) {
        lastTurnDir = 'next';
        spreadIdx = 1;
        render();
      }
    });
    stageEl.querySelector<HTMLButtonElement>('#book-export-colophon')?.addEventListener('click', () => {
      if (state) downloadPersonalKeepsake(state, ledger, allRoutes);
    });

    thumbsEl.innerHTML = spreads.map((s, i) => {
      const lbl = s.kind === 'cover' ? '封面' : s.kind === 'colophon' ? '版權' : `${s.meta?.shortDate ?? s.plateNo}`;
      return `<button type="button" class="lh-thumb${i === spreadIdx ? ' on' : ''}" data-book-idx="${i}">${esc(lbl)}</button>`;
    }).join('');
    thumbsEl.querySelectorAll<HTMLButtonElement>('.lh-thumb').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.bookIdx);
        if (Number.isFinite(idx) && idx !== spreadIdx) {
          lastTurnDir = idx > spreadIdx ? 'next' : 'prev';
          spreadIdx = idx;
          render();
        }
      };
    });
  };

  prevBtn.onclick = () => {
    if (spreadIdx > 0) {
      lastTurnDir = 'prev';
      spreadIdx--;
      render();
    }
  };
  nextBtn.onclick = () => {
    if (spreadIdx < spreads.length - 1) {
      lastTurnDir = 'next';
      spreadIdx++;
      render();
    }
  };
  scopeBtn.onclick = () => {
    allRoutes = !allRoutes;
    spreads = buildSpreads(baseVp, allRoutes);
    spreadIdx = Math.min(spreadIdx, spreads.length - 1);
    lastTurnDir = '';
    render();
  };
  exportBtn.onclick = () => {
    if (state) downloadPersonalKeepsake(state, ledger, allRoutes);
  };
  if (backBtn && opts?.onBack) backBtn.onclick = opts.onBack;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && spreadIdx > 0) {
      lastTurnDir = 'prev';
      spreadIdx--;
      render();
    } else if (e.key === 'ArrowRight' && spreadIdx < spreads.length - 1) {
      lastTurnDir = 'next';
      spreadIdx++;
      render();
    }
  };
  window.addEventListener('keydown', onKey);

  render();
  return () => {
    window.removeEventListener('keydown', onKey);
    prevBtn.onclick = null;
    nextBtn.onclick = null;
    scopeBtn.onclick = null;
    exportBtn.onclick = null;
    if (backBtn) backBtn.onclick = null;
  };
}
