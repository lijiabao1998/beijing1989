import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Part } from './kit';
import { textTexture } from './kit';

export interface SouthSkylineBundle {
  stat: Part[];       // merged into static lit vertex-colored geometry
  flood: Part[];      // merged into warm floodlight-responsive geometry
  glow: Part[];       // merged into self-lit emissive geometry (clock dial, warm hotel windows, lantern accents)
  extras: THREE.Object3D[]; // at most 2-4 textured meshes (clock dial + Qianmen embrasure facade if needed)
}

const PAL = {
  // Mao Mausoleum (毛主席紀念堂)
  jujubeDark: 0x662220,
  jujubeMid: 0x782b27,
  jujubeLight: 0x8b3630,
  creamCore: 0xa79982,
  pierCream: 0xd0c7b2,
  marble: 0xe2ded4,
  marbleWarm: 0xd3cec2,
  bronzePortal: 0x3e3226,
  portalShadow: 0x16110e,
  goldTile: 0xd4a028,
  goldRidge: 0xe2b842,
  greenFrieze: 0x245e54,

  // Zhengyangmen & Qianmen (正陽門城樓 / 箭樓)
  brickDark: 0x4b4e52,
  brickMid: 0x575a5f,
  brickLight: 0x676a6f,
  stonePlinth: 0x7a766e,
  palaceRed: 0x7b241d,
  imperialRed: 0x8e2b22,
  gateRed: 0x5c1712,
  archDark: 0x160e0c,
  greyTile: 0x464a4f,
  greyTileLight: 0x52565c,
  greenTrim: 0x276c4a,

  // Beijing Hotel & Telegraph Building (北京飯店 / 電報大樓)
  hotelCream: 0xd6cebc,
  hotelBalcony: 0xe6dfd0,
  hotelPodium: 0xb0a694,
  frenchLimestone: 0xbaa98e,
  frenchBase: 0x9b8d77,
  teleTan: 0xc8baa0,
  teleTower: 0xd2c6ae,
  cupolaCopper: 0x465e54,
  darkGlass: 0x222b34,

  // Pine beds, subway canopies, distant skyline
  pineDark: 0x1d341f,
  pineMid: 0x274226,
  graniteCurb: 0x8c877c,
  terrazzo: 0x78746b,
  metroGreen: 0x265846,
  skylineCream: 0xa89f8e,
  skylineGrey: 0x6c6e72,
  skylineBrick: 0x4a4c50,
};

function emptyBundle(): SouthSkylineBundle {
  return { stat: [], flood: [], glow: [], extras: [] };
}

function appendBundle(dst: SouthSkylineBundle, src: SouthSkylineBundle): SouthSkylineBundle {
  dst.stat.push(...src.stat);
  dst.flood.push(...src.flood);
  dst.glow.push(...src.glow);
  dst.extras.push(...src.extras);
  return dst;
}

/** Add an axis-aligned Xieshan (歇山頂) gable-and-hip roof using low-poly pyramid skirt + A-frame prism. */
function addXieshanRoof(
  p: Part[],
  x: number,
  yBase: number,
  z: number,
  w: number,
  h: number,
  d: number,
  tileCol: number,
  trimCol: number,
  ridgeCol: number,
) {
  const skirtH = h * 0.44;
  const upperH = h * 0.62;
  const upperW = w * 0.68;
  const upperD = d * 0.72;
  p.push(
    { p: [x, yBase + 0.14, z], s: [w + 0.4, 0.28, d + 0.4], c: trimCol },
    { p: [x, yBase + skirtH * 0.5 + 0.16, z], s: [w, skirtH, d], c: tileCol, roof: true, tex: 'roofTile' },
    { p: [x, yBase + skirtH * 0.72 + upperH * 0.5, z], s: [upperD, upperH, upperW], c: tileCol, prism: true, ry: Math.PI / 2, tex: 'roofTile' },
    { p: [x, yBase + skirtH * 0.72 + upperH * 0.42, z], s: [upperD * 0.92, upperH * 0.78, upperW + 0.25], c: 0xc9c3b6, prism: true, ry: Math.PI / 2 },
  );
  const yPeak = yBase + skirtH * 0.72 + upperH;
  p.push(
    { p: [x, yPeak + 0.14, z], s: [upperW + 0.5, 0.32, 0.42], c: ridgeCol },
    { p: [x - upperW * 0.5, yPeak + 0.44, z], s: [0.55, 0.68, 0.48], c: ridgeCol },
    { p: [x + upperW * 0.5, yPeak + 0.44, z], s: [0.55, 0.68, 0.48], c: ridgeCol },
  );
  for (const sx of [-1, 1]) {
    p.push({ p: [x + sx * (upperW * 0.5 + 0.12), yBase + skirtH * 0.72 + upperH * 0.48, z], s: [0.32, upperH * 0.95, upperD * 0.42], c: trimCol });
  }
}

/** Add a lean perimeter balustrade run (continuous rails + spaced posts, optional mini caps). */
function addLeanBalustrade(
  p: Part[],
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  postCount: number,
  col: number,
  cap = false,
) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (len < 0.2) return;
  const alongX = Math.abs(dx) >= Math.abs(dz);
  const cx = (x0 + x1) * 0.5;
  const cz = (z0 + z1) * 0.5;
  p.push(
    { p: [cx, y + 0.14, cz], s: [alongX ? len : 0.24, 0.16, alongX ? 0.24 : len], c: col },
    { p: [cx, y + 0.68, cz], s: [alongX ? len : 0.22, 0.14, alongX ? 0.22 : len], c: col },
  );
  const n = Math.max(2, postCount);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const px = x0 + dx * t;
    const pz = z0 + dz * t;
    p.push({ p: [px, y + 0.48, pz], s: [0.30, 0.92, 0.30], c: col });
    if (cap) p.push({ p: [px, y + 1.02, pz], s: [0.28, 0.18, 0.28], c: PAL.marble, roof: true });
  }
}

/** Add a simple window bank (warm glow at night, cool recessed glass in daylight). */
function addWindowStrip(
  b: SouthSkylineBundle,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  night: boolean,
  warmCol = 0xffcf7a,
) {
  if (night) {
    b.glow.push({ p: [x, y, z], s: [w, h, d], c: warmCol, noAO: true });
  } else {
    b.stat.push({ p: [x, y, z], s: [w, h, d], c: PAL.darkGlass });
  }
}

