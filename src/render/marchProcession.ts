import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C, mergeParts, rng, type Part } from './kit';

export type MarchVariant = 'night422' | 'day0427';

export interface ObstacleCircle {
  x: number;
  z: number;
  r: number;
}

export interface MarchAuditMetrics {
  variant: MarchVariant;
  marcherCount: number;
  picketCount: number;
  bearerCount: number;
  citizenCount: number;
  bannerCount: number;
  flagCount: number;
  minPairDist: number;
  minPlayerDist: number;
  minNpcDist: number;
}

export interface SquareAuditMetrics {
  totalCrowd: number;
  bannerCount: number;
  allBannersGrounded: boolean;
  minCrowdPairDist: number;
}

export interface MarchProcessionHandle {
  update(dt: number, t: number, playerX?: number, playerZ?: number): void;
  audit(): MarchAuditMetrics;
}

export interface SquareAssemblyHandle {
  update(dt: number, t: number): void;
  audit(): SquareAuditMetrics;
}

interface TaggedPart {
  part: Part;
  /** 0=static/torso, 1=legL, 2=legR, 3=armL, 4=armR */
  limb: 0 | 1 | 2 | 3 | 4;
  pivotY: number;
  /** 1.0 = tinted by instanceColor (jacket/sleeves), 0.0 = preserve vertex color (skin/hair/pants/satchel/armband) */
  tintMask: number;
}

const H = Math.PI / 2;
const JACKET_BASE = 0xebe9e3;
const SKIN = 0xf0ede6;
const SKIN_SHADE = 0xe2ddd2;
const PANTS = 0x262e3c;
const WORK_PANTS = 0x293446;

function strut(
  a: [number, number, number],
  b: [number, number, number],
  thick: number,
  c: number,
  seg = 5,
): Part {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 0.001;
  const rz = Math.acos(Math.max(-1, Math.min(1, dy / len)));
  const ry = Math.hypot(dx, dz) > 1e-5 ? Math.atan2(dz, -dx) : 0;
  return {
    p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    s: [thick, len, thick],
    c,
    cyl: true,
    seg,
    open: true,
    rz,
    ry,
  };
}

/** Merge tagged parts into one BufferGeometry carrying `aPart(limb, pivotY, tintMask)`. */
function buildTaggedFigureGeo(entries: TaggedPart[]): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  for (const e of entries) {
    const g = mergeParts([e.part]);
    const count = g.getAttribute('position').count;
    const attr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      attr[i * 3] = e.limb;
      attr[i * 3 + 1] = e.pivotY;
      attr[i * 3 + 2] = e.tintMask;
    }
    g.setAttribute('aPart', new THREE.BufferAttribute(attr, 3));
    geos.push(g);
  }
  const merged = mergeGeometries(geos)!;
  for (const g of geos) g.dispose();
  return merged;
}

/** Sculpted core torso + belt + lapels + shirt V-neck + mourning paper flower + olive satchel + matte-white head (+X forward). */
function coreTorsoAndHeadEntries(
  includeSatchel: boolean,
  includeFlower: boolean,
  _hairCol = C.black,
  hiResHead = false,
): TaggedPart[] {
  const entries: TaggedPart[] = [
    // Continuous tapered spring coat + waist belt + crisp white shirt V-neck & folded lapels
    { part: { p: [0, 0.81, 0], s: [0.255, 0.055, 0.405], c: 0x241d16 }, limb: 0, pivotY: 0.8, tintMask: 0 },
    { part: { p: [0, 1.12, 0], s: [0.245, 0.60, 0.40], c: JACKET_BASE, cyl: true, seg: 6, top: 1.08 }, limb: 0, pivotY: 0.8, tintMask: 1 },
    { part: { p: [0.116, 1.32, 0], s: [0.04, 0.16, 0.11], c: 0xf0ece0 }, limb: 0, pivotY: 0.8, tintMask: 0 },
    { part: { p: [0.125, 1.30, 0.068], s: [0.024, 0.17, 0.062], c: JACKET_BASE, rx: -0.24 }, limb: 0, pivotY: 0.8, tintMask: 1 },
    { part: { p: [0.125, 1.30, -0.068], s: [0.024, 0.17, 0.062], c: JACKET_BASE, rx: 0.24 }, limb: 0, pivotY: 0.8, tintMask: 1 },
    // Neck + sculpted featureless matte alabaster-white head
    { part: { p: [0, 1.46, 0], s: [0.095, 0.09, 0.095], c: SKIN_SHADE, cyl: true, seg: 4, open: true }, limb: 0, pivotY: 0.8, tintMask: 0 },
    { part: { p: [0.015, 1.59, 0], s: [0.195, 0.23, 0.178], c: SKIN, sphere: true, detail: hiResHead ? 1 : 0 }, limb: 0, pivotY: 0.8, tintMask: 0 },
  ];
  if (includeFlower) {
    // Crisp white mourning paper flower on left breast
    entries.push({
      part: { p: [0.135, 1.29, 0.095], s: [0.036, 0.056, 0.056], c: 0xf6f3ea, rx: 0.78, noAO: true },
      limb: 0,
      pivotY: 0.8,
      tintMask: 0,
    });
  }
  if (includeSatchel) {
    entries.push(
      { part: { p: [0, 1.15, 0], s: [0.268, 0.52, 0.036], c: 0x5c6240, rx: 0.58 }, limb: 0, pivotY: 0.8, tintMask: 0 },
      { part: { p: [-0.05, 0.88, 0.23], s: [0.19, 0.21, 0.08], c: 0x565c3a }, limb: 0, pivotY: 0.8, tintMask: 0 },
    );
  }
  return entries;
}

function legEntries(trousers = PANTS): TaggedPart[] {
  return [
    { part: { p: [0, 0.43, 0.09], s: [0.145, 0.72, 0.135], c: trousers, cyl: true, seg: 5, top: 1.12, open: true }, limb: 1, pivotY: 0.8, tintMask: 0 },
    { part: { p: [0.025, 0.038, 0.09], s: [0.22, 0.075, 0.108], c: 0x1c1b19 }, limb: 1, pivotY: 0.8, tintMask: 0 },
    { part: { p: [0, 0.43, -0.09], s: [0.145, 0.72, 0.135], c: trousers, cyl: true, seg: 5, top: 1.12, open: true }, limb: 2, pivotY: 0.8, tintMask: 0 },
    { part: { p: [0.025, 0.038, -0.09], s: [0.22, 0.075, 0.108], c: 0x1c1b19 }, limb: 2, pivotY: 0.8, tintMask: 0 },
  ];
}

/** High-precision animated marching student (~218 tris). */
function makeMarcherGeo(includeFlower: boolean): THREE.BufferGeometry {
  return buildTaggedFigureGeo([
    ...legEntries(PANTS),
    ...coreTorsoAndHeadEntries(true, includeFlower, C.black, false),
    // Left arm & hand
    { part: { p: [0.01, 1.12, 0.242], s: [0.11, 0.48, 0.10], c: JACKET_BASE, cyl: true, seg: 4, top: 0.82, open: true }, limb: 3, pivotY: 1.34, tintMask: 1 },
    { part: { p: [0.02, 0.85, 0.242], s: [0.076, 0.092, 0.070], c: SKIN }, limb: 3, pivotY: 1.34, tintMask: 0 },
    // Right arm & hand
    { part: { p: [0.01, 1.12, -0.242], s: [0.11, 0.48, 0.10], c: JACKET_BASE, cyl: true, seg: 4, top: 0.82, open: true }, limb: 4, pivotY: 1.34, tintMask: 1 },
    { part: { p: [0.02, 0.85, -0.242], s: [0.076, 0.092, 0.070], c: SKIN }, limb: 4, pivotY: 1.34, tintMask: 0 },
  ]);
}

/** Student picket marshal (糾察隊員) with white armband & continuous white picket rope along X (~236 tris). */
function makePicketGeo(): THREE.BufferGeometry {
  return buildTaggedFigureGeo([
    ...legEntries(PANTS),
    ...coreTorsoAndHeadEntries(true, false, C.black, false),
    // White cotton picket armband + crimson center stripe around left upper sleeve
    { part: { p: [0.01, 1.24, 0.244], s: [0.125, 0.11, 0.115], c: 0xf4f1ea, cyl: true, seg: 5, open: true }, limb: 0, pivotY: 1.34, tintMask: 0 },
    { part: { p: [0.01, 1.24, 0.244], s: [0.129, 0.026, 0.119], c: 0xb8241c, cyl: true, seg: 5, open: true }, limb: 0, pivotY: 1.34, tintMask: 0 },
    // Arms braced fore-and-aft along X gripping continuous white cotton picket rope
    { part: strut([0.02, 1.33, 0.24], [0.42, 1.02, 0.24], 0.095, JACKET_BASE, 4), limb: 0, pivotY: 1.34, tintMask: 1 },
    { part: strut([0.02, 1.33, -0.24], [-0.42, 1.02, -0.22], 0.095, JACKET_BASE, 4), limb: 0, pivotY: 1.34, tintMask: 1 },
    { part: { p: [0.43, 1.01, 0.24], s: [0.074, 0.078, 0.074], c: SKIN }, limb: 0, pivotY: 1.34, tintMask: 0 },
    { part: { p: [-0.43, 1.01, -0.22], s: [0.074, 0.078, 0.074], c: SKIN }, limb: 0, pivotY: 1.34, tintMask: 0 },
    // Continuous taut white cloth picket cord spanning between pickets spaced at 1.42m
    { part: { p: [0, 1.01, 0.24], s: [1.44, 0.030, 0.030], c: 0xf2efe6, noAO: true }, limb: 0, pivotY: 1.0, tintMask: 0 },
  ]);
}

