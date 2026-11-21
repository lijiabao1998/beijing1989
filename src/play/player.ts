import * as THREE from 'three';
import { getCharacterFaceTexture, getFabricNormalTexture, getFabricRoughnessTexture } from '../render/characterTextures';
import { C, litMat, mergeParts, type Part } from '../render/kit';
import { SharedTexPool } from '../render/materials';
import { bikeBodyParts, bikeWheelLocal, tricycleRearWheelsLocal } from '../render/props';
import { workerTricycleRider } from '../render/factoryArch';
import type { PlayerMode, ViewpointId } from '../types';

export type { PlayerMode, ViewpointId };
export type RigKey = `${ViewpointId}:${PlayerMode}`;

const JACKET = 0x3f4a3a;
const WORKER_JACKET = 0x2a3b4e;
const JOURNALIST_COAT = 0xa8926a;
const JOURNALIST_COAT_SHADE = 0x968058;
const JOURNALIST_TROUSERS = 0x2d2b28;
const RESIDENT_CARDIGAN = 0x5c636b;
const RESIDENT_CARDIGAN_TRIM = 0x484e55;
const RESIDENT_TROUSERS = 0x2a2c32;
const H = Math.PI / 2;

const MODE_SPEED: Record<PlayerMode, number> = {
  walk: 4.2,
  camera_walk: 3.6,
  tricycle: 5.8,
  bike: 7.0,
};

function strut(a: [number, number, number], b: [number, number, number], thick: number, c: number, seg = 5): Part {
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
    open: true,
    rz,
    ry,
  };
}

/** Articulated leg mesh parts relative to hip pivot (y = 0.80, z = ±0.09). */
function legLimbParts(trousers: number): Part[] {
  return [
    { p: [0, -0.18, 0], s: [0.16, 0.36, 0.145], c: trousers, cyl: true, seg: 7, top: 1.12 },
    { p: [0, -0.53, 0], s: [0.135, 0.40, 0.125], c: trousers, cyl: true, seg: 7, top: 1.15 },
    { p: [0.02, -0.748, 0], s: [0.21, 0.052, 0.105], c: 0x1c1b19, cyl: true, seg: 8, top: 0.78 },
    { p: [0.025, -0.785, 0], s: [0.23, 0.030, 0.11], c: 0xd8d2c4, cyl: true, seg: 8 },
  ];
}

/** Articulated arm mesh parts relative to shoulder pivot (y = 1.36, z = ±0.245). */
function armLimbParts(jacket: number): Part[] {
  return [
    { p: [0, -0.01, 0], s: [0.135, 0.13, 0.12], c: jacket, sphere: true, detail: 0 },
    { p: [0.005, -0.14, 0], s: [0.12, 0.26, 0.11], c: jacket, cyl: true, seg: 6, top: 0.88, open: true },
    { p: [0.028, -0.36, 0], s: [0.105, 0.23, 0.095], c: jacket, cyl: true, seg: 6, top: 0.82, rz: 0.18 },
    { p: [0.052, -0.52, 0], s: [0.082, 0.105, 0.075], c: 0xc8a07a, sphere: true, detail: 0 },
  ];
}

/** Woven fabric PBR material with cotton/twill micro-normal & roughness maps (shared textures, zero leak). */
function fabricLitMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    normalMap: getFabricNormalTexture(),
    normalScale: new THREE.Vector2(0.32, 0.32),
    roughnessMap: getFabricRoughnessTexture(),
    roughness: 0.88,
    metalness: 0.04,
  });
}