/** 1. 天安門廣場國旗基座 (1989 pre-renovation two-tier white marble Sumeru pedestal & corner guard posts at (0, -112), y <= 1.2). */
export function flagpolePlatform(): SouthSkylineBundle {
  const b = emptyBundle();
  const fx = 0;
  const fz = -112;
  b.flood.push(
    { p: [fx, 0.08, fz], s: [6.8, 0.16, 6.8], c: PAL.graniteCurb, tex: 'ashlarStone' },
    { p: [fx, 0.28, fz], s: [5.2, 0.24, 5.2], c: PAL.marbleWarm, tex: 'ashlarStone' },
    { p: [fx, 0.46, fz], s: [4.2, 0.14, 4.2], c: PAL.marble, tex: 'ashlarStone' },
    { p: [fx, 0.66, fz], s: [3.6, 0.26, 3.6], c: 0xc8c2b4, tex: 'ashlarStone' },
    { p: [fx, 0.87, fz], s: [4.4, 0.18, 4.4], c: PAL.marble, tex: 'ashlarStone' },
    { p: [fx, 1.04, fz], s: [1.5, 0.18, 1.5], c: PAL.marble, cyl: true, seg: 8 },
  );
  b.stat.push({ p: [fx, 1.16, fz], s: [0.85, 0.08, 0.85], c: PAL.bronzePortal, cyl: true, seg: 8 });
  for (const sx of [-1, 1]) {
    b.flood.push({ p: [fx, 0.14, fz + sx * 2.85], s: [2.4, 0.14, 0.55], c: PAL.marbleWarm });
    for (const sz of [-1, 1]) {
      const px = fx + sx * 2.65;
      const pz = fz + sz * 2.65;
      b.flood.push(
        { p: [px, 0.50, pz], s: [0.28, 0.68, 0.28], c: PAL.marble },
        { p: [px, 0.92, pz], s: [0.32, 0.16, 0.32], c: 0xeeeae0, roof: true },
      );
    }
  }
  return b;
}

/** 2. 毛主席紀念堂 at (0, -445): two-tier jujube Sichuan granite platform, 44 square piers, double-tier golden roof (h = 33.6m). */
export function maoMausoleum(night: boolean): SouthSkylineBundle {
  const b = emptyBundle();
  const zc = -445;

  // Lower & upper burgundy-red Sichuan granite platform tiers
  b.stat.push(
    { p: [0, 0.9, zc], s: [105, 1.8, 95], c: PAL.jujubeDark, tex: 'ashlarStone' },
  );
  b.flood.push(
    { p: [0, 1.82, zc], s: [105.6, 0.16, 95.6], c: PAL.marble, tex: 'ashlarStone' },
    { p: [0, 2.7, zc], s: [84, 1.8, 76], c: PAL.jujubeMid, tex: 'ashlarStone' },
    { p: [0, 3.62, zc], s: [84.8, 0.22, 76.8], c: PAL.marble, tex: 'ashlarStone' },
  );

  // Broad North (+Z) ceremonial granite steps + South steps + flanking red granite sculptural pedestals
  for (let i = 0; i < 6; i++) {
    const h1 = 1.75 - i * 0.28;
    b.flood.push({ p: [0, h1 * 0.5, zc + 47.6 + i * 0.9], s: [40, h1, 0.95], c: PAL.jujubeMid });
    const h2 = 1.75 - i * 0.28;
    b.flood.push({ p: [0, 1.8 + h2 * 0.5, zc + 38.2 + i * 0.9], s: [34, h2, 0.95], c: PAL.jujubeLight });
  }
  for (let i = 0; i < 4; i++) {
    const hs = 3.4 - i * 0.82;
    b.stat.push({ p: [0, hs * 0.5, zc - 47.8 - i * 1.1], s: [28, hs, 1.15], c: PAL.jujubeDark });
  }
  for (const sx of [-1, 1]) {
    b.flood.push(
      { p: [sx * 20.4, 1.25, zc + 49.8], s: [0.9, 0.76, 5.2], c: PAL.jujubeLight, rx: 0.30 },
      { p: [sx * 17.4, 3.05, zc + 40.4], s: [0.9, 0.76, 5.2], c: PAL.jujubeLight, rx: 0.30 },
      // Iconic flanking revolutionary sculpture pedestals on the North terrace
      { p: [sx * 29.5, 2.3, zc + 42.6], s: [8.0, 1.0, 5.6], c: PAL.jujubeDark },
      { p: [sx * 29.5, 4.1, zc + 42.6], s: [6.6, 2.6, 4.4], c: PAL.jujubeMid },
      { p: [sx * 29.5, 6.1, zc + 42.6], s: [5.6, 1.5, 3.2], c: PAL.jujubeLight },
    );
  }

  // White marble balustrade corner rails on both terrace tiers (clean framing clear of stair openings)
  for (const sz of [-1, 1]) {
    const z1 = zc + sz * 47.2;
    const z2 = zc + sz * 37.8;
    const gap1 = sz === 1 ? 21.0 : 15.0;
    const gap2 = sz === 1 ? 18.0 : 15.0;
    addLeanBalustrade(b.flood, -52.0, z1, -gap1, z1, 1.9, 4, PAL.marble);
    addLeanBalustrade(b.flood, gap1, z1, 52.0, z1, 1.9, 4, PAL.marble);
    addLeanBalustrade(b.flood, -41.6, z2, -gap2, z2, 3.7, 3, PAL.marble);
    addLeanBalustrade(b.flood, gap2, z2, 41.6, z2, 3.7, 3, PAL.marble);
  }
  for (const sx of [-1, 1]) {
    addLeanBalustrade(b.flood, sx * 52.0, zc - 47.0, sx * 52.0, zc + 47.0, 1.9, 6, PAL.marble);
    addLeanBalustrade(b.flood, sx * 41.6, zc - 37.6, sx * 41.6, zc + 37.6, 3.7, 5, PAL.marble);
  }

  // 44 Square Granite Colonnade Pillars (12 North, 12 South, 10 East, 10 West = 44 total)
  const colW = 66;
  const colD = 52;
  const addCol = (cx: number, cz: number) => {
    b.flood.push(
      { p: [cx, 12.5, cz], s: [1.55, 17.6, 1.55], c: PAL.pierCream, tex: 'ashlarStone' },
      { p: [cx, 3.92, cz], s: [1.85, 0.42, 1.85], c: PAL.marble, tex: 'ashlarStone' },
      { p: [cx, 21.08, cz], s: [1.82, 0.42, 1.82], c: PAL.marbleWarm, tex: 'ashlarStone' },
    );
  };
  for (let i = 0; i < 12; i++) {
    const x = -colW / 2 + (i * colW) / 11;
    addCol(x, zc + colD / 2);
    addCol(x, zc - colD / 2);
  }
  for (let j = 1; j <= 10; j++) {
    const z = zc - colD / 2 + (j * colD) / 11;
    addCol(-colW / 2, z);
    addCol(colW / 2, z);
  }

  // Recessed cream/beige hall core, bronze ribs, and North ceremonial portal + plaque
  b.stat.push(
    { p: [0, 12.6, zc], s: [56, 17.6, 42], c: PAL.creamCore, tex: 'ashlarStone' },
    { p: [0, 8.6, zc + 21.3], s: [14.0, 9.8, 1.0], c: PAL.bronzePortal },
    { p: [0, 7.6, zc + 21.6], s: [9.4, 7.8, 0.6], c: PAL.portalShadow },
  );
  for (const rx of [-22, -14, 14, 22]) {
    b.stat.push(
      { p: [rx, 12.6, zc + 21.1], s: [0.45, 16.0, 0.3], c: PAL.bronzePortal },
      { p: [rx, 12.6, zc - 21.1], s: [0.45, 16.0, 0.3], c: PAL.bronzePortal },
    );
  }
  b.flood.push(
    { p: [0, 18.6, zc + 21.4], s: [10.8, 2.4, 0.6], c: PAL.marble, tex: 'ashlarStone' },
    { p: [0, 18.6, zc + 21.7], s: [8.8, 1.45, 0.25], c: 0x8e241c },
  );
  if (night) {
    b.glow.push({ p: [0, 11.4, zc + 21.7], s: [8.8, 0.85, 0.16], c: 0xffd288, noAO: true });
  }

  // Double-tiered golden-glazed hipped roof (重簷黃色琉璃瓦) peaking at y = 33.6m
  b.flood.push(
    { p: [0, 21.45, zc], s: [71.5, 0.55, 57.5], c: PAL.marble, tex: 'ashlarStone' },
    { p: [0, 22.85, zc], s: [73.0, 0.35, 59.0], c: PAL.goldTile, tex: 'roofTile' },
    { p: [0, 25.1, zc], s: [75.0, 4.4, 61.0], c: PAL.goldTile, roof: true, tex: 'roofTile' },
    { p: [0, 27.1, zc], s: [52.0, 2.8, 40.0], c: PAL.creamCore, tex: 'ashlarStone' },
    { p: [0, 28.85, zc], s: [55.5, 0.36, 43.5], c: PAL.goldRidge },
    { p: [0, 31.05, zc], s: [58.0, 4.5, 46.0], c: PAL.goldTile, roof: true, tex: 'roofTile' },
    { p: [0, 33.24, zc], s: [14.0, 0.42, 0.7], c: PAL.goldRidge },
    { p: [-7.1, 33.34, zc], s: [0.65, 0.56, 0.65], c: PAL.goldRidge },
    { p: [7.1, 33.34, zc], s: [0.65, 0.56, 0.65], c: PAL.goldRidge },
  );
  b.stat.push(
    { p: [0, 22.2, zc], s: [69.5, 1.1, 55.5], c: PAL.greenFrieze },
    { p: [0, 28.25, zc], s: [53.8, 0.95, 41.8], c: PAL.greenFrieze },
  );

  return b;
}