/** Dedicated hi-res banner/flag bearer whose gripping hands clasp local x=+0.26, y=1.18 & y=1.60 (~290 tris). */
function makeBearerGeo(): THREE.BufferGeometry {
  return buildTaggedFigureGeo([
    ...legEntries(PANTS),
    ...coreTorsoAndHeadEntries(true, true, C.black, true),
    // Left arm extended forward-low clasping pole at [0.26, 1.18, 0.03]
    { part: strut([0.0, 1.34, 0.23], [0.16, 1.24, 0.14], 0.095, JACKET_BASE, 4), limb: 0, pivotY: 1.34, tintMask: 1 },
    { part: strut([0.16, 1.24, 0.14], [0.26, 1.18, 0.03], 0.086, JACKET_BASE, 4), limb: 0, pivotY: 1.34, tintMask: 1 },
    { part: { p: [0.26, 1.18, 0.02], s: [0.082, 0.085, 0.082], c: SKIN, sphere: true, detail: 0 }, limb: 0, pivotY: 1.34, tintMask: 0 },
    // Right arm raised higher-forward clasping pole at [0.26, 1.60, -0.02]
    { part: strut([0.0, 1.34, -0.23], [0.15, 1.46, -0.13], 0.095, JACKET_BASE, 4), limb: 0, pivotY: 1.34, tintMask: 1 },
    { part: strut([0.15, 1.46, -0.13], [0.26, 1.60, -0.02], 0.086, JACKET_BASE, 4), limb: 0, pivotY: 1.34, tintMask: 1 },
    { part: { p: [0.26, 1.60, -0.02], s: [0.082, 0.085, 0.082], c: SKIN, sphere: true, detail: 0 }, limb: 0, pivotY: 1.34, tintMask: 0 },
  ]);
}

/** Expressive sidewalk resident/worker with period waist apron + duckbill cap holding thermos flask (~210 tris). */
function makeCitizenGeo(): THREE.BufferGeometry {
  return buildTaggedFigureGeo([
    ...legEntries(WORK_PANTS),
    ...coreTorsoAndHeadEntries(false, false, 0x262422, false),
    // Sidewalk citizen cap + cloth waist apron so residents read clearly distinct from marching students
    { part: { p: [0.008, 1.69, 0], s: [0.205, 0.082, 0.19], c: 0x3b3f44, sphere: true, detail: 0 }, limb: 0, pivotY: 1.59, tintMask: 0 },
    { part: { p: [0.112, 1.655, 0], s: [0.095, 0.022, 0.165], c: 0x222528, rz: -0.15 }, limb: 0, pivotY: 1.59, tintMask: 0 },
    { part: { p: [0.128, 0.78, 0], s: [0.032, 0.36, 0.30], c: 0xebe7dc }, limb: 0, pivotY: 0.8, tintMask: 0 },
    // Left arm lowered + right arm raised slightly holding a red thermos flask toward passing students
    { part: { p: [0.01, 1.12, 0.242], s: [0.11, 0.48, 0.10], c: JACKET_BASE, cyl: true, seg: 4, top: 0.82, open: true }, limb: 0, pivotY: 1.34, tintMask: 1 },
    { part: { p: [0.02, 0.85, 0.242], s: [0.076, 0.092, 0.070], c: SKIN }, limb: 0, pivotY: 1.34, tintMask: 0 },
    { part: strut([0.0, 1.33, -0.24], [0.22, 1.16, -0.21], 0.095, JACKET_BASE, 4), limb: 0, pivotY: 1.34, tintMask: 1 },
    { part: { p: [0.24, 1.14, -0.20], s: [0.076, 0.080, 0.072], c: SKIN }, limb: 0, pivotY: 1.34, tintMask: 0 },
    // Classic 1980s bamboo/red thermos flask (暖水瓶) resting cleanly beside hand
    { part: { p: [0.28, 1.00, -0.18], s: [0.125, 0.28, 0.125], c: 0xa62e24, cyl: true, seg: 6, open: true }, limb: 0, pivotY: 1.0, tintMask: 0 },
    { part: { p: [0.28, 1.16, -0.18], s: [0.11, 0.055, 0.11], c: C.chrome, cyl: true, seg: 6, top: 0.6 }, limb: 0, pivotY: 1.0, tintMask: 0 },
  ]);
}

/** Lean LOD standing crowd silhouette with jacket-only tint mask & featureless white head (~94 tris). */
export function makeStandingCrowdLodGeo(): THREE.BufferGeometry {
  return buildTaggedFigureGeo([
    { part: { p: [0, 0.40, 0], s: [0.17, 0.80, 0.28], c: PANTS, cyl: true, seg: 5, open: true }, limb: 0, pivotY: 0, tintMask: 0 },
    { part: { p: [0, 1.11, 0], s: [0.24, 0.62, 0.39], c: JACKET_BASE, cyl: true, seg: 5, top: 1.10 }, limb: 0, pivotY: 0, tintMask: 1 },
    { part: { p: [0.116, 1.31, 0], s: [0.036, 0.15, 0.095], c: 0xebe7dc }, limb: 0, pivotY: 0, tintMask: 0 },
    { part: { p: [0.01, 1.12, 0.24], s: [0.11, 0.50, 0.095], c: JACKET_BASE, cyl: true, seg: 4, top: 0.78, open: true, rz: 0.06 }, limb: 0, pivotY: 0, tintMask: 1 },
    { part: { p: [0.01, 1.12, -0.24], s: [0.11, 0.50, 0.095], c: JACKET_BASE, cyl: true, seg: 4, top: 0.78, open: true, rz: 0.06 }, limb: 0, pivotY: 0, tintMask: 1 },
    { part: { p: [0.01, 1.57, 0], s: [0.19, 0.23, 0.175], c: SKIN, sphere: true, detail: 0 }, limb: 0, pivotY: 0, tintMask: 0 },
    { part: { p: [-0.04, 0.89, 0.22], s: [0.18, 0.20, 0.075], c: 0x565c3a }, limb: 0, pivotY: 0, tintMask: 0 },
  ]);
}

/** Uniformed cordon officer silhouette with visored peaked cap (大檐帽) & featureless white head (~112 tris). */
export function makeUniformCordonGeo(): THREE.BufferGeometry {
  return buildTaggedFigureGeo([
    { part: { p: [0, 0.40, 0], s: [0.17, 0.80, 0.28], c: 0x3b492e, cyl: true, seg: 5, open: true }, limb: 0, pivotY: 0, tintMask: 0 },
    { part: { p: [0, 0.81, 0], s: [0.252, 0.055, 0.398], c: 0x261d14 }, limb: 0, pivotY: 0, tintMask: 0 },
    { part: { p: [0, 1.11, 0], s: [0.24, 0.62, 0.39], c: JACKET_BASE, cyl: true, seg: 5, top: 1.10 }, limb: 0, pivotY: 0, tintMask: 1 },
    { part: { p: [0.01, 1.12, 0.24], s: [0.11, 0.50, 0.095], c: JACKET_BASE, cyl: true, seg: 4, top: 0.78, open: true, rz: 0.06 }, limb: 0, pivotY: 0, tintMask: 1 },
    { part: { p: [0.01, 1.12, -0.24], s: [0.11, 0.50, 0.095], c: JACKET_BASE, cyl: true, seg: 4, top: 0.78, open: true, rz: 0.06 }, limb: 0, pivotY: 0, tintMask: 1 },
    { part: { p: [0.01, 1.57, 0], s: [0.19, 0.23, 0.175], c: SKIN, sphere: true, detail: 0 }, limb: 0, pivotY: 0, tintMask: 0 },
    { part: { p: [0.01, 1.675, 0], s: [0.215, 0.065, 0.21], c: 0x455436, cyl: true, seg: 6, top: 1.15 }, limb: 0, pivotY: 0, tintMask: 0 },
    { part: { p: [0.115, 1.645, 0], s: [0.095, 0.02, 0.165], c: 0x1a1c19, rz: -0.15 }, limb: 0, pivotY: 0, tintMask: 0 },
    { part: { p: [0.115, 1.68, 0], s: [0.016, 0.026, 0.022], c: 0xc8a248 }, limb: 0, pivotY: 0, tintMask: 0 },
  ]);
}

/** Seated student with jacket-only tint mask, featureless white head, headband & enamel mug (~118 tris). */
export function makeSeatedCrowdGeo(headband = true): THREE.BufferGeometry {
  const entries: TaggedPart[] = [
    { part: { p: [0.22, 0.09, 0.12], s: [0.36, 0.14, 0.15], c: PANTS, cyl: true, seg: 4, open: true, rz: H, ry: 0.38 }, limb: 0, pivotY: 0, tintMask: 0 },
    { part: { p: [0.22, 0.09, -0.12], s: [0.36, 0.14, 0.15], c: PANTS, cyl: true, seg: 4, open: true, rz: H, ry: -0.38 }, limb: 0, pivotY: 0, tintMask: 0 },
    { part: { p: [0.38, 0.045, 0], s: [0.15, 0.075, 0.26], c: 0x1c1b19 }, limb: 0, pivotY: 0, tintMask: 0 },
    { part: { p: [0, 0.44, 0], s: [0.235, 0.56, 0.39], c: JACKET_BASE, cyl: true, seg: 5, top: 1.10, rz: -0.08 }, limb: 0, pivotY: 0, tintMask: 1 },
    { part: { p: [0.098, 0.64, 0], s: [0.038, 0.14, 0.095], c: 0xebe7dc, rz: -0.08 }, limb: 0, pivotY: 0, tintMask: 0 },
    { part: { p: [0.12, 0.44, 0.22], s: [0.10, 0.39, 0.095], c: JACKET_BASE, cyl: true, seg: 4, top: 0.80, open: true, rz: 0.48 }, limb: 0, pivotY: 0, tintMask: 1 },
    { part: { p: [0.12, 0.44, -0.22], s: [0.10, 0.39, 0.095], c: JACKET_BASE, cyl: true, seg: 4, top: 0.80, open: true, rz: 0.48 }, limb: 0, pivotY: 0, tintMask: 1 },
    { part: { p: [0, 0.895, 0], s: [0.19, 0.225, 0.175], c: SKIN, sphere: true, detail: 0 }, limb: 0, pivotY: 0, tintMask: 0 },
    { part: { p: [0.35, 0.06, 0.30], s: [0.09, 0.11, 0.09], c: C.enamel, cyl: true, seg: 5, open: true }, limb: 0, pivotY: 0, tintMask: 0 },
  ];
  if (headband) {
    entries.push(
      { part: { p: [0.005, 0.95, 0], s: [0.202, 0.045, 0.188], c: 0xf4f1ea, cyl: true, seg: 5, open: true }, limb: 0, pivotY: 0, tintMask: 0 },
      { part: { p: [-0.12, 0.89, 0.03], s: [0.032, 0.13, 0.042], c: 0xf4f1ea, rz: -0.35 }, limb: 0, pivotY: 0, tintMask: 0 },
    );
  }
  return buildTaggedFigureGeo(entries);
}

