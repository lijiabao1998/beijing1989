import * as THREE from 'three';
import { C, Part, glowMat, instanced, litMat, mergeParts, place, rng, textTexture, vertText } from './kit';
import { bike, bus, busWindows, lampHead, lampPole, person, tree } from './props';
import type { SceneId } from '../types';

export interface World {
  id: SceneId; scene: THREE.Scene; spawn: [number, number];
  bounds: [number, number, number, number]; // minX,maxX,minZ,maxZ
  update(dt: number, t: number): void;
}

function base(fogColor: number): THREE.Scene {
  const s = new THREE.Scene();
  s.background = new THREE.Color(fogColor);
  s.fog = new THREE.Fog(fogColor, 18, 70);
  s.add(new THREE.HemisphereLight(0x55607a, 0x1c1810, 0.9));
  const moon = new THREE.DirectionalLight(0x8090b0, 0.35); moon.position.set(-10, 20, 8); s.add(moon);
  return s;
}

function sodium(s: THREE.Scene, x: number, z: number, i = 14) {
  const l = new THREE.PointLight(C.sodium, i, 16, 1.6); l.position.set(x, 4.6, z); s.add(l);
}

/** Building with a grid of windows; ~40% lit (warm) — lit panes go to the glow batch. */
function building(stat: Part[], glow: Part[], x: number, z: number, w: number, h: number, d: number, col: number, r: () => number, face: 1 | -1) {
  stat.push({ p: [x, h / 2, z], s: [w, h, d], c: col });
  stat.push({ p: [x, h + 0.15, z], s: [w + 0.3, 0.3, d + 0.3], c: 0x3a3532 });
  const floors = Math.floor(h / 3);
  for (let f = 0; f < floors; f++) for (let i = 0; i < Math.floor(w / 2.4); i++) {
    const wx = x - w / 2 + 1.2 + i * 2.4, wy = 1.6 + f * 3, wz = z + face * (d / 2 + 0.02);
    const lit = r() < 0.42;
    (lit ? glow : stat).push({ p: [wx, wy, wz], s: [1.1, 1.3, 0.04], c: lit ? (r() < 0.7 ? C.window : 0xf2f0e0) : 0x1d2229 });
  }
}

