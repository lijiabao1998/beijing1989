import * as THREE from 'three';
import type { AtmospherePreset, SceneId, SceneManifestEntry } from '../../types';
import {
  C,
  type Part,
  addLayeredParts,
  glowMat,
  instanced,
  litMat,
  makeTwoSidedPlaneGeo,
  mergeParts,
  place,
  rng,
  textTexture,
  tintLitMat,
} from '../kit';
import {
  ambulance,
  bikeLod,
  crowdPersonLod,
  diningTable,
  lampHead,
  lampPole,
  marketStall,
  medicalTriageCart,
  tricycle,
} from '../props';
import { addRealisticTrees } from '../foliage';
import { campTent } from '../landmarks';
import {
  applyAtmosphere,
  asphaltRoadTex,
  campusPathTex,
  granitePavingTex,
  makeRainSystem,
  type RainSystem,
} from '../materials';
import {
  buildChangan,
  buildCourtyard,
  buildStreet,
  markSceneOwned,
  registerSceneBuilder,
  type AABB6,
  type World,
} from '../scenes';

const H = Math.PI / 2;

interface OwnedResources {
  geos: THREE.BufferGeometry[];
  mats: THREE.Material[];
  texs: THREE.Texture[];
}

function createTracker(): OwnedResources {
  return { geos: [], mats: [], texs: [] };
}

function trackMesh<T extends THREE.Object3D>(res: OwnedResources, obj: T): T {
  const m = obj as unknown as THREE.Mesh;
  if (m.geometry && !m.geometry.userData?.shared) res.geos.push(m.geometry);
  if (m.material) {
    const list = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of list) {
      if (mat && !mat.userData?.shared) res.mats.push(mat);
    }
  }
  return obj;
}

function trackLayered(res: OwnedResources, scene: THREE.Scene, parts: Part[], emissive = 0): void {
  const before = scene.children.length;
  addLayeredParts(scene, parts, emissive);
  for (let i = before; i < scene.children.length; i++) {
    trackMesh(res, scene.children[i]!);
  }
}

function disposeTracked(res: OwnedResources): void {
  for (const t of res.texs) t.dispose();
  for (const m of res.mats) m.dispose();
  for (const g of res.geos) g.dispose();
  res.texs.length = 0;
  res.mats.length = 0;
  res.geos.length = 0;
}

function stripSceneLights(scene: THREE.Scene, includeLocalLights = true): void {
  const remove: THREE.Object3D[] = [];
  scene.traverse(obj => {
    const l = obj as THREE.Light;
    if (!l.isLight) return;
    if (obj.name === '__atmo_hemi' || obj.name === '__atmo_dir') return;
    if (includeLocalLights || (obj as THREE.HemisphereLight).isHemisphereLight || (obj as THREE.DirectionalLight).isDirectionalLight) {
      remove.push(obj);
    }
  });
  for (const obj of remove) obj.parent?.remove(obj);
}

/** Multiply color on untextured vertex-colored glow meshes (e.g. windows/lampheads) without altering textured signs. */
function tintGlowMeshes(scene: THREE.Scene, hex: number): void {
  scene.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (m instanceof THREE.MeshBasicMaterial && m.vertexColors && !m.map) {
        m.color.setHex(hex);
      }
    }
  });
}

function addOwnedSignPlane(
  res: OwnedResources,
  scene: THREE.Scene,
  w: number,
  h: number,
  x: number,
  y: number,
  z: number,
  ry: number,
  texW: number,
  texH: number,
  draw: (g: CanvasRenderingContext2D) => void,
  doubleSide = false,
): THREE.Mesh {
  const tex = markSceneOwned(textTexture(texW, texH, draw));
  res.texs.push(tex);
  const geo = doubleSide ? makeTwoSidedPlaneGeo(w, h, 0.01) : new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    fog: true,
    side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  scene.add(trackMesh(res, mesh));
  return mesh;
}

function makeRedCrossSignTex(title: string, subtitle: string, w = 512, h = 128): THREE.CanvasTexture {
  return markSceneOwned(
    textTexture(w, h, g => {
      g.fillStyle = '#f3efe4';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#334d42';
      g.lineWidth = 6;
      g.strokeRect(6, 6, w - 12, h - 12);

      // Red Cross emblem on left
      const cx = Math.round(h * 0.52);
      const cy = Math.round(h * 0.5);
      const arm = Math.round(h * 0.28);
      const thick = Math.round(h * 0.11);
      g.fillStyle = '#c2221a';
      g.fillRect(cx - arm, cy - thick, arm * 2, thick * 2);
      g.fillRect(cx - thick, cy - arm, thick * 2, arm * 2);

      g.fillStyle = '#1f2b27';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      if (subtitle) {
        g.font = `bold ${Math.round(h * 0.34)}px "Noto Serif CJK TC","Noto Sans CJK TC",serif`;
        g.fillText(title, cx + arm + 20, Math.round(h * 0.37));
        g.fillStyle = '#5c382c';
        g.font = `bold ${Math.round(h * 0.22)}px "Noto Sans CJK TC",sans-serif`;
        g.fillText(subtitle, cx + arm + 22, Math.round(h * 0.72));
      } else {
        g.font = `bold ${Math.round(h * 0.42)}px "Noto Serif CJK TC","Noto Sans CJK TC",serif`;
        g.fillText(title, cx + arm + 20, cy + 2);
      }
    }),
  );
}

/**
 * Open-sided emergency medical tarp canopy derived from `campTent()` parts:
 * keeps the pitched tarp prism, ridge seam, ridge bamboo pole, guy ropes & pennant,
 * while removing groundsheet/doorway/bedding and raising onto 4 corner posts.
 */
function openTriageCanopy(x: number, z: number, ry = 0): Part[] {
  const tentParts = campTent(0x4b6a5d);
  const local: Part[] = [];
  const raiseY = 1.15;

  // Keep pitched tarp prism (1), ridge seam (2), ridge pole (6), and pennant pole/flag (15..17)
  for (let i = 0; i < tentParts.length; i++) {
    if (i === 0 || (i >= 3 && i <= 5) || (i >= 7 && i <= 14) || i >= 18) continue;
    const pt = tentParts[i]!;
    local.push({ ...pt, p: [pt.p[0], pt.p[1] + raiseY, pt.p[2]] });
  }

  // Sloped guy-rope stakes anchored cleanly from raised ridge/eaves to ground pegs
  for (const sz of [-1, 1]) {
    local.push(
      { p: [0, 1.30, sz * 1.48], s: [0.018, 2.56, 0.018], c: 0xb8ad92, cyl: true, seg: 4, rx: sz * -0.18 },
      { p: [0, 0.06, sz * 1.72], s: [0.035, 0.16, 0.035], c: 0x6b4b2e, rx: sz * 0.35 },
    );
    for (const sx of [-1, 1]) {
      local.push(
        { p: [sx * 1.24, 0.94, sz * 1.15], s: [0.016, 1.86, 0.016], c: 0xb8ad92, cyl: true, seg: 4, rz: sx * 0.21 },
        { p: [sx * 1.44, 0.06, sz * 1.15], s: [0.035, 0.16, 0.035], c: 0x6b4b2e, rz: sx * -0.35 },
      );
    }
  }

  // 4 steel/bamboo upright corner canopy posts (walk-under height ~1.85m)
  for (const sx of [-1.05, 1.05]) {
    for (const sz of [-1.15, 1.15]) {
      local.push(
        { p: [sx, 0.96, sz], s: [0.06, 1.92, 0.06], c: 0x6f6858, cyl: true, seg: 6 },
        { p: [sx, 0.04, sz], s: [0.16, 0.08, 0.16], c: 0x3b3e42 },
      );
    }
  }
  // Red Cross emblem flag patch on front tarp gable
  local.push(
    { p: [0, 1.95, -1.22], s: [0.36, 0.24, 0.02], c: 0xf4f1ea },
    { p: [0, 1.95, -1.235], s: [0.16, 0.045, 0.015], c: C.redCross },
    { p: [0, 1.95, -1.235], s: [0.045, 0.16, 0.015], c: C.redCross },
    // Folding wooden triage supply table & cotton cot inside canopy
    { p: [-0.35, 0.42, 0.2], s: [0.85, 0.05, 0.55], c: C.wood },
    { p: [-0.72, 0.21, -0.02], s: [0.05, 0.42, 0.05], c: C.darkWood },
    { p: [0.02, 0.21, -0.02], s: [0.05, 0.42, 0.05], c: C.darkWood },
    { p: [-0.72, 0.21, 0.42], s: [0.05, 0.42, 0.05], c: C.darkWood },
    { p: [0.02, 0.21, 0.42], s: [0.05, 0.42, 0.05], c: C.darkWood },
    { p: [-0.35, 0.54, 0.2], s: [0.32, 0.18, 0.26], c: 0xf0ece0 }, // sterile gauze box
    { p: [0.55, 0.22, 0.1], s: [0.68, 0.06, 1.65], c: 0x768572 }, // canvas folding cot
    { p: [0.55, 0.29, -0.52], s: [0.46, 0.09, 0.26], c: 0xe8e4d8 }, // pillow
  );

  return place(local, x, z, ry);
}