/** Sculpted expressive head/face sphere (+ optional worker cap) oriented toward +x. */
function buildHeadGroup(viewpoint: ViewpointId, withWorkerCap = false): THREE.Group {
  const hg = new THREE.Group();
  const faceGeo = new THREE.SphereGeometry(1, 16, 12);
  faceGeo.scale(0.100, 0.118, 0.090);
  const faceMat = new THREE.MeshStandardMaterial({
    map: getCharacterFaceTexture(viewpoint),
    roughness: 0.72,
    metalness: 0.02,
  });
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.castShadow = false;
  faceMesh.receiveShadow = true;
  hg.add(faceMesh);

  if (withWorkerCap) {
    const capParts: Part[] = [
      { p: [-0.008, 0.098, 0], s: [0.215, 0.088, 0.200], c: 0x24344c, sphere: true, detail: 1 },
      { p: [0.102, 0.068, 0], s: [0.105, 0.024, 0.175], c: 0x1c283a, rz: -0.14 },
    ];
    const capMesh = new THREE.Mesh(mergeParts(capParts), fabricLitMat());
    capMesh.castShadow = false;
    capMesh.receiveShadow = true;
    hg.add(capMesh);
  }
  return hg;
}

/** Sculpted upper body (pelvis, torso, collar, neck, optional satchel; head mounted separately) facing +x. */
function upperBodyParts(
  jacket: number,
  includeSatchel = true,
): Part[] {
  const skinShade = 0xb88f6a;
  const parts: Part[] = [
    { p: [0, 0.81, 0], s: [0.255, 0.065, 0.41], c: 0x241d16, cyl: true, seg: 8 },
    { p: [0.128, 0.81, 0], s: [0.018, 0.052, 0.068], c: C.brass },
    { p: [0, 0.90, 0], s: [0.268, 0.16, 0.42], c: jacket, cyl: true, seg: 8, top: 0.94 },
    { p: [0, 1.18, 0], s: [0.245, 0.44, 0.39], c: jacket, cyl: true, seg: 8, top: 1.14 },
    { p: [0.115, 1.32, 0], s: [0.045, 0.17, 0.115], c: 0xe8e2d2 },
    { p: [0.125, 1.30, 0.072], s: [0.028, 0.20, 0.072], c: jacket, rx: -0.25 },
    { p: [0.125, 1.30, -0.072], s: [0.028, 0.20, 0.072], c: jacket, rx: 0.25 },
    { p: [-0.01, 1.415, 0], s: [0.21, 0.065, 0.26], c: jacket, cyl: true, seg: 8, top: 0.85 },
    { p: [0, 1.46, 0], s: [0.10, 0.09, 0.095], c: skinShade, cyl: true, seg: 6 },
  ];
  if (includeSatchel) {
    parts.push(
      { p: [0, 1.15, 0], s: [0.275, 0.54, 0.04], c: 0x5c6240, rx: 0.58 },
      { p: [-0.05, 0.88, 0.235], s: [0.20, 0.22, 0.085], c: 0x565c3a, bevel: true },
    );
  }
  return parts;
}

function cameraBagParts(): Part[] {
  return [
    // Cross-body leather strap & padded brown camera bag on right hip
    { p: [0, 1.16, 0], s: [0.29, 0.56, 0.044], c: 0x3b2c1e, rx: -0.58 },
    { p: [-0.04, 0.87, -0.255], s: [0.22, 0.21, 0.11], c: 0x3b2c1e, bevel: true },
    { p: [-0.04, 0.93, -0.255], s: [0.228, 0.06, 0.116], c: 0x4d3a27 },
    { p: [-0.04, 0.88, -0.312], s: [0.04, 0.045, 0.018], c: C.chrome },
  ];
}

function slrCameraParts(x: number, y: number, z = 0): Part[] {
  return [
    { p: [x, y, z], s: [0.065, 0.082, 0.132], c: 0x1f2024 },                    // matte camera body
    { p: [x, y + 0.046, z], s: [0.066, 0.018, 0.132], c: 0xc8c8c0 },            // silver top plate
    { p: [x - 0.004, y + 0.062, z], s: [0.056, 0.026, 0.048], c: 0xc8c8c0 },    // pentaprism
    { p: [x + 0.058, y - 0.004, z], s: [0.062, 0.082, 0.062], c: 0x141518, cyl: true, rz: H, seg: 8 }, // lens barrel
    { p: [x + 0.098, y - 0.004, z], s: [0.052, 0.012, 0.052], c: 0x3d5c78, cyl: true, rz: H, seg: 8 }, // coated lens element
  ];
}

