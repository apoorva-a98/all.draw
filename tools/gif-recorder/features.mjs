// Records three feature GIFs: the three modes, a close-up of the pen drawing vs lifted, and a close-up
// of the pen picking the orange paint. Frames are captured as PNG and encoded without dithering.
// Usage: node features.mjs <url> <outDir>   (e.g. node features.mjs http://localhost:8125/ ../../gifs)
// The headless browser's fake camera has no face in it, so clips that need the pen to move
// steer it through the app's own functions (penX/penY, startDrawing, recordPoint, checkTools).
import { chromium } from 'playwright-core';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.argv[2] || 'http://localhost:8124/';
const OUT = path.resolve(process.argv[3] || 'gifs');
const WORK = path.resolve('frames');
const FPS = 15;
const VIEW = { width: 1280, height: 800 };
const SAMPLE_IMAGE = process.argv[4];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, permissions: ['camera'], acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const wait = (ms) => page.waitForTimeout(ms);

// ---- recording ----

// Stream frames from Chrome's screencast while `action` runs (each frame keeps its real timestamp),
// then crop to `clip`, resample to FPS and turn it into a GIF with a two-pass palette.
const cdp = await context.newCDPSession(page);

async function record(name, clip, action, { width } = {}) {
  const dir = path.join(WORK, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const r = typeof clip === 'function' ? await clip() : clip;
  const frames = [];
  const onFrame = async ({ data, metadata, sessionId }) => {
    const file = path.join(dir, `f${String(frames.length).padStart(5, '0')}.png`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, ts: metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  };
  cdp.on('Page.screencastFrame', onFrame);
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  await wait(300);
  await action();
  await wait(500);
  await cdp.send('Page.stopScreencast');
  cdp.off('Page.screencastFrame', onFrame);

  // Concat list: each frame shown until the next one arrived (frames only come when the page changes)
  const end = frames.at(-1).ts + 0.5;
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1]?.ts ?? end) - f.ts).toFixed(4)}`).join('\n') + `\nfile '${frames.at(-1).file}'\n`;
  const listFile = path.join(dir, 'list.txt');
  fs.writeFileSync(listFile, list);

  const crop = `crop=${Math.round(r.width)}:${Math.round(r.height)}:${Math.round(r.x)}:${Math.round(r.y)}`;
  const scale = width ? `,scale=${width}:-1:flags=lanczos` : '';
  const out = path.join(OUT, `${name}.gif`);
  execFileSync(ffmpegPath, [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', `${crop},fps=${FPS}${scale},split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`,
    '-loop', '0', out,
  ]);
  const seconds = end - frames[0].ts;
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`${name}.gif  ${frames.length} source frames, ${seconds.toFixed(1)}s at ${FPS} fps, ${kb} KB`);
}

// ---- helpers ----

const box = async (sel, pad = 16) => {
  const b = await page.locator(sel).first().boundingBox();
  const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad);
  return { x, y, width: Math.min(VIEW.width - x, b.width + pad * 2), height: Math.min(VIEW.height - y, b.height + pad * 2) };
};
const union = (a, b) => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
};
const full = { x: 0, y: 0, ...VIEW };

async function openProps(open = true) {
  const isOpen = await page.evaluate(() => !document.getElementById('propertiesBar').hidden);
  if (isOpen !== open) await page.click('#propsTab');
  await wait(300);
}

async function resetApp() {
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    setMode('create');
    setTrace('none');
    if (usingMouthControl) setMouthControl(false);
    restart();
    document.activeElement && document.activeElement.blur();
  });
  await openProps(false);
}

// Move the simulated pen to (x, y) over `ms`, recording points when drawing and checking tools.
async function steer(x, y, ms = 800, { tools = false } = {}) {
  const steps = Math.max(2, Math.round(ms / 40));
  const from = await page.evaluate(() => [penX, penY]);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await page.evaluate(([px, py, checkTools_]) => {
      penX = px; penY = py;
      recordPoint();
      if (checkTools_) checkTools();
    }, [from[0] + (x - from[0]) * e, from[1] + (y - from[1]) * e, tools]);
    await wait(40);
  }
}

// Rest the pen where it is, still checking tools (for the 2-second pick).
async function rest(ms, { tools = true } = {}) {
  const steps = Math.round(ms / 50);
  for (let i = 0; i < steps; i++) {
    await page.evaluate((t) => { if (t) checkTools(); }, tools);
    await wait(50);
  }
}

const canvasBox = async () => box('#canvasFrame', 0);

// A smooth wavy stroke across the canvas, relative to its size
async function scribble(cx, cy, w, h) {
  await steer(cx - w / 2, cy, 500);
  await page.evaluate(() => startDrawing());
  const pts = 24;
  for (let i = 1; i <= pts; i++) {
    const x = cx - w / 2 + (w * i) / pts;
    const y = cy + Math.sin((i / pts) * Math.PI * 2) * h;
    await steer(x, y, 120);
  }
  await page.evaluate(() => stopDrawing());
}

// ---- go: three feature clips ----

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => typeof setMode === 'function' && typeof width === 'number' && width > 0, null, { timeout: 60000 });
await wait(1500);
await resetApp();

// 1. The three modes: Learn (camera + nose tracking), Play (blank, pen only), Create (paints, pen, eraser)
await openProps(true);
await record('three-modes', full, async () => {
  await wait(600);
  for (const m of ['learn', 'play', 'create']) {
    await page.hover(`[data-mode="${m}"]`); await wait(400);
    await page.click(`[data-mode="${m}"]`); await wait(1800);
  }
}, { width: 800 });
await openProps(false);

// 2. Close-up of the pen: drawing (arcs, dark dot) vs lifted (no arcs, raised, faint dot)
await page.evaluate(() => { setMode('play'); restart(); });
let c = await canvasBox();
const px = c.width / 2, py = c.height / 2;
await page.evaluate(([x, y]) => { penX = x; penY = y; }, [px - 110, py + 40]);
await wait(500);
const penZoom = { x: c.x + px - 170, y: c.y + py - 140, width: 340, height: 240 };
await record('pen-down-vs-up', penZoom, async () => {
  await wait(1200); // lifted
  await page.evaluate(() => startDrawing());
  for (let i = 1; i <= 12; i++) await steer(px - 110 + i * 15, py + 40 + Math.sin(i / 2) * 18, 160); // drawing
  await wait(900);
  await page.evaluate(() => stopDrawing());
  await wait(1200); // lifted again
  await steer(px + 40, py + 20, 700);
  await wait(800);
  await page.evaluate(() => startDrawing());
  await wait(1200); // down again
  await page.evaluate(() => stopDrawing());
  await wait(600);
}, { width: 680 });

// 3. Close-up of the pen resting on the orange paint: the ring grows, the pen turns orange, then draws
await page.evaluate(() => { setMode('create'); restart(); });
c = await canvasBox();
const blob = await box('[data-paint="orange"]', 0);
const zoom = { x: blob.x - 20, y: blob.y - 170, width: blob.width + 300, height: blob.height + 190 };
const bx = blob.x - c.x + blob.width / 2, by = blob.y - c.y + blob.height / 2;
await page.evaluate(([x, y]) => { penX = x; penY = y; }, [bx + 230, by - 90]);
await wait(500);
await record('pen-turns-orange', zoom, async () => {
  await wait(600);
  await steer(bx, by, 1200, { tools: true });
  await rest(2500); // ring grows, then the paint is picked
  await steer(bx + 180, by - 70, 900, { tools: true });
  await page.evaluate(() => startDrawing());
  for (let i = 1; i <= 10; i++) await steer(bx + 180 + i * 9, by - 70 + Math.sin(i / 1.6) * 22, 160);
  await page.evaluate(() => stopDrawing());
  await wait(900);
}, { width: 800 });

if (errors.length) console.log('page errors:', errors);
await browser.close();
