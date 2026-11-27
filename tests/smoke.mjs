// Comprehensive E2E Puppeteer smoke & performance verifier for 北京，一九八九 (4 viewpoints x 8 chapters = 32 chapters, 24 scenes, 22 audio cues).
// Usage:
//   npm run build && npm run smoke
//   npm run smoke:render          (or SMOKE_SHARD=render / --shard=render)
//   npm run smoke:route           (or SMOKE_SHARD=routes / --shard=student,worker,journalist,resident)
// Optional env vars: CHROME_PATH=..., SHOTS=dir, SMOKE_SHARD=...
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

function detectBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  throw new Error('No Chrome/Edge binary found; set CHROME_PATH');
}

function parseShards() {
  let raw = process.env.SMOKE_SHARD || '';
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--shard=')) raw = a.slice(8);
    else if (a === '--shard' && process.argv[i + 1]) raw = process.argv[++i];
  }
  const tokens = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (tokens.length === 0 || tokens.includes('all')) {
    return { render: true, student: true, worker: true, journalist: true, resident: true };
  }
  const sel = { render: false, student: false, worker: false, journalist: false, resident: false };
  for (const t of tokens) {
    if (t === 'render' || t === 'scenes' || t === 'perf') sel.render = true;
    else if (t === 'routes') {
      sel.student = sel.worker = sel.journalist = sel.resident = true;
    } else if (t === 'student' || t === 'worker' || t === 'journalist' || t === 'resident') {
      sel[t] = true;
    } else {
      throw new Error(`Unknown SMOKE_SHARD token "${t}". Expected all, render, routes, student, worker, journalist, resident.`);
    }
  }
  return sel;
}

const PHONE_VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP_VIEWPORT = { width: 1366, height: 800 };

const ALL_AUDIO_CUES = [
  'title_chronicle', 'campus_night', 'street_avenue', 'march_anthem',
  'square_dawn', 'camp_vigil', 'martial_tension', 'statue_twilight',
  'hutong_vigil', 'aftermath_elegy', 'worker_factory', 'courtyard_home',
  'stinger_chapter', 'stinger_ending',
  'press_night', 'xinhua_vigil', 'march_day_surge', 'rain_square',
  'market_morning', 'hospital_watch', 'stinger_shutter', 'stinger_dispatch',
];

const SCENES_META = JSON.parse(readFileSync('data/scenes.json', 'utf8'));
const ALL_SCENE_IDS = Object.keys(SCENES_META);
if (ALL_SCENE_IDS.length < 24) {
  throw new Error(`Expected >= 24 scenes in data/scenes.json, got ${ALL_SCENE_IDS.length}`);
}

const SHARDS = parseShards();
const routeViewport = process.env.SMOKE_ROUTE_VIEWPORT || 'all';
if (!['all', 'phone', 'desktop'].includes(routeViewport)) throw new Error('Unknown route viewport: ' + routeViewport);
const runPhoneRoutes = routeViewport !== 'desktop';
const runDesktopRoutes = routeViewport !== 'phone';
const shots = process.env.SHOTS;
if (shots) mkdirSync(shots, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];

const server = await preview({ preview: { port: 4179, host: '127.0.0.1' } });
const url = 'http://127.0.0.1:4179/';
const browser = await puppeteer.launch({
  executablePath: detectBrowser(),
  headless: true,
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});

async function openHarness(name, viewport, { clearStorage = true, showOpening = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on('pageerror', e => {
    errors.push(`${name}: ${e.message}`);
    console.error(`${name} browser exception`, e.stack || e.message);
  });
  page.on('console', m => {
    if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`);
  });
  const origWait = page.waitForFunction.bind(page);
  page.waitForFunction = (fn, opts = {}, ...args) => origWait(fn, { polling: 100, timeout: 30000, ...opts }, ...args);

  await page.goto(showOpening ? url : url + '?skipIntro=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (clearStorage) {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  await page.waitForFunction(() => !!window.__b89, { timeout: 60000 });
  await sleep(250);

  const ev = (fn, ...args) => page.evaluate(fn, ...args);
  const waitFade = () => page.waitForFunction(() => !document.getElementById('fade').classList.contains('on'), { timeout: 25000 });
  const waitTrack = async (track, label) => {
    await page.waitForFunction(t => window.__b89.audioTrack === t, { polling: 100, timeout: 8000 }, track).catch(async () => {
      const got = await ev(() => window.__b89.audioTrack);
      throw new Error(`expected ${track} track in ${label}, got ${got}`);
    });
  };
  const pick = async i => {
    await page.waitForFunction(idx => window.__b89.choices().length > idx, { timeout: 15000 }, i);
    await ev(idx => window.__b89.choose(idx), i);
    await sleep(120);
  };
  const go = async id => {
    await waitFade();
    await ev(hid => window.__b89.teleport(hid), id);
    await page.waitForFunction(hid => window.__b89.near === hid, { timeout: 15000 }, id);
    await ev(() => window.__b89.interact());
    await page.waitForFunction(() => window.__b89.dialog || !document.getElementById('modal').hidden, { timeout: 15000 });
  };
  const nextChapter = async chId => {
    await page.waitForFunction(() => !!document.getElementById('nextch'), { timeout: 15000 });
    await ev(() => window.__b89.next());
    await page.waitForFunction(cid => window.__b89.state.chapter === cid && window.__b89.dialog, { timeout: 20000 }, chId);
    await waitFade();
  };
  const shot = async (filename, settleMs = 0) => {
    if (!shots) return;
    if (settleMs > 0) await sleep(settleMs);
    await page.screenshot({ path: `${shots}/${filename}` });
  };
  const assertPerfMap = (label, perfMap) => {
    for (const [sceneName, p] of Object.entries(perfMap)) {
      if (!p) continue;
      if (p.calls > 60) throw new Error(`${label} ${sceneName} draw calls over budget: ${p.calls}`);
      if (p.sceneTriangles > 300000) throw new Error(`${label} ${sceneName} triangles over budget: ${p.sceneTriangles}`);
    }
  };
  const exitViewfinderIfActive = async () => {
    const inVf = await ev(() => window.__b89.camMode === 'viewfinder');
    if (inVf) {
      await page.waitForFunction(() => !!document.getElementById('vf-exit'), { timeout: 10000 });
      await page.click('#vf-exit');
      await page.waitForFunction(() => window.__b89.camMode !== 'viewfinder' && !document.getElementById('vf-overlay'), { timeout: 10000 });
    }
  };
  const tuneShortwaveAndConfirm = async (shotFile) => {
    await page.waitForFunction(() => !document.getElementById('modal').hidden && !!document.getElementById('sw-slider'), { timeout: 15000 });
    const radioParts = await ev(() => ({
      confirmDisabled: document.getElementById('sw-confirm')?.disabled,
      hasKnob: Boolean(document.getElementById('sw-knob')),
      hasEye: Boolean(document.getElementById('sw-magic-eye')),
    }));
    if (!radioParts.confirmDisabled || !radioParts.hasKnob || !radioParts.hasEye) {
      throw new Error('upgraded shortwave Bakelite radio contract failed: ' + JSON.stringify(radioParts));
    }

    // Exercise -0.1 / +0.1 step buttons, then tune directly onto the first station pip frequency
    await page.click('#sw-up');
    await page.click('#sw-down');
    const tuned = await ev(() => {
      const pip = document.querySelector('.sw-scale span[title]');
      const freqMatch = pip?.getAttribute('title')?.match(/(\d+(?:\.\d+)?)/);
      const targetFreq = freqMatch ? Number(freqMatch[1]) : 7.35;
      const slider = document.getElementById('sw-slider');
      slider.value = targetFreq.toFixed(2);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      return {
        targetFreq,
        readout: document.getElementById('sw-freq-readout')?.textContent,
        title: document.getElementById('sw-station-title')?.textContent,
        disabled: document.getElementById('sw-confirm')?.disabled,
      };
    });
    if (tuned.disabled || !tuned.title || tuned.title.includes('電流雜音')) {
      throw new Error(`shortwave failed to lock station: ${JSON.stringify(tuned)}`);
    }
    if (shotFile) await shot(shotFile, 150);
    await page.click('#sw-confirm');
    await page.waitForFunction(() => document.getElementById('modal').hidden, { timeout: 15000 });
    return tuned;
  };
  const assertRectsClean = async (label, selector, { checkOverlap = true, containerSelector = null } = {}) => {
    const res = await ev((sel, chkOverlap, contSel, vw, vh) => {
      const els = [...document.querySelectorAll(sel)].filter(el => {
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0' && r.width > 0 && r.height > 0;
      });
      if (els.length === 0) return { ok: false, reason: `no visible elements matched ${sel}` };
      const contRect = contSel ? document.querySelector(contSel)?.getBoundingClientRect() : null;
      const boxes = els.map(el => {
        const r = el.getBoundingClientRect();
        return {
          id: el.id || el.dataset.lens || el.dataset.vp || el.textContent?.trim().slice(0, 18) || el.tagName,
          left: Math.round(r.left * 10) / 10,
          right: Math.round(r.right * 10) / 10,
          top: Math.round(r.top * 10) / 10,
          bottom: Math.round(r.bottom * 10) / 10,
        };
      });
      for (const b of boxes) {
        if (b.left < -1 || b.right > vw + 1 || b.top < -1 || b.bottom > vh + 1) {
          return { ok: false, reason: `${b.id} clipped outside viewport ${vw}x${vh}: ${JSON.stringify(b)}`, boxes };
        }
        if (contRect && (b.left < contRect.left - 1 || b.right > contRect.right + 1 || b.top < contRect.top - 1 || b.bottom > contRect.bottom + 1)) {
          return { ok: false, reason: `${b.id} clipped outside container ${JSON.stringify(contRect)}: ${JSON.stringify(b)}`, boxes };
        }
      }
      if (chkOverlap) {
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i];
            const b = boxes[j];
            const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (ox > 1.5 && oy > 1.5) {
              return { ok: false, reason: `overlap (${ox.toFixed(1)}x${oy.toFixed(1)}px) between ${a.id} and ${b.id}`, boxes };
            }
          }
        }
      }
      return { ok: true, count: boxes.length, boxes };
    }, selector, checkOverlap, containerSelector, viewport.width, viewport.height);
    if (!res.ok) throw new Error(`${label} layout failure: ${res.reason}`);
    return res;
  };
  const close = () => page.close();

  return {
    page, ev, waitFade, waitTrack, pick, go, nextChapter, shot,
    assertPerfMap, exitViewfinderIfActive, tuneShortwaveAndConfirm, assertRectsClean, close,
  };
}

async function runOpening() {
  const h = await openHarness('opening', PHONE_VIEWPORT, { clearStorage: false, showOpening: true });
  const { page, ev } = h;
  try {
    await page.waitForSelector('#opening-prelude:modal');
    await page.keyboard.press('Tab');
    if (!await ev(() => !!document.activeElement.closest('#opening-prelude'))) throw new Error('Keyboard focus escaped the opening');
    await page.focus('#op-pause');
    await page.keyboard.press('Enter');
    if (!await ev(() => window.__b89.openingActive && document.querySelector('#op-pause').textContent === '繼續')) {
      throw new Error('Enter on Pause skipped the opening');
    }
    await page.tap('.op-dot[data-mv="1"]');
    if (!await ev(() => Number(getComputedStyle(document.querySelector('.op-line')).opacity) > 0.5)) {
      throw new Error('Paused chapter selection left the prelude text invisible');
    }
    await h.shot('phone-opening.png', 200);
    await page.tap('#op-skip');
    await page.waitForFunction(() => document.querySelector('#opening-prelude').hidden);
    await page.setViewport(DESKTOP_VIEWPORT);
    await page.click('#b-opening');
    await page.waitForFunction(() => document.querySelector('#op-counter').textContent.includes('02'));
    await h.shot('desktop-opening.png', 1500);
    await page.waitForFunction(() => document.querySelector('#opening-prelude').hidden, { timeout: 45000 });
    await page.click('#vp-worker');
    await page.waitForFunction(() => window.__b89.scene === 'factory');
    await page.click('#b-opening');
    await ev(() => { window.__b89.skipOpening(); window.__b89.skipOpening(); });
    await page.waitForFunction(() => document.querySelector('#opening-prelude').hidden);
    console.log('opening ok: mobile touch and keyboard, automatic ending, title preview and repeated skip');
  } finally { await h.close(); }
}

async function assertAllFourViewpointsOnTitle(h) {
  const vps = ['student', 'worker', 'journalist', 'resident'];
  for (const vp of vps) {
    const info = await h.ev(id => {
      const b = document.getElementById(`vp-${id}`);
      return b ? { exists: true, disabled: b.disabled, text: b.textContent } : { exists: false };
    }, vp);
    if (!info.exists || info.disabled) {
      throw new Error(`viewpoint button #vp-${vp} missing or disabled: ${JSON.stringify(info)}`);
    }
  }
  await h.page.click('#vp-journalist');
  await h.page.waitForFunction(() => document.getElementById('vp-journalist').classList.contains('active'), { timeout: 10000 });
  const jDesc = await h.ev(() => document.getElementById('vp-desc').textContent);
  const jWatch = await h.ev(() => document.getElementById('b-watch-all').textContent);
  if (!jDesc.includes('顧明遠') || !jWatch.includes('全八章')) {
    throw new Error(`journalist title selection mismatch: desc=${jDesc}, watch=${jWatch}`);
  }
  await h.page.click('#vp-student');
  await h.page.waitForFunction(() => document.getElementById('vp-student').classList.contains('active'), { timeout: 10000 });
}

async function verifyAudioAudit(h) {
  const voiceIds = [
    'ch0-0417', 'ch1-0422', 'ch-0427', 'ch-0504', 'ch2-0513', 'ch3-0520', 'ch4-0530', 'ch5-0603',
    'w0-0417', 'w1-0422', 'w-0427', 'w-0504', 'w2-0513', 'w3-0520', 'w4-0530', 'w5-0603',
    'j-0417', 'j-0422', 'j-0427', 'j-0504', 'j-0513', 'j-0520', 'j-0530', 'j-0603',
    'r-0417', 'r-0422', 'r-0427', 'r-0504', 'r-0513', 'r-0520', 'r-0530', 'r-0603',
  ];
  const audioRes = await h.ev(async ({ cues, voices }) => {
    const results = [];
    for (const id of cues) {
      const r = await fetch(`./audio/${id}.mp3`);
      const buf = await r.arrayBuffer();
      results.push({ id, ok: r.ok, status: r.status, bytes: buf.byteLength });
    }
    const voiceResults = [];
    for (const vid of voices) {
      const r = await fetch(`./audio/voice/${vid}.mp3`);
      const buf = await r.arrayBuffer();
      voiceResults.push({ id: vid, ok: r.ok, bytes: buf.byteLength });
    }
    const durations = {};
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      const ac = new AC();
      for (const sampleId of ['title_chronicle', 'press_night']) {
        const buf = await (await fetch(`./audio/${sampleId}.mp3`)).arrayBuffer();
        const decoded = await ac.decodeAudioData(buf.slice(0));
        durations[sampleId] = decoded.duration;
      }
      for (const vsId of ['ch0-0417', 'r-0417']) {
        const buf = await (await fetch(`./audio/voice/${vsId}.mp3`)).arrayBuffer();
        const decoded = await ac.decodeAudioData(buf.slice(0));
        durations[`voice_${vsId}`] = decoded.duration;
      }
      await ac.close().catch(() => {});
    }
    return { results, voiceResults, durations, initialTrack: window.__b89.audioTrack };
  }, { cues: ALL_AUDIO_CUES, voices: voiceIds });

  if (audioRes.results.length !== 22) {
    throw new Error(`expected 22 audio cues audited, got ${audioRes.results.length}`);
  }
  for (const item of audioRes.results) {
    if (!item.ok || item.bytes < 50000) {
      throw new Error(`audio asset missing/truncated: ${JSON.stringify(item)}`);
    }
  }
  if (audioRes.voiceResults.length !== 32) {
    throw new Error(`expected 32 documentary voiceovers audited, got ${audioRes.voiceResults.length}`);
  }
  for (const v of audioRes.voiceResults) {
    if (!v.ok || v.bytes < 10000) {
      throw new Error(`voiceover missing/truncated: ${JSON.stringify(v)}`);
    }
  }
  if (
    (audioRes.durations.title_chronicle ?? 0) < 40 ||
    (audioRes.durations.press_night ?? 0) < 40 ||
    (audioRes.durations['voice_ch0-0417'] ?? 0) < 2 ||
    (audioRes.durations['voice_r-0417'] ?? 0) < 2 ||
    audioRes.initialTrack !== 'title_chronicle'
  ) {
    throw new Error(`unexpected audio decode/track state: ${JSON.stringify(audioRes)}`);
  }
  console.log('audio ok', JSON.stringify({ cues: audioRes.results.length, voices: audioRes.voiceResults.length, durations: audioRes.durations }));
}

