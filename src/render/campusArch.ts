import type { Part } from './kit';
import { C, place, rng } from './kit';

const H = Math.PI / 2;

const L = {
  red: 0x8e2b22,
  redDark: 0x6e2019,
  redBright: 0x9c3227,
  greyTile: 0x4a4e52,
  ridgeDark: 0x34373b,
  marble: 0xd9d6cc,
  marbleWarm: 0xe6e2d6,
  stone: 0x8d8a82,
  stoneDark: 0x6b6861,
  beam: 0x2a5c56,
  beamBlue: 0x284772,
  gold: 0xcfa442,
  door: 0x762119,
  woodDark: 0x3b2316,
  latticeWood: 0x7d3622,
  brickRed: 0x764238,
  brickRedDark: 0x61342c,
  brickGrey: 0x565a5e,
  brickGreyDark: 0x45494d,
  plasterWarm: 0x8a8270,
  concrete: 0x847f75,
};

/** Scale hex color RGB channels by factor (clamped 0..1), preserving 0xffffff tint behavior. */
function shade(hex: number, factor: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((hex & 255) * factor)));
  return (r << 16) | (g << 8) | b;
}

/** Connect two 3D points with a rectangular strut or bar. */
function strut(a: [number, number, number], b: [number, number, number], w: number, d: number, c: number): Part {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 0.001;
  const rx = Math.asin(Math.max(-1, Math.min(1, dz / len)));
  const rz = Math.atan2(-dx, dy);
  return { p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], s: [w, len, d], c, rx, rz };
}

/** Connect two 3D points with a tapered cylinder limb/pole/rope. */
function limb(
  a: [number, number, number],
  b: [number, number, number],
  rBot: number,
  rTop: number,
  c: number,
  seg = 8,
  open = false,
): Part {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 0.001;
  const rx = Math.asin(Math.max(-1, Math.min(1, dz / len)));
  const rz = Math.atan2(-dx, dy);
  return {
    p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    s: [rBot * 2, len, rBot * 2],
    c,
    rx,
    rz,
    cyl: true,
    seg,
    top: rTop / rBot,
    open,
  };
}

/** 步步錦 traditional wooden lattice window for PKU West Gate side bays. */
function latticeWindow(cx: number, cy: number, cz: number, dir: -1 | 1): Part[] {
  const zOut = cz + dir * 0.04;
  const zGrid = cz + dir * 0.06;
  const p: Part[] = [
    { p: [cx, cy, cz], s: [1.78, 1.56, 0.07], c: L.beam, bevel: true },
    { p: [cx, cy, zOut], s: [1.54, 1.32, 0.04], c: 0x22130e },
    // outer frame stiles and rails
    { p: [cx, cy + 0.64, zGrid], s: [1.56, 0.06, 0.04], c: L.latticeWood },
    { p: [cx, cy - 0.64, zGrid], s: [1.56, 0.06, 0.04], c: L.latticeWood },
    { p: [cx - 0.75, cy, zGrid], s: [0.06, 1.32, 0.04], c: L.latticeWood },
    { p: [cx + 0.75, cy, zGrid], s: [0.06, 1.32, 0.04], c: L.latticeWood },
  ];
  // 3 vertical mullions + 3 horizontal transoms
  for (const dx of [-0.36, 0, 0.36]) p.push({ p: [cx + dx, cy, zGrid], s: [0.036, 1.24, 0.035], c: L.latticeWood });
  for (const dy of [-0.32, 0, 0.32]) p.push({ p: [cx, cy + dy, zGrid], s: [1.46, 0.036, 0.035], c: L.latticeWood });
  // stepped inner corner fret accents (步步錦)
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    p.push(
      { p: [cx + sx * 0.56, cy + sy * 0.48, zGrid + dir * 0.008], s: [0.22, 0.03, 0.025], c: L.gold },
      { p: [cx + sx * 0.48, cy + sy * 0.40, zGrid + dir * 0.008], s: [0.03, 0.18, 0.025], c: L.gold },
    );
  }
  return p;
}

/** Sculpted Qing stone lion (石獅) on 3-tier Sumeru lotus pedestal at local origin, facing -z. */
export function stoneLion(east = false): Part[] {
  const x = 0, z = 0;
  const sMain = 0x99968e, sHi = 0xa6a39b, sMid = 0x89867e, sDark = 0x6c6962;
  const p: Part[] = [
    // 3-tier carved Sumeru lotus pedestal (須彌座)
    { p: [x, 0.22, z], s: [1.62, 0.44, 2.24], c: 0x76736c, bevel: true },
    { p: [x, 0.49, z], s: [1.44, 0.12, 2.04], c: 0x88857d, bevel: true },
    { p: [x, 0.74, z], s: [1.24, 0.38, 1.80], c: sDark },
    { p: [x, 1.07, z], s: [1.54, 0.28, 2.12], c: 0x908d85, bevel: true },
  ];
  // pedestal relief panels on all 4 sides
  for (const sz of [-0.91, 0.91]) {
    p.push({ p: [x, 0.74, z + sz], s: [0.92, 0.26, 0.05], c: sMid, bevel: true });
  }
  for (const sx of [-0.63, 0.63]) {
    for (const dz of [-0.48, 0, 0.48]) {
      p.push({ p: [x + sx, 0.74, z + dz], s: [0.05, 0.24, 0.36], c: sMid, bevel: true });
    }
  }
  // seated muscular torso, chest, hind legs
  p.push(
    { p: [x, 1.54, z + 0.32], s: [0.80, 0.72, 1.08], c: sMain, sphere: true, detail: 1 },
    { p: [x, 1.72, z - 0.14], s: [0.74, 0.70, 0.74], c: sHi, sphere: true, detail: 1 },
    { p: [x - 0.36, 1.44, z + 0.38], s: [0.28, 0.48, 0.46], c: sMid, sphere: true, detail: 1 },
    { p: [x + 0.36, 1.44, z + 0.38], s: [0.28, 0.48, 0.46], c: sMid, sphere: true, detail: 1 },
    // carved bell tassel collar (項圈鈴鐺)
    { p: [x, 1.84, z - 0.20], s: [0.68, 0.68, 0.56], c: 0xb1ab9c, torus: true, tube: 0.075, seg: 14, detail: 5, rx: 1.02 },
    { p: [x, 1.66, z - 0.50], s: [0.16, 0.18, 0.16], c: 0xc2b99e, sphere: true, detail: 0 },
  );
  // forelegs & paws
  p.push(
    { p: [x - 0.25, 1.48, z - 0.36], s: [0.22, 0.58, 0.24], c: sMain, cyl: true, seg: 8, top: 0.85, rx: 0.12 },
    { p: [x + 0.25, 1.48, z - 0.36], s: [0.22, 0.58, 0.24], c: sMain, cyl: true, seg: 8, top: 0.85, rx: 0.12 },
    { p: [x - 0.25, 1.26, z - 0.46], s: [0.25, 0.14, 0.30], c: sHi, bevel: true },
    { p: [x + 0.25, 1.26, z - 0.46], s: [0.25, 0.14, 0.30], c: sHi, bevel: true },
  );
  // east lion paw on brocade ball (繡球); west lion paw on playful cub (幼獅)
  if (east) {
    p.push(
      { p: [x - 0.26, 1.38, z - 0.68], s: [0.34, 0.34, 0.34], c: sHi, sphere: true, detail: 1 },
      { p: [x - 0.26, 1.38, z - 0.68], s: [0.36, 0.36, 0.14], c: sMid, torus: true, tube: 0.06, seg: 12, detail: 4, ry: 0.7 },
    );
  } else {
    p.push(
      { p: [x + 0.28, 1.34, z - 0.68], s: [0.28, 0.22, 0.36], c: sHi, sphere: true, detail: 1 }, // cub body
      { p: [x + 0.28, 1.48, z - 0.78], s: [0.22, 0.22, 0.22], c: sHi, sphere: true, detail: 1 }, // cub head
      { p: [x + 0.28, 1.42, z - 0.52], s: [0.09, 0.18, 0.09], c: sMid, rx: -0.4 },              // cub tail
    );
  }
  // head, snout, open mouth, eyes, ears
  p.push(
    { p: [x, 2.18, z - 0.28], s: [0.64, 0.58, 0.60], c: sHi, sphere: true, detail: 1 },
    { p: [x, 2.14, z - 0.54], s: [0.44, 0.24, 0.26], c: sMain, bevel: true },                  // upper snout
    { p: [x, 2.01, z - 0.52], s: [0.38, 0.12, 0.24], c: 0x3b3832 },                           // open mouth recess
    { p: [x, 1.94, z - 0.50], s: [0.38, 0.10, 0.24], c: sMain, bevel: true },                  // lower jaw
    { p: [x - 0.16, 2.26, z - 0.52], s: [0.11, 0.11, 0.11], c: 0x45423c, sphere: true, detail: 0 }, // eyes
    { p: [x + 0.16, 2.26, z - 0.52], s: [0.11, 0.11, 0.11], c: 0x45423c, sphere: true, detail: 0 },
    { p: [x - 0.26, 2.40, z - 0.26], s: [0.14, 0.18, 0.14], c: sMid, sphere: true, detail: 0 }, // ears
    { p: [x + 0.26, 2.40, z - 0.26], s: [0.14, 0.18, 0.14], c: sMid, sphere: true, detail: 0 },
  );
  // 8-sphere curly mane (螺髻卷毛) + swirled upturned tail
  const curls: [number, number, number][] = [
    [0, 2.48, -0.20], [-0.28, 2.38, -0.14], [0.28, 2.38, -0.14],
    [-0.36, 2.16, -0.10], [0.36, 2.16, -0.10],
    [-0.24, 2.28, 0.04], [0.24, 2.28, 0.04], [0, 2.36, 0.08],
  ];
  for (const [cx, cy, cz] of curls) {
    p.push({ p: [x + cx, cy, z + cz], s: [0.24, 0.24, 0.24], c: sMid, sphere: true, detail: 0 });
  }
  p.push(
    { p: [x, 1.72, z + 0.78], s: [0.18, 0.46, 0.20], c: sMid, cyl: true, seg: 6, rx: -0.35 },
    { p: [x, 2.00, z + 0.74], s: [0.26, 0.26, 0.26], c: sMain, sphere: true, detail: 0 },
  );
  return p;
}

