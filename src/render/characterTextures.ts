import * as THREE from 'three';
import type { ViewpointId } from '../types';

export type FaceProfile = ViewpointId | 'npc';

const faceCache = new Map<FaceProfile, THREE.CanvasTexture>();
let fabricNormalCache: THREE.CanvasTexture | null = null;
let fabricRoughnessCache: THREE.CanvasTexture | null = null;

function shareTex(c: HTMLCanvasElement, srgb: boolean, repeat = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  t.userData.shared = true;
  t.userData.pooled = true;
  t.needsUpdate = true;
  return t;
}

interface FaceStyle {
  skinLight: string;
  skinMid: string;
  skinShadow: string;
  hairBase: string;
  hairHighlight: string;
  hairLineY: number;
  glasses?: 'wire' | 'tortoise';
  elderLines?: boolean;
  cheekWarmth: string;
}

const FACE_STYLES: Record<FaceProfile, FaceStyle> = {
  student: {
    skinLight: '#dfbaa0',
    skinMid: '#cfa380',
    skinShadow: '#a77b59',
    hairBase: '#181615',
    hairHighlight: 'rgba(92,86,82,0.34)',
    hairLineY: 96,
    glasses: 'wire',
    cheekWarmth: 'rgba(182,102,82,0.16)',
  },
  worker: {
    skinLight: '#d2a57f',
    skinMid: '#be8e68',
    skinShadow: '#936846',
    hairBase: '#191715',
    hairHighlight: 'rgba(84,78,74,0.28)',
    hairLineY: 90,
    cheekWarmth: 'rgba(168,92,66,0.18)',
  },
  journalist: {
    skinLight: '#dcbaa2',
    skinMid: '#caa080',
    skinShadow: '#9e7556',
    hairBase: '#161515',
    hairHighlight: 'rgba(88,84,82,0.32)',
    hairLineY: 94,
    glasses: 'tortoise',
    cheekWarmth: 'rgba(176,98,80,0.14)',
  },
  resident: {
    skinLight: '#dec0aa',
    skinMid: '#caa488',
    skinShadow: '#9e7a62',
    hairBase: '#222021',
    hairHighlight: 'rgba(168,166,172,0.44)',
    hairLineY: 92,
    elderLines: true,
    cheekWarmth: 'rgba(178,104,92,0.16)',
  },
  npc: {
    skinLight: '#d8b290',
    skinMid: '#c69974',
    skinShadow: '#9a7050',
    hairBase: '#1a1816',
    hairHighlight: 'rgba(84,80,76,0.28)',
    hairLineY: 93,
    cheekWarmth: 'rgba(172,96,76,0.14)',
  },
};

/**
 * Shared 256x256 equirectangular head/face texture aligned for Three.js SphereGeometry (+X front at u=0.5).
 */