async function runRenderAndLeakAudit(name, viewport) {
  const h = await openHarness(`render-${name}`, viewport, { clearStorage: true });
  try {
    if (name === 'desktop') await verifyAudioAudit(h);

    const cycleStats = [];
    let maxCalls = 0;
    let maxTris = 0;

    // Cycle 1 warms lazy shared caches (e.g. 8 wallTextures kinds); Cycles 2 & 3 verify strict non-growth under WorldManager LRU eviction.
    for (let cycle = 1; cycle <= 3; cycle++) {
      const perScene = [];
      for (const id of ALL_SCENE_IDS) {
        const res = await h.ev(sid => window.__b89.inspectScene(sid), id);
        if (res.scene !== id) {
          throw new Error(`${name} cycle ${cycle} inspectScene(${id}) returned scene=${res.scene}`);
        }
        if (res.cached.length > 3) {
          throw new Error(`${name} WorldManager exceeded maxCached=3: ${JSON.stringify(res.cached)}`);
        }
        if (res.perf.calls > 60) {
          throw new Error(`${name} cycle ${cycle} ${id} calls over budget: ${res.perf.calls} > 60`);
        }
        if (res.perf.sceneTriangles > 300000) {
          throw new Error(`${name} cycle ${cycle} ${id} triangles over budget: ${res.perf.sceneTriangles} > 300000`);
        }
        maxCalls = Math.max(maxCalls, res.perf.calls);
        maxTris = Math.max(maxTris, res.perf.sceneTriangles);
        perScene.push({ id, calls: res.perf.calls, tris: res.perf.sceneTriangles, memory: res.memory });
      }
      cycleStats.push(perScene);
    }

    const c2 = cycleStats[1];
    const c3 = cycleStats[2];
    const c2End = c2[c2.length - 1].memory;
    const c3End = c3[c3.length - 1].memory;
    const c2MaxGeo = Math.max(...c2.map(x => x.memory.geometries));
    const c3MaxGeo = Math.max(...c3.map(x => x.memory.geometries));
    const c2MaxTex = Math.max(...c2.map(x => x.memory.textures));
    const c3MaxTex = Math.max(...c3.map(x => x.memory.textures));

    if (c3End.geometries > c2End.geometries || c3End.textures > c2End.textures) {
      throw new Error(`${name} GPU memory leaked across 24-scene cycles: c2End=${JSON.stringify(c2End)}, c3End=${JSON.stringify(c3End)}`);
    }
    if (c3MaxGeo > c2MaxGeo || c3MaxTex > c2MaxTex) {
      throw new Error(`${name} peak GPU memory grew across cycles: c2Max=${c2MaxGeo}/${c2MaxTex}, c3Max=${c3MaxGeo}/${c3MaxTex}`);
    }
    for (let i = 0; i < ALL_SCENE_IDS.length; i++) {
      if (c3[i].memory.geometries > c2[i].memory.geometries || c3[i].memory.textures > c2[i].memory.textures) {
        throw new Error(`${name} monotonic memory growth at ${ALL_SCENE_IDS[i]}: c2=${JSON.stringify(c2[i].memory)} -> c3=${JSON.stringify(c3[i].memory)}`);
      }
    }

    console.log(`render-${name}`, JSON.stringify({
      scenes: ALL_SCENE_IDS.length,
      maxCalls,
      maxTris,
      c2End,
      c3End,
      c2Max: { geometries: c2MaxGeo, textures: c2MaxTex },
      c3Max: { geometries: c3MaxGeo, textures: c3MaxTex },
    }));
  } finally {
    await h.close();
  }
}