/** 3a. 正陽門城樓 at (0, -525): monumental gray-brick city gate podium + vaulted arch + triple-tier Xieshan roof (42m). */
export function zhengyangmen(): SouthSkylineBundle {
  const b = emptyBundle();
  const zc = -525;

  // Gray-brick trapezoidal fortress podium (52m x 14m x 24m), split around central x = 0 vaulted arch
  b.stat.push(
    { p: [-14.4, 0.6, zc], s: [24.2, 1.2, 25.2], c: PAL.stonePlinth, tex: 'ashlarStone' },
    { p: [14.4, 0.6, zc], s: [24.2, 1.2, 25.2], c: PAL.stonePlinth, tex: 'ashlarStone' },
    { p: [-14.2, 4.2, zc], s: [23.2, 6.2, 24.0], c: PAL.brickDark, tex: 'qingBrick' },
    { p: [14.2, 4.2, zc], s: [23.2, 6.2, 24.0], c: PAL.brickDark, tex: 'qingBrick' },
    { p: [-14.0, 10.4, zc], s: [22.4, 6.4, 22.4], c: PAL.brickMid, tex: 'qingBrick' },
    { p: [14.0, 10.4, zc], s: [22.4, 6.4, 22.4], c: PAL.brickMid, tex: 'qingBrick' },
    { p: [0, 11.4, zc], s: [5.6, 5.2, 22.4], c: PAL.brickMid, tex: 'qingBrick' },
    // Central vaulted red pass-through arch (0x5c1712 / 0x160e0c)
    { p: [0, 3.2, zc], s: [5.2, 6.4, 22.8], c: PAL.archDark },
    { p: [0, 6.4, zc], s: [5.2, 22.8, 5.2], c: PAL.archDark, cyl: true, rx: Math.PI / 2, seg: 8 },
    { p: [-2.4, 3.2, zc + 10.6], s: [0.5, 6.2, 1.2], c: PAL.gateRed },
    { p: [2.4, 3.2, zc + 10.6], s: [0.5, 6.2, 1.2], c: PAL.gateRed },
  );
  b.flood.push(
    { p: [0, 13.75, zc], s: [51.2, 0.55, 23.0], c: PAL.marbleWarm, tex: 'ashlarStone' },
  );
  // Podium battlements along North & South parapet walls
  for (let i = -4; i <= 4; i++) {
    const bx = i * 5.4;
    b.stat.push(
      { p: [bx, 14.35, zc + 11.1], s: [2.8, 0.85, 0.6], c: PAL.brickLight, tex: 'qingBrick' },
      { p: [bx, 14.35, zc - 11.1], s: [2.8, 0.85, 0.6], c: PAL.brickLight, tex: 'qingBrick' },
    );
  }

  // Crimson palace colonnade pavilion atop podium (y = 14..28)
  b.flood.push(
    { p: [0, 14.4, zc], s: [44, 0.8, 19.5], c: PAL.stonePlinth, tex: 'ashlarStone' },
    { p: [0, 18.4, zc], s: [41, 7.6, 16.5], c: PAL.palaceRed, tex: 'palaceWall' },
    { p: [0, 25.4, zc], s: [37, 4.2, 13.5], c: PAL.palaceRed, tex: 'palaceWall' },
  );
  for (let i = 0; i < 8; i++) {
    const px = -17.5 + i * 5.0;
    b.flood.push(
      { p: [px, 18.4, zc + 8.8], s: [0.65, 7.2, 0.65], c: PAL.imperialRed, cyl: true, seg: 6 },
      { p: [px, 18.4, zc - 8.8], s: [0.65, 7.2, 0.65], c: PAL.imperialRed, cyl: true, seg: 6 },
    );
    if (i < 7) {
      b.stat.push(
        { p: [px + 2.5, 17.8, zc + 8.28], s: [3.4, 4.2, 0.14], c: PAL.gateRed },
        { p: [px + 2.5, 18.2, zc + 8.34], s: [3.0, 2.8, 0.10], c: PAL.goldRidge },
      );
    }
  }
  b.stat.push(
    { p: [0, 22.3, zc], s: [42, 0.9, 17.6], c: PAL.greenFrieze },
    { p: [0, 27.6, zc], s: [38, 0.85, 14.5], c: PAL.greenFrieze },
  );

  // Triple-tiered Xieshan green-edged gray tile roof (~42m tall peak)
  b.stat.push(
    { p: [0, 23.0, zc], s: [47.5, 0.34, 21.5], c: PAL.greenTrim },
    { p: [0, 24.1, zc], s: [47.0, 2.0, 21.0], c: PAL.greyTile, roof: true, tex: 'roofTile' },
    { p: [0, 28.1, zc], s: [43.5, 0.34, 18.8], c: PAL.greenTrim },
    { p: [0, 29.7, zc], s: [43.0, 3.0, 18.4], c: PAL.greyTile, roof: true, tex: 'roofTile' },
  );
  addXieshanRoof(b.flood, 0, 31.1, zc, 41.5, 10.5, 18.2, PAL.greyTileLight, PAL.greenTrim, PAL.goldRidge);

  return b;
}

