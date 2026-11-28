import type { Part } from './kit';
import { place } from './kit';

const IMP = {
  red: 0x8e2b22,
  redDark: 0x6b1d17,
  gate: 0x5c1712,
  archShadow: 0x160e0c,
  yellowTile: 0xd4a028,
  ridgeGold: 0xe2b842,
  gold: 0xc8a040,
  marble: 0xdedad0,
  marbleBright: 0xe8e4da,
  marbleWarm: 0xd2cdc0,
  stone: 0x9b9588,
  stoneDark: 0x7a7569,
  beamGreen: 0x245e54,
  beamBlue: 0x24426e,
  woodDark: 0x3b2a1c,
  water: 0x13191e,
  pineDark: 0x1d341f,
  pineMid: 0x274226,
  graniteLight: 0xcbc6b8,
  graniteMid: 0xb6b0a2,
  graniteDark: 0x989284,
  hallWall: 0xbcae8f,
  museumWall: 0xb7a98a,
  hallCol: 0xe3dac2,
  hallTrim: 0xd49b28,
  hallGreen: 0x246248,
  glass: 0x232d35,
  bronze: 0x5a4c38,
  iron: 0x44453d,
  globeCenter: 0xfff3d4,
  globeOuter: 0xffeec4,
  crimson: 0xb81f18,
};

/** Helper: add an axis-aligned white marble balustrade run with rail panels, handrail, and spaced lotus posts (望柱). */
function balustradeRun(
  p: Part[],
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  step: number,
  railCol: number,
  postCol: number,
  postH = 1.05,
  capCol = 0xeeeae0,
) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (len < 0.2) return;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const alongX = Math.abs(dx) >= Math.abs(dz);
  const sx = alongX ? len : 0.20;
  const sz = alongX ? 0.20 : len;

  // Lower stone sill, carved middle panel, lotus relief strip, and top handrail
  p.push(
    { p: [cx, y + 0.12, cz], s: [sx, 0.16, sz], c: railCol },
    { p: [cx, y + 0.44, cz], s: [alongX ? len : 0.12, 0.38, alongX ? 0.12 : len], c: postCol },
    { p: [cx, y + 0.46, cz], s: [alongX ? len * 0.96 : 0.15, 0.14, alongX ? 0.15 : len * 0.96], c: IMP.marbleWarm },
    { p: [cx, y + 0.72, cz], s: [sx, 0.14, sz], c: railCol },
  );

  const count = Math.max(1, Math.round(len / step));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const px = x0 + dx * t;
    const pz = z0 + dz * t;
    p.push(
      { p: [px, y + postH * 0.5, pz], s: [0.30, postH, 0.30], c: postCol },
      { p: [px, y + postH + 0.02, pz], s: [0.34, 0.07, 0.34], c: IMP.marbleWarm },
      { p: [px, y + postH + 0.13, pz], s: [0.24, 0.22, 0.24], c: capCol, roof: true },
    );
  }
}

/** Sculpted imperial marble guardian stone lion (石獅子) facing -Z toward Tiananmen Square. */
export function stoneLion(x: number, z: number, facingSign = -1): Part[] {
  const m = IMP.marbleBright;
  const mw = IMP.marbleWarm;
  const dark = IMP.stoneDark;
  const d = facingSign;
  return [
    // Stepped Sumeru pedestal
    { p: [x, 0.28, z], s: [1.9, 0.56, 2.3], c: dark, tex: 'ashlarStone' },
    { p: [x, 0.70, z], s: [1.55, 0.28, 1.95], c: mw, tex: 'ashlarStone' },
    { p: [x, 0.96, z], s: [1.72, 0.24, 2.12], c: m, tex: 'ashlarStone' },
    // Seated lion haunches & broad lion chest
    { p: [x, 1.42, z - d * 0.28], s: [0.96, 0.72, 0.96], c: m, sphere: true, detail: 1 },
    { p: [x, 1.72, z + d * 0.18], s: [0.92, 0.86, 0.92], c: m, sphere: true, detail: 1 },
    // Forelegs planted firmly & paws with carved stone sphere
    { p: [x - 0.34, 1.38, z + d * 0.52], s: [0.24, 0.62, 0.26], c: m, cyl: true, seg: 6 },
    { p: [x + 0.34, 1.38, z + d * 0.52], s: [0.24, 0.62, 0.26], c: m, cyl: true, seg: 6 },
    { p: [x + 0.28, 1.24, z + d * 0.68], s: [0.34, 0.34, 0.34], c: mw, sphere: true, detail: 0 },
    // Sculpted mane collar, head, muzzle, brow & ears
    { p: [x, 2.18, z + d * 0.34], s: [0.84, 0.78, 0.76], c: mw, sphere: true, detail: 1 },
    { p: [x, 2.36, z + d * 0.44], s: [0.68, 0.62, 0.68], c: m, sphere: true, detail: 1 },
    { p: [x, 2.26, z + d * 0.74], s: [0.42, 0.28, 0.30], c: mw, bevel: true },
    { p: [x - 0.26, 2.60, z + d * 0.38], s: [0.16, 0.20, 0.14], c: mw },
    { p: [x + 0.26, 2.60, z + d * 0.38], s: [0.16, 0.20, 0.14], c: mw },
    // Upright curled tail along back
    { p: [x, 1.56, z - d * 0.74], s: [0.20, 0.56, 0.22], c: mw, rx: d * 0.35 },
  ];
}

/** Curved Chinese imperial hip roof (廡殿頂) with multi-layer flying rafters, main ridge finials, hip ridges, and 5 corner roof beasts. */
export function imperialRoof(
  y: number,
  w: number,
  d: number,
  h: number,
  c: number,
  z = 0,
  ridgeCol = 0xc8a040,
): Part[] {
  const W = w + 1.2;
  const D = d + 1.2;
  const ridgeHalf = 0.24 * W;
  const yBase = y + 0.36;
  const yTop = yBase + h;

  const p: Part[] = [
    // Multi-layer eave under-boarding (椽子 & 飛椽) inset so upturned corners flare cleanly
    { p: [0, y + 0.12, z], s: [w - 0.6, 0.24, d - 0.6], c: IMP.beamGreen },
    { p: [0, y + 0.29, z], s: [w + 0.3, 0.16, d + 0.3], c: IMP.woodDark },
    { p: [0, y + 0.37, z], s: [w + 0.65, 0.10, d + 0.65], c, tex: 'roofTile' },
    // Main curved catenary roof slope with upturned corners
    { p: [0, yBase + h / 2, z], s: [W, h, D], c, eave: true, curve: 0.18, tex: 'roofTile' },
    // Golden main ridge beam (正脊) + upper crest molding
    { p: [0, yTop + 0.14, z], s: [ridgeHalf * 2 + 0.35, 0.32, 0.38], c: ridgeCol },
    { p: [0, yTop + 0.34, z], s: [ridgeHalf * 2 + 0.10, 0.12, 0.24], c: IMP.gold },
  ];

  // Dragon-mouth finials (正吻) clamping both ends of the main ridge
  for (const sx of [-1, 1]) {
    const rx = sx * (ridgeHalf + 0.05);
    p.push(
      { p: [rx, yTop + 0.34, z], s: [0.54, 0.62, 0.44], c: ridgeCol },
      { p: [rx + sx * 0.16, yTop + 0.72, z], s: [0.30, 0.46, 0.32], c: ridgeCol, rz: -sx * 0.34 },
      { p: [rx - sx * 0.26, yTop + 0.56, z], s: [0.24, 0.24, 0.34], c: IMP.gold },
    );
  }

  // 4 diagonal hip ridges (垂脊) following the exact makeEave catenary curve + 5 imperial corner roof beasts (仙人走獸)
  const curve = 0.18;
  const hipPt = (sx: number, sz: number, u: number): [number, number, number] => {
    const ax = 0.24 + 0.26 * u;
    const az = 0.5 * u;
    const sag = curve * 4 * u * (1 - u);
    const cf = ax > 0.35 && az > 0.35 ? ((ax - 0.35) / 0.15) * ((az - 0.35) / 0.15) : 0;
    const yn = 1.0 - u - sag + 0.14 * cf;
    return [sx * ax * W, yBase + yn * h + 0.08, z + sz * az * D];
  };

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pts = [0, 0.44, 0.78, 1.0].map(u => hipPt(sx, sz, u));
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        const horiz = Math.hypot(dx, dz);
        const segLen = Math.hypot(horiz, dy) + 0.16;
        p.push({
          p: [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5],
          s: [segLen, 0.22, 0.26],
          c: ridgeCol,
          rz: Math.atan2(dy, horiz),
          ry: Math.atan2(-dz, dx),
        });
      }

      // 5 imperial corner roof beasts stepping inward along the upturned corner wing
      const c0 = pts[3];
      const c1 = pts[2];
      const dHoriz = Math.hypot(c1[0] - c0[0], c1[2] - c0[2]);
      const ux = (c1[0] - c0[0]) / dHoriz;
      const uz = (c1[2] - c0[2]) / dHoriz;
      const beastRy = Math.atan2(-uz, ux);

      for (let k = 0; k < 5; k++) {
        const dist = 0.42 + k * 0.50;
        const uApprox = Math.max(0.72, 1.0 - dist / (dHoriz / 0.22));
        const bp = hipPt(sx, sz, uApprox);
        p.push({
          p: [bp[0], bp[1] + 0.20 + k * 0.015, bp[2]],
          s: [0.22, 0.24 + k * 0.03, 0.20],
          c: k === 0 ? 0xf0c954 : ridgeCol,
          ry: beastRy,
        });
      }
    }
  }

  return p;
}