function trenchCoatParts(): Part[] {
  return [
    // Tapered sculpted trench coat skirt, fitted waist belt, storm flap & lapel trim
    { p: [0, 0.72, 0], s: [0.268, 0.34, 0.415], c: JOURNALIST_COAT_SHADE, cyl: true, seg: 8, top: 0.90 },
    { p: [0, 0.89, 0], s: [0.272, 0.052, 0.405], c: 0x6b5638, cyl: true, seg: 8 },
    { p: [0.138, 0.89, 0], s: [0.018, 0.058, 0.068], c: C.brass },
    { p: [0.118, 1.32, 0], s: [0.026, 0.22, 0.22], c: JOURNALIST_COAT_SHADE },
  ];
}

function journalistUpperParts(raisedCamera: boolean): Part[] {
  const parts = upperBodyParts(JOURNALIST_COAT, false);
  parts.push(...trenchCoatParts(), ...cameraBagParts());

  if (raisedCamera) {
    // Raised arms cradling the 35mm SLR at eye height
    parts.push(
      strut([0, 1.33, 0.24], [0.16, 1.36, 0.20], 0.11, JOURNALIST_COAT, 6),
      strut([0.16, 1.36, 0.20], [0.25, 1.54, 0.10], 0.095, JOURNALIST_COAT, 6),
      strut([0, 1.33, -0.24], [0.16, 1.36, -0.20], 0.11, JOURNALIST_COAT, 6),
      strut([0.16, 1.36, -0.20], [0.25, 1.54, -0.10], 0.095, JOURNALIST_COAT, 6),
      { p: [0.26, 1.55, 0.095], s: [0.075, 0.075, 0.075], c: 0xc8a07a, sphere: true, detail: 0 },
      { p: [0.26, 1.55, -0.095], s: [0.075, 0.075, 0.075], c: 0xc8a07a, sphere: true, detail: 0 },
      ...slrCameraParts(0.285, 1.56, 0),
    );
  } else {
    parts.push(
      { p: [0.11, 1.33, 0], s: [0.045, 0.18, 0.13], c: 0x1a1a1c },
      ...slrCameraParts(0.165, 1.20, 0),
    );
  }
  return parts;
}

function residentUpperParts(): Part[] {
  const parts = upperBodyParts(RESIDENT_CARDIGAN, false);
  parts.push(
    { p: [0.132, 1.07, 0], s: [0.018, 0.38, 0.055], c: RESIDENT_CARDIGAN_TRIM },
    { p: [0.142, 1.18, 0], s: [0.014, 0.022, 0.022], c: 0x282a2e },
    { p: [0.142, 1.09, 0], s: [0.014, 0.022, 0.022], c: 0x282a2e },
    { p: [0.142, 1.00, 0], s: [0.014, 0.022, 0.022], c: 0x282a2e },
  );
  return parts;
}

function residentToteParts(): Part[] {
  return [
    { p: [0.06, -0.54, 0.04], s: [0.022, 0.14, 0.036], c: 0x7c7056 },
    { p: [0.06, -0.72, 0.06], s: [0.24, 0.24, 0.105], c: 0x9b8e72, bevel: true },
    { p: [0.06, -0.64, 0.06], s: [0.246, 0.03, 0.11], c: 0x6f7c68 },
    { p: [0.11, -0.56, 0.06], s: [0.045, 0.13, 0.045], c: 0x5c8b48, rz: -0.18 },
    { p: [-0.01, -0.56, 0.06], s: [0.055, 0.12, 0.055], c: 0xe8e2d0, cyl: true, seg: 6, rz: 0.15 },
  ];
}