/** 北京大學西校門: three-bay classical palace gate with painted beams, 2-tier dougong, curved eave roof, and twin Qing stone lions. */
export function pkuWestGate(): Part[] {
  const p: Part[] = [
    // multi-tier stone platform (16.4m x 8.8m) + threshold ramp + side steps
    { p: [0, 0.18, 0], s: [16.4, 0.36, 8.8], c: 0x7a7770, bevel: true, tex: 'ashlarStone' },
    { p: [0, 0.43, 0], s: [15.6, 0.16, 8.2], c: 0x9b978d, bevel: true, tex: 'ashlarStone' },
  ];
  for (const sz of [-1, 1]) {
    p.push(
      { p: [0, 0.24, sz * 4.55], s: [0.80, 0.44, 3.8], c: L.marble, wedge: true, ry: sz === 1 ? -H : H },
      { p: [0, 0.14, sz * 4.55], s: [12.4, 0.28, 0.48], c: 0x868279 },
      { p: [0, 0.34, sz * 4.22], s: [12.4, 0.20, 0.36], c: 0x938f86 },
    );
  }

  // 8 main vermilion columns + 4 inner middle-row pillars on marble drum plinths
  for (const x of [-5.6, -1.9, 1.9, 5.6]) {
    for (const z of [-2.6, 0, 2.6]) {
      p.push(
        { p: [x, 0.56, z], s: [0.92, 0.10, 0.92], c: L.marble, bevel: true },
        { p: [x, 0.68, z], s: [0.80, 0.16, 0.80], c: L.marbleWarm, cyl: true, seg: 12, top: 0.78 },
        { p: [x, 0.79, z], s: [0.62, 0.06, 0.62], c: L.gold, cyl: true, seg: 12 },
        { p: [x, 2.75, z], s: [0.58, 3.92, 0.58], c: L.red, cyl: true, seg: 12, top: 0.94 },
        { p: [x, 4.58, z], s: [0.58, 0.08, 0.58], c: L.gold, cyl: true, seg: 12 },
      );
    }
  }

  // wooden threshold beam, gilded lintel beam with 4 door-pin brackets (門簪), and stone drum pillows (抱鼓石)
  p.push(
    { p: [0, 0.60, 0], s: [3.6, 0.20, 0.34], c: L.woodDark },
    { p: [0, 4.18, 0], s: [3.6, 0.66, 0.44], c: L.door },
    { p: [0, 4.18, 0], s: [3.2, 0.44, 0.50], c: L.beam },
  );
  for (const dx of [-1.12, -0.38, 0.38, 1.12]) {
    p.push({ p: [dx, 4.18, -0.28], s: [0.22, 0.24, 0.16], c: L.gold, bevel: true });
    p.push({ p: [dx, 4.18, 0.28], s: [0.22, 0.24, 0.16], c: L.gold, bevel: true });
  }
  for (const sx of [-1, 1]) {
    // carved stone drum door-pillow (抱鼓石) at x = ±1.88, z = -0.45
    p.push(
      { p: [sx * 1.88, 0.68, -0.45], s: [0.38, 0.34, 0.82], c: L.marble, bevel: true },
      { p: [sx * 1.88, 1.06, -0.45], s: [0.56, 0.28, 0.56], c: L.marbleWarm, cyl: true, rz: H, seg: 12 },
      { p: [sx * 1.88, 1.06, -0.45], s: [0.38, 0.38, 1.35], c: 0xc9c4b6, torus: true, tube: 0.12, seg: 10, detail: 4, ry: H },
    );
    // half-open heavy crimson double gate leaves with 5x9 golden door studs (門釘) and brass lion-head knockers
    const x0 = sx * 1.48, z0 = -0.92, ry = sx === -1 ? -0.32 : 0.32;
    p.push({ p: [x0, 2.34, z0], s: [0.13, 3.56, 1.64], c: L.door, ry, bevel: true });
    const c = Math.cos(ry), s = Math.sin(ry);
    p.push({ p: [x0, 0.72, z0], s: [0.15, 0.30, 1.64], c: 0x3b2618, ry }); // bronze kickplate
    for (const dx of [-0.075, 0.075]) {
      // 5 columns (dz) x 9 rows (dy) of golden studs (門釘)
      for (let row = 0; row < 9; row++) {
        const dy = -0.30 + row * 0.22;
        for (let col = 0; col < 5; col++) {
          const dz = -0.52 + col * 0.26;
          p.push({
            p: [x0 + dx * c + dz * s, 2.34 + dy, z0 - dx * s + dz * c],
            s: [0.045, 0.078, 0.078],
            c: L.gold,
            sphere: true,
            detail: 0,
          });
        }
      }
      // brass lion-head knocker (鋪首銜環)
      const kx = x0 + dx * c, kz = z0 - dx * s;
      p.push(
        { p: [kx, 1.56, kz], s: [0.22, 0.04, 0.22], c: L.gold, cyl: true, seg: 6, rz: H, ry },
        { p: [kx + (dx > 0 ? 0.02 : -0.02) * c, 1.57, kz - (dx > 0 ? 0.02 : -0.02) * s], s: [0.08, 0.09, 0.09], c: 0xdcb452, sphere: true, detail: 0 },
        { p: [kx + (dx > 0 ? 0.03 : -0.03) * c, 1.44, kz - (dx > 0 ? 0.03 : -0.03) * s], s: [0.19, 0.19, 0.19], c: 0xdcb452, torus: true, tube: 0.12, seg: 10, detail: 4, ry: H + ry },
      );
    }
  }

  // side bays (x = ±3.75): crimson walls, grey stone wainscoting, and front/back lattice windows
  for (const x of [-3.75, 3.75]) {
    p.push(
      { p: [x, 2.42, 0], s: [3.36, 3.84, 0.56], c: L.redDark, tex: 'palaceWall' },
      { p: [x, 0.98, 0], s: [3.24, 0.96, 0.64], c: 0x625e56, tex: 'ashlarStone' },
      ...latticeWindow(x, 2.58, -0.30, -1),
      ...latticeWindow(x, 2.58, 0.30, 1),
    );
  }

  // multi-layer 蘇式彩畫 painted beams & plaque frame (keeping z=-3.0 clear for signPlane)
  p.push(
    { p: [0, 4.78, 0], s: [12.8, 0.46, 5.8], c: L.beam },
    { p: [0, 5.14, 0], s: [13.2, 0.30, 6.2], c: L.beamBlue },
    { p: [0, 5.36, 0], s: [13.6, 0.16, 6.6], c: L.gold },
    { p: [0, 5.56, 0], s: [14.2, 0.24, 7.0], c: L.red },
    // carved plaque backing frame behind signPlane at (0, 4.75, -3.0)
    { p: [0, 4.75, -2.92], s: [3.22, 1.10, 0.08], c: L.gold, bevel: true },
    { p: [0, 4.75, -2.94], s: [3.06, 0.96, 0.08], c: 0x181410 },
  );
  // Suzhou painted medallions on side bay architraves
  for (const x of [-3.75, 3.75]) for (const z of [-2.91, 2.91]) {
    p.push({ p: [x, 4.78, z], s: [2.2, 0.30, 0.04], c: L.gold });
    p.push({ p: [x, 4.78, z + (z < 0 ? -0.02 : 0.02)], s: [1.9, 0.20, 0.03], c: L.beamBlue });
  }

  // 2-tier 斗拱 bracket sets along front (-z) and back (+z) eaves
  for (let x = -5.6; x <= 5.65; x += 0.93) {
    for (const sz of [-1, 1]) {
      p.push(
        { p: [x, 5.26, sz * 3.12], s: [0.30, 0.20, 0.38], c: L.gold },
        { p: [x, 5.34, sz * 3.16], s: [0.52, 0.12, 0.22], c: L.beam },
        { p: [x, 5.48, sz * 3.28], s: [0.38, 0.18, 0.48], c: L.beamBlue },
        { p: [x, 5.56, sz * 3.36], s: [0.24, 0.12, 0.24], c: L.gold },
      );
    }
  }
  // eave soffit & rafter ends (椽頭)
  p.push({ p: [0, 5.70, 0], s: [15.0, 0.18, 8.0], c: L.woodDark });
  for (let x = -6.8; x <= 6.85; x += 0.55) {
    for (const sz of [-1, 1]) {
      p.push({ p: [x, 5.64, sz * 3.55], s: [0.10, 0.10, 0.18], c: L.gold });
    }
  }

  // curved grey-tile hip roof (w=16.0, d=9.0, h=3.2) + main ridge + 吻獸 + curved hip ridges + 5 roof beasts
  const roofBaseY = 5.74, roofW = 16.0, roofH = 3.2, roofD = 9.0, roofCurve = 0.20;
  p.push(
    { p: [0, roofBaseY + roofH / 2, 0], s: [roofW, roofH, roofD], c: L.greyTile, eave: true, curve: roofCurve, tex: 'roofTile' },
    // main ridge beam (正脊)
    { p: [0, roofBaseY + roofH + 0.04, 0], s: [roofW * 0.49, 0.32, 0.38], c: L.ridgeDark, bevel: true },
    { p: [0, roofBaseY + roofH + 0.22, 0], s: [roofW * 0.46, 0.10, 0.26], c: 0x52565c },
  );
  // 吻獸 dragon ridge finials at both ends of main ridge
  for (const sx of [-1, 1]) {
    p.push(
      { p: [sx * 3.96, roofBaseY + roofH + 0.26, 0], s: [0.44, 0.56, 0.36], c: 0x2a2d30, bevel: true },
      { p: [sx * 3.82, roofBaseY + roofH + 0.56, 0], s: [0.24, 0.26, 0.24], c: 0x3b3f44, sphere: true, detail: 0 },
      { p: [sx * 4.14, roofBaseY + roofH + 0.44, 0], s: [0.22, 0.14, 0.22], c: L.gold },
    );
  }
  // exact hip-ridge curve points matching kit.ts makeEave()
  const hipPt = (sx: -1 | 1, sz: -1 | 1, u: number): [number, number, number] => {
    const ax = 0.24 + 0.26 * u, az = 0.5 * u;
    const sag = roofCurve * 4 * u * (1 - u);
    const cf = ax > 0.35 && az > 0.35 ? ((ax - 0.35) / 0.15) * ((az - 0.35) / 0.15) : 0;
    const yn = 0.5 - u - sag + 0.14 * cf;
    return [sx * ax * roofW, roofBaseY + roofH / 2 + yn * roofH + 0.06, sz * az * roofD];
  };
  // 4 垂脊 hip ridges & 5 roof beasts (仙人走獸) on each upturned corner
  for (const sx of [-1, 1] as const) for (const sz of [-1, 1] as const) {
    const p0 = hipPt(sx, sz, 0);
    const p1 = hipPt(sx, sz, 0.35);
    const p2 = hipPt(sx, sz, 0.72);
    const p3 = hipPt(sx, sz, 1.0);
    p.push(
      strut(p0, p1, 0.20, 0.22, L.ridgeDark),
      strut(p1, p2, 0.20, 0.22, L.ridgeDark),
      strut(p2, p3, 0.22, 0.24, L.ridgeDark),
    );
    for (let b = 0; b < 5; b++) {
      const bp = hipPt(sx, sz, 0.96 - b * 0.06);
      const sc = b === 0 ? 0.17 : 0.13;
      p.push({ p: [bp[0], bp[1] + 0.14, bp[2]], s: [sc, sc * 1.4, sc], c: b === 0 ? 0x5c6066 : 0x3e4247, bevel: true });
    }
  }

  // flanking crimson campus walls (x = ±9.8) with stone plinth, carved brick shadow frame, and grey tile coping
  for (const sx of [-1, 1]) {
    p.push(
      { p: [sx * 9.8, 0.22, 0], s: [4.9, 0.44, 0.68], c: 0x6b6860, tex: 'ashlarStone' },
      { p: [sx * 9.8, 1.66, 0], s: [4.8, 2.50, 0.54], c: 0x8a3a2c, tex: 'palaceWall' },
      { p: [sx * 9.8, 1.75, -0.28], s: [3.6, 1.4, 0.05], c: 0x762d22, tex: 'palaceWall' },
      { p: [sx * 9.8, 1.75, -0.31], s: [3.2, 0.06, 0.04], c: 0x9b968a },
      { p: [sx * 9.8, 3.02, 0], s: [5.0, 0.22, 0.72], c: L.greyTile, bevel: true, tex: 'roofTile' },
      { p: [sx * 9.8, 3.17, 0], s: [4.9, 0.12, 0.34], c: L.ridgeDark },
    );
  }

  // twin sculpted Qing stone lions (石獅) at x = ±5.4, z = -6.5
  p.push(...place(stoneLion(false), -5.4, -6.5));
  p.push(...place(stoneLion(true), 5.4, -6.5));
  return p;
}