/** One semi-circular vaulted archway on Tiananmen's south facade with crimson gates, studs, jambs, and marble torus arch ring. */
function archway(x: number, w: number, h: number): Part[] {
  const r = w / 2;
  const springY = h - r;
  const zFace = -18.42;
  const p: Part[] = [
    // Deep recessed vault shadow (rectangular jamb throat + semicircular upper vault)
    { p: [x, springY * 0.5, zFace + 0.14], s: [w, springY, 0.44], c: IMP.archShadow },
    { p: [x, springY, zFace + 0.14], s: [w, 0.44, w], c: IMP.archShadow, cyl: true, rx: Math.PI / 2, seg: 12 },
    // Crimson double palace gates set deep inside the vault
    { p: [x - w * 0.23, springY * 0.49, zFace + 0.24], s: [w * 0.44, springY * 0.94, 0.14], c: IMP.gate },
    { p: [x + w * 0.23, springY * 0.49, zFace + 0.24], s: [w * 0.44, springY * 0.94, 0.14], c: IMP.gate },
    { p: [x, springY * 0.49, zFace + 0.20], s: [0.12, springY * 0.94, 0.16], c: IMP.gold },
    { p: [x, springY * 0.94, zFace + 0.20], s: [w * 0.96, 0.18, 0.18], c: IMP.redDark },
  ];

  // Golden door studs (門釘) on both gate leaves (3x3 grid per leaf)
  for (const leaf of [-1, 1]) {
    const lx = x + leaf * w * 0.23;
    for (let row = 0; row < 3; row++) {
      const sy = springY * (0.34 + row * 0.22);
      for (let col = -1; col <= 1; col++) {
        p.push({
          p: [lx + col * (w * 0.11), sy, zFace + 0.16],
          s: [0.10, 0.10, 0.07],
          c: IMP.ridgeGold,
        });
      }
    }
  }

  // Carved stone lower jambs, impost blocks, and marble gate threshold step
  p.push({ p: [x, 0.09, zFace - 0.04], s: [w + 0.9, 0.18, 0.56], c: IMP.marbleWarm, tex: 'ashlarStone' });
  for (const sx of [-1, 1]) {
    p.push(
      { p: [x + sx * (r + 0.22), springY * 0.5, zFace], s: [0.44, springY, 0.36], c: IMP.marble, tex: 'ashlarStone' },
      { p: [x + sx * (r + 0.25), springY, zFace - 0.02], s: [0.58, 0.24, 0.42], c: IMP.marbleBright },
    );
  }

  // True semi-circular arch ring (white marble outer arch + amber inner molding + keystone)
  p.push(
    {
      p: [x, springY, zFace - 0.02],
      s: [w + 0.38, w + 0.38, 1.8],
      c: IMP.marbleBright,
      torus: true,
      arc: Math.PI,
      tube: 0.082,
      seg: 12,
      detail: 5,
    },
    {
      p: [x, springY, zFace - 0.04],
      s: [w + 0.08, w + 0.08, 1.5],
      c: IMP.gold,
      torus: true,
      arc: Math.PI,
      tube: 0.04,
      seg: 10,
      detail: 4,
    },
    { p: [x, h + 0.24, zFace - 0.05], s: [0.44, 0.54, 0.34], c: IMP.marble },
  );

  return p;
}

/** Multi-tiered 和璽彩畫 painted beams and 2-tier 斗拱 bracket clusters around an imperial palace story. */
function eaveBrackets(
  p: Part[],
  yBeam: number,
  w: number,
  d: number,
  step: number,
) {
  // Emerald, ultramarine, and gold Hexi painted architrave bands
  p.push(
    { p: [0, yBeam - 0.32, 0], s: [w, 0.42, d], c: IMP.beamGreen },
    { p: [0, yBeam, 0], s: [w + 0.5, 0.28, d + 0.5], c: IMP.beamBlue },
    { p: [0, yBeam + 0.22, 0], s: [w + 0.9, 0.18, d + 0.9], c: IMP.gold },
  );

  const halfW = w / 2;
  const halfD = d / 2;
  for (let x = -halfW + 1.2; x <= halfW - 1.1; x += step) {
    for (const sz of [-1, 1]) {
      const z0 = sz * (halfD + 0.22);
      p.push(
        { p: [x, yBeam - 0.02, z0], s: [0.48, 0.22, 0.44], c: IMP.beamGreen },
        { p: [x, yBeam + 0.22, z0 + sz * 0.22], s: [0.62, 0.22, 0.64], c: IMP.gold },
      );
    }
  }
  for (let z = -halfD + 2.0; z <= halfD - 1.9; z += step * 1.35) {
    for (const sx of [-1, 1]) {
      const x0 = sx * (halfW + 0.22);
      p.push(
        { p: [x0, yBeam - 0.02, z], s: [0.44, 0.22, 0.48], c: IMP.beamGreen },
        { p: [x0 + sx * 0.22, yBeam + 0.22, z], s: [0.64, 0.22, 0.62], c: IMP.gold },
      );
    }
  }
}

/** One arched Golden Water Bridge (金水橋) centered at (0, 0, -27) with cambered deck, stone arch ring, and lotus balustrades. */
function goldenWaterBridge(bw: number): Part[] {
  const zc = -27;
  const p: Part[] = [
    // 3 sloped stone deck segments forming a graceful cambered arch profile (y = 0.36 at banks -> 1.18 at crown)
    { p: [0, 0.62, zc + 3.0], s: [bw, 0.30, 3.3], c: IMP.marble, rx: 0.25 },
    { p: [0, 1.02, zc], s: [bw, 0.32, 3.1], c: IMP.marbleBright },
    { p: [0, 0.62, zc - 3.0], s: [bw, 0.30, 3.3], c: IMP.marble, rx: -0.25 },
    // Dark arched shadow beneath the bridge span
    { p: [0, 0.14, zc], s: [bw - 0.35, 0.65, 5.4], c: 0x0e1216 },
  ];

  const halfB = bw / 2 - 0.16;
  for (const sx of [-1, 1]) {
    const bx = sx * halfB;
    // Carved stone arch ring along both outer bridge flanks
    p.push({
      p: [bx, 0.02, zc],
      s: [6.5, 2.0, 1.6],
      c: IMP.marbleBright,
      torus: true,
      arc: Math.PI,
      tube: 0.06,
      seg: 10,
      detail: 4,
      ry: Math.PI / 2,
    });

    // Cambered marble side railings + 5 lotus-capped posts (望柱) per flank
    p.push(
      { p: [bx, 1.12, zc + 2.95], s: [0.16, 0.68, 3.1], c: IMP.marble, rx: 0.25 },
      { p: [bx, 1.52, zc], s: [0.16, 0.68, 3.0], c: IMP.marbleBright },
      { p: [bx, 1.12, zc - 2.95], s: [0.16, 0.68, 3.1], c: IMP.marble, rx: -0.25 },
    );

    const posts: [number, number][] = [
      [zc + 4.35, 0.44],
      [zc + 2.20, 0.98],
      [zc, 1.16],
      [zc - 2.20, 0.98],
      [zc - 4.35, 0.44],
    ];
    for (const [pz, py] of posts) {
      p.push(
        { p: [bx, py + 0.48, pz], s: [0.24, 0.96, 0.24], c: IMP.marbleBright },
        { p: [bx, py + 1.04, pz], s: [0.20, 0.16, 0.20], c: 0xeeeae0, roof: true },
      );
    }
  }

  return p;
}

