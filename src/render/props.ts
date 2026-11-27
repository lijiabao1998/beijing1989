import type { Part } from './kit';
import { C } from './kit';

const H = Math.PI / 2;

/** Point-to-point tubular strut aligned from `a` to `b` using an open cylinder. */
function strut(a: [number, number, number], b: [number, number, number], thick: number, c: number, seg = 5): Part {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
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

/** True circular bicycle wheel centered at origin `[0, 0, 0]` for real-time wheel rotation. */
export function bikeWheelLocal(tireScale = 0.70, rimScale = 0.64, tube = 0.045): Part[] {
  const parts: Part[] = [
    { p: [0, 0, 0], s: [tireScale, tireScale, tireScale], c: C.black, torus: true, tube, seg: 16, detail: 6 },
    { p: [0, 0, 0], s: [rimScale, rimScale, rimScale], c: C.chrome, torus: true, tube: 0.022, seg: 16, detail: 4 },
    { p: [0, 0, 0], s: [0.055, 0.095, 0.055], c: C.chrome, cyl: true, rx: H, seg: 6 },
  ];
  const spokeLen = rimScale - 0.02;
  for (const rz of [0, Math.PI / 4, H, (3 * Math.PI) / 4]) {
    parts.push({ p: [0, 0, 0], s: [spokeLen, 0.010, 0.010], c: 0xb8b8b4, rz });
  }
  return parts;
}

/** True circular bicycle wheel at `[x, y, 0]` with torus tire, chrome rim, hub axle, and 4 spoke bars. */
function bikeWheel(x: number, y: number, tireScale = 0.70, rimScale = 0.64, tube = 0.045): Part[] {
  return bikeWheelLocal(tireScale, rimScale, tube).map(pt => ({
    ...pt,
    p: [pt.p[0] + x, pt.p[1] + y, pt.p[2]] as [number, number, number],
  }));
}

/** 28-inch Flying Pigeon / Forever bicycle (二八大槓) frame + optional rider (without wheels when mounted separately). */
export function bikeBodyParts(rider?: number, includeWheels = true, includeHead = true): Part[] {
  const frame = 0x18261c;
  const guard = 0x1a281e;
  const bb: [number, number, number] = [-0.18, 0.30, 0];
  const rAxle: [number, number, number] = [-0.56, 0.36, 0];
  const seatTop: [number, number, number] = [-0.26, 0.81, 0];
  const headBot: [number, number, number] = [0.43, 0.79, 0];
  const headTop: [number, number, number] = [0.38, 0.90, 0];

  const parts: Part[] = [
    ...(includeWheels ? [...bikeWheel(-0.56, 0.36), ...bikeWheel(0.58, 0.36)] : []),
    // curved mudguards (泥除) + rear white tail tip, red reflector, and fender stays
    { p: [-0.56, 0.36, 0], s: [0.80, 0.80, 1.35], c: guard, torus: true, tube: 0.032, seg: 10, detail: 4, arc: Math.PI * 0.96, rz: 0.20 },
    { p: [-0.955, 0.355, 0], s: [0.055, 0.11, 0.074], c: 0xe8e4d8, rz: -0.18 },
    { p: [-0.985, 0.375, 0], s: [0.024, 0.044, 0.044], c: 0xc82218 },
    { p: [0.58, 0.36, 0], s: [0.79, 0.79, 1.35], c: guard, torus: true, tube: 0.032, seg: 10, detail: 4, arc: Math.PI * 0.76, rz: 0.32 },
    strut([-0.56, 0.36, 0.045], [-0.87, 0.56, 0.04], 0.012, C.chrome, 4),
    strut([-0.56, 0.36, -0.045], [-0.87, 0.56, -0.04], 0.012, C.chrome, 4),
    strut([0.58, 0.36, 0.045], [0.88, 0.56, 0.04], 0.012, C.chrome, 4),
    strut([0.58, 0.36, -0.045], [0.88, 0.56, -0.04], 0.012, C.chrome, 4),
    // 28-inch double-crossbar diamond frame (雙樑)
    strut(seatTop, [0.39, 0.88, 0], 0.032, frame),               // main top tube
    strut([-0.25, 0.73, 0], [0.42, 0.81, 0], 0.028, frame),       // iconic double crossbar
    strut(bb, [-0.27, 0.85, 0], 0.034, frame),                    // seat tube + post
    strut(bb, headBot, 0.036, frame),                             // down tube
    strut(headBot, headTop, 0.044, frame),                        // head tube
    strut([0.43, 0.79, 0.038], [0.58, 0.36, 0.042], 0.026, frame),  // front fork L
    strut([0.43, 0.79, -0.038], [0.58, 0.36, -0.042], 0.026, frame), // front fork R
    strut([-0.255, 0.78, 0.028], [-0.56, 0.36, 0.045], 0.022, frame), // seat stay L
    strut([-0.255, 0.78, -0.028], [-0.56, 0.36, -0.045], 0.022, frame), // seat stay R
    strut([-0.18, 0.30, 0.028], [-0.56, 0.36, 0.045], 0.024, frame), // chain stay L
    strut([-0.18, 0.30, -0.028], [-0.56, 0.36, -0.045], 0.024, frame), // chain stay R
    // full enclosed chain case (全鏈盒) on right side + crank arms & pedals
    { p: [-0.37, 0.33, -0.052], s: [0.44, 0.11, 0.032], c: 0x1e2c22, rz: -0.15 },
    { p: [-0.18, 0.30, -0.052], s: [0.18, 0.036, 0.18], c: 0x1e2c22, cyl: true, rx: H, seg: 8 },
    strut([-0.18, 0.30, 0.07], [-0.04, 0.38, 0.07], 0.020, C.chrome, 4),
    strut([-0.18, 0.30, -0.07], [-0.30, 0.22, -0.07], 0.020, C.chrome, 4),
    { p: [-0.04, 0.38, 0.11], s: [0.085, 0.028, 0.065], c: 0x1c1c1e },
    { p: [-0.30, 0.22, -0.11], s: [0.085, 0.028, 0.065], c: 0x1c1c1e },
    // swept-back handlebars, rubber grips, brake levers, rotary bell, bullet dynamo headlight
    strut(headTop, [0.36, 0.98, 0], 0.026, C.chrome),
    { p: [0.36, 0.98, 0], s: [0.032, 0.032, 0.30], c: C.chrome },
    strut([0.36, 0.98, 0.15], [0.25, 0.95, 0.23], 0.024, C.chrome),
    strut([0.36, 0.98, -0.15], [0.25, 0.95, -0.23], 0.024, C.chrome),
    strut([0.28, 0.96, 0.21], [0.20, 0.93, 0.25], 0.032, C.black, 5),  // grip L
    strut([0.28, 0.96, -0.21], [0.20, 0.93, -0.25], 0.032, C.black, 5), // grip R
    { p: [0.32, 0.93, 0.19], s: [0.08, 0.015, 0.02], c: C.chrome, ry: -0.5 }, // brake lever L
    { p: [0.32, 0.93, -0.19], s: [0.08, 0.015, 0.02], c: C.chrome, ry: 0.5 }, // brake lever R
    { p: [0.35, 1.005, 0.11], s: [0.052, 0.036, 0.052], c: C.chrome, cyl: true, seg: 7 }, // rotary bell
    { p: [0.49, 0.79, 0], s: [0.075, 0.11, 0.075], c: C.chrome, cyl: true, rz: H, seg: 7, top: 0.65 }, // dynamo headlight
    { p: [0.548, 0.79, 0], s: [0.062, 0.016, 0.062], c: 0xf4e4a8, cyl: true, rz: H, seg: 7 },
    { p: [0.52, 0.59, 0.06], s: [0.04, 0.08, 0.04], c: 0x86888a, cyl: true, seg: 6 }, // dynamo bottle
    // brown leather coiled-spring saddle & rear luggage rack + canvas satchel
    { p: [-0.28, 0.87, 0], s: [0.23, 0.055, 0.15], c: 0x4a2a18, bevel: true },
    { p: [-0.34, 0.82, 0.045], s: [0.036, 0.055, 0.036], c: C.chrome, cyl: true, seg: 5 },
    { p: [-0.34, 0.82, -0.045], s: [0.036, 0.055, 0.036], c: C.chrome, cyl: true, seg: 5 },
    { p: [-0.57, 0.79, 0.095], s: [0.42, 0.024, 0.024], c: C.chrome },
    { p: [-0.57, 0.79, -0.095], s: [0.42, 0.024, 0.024], c: C.chrome },
    { p: [-0.42, 0.79, 0], s: [0.024, 0.024, 0.21], c: C.chrome },
    { p: [-0.57, 0.79, 0], s: [0.024, 0.024, 0.21], c: C.chrome },
    { p: [-0.75, 0.79, 0], s: [0.024, 0.024, 0.21], c: C.chrome },
    strut([-0.68, 0.79, 0.095], rAxle, 0.020, C.chrome, 4),
    strut([-0.68, 0.79, -0.095], [-0.56, 0.36, -0.045], 0.020, C.chrome, 4),
    // olive-green canvas satchel (軍挎包) strapped on rack
    { p: [-0.56, 0.87, 0.02], s: [0.26, 0.13, 0.18], c: 0x555b3c, bevel: true },
    { p: [-0.56, 0.87, 0.02], s: [0.035, 0.145, 0.19], c: 0x3b3f28 },
  ];

  if (rider === undefined) {
    parts.push(strut([-0.58, 0.34, 0.06], [-0.63, 0.02, 0.20], 0.024, C.chrome, 5)); // kickstand
  } else {
    parts.push(
      { p: [-0.18, 1.17, 0], s: [0.235, 0.56, 0.365], c: rider, cyl: true, seg: 7, top: 1.12, rz: -0.22 }, // leaning jacket
      { p: [-0.08, 1.45, 0], s: [0.185, 0.06, 0.235], c: rider, cyl: true, seg: 6, rz: -0.15 },             // folded collar
      { p: [-0.04, 1.37, 0], s: [0.055, 0.15, 0.11], c: 0xe8e2d2, rz: -0.22 },                             // shirt V-neck
      { p: [-0.16, 1.18, 0], s: [0.255, 0.50, 0.04], c: 0x565c3a, rx: 0.55, rz: -0.22 },                   // satchel strap
      ...(includeHead ? [
        { p: [-0.08, 1.59, 0], s: [0.19, 0.225, 0.175], c: 0xf0ede6, sphere: true, detail: 1 },
      ] as Part[] : []),
      // arms gripping swept-back handlebars
      strut([-0.09, 1.34, 0.20], [0.08, 1.14, 0.23], 0.095, rider, 6),
      strut([0.08, 1.14, 0.23], [0.23, 0.96, 0.23], 0.082, rider, 6),
      strut([-0.09, 1.34, -0.20], [0.08, 1.14, -0.23], 0.095, rider, 6),
      strut([0.08, 1.14, -0.23], [0.23, 0.96, -0.23], 0.082, rider, 6),
      { p: [0.23, 0.95, 0.23], s: [0.075, 0.078, 0.072], c: 0xf0ede6, sphere: true, detail: 0 },
      { p: [0.23, 0.95, -0.23], s: [0.075, 0.078, 0.072], c: 0xf0ede6, sphere: true, detail: 0 },
      // articulated thighs, calves, and shoes meeting crank pedals
      strut([-0.25, 0.88, 0.11], [-0.04, 0.65, 0.11], 0.125, C.navy, 6),
      strut([-0.04, 0.65, 0.11], [-0.04, 0.42, 0.11], 0.105, C.navy, 6),
      strut([-0.25, 0.88, -0.11], [-0.23, 0.56, -0.11], 0.125, C.navy, 6),
      strut([-0.23, 0.56, -0.11], [-0.29, 0.26, -0.11], 0.105, C.navy, 6),
      { p: [-0.02, 0.41, 0.11], s: [0.19, 0.065, 0.10], c: 0x1c1b19 },
      { p: [-0.27, 0.25, -0.11], s: [0.19, 0.065, 0.10], c: 0x1c1b19 },
    );
  }
  return parts;
}

/** Static 28-inch Flying Pigeon / Forever bicycle (二八大槓), oriented along +x. */
export function bike(rider?: number): Part[] {
  return bikeBodyParts(rider, true, true);
}

/** Sculpted standing / walking character with featureless alabaster-white head & layered jacket, facing +x. */
export function person(jacket: number, trousers = C.navy, _hair = C.black, headband = false): Part[] {
  const skin = 0xf0ede6, skinShade = 0xe2ddd2;
  const parts: Part[] = [
    // rounded footwear with pale rubber soles + contoured uppers
    { p: [0.025, 0.015, 0.09], s: [0.23, 0.030, 0.11], c: 0xd8d2c4, cyl: true, seg: 8 },
    { p: [0.025, 0.015, -0.09], s: [0.23, 0.030, 0.11], c: 0xd8d2c4, cyl: true, seg: 8 },
    { p: [0.02, 0.052, 0.09], s: [0.21, 0.052, 0.105], c: 0x1c1b19, cyl: true, seg: 8, top: 0.78 },
    { p: [0.02, 0.052, -0.09], s: [0.21, 0.052, 0.105], c: 0x1c1b19, cyl: true, seg: 8, top: 0.78 },
    // tapered calves + thighs
    { p: [0, 0.27, 0.09], s: [0.135, 0.40, 0.125], c: trousers, cyl: true, seg: 7, top: 1.15 },
    { p: [0, 0.27, -0.09], s: [0.135, 0.40, 0.125], c: trousers, cyl: true, seg: 7, top: 1.15 },
    { p: [0, 0.63, 0.09], s: [0.16, 0.36, 0.145], c: trousers, cyl: true, seg: 7, top: 1.12 },
    { p: [0, 0.63, -0.09], s: [0.16, 0.36, 0.145], c: trousers, cyl: true, seg: 7, top: 1.12 },
    // pelvis, belt & brass buckle
    { p: [0, 0.81, 0], s: [0.255, 0.065, 0.41], c: 0x241d16, cyl: true, seg: 8 },
    { p: [0.128, 0.81, 0], s: [0.018, 0.052, 0.068], c: C.brass },
    // tapered jacket skirt, sculpted chest & broad shoulder yoke
    { p: [0, 0.90, 0], s: [0.268, 0.16, 0.42], c: jacket, cyl: true, seg: 8, top: 0.94 },
    { p: [0, 1.18, 0], s: [0.245, 0.44, 0.39], c: jacket, cyl: true, seg: 8, top: 1.14 },
    { p: [0.115, 1.32, 0], s: [0.045, 0.17, 0.115], c: 0xe8e2d2 },
    { p: [0.125, 1.30, 0.072], s: [0.028, 0.20, 0.072], c: jacket, rx: -0.25 },
    { p: [0.125, 1.30, -0.072], s: [0.028, 0.20, 0.072], c: jacket, rx: 0.25 },
    { p: [-0.01, 1.415, 0], s: [0.21, 0.065, 0.26], c: jacket, cyl: true, seg: 8, top: 0.85 },
    // rounded shoulder caps, cylindrical sleeves & sculpted hands
    { p: [0, 1.35, 0.245], s: [0.135, 0.13, 0.12], c: jacket, sphere: true, detail: 0 },
    { p: [0, 1.35, -0.245], s: [0.135, 0.13, 0.12], c: jacket, sphere: true, detail: 0 },
    { p: [0.005, 1.22, 0.255], s: [0.12, 0.26, 0.11], c: jacket, cyl: true, seg: 6, top: 0.88, open: true },
    { p: [0.005, 1.22, -0.255], s: [0.12, 0.26, 0.11], c: jacket, cyl: true, seg: 6, top: 0.88, open: true },
    { p: [0.028, 1.00, 0.255], s: [0.105, 0.23, 0.095], c: jacket, cyl: true, seg: 6, top: 0.82, rz: 0.18 },
    { p: [0.028, 1.00, -0.255], s: [0.105, 0.23, 0.095], c: jacket, cyl: true, seg: 6, top: 0.82, rz: 0.18 },
    { p: [0.052, 0.84, 0.255], s: [0.082, 0.105, 0.075], c: skin, sphere: true, detail: 0 },
    { p: [0.052, 0.84, -0.255], s: [0.082, 0.105, 0.075], c: skin, sphere: true, detail: 0 },
    // neck & sculpted featureless matte-white cranium
    { p: [0, 1.46, 0], s: [0.10, 0.09, 0.095], c: skinShade, cyl: true, seg: 6 },
    { p: [0.015, 1.59, 0], s: [0.195, 0.235, 0.178], c: skin, sphere: true, detail: 1 },
    // cross-body olive canvas student satchel (軍綠色帆布挎包)
    { p: [0, 1.15, 0], s: [0.275, 0.54, 0.04], c: 0x5c6240, rx: 0.58 },
    { p: [-0.05, 0.88, 0.235], s: [0.20, 0.22, 0.085], c: 0x565c3a, bevel: true },
  ];
  if (headband) {
    parts.push(
      { p: [0.012, 1.645, 0], s: [0.208, 0.046, 0.192], c: 0xf4f1ea, cyl: true, seg: 8 },
      { p: [-0.115, 1.58, 0.025], s: [0.032, 0.14, 0.042], c: 0xf4f1ea, rz: -0.35 },
    );
  }
  return parts;
}

/** Sculpted lean character for medium crowds (march, blockade, foreground Square), facing +x. */
export function crowdPerson(jacket: number, trousers = C.navy, _hair = C.black, headband = false): Part[] {
  const parts: Part[] = [
    { p: [0.02, 0.04, 0.09], s: [0.21, 0.075, 0.105], c: 0x1c1b19, cyl: true, seg: 6, top: 0.78 },
    { p: [0.02, 0.04, -0.09], s: [0.21, 0.075, 0.105], c: 0x1c1b19, cyl: true, seg: 6, top: 0.78 },
    { p: [0, 0.43, 0.09], s: [0.145, 0.72, 0.135], c: trousers, cyl: true, seg: 6, top: 1.12 },
    { p: [0, 0.43, -0.09], s: [0.145, 0.72, 0.135], c: trousers, cyl: true, seg: 6, top: 1.12 },
    { p: [0, 0.81, 0], s: [0.252, 0.055, 0.40], c: 0x241d16, cyl: true, seg: 6 },
    { p: [0, 1.12, 0], s: [0.248, 0.62, 0.395], c: jacket, cyl: true, seg: 7, top: 1.12, tint: true },
    { p: [0.116, 1.32, 0], s: [0.042, 0.16, 0.105], c: 0xebe7dc },
    { p: [0.125, 1.30, 0.068], s: [0.026, 0.18, 0.066], c: jacket, rx: -0.24, tint: true },
    { p: [0.125, 1.30, -0.068], s: [0.026, 0.18, 0.066], c: jacket, rx: 0.24, tint: true },
    { p: [0.015, 1.43, 0], s: [0.19, 0.065, 0.24], c: jacket, cyl: true, seg: 6, tint: true },
    { p: [0.01, 1.14, 0.245], s: [0.115, 0.50, 0.10], c: jacket, cyl: true, seg: 5, top: 0.80, rz: 0.08, tint: true },
    { p: [0.01, 1.14, -0.245], s: [0.115, 0.50, 0.10], c: jacket, cyl: true, seg: 5, top: 0.80, rz: 0.08, tint: true },
    { p: [0.015, 1.58, 0], s: [0.195, 0.23, 0.175], c: 0xf0ede6, sphere: true, detail: 0 },
    { p: [-0.04, 0.89, 0.225], s: [0.19, 0.21, 0.08], c: 0x565c3a },
  ];
  if (headband) {
    parts.push(
      { p: [0.012, 1.64, 0], s: [0.205, 0.046, 0.188], c: 0xf4f1ea, cyl: true, seg: 8 },
      { p: [-0.115, 1.575, 0.025], s: [0.032, 0.13, 0.04], c: 0xf4f1ea, rz: -0.35 },
    );
  }
  return parts;
}

/** Sculpted seated student (for Square sit-in / hunger strike camp), facing +x. */
export function sitPerson(jacket: number, trousers = C.navy, _hair = C.black, headband = true): Part[] {
  const parts: Part[] = [
    // folded legs + rounded canvas shoes
    { p: [0.16, 0.10, 0.13], s: [0.35, 0.13, 0.135], c: trousers, cyl: true, seg: 6, rz: H, ry: 0.35 },
    { p: [0.16, 0.10, -0.13], s: [0.35, 0.13, 0.135], c: trousers, cyl: true, seg: 6, rz: H, ry: -0.35 },
    { p: [0.31, 0.075, 0.06], s: [0.30, 0.12, 0.125], c: trousers, cyl: true, seg: 6, rz: H, ry: -0.95 },
    { p: [0.31, 0.075, -0.06], s: [0.30, 0.12, 0.125], c: trousers, cyl: true, seg: 6, rz: H, ry: 0.95 },
    { p: [0.39, 0.02, 0.16], s: [0.16, 0.032, 0.095], c: 0xd8d2c4, cyl: true, seg: 6, ry: -0.9 },
    { p: [0.39, 0.02, -0.16], s: [0.16, 0.032, 0.095], c: 0xd8d2c4, cyl: true, seg: 6, ry: 0.9 },
    { p: [0.39, 0.055, 0.16], s: [0.15, 0.052, 0.09], c: 0x1c1b19, cyl: true, seg: 6, ry: -0.9 },
    { p: [0.39, 0.055, -0.16], s: [0.15, 0.052, 0.09], c: 0x1c1b19, cyl: true, seg: 6, ry: 0.9 },
    // tapered torso, folded lapels, collar, cylindrical sleeves on knees, white hands
    { p: [0, 0.44, 0], s: [0.24, 0.56, 0.39], c: jacket, cyl: true, seg: 7, top: 1.12, rz: -0.08, tint: true },
    { p: [0.095, 0.65, 0], s: [0.05, 0.14, 0.11], c: 0xe8e2d2, rz: -0.08 },
    { p: [0.105, 0.63, 0.066], s: [0.026, 0.16, 0.064], c: jacket, rx: -0.24, rz: -0.08, tint: true },
    { p: [0.105, 0.63, -0.066], s: [0.026, 0.16, 0.064], c: jacket, rx: 0.24, rz: -0.08, tint: true },
    { p: [-0.01, 0.73, 0], s: [0.20, 0.06, 0.25], c: jacket, cyl: true, seg: 6, tint: true },
    { p: [0.12, 0.44, 0.22], s: [0.11, 0.39, 0.10], c: jacket, cyl: true, seg: 6, top: 0.82, rz: 0.48, tint: true },
    { p: [0.12, 0.44, -0.22], s: [0.11, 0.39, 0.10], c: jacket, cyl: true, seg: 6, top: 0.82, rz: 0.48, tint: true },
    { p: [0.25, 0.27, 0.21], s: [0.08, 0.085, 0.075], c: 0xf0ede6, sphere: true, detail: 0 },
    { p: [0.25, 0.27, -0.21], s: [0.08, 0.085, 0.075], c: 0xf0ede6, sphere: true, detail: 0 },
    // neck & featureless matte-white head
    { p: [-0.01, 0.78, 0], s: [0.095, 0.08, 0.09], c: 0xe2ddd2, cyl: true, seg: 6 },
    { p: [0.005, 0.905, 0], s: [0.195, 0.23, 0.18], c: 0xf0ede6, sphere: true, detail: 1 },
    // enamel mug beside the knee
    { p: [0.35, 0.055, 0.30], s: [0.09, 0.11, 0.09], c: C.enamel, cyl: true, seg: 8 },
    { p: [0.35, 0.108, 0.30], s: [0.094, 0.016, 0.094], c: 0x26446e, cyl: true, seg: 8 },
  ];
  if (headband) {
    parts.push(
      { p: [0.005, 0.955, 0], s: [0.208, 0.046, 0.192], c: 0xf4f1ea, cyl: true, seg: 8 },
      { p: [-0.125, 0.895, 0.03], s: [0.032, 0.13, 0.042], c: 0xf4f1ea, rz: -0.35 },
    );
  }
  return parts;
}

/** Twin rear cargo-tricycle wheels centered around the rear axle origin `[0, 0, 0]`. */
export function tricycleRearWheelsLocal(): Part[] {
  const p: Part[] = [
    { p: [0, 0, 0.58], s: [0.62, 0.62, 0.78], c: C.black, torus: true, tube: 0.05, seg: 14, detail: 5 },
    { p: [0, 0, 0.58], s: [0.56, 0.56, 0.66], c: C.chrome, torus: true, tube: 0.024, seg: 14, detail: 4 },
    { p: [0, 0, -0.58], s: [0.62, 0.62, 0.78], c: C.black, torus: true, tube: 0.05, seg: 14, detail: 5 },
    { p: [0, 0, -0.58], s: [0.56, 0.56, 0.66], c: C.chrome, torus: true, tube: 0.024, seg: 14, detail: 4 },
  ];
  for (const rz of [0, Math.PI / 4, H, (3 * Math.PI) / 4]) {
    p.push({ p: [0, 0, 0.58], s: [0.54, 0.012, 0.012], c: 0xb8b8b4, rz });
    p.push({ p: [0, 0, -0.58], s: [0.54, 0.012, 0.012], c: 0xb8b8b4, rz });
  }
  return p;
}

/** 1980s Beijing flatbed cargo tricycle body parts (optionally omitting wheels for animated wheel rigs). */
export function tricycleBodyParts(includeWheels = true): Part[] {
  const frame = 0x222a24;
  const p: Part[] = [];
  if (includeWheels) {
    p.push(
      ...bikeWheel(0.92, 0.34, 0.66, 0.60, 0.045),
      ...tricycleRearWheelsLocal().map(pt => ({
        ...pt,
        p: [pt.p[0] - 0.58, pt.p[1] + 0.32, pt.p[2]] as [number, number, number],
      })),
    );
  }
  p.push(
    // rear axle, leaf springs, fork, frame, handlebars, bell, saddle, chain guard
    { p: [-0.58, 0.32, 0], s: [0.048, 1.24, 0.048], c: C.chrome, cyl: true, rx: H, seg: 6 },
    { p: [-0.58, 0.41, 0.42], s: [0.48, 0.04, 0.06], c: 0x2c2e30 },
    { p: [-0.58, 0.41, -0.42], s: [0.48, 0.04, 0.06], c: 0x2c2e30 },
    { p: [0.92, 0.34, 0], s: [0.76, 0.76, 1.4], c: frame, torus: true, tube: 0.032, seg: 10, detail: 4, arc: Math.PI * 0.8, rz: 0.32 },
    strut([0.76, 0.72, 0.038], [0.92, 0.34, 0.042], 0.028, frame),
    strut([0.76, 0.72, -0.038], [0.92, 0.34, -0.042], 0.028, frame),
    strut([0.76, 0.72, 0], [0.71, 0.85, 0], 0.042, frame),
    strut([0.71, 0.85, 0], [0.67, 0.96, 0], 0.028, C.chrome),
    { p: [0.66, 0.96, 0], s: [0.035, 0.035, 0.50], c: C.chrome },
    { p: [0.66, 0.96, 0.22], s: [0.042, 0.042, 0.11], c: C.black, cyl: true, rx: H, seg: 6 },
    { p: [0.66, 0.96, -0.22], s: [0.042, 0.042, 0.11], c: C.black, cyl: true, rx: H, seg: 6 },
    { p: [0.67, 0.99, 0.12], s: [0.055, 0.04, 0.055], c: C.chrome, cyl: true, seg: 7 },
    strut([0.36, 0.32, 0], [0.75, 0.72, 0], 0.04, frame),
    strut([0.36, 0.32, 0], [0.28, 0.76, 0], 0.036, frame),
    { p: [0.27, 0.79, 0], s: [0.24, 0.06, 0.16], c: 0x3b2314, bevel: true },
    { p: [0.16, 0.33, -0.05], s: [0.46, 0.11, 0.035], c: 0x1e2c22 },
    // weathered wooden plank flatbed + iron corner brackets + side rails
    { p: [-0.58, 0.52, -0.44], s: [1.38, 0.055, 0.21], c: 0x5c4129 },
    { p: [-0.58, 0.52, -0.22], s: [1.38, 0.055, 0.21], c: 0x533a24 },
    { p: [-0.58, 0.52, 0], s: [1.38, 0.055, 0.21], c: 0x62462d },
    { p: [-0.58, 0.52, 0.22], s: [1.38, 0.055, 0.21], c: 0x573d27 },
    { p: [-0.58, 0.52, 0.44], s: [1.38, 0.055, 0.21], c: 0x5c4129 },
    { p: [-0.58, 0.61, 0.535], s: [1.38, 0.12, 0.05], c: C.darkWood },
    { p: [-0.58, 0.61, -0.535], s: [1.38, 0.12, 0.05], c: C.darkWood },
    { p: [0.085, 0.61, 0], s: [0.05, 0.12, 1.12], c: C.darkWood },
    { p: [-1.245, 0.61, 0], s: [0.05, 0.12, 1.12], c: C.darkWood },
  );
  for (const cx of [-1.24, 0.08]) for (const cz of [-0.53, 0.53]) {
    p.push({ p: [cx, 0.60, cz], s: [0.07, 0.16, 0.07], c: 0x2c2e30 }); // corner iron brackets
  }
  // 2 detailed thermos flasks (暖水瓶) with bamboo/red shells, chrome shoulders, red corks, wire handles
  const thermoses: [number, number, number][] = [[-0.22, -0.32, 0xa62e24], [-0.22, -0.06, 0x9c824c]];
  for (const [tx, tz, tc] of thermoses) {
    p.push(
      { p: [tx, 0.72, tz], s: [0.16, 0.34, 0.16], c: tc, cyl: true, seg: 10 },
      { p: [tx, 0.92, tz], s: [0.155, 0.07, 0.155], c: C.chrome, cyl: true, seg: 10, top: 0.54 },
      { p: [tx, 0.975, tz], s: [0.085, 0.05, 0.085], c: 0xb83226, cyl: true, seg: 7 },
      { p: [tx, 0.89, tz], s: [0.18, 0.18, 0.18], c: C.chrome, torus: true, tube: 0.045, seg: 10, detail: 4, arc: Math.PI, ry: H },
    );
  }
  // large enamel mung-bean soup barrel (綠豆湯桶) with blue rim, lid, ladle
  p.push(
    { p: [-0.78, 0.76, 0.12], s: [0.46, 0.42, 0.46], c: C.enamel, cyl: true, seg: 12 },
    { p: [-0.78, 0.95, 0.12], s: [0.48, 0.045, 0.48], c: 0x26446e, cyl: true, seg: 12 },
    { p: [-0.78, 0.99, 0.12], s: [0.44, 0.038, 0.44], c: C.enamel, cyl: true, seg: 12 },
    { p: [-0.78, 1.03, 0.12], s: [0.08, 0.045, 0.08], c: 0x26446e, cyl: true, seg: 8 },
    { p: [-0.63, 1.07, 0.22], s: [0.028, 0.26, 0.028], c: C.chrome, rz: -0.45 },
    // wooden tray of 6 white porcelain bowls
    { p: [-0.26, 0.565, 0.28], s: [0.46, 0.04, 0.34], c: 0x6b4c2e },
  );
  for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
    p.push({
      p: [-0.39 + col * 0.13, 0.615, 0.20 + row * 0.16],
      s: [0.075, 0.06, 0.075],
      c: 0xf4f1e8,
      cyl: true,
      seg: 8,
      top: 1.45,
    });
  }
  return p;
}