function buildVehicleBodyParts(viewpoint: ViewpointId, mode: 'bike' | 'tricycle'): Part[] {
  if (mode === 'tricycle') return workerTricycleRider(false, false);
  if (viewpoint === 'worker') return bikeBodyParts(WORKER_JACKET, false, false);
  if (viewpoint === 'journalist') {
    return [
      ...bikeBodyParts(JOURNALIST_COAT, false, false),
      { p: [-0.20, 1.05, -0.19], s: [0.20, 0.19, 0.10], c: 0x3b2c1e, bevel: true },
      ...slrCameraParts(0.05, 1.24, 0),
    ];
  }
  if (viewpoint === 'resident') {
    return [
      ...bikeBodyParts(RESIDENT_CARDIGAN, false, false),
      { p: [-0.56, 0.89, -0.02], s: [0.24, 0.18, 0.16], c: 0x9b8e72, bevel: true },
    ];
  }
  return bikeBodyParts(JACKET, false, false);
}

interface RigAnimParts {
  body: THREE.Object3D;
  head: THREE.Object3D;
  legL?: THREE.Object3D;
  legR?: THREE.Object3D;
  armL?: THREE.Object3D;
  armR?: THREE.Object3D;
  wheelF?: THREE.Object3D;
  wheelR?: THREE.Object3D;
  wheelRadius?: number;
}

function buildRigGroup(viewpoint: ViewpointId, mode: PlayerMode): THREE.Group {
  const group = new THREE.Group();
  if (mode === 'bike' || mode === 'tricycle') {
    const bodyMesh = new THREE.Mesh(mergeParts(buildVehicleBodyParts(viewpoint, mode)), fabricLitMat());
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    const head = buildHeadGroup(viewpoint, viewpoint === 'worker');
    if (mode === 'tricycle') {
      head.position.set(0.46, 1.54, 0);
    } else {
      head.position.set(-0.08, 1.59, 0);
    }
    group.add(head);

    const wheelFGeo = mergeParts(
      mode === 'tricycle' ? bikeWheelLocal(0.66, 0.60, 0.045) : bikeWheelLocal(),
    );
    const wheelF = new THREE.Mesh(wheelFGeo, litMat());
    wheelF.position.set(mode === 'tricycle' ? 0.92 : 0.58, mode === 'tricycle' ? 0.34 : 0.36, 0);
    wheelF.castShadow = false;

    const wheelRGeo = mergeParts(
      mode === 'tricycle' ? tricycleRearWheelsLocal() : bikeWheelLocal(),
    );
    const wheelR = new THREE.Mesh(wheelRGeo, litMat());
    wheelR.position.set(mode === 'tricycle' ? -0.58 : -0.56, mode === 'tricycle' ? 0.32 : 0.36, 0);
    wheelR.castShadow = false;

    group.add(wheelF, wheelR);
    group.userData.anim = {
      body: bodyMesh,
      head,
      wheelF,
      wheelR,
      wheelRadius: mode === 'tricycle' ? 0.33 : 0.35,
    } satisfies RigAnimParts;
    return group;
  }

  const coat =
    viewpoint === 'worker' ? WORKER_JACKET
    : viewpoint === 'journalist' ? JOURNALIST_COAT
    : viewpoint === 'resident' ? RESIDENT_CARDIGAN
    : JACKET;
  const trousers =
    viewpoint === 'worker' ? 0x242830
    : viewpoint === 'journalist' ? JOURNALIST_TROUSERS
    : viewpoint === 'resident' ? RESIDENT_TROUSERS
    : 0x2a2f3a;

  let bodyParts: Part[];
  if (mode === 'camera_walk') {
    if (viewpoint === 'journalist') {
      bodyParts = journalistUpperParts(true);
    } else {
      bodyParts = upperBodyParts(coat, viewpoint === 'student' || viewpoint === 'worker');
      bodyParts.push(
        strut([0, 1.33, 0.24], [0.16, 1.36, 0.20], 0.11, coat, 6),
        strut([0.16, 1.36, 0.20], [0.25, 1.54, 0.10], 0.095, coat, 6),
        strut([0, 1.33, -0.24], [0.16, 1.36, -0.20], 0.11, coat, 6),
        strut([0.16, 1.36, -0.20], [0.25, 1.54, -0.10], 0.095, coat, 6),
        { p: [0.26, 1.55, 0.095], s: [0.075, 0.075, 0.075], c: 0xc8a07a, sphere: true, detail: 0 },
        { p: [0.26, 1.55, -0.095], s: [0.075, 0.075, 0.075], c: 0xc8a07a, sphere: true, detail: 0 },
        ...slrCameraParts(0.285, 1.56, 0),
      );
    }
  } else if (viewpoint === 'worker') {
    bodyParts = upperBodyParts(WORKER_JACKET, true);
  } else if (viewpoint === 'journalist') {
    bodyParts = journalistUpperParts(false);
  } else if (viewpoint === 'resident') {
    bodyParts = residentUpperParts();
  } else {
    bodyParts = upperBodyParts(JACKET, true);
  }

  const bodyMesh = new THREE.Mesh(mergeParts(bodyParts), fabricLitMat());
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  const head = buildHeadGroup(viewpoint, viewpoint === 'worker');
  head.position.set(0.015, 1.59, 0);
  group.add(head);

  const legL = new THREE.Mesh(mergeParts(legLimbParts(trousers)), fabricLitMat());
  legL.position.set(0, 0.80, 0.09);
  legL.castShadow = true;
  const legR = new THREE.Mesh(mergeParts(legLimbParts(trousers)), fabricLitMat());
  legR.position.set(0, 0.80, -0.09);
  legR.castShadow = true;
  group.add(legL, legR);

  const anim: RigAnimParts = { body: bodyMesh, head, legL, legR };
  if (mode === 'walk') {
    const leftArmParts = viewpoint === 'resident'
      ? [...armLimbParts(coat), ...residentToteParts()]
      : armLimbParts(coat);
    const armL = new THREE.Mesh(mergeParts(leftArmParts), fabricLitMat());
    armL.position.set(0, 1.36, 0.245);
    const armR = new THREE.Mesh(mergeParts(armLimbParts(coat)), fabricLitMat());
    armR.position.set(0, 1.36, -0.245);
    group.add(armL, armR);
    anim.armL = armL;
    anim.armR = armR;
  }

  group.userData.anim = anim;
  return group;
}

