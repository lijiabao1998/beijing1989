import * as THREE from 'three';
import { SCENE_META } from '../data';
import type { World } from '../render/scenes';
import type { SceneId } from '../types';
import type { Player } from './player';

export type CamMode = 'cinema' | 'follow' | 'wide' | 'viewfinder';
export type LensMm = 35 | 50 | 85;
export type OccluderBox = readonly [number, number, number, number, number, number];
export type Vec3Like =
  | THREE.Vector3
  | readonly [number, number, number]
  | { readonly x: number; readonly y: number; readonly z: number };

export const LENS_FOV_DEG: Record<LensMm, number> = {
  35: 54,
  50: 40,
  85: 24,
};

export const LENS_ORDER: readonly LensMm[] = [35, 50, 85];

export const CAM_MODE_LABELS: Record<CamMode, string> = {
  cinema: '運鏡：電影',
  follow: '運鏡：跟隨',
  wide: '運鏡：全景',
  viewfinder: '運鏡：取景',
};

export interface CameraFrameOpts {
  sceneId: SceneId;
  world: World;
  player: Player;
  yaw: number;
  pitch?: number;     // vertical look pitch in radians (used by viewfinder)
  zoom: number;
  playing: boolean;
  inDialog: boolean;
  autoGuide: boolean;
  speed: number;
  dt: number;         // real frame dt (clamped <= 0.05)
  elapsed: number;    // monotonic seconds
  aspect: number;
  eyeHeight?: number; // viewfinder eye height in meters (default 1.62)
  npcPos?: [number, number] | null; // active nearby hotspot / NPC world (x, z)
  snap?: boolean;
}

export interface CameraFrameResult {
  wantsLetterbox: boolean;
  zoneName?: string;
}

