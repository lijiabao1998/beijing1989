import { ROUTES, VIEWPOINTS, WORLD_FLAGS, dayKeyOf, viewpointOfChapter } from '../data';
import {
  getChapterMeta,
  getMetasForChapter,
  getMetasForViewpoint,
  VIEWPOINT_LABELS,
  type ChapterMeta,
} from '../data/routeMetas';
import { playTapeClick } from '../play/audio';
import {
  getNarratorVoiceMode,
  isNarratorEnabled,
  playChapterVoiceover,
  speakLine,
  stopNarrator,
  toggleNarrator,
} from '../play/narrator';
import { loadLedger, type SaveState, type WorldTimelineLedger } from '../save/save';
import type { ViewpointId } from '../types';
import {
  drawChapterArtwork,
  preloadRollingImages,
  preloadSameDayImages,
  type ReelViewStyle,
} from './reelArtwork';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export type ReelMode = 'chapter' | 'route' | 'interwoven';
export type { ReelViewStyle };

export const REEL_VIEW_STYLES: ReadonlyArray<{ id: ReelViewStyle; label: string; short: string; desc: string }> = [
  { id: 'auto', label: '連環六鏡（自動分鏡）', short: '連環六鏡', desc: '隨每節 6 段自動切換立軸全景、人物特寫、雙聯遠近、長卷橫搖、同日多線與壓頁題跋' },
  { id: 'classic', label: '傳統冊頁（宣紙單幅）', short: '傳統冊頁', desc: '傳統小人書雙欄宣紙畫框、朱文印章與編號題記' },
  { id: 'diptych', label: '雙聯遠近（主景＋特寫）', short: '雙聯遠近', desc: '左右雙聯畫格同時對照全景環境與局部人物器物細節' },
  { id: 'quad', label: '四線同框（同日四視角）', short: '四線同框', desc: '同一歷史日期下學生、工人、記者、市民四幅傳統連環畫同頁並置對照' },
  { id: 'closeup', label: '長卷特寫（細節巡覽）', short: '長卷特寫', desc: '深入連環畫筆觸細節推鏡巡覽，右下附全圖取景位置框' },
];

const REEL_BEAT_LABELS = ['第壹幅・全景', '第貳幅・近景', '第叁幅・雙聯', '第肆幅・橫搖', '第伍幅・同日', '第陸幅・題跋'] as const;
const CN_NUMS = ['壹', '貳', '叁', '肆', '伍', '陸'] as const;

export interface ReelPlaylistItem {
  meta: ChapterMeta;
  viewpoint: ViewpointId;
  viewpointLabel: string;
  dayKey: string;
  excerpt?: string;
  worldNotes?: string[];
  hasPhoto?: boolean;
}

export interface ReelOptions {
  playAll?: boolean;
  mode?: ReelMode;
  viewStyle?: ReelViewStyle;
  speed?: number;
  ledger?: WorldTimelineLedger;
  state?: SaveState;
  playlist?: ReelPlaylistItem[];
  onSpeedChange?: (s: number) => void;
  onComplete?: () => void;
  onOpenBook?: () => void;
}

export const REEL_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];

const ROUTE_PRIORITY: ViewpointId[] = ['student', 'worker', 'journalist', 'resident'];

/** Build a single-viewpoint chronological playlist for route playback. */
export function buildRoutePlaylist(
  chapterId: string,
  diaryLines: string[] = [],
  ledger?: WorldTimelineLedger,
  state?: SaveState
): ReelPlaylistItem[] {
  const vp = viewpointOfChapter(chapterId);
  const metas = getMetasForChapter(chapterId);
  const vpLabel = VIEWPOINT_LABELS[vp]?.short ?? vp;
  const latestExcerpt = diaryLines.length ? diaryLines[diaryLines.length - 1] : undefined;
  const activeLedger = ledger;
  return metas.map((meta, idx) => {
    const dk = meta.dayKey ?? dayKeyOf(meta.id);
    const worldNotes = activeLedger
      ? Object.values(activeLedger.commits)
          .filter(c => c.val && c.dayKey === dk)
          .map(c => WORLD_FLAGS[c.id]?.description ?? c.id)
      : undefined;
    return {
      meta,
      viewpoint: vp,
      viewpointLabel: vpLabel,
      dayKey: dk,
      excerpt: idx === metas.length - 1 ? latestExcerpt : undefined,
      worldNotes: worldNotes?.length ? worldNotes : undefined,
      hasPhoto: Boolean(state?.photos?.length),
    };
  });
}