/** Multi-pane recessed campus window with sill, frame, cross mullions, and lit/dark pane. */
function campusWindow(
  stat: Part[],
  glow: Part[],
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  axis: 'x' | 'z',
  lit: boolean,
  warmTone: boolean,
) {
  const paneCol = lit ? (warmTone ? C.window : 0xf2f0dc) : 0x1b222a;
  if (axis === 'z') {
    const dir = z < 10 ? -1 : 1;
    stat.push(
      { p: [x, y + h / 2 + 0.08, z + dir * 0.06], s: [w + 0.22, 0.12, 0.16], c: L.concrete },
      { p: [x, y - h / 2 - 0.06, z + dir * 0.06], s: [w + 0.16, 0.10, 0.16], c: L.concrete },
      { p: [x, y, z + dir * 0.02], s: [w + 0.08, h + 0.08, 0.07], c: 0x262320 },
      { p: [x, y + 0.12, z + dir * 0.055], s: [w - 0.04, 0.045, 0.03], c: 0xd6cfc0 },
      { p: [x, y, z + dir * 0.055], s: [0.045, h - 0.04, 0.03], c: 0xd6cfc0 },
    );
    (lit ? glow : stat).push({ p: [x, y, z + dir * 0.04], s: [w - 0.06, h - 0.06, 0.025], c: paneCol, noAO: lit });
  } else {
    const dir = x < 0 ? 1 : -1;
    stat.push(
      { p: [x + dir * 0.06, y + h / 2 + 0.08, z], s: [0.16, 0.12, w + 0.22], c: L.concrete },
      { p: [x + dir * 0.06, y - h / 2 - 0.06, z], s: [0.16, 0.10, w + 0.16], c: L.concrete },
      { p: [x + dir * 0.02, y, z], s: [0.07, h + 0.08, w + 0.08], c: 0x262320 },
      { p: [x + dir * 0.055, y + 0.12, z], s: [0.03, 0.045, w - 0.04], c: 0xd6cfc0 },
      { p: [x + dir * 0.055, y, z], s: [0.03, h - 0.04, 0.045], c: 0xd6cfc0 },
    );
    (lit ? glow : stat).push({ p: [x + dir * 0.04, y, z], s: [0.025, h - 0.06, w - 0.06], c: paneCol, noAO: lit });
  }
}

/** Mourning wreath (悼念花圈) on easel stand for Triangle notice board base. */
function mourningWreath(x: number, z: number): Part[] {
  const p: Part[] = [
    // wooden tripod easel stand
    { p: [x - 0.18, 0.36, z + 0.04], s: [0.035, 0.74, 0.035], c: C.wood, rx: 0.18, rz: -0.14 },
    { p: [x + 0.18, 0.36, z + 0.04], s: [0.035, 0.74, 0.035], c: C.wood, rx: 0.18, rz: 0.14 },
    { p: [x, 0.36, z + 0.22], s: [0.035, 0.72, 0.035], c: C.darkWood, rx: -0.35 },
    // wreath torus frame
    { p: [x, 0.44, z], s: [0.64, 0.64, 0.16], c: 0x3b4d34, torus: true, tube: 0.11, seg: 14, detail: 5, rx: -0.22 },
  ];
  // 10 white & pale-yellow paper rosettes around the ring
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rx = Math.cos(a) * 0.30;
    const ry = Math.sin(a) * 0.30 * Math.cos(-0.22);
    const rz = -Math.sin(a) * 0.30 * Math.sin(-0.22);
    p.push({
      p: [x + rx, 0.44 + ry, z + rz - 0.04],
      s: [0.13, 0.13, 0.09],
      c: i % 3 === 0 ? 0xead888 : 0xf4f0e4,
      sphere: true,
      detail: 0,
    });
  }
  // black & white mourning ribbons (輓帶)
  p.push(
    { p: [x, 0.70, z - 0.10], s: [0.14, 0.08, 0.05], c: 0x1a1a1c },
    { p: [x - 0.07, 0.46, z - 0.08], s: [0.06, 0.44, 0.02], c: 0x1a1a1c, rz: 0.12, rx: -0.22 },
    { p: [x + 0.07, 0.46, z - 0.08], s: [0.06, 0.44, 0.02], c: 0xebe7dc, rz: -0.12, rx: -0.22 },
  );
  return p;
}

