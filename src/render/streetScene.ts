import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C, Part, addLayeredParts, glowMat, instanced, litMat, mergeParts, place, rng, textTexture, vertText } from './kit';
import {
  ambulance, bike, coalAndCabbage, crowdPerson, lampHead, lampPole, person,
  phoneBooth, radioStool, tableBasin, tricycle, trolleybus, trolleyWindows,
} from './props';
import { addRealisticTrees } from './foliage';
import { asphaltRoadTex, campusPathTex, skyDomeTex } from './materials';
import {
  attachStreetMarchProcession,
  type MarchProcessionHandle,
  type MarchVariant,
  type ObstacleCircle,
} from './marchProcession';
import type { SceneId } from '../types';
import type { World, WorldCollider } from './scenes';

export type StreetMode = 'night' | 'march' | 'blockade' | 'hutong';

function createStreetBase(mode: StreetMode): THREE.Scene {
  const blockade = mode === 'blockade';
  const hutong = mode === 'hutong';
  const fogCol = blockade ? 0x26170b : hutong ? 0x0b0e16 : 0x121423;
  const s = new THREE.Scene();
  s.background = skyDomeTex(blockade ? 'blockade' : hutong ? 'hutong' : 'night');
  s.fog = new THREE.Fog(fogCol, hutong ? 10 : blockade ? 14 : 18, hutong ? 52 : blockade ? 65 : 74);

  if (blockade) {
    s.add(new THREE.HemisphereLight(0x885828, 0x1d1309, 0.95));
    const amb = new THREE.DirectionalLight(0xffb460, 0.45);
    amb.position.set(-14, 18, 10);
    s.add(amb);
  } else {
    s.add(new THREE.HemisphereLight(hutong ? 0x4a5570 : 0x55607a, 0x1c1810, hutong ? 0.85 : 0.95));
    const moon = new THREE.DirectionalLight(0x8090b0, hutong ? 0.32 : 0.38);
    moon.position.set(-10, 20, 8);
    s.add(moon);
  }
  return s;
}

function addSodiumLight(s: THREE.Scene, x: number, z: number, intensity = 16, dist = 20) {
  const l = new THREE.PointLight(C.sodium, intensity, dist, 1.6);
  l.position.set(x, 4.6, z);
  s.add(l);
}

function addStreetSignsAtlas(s: THREE.Scene) {
  const specs: Array<{
    text: string; x: number; y: number; z: number; w: number; h: number;
    bg: string; fg: string; ry: number; vertical?: boolean;
  }> = [
    { text: '報刊', x: -6, y: 2.38, z: -2.82, w: 1.8, h: 0.42, bg: '#2a3b2f', fg: '#f0e2b0', ry: Math.PI },
    { text: '五金交電商店', x: -30, y: 3.85, z: 0.32, w: 5.2, h: 0.92, bg: '#1e3d2b', fg: '#f2e2ae', ry: Math.PI },
    { text: '國營副食店', x: -15, y: 4.25, z: 2.12, w: 6.0, h: 1.05, bg: '#7d2a22', fg: '#f3e3b5', ry: Math.PI },
    { text: '紅星飯館', x: -1, y: 4.35, z: 0.32, w: 4.4, h: 0.90, bg: '#203a2c', fg: '#f6dd9a', ry: Math.PI },
    { text: '國營理髮', x: 8.0, y: 3.55, z: 0.32, w: 2.9, h: 0.72, bg: '#d9d0b8', fg: '#8c2a22', ry: Math.PI },
    { text: '百貨商店', x: 26, y: 3.88, z: 0.34, w: 4.4, h: 0.88, bg: '#8c2a22', fg: '#f4e5b8', ry: Math.PI },
    { text: '西斜街胡同', x: 11.4, y: 2.55, z: -0.22, w: 0.92, h: 0.34, bg: '#1b4788', fg: '#f2efe6', ry: Math.PI },
    { text: '公共汽車站', x: -18, y: 2.38, z: -5.02, w: 0.48, h: 1.18, bg: '#efe7d0', fg: '#7d2a22', ry: Math.PI, vertical: true },
  ];
  const cols = 2, rows = 4, cellW = 512, cellH = 256, texW = cols * cellW, texH = rows * cellH;
  const tex = textTexture(texW, texH, g => {
    g.fillStyle = '#202224';
    g.fillRect(0, 0, texW, texH);
    specs.forEach((sp, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = col * cellW;
      const cy = row * cellH;
      if (sp.vertical) {
        const vx = cx + 192;
        const vw = 128;
        g.fillStyle = sp.bg;
        g.fillRect(vx, cy, vw, cellH);
        g.strokeStyle = sp.fg;
        g.lineWidth = 4;
        g.strokeRect(vx + 4, cy + 4, vw - 8, cellH - 8);
        g.fillStyle = sp.fg;
        vertText(g, sp.text, vx + vw / 2, cy + 16, 42);
      } else {
        g.fillStyle = sp.bg;
        g.fillRect(cx, cy, cellW, cellH);
        g.strokeStyle = sp.fg;
        g.lineWidth = 5;
        g.strokeRect(cx + 6, cy + 6, cellW - 12, cellH - 12);
        g.fillStyle = sp.fg;
        g.font = 'bold 78px "Noto Serif CJK TC","Noto Sans CJK TC",serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(sp.text, cx + cellW / 2, cy + cellH / 2 + 2, cellW - 36);
      }
    });
  });
  tex.userData.sceneOwned = true;

  const geos: THREE.BufferGeometry[] = [];
  const padU = 3 / texW;
  const padV = 3 / texH;
  specs.forEach((sp, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const u0 = sp.vertical ? (col * cellW + 192) / texW + padU : col / cols + padU;
    const u1 = sp.vertical ? (col * cellW + 320) / texW - padU : (col + 1) / cols - padU;
    const vTop = 1 - row / rows - padV;
    const vBot = 1 - (row + 1) / rows + padV;
    const q = new THREE.PlaneGeometry(sp.w, sp.h);
    const uv = q.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) {
      uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), vBot + uv.getY(k) * (vTop - vBot));
    }
    q.rotateY(sp.ry);
    q.translate(sp.x, sp.y, sp.z);
    geos.push(q);
  });
  const merged = mergeGeometries(geos)!;
  for (const q of geos) q.dispose();
  s.add(new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ map: tex, fog: true })));
}

/** Add a framed multi-pane window with sill, lintel, and dark or glowing glass. */
function addWindow(
  stat: Part[], glow: Part[], x: number, y: number, z: number,
  w: number, h: number, lit: boolean, face: 1 | -1 = -1, warm = true,
) {
  const fz = z + face * 0.03;
  // Concrete sill & lintel
  stat.push(
    { p: [x, y - h / 2 - 0.05, fz + face * 0.04], s: [w + 0.24, 0.10, 0.16], c: 0x6a675f },
    { p: [x, y + h / 2 + 0.06, fz + face * 0.03], s: [w + 0.20, 0.12, 0.14], c: 0x5c5952 },
    // Outer wooden frame
    { p: [x, y, fz], s: [w, h, 0.06], c: 0x3b2c20 },
    // Center vertical & horizontal mullions
    { p: [x, y, fz + face * 0.025], s: [0.06, h - 0.08, 0.04], c: 0x4b3828 },
    { p: [x, y + 0.08, fz + face * 0.025], s: [w - 0.08, 0.05, 0.04], c: 0x4b3828 },
  );
  const target = lit ? glow : stat;
  const col = lit ? (warm ? C.window : 0xf0ecc8) : 0x191f26;
  target.push({ p: [x, y, fz + face * 0.015], s: [w - 0.14, h - 0.14, 0.03], c: col, noAO: lit });
}

/** Add a Beijing blue-and-white pedestrian/bike guardrail (京式交通護欄) along X at given Z. */
function addGuardrail(stat: Part[], x0: number, x1: number, z: number) {
  const len = x1 - x0;
  const cx = (x0 + x1) / 2;
  stat.push(
    { p: [cx, 0.72, z], s: [len, 0.06, 0.05], c: 0xe2dfd4 },
    { p: [cx, 0.22, z], s: [len, 0.05, 0.05], c: 0xe2dfd4 },
  );
  const step = 2.4;
  for (let x = x0; x <= x1 + 0.01; x += step) {
    stat.push(
      { p: [x, 0.06, z], s: [0.16, 0.12, 0.22], c: 0x6f6c64 }, // concrete foot
      { p: [x, 0.42, z], s: [0.07, 0.72, 0.07], c: 0x2b5a94 }, // blue stanchion
    );
    if (x + step <= x1 + 0.01) {
      for (const frac of [0.33, 0.67]) {
        stat.push({ p: [x + step * frac, 0.47, z], s: [0.035, 0.46, 0.035], c: 0x3569a6 });
      }
    }
  }
}

/** Add a 1980s balcony with concrete slab, iron pipe railing, and optional laundry/flowerpots. */
function addBalcony(
  stat: Part[], x: number, y: number, zFront: number, w: number,
  r: () => number, quiet: boolean, face: 1 | -1 = -1,
) {
  const bz = zFront + face * 0.48;
  const railZ = zFront + face * 0.92;
  stat.push(
    { p: [x, y - 0.72, bz], s: [w, 0.14, 0.96], c: 0x6a675f },
    { p: [x, y - 0.24, railZ], s: [w, 0.05, 0.05], c: 0x2d3236 },
  );
  const posts = 4;
  for (let i = 0; i <= posts; i++) {
    const px = x - w / 2 + 0.08 + (i * (w - 0.16)) / posts;
    stat.push({ p: [px, y - 0.46, railZ], s: [0.04, 0.48, 0.04], c: 0x2d3236 });
  }
  if (r() < 0.7) {
    stat.push(
      { p: [x - w * 0.28, y - 0.55, bz + face * 0.18], s: [0.22, 0.20, 0.22], c: 0x8d4b32, cyl: true, seg: 6, top: 1.2 },
      { p: [x - w * 0.28, y - 0.38, bz + face * 0.18], s: [0.26, 0.22, 0.26], c: 0x2f4828, sphere: true, detail: 0 },
    );
  }
  if (!quiet && r() < 0.8) {
    const laundryCols = [0xe4dfd0, 0x456280, 0x5c6b4d, 0x943d34, 0xb8ad92];
    stat.push({ p: [x, y + 0.35, bz + face * 0.18], s: [w - 0.3, 0.02, 0.02], c: 0x9c988e });
    for (let k = -1; k <= 1; k++) {
      if (r() < 0.72) {
        stat.push({
          p: [x + k * 0.62, y + 0.05, bz + face * 0.18],
          s: [0.40, 0.54, 0.04],
          c: laundryCols[Math.floor(r() * laundryCols.length)],
        });
      }
    }
  }
}

