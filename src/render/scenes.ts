import * as THREE from 'three';
import { C, Part, addLayeredParts, glowMat, instanced, litMat, mergeParts, place, rng, textTexture, vertText } from './kit';
import { addRealisticTrees } from './foliage';
import {
  ambulance,
  bike,
  bikeLod,
  crowdPerson,
  crowdPersonLod,
  lampHead,
  lampPole,
  person,
  sitPerson,
  sitPersonLod,
  tricycle,
} from './props';
import {
  broadcastStation,
  campTent,
  campusSceneArchitecture,
  democracyStatue,
  greatHall,
  huadengGlobes,
  huadengPole,
  monument,
  pkuWestGate,
  tiananmen,
  trolleybus,
  trolleyWindows,
} from './landmarks';
import {
  SharedTexPool,
  applyAtmosphere,
  asphaltRoadTex,
  campusPathTex,
  granitePavingTex,
  makeRainSystem,
  skyDomeTex,
} from './materials';
import { buildTiananmenSouthAndSkyline } from './imperialSouth';
import { buildStreet } from './streetScene';
import { buildCourtyard, buildFactory, workerTricycleRider } from './factoryArch';
import { attachSquare422Assembly, type SquareAssemblyHandle } from './marchProcession';
import { SCENE_META } from '../data';
import type { AtmospherePreset, SceneId, SceneManifestEntry } from '../types';

export { buildStreet, buildFactory, buildCourtyard, workerTricycleRider };

export type AABB6 = [number, number, number, number, number, number];

export type WorldCollider =
  | { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number }
  | { kind: 'circle'; x: number; z: number; r: number };

export interface World {
  id: SceneId;
  scene: THREE.Scene;
  spawn: [number, number];
  bounds: [number, number, number, number]; // minX,maxX,minZ,maxZ
  update(dt: number, t: number, playerX?: number, playerZ?: number): void;
  camDist?: number;
  speed?: number;
  cam?: { h: number; ahead: number; y: number };
  occluders?: AABB6[];
  colliders?: WorldCollider[];
  atmosphere?: AtmospherePreset;
  dispose?: () => void;
}

export type SceneBuilder = (id: SceneId, meta?: SceneManifestEntry) => World;

const SCENE_BUILDERS = new Map<string, SceneBuilder>();

/** Register a modular Wave 2/3 scene builder by SceneId so buildScene/WorldManager can invoke it. */
export function registerSceneBuilder(id: SceneId | string, fn: SceneBuilder): void {
  SCENE_BUILDERS.set(id, fn);
}

/** Tag a scene-created CanvasTexture as scene-owned so WorldManager disposes it cleanly on eviction. */
export function markSceneOwned<T extends THREE.Texture>(tex: T): T {
  tex.userData.sceneOwned = true;
  return tex;
}

function isNearAny(x: number, z: number, anchors: readonly [number, number][], radius = 15): boolean {
  const r2 = radius * radius;
  for (const [ax, az] of anchors) {
    const dx = x - ax;
    const dz = z - az;
    if (dx * dx + dz * dz <= r2) return true;
  }
  return false;
}

/** Lean LOD Huadeng streetlamp pole (~120 tris vs ~1,024 tris) for distant square/avenue edges. */
function huadengPoleLod(): Part[] {
  const iron = 0x44453d;
  const p: Part[] = [
    { p: [0, 0.32, 0], s: [1.50, 0.64, 1.50], c: 0xdedad0, cyl: true, seg: 6 },
    { p: [0, 0.98, 0], s: [1.38, 0.68, 1.38], c: 0xe8e4da, cyl: true, seg: 6 },
    { p: [0, 4.35, 0], s: [0.42, 6.1, 0.42], c: iron, cyl: true, seg: 6, top: 0.72 },
  ];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4;
    p.push({ p: [0, 6.85, 0], s: [2.05, 0.09, 0.09], c: iron, ry: a });
  }
  return p;
}

/** Lean LOD Huadeng globes using detail:0 icosahedra (180 tris vs 720 tris). */
function huadengGlobesLod(): Part[] {
  const p: Part[] = [
    { p: [0, 8.2, 0], s: [1.05, 1.15, 1.05], c: 0xfff3d4, sphere: true, detail: 0 },
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    p.push({
      p: [Math.cos(a) * 1.05, 7.3, Math.sin(a) * 1.05],
      s: [0.58, 0.64, 0.58],
      c: 0xffeec4,
      sphere: true,
      detail: 0,
    });
  }
  return p;
}

function base(fogColor: number, near = 18, far = 70): THREE.Scene {
  const s = new THREE.Scene();
  s.background = new THREE.Color(fogColor);
  s.fog = new THREE.Fog(fogColor, near, far);
  s.add(new THREE.HemisphereLight(0x55607a, 0x1c1810, 0.9));
  const moon = new THREE.DirectionalLight(0x8090b0, 0.35); moon.position.set(-10, 20, 8); s.add(moon);
  return s;
}

function sodium(s: THREE.Scene, x: number, z: number, i = 14, dist = 16) {
  const l = new THREE.PointLight(C.sodium, i, dist, 1.6); l.position.set(x, 4.6, z); s.add(l);
}

function signPlane(s: THREE.Scene, text: string, x: number, y: number, z: number, w: number, h: number, bg: string, fg: string, ry = 0, vertical = false) {
  const tex = markSceneOwned(textTexture(vertical ? 128 : 512, vertical ? 512 : 128, g => {
    g.fillStyle = bg; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.fillStyle = fg;
    if (vertical) vertText(g, text, 64, 24, 92);
    else { g.font = 'bold 84px "Noto Serif CJK TC","Noto Sans CJK TC",serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 68); }
  }));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: true }));
  m.position.set(x, y, z); m.rotation.y = ry; s.add(m);
}

/** Big-character posters on the notice board (or scrubbed remnants for aftermath). */
function posterTexture(scrubbed = false) {
  const lines = ['悼念耀邦', '沉痛悼念', '春寒料峭', '一路走好', '花圈獻給你', '悼', '心中的話', '清明未遠'];
  return markSceneOwned(textTexture(1024, 512, g => {
    g.fillStyle = '#3b2e22'; g.fillRect(0, 0, 1024, 512);
    const r = rng(7);
    if (scrubbed) {
      for (let i = 0; i < 16; i++) {
        g.fillStyle = i % 2 ? 'rgba(224,216,198,0.42)' : 'rgba(180,170,150,0.28)';
        const x = 30 + r() * 920, y = 20 + r() * 400;
        g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 0.4);
        g.fillRect(0, 0, 26 + r() * 52, 18 + r() * 44);
        g.restore();
      }
      return;
    }
    for (let i = 0; i < 11; i++) {
      const x = 12 + i * 92 + r() * 6, y = 10 + r() * 20, w = 82, h = 470 - r() * 60;
      g.fillStyle = i % 4 === 1 ? '#f4f1ea' : i % 4 === 3 ? '#e9e3d0' : '#efe6c8';
      g.save(); g.translate(x + w / 2, y); g.rotate((r() - 0.5) * 0.04); g.fillRect(-w / 2, 0, w, h);
      g.fillStyle = i % 5 === 2 ? '#202020' : '#141414';
      vertText(g, lines[i % lines.length], 0, 14, Math.min(54, (h - 30) / (lines[i % lines.length].length * 1.1)));
      g.restore();
    }
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(150 + i * 230, 470, 26, 0, 7); g.fill(); }
  }));
}

