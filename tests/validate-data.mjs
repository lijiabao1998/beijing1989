// Data & asset integrity guardrail for the full 4-route, 32-chapter, 36-event, 24-scene, 22-audio game.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const fail = m => {
  console.error('FAIL', m);
  process.exitCode = 1;
};

const KINDS = ['historical', 'testimony', 'fiction'];
const CONF = ['documented', 'testimony', 'uncertain'];
const VIEWPOINTS = ['student', 'worker', 'journalist', 'resident'];
const EVIDENCE_KINDS = ['official_print', 'rumor', 'witness', 'photo', 'audio_tape'];
const VERDICTS = ['corroborated', 'contradiction', 'unverified'];
const VERDICT_LABELS = {
  corroborated: '兩份紀錄吻合',
  contradiction: '說法存在出入',
  unverified: '尚無旁證',
};
const EXPECTED_AUDIO_CUES = [
  // 14 baseline cues
  'title_chronicle', 'campus_night', 'street_avenue', 'march_anthem',
  'square_dawn', 'camp_vigil', 'martial_tension', 'statue_twilight',
  'hutong_vigil', 'aftermath_elegy', 'worker_factory', 'courtyard_home',
  'stinger_chapter', 'stinger_ending',
  // 8 expansion cues
  'press_night', 'xinhua_vigil', 'march_day_surge', 'rain_square',
  'market_morning', 'hospital_watch', 'stinger_shutter', 'stinger_dispatch',
];
const AUDIO_MIN_BYTES = 50_000;
const ARTWORK_MAX_BYTES = 256_000;
const banned = /score|分數|正確答案|kill|擊殺/i;

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`cannot read ${label} (${path}): ${err.message}`);
    return null;
  }
}

function isFinitePos2(v) {
  return Array.isArray(v) && v.length === 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]);
}

function inBounds(pos, bounds, strict = false) {
  const [x, z] = pos;
  const [minX, maxX, minZ, maxZ] = bounds;
  return strict
    ? x > minX && x < maxX && z > minZ && z < maxZ
    : x >= minX && x <= maxX && z >= minZ && z <= maxZ;
}

// 1. Validate data/scenes.json
const scenesMeta = readJson('data/scenes.json', 'scenes manifest') ?? {};
const VALID_SCENES = new Set(Object.keys(scenesMeta));
if (VALID_SCENES.size < 24) {
  fail(`data/scenes.json expected >= 24 scenes, got ${VALID_SCENES.size}`);
}
for (const [sid, meta] of Object.entries(scenesMeta)) {
  if (meta?.id !== sid) fail(`scenes.json ${sid} id mismatch: ${meta?.id}`);
  if (!Array.isArray(meta?.bounds) || meta.bounds.length !== 4 || !meta.bounds.every(Number.isFinite)) {
    fail(`scenes.json ${sid} invalid bounds`);
  } else {
    const [minX, maxX, minZ, maxZ] = meta.bounds;
    if (!(minX < maxX && minZ < maxZ)) fail(`scenes.json ${sid} degenerate bounds: ${JSON.stringify(meta.bounds)}`);
    if (!isFinitePos2(meta.spawn) || !inBounds(meta.spawn, meta.bounds, false)) {
      fail(`scenes.json ${sid} spawn ${JSON.stringify(meta.spawn)} outside bounds ${JSON.stringify(meta.bounds)}`);
    }
  }
  if (typeof meta?.defaultCue !== 'string' || !meta.defaultCue) {
    fail(`scenes.json ${sid} missing defaultCue`);
  }
}