/** One ornate white marble Huabiao (華表) at origin (placed at x = ±22, z = -34). */
export function huabiao(): Part[] {
  const m = IMP.marbleBright;
  const mw = IMP.marbleWarm;
  const p: Part[] = [
    // Octagonal Sumeru base (須彌座)
    { p: [0, 0.20, 0], s: [2.8, 0.40, 2.8], c: mw, cyl: true, seg: 8 },
    { p: [0, 0.58, 0], s: [2.3, 0.36, 2.3], c: IMP.stone, cyl: true, seg: 8 },
    { p: [0, 0.92, 0], s: [2.7, 0.32, 2.7], c: m, cyl: true, seg: 8 },
    { p: [0, 1.24, 0], s: [1.55, 0.32, 1.55], c: mw, cyl: true, seg: 8 },
    // Fluted tapered marble column (y = 1.4..10.6)
    { p: [0, 6.0, 0], s: [1.06, 9.2, 1.06], c: m, cyl: true, seg: 12, top: 0.86 },
  ];

  // Square 4-sided white marble balustrade enclosing the Sumeru base + 4 corner guardian finials
  const br = 2.05;
  balustradeRun(p, -br, -br, br, -br, 0.08, 2.05, IMP.marble, m, 0.92);
  balustradeRun(p, -br, br, br, br, 0.08, 2.05, IMP.marble, m, 0.92);
  balustradeRun(p, -br, -br + 0.3, -br, br - 0.3, 0.08, 1.8, IMP.marble, m, 0.92);
  balustradeRun(p, br, -br + 0.3, br, br - 0.3, 0.08, 1.8, IMP.marble, m, 0.92);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      p.push({ p: [sx * br, 1.24, sz * br], s: [0.24, 0.28, 0.26], c: mw, rx: sz * 0.15 });
    }
  }

  // Spiraling carved dragon relief (盤龍) ascending around the shaft (8 spiraling segments)
  for (let i = 0; i < 8; i++) {
    const ang = i * 1.15;
    const yy = 2.0 + i * 0.92;
    const rad = 0.52 - i * 0.008;
    p.push({
      p: [Math.cos(ang) * rad, yy, Math.sin(ang) * rad],
      s: [0.24, 0.22, 0.56],
      c: mw,
      ry: -ang,
      rx: -0.45,
    });
  }
  // Carved dragon head & flaming pearl near top of spiral
  p.push(
    { p: [0.58, 8.95, -0.22], s: [0.36, 0.34, 0.44], c: m, ry: 0.4 },
    { p: [0.46, 9.22, -0.45], s: [0.22, 0.22, 0.22], c: 0xeeeae0, sphere: true, detail: 0 },
  );

  // Carved marble cloud wings (雲板) piercing the upper shaft at y = 9.5 with scrolled S-curve lobes
  p.push(
    { p: [0, 9.5, 0], s: [1.14, 0.32, 1.14], c: mw, cyl: true, seg: 8 },
    { p: [0, 9.5, 0], s: [3.35, 0.40, 0.20], c: m },
  );
  for (const sx of [-1, 1]) {
    p.push(
      { p: [sx * 1.08, 9.74, 0], s: [0.68, 0.26, 0.22], c: mw, rz: sx * 0.28 },
      { p: [sx * 1.56, 9.56, 0], s: [0.52, 0.54, 0.24], c: m, cyl: true, rx: Math.PI / 2, seg: 6 },
      { p: [sx * 1.92, 9.78, 0], s: [0.38, 0.34, 0.20], c: mw, rz: -sx * 0.35 },
      { p: [sx * 1.18, 9.24, 0], s: [0.58, 0.26, 0.22], c: mw, rz: -sx * 0.24 },
      { p: [sx * 1.68, 9.30, 0], s: [0.36, 0.32, 0.20], c: m, rz: sx * 0.32 },
    );
  }

  // Circular lotus dew-dish (承露盤) at y = 10.7
  p.push(
    { p: [0, 10.65, 0], s: [1.35, 0.36, 1.35], c: mw, cyl: true, seg: 10, top: 1.38 },
    { p: [0, 10.88, 0], s: [1.85, 0.16, 1.85], c: m, cyl: true, seg: 10 },
  );

  // Sculpted crouching 望天吼 beast on top (y = 11.0..12.25) with haunches, arched spine, mane, skyward snout & tail
  p.push(
    { p: [0, 11.16, 0.24], s: [0.58, 0.42, 0.54], c: m },
    { p: [0, 11.38, 0.02], s: [0.52, 0.54, 0.56], c: m, rx: 0.14 },
    { p: [0, 11.58, -0.22], s: [0.48, 0.62, 0.42], c: m, rx: -0.22 },
    { p: [0, 11.82, -0.10], s: [0.54, 0.36, 0.38], c: mw, rx: -0.18 },
    { p: [-0.18, 11.20, -0.32], s: [0.16, 0.52, 0.18], c: mw },
    { p: [0.18, 11.20, -0.32], s: [0.16, 0.52, 0.18], c: mw },
    { p: [0, 11.98, -0.28], s: [0.42, 0.40, 0.44], c: m, rx: -0.38 },
    { p: [0, 12.14, -0.45], s: [0.24, 0.22, 0.30], c: mw, rx: -0.58 },
    { p: [-0.15, 12.20, -0.20], s: [0.10, 0.18, 0.12], c: m },
    { p: [0.15, 12.20, -0.20], s: [0.10, 0.18, 0.12], c: m },
    { p: [0, 11.46, 0.50], s: [0.16, 0.50, 0.18], c: mw, rx: 0.48 },
  );

  return p;
}