/** 1980s Beijing flatbed cargo tricycle (平板三輪車) with thermoses, soup barrel & bowls, facing +x. */
export function tricycle(): Part[] {
  return tricycleBodyParts(true);
}

/** 1980s Beijing Medical Ambulance van (救護車), oriented along +x. */
export function ambulance(): Part[] {
  const white = 0xf2efe6, glass = 0x24323e, frosted = 0xb8c8cc, red = C.redCross;
  const p: Part[] = [
    { p: [-0.2, 0.94, 0], s: [4.1, 1.12, 1.84], c: white, bevel: true },
    { p: [2.02, 0.78, 0], s: [0.48, 0.84, 1.80], c: white, bevel: true },
    { p: [1.96, 1.46, 0], s: [0.56, 0.54, 1.78], c: white, wedge: true },
    { p: [1.73, 1.50, 0], s: [0.05, 0.56, 1.56], c: glass, rz: 0.45 },
    { p: [1.75, 1.50, 0], s: [0.055, 0.56, 0.04], c: 0x1e2022, rz: 0.45 },       // center windshield divider
    { p: [1.85, 1.32, 0.35], s: [0.02, 0.02, 0.38], c: 0x181818, rx: 0.25 },     // wiper L
    { p: [1.85, 1.32, -0.35], s: [0.02, 0.02, 0.38], c: 0x181818, rx: 0.25 },    // wiper R
    { p: [-0.2, 1.82, 0], s: [3.9, 0.66, 1.80], c: white, bevel: true },
    { p: [0.18, 2.18, 0], s: [3.2, 0.08, 1.56], c: 0xe2dfd4, bevel: true },
    // red medical waist stripe + thin accent stripe
    { p: [-0.02, 0.94, 0], s: [4.48, 0.16, 1.87], c: red },
    { p: [-0.02, 0.81, 0], s: [4.46, 0.035, 1.86], c: red },
    // cab doors, handles, side mirrors, cab windows & frosted rear patient windows
    { p: [1.45, 1.48, 0.925], s: [0.66, 0.44, 0.03], c: glass },
    { p: [1.45, 1.48, -0.925], s: [0.66, 0.44, 0.03], c: glass },
    { p: [1.22, 1.06, 0.935], s: [0.14, 0.035, 0.03], c: C.chrome },
    { p: [1.22, 1.06, -0.935], s: [0.14, 0.035, 0.03], c: C.chrome },
    { p: [1.88, 1.36, 0.99], s: [0.05, 0.18, 0.11], c: 0x1f2124 },
    { p: [1.88, 1.36, -0.99], s: [0.05, 0.18, 0.11], c: 0x1f2124 },
    { p: [-1.15, 1.52, 0.925], s: [0.95, 0.42, 0.03], c: frosted },
    { p: [-1.15, 1.52, -0.925], s: [0.95, 0.42, 0.03], c: frosted },
    { p: [-2.26, 1.52, 0.36], s: [0.03, 0.42, 0.52], c: frosted },
    { p: [-2.26, 1.52, -0.36], s: [0.03, 0.42, 0.52], c: frosted },
    { p: [-2.26, 1.05, 0], s: [0.03, 1.35, 0.03], c: 0x555550 },               // rear double-door seam
    // 3D Red Cross emblems on both sides, rear, and forehead
    { p: [-0.25, 1.48, 0.93], s: [0.56, 0.16, 0.03], c: red },
    { p: [-0.25, 1.48, 0.93], s: [0.16, 0.56, 0.03], c: red },
    { p: [-0.25, 1.48, -0.93], s: [0.56, 0.16, 0.03], c: red },
    { p: [-0.25, 1.48, -0.93], s: [0.16, 0.56, 0.03], c: red },
    { p: [-2.27, 0.96, 0], s: [0.03, 0.44, 0.14], c: red },
    { p: [-2.27, 0.96, 0], s: [0.03, 0.14, 0.44], c: red },
    { p: [1.66, 1.94, 0], s: [0.03, 0.24, 0.08], c: red },
    { p: [1.66, 1.94, 0], s: [0.03, 0.08, 0.24], c: red },
    // chrome bumpers, radiator grille, round headlights + amber fog lights + rear taillights
    { p: [2.29, 0.42, 0], s: [0.12, 0.14, 1.88], c: C.chrome, bevel: true },
    { p: [-2.29, 0.42, 0], s: [0.10, 0.14, 1.88], c: C.chrome, bevel: true },
    { p: [2.27, 0.68, 0], s: [0.04, 0.24, 0.90], c: 0x2c2e32 },
    { p: [2.28, 0.68, 0], s: [0.03, 0.03, 0.86], c: C.chrome },
    { p: [2.27, 0.70, 0.66], s: [0.18, 0.04, 0.18], c: 0xfff2c0, cyl: true, rz: H, seg: 10 },
    { p: [2.27, 0.70, -0.66], s: [0.18, 0.04, 0.18], c: 0xfff2c0, cyl: true, rz: H, seg: 10 },
    { p: [2.27, 0.52, 0.68], s: [0.11, 0.03, 0.14], c: 0xffb838 },
    { p: [2.27, 0.52, -0.68], s: [0.11, 0.03, 0.14], c: 0xffb838 },
    { p: [-2.27, 0.64, 0.74], s: [0.04, 0.20, 0.14], c: 0xd82820 },
    { p: [-2.27, 0.64, -0.74], s: [0.04, 0.20, 0.14], c: 0xd82820 },
    // rooftop chrome lightbar with red & blue dome sirens + megaphone speaker
    { p: [1.18, 2.22, 0], s: [0.24, 0.08, 0.98], c: C.chrome },
    { p: [1.18, 2.31, 0.34], s: [0.18, 0.14, 0.22], c: 0xd82820, cyl: true, seg: 10 },
    { p: [1.18, 2.38, 0.34], s: [0.17, 0.10, 0.20], c: 0xe6362c, sphere: true, detail: 0 },
    { p: [1.18, 2.31, -0.34], s: [0.18, 0.14, 0.22], c: 0x2058c4, cyl: true, seg: 10 },
    { p: [1.18, 2.38, -0.34], s: [0.17, 0.10, 0.20], c: 0x2a6be0, sphere: true, detail: 0 },
    { p: [1.22, 2.32, 0], s: [0.16, 0.22, 0.16], c: 0xc0c0b8, cyl: true, rz: H, seg: 8, top: 0.45 },
  ];
  for (const x of [-1.42, 1.42]) for (const z of [0.88, -0.88]) {
    const out = z > 0 ? 0.06 : -0.06;
    p.push(
      { p: [x, 0.42, z * 0.92], s: [0.84, 0.32, 0.18], c: 0x1a1a1c },           // recessed wheel arch shadow
      { p: [x, 0.38, z], s: [0.60, 0.60, 0.90], c: C.black, torus: true, tube: 0.14, seg: 14, detail: 6 },
      { p: [x, 0.38, z], s: [0.44, 0.20, 0.44], c: 0x36383b, cyl: true, rx: H, seg: 10 },
      { p: [x, 0.38, z + out], s: [0.24, 0.12, 0.24], c: C.chrome, cyl: true, rx: H, seg: 8 },
    );
  }
  return p;
}

