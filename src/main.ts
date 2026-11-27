import * as THREE from 'three';
import {
  CH,
  EVENTS,
  ROUTES,
  SCENE_META,
  VIEWPOINTS,
  WORLD_FLAGS,
  dayKeyOf,
  firstChapterFor,
  orderForChapter,
  orderForViewpoint,
  shortIdOf,
  viewpointOfChapter,
} from './data';
import { VIEWPOINT_LABELS } from './data/routeMetas';
import { type World } from './render/scenes';
import { registerJournalistSets } from './render/sets/journalistSets';
import { registerResidentSets } from './render/sets/residentSets';
import { WorldManager, disposeObjectTree } from './render/worldManager';
import { applyRealismLighting, makeRainSystem, type RainSystem } from './render/materials';
import { FilmicPostProcessor } from './render/postProcess';
import { updateFoliageWind } from './render/foliage';
import { attachLivingWorld, type LivingWorldHandle } from './render/livingWorld';
import { glowMat, instanced, litMat, mergeParts, place } from './render/kit';
import { buildNpcParts, resolveNpcArchetype } from './render/npcCharacter';
import { flowHtml, flowMultiChapterHtml } from './ui/flow';
import { findNextTarget, isInTimeWindow, pickAutoChoice } from './engine/autoGuide';
import { fullSpringChronicleHtml } from './ui/chronicle';
import { updateTimelineHud } from './ui/hudTimeline';
import {
  applySettingsToDom,
  bindSettingsPanel,
  loadSettings,
  renderSettingsPanelHtml,
  saveSettings,
  type AppSettings,
} from './ui/settings';
import {
  evaluateEvidencePair,
  mountDiaryModal,
  mountMapTimelineModal,
  mountShortwaveTuner,
  mountViewfinderOverlay,
  type ShortwaveStation,
  type ViewfinderController,
} from './ui/modals';
import { Controls } from './play/controls';
import { CinemaCamera, CAM_MODE_LABELS, isPhotoTargetInViewfinder, type CamMode, type LensMm } from './play/camera';
import {
  getActiveScoreTrack,
  isAudioOn,
  isAudioUnlocked,
  playBell,
  playEndingStinger,
  playPaper,
  playRadioStatic,
  playShutter,
  playShutterStinger,
  playStep,
  playTransitionChord,
  setAudioMood,
  setAudioScene,
  startShortwaveAudio,
  stopShortwaveAudio,
  toggleAudio,
  unlockAudio,
  updateShortwaveAudio,
} from './play/audio';
import {
  isNarratorEnabled,
  playChapterVoiceover,
  setNarratorVoiceMode,
  speakLine,
  stopNarrator,
  toggleNarrator,
} from './play/narrator';
import { Player } from './play/player';
import { Story } from './play/story';
import { captureSilverGelatinPhoto } from './ui/darkroom';
import {
  checkSnapshotDrift,
  clear,
  fresh,
  load,
  loadLedger,
  markSeenEvent,
  recordSnapshot,
  starts,
  store,
  storeStart,
  type SaveState,
  type SnapshotDriftResult,
} from './save/save';
import { allSourcesHtml, eventHtml } from './ui/sources';
import { mountOpeningPrelude } from './ui/openingPrelude';
import type { Choice, Hotspot, PhotoTarget, PlayerMode, SceneId, ViewpointId } from './types';

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const isMobile =
  typeof navigator !== 'undefined' &&
  (/Mobi|Android|iPhone/i.test(navigator.userAgent) ||
    (typeof window !== 'undefined' && window.innerWidth <= 600 && navigator.maxTouchPoints > 0));

const canvas = $('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 160);
const controls = new Controls(canvas, $('stick'), $('knob'));
const player = new Player();
player.mesh.userData.persistent = true;
const cinemaCam = new CinemaCamera('cinema');

let appSettings: AppSettings = loadSettings(!isMobile);
applySettingsToDom(appSettings);
controls.setOrbitSensitivity(appSettings.camSensitivity);
setNarratorVoiceMode(appSettings.voiceMode);

const postProcess = new FilmicPostProcessor(renderer, appSettings.postProcess);

registerJournalistSets();
registerResidentSets();

const worldManager = new WorldManager({ maxCached: 3, sceneMeta: SCENE_META });
const worldRain = new WeakMap<World, RainSystem>();
const worldLiving = new WeakMap<World, LivingWorldHandle>();

type VisualLook = 'filmic' | 'mono' | 'lianhuanhua';
const LOOK_LABELS: Record<VisualLook, string> = {
  filmic: '寫實膠片',
  mono: '黑白紀實',
  lianhuanhua: '彩墨連環',
};
let visualLook: VisualLook = (() => {
  try {
    const saved = localStorage.getItem('beijing1989.look');
    if (saved === 'mono' || saved === 'lianhuanhua' || saved === 'filmic') return saved;
  } catch { /* ignore */ }
  return 'filmic';
})();

function applyVisualLook(look: VisualLook) {
  visualLook = look;
  document.body.dataset.look = look;
  const exposure = look === 'mono' ? 1.12 : look === 'lianhuanhua' ? 1.10 : 1.08;
  renderer.toneMappingExposure = exposure;
  postProcess.setOptions({ look, exposure });
  try { localStorage.setItem('beijing1989.look', look); } catch { /* ignore */ }
}

function applyAppSettings(next: AppSettings) {
  appSettings = { ...next };
  saveSettings(appSettings);
  applySettingsToDom(appSettings);
  controls.setOrbitSensitivity(appSettings.camSensitivity);
  postProcess.setEnabled(appSettings.postProcess);
  setNarratorVoiceMode(appSettings.voiceMode);
  if (!appSettings.showWhispers) {
    lastWhisperKey = '';
    $('ambient-whisper').hidden = true;
  }
}

function cycleVisualLook(): VisualLook {
  const order: VisualLook[] = ['filmic', 'mono', 'lianhuanhua'];
  const next = order[(order.indexOf(visualLook) + 1) % order.length]!;
  applyVisualLook(next);
  return next;
}
applyVisualLook(visualLook);

let activeViewpoint: ViewpointId = 'student';
let state: SaveState = fresh('student');
let story = new Story(CH[state.chapter], state, dayKeyOf(state.chapter));
const chap = () => CH[state.chapter];
const activeOrder = () => orderForChapter(state.chapter);
const short = (id: string) => shortIdOf(id);
const startSceneFor = (id: string): SceneId => {
  const ch = CH[id];
  if (ch?.startScene) return ch.startScene;
  const firstLabel = Object.keys(ch?.labels ?? {})[0] as SceneId | undefined;
  if (firstLabel) return firstLabel;
  const vp = viewpointOfChapter(id);
  return vp === 'worker' ? 'factory' : vp === 'journalist' ? 'newsroom' : vp === 'resident' ? 'siheyuan_room' : 'campus';
};
const hotspots = () =>
  chap().hotspots.filter(
    h => h.scene === world?.id && (!h.requires || story.has(h.requires)) && isInTimeWindow(h, state.clockMin),
  );
const seen = new Set<string>(loadLedger().seenEvents);
let world!: World;
let near: Hotspot | null = null;
let activeDialogTarget: [number, number] | null = null;
let basePlayerMode: PlayerMode = 'walk';
let inDialog = false;
let playing = false;
let yaw = 0;
let snap = true;
let modalCleanup: (() => void) | null = null;
let modalCloseCallback: (() => void) | null = null;
let modalReqToken = 0;
let activeModalKind: '' | 'map' | 'diary' | 'shortwave' | 'drift' | 'book' | 'artifact' = '';
let lastWhisperKey = '';
let vfCtrl: ViewfinderController | null = null;
let lastVfLockLabel: string | null = null;
let lastGuideKey = '';
const camDirScratch = new THREE.Vector3();

// Guided Story Mode & Playback Speed state
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];
let autoGuide = false;
let playSpeed = 1;
let isFading = false;
let curNodeId = '';
let dlgAutoElapsed = 0;
let dlgAutoDuration = 3.0;
let dlgAutoPicked = false;
let endAutoTimer: number | null = null;

function clearEndAutoTimer() {
  if (endAutoTimer !== null) {
    clearTimeout(endAutoTimer);
    endAutoTimer = null;
  }
}

function closeSpeedMenu() {
  $('speed-menu').hidden = true;
}

function sceneHasPhotoTargets(sceneId: SceneId): boolean {
  const pts = chap()?.photoTargets ?? [];
  return pts.some(pt => pt.scene === sceneId && (!pt.requires || story.has(pt.requires)));
}

function syncLensBtn() {
  const btn = $('b-lens') as HTMLButtonElement;
  const inVf = cinemaCam.getMode() === 'viewfinder';
  const show = activeViewpoint === 'journalist' || sceneHasPhotoTargets(world?.id ?? state.scene) || inVf;
  btn.hidden = !show;
  btn.classList.toggle('on', inVf);
  btn.textContent = inVf ? '收起取景 (F)' : '取景 (F)';
}

function teardownViewfinderUi() {
  controls.setViewfinderMode(false);
  controls.setOrbitPitch(0);
  document.body.classList.remove('viewfinder-on');
  vfCtrl?.destroy();
  vfCtrl = null;
  lastVfLockLabel = null;
  player.setRoleMode(activeViewpoint, basePlayerMode);
}

function setViewfinderActive(on: boolean) {
  const currentlyOn = cinemaCam.getMode() === 'viewfinder';
  if (on) {
    if (!playing || inDialog || !$('modal').hidden || isFading) return;
    closeSpeedMenu();
    if (!currentlyOn) cinemaCam.toggleViewfinder();
    controls.setViewfinderMode(true, false);
    player.setRoleMode(activeViewpoint, 'camera_walk');
    document.body.classList.add('viewfinder-on');
    document.body.classList.remove('letterbox-on');
    $('act').hidden = true;
    if (!vfCtrl) {
      vfCtrl = mountViewfinderOverlay({
        initialLens: cinemaCam.getLens(),
        framesLeft: Math.max(0, 36 - (state.photos?.length ?? 0)),
        maxFrames: 36,
        onLensChange: mm => {
          unlockAudio();
          cinemaCam.setLens(mm);
        },
        onShutter: () => {
          unlockAudio();
          capturePhoto();
        },
        onExit: () => {
          unlockAudio();
          setViewfinderActive(false);
        },
      });
    } else {
      vfCtrl.setLens(cinemaCam.getLens());
      vfCtrl.setFramesLeft(Math.max(0, 36 - (state.photos?.length ?? 0)));
      vfCtrl.setVisible(true);
    }
    setAudioMood('viewfinder');
  } else {
    if (currentlyOn) cinemaCam.toggleViewfinder();
    teardownViewfinderUi();
    if (playing && $('modal').hidden) {
      setAudioMood(inDialog ? 'dialog' : 'explore');
    }
  }
  syncCamUi();
  syncLensBtn();
}

function syncCamUi() {
  const mode = cinemaCam.getMode();
  const btn = $('b-cam');
  btn.textContent = CAM_MODE_LABELS[mode];
  btn.classList.toggle('cine', mode === 'cinema');
  if (mode !== 'cinema') document.body.classList.remove('letterbox-on');
  if (mode !== 'viewfinder' && (vfCtrl || controls.isViewfinderMode())) {
    teardownViewfinderUi();
    syncLensBtn();
    if (playing && $('modal').hidden) setAudioMood(inDialog ? 'dialog' : 'explore');
  }
}