/** Complete Peking University campus architecture: North Red-Brick Dorm, West/East Wings, Triangle Gallery, Flowerbeds, Benches, Guardhouse. */
export function campusSceneArchitecture(aftermath: boolean): { stat: Part[]; glow: Part[] } {
  const stat: Part[] = [];
  const glow: Part[] = [];
  const r = rng(42);

  // 1. Campus Lawn, Paved Paths, Stone Curbs & Flowerbeds
  stat.push(
    { p: [0, -0.05, 0], s: [70, 0.1, 70], c: aftermath ? 0x3b3d32 : 0x26271f },
    { p: [0, 0.01, -4], s: [5.2, 0.04, 40], c: 0x3d3b37 },                   // central north-south stone walk
    { p: [0, 0.01, 4.2], s: [32, 0.04, 4.0], c: 0x3d3b37 },                  // east-west dorm promenade
    { p: [2, 0.015, -4.8], s: [7.6, 0.04, 2.8], c: 0x45423d },                // Triangle gallery apron
  );
  for (const sx of [-1, 1]) {
    stat.push({ p: [sx * 2.66, 0.05, -6.5], s: [0.16, 0.10, 29.0], c: 0x6f6b62 });
  }
  // raised stone-bordered flowerbeds with low shrubs (clear of board [2,-4], lin [5,-2], zhou [-6,3])
  const beds: [number, number, number][] = [
    [-4.2, -10.2, 4.4],
    [4.2, -10.2, 4.4],
    [-4.2, -3.8, 4.2],
  ];
  for (const [bx, bz, bl] of beds) {
    stat.push(
      { p: [bx, 0.18, bz], s: [1.56, 0.36, bl], c: 0x6b675e, bevel: true },
      { p: [bx, 0.34, bz], s: [1.34, 0.08, bl - 0.22], c: 0x2e2820 },
    );
    for (let k = -1.4; k <= 1.45; k += 0.95) {
      stat.push({
        p: [bx + (r() - 0.5) * 0.18, 0.52, bz + k],
        s: [0.68, 0.44, 0.68],
        c: aftermath ? 0x3c4d32 : 0x304528,
        sphere: true,
        detail: 1,
      });
    }
  }

  // 2. North Dormitory Building (北大紅磚宿舍樓, centered x=0, z=12, w=36, h=15.5, d=8.5, south wall z=7.75)
  stat.push(
    { p: [0, 0.45, 12], s: [36.4, 0.90, 8.9], c: 0x5c5a54, tex: 'ashlarStone' },   // stone plinth
    { p: [0, 8.20, 12], s: [36.0, 14.6, 8.5], c: L.brickRed, tex: 'redBrick' },    // red brick main body
    { p: [0, 15.38, 12], s: [36.9, 0.38, 9.2], c: 0x4b4742, bevel: true },         // cornice
    { p: [0, 16.85, 12], s: [9.6, 2.7, 37.0], c: C.slate, prism: true, ry: H, tex: 'roofTile' }, // pitched roof
    { p: [0, 18.22, 12], s: [37.0, 0.22, 0.34], c: L.ridgeDark },                  // ridge cap
  );
  for (const py of [3.2, 6.2, 9.2, 12.2]) {
    stat.push({ p: [0, py, 12], s: [36.26, 0.18, 8.70], c: L.concrete, tex: 'plaster' }); // floor stringcourses
  }
  for (const px of [-17.5, -13.9, -9.0, -3.2, 3.2, 9.0, 13.9, 17.5]) {
    stat.push({ p: [px, 8.2, 7.72], s: [0.56, 14.5, 0.22], c: L.brickRedDark, tex: 'redBrick' }); // brick pilasters
  }
  // Galvanized steel rainwater downspouts flanking dorm bays
  for (const dx of [-17.2, -3.55, 3.55, 17.2]) {
    stat.push({ p: [dx, 8.0, 7.64], s: [0.10, 14.6, 0.10], c: 0x45494e, cyl: true, seg: 6 });
  }
  // 4 brick chimneys + 3 dormers (老虎窗)
  for (const cx of [-12, -4, 4, 12]) {
    stat.push(
      { p: [cx, 18.3, 12.6], s: [0.64, 1.8, 0.64], c: L.brickRedDark, bevel: true, tex: 'redBrick' },
      { p: [cx, 19.24, 12.6], s: [0.76, 0.12, 0.76], c: 0x3b3835 },
    );
  }
  for (const dx of [-9, 0, 9]) {
    stat.push(
      { p: [dx, 16.45, 9.45], s: [1.35, 1.10, 1.30], c: L.brickRed, tex: 'redBrick' },
      { p: [dx, 17.16, 9.45], s: [1.56, 0.48, 1.50], c: L.ridgeDark, prism: true, tex: 'roofTile' },
      { p: [dx, 16.45, 8.78], s: [0.78, 0.68, 0.05], c: 0x1e242c },
    );
  }
  // central entrance porch (x=0, z=7.4) with canopy, twin pillars, open double doors, steps, overhead lamp
  stat.push(
    { p: [0, 0.14, 7.20], s: [3.8, 0.28, 1.50], c: 0x847f75, bevel: true },  // step landing
    { p: [0, 3.08, 7.05], s: [3.9, 0.24, 1.65], c: 0x8b867b, bevel: true },  // concrete canopy
    { p: [-1.55, 1.64, 6.50], s: [0.24, 2.76, 0.24], c: L.concrete, cyl: true, seg: 8 },
    { p: [1.55, 1.64, 6.50], s: [0.24, 2.76, 0.24], c: L.concrete, cyl: true, seg: 8 },
    { p: [0, 1.56, 7.76], s: [2.20, 2.68, 0.24], c: 0x19130e },              // recessed doorway
    { p: [-0.96, 1.52, 7.50], s: [0.95, 2.52, 0.08], c: 0x5c3620, ry: -0.46 },
    { p: [0.96, 1.52, 7.50], s: [0.95, 2.52, 0.08], c: 0x5c3620, ry: 0.46 },
  );
  (aftermath ? stat : glow).push({ p: [0, 2.90, 6.65], s: [0.46, 0.18, 0.22], c: aftermath ? 0x52524c : 0xfff0b8, noAO: !aftermath });

  // 5 floors x 12 columns of deep-set windows + floors 2-5 balconies with laundry/washbasins/thermoses
  const winCols = [-15.6, -12.6, -11.3, -6.7, -5.3, -0.7, 0.7, 5.3, 6.7, 11.3, 12.6, 15.6];
  for (let f = 0; f < 5; f++) {
    const wy = 1.68 + f * 3.0;
    for (const wx of winCols) {
      if (f === 0 && Math.abs(wx) < 1.2) continue; // central entrance bay on ground floor
      const lit = !aftermath && r() < 0.45;
      campusWindow(stat, glow, wx, wy, 7.74, 1.04, 1.42, 'z', lit, r() < 0.72);
    }
  }
  const laundryCols = [0xe8e2d4, 0x4b627a, 0x5c6b4d, 0x8f4038, 0xb8ad92];
  for (let f = 1; f < 5; f++) {
    const by = 1.68 + f * 3.0;
    for (const bx of [-12, -6, 0, 6, 12]) {
      stat.push(
        { p: [bx, by - 0.84, 7.28], s: [3.0, 0.16, 0.96], c: 0x6e6a61, bevel: true },
        { p: [bx, by - 0.34, 6.84], s: [3.0, 0.06, 0.06], c: 0x262a2e },
        { p: [bx - 1.47, by - 0.34, 7.28], s: [0.06, 0.06, 0.92], c: 0x262a2e },
        { p: [bx + 1.47, by - 0.34, 7.28], s: [0.06, 0.06, 0.92], c: 0x262a2e },
      );
      for (const rx of [-1.46, -0.73, 0, 0.73, 1.46]) {
        stat.push({ p: [bx + rx, by - 0.56, 6.84], s: [0.045, 0.48, 0.045], c: 0x262a2e });
      }
      if (!aftermath) {
        // hanging laundry shirts/towels
        if (r() < 0.8) {
          stat.push({ p: [bx, by + 0.24, 7.12], s: [2.5, 0.02, 0.02], c: 0x99958c });
          for (let k = -1; k <= 1; k++) {
            if (r() < 0.72) {
              stat.push({
                p: [bx + k * 0.68, by - 0.04, 7.12],
                s: [0.40, 0.52, 0.04],
                c: laundryCols[Math.floor(r() * laundryCols.length)],
              });
            }
          }
        }
        // enamel washbasins & thermos flasks on balcony ledges
        if (r() < 0.65) {
          stat.push(
            { p: [bx - 0.95, by - 0.70, 7.15], s: [0.34, 0.11, 0.34], c: C.enamel, cyl: true, seg: 8, top: 1.25 },
            { p: [bx - 0.95, by - 0.64, 7.15], s: [0.42, 0.02, 0.42], c: 0x26446e, cyl: true, seg: 8 },
          );
        }
        if (r() < 0.60) {
          stat.push(
            { p: [bx + 0.98, by - 0.58, 7.08], s: [0.15, 0.34, 0.15], c: r() < 0.5 ? 0xa62e24 : 0x3b6e52, cyl: true, seg: 6 },
            { p: [bx + 0.98, by - 0.39, 7.08], s: [0.14, 0.06, 0.14], c: C.chrome, cyl: true, seg: 6, top: 0.55 },
          );
        }
      }
    }
  }

  // 3. West Teaching Building (灰磚教學樓, x=-22, z=-2, w=8.5, h=12.5, d=24, east facade at x=-17.75)
  stat.push(
    { p: [-22, 0.40, -2], s: [8.9, 0.80, 24.4], c: 0x62605a, tex: 'ashlarStone' },
    { p: [-22, 6.65, -2], s: [8.5, 11.7, 24.0], c: L.brickGrey, tex: 'qingBrick' },
    { p: [-22, 12.40, -2], s: [9.1, 0.32, 24.6], c: 0x3e4246, bevel: true },
    { p: [-22, 13.75, -2], s: [25.2, 2.3, 9.6], c: L.greyTile, eave: true, curve: 0.16, ry: H, tex: 'roofTile' },
    { p: [-22, 14.95, -2], s: [0.34, 0.24, 12.2], c: L.ridgeDark },
    { p: [-22, 15.14, -8.08], s: [0.32, 0.34, 0.34], c: 0x2c2f33, bevel: true },
    { p: [-22, 15.14, 4.08], s: [0.32, 0.34, 0.34], c: 0x2c2f33, bevel: true },
  );
  for (const py of [3.3, 6.4, 9.5]) {
    stat.push({ p: [-22, py, -2], s: [8.68, 0.16, 24.18], c: L.concrete, tex: 'plaster' });
  }
  for (let pz = -13.4; pz <= 9.5; pz += 4.8) {
    stat.push({ p: [-17.72, 6.65, pz], s: [0.22, 11.6, 0.54], c: L.brickGreyDark, tex: 'qingBrick' });
  }
  // Exterior steel downspouts & East entrance transom frame
  for (const dz of [-13.6, 9.6]) {
    stat.push({ p: [-17.64, 6.4, dz], s: [0.09, 12.0, 0.09], c: 0x3e4246, cyl: true, seg: 6 });
  }
  // West Teaching Building entrance portico facing east (+x)
  stat.push(
    { p: [-17.42, 0.14, -2], s: [1.1, 0.28, 3.2], c: 0x7c7870, bevel: true, tex: 'ashlarStone' },
    { p: [-17.35, 3.12, -2], s: [1.2, 0.22, 3.4], c: L.concrete, bevel: true },
    { p: [-16.90, 1.65, -3.2], s: [0.22, 2.76, 0.22], c: L.concrete, cyl: true, seg: 8 },
    { p: [-16.90, 1.65, -0.8], s: [0.22, 2.76, 0.22], c: L.concrete, cyl: true, seg: 8 },
    { p: [-17.74, 1.56, -2], s: [0.20, 2.66, 2.0], c: 0x1d1612 },
    { p: [-17.68, 2.66, -2], s: [0.08, 0.42, 1.85], c: 0xd6cfc0 },
  );
  (aftermath ? stat : glow).push({ p: [-17.15, 2.95, -2], s: [0.22, 0.16, 0.42], c: aftermath ? 0x52524c : 0xfff0b8, noAO: !aftermath });
  for (let f = 0; f < 4; f++) {
    const wy = 1.75 + f * 3.05;
    for (const wz of [-11.4, -8.6, -5.6, -2.0, 1.6, 4.6, 7.4]) {
      if (f === 0 && Math.abs(wz + 2) < 1.5) continue;
      campusWindow(stat, glow, -17.74, wy, wz, 1.18, 1.44, 'x', !aftermath && r() < 0.38, r() < 0.7);
    }
  }

  // 4. East Library / Reading Wing (x=22, z=-2, w=8.5, h=9.8, d=24, west facade at x=17.75)
  stat.push(
    { p: [22, 0.36, -2], s: [8.9, 0.72, 24.4], c: 0x67645c, tex: 'ashlarStone' },
    { p: [22, 5.26, -2], s: [8.5, 9.08, 24.0], c: L.plasterWarm, tex: 'plaster' },
    { p: [22, 9.72, -2], s: [9.1, 0.30, 24.6], c: 0x4b4640, bevel: true },
    { p: [22, 10.95, -2], s: [25.2, 2.2, 9.6], c: L.greyTile, eave: true, curve: 0.16, ry: H, tex: 'roofTile' },
    { p: [22, 12.10, -2], s: [0.34, 0.24, 12.2], c: L.ridgeDark },
    { p: [22, 12.28, -8.08], s: [0.32, 0.32, 0.34], c: 0x2c2f33, bevel: true },
    { p: [22, 12.28, 4.08], s: [0.32, 0.32, 0.34], c: 0x2c2f33, bevel: true },
  );
  for (const py of [3.4, 6.6]) {
    stat.push({ p: [22, py, -2], s: [8.68, 0.15, 24.18], c: 0x777164, tex: 'plaster' });
  }
  for (let pz = -13.4; pz <= 9.5; pz += 4.8) {
    stat.push({ p: [17.72, 5.26, pz], s: [0.20, 8.9, 0.50], c: 0x7a7364, tex: 'plaster' });
  }
  stat.push(
    { p: [17.42, 0.14, -2], s: [1.1, 0.28, 3.2], c: 0x7c7870, bevel: true },
    { p: [17.35, 3.06, -2], s: [1.2, 0.22, 3.4], c: 0x928c7e, bevel: true },
    { p: [16.90, 1.62, -3.2], s: [0.22, 2.70, 0.22], c: 0x928c7e, cyl: true, seg: 8 },
    { p: [16.90, 1.62, -0.8], s: [0.22, 2.70, 0.22], c: 0x928c7e, cyl: true, seg: 8 },
    { p: [17.74, 1.54, -2], s: [0.20, 2.60, 2.0], c: 0x241912 },
  );
  for (let f = 0; f < 3; f++) {
    const wy = 1.80 + f * 3.10;
    for (const wz of [-11.4, -8.6, -5.6, -2.0, 1.6, 4.6, 7.4]) {
      if (f === 0 && Math.abs(wz + 2) < 1.5) continue;
      campusWindow(stat, glow, 17.74, wy, wz, 1.24, 1.55, 'x', !aftermath && r() < 0.45, true);
    }
  }

  // 5. "Triangle" Notice Board Gallery (三角地布告欄, x=2, z=-4.4)
  // Keeps main backing at (2, 1.4, -4.4) (w=6.6, h=2.9) flush behind PlaneGeometry(6.2, 2.6) at (2, 1.4, -4.54)
  stat.push(
    { p: [2, 1.40, -4.38], s: [6.56, 2.88, 0.22], c: 0x4b3320 },
    { p: [2, 2.90, -4.42], s: [7.2, 0.14, 1.28], c: 0x3b2818 },
    { p: [2, 3.24, -4.42], s: [1.48, 0.56, 7.48], c: 0x43474b, prism: true, ry: H, tex: 'roofTile' },
    { p: [2, 3.54, -4.42], s: [7.52, 0.10, 0.16], c: L.ridgeDark },
    // bottom reading ledge & side leaflet shelf (outside poster plane x = -1.1..5.1)
    { p: [2, 0.10, -4.52], s: [6.7, 0.12, 0.34], c: 0x422d1c },
    { p: [-1.72, 0.90, -4.44], s: [0.44, 0.06, 0.52], c: C.wood },
    { p: [-1.72, 0.98, -4.44], s: [0.24, 0.10, 0.32], c: 0xf0ece0 },
  );
  // 4 carved wooden support posts on stone bases outside the 6.2m poster plane
  for (const px of [-1.42, 5.42]) for (const pz of [-4.62, -4.18]) {
    stat.push(
      { p: [px, 0.14, pz], s: [0.24, 0.28, 0.24], c: 0x76726a, bevel: true },
      { p: [px, 1.60, pz], s: [0.14, 2.86, 0.14], c: 0x4f3522 },
    );
  }
  // loudspeaker pole at (-3, 3, -5)
  stat.push(
    { p: [-3, 3.0, -5], s: [0.12, 6.0, 0.12], c: 0x404240, cyl: true, seg: 8 },
    { p: [-2.68, 5.62, -5.0], s: [0.46, 0.36, 0.36], c: 0x6b6f63, ry: 0.6, cyl: true, top: 0.32 },
    { p: [-3.30, 5.62, -5.0], s: [0.46, 0.36, 0.36], c: 0x6b6f63, ry: -2.5, cyl: true, top: 0.32 },
  );
  if (!aftermath) {
    for (const wx of [-0.95, 2.0, 4.95]) stat.push(...mourningWreath(wx, -4.82));
  }

  // 6. 4 Carved Stone Benches ([±8.5, -2], [±8.5, -9.5])
  for (const [bx, bz] of [[-8.5, -2], [8.5, -2], [-8.5, -9.5], [8.5, -9.5]]) {
    stat.push(
      { p: [bx, 0.44, bz], s: [1.66, 0.12, 0.52], c: 0x8d8980, bevel: true },
      { p: [bx, 0.72, bz + 0.22], s: [1.62, 0.36, 0.10], c: 0x827e75, bevel: true },
      { p: [bx - 0.56, 0.20, bz], s: [0.18, 0.40, 0.44], c: 0x6f6c64, bevel: true },
      { p: [bx + 0.56, 0.20, bz], s: [0.18, 0.40, 0.44], c: 0x6f6c64, bevel: true },
    );
  }

  // 7. West Gate Guardhouse (x=-10.5, z=-14.2), Bicycle Parking Shed (x=6..15.6, z=-13), and Flanking Red Campus Walls
  stat.push(
    { p: [-10.5, 0.18, -14.2], s: [3.4, 0.36, 2.7], c: 0x6e6b62, tex: 'ashlarStone' },
    { p: [-10.5, 1.48, -14.2], s: [3.1, 2.36, 2.4], c: C.plaster, tex: 'plaster' },
    { p: [-10.5, 2.98, -14.2], s: [3.8, 0.85, 3.1], c: L.greyTile, eave: true, curve: 0.14, tex: 'roofTile' },
    { p: [-10.5, 3.44, -14.2], s: [1.85, 0.14, 0.18], c: L.ridgeDark },
    { p: [-8.94, 1.32, -14.2], s: [0.06, 2.05, 0.95], c: L.door },           // guardhouse east door
    { p: [-10.5, 1.62, -15.41], s: [1.48, 0.96, 0.06], c: 0x2b2824 },        // south window frame
    { p: [-10.5, 1.62, -15.44], s: [0.04, 0.90, 0.03], c: 0xd6cfc0 },        // window mullion
  );
  (aftermath ? stat : glow).push({ p: [-10.5, 1.62, -15.43], s: [1.38, 0.86, 0.03], c: aftermath ? 0x1d2229 : 0xfff0b0, noAO: !aftermath });

  // bicycle parking shed roof (車棚) over east parked bicycles at x=6.0..15.6, z=-13.0
  stat.push({ p: [10.8, 2.24, -13.0], s: [9.8, 0.09, 2.1], c: 0x49535c, rx: 0.08 });
  for (const sx of [6.2, 10.8, 15.4]) for (const sz of [-12.25, -13.75]) {
    stat.push({ p: [sx, 1.12, sz], s: [0.07, 2.24, 0.07], c: 0x3b4044, cyl: true, seg: 6 });
  }

  // outer campus red walls with stone plinth, pilasters, recessed panel relief & grey tile coping
  for (const sx of [-1, 1]) {
    stat.push(
      { p: [sx * 24, 0.22, -16], s: [24.2, 0.44, 0.68], c: 0x6b6860, tex: 'ashlarStone' },
      { p: [sx * 24, 1.66, -16], s: [24.0, 2.50, 0.54], c: 0x8a3a2c, tex: 'palaceWall' },
      { p: [sx * 24, 3.02, -16], s: [24.2, 0.22, 0.72], c: L.greyTile, bevel: true, tex: 'roofTile' },
      { p: [sx * 24, 3.17, -16], s: [24.0, 0.10, 0.28], c: L.ridgeDark },
    );
    for (let wx = 14; wx <= 34; wx += 4) {
      stat.push({ p: [sx * wx, 1.66, -16], s: [0.36, 2.54, 0.64], c: 0x752e22, tex: 'palaceWall' });
      if (wx < 34) {
        stat.push({ p: [sx * (wx + 2), 1.68, -16.29], s: [2.8, 1.35, 0.06], c: 0x782e24, tex: 'palaceWall' });
      }
    }
  }

  return { stat, glow };
}

