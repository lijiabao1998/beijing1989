import * as THREE from 'three';
import { C, Part, glowMat, instanced, litMat, mergeParts, place, rng, textTexture, vertText } from './kit';
import { bike, lampHead, lampPole, person, tree } from './props';
import { greatHall, huadengGlobes, huadengPole, monument, pkuWestGate, tiananmen, trolleybus, trolleyWindows } from './landmarks';
import type { SceneId } from '../types';

export interface World {
  id: SceneId; scene: THREE.Scene; spawn: [number, number];
  bounds: [number, number, number, number]; // minX,maxX,minZ,maxZ
  update(dt: number, t: number): void;
  camDist?: number; speed?: number; cam?: { h: number; ahead: number; y: number };
}

function base(fogColor: number, near = 18, far = 70): THREE.Scene {
  const s = new THREE.Scene();
  s.background = new THREE.Color(fogColor);
  s.fog = new THREE.Fog(fogColor, near, far);
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
  // 北京大學西校門 (modelled from Commons photos; faces the road, south of campus here)
  stat.push(...place(pkuWestGate(), 0, -16));
  stat.push({ p: [-10.5, 1.4, -15.2], s: [3, 2.8, 2.6], c: C.plaster }, { p: [-30, 1.4, -14.5], s: [36, 2.8, 0.5], c: 0x8a3a2c }, { p: [30, 1.4, -14.5], s: [36, 2.8, 0.5], c: 0x8a3a2c });
  glow.push({ p: [-10.5, 1.6, -16.52], s: [1.4, 0.9, 0.04], c: 0xfff0b0 });
  stat.push({ p: [0, 0.01, -22], s: [70, 0.04, 8], c: C.asphalt });
  // people (fictional NPCs at hotspots + passers-by)
  stat.push(...place(person(C.khaki), -6, 3, -0.6), ...place(person(0x6a2f3a, 0x2d2d33), 5, -2, 2.2));
  stat.push(...place(person(C.navy), -1, -5.5, 1.5), ...place(person(C.green), 0.2, -6, 1.8), ...place(person(0x5d5a52), 4.6, -6.2, 1.4));
  s.add(new THREE.Mesh(mergeParts(stat), litMat()));
  s.add(new THREE.Mesh(mergeParts(glow), glowMat()));
  // posters
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 2.6), new THREE.MeshLambertMaterial({ map: posterTexture(), emissive: 0x2a2418 }));
  board.position.set(2, 1.4, -4.54); board.rotation.y = Math.PI; s.add(board);
  signPlane(s, '北京大學', 0, 4.75, -19.0, 3.0, 0.95, '#141210', '#d8b45a', Math.PI);
  // trees (pagoda trees on campus), parked bikes, lamps
  const trees = []; for (let i = 0; i < 8; i++) trees.push({ x: (i % 2 ? 1 : -1) * (9 + r() * 3), z: -14 + i * 2.6 + r(), ry: r() * 6, s: 0.8 + r() * 0.4 });
  for (let i = 0; i < 10; i++) trees.push({ x: -16 + i * 3.6, z: 4.5 + r(), ry: r() * 6, s: 0.9 });
  s.add(instanced(mergeParts(tree(false)), litMat(), trees));
  const bikes = []; for (let i = 0; i < 18; i++) bikes.push({ x: 6 + i * 0.55, z: -13 + (i % 2) * 0.2, ry: Math.PI / 2 + (r() - 0.5) * 0.2 });
  for (let i = 0; i < 12; i++) bikes.push({ x: -14 + i * 0.55, z: 6.5, ry: -Math.PI / 2 });
  s.add(instanced(mergeParts(bike()), litMat(), bikes));
  const lamps = [{ x: -2.5, z: -10 }, { x: 2.5, z: 0 }, { x: 8, z: 4 }, { x: -8, z: 4 }, { x: 9, z: -21 }, { x: -9, z: -21, ry: Math.PI }];
  s.add(instanced(mergeParts(lampPole()), litMat(), lamps));
  s.add(instanced(mergeParts(lampHead()), glowMat(), lamps));
  sodium(s, 3.4, -2, 16); sodium(s, -1.6, -10, 12); sodium(s, 0, 7, 10); sodium(s, 0, -21, 18);
  return { id: 'campus', scene: s, spawn: [0, 5], bounds: [-18, 18, -27, 7], update() { /* static */ } };
}

