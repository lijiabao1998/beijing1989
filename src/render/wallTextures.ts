import * as THREE from 'three';

export type WallTexKind =
  | 'qingBrick'
  | 'redBrick'
  | 'palaceWall'
  | 'ashlarStone'
  | 'plaster'
  | 'roofTile'
  | 'terrazzoFloor'
  | 'woodPlank';

export interface WallTexSpec {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  normalScale: number;
  tileW: number;
  tileH: number;
}

const SIZE = 512;

function mkPrng(seed: number): () => number {
  let s = seed | 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2d(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function mkCanvasPair(): {
  albedo: HTMLCanvasElement;
  bump: HTMLCanvasElement;
  actx: CanvasRenderingContext2D;
  bctx: CanvasRenderingContext2D;
} {
  const albedo = document.createElement('canvas');
  const bump = document.createElement('canvas');
  albedo.width = bump.width = SIZE;
  albedo.height = bump.height = SIZE;
  return {
    albedo,
    bump,
    actx: albedo.getContext('2d')!,
    bctx: bump.getContext('2d')!,
  };
}

function finalizeTex(canvas: HTMLCanvasElement, isColor: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.userData.shared = true;
  tex.userData.wallTexture = true;
  tex.needsUpdate = true;
  return tex;
}

/** Convert a greyscale height canvas into a seamless tileable RGB tangent-space normal map via 3x3 Sobel filter. */
function heightToNormalCanvas(heightCanvas: HTMLCanvasElement, strength = 2.4): HTMLCanvasElement {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d')!;
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const normCanvas = document.createElement('canvas');
  normCanvas.width = w;
  normCanvas.height = h;
  const dstCtx = normCanvas.getContext('2d')!;
  const dstImg = dstCtx.createImageData(w, h);
  const dst = dstImg.data;

  const sample = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4]! / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  dstCtx.putImageData(dstImg, 0, 0);
  return normCanvas;
}

function finalizeSpec(
  albedo: HTMLCanvasElement,
  bump: HTMLCanvasElement,
  strength: number,
  normalScale: number,
  tileW: number,
  tileH: number
): WallTexSpec {
  return {
    map: finalizeTex(albedo, true),
    normalMap: finalizeTex(heightToNormalCanvas(bump, strength), false),
    normalScale,
    tileW,
    tileH,
  };
}

/**
 * Aged Beijing Qingzhuan (grey brick) masonry in traditional multi-stretcher + header bond.
 * Neutral light albedo so vertexColors carry each wall's historic soot/grey/lime tint cleanly.
 */
function buildQingBrick(): WallTexSpec {
  const { albedo, bump, actx, bctx } = mkCanvasPair();
  const rnd = mkPrng(198901);

  // Neutral pale mortar ground
  actx.fillStyle = '#dddad2';
  actx.fillRect(0, 0, SIZE, SIZE);
  bctx.fillStyle = '#242424';
  bctx.fillRect(0, 0, SIZE, SIZE);

  const rows = 20;
  const rowH = SIZE / rows;
  const mortar = 2.4;

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    // Authentic Beijing bond: every 5th course uses narrow header bricks (dingzhuan)
    const isHeaderRow = r % 5 === 4;
    const cols = isHeaderRow ? 14 : 7;
    const colW = SIZE / cols;
    const stagger = isHeaderRow ? 0 : (r % 2 === 1 ? 0.5 : 0);

    for (let c = -1; c <= cols; c++) {
      const wrappedC = ((c % cols) + cols) % cols;
      const h = hash2d(wrappedC, r, 101);
      const x = (c + stagger) * colW;
      const bw = colW - mortar;
      const bh = rowH - mortar;

      // Keep brick albedo light (195..238) so dark vertex color stays crisp without muddying
      const base = Math.round(196 + h * 40);
      const warm = Math.round((hash2d(wrappedC, r, 202) - 0.5) * 8);
      actx.fillStyle = `rgb(${base + warm},${base},${base - warm + 2})`;
      actx.fillRect(x + mortar * 0.5, y + mortar * 0.5, bw, bh);

      // Subtle bevel rim + raised face on bump
      bctx.fillStyle = '#8e8e8e';
      bctx.fillRect(x + mortar * 0.5, y + mortar * 0.5, bw, bh);
      const bVal = Math.round(196 + h * 46);
      bctx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
      bctx.fillRect(x + mortar * 0.5 + 1.5, y + mortar * 0.5 + 1.5, Math.max(1, bw - 3), Math.max(1, bh - 3));

      // Subtle alkali/kiln blotch on occasional bricks
      if (hash2d(wrappedC, r, 303) > 0.72) {
        actx.fillStyle = 'rgba(255,252,246,0.14)';
        actx.fillRect(x + 3, y + 3, bw * 0.55, bh * 0.45);
      }
    }
  }

  // Fine kiln pores + mortar grain (tileable mod wrapping)
  for (let i = 0; i < 4200; i++) {
    const px = Math.floor(rnd() * SIZE);
    const py = Math.floor(rnd() * SIZE);
    const sz = 1 + Math.floor(rnd() * 2);
    const dark = rnd() > 0.45;
    actx.fillStyle = dark ? 'rgba(30,28,25,0.09)' : 'rgba(255,255,250,0.09)';
    actx.fillRect(px, py, sz, sz);
    bctx.fillStyle = dark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)';
    bctx.fillRect(px, py, sz, sz);
  }

  return finalizeSpec(albedo, bump, 2.8, 0.92, 2.4, 1.8);
}