function syncAutoUi() {
  const autoBtn = $('b-auto');
  autoBtn.textContent = autoGuide ? '自動引導：開' : '自動引導：關';
  autoBtn.classList.toggle('on', autoGuide);
  $('b-speed').textContent = `倍速：${playSpeed}x`;
  $('dlg-speed').textContent = `倍速：${playSpeed}x`;
  document.querySelectorAll<HTMLButtonElement>('#speed-menu .spd-opt[data-speed]').forEach(btn => {
    btn.classList.toggle('on', Number(btn.dataset.speed) === playSpeed);
  });
  document.querySelectorAll<HTMLButtonElement>('#dlg-speeds .dlg-spd-opt[data-speed]').forEach(btn => {
    btn.classList.toggle('on', Number(btn.dataset.speed) === playSpeed);
  });
  $('dlg-auto').hidden = !autoGuide;
  $('dlg-auto-lbl').textContent = `自動引導進行中（${playSpeed}x）— 點擊選項可手動接手`;
  syncCamUi();
  if (inDialog && curNodeId) highlightAutoChoice();
  refreshGuide(true);
}

function setAutoGuide(on: boolean) {
  autoGuide = on;
  dlgAutoElapsed = 0;
  dlgAutoPicked = false;
  if (!on) clearEndAutoTimer();
  syncAutoUi();
}

function setPlaySpeed(s: number) {
  if (!SPEEDS.includes(s)) s = 1;
  playSpeed = s;
  syncAutoUi();
}

function stepSpeedDelta(delta: -1 | 1) {
  const idx = SPEEDS.indexOf(playSpeed);
  const base = idx === -1 ? SPEEDS.indexOf(1) : idx;
  const next = Math.max(0, Math.min(SPEEDS.length - 1, base + delta));
  setPlaySpeed(SPEEDS[next]!);
}

function cyclePlaySpeed() {
  const next = SPEEDS[(SPEEDS.indexOf(playSpeed) + 1) % SPEEDS.length]!;
  setPlaySpeed(next);
}

function applySceneMetaToWorld(w: World) {
  const meta = SCENE_META[w.id];
  if (!meta) return;
  if (meta.bounds) w.bounds = meta.bounds;
  if (meta.cam?.dist !== undefined) w.camDist = meta.cam.dist;
  if (meta.cam && meta.cam.h !== undefined && meta.cam.ahead !== undefined && meta.cam.y !== undefined) {
    w.cam = { h: meta.cam.h, ahead: meta.cam.ahead, y: meta.cam.y };
  }
  if (!w.atmosphere && meta.atmosphere) w.atmosphere = meta.atmosphere;
  w.scene.userData.stepSurface = meta.stepSurface;
}

function ensureWeatherForWorld(w: World) {
  const atmo = SCENE_META[w.id]?.atmosphere ?? w.atmosphere;
  if (atmo === 'rain_overcast' && !worldRain.has(w) && !w.scene.getObjectByName('rainSystem')) {
    const rain = makeRainSystem(isMobile);
    w.scene.add(rain.mesh);
    worldRain.set(w, rain);
    const prevDispose = w.dispose;
    w.dispose = () => {
      rain.dispose();
      w.scene.remove(rain.mesh);
      worldRain.delete(w);
      prevDispose?.();
    };
  }
}

function getWorld(id: SceneId): World {
  const w = worldManager.acquire(id);
  applySceneMetaToWorld(w);
  ensureWeatherForWorld(w);
  const atmo = SCENE_META[w.id]?.atmosphere ?? w.atmosphere ?? 'night';
  applyRealismLighting(w.scene, atmo, isMobile, renderer);
  if (!worldLiving.has(w)) {
    const lw = attachLivingWorld(w.scene, w.id, atmo, isMobile);
    worldLiving.set(w, lw);
    const prevDispose = w.dispose;
    w.dispose = () => {
      lw.dispose();
      worldLiving.delete(w);
      prevDispose?.();
    };
  }
  return w;
}

/** Markers + fictional NPC figures for active hotspots in this chapter/time window; disposes replaced meshes cleanly. */
function dressWorld(w: World) {
  for (const n of ['markers', 'npcs']) {
    const o = w.scene.getObjectByName(n);
    if (o) {
      w.scene.remove(o);
      disposeObjectTree(o);
    }
  }
  const hs = chap().hotspots.filter(
    h => h.scene === w.id && (!h.requires || story.has(h.requires)) && isInTimeWindow(h, state.clockMin),
  );
  const big = SCENE_META[w.id]?.markerScale ?? 1;
  if (hs.length) {
    const marker = mergeParts([{ p: [0, 0, 0], s: [0.22, 0.22, 0.22], c: 0xffe08a, ry: 0.78 }]);
    const m = instanced(marker, glowMat(), hs.map(h => ({ x: h.pos[0], z: h.pos[1], y: 2.35 * big, s: big })));
    m.name = 'markers';
    w.scene.add(m);
  }
  const npcs = hs.filter(h => h.npc).map(h => {
    const nx = h.pos[0] + 0.9;
    const nz = h.pos[1] - 0.6;
    return {
      arch: resolveNpcArchetype({ id: h.id, label: h.label, npc: h.npc, scene: w.id }),
      x: nx,
      z: nz,
      ry: Math.atan2(-(h.pos[1] - nz), h.pos[0] - nx),
      hx: h.pos[0],
      hz: h.pos[1],
    };
  });
  if (npcs.length) {
    const parts = npcs.flatMap(n => place(buildNpcParts(n.arch, w.id), n.x, n.z, n.ry));
    const one = new THREE.Mesh(mergeParts(parts), litMat());
    one.name = 'npcs';
    w.scene.add(one);
  }
  const obs: Array<{ x: number; z: number; r: number; isBody?: boolean }> = [];
  for (const n of npcs) {
    obs.push({ x: n.x, z: n.z, r: 0.78, isBody: true });
    obs.push({ x: n.hx, z: n.hz, r: 0.62 });
  }
  w.scene.userData.__npcObstacles = obs;
}

function resolvePlayerColliders(w: World, pos: THREE.Vector2, playerR = 0.34): boolean {
  let pushed = false;
  const [minX, maxX, minZ, maxZ] = w.bounds;
  for (const c of w.colliders ?? []) {
    if (c.kind === 'box') {
      const cx = Math.max(c.minX, Math.min(c.maxX, pos.x));
      const cz = Math.max(c.minZ, Math.min(c.maxZ, pos.y));
      const dx = pos.x - cx;
      const dz = pos.y - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < playerR * playerR) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * playerR;
          pos.y = cz + (dz / d) * playerR;
        } else {
          // Inside box: push out along nearest edge
          const dL = pos.x - c.minX, dR = c.maxX - pos.x, dB = pos.y - c.minZ, dT = c.maxZ - pos.y;
          const m = Math.min(dL, dR, dB, dT);
          if (m === dL) pos.x = c.minX - playerR;
          else if (m === dR) pos.x = c.maxX + playerR;
          else if (m === dB) pos.y = c.minZ - playerR;
          else pos.y = c.maxZ + playerR;
        }
        pushed = true;
      }
    } else {
      const dx = pos.x - c.x;
      const dz = pos.y - c.z;
      const minD = c.r + playerR;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD * minD) {
        const d = Math.sqrt(d2) || 0.01;
        pos.x = c.x + (dx / d) * minD;
        pos.y = c.z + (dz / d) * minD;
        pushed = true;
      }
    }
  }
  const npcObs = (w.scene.userData.__npcObstacles as Array<{ x: number; z: number; r: number; isBody?: boolean }> | undefined) ?? [];
  for (const n of npcObs) {
    if (!n.isBody) continue;
    const dx = pos.x - n.x;
    const dz = pos.y - n.z;
    const minD = 0.34 + playerR;
    const d2 = dx * dx + dz * dz;
    if (d2 < minD * minD) {
      const d = Math.sqrt(d2) || 0.01;
      pos.x = n.x + (dx / d) * minD;
      pos.y = n.z + (dz / d) * minD;
      pushed = true;
    }
  }
  if (pushed) {
    pos.x = Math.min(maxX, Math.max(minX, pos.x));
    pos.y = Math.min(maxZ, Math.max(minZ, pos.y));
  }
  return pushed;
}

function refreshGuide(force = false) {
  if (!world) return;
  const target = findNextTarget(chap(), world.id, player.pos, k => story.has(k), state.taken ?? [], {
    clockMin: state.clockMin,
    photos: state.photos,
    evidence: state.evidence,
  });
  const key = `${state.chapter}:${world.id}:${(state.taken ?? []).length}:${state.clockMin ?? 0}:${target?.hotspot.id ?? ''}:${target?.distance ?? ''}:${autoGuide}:${playSpeed}`;
  if (!force && key === lastGuideKey) return;
  lastGuideKey = key;
  updateTimelineHud($('timeline'), $('guide-txt'), $('b-guide') as HTMLButtonElement, state.chapter, state.history, target, autoGuide, playSpeed);
}

function resolveScenePlayerMode(id: SceneId, vp: ViewpointId, override?: PlayerMode): PlayerMode {
  if (override) return override;
  const isWorker = vp === 'worker';
  const useTricycle = isWorker && (
    id === 'camp' ||
    id === 'blockade' ||
    (id === 'changan' && (state.chapter === 'w3-0520' || story.has('w2_has_tricycle'))) ||
    (id === 'street' && state.chapter === 'w2-0513')
  );
  if (useTricycle) return 'tricycle';
  if (id === 'street' || id === 'changan' || id === 'changan_rain') return 'bike';
  if (vp === 'journalist' && (id === 'beijing_hotel_balcony' || id === 'overpass' || id === 'xinhua_gate')) {
    return 'camera_walk';
  }
  return 'walk';
}

function playSceneStep(sceneId: SceneId) {
  const surface = SCENE_META[sceneId]?.stepSurface ?? 'stone';
  const mode = player.getMode();
  const riding = mode === 'bike' || mode === 'tricycle';
  playStep(surface === 'interior' ? false : riding);
}

function findLockedPhotoTargets(): PhotoTarget[] {
  const pts = chap()?.photoTargets ?? [];
  if (!pts.length || !world) return [];
  cam.getWorldDirection(camDirScratch);
  const fovDeg = cinemaCam.getMode() === 'viewfinder' ? cinemaCam.getLensFov() : cam.fov;
  const aspect = cam.aspect;
  const occluders = world.occluders;
  return pts.filter(pt => {
    if (pt.scene !== world.id) return false;
    if (pt.requires && !story.has(pt.requires)) return false;
    if (pt.minFov !== undefined && fovDeg < pt.minFov) return false;
    return isPhotoTargetInViewfinder(
      cam.position,
      camDirScratch,
      fovDeg,
      aspect,
      pt.pos3,
      pt.radius,
      pt.maxDist,
      occluders,
    );
  });
}