/** Iconic 17m Beijing articulated trolleybus (通道無軌電車), along +x. */
export function trolleybus(body = 0xd9cfaa, stripe = 0x8c3a2a): Part[] {
  const roofCol = 0x9e9d94, glass = 0x24323e;
  const p: Part[] = [];
  for (const x of [-4.5, 4.5]) {
    p.push(
      { p: [x, 1.82, 0], s: [8.2, 1.75, 2.50], c: body, bevel: true },
      { p: [x, 0.68, 0], s: [8.22, 0.62, 2.51], c: stripe },
      { p: [x, 1.12, 0], s: [8.22, 0.10, 2.52], c: stripe },
      { p: [x, 2.79, 0], s: [8.05, 0.22, 2.38], c: roofCol, bevel: true },
    );
  }
  // front destination route box, split windshield, wipers, headlights, grille, chrome bumper, mirrors
  p.push(
    { p: [8.58, 2.56, 0], s: [0.12, 0.28, 1.38], c: 0x26282a },
    { p: [8.64, 2.56, 0], s: [0.02, 0.22, 1.24], c: 0xefe7cf },
    { p: [8.61, 1.88, 0.56], s: [0.03, 0.82, 0.96], c: glass },
    { p: [8.61, 1.88, -0.56], s: [0.03, 0.82, 0.96], c: glass },
    { p: [8.62, 1.62, 0.52], s: [0.02, 0.02, 0.42], c: 0x161618, rx: 0.2 },
    { p: [8.62, 1.62, -0.52], s: [0.02, 0.02, 0.42], c: 0x161618, rx: 0.2 },
    { p: [8.62, 0.88, 0], s: [0.04, 0.34, 1.02], c: 0x383a3e },
    { p: [8.66, 0.42, 0], s: [0.12, 0.14, 2.52], c: C.chrome, bevel: true },
    { p: [8.62, 0.72, 0.88], s: [0.22, 0.04, 0.22], c: 0xfff2c0, cyl: true, rz: H, seg: 10 },
    { p: [8.62, 0.72, -0.88], s: [0.22, 0.04, 0.22], c: 0xfff2c0, cyl: true, rz: H, seg: 10 },
    { p: [8.62, 0.72, 1.12], s: [0.03, 0.12, 0.10], c: 0xffa828 },
    { p: [8.62, 0.72, -1.12], s: [0.03, 0.12, 0.10], c: 0xffa828 },
    { p: [8.48, 1.72, 1.36], s: [0.06, 0.26, 0.14], c: 0x1e2022 },
    { p: [8.48, 1.72, -1.36], s: [0.06, 0.26, 0.14], c: 0x1e2022 },
    // rear window, bumper & taillights
    { p: [-8.61, 1.92, 0], s: [0.03, 0.76, 1.85], c: glass },
    { p: [-8.66, 0.42, 0], s: [0.10, 0.14, 2.52], c: C.chrome, bevel: true },
    { p: [-8.62, 0.72, 0.98], s: [0.03, 0.18, 0.16], c: 0xd82820 },
    { p: [-8.62, 0.72, -0.98], s: [0.03, 0.18, 0.16], c: 0xd82820 },
  );
  // 3 folding passenger doors on right side (z = -1.26) with step wells and grab rails
  for (const dx of [7.35, 2.05, -6.75]) {
    p.push(
      { p: [dx, 1.24, -1.265], s: [1.14, 1.96, 0.04], c: 0x202224 },
      { p: [dx - 0.28, 1.26, -1.28], s: [0.50, 1.90, 0.035], c: 0xc2b898 },
      { p: [dx + 0.28, 1.26, -1.28], s: [0.50, 1.90, 0.035], c: 0xc2b898 },
      { p: [dx - 0.28, 1.62, -1.295], s: [0.34, 0.92, 0.02], c: glass },
      { p: [dx + 0.28, 1.62, -1.295], s: [0.34, 0.92, 0.02], c: glass },
      { p: [dx, 1.22, -1.305], s: [0.025, 1.40, 0.025], c: C.chrome },
    );
  }
  // 6 torus rubber tires with steel rims & hub caps (3 axles)
  for (const wx of [-6.2, 1.8, 6.8]) for (const z of [1.18, -1.18]) {
    const out = z > 0 ? 0.08 : -0.08;
    p.push(
      { p: [wx, 0.47, z], s: [0.74, 0.74, 1.05], c: 0x151517, torus: true, tube: 0.15, seg: 14, detail: 6 },
      { p: [wx, 0.47, z], s: [0.54, 0.22, 0.54], c: 0x3b3d40, cyl: true, rx: H, seg: 10 },
      { p: [wx, 0.47, z + out], s: [0.26, 0.14, 0.26], c: C.chrome, cyl: true, rx: H, seg: 8 },
    );
  }
  // ribbed 6-pleat rubber accordion bellows (x = -0.45 .. 0.45)
  p.push({ p: [0, 1.65, 0], s: [0.92, 2.02, 2.24], c: 0x1a1a1c });
  for (let i = 0; i < 6; i++) {
    p.push({ p: [-0.375 + i * 0.15, 1.65, 0], s: [0.09, 2.12, 2.36], c: i % 2 ? 0x26282a : 0x34363a });
  }
  // rooftop electrical resistor boxes, vents & dual spring-mounted trolley poles + retriever cords
  p.push(
    { p: [2.2, 2.98, 0], s: [2.4, 0.22, 1.42], c: 0x6b6d68 },
    { p: [-5.6, 2.94, 0], s: [0.9, 0.10, 0.9], c: 0x7b7d76 },
    { p: [-2.4, 2.94, 0], s: [0.9, 0.10, 0.9], c: 0x7b7d76 },
    { p: [5.8, 2.94, 0], s: [0.9, 0.10, 0.9], c: 0x7b7d76 },
    { p: [1.5, 2.96, 0], s: [0.6, 0.14, 1.1], c: 0x424446 },
  );
  for (const z of [0.35, -0.35]) {
    p.push(
      strut([1.5, 3.04, z], [-3.8, 5.82, z], 0.065, 0x333538, 6),
      { p: [-3.85, 5.84, z], s: [0.16, 0.07, 0.09], c: C.brass },
      { p: [-8.64, 1.35, z * 1.4], s: [0.16, 0.08, 0.16], c: 0x3a3c3e, cyl: true, rz: H, seg: 6 },
      strut([-3.85, 5.82, z], [-8.64, 1.38, z * 1.4], 0.018, 0x222222, 4),
    );
  }
  return p;
}