/** 3b. 前門箭樓 at (0, -578): brick base + 4-story embrasure keep with shared Canvas embrasure facade + Xieshan roof. */
export function qianmenArrowTower(): SouthSkylineBundle {
  const b = emptyBundle();
  const zc = -578;

  // Fortress gray-brick podium (h = 11.5m), split around lower arch
  b.stat.push(
    { p: [-12.8, 5.75, zc], s: [20.4, 11.5, 20.0], c: PAL.brickDark, tex: 'qingBrick' },
    { p: [12.8, 5.75, zc], s: [20.4, 11.5, 20.0], c: PAL.brickDark, tex: 'qingBrick' },
    { p: [0, 9.4, zc], s: [5.2, 4.2, 20.0], c: PAL.brickMid, tex: 'qingBrick' },
    { p: [0, 3.6, zc], s: [4.8, 7.2, 20.4], c: PAL.archDark },
    { p: [0, 11.65, zc], s: [46.6, 0.45, 20.6], c: PAL.marbleWarm, tex: 'ashlarStone' },
    // Upper 4-story defensive keep (y = 11.8..28.6)
    { p: [0, 20.2, zc], s: [41.6, 16.8, 17.0], c: PAL.brickMid, tex: 'qingBrick' },
    { p: [0, 28.8, zc], s: [42.6, 0.85, 18.0], c: PAL.greenFrieze },
  );
  // Subtle dark embrasure slit accents on East & West end walls
  for (const sx of [-1, 1]) {
    for (let row = 0; row < 4; row++) {
      b.stat.push({ p: [sx * 20.86, 14.2 + row * 3.6, zc], s: [0.12, 1.5, 11.5], c: 0x222428 });
    }
  }
  // Steep Xieshan green-trimmed gray tile roof (y = 29.0..38.8)
  addXieshanRoof(b.stat, 0, 29.0, zc, 45.6, 9.8, 20.5, PAL.greyTile, PAL.greenTrim, PAL.goldRidge);

  // 1 merged textured mesh covering North (+Z) and South (-Z) 4x12 archery embrasure facades
  let map: THREE.Texture | null = null;
  if (typeof document !== 'undefined') {
    map = textTexture(512, 256, g => {
      g.fillStyle = '#585b60';
      g.fillRect(0, 0, 512, 256);
      g.fillStyle = '#4c4f54';
      for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 512, 3);
      g.fillStyle = '#6d7074';
      g.fillRect(0, 124, 512, 6);
      for (let row = 0; row < 4; row++) {
        const ey = 20 + row * 58;
        for (let col = 0; col < 12; col++) {
          const ex = 22 + col * 40;
          g.fillStyle = '#d8d2c4';
          g.fillRect(ex - 2, ey - 2, 24, 34);
          g.fillStyle = '#151412';
          g.fillRect(ex + 2, ey + 2, 16, 26);
          g.fillStyle = '#6e231c';
          g.fillRect(ex + 3, ey + 3, 14, 11);
        }
      }
    });
  }
  const gN = new THREE.PlaneGeometry(40.4, 16.0);
  gN.translate(0, 20.2, zc + 8.56);
  const gS = new THREE.PlaneGeometry(40.4, 16.0);
  gS.rotateY(Math.PI);
  gS.translate(0, 20.2, zc - 8.56);
  const merged = mergeGeometries([gN, gS])!;
  b.extras.push(
    new THREE.Mesh(
      merged,
      new THREE.MeshLambertMaterial({ map, color: 0xffffff, emissive: 0x100f0e }),
    ),
  );

  return b;
}

