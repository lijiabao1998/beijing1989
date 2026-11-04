import type { Part } from './kit';
import { C } from './kit';
const H = Math.PI / 2;

/** 28-inch bicycle, oriented along +x. Optional rider in period clothes. */
export function bike(rider?: number): Part[] {
  const w = (x: number): Part => ({ p: [x, 0.36, 0], s: [0.72, 0.035, 0.72], c: C.black, cyl: true, rx: H, seg: 12 });
  const parts: Part[] = [
    w(-0.56), w(0.56),
    { p: [0, 0.62, 0], s: [0.95, 0.05, 0.05], c: C.black },               // top tube (28-inch: high, horizontal)
    { p: [-0.1, 0.5, 0], s: [0.05, 0.3, 0.05], c: C.black, rz: 0.3 },     // seat tube
    { p: [0.25, 0.48, 0], s: [0.75, 0.05, 0.05], c: C.black, rz: -0.55 }, // down tube
    { p: [0.5, 0.8, 0], s: [0.05, 0.2, 0.05], c: C.chrome },              // stem
    { p: [0.48, 0.9, 0], s: [0.06, 0.04, 0.5], c: C.chrome },             // handlebar
    { p: [-0.22, 0.78, 0], s: [0.22, 0.05, 0.12], c: 0x2a1a10 },          // saddle
    { p: [-0.55, 0.66, 0], s: [0.38, 0.04, 0.2], c: C.chrome },           // rear rack
    { p: [0.58, 0.72, 0], s: [0.07, 0.07, 0.07], c: C.white },            // bell
  ];
  if (rider !== undefined) parts.push(
    { p: [-0.12, 1.15, 0], s: [0.26, 0.6, 0.38], c: rider },              // jacket
    { p: [-0.1, 1.56, 0], s: [0.2, 0.22, 0.2], c: 0xc8a07a },             // head
    { p: [-0.1, 1.7, 0], s: [0.22, 0.06, 0.22], c: C.black },             // hair
    { p: [0.12, 1.2, 0.14], s: [0.42, 0.08, 0.08], c: rider, rz: -0.3 },  // arms
    { p: [0.12, 1.2, -0.14], s: [0.42, 0.08, 0.08], c: rider, rz: -0.3 },
    { p: [0.02, 0.72, 0.1], s: [0.12, 0.55, 0.12], c: C.navy, rz: 0.4 },  // legs
    { p: [0.02, 0.72, -0.1], s: [0.12, 0.55, 0.12], c: C.navy, rz: -0.2 },
  );
  return parts;
}

/** Standing / walking person, facing +x. */
export function person(jacket: number, trousers = C.navy, hair = C.black): Part[] {
  return [
    { p: [0, 0.42, 0.1], s: [0.15, 0.84, 0.15], c: trousers },
    { p: [0, 0.42, -0.1], s: [0.15, 0.84, 0.15], c: trousers },
    { p: [0, 1.12, 0], s: [0.26, 0.6, 0.44], c: jacket },
    { p: [0, 1.1, 0.27], s: [0.12, 0.55, 0.11], c: jacket },
    { p: [0, 1.1, -0.27], s: [0.12, 0.55, 0.11], c: jacket },
    { p: [0, 1.55, 0], s: [0.22, 0.24, 0.22], c: 0xc8a07a },
    { p: [-0.02, 1.69, 0], s: [0.25, 0.07, 0.25], c: hair },
  ];
}

/** Poplar / pagoda tree. */
export function tree(tall: boolean): Part[] {
  const h = tall ? 7 : 4.5;
  const parts: Part[] = [{ p: [0, h / 2, 0], s: [0.3, h, 0.3], c: C.trunk, cyl: true, seg: 6 }];
  const blobs = tall ? [[0, 5.2, 0, 1.6, 3.6], [0.3, 7.2, 0.2, 1.1, 2]] : [[0, 4, 0, 3.4, 1.8], [0.6, 4.9, -0.4, 2.2, 1.2]];
  for (const [x, y, z, w, hh] of blobs) parts.push({ p: [x, y, z], s: [w, hh, w], c: C.leaf, ry: x });
  return parts;
}

/** Street lamp pole (lit head is a separate glow part list). */
export function lampPole(): Part[] {
  return [{ p: [0, 2.6, 0], s: [0.12, 5.2, 0.12], c: 0x3a3a3a, cyl: true, seg: 6 }, { p: [0.5, 5.15, 0], s: [1.1, 0.08, 0.08], c: 0x3a3a3a }];
}
export function lampHead(): Part[] { return [{ p: [0.95, 5.0, 0], s: [0.4, 0.18, 0.28], c: C.sodium }]; }

/** Old articulated-style city bus (red/cream), along +x. */
export function bus(): Part[] {
  const p: Part[] = [
    { p: [0, 1.5, 0], s: [11, 1.6, 2.5], c: C.busCream },
    { p: [0, 0.75, 0], s: [11, 0.6, 2.5], c: C.busRed },
    { p: [0, 2.45, 0], s: [10.8, 0.3, 2.4], c: C.busRed },
    { p: [0, 2.67, 0], s: [1.2, 0.15, 2.0], c: 0x777777 },
  ];
  for (const x of [-3.8, 3.8]) for (const z of [1.2, -1.2]) p.push({ p: [x, 0.45, z], s: [0.9, 0.3, 0.9], c: C.black, cyl: true, rx: Math.PI / 2, seg: 10 });
  return p;
}
export function busWindows(): Part[] {
  const p: Part[] = [];
  for (let i = 0; i < 9; i++) for (const z of [1.26, -1.26]) p.push({ p: [-4.6 + i * 1.15, 1.75, z], s: [0.95, 0.75, 0.02], c: 0xe8d29a });
  return p;
}
