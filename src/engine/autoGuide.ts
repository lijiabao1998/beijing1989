import type { Chapter, Choice, Hotspot } from '../types';

export interface NextTargetInfo {
  hotspot: Hotspot;
  sameScene: boolean;
  distance?: number;
}

export interface AutoGuideContext {
  clockMin?: number;
  photos?: string[];
  evidence?: string[];
}

const LEGACY_EXIT_RE =
  /^(gate|[cw]\dgate|south|[cw]\dsouth|[cw]\deast|[cw]\dnorth|[cw]\dback|[cw]\dwait|leave|[cw]\dleave|c\ddorm|c\ddesk|home|w1home|w1bench|w5shift|w6bench|square|turnback)$/;

export function isExitHotspot(h: Hotspot): boolean {
  if (h.isExit !== undefined) return Boolean(h.isExit);
  if (h.kind === 'portal') return true;
  return LEGACY_EXIT_RE.test(h.id);
}

export function isInTimeWindow(h: Hotspot, clockMin?: number): boolean {
  if (clockMin === undefined || !h.timeWindow) return true;
  const [lo, hi] = h.timeWindow;
  return lo <= hi ? (clockMin >= lo && clockMin <= hi) : (clockMin >= lo || clockMin <= hi);
}

function sortLocalCandidates(
  pool: Hotspot[],
  playerPos: { x: number; y: number }
): Hotspot[] {
  return [...pool].sort((a, b) => {
    const da = typeof a.deadlineMin === 'number' ? a.deadlineMin : Number.POSITIVE_INFINITY;
    const db = typeof b.deadlineMin === 'number' ? b.deadlineMin : Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    const distA = Math.hypot(a.pos[0] - playerPos.x, a.pos[1] - playerPos.y);
    const distB = Math.hypot(b.pos[0] - playerPos.x, b.pos[1] - playerPos.y);
    return distA - distB;
  });
}

function leadsToUntaken(
  startNode: string,
  chapter: Chapter,
  takenSet: Set<string>,
  seenNodes: Set<string>,
  hasCond: (cond: string) => boolean
): boolean {
  const visited = new Set<string>();
  const queue = [startNode];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = chapter.nodes[id];
    if (!node) continue;
    if (!seenNodes.has(id)) return true;
    const avail = node.choices.filter(c => !c.requires || hasCond(c.requires));
    for (const c of avail) {
      const idx = node.choices.indexOf(c);
      if (!takenSet.has(`${id}#${idx}`)) return true;
      if (c.next && !visited.has(c.next)) queue.push(c.next);
    }
  }
  return false;
}

/** Find the next recommended unexplored hotspot in the current chapter. */
export function findNextTarget(
  chapter: Chapter,
  currentScene: string,
  playerPos: { x: number; y: number },
  hasCond: (cond: string) => boolean,
  taken: string[],
  ctx?: AutoGuideContext
): NextTargetInfo | null {
  const seenNodes = new Set(taken.map(k => k.split('#')[0]));
  const visible = chapter.hotspots.filter(h => !h.requires || hasCond(h.requires));
  const inScene = visible.filter(h => h.scene === currentScene);

  // Filter active local hotspots (supporting timeWindow & unvisited photo_vantage), keeping exit portals last.
  const activeLocal = inScene.filter(h => isInTimeWindow(h, ctx?.clockMin));
  let unexploredLocal = activeLocal.filter(h => !seenNodes.has(h.start) && !isExitHotspot(h));

  // In Ch.2 square, visit the broadcast speaker before the Great Hall steps so post-broadcast options unlock.
  if (chapter.chapter === 'ch1-0422' && currentScene === 'square' && !hasCond('heard_broadcast')) {
    const withoutSteps = unexploredLocal.filter(h => h.id !== 'steps');
    if (withoutSteps.length) unexploredLocal = withoutSteps;
  }

  const pool = unexploredLocal.length
    ? unexploredLocal
    : activeLocal.filter(h => !seenNodes.has(h.start));

  if (pool.length) {
    // In Ch.1 campus, guide player to 老周 before 西校門 if they don't yet carry an item.
    if (chapter.chapter === 'ch0-0417' && currentScene === 'campus' && !hasCond('has_item')) {
      const zhou = inScene.find(h => h.id === 'zhou');
      if (zhou) {
        return {
          hotspot: zhou,
          sameScene: true,
          distance: Math.round(Math.hypot(zhou.pos[0] - playerPos.x, zhou.pos[1] - playerPos.y)),
        };
      }
    }

    const best = sortLocalCandidates(pool, playerPos)[0]!;
    const bestD = Math.hypot(best.pos[0] - playerPos.x, best.pos[1] - playerPos.y);
    return { hotspot: best, sameScene: true, distance: Math.round(bestD) };
  }

  // Otherwise point to an exit portal in the current scene.
  const exitCandidates = sortLocalCandidates(
    activeLocal.filter(h => isExitHotspot(h)),
    playerPos
  );
  const exitLocal = exitCandidates[0] ?? inScene.find(h => isExitHotspot(h));
  if (exitLocal) {
    const d = Math.hypot(exitLocal.pos[0] - playerPos.x, exitLocal.pos[1] - playerPos.y);
    return { hotspot: exitLocal, sameScene: true, distance: Math.round(d) };
  }

  // Fallback: unvisited hotspot in another scene, prioritizing earliest deadlineMin.
  const otherPool = visible
    .filter(h => h.scene !== currentScene && !seenNodes.has(h.start) && isInTimeWindow(h, ctx?.clockMin))
    .sort((a, b) => {
      const da = typeof a.deadlineMin === 'number' ? a.deadlineMin : Number.POSITIVE_INFINITY;
      const db = typeof b.deadlineMin === 'number' ? b.deadlineMin : Number.POSITIVE_INFINITY;
      return da - db;
    });
  const other = otherPool[0] ?? visible.find(h => !seenNodes.has(h.start));
  return other ? { hotspot: other, sameScene: false } : null;
}