/**
 * 1950s–1980s Beijing machine-pressed red clay brick (standard Soviet/industrial running bond).
 */
function buildRedBrick(): WallTexSpec {
  const { albedo, bump, actx, bctx } = mkCanvasPair();
  const rnd = mkPrng(198902);

  // Pale lime-sand mortar
  actx.fillStyle = '#eae5da';
  actx.fillRect(0, 0, SIZE, SIZE);
  bctx.fillStyle = '#202020';
  bctx.fillRect(0, 0, SIZE, SIZE);

  const rows = 18;
  const cols = 7;
  const rowH = SIZE / rows;
  const colW = SIZE / cols;
  const mortar = 2.8;

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const stagger = r % 2 === 1 ? 0.5 : 0;
    for (let c = -1; c <= cols; c++) {
      const wc = ((c % cols) + cols) % cols;
      const h1 = hash2d(wc, r, 411);
      const h2 = hash2d(wc, r, 412);
      const x = (c + stagger) * colW;
      const bw = colW - mortar;
      const bh = rowH - mortar;

      // Light warm-neutral brick values (195..244) so vertex color carries terracotta tone cleanly
      const lum = Math.round(196 + h1 * 46);
      const rShift = Math.round(10 + h2 * 10);
      const bShift = Math.round(-6 - h2 * 8);
      actx.fillStyle = `rgb(${Math.min(252, lum + rShift)},${lum},${Math.max(165, lum + bShift)})`;
      actx.fillRect(x + mortar * 0.5, y + mortar * 0.5, bw, bh);

      bctx.fillStyle = '#929292';
      bctx.fillRect(x + mortar * 0.5, y + mortar * 0.5, bw, bh);
      const bVal = Math.round(200 + h1 * 46);
      bctx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
      bctx.fillRect(x + mortar * 0.5 + 1.5, y + mortar * 0.5 + 1.5, Math.max(1, bw - 3), Math.max(1, bh - 3));
    }
  }

  for (let i = 0; i < 3800; i++) {
    const px = Math.floor(rnd() * SIZE);
    const py = Math.floor(rnd() * SIZE);
    const dark = rnd() > 0.4;
    actx.fillStyle = dark ? 'rgba(42,24,18,0.10)' : 'rgba(255,248,236,0.08)';
    actx.fillRect(px, py, 2, 1.5);
    bctx.fillStyle = dark ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.12)';
    bctx.fillRect(px, py, 2, 1.5);
  }

  return finalizeSpec(albedo, bump, 2.9, 0.95, 2.4, 1.8);
}