/** Build textured road, north/south brick sidewalks, granite curbs, drains, crosswalks & Beijing guardrails. */
function buildRoadAndSidewalks(s: THREE.Scene, stat: Part[], mode: StreetMode) {
  const blockade = mode === 'blockade';
  const march = mode === 'march';

  // Textured main avenue (120m x 10m at z = -10)
  const roadPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 10),
    new THREE.MeshLambertMaterial({ map: asphaltRoadTex(24, 3) }),
  );
  roadPlane.rotation.x = -Math.PI / 2;
  roadPlane.position.set(0, 0.004, -10);
  s.add(roadPlane);

  // Textured north & south brick sidewalks merged into a single draw call (z = 3 and z = -22)
  const nWalkGeo = new THREE.PlaneGeometry(120, 16);
  nWalkGeo.rotateX(-Math.PI / 2);
  nWalkGeo.translate(0, 0.032, 3);
  const sWalkGeo = new THREE.PlaneGeometry(120, 14);
  sWalkGeo.rotateX(-Math.PI / 2);
  sWalkGeo.translate(0, 0.032, -22);
  const walksGeo = mergeGeometries([nWalkGeo, sWalkGeo])!;
  nWalkGeo.dispose();
  sWalkGeo.dispose();
  s.add(new THREE.Mesh(walksGeo, new THREE.MeshLambertMaterial({ map: campusPathTex(30, 4) })));

  // Solid sub-bases underneath so no edge gaps appear at shallow angles
  stat.push(
    { p: [0, -0.06, -10], s: [120, 0.10, 10.2], c: C.asphalt },
    { p: [0, -0.04, 3], s: [120, 0.12, 16.2], c: 0x2b2927 },
    { p: [0, -0.04, -22], s: [120, 0.12, 14.2], c: 0x2b2927 },
  );

  // Dashed white lane dividers & bicycle lane lines
  for (let x = -56; x < 58; x += 5.5) {
    stat.push({ p: [x, 0.012, -10], s: [2.6, 0.012, 0.14], c: 0xd0cec4, noAO: true });
  }
  for (const lz of [-7.0, -13.0]) {
    for (let x = -55; x < 56; x += 6.5) {
      stat.push({ p: [x, 0.012, lz], s: [3.6, 0.012, 0.09], c: 0xa6a498, noAO: true });
    }
  }

  // Zebra crosswalks at guardrail openings (x = -26 and x = 18.5)
  for (const cx of [-26, 18.5]) {
    for (let z = -14.2; z <= -5.7; z += 1.2) {
      stat.push({ p: [cx, 0.014, z], s: [1.65, 0.012, 0.44], c: 0xbcb8aa, noAO: true });
    }
  }

  // Granite curb stones along z = -4.9 and z = -15.1 (with dropped apron at hutong mouth x = 12.6..16.4)
  for (let x = -54; x <= 54; x += 2.0) {
    const isHutongMouth = x > 12.5 && x < 16.5;
    const col = Math.abs(Math.round(x / 2.0)) % 2 === 0 ? 0x7c786e : 0x6b675e;
    stat.push({
      p: [x, isHutongMouth ? 0.025 : 0.06, -4.9],
      s: [1.92, isHutongMouth ? 0.05 : 0.12, 0.24],
      c: col,
    });
    stat.push({ p: [x, 0.06, -15.1], s: [1.92, 0.12, 0.24], c: col });
  }

  // Cast-iron storm drain grates along gutters
  for (let x = -45; x <= 45; x += 18) {
    for (const gz of [-5.28, -14.72]) {
      stat.push({ p: [x, 0.012, gz], s: [0.70, 0.02, 0.36], c: 0x1a1c1e });
      for (const gx of [-0.16, 0, 0.16]) {
        stat.push({ p: [x + gx, 0.024, gz], s: [0.04, 0.015, 0.32], c: 0x3b3f44 });
      }
    }
  }

  // Blue-and-white Beijing bike/pedestrian guardrails (removed during march so linked pickets define the corridor cleanly)
  if (!march) {
    addGuardrail(stat, -46, -34, -7.2);
    addGuardrail(stat, -24, -19.5, -7.2);
    addGuardrail(stat, 22, 38, -7.2);
    if (!blockade) {
      addGuardrail(stat, 6.5, 13.5, -7.2);
    }
    addGuardrail(stat, -46, -32, -13.1);
    if (!blockade) {
      addGuardrail(stat, -16, -4, -13.1);
    }
    addGuardrail(stat, 21, 37, -13.1);
  }
}

/** 1. West Brick Apartment & Hardware/Book Shop (x = -30, z = 2.5, w = 14, h = 7.5). */
function buildWestHardwareBlock(stat: Part[], glow: Part[], r: () => number, hutong: boolean) {
  const x = -30, z = 2.5, w = 14, h = 7.5, d = 4.2;
  const frontZ = z - d / 2; // 0.4
  stat.push(
    { p: [x, 0.28, z], s: [w + 0.14, 0.56, d + 0.14], c: 0x5c5952, tex: 'ashlarStone' }, // stone plinth
    { p: [x, h / 2, z], s: [w, h, d], c: C.greyBrick, tex: 'qingBrick' },               // grey brick facade
    { p: [x, 3.55, frontZ - 0.06], s: [w + 0.2, 0.18, 0.14], c: 0x706c64, tex: 'ashlarStone' }, // belt cornice
    { p: [x, h + 0.12, z], s: [w + 0.4, 0.26, d + 0.4], c: 0x625f58, tex: 'ashlarStone' },     // roof cornice
    // Pitched tile roof (ridge along X) + brick chimney
    { p: [x, h + 1.05, z], s: [d + 0.5, 1.6, w + 0.4], c: 0x3b3d40, prism: true, ry: Math.PI / 2, tex: 'roofTile' },
    { p: [x, h + 1.88, z], s: [w + 0.4, 0.14, 0.22], c: 0x2c2e30 },
    { p: [x - 4.2, h + 1.9, z + 0.8], s: [0.65, 1.2, 0.65], c: C.brick, tex: 'redBrick' },
    { p: [x - 4.2, h + 2.55, z + 0.8], s: [0.76, 0.14, 0.76], c: 0x45474a },
  );
  // Exterior cast-iron rainwater downspouts flanking the facade
  for (const dx of [x - w / 2 + 0.45, x + w / 2 - 0.45]) {
    stat.push({ p: [dx, h * 0.5, frontZ - 0.08], s: [0.09, h - 0.3, 0.09], c: 0x3a3e42, cyl: true, seg: 6 });
  }

  // Red-brick corner quoins along front corners
  for (const cx of [x - w / 2, x + w / 2]) {
    for (let qy = 0.7; qy < h - 0.2; qy += 0.65) {
      const wide = Math.round(qy / 0.65) % 2 === 0;
      stat.push({
        p: [cx + (cx < x ? 0.14 : -0.14), qy, frontZ - 0.02],
        s: [wide ? 0.36 : 0.22, 0.28, 0.10],
        c: 0x823e32,
      });
    }
  }

  // Ground-floor Hardware/Book shopfront (dark green wooden frames + display windows + striped canvas awning)
  stat.push(
    { p: [x, 1.72, frontZ - 0.03], s: [12.4, 2.84, 0.08], c: 0x234230 },
    { p: [x, 0.55, frontZ - 0.07], s: [12.2, 0.90, 0.08], c: 0x1d3627 }, // kickboards
    { p: [x, 1.45, frontZ - 0.08], s: [1.6, 2.5, 0.10], c: 0x3a2416 },    // central shop door
  );
  for (const wx of [x - 3.6, x + 3.6]) {
    stat.push(
      { p: [wx, 2.0, frontZ - 0.08], s: [3.6, 1.65, 0.06], c: 0x1e3829 },
      // Display interior backing + shelves
      { p: [wx, 1.85, frontZ - 0.05], s: [3.3, 1.4, 0.04], c: 0x28241e },
    );
    (hutong ? stat : glow).push({
      p: [wx, 2.02, frontZ - 0.09],
      s: [3.2, 1.35, 0.03],
      c: hutong ? 0x1a1e24 : 0xe8c780,
      noAO: !hutong,
    });
  }
  // Striped red-and-cream canvas awning over shopfront + front valance edge
  stat.push({
    p: [x, 2.95, frontZ - 0.55],
    s: [1.1, 0.50, 11.8],
    c: 0x943528,
    wedge: true,
    ry: Math.PI / 2,
  });
  for (let sx = x - 5.2; sx <= x + 5.3; sx += 1.3) {
    stat.push({
      p: [sx, 2.96, frontZ - 0.56],
      s: [1.12, 0.52, 0.48],
      c: 0xe2dac4,
      wedge: true,
      ry: Math.PI / 2,
    });
  }
  stat.push({ p: [x, 2.66, frontZ - 1.11], s: [11.8, 0.14, 0.04], c: 0x862f24 });

  // Upstairs mullioned windows & 2 balconies
  for (const wx of [-35.0, -32.5, -30.0, -27.5, -25.0]) {
    addWindow(stat, glow, wx, 5.5, frontZ, 1.15, 1.55, !hutong && r() < 0.48, -1, r() < 0.7);
  }
  addBalcony(stat, -33.5, 5.4, frontZ, 2.8, r, hutong);
  addBalcony(stat, -26.5, 5.4, frontZ, 2.8, r, hutong);
}

