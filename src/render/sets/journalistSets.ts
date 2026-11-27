import * as THREE from 'three';
import {
  C,
  Part,
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
  bikeLod,
  cameraTripod,
  crowdPersonLod,
  lampHead,
  lampPole,
  newsTelex,
  pressDesk,
  sitPersonLod,
  trolleyWindows,
  trolleybus,
} from '../props';
import { addRealisticTrees } from '../foliage';
import { stoneLion } from '../campusArch';
import { huadengGlobes, huadengPole, imperialRoof } from '../imperial';
import {
  SharedTexPool,
  applyAtmosphere,
  asphaltRoadTex,
  campusPathTex,
  granitePavingTex,
} from '../materials';
import { isSharedWallTexture } from '../wallTextures';
import { markSceneOwned, registerSceneBuilder, type AABB6, type World } from '../scenes';
import type { AtmospherePreset, SceneId, SceneManifestEntry } from '../../types';

const H = Math.PI / 2;

const BALCONY_BOUNDS: [number, number, number, number] = [-10, 10, -4, 7];
const NEWSROOM_BOUNDS: [number, number, number, number] = [-13, 13, -8, 8];
const OVERPASS_BOUNDS: [number, number, number, number] = [-44, 44, -18, 12];
const XINHUA_BOUNDS: [number, number, number, number] = [-45, 45, -24, 6];

function resolveCam(
  meta: SceneManifestEntry | undefined,
  fallbackDist: number,
  fallbackCam: { h: number; ahead: number; y: number },
): { camDist: number; cam: { h: number; ahead: number; y: number } } {
  return {
    camDist: meta?.cam?.dist ?? fallbackDist,
    cam: {
      h: meta?.cam?.h ?? fallbackCam.h,
      ahead: meta?.cam?.ahead ?? fallbackCam.ahead,
      y: meta?.cam?.y ?? fallbackCam.y,
    },
  };
}

function addPointLight(
  s: THREE.Scene,
  color: number,
  intensity: number,
  distance: number,
  x: number,
  y: number,
  z: number,
  decay = 1.6,
): THREE.PointLight {
  const l = new THREE.PointLight(color, intensity, distance, decay);
  l.position.set(x, y, z);
  s.add(l);
  return l;
}

function addSignPlane(
  s: THREE.Scene,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  ry: number,
  texW: number,
  texH: number,
  draw: (g: CanvasRenderingContext2D) => void,
  doubleSided = false,
): THREE.Mesh {
  const tex = markSceneOwned(textTexture(texW, texH, draw));
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    fog: true,
    side: THREE.FrontSide,
  });
  const geo = doubleSided ? makeTwoSidedPlaneGeo(w, h) : new THREE.PlaneGeometry(w, h);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  s.add(m);
  return m;
}

function simpleTextSign(
  s: THREE.Scene,
  text: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  bg: string,
  fg: string,
  ry = Math.PI,
  border?: string,
  doubleSided = false,
): THREE.Mesh {
  return addSignPlane(
    s,
    x,
    y,
    z,
    w,
    h,
    ry,
    512,
    128,
    g => {
      g.fillStyle = bg;
      g.fillRect(0, 0, 512, 128);
      if (border) {
        g.strokeStyle = border;
        g.lineWidth = 6;
        g.strokeRect(6, 6, 500, 116);
      }
      g.fillStyle = fg;
      g.font = 'bold 66px "Noto Serif CJK TC","Noto Sans CJK TC","PingFang TC",serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, 256, 66);
    },
    doubleSided,
  );
}

/** Overhead trolleybus catenary wires + span poles along X. */
function wiresParts(
  x0: number,
  x1: number,
  zs: number[],
  poleZa: number,
  poleZb: number,
  step: number,
  yOff = 0,
): Part[] {
  const p: Part[] = [];
  for (const z of zs) {
    p.push({ p: [(x0 + x1) / 2, yOff + 5.9, z], s: [x1 - x0, 0.03, 0.03], c: 0x222222 });
  }
  for (let x = x0; x <= x1; x += step) {
    p.push(
      { p: [x, yOff + 3.1, poleZa], s: [0.20, 6.2, 0.20], c: 0x4a4a46, cyl: true, seg: 6 },
      { p: [x, yOff + 3.1, poleZb], s: [0.20, 6.2, 0.20], c: 0x4a4a46, cyl: true, seg: 6 },
      {
        p: [x, yOff + 6.0, (poleZa + poleZb) / 2],
        s: [0.03, 0.03, Math.abs(poleZa - poleZb)],
        c: 0x222222,
      },
    );
  }
  return p;
}

/** Mourning wreath (悼念花圈) on wooden easel stand facing -z. */
function mourningWreathParts(x: number, z: number, ry = 0): Part[] {
  const local: Part[] = [
    { p: [-0.18, 0.36, 0.04], s: [0.035, 0.74, 0.035], c: C.wood, rx: 0.18, rz: -0.14 },
    { p: [0.18, 0.36, 0.04], s: [0.035, 0.74, 0.035], c: C.wood, rx: 0.18, rz: 0.14 },
    { p: [0, 0.36, 0.22], s: [0.035, 0.72, 0.035], c: C.darkWood, rx: -0.35 },
    { p: [0, 0.44, 0], s: [0.64, 0.64, 0.16], c: 0x3b4d34, torus: true, tube: 0.11, seg: 14, detail: 5, rx: -0.22 },
    { p: [0, 0.70, -0.10], s: [0.14, 0.08, 0.05], c: 0x1a1a1c },
    { p: [-0.07, 0.46, -0.08], s: [0.06, 0.44, 0.02], c: 0x1a1a1c, rz: 0.12, rx: -0.22 },
    { p: [0.07, 0.46, -0.08], s: [0.06, 0.44, 0.02], c: 0xebe7dc, rz: -0.12, rx: -0.22 },
  ];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rx = Math.cos(a) * 0.30;
    const ryOff = Math.sin(a) * 0.30 * Math.cos(-0.22);
    const rzOff = -Math.sin(a) * 0.30 * Math.sin(-0.22);
    local.push({
      p: [rx, 0.44 + ryOff, rzOff - 0.04],
      s: [0.13, 0.13, 0.09],
      c: i % 3 === 0 ? 0xead888 : 0xf4f0e4,
      sphere: true,
      detail: 0,
    });
  }
  return place(local, x, z, ry);
}

/** Framed multi-pane window on an X- or Z-aligned facade. */
function windowParts(
  stat: Part[],
  glow: Part[],
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  axis: 'x' | 'z',
  faceDir: -1 | 1,
  lit: boolean,
  warmTone = true,
): void {
  const paneCol = lit ? (warmTone ? C.window : 0xeef0dc) : 0x1a2028;
  const target = lit ? glow : stat;
  if (axis === 'z') {
    stat.push(
      { p: [x, y - h / 2 - 0.05, z + faceDir * 0.06], s: [w + 0.22, 0.10, 0.14], c: 0x6f6c64 },
      { p: [x, y + h / 2 + 0.06, z + faceDir * 0.05], s: [w + 0.20, 0.12, 0.12], c: 0x5c5952 },
      { p: [x, y, z + faceDir * 0.02], s: [w, h, 0.03], c: 0x2d3238 },
      { p: [x, y, z + faceDir * 0.08], s: [0.05, h - 0.08, 0.02], c: 0xc8c3b6 },
      { p: [x, y + 0.08, z + faceDir * 0.08], s: [w - 0.08, 0.045, 0.02], c: 0xc8c3b6 },
    );
    target.push({ p: [x, y, z + faceDir * 0.055], s: [w - 0.14, h - 0.14, 0.025], c: paneCol, noAO: lit });
  } else {
    stat.push(
      { p: [x + faceDir * 0.06, y - h / 2 - 0.05, z], s: [0.14, 0.10, w + 0.22], c: 0x6f6c64 },
      { p: [x + faceDir * 0.05, y + h / 2 + 0.06, z], s: [0.12, 0.12, w + 0.20], c: 0x5c5952 },
      { p: [x + faceDir * 0.02, y, z], s: [0.03, h, w], c: 0x2d3238 },
      { p: [x + faceDir * 0.08, y, z], s: [0.02, h - 0.08, 0.05], c: 0xc8c3b6 },
      { p: [x + faceDir * 0.08, y + 0.08, z], s: [0.02, 0.045, w - 0.08], c: 0xc8c3b6 },
    );
    target.push({ p: [x + faceDir * 0.055, y, z], s: [0.025, h - 0.14, w - 0.14], c: paneCol, noAO: lit });
  }
}

/** 1980s residential balcony with concrete slab, iron guardrail & laundry/flowerpot. */
function apartmentBalconyParts(
  stat: Part[],
  x: number,
  y: number,
  zFront: number,
  w: number,
  face: -1 | 1,
  r: () => number,
): void {
  const bz = zFront + face * 0.48;
  const railZ = zFront + face * 0.92;
  stat.push(
    { p: [x, y - 0.72, bz], s: [w, 0.14, 0.96], c: 0x726e65 },
    { p: [x, y - 0.24, railZ], s: [w, 0.05, 0.05], c: 0x2d3236 },
  );
  for (let i = 0; i <= 4; i++) {
    const px = x - w / 2 + 0.08 + (i * (w - 0.16)) / 4;
    stat.push({ p: [px, y - 0.46, railZ], s: [0.04, 0.48, 0.04], c: 0x2d3236 });
  }
  if (r() < 0.75) {
    stat.push(
      { p: [x - w * 0.26, y - 0.55, bz + face * 0.18], s: [0.22, 0.20, 0.22], c: 0x8d4b32, cyl: true, seg: 6, top: 1.2 },
      { p: [x - w * 0.26, y - 0.38, bz + face * 0.18], s: [0.26, 0.22, 0.26], c: 0x325228, sphere: true, detail: 0 },
    );
  }
  if (r() < 0.7) {
    const laundryCols = [0xe8e2d4, 0x4b6a8a, 0x5c6b4d, 0x9c4236, 0xc2b79c];
    stat.push({ p: [x, y + 0.32, bz + face * 0.18], s: [w - 0.3, 0.02, 0.02], c: 0x9c988e });
    for (let k = -1; k <= 1; k++) {
      if (r() < 0.7) {
        stat.push({
          p: [x + k * 0.62, y + 0.04, bz + face * 0.18],
          s: [0.40, 0.52, 0.04],
          c: laundryCols[Math.floor(r() * laundryCols.length)],
        });
      }
    }
  }
}

function shouldDisposeLocalTexture(tex: unknown): tex is THREE.Texture {
  if (!tex || typeof tex !== 'object') return false;
  const t = tex as THREE.Texture;
  if (!t.isTexture) return false;
  if (t.userData?.shared || t.userData?.pooled) return false;
  if (isSharedWallTexture(t)) return false;
  return Boolean(t.userData?.sceneOwned);
}

/** Build an idempotent world.dispose() that cleans SharedTexPool scopes and scene-owned assets. */
function makeWorldDispose(scene: THREE.Scene, poolKeys: string[]): () => void {
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;

    const atmoKey = scene.userData?.__atmoSkyKey as string | undefined;
    if (atmoKey && !poolKeys.includes(atmoKey)) {
      SharedTexPool.release(atmoKey);
    }
    if (scene.userData) delete scene.userData.__atmoSkyKey;
    SharedTexPool.releaseAll(poolKeys);

    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();
    const disposedTexs = new Set<THREE.Texture>();

    scene.traverse(node => {
      if (node.userData?.persistent || node.userData?.shared) return;
      const meshLike = node as THREE.Mesh;
      const geo = meshLike.geometry;
      if (geo && geo.isBufferGeometry && !geo.userData?.shared && !disposedGeos.has(geo)) {
        disposedGeos.add(geo);
        geo.dispose();
      }
      const matOrList = meshLike.material;
      if (matOrList) {
        const mats = Array.isArray(matOrList) ? matOrList : [matOrList];
        for (const m of mats) {
          if (m && !m.userData?.shared && !disposedMats.has(m)) {
            disposedMats.add(m);
            for (const val of Object.values(m)) {
              if (shouldDisposeLocalTexture(val) && !disposedTexs.has(val)) {
                disposedTexs.add(val);
                val.dispose();
              }
            }
            m.dispose();
          }
        }
      }
      if ((node as THREE.InstancedMesh).isInstancedMesh) {
        (node as THREE.InstancedMesh).dispose?.();
      }
      const lightLike = node as THREE.DirectionalLight | THREE.SpotLight;
      if (lightLike.isLight && lightLike.shadow) {
        lightLike.shadow.dispose();
      }
    });
    scene.clear();
  };
}