/** High-precision segmented bamboo pole (`y = 0 .. 3.30m`) with internode rings, finial & cloth tie straps (~72 tris). */
function makeBambooPoleGeo(tasselCol = 0xb4241c): THREE.BufferGeometry {
  const parts: Part[] = [
    { p: [0, 1.66, 0], s: [0.048, 3.24, 0.048], c: 0x9b824a, cyl: true, seg: 5, top: 0.72, open: true },
  ];
  for (let ny = 0.55; ny <= 2.95; ny += 0.60) {
    parts.push({ p: [0, ny, 0], s: [0.056, 0.025, 0.056], c: 0x6e582c, cyl: true, seg: 5, open: true });
  }
  parts.push(
    { p: [0, 3.33, 0], s: [0.062, 0.12, 0.062], c: 0xd0ac58, cyl: true, seg: 5, top: 0.12, open: true },
    { p: [0.035, 3.16, 0], s: [0.03, 0.18, 0.03], c: tasselCol, rz: 0.16 },
    { p: [0, 3.10, 0], s: [0.065, 0.045, 0.065], c: 0xf2eee4, cyl: true, seg: 5, open: true },
    { p: [0, 2.22, 0], s: [0.065, 0.045, 0.065], c: 0xf2eee4, cyl: true, seg: 5, open: true },
  );
  return mergeParts(parts);
}

/** Create shader-patched MeshStandardMaterial that applies `instanceColor` ONLY to jacket (`aPart.z > 0.5`) and optional GPU limb stride. */
export function makeCrowdMaterial(
  uniforms: { uTime: { value: number } },
  animateStride: boolean,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.04,
  });
  mat.customProgramCacheKey = () => (animateStride ? 'b89-marcher-stride-v1' : 'b89-crowd-mask-v1');
  mat.onBeforeCompile = shader => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec3 aPart;
${animateStride ? 'attribute float aPhase;\nuniform float uTime;' : ''}`,
      )
      .replace(
        '#include <color_vertex>',
        `#if defined( USE_COLOR_ALPHA )
\tvColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
\tvColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
\tvColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
\tvColor.xyz *= mix( vec3( 1.0 ), instanceColor.xyz, aPart.z );
#endif`,
      );

    if (animateStride) {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
float b89Swing = sin(uTime * 5.2 + aPhase) * 0.40;
float b89Limb = aPart.x;
float b89Ang = (b89Limb > 0.5 && b89Limb < 1.5) ? b89Swing
  : (b89Limb > 1.5 && b89Limb < 2.5) ? -b89Swing
  : (b89Limb > 2.5 && b89Limb < 3.5) ? -b89Swing * 0.64
  : (b89Limb > 3.5 && b89Limb < 4.5) ? b89Swing * 0.64
  : 0.0;
if (abs(b89Ang) > 0.0001) {
  float cs = cos(b89Ang), sn = sin(b89Ang);
  float nx0 = objectNormal.x;
  float ny0 = objectNormal.y;
  objectNormal.x = nx0 * cs - ny0 * sn;
  objectNormal.y = nx0 * sn + ny0 * cs;
}`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
if (abs(b89Ang) > 0.0001) {
  float cs = cos(b89Ang), sn = sin(b89Ang);
  float tx = transformed.x;
  float dy = transformed.y - aPart.y;
  transformed.x = tx * cs - dy * sn;
  transformed.y = aPart.y + tx * sn + dy * cs;
}`,
        );
    }
  };
  return mat;
}

interface BannerDef {
  text: string;
  bg: 'cream' | 'crimson' | 'navy' | 'white';
  mourningTrim?: boolean;
  stamp?: string;
}

const BANNER_DEFS: Record<MarchVariant | 'square422', BannerDef[]> = {
  night422: [
    { text: '沉痛悼念胡耀邦同志', bg: 'white', mourningTrim: true, stamp: '北京高校' },
    { text: '北京大學', bg: 'cream', mourningTrim: true, stamp: '八九・四・廿一' },
    { text: '民主萬歲　自由萬歲', bg: 'crimson' },
    { text: '清華大學', bg: 'cream', mourningTrim: true },
    { text: '新聞自由　如實報導', bg: 'white' },
    { text: '中國人民大學', bg: 'crimson' },
    { text: '消除腐敗　打倒官倒', bg: 'crimson' },
    { text: '悼念耀邦　繼承遺志', bg: 'white', mourningTrim: true },
    { text: '北京師範大學', bg: 'cream', mourningTrim: true },
    { text: '和平請願　維護秩序', bg: 'white' },
    { text: '中國政法大學', bg: 'navy' },
    { text: '北京航空航天大學', bg: 'cream' },
  ],
  day0427: [
    { text: '擁護憲法　和平請願', bg: 'white' },
    { text: '新聞要說真話', bg: 'cream', stamp: '首都新聞界' },
    { text: '愛國民主　反對腐敗', bg: 'crimson' },
    { text: '北京大學', bg: 'cream', stamp: '一九八九・四・廿七' },
    { text: '清華大學', bg: 'cream' },
    { text: '平等對話　公開透明', bg: 'white' },
    { text: '中國人民大學', bg: 'crimson' },
    { text: '北京師範大學', bg: 'cream' },
    { text: '弘揚五四精神', bg: 'crimson' },
    { text: '新聞自由　如實報導', bg: 'white' },
    { text: '中國政法大學', bg: 'navy' },
    { text: '反對官倒　廉潔奉公', bg: 'crimson' },
  ],
  square422: [
    { text: '沉痛悼念胡耀邦同志', bg: 'white', mourningTrim: true, stamp: '八九・四・廿二' },
    { text: '北京大學', bg: 'cream', mourningTrim: true },
    { text: '清華大學', bg: 'cream', mourningTrim: true },
    { text: '中國人民大學', bg: 'crimson' },
    { text: '北京師範大學', bg: 'cream', mourningTrim: true },
    { text: '中國政法大學', bg: 'navy' },
    { text: '民主　自由', bg: 'white' },
    { text: '新聞自由　如實報導', bg: 'cream' },
    { text: '消除腐敗　廉潔奉公', bg: 'crimson' },
    { text: '和平請願　對話溝通', bg: 'white' },
    { text: '悼念耀邦　繼承遺志', bg: 'white', mourningTrim: true },
    { text: '北京航空航天大學', bg: 'cream' },
  ],
};

const FLAG_DEFS: Array<{ text: string; bg: 'crimson' | 'white' | 'navy' | 'cream'; vertical?: boolean }> = [
  { text: '北大', bg: 'crimson' },
  { text: '清華', bg: 'cream' },
  { text: '人大', bg: 'crimson' },
  { text: '北師大', bg: 'navy' },
  { text: '政法', bg: 'crimson' },
  { text: '北航', bg: 'navy' },
  { text: '央美', bg: 'cream' },
  { text: '悼', bg: 'white' },
  { text: '新聞界', bg: 'white' },
  { text: '糾察', bg: 'crimson' },
];