/**
 * Imperial vermilion lime-plaster wall (Tiananmen & PKU West Gate courtyard walls):
 * Subtle lime plaster over faint underlying brick joint ghosting + weathered brush grain.
 */
function buildPalaceWall(): WallTexSpec {
  const { albedo, bump, actx, bctx } = mkCanvasPair();
  const rnd = mkPrng(198903);

  actx.fillStyle = '#efefef';
  actx.fillRect(0, 0, SIZE, SIZE);
  bctx.fillStyle = '#bdbdbd';
  bctx.fillRect(0, 0, SIZE, SIZE);

  // Subtle faint underlying masonry undulation under thick lime wash
  const rows = 14;
  const cols = 6;
  const rowH = SIZE / rows;
  const colW = SIZE / cols;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const stag = r % 2 === 1 ? 0.5 : 0;
    for (let c = -1; c <= cols; c++) {
      const wc = ((c % cols) + cols) % cols;
      const h = hash2d(wc, r, 555);
      const x = (c + stag) * colW;
      const g = Math.round(228 + h * 18);
      actx.fillStyle = `rgba(${g},${g - 2},${g - 3},0.35)`;
      actx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);

      const bv = Math.round(180 + h * 36);
      bctx.fillStyle = `rgba(${bv},${bv},${bv},0.55)`;
      bctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);
    }
  }

  // Lime trowel strokes + vertical weathering ribbons
  for (let i = 0; i < 45; i++) {
    const wx = rnd() * SIZE;
    const wy = rnd() * SIZE;
    const w = 18 + rnd() * 55;
    const h = 40 + rnd() * 140;
    const alpha = 0.04 + rnd() * 0.05;
    const shade = rnd() > 0.5 ? '255,252,248' : '165,152,148';
    for (const dx of [-SIZE, 0, SIZE]) {
      for (const dy of [-SIZE, 0, SIZE]) {
        actx.fillStyle = `rgba(${shade},${alpha})`;
        actx.fillRect(wx + dx, wy + dy, w, h);
      }
    }
  }

  for (let i = 0; i < 3200; i++) {
    const px = Math.floor(rnd() * SIZE);
    const py = Math.floor(rnd() * SIZE);
    actx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(90,75,70,0.06)';
    actx.fillRect(px, py, 2, 2);
    bctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(40,40,40,0.12)';
    bctx.fillRect(px, py, 2, 2);
  }

  return finalizeSpec(albedo, bump, 1.8, 0.52, 4.2, 3.2);
}

/**
 * Large Fangshan marble & granite cut ashlar blocks (Great Hall, Museum, Monument, Telegraph/Hotel podiums).
 */