/** Pick a non-circular, narrative-complete choice during Auto-Guide mode without penalizing critical/negative rel choices. */
export function pickAutoChoice(
  nodeId: string,
  avail: Choice[],
  chapter: Chapter,
  currentScene: string,
  hasCond: (cond: string) => boolean,
  taken: string[]
): Choice {
  if (avail.length <= 1) return avail[0]!;
  const takenSet = new Set(taken);
  const seenNodes = new Set(taken.map(k => k.split('#')[0]));
  const inScene = chapter.hotspots.filter(h => h.scene === currentScene && (!h.requires || hasCond(h.requires)));
  const remainingLocal = inScene.filter(h => !seenNodes.has(h.start) && !isExitHotspot(h)).length;

  // Chapter 1 street: let the player explore all of street first, then ride to Chang'an Avenue at home_1.
  if (chapter.chapter === 'ch0-0417') {
    if (nodeId === 'youth_1' && remainingLocal > 0) {
      const relay = avail.find(c => c.set === 'rumor_relayed');
      if (relay) return relay;
    }
    if (nodeId === 'home_1') {
      const toChangan = avail.find(c => c.goto === 'changan');
      if (toChangan) return toChangan;
    }
  }

  const nodeChoices = chapter.nodes[nodeId]?.choices ?? [];
  let best = avail[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < avail.length; i++) {
    const c = avail[i]!;
    let s = -i * 0.5;
    const origIdx = nodeChoices.indexOf(c);
    const choiceKey = `${nodeId}#${origIdx >= 0 ? origIdx : i}`;

    if (!takenSet.has(choiceKey)) s += 30;
    if (c.autoHint === true) s += 55;
    if (c.evidence) s += 38;
    if (c.item) s += 35;
    if (c.keepsake) s += 30;
    if (c.worldEmit) s += 24;
    if (c.set) s += 22;
    if (c.diary) s += 16;

    // Neutral toward negative relationship shifts (zero rel < 0 penalty).
    if (c.rel) {
      for (const v of Object.values(c.rel)) {
        if (v > 0) s += 6;
      }
    }

    if (c.next) {
      if (c.next === nodeId) {
        s -= 30;
      } else if (leadsToUntaken(c.next, chapter, takenSet, seenNodes, hasCond)) {
        s += seenNodes.has(c.next) ? 8 : 18;
      } else {
        s -= 20;
      }
    }

    if (c.goto) {
      if (c.goto === currentScene) s -= 30;
      else s += remainingLocal === 0 ? 45 : -12;
    }

    if (c.end) {
      s += remainingLocal === 0 ? 40 : 12;
    }

    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
}