function renderActiveScene(timeSec = clock.elapsedTime) {
  const atmo = SCENE_META[world.id]?.atmosphere ?? world.atmosphere ?? 'night';
  postProcess.setOptions({ atmosphere: atmo, look: visualLook });
  postProcess.render(renderer, world.scene, cam, timeSec);
}

function capturePhoto() {
  if (!world) return { captured: [] as string[], matched: [] as string[], photos: [...(state.photos ?? [])], evidence: [...(state.evidence ?? [])] };
  const locked = findLockedPhotoTargets();
  const photos = (state.photos ??= []);
  const evidence = (state.evidence ??= []);
  const newlyCaptured: PhotoTarget[] = [];

  for (const pt of locked) {
    const hadPhoto = photos.includes(pt.id);
    if (!hadPhoto) {
      photos.push(pt.id);
      newlyCaptured.push(pt);
    }
    if (pt.evidenceId && !evidence.includes(pt.evidenceId)) {
      evidence.push(pt.evidenceId);
    }
    if (pt.event) {
      seen.add(pt.event);
      markSeenEvent(pt.event);
    }
  }

  playShutter();
  // Force a live graded render immediately before reading canvas pixels into the 35mm darkroom film strip
  renderActiveScene(clock.elapsedTime);
  const capList = (state.capturedPhotos ??= []);
  const primaryTarget = newlyCaptured[0] ?? locked[0];
  const shotRec = captureSilverGelatinPhoto(canvas, {
    id: primaryTarget?.id ?? `snap_${Date.now()}`,
    frameNo: capList.length + 1,
    chapterId: state.chapter,
    sceneId: world.id,
    dateLabel: $('date').textContent ?? chap().title ?? '',
    lensMm: cinemaCam.getLens(),
    caption: primaryTarget?.label ?? chap().labels[world.id] ?? world.id,
  });
  capList.push(shotRec);
  if (capList.length > 24) {
    const rmIdx = capList.findIndex(p => !p.selectedForPrint);
    capList.splice(rmIdx >= 0 ? rmIdx : 0, 1);
  }
  if (newlyCaptured.length > 0) {
    playShutterStinger();
    for (const pt of newlyCaptured) {
      const line = `底片紀錄：${pt.label}`;
      if (!state.diary.includes(line)) state.diary.push(line);
    }
    store(state);
    dressWorld(world);
    refreshGuide(true);
    vfCtrl?.triggerShutter(`已拍下：${newlyCaptured.map(p => p.label).join('、')}`);
  } else if (locked.length > 0) {
    store(state);
    vfCtrl?.triggerShutter(`已記錄過：${locked[0]!.label}`);
  } else {
    store(state);
    vfCtrl?.triggerShutter('底片已曝光存檔');
  }
  vfCtrl?.setFramesLeft(Math.max(0, 36 - photos.length));

  return {
    captured: newlyCaptured.map(p => p.id),
    matched: locked.map(p => p.id),
    photos: [...photos],
    evidence: [...evidence],
  };
}

function syncSceneView(id: SceneId, pos?: [number, number], snapCam = false) {
  const meta = SCENE_META[world.id] ?? SCENE_META[id];
  const p = pos ?? meta?.spawn ?? world.spawn;
  player.place(p[0], p[1]);
  if (pos && resolvePlayerColliders(world, player.pos)) {
    player.sync(0);
  }
  yaw = meta?.defaultYaw ?? 0;
  controls.resetOrbit();
  cam.far = meta?.camFar ?? 160;
  cam.updateProjectionMatrix();
  cinemaCam.onEnterScene(world.id, player, yaw);
  if (snapCam) {
    snap = true;
    cinemaCam.snapNow();
  }
}

function enter(id: SceneId, pos?: [number, number], modeOverride?: PlayerMode) {
  if (inDialog) closeDialog();
  if (cinemaCam.getMode() === 'viewfinder') setViewfinderActive(false);
  near = null;
  activeDialogTarget = null;
  closeSpeedMenu();
  if (world) world.scene.remove(player.mesh);
  world = getWorld(id);
  state.scene = world.id;
  dressWorld(world);
  world.scene.add(player.mesh);
  const meta = SCENE_META[world.id] ?? SCENE_META[id];
  const vp = viewpointOfChapter(state.chapter);
  activeViewpoint = vp;
  state.viewpoint = vp;
  const mode = resolveScenePlayerMode(world.id, vp, modeOverride);
  basePlayerMode = mode;
  player.setRoleMode(vp, mode);
  const p = pos ?? chap().spawn?.[id] ?? chap().spawn?.[world.id];
  syncSceneView(id, p, false);
  snap = Boolean(pos);
  $('date').textContent = chap().labels[world.id] ?? chap().labels[id] ?? '';
  setAudioScene(world.id, state.chapter, meta?.atmosphere ?? world.atmosphere);
  if (playing) setAudioMood(inDialog ? 'dialog' : 'explore');
  const surface = meta?.stepSurface ?? 'stone';
  if (playing && (mode === 'bike' || mode === 'tricycle') && !pos && surface !== 'interior') playBell();
  syncLensBtn();
  refreshGuide(true);
  store(state);
}

function fade(text: string, ms: number, mid: () => void) {
  isFading = true;
  document.body.classList.remove('letterbox-on');
  const inMs = Math.max(180, Math.round(900 / playSpeed));
  const outMs = Math.max(200, Math.round(ms / playSpeed));
  $('fadetxt').textContent = text;
  $('fade').classList.add('on');
  setTimeout(() => {
    mid();
    setTimeout(() => {
      $('fade').classList.remove('on');
      isFading = false;
    }, outMs);
  }, inMs);
}

function highlightAutoChoice() {
  if (!inDialog || !curNodeId) return;
  const n = story.node(curNodeId);
  const avail = story.available(n);
  const best = autoGuide ? pickAutoChoice(curNodeId, avail, chap(), world.id, k => story.has(k), state.taken ?? []) : null;
  const btns = [...$('ch').children] as HTMLButtonElement[];
  btns.forEach((b, idx) => b.classList.toggle('auto-pick', Boolean(best && avail[idx] === best)));
}

function targetPosOfHotspot(h: Hotspot | null): [number, number] | null {
  if (!h || h.scene !== world?.id) return null;
  return h.npc ? [h.pos[0] + 0.9, h.pos[1] - 0.6] : [h.pos[0], h.pos[1]];
}

const DEFAULT_STATIONS: ShortwaveStation[] = [
  {
    id: 'sw_cpbs',
    freqMhz: 7.35,
    label: '中央人民廣播電台（第一套節目）',
    band: '41m',
    transcript: '……請各地群眾保持正常工作與交通秩序，切勿輕信和傳播未經證實的消息。',
    confidence: 'documented',
  },
  {
    id: 'sw_beijing',
    freqMhz: 9.65,
    label: '北京人民廣播電台',
    band: '31m',
    transcript: '今日西單至復興門一線部分公共交通線路繞行或分段行駛，請市民留意路口通告。',
    confidence: 'testimony',
  },
  {
    id: 'sw_rumor',
    freqMhz: 11.85,
    label: '海外短波華語新聞重播',
    band: '25m',
    transcript: '外台引述不具名街頭傳言，部分細節尚無從獨立核實，只能記作對照參考。',
    confidence: 'uncertain',
    isRumor: true,
  },
];

function buildStationsForChapter(): ShortwaveStation[] {
  const ch = chap();
  const catalog = Object.values(ch?.evidenceCatalog ?? {});
  const radioCards = catalog.filter(
    c =>
      c.kind === 'audio_tape' ||
      c.tags?.some(t => /shortwave|radio|短波|電台/i.test(t)) ||
      /radio|shortwave|sw_|broadcast/i.test(c.id),
  );
  if (!radioCards.length) return DEFAULT_STATIONS;

  const presetFreqs = [6.15, 7.35, 9.65, 11.85, 13.85];
  return radioCards.map((c, idx) => {
    const mhzMatch = `${c.sourceLabel ?? ''} ${c.title}`.match(/(\d+(?:\.\d+)?)\s*MHz/i);
    const rawFreq = mhzMatch ? Number(mhzMatch[1]) : presetFreqs[idx % presetFreqs.length]!;
    const freqMhz = Math.max(4.8, Math.min(15.5, rawFreq));
    return {
      id: c.id,
      freqMhz,
      label: c.title,
      band: c.sourceLabel,
      transcript: c.summary,
      evidenceId: c.id,
      confidence: c.confidence ?? (c.kind === 'rumor' ? 'uncertain' : 'testimony'),
      isRumor: c.kind === 'rumor',
    };
  });
}

function openShortwaveModal(onComplete?: () => void) {
  const stations = buildStationsForChapter();
  openModal(
    '<div class="sw-modal-wrap"><h3>收聽短波收音機</h3><p class="small">緩慢轉動調頻旋鈕尋找清晰訊號，鎖定後可「記錄此段電台訊息」收錄為隨身線索。</p><div id="sw-host"></div></div>',
    false,
    'shortwave',
  );
  const mbody = $('mbody');
  const host = $('sw-host');
  let lockedStation: ShortwaveStation | null = null;
  let lastStaticAt = 0;

  modalCloseCallback = onComplete ?? null;

  const commitStation = (station: ShortwaveStation) => {
    if (station.evidenceId) {
      const evList = (state.evidence ??= []);
      if (!evList.includes(station.evidenceId)) evList.push(station.evidenceId);
    }
    const line = `短波筆記（${station.freqMhz.toFixed(2)} MHz・${station.label}）：${station.transcript}`;
    if (!state.diary.includes(line)) state.diary.push(line);
    store(state);
    dressWorld(world);
    refreshGuide(true);
    playPaper();
    const cb = modalCloseCallback;
    modalCloseCallback = null;
    closeModal(false);
    cb?.();
  };

  const onConfirmClick = (ev: Event) => {
    const btn = (ev.target as HTMLElement | null)?.closest('#sw-confirm') as HTMLButtonElement | null;
    if (!btn || btn.disabled || !lockedStation) return;
    commitStation(lockedStation);
  };
  mbody.addEventListener('click', onConfirmClick);

  startShortwaveAudio();
  const tunerCleanup = mountShortwaveTuner(host, stations, (station, freq, strength) => {
    lockedStation = station;
    const nearestDiff = stations.length
      ? Math.min(...stations.map(st => Math.abs(freq - st.freqMhz)))
      : 1.0;
    updateShortwaveAudio(freq, nearestDiff, strength);
    if (!station || strength < 0.55) {
      const now = performance.now();
      if (now - lastStaticAt > 240) {
        lastStaticAt = now;
        playRadioStatic(0.16);
      }
    }
  });

  const prevCleanup = modalCleanup;
  modalCleanup = () => {
    stopShortwaveAudio();
    mbody.removeEventListener('click', onConfirmClick);
    tunerCleanup();
    prevCleanup?.();
  };
}

