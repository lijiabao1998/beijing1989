// Low-poly landmarks modelled from freely licensed reference photos (see docs/references.md).
// Units: metres. Each builder returns parts centred at the origin with its main facade facing -z (south / outside).
import type { Part } from './kit';

export const L = {
  red: 0x8e2b22, redDark: 0x6e2019, yellowTile: 0xc99a2e, greyTile: 0x4a4e52, marble: 0xd9d6cc,
  beam: 0x2f5a58, beamBlue: 0x2b4870, gold: 0xc8a040, door: 0x7a221a, stone: 0x8d8a82, arch: 0x1a1210,
};

/** Hip-gable style roof: pyramid body + ridge. */
export function roof(y: number, w: number, d: number, h: number, c: number, z = 0): Part[] {
  return [
    { p: [0, y + 0.25, z], s: [w + 0.6, 0.5, d + 0.6], c },               // eave slab
    { p: [0, y + 0.5 + h / 2, z], s: [w, h, d], c, roof: true },
    { p: [0, y + 0.5 + h * 0.72, z], s: [w * 0.5, h * 0.56, d * 0.22], c }, // gable/ridge mass
    { p: [0, y + 0.5 + h, z], s: [w * 0.52, 0.35, 0.4], c: 0x3a3a3a },     // ridge cap
  ];
}

/** 北京大學西校門: three-bay palace-style gate, red columns, grey tile roof, painted beams, two stone lions. */
export function pkuWestGate(): Part[] {
  const p: Part[] = [{ p: [0, 0.25, 0], s: [15, 0.5, 8], c: L.stone }];
  for (const x of [-5.6, -1.9, 1.9, 5.6]) for (const z of [-2.6, 2.6]) p.push({ p: [x, 2.6, z], s: [0.6, 4.2, 0.6], c: L.red, cyl: true, seg: 10 });
  p.push({ p: [0, 2.4, 0], s: [3.4, 3.8, 0.35], c: L.door });            // central doors (open leaves hinted)
  p.push({ p: [-1.2, 2.4, -0.9], s: [0.12, 3.6, 1.6], c: L.door, ry: 0.3 }, { p: [1.2, 2.4, -0.9], s: [0.12, 3.6, 1.6], c: L.door, ry: -0.3 });
  for (const x of [-3.75, 3.75]) p.push({ p: [x, 2.4, 0], s: [3.4, 3.8, 0.5], c: L.redDark });   // side bays: red walls
  for (const x of [-3.75, 3.75]) p.push({ p: [x, 1.0, -0.26], s: [3.0, 1.1, 0.05], c: 0x5e5a52 }); // stone skirting
  p.push({ p: [0, 4.95, 0], s: [12.6, 0.7, 5.8], c: L.beam }, { p: [0, 5.45, 0], s: [13.2, 0.35, 6.4], c: L.beamBlue }); // painted beams / bracket band
  p.push(...roof(5.6, 15.5, 8.6, 3.0, L.greyTile));
  // stone lions on plinths in front (outside)
  for (const sx of [-1, 1]) {
    const x = sx * 5.4, z = -6.5;
    p.push({ p: [x, 0.6, z], s: [1.3, 1.2, 1.9], c: 0x7d7a73 }, { p: [x, 1.55, z + 0.25], s: [0.8, 0.8, 1.2], c: 0x95928a },
      { p: [x, 2.15, z - 0.2], s: [0.75, 0.7, 0.6], c: 0x95928a }, { p: [x, 2.25, z - 0.25], s: [0.95, 0.55, 0.55], c: 0x8a877f });
  }
  return p;
}

