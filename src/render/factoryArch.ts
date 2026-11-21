import * as THREE from 'three';
import { C, Part, addLayeredParts, glowMat, instanced, litMat, mergeParts, place, rng, textTexture, vertText } from './kit';
import { bike, coalAndCabbage, tableBasin, tricycle, tricycleBodyParts } from './props';
import { addRealisticTrees } from './foliage';
import { asphaltRoadTex, campusPathTex, skyDomeTex } from './materials';
import type { SceneId } from '../types';
import type { World } from './scenes';

const H = Math.PI / 2;

/** Connect two 3D points with a cylindrical rod, pipe, or truss strut. */
function strut(a: [number, number, number], b: [number, number, number], d: number, c: number, seg = 6): Part {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 0.001;
  const rx = Math.asin(Math.max(-1, Math.min(1, dz / len)));
  const rz = Math.atan2(-dx, dy);
  return {
    p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    s: [d, len, d],
    c,
    rx,
    rz,
    cyl: true,
    seg,
  };
}

/** Procedural oil-stained industrial concrete floor texture for the workshop bays. */
function workshopFloorTex(repeatX = 8, repeatY = 5): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;
  const r = rng(1956);

  g.fillStyle = '#47494b';
  g.fillRect(0, 0, S, S);

  // Concrete slab grid seams (4x4 slabs)
  const step = S / 4;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const shade = 68 + Math.round((r() - 0.5) * 10);
      g.fillStyle = `rgb(${shade},${shade + 2},${shade + 3})`;
      g.fillRect(col * step + 2, row * step + 2, step - 4, step - 4);
    }
  }
  g.fillStyle = '#2c2e30';
  for (let i = 0; i < 4; i++) {
    g.fillRect(0, i * step, S, 3);
    g.fillRect(i * step, 0, 3, S);
  }

  // Subtle machine-oil & coolant stains
  for (let i = 0; i < 18; i++) {
    const x = r() * S, y = r() * S, rad = 14 + r() * 34;
    const gr = g.createRadialGradient(x, y, 2, x, y, rad);
    gr.addColorStop(0, 'rgba(24,25,22,0.28)');
    gr.addColorStop(1, 'rgba(24,25,22,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }

  // Fine aggregate grit
  for (let i = 0; i < 3500; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(95,97,99,0.16)' : 'rgba(28,30,32,0.20)';
    g.fillRect(r() * S, r() * S, 1.4, 1.4);
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Helper to mount a crisp canvas-rendered Chinese sign or banner. */
function signPlane(
  s: THREE.Scene,
  text: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  bg: string,
  fg: string,
  ry = Math.PI,
  vertical = false,
  border?: string,
) {
  const tex = textTexture(vertical ? 128 : 640, vertical ? 512 : 128, g => {
    g.fillStyle = bg;
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    if (border) {
      g.strokeStyle = border;
      g.lineWidth = 5;
      g.strokeRect(7, 7, g.canvas.width - 14, g.canvas.height - 14);
    }
    g.fillStyle = fg;
    if (vertical) {
      vertText(g, text, 64, 22, Math.min(72, Math.floor(430 / Math.max(1, text.length))));
    } else {
      g.font = 'bold 68px "Noto Serif CJK TC","Noto Sans CJK TC","PingFang TC",sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, g.canvas.width / 2, g.canvas.height / 2 + 2);
    }
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, fog: true, side: THREE.DoubleSide }),
  );
  m.position.set(x, y, z);
  m.rotation.y = ry;
  s.add(m);
}

/** 1989 State-Owned Factory C6140 Engine Lathe (普通車床) along Z, operator side at +X. */
function c6140Lathe(night: boolean): [Part[], Part[]] {
  const body = 0x365460;
  const dark = 0x263b44;
  const steel = 0x9aa2a8;
  const tray = 0x5c6266;
  const stat: Part[] = [
    // Pedestal bases + foot pads
    { p: [0, 0.04, -0.78], s: [0.84, 0.08, 0.72], c: 0x23282c },
    { p: [0, 0.04, 0.86], s: [0.72, 0.08, 0.46], c: 0x23282c },
    { p: [0, 0.42, -0.78], s: [0.74, 0.68, 0.64], c: dark, bevel: true },
    { p: [0, 0.42, 0.86], s: [0.62, 0.68, 0.38], c: dark, bevel: true },
    // Chip / swarf tray + under-bed bridge
    { p: [0, 0.78, 0.04], s: [0.82, 0.05, 2.28], c: tray },
    { p: [0, 0.83, 0.04], s: [0.56, 0.08, 2.10], c: body },
    // Cast-iron lathe bed + ground steel V-ways
    { p: [0, 0.96, 0.04], s: [0.46, 0.22, 2.26], c: body },
    { p: [-0.14, 1.09, 0.06], s: [0.06, 0.04, 2.18], c: steel },
    { p: [0.14, 1.09, 0.06], s: [0.06, 0.04, 2.18], c: steel },
    // Headstock housing (床頭箱) + top lid + speed levers + nameplate
    { p: [0, 1.32, -0.78], s: [0.54, 0.50, 0.66], c: body, bevel: true },
    { p: [0, 1.59, -0.78], s: [0.50, 0.06, 0.62], c: 0x456876 },
    { p: [0.28, 1.38, -0.76], s: [0.03, 0.20, 0.34], c: 0x1c2024 },
    { p: [0.29, 1.41, -0.84], s: [0.04, 0.08, 0.08], c: 0x9c2c24 },
    { p: [0.33, 1.30, -0.66], s: [0.10, 0.025, 0.025], c: C.chrome, rz: 0.4 },
    { p: [0.33, 1.30, -0.88], s: [0.10, 0.025, 0.025], c: C.chrome, rz: -0.3 },
    // Spindle flange, 3-jaw chuck (三爪卡盤), & machined steel bar
    { p: [0, 1.28, -0.40], s: [0.24, 0.10, 0.24], c: 0x3b4044, cyl: true, rx: H, seg: 10 },
    { p: [0, 1.28, -0.29], s: [0.32, 0.14, 0.32], c: steel, cyl: true, rx: H, seg: 12 },
    { p: [0, 1.28, -0.06], s: [0.08, 0.34, 0.08], c: 0xc2c8cc, cyl: true, rx: H, seg: 10 },
    // Carriage / apron (溜板箱), cross-slide, toolpost & handwheels
    { p: [0.08, 1.00, 0.12], s: [0.40, 0.34, 0.42], c: body },
    { p: [0.04, 1.18, 0.12], s: [0.46, 0.10, 0.32], c: dark },
    { p: [0, 1.28, 0.10], s: [0.16, 0.14, 0.16], c: 0x2a2d30 },
    { p: [0.30, 0.96, 0.02], s: [0.18, 0.18, 0.18], c: C.chrome, torus: true, tube: 0.14, seg: 10, detail: 4, ry: H },
    { p: [0.30, 1.18, 0.18], s: [0.14, 0.14, 0.14], c: C.chrome, torus: true, tube: 0.14, seg: 10, detail: 4, ry: H },
    // Tailstock (尾座) & quill + rear handwheel
    { p: [0, 1.24, 0.84], s: [0.34, 0.28, 0.40], c: body, bevel: true },
    { p: [0, 1.28, 0.56], s: [0.075, 0.20, 0.075], c: steel, cyl: true, rx: H, seg: 8, top: 0.55 },
    { p: [0, 1.28, 1.08], s: [0.15, 0.15, 0.15], c: C.chrome, torus: true, tube: 0.14, seg: 10, detail: 4, ry: H },
    // Precision leadscrew & feed rod along operator side
    { p: [0.24, 0.94, 0.24], s: [0.032, 1.72, 0.032], c: steel, cyl: true, rx: H, seg: 6 },
    { p: [0.24, 0.88, 0.24], s: [0.026, 1.72, 0.026], c: 0x767c80, cyl: true, rx: H, seg: 6 },
    // Articulated work-lamp arm + green enamel shade
    strut([-0.22, 1.48, -0.52], [-0.20, 1.82, -0.26], 0.026, 0x242628, 5),
    strut([-0.20, 1.82, -0.26], [-0.04, 1.68, -0.10], 0.024, 0x242628, 5),
    { p: [-0.02, 1.63, -0.08], s: [0.16, 0.12, 0.16], c: 0x264b36, cyl: true, seg: 8, top: 0.35, rz: -0.25 },
  ];
  const glow: Part[] = night
    ? [{ p: [0.01, 1.57, -0.07], s: [0.07, 0.07, 0.07], c: 0xffe296, sphere: true, detail: 0, noAO: true }]
    : [];
  return [stat, glow];
}

/** 1989 Beijing State-Owned Machine Tool Factory No.2 (國營北京第二機床廠): night or dawn. */
export function buildFactory(mode: 'night' | 'dawn' = 'night'): World {
  const dawn = mode === 'dawn';
  const s = new THREE.Scene();
  s.background = skyDomeTex(dawn ? 'dawn' : 'night');
  s.fog = new THREE.Fog(dawn ? 0xd2c4b0 : 0x0e1320, dawn ? 16 : 18, dawn ? 64 : 74);

  if (dawn) {
    s.add(new THREE.HemisphereLight(0xdce6f0, 0x5c5346, 1.3));
    const sun = new THREE.DirectionalLight(0xffd7a3, 1.45);
    sun.position.set(28, 22, -16);
    s.add(sun);
  } else {
    s.add(new THREE.HemisphereLight(0x55647c, 0x1d1a14, 0.92));
    const moon = new THREE.DirectionalLight(0x889ac0, 0.36);
    moon.position.set(-14, 22, 10);
    s.add(moon);
  }

  const stat: Part[] = [];
  const glow: Part[] = [];
  const r = rng(198902);

  // Textured grounds: outer factory street, paved courtyard, & oil-stained concrete workshop floor
  const outerRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(66, 8),
    new THREE.MeshLambertMaterial({ map: asphaltRoadTex(14, 2) }),
  );
  outerRoad.rotation.x = -Math.PI / 2;
  outerRoad.position.set(0, 0.01, -21);
  s.add(outerRoad);

  const frontYard = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 8.2),
    new THREE.MeshLambertMaterial({ map: campusPathTex(16, 3) }),
  );
  frontYard.rotation.x = -Math.PI / 2;
  frontYard.position.set(0, 0.025, -14.0);
  s.add(frontYard);

  const shopFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(45, 26),
    new THREE.MeshLambertMaterial({ map: workshopFloorTex(9, 5) }),
  );
  shopFloor.rotation.x = -Math.PI / 2;
  shopFloor.position.set(0, 0.032, 2.5);
  s.add(shopFloor);

  // Sub-base & yellow safety aisle stripes (clear of spawn [0, 12] & bench [0, 6])
  stat.push({ p: [0, -0.06, -3], s: [68, 0.10, 48], c: 0x28292b });
  for (const ax of [-3.2, 3.2]) {
    stat.push({ p: [ax, 0.04, 2.5], s: [0.16, 0.01, 24], c: 0xc99c2c, noAO: true });
  }

  // ── 1. MAIN WORKSHOP HALL (一車間, x = -21..21, z = -10..14) ──
  const wallBrick = 0x7c4539;
  const pilasterCol = 0x7e7a72;
  const roofDark = 0x3b3f44;
  const trussSteel = 0x45505a;
  const winGlowCol = dawn ? 0xd9c8a6 : 0xffcf78;

  // West & East heavy red-brick side walls + concrete pilasters + green oil-paint dado wainscot + industrial steel-sash windows
  for (const sx of [-1, 1]) {
    const wx = sx * 21.4;
    stat.push(
      { p: [wx, 0.35, 2.0], s: [0.76, 0.70, 24.4], c: 0x5c5952, tex: 'ashlarStone' },
      { p: [wx, 3.65, 2.0], s: [0.56, 6.20, 24.2], c: wallBrick, tex: 'redBrick' },
      // 1950s–80s Soviet-style factory green oil-painted dado wainscot (1.5m) + cream stripe on interior side wall
      { p: [wx - sx * 0.29, 0.78, 2.0], s: [0.05, 1.48, 24.0], c: 0x2a4a38, tex: 'plaster' },
      { p: [wx - sx * 0.30, 1.54, 2.0], s: [0.06, 0.08, 24.0], c: 0xd0c9b6 },
    );
    for (const pz of [-10, -4, 2, 8, 14]) {
      stat.push(
        { p: [wx, 3.4, pz], s: [0.84, 6.8, 0.56], c: pilasterCol, tex: 'plaster' },
        { p: [wx - sx * 0.55, 5.1, pz], s: [0.46, 0.42, 0.48], c: 0x8d897f }, // crane corbel
      );
    }
    // Wall-mounted industrial breaker box & vertical steel conduit on workshop pilasters
    for (const bz of [-4, 8]) {
      stat.push(
        { p: [wx - sx * 0.46, 1.65, bz], s: [0.16, 0.54, 0.40], c: 0x454d54 },
        { p: [wx - sx * 0.44, 3.3, bz], s: [0.04, 3.0, 0.04], c: 0x2f3439, cyl: true, seg: 6 },
      );
    }
    for (const wz of [-7, -1, 5, 11]) {
      stat.push(
        { p: [wx - sx * 0.31, 5.22, wz], s: [0.14, 0.16, 3.65], c: 0x726e65 }, // concrete lintel
        { p: [wx - sx * 0.31, 2.18, wz], s: [0.16, 0.14, 3.65], c: 0x726e65 }, // concrete sill
        { p: [wx - sx * 0.30, 3.7, wz], s: [0.06, 2.9, 3.4], c: 0x262a2e },
        { p: [wx - sx * 0.32, 3.7, wz], s: [0.08, 2.9, 0.08], c: 0x3b4046 },
        { p: [wx - sx * 0.32, 3.7, wz - 0.85], s: [0.07, 2.9, 0.05], c: 0x3b4046 },
        { p: [wx - sx * 0.32, 3.7, wz + 0.85], s: [0.07, 2.9, 0.05], c: 0x3b4046 },
        { p: [wx - sx * 0.32, 3.7, wz], s: [0.08, 0.08, 3.4], c: 0x3b4046 },
      );
      glow.push({ p: [wx - sx * 0.27, 3.7, wz], s: [0.04, 2.7, 3.2], c: winGlowCol, noAO: true });
    }
  }

  // North workshop facade (z = -10.2) with wide open sliding iron doors in the center aisle
  for (const sx of [-1, 1]) {
    stat.push(
      { p: [sx * 12.4, 0.35, -10.2], s: [17.4, 0.70, 0.68], c: 0x5c5952, tex: 'ashlarStone' },
      { p: [sx * 12.4, 3.60, -10.2], s: [17.2, 6.10, 0.52], c: wallBrick, tex: 'redBrick' },
      { p: [sx * 12.4, 0.78, -9.93], s: [17.0, 1.48, 0.05], c: 0x2a4a38, tex: 'plaster' },
      { p: [sx * 12.4, 1.54, -9.92], s: [17.0, 0.08, 0.06], c: 0xd0c9b6 },
    );
    for (const px of [3.8, 9.6, 15.4, 21.2]) {
      stat.push({ p: [sx * px, 3.4, -10.2], s: [0.56, 6.8, 0.76], c: pilasterCol, tex: 'plaster' });
    }
    for (const wx of [6.7, 12.5, 18.3]) {
      stat.push(
        { p: [sx * wx, 5.06, -10.2], s: [3.45, 0.16, 0.60], c: 0x726e65 },
        { p: [sx * wx, 2.14, -10.2], s: [3.45, 0.14, 0.62], c: 0x726e65 },
        { p: [sx * wx, 3.6, -10.2], s: [3.2, 2.8, 0.14], c: 0x262a2e },
        { p: [sx * wx, 3.6, -10.2], s: [0.08, 2.8, 0.22], c: 0x3b4046 },
        { p: [sx * wx, 3.6, -10.2], s: [3.2, 0.08, 0.22], c: 0x3b4046 },
      );
      glow.push({ p: [sx * wx, 3.6, -10.2], s: [3.0, 2.6, 0.08], c: winGlowCol, noAO: true });
    }
    // Open double sliding workshop doors rolled back beside x = ±3.8 (with riveted steel frame bars)
    stat.push(
      { p: [sx * 4.8, 2.25, -10.58], s: [2.8, 4.4, 0.14], c: 0x32403a },
      { p: [sx * 4.8, 2.25, -10.66], s: [2.5, 4.1, 0.04], c: 0x26322d },
      { p: [sx * 4.8, 3.15, -10.69], s: [2.6, 0.10, 0.05], c: 0x45534c },
      { p: [sx * 4.8, 1.35, -10.69], s: [2.6, 0.10, 0.05], c: 0x45534c },
    );
  }
  // Lintel girder above central workshop door
  stat.push({ p: [0, 5.55, -10.2], s: [8.0, 2.2, 0.58], c: wallBrick, tex: 'redBrick' });
  stat.push({ p: [0, 4.48, -10.24], s: [8.2, 0.24, 0.66], c: 0x625f58, tex: 'ashlarStone' });

  // Low south brick wainscot (z = 14.4, h = 1.45m) so camera at yaw = Math.PI never clips behind a tall wall
  stat.push({ p: [0, 0.72, 14.4], s: [43.2, 1.44, 0.48], c: wallBrick, tex: 'redBrick' });
  stat.push({ p: [0, 0.72, 14.14], s: [42.6, 1.38, 0.04], c: 0x2a4a38, tex: 'plaster' });
  stat.push({ p: [0, 1.48, 14.4], s: [43.4, 0.14, 0.56], c: pilasterCol, tex: 'plaster' });
  for (const px of [-15.4, -9.6, -3.8, 3.8, 9.6, 15.4]) {
    stat.push({ p: [px, 3.4, 14.2], s: [0.52, 6.8, 0.56], c: pilasterCol, tex: 'plaster' });
  }

  // ── 2. ICONIC 3-BAY SAWTOOTH WORKSHOP ROOFS (鋸齒形廠房與北向透光玻璃天窗) ──
  const bayStarts = [-10, -2, 6];
  const slopeAngle = Math.atan2(2.4, 8.0); // steep north clerestory (2.4m), sloped south roof over 8m
  const slopeLen = Math.hypot(8.0, 2.4);
  for (const bz of bayStarts) {
    // Keep the foreground entrance bay (bz = 6) open in the center (x = -12.8..12.8) so the south-to-north oblique camera sees cleanly down onto the lathes.
    const cutawayCenter = bz >= 6;
    if (!cutawayCenter) {
      stat.push(
        { p: [0, 6.68, bz], s: [43.2, 0.22, 0.24], c: trussSteel },
        { p: [0, 9.02, bz], s: [43.2, 0.22, 0.24], c: trussSteel },
      );
      glow.push({
        p: [0, 7.85, bz - 0.04],
        s: [41.8, 2.15, 0.06],
        c: dawn ? 0xf5dfb4 : 0xffcf72,
        noAO: true,
      });
      for (let mx = -21; mx <= 21; mx += 3.0) {
        stat.push({ p: [mx, 7.85, bz], s: [0.10, 2.35, 0.16], c: 0x2b3036 });
      }
    }
    // Side wing solid corrugated sawtooth roof decks, side clerestory glazing & triangular gable infills
    for (const sx of [-1, 1]) {
      if (cutawayCenter) {
        stat.push(
          { p: [sx * 17.4, 6.68, bz], s: [8.8, 0.22, 0.24], c: trussSteel },
          { p: [sx * 17.4, 9.02, bz], s: [8.8, 0.22, 0.24], c: trussSteel },
        );
        glow.push({
          p: [sx * 17.4, 7.85, bz - 0.04],
          s: [8.2, 2.15, 0.06],
          c: dawn ? 0xf5dfb4 : 0xffcf72,
          noAO: true,
        });
        for (const mx of [13.2, 16.0, 18.8, 21.2]) {
          stat.push({ p: [sx * mx, 7.85, bz], s: [0.10, 2.35, 0.16], c: 0x2b3036 });
        }
      }
      stat.push(
        { p: [sx * 17.4, 7.85, bz + 4.0], s: [8.8, 0.22, slopeLen + 0.2], c: roofDark, rx: slopeAngle },
        { p: [sx * 21.4, 7.80, bz + 4.0], s: [8.0, 2.40, 0.54], c: wallBrick, wedge: true, ry: -H },
        { p: [sx * 13.1, 7.80, bz + 4.0], s: [8.0, 2.40, 0.16], c: trussSteel, wedge: true, ry: -H },
      );
    }
    // Open steel sawtooth truss chords across the north/mid central span (x = -13..13)
    if (!cutawayCenter) {
      for (const tx of [-9.6, -3.8, 3.8, 9.6]) {
        stat.push(
          strut([tx, 9.0, bz], [tx, 6.7, bz + 8.0], 0.12, trussSteel, 4),
          strut([tx, 6.7, bz], [tx, 6.7, bz + 8.0], 0.10, trussSteel, 4),
          strut([tx, 6.7, bz + 4.0], [tx, 7.85, bz + 4.0], 0.08, trussSteel, 4),
        );
      }
    }
  }

  // ── 3. OVERHEAD YELLOW GANTRY CRANE (車間天車行車) ──
  for (const cx of [-12.6, 12.6]) {
    stat.push({ p: [cx, 5.42, 2.0], s: [0.28, 0.42, 24.4], c: 0xc89222 });
  }
  const craneZ = -1.6;
  stat.push(
    { p: [0, 5.88, craneZ - 0.34], s: [25.8, 0.48, 0.26], c: 0xd9a128 },
    { p: [0, 5.88, craneZ + 0.34], s: [25.8, 0.48, 0.26], c: 0xd9a128 },
    { p: [-12.5, 5.88, craneZ], s: [0.55, 0.46, 1.3], c: 0xa6781a },
    { p: [12.5, 5.88, craneZ], s: [0.55, 0.46, 1.3], c: 0xa6781a },
    // Suspended operator cab + trolley + hoist cables + pulley & hook
    { p: [-10.2, 4.95, craneZ + 0.55], s: [1.1, 1.25, 1.0], c: 0x3f4e5c },
    { p: [-3.4, 6.24, craneZ], s: [1.3, 0.36, 0.96], c: 0x2f353b },
    { p: [-3.48, 4.95, craneZ], s: [0.035, 2.3, 0.035], c: 0x8e9296, cyl: true, seg: 5 },
    { p: [-3.32, 4.95, craneZ], s: [0.035, 2.3, 0.035], c: 0x8e9296, cyl: true, seg: 5 },
    { p: [-3.4, 3.72, craneZ], s: [0.34, 0.34, 0.22], c: 0xc99220, bevel: true },
    { p: [-3.4, 3.42, craneZ], s: [0.20, 0.24, 0.14], c: 0x25282c, torus: true, tube: 0.16, seg: 10, detail: 4, arc: Math.PI * 1.4, rz: Math.PI * 0.7 },
  );

  // ── 4. FOUR C6140 LATHES + TOOL CABINETS + CRATES + BENCH + BOILER STATION ──
  for (const [lx, lz, lry] of [
    [-14.2, -4.0, 0],
    [-14.2, 2.6, 0],
    [14.2, -4.0, Math.PI],
    [14.2, 2.6, Math.PI],
  ] as [number, number, number][]) {
    const [lStat, lGlow] = c6140Lathe(!dawn);
    stat.push(...place(lStat, lx, lz, lry));
    if (lGlow.length) glow.push(...place(lGlow, lx, lz, lry));
  }

  // Steel tool cabinets & workbenches along east & west walls
  for (const [tx, tz] of [[-19.2, -5.0], [-19.2, 1.0], [-19.2, 7.0], [19.2, -5.0], [19.2, 1.0], [19.2, 7.0]] as [number, number][]) {
    stat.push(
      { p: [tx, 0.56, tz], s: [0.85, 1.12, 1.65], c: 0x3b5248, bevel: true },
      { p: [tx + (tx < 0 ? 0.44 : -0.44), 0.74, tz], s: [0.03, 0.04, 0.42], c: C.chrome },
      { p: [tx + (tx < 0 ? 0.44 : -0.44), 0.42, tz], s: [0.03, 0.04, 0.42], c: C.chrome },
    );
  }

  // Stacked timber crates & steel bar stock racks (away from spawn [0, 12] & bench [0, 6])
  for (const [cx, cz] of [[-8.6, 8.8], [-6.8, 9.2], [8.8, 8.8], [7.0, 9.4]] as [number, number][]) {
    stat.push(
      { p: [cx, 0.44, cz], s: [1.35, 0.88, 1.10], c: 0x7b5c38 },
      { p: [cx, 0.44, cz], s: [1.39, 0.10, 1.14], c: 0x5c4224 },
      { p: [cx + 0.1, 1.18, cz - 0.05], s: [0.92, 0.60, 0.84], c: 0x876740 },
    );
  }
  // Steel bar stock rack at x = -8.5, z = 4.6
  stat.push(
    { p: [-8.5, 0.55, 4.2], s: [0.12, 1.1, 0.12], c: 0x363b40 },
    { p: [-8.5, 0.55, 5.8], s: [0.12, 1.1, 0.12], c: 0x363b40 },
    { p: [-8.5, 0.48, 5.0], s: [0.36, 0.16, 2.8], c: 0x7a8086 },
  );

  // Worker rest bench & steel locker slightly beside hotspot [0, 6]
  stat.push(
    { p: [-2.4, 0.44, 6.2], s: [1.85, 0.08, 0.52], c: C.wood },
    { p: [-3.15, 0.22, 6.2], s: [0.10, 0.44, 0.46], c: 0x2f3338 },
    { p: [-1.65, 0.22, 6.2], s: [0.10, 0.44, 0.46], c: 0x2f3338 },
    { p: [2.4, 0.92, 6.2], s: [1.10, 1.84, 0.56], c: 0x42564a, bevel: true },
    { p: [2.4, 1.05, 5.91], s: [0.04, 1.50, 0.03], c: 0x25322a },
  );

  // Water Boiler Station (開水房) near [-12.8, -8.8] (clear of hotspot [-11, -9])
  stat.push(
    { p: [-13.4, 0.46, -8.8], s: [1.6, 0.92, 1.1], c: 0x6c6860 },
    { p: [-13.4, 1.38, -8.8], s: [0.78, 1.15, 0.78], c: 0x9aa0a6, cyl: true, seg: 12 },
    { p: [-13.4, 1.98, -8.8], s: [0.80, 0.12, 0.80], c: 0x62686d, cyl: true, seg: 12, top: 0.4 },
    { p: [-12.92, 1.18, -8.8], s: [0.16, 0.06, 0.06], c: C.brass },
    { p: [-13.9, 1.10, -8.6], s: [0.15, 0.34, 0.15], c: 0xa62e24, cyl: true, seg: 8 }, // red thermos
  );

  // Workshop Blackboard (黑板報) near [10.0, -11.2] facing -z (clear of hotspot [10, -12])
  stat.push(
    { p: [10.0, 1.35, -11.15], s: [3.2, 1.55, 0.14], c: 0x3b281a },
    { p: [8.65, 0.78, -11.15], s: [0.10, 1.56, 0.14], c: 0x4d3422 },
    { p: [11.35, 0.78, -11.15], s: [0.10, 1.56, 0.14], c: 0x4d3422 },
    { p: [10.0, 2.20, -11.15], s: [3.45, 0.14, 0.42], c: 0x3e4246 },
  );
  signPlane(
    s,
    dawn ? '一車間：設備保養・互報平安' : '出勤・安全：團結生產 保質保量',
    10.0,
    1.35,
    -11.24,
    2.96,
    1.32,
    '#1b2a22',
    '#e9e6d8',
    Math.PI,
    false,
    '#8b6d46',
  );

  // ── 5. BOILER HOUSE, TOWERING SMOKESTACK & OVERHEAD STEAM PIPES ──
  const bx = -17.6, bz = -14.8;
  stat.push(
    { p: [bx, 0.22, bz], s: [6.6, 0.44, 4.6], c: 0x5c5952, tex: 'ashlarStone' },
    { p: [bx, 1.9, bz], s: [6.4, 3.8, 4.4], c: wallBrick, tex: 'redBrick' },
    { p: [bx, 3.9, bz], s: [6.8, 0.24, 4.8], c: 0x4b4e52, tex: 'ashlarStone' },
    { p: [bx + 2.0, 1.3, bz - 2.22], s: [1.3, 2.4, 0.08], c: 0x2e353b }, // steel door
    // Coal bunker pile beside boiler house
    { p: [bx - 2.2, 0.45, bz - 2.5], s: [2.2, 0.90, 1.6], c: 0x1e2022, roof: true },
    // Towering tapered red-brick smokestack (h = 16m) with iron bands
    { p: [bx - 1.5, 0.65, bz + 0.6], s: [2.35, 1.3, 2.35], c: 0x5c5952, tex: 'ashlarStone' },
    { p: [bx - 1.5, 8.2, bz + 0.6], s: [2.1, 16.4, 2.1], c: 0x743e33, cyl: true, seg: 12, top: 0.48, tex: 'redBrick' },
    { p: [bx - 1.5, 16.5, bz + 0.6], s: [1.18, 0.42, 1.18], c: 0x262424, cyl: true, seg: 12 },
  );
  for (const hy of [5.5, 9.2, 12.8, 15.6]) {
    const rBand = 2.05 - (hy / 16.4) * 1.05;
    stat.push({ p: [bx - 1.5, hy, bz + 0.6], s: [rBand, 0.14, rBand], c: 0x282b2e, cyl: true, seg: 12 });
  }
  // Overhead insulated steam pipes on steel trestles from boiler house to workshop
  stat.push(
    { p: [-15.8, 4.5, -11.9], s: [0.34, 4.2, 0.34], c: 0x9aa0a4, cyl: true, rx: H, seg: 8 },
    { p: [-15.2, 4.1, -11.9], s: [0.26, 4.2, 0.26], c: 0x868c90, cyl: true, rx: H, seg: 8 },
    { p: [-15.5, 2.15, -12.6], s: [0.14, 4.3, 0.14], c: 0x3b4046 },
    { p: [-16.2, 2.15, -12.6], s: [0.14, 4.3, 0.14], c: 0x3b4046 },
    { p: [-15.8, 4.2, -12.6], s: [1.3, 0.14, 0.14], c: 0x3b4046 },
  );

  // ── 6. BICYCLE SHED (x = 15.8, z = -14.8) + TRICYCLE + BICYCLES ──
  stat.push(
    { p: [16.0, 2.48, -14.6], s: [6.8, 0.12, 3.6], c: 0x4b555c, rx: 0.16 }, // corrugated iron roof
    { p: [12.8, 1.15, -16.1], s: [0.12, 2.30, 0.12], c: 0x3a3f44 },
    { p: [16.0, 1.15, -16.1], s: [0.12, 2.30, 0.12], c: 0x3a3f44 },
    { p: [19.2, 1.15, -16.1], s: [0.12, 2.30, 0.12], c: 0x3a3f44 },
    { p: [12.8, 1.35, -13.1], s: [0.12, 2.70, 0.12], c: 0x3a3f44 },
    { p: [19.2, 1.35, -13.1], s: [0.12, 2.70, 0.12], c: 0x3a3f44 },
  );
  // Parked flatbed tricycle beside bike shed (clear of hotspot [13, -15])
  stat.push(...place(tricycle(), 10.6, -15.0, -2.6));

  // ── 7. FACTORY FRONT GATE (x = 0, z = -17.6) + GATEHOUSE + PLAQUE + BANNERS ──
  for (const sx of [-1, 1]) {
    stat.push(
      { p: [sx * 13.6, 0.22, -17.6], s: [21.0, 0.44, 0.58], c: 0x5c5952, tex: 'ashlarStone' },
      { p: [sx * 13.6, 1.35, -17.6], s: [20.8, 2.7, 0.44], c: wallBrick, tex: 'redBrick' },
      { p: [sx * 13.6, 2.82, -17.6], s: [21.0, 0.24, 0.56], c: 0x3d4044, prism: true, ry: H, tex: 'roofTile' },
      // Brick gate pillars
      { p: [sx * 3.1, 0.25, -17.6], s: [1.06, 0.50, 1.06], c: 0x5c5952, tex: 'ashlarStone' },
      { p: [sx * 3.1, 2.0, -17.6], s: [0.92, 4.0, 0.92], c: wallBrick, tex: 'redBrick' },
      { p: [sx * 3.1, 4.12, -17.6], s: [1.08, 0.24, 1.08], c: 0x7c7870, tex: 'ashlarStone' },
    );
    for (const px of [7.2, 12.2, 17.2, 22.2]) {
      stat.push(
        { p: [sx * px, 1.38, -17.6], s: [0.52, 2.76, 0.58], c: 0x6f392e, tex: 'redBrick' },
        { p: [sx * px, 2.80, -17.6], s: [0.64, 0.16, 0.68], c: 0x7a756c },
      );
    }
    glow.push({ p: [sx * 3.1, 4.44, -17.6], s: [0.34, 0.36, 0.34], c: 0xffd27a, sphere: true, detail: 1, noAO: true });
    // Iron accordion gate wings left ajar
    const gx = sx * 2.15;
    stat.push(
      { p: [gx, 1.12, -17.6 + sx * 0.22], s: [1.5, 2.1, 0.08], c: 0x24282c, ry: sx * 0.42 },
      { p: [gx, 2.15, -17.6 + sx * 0.22], s: [1.5, 0.10, 0.12], c: 0x24282c, ry: sx * 0.42 },
    );
  }
  // Brick gatehouse (門衛室) at x = -5.4, z = -17.3
  stat.push(
    { p: [-5.4, 0.20, -17.2], s: [3.8, 0.40, 3.2], c: 0x5c5952, tex: 'ashlarStone' },
    { p: [-5.4, 1.45, -17.2], s: [3.6, 2.9, 3.0], c: wallBrick, tex: 'redBrick' },
    { p: [-5.4, 3.02, -17.2], s: [4.0, 0.22, 3.4], c: 0x45484c, tex: 'ashlarStone' },
    { p: [-5.4, 3.42, -17.2], s: [3.5, 0.68, 4.1], c: roofDark, prism: true, ry: H, tex: 'roofTile' },
    { p: [-4.4, 1.16, -18.74], s: [1.26, 0.10, 0.16], c: 0x7c7870 }, // window sill
    { p: [-4.4, 2.14, -18.74], s: [1.26, 0.12, 0.14], c: 0x7c7870 }, // window lintel
  );
  glow.push({ p: [-4.4, 1.65, -18.72], s: [1.1, 0.9, 0.06], c: winGlowCol, noAO: true });

  // Overhead factory lintel beam + vertical crimson plaque 北京第二機床廠 + slogan banners
  stat.push({ p: [0, 4.45, -17.6], s: [7.4, 0.92, 0.38], c: 0x8d2920 });
  signPlane(s, '國營北京第二機床廠', 0, 4.46, -17.81, 6.8, 0.78, '#92261e', '#f6e7bd', Math.PI);
  signPlane(s, '北京第二機床廠', 3.1, 2.25, -18.08, 0.44, 1.95, '#9b241b', '#f8f0d8', Math.PI, true, '#e6c57a');
  signPlane(s, '安全生產・抓品質', -11.5, 4.65, -10.50, 7.2, 0.95, '#a8261e', '#f5efe0', Math.PI);
  signPlane(s, '團結互助・穩定生產', 11.5, 4.65, -10.50, 7.2, 0.95, '#a8261e', '#f5efe0', Math.PI);

  addLayeredParts(s, stat);
  if (glow.length) s.add(new THREE.Mesh(mergeParts(glow), glowMat()));

  // Instanced parked Flying Pigeon bicycles inside bicycle shed (clear of hotspot [13, -15])
  const shedBikes: { x: number; z: number; ry: number }[] = [];
  for (let i = 0; i < 10; i++) {
    shedBikes.push({
      x: 14.2 + (i % 5) * 1.10,
      z: i < 5 ? -15.4 : -13.9,
      ry: H + (r() - 0.5) * 0.2,
    });
  }
  s.add(instanced(mergeParts(bike()), litMat(), shedBikes));

  // Avenue poplars outside factory gate road
  const roadTrees = [-18, -10, 10, 18].map(x => ({ x, z: -19.2, ry: r() * 6, s: 1.0 }));
  addRealisticTrees(s, roadTrees, true, false);

  // Warm industrial lighting
  if (!dawn) {
    for (const [lx, ly, lz, inten] of [
      [0, 5.2, 4, 24],
      [-12, 4.8, -1, 22],
      [12, 4.8, -1, 22],
      [0, 4.6, -15, 20],
      [-11, 4.2, -9, 14],
    ] as [number, number, number, number][]) {
      const pt = new THREE.PointLight(C.sodium, inten, 22, 1.5);
      pt.position.set(lx, ly, lz);
      s.add(pt);
    }
  } else {
    const yardSun = new THREE.PointLight(0xffe4b8, 12, 26, 1.4);
    yardSun.position.set(0, 6.0, -4);
    s.add(yardSun);
  }

  return {
    id: (dawn ? 'factory_dawn' : 'factory') as SceneId,
    scene: s,
    spawn: [0, 12],
    bounds: [-24, 24, -22, 16],
    camDist: 12,
    update() { /* static industrial scene */ },
  };
}

