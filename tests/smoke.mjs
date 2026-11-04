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
  const pick = async i => { await ev(i => window.__b89.choose(i), i); await sleep(150); };
  if (!(await ev(() => window.__b89.dialog))) throw new Error('intro dialog missing');
  await pick(0);
  const go = async id => { await ev(id => window.__b89.teleport(id), id); await sleep(250); await ev(() => window.__b89.interact()); await sleep(200); };
  await go('board'); if (shots) await page.screenshot({ path: `${shots}/${name}-1-board.png` }); await pick(0);
  await go('zhou'); await pick(0); await pick(0);
  await go('lin'); await pick(1); await pick(0);
  await go('gate');
  if (shots) { await ev(() => window.__b89.choose(1)); await sleep(150); await ev(() => window.__b89.teleport('board')); await ev(() => {}); await sleep(600); await page.screenshot({ path: `${shots}/${name}-2-campus.png` }); await go('gate'); }
  const opts = await ev(() => window.__b89.choices());
  if (!opts[0].includes('騎車')) throw new Error('gate should offer ride once an item is carried: ' + opts);
  await pick(0); await sleep(2600);
  if ((await ev(() => window.__b89.scene)) !== 'street') throw new Error('did not reach street');
  await ev(() => window.__b89.teleport('kiosk')); await sleep(700);
  const perf = await ev(() => window.__b89.perf());
  if (shots) await page.screenshot({ path: `${shots}/${name}-3-street.png` });
  await go('youth'); await pick(1); await pick(0);
  await go('home');
  if (shots) await page.screenshot({ path: `${shots}/${name}-4-home.png` });
  await pick(0); await sleep(300);
  const st = await ev(() => window.__b89.state);
  if (st.ending !== 'letter') throw new Error('expected letter ending, got ' + st.ending);
  if (st.diary.length < 4) throw new Error('diary too short');
  if (shots) await page.screenshot({ path: `${shots}/${name}-5-ending.png` });
  console.log(name, JSON.stringify({ perf, ending: st.ending, diary: st.diary.length }));
  if (perf.calls > 60) throw new Error('draw calls over budget: ' + perf.calls);
  if (perf.sceneTriangles > 300000) throw new Error('triangles over budget: ' + perf.sceneTriangles);
  await page.close();
}
try {
  await run('phone', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await run('desktop', { width: 1366, height: 800 });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('smoke ok');
} catch (e) { console.error(e); process.exitCode = 1; }
finally { await browser.close(); server.httpServer.close(); }