/** Goddess of Democracy (民主女神像, ~12.8m total height, main front faces -z). */
export function democracyStatue(): Part[] {
  const pipe = 0x70767a, clamp = 0x484d52, deck = 0x7a5c3a;
  const wMain = 0xeae6da, wHi = 0xf4f1e6, wSh = 0xded9cc, wDeep = 0xcfc9ba;
  const p: Part[] = [];

  // 1. 2.5m Steel-Pipe Scaffold Base (鋼管腳手架)
  for (const x of [-1.9, 0, 1.9]) for (const z of [-1.9, 0, 1.9]) {
    p.push(
      { p: [x, 0.04, z], s: [0.22, 0.08, 0.22], c: clamp },
      { p: [x, 1.28, z], s: [0.09, 2.56, 0.09], c: pipe, cyl: true, seg: 6 },
    );
  }
  for (const y of [0.55, 1.15, 1.75, 2.40]) {
    for (const sg of [-1, 1]) {
      p.push(
        { p: [0, y, sg * 1.9], s: [3.92, 0.065, 0.065], c: pipe },
        { p: [sg * 1.9, y, 0], s: [0.065, 0.065, 3.92], c: pipe },
      );
      for (const end of [-1.9, 0, 1.9]) {
        p.push(
          { p: [end, y, sg * 1.9], s: [0.13, 0.11, 0.13], c: clamp },
          { p: [sg * 1.9, y, end], s: [0.13, 0.11, 0.13], c: clamp },
        );
      }
    }
  }
  for (const sg of [-1, 1]) {
    p.push(
      { p: [0, 1.25, sg * 1.9], s: [4.2, 0.055, 0.055], c: pipe, rz: 0.55 },
      { p: [0, 1.25, sg * 1.9], s: [4.2, 0.055, 0.055], c: pipe, rz: -0.55 },
      { p: [sg * 1.9, 1.25, 0], s: [0.055, 0.055, 4.2], c: pipe, rx: 0.55 },
      { p: [sg * 1.9, 1.25, 0], s: [0.055, 0.055, 4.2], c: pipe, rx: -0.55 },
    );
  }
  // planked timber deck
  for (let i = 0; i < 8; i++) {
    p.push({ p: [-1.75 + i * 0.50, 2.48, 0], s: [0.46, 0.11, 4.14], c: i % 2 ? deck : 0x6d5234 });
  }
  // festive red-and-white cloth skirt banner around upper scaffold rail
  for (const sg of [-1, 1]) {
    p.push(
      { p: [0, 2.22, sg * 1.95], s: [3.96, 0.34, 0.03], c: 0xb82820 },
      { p: [0, 2.41, sg * 1.955], s: [3.96, 0.08, 0.03], c: 0xf0ebe0 },
      { p: [sg * 1.95, 2.22, 0], s: [0.03, 0.34, 3.96], c: 0xb82820 },
      { p: [sg * 1.955, 2.41, 0], s: [0.03, 0.08, 3.96], c: 0xf0ebe0 },
    );
  }

  // 2. 3-Tier Warm Ivory Plaster Pedestal (y = 2.54 .. 4.15)
  p.push(
    { p: [0, 2.82, 0], s: [3.26, 0.56, 3.26], c: wSh, bevel: true },
    { p: [0, 3.12, 0], s: [3.38, 0.10, 3.38], c: wMain, bevel: true },
    { p: [0, 3.40, 0], s: [2.56, 0.52, 2.56], c: wMain, bevel: true },
    { p: [0, 3.68, 0], s: [2.68, 0.10, 2.68], c: wHi, bevel: true },
    { p: [0, 3.91, 0], s: [2.04, 0.44, 2.04], c: wSh, bevel: true },
    { p: [0, 4.12, 0], s: [2.14, 0.08, 2.14], c: wMain, bevel: true },
  );
  for (const sg of [-1, 1]) {
    p.push(
      { p: [0, 2.82, sg * 1.64], s: [2.50, 0.36, 0.04], c: wDeep },
      { p: [sg * 1.64, 2.82, 0], s: [0.04, 0.36, 2.50], c: wDeep },
      { p: [0, 3.40, sg * 1.29], s: [1.90, 0.34, 0.04], c: wSh },
      { p: [sg * 1.29, 3.40, 0], s: [0.04, 0.34, 1.90], c: wSh },
    );
  }

  // 3. Sculpted Classical Draped Figure (y = 4.15 .. 10.35)
  p.push(
    { p: [0, 4.30, 0.02], s: [1.62, 0.32, 1.40], c: wSh, cyl: true, seg: 14, top: 0.88 },
    { p: [0, 6.46, 0.02], s: [1.46, 4.60, 1.24], c: wMain, cyl: true, seg: 14, top: 0.60 },
  );
  // 8 vertical fluted robe folds around the skirt
  const foldAngles = [0, 0.48, -0.48, 1.05, -1.05, 2.35, -2.35, Math.PI];
  for (let i = 0; i < foldAngles.length; i++) {
    const a = foldAngles[i];
    const r0 = 0.58 + (i === 7 ? 0.14 : 0);
    const fx = Math.sin(a) * r0;
    const fz = -Math.cos(a) * r0 * 0.86;
    p.push({
      p: [fx, 5.75, fz],
      s: [0.24, 3.15, 0.24],
      c: i % 2 === 0 ? wHi : wSh,
      cyl: true,
      seg: 8,
      top: 0.62,
      rx: Math.cos(a) * 0.04,
      rz: Math.sin(a) * 0.04,
    });
  }
  // contrapposto knee contour (right knee slightly forward)
  p.push(
    { p: [-0.24, 5.72, -0.34], s: [0.36, 0.82, 0.34], c: wHi, sphere: true, detail: 1 },
    { p: [-0.24, 5.00, -0.26], s: [0.32, 1.30, 0.32], c: wMain, cyl: true, seg: 8, top: 0.85, rx: 0.08 },
    // gathered waist sash + trailing hip knot
    { p: [0, 7.36, -0.02], s: [1.14, 0.88, 1.10], c: wSh, torus: true, tube: 0.10, seg: 14, detail: 5, rx: H + 0.08 },
    { p: [0.44, 6.82, -0.22], s: [0.22, 0.96, 0.18], c: wHi, wedge: true, ry: 0.6, rz: -0.15 },
    // sculpted upper torso, bust & shoulder yoke
    { p: [0, 8.20, -0.02], s: [1.14, 1.48, 0.78], c: wMain, cyl: true, seg: 12, top: 1.08 },
    { p: [0, 8.40, -0.18], s: [0.94, 0.62, 0.46], c: wHi, sphere: true, detail: 1 },
    { p: [0, 8.84, -0.02], s: [1.54, 0.38, 0.66], c: wMain, cyl: true, seg: 10, top: 0.88 },
  );
  // diagonal toga/shawl drape cascading from left shoulder (+x) across chest & back to right hip (-x)
  for (const sz of [-1, 1]) {
    p.push(
      limb([0.46, 8.85, sz * 0.24], [-0.48, 7.05, sz * 0.28], 0.18, 0.14, wHi, 8),
      limb([0.34, 8.70, sz * 0.27], [-0.46, 7.32, sz * 0.30], 0.14, 0.12, wSh, 8),
    );
  }

  // neck & expressive sculpted head (y = 8.95 .. 10.22)
  p.push(
    { p: [0, 9.16, -0.04], s: [0.36, 0.46, 0.36], c: wMain, cyl: true, seg: 10 },
    { p: [0, 9.74, -0.06], s: [0.64, 0.78, 0.72], c: wHi, sphere: true, detail: 2 },
    { p: [0, 9.48, -0.24], s: [0.42, 0.32, 0.36], c: wHi, sphere: true, detail: 1 }, // jawline & chin
    { p: [-0.15, 9.66, -0.30], s: [0.22, 0.18, 0.18], c: wHi, sphere: true, detail: 1 },
    { p: [0.15, 9.66, -0.30], s: [0.22, 0.18, 0.18], c: wHi, sphere: true, detail: 1 },
    { p: [0, 9.82, -0.34], s: [0.38, 0.10, 0.14], c: wMain, bevel: true }, // brow ridge
    { p: [0, 9.70, -0.40], s: [0.10, 0.24, 0.16], c: wHi, rx: -0.24, bevel: true }, // nose bridge
    { p: [0, 9.52, -0.38], s: [0.16, 0.06, 0.08], c: wSh }, // sculpted lips
  );
  // 10 windswept sculpted hair curls sweeping back toward +z and framing temples
  const hairCurls: [number, number, number, number][] = [
    [0, 10.12, 0.04, 0.42],
    [-0.24, 10.02, 0.12, 0.34],
    [0.24, 10.02, 0.12, 0.34],
    [-0.34, 9.76, 0.08, 0.30],
    [0.34, 9.76, 0.08, 0.30],
    [-0.22, 9.82, 0.32, 0.34],
    [0.22, 9.82, 0.32, 0.34],
    [0, 9.88, 0.36, 0.38],
    [-0.18, 9.46, 0.28, 0.28],
    [0.18, 9.46, 0.28, 0.28],
  ];
  for (const [hx, hy, hz, hs] of hairCurls) {
    p.push({ p: [hx, hy, hz], s: [hs, hs * 1.12, hs * 1.25], c: wSh, sphere: true, detail: 1 });
  }

  // 4. Natural Two-Handed Torch Pose (NO crossed X-sticks: right hand upper grip, left hand lower grip)
  const rShoulder: [number, number, number] = [-0.72, 8.76, -0.04];
  const rElbow: [number, number, number] = [-0.88, 9.72, -0.24];
  const rHand: [number, number, number] = [-0.15, 10.95, -0.55];
  const lShoulder: [number, number, number] = [0.72, 8.72, -0.04];
  const lElbow: [number, number, number] = [0.58, 9.35, -0.44];
  const lHand: [number, number, number] = [-0.12, 10.45, -0.52];

  p.push(
    // right arm (upper arm -> elbow -> forearm -> upper torch grip)
    { p: rShoulder, s: [0.38, 0.38, 0.38], c: wMain, sphere: true, detail: 1 },
    limb(rShoulder, rElbow, 0.19, 0.16, wMain, 10),
    { p: rElbow, s: [0.30, 0.30, 0.30], c: wMain, sphere: true, detail: 1 },
    limb(rElbow, rHand, 0.15, 0.12, wHi, 10),
    { p: rHand, s: [0.24, 0.22, 0.24], c: wHi, sphere: true, detail: 1 },
    // left arm (upper arm forward -> elbow -> forearm up -> lower torch grip)
    { p: lShoulder, s: [0.38, 0.38, 0.38], c: wMain, sphere: true, detail: 1 },
    limb(lShoulder, lElbow, 0.19, 0.16, wMain, 10),
    { p: lElbow, s: [0.30, 0.30, 0.30], c: wMain, sphere: true, detail: 1 },
    limb(lElbow, lHand, 0.15, 0.12, wHi, 10),
    { p: lHand, s: [0.24, 0.22, 0.24], c: wHi, sphere: true, detail: 1 },
    // fluted torch shaft, collar, bowl, and multi-tongue sculpted flame (y = 10.15 .. 12.82)
    limb([-0.10, 10.15, -0.50], [-0.18, 11.95, -0.64], 0.11, 0.15, wSh, 10),
    { p: [-0.17, 11.78, -0.63], s: [0.36, 0.36, 0.36], c: wMain, torus: true, tube: 0.08, seg: 12, detail: 4, rx: H },
    { p: [-0.18, 11.98, -0.64], s: [0.46, 0.32, 0.46], c: wMain, cyl: true, seg: 12, top: 1.50 },
    { p: [-0.18, 12.14, -0.64], s: [0.70, 0.70, 0.70], c: wHi, torus: true, tube: 0.08, seg: 14, detail: 5, rx: H },
    // 5-part sculpted flame
    { p: [-0.18, 12.24, -0.64], s: [0.38, 0.36, 0.38], c: 0xfdf4d0, sphere: true, detail: 1, noAO: true },
    { p: [-0.18, 12.48, -0.64], s: [0.36, 0.68, 0.36], c: 0xfdf4d0, cyl: true, seg: 8, top: 0.06, noAO: true },
    { p: [-0.25, 12.42, -0.58], s: [0.22, 0.54, 0.22], c: 0xfbe6a2, cyl: true, seg: 7, top: 0.05, rz: 0.16, rx: 0.12, noAO: true },
    { p: [-0.11, 12.40, -0.58], s: [0.22, 0.50, 0.22], c: 0xfbe6a2, cyl: true, seg: 7, top: 0.05, rz: -0.14, rx: 0.14, noAO: true },
    { p: [-0.18, 12.44, -0.71], s: [0.20, 0.46, 0.20], c: 0xfdf4d0, cyl: true, seg: 7, top: 0.05, rx: -0.14, noAO: true },
  );
  return p;
}