// 2. Validate data/worldFlags.json
const worldFlagsMeta = readJson('data/worldFlags.json', 'world flags') ?? {};
const VALID_WORLD_FLAGS = new Set(Object.keys(worldFlagsMeta));
if (VALID_WORLD_FLAGS.size === 0) fail('data/worldFlags.json has no flags');
for (const [fid, def] of Object.entries(worldFlagsMeta)) {
  if (!fid.startsWith('xr:')) fail(`worldFlags.json flag ${fid} must start with "xr:"`);
  if (def?.id !== fid) fail(`worldFlags.json ${fid} id mismatch: ${def?.id}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(def?.dayKey ?? '')) fail(`worldFlags.json ${fid} invalid dayKey: ${def?.dayKey}`);
  if (!VIEWPOINTS.includes(def?.sourceRoute)) fail(`worldFlags.json ${fid} invalid sourceRoute: ${def?.sourceRoute}`);
  if (typeof def?.defaultVal !== 'boolean') fail(`worldFlags.json ${fid} defaultVal must be boolean`);
}

// 3. Validate all data/events/1989-*.json (36+ events)
const events = {};
const eventFiles = readdirSync('data/events').filter(f => f.startsWith('1989-') && f.endsWith('.json')).sort();
if (eventFiles.length < 36) fail(`expected >= 36 event files, got ${eventFiles.length}`);
for (const f of eventFiles) {
  const e = readJson('data/events/' + f, 'event ' + f);
  if (!e) continue;
  if (!e.id) fail(f + ' missing id');
  if (events[e.id]) fail(f + ' duplicate id: ' + e.id);
  events[e.id] = e;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? '')) fail(f + ' date');
  if (!KINDS.includes(e.kind)) fail(f + ' kind');
  if (!CONF.includes(e.confidence)) fail(f + ' confidence');
  if (!e.title?.zh || !e.title?.en) fail(f + ' missing title zh/en');
  if (!e.summary?.zh || !e.summary?.en) fail(f + ' missing summary zh/en');
  if (e.kind !== 'fiction' && !(e.sources?.length > 0)) fail(f + ' historical/testimony event needs sources');
  if (e.kind === 'fiction' && (e.confidence !== 'uncertain' || (e.sources?.length ?? 0) !== 0)) {
    fail(f + ' fiction event must have confidence "uncertain" and sources []');
  }
  for (const s of e.sources ?? []) {
    if (!s.title || !s.publisher) fail(f + ' source missing title/publisher');
    if (!/^https:\/\//.test(s.url ?? '')) fail(f + ' source url');
  }
}

// 4. Validate data/events/chapters.json (4 playable viewpoints, 8 chapters each = 32 chapters)
const chaptersMeta = readJson('data/events/chapters.json', 'chapters metadata');
const routeChapters = [];
const seenChapterIds = new Set();
const seenShortIds = new Set();
const seenAssetKeys = new Set();

function validateLegacyList(expectedIds, list, fieldName) {
  const byId = new Map((list ?? []).map(c => [c.id, c]));
  for (const cid of expectedIds) {
    const meta = byId.get(cid);
    if (!meta) { fail(`chapters.json ${fieldName} missing chapter: ${cid}`); continue; }
    if (meta.playable !== true) fail(`chapters.json ${fieldName} chapter not playable: ${cid}`);
    if (!meta.title?.zh || !meta.title?.en) fail(`chapters.json ${fieldName} missing title zh/en: ${cid}`);
    if (!Array.isArray(meta.events) || meta.events.length === 0) fail(`chapters.json ${fieldName} missing events: ${cid}`);
    for (const evId of meta.events ?? []) {
      if (!events[evId]) fail(`chapters.json ${fieldName} ${cid} references missing event: ${evId}`);
    }
  }
}

if (chaptersMeta) {
  if (chaptersMeta.chapters) {
    validateLegacyList(['ch0-0417', 'ch1-0422', 'ch2-0513', 'ch3-0520', 'ch4-0530', 'ch5-0603'], chaptersMeta.chapters, 'chapters');
  }
  if (chaptersMeta.workerChapters) {
    validateLegacyList(['w0-0417', 'w1-0422', 'w2-0513', 'w3-0520', 'w4-0530', 'w5-0603'], chaptersMeta.workerChapters, 'workerChapters');
  }

  const vpById = new Map((chaptersMeta.viewpoints ?? []).map(v => [v.id, v]));
  for (const vp of VIEWPOINTS) {
    const v = vpById.get(vp);
    if (!v) { fail(`chapters.json viewpoints missing ${vp}`); continue; }
    if (v.playable !== true) fail(`chapters.json viewpoint ${vp} not playable`);
    if (!v.zh || !v.en) fail(`chapters.json viewpoint ${vp} missing zh/en`);
  }

  for (const vp of VIEWPOINTS) {
    const list = chaptersMeta.routes?.[vp];
    if (!Array.isArray(list) || list.length !== 8) {
      fail(`chapters.json routes.${vp} expected 8 chapters, got ${Array.isArray(list) ? list.length : 'missing'}`);
      continue;
    }
    list.forEach((meta, idx) => {
      if (!meta?.id) { fail(`chapters.json routes.${vp}[${idx}] missing id`); return; }
      if (seenChapterIds.has(meta.id)) fail(`chapters.json duplicate chapter id: ${meta.id}`);
      seenChapterIds.add(meta.id);

      if (!meta.shortId) fail(`chapters.json ${meta.id} missing shortId`);
      else if (seenShortIds.has(meta.shortId)) fail(`chapters.json duplicate shortId: ${meta.shortId}`);
      seenShortIds.add(meta.shortId);

      if (!meta.assetKey) fail(`chapters.json ${meta.id} missing assetKey`);
      else if (seenAssetKeys.has(meta.assetKey)) fail(`chapters.json duplicate assetKey: ${meta.assetKey}`);
      seenAssetKeys.add(meta.assetKey);

      if (meta.orderIndex !== idx) fail(`chapters.json ${meta.id} expected orderIndex ${idx}, got ${meta.orderIndex}`);
      if (meta.playable !== true) fail(`chapters.json ${meta.id} not playable`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date ?? '')) fail(`chapters.json ${meta.id} invalid date: ${meta.date}`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.dayKey ?? '')) fail(`chapters.json ${meta.id} invalid dayKey: ${meta.dayKey}`);
      if (!meta.title?.zh || !meta.title?.en) fail(`chapters.json ${meta.id} missing title zh/en`);
      if (!Array.isArray(meta.events) || meta.events.length === 0) fail(`chapters.json ${meta.id} missing events`);
      for (const evId of meta.events ?? []) {
        if (!events[evId]) fail(`chapters.json ${meta.id} references missing event: ${evId}`);
      }
      routeChapters.push({ ...meta, viewpoint: vp });
    });
  }

  if (routeChapters.length !== 32) {
    fail(`chapters.json total route chapters expected 32, got ${routeChapters.length}`);
  }
}

// Ensure dialogue directory has no unreferenced files
const dialogueFiles = readdirSync('data/dialogue').filter(f => f.endsWith('.json')).sort();
for (const f of dialogueFiles) {
  const id = f.replace(/\.json$/, '');
  if (!seenChapterIds.has(id)) fail(`orphan dialogue file not listed in chapters.json routes: ${f}`);
}

function validateCondition(cond, where) {
  if (typeof cond !== 'string' || !cond) { fail(`${where} empty condition`); return; }
  const clean = cond.startsWith('!') ? cond.slice(1) : cond;
  if (clean.startsWith('world:')) {
    const flagId = clean.slice(6);
    if (!VALID_WORLD_FLAGS.has(flagId)) fail(`${where} unknown world flag: ${cond}`);
  } else if (clean.startsWith('time:') && !/^time:\d+-\d+$/.test(clean)) {
    fail(`${where} invalid time condition: ${cond}`);
  } else if (clean.startsWith('rel:') && !/^rel:\w+(>=|<=)-?\d+$/.test(clean)) {
    fail(`${where} invalid rel condition: ${cond}`);
  }
}

function validateWorldEmit(emitStr, where) {
  if (typeof emitStr !== 'string' || !emitStr.trim()) { fail(`${where} empty worldEmit`); return; }
  for (const token of emitStr.split(',').map(x => x.trim()).filter(Boolean)) {
    const raw = token.startsWith('!') ? token.slice(1) : token;
    const [flagId, valStr] = raw.split('=');
    if (!VALID_WORLD_FLAGS.has(flagId)) fail(`${where} unknown worldEmit flag: ${flagId}`);
    if (valStr !== undefined && valStr !== 'true' && valStr !== 'false') {
      fail(`${where} invalid worldEmit boolean value in "${token}"`);
    }
  }
}

// 5. Validate all 32 data/dialogue/*.json files
for (const meta of routeChapters) {
  const file = meta.id;
  const ch = readJson('data/dialogue/' + file + '.json', 'dialogue ' + file);
  if (!ch) continue;

  if (ch.chapter !== file) fail(`${file} chapter id mismatch: ${ch.chapter}`);
  if (!ch.title) fail(`${file} missing title`);

  for (const [cid, c] of Object.entries(ch.characters ?? {})) {
    if (c?.fictional !== true) fail(`${file} character not fictional: ${cid}`);
  }

  const nodes = ch.nodes ?? {};
  if (!nodes[ch.start]) fail(`${file} missing start node: ${ch.start}`);

  const startScene = ch.startScene ?? 'campus';
  if (ch.startScene && !VALID_SCENES.has(ch.startScene)) fail(`${file} invalid startScene: ${ch.startScene}`);
  for (const [sKey, sp] of Object.entries(ch.spawn ?? {})) {
    if (!VALID_SCENES.has(sKey)) fail(`${file} invalid spawn scene: ${sKey}`);
    else if (!isFinitePos2(sp) || !inBounds(sp, scenesMeta[sKey].bounds, false)) {
      fail(`${file} spawn ${sKey} ${JSON.stringify(sp)} outside bounds ${JSON.stringify(scenesMeta[sKey].bounds)}`);
    }
  }
  for (const sKey of Object.keys(ch.labels ?? {})) {
    if (!VALID_SCENES.has(sKey)) fail(`${file} invalid label scene: ${sKey}`);
  }
  for (const sKey of Object.keys(ch.transitions ?? {})) {
    if (!VALID_SCENES.has(sKey)) fail(`${file} invalid transition scene: ${sKey}`);
  }

  // evidenceCatalog
  const evCatalog = ch.evidenceCatalog ?? {};
  for (const [eid, card] of Object.entries(evCatalog)) {
    if (card?.id !== eid) fail(`${file} evidenceCatalog ${eid} id mismatch: ${card?.id}`);
    if (!EVIDENCE_KINDS.includes(card?.kind)) fail(`${file} evidenceCatalog ${eid} invalid kind: ${card?.kind}`);
    if (!card?.title || !card?.summary) fail(`${file} evidenceCatalog ${eid} missing title/summary`);
    if (card?.event && !events[card.event]) fail(`${file} evidenceCatalog ${eid} invalid event: ${card.event}`);
    if (card?.confidence && !CONF.includes(card.confidence)) fail(`${file} evidenceCatalog ${eid} invalid confidence: ${card.confidence}`);
    if (card?.route && !VIEWPOINTS.includes(card.route)) fail(`${file} evidenceCatalog ${eid} invalid route: ${card.route}`);
  }

  // evidencePairs
  const seenPairIds = new Set();
  for (const pair of ch.evidencePairs ?? []) {
    if (!pair?.id) fail(`${file} evidencePair missing id`);
    else if (seenPairIds.has(pair.id)) fail(`${file} duplicate evidencePair id: ${pair.id}`);
    seenPairIds.add(pair.id);
    if (!Array.isArray(pair?.cards) || pair.cards.length !== 2) {
      fail(`${file} evidencePair ${pair?.id} must have 2 cards`);
    } else {
      for (const cid of pair.cards) {
        if (!evCatalog[cid]) fail(`${file} evidencePair ${pair.id} references missing evidenceCatalog card: ${cid}`);
      }
    }
    if (!VERDICTS.includes(pair?.verdict)) fail(`${file} evidencePair ${pair?.id} invalid verdict: ${pair?.verdict}`);
    else if (pair?.verdictLabel !== VERDICT_LABELS[pair.verdict]) {
      fail(`${file} evidencePair ${pair.id} non-neutral verdictLabel "${pair?.verdictLabel}" for "${pair.verdict}"`);
    }
    if (!pair?.summary) fail(`${file} evidencePair ${pair?.id} missing summary`);
  }

  // hotspots
  const seenHotspots = new Set();
  for (const h of ch.hotspots ?? []) {
    if (!h?.id) fail(`${file} hotspot missing id`);
    else if (seenHotspots.has(h.id)) fail(`${file} duplicate hotspot id: ${h.id}`);
    seenHotspots.add(h.id);

    if (!h?.label) fail(`${file} hotspot ${h?.id} missing label`);
    if (!VALID_SCENES.has(h?.scene)) {
      fail(`${file} hotspot ${h?.id} invalid scene: ${h?.scene}`);
    } else if (!isFinitePos2(h?.pos)) {
      fail(`${file} hotspot ${h?.id} invalid pos: ${JSON.stringify(h?.pos)}`);
    } else if (!inBounds(h.pos, scenesMeta[h.scene].bounds, true)) {
      fail(`${file} hotspot ${h.id} pos ${JSON.stringify(h.pos)} not strictly inside ${h.scene} bounds ${JSON.stringify(scenesMeta[h.scene].bounds)}`);
    }
    if (!nodes[h?.start]) fail(`${file} hotspot ${h?.id} missing start node: ${h?.start}`);
    if (h?.requires) validateCondition(h.requires, `${file} hotspot ${h.id}`);
  }

  // photoTargets
  const seenPhotoIds = new Set();
  for (const pt of ch.photoTargets ?? []) {
    if (!pt?.id) fail(`${file} photoTarget missing id`);
    else if (seenPhotoIds.has(pt.id)) fail(`${file} duplicate photoTarget id: ${pt.id}`);
    seenPhotoIds.add(pt.id);

    if (!VALID_SCENES.has(pt?.scene)) fail(`${file} photoTarget ${pt?.id} invalid scene: ${pt?.scene}`);
    if (!Array.isArray(pt?.pos3) || pt.pos3.length !== 3 || !pt.pos3.every(Number.isFinite)) {
      fail(`${file} photoTarget ${pt?.id} invalid pos3`);
    }
    if (!(typeof pt?.radius === 'number' && pt.radius > 0)) fail(`${file} photoTarget ${pt?.id} invalid radius`);
    if (!(typeof pt?.maxDist === 'number' && pt.maxDist > 0)) fail(`${file} photoTarget ${pt?.id} invalid maxDist`);
    if (!pt?.label) fail(`${file} photoTarget ${pt?.id} missing label`);
    if (!evCatalog[pt?.evidenceId]) fail(`${file} photoTarget ${pt?.id} missing evidenceCatalog entry: ${pt?.evidenceId}`);
    if (pt?.event && !events[pt.event]) fail(`${file} photoTarget ${pt?.id} invalid event: ${pt.event}`);
    if (pt?.requires) validateCondition(pt.requires, `${file} photoTarget ${pt.id}`);
  }

  // nodes & choices
  for (const [id, n] of Object.entries(nodes)) {
    if (!ch.characters?.[n.speaker]) fail(`${file} speaker ${id}: ${n.speaker}`);
    if (n.event && !events[n.event]) fail(`${file} event ref ${id}: ${n.event}`);
    if (!Array.isArray(n.choices) || n.choices.length === 0) fail(`${file} node ${id} has no choices`);
    for (const v of n.variants ?? []) {
      validateCondition(v?.requires, `${file} node ${id} variant`);
      if (typeof v?.text !== 'string') fail(`${file} node ${id} variant missing text`);
    }
    for (const c of n.choices ?? []) {
      if (c.next && !nodes[c.next]) fail(`${file} next ${id}: ${c.next}`);
      if (c.end && !ch.endings?.[c.end]) fail(`${file} end ${id}: ${c.end}`);
      if (c.goto && !VALID_SCENES.has(c.goto)) fail(`${file} goto ${id}: ${c.goto}`);
      if (c.requires) validateCondition(c.requires, `${file} node ${id} choice`);
      if (c.worldEmit) validateWorldEmit(c.worldEmit, `${file} node ${id} choice`);
      if (c.evidence && !evCatalog[c.evidence]) {
        fail(`${file} node ${id} choice evidence ${c.evidence} missing from evidenceCatalog`);
      }
    }
  }

  // endings & epilogue
  if (!ch.endings || Object.keys(ch.endings).length === 0) fail(file + ' missing endings');
  for (const [eid, e] of Object.entries(ch.endings ?? {})) {
    if (!e.title || !e.text) fail(`${file} ending ${eid} missing title/text`);
  }
  if (typeof ch.epilogue !== 'string' || !ch.epilogue) fail(`${file} missing epilogue`);
  if (ch.epilogueEvent && !events[ch.epilogueEvent]) fail(`${file} epilogue event: ${ch.epilogueEvent}`);

  // BFS reachability across scenes, hotspots, and nodes to endings
  const visitedScenes = new Set([startScene]);
  const visitedNodes = new Set();
  const queue = [];
  if (nodes[ch.start]) queue.push(ch.start);

  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const h of ch.hotspots ?? []) {
      if (visitedScenes.has(h.scene) && h.start && nodes[h.start] && !visitedNodes.has(h.start)) {
        queue.push(h.start);
        expanded = true;
      }
    }
    while (queue.length > 0) {
      const nid = queue.shift();
      if (visitedNodes.has(nid)) continue;
      visitedNodes.add(nid);
      expanded = true;
      const n = nodes[nid];
      if (!n) continue;
      for (const c of n.choices ?? []) {
        if (c.goto && VALID_SCENES.has(c.goto) && !visitedScenes.has(c.goto)) {
          visitedScenes.add(c.goto);
          expanded = true;
        }
        if (c.next && nodes[c.next] && !visitedNodes.has(c.next)) {
          queue.push(c.next);
        }
      }
    }
  }

  const unreachableNodes = Object.keys(nodes).filter(nid => !visitedNodes.has(nid));
  if (unreachableNodes.length > 0) {
    fail(`${file} unreachable dialogue nodes from start/hotspots: ${unreachableNodes.join(', ')}`);
  }

  const reachedEndings = new Set();
  for (const nid of visitedNodes) {
    for (const c of nodes[nid]?.choices ?? []) {
      if (c.end && ch.endings?.[c.end]) reachedEndings.add(c.end);
    }
  }
  const unreachableEndings = Object.keys(ch.endings ?? {}).filter(eid => !reachedEndings.has(eid));
  if (unreachableEndings.length > 0) {
    fail(`${file} unreachable endings from BFS: ${unreachableEndings.join(', ')}`);
  }

  // Banned terms across nodes, endings, epilogue, evidence, and photos
  if (banned.test(JSON.stringify({
    nodes,
    endings: ch.endings,
    epilogue: ch.epilogue,
    evidenceCatalog: ch.evidenceCatalog,
    evidencePairs: ch.evidencePairs,
    photoTargets: ch.photoTargets,
  }))) {
    fail('scoring/combat language in dialogue/evidence/photos: ' + file);
  }
}

// 6. Validate Audio completeness (all 22 cues + scenes.json defaultCue + audio.ts cue unions >= 50,000 bytes)
const audioCueSet = new Set(EXPECTED_AUDIO_CUES);
for (const meta of Object.values(scenesMeta)) {
  if (meta?.defaultCue) audioCueSet.add(meta.defaultCue);
}
if (existsSync('src/play/audio.ts')) {
  const audioSrc = readFileSync('src/play/audio.ts', 'utf8');
  const scoreBlock = audioSrc.match(/export type ScoreCueId\s*=([\s\S]*?);/);
  const stingerBlock = audioSrc.match(/export type StingerId\s*=([\s\S]*?);/);
  for (const block of [scoreBlock?.[1], stingerBlock?.[1]]) {
    if (!block) continue;
    for (const m of block.matchAll(/'([a-z0-9_]+)'/g)) {
      audioCueSet.add(m[1]);
    }
  }
}
if (audioCueSet.size < 22) {
  fail(`expected >= 22 referenced audio cues, got ${audioCueSet.size}`);
}
let audioOkCount = 0;
for (const cue of [...audioCueSet].sort()) {
  const p = `public/audio/${cue}.mp3`;
  if (!existsSync(p)) {
    fail(`missing audio cue file: ${p}`);
  } else {
    const size = statSync(p).size;
    if (size < AUDIO_MIN_BYTES) {
      fail(`audio cue too small (${size} < ${AUDIO_MIN_BYTES} bytes): ${p}`);
    } else {
      audioOkCount++;
    }
  }
}

// 7. Validate Artwork completeness & <= 250 KiB (256,000 bytes) cap for all 32 chapters
const presentArtwork = [];
const missingArtwork = [];
const oversizedArtwork = [];
for (const meta of routeChapters) {
  if (!meta.assetKey) continue;
  const rel = `public/assets/${meta.assetKey}.jpg`;
  if (!existsSync(rel)) {
    missingArtwork.push(`${meta.assetKey}.jpg`);
    fail(`missing chapter artwork: ${rel} (${meta.id})`);
  } else {
    const size = statSync(rel).size;
    if (size <= 0) {
      missingArtwork.push(`${meta.assetKey}.jpg (0 bytes)`);
      fail(`empty chapter artwork: ${rel} (${meta.id})`);
    } else if (size > ARTWORK_MAX_BYTES) {
      oversizedArtwork.push(`${meta.assetKey}.jpg (${size} bytes)`);
      fail(`chapter artwork exceeds ${ARTWORK_MAX_BYTES} bytes (${size}): ${rel}`);
    } else {
      presentArtwork.push(`${meta.assetKey}.jpg`);
    }
  }
}

const summary = `${Object.keys(events).length} events, ${routeChapters.length} chapters (4 routes x 8), ${VALID_SCENES.size} scenes, ${VALID_WORLD_FLAGS.size} worldFlags, ${audioOkCount}/${audioCueSet.size} audio cues, ${presentArtwork.length}/${routeChapters.length} illustrations`;

console.log(
  `artwork: ${presentArtwork.length}/${routeChapters.length} present (<= ${ARTWORK_MAX_BYTES} bytes)`
  + (missingArtwork.length ? `; missing (${missingArtwork.length}): ${missingArtwork.join(', ')}` : '')
  + (oversizedArtwork.length ? `; oversized (${oversizedArtwork.length}): ${oversizedArtwork.join(', ')}` : ''),
);
console.log(process.exitCode ? `data invalid (${summary})` : `data ok: ${summary}`);