/** 2. Recessed State-Run Non-Staple Food Store (國營副食店, x = -15, z = 4.2, w = 12, h = 9.5) + alcove at z = 0..2.2. */
function buildFoodStoreBlock(stat: Part[], glow: Part[], r: () => number, hutong: boolean) {
  const x = -15, z = 4.2, w = 12, h = 9.5, d = 4.0;
  const frontZ = z - d / 2; // 2.2 (keeps phoneBooth at [-15, 1.6] clear!)
  stat.push(
    { p: [x, 0.25, z], s: [w + 0.14, 0.50, d + 0.14], c: 0x5c5850, tex: 'ashlarStone' },
    { p: [x, h / 2, z], s: [w, h, d], c: C.plaster, tex: 'plaster' },
    // Flanking brick wing walls framing the recessed alcove (z = 0.5..2.2)
    { p: [x - w / 2 - 0.2, 2.2, 1.35], s: [0.5, 4.4, 1.8], c: C.greyBrick, tex: 'qingBrick' },
    { p: [x + w / 2 + 0.2, 2.2, 1.35], s: [0.5, 4.4, 1.8], c: C.greyBrick, tex: 'qingBrick' },
    // Belt courses & roof parapet
    { p: [x, 3.65, frontZ - 0.06], s: [w + 0.3, 0.22, 0.20], c: 0x706c64, tex: 'ashlarStone' },
    { p: [x, 6.70, frontZ - 0.06], s: [w + 0.2, 0.14, 0.14], c: 0x68645c, tex: 'plaster' },
    { p: [x, h + 0.2, z], s: [w + 0.35, 0.42, d + 0.35], c: 0x45474a, tex: 'qingBrick' },
  );

  // Dark-green timber ground-floor shopfront
  stat.push(
    { p: [x, 1.75, frontZ - 0.03], s: [11.4, 3.3, 0.08], c: 0x223e2c },
    // Glass display counter bay (x = -19.8 .. -14.2) with wooden counter & pickle jars / soy-sauce bottles
    { p: [x - 2.3, 0.55, frontZ - 0.08], s: [5.4, 0.95, 0.12], c: 0x1c3324 },
    { p: [x - 2.3, 1.15, frontZ - 0.18], s: [5.2, 0.10, 0.36], c: C.wood }, // display counter shelf
  );
  // Rows of glass pickle jars & dark soy-sauce bottles inside the display window
  for (let j = 0; j < 6; j++) {
    const jx = x - 4.3 + j * 0.72;
    stat.push(
      { p: [jx, 1.38, frontZ - 0.14], s: [0.22, 0.32, 0.22], c: j % 2 === 0 ? 0x8ea062 : 0x6b3a1e, cyl: true, seg: 7 },
      { p: [jx, 1.56, frontZ - 0.14], s: [0.16, 0.06, 0.16], c: 0xa42e22, cyl: true, seg: 7 },
      { p: [jx + 0.34, 1.36, frontZ - 0.20], s: [0.10, 0.28, 0.10], c: 0x3b2012, cyl: true, seg: 6, top: 0.6 },
    );
  }
  (hutong ? stat : glow).push({
    p: [x - 2.3, 2.05, frontZ - 0.06],
    s: [5.1, 1.45, 0.03],
    c: hutong ? 0x1b2025 : 0xffe4a0,
    noAO: !hutong,
  });

  // Open doorway (x = -12.0) with hanging plastic strip curtain (塑膠門簾)
  stat.push({ p: [x + 3.0, 1.45, frontZ - 0.05], s: [1.8, 2.6, 0.08], c: 0x16181c });
  for (let sIdx = 0; sIdx < 6; sIdx++) {
    stat.push({
      p: [x + 2.25 + sIdx * 0.30, 1.55, frontZ - 0.12],
      s: [0.24, 2.2, 0.02],
      c: sIdx % 2 === 0 ? 0x9ab5c2 : 0x89a6b5,
    });
  }
  if (!hutong) {
    glow.push({ p: [x + 3.0, 2.55, frontZ - 0.08], s: [1.5, 0.18, 0.06], c: 0xfff0c8, noAO: true });
  }

  // Stacked wooden Arctic Ocean soda crates (北冰洋汽水木箱) beside the entrance
  for (let row = 0; row < 2; row++) {
    const cx = x + 4.45, cz = frontZ - 0.42;
    stat.push({ p: [cx, 0.20 + row * 0.34, cz], s: [0.68, 0.32, 0.48], c: 0x7d5e38 });
    for (let b = -1; b <= 1; b++) {
      stat.push({ p: [cx + b * 0.18, 0.40 + row * 0.34, cz], s: [0.08, 0.12, 0.08], c: 0xd87422, cyl: true, seg: 6 });
    }
  }

  // Recessed alcove amenities (clear of phoneBooth at [-15, 1.6] and c4phone at [-15, 1])
  // West stone bench at [-18.8, 1.3]
  stat.push(
    { p: [-18.8, 0.42, 1.3], s: [1.6, 0.10, 0.48], c: 0x868278, bevel: true },
    { p: [-19.4, 0.20, 1.3], s: [0.16, 0.40, 0.40], c: 0x6a675f },
    { p: [-18.2, 0.20, 1.3], s: [0.16, 0.40, 0.40], c: 0x6a675f },
  );
  // East neighborhood chalkboard / public notice board at [-10.0, 1.5]
  stat.push(
    { p: [-10.0, 1.35, 1.85], s: [1.5, 1.2, 0.10], c: 0x222624 },
    { p: [-10.0, 1.98, 1.85], s: [1.65, 0.16, 0.18], c: 0x7a2a20 },
    { p: [-10.65, 0.9, 1.85], s: [0.10, 1.8, 0.10], c: C.wood },
    { p: [-9.35, 0.9, 1.85], s: [0.10, 1.8, 0.10], c: C.wood },
  );

  // Upper 2 apartment floors (Floors 2 & 3) + AC / kitchen exhaust vents + balconies
  for (const fy of [5.25, 8.05]) {
    for (const wx of [-19.2, -16.4, -13.6, -10.8]) {
      addWindow(stat, glow, wx, fy, frontZ, 1.15, 1.45, !hutong && r() < 0.42, -1, r() < 0.72);
    }
    // Slatted wall AC/exhaust vents beside kitchens
    stat.push({ p: [x + 5.15, fy - 0.15, frontZ - 0.05], s: [0.46, 0.38, 0.08], c: 0x454a4e });
  }
  addBalcony(stat, -17.8, 5.2, frontZ, 2.8, r, hutong);
  addBalcony(stat, -12.2, 8.0, frontZ, 2.8, r, hutong);
  // Galvanized kitchen exhaust duct running up west flank
  stat.push({ p: [x - 5.3, 5.6, frontZ - 0.18], s: [0.32, 6.2, 0.28], c: 0x6e7378 });
}

