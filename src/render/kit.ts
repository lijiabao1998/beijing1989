import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** A part of a merged, vertex-coloured mesh: box (default) or cylinder. */
export interface Part { p: [number, number, number]; s: [number, number, number]; c: number; ry?: number; rx?: number; rz?: number; cyl?: boolean; seg?: number }

/** Merge many coloured parts into ONE geometry (one draw call). */
export function mergeParts(parts: Part[]): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  const col = new THREE.Color();
  for (const pt of parts) {
    let g: THREE.BufferGeometry = pt.cyl ? new THREE.CylinderGeometry(0.5, 0.5, 1, pt.seg ?? 8) : new THREE.BoxGeometry(1, 1, 1);
    g = g.toNonIndexed();
    g.scale(pt.s[0], pt.s[1], pt.s[2]);
    if (pt.rx) g.rotateX(pt.rx);
    if (pt.rz) g.rotateZ(pt.rz);
    if (pt.ry) g.rotateY(pt.ry);
    g.translate(pt.p[0], pt.p[1], pt.p[2]);
    col.setHex(pt.c);
    const n = g.getAttribute('position').count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('uv');
    geos.push(g);
  }
  return mergeGeometries(geos)!;
}

export const litMat = () => new THREE.MeshLambertMaterial({ vertexColors: true });
export const glowMat = () => new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });

/** Instanced copies of one merged geometry. */
export function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, xs: { x: number; z: number; ry?: number; y?: number; s?: number }[]) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, xs.length));
  const o = new THREE.Object3D();
  xs.forEach((t, i) => { o.position.set(t.x, t.y ?? 0, t.z); o.rotation.set(0, t.ry ?? 0, 0); o.scale.setScalar(t.s ?? 1); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
  m.count = xs.length;
  return m;
}

/** Canvas text texture for posters, signs and banners. */
export function textTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!; draw(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function vertText(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number) {
  g.font = `bold ${size}px "Noto Serif CJK TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",serif`;
  g.textAlign = 'center'; g.textBaseline = 'top';
  [...s].forEach((ch, i) => g.fillText(ch, x, y + i * size * 1.1));
}

export function rng(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

/** Simple palette, period colours (navy/khaki/grey cotton, faded red, sodium orange). */
export const C = {
  ground: 0x2a2a28, asphalt: 0x232326, brick: 0x6e675f, greyBrick: 0x56585a, plaster: 0x8a8272,
  red: 0x8c2a22, khaki: 0x7d7556, navy: 0x2a3348, green: 0x3c4a34, wood: 0x5a3e28, black: 0x141414,
  window: 0xffcf7a, sodium: 0xffb347, white: 0xe8e2d0, chrome: 0x9a9a98, busRed: 0x9a3a2a, busCream: 0xd8cfae,
  leaf: 0x2f3f26, trunk: 0x3d3328, paper: 0xe9e1cf,
};

/** Move/rotate a part list into world space so it can join a merged static batch. */
export function place(parts: Part[], x: number, z: number, ry = 0, y = 0): Part[] {
  const c = Math.cos(ry), s = Math.sin(ry);
  return parts.map(pt => ({ ...pt, p: [x + pt.p[0] * c + pt.p[2] * s, y + pt.p[1], z - pt.p[0] * s + pt.p[2] * c] as [number, number, number], ry: (pt.ry ?? 0) + ry }));
}