/** 天安門城樓: red base with five arches, double-eave yellow roof hall, side walls. Real width ~66 m, height ~34.7 m. */
export function tiananmen(): Part[] {
  const p: Part[] = [];
  p.push({ p: [0, 6.5, 0], s: [66, 13, 37], c: L.red });                 // 城台
  p.push({ p: [0, 13.25, 0], s: [67, 0.5, 38], c: 0x9c7a3a });           // coping
  // five arches on the south face (centre largest)
  for (const [x, w, h] of [[0, 5, 8.8], [-12, 4, 7.4], [12, 4, 7.4], [-23, 3.4, 6.2], [23, 3.4, 6.2]] as [number, number, number][])
    p.push({ p: [x, h / 2, -18.45], s: [w, h, 0.2], c: L.arch });
  p.push({ p: [0, 13.9, -17.6], s: [62, 0.9, 0.3], c: L.marble }, { p: [0, 13.9, 17.6], s: [62, 0.9, 0.3], c: L.marble }); // balustrade
  p.push({ p: [0, 14.0, 0], s: [60, 0.5, 32], c: 0x6d6a62 });
  p.push({ p: [0, 18.2, 0], s: [54, 8, 24], c: L.red });                 // hall
  for (let i = 0; i < 10; i++) p.push({ p: [-25.2 + i * 5.6, 18.2, -12.2], s: [0.9, 8, 0.9], c: 0xa0302a, cyl: true, seg: 8 });
  p.push({ p: [0, 21.8, -12.1], s: [54, 0.9, 0.3], c: L.beam });
  p.push(...roof(22.2, 62, 31, 4.2, L.yellowTile));                       // lower eave
  p.push({ p: [0, 27.3, 0], s: [48, 3.6, 19], c: L.red }, { p: [0, 28.6, -9.6], s: [48, 0.7, 0.3], c: L.beam });
  p.push(...roof(29.0, 56, 27, 5.4, L.yellowTile));                       // upper roof, top ≈ 34.7
  // flanking red walls with yellow coping
  for (const sx of [-1, 1]) p.push({ p: [sx * 120, 5, 4], s: [174, 10, 6], c: L.red }, { p: [sx * 120, 10.3, 4], s: [176, 0.7, 7], c: L.yellowTile });
  // 金水橋 (five white marble bridges) over the moat, and two 華表
  p.push({ p: [0, -0.1, -27], s: [140, 0.2, 7], c: 0x15191c });
  for (const x of [-16, -8, 0, 8, 16]) p.push({ p: [x, 0.35, -27], s: [x === 0 ? 6 : 4, 0.5, 8], c: L.marble });
  p.push({ p: [0, 0.3, -27], s: [130, 0.6, 0.3], c: L.marble });
  for (const x of [-22, 22]) p.push({ p: [x, 0.6, -34], s: [3, 1.2, 3], c: L.marble }, { p: [x, 5.6, -34], s: [1.2, 9.6, 1.2], c: L.marble, cyl: true, seg: 8 }, { p: [x + 0.3, 9.4, -34], s: [2.4, 0.4, 0.5], c: L.marble });
  return p;
}

/** 人民英雄紀念碑: two-tier terrace and a 37.9 m obelisk. */
export function monument(): Part[] {
  const m = L.marble, g = 0xcfcabd;
  const p: Part[] = [
    // lower terrace (two-tier, cross-shaped plan) with balustrades
    { p: [0, 0.75, 0], s: [61, 1.5, 51], c: m }, { p: [0, 0.75, 0], s: [40, 1.5, 61], c: m },
    { p: [0, 2.25, 0], s: [44, 1.5, 36], c: m }, { p: [0, 2.25, 0], s: [30, 1.5, 44], c: m },
    // upper base: Sumeru plinth with relief band + small plinth
    { p: [0, 3.9, 0], s: [17, 1.8, 20], c: g }, { p: [0, 5.3, 0], s: [15.6, 1.0, 18.6], c: 0x9d978a },
    { p: [0, 6.3, 0], s: [14, 1.0, 17], c: g }, { p: [0, 7.4, 0], s: [9, 1.2, 10.5], c: 0xb5b0a3 },
    // stele (slight taper) with inscription panels
    { p: [0, 22, 0], s: [6.2, 28, 7.6], c: 0xc4bfb1 },
    { p: [0, 25, 3.83], s: [2.6, 18, 0.06], c: 0xd8b25a }, { p: [0, 25, -3.83], s: [2.6, 18, 0.06], c: 0x8f8a7e },
    // cap: cornice + 廡殿-style roof
    { p: [0, 36.4, 0], s: [7.4, 0.8, 8.8], c: 0xb0aa9c }, { p: [0, 37.4, 0], s: [8.2, 1.2, 9.6], c: 0x9e988b },
    { p: [0, 39.2, 0], s: [8.4, 2.4, 9.8], c: 0x8b8578, roof: true },
  ];
  for (const [w, d, y] of [[61, 51, 1.85], [44, 36, 3.35]]) for (const sg of [-1, 1]) {
    p.push({ p: [0, y, sg * d / 2], s: [w, 0.7, 0.3], c: 0xe4e0d4 }, { p: [sg * w / 2, y, 0], s: [0.3, 0.7, d], c: 0xe4e0d4 });
  }
  for (const sg of [-1, 1]) p.push({ p: [0, 1.6, sg * 30], s: [10, 0.2, 6], c: 0xb9b4a6 }); // stairs
  return p;
}

