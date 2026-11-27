import { C, type Part } from './kit';

export const FACE_WHITE = 0xf0ede6;
export const FACE_SHADE = 0xe2ddd2;

const H = Math.PI / 2;

export type NpcArchetype =
  | 'medic_doctor'
  | 'press_editor'
  | 'press_typesetter'
  | 'photojournalist'
  | 'scholar_professor'
  | 'worker_master'
  | 'worker_apprentice'
  | 'store_clerk'
  | 'courtyard_auntie'
  | 'hutong_elder'
  | 'student_picket'
  | 'student_overcoat'
  | 'student_female'
  | 'student_male';

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

/** Matte alabaster-white featureless head & neck (no eyes, nose, mouth, or hair blobs). */
export function blankHeadParts(x = 0.015, y = 1.59, z = 0, scale = 1): Part[] {
  return [
    { p: [x - 0.015 * scale, y - 0.13 * scale, z], s: [0.095 * scale, 0.095 * scale, 0.092 * scale], c: FACE_SHADE, cyl: true, seg: 7 },
    { p: [x, y, z], s: [0.195 * scale, 0.232 * scale, 0.178 * scale], c: FACE_WHITE, sphere: true, detail: 1 },
    { p: [x + 0.016 * scale, y - 0.052 * scale, z], s: [0.135 * scale, 0.088 * scale, 0.132 * scale], c: FACE_WHITE, cyl: true, seg: 7, top: 1.15 },
  ];
}

/** Determine distinct 1989 Beijing period wardrobe archetype from hotspot metadata. */
export function resolveNpcArchetype(h: { id: string; label: string; npc?: string; scene?: string }): NpcArchetype {
  const txt = `${h.id} ${h.label}`;
  if (/medic|fang|triage|醫|急救|護師/i.test(txt)) return 'medic_doctor';
  if (/shen|主編|編輯台/i.test(txt)) return 'press_editor';
  if (/zhang_type|zhang_galley|telex|news_zhang|news_morning|排字|張大姐/i.test(txt)) return 'press_typesetter';
  if (/lens|vantage|press_column|gu_market|小唐|顧明遠|記者/i.test(txt)) return 'photojournalist';
  if (/scholars|老師|教授/i.test(txt)) return 'scholar_professor';
  if (/picket|cordon|糾察|警戒線/i.test(txt)) return 'student_picket';
  if (/wang|zhao|driver|union|workers|barricade|thermos_cart|lathe|王師傅|老趙|司機|工友/i.test(txt)) return 'worker_master';
  if (/store|market_stall|grain_shop|ration_queue|王姐|副食|糧店|早點/i.test(txt)) return 'store_clerk';
  if (/auntie|stove|table|hongmen|yard_tree|swept_alley|大媽|秀芳/i.test(txt)) return 'courtyard_auntie';
  if (/sun|kiosk|zhang|oldman|repair|rumor_corner|rain_avenue|孫大爺|張大爺|大爺|修車/i.test(txt)) return 'hutong_elder';
  if (/stu3|tent|rain_fatigue|軍大衣|絕食棚/i.test(txt)) return 'student_overcoat';
  if (/lin|stu2|manifesto|broadcast|林小梅|女生/i.test(txt)) return 'student_female';
  if (
    /liu|apprentice|locker|xiaojun|小劉|小軍/i.test(txt) ||
    (/board/i.test(h.id) && (h.scene === 'factory' || h.scene === 'factory_dawn'))
  ) {
    return 'worker_apprentice';
  }
  return 'student_male';
}

interface FootwearSpec {
  sole: number;
  upper: number;
  heel?: boolean;
  sneakerStripe?: boolean;
  strap?: boolean;
}

