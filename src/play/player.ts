import * as THREE from 'three';
import { litMat, mergeParts } from '../render/kit';
import { person } from '../render/props';

export class Player {
  mesh = new THREE.Mesh(mergeParts(person(0x3f4a3a, 0x2a2f3a)), litMat());
  pos = new THREE.Vector2();
  heading = 0; walk = 0;
  place(x: number, z: number) { this.pos.set(x, z); this.sync(); }
  step(dt: number, ax: { x: number; y: number }, b: [number, number, number, number]) {
    const sp = 4.2;
    if (Math.abs(ax.x) + Math.abs(ax.y) > 0.05) {
      // Camera looks north (+z) from the south, so screen-right is -x and screen-down is -z.
      const dx = -ax.x, dz = -ax.y;
      this.pos.x = Math.min(b[1], Math.max(b[0], this.pos.x + dx * sp * dt));
      this.pos.y = Math.min(b[3], Math.max(b[2], this.pos.y + dz * sp * dt));
      this.heading = Math.atan2(-dz, dx); this.walk += dt * 10;
    }
    this.sync();
  }
  sync() { this.mesh.position.set(this.pos.x, Math.abs(Math.sin(this.walk)) * 0.05, this.pos.y); this.mesh.rotation.y = this.heading; }
}

/** Oblique follow camera (like the shanghaisurvival street camera, lower and closer). */
export function followCam(cam: THREE.PerspectiveCamera, p: Player, zoom: number) {
  const d = 11 * zoom;
  const tgt = new THREE.Vector3(p.pos.x, 1, p.pos.y);
  cam.position.lerp(new THREE.Vector3(tgt.x, tgt.y + d * 1.0, tgt.z - d * 0.62), 0.12);
  cam.lookAt(tgt);
}