/** 4. 北京飯店 (East Wing at (238, -24), h=44m w=52 d=22; 1954 Middle/French Wing at (192, -26)). */
export function beijingHotel(night: boolean): SouthSkylineBundle {
  const b = emptyBundle();

  // 1974 East Wing (x = 238, z = -22.5 -> south facade at z = -33.5, canopies stay behind z = -35.6 poplars)
  const ex = 238;
  const ez = -22.5;
  b.stat.push(
    { p: [ex, 3.6, ez], s: [54, 7.2, 23.0], c: PAL.hotelPodium, tex: 'ashlarStone' },
    { p: [ex, 7.32, ez], s: [54.4, 0.35, 23.4], c: PAL.hotelBalcony, tex: 'ashlarStone' },
    { p: [ex, 2.6, ez - 11.4], s: [14, 4.4, 0.8], c: PAL.darkGlass },
    { p: [ex, 23.8, ez], s: [52, 33.4, 22.0], c: PAL.hotelCream, tex: 'plaster' },
    { p: [ex, 40.8, ez], s: [52.8, 0.75, 22.6], c: PAL.hotelBalcony, tex: 'ashlarStone' },
    { p: [ex, 42.4, ez], s: [28, 3.2, 12], c: 0xc8bfac, tex: 'plaster' },
    { p: [ex, 48.8, ez], s: [0.45, 9.6, 0.45], c: 0x8e9296, cyl: true, seg: 6 },
    { p: [ex, 50.6, ez], s: [4.2, 0.18, 0.18], c: 0x8e9296 },
  );
  b.flood.push(
    { p: [ex, 4.9, ez - 12.0], s: [15.0, 0.65, 2.2], c: PAL.hotelBalcony },
  );
  // Vertical stair/elevator limestone piers + intermediate room divider fins framing the 1974 facade
  for (const px of [ex - 25.2, ex - 9.5, ex + 9.5, ex + 25.2]) {
    b.stat.push({ p: [px, 23.8, ez - 10.9], s: [1.9, 33.6, 0.9], c: PAL.hotelBalcony, tex: 'ashlarStone' });
  }
  for (const fx of [ex - 17.4, ex, ex + 17.4]) {
    b.stat.push({ p: [fx, 23.8, ez - 11.55], s: [0.28, 30.8, 1.4], c: 0xd0c7b4 });
  }
  // Iconic horizontal projecting photographer balcony strips, iron guardrails, side-wall windows & shadow strips across 8 floor tiers
  const occupiedPattern = [
    [-19, -14, -4, 3, 14, 20],
    [-21, -5, 1, 15, 21],
    [-18, -13, 2, 16],
    [-20, -4, 4, 13, 19],
    [-17, -2, 5, 18],
    [-21, -15, 1, 14, 20],
    [-16, -3, 15],
    [-18, 4, 17],
  ];
  for (let fl = 0; fl < 8; fl++) {
    const fy = 10.0 + fl * 3.8;
    b.stat.push(
      { p: [ex, fy + 1.15, ez - 11.02], s: [49.2, 1.55, 0.18], c: PAL.darkGlass },
      { p: [ex, fy, ez - 11.85], s: [52.6, 0.95, 2.0], c: PAL.hotelBalcony, tex: 'plaster' },
      { p: [ex, fy + 0.65, ez - 12.78], s: [52.4, 0.12, 0.12], c: 0x3b3f44 },
      { p: [ex - 26.06, fy + 1.1, ez], s: [0.16, 1.55, 14.5], c: PAL.darkGlass },
      { p: [ex + 26.06, fy + 1.1, ez], s: [0.16, 1.55, 14.5], c: PAL.darkGlass },
    );
    if (night) {
      for (const ox of occupiedPattern[fl]) {
        const warm = (fl + ox) % 3 === 0 ? 0xffe29a : 0xffc86b;
        b.glow.push({ p: [ex + ox, fy + 1.15, ez - 11.12], s: [3.2, 1.35, 0.10], c: warm, noAO: true });
      }
    }
  }
  if (night) {
    b.glow.push(
      { p: [ex, 2.4, ez - 11.85], s: [11.5, 2.4, 0.15], c: 0xffd286, noAO: true },
      { p: [ex, 53.7, ez], s: [0.55, 0.55, 0.55], c: 0xe03a28, noAO: true },
    );
  }

  // 1954 Middle / French Wing at (192, -25) + 1917 West Wing shoulder at (165, -23) across Nanchizi St
  const mx = 192;
  const mz = -25;
  b.stat.push(
    { p: [mx, 2.6, mz], s: [41, 5.2, 18.6], c: PAL.frenchBase, tex: 'ashlarStone' },
    { p: [mx, 14.2, mz], s: [40, 18.2, 18.0], c: PAL.frenchLimestone, tex: 'plaster' },
    { p: [mx, 23.4, mz], s: [41.2, 0.9, 19.2], c: PAL.hotelBalcony, tex: 'ashlarStone' },
    { p: [mx, 24.4, mz], s: [39.0, 1.1, 17.0], c: PAL.frenchBase, tex: 'ashlarStone' },
    // 1917 West Wing corner shoulder linking toward Forbidden City axis
    { p: [165, 9.5, -23], s: [14, 19.0, 16], c: 0xaa9b82, tex: 'plaster' },
    { p: [165, 19.2, -23], s: [14.8, 0.7, 16.8], c: PAL.hotelBalcony, tex: 'ashlarStone' },
  );
  // Horizontal belt courses & arched/stone-framed French windows on 1917 shoulder & 1954 Middle Wing
  for (let row = 0; row < 4; row++) {
    const wy = 8.4 + row * 3.6;
    b.stat.push(
      { p: [165, wy, -31.05], s: [9.4, 1.5, 0.18], c: PAL.darkGlass },
      { p: [165, wy - 0.85, -31.10], s: [10.4, 0.22, 0.28], c: PAL.hotelBalcony },
    );
    for (let col = -3; col <= 3; col++) {
      const wx = mx + col * 5.0;
      const lit = night && ((row + col + 10) % 3 === 0 || col === 0);
      b.stat.push(
        { p: [wx, wy, mz - 9.01], s: [2.9, 2.25, 0.16], c: PAL.hotelBalcony },
        { p: [wx, wy - 1.15, mz - 9.10], s: [3.1, 0.20, 0.28], c: PAL.frenchBase },
      );
      addWindowStrip(b, wx, wy, mz - 9.08, 2.4, 1.8, 0.12, lit, 0xffcd78);
    }
  }
  b.flood.push(
    { p: [mx, 3.6, mz - 9.6], s: [13, 0.6, 1.8], c: PAL.hotelBalcony },
  );
  for (let i = 0; i < 4; i++) {
    b.stat.push({ p: [mx - 4.8 + i * 3.2, 2.2, mz - 10.2], s: [0.65, 4.4, 0.65], c: PAL.hotelBalcony, tex: 'ashlarStone' });
  }

  return b;
}

