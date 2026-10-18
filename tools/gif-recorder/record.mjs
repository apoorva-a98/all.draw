// Records a short interaction clip per all.draw component and converts each to an optimized GIF.
// Usage: node record.mjs <url> <outDir>
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
    const file = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, ts: metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  };
  cdp.on('Page.screencastFrame', onFrame);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
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
    '-vf', `${crop},fps=${FPS}${scale},split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
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

// ---- go ----

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => typeof setMode === 'function' && typeof width === 'number' && width > 0, null, { timeout: 60000 });
await wait(1500);
await resetApp();

// 1. Properties tab: open and close the therapist's settings
await record('properties-tab', async () => ({ x: 0, y: 0, width: VIEW.width, height: 240 }), async () => {
  await wait(500);
  await page.hover('#propsTab'); await wait(500);
  await page.click('#propsTab'); await wait(1400);
  await page.hover('#propsTab'); await wait(400);
  await page.click('#propsTab'); await wait(900);
}, { width: 960 });

// 2. Mode switch: Learn / Play / Create, with what each does to the canvas
await openProps(true);
await record('mode-switch', full, async () => {
  await wait(500);
  for (const m of ['learn', 'play', 'create']) {
    await page.hover(`[data-mode="${m}"]`); await wait(350);
    await page.click(`[data-mode="${m}"]`); await wait(1300);
  }
}, { width: 800 });

// 3. Mouth Draw toggle: on, hint changes, off
const mouthClip = await box('#mouthSwitch', 0).then(async (s) => union(await box('#mouthLabel', 0), s)).then((b) => ({ x: b.x - 24, y: b.y - 24, width: b.width + 48, height: b.height + 48 }));
await record('mouth-draw-toggle', mouthClip, async () => {
  await wait(500);
  await page.hover('#mouthSwitch'); await wait(400);
  await page.click('#mouthSwitch'); await wait(1500);
  await page.click('#mouthSwitch'); await wait(1000);
});

// 4. Trace dropdown: open, pick shapes, see the path on the canvas
await record('trace-dropdown', full, async () => {
  await wait(500);
  await page.hover('#traceButton'); await wait(300);
  await page.click('#traceButton'); await wait(800);
  for (const id of ['butterfly', 'star', 'leaf']) {
    await page.hover(`[data-trace="${id}"]`); await wait(400);
    await page.click(`[data-trace="${id}"]`); await wait(1200);
    if (id !== 'leaf') { await page.click('#traceButton'); await wait(600); }
  }
  await wait(600);
}, { width: 800 });
await page.evaluate(() => setTrace('none'));

// 5. Upload Image: choose a picture, it shows faded on the canvas, then Remove
if (SAMPLE_IMAGE) {
  await record('upload-image', full, async () => {
    await wait(500);
    await page.hover('label:has(#imageUploadInput)'); await wait(400);
    await page.setInputFiles('#imageUploadInput', SAMPLE_IMAGE); await wait(1800);
    await page.hover('#removeImage'); await wait(400);
    await page.click('#removeImage'); await wait(1000);
  }, { width: 800 });
}
await openProps(false);

// 6. Drawing canvas: the pen steers, goes down to draw, lifts
let c = await canvasBox();
await record('drawing-canvas', full, async () => {
  await wait(400);
  await scribble(c.width / 2, c.height / 2 - 40, c.width * 0.4, 70);
  await steer(c.width / 2, c.height / 2 + 120, 700);
  await wait(500);
}, { width: 800 });

// 7. Color picker: rest the pen on a paint blob for 2 s, the pen takes its colour, draw with it
await page.evaluate(() => restart());
c = await canvasBox();
await record('color-picker', full, async () => {
  await wait(300);
  const blue = await box('[data-paint="blue"]', 0);
  await steer(blue.x - c.x + blue.width / 2, blue.y - c.y + blue.height / 2, 1000, { tools: true });
  await rest(2400);
  await steer(c.width * 0.35, c.height * 0.4, 900, { tools: true });
  await scribble(c.width * 0.45, c.height * 0.4, c.width * 0.25, 50);
}, { width: 800 });
await page.evaluate(() => { paint = 'orange'; updateToolButtons(); }); // the eraser clip shows two colours

// 8. Pen and eraser tools: pick the eraser by resting on it, erase, go back to the pen
c = await canvasBox();
await record('pen-and-eraser', full, async () => {
  await wait(300);
  const eraser = await box('[data-tool="eraser"]', 0);
  await steer(eraser.x - c.x + eraser.width / 2, eraser.y - c.y + eraser.height / 2, 1000, { tools: true });
  await rest(2400);
  await steer(c.width * 0.3, c.height * 0.45, 900, { tools: true });
  await page.evaluate(() => startDrawing());
  await steer(c.width * 0.7, c.height * 0.45, 1400);
  await page.evaluate(() => stopDrawing());
  const pen = await box('[data-tool="pen"]', 0);
  await steer(pen.x - c.x + pen.width / 2, pen.y - c.y + pen.height / 2, 1000, { tools: true });
  await rest(2400);
  await steer(c.width / 2, c.height / 2, 800, { tools: true });
}, { width: 800 });

// 9. Restart: Space clears the drawing and brings back the black pen in the centre
await page.evaluate(() => restart());
c = await canvasBox();
await page.evaluate(() => { startDrawing(); });
await scribble(c.width * 0.5, c.height * 0.4, c.width * 0.4, 80);
await steer(c.width * 0.75, c.height * 0.7, 600);
await record('restart', full, async () => {
  await wait(700);
  await page.hover('#restartButton'); await wait(600);
  await page.click('#restartButton'); await wait(1400);
}, { width: 800 });

// 10. Save Art: type a title and artist, save, the canvas starts fresh
c = await canvasBox();
await scribble(c.width * 0.5, c.height * 0.45, c.width * 0.4, 90);
const bottomBar = await box('.bottom-bar', 0);
await record('save-art', { x: 0, y: bottomBar.y - 280, width: VIEW.width, height: VIEW.height - (bottomBar.y - 280) }, async () => {
  await wait(400);
  await page.click('#artworkTitle'); await page.keyboard.type('Waves', { delay: 90 }); await wait(300);
  await page.click('#artistname'); await page.keyboard.type('Sam', { delay: 90 }); await wait(400);
  await page.hover('#saveArtButton'); await wait(500);
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('#saveArtButton')]);
  await wait(1300);
  if (download) console.log('  saved file name:', download.suggestedFilename());
}, { width: 960 });

if (errors.length) console.log('page errors:', errors);
await browser.close();