function signPlane(s: THREE.Scene, text: string, x: number, y: number, z: number, w: number, h: number, bg: string, fg: string, ry = 0, vertical = false) {
  const tex = textTexture(vertical ? 128 : 512, vertical ? 512 : 128, g => {
    g.fillStyle = bg; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.fillStyle = fg;
    if (vertical) vertText(g, text, 64, 24, 92);
    else { g.font = 'bold 84px "Noto Serif CJK TC","Noto Sans CJK TC",serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 68); }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: true }));
  m.position.set(x, y, z); m.rotation.y = ry; s.add(m);
}

/** Big-character posters on the notice board. Generic, fictional mourning texts. */
function posterTexture() {
  const lines = ['悼念耀邦', '沉痛悼念', '春寒料峭', '一路走好', '花圈獻給你', '悼', '心中的話', '清明未遠'];
  return textTexture(1024, 512, g => {
    g.fillStyle = '#3b2e22'; g.fillRect(0, 0, 1024, 512);
    const r = rng(7);
    for (let i = 0; i < 11; i++) {
      const x = 12 + i * 92 + r() * 6, y = 10 + r() * 20, w = 82, h = 470 - r() * 60;
      g.fillStyle = i % 4 === 1 ? '#f4f1ea' : i % 4 === 3 ? '#e9e3d0' : '#efe6c8';
      g.save(); g.translate(x + w / 2, y); g.rotate((r() - 0.5) * 0.04); g.fillRect(-w / 2, 0, w, h);
      g.fillStyle = i % 5 === 2 ? '#202020' : '#141414';
      vertText(g, lines[i % lines.length], 0, 14, Math.min(54, (h - 30) / (lines[i % lines.length].length * 1.1)));
      g.restore();
    }
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(150 + i * 230, 470, 26, 0, 7); g.fill(); } // paper flowers
  });
}

export function buildCampus(): World {
  const s = base(0x0e1220);
  const stat: Part[] = [], glow: Part[] = [];
  const r = rng(42);
  stat.push({ p: [0, -0.05, 0], s: [70, 0.1, 70], c: 0x26271f });             // lawn/dirt
  stat.push({ p: [0, 0.01, -4], s: [5, 0.04, 40], c: 0x3a3936 });             // path to gate
  stat.push({ p: [0, 0.01, 4], s: [30, 0.04, 4], c: 0x3a3936 });
  building(stat, glow, 0, 12, 34, 15, 8, C.brick, r, -1);                      // dorm, 5 floors
  stat.push({ p: [0, 1.4, 7.9], s: [2.4, 2.8, 0.3], c: 0x2a2018 });            // dorm door
  glow.push({ p: [0, 3.0, 7.8], s: [0.5, 0.25, 0.1], c: 0xfff2c0 });
  building(stat, glow, -22, -2, 8, 12, 22, C.greyBrick, r, 1);
  building(stat, glow, 22, -2, 8, 9, 22, C.plaster, r, -1);
  // notice board (wood frame) + loudspeaker pole
  stat.push({ p: [2, 1.4, -4.4], s: [6.6, 2.9, 0.25], c: C.wood }, { p: [2, 3.0, -4.4], s: [7, 0.25, 0.6], c: 0x3a2a1c });
  stat.push({ p: [-1.6, 2, -4.4], s: [0.15, 4, 0.15], c: C.wood }, { p: [5.6, 2, -4.4], s: [0.15, 4, 0.15], c: C.wood });
  stat.push({ p: [-3, 3, -5], s: [0.12, 6, 0.12], c: 0x404040, cyl: true }, { p: [-2.7, 5.6, -5], s: [0.5, 0.35, 0.35], c: 0x6b6f63, ry: 0.6, cyl: true });
  // campus gate: two pillars, beam, red doors folded back, guard house
  stat.push({ p: [-4, 2.5, -16], s: [1.4, 5, 1.4], c: 0x7a3a2c }, { p: [4, 2.5, -16], s: [1.4, 5, 1.4], c: 0x7a3a2c });
  stat.push({ p: [0, 5.3, -16], s: [10.5, 1.2, 1.6], c: 0x5a2a20 }, { p: [0, 6.1, -16], s: [11.5, 0.4, 2.4], c: 0x2b2f2c });
  stat.push({ p: [-6.6, 1.4, -15.2], s: [3, 2.8, 2.6], c: C.plaster });
  glow.push({ p: [-6.6, 1.6, -13.88], s: [1.4, 0.9, 0.04], c: 0xfff0b0 });
  stat.push({ p: [0, 0.01, -22], s: [70, 0.04, 8], c: C.asphalt });
  // people (fictional NPCs at hotspots + passers-by)
  stat.push(...place(person(C.khaki), -6, 3, -0.6), ...place(person(0x6a2f3a, 0x2d2d33), 5, -2, 2.2));
  stat.push(...place(person(C.navy), -1, -5.5, 1.5), ...place(person(C.green), 0.2, -6, 1.8), ...place(person(0x5d5a52), 4.6, -6.2, 1.4));
  s.add(new THREE.Mesh(mergeParts(stat), litMat()));
  s.add(new THREE.Mesh(mergeParts(glow), glowMat()));
  // posters
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 2.6), new THREE.MeshLambertMaterial({ map: posterTexture(), emissive: 0x2a2418 }));
  board.position.set(2, 1.4, -4.54); board.rotation.y = Math.PI; s.add(board);
  signPlane(s, '北 京 大 學', 0, 5.3, -16.82, 6, 1, '#5a2a20', '#e8d9a8', Math.PI);
  // trees (pagoda trees on campus), parked bikes, lamps
  const trees = []; for (let i = 0; i < 8; i++) trees.push({ x: (i % 2 ? 1 : -1) * (9 + r() * 3), z: -14 + i * 2.6 + r(), ry: r() * 6, s: 0.8 + r() * 0.4 });
  for (let i = 0; i < 10; i++) trees.push({ x: -16 + i * 3.6, z: 4.5 + r(), ry: r() * 6, s: 0.9 });
  s.add(instanced(mergeParts(tree(false)), litMat(), trees));
  const bikes = []; for (let i = 0; i < 18; i++) bikes.push({ x: 6 + i * 0.55, z: -13 + (i % 2) * 0.2, ry: Math.PI / 2 + (r() - 0.5) * 0.2 });
  for (let i = 0; i < 12; i++) bikes.push({ x: -14 + i * 0.55, z: 6.5, ry: -Math.PI / 2 });
  s.add(instanced(mergeParts(bike()), litMat(), bikes));
  const lamps = [{ x: -2.5, z: -10 }, { x: 2.5, z: 0 }, { x: 8, z: 4 }, { x: -8, z: 4 }, { x: 3, z: -17 }];
  s.add(instanced(mergeParts(lampPole()), litMat(), lamps));
  s.add(instanced(mergeParts(lampHead()), glowMat(), lamps));
  sodium(s, 3.4, -2, 16); sodium(s, -1.6, -10, 12); sodium(s, 0, 7, 10); sodium(s, 3.9, -17, 12);
  return { id: 'campus', scene: s, spawn: [0, 5], bounds: [-18, 18, -20, 7], update() { /* static */ } };
}