async function runStudent(name, viewport) {
  const h = await openHarness(`student-${name}`, viewport, { clearStorage: true });
  const { page, ev, waitFade, waitTrack, pick, go, nextChapter, shot } = h;
  try {
    await assertAllFourViewpointsOnTitle(h);
    await shot(`${name}-0-title.png`, 300);

    // Test Full-Story Continuous Documentary Film (#b-watch-all) & Speed Selector from Title Screen
    await page.click('#b-watch-all');
    await page.waitForFunction(() => !!document.getElementById('reel-all') && document.getElementById('reel-all').classList.contains('active'), { timeout: 15000 });
    await page.click('#reel-speed'); // 1x -> 1.25x
    if ((await page.$eval('#reel-speed', el => el.textContent)) !== '倍速：1.25x') {
      throw new Error('reel-speed cycle 1x -> 1.25x failed');
    }
    for (const s of [6, 8, 0.5]) {
      await page.click(`.rspeed-btn[data-speed="${s}"]`);
      const txt = await page.$eval('#reel-speed', el => el.textContent);
      const active = await page.$eval(`.rspeed-btn[data-speed="${s}"]`, el => el.classList.contains('on'));
      if (txt !== `倍速：${s}x` || !active) {
        throw new Error(`reel speed pill ${s}x failed: txt=${txt}, active=${active}`);
      }
    }
    await page.click('.rspeed-btn[data-speed="1"]');
    if ((await page.$eval('#reel-speed', el => el.textContent)) !== '倍速：1x') {
      throw new Error('reel speed reset to 1x failed');
    }
    if ((await page.$eval('#reel-view-mode', el => el.textContent)) !== '視角：連環六鏡') {
      throw new Error('initial #reel-view-mode label mismatch');
    }
    for (const [vid, lbl] of [['quad', '視角：四線同框'], ['diptych', '視角：雙聯遠近'], ['closeup', '視角：長卷特寫'], ['auto', '視角：連環六鏡']]) {
      await page.click(`.rview-btn[data-view="${vid}"]`);
      const txt = await page.$eval('#reel-view-mode', el => el.textContent);
      const on = await page.$eval(`.rview-btn[data-view="${vid}"]`, el => el.classList.contains('on'));
      if (txt !== lbl || !on) {
        throw new Error(`reel view style ${vid} failed: txt=${txt}, on=${on}`);
      }
    }
    await page.click('.rbeat-btn[data-beat="2"]');
    await page.waitForFunction(() => document.querySelector('.rbeat-btn[data-beat="2"]')?.classList.contains('on'), { timeout: 5000 });
    if (await ev(() => !!document.getElementById('reel-narrator'))) {
      await page.click('#reel-narrator');
      await page.waitForFunction(() => document.getElementById('reel-narrator')?.textContent?.includes('旁白：開'), { timeout: 5000 });
      await page.click('#reel-narrator');
      await page.waitForFunction(() => document.getElementById('reel-narrator')?.textContent?.includes('旁白：關'), { timeout: 5000 });
    }
    await shot(`${name}-0b-watch-all.png`, 300);
    await page.click('#reel-back');
    await ev(() => window.__b89.setSpeed(1));
    await page.click('#b-new');
    await sleep(350);

    // Verify full 10-speed array & HUD Speed Picker (#b-speed -> #speed-menu)
    const expectedSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];
    const gotSpeeds = await ev(() => window.__b89.speeds);
    if (JSON.stringify(gotSpeeds) !== JSON.stringify(expectedSpeeds)) {
      throw new Error('unexpected speeds list: ' + JSON.stringify(gotSpeeds));
    }
    await page.click('#b-speed');
    if (await ev(() => document.getElementById('speed-menu').hidden)) {
      throw new Error('#speed-menu did not open on #b-speed click');
    }
    await page.click('#speed-menu .spd-opt[data-speed="6"]');
    if (!(await ev(() => window.__b89.speed === 6 && document.getElementById('b-speed').textContent.includes('6x') && document.getElementById('speed-menu').hidden))) {
      throw new Error('HUD #speed-menu 6x selection failed');
    }

    // Test Auto-Guide toggle & Dialogue Speed Pills (#dlg-speeds) + #dlg-speed cycle
    await ev(() => { window.__b89.setSpeed(1); window.__b89.setAuto(true); });
    if (!(await ev(() => window.__b89.auto && !document.getElementById('dlg-auto').hidden))) {
      throw new Error('auto-guide HUD/dialog bar failed to activate');
    }
    await page.click('#dlg-speeds .dlg-spd-opt[data-speed="0.5"]');
    if (!(await ev(() => window.__b89.speed === 0.5 && document.getElementById('dlg-speed').textContent.includes('0.5x')))) {
      throw new Error('dialogue quick speed pill 0.5x failed');
    }
    await page.click('#dlg-speed'); // 0.5x -> 0.75x
    if (!(await ev(() => window.__b89.speed === 0.75 && document.getElementById('dlg-speed').textContent.includes('0.75x')))) {
      throw new Error('dialogue #dlg-speed cycle 0.5x -> 0.75x failed');
    }
    await page.click('#dlg-speeds .dlg-spd-opt[data-speed="8"]');
    if (!(await ev(() => window.__b89.speed === 8 && document.querySelector('#dlg-speeds .dlg-spd-opt[data-speed="8"]').classList.contains('on')))) {
      throw new Error('dialogue quick speed pill 8x failed');
    }
    await ev(() => { window.__b89.setAuto(false); window.__b89.setSpeed(2); window.__b89.setAuto(true); });
    if (!(await ev(() => window.__b89.auto && window.__b89.speed === 2 && !document.getElementById('dlg-auto').hidden))) {
      throw new Error('auto-guide HUD/dialog bar 2x failed');
    }
    await shot(`${name}-0c-auto-guide.png`);
    await ev(() => { window.__b89.setAuto(false); window.__b89.setSpeed(1); });

    // ---- Student Ch.1 (ch0-0417) ----
    if (!(await ev(() => window.__b89.dialog))) throw new Error('intro dialog missing');
    await pick(0);
    await go('board');
    if (!(await ev(() => window.__b89.camMode === 'cinema' && document.getElementById('b-cam').textContent === '運鏡：電影' && window.__b89.dialog && window.__b89.letterbox === true))) {
      throw new Error('expected cinema mode + letterbox=true during active dialog');
    }
    await shot(`${name}-0d-cinema-dialog.png`, 550);
    await page.click('#b-cam');
    await page.waitForFunction(() => window.__b89.camMode === 'follow' && document.getElementById('b-cam').textContent === '運鏡：跟隨' && window.__b89.letterbox === false, { polling: 'raf', timeout: 10000 });
    await page.click('#b-cam');
    await page.waitForFunction(() => window.__b89.camMode === 'wide' && document.getElementById('b-cam').textContent === '運鏡：全景' && window.__b89.letterbox === false, { polling: 'raf', timeout: 10000 });
    await page.click('#b-cam');
    await page.waitForFunction(() => window.__b89.camMode === 'cinema' && document.getElementById('b-cam').textContent === '運鏡：電影' && window.__b89.letterbox === true, { polling: 'raf', timeout: 10000 });
    await ev(() => window.__b89.setCamMode('follow'));
    if (!(await ev(() => window.__b89.camMode === 'follow' && window.__b89.letterbox === false))) {
      throw new Error('setCamMode("follow") failed to clear letterbox');
    }
    await ev(() => window.__b89.setCamMode('cinema'));
    if (!(await ev(() => window.__b89.camMode === 'cinema' && window.__b89.letterbox === true))) {
      throw new Error('setCamMode("cinema") failed to restore letterbox');
    }
    await shot(`${name}-1-board.png`, 520);
    await pick(0);
    const perfCampus = await ev(() => window.__b89.perf());

    if (name === 'desktop') {
      await waitTrack('campus_night', 'campus');
      await page.click('#b-audio');
      if ((await ev(() => window.__b89.audioOn)) !== false || !(await ev(() => document.getElementById('b-audio').textContent.includes('關')))) {
        throw new Error('audio toggle off failed');
      }
      await page.click('#b-audio');
      if ((await ev(() => window.__b89.audioOn)) !== true || !(await ev(() => document.getElementById('b-audio').textContent.includes('開')))) {
        throw new Error('audio toggle on failed');
      }
    }

    // Observe the first actual dialog before starting. At 8x the player can
    // open and leave a dialog between two out-of-process animation polls.
    await ev(slowFrame => {
      const game = window.__b89;
      const dialog = document.getElementById('dlg');
      const toggle = document.getElementById('b-auto');
      game.placeAt(15, 7);
      game.setSpeed(8);
      const raf = window.requestAnimationFrame;
      let collecting = true;
      const receipt = window.__guideArrival = { id: null, frames: 0, reading: '' };
      const observer = new MutationObserver(() => {
        if (dialog.hidden || !game.dialog) return;
        receipt.id = game.near || '__none__';
        receipt.reading = document.getElementById('txt').textContent;
        if (game.auto) toggle.click();
        window.__finishGuideArrival();
      });
      window.__finishGuideArrival = () => {
        collecting = false;
        observer.disconnect();
        window.requestAnimationFrame = raf;
      };
      observer.observe(dialog, { attributes: true, attributeFilter: ['hidden'] });
      if (slowFrame) {
        window.requestAnimationFrame = cb => raf.call(window, t => {
          if (!collecting) return cb(t);
          setTimeout(() => { receipt.frames++; cb(performance.now()); }, slowFrame);
        });
      }
      toggle.click();
    }, name === 'desktop' ? 3000 : 0);
    try {
      await page.waitForFunction(() => window.__guideArrival.id !== null, { polling: 100, timeout: 15000 });
      const arrival = await ev(() => window.__guideArrival);
      if (arrival.id !== 'zhou' || !arrival.reading || (name === 'desktop' && !arrival.frames)) {
        throw new Error('8x guide opened the wrong dialog: ' + JSON.stringify(arrival));
      }
    } catch (error) {
      const details = await ev(() => ({ ...window.__guideArrival, scene: window.__b89.scene, near: window.__b89.near,
        auto: window.__b89.auto, speed: window.__b89.speed, dialog: window.__b89.dialog,
        modal: !document.getElementById('modal').hidden, hint: document.getElementById('guide-txt').textContent }));
      throw new Error('8x guide did not reach 老周 within 15s: ' + JSON.stringify(details), { cause: error });
    } finally {
      await ev(() => { window.__finishGuideArrival(); window.__b89.setSpeed(1); });
    }
    await pick(0); await pick(0);
    await go('lin'); await pick(1); await pick(0);
    await go('gate');
    await shot(`${name}-2b-gate.png`);
    if (shots) {
      await ev(() => window.__b89.choose(1));
      await sleep(150);
      await ev(() => window.__b89.teleport('board'));
      await shot(`${name}-2-campus.png`, 600);
      await go('gate');
    }
    const opts = await ev(() => window.__b89.choices());
    if (!opts[0].includes('騎車')) throw new Error('gate should offer ride once an item is carried: ' + opts);
    await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'street', { timeout: 20000 }).catch(() => {});
    await waitFade();
    await sleep(shots ? 900 : 150);
    if ((await ev(() => window.__b89.scene)) !== 'street') throw new Error('did not reach street');
    await ev(() => window.__b89.teleport('kiosk'));
    const perfStreet = await ev(() => window.__b89.perf());
    await shot(`${name}-3-street.png`, 700);
    await go('youth'); await pick(1); await pick(0);
    await go('home');
    await shot(`${name}-4-home.png`);
    await pick(0);
    await page.waitForFunction(() => !!window.__b89.state.ending, { timeout: 15000 });
    const st1 = await ev(() => window.__b89.state);
    if (st1.ending !== 'letter') throw new Error('expected letter ending, got ' + st1.ending);
    if (st1.diary.length < 4) throw new Error('diary too short');
    await shot(`${name}-5-ending.png`);

    await ev(() => { document.getElementById('mclose').click(); window.__b89.teleport('tam'); });
    await page.waitForFunction(() => window.__b89.scene === 'changan' && window.__b89.near === 'tam', { timeout: 20000 });
    await sleep(shots ? 800 : 150);
    const perfChangan = await ev(() => window.__b89.perf());
    await shot(`${name}-6-changan-north.png`);
    await ev(() => window.__b89.setYaw(Math.PI));
    await shot(`${name}-7-changan-square.png`, 750);
    if (shots) {
      for (const [n, x, z, y, mode] of [
        ['8-monument', 0, -250, Math.PI, 'cinema'],
        ['8c-beijing-hotel', 150, -63, 1.15, 'cinema'],
        ['8d-telegraph-clock', -150, -63, -1.15, 'cinema'],
        ['9-greathall', -60, -300, -Math.PI / 2, 'cinema'],
        ['10-museum', 60, -300, Math.PI / 2, 'cinema'],
      ]) {
        await ev(a => {
          window.__b89.setCamMode(a[3]);
          window.__b89.placeAt(a[0], a[1]);
          window.__b89.setYaw(a[2]);
        }, [x, z, y, mode]);
        await shot(`${name}-${n}.png`, 650);
      }
      await ev(() => window.__b89.setCamMode('cinema'));
      await ev(() => window.__b89.teleport('square'));
    }
    await ev(() => window.__b89.setYaw(0));
    await go('square'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'south', { timeout: 15000 });

    // ---- Student Ch.2 (ch1-0422) ----
    await nextChapter('ch1-0422');
    const t0 = await ev(() => document.getElementById('txt').textContent);
    if (!t0.includes('廣場北邊')) throw new Error('ch2 intro should reflect ch1 "south" ending: ' + t0);
    await pick(0);
    await go('c2zhou');
    if (!(await ev(() => window.__b89.choices()))[0].includes('一起走')) throw new Error('zhou carry-over missing');
    await pick(0); await pick(0);
    await go('c2lin'); await pick(0); await pick(0);
    await go('c2gate'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'march', { timeout: 20000 });
    await waitFade();
    await ev(() => window.__b89.teleport('picket'));
    await sleep(shots ? 700 : 120);
    const perfMarch = await ev(() => window.__b89.perf());
    await shot(`${name}-c2-1-march.png`);
    await go('auntie'); await pick(1);
    await go('rumor'); await pick(0);
    await go('south'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'square', { timeout: 20000 });
    await waitFade();
    await sleep(shots ? 900 : 150);
    await waitTrack('square_dawn', 'square');
    const perfSquare = await ev(() => window.__b89.perf());
    if (shots) {
      await shot(`${name}-c2-2-square-dawn.png`);
      for (const [n, x, z, y, mode] of [
        ['c2-3-greathall', -40, -322, -Math.PI / 2, 'cinema'],
        ['c2-3b-museum-square', 56, -322, Math.PI / 2, 'cinema'],
        ['c2-4-north', -10, -300, 0, 'cinema'],
        ['c2-5-monument', 0, -240, Math.PI, 'cinema'],
        ['8b-south-axis', 52, -372, Math.PI + 0.30, 'wide'],
      ]) {
        await ev(a => {
          window.__b89.setCamMode(a[3]);
          window.__b89.placeAt(a[0], a[1]);
          window.__b89.setYaw(a[2]);
        }, [x, z, y, mode]);
        await shot(`${name}-${n}.png`, 700);
      }
      await ev(() => { window.__b89.setCamMode('cinema'); window.__b89.setYaw(-Math.PI / 2); });
    }
    await go('speaker2'); await pick(0);
    await go('oldman'); await pick(1);
    await go('stu2b'); await pick(0);
    await go('steps');
    await shot(`${name}-c2-6-steps.png`);
    await pick(1); await pick(0);
    await go('leave'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'together', { timeout: 15000 });
    await shot(`${name}-c2-7-ending.png`);
    await ev(() => window.__b89.flow());
    await sleep(200);
    const fl = await ev(() => document.getElementById('mbody').innerHTML);
    if (!fl.includes('fc on') || !fl.includes('？？？')) throw new Error('flowchart missing taken/unexplored');
    await shot(`${name}-c2-8-flowchart.png`);
    const st2 = await ev(() => window.__b89.state);
    if (!st2.flags.includes('ch0:end:south') || !st2.history['ch0-0417']) throw new Error('carry-over state missing');
    await ev(() => document.getElementById('mclose').click());
    await go('leave'); await pick(0);
    await nextChapter('ch-0427');
    if ((await ev(() => window.__b89.scene)) !== 'campus') throw new Error('ch-0427 should start in campus');
    const t0427 = await ev(() => document.getElementById('txt').textContent);
    if (!t0427.includes('四月二十二日從西單並肩走回學校')) throw new Error('ch-0427 intro should reflect ch1 "together" ending: ' + t0427);
    await pick(0);
    await go('c0427_zhou'); await pick(0); await pick(0);
    await go('c0427_board'); await pick(0);
    await go('c0427_lin'); await pick(0); await pick(0);
    await go('c0427_gate'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'overpass', { timeout: 20000 });
    await waitFade();
    await sleep(shots ? 700 : 120);
    const perfOverpass = await ev(() => window.__b89.perf());
    await go('c0427_cordon'); await pick(0); await pick(0);
    await go('c0427_bridge'); await pick(0); await pick(0);
    await go('c0427_rumor'); await pick(0);
    await go('c0427_avenue'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'march_day', { timeout: 20000 });
    await waitFade();
    await sleep(shots ? 700 : 120);
    const perfMarchDay = await ev(() => window.__b89.perf());
    await go('c0427_workers'); await pick(0); await pick(0);
    await go('c0427_stu2'); await pick(0); await pick(0);
    await go('c0427_sun'); await pick(0);
    await go('c0427_return'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'linked_arms', { timeout: 15000 });
    await nextChapter('ch-0504');
    if ((await ev(() => window.__b89.scene)) !== 'campus') throw new Error('ch-0504 should start in campus');
    await pick(0);
    await go('c0504_zhou'); await pick(0); await pick(0);
    await go('c0504_board'); await pick(0);
    await go('c0504_lin'); await pick(0); await pick(0);
    await go('c0504_gate'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'march_day', { timeout: 20000 });
    await waitFade();
    await sleep(150);
    await go('c0504_press'); await pick(0); await pick(0);
    await go('c0504_kiosk'); await pick(0); await pick(0);
    await go('c0504_manifesto'); await pick(0);
    await go('c0504_leave'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'press_banners', { timeout: 15000 });
    await nextChapter('ch2-0513');
    if ((await ev(() => window.__b89.scene)) !== 'campus') throw new Error('ch2-0513 should start in campus');
    const t3 = await ev(() => document.getElementById('txt').textContent);
    if (!t3.includes('明天上課嗎')) throw new Error('ch3 intro should reflect ch2 "together" ending: ' + t3);
    await pick(0);
    await go('c3zhou'); await pick(0); await pick(0);
    await go('c3board'); await pick(0);
    await go('c3lin'); await pick(0); await pick(0);
    await go('c3gate'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'street', { timeout: 20000 });
    await waitFade();
    await go('c3kiosk'); await pick(1); await pick(0);
    await go('c3wang'); await pick(0); await pick(0);
    await go('c3medic'); await pick(0); await pick(0);
    await go('c3south'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'camp', { timeout: 20000 });
    await waitFade();
    await ev(() => window.__b89.teleport('c3broadcast'));
    await sleep(shots ? 700 : 120);
    const perfCamp = await ev(() => window.__b89.perf());
    await shot(`${name}-c3-camp.png`);
    await go('c3broadcast'); await pick(0); await pick(0);
    await go('c3tent'); await pick(0); await pick(0);
    await go('c3scholars'); await pick(0); await pick(0);
    await go('c3leave'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'channel', { timeout: 15000 });
    await nextChapter('ch3-0520');
    if ((await ev(() => window.__b89.scene)) !== 'campus') throw new Error('ch3-0520 should start in campus');
    const t4 = await ev(() => document.getElementById('txt').textContent);
    if (!t4.includes('急救通道')) throw new Error('ch4 intro should reflect ch3 "channel" ending: ' + t4);
    await pick(0);
    await go('c4zhou'); await pick(0); await pick(0);
    await go('c4speaker'); await pick(0);
    await go('c4gate'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'blockade', { timeout: 20000 });
    await waitFade();
    await ev(() => window.__b89.teleport('c4wang'));
    await sleep(shots ? 700 : 120);
    const perfBlockade = await ev(() => window.__b89.perf());
    await shot(`${name}-c4-blockade.png`);
    await go('c4wang'); await pick(0); await pick(0);
    await go('c4auntie'); await pick(0); await pick(0);
    await go('c4phone'); await pick(2); await pick(0);
    await go('c4east'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'changan', { timeout: 20000 });
    await waitFade();
    await go('c4lin'); await pick(0); await pick(0);
    await go('c4repair'); await pick(0); await pick(0);
    await go('c4leave'); await pick(2);
    await page.waitForFunction(() => window.__b89.state.ending === 'with_lin', { timeout: 15000 });
    await nextChapter('ch4-0530');
    if ((await ev(() => window.__b89.scene)) !== 'statue') throw new Error('ch4-0530 should start in statue');
    const t5 = await ev(() => document.getElementById('txt').textContent);
    if (!t5.includes('林小梅')) throw new Error('ch5 intro should reflect ch4 "with_lin" ending: ' + t5);
    await pick(0);
    await waitFade();
    await sleep(shots ? 900 : 150);
    const perfStatue = await ev(() => window.__b89.perf());
    await shot(`${name}-c5-statue.png`);
    await go('c5statue'); await pick(0); await pick(0);
    await go('c5stu2'); await pick(1); await pick(0);
    await go('c5lin'); await pick(0); await pick(0);
    await go('c5north'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'street', { timeout: 20000 });
    await waitFade();
    await go('c5kiosk'); await pick(0); await pick(0);
    await go('c5wang'); await pick(0); await pick(0);
    await go('c5back'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'campus', { timeout: 20000 });
    await waitFade();
    await go('c5zhou'); await pick(0); await pick(0);
    await go('c5board'); await pick(0);
    await go('c5dorm'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'persuaded_lin', { timeout: 15000 });
    await nextChapter('ch5-0603');
    if ((await ev(() => window.__b89.scene)) !== 'hutong') throw new Error('ch5-0603 should start in hutong');
    const t6 = await ev(() => document.getElementById('txt').textContent);
    if (!t6.includes('林小梅回校')) throw new Error('ch6 intro should reflect ch5 "persuaded_lin" ending: ' + t6);
    await pick(0);
    await waitFade();
    await sleep(shots ? 900 : 150);
    const perfHutong = await ev(() => window.__b89.perf());
    await shot(`${name}-c6-hutong.png`);
    await go('c6radio'); await pick(0); await pick(0);
    await go('c6wang'); await pick(0); await pick(0);
    await go('c6auntie'); await pick(0); await pick(0);
    await go('c6wait'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'aftermath', { timeout: 20000 });
    await waitFade();
    await sleep(shots ? 900 : 150);
    await waitTrack('aftermath_elegy', 'aftermath');
    const perfAftermath = await ev(() => window.__b89.perf());
    await shot(`${name}-c6-aftermath.png`);
    await go('c6board'); await pick(0);
    await go('c6zhou'); await pick(0); await pick(0);
    await go('c6desk'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'diary_kept', { timeout: 15000 });
    await page.waitForFunction(() => !!document.getElementById('chronicle'), { timeout: 15000 });
    await ev(() => document.getElementById('chronicle').click());
    await sleep(250);
    const chronHtml = await ev(() => document.getElementById('mbody').innerHTML);
    if (!chronHtml.includes('春日紀事') || !chronHtml.includes('全八章總結') || !chronHtml.includes('林小梅')) {
      throw new Error('student 8-chapter chronicle missing expected content');
    }
    await shot(`${name}-c6-chronicle.png`);

    const st8 = await ev(() => window.__b89.state);
    for (const f of [
      'ch0:end:south', 'ch1:end:together', 'ch_0427:end:linked_arms', 'ch_0504:end:press_banners',
      'ch2:end:channel', 'ch3:end:with_lin', 'ch4:end:persuaded_lin',
    ]) {
      if (!st8.flags.includes(f)) throw new Error('missing student carry-over flag: ' + f);
    }
    for (const cid of ['ch0-0417', 'ch1-0422', 'ch-0427', 'ch-0504', 'ch2-0513', 'ch3-0520', 'ch4-0530']) {
      if (!st8.history[cid]) throw new Error('missing student chapter history: ' + cid);
    }

    const perfs = {
      campus: perfCampus, street: perfStreet, changan: perfChangan, march: perfMarch,
      square: perfSquare, overpass: perfOverpass, march_day: perfMarchDay,
      camp: perfCamp, blockade: perfBlockade, statue: perfStatue, hutong: perfHutong, aftermath: perfAftermath,
    };
    h.assertPerfMap(`student-${name}`, perfs);
    console.log(`student-${name}`, JSON.stringify({ ...perfs, ending: st8.ending, diary: st8.diary.length }));
  } finally {
    await h.close();
  }
}