/** 5. 北京電報大樓 at (-242, -24): 1958 horizontal cream/tan facade, ground portico, 44m clock tower + spire + glowing dials. */
export function telegraphBuilding(night: boolean): SouthSkylineBundle {
  const b = emptyBundle();
  const tx = -242;
  const tz = -24;

  // Main 1958 horizontal limestone wing (w = 58, h = 27, d = 20)
  b.stat.push(
    { p: [tx, 0.45, tz], s: [60, 0.9, 22], c: PAL.stonePlinth, tex: 'ashlarStone' },
    // Warm recessed ashlar granite lobby backing wall behind colonnade (instead of pitch-dark black strip)
    { p: [tx, 3.9, tz + 1.2], s: [57, 6.2, 17.4], c: 0x827868, tex: 'ashlarStone' },
    { p: [tx, 7.25, tz], s: [59.0, 0.72, 21.0], c: PAL.teleTower, tex: 'ashlarStone' },
    { p: [tx, 16.2, tz], s: [58, 18.6, 20], c: PAL.teleTan, tex: 'plaster' },
    { p: [tx, 25.1, tz], s: [59.0, 0.48, 21.2], c: 0xc2b9a2, tex: 'ashlarStone' },
    { p: [tx, 25.8, tz], s: [59.6, 1.0, 21.6], c: PAL.teleTower, tex: 'ashlarStone' },
    { p: [tx, 26.8, tz], s: [57.2, 1.1, 19.2], c: PAL.hotelPodium, tex: 'ashlarStone' },
  );
  // 8 Colonnaded ground portico piers (with plinth bases & capitals) + 7 tall mullioned lobby windows + upper pilasters
  for (let i = 0; i < 8; i++) {
    const px = tx - 21 + i * 6.0;
    b.stat.push(
      { p: [px, 1.25, tz - 9.5], s: [1.45, 0.75, 1.45], c: PAL.marbleWarm, tex: 'ashlarStone' },
      { p: [px, 3.9, tz - 9.5], s: [1.15, 6.2, 1.15], c: PAL.teleTower, tex: 'ashlarStone' },
      { p: [px, 6.75, tz - 9.5], s: [1.42, 0.45, 1.42], c: PAL.marbleWarm, tex: 'ashlarStone' },
      { p: [px, 16.2, tz - 10.1], s: [0.95, 18.2, 0.45], c: PAL.teleTower, tex: 'ashlarStone' },
    );
    if (i < 7) {
      const gx = px + 3.0;
      b.stat.push(
        { p: [gx, 3.6, tz - 7.45], s: [3.9, 4.8, 0.24], c: PAL.hotelBalcony, tex: 'ashlarStone' },
        { p: [gx, 3.6, tz - 7.52], s: [3.2, 4.1, 0.16], c: PAL.darkGlass },
        { p: [gx, 3.6, tz - 7.58], s: [0.16, 4.1, 0.12], c: PAL.bronzePortal },
        { p: [gx, 4.6, tz - 7.58], s: [3.2, 0.16, 0.12], c: PAL.bronzePortal },
      );
      if (night && (i >= 2 && i <= 4)) {
        b.glow.push({ p: [gx, 3.2, tz - 7.56], s: [2.8, 3.2, 0.08], c: 0xffd284, noAO: true });
      }
    }
  }
  // Upper facade window bays with limestone sills & vertical mullions
  for (let row = 0; row < 4; row++) {
    const wy = 9.4 + row * 4.0;
    for (let i = 0; i < 7; i++) {
      const wx = tx - 18 + i * 6.0;
      const lit = night && ((row + i) % 3 === 1 || (row === 1 && i === 3));
      b.stat.push(
        { p: [wx, wy - 1.12, tz - 10.14], s: [3.4, 0.24, 0.28], c: PAL.hotelBalcony },
        { p: [wx, wy, tz - 10.10], s: [0.16, 2.0, 0.12], c: PAL.bronzePortal },
      );
      addWindowStrip(b, wx, wy, tz - 10.05, 3.0, 2.0, 0.14, lit, 0xffd282);
    }
  }

  // Central Clock Tower (鐘樓, rising to y = 44m) + corner pilasters + belfry louvers + stepped cupola & spire
  b.stat.push(
    { p: [tx, 32.8, tz], s: [11.6, 11.4, 11.6], c: PAL.teleTower, tex: 'ashlarStone' },
    { p: [tx, 28.6, tz - 5.84], s: [4.2, 1.9, 0.18], c: 0x2f3338 },
    { p: [tx, 28.6, tz - 5.88], s: [4.6, 0.22, 0.26], c: PAL.hotelBalcony },
    { p: [tx, 38.7, tz], s: [12.8, 0.85, 12.8], c: PAL.hotelBalcony, tex: 'ashlarStone' },
    { p: [tx, 40.1, tz], s: [6.8, 2.2, 6.8], c: PAL.teleTan, tex: 'ashlarStone' },
    { p: [tx, 42.4, tz], s: [7.6, 2.5, 7.6], c: PAL.cupolaCopper, roof: true },
    { p: [tx, 44.1, tz], s: [0.35, 1.8, 0.35], c: PAL.goldRidge, cyl: true, seg: 6 },
  );
  // Dark bronze clock bezels + circular glowing halo backing behind dial meshes on S/E/W/N faces
  const dialFaces: [number, number, number][] = [
    [0, -5.82, Math.PI],
    [5.82, 0, Math.PI / 2],
    [-5.82, 0, -Math.PI / 2],
    [0, 5.82, 0],
  ];
  const dialGeos: THREE.BufferGeometry[] = [];
  for (const [ox, oz, ry] of dialFaces) {
    const isZ = Math.abs(oz) > Math.abs(ox);
    b.stat.push({
      p: [tx + ox * 0.99, 33.6, tz + oz * 0.99],
      s: isZ ? [5.4, 5.4, 0.25] : [0.25, 5.4, 5.4],
      c: PAL.bronzePortal,
    });
    if (night) {
      b.glow.push({
        p: [tx + ox * 1.005, 33.6, tz + oz * 1.005],
        s: [5.04, 0.08, 5.04],
        c: 0xffe4a8,
        cyl: true,
        seg: 12,
        rx: isZ ? Math.PI / 2 : 0,
        rz: isZ ? 0 : Math.PI / 2,
        noAO: true,
      });
    }
    const g = new THREE.CircleGeometry(2.45, 20);
    g.rotateY(ry);
    g.translate(tx + ox * 1.02, 33.6, tz + oz * 1.02);
    dialGeos.push(g);
  }

  let clockMap: THREE.Texture | null = null;
  if (typeof document !== 'undefined') {
    clockMap = textTexture(256, 256, g => {
      g.clearRect(0, 0, 256, 256);
      g.fillStyle = night ? '#fff3cf' : '#ebe4d2';
      g.beginPath();
      g.arc(128, 128, 124, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#3b3124';
      g.lineWidth = 10;
      g.beginPath();
      g.arc(128, 128, 118, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = '#9e7b38';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(128, 128, 102, 0, Math.PI * 2);
      g.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        g.strokeStyle = '#1b1815';
        g.lineWidth = i % 3 === 0 ? 6 : 3.5;
        g.beginPath();
        g.moveTo(128 + Math.cos(a) * 86, 128 + Math.sin(a) * 86);
        g.lineTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100);
        g.stroke();
      }
      // Clock hands (10:10 iconic pose)
      g.strokeStyle = '#141210';
      g.lineCap = 'round';
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(128, 128);
      g.lineTo(128 - 44, 128 - 32);
      g.stroke();
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(128, 128);
      g.lineTo(128 + 68, 128 - 40);
      g.stroke();
      g.fillStyle = '#3b3124';
      g.beginPath();
      g.arc(128, 128, 8, 0, Math.PI * 2);
      g.fill();
    });
  }
  const mergedDials = mergeGeometries(dialGeos)!;
  b.extras.push(
    new THREE.Mesh(
      mergedDials,
      night
        ? new THREE.MeshBasicMaterial({ map: clockMap, color: 0xffffff, fog: true })
        : new THREE.MeshLambertMaterial({ map: clockMap, color: 0xffffff }),
    ),
  );

  return b;
}