export function trolleyWindows(): Part[] {
  const p: Part[] = [];
  for (const x of [-4.5, 4.5]) {
    for (let i = 0; i < 6; i++) {
      const wx = x - 3.15 + i * 1.26;
      p.push({ p: [wx, 1.98, 1.265], s: [1.02, 0.84, 0.02], c: 0xe8d29a, noAO: true });
      const nearDoor = (x > 0 && (i === 1 || i === 5)) || (x < 0 && i === 1);
      if (!nearDoor) p.push({ p: [wx, 1.98, -1.265], s: [1.02, 0.84, 0.02], c: 0xe8d29a, noAO: true });
    }
  }
  p.push({ p: [8.645, 2.56, 0], s: [0.02, 0.20, 1.20], c: 0xffe4a0, noAO: true });
  return p;
}

/** 1980s Beijing street public telephone booth (公用電話亭), opening faces -z. */
export function phoneBooth(): Part[] {
  const green = 0x2d5a3c, yellow = 0xd8a82e, glass = 0x7e9da6;
  const p: Part[] = [
    // stepped stone base
    { p: [0, 0.03, 0], s: [1.22, 0.06, 1.22], c: 0x625f58 },
    { p: [0, 0.08, 0], s: [1.10, 0.05, 1.10], c: 0x7a766c },
    // emerald steel corner posts, dado panels & back wall
    { p: [-0.46, 1.14, -0.46], s: [0.08, 2.08, 0.08], c: green },
    { p: [0.46, 1.14, -0.46], s: [0.08, 2.08, 0.08], c: green },
    { p: [-0.46, 1.14, 0.46], s: [0.08, 2.08, 0.08], c: green },
    { p: [0.46, 1.14, 0.46], s: [0.08, 2.08, 0.08], c: green },
    { p: [0, 0.56, 0.45], s: [0.88, 0.92, 0.06], c: green },
    { p: [0, 1.56, 0.45], s: [0.88, 1.12, 0.05], c: 0x244a31 },
    { p: [-0.46, 0.34, 0], s: [0.06, 0.50, 0.86], c: green },
    { p: [0.46, 0.34, 0], s: [0.06, 0.50, 0.86], c: green },
    // side glass windows with steel mullions
    { p: [-0.46, 1.36, 0], s: [0.025, 1.48, 0.84], c: glass },
    { p: [0.46, 1.36, 0], s: [0.025, 1.48, 0.84], c: glass },
    { p: [-0.46, 1.36, 0], s: [0.04, 0.04, 0.86], c: green },
    { p: [0.46, 1.36, 0], s: [0.04, 0.04, 0.86], c: green },
    { p: [-0.46, 1.36, 0], s: [0.04, 1.48, 0.04], c: green },
    { p: [0.46, 1.36, 0], s: [0.04, 1.48, 0.04], c: green },
    // yellow/green curved roof hood
    { p: [0, 2.22, 0], s: [1.16, 0.24, 1.16], c: yellow },
    { p: [0, 2.40, 0], s: [1.22, 0.14, 1.22], c: green, bevel: true },
    { p: [0, 2.55, 0], s: [1.04, 0.18, 1.04], c: green, eave: true, curve: 0.12 },
    // wooden shelf, directory book, bakelite rotary telephone, coiled cord & coin box
    { p: [0, 1.02, 0.24], s: [0.80, 0.05, 0.38], c: C.wood },
    { p: [0.24, 1.06, 0.22], s: [0.18, 0.03, 0.24], c: 0x8e3a2a },
    { p: [0, 1.34, 0.34], s: [0.26, 0.28, 0.16], c: 0x1b1b1b, bevel: true },
    { p: [0, 1.14, 0.34], s: [0.22, 0.16, 0.15], c: 0x2b2e30 },              // metal coin box
    { p: [0, 1.34, 0.25], s: [0.14, 0.14, 0.08], c: 0xc8c8be, torus: true, tube: 0.16, seg: 12, detail: 4 },
    { p: [0, 1.34, 0.25], s: [0.07, 0.015, 0.07], c: 0xe8e2d0, cyl: true, rx: H, seg: 8 },
    { p: [-0.15, 1.36, 0.32], s: [0.055, 0.24, 0.055], c: 0x141414, bevel: true }, // handset receiver
    { p: [-0.08, 1.24, 0.29], s: [0.14, 0.28, 0.10], c: 0x151515, torus: true, tube: 0.12, seg: 8, detail: 4, arc: Math.PI, rz: Math.PI }, // coiled cord loop
  ];
  // acoustic louvered panels inside back wall
  for (let i = 0; i < 6; i++) {
    p.push({ p: [0, 1.56 + i * 0.08, 0.42], s: [0.76, 0.035, 0.05], c: 0x356846, rx: 0.35 });
  }
  return p;
}