/** Detailed Tiananmen Square camp tent with guy ropes, tent pegs, bamboo poles, quilt, mug, shoes, and pennant. */
export function campTent(color = 0x5c7258): Part[] {
  const flapCol = shade(color, 0.92);
  const ridgeCol = shade(color, 0.85);
  const p: Part[] = [
    { p: [0, 0.02, 0], s: [2.18, 0.04, 2.48], c: 0x353732 },                  // groundsheet
    { p: [0, 0.70, 0], s: [2.22, 1.34, 2.42], c: color, prism: true },         // pitched canvas tarp
    { p: [0, 1.34, 0], s: [0.16, 0.06, 2.48], c: ridgeCol },                   // ridge seam overlap
    { p: [0, 0.54, -1.21], s: [1.22, 0.98, 0.04], c: 0x171916 },               // open doorway shadow
    { p: [-0.71, 0.56, -1.23], s: [0.22, 0.96, 0.06], c: flapCol, rz: -0.24 }, // folded entrance flaps
    { p: [0.71, 0.56, -1.23], s: [0.22, 0.96, 0.06], c: flapCol, rz: 0.24 },
    // bamboo ridge and upright poles
    { p: [0, 1.38, 0], s: [0.05, 0.05, 2.66], c: 0x9b8658 },
    { p: [0, 0.72, -1.24], s: [0.05, 1.44, 0.05], c: 0x9b8658, cyl: true, seg: 5, open: true },
    { p: [0, 0.72, 1.24], s: [0.05, 1.44, 0.05], c: 0x9b8658, cyl: true, seg: 5, open: true },
    // inside rolled quilt + blanket accent
    { p: [0.18, 0.16, -0.35], s: [0.34, 0.88, 0.34], c: 0xd8ceb6, cyl: true, rx: H, seg: 6 },
    { p: [0.18, 0.16, -0.35], s: [0.36, 0.24, 0.36], c: 0x9c463c, cyl: true, rx: H, seg: 6 },
    // enamel mug & canvas Liberation shoes by entrance
    { p: [-0.42, 0.09, -1.32], s: [0.11, 0.14, 0.11], c: 0xebe8dc, cyl: true, seg: 6 },
    { p: [-0.42, 0.16, -1.32], s: [0.115, 0.02, 0.115], c: 0x26446e, cyl: true, seg: 6 },
    { p: [-0.72, 0.05, -1.30], s: [0.10, 0.07, 0.22], c: 0x526242 },
    { p: [-0.72, 0.03, -1.30], s: [0.105, 0.025, 0.23], c: 0xdcd6c4 },
    { p: [-0.57, 0.05, -1.35], s: [0.10, 0.07, 0.22], c: 0x526242, ry: 0.18 },
    { p: [-0.57, 0.03, -1.35], s: [0.105, 0.025, 0.23], c: 0xdcd6c4, ry: 0.18 },
    // college flagpole & pennant
    { p: [1.02, 1.28, -1.10], s: [0.04, 2.56, 0.04], c: 0xa28c5c, cyl: true, seg: 5, open: true },
    { p: [1.24, 2.30, -1.10], s: [0.46, 0.26, 0.02], c: 0xc23024 },
    { p: [1.04, 2.30, -1.10], s: [0.06, 0.26, 0.025], c: 0xf0ece0 },
  ];
  // front/rear ridge guy ropes + 4 side eave guy ropes with wooden pegs
  for (const sz of [-1, 1]) {
    p.push(
      strut([0, 1.38, sz * 1.25], [0, 0.04, sz * 1.56], 0.018, 0.018, 0xb8ad92),
      { p: [0, 0.06, sz * 1.56], s: [0.035, 0.16, 0.035], c: 0x6b4b2e, rx: sz * 0.35 },
    );
    for (const sx of [-1, 1]) {
      p.push(
        strut([sx * 0.62, 0.68, sz * 1.15], [sx * 1.32, 0.04, sz * 1.15], 0.016, 0.016, 0xb8ad92),
        { p: [sx * 1.32, 0.06, sz * 1.15], s: [0.035, 0.16, 0.035], c: 0x6b4b2e, rz: sx * -0.35 },
      );
    }
  }
  return p;
}