function buildLegsAndShoes(trousers: number, shoe: FootwearSpec, isSkirt = false): Part[] {
  const parts: Part[] = [
    { p: [0.025, 0.014, 0.09], s: [0.228, 0.028, 0.108], c: shoe.sole, cyl: true, seg: 8 },
    { p: [0.025, 0.014, -0.09], s: [0.228, 0.028, 0.108], c: shoe.sole, cyl: true, seg: 8 },
    { p: [0.02, 0.050, 0.09], s: [0.208, 0.052, 0.102], c: shoe.upper, cyl: true, seg: 8, top: 0.78 },
    { p: [0.02, 0.050, -0.09], s: [0.208, 0.052, 0.102], c: shoe.upper, cyl: true, seg: 8, top: 0.78 },
  ];
  if (shoe.heel) {
    parts.push(
      { p: [-0.045, 0.022, 0.09], s: [0.068, 0.024, 0.095], c: 0x161414 },
      { p: [-0.045, 0.022, -0.09], s: [0.068, 0.024, 0.095], c: 0x161414 },
    );
  }
  if (shoe.sneakerStripe) {
    parts.push(
      { p: [0.095, 0.026, 0.09], s: [0.068, 0.022, 0.092], c: 0xf0ece2, cyl: true, seg: 6 },
      { p: [0.095, 0.026, -0.09], s: [0.068, 0.022, 0.092], c: 0xf0ece2, cyl: true, seg: 6 },
      { p: [0.015, 0.046, 0.143], s: [0.082, 0.016, 0.012], c: 0xa82820, rz: 0.22 },
      { p: [0.015, 0.046, -0.143], s: [0.082, 0.016, 0.012], c: 0xa82820, rz: 0.22 },
    );
  }
  if (shoe.strap) {
    parts.push(
      { p: [0.03, 0.072, 0.09], s: [0.022, 0.014, 0.102], c: shoe.upper },
      { p: [0.03, 0.072, -0.09], s: [0.022, 0.014, 0.102], c: shoe.upper },
    );
  }

  if (isSkirt) {
    parts.push(
      { p: [0, 0.23, 0.088], s: [0.105, 0.36, 0.10], c: trousers, cyl: true, seg: 7, top: 1.12 },
      { p: [0, 0.23, -0.088], s: [0.105, 0.36, 0.10], c: trousers, cyl: true, seg: 7, top: 1.12 },
      { p: [0, 0.59, 0], s: [0.33, 0.48, 0.44], c: 0x252c3d, cyl: true, seg: 10, top: 0.78 },
      { p: [0, 0.80, 0], s: [0.255, 0.055, 0.36], c: 0x1c2028, cyl: true, seg: 8 },
    );
    for (let k = -3; k <= 3; k++) {
      parts.push({ p: [0.155, 0.58, k * 0.052], s: [0.018, 0.44, 0.014], c: 0x1c2230, rz: -0.07 });
    }
  } else {
    parts.push(
      { p: [0, 0.27, 0.09], s: [0.136, 0.40, 0.126], c: trousers, cyl: true, seg: 7, top: 1.14 },
      { p: [0, 0.27, -0.09], s: [0.136, 0.40, 0.126], c: trousers, cyl: true, seg: 7, top: 1.14 },
      { p: [0, 0.63, 0.09], s: [0.162, 0.36, 0.146], c: trousers, cyl: true, seg: 7, top: 1.12 },
      { p: [0, 0.63, -0.09], s: [0.162, 0.36, 0.146], c: trousers, cyl: true, seg: 7, top: 1.12 },
    );
  }
  return parts;
}

function buildArms(
  upperCol: number,
  lowerCol = upperCol,
  cuffCol?: number,
  leftArmOverride?: Part[],
  rightArmOverride?: Part[],
): Part[] {
  const parts: Part[] = [];
  if (leftArmOverride) {
    parts.push(...leftArmOverride);
  } else {
    parts.push(
      { p: [0, 1.35, 0.245], s: [0.134, 0.13, 0.12], c: upperCol, sphere: true, detail: 0 },
      { p: [0.005, 1.22, 0.255], s: [0.118, 0.26, 0.108], c: upperCol, cyl: true, seg: 6, top: 0.88, open: true },
      { p: [0.028, 1.00, 0.255], s: [0.106, 0.23, 0.096], c: lowerCol, cyl: true, seg: 6, top: 0.84, rz: 0.18 },
      { p: [0.052, 0.84, 0.255], s: [0.078, 0.098, 0.072], c: FACE_WHITE, sphere: true, detail: 0 },
    );
    if (cuffCol !== undefined) {
      parts.push({ p: [0.044, 0.905, 0.255], s: [0.112, 0.045, 0.102], c: cuffCol, cyl: true, seg: 6, rz: 0.18 });
    }
  }
  if (rightArmOverride) {
    parts.push(...rightArmOverride);
  } else {
    parts.push(
      { p: [0, 1.35, -0.245], s: [0.134, 0.13, 0.12], c: upperCol, sphere: true, detail: 0 },
      { p: [0.005, 1.22, -0.255], s: [0.118, 0.26, 0.108], c: upperCol, cyl: true, seg: 6, top: 0.88, open: true },
      { p: [0.028, 1.00, -0.255], s: [0.106, 0.23, 0.096], c: lowerCol, cyl: true, seg: 6, top: 0.84, rz: 0.18 },
      { p: [0.052, 0.84, -0.255], s: [0.078, 0.098, 0.072], c: FACE_WHITE, sphere: true, detail: 0 },
    );
    if (cuffCol !== undefined) {
      parts.push({ p: [0.044, 0.905, -0.255], s: [0.112, 0.045, 0.102], c: cuffCol, cyl: true, seg: 6, rz: 0.18 });
    }
  }
  return parts;
}