async function runWorker(name, viewport, { clearStorage = false } = {}) {
  const h = await openHarness(`worker-${name}`, viewport, { clearStorage });
  const { page, ev, waitFade, waitTrack, pick, go, nextChapter, shot } = h;
  try {
    await page.click('#vp-worker');
    await page.waitForFunction(() => document.getElementById('vp-worker').classList.contains('active'), { timeout: 10000 });
    await shot(`${name}-w0-title.png`, 250);
    await page.click('#b-watch-all');
    await page.waitForFunction(() => {
      const t = document.getElementById('reel-title')?.textContent || '';
      return t.includes('工人視角') && t.includes('全八章');
    }, { timeout: 15000 });
    await shot(`${name}-w0-reel.png`, 250);
    await page.click('#reel-back');
    await page.click('#b-new');
    await sleep(350);

    // ---- Worker Ch.1 (w0-0417: factory -> street -> courtyard) ----
    await page.waitForFunction(() => window.__b89.state.chapter === 'w0-0417' && window.__b89.dialog, { timeout: 20000 });
    await pick(0);
    await waitFade();
    await sleep(shots ? 900 : 150);
    const perfFactory = await ev(() => window.__b89.perf());
    await shot(`${name}-w1-factory.png`);
    await go('w1lathe'); await pick(0); await pick(0);
    await go('w1apprentice'); await pick(0); await pick(0);
    await go('w1boiler'); await pick(0);
    await go('w1board'); await pick(0);
    await go('w1gate');
    await shot(`${name}-w1-gate.png`);
    await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'street', { timeout: 20000 });
    await waitFade();
    await go('w1kiosk'); await pick(0); await pick(0);
    await go('w1chen'); await pick(0); await pick(0);
    await go('w1speaker'); await pick(0);
    await go('w1home'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'courtyard', { timeout: 20000 });
    await waitFade();
    await sleep(shots ? 900 : 150);
    const perfCourtyard = await ev(() => window.__b89.perf());
    await shot(`${name}-w1-courtyard.png`);
    await go('w1table'); await pick(0); await pick(0);
    await go('w1stove'); await pick(0);
    await go('w1bench'); await pick(1);
    await page.waitForFunction(() => window.__b89.state.ending === 'met_student', { timeout: 15000 });
    await nextChapter('w1-0422');
    await pick(0);
    await go('w2table'); await pick(0); await pick(0);
    await go('w2stove'); await pick(0); await pick(0);
    await go('w2gate'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'street', { timeout: 20000 });
    await waitFade();
    await go('w2zhao'); await pick(0); await pick(0);
    await go('w2chen'); await pick(0); await pick(0);
    await go('w2lin'); await pick(0); await pick(0);
    await go('w2south'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'march', { timeout: 20000 });
    await waitFade();
    await go('w2residents'); await pick(0);
    await go('w2union'); await pick(0); await pick(0);
    await go('w2corner'); await pick(0);
    await go('w2leave'); await pick(1);
    await page.waitForFunction(() => window.__b89.state.ending === 'hot_water', { timeout: 15000 });
    await nextChapter('w-0427');
    if ((await ev(() => window.__b89.scene)) !== 'factory') throw new Error('w-0427 should start in factory');
    await pick(0);
    await go('w0427_zhao'); await pick(0); await pick(0);
    await go('w0427_liu'); await pick(0); await pick(0);
    await go('w0427_boiler'); await pick(0);
    await go('w0427_gate'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'march_day', { timeout: 20000 });
    await waitFade();
    await go('w0427_chen'); await pick(0); await pick(0);
    await go('w0427_workers'); await pick(0);
    await go('w0427_sun'); await pick(0);
    await go('w0427_leave'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'cold_water_at_gate', { timeout: 15000 });
    await nextChapter('w-0504');
    if ((await ev(() => window.__b89.scene)) !== 'factory') throw new Error('w-0504 should start in factory');
    await pick(0);
    await go('w0504_liu'); await pick(0); await pick(0);
    await go('w0504_zhao'); await pick(0); await pick(0);
    await go('w0504_board'); await pick(0);
    await go('w0504_gate'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'street', { timeout: 20000 });
    await waitFade();
    await go('w0504_kiosk'); await pick(0); await pick(0);
    await go('w0504_rumor'); await pick(0);
    await go('w0504_speaker'); await pick(0);
    await go('w0504_home'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'liu_scrapbook', { timeout: 15000 });
    await nextChapter('w2-0513');
    await pick(0);
    await go('w3lathe'); await pick(0); await pick(0);
    await go('w3liu'); await pick(0); await pick(0);
    await go('w3shed'); await pick(0);
    await go('w3gate'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'street', { timeout: 20000 });
    await waitFade();
    await shot(`${name}-w3-tricycle.png`, 800);
    await go('w3kiosk'); await pick(0); await pick(0);
    await go('w3chen'); await pick(0); await pick(0);
    await go('w3medic'); await pick(0); await pick(0);
    await go('w3south'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'camp', { timeout: 20000 });
    await waitFade();
    await go('w3broadcast'); await pick(0); await pick(0);
    await go('w3tents'); await pick(0); await pick(0);
    await go('w3east'); await pick(0);
    await go('w3leave'); await pick(1);
    await page.waitForFunction(() => window.__b89.state.ending === 'lent_thermos', { timeout: 15000 });
    await nextChapter('w3-0520');
    await pick(0);
    await go('w4lathe'); await pick(0); await pick(0);
    await go('w4locker'); await pick(0); await pick(0);
    await go('w4board'); await pick(0);
    await go('w4gate'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'blockade', { timeout: 20000 });
    await waitFade();
    await go('w4driver'); await pick(0); await pick(0);
    await go('w4auntie'); await pick(0); await pick(0);
    await go('w4chen'); await pick(0); await pick(0);
    await go('w4east'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'changan', { timeout: 20000 });
    await waitFade();
    await go('w4tam'); await pick(0);
    await go('w4repair'); await pick(0); await pick(0);
    await go('w4workers'); await pick(0);
    await go('w4leave'); await pick(1);
    await page.waitForFunction(() => window.__b89.state.ending === 'tea_with_soldiers', { timeout: 15000 });
    await nextChapter('w4-0530');
    await pick(0);
    await go('w5sun'); await pick(0); await pick(0);
    await go('w5youth'); await pick(0); await pick(0);
    await go('w5chen'); await pick(0); await pick(0);
    await go('w5north'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'courtyard', { timeout: 20000 });
    await waitFade();
    await waitTrack('courtyard_home', 'courtyard');
    await go('w5table'); await pick(0); await pick(0);
    await go('w5stove'); await pick(0); await pick(0);
    await go('w5pigeon'); await pick(0);
    await go('w5back'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'factory', { timeout: 20000 });
    await waitFade();
    await waitTrack('worker_factory', 'factory');
    await go('w5lathe'); await pick(0); await pick(0);
    await go('w5board'); await pick(0); await pick(0);
    await go('w5shift'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'thermos_returned', { timeout: 15000 });
    await nextChapter('w5-0603');
    await pick(0);
    await go('w6radio'); await pick(0);
    await go('w6chen'); await pick(0); await pick(0);
    await go('w6auntie'); await pick(0); await pick(0);
    await go('w6wait'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'factory_dawn', { timeout: 20000 });
    await waitFade();
    await sleep(shots ? 900 : 150);
    const perfFactoryDawn = await ev(() => window.__b89.perf());
    await shot(`${name}-w6-factory-dawn.png`);
    await go('w6lathe'); await pick(0); await pick(0);
    await go('w6board'); await pick(0); await pick(0);
    await go('w6bench'); await pick(2);
    await page.waitForFunction(() => window.__b89.state.ending === 'thankyou_note', { timeout: 15000 });
    await page.waitForFunction(() => !!document.getElementById('chronicle'), { timeout: 15000 });
    await ev(() => document.getElementById('chronicle').click());
    await sleep(250);
    const chronHtml = await ev(() => document.getElementById('mbody').innerHTML);
    if (!chronHtml.includes('工人視角') || !chronHtml.includes('全八章總結') || !chronHtml.includes('老趙')) {
      throw new Error('worker 8-chapter chronicle missing expected content');
    }
    await shot(`${name}-w6-chronicle.png`);

    const stW = await ev(() => window.__b89.state);
    for (const f of [
      'w0:end:met_student', 'w1:end:hot_water', 'w_0427:end:cold_water_at_gate', 'w_0504:end:liu_scrapbook',
      'w2:end:lent_thermos', 'w3:end:tea_with_soldiers', 'w4:end:thermos_returned',
    ]) {
      if (!stW.flags.includes(f)) throw new Error('missing worker carry-over flag: ' + f);
    }
    for (const cid of ['w0-0417', 'w1-0422', 'w-0427', 'w-0504', 'w2-0513', 'w3-0520', 'w4-0530']) {
      if (!stW.history[cid]) throw new Error('missing worker chapter history: ' + cid);
    }
    const wPerfs = { factory: perfFactory, courtyard: perfCourtyard, factory_dawn: perfFactoryDawn };
    h.assertPerfMap(`worker-${name}`, wPerfs);
    console.log(`${name}-worker`, JSON.stringify({ ...wPerfs, ending: stW.ending, diary: stW.diary.length }));
  } finally {
    await h.close();
  }
}