/** Hutong stack of 14 perforated honeycomb coal briquettes (蜂窩煤), coal stove + kettle, & winter cabbage crate. */
export function coalAndCabbage(): Part[] {
  const p: Part[] = [
    { p: [-0.60, 0.03, 0], s: [0.90, 0.06, 0.56], c: C.wood },
  ];
  // 14 perforated honeycomb coal briquettes (8 bottom + 6 top) with dark top hole discs
  const briqCoords: [number, number, number][] = [];
  for (let col = 0; col < 4; col++) for (let dep = 0; dep < 2; dep++) {
    briqCoords.push([-0.90 + col * 0.20, 0.135, -0.11 + dep * 0.22]);
  }
  for (let col = 0; col < 3; col++) for (let dep = 0; dep < 2; dep++) {
    briqCoords.push([-0.80 + col * 0.20, 0.285, -0.11 + dep * 0.22]);
  }
  for (const [bx, by, bz] of briqCoords) {
    p.push(
      { p: [bx, by, bz], s: [0.175, 0.145, 0.175], c: 0x202022, cyl: true, seg: 8 },
      { p: [bx, by + 0.074, bz], s: [0.035, 0.008, 0.035], c: 0x09090a, cyl: true, seg: 5 },
      { p: [bx + 0.045, by + 0.074, bz], s: [0.028, 0.008, 0.028], c: 0x09090a, cyl: true, seg: 5 },
      { p: [bx - 0.045, by + 0.074, bz], s: [0.028, 0.008, 0.028], c: 0x09090a, cyl: true, seg: 5 },
    );
  }
  // traditional cylindrical clay/iron coal stove (蜂窩煤爐子) + steaming aluminum kettle (鋁水壺)
  p.push(
    { p: [0.02, 0.26, -0.16], s: [0.26, 0.48, 0.26], c: 0x3b3d40, cyl: true, seg: 10 },
    { p: [0.02, 0.51, -0.16], s: [0.24, 0.05, 0.24], c: 0x7a563c, cyl: true, seg: 10 },
    { p: [0.02, 0.10, -0.29], s: [0.10, 0.11, 0.03], c: 0x1c1d1f },
    { p: [0.02, 0.54, -0.16], s: [0.24, 0.24, 0.24], c: 0x2a2b2d, torus: true, tube: 0.06, seg: 10, detail: 4, rx: H },
    { p: [0.02, 0.64, -0.16], s: [0.21, 0.16, 0.21], c: 0xbec2c4, cyl: true, seg: 10, top: 0.74 },
    { p: [0.02, 0.73, -0.16], s: [0.15, 0.03, 0.15], c: 0xc8ccce, cyl: true, seg: 8, top: 0.6 },
    { p: [0.02, 0.76, -0.16], s: [0.04, 0.03, 0.04], c: 0x1e1e1e, cyl: true, seg: 6 },
    strut([0.09, 0.62, -0.16], [0.18, 0.71, -0.16], 0.03, 0xbec2c4, 6),       // kettle spout
    { p: [0.02, 0.72, -0.16], s: [0.20, 0.20, 0.20], c: 0x262628, torus: true, tube: 0.04, seg: 10, detail: 4, arc: Math.PI },
    { p: [0.20, 0.80, -0.16], s: [0.07, 0.07, 0.07], c: 0xd8dce0, sphere: true, detail: 0 }, // steam puff
    { p: [0.23, 0.90, -0.15], s: [0.10, 0.10, 0.10], c: 0xe2e5e8, sphere: true, detail: 0 },
  );
  // woven bamboo crate of layered winter cabbages (大白菜)
  p.push(
    { p: [0.58, 0.04, 0.06], s: [0.68, 0.06, 0.50], c: 0x745836 },
    { p: [0.58, 0.14, 0.30], s: [0.68, 0.16, 0.03], c: 0x85663e },
    { p: [0.58, 0.14, -0.18], s: [0.68, 0.16, 0.03], c: 0x85663e },
    { p: [0.25, 0.14, 0.06], s: [0.03, 0.16, 0.48], c: 0x85663e },
    { p: [0.91, 0.14, 0.06], s: [0.03, 0.16, 0.48], c: 0x85663e },
  );
  const cabbages: [number, number, number, number][] = [
    [0.40, 0.18, -0.05, 0x86a45c], [0.60, 0.18, -0.06, 0x99b66c], [0.78, 0.18, -0.04, 0x7d9954],
    [0.46, 0.18, 0.18, 0xa2bd74], [0.70, 0.18, 0.17, 0x8ea862],
    [0.52, 0.33, 0.06, 0xb8cc88], [0.71, 0.32, 0.05, 0x9cb870],
  ];
  for (const [x, y, z, c] of cabbages) {
    p.push(
      { p: [x, y, z], s: [0.20, 0.22, 0.20], c, sphere: true, detail: 0 },
      { p: [x, y - 0.06, z], s: [0.16, 0.09, 0.16], c: 0xdce5c2, cyl: true, seg: 6 },
    );
  }
  return p;
}

/** Mortise-and-tenon wooden table with floral enamel washbasin, soap dish, thermos & towel. */
export function tableBasin(): Part[] {
  return [
    // wooden table top, apron rails, legs & lower cross stretchers
    { p: [0, 0.72, 0], s: [0.92, 0.05, 0.68], c: C.wood },
    { p: [0, 0.65, 0.27], s: [0.78, 0.07, 0.035], c: C.darkWood },
    { p: [0, 0.65, -0.27], s: [0.78, 0.07, 0.035], c: C.darkWood },
    { p: [-0.38, 0.65, 0], s: [0.035, 0.07, 0.54], c: C.darkWood },
    { p: [0.38, 0.65, 0], s: [0.035, 0.07, 0.54], c: C.darkWood },
    { p: [-0.38, 0.35, -0.26], s: [0.06, 0.70, 0.06], c: C.darkWood },
    { p: [0.38, 0.35, -0.26], s: [0.06, 0.70, 0.06], c: C.darkWood },
    { p: [-0.38, 0.35, 0.26], s: [0.06, 0.70, 0.06], c: C.darkWood },
    { p: [0.38, 0.35, 0.26], s: [0.06, 0.70, 0.06], c: C.darkWood },
    { p: [-0.38, 0.18, 0], s: [0.04, 0.04, 0.52], c: C.darkWood },
    { p: [0.38, 0.18, 0], s: [0.04, 0.04, 0.52], c: C.darkWood },
    // floral-rimmed enamel washbasin + rolled rim + water surface disc
    { p: [-0.15, 0.81, 0], s: [0.36, 0.13, 0.36], c: C.enamel, cyl: true, seg: 12, top: 1.30 },
    { p: [-0.15, 0.875, 0], s: [0.465, 0.465, 0.25], c: 0x26446e, torus: true, tube: 0.035, seg: 12, detail: 4, rx: H },
    { p: [-0.15, 0.852, 0], s: [0.456, 0.016, 0.456], c: 0x8c2a22, cyl: true, seg: 12 },
    { p: [-0.15, 0.876, 0], s: [0.42, 0.008, 0.42], c: 0x6b8a98, cyl: true, seg: 12 },
    // soap dish + bar of soap
    { p: [0.16, 0.755, -0.18], s: [0.12, 0.025, 0.09], c: 0xd8d2c2, bevel: true },
    { p: [0.16, 0.775, -0.18], s: [0.08, 0.028, 0.055], c: 0xe29a92, bevel: true },
    // thermos bottle on table corner
    { p: [0.31, 0.90, -0.18], s: [0.14, 0.30, 0.14], c: 0xa62e24, cyl: true, seg: 9 },
    { p: [0.31, 1.08, -0.18], s: [0.13, 0.06, 0.13], c: C.chrome, cyl: true, seg: 9, top: 0.55 },
    { p: [0.31, 1.12, -0.18], s: [0.075, 0.04, 0.075], c: 0xb83226, cyl: true, seg: 6 },
    // folded towel with striped border
    { p: [0.22, 0.775, 0.13], s: [0.26, 0.055, 0.32], c: 0xe6e0d0 },
    { p: [0.22, 0.778, 0.25], s: [0.265, 0.058, 0.03], c: 0x9a3a2a },
  ];
}