/** 3. Red Star Restaurant (x = -1, w = 12) & State Barber Shop (x = 8.0, w = 5.4), stopping at x = 10.7. */
function buildRestaurantAndBarber(stat: Part[], glow: Part[], r: () => number, hutong: boolean) {
  // --- Red Star Restaurant (x: -7.0 .. +5.0, front at z = 0.4) ---
  const rx = -1, rz = 2.6, rw = 12, rh = 7.2, rd = 4.4;
  const rFront = rz - rd / 2; // 0.4
  stat.push(
    { p: [rx, 0.25, rz], s: [rw + 0.12, 0.50, rd + 0.12], c: 0x57544d, tex: 'ashlarStone' },
    { p: [rx, rh / 2, rz], s: [rw, rh, rd], c: C.greyBrick, tex: 'qingBrick' },
    // Stepped brick rooftop parapet (女兒牆)
    { p: [rx, rh + 0.28, rz], s: [rw + 0.25, 0.56, rd + 0.25], c: 0x4c4e52, tex: 'qingBrick' },
    { p: [rx, rh + 0.65, rFront], s: [4.2, 0.32, 0.28], c: 0x5c5e62, tex: 'qingBrick' },
    // Traditional glazed green-tile eave canopy over ground floor (y = 3.25)
    { p: [rx, 3.25, rFront - 0.48], s: [0.95, 0.48, rw + 0.3], c: 0x2b5e42, wedge: true, ry: Math.PI / 2, tex: 'roofTile' },
    { p: [rx, 3.00, rFront - 0.45], s: [rw + 0.2, 0.10, 0.85], c: 0x4a2a1a },
  );
  // Wooden rafters under restaurant canopy
  for (let kx = rx - 5.4; kx <= rx + 5.5; kx += 0.9) {
    stat.push({ p: [kx, 2.94, rFront - 0.45], s: [0.06, 0.08, 0.88], c: 0x3b2214 });
  }
  // Two glowing red lanterns (紅燈籠) under the canopy
  for (const lx of [rx - 3.8, rx + 2.0]) {
    stat.push(
      { p: [lx, 2.86, rFront - 0.65], s: [0.02, 0.26, 0.02], c: 0x1a1a1a },
      { p: [lx, 2.72, rFront - 0.65], s: [0.16, 0.05, 0.16], c: 0x1f1a16, cyl: true, seg: 8 },
      { p: [lx, 2.38, rFront - 0.65], s: [0.14, 0.04, 0.14], c: C.brass, cyl: true, seg: 8 },
    );
    (hutong ? stat : glow).push({
      p: [lx, 2.55, rFront - 0.65],
      s: [0.34, 0.38, 0.34],
      c: hutong ? 0x621e16 : 0xe83824,
      sphere: true,
      detail: 1,
      noAO: !hutong,
    });
  }
  // Ground-floor mahogany lattice windows & counter with stacked bamboo steamer baskets (籠屜)
  stat.push({ p: [rx, 1.5, rFront - 0.03], s: [11.2, 2.8, 0.08], c: 0x452218 });
  for (const wx of [rx - 3.6, rx + 0.2, rx + 3.6]) {
    if (hutong) {
      // Closed wooden night shutters
      stat.push({ p: [wx, 1.65, rFront - 0.07], s: [2.4, 1.75, 0.08], c: 0x3a2618 });
    } else {
      glow.push({ p: [wx, 1.75, rFront - 0.06], s: [2.2, 1.45, 0.04], c: 0xf4c46a, noAO: true });
      // Lattice muntins over the glowing glass
      for (const mx of [-0.7, 0, 0.7]) {
        stat.push({ p: [wx + mx, 1.75, rFront - 0.09], s: [0.05, 1.50, 0.03], c: 0x3f2014 });
      }
      stat.push({ p: [wx, 1.75, rFront - 0.09], s: [2.25, 0.05, 0.03], c: 0x3f2014 });
    }
  }
  // Breakfast/steamer counter outside at x = -2.2, z = 0.02
  stat.push({ p: [-2.2, 0.55, rFront - 0.32], s: [1.8, 0.90, 0.54], c: C.wood });
  for (let st = 0; st < 2; st++) {
    const sx = -2.6 + st * 0.62;
    const tiers = st === 0 ? 4 : 3;
    for (let t = 0; t < tiers; t++) {
      stat.push(
        { p: [sx, 1.08 + t * 0.15, rFront - 0.30], s: [0.44, 0.13, 0.44], c: 0xb99864, cyl: true, seg: 10 },
        { p: [sx, 1.14 + t * 0.15, rFront - 0.30], s: [0.46, 0.03, 0.46], c: 0x6b4e2b, cyl: true, seg: 10 },
      );
    }
  }
  // Upstairs restaurant windows
  for (const wx of [-5.0, -2.4, 0.2, 3.0]) {
    addWindow(stat, glow, wx, 5.5, rFront, 1.1, 1.4, !hutong && r() < 0.45, -1, true);
  }

  // --- State Barber Shop (國營理髮, x: 5.3 .. 10.7, stopping cleanly before Hutong wall at 11.4!) ---
  const bx = 8.0, bz = 2.6, bw = 5.4, bh = 6.4, bd = 4.4;
  const bFront = bz - bd / 2; // 0.4
  stat.push(
    { p: [bx, 0.25, bz], s: [bw + 0.1, 0.50, bd + 0.1], c: 0x57544d, tex: 'ashlarStone' },
    { p: [bx, bh / 2, bz], s: [bw, bh, bd], c: 0x7b786e, tex: 'plaster' },
    { p: [bx, bh + 0.15, bz], s: [bw + 0.24, 0.30, bd + 0.24], c: 0x45484c, tex: 'ashlarStone' },
    // White & mint-green ceramic tile dado wainscot
    { p: [bx, 0.62, bFront - 0.03], s: [bw - 0.2, 1.05, 0.06], c: 0xd8d5ca },
    { p: [bx, 1.08, bFront - 0.04], s: [bw - 0.2, 0.14, 0.07], c: 0x3b6e56 },
    // Plate-glass shop window + side doorway
    { p: [bx - 0.65, 2.05, bFront - 0.04], s: [2.9, 1.7, 0.06], c: 0x2d483a },
    { p: [bx + 1.55, 1.45, bFront - 0.05], s: [1.1, 2.6, 0.08], c: 0x344a3e },
    { p: [bx + bw / 2 - 0.15, bh * 0.5, bFront - 0.06], s: [0.08, bh - 0.2, 0.08], c: 0x3c4044, cyl: true, seg: 6 },
  );
  (hutong ? stat : glow).push({
    p: [bx - 0.65, 2.05, bFront - 0.06],
    s: [2.65, 1.45, 0.03],
    c: hutong ? 0x1b2025 : 0xeef2e2,
    noAO: !hutong,
  });
  // Rotating red-white-blue cylindrical barber pole mounted on left pilaster
  const poleX = 5.62, poleZ = bFront - 0.22;
  stat.push(
    { p: [poleX, 1.38, poleZ], s: [0.16, 0.10, 0.16], c: C.chrome, cyl: true, seg: 10 },
    { p: [poleX, 2.26, poleZ], s: [0.16, 0.10, 0.16], c: C.chrome, cyl: true, seg: 10 },
  );
  (hutong ? stat : glow).push(
    { p: [poleX, 1.82, poleZ], s: [0.14, 0.78, 0.14], c: hutong ? 0x9c998e : 0xf4f2e8, cyl: true, seg: 10, noAO: !hutong },
    { p: [poleX, 2.36, poleZ], s: [0.15, 0.15, 0.15], c: hutong ? 0x8e8b82 : 0xffe8b0, sphere: true, detail: 0, noAO: !hutong },
  );
  // Spiral-look red & blue barber bands
  for (let i = 0; i < 4; i++) {
    stat.push({
      p: [poleX, 1.54 + i * 0.19, poleZ],
      s: [0.152, 0.07, 0.152],
      c: i % 2 === 0 ? 0xc22a22 : 0x22529c,
      cyl: true,
      seg: 10,
      rz: 0.22,
    });
  }
  for (const wx of [6.8, 9.2]) {
    addWindow(stat, glow, wx, 4.9, bFront, 1.05, 1.35, !hutong && r() < 0.4, -1, true);
  }
}

/** 4. East Department Store & Residential Block (x = 26, z = 2.7, w = 15, h = 8.6) + Bicycle Repair Stall (修車攤). */
function buildEastDeptStore(stat: Part[], glow: Part[], r: () => number, hutong: boolean) {
  const x = 26, z = 2.7, w = 15, h = 8.6, d = 4.4;
  const frontZ = z - d / 2; // 0.5
  stat.push(
    { p: [x, 0.28, z], s: [w + 0.14, 0.56, d + 0.14], c: 0x595852, tex: 'ashlarStone' },
    { p: [x, h / 2, z], s: [w, h, d], c: 0x767066, tex: 'plaster' },
    // Decorative stepped concrete frieze at roofline
    { p: [x, h + 0.15, z], s: [w + 0.35, 0.32, d + 0.35], c: 0x5c5a54, tex: 'ashlarStone' },
    { p: [x, h - 0.35, frontZ - 0.08], s: [w + 0.16, 0.24, 0.16], c: 0x8a8478, tex: 'ashlarStone' },
    { p: [x, 3.65, frontZ - 0.06], s: [w + 0.2, 0.20, 0.16], c: 0x6a675f, tex: 'ashlarStone' },
  );
  // Vertical pilasters dividing 3 structural bays + exterior downspouts
  for (const px of [x - 7.3, x - 2.4, x + 2.4, x + 7.3]) {
    stat.push({ p: [px, h / 2, frontZ - 0.06], s: [0.36, h, 0.14], c: 0x66635c, tex: 'plaster' });
  }
  for (const dx of [x - 7.0, x + 7.0]) {
    stat.push({ p: [dx, h * 0.5, frontZ - 0.10], s: [0.09, h - 0.2, 0.09], c: 0x3a3e42, cyl: true, seg: 6 });
  }
  // Ground-floor shop display windows + entrance
  stat.push({ p: [x, 1.65, frontZ - 0.03], s: [13.8, 2.9, 0.08], c: 0x5e2820 });
  for (const wx of [x - 4.8, x + 4.8]) {
    (hutong ? stat : glow).push({
      p: [wx, 1.85, frontZ - 0.06],
      s: [3.6, 1.65, 0.03],
      c: hutong ? 0x1a1e24 : 0xf4dca0,
      noAO: !hutong,
    });
  }
  stat.push({ p: [x, 1.45, frontZ - 0.06], s: [2.2, 2.7, 0.08], c: 0x262018 });
  // Upstairs windows with concrete awnings + 2 laundry balconies
  for (const fy of [5.0, 7.3]) {
    for (const wx of [20.5, 23.8, 26.0, 28.2, 31.5]) {
      addWindow(stat, glow, wx, fy, frontZ, 1.1, 1.3, !hutong && r() < 0.38, -1, r() < 0.7);
      stat.push({ p: [wx, fy + 0.80, frontZ - 0.22], s: [1.35, 0.08, 0.42], c: 0x6b6860 });
    }
  }
  addBalcony(stat, 22.0, 5.0, frontZ, 2.6, r, hutong);
  addBalcony(stat, 30.0, 7.3, frontZ, 2.6, r, hutong);

  // Ground-floor Bicycle Repair Stall (修車攤) at x = 20.4, z = -0.35 (clear of hutong & parked bikes)
  const rx = 20.4, rz = -0.35;
  stat.push(
    // Wooden repair workbench / tool box
    { p: [rx, 0.48, rz], s: [1.1, 0.08, 0.56], c: C.wood },
    { p: [rx - 0.46, 0.24, rz - 0.22], s: [0.06, 0.48, 0.06], c: C.darkWood },
    { p: [rx + 0.46, 0.24, rz - 0.22], s: [0.06, 0.48, 0.06], c: C.darkWood },
    { p: [rx - 0.46, 0.24, rz + 0.22], s: [0.06, 0.48, 0.06], c: C.darkWood },
    { p: [rx + 0.46, 0.24, rz + 0.22], s: [0.06, 0.48, 0.06], c: C.darkWood },
    { p: [rx - 0.22, 0.62, rz], s: [0.42, 0.20, 0.28], c: 0x4c3622 }, // open tool box
    // Hanging spare rubber tires (torus) on shopfront wall hook
    { p: [rx - 0.9, 1.65, frontZ - 0.18], s: [0.64, 0.64, 0.64], c: 0x1a1a1a, torus: true, tube: 0.06, seg: 14, detail: 6, ry: 0.1 },
    { p: [rx - 0.85, 1.62, frontZ - 0.26], s: [0.62, 0.62, 0.62], c: 0x222222, torus: true, tube: 0.055, seg: 14, detail: 6, ry: -0.1 },
    // Standing air pump (打氣筒)
    { p: [rx + 0.78, 0.04, rz], s: [0.22, 0.05, 0.12], c: 0x2a2c2e },
    { p: [rx + 0.78, 0.34, rz], s: [0.05, 0.58, 0.05], c: 0x3b483c, cyl: true, seg: 8 },
    { p: [rx + 0.78, 0.65, rz], s: [0.24, 0.04, 0.04], c: C.wood, cyl: true, rz: Math.PI / 2, seg: 6 },
    // Enamel water basin (補胎水盆) for checking inner-tube leaks
    { p: [rx + 0.25, 0.59, rz + 0.02], s: [0.38, 0.14, 0.38], c: C.enamel, cyl: true, seg: 10, top: 1.25 },
    { p: [rx + 0.25, 0.66, rz + 0.02], s: [0.46, 0.02, 0.46], c: 0x26446e, cyl: true, seg: 10 },
  );
}

