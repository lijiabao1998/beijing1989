// Puppeteer smoke test of the 4/17 slice: title -> dorm -> letter -> board -> gate -> street -> ending.
// Usage: npm run build && npm run smoke   (CHROME_PATH, SHOTS=dir optional)
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

const server = await preview({ preview: { port: 4179, host: '127.0.0.1' } });
const url = 'http://127.0.0.1:4179/';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const shots = process.env.SHOTS; if (shots) mkdirSync(shots, { recursive: true });
const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function run(name, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ' console: ' + m.text()); });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  if (shots) await page.screenshot({ path: `${shots}/${name}-0-title.png` });
  await page.click('#b-new'); await sleep(400);
  const ev = (f, ...a) => page.evaluate(f, ...a);
  const pick = async i => { await page.waitForFunction(i => window.__b89.choices().length > i, { timeout: 15000 }, i); await ev(i => window.__b89.choose(i), i); await sleep(150); };
  if (!(await ev(() => window.__b89.dialog))) throw new Error('intro dialog missing');
  await pick(0);
  const go = async id => {
    await ev(id => window.__b89.teleport(id), id);
    await page.waitForFunction(id => window.__b89.near === id, { timeout: 15000 }, id); // a frame must run so the hotspot is detected
    await ev(() => window.__b89.interact());
    await page.waitForFunction(() => window.__b89.dialog, { timeout: 15000 });
  };
  await go('board'); if (shots) await page.screenshot({ path: `${shots}/${name}-1-board.png` }); await pick(0);
  await go('zhou'); await pick(0); await pick(0);
  await go('lin'); await pick(1); await pick(0);
  await go('gate');
  if (shots) await page.screenshot({ path: `${shots}/${name}-2b-gate.png` });
  if (shots) { await ev(() => window.__b89.choose(1)); await sleep(150); await ev(() => window.__b89.teleport('board')); await ev(() => {}); await sleep(600); await page.screenshot({ path: `${shots}/${name}-2-campus.png` }); await go('gate'); }
  const opts = await ev(() => window.__b89.choices());
  if (!opts[0].includes('騎車')) throw new Error('gate should offer ride once an item is carried: ' + opts);
  await pick(0);
  await page.waitForFunction(() => window.__b89.scene === 'street', { timeout: 20000 }).catch(() => {});
  await sleep(1200);
  if ((await ev(() => window.__b89.scene)) !== 'street') throw new Error('did not reach street');
  await ev(() => window.__b89.teleport('kiosk')); await sleep(700);
  const perf = await ev(() => window.__b89.perf());
  if (shots) await page.screenshot({ path: `${shots}/${name}-3-street.png` });
  await go('youth'); await pick(1); await pick(0);
  await go('home');
  if (shots) await page.screenshot({ path: `${shots}/${name}-4-home.png` });
  await pick(0);
  await page.waitForFunction(() => !!window.__b89.state.ending, { timeout: 15000 });
  const st = await ev(() => window.__b89.state);
  if (st.ending !== 'letter') throw new Error('expected letter ending, got ' + st.ending);
  if (st.diary.length < 4) throw new Error('diary too short');
  if (shots) await page.screenshot({ path: `${shots}/${name}-5-ending.png` });
  // 長安街 / 天安門 (the heaviest scene)
  await ev(() => { document.getElementById('mclose').click(); window.__b89.teleport('tam'); });
  await page.waitForFunction(() => window.__b89.scene === 'changan' && window.__b89.near === 'tam', { timeout: 20000 });
  await sleep(800);
  const perfC = await ev(() => window.__b89.perf());
  if (shots) await page.screenshot({ path: `${shots}/${name}-6-changan-north.png` });
  await ev(() => window.__b89.setYaw(Math.PI)); await sleep(800);
  if (shots) await page.screenshot({ path: `${shots}/${name}-7-changan-square.png` });
  if (shots) for (const [n, x, z, y] of [['8-monument', 0, -250, Math.PI], ['9-greathall', -60, -300, -Math.PI / 2], ['10-museum', 60, -300, Math.PI / 2]]) {
    await ev((a) => { window.__b89.placeAt(a[0], a[1]); window.__b89.setYaw(a[2]); }, [x, z, y]); await sleep(700);
    await page.screenshot({ path: `${shots}/${name}-${n}.png` });
  }
  if (shots) await ev(() => window.__b89.teleport('square'));
  await ev(() => window.__b89.setYaw(0));
  await go('square'); await pick(0);
  await page.waitForFunction(() => window.__b89.state.ending === 'south', { timeout: 15000 });
  // ---- Chapter 2 (4/21 night – 4/22), carrying over chapter 1 ----
  await page.waitForFunction(() => !!document.getElementById('nextch'), { timeout: 15000 });
  await ev(() => window.__b89.next());
  await page.waitForFunction(() => window.__b89.state.chapter === 'ch1-0422' && window.__b89.dialog, { timeout: 20000 });
  const t0 = await ev(() => document.getElementById('txt').textContent);
  if (!t0.includes('廣場北邊')) throw new Error('ch2 intro should reflect the ch1 "south" ending: ' + t0);
  await pick(0);
  await go('c2zhou'); if (!(await ev(() => window.__b89.choices()))[0].includes('一起走')) throw new Error('zhou carry-over missing'); await pick(0); await pick(0);
  await go('c2lin'); await pick(0); await pick(0);
  await go('c2gate'); await pick(0);
  await page.waitForFunction(() => window.__b89.scene === 'march', { timeout: 20000 }); await sleep(1200);
  await ev(() => window.__b89.teleport('picket')); await sleep(700);
  const perfM = await ev(() => window.__b89.perf());
  if (shots) await page.screenshot({ path: `${shots}/${name}-c2-1-march.png` });
  await go('auntie'); await pick(1);
  await go('rumor'); await pick(0);
  await go('south'); await pick(0);
  await page.waitForFunction(() => window.__b89.scene === 'square', { timeout: 20000 }); await sleep(1500);
  const perfS = await ev(() => window.__b89.perf());
  if (shots) {
    await page.screenshot({ path: `${shots}/${name}-c2-2-square-dawn.png` });
    for (const [n, x, z, y] of [['c2-3-greathall', -40, -322, -Math.PI / 2], ['c2-4-north', -10, -300, 0], ['c2-5-monument', 0, -240, Math.PI]]) {
      await ev((a) => { window.__b89.placeAt(a[0], a[1]); window.__b89.setYaw(a[2]); }, [x, z, y]); await sleep(800);
      await page.screenshot({ path: `${shots}/${name}-${n}.png` });
    }
    await ev(() => window.__b89.setYaw(-Math.PI / 2));
  }
  await go('speaker2'); await pick(0);
  await go('oldman'); await pick(1);
  await go('stu2b'); await pick(0);
  await go('steps'); if (shots) await page.screenshot({ path: `${shots}/${name}-c2-6-steps.png` }); await pick(1); await pick(0);
  await go('leave'); await pick(0);
  await page.waitForFunction(() => window.__b89.state.ending === 'together', { timeout: 15000 });
  if (shots) await page.screenshot({ path: `${shots}/${name}-c2-7-ending.png` });
  await ev(() => window.__b89.flow()); await sleep(300);
  const fl = await ev(() => document.getElementById('mbody').innerHTML);
  if (!fl.includes('fc on') || !fl.includes('？？？')) throw new Error('flowchart missing taken/unexplored');
  if (shots) await page.screenshot({ path: `${shots}/${name}-c2-8-flowchart.png` });
  const st2 = await ev(() => window.__b89.state);
  if (!st2.flags.includes('ch0:end:south') || !st2.history['ch0-0417']) throw new Error('carry-over state missing');
  console.log(name, JSON.stringify({ street: perf, changan: perfC, march: perfM, square: perfS, ending: st.ending, diary: st.diary.length }));
  for (const p of [perf, perfC, perfM, perfS]) {
    if (p.calls > 60) throw new Error('draw calls over budget: ' + p.calls);
    if (p.sceneTriangles > 300000) throw new Error('triangles over budget: ' + p.sceneTriangles);
  }
  await page.close();
}
try {
  await run('phone', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await run('desktop', { width: 1366, height: 800 });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('smoke ok');
} catch (e) { console.error(e); process.exitCode = 1; }
finally { await browser.close(); server.httpServer.close(); }