/** 天安門城樓: battered red fortress podium, 5 vaulted archways, terraced viewing stands & banners, 9-bay double-eave hall, Golden Water Bridges, and twin Huabiao. */
export function tiananmen(includeHeroProps = true): Part[] {
  const p: Part[] = [
    // Battered Red Fortress Podium (城台): Sumeru granite plinth, lower/upper battered walls, frieze, marble + glazed coping
    { p: [0, 0.60, 0], s: [67.4, 1.2, 37.8], c: IMP.stone, tex: 'ashlarStone' },
    { p: [0, 1.24, -19.0], s: [67.8, 0.18, 0.34], c: IMP.marbleBright, tex: 'ashlarStone' },
    { p: [0, 0.22, -19.04], s: [68.0, 0.32, 0.40], c: IMP.stoneDark, tex: 'ashlarStone' },
    { p: [0, 3.90, 0], s: [66.4, 5.4, 37.0], c: IMP.red, tex: 'palaceWall' },
    { p: [0, 9.80, 0], s: [65.4, 6.4, 36.4], c: IMP.red, tex: 'palaceWall' },
    { p: [0, 12.65, 0], s: [65.8, 0.50, 36.6], c: IMP.redDark, tex: 'palaceWall' },
    { p: [0, 13.14, 0], s: [66.2, 0.28, 36.7], c: 0xc2902e },
    { p: [0, 13.44, 0], s: [66.6, 0.32, 36.8], c: IMP.marble, tex: 'ashlarStone' },
    { p: [0, 13.80, 0], s: [62.0, 0.40, 33.0], c: IMP.stoneDark, tex: 'ashlarStone' },
  ];

  // Subtle corner stone quoins & bay pier pilasters between the 5 Tiananmen archways
  for (const qx of [-33.25, -29.2, -17.5, -6.0, 6.0, 17.5, 29.2, 33.25]) {
    p.push({ p: [qx, 0.64, -18.92], s: [Math.abs(qx) > 31 ? 0.95 : 0.72, 1.24, 0.22], c: IMP.stoneDark, tex: 'ashlarStone' });
  }

  // Flanking red palace perimeter walls (z = 4) + stepped red flank bridge walls (x = ±76..±98) meeting side park walls
  for (const sx of [-1, 1]) {
    p.push(
      { p: [sx * 120, 5.0, 4], s: [174, 10.0, 6.0], c: IMP.red, tex: 'palaceWall' },
      { p: [sx * 120, 10.3, 4], s: [176, 0.7, 7.0], c: IMP.yellowTile, tex: 'roofTile' },
      // Stepped red flank masonry bridge (x = ±76..±98) bridging Reviewing Stands to outer park walls
      { p: [sx * 87.5, 0.35, -8.0], s: [23.0, 0.70, 13.0], c: IMP.stone, tex: 'ashlarStone' },
      { p: [sx * 87.5, 3.60, -7.5], s: [22.4, 5.80, 12.0], c: IMP.red, tex: 'palaceWall' },
      { p: [sx * 87.5, 6.72, -7.5], s: [22.8, 0.48, 12.2], c: IMP.redDark, tex: 'palaceWall' },
      { p: [sx * 87.5, 7.12, -7.5], s: [23.0, 0.30, 12.5], c: IMP.beamGreen },
      { p: [sx * 87.5, 7.45, -7.5], s: [23.4, 0.44, 12.9], c: IMP.yellowTile, tex: 'roofTile' },
      { p: [sx * 97.0, 4.00, -14.2], s: [5.6, 8.0, 7.4], c: IMP.red, tex: 'palaceWall' },
      { p: [sx * 97.0, 8.20, -14.2], s: [6.2, 0.46, 8.0], c: IMP.yellowTile, tex: 'roofTile' },
    );
  }

  // 5 true semi-circular vaulted archways on the south facade
  const arches: [number, number, number][] = [
    [0, 5.2, 9.0],
    [-12, 4.2, 7.6],
    [12, 4.2, 7.6],
    [-23, 3.6, 6.4],
    [23, 3.6, 6.4],
  ];
  for (const [ax, aw, ah] of arches) p.push(...archway(ax, aw, ah));

  // Flanking Red Reviewing Stands (東西紅觀禮台, x = ±35.5..±78.0, z = -20..0) with terraced masonry steps, balustrade cresting & ceremonial banners
  const addBannerMast = (mx: number, my: number, mz: number, sx: number, h = 4.5) => {
    const dir = sx >= 0 ? 1 : -1;
    const ang = dir * 0.28;
    p.push(
      { p: [mx, my + h * 0.5, mz], s: [0.15, h, 0.15], c: 0xe6e2d4 },
      { p: [mx, my + h + 0.16, mz], s: [0.26, 0.34, 0.26], c: IMP.ridgeGold, roof: true },
      { p: [mx + dir * 1.12, my + h - 0.95, mz - 0.32], s: [2.25, 1.55, 0.06], c: IMP.crimson, ry: ang, rx: 0.05 },
      { p: [mx + dir * 1.12, my + h - 1.76, mz - 0.36], s: [2.28, 0.16, 0.09], c: IMP.ridgeGold, ry: ang, rx: 0.05 },
    );
  };

  for (const sx of [-1, 1]) {
    const vx = sx * 56.75;
    const vw = 42.5;
    p.push(
      { p: [vx, 0.28, -10.2], s: [vw + 0.6, 0.56, 19.8], c: IMP.stone, tex: 'ashlarStone' },
      { p: [vx, 1.25, -10.2], s: [vw, 1.40, 19.2], c: IMP.red, tex: 'palaceWall' },
      { p: [vx, 2.02, -10.2], s: [vw + 0.4, 0.18, 19.5], c: IMP.marbleBright, tex: 'ashlarStone' },
      // 5 terraced red masonry seating steps with crisp white marble riser trim
      { p: [vx, 2.38, -14.8], s: [vw - 1.0, 0.54, 6.6], c: IMP.redDark, tex: 'palaceWall' },
      { p: [vx, 2.66, -18.0], s: [vw - 1.0, 0.10, 0.28], c: IMP.marbleWarm },
      { p: [vx, 2.86, -12.0], s: [vw - 1.0, 0.56, 5.4], c: IMP.red, tex: 'palaceWall' },
      { p: [vx, 3.15, -14.6], s: [vw - 1.0, 0.10, 0.28], c: IMP.marbleWarm },
      { p: [vx, 3.36, -9.2], s: [vw - 1.0, 0.58, 4.4], c: IMP.redDark, tex: 'palaceWall' },
      { p: [vx, 3.66, -11.3], s: [vw - 1.0, 0.10, 0.28], c: IMP.marbleWarm },
      { p: [vx, 3.88, -6.4], s: [vw - 1.0, 0.60, 3.8], c: IMP.red, tex: 'palaceWall' },
      { p: [vx, 4.19, -8.2], s: [vw - 1.0, 0.10, 0.28], c: IMP.marbleWarm },
      { p: [vx, 4.38, -4.0], s: [vw - 1.0, 0.58, 3.2], c: IMP.redDark, tex: 'palaceWall' },
      { p: [vx, 4.68, -5.5], s: [vw - 1.0, 0.10, 0.28], c: IMP.marbleWarm },
      // Stepped end cheek walls framing inner & outer ends
      { p: [sx * 35.6, 3.2, -10.2], s: [0.85, 2.6, 18.6], c: IMP.redDark, tex: 'palaceWall' },
      { p: [sx * 77.7, 3.2, -10.2], s: [0.85, 2.6, 18.6], c: IMP.redDark, tex: 'palaceWall' },
      // Rear gallery wall with pilasters, recessed gallery windows, green frieze & golden glazed coping
      { p: [vx, 5.15, -1.6], s: [vw, 3.00, 2.2], c: IMP.red, tex: 'palaceWall' },
      { p: [vx, 6.76, -1.6], s: [vw + 0.3, 0.28, 2.4], c: IMP.beamGreen },
      { p: [vx, 7.08, -1.6], s: [vw + 0.6, 0.42, 2.7], c: IMP.yellowTile, tex: 'roofTile' },
    );
    for (let gi = 0; gi < 4; gi++) {
      const gx = sx * (40.5 + gi * 10.6);
      p.push(
        { p: [gx - sx * 5.1, 5.3, -2.72], s: [0.65, 2.6, 0.24], c: IMP.redDark, tex: 'palaceWall' },
        { p: [gx, 5.4, -2.74], s: [3.2, 1.55, 0.16], c: IMP.woodDark },
        { p: [gx, 5.4, -2.78], s: [2.8, 1.25, 0.12], c: IMP.gate },
      );
    }
    balustradeRun(p, sx * 36.2, -19.2, sx * 77.2, -19.2, 2.08, 4.55, IMP.marble, IMP.marbleBright, 0.92);
    balustradeRun(p, sx * 36.6, -3.2, sx * 76.8, -3.2, 4.66, 6.7, IMP.marble, IMP.marbleBright, 0.85);

    // 4 ceremonial masts atop each Reviewing Stand + 3 along each red flank bridge wall
    for (const bx of [43, 53, 63, 73]) addBannerMast(sx * bx, 7.25, -1.6, sx, 4.6);
    for (const fx of [82, 88.5, 95]) addBannerMast(sx * fx, 7.65, -7.5, sx, 4.5);
  }

  // White Marble Balustrade atop the Podium (front crisp 2.5m; rear 4.5m to save distant polygons)
  balustradeRun(p, -32.5, -17.6, 32.5, -17.6, 13.6, 2.5, IMP.marble, IMP.marbleBright);
  balustradeRun(p, -32.5, 17.6, 32.5, 17.6, 13.6, 4.5, IMP.marble, IMP.marbleBright);
  balustradeRun(p, -32.5, -15.1, -32.5, 15.1, 13.6, 2.75, IMP.marble, IMP.marbleBright);
  balustradeRun(p, 32.5, -15.1, 32.5, 15.1, 13.6, 2.75, IMP.marble, IMP.marbleBright);

  // Upper Palace Hall (城樓大殿, 9 bays wide, y = 14..35)
  p.push(
    { p: [0, 14.05, 0], s: [58, 0.5, 29], c: IMP.stone, tex: 'ashlarStone' },
    { p: [0, 18.0, 0], s: [52, 7.6, 24], c: IMP.red, tex: 'palaceWall' },
    { p: [0, 14.6, 0], s: [52.4, 0.8, 24.4], c: IMP.stone, tex: 'ashlarStone' },
    // Continuous Hexi imperial painted architrave beam frieze under front gallery eaves
    { p: [0, 21.1, -12.82], s: [51.2, 0.62, 0.32], c: IMP.beamBlue },
    { p: [0, 20.6, -12.82], s: [51.2, 0.32, 0.28], c: IMP.beamGreen },
    { p: [0, 20.42, -12.84], s: [51.2, 0.10, 0.30], c: IMP.gold },
  );

  // Vermilion colonnade: 10 front columns, 10 rear/side columns with golden drum bases (柱礎)
  const addCol = (cx: number, cz: number, seg = 10) => {
    p.push(
      { p: [cx, 14.24, cz], s: [1.35, 0.28, 1.35], c: IMP.marble },
      { p: [cx, 14.48, cz], s: [1.14, 0.24, 1.14], c: IMP.gold, cyl: true, seg },
      { p: [cx, 18.0, cz], s: [0.88, 6.9, 0.88], c: 0xa0302a, cyl: true, seg, top: 0.92 },
      { p: [cx, 21.35, cz], s: [1.02, 0.24, 1.02], c: IMP.gold, cyl: true, seg: Math.max(6, seg - 2) },
    );
  };
  for (let i = 0; i < 10; i++) {
    const cx = -25.2 + i * 5.6;
    addCol(cx, -12.8, 10);
    if (i === 0 || i === 3 || i === 6 || i === 9) addCol(cx, 12.8, 7);
  }
  for (const sx of [-1, 1]) {
    for (const cz of [-6.4, 0, 6.4]) addCol(sx * 25.2, cz, 7);
  }

  // Golden diamond-lattice palace doors & windows (楠木菱花格扇門窗) in the 9 front bays
  // Placed at z = -12.29 just in front of the glowing interior panes at z = -12.25
  for (let i = 0; i < 9; i++) {
    const bx = -22.4 + i * 5.6;
    p.push(
      { p: [bx, 14.95, -12.10], s: [4.2, 1.25, 0.18], c: IMP.gate },
      { p: [bx, 15.62, -12.28], s: [3.9, 0.12, 0.08], c: IMP.gold },
      { p: [bx, 19.72, -12.28], s: [3.9, 0.12, 0.08], c: IMP.gold },
      { p: [bx - 1.88, 17.65, -12.28], s: [0.12, 4.15, 0.08], c: IMP.gold },
      { p: [bx + 1.88, 17.65, -12.28], s: [0.12, 4.15, 0.08], c: IMP.gold },
      { p: [bx - 0.62, 17.65, -12.28], s: [0.08, 4.05, 0.07], c: IMP.ridgeGold },
      { p: [bx + 0.62, 17.65, -12.28], s: [0.08, 4.05, 0.07], c: IMP.ridgeGold },
      { p: [bx, 17.65, -12.28], s: [3.7, 0.09, 0.07], c: IMP.ridgeGold },
      { p: [bx, 17.65, -12.29], s: [0.07, 2.3, 0.06], c: IMP.ridgeGold, rz: 0.78 },
      { p: [bx, 17.65, -12.29], s: [0.07, 2.3, 0.06], c: IMP.ridgeGold, rz: -0.78 },
    );
  }

  // Lower eave painted Hexi beams & 2-tier dougong bracket clusters + curved lower roof
  eaveBrackets(p, 21.85, 53.6, 25.8, 2.4);
  p.push(...imperialRoof(22.2, 62, 31, 4.2, IMP.yellowTile, 0, IMP.ridgeGold));

  // Upper palace story (y = 25.6..29.0) + painted beams + dougong + upper roof
  p.push(
    { p: [0, 27.15, 0], s: [48, 3.5, 19], c: IMP.red, tex: 'palaceWall' },
    { p: [0, 27.15, -9.55], s: [44, 1.3, 0.14], c: IMP.gold },
  );
  eaveBrackets(p, 28.65, 49.4, 20.4, 2.9);
  p.push(...imperialRoof(29.0, 56, 27, 5.4, IMP.yellowTile, 0, IMP.ridgeGold));

  // Five Arched Golden Water Bridges (金水橋, z = -27), crisper moat stone embankment rails & mirrored bridge water sheen
  p.push(
    // Mirror-dark river slab (top at y = 0.05, safely above scenes.ts ground y = -0.01)
    { p: [0, 0.02, -27], s: [168, 0.06, 7.0], c: 0x0c141c },
    // Subtle dark mirrored surface sheen bands & warm reflection streaks
    { p: [0, 0.054, -25.4], s: [164, 0.012, 1.35], c: 0x162330 },
    { p: [0, 0.054, -28.6], s: [164, 0.012, 1.35], c: 0x162330 },
    // North & South battered granite quay walls, water-line ledges, and white marble embankment coping rails
    { p: [0, 0.14, -23.15], s: [168, 0.32, 0.96], c: IMP.stoneDark },
    { p: [0, 0.06, -23.62], s: [168, 0.14, 0.38], c: IMP.stone },
    { p: [0, 0.34, -23.15], s: [168, 0.22, 0.72], c: IMP.marbleBright },
    { p: [0, 0.14, -30.85], s: [168, 0.32, 0.96], c: IMP.stoneDark },
    { p: [0, 0.06, -30.38], s: [168, 0.14, 0.38], c: IMP.stone },
    { p: [0, 0.34, -30.85], s: [168, 0.22, 0.72], c: IMP.marbleBright },
    { p: [-84.2, 0.20, -27], s: [0.9, 0.48, 8.4], c: IMP.stoneDark },
    { p: [84.2, 0.20, -27], s: [0.9, 0.48, 8.4], c: IMP.stoneDark },
  );
  // Subtle mirrored golden-stone reflection patches beneath each Golden Water Bridge
  for (const bx of [-16, -8, 0, 8, 16]) {
    p.push({ p: [bx, 0.057, -27], s: [bx === 0 ? 5.6 : 3.6, 0.012, 5.0], c: 0x22201a });
  }
  // Riverbank balustrades neatly framing gaps around the 5 bridges (x = -78..78 matching Reviewing Stands)
  const bankSpans: [number, number][] = [
    [-78, -19.2],
    [-12.8, -11.2],
    [-4.8, -4.0],
    [4.0, 4.8],
    [11.2, 12.8],
    [19.2, 78],
  ];
  for (const bz of [-23.15, -30.85]) {
    for (const [x0, x1] of bankSpans) {
      balustradeRun(p, x0, bz, x1, bz, 0.40, Math.min(4.8, x1 - x0), IMP.marble, IMP.marbleBright, 0.85);
    }
  }
  for (const bx of [-16, -8, 0, 8, 16]) {
    p.push(...place(goldenWaterBridge(bx === 0 ? 6.2 : 4.2), bx, 0));
  }
  if (includeHeroProps) {
    // Twin carved imperial stone lions (石獅子) flanking the central Golden Water Bridge entrance
    for (const sx of [-1, 1]) {
      p.push(...stoneLion(sx * 7.6, -32.4, -1));
    }

    // Twin Ornate Huabiao (華表) at x = ±22, z = -34
    for (const hx of [-22, 22]) {
      p.push(...place(huabiao(), hx, -34));
    }
  }

  return p;
}

