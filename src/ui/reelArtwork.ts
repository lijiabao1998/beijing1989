import { getChapterMeta, getMetasForViewpoint, hasChapterMeta, VIEWPOINT_LABELS, type ChapterMeta } from '../data/routeMetas';
import type { ViewpointId } from '../types';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export const MAX_CACHED_IMAGES = 8;

export type ReelViewStyle = 'auto' | 'classic' | 'diptych' | 'quad' | 'closeup';

export type EffectiveLianhuanhuaLayout =
  | 'classic'
  | 'closeup_left'
  | 'closeup_right'
  | 'diptych'
  | 'scroll'
  | 'same_day_triptych'
  | 'quad'
  | 'closing_plate';

export interface ReelArtworkOpts {
  beatIdx?: number;
  beatCount?: number;
  beatProgress?: number;
  viewStyle?: ReelViewStyle;
  dayKey?: string;
  pageNumber?: string;
  beatLabel?: string;
  stageTop?: number;
  stageBottom?: number;
}

const ROUTE_PRIORITY: readonly ViewpointId[] = ['student', 'worker', 'journalist', 'resident'];
const CHINESE_NUM = ['壹', '貳', '叁', '肆', '伍', '陸'];

const ARCHETYPE_FOCAL: Record<number, { a: [number, number]; b: [number, number] }> = {
  0: { a: [0.64, 0.58], b: [0.42, 0.42] },
  1: { a: [0.58, 0.54], b: [0.34, 0.44] },
  2: { a: [0.52, 0.56], b: [0.70, 0.48] },
  3: { a: [0.62, 0.56], b: [0.34, 0.48] },
  4: { a: [0.50, 0.48], b: [0.30, 0.58] },
  5: { a: [0.56, 0.54], b: [0.32, 0.48] },
};

const ASSET_FOCAL: Record<string, { a: [number, number]; b: [number, number] }> = {
  ch0: { a: [0.66, 0.58], b: [0.46, 0.42] },
  ch1: { a: [0.46, 0.62], b: [0.50, 0.36] },
  ch_0427: { a: [0.52, 0.64], b: [0.50, 0.32] },
  ch_0504: { a: [0.42, 0.64], b: [0.28, 0.36] },
  ch2: { a: [0.50, 0.58], b: [0.72, 0.52] },
  ch4: { a: [0.52, 0.46], b: [0.28, 0.60] },
  ch5: { a: [0.68, 0.60], b: [0.28, 0.48] },
  w0: { a: [0.64, 0.58], b: [0.36, 0.42] },
  w1: { a: [0.46, 0.58], b: [0.32, 0.38] },
  w_0427: { a: [0.36, 0.58], b: [0.62, 0.56] },
  w_0504: { a: [0.44, 0.56], b: [0.70, 0.48] },
  w2: { a: [0.52, 0.54], b: [0.26, 0.56] },
  w3: { a: [0.34, 0.62], b: [0.64, 0.50] },
  w4: { a: [0.68, 0.62], b: [0.32, 0.56] },
  w5: { a: [0.66, 0.58], b: [0.34, 0.54] },
  j0: { a: [0.42, 0.54], b: [0.72, 0.46] },
  j1: { a: [0.66, 0.48], b: [0.30, 0.42] },
  j_0427: { a: [0.74, 0.56], b: [0.30, 0.58] },
  j_0504: { a: [0.36, 0.44], b: [0.78, 0.56] },
  j2: { a: [0.48, 0.54], b: [0.72, 0.60] },
  j3: { a: [0.74, 0.58], b: [0.34, 0.52] },
  j4: { a: [0.30, 0.56], b: [0.64, 0.46] },
  j5: { a: [0.38, 0.58], b: [0.78, 0.50] },
  r0: { a: [0.56, 0.52], b: [0.32, 0.62] },
  r1: { a: [0.44, 0.58], b: [0.74, 0.58] },
  r_0427: { a: [0.62, 0.56], b: [0.30, 0.58] },
  r_0504: { a: [0.34, 0.56], b: [0.74, 0.52] },
  r2: { a: [0.54, 0.48], b: [0.32, 0.54] },
  r3: { a: [0.54, 0.56], b: [0.32, 0.60] },
  r4: { a: [0.64, 0.54], b: [0.28, 0.52] },
  r5: { a: [0.40, 0.58], b: [0.54, 0.54] },
};

// Rolling 4-image LRU cache for ./assets/<assetKey>.jpg illustrations.
export const chapterImages = new Map<string, HTMLImageElement | null>();

export function resolveImageKey(key: number | string, assetKeyHint?: string): { key: string; idx: number } {
  if (typeof key === 'number') {
    const idx = Math.max(0, Math.floor(key));
    return { key: assetKeyHint ?? `ch${idx}`, idx };
  }
  if (hasChapterMeta(key)) {
    const meta = getChapterMeta(key, assetKeyHint);
    return { key: assetKeyHint ?? meta.assetKey ?? key, idx: meta.index };
  }
  const m = key.match(/\d+/);
  const idx = m ? Number(m[0]) : 0;
  return { key: assetKeyHint ?? key, idx };
}

function mapProceduralArchetype(rawIdx: number, chKey?: string): number {
  if (chKey) {
    if (chKey.includes('0417')) return 0;
    if (chKey.includes('0422') || chKey.includes('0427') || chKey.includes('0504')) return 1;
    if (chKey.includes('0513') || chKey.includes('0514') || chKey.includes('0515')) return 2;
    if (chKey.includes('0520')) return 3;
    if (chKey.includes('0530')) return 4;
    if (chKey.includes('0603') || chKey.includes('0604') || chKey.includes('0605')) return 5;
  }
  return ((rawIdx % 6) + 6) % 6;
}

export function getChapterImage(key: number | string, assetKeyHint?: string): HTMLImageElement | null {
  const { key: assetKey } = resolveImageKey(key, assetKeyHint);
  if (chapterImages.has(assetKey)) {
    const cached = chapterImages.get(assetKey) ?? null;
    chapterImages.delete(assetKey);
    chapterImages.set(assetKey, cached);
    return cached;
  }
  while (chapterImages.size >= MAX_CACHED_IMAGES) {
    const oldestKey = chapterImages.keys().next().value;
    if (oldestKey === undefined) break;
    const oldImg = chapterImages.get(oldestKey);
    if (oldImg) oldImg.onerror = null;
    chapterImages.delete(oldestKey);
  }
  try {
    const img = new Image();
    img.decoding = 'async';
    img.onerror = () => {
      if (chapterImages.get(assetKey) === img) {
        chapterImages.set(assetKey, null);
      }
    };
    img.src = `./assets/${assetKey}.jpg`;
    chapterImages.set(assetKey, img);
    return img;
  } catch {
    chapterImages.set(assetKey, null);
    return null;
  }
}