/** Add a traditional Beijing Siheyuan grey-brick wing/hall with pitched grey tile roof, rafters & lattice windows. */
function addCourtyardHouse(
  stat: Part[],
  glow: Part[],
  cx: number,
  cz: number,
  w: number,
  d: number,
  ry: number,
  windows: number,
  litMask: boolean[],
  stovepipeIdx = -1,
) {
  const localStat: Part[] = [];
  const localGlow: Part[] = [];
  const wallH = 3.05;
  const frontZ = -d / 2;

  // Granite plinth (台明) + aged Qingzhuan grey brick body + red-lacquered eaves beam + Chitouw brick gable piers (墀頭)
  localStat.push(
    { p: [0, 0.22, 0], s: [w + 0.24, 0.44, d + 0.24], c: 0x626059, tex: 'ashlarStone' },
    { p: [0, 0.44 + wallH / 2, 0], s: [w, wallH, d], c: C.greyBrick, tex: 'qingBrick' },
    { p: [0, 0.44 + wallH - 0.14, frontZ - 0.04], s: [w + 0.16, 0.20, 0.14], c: 0x76241b },
  );
  for (const gx of [-w / 2 + 0.14, w / 2 - 0.14]) {
    localStat.push(
      { p: [gx, 0.46, frontZ - 0.08], s: [0.46, 0.44, 0.28], c: 0x6f6c64, tex: 'ashlarStone' },
      { p: [gx, 0.44 + wallH * 0.5, frontZ - 0.07], s: [0.38, wallH, 0.20], c: 0x54575c, tex: 'qingBrick' },
      { p: [gx, 0.44 + wallH - 0.12, frontZ - 0.12], s: [0.48, 0.22, 0.30], c: 0x64676c, tex: 'qingBrick' },
    );
  }

  // Exposed wooden eaves rafters (椽子) along front face
  for (let rx = -w / 2 + 0.25; rx <= w / 2 - 0.25; rx += 0.52) {
    localStat.push({ p: [rx, 0.44 + wallH + 0.06, frontZ - 0.22], s: [0.08, 0.08, 0.54], c: 0x4d2a1b, rx: 0.24 });
  }

  // Pitched grey-tile roof (合瓦) with ridge beam & upturned finials
  const roofH = 1.45;
  localStat.push(
    { p: [0, 0.44 + wallH + roofH / 2, 0], s: [d + 0.78, roofH, w + 0.56], c: 0x45484d, prism: true, ry: H, tex: 'roofTile' },
    { p: [0, 0.44 + wallH + roofH + 0.06, 0], s: [w + 0.56, 0.16, 0.20], c: 0x2f3236 },
    { p: [-w / 2 - 0.18, 0.44 + wallH + roofH + 0.18, 0], s: [0.18, 0.26, 0.22], c: 0x2f3236 },
    { p: [w / 2 + 0.18, 0.44 + wallH + roofH + 0.18, 0], s: [0.18, 0.26, 0.22], c: 0x2f3236 },
  );
  // Corrugated tile ribs along front & back slopes
  for (let tx = -w / 2 + 0.2; tx <= w / 2 - 0.2; tx += 0.56) {
    localStat.push(
      { p: [tx, 0.44 + wallH + roofH * 0.52, frontZ * 0.56], s: [0.06, 0.06, d * 0.62], c: 0x35383c, rx: 0.52 },
      { p: [tx, 0.44 + wallH + roofH * 0.52, -frontZ * 0.56], s: [0.06, 0.06, d * 0.62], c: 0x35383c, rx: -0.52 },
    );
  }

  // Center wooden door + carved transom grill (亮子) + couplets
  localStat.push(
    { p: [0, 1.56, frontZ - 0.04], s: [1.32, 2.24, 0.10], c: 0x5c2218 },
    { p: [0, 2.84, frontZ - 0.05], s: [1.36, 0.36, 0.08], c: 0x421a12 },
    { p: [0, 2.84, frontZ - 0.08], s: [1.24, 0.04, 0.04], c: 0x623422 },
    { p: [0, 1.56, frontZ - 0.09], s: [0.05, 2.16, 0.04], c: 0x38150f },
    { p: [-0.76, 1.62, frontZ - 0.04], s: [0.13, 1.38, 0.02], c: 0xa62a20 },
    { p: [0.76, 1.62, frontZ - 0.04], s: [0.13, 1.38, 0.02], c: 0xa62a20 },
  );

  // Lattice timber windows with stone sill, timber lintel, warm paper/glass panes & red paper-cuts
  const span = w - 2.6;
  for (let i = 0; i < windows; i++) {
    const side = i < windows / 2 ? -1 : 1;
    const offset = windows === 2 ? side * (w * 0.28) : (i - (windows - 1) / 2) * (span / Math.max(1, windows - 1));
    const wx = Math.abs(offset) < 1.1 ? (offset >= 0 ? 1.55 : -1.55) : offset;
    const wy = 1.92;
    const lit = litMask[i] ?? true;
    localStat.push(
      { p: [wx, wy - 0.72, frontZ - 0.06], s: [1.62, 0.10, 0.16], c: 0x6c685e, tex: 'ashlarStone' },
      { p: [wx, wy + 0.72, frontZ - 0.05], s: [1.58, 0.10, 0.14], c: 0x5c5850 },
      { p: [wx, wy, frontZ - 0.03], s: [1.46, 1.34, 0.08], c: 0x4b281a },
      { p: [wx, wy, frontZ - 0.07], s: [0.04, 1.24, 0.04], c: 0x623422 },
      { p: [wx, wy + 0.12, frontZ - 0.07], s: [1.34, 0.04, 0.04], c: 0x623422 },
      { p: [wx, wy - 0.18, frontZ - 0.07], s: [1.34, 0.04, 0.04], c: 0x623422 },
    );
    (lit ? localGlow : localStat).push({
      p: [wx, wy, frontZ - 0.045],
      s: [1.30, 1.18, 0.03],
      c: lit ? 0xffcf7e : 0x1b2128,
      noAO: lit,
    });
    if (lit) {
      // Red window paper-cut (窗花)
      localStat.push({ p: [wx - 0.28, wy + 0.26, frontZ - 0.068], s: [0.22, 0.22, 0.015], c: 0xb8241c, rz: 0.78 });
    }
    if (i === stovepipeIdx) {
      // Iconic 1980s galvanized stovepipe elbow (鐵皮煙囪彎管) protruding out & rising past eaves
      localStat.push(
        { p: [wx + 0.36, wy + 0.34, frontZ - 0.38], s: [0.14, 0.76, 0.14], c: 0x8f969c, cyl: true, rx: H, seg: 8 },
        { p: [wx + 0.36, wy + 1.24, frontZ - 0.70], s: [0.14, 1.85, 0.14], c: 0x8f969c, cyl: true, seg: 8 },
        { p: [wx + 0.36, wy + 2.22, frontZ - 0.70], s: [0.28, 0.12, 0.28], c: 0x6b7075, cyl: true, seg: 8, top: 0.2 },
      );
    }
  }

  stat.push(...place(localStat, cx, cz, ry));
  if (localGlow.length) glow.push(...place(localGlow, cx, cz, ry));
}