function buildAshlarStone(): WallTexSpec {
  const { albedo, bump, actx, bctx } = mkCanvasPair();
  const rnd = mkPrng(198904);

  // Recessed chamfer seam color
  actx.fillStyle = '#b4b1aa';
  actx.fillRect(0, 0, SIZE, SIZE);
  bctx.fillStyle = '#262626';
  bctx.fillRect(0, 0, SIZE, SIZE);

  const rows = 6;
  const cols = 4;
  const rowH = SIZE / rows;
  const colW = SIZE / cols;
  const joint = 4;

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const stag = r % 2 === 1 ? 0.5 : 0;
    for (let c = -1; c <= cols; c++) {
      const wc = ((c % cols) + cols) % cols;
      const h1 = hash2d(wc, r, 701);
      const h2 = hash2d(wc, r, 702);
      const x = (c + stag) * colW;
      const bw = colW - joint;
      const bh = rowH - joint;

      // Subtle mineral variance between ashlar blocks
      const lum = Math.round(218 + h1 * 30);
      const tint = Math.round((h2 - 0.5) * 8);
      actx.fillStyle = `rgb(${lum + tint},${lum},${lum - tint})`;
      actx.fillRect(x + joint * 0.5, y + joint * 0.5, bw, bh);

      // Dressed outer margin & inner chamfer on bump
      bctx.fillStyle = '#9a9a9a';
      bctx.fillRect(x + joint * 0.5, y + joint * 0.5, bw, bh);
      const faceB = Math.round(212 + h1 * 32);
      bctx.fillStyle = `rgb(${faceB},${faceB},${faceB})`;
      bctx.fillRect(x + joint * 0.5 + 3, y + joint * 0.5 + 3, bw - 6, bh - 6);
    }
  }

  // Granite / dressed limestone crystal stipple
  for (let i = 0; i < 5000; i++) {
    const px = Math.floor(rnd() * SIZE);
    const py = Math.floor(rnd() * SIZE);
    const d = rnd() > 0.48;
    actx.fillStyle = d ? 'rgba(60,58,54,0.06)' : 'rgba(255,255,252,0.08)';
    actx.fillRect(px, py, 1.8, 1.8);
    bctx.fillStyle = d ? 'rgba(30,30,30,0.10)' : 'rgba(255,255,255,0.10)';
    bctx.fillRect(px, py, 1.8, 1.8);
  }

  return finalizeSpec(albedo, bump, 2.6, 0.85, 4.8, 3.6);
}

/**
 * 1980s Beijing lime/cement stucco & brushed terrazzo plaster (street facades, upper towers, workshop dado).
 */
function buildPlaster(): WallTexSpec {
  const { albedo, bump, actx, bctx } = mkCanvasPair();
  const rnd = mkPrng(198905);

  actx.fillStyle = '#eae8e3';
  actx.fillRect(0, 0, SIZE, SIZE);
  bctx.fillStyle = '#b4b4b4';
  bctx.fillRect(0, 0, SIZE, SIZE);

  // Subtle vertical rainwater streaks & formwork joints
  for (let r = 0; r < 4; r++) {
    const gy = (r + 0.5) * (SIZE / 4);
    actx.fillStyle = 'rgba(130,126,118,0.16)';
    actx.fillRect(0, gy, SIZE, 2);
    bctx.fillStyle = 'rgba(60,60,60,0.35)';
    bctx.fillRect(0, gy, SIZE, 2);
  }

  for (let i = 0; i < 65; i++) {
    const wx = rnd() * SIZE;
    const wy = rnd() * SIZE;
    const w = 10 + rnd() * 34;
    const h = 45 + rnd() * 140;
    const bright = rnd() > 0.55;
    for (const dx of [-SIZE, 0, SIZE]) {
      for (const dy of [-SIZE, 0, SIZE]) {
        actx.fillStyle = bright ? 'rgba(255,255,252,0.05)' : 'rgba(120,116,108,0.05)';
        actx.fillRect(wx + dx, wy + dy, w, h);
      }
    }
  }

  for (let i = 0; i < 6500; i++) {
    const px = Math.floor(rnd() * SIZE);
    const py = Math.floor(rnd() * SIZE);
    const d = rnd() > 0.5;
    actx.fillStyle = d ? 'rgba(65,62,58,0.08)' : 'rgba(255,255,250,0.08)';
    actx.fillRect(px, py, 2, 2);
    bctx.fillStyle = d ? 'rgba(25,25,25,0.18)' : 'rgba(255,255,255,0.16)';
    bctx.fillRect(px, py, 2, 2);
  }

  return finalizeSpec(albedo, bump, 1.7, 0.50, 3.6, 3.6);
}

/**
 * Traditional Chinese semicircular barrel tiles (Tongwa / Xiaoqingwa):
 * Vertical cylindrical tile ribs + horizontal overlap step courses.
 */