function shirtAndJacketTorso(jacket: number, jacketShade: number, innerCol = 0xeeeae0, buttons = 4): Part[] {
  const parts: Part[] = [
    { p: [0, 0.81, 0], s: [0.256, 0.065, 0.41], c: 0x241d16, cyl: true, seg: 8 },
    { p: [0.129, 0.81, 0], s: [0.018, 0.050, 0.066], c: C.brass },
    { p: [0, 0.90, 0], s: [0.268, 0.16, 0.42], c: jacketShade, cyl: true, seg: 8, top: 0.94 },
    { p: [0, 1.18, 0], s: [0.246, 0.44, 0.39], c: jacket, cyl: true, seg: 8, top: 1.14 },
    { p: [-0.01, 1.415, 0], s: [0.21, 0.065, 0.26], c: jacketShade, cyl: true, seg: 8, top: 0.85 },
    { p: [0.114, 1.32, 0], s: [0.044, 0.17, 0.11], c: innerCol },
    { p: [0.125, 1.30, 0.072], s: [0.028, 0.20, 0.072], c: jacketShade, rx: -0.25 },
    { p: [0.125, 1.30, -0.072], s: [0.028, 0.20, 0.072], c: jacketShade, rx: 0.25 },
    { p: [0.134, 1.04, 0], s: [0.012, 0.34, 0.022], c: jacketShade },
  ];
  for (let i = 0; i < buttons; i++) {
    parts.push({ p: [0.141, 1.22 - i * 0.105, 0], s: [0.012, 0.022, 0.022], c: 0x22201d, cyl: true, rz: H, seg: 6 });
  }
  return parts;
}

function pocketFlaps(y: number, col: number, chest = false): Part[] {
  const x = chest ? 0.132 : 0.138;
  const dz = chest ? 0.105 : 0.125;
  return [
    { p: [x, y, dz], s: [0.024, chest ? 0.095 : 0.115, chest ? 0.088 : 0.108], c: col, bevel: true },
    { p: [x, y, -dz], s: [0.024, chest ? 0.095 : 0.115, chest ? 0.088 : 0.108], c: col, bevel: true },
    { p: [x + 0.006, y + (chest ? 0.032 : 0.042), dz], s: [0.020, 0.028, chest ? 0.092 : 0.112], c: col },
    { p: [x + 0.006, y + (chest ? 0.032 : 0.042), -dz], s: [0.020, 0.028, chest ? 0.092 : 0.112], c: col },
  ];
}

function slrCamera(x: number, y: number, z = 0): Part[] {
  return [
    { p: [x, y, z], s: [0.062, 0.078, 0.124], c: 0x1d1f22 },
    { p: [x, y + 0.042, z], s: [0.063, 0.016, 0.124], c: C.chrome },
    { p: [x - 0.004, y + 0.056, z], s: [0.052, 0.024, 0.044], c: C.chrome },
    { p: [x + 0.054, y - 0.004, z], s: [0.058, 0.076, 0.058], c: 0x151618, cyl: true, rz: H, seg: 8 },
    { p: [x + 0.090, y - 0.004, z], s: [0.048, 0.012, 0.048], c: 0x3b5c7a, cyl: true, rz: H, seg: 8 },
  ];
}

function oliveSatchel(rightSide = false): Part[] {
  const zSign = rightSide ? -1 : 1;
  return [
    { p: [0, 1.15, 0], s: [0.275, 0.54, 0.042], c: 0x5c6240, rx: 0.58 * zSign },
    { p: [-0.04, 0.87, 0.24 * zSign], s: [0.21, 0.22, 0.088], c: 0x565c3a, bevel: true },
    { p: [-0.04, 0.93, 0.242 * zSign], s: [0.216, 0.065, 0.094], c: 0x626942 },
  ];
}

