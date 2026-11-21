import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AtmospherePreset } from '../types';
import { rng } from './kit';
import { isSharedWallTexture } from './wallTextures';

export type SkyMode =
  | 'night'
  | 'dawn'
  | 'camp'
  | 'statue'
  | 'blockade'
  | 'hutong'
  | 'aftermath'
  | 'rain_overcast'
  | AtmospherePreset;

type ResolvedSkyMode = 'night' | 'dawn' | 'camp' | 'statue' | 'blockade' | 'hutong' | 'aftermath' | 'rain_overcast';

function resolveSkyMode(mode: SkyMode): ResolvedSkyMode {
  switch (mode) {
    case 'day_spring': return 'camp';
    case 'dusk_warm': return 'statue';
    case 'curfew_amber': return 'blockade';
    default: return mode;
  }
}

function makeCanvas(size = 512): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return [c, c.getContext('2d')!];
}

function tileTex(canvas: HTMLCanvasElement, repeatX: number, repeatY: number, anisotropy = 8): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

const baseCanvasCache = new Map<string, HTMLCanvasElement>();

function getOrDrawCanvas(key: string, draw: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = baseCanvasCache.get(key);
  if (!c) {
    c = draw();
    baseCanvasCache.set(key, c);
  }
  return c;
}

function drawGranitePavingCanvas(): HTMLCanvasElement {
  const S = 512;
  const [c, g] = makeCanvas(S);
  const r = rng(1958);

  g.fillStyle = '#847e72';
  g.fillRect(0, 0, S, S);

  const rows = 4, cols = 4;
  const slabW = S / cols, slabH = S / rows;

  // Individual granite slabs in a 4x4 staggered bond
  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * (slabW * 0.5);
    const y = row * slabH;
    for (let col = -1; col <= cols; col++) {
      const x = col * slabW + offset;
      // Wrap-consistent slab ID so edge-straddling slabs match identically across tile boundaries
      const wx = ((col % cols) + cols) % cols;
      const hash = Math.sin(row * 17.3 + wx * 41.7) * 43758.5453;
      const tone = (hash - Math.floor(hash)) * 16 - 8;
      const rr = Math.round(132 + tone + (row % 2 === 0 ? 1 : -1));
      const gg = Math.round(126 + tone);
      const bb = Math.round(114 + tone - 1);

      g.fillStyle = `rgb(${rr},${gg},${bb})`;
      g.fillRect(x + 2, y + 2, slabW - 4, slabH - 4);

      // Subtle bevel highlight on top/left and shadow on bottom/right of each slab
      g.fillStyle = 'rgba(225,218,205,0.12)';
      g.fillRect(x + 2, y + 2, slabW - 4, 2);
      g.fillRect(x + 2, y + 2, 2, slabH - 4);
      g.fillStyle = 'rgba(42,38,32,0.16)';
      g.fillRect(x + 2, y + slabH - 4, slabW - 4, 2);
      g.fillRect(x + slabW - 4, y + 2, 2, slabH - 4);
    }
  }

  // Dark mortar seams
  g.fillStyle = '#5c574e';
  for (let row = 0; row < rows; row++) {
    const y = row * slabH;
    g.fillRect(0, y, S, 3);
    const offset = (row % 2) * (slabW * 0.5);
    for (let col = 0; col <= cols; col++) {
      const x = ((col * slabW + offset) % S + S) % S;
      g.fillRect(x, y, 3, slabH);
    }
  }

  // Subtle granite mineral speckles (wrapped seamlessly)
  for (let i = 0; i < 4200; i++) {
    const x = r() * S;
    const y = r() * S;
    const sz = 1 + r() * 1.8;
    const bright = r() > 0.45;
    g.fillStyle = bright ? `rgba(182,175,162,${0.08 + r() * 0.14})` : `rgba(58,54,48,${0.09 + r() * 0.15})`;
    g.fillRect(x, y, sz, sz);
  }

  // Faint weathered patina patches
  for (let i = 0; i < 28; i++) {
    const x = r() * S, y = r() * S, rad = 18 + r() * 38;
    const warm = r() > 0.5;
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        if (x + ox + rad < 0 || x + ox - rad > S || y + oy + rad < 0 || y + oy - rad > S) continue;
        const gr = g.createRadialGradient(x + ox, y + oy, 2, x + ox, y + oy, rad);
        gr.addColorStop(0, warm ? 'rgba(104,96,82,0.10)' : 'rgba(68,64,58,0.10)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x + ox, y + oy, rad, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  return c;
}

function drawAsphaltRoadCanvas(): HTMLCanvasElement {
  const S = 512;
  const [c, g] = makeCanvas(S);
  const r = rng(1989);

  g.fillStyle = '#252529';
  g.fillRect(0, 0, S, S);

  // Subtle longitudinal tire wear bands (along U / road length)
  for (const ty of [86, 178, 334, 426]) {
    const grad = g.createLinearGradient(0, ty - 34, 0, ty + 34);
    grad.addColorStop(0, 'rgba(20,20,24,0)');
    grad.addColorStop(0.5, 'rgba(18,18,22,0.30)');
    grad.addColorStop(1, 'rgba(20,20,24,0)');
    g.fillStyle = grad;
    g.fillRect(0, ty - 34, S, 68);
  }

  // Fine mineral aggregate speckle
  for (let i = 0; i < 6500; i++) {
    const x = r() * S;
    const y = r() * S;
    const sz = 1 + r() * 1.5;
    const v = r();
    if (v < 0.35) g.fillStyle = 'rgba(24,24,28,0.45)';
    else if (v < 0.78) g.fillStyle = 'rgba(54,54,60,0.32)';
    else g.fillStyle = 'rgba(78,76,72,0.22)';
    g.fillRect(x, y, sz, sz);
  }

  // Faint weathered tar patches & subtle longitudinal hairline seams
  for (let i = 0; i < 16; i++) {
    const y = r() * S;
    g.strokeStyle = 'rgba(18,18,20,0.22)';
    g.lineWidth = 1 + r() * 1.2;
    g.beginPath();
    let cy = y;
    g.moveTo(0, cy);
    for (let x = 32; x <= S; x += 32) {
      cy += (r() - 0.5) * 4;
      g.lineTo(x, cy);
    }
    g.stroke();
  }

  return c;
}

function drawCampusPathCanvas(): HTMLCanvasElement {
  const S = 512;
  const [c, g] = makeCanvas(S);
  const r = rng(1898);

  g.fillStyle = '#3d3c38';
  g.fillRect(0, 0, S, S);

  const rows = 8, cols = 4;
  const bw = S / cols, bh = S / rows;

  // Staggered grey courtyard bricks (Qing-style grey brick tone variations)
  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * (bw * 0.5);
    const y = row * bh;
    for (let col = -1; col <= cols; col++) {
      const x = col * bw + offset;
      const wx = ((col % cols) + cols) % cols;
      const h = Math.sin(row * 29.1 + wx * 53.9) * 43758.5453;
      const d = (h - Math.floor(h)) * 14 - 7;
      const rr = Math.round(61 + d);
      const gg = Math.round(60 + d);
      const bb = Math.round(56 + d * 0.9);
      g.fillStyle = `rgb(${rr},${gg},${bb})`;
      g.fillRect(x + 2, y + 2, bw - 4, bh - 4);

      // Subtle brick edge bevel
      g.fillStyle = 'rgba(130,126,118,0.10)';
      g.fillRect(x + 2, y + 2, bw - 4, 2);
    }
  }

  // Dark brick mortar joints
  g.fillStyle = '#282724';
  for (let row = 0; row < rows; row++) {
    const y = row * bh;
    g.fillRect(0, y, S, 3);
    const offset = (row % 2) * (bw * 0.5);
    for (let col = 0; col <= cols; col++) {
      const x = ((col * bw + offset) % S + S) % S;
      g.fillRect(x, y, 3, bh);
    }
  }

  // Mossy weathering along brick seams
  for (let i = 0; i < 42; i++) {
    const row = Math.floor(r() * rows);
    const y = row * bh;
    const x = r() * S;
    const w = 14 + r() * 34;
    for (const ox of [-S, 0, S]) {
      const gr = g.createRadialGradient(x + ox, y + 1, 1, x + ox, y + 1, w * 0.5);
      gr.addColorStop(0, 'rgba(54,70,40,0.34)');
      gr.addColorStop(1, 'rgba(54,70,40,0)');
      g.fillStyle = gr;
      g.fillRect(x + ox - w * 0.5, y - 6, w, 14);
    }
  }

  // Mineral grit & brick pore speckles
  for (let i = 0; i < 3600; i++) {
    const x = r() * S;
    const y = r() * S;
    const sz = 1 + r() * 1.4;
    g.fillStyle = r() > 0.5 ? 'rgba(90,88,82,0.18)' : 'rgba(26,25,23,0.22)';
    g.fillRect(x, y, sz, sz);
  }

  return c;
}