/** 1989 Beijing Workers' Siheyuan-turned-Dazayuan (工人民宅大雜院). */
export function buildCourtyard(): World {
  const s = new THREE.Scene();
  s.background = skyDomeTex('hutong');
  s.fog = new THREE.Fog(0x0d1018, 12, 54);
  s.add(new THREE.HemisphereLight(0x525d78, 0x1e1912, 0.92));
  const moon = new THREE.DirectionalLight(0x8899bc, 0.34);
  moon.position.set(-10, 20, 8);
  s.add(moon);

  const stat: Part[] = [];
  const glow: Part[] = [];

  // Courtyard brick floor + outer hutong lane outside the red gate
  const courtFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 25),
    new THREE.MeshLambertMaterial({ map: campusPathTex(10, 9) }),
  );
  courtFloor.rotation.x = -Math.PI / 2;
  courtFloor.position.set(0, 0.025, -1.5);
  s.add(courtFloor);

  const laneRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 6),
    new THREE.MeshLambertMaterial({ map: asphaltRoadTex(10, 2) }),
  );
  laneRoad.rotation.x = -Math.PI / 2;
  laneRoad.position.set(0, 0.01, -15.5);
  s.add(laneRoad);

  stat.push({ p: [0, -0.06, -2], s: [36, 0.10, 32], c: 0x252422 });

  // ── 1. NORTH MAIN HALL (正房, z = 9.0, facing -z into the yard) & Dazayuan kitchen lean-to ──
  addCourtyardHouse(stat, glow, 0, 9.0, 14.6, 4.2, 0, 4, [true, true, false, true], 0);
  stat.push(
    { p: [0, 0.22, 6.45], s: [2.4, 0.22, 0.65], c: 0x7b776e, tex: 'ashlarStone' },
    // Self-built Dazayuan red-brick lean-to kitchen shed against west bay (with concrete plinth, kitchen window & flue)
    { p: [-5.8, 0.14, 5.75], s: [3.35, 0.28, 2.45], c: 0x5c5952, tex: 'ashlarStone' },
    { p: [-5.8, 1.05, 5.75], s: [3.2, 2.1, 2.3], c: C.brick, tex: 'redBrick' },
    { p: [-5.8, 1.32, 4.58], s: [0.92, 0.72, 0.08], c: 0x3b2618 },
    { p: [-5.8, 1.32, 4.55], s: [0.76, 0.56, 0.04], c: 0x222930 },
    { p: [-5.8, 2.25, 5.75], s: [3.5, 0.28, 2.7], c: 0x41454a, rx: -0.14, tex: 'roofTile' },
    { p: [-4.6, 2.55, 5.05], s: [0.16, 1.35, 0.16], c: 0x6b7075, cyl: true, seg: 8 },
  );

  // ── 2. WEST & EAST SIDE WING HOUSES (廂房) ──
  // West Wing facing +x (ry = -H rotates local -z to +x)
  addCourtyardHouse(stat, glow, -10.2, -1.2, 11.4, 3.6, -H, 2, [true, false], 0);
  // East Wing facing -x (ry = H rotates local -z to -x)
  addCourtyardHouse(stat, glow, 10.2, -1.2, 11.4, 3.6, H, 2, [false, true], 1);

  // Outer perimeter grey-brick courtyard walls + stone base plinth + brick pilasters + tile coping
  for (const sx of [-1, 1]) {
    stat.push(
      { p: [sx * 13.6, 0.24, -1.5], s: [0.62, 0.48, 24.6], c: 0x525558, tex: 'ashlarStone' },
      { p: [sx * 13.6, 1.45, -1.5], s: [0.5, 2.9, 24.5], c: C.greyBrick, tex: 'qingBrick' },
      { p: [sx * 13.6, 3.05, -1.5], s: [0.76, 0.32, 24.6], c: 0x3b3e42, prism: true, tex: 'roofTile' },
    );
    for (const pz of [-9, -3, 3, 9]) {
      stat.push({ p: [sx * 13.6, 1.45, pz], s: [0.64, 2.86, 0.38], c: 0x4b4e52, tex: 'qingBrick' });
    }
  }
  // South courtyard wall (z = -12.6) split by the red gatehouse
  for (const sx of [-1, 1]) {
    stat.push(
      { p: [sx * 7.6, 0.24, -12.6], s: [12.5, 0.48, 0.62], c: 0x525558, tex: 'ashlarStone' },
      { p: [sx * 7.6, 1.45, -12.6], s: [12.4, 2.9, 0.52], c: C.greyBrick, tex: 'qingBrick' },
      { p: [sx * 7.6, 3.05, -12.6], s: [12.5, 0.32, 0.78], c: 0x3b3e42, prism: true, ry: H, tex: 'roofTile' },
    );
    for (const px of [3.8, 8.6]) {
      stat.push({ p: [sx * px, 1.45, -12.6], s: [0.40, 2.86, 0.66], c: 0x4b4e52, tex: 'qingBrick' });
    }
  }

  // ── 3. RED-LACQUERED STREET GATE (紅漆街門與石門墩) AT z = -12.6 (near exit [0, -14]) ──
  stat.push(
    { p: [0, 0.12, -13.15], s: [3.2, 0.24, 0.85], c: 0x7b776e, tex: 'ashlarStone' }, // threshold steps
    { p: [-1.25, 1.55, -12.6], s: [0.24, 2.8, 0.32], c: 0x3b2016 },
    { p: [1.25, 1.55, -12.6], s: [0.24, 2.8, 0.32], c: 0x3b2016 },
    { p: [0, 2.90, -12.6], s: [2.8, 0.26, 0.34], c: 0x3b2016 },
    // Open-ajar red-lacquered gate doors swung inward
    { p: [-0.95, 1.54, -12.05], s: [1.05, 2.38, 0.10], c: 0x8e241b, ry: 1.05 },
    { p: [0.95, 1.54, -12.05], s: [1.05, 2.38, 0.10], c: 0x8e241b, ry: -1.05 },
    // Brass knockers & 4 door bosses (門簪)
    { p: [-0.75, 1.42, -11.78], s: [0.14, 0.14, 0.14], c: C.brass, torus: true, tube: 0.12, seg: 10, detail: 4, ry: 1.05 },
    { p: [0.75, 1.42, -11.78], s: [0.14, 0.14, 0.14], c: C.brass, torus: true, tube: 0.12, seg: 10, detail: 4, ry: -1.05 },
    // Stone drum door-pillows (抱鼓石門墩)
    { p: [-1.32, 0.38, -12.96], s: [0.34, 0.44, 0.50], c: 0x848178, bevel: true, tex: 'ashlarStone' },
    { p: [1.32, 0.38, -12.96], s: [0.34, 0.44, 0.50], c: 0x848178, bevel: true, tex: 'ashlarStone' },
    // Faded red couplets + blue house number plaque
    { p: [-1.42, 1.58, -12.82], s: [0.14, 1.45, 0.02], c: 0xa62a20 },
    { p: [1.42, 1.58, -12.82], s: [0.14, 1.45, 0.02], c: 0xa62a20 },
    { p: [1.46, 2.42, -12.82], s: [0.24, 0.16, 0.02], c: 0x204a88 },
    // Curved grey-tile Siheyuan gatehouse roof (廣亮門樓)
    { p: [0, 3.22, -12.6], s: [3.8, 0.24, 1.4], c: 0x5c5e62, tex: 'qingBrick' },
    { p: [0, 3.92, -12.6], s: [4.6, 1.25, 2.4], c: C.slate, eave: true, curve: 0.18, tex: 'roofTile' },
    { p: [0, 4.58, -12.6], s: [2.2, 0.16, 0.20], c: 0x33363a },
    { p: [0, 2.70, -12.15], s: [0.28, 0.11, 0.28], c: 0x26382c, cyl: true, seg: 8, top: 0.25 },
  );
  for (const bx of [-0.78, -0.26, 0.26, 0.78]) {
    stat.push({ p: [bx, 2.82, -12.78], s: [0.11, 0.11, 0.12], c: 0x7e221a });
  }
  glow.push({ p: [0, 2.62, -12.15], s: [0.16, 0.18, 0.16], c: 0xffd27a, sphere: true, detail: 1, noAO: true });

  // ── 4. DAZAYUAN LIVING PROPS (STOVES, WASHBASIN TABLE, TAP, LAUNDRY, PIGEON COOP) ──
  // Center washbasin table + wooden stools beside hotspot [0, -2]
  stat.push(...place(tableBasin(), -1.4, -2.0, 0.2));
  stat.push(
    { p: [-1.4, 0.42, -1.1], s: [0.40, 0.05, 0.36], c: C.wood },
    { p: [-1.4, 0.21, -1.1], s: [0.30, 0.42, 0.26], c: C.darkWood },
  );

  // Honeycomb coal briquettes & steaming kettle beside hotspot [-5, -4] & near West Wing
  stat.push(...place(coalAndCabbage(), -6.4, -4.0, H));
  stat.push(...place(coalAndCabbage(), -7.4, 2.2, H));

  // Outdoor tap & concrete water sink (院裡自來水龍頭與水池) at [-7.4, -7.8]
  stat.push(
    { p: [-7.4, 0.36, -7.8], s: [1.15, 0.72, 0.78], c: 0x6b6a65 },
    { p: [-7.4, 0.74, -7.8], s: [0.95, 0.12, 0.60], c: 0x454a4d },
    { p: [-7.4, 0.96, -8.12], s: [0.06, 0.54, 0.06], c: 0x7a7e82, cyl: true, seg: 6 },
    { p: [-7.4, 1.20, -7.96], s: [0.05, 0.28, 0.05], c: C.brass, cyl: true, rx: H, seg: 6 },
    { p: [-7.1, 0.18, -7.1], s: [0.34, 0.36, 0.34], c: 0x2e5c8a, cyl: true, seg: 9, top: 1.2 }, // blue bucket
  );

  // Overhead bamboo laundry poles with hung blue work jackets & floral shirts
  for (const [lx, lz, cols] of [
    [-4.2, 4.4, [0x2c476e, 0xe8e2d0, 0x9e3a34, 0x4f684c]],
    [4.4, -0.5, [0x3b5882, 0xc86458, 0xe4dfd0]],
  ] as [number, number, number[]][]) {
    stat.push(
      { p: [lx, 2.58, lz], s: [0.05, 4.6, 0.05], c: 0x8b7548, cyl: true, rz: H, seg: 6 },
      { p: [lx - 2.1, 1.30, lz], s: [0.07, 2.6, 0.07], c: 0x6b5836, cyl: true, seg: 6 },
      { p: [lx + 2.1, 1.30, lz], s: [0.07, 2.6, 0.07], c: 0x6b5836, cyl: true, seg: 6 },
    );
    cols.forEach((col, i) => {
      const gx = lx - 1.3 + i * 0.85;
      stat.push(
        { p: [gx, 2.18, lz], s: [0.54, 0.68, 0.06], c: col },
        { p: [gx - 0.32, 2.26, lz], s: [0.18, 0.44, 0.05], c: col, rz: 0.2 },
        { p: [gx + 0.32, 2.26, lz], s: [0.18, 0.44, 0.05], c: col, rz: -0.2 },
      );
    });
  }

  // Rooftop wooden pigeon coop (鴿籠) on East Wing roof + wooden bench below at [7.2, -5.0]
  stat.push(
    { p: [9.8, 4.45, -4.8], s: [1.55, 1.05, 1.35], c: 0x6e4e2e },
    { p: [9.8, 5.10, -4.8], s: [1.75, 0.32, 1.55], c: 0x3b3e42, rx: -0.18 },
    { p: [8.85, 4.10, -4.8], s: [0.46, 0.05, 1.25], c: 0x85623d }, // landing board
    // Small white/grey pigeons perched on coop
    { p: [8.85, 4.24, -4.5], s: [0.14, 0.16, 0.22], c: 0xe6e4de, sphere: true, detail: 0 },
    { p: [8.85, 4.24, -5.05], s: [0.14, 0.16, 0.22], c: 0x7b828a, sphere: true, detail: 0 },
    { p: [9.4, 5.26, -4.7], s: [0.14, 0.16, 0.22], c: 0xe6e4de, sphere: true, detail: 0 },
    // Wooden courtyard bench beside hotspot [6, -5]
    { p: [7.2, 0.44, -5.0], s: [0.52, 0.08, 1.65], c: C.wood },
    { p: [7.2, 0.22, -5.65], s: [0.46, 0.44, 0.10], c: C.darkWood },
    { p: [7.2, 0.22, -4.35], s: [0.46, 0.44, 0.10], c: C.darkWood },
  );

  addLayeredParts(s, stat);
  if (glow.length) s.add(new THREE.Mesh(mergeParts(glow), glowMat()));

  // Gnarled scholar tree (國槐) & parked Flying Pigeon bicycles
  addRealisticTrees(s, [{ x: 4.8, z: 2.6, ry: 0.6, s: 0.92 }], false, false);
  s.add(instanced(mergeParts(bike()), litMat(), [
    { x: 7.4, z: -1.6, ry: H },
    { x: 7.4, z: -0.4, ry: H + 0.14 },
    { x: 7.4, z: 0.8, ry: H - 0.1 },
    { x: 2.6, z: -11.4, ry: 0.2 },
  ]));

  // Warm domestic courtyard lights
  for (const [lx, ly, lz, inten] of [
    [0, 3.6, 3.5, 16],
    [-4.5, 3.2, -3.5, 14],
    [0, 2.8, -11.5, 12],
  ] as [number, number, number, number][]) {
    const l = new THREE.PointLight(C.sodium, inten, 18, 1.6);
    l.position.set(lx, ly, lz);
    s.add(l);
  }

  return {
    id: 'courtyard' as SceneId,
    scene: s,
    spawn: [0, 3],
    bounds: [-15, 15, -16, 12],
    camDist: 11,
    update() { /* static courtyard scene */ },
  };
}