/** Preload a rolling window of chapter illustrations (default 2: current + next) bounded by the LRU cache. */
export function preloadRollingImages(
  items: ReadonlyArray<string | { id: string; assetKey?: string }>,
  currentIndex: number,
  windowSize = 2
): void {
  if (!items.length || windowSize <= 0) return;
  const start = Math.max(0, currentIndex);
  const end = Math.min(items.length, start + windowSize);
  for (let i = start; i < end; i++) {
    const item = items[i];
    if (!item) continue;
    if (typeof item === 'string') {
      getChapterImage(item);
    } else {
      getChapterImage(item.id, item.assetKey);
    }
  }
}

/** Collect all route chapters sharing the same historical dayKey across the 4 viewpoints. */
export function getSameDayMetas(dayKey?: string, prioritizeId?: string): ChapterMeta[] {
  if (!dayKey) return [];
  const matches: ChapterMeta[] = [];
  for (const vp of ROUTE_PRIORITY) {
    const found = getMetasForViewpoint(vp).find(m => m.dayKey === dayKey);
    if (found) matches.push(found);
  }
  if (prioritizeId) {
    matches.sort((a, b) => (a.id === prioritizeId ? -1 : b.id === prioritizeId ? 1 : 0));
  }
  return matches;
}

/** Preload all 4 viewpoints' Lianhuanhua artworks for a given dayKey so diptych/quad layouts render immediately. */
export function preloadSameDayImages(dayKey?: string): void {
  for (const m of getSameDayMetas(dayKey)) {
    getChapterImage(m.id, m.assetKey);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function easeInOut(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function getFocalPair(assetKey: string, archetype: number): { a: [number, number]; b: [number, number] } {
  return ASSET_FOCAL[assetKey] ?? ARCHETYPE_FOCAL[archetype] ?? { a: [0.54, 0.52], b: [0.34, 0.46] };
}

function isLoadedImg(img: HTMLImageElement | null): img is HTMLImageElement {
  return Boolean(img && img.complete && img.naturalWidth > 0);
}

interface CropRectNorm {
  nx: number;
  ny: number;
  nw: number;
  nh: number;
}

/** Draw an image into a panel rectangle using exact cover-crop + normalized focal point & zoom (trimmed when zoomed to avoid inner frame edges). */
function drawCroppedImage(
  g: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  fx: number,
  fy: number,
  zoom: number
): CropRectNorm {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const trim = zoom >= 1.12 ? 0.028 : 0.008;
  const minX = iw * trim;
  const minY = ih * trim;
  const usableW = Math.max(1, iw * (1 - trim * 2));
  const usableH = Math.max(1, ih * (1 - trim * 2));

  const pAspect = dw / Math.max(1, dh);
  const srcAspect = usableW / usableH;
  const baseW = srcAspect > pAspect ? usableH * pAspect : usableW;
  const baseH = srcAspect > pAspect ? usableH : usableW / pAspect;

  const z = Math.max(1, zoom);
  const cw = Math.min(usableW, baseW / z);
  const ch = Math.min(usableH, baseH / z);
  const sx = clamp(fx * iw - cw / 2, minX, minX + usableW - cw);
  const sy = clamp(fy * ih - ch / 2, minY, minY + usableH - ch);

  g.save();
  g.beginPath();
  g.rect(dx, dy, dw, dh);
  g.clip();
  g.drawImage(img, sx, sy, cw, ch, dx, dy, dw, dh);
  g.restore();

  return { nx: sx / iw, ny: sy / ih, nw: cw / iw, nh: ch / ih };
}

/** Draw authentic 1980s Lianhuanhua double ink border (`外粗內細`), corner fretwork (`博古錦角`), cartouche badge & vermilion seal. */
function drawLianhuanhuaPanelBorder(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: {
    cornerFret?: boolean;
    badge?: string;
    seal?: string;
    activeHighlight?: boolean;
  }
): void {
  g.save();
  // Crisp outer ink frame + fine inner rule
  g.strokeStyle = opts?.activeHighlight ? '#e9c27a' : '#18120c';
  g.lineWidth = opts?.activeHighlight ? 2.4 : 2;
  g.strokeRect(x + 1, y + 1, w - 2, h - 2);

  g.strokeStyle = opts?.activeHighlight ? 'rgba(233, 194, 122, 0.72)' : 'rgba(223, 210, 180, 0.55)';
  g.lineWidth = 1;
  g.strokeRect(x + 4, y + 4, w - 8, h - 8);

  if (opts?.cornerFret && w > 120 && h > 90) {
    const f = 11;
    const m = 4;
    g.strokeStyle = opts?.activeHighlight ? '#f0c97d' : 'rgba(232, 214, 174, 0.75)';
    g.lineWidth = 1.3;
    const corners: Array<[number, number, number, number]> = [
      [x + m, y + m, 1, 1],
      [x + w - m, y + m, -1, 1],
      [x + m, y + h - m, 1, -1],
      [x + w - m, y + h - m, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      g.beginPath();
      g.moveTo(cx, cy + sy * f);
      g.lineTo(cx + sx * f, cy + sy * f);
      g.lineTo(cx + sx * f, cy);
      g.moveTo(cx + sx * 4, cy + sy * 4);
      g.lineTo(cx + sx * (f - 2), cy + sy * 4);
      g.lineTo(cx + sx * (f - 2), cy + sy * (f - 2));
      g.stroke();
    }
  }

  if (opts?.badge) {
    g.font = 'bold 11px "Noto Serif CJK TC", "Microsoft JhengHei", serif';
    const tw = g.measureText(opts.badge).width;
    const bw = Math.min(w - 16, tw + 14);
    const bh = 20;
    const bx = x + 8;
    const by = y + 8;
    g.fillStyle = opts?.activeHighlight ? 'rgba(116, 42, 24, 0.94)' : 'rgba(19, 15, 11, 0.90)';
    g.fillRect(bx, by, bw, bh);
    g.strokeStyle = opts?.activeHighlight ? '#f2cf88' : '#c9b07e';
    g.lineWidth = 1;
    g.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    g.fillStyle = '#f6ebd0';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(opts.badge, bx + 7, by + bh / 2 + 0.5, bw - 12);
    g.textBaseline = 'alphabetic';
  }

  if (opts?.seal && w > 110 && h > 80) {
    const sw = 20;
    const sh = 40;
    const sx = x + w - sw - 9;
    const sy = y + 9;
    g.fillStyle = 'rgba(166, 38, 28, 0.88)';
    g.fillRect(sx, sy, sw, sh);
    g.strokeStyle = 'rgba(246, 228, 198, 0.78)';
    g.lineWidth = 1;
    g.strokeRect(sx + 1.5, sy + 1.5, sw - 3, sh - 3);
    g.fillStyle = '#faeedc';
    g.font = 'bold 8.5px "Noto Serif CJK TC", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const chars = [...opts.seal].slice(0, 4);
    const step = (sh - 8) / Math.max(1, chars.length);
    chars.forEach((ch, idx) => {
      g.fillText(ch, sx + sw / 2, sy + 5 + step * (idx + 0.5));
    });
    g.textBaseline = 'alphabetic';
  }
  g.restore();
}

/** Draw a small full-plate mini locator showing which detail rectangle is visible inside close-up views. */
function drawOverviewLocator(
  g: CanvasRenderingContext2D,
  img: HTMLImageElement,
  crop: CropRectNorm,
  stageX: number,
  stageY: number,
  stageW: number,
  stageH: number
): void {
  if (stageW < 340 || stageH < 180) return;
  const mw = 104;
  const mh = Math.round(mw * 9 / 16);
  const mx = stageX + stageW - mw - 12;
  const my = stageY + stageH - mh - 12;

  g.save();
  g.fillStyle = 'rgba(14, 11, 8, 0.92)';
  g.fillRect(mx - 3, my - 15, mw + 6, mh + 18);
  g.strokeStyle = '#c9b07e';
  g.lineWidth = 1;
  g.strokeRect(mx - 2.5, my - 14.5, mw + 5, mh + 17);

  g.fillStyle = '#e9cfa0';
  g.font = '10px "Noto Serif CJK TC", sans-serif';
  g.textAlign = 'left';
  g.fillText('取景位置', mx + 2, my - 4);

  g.globalAlpha = 0.78;
  g.drawImage(img, mx, my, mw, mh);
  g.globalAlpha = 1;

  g.fillStyle = 'rgba(0, 0, 0, 0.32)';
  g.fillRect(mx, my, mw, mh);

  const rx = mx + crop.nx * mw;
  const ry = my + crop.ny * mh;
  const rw = crop.nw * mw;
  const rh = crop.nh * mh;
  g.drawImage(
    img,
    crop.nx * img.naturalWidth,
    crop.ny * img.naturalHeight,
    crop.nw * img.naturalWidth,
    crop.nh * img.naturalHeight,
    rx,
    ry,
    rw,
    rh
  );
  g.strokeStyle = '#f2c977';
  g.lineWidth = 1.6;
  g.strokeRect(rx, ry, rw, rh);
  g.restore();
}

/** Draw a classical vertical Lianhuanhua margin commentary strip (`夾批條`) along the left inner edge. */
function drawSideCommentarySlip(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  lines: readonly string[]
): void {
  const sw = 24;
  if (h < 120) return;
  g.save();
  g.fillStyle = 'rgba(223, 210, 180, 0.94)';
  g.fillRect(x, y, sw, h);
  g.strokeStyle = '#1b150e';
  g.lineWidth = 1.5;
  g.strokeRect(x + 0.5, y + 0.5, sw - 1, h - 1);
  g.strokeStyle = 'rgba(138, 42, 28, 0.55)';
  g.lineWidth = 0.8;
  g.strokeRect(x + 3, y + 3, sw - 6, h - 6);

  const chars = [...lines.join('')].slice(0, Math.max(4, Math.floor((h - 24) / 14)));
  g.fillStyle = '#1c150e';
  g.font = 'bold 11px "Noto Serif CJK TC", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  chars.forEach((ch, idx) => {
    g.fillText(ch, x + sw / 2, y + 15 + idx * 14);
  });
  g.textBaseline = 'alphabetic';
  g.restore();
}

function drawAtmosphericOverlay(g: CanvasRenderingContext2D, w: number, h: number, chIndex: number, t: number): void {
  if (chIndex === 0) drawParticles(g, w, h, t, 22, 'dust', 'rgba(255, 215, 135, 0.45)');
  else if (chIndex === 1) drawParticles(g, w, h, t, 12, 'mist', 'rgba(225, 218, 204, 0.38)');
  else if (chIndex === 2) drawParticles(g, w, h, t, 24, 'dust', 'rgba(255, 224, 170, 0.40)');
  else if (chIndex === 3) drawParticles(g, w, h, t, 30, 'rain', 'rgba(215, 200, 175, 0.22)');
  else if (chIndex === 4) drawParticles(g, w, h, t, 20, 'dust', 'rgba(255, 215, 175, 0.40)');
  else drawParticles(g, w, h, t, 14, 'mist', 'rgba(205, 218, 226, 0.32)');
}

function resolveEffectiveLayout(viewStyle: ReelViewStyle, beatIdx: number): EffectiveLianhuanhuaLayout {
  if (viewStyle === 'classic') return 'classic';
  if (viewStyle === 'diptych') return 'diptych';
  if (viewStyle === 'quad') return 'quad';
  if (viewStyle === 'closeup') return beatIdx % 2 === 0 ? 'closeup_left' : 'closeup_right';
  const cycle: EffectiveLianhuanhuaLayout[] = [
    'classic',
    'closeup_left',
    'diptych',
    'scroll',
    'same_day_triptych',
    'closing_plate',
  ];
  return cycle[((beatIdx % cycle.length) + cycle.length) % cycle.length] ?? 'classic';
}

// Reusable procedural film-grain pattern canvas (generated once).
let grainCanvas: HTMLCanvasElement | null = null;
function getGrainCanvas(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 28;
    }
    g.putImageData(img, 0, 0);
  }
  grainCanvas = c;
  return c;
}