export function getCharacterFaceTexture(profile: FaceProfile): THREE.CanvasTexture {
  let tex = faceCache.get(profile);
  if (tex) return tex;

  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;
  const st = FACE_STYLES[profile] ?? FACE_STYLES.npc;

  // Base skin wrap across equirectangular sphere
  const baseGrad = g.createLinearGradient(0, 82, 0, S);
  baseGrad.addColorStop(0, st.skinLight);
  baseGrad.addColorStop(0.55, st.skinMid);
  baseGrad.addColorStop(1, st.skinShadow);
  g.fillStyle = baseGrad;
  g.fillRect(0, 0, S, S);

  // Subtle ambient shadow toward jaw underside and sides of face
  const sideGrad = g.createRadialGradient(S * 0.5, S * 0.52, 20, S * 0.5, S * 0.52, 86);
  sideGrad.addColorStop(0, st.skinLight);
  sideGrad.addColorStop(0.65, 'rgba(0,0,0,0)');
  sideGrad.addColorStop(1, 'rgba(92,58,38,0.28)');
  g.fillStyle = sideGrad;
  g.fillRect(0, 80, S, S - 80);

  // Hair cap (crown) + sideburns + full back-hemisphere nape hair wrap down to collar line
  g.fillStyle = st.hairBase;
  g.fillRect(0, 0, S, st.hairLineY);
  // Back hemisphere (u=0..0.33 and u=0.67..1.0) extends down cleanly into the nape of the neck
  g.fillRect(0, st.hairLineY - 2, S * 0.33, S - st.hairLineY + 2);
  g.fillRect(S * 0.67, st.hairLineY - 2, S * 0.33, S - st.hairLineY + 2);
  // Subtle lower nape transition
  g.fillStyle = st.skinShadow;
  g.fillRect(S * 0.33, S - 18, S * 0.34, 18);

  // Rounded forehead hairline arch at u=0.5 (x=128)
  g.fillStyle = st.skinLight;
  g.beginPath();
  g.ellipse(128, 114, 34, 24, 0, Math.PI, Math.PI * 2);
  g.fill();

  // Natural parted fringe strands + temple silver streaks (especially for elder resident)
  g.fillStyle = st.hairBase;
  g.beginPath();
  g.moveTo(92, 102);
  g.quadraticCurveTo(112, 109, 134, 92);
  g.quadraticCurveTo(150, 108, 165, 102);
  g.lineTo(165, 86);
  g.lineTo(92, 86);
  g.closePath();
  g.fill();

  g.strokeStyle = st.hairHighlight;
  g.lineWidth = 2.2;
  for (let i = 0; i < 18; i++) {
    const x = 14 + i * 13;
    g.beginPath();
    g.moveTo(x, 12);
    g.quadraticCurveTo(x + 4, 52, x - 2, 88);
    g.stroke();
  }
  if (st.elderLines) {
    // Subtle silver temple tufts
    g.fillStyle = 'rgba(205,204,210,0.48)';
    g.fillRect(80, 106, 8, 28);
    g.fillRect(168, 106, 8, 28);
  }

  // Soft cheek & nose-bridge warmth
  for (const cx of [109, 147]) {
    const cg = g.createRadialGradient(cx, 150, 2, cx, 150, 16);
    cg.addColorStop(0, st.cheekWarmth);
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = cg;
    g.beginPath();
    g.arc(cx, 150, 16, 0, Math.PI * 2);
    g.fill();
  }

  // Expressive dark eyebrows
  g.fillStyle = '#241a15';
  g.beginPath();
  g.ellipse(112, 121, 10.5, 2.2, -0.06, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(144, 121, 10.5, 2.2, 0.06, 0, Math.PI * 2);
  g.fill();

  // Eye socket shadow, sclera, dark iris, and bright catchlight (at u=0.5 equator y~132)
  for (const ex of [112, 144]) {
    g.fillStyle = 'rgba(98,62,42,0.28)';
    g.beginPath();
    g.ellipse(ex, 132, 9.2, 5.2, 0, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = '#ebe4d8';
    g.beginPath();
    g.ellipse(ex, 132, 7.2, 3.6, 0, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = '#1b1411';
    g.beginPath();
    g.arc(ex, 132, 3.2, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = 'rgba(255,250,242,0.85)';
    g.beginPath();
    g.arc(ex + 1.1, 130.9, 1.05, 0, Math.PI * 2);
    g.fill();

    // Crisp upper eyelid lash line
    g.strokeStyle = '#241914';
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(ex, 134, 7.4, Math.PI * 1.12, Math.PI * 1.88);
    g.stroke();
  }

  // Nose bridge highlight & nostril shadow
  g.fillStyle = 'rgba(255,232,210,0.28)';
  g.fillRect(126.5, 131, 3, 21);
  g.fillStyle = 'rgba(116,74,50,0.38)';
  g.beginPath();
  g.ellipse(128, 155, 5.5, 2.4, 0, 0, Math.PI * 2);
  g.fill();

  // Composed mouth & lower lip shade
  g.fillStyle = 'rgba(136,72,62,0.72)';
  g.beginPath();
  g.ellipse(128, 173, 10.5, 2.3, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(92,48,38,0.45)';
  g.fillRect(119, 173, 18, 1.1);
  g.fillStyle = 'rgba(108,68,48,0.22)';
  g.beginPath();
  g.ellipse(128, 181, 6, 1.8, 0, 0, Math.PI * 2);
  g.fill();

  if (st.elderLines) {
    g.strokeStyle = 'rgba(112,74,54,0.28)';
    g.lineWidth = 1.2;
    for (const [x0, y0, x1, y1] of [
      [118, 155, 114, 171],
      [138, 155, 142, 171],
      [101, 132, 97, 135],
      [155, 132, 159, 135],
    ]) {
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
  }

  // 1980s wire-rim or dark tortoiseshell spectacles
  if (st.glasses) {
    g.strokeStyle = st.glasses === 'wire' ? '#4a4742' : '#261a14';
    g.lineWidth = st.glasses === 'wire' ? 1.8 : 2.5;
    for (const gx of [112, 144]) {
      g.beginPath();
      g.ellipse(gx, 132, 10.2, 8.2, 0, 0, Math.PI * 2);
      g.stroke();
    }
    // Nose bridge & temple arms
    g.beginPath();
    g.moveTo(122.2, 131); g.lineTo(133.8, 131);
    g.moveTo(101.8, 131); g.lineTo(78, 128);
    g.moveTo(154.2, 131); g.lineTo(178, 128);
    g.stroke();
  }

  tex = shareTex(c, true, 1);
  faceCache.set(profile, tex);
  return tex;
}

/** Shared 256x256 seamless woven cotton-twill/wool normal map for close-up period coats. */
export function getFabricNormalTexture(): THREE.CanvasTexture {
  if (fabricNormalCache) return fabricNormalCache;

  const S = 256;
  const hCanvas = document.createElement('canvas');
  hCanvas.width = hCanvas.height = S;
  const hg = hCanvas.getContext('2d')!;
  const hImg = hg.createImageData(S, S);
  const hd = hImg.data;

  // Fine 2/2 diagonal twill + organic cotton slub
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const twill = ((x + y * 2) % 8 < 4 ? 1 : -1) * 18;
      const cross = ((x * 2 - y + 512) % 8 < 4 ? 1 : -1) * 9;
      const grain = Math.sin(x * 0.45 + y * 0.22) * 8 + Math.cos(x * 0.19 - y * 0.51) * 6;
      const v = Math.max(20, Math.min(240, Math.round(128 + twill + cross + grain)));
      const idx = (y * S + x) * 4;
      hd[idx] = hd[idx + 1] = hd[idx + 2] = v;
      hd[idx + 3] = 255;
    }
  }
  hg.putImageData(hImg, 0, 0);

  const nCanvas = document.createElement('canvas');
  nCanvas.width = nCanvas.height = S;
  const ng = nCanvas.getContext('2d')!;
  const nImg = ng.createImageData(S, S);
  const nd = nImg.data;

  const sample = (x: number, y: number): number => {
    const wx = ((x % S) + S) % S;
    const wy = ((y % S) + S) % S;
    return hd[(wy * S + wx) * 4]! / 255;
  };

  const strength = 2.1;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (sample(x + 1, y - 1) + 2 * sample(x + 1, y) + sample(x + 1, y + 1))
        - (sample(x - 1, y - 1) + 2 * sample(x - 1, y) + sample(x - 1, y + 1));
      const dy = (sample(x - 1, y + 1) + 2 * sample(x, y + 1) + sample(x + 1, y + 1))
        - (sample(x - 1, y - 1) + 2 * sample(x, y - 1) + sample(x + 1, y - 1));
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv; ny *= inv; nz *= inv;
      const idx = (y * S + x) * 4;
      nd[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      nd[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nd[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nd[idx + 3] = 255;
    }
  }
  ng.putImageData(nImg, 0, 0);
  fabricNormalCache = shareTex(nCanvas, false, 3);
  return fabricNormalCache;
}

/** Shared 256x256 micro-roughness fabric texture matching the diagonal twill normal map. */
export function getFabricRoughnessTexture(): THREE.CanvasTexture {
  if (fabricRoughnessCache) return fabricRoughnessCache;

  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const weave = ((x + y * 2) % 8 < 4 ? 10 : -10) + Math.sin(x * 0.31 + y * 0.43) * 8;
      const v = Math.max(185, Math.min(246, Math.round(218 + weave)));
      const idx = (y * S + x) * 4;
      d[idx] = d[idx + 1] = d[idx + 2] = v;
      d[idx + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  fabricRoughnessCache = shareTex(c, false, 3);
  return fabricRoughnessCache;
}