/** Build a chronological interwoven multi-route playlist (四線交織編年長片) ordered by dayKey × route. */
export function buildInterwovenPlaylist(opts?: {
  viewpoints?: ViewpointId[];
  ledger?: WorldTimelineLedger;
  state?: SaveState;
  diaryLines?: string[];
  includePlanned?: boolean;
}): ReelPlaylistItem[] {
  let ledger = opts?.ledger;
  if (!ledger) {
    try {
      ledger = loadLedger();
    } catch {
      ledger = undefined;
    }
  }

  const playableSet = new Set(VIEWPOINTS.filter(v => v.playable).map(v => v.id));
  const recordedSet = new Set(
    Object.entries(ledger?.routeRecords ?? {})
      .filter(([, recs]) => recs && Object.keys(recs).length > 0)
      .map(([vp]) => vp as ViewpointId)
  );

  let targetVps: ViewpointId[];
  if (opts?.viewpoints?.length) {
    targetVps = opts.viewpoints;
  } else if (opts?.includePlanned) {
    targetVps = [...ROUTE_PRIORITY];
  } else {
    targetVps = ROUTE_PRIORITY.filter(vp => playableSet.has(vp) || recordedSet.has(vp));
    if (targetVps.length < 2) targetVps = [...ROUTE_PRIORITY];
  }

  const commitsByDay = new Map<string, string[]>();
  if (ledger) {
    for (const c of Object.values(ledger.commits)) {
      if (!c.val) continue;
      const list = commitsByDay.get(c.dayKey) ?? [];
      list.push(WORLD_FLAGS[c.id]?.description ?? c.id);
      commitsByDay.set(c.dayKey, list);
    }
  }

  const diaryTail = opts?.diaryLines?.slice(-3) ?? [];
  const items: ReelPlaylistItem[] = [];

  for (const vp of targetVps) {
    const metas = getMetasForViewpoint(vp);
    const vpInfo = VIEWPOINT_LABELS[vp];
    const vpLabel = `${vpInfo.role}・${vpInfo.lead}`;
    const routeList = ROUTES[vp] ?? [];
    const routeById = new Map(routeList.map(r => [r.id, r]));

    metas.forEach((meta, idx) => {
      const r = routeById.get(meta.id);
      if (!opts?.includePlanned && r && !r.playable && !recordedSet.has(vp) && playableSet.size >= 2) {
        return;
      }
      const dk = meta.dayKey ?? r?.dayKey ?? dayKeyOf(meta.id);
      const excerpt =
        opts?.state?.viewpoint === vp && idx === metas.length - 1 && diaryTail.length
          ? diaryTail[diaryTail.length - 1]
          : undefined;
      items.push({
        meta,
        viewpoint: vp,
        viewpointLabel: vpLabel,
        dayKey: dk,
        excerpt,
        worldNotes: commitsByDay.get(dk),
        hasPhoto: Boolean(opts?.state?.viewpoint === vp && opts?.state?.photos?.length),
      });
    });
  }

  const vpRank = new Map(ROUTE_PRIORITY.map((vp, idx) => [vp, idx]));
  items.sort((a, b) => {
    if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? -1 : 1;
    const ra = vpRank.get(a.viewpoint) ?? 99;
    const rb = vpRank.get(b.viewpoint) ?? 99;
    if (ra !== rb) return ra - rb;
    return a.meta.index - b.meta.index;
  });

  return items;
}