async function runJournalistPhoneParity() {
  const h = await openHarness('journalist-phone-parity', PHONE_VIEWPORT, { clearStorage: true });
  const { page, ev, pick, shot, assertRectsClean } = h;
  try {
    await assertAllFourViewpointsOnTitle(h);
    await page.click('#vp-journalist');
    await page.waitForFunction(() => document.getElementById('vp-journalist').classList.contains('active'), { timeout: 10000 });
    await assertRectsClean('phone title #vp-switch', '#vp-switch .vp-btn', { containerSelector: '#title .card' });
    await assertRectsClean('phone title action buttons', '#b-new, #b-auto-start, #b-watch-all', { containerSelector: '#title .card' });
    await shot('phone-j0-title.png', 250);

    await page.click('#b-new');
    await page.waitForFunction(() => window.__b89.state.chapter === 'j-0417' && window.__b89.dialog, { timeout: 20000 });
    await pick(0);
    await page.waitForFunction(() => !document.getElementById('b-lens').hidden, { timeout: 10000 });
    await assertRectsClean('phone journalist HUD buttons', '#btns button:not([hidden])');
    await assertRectsClean('phone journalist HUD timeline/guide', '#timeline, #guide');
    await shot('phone-j0-hud.png', 250);

    await page.click('#b-lens');
    await page.waitForFunction(() => window.__b89.camMode === 'viewfinder' && !!document.getElementById('vf-overlay'), { timeout: 10000 });
    await assertRectsClean('phone viewfinder HUD controls', '#vf-frames, .vf-lens-btn, #vf-exit, #vf-meter, #vf-shutter-btn');
    await shot('phone-j0-viewfinder.png', 250);

    await page.click('#vf-exit');
    await page.waitForFunction(() => window.__b89.camMode === 'cinema' && !document.getElementById('vf-overlay'), { timeout: 10000 });
    console.log('journalist-phone-parity ok');
  } finally {
    await h.close();
  }
}