/** Wooden stool with vintage 1980s Red Star 2-band shortwave radio (returns [solidParts, glowDialParts]). */
export function radioStool(): [Part[], Part[]] {
  const solid: Part[] = [
    { p: [0, 0.44, 0], s: [0.40, 0.045, 0.36], c: C.wood, bevel: true },
    { p: [-0.14, 0.22, -0.12], s: [0.048, 0.44, 0.048], c: C.darkWood, rz: -0.06, rx: 0.05 },
    { p: [0.14, 0.22, -0.12], s: [0.048, 0.44, 0.048], c: C.darkWood, rz: 0.06, rx: 0.05 },
    { p: [-0.14, 0.22, 0.12], s: [0.048, 0.44, 0.048], c: C.darkWood, rz: -0.06, rx: -0.05 },
    { p: [0.14, 0.22, 0.12], s: [0.048, 0.44, 0.048], c: C.darkWood, rz: 0.06, rx: -0.05 },
    { p: [0, 0.15, -0.12], s: [0.28, 0.032, 0.032], c: C.darkWood },
    { p: [0, 0.15, 0.12], s: [0.28, 0.032, 0.032], c: C.darkWood },
    // Red Star radio case, chrome handle, speaker ribs, tuning & volume knobs, telescopic antenna
    { p: [0, 0.565, 0], s: [0.32, 0.20, 0.12], c: 0x3a2414, bevel: true },
    { p: [0, 0.675, 0], s: [0.22, 0.10, 0.08], c: C.chrome, torus: true, tube: 0.045, seg: 10, detail: 4, arc: Math.PI },
    { p: [-0.075, 0.565, -0.062], s: [0.12, 0.14, 0.01], c: 0x7b6e58 },
    { p: [-0.075, 0.60, -0.066], s: [0.115, 0.012, 0.01], c: C.chrome },
    { p: [-0.075, 0.565, -0.066], s: [0.115, 0.012, 0.01], c: C.chrome },
    { p: [-0.075, 0.53, -0.066], s: [0.115, 0.012, 0.01], c: C.chrome },
    { p: [0.04, 0.515, -0.068], s: [0.028, 0.018, 0.028], c: C.chrome, cyl: true, rx: H, seg: 7 },
    { p: [0.10, 0.515, -0.068], s: [0.028, 0.018, 0.028], c: C.chrome, cyl: true, rx: H, seg: 7 },
    { p: [0.125, 0.74, 0.03], s: [0.012, 0.28, 0.012], c: C.chrome, cyl: true, seg: 5, rz: -0.2 },
    { p: [0.153, 0.875, 0.03], s: [0.024, 0.024, 0.024], c: C.chrome, sphere: true, detail: 0 },
  ];
  const glow: Part[] = [
    { p: [0.065, 0.59, -0.066], s: [0.11, 0.06, 0.012], c: 0xffd278, noAO: true },
    { p: [0.125, 0.635, -0.066], s: [0.016, 0.016, 0.012], c: 0xe63428, noAO: true },
  ];
  return [solid, glow];
}

/** Beijing Scholar Tree (國槐, tall=false) or Avenue White Poplar (毛白楊, tall=true). */
export function tree(tall: boolean): Part[] {
  if (!tall) {
    // Beijing Scholar Tree (國槐): gnarled tapered trunk + root flare + 3 limbs + 8 organic foliage clouds
    const parts: Part[] = [
      { p: [0, 0.24, 0], s: [0.56, 0.48, 0.56], c: C.trunk, cyl: true, seg: 7, top: 0.52, open: true },
      { p: [0, 1.45, 0], s: [0.36, 2.55, 0.36], c: C.trunk, cyl: true, seg: 7, top: 0.65, rz: 0.06, open: true },
      strut([0.04, 2.35, 0], [-0.95, 3.45, 0.55], 0.16, C.trunk, 6),
      strut([0.04, 2.45, 0], [1.05, 3.40, 0.35], 0.16, C.trunk, 6),
      strut([0.02, 2.55, 0], [-0.15, 3.55, -0.95], 0.15, C.trunk, 6),
    ];
    const clouds: [number, number, number, number, number, number, number][] = [
      [0, 4.15, 0, 2.85, 1.85, 2.85, 0x2d4225],
      [0.25, 4.95, -0.15, 2.35, 1.60, 2.25, 0x364f2c],
      [-1.20, 3.95, 0.70, 2.05, 1.45, 1.95, 0x364f2c],
      [1.25, 3.90, 0.50, 2.10, 1.50, 1.90, 0x2d4225],
      [0.72, 4.45, -0.92, 1.85, 1.35, 1.80, 0x415c34],
      [-0.82, 4.35, -0.88, 1.90, 1.40, 1.85, 0x364f2c],
      [-0.15, 5.40, 0.25, 1.75, 1.20, 1.65, 0x415c34],
      [-0.45, 3.45, 1.00, 1.65, 1.15, 1.55, 0x2d4225],
    ];
    for (const [x, y, z, sx, sy, sz, c] of clouds) {
      parts.push({ p: [x, y, z], s: [sx, sy * 0.72, sz], c, cyl: true, seg: 6, top: 0.45 });
    }
    return parts;
  }

  // Beijing Avenue White Poplar (毛白楊): pale bark + dark bark bands + 3 limbs + 7 columnar foliage clusters
  const bark = 0x585246;
  const parts: Part[] = [
    { p: [0, 0.22, 0], s: [0.46, 0.44, 0.46], c: 0x4a453b, cyl: true, seg: 7, top: 0.74, open: true },
    { p: [0, 3.75, 0], s: [0.34, 7.5, 0.34], c: bark, cyl: true, seg: 7, top: 0.55, open: true },
    { p: [0, 1.5, 0], s: [0.33, 0.12, 0.33], c: 0x343029, cyl: true, seg: 7, open: true },
    { p: [0, 2.7, 0], s: [0.30, 0.12, 0.30], c: 0x343029, cyl: true, seg: 7, open: true },
    strut([0, 3.0, 0], [0.55, 5.1, 0.38], 0.11, bark, 5),
    strut([0, 3.5, 0], [-0.52, 5.8, -0.35], 0.10, bark, 5),
    strut([0, 4.1, 0], [0.22, 6.6, -0.50], 0.09, bark, 5),
  ];
  const tiers: [number, number, number, number, number, number, number][] = [
    [0.14, 3.6, 0.10, 1.45, 1.45, 1.40, 0x2b3e24],
    [-0.35, 4.4, -0.25, 1.65, 1.65, 1.60, 0x354b2c],
    [0.42, 5.0, 0.30, 1.70, 1.75, 1.65, 0x2b3e24],
    [-0.28, 5.8, 0.28, 1.60, 1.75, 1.55, 0x354b2c],
    [0.25, 6.6, -0.32, 1.50, 1.65, 1.45, 0x3f5734],
    [-0.12, 7.5, 0.08, 1.35, 1.55, 1.30, 0x354b2c],
    [0.04, 8.3, -0.05, 1.05, 1.35, 1.05, 0x3f5734],
  ];
  for (const [x, y, z, sx, sy, sz, c] of tiers) {
    parts.push({ p: [x, y, z], s: [sx, sy * 0.78, sz], c, cyl: true, seg: 6, top: 0.42 });
  }
  return parts;
}

/** Cast-iron & tapered steel street lamp pole (lit lens is lampHead()). */
export function lampPole(): Part[] {
  return [
    { p: [0, 0.12, 0], s: [0.30, 0.24, 0.30], c: 0x26282a, cyl: true, seg: 8, top: 0.85 },
    { p: [0, 0.48, 0], s: [0.22, 0.48, 0.22], c: 0x2d3033, cyl: true, seg: 8, top: 0.72 },
    { p: [0, 2.75, 0], s: [0.13, 4.2, 0.13], c: 0x3a3d40, cyl: true, seg: 8, top: 0.72, open: true },
    { p: [0, 2.40, 0], s: [0.14, 0.14, 0.14], c: 0x45484c, torus: true, tube: 0.14, seg: 8, detail: 4, rx: H },
    strut([0, 4.58, 0], [0.42, 5.04, 0], 0.075, 0x3a3d40, 6),
    strut([0.42, 5.04, 0], [0.95, 5.14, 0], 0.07, 0x3a3d40, 6),
    strut([0, 4.18, 0], [0.56, 4.98, 0], 0.042, 0x34373a, 5),
    { p: [0.98, 5.13, 0], s: [0.48, 0.11, 0.34], c: 0x2e3230, bevel: true },
  ];
}

export function lampHead(): Part[] {
  return [{ p: [0.98, 5.03, 0], s: [0.40, 0.12, 0.27], c: C.sodium, sphere: true, detail: 0, noAO: true }];
}

/** Single-deck city bus (red/cream), along +x. */
export function bus(): Part[] {
  const p: Part[] = [
    { p: [0, 1.5, 0], s: [11, 1.6, 2.5], c: C.busCream, bevel: true },
    { p: [0, 0.75, 0], s: [11.02, 0.62, 2.52], c: C.busRed },
    { p: [0, 2.45, 0], s: [10.8, 0.3, 2.4], c: C.busRed, bevel: true },
    { p: [0, 2.67, 0], s: [1.2, 0.15, 2.0], c: 0x777777 },
    { p: [5.55, 0.42, 0], s: [0.12, 0.14, 2.52], c: C.chrome },
    { p: [-5.55, 0.42, 0], s: [0.10, 0.14, 2.52], c: C.chrome },
    { p: [5.52, 0.72, 0.88], s: [0.22, 0.04, 0.22], c: 0xfff2c0, cyl: true, rz: H, seg: 8 },
    { p: [5.52, 0.72, -0.88], s: [0.22, 0.04, 0.22], c: 0xfff2c0, cyl: true, rz: H, seg: 8 },
  ];
  for (const x of [-3.8, 3.8]) for (const z of [1.2, -1.2]) {
    p.push(
      { p: [x, 0.45, z], s: [0.72, 0.72, 1.0], c: C.black, torus: true, tube: 0.15, seg: 12, detail: 5 },
      { p: [x, 0.45, z], s: [0.46, 0.24, 0.46], c: C.chrome, cyl: true, rx: H, seg: 8 },
    );
  }
  return p;
}

export function busWindows(): Part[] {
  const p: Part[] = [];
  for (let i = 0; i < 9; i++) for (const z of [1.26, -1.26]) {
    p.push({ p: [-4.6 + i * 1.15, 1.75, z], s: [0.95, 0.75, 0.02], c: 0xe8d29a, noAO: true });
  }
  return p;
}

/** Lean sculpted LOD silhouette standing person for distant instanced crowds (>15m). */
export function crowdPersonLod(shirt: number, pants = C.navy): Part[] {
  return [
    { p: [0, 0.40, 0], s: [0.17, 0.80, 0.28], c: pants, cyl: true, seg: 6, open: true },
    { p: [0, 1.11, 0], s: [0.24, 0.62, 0.39], c: shirt, cyl: true, seg: 6, top: 1.10, tint: true },
    { p: [0.01, 1.12, 0.24], s: [0.11, 0.50, 0.095], c: shirt, cyl: true, seg: 4, top: 0.78, open: true, rz: 0.06, tint: true },
    { p: [0.01, 1.12, -0.24], s: [0.11, 0.50, 0.095], c: shirt, cyl: true, seg: 4, top: 0.78, open: true, rz: 0.06, tint: true },
    { p: [0.01, 1.57, 0], s: [0.19, 0.23, 0.175], c: 0xf0ede6, sphere: true, detail: 0 },
  ];
}

/** Low-poly sculpted LOD seated student for distant sit-in crowds. */
export function sitPersonLod(shirt: number, headband = true): Part[] {
  const parts: Part[] = [
    { p: [0.22, 0.09, 0.12], s: [0.36, 0.14, 0.15], c: C.navy, cyl: true, seg: 5, rz: H, ry: 0.38 },
    { p: [0.22, 0.09, -0.12], s: [0.36, 0.14, 0.15], c: C.navy, cyl: true, seg: 5, rz: H, ry: -0.38 },
    { p: [0.38, 0.045, 0], s: [0.15, 0.075, 0.26], c: 0x1c1b19, cyl: true, seg: 6 },
    { p: [0, 0.44, 0], s: [0.235, 0.56, 0.39], c: shirt, cyl: true, seg: 6, top: 1.10, rz: -0.08, tint: true },
    { p: [0.10, 0.64, 0], s: [0.045, 0.14, 0.10], c: 0xebe7dc, rz: -0.08 },
    { p: [0.12, 0.44, 0.22], s: [0.10, 0.39, 0.095], c: shirt, cyl: true, seg: 4, top: 0.80, open: true, rz: 0.48, tint: true },
    { p: [0.12, 0.44, -0.22], s: [0.10, 0.39, 0.095], c: shirt, cyl: true, seg: 4, top: 0.80, open: true, rz: 0.48, tint: true },
    { p: [0, 0.895, 0], s: [0.19, 0.225, 0.175], c: 0xf0ede6, sphere: true, detail: 0 },
    { p: [0.35, 0.06, 0.30], s: [0.09, 0.11, 0.09], c: C.enamel, cyl: true, seg: 6 },
  ];
  if (headband) {
    parts.push(
      { p: [0.005, 0.95, 0], s: [0.202, 0.045, 0.188], c: 0xf4f1ea, cyl: true, seg: 6 },
      { p: [-0.12, 0.89, 0.03], s: [0.032, 0.13, 0.042], c: 0xf4f1ea, rz: -0.35 },
    );
  }
  return parts;
}