/** 1. Beijing Hospital Gate & Triage Forecourt (Union/Fuxing-inspired). */
function buildHospitalGate(_id: SceneId, meta?: SceneManifestEntry): World {
  const res = createTracker();
  const s = new THREE.Scene();
  const preset: AtmospherePreset = meta?.atmosphere ?? 'dawn';
  applyAtmosphere(s, preset, { far: meta?.camFar ?? 180 });

  const stat: Part[] = [];
  const glow: Part[] = [];
  const r = rng(19890515);

  // Sub-base, outer street apron, grey-brick forecourt plaza & central granite ambulance apron
  stat.push({ p: [0, -0.06, -2], s: [76, 0.10, 56], c: 0x2b2d2f });

  const outerRoad = trackMesh(
    res,
    new THREE.Mesh(
      new THREE.PlaneGeometry(76, 8),
      new THREE.MeshLambertMaterial({ map: asphaltRoadTex(18, 2) }),
    ),
  );
  outerRoad.rotation.x = -H;
  outerRoad.position.set(0, 0.01, 14.5);
  s.add(outerRoad);

  const plaza = trackMesh(
    res,
    new THREE.Mesh(
      new THREE.PlaneGeometry(48, 21),
      new THREE.MeshLambertMaterial({ map: campusPathTex(18, 8) }),
    ),
  );
  plaza.rotation.x = -H;
  plaza.position.set(0, 0.02, 0.5);
  s.add(plaza);

  const centralApron = trackMesh(
    res,
    new THREE.Mesh(
      new THREE.PlaneGeometry(18, 12),
      new THREE.MeshLambertMaterial({ map: granitePavingTex(7, 5) }),
    ),
  );
  centralApron.rotation.x = -H;
  centralApron.position.set(0, 0.028, -2.5);
  s.add(centralApron);

  // Union / Fuxing-inspired main 2-storey hospital entrance wing (z = -15.5, facing +z)
  const wingW = 32;
  const wingD = 6.4;
  const wingZ = -15.5;
  const frontZ = wingZ + wingD / 2; // -12.3
  const wingH = 8.2;
  const emeraldTile = 0x26664a;
  const emeraldRidge = 0x1a4734;
  const tealBeam = 0x1f4d3d;

  stat.push(
    { p: [0, 0.38, wingZ], s: [wingW + 0.4, 0.76, wingD + 0.4], c: 0x7b776e, tex: 'ashlarStone' },
    { p: [0, 2.46, wingZ], s: [wingW, 3.40, wingD], c: 0x62666b, tex: 'qingBrick' },
    { p: [0, 4.24, wingZ], s: [wingW + 0.35, 0.22, wingD + 0.35], c: 0x827e74, tex: 'ashlarStone' },
    { p: [0, 6.26, wingZ], s: [wingW - 0.1, 3.85, wingD - 0.1], c: 0xd0cabd, tex: 'plaster' },
    { p: [0, wingH + 0.16, wingZ], s: [wingW + 0.5, 0.32, wingD + 0.5], c: tealBeam },
    // Emerald glazed Sino-institutional hip-and-gable roof
    { p: [0, wingH + 1.05, wingZ], s: [wingW + 1.8, 1.55, wingD + 1.8], c: emeraldTile, roof: true, tex: 'roofTile' },
    { p: [0, wingH + 2.15, wingZ], s: [wingD + 0.8, 1.45, wingW - 5.2], c: emeraldTile, prism: true, ry: H, tex: 'roofTile' },
    { p: [0, wingH + 2.92, wingZ], s: [wingW - 5.0, 0.22, 0.28], c: emeraldRidge },
    { p: [-(wingW - 5.2) * 0.5, wingH + 3.08, wingZ], s: [0.32, 0.36, 0.34], c: emeraldRidge },
    { p: [(wingW - 5.2) * 0.5, wingH + 3.08, wingZ], s: [0.32, 0.36, 0.34], c: emeraldRidge },
  );

  // Facade brick pilasters & hospital windows
  for (const px of [-15.8, -10.6, -5.4, 5.4, 10.6, 15.8]) {
    stat.push({ p: [px, wingH * 0.5, frontZ + 0.08], s: [0.46, wingH - 0.4, 0.18], c: 0x575b60, tex: 'qingBrick' });
  }
  const winCols = [-14.2, -12.0, -9.2, -7.0, 7.0, 9.2, 12.0, 14.2];
  for (const wx of winCols) {
    for (const [wy, lit] of [[2.5, true], [6.2, r() < 0.45]] as [number, boolean][]) {
      stat.push(
        { p: [wx, wy - 0.82, frontZ + 0.08], s: [1.34, 0.10, 0.16], c: 0x827e74 },
        { p: [wx, wy + 0.82, frontZ + 0.08], s: [1.32, 0.12, 0.14], c: 0x726e66 },
        { p: [wx, wy, frontZ + 0.03], s: [1.18, 1.50, 0.07], c: 0x2a3b34 },
        { p: [wx, wy, frontZ + 0.06], s: [0.05, 1.42, 0.04], c: 0xe6e0d2 },
        { p: [wx, wy + 0.18, frontZ + 0.06], s: [1.10, 0.05, 0.04], c: 0xe6e0d2 },
      );
      (lit ? glow : stat).push({
        p: [wx, wy, frontZ + 0.045],
        s: [1.06, 1.36, 0.03],
        c: lit ? 0xe6e4c8 : 0x1c252b,
        noAO: lit,
      });
    }
  }

  // Flanking West & East Hospital Courtyard Wings
  for (const sx of [-1, 1]) {
    const ex = sx * 17.8;
    const ez = -11.4;
    stat.push(
      { p: [ex, 0.28, ez], s: [5.6, 0.56, 8.6], c: 0x76726a, tex: 'ashlarStone' },
      { p: [ex, 2.75, ez], s: [5.4, 4.40, 8.4], c: 0x62666b, tex: 'qingBrick' },
      { p: [ex, 5.05, ez], s: [5.8, 0.22, 8.8], c: tealBeam },
      { p: [ex, 5.85, ez], s: [5.8, 1.40, 8.8], c: emeraldTile, prism: true, tex: 'roofTile' },
      { p: [ex, 6.58, ez], s: [0.22, 0.16, 8.9], c: emeraldRidge },
    );
    for (const wz of [-13.6, -11.4, -9.2]) {
      const innerX = ex - sx * 2.72;
      stat.push({ p: [innerX, 2.6, wz], s: [0.06, 1.45, 1.15], c: 0x2b3c35 });
      glow.push({ p: [innerX - sx * 0.02, 2.6, wz], s: [0.03, 1.30, 1.00], c: 0xd9e0c8, noAO: true });
    }
  }

  // Projecting Sino-classical Portico (x = -4.6..4.6, z = -12.3..-8.8) + granite steps & stretcher ramp
  stat.push(
    { p: [0, 0.12, -9.6], s: [9.8, 0.24, 3.6], c: 0x8d897f, tex: 'ashlarStone' },
    { p: [0, 0.30, -10.5], s: [9.4, 0.20, 2.8], c: 0x99958b, tex: 'ashlarStone' },
    // Stretcher ramp on east side of portico steps
    { p: [3.7, 0.22, -8.3], s: [1.8, 0.36, 1.8], c: 0x868278, wedge: true, ry: -H },
    // Glass emergency double entrance doors
    { p: [0, 1.85, frontZ + 0.06], s: [3.2, 2.9, 0.12], c: 0x263830 },
    { p: [0, 1.85, frontZ + 0.11], s: [0.08, 2.8, 0.08], c: 0xdedad0 },
  );
  glow.push({ p: [0, 1.85, frontZ + 0.09], s: [2.8, 2.5, 0.05], c: 0xeff2dc, noAO: true });

  // 4 Portico Columns + Painted Beams + Curved Emerald Glazed Portico Roof + Red Cross Pediment
  for (const cx of [-3.9, -1.6, 1.6, 3.9]) {
    stat.push(
      { p: [cx, 0.50, -8.9], s: [0.64, 0.20, 0.64], c: 0x9b978d, bevel: true },
      { p: [cx, 2.15, -8.9], s: [0.36, 3.10, 0.36], c: 0x255343, cyl: true, seg: 10 },
      { p: [cx, 3.68, -8.9], s: [0.48, 0.14, 0.48], c: 0xc8a248 },
    );
  }
  stat.push(
    { p: [0, 3.85, -10.4], s: [9.6, 0.38, 3.8], c: tealBeam },
    { p: [0, 4.10, -10.4], s: [9.8, 0.18, 4.0], c: 0x8c2a22 },
    { p: [0, 5.15, -10.4], s: [11.2, 2.0, 5.4], c: emeraldTile, eave: true, curve: 0.16, tex: 'roofTile' },
    { p: [0, 6.20, -10.4], s: [5.4, 0.20, 0.24], c: emeraldRidge },
    // Carved Red Cross pediment emblem above portico lintel
    { p: [0, 4.55, -8.45], s: [0.76, 0.76, 0.10], c: 0xf4f1ea, bevel: true },
    { p: [0, 4.55, -8.38], s: [0.44, 0.14, 0.04], c: C.redCross },
    { p: [0, 4.55, -8.38], s: [0.14, 0.44, 0.04], c: C.redCross },
  );

  // Low perimeter courtyard walls (south z=11.2 kept <= 1.05m with open driveway x=-4.5..4.5 so camera behind spawn [0,10] never clips!)
  for (const sx of [-1, 1]) {
    stat.push(
      { p: [sx * 22.5, 0.25, -1.4], s: [0.56, 0.50, 25.4], c: 0x625f57, tex: 'ashlarStone' },
      { p: [sx * 22.5, 1.35, -1.4], s: [0.46, 2.10, 25.2], c: 0x5d6166, tex: 'qingBrick' },
      { p: [sx * 22.5, 2.52, -1.4], s: [0.68, 0.24, 25.4], c: 0x3b3e42, prism: true, tex: 'roofTile' },
      // South low curb wall + brick gate piers at x = ±4.8
      { p: [sx * 13.6, 0.46, 11.2], s: [17.4, 0.92, 0.44], c: 0x5d6166, tex: 'qingBrick' },
      { p: [sx * 13.6, 0.98, 11.2], s: [17.6, 0.12, 0.52], c: 0x7c786e, tex: 'ashlarStone' },
      { p: [sx * 4.75, 1.05, 11.2], s: [0.84, 2.10, 0.84], c: 0x666a70, tex: 'qingBrick' },
      { p: [sx * 4.75, 2.18, 11.2], s: [0.98, 0.18, 0.98], c: 0x868278, tex: 'ashlarStone' },
    );
  }

  // Emergency triage canopy (campTent open tarp variant) + medicalTriageCart + ambulance + tricycle + bike rack rail
  stat.push(...openTriageCanopy(-7.5, -3.0, 0.15));
  stat.push(...place(medicalTriageCart(), -4.8, -2.5, 0.35));
  stat.push(...place(ambulance(), 7.8, -2.8, -0.35));
  stat.push(...place(tricycle(), 5.2, 3.8, 2.4));

  // Tubular steel bike rack along east forecourt (x = 11.0..17.0, z = 4.5)
  stat.push(
    { p: [14.0, 0.52, 4.5], s: [6.2, 0.05, 0.05], c: C.chrome },
    { p: [11.0, 0.26, 4.5], s: [0.06, 0.52, 0.06], c: C.chrome },
    { p: [14.0, 0.26, 4.5], s: [0.06, 0.52, 0.06], c: C.chrome },
    { p: [17.0, 0.26, 4.5], s: [0.06, 0.52, 0.06], c: C.chrome },
  );

  // Freestanding Red Cross Triage Signpost frame at [-2.8, -5.2]
  stat.push(
    { p: [-3.55, 0.90, -5.2], s: [0.08, 1.80, 0.08], c: C.darkWood },
    { p: [-2.05, 0.90, -5.2], s: [0.08, 1.80, 0.08], c: C.darkWood },
    { p: [-2.80, 1.84, -5.2], s: [1.85, 0.14, 0.24], c: 0x255a44 },
    { p: [-2.80, 1.35, -5.23], s: [1.66, 0.96, 0.05], c: 0x3b3d3a },
  );

  trackLayered(res, s, stat);
  if (glow.length) {
    s.add(trackMesh(res, new THREE.Mesh(mergeParts(glow), glowMat())));
  }

  // Red Cross Signboards (markSceneOwned)
  const porticoTex = makeRedCrossSignTex('北京急救站・門診部', 'EMERGENCY & OUTPATIENT WING', 640, 128);
  res.texs.push(porticoTex);
  const porticoSign = trackMesh(
    res,
    new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.86), new THREE.MeshBasicMaterial({ map: porticoTex, fog: true })),
  );
  porticoSign.position.set(0, 3.85, -8.46);
  s.add(porticoSign);

  const standTex = makeRedCrossSignTex('紅十字臨時救護站', '淨水・紗布・登記處', 512, 256);
  res.texs.push(standTex);
  const standSign = trackMesh(
    res,
    new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.86), new THREE.MeshBasicMaterial({ map: standTex, fog: true })),
  );
  standSign.position.set(-2.8, 1.35, -5.19);
  s.add(standSign);

  // Instanced bikeLod, treeLod, lampPole/Head, and quiet medical staff / waiting neighbors
  const bikeCoords = [
    ...Array.from({ length: 6 }, (_, i) => ({ x: 11.4 + i * 0.95, z: 4.5, ry: -H + (r() - 0.5) * 0.15 })),
    { x: -12.8, z: 5.2, ry: H },
    { x: -13.6, z: 5.4, ry: H + 0.1 },
  ];
  s.add(trackMesh(res, instanced(mergeParts(bikeLod()), litMat(), bikeCoords)));

  const trees = [
    { x: -18.2, z: 5.8, ry: 0.4, s: 0.95 },
    { x: 18.2, z: 5.8, ry: 2.1, s: 0.95 },
    { x: -19.2, z: -4.8, ry: 1.3, s: 0.9 },
    { x: 19.2, z: -4.8, ry: 3.8, s: 0.9 },
  ];
  addRealisticTrees(s, trees, false, true)?.forEach(m => trackMesh(res, m));

  const roadPoplars = [
    { x: -13.5, z: 15.2, ry: 0.6, s: 1.0 },
    { x: 13.5, z: 15.2, ry: 2.5, s: 1.0 },
  ];
  addRealisticTrees(s, roadPoplars, true, true)?.forEach(m => trackMesh(res, m));

  const lamps = [
    { x: -11.5, z: 0.5 },
    { x: 11.5, z: 0.5, ry: Math.PI },
    { x: -7.5, z: 9.8 },
    { x: 7.5, z: 9.8, ry: Math.PI },
  ];
  s.add(trackMesh(res, instanced(mergeParts(lampPole()), litMat(), lamps)));
  const headMesh = trackMesh(res, instanced(mergeParts(lampHead()), glowMat(), lamps));
  (headMesh.material as THREE.MeshBasicMaterial).color.setHex(0x8fa2b0);
  s.add(headMesh);

  const staff = [
    { x: -6.2, z: -1.8, ry: 0.4 },
    { x: -3.4, z: -2.0, ry: -0.6 },
    { x: 2.4, z: -7.8, ry: 2.9 },
    { x: 9.6, z: -1.4, ry: -2.1 },
  ];
  const staffMesh = trackMesh(res, instanced(mergeParts(crowdPersonLod(0xf4f2ec, 0x3b4852)), tintLitMat(), staff));
  [0xf2f0e8, 0xe8ece8, 0x52606b, 0x5e6b58].forEach((c, i) =>
    staffMesh.setColorAt(i, new THREE.Color(c)),
  );
  s.add(staffMesh);

  // Soft dawn entry lights under portico & emergency tarp
  const porticoLight = new THREE.PointLight(0xffe0aa, 8, 14, 1.5);
  porticoLight.position.set(0, 3.3, -9.6);
  const tarpLight = new THREE.PointLight(0xfff0cc, 5, 10, 1.5);
  tarpLight.position.set(-7.5, 2.0, -3.0);
  s.add(porticoLight, tarpLight);

  const occluders: AABB6[] = [
    [-16.2, 16.2, 0, 11.2, -18.8, -12.2],
    [-4.8, 4.8, 0, 6.2, -12.3, -8.8],
    [-20.6, -14.8, 0, 6.6, -15.8, -7.2],
    [14.8, 20.6, 0, 6.6, -15.8, -7.2],
    [5.4, 10.2, 0, 2.4, -4.4, -1.2],
  ];

  return {
    id: 'hospital_gate',
    scene: s,
    spawn: meta?.spawn ?? [0, 10],
    bounds: meta?.bounds ?? [-24, 24, -18, 14],
    camDist: meta?.cam?.dist ?? 11,
    cam: meta?.cam && meta.cam.h !== undefined ? { h: meta.cam.h, ahead: meta.cam.ahead ?? 7, y: meta.cam.y ?? 1.2 } : { h: 0.65, ahead: 7, y: 1.2 },
    atmosphere: preset,
    occluders,
    colliders: [
      { kind: 'box', minX: -14.8, maxX: 14.8, minZ: -18.5, maxZ: -12.0 },
      { kind: 'box', minX: -24.5, maxX: -14.8, minZ: -18.5, maxZ: -7.2 },
      { kind: 'box', minX: 14.8, maxX: 24.5, minZ: -18.5, maxZ: -7.2 },
      { kind: 'box', minX: 5.5, maxX: 10.1, minZ: -3.9, maxZ: -1.7 },
      { kind: 'box', minX: -24.5, maxX: -4.2, minZ: 10.9, maxZ: 11.6 },
      { kind: 'box', minX: 4.2, maxX: 24.5, minZ: 10.9, maxZ: 11.6 },
    ],
    update() { /* static hospital courtyard */ },
    dispose() {
      disposeTracked(res);
    },
  };
}

