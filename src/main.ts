import * as THREE from 'three';
import { CH, ORDER, EVENTS } from './data';
import { buildCampus, buildChangan, buildStreet, World } from './render/scenes';
import { glowMat, instanced, litMat, mergeParts } from './render/kit';
import { person } from './render/props';
import { flowHtml } from './ui/flow';
import { Controls } from './play/controls';
import { Player, followCam } from './play/player';
import { Story } from './play/story';
import { clear, fresh, load, starts, store, storeStart, SaveState } from './save/save';
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
let story = new Story(CH[state.chapter], state);
const chap = () => CH[state.chapter];
const short = (id: string) => id.split('-')[0];
const hotspots = () => chap().hotspots.filter(h => h.scene === world?.id && (!h.requires || story.has(h.requires)));
const NPC: Record<string, number> = { khaki: 0x8a7a55, red: 0x6a2f3a, navy: 0x2f3a52, blue: 0x3a4a5a, green: 0x4e5a3a, grey: 0x5a5a55 };
const seen = new Set<string>();
const worlds: Record<string, World> = {};
let world!: World;
let near: Hotspot | null = null;
let inDialog = false, playing = false, yaw = 0, snap = true;

function getWorld(id: SceneId): World {
  const key = state.chapter + ':' + id;
  if (!worlds[key]) {
    worlds[key] = id === 'campus' ? buildCampus() : id === 'street' ? buildStreet() : id === 'march' ? buildStreet('march')
      : id === 'square' ? buildChangan('dawn') : buildChangan();
  }
  return worlds[key]!;
}
/** Markers + fictional NPC figures for the hotspots that are present for this save (carry-over decides who appears). */
function dressWorld(w: World) {
  for (const n of ['markers', 'npcs']) { const o = w.scene.getObjectByName(n); if (o) w.scene.remove(o); }
  const hs = chap().hotspots.filter(h => h.scene === w.id && (!h.requires || story.has(h.requires)));
  const marker = mergeParts([{ p: [0, 0, 0], s: [0.22, 0.22, 0.22], c: 0xffe08a, ry: 0.78 }]);
  const big = w.id === 'square' || w.id === 'changan' ? 1.6 : 1;
  const m = instanced(marker, glowMat(), hs.map(h => ({ x: h.pos[0], z: h.pos[1], y: 2.35 * big, s: big })));
  m.name = 'markers'; w.scene.add(m);
  const npcs = hs.filter(h => h.npc).map(h => ({ c: NPC[h.npc!] ?? 0x555555, x: h.pos[0] + 0.9, z: h.pos[1] - 0.6 }));
  if (npcs.length) {
    const parts = npcs.flatMap(n => person(n.c).map(pt => ({ ...pt, p: [pt.p[0] + n.x, pt.p[1], pt.p[2] + n.z] as [number, number, number] })));
    const one = new THREE.Mesh(mergeParts(parts), litMat()); one.name = 'npcs'; w.scene.add(one);
  }
}

function enter(id: SceneId, pos?: [number, number]) {
  if (world) world.scene.remove(player.mesh);
  world = getWorld(id); state.scene = id; dressWorld(world);
  world.scene.add(player.mesh);
  const p = pos ?? world.spawn; player.place(p[0], p[1]);
  player.setRiding(id === 'street' || id === 'changan'); yaw = id === 'square' ? -Math.PI / 2 : id === 'march' ? Math.PI / 2 : 0; snap = true;
  cam.far = id === 'changan' || id === 'square' ? 700 : 120; cam.updateProjectionMatrix();
  $('date').textContent = chap().labels[id] ?? '';
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
  $('txt').textContent = story.text(n);
  if (n.event) seen.add(n.event);
  const sb = $('srcbtn'); sb.hidden = !n.event;
  sb.onclick = () => n.event && openModal(eventHtml(EVENTS[n.event]));
  const ch = $('ch'); ch.innerHTML = '';
  for (const c of story.available(n)) {
    const b = document.createElement('button'); b.textContent = c.text; b.onclick = () => choose(c, nodeId); ch.appendChild(b);
  }
}

function choose(c: Choice, nodeId?: string) {
  story.apply(c, nodeId); store(state);
  if (c.next) return show(c.next);
  closeDialog();
  if (c.end) return ending(c.end);
  if (c.goto && c.goto !== world.id) fade(chap().transitions[c.goto] ?? '……', 1200, () => enter(c.goto!));
}
function closeDialog() { inDialog = false; $('dlg').hidden = true; }