/** LOD 28-inch bicycle (~320 tris parked / ~344 tris w/ rider) with octagonal wheels and zero crossed spokes. */
export function bikeLod(jacket?: number): Part[] {
  const frame = 0x18261c;
  const parts: Part[] = [
    // Simplified octagonal wheels (seg:8, detail:4 = 64 tris/wheel) + hubs, zero spokes
    { p: [-0.56, 0.36, 0], s: [0.70, 0.70, 0.70], c: C.black, torus: true, tube: 0.045, seg: 8, detail: 4 },
    { p: [0.58, 0.36, 0], s: [0.70, 0.70, 0.70], c: C.black, torus: true, tube: 0.045, seg: 8, detail: 4 },
    { p: [-0.56, 0.36, 0], s: [0.06, 0.06, 0.10], c: C.chrome },
    { p: [0.58, 0.36, 0], s: [0.06, 0.06, 0.10], c: C.chrome },
    // Double-crossbar diamond frame, handlebars, saddle & rear rack
    { p: [0.06, 0.85, 0], s: [0.66, 0.032, 0.032], c: frame },
    { p: [0.08, 0.77, 0], s: [0.68, 0.028, 0.028], c: frame, rz: 0.11 },
    { p: [-0.23, 0.58, 0], s: [0.034, 0.56, 0.034], c: frame, rz: 0.16 },
    { p: [0.12, 0.55, 0], s: [0.036, 0.78, 0.036], c: frame, rz: -0.88 },
    { p: [0.49, 0.62, 0], s: [0.044, 0.58, 0.09], c: frame, rz: 0.27 },
    { p: [-0.39, 0.55, 0], s: [0.46, 0.030, 0.09], c: frame, rz: -0.78 },
    { p: [-0.37, 0.33, -0.05], s: [0.44, 0.11, 0.032], c: 0x1e2c22, rz: -0.15 },
    { p: [0.33, 0.97, 0], s: [0.08, 0.04, 0.44], c: C.chrome },
    { p: [-0.28, 0.87, 0], s: [0.23, 0.055, 0.15], c: 0x4a2a18 },
    { p: [-0.57, 0.79, 0], s: [0.42, 0.03, 0.20], c: C.chrome },
  ];
  if (jacket === undefined) {
    parts.push(
      { p: [-0.56, 0.87, 0.02], s: [0.25, 0.12, 0.17], c: 0x555b3c },
      { p: [-0.56, 0.72, 0], s: [0.56, 0.03, 0.07], c: 0x1a281e },
      { p: [0.58, 0.72, 0], s: [0.46, 0.03, 0.07], c: 0x1a281e },
      { p: [-0.60, 0.18, 0.13], s: [0.026, 0.36, 0.026], c: C.chrome, rx: -0.35, rz: -0.14 },
    );
  } else {
    parts.push(
      { p: [-0.18, 1.17, 0], s: [0.23, 0.56, 0.36], c: jacket, cyl: true, seg: 6, top: 1.10, rz: -0.22 },
      { p: [-0.08, 1.585, 0], s: [0.185, 0.22, 0.175], c: 0xf0ede6, sphere: true, detail: 0 },
      { p: [0.08, 1.15, 0.20], s: [0.46, 0.085, 0.085], c: jacket, cyl: true, seg: 5, open: true, rz: -0.68 },
      { p: [0.08, 1.15, -0.20], s: [0.46, 0.085, 0.085], c: jacket, cyl: true, seg: 5, open: true, rz: -0.68 },
      { p: [-0.16, 0.62, 0], s: [0.19, 0.56, 0.26], c: C.navy, cyl: true, seg: 6, open: true, rz: 0.24 },
    );
  }
  return parts;
}

/** LOD Scholar Tree (tall=false, ~136 tris) or Avenue White Poplar (tall=true, ~144 tris) with detail:0 icosahedron foliage. */
export function treeLod(tall: boolean): Part[] {
  if (!tall) {
    const parts: Part[] = [
      { p: [0, 1.45, 0], s: [0.38, 2.90, 0.38], c: C.trunk, cyl: true, seg: 6, top: 0.65, open: true },
      { p: [-0.55, 2.95, 0.28], s: [0.16, 1.35, 0.16], c: C.trunk, rz: 0.68, rx: 0.32 },
      { p: [0.58, 2.90, -0.30], s: [0.16, 1.35, 0.16], c: C.trunk, rz: -0.68, rx: -0.32 },
    ];
    const clouds: [number, number, number, number, number, number, number][] = [
      [0, 4.15, 0, 2.95, 1.95, 2.95, 0x2d4225],
      [0.20, 5.05, -0.10, 2.35, 1.55, 2.25, 0x364f2c],
      [-1.25, 3.95, 0.65, 2.15, 1.50, 2.05, 0x364f2c],
      [1.25, 3.95, 0.45, 2.15, 1.50, 2.00, 0x2d4225],
      [0, 4.30, -1.05, 2.00, 1.45, 1.95, 0x415c34],
    ];
    for (const [x, y, z, sx, sy, sz, c] of clouds) {
      parts.push({ p: [x, y, z], s: [sx, sy * 0.72, sz], c, cyl: true, seg: 5, top: 0.45 });
    }
    return parts;
  }

  const bark = 0x585246;
  const parts: Part[] = [
    { p: [0, 0.22, 0], s: [0.46, 0.44, 0.46], c: 0x4a453b, cyl: true, seg: 6, top: 0.74, open: true },
    { p: [0, 3.75, 0], s: [0.34, 7.5, 0.34], c: bark, cyl: true, seg: 6, top: 0.55, open: true },
  ];
  const tiers: [number, number, number, number, number, number, number][] = [
    [0.12, 3.7, 0.08, 1.55, 1.55, 1.50, 0x2b3e24],
    [-0.32, 4.6, -0.22, 1.75, 1.75, 1.70, 0x354b2c],
    [0.36, 5.3, 0.26, 1.75, 1.80, 1.70, 0x2b3e24],
    [-0.24, 6.2, 0.22, 1.65, 1.80, 1.60, 0x354b2c],
    [0.18, 7.1, -0.20, 1.45, 1.65, 1.40, 0x3f5734],
    [0.02, 8.1, 0, 1.15, 1.45, 1.15, 0x354b2c],
  ];
  for (const [x, y, z, sx, sy, sz, c] of tiers) {
    parts.push({ p: [x, y, z], s: [sx, sy * 0.78, sz], c, cyl: true, seg: 5, top: 0.42 });
  }
  return parts;
}

/** 1980s Beijing newspaper/correspondent desk with typewriter, banker's lamp, phone & proof sheets, facing -z. */
export function pressDesk(): Part[] {
  const oak = 0x6b4a2b;
  const oakDark = 0x4b331d;
  const p: Part[] = [
    // Tabletop & modesty panel
    { p: [0, 0.74, 0], s: [1.56, 0.06, 0.78], c: oak, bevel: true },
    { p: [0, 0.42, 0.32], s: [1.38, 0.58, 0.04], c: oakDark },
    // Left & right 3-drawer pedestals + brass pulls
    { p: [-0.54, 0.36, 0], s: [0.40, 0.70, 0.70], c: oakDark },
    { p: [0.54, 0.36, 0], s: [0.40, 0.70, 0.70], c: oakDark },
  ];
  for (const sx of [-0.54, 0.54]) {
    for (const dy of [0.16, 0.36, 0.56]) {
      p.push(
        { p: [sx, dy, -0.355], s: [0.34, 0.16, 0.02], c: oak },
        { p: [sx, dy, -0.375], s: [0.10, 0.025, 0.02], c: C.brass },
      );
    }
  }
  // Manual mechanical typewriter + carriage + paper sheet
  p.push(
    { p: [-0.08, 0.84, -0.02], s: [0.38, 0.14, 0.34], c: 0x353b3e, bevel: true },
    { p: [-0.08, 0.80, -0.18], s: [0.34, 0.05, 0.12], c: 0x1e2022, rx: 0.25 },
    { p: [-0.08, 0.93, 0.06], s: [0.44, 0.07, 0.07], c: 0x202224, cyl: true, rz: H, seg: 8 },
    { p: [-0.08, 1.04, 0.08], s: [0.22, 0.24, 0.015], c: 0xf4f0e4, rx: -0.22 },
  );
  // Green banker's desk lamp (left) + warm glowing bulb
  p.push(
    { p: [-0.56, 0.78, 0.16], s: [0.16, 0.03, 0.16], c: C.brass, cyl: true, seg: 8 },
    { p: [-0.56, 0.96, 0.16], s: [0.03, 0.34, 0.03], c: C.brass, cyl: true, seg: 6 },
    { p: [-0.50, 1.14, 0.12], s: [0.24, 0.10, 0.14], c: 0x225a3c, prism: true, rz: -0.25 },
    { p: [-0.50, 1.08, 0.12], s: [0.07, 0.07, 0.07], c: 0xffe49c, sphere: true, detail: 0, noAO: true },
  );
  // Bakelite desk telephone + stacked proof sheets + enamel mug (right)
  p.push(
    { p: [0.52, 0.82, 0.12], s: [0.18, 0.10, 0.20], c: 0x1b1c1e, bevel: true },
    { p: [0.52, 0.89, 0.12], s: [0.22, 0.05, 0.06], c: 0x141416 },
    { p: [0.38, 0.79, -0.14], s: [0.28, 0.05, 0.34], c: 0xeee8d8, ry: 0.08 },
    { p: [0.58, 0.83, -0.18], s: [0.09, 0.11, 0.09], c: C.enamel, cyl: true, seg: 8 },
  );
  return p;
}

/** 1980s photojournalist tripod + 35mm SLR camera & telephoto lens, facing -z. */
export function cameraTripod(): Part[] {
  const head: [number, number, number] = [0, 1.38, 0];
  return [
    // 3 splayed tubular aluminum tripod legs + rubber feet
    strut([0, 1.32, 0], [-0.36, 0.02, -0.32], 0.028, 0x8d9296, 6),
    strut([0, 1.32, 0], [0.36, 0.02, -0.32], 0.028, 0x8d9296, 6),
    strut([0, 1.32, 0], [0, 0.02, 0.42], 0.028, 0x8d9296, 6),
    { p: [-0.36, 0.02, -0.32], s: [0.05, 0.04, 0.05], c: C.black, cyl: true, seg: 6 },
    { p: [0.36, 0.02, -0.32], s: [0.05, 0.04, 0.05], c: C.black, cyl: true, seg: 6 },
    { p: [0, 0.02, 0.42], s: [0.05, 0.04, 0.05], c: C.black, cyl: true, seg: 6 },
    // Center collar, column & pan-tilt head + handle
    { p: [0, 1.32, 0], s: [0.11, 0.08, 0.11], c: 0x242628, cyl: true, seg: 8 },
    { p: head, s: [0.04, 0.14, 0.04], c: 0x2c2f33, cyl: true, seg: 6 },
    { p: [0, 1.46, 0], s: [0.10, 0.06, 0.10], c: 0x242628 },
    strut([0, 1.45, 0.04], [0, 1.36, 0.24], 0.018, 0x1b1d1f, 5),
    // 35mm SLR camera body, prism hump, shutter dials & telephoto lens barrel
    { p: [0, 1.54, 0], s: [0.17, 0.10, 0.075], c: 0x1c1d1f, bevel: true },
    { p: [0, 1.60, 0], s: [0.07, 0.035, 0.075], c: C.chrome },
    { p: [-0.055, 1.60, 0], s: [0.03, 0.02, 0.03], c: C.chrome, cyl: true, seg: 6 },
    { p: [0.055, 1.60, 0], s: [0.03, 0.02, 0.03], c: C.chrome, cyl: true, seg: 6 },
    { p: [0, 1.54, -0.14], s: [0.082, 0.22, 0.082], c: 0x242629, cyl: true, rx: H, seg: 10 },
    { p: [0, 1.54, -0.255], s: [0.072, 0.015, 0.072], c: 0x2d485c, cyl: true, rx: H, seg: 10 },
  ];
}