/**
 * Distant Chang'an Avenue & Tiananmen Square sculpted silhouette strip below 10F Beijing Hotel Balcony.
 * Tuned to 10,000–12,000 triangles total (Tiananmen, Monument, Great Hall, Museum, skyline & poplar treeline).
 */
function buildChangAnSilhouetteStrip(
  s: THREE.Scene,
  stat: Part[],
  glow: Part[],
  groundY: number,
): void {
  // Textured Chang'an Avenue roadbed + Square granite plaza at groundY = -32
  const avePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(540, 52),
    new THREE.MeshLambertMaterial({ map: asphaltRoadTex(36, 4) }),
  );
  avePlane.rotation.x = -Math.PI / 2;
  avePlane.position.set(-140, groundY + 0.02, -68);
  s.add(avePlane);

  const sqPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(170, 260),
    new THREE.MeshLambertMaterial({ map: granitePavingTex(18, 28) }),
  );
  sqPlane.rotation.x = -Math.PI / 2;
  sqPlane.position.set(-215, groundY + 0.02, -224);
  s.add(sqPlane);

  // Avenue sub-base, median stripes, curbs & blue-and-white guardrails
  stat.push(
    { p: [-140, groundY - 0.12, -165], s: [640, 0.24, 420], c: 0x3b3833 },
    { p: [-140, groundY + 0.03, -68], s: [540, 0.02, 0.32], c: 0xc4b05a, noAO: true },
    { p: [-140, groundY + 0.04, -42], s: [540, 0.08, 0.35], c: 0x868176 },
    { p: [-140, groundY + 0.04, -94], s: [540, 0.08, 0.35], c: 0x868176 },
  );
  for (let x = -380; x <= 100; x += 14) {
    stat.push(
      { p: [x, groundY + 0.03, -55], s: [5.2, 0.02, 0.18], c: 0x9b978c, noAO: true },
      { p: [x, groundY + 0.03, -81], s: [5.2, 0.02, 0.18], c: 0x9b978c, noAO: true },
    );
  }
  for (const gz of [-46, -90]) {
    stat.push({ p: [-140, groundY + 0.52, gz], s: [520, 0.08, 0.08], c: 0x4c7aa8 });
    for (let x = -380; x <= 95; x += 16) {
      stat.push({ p: [x, groundY + 0.30, gz], s: [0.08, 0.56, 0.08], c: 0x4c7aa8 });
    }
  }

  // 1. Tiananmen Gate Profile at [-190, groundY, -24] (facing -Z across avenue)
  const tx = -190;
  const tz = -24;
  stat.push(
    { p: [tx, groundY + 0.6, tz], s: [67, 1.2, 36], c: 0x8d887d, tex: 'ashlarStone' },
    { p: [tx, groundY + 6.8, tz], s: [65.5, 11.8, 35], c: 0x8e2b22, tex: 'palaceWall' },
    { p: [tx, groundY + 13.1, tz], s: [66.6, 0.6, 36.2], c: 0xd9d5ca },
    // Flanking red palace walls + Golden Water Bridge strip
    { p: [tx - 98, groundY + 4.4, tz + 6], s: [130, 8.8, 4.5], c: 0x8a2820, tex: 'palaceWall' },
    { p: [tx + 98, groundY + 4.4, tz + 6], s: [130, 8.8, 4.5], c: 0x8a2820, tex: 'palaceWall' },
    { p: [tx - 98, groundY + 9.0, tz + 6], s: [131, 0.55, 5.2], c: 0xd4a028 },
    { p: [tx + 98, groundY + 9.0, tz + 6], s: [131, 0.55, 5.2], c: 0xd4a028 },
    { p: [tx, groundY + 0.08, tz - 15], s: [145, 0.16, 6.2], c: 0x101822 },
    // Upper 9-bay hall + double-tier curved imperial roofs (2 eave meshes = 2,400 tris)
    { p: [tx, groundY + 17.6, tz], s: [52, 7.6, 23], c: 0x8e2b22, tex: 'palaceWall' },
    { p: [tx, groundY + 21.6, tz], s: [54, 0.8, 25], c: 0x245e54 },
    { p: [tx, groundY + 24.3, tz], s: [62, 4.2, 31], c: 0xd4a028, eave: true, curve: 0.18, tex: 'roofTile' },
    { p: [tx, groundY + 27.1, tz], s: [48, 3.4, 19], c: 0x8e2b22, tex: 'palaceWall' },
    { p: [tx, groundY + 28.9, tz], s: [49.4, 0.7, 20.2], c: 0x245e54 },
    { p: [tx, groundY + 31.8, tz], s: [56, 5.2, 27], c: 0xd4a028, eave: true, curve: 0.18, tex: 'roofTile' },
    { p: [tx, groundY + 34.5, tz], s: [27.2, 0.45, 0.65], c: 0xe2b842 },
  );
  // 5 Tiananmen vaulted arch bays + reviewing stands + twin Huabiao columns
  for (const ax of [-23, -12, 0, 12, 23]) {
    stat.push(
      { p: [tx + ax, groundY + 3.4, tz - 17.55], s: [ax === 0 ? 5.0 : 3.6, 6.8, 0.5], c: 0x180f0c },
      { p: [tx + ax, groundY + 6.8, tz - 17.60], s: [ax === 0 ? 5.4 : 3.9, 0.6, 0.4], c: 0xdedad0 },
    );
  }
  for (const sx of [-1, 1]) {
    stat.push(
      { p: [tx + sx * 55, groundY + 2.5, tz - 6], s: [38, 5.0, 16], c: 0x8a2820, tex: 'palaceWall' },
      { p: [tx + sx * 55, groundY + 5.1, tz - 6], s: [38.6, 0.4, 16.4], c: 0xd4a028 },
      { p: [tx + sx * 22, groundY + 6.0, tz - 21], s: [1.1, 12.0, 1.1], c: 0xe6e2d6, cyl: true, seg: 6 },
      { p: [tx + sx * 22, groundY + 9.4, tz - 21], s: [3.2, 0.35, 0.25], c: 0xe6e2d6 },
    );
  }
  simpleTextSign(s, '中華人民共和國萬歲', tx + 19, groundY + 10.6, tz - 17.7, 16.5, 2.0, '#a62118', '#faf2de', Math.PI, '#d4b264');
  simpleTextSign(s, '世界人民大團結萬歲', tx - 19, groundY + 10.6, tz - 17.7, 16.5, 2.0, '#a62118', '#faf2de', Math.PI, '#d4b264');
  glow.push(
    { p: [tx, groundY + 12.2, tz - 17.65], s: [4.8, 6.2, 0.2], c: 0xc8a468, noAO: true },
  );
  for (let i = 0; i < 8; i++) {
    glow.push({ p: [tx - 21 + i * 6.0, groundY + 17.5, tz - 11.7], s: [3.4, 4.2, 0.2], c: 0xffd082, noAO: true });
  }

  // 2. Monument to the People's Heroes at [-215, groundY, -165] (with eave cap = 1,200 tris)
  const mx = -215;
  const mz = -165;
  stat.push(
    { p: [mx, groundY + 0.8, mz], s: [60, 1.6, 46], c: 0xd9d5cb, tex: 'ashlarStone' },
    { p: [mx, groundY + 2.3, mz], s: [44, 1.4, 36], c: 0xe2ded4, tex: 'ashlarStone' },
    { p: [mx, groundY + 5.2, mz], s: [16, 4.4, 18], c: 0xa6a194, tex: 'ashlarStone' },
    { p: [mx, groundY + 22.0, mz], s: [6.2, 29.0, 7.6], c: 0xe0dcd0, tex: 'ashlarStone' },
    { p: [mx, groundY + 37.0, mz], s: [8.0, 1.2, 9.4], c: 0x9c9688 },
    { p: [mx, groundY + 38.9, mz], s: [8.8, 2.4, 10.2], c: 0x8b8578, eave: true, curve: 0.14 },
  );
  glow.push({ p: [mx, groundY + 24.5, mz + 3.9], s: [2.2, 16.5, 0.15], c: 0xf0ca64, noAO: true });

  // 3. Great Hall of the People (West, x=-295, z=-160) & Museum of History (East, x=-135, z=-160)
  const gx = -295;
  const gz = -160;
  stat.push(
    { p: [gx, groundY + 1.5, gz], s: [68, 3.0, 260], c: 0x8a8270, tex: 'ashlarStone' },
    { p: [gx - 4, groundY + 15.0, gz], s: [56, 24.0, 250], c: 0xbcae8f, tex: 'ashlarStone' },
    { p: [gx + 34, groundY + 27.6, gz], s: [16, 1.6, 94], c: 0xd49b28 },
    { p: [gx - 4, groundY + 28.4, gz], s: [60, 1.8, 254], c: 0xd49b28 },
    { p: [gx - 10, groundY + 33.2, gz], s: [36, 7.0, 104], c: 0xa99d80, tex: 'ashlarStone' },
  );
  for (let i = 0; i < 12; i++) {
    const pz = gz - 42 + (i * 84) / 11;
    stat.push({ p: [gx + 38, groundY + 15.2, pz], s: [2.1, 24.0, 2.1], c: 0xe3dac2, cyl: true, seg: 6 });
  }
  glow.push({ p: [gx + 40.5, groundY + 27.8, gz], s: [0.4, 5.2, 5.2], c: 0xe84832, noAO: true });

  const musX = -135;
  stat.push(
    { p: [musX, groundY + 1.5, gz], s: [68, 3.0, 250], c: 0x8a8270, tex: 'ashlarStone' },
    { p: [musX + 4, groundY + 15.0, gz], s: [56, 24.0, 242], c: 0xb7a98a, tex: 'ashlarStone' },
    { p: [musX - 34, groundY + 27.8, gz], s: [16, 1.8, 92], c: 0xd49b28 },
    { p: [musX + 4, groundY + 28.4, gz], s: [60, 1.8, 246], c: 0xd49b28 },
  );
  for (let i = 0; i < 10; i++) {
    const pz = gz - 40 + (i * 80) / 9;
    stat.push({ p: [musX - 38, groundY + 15.2, pz], s: [2.1, 24.0, 2.1], c: 0xe3dac2 });
  }

  // 4. Beijing Hotel 1954 Middle Wing + Chang'an Avenue flanking urban blocks + South Qianmen silhouette
  const urbanBlocks: [number, number, number, number, number, number, boolean][] = [
    [-46, -24, 42, 23, 18, 0xbaa98e, true],
    [-92, -23, 38, 20, 18, 0xa89f8e, true],
    [48, -24, 44, 28, 20, 0xb5aa96, true],
    [-55, -110, 48, 24, 20, 0x8d877c, true],
    [-108, -112, 42, 26, 20, 0x9b9488, true],
    [16, -112, 46, 25, 20, 0x8c867a, true],
    [72, -110, 44, 29, 20, 0x9b9588, true],
    [-215, -285, 76, 30, 58, 0x782b27, false],
    [-215, -345, 48, 36, 22, 0x575a5f, false],
  ];
  for (const [bx, bz, bw, bh, bd, col, winBand] of urbanBlocks) {
    stat.push(
      { p: [bx, groundY + bh * 0.5, bz], s: [bw, bh, bd], c: col, tex: 'plaster' },
      { p: [bx, groundY + bh + 0.5, bz], s: [bw + 1.0, 1.0, bd + 1.0], c: 0x6b675e },
    );
    if (winBand) {
      glow.push({
        p: [bx, groundY + bh * 0.58, bz + (bz < -68 ? bd * 0.51 : -bd * 0.51)],
        s: [bw * 0.72, 1.8, 0.2],
        c: 0xffcf7a,
        noAO: true,
      });
    }
  }
  stat.push(
    { p: [-215, groundY + 32.0, -285], s: [54, 4.4, 42], c: 0xd4a028, roof: true },
    { p: [-215, groundY + 37.5, -345], s: [44, 7.5, 20], c: 0x464a4f, roof: true },
  );

  // 5. Avenue Poplar Treeline (instanced treeLod) + Avenue Huadeng/Street Lamps
  const r = rng(198904);
  const pops: { x: number; z: number; ry: number; s: number }[] = [];
  for (let x = -320; x <= 70; x += 40) {
    if (x > -228 && x < -152) {
      pops.push({ x: x + r() * 2, z: -39, ry: r() * 6, s: 1.2 });
    } else {
      pops.push(
        { x: x + r() * 2, z: -39, ry: r() * 6, s: 1.25 },
        { x: x + r() * 2 + 6, z: -96, ry: r() * 6, s: 1.25 },
      );
    }
  }
  addRealisticTrees(
    s,
    pops.map(p => ({ x: p.x, y: groundY, z: p.z, ry: p.ry, s: p.s })),
    true,
    true,
  );

  // Overhead trolley wires & streetlamp head dots along Chang'an Avenue below
  stat.push(...wiresParts(-360, 80, [-59.4, -60.1, -75.9, -76.6], -44, -92, 44, groundY));
  for (let x = -340; x <= 60; x += 28) {
    stat.push(
      { p: [x, groundY + 3.8, -42.5], s: [0.30, 7.6, 0.30], c: 0x44453d, cyl: true, seg: 6 },
      { p: [x + 14, groundY + 3.8, -93.5], s: [0.30, 7.6, 0.30], c: 0x44453d, cyl: true, seg: 6 },
    );
    glow.push(
      { p: [x, groundY + 7.7, -42.5], s: [0.95, 0.95, 0.95], c: 0xffe49c, sphere: true, detail: 0, noAO: true },
      { p: [x + 14, groundY + 7.7, -93.5], s: [0.95, 0.95, 0.95], c: 0xffe49c, sphere: true, detail: 0, noAO: true },
    );
  }
}

