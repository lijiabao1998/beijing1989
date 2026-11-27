export const OPENING_TOTAL_SEC = 34.0;

export interface OpeningPreludeCallbacks {
  onUnlockAudio: () => void;
  onToggleAudio: () => boolean;
  isAudioOn: () => boolean;
  isAudioUnlocked?: () => boolean;
  onStart?: () => void;
  onFinish?: () => void;
}

export interface OpeningPreludeController {
  play(startSec?: number): void;
  seek(sec: number): void;
  skip(): void;
  isActive(): boolean;
  getTime(): number;
  destroy(): void;
}

type MovementMode = 'black' | 'single' | 'diptych' | 'crossfade' | 'tribute' | 'title_reveal';

interface MovementSpec {
  id: string;
  start: number;
  end: number;
  mode: MovementMode;
  stamp: string;
  assets: readonly string[];
  panStart: readonly [number, number];
  panEnd: readonly [number, number];
  scaleStart: number;
  scaleEnd: number;
  seal?: string;
  lines: readonly { text: string; em?: boolean }[];
  credit: string;
  heroTitle?: string;
  heroSub?: string;
}

const OPENING_ASSETS = ['ch0', 'w0', 'r0', 'j0', 'ch_0427', 'ch5'] as const;

const OPENING_MOVEMENTS: readonly MovementSpec[] = [
  {
    id: 'prologue',
    start: 0.0,
    end: 5.8,
    mode: 'black',
    stamp: '一九八九・春・北京',
    assets: [],
    panStart: [0.5, 0.5],
    panEnd: [0.5, 0.5],
    scaleStart: 1.0,
    scaleEnd: 1.0,
    lines: [
      { text: '如果提前知道了那個春天的結局，' },
      { text: '你是否依然有勇氣，走進一九八九年的北京？', em: true },
    ],
    credit: 'If you already knew how that spring would end, would you still step inside?',
  },
  {
    id: 'student',
    start: 5.8,
    end: 11.4,
    mode: 'single',
    stamp: '四月十七日・海淀三角地',
    assets: ['ch0'],
    panStart: [0.56, 0.50],
    panEnd: [0.46, 0.44],
    scaleStart: 1.04,
    scaleEnd: 1.13,
    lines: [
      { text: '有人在四月的晚風裡貼下一張白紙，' },
      { text: '相信一句真話，能讓遠處的燈亮久一點。' },
    ],
    credit: '陳立・物理系學生',
  },
  {
    id: 'worker_resident',
    start: 11.4,
    end: 17.0,
    mode: 'diptych',
    stamp: '廠房天窗・西單院燈',
    assets: ['w0', 'r0'],
    panStart: [0.54, 0.50],
    panEnd: [0.46, 0.45],
    scaleStart: 1.04,
    scaleEnd: 1.12,
    lines: [
      { text: '有人守著天窗下的車床，有人把熱茶留給晚歸的街坊；' },
      { text: '大時代的風，從來都先吹過普通人的窗台。', em: true },
    ],
    credit: '王建國・第二機床廠車工 ／ 沈淑芬・西單四合院護師',
  },
  {
    id: 'journalist_changan',
    start: 17.0,
    end: 22.8,
    mode: 'crossfade',
    stamp: '四月廿七日・長安街',
    assets: ['j0', 'ch_0427'],
    panStart: [0.46, 0.52],
    panEnd: [0.55, 0.45],
    scaleStart: 1.04,
    scaleEnd: 1.12,
    lines: [
      { text: '有人舉起三十五毫米鏡頭，讓城市記得自己曾如何真心；' },
      { text: '長街上成千上萬張臉，彼此遞過一瓶水，便成了歷史。' },
    ],
    credit: '顧明遠・首都晨報記者 ／ 1989 年春・長安街',
  },
  {
    id: 'tribute',
    start: 22.8,
    end: 28.8,
    mode: 'tribute',
    stamp: '致敬・一九八九',
    assets: ['ch5'],
    panStart: [0.52, 0.52],
    panEnd: [0.48, 0.46],
    scaleStart: 1.03,
    scaleEnd: 1.10,
    seal: '一九八九・京華',
    lines: [
      { text: '歷史的結果早已寫定，' },
      { text: '唯有普通人給出的真心、善意與守望，不曾褪色。' },
      { text: '愛你所愛，行你所行，聽從你心，無問西東。', em: true },
    ],
    credit: '謹以此作，致敬一九八九年北京城裡的每一個普通人',
  },
  {
    id: 'title_reveal',
    start: 28.8,
    end: OPENING_TOTAL_SEC,
    mode: 'title_reveal',
    stamp: '序幕・初見',
    assets: [],
    panStart: [0.5, 0.5],
    panEnd: [0.5, 0.5],
    scaleStart: 1.0,
    scaleEnd: 1.0,
    seal: '京華・八九',
    lines: [],
    credit: '',
    heroTitle: '北京，一九八九',
    heroSub: 'AN ORDINARY SPRING ・ 一個平凡的春天',
  },
];