async function runJournalist(name, viewport, { clearStorage = false } = {}) {
  const h = await openHarness(`journalist-${name}`, viewport, { clearStorage });
  const { page, ev, waitFade, waitTrack, pick, go, nextChapter, shot, exitViewfinderIfActive } = h;
  try {
    await assertAllFourViewpointsOnTitle(h);
    await page.click('#vp-journalist');
    await page.waitForFunction(() => document.getElementById('vp-journalist').classList.contains('active'), { timeout: 10000 });
    await shot(`${name}-j0-title.png`, 250);

    await page.click('#b-watch-all');
    await page.waitForFunction(() => {
      const t = document.getElementById('reel-title')?.textContent || '';
      return t.includes('記者視角') && t.includes('全八章');
    }, { timeout: 15000 });
    await page.click('#reel-back');

    await page.click('#b-new');
    await page.waitForFunction(() => window.__b89.state.chapter === 'j-0417' && window.__b89.dialog, { timeout: 20000 });
    if ((await ev(() => window.__b89.scene)) !== 'newsroom') throw new Error('j-0417 should start in newsroom');

    // ---- Journalist Ch.1 (j-0417: newsroom -> street) ----
    await pick(0);
    await waitTrack('press_night', 'newsroom');
    const perfNewsroom = await ev(() => window.__b89.perf());
    await shot(`${name}-j1-newsroom.png`, 700);
    await go('j1_shen'); await pick(0); await pick(0);
    await go('j1_telex'); await pick(0);
    await go('j1_exit_street'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'street', { timeout: 20000 });
    await waitFade();
    const rigStreet = await ev(() => window.__b89.playerRigInfo());
    if (rigStreet.mode !== 'bike' || !rigStreet.hasHead || !rigStreet.hasWheels) {
      throw new Error('expected animated head + rotating wheels on bike rig: ' + JSON.stringify(rigStreet));
    }
    await go('j1_sun'); await pick(0); await pick(0);
    await go('j1_street_vantage'); await pick(0); await pick(0);

    // 35mm Viewfinder test: F key / #b-lens / 35mm-50mm-85mm lenses / target lock / #vf-shutter-btn + capturePhoto()
    await ev(() => {
      window.__b89.placeAt(-6, 4);
      window.__b89.setYaw(Math.PI);
      window.__b89.setPitch(0);
    });
    await page.keyboard.press('f');
    await page.waitForFunction(() => window.__b89.camMode === 'viewfinder' && !!document.getElementById('vf-overlay'), { timeout: 10000 });
    await page.waitForFunction(() => document.getElementById('vf-reticle')?.classList.contains('locked'), { timeout: 10000 });

    for (const [mm, key] of [[50, '2'], [85, '3'], [35, '1']]) {
      await page.keyboard.press(key);
      await page.waitForFunction(m => {
        const meter = document.getElementById('vf-meter')?.textContent || '';
        const btn = document.querySelector(`.vf-lens-btn[data-lens="${m}"]`);
        return meter.includes(`${m}mm`) && Boolean(btn?.classList.contains('on'));
      }, { timeout: 8000 }, mm);
    }
    await page.keyboard.press('v'); // cycles 35 -> 50
    await page.waitForFunction(() => (document.getElementById('vf-meter')?.textContent || '').includes('50mm'), { timeout: 8000 });
    await page.click('.vf-lens-btn[data-lens="35"]');
    await page.waitForFunction(() => (document.getElementById('vf-meter')?.textContent || '').includes('35mm'), { timeout: 8000 });
    await shot(`${name}-j1-viewfinder.png`, 250);

    await page.click('#vf-shutter-btn');
    await page.waitForFunction(() => (window.__b89.state.photos || []).includes('j1_pt_kiosk'), { timeout: 10000 });
    const framesAfterBtn = await ev(() => document.getElementById('vf-frames')?.textContent || '');
    if (!framesAfterBtn.includes('35/36')) {
      throw new Error('expected 35/36 frames remaining after shutter click, got ' + framesAfterBtn);
    }

    // Also verify window.__b89.capturePhoto() directly on j1_pt_speaker
    const capRes = await ev(() => {
      window.__b89.placeAt(6, 6);
      window.__b89.setYaw(Math.PI);
      window.__b89.setPitch(0.40);
      return window.__b89.capturePhoto();
    });
    if (!capRes.matched.includes('j1_pt_speaker') || !capRes.photos.includes('j1_pt_speaker')) {
      throw new Error('capturePhoto() missed j1_pt_speaker: ' + JSON.stringify(capRes));
    }
    await exitViewfinderIfActive();

    // Evidence Dossier (#b-diary) neutral verdict pairings check
    await page.click('#b-diary');
    await page.waitForFunction(() => !document.getElementById('modal').hidden && !!document.querySelector('[data-diary-tab="evidence"]'), { timeout: 10000 });
    await page.click('[data-diary-tab="evidence"]');
    for (const [cardA, cardB, expectedLabel] of [
      ['j1_ev_rumor_crowd', 'j1_ev_witness_street', '說法存在出入'],
      ['j1_ev_wire', 'j1_ev_bulletin', '兩份紀錄吻合'],
      ['j1_ev_photo_street', 'j1_ev_rumor_crowd', '尚無旁證'],
    ]) {
      await page.click('#ev-clear-btn');
      await page.click(`.ev-card-btn[data-card-id="${cardA}"]`);
      await page.click(`.ev-card-btn[data-card-id="${cardB}"]`);
      await page.waitForFunction(() => !document.getElementById('ev-compare-btn').disabled, { timeout: 8000 });
      await page.click('#ev-compare-btn');
      const dedTxt = await ev(() => document.getElementById('ev-deduction-out')?.textContent || '');
      if (!dedTxt.includes(expectedLabel)) {
        throw new Error(`evidence dossier expected "${expectedLabel}" for ${cardA}+${cardB}, got: ${dedTxt}`);
      }
      if (/score|分數|正確答案|滿分|答對|答錯/i.test(dedTxt)) {
        throw new Error(`evidence dossier contains non-neutral scoring wording: ${dedTxt}`);
      }
    }
    await shot(`${name}-j1-evidence-dossier.png`, 200);

    // 35mm Silver-Gelatin Darkroom Contact Sheet check
    await page.click('[data-diary-tab="darkroom"]');
    await page.waitForFunction(() => document.querySelectorAll('.dr-frame img').length >= 2, { timeout: 8000 });
    await page.click('#dr-safelight-toggle');
    await page.waitForFunction(() => document.querySelector('.dr-wrap')?.classList.contains('safelight'), { timeout: 5000 });
    await page.click('#dr-safelight-toggle');
    await page.click('.dr-frame[data-dr-idx="1"]');
    await page.click('#dr-select-print');
    const drInfo = await ev(() => ({
      frames: document.querySelectorAll('.dr-frame').length,
      validUrls: [...document.querySelectorAll('.dr-frame img')].every(img => img.src.startsWith('data:image/jpeg') && img.src.length > 200),
      loupeCap: document.getElementById('dr-loupe-cap')?.textContent || '',
    }));
    if (drInfo.frames < 2 || !drInfo.validUrls || !drInfo.loupeCap) {
      throw new Error('darkroom contact sheet verification failed: ' + JSON.stringify(drInfo));
    }
    await shot(`${name}-j1-darkroom.png`, 200);
    await page.click('#mclose');
    await page.waitForFunction(() => document.getElementById('modal').hidden, { timeout: 8000 });

    // 1980s 64mo Lianhuanhua Flipbook & Visual Look verification
    await page.click('#b-book');
    await page.waitForFunction(() => !document.getElementById('modal').hidden && !!document.querySelector('.lh-book'), { timeout: 8000 });
    await page.click('#book-next');
    await page.waitForFunction(() => {
      const img = document.querySelector('.lh-plate-frame img');
      return !!img && img.complete && img.naturalWidth > 0;
    }, { timeout: 10000 });
    await ev(() => {
      window.__b89.setVisualLook('lianhuanhua');
      if (window.__b89.getVisualLook() !== 'lianhuanhua') throw new Error('setVisualLook failed');
      window.__b89.setVisualLook('filmic');
    });
    await shot(`${name}-0e-lianhuanhua-book.png`, 200);
    await page.click('#mclose');
    await page.waitForFunction(() => document.getElementById('modal').hidden, { timeout: 8000 });

    // Route 2 Part C/E checks: Tactile Bulletin Board Inspector, Typesetting Proof Desk & Accessibility Settings
    await ev(() => { void window.__b89.openArtifact('bulletin'); });
    await page.waitForFunction(() => !document.getElementById('modal').hidden && !!document.querySelector('.bb-sheet[data-sheet="mimeo"]'), { timeout: 10000 });
    await page.click('.bb-sheet[data-sheet="mimeo"]');
    await page.click('#bb-save-note');
    const bbStatus = await ev(() => document.getElementById('bb-save-status')?.textContent || '');
    if (!bbStatus.includes('已摘錄')) throw new Error('bulletin board note excerpt failed: ' + bbStatus);
    await shot(`${name}-c-bulletin-board.png`, 150);
    await page.click('#mclose');
    await page.waitForFunction(() => document.getElementById('modal').hidden, { timeout: 8000 });

    await ev(() => { void window.__b89.openArtifact('typesetting'); });
    await page.waitForFunction(() => !document.getElementById('modal').hidden && !!document.getElementById('ts-commit'), { timeout: 10000 });
    const headBefore = await ev(() => document.getElementById('ts-head-out')?.textContent || '');
    await page.click('.ts-slug[data-galley="headline"][data-idx="0"]');
    await page.click('#ts-commit');
    const tsCheck = await ev(() => ({
      headAfter: document.getElementById('ts-head-out')?.textContent || '',
      status: document.getElementById('ts-commit-status')?.textContent || '',
    }));
    if (tsCheck.headAfter === headBefore || !tsCheck.status.includes('已簽存')) {
      throw new Error('typesetting proof verification failed: ' + JSON.stringify({ headBefore, ...tsCheck }));
    }
    await shot(`${name}-c-typesetting-desk.png`, 150);
    await page.click('#mclose');
    await page.waitForFunction(() => document.getElementById('modal').hidden, { timeout: 8000 });

    const setFontOk = await ev(() => {
      window.__b89.updateSettings({ fontSize: 'large' });
      const applied = document.documentElement.dataset.fontSize;
      window.__b89.updateSettings({ fontSize: 'normal' });
      return applied === 'large' && document.documentElement.dataset.fontSize === 'normal';
    });
    if (!setFontOk) throw new Error('accessibility fontSize setting update failed');

    // 1989 Cartogram & Temporal Switcher (#b-map)
    await page.click('#b-map');
    await page.waitForFunction(() => !document.getElementById('modal').hidden && !!document.querySelector('.map-svg') && !!document.querySelector('.tl-matrix'), { timeout: 10000 });
    const mapStats = await ev(() => ({
      nodes: document.querySelectorAll('.map-svg .map-node').length,
      cols: document.querySelectorAll('.tl-matrix thead th').length,
      activeCell: Boolean(document.querySelector('.tl-cell.active[data-vp="journalist"][data-ch="j-0417"]')),
    }));
    if (mapStats.nodes !== 24 || mapStats.cols !== 5 || !mapStats.activeCell) {
      throw new Error('cartogram/timeline modal structure mismatch: ' + JSON.stringify(mapStats));
    }
    await page.click('[data-map-tab="cartogram"]');
    if (!(await ev(() => !document.querySelector('[data-map-pane="cartogram"]').hidden && document.querySelector('[data-map-pane="timeline"]').hidden))) {
      throw new Error('cartogram tab toggle failed');
    }
    await page.click('[data-map-tab="timeline"]');
    if (!(await ev(() => document.querySelector('[data-map-pane="cartogram"]').hidden && !document.querySelector('[data-map-pane="timeline"]').hidden))) {
      throw new Error('timeline tab toggle failed');
    }
    await page.click('[data-map-tab="both"]');
    await shot(`${name}-j1-cartogram-timeline.png`, 200);
    await page.keyboard.press('m');
    await page.waitForFunction(() => document.getElementById('modal').hidden, { timeout: 8000 });

    await go('j1_end_corner'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'verified_desk', { timeout: 15000 });
    await nextChapter('j-0422');
    if ((await ev(() => window.__b89.scene)) !== 'beijing_hotel_balcony') throw new Error('j-0422 should start in beijing_hotel_balcony');
    await pick(0);
    await sleep(shots ? 750 : 120);
    const perfBalcony = await ev(() => window.__b89.perf());
    await shot(`${name}-j2-beijing-hotel-balcony.png`);
    await go('j2_wire_desk'); await pick(0); await pick(0);
    await go('j2_balcony_lens'); await pick(0);
    await page.waitForFunction(() => window.__b89.camMode === 'viewfinder', { timeout: 10000 });
    await exitViewfinderIfActive();
    await go('j2_balcony_exit'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'square', { timeout: 20000 });
    await waitFade();
    await go('j2_broadcast'); await pick(0);
    await go('j2_cordon'); await pick(0); await pick(0);
    await go('j2_square_exit'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'two_columns_kept', { timeout: 15000 });
    await nextChapter('j-0427');
    await pick(0);
    await go('j3_shen_proof'); await pick(0); await pick(0);
    await go('j3_zhang_type'); await pick(0);
    await go('j3_exit_overpass'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'overpass', { timeout: 20000 });
    await waitFade();
    await sleep(shots ? 750 : 120);
    const perfOverpass = await ev(() => window.__b89.perf());
    await shot(`${name}-j3-overpass.png`);
    await go('j3_bridge_vantage'); await pick(0);
    await page.waitForFunction(() => window.__b89.camMode === 'viewfinder', { timeout: 10000 });
    await exitViewfinderIfActive();
    await go('j3_bridge_citizens'); await pick(0); await pick(0);
    await go('j3_exit_end'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'overpass_wide_frame', { timeout: 15000 });
    await nextChapter('j-0504');
    await pick(0);
    await go('j4_press_column'); await pick(0); await pick(0);
    await go('j4_march_vantage'); await pick(0);
    await page.waitForFunction(() => window.__b89.camMode === 'viewfinder', { timeout: 10000 });
    await exitViewfinderIfActive();
    await go('j4_rumor_corner'); await pick(0);
    await go('j4_exit_newsroom'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'newsroom', { timeout: 20000 });
    await waitFade();
    await go('j4_zhang_galley'); await pick(0);
    await go('j4_shen_edition'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'press_published', { timeout: 15000 });
    await nextChapter('j-0513');
    await pick(0);
    await go('j5_balcony_dispatch'); await pick(0); await pick(0);
    await go('j5_balcony_lens'); await pick(0);
    await page.waitForFunction(() => window.__b89.camMode === 'viewfinder', { timeout: 10000 });
    await exitViewfinderIfActive();
    await go('j5_balcony_exit'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'camp', { timeout: 20000 });
    await waitFade();
    await go('j5_camp_mediation'); await pick(0);
    await go('j5_camp_triage'); await pick(0);
    await go('j5_camp_exit'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'verified_wire_sent', { timeout: 15000 });
    await nextChapter('j-0520');
    await pick(0);
    await go('j6m_news_shen'); await pick(0); await pick(0);
    await go('j6m_news_zhang'); await pick(0);
    await go('j6m_news_exit'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'blockade', { timeout: 20000 });
    await waitFade();
    await go('j6m_blockade_barricade'); await pick(0); await pick(0);
    await go('j6m_blockade_subway'); await pick(0); await pick(0);
    await go('j6m_blockade_exit'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'tape_of_xidan', { timeout: 15000 });
    await nextChapter('j-0530');
    if ((await ev(() => window.__b89.scene)) !== 'changan_rain') throw new Error('j-0530 should start in changan_rain');
    await pick(0);
    await waitFade();
    await waitTrack('rain_square', 'changan_rain');
    await sleep(shots ? 750 : 120);
    const perfChanganRain = await ev(() => window.__b89.perf());
    await shot(`${name}-j7-changan-rain.png`);
    await go('j7_rain_avenue'); await pick(0);
    await go('j7_rain_fatigue'); await pick(0);
    await go('j7_rain_vantage'); await pick(0);
    await page.waitForFunction(() => window.__b89.camMode === 'viewfinder', { timeout: 10000 });
    await exitViewfinderIfActive();
    await go('j7_rain_exit'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'beijing_hotel_balcony', { timeout: 20000 });
    await waitFade();
    await go('j7_balcony_photo'); await pick(0);
    await page.waitForFunction(() => window.__b89.camMode === 'viewfinder', { timeout: 10000 });
    await exitViewfinderIfActive();
    await go('j7_balcony_end'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'telephoto_contact', { timeout: 15000 });
    await nextChapter('j-0603');
    await pick(0);
    await go('j8_news_night'); await pick(0); await pick(0);
    await go('j8_news_to_hosp'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'hospital_gate', { timeout: 20000 });
    await waitFade();
    await sleep(shots ? 750 : 120);
    const perfHospital = await ev(() => window.__b89.perf());
    await shot(`${name}-j8-hospital-gate.png`);
    await go('j8_hosp_fang'); await pick(0); await pick(0);
    await go('j8_hosp_return'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'newsroom', { timeout: 20000 });
    await waitFade();
    await go('j8_news_morning'); await pick(0); await pick(0);
    await go('j8_darkroom_end'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'hidden_negatives', { timeout: 15000 });

    await page.waitForFunction(() => !!document.getElementById('chronicle'), { timeout: 15000 });
    await ev(() => document.getElementById('chronicle').click());
    await sleep(250);
    const chronHtml = await ev(() => document.getElementById('mbody').innerHTML);
    if (!chronHtml.includes('記者視角') || !chronHtml.includes('全八章總結') || !chronHtml.includes('顧明遠')) {
      throw new Error('journalist 8-chapter chronicle missing expected content');
    }

    const stJ = await ev(() => window.__b89.state);
    for (const f of [
      'j0:end:verified_desk', 'j1:end:two_columns_kept', 'j_0427:end:overpass_wide_frame', 'j_0504:end:press_published',
      'j2:end:verified_wire_sent', 'j3:end:tape_of_xidan', 'j4:end:telephoto_contact',
    ]) {
      if (!stJ.flags.includes(f)) throw new Error('missing journalist carry-over flag: ' + f);
    }

    // Capture unobstructed xinhua_gate scene screenshot while playing === true
    await page.click('#mclose');
    await page.waitForFunction(() => document.getElementById('modal').hidden, { timeout: 8000 });
    const xh = await ev(() => {
      const r = window.__b89.inspectScene('xinhua_gate');
      window.__b89.setCamMode('cinema');
      return r;
    });
    await shot(`${name}-xinhua-gate.png`, 700);

    const jPerfs = {
      newsroom: perfNewsroom,
      beijing_hotel_balcony: perfBalcony,
      overpass: perfOverpass,
      changan_rain: perfChanganRain,
      hospital_gate: perfHospital,
      xinhua_gate: xh.perf,
    };
    h.assertPerfMap(`journalist-${name}`, jPerfs);
    console.log(`${name}-journalist`, JSON.stringify({ ...jPerfs, ending: stJ.ending, photos: stJ.photos.length, diary: stJ.diary.length }));
  } finally {
    await h.close();
  }
}