interface Pose {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

interface ZoneEval {
  weight: number;
  name: string;
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
  lambdaScale?: number;
}

const MODE_ORDER: CamMode[] = ['cinema', 'follow', 'wide'];
const MIN_PITCH = -0.38;
const MAX_PITCH = 0.48;

const GATE_FOCUS = new THREE.Vector3(0, 4.6, -16);
const FACTORY_GATE_FOCUS = new THREE.Vector3(0, 4.0, -17.6);
const COURTYARD_GATE_FOCUS = new THREE.Vector3(0, 2.8, -12.6);

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function expAlpha(lambda: number, dt: number): number {
  return 1 - Math.exp(-lambda * Math.max(0, dt));
}

function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function smoothBoxWeight(
  px: number,
  pz: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  pad: number,
): number {
  const wx = smoothstep(minX - pad, minX, px) * (1 - smoothstep(maxX, maxX + pad, px));
  const wz = smoothstep(minZ - pad, minZ, pz) * (1 - smoothstep(maxZ, maxZ + pad, pz));
  return wx * wz;
}

function smoothCircleWeight(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  innerR: number,
  outerR: number,
): number {
  const d = Math.hypot(px - cx, pz - cz);
  return 1 - smoothstep(innerR, outerR, d);
}

function facingDot(yaw: number, fromX: number, fromZ: number, toX: number, toZ: number): number {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) return 1;
  return (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / len;
}

function unpackVec3(v: Vec3Like): [number, number, number] {
  if (Array.isArray(v)) return [v[0], v[1], v[2]];
  const obj = v as { x: number; y: number; z: number };
  return [obj.x, obj.y, obj.z];
}

function rayIntersectsAabb(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxT: number,
  box: OccluderBox,
): boolean {
  const [minX, maxX, minY, maxY, minZ, maxZ] = box;
  let tEnter = -Infinity;
  let tExit = Infinity;

  if (Math.abs(dx) < 1e-8) {
    if (ox < minX || ox > maxX) return false;
  } else {
    const inv = 1 / dx;
    let t1 = (minX - ox) * inv;
    let t2 = (maxX - ox) * inv;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tEnter = Math.max(tEnter, t1);
    tExit = Math.min(tExit, t2);
    if (tEnter > tExit) return false;
  }

  if (Math.abs(dy) < 1e-8) {
    if (oy < minY || oy > maxY) return false;
  } else {
    const inv = 1 / dy;
    let t1 = (minY - oy) * inv;
    let t2 = (maxY - oy) * inv;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tEnter = Math.max(tEnter, t1);
    tExit = Math.min(tExit, t2);
    if (tEnter > tExit) return false;
  }

  if (Math.abs(dz) < 1e-8) {
    if (oz < minZ || oz > maxZ) return false;
  } else {
    const inv = 1 / dz;
    let t1 = (minZ - oz) * inv;
    let t2 = (maxZ - oz) * inv;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tEnter = Math.max(tEnter, t1);
    tExit = Math.min(tExit, t2);
    if (tEnter > tExit) return false;
  }

  // Require positive entry before target surface so camera overhangs do not self-occlude
  return tEnter > 0.02 && tEnter < maxT && tExit >= tEnter;
}

/**
 * Pure CPU perspective-frustum + ray-vs-AABB occlusion test for 35mm Viewfinder PhotoTargets.
 * Avoids GPU readPixels() stalls completely.
 */
export function isPhotoTargetInViewfinder(
  camPos: Vec3Like,
  camDir: Vec3Like,
  fovDeg: number,
  aspect: number,
  targetPos3: Vec3Like,
  radius: number,
  maxDist: number,
  occluders?: readonly OccluderBox[],
): boolean {
  if (!Number.isFinite(fovDeg) || !Number.isFinite(aspect) || !Number.isFinite(maxDist)) return false;
  if (fovDeg <= 0 || fovDeg >= 179 || aspect <= 0 || maxDist <= 0) return false;

  const [cx, cy, cz] = unpackVec3(camPos);
  const [dfx, dfy, dfz] = unpackVec3(camDir);
  const [tx, ty, tz] = unpackVec3(targetPos3);

  const vx = tx - cx;
  const vy = ty - cy;
  const vz = tz - cz;
  const dist = Math.hypot(vx, vy, vz);
  if (!Number.isFinite(dist) || dist < 1e-4 || dist > maxDist) return false;

  const dirLen = Math.hypot(dfx, dfy, dfz);
  if (!Number.isFinite(dirLen) || dirLen < 1e-6) return false;
  const fx = dfx / dirLen;
  const fy = dfy / dirLen;
  const fz = dfz / dirLen;

  // Orthonormal camera basis: right = normalize(forward x up), camUp = right x forward
  const upRefX = 0;
  const upRefY = Math.abs(fy) > 0.995 ? 0 : 1;
  const upRefZ = Math.abs(fy) > 0.995 ? 1 : 0;

  let rx = fy * upRefZ - fz * upRefY;
  let ry = fz * upRefX - fx * upRefZ;
  let rz = fx * upRefY - fy * upRefX;
  const rLen = Math.hypot(rx, ry, rz);
  if (rLen < 1e-6) return false;
  rx /= rLen;
  ry /= rLen;
  rz /= rLen;

  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;

  const depth = vx * fx + vy * fy + vz * fz;
  if (depth <= 0.05) return false;

  const projX = vx * rx + vy * ry + vz * rz;
  const projY = vx * ux + vy * uy + vz * uz;

  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 0;
  const vHalf = (fovDeg * Math.PI) / 360;
  const sinV = Math.sin(vHalf);
  const cosV = Math.cos(vHalf);
  if (Math.abs(projY) * cosV - depth * sinV > safeRadius) return false;

  const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  const sinH = Math.sin(hHalf);
  const cosH = Math.cos(hHalf);
  if (Math.abs(projX) * cosH - depth * sinH > safeRadius) return false;

  if (occluders && occluders.length > 0) {
    const rdx = vx / dist;
    const rdy = vy / dist;
    const rdz = vz / dist;
    const maxOccDist = Math.max(0.05, dist - 0.25);
    for (let i = 0; i < occluders.length; i++) {
      if (rayIntersectsAabb(cx, cy, cz, rdx, rdy, rdz, maxOccDist, occluders[i]!)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Procedural film-grade camera director with frame-rate-independent exponential
 * damping, establishing crane/dolly intros, spatial landmark cinema zones,
 * velocity look-ahead, Rule-of-Thirds framing, 3/4 OTS dialogue shots, and 35mm viewfinder optics.
 */
export class CinemaCamera {
  mode: CamMode;
  lensMm: LensMm = 35;

  private preViewfinderMode: CamMode = 'cinema';
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private fov = 50;
  private initialized = false;

  private vel = new THREE.Vector2();
  private prevPlayerPos = new THREE.Vector2();
  private hasPrevPlayer = false;

  private sceneId: SceneId = 'campus';
  private enterYaw = 0;
  private enterPos = new THREE.Vector2();
  private introActive = false;
  private introTime = 0;
  private introDuration = 2.4;
  private introYielding = false;
  private pendingSnap = false;

  // Pre-allocated scratch poses/vectors to keep frame() allocation-free
  private readonly introStartPos = new THREE.Vector3();
  private readonly introStartLook = new THREE.Vector3();
  private introStartFov = 44;

  private readonly steadyPose: Pose = {
    pos: new THREE.Vector3(),
    look: new THREE.Vector3(),
    fov: 50,
  };
  private readonly followPose: Pose = {
    pos: new THREE.Vector3(),
    look: new THREE.Vector3(),
    fov: 50,
  };
  private readonly targetPose: Pose = {
    pos: new THREE.Vector3(),
    look: new THREE.Vector3(),
    fov: 50,
  };
  private readonly zoneScratchPos = new THREE.Vector3();
  private readonly zoneScratchLook = new THREE.Vector3();

  constructor(initialMode: CamMode = 'cinema') {
    this.mode = initialMode;
    if (initialMode !== 'viewfinder') {
      this.preViewfinderMode = initialMode;
    }
  }

  getMode(): CamMode {
    return this.mode;
  }

  getSceneId(): SceneId {
    return this.sceneId;
  }

  setMode(m: CamMode): void {
    const wasViewfinder = this.mode === 'viewfinder';
    if (m === 'viewfinder' && !wasViewfinder) {
      this.preViewfinderMode = this.mode;
    } else if (m !== 'viewfinder') {
      this.preViewfinderMode = m;
    }
    this.mode = m;
    if (m !== 'cinema') {
      this.introActive = false;
      this.introYielding = false;
    }
    if (m === 'viewfinder' || wasViewfinder) {
      this.pendingSnap = true;
    }
  }

  /** Cycle standard 3 gameplay camera modes ('cinema' -> 'follow' -> 'wide' -> 'cinema'); exits viewfinder to 'cinema'. */
  cycleMode(): CamMode {
    const idx = MODE_ORDER.indexOf(this.mode);
    const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length]!;
    this.setMode(next);
    return next;
  }

  /** Toggle 35mm Viewfinder mode on/off, restoring `prev` (or previous non-viewfinder mode) on exit. */
  toggleViewfinder(prev?: CamMode): CamMode {
    if (this.mode === 'viewfinder') {
      const restore = prev && prev !== 'viewfinder' ? prev : this.preViewfinderMode;
      this.setMode(restore);
    } else {
      if (prev && prev !== 'viewfinder') {
        this.preViewfinderMode = prev;
      }
      this.setMode('viewfinder');
    }
    return this.mode;
  }

  getLens(): LensMm {
    return this.lensMm;
  }

  getLensFov(): number {
    return LENS_FOV_DEG[this.lensMm];
  }

  setLens(mm: LensMm): void {
    this.lensMm = mm === 50 || mm === 85 ? mm : 35;
  }

  cycleLens(): LensMm {
    const idx = LENS_ORDER.indexOf(this.lensMm);
    const next = LENS_ORDER[(idx + 1) % LENS_ORDER.length]!;
    this.lensMm = next;
    return next;
  }

  /** Cancel any active intro glide and snap immediately on the next frame() call. */
  snapNow(): void {
    this.introActive = false;
    this.introYielding = false;
    this.pendingSnap = true;
  }

  /** Trigger a bespoke scene establishing crane/dolly glide without carrying over previous scene position. */
  onEnterScene(sceneId: SceneId, player: Player, defaultYaw: number): void {
    this.sceneId = sceneId;
    this.enterYaw = defaultYaw;
    this.enterPos.copy(player.pos);
    this.prevPlayerPos.copy(player.pos);
    this.hasPrevPlayer = true;
    this.vel.set(0, 0);
    this.pendingSnap = false;

    this.introDuration = SCENE_META[sceneId]?.introDuration ?? 2.4;
    this.introTime = 0;
    this.introYielding = false;
    this.introActive = this.mode === 'cinema';

    this.computeEstablishingStart(sceneId, player.pos.x, player.pos.y, 16 / 9);
    if (this.introActive) {
      this.pos.copy(this.introStartPos);
      this.look.copy(this.introStartLook);
      this.fov = this.introStartFov;
      this.initialized = true;
    } else {
      this.initialized = false;
    }
  }

  frame(cam: THREE.PerspectiveCamera, opts: CameraFrameOpts): CameraFrameResult {
    const dt = clamp(Number.isFinite(opts.dt) ? opts.dt : 0.016, 0, 0.05);
    const elapsed = Number.isFinite(opts.elapsed) ? opts.elapsed : 0;
    const aspect = clamp(Number.isFinite(opts.aspect) ? opts.aspect : 16 / 9, 0.35, 3.0);
    const zoom = clamp(Number.isFinite(opts.zoom) ? opts.zoom : 1, 0.45, 2.0);
    const snap = Boolean(opts.snap || this.pendingSnap || !this.initialized);
    this.pendingSnap = false;

    const px = opts.player.pos.x;
    const pz = opts.player.pos.y;

    // 1. Velocity tracker (resets cleanly on teleport jumps)
    let teleportJump = false;
    if (!this.hasPrevPlayer || snap) {
      this.prevPlayerPos.set(px, pz);
      this.hasPrevPlayer = true;
      this.vel.set(0, 0);
    } else {
      const dx = px - this.prevPlayerPos.x;
      const dz = pz - this.prevPlayerPos.y;
      const moved = Math.hypot(dx, dz);
      this.prevPlayerPos.set(px, pz);
      if (moved > 12) {
        this.vel.set(0, 0);
        teleportJump = moved > 30;
      } else if (dt > 1e-4) {
        const va = expAlpha(6.0, dt);
        this.vel.x += (dx / dt - this.vel.x) * va;
        this.vel.y += (dz / dt - this.vel.y) * va;
      }
    }

    if (snap || teleportJump) {
      this.introActive = false;
      this.introYielding = false;
    }

    // 2. Yield establishing intro smoothly if user starts steering/moving manually
    if (this.introActive && opts.playing) {
      const manualMoved = !opts.autoGuide && Math.hypot(px - this.enterPos.x, pz - this.enterPos.y) > 0.14;
      const manualYawed = !opts.autoGuide && Math.abs(angleDiff(opts.yaw, this.enterYaw)) > 0.04;
      if (manualMoved || manualYawed) this.introYielding = true;
      const rate = this.introYielding ? 4.2 : 1.0;
      this.introTime += dt * rate;
      if (this.introTime >= this.introDuration) {
        this.introActive = false;
        this.introYielding = false;
      }
    } else if (this.introActive && !opts.playing) {
      this.introActive = false;
    }

    const baseFov = aspect < 1 ? 62 : 50;
    const baseDist = (opts.world.camDist ?? 11) * zoom * (opts.playing ? 1 : 1.3);
    const gateFocus = this.getGateFocus(opts.sceneId, px, pz);

    let wantsLetterbox = false;
    let zoneName: string | undefined;
    let lambdaPos = 7.5;
    let lambdaLook = 9.5;
    let lambdaFov = 4.5;

    // 3. Evaluate steady-state pose for active mode
    if (this.mode === 'viewfinder') {
      this.computeViewfinderPose(this.steadyPose, opts);
      lambdaPos = 22;
      lambdaLook = 26;
      lambdaFov = 18;
    } else if (this.mode === 'follow') {
      this.computeFollowPose(this.steadyPose, opts, baseDist, baseFov, aspect, gateFocus);
      lambdaPos = 9.5;
      lambdaLook = 11.5;
      lambdaFov = 6.0;
    } else if (this.mode === 'wide') {
      this.computeWidePose(this.steadyPose, opts, baseDist, baseFov, aspect);
      lambdaPos = 5.5;
      lambdaLook = 7.0;
      lambdaFov = 4.0;
    } else {
      // 'cinema' mode
      const inDialogueOts = opts.playing && opts.inDialog && (!this.introActive || Boolean(opts.npcPos));
      if (inDialogueOts) {
        this.computeDialogueOtsPose(this.steadyPose, opts, zoom, baseFov);
        wantsLetterbox = true;
        lambdaPos = 4.6;
        lambdaLook = 6.2;
        lambdaFov = 4.4;
      } else {
        const res = this.computeCinemaExplorePose(this.steadyPose, opts, baseDist, zoom, baseFov, aspect, elapsed, gateFocus);
        zoneName = res.zoneName;
        wantsLetterbox = opts.playing && (this.introActive || res.maxWeight > 0.35);
        lambdaPos = res.maxWeight > 0.25 ? 4.8 : 7.2;
        lambdaLook = lambdaPos * 1.28;
        lambdaFov = 4.0;
      }
    }

    // 4. Blend establishing intro glide into steady-state pose
    if (this.mode === 'cinema' && this.introActive && opts.playing) {
      this.computeEstablishingStart(opts.sceneId, px, pz, aspect);
      const u = easeInOutCubic(this.introTime / Math.max(0.2, this.introDuration));
      this.targetPose.pos.lerpVectors(this.introStartPos, this.steadyPose.pos, u);
      this.targetPose.look.lerpVectors(this.introStartLook, this.steadyPose.look, u);
      this.targetPose.fov = this.introStartFov + (this.steadyPose.fov - this.introStartFov) * u;
      wantsLetterbox = true;
      lambdaPos = 10.5;
      lambdaLook = 12.5;
      lambdaFov = 7.0;
    } else {
      this.targetPose.pos.copy(this.steadyPose.pos);
      this.targetPose.look.copy(this.steadyPose.look);
      this.targetPose.fov = this.steadyPose.fov;
    }

    // 5. Subtle Steadicam / dolly breathing (<= 0.03m, zero when snapped or title screen)
    if (this.mode === 'cinema' && opts.playing && !snap) {
      const breathAmp = clamp((zoom - 0.35) * 0.85, 0.25, 1.0) * 0.022;
      this.targetPose.pos.x += Math.sin(elapsed * 0.83) * breathAmp * 0.65;
      this.targetPose.pos.y += Math.sin(elapsed * 1.17 + 0.9) * breathAmp;
      this.targetPose.pos.z += Math.cos(elapsed * 0.71 + 1.7) * breathAmp * 0.65;
    }

    // 6. Apply frame-rate-independent exponential smoothing or immediate snap
    if (snap || teleportJump) {
      this.pos.copy(this.targetPose.pos);
      this.look.copy(this.targetPose.look);
      this.fov = this.targetPose.fov;
      this.initialized = true;
    } else {
      const ap = expAlpha(lambdaPos, dt);
      const al = expAlpha(lambdaLook, dt);
      const af = expAlpha(lambdaFov, dt);
      this.pos.lerp(this.targetPose.pos, ap);
      this.look.lerp(this.targetPose.look, al);
      this.fov += (this.targetPose.fov - this.fov) * af;
    }

    // Prevent degenerate lookAt when camera and look target coincide
    if (this.pos.distanceToSquared(this.look) < 0.01) {
      this.pos.y += 1.5;
      this.pos.z -= 2.5;
    }

    cam.position.copy(this.pos);
    cam.lookAt(this.look);
    if (Math.abs(cam.fov - this.fov) > 0.02) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }

    return { wantsLetterbox, zoneName };
  }

  private computeViewfinderPose(out: Pose, opts: CameraFrameOpts): void {
    const px = opts.player.pos.x;
    const pz = opts.player.pos.y;
    const eyeY = Number.isFinite(opts.eyeHeight) ? (opts.eyeHeight as number) : 1.62;
    const pitch = clamp(Number.isFinite(opts.pitch ?? 0) ? (opts.pitch ?? 0) : 0, MIN_PITCH, MAX_PITCH);
    const cosP = Math.cos(pitch);
    const fx = Math.sin(opts.yaw) * cosP;
    const fy = Math.sin(pitch);
    const fz = Math.cos(opts.yaw) * cosP;

    out.pos.set(px, eyeY, pz);
    out.look.set(px + fx * 24, eyeY + fy * 24, pz + fz * 24);
    out.fov = LENS_FOV_DEG[this.lensMm];
  }

  private getGateFocus(sceneId: SceneId, px: number, pz: number): THREE.Vector3 | null {
    if ((sceneId === 'campus' || sceneId === 'aftermath') && pz < -18 && Math.abs(px) < 9.5) {
      return GATE_FOCUS;
    }
    if ((sceneId === 'factory' || sceneId === 'factory_dawn') && pz < -14.5 && Math.abs(px) < 9.0) {
      return FACTORY_GATE_FOCUS;
    }
    if ((sceneId === 'courtyard' || sceneId === 'courtyard_day') && pz < -9.5 && Math.abs(px) < 7.0) {
      return COURTYARD_GATE_FOCUS;
    }
    return null;
  }

  private computeEstablishingStart(sceneId: SceneId, px: number, pz: number, aspect: number): void {
    const pBoost = aspect < 1 ? 11 : 0;
    switch (sceneId) {
      case 'changan':
      case 'changan_rain':
        this.introStartPos.set(px - 14, 2.5, pz + 7);
        this.introStartLook.set(px * 0.35 + 4, 10.5, -18);
        this.introStartFov = 42 + pBoost;
        break;
      case 'march':
      case 'march_day':
        this.introStartPos.set(px - 9, 2.7, -10.4);
        this.introStartLook.set(px + 14, 2.1, -9.2);
        this.introStartFov = 43 + pBoost;
        break;
      case 'blockade':
        this.introStartPos.set(px - 8, 2.5, -10.8);
        this.introStartLook.set(px + 12, 1.9, -9.5);
        this.introStartFov = 43 + pBoost;
        break;
      case 'square':
        this.introStartPos.set(px + 20, 14.0, pz + 24);
        this.introStartLook.set(-38, 7.5, -315);
        this.introStartFov = 46 + pBoost;
        break;
      case 'camp':
        this.introStartPos.set(px + 12, 3.1, pz + 16);
        this.introStartLook.set(-2, 4.5, -295);
        this.introStartFov = 44 + pBoost;
        break;
      case 'statue':
        this.introStartPos.set(px + 5.2, 2.4, -182);
        this.introStartLook.set(0, 7.6, -172);
        this.introStartFov = 42 + pBoost;
        break;
      case 'campus':
        this.introStartPos.set(4.4, 2.9, -8.8);
        this.introStartLook.set(0.6, 3.6, 5.2);
        this.introStartFov = 45 + pBoost;
        break;
      case 'aftermath':
        this.introStartPos.set(5.0, 4.2, -11.2);
        this.introStartLook.set(0, 4.4, -17.0);
        this.introStartFov = 44 + pBoost;
        break;
      case 'factory':
      case 'factory_dawn':
        this.introStartPos.set(4.6, 3.9, 13.6);
        this.introStartLook.set(-1.0, 2.2, -4.5);
        this.introStartFov = 44 + pBoost;
        break;
      case 'courtyard':
      case 'courtyard_day':
        this.introStartPos.set(-4.8, 2.6, -6.2);
        this.introStartLook.set(1.0, 2.2, 6.2);
        this.introStartFov = 46 + pBoost;
        break;
      case 'hutong':
        this.introStartPos.set(14.5, 2.1, -9.2);
        this.introStartLook.set(14.5, 2.4, 6.8);
        this.introStartFov = 44 + pBoost;
        break;
      case 'beijing_hotel_balcony':
        this.introStartPos.set(px + 3.2, 2.4, pz + 4.4);
        this.introStartLook.set(px - 22, 1.8, pz - 18);
        this.introStartFov = 44 + pBoost;
        break;
      case 'newsroom':
        this.introStartPos.set(px - 4.5, 2.7, pz - 4.5);
        this.introStartLook.set(px + 2.5, 1.3, pz + 1.5);
        this.introStartFov = 45 + pBoost;
        break;
      case 'overpass':
        this.introStartPos.set(px - 9.0, 4.2, pz - 6.0);
        this.introStartLook.set(px + 12.0, 1.8, pz + 2.0);
        this.introStartFov = 44 + pBoost;
        break;
      case 'hospital_gate':
        this.introStartPos.set(px + 4.5, 2.8, pz - 8.0);
        this.introStartLook.set(0, 3.0, 2.0);
        this.introStartFov = 45 + pBoost;
        break;
      case 'siheyuan_room':
        this.introStartPos.set(px - 2.8, 2.0, pz + 2.0);
        this.introStartLook.set(0.4, 1.2, -1.5);
        this.introStartFov = 46 + pBoost;
        break;
      case 'morning_market':
        this.introStartPos.set(px - 7.5, 2.5, pz - 7.0);
        this.introStartLook.set(px + 6.5, 1.6, 0);
        this.introStartFov = 45 + pBoost;
        break;
      case 'xinhua_gate':
        this.introStartPos.set(px - 10.0, 2.7, pz - 6.0);
        this.introStartLook.set(0, 3.6, -12.0);
        this.introStartFov = 44 + pBoost;
        break;
      case 'street':
      case 'street_aftermath':
      default:
        this.introStartPos.set(px - 8.5, 2.6, -8.5);
        this.introStartLook.set(px + 7.5, 2.4, -0.5);
        this.introStartFov = 45 + pBoost;
        break;
    }
  }

  private computeFollowPose(
    out: Pose,
    opts: CameraFrameOpts,
    dist: number,
    baseFov: number,
    aspect: number,
    gateFocus: THREE.Vector3 | null,
  ): void {
    const px = opts.player.pos.x;
    const pz = opts.player.pos.y;
    if (gateFocus) {
      const fd = 19 / Math.min(1, Math.max(0.55, aspect * 1.25));
      const dx = px - gateFocus.x;
      const dz = pz - gateFocus.z;
      const len = Math.hypot(dx, dz) || 1;
      out.pos.set(gateFocus.x + (dx / len) * fd, 2.6, gateFocus.z + (dz / len) * fd);
      out.look.copy(gateFocus);
      out.fov = baseFov;
      return;
    }

    const prof = opts.world.cam;
    const far = dist > 15;
    const h = prof ? prof.h : far ? 0.32 : 1.0;
    const ahead = prof ? prof.ahead : far ? 20 : 0;
    const ly = prof ? prof.y : far ? 11 : 0;
    const sy = Math.sin(opts.yaw);
    const cy = Math.cos(opts.yaw);

    out.pos.set(px - sy * dist * 0.62, 1 + dist * h, pz - cy * dist * 0.62);
    out.look.set(px + sy * ahead, 1 + ly, pz + cy * ahead);
    out.fov = baseFov;
  }

  private computeWidePose(
    out: Pose,
    opts: CameraFrameOpts,
    baseDist: number,
    baseFov: number,
    aspect: number,
  ): void {
    const px = opts.player.pos.x;
    const pz = opts.player.pos.y;
    const prof = opts.world.cam;
    const sy = Math.sin(opts.yaw);
    const cy = Math.cos(opts.yaw);
    const dist = baseDist * 1.48;

    const isWorkshop = opts.sceneId === 'factory' || opts.sceneId === 'factory_dawn';
    const isCourtyard = opts.sceneId === 'courtyard' || opts.sceneId === 'courtyard_day';
    const isLarge =
      opts.sceneId === 'changan' ||
      opts.sceneId === 'changan_rain' ||
      opts.sceneId === 'square' ||
      opts.sceneId === 'camp' ||
      opts.sceneId === 'statue';

    const baseH = prof ? prof.h : isLarge ? 0.36 : 0.92;
    const h = isWorkshop ? 0.68 : isCourtyard ? 1.15 : isLarge ? Math.max(baseH * 1.45, 0.56) : Math.max(baseH * 1.25, 1.08);
    const ahead = prof ? prof.ahead * 1.18 : isLarge ? 26 : 6;
    const ly = isLarge ? 8.5 : 1.6;

    out.pos.set(px - sy * dist * 0.66, 1.2 + dist * h, pz - cy * dist * 0.66);
    out.look.set(px + sy * ahead, ly, pz + cy * ahead);
    out.fov = aspect < 1 ? 64 : Math.max(54, baseFov + 4);
  }

  private computeDialogueOtsPose(
    out: Pose,
    opts: CameraFrameOpts,
    zoom: number,
    baseFov: number,
  ): void {
    const px = opts.player.pos.x;
    const pz = opts.player.pos.y;

    let fx = Math.cos(opts.player.heading);
    let fz = -Math.sin(opts.player.heading);
    let sep = 2.0;

    if (opts.npcPos) {
      const dx = opts.npcPos[0] - px;
      const dz = opts.npcPos[1] - pz;
      const d = Math.hypot(dx, dz);
      if (d >= 0.35 && d <= 14) {
        fx = dx / d;
        fz = dz / d;
        sep = d;
      }
    }

    // Right-shoulder perpendicular vector in XZ plane
    const rx = -fz;
    const rz = fx;
    const isMonumental =
      opts.sceneId === 'changan' ||
      opts.sceneId === 'changan_rain' ||
      opts.sceneId === 'square' ||
      opts.sceneId === 'camp' ||
      opts.sceneId === 'statue';
    const zoomScale = clamp(zoom, 0.72, 1.32);
    const otsDist = (isMonumental ? 5.6 : 4.2) * zoomScale;

    let camX = px - fx * (otsDist * 0.78) + rx * (otsDist * 0.44);
    let camZ = pz - fz * (otsDist * 0.78) + rz * (otsDist * 0.44);
    let camY = isMonumental ? 2.05 : 1.82;

    // Keep camera inside narrow Hutong walls (x = 11.4 .. 17.6, z > 0) when conversing there
    if (opts.sceneId === 'hutong' && px > 10.6 && px < 18.4 && pz > -1.0) {
      camX = clamp(camX, 12.1, 16.9);
      camZ = Math.min(camZ, 8.2);
      camY = 2.15;
    }

    // Aim around waist height (y ~ 0.72) so both speakers sit cleanly in upper-middle 55% above #dlg
    const focusMix = opts.npcPos ? Math.min(sep * 0.58, 3.2) : 1.4;
    out.pos.set(camX, camY, camZ);
    out.look.set(px + fx * focusMix + rx * 0.14, 0.72, pz + fz * focusMix + rz * 0.14);
    out.fov = clamp(baseFov - 6, opts.aspect < 1 ? 48 : 38, opts.aspect < 1 ? 62 : 52);
  }

  private computeCinemaExplorePose(
    out: Pose,
    opts: CameraFrameOpts,
    baseDist: number,
    zoom: number,
    baseFov: number,
    aspect: number,
    elapsed: number,
    gateFocus: THREE.Vector3 | null,
  ): { maxWeight: number; zoneName?: string } {
    const px = opts.player.pos.x;
    const pz = opts.player.pos.y;
    const sy = Math.sin(opts.yaw);
    const cy = Math.cos(opts.yaw);
    const rx = -cy;
    const rz = sy;

    // 1. Base cinematic follow pose with velocity look-ahead + Rule-of-Thirds offset
    this.computeFollowPose(this.followPose, opts, baseDist, baseFov, aspect, null);
    out.pos.copy(this.followPose.pos);
    out.look.copy(this.followPose.look);

    const velSpeed = Math.hypot(this.vel.x, this.vel.y);
    const speedRatio = clamp(velSpeed / Math.max(opts.player.speed, 1), 0, 1.3);
    const leadDist = clamp(
      velSpeed * 0.28,
      0,
      opts.sceneId === 'changan' || opts.sceneId === 'changan_rain' || opts.sceneId === 'square' ? 3.2 : 1.8,
    );
    if (velSpeed > 0.15) {
      out.look.x += (this.vel.x / velSpeed) * leadDist;
      out.look.z += (this.vel.y / velSpeed) * leadDist;
    }

    const thirdsShift =
      (opts.sceneId === 'changan' ||
      opts.sceneId === 'changan_rain' ||
      opts.sceneId === 'square' ||
      opts.sceneId === 'camp' ||
      opts.sceneId === 'statue'
        ? 0.95
        : 0.42) * clamp(zoom, 0.65, 1.35);
    out.pos.x += rx * thirdsShift;
    out.pos.z += rz * thirdsShift;
    out.look.x += rx * thirdsShift * 0.85;
    out.look.z += rz * thirdsShift * 0.85;

    // Subtle optical FOV breathing on speed / zoom
    const zoomFovShift = (zoom - 1) * 4.5;
    const speedFovShift = speedRatio * 1.8;
    const minFov = aspect < 1 ? 48 : 38;
    const maxFov = aspect < 1 ? 66 : 58;
    out.fov = clamp(baseFov + zoomFovShift + speedFovShift, minFov, maxFov);

    // Keep camera unobstructed inside narrow Hutong alley walls (x = 11.4 .. 17.6, z > 0)
    if (opts.sceneId === 'hutong' && px > 10.6 && px < 18.4 && pz > -0.5) {
      const alleyW = smoothBoxWeight(px, pz, 11.2, 17.8, 0.2, 10.0, 1.8);
      const clampedX = clamp(out.pos.x, 12.1, 16.9);
      const raisedY = Math.max(out.pos.y, 4.4);
      out.pos.x += (clampedX - out.pos.x) * alleyW;
      out.pos.y += (raisedY - out.pos.y) * alleyW * Math.abs(sy);
    }

    // 2. Evaluate curated spatial landmark cinema zone
    const zone = this.evaluateLandmarkZone(opts, px, pz, sy, cy, baseDist, baseFov, aspect, elapsed, gateFocus);
    if (zone && zone.weight > 0.005) {
      const w = clamp(zone.weight, 0, 1);
      out.pos.lerp(zone.pos, w);
      out.look.lerp(zone.look, w);
      out.fov = out.fov + (zone.fov - out.fov) * w;
      return { maxWeight: w, zoneName: w > 0.35 ? zone.name : undefined };
    }

    return { maxWeight: 0 };
  }

  private evaluateLandmarkZone(
    opts: CameraFrameOpts,
    px: number,
    pz: number,
    sy: number,
    cy: number,
    baseDist: number,
    baseFov: number,
    aspect: number,
    elapsed: number,
    gateFocus: THREE.Vector3 | null,
  ): ZoneEval | null {
    const sceneId = opts.sceneId;
    const pBoost = aspect < 1 ? 10 : 0;
    const fd = 19 / Math.min(1, Math.max(0.55, aspect * 1.25));

    // Campus & Aftermath
    if (sceneId === 'campus' || sceneId === 'aftermath') {
      const gateW = smoothBoxWeight(px, pz, -9.0, 9.0, -27.5, -17.5, 2.2);
      if (gateW > 0.01) {
        const focus = gateFocus ?? GATE_FOCUS;
        const dx = px - focus.x;
        const dz = pz - focus.z;
        const len = Math.hypot(dx, dz) || 1;
        this.zoneScratchPos.set(
          focus.x + (dx / len) * fd + sy * 2.2,
          2.5,
          focus.z + (dz / len) * fd,
        );
        this.zoneScratchLook.copy(focus);
        return {
          weight: gateW,
          name: '北京大學西校門',
          pos: this.zoneScratchPos,
          look: this.zoneScratchLook,
          fov: 44 + pBoost,
        };
      }

      if (sceneId === 'campus') {
        const triCircle = smoothCircleWeight(px, pz, 4.2, -3.2, 3.8, 7.6);
        const triFacing = smoothstep(-0.35, 0.25, cy);
        const triW = triCircle * triFacing;
        if (triW > 0.01) {
          this.zoneScratchPos.set(5.8 - sy * 2.4, 2.55, -10.4);
          this.zoneScratchLook.set(2.0, 2.0, -3.5);
          return {
            weight: triW,
            name: '三角地布告欄',
            pos: this.zoneScratchPos,
            look: this.zoneScratchLook,
            fov: 45 + pBoost,
          };
        }
      }
      return null;
    }

    // Factory & Factory Dawn
    if (sceneId === 'factory' || sceneId === 'factory_dawn') {
      const gateW = smoothBoxWeight(px, pz, -8.5, 8.5, -22.5, -14.5, 2.2);
      if (gateW > 0.01) {
        const focus = gateFocus ?? FACTORY_GATE_FOCUS;
        const dx = px - focus.x;
        const dz = pz - focus.z;
        const len = Math.hypot(dx, dz) || 1;
        this.zoneScratchPos.set(
          focus.x + (dx / len) * fd + sy * 2.2,
          2.5,
          focus.z + (dz / len) * fd,
        );
        this.zoneScratchLook.copy(focus);
        return {
          weight: gateW,
          name: '北京第二機床廠大門',
          pos: this.zoneScratchPos,
          look: this.zoneScratchLook,
          fov: 44 + pBoost,
        };
      }

      // Interior sawtooth bay shot: keep camera comfortably below 6.68m steel trusses
      const shopW = smoothBoxWeight(px, pz, -11.5, 11.5, -3.5, 13.5, 2.5);
      if (shopW > 0.01) {
        const d = Math.min(baseDist * 0.86, 11.2);
        this.zoneScratchPos.set(px - sy * d * 0.72, 4.15, pz - cy * d * 0.72);
        this.zoneScratchLook.set(px + sy * 5.2, 1.9, pz + cy * 5.2);
        return {
          weight: shopW,
          name: '一車間鋸齒廠房',
          pos: this.zoneScratchPos,
          look: this.zoneScratchLook,
          fov: clamp(baseFov - 3, 40, 62),
        };
      }
      return null;
    }

    // Courtyard
    if (sceneId === 'courtyard' || sceneId === 'courtyard_day') {
      const gateW = smoothBoxWeight(px, pz, -6.5, 6.5, -16.5, -9.5, 2.0);
      if (gateW > 0.01) {
        const focus = gateFocus ?? COURTYARD_GATE_FOCUS;
        const dx = px - focus.x;
        const dz = pz - focus.z;
        const len = Math.hypot(dx, dz) || 1;
        this.zoneScratchPos.set(
          focus.x + (dx / len) * fd + sy * 1.8,
          2.4,
          focus.z + (dz / len) * fd,
        );
        this.zoneScratchLook.copy(focus);
        return {
          weight: gateW,
          name: '大雜院紅漆街門',
          pos: this.zoneScratchPos,
          look: this.zoneScratchLook,
          fov: 45 + pBoost,
        };
      }
      return null;
    }

    // Chang'an Avenue
    if (sceneId === 'changan' || sceneId === 'changan_rain') {
      const tamBox = smoothBoxWeight(px, pz, -45, 45, -56, -37, 8);
      const tamFacing = smoothstep(-0.15, 0.45, cy);
      const tamW = tamBox * tamFacing;

      const aveZ = smoothstep(-145, -100, pz);
      const eastBox = smoothstep(88, 114, px) * aveZ;
      const eastFacing = smoothstep(-0.2, 0.25, facingDot(opts.yaw, px, pz, 238, -28));
      const eastW = eastBox * eastFacing;

      const westBox = smoothstep(-88, -114, px) * aveZ;
      const westFacing = smoothstep(-0.2, 0.25, facingDot(opts.yaw, px, pz, -242, -30));
      const westW = westBox * westFacing;

      if (tamW >= eastW && tamW >= westW && tamW > 0.01) {
        this.zoneScratchPos.set(px - sy * 19, 2.8, Math.min(-48, pz - cy * 19));
        this.zoneScratchLook.set(px * 0.42 + sy * 6, 9.6, -15);
        return {
          weight: tamW,
          name: '天安門與金水橋',
          pos: this.zoneScratchPos,
          look: this.zoneScratchLook,
          fov: 40 + pBoost,
        };
      }
      if (eastW >= westW && eastW > 0.01) {
        this.zoneScratchPos.set(px - 17, 3.1, pz - 15);
        this.zoneScratchLook.set((px + 224) * 0.5, 16.5, -32);
        return {
          weight: eastW,
          name: '北京飯店東樓',
          pos: this.zoneScratchPos,
          look: this.zoneScratchLook,
          fov: 44 + pBoost,
        };
      }
      if (westW > 0.01) {
        this.zoneScratchPos.set(px + 17, 3.1, pz - 15);
        this.zoneScratchLook.set((px - 228) * 0.5, 17.5, -32);
        return {
          weight: westW,
          name: '北京電報大樓',
          pos: this.zoneScratchPos,
          look: this.zoneScratchLook,
          fov: 44 + pBoost,
        };
      }
      return null;
    }

    // Tiananmen Square / Camp / Goddess of Democracy
    if (sceneId === 'square' || sceneId === 'camp' || sceneId === 'statue') {
      let best: ZoneEval | null = null;
      const pick = (candidate: ZoneEval) => {
        if (candidate.weight > (best?.weight ?? 0.01)) best = candidate;
      };

      // 1. Goddess of Democracy hero reveal (statue scene)
      if (sceneId === 'statue') {
        const gCircle = smoothCircleWeight(px, pz, 0, -172, 22, 35);
        const gFacing = smoothstep(-0.4, 0.2, cy);
        const gW = gCircle * gFacing;
        if (gW > 0.01) {
          const drift = opts.playing ? Math.sin(elapsed * 0.16) * 0.14 : 0;
          const oy = opts.yaw + drift;
          pick({
            weight: gW,
            name: '民主女神像',
            pos: new THREE.Vector3(px - Math.sin(oy) * 14.5, 2.35, pz - Math.cos(oy) * 14.5),
            look: new THREE.Vector3(0, 7.5, -172),
            fov: 43 + pBoost,
          });
        }
      }

      // 2. Monument Heroic Esplanade
      const monCircle = smoothCircleWeight(px, pz, 0, -330, 30, 45);
      const monFacing = smoothstep(-0.35, 0.2, facingDot(opts.yaw, px, pz, 0, -330));
      const monW = monCircle * monFacing;
      if (monW > 0.01) {
        const dx = px;
        const dz = pz + 330;
        const d = Math.hypot(dx, dz) || 1;
        const ux = dx / d;
        const uz = dz / d;
        pick({
          weight: monW,
          name: '人民英雄紀念碑',
          pos: new THREE.Vector3(px + ux * 16 - sy * 4, 2.35, pz + uz * 16 - cy * 4),
          look: new THREE.Vector3(0, 17.8, -330),
          fov: 42 + pBoost,
        });
      }

      // 3. Great Hall of the People Portico
      const ghX = smoothstep(-60, -82, px);
      const ghZ = 1 - smoothstep(42, 60, Math.abs(pz + 320));
      const ghFacing = px < -88 ? 1 : smoothstep(-0.2, 0.3, facingDot(opts.yaw, px, pz, -135, -320));
      const ghW = ghX * ghZ * ghFacing;
      if (ghW > 0.01) {
        pick({
          weight: ghW,
          name: '人民大會堂',
          pos: new THREE.Vector3(px + 20, 2.8, pz - 4),
          look: new THREE.Vector3(-112, 18.5, -320),
          fov: 43 + pBoost,
        });
      }

      // 4. Museum of Chinese History & Revolution (east walkway ends at x=+60 in bounds)
      const musX = smoothstep(38, 56, px);
      const musZ = 1 - smoothstep(42, 60, Math.abs(pz + 320));
      const musFacing = px > 88 ? 1 : smoothstep(-0.05, 0.35, facingDot(opts.yaw, px, pz, 135, -320));
      const musW = musX * musZ * musFacing;
      if (musW > 0.01) {
        pick({
          weight: musW,
          name: '中國革命歷史博物館',
          pos: new THREE.Vector3(px - 20, 2.8, pz - 4),
          look: new THREE.Vector3(112, 17.5, -320),
          fov: 43 + pBoost,
        });
      }

      // 5. Southern Central Axis (Mao Mausoleum + Zhengyangmen)
      const southZ = smoothstep(-358, -372, pz);
      const southX = 1 - smoothstep(38, 54, Math.abs(px));
      const southFacing = smoothstep(-0.2, 0.35, -cy);
      const southW = southZ * southX * southFacing;
      if (southW > 0.01) {
        pick({
          weight: southW,
          name: '毛主席紀念堂・正陽門軸線',
          pos: new THREE.Vector3(px * 0.72, 3.3, pz + 22),
          look: new THREE.Vector3(0, 16.5, -485),
          fov: 39 + pBoost,
        });
      }

      // 6. Northern Flagpole Esplanade
      const flagBox = smoothBoxWeight(px, pz, -36, 36, -144, -95, 8);
      if (flagBox > 0.01) {
        if (cy >= 0) {
          pick({
            weight: flagBox,
            name: '廣場國旗桿',
            pos: new THREE.Vector3(px * 0.72 - sy * 15, 2.9, pz - cy * 15),
            look: new THREE.Vector3(0, 13.5, -55),
            fov: 43 + pBoost,
          });
        } else {
          pick({
            weight: flagBox,
            name: '廣場北軸線',
            pos: new THREE.Vector3(px * 0.72 - sy * 15, 4.2, pz - cy * 15),
            look: new THREE.Vector3(0, 14.5, -220),
            fov: 44 + pBoost,
          });
        }
      }

      return best;
    }

    return null;
  }
}