export function buildCampus(mode: 'night' | 'aftermath' = 'night'): World {
  const aftermath = mode === 'aftermath';
  const s = base(aftermath ? 0xc2cbd2 : 0x0e1220, aftermath ? 12 : 18, aftermath ? 58 : 70);
  s.background = skyDomeTex(aftermath ? 'aftermath' : 'night');
  if (aftermath) {
    s.add(new THREE.HemisphereLight(0xe4edf2, 0x504f47, 1.25));
    const sun = new THREE.DirectionalLight(0xfff0d8, 0.85); sun.position.set(16, 22, -10); s.add(sun);
  }
  const { stat, glow } = campusSceneArchitecture(aftermath);
  const r = rng(42);

  // Textured courtyard flagstone walks & outer asphalt road
  const walkNS = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 40),
    new THREE.MeshLambertMaterial({ map: campusPathTex(8, 12) }),
  );
  walkNS.rotation.x = -Math.PI / 2;
  walkNS.position.set(0, 0.032, -4);
  s.add(walkNS);

  const walkEW = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 4),
    new THREE.MeshLambertMaterial({ map: campusPathTex(16, 2) }),
  );
  walkEW.rotation.x = -Math.PI / 2;
  walkEW.position.set(0, 0.033, 4.2);
  s.add(walkEW);

  stat.push({ p: [0, -0.01, -22], s: [70, 0.04, 8], c: C.asphalt });
  const outerRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 8),
    new THREE.MeshLambertMaterial({ map: asphaltRoadTex(16, 2) }),
  );
  outerRoad.rotation.x = -Math.PI / 2;
  outerRoad.position.set(0, 0.02, -22);
  s.add(outerRoad);

  // 北京大學西校門
  stat.push(...place(pkuWestGate(), 0, -16));
  if (!aftermath) {
    stat.push(...place(person(C.khaki), -6, 3, -0.6), ...place(person(0x6a2f3a, 0x2d2d33), 5, -2, 2.2));
    stat.push(...place(person(C.navy), -1, -5.5, 1.5), ...place(person(C.green), 0.2, -6, 1.8), ...place(person(0x5d5a52), 4.6, -6.2, 1.4));
  }
  addLayeredParts(s, stat);
  if (glow.length) s.add(new THREE.Mesh(mergeParts(glow), glowMat()));

  // notice board poster texture + gate plaque
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 2.6),
    new THREE.MeshLambertMaterial({ map: posterTexture(aftermath), emissive: aftermath ? 0x000000 : 0x2a2418 }),
  );
  board.position.set(2, 1.4, -4.54); board.rotation.y = Math.PI; s.add(board);
  signPlane(s, '北京大學', 0, 4.75, -19.0, 3.0, 0.95, '#141210', '#d8b45a', Math.PI);

  const spawn: [number, number] = aftermath ? [0, -19] : [0, 5];
  const detailAnchors: [number, number][] = [spawn, [0, -16], [2, -4.4]];

  // trees (pagoda trees on campus: foreground detailed <=15m, distant LOD >15m), parked bikes, lamps
  const trees: { x: number; z: number; ry: number; s: number }[] = [];
  for (let i = 0; i < 8; i++) trees.push({ x: (i % 2 ? 1 : -1) * (9 + r() * 3), z: -13 + i * 2.5 + r(), ry: r() * 6, s: 0.8 + r() * 0.4 });
  for (let i = 0; i < 10; i++) trees.push({ x: -16 + i * 3.6, z: 4.5 + r(), ry: r() * 6, s: 0.9 });
  const fgTrees = trees.filter(t => isNearAny(t.x, t.z, detailAnchors, 15));
  const bgTrees = trees.filter(t => !isNearAny(t.x, t.z, detailAnchors, 15));
  if (fgTrees.length) addRealisticTrees(s, fgTrees, false, false);
  if (bgTrees.length) addRealisticTrees(s, bgTrees, false, true);

  const bikes: { x: number; z: number; ry: number }[] = [];
  if (aftermath) {
    bikes.push({ x: -3.8, z: 6.6, ry: -1.48 }, { x: -3.1, z: 6.7, ry: -1.62 }, { x: 3.6, z: 6.6, ry: -1.52 });
  } else {
    for (let i = 0; i < 18; i++) bikes.push({ x: 6 + i * 0.55, z: -13 + (i % 2) * 0.2, ry: Math.PI / 2 + (r() - 0.5) * 0.2 });
    for (let i = 0; i < 12; i++) bikes.push({ x: -14 + i * 0.55, z: 6.5, ry: -Math.PI / 2 });
  }
  const fgBikes = bikes.filter(b => isNearAny(b.x, b.z, detailAnchors, 15));
  const bgBikes = bikes.filter(b => !isNearAny(b.x, b.z, detailAnchors, 15));
  if (fgBikes.length) s.add(instanced(mergeParts(bike()), litMat(), fgBikes));
  if (bgBikes.length) s.add(instanced(mergeParts(bikeLod()), litMat(), bgBikes));

  const lamps = [{ x: -2.5, z: -10 }, { x: 2.5, z: 0 }, { x: 8, z: 4 }, { x: -8, z: 4 }, { x: 9, z: -21 }, { x: -9, z: -21, ry: Math.PI }];
  s.add(instanced(mergeParts(lampPole()), litMat(), lamps));
  if (!aftermath) {
    s.add(instanced(mergeParts(lampHead()), glowMat(), lamps));
    sodium(s, 3.4, -2, 16); sodium(s, -1.6, -10, 12); sodium(s, 0, 7, 10); sodium(s, 0, -21, 18);
  }
  return {
    id: (aftermath ? 'aftermath' : 'campus') as SceneId,
    scene: s,
    spawn,
    bounds: [-18, 18, -27, 9],
    atmosphere: aftermath ? 'aftermath' : 'night',
    occluders: [
      [-8.2, 8.2, 0, 8.9, -20.5, -11.5],
      [-18.2, 18.2, 0, 18.5, 7.6, 16.5],
      [-26.5, -17.6, 0, 14.5, -14.2, 10.2],
      [17.6, 26.5, 0, 11.8, -14.2, 10.2],
      [-1.5, 5.5, 0, 3.6, -5.0, -3.8],
      [-12.2, -8.8, 0, 3.4, -15.6, -12.8],
    ],
    update() { /* static */ },
  };
}

/** Overhead trolleybus wires plus span poles. */
function wires(x0: number, x1: number, zs: number[], poleZa: number, poleZb: number, step: number): Part[] {
  const p: Part[] = [];
  for (const z of zs) p.push({ p: [(x0 + x1) / 2, 5.9, z], s: [x1 - x0, 0.03, 0.03], c: 0x222222 });
  for (let x = x0; x <= x1; x += step) {
    p.push({ p: [x, 3.1, poleZa], s: [0.2, 6.2, 0.2], c: 0x4a4a46, cyl: true, seg: 6 }, { p: [x, 3.1, poleZb], s: [0.2, 6.2, 0.2], c: 0x4a4a46, cyl: true, seg: 6 });
    p.push({ p: [x, 6.0, (poleZa + poleZb) / 2], s: [0.03, 0.03, Math.abs(poleZa - poleZb)], c: 0x222222 });
  }
  return p;
}