function drawWoodcutHatch(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step: number, alpha: number) {
  g.save();
  g.strokeStyle = `rgba(245, 232, 200, ${alpha})`;
  g.lineWidth = 1;
  g.beginPath();
  for (let i = -h; i < w + h; i += step) {
    g.moveTo(x + i, y);
    g.lineTo(x + i - h * 0.45, y + h);
  }
  g.stroke();
  g.restore();
}

function drawParticles(g: CanvasRenderingContext2D, w: number, h: number, t: number, count: number, mode: 'dust' | 'rain' | 'mist', color: string) {
  g.save();
  g.fillStyle = color;
  g.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    const seed = (i * 137.53) % 1;
    const seed2 = (i * 293.17) % 1;
    if (mode === 'rain') {
      const x = ((seed * w + t * 55) % (w + 40)) - 20;
      const y = ((seed2 * h + t * 240) % (h + 40)) - 20;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 4, y + 12);
      g.stroke();
    } else if (mode === 'mist') {
      const x = ((seed * w + t * 14) % (w + 120)) - 60;
      const y = h * (0.55 + seed2 * 0.4);
      g.globalAlpha = 0.08 + 0.04 * Math.sin(t + i);
      g.beginPath();
      g.ellipse(x, y, 42 + seed * 30, 8, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      const x = ((seed * w + Math.sin(t * 0.5 + i) * 18) + w) % w;
      const y = ((seed2 * h - t * (8 + seed * 10)) % h + h) % h;
      g.globalAlpha = 0.25 + 0.25 * Math.sin(t * 2 + i);
      g.beginPath();
      g.arc(x, y, 1 + (i % 2) * 0.7, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

function drawBikeSilhouette(g: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.strokeStyle = col;
  g.lineWidth = 2.4;
  g.beginPath();
  g.arc(-22, -14, 13, 0, Math.PI * 2);
  g.arc(22, -14, 13, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-22, -14); g.lineTo(-4, -30); g.lineTo(15, -30); g.lineTo(0, -14); g.closePath();
  g.moveTo(15, -30); g.lineTo(22, -14);
  g.moveTo(13, -36); g.lineTo(19, -36);
  g.moveTo(-6, -34); g.lineTo(1, -34);
  g.stroke();
  g.restore();
}

/** Draw atmospheric 1989 archival Lianhuanhua scene across multiple traditional panels and camera angles. */
export function drawChapterArtwork(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  chKey: number | string,
  t: number,
  forceProcedural = false,
  assetKeyHint?: string,
  opts?: ReelArtworkOpts
): void {
  const resolved = resolveImageKey(chKey, assetKeyHint);
  const { idx: rawIdx, key: resolvedAssetKey } = resolved;
  const chIndex = mapProceduralArchetype(rawIdx, typeof chKey === 'string' ? chKey : assetKeyHint);

  const img = forceProcedural ? null : getChapterImage(chKey, assetKeyHint);
  const hasImg = isLoadedImg(img);
  const top = opts?.stageTop ?? 0;
  const bot = opts?.stageBottom ?? 0;
  const stageH = Math.max(80, h - top - bot);

  if (hasImg && img) {
    if (!opts) {
      g.save();
      const zoom = 1.04 + 0.03 * Math.sin(t * 0.22);
      const fx = 0.5 + Math.sin(t * 0.17) * 0.04;
      const fy = 0.5 + Math.cos(t * 0.13) * 0.03;
      drawCroppedImage(g, img, 0, 0, w, h, fx, fy, zoom);
      drawAtmosphericOverlay(g, w, h, chIndex, t);
      drawWoodcutHatch(g, 0, 0, w, h, 10, 0.028);
      drawLianhuanhuaPanelBorder(g, 4, 4, w - 8, h - 8, { cornerFret: true });
      g.restore();

      const grain = getGrainCanvas();
      const pat = g.createPattern(grain, 'repeat');
      if (pat) {
        g.save();
        g.translate(-Math.floor(Math.sin(t * 29) * 32), -Math.floor(Math.cos(t * 23) * 32));
        g.fillStyle = pat;
        g.fillRect(-64, -64, w + 128, h + 128);
        g.restore();
      }
      return;
    }

    const beatIdx = opts.beatIdx ?? 0;
    const bp = easeInOut(opts.beatProgress ?? ((t % 4) / 4));
    const viewStyle = opts.viewStyle ?? 'auto';
    const layout = resolveEffectiveLayout(viewStyle, beatIdx);
    const focal = getFocalPair(resolvedAssetKey, chIndex);

    // Aged ink-and-Xuan-paper stage backdrop inside the letterbox area
    g.save();
    g.fillStyle = '#14100b';
    g.fillRect(0, top, w, stageH);

    // Subtle Xuan-paper border/gutter mat under all panels
    g.fillStyle = '#cbbba0';
    g.fillRect(4, top + 3, w - 8, stageH - 6);
    g.fillStyle = '#18130d';
    g.fillRect(6, top + 5, w - 12, stageH - 10);

    const sx = 9;
    const sy = top + 8;
    const sw = w - 18;
    const sh = stageH - 16;

    if (layout === 'quad') {
      const allDay = getSameDayMetas(opts.dayKey);
      const slots: Array<{ meta?: ChapterMeta; vp: ViewpointId }> = ROUTE_PRIORITY.map(vp => ({
        vp,
        meta: allDay.find(m => m.viewpoint === vp),
      }));
      const gx = 7;
      const gy = 6;
      const cw = Math.floor((sw - gx) / 2);
      const ch = Math.floor((sh - gy) / 2);
      const coords = [
        [sx, sy, cw, ch],
        [sx + cw + gx, sy, sw - cw - gx, ch],
        [sx, sy + ch + gy, cw, sh - ch - gy],
        [sx + cw + gx, sy + ch + gy, sw - cw - gx, sh - ch - gy],
      ] as const;

      // Paint paper gutter grid behind the 4 frames
      g.fillStyle = '#d1c2a5';
      g.fillRect(sx - 2, sy - 2, sw + 4, sh + 4);

      slots.forEach((slot, idx) => {
        const [px, py, pw, ph] = coords[idx]!;
        const m = slot.meta;
        const cImg = m ? getChapterImage(m.id, m.assetKey) : null;
        const vpInfo = VIEWPOINT_LABELS[slot.vp];
        const isCurrent = Boolean(m && (m.id === chKey || m.assetKey === resolvedAssetKey));
        const activeImg = isLoadedImg(cImg) ? cImg : img;
        const fPair = m?.assetKey ? getFocalPair(m.assetKey, chIndex) : focal;
        const z = 1.03 + 0.06 * (0.5 + 0.5 * Math.sin(t * 0.45 + idx * 1.3));
        const fx = lerp(0.5, fPair.a[0], isLoadedImg(cImg) ? 0.35 : 0.75);
        const fy = lerp(0.5, fPair.a[1], isLoadedImg(cImg) ? 0.35 : 0.75);
        drawCroppedImage(g, activeImg, px, py, pw, ph, fx, fy, isLoadedImg(cImg) ? z : 1.35);
        drawLianhuanhuaPanelBorder(g, px, py, pw, ph, {
          badge: `〔${vpInfo.role}・${vpInfo.lead}〕`,
          seal: isCurrent ? '此刻視角' : undefined,
          activeHighlight: isCurrent,
        });
      });
    } else if (layout === 'same_day_triptych') {
      const prioritized = getSameDayMetas(opts.dayKey, typeof chKey === 'string' ? chKey : undefined);
      const curMeta = prioritized[0] ?? getChapterMeta(typeof chKey === 'string' ? chKey : resolvedAssetKey, assetKeyHint);
      const comp1 = prioritized[1];
      const comp2 = prioritized[2];

      const gx = 7;
      const gy = 6;
      const lw = Math.floor((sw - gx) * 0.57);
      const rw = sw - gx - lw;
      const rh1 = Math.floor((sh - gy) / 2);
      const rh2 = sh - gy - rh1;

      g.fillStyle = '#d1c2a5';
      g.fillRect(sx - 2, sy - 2, sw + 4, sh + 4);

      // Left primary route panel
      drawCroppedImage(
        g,
        img,
        sx,
        sy,
        lw,
        sh,
        lerp(0.5, focal.a[0], 0.42),
        lerp(0.5, focal.a[1], 0.42),
        1.06 + 0.06 * bp
      );
      const curVp = curMeta.viewpoint ?? 'student';
      drawLianhuanhuaPanelBorder(g, sx, sy, lw, sh, {
        cornerFret: true,
        badge: `〔第伍幅・${VIEWPOINT_LABELS[curVp].role}線〕`,
        seal: '同日並紀',
        activeHighlight: true,
      });

      // Right top & bottom companion route panels from exact same dayKey
      const comps: Array<[ChapterMeta | undefined, number, number, number, number]> = [
        [comp1, sx + lw + gx, sy, rw, rh1],
        [comp2, sx + lw + gx, sy + rh1 + gy, rw, rh2],
      ];
      comps.forEach(([cm, cx, cy, cw, ch], idx) => {
        const cImg = cm ? getChapterImage(cm.id, cm.assetKey) : null;
        const cVp = cm?.viewpoint ?? ROUTE_PRIORITY[(idx + 1) % ROUTE_PRIORITY.length]!;
        const cInfo = VIEWPOINT_LABELS[cVp];
        const useCImg = isLoadedImg(cImg);
        const targetImg = useCImg ? cImg : img;
        const fp = cm?.assetKey ? getFocalPair(cm.assetKey, chIndex) : focal;
        drawCroppedImage(
          g,
          targetImg,
          cx,
          cy,
          cw,
          ch,
          useCImg ? lerp(0.5, fp.a[0], 0.4) : fp.b[0],
          useCImg ? lerp(0.5, fp.a[1], 0.4) : fp.b[1],
          useCImg ? 1.06 + 0.04 * bp : 1.45
        );
        drawLianhuanhuaPanelBorder(g, cx, cy, cw, ch, {
          badge: `〔同日・${cInfo.role}・${cInfo.lead}〕`,
        });
      });
    } else if (layout === 'diptych') {
      const gx = 8;
      const lw = Math.floor((sw - gx) * 0.56);
      const rw = sw - gx - lw;
      const lx = sx;
      const rx = sx + lw + gx;

      g.fillStyle = '#d1c2a5';
      g.fillRect(sx - 2, sy - 2, sw + 4, sh + 4);

      drawCroppedImage(
        g,
        img,
        lx,
        sy,
        lw,
        sh,
        lerp(0.47, 0.52, bp),
        lerp(0.48, 0.52, bp),
        1.03 + 0.04 * bp
      );
      drawLianhuanhuaPanelBorder(g, lx, sy, lw, sh, {
        cornerFret: true,
        badge: beatIdx === 2 && viewStyle === 'auto' ? '〔第叁幅・遠景主景〕' : '〔主景・廣角視野〕',
      });

      const detFx = lerp(focal.a[0], focal.b[0], bp * 0.72);
      const detFy = lerp(focal.a[1], focal.b[1], bp * 0.72);
      drawCroppedImage(g, img, rx, sy, rw, sh, detFx, detFy, 1.52 + 0.1 * bp);
      drawLianhuanhuaPanelBorder(g, rx, sy, rw, sh, {
        badge: '〔近景・細部特寫〕',
        seal: '細部圖誌',
      });
    } else if (layout === 'closeup_left' || layout === 'closeup_right') {
      const slipW = 26;
      const imgX = layout === 'closeup_left' ? sx + slipW + 4 : sx;
      const imgW = layout === 'closeup_left' ? sw - slipW - 4 : sw;
      const targetFocal = layout === 'closeup_left' ? focal.a : focal.b;
      const startPt: [number, number] = layout === 'closeup_left' ? focal.a : focal.b;
      const endPt: [number, number] = layout === 'closeup_left' ? focal.b : focal.a;
      const fx = lerp(startPt[0], endPt[0], bp * 0.55);
      const fy = lerp(startPt[1], endPt[1], bp * 0.55);
      const z = lerp(1.30, 1.44, bp);

      if (layout === 'closeup_left') {
        drawSideCommentarySlip(g, sx, sy, sh, [
          `第${CHINESE_NUM[beatIdx] ?? beatIdx + 1}幅`,
          '人物近景細觀',
        ]);
      }

      const cropNorm = drawCroppedImage(g, img, imgX, sy, imgW, sh, lerp(targetFocal[0], fx, 0.7), fy, z);
      drawAtmosphericOverlay(g, w, stageH, chIndex, t);
      drawLianhuanhuaPanelBorder(g, imgX, sy, imgW, sh, {
        cornerFret: true,
        badge:
          viewStyle === 'auto'
            ? `〔第${CHINESE_NUM[beatIdx] ?? beatIdx + 1}幅・人物近景〕`
            : `〔長卷特寫・第${CHINESE_NUM[beatIdx] ?? beatIdx + 1}段〕`,
        seal: '工筆細節',
      });
      drawOverviewLocator(g, img, cropNorm, imgX, sy, imgW, sh);
    } else if (layout === 'scroll') {
      const fx = lerp(0.24, 0.76, bp);
      const fy = 0.46 + 0.04 * Math.sin(bp * Math.PI);
      const cropNorm = drawCroppedImage(g, img, sx, sy, sw, sh, fx, fy, 1.24 + 0.04 * Math.sin(bp * Math.PI));
      drawAtmosphericOverlay(g, w, stageH, chIndex, t);
      drawLianhuanhuaPanelBorder(g, sx, sy, sw, sh, {
        cornerFret: true,
        badge: `〔第肆幅・長卷橫搖〕`,
        seal: '長卷漫覽',
      });
      drawOverviewLocator(g, img, cropNorm, sx, sy, sw, sh);
    } else if (layout === 'closing_plate') {
      const mx = sx + 10;
      const my = sy + 6;
      const mw = sw - 20;
      const mh = sh - 12;
      g.fillStyle = '#d1c2a5';
      g.fillRect(sx - 2, sy - 2, sw + 4, sh + 4);
      const z = lerp(1.13, 1.01, bp);
      drawCroppedImage(g, img, mx, my, mw, mh, lerp(focal.a[0], 0.5, bp), lerp(focal.a[1], 0.5, bp), z);
      drawAtmosphericOverlay(g, w, stageH, chIndex, t);
      drawLianhuanhuaPanelBorder(g, mx, my, mw, mh, {
        cornerFret: true,
        badge: opts.pageNumber ?? '〔第陸幅・壓頁題跋〕',
        seal: '春日紀事',
      });
    } else {
      // 'classic'
      const fx = lerp(0.47, 0.53, (bp + beatIdx * 0.19) % 1);
      const fy = lerp(0.45, 0.54, ((beatIdx % 3) * 0.35 + bp * 0.3));
      const z = 1.02 + 0.06 * Math.sin((bp + beatIdx * 0.25) * Math.PI);
      drawCroppedImage(g, img, sx, sy, sw, sh, fx, fy, z);
      drawAtmosphericOverlay(g, w, stageH, chIndex, t);
      drawLianhuanhuaPanelBorder(g, sx, sy, sw, sh, {
        cornerFret: true,
        badge: opts.pageNumber ?? `〔第${CHINESE_NUM[beatIdx] ?? beatIdx + 1}幅・傳統冊頁〕`,
        seal: '己巳春紀',
      });
    }

    drawWoodcutHatch(g, sx, sy, sw, sh, 10, 0.025);
    g.restore();

    const grain = getGrainCanvas();
    const pat = g.createPattern(grain, 'repeat');
    if (pat) {
      g.save();
      g.translate(-Math.floor(Math.sin(t * 29) * 32), -Math.floor(Math.cos(t * 23) * 32));
      g.fillStyle = pat;
      g.fillRect(-64, top - 64, w + 128, stageH + 128);
      g.restore();
    }
    const vig = g.createRadialGradient(w / 2, top + stageH / 2, Math.min(w, stageH) * 0.34, w / 2, top + stageH / 2, Math.max(w, stageH) * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(4,5,10,0.44)');
    g.fillStyle = vig;
    g.fillRect(0, top, w, stageH);
    return;
  }

  // Fallback to procedural archival sketch if image is missing/not loaded yet
  g.save();
  const zoom = 1.04 + 0.035 * Math.sin(t * 0.22);
  const panX = Math.sin(t * 0.17) * (w * 0.018);
  const panY = Math.cos(t * 0.13) * (h * 0.012);
  g.translate(w / 2 + panX, h / 2 + panY);
  g.scale(zoom, zoom);
  g.translate(-w / 2, -h / 2);

  if (chIndex === 0) {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#070a14');
    sky.addColorStop(0.55, '#151c2e');
    sky.addColorStop(1, '#262119');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);

    g.fillStyle = '#0f131d';
    g.fillRect(w * 0.04, h * 0.26, w * 0.26, h * 0.52);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        if ((r + c * 2) % 3 !== 0) {
          g.fillStyle = (r + c) % 2 === 0 ? 'rgba(245, 200, 115, 0.72)' : 'rgba(230, 210, 170, 0.35)';
          g.fillRect(w * 0.065 + c * (w * 0.044), h * 0.31 + r * (h * 0.09), w * 0.022, h * 0.045);
        }
      }
    }

    const gx = w * 0.56, gy = h * 0.74;
    g.fillStyle = '#121015';
    g.fillRect(gx - w * 0.21, gy - h * 0.15, w * 0.42, h * 0.16);
    g.fillStyle = '#1a1210';
    g.beginPath();
    g.moveTo(gx - w * 0.13, gy - h * 0.28);
    g.quadraticCurveTo(gx, gy - h * 0.46, gx + w * 0.13, gy - h * 0.28);
    g.lineTo(gx + w * 0.09, gy - h * 0.21);
    g.lineTo(gx - w * 0.09, gy - h * 0.21);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(gx - w * 0.23, gy - h * 0.19);
    g.quadraticCurveTo(gx - w * 0.14, gy - h * 0.29, gx - w * 0.08, gy - h * 0.19);
    g.lineTo(gx + w * 0.08, gy - h * 0.19);
    g.quadraticCurveTo(gx + w * 0.14, gy - h * 0.29, gx + w * 0.23, gy - h * 0.19);
    g.fill();
    g.fillStyle = '#6c251d';
    for (const dx of [-0.075, -0.025, 0.025, 0.075]) {
      g.fillRect(gx + w * dx - 3, gy - h * 0.21, 6, h * 0.21);
    }
    g.fillStyle = '#f0c46c';
    g.fillRect(gx - 22, gy - h * 0.24, 44, 11);
    g.fillStyle = `rgba(255, 110, 60, ${0.75 + 0.15 * Math.sin(t * 2.5)})`;
    g.beginPath();
    g.arc(gx - w * 0.05, gy - h * 0.18, 4.5, 0, Math.PI * 2);
    g.arc(gx + w * 0.05, gy - h * 0.18, 4.5, 0, Math.PI * 2);
    g.fill();

    const lx = w * 0.78, ly = h * 0.27;
    const cone = g.createRadialGradient(lx, ly, 4, lx, h * 0.72, h * 0.65);
    cone.addColorStop(0, 'rgba(255, 224, 138, 0.92)');
    cone.addColorStop(0.25, 'rgba(240, 175, 76, 0.28)');
    cone.addColorStop(1, 'rgba(240, 175, 76, 0)');
    g.fillStyle = cone;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b1d24';
    g.fillRect(lx - 2, ly, 4, h * 0.55);

    g.fillStyle = '#0d0e13';
    g.fillRect(0, gy, w, h - gy);
    g.fillStyle = '#271e15';
    g.fillRect(w * 0.14, gy - h * 0.2, w * 0.18, h * 0.16);
    g.fillStyle = '#dfd4b4';
    for (let i = 0; i < 4; i++) {
      g.fillRect(w * 0.155 + i * w * 0.038, gy - h * 0.18, w * 0.026, h * 0.11);
    }
    drawBikeSilhouette(g, w * 0.74, gy + h * 0.04, Math.min(w, h) / 210, '#101218');
    drawParticles(g, w, h, t, 26, 'dust', 'rgba(255, 215, 135, 0.55)');
  } else if (chIndex === 1) {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0c1322');
    sky.addColorStop(0.45, '#253147');
    sky.addColorStop(0.72, '#8b8378');
    sky.addColorStop(0.84, '#dfbe95');
    sky.addColorStop(1, '#262321');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);

    const hy = h * 0.72;
    g.fillStyle = '#2a2d36';
    g.fillRect(w * 0.06, hy - h * 0.14, w * 0.34, h * 0.14);
    g.fillStyle = '#404552';
    for (let i = 0; i < 8; i++) {
      g.fillRect(w * 0.09 + i * w * 0.035, hy - h * 0.12, 4, h * 0.12);
    }
    g.fillStyle = '#1e2028';
    g.beginPath();
    g.moveTo(w * 0.67, hy);
    g.lineTo(w * 0.678, hy - h * 0.44);
    g.lineTo(w * 0.688, hy - h * 0.48);
    g.lineTo(w * 0.698, hy - h * 0.44);
    g.lineTo(w * 0.706, hy);
    g.closePath();
    g.fill();

    g.fillStyle = '#14161e';
    g.fillRect(0, hy, w, h - hy);
    for (let i = 0; i < 5; i++) {
      const px = w * (0.12 + i * 0.18);
      const py = hy - h * 0.24 + i * 6;
      g.fillStyle = '#1c1d24';
      g.fillRect(px, py, 3, hy - py);
      const glow = g.createRadialGradient(px, py, 1, px, py, 38);
      glow.addColorStop(0, 'rgba(255, 214, 130, 0.75)');
      glow.addColorStop(1, 'rgba(255, 214, 130, 0)');
      g.fillStyle = glow;
      g.fillRect(px - 38, py - 38, 76, 76);
    }

    g.fillStyle = '#0c0d12';
    for (let i = 0; i < 34; i++) {
      const mx = w * (0.08 + i * 0.027);
      const my = hy + h * 0.04 + (i % 3) * 7;
      const bob = Math.sin(t * 4.2 + i) * 1.5;
      g.beginPath();
      g.arc(mx, my - 20 + bob, 4.5, 0, Math.PI * 2);
      g.fill();
      g.fillRect(mx - 5, my - 15 + bob, 10, 22);
    }
    for (const [bx, col] of [[w * 0.28, '#9b2922'], [w * 0.52, '#d8cfb8'], [w * 0.76, '#9b2922']] as const) {
      const sway = Math.sin(t * 2.4 + bx) * 4;
      g.fillStyle = '#4e4234';
      g.fillRect(bx, hy - h * 0.26, 2.5, h * 0.3);
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(bx + 2, hy - h * 0.26);
      g.lineTo(bx + 32 + sway, hy - h * 0.24);
      g.lineTo(bx + 28 + sway * 0.8, hy - h * 0.16);
      g.lineTo(bx + 2, hy - h * 0.17);
      g.closePath();
      g.fill();
    }
    drawParticles(g, w, h, t, 14, 'mist', 'rgba(225, 218, 204, 0.5)');
  } else if (chIndex === 2) {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2a2219');
    sky.addColorStop(0.5, '#6a4e33');
    sky.addColorStop(0.85, '#c7975d');
    sky.addColorStop(1, '#3f3427');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);

    const hy = h * 0.74;
    g.fillStyle = '#3c2e22';
    g.fillRect(w * 0.485, hy - h * 0.42, w * 0.03, h * 0.42);
    g.fillStyle = '#241c15';
    g.fillRect(0, hy, w, h - hy);

    const tents = [[0.14, 0.76, 0.16, '#485442'], [0.3, 0.78, 0.14, '#5a5a4e'], [0.44, 0.75, 0.12, '#3d4c5c'], [0.58, 0.77, 0.13, '#63523c']];
    for (const [tx, ty, tw, col] of tents as [number, number, number, string][]) {
      const cx = w * tx, cy = h * ty, bw = w * tw, bh = bw * 0.48;
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(cx - bw / 2, cy);
      g.lineTo(cx, cy - bh);
      g.lineTo(cx + bw / 2, cy);
      g.closePath();
      g.fill();
      g.fillStyle = '#2d241b';
      g.fillRect(cx - 1, cy - bh - 20, 2, 22);
      g.fillStyle = '#b43428';
      g.fillRect(cx + 1, cy - bh - 20, 14, 9);
    }

    const px = w * 0.22, py = h * 0.34;
    g.fillStyle = '#1f1914';
    g.fillRect(px - 2, py, 4, hy - py);
    g.strokeStyle = `rgba(246, 220, 165, ${0.35 + 0.25 * Math.sin(t * 3)})`;
    g.lineWidth = 1.5;
    for (let r = 1; r <= 3; r++) {
      const rad = ((t * 24 + r * 14) % 45) + 8;
      g.beginPath();
      g.arc(px + 8, py + 8, rad, -0.7, 0.7);
      g.stroke();
    }

    const ax = w * 0.76, ay = hy + h * 0.02;
    g.fillStyle = '#d8d4c8';
    g.fillRect(ax - 44, ay - 30, 88, 28);
    g.fillStyle = '#9c261e';
    g.fillRect(ax - 44, ay - 15, 88, 5);
    g.fillRect(ax - 6, ay - 26, 12, 4);
    g.fillRect(ax - 2, ay - 30, 4, 12);
    g.fillStyle = '#171717';
    g.beginPath();
    g.arc(ax - 24, ay, 7, 0, Math.PI * 2);
    g.arc(ax + 24, ay, 7, 0, Math.PI * 2);
    g.fill();
    const flash = Math.sin(t * 7) > 0;
    const bglow = g.createRadialGradient(ax, ay - 34, 2, ax, ay - 34, 72);
    bglow.addColorStop(0, flash ? 'rgba(235, 65, 50, 0.85)' : 'rgba(70, 145, 240, 0.85)');
    bglow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bglow;
    g.fillRect(ax - 72, ay - 106, 144, 144);
    drawParticles(g, w, h, t, 30, 'dust', 'rgba(255, 224, 170, 0.45)');
  } else if (chIndex === 3) {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#05070e');
    sky.addColorStop(0.55, '#131824');
    sky.addColorStop(1, '#2a2118');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);

    g.strokeStyle = 'rgba(180, 175, 160, 0.25)';
    g.lineWidth = 1;
    for (const wy of [h * 0.22, h * 0.27]) {
      g.beginPath(); g.moveTo(0, wy); g.lineTo(w, wy - 12); g.stroke();
    }

    const hy = h * 0.76;
    g.fillStyle = '#0e1017';
    g.fillRect(0, hy, w, h - hy);

    const drawBus = (bx: number, by: number, scale: number, dir: number) => {
      g.save();
      g.translate(bx, by);
      g.scale(scale * dir, scale);
      g.fillStyle = '#2d353d';
      g.fillRect(-90, -48, 180, 44);
      g.fillStyle = '#8b2f26';
      g.fillRect(-90, -18, 180, 8);
      g.fillStyle = '#181a20';
      g.fillRect(-4, -47, 8, 42);
      g.fillStyle = 'rgba(255, 215, 130, 0.45)';
      for (let i = 0; i < 6; i++) g.fillRect(-78 + i * 26, -40, 18, 16);
      g.strokeStyle = '#606060';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(-20, -48); g.lineTo(-48, -90); g.stroke();
      const beam = g.createLinearGradient(90, -14, 240, 6);
      beam.addColorStop(0, 'rgba(255, 232, 168, 0.65)');
      beam.addColorStop(1, 'rgba(255, 232, 168, 0)');
      g.fillStyle = beam;
      g.beginPath();
      g.moveTo(90, -16);
      g.lineTo(240, -34);
      g.lineTo(240, 18);
      g.lineTo(90, -8);
      g.closePath();
      g.fill();
      g.restore();
    };
    drawBus(w * 0.34, hy - h * 0.02, Math.min(w, h) / 230, 1);
    drawBus(w * 0.72, hy + h * 0.02, Math.min(w, h) / 215, -1);

    g.fillStyle = '#090b10';
    for (let i = 0; i < 16; i++) {
      const cx = w * (0.12 + i * 0.052);
      const cy = hy + h * 0.06 + (i % 2) * 5;
      g.beginPath(); g.arc(cx, cy - 19, 4.5, 0, Math.PI * 2); g.fill();
      g.fillRect(cx - 5, cy - 14, 10, 22);
    }
    drawParticles(g, w, h, t, 36, 'rain', 'rgba(215, 200, 175, 0.25)');
  } else if (chIndex === 4) {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#161124');
    sky.addColorStop(0.45, '#472a43');
    sky.addColorStop(0.76, '#b06445');
    sky.addColorStop(1, '#261e21');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);

    const hy = h * 0.78;
    g.fillStyle = '#251a24';
    g.fillRect(w * 0.14, hy - h * 0.14, w * 0.72, h * 0.14);
    g.fillRect(w * 0.26, hy - h * 0.22, w * 0.48, h * 0.08);
    g.fillStyle = '#18131a';
    g.fillRect(0, hy, w, h - hy);

    const sx = w * 0.5;
    for (const fx of [w * 0.28, w * 0.72]) {
      const beam = g.createLinearGradient(fx, hy, sx, h * 0.18);
      beam.addColorStop(0, 'rgba(255, 234, 185, 0.32)');
      beam.addColorStop(1, 'rgba(255, 234, 185, 0)');
      g.fillStyle = beam;
      g.beginPath();
      g.moveTo(fx - 6, hy);
      g.lineTo(sx - 44, h * 0.18);
      g.lineTo(sx + 44, h * 0.18);
      g.lineTo(fx + 6, hy);
      g.closePath();
      g.fill();
    }

    g.strokeStyle = '#6e6568';
    g.lineWidth = 2;
    g.fillStyle = '#332d32';
    g.fillRect(sx - 24, hy - h * 0.18, 48, h * 0.18);
    g.strokeRect(sx - 26, hy - h * 0.18, 52, h * 0.18);
    g.beginPath();
    g.moveTo(sx - 26, hy - h * 0.18); g.lineTo(sx + 26, hy);
    g.moveTo(sx + 26, hy - h * 0.18); g.lineTo(sx - 26, hy);
    g.stroke();

    g.fillStyle = '#f2ede4';
    g.beginPath();
    g.moveTo(sx - 20, hy - h * 0.18);
    g.lineTo(sx - 12, hy - h * 0.52);
    g.lineTo(sx - 22, hy - h * 0.67);
    g.lineTo(sx - 15, hy - h * 0.69);
    g.lineTo(sx - 5, hy - h * 0.56);
    g.lineTo(sx, hy - h * 0.64);
    g.lineTo(sx + 5, hy - h * 0.56);
    g.lineTo(sx + 15, hy - h * 0.69);
    g.lineTo(sx + 22, hy - h * 0.67);
    g.lineTo(sx + 12, hy - h * 0.52);
    g.lineTo(sx + 20, hy - h * 0.18);
    g.closePath();
    g.fill();
    g.beginPath(); g.arc(sx, hy - h * 0.59, 6.5, 0, Math.PI * 2); g.fill();
    const tg = g.createRadialGradient(sx, hy - h * 0.72, 2, sx, hy - h * 0.72, 46);
    tg.addColorStop(0, `rgba(255, 240, 190, ${0.85 + 0.15 * Math.sin(t * 3)})`);
    tg.addColorStop(1, 'rgba(255, 195, 110, 0)');
    g.fillStyle = tg;
    g.fillRect(sx - 46, hy - h * 0.72 - 46, 92, 92);

    g.fillStyle = '#110d14';
    for (let i = 0; i < 20; i++) {
      const cx = w * (0.14 + i * 0.038);
      if (Math.abs(cx - sx) < 28) continue;
      g.beginPath(); g.arc(cx, hy - 14, 4, 0, Math.PI * 2); g.fill();
      g.fillRect(cx - 4, hy - 10, 8, 18);
    }
    drawParticles(g, w, h, t, 22, 'dust', 'rgba(255, 215, 175, 0.45)');
  } else {
    const sky = g.createLinearGradient(0, 0, w, h);
    sky.addColorStop(0, '#070a15');
    sky.addColorStop(0.55, '#192231');
    sky.addColorStop(1, '#798b96');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);

    const hy = h * 0.76;
    g.fillStyle = '#24272c';
    g.fillRect(0, h * 0.24, w * 0.56, hy - h * 0.24);
    g.fillStyle = '#6c231c';
    g.fillRect(w * 0.16, h * 0.36, w * 0.18, hy - h * 0.36);
    g.fillStyle = '#191b1f';
    g.beginPath();
    g.moveTo(w * 0.12, h * 0.36);
    g.lineTo(w * 0.25, h * 0.27);
    g.lineTo(w * 0.38, h * 0.36);
    g.closePath();
    g.fill();
    const lg = g.createRadialGradient(w * 0.35, h * 0.42, 2, w * 0.35, h * 0.42, 54);
    lg.addColorStop(0, 'rgba(255, 200, 105, 0.88)');
    lg.addColorStop(1, 'rgba(255, 200, 105, 0)');
    g.fillStyle = lg;
    g.fillRect(w * 0.35 - 54, h * 0.42 - 54, 108, 108);

    g.fillStyle = '#10131a';
    g.fillRect(0, hy, w, h - hy);
    const rx = w * 0.46, ry = hy - h * 0.14;
    g.fillStyle = '#2d251d';
    g.fillRect(rx, ry, 52, 34);
    g.fillStyle = '#f2c76e';
    g.fillRect(rx + 8, ry + 7, 26, 9);
    g.strokeStyle = `rgba(180, 215, 235, ${0.35 + 0.25 * Math.sin(t * 2.5)})`;
    g.lineWidth = 1.4;
    for (let r = 1; r <= 3; r++) {
      g.beginPath();
      g.arc(rx + 46, ry - 4, 10 + ((t * 16 + r * 12) % 32), -Math.PI * 0.75, -Math.PI * 0.15);
      g.stroke();
    }

    g.fillStyle = 'rgba(216, 224, 226, 0.14)';
    g.beginPath();
    g.moveTo(w * 0.62, 0); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(w * 0.54, h);
    g.closePath();
    g.fill();
    g.fillStyle = '#ede5d2';
    g.fillRect(w * 0.66, hy - h * 0.12, w * 0.24, h * 0.16);
    g.fillStyle = '#b9ad95';
    g.fillRect(w * 0.78, hy - h * 0.12, 2, h * 0.16);
    for (let l = 0; l < 4; l++) {
      g.fillRect(w * 0.68, hy - h * 0.09 + l * 7, w * 0.08, 1.5);
      g.fillRect(w * 0.80, hy - h * 0.09 + l * 7, w * 0.08, 1.5);
    }
    drawParticles(g, w, h, t, 18, 'mist', 'rgba(205, 218, 226, 0.4)');
  }

  g.restore();

  drawWoodcutHatch(g, 0, 0, w, h, 9, 0.035);
  const grain = getGrainCanvas();
  const pat = g.createPattern(grain, 'repeat');
  if (pat) {
    g.save();
    g.translate(-Math.floor(Math.sin(t * 29) * 32), -Math.floor(Math.cos(t * 23) * 32));
    g.fillStyle = pat;
    g.fillRect(-64, -64, w + 128, h + 128);
    g.restore();
  }
  const vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(4,5,10,0.68)');
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);
}