/** Ceremonial north/south staircase & central carved cloud-dragon spirit ramp (丹陛石) for Monument. */
function monumentStair(p: Part[], sz: number) {
  // Lower flight (|z| = 30.0..33.6, y = 1.5..0)
  for (let i = 0; i < 6; i++) {
    const h = 1.5 - i * 0.24;
    p.push({ p: [0, h * 0.5, sz * (30.3 + i * 0.58)], s: [13.2, h, 0.62], c: IMP.marble });
  }
  // Upper flight (|z| = 22.0..25.6, y = 3.0..1.5)
  for (let i = 0; i < 6; i++) {
    const h = 1.5 - i * 0.24;
    p.push({ p: [0, 1.5 + h * 0.5, sz * (22.3 + i * 0.58)], s: [11.2, h, 0.62], c: IMP.marble });
  }
  // Sloped marble cheek walls flanking both flights
  for (const sx of [-1, 1]) {
    p.push(
      { p: [sx * 6.8, 0.85, sz * 31.8], s: [0.45, 0.65, 3.8], c: IMP.marbleBright, rx: sz * 0.40 },
      { p: [sx * 5.8, 2.35, sz * 23.8], s: [0.45, 0.65, 3.8], c: IMP.marbleBright, rx: sz * 0.40 },
    );
  }
  // Central carved cloud-dragon spirit ramp (丹陛石) on both tiers
  p.push(
    { p: [0, 0.85, sz * 31.8], s: [3.2, 0.30, 3.9], c: IMP.marbleBright, rx: sz * 0.40 },
    { p: [0, 2.35, sz * 23.8], s: [2.8, 0.30, 3.9], c: IMP.marbleBright, rx: sz * 0.40 },
  );
  for (const k of [-1.0, 0, 1.0]) {
    p.push(
      { p: [0, 0.98 - k * 0.42, sz * (31.8 + k)], s: [2.2, 0.14, 0.44], c: IMP.marbleWarm, rx: sz * 0.40 },
      { p: [0, 2.48 - k * 0.42, sz * (23.8 + k)], s: [1.9, 0.14, 0.44], c: IMP.marbleWarm, rx: sz * 0.40 },
    );
  }
}

/** One framed white marble historical relief panel with dynamic 3D figure silhouettes (local front faces +z). */
function reliefPanel(w: number, seedOffset: number): Part[] {
  const p: Part[] = [
    { p: [0, 0, 0], s: [w + 0.5, 1.24, 0.16], c: IMP.graniteDark },
    { p: [0, 0, 0.08], s: [w, 1.02, 0.12], c: IMP.marbleBright },
  ];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const fx = -w * 0.38 + (i / (n - 1)) * w * 0.76;
    const pose = ((i + seedOffset) % 3) - 1;
    p.push({
      p: [fx, -0.04 + Math.abs(pose) * 0.04, 0.16],
      s: [0.34, 0.68 + ((i + seedOffset) % 2) * 0.12, 0.14],
      c: i % 2 === 0 ? 0xf2ede0 : IMP.marble,
      rz: pose * 0.22,
    });
  }
  // Raised relief flag / rifle spear accent
  p.push({ p: [w * 0.16, 0.18, 0.18], s: [0.08, 0.88, 0.08], c: 0xf2ede0, rz: -0.38 });
  return p;
}

/** One carved floral garland wreath (花環浮雕) on the upper Sumeru pedestal (local front faces +z). */
function garlandWreath(): Part[] {
  return [
    {
      p: [0, 0, 0],
      s: [0.92, 0.92, 0.48],
      c: IMP.marbleBright,
      torus: true,
      tube: 0.15,
      seg: 8,
      detail: 4,
    },
    { p: [0, 0, 0.04], s: [0.32, 0.32, 0.14], c: IMP.marbleWarm, sphere: true, detail: 0 },
  ];
}