interface DustMote {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  alpha: number;
  phase: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function createDustMotes(count: number): DustMote[] {
  const motes: DustMote[] = [];
  let seed = 19890417;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    motes.push({
      x: rand(),
      y: rand(),
      r: 0.9 + rand() * 1.9,
      vy: 0.008 + rand() * 0.016,
      vx: (rand() - 0.5) * 0.006,
      alpha: 0.14 + rand() * 0.34,
      phase: rand() * Math.PI * 2,
    });
  }
  return motes;
}

function createGrainTile(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  if (!g) return c;
  const img = g.createImageData(128, 128);
  const d = img.data;
  let seed = 890604;
  for (let i = 0; i < d.length; i += 4) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const v = 100 + ((seed >>> 16) % 115);
    d[i] = v;
    d[i + 1] = Math.max(0, v - 6);
    d[i + 2] = Math.max(0, v - 14);
    d[i + 3] = 28 + ((seed >>> 24) % 34);
  }
  g.putImageData(img, 0, 0);
  return c;
}

function drawCoverKenBurns(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number,
  focusX: number,
  focusY: number,
  alpha: number,
  tint: string,
): void {
  if (!img || !img.complete || img.naturalWidth === 0 || img.naturalHeight === 0 || alpha <= 0.005) {
    return;
  }
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const coverScale = Math.max(w / iw, h / ih) * scale;
  const dw = iw * coverScale;
  const dh = ih * coverScale;
  const dx = x + w * 0.5 - dw * clamp(focusX, 0.25, 0.75);
  const dy = y + h * 0.5 - dh * clamp(focusY, 0.25, 0.75);
  const clampedX = Math.min(x, Math.max(x + w - dw, dx));
  const clampedY = Math.min(y, Math.max(y + h - dh, dy));

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.drawImage(img, clampedX, clampedY, dw, dh);
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

export function mountOpeningPrelude(
  root: HTMLDialogElement,
  cb: OpeningPreludeCallbacks,
): OpeningPreludeController {
  root.innerHTML = `
    <canvas id="op-canvas" aria-hidden="true"></canvas>
    <div class="op-bar op-bar-top">
      <span class="op-badge">一九八九・電影版序幕</span>
      <span class="op-counter" id="op-counter">01 / 06</span>
    </div>
    <div class="op-stage" id="op-stage" tabindex="-1" aria-live="polite">
      <div class="op-stamp" id="op-stamp"></div>
      <div class="op-seal" id="op-seal" hidden></div>
      <div class="op-lines" id="op-lines"></div>
      <div class="op-hero" id="op-hero" hidden>
        <h1 class="op-hero-title" id="op-hero-title"></h1>
        <p class="op-hero-sub" id="op-hero-sub"></p>
      </div>
      <div class="op-sub" id="op-sub"></div>
    </div>
    <div class="op-bar op-bar-bot">
      <div class="op-progress"><div id="op-progress-fill"></div></div>
      <div class="op-controls">
        <button id="op-audio" type="button">♪ 開啟配樂</button>
        <div class="op-dots" role="group" aria-label="序幕段落">
          ${OPENING_MOVEMENTS.map(
            (m, i) =>
              `<button type="button" class="op-dot" data-mv="${i}" aria-label="${m.stamp}"></button>`,
          ).join('')}
        </div>
        <div class="op-right-acts">
          <button id="op-pause" type="button">暫停</button>
          <button id="op-skip" type="button">略過片頭 ▸</button>
        </div>
      </div>
    </div>
  `;

  const canvas = root.querySelector('#op-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  const stageEl = root.querySelector('#op-stage') as HTMLElement;
  const counterEl = root.querySelector('#op-counter') as HTMLElement;
  const stampEl = root.querySelector('#op-stamp') as HTMLElement;
  const sealEl = root.querySelector('#op-seal') as HTMLElement;
  const linesEl = root.querySelector('#op-lines') as HTMLElement;
  const heroEl = root.querySelector('#op-hero') as HTMLElement;
  const heroTitleEl = root.querySelector('#op-hero-title') as HTMLElement;
  const heroSubEl = root.querySelector('#op-hero-sub') as HTMLElement;
  const subEl = root.querySelector('#op-sub') as HTMLElement;
  const fillEl = root.querySelector('#op-progress-fill') as HTMLElement;
  const audioBtn = root.querySelector('#op-audio') as HTMLButtonElement;
  const pauseBtn = root.querySelector('#op-pause') as HTMLButtonElement;
  const skipBtn = root.querySelector('#op-skip') as HTMLButtonElement;
  const dotBtns = [...root.querySelectorAll<HTMLButtonElement>('.op-dot')];

  const motes = createDustMotes(28);
  let grainTile: HTMLCanvasElement | null = null;
  let images = new Map<string, HTMLImageElement>();
  let lineEls: HTMLElement[] = [];

  let active = false;
  let paused = false;
  let finishing = false;
  let elapsed = 0;
  let activeMvIdx = -1;
  let rafId = 0;
  let lastTs = 0;
  let fadeTimer: number | null = null;
  let audioUnlockedLocal = false;
  let viewW = 1280;
  let viewH = 720;

  function updateAudioButton() {
    const unlocked = audioUnlockedLocal || Boolean(cb.isAudioUnlocked?.());
    if (!cb.isAudioOn()) {
      audioBtn.textContent = '🔇 配樂：關';
    } else if (!unlocked) {
      audioBtn.textContent = '♪ 開啟配樂';
    } else {
      audioBtn.textContent = '🔊 配樂：開';
    }
  }

  function updatePauseButton() {
    pauseBtn.textContent = paused ? '繼續' : '暫停';
  }

  function releaseImages() {
    for (const img of images.values()) {
      img.onload = null;
      img.onerror = null;
      img.removeAttribute('src');
    }
    images.clear();
  }

  function loadImages() {
    if (images.size > 0) return;
    for (const key of OPENING_ASSETS) {
      const img = new Image();
      img.decoding = 'async';
      img.src = `./assets/${key}.jpg`;
      images.set(key, img);
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewW = Math.max(320, root.clientWidth || window.innerWidth);
    viewH = Math.max(240, root.clientHeight || window.innerHeight);
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function findMovementIndex(sec: number): number {
    for (let i = 0; i < OPENING_MOVEMENTS.length; i++) {
      if (sec < OPENING_MOVEMENTS[i]!.end) return i;
    }
    return OPENING_MOVEMENTS.length - 1;
  }

  function applyMovementDom(idx: number) {
    if (idx === activeMvIdx) return;
    activeMvIdx = idx;
    const mv = OPENING_MOVEMENTS[idx]!;
    counterEl.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(OPENING_MOVEMENTS.length).padStart(2, '0')}`;
    stampEl.textContent = mv.stamp;

    if (mv.seal) {
      sealEl.textContent = mv.seal;
      sealEl.hidden = false;
    } else {
      sealEl.hidden = true;
    }

    linesEl.innerHTML = '';
    lineEls = mv.lines.map(item => {
      const p = document.createElement('p');
      p.className = item.em ? 'op-line em' : 'op-line';
      p.textContent = item.text;
      p.style.opacity = '0';
      linesEl.appendChild(p);
      return p;
    });
    linesEl.hidden = mv.lines.length === 0;

    if (mv.heroTitle) {
      heroTitleEl.textContent = mv.heroTitle;
      heroSubEl.textContent = mv.heroSub ?? '';
      heroEl.hidden = false;
    } else {
      heroEl.hidden = true;
    }

    if (mv.credit) {
      subEl.textContent = mv.credit;
      subEl.hidden = false;
    } else {
      subEl.hidden = true;
    }

    dotBtns.forEach((btn, i) => {
      btn.classList.toggle('on', i === idx);
      if (i === idx) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
    });
    root.classList.toggle('reveal-3d', mv.mode === 'title_reveal');
  }

  function updateTypographyOpacity(mv: MovementSpec, sec: number) {
    const dur = Math.max(0.5, mv.end - mv.start);
    const local = clamp(sec - mv.start, 0, dur);
    const isLast = mv.mode === 'title_reveal';
    const fadeOut = isLast ? 1 : 1 - smoothstep(dur - 0.85, dur, local);

    const sealFade = smoothstep(0.15, 0.95, local) * fadeOut;
    if (!sealEl.hidden) {
      sealEl.style.opacity = sealFade.toFixed(3);
      sealEl.style.transform = `translateY(${((1 - smoothstep(0.15, 0.95, local)) * 8).toFixed(1)}px)`;
    }

    const stampFade = smoothstep(0.1, 0.75, local) * fadeOut;
    stampEl.style.opacity = stampFade.toFixed(3);

    lineEls.forEach((el, idx) => {
      const delay = 0.25 + idx * 0.75;
      const inAmt = smoothstep(delay, delay + 0.95, local);
      const op = inAmt * fadeOut;
      const dy = (1 - inAmt) * 10 - (1 - fadeOut) * 4;
      el.style.opacity = op.toFixed(3);
      el.style.transform = `translateY(${dy.toFixed(1)}px)`;
    });

    if (!heroEl.hidden) {
      const hIn = smoothstep(0.2, 1.35, local);
      heroEl.style.opacity = hIn.toFixed(3);
      heroEl.style.transform = `translateY(${((1 - hIn) * 10).toFixed(1)}px) scale(${lerp(0.985, 1.0, hIn).toFixed(4)})`;
    }

    if (!subEl.hidden) {
      const subDelay = mv.lines.length > 0 ? 0.55 + (mv.lines.length - 1) * 0.55 : 0.45;
      const subIn = smoothstep(subDelay, subDelay + 0.85, local);
      subEl.style.opacity = (subIn * fadeOut).toFixed(3);
    }
  }

  function drawFrame(sec: number) {
    if (!ctx) return;
    const w = viewW;
    const h = viewH;
    const mvIdx = findMovementIndex(sec);
    const mv = OPENING_MOVEMENTS[mvIdx]!;
    const dur = Math.max(0.5, mv.end - mv.start);
    const local = clamp(sec - mv.start, 0, dur);
    const u = local / dur;
    const fx = lerp(mv.panStart[0], mv.panEnd[0], u);
    const fy = lerp(mv.panStart[1], mv.panEnd[1], u);
    const scale = lerp(mv.scaleStart, mv.scaleEnd, u);
    const envIn = smoothstep(0.0, 0.8, local);
    const envOut = mv.mode === 'title_reveal' ? 1 : 1 - smoothstep(dur - 0.75, dur, local);
    const env = envIn * envOut;

    ctx.clearRect(0, 0, w, h);

    if (mv.mode !== 'title_reveal') {
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);
    } else {
      const darkVeil = (1 - smoothstep(0.0, 2.2, local)) * 0.78;
      if (darkVeil > 0.004) {
        ctx.fillStyle = `rgba(5, 5, 8, ${darkVeil.toFixed(3)})`;
        ctx.fillRect(0, 0, w, h);
      }
    }

    if (mv.mode === 'single' && mv.assets[0]) {
      drawCoverKenBurns(
        ctx,
        images.get(mv.assets[0]),
        0,
        0,
        w,
        h,
        scale,
        fx,
        fy,
        0.58 * env,
        'rgba(8, 7, 10, 0.42)',
      );
    } else if (mv.mode === 'diptych' && mv.assets.length >= 2) {
      const barTop = Math.min(96, Math.max(40, h * 0.11));
      const barBot = Math.min(104, Math.max(58, h * 0.12));
      const gap = w < 600 ? 6 : 12;
      const padX = w < 600 ? 12 : Math.round(w * 0.04);
      const panelY = barTop + 8;
      const panelH = Math.max(120, h - barTop - barBot - 16);
      const halfW = Math.max(100, (w - padX * 2 - gap) * 0.5);
      const leftX = padX;
      const rightX = padX + halfW + gap;

      drawCoverKenBurns(
        ctx,
        images.get(mv.assets[0]!),
        leftX,
        panelY,
        halfW,
        panelH,
        lerp(1.04, 1.13, u),
        lerp(0.56, 0.46, u),
        lerp(0.52, 0.44, u),
        0.54 * env,
        'rgba(10, 8, 9, 0.38)',
      );
      drawCoverKenBurns(
        ctx,
        images.get(mv.assets[1]!),
        rightX,
        panelY,
        halfW,
        panelH,
        lerp(1.12, 1.03, u),
        lerp(0.45, 0.55, u),
        lerp(0.46, 0.54, u),
        0.54 * env,
        'rgba(10, 8, 9, 0.38)',
      );

      ctx.save();
      ctx.globalAlpha = 0.45 * env;
      ctx.strokeStyle = 'rgba(218, 186, 128, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(leftX + 0.5, panelY + 0.5, halfW - 1, panelH - 1);
      ctx.strokeRect(rightX + 0.5, panelY + 0.5, halfW - 1, panelH - 1);
      ctx.restore();
    } else if (mv.mode === 'crossfade' && mv.assets.length >= 2) {
      const mix = smoothstep(0.32, 0.72, u);
      drawCoverKenBurns(
        ctx,
        images.get(mv.assets[0]!),
        0,
        0,
        w,
        h,
        scale,
        fx,
        fy,
        0.56 * env * (1 - mix),
        'rgba(8, 7, 10, 0.44)',
      );
      drawCoverKenBurns(
        ctx,
        images.get(mv.assets[1]!),
        0,
        0,
        w,
        h,
        lerp(1.02, 1.12, mix),
        lerp(0.52, 0.44, mix),
        lerp(0.56, 0.42, mix),
        0.56 * env * mix,
        'rgba(8, 7, 10, 0.46)',
      );
    } else if (mv.mode === 'tribute' && mv.assets[0]) {
      drawCoverKenBurns(
        ctx,
        images.get(mv.assets[0]),
        0,
        0,
        w,
        h,
        scale,
        fx,
        fy,
        0.40 * env,
        'rgba(12, 9, 8, 0.54)',
      );
    }

    // Subtle warm amber light leak along upper edge
    const leakPulse = 0.08 + 0.04 * Math.sin(sec * 0.55);
    const leak = ctx.createRadialGradient(w * 0.24, h * 0.22, 12, w * 0.24, h * 0.22, Math.max(w, h) * 0.55);
    leak.addColorStop(0, `rgba(212, 148, 76, ${(leakPulse * (mv.mode === 'title_reveal' ? 0.5 : 1)).toFixed(3)})`);
    leak.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = leak;
    ctx.fillRect(0, 0, w, h);

    // Soft radial vignette
    const vigAlpha = mv.mode === 'title_reveal' ? 0.48 : 0.78;
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.24, w * 0.5, h * 0.5, Math.max(w, h) * 0.68);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, `rgba(4, 4, 8, ${vigAlpha})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Floating archival film dust motes
    ctx.save();
    for (const m of motes) {
      const mx = ((m.x + m.vx * sec + Math.sin(sec * 0.4 + m.phase) * 0.015) % 1 + 1) % 1;
      const my = ((m.y - m.vy * sec) % 1 + 1) % 1;
      const shimmer = 0.6 + 0.4 * Math.sin(sec * 1.4 + m.phase);
      ctx.globalAlpha = m.alpha * shimmer * (mv.mode === 'title_reveal' ? 0.7 : 1);
      ctx.fillStyle = '#f3dfba';
      ctx.beginPath();
      ctx.arc(mx * w, my * h, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Subtle 35mm film grain tile with jitter + rare faint hairline scratch
    if (!grainTile) grainTile = createGrainTile();
    ctx.save();
    ctx.globalAlpha = mv.mode === 'title_reveal' ? 0.032 : 0.055;
    const jx = -Math.floor((sec * 24 * 37) % 64);
    const jy = -Math.floor((sec * 24 * 53) % 64);
    for (let gx = jx; gx < w; gx += 128) {
      for (let gy = jy; gy < h; gy += 128) {
        ctx.drawImage(grainTile, gx, gy);
      }
    }
    if (Math.sin(sec * 11.3) > 0.94 && mv.mode !== 'title_reveal') {
      const sx = ((sec * 137) % 0.72 + 0.14) * w;
      ctx.globalAlpha = 0.07;
      ctx.strokeStyle = '#efe2c8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx + 1, h);
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderAt(sec: number) {
    const clamped = clamp(sec, 0, OPENING_TOTAL_SEC);
    const idx = findMovementIndex(clamped);
    applyMovementDom(idx);
    updateTypographyOpacity(OPENING_MOVEMENTS[idx]!, clamped);
    fillEl.style.width = `${((clamped / OPENING_TOTAL_SEC) * 100).toFixed(2)}%`;
    drawFrame(clamped);
  }

  function resetClock() {
    lastTs = 0;
  }

  function detachListeners() {
    window.removeEventListener('resize', resizeCanvas);
    document.removeEventListener('visibilitychange', resetClock);
  }

  function finish(immediate = false) {
    if (root.hidden || (finishing && !immediate)) return;
    active = false;
    paused = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    detachListeners();
    if (fadeTimer !== null) {
      clearTimeout(fadeTimer);
      fadeTimer = null;
    }
    function close() {
      finishing = false;
      root.classList.remove('fading', 'reveal-3d');
      root.hidden = true;
      root.close();
      releaseImages();
    }
    cb.onFinish?.();
    if (immediate) {
      close();
      return;
    }
    finishing = true;
    root.classList.add('fading');
    fadeTimer = window.setTimeout(() => {
      fadeTimer = null;
      close();
    }, 480);
  }

  function step(ts: number) {
    if (!active || paused) {
      rafId = 0;
      return;
    }
    if (!lastTs) lastTs = ts;
    const dt = document.hidden ? 0 : (ts - lastTs) / 1000;
    lastTs = ts;
    elapsed += dt;
    if (elapsed >= OPENING_TOTAL_SEC) {
      rafId = 0;
      renderAt(OPENING_TOTAL_SEC - 0.01);
      finish(false);
      return;
    }
    renderAt(elapsed);
    rafId = requestAnimationFrame(step);
  }

  function onKeyDown(e: KeyboardEvent) {
    e.stopPropagation();
    if (!active || e.repeat) return;
    if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return;
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      audioUnlockedLocal = true;
      cb.onUnlockAudio();
      finish(false);
    } else if (e.key === ' ') {
      e.preventDefault();
      audioUnlockedLocal = true;
      cb.onUnlockAudio();
      paused = !paused;
      lastTs = 0;
      updatePauseButton();
      updateAudioButton();
      if (!paused && !rafId) rafId = requestAnimationFrame(step);
    }
  }

  function onCancel(e: Event) {
    e.preventDefault();
    finish();
  }
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('cancel', onCancel);

  stageEl.addEventListener('pointerdown', () => {
    audioUnlockedLocal = true;
    cb.onUnlockAudio();
    updateAudioButton();
  });

  audioBtn.addEventListener('click', e => {
    e.stopPropagation();
    const wasUnlocked = audioUnlockedLocal || Boolean(cb.isAudioUnlocked?.());
    audioUnlockedLocal = true;
    cb.onUnlockAudio();
    if (wasUnlocked || !cb.isAudioOn()) {
      cb.onToggleAudio();
    }
    updateAudioButton();
  });

  pauseBtn.addEventListener('click', e => {
    e.stopPropagation();
    audioUnlockedLocal = true;
    cb.onUnlockAudio();
    paused = !paused;
    lastTs = 0;
    updatePauseButton();
    updateAudioButton();
    if (!paused && !rafId) rafId = requestAnimationFrame(step);
  });

  skipBtn.addEventListener('click', e => {
    e.stopPropagation();
    audioUnlockedLocal = true;
    cb.onUnlockAudio();
    finish(false);
  });

  dotBtns.forEach((btn, i) => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      audioUnlockedLocal = true;
      cb.onUnlockAudio();
      updateAudioButton();
      const target = OPENING_MOVEMENTS[i];
      if (!target) return;
      elapsed = paused ? (target.start + target.end) / 2 : target.start;
      lastTs = 0;
      renderAt(elapsed);
    });
  });

  return {
    play(startSec = 0) {
      if (fadeTimer !== null) {
        clearTimeout(fadeTimer);
        fadeTimer = null;
      }
      finishing = false;
      active = true;
      paused = false;
      elapsed = clamp(startSec, 0, OPENING_TOTAL_SEC - 0.1);
      activeMvIdx = -1;
      lastTs = 0;
      root.hidden = false;
      if (!root.open) root.showModal();
      stageEl.focus({ preventScroll: true });
      root.classList.remove('fading', 'reveal-3d');
      loadImages();
      resizeCanvas();
      updateAudioButton();
      updatePauseButton();
      window.addEventListener('resize', resizeCanvas);
      document.addEventListener('visibilitychange', resetClock);
      cb.onStart?.();
      renderAt(elapsed);
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(step);
    },
    seek(sec: number) {
      if (!active) this.play(sec);
      paused = true;
      elapsed = clamp(sec, 0, OPENING_TOTAL_SEC - 0.02);
      lastTs = 0;
      updatePauseButton();
      renderAt(elapsed);
    },
    skip() {
      finish(false);
    },
    isActive() {
      return active || finishing;
    },
    getTime() {
      return elapsed;
    },
    destroy() {
      finish(true);
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('cancel', onCancel);
      grainTile = null;
      root.innerHTML = '';
    },
  };
}