/**
 * 1. Beijing Hotel East Wing 10F Balcony & Adjacent Press Suite (`beijing_hotel_balcony`).
 */
export function buildBeijingHotelBalcony(id: SceneId = 'beijing_hotel_balcony', meta?: SceneManifestEntry): World {
  const { result, keys: poolKeys } = SharedTexPool.captureScope(() => {
    const s = new THREE.Scene();
    const atmo: AtmospherePreset = meta?.atmosphere ?? 'dusk_warm';
    applyAtmosphere(s, atmo, { near: 120, far: meta?.camFar ?? 900 });

    const stat: Part[] = [];
    const glow: Part[] = [];
    const groundY = -32.0;

    // 10F Balcony Terrazzo Floor & Press Suite Wood Floor (player walks cleanly at y = 0)
    stat.push(
      { p: [-3.3, -0.22, 3.4], s: [14.6, 0.44, 15.8], c: 0x9b9488, tex: 'terrazzoFloor' },
      { p: [7.2, -0.22, 3.4], s: [6.8, 0.44, 15.8], c: 0x6b4a2b, tex: 'woodPlank' },
      // Outer cantilevered slab fascia
      { p: [0, -0.24, -4.45], s: [21.4, 0.48, 0.32], c: 0xe2dac9, tex: 'ashlarStone' },
      { p: [-10.55, -0.24, 3.4], s: [0.32, 0.48, 16.0], c: 0xe2dac9, tex: 'ashlarStone' },
    );

    // 10-story Beijing Hotel East Wing exterior drop below the balcony down to groundY = -32
    stat.push(
      { p: [0, -16.2, 3.4], s: [21.0, 31.6, 15.4], c: 0xd6cebc, tex: 'plaster' },
      { p: [0, -28.4, 3.4], s: [21.6, 7.2, 16.0], c: 0xb0a694, tex: 'ashlarStone' },
    );
    for (let fl = 1; fl <= 8; fl++) {
      const fy = -fl * 3.6;
      stat.push(
        { p: [0, fy, -4.55], s: [21.4, 0.68, 1.35], c: 0xe6dfd0, tex: 'plaster' },
        { p: [0, fy + 0.55, -5.15], s: [21.2, 0.08, 0.08], c: 0x3b3f44 },
        { p: [-10.65, fy, 3.4], s: [0.4, 0.68, 15.6], c: 0xe6dfd0, tex: 'plaster' },
      );
      if (fl % 2 === 0) {
        glow.push({ p: [-4.2 + fl * 0.8, fy + 1.4, -4.32], s: [2.8, 1.1, 0.1], c: 0xffd27a, noAO: true });
      }
    }

    // Balcony Concrete Parapet + Dark Iron Guardrail + Corner Column
    stat.push(
      // South parapet (z = -4.35, x = -10.4..3.8)
      { p: [-3.3, 0.28, -4.35], s: [14.2, 0.56, 0.24], c: 0xe2dac9, tex: 'ashlarStone' },
      { p: [-3.3, 0.59, -4.35], s: [14.3, 0.08, 0.30], c: 0xd0c7b2, tex: 'ashlarStone' },
      { p: [-3.3, 1.04, -4.35], s: [14.2, 0.05, 0.06], c: 0x26292e },
      // West parapet (x = -10.35, z = -4.35..11.2)
      { p: [-10.35, 0.28, 3.42], s: [0.24, 0.56, 15.5], c: 0xe2dac9, tex: 'ashlarStone' },
      { p: [-10.35, 0.59, 3.42], s: [0.30, 0.08, 15.6], c: 0xd0c7b2, tex: 'ashlarStone' },
      { p: [-10.35, 1.04, 3.42], s: [0.06, 0.05, 15.5], c: 0x26292e },
    );
    for (let x = -10.0; x <= 3.5; x += 0.65) {
      stat.push({ p: [x, 0.82, -4.35], s: [0.035, 0.42, 0.035], c: 0x26292e });
    }
    for (let z = -3.8; z <= 11.0; z += 0.65) {
      stat.push({ p: [-10.35, 0.82, z], s: [0.035, 0.42, 0.035], c: 0x26292e });
    }
    // Corner ashlar column at [-10.35, -4.35] + cantilevered loggia corner lintel stubs
    stat.push(
      { p: [-10.35, 1.80, -4.35], s: [0.72, 3.60, 0.72], c: 0xe6dfd0, bevel: true, tex: 'ashlarStone' },
      { p: [-10.35, 3.56, -4.35], s: [0.88, 0.24, 0.88], c: 0xd0c7b2, tex: 'ashlarStone' },
      { p: [-8.9, 3.46, -4.35], s: [2.8, 0.32, 0.42], c: 0xe2dac9, tex: 'ashlarStone' },
      { p: [-10.35, 3.46, -2.9], s: [0.42, 0.32, 2.8], c: 0xe2dac9, tex: 'ashlarStone' },
    );

    // Balcony Planter, Tripod Stakeout & Small Journalist Bistro Table
    stat.push(
      { p: [-9.25, 0.26, -3.55], s: [1.45, 0.52, 0.54], c: 0x9c553b, bevel: true },
      { p: [-9.25, 0.53, -3.55], s: [1.30, 0.06, 0.42], c: 0x2b241d },
      { p: [-9.60, 0.70, -3.55], s: [0.44, 0.36, 0.44], c: 0x2f4828, sphere: true, detail: 0 },
      { p: [-9.25, 0.74, -3.55], s: [0.48, 0.42, 0.46], c: 0x3b5832, sphere: true, detail: 0 },
      { p: [-8.88, 0.68, -3.55], s: [0.42, 0.34, 0.42], c: 0x2f4828, sphere: true, detail: 0 },
      // Tripod #1 + 35mm SLR camera overlooking Chang'an Avenue at [1.6, -3.35] (j2_balcony_lens)
      ...place(cameraTripod(), 1.6, -3.35, 0.52),
      // Tripod #2 + telephoto SLR at [-2.9, -3.25] overlooking Square / Chang'an Ave (j5_balcony_lens / j7_balcony_photo)
      ...place(cameraTripod(), -2.9, -3.25, 0.42),
      // Balcony side table + chair + mug + notebook at [-4.8, 1.8]
      { p: [-4.8, 0.70, 1.8], s: [0.74, 0.05, 0.74], c: 0xd6cfc0, cyl: true, seg: 10 },
      { p: [-4.8, 0.35, 1.8], s: [0.06, 0.70, 0.06], c: 0x26292e, cyl: true, seg: 6 },
      { p: [-4.8, 0.04, 1.8], s: [0.48, 0.05, 0.48], c: 0x26292e, cyl: true, seg: 8 },
      { p: [-4.72, 0.75, 1.74], s: [0.24, 0.03, 0.30], c: 0xf4f0e4, ry: 0.25 },
      { p: [-4.98, 0.78, 1.88], s: [0.09, 0.11, 0.09], c: C.enamel, cyl: true, seg: 8 },
      { p: [-5.65, 0.44, 1.9], s: [0.42, 0.05, 0.42], c: C.wood },
      { p: [-5.84, 0.68, 1.9], s: [0.05, 0.52, 0.42], c: C.darkWood },
    );

    // Suite Divider Wall (x = 3.8) with Sliding Glass Balcony Doorway (z = 0.4..3.6)
    stat.push(
      // South divider pier (z = -4.5..0.4)
      { p: [3.8, 1.72, -2.05], s: [0.34, 3.44, 4.9], c: 0xdfd7c6, tex: 'plaster' },
      { p: [3.62, 1.72, -2.05], s: [0.08, 3.44, 4.9], c: 0xd6cebc, tex: 'ashlarStone' },
      { p: [3.60, 1.72, -4.35], s: [0.56, 3.48, 0.56], c: 0xe6dfd0, tex: 'ashlarStone' },
      // North divider wall (z = 3.6..11.4)
      { p: [3.8, 1.72, 7.5], s: [0.34, 3.44, 7.8], c: 0xdfd7c6, tex: 'plaster' },
      // Top doorway header lintel & slid-open steel glass door panels
      { p: [3.8, 3.12, 2.0], s: [0.34, 0.64, 3.4], c: 0xdfd7c6, tex: 'plaster' },
      { p: [3.8, 0.03, 2.0], s: [0.36, 0.06, 3.2], c: 0x8b867b },
      { p: [3.96, 1.40, 0.15], s: [0.06, 2.74, 1.55], c: 0x2d3238 },
      { p: [3.96, 1.40, 3.85], s: [0.06, 2.74, 1.55], c: 0x2d3238 },
    );
    windowParts(stat, glow, 3.63, 1.72, -2.0, 2.2, 1.75, 'x', -1, true, true);

    // Compact 1980s Press Suite Interior (x = 4.0..10.5, z = -4.4..11.4) & North Hotel Facade
    stat.push(
      // East suite wall (x = 10.5)
      { p: [10.5, 1.72, 3.5], s: [0.36, 3.44, 15.8], c: 0xdcd5c4, tex: 'plaster' },
      { p: [10.28, 0.55, 3.5], s: [0.08, 1.10, 15.6], c: 0x6b4b2e, tex: 'woodPlank' },
      // North hotel wall (z = 11.3, behind player maxZ=7 so cameras never clip)
      { p: [0.0, 1.72, 11.3], s: [21.2, 3.44, 0.36], c: 0xd6cebc, tex: 'plaster' },
      { p: [7.2, 0.55, 11.08], s: [6.4, 1.10, 0.08], c: 0x6b4b2e, tex: 'woodPlank' },
      // Perimeter top cornice trim (open center sky/ceiling for overhead follow & wide cameras)
      { p: [7.2, 3.40, -4.35], s: [6.8, 0.22, 0.42], c: 0xe6dfd0 },
      { p: [7.2, 3.40, 11.2], s: [6.8, 0.22, 0.42], c: 0xe6dfd0 },
      // Press Desk at [7.8, 4.2] facing West (-X) + chair
      ...place(pressDesk(), 7.8, 4.2, H),
      { p: [6.75, 0.45, 4.2], s: [0.46, 0.06, 0.46], c: C.wood },
      { p: [6.54, 0.72, 4.2], s: [0.06, 0.52, 0.44], c: C.darkWood },
      // Secondary worktable with tape recorder & camera satchel at [8.4, -1.6]
      { p: [8.4, 0.37, -1.6], s: [0.84, 0.74, 1.45], c: 0x5c3e26, bevel: true },
      { p: [8.32, 0.79, -1.35], s: [0.24, 0.08, 0.34], c: 0x242629 }, // cassette tape deck
      { p: [8.32, 0.85, -1.90], s: [0.28, 0.20, 0.36], c: 0x4b3422, bevel: true }, // camera bag
      // Equipment shelf & armchair along North wall [7.2, 10.3]
      { p: [7.2, 0.95, 10.45], s: [2.4, 1.90, 0.52], c: 0x4f3522, bevel: true },
      { p: [5.4, 0.42, 7.6], s: [0.85, 0.84, 0.85], c: 0x6b4b32, bevel: true },
    );
    // Warm hotel suite windows along North facade behind balcony
    for (const wx of [-7.5, -3.5, 0.5]) {
      windowParts(stat, glow, wx, 1.75, 11.1, 2.2, 1.65, 'z', -1, wx !== -3.5, true);
    }

    // Balcony sconce & interior banker lamp glow
    glow.push({ p: [3.55, 2.35, 0.25], s: [0.16, 0.22, 0.16], c: 0xffe4a0, sphere: true, detail: 0, noAO: true });
    addPointLight(s, 0xffd288, 16, 14, 7.6, 2.2, 4.2);
    addPointLight(s, 0xffd494, 10, 10, 3.2, 2.5, 0.4);

    // Suite Wall Map / Assignment Board + Room Plaque (marked markSceneOwned)
    addSignPlane(s, 10.28, 1.85, 4.2, 2.2, 1.15, -H, 512, 256, g => {
      g.fillStyle = '#e8dfc6';
      g.fillRect(0, 0, 512, 256);
      g.strokeStyle = '#4b331d';
      g.lineWidth = 10;
      g.strokeRect(5, 5, 502, 246);
      g.fillStyle = '#8c2a22';
      g.fillRect(18, 18, 476, 46);
      g.fillStyle = '#f8f0d8';
      g.font = 'bold 28px "Noto Serif CJK TC","Noto Sans CJK TC",serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('《首都晨報》北京飯店 1018 採訪室', 256, 42);
      g.strokeStyle = '#3b4a58';
      g.lineWidth = 3;
      g.strokeRect(30, 82, 452, 145);
      g.beginPath();
      g.moveTo(30, 148);
      g.lineTo(482, 148);
      g.moveTo(220, 82);
      g.lineTo(220, 227);
      g.stroke();
      g.fillStyle = '#1f2328';
      g.font = 'bold 20px "Noto Sans CJK TC",sans-serif';
      g.fillText('長安街／天安門城樓 西向長焦點位', 256, 114);
      g.fillStyle = '#8e241b';
      g.fillText('膠捲底片清點・夜班發稿聯絡', 256, 188);
    });
    simpleTextSign(s, '1018', 3.59, 2.15, 0.15, 0.42, 0.18, '#2b241c', '#e8d088', -H);

    // Build distant Chang'an Avenue 10,000-12,000 tri sculpted silhouette strip
    buildChangAnSilhouetteStrip(s, stat, glow, groundY);

    addLayeredParts(s, stat);
    if (glow.length) s.add(new THREE.Mesh(mergeParts(glow), glowMat()));

    // 16 moving bikeLod riders + animated articulated trolleybus along Chang'an Avenue below (y = -32)
    const r = rng(198905);
    const N = 16;
    const riders = new THREE.InstancedMesh(mergeParts(bikeLod(C.navy)), litMat(), N);
    const rs = Array.from({ length: N }, (_, i) => ({
      x: -280 + r() * 340,
      z: i % 2 === 0 ? -43.5 - r() * 1.8 : -91.5 + r() * 1.8,
      v: (i % 2 === 0 ? -1 : 1) * (3.2 + r() * 1.8),
    }));
    s.add(riders);

    const tb = new THREE.Group();
    tb.add(new THREE.Mesh(mergeParts(trolleybus()), litMat()), new THREE.Mesh(mergeParts(trolleyWindows()), glowMat()));
    tb.position.set(-140, groundY, -60);
    s.add(tb);

    const dummy = new THREE.Object3D();
    const syncTraffic = (t: number) => {
      for (let i = 0; i < N; i++) {
        const b = rs[i]!;
        dummy.position.set(b.x, groundY + Math.sin(t * 8 + i) * 0.015, b.z);
        dummy.rotation.set(0, b.v > 0 ? 0 : Math.PI, 0);
        dummy.updateMatrix();
        riders.setMatrixAt(i, dummy.matrix);
      }
      riders.instanceMatrix.needsUpdate = true;
    };
    syncTraffic(0);

    const occluders: AABB6[] = [
      [-10.75, -9.95, 0, 3.65, -4.75, -3.95], // Corner balcony column
      [3.55, 4.15, 0, 3.55, -4.7, 0.4],       // Suite divider wall (south of doorway)
      [3.55, 4.15, 0, 3.55, 3.6, 11.6],       // Suite divider wall (north of doorway)
      [10.2, 10.9, 0, 3.55, -4.7, 11.6],      // East suite interior wall
      [-10.6, 10.6, 0, 3.55, 11.0, 11.7],     // North hotel facade wall
    ];

    const camInfo = resolveCam(meta, 6.5, { h: 0.48, ahead: 10, y: 1.6 });
    const world: World = {
      id,
      scene: s,
      spawn: meta?.spawn ?? [0, 0],
      bounds: meta?.bounds ?? BALCONY_BOUNDS,
      atmosphere: atmo,
      camDist: camInfo.camDist,
      cam: camInfo.cam,
      occluders,
      colliders: [
        { kind: 'box', minX: 3.55, maxX: 4.15, minZ: -4.7, maxZ: 0.4 },
        { kind: 'box', minX: 3.55, maxX: 4.15, minZ: 3.6, maxZ: 11.6 },
        { kind: 'box', minX: 7.35, maxX: 8.35, minZ: 3.4, maxZ: 5.0 },
        { kind: 'box', minX: 7.95, maxX: 8.85, minZ: -2.35, maxZ: -0.85 },
        { kind: 'circle', x: 1.6, z: -3.35, r: 0.36 },
        { kind: 'circle', x: -2.9, z: -3.25, r: 0.36 },
      ],
      update(dt, t) {
        for (let i = 0; i < N; i++) {
          const b = rs[i]!;
          b.x += b.v * dt;
          if (b.x > 65) b.x = -280;
          if (b.x < -280) b.x = 65;
        }
        syncTraffic(t);
        tb.position.x += 6.8 * dt;
        if (tb.position.x > 75) tb.position.x = -290;
      },
    };
    return world;
  });

  result.dispose = makeWorldDispose(result.scene, poolKeys);
  return result;
}