function show(nodeId: string) {
  stopNarrator();
  closeSpeedMenu();
  if (cinemaCam.getMode() === 'viewfinder') setViewfinderActive(false);
  if (!inDialog) activeDialogTarget = targetPosOfHotspot(near);
  const n = story.node(nodeId);
  curNodeId = nodeId;
  inDialog = true;
  $('dlg').hidden = false;
  $('act').hidden = true;
  $('ambient-whisper').hidden = true;
  setAudioMood('dialog');
  const spName = story.speakerName(n.speaker);
  $('who').textContent = spName;
  const fullText = story.text(n);
  $('txt').textContent = fullText;
  playPaper();
  if (isNarratorEnabled()) {
    if (nodeId === chap().start) {
      playChapterVoiceover(state.chapter, fullText, { viewpoint: activeViewpoint, speaker: spName });
    } else {
      speakLine(fullText, { viewpoint: activeViewpoint, speaker: spName });
    }
  }
  const inspectBtn = $('dlg-inspect') as HTMLButtonElement;
  const curSceneId = world?.id;
  if (curSceneId === 'campus' || curSceneId === 'aftermath') {
    inspectBtn.hidden = false;
    inspectBtn.textContent = '細看布告欄';
    inspectBtn.onclick = () => {
      unlockAudio();
      void openArtifactModal('bulletin', () => show(nodeId));
    };
  } else if (curSceneId === 'newsroom') {
    inspectBtn.hidden = false;
    inspectBtn.textContent = '檢視排版清樣';
    inspectBtn.onclick = () => {
      unlockAudio();
      void openArtifactModal('typesetting', () => show(nodeId));
    };
  } else if (curSceneId === 'siheyuan_room') {
    inspectBtn.hidden = false;
    inspectBtn.textContent = '調試短波收音機';
    inspectBtn.onclick = () => {
      unlockAudio();
      void openArtifactModal('shortwave', () => show(nodeId));
    };
  } else {
    inspectBtn.hidden = true;
    inspectBtn.onclick = null;
  }
  if (n.event) {
    seen.add(n.event);
    markSeenEvent(n.event);
  }
  const sb = $('srcbtn');
  sb.hidden = !n.event || !EVENTS[n.event];
  sb.onclick = () => n.event && EVENTS[n.event] && openModal(eventHtml(EVENTS[n.event]));
  const ch = $('ch');
  ch.innerHTML = '';
  const avail = story.available(n);
  for (const c of avail) {
    const b = document.createElement('button');
    b.textContent = c.text;
    b.onclick = () => choose(c, nodeId);
    ch.appendChild(b);
  }
  dlgAutoElapsed = 0;
  dlgAutoPicked = false;
  dlgAutoDuration = Math.min(4.6, Math.max(1.9, 1.4 + fullText.length * 0.036));
  ($('dlg-fill') as HTMLElement).style.width = '0%';
  $('dlg-auto').hidden = !autoGuide;
  highlightAutoChoice();
}

function advanceAfterChoice(c: Choice) {
  if (c.next) return show(c.next);
  closeDialog();
  if (c.end) return ending(c.end);
  if (c.goto && c.goto !== world.id) {
    playTransitionChord();
    fade(chap().transitions[c.goto] ?? '……', 1200, () => enter(c.goto!, undefined, c.modeOverride));
    return;
  }
  if (c.mechanic === 'viewfinder' && !autoGuide) {
    setViewfinderActive(true);
  }
}

function choose(c: Choice, nodeId?: string) {
  dlgAutoPicked = true;
  story.apply(c, nodeId);
  store(state);
  refreshGuide(true);
  if (c.modeOverride) {
    basePlayerMode = c.modeOverride;
    if (cinemaCam.getMode() !== 'viewfinder') {
      player.setRoleMode(activeViewpoint, c.modeOverride);
    }
  }
  if (world && (!c.goto || c.goto === world.id) && (c.set || c.timeCost || c.worldEmit || (c.rel && Object.keys(c.rel).length))) {
    dressWorld(world);
  }
  if (c.mechanic === 'shortwave_dial' && !autoGuide) {
    closeDialog();
    openShortwaveModal(() => advanceAfterChoice(c));
    return;
  }
  advanceAfterChoice(c);
}

function closeDialog() {
  stopNarrator();
  inDialog = false;
  curNodeId = '';
  activeDialogTarget = null;
  $('dlg').hidden = true;
  if (playing && $('modal').hidden) setAudioMood(cinemaCam.getMode() === 'viewfinder' ? 'viewfinder' : 'explore');
}

function record() {
  return { ending: state.ending, taken: state.taken ?? [] };
}

function appendDiaryUnique(line: string) {
  if (!line) return;
  if (!state.diary.includes(line)) state.diary.push(line);
  store(state);
  refreshGuide(true);
}

function downloadKeepsakeNow() {
  void import('./ui/lianhuanhuaBook').then(({ downloadPersonalKeepsake }) => {
    downloadPersonalKeepsake(state, loadLedger());
  });
}

async function openArtifactModal(kind: 'bulletin' | 'typesetting' | 'shortwave', onBack?: () => void) {
  if (kind === 'shortwave') {
    openShortwaveModal(onBack);
    return;
  }
  playPaper();
  openModal('<p class="small">正在整理 1989 時代器物特寫……</p>', true, 'artifact');
  const req = modalReqToken;
  const { mountBulletinBoardInspector, mountTypesettingDesk } = await import('./ui/tactileObjects');
  if (req !== modalReqToken || $('modal').hidden) return;
  if (kind === 'bulletin') {
    modalCleanup = mountBulletinBoardInspector($('mbody'), {
      aftermath: world?.id === 'aftermath',
      onNoteSave: appendDiaryUnique,
      onBack: onBack ? () => { closeModal(false); onBack(); } : undefined,
    });
  } else {
    modalCleanup = mountTypesettingDesk($('mbody'), {
      dateLabel: $('date').textContent ?? chap().title,
      onSaveProof: appendDiaryUnique,
      onBack: onBack ? () => { closeModal(false); onBack(); } : undefined,
    });
  }
}

function openLianhuanhuaBookModal(onBack?: () => void) {
  playPaper();
  openModal('<p class="small">正在開啟六十四開連環畫冊……</p>', true, 'book');
  const req = modalReqToken;
  void import('./ui/lianhuanhuaBook').then(({ mountLianhuanhuaBook }) => {
    if (req !== modalReqToken || $('modal').hidden) return;
    modalCleanup = mountLianhuanhuaBook($('mbody'), {
      viewpoint: playing ? activeViewpoint : viewpointOfChapter(state.chapter),
      state,
      ledger: loadLedger(),
      onBack,
    });
  });
}

function openReel(chapterId: string, onBack?: () => void, playAll = false, mode?: 'chapter' | 'route' | 'interwoven') {
  openModal('<p class="small">正在載入連環畫紀錄短片……</p>', true);
  setAudioMood('reel');
  const req = modalReqToken;
  const reelState = playing ? state : (load(viewpointOfChapter(chapterId)) ?? undefined);
  void import('./ui/documentaryReel').then(({ mountDocumentaryReel }) => {
    if (req !== modalReqToken || $('modal').hidden) return;
    modalCleanup = mountDocumentaryReel($('mbody'), chapterId, reelState?.diary ?? state.diary, onBack, {
      playAll,
      mode,
      speed: playSpeed,
      ledger: loadLedger(),
      state: reelState,
      onSpeedChange: s => setPlaySpeed(s),
      onOpenBook: () => openLianhuanhuaBookModal(() => openReel(chapterId, onBack, playAll, mode)),
    });
  });
}

function promptSnapshotDrift(
  vp: ViewpointId,
  chId: string,
  snapSave: SaveState,
  drift: SnapshotDriftResult,
  onCancel?: () => void,
) {
  const chTitle = CH[chId]?.title ?? chId;
  const flagList = drift.changedFlags
    .map(id => `<li>${esc(WORLD_FLAGS[id]?.description ?? id)}</li>`)
    .join('');
  openModal(
    `<h2>偵測到世界線因果變動</h2>
     <p>準備載入「<strong>${esc(chTitle)}</strong>」（${esc(VIEWPOINT_LABELS[vp]?.short ?? vp)}）的章節快照。</p>
     <p class="small">自 <strong>${esc(drift.staleFromDay ?? dayKeyOf(chId))}</strong> 起，其他視角線已留下新的世界線因果紀錄：</p>
     <ul>${flagList || '<li class="small">已記錄新的跨線狀態</li>'}</ul>
     <p class="small">請選擇要將世界線最新因果同步至此章節快照，或維持當時快照原樣重玩（兩者皆不會刪除您已完成的章節紀錄）：</p>
     <div class="row">
       <button id="snap-sync" type="button">更新世界線因果</button>
       <button id="snap-keep" type="button">僅重玩此章快照</button>
       <button id="snap-cancel" type="button">取消</button>
     </div>`,
    false,
    'drift',
  );
  $('snap-sync').onclick = () => {
    unlockAudio();
    recordSnapshot(snapSave, dayKeyOf(chId));
    if (playing) store(state);
    closeModal(false);
    start(snapSave, true);
  };
  $('snap-keep').onclick = () => {
    unlockAudio();
    if (playing) store(state);
    closeModal(false);
    start(snapSave, true);
  };
  $('snap-cancel').onclick = () => {
    closeModal(false);
    onCancel?.();
  };
}

function buildJumpSave(vp: ViewpointId, chId: string, forceSnapshot = false): { save: SaveState; intro: boolean; fromSnapshot: boolean } {
  const savedRoute = load(vp);
  const snapStart = starts()[chId];
  if (!forceSnapshot && vp !== activeViewpoint && savedRoute && savedRoute.chapter === chId && !savedRoute.ending) {
    return { save: savedRoute, intro: false, fromSnapshot: false };
  }
  if (snapStart) {
    const copy = JSON.parse(JSON.stringify(snapStart)) as SaveState;
    if (!copy.scene) copy.scene = startSceneFor(chId);
    return { save: copy, intro: true, fromSnapshot: true };
  }
  const base = (vp === activeViewpoint ? state : savedRoute) ?? fresh(vp);
  const copy = JSON.parse(JSON.stringify(base)) as SaveState;
  copy.v = 2;
  copy.viewpoint = vp;
  copy.chapter = chId;
  copy.scene = startSceneFor(chId);
  copy.ending = undefined;
  copy.taken = [];
  if (CH[chId]?.clockStart !== undefined) copy.clockMin = CH[chId]!.clockStart!;
  return { save: copy, intro: true, fromSnapshot: false };
}

function jumpToChapter(vp: ViewpointId, chId: string, driftAction?: 'sync' | 'keep') {
  if (!CH[chId]) return;
  if (!driftAction && playing && vp === activeViewpoint && chId === state.chapter) {
    closeModal(false);
    return;
  }
  const { save: targetSave, intro, fromSnapshot } = buildJumpSave(vp, chId, Boolean(driftAction));
  if (driftAction === 'sync') {
    recordSnapshot(targetSave, dayKeyOf(chId));
    if (playing && vp === activeViewpoint && chId === state.chapter) {
      openMapModal();
      return;
    }
  } else if (!driftAction && fromSnapshot) {
    const drift = checkSnapshotDrift(targetSave, dayKeyOf(chId));
    if (drift.hasDrift) {
      promptSnapshotDrift(vp, chId, targetSave, drift, () => {
        if (playing) openMapModal();
      });
      return;
    }
  }
  if (playing) store(state);
  closeModal(false);
  playTransitionChord();
  fade(CH[chId]?.title ?? '', 1100, () => start(targetSave, intro));
}