export function buildStreet(mode: 'night' | 'march' = 'night'): World {
  const march = mode === 'march';
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
  const N = march ? 6 : 22;
  const riders = new THREE.InstancedMesh(riderGeo, litMat(), N);
  const rs = Array.from({ length: N }, (_, i) => ({ x: -60 + r() * 120, z: -12.8 + r() * 2.2 + (i % 2 ? 0 : 4.2), v: (i % 2 ? 1 : -1) * (3.2 + r() * 1.6) }));
  rs.forEach((_, i) => riders.setColorAt(i, new THREE.Color(0xffffff).lerp(new THREE.Color(jackets[i % jackets.length]), 0.0)));
  s.add(riders);
  const busMesh = new THREE.Group();
  busMesh.add(new THREE.Mesh(mergeParts(trolleybus()), litMat()), new THREE.Mesh(mergeParts(trolleyWindows()), glowMat()));
  s.add(new THREE.Mesh(mergeParts(wires(-60, 60, [-11.15, -11.85, -7.9, -8.6], -5.2, -14.8, 14)), litMat()));
  busMesh.position.set(-40, 0, -11.5); if (!march) s.add(busMesh);
  const walkGeo = mergeParts(person(0x4a4e58));
  const W = 10; const walkers = new THREE.InstancedMesh(walkGeo, litMat(), W);
  const ws = Array.from({ length: W }, () => ({ x: -50 + r() * 100, z: -3.2 + r() * 0.6, v: (r() < 0.6 ? 1 : -1) * (1 + r() * 0.5) }));
  s.add(walkers);
  const o = new THREE.Object3D();
  // 4/21 night: the march fills the avenue (instanced marchers in columns + banners), picket lines at the edges
  const M = march ? 260 : 0, ms = Array.from({ length: M }, (_, i) => ({ x: -60 + (i % 52) * 2.3 + r(), z: -7.2 - Math.floor(i / 52) * 1.4 - r() * 0.3 }));
  const marchers = new THREE.InstancedMesh(mergeParts(person(0x3a3f48)), litMat(), Math.max(1, M));
  const mcol = [C.navy, C.khaki, 0x2f3540, 0x5d4c3a, 0x4e5a4a, 0x6a2f3a]; ms.forEach((_, i) => marchers.setColorAt(i, new THREE.Color(mcol[i % 6]).multiplyScalar(2.2)));
  const B = march ? 10 : 0, flags = new THREE.InstancedMesh(mergeParts([{ p: [0, 2.2, 0], s: [0.05, 2.6, 0.05], c: 0x6b5a40 }, { p: [0.75, 3.1, 0], s: [1.5, 0.9, 0.03], c: 0xb3251c }]), litMat(), Math.max(1, B));
  if (march) {
    s.add(marchers, flags);
    const pk: Part[] = []; for (let x = -56; x <= 56; x += 1.1) pk.push(...place(person(0xd8d4c8), x, -5.9, Math.PI / 2), ...place(person(0xd8d4c8), x + 0.5, -14.1, Math.PI / 2));
    s.add(new THREE.Mesh(mergeParts(pk), litMat()));
    sodium(s, -28, -9, 22); sodium(s, 28, -9, 22); sodium(s, -14, -12, 18); sodium(s, 14, -12, 18);
  }
  return {
    id: march ? 'march' : 'street', scene: s, spawn: march ? [-30, -6] : [-14, -4], bounds: [-40, 40, -18, 8], camDist: march ? 12 : undefined, cam: march ? { h: 0.55, ahead: 8, y: 0 } : undefined,
    update(dt, t) {
      if (march) {
        ms.forEach((m, i) => { m.x += 1.1 * dt; if (m.x > 60) m.x = -60; o.position.set(m.x, Math.abs(Math.sin(t * 5 + i)) * 0.05, m.z); o.rotation.set(0, Math.PI / 2, 0); o.updateMatrix(); marchers.setMatrixAt(i, o.matrix); });
        marchers.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < B; i++) { const m = ms[i * 26]; o.position.set(m.x + 0.3, 0, m.z); o.rotation.set(0, 0, 0); o.updateMatrix(); flags.setMatrixAt(i, o.matrix); }
        flags.instanceMatrix.needsUpdate = true;
      }
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

/** Overhead trolleybus wires plus span poles. */
function wires(x0: number, x1: number, zs: number[], poleZa: number, poleZb: number, step: number): Part[] {
  const p: Part[] = [];
  for (const z of zs) p.push({ p: [(x0 + x1) / 2, 5.9, z], s: [x1 - x0, 0.03, 0.03], c: 0x222222 });
  for (let x = x0; x <= x1; x += step) {
    p.push({ p: [x, 3.1, poleZa], s: [0.2, 6.2, 0.2], c: 0x4a4a46, cyl: true, seg: 6 }, { p: [x, 3.1, poleZb], s: [0.2, 6.2, 0.2], c: 0x4a4a46, cyl: true, seg: 6 });
    p.push({ p: [x, 6.0, (poleZa + poleZb) / 2], s: [0.03, 0.03, Math.abs(poleZa - poleZb)], c: 0x222222 });
  }
  return p;
}

function portraitTexture() {
  // Stylised, low-detail rendering of the portrait that hangs over the central arch (not a reproduction of the painting).
  return textTexture(256, 340, g => {
    g.fillStyle = '#c9b48a'; g.fillRect(0, 0, 256, 340); g.fillStyle = '#6b5a3a'; g.fillRect(8, 8, 240, 324);
    const grd = g.createLinearGradient(0, 0, 0, 340); grd.addColorStop(0, '#8a8f7e'); grd.addColorStop(1, '#5d6457'); g.fillStyle = grd; g.fillRect(16, 16, 224, 308);
    g.fillStyle = '#4c5246'; g.beginPath(); g.moveTo(30, 324); g.quadraticCurveTo(128, 180, 226, 324); g.fill();  // grey tunic
    g.fillStyle = '#d9b38c'; g.beginPath(); g.ellipse(128, 140, 52, 66, 0, 0, 7); g.fill();                         // face
    g.fillStyle = '#1e1a16'; g.beginPath(); g.ellipse(128, 92, 56, 30, 0, Math.PI, 0); g.fill();                    // hair
    g.fillStyle = 'rgba(80,50,30,.35)'; g.fillRect(100, 132, 18, 5); g.fillRect(138, 132, 18, 5); g.fillRect(118, 178, 22, 4);
  });
}

function sloganTexture(text: string) {
  return textTexture(1024, 128, g => {
    g.fillStyle = '#b3251c'; g.fillRect(0, 0, 1024, 128);
    g.fillStyle = '#f7f1e2'; g.font = 'bold 86px "Noto Sans CJK TC","Noto Serif CJK TC",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 512, 68);
  });
}

/** 長安街 at 天安門: real proportions (compressed only to the south of the Square so the Monument and Great Hall read). */
export function buildChangan(mode: 'night' | 'dawn' = 'night'): World {
  const dawn = mode === 'dawn';
  const s = base(dawn ? 0xb4bfcc : 0x1b2030, dawn ? 160 : 120, dawn ? 900 : 650);
  const stat: Part[] = [], glow: Part[] = [], flood: Part[] = [];
  const r = rng(417), o = new THREE.Object3D();
  // ground: avenue (z -38..-88), bike lanes behind railings, Square paving to the south
  stat.push({ p: [0, -0.05, -63], s: [700, 0.1, 50], c: 0x26262a });
  for (let x = -340; x < 340; x += 9) for (const z of [-56, -63, -70]) stat.push({ p: [x, 0.01, z], s: [4.5, 0.02, 0.2], c: 0x9a978c });
  stat.push({ p: [0, 0.01, -63], s: [700, 0.02, 0.35], c: 0xc9b860 });
  for (const z of [-42, -84]) {
    stat.push({ p: [0, 0.6, z + (z < -60 ? 3.5 : -3.5)], s: [700, 0.08, 0.08], c: 0x4c7aa8 }, { p: [0, 0.25, z + (z < -60 ? 3.5 : -3.5)], s: [700, 0.06, 0.06], c: 0xd8d8d0 });
    for (let x = -340; x < 340; x += 3) stat.push({ p: [x, 0.3, z + (z < -60 ? 3.5 : -3.5)], s: [0.06, 0.6, 0.06], c: 0x4c7aa8 }); // blue-white railings
  }
  stat.push({ p: [0, -0.04, -260], s: [180, 0.1, 340], c: 0x7d776c });          // Square paving
  stat.push({ p: [0, -0.06, -15], s: [700, 0.1, 50], c: 0x3a3833 });
  for (let x = -85; x <= 85; x += 10) stat.push({ p: [x, 0.0, -260], s: [0.25, 0.03, 340], c: 0x6b665c });
  // landmarks
  flood.push(...tiananmen());
  flood.push(...place(monument(), 0, -330));
  flood.push(...place(greatHall(), -150, -320), ...place(greatHall(true), 150, -320, Math.PI));
  stat.push({ p: [0, 15, -112], s: [0.35, 30, 0.35], c: 0xc8c8c0, cyl: true }, { p: [1.8, 28.5, -112], s: [3.6, 2.4, 0.05], c: 0xc21f1a }); // flagpole
  // red lanterns under the eaves of the gate
  for (const x of [-21, -15, -9, -3, 3, 9, 15, 21]) glow.push({ p: [x, 20.6, -13.2], s: [1.5, 1.8, 1.5], c: 0xe0402a, sphere: true });
  for (let i = 0; i < 10; i++) glow.push({ p: [-22 + i * 4.9, 17.5, -12.25], s: [3.2, 4.5, 0.05], c: 0xffd48a });   // lit hall windows
  // poplars along the avenue + pagoda trees by the wall, period sodium lamps beyond the Tiananmen section
  const pops = []; for (let x = -330; x < 330; x += 7) { if (Math.abs(x) < 80) continue; pops.push({ x: x + r() * 2, z: -36 - r(), ry: r() * 6, s: 1.3 }, { x: x + r() * 2 + 3, z: -90 - r(), ry: r() * 6, s: 1.3 }); }
  const lamps = []; for (let x = -320; x <= 320; x += 32) if (Math.abs(x) > 90) lamps.push({ x, z: -41, s: 1.3 }, { x: x + 16, z: -85, ry: Math.PI, s: 1.3 });
  const hd = []; for (let x = -80; x <= 80; x += 20) hd.push({ x, z: -40 }, { x, z: -86 }); for (let z = -110; z > -420; z -= 40) hd.push({ x: -86, z }, { x: 86, z });
  // fictional people: students at the Square's north edge, a bicycle repairer, passers-by
  stat.push(...place(person(0x2f3540), 6, -95, 2), ...place(person(C.khaki), 8, -96.5, 1.2), ...place(person(0x5b5f3c), 9.5, -94.5, 2.8), ...place(person(C.navy), 12, -96, 3.6));
  stat.push(...place(person(0x4b4a45, C.black, 0x999999), -40, -88.5, Math.PI / 2), { p: [-41, 0.25, -88.5], s: [0.8, 0.5, 0.5], c: 0x5a3e28 });
  stat.push(...place(bike(), -38.6, -88.6, 0.2));
  for (let i = 0; i < 26; i++) stat.push(...place(person([C.navy, C.khaki, 0x2f3540, 0x5d4c3a][i % 4]), -60 + r() * 120, -105 - r() * 200, r() * 6));
  s.add(new THREE.Mesh(mergeParts(stat), litMat()));
  s.add(new THREE.Mesh(mergeParts(flood), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: dawn ? 0x140a06 : 0x4a2a18 })));
  s.add(new THREE.Mesh(mergeParts(glow), glowMat()));
  s.add(instanced(mergeParts(tree(true)), litMat(), pops));
  s.add(instanced(mergeParts(lampPole()), litMat(), lamps));
  s.add(instanced(mergeParts(lampHead()), glowMat(), lamps));
  s.add(instanced(mergeParts(huadengPole()), litMat(), hd));
  s.add(instanced(mergeParts(huadengGlobes().map(g => ({ ...g, s: g.s.map(v => v * 0.7) as [number, number, number] }))), glowMat(), hd));
  s.add(new THREE.Mesh(mergeParts(wires(-340, 340, [-57.4, -58.1, -67.9, -68.6], -44.5, -81.5, 40)), litMat()));
  // portrait + the two slogan boards
  const por = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 6.4), new THREE.MeshBasicMaterial({ map: portraitTexture(), fog: true }));
  por.position.set(0, 12.0, -18.62); por.rotation.y = Math.PI; s.add(por);
  for (const [x, t] of [[19, '中華人民共和國萬歲'], [-19, '世界人民大團結萬歲']] as [number, string][]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(17, 2.1), new THREE.MeshBasicMaterial({ map: sloganTexture(t), fog: true }));
    m.position.set(x, 10.6, -18.62); m.rotation.y = Math.PI; s.add(m);
  }
  // floodlight on the gate + a few lights on the avenue
  if (dawn) {
    const sky = textTexture(8, 256, g => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#6f8fb8'); gr.addColorStop(0.55, '#b9c4d2'); gr.addColorStop(0.8, '#e6cdb0'); gr.addColorStop(1, '#d8c8b4'); g.fillStyle = gr; g.fillRect(0, 0, 8, 256); });
    s.background = sky; (s.fog as THREE.Fog).color.set(0xd2c9bb);
    const hemi = new THREE.HemisphereLight(0xdfe7f2, 0x6b604c, 1.25); hemi.name = 'day'; s.add(hemi);
    const sun = new THREE.DirectionalLight(0xffdcb4, 1.6); sun.name = 'day'; sun.position.set(300, 90, -120); s.add(sun);
  }
  const fl = new THREE.SpotLight(0xffd9a0, 2.2, 160, 0.5, 0.6, 0); fl.position.set(0, 6, -70); fl.target.position.set(0, 18, -10); s.add(fl, fl.target);
  for (const x of [-40, 0, 40]) { const l = new THREE.PointLight(0xfff0d0, 30, 40, 1.4); l.position.set(x, 8, -63); s.add(l); }
  // Square: floodlit Monument, lit facades, lamp pools
  const fm = new THREE.SpotLight(0xfff4e0, 3, 260, 0.35, 0.5, 0); fm.position.set(0, 4, -200); fm.target.position.set(0, 22, -330); s.add(fm, fm.target);
  for (const sg of [-1, 1]) { const f = new THREE.SpotLight(0xffe6b8, 2.4, 260, 0.6, 0.6, 0); f.position.set(sg * 60, 3, -300); f.target.position.set(sg * 115, 14, -320); s.add(f, f.target); }
  s.add(new THREE.HemisphereLight(0x6a7590, 0x2a2418, 0.5));
  const pool = new THREE.InstancedMesh(new THREE.CircleGeometry(9, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.16, depthWrite: false, fog: true }), hd.length);
  hd.forEach((h, i) => { o.position.set(h.x, 0.04, h.z); o.rotation.set(0, 0, 0); o.updateMatrix(); pool.setMatrixAt(i, o.matrix); }); if (!dawn) s.add(pool);
  if (dawn) {
    [fl, fm].forEach(l => l.visible = false);
    // 4/22 dawn: tens of thousands face the Great Hall; rows of police at its steps; three tiny kneeling figures (distant, not detailed)
    const crowd: { x: number; z: number; ry: number }[] = [];
    for (let i = 0; i < 1400; i++) { const x = -88 + r() * 120, z = -235 - r() * 165; if (Math.abs(x) < 36 && z < -295 && z > -365) continue; crowd.push({ x, z, ry: -Math.PI / 2 + (r() - 0.5) * 0.8 }); }
    const cm = instanced(mergeParts(person(0x3a3f48)), litMat(), crowd);
    const cc = [C.navy, C.khaki, 0x2f3540, 0x5d4c3a, 0x4e5a4a, 0x6a2f3a, 0x8a8a80]; crowd.forEach((_, i) => cm.setColorAt(i, new THREE.Color(cc[i % 7]).multiplyScalar(2.2))); s.add(cm);
    const police: { x: number; z: number; ry: number }[] = []; for (let row = 0; row < 5; row++) for (let z = -270; z <= -370; z -= 0.9) police.push({ x: -93 - row * 0.9, z: z - row * 0.3, ry: Math.PI / 2 });
    s.add(instanced(mergeParts(person(0x4a5a3a, 0x3a4630, 0x2a2e26)), litMat(), police));
    const kneel: Part[] = []; for (const z of [-321.5, -320, -318.5]) kneel.push({ p: [-102.5, 3.4, z], s: [0.5, 0.8, 0.45], c: 0x3a3f48 }, { p: [-102.2, 3.95, z], s: [0.22, 0.24, 0.22], c: 0xc8a07a }, { p: [-102.0, 4.1, z], s: [0.1, 0.4, 0.5], c: 0xf0ece0 });
    s.add(new THREE.Mesh(mergeParts(kneel), litMat()));
    for (const [x, z, t] of [[-70, -300, '沉痛悼念'], [-55, -345, '悼念耀邦'], [-30, -270, '民主　自由']] as [number, number, string][]) {
      const tex = textTexture(512, 128, g => { g.fillStyle = '#f2efe6'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#141414'; g.font = 'bold 84px "Noto Serif CJK TC",serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 256, 68); });
      const b = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); b.position.set(x, 3.6, z); b.rotation.y = Math.PI / 2; s.add(b);
    }
    // loudspeaker poles on the Square
    const sp: Part[] = []; for (const [x, z] of [[-30, -282], [20, -260], [-60, -360]]) sp.push({ p: [x, 4, z], s: [0.25, 8, 0.25], c: 0x55554f, cyl: true }, { p: [x, 7.8, z], s: [0.9, 0.6, 0.6], c: 0x6b6f63, cyl: true, rz: 1.2 });
    s.add(new THREE.Mesh(mergeParts(sp), litMat()));
    s.traverse(o => { const l = o as THREE.Light; if (l.isLight && l.name !== 'day') l.visible = false; });
  }
  // traffic: riders in the bike lanes, trolleybuses under the wires
  const N = 40, riders = new THREE.InstancedMesh(mergeParts(bike(C.navy)), litMat(), N);
  const rs = Array.from({ length: N }, (_, i) => ({ x: -200 + r() * 400, z: (i % 2 ? -42.5 : -82.5) + r() * 2.5, v: (i % 2 ? -1 : 1) * (3 + r() * 2) }));
  s.add(riders);
  const tb = [0, 1].map(i => { const g = new THREE.Group(); g.add(new THREE.Mesh(mergeParts(trolleybus()), litMat()), new THREE.Mesh(mergeParts(trolleyWindows()), glowMat())); g.position.set(i ? 60 : -90, 0, i ? -58 : -68); if (i) g.rotation.y = Math.PI; s.add(g); return g; });
  return {
    id: dawn ? 'square' : 'changan', scene: s, spawn: dawn ? [-20, -262] : [-60, -86], bounds: dawn ? [-95, 60, -400, -95] : [-200, 200, -300, -38], camDist: dawn ? 20 : 30, speed: 8,
    update(dt, t) {
      rs.forEach((b, i) => { b.x += b.v * dt; if (b.x > 200) b.x = -200; if (b.x < -200) b.x = 200; o.position.set(b.x, Math.sin(t * 9 + i) * 0.015, b.z); o.rotation.set(0, b.v > 0 ? 0 : Math.PI, 0); o.updateMatrix(); riders.setMatrixAt(i, o.matrix); });
      riders.instanceMatrix.needsUpdate = true;
      tb[0].position.x += 7 * dt; if (tb[0].position.x > 300) tb[0].position.x = -300;
      tb[1].position.x -= 7 * dt; if (tb[1].position.x < -300) tb[1].position.x = 300;
    },
  };
}