/** 6. 勞動人民文化宮 / 太廟 (East x=112) & 中山公園 (West x=-112) gatehouses, continuation red walls, & corner turrets (x=±135). */
export function parkGates(): SouthSkylineBundle {
  const b = emptyBundle();
  const wz = -18;

  for (const sx of [-1, 1]) {
    // Continuation red walls flush from Tiananmen flank pier (|x|=99.6..104.5) and past gatehouse (119.5..152)
    const wallSpans: [number, number][] = [
      [102.05, 4.9],
      [135.75, 32.5],
    ];
    for (const [ox, len] of wallSpans) {
      const wx = sx * ox;
      b.stat.push({ p: [wx, 0.35, wz], s: [len, 0.7, 2.4], c: PAL.stonePlinth, tex: 'ashlarStone' });
      b.flood.push(
        { p: [wx, 3.25, wz], s: [len, 5.1, 2.0], c: PAL.imperialRed, tex: 'palaceWall' },
        { p: [wx, 6.08, wz], s: [2.5, 0.65, len + 0.3], c: PAL.goldTile, prism: true, ry: Math.PI / 2, tex: 'roofTile' },
      );
    }

    // Side Gatehouse (琉璃門樓) at (sx * 112, -18)
    const gx = sx * 112;
    b.stat.push(
      { p: [gx, 0.35, wz], s: [15.8, 0.7, 6.4], c: PAL.stonePlinth, tex: 'ashlarStone' },
      { p: [gx, 3.2, wz], s: [14.8, 5.0, 5.0], c: PAL.palaceRed, tex: 'palaceWall' },
      { p: [gx, 6.2, wz], s: [15.2, 0.9, 5.4], c: PAL.greenFrieze },
    );
    for (const px of [-3.6, 0, 3.6]) {
      b.stat.push(
        { p: [gx + px, 2.4, wz - 2.52], s: [2.2, 3.8, 0.2], c: PAL.archDark },
        { p: [gx + px, 2.3, wz - 2.38], s: [1.9, 3.5, 0.14], c: PAL.gateRed },
      );
    }
    addXieshanRoof(b.flood, gx, 6.65, wz, 18.0, 4.6, 8.4, PAL.goldTile, PAL.greenFrieze, PAL.goldRidge);
    b.glow.push(
      { p: [gx - 5.4, 5.0, wz - 2.9], s: [0.65, 0.85, 0.65], c: 0xe0402a, noAO: true },
      { p: [gx + 5.4, 5.0, wz - 2.9], s: [0.65, 0.85, 0.65], c: 0xe0402a, noAO: true },
    );

    // Imperial Corner Turret Pavilion (角亭) at (sx * 135, -18)
    const tx = sx * 135;
    b.flood.push(
      { p: [tx, 3.2, wz], s: [8.4, 6.4, 8.4], c: PAL.imperialRed, tex: 'palaceWall' },
      { p: [tx, 7.8, wz], s: [6.4, 2.8, 6.4], c: PAL.palaceRed, tex: 'palaceWall' },
      { p: [tx, 9.8, wz], s: [8.6, 2.0, 8.6], c: PAL.goldTile, roof: true, tex: 'roofTile' },
      { p: [tx, 12.1, wz], s: [6.4, 2.6, 6.4], c: PAL.goldTile, roof: true, tex: 'roofTile' },
      { p: [tx, 13.6, wz], s: [0.42, 0.8, 0.42], c: PAL.goldRidge },
    );
    b.stat.push(
      { p: [tx, 0.35, wz], s: [8.8, 0.7, 8.8], c: PAL.stonePlinth, tex: 'ashlarStone' },
      { p: [tx, 9.0, wz], s: [7.0, 0.65, 7.0], c: PAL.greenFrieze },
    );
  }

  return b;
}