/** 人民英雄紀念碑: evergreen pine beds, two-tier cross marble terraces with staircases, Sumeru pedestals with 8 relief panels & 8 garlands, and 37.9m obelisk. */
export function monument(): Part[] {
  const m = IMP.marble;
  const p: Part[] = [
    // Two-tier cross-shaped white marble terraces (lower 61x46 + 14x60 arm, upper 44x36 + 12x44 arm)
    { p: [0, 0.20, 0], s: [62, 0.40, 47], c: IMP.graniteMid, tex: 'ashlarStone' },
    { p: [0, 0.80, 0], s: [61, 1.40, 46], c: m, tex: 'ashlarStone' },
    { p: [0, 1.44, 0], s: [61.4, 0.16, 46.4], c: IMP.marbleBright },
    { p: [0, 0.75, 0], s: [14, 1.50, 60], c: m, tex: 'ashlarStone' },
    { p: [0, 2.25, 0], s: [44, 1.50, 36], c: m, tex: 'ashlarStone' },
    { p: [0, 2.94, 0], s: [44.4, 0.16, 36.4], c: IMP.marbleBright },
    { p: [0, 2.25, 0], s: [12, 1.50, 44], c: m, tex: 'ashlarStone' },
  ];

  // Evergreen Pine & Cypress Hedge Beds (蒼松翠柏綠化帶) at x = ±34, z = -22..22
  for (const sx of [-1, 1]) {
    const px = sx * 34;
    p.push(
      { p: [px, 0.24, 0], s: [4.2, 0.48, 44.0], c: IMP.graniteMid },
      { p: [px, 0.50, 0], s: [3.6, 0.10, 43.2], c: 0x3b352c },
      { p: [px, 1.15, 0], s: [2.8, 1.25, 42.0], c: IMP.pineMid },
    );
    for (let pz = -18; pz <= 18; pz += 6) {
      p.push(
        { p: [px, 1.75, pz], s: [0.34, 1.4, 0.34], c: IMP.woodDark, cyl: true, seg: 6 },
        { p: [px, 3.0, pz], s: [2.2, 2.3, 2.2], c: IMP.pineDark, cyl: true, seg: 6, top: 0.25 },
        { p: [px, 4.3, pz], s: [1.5, 1.8, 1.5], c: IMP.pineMid, cyl: true, seg: 6, top: 0.10 },
      );
    }
  }

  // North & South ceremonial staircases + carved 丹陛石 spirit ramps
  monumentStair(p, 1);
  monumentStair(p, -1);

  // Dense white marble balustrades around both terraces (望柱 every ~3.8m, stair openings clear)
  // Lower terrace (61 x 46, opening |x| < 7.0)
  for (const sz of [-1, 1]) {
    balustradeRun(p, -30.5, sz * 23, -7.0, sz * 23, 1.5, 3.9, m, IMP.marbleBright);
    balustradeRun(p, 7.0, sz * 23, 30.5, sz * 23, 1.5, 3.9, m, IMP.marbleBright);
    for (const sx of [-1, 1]) {
      balustradeRun(p, sx * 7.0, sz * 23.3, sx * 7.0, sz * 30.0, 1.5, 3.35, m, IMP.marbleBright);
    }
  }
  for (const sx of [-1, 1]) {
    balustradeRun(p, sx * 30.5, -22.6, sx * 30.5, 22.6, 1.5, 3.8, m, IMP.marbleBright);
  }
  // Upper terrace (44 x 36, opening |x| < 6.0)
  for (const sz of [-1, 1]) {
    balustradeRun(p, -22.0, sz * 18, -6.0, sz * 18, 3.0, 4.0, m, IMP.marbleBright);
    balustradeRun(p, 6.0, sz * 18, 22.0, sz * 18, 3.0, 4.0, m, IMP.marbleBright);
    for (const sx of [-1, 1]) {
      balustradeRun(p, sx * 6.0, sz * 18.3, sx * 6.0, sz * 22.0, 3.0, 3.7, m, IMP.marbleBright);
    }
  }
  for (const sx of [-1, 1]) {
    balustradeRun(p, sx * 22.0, -17.6, sx * 22.0, 17.6, 3.0, 3.9, m, IMP.marbleBright);
  }

  // 4 sculpted corner bronze & granite garland urn accents on the upper terrace (x = ±20.4, z = ±16.4)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * 20.4;
      const cz = sz * 16.4;
      p.push(
        { p: [cx, 3.25, cz], s: [1.35, 0.50, 1.35], c: IMP.graniteDark },
        { p: [cx, 3.71, cz], s: [1.05, 0.42, 1.05], c: IMP.graniteLight },
        { p: [cx, 4.28, cz], s: [0.84, 0.72, 0.84], c: IMP.bronze, cyl: true, seg: 6, top: 1.24 },
        { p: [cx, 4.26, cz], s: [0.98, 0.22, 0.28], c: IMP.gold },
        { p: [cx, 4.26, cz], s: [0.28, 0.22, 0.98], c: IMP.gold },
        { p: [cx, 4.82, cz], s: [0.76, 0.36, 0.76], c: IMP.bronze, roof: true },
      );
    }
  }

  // Lower & Upper Sumeru Pedestals (大小須彌座)
  p.push(
    { p: [0, 3.45, 0], s: [18.0, 0.90, 21.0], c: IMP.graniteLight, bevel: true, tex: 'ashlarStone' },
    { p: [0, 4.18, 0], s: [17.0, 0.60, 20.0], c: IMP.graniteMid, bevel: true, tex: 'ashlarStone' },
    { p: [0, 5.28, 0], s: [15.4, 1.65, 18.4], c: IMP.graniteDark, tex: 'ashlarStone' },
    { p: [0, 6.32, 0], s: [16.4, 0.45, 19.4], c: IMP.graniteLight, tex: 'ashlarStone' },
    { p: [0, 6.68, 0], s: [14.4, 0.35, 17.4], c: IMP.graniteMid, tex: 'ashlarStone' },
    { p: [0, 7.42, 0], s: [9.4, 1.15, 10.8], c: IMP.graniteDark, tex: 'ashlarStone' },
    { p: [0, 8.12, 0], s: [10.4, 0.42, 11.8], c: IMP.graniteLight, tex: 'ashlarStone' },
  );

  // 8 Sculpted White Marble Historical Relief Panels (八幅漢白玉浮雕) at y = 5.3
  for (const sz of [-1, 1]) {
    for (const rx of [-3.8, 3.8]) {
      p.push(...place(reliefPanel(5.8, sz + rx), rx, sz * 9.22, sz === 1 ? 0 : Math.PI, 5.3));
    }
  }
  for (const sx of [-1, 1]) {
    for (const rz of [-4.5, 4.5]) {
      p.push(...place(reliefPanel(6.8, sx + rz), sx * 7.72, rz, sx === 1 ? Math.PI / 2 : -Math.PI / 2, 5.3));
    }
  }

  // 8 Carved Floral Garland Wreaths (花環浮雕) around the upper Sumeru waist at y = 7.4
  for (const sz of [-1, 1]) {
    for (const gx of [-2.4, 2.4]) {
      p.push(...place(garlandWreath(), gx, sz * 5.45, sz === 1 ? 0 : Math.PI, 7.42));
    }
  }
  for (const sx of [-1, 1]) {
    for (const gz of [-2.8, 2.8]) {
      p.push(...place(garlandWreath(), sx * 4.75, gz, sx === 1 ? Math.PI / 2 : -Math.PI / 2, 7.42));
    }
  }

  // Tapered Granite Obelisk Shaft (碑身, y = 8.2..36.0)
  p.push(
    { p: [0, 8.55, 0], s: [7.4, 0.70, 8.8], c: IMP.graniteMid, tex: 'ashlarStone' },
    { p: [0, 13.5, 0], s: [6.4, 9.4, 7.8], c: IMP.graniteLight, bevel: true, tex: 'ashlarStone' },
    { p: [0, 22.8, 0], s: [6.1, 9.4, 7.5], c: IMP.graniteLight, bevel: true, tex: 'ashlarStone' },
    { p: [0, 31.8, 0], s: [5.8, 8.6, 7.2], c: IMP.graniteLight, bevel: true, tex: 'ashlarStone' },
  );

  // Sharper golden calligraphy inscription tablets with deep dark carved granite recess frames (+Z and -Z)
  for (const sz of [1, -1]) {
    const zWell = sz * 3.82;
    const zFrame = sz * 3.86;
    const zGold = sz * 3.89;
    p.push(
      // Raised outer carved dark granite recess frame (top, bottom, left, right)
      { p: [0, 34.15, zFrame], s: [3.2, 0.42, 0.24], c: 0x5c584e },
      { p: [0, 15.45, zFrame], s: [3.2, 0.42, 0.24], c: 0x5c584e },
      { p: [-1.46, 24.8, zFrame], s: [0.28, 18.4, 0.24], c: 0x5c584e },
      { p: [1.46, 24.8, zFrame], s: [0.28, 18.4, 0.24], c: 0x5c584e },
      // Deep obsidian-granite recessed tablet well for crisp high-contrast lettering
      { p: [0, 24.8, zWell], s: [2.64, 18.2, 0.14], c: 0x201e1b },
      // Thin burnished gold inner border molding
      { p: [0, 33.72, zGold], s: [2.25, 0.14, 0.06], c: IMP.gold },
      { p: [0, 15.88, zGold], s: [2.25, 0.14, 0.06], c: IMP.gold },
    );
  }

  // Front (+Z) embossed golden calligraphy glyphs (人民英雄永垂不朽 - 8 bold vertical glyph motifs)
  const frontGlyphs: [number, number, number, number][] = [
    [32.1, 1.15, 0.72, 0.14],
    [30.2, 1.20, 0.65, -0.06],
    [28.3, 1.10, 0.85, 0.08],
    [26.4, 1.25, 0.80, -0.10],
    [24.5, 1.05, 0.90, 0.06],
    [22.6, 1.20, 0.82, -0.08],
    [20.7, 0.95, 0.68, 0.12],
    [18.8, 1.25, 0.76, -0.05],
  ];
  for (const [gy, gw, gh, tilt] of frontGlyphs) {
    p.push({ p: [0, gy, 3.92], s: [gw, gh, 0.06], c: 0xf6d56a, rz: tilt });
  }
  p.push(
    { p: [0, 25.4, 3.91], s: [0.24, 14.6, 0.05], c: 0xdab24c },
    { p: [0, 17.2, 3.91], s: [0.85, 0.55, 0.05], c: 0xe6c158 },
  );

  // Rear (-Z) 3-column golden calligraphy inscription strokes (周恩來題寫碑文)
  for (const cx of [-0.74, 0, 0.74]) {
    p.push(
      { p: [cx, 29.8, -3.91], s: [0.34, 4.2, 0.05], c: 0xdfb852 },
      { p: [cx, 24.4, -3.91], s: [0.34, 4.8, 0.05], c: 0xd4aa46 },
      { p: [cx, 19.2, -3.91], s: [0.32, 3.8, 0.05], c: 0xdfb852 },
    );
  }

  // Traditional 廡殿頂 stone cornice with carved dentils & curved hip cap
  p.push(
    { p: [0, 36.4, 0], s: [7.2, 0.8, 8.6], c: IMP.graniteMid },
    { p: [0, 37.3, 0], s: [8.2, 1.0, 9.6], c: IMP.graniteDark },
    { p: [0, 39.0, 0], s: [8.8, 2.4, 10.2], c: 0x8b8578, eave: true, curve: 0.14 },
    { p: [0, 40.32, 0], s: [4.4, 0.36, 0.46], c: 0x736e63 },
  );
  // Carved stone dentils under cornice
  for (let i = -2; i <= 2; i++) {
    for (const sz of [-1, 1]) {
      p.push({ p: [i * 1.4, 36.85, sz * 4.4], s: [0.42, 0.34, 0.46], c: IMP.graniteLight });
    }
    for (const sx of [-1, 1]) {
      p.push({ p: [sx * 3.7, 36.85, i * 1.65], s: [0.46, 0.34, 0.42], c: IMP.graniteLight });
    }
  }

  return p;
}

/** One classical colonnade pillar with square plinth, lotus collar, tapered shaft, flared capital, and abacus. */
function hallPillar(x: number, z: number, dia: number, h: number, col: number, seg = 10, collarSeg = seg): Part[] {
  const yBase = 3.0;
  return [
    { p: [x, yBase + 0.45, z], s: [dia * 1.24, 0.90, dia * 1.24], c: 0xcbc2aa },
    { p: [x, yBase + 1.02, z], s: [dia * 1.10, 0.28, dia * 1.10], c: col, cyl: true, seg: collarSeg },
    { p: [x, yBase + h * 0.5, z], s: [dia, h - 1.6, dia], c: col, cyl: true, seg, top: 0.90 },
    { p: [x, yBase + h - 0.55, z], s: [dia * 0.92, 0.50, dia * 0.92], c: 0xd9cfb6, cyl: true, seg: collarSeg, top: 1.24 },
    { p: [x, yBase + h - 0.16, z], s: [dia * 1.24, 0.34, dia * 1.24], c: 0xd0c6ab },
  ];
}

/** One monumental square-fluted limestone pier for Zhang Kaiji's 1959 Museum portico. */
function squareFlutedPier(x: number, z: number, w: number, h: number, col: number): Part[] {
  const yBase = 3.0;
  return [
    { p: [x, yBase + 0.44, z], s: [w * 1.26, 0.88, w * 1.26], c: 0xc8bfa6 },
    { p: [x, yBase + 1.04, z], s: [w * 1.10, 0.32, w * 1.10], c: 0xd5ccb4 },
    { p: [x, yBase + h * 0.5, z], s: [w * 0.88, h - 1.7, w * 0.88], c: col },
    { p: [x, yBase + h * 0.5, z], s: [w * 1.02, h - 1.9, w * 0.38], c: 0xe9e1cb },
    { p: [x, yBase + h * 0.5, z], s: [w * 0.38, h - 1.9, w * 1.02], c: 0xe9e1cb },
    { p: [x, yBase + h - 0.55, z], s: [w * 1.12, 0.42, w * 1.12], c: 0xd9cfb6 },
    { p: [x, yBase + h - 0.18, z], s: [w * 1.28, 0.36, w * 1.28], c: 0xd0c6ab },
  ];
}