function openDiaryModal(initialTab?: 'diary' | 'evidence' | 'characters' | 'darkroom') {
  if (!playing) return;
  playPaper();
  openModal('', true, 'diary');
  modalCleanup = mountDiaryModal(
    $('mbody'),
    chap(),
    state,
    loadLedger(),
    res => {
      const dossiers = (state.dossiers ??= []);
      if (!dossiers.includes(res.id)) dossiers.push(res.id);
      if (res.diary && !state.diary.includes(res.diary)) state.diary.push(res.diary);
      if (res.set && !state.flags.includes(res.set)) {
        state.flags.push(res.set);
        dressWorld(world);
      }
      for (const cid of res.cards) {
        const cardEl = $('mbody').querySelector(`.ev-card-btn[data-card-id="${cid}"] .ev-card`);
        cardEl?.classList.add('paired');
      }
      store(state);
      refreshGuide(true);
    },
    () => store(state),
  );
  if (initialTab) {
    $('mbody').querySelector<HTMLButtonElement>(`[data-diary-tab="${initialTab}"]`)?.click();
  }
}

function openMapModal() {
  if (!playing) return;
  playPaper();
  openModal('', true, 'map');
  modalCleanup = mountMapTimelineModal($('mbody'), ROUTES, activeViewpoint, state.chapter, state, loadLedger(), {
    onTravelScene: sceneId => {
      closeModal(false);
      if (sceneId !== world.id) {
        playTransitionChord();
        fade(chap().transitions[sceneId] ?? '前往此處……', 900, () => enter(sceneId));
      }
    },
    onJumpChapter: (vp, chId) => {
      jumpToChapter(vp, chId);
    },
    onResolveDrift: (vp, chId, action) => {
      jumpToChapter(vp, chId, action);
    },
  });
}

function bindRashomonJumps(container: HTMLElement) {
  container.querySelectorAll<HTMLButtonElement>('.rashomon-jump[data-jump-vp][data-jump-ch]').forEach(btn => {
    btn.onclick = () => {
      const vp = btn.dataset.jumpVp as ViewpointId | undefined;
      const chId = btn.dataset.jumpCh;
      if (vp && chId) jumpToChapter(vp, chId);
    };
  });
}

function ending(id: string) {
  clearEndAutoTimer();
  if (cinemaCam.getMode() === 'viewfinder') setViewfinderActive(false);
  const c = chap();
  const e = c.endings[id];
  const ord = activeOrder();
  const flag = short(c.chapter) + ':end:' + id;
  const nextId = ord[ord.indexOf(c.chapter) + 1];
  const countWord = ord.length === 6 ? '六' : ord.length === 8 ? '八' : String(ord.length);
  const diary = state.diary.map(d => `<li>${esc(d)}</li>`).join('');
  const ep = c.epilogueEvent && EVENTS[c.epilogueEvent] ? ` <a href="#" id="epsrc">（史料）</a>` : '';
  const nextBtn = nextId
    ? `<button id="nextch">下一章：${esc(CH[nextId].title)}</button>`
    : `<button id="chronicle">查看完整春日紀事（全${countWord}章總結）</button>`;
  const autoBar = autoGuide
    ? `<div class="auto-end-bar" id="auto-end-bar"><span>🧭 自動引導中（${playSpeed}x）：即將自動前往${nextId ? '下一章' : '完整春日紀事'}…</span><button id="auto-end-stop" type="button">暫停自動引導</button></div>`
    : '';
  openModal(
    `<div id="end-cine"></div>${autoBar}<h2>${esc(e.title)}</h2><p>${esc(e.text)}</p><p class="small">${esc(c.epilogue)}${ep}</p>
    <div class="row">${nextBtn}<button id="flow">分支圖</button></div>
    <h4>日記</h4><ol>${diary}</ol><div class="row"><button id="replay">重玩本章</button><button id="again">從頭開始</button></div>`,
  );
  playEndingStinger();
  setAudioMood('ending');
  const endReq = modalReqToken;
  void import('./ui/reelArtwork').then(({ mountChapterBanner }) => {
    if (endReq !== modalReqToken || $('modal').hidden) return;
    const cineHost = document.getElementById('end-cine');
    if (cineHost) {
      modalCleanup = mountChapterBanner(cineHost, c.chapter, {
        onPlayReel: () => openReel(c.chapter, () => ending(id)),
      });
    }
  });
  const stopBtn = document.getElementById('auto-end-stop');
  if (stopBtn) {
    stopBtn.onclick = () => {
      setAutoGuide(false);
      document.getElementById('auto-end-bar')?.remove();
    };
  }
  if (c.epilogueEvent && EVENTS[c.epilogueEvent]) {
    $('epsrc').onclick = ev => {
      ev.preventDefault();
      seen.add(c.epilogueEvent!);
      markSeenEvent(c.epilogueEvent!);
      openModal(eventHtml(EVENTS[c.epilogueEvent!]));
    };
  }
  $('flow').onclick = () => openModal('<h2>分支圖</h2>' + flowHtml(c, record()));
  $('replay').onclick = () => {
    const s0 = starts()[c.chapter];
    if (s0) {
      closeModal(false);
      start(JSON.parse(JSON.stringify(s0)), true);
    }
  };
  $('again').onclick = () => {
    clear(viewpointOfChapter(state.chapter));
    location.reload();
  };
  if (nextId) {
    $('nextch').onclick = () => {
      clearEndAutoTimer();
      const h = (state.history ??= {});
      h[c.chapter] = record();
      if (!state.flags.includes(flag)) state.flags.push(flag);
      // Persist SaveState v2 inventory, keepsakes, evidence, dossiers, photos, and clock across chapters.
      state.chapter = nextId;
      state.ending = undefined;
      state.taken = [];
      state.scene = startSceneFor(nextId);
      if (CH[nextId]?.clockStart !== undefined) state.clockMin = CH[nextId]!.clockStart!;
      storeStart(state);
      closeModal(false);
      playTransitionChord();
      fade(CH[nextId].title, 1400, () => start(state, true));
    };
  } else {
    $('chronicle').onclick = () => {
      clearEndAutoTimer();
      openModal(fullSpringChronicleHtml(CH, ord, state, record(), loadLedger()), true);
      bindRashomonJumps($('mbody'));
      $('chron-back').onclick = () => ending(id);
      $('chron-src').onclick = () => openModal(allSourcesHtml([...seen], loadLedger()));
      document.getElementById('chron-darkroom')?.addEventListener('click', () => openDiaryModal('darkroom'));
      document.getElementById('chron-book')?.addEventListener('click', () => openLianhuanhuaBookModal(() => ending(id)));
      document.getElementById('chron-export')?.addEventListener('click', () => downloadKeepsakeNow());
    };
  }
  if (autoGuide) {
    endAutoTimer = window.setTimeout(() => {
      endAutoTimer = null;
      if (!autoGuide || $('modal').hidden) return;
      const btn = document.getElementById(nextId ? 'nextch' : 'chronicle') as HTMLButtonElement | null;
      btn?.click();
    }, Math.max(900, Math.round(3500 / playSpeed)));
  }
}

function closeModal(fromUserClose = false) {
  modalReqToken++;
  clearEndAutoTimer();
  const onUserClose = fromUserClose ? modalCloseCallback : null;
  modalCloseCallback = null;
  activeModalKind = '';
  modalCleanup?.();
  modalCleanup = null;
  $('modal').hidden = true;
  ($('modal').firstElementChild as HTMLElement | null)?.classList.remove('wide');
  setAudioMood(playing ? (inDialog ? 'dialog' : cinemaCam.getMode() === 'viewfinder' ? 'viewfinder' : 'explore') : 'title');
  onUserClose?.();
}

function openModal(html: string, wide = false, kind: '' | 'map' | 'diary' | 'shortwave' | 'drift' | 'book' | 'artifact' = '') {
  modalReqToken++;
  stopNarrator();
  closeSpeedMenu();
  if (cinemaCam.getMode() === 'viewfinder') setViewfinderActive(false);
  document.body.classList.remove('letterbox-on');
  clearEndAutoTimer();
  modalCloseCallback = null;
  modalCleanup?.();
  modalCleanup = null;
  activeModalKind = kind;
  const card = $('modal').firstElementChild as HTMLElement | null;
  card?.classList.toggle('wide', wide);
  $('mbody').innerHTML = html;
  $('modal').hidden = false;
  if (card) card.scrollTop = 0;
}