function buildRoofTile(): WallTexSpec {
  const { albedo, bump, actx, bctx } = mkCanvasPair();
  const rnd = mkPrng(198906);

  const imgA = actx.createImageData(SIZE, SIZE);
  const imgB = bctx.createImageData(SIZE, SIZE);
  const ribs = 14;
  const courses = 10;
  const coursePx = SIZE / courses;

  for (let y = 0; y < SIZE; y++) {
    const localY = (y % coursePx) / coursePx;
    // Slight step-down shading near top & crisp shadow lip at bottom of each tile course
    const overlapShade = localY > 0.88 ? 0.68 : 0.94 + 0.06 * (1 - localY);
    const overlapBump = localY > 0.9 ? 0.38 : 0.72 + 0.28 * (1 - localY);
    const courseIdx = Math.floor(y / coursePx);

    for (let x = 0; x < SIZE; x++) {
      const phase = ((x * ribs) / SIZE) * Math.PI * 2;
      // Convex cap ridge in middle of each rib, narrow concave trough between caps
      const ridge = 0.5 + 0.5 * Math.cos(phase);
      const ribShade = 0.68 + 0.32 * Math.pow(ridge, 0.75);
      const ribIdx = Math.floor((x * ribs) / SIZE) % ribs;
      const tileVar = (hash2d(ribIdx, courseIdx, 909) - 0.5) * 20;

      const idx = (y * SIZE + x) * 4;
      const lum = Math.max(115, Math.min(252, Math.round(244 * ribShade * overlapShade + tileVar)));
      imgA.data[idx] = lum;
      imgA.data[idx + 1] = lum;
      imgA.data[idx + 2] = Math.max(110, lum - 3);
      imgA.data[idx + 3] = 255;

      const bVal = Math.max(20, Math.min(255, Math.round(252 * Math.pow(ridge, 0.65) * overlapBump)));
      imgB.data[idx] = bVal;
      imgB.data[idx + 1] = bVal;
      imgB.data[idx + 2] = bVal;
      imgB.data[idx + 3] = 255;
    }
  }
  actx.putImageData(imgA, 0, 0);
  bctx.putImageData(imgB, 0, 0);

  // Windblown Beijing dust & subtle glaze/tile flecks
  for (let i = 0; i < 2400; i++) {
    const px = Math.floor(rnd() * SIZE);
    const py = Math.floor(rnd() * SIZE);
    actx.fillStyle = rnd() > 0.5 ? 'rgba(255,252,242,0.06)' : 'rgba(55,50,45,0.07)';
    actx.fillRect(px, py, 2, 2);
  }

  return finalizeSpec(albedo, bump, 3.2, 1.08, 3.6, 3.4);
}

/**
 * 1980s Beijing institutional polished terrazzo floor (水磨石地面) with brass divider strips & marble aggregate chips.
 */