function drawBannerCell(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  def: BannerDef,
  cellSeed: number,
) {
  const isCrimson = def.bg === 'crimson';
  const isNavy = def.bg === 'navy';
  const isCream = def.bg === 'cream';

  const bgGrad = g.createLinearGradient(x, y, x, y + h);
  if (isCrimson) {
    bgGrad.addColorStop(0, '#ae261c');
    bgGrad.addColorStop(0.5, '#961e16');
    bgGrad.addColorStop(1, '#7c1710');
  } else if (isNavy) {
    bgGrad.addColorStop(0, '#27426e');
    bgGrad.addColorStop(0.5, '#1f365c');
    bgGrad.addColorStop(1, '#192b4a');
  } else if (isCream) {
    bgGrad.addColorStop(0, '#f2ead4');
    bgGrad.addColorStop(0.5, '#eae0c6');
    bgGrad.addColorStop(1, '#dfd3b6');
  } else {
    bgGrad.addColorStop(0, '#f5f2e8');
    bgGrad.addColorStop(0.5, '#ede9dc');
    bgGrad.addColorStop(1, '#e1dcd0');
  }
  g.fillStyle = bgGrad;
  g.fillRect(x, y, w, h);

  // Subtle woven cotton vertical pleat shadows + cloth grain
  const r = rng(cellSeed);
  for (let p = 0; p < 7; p++) {
    const fx = x + 36 + p * ((w - 72) / 6) + (r() - 0.5) * 14;
    const fg = g.createLinearGradient(fx - 18, y, fx + 18, y);
    fg.addColorStop(0, 'rgba(0,0,0,0)');
    fg.addColorStop(0.5, isCrimson || isNavy ? 'rgba(0,0,0,0.12)' : 'rgba(60,50,36,0.08)');
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fg;
    g.fillRect(fx - 18, y, 36, h);
  }

  // Side pole sleeves + stitched hems
  g.fillStyle = 'rgba(0,0,0,0.16)';
  g.fillRect(x, y, 14, h);
  g.fillRect(x + w - 14, y, 14, h);
  g.strokeStyle = isCrimson || isNavy ? 'rgba(255,244,220,0.28)' : 'rgba(60,48,36,0.22)';
  g.lineWidth = 2;
  g.setLineDash([7, 5]);
  g.strokeRect(x + 16, y + 10, w - 32, h - 20);
  g.setLineDash([]);

  if (def.mourningTrim) {
    g.fillStyle = '#181818';
    g.fillRect(x + 14, y + 10, w - 28, 12);
    g.fillRect(x + 14, y + h - 22, w - 28, 12);
  }

  // Hand-brushed Traditional Chinese calligraphy
  const chars = [...def.text].length;
  const fontSize = chars <= 4 ? 86 : chars <= 7 ? 68 : chars <= 9 ? 54 : 46;
  const textCol = isCrimson || isNavy ? '#faf3e2' : '#141312';
  const shadowCol = isCrimson || isNavy ? 'rgba(30,6,4,0.45)' : 'rgba(120,108,88,0.24)';

  g.font = `bold ${fontSize}px "Noto Serif CJK TC","KaiTi","STKaiti","PMingLiU","Microsoft JhengHei",serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = shadowCol;
  g.fillText(def.text, x + w * 0.5 + 2, y + h * 0.52 + 2, w - 58);
  g.fillStyle = textCol;
  g.fillText(def.text, x + w * 0.5, y + h * 0.52, w - 58);

  if (def.stamp) {
    g.font = 'bold 20px "Noto Serif CJK TC","Microsoft JhengHei",serif';
    g.fillStyle = isCrimson || isNavy ? 'rgba(252,238,200,0.82)' : '#8d241c';
    g.textAlign = 'right';
    g.fillText(def.stamp, x + w - 26, y + h - 30);
  }
}

function buildBannerAtlasTexture(key: MarchVariant | 'square422'): THREE.CanvasTexture {
  const defs = BANNER_DEFS[key];
  const cols = 4;
  const rows = 3;
  const cellW = 512;
  const cellH = 340;
  const canvas = document.createElement('canvas');
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#efe9dc';
  g.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < defs.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    drawBannerCell(g, col * cellW, row * cellH, cellW, cellH, defs[i]!, 4220 + i * 37);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData.sceneOwned = true;
  tex.needsUpdate = true;
  return tex;
}

function buildFlagAtlasTexture(): THREE.CanvasTexture {
  const cols = 5;
  const rows = 2;
  const cellW = 256;
  const cellH = 256;
  const canvas = document.createElement('canvas');
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#a82218';
  g.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < FLAG_DEFS.length; i++) {
    const def = FLAG_DEFS[i]!;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW;
    const y = row * cellH;
    const bg =
      def.bg === 'crimson' ? '#a82218'
      : def.bg === 'navy' ? '#203860'
      : def.bg === 'cream' ? '#eee4c8'
      : '#f4f0e4';
    const fg = def.bg === 'crimson' || def.bg === 'navy' ? '#faf2de' : '#161514';

    g.fillStyle = bg;
    g.fillRect(x, y, cellW, cellH);

    // Cloth hoist sleeve on left (u=0) + mourning or gold trim border
    g.fillStyle = def.bg === 'white' ? '#181818' : 'rgba(255,244,210,0.38)';
    g.fillRect(x, y, 16, cellH);
    g.strokeStyle = def.bg === 'white' ? '#181818' : 'rgba(248,220,145,0.45)';
    g.lineWidth = 5;
    g.strokeRect(x + 10, y + 10, cellW - 20, cellH - 20);

    const chars = [...def.text].length;
    const fs = chars === 1 ? 116 : chars === 2 ? 78 : 58;
    g.font = `bold ${fs}px "Noto Serif CJK TC","KaiTi","Microsoft JhengHei",serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = fg;
    g.fillText(def.text, x + cellW * 0.53, y + cellH * 0.52, cellW - 36);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData.sceneOwned = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Two-ply double-sided cloth BufferGeometry (front + inverted-UV back) so calligraphy reads left-to-right
 * from EVERY camera azimuth without z-fighting or shader branching.
 */
function makeTwoPlyClothGeo(widthSegs: number, heightSegs: number, hoistLeftAtZero: boolean): THREE.BufferGeometry {
  const front = new THREE.PlaneGeometry(1, 1, widthSegs, heightSegs);
  if (hoistLeftAtZero) front.translate(0.5, 0, 0);
  front.translate(0, 0, 0.005);

  const back = front.clone();
  back.translate(0, 0, -0.010);
  const bUv = back.getAttribute('uv');
  for (let i = 0; i < bUv.count; i++) {
    bUv.setX(i, 1.0 - bUv.getX(i));
  }
  const bNorm = back.getAttribute('normal');
  for (let i = 0; i < bNorm.count; i++) {
    bNorm.setZ(i, -bNorm.getZ(i));
  }
  const idx = back.getIndex();
  if (idx) {
    const arr = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i + 1]!;
      arr[i + 1] = arr[i + 2]!;
      arr[i + 2] = tmp;
    }
    idx.needsUpdate = true;
  }

  const merged = mergeGeometries([front, back])!;
  front.dispose();
  back.dispose();
  return merged;
}

/** Instanced wavy cloth mesh with per-instance atlas cell UV sub-rect & zero-pinned-pole breeze flutter. */
function makeInstancedClothMesh(
  geo: THREE.BufferGeometry,
  tex: THREE.CanvasTexture,
  count: number,
  uniforms: { uTime: { value: number } },
  mode: 'banner' | 'flag',
  nightLit: boolean,
): THREE.InstancedMesh {
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: new THREE.Color(nightLit ? 0xffe4b8 : 0xffffff),
    emissiveMap: tex,
    emissiveIntensity: nightLit ? 0.30 : 0.07,
    roughness: 0.90,
    metalness: 0.02,
    side: THREE.FrontSide,
  });
  mat.customProgramCacheKey = () => `b89-cloth-${mode}`;
  mat.onBeforeCompile = shader => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aUvRect;
attribute float aWavePhase;
uniform float uTime;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
#ifdef USE_MAP
\tvMapUv = aUvRect.xy + vMapUv * aUvRect.zw;
#endif
#ifdef USE_EMISSIVEMAP
\tvEmissiveMapUv = aUvRect.xy + vEmissiveMapUv * aUvRect.zw;
#endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float b89Env = ${mode === 'banner'
  ? 'sin(clamp(transformed.x + 0.5, 0.0, 1.0) * 3.14159265)'
  : 'pow(clamp(transformed.x, 0.0, 1.0), 1.2)'};
float b89Wave = sin(transformed.x * ${mode === 'banner' ? '7.5' : '6.2'} - uTime * ${mode === 'banner' ? '3.4' : '4.6'} + aWavePhase) * ${mode === 'banner' ? '0.075' : '0.13'}
              + cos(transformed.y * 4.0 + uTime * 2.3 + aWavePhase) * ${mode === 'banner' ? '0.028' : '0.042'};