/** 7. Square pine perimeter beds, 1989 north corner subway canopies, southern ground apron, & distant Chang'an/Qianmen skyline. */
function squarePerimeterAndHorizon(night: boolean): SouthSkylineBundle {
  const b = emptyBundle();

  // Southern plaza & East/West Chang'an flank ground aprons (grounded under Mausoleum, Zhengyangmen, Qianmen, & ministry blocks)
  b.stat.push(
    { p: [0, -0.06, -535], s: [720, 0.1, 210], c: 0x484642 },
    { p: [0, -0.02, -447], s: [160, 0.04, 102], c: 0x757065 },
    { p: [0, -0.01, -529], s: [700, 0.05, 54], c: 0x28292e },
    { p: [-225, -0.06, -127.5], s: [270, 0.1, 75], c: 0x54514a },
    { p: [225, -0.06, -127.5], s: [270, 0.1, 75], c: 0x54514a },
  );

  // Evergreen pine border beds & granite curb coping along outer East/West Square edges (x = ±88.8, leaving Great Hall crossing open)
  const hedgeRuns: [number, number][] = [
    [-146, -114],
    [-186, -154],
    [-226, -194],
    [-266, -234],
    [-392, -370],
    [-422, -398],
  ];
  for (const sx of [-1, 1]) {
    const px = sx * 88.8;
    for (const [z0, z1] of hedgeRuns) {
      const len = z1 - z0;
      const cz = (z0 + z1) * 0.5;
      b.stat.push(
        { p: [px, 0.22, cz], s: [2.4, 0.44, len], c: PAL.graniteCurb },
        { p: [px, 0.82, cz], s: [1.8, 0.86, len - 0.8], c: PAL.pineMid },
      );
      for (const tz of [z0 + 5.5, z1 - 5.5]) {
        b.stat.push(
          { p: [px, 1.4, tz], s: [0.28, 1.0, 0.28], c: 0x3b2d20, cyl: true, seg: 6 },
          { p: [px, 2.5, tz], s: [1.8, 1.9, 1.8], c: PAL.pineDark, cyl: true, seg: 6, top: 0.25 },
          { p: [px, 3.6, tz], s: [1.2, 1.5, 1.2], c: PAL.pineMid, cyl: true, seg: 6, top: 0.15 },
        );
      }
    }
  }

  // Subtle 1989 Square North corner subway / underpass canopy pavilions at (x = ±78, z = -94)
  for (const sx of [-1, 1]) {
    const ux = sx * 78;
    const uz = -94;
    b.stat.push(
      { p: [ux, 0.55, uz], s: [7.2, 1.1, 4.6], c: PAL.terrazzo },
      { p: [ux, 0.72, uz - 0.4], s: [5.4, 1.0, 3.2], c: 0x16181c },
      { p: [ux, 3.15, uz], s: [7.8, 0.42, 5.2], c: 0xc8c2b6 },
      { p: [ux, 2.98, uz], s: [7.6, 0.28, 5.0], c: PAL.metroGreen },
    );
    for (const px of [-3.1, 3.1]) {
      for (const pz of [-1.9, 1.9]) {
        b.stat.push({ p: [ux + px, 1.95, uz + pz], s: [0.20, 1.8, 0.20], c: PAL.metroGreen });
      }
    }
    if (night) {
      b.glow.push({ p: [ux, 2.75, uz], s: [4.2, 0.14, 1.4], c: 0xffe4aa, noAO: true });
    }
  }

  // Distant East/West Chang'an Avenue ministry & urban skyline slabs (south side z = -102..-115 & north outer flanks)
  const changAnBlocks: [number, number, number, number, number, number][] = [
    [-212, -106, 36, 26, 20, PAL.skylineCream],
    [-264, -108, 46, 31, 22, PAL.skylineGrey],
    [-318, -105, 42, 24, 20, PAL.skylineCream],
    [212, -106, 38, 28, 20, PAL.skylineCream],
    [266, -108, 48, 33, 22, PAL.skylineGrey],
    [320, -105, 40, 25, 20, PAL.skylineCream],
    [-306, -22, 46, 22, 20, PAL.skylineGrey],
    [304, -22, 44, 29, 20, PAL.skylineCream],
  ];
  for (const [bx, bz, bw, bh, bd, col] of changAnBlocks) {
    b.stat.push(
      { p: [bx, bh * 0.5, bz], s: [bw, bh, bd], c: col, tex: 'plaster' },
      { p: [bx, bh + 0.35, bz], s: [bw + 0.8, 0.7, bd + 0.8], c: 0x9b9588, tex: 'ashlarStone' },
      { p: [bx, bh + 1.4, bz], s: [bw * 0.55, 2.2, bd * 0.55], c: 0x87837a, tex: 'plaster' },
    );
    if (night) {
      b.glow.push(
        { p: [bx - bw * 0.2, bh * 0.65, bz + (bz < -60 ? bd * 0.51 : -bd * 0.51)], s: [6.5, 1.4, 0.15], c: 0xffcf7a, noAO: true },
        { p: [bx + bw * 0.18, bh * 0.42, bz + (bz < -60 ? bd * 0.51 : -bd * 0.51)], s: [5.0, 1.4, 0.15], c: 0xffbe64, noAO: true },
      );
    }
  }

  // Far South Qianmen / Dashilar historic courtyard & 1980s city horizon silhouettes (z = -590..-630)
  const southBlocks: [number, number, number, number, number, boolean][] = [
    [-95, -594, 48, 10, 20, true],
    [-162, -596, 56, 12, 22, true],
    [95, -594, 48, 10, 20, true],
    [162, -596, 56, 12, 22, true],
    [-145, -626, 44, 30, 22, false],
    [145, -626, 46, 34, 22, false],
    [0, -630, 74, 24, 22, false],
  ];
  for (const [sx, sz, sw, sh, sd, pitched] of southBlocks) {
    b.stat.push({ p: [sx, sh * 0.5, sz], s: [sw, sh, sd], c: pitched ? PAL.skylineBrick : PAL.skylineGrey, tex: pitched ? 'qingBrick' : 'plaster' });
    if (pitched) {
      b.stat.push({ p: [sx, sh + 2.2, sz], s: [sd, 4.4, sw], c: PAL.greyTile, prism: true, ry: Math.PI / 2, tex: 'roofTile' });
    } else if (night) {
      b.glow.push({ p: [sx, sh * 0.62, sz + sd * 0.51], s: [12, 1.5, 0.15], c: 0xffc86b, noAO: true });
    }
  }

  return b;
}

/** Combined 1989 Beijing & Tiananmen Southern Axis / Chang'an Avenue skyline bundle (strictly <= 14k triangles). */
export function buildTiananmenSouthAndSkyline(mode: 'night' | 'dawn' | 'camp' | 'statue'): SouthSkylineBundle {
  const night = mode === 'night' || mode === 'statue';
  const out = emptyBundle();
  appendBundle(out, flagpolePlatform());
  appendBundle(out, maoMausoleum(night));
  appendBundle(out, zhengyangmen());
  appendBundle(out, qianmenArrowTower());
  appendBundle(out, beijingHotel(night));
  appendBundle(out, telegraphBuilding(night));
  appendBundle(out, parkGates());
  appendBundle(out, squarePerimeterAndHorizon(night));
  return out;
}