function buildTerrazzoFloor(): WallTexSpec {
  const { albedo, bump, actx, bctx } = mkCanvasPair();
  const rnd = mkPrng(198907);

  // Neutral warm-grey cement matrix so Part.c vertexColors tint cool or warm cleanly
  actx.fillStyle = '#ddd9cf';
  actx.fillRect(0, 0, SIZE, SIZE);
  bctx.fillStyle = '#cfcfcf';
  bctx.fillRect(0, 0, SIZE, SIZE);

  // Subtle bay-to-bay cement tone variation across 4x4 brass-divided bays
  const grid = 4;
  const step = SIZE / grid;
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const h = hash2d(col, row, 1207);
      const base = Math.round(212 + h * 16);
      actx.fillStyle = `rgb(${base},${base - 2},${base - 6})`;
      actx.fillRect(col * step + 2, row * step + 2, step - 4, step - 4);
    }
  }

  // Embedded brass divider strips (銅條嵌縫)
  actx.fillStyle = '#b99d5e';
  bctx.fillStyle = '#848484';
  for (let i = 0; i < grid; i++) {
    const p = i * step;
    actx.fillRect(0, p, SIZE, 2.5);
    actx.fillRect(p, 0, 2.5, SIZE);
    bctx.fillRect(0, p, SIZE, 2.5);
    bctx.fillRect(p, 0, 2.5, SIZE);
  }

  // Multi-tone marble & granite aggregate chips wrapped across tile borders
  const chipCols = ['#f4f1ea', '#c7c1b5', '#969188', '#78756f', '#c29674', '#e5decb'];
  for (let i = 0; i < 1400; i++) {
    const cx = rnd() * SIZE;
    const cy = rnd() * SIZE;
    const rx = 1.6 + rnd() * 4.2;
    const ry = 1.2 + rnd() * 3.0;
    const ang = rnd() * Math.PI;
    const col = chipCols[Math.floor(rnd() * chipCols.length)]!;
    const bv = Math.round(212 + rnd() * 36);
    for (const dx of [-SIZE, 0, SIZE]) {
      if (cx + dx + 6 < 0 || cx + dx - 6 > SIZE) continue;
      for (const dy of [-SIZE, 0, SIZE]) {
        if (cy + dy + 6 < 0 || cy + dy - 6 > SIZE) continue;
        actx.save();
        actx.translate(cx + dx, cy + dy);
        actx.rotate(ang);
        actx.fillStyle = col;
        actx.fillRect(-rx * 0.5, -ry * 0.5, rx, ry);
        actx.restore();

        bctx.save();
        bctx.translate(cx + dx, cy + dy);
        bctx.rotate(ang);
        bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
        bctx.fillRect(-rx * 0.5, -ry * 0.5, rx, ry);
        bctx.restore();
      }
    }
  }

  // Fine ground polish grit
  for (let i = 0; i < 2400; i++) {
    const px = Math.floor(rnd() * SIZE);
    const py = Math.floor(rnd() * SIZE);
    actx.fillStyle = rnd() > 0.5 ? 'rgba(255,254,248,0.08)' : 'rgba(60,58,54,0.07)';
    actx.fillRect(px, py, 1.5, 1.5);
  }

  return finalizeSpec(albedo, bump, 1.6, 0.42, 3.2, 3.2);
}

/**
 * 1980s Beijing tongue-and-groove interior timber floorboards (木地板 / 護牆木板) in staggered running bond.
 */
function buildWoodPlank(): WallTexSpec {
  const { albedo, bump, actx, bctx } = mkCanvasPair();
  const rnd = mkPrng(198908);

  // Dark seam ground
  actx.fillStyle = '#6f6558';
  actx.fillRect(0, 0, SIZE, SIZE);
  bctx.fillStyle = '#3c3c3c';
  bctx.fillRect(0, 0, SIZE, SIZE);

  const rows = 8;
  const cols = 2;
  const rowH = SIZE / rows;
  const colW = SIZE / cols;
  const seam = 2.4;

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const stagger = (r % 3) * 0.34;
    for (let c = -1; c <= cols; c++) {
      const wc = ((c % cols) + cols) % cols;
      const h1 = hash2d(wc, r, 1501);
      const h2 = hash2d(wc, r, 1502);
      const x = (c + stagger) * colW;
      const pw = colW - seam;
      const ph = rowH - seam;

      // Light warm neutral plank tone (196..236) so vertexColors paint oak/pine/walnut cleanly
      const base = Math.round(198 + h1 * 34);
      const warm = Math.round(6 + h2 * 8);
      actx.fillStyle = `rgb(${Math.min(248, base + warm)},${base},${Math.max(158, base - warm * 2)})`;
      actx.fillRect(x + seam * 0.5, y + seam * 0.5, pw, ph);

      // Beveled plank edge + subtle crown on bump
      bctx.fillStyle = '#9a9a9a';
      bctx.fillRect(x + seam * 0.5, y + seam * 0.5, pw, ph);
      const bFace = Math.round(196 + h1 * 38);
      bctx.fillStyle = `rgb(${bFace},${bFace},${bFace})`;
      bctx.fillRect(x + seam * 0.5 + 1.5, y + seam * 0.5 + 1.5, Math.max(1, pw - 3), Math.max(1, ph - 3));
    }
  }

  // Longitudinal wood grain streaks (tileable across X)
  for (let i = 0; i < 240; i++) {
    const gx = rnd() * SIZE;
    const row = Math.floor(rnd() * rows);
    const gy = row * rowH + 4 + rnd() * (rowH - 8);
    const len = 36 + rnd() * 110;
    const dark = rnd() > 0.35;
    const colA = dark ? `rgba(74,56,36,${(0.06 + rnd() * 0.08).toFixed(3)})` : 'rgba(255,250,238,0.08)';
    const colB = dark ? 'rgba(40,40,40,0.14)' : 'rgba(255,255,255,0.10)';
    for (const dx of [-SIZE, 0, SIZE]) {
      if (gx + dx + len < 0 || gx + dx > SIZE) continue;
      actx.fillStyle = colA;
      actx.fillRect(gx + dx, gy, len, 1.4);
      bctx.fillStyle = colB;
      bctx.fillRect(gx + dx, gy, len, 1.2);
    }
  }

  // Subtle wood knots
  for (let i = 0; i < 14; i++) {
    const kx = rnd() * SIZE;
    const row = Math.floor(rnd() * rows);
    const ky = row * rowH + 10 + rnd() * (rowH - 20);
    const kr = 3 + rnd() * 4;
    for (const dx of [-SIZE, 0, SIZE]) {
      if (kx + dx + kr < 0 || kx + dx - kr > SIZE) continue;
      actx.fillStyle = 'rgba(72,54,34,0.16)';
      actx.beginPath();
      actx.ellipse(kx + dx, ky, kr * 1.6, kr * 0.8, 0, 0, Math.PI * 2);
      actx.fill();
    }
  }

  return finalizeSpec(albedo, bump, 2.0, 0.65, 2.8, 2.8);
}