/** 3D National Emblem (國徽) at (x, y, z) facing +X, built from concentric golden wheat/gear torus rings, crimson shield, and 5 stars. */
function nationalEmblem(x: number, y: number, z: number): Part[] {
  const p: Part[] = [
    { p: [x, y, z], s: [6.8, 6.8, 2.1], c: 0xe6b83c, torus: true, tube: 0.082, seg: 16, detail: 6, ry: Math.PI / 2 },
    { p: [x + 0.08, y, z], s: [5.4, 5.4, 1.8], c: 0xf2ca4e, torus: true, tube: 0.042, seg: 14, detail: 5, ry: Math.PI / 2 },
    { p: [x + 0.06, y, z], s: [5.2, 0.34, 5.2], c: IMP.crimson, cyl: true, rz: Math.PI / 2, seg: 16 },
    // Stylized golden Tiananmen gate silhouette in lower emblem
    { p: [x + 0.26, y - 1.15, z], s: [0.14, 0.72, 2.2], c: 0xf4cf56 },
    { p: [x + 0.28, y - 0.65, z], s: [0.16, 0.36, 1.7], c: 0xf4cf56 },
    { p: [x + 0.28, y - 0.34, z], s: [0.14, 0.28, 1.3], c: 0xf4cf56 },
  ];
  // 5 golden stars above Tiananmen silhouette
  const stars: [number, number, number][] = [
    [0, 1.15, 0.62],
    [-1.18, 0.78, 0.36],
    [-1.48, 0.10, 0.34],
    [1.18, 0.78, 0.36],
    [1.48, 0.10, 0.34],
  ];
  for (const [sz, sy, size] of stars) {
    p.push({
      p: [x + 0.28, y + sy, z + sz],
      s: [0.14, size, size],
      c: 0xfae06e,
      rx: Math.PI / 4,
    });
  }
  return p;
}

/** Rectangular red-and-gold museum plaque emblem (中國革命歷史博物館) mounted on the central portal frieze facing +X. */
function museumPlaque(x: number, y: number, z: number): Part[] {
  const p: Part[] = [
    { p: [x, y, z], s: [0.30, 2.55, 20.4], c: IMP.gold },
    { p: [x + 0.11, y, z], s: [0.18, 1.95, 19.4], c: IMP.crimson },
    { p: [x + 0.19, y + 0.84, z], s: [0.10, 0.12, 18.8], c: IMP.ridgeGold },
    { p: [x + 0.19, y - 0.84, z], s: [0.10, 0.12, 18.8], c: IMP.ridgeGold },
    // Flanking carved golden lotus rosettes
    { p: [x + 0.18, y, z - 9.0], s: [0.16, 0.88, 0.88], c: IMP.ridgeGold, cyl: true, rz: Math.PI / 2, seg: 6 },
    { p: [x + 0.18, y, z + 9.0], s: [0.16, 0.88, 0.88], c: IMP.ridgeGold, cyl: true, rz: Math.PI / 2, seg: 6 },
  ];
  // Stylized carved gold inscription glyphs (中國革命歷史博物館 - 9 character calligraphic motifs)
  for (let i = -4; i <= 4; i++) {
    const gz = z + i * 1.85;
    p.push(
      { p: [x + 0.22, y + 0.16, gz], s: [0.10, 0.28, 1.10], c: 0xf4cf56 },
      { p: [x + 0.22, y - 0.08, gz], s: [0.10, 0.86, 0.34], c: 0xf4cf56 },
    );
  }
  return p;
}