/** 人民大會堂 / 中國革命歷史博物館 (facade faces +x; caller mirrors). */
export function greatHall(museum = false): Part[] {
  const wall = museum ? 0xb7a98a : 0xbcae8f, col = 0xe3dac2, trim = 0x9a7f4a;
  const p: Part[] = [
    { p: [0, 1.5, 0], s: [76, 3, 310], c: 0x8f8775 },                          // podium
    { p: [-4, 15, 0], s: [64, 24, 300], c: wall },                             // main block
    { p: [-4, 28, 0], s: [66, 2.2, 304], c: trim },                            // flat roof eave (cornice)
    { p: [-4, 29.6, 0], s: [62, 1.2, 298], c: 0xa79a7b },                      // parapet
    { p: [-12, 33, 0], s: [36, 7, museum ? 70 : 110], c: 0xa99d80 },           // raised centre
  ];
  // pilasters along the facade wings
  for (let z = -145; z <= 145; z += 6) if (Math.abs(z) > 48) p.push({ p: [28.3, 15, z], s: [0.9, 22, 1.4], c: 0xd0c6ab });
  for (let z = -142; z <= 142; z += 6) if (Math.abs(z) > 48) p.push({ p: [28.1, 13, z], s: [0.3, 9, 2.8], c: 0x5c5546 }); // windows (dark bands)
  // central portico: deep shadow, columns, entablature, steps
  p.push({ p: [24, 16, 0], s: [8, 26, 96], c: 0x4c463c });
  p.push({ p: [36, 29, 0], s: [16, 3, 100], c: trim }, { p: [36, 31.2, 0], s: [16, 1.4, 98], c: 0xa79a7b });
  const n = museum ? 8 : 12, span = 84;
  for (let i = 0; i < n; i++) p.push({ p: [42, 15.5, -span / 2 + i * span / (n - 1)], s: [2.4, 25, 2.4], c: col, cyl: true, seg: 8 });
  if (museum) for (const sg of [-1, 1]) for (let i = 0; i < 6; i++) p.push({ p: [30, 15, sg * (60 + i * 7)], s: [2, 22, 2], c: col, cyl: true, seg: 8 }); // open colonnades
  for (let i = 0; i < 4; i++) p.push({ p: [46 + i * 1.6, 0.4 + i * 0.35, 0], s: [1.6, 0.8 + i * 0.7, 80], c: 0xa59d8a });
  return p;
}

/** Articulated trolleybus (two sections + bellows + trolley poles), along +x, ~17 m. */
export function trolleybus(body = 0xd9cfaa, stripe = 0x8c3a2a): Part[] {
  const p: Part[] = [];
  for (const x of [-4.5, 4.5]) {
    p.push({ p: [x, 1.65, 0], s: [8.2, 2.1, 2.5], c: body }, { p: [x, 0.65, 0], s: [8.2, 0.5, 2.5], c: stripe }, { p: [x, 2.8, 0], s: [8, 0.2, 2.4], c: 0x9a9a92 });
    for (const wx of [-2.6, 2.6]) for (const z of [1.2, -1.2]) p.push({ p: [x + wx, 0.45, z], s: [0.95, 0.3, 0.95], c: 0x111111, cyl: true, rx: Math.PI / 2, seg: 10 });
  }
  p.push({ p: [0, 1.6, 0], s: [1, 2.1, 2.3], c: 0x2a2a2a });                          // bellows
  for (const z of [0.35, -0.35]) p.push({ p: [-1.2, 4.3, z], s: [5.6, 0.07, 0.07], c: 0x333333, rz: 0.4 }); // trolley poles to the wire
  return p;
}
export function trolleyWindows(): Part[] {
  const p: Part[] = [];
  for (const x of [-4.5, 4.5]) for (let i = 0; i < 6; i++) for (const z of [1.26, -1.26]) p.push({ p: [x - 3.2 + i * 1.25, 1.95, z], s: [1.05, 0.85, 0.02], c: 0xe8d29a });
  return p;
}

/** 華燈: the multi-globe lamps of the Tiananmen section. Pole part + glow part. */
export function huadengPole(): Part[] { return [{ p: [0, 0.5, 0], s: [1.1, 1, 1.1], c: L.marble }, { p: [0, 4, 0], s: [0.35, 7, 0.35], c: 0x6a6a60, cyl: true, seg: 8 }]; }
export function huadengGlobes(): Part[] {
  const p: Part[] = [{ p: [0, 8.1, 0], s: [0.9, 0.9, 0.9], c: 0xfff3d6, sphere: true }];
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; p.push({ p: [Math.cos(a) * 1.0, 7.2, Math.sin(a) * 1.0], s: [0.6, 0.6, 0.6], c: 0xfff0c8, sphere: true }); }
  return p;
}
