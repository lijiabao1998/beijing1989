import { getMetasForChapter } from '../data/routeMetas';
import type { NextTargetInfo } from '../engine/autoGuide';
import type { ChapterRecord } from '../save/save';

/** Update the compact Linear Story Timeline & Guide bar in the HUD. */
export function updateTimelineHud(
  timelineEl: HTMLElement,
  guideTextEl: HTMLElement,
  guideBtnEl: HTMLButtonElement,
  chapterId: string,
  history: Record<string, ChapterRecord> | undefined,
  target: NextTargetInfo | null,
  autoGuide = false,
  speed = 1,
): void {
  const metas = getMetasForChapter(chapterId);
  const idx = metas.findIndex(m => m.id === chapterId);
  const total = Math.max(1, metas.length);

  timelineEl.innerHTML = metas.map((m, i) => {
    const done = Boolean(history?.[m.id]?.ending) || i < idx;
    const active = m.id === chapterId;
    const cls = active ? 'tl-step active' : done ? 'tl-step done' : 'tl-step';
    return `<span class="${cls}">${done && !active ? '✓' : ''}${m.shortDate}</span>`;
  }).join('<span class="tl-arr">➔</span>');

  const autoTag = autoGuide
    ? `【自動引導・倍速 ${speed}x】`
    : speed !== 1
      ? `【倍速 ${speed}x】`
      : '';
  const prefix = `${autoTag}第 ${Math.max(1, idx + 1)}/${total} 章`;

  if (target) {
    if (target.sameScene && target.distance !== undefined) {
      guideTextEl.textContent = `${prefix}｜${autoGuide ? '正在前往' : '建議前往'}：${target.hotspot.label}（${target.distance}m）`;
      guideBtnEl.hidden = target.distance <= 3;
      guideBtnEl.textContent = autoGuide ? '立即抵達' : '引導前往';
    } else {
      guideTextEl.textContent = `${prefix}｜下一目標：${target.hotspot.label}`;
      guideBtnEl.hidden = false;
      guideBtnEl.textContent = autoGuide ? '立即抵達' : '引導前往';
    }
  } else {
    guideTextEl.textContent = `${prefix}｜自由探索中`;
    guideBtnEl.hidden = true;
  }
}