/** Render an animated documentary film reel (chapter, full-route, or interwoven multi-route) inside the modal container. */
export function mountDocumentaryReel(
  container: HTMLElement,
  chapterId: string,
  diaryLines: string[],
  onBack?: () => void,
  opts?: ReelOptions
): () => void {
  const vp = viewpointOfChapter(chapterId);
  const vpTag = VIEWPOINT_LABELS[vp]?.short ?? '學生視角';
  const routeMetas = getMetasForChapter(chapterId);
  const routePlaylist = buildRoutePlaylist(chapterId, diaryLines, opts?.ledger, opts?.state);
  const interwovenPlaylist = opts?.playlist?.length
    ? opts.playlist
    : buildInterwovenPlaylist({
        ledger: opts?.ledger,
        state: opts?.state,
        diaryLines,
      });

  let mode: ReelMode = opts?.mode ?? (opts?.playAll ? 'route' : 'chapter');
  let viewStyle: ReelViewStyle = opts?.viewStyle ?? 'auto';
  let activeList: ReelPlaylistItem[] = mode === 'interwoven' ? interwovenPlaylist : routePlaylist;
  let curIndex = mode === 'interwoven'
    ? Math.max(0, activeList.findIndex(item => item.meta.id === chapterId))
    : Math.max(0, routeMetas.findIndex(m => m.id === chapterId));
  if (curIndex < 0) curIndex = 0;

  let speed = opts?.speed && opts.speed > 0 ? opts.speed : 1;
  const excerpts = diaryLines.slice(-3);

  const countWord = routeMetas.length === 6 ? '六' : routeMetas.length === 8 ? '八' : String(routeMetas.length);
  const initialViewInfo = REEL_VIEW_STYLES.find(v => v.id === viewStyle) ?? REEL_VIEW_STYLES[0]!;

  container.innerHTML = `
    <div class="reel-head">
      <div>
        <h2 id="reel-title"></h2>
        <div class="small" id="reel-sub"></div>
      </div>
      <div class="reel-ctrl">
        <button id="reel-view-mode" type="button" title="切換連環畫分鏡視角配置">視角：${esc(initialViewInfo.short)}</button>
        <button id="reel-narrator" type="button" class="${isNarratorEnabled() ? 'on' : ''}" title="開關紀實旁白朗讀">旁白：${isNarratorEnabled() ? '開' : '關'}</button>
        <button id="reel-speed" type="button">倍速：${speed}x</button>
        <button id="reel-toggle" type="button">暫停</button>
        <button id="reel-replay" type="button">重播</button>
        ${opts?.onOpenBook ? '<button id="reel-book" type="button">翻閱畫冊</button>' : ''}
        ${onBack ? '<button id="reel-back" type="button">返回</button>' : ''}
      </div>
    </div>
    <div class="reel-speeds" role="group" aria-label="紀錄片播放倍速">
      <span class="reel-speeds-lbl">倍速：</span>
      ${REEL_SPEEDS.map(s => `<button type="button" class="rspeed-btn${s === speed ? ' on' : ''}" data-speed="${s}">${s}x</button>`).join('')}
    </div>
    <div class="reel-views" role="group" aria-label="傳統連環畫視角配置">
      <span class="reel-speeds-lbl">連環畫視角：</span>
      ${REEL_VIEW_STYLES.map(v => `<button type="button" class="rview-btn${v.id === viewStyle ? ' on' : ''}" data-view="${v.id}" title="${esc(v.desc)}">${esc(v.short)}</button>`).join('')}
    </div>
    <div class="reel-tabs" id="reel-tabs">
      <button id="reel-all" type="button" class="reel-tab ${mode === 'route' ? 'active' : ''}">🎬 ${vpTag}・全${countWord}章連播</button>
      ${interwovenPlaylist.length > routeMetas.length ? `<button id="reel-interwoven" type="button" class="reel-tab ${mode === 'interwoven' ? 'active' : ''}">🎞 四線交織編年長片</button>` : ''}
      ${routeMetas.map((m, i) => `<button type="button" class="reel-tab ch-tab" data-idx="${i}">第${i + 1}章 ${esc(m.shortDate)}</button>`).join('')}
    </div>
    <div class="reel-stage">
      <canvas id="reel-c" width="640" height="360"></canvas>
    </div>
    <div class="reel-bar"><div id="reel-fill"></div></div>
    <div class="reel-beat-box">
      <div class="reel-beats-nav" id="reel-beats-nav" role="group" aria-label="本章六幅連環畫段落">
        ${REEL_BEAT_LABELS.map((lbl, i) => `<button type="button" class="rbeat-btn${i === 0 ? ' on' : ''}" data-beat="${i}">${lbl}</button>`).join('')}
      </div>
      <div class="reel-beat-meta">
        <span class="cine-stamp" id="reel-beat-time"></span>
        <span class="reel-beat-place" id="reel-beat-place"></span>
        <span class="reel-beat-step" id="reel-beat-step"></span>
      </div>
      <p id="reel-beat-txt"></p>
    </div>
  `;

  const canvas = container.querySelector('#reel-c') as HTMLCanvasElement;
  const fill = container.querySelector('#reel-fill') as HTMLElement;
  const titleEl = container.querySelector('#reel-title') as HTMLElement;
  const subEl = container.querySelector('#reel-sub') as HTMLElement;
  const viewModeBtn = container.querySelector('#reel-view-mode') as HTMLButtonElement;
  const rviewBtns = [...container.querySelectorAll('.rview-btn')] as HTMLButtonElement[];
  const rbeatBtns = [...container.querySelectorAll('.rbeat-btn')] as HTMLButtonElement[];
  const speedBtn = container.querySelector('#reel-speed') as HTMLButtonElement;
  const narratorBtn = container.querySelector('#reel-narrator') as HTMLButtonElement;
  const bookBtn = container.querySelector('#reel-book') as HTMLButtonElement | null;
  const rspeedBtns = [...container.querySelectorAll('.rspeed-btn')] as HTMLButtonElement[];
  const toggleBtn = container.querySelector('#reel-toggle') as HTMLButtonElement;
  const replayBtn = container.querySelector('#reel-replay') as HTMLButtonElement;
  const backBtn = container.querySelector('#reel-back') as HTMLButtonElement | null;
  const allBtn = container.querySelector('#reel-all') as HTMLButtonElement;
  const interwovenBtn = container.querySelector('#reel-interwoven') as HTMLButtonElement | null;
  const chTabs = [...container.querySelectorAll('.ch-tab')] as HTMLButtonElement[];
  const beatTimeEl = container.querySelector('#reel-beat-time') as HTMLElement;
  const beatPlaceEl = container.querySelector('#reel-beat-place') as HTMLElement;
  const beatStepEl = container.querySelector('#reel-beat-step') as HTMLElement;
  const beatTxtEl = container.querySelector('#reel-beat-txt') as HTMLElement;
  const ctx = canvas.getContext('2d');

  // Rolling image preload plus same-day 4-route preload backed by the 8-image LRU cache in reelArtwork.ts.
  const preloadAroundCurrent = () => {
    preloadRollingImages(
      activeList.map(item => ({ id: item.meta.id, assetKey: item.meta.assetKey })),
      curIndex,
      2
    );
    const cur = activeList[curIndex];
    if (cur) preloadSameDayImages(cur.dayKey);
  };
  preloadAroundCurrent();

  const DURATION = 24;
  let playing = true;
  let elapsed = 0;
  let lastBeatKey = '';
  let lastNow = performance.now();
  let raf = 0;

  const currentItem = (): ReelPlaylistItem =>
    activeList[curIndex] ?? activeList[0] ?? {
      meta: getChapterMeta(chapterId),
      viewpoint: vp,
      viewpointLabel: vpTag,
      dayKey: dayKeyOf(chapterId),
    };

  const syncHeader = () => {
    const item = currentItem();
    const meta = item.meta;
    if (mode === 'interwoven') {
      titleEl.textContent = `四線交織編年長片（${curIndex + 1}/${activeList.length}）・${item.viewpointLabel}｜${meta.title}`;
      subEl.textContent = `${meta.dateStamp}｜${item.viewpointLabel}｜${meta.subtitle}`;
    } else if (mode === 'route') {
      titleEl.textContent = `${vpTag}全${countWord}章故事長片（${curIndex + 1}/${activeList.length}）・${meta.title}`;
      subEl.textContent = `${meta.dateStamp}｜${meta.subtitle}`;
    } else {
      titleEl.textContent = `紀錄短片（${vpTag}）・${meta.title}`;
      subEl.textContent = `${meta.dateStamp}｜${meta.subtitle}`;
    }
    allBtn.classList.toggle('active', mode === 'route');
    interwovenBtn?.classList.toggle('active', mode === 'interwoven');
    chTabs.forEach((btn, i) => {
      const m = routeMetas[i];
      btn.classList.toggle('active', mode === 'interwoven' ? m?.id === meta.id : i === curIndex);
    });
    preloadAroundCurrent();
  };

  const drawFrame = (sec: number) => {
    if (!ctx) return;
    const item = currentItem();
    const meta = item.meta;
    const w = canvas.width, h = canvas.height;
    const loopT = Math.min(DURATION - 0.001, Math.max(0, sec));
    const beats = meta.storyBeats;
    const beatCount = Math.max(1, beats.length);
    const beatLen = DURATION / beatCount;
    const beatIdx = Math.min(beatCount - 1, Math.floor(loopT / beatLen));
    const beatProgress = Math.min(1, Math.max(0, (loopT - beatIdx * beatLen) / beatLen));
    const beat = beats[beatIdx] ?? { time: meta.dateStamp, place: meta.subtitle, text: meta.context };

    drawChapterArtwork(ctx, w, h, meta.id, sec, false, meta.assetKey, {
      beatIdx,
      beatCount,
      beatProgress,
      viewStyle,
      dayKey: item.dayKey,
      pageNumber: `第 ${String(curIndex + 1).padStart(2, '0')} 節・第${CN_NUMS[beatIdx] ?? beatIdx + 1}幅`,
      beatLabel: `${beat.time}｜${beat.place}`,
      stageTop: 34,
      stageBottom: 50,
    });

    ctx.fillStyle = '#05060b';
    ctx.fillRect(0, 0, w, 34);
    ctx.fillRect(0, h - 50, w, 50);

    ctx.fillStyle = 'rgba(240, 224, 184, 0.88)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    const isContinuous = mode === 'route' || mode === 'interwoven';
    const totalSec = isContinuous ? curIndex * DURATION + loopT : loopT;
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(Math.floor(totalSec % 60)).padStart(2, '0');
    const totalCount = String(activeList.length).padStart(2, '0');
    const curCount = String(curIndex + 1).padStart(2, '0');
    const reelTag = mode === 'interwoven' ? `${item.viewpoint.toUpperCase()} ${curCount}/${totalCount}` : `REEL ${String(meta.index + 1).padStart(2, '0')}/${totalCount}`;
    ctx.fillText(
      `${reelTag} // ${meta.dateStamp} // ${beat.place}`,
      16,
      21
    );
    ctx.textAlign = 'right';
    const modeLabel = mode === 'interwoven' ? 'INTERWOVEN' : mode === 'route' ? 'FULL FILM' : 'CHAPTER';
    ctx.fillText(`${modeLabel} ${speed}x // 00:${mm}:${ss}`, w - 16, 21);

    if (loopT < 2.2) {
      const fadeOut = loopT < 1.5 ? 1 : Math.max(0, (2.2 - loopT) / 0.7);
      ctx.save();
      ctx.globalAlpha = fadeOut;
      const pw = Math.min(w - 48, 468);
      const ph = 56;
      const px = (w - pw) / 2;
      const py = h - 50 - ph - 14;
      ctx.fillStyle = 'rgba(14, 11, 8, 0.88)';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#d9b878';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
      ctx.strokeStyle = 'rgba(217, 184, 120, 0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 4, py + 4, pw - 8, ph - 8);
      ctx.fillStyle = 'rgba(246, 236, 210, 0.98)';
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px "Noto Serif CJK TC", serif';
      ctx.fillText(meta.title, w / 2, py + 26);
      ctx.fillStyle = meta.accent;
      ctx.font = '12.5px "Noto Serif CJK TC", serif';
      const subText = mode === 'interwoven' ? `${item.viewpointLabel}｜${meta.subtitle}` : meta.subtitle;
      ctx.fillText(subText, w / 2, py + 46);
      ctx.restore();
    }

    let caption = beat.text;
    if (mode === 'interwoven' && beatIdx === beats.length - 1 && item.worldNotes?.length) {
      caption = `跨線交會：「${item.worldNotes[0]}」`;
    } else if (mode === 'chapter' && beatIdx === beats.length - 1 && excerpts[0]) {
      caption = `日記片段：「${excerpts[excerpts.length - 1]}」`;
    } else if (item.excerpt && beatIdx === beats.length - 1) {
      caption = `日記片段：「${item.excerpt}」`;
    }

    ctx.fillStyle = '#f3ead2';
    ctx.font = '13px "Noto Serif CJK TC", "Microsoft JhengHei", serif';
    ctx.textAlign = 'center';
    if (caption.length <= 38) {
      ctx.fillText(caption, w / 2, h - 20);
    } else {
      const line1 = caption.slice(0, 38);
      const line2 = caption.slice(38, 74) + (caption.length > 74 ? '…' : '');
      ctx.fillText(line1, w / 2, h - 29);
      ctx.fillText(line2, w / 2, h - 11);
    }

    const overallPct = isContinuous
      ? ((curIndex + loopT / DURATION) / activeList.length) * 100
      : (loopT / DURATION) * 100;
    fill.style.width = `${Math.min(100, overallPct).toFixed(1)}%`;

    const bKey = `${mode}:${viewStyle}:${curIndex}:${beatIdx}`;
    if (bKey !== lastBeatKey) {
      lastBeatKey = bKey;
      beatTimeEl.textContent = mode === 'interwoven' ? `${beat.time}｜${item.viewpointLabel}` : beat.time;
      beatPlaceEl.textContent = beat.place;
      beatStepEl.textContent = `第 ${curIndex + 1}/${activeList.length} 節・段落 ${beatIdx + 1}/${beats.length}`;
      const extraNote =
        mode === 'interwoven' && item.worldNotes?.length
          ? `（跨線記錄：${item.worldNotes.join('；')}）`
          : '';
      beatTxtEl.textContent = beat.text + extraNote;
      rbeatBtns.forEach((btn, i) => btn.classList.toggle('on', i === beatIdx));
      playTapeClick();
      if (isNarratorEnabled() && playing) {
        const rate = Math.min(1.4, Math.max(0.85, 0.92 + speed * 0.08));
        if (beatIdx === 0) {
          playChapterVoiceover(item.meta.id, beat.text, { viewpoint: item.viewpoint, rate });
        } else {
          speakLine(beat.text, { viewpoint: item.viewpoint, rate });
        }
      }
    }
  };

  const loop = (now: number) => {
    if (!canvas.isConnected) return;
    const dt = Math.min(0.1, (now - lastNow) / 1000);
    lastNow = now;
    if (playing) {
      elapsed += dt * speed;
      if (elapsed >= DURATION) {
        const isContinuous = mode === 'route' || mode === 'interwoven';
        if (isContinuous && curIndex < activeList.length - 1) {
          curIndex++;
          elapsed = 0;
          syncHeader();
        } else if (opts?.onComplete) {
          playing = false;
          drawFrame(DURATION - 0.01);
          opts.onComplete();
          return;
        } else if (isContinuous) {
          curIndex = 0;
          elapsed = 0;
          syncHeader();
        } else {
          elapsed = elapsed % DURATION;
        }
      }
    }
    drawFrame(elapsed);
    raf = requestAnimationFrame(loop);
  };

  const setViewStyle = (next: ReelViewStyle) => {
    viewStyle = next;
    const info = REEL_VIEW_STYLES.find(v => v.id === viewStyle) ?? REEL_VIEW_STYLES[0]!;
    viewModeBtn.textContent = `視角：${info.short}`;
    rviewBtns.forEach(b => b.classList.toggle('on', b.dataset.view === viewStyle));
    lastBeatKey = '';
    preloadAroundCurrent();
    drawFrame(elapsed);
  };

  const setReelSpeed = (next: number) => {
    speed = next;
    speedBtn.textContent = `倍速：${speed}x`;
    rspeedBtns.forEach(b => b.classList.toggle('on', Number(b.dataset.speed) === speed));
    opts?.onSpeedChange?.(speed);
    if (!playing) drawFrame(elapsed);
  };

  viewModeBtn.onclick = () => {
    const idx = REEL_VIEW_STYLES.findIndex(v => v.id === viewStyle);
    const next = REEL_VIEW_STYLES[(idx + 1) % REEL_VIEW_STYLES.length]!;
    setViewStyle(next.id);
  };
  rviewBtns.forEach(btn => {
    btn.onclick = () => {
      const next = btn.dataset.view as ReelViewStyle | undefined;
      if (next && REEL_VIEW_STYLES.some(v => v.id === next)) setViewStyle(next);
    };
  });
  rbeatBtns.forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.beat);
      const beatCount = Math.max(1, currentItem().meta.storyBeats.length);
      if (Number.isFinite(idx) && idx >= 0 && idx < beatCount) {
        elapsed = (idx / beatCount) * DURATION + 0.02;
        lastBeatKey = '';
        drawFrame(elapsed);
      }
    };
  });

  speedBtn.onclick = () => {
    const idx = REEL_SPEEDS.indexOf(speed);
    const next = idx >= 0
      ? REEL_SPEEDS[(idx + 1) % REEL_SPEEDS.length]!
      : (REEL_SPEEDS.find(s => s > speed) ?? REEL_SPEEDS[0]!);
    setReelSpeed(next);
  };
  rspeedBtns.forEach(btn => {
    btn.onclick = () => {
      const next = Number(btn.dataset.speed);
      if (Number.isFinite(next) && next > 0) setReelSpeed(next);
    };
  });
  toggleBtn.onclick = () => {
    playing = !playing;
    toggleBtn.textContent = playing ? '暫停' : '繼續播放';
    if (!playing) stopNarrator();
  };
  narratorBtn.onclick = () => {
    const on = toggleNarrator();
    narratorBtn.textContent = on ? (getNarratorVoiceMode() === 'studio' ? '原聲旁白：開' : '旁白：開') : '旁白：關';
    narratorBtn.classList.toggle('on', on);
    if (on) {
      const item = currentItem();
      const beatTxt = beatTxtEl.textContent || item.meta.storyBeats[0]?.text || '';
      const rate = Math.min(1.4, Math.max(0.85, 0.92 + speed * 0.08));
      playChapterVoiceover(item.meta.id, beatTxt, { viewpoint: item.viewpoint, rate });
    }
  };
  if (bookBtn && opts?.onOpenBook) {
    bookBtn.onclick = () => {
      stopNarrator();
      opts.onOpenBook?.();
    };
  }
  replayBtn.onclick = () => {
    if (mode === 'route' || mode === 'interwoven') curIndex = 0;
    elapsed = 0;
    playing = true;
    toggleBtn.textContent = '暫停';
    syncHeader();
  };
  allBtn.onclick = () => {
    if (mode === 'route') {
      mode = 'chapter';
    } else {
      const curId = currentItem().meta.id;
      mode = 'route';
      activeList = routePlaylist;
      const match = activeList.findIndex(item => item.meta.id === curId);
      curIndex = match >= 0 ? match : 0;
    }
    elapsed = 0;
    playing = true;
    toggleBtn.textContent = '暫停';
    syncHeader();
  };
  if (interwovenBtn) {
    interwovenBtn.onclick = () => {
      if (mode === 'interwoven') {
        mode = 'route';
        activeList = routePlaylist;
        const curId = currentItem().meta.id;
        const match = activeList.findIndex(item => item.meta.id === curId);
        curIndex = match >= 0 ? match : 0;
      } else {
        const curId = currentItem().meta.id;
        mode = 'interwoven';
        activeList = interwovenPlaylist;
        const match = activeList.findIndex(item => item.meta.id === curId);
        curIndex = match >= 0 ? match : 0;
      }
      elapsed = 0;
      playing = true;
      toggleBtn.textContent = '暫停';
      syncHeader();
    };
  }
  chTabs.forEach((btn, idx) => {
    btn.onclick = () => {
      if (mode === 'interwoven') {
        mode = 'chapter';
        activeList = routePlaylist;
      }
      curIndex = idx;
      elapsed = 0;
      playing = true;
      toggleBtn.textContent = '暫停';
      syncHeader();
    };
  });
  if (backBtn && onBack) backBtn.onclick = onBack;

  syncHeader();
  drawFrame(0);
  raf = requestAnimationFrame(loop);
  return () => {
    stopNarrator();
    if (raf) cancelAnimationFrame(raf);
  };
}