async function runResident(name, viewport, { clearStorage = false } = {}) {
  const h = await openHarness(`resident-${name}`, viewport, { clearStorage });
  const { page, ev, waitFade, waitTrack, pick, go, nextChapter, shot, tuneShortwaveAndConfirm } = h;
  try {
    await page.click('#vp-resident');
    await page.waitForFunction(() => document.getElementById('vp-resident').classList.contains('active'), { timeout: 10000 });
    await page.click('#b-new');
    await page.waitForFunction(() => window.__b89.state.chapter === 'r-0417' && window.__b89.dialog, { timeout: 20000 });
    if ((await ev(() => window.__b89.scene)) !== 'siheyuan_room') throw new Error('r-0417 should start in siheyuan_room');

    // ---- Resident Ch.1 (r-0417: siheyuan_room -> street -> courtyard) + Shortwave Dial Tuner ----
    await pick(0);
    await sleep(shots ? 750 : 120);
    const perfSiheyuan = await ev(() => window.__b89.perf());
    await shot(`${name}-r1-siheyuan-room.png`);
    await go('r1_radio');
    await pick(0); // opens Shortwave Dial Tuner modal
    await tuneShortwaveAndConfirm(`${name}-r1-shortwave.png`);
    await page.waitForFunction(() => window.__b89.dialog, { timeout: 15000 });
    await pick(0);
    await go('r1_door'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'street', { timeout: 20000 });
    await waitFade();
    await go('r1_store'); await pick(0); await pick(0);
    await go('r1_kiosk'); await pick(0); await pick(0);
    await go('r1_alley'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'courtyard', { timeout: 20000 });
    await waitFade();
    await go('r1_zhang'); await pick(0); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'r1_radio_notes', { timeout: 15000 });
    await nextChapter('r-0422');
    if ((await ev(() => window.__b89.scene)) !== 'morning_market') throw new Error('r-0422 should start in morning_market');
    await pick(0);
    await waitTrack('market_morning', 'morning_market');
    await sleep(shots ? 750 : 120);
    const perfMarket = await ev(() => window.__b89.perf());
    await shot(`${name}-r2-morning-market.png`);
    await go('r2_market_stall'); await pick(0); await pick(0);
    await go('r2_grain_radio'); await pick(0); await pick(0);
    await go('r2_chen_corner'); await pick(0); await pick(0);
    await go('r2_hutong_gate'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'courtyard_day', { timeout: 20000 });
    await waitFade();
    await sleep(120);
    const perfCourtyardDay = await ev(() => window.__b89.perf());
    await go('r2_yard_table'); await pick(0); await pick(0);
    await go('r2_yard_tree'); await pick(0); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'r2_market_thermos', { timeout: 15000 });
    await nextChapter('r-0427');
    await pick(0);
    await go('r3_yard_radio'); await pick(0); await pick(0);
    await go('r3_yard_prep'); await pick(0);
    await go('r3_yard_exit'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'overpass', { timeout: 20000 });
    await waitFade();
    await go('r3_bridge_water'); await pick(0); await pick(0);
    await go('r3_bridge_rail'); await pick(0); await pick(0);
    await go('r3_bridge_east'); await pick(0); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'r3_brought_xiaojun_home', { timeout: 15000 });
    await nextChapter('r-0504');
    await pick(0);
    await go('r4_radio');
    await pick(0); // opens Shortwave Dial Tuner modal
    await tuneShortwaveAndConfirm();
    await page.waitForFunction(() => window.__b89.dialog, { timeout: 15000 });
    await pick(0);
    await go('r4_door'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'morning_market', { timeout: 20000 });
    await waitFade();
    await go('r4_kiosk'); await pick(0); await pick(0);
    await go('r4_grain_shop'); await pick(0); await pick(0);
    await go('r4_market_stall'); await pick(0); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'r4_verify_print', { timeout: 15000 });
    await nextChapter('r-0513');
    await pick(0);
    await go('r5_clinic_box'); await pick(0); await pick(0);
    await go('r5_zhang_tv'); await pick(0); await pick(0);
    await go('r5_gate_out'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'hospital_gate', { timeout: 20000 });
    await waitFade();
    await go('r5_triage_tent'); await pick(0); await pick(0);
    await go('r5_thermos_cart'); await pick(0); await pick(0);
    await go('r5_hospital_notice'); await pick(0); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'r5_clinic_gauze', { timeout: 15000 });
    await nextChapter('r-0520');
    await pick(0);
    await go('r6_radio');
    await pick(0); // opens Shortwave Dial Tuner modal
    await tuneShortwaveAndConfirm();
    await page.waitForFunction(() => window.__b89.dialog, { timeout: 15000 });
    await pick(0);
    await go('r6_door'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'hutong', { timeout: 20000 });
    await waitFade();
    await go('r6_hongmen'); await pick(0); await pick(0);
    await go('r6_hutong_exit'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'blockade', { timeout: 20000 });
    await waitFade();
    await go('r6_payphone'); await pick(0); await pick(0);
    await go('r6_barricade'); await pick(0); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'r6_queue_calm', { timeout: 15000 });
    await nextChapter('r-0530');
    await pick(0);
    await go('r7_kiosk'); await pick(0); await pick(0);
    await go('r7_ration_queue'); await pick(0); await pick(0);
    await go('r7_gu_market'); await pick(0); await pick(0);
    await go('r7_market_exit'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'courtyard_day', { timeout: 20000 });
    await waitFade();
    await go('r7_zhang_grain'); await pick(0); await pick(0);
    await go('r7_xiaojun_courtyard'); await pick(0); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'r7_grain_shared', { timeout: 15000 });
    await nextChapter('r-0603');
    await pick(0);
    await go('r8_room_radio'); await pick(0); await pick(0);
    await go('r8_room_door'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'courtyard', { timeout: 20000 });
    await waitFade();
    await go('r8_courtyard_gate'); await pick(0); await pick(0);
    await go('r8_courtyard_exit'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'morning_market', { timeout: 20000 });
    await waitFade();
    await go('r8_swept_alley'); await pick(0); await pick(0);
    await go('r8_chronicle_end'); await pick(0);
    await page.waitForFunction(() => window.__b89.state.ending === 'red_gate_open', { timeout: 15000 });

    const stR = await ev(() => window.__b89.state);
    for (const f of [
      'r0:end:r1_radio_notes', 'r1:end:r2_market_thermos', 'r_0427:end:r3_brought_xiaojun_home', 'r_0504:end:r4_verify_print',
      'r2:end:r5_clinic_gauze', 'r3:end:r6_queue_calm', 'r4:end:r7_grain_shared',
    ]) {
      if (!stR.flags.includes(f)) throw new Error('missing resident carry-over flag: ' + f);
    }

    // If --shard=resident ran standalone without prior routes, jump via Temporal Switcher to seed Student ch-0504 snapshot + Journalist j-0504 commit
    const routeCount = await ev(() => Object.keys(window.__b89.ledger?.routeRecords ?? {}).length);
    if (routeCount < 2) {
      await ev(() => document.getElementById('mclose').click());
      await page.click('#b-map');
      await page.waitForFunction(() => !!document.querySelector('[data-jump-vp="student"][data-jump-ch="ch-0504"]'), { timeout: 10000 });
      await page.click('[data-jump-vp="student"][data-jump-ch="ch-0504"]');
      await page.waitForFunction(() => window.__b89.state.chapter === 'ch-0504' && window.__b89.dialog, { timeout: 20000 });
      await waitFade();
      await pick(0);
      await go('c0504_gate'); await pick(0);
      await page.waitForFunction(() => window.__b89.scene === 'march_day', { timeout: 20000 });
      await waitFade();
      await go('c0504_leave'); await pick(0);
      await page.waitForFunction(() => window.__b89.state.ending === 'back_to_class', { timeout: 15000 });

      await ev(() => document.getElementById('mclose').click());
      await page.click('#b-map');
      await page.waitForFunction(() => !!document.querySelector('[data-jump-vp="journalist"][data-jump-ch="j-0504"]'), { timeout: 10000 });
      await page.click('[data-jump-vp="journalist"][data-jump-ch="j-0504"]');
      await page.waitForFunction(() => window.__b89.state.chapter === 'j-0504' && window.__b89.dialog, { timeout: 20000 });
      await waitFade();
      await pick(0);
      await go('j4_exit_newsroom'); await pick(0);
      await page.waitForFunction(() => window.__b89.scene === 'newsroom', { timeout: 20000 });
      await waitFade();
      await go('j4_shen_edition'); await pick(0);
      await page.waitForFunction(() => window.__b89.state.ending === 'press_published', { timeout: 15000 });

      await ev(() => document.getElementById('mclose').click());
      await page.click('#b-map');
      const rBtn = '[data-jump-vp="resident"][data-jump-ch="r-0603"]';
      await page.waitForFunction(sel => !!document.querySelector(sel), { timeout: 10000 }, rBtn);
      await page.click(rBtn);
      await page.waitForFunction(() => !!document.getElementById('snap-sync') || (window.__b89.state.chapter === 'r-0603' && window.__b89.dialog), { timeout: 15000 });
      if (await ev(() => !!document.getElementById('snap-sync'))) await page.click('#snap-sync');
      await page.waitForFunction(() => window.__b89.state.chapter === 'r-0603' && window.__b89.dialog, { timeout: 20000 });
      await waitFade();
      await pick(0);
      await go('r8_room_door'); await pick(0);
      await page.waitForFunction(() => window.__b89.scene === 'courtyard', { timeout: 20000 });
      await waitFade();
      await go('r8_courtyard_gate'); await pick(0); await pick(0);
      await go('r8_courtyard_exit'); await pick(0);
      await page.waitForFunction(() => window.__b89.scene === 'morning_market', { timeout: 20000 });
      await waitFade();
      await go('r8_chronicle_end'); await pick(0);
      await page.waitForFunction(() => window.__b89.state.ending === 'red_gate_open', { timeout: 15000 });
    }

    // ---- Verify Cross-Route Rashomon Chronicle (五、四線對照・真相拼圖) ----
    await page.waitForFunction(() => !!document.getElementById('chronicle'), { timeout: 15000 });
    await ev(() => document.getElementById('chronicle').click());
    await sleep(250);
    const rashomon = await ev(() => {
      const html = document.getElementById('mbody').innerHTML;
      const tbl = document.querySelector('.rashomon-table');
      return {
        hasSection: html.includes('五、四線對照・真相拼圖'),
        hasResident: html.includes('市民視角') && html.includes('全八章總結'),
        doneCells: document.querySelectorAll('.rashomon-cell.done').length,
        hasCommits: Boolean(document.querySelector('.rashomon-commits li')),
        hasExportBtns: Boolean(document.getElementById('chron-darkroom') && document.getElementById('chron-book') && document.getElementById('chron-export')),
        hasBannedTerms: /score|分數|正確答案|kill|擊殺/i.test(html),
        headers: tbl ? [...tbl.querySelectorAll('thead th')].map(th => th.textContent) : [],
      };
    });
    if (!rashomon.hasSection || !rashomon.hasResident || rashomon.doneCells < 8 || !rashomon.hasCommits || !rashomon.hasExportBtns || rashomon.hasBannedTerms) {
      throw new Error('Rashomon chronicle verification failed: ' + JSON.stringify(rashomon));
    }
    if (SHARDS.student && SHARDS.worker && SHARDS.journalist && rashomon.doneCells < 32) {
      throw new Error(`expected all 32 cells done in full 4-route Rashomon chronicle, got ${rashomon.doneCells}`);
    }
    await shot(`${name}-r8-rashomon-chronicle.png`);

    // ---- Verify Interwoven 4-Route Documentary Reel (#reel-interwoven) ----
    await page.click('#chron-back');
    await page.waitForFunction(() => !!document.querySelector('#end-cine .cine-play-btn'), { timeout: 10000 });
    await page.click('#end-cine .cine-play-btn');
    await page.waitForFunction(() => !!document.getElementById('reel-interwoven'), { timeout: 10000 });
    await page.click('#reel-interwoven');
    await page.waitForFunction(() => document.getElementById('reel-interwoven')?.classList.contains('active'), { timeout: 10000 });
    await page.click('.rspeed-btn[data-speed="6"]');
    await page.click('.rview-btn[data-view="quad"]');
    await sleep(400);
    const reelInfo = await ev(() => {
      const title = document.getElementById('reel-title')?.textContent || '';
      const speedTxt = document.getElementById('reel-speed')?.textContent || '';
      const c = document.getElementById('reel-c');
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let nonZero = 0;
      for (let i = 0; i < data.length; i += 64) {
        if (data[i] + data[i + 1] + data[i + 2] > 15) nonZero++;
      }
      return { title, speedTxt, nonZero };
    });
    if (!reelInfo.title.includes('四線交織編年長片') || !/\/32[)）]/.test(reelInfo.title) || reelInfo.speedTxt !== '倍速：6x' || reelInfo.nonZero < 10) {
      throw new Error('interwoven reel verification failed: ' + JSON.stringify(reelInfo));
    }
    await shot(`${name}-r8-interwoven-reel.png`);
    await page.click('#mclose');
    await page.waitForFunction(() => document.getElementById('modal').hidden, { timeout: 8000 });

    // ---- Verify WorldTimelineLedger Drift & Sync Without Re-grinding ----
    await page.click('#b-map');
    await page.waitForFunction(() => !!document.querySelector('[data-map-tab="timeline"]'), { timeout: 10000 });
    await page.click('[data-map-tab="timeline"]');
    const syncSelector = '[data-drift-action="sync"][data-jump-vp="student"][data-jump-ch="ch-0504"]';
    await page.waitForFunction(sel => !!document.querySelector(sel), { timeout: 10000 }, syncSelector);
    await page.click(syncSelector);
    await page.waitForFunction(() => window.__b89.state.chapter === 'ch-0504' && window.__b89.dialog, { timeout: 20000 });
    await waitFade();
    await pick(0);
    await go('c0504_gate'); await pick(0);
    await page.waitForFunction(() => window.__b89.scene === 'march_day', { timeout: 20000 });
    await waitFade();
    await go('c0504_press');
    const syncedTxt = await ev(() => document.getElementById('txt').textContent || '');
    if (!syncedTxt.includes('值班主編頂著壓力') && !syncedTxt.includes('發排見報')) {
      throw new Error('expected Student ch-0504 to reflect cross-route xr:press_0504_published after WorldTimelineLedger sync, got: ' + syncedTxt);
    }

    const rPerfs = { siheyuan_room: perfSiheyuan, morning_market: perfMarket, courtyard_day: perfCourtyardDay };
    h.assertPerfMap(`resident-${name}`, rPerfs);
    console.log(`${name}-resident`, JSON.stringify({
      ...rPerfs,
      ending: stR.ending,
      diary: stR.diary.length,
      rashomonDone: rashomon.doneCells,
      interwoven: reelInfo.title,
      worldSyncOk: true,
    }));
  } finally {
    await h.close();
  }
}