function portraitTexture() {
  return markSceneOwned(textTexture(512, 680, g => {
    const W = 512, H = 680;
    // Baroque steeped bronze-gold inner & outer moulding frame (Tiananmen rostrum oil portrait frame)
    const frameGrad = g.createLinearGradient(0, 0, W, H);
    frameGrad.addColorStop(0, '#d8b76c');
    frameGrad.addColorStop(0.5, '#b68f44');
    frameGrad.addColorStop(1, '#dcb96e');
    g.fillStyle = frameGrad;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#6f5228';
    g.fillRect(10, 10, W - 20, H - 20);
    g.fillStyle = '#e0be78';
    g.fillRect(18, 18, W - 36, H - 36);
    g.fillStyle = '#4e391c';
    g.fillRect(25, 25, W - 50, H - 50);

    // Ornate corner rosette accents on gilt frame
    for (const [cx, cy] of [[14, 14], [W - 14, 14], [14, H - 14], [W - 14, H - 14]]) {
      g.fillStyle = '#ebd08e';
      g.beginPath();
      g.arc(cx, cy, 8, 0, Math.PI * 2);
      g.fill();
    }

    // Muted celadon-slate oil-canvas backdrop gradient
    const grd = g.createLinearGradient(0, 28, 0, H - 28);
    grd.addColorStop(0, '#9aa294');
    grd.addColorStop(0.55, '#7c8576');
    grd.addColorStop(1, '#525a4e');
    g.fillStyle = grd;
    g.fillRect(30, 30, W - 60, H - 60);

    // Soft studio radial rim halo behind portrait head & shoulders
    const halo = g.createRadialGradient(256, 305, 24, 256, 315, 235);
    halo.addColorStop(0, 'rgba(232,229,212,0.28)');
    halo.addColorStop(0.55, 'rgba(210,208,192,0.10)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = halo;
    g.fillRect(30, 30, W - 60, H - 60);

    // Zhongshan tunic shoulders, sculpted lapels & placket
    const coat = g.createLinearGradient(60, 405, 452, H - 30);
    coat.addColorStop(0, '#62685b');
    coat.addColorStop(0.45, '#4b5147');
    coat.addColorStop(1, '#343931');
    g.fillStyle = coat;
    g.beginPath();
    g.moveTo(36, H - 30);
    g.quadraticCurveTo(88, 446, 194, 410);
    g.lineTo(318, 410);
    g.quadraticCurveTo(424, 446, W - 36, H - 30);
    g.closePath();
    g.fill();

    // Subtle fabric fold strokes on shoulders
    g.strokeStyle = 'rgba(24,27,22,0.28)';
    g.lineWidth = 4;
    for (const [x0, y0, x1, y1] of [
      [148, 448, 128, 640],
      [182, 434, 174, 646],
      [364, 448, 384, 640],
      [330, 434, 338, 646],
    ]) {
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }

    // Neck + crisp stiff Zhongshan stand-up collar + placket & horn buttons
    g.fillStyle = '#c49870';
    g.fillRect(216, 366, 80, 68);
    g.fillStyle = 'rgba(138,94,62,0.25)';
    g.beginPath(); g.ellipse(256, 396, 40, 16, 0, 0, Math.PI * 2); g.fill();

    g.fillStyle = '#383d35';
    g.beginPath();
    g.moveTo(188, 410); g.lineTo(256, 448); g.lineTo(324, 410); g.lineTo(308, 394); g.lineTo(256, 418); g.lineTo(204, 394);
    g.closePath();
    g.fill();
    g.fillStyle = '#687063';
    g.fillRect(252, 444, 8, 206);
    for (const by of [500, 580]) {
      g.fillStyle = '#252822';
      g.beginPath(); g.arc(256, by, 6, 0, Math.PI * 2); g.fill();
    }

    // Ears with warm edge catchlight
    g.fillStyle = '#c89a72';
    g.beginPath(); g.ellipse(152, 286, 13, 28, -0.08, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(360, 286, 13, 28, 0.08, 0, Math.PI * 2); g.fill();

    // Sculpted head oval with multi-stop oil chiaroscuro
    const face = g.createRadialGradient(238, 250, 20, 256, 282, 136);
    face.addColorStop(0, '#f0d0ac');
    face.addColorStop(0.55, '#ddb48c');
    face.addColorStop(0.88, '#c29268');
    face.addColorStop(1, '#a6764f');
    g.fillStyle = face;
    g.beginPath();
    g.ellipse(256, 274, 100, 124, 0, 0, Math.PI * 2);
    g.fill();

    // Warm cheek blush & brow modeling
    const cheekL = g.createRadialGradient(204, 300, 4, 204, 300, 34);
    cheekL.addColorStop(0, 'rgba(186,104,78,0.18)');
    cheekL.addColorStop(1, 'rgba(186,104,78,0)');
    g.fillStyle = cheekL; g.fillRect(166, 264, 76, 76);
    const cheekR = g.createRadialGradient(308, 300, 4, 308, 300, 34);
    cheekR.addColorStop(0, 'rgba(186,104,78,0.18)');
    cheekR.addColorStop(1, 'rgba(186,104,78,0)');
    g.fillStyle = cheekR; g.fillRect(270, 264, 76, 76);

    // Swept dark hair with brushed temple highlights
    g.fillStyle = '#1d1916';
    g.beginPath();
    g.moveTo(154, 264);
    g.quadraticCurveTo(156, 142, 256, 138);
    g.quadraticCurveTo(356, 142, 358, 264);
    g.quadraticCurveTo(328, 190, 256, 188);
    g.quadraticCurveTo(184, 190, 154, 264);
    g.fill();
    g.fillStyle = 'rgba(136,132,126,0.34)';
    g.fillRect(154, 232, 10, 34);
    g.fillRect(348, 232, 10, 34);

    // Brows, sculpted eye sockets, iris dots, nose bridge & composed mouth
    g.fillStyle = 'rgba(62,38,24,0.52)';
    g.beginPath(); g.ellipse(214, 245, 22, 4.5, -0.04, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(298, 245, 22, 4.5, 0.04, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(50,30,18,0.58)';
    g.beginPath(); g.ellipse(214, 266, 15, 6.2, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(298, 266, 15, 6.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(248,242,232,0.55)';
    g.beginPath(); g.arc(217, 264, 2.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(301, 264, 2.5, 0, Math.PI * 2); g.fill();

    g.fillStyle = 'rgba(115,70,42,0.34)';
    g.beginPath(); g.moveTo(256, 258); g.lineTo(245, 316); g.lineTo(268, 316); g.closePath(); g.fill();
    g.fillStyle = 'rgba(248,224,196,0.22)';
    g.fillRect(253, 258, 5, 48);

    g.fillStyle = 'rgba(108,52,40,0.62)';
    g.beginPath(); g.ellipse(256, 344, 28, 4.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(72,40,26,0.62)';
    g.beginPath(); g.arc(246, 376, 4.2, 0, Math.PI * 2); g.fill();

    // Fine linen oil-canvas weave across portrait surface
    g.fillStyle = 'rgba(255,250,240,0.03)';
    for (let y = 30; y < H - 30; y += 6) g.fillRect(30, y, W - 60, 1);
    for (let x = 30; x < W - 30; x += 6) g.fillRect(x, 30, 1, H - 60);
  }));
}

function sloganTexture(text: string) {
  return markSceneOwned(textTexture(1024, 128, g => {
    const bg = g.createLinearGradient(0, 0, 0, 128);
    bg.addColorStop(0, '#c02a20');
    bg.addColorStop(0.5, '#a82118');
    bg.addColorStop(1, '#8c1a12');
    g.fillStyle = bg;
    g.fillRect(0, 0, 1024, 128);
    // Slim gilded wood border framing both flanking Tiananmen plaques
    g.strokeStyle = '#d4b264';
    g.lineWidth = 6;
    g.strokeRect(5, 5, 1014, 118);
    g.fillStyle = 'rgba(40,8,4,0.35)';
    g.font = 'bold 84px "Noto Sans CJK TC","Noto Serif CJK TC",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 514, 71);
    g.fillStyle = '#faf3e2';
    g.fillText(text, 512, 68);
  }));
}

/** 長安街 at 天安門: real proportions (supporting night, April 22 dawn, May 13-15 camp, and May 30 dusk statue). */
export function buildChangan(mode: 'night' | 'dawn' | 'camp' | 'statue' = 'night'): World {
  const dawn = mode === 'dawn', camp = mode === 'camp', statue = mode === 'statue';
  const dayish = dawn || camp;
  const s = base(
    dawn ? 0xd2c9bb : camp ? 0xd8c19d : statue ? 0x6c4c52 : 0x1b2030,
    dayish ? 185 : statue ? 150 : 145,
    dayish ? 1050 : statue ? 920 : 840,
  );
  s.background = skyDomeTex(dawn ? 'dawn' : camp ? 'camp' : statue ? 'statue' : 'night');
  const stat: Part[] = [], glow: Part[] = [], flood: Part[] = [];
  const r = rng(417), o = new THREE.Object3D();

  const id: SceneId = (dawn ? 'square' : camp ? 'camp' : statue ? 'statue' : 'changan') as SceneId;
  const spawn: [number, number] = dawn ? [-20, -262] : camp ? [-15, -242] : statue ? [0, -190] : [-60, -86];
  const detailAnchors: [number, number][] = dawn
    ? [spawn, [-102, -320]]
    : camp
      ? [spawn, [-20, -265], [14, -278]]
      : statue
        ? [spawn, [0, -172]]
        : [spawn, [0, -18], [0, -330]];

  // ground: textured Chang'an avenue (z -38..-88), bike lanes behind railings, textured granite Square paving
  stat.push({ p: [0, -0.05, -63], s: [700, 0.1, 50], c: 0x26262a });
  const avePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 50),
    new THREE.MeshLambertMaterial({ map: asphaltRoadTex(45, 4) }),
  );
  avePlane.rotation.x = -Math.PI / 2;
  avePlane.position.set(0, 0.01, -63);
  s.add(avePlane);

  for (let x = -340; x < 340; x += 9) for (const z of [-56, -63, -70]) stat.push({ p: [x, 0.01, z], s: [4.5, 0.02, 0.2], c: 0x9a978c });
  stat.push({ p: [0, 0.01, -63], s: [700, 0.02, 0.35], c: 0xc9b860 });
  for (const z of [-42, -84]) {
    stat.push({ p: [0, 0.6, z + (z < -60 ? 3.5 : -3.5)], s: [700, 0.08, 0.08], c: 0x4c7aa8 }, { p: [0, 0.25, z + (z < -60 ? 3.5 : -3.5)], s: [700, 0.06, 0.06], c: 0xd8d8d0 });
    for (let x = -340; x < 340; x += 4.5) stat.push({ p: [x, 0.3, z + (z < -60 ? 3.5 : -3.5)], s: [0.06, 0.6, 0.06], c: 0x4c7aa8 });
  }

  stat.push({ p: [0, -0.08, -340], s: [460, 0.1, 560], c: 0x625e55 });          // Square, Hall & South Axis sub-base (z -620..-60)
  stat.push(
    { p: [0, -0.006, -297.5], s: [460, 0.01, 264.6], c: 0x7d776c },               // Great Hall & Museum court apron
    { p: [0, -0.006, -466], s: [220, 0.01, 71.6], c: 0x726d62 },                  // Mao Memorial flanking south plaza apron
    { p: [0, -0.002, -582], s: [140, 0.016, 51.6], c: 0x6d685e },                 // Qianmen Arrow Tower south plaza apron
  );
  const squarePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 340),
    new THREE.MeshLambertMaterial({ map: granitePavingTex(24, 45) }),
  );
  squarePlane.rotation.x = -Math.PI / 2;
  squarePlane.position.set(0, 0.01, -260);
  s.add(squarePlane);

  stat.push(
    { p: [0, -0.08, -15], s: [700, 0.1, 50], c: 0x3a3833 },                       // North palace/avenue deep ground sub-base
    { p: [0, 0.001, -34.65], s: [169.4, 0.016, 6.7], c: 0x7a756b },               // Tiananmen promenade apron (z -38..-31.3)
    { p: [0, 0.001, -89], s: [180, 0.016, 2.1], c: 0x7a756b },                    // North Square edge apron (bridges z -90..-88)
    { p: [-217.35, 0.002, -24], s: [265.3, 0.02, 28], c: 0x6b675e },              // West Chang'an north sidewalk (Telegraph Bldg)
    { p: [217.35, 0.002, -24], s: [265.3, 0.02, 28], c: 0x6b675e },               // East Chang'an north sidewalk (Beijing Hotel)
    { p: [-220.1, 0.002, -104], s: [259.8, 0.02, 32], c: 0x6b675e },              // West Chang'an south sidewalk & ministry apron
    { p: [220.1, 0.002, -104], s: [259.8, 0.02, 32], c: 0x6b675e },               // East Chang'an south sidewalk & ministry apron
    { p: [0, 0.03, -38.0], s: [700, 0.06, 0.35], c: 0x8e897e },                   // North Chang'an granite curb
    { p: [-220.1, 0.03, -88.0], s: [259.8, 0.06, 0.35], c: 0x8e897e },            // West flank south granite curb
    { p: [220.1, 0.03, -88.0], s: [259.8, 0.06, 0.35], c: 0x8e897e },             // East flank south granite curb
  );
  for (let x = -85; x <= 85; x += 10) stat.push({ p: [x, 0.0, -260], s: [0.25, 0.03, 340], c: 0x6b665c });

  // landmarks (100% foreground detailed)
  flood.push(...tiananmen());
  flood.push(...place(monument(), 0, -330));
  flood.push(...place(greatHall(), -150, -320), ...place(greatHall(true), 150, -320, Math.PI));
  stat.push({ p: [0, 15, -112], s: [0.35, 30, 0.35], c: 0xc8c8c0, cyl: true }, { p: [1.8, 28.5, -112], s: [3.6, 2.4, 0.05], c: 0xc21f1a }); // flagpole
  const southBundle = buildTiananmenSouthAndSkyline(mode);
  stat.push(...southBundle.stat);
  flood.push(...southBundle.flood);
  glow.push(...southBundle.glow);
  for (const ex of southBundle.extras) s.add(ex);
  for (const x of [-21, -15, -9, -3, 3, 9, 15, 21]) glow.push({ p: [x, 20.6, -13.2], s: [1.5, 1.8, 1.5], c: 0xe0402a, sphere: true, detail: 0 });
  for (let i = 0; i < 10; i++) glow.push({ p: [-22 + i * 4.9, 17.5, -12.25], s: [3.2, 4.5, 0.05], c: 0xffd48a });
  const pops: { x: number; z: number; ry: number; s: number }[] = [];
  for (let x = -300; x <= 300; x += 15) {
    if (Math.abs(x) < 85) continue;
    pops.push({ x: x + r() * 2, z: -36 - r(), ry: r() * 6, s: 1.3 }, { x: x + r() * 2 + 3, z: -90 - r(), ry: r() * 6, s: 1.3 });
  }
  const lamps: { x: number; z: number; ry?: number; s: number }[] = [];
  for (let x = -320; x <= 320; x += 32) if (Math.abs(x) > 90) lamps.push({ x, z: -41, s: 1.3 }, { x: x + 16, z: -85, ry: Math.PI, s: 1.3 });
  const hd: { x: number; z: number }[] = [];
  for (let x = -80; x <= 80; x += 20) hd.push({ x, z: -40 }, { x, z: -86 });
  for (let z = -110; z > -420; z -= 40) hd.push({ x: -86, z }, { x: 86, z });

  // mode-specific square staging
  if (mode === 'night') {
    stat.push(...place(person(0x2f3540), 6, -95, 2), ...place(person(C.khaki), 8, -96.5, 1.2), ...place(person(0x5b5f3c), 9.5, -94.5, 2.8), ...place(person(C.navy), 12, -96, 3.6));
    stat.push(...place(person(0x4b4a45, C.black, 0x999999), -40, -88.5, Math.PI / 2), { p: [-41, 0.25, -88.5], s: [0.8, 0.5, 0.5], c: 0x5a3e28 });
    stat.push(...place(bike(), -38.6, -88.6, 0.2));
    for (let i = 0; i < 26; i++) {
      const px = -60 + r() * 120;
      const pz = -105 - r() * 200;
      const col = [C.navy, C.khaki, 0x2f3540, 0x5d4c3a][i % 4]!;
      const fig = isNearAny(px, pz, detailAnchors, 15) ? person(col) : crowdPersonLod(col);
      stat.push(...place(fig, px, pz, r() * 6));
    }
  }

  if (camp) {
    // broadcast station at [-20, -265], 2 ambulance vans & corded emergency lane on east side, tricycle water carts
    stat.push(...place(broadcastStation(), -20, -265, 0.35));
    stat.push(...place(ambulance(), 30, -255, -Math.PI / 2), ...place(ambulance(), 30, -295, Math.PI / 2));
    stat.push(...place(tricycle(), 22, -248, -Math.PI / 2), ...place(tricycle(), -9, -258, 0.3));
    // corded-off emergency lane barriers (x = 24 and x = 36, z = -130..-340)
    for (const cx of [24, 36]) {
      stat.push({ p: [cx, 0.85, -235], s: [0.06, 0.06, 210], c: 0xd83228 });
      for (let cz = -130; cz >= -340; cz -= 7) {
        stat.push({ p: [cx, 0.50, cz], s: [0.10, 1.0, 0.10], c: 0xe6e2d4 });
      }
    }
    // camp banners framing the Monument and broadcast post around x: -24..24, z: -255..-295
    const campBanners: [number, number, string, number, boolean][] = [
      [-23.5, -274, '新聞自由', 0.28, true],
      [-10.5, -288, '絕食請願', 0.14, false],
      [10.5, -288, '和平理性', -0.14, false],
      [16.5, -262, '聲援同學', -0.26, true],
    ];
    for (const [bx, bz, bt, bry, red] of campBanners) {
      const tex = markSceneOwned(textTexture(512, 128, g => {
        g.fillStyle = red ? '#b3251c' : '#f2efe6'; g.fillRect(0, 0, 512, 128);
        g.fillStyle = red ? '#f7f1e2' : '#141414'; g.font = 'bold 82px "Noto Serif CJK TC",serif';
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(bt, 256, 68);
      }));
      const b = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.05), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
      b.position.set(bx, 2.85, bz); b.rotation.y = bry; s.add(b);
      for (const side of [-2.25, 2.25]) {
        stat.push({ p: [bx + Math.cos(bry) * side, 1.78, bz - Math.sin(bry) * side], s: [0.06, 3.56, 0.06], c: 0x8f7a52, cyl: true, seg: 5 });
      }
    }
    // 36 instanced campTents clustered around x: -24..24, z: -255..-295 (clear of east emergency lane x = 24..36)
    const tents: { x: number; z: number; ry: number }[] = [{ x: 17.2, z: -278, ry: -Math.PI / 2 }];
    const tColsX = [-23.5, -17.5, -11.5, -5.5, 0.5, 6.5, 12.5, 19.5];
    const tRowsZ = [-256, -264, -272, -280, -288, -295];
    for (let rz = 0; rz < tRowsZ.length && tents.length < 36; rz++) {
      for (let cx = 0; cx < tColsX.length && tents.length < 36; cx++) {
        const tx = tColsX[cx] + (r() - 0.5) * 1.4;
        const tz = tRowsZ[rz] + (r() - 0.5) * 1.4;
        if (tx > 21) continue; // clear of east emergency lane cord at x = 24
        if (Math.hypot(tx + 20, tz + 265) < 5.0) continue; // clear of broadcastStation
        if (Math.hypot(tx - 14, tz + 278) < 3.4 || Math.hypot(tx - 17.2, tz + 278) < 3.6) continue; // keep c3tent clear
        if (Math.hypot(tx + 9, tz + 258) < 3.4 || Math.hypot(tx - 22, tz + 248) < 3.6) continue;   // clear of tricycles
        if (Math.hypot(tx + 15, tz + 242) < 4.5 || Math.hypot(tx, tz + 245) < 4.0) continue;      // clear of spawn & c3leave
        if (campBanners.some(([bx, bz]) => Math.hypot(tx - bx, tz - bz) < 2.6)) continue;
        tents.push({ x: tx, z: tz, ry: (r() - 0.5) * 0.55 + ((cx + rz) % 3 === 0 ? Math.PI : 0) });
      }
    }
    while (tents.length < 36) tents.push({ x: -24 + (tents.length % 7) * 7.2, z: -301, ry: 0 });
    const tentMesh = instanced(mergeParts(campTent(0xffffff)), litMat(), tents);
    const tCols = [0x5c7258, 0x4b6276, 0x8e7e56, 0xa89f8a, 0x6b5a42];
    tents.forEach((_, i) => tentMesh.setColorAt(i, new THREE.Color(tCols[i % tCols.length])));
    s.add(tentMesh);
    // white-headband sit-in student groups: foreground detailed <=15m, distant LOD >15m
    const sitters: { x: number; z: number; ry: number; colIdx: number }[] = [];
    for (let i = 0; i < 160; i++) {
      const sx = -32 + r() * 52, sz = -298 + r() * 54;
      if (Math.hypot(sx + 15, sz + 242) < 3.2 || Math.hypot(sx + 20, sz + 265) < 3.6) continue;
      if (tents.some(t => Math.hypot(sx - t.x, sz - t.z) < 2.1)) continue;
      if (campBanners.some(([bx, bz]) => Math.hypot(sx - bx, sz - bz) < 2.2)) continue;
      sitters.push({ x: sx, z: sz, ry: r() * Math.PI * 2, colIdx: sitters.length });
    }
    const sCols = [C.navy, C.khaki, 0x4e5a4a, 0x6a2f3a, 0x3b485a, 0x7b7260];
    const fgSitters = sitters.filter(p => isNearAny(p.x, p.z, detailAnchors, 15));
    const bgSitters = sitters.filter(p => !isNearAny(p.x, p.z, detailAnchors, 15));
    if (fgSitters.length) {
      const m = instanced(mergeParts(sitPerson(0x3f454e, C.navy, C.black, true)), litMat(), fgSitters);
      fgSitters.forEach((p, i) => m.setColorAt(i, new THREE.Color(sCols[p.colIdx % sCols.length]).multiplyScalar(1.9)));
      s.add(m);
    }
    if (bgSitters.length) {
      const m = instanced(mergeParts(sitPersonLod(0x3f454e, true)), litMat(), bgSitters);
      bgSitters.forEach((p, i) => m.setColorAt(i, new THREE.Color(sCols[p.colIdx % sCols.length]).multiplyScalar(1.9)));
      s.add(m);
    }
  }

  if (statue) {
    // democracyStatue standing prominently at [0, -172] facing north (+z toward Tiananmen)
    flood.push(...place(democracyStatue(), 0, -172, Math.PI));
    for (const [lx, lz] of [[-5.5, -165], [5.5, -165], [-5.5, -179], [5.5, -179]]) {
      stat.push({ p: [lx, 0.7, lz], s: [0.16, 1.4, 0.16], c: 0x3a3c40 });
      glow.push({ p: [lx, 1.45, lz], s: [0.35, 0.28, 0.35], c: 0xffe8b0 });
    }
    // weathered tents further south on the Square
    const wtents: { x: number; z: number; ry: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const tx = -46 + (i % 7) * 11 + (r() - 0.5) * 2.5;
      const tz = -292 + Math.floor(i / 7) * 14 + (r() - 0.5) * 3.0;
      if (Math.hypot(tx + 15, tz + 255) < 4.0 || Math.hypot(tx - 12, tz + 230) < 4.0) continue;
      wtents.push({ x: tx, z: tz, ry: (r() - 0.5) * 0.7 });
    }
    const wMesh = instanced(mergeParts(campTent(0x4d544a)), litMat(), wtents);
    wtents.forEach((_, i) => wMesh.setColorAt(i, new THREE.Color(i % 2 ? 0x565e52 : 0x6d6552)));
    s.add(wMesh);
    // gathered students admiring & sketching around the statue (foreground detailed <=15m, distant LOD >15m)
    const stus: { x: number; z: number; ry: number; colIdx: number }[] = [];
    for (let i = 0; i < 160; i++) {
      const a = -Math.PI * 0.85 + r() * Math.PI * 1.7, d = 6.5 + r() * 18;
      const sx = Math.cos(a) * d, sz = -172 + Math.sin(a) * d;
      if (Math.hypot(sx, sz + 176) < 3.0 || Math.hypot(sx, sz + 190) < 3.6) continue;
      if (Math.abs(sx) < 2.4 && sz < -176 && sz > -192) continue; // clear sightline from spawn [0, -190] to statue [0, -172]
      stus.push({ x: sx, z: sz, ry: Math.atan2(-sx, -172 - sz), colIdx: stus.length });
    }
    const stCols = [C.navy, C.khaki, 0x4e5a4a, 0x6a2f3a, 0x5d4c3a];
    const fgStus = stus.filter(p => isNearAny(p.x, p.z, detailAnchors, 15));
    const bgStus = stus.filter(p => !isNearAny(p.x, p.z, detailAnchors, 15));
    if (fgStus.length) {
      const m = instanced(mergeParts(crowdPerson(0x3a3f48)), litMat(), fgStus);
      fgStus.forEach((p, i) => m.setColorAt(i, new THREE.Color(stCols[p.colIdx % 5]).multiplyScalar(2.0)));
      s.add(m);
    }
    if (bgStus.length) {
      const m = instanced(mergeParts(crowdPersonLod(0x3a3f48)), litMat(), bgStus);
      bgStus.forEach((p, i) => m.setColorAt(i, new THREE.Color(stCols[p.colIdx % 5]).multiplyScalar(2.0)));
      s.add(m);
    }
  }

  addLayeredParts(s, stat);
  addLayeredParts(s, flood, dawn ? 0x140a06 : camp ? 0x18120a : statue ? 0x140f12 : 0x4a2a18);
  s.add(new THREE.Mesh(mergeParts(glow), glowMat()));

  // Avenue poplars: realistic wind-swaying multi-branch painted-leaf trees
  const fgPops = pops.filter(p => isNearAny(p.x, p.z, detailAnchors, 15));
  const bgPops = pops.filter(p => !isNearAny(p.x, p.z, detailAnchors, 15));
  if (fgPops.length) addRealisticTrees(s, fgPops, true, false);
  if (bgPops.length) addRealisticTrees(s, bgPops, true, true);

  s.add(instanced(mergeParts(lampPole()), litMat(), lamps));
  s.add(instanced(mergeParts(lampHead()), glowMat(), lamps));

  // Huadeng poles: foreground detailed, distant (>60m from spawn) LOD
  const fgHd = hd.filter(h => isNearAny(h.x, h.z, [spawn], 60));
  const bgHd = hd.filter(h => !isNearAny(h.x, h.z, [spawn], 60));
  if (fgHd.length) {
    s.add(instanced(mergeParts(huadengPole()), litMat(), fgHd));
    s.add(instanced(mergeParts(huadengGlobes()), glowMat(), fgHd));
  }
  if (bgHd.length) {
    s.add(instanced(mergeParts(huadengPoleLod()), litMat(), bgHd));
    s.add(instanced(mergeParts(huadengGlobesLod()), glowMat(), bgHd));
  }

  s.add(new THREE.Mesh(mergeParts(wires(-340, 340, [-57.4, -58.1, -67.9, -68.6], -44.5, -81.5, 40)), litMat()));

  // portrait + the two slogan boards
  const por = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 6.4), new THREE.MeshBasicMaterial({ map: portraitTexture(), fog: true }));
  por.position.set(0, 12.0, -18.62); por.rotation.y = Math.PI; s.add(por);
  for (const [x, t] of [[19, '中華人民共和國萬歲'], [-19, '世界人民大團結萬歲']] as [number, string][]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(17, 2.1), new THREE.MeshBasicMaterial({ map: sloganTexture(t), fog: true }));
    m.position.set(x, 10.6, -18.62); m.rotation.y = Math.PI; s.add(m);
  }

  // atmospheric lighting per time of day
  if (dawn) {
    const hemi = new THREE.HemisphereLight(0xdfe7f2, 0x6b604c, 1.25); hemi.name = 'day'; s.add(hemi);
    const sun = new THREE.DirectionalLight(0xffdcb4, 1.6); sun.name = 'day'; sun.position.set(300, 90, -120); s.add(sun);
  } else if (camp) {
    const hemi = new THREE.HemisphereLight(0xf6e6c4, 0x6e5f46, 1.35); hemi.name = 'day'; s.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd699, 1.75); sun.name = 'day'; sun.position.set(-220, 110, -80); s.add(sun);
  } else if (statue) {
    const hemi = new THREE.HemisphereLight(0x9b7898, 0x3b2c26, 0.95); hemi.name = 'day'; s.add(hemi);
    const duskSun = new THREE.DirectionalLight(0xffa868, 1.15); duskSun.name = 'day'; duskSun.position.set(-240, 48, -160); s.add(duskSun);
    // warm key (south) & rim (north) floodlights illuminating the white plaster statue & scaffold without flat overexposure
    for (const [sx, sz] of [[-9, -158], [9, -158], [-8, -184], [8, -184]] as [number, number][]) {
      const sf = new THREE.SpotLight(0xffeed2, sz < -172 ? 1.15 : 0.65, 80, 0.55, 0.5, 0);
      sf.name = 'day'; sf.position.set(sx, 2.5, sz); sf.target.position.set(0, 7.5, -172);
      s.add(sf, sf.target);
    }
  }
  const fl = new THREE.SpotLight(0xffd9a0, 2.2, 160, 0.5, 0.6, 0); fl.position.set(0, 6, -70); fl.target.position.set(0, 18, -10); s.add(fl, fl.target);
  for (const x of [-40, 0, 40]) { const l = new THREE.PointLight(0xfff0d0, 30, 40, 1.4); l.position.set(x, 8, -63); s.add(l); }
  const fm = new THREE.SpotLight(0xfff4e0, 3, 260, 0.35, 0.5, 0); fm.position.set(0, 4, -200); fm.target.position.set(0, 22, -330); s.add(fm, fm.target);
  for (const sg of [-1, 1]) { const f = new THREE.SpotLight(0xffe6b8, 2.4, 260, 0.6, 0.6, 0); f.position.set(sg * 60, 3, -300); f.target.position.set(sg * 115, 14, -320); s.add(f, f.target); }
  s.add(new THREE.HemisphereLight(0x6a7590, 0x2a2418, 0.5));
  if (!dayish) {
    const pool = new THREE.InstancedMesh(
      new THREE.CircleGeometry(12.5, 18).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: SharedTexPool.softGlowTex(),
        color: 0xffd28c,
        transparent: true,
        opacity: statue ? 0.28 : 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: true,
      }),
      hd.length,
    );
    hd.forEach((h, i) => { o.position.set(h.x, 0.04, h.z); o.rotation.set(0, 0, 0); o.updateMatrix(); pool.setMatrixAt(i, o.matrix); });
    s.add(pool);
    const haloGeo = new THREE.PlaneGeometry(4.4, 4.4);
    const haloGeo2 = new THREE.PlaneGeometry(4.4, 4.4);
    haloGeo2.rotateY(Math.PI / 2);
    const haloMat = new THREE.MeshBasicMaterial({
      map: SharedTexPool.softGlowTex(),
      color: 0xffe4a8,
      transparent: true,
      opacity: statue ? 0.24 : 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    const halos = new THREE.InstancedMesh(haloGeo, haloMat, hd.length);
    haloGeo2.dispose();
    hd.forEach((h, i) => {
      o.position.set(h.x, 7.8, h.z);
      o.rotation.set(0, 0.4, 0);
      o.updateMatrix();
      halos.setMatrixAt(i, o.matrix);
    });
    s.add(halos);
  }

  let squareHandle: SquareAssemblyHandle | null = null;
  if (dawn) {
    [fl, fm].forEach(l => l.visible = false);
    squareHandle = attachSquare422Assembly(s, spawn, detailAnchors);
    const kneel: Part[] = []; for (const z of [-321.5, -320, -318.5]) kneel.push({ p: [-102.5, 3.4, z], s: [0.5, 0.8, 0.45], c: 0x3a3f48 }, { p: [-102.2, 3.95, z], s: [0.22, 0.24, 0.22], c: 0xc8a07a }, { p: [-102.0, 4.1, z], s: [0.1, 0.4, 0.5], c: 0xf0ece0 });
    s.add(new THREE.Mesh(mergeParts(kneel), litMat()));
    const sp: Part[] = []; for (const [x, z] of [[-30, -282], [20, -260], [-60, -360]]) sp.push({ p: [x, 4, z], s: [0.25, 8, 0.25], c: 0x55554f, cyl: true }, { p: [x, 7.8, z], s: [0.9, 0.6, 0.6], c: 0x6b6f63, cyl: true, rz: 1.2, top: 0.35 });
    s.add(new THREE.Mesh(mergeParts(sp), litMat()));
  }
  if (dayish) {
    s.traverse(obj => { const l = obj as THREE.Light; if (l.isLight && l.name !== 'day') l.visible = false; });
  }

  // traffic: riders in the bike lanes (LOD in distant square/camp/statue modes), trolleybuses under the wires
  const N = 16;
  const riderParts = mode === 'night' ? bike(C.navy) : bikeLod(C.navy);
  const riders = new THREE.InstancedMesh(mergeParts(riderParts), litMat(), N);
  const rs = Array.from({ length: N }, (_, i) => ({ x: -200 + r() * 400, z: (i % 2 ? -42.5 : -82.5) + r() * 2.5, v: (i % 2 ? -1 : 1) * (3 + r() * 2) }));
  s.add(riders);
  const tb = [0, 1].map(i => { const g = new THREE.Group(); g.add(new THREE.Mesh(mergeParts(trolleybus()), litMat()), new THREE.Mesh(mergeParts(trolleyWindows()), glowMat())); g.position.set(i ? 60 : -90, 0, i ? -58 : -68); if (i) g.rotation.y = Math.PI; s.add(g); return g; });

  const bounds: [number, number, number, number] = dawn ? [-95, 60, -400, -95] : camp ? [-95, 60, -360, -110] : statue ? [-95, 60, -340, -95] : [-200, 200, -300, -38];
  const camDist = dawn ? 20 : (camp || statue) ? 22 : 30;
  const cam = statue ? { h: 0.42, ahead: 18, y: 7 } : camp ? { h: 0.45, ahead: 16, y: 6 } : undefined;
  return {
    id,
    scene: s,
    spawn,
    bounds,
    camDist,
    speed: 8,
    cam,
    atmosphere: dawn ? 'dawn' : camp ? 'day_spring' : statue ? 'dusk_warm' : 'night',
    colliders: dawn
      ? [
          { kind: 'box', minX: -30, maxX: 30, minZ: -359, maxZ: -301 },
          { kind: 'box', minX: -110, maxX: -91.5, minZ: -400, maxZ: -240 },
        ]
      : undefined,
    occluders: [
      [-34, 34, 0, 34.5, -19, 19],
      [-192, -106, 0, 38, -475, -165],
      [106, 192, 0, 38, -475, -165],
      [-31, 31, 0, 40.5, -360, -300],
      [-53, 53, 0, 34, -493, -397],
      [210, 266, 0, 44, -35, -11],
      [-272, -212, 0, 44, -35, -13],
      [-26, 26, 0, 42, -537, -513],
    ],
    update(dt, t) {
      squareHandle?.update(dt, t);
      rs.forEach((b, i) => { b.x += b.v * dt; if (b.x > 200) b.x = -200; if (b.x < -200) b.x = 200; o.position.set(b.x, Math.sin(t * 9 + i) * 0.015, b.z); o.rotation.set(0, b.v > 0 ? 0 : Math.PI, 0); o.updateMatrix(); riders.setMatrixAt(i, o.matrix); });
      riders.instanceMatrix.needsUpdate = true;
      tb[0].position.x += 7 * dt; if (tb[0].position.x > 300) tb[0].position.x = -300;
      tb[1].position.x -= 7 * dt; if (tb[1].position.x < -300) tb[1].position.x = 300;
    },
  };
}