/** Lazy-building registry caching merged character rig groups per `(viewpoint, mode)`. */
export class RigRegistry {
  private readonly cache = new Map<RigKey, THREE.Group>();
  private readonly root?: THREE.Group;

  constructor(root?: THREE.Group) {
    this.root = root;
  }

  has(viewpoint: ViewpointId, mode: PlayerMode): boolean {
    return this.cache.has(`${viewpoint}:${mode}`);
  }

  size(): number {
    return this.cache.size;
  }

  keys(): RigKey[] {
    return [...this.cache.keys()];
  }

  acquire(viewpoint: ViewpointId, mode: PlayerMode): THREE.Group {
    const key: RigKey = `${viewpoint}:${mode}`;
    let rig = this.cache.get(key);
    if (!rig) {
      rig = buildRigGroup(viewpoint, mode);
      rig.name = `player:${key}`;
      rig.visible = false;
      this.cache.set(key, rig);
      this.root?.add(rig);
    }
    return rig;
  }

  activate(viewpoint: ViewpointId, mode: PlayerMode): THREE.Group {
    const active = this.acquire(viewpoint, mode);
    for (const rig of this.cache.values()) {
      rig.visible = rig === active;
    }
    return active;
  }

  dispose(): void {
    for (const group of this.cache.values()) {
      group.traverse(obj => {
        const m = obj as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            for (const mat of m.material) mat.dispose();
          } else {
            m.material?.dispose();
          }
        }
      });
      group.removeFromParent();
    }
    this.cache.clear();
  }
}