/** 人民大會堂 / 中國革命歷史博物館 (facade faces +x; length 310m along Z). */
export function greatHall(museum = false): Part[] {
  const wall = museum ? IMP.museumWall : IMP.hallWall;
  const col = IMP.hallCol;
  const trim = IMP.hallTrim;

  const p: Part[] = [
    // Grand granite podium & portico terrace (darker rusticated podium base + chamfer water-table ledge)
    { p: [0, 1.5, 0], s: [76, 3.0, 310], c: 0x8a8270, tex: 'ashlarStone' },
    { p: [41.5, 1.5, 0], s: [7.0, 3.0, 92], c: 0x978f7e, tex: 'ashlarStone' },
    { p: [38.1, 2.88, 0], s: [0.65, 0.34, 310], c: 0xc2b9a2, tex: 'ashlarStone' },
    { p: [28.3, 14.0, 0], s: [0.60, 0.55, 300], c: 0xcbc2ab, tex: 'ashlarStone' },
    // Main building mass & deep recessed portico entrance
    { p: [-4, 15.0, 0], s: [64, 24.0, 300], c: wall, tex: 'ashlarStone' },
    { p: [29.8, 15.6, 0], s: [4.2, 24.8, 96], c: 0x62584b, tex: 'ashlarStone' },
    { p: [33.0, 15.6, -47.6], s: [10.4, 24.8, 1.0], c: wall, tex: 'ashlarStone' },
    { p: [33.0, 15.6, 47.6], s: [10.4, 24.8, 1.0], c: wall, tex: 'ashlarStone' },
    { p: [36.0, 27.6, 0], s: [16.4, 0.8, 96], c: 0xd0c6ab, tex: 'ashlarStone' },
    // Glazed yellow-and-green cornice eave & parapet around entire perimeter
    { p: [-4, 27.5, 0], s: [66.6, 1.1, 304], c: IMP.hallGreen },
    { p: [-4, 28.6, 0], s: [68.2, 1.2, 307], c: trim, tex: 'roofTile' },
    { p: [-4, 29.8, 0], s: [62.0, 1.2, 298], c: 0xa79a7b, tex: 'ashlarStone' },
    // Extended portico entablature
    { p: [36.0, 28.2, 0], s: [16.5, 1.1, 100], c: IMP.hallGreen },
    { p: [36.0, 29.3, 0], s: [17.8, 1.2, 102], c: trim, tex: 'roofTile' },
    { p: [36.0, 30.8, 0], s: [16.2, 1.4, 98], c: 0xa79a7b, tex: 'ashlarStone' },
    // Stepped central hall roof mass (y = 30..37)
    { p: [-12, 33.0, 0], s: [museum ? 34 : 38, museum ? 6.0 : 7.2, museum ? 64 : 112], c: 0xa99d80, tex: 'ashlarStone' },
    { p: [-12, 33.4, 0], s: [museum ? 34.4 : 38.4, 2.0, museum ? 56 : 102], c: 0x3b4046 },
    { p: [-12, museum ? 36.2 : 37.0, 0], s: [museum ? 35.2 : 39.2, 0.8, museum ? 66 : 114], c: trim, tex: 'roofTile' },
  ];

  // Portico back-wall vertical stone pilasters separating the 5 monumental bronze portals + cornice dentil ribs
  for (const pz of [-36, -18, -6, 6, 18, 36]) {
    p.push({ p: [31.95, 15.2, pz], s: [0.65, 24.4, 1.55], c: col, tex: 'ashlarStone' });
  }
  for (let dz = -46; dz <= 46; dz += 4) {
    p.push({ p: [44.3, 27.02, dz], s: [0.42, 0.44, 0.36], c: 0xdfd7be });
  }

  // Grand multi-step granite podium staircase (x = 45..52, z = -45..45) with central ceremonial ramp
  for (let i = 0; i < 6; i++) {
    const sx = 45.0 + i * 1.16;
    const h = 2.85 - i * 0.45;
    p.push({ p: [sx, h * 0.5, 0], s: [1.22, h, 88], c: 0xa79f8c });
  }
  for (const sz of [-1, 1]) {
    p.push(
      { p: [48.5, 1.5, sz * 44.6], s: [7.2, 1.0, 1.1], c: 0xbab19b, rz: -0.39 },
      { p: [38.2, 3.5, sz * 42], s: [0.4, 1.0, 12], c: 0xd8d0b8 },
    );
  }
  // Flush ceremonial granite ramp along center axis (clear of dawn kneeling students at y = 3.4)
  p.push({ p: [48.5, 1.48, 0], s: [7.4, 0.24, 4.4], c: 0xc2b9a4, rz: -0.39 });

  // 5 tall bronze-and-glass portals inside the deep recessed portico (x = 32.2, z = -24..24)
  for (const pz of [-24, -12, 0, 12, 24]) {
    p.push(
      { p: [32.1, 8.4, pz], s: [0.45, 10.6, 6.4], c: IMP.bronze },
      { p: [32.3, 8.2, pz], s: [0.22, 9.6, 5.4], c: IMP.glass },
      { p: [32.38, 8.2, pz], s: [0.16, 9.6, 0.22], c: IMP.bronze },
      { p: [32.38, 10.2, pz], s: [0.16, 0.24, 5.6], c: IMP.bronze },
      { p: [32.2, 20.6, pz], s: [0.30, 6.2, 5.2], c: IMP.glass },
    );
  }

  // Front colonnade: 10 monumental square-fluted limestone piers (Museum) vs 12 round colonnade pillars (Great Hall)
  const span = 84;
  if (museum) {
    for (let i = 0; i < 10; i++) {
      const cz = -span / 2 + (i * span) / 9;
      p.push(...squareFlutedPier(42.2, cz, 2.25, 24.8, col));
    }
    // Side courtyard wings: crisp square limestone wing piers + connecting entablature beams
    for (const sg of [-1, 1]) {
      p.push(
        { p: [29.8, 26.25, sg * 68], s: [3.4, 1.7, 34], c: 0xbcb298 },
        { p: [29.8, 26.25, sg * 134], s: [3.4, 1.7, 28], c: 0xbcb298 },
      );
      for (const wz of [58, 68, 78, 124, 134, 144]) {
        p.push(
          { p: [30.2, 3.45, sg * wz], s: [2.1, 0.9, 2.1], c: 0xcbc2aa },
          { p: [30.2, 14.5, sg * wz], s: [1.65, 21.8, 1.65], c: col },
        );
      }
      // Twin symmetrical north & south stepped courtyard pavilion towers (z = ±102) reflecting the 1959 H-plan
      const tz = sg * 102;
      p.push(
        { p: [26.8, 15.0, tz], s: [13.2, 24.0, 34], c: wall, tex: 'ashlarStone' },
        { p: [27.0, 27.5, tz], s: [14.4, 1.1, 35.6], c: IMP.hallGreen },
        { p: [27.0, 28.6, tz], s: [15.4, 1.2, 36.8], c: trim, tex: 'roofTile' },
        { p: [33.4, 14.8, tz], s: [0.55, 17.2, 21.8], c: 0xd0c6ab, tex: 'ashlarStone' },
        { p: [33.55, 14.8, tz], s: [0.35, 16.2, 20.6], c: IMP.glass },
        { p: [33.62, 14.0, tz], s: [0.45, 0.65, 22.0], c: 0xd0c6ab, tex: 'ashlarStone' },
        { p: [18.0, 32.8, tz], s: [26, 5.6, 36], c: wall, tex: 'ashlarStone' },
        { p: [18.2, 33.0, tz], s: [26.4, 2.0, 26], c: 0x3b4046 },
        { p: [18.0, 35.9, tz], s: [27.4, 0.85, 37.6], c: IMP.hallGreen },
        { p: [18.0, 36.7, tz], s: [28.6, 0.90, 39.0], c: trim, tex: 'roofTile' },
        { p: [18.0, 37.6, tz], s: [18, 1.3, 24], c: 0xa79a7b, tex: 'ashlarStone' },
        { p: [18.0, 39.2, tz], s: [20, 2.0, 26], c: trim, roof: true, tex: 'roofTile' },
        { p: [18.0, 40.3, tz], s: [1.0, 0.36, 9.6], c: IMP.ridgeGold },
      );
      for (const pz of [-12, -4, 4, 12]) {
        p.push({ p: [33.6, 15.2, tz + pz], s: [0.85, 22.8, 1.35], c: col, tex: 'ashlarStone' });
      }
    }
    // Museum exclusive: elevated central portal cornice attic + red-and-gold museum plaque emblem
    p.push(
      { p: [36.5, 31.6, 0], s: [17.0, 2.6, 48], c: 0xc2b597, tex: 'ashlarStone' },
      { p: [36.5, 33.1, 0], s: [17.6, 0.70, 49.2], c: IMP.hallGreen },
      { p: [36.5, 33.7, 0], s: [18.2, 0.72, 50.4], c: trim, tex: 'roofTile' },
      { p: [44.8, 31.6, -23.6], s: [1.1, 3.0, 1.6], c: col, tex: 'ashlarStone' },
      { p: [44.8, 31.6, 23.6], s: [1.1, 3.0, 1.6], c: col, tex: 'ashlarStone' },
    );
    p.push(...museumPlaque(45.20, 31.6, 0));
  } else {
    for (let i = 0; i < 12; i++) {
      const cz = -span / 2 + (i * span) / 11;
      p.push(...hallPillar(42.2, cz, 2.35, 24.8, col, 10));
    }
    // Side wing colonnades (z = ±60..±110) with leaner collar segments & continuous wing entablature beam
    for (const sg of [-1, 1]) {
      p.push({ p: [29.8, 26.25, sg * 85], s: [3.8, 1.7, 62], c: 0xbcb298 });
      for (let i = 0; i < 6; i++) {
        p.push(...hallPillar(30.2, sg * (60 + i * 10), 1.9, 22.4, col, 8, 6));
      }
    }
    // Recessed portico coffered soffit beams & 5 suspended bronze lantern chandeliers
    for (const cx of [34.2, 37.2, 40.2]) {
      p.push({ p: [cx, 27.08, 0], s: [0.55, 0.36, 88], c: 0xbcb298 });
    }
    for (const bz of [-36, -18, -6, 6, 18, 36]) {
      p.push({ p: [37.0, 27.08, bz], s: [10.4, 0.36, 0.55], c: 0xbcb298 });
    }
    for (const lz of [-24, -12, 0, 12, 24]) {
      p.push(
        { p: [37.2, 26.25, lz], s: [0.14, 1.65, 0.14], c: IMP.bronze },
        { p: [37.2, 25.35, lz], s: [1.35, 0.28, 1.35], c: IMP.bronze, cyl: true, seg: 6 },
        { p: [37.2, 24.88, lz], s: [1.02, 0.68, 1.02], c: 0xefb850, cyl: true, seg: 6 },
        { p: [37.2, 24.44, lz], s: [0.42, 0.22, 0.42], c: IMP.gold },
      );
    }
    // Rooftop skylight clerestory penthouse trim & mullions + 3D National Emblem + rooftop red flags
    p.push(
      { p: [-12, 36.3, 0], s: [38.6, 0.55, 113], c: IMP.hallGreen },
      { p: [-12, 38.4, 0], s: [22, 2.1, 74], c: 0xb0a486 },
      { p: [-12, 38.5, 0], s: [22.4, 0.95, 68], c: 0x3b4046 },
      { p: [-12, 39.65, 0], s: [23.2, 0.48, 76], c: trim },
    );
    for (let mz = -44; mz <= 44; mz += 11) {
      p.push({ p: [7.28, 33.6, mz], s: [0.35, 2.2, 0.48], c: 0xc2b79c });
    }
    p.push(...nationalEmblem(44.6, 27.8, 0));
    for (let z = -144; z <= 144; z += 24) {
      p.push(
        { p: [24, 36.2, z], s: [0.25, 11.5, 0.25], c: 0xd8d8d0, cyl: true, seg: 5 },
        { p: [24, 41.0, z + 1.4], s: [0.06, 1.7, 2.7], c: 0xc21f1a },
      );
    }
  }

  // Articulated 2-story side facade bays (|z| > 48): pilasters, recessed bronze-mullioned windows, spandrels, and barred podium lights
  for (const sg of [-1, 1]) {
    for (let z = 54; z <= 144; z += 11.25) {
      if (museum && Math.abs(z - 102) < 16) continue;
      const bz = sg * z;
      p.push(
        { p: [28.35, 15.0, bz], s: [1.05, 22.4, 1.48], c: 0xd0c6ab, tex: 'ashlarStone' },
        { p: [28.45, 25.8, bz], s: [1.22, 0.85, 1.78], c: 0xdcd3ba },
      );
      if (z < 144) {
        const wzNum = z + 5.625;
        if (museum && Math.abs(wzNum - 102) < 17) continue;
        const wz = sg * wzNum;
        p.push(
          // Lower piano-nobile recessed bronze-mullioned tall window
          { p: [28.15, 8.6, wz], s: [0.46, 7.6, 4.3], c: 0xd0c6ab, tex: 'ashlarStone' },
          { p: [28.30, 8.6, wz], s: [0.22, 6.7, 3.5], c: IMP.glass },
          { p: [28.36, 8.6, wz], s: [0.16, 6.7, 0.22], c: IMP.bronze },
          // Upper story recessed bronze-mullioned window
          { p: [28.15, 19.6, wz], s: [0.46, 7.2, 4.3], c: 0xd0c6ab, tex: 'ashlarStone' },
          { p: [28.30, 19.6, wz], s: [0.22, 6.3, 3.5], c: IMP.glass },
          { p: [28.36, 19.6, wz], s: [0.16, 6.3, 0.22], c: IMP.bronze },
          // Rusticated granite podium window + stone sill
          { p: [38.08, 1.45, wz], s: [0.38, 1.65, 3.6], c: 0x24282d },
          { p: [38.18, 0.62, wz], s: [0.46, 0.22, 3.9], c: 0xbab19b },
        );
      }
    }
  }

  return p;
}

/** 華燈 pole: octagonal marble Sumeru base, fluted dark iron shaft with golden rings, and 8 radiating curved wrought-iron scroll brackets. */
export function huadengPole(): Part[] {
  const p: Part[] = [
    // Octagonal white marble Sumeru base (y = 0..1.3)
    { p: [0, 0.22, 0], s: [1.55, 0.44, 1.55], c: IMP.marble, cyl: true, seg: 8 },
    { p: [0, 0.62, 0], s: [1.18, 0.36, 1.18], c: IMP.stone, cyl: true, seg: 8 },
    { p: [0, 0.98, 0], s: [1.45, 0.36, 1.45], c: IMP.marbleBright, cyl: true, seg: 8 },
    { p: [0, 1.24, 0], s: [0.76, 0.22, 0.76], c: IMP.iron, cyl: true, seg: 8 },
    // Fluted dark iron shaft (y = 1.3..7.0) + crown pedestal
    { p: [0, 4.15, 0], s: [0.42, 5.7, 0.42], c: IMP.iron, cyl: true, seg: 10, top: 0.72 },
    { p: [0, 7.36, 0], s: [0.30, 0.85, 0.30], c: IMP.iron, cyl: true, seg: 8, top: 0.78 },
  ];

  // Golden ornamental collar rings
  for (const ry of [2.2, 4.4, 6.45]) {
    p.push({ p: [0, ry, 0], s: [0.46, 0.14, 0.46], c: IMP.gold, cyl: true, seg: 10 });
  }

  // 8 radiating curved wrought-iron scroll brackets (y = 6.5..7.6)
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const ry = -a;
    p.push(
      {
        p: [ca * 0.61, 6.86, sa * 0.61],
        s: [0.88, 0.88, 0.55],
        c: IMP.iron,
        torus: true,
        arc: Math.PI * 0.85,
        tube: 0.08,
        seg: 7,
        detail: 4,
        rz: -Math.PI * 0.85,
        ry,
      },
      {
        p: [ca * 1.05, 6.94, sa * 1.05],
        s: [0.22, 0.12, 0.22],
        c: IMP.gold,
        cyl: true,
        seg: 8,
      },
    );
  }

  return p;
}

/** 華燈 globes: 1 large central lotus globe (y = 8.2) + 8 surrounding magnolia globes (y = 7.3, radius 1.05). */
export function huadengGlobes(): Part[] {
  const p: Part[] = [
    { p: [0, 8.2, 0], s: [1.05, 1.15, 1.05], c: IMP.globeCenter, sphere: true, detail: 1 },
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    p.push({
      p: [Math.cos(a) * 1.05, 7.3, Math.sin(a) * 1.05],
      s: [0.58, 0.64, 0.58],
      c: IMP.globeOuter,
      sphere: true,
      detail: 1,
    });
  }
  return p;
}