/**
 * 2. 1989《首都晨報》Night Editorial Room & Recessed Red-Lit Corner Darkroom (`newsroom`).
 */
export function buildNewsroom(id: SceneId = 'newsroom', meta?: SceneManifestEntry): World {
  const { result, keys: poolKeys } = SharedTexPool.captureScope(() => {
    const s = new THREE.Scene();
    const atmo: AtmospherePreset = meta?.atmosphere ?? 'night';
    applyAtmosphere(s, atmo, { near: 20, far: meta?.camFar ?? 120 });

    const stat: Part[] = [];
    const glow: Part[] = [];

    // Terrazzo floor + darkroom wet-floor rubber mat (SW corner) + sub-base
    stat.push(
      { p: [0, -0.08, 0], s: [29.0, 0.16, 19.0], c: 0x3b3a36, tex: 'terrazzoFloor' },
      { p: [-10.5, 0.015, -6.35], s: [5.4, 0.02, 3.8], c: 0x1c1e20 },
    );

    const wallUpper = 0xd6d0bf;
    const dadoGreen = 0x2a4a38;
    const dadoRail = 0x6b4b2e;

    // Perimeter Walls: North (z = 8.6), West (x = -13.4), East (x = 13.4), & Low Cutaway South Wainscot (z = -8.6)
    stat.push(
      // North wall
      { p: [0, 2.6, 8.6], s: [27.2, 2.32, 0.44], c: wallUpper, tex: 'plaster' },
      { p: [0, 0.72, 8.55], s: [27.0, 1.44, 0.48], c: dadoGreen, tex: 'plaster' },
      { p: [0, 1.46, 8.30], s: [26.8, 0.08, 0.10], c: dadoRail, tex: 'woodPlank' },
      // West wall
      { p: [-13.4, 2.6, 0], s: [0.44, 2.32, 17.6], c: wallUpper, tex: 'plaster' },
      { p: [-13.35, 0.72, 0], s: [0.48, 1.44, 17.4], c: dadoGreen, tex: 'plaster' },
      { p: [-13.10, 1.46, 0], s: [0.10, 0.08, 17.2], c: dadoRail, tex: 'woodPlank' },
      // East wall
      { p: [13.4, 2.6, 0], s: [0.44, 2.32, 17.6], c: wallUpper, tex: 'plaster' },
      { p: [13.35, 0.72, 0], s: [0.48, 1.44, 17.4], c: dadoGreen, tex: 'plaster' },
      { p: [13.10, 1.46, 0], s: [0.10, 0.08, 17.2], c: dadoRail, tex: 'woodPlank' },
      // Low cutaway South wainscot (h = 1.40m so overhead follow/wide cameras at z < -8 never clip)
      { p: [0, 0.70, -8.6], s: [27.2, 1.40, 0.44], c: dadoGreen, tex: 'plaster' },
      { p: [0, 1.44, -8.6], s: [27.3, 0.10, 0.52], c: dadoRail, tex: 'woodPlank' },
      // Perimeter top ceiling cornice beams & acoustic wood wall strips
      { p: [0, 3.82, 8.5], s: [27.2, 0.24, 0.6], c: 0xc2bcb0, tex: 'plaster' },
      { p: [-13.3, 3.82, 0], s: [0.6, 0.24, 17.6], c: 0xc2bcb0, tex: 'plaster' },
      { p: [13.3, 3.82, 0], s: [0.6, 0.24, 17.6], c: 0xc2bcb0, tex: 'plaster' },
      // Acoustic wood-plank wall paneling strips on North/West walls
      { p: [-11.8, 2.55, 8.34], s: [1.6, 1.9, 0.08], c: 0x7b5636, tex: 'woodPlank' },
      { p: [-7.4, 2.55, 8.34], s: [0.45, 2.2, 0.14], c: 0x6a492c, tex: 'woodPlank' },
      { p: [3.6, 2.55, 8.34], s: [0.45, 2.2, 0.14], c: 0x6a492c, tex: 'woodPlank' },
      // Interior concrete structural column at [-6.6, 1.8]
      { p: [-6.6, 1.90, 1.8], s: [0.58, 3.80, 0.58], c: 0xcac4b4, tex: 'plaster' },
      { p: [-6.6, 0.72, 1.8], s: [0.62, 1.44, 0.62], c: dadoGreen, tex: 'plaster' },
    );

    // Steel-sash windows along North & West walls (leaving center bay -3.4..+3.4 unobstructed for signage/proof board)
    for (const wx of [-9.6, -5.2, 5.4, 9.6]) {
      windowParts(stat, glow, wx, 2.45, 8.38, 2.35, 1.50, 'z', -1, true, false);
    }
    for (const wz of [0.2, 4.6]) {
      windowParts(stat, glow, -13.18, 2.45, wz, 2.5, 1.55, 'x', 1, true, false);
    }
    // Exterior city night silhouettes & glowing apartment strips visible through windows
    for (const [bx, bz, bw, bh] of [
      [-12, 18, 18, 14],
      [6, 22, 22, 18],
      [-23, -3, 10, 16],
      [-24, 9, 12, 20],
    ] as [number, number, number, number][]) {
      stat.push({ p: [bx, bh * 0.5 - 2, bz], s: [bw, bh, 8], c: 0x1e222b });
      glow.push({
        p: [bx, bh * 0.45, bz > 10 ? bz - 4.05 : bz],
        s: [bz > 10 ? bw * 0.6 : 0.2, 1.1, bz > 10 ? 0.2 : 5.5],
        c: 0xffcf7a,
        noAO: true,
      });
    }

    // Editorial Workstations: 6 pressDesk() units + chairs (spawn [0, 6] & Shen/Zhang/Telex hotspots stay clear!)
    const deskPlacements: [number, number, number][] = [
      [-9.4, 4.4, 0],
      [-4.6, 4.2, Math.PI],
      [-4.6, -1.8, Math.PI],
      [3.6, -4.4, H],
      [-2.2, -4.8, 0],
      [9.4, 4.8, 0],
    ];
    for (const [dx, dz, dry] of deskPlacements) {
      stat.push(...place(pressDesk(), dx, dz, dry));
      const chOff = place([{ p: [0, 0.44, -0.78], s: [0.44, 0.05, 0.44], c: C.wood }, { p: [0, 0.72, -0.98], s: [0.42, 0.52, 0.05], c: C.darkWood }], dx, dz, dry);
      stat.push(...chOff);
    }

    // 3 newsTelex() Wire Printers along West Wall facing +X (-H) near j1_telex [-9.6, -2.8] + East backup telex
    for (const tz of [-2.8, -0.6, 1.8]) {
      stat.push(...place(newsTelex(), -12.0, tz, -H));
    }
    stat.push(...place(newsTelex(), 9.2, 2.4, H));

    // East Typesetting Type-Case & Galley Proof Bench (排字架與清樣校台) beside [6, 0]
    stat.push(
      { p: [7.8, 0.44, -0.3], s: [1.05, 0.88, 3.0], c: 0x5c4028, bevel: true, tex: 'woodPlank' },
      { p: [7.55, 0.90, -0.85], s: [0.52, 0.05, 0.72], c: 0x3b4046 },
      { p: [7.55, 0.93, -0.85], s: [0.42, 0.02, 0.62], c: 0x626770 },
      { p: [7.68, 0.91, 0.35], s: [0.58, 0.05, 0.78], c: 0xf2ecd8, ry: 0.05 },
      { p: [8.05, 1.06, -0.15], s: [0.16, 0.36, 0.16], c: C.brass, cyl: true, seg: 6 },
      { p: [8.05, 1.24, -0.15], s: [0.24, 0.12, 0.24], c: 0x265c3a },
    );
    glow.push({ p: [8.05, 1.18, -0.15], s: [0.10, 0.10, 0.10], c: 0xffe49a, sphere: true, detail: 0, noAO: true });

    // Long Galley-Proof Layout Table (排版看樣台) at [0.2, 0.6]
    stat.push(
      { p: [0.2, 0.76, 0.6], s: [3.10, 0.07, 1.28], c: 0x73512f, bevel: true, tex: 'woodPlank' },
      { p: [-1.15, 0.38, 0.05], s: [0.10, 0.76, 0.10], c: C.darkWood },
      { p: [1.55, 0.38, 0.05], s: [0.10, 0.76, 0.10], c: C.darkWood },
      { p: [-1.15, 0.38, 1.15], s: [0.10, 0.76, 0.10], c: C.darkWood },
      { p: [1.55, 0.38, 1.15], s: [0.10, 0.76, 0.10], c: C.darkWood },
      // Lead-type chase frame, stacked newspaper proofs, magnifying loupe & enamel mug
      { p: [-0.55, 0.82, 0.6], s: [0.92, 0.04, 0.76], c: 0x3b4046 },
      { p: [-0.55, 0.85, 0.6], s: [0.80, 0.02, 0.64], c: 0x565b62 },
      { p: [0.55, 0.82, 0.52], s: [0.76, 0.05, 0.58], c: 0xf2ecd8, ry: 0.06 },
      { p: [0.62, 0.86, 0.66], s: [0.68, 0.03, 0.50], c: 0xe8e0cb, ry: -0.08 },
      { p: [1.18, 0.86, 0.36], s: [0.10, 0.12, 0.10], c: C.enamel, cyl: true, seg: 8 },
      { p: [0.05, 0.82, 0.96], s: [0.12, 0.04, 0.12], c: C.brass, cyl: true, seg: 8 },
    );

    // Metal filing cabinets & bundled newsprint stacks along East-South wall
    for (const fz of [-5.8, -4.4, -3.0, -1.6]) {
      stat.push(
        { p: [12.35, 0.72, fz], s: [0.68, 1.44, 0.92], c: 0x3e564a, bevel: true },
        { p: [11.98, 1.04, fz], s: [0.03, 0.06, 0.24], c: C.chrome },
        { p: [11.98, 0.54, fz], s: [0.03, 0.06, 0.24], c: C.chrome },
      );
    }
    stat.push(
      { p: [10.4, 0.28, -5.8], s: [0.86, 0.56, 0.68], c: 0xe6decb },
      { p: [10.4, 0.72, -5.7], s: [0.78, 0.32, 0.62], c: 0xddd4bf, ry: 0.12 },
    );

    // Recessed Red-Lit Corner Darkroom (暗房, SW corner x = -13.2..-7.8, z = -8.3..-4.4; doorway x = -10.2..-7.8 facing [-9, -3])
    stat.push(
      // East partition (x = -7.8, z = -8.3..-4.4, h = 2.65m cutaway)
      { p: [-7.8, 1.32, -6.35], s: [0.22, 2.64, 3.9], c: 0xccc5b4, tex: 'plaster' },
      { p: [-7.66, 0.70, -6.35], s: [0.06, 1.40, 3.88], c: dadoGreen, tex: 'plaster' },
      { p: [-7.93, 1.32, -6.35], s: [0.04, 2.64, 3.86], c: 0x222022 },
      // North partition (z = -4.4, x = -13.2..-10.2) leaving doorway gap x = -10.2..-7.8
      { p: [-11.7, 1.32, -4.4], s: [3.0, 2.64, 0.22], c: 0xccc5b4, tex: 'plaster' },
      { p: [-11.7, 0.70, -4.26], s: [2.96, 1.40, 0.06], c: dadoGreen, tex: 'plaster' },
      { p: [-11.7, 1.32, -4.53], s: [2.96, 2.64, 0.04], c: 0x222022 },
      // Light-trap baffle (z = -6.0, x = -10.3..-7.9)
      { p: [-9.1, 1.32, -6.0], s: [2.4, 2.64, 0.16], c: 0x262426 },
      // Wet developing bench (x = -12.0, z = -6.5), 3 chemical trays, enlarger column & safelight crossbeam
      { p: [-12.0, 0.44, -6.5], s: [0.96, 0.88, 3.2], c: 0x3b4046, bevel: true },
      { p: [-12.0, 0.92, -5.45], s: [0.56, 0.09, 0.66], c: 0xd8d5cc },
      { p: [-12.0, 0.92, -6.35], s: [0.56, 0.09, 0.66], c: 0xd8d5cc },
      { p: [-12.0, 0.92, -7.25], s: [0.56, 0.09, 0.66], c: 0xd8d5cc },
      { p: [-12.0, 0.95, -5.45], s: [0.46, 0.04, 0.56], c: 0x2e1212 },
      { p: [-12.0, 0.95, -6.35], s: [0.46, 0.04, 0.56], c: 0x261414 },
      { p: [-12.0, 0.95, -7.25], s: [0.46, 0.04, 0.56], c: 0x221818 },
      // Photo enlarger column & condenser head at [-12.0, -7.9]
      { p: [-12.0, 1.38, -7.9], s: [0.10, 0.92, 0.10], c: 0x24262a },
      { p: [-12.0, 1.62, -7.72], s: [0.28, 0.32, 0.30], c: 0x1c1e22, bevel: true },
      // Safelight hanging beam + film drying line (z = -7.35, x = -11.4..-8.2)
      { p: [-10.5, 2.45, -6.4], s: [4.8, 0.06, 0.06], c: 0x222428 },
      { p: [-9.8, 2.25, -7.35], s: [3.6, 0.02, 0.02], c: 0x8d8e92 },
    );
    // Hanging 35mm film negative strips inside darkroom
    for (let i = 0; i < 6; i++) {
      const fx = -11.2 + i * 0.58;
      stat.push(
        { p: [fx, 1.85, -7.35], s: [0.09, 0.74, 0.015], c: 0x2e1912 },
        { p: [fx, 2.23, -7.35], s: [0.04, 0.05, 0.04], c: C.chrome },
        { p: [fx, 1.47, -7.35], s: [0.04, 0.04, 0.04], c: C.chrome },
      );
    }
    // Glowing ruby safelight + red darkroom warning box
    glow.push(
      { p: [-10.6, 2.28, -6.4], s: [0.24, 0.24, 0.24], c: 0xe62018, sphere: true, detail: 0, noAO: true },
      { p: [-11.5, 2.38, -4.24], s: [0.85, 0.26, 0.10], c: 0xd82018, noAO: true },
    );

    // Back-wall Bulletin Proofs & Editorial Signage (marked markSceneOwned) centered on unobstructed North wall bay
    addSignPlane(s, 0.0, 2.15, 8.34, 3.0, 1.45, Math.PI, 512, 256, g => {
      g.fillStyle = '#4a3522';
      g.fillRect(0, 0, 512, 256);
      g.fillStyle = '#d4c39e';
      g.fillRect(10, 10, 492, 236);
      for (let i = 0; i < 4; i++) {
        const px = 22 + i * 118;
        g.fillStyle = '#f5f0e2';
        g.fillRect(px, 24, 104, 204);
        g.fillStyle = '#18181a';
        g.fillRect(px + 8, 34, 88, 18);
        g.fillStyle = '#525256';
        for (let ln = 0; ln < 8; ln++) {
          g.fillRect(px + 8, 64 + ln * 18, 84 - (ln % 3) * 14, 6);
        }
        g.strokeStyle = '#c2241a';
        g.lineWidth = 3;
        g.strokeRect(px + 12, 92, 54, 34);
      }
    });
    simpleTextSign(s, '《首都晨報》夜班編輯部', 0.0, 3.25, 8.34, 3.6, 0.56, '#22382c', '#f2e6bf', Math.PI, '#c8a248');
    simpleTextSign(s, '暗房・衝印作業中', -11.5, 2.38, -4.18, 1.4, 0.34, '#7a1610', '#ffe0c8', 0, '#e85a4a', true);
    // 1980s Newsroom round wall clock on North wall [2.6, 3.25, 8.34]
    addSignPlane(s, 2.6, 3.25, 8.34, 0.68, 0.68, Math.PI, 128, 128, g => {
      g.fillStyle = '#3b3326';
      g.beginPath();
      g.arc(64, 64, 62, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f2ecd8';
      g.beginPath();
      g.arc(64, 64, 54, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#181818';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(64, 64);
      g.lineTo(86, 48);
      g.moveTo(64, 64);
      g.lineTo(64, 24);
      g.stroke();
    });
    // Door threshold exit step mat near South exit [0, -7.8]
    stat.push(
      { p: [0, 0.025, -8.15], s: [2.8, 0.04, 0.9], c: 0x3b3832 },
      { p: [-1.45, 0.72, -8.4], s: [0.16, 1.44, 0.52], c: 0x4b331d },
      { p: [1.45, 0.72, -8.4], s: [0.16, 1.44, 0.52], c: 0x4b331d },
    );

    // Subtle overhead fluorescent strip lights along ceiling perimeter (leaving central camera views clean)
    for (const [fx, fz] of [[-7.0, 4.0], [-7.0, -2.5], [1.0, 1.0]] as [number, number][]) {
      glow.push({ p: [fx, 3.55, fz], s: [2.2, 0.08, 0.16], c: 0xf4f0d8, noAO: true });
    }

    addLayeredParts(s, stat);
    if (glow.length) s.add(new THREE.Mesh(mergeParts(glow), glowMat()));

    // Warm editorial desk lighting + deep ruby safelight inside Darkroom
    addPointLight(s, 0xffd89b, 20, 18, -6.5, 3.2, 1.5);
    addPointLight(s, 0xffd89b, 20, 18, 0.2, 3.2, 0.6);
    addPointLight(s, 0xffcf88, 16, 15, 6.2, 3.0, -1.2);
    addPointLight(s, 0xe01c14, 18, 11, -10.8, 2.25, -6.4, 1.4);

    const occluders: AABB6[] = [
      [-7.95, -7.65, 0, 2.75, -8.4, -4.3],  // Darkroom East partition
      [-13.3, -10.0, 0, 2.75, -4.55, -4.25], // Darkroom North partition
      [-10.4, -7.8, 0, 2.75, -6.12, -5.88],  // Darkroom light-trap baffle
      [-6.95, -6.25, 0, 3.8, 1.45, 2.15],    // Interior concrete pillar
    ];

    const camInfo = resolveCam(meta, 8.5, { h: 0.68, ahead: 5, y: 1.4 });
    const world: World = {
      id,
      scene: s,
      spawn: meta?.spawn ?? [0, 6],
      bounds: meta?.bounds ?? NEWSROOM_BOUNDS,
      atmosphere: atmo,
      camDist: camInfo.camDist,
      cam: camInfo.cam,
      occluders,
      colliders: [
        { kind: 'circle', x: -6.6, z: 1.8, r: 0.36 },
        { kind: 'box', minX: -1.35, maxX: 1.75, minZ: -0.04, maxZ: 1.24 },
        { kind: 'box', minX: 7.25, maxX: 8.35, minZ: -1.8, maxZ: 1.2 },
        { kind: 'box', minX: 11.95, maxX: 13.5, minZ: -6.35, maxZ: -1.1 },
        { kind: 'box', minX: -7.95, maxX: -7.65, minZ: -8.35, maxZ: -4.4 },
        { kind: 'box', minX: -13.25, maxX: -10.2, minZ: -4.55, maxZ: -4.25 },
        { kind: 'box', minX: -13.4, maxX: -11.45, minZ: -3.35, maxZ: 2.35 },
        { kind: 'circle', x: -9.4, z: 4.4, r: 0.62 },
        { kind: 'circle', x: -4.6, z: 4.2, r: 0.62 },
        { kind: 'circle', x: -4.6, z: -1.8, r: 0.62 },
        { kind: 'circle', x: 3.6, z: -4.4, r: 0.62 },
        { kind: 'circle', x: -2.2, z: -4.8, r: 0.62 },
        { kind: 'circle', x: 9.4, z: 4.8, r: 0.62 },
      ],
      update() { /* static editorial interior */ },
    };
    return world;
  });

  result.dispose = makeWorldDispose(result.scene, poolKeys);
  return result;
}

/**
 * 3. Muxidi / Fuxingmen Concrete Viaduct & Pedestrian Overpass (`overpass`).
 */
export function buildOverpass(id: SceneId = 'overpass', meta?: SceneManifestEntry): World {
  const { result, keys: poolKeys } = SharedTexPool.captureScope(() => {
    const s = new THREE.Scene();
    const atmo: AtmospherePreset = meta?.atmosphere ?? 'day_spring';
    applyAtmosphere(s, atmo, { near: 36, far: meta?.camFar ?? 280 });

    const stat: Part[] = [];
    const glow: Part[] = [];
    const r = rng(19890427);

    // Roadway (z = -12.5..+5.5) + North/South Sidewalks + Sub-base
    const roadPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 18),
      new THREE.MeshLambertMaterial({ map: asphaltRoadTex(32, 4) }),
    );
    roadPlane.rotation.x = -Math.PI / 2;
    roadPlane.position.set(0, 0.01, -3.5);
    s.add(roadPlane);

    const northWalk = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 10),
      new THREE.MeshLambertMaterial({ map: campusPathTex(32, 3) }),
    );
    northWalk.rotation.x = -Math.PI / 2;
    northWalk.position.set(0, 0.03, 10.5);
    s.add(northWalk);

    const southWalk = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 10),
      new THREE.MeshLambertMaterial({ map: campusPathTex(32, 3) }),
    );
    southWalk.rotation.x = -Math.PI / 2;
    southWalk.position.set(0, 0.03, -17.5);
    s.add(southWalk);

    stat.push(
      { p: [0, -0.09, -3.5], s: [180, 0.18, 86], c: 0x3b3a36 },
      // Granite sidewalk curbs
      { p: [0, 0.06, 5.5], s: [140, 0.12, 0.28], c: 0x827d72 },
      { p: [0, 0.06, -12.5], s: [140, 0.12, 0.28], c: 0x827d72 },
    );
    for (let x = -62; x <= 62; x += 6) {
      stat.push(
        { p: [x, 0.018, -3.5], s: [2.8, 0.014, 0.16], c: 0xd6d2c4, noAO: true },
        { p: [x, 0.018, -9.2], s: [3.2, 0.014, 0.10], c: 0xb8b4a6, noAO: true },
        { p: [x, 0.018, 2.2], s: [3.2, 0.014, 0.10], c: 0xb8b4a6, noAO: true },
      );
    }
    // Blue-and-white Beijing guardrails (leaving spawn [-26, -3] and crosswalks clear)
    for (const [x0, x1] of [[-56, -34], [-18, -10], [2, 10], [26, 56]] as [number, number][]) {
      const cx = (x0 + x1) / 2;
      const len = x1 - x0;
      for (const gz of [-9.4, 2.4]) {
        stat.push(
          { p: [cx, 0.72, gz], s: [len, 0.06, 0.05], c: 0xe6e2d6 },
          { p: [cx, 0.22, gz], s: [len, 0.05, 0.05], c: 0xe6e2d6 },
        );
        for (let gx = x0; gx <= x1; gx += 3.0) {
          stat.push({ p: [gx, 0.42, gz], s: [0.07, 0.72, 0.07], c: 0x2b5a94 });
        }
      }
    }

    // Pedestrian Overpass Walkway at x = -6.0 (deck y = 6.35m clearing 5.9m trolley wires)
    const pox = -6.0;
    stat.push(
      { p: [pox, 6.40, -3.0], s: [2.8, 0.30, 31.0], c: 0x9b9589, tex: 'ashlarStone' },
      { p: [pox - 1.36, 7.05, -3.0], s: [0.08, 0.12, 31.0], c: 0x2c4b6e },
      { p: [pox + 1.36, 7.05, -3.0], s: [0.08, 0.12, 31.0], c: 0x2c4b6e },
      { p: [pox - 1.36, 7.55, -3.0], s: [0.08, 0.08, 31.0], c: 0x2c4b6e },
      { p: [pox + 1.36, 7.55, -3.0], s: [0.08, 0.08, 31.0], c: 0x2c4b6e },
      // Support piers on north & south sidewalks
      { p: [pox, 3.15, 6.8], s: [1.1, 6.3, 1.1], c: 0x868176, tex: 'ashlarStone' },
      { p: [pox, 3.15, -13.8], s: [1.1, 6.3, 1.1], c: 0x868176, tex: 'ashlarStone' },
    );
    for (let pz = -17.5; pz <= 11.5; pz += 1.8) {
      stat.push(
        { p: [pox - 1.36, 7.05, pz], s: [0.06, 1.0, 0.06], c: 0x2c4b6e },
        { p: [pox + 1.36, 7.05, pz], s: [0.06, 1.0, 0.06], c: 0x2c4b6e },
      );
    }
    // Pedestrian overpass access stairs + ground railings at North (z = +8.5..+11.5) & South (z = -14.5..-17.5)
    for (const [sz, dir] of [[1, 1], [-1, -1]] as [number, number][]) {
      const zMid = sz === 1 ? 10.6 : -16.6;
      for (let step = 0; step < 8; step++) {
        const sy = 0.4 + step * 0.75;
        const sx = pox + (8 - step) * 0.85;
        stat.push({ p: [sx, sy * 0.5, zMid], s: [0.95, sy, 1.85], c: 0x8a857a, tex: 'ashlarStone' });
      }
      stat.push(
        { p: [pox + 4.4, 0.85, zMid + dir * 0.96], s: [7.4, 0.07, 0.07], c: 0x2c4b6e, rz: -0.70 },
        { p: [pox + 7.2, 0.52, zMid + dir * 0.96], s: [1.6, 1.04, 0.08], c: 0x2c4b6e },
      );
    }

    // Concrete Muxidi / Fuxingmen Viaduct Road Deck Overhead (x = 12..23, soffit y = 9.1m > follow cam y = 8.15m)
    const vx = 17.5;
    stat.push(
      { p: [vx, 9.7, -3.0], s: [11.2, 1.2, 56.0], c: 0x8f8a7f, tex: 'ashlarStone' },
      { p: [vx - 5.45, 10.75, -3.0], s: [0.36, 1.0, 56.0], c: 0x9b968a, tex: 'ashlarStone' },
      { p: [vx + 5.45, 10.75, -3.0], s: [0.36, 1.0, 56.0], c: 0x9b968a, tex: 'ashlarStone' },
      { p: [vx, 10.32, -3.0], s: [10.4, 0.05, 56.0], c: 0x2f3034 },
    );
    // Flared granite/concrete piers at z = -15.5, -3.8, +7.5 (2 pier rows x = 14.5 & 20.5)
    for (const pz of [-15.5, -3.8, 7.5]) {
      for (const px of [14.6, 20.4]) {
        stat.push(
          { p: [px, 0.45, pz], s: [2.2, 0.9, 2.2], c: 0x767268, bevel: true, tex: 'ashlarStone' },
          { p: [px, 4.3, pz], s: [1.55, 7.2, 1.55], c: 0x8a857a, cyl: true, seg: 8, top: 1.05, tex: 'ashlarStone' },
          { p: [px, 8.45, pz], s: [1.65, 1.25, 1.65], c: 0x969186, cyl: true, seg: 8, top: 1.55, tex: 'ashlarStone' },
        );
      }
      stat.push({ p: [vx, 8.75, pz], s: [10.6, 0.75, 2.0], c: 0x8d887d, tex: 'ashlarStone' });
    }
    // Static bus silhouette crossing the high viaduct deck + viaduct lampposts
    stat.push(...place(trolleybus(0xd2c8a2, 0x8a3828), vx, -14, H, 10.35));
    for (let pz = -24; pz <= 18; pz += 14) {
      stat.push(
        { p: [vx - 5.3, 13.0, pz], s: [0.16, 4.2, 0.16], c: 0x3b3e42, cyl: true, seg: 6 },
        { p: [vx + 5.3, 13.0, pz], s: [0.16, 4.2, 0.16], c: 0x3b3e42, cyl: true, seg: 6 },
      );
      glow.push(
        { p: [vx - 5.0, 15.0, pz], s: [0.36, 0.14, 0.24], c: 0xfff2c0, noAO: true },
        { p: [vx + 5.0, 15.0, pz], s: [0.36, 0.14, 0.24], c: 0xfff2c0, noAO: true },
      );
    }

    // Flanking Multi-Story Brick/Plaster Apartment Slabs (North z = +18, South z = -24)
    const slabs: [number, number, number, number, number, 'qingBrick' | 'plaster', number, -1 | 1][] = [
      [-32, 18.2, 22, 16, 7.6, 'qingBrick', 0x5c6066, -1],
      [-6, 18.6, 24, 18.5, 8.0, 'plaster', 0x9c9484, -1],
      [26, 18.2, 26, 16.5, 7.6, 'qingBrick', 0x625f5a, -1],
      [-32, -24.2, 22, 15.5, 7.6, 'plaster', 0x948c7c, 1],
      [-6, -24.6, 24, 17.5, 8.0, 'qingBrick', 0x585c62, 1],
      [28, -24.2, 24, 16.0, 7.6, 'plaster', 0x8e8678, 1],
    ];
    for (const [bx, bz, bw, bh, bd, tex, col, face] of slabs) {
      const frontZ = bz + face * (bd / 2);
      stat.push(
        { p: [bx, 0.45, bz], s: [bw + 0.3, 0.9, bd + 0.3], c: 0x68655e, tex: 'ashlarStone' },
        { p: [bx, bh * 0.5, bz], s: [bw, bh, bd], c: col, tex },
        { p: [bx, bh + 0.25, bz], s: [bw + 0.5, 0.5, bd + 0.5], c: 0x52504a },
      );
      for (let fl = 0; fl < 4; fl++) {
        const wy = 2.6 + fl * 3.4;
        for (let wx = bx - bw * 0.36; wx <= bx + bw * 0.36 + 0.1; wx += 4.2) {
          windowParts(stat, glow, wx, wy, frontZ, 1.35, 1.45, 'z', face, false);
        }
        if (fl >= 1 && fl <= 3) {
          apartmentBalconyParts(stat, bx - bw * 0.22, wy, frontZ, 2.8, face, r);
          apartmentBalconyParts(stat, bx + bw * 0.22, wy, frontZ, 2.8, face, r);
        }
      }
    }

    // Overpass Banners (marked markSceneOwned)
    simpleTextSign(s, '新聞要說真話・北京市民聲援學生', pox - 1.46, 7.12, -3.0, 8.5, 1.05, '#b62820', '#f6f0de', -H, '#f0e2b8', true);
    simpleTextSign(s, '理解萬歲・理智克制', vx - 5.66, 10.35, -3.0, 9.2, 1.15, '#f2eee0', '#18181a', -H, '#b82820', true);
    simpleTextSign(s, '復興門外書報亭', -22, 2.95, 14.3, 4.4, 0.78, '#203d2c', '#f4e4b2', Math.PI);

    // Overhead trolley wires & street horizon extenders
    stat.push(...wiresParts(-62, 62, [-6.4, -5.6, -1.2, -0.4], 5.6, -12.6, 16, 0));
    stat.push(
      { p: [-72, 11, -3.5], s: [10, 22, 46], c: 0x7a766d },
      { p: [72, 11, -3.5], s: [10, 22, 46], c: 0x7a766d },
    );

    addLayeredParts(s, stat);
    if (glow.length) s.add(new THREE.Mesh(mergeParts(glow), glowMat()));

    // Avenue Poplars (treeLod) + Street Lamps
    const pops: { x: number; z: number; ry: number }[] = [];
    for (let x = -46; x <= 46; x += 11) {
      if (Math.abs(x - pox) < 3.5 || Math.abs(x - vx) < 7.0) continue;
      pops.push({ x, z: 6.4, ry: r() * 6 }, { x: x + 4.5, z: -13.4, ry: r() * 6 });
    }
    addRealisticTrees(s, pops, true, true);

    const lamps: { x: number; z: number; ry?: number }[] = [];
    for (let x = -48; x <= 48; x += 16) {
      if (Math.abs(x - vx) < 6.0) continue;
      lamps.push({ x, z: 5.8 }, { x: x + 8, z: -12.8, ry: Math.PI });
    }
    s.add(instanced(mergeParts(lampPole()), litMat(), lamps));
    s.add(instanced(mergeParts(lampHead()), glowMat(), lamps));

    // Spectators on Pedestrian Overpass (y = 6.55), Viaduct Deck (y = 10.35), & Sidewalks
    const specs: { x: number; y: number; z: number; ry: number }[] = [];
    for (let z = -14; z <= 8; z += 1.6) {
      specs.push({ x: pox - 0.8, y: 6.55, z, ry: Math.PI });
      specs.push({ x: vx - 4.7, y: 10.35, z: z * 1.3, ry: Math.PI });
    }
    for (let x = -36; x <= 34; x += 2.2) {
      if (Math.abs(x - pox) < 4.5 || Math.abs(x - vx) < 6.5) continue;
      specs.push({ x, y: 0, z: 7.4 + r() * 0.9, ry: Math.PI * 0.5 });
      specs.push({ x: x + 0.8, y: 0, z: -14.2 - r() * 0.9, ry: -Math.PI * 0.5 });
    }
    const specMesh = instanced(mergeParts(crowdPersonLod(0xf4f2ec)), tintLitMat(), specs);
    const sCols = [C.navy, C.khaki, 0x4e5a4a, 0x6a2f3a, 0x7c7460, 0x3b485a];
    specs.forEach((_, i) => specMesh.setColorAt(i, new THREE.Color(sCols[i % sCols.length])));
    s.add(specMesh);

    // 16 Moving bikeLod Riders + 2 Animated Trolleybuses along Avenue below
    const N = 16;
    const riders = new THREE.InstancedMesh(mergeParts(bikeLod(C.navy)), litMat(), N);
    const rs = Array.from({ length: N }, (_, i) => ({
      x: -55 + r() * 110,
      z: i % 2 === 0 ? -10.8 + r() * 0.8 : 3.6 + r() * 0.8,
      v: (i % 2 === 0 ? 1 : -1) * (3.2 + r() * 1.6),
    }));
    s.add(riders);

    const tbs = [0, 1].map(i => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(mergeParts(trolleybus()), litMat()), new THREE.Mesh(mergeParts(trolleyWindows()), glowMat()));
      g.position.set(i === 0 ? -38 : 36, 0, i === 0 ? -6.0 : -0.6);
      if (i === 1) g.rotation.y = Math.PI;
      s.add(g);
      return g;
    });

    const dummy = new THREE.Object3D();
    const syncRiders = (t: number) => {
      for (let i = 0; i < N; i++) {
        const b = rs[i]!;
        dummy.position.set(b.x, Math.sin(t * 9 + i) * 0.015, b.z);
        dummy.rotation.set(0, b.v > 0 ? 0 : Math.PI, 0);
        dummy.updateMatrix();
        riders.setMatrixAt(i, dummy.matrix);
      }
      riders.instanceMatrix.needsUpdate = true;
    };
    syncRiders(0);

    const occluders: AABB6[] = [
      // Viaduct flared piers
      [13.4, 15.8, 0, 9.2, -16.7, -14.3],
      [19.2, 21.6, 0, 9.2, -16.7, -14.3],
      [13.4, 15.8, 0, 9.2, -4.9, -2.7],
      [19.2, 21.6, 0, 9.2, -4.9, -2.7],
      [13.4, 15.8, 0, 9.2, 6.3, 8.7],
      [19.2, 21.6, 0, 9.2, 6.3, 8.7],
      // Viaduct deck & pedestrian overpass deck
      [11.8, 23.2, 9.0, 11.4, -31, 25],
      [-7.5, -4.5, 6.2, 7.6, -18.5, 12.5],
      // Flanking North & South apartment slabs
      [-48, 48, 0, 19.5, 14.2, 23.5],
      [-48, 48, 0, 19.5, -29.5, -20.2],
    ];

    const camInfo = resolveCam(meta, 13, { h: 0.55, ahead: 10, y: 1.2 });
    const world: World = {
      id,
      scene: s,
      spawn: meta?.spawn ?? [-26, -3],
      bounds: meta?.bounds ?? OVERPASS_BOUNDS,
      atmosphere: atmo,
      camDist: camInfo.camDist,
      cam: camInfo.cam,
      occluders,
      colliders: [
        { kind: 'circle', x: 14.6, z: -15.5, r: 1.0 },
        { kind: 'circle', x: 20.4, z: -15.5, r: 1.0 },
        { kind: 'circle', x: 14.6, z: -3.8, r: 1.0 },
        { kind: 'circle', x: 20.4, z: -3.8, r: 1.0 },
        { kind: 'circle', x: 14.6, z: 7.5, r: 1.0 },
        { kind: 'circle', x: 20.4, z: 7.5, r: 1.0 },
        { kind: 'circle', x: -6.0, z: 6.8, r: 0.55 },
        { kind: 'circle', x: -6.0, z: -13.8, r: 0.55 },
      ],
      update(dt, t) {
        for (let i = 0; i < N; i++) {
          const b = rs[i]!;
          b.x += b.v * dt;
          if (b.x > 60) b.x = -60;
          if (b.x < -60) b.x = 60;
        }
        syncRiders(t);
        tbs[0]!.position.x += 6.2 * dt;
        if (tbs[0]!.position.x > 70) tbs[0]!.position.x = -70;
        tbs[1]!.position.x -= 6.2 * dt;
        if (tbs[1]!.position.x < -70) tbs[1]!.position.x = 70;
      },
    };
    return world;
  });

  result.dispose = makeWorldDispose(result.scene, poolKeys);
  return result;
}