export function buildStreet(): World {
  const s = base(0x121423);
  const stat: Part[] = [], glow: Part[] = [];
  const r = rng(1989);
  stat.push({ p: [0, -0.05, -10], s: [120, 0.1, 10], c: C.asphalt });          // avenue
  for (let x = -56; x < 60; x += 6) stat.push({ p: [x, 0.01, -10], s: [3, 0.02, 0.15], c: 0x9a978c });
  stat.push({ p: [0, 0.06, -3.5], s: [120, 0.12, 3], c: 0x4a4740 }, { p: [0, 0.06, -16.5], s: [120, 0.12, 3], c: 0x4a4740 });
  stat.push({ p: [0, -0.05, 6], s: [120, 0.1, 18], c: 0x2a2826 }, { p: [0, -0.05, -26], s: [120, 0.1, 14], c: 0x2a2826 });
  // north side: low shop buildings with a gap (hutong entrance) at x 12..16
  const fronts: [number, number, number][] = [[-30, 14, 6], [-15, 12, 9], [2, 18, 6.5], [26, 16, 7.5]];
  for (const [x, w, h] of fronts) building(stat, glow, x, 2, w, h, 4, r() < 0.5 ? C.greyBrick : C.plaster, r, -1);
  // hutong: grey brick walls, red gate with lamp, pagoda tree
  stat.push({ p: [11.4, 1.6, 6], s: [0.5, 3.2, 12], c: C.greyBrick }, { p: [17.6, 1.6, 6], s: [0.5, 3.2, 12], c: C.greyBrick });
  stat.push({ p: [14.5, 1.4, 9], s: [2.2, 2.8, 0.3], c: 0x8a2a1e }, { p: [14.5, 3.1, 9], s: [3, 0.5, 0.8], c: 0x2e3130 });
  stat.push({ p: [13.3, 0.25, 8.7], s: [0.5, 0.5, 0.4], c: 0x6d6d68 }, { p: [15.7, 0.25, 8.7], s: [0.5, 0.5, 0.4], c: 0x6d6d68 }); // 門墩
  glow.push({ p: [14.5, 2.65, 8.8], s: [0.25, 0.3, 0.25], c: 0xffd27a });
  stat.push(...place(tree(false), 16, 4.5, 0, 0));
  // newspaper kiosk
  stat.push({ p: [-6, 1.2, -1.5], s: [2.6, 2.4, 1.8], c: 0x3d5a46 }, { p: [-6, 2.5, -1.5], s: [3.0, 0.2, 2.2], c: 0x2a3b2f });
  glow.push({ p: [-6, 1.4, -2.42], s: [2.0, 0.9, 0.04], c: 0xf0d9a0 });
  // loudspeaker pole
  stat.push({ p: [6, 3.2, -2.4], s: [0.18, 6.4, 0.18], c: 0x3d3d3d, cyl: true });
  stat.push({ p: [6.3, 6.0, -2.4], s: [0.55, 0.4, 0.4], c: 0x6b6f63, cyl: true, rz: 1.2 }, { p: [5.7, 6.0, -2.4], s: [0.55, 0.4, 0.4], c: 0x6b6f63, cyl: true, rz: -1.2 });
  // bus stop sign
  stat.push({ p: [-18, 1.4, -5], s: [0.08, 2.8, 0.08], c: 0x777777 });
  // fictional NPCs at hotspots
  stat.push(...place(person(0x4b4a45, C.black, 0xbbbbbb), -6, -3.4, Math.PI / 2));       // 孫大爺
  stat.push(...place(person(0x3a4a5a), 2, -4.4, 2.6));                                     // 王師傅 (blue work clothes)
  stat.push(...place(bike(0x5b5f3c), -3.2, -7.3, Math.PI));                                // student with bike
  stat.push(...place(person(0x7a6a50), -4, -6.4, -0.3), ...place(person(C.navy), -2.2, -6.6, 0.4));
  s.add(new THREE.Mesh(mergeParts(stat), litMat()));
  s.add(new THREE.Mesh(mergeParts(glow), glowMat()));
  signPlane(s, '報刊', -6, 2.85, -2.62, 1.8, 0.45, '#2a3b2f', '#f0e2b0', Math.PI);
  signPlane(s, '國營副食店', -15, 5.5, -0.02, 6, 1.1, '#7d2a22', '#f3e3b5', Math.PI);
  signPlane(s, '紅星飯館', 2, 4.4, -0.02, 4.4, 0.9, '#203a2c', '#f6dd9a', Math.PI);
  signPlane(s, '理髮', 26, 3.3, -0.02, 2.2, 0.8, '#d9d0b8', '#8c2a22', Math.PI);
  signPlane(s, '公共汽車站', -18, 2.9, -5.04, 0.5, 2.0, '#efe7d0', '#7d2a22', Math.PI, true);
  // poplars along the avenue, pagoda tree row, lamps
  const pops = []; for (let x = -54; x < 56; x += 5) { pops.push({ x: x + r(), z: -5.6, ry: r() * 6 }); pops.push({ x: x + r() + 2.5, z: -14.6, ry: r() * 6 }); }
  s.add(instanced(mergeParts(tree(true)), litMat(), pops.filter(p => Math.abs(p.x - 6) > 1.5 && Math.abs(p.x + 6) > 2)));
  const lamps = []; for (let x = -50; x < 56; x += 14) lamps.push({ x, z: -5.0 }, { x: x + 7, z: -15, ry: Math.PI });
  s.add(instanced(mergeParts(lampPole()), litMat(), lamps));
  s.add(instanced(mergeParts(lampHead()), glowMat(), lamps));
  for (const x of [-14, 0, 14]) sodium(s, x + 0.9, -6, 16);
  sodium(s, 14.5, 6, 8);
  const parked = []; for (let i = 0; i < 14; i++) parked.push({ x: -26 + i * 0.6, z: -2.6, ry: Math.PI / 2 });
  for (let i = 0; i < 10; i++) parked.push({ x: 20 + i * 0.6, z: -2.6, ry: Math.PI / 2 });
  s.add(instanced(mergeParts(bike()), litMat(), parked));

  // moving traffic: riders (instanced), one bus, walkers heading south/east
  const jackets = [C.navy, C.khaki, 0x4e5a4a, 0x5d4c3a, 0x2f3540, 0x6a2f3a];
  const riderGeo = mergeParts(bike(C.navy));
  const N = 22;
  const riders = new THREE.InstancedMesh(riderGeo, litMat(), N);
  const rs = Array.from({ length: N }, (_, i) => ({ x: -60 + r() * 120, z: -12.8 + r() * 2.2 + (i % 2 ? 0 : 4.2), v: (i % 2 ? 1 : -1) * (3.2 + r() * 1.6) }));
  rs.forEach((_, i) => riders.setColorAt(i, new THREE.Color(0xffffff).lerp(new THREE.Color(jackets[i % jackets.length]), 0.0)));
  s.add(riders);
  const busMesh = new THREE.Group();
  busMesh.add(new THREE.Mesh(mergeParts(bus()), litMat()), new THREE.Mesh(mergeParts(busWindows()), glowMat()));
  busMesh.position.set(-40, 0, -11.5); s.add(busMesh);
  const walkGeo = mergeParts(person(0x4a4e58));
  const W = 10; const walkers = new THREE.InstancedMesh(walkGeo, litMat(), W);
  const ws = Array.from({ length: W }, () => ({ x: -50 + r() * 100, z: -3.2 + r() * 0.6, v: (r() < 0.6 ? 1 : -1) * (1 + r() * 0.5) }));
  s.add(walkers);
  const o = new THREE.Object3D();
  return {
    id: 'street', scene: s, spawn: [-14, -4], bounds: [-40, 40, -18, 8],
    update(dt, t) {
      rs.forEach((b, i) => {
        b.x += b.v * dt; if (b.x > 60) b.x = -60; if (b.x < -60) b.x = 60;
        o.position.set(b.x, Math.sin(t * 9 + i) * 0.015, b.z); o.rotation.set(0, b.v > 0 ? 0 : Math.PI, 0); o.updateMatrix(); riders.setMatrixAt(i, o.matrix);
      });
      riders.instanceMatrix.needsUpdate = true;
      busMesh.position.x += 6 * dt; if (busMesh.position.x > 70) busMesh.position.x = -70;
      ws.forEach((w, i) => {
        w.x += w.v * dt; if (w.x > 50) w.x = -50; if (w.x < -50) w.x = 50;
        o.position.set(w.x, Math.abs(Math.sin(t * 6 + i)) * 0.04, w.z); o.rotation.set(0, w.v > 0 ? 0 : Math.PI, 0); o.updateMatrix(); walkers.setMatrixAt(i, o.matrix);
      });
      walkers.instanceMatrix.needsUpdate = true;
    },
  };
}
