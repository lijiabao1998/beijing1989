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

/**
 * Shared 256x256 matte alabaster-white featureless plaster head texture
 * (no eyes, eyebrows, nose, mouth, hair, or spectacles).
 */
export function getCharacterFaceTexture(profile: FaceProfile): THREE.CanvasTexture {
  let tex = faceCache.get(profile);
  if (tex) return tex;

  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;

  const baseGrad = g.createLinearGradient(0, 0, 0, S);
  baseGrad.addColorStop(0, '#f4f1ea');
  baseGrad.addColorStop(0.58, '#edeae1');
  baseGrad.addColorStop(1, '#ddd8cc');
  g.fillStyle = baseGrad;
  g.fillRect(0, 0, S, S);

  const rimGrad = g.createRadialGradient(S * 0.5, S * 0.48, 22, S * 0.5, S * 0.48, 108);
  rimGrad.addColorStop(0, 'rgba(255,255,252,0.22)');
  rimGrad.addColorStop(0.7, 'rgba(235,231,222,0)');
  rimGrad.addColorStop(1, 'rgba(182,176,164,0.16)');
  g.fillStyle = rimGrad;
  g.fillRect(0, 0, S, S);

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
