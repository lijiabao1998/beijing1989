import * as THREE from 'three';
import { litMat, mergeParts } from '../render/kit';
import { bike, person } from '../render/props';

const JACKET = 0x3f4a3a;
export class Player {
  mesh = new THREE.Group();
  walker = new THREE.Mesh(mergeParts(person(JACKET, 0x2a2f3a)), litMat());
  rider = new THREE.Mesh(mergeParts(bike(JACKET)), litMat());
  pos = new THREE.Vector2();
  heading = 0; walk = 0; speed = 4.2;
  constructor() { this.mesh.add(this.walker, this.rider); this.setRiding(false); }
  setRiding(on: boolean) { this.walker.visible = !on; this.rider.visible = on; this.speed = on ? 7 : 4.2; }
  place(x: number, z: number) { this.pos.set(x, z); this.sync(); }
  /** ax: screen-space axis (x right, y down). yaw: camera yaw (0 = looking north, +z). */
  step(dt: number, ax: { x: number; y: number }, b: [number, number, number, number], yaw: number) {
    if (Math.abs(ax.x) + Math.abs(ax.y) > 0.05) {
      const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
      const dx = rx * ax.x - fx * ax.y, dz = rz * ax.x - fz * ax.y;
      this.pos.x = Math.min(b[1], Math.max(b[0], this.pos.x + dx * this.speed * dt));
      this.pos.y = Math.min(b[3], Math.max(b[2], this.pos.y + dz * this.speed * dt));
      this.heading = Math.atan2(-dz, dx); this.walk += dt * 10;
    }
    this.sync();
  }
  sync() { this.mesh.position.set(this.pos.x, this.walker.visible ? Math.abs(Math.sin(this.walk)) * 0.05 : 0, this.pos.y); this.mesh.rotation.y = this.heading; }
}

/** Oblique follow camera, looking along yaw (0 = north). Adapted from shanghaisurvival's street camera. */
export function followCam(cam: THREE.PerspectiveCamera, p: Player, dist: number, yaw: number, snap = false) {
  const tgt = new THREE.Vector3(p.pos.x, 1, p.pos.y);
  const want = new THREE.Vector3(tgt.x - Math.sin(yaw) * dist * 0.62, tgt.y + dist * (dist > 15 ? 0.32 : 1.0), tgt.z - Math.cos(yaw) * dist * 0.62);
  if (snap) cam.position.copy(want); else cam.position.lerp(want, 0.12);
  cam.lookAt(tgt.x + Math.sin(yaw) * (dist > 15 ? 20 : 0), tgt.y + (dist > 15 ? 11 : 0), tgt.z + Math.cos(yaw) * (dist > 15 ? 20 : 0));
}