$('mclose').onclick = () => closeModal(true);
$('b-auto').onclick = () => {
  unlockAudio();
  setAutoGuide(!autoGuide);
};
$('b-speed').onclick = e => {
  e.stopPropagation();
  unlockAudio();
  $('speed-menu').hidden = !$('speed-menu').hidden;
};
document.addEventListener('pointerdown', e => {
  if (!$('speed-menu').hidden && !$('speed-wrap').contains(e.target as Node)) {
    closeSpeedMenu();
  }
});
document.querySelectorAll<HTMLButtonElement>('#speed-menu .spd-opt[data-speed]').forEach(btn => {
  btn.onclick = e => {
    e.stopPropagation();
    unlockAudio();
    setPlaySpeed(Number(btn.dataset.speed));
    closeSpeedMenu();
  };
});
document.querySelectorAll<HTMLButtonElement>('#dlg-speeds .dlg-spd-opt[data-speed]').forEach(btn => {
  btn.onclick = () => {
    unlockAudio();
    setPlaySpeed(Number(btn.dataset.speed));
  };
});
$('dlg-speed').onclick = () => {
  unlockAudio();
  cyclePlaySpeed();
};
$('b-cam').onclick = () => {
  unlockAudio();
  cinemaCam.cycleMode();
  syncCamUi();
};
controls.onCamMode = () => {
  if (!playing || !$('modal').hidden) return;
  unlockAudio();
  cinemaCam.cycleMode();
  syncCamUi();
};
controls.onSpeedDelta = delta => {
  if (!playing || !$('modal').hidden) return;
  unlockAudio();
  stepSpeedDelta(delta);
};
$('b-audio').onclick = () => {
  const on = toggleAudio();
  $('b-audio').textContent = on ? '聲音：開' : '聲音：關';
};
$('b-map').onclick = () => {
  unlockAudio();
  openMapModal();
};
$('b-lens').onclick = () => {
  unlockAudio();
  setViewfinderActive(cinemaCam.getMode() !== 'viewfinder');
};
$('b-reel').onclick = () => {
  unlockAudio();
  openReel(state.chapter);
};
$('b-book').onclick = () => {
  unlockAudio();
  openLianhuanhuaBookModal();
};
$('dlg-speak').onclick = () => {
  unlockAudio();
  const txt = $('txt').textContent ?? '';
  if (txt) speakLine(txt, { viewpoint: activeViewpoint, speaker: $('who').textContent ?? '' });
};
$('b-diary').onclick = () => {
  unlockAudio();
  openDiaryModal();
};
$('b-turn').onclick = () => {
  yaw = (yaw + Math.PI / 2) % (Math.PI * 2);
};
$('b-src').onclick = () => openModal(allSourcesHtml([...seen], loadLedger()));
$('b-menu').onclick = () => {
  const vp = viewpointOfChapter(state.chapter);
  const vpInfo = VIEWPOINT_LABELS[vp] ?? { short: vp, role: vp, lead: '' };
  const ord = activeOrder();
  const countWord = ord.length === 6 ? '六' : ord.length === 8 ? '八' : String(ord.length);
  const switchBtns = VIEWPOINTS.filter(v => v.id !== vp).map(v => {
    const info = VIEWPOINT_LABELS[v.id];
    const hasChapters = v.playable && orderForViewpoint(v.id).length > 0;
    return hasChapters
      ? `<button type="button" data-mswitch="${v.id}">切換：${esc(info.short)}（${esc(info.lead)}）</button>`
      : `<button type="button" disabled title="敬請期待">切換：${esc(info.short)}（敬請期待）</button>`;
  }).join('');

  const lookBtns = (['filmic', 'mono', 'lianhuanhua'] as const).map(lk =>
    `<button type="button" class="m-look-btn${visualLook === lk ? ' on' : ''}" data-mlook="${lk}">${LOOK_LABELS[lk]}</button>`
  ).join('');

  openModal(
    `<h2>選單（${esc(vpInfo.short)}・${esc(vpInfo.lead)}）</h2>
     <p class="small">進度會自動分別儲存在這台裝置上。可隨時開啟「暗房底片」、翻閱「六十四開連環畫冊」、匯出可列印紀念冊，或細看 1989 時代實物與調整無障礙顯示。</p>
     <div class="row" style="margin-bottom:8px">
       <span class="small" style="align-self:center">畫面影調 (G)：</span>
       ${lookBtns}
     </div>
     <div class="row" style="margin-bottom:8px">
       <span class="small" style="align-self:center">1989 時代器物特寫：</span>
       <button id="mart-bulletin" type="button">三角地布告欄</button>
       <button id="mart-typeset" type="button">夜班鉛字排版桌</button>
       <button id="mart-radio" type="button">牡丹牌短波收音機</button>
     </div>
     <div class="row">
       <button id="mopening" type="button">重播電影序幕</button>
       <button id="mwatchall">觀看本篇全${countWord}章影片</button>
       <button id="minterwoven">🎞 四線交織編年長片</button>
       <button id="mreel">播放本章紀錄短片</button>
       <button id="mbook">翻閱連環畫冊</button>
       <button id="mdarkroom">暗房底片（${state.capturedPhotos?.length ?? 0}）</button>
       <button id="mexport">匯出個人紀念冊</button>
       <button id="mnarrator">紀實旁白：${isNarratorEnabled() ? '開' : '關'}</button>
       <button id="mmap">地圖 / 時間軸</button>
       ${switchBtns}
       <button id="mflow">分支圖</button>
       <button id="restart">本篇從頭開始</button>
     </div>
     <h3 style="margin:12px 0 6px;font-size:15px;color:#f3ead2">顯示・旁白・操控設定</h3>
     ${renderSettingsPanelHtml(appSettings)}
     <p class="small">所有說話的人物皆為虛構。程式 © 2026 李家宝。</p>`,
  );
  modalCleanup = bindSettingsPanel($('mbody'), appSettings, next => applyAppSettings(next));
  $('mart-bulletin').onclick = () => void openArtifactModal('bulletin');
  $('mart-typeset').onclick = () => void openArtifactModal('typesetting');
  $('mart-radio').onclick = () => void openArtifactModal('shortwave');
  $('mopening').onclick = () => {
    unlockAudio();
    closeModal(false);
    openingPrelude.play(0);
  };
  $('mwatchall').onclick = () => openReel(ord[0]!, undefined, true);
  $('minterwoven').onclick = () => openReel(ord[0]!, undefined, true, 'interwoven');
  $('mreel').onclick = () => openReel(state.chapter);
  $('mbook').onclick = () => openLianhuanhuaBookModal();
  $('mdarkroom').onclick = () => openDiaryModal('darkroom');
  $('mexport').onclick = () => downloadKeepsakeNow();
  $('mnarrator').onclick = () => {
    const on = toggleNarrator();
    $('mnarrator').textContent = `紀實旁白：${on ? '開' : '關'}`;
  };
  $('mbody').querySelectorAll<HTMLButtonElement>('[data-mlook]').forEach(btn => {
    btn.onclick = () => {
      const lk = btn.dataset.mlook as VisualLook;
      applyVisualLook(lk);
      $('mbody').querySelectorAll<HTMLButtonElement>('[data-mlook]').forEach(b => b.classList.toggle('on', b === btn));
    };
  });
  $('mmap').onclick = () => openMapModal();
  $('mbody').querySelectorAll<HTMLButtonElement>('[data-mswitch]').forEach(btn => {
    btn.onclick = () => {
      const nextVp = btn.dataset.mswitch as ViewpointId;
      store(state);
      const nextSave = load(nextVp);
      closeModal(false);
      start(nextSave ?? fresh(nextVp), !nextSave);
    };
  });
  $('mflow').onclick = () => openModal('<h2>分支圖</h2>' + flowMultiChapterHtml(CH, ord, state.chapter, record(), state.history));
  $('restart').onclick = () => {
    clear(viewpointOfChapter(state.chapter));
    location.reload();
  };
};

$('b-guide').onclick = () => {
  unlockAudio();
  if (!playing || inDialog || !$('modal').hidden) return;
  if (cinemaCam.getMode() === 'viewfinder') setViewfinderActive(false);
  const target = findNextTarget(chap(), world.id, player.pos, k => story.has(k), state.taken ?? [], {
    clockMin: state.clockMin,
    photos: state.photos,
    evidence: state.evidence,
  });
  if (!target) return;
  const h = target.hotspot;
  const [minX, maxX, minZ, maxZ] = world.bounds;
  if (h.scene !== world.id) {
    playTransitionChord();
    fade(chap().transitions[h.scene] ?? '前往下一處……', 900, () => {
      enter(h.scene, [h.pos[0], h.pos[1] - 1.2]);
    });
  } else {
    const tx = Math.max(minX + 0.5, Math.min(maxX - 0.5, h.pos[0]));
    const tz = Math.max(minZ + 0.5, Math.min(maxZ - 0.5, h.pos[1] - 1.2));
    player.place(tx, tz);
    if (resolvePlayerColliders(world, player.pos)) {
      player.sync(0);
    }
    snap = false;
    playSceneStep(world.id);
    refreshGuide(true);
  }
};

controls.onInteract = () => {
  unlockAudio();
  if (!playing || !$('modal').hidden || isFading) return;
  if (cinemaCam.getMode() === 'viewfinder') {
    capturePhoto();
    return;
  }
  if (!inDialog && near) {
    const h = near;
    const startNode = chap().nodes[h.start];
    const choiceHasDial = Boolean(startNode?.choices?.some(c => c.mechanic === 'shortwave_dial'));
    if (h.mechanic === 'shortwave_dial' && !autoGuide && !choiceHasDial) {
      openShortwaveModal(() => {
        if (playing && $('modal').hidden && !inDialog) show(h.start);
      });
    } else {
      show(h.start);
    }
  }
};

addEventListener('keydown', e => {
  if (openingPrelude.isActive()) return;
  unlockAudio();
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const el = e.target as HTMLElement | null;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;

  const k = e.key.toLowerCase();
  if (k === 'm') {
    if (!playing || inDialog || isFading) return;
    if (!$('modal').hidden) {
      if (activeModalKind === 'map') closeModal(true);
      return;
    }
    openMapModal();
  } else if (k === 'f') {
    if (!playing || inDialog || !$('modal').hidden || isFading) return;
    setViewfinderActive(cinemaCam.getMode() !== 'viewfinder');
  } else if (k === 'g') {
    if (!playing || !$('modal').hidden || isFading) return;
    cycleVisualLook();
  } else if (k === 'escape') {
    if (!$('modal').hidden) {
      closeModal(true);
    } else if (cinemaCam.getMode() === 'viewfinder') {
      setViewfinderActive(false);
    }
  } else if (cinemaCam.getMode() === 'viewfinder') {
    if (k === 'v') {
      const mm = cinemaCam.cycleLens();
      vfCtrl?.setLens(mm);
    } else if (k === '1' || k === '2' || k === '3') {
      const mapLens: Record<string, LensMm> = { '1': 35, '2': 50, '3': 85 };
      const mm = mapLens[k]!;
      cinemaCam.setLens(mm);
      vfCtrl?.setLens(mm);
    }
  }
});

let started = false;
$('act').onclick = () => controls.onInteract();
$('stick').addEventListener('pointerdown', () => unlockAudio(), { passive: true });

function start(s: SaveState, intro: boolean) {
  if (cinemaCam.getMode() === 'viewfinder') setViewfinderActive(false);
  const vp = s.viewpoint ?? viewpointOfChapter(s.chapter);
  activeViewpoint = vp;
  state = s;
  state.v = 2;
  state.viewpoint = vp;
  state.taken ??= [];
  state.history ??= {};
  state.keepsakes ??= [];
  state.evidence ??= [];
  state.dossiers ??= [];
  state.photos ??= [];
  story = new Story(chap(), state, dayKeyOf(state.chapter));
  if (intro && !starts()[state.chapter]) storeStart(state);
  $('title').hidden = true;
  $('hud').hidden = false;
  $('stick').hidden = false;
  playing = true;
  started = true;
  closeSpeedMenu();
  closeModal(false);
  closeDialog();
  $('b-audio').textContent = isAudioOn() ? '聲音：開' : '聲音：關';
  syncAutoUi();
  enter(state.scene || startSceneFor(state.chapter));
  if (intro) show(chap().start);
  else if (state.ending) ending(state.ending);
}

function countWordOf(n: number): string {
  return n === 6 ? '六' : n === 8 ? '八' : String(n);
}

function isViewpointPlayable(vp: ViewpointId): boolean {
  const entry = VIEWPOINTS.find(v => v.id === vp);
  return Boolean((entry ? entry.playable : true) && orderForViewpoint(vp).length > 0);
}

function vpDescFor(vp: ViewpointId): string {
  const chCount = orderForViewpoint(vp).length || (ROUTES[vp]?.length ?? 6);
  const countWord = countWordOf(chCount);
  const soonSuffix = isViewpointPlayable(vp) ? '' : '（敬請期待）';
  const base: Record<ViewpointId, string> = {
    student: `第一篇（全${countWord}章線性紀事・4/17 ➔ 6/05）：你是一名虛構的北京大學物理系學生「陳立」，從宿舍三角地出發，見證七週的街頭與廣場，並體驗「自動引導」與「全${countWord}章故事影片」。`,
    worker: `第二篇（全${countWord}章線性紀事・4/17 ➔ 6/05）：你是一名虛構的北京第二機床廠五級車工「王建國（王師傅）」，從鋸齒天窗廠房與胡同大雜院出發，蹬著平板三輪車走過這個春天。`,
    journalist: `第三篇（全${countWord}章線性紀事・4/17 ➔ 6/05）：你是一名虛構的《首都晨報》記者「顧明遠」，帶著 35mm 相機與採訪筆記穿梭編輯部、北京飯店陽台與警戒線，以鏡頭與交叉比對記錄現場。`,
    resident: `第四篇（全${countWord}章線性紀事・4/17 ➔ 6/05）：你是一名虛構的西單四合院退休廠醫務室護師「沈淑芬」，提著菜籃、無菌紗布包與短波收音機，守望胡同街坊與早市日常。`,
  };
  return base[vp] + soonSuffix;
}

