import * as THREE from 'three';
import { CHAPTER0, EVENTS } from './data';
import { buildCampus, buildStreet, World } from './render/scenes';
import { glowMat, instanced, mergeParts } from './render/kit';
import { Controls } from './play/controls';
import { Player, followCam } from './play/player';
import { Story } from './play/story';
import { clear, fresh, load, store, SaveState } from './save/save';
import { allSourcesHtml, eventHtml } from './ui/sources';
import type { Choice, Hotspot, SceneId } from './types';

const $ = (id: string) => document.getElementById(id)!;
const canvas = $('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.info.autoReset = false;
const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
const controls = new Controls(canvas, $('stick'), $('knob'));
const player = new Player();

let state: SaveState = fresh();
let story = new Story(CHAPTER0, state);
const seen = new Set<string>();
const worlds: Partial<Record<SceneId, World>> = {};
let world!: World;
let near: Hotspot | null = null;
let inDialog = false, playing = false;

function getWorld(id: SceneId): World {
  if (!worlds[id]) {
    const w = id === 'campus' ? buildCampus() : buildStreet();
    const hs = CHAPTER0.hotspots.filter(h => h.scene === id);
    const marker = mergeParts([{ p: [0, 0, 0], s: [0.22, 0.22, 0.22], c: 0xffe08a, ry: 0.78 }]);
    const m = instanced(marker, glowMat(), hs.map(h => ({ x: h.pos[0], z: h.pos[1], y: 2.35 })));
    m.name = 'markers'; w.scene.add(m);
    worlds[id] = w;
  }
  return worlds[id]!;
}

function enter(id: SceneId, pos?: [number, number]) {
  if (world) world.scene.remove(player.mesh);
  world = getWorld(id); state.scene = id;
  world.scene.add(player.mesh);
  const p = pos ?? world.spawn; player.place(p[0], p[1]);
  cam.position.set(p[0], 11, p[1] - 7);
  $('date').textContent = id === 'campus' ? '1989 年 4 月 17 日・晚・校園' : '1989 年 4 月 17 日・晚・城裡';
  store(state);
}

function fade(text: string, ms: number, mid: () => void) {
  $('fadetxt').textContent = text; $('fade').classList.add('on');
  setTimeout(() => { mid(); setTimeout(() => $('fade').classList.remove('on'), ms); }, 900);
}

function show(nodeId: string) {
  const n = story.node(nodeId);
  inDialog = true; $('dlg').hidden = false; $('act').hidden = true;
  $('who').textContent = story.speakerName(n.speaker);
  $('txt').textContent = n.text;
  if (n.event) seen.add(n.event);
  const sb = $('srcbtn'); sb.hidden = !n.event;
  sb.onclick = () => n.event && openModal(eventHtml(EVENTS[n.event]));
  const ch = $('ch'); ch.innerHTML = '';
  for (const c of story.available(n)) {
    const b = document.createElement('button'); b.textContent = c.text; b.onclick = () => choose(c); ch.appendChild(b);
  }
}

function choose(c: Choice) {
  story.apply(c); store(state);
  if (c.next) return show(c.next);
  closeDialog();
  if (c.end) return ending(c.end);
  if (c.goto && c.goto !== world.id) fade('騎車進城……', 1200, () => enter(c.goto!));
}
function closeDialog() { inDialog = false; $('dlg').hidden = true; }

function ending(id: string) {
  const e = CHAPTER0.endings[id];
  const diary = state.diary.map(d => `<li>${d}</li>`).join('');
  openModal(`<h2>${e.title}</h2><p>${e.text}</p><h4>日記</h4><ol>${diary}</ol><p class="small">${CHAPTER0.epilogue}</p><div class="row"><button id="again">重新開始</button></div>`);
  $('again').onclick = () => { clear(); location.reload(); };
}

function openModal(html: string) { $('mbody').innerHTML = html; $('modal').hidden = false; }
$('mclose').onclick = () => { $('modal').hidden = true; };
$('b-diary').onclick = () => openModal('<h2>日記</h2>' + (state.diary.length ? '<ol>' + state.diary.map(d => `<li>${d}</li>`).join('') + '</ol>' : '<p class="small">還沒有寫下什麼。</p>'));
$('b-src').onclick = () => openModal(allSourcesHtml([...seen]));
$('b-menu').onclick = () => {
  openModal(`<h2>選單</h2><p class="small">進度會自動存在這台裝置上。</p><div class="row"><button id="restart">從頭開始</button></div><p class="small">所有人物皆為虛構。程式 © 2026 李家宝。</p>`);
  $('restart').onclick = () => { clear(); location.reload(); };
};

controls.onInteract = () => { if (!inDialog && near && $('modal').hidden && playing) show(near.start); };
$('act').onclick = () => controls.onInteract();

function start(s: SaveState, intro: boolean) {
  state = s; story = new Story(CHAPTER0, state);
  $('title').hidden = true; $('hud').hidden = false; $('stick').hidden = false; playing = true;
  enter(state.scene);
  if (intro) show(CHAPTER0.start);
}
const saved = load();
if (saved && !saved.ending) $('b-cont').hidden = false;
$('b-new').onclick = () => { clear(); start(fresh(), true); };
$('b-cont').onclick = () => start(saved!, false);

function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h;
  cam.fov = w < h ? 62 : 50; cam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const clock = new THREE.Clock();
world = getWorld('campus'); world.scene.add(player.mesh); player.place(0, 5); cam.position.set(0, 11, -2);
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (playing && !inDialog && $('modal').hidden) player.step(dt, controls.axis(), world.bounds);
  world.update(dt, t);
  followCam(cam, player, controls.zoom * (playing ? 1 : 1.3));
  near = null; let best = 2.4;
  for (const h of CHAPTER0.hotspots) if (h.scene === world.id) {
    const d = Math.hypot(h.pos[0] - player.pos.x, h.pos[1] - player.pos.y); if (d < best) { best = d; near = h; }
  }
  const act = $('act') as HTMLButtonElement;
  act.hidden = !playing || inDialog || !near; if (near) act.textContent = near.label + '（E）';
  renderer.info.reset(); renderer.render(world.scene, cam);
  requestAnimationFrame(frame);
}
frame();

// Debug/test hook (used by tests/smoke.mjs).
(window as any).__b89 = {
  get state() { return state; }, get scene() { return world.id; }, get near() { return near?.id ?? null; },
  get dialog() { return inDialog; },
  perf() { let tris = 0; world.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry) { const g = m.geometry; const n = (g.index ? g.index.count : g.getAttribute('position').count) / 3; tris += n * ((m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1); } }); return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, sceneTriangles: tris }; },
  teleport(id: string) { const h = CHAPTER0.hotspots.find(x => x.id === id)!; if (world.id !== h.scene) enter(h.scene); player.place(h.pos[0], h.pos[1] - 1.2); },
  interact() { controls.onInteract(); },
  choose(i: number) { ($('ch').children[i] as HTMLButtonElement)?.click(); },
  choices() { return [...$('ch').children].map(b => b.textContent); },
};