function drawSkyDomeCanvas(mode: ResolvedSkyMode): HTMLCanvasElement {
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;

  const grad = g.createLinearGradient(0, 0, 0, H);
  if (mode === 'night' || mode === 'hutong') {
    grad.addColorStop(0.0, '#050812');
    grad.addColorStop(0.32, '#0d1527');
    grad.addColorStop(0.47, '#1d2438');
    grad.addColorStop(0.51, '#31261e');
    grad.addColorStop(0.62, '#161414');
    grad.addColorStop(1.0, '#0d0d10');
  } else if (mode === 'blockade') {
    grad.addColorStop(0.0, '#0e0906');
    grad.addColorStop(0.34, '#1e120a');
    grad.addColorStop(0.48, '#4a2a14');
    grad.addColorStop(0.52, '#5c3318');
    grad.addColorStop(0.65, '#22140a');
    grad.addColorStop(1.0, '#120b06');
  } else if (mode === 'dawn') {
    grad.addColorStop(0.0, '#3a577e');
    grad.addColorStop(0.30, '#6e8bad');
    grad.addColorStop(0.46, '#cbb39b');
    grad.addColorStop(0.51, '#e8cfa8');
    grad.addColorStop(0.62, '#9a8c7c');
    grad.addColorStop(1.0, '#4a4640');
  } else if (mode === 'camp') {
    grad.addColorStop(0.0, '#2d5c94');
    grad.addColorStop(0.28, '#5f8fc0');
    grad.addColorStop(0.46, '#c8d6df');
    grad.addColorStop(0.51, '#e8d7b8');
    grad.addColorStop(0.62, '#9c927d');
    grad.addColorStop(1.0, '#5a5448');
  } else if (mode === 'statue') {
    grad.addColorStop(0.0, '#14122a');
    grad.addColorStop(0.28, '#3d284a');
    grad.addColorStop(0.44, '#8d4c48');
    grad.addColorStop(0.50, '#df9352');
    grad.addColorStop(0.60, '#5c3a2d');
    grad.addColorStop(1.0, '#261a18');
  } else if (mode === 'rain_overcast') {
    grad.addColorStop(0.0, '#2c353f');
    grad.addColorStop(0.32, '#414c57');
    grad.addColorStop(0.49, '#5e6872');
    grad.addColorStop(0.58, '#49525b');
    grad.addColorStop(1.0, '#282d32');
  } else {
    grad.addColorStop(0.0, '#788c9c');
    grad.addColorStop(0.32, '#a2b2bd');
    grad.addColorStop(0.50, '#ced6db');
    grad.addColorStop(0.64, '#8c9296');
    grad.addColorStop(1.0, '#464a4d');
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  if (mode === 'night' || mode === 'hutong') {
    const haze = g.createLinearGradient(0, 210, 0, 282);
    haze.addColorStop(0, 'rgba(255,168,88,0)');
    haze.addColorStop(0.65, 'rgba(255,162,82,0.14)');
    haze.addColorStop(1, 'rgba(40,28,20,0)');
    g.fillStyle = haze;
    g.fillRect(0, 210, W, 72);

    const r = rng(mode === 'night' ? 8904 : 8906);
    for (let i = 0; i < 240; i++) {
      const x = r() * W;
      const y = 14 + Math.pow(r(), 1.15) * 218;
      const rad = 0.4 + r() * 0.75;
      const alpha = (0.28 + r() * 0.62) * (1 - y / 245);
      const tint = r();
      g.fillStyle = tint < 0.25
        ? `rgba(210,226,255,${alpha.toFixed(3)})`
        : tint < 0.72
          ? `rgba(248,248,255,${alpha.toFixed(3)})`
          : `rgba(255,228,186,${alpha.toFixed(3)})`;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }

    const mx = 324;
    const my = 186;
    const halo = g.createRadialGradient(mx, my, 3, mx, my, 46);
    halo.addColorStop(0, 'rgba(255,246,220,0.34)');
    halo.addColorStop(0.28, 'rgba(218,226,244,0.14)');
    halo.addColorStop(1, 'rgba(13,21,39,0)');
    g.fillStyle = halo;
    g.beginPath();
    g.arc(mx, my, 46, 0, Math.PI * 2);
    g.fill();

    const [mc, mg] = makeCanvas(32);
    mg.fillStyle = '#fdf4db';
    mg.beginPath();
    mg.arc(16, 16, 6.2, 0, Math.PI * 2);
    mg.fill();
    mg.fillStyle = 'rgba(195,186,164,0.32)';
    mg.beginPath();
    mg.arc(14.2, 15.1, 2.1, 0, Math.PI * 2);
    mg.arc(17.8, 17.5, 1.4, 0, Math.PI * 2);
    mg.fill();
    mg.globalCompositeOperation = 'destination-out';
    mg.beginPath();
    mg.arc(19.4, 13.8, 5.4, 0, Math.PI * 2);
    mg.fill();
    g.drawImage(mc, mx - 16, my - 16);
  } else if (mode === 'blockade') {
    const r = rng(8905);
    for (let i = 0; i < 110; i++) {
      const x = r() * W;
      const y = 14 + r() * 175;
      const alpha = (0.16 + r() * 0.30) * (1 - y / 205);
      g.fillStyle = `rgba(245,225,195,${alpha.toFixed(3)})`;
      g.beginPath();
      g.arc(x, y, 0.4 + r() * 0.65, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 24; i++) {
      const x = r() * W, y = 190 + r() * 82, w = 130 + r() * 220, h = 14 + r() * 24;
      for (const ox of [-W, 0, W]) {
        g.save();
        g.translate(x + ox, y);
        g.scale(1, h / w);
        const sg = g.createRadialGradient(0, 0, 4, 0, 0, w * 0.5);
        sg.addColorStop(0, 'rgba(130,68,28,0.20)');
        sg.addColorStop(1, 'rgba(77,44,20,0)');
        g.fillStyle = sg;
        g.beginPath();
        g.arc(0, 0, w * 0.5, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  } else if (mode === 'dawn') {
    const r = rng(890422);
    const sunHalo = g.createRadialGradient(540, 242, 6, 540, 242, 160);
    sunHalo.addColorStop(0, 'rgba(255,244,212,0.52)');
    sunHalo.addColorStop(0.35, 'rgba(255,204,148,0.22)');
    sunHalo.addColorStop(1, 'rgba(222,194,164,0)');
    g.fillStyle = sunHalo;
    g.fillRect(360, 80, 360, 240);

    for (let i = 0; i < 28; i++) {
      const x = r() * W, y = 135 + r() * 120, rx = 100 + r() * 180, ry = 8 + r() * 16;
      for (const ox of [-W, 0, W]) {
        g.save();
        g.translate(x + ox, y);
        g.scale(1, ry / rx);
        const cg = g.createRadialGradient(0, 0, 2, 0, 0, rx);
        cg.addColorStop(0, i % 2 ? 'rgba(248,224,196,0.24)' : 'rgba(222,194,164,0.18)');
        cg.addColorStop(1, 'rgba(222,194,164,0)');
        g.fillStyle = cg;
        g.beginPath();
        g.arc(0, 0, rx, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  } else if (mode === 'camp') {
    const r = rng(890515);
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = 85 + r() * 155, len = 110 + r() * 200;
      const dy = (r() - 0.5) * 10, ctrlDy = -5 + r() * 10;
      g.strokeStyle = `rgba(252,248,238,${(0.11 + r() * 0.14).toFixed(3)})`;
      g.lineWidth = 3 + r() * 8;
      g.lineCap = 'round';
      for (const ox of [-W, 0, W]) {
        g.beginPath();
        g.moveTo(x + ox, y);
        g.quadraticCurveTo(x + ox + len * 0.5, y + ctrlDy, x + ox + len, y + dy);
        g.stroke();
      }
    }
  } else if (mode === 'statue') {
    const r = rng(890530);
    for (let i = 0; i < 64; i++) {
      const x = r() * W;
      const y = 14 + Math.pow(r(), 1.3) * 145;
      const alpha = (0.22 + r() * 0.48) * (1 - y / 170);
      g.fillStyle = `rgba(245,238,255,${alpha.toFixed(3)})`;
      g.beginPath();
      g.arc(x, y, 0.45 + r() * 0.75, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 28; i++) {
      const x = r() * W, y = 175 + r() * 88, rx = 100 + r() * 180, ry = 10 + r() * 18;
      for (const ox of [-W, 0, W]) {
        g.save();
        g.translate(x + ox, y);
        g.scale(1, ry / rx);
        const cg = g.createRadialGradient(0, 0, 2, 0, 0, rx);
        cg.addColorStop(0, i % 3 === 0 ? 'rgba(235,152,92,0.28)' : 'rgba(176,84,74,0.24)');
        cg.addColorStop(1, 'rgba(158,82,70,0)');
        g.fillStyle = cg;
        g.beginPath();
        g.arc(0, 0, rx, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  } else if (mode === 'rain_overcast') {
    const r = rng(890523);
    for (let i = 0; i < 36; i++) {
      const x = r() * W, y = 40 + r() * 215, rx = 120 + r() * 210, ry = 14 + r() * 24;
      for (const ox of [-W, 0, W]) {
        g.save();
        g.translate(x + ox, y);
        g.scale(1, ry / rx);
        const cg = g.createRadialGradient(0, 0, 4, 0, 0, rx);
        cg.addColorStop(0, i % 2 === 0 ? 'rgba(38,45,52,0.34)' : 'rgba(116,126,136,0.22)');
        cg.addColorStop(1, 'rgba(75,86,97,0)');
        g.fillStyle = cg;
        g.beginPath();
        g.arc(0, 0, rx, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  } else if (mode === 'aftermath') {
    const r = rng(890604);
    for (let i = 0; i < 30; i++) {
      const x = r() * W, y = 110 + r() * 145, rx = 130 + r() * 190, ry = 14 + r() * 24;
      for (const ox of [-W, 0, W]) {
        g.save();
        g.translate(x + ox, y);
        g.scale(1, ry / rx);
        const mg = g.createRadialGradient(0, 0, 4, 0, 0, rx);
        mg.addColorStop(0, y > 205 ? 'rgba(226,232,235,0.32)' : 'rgba(196,208,216,0.22)');
        mg.addColorStop(1, 'rgba(214,220,224,0)');
        g.fillStyle = mg;
        g.beginPath();
        g.arc(0, 0, rx, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  }

  return c;
}

interface PoolEntry {
  tex: THREE.CanvasTexture;
  refs: number;
}

/**
 * Ref-counted shared texture pool for procedural ground & sky textures so
 * textures are reused across scene builds and disposed when no scene retains them.
 */
class SharedTexturePool {
  private readonly entries = new Map<string, PoolEntry>();
  private readonly scopeStack: string[][] = [];

  acquire(key: string, create: () => THREE.CanvasTexture): THREE.CanvasTexture {
    let entry = this.entries.get(key);
    if (!entry) {
      const tex = create();
      tex.userData.pooled = true;
      tex.userData.poolKey = key;
      entry = { tex, refs: 0 };
      this.entries.set(key, entry);
    }
    entry.refs += 1;
    const activeScope = this.scopeStack[this.scopeStack.length - 1];
    if (activeScope) activeScope.push(key);
    return entry.tex;
  }

  release(keyOrTex: string | THREE.Texture | null | undefined): void {
    if (!keyOrTex) return;
    const key = typeof keyOrTex === 'string'
      ? keyOrTex
      : (keyOrTex.userData?.poolKey as string | undefined);
    if (!key) return;
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs <= 0) {
      this.entries.delete(key);
      entry.tex.dispose();
    }
  }

  releaseAll(keys: Iterable<string | THREE.Texture>): void {
    for (const k of keys) this.release(k);
  }

  /** Run `fn()` while capturing every acquired pool key for clean `world.dispose()` teardown. */
  captureScope<T>(fn: () => T): { result: T; keys: string[] } {
    const keys: string[] = [];
    this.scopeStack.push(keys);
    try {
      const result = fn();
      return { result, keys };
    } finally {
      this.scopeStack.pop();
    }
  }

  granitePaving(repeatX = 28, repeatY = 52): THREE.CanvasTexture {
    return this.acquire(`granitePaving:${repeatX}:${repeatY}`, () => {
      const c = getOrDrawCanvas('granitePaving', drawGranitePavingCanvas);
      return tileTex(c, repeatX, repeatY, 8);
    });
  }

  asphaltRoad(repeatX = 24, repeatY = 4): THREE.CanvasTexture {
    return this.acquire(`asphaltRoad:${repeatX}:${repeatY}`, () => {
      const c = getOrDrawCanvas('asphaltRoad', drawAsphaltRoadCanvas);
      return tileTex(c, repeatX, repeatY, 8);
    });
  }

  campusPath(repeatX = 12, repeatY = 12): THREE.CanvasTexture {
    return this.acquire(`campusPath:${repeatX}:${repeatY}`, () => {
      const c = getOrDrawCanvas('campusPath', drawCampusPathCanvas);
      return tileTex(c, repeatX, repeatY, 8);
    });
  }

  skyDome(mode: SkyMode): THREE.CanvasTexture {
    const resolved = resolveSkyMode(mode);
    return this.acquire(`skyDome:${resolved}`, () => {
      const c = getOrDrawCanvas(`skyDome:${resolved}`, () => drawSkyDomeCanvas(resolved));
      const t = new THREE.CanvasTexture(c);
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.mapping = THREE.EquirectangularReflectionMapping;
      return t;
    });
  }

  private sharedEnvRT: THREE.WebGLRenderTarget | null = null;
  private sharedSoftGlow: THREE.CanvasTexture | null = null;
  private sharedContactShadow: THREE.CanvasTexture | null = null;
  private sharedPuddleRoughness: THREE.CanvasTexture | null = null;
  private sharedLightCone: THREE.CanvasTexture | null = null;

  /** Globally shared lightweight procedural IBL environment cubemap baked once via PMREMGenerator. */
  envMap(renderer: THREE.WebGLRenderer): THREE.Texture {
    if (!this.sharedEnvRT) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      const skyGeo = new THREE.SphereGeometry(10, 24, 16);
      const pos = skyGeo.getAttribute('position');
      const cols = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / 10;
        if (y >= 0) {
          const t = Math.pow(y, 0.7);
          cols[i * 3] = 0.78 * (1 - t) + 0.38 * t;
          cols[i * 3 + 1] = 0.72 * (1 - t) + 0.48 * t;
          cols[i * 3 + 2] = 0.64 * (1 - t) + 0.68 * t;
        } else {
          const t = Math.min(1, -y * 1.4);
          cols[i * 3] = 0.56 * (1 - t) + 0.14 * t;
          cols[i * 3 + 1] = 0.50 * (1 - t) + 0.12 * t;
          cols[i * 3 + 2] = 0.42 * (1 - t) + 0.10 * t;
        }
      }
      skyGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
      envScene.add(new THREE.Mesh(skyGeo, skyMat));
      this.sharedEnvRT = pmrem.fromScene(envScene, 0.04);
      this.sharedEnvRT.texture.userData.shared = true;
      skyGeo.dispose();
      skyMat.dispose();
      pmrem.dispose();
    }
    return this.sharedEnvRT.texture;
  }

  /** Shared 128x128 smooth Gaussian additive falloff texture for feathered streetlamp pools & halos. */
  softGlowTex(): THREE.CanvasTexture {
    if (!this.sharedSoftGlow) {
      const [c, g] = makeCanvas(128);
      const rad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      rad.addColorStop(0.0, 'rgba(255,232,178,1.0)');
      rad.addColorStop(0.28, 'rgba(255,212,132,0.52)');
      rad.addColorStop(0.65, 'rgba(255,185,92,0.14)');
      rad.addColorStop(1.0, 'rgba(255,170,70,0.0)');
      g.fillStyle = rad;
      g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.userData.shared = true;
      t.userData.pooled = true;
      this.sharedSoftGlow = t;
    }
    return this.sharedSoftGlow;
  }

  /** Shared 128x128 radial contact shadow disc for grounding characters & bicycles. */
  contactShadowTex(): THREE.CanvasTexture {
    if (!this.sharedContactShadow) {
      const [c, g] = makeCanvas(128);
      const rad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
      rad.addColorStop(0.0, 'rgba(8,7,6,0.58)');
      rad.addColorStop(0.55, 'rgba(10,9,8,0.26)');
      rad.addColorStop(1.0, 'rgba(10,9,8,0.0)');
      g.fillStyle = rad;
      g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.userData.shared = true;
      t.userData.pooled = true;
      this.sharedContactShadow = t;
    }
    return this.sharedContactShadow;
  }

  /** Shared 512x512 seamless rain-puddle roughness map for wet asphalt streets during rain (0 extra draw calls). */
  puddleRoughnessTex(): THREE.CanvasTexture {
    if (!this.sharedPuddleRoughness) {
      const S = 512;
      const [c, g] = makeCanvas(S);
      const r = rng(19890603);
      g.fillStyle = '#cfcfcf';
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 1800; i++) {
        const x = r() * S;
        const y = r() * S;
        const v = Math.round(168 + r() * 60);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x, y, 2 + r() * 3, 2 + r() * 3);
      }
      // Large irregular longitudinal street puddles with wide soft damp edges (no harsh polka dots)
      for (let i = 0; i < 8; i++) {
        const cx = r() * S;
        const cy = r() * S;
        const rad = 52 + r() * 76;
        for (const ox of [-S, 0, S]) {
          for (const oy of [-S, 0, S]) {
            if (cx + ox + rad * 1.4 < 0 || cx + ox - rad * 1.4 > S || cy + oy + rad < 0 || cy + oy - rad > S) continue;
            const gr = g.createRadialGradient(cx + ox, cy + oy, rad * 0.12, cx + ox, cy + oy, rad);
            gr.addColorStop(0.0, 'rgba(38,38,38,0.88)');
            gr.addColorStop(0.45, 'rgba(58,58,58,0.70)');
            gr.addColorStop(0.75, 'rgba(135,135,135,0.34)');
            gr.addColorStop(1.0, 'rgba(205,205,205,0.0)');
            g.fillStyle = gr;
            g.beginPath();
            g.ellipse(cx + ox, cy + oy, rad * 1.35, rad * 0.56, (r() - 0.5) * 0.25, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(6, 6);
      t.colorSpace = THREE.NoColorSpace;
      t.userData.shared = true;
      t.userData.pooled = true;
      this.sharedPuddleRoughness = t;
    }
    return this.sharedPuddleRoughness;
  }

  /** Shared 128x256 downward volumetric lamp light-cone falloff texture. */
  lightConeTex(): THREE.CanvasTexture {
    if (!this.sharedLightCone) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 256;
      const g = c.getContext('2d')!;
      const vGrad = g.createLinearGradient(0, 0, 0, 256);
      vGrad.addColorStop(0.0, 'rgba(255,244,218,0.0)');
      vGrad.addColorStop(0.10, 'rgba(255,238,196,0.68)');
      vGrad.addColorStop(0.45, 'rgba(255,222,162,0.28)');
      vGrad.addColorStop(0.85, 'rgba(255,204,132,0.06)');
      vGrad.addColorStop(1.0, 'rgba(255,196,120,0.0)');
      g.fillStyle = vGrad;
      g.fillRect(0, 0, 128, 256);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.userData.shared = true;
      t.userData.pooled = true;
      this.sharedLightCone = t;
    }
    return this.sharedLightCone;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  refCount(key: string): number {
    return this.entries.get(key)?.refs ?? 0;
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    for (const { tex } of this.entries.values()) tex.dispose();
    this.entries.clear();
    baseCanvasCache.clear();
    this.sharedEnvRT?.dispose();
    this.sharedEnvRT = null;
    this.sharedSoftGlow?.dispose();
    this.sharedSoftGlow = null;
    this.sharedContactShadow?.dispose();
    this.sharedContactShadow = null;
    this.sharedPuddleRoughness?.dispose();
    this.sharedPuddleRoughness = null;
    this.sharedLightCone?.dispose();
    this.sharedLightCone = null;
  }
}

export const SharedTexPool = new SharedTexturePool();

/** 512x512 procedural Tiananmen Square granite slab texture with 4x4 staggered stone slabs, mortar seams, and weathered patina. */
export function granitePavingTex(repeatX = 28, repeatY = 52): THREE.CanvasTexture {
  return SharedTexPool.granitePaving(repeatX, repeatY);
}

/** 512x512 procedural 1980s Beijing asphalt road texture with aggregate speckle and subtle tire wear tracks. */
export function asphaltRoadTex(repeatX = 24, repeatY = 4): THREE.CanvasTexture {
  return SharedTexPool.asphaltRoad(repeatX, repeatY);
}

/** 512x512 procedural Peking University grey brick / courtyard flagstone texture with staggered seams and mossy edges. */
export function campusPathTex(repeatX = 12, repeatY = 12): THREE.CanvasTexture {
  return SharedTexPool.campusPath(repeatX, repeatY);
}

/** 512x512 procedural atmospheric sky texture tailored to each chapter and time of day. */
export function skyDomeTex(mode: SkyMode): THREE.CanvasTexture {
  return SharedTexPool.skyDome(mode);
}

export interface AtmosphereConfig {
  fogColor: number;
  near: number;
  far: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  dirColor: number;
  dirIntensity: number;
  dirPos: [number, number, number];
  skyMode: ResolvedSkyMode;
}

export const ATMOSPHERE_PRESETS: Record<AtmospherePreset, AtmosphereConfig> = {
  night: {
    fogColor: 0x0e1220,
    near: 18,
    far: 70,
    hemiSky: 0x55607a,
    hemiGround: 0x1c1810,
    hemiIntensity: 0.9,
    dirColor: 0x8090b0,
    dirIntensity: 0.35,
    dirPos: [-10, 20, 8],
    skyMode: 'night',
  },
  dawn: {
    fogColor: 0xd2c9bb,
    near: 18,
    far: 72,
    hemiSky: 0xdfe7f2,
    hemiGround: 0x6b604c,
    hemiIntensity: 1.25,
    dirColor: 0xffdcb4,
    dirIntensity: 1.5,
    dirPos: [28, 22, -14],
    skyMode: 'dawn',
  },
  day_spring: {
    fogColor: 0xd8c19d,
    near: 24,
    far: 110,
    hemiSky: 0xf6e6c4,
    hemiGround: 0x6e5f46,
    hemiIntensity: 1.35,
    dirColor: 0xffd699,
    dirIntensity: 1.7,
    dirPos: [-26, 28, -12],
    skyMode: 'camp',
  },
  dusk_warm: {
    fogColor: 0x6c4c52,
    near: 22,
    far: 95,
    hemiSky: 0x9b7898,
    hemiGround: 0x3b2c26,
    hemiIntensity: 0.95,
    dirColor: 0xffa868,
    dirIntensity: 1.15,
    dirPos: [-28, 12, -18],
    skyMode: 'statue',
  },
  rain_overcast: {
    fogColor: 0x56606b,
    near: 14,
    far: 62,
    hemiSky: 0x8c9aa8,
    hemiGround: 0x34383d,
    hemiIntensity: 1.05,
    dirColor: 0xb0bec8,
    dirIntensity: 0.55,
    dirPos: [12, 24, 10],
    skyMode: 'rain_overcast',
  },
  curfew_amber: {
    fogColor: 0x26170b,
    near: 14,
    far: 65,
    hemiSky: 0x885828,
    hemiGround: 0x1d1309,
    hemiIntensity: 0.95,
    dirColor: 0xffb460,
    dirIntensity: 0.45,
    dirPos: [-14, 18, 10],
    skyMode: 'blockade',
  },
  aftermath: {
    fogColor: 0xc2cbd2,
    near: 12,
    far: 58,
    hemiSky: 0xe4edf2,
    hemiGround: 0x504f47,
    hemiIntensity: 1.25,
    dirColor: 0xfff0d8,
    dirIntensity: 0.85,
    dirPos: [16, 22, -10],
    skyMode: 'aftermath',
  },
};

export interface ApplyAtmosphereOpts {
  near?: number;
  far?: number;
  setSky?: boolean;
  addLights?: boolean;
}

/**
 * Apply fog, sky dome, and directional/hemisphere lighting for an AtmospherePreset.
 */
export function applyAtmosphere(
  scene: THREE.Scene,
  preset: AtmospherePreset,
  opts?: ApplyAtmosphereOpts,
): string | null {
  const cfg = ATMOSPHERE_PRESETS[preset] ?? ATMOSPHERE_PRESETS.night;
  const near = opts?.near ?? cfg.near;
  const far = opts?.far ?? cfg.far;

  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(cfg.fogColor);
    scene.fog.near = near;
    scene.fog.far = far;
  } else {
    scene.fog = new THREE.Fog(cfg.fogColor, near, far);
  }

  let skyKey: string | null = null;
  if (opts?.setSky !== false) {
    const prevKey = scene.userData.__atmoSkyKey as string | undefined;
    const skyTex = SharedTexPool.skyDome(cfg.skyMode);
    skyKey = (skyTex.userData.poolKey as string | undefined) ?? null;
    if (prevKey && prevKey !== skyKey) SharedTexPool.release(prevKey);
    scene.background = skyTex;
    scene.userData.__atmoSkyKey = skyKey;
  } else if (!scene.background) {
    scene.background = new THREE.Color(cfg.fogColor);
  }

  if (opts?.addLights !== false) {
    let hemi = scene.getObjectByName('__atmo_hemi') as THREE.HemisphereLight | undefined;
    if (!hemi || !hemi.isHemisphereLight) {
      hemi = new THREE.HemisphereLight(cfg.hemiSky, cfg.hemiGround, cfg.hemiIntensity);
      hemi.name = '__atmo_hemi';
      scene.add(hemi);
    } else {
      hemi.color.setHex(cfg.hemiSky);
      hemi.groundColor.setHex(cfg.hemiGround);
      hemi.intensity = cfg.hemiIntensity;
    }

    let dir = scene.getObjectByName('__atmo_dir') as THREE.DirectionalLight | undefined;
    if (!dir || !dir.isDirectionalLight) {
      dir = new THREE.DirectionalLight(cfg.dirColor, cfg.dirIntensity);
      dir.name = '__atmo_dir';
      scene.add(dir);
    } else {
      dir.color.setHex(cfg.dirColor);
      dir.intensity = cfg.dirIntensity;
    }
    dir.position.set(cfg.dirPos[0], cfg.dirPos[1], cfg.dirPos[2]);
  }

  scene.userData.atmosphere = preset;
  return skyKey;
}

/**
 * Upgrade a built scene to PBR realism: shared sky/ground IBL, selective soft shadow casting (<= 4 hero meshes),
 * Lambert -> MeshStandard ground/prop promotion, and wet night/rain asphalt specular reflections.
 */
export function applyRealismLighting(
  scene: THREE.Scene,
  preset: AtmospherePreset,
  isMobile: boolean,
  renderer: THREE.WebGLRenderer
): void {
  scene.environment = SharedTexPool.envMap(renderer);
  const envIntensity =
    preset === 'night' ? 0.30
    : preset === 'curfew_amber' ? 0.36
    : preset === 'dusk_warm' ? 0.48
    : preset === 'rain_overcast' ? 0.56
    : 0.58;
  scene.environmentIntensity = envIntensity;

  if (scene.userData.__realismApplied) return;
  scene.userData.__realismApplied = true;

  const isRain = preset === 'rain_overcast';
  const isWetNight = preset === 'night' || preset === 'curfew_amber';
  const isWet = isRain || isWetNight;
  const candidates: Array<{ mesh: THREE.Mesh; radius: number }> = [];

  scene.traverse(obj => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh || m.userData?.persistent || m.name === 'rainSystem') return;

    const isGroundPlane = Boolean(
      m.geometry?.type === 'PlaneGeometry' && Math.abs(m.rotation.x + Math.PI / 2) < 0.2
    );
    const rawMat = m.material;
    if (rawMat && !Array.isArray(rawMat) && (rawMat as THREE.MeshLambertMaterial).isMeshLambertMaterial) {
      const lm = rawMat as THREE.MeshLambertMaterial;
      if (!lm.userData?.shared) {
        const std = new THREE.MeshStandardMaterial({
          color: lm.color.clone(),
          map: lm.map ?? null,
          emissive: lm.emissive ? lm.emissive.clone() : new THREE.Color(0x000000),
          emissiveIntensity: lm.emissiveIntensity ?? 1,
          vertexColors: lm.vertexColors,
          transparent: lm.transparent,
          opacity: lm.opacity,
          side: lm.side,
          fog: lm.fog,
          roughness: isGroundPlane ? (isRain ? 0.92 : isWetNight ? 0.78 : 0.84) : 0.80,
          roughnessMap: isGroundPlane && isRain ? SharedTexPool.puddleRoughnessTex() : null,
          metalness: isGroundPlane && isRain ? 0.22 : isGroundPlane && isWetNight ? 0.06 : 0.04,
          envMapIntensity: isGroundPlane && isRain ? 1.55 : 0.95,
        });
        lm.dispose();
        m.material = std;
      }
    }

    const activeMat = m.material as THREE.Material | undefined;
    if (activeMat && (activeMat as THREE.MeshBasicMaterial).isMeshBasicMaterial) return;

    m.receiveShadow = true;

    if (!m.geometry) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    if (!bb) return;
    const sizeY = bb.max.y - bb.min.y;
    const sizeXZ = Math.hypot(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
    const isTransparent = Boolean(activeMat && activeMat.transparent);
    const matMap = (activeMat as THREE.MeshStandardMaterial | undefined)?.map;
    const hasDisposableMap = Boolean(matMap && !matMap.userData?.shared && !isSharedWallTexture(matMap));
    if (
      !isGroundPlane &&
      !isTransparent &&
      !hasDisposableMap &&
      sizeY >= 1.5 &&
      sizeXZ >= 1.2 &&
      !(m as THREE.InstancedMesh).isInstancedMesh
    ) {
      candidates.push({ mesh: m, radius: sizeXZ });
    }
  });

  candidates.sort((a, b) => b.radius - a.radius);
  for (let i = 0; i < Math.min(4, candidates.length); i++) {
    candidates[i]!.mesh.castShadow = true;
  }

  // Pick or configure one main directional light as the soft shadow caster
  let mainDir: THREE.DirectionalLight | undefined;
  scene.traverse(obj => {
    const dl = obj as THREE.DirectionalLight;
    if (dl.isDirectionalLight) {
      if (dl.name === '__atmo_dir' || !mainDir || dl.intensity > mainDir.intensity) {
        mainDir = dl;
      }
    }
  });

  if (mainDir) {
    const cfg = ATMOSPHERE_PRESETS[preset] ?? ATMOSPHERE_PRESETS.night;
    mainDir.castShadow = true;
    const mapRes = isMobile ? 512 : 1024;
    mainDir.shadow.mapSize.set(mapRes, mapRes);
    mainDir.shadow.camera.left = -32;
    mainDir.shadow.camera.right = 32;
    mainDir.shadow.camera.top = 32;
    mainDir.shadow.camera.bottom = -32;
    mainDir.shadow.camera.near = 2;
    mainDir.shadow.camera.far = 140;
    mainDir.shadow.bias = -0.0006;
    mainDir.shadow.normalBias = 0.035;
    mainDir.shadow.needsUpdate = true;

    const dirVec = new THREE.Vector3(cfg.dirPos[0], Math.max(12, cfg.dirPos[1]), cfg.dirPos[2]).normalize().multiplyScalar(44);
    if (!mainDir.target.parent) scene.add(mainDir.target);
    scene.userData.__shadowLight = mainDir;
    scene.userData.__shadowDirOffset = [dirVec.x, dirVec.y, dirVec.z];
    scene.add(mainDir.target);
  }

  // Single instanced soft-fresnel volumetric lamp light cones for outdoor night/rain streets (+1 call, zero hard edges)
  if ((isRain || isWetNight) && !scene.getObjectByName('__volumetricCones')) {
    const coneLights: THREE.Vector3[] = [];
    scene.traverse(obj => {
      const pt = obj as THREE.PointLight;
      // Only high streetlamp/flood lights (skip low interior courtyard lights y < 4.2 to avoid floating mid-yard beams)
      if (pt.isPointLight && pt.visible && pt.position.y >= 4.2 && pt.position.y <= 10.5 && coneLights.length < 16) {
        coneLights.push(pt.position.clone());
      }
    });
    if (coneLights.length > 0) {
      const coneGeo = new THREE.CylinderGeometry(0.14, 1.75, 4.2, 20, 1, true);
      const coneMat = new THREE.MeshBasicMaterial({
        map: SharedTexPool.lightConeTex(),
        color: isRain ? 0xcad6e2 : 0xffbe68,
        transparent: true,
        opacity: isRain ? 0.13 : 0.11,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
        fog: true,
      });
      // Smooth view-space silhouette Fresnel fade so volumetric beam edges feather cleanly from any camera angle
      coneMat.customProgramCacheKey = () => 'b89-volumetric-cone';
      coneMat.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vConeViewN;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvConeViewN = normalize((viewMatrix * vec4(normal, 0.0)).xyz);');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vConeViewN;')
          .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= pow(clamp(abs(vConeViewN.z), 0.0, 1.0), 2.4);');
      };
      const cones = new THREE.InstancedMesh(coneGeo, coneMat, coneLights.length);
      cones.name = '__volumetricCones';
      cones.castShadow = false;
      cones.receiveShadow = false;
      cones.frustumCulled = false;
      const dummy = new THREE.Object3D();
      coneLights.forEach((pos, idx) => {
        const hScale = Math.max(0.85, Math.min(1.25, pos.y / 4.4));
        dummy.position.set(pos.x, pos.y - 2.1 * hScale, pos.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(hScale, hScale, hScale);
        dummy.updateMatrix();
        cones.setMatrixAt(idx, dummy.matrix);
      });
      cones.instanceMatrix.needsUpdate = true;
      scene.add(cones);
    }
  }
}

export interface RainSystem {
  mesh: THREE.InstancedMesh;
  count: number;
  update(dt: number, camX: number, camZ: number): void;
  dispose(): void;
}

/**
 * Single-draw-call instanced rain volume (`600` mobile / `1000` desktop) recycled seamlessly around camera `[x, z]`.
 */
export function makeRainSystem(isMobile: boolean): RainSystem {
  const count = isMobile ? 600 : 1000;
  const spanXZ = 36;
  const halfXZ = spanXZ * 0.5;
  const spanY = 18;

  // Two crossed vertical streak quads so raindrops read clearly from every camera azimuth
  const q1 = new THREE.PlaneGeometry(0.022, 0.72);
  const q2 = new THREE.PlaneGeometry(0.022, 0.72);
  q2.rotateY(Math.PI / 2);
  const geo = mergeGeometries([q1, q2])!;
  q1.dispose();
  q2.dispose();

  const mat = new THREE.MeshBasicMaterial({
    color: 0xc2d0de,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.name = 'rainSystem';
  mesh.frustumCulled = false;

  const ox = new Float32Array(count);
  const oy = new Float32Array(count);
  const oz = new Float32Array(count);
  const speed = new Float32Array(count);
  const yaw = new Float32Array(count);

  const r = rng(19890523);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < count; i++) {
    ox[i] = (r() - 0.5) * spanXZ;
    oy[i] = r() * spanY;
    oz[i] = (r() - 0.5) * spanXZ;
    speed[i] = 14 + r() * 8;
    yaw[i] = r() * Math.PI;
  }

  const wrapAround = (val: number, center: number): number => {
    const rel = ((((val - center + halfXZ) % spanXZ) + spanXZ) % spanXZ) - halfXZ;
    return center + rel;
  };

  const update = (dt: number, camX: number, camZ: number) => {
    const step = Math.min(Math.max(dt, 0), 0.1);
    for (let i = 0; i < count; i++) {
      let y = oy[i]! - speed[i]! * step;
      if (y < 0) y = ((y % spanY) + spanY) % spanY;
      oy[i] = y;
      ox[i] += 1.4 * step;
      const wx = wrapAround(ox[i]!, camX);
      const wz = wrapAround(oz[i]!, camZ);
      dummy.position.set(wx, y, wz);
      dummy.rotation.set(0.04, yaw[i]!, 0.08);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  update(0, 0, 0);

  return {
    mesh,
    count,
    update,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