const VP_CARD_META: Record<ViewpointId, { heading: string; roleLine: string }> = {
  student: { heading: '第一篇・學生視角（陳立）', roleLine: '北大物理系學生' },
  worker: { heading: '第二篇・工人視角（王建國）', roleLine: '北京第二機床廠車工' },
  journalist: { heading: '第三篇・記者視角（顧明遠）', roleLine: '首都晨報記者' },
  resident: { heading: '第四篇・市民視角（沈淑芬）', roleLine: '西單四合院退休護師' },
};

function renderViewpointButtons() {
  const wrap = $('vp-switch');
  wrap.innerHTML = '';
  const list = VIEWPOINTS.length
    ? VIEWPOINTS
    : [
        { id: 'student' as ViewpointId, zh: '學生', en: 'Student', playable: true },
        { id: 'worker' as ViewpointId, zh: '工人', en: 'Worker', playable: true },
        { id: 'journalist' as ViewpointId, zh: '記者', en: 'Journalist', playable: true },
        { id: 'resident' as ViewpointId, zh: '市民', en: 'Resident', playable: true },
      ];

  for (const vpMeta of list) {
    const playable = Boolean(vpMeta.playable && orderForViewpoint(vpMeta.id).length > 0);
    const chCount = orderForViewpoint(vpMeta.id).length || (ROUTES[vpMeta.id]?.length ?? 6);
    const countWord = countWordOf(chCount);
    const meta = VP_CARD_META[vpMeta.id] ?? {
      heading: `${vpMeta.zh}視角（${VIEWPOINT_LABELS[vpMeta.id]?.lead ?? vpMeta.id}）`,
      roleLine: VIEWPOINT_LABELS[vpMeta.id]?.short ?? vpMeta.zh,
    };
    const sub = `${meta.roleLine}｜4/17 — 6/05 全${countWord}章`;
    const btn = document.createElement('button');
    btn.id = `vp-${vpMeta.id}`;
    btn.type = 'button';
    btn.className = `vp-btn${vpMeta.id === activeViewpoint ? ' active' : ''}${playable ? '' : ' soon'}`;
    btn.dataset.vp = vpMeta.id;
    btn.disabled = !playable;
    if (!playable) btn.title = '敬請期待';
    btn.innerHTML = `<strong>${esc(meta.heading)}${playable ? '' : ' <em class="vp-soon">敬請期待</em>'}</strong><span>${esc(sub)}${playable ? '' : '｜敬請期待'}</span>`;
    btn.onclick = () => {
      if (!playable) return;
      unlockAudio();
      activeViewpoint = vpMeta.id;
      renderTitleViewpoint();
    };
    wrap.appendChild(btn);
  }
}

function previewTitleViewpoint(vp: ViewpointId) {
  const previewMap: Record<ViewpointId, [SceneId, number, number]> = {
    student: ['campus', 0, 5],
    worker: ['factory', 0, 10],
    journalist: ['newsroom', 0, 5],
    resident: ['courtyard', 0, 2],
  };
  const [sid, px, pz] = previewMap[vp];
  if (world) world.scene.remove(player.mesh);
  world = getWorld(sid);
  world.scene.add(player.mesh);
  player.setRoleMode(vp, resolveScenePlayerMode(sid, vp));
  syncSceneView(sid, [px, pz], true);
}

function renderTitleViewpoint() {
  const playableVps = VIEWPOINTS.filter(v => v.playable && orderForViewpoint(v.id).length > 0);
  if (playableVps.length && !playableVps.some(v => v.id === activeViewpoint)) {
    activeViewpoint = playableVps[0]!.id;
  }

  const saved = load(activeViewpoint);
  const startId = firstChapterFor(activeViewpoint);
  const ord = orderForChapter(startId);
  const countWord = countWordOf(ord.length || 6);

  document.querySelectorAll<HTMLButtonElement>('#vp-switch .vp-btn[data-vp]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.vp === activeViewpoint);
  });

  $('vp-desc').textContent = vpDescFor(activeViewpoint);
  $('b-watch-all').textContent = `觀看全${countWord}章故事影片`;
  $('b-cont').hidden = !saved;
  if (!playing && world) previewTitleViewpoint(activeViewpoint);

  const st0 = starts();
  const sel = ord.filter(id => st0[id]);
  if (sel.length > 1) {
    $('chsel').hidden = false;
    $('chsel').innerHTML =
      '<p class="small">選擇章節（從該章開頭重玩，沿用當時的前情）</p>' +
      sel.map(id => {
        const drift = checkSnapshotDrift(st0[id]!, dayKeyOf(id));
        const badge = drift.hasDrift ? ' <span class="tag testimony">世界線有更新</span>' : '';
        return `<button data-ch="${esc(id)}">${esc(CH[id]?.title ?? id)}${badge}</button>`;
      }).join('');
    $('chsel').querySelectorAll('button').forEach(b => {
      (b as HTMLButtonElement).onclick = () => {
        unlockAudio();
        const chId = (b as HTMLElement).dataset.ch!;
        const snapSave = JSON.parse(JSON.stringify(st0[chId])) as SaveState;
        if (!snapSave.scene) snapSave.scene = startSceneFor(chId);
        const drift = checkSnapshotDrift(snapSave, dayKeyOf(chId));
        if (drift.hasDrift) {
          promptSnapshotDrift(viewpointOfChapter(chId), chId, snapSave, drift);
          return;
        }
        start(snapSave, true);
      };
    });
  } else {
    $('chsel').hidden = true;
    $('chsel').innerHTML = '';
  }
}

$('title').addEventListener('pointerdown', () => unlockAudio(), { passive: true });
$('b-new').onclick = () => {
  unlockAudio();
  setAutoGuide(false);
  clear(activeViewpoint);
  start(fresh(activeViewpoint), true);
};
$('b-cont').onclick = () => {
  const s = load(activeViewpoint);
  if (s) {
    unlockAudio();
    start(s, false);
  }
};
$('b-auto-start').onclick = () => {
  unlockAudio();
  setAutoGuide(true);
  const s = load(activeViewpoint);
  if (s && !s.ending) start(s, false);
  else {
    clear(activeViewpoint);
    start(fresh(activeViewpoint), true);
  }
};
$('b-watch-all').onclick = () => {
  unlockAudio();
  openReel(firstChapterFor(activeViewpoint), () => closeModal(false), true);
};
renderViewpointButtons();
renderTitleViewpoint();
syncCamUi();
syncLensBtn();

const openingDialog = document.querySelector<HTMLDialogElement>('#opening-prelude')!;
const openingPrelude = mountOpeningPrelude(openingDialog, {
  onUnlockAudio: () => {
    unlockAudio();
    if (!playing) setAudioMood('title');
  },
  onToggleAudio: () => {
    const on = toggleAudio();
    $('b-audio').textContent = on ? '聲音：開' : '聲音：關';
    return on;
  },
  isAudioOn,
  isAudioUnlocked,
  onStart: () => {
    if (!playing) {
      $('title').classList.add('under-opening');
      setAudioMood('title');
      if (world) previewTitleViewpoint(activeViewpoint);
    }
  },
  onFinish: () => {
    $('title').classList.remove('under-opening');
  },
});

$('b-opening').onclick = () => {
  unlockAudio();
  openingPrelude.play(0);
};

const bootParams = new URLSearchParams(location.search);
const introParam = bootParams.get('intro') ?? bootParams.get('opening');
const skipIntroParam = bootParams.get('skipIntro');
const skipIntro =
  introParam === '0' ||
  introParam === 'false' ||
  skipIntroParam === '1' ||
  skipIntroParam === 'true';

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  postProcess.setSize(w, h, renderer.getPixelRatio());
  cam.aspect = w / h;
  if (!playing) cam.fov = w < h ? 62 : 50;
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
previewTitleViewpoint(activeViewpoint);
if (!skipIntro) {
  openingPrelude.play(0);
}
void started;

function perfStats() {
  let tris = 0;
  world.scene.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      const g = m.geometry;
      const n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      tris += n * ((m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1);
    }
  });
  return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, sceneTriangles: tris };
}

