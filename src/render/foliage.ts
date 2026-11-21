import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C, litMat, mergeParts, rng, type Part } from './kit';

const foliageUniforms = {
  uTime: { value: 0 },
};

export function updateFoliageWind(t: number): void {
  foliageUniforms.uTime.value = t;
}

function strut(a: [number, number, number], b: [number, number, number], thick: number, c: number, seg = 5, top = 0.65): Part {
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
    top,
    open: true,
    rz,
    ry,
  };
}

let cachedFoliageMat: THREE.MeshStandardMaterial | null = null;
let cachedLeafTex: THREE.CanvasTexture | null = null;
let cachedLeafNorm: THREE.CanvasTexture | null = null;

function buildFoliageTextures(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  if (cachedLeafTex && cachedLeafNorm) {
    return { map: cachedLeafTex, normalMap: cachedLeafNorm };
  }

  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;

  const hc = document.createElement('canvas');
  hc.width = S;
  hc.height = S;
  const hg = hc.getContext('2d')!;

  g.clearRect(0, 0, S, S);
  hg.fillStyle = '#000000';
  hg.fillRect(0, 0, S, S);

  const r = rng(19890504);

  // Subtle dark woody twigs radiating out from center bottom
  g.strokeStyle = '#3c3024';
  g.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI * 0.85 + (i / 15) * Math.PI * 0.7;
    const len = 90 + r() * 140;
    const x1 = 256 + (r() - 0.5) * 40;
    const y1 = 285 + (r() - 0.5) * 36;
    const x2 = x1 + Math.cos(a) * len;
    const y2 = y1 + Math.sin(a) * len * 0.85;
    g.lineWidth = 2.5 + r() * 3.5;
    g.beginPath();
    g.moveTo(x1, y1);
    g.quadraticCurveTo((x1 + x2) * 0.5 + (r() - 0.5) * 26, (y1 + y2) * 0.5, x2, y2);
    g.stroke();
  }

  // Paint ~620 layered serrated/elliptical leaves in rich spring olive/moss/sunlit tones
  const palette = [
    '#24381c', '#2c4322', '#344f27', '#3b582c',
    '#436132', '#4c6d38', '#56783f', '#283d1f',
  ];
  for (let i = 0; i < 620; i++) {
    const ang = r() * Math.PI * 2;
    const rad = Math.pow(r(), 0.62) * 218;
    const lx = 256 + Math.cos(ang) * rad * 1.02;
    const ly = 252 + Math.sin(ang) * rad * 0.94;
    if (lx < 20 || lx > 492 || ly < 20 || ly > 492) continue;

    // Fade density gracefully toward perimeter so edges break into airy real leaf silhouettes
    const edgeFactor = Math.max(0, 1 - rad / 228);
    if (rad > 175 && r() > edgeFactor * 2.2) continue;

    const leafLen = 11 + r() * 16;
    const leafWid = leafLen * (0.40 + r() * 0.22);
    const leafRot = ang + (r() - 0.5) * 1.4;
    const colIdx = Math.min(palette.length - 1, Math.floor((r() * 0.7 + (1 - ly / 512) * 0.35) * palette.length));

    g.save();
    g.translate(lx, ly);
    g.rotate(leafRot);
    g.fillStyle = palette[colIdx]!;
    g.beginPath();
    g.moveTo(-leafLen * 0.5, 0);
    g.quadraticCurveTo(0, -leafWid, leafLen * 0.5, 0);
    g.quadraticCurveTo(0, leafWid, -leafLen * 0.5, 0);
    g.fill();

    // Central leaf vein highlight
    g.strokeStyle = 'rgba(182, 206, 134, 0.24)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(-leafLen * 0.42, 0);
    g.lineTo(leafLen * 0.42, 0);
    g.stroke();
    g.restore();

    const hLum = Math.round(135 + (1 - ly / 512) * 90);
    hg.save();
    hg.translate(lx, ly);
    hg.rotate(leafRot);
    hg.fillStyle = `rgb(${hLum},${hLum},${hLum})`;
    hg.beginPath();
    hg.ellipse(0, 0, leafLen * 0.46, leafWid * 0.85, 0, 0, Math.PI * 2);
    hg.fill();
    hg.restore();
  }

  // Sobel normal map from leaf height field
  const nCanvas = document.createElement('canvas');
  nCanvas.width = S;
  nCanvas.height = S;
  const ng = nCanvas.getContext('2d')!;
  const src = hg.getImageData(0, 0, S, S).data;
  const dstImg = ng.createImageData(S, S);
  const dst = dstImg.data;
  const sample = (x: number, y: number): number => {
    const cx = Math.min(S - 1, Math.max(0, x));
    const cy = Math.min(S - 1, Math.max(0, y));
    return src[(cy * S + cx) * 4]! / 255;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (sample(x + 1, y) - sample(x - 1, y)) * 2.2;
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * 2.2;
      let nx = -dx, ny = -dy, nz = 1.0;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv; ny *= inv; nz *= inv;
      const idx = (y * S + x) * 4;
      dst[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  ng.putImageData(dstImg, 0, 0);

  cachedLeafTex = new THREE.CanvasTexture(c);
  cachedLeafTex.colorSpace = THREE.SRGBColorSpace;
  cachedLeafTex.anisotropy = 4;
  cachedLeafTex.userData.shared = true;

  cachedLeafNorm = new THREE.CanvasTexture(nCanvas);
  cachedLeafNorm.colorSpace = THREE.NoColorSpace;
  cachedLeafNorm.anisotropy = 4;
  cachedLeafNorm.userData.shared = true;

  return { map: cachedLeafTex, normalMap: cachedLeafNorm };
}

export function getFoliageMaterial(): THREE.MeshStandardMaterial {
  if (!cachedFoliageMat) {
    const { map, normalMap } = buildFoliageTextures();
    const mat = new THREE.MeshStandardMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.80,
      metalness: 0.02,
      vertexColors: true,
    });
    mat.userData.shared = true;
    mat.onBeforeCompile = shader => {
      shader.uniforms.uTime = foliageUniforms.uTime;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float swayAmp = max(0.0, (position.y - 2.2) * 0.018);
        #ifdef USE_INSTANCING
          float phase = instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.29 + position.x * 1.1;
        #else
          float phase = position.x * 1.1 + position.z * 0.7;
        #endif
        transformed.x += sin(uTime * 1.45 + phase) * swayAmp;
        transformed.z += cos(uTime * 1.15 + phase * 0.8) * swayAmp * 0.65;
        `
      );
    };
    cachedFoliageMat = mat;
  }
  return cachedFoliageMat;
}

/** Realistic organic multi-limb trunk parts (zero spheres). */
export function makeTreeTrunkParts(tall: boolean, lod = false): Part[] {
  if (!tall) {
    // Gnarled Chinese Scholar Tree (國槐): flared buttressed trunk + spreading boughs
    const seg = lod ? 5 : 7;
    const parts: Part[] = [
      { p: [0, 0.24, 0], s: [0.58, 0.48, 0.58], c: C.trunk, cyl: true, seg, top: 0.54, open: true },
      { p: [0, 1.48, 0], s: [0.35, 2.55, 0.35], c: C.trunk, cyl: true, seg, top: 0.64, rz: 0.05, open: true },
      strut([0.04, 2.30, 0], [-1.15, 3.65, 0.65], 0.16, C.trunk, lod ? 4 : 6, 0.55),
      strut([0.04, 2.40, 0], [1.20, 3.60, 0.40], 0.16, C.trunk, lod ? 4 : 6, 0.55),
      strut([0.02, 2.45, 0], [-0.18, 3.75, -1.10], 0.15, C.trunk, lod ? 4 : 6, 0.55),
    ];
    if (!lod) {
      parts.push(
        strut([-0.65, 3.10, 0.38], [-1.65, 4.35, 1.05], 0.09, C.trunk, 5, 0.45),
        strut([0.72, 3.05, 0.25], [1.72, 4.30, -0.35], 0.09, C.trunk, 5, 0.45),
      );
    }
    return parts;
  }

  // Avenue White Poplar (毛白楊): pale smooth-furrowed trunk with dark diamond bark collars + rising boughs
  const bark = 0x625c4e;
  const seg = lod ? 5 : 7;
  const parts: Part[] = [
    { p: [0, 0.24, 0], s: [0.48, 0.48, 0.48], c: 0x4b463c, cyl: true, seg, top: 0.72, open: true },
    { p: [0, 3.65, 0], s: [0.33, 7.2, 0.33], c: bark, cyl: true, seg, top: 0.48, open: true },
    strut([0, 2.95, 0], [0.68, 5.15, 0.42], 0.11, bark, 5, 0.5),
    strut([0, 3.45, 0], [-0.62, 5.85, -0.38], 0.10, bark, 5, 0.5),
    strut([0, 4.15, 0], [0.25, 6.75, -0.58], 0.09, bark, 5, 0.45),
  ];
  if (!lod) {
    parts.push(
      { p: [0, 1.45, 0], s: [0.32, 0.12, 0.32], c: 0x35312a, cyl: true, seg, open: true },
      { p: [0, 2.55, 0], s: [0.29, 0.11, 0.29], c: 0x35312a, cyl: true, seg, open: true },
    );
  }
  return parts;
}

/** Organic intersecting 3D foliage cluster planes with baked canopy crown-to-interior color gradient. */
export function makeTreeCanopyGeo(tall: boolean, lod = false): THREE.BufferGeometry {
  const clusters: Array<{ pos: [number, number, number]; scale: number; tint: number }> = tall
    ? lod
      ? [
          { pos: [0.15, 3.9, 0.10], scale: 2.3, tint: 0.84 },
          { pos: [-0.35, 4.8, -0.25], scale: 2.5, tint: 0.94 },
          { pos: [0.38, 5.4, 0.28], scale: 2.5, tint: 1.02 },
          { pos: [-0.22, 6.4, 0.18], scale: 2.2, tint: 1.08 },
          { pos: [0.12, 7.5, -0.10], scale: 1.9, tint: 1.12 },
        ]
      : [
          { pos: [0.20, 3.7, 0.12], scale: 2.2, tint: 0.80 },
          { pos: [-0.42, 4.4, -0.26], scale: 2.4, tint: 0.88 },
          { pos: [0.46, 5.0, 0.30], scale: 2.5, tint: 0.96 },
          { pos: [-0.30, 5.7, 0.26], scale: 2.3, tint: 1.02 },
          { pos: [0.24, 6.5, -0.28], scale: 2.1, tint: 1.08 },
          { pos: [-0.14, 7.3, 0.08], scale: 1.9, tint: 1.12 },
          { pos: [0.04, 8.1, -0.04], scale: 1.5, tint: 1.15 },
        ]
    : lod
      ? [
          { pos: [0, 4.15, 0], scale: 3.1, tint: 0.92 },
          { pos: [-1.15, 3.85, 0.65], scale: 2.3, tint: 0.96 },
          { pos: [1.15, 3.85, 0.42], scale: 2.3, tint: 1.02 },
          { pos: [0.10, 4.95, -0.35], scale: 2.4, tint: 1.12 },
        ]
      : [
          { pos: [0, 4.15, 0], scale: 3.0, tint: 0.88 },
          { pos: [0.22, 5.00, -0.16], scale: 2.6, tint: 1.10 },
          { pos: [-1.20, 3.92, 0.68], scale: 2.3, tint: 0.98 },
          { pos: [1.22, 3.90, 0.46], scale: 2.3, tint: 1.04 },
          { pos: [0.68, 4.40, -0.92], scale: 2.1, tint: 0.95 },
          { pos: [-0.80, 4.30, -0.88], scale: 2.1, tint: 0.94 },
          { pos: [-0.15, 5.35, 0.25], scale: 2.0, tint: 1.15 },
        ];

  const geos: THREE.BufferGeometry[] = [];
  const baseAngles = lod ? [0.25, 1.82] : [0.2, 1.25, 2.3];

  for (let ci = 0; ci < clusters.length; ci++) {
    const cl = clusters[ci]!;
    for (let ai = 0; ai < baseAngles.length; ai++) {
      const plane = new THREE.PlaneGeometry(cl.scale, cl.scale * 0.88);
      plane.rotateX((ci % 2 === 0 ? 1 : -1) * 0.28 + (ai - 1) * 0.22);
      plane.rotateY(baseAngles[ai]! + ci * 0.55);
      plane.translate(cl.pos[0], cl.pos[1], cl.pos[2]);

      const nonIdx = plane.toNonIndexed();
      plane.dispose();
      const posAttr = nonIdx.getAttribute('position');
      const cols = new Float32Array(posAttr.count * 3);
      for (let v = 0; v < posAttr.count; v++) {
        const y = posAttr.getY(v);
        const hShade = 0.86 + Math.min(0.24, Math.max(0, (y - 3.0) * 0.055));
        const b = Math.min(1, cl.tint * hShade);
        cols[v * 3] = b * 0.95;
        cols[v * 3 + 1] = b;
        cols[v * 3 + 2] = b * 0.92;
      }
      nonIdx.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      geos.push(nonIdx);
    }
  }

  const merged = mergeGeometries(geos)!;
  for (const g of geos) g.dispose();
  return merged;
}

/** Add realistic wind-swaying multi-branch trees via just 2 instanced draw calls (trunks + painted-leaf canopy). */
export function addRealisticTrees(
  scene: THREE.Scene,
  transforms: Array<{ x: number; z: number; y?: number; ry?: number; s?: number }>,
  tall: boolean,
  lod = false
): [THREE.InstancedMesh, THREE.InstancedMesh] | null {
  if (!transforms.length) return null;

  const trunkGeo = mergeParts(makeTreeTrunkParts(tall, lod));
  const canopyGeo = makeTreeCanopyGeo(tall, lod);

  const trunkMesh = new THREE.InstancedMesh(trunkGeo, litMat(), transforms.length);
  const canopyMesh = new THREE.InstancedMesh(canopyGeo, getFoliageMaterial(), transforms.length);

  const o = new THREE.Object3D();
  transforms.forEach((tr, i) => {
    o.position.set(tr.x, tr.y ?? 0, tr.z);
    o.rotation.set(0, tr.ry ?? 0, 0);
    o.scale.setScalar(tr.s ?? 1);
    o.updateMatrix();
    trunkMesh.setMatrixAt(i, o.matrix);
    canopyMesh.setMatrixAt(i, o.matrix);
  });
  trunkMesh.count = transforms.length;
  canopyMesh.count = transforms.length;
  trunkMesh.receiveShadow = true;

  scene.add(trunkMesh, canopyMesh);
  return [trunkMesh, canopyMesh];
}