/** Build detailed 1989 Beijing period NPC geometry parts (standing facing +X) by role archetype. */
export function buildNpcParts(archetype: NpcArchetype, scene?: string): Part[] {
  const inCamp = scene === 'camp' || scene === 'square' || scene === 'statue' || scene === 'xinhua_gate';

  switch (archetype) {
    case 'medic_doctor': {
      const coat = 0xf2f0ea;
      const scrub = 0x2e5854;
      return [
        ...buildLegsAndShoes(0x282d36, { sole: 0xd8d3c6, upper: 0xf0ede6 }),
        ...shirtAndJacketTorso(coat, 0xe2dfd6, scrub, 4),
        // Knee-length white doctor's lab coat skirt
        { p: [0, 0.68, 0], s: [0.276, 0.36, 0.428], c: coat, cyl: true, seg: 8, top: 0.92 },
        ...pocketFlaps(0.84, 0xe4e1d8, false),
        ...pocketFlaps(1.22, 0xe4e1d8, true),
        // Cross-body Red Cross shoulder medical kit
        { p: [0, 1.15, 0], s: [0.275, 0.54, 0.036], c: 0x3b4844, rx: 0.58 },
        { p: [-0.05, 0.87, 0.245], s: [0.21, 0.22, 0.095], c: 0xf4f2ec, bevel: true },
        { p: [-0.05, 0.88, 0.295], s: [0.095, 0.028, 0.016], c: C.redCross },
        { p: [-0.05, 0.88, 0.295], s: [0.028, 0.095, 0.016], c: C.redCross },
        // Stethoscope draped around collar
        { p: [0.02, 1.44, 0], s: [0.21, 0.032, 0.23], c: 0x22262a, torus: true, tube: 0.06, seg: 10, detail: 4, rx: H },
        { p: [0.136, 1.24, -0.055], s: [0.02, 0.26, 0.02], c: 0x22262a, cyl: true, seg: 5 },
        { p: [0.142, 1.11, -0.055], s: [0.044, 0.044, 0.018], c: C.chrome, cyl: true, rz: H, seg: 8 },
        // Left-arm Red Cross armband
        ...buildArms(coat, coat, 0xe2dfd6),
        { p: [0.008, 1.24, 0.256], s: [0.132, 0.115, 0.122], c: 0xf6f4ee, cyl: true, seg: 8, open: true },
        { p: [0.008, 1.24, 0.318], s: [0.014, 0.068, 0.022], c: C.redCross },
        { p: [0.008, 1.24, 0.318], s: [0.014, 0.022, 0.068], c: C.redCross },
        // Blank head + doctor's white cap with Red Cross emblem
        ...blankHeadParts(),
        { p: [0.012, 1.715, 0], s: [0.19, 0.072, 0.175], c: 0xf6f4ee, cyl: true, seg: 8, top: 0.88 },
        { p: [0.105, 1.72, 0], s: [0.014, 0.036, 0.014], c: C.redCross },
        { p: [0.105, 1.72, 0], s: [0.014, 0.014, 0.036], c: C.redCross },
      ];
    }

    case 'press_editor': {
      const shirt = 0xf0ede4;
      const vest = 0x2b303a;
      return [
        ...buildLegsAndShoes(0x23262e, { sole: 0x161412, upper: 0x261d17, heel: true }),
        // Tailored white shirt + dark waistcoat vest + burgundy necktie + silver pen clip
        { p: [0, 0.81, 0], s: [0.254, 0.06, 0.405], c: 0x1e1814, cyl: true, seg: 8 },
        { p: [0, 0.90, 0], s: [0.264, 0.16, 0.415], c: shirt, cyl: true, seg: 8, top: 0.95 },
        { p: [0, 1.18, 0], s: [0.244, 0.44, 0.39], c: vest, cyl: true, seg: 8, top: 1.12 },
        { p: [0, 1.415, 0], s: [0.205, 0.062, 0.25], c: shirt, cyl: true, seg: 8, top: 0.85 },
        { p: [0.118, 1.32, 0], s: [0.042, 0.17, 0.11], c: shirt },
        { p: [0.132, 1.24, 0], s: [0.016, 0.24, 0.038], c: 0x702220 }, // loosened tie
        { p: [0.136, 1.35, 0], s: [0.020, 0.036, 0.036], c: 0x702220 },
        ...pocketFlaps(0.96, 0x232730, false),
        { p: [0.136, 1.28, 0.095], s: [0.016, 0.075, 0.014], c: C.chrome },
        // Rolled white shirt sleeves with white forearms
        ...buildArms(shirt, shirt, undefined, [
          { p: [0, 1.35, 0.245], s: [0.132, 0.125, 0.118], c: shirt, sphere: true, detail: 0 },
          { p: [0.005, 1.22, 0.255], s: [0.116, 0.24, 0.106], c: shirt, cyl: true, seg: 6, top: 0.88, open: true },
          { p: [0.015, 1.11, 0.255], s: [0.122, 0.042, 0.112], c: 0xe2ded2, cyl: true, seg: 6 },
          { p: [0.032, 0.98, 0.255], s: [0.082, 0.20, 0.078], c: FACE_WHITE, cyl: true, seg: 6, rz: 0.18 },
          { p: [0.052, 0.84, 0.255], s: [0.078, 0.095, 0.072], c: FACE_WHITE, sphere: true, detail: 0 },
        ], [
          { p: [0, 1.35, -0.245], s: [0.132, 0.125, 0.118], c: shirt, sphere: true, detail: 0 },
          { p: [0.005, 1.22, -0.255], s: [0.116, 0.24, 0.106], c: shirt, cyl: true, seg: 6, top: 0.88, open: true },
          { p: [0.015, 1.11, -0.255], s: [0.122, 0.042, 0.112], c: 0xe2ded2, cyl: true, seg: 6 },
          { p: [0.032, 0.98, -0.255], s: [0.082, 0.20, 0.078], c: FACE_WHITE, cyl: true, seg: 6, rz: 0.18 },
          { p: [0.052, 0.84, -0.255], s: [0.078, 0.095, 0.072], c: FACE_WHITE, sphere: true, detail: 0 },
        ]),
        ...blankHeadParts(),
      ];
    }

    case 'press_typesetter': {
      const blouse = 0x823832;
      const apron = 0x202e42;
      return [
        ...buildLegsAndShoes(0x22262e, { sole: 0xe2ded4, upper: 0x1b1c1f }, false),
        ...shirtAndJacketTorso(blouse, 0x6f2d28, 0xeae5d8, 3),
        // Full-length indigo printer's bib apron + neck loop + front tool pocket
        { p: [0.126, 0.95, 0], s: [0.038, 0.68, 0.34], c: apron, bevel: true },
        { p: [0.120, 1.34, 0.08], s: [0.016, 0.16, 0.026], c: apron },
        { p: [0.120, 1.34, -0.08], s: [0.016, 0.16, 0.026], c: apron },
        { p: [0.146, 0.92, 0], s: [0.024, 0.15, 0.18], c: 0x182232 },
        { p: [0.146, 1.02, 0.05], s: [0.014, 0.09, 0.012], c: C.chrome }, // lead-type tweezers
        // Black ink-guard oversleeves (袖套) on forearms
        ...buildArms(blouse, 0x1c1e22, 0x1c1e22),
        ...blankHeadParts(),
      ];
    }

    case 'photojournalist': {
      const shirt = 0xc6bba4;
      const vest = 0x7d6d50;
      return [
        ...buildLegsAndShoes(0x2a2926, { sole: 0x181512, upper: 0x3b2a1e, heel: true }),
        ...shirtAndJacketTorso(vest, 0x6a5b42, shirt, 3),
        // Multi-pocket safari photo vest + 4 cargo pockets + leather camera bag + chest SLR
        ...pocketFlaps(0.95, 0x6b5d44, false),
        ...pocketFlaps(1.23, 0x6b5d44, true),
        { p: [0, 1.16, 0], s: [0.285, 0.56, 0.044], c: 0x3b2c1e, rx: -0.58 },
        { p: [-0.04, 0.87, -0.25], s: [0.22, 0.21, 0.105], c: 0x3b2c1e, bevel: true },
        { p: [0.11, 1.33, 0], s: [0.042, 0.18, 0.125], c: 0x1a1a1c },
        ...slrCamera(0.162, 1.19, 0),
        ...buildArms(shirt, shirt, 0xb8ad96),
        ...blankHeadParts(),
      ];
    }

    case 'scholar_professor': {
      const tweed = 0x4c443c;
      const trim = 0x3c352f;
      return [
        ...buildLegsAndShoes(0x2c2e34, { sole: 0x161412, upper: 0x261d17, heel: true }),
        ...shirtAndJacketTorso(tweed, trim, 0xeae4d6, 3),
        { p: [0.132, 0.72, 0], s: [0.020, 0.22, 0.36], c: trim }, // blazer hem
        ...pocketFlaps(0.92, trim, false),
        { p: [0.132, 1.24, 0.088], s: [0.016, 0.068, 0.014], c: C.brass }, // fountain pen
        // Brown leather briefcase in right hand
        ...buildArms(tweed, tweed, 0xeae4d6, undefined, [
          { p: [0, 1.35, -0.245], s: [0.134, 0.13, 0.12], c: tweed, sphere: true, detail: 0 },
          { p: [0.005, 1.22, -0.255], s: [0.118, 0.26, 0.108], c: tweed, cyl: true, seg: 6, top: 0.88, open: true },
          { p: [0.028, 1.00, -0.255], s: [0.106, 0.23, 0.096], c: tweed, cyl: true, seg: 6, top: 0.84, rz: 0.18 },
          { p: [0.052, 0.84, -0.255], s: [0.078, 0.098, 0.072], c: FACE_WHITE, sphere: true, detail: 0 },
          { p: [0.06, 0.66, -0.275], s: [0.28, 0.22, 0.085], c: 0x4a2f1d, bevel: true },
          { p: [0.06, 0.79, -0.275], s: [0.10, 0.04, 0.025], c: 0x352012 },
          { p: [0.06, 0.68, -0.32], s: [0.036, 0.04, 0.014], c: C.brass },
        ]),
        ...blankHeadParts(),
      ];
    }

    case 'worker_master': {
      const jacket = 0x28405e;
      const trim = 0x1e324b;
      return [
        ...buildLegsAndShoes(0x232934, { sole: 0x1a1a1c, upper: 0x202226, heel: true }),
        ...shirtAndJacketTorso(jacket, trim, 0xe8e2d2, 5),
        ...pocketFlaps(1.22, trim, true),
        { p: [0.136, 1.26, -0.092], s: [0.014, 0.072, 0.014], c: C.chrome }, // steel rule/caliper
        // Signature white cotton neck sweat towel (白毛巾) with crimson stripes
        { p: [0.01, 1.445, 0], s: [0.225, 0.048, 0.255], c: 0xf4f1e8, cyl: true, seg: 8 },
        { p: [0.128, 1.27, 0.072], s: [0.028, 0.28, 0.068], c: 0xf4f1e8, rx: -0.08 },
        { p: [0.128, 1.27, -0.072], s: [0.028, 0.28, 0.068], c: 0xf4f1e8, rx: 0.08 },
        { p: [0.132, 1.155, 0.072], s: [0.030, 0.022, 0.070], c: 0xa82a22 },
        { p: [0.132, 1.155, -0.072], s: [0.030, 0.022, 0.070], c: 0xa82a22 },
        ...oliveSatchel(false),
        ...buildArms(jacket, jacket, trim),
        ...blankHeadParts(),
        // Indigo duckbill worker cap (工人鴨舌帽)
        { p: [0.006, 1.695, 0], s: [0.214, 0.092, 0.198], c: 0x24364e, sphere: true, detail: 1 },
        { p: [0.118, 1.662, 0], s: [0.105, 0.024, 0.175], c: 0x1a283a, rz: -0.15 },
      ];
    }

    case 'worker_apprentice': {
      const trackBlue = 0x24497a;
      const trackTrim = 0xd83228;
      return [
        ...buildLegsAndShoes(0x232d42, { sole: 0xeae5d8, upper: 0xf2efe6, sneakerStripe: true }),
        ...shirtAndJacketTorso(trackBlue, 0x1d3b64, 0xe8e2d2, 0),
        // Ribbed stand collar + crisp white chest zip + side waist band
        { p: [0.005, 1.425, 0], s: [0.218, 0.072, 0.245], c: 0x1d3b64, cyl: true, seg: 8 },
        { p: [0.135, 1.18, 0], s: [0.014, 0.42, 0.018], c: 0xf0ece0 },
        { p: [0, 0.86, 0], s: [0.272, 0.058, 0.418], c: 0x1a3458, cyl: true, seg: 8 },
        { p: [0.125, 1.14, 0.14], s: [0.022, 0.34, 0.024], c: trackTrim },
        { p: [0.125, 1.14, -0.14], s: [0.022, 0.34, 0.024], c: trackTrim },
        // Classic 1980s Meihua track jacket vertical white stripes along outer sleeves
        ...buildArms(trackBlue, trackBlue, 0x1d3b64),
        { p: [0.018, 1.16, 0.308], s: [0.024, 0.44, 0.018], c: 0xf4f1e8, rz: 0.08 },
        { p: [0.018, 1.16, -0.308], s: [0.024, 0.44, 0.018], c: 0xf4f1e8, rz: 0.08 },
        ...blankHeadParts(),
      ];
    }

    case 'store_clerk': {
      const jacket = 0x35546a;
      const apron = 0xf2efe6;
      return [
        ...buildLegsAndShoes(0x282c34, { sole: 0xe6e2d6, upper: 0x1b1a18, strap: true }),
        ...shirtAndJacketTorso(jacket, 0x2b4558, 0xeae5d8, 4),
        // Crisp white waist apron with front pocket + protective dark-blue oversleeves
        { p: [0.128, 0.80, 0], s: [0.042, 0.44, 0.35], c: apron, bevel: true },
        { p: [0.142, 0.84, 0], s: [0.018, 0.14, 0.17], c: 0xe2ded2 },
        ...buildArms(jacket, 0x243b4d, 0x243b4d),
        ...blankHeadParts(),
        // White state-commerce clerk cap
        { p: [0.012, 1.715, 0], s: [0.194, 0.075, 0.180], c: 0xf4f2ec, cyl: true, seg: 8, top: 0.88 },
      ];
    }

    case 'courtyard_auntie': {
      const jacket = 0x742e34;
      const trim = 0x5c2328;
      return [
        ...buildLegsAndShoes(0x262830, { sole: 0xe8e4d8, upper: 0x18181a, strap: true }),
        ...shirtAndJacketTorso(jacket, trim, 0xebe6da, 5),
        // Home cloth waist apron + enamel mug in left hand
        { p: [0.128, 0.78, 0], s: [0.036, 0.40, 0.32], c: 0x5d646b, bevel: true },
        { p: [0.142, 0.81, 0], s: [0.018, 0.13, 0.16], c: 0x4b5158 },
        ...buildArms(jacket, jacket, trim, [
          { p: [0, 1.35, 0.245], s: [0.134, 0.13, 0.12], c: jacket, sphere: true, detail: 0 },
          { p: [0.005, 1.22, 0.255], s: [0.118, 0.26, 0.108], c: jacket, cyl: true, seg: 6, top: 0.88, open: true },
          { p: [0.06, 1.01, 0.255], s: [0.106, 0.22, 0.096], c: jacket, cyl: true, seg: 6, rz: 0.45 },
          { p: [0.115, 0.89, 0.255], s: [0.078, 0.092, 0.072], c: FACE_WHITE, sphere: true, detail: 0 },
          { p: [0.16, 0.86, 0.255], s: [0.095, 0.115, 0.095], c: C.enamel, cyl: true, seg: 8 },
          { p: [0.16, 0.916, 0.255], s: [0.098, 0.015, 0.098], c: 0x26446e, cyl: true, seg: 8 },
        ]),
        ...blankHeadParts(),
      ];
    }

    case 'hutong_elder': {
      const zhongshan = 0x46484b;
      const trim = 0x36383b;
      return [
        ...buildLegsAndShoes(0x323438, { sole: 0xe6e2d6, upper: 0x19191b, strap: true }),
        // Classic 4-pocket Zhongshan jacket (中山裝) with closed stand collar
        { p: [0, 0.81, 0], s: [0.258, 0.06, 0.41], c: trim, cyl: true, seg: 8 },
        { p: [0, 0.90, 0], s: [0.270, 0.18, 0.422], c: zhongshan, cyl: true, seg: 8, top: 0.94 },
        { p: [0, 1.18, 0], s: [0.246, 0.44, 0.392], c: zhongshan, cyl: true, seg: 8, top: 1.14 },
        { p: [-0.005, 1.425, 0], s: [0.214, 0.075, 0.248], c: trim, cyl: true, seg: 8 }, // closed stand collar
        { p: [0.112, 1.425, 0], s: [0.018, 0.032, 0.042], c: 0xeae5d8 }, // collar tip
        { p: [0.135, 1.06, 0], s: [0.012, 0.42, 0.022], c: trim },
        ...[0, 1, 2, 3, 4].map(i => ({
          p: [0.141, 1.34 - i * 0.105, 0] as [number, number, number],
          s: [0.012, 0.022, 0.022] as [number, number, number],
          c: 0x1d1e20,
          cyl: true,
          rz: H,
          seg: 6,
        })),
        ...pocketFlaps(1.22, trim, true),
        ...pocketFlaps(0.92, trim, false),
        ...buildArms(zhongshan, zhongshan, trim),
        ...blankHeadParts(),
      ];
    }

    case 'student_picket': {
      const shirt = 0xebe7dc;
      return [
        ...buildLegsAndShoes(C.navy, { sole: 0xeae5d8, upper: 0xf2efe6, sneakerStripe: true }),
        ...shirtAndJacketTorso(shirt, 0xd8d3c6, 0xf6f3eb, 4),
        // Silver whistle on crimson lanyard
        { p: [0.118, 1.30, 0], s: [0.018, 0.18, 0.016], c: 0xb8241c },
        { p: [0.132, 1.18, 0], s: [0.028, 0.024, 0.022], c: C.chrome },
        ...oliveSatchel(false),
        ...buildArms(shirt, shirt, 0xd8d3c6),
        // Crimson-and-white Picket Marshal armband (糾察臂章) on left upper arm
        { p: [0.008, 1.24, 0.256], s: [0.132, 0.115, 0.122], c: 0xb8241c, cyl: true, seg: 8, open: true },
        { p: [0.008, 1.24, 0.256], s: [0.136, 0.028, 0.126], c: 0xf6f4ee, cyl: true, seg: 8, open: true },
        ...blankHeadParts(),
        { p: [0.012, 1.645, 0], s: [0.212, 0.048, 0.194], c: 0xf4f1ea, cyl: true, seg: 8 },
        { p: [-0.115, 1.58, 0.025], s: [0.032, 0.14, 0.042], c: 0xf4f1ea, rz: -0.35 },
      ];
    }

    case 'student_overcoat': {
      const overcoat = 0x434f36;
      const trim = 0x35402a;
      return [
        ...buildLegsAndShoes(C.navy, { sole: 0xe6e2d6, upper: 0xf2efe6, sneakerStripe: true }),
        ...shirtAndJacketTorso(overcoat, trim, 0xe8e2d2, 0),
        // Heavy knee-length Type-65 double-breasted military cotton greatcoat
        { p: [0, 0.66, 0], s: [0.292, 0.44, 0.445], c: overcoat, cyl: true, seg: 8, top: 0.90 },
        { p: [0, 1.43, 0], s: [0.228, 0.095, 0.295], c: trim, cyl: true, seg: 8, top: 1.08 },
        ...[0, 1, 2].flatMap(i => [
          { p: [0.146, 1.24 - i * 0.12, 0.055] as [number, number, number], s: [0.014, 0.024, 0.024] as [number, number, number], c: 0x26291e, cyl: true, rz: H, seg: 6 },
          { p: [0.146, 1.24 - i * 0.12, -0.055] as [number, number, number], s: [0.014, 0.024, 0.024] as [number, number, number], c: 0x26291e, cyl: true, rz: H, seg: 6 },
        ]),
        ...pocketFlaps(0.86, trim, false),
        ...buildArms(overcoat, overcoat, trim),
        ...blankHeadParts(),
        { p: [0.012, 1.645, 0], s: [0.212, 0.048, 0.194], c: 0xf4f1ea, cyl: true, seg: 8 },
      ];
    }

    case 'student_female': {
      const jacket = 0x842e32;
      const trim = 0x6b2327;
      const scarf = 0xefeae0;
      return [
        ...buildLegsAndShoes(0x23252c, { sole: 0x1a1816, upper: 0x2a1c19, strap: true }, true),
        ...shirtAndJacketTorso(jacket, trim, 0xf2eee4, 4),
        // Draped cream knit scarf (米白圍巾) around neck & chest
        { p: [0.01, 1.44, 0], s: [0.222, 0.055, 0.252], c: scarf, cyl: true, seg: 8 },
        { p: [0.132, 1.28, 0.048], s: [0.030, 0.26, 0.068], c: scarf, rx: -0.08 },
        { p: [0.132, 1.25, -0.045], s: [0.028, 0.24, 0.064], c: 0xe4dfd3, rx: 0.08 },
        ...oliveSatchel(false),
        // Rolled white flyer/pamphlet peeking from satchel flap
        { p: [-0.01, 0.99, 0.242], s: [0.052, 0.052, 0.13], c: 0xf6f3ea, cyl: true, rx: H, seg: 6 },
        ...buildArms(jacket, jacket, trim),
        ...blankHeadParts(0.015, 1.59, 0, 0.96),
        ...(inCamp
          ? [
              { p: [0.012, 1.64, 0], s: [0.204, 0.046, 0.188], c: 0xf4f1ea, cyl: true, seg: 8 } as Part,
              { p: [-0.11, 1.575, 0.025], s: [0.03, 0.13, 0.04], c: 0xf4f1ea, rz: -0.35 } as Part,
            ]
          : []),
      ];
    }

    case 'student_male':
    default: {
      const jacket = 0x565d46;
      const trim = 0x454c38;
      return [
        ...buildLegsAndShoes(C.navy, { sole: 0xeae5d8, upper: 0xf2efe6, sneakerStripe: true }),
        ...shirtAndJacketTorso(jacket, trim, 0xeeeae0, 4),
        // Navy V-neck vest peeking inside jacket collar + rectangular PKU red/white pin badge (校徽)
        { p: [0.122, 1.24, 0], s: [0.030, 0.15, 0.105], c: 0x26354d },
        { p: [0.138, 1.31, 0.086], s: [0.012, 0.022, 0.054], c: 0xf4f1ea },
        { p: [0.141, 1.31, 0.086], s: [0.013, 0.010, 0.042], c: 0xb8241c },
        ...pocketFlaps(1.20, trim, true),
        ...oliveSatchel(false),
        ...buildArms(jacket, jacket, trim),
        ...blankHeadParts(),
        ...(inCamp
          ? [
              { p: [0.012, 1.645, 0], s: [0.212, 0.048, 0.194], c: 0xf4f1ea, cyl: true, seg: 8 } as Part,
              { p: [-0.115, 1.58, 0.025], s: [0.032, 0.14, 0.042], c: 0xf4f1ea, rz: -0.35 } as Part,
            ]
          : []),
      ];
    }
  }
}
