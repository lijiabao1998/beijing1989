import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = typeof window !== 'undefined' ? new GLTFLoader() : null;
const cache = new Map<string, Promise<THREE.Group | null>>();
const resolvedCache = new Map<string, THREE.Group>();

function resolveAssetUrl(url: string): string {
  const clean = url.replace(/^\/+/, '');
  const base = import.meta.env?.BASE_URL ?? './';
  if (!base || base === './') return `./${clean}`;
  return `${base.endsWith('/') ? base : `${base}/`}${clean}`;
}

function markSharedSubtree(root: THREE.Object3D): void {
  root.userData.shared = true;
  root.traverse((obj) => {
    obj.userData.shared = true;
    const m = obj as THREE.Mesh;
    if (m.geometry) m.geometry.userData.shared = true;
    if (m.material) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        mat.userData.shared = true;
        for (const val of Object.values(mat)) {
          if (val && typeof val === 'object' && (val as THREE.Texture).isTexture) {
            (val as THREE.Texture).userData.shared = true;
          }
        }
      }
    }
  });
}

function loadTemplate(url: string): Promise<THREE.Group | null> {
  if (!loader || typeof window === 'undefined') return Promise.resolve(null);
  const resolved = resolveAssetUrl(url);
  let p = cache.get(resolved);
  if (!p) {
    p = loader
      .loadAsync(resolved)
      .then((gltf) => {
        markSharedSubtree(gltf.scene);
        resolvedCache.set(resolved, gltf.scene);
        return gltf.scene;
      })
      .catch((err) => {
        console.warn('[glbCache] failed to load', resolved, err);
        return null;
      });
    cache.set(resolved, p);
  }
  return p;
}

if (typeof window !== 'undefined') {
  for (const url of [
    '/models/colab_hq/bj89_stone_lion.glb',
    '/models/colab_hq/bj89_huabiao.glb',
    '/models/colab_hq/bj89_bicycle_28.glb',
    '/models/colab_hq/bj89_cargo_tricycle.glb',
    '/models/colab_hq/bj89_trolleybus.glb',
    '/models/colab_hq/bj89_c6140_lathe.glb',
  ]) {
    void loadTemplate(url);
  }
}

export interface GlbAttachOpts {
  hideOnLoad?: THREE.Object3D[];
  yaw?: number;
  scale?: number;
  scaleVec?: [number, number, number];
  yOffset?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

function disposeDetachedFallback(obj: THREE.Object3D): void {
  obj.visible = false;
  obj.removeFromParent();
  obj.traverse((node) => {
    if (node.userData?.shared || node.userData?.persistent) return;
    const m = node as THREE.Mesh;
    if (m.geometry && !m.geometry.userData?.shared) {
      m.geometry.dispose();
    }
    if (m.material) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat && !mat.userData?.shared) {
          mat.dispose();
        }
      }
    }
  });
}

function applyTemplate(parent: THREE.Object3D, tmpl: THREE.Group, opts: GlbAttachOpts): void {
  const root = tmpl.clone(true);
  markSharedSubtree(root);
  if (opts.yaw) root.rotation.y = opts.yaw;
  if (opts.scaleVec) root.scale.set(...opts.scaleVec);
  else if (opts.scale && opts.scale !== 1) root.scale.setScalar(opts.scale);
  if (opts.yOffset) root.position.y = opts.yOffset;
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh) {
      if (opts.castShadow !== false) m.castShadow = true;
      if (opts.receiveShadow !== false) m.receiveShadow = true;
    }
  });
  for (const h of opts.hideOnLoad ?? []) disposeDetachedFallback(h);
  parent.add(root);
}

export function attachGlbReplacement(parent: THREE.Object3D, url: string, opts: GlbAttachOpts = {}): void {
  if (typeof window === 'undefined') return;
  const resolved = resolveAssetUrl(url);
  const immediate = resolvedCache.get(resolved);
  if (immediate) {
    applyTemplate(parent, immediate, opts);
    return;
  }
  loadTemplate(url).then((tmpl) => {
    if (!tmpl || !parent.parent) return;
    applyTemplate(parent, tmpl, opts);
  });
}