const MAX_TEX_CACHE = 8;
const texCache = new Map<WallTexKind, WallTexSpec>();

export function isSharedWallTexture(tex: THREE.Texture | null | undefined): boolean {
  if (!tex) return false;
  if (tex.userData?.wallTexture || tex.userData?.shared) return true;
  for (const spec of texCache.values()) {
    if (spec.map === tex || spec.normalMap === tex) return true;
  }
  return false;
}

export function getWallTexSpec(kind: WallTexKind): WallTexSpec {
  let spec = texCache.get(kind);
  if (!spec) {
    switch (kind) {
      case 'qingBrick':
        spec = buildQingBrick();
        break;
      case 'redBrick':
        spec = buildRedBrick();
        break;
      case 'palaceWall':
        spec = buildPalaceWall();
        break;
      case 'ashlarStone':
        spec = buildAshlarStone();
        break;
      case 'plaster':
        spec = buildPlaster();
        break;
      case 'roofTile':
        spec = buildRoofTile();
        break;
      case 'terrazzoFloor':
        spec = buildTerrazzoFloor();
        break;
      case 'woodPlank':
        spec = buildWoodPlank();
        break;
    }
    if (texCache.size >= MAX_TEX_CACHE) {
      const oldestKey = texCache.keys().next().value;
      if (oldestKey !== undefined) texCache.delete(oldestKey);
    }
    texCache.set(kind, spec);
  }
  return spec;
}

export function makeWallMaterial(kind: WallTexKind, emissive = 0): THREE.MeshStandardMaterial {
  const spec = getWallTexSpec(kind);
  const roughness =
    kind === 'roofTile' ? 0.34
    : kind === 'terrazzoFloor' ? 0.36
    : kind === 'woodPlank' ? 0.62
    : kind === 'ashlarStone' ? 0.68
    : kind === 'palaceWall' ? 0.78
    : 0.88;
  const metalness =
    kind === 'roofTile' ? 0.10
    : kind === 'terrazzoFloor' ? 0.08
    : 0.02;
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: spec.map,
    normalMap: spec.normalMap,
    normalScale: new THREE.Vector2(spec.normalScale, spec.normalScale),
    roughness,
    metalness,
    emissive,
  });
}