/** 1980s newsroom teletype / wire printer console (電傳打字機) with paper tape reel & continuous feed, facing -z. */
export function newsTelex(): Part[] {
  return [
    // Metal pedestal cabinet & base plinth
    { p: [0, 0.04, 0], s: [0.76, 0.08, 0.62], c: 0x282c30 },
    { p: [0, 0.46, 0], s: [0.70, 0.78, 0.54], c: 0x525a54, bevel: true },
    { p: [0, 0.44, -0.275], s: [0.54, 0.52, 0.02], c: 0x3f4641 },
    // Upper teletype hood, keyboard console & indicator lamps
    { p: [0, 0.96, 0.03], s: [0.72, 0.26, 0.48], c: 0x626a63, bevel: true },
    { p: [0, 0.89, -0.22], s: [0.64, 0.08, 0.20], c: 0x2a2d30, rx: 0.22 },
    { p: [0, 0.92, -0.24], s: [0.54, 0.03, 0.14], c: 0xd8d3c4, rx: 0.22 },
    { p: [-0.26, 0.96, -0.22], s: [0.025, 0.025, 0.02], c: 0xe64a32, noAO: true },
    { p: [-0.21, 0.96, -0.22], s: [0.025, 0.025, 0.02], c: 0x68d468, noAO: true },
    // Paper-tape punch & reel on left flank
    { p: [-0.40, 0.98, 0.02], s: [0.06, 0.24, 0.24], c: 0xddd6c2, cyl: true, rz: H, seg: 10 },
    { p: [-0.40, 0.98, 0.02], s: [0.07, 0.08, 0.08], c: 0x2c2f32, cyl: true, rz: H, seg: 8 },
    // Platen roller & continuous cream teletype fanfold feed
    { p: [0, 1.10, 0.05], s: [0.52, 0.08, 0.08], c: 0x222426, cyl: true, rz: H, seg: 8 },
    { p: [0, 1.18, 0.14], s: [0.46, 0.26, 0.015], c: 0xf2ebd6, rx: 0.28 },
    { p: [0, 0.24, 0.34], s: [0.48, 0.14, 0.22], c: 0xeae2cb },
  ];
}

/** 1989 Beijing morning-market / street vendor stall (早市菜攤) with striped canopy, bamboo baskets & scale, facing -z. */
export function marketStall(): Part[] {
  const p: Part[] = [
    // Slatted plank counter & trestle legs
    { p: [0, 0.78, 0], s: [2.20, 0.06, 0.86], c: 0x7c5a36 },
    { p: [-0.94, 0.39, -0.34], s: [0.08, 0.78, 0.08], c: C.darkWood },
    { p: [0.94, 0.39, -0.34], s: [0.08, 0.78, 0.08], c: C.darkWood },
    { p: [-0.94, 0.39, 0.34], s: [0.08, 0.78, 0.08], c: C.darkWood },
    { p: [0.94, 0.39, 0.34], s: [0.08, 0.78, 0.08], c: C.darkWood },
    // 4 bamboo canopy poles & sloped striped canvas awning
    { p: [-1.04, 1.15, -0.40], s: [0.05, 2.30, 0.05], c: 0x8f7a52, cyl: true, seg: 6 },
    { p: [1.04, 1.15, -0.40], s: [0.05, 2.30, 0.05], c: 0x8f7a52, cyl: true, seg: 6 },
    { p: [-1.04, 1.24, 0.40], s: [0.05, 2.48, 0.05], c: 0x8f7a52, cyl: true, seg: 6 },
    { p: [1.04, 1.24, 0.40], s: [0.05, 2.48, 0.05], c: 0x8f7a52, cyl: true, seg: 6 },
    { p: [0, 2.36, -0.05], s: [2.36, 0.05, 1.18], c: 0x2d5886, rx: -0.18 },
  ];
  for (let i = -2; i <= 2; i += 2) {
    p.push({ p: [i * 0.42, 2.37, -0.05], s: [0.36, 0.055, 1.19], c: 0xf0ebe0, rx: -0.18 });
  }
  // 3 woven bamboo baskets with winter cabbages, radishes & scallions
  const baskets: [number, number, number][] = [[-0.64, 0x82a256, 0.56], [0, 0xe2e0d4, 0.52], [0.64, 0x5c8442, 0.54]];
  for (const [bx, produceCol, bw] of baskets) {
    p.push(
      { p: [bx, 0.94, -0.04], s: [bw * 0.85, 0.26, bw * 0.85], c: 0x9b7a4c, cyl: true, seg: 10, top: 1.28 },
      { p: [bx - 0.10, 1.08, -0.04], s: [0.20, 0.18, 0.20], c: produceCol, sphere: true, detail: 0 },
      { p: [bx + 0.11, 1.07, 0.02], s: [0.18, 0.16, 0.18], c: produceCol, sphere: true, detail: 0 },
      { p: [bx, 1.12, -0.12], s: [0.18, 0.16, 0.18], c: produceCol, sphere: true, detail: 0 },
    );
  }
  // Hanging beam scale (桿秤) & wooden crate under counter
  p.push(
    { p: [0.92, 1.88, -0.34], s: [0.52, 0.025, 0.025], c: 0x4b331d, rz: 0.08 },
    { p: [0.74, 1.72, -0.34], s: [0.05, 0.08, 0.05], c: 0x2c2e30, cyl: true, seg: 6 },
    { p: [-0.42, 0.20, 0], s: [0.62, 0.36, 0.44], c: 0x6b4f30 },
  );
  return p;
}

/** 1980s hospital / Red Cross wheeled medical triage cart (醫用搶救推車) with IV pole & supplies. */
export function medicalTriageCart(): Part[] {
  const frame = 0xe8e6dc;
  const p: Part[] = [
    // Lower & upper instrument shelves
    { p: [0, 0.24, 0], s: [0.88, 0.04, 0.52], c: frame },
    { p: [0, 0.86, 0], s: [0.88, 0.04, 0.52], c: frame },
    { p: [0, 0.90, -0.25], s: [0.88, 0.06, 0.02], c: C.chrome },
    { p: [0, 0.90, 0.25], s: [0.88, 0.06, 0.02], c: C.chrome },
    // 4 upright tubular corner posts + push handle + 4 caster wheels
    ...([-0.41, 0.41] as const).flatMap(cx =>
      ([-0.23, 0.23] as const).flatMap(cz => [
        { p: [cx, 0.52, cz] as [number, number, number], s: [0.035, 0.84, 0.035] as [number, number, number], c: C.chrome, cyl: true, seg: 6 },
        { p: [cx, 0.06, cz] as [number, number, number], s: [0.09, 0.04, 0.09] as [number, number, number], c: 0x242628, cyl: true, rz: H, seg: 8 },
      ]),
    ),
    { p: [0.47, 0.94, 0], s: [0.03, 0.03, 0.48], c: C.chrome },
    // Red Cross emblem panel on side apron
    { p: [0, 0.72, -0.26], s: [0.36, 0.22, 0.02], c: 0xf4f1ea },
    { p: [0, 0.72, -0.275], s: [0.14, 0.045, 0.01], c: C.redCross },
    { p: [0, 0.72, -0.275], s: [0.045, 0.14, 0.01], c: C.redCross },
    // Telescoping IV stand + hanging saline bottle
    { p: [-0.38, 1.38, 0.20], s: [0.025, 1.05, 0.025], c: C.chrome, cyl: true, seg: 6 },
    { p: [-0.31, 1.88, 0.20], s: [0.14, 0.02, 0.02], c: C.chrome },
    { p: [-0.25, 1.72, 0.20], s: [0.08, 0.16, 0.08], c: 0xdce8ee, cyl: true, seg: 8 },
    // Gauze boxes, enamel kidney basin & medicine bottles on shelves
    { p: [-0.14, 0.96, -0.04], s: [0.24, 0.14, 0.18], c: 0xf2efe6 },
    { p: [0.20, 0.92, 0.06], s: [0.22, 0.06, 0.14], c: C.chrome, bevel: true },
    { p: [0.24, 0.98, -0.10], s: [0.07, 0.16, 0.07], c: 0x7b4a26, cyl: true, seg: 7 },
    { p: [0.04, 0.36, 0], s: [0.32, 0.20, 0.26], c: 0xe6e1d3 },
  ];
  return p;
}

/** 1980s Beijing square wooden dining table (八仙桌 / 方桌) with 4 stools, bowls, teapot & thermos. */
export function diningTable(): Part[] {
  const wood = C.wood;
  const dark = C.darkWood;
  const p: Part[] = [
    // Tabletop & apron rails
    { p: [0, 0.75, 0], s: [1.02, 0.05, 1.02], c: wood, bevel: true },
    { p: [0, 0.67, -0.42], s: [0.84, 0.09, 0.04], c: dark },
    { p: [0, 0.67, 0.42], s: [0.84, 0.09, 0.04], c: dark },
    { p: [-0.42, 0.67, 0], s: [0.04, 0.09, 0.84], c: dark },
    { p: [0.42, 0.67, 0], s: [0.04, 0.09, 0.84], c: dark },
  ];
  // 4 legs + lower stretchers
  for (const sx of [-0.41, 0.41]) {
    for (const sz of [-0.41, 0.41]) {
      p.push({ p: [sx, 0.37, sz], s: [0.065, 0.74, 0.065], c: dark });
    }
  }
  // 4 tucked wooden square stools (方凳)
  const stools: [number, number][] = [[0, -0.66], [0, 0.66], [-0.66, 0], [0.66, 0]];
  for (const [sx, sz] of stools) {
    p.push(
      { p: [sx, 0.44, sz], s: [0.34, 0.04, 0.34], c: wood },
      { p: [sx - 0.12, 0.22, sz - 0.12], s: [0.04, 0.44, 0.04], c: dark },
      { p: [sx + 0.12, 0.22, sz - 0.12], s: [0.04, 0.44, 0.04], c: dark },
      { p: [sx - 0.12, 0.22, sz + 0.12], s: [0.04, 0.44, 0.04], c: dark },
      { p: [sx + 0.12, 0.22, sz + 0.12], s: [0.04, 0.44, 0.04], c: dark },
    );
  }
  // Thermos bottle, green enamel teapot, plate of steamed buns & 4 porcelain bowls
  p.push(
    { p: [-0.28, 0.93, 0.24], s: [0.14, 0.30, 0.14], c: 0xa62e24, cyl: true, seg: 8 },
    { p: [-0.28, 1.11, 0.24], s: [0.13, 0.06, 0.13], c: C.chrome, cyl: true, seg: 8, top: 0.55 },
    { p: [0.22, 0.85, 0.14], s: [0.16, 0.15, 0.16], c: 0x2c5c40, cyl: true, seg: 8 },
    { p: [0, 0.79, 0], s: [0.22, 0.03, 0.22], c: 0xf4f1e8, cyl: true, seg: 8 },
    { p: [-0.04, 0.83, -0.02], s: [0.08, 0.06, 0.08], c: 0xf0e8d0, sphere: true, detail: 0 },
    { p: [0.05, 0.83, 0.03], s: [0.08, 0.06, 0.08], c: 0xf0e8d0, sphere: true, detail: 0 },
  );
  for (const [bx, bz] of [[0, -0.32], [0, 0.32], [-0.32, 0], [0.32, 0]] as [number, number][]) {
    p.push({ p: [bx, 0.81, bz], s: [0.11, 0.065, 0.11], c: 0xf4f1ea, cyl: true, seg: 8, top: 1.4 });
  }
  return p;
}