try {
  if (SHARDS.render) {
    await runOpening();
    await runRenderAndLeakAudit('phone', PHONE_VIEWPORT);
    await runRenderAndLeakAudit('desktop', DESKTOP_VIEWPORT);
  }

  if (runPhoneRoutes && SHARDS.student) {
    await runStudent('phone', PHONE_VIEWPORT);
  }
  if (runPhoneRoutes && SHARDS.journalist) {
    await runJournalistPhoneParity();
  }

  let desktopCleared = false;
  const takeDesktopClearFlag = () => {
    if (!desktopCleared) {
      desktopCleared = true;
      return true;
    }
    return false;
  };

  if (runDesktopRoutes && SHARDS.student) {
    await runStudent('desktop', DESKTOP_VIEWPORT);
    desktopCleared = true;
  }
  if (runDesktopRoutes && SHARDS.worker) {
    await runWorker('desktop', DESKTOP_VIEWPORT, { clearStorage: takeDesktopClearFlag() });
  }
  if (runDesktopRoutes && SHARDS.journalist) {
    await runJournalist('desktop', DESKTOP_VIEWPORT, { clearStorage: takeDesktopClearFlag() });
  }
  if (runDesktopRoutes && SHARDS.resident) {
    await runResident('desktop', DESKTOP_VIEWPORT, { clearStorage: takeDesktopClearFlag() });
  }

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('smoke ok');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await Promise.race([browser.close().catch(() => {}), sleep(2000)]);
  try { browser.process()?.kill('SIGKILL'); } catch {}
  try { server.httpServer.closeAllConnections?.(); } catch {}
  await Promise.race([server.close().catch(() => {}), sleep(1000)]);
  try { server.httpServer.close(); } catch {}
  process.exit(process.exitCode || 0);
}