export class Player {
  mesh = new THREE.Group();
  readonly registry: RigRegistry;
  pos = new THREE.Vector2();
  heading = 0;
  walk = 0;
  speed = 4.2;
  viewpoint: ViewpointId = 'student';
  mode: PlayerMode = 'walk';
  private activeRig: THREE.Group | null = null;
  private strideBlend = 0;
  private lookTarget: [number, number] | null = null;
  private headYaw = 0;
  private wheelAngle = 0;
  private idleTime = 0;
  private readonly contactShadow: THREE.Mesh;

  constructor() {
    this.registry = new RigRegistry(this.mesh);
    const shadowGeo = new THREE.PlaneGeometry(0.95, 0.95);
    shadowGeo.rotateX(-H);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: SharedTexPool.contactShadowTex(),
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.position.y = 0.016;
    this.contactShadow.renderOrder = -1;
    this.mesh.add(this.contactShadow);
    this.setRoleMode('student', 'walk');
  }

  setRiding(on: boolean, isWorker = false) {
    this.setMode(on ? 'bike' : 'walk', isWorker);
  }

  /** Legacy mode setter preserving `setMode(mode, isWorker?)` compatibility across existing callers. */
  setMode(mode: PlayerMode, isWorker = false) {
    const vp: ViewpointId = isWorker ? 'worker' : (this.viewpoint === 'worker' ? 'student' : this.viewpoint);
    this.setRoleMode(vp, mode);
  }

  /** Activate a specific `(viewpoint, mode)` character rig lazily via `RigRegistry`. */
  setRoleMode(viewpoint: ViewpointId, mode: PlayerMode) {
    this.viewpoint = viewpoint;
    this.mode = mode;
    this.activeRig = this.registry.activate(viewpoint, mode);
    this.speed = MODE_SPEED[mode] ?? 4.2;
  }

  getActiveRig(): THREE.Group | null {
    return this.activeRig;
  }

  getMode(): PlayerMode {
    return this.mode;
  }

  getViewpoint(): ViewpointId {
    return this.viewpoint;
  }

  setLookTarget(target: [number, number] | null) {
    this.lookTarget = target;
  }

  advanceWheels(distMoved: number) {
    const anim = this.activeRig?.userData.anim as RigAnimParts | undefined;
    const radius = anim?.wheelRadius ?? 0.35;
    if (distMoved > 0) {
      this.wheelAngle -= distMoved / radius;
      this.strideBlend = Math.min(1, this.strideBlend + 0.18);
    }
  }

  place(x: number, z: number) {
    this.pos.set(x, z);
    this.strideBlend = 0;
    this.sync(0);
  }

  /** ax: screen-space axis (x right, y down). yaw: camera yaw (0 = looking north, +z). */
  step(dt: number, ax: { x: number; y: number }, b: [number, number, number, number], yaw: number) {
    const moving = Math.abs(ax.x) + Math.abs(ax.y) > 0.05;
    if (moving) {
      const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
      const dx = rx * ax.x - fx * ax.y, dz = rz * ax.x - fz * ax.y;
      const prevX = this.pos.x;
      const prevZ = this.pos.y;
      this.pos.x = Math.min(b[1], Math.max(b[0], this.pos.x + dx * this.speed * dt));
      this.pos.y = Math.min(b[3], Math.max(b[2], this.pos.y + dz * this.speed * dt));
      const moved = Math.hypot(this.pos.x - prevX, this.pos.y - prevZ);
      this.heading = Math.atan2(-dz, dx);
      this.walk += dt * 10;
      this.advanceWheels(moved);
      this.strideBlend = Math.min(1, this.strideBlend + dt * 9);
    } else {
      this.strideBlend = Math.max(0, this.strideBlend - dt * 7);
    }
    this.sync(dt);
  }