function tagSceneOwnedTextures(scene: THREE.Scene): void {
  const markIfLocal = (tex: unknown) => {
    const t = tex as THREE.Texture | null | undefined;
    if (!t || !t.isTexture) return;
    if (t.userData?.shared || t.userData?.pooled) return;
    if ((t as THREE.CanvasTexture).isCanvasTexture || t.image) {
      markSceneOwned(t);
    }
  };
  markIfLocal(scene.background);
  markIfLocal(scene.environment);
  scene.traverse(obj => {
    const matOrList = (obj as THREE.Mesh).material;
    if (!matOrList) return;
    const mats = Array.isArray(matOrList) ? matOrList : [matOrList];
    for (const mat of mats) {
      if (!mat || typeof mat !== 'object') continue;
      for (const val of Object.values(mat)) {
        markIfLocal(val);
      }
    }
  });
}

function stripDefaultSceneLights(scene: THREE.Scene): void {
  const remove: THREE.Object3D[] = [];
  scene.traverse(obj => {
    if ((obj as THREE.HemisphereLight).isHemisphereLight || (obj as THREE.DirectionalLight).isDirectionalLight) {
      if (obj.name !== '__atmo_hemi' && obj.name !== '__atmo_dir') remove.push(obj);
    }
  });
  for (const obj of remove) obj.parent?.remove(obj);
}