/** Detailed worker in indigo factory jacket riding the flatbed cargo tricycle (facing +x). */
export function workerTricycleRider(includeWheels = true, includeHead = true): Part[] {
  const jacket = 0x284266;
  const trousers = 0x1f2838;
  const cap = 0x24344c;
  const skin = 0xc8a07a;

  return [
    ...tricycleBodyParts(includeWheels),
    // Torso leaning forward from saddle [0.27, 0.79, 0] toward handlebars [0.66, 0.96, ±0.22]
    { p: [0.35, 1.12, 0], s: [0.26, 0.56, 0.40], c: jacket, cyl: true, seg: 7, top: 1.12, rz: -0.26 },
    { p: [0.44, 1.40, 0], s: [0.21, 0.06, 0.26], c: jacket, cyl: true, seg: 6, rz: -0.18 },
    { p: [0.49, 1.32, 0], s: [0.05, 0.14, 0.12], c: 0xe8e2d2, rz: -0.26 }, // undershirt V-neck
    // Olive canvas work satchel strap
    { p: [0.36, 1.13, 0], s: [0.28, 0.50, 0.04], c: 0x565c3a, rx: 0.55, rz: -0.26 },
    ...(includeHead ? [
      // Head + worker cap (工人鴨舌帽)
      { p: [0.46, 1.54, 0], s: [0.19, 0.21, 0.185], c: skin, sphere: true, detail: 1 },
      { p: [0.565, 1.53, 0], s: [0.03, 0.05, 0.03], c: 0xc29872, wedge: true },
      { p: [0.45, 1.65, 0], s: [0.22, 0.09, 0.21], c: cap, sphere: true, detail: 1 },
      { p: [0.57, 1.615, 0], s: [0.12, 0.025, 0.19], c: 0x1c283a, rz: -0.15 },
    ] as Part[] : []),
    // Arms gripping tricycle handlebars at [0.66, 0.96, ±0.22]
    strut([0.42, 1.29, 0.21], [0.55, 1.12, 0.23], 0.095, jacket, 6),
    strut([0.55, 1.12, 0.23], [0.65, 0.97, 0.22], 0.082, jacket, 6),
    strut([0.42, 1.29, -0.21], [0.55, 1.12, -0.23], 0.095, jacket, 6),
    strut([0.55, 1.12, -0.23], [0.65, 0.97, -0.22], 0.082, jacket, 6),
    { p: [0.65, 0.96, 0.22], s: [0.075, 0.075, 0.075], c: skin },
    { p: [0.65, 0.96, -0.22], s: [0.075, 0.075, 0.075], c: skin },
    // Articulated legs & work shoes on crank pedals around [0.36, 0.32, ±0.11]
    strut([0.28, 0.84, 0.11], [0.48, 0.62, 0.11], 0.125, trousers, 6),
    strut([0.48, 0.62, 0.11], [0.46, 0.39, 0.11], 0.105, trousers, 6),
    strut([0.28, 0.84, -0.11], [0.32, 0.54, -0.11], 0.125, trousers, 6),
    strut([0.32, 0.54, -0.11], [0.27, 0.25, -0.11], 0.105, trousers, 6),
    { p: [0.48, 0.37, 0.11], s: [0.19, 0.065, 0.10], c: 0x1c1b19 },
    { p: [0.29, 0.23, -0.11], s: [0.19, 0.065, 0.10], c: 0x1c1b19 },
  ];
}
