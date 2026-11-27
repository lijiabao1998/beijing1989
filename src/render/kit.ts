import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getWallTexSpec, makeWallMaterial, type WallTexKind } from './wallTextures';

export type { WallTexKind };

/** A part of a merged, vertex-coloured mesh: box (default), cylinder/cone, roof pyramid, prism, wedge, icosphere, torus, curved eave, or beveled box. */
export interface Part {
  p: [number, number, number];
  s: [number, number, number];
  c: number;
  tex?: WallTexKind;
  ry?: number; rx?: number; rz?: number;
  cyl?: boolean; seg?: number; top?: number; open?: boolean;
  roof?: boolean; prism?: boolean; wedge?: boolean;
  sphere?: boolean; detail?: number;
  torus?: boolean; tube?: number; arc?: number;
  eave?: boolean; curve?: number;
  bevel?: boolean;
  noAO?: boolean;
  tint?: boolean;
}

/** Unit symmetric A-frame triangular prism in [-0.5, 0.5]^3 (ridge along Z). */
function makePrism(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    -0.5, -0.5, 0.5,  0.5, -0.5, 0.5,  0, 0.5, 0.5,
    0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,  0, 0.5, -0.5,
    -0.5, -0.5, -0.5,  -0.5, -0.5, 0.5,  0, 0.5, 0.5,
    -0.5, -0.5, -0.5,  0, 0.5, 0.5,  0, 0.5, -0.5,
    0.5, -0.5, 0.5,  0.5, -0.5, -0.5,  0, 0.5, -0.5,
    0.5, -0.5, 0.5,  0, 0.5, -0.5,  0, 0.5, 0.5,
    -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5,  0.5, -0.5, 0.5,  -0.5, -0.5, 0.5,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/** Unit sloped wedge in [-0.5, 0.5]^3: tall edge at -X, tapering to bottom at +X. */
function makeWedge(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    -0.5, -0.5, 0.5,  0.5, -0.5, 0.5,  -0.5, 0.5, 0.5,
    0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,  -0.5, 0.5, -0.5,
    -0.5, -0.5, -0.5,  -0.5, -0.5, 0.5,  -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5,  -0.5, 0.5, 0.5,  -0.5, 0.5, -0.5,
    -0.5, 0.5, 0.5,  0.5, -0.5, 0.5,  0.5, -0.5, -0.5,
    -0.5, 0.5, 0.5,  0.5, -0.5, -0.5,  -0.5, 0.5, -0.5,
    -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5,  0.5, -0.5, 0.5,  -0.5, -0.5, 0.5,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/** Unit chamfered/beveled box in [-0.5, 0.5]^3 whose corner edges catch light highlights. */
function makeBevel(inset = 0.04): THREE.BufferGeometry {
  const h = 0.5, a = h - inset;
  const pos: number[] = [];
  type V3 = [number, number, number];
  const pushTri = (p0: V3, p1: V3, p2: V3) => {
    const cx = p0[0] + p1[0] + p2[0], cy = p0[1] + p1[1] + p2[1], cz = p0[2] + p1[2] + p2[2];
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * cx + ny * cy + nz * cz >= 0) pos.push(...p0, ...p1, ...p2);
    else pos.push(...p0, ...p2, ...p1);
  };
  const pushQuad = (p0: V3, p1: V3, p2: V3, p3: V3) => { pushTri(p0, p1, p2); pushTri(p0, p2, p3); };
  for (const s of [-1, 1]) {
    pushQuad([s * h, -a, -a], [s * h, a, -a], [s * h, a, a], [s * h, -a, a]);
    pushQuad([-a, s * h, -a], [a, s * h, -a], [a, s * h, a], [-a, s * h, a]);
    pushQuad([-a, -a, s * h], [a, -a, s * h], [a, a, s * h], [-a, a, s * h]);
  }
  for (const u of [-1, 1]) for (const v of [-1, 1]) {
    pushQuad([u * h, v * a, -a], [u * h, v * a, a], [u * a, v * h, a], [u * a, v * h, -a]);
    pushQuad([u * h, -a, v * a], [u * h, a, v * a], [u * a, a, v * h], [u * a, -a, v * h]);
    pushQuad([-a, u * h, v * a], [a, u * h, v * a], [a, u * a, v * h], [-a, u * a, v * h]);
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    pushTri([sx * h, sy * a, sz * a], [sx * a, sy * h, sz * a], [sx * a, sy * a, sz * h]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Unit Chinese curved hip-roof (廡殿頂/歇山頂) in [-0.5, 0.5]^3 with catenary sag, upturned corner eaves, and corrugated tile ribs. */
function makeEave(curve = 0.18): THREE.BufferGeometry {
  const cols = 24, rows = 6;
  const pos: number[] = [];
  const idx: number[] = [];
  const eaveY = (x: number, z: number, u: number, ripple: number) => {
    const sag = curve * 4 * u * (1 - u);
    const ax = Math.abs(x), az = Math.abs(z);
    const cf = ax > 0.35 && az > 0.35 ? ((ax - 0.35) / 0.15) * ((az - 0.35) / 0.15) : 0;
    return 0.5 - u - sag + 0.14 * cf + ripple;
  };
  const edgePts: [number, number, number][][] = [[], [], [], []];
  const pushVertex = (x: number, y: number, z: number) => { pos.push(x, y, z); return pos.length / 3 - 1; };

  // Front (-Z) and Back (+Z) trapezoidal slopes
  for (const kind of [0, 1]) {
    const base = pos.length / 3;
    for (let r = 0; r <= rows; r++) {
      const u = r / rows;
      const hw = 0.24 + 0.26 * u;
      const z = (kind === 0 ? -0.5 : 0.5) * u;
      const rFade = r === 0 ? 0 : 1;
      for (let c = 0; c <= cols; c++) {
        const s = c / cols;
        const x = (s * 2 - 1) * hw;
        const cFade = c === 0 || c === cols ? 0 : 1;
        const ripple = 0.015 * rFade * cFade * (0.5 + 0.5 * Math.sin(s * 12 * Math.PI));
        const y = eaveY(x, z, u, ripple);
        pos.push(x, y, z);
        if (r === rows) edgePts[kind].push([x, y, z]);
      }
    }
    const stride = cols + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v00 = base + r * stride + c, v01 = v00 + 1;
        const v10 = v00 + stride, v11 = v10 + 1;
        if (kind === 0) { idx.push(v00, v01, v10, v01, v11, v10); }
        else { idx.push(v00, v10, v01, v01, v10, v11); }
      }
    }
  }

  // West (-X) and East (+X) triangular slopes sharing a single ridge apex vertex per side
  for (const kind of [2, 3]) {
    const signX = kind === 2 ? -1 : 1;
    const apex = pushVertex(signX * 0.24, eaveY(signX * 0.24, 0, 0, 0), 0);
    const gridBase = pos.length / 3;
    for (let r = 1; r <= rows; r++) {
      const u = r / rows;
      const x = signX * (0.24 + 0.26 * u);
      const hd = 0.5 * u;
      for (let c = 0; c <= cols; c++) {
        const s = c / cols;
        const z = (s * 2 - 1) * hd;
        const cFade = c === 0 || c === cols ? 0 : 1;
        const ripple = 0.015 * cFade * (0.5 + 0.5 * Math.sin(s * 12 * Math.PI));
        const y = eaveY(x, z, u, ripple);
        pos.push(x, y, z);
        if (r === rows) edgePts[kind].push([x, y, z]);
      }
    }
    const stride = cols + 1;
    for (let c = 0; c < cols; c++) {
      const v10 = gridBase + c, v11 = v10 + 1;
      if (kind === 2) idx.push(apex, v10, v11);
      else idx.push(apex, v11, v10);
    }
    for (let r = 1; r < rows; r++) {
      const rowOffset = (r - 1) * stride;
      for (let c = 0; c < cols; c++) {
        const v00 = gridBase + rowOffset + c, v01 = v00 + 1;
        const v10 = v00 + stride, v11 = v10 + 1;
        if (kind === 2) idx.push(v00, v10, v01, v01, v10, v11);
        else idx.push(v00, v01, v10, v01, v11, v10);
      }
    }
  }

  // Watertight underside cap following the flared eave perimeter
  const botCenter = pushVertex(0, -0.5, 0);
  for (let kind = 0; kind < 4; kind++) {
    const pts = edgePts[kind];
    const ringStart = pos.length / 3;
    for (const pt of pts) pos.push(pt[0], pt[1], pt[2]);
    const flip = kind === 1 || kind === 2;
    for (let c = 0; c < cols; c++) {
      const a = ringStart + c, b = a + 1;
      if (flip) idx.push(botCenter, b, a);
      else idx.push(botCenter, a, b);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Merge many coloured parts into ONE geometry (one draw call) with baked vertex shading, ground AO, and optional world-space architectural UVs. */
export function mergeParts(parts: Part[], texKind?: WallTexKind): THREE.BufferGeometry {
  if (!parts.length) return new THREE.BufferGeometry();
  const geos: THREE.BufferGeometry[] = [];
  const col = new THREE.Color();
  const uvSpec = texKind ? getWallTexSpec(texKind) : null;
  const isRoof = texKind === 'roofTile';
  const hasTint = parts.some(p => p.tint);

  for (const pt of parts) {
    let g: THREE.BufferGeometry;
    let keepSmooth = false;
    let indexedNormals = false;
    if (pt.eave) {
      g = makeEave(pt.curve ?? 0.18);
      indexedNormals = true;
    } else if (pt.bevel) {
      g = makeBevel();
    } else if (pt.torus) {
      g = new THREE.TorusGeometry(0.5, pt.tube ?? 0.08, pt.detail ?? 8, pt.seg ?? 18, pt.arc ?? Math.PI * 2);
      keepSmooth = true;
    } else if (pt.roof) {
      g = new THREE.CylinderGeometry(0, Math.SQRT1_2, 1, 4, 1);
      g.rotateY(Math.PI / 4);
    } else if (pt.prism) {
      g = makePrism();
    } else if (pt.wedge) {
      g = makeWedge();
    } else if (pt.sphere) {
      const detail = pt.detail ?? 1;
      g = new THREE.IcosahedronGeometry(0.5, detail);
      keepSmooth = detail >= 1;
    } else if (pt.cyl) {
      const seg = pt.seg ?? 8;
      g = new THREE.CylinderGeometry(0.5 * (pt.top ?? 1), 0.5, 1, seg, 1, pt.open);
      keepSmooth = seg >= 6;
    } else {
      g = new THREE.BoxGeometry(1, 1, 1);
    }

    if (!indexedNormals && g.index) g = g.toNonIndexed();
    g.scale(pt.s[0], pt.s[1], pt.s[2]);
    if (pt.rx) g.rotateX(pt.rx);
    if (pt.rz) g.rotateZ(pt.rz);
    if (pt.ry) g.rotateY(pt.ry);
    g.translate(pt.p[0], pt.p[1], pt.p[2]);

    if (!keepSmooth || !g.getAttribute('normal')) g.computeVertexNormals();
    if (indexedNormals && g.index) g = g.toNonIndexed();

    col.setHex(pt.c);
    const pos = g.getAttribute('position');
    const norm = g.getAttribute('normal');
    const n = pos.count;
    const arr = new Float32Array(n * 3);
    if (pt.noAO) {
      for (let i = 0; i < n; i++) {
        arr[i * 3] = col.r;
        arr[i * 3 + 1] = col.g;
        arr[i * 3 + 2] = col.b;
      }
    } else {
      const h = Math.sin(pt.p[0] * 12.9898 + pt.p[1] * 78.233 + pt.p[2] * 37.719) * 43758.5453;
      const micro = 0.975 + (h - Math.floor(h)) * 0.05;
      for (let i = 0; i < n; i++) {
        const vy = pos.getY(i);
        const nx = norm.getX(i), ny = norm.getY(i), nz = norm.getZ(i);
        const dir = 1.0 + ny * 0.08 + nx * 0.035 - nz * 0.025;
        const ao = vy > 0 && vy < 0.75 ? (0.84 + 0.16 * (vy / 0.75)) : 1.0;
        const f = micro * dir * ao;
        arr[i * 3] = Math.min(1, Math.max(0, col.r * f));
        arr[i * 3 + 1] = Math.min(1, Math.max(0, col.g * f));
        arr[i * 3 + 2] = Math.min(1, Math.max(0, col.b * f));
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (hasTint) {
      const tArr = new Float32Array(n);
      if (pt.tint) tArr.fill(1);
      g.setAttribute('aTint', new THREE.BufferAttribute(tArr, 1));
    }

    if (uvSpec) {
      const uvs = new Float32Array(n * 2);
      const { tileW, tileH } = uvSpec;
      for (let i = 0; i < n; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        const pz = pos.getZ(i);
        const anx = Math.abs(norm.getX(i));
        const any = Math.abs(norm.getY(i));
        const anz = Math.abs(norm.getZ(i));
        if (isRoof) {
          // Run tile flutes strictly down the roof slope and stack courses smoothly by elevation
          const alongEave = anx > anz ? pz : px;
          const downSlope = any > 0.96 ? (anx > anz ? px : pz) : py * 2.4;
          uvs[i * 2] = alongEave / tileW;
          uvs[i * 2 + 1] = downSlope / tileH;
        } else if (any > 0.72) {
          uvs[i * 2] = px / tileW;
          uvs[i * 2 + 1] = pz / tileH;
        } else if (anx > anz) {
          uvs[i * 2] = pz / tileW;
          uvs[i * 2 + 1] = py / tileH;
        } else {
          uvs[i * 2] = px / tileW;
          uvs[i * 2 + 1] = py / tileH;
        }
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    } else {
      g.deleteAttribute('uv');
    }

    geos.push(g);
  }
  return mergeGeometries(geos)!;
}

export const litMat = () => new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.82,
  metalness: 0.05,
});

/** Standard material that multiplies `instanceColor` ONLY where vertex attribute `aTint > 0.5` (preserving faces, hair & headbands). */
export function tintLitMat(): THREE.MeshStandardMaterial {
  const m = litMat();
  m.customProgramCacheKey = () => 'b89_tint_lit_v1';
  m.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float aTint;\n' + shader.vertexShader.replace(
      '#include <color_vertex>',
      `#if defined( USE_COLOR_ALPHA )
\tvColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
\tvColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
\tvColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
\tvColor.xyz *= mix( vec3( 1.0 ), instanceColor.xyz, clamp( aTint, 0.0, 1.0 ) );
#endif`,
    );
  };
  return m;
}

/** Back-to-back non-mirrored plane geometry (FrontSide readable from both front and reverse viewpoints in 1 draw call). */
export function makeTwoSidedPlaneGeo(w: number, h: number, gap = 0.008): THREE.BufferGeometry {
  const front = new THREE.PlaneGeometry(w, h);
  front.translate(0, 0, gap * 0.5);
  const back = new THREE.PlaneGeometry(w, h);
  back.rotateY(Math.PI);
  back.translate(0, 0, -gap * 0.5);
  const merged = mergeGeometries([front, back])!;
  front.dispose();
  back.dispose();
  return merged;
}

export const glowMat = () => new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });

/** Partition static parts by optional wall/roof texture kind and add minimal merged draw-call meshes. */
export function addLayeredParts(scene: THREE.Scene, parts: Part[], emissive = 0): void {
  const plain: Part[] = [];
  const buckets = new Map<WallTexKind, Part[]>();
  for (const pt of parts) {
    if (!pt.tex) {
      plain.push(pt);
    } else {
      let arr = buckets.get(pt.tex);
      if (!arr) {
        arr = [];
        buckets.set(pt.tex, arr);
      }
      arr.push(pt);
    }
  }
  if (plain.length) {
    const mat = emissive
      ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.05, emissive })
      : litMat();
    const m = new THREE.Mesh(mergeParts(plain), mat);
    m.receiveShadow = true;
    scene.add(m);
  }
  for (const [kind, bucket] of buckets) {
    const m = new THREE.Mesh(mergeParts(bucket, kind), makeWallMaterial(kind, emissive));
    m.receiveShadow = true;
    scene.add(m);
  }
}

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
  t.userData = { sceneOwned: true };
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
  plasterWhite: 0xf2efe5, enamel: 0xe8e6dc, redCross: 0xc2221a, brass: 0xc8a248, darkWood: 0x3e2a1c, slate: 0x45494e,
};

/** Move/rotate a part list into world space so it can join a merged static batch. */
export function place(parts: Part[], x: number, z: number, ry = 0, y = 0): Part[] {
  const c = Math.cos(ry), s = Math.sin(ry);
  return parts.map(pt => ({ ...pt, p: [x + pt.p[0] * c + pt.p[2] * s, y + pt.p[1], z - pt.p[0] * s + pt.p[2] * c] as [number, number, number], ry: (pt.ry ?? 0) + ry }));
}