/** 2. 1989 Beijing Siheyuan North-Room Interior (cutaway ceiling for clean top-down & eye-level cameras). */
function buildSiheyuanRoom(_id: SceneId, meta?: SceneManifestEntry): World {
  const res = createTracker();
  const s = new THREE.Scene();
  const preset: AtmospherePreset = meta?.atmosphere ?? 'night';
  applyAtmosphere(s, preset, { near: 10, far: meta?.camFar ?? 80 });

  const stat: Part[] = [];
  const glow: Part[] = [];

  // Exterior moonlit courtyard ground outside south lattice window (z = -14..-4.4)
  const outerYard = trackMesh(
    res,
    new THREE.Mesh(
      new THREE.PlaneGeometry(18, 10),
      new THREE.MeshLambertMaterial({ map: campusPathTex(8, 5) }),
    ),
  );
  outerYard.rotation.x = -H;
  outerYard.position.set(0, -0.02, -9.4);
  s.add(outerYard);

  // Room interior flooring: warm woodPlank + terrazzoFloor entry threshold bay
  stat.push(
    { p: [0, -0.04, 0.15], s: [12.0, 0.08, 9.4], c: 0x845c3c, tex: 'woodPlank' },
    { p: [-1.5, 0.015, -3.45], s: [3.2, 0.03, 2.0], c: 0xbcb8ae, tex: 'terrazzoFloor' },
    // Threshold timber sill at doorway
    { p: [-1.6, 0.05, -4.45], s: [1.5, 0.10, 0.24], c: 0x4b281a },
  );

  // North, West, East interior walls (plaster upper + qingBrick dado, height 3.15m; open ceiling above beams)
  const wallH = 3.15;
  const dadoH = 1.08;
  const upperH = wallH - dadoH;
  const upperY = dadoH + upperH * 0.5;
  const dadoCol = 0x6c746c;
  const plasterCol = 0xdfd8c8;
  const timberCol = 0x4b281a;

  // North back wall (z = 4.82, inner face 4.68)
  stat.push(
    { p: [0, dadoH * 0.5, 4.82], s: [12.0, dadoH, 0.28], c: dadoCol, tex: 'qingBrick' },
    { p: [0, upperY, 4.82], s: [12.0, upperH, 0.28], c: plasterCol, tex: 'plaster' },
    { p: [0, dadoH + 0.02, 4.67], s: [11.8, 0.06, 0.05], c: timberCol },
    { p: [0, wallH - 0.10, 4.67], s: [11.8, 0.16, 0.14], c: timberCol },
  );
  // West & East gable walls (x = ±5.96, inner face ±5.82)
  for (const sx of [-1, 1]) {
    stat.push(
      { p: [sx * 5.96, dadoH * 0.5, 0.15], s: [0.28, dadoH, 9.5], c: dadoCol, tex: 'qingBrick' },
      { p: [sx * 5.96, upperY, 0.15], s: [0.28, upperH, 9.5], c: plasterCol, tex: 'plaster' },
      { p: [sx * 5.81, dadoH + 0.02, 0.15], s: [0.05, 0.06, 9.3], c: timberCol },
      { p: [sx * 5.81, wallH - 0.10, 0.15], s: [0.14, 0.16, 9.3], c: timberCol },
    );
  }
  // Corner & bay interior timber pillars
  for (const px of [-5.78, -0.4, 5.78]) {
    for (const pz of [-4.45, 4.68]) {
      if (px === -0.4 && pz === 4.68) continue;
      stat.push({ p: [px, wallH * 0.5, pz], s: [0.20, wallH, 0.20], c: timberCol });
    }
  }
  // Exposed transverse ceiling tie-beams & eaves purlins (narrow beams preserve overhead camera sightline)
  for (const bz of [-4.3, 0.2, 4.5]) {
    stat.push({ p: [0, 3.06, bz], s: [11.8, 0.18, 0.18], c: timberCol });
  }
  for (const px of [-5.5, 5.5]) {
    stat.push({ p: [px, 3.16, 0.15], s: [0.14, 0.14, 9.2], c: 0x3b1f14 });
  }

  // South courtyard wall (z = -4.52) with ajar door at x=-1.6 and wide wood lattice window at x=0.4..4.4
  stat.push(
    // West flank solid pier (x = -5.9..-2.4)
    { p: [-4.15, dadoH * 0.5, -4.52], s: [3.5, dadoH, 0.26], c: dadoCol, tex: 'qingBrick' },
    { p: [-4.15, upperY, -4.52], s: [3.5, upperH, 0.26], c: plasterCol, tex: 'plaster' },
    // Center pier between door and window (x = -0.8..0.4)
    { p: [-0.2, wallH * 0.5, -4.52], s: [1.2, wallH, 0.26], c: dadoCol, tex: 'qingBrick' },
    // Door frame + transom + ajar wooden door leaf
    { p: [-2.32, 1.55, -4.52], s: [0.16, 3.10, 0.26], c: timberCol },
    { p: [-0.88, 1.55, -4.52], s: [0.16, 3.10, 0.26], c: timberCol },
    { p: [-1.60, 2.38, -4.52], s: [1.56, 0.16, 0.26], c: timberCol },
    { p: [-1.60, 2.75, -4.52], s: [1.32, 0.56, 0.08], c: 0x3b1f14 }, // transom lattice bar
    { p: [-1.18, 1.18, -4.15], s: [0.09, 2.24, 1.12], c: 0x6b281c, ry: 0.45 }, // half-open door
    // Under-window dado + sill + lintel + east pier
    { p: [2.4, 0.44, -4.52], s: [4.2, 0.88, 0.26], c: dadoCol, tex: 'qingBrick' },
    { p: [2.4, 0.90, -4.52], s: [4.2, 0.08, 0.34], c: 0x827e74, tex: 'ashlarStone' },
    { p: [2.4, 2.84, -4.52], s: [4.2, 0.62, 0.26], c: plasterCol, tex: 'plaster' },
    { p: [5.15, wallH * 0.5, -4.52], s: [1.5, wallH, 0.26], c: dadoCol, tex: 'qingBrick' },
  );

  // Wood lattice window frame & mullions (x = 0.4..4.4, y = 0.94..2.54)
  for (let wx = 0.4; wx <= 4.41; wx += 0.5) {
    stat.push({ p: [wx, 1.74, -4.52], s: [0.05, 1.60, 0.06], c: 0x5c2c1a });
  }
  for (const wy of [0.96, 1.35, 1.74, 2.13, 2.52]) {
    stat.push({ p: [2.4, wy, -4.52], s: [4.05, 0.05, 0.06], c: 0x5c2c1a });
  }
  // Courtyard low rear wall & scholar/locust tree silhouette outside window
  stat.push(
    { p: [0, 1.0, -13.5], s: [16, 2.0, 0.4], c: 0x3c3f44, tex: 'qingBrick' },
    { p: [0, 2.1, -13.5], s: [16.2, 0.24, 0.56], c: 0x2d3034, prism: true, ry: H, tex: 'roofTile' },
  );

  // Translucent pale moonlit window pane glass
  const winGlass = trackMesh(
    res,
    new THREE.Mesh(
      new THREE.PlaneGeometry(3.92, 1.54),
      new THREE.MeshLambertMaterial({
        color: 0x5a789c,
        emissive: 0x1e2c42,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    ),
  );
  winGlass.position.set(2.4, 1.74, -4.52);
  s.add(winGlass);

  // ── Interior 1989 Furnishings ──
  // 1. Central diningTable() (with red-shell thermos, teapot & porcelain bowls)
  stat.push(...place(diningTable(), 0.8, -0.6, 0));

  // 2. Small wooden desk at [2.8, 3.8] holding glowing vintage Bakelite shortwave radio
  const dx = 2.8;
  const dz = 3.8;
  stat.push(
    { p: [dx, 0.74, dz], s: [1.26, 0.05, 0.66], c: C.wood, bevel: true },
    { p: [dx - 0.54, 0.37, dz - 0.26], s: [0.06, 0.74, 0.06], c: C.darkWood },
    { p: [dx + 0.54, 0.37, dz - 0.26], s: [0.06, 0.74, 0.06], c: C.darkWood },
    { p: [dx - 0.54, 0.37, dz + 0.26], s: [0.06, 0.74, 0.06], c: C.darkWood },
    { p: [dx + 0.54, 0.37, dz + 0.26], s: [0.06, 0.74, 0.06], c: C.darkWood },
    { p: [dx + 0.36, 0.54, dz], s: [0.38, 0.32, 0.56], c: 0x4b331d }, // drawer box
    { p: [dx + 0.36, 0.54, dz - 0.29], s: [0.10, 0.025, 0.02], c: C.brass },
    // Wooden desk chair tucked slightly west
    { p: [dx - 0.15, 0.44, dz - 0.62], s: [0.42, 0.04, 0.40], c: C.wood },
    { p: [dx - 0.15, 0.68, dz - 0.80], s: [0.42, 0.48, 0.04], c: C.darkWood },
    { p: [dx - 0.32, 0.22, dz - 0.78], s: [0.04, 0.44, 0.04], c: C.darkWood },
    { p: [dx + 0.02, 0.22, dz - 0.78], s: [0.04, 0.44, 0.04], c: C.darkWood },
    { p: [dx - 0.32, 0.22, dz - 0.46], s: [0.04, 0.44, 0.04], c: C.darkWood },
    { p: [dx + 0.02, 0.22, dz - 0.46], s: [0.04, 0.44, 0.04], c: C.darkWood },
    // Vintage Bakelite Shortwave Radio (熊貓 / 紅星短波收音機)
    { p: [dx + 0.06, 0.89, dz + 0.06], s: [0.44, 0.26, 0.20], c: 0x341c11, bevel: true },
    { p: [dx - 0.05, 0.90, dz - 0.045], s: [0.18, 0.18, 0.015], c: 0xa89674 }, // fabric grille
    { p: [dx - 0.05, 0.94, dz - 0.052], s: [0.17, 0.014, 0.01], c: C.brass },
    { p: [dx - 0.05, 0.86, dz - 0.052], s: [0.17, 0.014, 0.01], c: C.brass },
    { p: [dx + 0.12, 0.82, dz - 0.052], s: [0.036, 0.02, 0.036], c: C.brass, cyl: true, rx: H, seg: 8 },
    { p: [dx + 0.20, 0.82, dz - 0.052], s: [0.036, 0.02, 0.036], c: C.brass, cyl: true, rx: H, seg: 8 },
    { p: [dx + 0.24, 1.24, dz + 0.08], s: [0.014, 0.46, 0.014], c: C.chrome, cyl: true, seg: 5, rz: -0.18 }, // antenna
    // Small enamel mug & notebook on desk
    { p: [dx - 0.42, 0.82, dz - 0.04], s: [0.09, 0.11, 0.09], c: C.enamel, cyl: true, seg: 8 },
    { p: [dx - 0.26, 0.78, dz - 0.14], s: [0.22, 0.025, 0.28], c: 0x2c425e, ry: 0.15 },
  );
  glow.push(
    { p: [dx + 0.15, 0.92, dz - 0.05], s: [0.16, 0.08, 0.015], c: 0xffd268, noAO: true }, // glowing shortwave dial
    { p: [dx + 0.24, 0.96, dz - 0.05], s: [0.018, 0.018, 0.015], c: 0xeb3c28, noAO: true },
  );

  // 3. Low wooden chest & folded quilt along north-west wall [-2.6, 4.0]
  stat.push(
    { p: [-2.6, 0.48, 4.15], s: [1.75, 0.96, 0.68], c: 0x5c3620, bevel: true },
    { p: [-2.6, 0.48, 3.80], s: [1.60, 0.80, 0.02], c: 0x4b2b18 },
    { p: [-2.9, 1.06, 4.15], s: [0.68, 0.20, 0.48], c: 0xc2483c }, // folded floral quilt
    { p: [-2.9, 1.18, 4.15], s: [0.66, 0.06, 0.46], c: 0xe6dcd0 },
    { p: [-2.05, 1.12, 4.12], s: [0.15, 0.32, 0.15], c: 0x2c5c40, cyl: true, seg: 8 }, // spare green thermos
  );

  // 4. Briquette brazier / honeycomb coal stove + kettle + stovepipe at [-4.3, -1.6]
  const sx = -4.3;
  const sz = -1.6;
  stat.push(
    { p: [sx, 0.28, sz], s: [0.34, 0.54, 0.34], c: 0x3b3e42, cyl: true, seg: 10 },
    { p: [sx, 0.56, sz], s: [0.30, 0.05, 0.30], c: 0x7b5438, cyl: true, seg: 10 },
    { p: [sx, 0.10, sz + 0.18], s: [0.12, 0.12, 0.03], c: 0x1a1c1e },
    { p: [sx, 0.66, sz], s: [0.22, 0.17, 0.22], c: 0xbec2c4, cyl: true, seg: 10, top: 0.74 }, // kettle
    { p: [sx, 0.76, sz], s: [0.15, 0.03, 0.15], c: 0xc8ccce, cyl: true, seg: 8, top: 0.6 },
    // Galvanized stovepipe elbow into west wall
    { p: [sx - 0.65, 1.75, sz], s: [0.12, 1.35, 0.12], c: 0x7b8288, cyl: true, rz: H, seg: 8 },
    { p: [sx - 0.12, 1.15, sz], s: [0.12, 1.25, 0.12], c: 0x7b8288, cyl: true, seg: 8 },
    // Stack of honeycomb coal briquettes beside stove
    { p: [sx + 0.42, 0.08, sz + 0.12], s: [0.17, 0.14, 0.17], c: 0x202022, cyl: true, seg: 8 },
    { p: [sx + 0.42, 0.22, sz + 0.12], s: [0.17, 0.14, 0.17], c: 0x202022, cyl: true, seg: 8 },
    { p: [sx + 0.62, 0.08, sz + 0.12], s: [0.17, 0.14, 0.17], c: 0x202022, cyl: true, seg: 8 },
  );
  glow.push({ p: [sx, 0.585, sz], s: [0.18, 0.02, 0.18], c: 0xff6e24, cyl: true, seg: 8, noAO: true });

  // 5. Overhead hanging tungsten bulb & green enamel shade
  stat.push(
    { p: [0.4, 2.84, 0.4], s: [0.02, 0.56, 0.02], c: 0x222222 },
    { p: [0.4, 2.58, 0.4], s: [0.36, 0.10, 0.36], c: 0x244c38, cyl: true, seg: 10, top: 0.28 },
  );
  glow.push({ p: [0.4, 2.51, 0.4], s: [0.11, 0.13, 0.11], c: 0xffe296, sphere: true, detail: 1, noAO: true });

  trackLayered(res, s, stat);
  addRealisticTrees(s, [{ x: 2.6, z: -8.6, ry: 0.4 }], false, false)?.forEach(m => trackMesh(res, m));
  if (glow.length) {
    s.add(trackMesh(res, new THREE.Mesh(mergeParts(glow), glowMat())));
  }

  // 1989 Spring Calendar Poster (markSceneOwned) on north wall [0, 1.92, 4.66] facing -z (ry = Math.PI)
  addOwnedSignPlane(res, s, 0.76, 1.06, 0, 1.92, 4.66, Math.PI, 256, 384, g => {
    g.fillStyle = '#f3ece0';
    g.fillRect(0, 0, 256, 384);
    g.strokeStyle = '#9c2c24';
    g.lineWidth = 8;
    g.strokeRect(8, 8, 240, 368);
    g.fillStyle = '#a82a22';
    g.fillRect(16, 16, 224, 98);
    g.fillStyle = '#f6e8c8';
    g.font = 'bold 46px "Noto Serif CJK TC",serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('1989', 128, 52);
    g.font = 'bold 26px "Noto Serif CJK TC",serif';
    g.fillText('五月・春', 128, 92);
    g.fillStyle = '#222222';
    g.font = 'bold 34px "Noto Serif CJK TC",serif';
    g.fillText('戊辰・己巳', 128, 160);
    g.fillStyle = '#9c2c24';
    g.font = 'bold 76px "Noto Serif CJK TC",serif';
    g.fillText('17', 128, 254);
    g.fillStyle = '#3b4a3e';
    g.font = '20px "Noto Sans CJK TC",sans-serif';
    g.fillText('北京家用掛曆', 128, 336);
  });

  // Warm tungsten room light + brazier ember glow + radio desk lamp + cool moonlight outside lattice window
  const tungsten = new THREE.PointLight(0xffcb7a, 16, 14, 1.4);
  tungsten.position.set(0.4, 2.45, 0.4);
  const ember = new THREE.PointLight(0xff7d30, 4.5, 5.5, 1.6);
  ember.position.set(sx, 0.78, sz);
  const radioGlow = new THREE.PointLight(0xffcc70, 3.8, 4.2, 1.6);
  radioGlow.position.set(dx, 1.35, dz - 0.35);
  const moonGlow = new THREE.PointLight(0x80a4d8, 4.5, 11, 1.4);
  moonGlow.position.set(2.4, 2.1, -5.8);
  s.add(tungsten, ember, radioGlow, moonGlow);

  const occluders: AABB6[] = [
    [-6.1, 6.1, 0, 3.2, 4.65, 5.0],
    [-6.1, -5.8, 0, 3.2, -4.6, 4.9],
    [5.8, 6.1, 0, 3.2, -4.6, 4.9],
    [-6.1, -0.8, 0, 3.2, -4.7, -4.35],
  ];

  return {
    id: 'siheyuan_room',
    scene: s,
    spawn: meta?.spawn ?? [0, 2.5],
    bounds: meta?.bounds ?? [-5.5, 5.5, -4, 4],
    camDist: meta?.cam?.dist ?? 5.5,
    cam: meta?.cam && meta.cam.h !== undefined ? { h: meta.cam.h, ahead: meta.cam.ahead ?? 3, y: meta.cam.y ?? 1.2 } : { h: 0.72, ahead: 3, y: 1.2 },
    atmosphere: preset,
    occluders,
    colliders: [
      { kind: 'circle', x: 0.8, z: -0.6, r: 0.65 },
      { kind: 'box', minX: 2.15, maxX: 3.45, minZ: 3.45, maxZ: 4.15 },
      { kind: 'box', minX: -3.5, maxX: -1.7, minZ: 3.78, maxZ: 4.5 },
      { kind: 'circle', x: -4.3, z: -1.6, r: 0.38 },
    ],
    update() { /* static room */ },
    dispose() {
      disposeTracked(res);
    },
  };
}

/** 3. Beijing Morning Market reusing streetScene.ts blocks in bright spring daylight. */
function buildMorningMarket(_id: SceneId, meta?: SceneManifestEntry): World {
  const res = createTracker();
  const w = buildStreet('night');
  const s = w.scene;
  const baseDispose = w.dispose;

  stripSceneLights(s, true);
  applyAtmosphere(s, 'day_spring', { far: meta?.camFar ?? 220 });
  tintGlowMeshes(s, 0x42505c);

  // Market stalls along inner north sidewalk (clear of walking lanes z=-3.5..-2.9 & parked bikes z=-2.6)
  const stallSpots = [
    { x: -25.4, z: -1.3, ry: 0 },
    { x: -22.2, z: -1.3, ry: 0 },
    { x: 0.8, z: -1.3, ry: 0 },
    { x: 3.8, z: -1.3, ry: 0 },
    { x: 8.6, z: -1.3, ry: 0 },
    { x: 24.4, z: -1.3, ry: 0 },
    { x: 28.0, z: -1.3, ry: 0 },
    { x: 31.4, z: -1.3, ry: 0 },
  ];
  s.add(trackMesh(res, instanced(mergeParts(marketStall()), litMat(), stallSpots)));

  // Soy-milk pots, extra wicker cabbage baskets, cloth awning canopies, parked tricycle carts
  const extra: Part[] = [
    ...place(tricycle(), 19.4, -5.8, 2.8),
    ...place(tricycle(), -27.5, -5.8, 0.25),
  ];

  // Cloth awning canopies over grain queue ([-23.8, -1.5]) and curb soy-milk counter ([1.8, -4.3])
  for (const [ax, az, aw, ad, col] of [
    [-23.8, -1.5, 5.8, 2.5, 0x35628e],
    [1.8, -4.3, 4.8, 2.2, 0x9b4432],
  ] as [number, number, number, number, number][]) {
    extra.push(
      { p: [ax, 2.56, az], s: [aw, 0.06, ad], c: col, rx: -0.14 },
      { p: [ax - aw * 0.46, 1.24, az - ad * 0.44], s: [0.06, 2.48, 0.06], c: 0x8f7a52, cyl: true, seg: 6 },
      { p: [ax + aw * 0.46, 1.24, az - ad * 0.44], s: [0.06, 2.48, 0.06], c: 0x8f7a52, cyl: true, seg: 6 },
      { p: [ax - aw * 0.46, 1.38, az + ad * 0.44], s: [0.06, 2.76, 0.06], c: 0x8f7a52, cyl: true, seg: 6 },
      { p: [ax + aw * 0.46, 1.38, az + ad * 0.44], s: [0.06, 2.76, 0.06], c: 0x8f7a52, cyl: true, seg: 6 },
    );
  }

  // Enamel/aluminum soy-milk pots (豆漿桶) & ladles beside breakfast counter & grain canopy
  for (const [px, pz] of [[0.9, -4.3], [2.7, -4.3], [-23.8, -2.0]] as [number, number][]) {
    extra.push(
      { p: [px, 0.36, pz], s: [0.78, 0.72, 0.56], c: 0x6b4b2e },
      { p: [px - 0.14, 0.94, pz], s: [0.38, 0.44, 0.38], c: C.enamel, cyl: true, seg: 10 },
      { p: [px - 0.14, 1.15, pz], s: [0.40, 0.04, 0.40], c: 0x26446e, cyl: true, seg: 10 },
      { p: [px + 0.18, 0.90, pz], s: [0.30, 0.34, 0.30], c: 0xbec4c8, cyl: true, seg: 10 },
      { p: [px - 0.04, 1.22, pz + 0.08], s: [0.025, 0.24, 0.025], c: C.chrome, rz: -0.45 },
    );
  }

  // Extra wicker cabbage baskets along market curb & stalls
  for (const [bx, bz] of [[-25.4, -2.0], [-22.2, -2.0], [24.4, -2.0], [28.0, -2.0]] as [number, number][]) {
    extra.push(
      { p: [bx, 0.16, bz], s: [0.54, 0.32, 0.54], c: 0x9b7a4c, cyl: true, seg: 10, top: 1.25 },
      { p: [bx - 0.10, 0.32, bz], s: [0.22, 0.20, 0.22], c: 0x86a45c, sphere: true, detail: 0 },
      { p: [bx + 0.10, 0.32, bz + 0.04], s: [0.20, 0.18, 0.20], c: 0xa2bd74, sphere: true, detail: 0 },
    );
  }

  // Grain queue wooden sign stand frame
  extra.push(
    { p: [-21.5, 0.95, -2.1], s: [0.08, 1.9, 0.08], c: C.darkWood, ry: 0.22 },
    { p: [-21.5, 1.50, -2.12], s: [1.56, 0.86, 0.06], c: 0x3b2a1c, ry: 0.22 },
  );
  trackLayered(res, s, extra);

  // Grain queue signboard (markSceneOwned), aligned flush with rotated wooden backing at [-21.5, 1.50, -2.12]
  const signAngle = 0.22;
  addOwnedSignPlane(
    res,
    s,
    1.48,
    0.78,
    -21.5 - Math.sin(signAngle) * 0.045,
    1.50,
    -2.12 - Math.cos(signAngle) * 0.045,
    Math.PI + signAngle,
    512,
    256,
    g => {
    g.fillStyle = '#e8e0cf';
    g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#7d2a22';
    g.lineWidth = 8;
    g.strokeRect(8, 8, 496, 240);
    g.fillStyle = '#7d2a22';
    g.font = 'bold 54px "Noto Serif CJK TC",serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('糧油定量供應處', 256, 92);
    g.fillStyle = '#222426';
    g.font = 'bold 38px "Noto Sans CJK TC",sans-serif';
    g.fillText('憑本排隊・每人限購', 256, 178);
  });

  // Queuing crowdPersonLod neighbors (clear of walking path z=-3.5..-2.9) + parked bikeLod bicycles
  const queueSpots = [
    { x: -25.4, z: -2.2, ry: 0.2 },
    { x: -24.6, z: -2.1, ry: 0.1 },
    { x: -23.7, z: -2.2, ry: 0.0 },
    { x: -22.8, z: -2.2, ry: -0.1 },
    { x: -21.9, z: -2.1, ry: -0.2 },
    { x: -20.8, z: -2.0, ry: -0.4 },
    { x: -0.2, z: -4.4, ry: H },
    { x: 0.5, z: -2.1, ry: 0.1 },
    { x: 2.1, z: -2.1, ry: -0.1 },
    { x: 3.7, z: -2.1, ry: 0.2 },
    { x: 8.6, z: -2.1, ry: 0.0 },
    { x: 24.1, z: -2.1, ry: 0.1 },
    { x: 25.4, z: -2.1, ry: -0.1 },
    { x: 27.8, z: -2.1, ry: 0.0 },
    { x: 29.1, z: -2.1, ry: 0.2 },
  ];
  const qMesh = trackMesh(res, instanced(mergeParts(crowdPersonLod(0xf4f2ec)), tintLitMat(), queueSpots));
  const qCols = [C.navy, C.khaki, 0x5c646c, 0x7c5448, 0x4b5c4a, 0x867d6a];
  queueSpots.forEach((_, i) => qMesh.setColorAt(i, new THREE.Color(qCols[i % qCols.length]!)));
  s.add(qMesh);

  const marketBikes = [
    { x: -29.2, z: -4.6, ry: H },
    { x: -26.4, z: -4.6, ry: H + 0.15 },
    { x: -16.8, z: -4.6, ry: -H },
    { x: -14.2, z: -4.6, ry: H },
    { x: 5.2, z: -4.6, ry: -H },
    { x: 10.2, z: -4.6, ry: H },
    { x: 21.8, z: -4.6, ry: H },
    { x: 29.2, z: -4.6, ry: -H },
  ];
  s.add(trackMesh(res, instanced(mergeParts(bikeLod()), litMat(), marketBikes)));

  w.id = 'morning_market';
  w.bounds = meta?.bounds ?? [-34, 34, -16, 8];
  w.spawn = meta?.spawn ?? [-12, -3];
  w.camDist = meta?.cam?.dist ?? 11;
  w.atmosphere = 'day_spring';
  w.colliders = [
    ...(w.colliders ?? []),
    { kind: 'box', minX: 0.75, maxX: 2.85, minZ: -4.6, maxZ: -4.0 },
  ];
  w.dispose = () => {
    baseDispose?.();
    disposeTracked(res);
  };
  return w;
}

/** 4a. March Day Variant (crisp May Fourth / April 27 spring daylight + date-authentic procession banners). */
function buildMarchDay(_id: SceneId, meta?: SceneManifestEntry): World {
  const res = createTracker();
  const w = buildStreet('march', 'day0427');
  const s = w.scene;
  const baseDispose = w.dispose;

  stripSceneLights(s, true);
  applyAtmosphere(s, 'day_spring', { far: meta?.camFar ?? 220 });
  tintGlowMeshes(s, 0x465460);

  // Overhead May-Fourth curb banners positioned outside the -5.82/-14.18 picket lanes (while keeping j4_pt_may4_overhead visible)
  const banners: [number, number, number, string, string, string][] = [
    [-22, 4.2, -4.95, '弘揚五四精神・說真話', '#b82820', '#fbf4e2'],
    [-2, 4.3, -15.05, '新聞必須真實・和平請願', '#f4f0e4', '#1a1c1e'],
    [18, 4.2, -4.95, '四月之春・理性守紀', '#b82820', '#fbf4e2'],
  ];
  const poles: Part[] = [];
  for (const [bx, by, bz, text, bg, fg] of banners) {
    const poleH = by + 0.55;
    poles.push(
      { p: [bx - 2.35, poleH * 0.5, bz], s: [0.06, poleH, 0.06], c: 0x8f7a52, cyl: true, seg: 6 },
      { p: [bx + 2.35, poleH * 0.5, bz], s: [0.06, poleH, 0.06], c: 0x8f7a52, cyl: true, seg: 6 },
    );
    addOwnedSignPlane(res, s, 4.6, 0.96, bx, by, bz, Math.PI, 640, 128, g => {
      g.fillStyle = bg;
      g.fillRect(0, 0, 640, 128);
      g.strokeStyle = fg;
      g.lineWidth = 4;
      g.strokeRect(5, 5, 630, 118);
      g.fillStyle = fg;
      g.font = 'bold 58px "Noto Serif CJK TC","Noto Sans CJK TC",serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, 320, 66);
    }, true);
  }
  trackLayered(res, s, poles);

  w.id = 'march_day';
  w.bounds = meta?.bounds ?? [-40, 40, -18, 8];
  w.spawn = meta?.spawn ?? [-30, -6];
  w.atmosphere = 'day_spring';
  w.dispose = () => {
    baseDispose?.();
    disposeTracked(res);
  };
  return w;
}

/** 4b. Chang'an Rain Variant (wraps LOD-reduced buildChangan('night'), wet shininess, overcast rain). */
function buildChanganRain(_id: SceneId, meta?: SceneManifestEntry): World {
  const res = createTracker();
  const w = buildChangan('night');
  const s = w.scene;
  const baseDispose = w.dispose;
  const baseUpdate = w.update.bind(w);

  stripSceneLights(s, false);
  applyAtmosphere(s, 'rain_overcast', { near: 42, far: meta?.camFar ?? 950 });

  // Soften dry night spotlights/pointlights and raise wet road/plaza specular shininess
  s.traverse(obj => {
    const l = obj as THREE.Light;
    if (l.isLight && l.name !== '__atmo_hemi' && l.name !== '__atmo_dir') {
      if ((l as THREE.PointLight).isPointLight) {
        l.intensity *= 0.45;
      } else if ((l as THREE.SpotLight).isSpotLight) {
        l.intensity *= 0.35;
      }
    }

    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    if (mesh.material instanceof THREE.MeshLambertMaterial && mesh.material.map) {
      const oldMat = mesh.material;
      const wetMat = new THREE.MeshPhongMaterial({
        map: oldMat.map,
        vertexColors: oldMat.vertexColors,
        specular: new THREE.Color(0x6e8296),
        shininess: 72,
        fog: true,
      });
      res.mats.push(wetMat);
      mesh.material = wetMat;
      oldMat.dispose();
    } else if (mesh.material instanceof THREE.MeshPhongMaterial) {
      mesh.material.shininess = Math.max(mesh.material.shininess, 46);
      mesh.material.specular.setHex(0x4c5a68);
    } else if (
      mesh.material instanceof THREE.MeshBasicMaterial &&
      !mesh.material.vertexColors &&
      mesh.material.transparent
    ) {
      // Cool wet Huadeng ground light puddle sheen
      mesh.material.color.setHex(0xb8c8d8);
      mesh.material.opacity = 0.07;
    }
  });
  tintGlowMeshes(s, 0xc8d2dc);

  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent);
  const rain: RainSystem = makeRainSystem(isMobile);
  let rainCamX = meta?.spawn?.[0] ?? -45;
  let rainCamZ = meta?.spawn?.[1] ?? -86;
  rain.mesh.onBeforeRender = (_r, _sc, cam) => {
    if (Math.hypot(cam.position.x - rainCamX, cam.position.z - rainCamZ) > 0.5) {
      rainCamX = cam.position.x;
      rainCamZ = cam.position.z;
      rain.update(0, rainCamX, rainCamZ);
    }
  };
  s.add(rain.mesh);

  w.id = 'changan_rain';
  w.spawn = meta?.spawn ?? [-45, -86];
  w.bounds = meta?.bounds ?? [-200, 200, -300, -38];
  w.camDist = meta?.cam?.dist ?? 26;
  w.atmosphere = 'rain_overcast';
  w.update = (dt, t) => {
    baseUpdate(dt, t);
    rain.update(dt, rainCamX, rainCamZ);
  };
  w.dispose = () => {
    rain.mesh.parent?.remove(rain.mesh);
    rain.dispose();
    baseDispose?.();
    disposeTracked(res);
  };
  return w;
}

/** 4c. Courtyard Day Variant (warm morning spring sunlight through open street gate). */
function buildCourtyardDay(_id: SceneId, meta?: SceneManifestEntry): World {
  const res = createTracker();
  const w = buildCourtyard();
  const s = w.scene;
  const baseDispose = w.dispose;

  stripSceneLights(s, true);
  applyAtmosphere(s, 'day_spring', { far: meta?.camFar ?? 160 });
  tintGlowMeshes(s, 0x4a5662);

  // Soft morning sun shaft entering through open south street gate
  const gateSun = new THREE.DirectionalLight(0xffe9c4, 0.45);
  gateSun.position.set(8, 14, -24);
  s.add(gateSun);

  // Morning courtyard details: clay flowerpots by steps, resting sweep broom & perched pigeons
  const morningProps: Part[] = [
    { p: [-1.8, 0.20, 6.2], s: [0.30, 0.34, 0.30], c: 0x8e4c34, cyl: true, seg: 8, top: 1.25 },
    { p: [-1.8, 0.44, 6.2], s: [0.38, 0.30, 0.38], c: 0x3b6032, sphere: true, detail: 0 },
    { p: [1.8, 0.20, 6.2], s: [0.30, 0.34, 0.30], c: 0x8e4c34, cyl: true, seg: 8, top: 1.25 },
    { p: [1.8, 0.44, 6.2], s: [0.38, 0.30, 0.38], c: 0x486e3b, sphere: true, detail: 0 },
    // Bamboo broom leaning beside gate
    { p: [1.9, 0.65, -12.0], s: [0.04, 1.35, 0.04], c: 0x8f7a52, cyl: true, seg: 5, rz: 0.24 },
    { p: [2.08, 0.14, -12.0], s: [0.28, 0.24, 0.08], c: 0x9b824a, wedge: true, rz: 0.24 },
    // Two morning pigeons on stone threshold
    { p: [-2.4, 0.12, -3.4], s: [0.14, 0.16, 0.22], c: 0xe6e4de, sphere: true, detail: 0 },
    { p: [-2.0, 0.12, -3.7], s: [0.14, 0.16, 0.22], c: 0x7b828a, sphere: true, detail: 0 },
  ];
  trackLayered(res, s, morningProps);

  w.id = 'courtyard_day';
  w.spawn = meta?.spawn ?? [0, 3];
  w.bounds = meta?.bounds ?? [-15, 15, -16, 12];
  w.camDist = meta?.cam?.dist ?? 11;
  w.atmosphere = 'day_spring';
  w.dispose = () => {
    baseDispose?.();
    disposeTracked(res);
  };
  return w;
}

/** 4d. Street Aftermath Variant (misty June 5 morning, dimmed bulbs, shuttered shopfronts). */
function buildStreetAftermath(_id: SceneId, meta?: SceneManifestEntry): World {
  const res = createTracker();
  const w = buildStreet('night');
  const s = w.scene;
  const baseDispose = w.dispose;

  stripSceneLights(s, true);
  applyAtmosphere(s, 'aftermath', { near: 12, far: meta?.camFar ?? 220 });
  tintGlowMeshes(s, 0x222930);

  // Shut shopfront shutters across all ground-floor storefronts & newspaper kiosk
  const shutters: Part[] = [];
  const timber = 0x3b2c1e;
  const slatBar = 0x232528;
  const steelShutter = 0x4b4f54;

  // 1. West Hardware Block (x = -30, frontZ = 0.4)
  for (const [wx, wSpan, hSpan, yPos] of [
    [-33.6, 3.6, 1.85, 1.95],
    [-26.4, 3.6, 1.85, 1.95],
    [-30.0, 1.7, 2.55, 1.45],
  ] as [number, number, number, number][]) {
    shutters.push(
      { p: [wx, yPos, 0.24], s: [wSpan, hSpan, 0.08], c: timber },
      { p: [wx, yPos, 0.19], s: [wSpan + 0.04, 0.07, 0.04], c: slatBar },
    );
  }

  // 2. State Food Store (x = -15, frontZ = 2.2)
  shutters.push(
    { p: [-17.3, 1.95, 1.98], s: [5.35, 1.75, 0.08], c: timber },
    { p: [-17.3, 1.95, 1.93], s: [5.40, 0.07, 0.04], c: slatBar },
    { p: [-12.0, 1.45, 1.96], s: [1.90, 2.65, 0.08], c: timber },
    { p: [-12.0, 1.45, 1.91], s: [1.95, 0.07, 0.04], c: slatBar },
  );

  // 3. Red Star Restaurant (x = -1, rFront = 0.4)
  for (const wx of [-4.6, -0.8, 2.6]) {
    shutters.push(
      { p: [wx, 1.65, 0.24], s: [2.45, 1.85, 0.08], c: timber },
      { p: [wx, 1.65, 0.19], s: [2.50, 0.07, 0.04], c: slatBar },
    );
  }

  // 4. State Barber Shop (x = 8.0, bFront = 0.4) — corrugated steel rolling shutters
  for (const [bx, bw, bh, by] of [
    [7.35, 3.05, 1.95, 1.95],
    [9.55, 1.25, 2.65, 1.45],
  ] as [number, number, number, number][]) {
    shutters.push({ p: [bx, by, 0.25], s: [bw, bh, 0.07], c: steelShutter });
    for (let sy = by - bh * 0.35; sy <= by + bh * 0.35; sy += 0.36) {
      shutters.push({ p: [bx, sy, 0.205], s: [bw + 0.02, 0.04, 0.03], c: 0x35383c });
    }
  }

  // 5. East Department Store (x = 26, frontZ = 0.5) — corrugated steel rolling shutters
  for (const [dx, dw, dh, dy] of [
    [21.2, 3.75, 1.85, 1.85],
    [30.8, 3.75, 1.85, 1.85],
    [26.0, 2.35, 2.75, 1.45],
  ] as [number, number, number, number][]) {
    shutters.push({ p: [dx, dy, 0.34], s: [dw, dh, 0.07], c: steelShutter });
    for (let sy = dy - dh * 0.35; sy <= dy + dh * 0.35; sy += 0.36) {
      shutters.push({ p: [dx, sy, 0.295], s: [dw + 0.02, 0.04, 0.03], c: 0x35383c });
    }
  }

  // 6. Green Newspaper Kiosk (kx = -6, kz = -1.5) — plank shutters & iron latch bar
  for (let p = 0; p < 5; p++) {
    shutters.push({ p: [-6 - 0.84 + p * 0.42, 1.52, -2.43], s: [0.39, 0.96, 0.06], c: timber });
  }
  shutters.push({ p: [-6, 1.52, -2.47], s: [2.05, 0.06, 0.03], c: slatBar });

  trackLayered(res, s, shutters);

  w.id = 'street_aftermath';
  w.spawn = meta?.spawn ?? [-14, -4];
  w.bounds = meta?.bounds ?? [-40, 40, -18, 8];
  w.camDist = meta?.cam?.dist ?? 11;
  w.atmosphere = 'aftermath';
  w.dispose = () => {
    baseDispose?.();
    disposeTracked(res);
  };
  return w;
}

/** Register all Wave 2 Resident, Hospital & Atmosphere Variant 3D scene builders. */
export function registerResidentSets(): void {
  registerSceneBuilder('hospital_gate', buildHospitalGate);
  registerSceneBuilder('siheyuan_room', buildSiheyuanRoom);
  registerSceneBuilder('morning_market', buildMorningMarket);
  registerSceneBuilder('march_day', buildMarchDay);
  registerSceneBuilder('changan_rain', buildChanganRain);
  registerSceneBuilder('courtyard_day', buildCourtyardDay);
  registerSceneBuilder('street_aftermath', buildStreetAftermath);
}