  sync(dt = 1 / 60) {
    this.idleTime += Math.max(0, Math.min(dt, 0.1));
    const isFoot = this.mode === 'walk' || this.mode === 'camera_walk';
    const swing = isFoot ? Math.sin(this.walk) * 0.44 * this.strideBlend : 0;
    const bob = isFoot ? Math.abs(Math.sin(this.walk)) * 0.045 * this.strideBlend : 0;
    this.mesh.position.set(this.pos.x, bob, this.pos.y);
    this.mesh.rotation.y = this.heading;
    this.contactShadow.position.y = 0.016 - bob;
    this.contactShadow.scale.setScalar(this.mode === 'bike' || this.mode === 'tricycle' ? 1.45 : 1.0);

    const anim = this.activeRig?.userData.anim as RigAnimParts | undefined;
    if (anim) {
      if (anim.legL && anim.legR) {
        anim.legL.rotation.z = swing;
        anim.legR.rotation.z = -swing;
      }
      if (anim.armL) anim.armL.rotation.z = -swing * 0.72;
      if (anim.armR) anim.armR.rotation.z = swing * 0.72;
      if (anim.wheelF && anim.wheelR) {
        anim.wheelF.rotation.z = this.wheelAngle;
        anim.wheelR.rotation.z = this.wheelAngle;
        anim.body.rotation.x = Math.sin(this.wheelAngle * 1.1) * 0.035 * this.strideBlend;
        anim.body.rotation.z = 0;
      } else {
        anim.body.rotation.z = -0.035 * this.strideBlend;
        anim.body.rotation.x = swing * 0.04;
      }

      let wantHeadYaw = 0;
      if (this.lookTarget) {
        const dx = this.lookTarget[0] - this.pos.x;
        const dz = this.lookTarget[1] - this.pos.y;
        if (Math.hypot(dx, dz) > 0.25) {
          const targetAngle = Math.atan2(-dz, dx);
          const rel = ((targetAngle - this.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          wantHeadYaw = Math.max(-0.78, Math.min(0.78, rel));
        }
      }
      const lerpAlpha = dt > 0 ? Math.min(1, dt * 8.5) : 0.35;
      this.headYaw += (wantHeadYaw - this.headYaw) * lerpAlpha;
      anim.head.rotation.y = this.headYaw;
      anim.head.rotation.z = Math.sin(this.idleTime * 1.7) * 0.022;
    }
  }

  dispose() {
    this.registry.dispose();
    this.contactShadow.geometry.dispose();
    (this.contactShadow.material as THREE.Material).dispose();
    this.contactShadow.removeFromParent();
    this.activeRig = null;
  }
}

/** Oblique follow camera, looking along yaw (0 = north). Adapted from shanghaisurvival's street camera. */
export function followCam(
  cam: THREE.PerspectiveCamera,
  p: Player,
  dist: number,
  yaw: number,
  snap = false,
  focus?: THREE.Vector3,
  fd = 18,
  prof?: { h: number; ahead: number; y: number },
) {
  const tgt = new THREE.Vector3(p.pos.x, 1, p.pos.y);
  if (focus) { // frame a landmark: camera on the far side of the player, low, looking at it
    const dx = tgt.x - focus.x, dz = tgt.z - focus.z, l = Math.hypot(dx, dz) || 1;
    const want = new THREE.Vector3(focus.x + dx / l * fd, 2.6, focus.z + dz / l * fd);
    if (snap) cam.position.copy(want); else cam.position.lerp(want, 0.08);
    cam.lookAt(focus); return;
  }
  const far = dist > 15, h = prof ? prof.h : far ? 0.32 : 1.0, ah = prof ? prof.ahead : far ? 20 : 0, ly = prof ? prof.y : far ? 11 : 0;
  const want = new THREE.Vector3(tgt.x - Math.sin(yaw) * dist * 0.62, tgt.y + dist * h, tgt.z - Math.cos(yaw) * dist * 0.62);
  if (snap) cam.position.copy(want); else cam.position.lerp(want, 0.12);
  cam.lookAt(tgt.x + Math.sin(yaw) * ah, tgt.y + ly, tgt.z + Math.cos(yaw) * ah);
}