function stepFrame() {
  const dt = Math.min(clock.getDelta(), 0.09);
  const t = clock.elapsedTime;
  if (openingPrelude.isActive()) {
    if (!openingDialog.classList.contains('reveal-3d')) return;
    if (playing) { renderActiveScene(t); return; }
  }
  const reach = SCENE_META[world.id]?.reach ?? 2.4;

  player.setLookTarget(inDialog ? activeDialogTarget : (near ? near.pos : null));
  let steppedThisFrame = false;

  if (playing && !inDialog && $('modal').hidden && !isFading) {
    yaw += controls.consumeOrbit(dt);
    const ax = controls.axis();
    if (Math.abs(ax.x) + Math.abs(ax.y) > 0.08) {
      player.step(dt * playSpeed, ax, world.bounds, yaw);
      if (resolvePlayerColliders(world, player.pos)) {
        player.sync(0);
      }
      steppedThisFrame = true;
      playSceneStep(world.id);
    } else if (autoGuide) {
      const target = findNextTarget(chap(), world.id, player.pos, k => story.has(k), state.taken ?? [], {
        clockMin: state.clockMin,
        photos: state.photos,
        evidence: state.evidence,
      });
      if (target) {
        const h = target.hotspot;
        if (!target.sameScene) {
          playTransitionChord();
          fade(chap().transitions[h.scene] ?? '前往下一處……', 900, () => {
            enter(h.scene, [h.pos[0], h.pos[1] - 1.2]);
          });
        } else {
          const [minX, maxX, minZ, maxZ] = world.bounds;
          const tx = Math.max(minX + 0.5, Math.min(maxX - 0.5, h.pos[0]));
          const tz = Math.max(minZ + 0.5, Math.min(maxZ - 0.5, h.pos[1] - 0.9));
          const stopDist = Math.max(1.8, reach * 0.78);
          const initDist = Math.hypot(tx - player.pos.x, tz - player.pos.y);
          const sceneBoost = initDist > 25 ? 2.4 : initDist > 10 ? 1.55 : 1.15;
          let remaining = player.speed * sceneBoost * playSpeed * dt;
          let arrived = false;
          let movedAny = false;
          let lastNx = 0;
          let lastNz = 0;
          let lastDist = initDist;

          // Sub-step movement in <= 1.2m chunks so 6x/8x playback never overshoots a hotspot.
          for (let i = 0; i < 16; i++) {
            const vx = tx - player.pos.x;
            const vz = tz - player.pos.y;
            const distToStand = Math.hypot(vx, vz);
            const distToHotspot = Math.hypot(h.pos[0] - player.pos.x, h.pos[1] - player.pos.y);
            if (distToHotspot <= stopDist || distToStand <= 0.45) {
              arrived = true;
              break;
            }
            if (remaining <= 1e-4) break;
            const nx = vx / distToStand;
            const nz = vz / distToStand;
            const chunk = Math.min(remaining, distToStand, 1.2);
            player.pos.x = Math.min(maxX, Math.max(minX, player.pos.x + nx * chunk));
            player.pos.y = Math.min(maxZ, Math.max(minZ, player.pos.y + nz * chunk));
            player.advanceWheels(chunk);
            remaining -= chunk;
            movedAny = true;
            lastNx = nx;
            lastNz = nz;
            lastDist = distToStand - chunk;
          }

          if (!arrived) {
            const distToStand = Math.hypot(tx - player.pos.x, tz - player.pos.y);
            const distToHotspot = Math.hypot(h.pos[0] - player.pos.x, h.pos[1] - player.pos.y);
            if (distToHotspot <= stopDist || distToStand <= 0.45) arrived = true;
          }

          if (arrived) {
            if (movedAny) player.heading = Math.atan2(-lastNz, lastNx);
            player.sync(dt * playSpeed);
            steppedThisFrame = true;
            near = h;
            show(h.start);
          } else if (movedAny) {
            player.heading = Math.atan2(-lastNz, lastNx);
            player.walk += dt * 10 * playSpeed;
            player.sync(dt * playSpeed);
            steppedThisFrame = true;

            // Gently align camera yaw toward travel direction when far from target
            if (lastDist > 4.5) {
              const wantYaw = Math.atan2(lastNx, lastNz);
              const diff = ((wantYaw - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
              yaw += diff * Math.min(1, dt * 2.2 * playSpeed);
            }
            playSceneStep(world.id);
          }
        }
      }
    }
  } else if (playing && autoGuide && inDialog && $('modal').hidden && !isFading && !dlgAutoPicked && curNodeId) {
    dlgAutoElapsed += dt * playSpeed;
    const pct = Math.min(100, (dlgAutoElapsed / dlgAutoDuration) * 100);
    ($('dlg-fill') as HTMLElement).style.width = `${pct.toFixed(1)}%`;
    if (dlgAutoElapsed >= dlgAutoDuration) {
      dlgAutoPicked = true;
      const n = story.node(curNodeId);
      const avail = story.available(n);
      const best = pickAutoChoice(curNodeId, avail, chap(), world.id, k => story.has(k), state.taken ?? []);
      if (best) choose(best, curNodeId);
    }
  }

  if (!steppedThisFrame) {
    player.sync(dt);
  }

  world.scene.userData.__playerRadius = (player.getMode() === 'bike' || player.getMode() === 'tricycle') ? 1.05 : 0.64;
  world.update(dt * playSpeed, t * playSpeed, player.pos.x, player.pos.y);
  updateFoliageWind(t * playSpeed);
  const living = worldLiving.get(world);
  living?.update(dt * playSpeed, t * playSpeed, player.pos.x, player.pos.y);

  // Quantized directional shadow frustum follow to prevent texel shimmer while keeping crisp ground shadows
  const shadowLight = world.scene.userData.__shadowLight as THREE.DirectionalLight | undefined;
  const shadowOffset = world.scene.userData.__shadowDirOffset as [number, number, number] | undefined;
  if (shadowLight && shadowOffset) {
    const qx = Math.round(player.pos.x * 2) / 2;
    const qz = Math.round(player.pos.y * 2) / 2;
    shadowLight.position.set(qx + shadowOffset[0], shadowOffset[1], qz + shadowOffset[2]);
    shadowLight.target.position.set(qx, 0, qz);
    shadowLight.target.updateMatrixWorld();
  }

  const dialogNpcPos = inDialog ? activeDialogTarget : null;
  const camRes = cinemaCam.frame(cam, {
    sceneId: world.id,
    world,
    player,
    yaw,
    pitch: controls.getOrbitPitch(),
    zoom: controls.zoom,
    playing,
    inDialog,
    autoGuide,
    speed: playSpeed,
    dt,
    elapsed: t,
    aspect: cam.aspect,
    npcPos: dialogNpcPos,
    snap,
  });
  snap = false;
  document.body.classList.toggle('letterbox-on', playing && camRes.wantsLetterbox && $('modal').hidden && !isFading);

  const attachedRain = worldRain.get(world);
  if (attachedRain) {
    attachedRain.update(dt * playSpeed, cam.position.x, cam.position.z);
  }

  const inViewfinder = cinemaCam.getMode() === 'viewfinder';
  const showWhisperBar = appSettings.showWhispers && playing && !inDialog && !inViewfinder && $('modal').hidden && !isFading;
  const curWhisper = showWhisperBar ? (living?.getWhisper(t) ?? null) : null;
  const wKey = curWhisper ? `${world.id}:${curWhisper.speaker}:${curWhisper.text}` : '';
  if (wKey !== lastWhisperKey) {
    lastWhisperKey = wKey;
    const wEl = $('ambient-whisper');
    if (curWhisper) {
      $('whisper-who').textContent = curWhisper.speaker;
      $('whisper-txt').textContent = curWhisper.text;
      wEl.hidden = false;
    } else {
      wEl.hidden = true;
    }
  }
  if (inViewfinder && vfCtrl) {
    const locked = findLockedPhotoTargets();
    const uncaptured = locked.find(pt => !(state.photos ?? []).includes(pt.id));
    const nextLbl = (uncaptured ?? locked[0])?.label ?? null;
    if (nextLbl !== lastVfLockLabel) {
      lastVfLockLabel = nextLbl;
      vfCtrl.setTargetLock(nextLbl);
    }
  }

  near = null;
  let best = reach;
  for (const h of hotspots()) {
    const d = Math.hypot(h.pos[0] - player.pos.x, h.pos[1] - player.pos.y);
    if (d < best) {
      best = d;
      near = h;
    }
  }
  if (playing) refreshGuide();
  const act = $('act') as HTMLButtonElement;
  act.hidden = !playing || inDialog || inViewfinder || !near;
  if (near) act.textContent = near.label + '（E）';
  renderer.info.reset();
  renderActiveScene(t);
}

function frame() {
  const t0 = performance.now();
  stepFrame();
  const renderMs = performance.now() - t0;
  if (renderMs > 90) {
    setTimeout(() => requestAnimationFrame(frame), 0);
  } else {
    requestAnimationFrame(frame);
  }
}
frame();

// Debug/test hook (used by tests/smoke.mjs and Wave 1/2/3 verification).
(window as any).__b89 = {
  get state() { return state; },
  get ledger() { return loadLedger(); },
  get scene() { return world.id; },
  get near() { return near?.id ?? null; },
  get dialog() { return inDialog; },
  get auto() { return autoGuide; },
  get speed() { return playSpeed; },
  get camMode() { return cinemaCam.getMode(); },
  get audioOn() { return isAudioOn(); },
  get audioTrack() { return getActiveScoreTrack(); },
  get letterbox() { return document.body.classList.contains('letterbox-on'); },
  get openingActive() { return openingPrelude.isActive(); },
  playOpening(startSec = 0) { openingPrelude.play(startSec); },
  seekOpening(sec: number) { openingPrelude.seek(sec); },
  skipOpening() { openingPrelude.skip(); },
  get speeds() { return [...SPEEDS]; },
  setAuto(on: boolean) { setAutoGuide(on); stepFrame(); },
  setSpeed(s: number) { setPlaySpeed(s); stepFrame(); },
  setCamMode(m: CamMode) {
    if (m === 'viewfinder') {
      setViewfinderActive(true);
    } else {
      if (cinemaCam.getMode() === 'viewfinder') setViewfinderActive(false);
      cinemaCam.setMode(m);
      syncCamUi();
    }
    snap = true;
    cinemaCam.snapNow();
    stepFrame();
  },
  orbit(rad: number) {
    controls.addOrbitYaw(rad);
    yaw += controls.consumeOrbit(1 / 60);
    snap = true;
    cinemaCam.snapNow();
    stepFrame();
  },
  startViewpoint(vp: ViewpointId, auto = false) {
    activeViewpoint = vp;
    renderTitleViewpoint();
    setAutoGuide(auto);
    clear(vp);
    start(fresh(vp), true);
  },
  marchAudit() { return world.scene.userData.__marchAudit ?? null; },
  squareAudit() { return world.scene.userData.__squareAudit ?? null; },
  perf() { return perfStats(); },
  inspectScene(id: SceneId) {
    if (playing) {
      enter(id);
    } else {
      if (world) world.scene.remove(player.mesh);
      world = getWorld(id);
      dressWorld(world);
      world.scene.add(player.mesh);
      syncSceneView(id, undefined, true);
    }
    stepFrame();
    return {
      scene: world.id,
      cached: worldManager.getCachedIds(),
      perf: perfStats(),
      memory: { ...renderer.info.memory },
    };
  },
  capturePhoto() {
    stepFrame();
    return capturePhoto();
  },
  openBook(allRoutes = false) {
    playPaper();
    openModal('<p class="small">正在開啟六十四開連環畫冊……</p>', true, 'book');
    const req = modalReqToken;
    void import('./ui/lianhuanhuaBook').then(({ mountLianhuanhuaBook }) => {
      if (req !== modalReqToken || $('modal').hidden) return;
      modalCleanup = mountLianhuanhuaBook($('mbody'), {
        viewpoint: playing ? activeViewpoint : viewpointOfChapter(state.chapter),
        state,
        ledger: loadLedger(),
        allRoutes,
      });
    });
  },
  openArtifact(kind: 'bulletin' | 'typesetting' | 'shortwave') {
    return openArtifactModal(kind);
  },
  openDarkroom() { openDiaryModal('darkroom'); },
  setVisualLook(lk: VisualLook) { applyVisualLook(lk); return visualLook; },
  getVisualLook() { return visualLook; },
  getSettings() { return { ...appSettings }; },
  updateSettings(partial: Partial<AppSettings>) {
    applyAppSettings({ ...appSettings, ...partial });
    return { ...appSettings };
  },
  playerRigInfo() {
    const rig = player.getActiveRig();
    const anim = rig?.userData?.anim as Record<string, unknown> | undefined;
    return {
      mode: player.getMode(),
      viewpoint: player.getViewpoint(),
      hasHead: Boolean(anim?.head),
      hasWheels: Boolean(anim?.wheelF && anim?.wheelR),
    };
  },
  downloadKeepsake() { downloadKeepsakeNow(); },
  toggleNarrator() { return toggleNarrator(); },
  evaluateEvidencePair,
  setYaw(r: number) { yaw = r; snap = true; cinemaCam.snapNow(); stepFrame(); },
  setPitch(r: number) { controls.setOrbitPitch(r); snap = true; cinemaCam.snapNow(); stepFrame(); },
  placeAt(x: number, z: number) { player.place(x, z); snap = true; cinemaCam.snapNow(); stepFrame(); },
  teleport(id: string) {
    const h = chap().hotspots.find(x => x.id === id)!;
    if (world.id !== h.scene) enter(h.scene);
    player.place(h.pos[0], h.pos[1] - 1.2);
    if (resolvePlayerColliders(world, player.pos)) {
      player.sync(0);
    }
    snap = true;
    cinemaCam.snapNow();
    stepFrame();
    near = h;
  },
  interact() { controls.onInteract(); },
  choose(i: number) { ($('ch').children[i] as HTMLButtonElement)?.click(); },
  next() { ($('nextch') as HTMLButtonElement).click(); },
  flow() { ($('flow') as HTMLButtonElement).click(); },
  choices() { return [...$('ch').children].map(b => b.textContent); },
};