/** 5. Ultra-Detailed Hutong Alleyway & Siheyuan Gatehouse (x = 11.4..17.6, z = 0..11). */
function buildHutongAlley(stat: Part[], glow: Part[], hutong: boolean) {
  // Flanking grey-brick courtyard walls (x = 11.4 and x = 17.6, z = 0.2..11.0)
  for (const wx of [11.4, 17.6]) {
    stat.push(
      { p: [wx, 0.28, 5.6], s: [0.58, 0.56, 11.0], c: 0x424447, tex: 'ashlarStone' }, // stone base plinth
      { p: [wx, 1.65, 5.6], s: [0.48, 2.80, 11.0], c: C.greyBrick, tex: 'qingBrick' },
      // Sloped grey-tile wall coping (瓦頂)
      { p: [wx, 3.22, 5.6], s: [0.76, 0.32, 11.1], c: 0x3f4246, prism: true, tex: 'roofTile' },
      { p: [wx, 3.39, 5.6], s: [0.16, 0.08, 11.1], c: 0x2e3134 },
      // Brick-carved alley entrance Chitouw pier (墀頭) at street mouth + granite corner guard post
      { p: [wx, 0.25, 0.12], s: [0.68, 0.50, 0.62], c: 0x6d6a62, tex: 'ashlarStone' },
      { p: [wx, 1.72, 0.14], s: [0.64, 2.95, 0.58], c: 0x52555a, tex: 'qingBrick' },
      { p: [wx, 3.22, 0.14], s: [0.78, 0.18, 0.72], c: 0x66696e, tex: 'qingBrick' },
      { p: [wx, 3.42, 0.14], s: [0.88, 0.22, 0.80], c: 0x3c3f43, roof: true, tex: 'roofTile' },
    );
    // Stepped brick pilasters & weathered lime-plaster spall panels along alley walls
    for (const pz of [0.5, 3.1, 5.7, 8.3]) {
      stat.push(
        { p: [wx, 1.6, pz], s: [0.62, 3.1, 0.38], c: 0x4b4e52, tex: 'qingBrick' },
        { p: [wx, 3.25, pz], s: [0.78, 0.16, 0.48], c: 0x3b3e42 },
      );
    }
    const innerX = wx < 14 ? wx + 0.25 : wx - 0.25;
    for (const wz of [1.8, 4.4, 7.0]) {
      stat.push({ p: [innerX, 1.55, wz], s: [0.03, 1.45, 1.85], c: 0x6f6e68, tex: 'plaster' });
    }
  }
  // Pasted neighborhood notices & metal electric meter box on west wall
  stat.push(
    { p: [11.66, 1.55, 2.1], s: [0.03, 0.52, 0.38], c: 0xe6dec8 },
    { p: [11.66, 1.48, 2.65], s: [0.03, 0.42, 0.30], c: 0xd4a45a },
    { p: [11.68, 1.85, 3.8], s: [0.14, 0.44, 0.32], c: 0x454a4e },
    { p: [11.66, 3.1, 3.8], s: [0.04, 2.4, 0.04], c: 0x2d3033 }, // conduit pipe
    // Alley overhead wire + ceramic wall insulators
    { p: [14.5, 4.35, 4.2], s: [6.2, 0.025, 0.025], c: 0x1e1e1e },
    { p: [11.65, 4.35, 4.2], s: [0.14, 0.08, 0.08], c: 0xd8d6ce },
    { p: [17.35, 4.35, 4.2], s: [0.14, 0.08, 0.08], c: 0xd8d6ce },
  );

  // Wing walls connecting alley to the Siheyuan gatehouse at z = 9.0
  stat.push(
    { p: [12.3, 1.75, 9.0], s: [1.8, 3.5, 0.6], c: C.greyBrick, tex: 'qingBrick' },
    { p: [16.7, 1.75, 9.0], s: [1.8, 3.5, 0.6], c: C.greyBrick, tex: 'qingBrick' },
    // Granite threshold steps
    { p: [14.5, 0.10, 8.35], s: [3.4, 0.20, 0.65], c: 0x7a766d, tex: 'ashlarStone' },
    { p: [14.5, 0.22, 8.70], s: [2.8, 0.24, 0.50], c: 0x868278, tex: 'ashlarStone' },
  );

  // Carved stone drum door-pillows (抱鼓石門墩) at [13.3, 8.65] and [15.7, 8.65]
  for (const dx of [13.3, 15.7]) {
    stat.push(
      { p: [dx, 0.24, 8.65], s: [0.38, 0.32, 0.62], c: 0x726f67, bevel: true },
      { p: [dx, 0.52, 8.62], s: [0.24, 0.46, 0.46], c: 0x8a877d, cyl: true, rz: Math.PI / 2, seg: 12 },
      { p: [dx, 0.48, 8.85], s: [0.24, 0.34, 0.24], c: 0x7c7970 },
    );
  }

  // Timber gate frame, red double doors, brass knockers, spring-festival couplets & brick architrave
  stat.push(
    { p: [13.25, 1.65, 8.95], s: [0.22, 2.8, 0.30], c: 0x3b2016 }, // left jamb
    { p: [15.75, 1.65, 8.95], s: [0.22, 2.8, 0.30], c: 0x3b2016 }, // right jamb
    { p: [14.5, 2.95, 8.95], s: [2.8, 0.26, 0.32], c: 0x3b2016 },  // lintel
    { p: [14.5, 0.38, 8.95], s: [2.5, 0.18, 0.24], c: 0x45261a },  // wooden threshold beam
    // Pair of crimson wooden doors
    { p: [13.94, 1.62, 9.02], s: [1.10, 2.44, 0.12], c: 0x8e241b },
    { p: [15.06, 1.62, 9.02], s: [1.10, 2.44, 0.12], c: 0x8e241b },
    // Brass knockers (鋪首銜環)
    { p: [14.28, 1.48, 8.94], s: [0.16, 0.16, 0.04], c: C.brass, cyl: true, rx: Math.PI / 2, seg: 8 },
    { p: [14.28, 1.40, 8.92], s: [0.14, 0.14, 0.14], c: C.brass, torus: true, tube: 0.12, seg: 12, detail: 5 },
    { p: [14.72, 1.48, 8.94], s: [0.16, 0.16, 0.04], c: C.brass, cyl: true, rx: Math.PI / 2, seg: 8 },
    { p: [14.72, 1.40, 8.92], s: [0.14, 0.14, 0.14], c: C.brass, torus: true, tube: 0.12, seg: 12, detail: 5 },
    // Faded red spring-festival couplets (春聯) + horizontal lintel + 4 carved door bosses (門簪)
    { p: [13.10, 1.65, 8.79], s: [0.14, 1.55, 0.02], c: 0xa62a20 },
    { p: [15.90, 1.65, 8.79], s: [0.14, 1.55, 0.02], c: 0xa62a20 },
    { p: [14.5, 3.04, 8.77], s: [1.15, 0.18, 0.02], c: 0xa62a20 },
    // Blue enamel house number plaque '24'
    { p: [15.90, 2.48, 8.78], s: [0.22, 0.16, 0.02], c: 0x204a88 },
  );
  for (const bx of [13.65, 14.22, 14.78, 15.35]) {
    stat.push({ p: [bx, 2.86, 8.76], s: [0.12, 0.12, 0.14], c: 0x7e221a });
  }
  // Carved grey-brick architrave (磚雕門楣) & curved grey-tile Siheyuan gatehouse roof (廣亮門樓)
  stat.push(
    { p: [14.5, 3.22, 8.95], s: [3.9, 0.24, 1.35], c: 0x5c5e62, tex: 'qingBrick' },
    { p: [14.5, 3.38, 8.95], s: [4.2, 0.16, 1.55], c: 0x4b4e52, tex: 'qingBrick' },
    { p: [14.5, 3.98, 9.0], s: [4.8, 1.30, 2.5], c: C.slate, eave: true, curve: 0.18, tex: 'roofTile' },
    { p: [14.5, 4.66, 9.0], s: [2.4, 0.18, 0.22], c: 0x33363a },
    { p: [13.32, 4.80, 9.0], s: [0.20, 0.28, 0.22], c: 0x33363a },
    { p: [15.68, 4.80, 9.0], s: [0.20, 0.28, 0.22], c: 0x33363a },
  );
  // Courtyard bulb with enamel shade under gatehouse eave
  stat.push({ p: [14.5, 2.74, 8.58], s: [0.30, 0.12, 0.30], c: 0x26382c, cyl: true, seg: 8, top: 0.25 });
  glow.push({ p: [14.5, 2.66, 8.58], s: [0.16, 0.18, 0.16], c: 0xffd27a, sphere: true, detail: 1, noAO: true });

  // Living Hutong props
  stat.push(...place(coalAndCabbage(), 12.2, 5.8, Math.PI / 2));
  if (hutong) {
    stat.push(...place(tableBasin(), 12.8, 4.6, Math.PI / 2));
    stat.push(...place(bike(), 16.8, 3.2, -Math.PI / 2));
  }
}