/**
 * 4. Xinhua Gate & West Chang'an Avenue Dusk Vigil (`xinhua_gate`).
 */
export function buildXinhuaGate(id: SceneId = 'xinhua_gate', meta?: SceneManifestEntry): World {
  const { result, keys: poolKeys } = SharedTexPool.captureScope(() => {
    const s = new THREE.Scene();
    const atmo: AtmospherePreset = meta?.atmosphere ?? 'dusk_warm';
    applyAtmosphere(s, atmo, { near: 42, far: meta?.camFar ?? 300 });

    const stat: Part[] = [];
    const glow: Part[] = [];
    const r = rng(19890420);

    // West Chang'an Avenue Asphalt Roadbed (z = -19.5..+0.5), Granite Forecourt (z = +0.5..+10.5), South Sidewalk
    const avePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 20),
      new THREE.MeshLambertMaterial({ map: asphaltRoadTex(32, 4) }),
    );
    avePlane.rotation.x = -Math.PI / 2;
    avePlane.position.set(0, 0.01, -9.5);
    s.add(avePlane);

    const forecourtPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(110, 11),
      new THREE.MeshLambertMaterial({ map: granitePavingTex(20, 4) }),
    );
    forecourtPlane.rotation.x = -Math.PI / 2;
    forecourtPlane.position.set(0, 0.025, 5.5);
    s.add(forecourtPlane);

    const southWalk = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 10),
      new THREE.MeshLambertMaterial({ map: campusPathTex(32, 3) }),
    );
    southWalk.rotation.x = -Math.PI / 2;
    southWalk.position.set(0, 0.025, -24.5);
    s.add(southWalk);

    stat.push(
      { p: [0, -0.09, -6], s: [180, 0.18, 96], c: 0x3b3833 },
      { p: [0, 0.06, 0.5], s: [140, 0.12, 0.30], c: 0x8d887d },
      { p: [0, 0.06, -19.5], s: [140, 0.12, 0.30], c: 0x8d887d },
      { p: [0, 0.018, -9.5], s: [140, 0.014, 0.28], c: 0xc9b860, noAO: true },
    );
    for (let x = -62; x <= 62; x += 6) {
      stat.push(
        { p: [x, 0.018, -4.5], s: [2.8, 0.014, 0.16], c: 0xb8b4a6, noAO: true },
        { p: [x, 0.018, -14.5], s: [2.8, 0.014, 0.16], c: 0xb8b4a6, noAO: true },
      );
    }
    // Blue-and-white guardrails along z = -2.4 and -16.6 (wide open around central gate & spawn [-20, -10])
    for (const [x0, x1] of [[-58, -16], [16, 58]] as [number, number][]) {
      const cx = (x0 + x1) / 2;
      const len = x1 - x0;
      for (const gz of [-2.4, -16.6]) {
        stat.push(
          { p: [cx, 0.72, gz], s: [len, 0.06, 0.05], c: 0xe6e2d6 },
          { p: [cx, 0.22, gz], s: [len, 0.05, 0.05], c: 0xe6e2d6 },
        );
        for (let gx = x0; gx <= x1; gx += 3.2) {
          stat.push({ p: [gx, 0.42, gz], s: [0.07, 0.72, 0.07], c: 0x2b5a94 });
        }
      }
    }

    // Flanking Imperial Red Palace Walls (紅牆, z = +8.2)
    for (const sx of [-1, 1]) {
      stat.push(
        { p: [sx * 38.5, 0.35, 8.2], s: [52, 0.70, 1.8], c: 0x7e7a72, tex: 'ashlarStone' },
        { p: [sx * 38.5, 2.95, 8.2], s: [52, 4.5, 1.3], c: 0x8e2b22, tex: 'palaceWall' },
        { p: [sx * 38.5, 5.35, 8.2], s: [52.2, 0.30, 1.5], c: 0x245e54 },
        { p: [sx * 38.5, 5.75, 8.2], s: [2.0, 0.65, 52.4], c: 0xd4a028, prism: true, ry: H, tex: 'roofTile' },
      );
      for (let rx = 16; rx <= 56; rx += 8) {
        stat.push({ p: [sx * rx, 2.95, 8.2], s: [0.55, 4.55, 1.46], c: 0x76221b, tex: 'palaceWall' });
      }
    }

    // White marble balustrades flanking forecourt wings (z = +4.2)
    for (const [bx0, bx1] of [[-25, -8.5], [8.5, 25]] as [number, number][]) {
      const bcx = (bx0 + bx1) / 2;
      const blen = bx1 - bx0;
      stat.push(
        { p: [bcx, 0.14, 4.2], s: [blen, 0.24, 0.24], c: 0xdedad0 },
        { p: [bcx, 0.72, 4.2], s: [blen, 0.16, 0.22], c: 0xe8e4da },
      );
      for (let px = bx0; px <= bx1; px += 2.75) {
        stat.push(
          { p: [px, 0.50, 4.2], s: [0.28, 0.94, 0.28], c: 0xe8e4da },
          { p: [px, 1.05, 4.2], s: [0.24, 0.18, 0.24], c: 0xeeeae0, roof: true },
        );
      }
    }

    // Xinhua Gate Two-Story Upturned Imperial Portico (x = 0, z = +10.5)
    const gz = 10.5;
    stat.push(
      // Stone plinth terrace & central threshold apron
      { p: [0, 0.30, gz], s: [25.6, 0.60, 8.6], c: 0x9b9588, tex: 'ashlarStone' },
      { p: [0, 0.16, gz - 4.6], s: [11.0, 0.32, 1.4], c: 0xdedad0, tex: 'ashlarStone' },
      // Side palace bays (x = -12.2..-2.4 and +2.4..+12.2) leaving central portal open to screen wall
      { p: [-7.3, 3.30, gz], s: [9.8, 5.4, 6.2], c: 0x8e2b22, tex: 'palaceWall' },
      { p: [7.3, 3.30, gz], s: [9.8, 5.4, 6.2], c: 0x8e2b22, tex: 'palaceWall' },
      // Central archway lintel beam & Hexi painted architraves
      { p: [0, 5.55, gz], s: [5.4, 1.1, 6.4], c: 0x8e2b22, tex: 'palaceWall' },
      { p: [0, 5.85, gz], s: [24.8, 0.55, 6.8], c: 0x245e54 },
      { p: [0, 6.20, gz], s: [25.4, 0.28, 7.2], c: 0x24426e },
      // Closed crimson side doors with gold studs
      { p: [-7.2, 2.4, gz - 3.12], s: [2.8, 3.8, 0.16], c: 0x6b1d17 },
      { p: [7.2, 2.4, gz - 3.12], s: [2.8, 3.8, 0.16], c: 0x6b1d17 },
      // Lower curved yellow-glazed imperial roof
      ...imperialRoof(6.25, 27.0, 10.2, 2.7, 0xd4a028, gz, 0xe2b842),
      // Upper 5-bay palace gallery story (y = 8.4..11.2) + upper imperial roof
      { p: [0, 9.8, gz], s: [21.0, 2.9, 5.4], c: 0x8e2b22, tex: 'palaceWall' },
      { p: [0, 11.25, gz], s: [21.6, 0.55, 5.8], c: 0x245e54 },
      ...imperialRoof(11.35, 22.8, 8.2, 3.5, 0xd4a028, gz, 0xe2b842),
    );
    for (const cx of [-11.4, -7.2, -2.5, 2.5, 7.2, 11.4]) {
      for (const cz of [gz - 3.3, gz + 3.3]) {
        stat.push(
          { p: [cx, 0.72, cz], s: [0.92, 0.26, 0.92], c: 0xe6e2d6, cyl: true, seg: 10 },
          { p: [cx, 3.25, cz], s: [0.64, 4.9, 0.64], c: 0xa0302a, cyl: true, seg: 10, top: 0.92 },
        );
      }
    }
    for (const gx of [-6.0, -3.0, 0, 3.0, 6.0]) {
      glow.push({ p: [gx, 9.7, gz - 2.74], s: [1.8, 1.35, 0.08], c: 0xffd080, noAO: true });
    }
    for (const lx of [-7.6, -3.2, 3.2, 7.6]) {
      glow.push({ p: [lx, 5.1, gz - 3.5], s: [0.55, 0.75, 0.55], c: 0xe04228, sphere: true, detail: 0, noAO: true });
    }

    // Imperial Red Screen Wall (影壁) behind central arch at [0, 0, 15.2] + Warm「為人民服務」plaque
    stat.push(
      { p: [0, 0.35, 15.2], s: [11.6, 0.70, 1.2], c: 0x8d887d, tex: 'ashlarStone' },
      { p: [0, 2.85, 15.2], s: [11.0, 4.4, 0.85], c: 0x8e2b22, tex: 'palaceWall' },
      { p: [0, 5.35, 15.2], s: [1.5, 0.72, 11.6], c: 0xd4a028, prism: true, ry: H, tex: 'roofTile' },
      { p: [0, 2.85, 14.74], s: [6.4, 1.52, 0.14], c: 0xcfa442 },
    );
    simpleTextSign(s, '為人民服務', 0, 2.85, 14.66, 6.0, 1.32, '#8a1e16', '#f7d86e', Math.PI);

    // Twin Sculpted Qing Stone Lions (campusArch.ts) + Respectful Mourning Wreaths
    stat.push(
      ...place(stoneLion(false), -5.2, 6.6),
      ...place(stoneLion(true), 5.2, 6.6),
      ...mourningWreathParts(-8.6, 4.8),
      ...mourningWreathParts(-6.9, 5.0),
      ...mourningWreathParts(6.9, 5.0),
      ...mourningWreathParts(8.6, 4.8),
    );

    // South-side 1980s Beijing ministry/avenue buildings & Zhongnanhai inner roofs behind screen wall
    for (const [bx, bz, bw, bh, bd, col] of [
      [-34, -33, 28, 22, 16, 0x9b9282],
      [0, -34, 34, 24, 16, 0xa89f8e],
      [36, -33, 28, 21, 16, 0x92897a],
    ] as [number, number, number, number, number, number][]) {
      stat.push({ p: [bx, bh * 0.5, bz], s: [bw, bh, bd], c: col, tex: 'plaster' });
      glow.push({ p: [bx, bh * 0.62, bz + bd * 0.51], s: [bw * 0.7, 1.6, 0.15], c: 0xffcf7a, noAO: true });
    }
    stat.push(
      { p: [-18, 6.0, 24], s: [24, 12, 12], c: 0x8a2820, tex: 'palaceWall' },
      { p: [-18, 13.5, 24], s: [26, 3.0, 14], c: 0xd4a028, roof: true, tex: 'roofTile' },
      { p: [18, 5.5, 25], s: [22, 11, 12], c: 0x8a2820, tex: 'palaceWall' },
      { p: [18, 12.5, 25], s: [24, 2.8, 14], c: 0xd4a028, roof: true, tex: 'roofTile' },
    );

    // Overhead trolleybus wires + distant avenue-end blocks
    stat.push(...wiresParts(-64, 64, [-5.4, -6.2, -12.8, -13.6], 1.8, -18.8, 24, 0));
    stat.push(
      { p: [-72, 9, -8], s: [12, 18, 48], c: 0x454346 },
      { p: [72, 9, -8], s: [12, 18, 48], c: 0x454346 },
    );

    addLayeredParts(s, stat);
    if (glow.length) s.add(new THREE.Mesh(mergeParts(glow), glowMat()));

    // Huadeng Ornate Lotus Lamps + Street Lamps + Avenue White Poplars
    const hdPos = [
      { x: -34, z: 1.5 },
      { x: -16, z: 1.5 },
      { x: 16, z: 1.5 },
      { x: 34, z: 1.5 },
      { x: -34, z: -18.2 },
      { x: -16, z: -18.2 },
      { x: 16, z: -18.2 },
      { x: 34, z: -18.2 },
    ];
    s.add(instanced(mergeParts(huadengPole()), litMat(), hdPos));
    s.add(instanced(mergeParts(huadengGlobes()), glowMat(), hdPos));

    const lamps = [
      { x: -46, z: 1.4 },
      { x: 46, z: 1.4 },
      { x: -46, z: -18.4, ry: Math.PI },
      { x: 46, z: -18.4, ry: Math.PI },
    ];
    s.add(instanced(mergeParts(lampPole()), litMat(), lamps));
    s.add(instanced(mergeParts(lampHead()), glowMat(), lamps));

    const pops: { x: number; z: number; ry: number }[] = [];
    for (let x = -48; x <= 48; x += 12) {
      if (Math.abs(x) >= 18) pops.push({ x, z: 2.8, ry: r() * 6 });
      pops.push({ x: x + 4, z: -20.6, ry: r() * 6 });
    }
    addRealisticTrees(s, pops, true, true);

    // Dusk Student & Citizen Vigil Group along Forecourt Apron (keeping center & spawn clear)
    const sitters: { x: number; z: number; ry: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const side = i < 12 ? -1 : 1;
      const sx = side * (3.6 + (i % 6) * 1.45);
      const sz = 2.0 + Math.floor((i % 12) / 6) * 1.25;
      sitters.push({ x: sx, z: sz, ry: -H + (r() - 0.5) * 0.4 });
    }
    const sitMesh = instanced(mergeParts(sitPersonLod(0xf4f2ec, true)), tintLitMat(), sitters);
    const sitCols = [C.navy, C.khaki, 0x4e5a4a, 0x6a2f3a, 0x5d4c3a];
    sitters.forEach((_, i) => sitMesh.setColorAt(i, new THREE.Color(sitCols[i % sitCols.length])));
    s.add(sitMesh);

    // 16 Moving bikeLod Riders + 2 Animated Trolleybuses on West Chang'an Avenue
    const N = 16;
    const riders = new THREE.InstancedMesh(mergeParts(bikeLod(C.navy)), litMat(), N);
    const rs = Array.from({ length: N }, (_, i) => ({
      x: -58 + r() * 116,
      z: i % 2 === 0 ? -1.1 - r() * 0.6 : -17.9 + r() * 0.6,
      v: (i % 2 === 0 ? -1 : 1) * (3.2 + r() * 1.6),
    }));
    s.add(riders);

    const tbs = [0, 1].map(i => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(mergeParts(trolleybus()), litMat()), new THREE.Mesh(mergeParts(trolleyWindows()), glowMat()));
      g.position.set(i === 0 ? 40 : -45, 0, i === 0 ? -5.8 : -13.2);
      if (i === 0) g.rotation.y = Math.PI;
      s.add(g);
      return g;
    });

    const dummy = new THREE.Object3D();
    const syncRiders = (t: number) => {
      for (let i = 0; i < N; i++) {
        const b = rs[i]!;
        dummy.position.set(b.x, Math.sin(t * 9 + i) * 0.015, b.z);
        dummy.rotation.set(0, b.v > 0 ? 0 : Math.PI, 0);
        dummy.updateMatrix();
        riders.setMatrixAt(i, dummy.matrix);
      }
      riders.instanceMatrix.needsUpdate = true;
    };
    syncRiders(0);

    // Warm Dusk Floodlights illuminating Xinhua Gate &「為人民服務」Screen Wall
    addPointLight(s, 0xffd288, 22, 26, 0, 5.2, 4.0);
    addPointLight(s, 0xffcc78, 18, 16, 0, 4.2, 13.4);
    addPointLight(s, 0xffc876, 16, 22, -16, 6.2, 1.5);
    addPointLight(s, 0xffc876, 16, 22, 16, 6.2, 1.5);

    const occluders: AABB6[] = [
      [-12.5, -2.5, 0, 11.5, 7.2, 13.8],   // Xinhua Gate West Wing
      [2.5, 12.5, 0, 11.5, 7.2, 13.8],     // Xinhua Gate East Wing
      [-13.5, 13.5, 5.0, 14.8, 7.0, 14.0], // Xinhua Gate Upper Story & Roof
      [-6.0, 6.0, 0, 5.4, 14.5, 15.9],     // Red Screen Wall (為人民服務)
      [-65, -12.5, 0, 5.8, 7.2, 9.2],      // West Imperial Red Wall
      [12.5, 65, 0, 5.8, 7.2, 9.2],        // East Imperial Red Wall
      [-6.0, -4.4, 0, 2.6, 5.5, 7.7],      // West Stone Lion
      [4.4, 6.0, 0, 2.6, 5.5, 7.7],        // East Stone Lion
    ];

    const camInfo = resolveCam(meta, 14, { h: 0.48, ahead: 10, y: 1.5 });
    const world: World = {
      id,
      scene: s,
      spawn: meta?.spawn ?? [-20, -10],
      bounds: meta?.bounds ?? XINHUA_BOUNDS,
      atmosphere: atmo,
      camDist: camInfo.camDist,
      cam: camInfo.cam,
      occluders,
      colliders: [
        { kind: 'box', minX: -25.2, maxX: -8.4, minZ: 3.95, maxZ: 4.45 },
        { kind: 'box', minX: 8.4, maxX: 25.2, minZ: 3.95, maxZ: 4.45 },
        { kind: 'box', minX: -58, maxX: -16, minZ: -2.55, maxZ: -2.25 },
        { kind: 'box', minX: 16, maxX: 58, minZ: -2.55, maxZ: -2.25 },
        { kind: 'box', minX: -58, maxX: -16, minZ: -16.75, maxZ: -16.45 },
        { kind: 'box', minX: 16, maxX: 58, minZ: -16.75, maxZ: -16.45 },
      ],
      update(dt, t) {
        for (let i = 0; i < N; i++) {
          const b = rs[i]!;
          b.x += b.v * dt;
          if (b.x > 62) b.x = -62;
          if (b.x < -62) b.x = 62;
        }
        syncRiders(t);
        tbs[0]!.position.x -= 6.5 * dt;
        if (tbs[0]!.position.x < -72) tbs[0]!.position.x = 72;
        tbs[1]!.position.x += 6.5 * dt;
        if (tbs[1]!.position.x > 72) tbs[1]!.position.x = -72;
      },
    };
    return world;
  });

  result.dispose = makeWorldDispose(result.scene, poolKeys);
  return result;
}

/** Register all 4 Wave 2 Journalist & Central Beijing 3D scene builders. */
export function registerJournalistSets(): void {
  registerSceneBuilder('beijing_hotel_balcony', buildBeijingHotelBalcony);
  registerSceneBuilder('newsroom', buildNewsroom);
  registerSceneBuilder('overpass', buildOverpass);
  registerSceneBuilder('xinhua_gate', buildXinhuaGate);
}