/** Makeshift student broadcast post: sunshade, tarpaulin valance, car batteries with jumper cables, mimeograph, tube amp, mic, crate stool, 4-horn mast. */
export function broadcastStation(): Part[] {
  const p: Part[] = [
    // sloped sunshade canopy + wrinkled tarpaulin valance
    { p: [0, 2.58, 0], s: [2.95, 0.07, 2.35], c: 0xc4b898, rx: 0.08 },
    // 4 bamboo posts with node rings
    ...([-1.28, 1.28] as const).flatMap(sx =>
      ([-0.98, 0.98] as const).flatMap(sz => [
        { p: [sx, 1.29, sz] as [number, number, number], s: [0.06, 2.58, 0.06] as [number, number, number], c: 0x8f7a52, cyl: true, seg: 6 },
        { p: [sx, 1.40, sz] as [number, number, number], s: [0.075, 0.04, 0.075] as [number, number, number], c: 0x6e5c3a, cyl: true, seg: 6 },
      ]),
    ),
    // wooden table & apron rails
    { p: [0, 0.80, 0], s: [2.02, 0.06, 1.02], c: 0x6b4b2e, bevel: true },
    { p: [0, 0.72, -0.44], s: [1.82, 0.10, 0.04], c: 0x543a24 },
    { p: [0, 0.72, 0.44], s: [1.82, 0.10, 0.04], c: 0x543a24 },
    { p: [-0.88, 0.40, -0.42], s: [0.07, 0.80, 0.07], c: 0x4c3420 },
    { p: [0.88, 0.40, -0.42], s: [0.07, 0.80, 0.07], c: 0x4c3420 },
    { p: [-0.88, 0.40, 0.42], s: [0.07, 0.80, 0.07], c: 0x4c3420 },
    { p: [0.88, 0.40, 0.42], s: [0.07, 0.80, 0.07], c: 0x4c3420 },
    // stacked lead-acid car batteries with cell caps, terminals & jumper cables
    { p: [-0.56, 0.17, 0.12], s: [0.44, 0.34, 0.30], c: 0x1b1e21, bevel: true },
    { p: [-0.54, 0.51, 0.10], s: [0.40, 0.34, 0.28], c: 0x222528, ry: 0.08, bevel: true },
    { p: [-0.64, 0.70, 0.10], s: [0.065, 0.05, 0.065], c: 0xc22a20 },           // + terminal
    { p: [-0.42, 0.70, 0.10], s: [0.065, 0.05, 0.065], c: 0x646668 },           // - terminal
    strut([-0.64, 0.72, 0.10], [0.22, 0.86, 0.12], 0.026, 0.026, 0xb82820),     // red jumper cable
    strut([-0.42, 0.72, 0.10], [0.26, 0.86, 0.16], 0.026, 0.026, 0x1c1c1e),     // black jumper cable
    // hand-cranked mimeograph machine (手搖油印機) + ink drum + crank + paper reams
    { p: [-0.48, 0.94, 0], s: [0.56, 0.24, 0.44], c: 0x42484d, bevel: true },
    { p: [-0.48, 1.10, 0], s: [0.32, 0.40, 0.32], c: 0x262a2e, cyl: true, rx: H, seg: 10 },
    { p: [-0.82, 1.10, 0], s: [0.06, 0.20, 0.05], c: C.chrome, rx: 0.5 },       // crank arm
    { p: [-0.86, 1.16, 0.08], s: [0.04, 0.04, 0.12], c: 0x202020 },             // crank handle
    { p: [-0.04, 0.88, 0.08], s: [0.26, 0.10, 0.34], c: 0xf0ece0 },            // ream 1
    { p: [-0.02, 0.95, 0.06], s: [0.25, 0.05, 0.33], c: 0xe6e0cf, ry: 0.12 },  // skewed top sheaf
    // vintage tube amplifier with illuminated VU meters, knobs & heat grille
    { p: [0.54, 0.95, 0.04], s: [0.48, 0.24, 0.34], c: 0x2a2e33, bevel: true },
    { p: [0.54, 0.95, -0.14], s: [0.44, 0.18, 0.02], c: 0xcab67c },            // faceplate
    { p: [0.42, 0.98, -0.155], s: [0.10, 0.07, 0.015], c: 0xf6e29c, noAO: true }, // VU meter 1
    { p: [0.55, 0.98, -0.155], s: [0.10, 0.07, 0.015], c: 0xf6e29c, noAO: true }, // VU meter 2
    { p: [0.54, 1.08, 0.04], s: [0.38, 0.02, 0.24], c: 0x191b1d },             // top vent grille
    // table microphone on weighted stand
    { p: [0.36, 0.84, -0.28], s: [0.14, 0.03, 0.14], c: 0x262628, cyl: true, seg: 8 },
    { p: [0.36, 0.98, -0.28], s: [0.028, 0.28, 0.028], c: C.chrome, cyl: true, seg: 6 },
    { p: [0.36, 1.13, -0.32], s: [0.065, 0.085, 0.065], c: 0x333538, sphere: true, detail: 0 },
    // wooden crate stool in front of table
    { p: [0.58, 0.24, -0.74], s: [0.44, 0.46, 0.40], c: 0x7a5938 },
    { p: [0.58, 0.49, -0.74], s: [0.48, 0.05, 0.44], c: 0x8b6742 },
    { p: [0.56, 0.53, -0.74], s: [0.24, 0.03, 0.18], c: 0xe8e2d0, ry: 0.25 },
    // tall 4-horn loudspeaker mast
    { p: [-1.18, 0.16, 0.52], s: [0.32, 0.32, 0.32], c: 0x6b6860, bevel: true },
    { p: [-1.18, 3.00, 0.52], s: [0.14, 6.00, 0.14], c: 0x525550, cyl: true, seg: 8 },
    { p: [-1.18, 5.56, 0.52], s: [0.76, 0.07, 0.76], c: 0x454844 },
  ];
  // wrinkled tarpaulin valance strips along front & sides
  for (let i = 0; i < 6; i++) {
    p.push({
      p: [-1.18 + i * 0.47, 2.38, -1.16 + (i % 2) * 0.03],
      s: [0.46, 0.20 + (i % 3) * 0.04, 0.03],
      c: i % 2 ? 0xb5a888 : 0xc4b898,
      rx: -0.14 + (i % 2) * 0.08,
    });
  }
  for (const sx of [-1.45, 1.45]) for (let i = 0; i < 4; i++) {
    p.push({
      p: [sx, 2.40 + (i % 2) * 0.03, -0.78 + i * 0.52],
      s: [0.03, 0.22, 0.48],
      c: i % 2 ? 0xb5a888 : 0xc4b898,
    });
  }
  // amplifier knobs
  for (let k = 0; k < 4; k++) {
    p.push({ p: [0.39 + k * 0.10, 0.90, -0.155], s: [0.035, 0.025, 0.035], c: 0x161616, cyl: true, rx: H, seg: 6 });
  }
  // 4 directional horn loudspeakers at mast top (N, S, E, W — wide bell faces outward)
  const dirs: [number, number, number, number][] = [
    [0, 0.36, -H, 0],
    [0, -0.36, H, 0],
    [0.36, 0, 0, H],
    [-0.36, 0, 0, -H],
  ];
  for (const [dx, dz, rx, rz] of dirs) {
    p.push(
      { p: [-1.18 + dx, 5.62, 0.52 + dz], s: [0.44, 0.56, 0.44], c: 0x6b7064, cyl: true, rx, rz, seg: 10, top: 0.24 },
      { p: [-1.18 + dx * 0.45, 5.62, 0.52 + dz * 0.45], s: [0.18, 0.18, 0.18], c: 0x454942, sphere: true, detail: 0 },
    );
  }
  return p;
}