/** Mount animated procedural archival banner (plus asset image overlay via meta.assetKey). */
export function mountChapterBanner(
  host: HTMLElement,
  chapterId: string,
  opts?: { onPlayReel?: () => void; assetKey?: string }
): () => void {
  const meta = getChapterMeta(chapterId, opts?.assetKey);
  const wrap = document.createElement('div');
  wrap.className = 'cine-banner';

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 240;
  canvas.className = 'cine-canvas';
  wrap.appendChild(canvas);

  const overlay = document.createElement('div');
  overlay.className = 'cine-overlay';
  overlay.innerHTML = `<div class="cine-meta"><span class="cine-stamp">${esc(meta.dateStamp)}</span><span class="cine-sub">${esc(meta.subtitle)}</span></div>
    <p class="cine-ctx">${esc(meta.context)}</p>`;
  wrap.appendChild(overlay);

  if (opts?.onPlayReel) {
    const btn = document.createElement('button');
    btn.className = 'cine-play-btn';
    btn.type = 'button';
    btn.textContent = '▶ 播放本章紀錄短片';
    btn.onclick = opts.onPlayReel;
    wrap.appendChild(btn);
  }

  host.prepend(wrap);

  let raf = 0;
  let last = 0;
  const startMs = performance.now();
  const ctx = canvas.getContext('2d');

  const draw = (now: number) => {
    if (!canvas.isConnected) return;
    if (now - last >= 33) {
      last = now;
      if (ctx) drawChapterArtwork(ctx, canvas.width, canvas.height, meta.id, (now - startMs) / 1000, false, meta.assetKey);
    }
    raf = requestAnimationFrame(draw);
  };
  if (ctx) drawChapterArtwork(ctx, canvas.width, canvas.height, meta.id, 0, false, meta.assetKey);
  raf = requestAnimationFrame(draw);

  return () => {
    if (raf) cancelAnimationFrame(raf);
  };
}