/** 6. South-Side Silhouette Buildings (z = -22..-26) so turning south shows an authentic 1980s Beijing streetscape. */
function buildSouthSilhouettes(stat: Part[], glow: Part[], r: () => number, dark: boolean) {
  const blocks: [number, number, number, number, number, number, 'qingBrick' | 'plaster' | 'redBrick'][] = [
    [-34, -23.8, 16, 10.6, 5.0, C.greyBrick, 'qingBrick'],
    [-14, -23.2, 15, 6.8, 4.4, C.plaster, 'plaster'],
    [8, -23.6, 18, 9.5, 4.8, C.brick, 'redBrick'],
    [32, -23.2, 18, 6.2, 4.4, C.greyBrick, 'qingBrick'],
  ];
  for (const [bx, bz, bw, bh, bd, col, tex] of blocks) {
    const frontZ = bz + bd / 2; // faces +z north toward avenue
    stat.push(
      { p: [bx, 0.24, bz], s: [bw + 0.12, 0.48, bd + 0.12], c: 0x55524c, tex: 'ashlarStone' },
      { p: [bx, bh / 2, bz], s: [bw, bh, bd], c: col, tex },
      { p: [bx, bh + 0.14, bz], s: [bw + 0.3, 0.28, bd + 0.3], c: 0x3b3d40, tex: 'ashlarStone' },
      { p: [bx, bh + 0.9, bz], s: [bd + 0.3, 1.3, bw + 0.2], c: 0x333538, prism: true, ry: Math.PI / 2, tex: 'roofTile' },
    );
    const floors = Math.floor(bh / 3);
    const cols = Math.floor(bw / 2.6);
    for (let f = 0; f < floors; f++) {
      if (f > 0) {
        stat.push({ p: [bx, f * 3.0 + 0.1, frontZ + 0.05], s: [bw + 0.14, 0.14, 0.12], c: 0x625f58 });
      }
      for (let i = 0; i < cols; i++) {
        const wx = bx - bw / 2 + 1.4 + i * 2.6;
        const wy = 1.6 + f * 3.0;
        const lit = (!dark && r() < 0.38) || (dark && r() < 0.08);
        stat.push(
          { p: [wx, wy - 0.68, frontZ + 0.06], s: [1.22, 0.10, 0.14], c: 0x68645c },
          { p: [wx, wy + 0.68, frontZ + 0.05], s: [1.18, 0.11, 0.12], c: 0x5a5750 },
        );
        (lit ? glow : stat).push({
          p: [wx, wy, frontZ + 0.03],
          s: [1.05, 1.25, 0.04],
          c: lit ? (r() < 0.72 ? C.window : 0xf0ecc8) : 0x1a1f26,
          noAO: lit,
        });
      }
    }
  }
}

/** 7. Detailed Green Newspaper Kiosk ([-6, -1.5]) & Bus Stop Shelter ([-18, -5]). */
function buildKioskAndBusStop(stat: Part[], glow: Part[], hutong: boolean) {
  const kx = -6, kz = -1.5;
  stat.push(
    { p: [kx, 0.06, kz], s: [2.8, 0.12, 2.0], c: 0x625f58 },           // plinth
    { p: [kx, 1.18, kz], s: [2.6, 2.18, 1.8], c: 0x2d4e3a },           // green steel/wood body
    { p: [kx, 0.56, kz - 0.92], s: [2.4, 0.86, 0.05], c: 0x1e3627 },    // lower front panel
    // Decorative roof fascia & overhanging pitched corrugated roof
    { p: [kx, 2.38, kz - 0.12], s: [2.95, 0.18, 2.35], c: 0x223b2c },
    { p: [kx, 2.70, kz - 0.08], s: [2.25, 0.52, 2.95], c: 0x25382c, prism: true, ry: Math.PI / 2 },
    // Counter sill ledge
    { p: [kx, 1.02, kz - 0.98], s: [2.35, 0.06, 0.24], c: C.wood },
  );
  // Corner trim posts
  for (const cx of [kx - 1.28, kx + 1.28]) {
    for (const cz of [kz - 0.88, kz + 0.88]) {
      stat.push({ p: [cx, 1.18, cz], s: [0.09, 2.22, 0.09], c: 0x1b3022 });
    }
  }

  if (hutong) {
    // Closed wooden plank shutters + radioStool beside kiosk
    for (let p = 0; p < 5; p++) {
      stat.push({ p: [kx - 0.84 + p * 0.42, 1.52, kz - 0.93], s: [0.39, 0.96, 0.06], c: 0x3b2c1d });
    }
    stat.push({ p: [kx, 1.52, kz - 0.97], s: [2.05, 0.06, 0.03], c: 0x222528 }); // iron bar latch
    const [rSol, rGlw] = radioStool();
    stat.push(...place(rSol, -6, -2.8));
    glow.push(...place(rGlw, -6, -2.8));
  } else {
    // Warm lit interior window with colorful newspaper & magazine stacks
    glow.push({ p: [kx, 1.54, kz - 0.92], s: [2.04, 0.92, 0.04], c: 0xf2d99b, noAO: true });
    for (const mx of [-0.55, 0.55]) {
      stat.push({ p: [kx + mx, 1.54, kz - 0.95], s: [0.04, 0.94, 0.03], c: 0x20382a });
    }
    // Stacked newspapers & magazines on the counter sill
    const stackCols = [0xe8e2d0, 0xb83428, 0x34629a, 0xd8b448];
    for (let i = 0; i < 4; i++) {
      stat.push({ p: [kx - 0.72 + i * 0.46, 1.09, kz - 1.00], s: [0.32, 0.08, 0.20], c: stackCols[i] });
    }
  }

  // Bus Stop Post ([-18, -5]) & waiting bench (clear of blockade spawn [-22, -5])
  stat.push(
    { p: [-18, 0.06, -4.95], s: [0.32, 0.12, 0.32], c: 0x6f6c64 },
    { p: [-18, 1.45, -4.95], s: [0.09, 2.8, 0.09], c: 0x707478, cyl: true, seg: 6 },
    { p: [-18, 2.38, -4.98], s: [0.56, 1.25, 0.05], c: 0x7d2a22 },
    // Small wooden waiting bench west of post
    { p: [-19.6, 0.44, -4.15], s: [1.45, 0.08, 0.46], c: C.wood },
    { p: [-20.15, 0.22, -4.15], s: [0.08, 0.44, 0.40], c: 0x3a3d40 },
    { p: [-19.05, 0.22, -4.15], s: [0.08, 0.44, 0.40], c: 0x3a3d40 },
  );
}

/** Distant low-poly Beijing ministry/apartment blocks, courtyard roofs, rooftop water tower & avenue-end silhouettes (~348 tris). */
function buildStreetHorizonSilhouettes(stat: Part[]) {
  // Ground extensions beyond x = ±60 so east/west avenue views never clip into empty sky below the horizon
  stat.push(
    { p: [-84, -0.09, -10], s: [48, 0.14, 72], c: 0x1e2024 },
    { p: [84, -0.09, -10], s: [48, 0.14, 72], c: 0x1e2024 },
  );

  // North distant skyline strip (z = +17..+34) behind shopfronts & Hutong alley
  stat.push(
    { p: [-56, 8.5, 25], s: [26, 17, 10], c: 0x26282e },
    { p: [-56, 18.5, 25], s: [12, 3, 6], c: 0x1f2126 },
    { p: [-26, 10, 28], s: [28, 20, 10], c: 0x2a292d },
    { p: [-26, 22.25, 28], s: [10, 4.5, 7], c: 0x222328 },
    { p: [-2, 7, 24], s: [22, 14, 8], c: 0x25282e },
    // Courtyard tiled roofline framing the Hutong alley vista behind the Siheyuan gatehouse (x = 14.5, z = 17.5)
    { p: [14.5, 3.1, 17.5], s: [12, 6.2, 6], c: 0x27292e, tex: 'qingBrick' },
    { p: [14.5, 7.1, 17.5], s: [6, 1.8, 12], c: 0x202226, prism: true, ry: Math.PI / 2, tex: 'roofTile' },
    { p: [20, 9, 32], s: [26, 18, 10], c: 0x24262c, tex: 'plaster' },
    { p: [48, 9.5, 26], s: [28, 19, 10], c: 0x27292f, tex: 'plaster' },
    // Classic 1980s Beijing rooftop water tower atop the east ministry slab (x = 42, y = 19..25)
    { p: [42, 20.4, 26], s: [1.6, 2.8, 1.6], c: 0x1d1f24 },
    { p: [42, 22.6, 26], s: [3.2, 2.6, 3.2], c: 0x2d3036, cyl: true, seg: 6 },
    { p: [42, 24.5, 26], s: [3.4, 1.2, 3.4], c: 0x222429, roof: true },
  );

  // South distant skyline strip (z = -44..-48) behind south residential blocks
  stat.push(
    { p: [-52, 8, -44], s: [24, 16, 10], c: 0x25272d },
    { p: [-22, 10.5, -48], s: [30, 21, 10], c: 0x23252b },
    { p: [-22, 22.6, -48], s: [12, 3.2, 7], c: 0x1d1f24 },
    { p: [12, 7, -44], s: [28, 14, 9], c: 0x28292e },
    { p: [12, 15.1, -44], s: [9, 2.2, 28], c: 0x202226, prism: true, ry: Math.PI / 2 },
    { p: [44, 9.5, -47], s: [28, 19, 10], c: 0x24262c },
    { p: [44, 21.5, -47], s: [2.4, 5.0, 2.4], c: 0x1d1f24 },
  );

  // Far East & Far West flank buildings and distant avenue-end blocks (clear of ±70 bus/marcher wrap)
  stat.push(
    { p: [-68, 5.5, 4], s: [22, 11, 7], c: 0x2c2e33 },
    { p: [-66, 4.8, -24], s: [22, 9.6, 7], c: 0x2b2d32 },
    { p: [67, 5.8, 4], s: [24, 11.6, 7], c: 0x2c2e33 },
    { p: [65, 5.0, -24], s: [22, 10, 7], c: 0x2b2d32 },
    { p: [-86, 9, -10], s: [10, 18, 38], c: 0x202228 },
    { p: [-86, 20.5, -14], s: [7, 5, 14], c: 0x1b1d22 },
    { p: [86, 9.5, -10], s: [10, 19, 38], c: 0x202228 },
    { p: [86, 21.5, -6], s: [7, 5, 14], c: 0x1b1d22 },
  );
}

