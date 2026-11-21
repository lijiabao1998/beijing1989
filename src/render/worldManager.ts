import * as THREE from 'three';
import { SCENE_META } from '../data';
import type { SceneId, SceneManifestEntry } from '../types';
import { SharedTexPool } from './materials';
import { buildScene, type World } from './scenes';
import { isSharedWallTexture } from './wallTextures';

const disposedWorlds = new WeakSet<World>();

function shouldDisposeTexture(tex: unknown): tex is THREE.Texture {
  if (!tex || typeof tex !== 'object') return false;
  const t = tex as THREE.Texture;
  if (!t.isTexture) return false;
  if (t.userData?.shared || t.userData?.pooled) return false;
  if (isSharedWallTexture(t)) return false;
  return Boolean(t.userData?.sceneOwned);
}

function disposeMaterial(mat: THREE.Material, disposedTexs: Set<THREE.Texture>): void {
  if (mat.userData?.shared) return;
  for (const val of Object.values(mat)) {
    if (shouldDisposeTexture(val) && !disposedTexs.has(val)) {
      disposedTexs.add(val);
      val.dispose();
    }
  }
  mat.dispose();
}

/**
 * Dispose non-shared BufferGeometry, Material, and scene-owned CanvasTextures
 * in an Object3D subtree while leaving shared wallTextures and pooled textures intact.
 */
export function disposeObjectTree(obj: THREE.Object3D): void {
  const disposedGeos = new Set<THREE.BufferGeometry>();
  const disposedMats = new Set<THREE.Material>();
  const disposedTexs = new Set<THREE.Texture>();

  obj.traverse(node => {
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
        if (m && !disposedMats.has(m)) {
          disposedMats.add(m);
          disposeMaterial(m, disposedTexs);
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
}

/** Dispose scene resources (background/environment scene-owned textures + object tree) and clear children. */
export function disposeScene(scene: THREE.Scene): void {
  if (shouldDisposeTexture(scene.background)) {
    scene.background.dispose();
    scene.background = null;
  }
  if (shouldDisposeTexture(scene.environment)) {
    scene.environment.dispose();
    scene.environment = null;
  }
  const atmoKey = scene.userData?.__atmoSkyKey as string | undefined;
  if (atmoKey) {
    SharedTexPool.release(atmoKey);
    delete scene.userData.__atmoSkyKey;
  }
  disposeObjectTree(scene);
  scene.clear();
}

/** Idempotently dispose a built World (calling world.dispose() for pool releases, then disposeScene). */
export function disposeWorld(world: World): void {
  if (disposedWorlds.has(world)) return;
  disposedWorlds.add(world);
  world.dispose?.();
  disposeScene(world.scene);
}

export interface WorldManagerOptions {
  maxCached?: number;
  sceneMeta?: Partial<Record<string, SceneManifestEntry>>;
  builder?: (id: string, meta?: SceneManifestEntry) => World;
}

/**
 * LRU scene cache (`maxCached = 3` default) that builds scenes on demand and
 * explicitly disposes evicted Three.js geometries, materials, and scene-owned textures.
 */
export class WorldManager {
  readonly maxCached: number;
  private readonly cache = new Map<string, World>();
  private readonly sceneMeta?: Partial<Record<string, SceneManifestEntry>>;
  private readonly builder: (id: string, meta?: SceneManifestEntry) => World;

  constructor(opts?: WorldManagerOptions) {
    this.maxCached = Math.max(1, opts?.maxCached ?? 3);
    this.sceneMeta = opts?.sceneMeta;
    this.builder = opts?.builder ?? buildScene;
  }

  get size(): number {
    return this.cache.size;
  }

  has(id: SceneId | string): boolean {
    return this.cache.has(id);
  }

  peek(id: SceneId | string): World | undefined {
    return this.cache.get(id);
  }

  getCachedIds(): string[] {
    return [...this.cache.keys()];
  }

  acquire(id: SceneId | string): World {
    const existing = this.cache.get(id);
    if (existing) {
      this.cache.delete(id);
      this.cache.set(id, existing);
      return existing;
    }

    while (this.cache.size >= this.maxCached) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      const oldest = this.cache.get(oldestKey)!;
      this.cache.delete(oldestKey);
      disposeWorld(oldest);
    }

    const fallbackRegistry = SCENE_META as Partial<Record<string, SceneManifestEntry>> | undefined;
    const meta = this.sceneMeta?.[id] ?? fallbackRegistry?.[id];

    let world: World;
    try {
      world = this.builder(id, meta);
    } catch {
      const campusMeta = this.sceneMeta?.campus ?? fallbackRegistry?.campus;
      world = this.builder('campus', campusMeta);
    }

    this.cache.set(id, world);
    return world;
  }

  evict(id: SceneId | string): boolean {
    const existing = this.cache.get(id);
    if (!existing) return false;
    this.cache.delete(id);
    disposeWorld(existing);
    return true;
  }

  clear(): void {
    for (const world of this.cache.values()) {
      disposeWorld(world);
    }
    this.cache.clear();
  }
}