function buildBuiltinOrVariant(id: string, meta?: SceneManifestEntry): World {
  const custom = SCENE_BUILDERS.get(id);
  if (custom) return custom(id as SceneId, meta);

  switch (id) {
    case 'campus': return buildCampus('night');
    case 'aftermath': return buildCampus('aftermath');
    case 'street': return buildStreet('night');
    case 'march': return buildStreet('march', 'night422');
    case 'blockade': return buildStreet('blockade');
    case 'hutong': return buildStreet('hutong');
    case 'changan': return buildChangan('night');
    case 'square': return buildChangan('dawn');
    case 'camp': return buildChangan('camp');
    case 'statue': return buildChangan('statue');
    case 'factory': return buildFactory('night');
    case 'factory_dawn': return buildFactory('dawn');
    case 'courtyard': return buildCourtyard();
    case 'march_day': {
      const w = buildStreet('march', 'day0427');
      stripDefaultSceneLights(w.scene);
      applyAtmosphere(w.scene, 'day_spring', { far: meta?.camFar ?? 220 });
      w.id = 'march_day';
      w.atmosphere = 'day_spring';
      return w;
    }
    case 'street_aftermath': {
      const w = buildStreet('night');
      stripDefaultSceneLights(w.scene);
      applyAtmosphere(w.scene, 'aftermath', { far: meta?.camFar ?? 220 });
      w.id = 'street_aftermath';
      w.atmosphere = 'aftermath';
      return w;
    }
    case 'courtyard_day': {
      const w = buildCourtyard();
      stripDefaultSceneLights(w.scene);
      applyAtmosphere(w.scene, 'day_spring', { far: meta?.camFar ?? 160 });
      w.id = 'courtyard_day';
      w.atmosphere = 'day_spring';
      return w;
    }
    case 'changan_rain': {
      const w = buildChangan('camp');
      stripDefaultSceneLights(w.scene);
      applyAtmosphere(w.scene, 'rain_overcast', { near: 42, far: meta?.camFar ?? 950 });
      const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent);
      const rain = makeRainSystem(isMobile);
      let rainCamX = w.spawn[0];
      let rainCamZ = w.spawn[1];
      rain.mesh.onBeforeRender = (_r, _s, cam) => {
        if (Math.hypot(cam.position.x - rainCamX, cam.position.z - rainCamZ) > 0.5) {
          rainCamX = cam.position.x;
          rainCamZ = cam.position.z;
          rain.update(0, rainCamX, rainCamZ);
        }
      };
      w.scene.add(rain.mesh);
      const baseUpdate = w.update.bind(w);
      const baseDispose = w.dispose;
      w.id = 'changan_rain';
      w.atmosphere = 'rain_overcast';
      w.update = (dt, t) => {
        baseUpdate(dt, t);
        rain.update(dt, rainCamX, rainCamZ);
      };
      w.dispose = () => {
        baseDispose?.();
        rain.dispose();
      };
      return w;
    }
    default: {
      const resolvedMeta = meta ?? (SCENE_META as Partial<Record<string, SceneManifestEntry>> | undefined)?.[id];
      const baseKind = resolvedMeta?.base;
      let w: World;
      if (baseKind === 'street') w = buildStreet('night');
      else if (baseKind === 'changan') w = buildChangan('night');
      else if (baseKind === 'factory') w = buildFactory('night');
      else if (baseKind === 'courtyard') w = buildCourtyard();
      else w = buildCampus('night');

      if (resolvedMeta) {
        w.id = resolvedMeta.id;
        if (resolvedMeta.atmosphere) {
          stripDefaultSceneLights(w.scene);
          applyAtmosphere(w.scene, resolvedMeta.atmosphere, {
            far: resolvedMeta.camFar,
          });
          w.atmosphere = resolvedMeta.atmosphere;
        }
      }
      return w;
    }
  }
}

/** Unified scene builder supporting all registered, built-in, and manifest fallback scenes. */
export function buildScene(id: string, meta?: SceneManifestEntry): World {
  const { result: world, keys: poolKeys } = SharedTexPool.captureScope(() =>
    buildBuiltinOrVariant(id, meta),
  );
  if (!world.atmosphere) {
    const resolvedMeta = meta ?? (SCENE_META as Partial<Record<string, SceneManifestEntry>> | undefined)?.[id];
    if (resolvedMeta?.atmosphere) world.atmosphere = resolvedMeta.atmosphere;
  }
  tagSceneOwnedTextures(world.scene);

  const prevDispose = world.dispose;
  let disposed = false;
  world.dispose = () => {
    if (disposed) return;
    disposed = true;
    prevDispose?.();
    const atmoKey = world.scene.userData?.__atmoSkyKey as string | undefined;
    if (atmoKey && !poolKeys.includes(atmoKey)) {
      SharedTexPool.release(atmoKey);
    }
    if (world.scene.userData) delete world.scene.userData.__atmoSkyKey;
    SharedTexPool.releaseAll(poolKeys);
  };

  return world;
}