/** Overhead trolleybus wires + span poles (spaced at 16m so poles stay clear of kiosk/bus stop). */
function wires(x0: number, x1: number, zs: number[], poleZa: number, poleZb: number, step: number): Part[] {
  const p: Part[] = [];
  for (const z of zs) {
    p.push({ p: [(x0 + x1) / 2, 5.9, z], s: [x1 - x0, 0.03, 0.03], c: 0x222222 });
  }
  for (let x = x0; x <= x1; x += step) {
    p.push(
      { p: [x, 3.1, poleZa], s: [0.20, 6.2, 0.20], c: 0x4a4a46, cyl: true, seg: 6 },
      { p: [x, 3.1, poleZb], s: [0.20, 6.2, 0.20], c: 0x4a4a46, cyl: true, seg: 6 },
      { p: [x, 6.0, (poleZa + poleZb) / 2], s: [0.03, 0.03, Math.abs(poleZa - poleZb)], c: 0x222222 },
    );
  }
  return p;
}

export function buildStreet(mode: StreetMode = 'night', marchVariant: MarchVariant = 'night422'): World {
  const march = mode === 'march';
  const blockade = mode === 'blockade';
  const hutong = mode === 'hutong';

  const s = createStreetBase(mode);
  const stat: Part[] = [];
  const glow: Part[] = [];
  const r = rng(1989);

  buildRoadAndSidewalks(s, stat, mode);

  // North-side 1980s Beijing shopfronts + far flank silhouette blocks
  buildWestHardwareBlock(stat, glow, r, hutong);
  buildFoodStoreBlock(stat, glow, r, hutong);
  buildRestaurantAndBarber(stat, glow, r, hutong);
  buildEastDeptStore(stat, glow, r, hutong);
  for (const [fx, fw, fh] of [[-46, 14, 6.5], [43, 16, 7.0]] as [number, number, number][]) {
    stat.push({ p: [fx, fh / 2, 2.7], s: [fw, fh, 4.4], c: C.greyBrick });
  }

  // Hutong alleyway & traditional Siheyuan gatehouse (x = 11.4..17.6, z = 0..11)
  buildHutongAlley(stat, glow, hutong);

  // South-side residential apartment blocks & courtyard roofs
  buildSouthSilhouettes(stat, glow, r, hutong);

  // Phone booth, detailed newspaper kiosk & bus stop
  stat.push(...place(phoneBooth(), -15, 1.6));
  buildKioskAndBusStop(stat, glow, hutong);

  // Distant road barricades in hutong mode (June 3 late night)
  if (hutong) {
    for (const bx of [-24, 24]) {
      stat.push(
        { p: [bx, 0.5, -10], s: [0.9, 1.0, 8.5], c: 0x4e4c48 },
        { p: [bx + (bx > 0 ? -1.1 : 1.1), 0.75, -8.5], s: [0.35, 1.5, 3.6], c: 0x4c7aa8, rz: 0.45 },
        { p: [bx + (bx > 0 ? -1.4 : 1.4), 0.65, -12.0], s: [0.35, 1.3, 3.2], c: 0x7a5634, rz: -0.35 },
      );
      glow.push({ p: [bx, 1.15, -10], s: [0.22, 0.22, 0.22], c: 0xff5a36, sphere: true, detail: 0, noAO: true });
    }
  }

  // Loudspeaker pole (大喇叭)
  const lpX = hutong ? 9.2 : 6;
  stat.push(
    { p: [lpX, 0.35, -2.4], s: [0.28, 0.70, 0.28], c: 0x5c5a54, cyl: true, seg: 8 },
    { p: [lpX, 3.2, -2.4], s: [0.18, 6.4, 0.18], c: 0x3d3d3d, cyl: true, seg: 8, top: 0.75 },
    { p: [lpX, 4.1, -2.26], s: [0.22, 0.32, 0.16], c: 0x4b4e50 }, // junction box
    { p: [lpX + 0.3, 6.0, -2.4], s: [0.55, 0.4, 0.4], c: 0x6b6f63, cyl: true, rz: 1.2, top: 0.35 },
    { p: [lpX - 0.3, 6.0, -2.4], s: [0.55, 0.4, 0.4], c: 0x6b6f63, cyl: true, rz: -1.2, top: 0.35 },
  );

  // Mode-specific foreground props & vehicles
  if (mode === 'night') {
    stat.push(...place(tricycle(), 4.2, -5.8, 0.1));
    stat.push(...place(ambulance(), -17.2, -6.2, 0.02));
    stat.push(...place(person(0x4b4a45, C.black, 0xbbbbbb), -6, -3.4, Math.PI / 2));
    stat.push(...place(person(0x3a4a5a), 1.4, -4.4, 2.6));
    stat.push(...place(bike(0x5b5f3c), -3.2, -7.3, Math.PI));
    stat.push(...place(person(0x7a6a50), -4, -6.4, -0.3), ...place(person(C.navy), -2.2, -6.6, 0.4));
  } else if (blockade) {
    stat.push(...place(tricycle(), 6, -5, -2.5));
    for (const [bx, bz, bry] of [[-11, -10.5, -0.45], [12, -11.2, 0.52]] as [number, number, number][]) {
      stat.push(...place(trolleybus(), bx, bz, bry));
      glow.push(...place(trolleyWindows(), bx, bz, bry));
    }
    // Makeshift wooden sawhorse barriers & citizen flashlight beams
    for (const [sx, sz, sry] of [[-19.5, -11.5, 0.4], [21.5, -11.5, -0.35]] as [number, number, number][]) {
      stat.push(
        { p: [sx, 0.65, sz], s: [2.2, 0.14, 0.12], c: 0x765536, ry: sry },
        { p: [sx, 0.35, sz], s: [0.10, 0.85, 0.10], c: 0x5c4228, rz: 0.4, ry: sry },
        { p: [sx, 0.35, sz], s: [0.10, 0.85, 0.10], c: 0x5c4228, rz: -0.4, ry: sry },
      );
    }
    for (const [fx, fz] of [[-7.5, -8.2], [-14.2, -12.4], [9.5, -8.6], [15.5, -12.8]] as [number, number][]) {
      glow.push({ p: [fx, 1.15, fz], s: [0.12, 0.12, 0.12], c: 0xffe49c, sphere: true, detail: 0, noAO: true });
    }
  }

  // Overhead trolley wires (poles at -56, -40, -24, -8, 8, 24, 40, 56 -> clear of kiosk & bus stop)
  stat.push(...wires(-56, 56, [-11.15, -11.85, -7.9, -8.6], -5.2, -14.8, 16));
  buildStreetHorizonSilhouettes(stat);

  addLayeredParts(s, stat);
  if (glow.length) s.add(new THREE.Mesh(mergeParts(glow), glowMat()));

  // Crisp period Chinese shop signs packed into 1 atlas texture + 1 merged draw call
  addStreetSignsAtlas(s);

  // Avenue poplars + Hutong courtyard scholar tree (set onto curb verges during march so trunks never clip marchers)
  addRealisticTrees(s, [{ x: hutong ? 16.9 : 16.1, z: hutong ? 5.1 : 4.7, ry: 0.4 }], false, false);
  const pops: { x: number; z: number; ry: number }[] = [];
  for (let x = -49; x <= 50; x += 7.5) {
    pops.push({ x: x + r() * 0.8, z: march ? -4.35 : -5.6, ry: r() * 6 });
    pops.push({ x: x + r() * 0.8 + 3.5, z: march ? -15.65 : -14.6, ry: r() * 6 });
  }
  const visiblePops = pops.filter(p =>
    Math.abs(p.x - lpX) > 1.6 &&
    Math.abs(p.x + 6) > 2.4 &&
    Math.abs(p.x + 18) > 2.0 &&
    Math.abs(p.x - 14.5) > 3.8 &&
    !(march && (Math.abs(p.x - 2) < 2.2 || Math.abs(p.x - 6) < 2.2 || Math.abs(p.x + 14) < 2.0)) &&
    !(hutong && p.x >= -12 && p.x <= 22),
  );
  addRealisticTrees(s, visiblePops, true, false);

  // Street lamps
  const lamps: { x: number; z: number; ry?: number }[] = [];
  for (let x = -50; x < 56; x += 14) {
    lamps.push({ x, z: -5.0 }, { x: x + 7, z: -15, ry: Math.PI });
  }
  s.add(instanced(mergeParts(lampPole()), litMat(), lamps));
  s.add(instanced(mergeParts(lampHead()), glowMat(), lamps));

  // Sodium & accent lights
  if (hutong) {
    addSodiumLight(s, 6, -2, 22, 22);
    addSodiumLight(s, 14, 4, 22, 20);
    addSodiumLight(s, 14.5, 8.2, 14, 16);
    const rl = new THREE.PointLight(0xffcf7a, 4, 7, 1.8);
    rl.position.set(-6, 0.9, -2.8);
    s.add(rl);
    for (const bx of [-24, 24]) {
      const bl = new THREE.PointLight(0xff7240, 8, 12, 1.6);
      bl.position.set(bx, 2.2, -10);
      s.add(bl);
    }
  } else {
    for (const x of [-14, 0, 14]) addSodiumLight(s, x + 0.9, -6, blockade ? 24 : 16, 20);
    addSodiumLight(s, 14.5, 6, 8, 16);
  }

  // Parked bicycles (clear of repair stall at x = 20.4 and hutong entrance)
  const parked: { x: number; z: number; ry: number }[] = [];
  if (march) {
    for (let i = 0; i < 2; i++) parked.push({ x: 22.5 + i * 0.75, z: -2.6, ry: Math.PI / 2 });
  } else if (!hutong) {
    for (let i = 0; i < 6; i++) parked.push({ x: -26.5 + i * 0.68, z: -2.6, ry: Math.PI / 2 });
    for (let i = 0; i < 4; i++) parked.push({ x: 22.5 + i * 0.68, z: -2.6, ry: Math.PI / 2 });
  } else {
    for (let i = 0; i < 4; i++) parked.push({ x: 22.5 + i * 0.7, z: -2.6, ry: Math.PI / 2 });
  }
  s.add(instanced(mergeParts(bike()), litMat(), parked));

  // Blockade citizens around trolleybuses (using crowdPerson for lean triangle count)
  if (blockade) {
    const bc: { x: number; z: number; ry: number }[] = [];
    for (let i = 0; i < 82; i++) {
      const side = i % 2 ? -10 : 12;
      const a = r() * Math.PI * 2;
      const d = 3.2 + r() * 5.2;
      const x = side + Math.cos(a) * d;
      const z = -10.8 + Math.sin(a) * (d * 0.75);
      if (Math.hypot(x + 22, z + 5) < 3.0) continue; // keep spawn clear
      if (Math.hypot(x + 4, z + 7) < 2.2 || Math.hypot(x - 8, z + 5) < 2.2) continue; // keep c4wang & c4auntie clear
      bc.push({ x, z: Math.max(-16.5, Math.min(-4.2, z)), ry: Math.atan2(-(side - x), -11 - z) });
    }
    const bcm = instanced(mergeParts(crowdPerson(0x454a54)), litMat(), bc);
    const bcol = [C.navy, C.khaki, 0x3a4a5a, 0x5d4c3a, 0x6a2f3a, 0x4e5a4a];
    bc.forEach((_, i) => bcm.setColorAt(i, new THREE.Color(bcol[i % 6]).multiplyScalar(2.0)));
    s.add(bcm);
  }

  // Dynamic traffic (only in regular night street mode; march carriageway is dedicated to the student procession)
  const o = new THREE.Object3D();
  const dynamic = !blockade && !hutong && !march;
  let riders: THREE.InstancedMesh | null = null;
  let walkers: THREE.InstancedMesh | null = null;
  const rs: Array<{ x: number; z: number; v: number }> = [];
  const ws: Array<{ x: number; z: number; v: number }> = [];
  const busMesh = new THREE.Group();
  if (dynamic) {
    const N = 10;
    riders = new THREE.InstancedMesh(mergeParts(bike(C.navy)), litMat(), N);
    for (let i = 0; i < N; i++) {
      rs.push({
        x: -55 + r() * 110,
        z: i % 2 ? (-14.2 + r() * 0.8) : (-8.9 + r() * 0.9),
        v: (i % 2 ? 1 : -1) * (3.2 + r() * 1.6),
      });
    }
    const W = 10;
    walkers = new THREE.InstancedMesh(mergeParts(crowdPerson(0x4a4e58)), litMat(), W);
    for (let i = 0; i < W; i++) {
      ws.push({
        x: -50 + r() * 100,
        z: -3.5 + r() * 0.6,
        v: (r() < 0.6 ? 1 : -1) * (1 + r() * 0.5),
      });
    }
    s.add(riders, walkers);
    busMesh.add(new THREE.Mesh(mergeParts(trolleybus()), litMat()), new THREE.Mesh(mergeParts(trolleyWindows()), glowMat()));
    busMesh.position.set(-40, 0, -11.5);
    s.add(busMesh);
  }

  // Dense zero-clipping 1989 march procession with authentic slogan banners, school flags, linked pickets & residents
  let marchHandle: MarchProcessionHandle | null = null;
  if (march) {
    const staticExclusions: ObstacleCircle[] = [
      { x: -15, z: 1.6, r: 1.4 },    // phoneBooth
      { x: -6, z: -1.5, r: 2.3 },    // newspaper kiosk
      { x: -18, z: -5.0, r: 1.4 },   // bus stop
      { x: -19.6, z: -4.15, r: 1.3 }, // waiting bench
      { x: lpX, z: -2.4, r: 1.2 },   // loudspeaker pole
      { x: 14.5, z: -1.0, r: 4.2 },  // hutong mouth
      { x: 14.5, z: -3.5, r: 3.4 },
      { x: 20.4, z: -0.35, r: 1.9 }, // repair stall
      { x: 22.9, z: -2.6, r: 1.6 },  // parked bikes
      // Curb/sidewalk hotspots across march (ch1, w1) and march_day (0427, 0504)
      { x: -30, z: -6, r: 1.8 },
      { x: -10, z: -8, r: 1.8 },
      { x: 6, z: -3.5, r: 1.8 },
      { x: 2, z: -4.5, r: 1.8 },
      { x: -20, z: -12, r: 1.8 },
      { x: -14, z: -5, r: 1.8 },
      { x: -16, z: -5, r: 1.8 },
      { x: -12, z: -5, r: 1.8 },
      { x: -6, z: -3.5, r: 1.8 },
      { x: 4, z: -4, r: 1.8 },
      { x: 2, z: -6, r: 1.8 },
      { x: 12, z: -6, r: 1.8 },
      { x: 28, z: -8, r: 1.8 },
      { x: 30, z: -10, r: 1.8 },
      { x: 30, z: -6, r: 1.8 },
    ];
    for (const t of visiblePops) staticExclusions.push({ x: t.x, z: t.z, r: 0.95 });
    for (const l of lamps) staticExclusions.push({ x: l.x, z: l.z, r: 0.75 });
    for (let px = -56; px <= 56; px += 16) {
      staticExclusions.push({ x: px, z: -5.2, r: 0.7 }, { x: px, z: -14.8, r: 0.7 });
    }
    marchHandle = attachStreetMarchProcession(s, marchVariant, staticExclusions);
    addSodiumLight(s, -28, -9, 22, 22);
    addSodiumLight(s, 28, -9, 22, 22);
    addSodiumLight(s, -14, -12, 18, 20);
    addSodiumLight(s, 14, -12, 18, 20);
  }

  const colliders: WorldCollider[] = [
    { kind: 'box', minX: -50, maxX: -20.8, minZ: -0.1, maxZ: 8 },
    { kind: 'box', minX: -21.2, maxX: -8.8, minZ: 1.7, maxZ: 8 },
    { kind: 'box', minX: -9.2, maxX: 11.4, minZ: -0.1, maxZ: 8 },
    { kind: 'box', minX: 17.6, maxX: 50, minZ: -0.1, maxZ: 8 },
    { kind: 'box', minX: -7.55, maxX: -4.45, minZ: -2.65, maxZ: -0.35 },
    { kind: 'box', minX: -50, maxX: 50, minZ: -28, maxZ: -18.5 },
  ];

  const id: SceneId = (march ? 'march' : blockade ? 'blockade' : hutong ? 'hutong' : 'street') as SceneId;
  const spawn: [number, number] = march ? [-30, -6] : blockade ? [-22, -5] : hutong ? [14.5, -2] : [-14, -4];
  const bounds: [number, number, number, number] = hutong ? [-32, 32, -16, 8] : [-40, 40, -18, 8];

  return {
    id,
    scene: s,
    spawn,
    bounds,
    camDist: march ? 12 : blockade ? 13 : undefined,
    cam: march ? { h: 0.55, ahead: 8, y: 0 } : blockade ? { h: 0.50, ahead: 8, y: 0.8 } : undefined,
    colliders,
    update(dt, t, playerX, playerZ) {
      marchHandle?.update(dt, t, playerX, playerZ);
      if (dynamic && riders && walkers) {
        rs.forEach((b, i) => {
          b.x += b.v * dt;
          if (b.x > 60) b.x = -60;
          if (b.x < -60) b.x = 60;
          o.position.set(b.x, Math.sin(t * 9 + i) * 0.015, b.z);
          o.rotation.set(0, b.v > 0 ? 0 : Math.PI, 0);
          o.updateMatrix();
          riders.setMatrixAt(i, o.matrix);
        });
        riders.instanceMatrix.needsUpdate = true;
        busMesh.position.x += 6 * dt;
        if (busMesh.position.x > 70) busMesh.position.x = -70;
        ws.forEach((w, i) => {
          w.x += w.v * dt;
          if (w.x > 50) w.x = -50;
          if (w.x < -50) w.x = 50;
          o.position.set(w.x, Math.abs(Math.sin(t * 6 + i)) * 0.04, w.z);
          o.rotation.set(0, w.v > 0 ? 0 : Math.PI, 0);
          o.updateMatrix();
          walkers.setMatrixAt(i, o.matrix);
        });
        walkers.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