transformed.z += b89Wave * b89Env;
${mode === 'banner' ? 'transformed.y -= 0.045 * b89Env * b89Env;' : ''}`,
      );
  };
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function fillUvRects(
  geo: THREE.BufferGeometry,
  slots: number[],
  cols: number,
  rows: number,
  texW: number,
  texH: number,
  phases: number[],
) {
  const rects = new Float32Array(slots.length * 4);
  const wPhase = new Float32Array(slots.length);
  const padU = 3 / texW;
  const padV = 3 / texH;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]!;
    const col = s % cols;
    const row = Math.floor(s / cols);
    const u0 = col / cols + padU;
    const uScale = 1 / cols - 2 * padU;
    const vTop = 1 - row / rows - padV;
    const vBot = 1 - (row + 1) / rows + padV;
    rects[i * 4] = u0;
    rects[i * 4 + 1] = vBot;
    rects[i * 4 + 2] = uScale;
    rects[i * 4 + 3] = vTop - vBot;
    wPhase[i] = phases[i] ?? i * 1.13;
  }
  geo.setAttribute('aUvRect', new THREE.InstancedBufferAttribute(rects, 4));
  geo.setAttribute('aWavePhase', new THREE.InstancedBufferAttribute(wPhase, 1));
}

const CLOTHING_PALETTE = [
  0x2e3b4e, // classic 1980s navy Mao jacket
  0x4f5a3e, // army olive canvas jacket
  0x3f5064, // faded state-factory work blue
  0x7c7356, // khaki spring windbreaker
  0x6e313a, // burgundy wool knit sweater
  0x4c525a, // slate charcoal jacket
  0xdad4c2, // cream cotton shirt
  0x485c49, // dark moss sweater
  0x6a5a44, // warm chestnut coat
  0x2b313a, // deep ink wool coat
];

interface BannerTeam {
  x: number;
  baseZ: number;
  z: number;
  width: number;
  cell: number;
  phase: number;
}

interface FlagTeam {
  x: number;
  baseZ: number;
  z: number;
  cell: number;
  sideSign: -1 | 1;
  phase: number;
}

interface MarchAgent {
  x: number;
  z: number;
  baseZ: number;
  vz: number;
  yaw: number;
  phase: number;
  bobSeed: number;
}

interface PicketAgent {
  x: number;
  baseZ: number;
  z: number;
}

const DEFAULT_MARCH_NPCS: ObstacleCircle[] = [
  // Fallback positions before dressWorld populates scene.userData.__npcObstacles
  { x: -9.1, z: -8.6, r: 0.85 },
  { x: 6.9, z: -4.1, r: 0.85 },
  { x: 2.9, z: -5.1, r: 0.85 },
  { x: -19.1, z: -12.6, r: 0.85 },
  { x: -13.1, z: -5.6, r: 0.85 },
  { x: 2.9, z: -6.6, r: 0.85 },
  { x: 12.9, z: -6.6, r: 0.85 },
];

/**
 * Attach the ultra-dense, zero-clipping 1989 Beijing street march procession
 * with animated articulated marchers, linked-arm student pickets with armbands & rope,
 * sculpted banner bearers carrying 12 rippling horizontal slogan banners & 14 flags,
 * and cheering sidewalk residents.
 */
export function attachStreetMarchProcession(
  scene: THREE.Scene,
  variant: MarchVariant,
  staticExclusions: ObstacleCircle[],
): MarchProcessionHandle {
  const r = rng(variant === 'night422' ? 19890422 : 19890427);
  const uniforms = { uTime: { value: 0 } };
  const dummy = new THREE.Object3D();
  const LOOP_MIN_X = -58;
  const LOOP_MAX_X = 58;
  const LOOP_LEN = LOOP_MAX_X - LOOP_MIN_X; // 116m

  // 1. Cross-street horizontal slogan banners (12 teams spaced every ~9.66m along 116m loop)
  const banners: BannerTeam[] = Array.from({ length: 12 }, (_, i) => ({
    x: LOOP_MIN_X + 2.5 + i * (LOOP_LEN / 12),
    baseZ: -10.0 + (i % 3 - 1) * 0.48,
    z: -10.0 + (i % 3 - 1) * 0.48,
    width: i % 2 === 0 ? 4.1 : 3.7,
    cell: i % 12,
    phase: i * 0.91,
  }));

  // 2. Tall billowing university flags (14 along north & south inner lanes, staggered away from banners)
  const flags: FlagTeam[] = Array.from({ length: 14 }, (_, i) => {
    const sideSign: -1 | 1 = i % 2 === 0 ? 1 : -1;
    const baseZ = sideSign > 0 ? -6.92 : -13.08;
    return {
      x: LOOP_MIN_X + 6.9 + i * (LOOP_LEN / 14),
      baseZ,
      z: baseZ,
      cell: i % 10,
      sideSign,
      phase: i * 1.17 + 0.5,
    };
  });

  // 3. Dense staggered 8-lane marching student column (~560+ figures)
  const laneZs = [-6.82, -7.72, -8.62, -9.52, -10.42, -11.32, -12.22, -13.12];
  const marchersData: MarchAgent[] = [];
  const stepX = 1.44;
  let colIdx = 0;
  for (let gx = LOOP_MIN_X + 0.5; gx < LOOP_MAX_X - 0.5; gx += stepX) {
    for (let li = 0; li < laneZs.length; li++) {
      const mx = gx + (li % 2) * (stepX * 0.48) + (r() - 0.5) * 0.14;
      const mz = laneZs[li]! + (r() - 0.5) * 0.12;
      // Leave clean breathing space right around horizontal banner bearers & poles and flag bearers
      let skip = false;
      for (const b of banners) {
        for (const poleZ of [b.baseZ - b.width * 0.5, b.baseZ + b.width * 0.5]) {
          if (Math.abs(mx - (b.x - 0.15)) < 1.02 && Math.abs(mz - poleZ) < 0.78) {
            skip = true;
            break;
          }
        }
        if (skip) break;
      }
      if (!skip) {
        for (const f of flags) {
          if (Math.abs(mx - (f.x - 0.15)) < 0.92 && Math.abs(mz - f.baseZ) < 0.72) {
            skip = true;
            break;
          }
        }
      }
      if (skip) continue;
      marchersData.push({
        x: mx,
        z: mz,
        baseZ: mz,
        vz: 0,
        yaw: (r() - 0.5) * 0.08,
        phase: (colIdx * 0.87 + li * 1.31) % (Math.PI * 2),
        bobSeed: r() * 6.28,
      });
    }
    colIdx++;
  }

  // 4. Linked-arm student pickets along BOTH carriageway margins (spacing 1.42m matching 1.44m continuous rope -> ~162 pickets)
  const picketsData: PicketAgent[] = [];
  for (let px = LOOP_MIN_X + 0.6; px < LOOP_MAX_X - 0.6; px += 1.42) {
    picketsData.push({ x: px, baseZ: -5.82, z: -5.82 });
    picketsData.push({ x: px + 0.71, baseZ: -14.18, z: -14.18 });
  }

  // 5. Cheering & water-offering sidewalk Beijing residents along north & south curbs
  const citizenCoords: Array<{ x: number; z: number; ry: number; colorIdx: number }> = [];
  const tryAddCitizen = (cx: number, cz: number, ry: number) => {
    for (const ex of staticExclusions) {
      if (Math.hypot(cx - ex.x, cz - ex.z) < ex.r + 0.45) return;
    }
    for (const prev of citizenCoords) {
      if (Math.hypot(cx - prev.x, cz - prev.z) < 0.88) return;
    }
    citizenCoords.push({ x: cx, z: cz, ry, colorIdx: citizenCoords.length });
  };
  for (let x = -43; x <= 43; x += 1.35) {
    // North sidewalk row facing south (-Z -> +PI/2 for +X model -> local +X rotates to (0, 0, -1))
    if (r() < 0.76) {
      tryAddCitizen(x + (r() - 0.5) * 0.3, -2.55 - r() * 1.35, Math.PI / 2 + (r() - 0.5) * 0.35);
    }
    // South sidewalk row facing north (+Z -> -PI/2 for +X model -> local +X rotates to (0, 0, +1))
    if (r() < 0.72) {
      tryAddCitizen(x + (r() - 0.5) * 0.35, -16.15 - r() * 1.35, -Math.PI / 2 + (r() - 0.5) * 0.35);
    }
  }

  // Build GPU geometries & instanced meshes
  const marcherGeo = makeMarcherGeo(variant === 'night422');
  const marcherPhases = new Float32Array(Math.max(1, marchersData.length));
  for (let i = 0; i < marchersData.length; i++) marcherPhases[i] = marchersData[i]!.phase;
  marcherGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(marcherPhases, 1));
  const animatedMat = makeCrowdMaterial(uniforms, true);
  const staticCrowdMat = makeCrowdMaterial(uniforms, false);

  const marcherMesh = new THREE.InstancedMesh(marcherGeo, animatedMat, Math.max(1, marchersData.length));
  marcherMesh.frustumCulled = false;
  marcherMesh.receiveShadow = true;
  marcherMesh.name = 'marchColumn';
  for (let i = 0; i < marchersData.length; i++) {
    marcherMesh.setColorAt(i, new THREE.Color(CLOTHING_PALETTE[i % CLOTHING_PALETTE.length]!));
  }
  if (marcherMesh.instanceColor) marcherMesh.instanceColor.needsUpdate = true;

  const picketGeo = makePicketGeo();
  const picketPhases = new Float32Array(Math.max(1, picketsData.length));
  for (let i = 0; i < picketsData.length; i++) picketPhases[i] = i * 0.45;
  picketGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(picketPhases, 1));
  const picketMesh = new THREE.InstancedMesh(picketGeo, animatedMat, Math.max(1, picketsData.length));
  picketMesh.frustumCulled = false;
  picketMesh.receiveShadow = true;
  picketMesh.name = 'marchPickets';
  for (let i = 0; i < picketsData.length; i++) {
    picketMesh.setColorAt(i, new THREE.Color(i % 2 === 0 ? 0x3b4d68 : 0x525c42));
  }
  if (picketMesh.instanceColor) picketMesh.instanceColor.needsUpdate = true;

  const bearerCount = banners.length * 2 + flags.length;
  const bearerGeo = makeBearerGeo();
  const bearerPhases = new Float32Array(Math.max(1, bearerCount));
  for (let i = 0; i < bearerCount; i++) bearerPhases[i] = i * 0.72;
  bearerGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(bearerPhases, 1));
  const bearerMesh = new THREE.InstancedMesh(bearerGeo, animatedMat, Math.max(1, bearerCount));
  bearerMesh.frustumCulled = false;
  bearerMesh.receiveShadow = true;
  bearerMesh.name = 'marchBearers';
  for (let i = 0; i < bearerCount; i++) {
    bearerMesh.setColorAt(i, new THREE.Color(CLOTHING_PALETTE[(i * 3) % CLOTHING_PALETTE.length]!));
  }
  if (bearerMesh.instanceColor) bearerMesh.instanceColor.needsUpdate = true;

  const citizenGeo = makeCitizenGeo();
  const citizenMesh = new THREE.InstancedMesh(citizenGeo, staticCrowdMat, Math.max(1, citizenCoords.length));
  citizenMesh.count = citizenCoords.length;
  citizenMesh.frustumCulled = false;
  citizenMesh.receiveShadow = true;
  citizenMesh.name = 'marchCitizens';
  const citPalette = [0x4c586a, 0x7a6c52, 0x5c363e, 0x4b5c4a, 0x867c66, 0x3b4858];
  citizenCoords.forEach((c, i) => {
    dummy.position.set(c.x, 0, c.z);
    dummy.rotation.set(0, c.ry, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    citizenMesh.setMatrixAt(i, dummy.matrix);
    citizenMesh.setColorAt(i, new THREE.Color(citPalette[c.colorIdx % citPalette.length]!));
  });
  citizenMesh.instanceMatrix.needsUpdate = true;
  if (citizenMesh.instanceColor) citizenMesh.instanceColor.needsUpdate = true;

  // Cloth banners + billowing school flags + shared instanced bamboo poles
  const bannerTex = buildBannerAtlasTexture(variant);
  const bannerGeo = makeTwoPlyClothGeo(10, 2, false);
  fillUvRects(
    bannerGeo,
    banners.map(b => b.cell),
    4,
    3,
    bannerTex.image.width,
    bannerTex.image.height,
    banners.map(b => b.phase),
  );
  const bannerMesh = makeInstancedClothMesh(
    bannerGeo,
    bannerTex,
    banners.length,
    uniforms,
    'banner',
    variant === 'night422',
  );
  bannerMesh.name = 'marchBanners';

  const flagTex = buildFlagAtlasTexture();
  const flagGeo = makeTwoPlyClothGeo(8, 3, true);
  fillUvRects(
    flagGeo,
    flags.map(f => f.cell),
    5,
    2,
    flagTex.image.width,
    flagTex.image.height,
    flags.map(f => f.phase),
  );
  const flagMesh = makeInstancedClothMesh(
    flagGeo,
    flagTex,
    flags.length,
    uniforms,
    'flag',
    variant === 'night422',
  );
  flagMesh.name = 'marchFlags';

  const poleCount = banners.length * 2 + flags.length;
  const poleMesh = new THREE.InstancedMesh(
    makeBambooPoleGeo(variant === 'night422' ? 0x1e1e1e : 0xb8241c),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.05 }),
    Math.max(1, poleCount),
  );
  poleMesh.frustumCulled = false;
  poleMesh.receiveShadow = true;
  poleMesh.name = 'marchPoles';

  scene.add(marcherMesh, picketMesh, bearerMesh, citizenMesh, bannerMesh, flagMesh, poleMesh);

  // Spatial-hash grid buckets along X (each 1.1m wide across [-58..+58]) for O(N) zero-clipping solver
  const BUCKET_SIZE = 1.15;
  const BUCKET_COUNT = Math.ceil(LOOP_LEN / BUCKET_SIZE) + 2;
  const buckets: number[][] = Array.from({ length: BUCKET_COUNT }, () => []);

  let lastAudit: MarchAuditMetrics = {
    variant,
    marcherCount: marchersData.length,
    picketCount: picketsData.length,
    bearerCount,
    citizenCount: citizenCoords.length,
    bannerCount: banners.length,
    flagCount: flags.length,
    minPairDist: 0.9,
    minPlayerDist: 10,
    minNpcDist: 10,
  };

  const wrapX = (x: number): number => {
    let v = x;
    while (v > LOOP_MAX_X) v -= LOOP_LEN;
    while (v < LOOP_MIN_X) v += LOOP_LEN;
    return v;
  };

  const update = (dt: number, t: number, playerX = -30, playerZ = -6): void => {
    const safeDt = Math.min(Math.max(dt, 0), 0.12);
    uniforms.uTime.value = t;

    const npcList = (scene.userData.__npcObstacles as ObstacleCircle[] | undefined) ?? DEFAULT_MARCH_NPCS;
    const playerRad = (scene.userData.__playerRadius as number | undefined) ?? 0.64;
    const activeObs: Array<{ x: number; z: number; r: number; isPlayer: boolean }> = [
      { x: playerX, z: playerZ, r: playerRad + 0.36, isPlayer: true },
      ...npcList.map(n => ({ x: n.x, z: n.z, r: Math.max(0.92, n.r + 0.18), isPlayer: false })),
    ];

    // 1. Advance horizontal banner teams & smoothly steer lateral z if either pole nears player/NPC
    const poleObstacles: Array<{ x: number; z: number; r: number }> = [];
    for (let bi = 0; bi < banners.length; bi++) {
      const b = banners[bi]!;
      b.x = wrapX(b.x + 1.12 * safeDt);
      const halfW = b.width * 0.5;
      let wantShift = 0;
      for (const poleZOff of [-halfW, halfW]) {
        const px = b.x - 0.12;
        const pz = b.baseZ + poleZOff;
        for (const ob of activeObs) {
          const dx = px - ob.x;
          const dz = pz - ob.z;
          const minR = ob.r + 0.18;
          if (Math.abs(dx) < 2.2 && Math.abs(dz) < minR + 0.25) {
            const awayDir = pz >= ob.z ? 1 : -1;
            const need = minR + 0.25 - Math.abs(dz);
            if (Math.abs(awayDir * need) > Math.abs(wantShift)) {
              wantShift = awayDir * need;
            }
          }
        }
      }
      const targetZ = Math.max(-13.0 + halfW, Math.min(-7.0 - halfW, b.baseZ + wantShift));
      const lerpZ = safeDt > 0 ? Math.min(1, safeDt * 7.5) : 1;
      b.z += (targetZ - b.z) * lerpZ;

      // Also record both poles & bearers as obstacles for surrounding marchers
      poleObstacles.push({ x: b.x - 0.14, z: b.z - halfW, r: 0.78 });
      poleObstacles.push({ x: b.x - 0.14, z: b.z + halfW, r: 0.78 });

      // Update cloth matrix (centered at y = 2.86m, height = 0.90m -> cleanly above 1.7m heads and tied to pole rings)
      dummy.position.set(b.x, 2.86 + Math.sin(t * 5.0 + b.phase) * 0.025, b.z);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.scale.set(b.width, 0.90, 1);
      dummy.updateMatrix();
      bannerMesh.setMatrixAt(bi, dummy.matrix);

      // Twin carried bamboo poles (y = 0.22m clearance above asphalt) + twin gripping bearers
      for (let side = 0; side < 2; side++) {
        const pz = b.z + (side === 0 ? -halfW : halfW);
        const poleIdx = bi * 2 + side;
        dummy.position.set(b.x, 0.22, pz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1.0, 1);
        dummy.updateMatrix();
        poleMesh.setMatrixAt(poleIdx, dummy.matrix);

        dummy.position.set(b.x - 0.26, Math.abs(Math.sin(t * 5.2 + poleIdx * 0.72)) * 0.025, pz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        bearerMesh.setMatrixAt(poleIdx, dummy.matrix);
      }
    }

    // 2. Advance tall university flag teams
    const flagOffset = banners.length * 2;
    for (let fi = 0; fi < flags.length; fi++) {
      const f = flags[fi]!;
      f.x = wrapX(f.x + 1.12 * safeDt);
      let targetZ = f.baseZ;
      for (const ob of activeObs) {
        const dx = f.x - 0.12 - ob.x;
        const dz = f.baseZ - ob.z;
        const minR = ob.r + 0.15;
        if (Math.abs(dx) < 1.8 && Math.abs(dz) < minR + 0.2) {
          targetZ = Math.max(-13.3, Math.min(-6.7, ob.z + (dz >= 0 ? 1 : -1) * (minR + 0.22)));
        }
      }
      const lerpZ = safeDt > 0 ? Math.min(1, safeDt * 7.5) : 1;
      f.z += (targetZ - f.z) * lerpZ;
      poleObstacles.push({ x: f.x - 0.14, z: f.z, r: 0.74 });

      dummy.position.set(f.x, 3.06, f.z);
      // Flag trails backward behind marching bearer and angles outward so characters face camera
      dummy.rotation.set(0, f.sideSign > 0 ? Math.PI - 0.30 : Math.PI + 0.30, 0);
      dummy.scale.set(1.42, 0.96, 1);
      dummy.updateMatrix();
      flagMesh.setMatrixAt(fi, dummy.matrix);

      const pIdx = flagOffset + fi;
      dummy.position.set(f.x, 0.32, f.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1.04, 1);
      dummy.updateMatrix();
      poleMesh.setMatrixAt(pIdx, dummy.matrix);

      dummy.position.set(f.x - 0.26, Math.abs(Math.sin(t * 5.2 + pIdx * 0.72)) * 0.025, f.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bearerMesh.setMatrixAt(pIdx, dummy.matrix);
    }

    bannerMesh.instanceMatrix.needsUpdate = true;
    flagMesh.instanceMatrix.needsUpdate = true;
    poleMesh.instanceMatrix.needsUpdate = true;
    bearerMesh.instanceMatrix.needsUpdate = true;

    // 3. Advance & solve zero-clipping dense marchers
    for (const m of marchersData) {
      m.x = wrapX(m.x + 1.12 * safeDt);
      // Spring return toward home lane Z + predictive lateral parting before obstacles
      const prevZ = m.z;
      m.z += (m.baseZ - m.z) * (safeDt > 0 ? Math.min(1, safeDt * 3.2) : 1);
      for (const ob of activeObs) {
        const ahead = ob.x - m.x;
        if (ahead > -0.6 && ahead < 2.8) {
          const dz = m.z - ob.z;
          if (Math.abs(dz) < ob.r + 0.35) {
            const steer = (dz >= 0 ? 1 : -1) * (ob.r + 0.4 - Math.abs(dz)) * (safeDt > 0 ? Math.min(1, safeDt * 4.5) : 0.6);
            m.z += steer;
          }
        }
      }
      m.z = Math.max(-13.32, Math.min(-6.68, m.z));
      m.vz = safeDt > 0.001 ? (m.z - prevZ) / safeDt : 0;
    }

    // Populate spatial X-buckets and solve obstacle projection + pairwise separation in 4 obstacle-aware passes
    const projectActiveObs = (m: (typeof marchersData)[number], rOffset: number): void => {
      for (let iter = 0; iter < 5; iter++) {
        let anyHit = false;
        for (const ob of activeObs) {
          const targetR = ob.r + rOffset;
          const dx = m.x - ob.x;
          const dz = m.z - ob.z;
          const d2 = dx * dx + dz * dz;
          if (d2 < targetR * targetR) {
            anyHit = true;
            const d = Math.sqrt(d2) || 0.01;
            if (iter >= 1) {
              const escapeDir = Math.abs(ob.z + 10) >= 1.2 ? (ob.z > -10 ? -1 : 1) : (m.baseZ <= ob.z ? -1 : 1);
              m.z = Math.max(-13.32, Math.min(-6.68, m.z + escapeDir * Math.max(0.22, targetR - d + 0.14)));
            } else {
              const nz = d > 0.02 ? dz / d : (ob.z > -10 ? -1 : 1);
              m.z = Math.max(-13.32, Math.min(-6.68, ob.z + nz * targetR));
            }
            const remZ = m.z - ob.z;
            const remSq = targetR * targetR - remZ * remZ;
            if (remSq > 0) {
              const needX = Math.sqrt(remSq);
              if (Math.abs(m.x - ob.x) < needX) {
                m.x = ob.x + (dx >= 0 ? 1 : -1) * needX;
              }
            }
          }
        }
        if (!anyHit) break;
      }
    };
    const projectObstacles = (m: (typeof marchersData)[number]): void => {
      for (const pObs of poleObstacles) {
        const dx = m.x - pObs.x;
        const dz = m.z - pObs.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < pObs.r * pObs.r) {
          const d = Math.sqrt(d2) || 0.01;
          const overlap = pObs.r - d;
          m.x += (dx / d) * overlap * 0.65;
          m.z = Math.max(-13.32, Math.min(-6.68, m.z + (dz / d) * overlap * 0.95));
        }
      }
      projectActiveObs(m, 0.03);
      m.x = wrapX(m.x);
    };
    const isNearActiveObs = (m: (typeof marchersData)[number]): boolean => {
      for (const ob of activeObs) {
        const lim = ob.r + 0.10;
        const dx = m.x - ob.x;
        const dz = m.z - ob.z;
        if (dx * dx + dz * dz < lim * lim) return true;
      }
      return false;
    };

    const minPair = 0.75;
    for (let pass = 0; pass < 4; pass++) {
      for (const m of marchersData) projectObstacles(m);

      for (let b = 0; b < BUCKET_COUNT; b++) buckets[b]!.length = 0;
      for (let i = 0; i < marchersData.length; i++) {
        const bi = Math.max(0, Math.min(BUCKET_COUNT - 1, Math.floor((marchersData[i]!.x - LOOP_MIN_X) / BUCKET_SIZE)));
        buckets[bi]!.push(i);
      }

      for (let bi = 0; bi < BUCKET_COUNT; bi++) {
        const listA = buckets[bi]!;
        for (let ai = 0; ai < listA.length; ai++) {
          const ia = listA[ai]!;
          const a = marchersData[ia]!;
          const pinnedA = isNearActiveObs(a);
          for (let nb = bi; nb <= Math.min(BUCKET_COUNT - 1, bi + 1); nb++) {
            const listB = buckets[nb]!;
            const startJ = nb === bi ? ai + 1 : 0;
            for (let aj = startJ; aj < listB.length; aj++) {
              const ib = listB[aj]!;
              const b = marchersData[ib]!;
              const dx = b.x - a.x;
              const dz = b.z - a.z;
              const d2 = dx * dx + dz * dz;
              if (d2 < minPair * minPair) {
                const d = Math.sqrt(d2) || 0.01;
                const ov = minPair - d;
                const nx = dx / d;
                const nz = dz / d;
                const pinnedB = isNearActiveObs(b);
                const wa = pinnedA && !pinnedB ? 0.12 : !pinnedA && pinnedB ? 0.90 : 0.52;
                const wb = pinnedB && !pinnedA ? 0.12 : !pinnedB && pinnedA ? 0.90 : 0.52;
                a.x -= nx * ov * wa * 0.68;
                b.x += nx * ov * wb * 0.68;
                a.z = Math.max(-13.32, Math.min(-6.68, a.z - nz * ov * wa * 0.88));
                b.z = Math.max(-13.32, Math.min(-6.68, b.z + nz * ov * wb * 0.88));
              }
            }
          }
        }
      }
    }
    // Final safety projection against player and static NPCs so pairwise push never encroaches
    for (const m of marchersData) {
      projectActiveObs(m, -0.04);
      m.x = wrapX(m.x);
    }

    // Compute live audit metrics & write GPU transforms (orientation facing +X = yaw 0!)
    let minPairSq = 999;
    let minPlayerDist = 999;
    let minNpcDist = 999;
    for (let bi = 0; bi < BUCKET_COUNT; bi++) buckets[bi]!.length = 0;
    for (let i = 0; i < marchersData.length; i++) {
      const m = marchersData[i]!;
      const dp = Math.hypot(m.x - playerX, m.z - playerZ);
      if (dp < minPlayerDist) minPlayerDist = dp;
      for (const n of npcList) {
        const dn = Math.hypot(m.x - n.x, m.z - n.z);
        if (dn < minNpcDist) minNpcDist = dn;
      }
      const bi = Math.max(0, Math.min(BUCKET_COUNT - 1, Math.floor((m.x - LOOP_MIN_X) / BUCKET_SIZE)));
      buckets[bi]!.push(i);

      const wantYaw = Math.max(-0.42, Math.min(0.42, Math.atan2(-m.vz, 1.12)));
      m.yaw += (wantYaw - m.yaw) * (safeDt > 0 ? Math.min(1, safeDt * 8) : 1);
      dummy.position.set(m.x, Math.abs(Math.sin(t * 5.2 + m.phase)) * 0.028, m.z);
      dummy.rotation.set(0, m.yaw, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      marcherMesh.setMatrixAt(i, dummy.matrix);
    }
    marcherMesh.instanceMatrix.needsUpdate = true;

    for (let bi = 0; bi < BUCKET_COUNT; bi++) {
      const listA = buckets[bi]!;
      for (let ai = 0; ai < listA.length; ai++) {
        const a = marchersData[listA[ai]!]!;
        for (let nb = bi; nb <= Math.min(BUCKET_COUNT - 1, bi + 1); nb++) {
          const listB = buckets[nb]!;
          const startJ = nb === bi ? ai + 1 : 0;
          for (let aj = startJ; aj < listB.length; aj++) {
            const b = marchersData[listB[aj]!]!;
            const d2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2;
            if (d2 < minPairSq) minPairSq = d2;
          }
        }
      }
    }

    // 4. Advance & solve zero-clipping linked-arm pickets
    for (let i = 0; i < picketsData.length; i++) {
      const p = picketsData[i]!;
      p.x = wrapX(p.x + 0.56 * safeDt);
      let targetZ = p.baseZ;
      for (const ob of activeObs) {
        const dx = p.x - ob.x;
        const minR = ob.r + 0.06;
        const lookAhead = minR + 0.9;
        if (Math.abs(dx) < lookAhead) {
          const dz = targetZ - ob.z;
          if (Math.abs(dz) < minR) {
            const awayDir = Math.abs(dz) > 0.05 ? (dz > 0 ? 1 : -1) : (p.baseZ > -10 ? 1 : -1);
            const needZ = ob.z + awayDir * minR;
            const approach = Math.min(1, (lookAhead - Math.abs(dx)) / 0.9);
            targetZ += (needZ - targetZ) * approach;
          }
        }
      }
      const lerpP = safeDt > 0 ? Math.min(1, safeDt * 10) : 1;
      p.z += (targetZ - p.z) * lerpP;

      // Hard post-lerp safety projection so pickets never clip into player or curb/lane NPCs
      for (let iter = 0; iter < 3; iter++) {
        let hit = false;
        for (const ob of activeObs) {
          const hardR = ob.r - 0.02;
          const dx = p.x - ob.x;
          const dz = p.z - ob.z;
          if (dx * dx + dz * dz < hardR * hardR) {
            hit = true;
            const needDz = Math.sqrt(Math.max(0.01, hardR * hardR - dx * dx)) + 0.02;
            const awayDir =
              iter === 0
                ? (Math.abs(dz) > 0.03 ? (dz > 0 ? 1 : -1) : (p.baseZ > -10 ? 1 : -1))
                : (p.z >= p.baseZ ? 1 : -1);
            p.z = ob.z + awayDir * needDz;
          }
        }
        if (!hit) break;
      }

      const dp = Math.hypot(p.x - playerX, p.z - playerZ);
      if (dp < minPlayerDist) minPlayerDist = dp;
      for (const n of npcList) {
        const dn = Math.hypot(p.x - n.x, p.z - n.z);
        if (dn < minNpcDist) minNpcDist = dn;
      }

      dummy.position.set(p.x, Math.abs(Math.sin(t * 5.2 + i * 0.45)) * 0.018, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      picketMesh.setMatrixAt(i, dummy.matrix);
    }
    picketMesh.instanceMatrix.needsUpdate = true;

    lastAudit = {
      variant,
      marcherCount: marchersData.length,
      picketCount: picketsData.length,
      bearerCount,
      citizenCount: citizenCoords.length,
      bannerCount: banners.length,
      flagCount: flags.length,
      minPairDist: Math.round(Math.sqrt(minPairSq) * 1000) / 1000,
      minPlayerDist: Math.round(minPlayerDist * 1000) / 1000,
      minNpcDist: Math.round(minNpcDist * 1000) / 1000,
    };
    scene.userData.__marchAudit = lastAudit;
  };

  // Run initial frame solve at default spawn [-30, -6] so zero-clipping holds immediately on entry
  update(0, 0, -30, -6);

  return {
    update,
    audit: () => lastAudit,
  };
}

function isNearAnyAnchor(x: number, z: number, anchors: ReadonlyArray<[number, number]>, r: number): boolean {
  const r2 = r * r;
  for (const [ax, az] of anchors) {
    if ((x - ax) ** 2 + (z - az) ** 2 <= r2) return true;
  }
  return false;
}

/**
 * Attach grounded 1989-04-22 Dawn Square university delegation assembly (~1,080 zero-overlap students,
 * 10 grounded bamboo-pole banners + 20 bearers, and natural-skin-tone Great Hall police cordon).
 */
export function attachSquare422Assembly(
  scene: THREE.Scene,
  spawn: [number, number],
  detailAnchors: ReadonlyArray<[number, number]>,
): SquareAssemblyHandle {
  const r = rng(19890422);
  const uniforms = { uTime: { value: 0 } };
  const dummy = new THREE.Object3D();

  // Fixed Square anchors & Great Hall steps sightline clearance
  const fixedExclusions: ObstacleCircle[] = [
    { x: spawn[0], z: spawn[1], r: 3.4 },
    { x: -30, z: -280, r: 3.2 }, // speaker2
    { x: -30, z: -282, r: 2.2 }, // loudspeaker
    { x: 20, z: -260, r: 2.2 },  // loudspeaker
    { x: -60, z: -360, r: 2.2 }, // loudspeaker
    { x: -10, z: -262, r: 3.2 }, // oldman
    { x: -42, z: -300, r: 3.4 }, // stu2b / stu3
    { x: -72, z: -320, r: 3.8 }, // steps / j2_cordon
    { x: -50, z: -345, r: 3.2 }, // hearse
    { x: 20, z: -240, r: 3.6 },  // leave
  ];

  // 10 grounded campus delegation banners facing east (+X -> ry = PI/2) toward player/spawn
  const sqBanners: Array<{ x: number; z: number; ry: number; width: number; cell: number; phase: number }> = [
    { x: -52, z: -256, ry: Math.PI / 2 - 0.14, width: 4.2, cell: 0, phase: 0.2 },
    { x: -26, z: -248, ry: Math.PI / 2 + 0.12, width: 3.8, cell: 1, phase: 1.1 },
    { x: -10, z: -286, ry: Math.PI / 2 - 0.14, width: 4.0, cell: 2, phase: 2.0 },
    { x: -48, z: -282, ry: Math.PI / 2 + 0.08, width: 4.0, cell: 3, phase: 2.9 },
    { x: -64, z: -296, ry: Math.PI / 2 - 0.12, width: 4.2, cell: 4, phase: 3.7 },
    { x: -74, z: -342, ry: Math.PI / 2 + 0.14, width: 4.0, cell: 5, phase: 4.4 },
    { x: -58, z: -366, ry: Math.PI / 2 - 0.10, width: 4.0, cell: 6, phase: 5.1 },
    { x: -38, z: -374, ry: Math.PI / 2 + 0.12, width: 3.8, cell: 7, phase: 5.8 },
    { x: 39, z: -312, ry: Math.PI / 2 - 0.16, width: 4.0, cell: 8, phase: 6.4 },
    { x: 42, z: -348, ry: Math.PI / 2 + 0.12, width: 4.0, cell: 9, phase: 7.1 },
  ];

  const bearerPos: Array<{ x: number; z: number; ry: number }> = [];
  const polePos: Array<{ x: number; z: number }> = [];
  for (const b of sqBanners) {
    const hw = b.width * 0.5;
    // Along ry = PI/2 + d, banner axis local +X aligns roughly with (-sin(d), -cos(d)) -> perpendicular offset along banner width
    const ux = Math.cos(b.ry);
    const uz = -Math.sin(b.ry);
    // Front faces (+sin(ry), +cos(ry)); place bearers behind on local -Z so hands clasp pole cleanly
    const nx = Math.sin(b.ry);
    const nz = Math.cos(b.ry);
    for (const side of [-hw, hw]) {
      const px = b.x + ux * side;
      const pz = b.z + uz * side;
      polePos.push({ x: px, z: pz });
      fixedExclusions.push({ x: px, z: pz, r: 1.05 });
      const bx = px - nx * 0.26;
      const bz = pz - nz * 0.26;
      bearerPos.push({ x: bx, z: bz, ry: Math.atan2(-nz, nx) });
    }
  }

  // Place ~1,080 university delegation students via spatial hash guaranteeing minPairDist >= 0.80m
  const CELL = 0.82;
  const grid = new Map<string, Array<{ x: number; z: number }>>();
  const keyOf = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;

  const canPlaceStudent = (x: number, z: number, minDist = 0.82): boolean => {
    if (x < -89 || x > 50 || z > -228 || z < -392) return false;
    // Keep clear of Monument plinth + granite terrace stairs
    if (Math.abs(x) < 34.5 && z < -296 && z > -364) return false;
    // Keep clear of journalist camera sightline from steps [-72, -320] toward Great Hall kneeling petitioners [-102, -320]
    if (x < -70 && x > -95 && Math.abs(z + 320) < 4.5) return false;
    for (const ex of fixedExclusions) {
      if ((x - ex.x) ** 2 + (z - ex.z) ** 2 < ex.r * ex.r) return false;
    }
    const gx = Math.floor(x / CELL);
    const gz = Math.floor(z / CELL);
    const r2 = minDist * minDist;
    for (let ix = gx - 1; ix <= gx + 1; ix++) {
      for (let iz = gz - 1; iz <= gz + 1; iz++) {
        const list = grid.get(`${ix},${iz}`);
        if (!list) continue;
        for (const p of list) {
          if ((x - p.x) ** 2 + (z - p.z) ** 2 < r2) return false;
        }
      }
    }
    return true;
  };

  const fgStand: Array<{ x: number; z: number; ry: number; colIdx: number }> = [];
  const bgStand: Array<{ x: number; z: number; ry: number; colIdx: number }> = [];
  const sitters: Array<{ x: number; z: number; ry: number; colIdx: number }> = [];

  const registerPoint = (x: number, z: number) => {
    const k = keyOf(x, z);
    let arr = grid.get(k);
    if (!arr) {
      arr = [];
      grid.set(k, arr);
    }
    arr.push({ x, z });
  };

  // Jittered campus block sampling across visible Square (~1,150 students with organic delegation aisles)
  let seedIdx = 0;
  for (let gx = -87; gx <= 34; gx += 2.15) {
    // Delegation aisle breaks every ~19m
    if (Math.abs(((gx + 90) % 21) - 10.5) < 0.75) continue;
    for (let gz = -238; gz >= -386; gz -= 2.15) {
      if (Math.abs(((gz + 400) % 22) - 11) < 0.75) continue;
      // Slightly thinner outer fringe while keeping Great Hall / Monument plaza dense
      if (gx > 16 && r() > 0.58) continue;
      if (gx > 6 && gz > -265 && r() > 0.48) continue;
      const px = gx + (r() - 0.5) * 0.85;
      const pz = gz + (r() - 0.5) * 0.85;
      if (!canPlaceStudent(px, pz, 0.84)) continue;

      // Face generally west (-X -> Math.PI) toward Great Hall steps with subtle natural head variation
      const yaw = Math.PI + (r() - 0.5) * 0.75;
      const isSitZone = px < -38 && px > -84 && gz < -265 && gz > -375 && r() < 0.38;
      if (isSitZone && sitters.length < 270) {
        registerPoint(px, pz);
        sitters.push({ x: px, z: pz, ry: yaw, colIdx: seedIdx++ });
      } else if (isNearAnyAnchor(px, pz, detailAnchors, 22) && fgStand.length < 220) {
        registerPoint(px, pz);
        fgStand.push({ x: px, z: pz, ry: yaw, colIdx: seedIdx++ });
      } else if (bgStand.length < 680) {
        registerPoint(px, pz);
        bgStand.push({ x: px, z: pz, ry: yaw, colIdx: seedIdx++ });
      }
    }
  }

  // Compute true minimum pairwise distance across placed crowd
  let minPairSq = 999;
  const allPts = [...fgStand, ...bgStand, ...sitters];
  for (let i = 0; i < allPts.length; i++) {
    const a = allPts[i]!;
    const gx = Math.floor(a.x / CELL);
    const gz = Math.floor(a.z / CELL);
    for (let ix = gx - 1; ix <= gx + 1; ix++) {
      for (let iz = gz - 1; iz <= gz + 1; iz++) {
        const list = grid.get(`${ix},${iz}`);
        if (!list) continue;
        for (const p of list) {
          const d2 = (a.x - p.x) ** 2 + (a.z - p.z) ** 2;
          if (d2 > 1e-6 && d2 < minPairSq) minPairSq = d2;
        }
      }
    }
  }

  const staticCrowdMat = makeCrowdMaterial(uniforms, false);

  const applyCrowd = (
    mesh: THREE.InstancedMesh,
    items: Array<{ x: number; z: number; ry: number; colIdx: number }>,
    palette: number[],
  ) => {
    items.forEach((p, i) => {
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(0, p.ry, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new THREE.Color(palette[p.colIdx % palette.length]!));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  if (fgStand.length) {
    const fgMesh = new THREE.InstancedMesh(makeMarcherGeo(true), staticCrowdMat, fgStand.length);
    fgMesh.receiveShadow = true;
    fgMesh.name = 'squareCrowdFg';
    applyCrowd(fgMesh, fgStand, CLOTHING_PALETTE);
    scene.add(fgMesh);
  }
  if (bgStand.length) {
    const bgMesh = new THREE.InstancedMesh(makeStandingCrowdLodGeo(), staticCrowdMat, bgStand.length);
    bgMesh.receiveShadow = true;
    bgMesh.name = 'squareCrowdBg';
    applyCrowd(bgMesh, bgStand, CLOTHING_PALETTE);
    scene.add(bgMesh);
  }
  if (sitters.length) {
    const sitMesh = new THREE.InstancedMesh(makeSeatedCrowdGeo(true), staticCrowdMat, sitters.length);
    sitMesh.receiveShadow = true;
    sitMesh.name = 'squareCrowdSit';
    applyCrowd(sitMesh, sitters, CLOTHING_PALETTE);
    scene.add(sitMesh);
  }

  // Police cordon in front of Great Hall steps with visored uniform cap + featureless white head
  const police: Array<{ x: number; z: number; ry: number; colIdx: number }> = [];
  for (let row = 0; row < 2; row++) {
    for (let z = -275; z >= -365; z -= 2.4) {
      police.push({ x: -93 - row * 1.1, z: z - row * 0.3, ry: 0, colIdx: 0 });
    }
  }
  const policeMesh = new THREE.InstancedMesh(makeUniformCordonGeo(), staticCrowdMat, police.length);
  policeMesh.receiveShadow = true;
  policeMesh.name = 'squarePoliceCordon';
  applyCrowd(policeMesh, police, [0x4c5d3c]);
  scene.add(policeMesh);

  // Grounded 422 Square banners + twin segmented bamboo poles + 20 bearers
  const sqTex = buildBannerAtlasTexture('square422');
  const sqBannerGeo = makeTwoPlyClothGeo(10, 2, false);
  fillUvRects(
    sqBannerGeo,
    sqBanners.map(b => b.cell),
    4,
    3,
    sqTex.image.width,
    sqTex.image.height,
    sqBanners.map(b => b.phase),
  );
  const sqBannerMesh = makeInstancedClothMesh(sqBannerGeo, sqTex, sqBanners.length, uniforms, 'banner', false);
  sqBannerMesh.name = 'squareBanners';
  sqBanners.forEach((b, i) => {
    dummy.position.set(b.x, 2.66, b.z);
    dummy.rotation.set(0, b.ry, 0);
    dummy.scale.set(b.width, 0.96, 1);
    dummy.updateMatrix();
    sqBannerMesh.setMatrixAt(i, dummy.matrix);
  });
  sqBannerMesh.instanceMatrix.needsUpdate = true;

  const sqPoleMesh = new THREE.InstancedMesh(
    makeBambooPoleGeo(0x1e1e1e),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.05 }),
    polePos.length,
  );
  sqPoleMesh.receiveShadow = true;
  sqPoleMesh.name = 'squarePoles';
  polePos.forEach((p, i) => {
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1.02, 1);
    dummy.updateMatrix();
    sqPoleMesh.setMatrixAt(i, dummy.matrix);
  });
  sqPoleMesh.instanceMatrix.needsUpdate = true;

  const sqBearerMesh = new THREE.InstancedMesh(makeBearerGeo(), staticCrowdMat, bearerPos.length);
  sqBearerMesh.receiveShadow = true;
  sqBearerMesh.name = 'squareBearers';
  applyCrowd(
    sqBearerMesh,
    bearerPos.map((b, colIdx) => ({ ...b, colIdx })),
    CLOTHING_PALETTE,
  );

  scene.add(sqBannerMesh, sqPoleMesh, sqBearerMesh);

  const auditResult: SquareAuditMetrics = {
    totalCrowd: fgStand.length + bgStand.length + sitters.length,
    bannerCount: sqBanners.length,
    allBannersGrounded: true,
    minCrowdPairDist: Math.round(Math.sqrt(minPairSq) * 1000) / 1000,
  };
  scene.userData.__squareAudit = auditResult;

  return {
    update(_dt: number, t: number): void {
      uniforms.uTime.value = t;
    },
    audit: () => auditResult,
  };
}