function record() { return { ending: state.ending, taken: state.taken ?? [] }; }
function ending(id: string) {
  const c = chap(), e = c.endings[id];
  const flag = short(c.chapter) + ':end:' + id;
  const nextId = ORDER[ORDER.indexOf(c.chapter) + 1];
  const diary = state.diary.map(d => `<li>${d}</li>`).join('');
  const ep = c.epilogueEvent ? ` <a href="#" id="epsrc">（史料）</a>` : '';
  openModal(`<h2>${e.title}</h2><p>${e.text}</p><p class="small">${c.epilogue}${ep}</p>
    <div class="row">${nextId ? `<button id="nextch">下一章：${CH[nextId].title}</button>` : ''}<button id="flow">分支圖</button></div>
    <h4>日記</h4><ol>${diary}</ol><div class="row"><button id="replay">重玩本章</button><button id="again">從頭開始</button></div>`);
  if (c.epilogueEvent) $('epsrc').onclick = ev => { ev.preventDefault(); openModal(eventHtml(EVENTS[c.epilogueEvent!])); };
  $('flow').onclick = () => openModal('<h2>分支圖</h2>' + flowHtml(c, record()));
  $('replay').onclick = () => { const s0 = starts()[c.chapter]; if (s0) start(s0, true); };
  $('again').onclick = () => { clear(); location.reload(); };
  if (nextId) $('nextch').onclick = () => {
    const h = state.history ?? (state.history = {});
    h[c.chapter] = record();
    if (!state.flags.includes(flag)) state.flags.push(flag);
    state.chapter = nextId; state.ending = undefined; state.taken = []; state.items = []; state.scene = 'campus';
    storeStart(state); $('modal').hidden = true;
    fade(CH[nextId].title, 1400, () => start(state, true));
  };
}

function openModal(html: string) { $('mbody').innerHTML = html; $('modal').hidden = false; }
$('mclose').onclick = () => { $('modal').hidden = true; };
$('b-diary').onclick = () => openModal('<h2>日記</h2>' + (state.diary.length ? '<ol>' + state.diary.map(d => `<li>${d}</li>`).join('') + '</ol>' : '<p class="small">還沒有寫下什麼。</p>'));
$('b-turn').onclick = () => { yaw = (yaw + Math.PI / 2) % (Math.PI * 2); };
$('b-src').onclick = () => openModal(allSourcesHtml([...seen]));
$('b-menu').onclick = () => {
  openModal(`<h2>選單</h2><p class="small">進度會自動存在這台裝置上。</p><div class="row"><button id="mflow">分支圖</button><button id="restart">從頭開始</button></div><p class="small">所有說話的人物皆為虛構。程式 © 2026 李家宝。</p>`);
  $('mflow').onclick = () => openModal('<h2>分支圖</h2>' + ORDER.filter(id => id === state.chapter || state.history?.[id]).map(id => flowHtml(CH[id], id === state.chapter ? record() : state.history![id])).join(''));
  $('restart').onclick = () => { clear(); location.reload(); };
};

controls.onInteract = () => { if (!inDialog && near && $('modal').hidden && playing) show(near.start); };
let started = false;
$('act').onclick = () => controls.onInteract();

function start(s: SaveState, intro: boolean) {
  state = s; state.taken ??= []; state.history ??= {}; story = new Story(chap(), state);
  if (intro && !starts()[state.chapter]) storeStart(state);
  $('title').hidden = true; $('hud').hidden = false; $('stick').hidden = false; playing = true; started = true;
  enter(state.scene);
  if (intro) show(chap().start);
  else if (state.ending) ending(state.ending);
}
const saved = load();
if (saved) $('b-cont').hidden = false;
$('b-new').onclick = () => { clear(); start(fresh(), true); };
$('b-cont').onclick = () => start(saved!, false);
const st0 = starts();
const sel = ORDER.filter(id => st0[id]);
if (sel.length > 1) {
  $('chsel').hidden = false;
  $('chsel').innerHTML = '<p class="small">選擇章節（從該章開頭重玩，沿用當時的前情）</p>' + sel.map(id => `<button data-ch="${id}">${CH[id].title}</button>`).join('');
  $('chsel').querySelectorAll('button').forEach(b => (b as HTMLButtonElement).onclick = () => start(JSON.parse(JSON.stringify(st0[(b as HTMLElement).dataset.ch!])), true));
}

function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h;
  cam.fov = w < h ? 62 : 50; cam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const clock = new THREE.Clock();
const GATE_FOCUS = new THREE.Vector3(0, 4.6, -16);
world = getWorld('campus'); world.scene.add(player.mesh); player.place(0, 5);
void started;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (playing && !inDialog && $('modal').hidden) player.step(dt, controls.axis(), world.bounds, yaw);
  world.update(dt, t);
  const nearGate = world.id === 'campus' && player.pos.y < -18 && Math.abs(player.pos.x) < 9;
  followCam(cam, player, (world.camDist ?? 11) * controls.zoom * (playing ? 1 : 1.3), yaw, snap, nearGate ? GATE_FOCUS : undefined, 19 / Math.min(1, cam.aspect * 1.25), world.cam); snap = false;
  near = null; let best = 2.4;
  const reach = world.id === 'changan' || world.id === 'square' ? 7 : world.id === 'march' ? 3 : 2.4; best = reach;
  for (const h of hotspots()) {
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
  setYaw(r: number) { yaw = r; snap = true; },
  placeAt(x: number, z: number) { player.place(x, z); snap = true; },
  teleport(id: string) { const h = chap().hotspots.find(x => x.id === id)!; if (world.id !== h.scene) enter(h.scene); player.place(h.pos[0], h.pos[1] - 1.2); snap = true; },
  interact() { controls.onInteract(); },
  choose(i: number) { ($('ch').children[i] as HTMLButtonElement)?.click(); },
  next() { ($('nextch') as HTMLButtonElement).click(); },
  flow() { ($('flow') as HTMLButtonElement).click(); },
  choices() { return [...$('ch').children].map(b => b.textContent); },
};
