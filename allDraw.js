// all.draw: draw with your face.
// One sketch for all three modes:
//   Learn  - nose tracking, the camera shows faded behind the canvas (from noseTracking.js)
//   Play   - head tracking on a blank canvas, the pen is the only tool (from neckTracking.js)
//   Create - head tracking plus paints, pen and eraser tools
// Pen icons: Pen by Vinzel. from Noun Project (CC BY 3.0)

let faceMesh;
let video;
let faces = [];
const options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: true };

// Face landmarks
const leftEyeIndex = 130;
const rightEyeIndex = 359;
const noseIndex = 1;
const upperLipIndex = 13;
const lowerLipIndex = 14;

// Paints: Okabe-Ito colour-blind-safe set
const PAINTS = {
  blue: '#0072b2',
  green: '#009e73',
  orange: '#e69f00',
  black: '#000000',
};

// Trace shapes, drawn in a 100 x 100 box
const SHAPES = {
  none: { name: 'None', parts: [], start: null },
  butterfly: {
    name: 'Butterfly',
    parts: [
      { d: 'M50 48 C 38 14, 6 12, 10 38 C 13 54, 34 56, 50 48 Z M50 48 C 62 14, 94 12, 90 38 C 87 54, 66 56, 50 48 Z', color: PAINTS.orange },
      { d: 'M50 52 C 36 58, 18 76, 28 87 C 38 96, 48 74, 50 52 Z M50 52 C 64 58, 82 76, 72 87 C 62 96, 52 74, 50 52 Z', color: PAINTS.blue },
    ],
    start: [50, 48],
  },
  star: {
    name: 'Star',
    parts: [{ d: 'M50 8 L62 38 L94 39 L69 58 L78 90 L50 72 L22 90 L31 58 L6 39 L38 38 Z', color: PAINTS.blue }],
    start: [50, 8],
  },
  leaf: {
    name: 'Leaf',
    parts: [{ d: 'M50 6 C 84 24, 92 62, 50 94 C 8 62, 16 24, 50 6 Z', color: PAINTS.green }],
    start: [50, 6],
  },
};

// Thumbnails for the Trace dropdown (filled, friendly versions of the shapes)
const THUMBS = {
  none: '<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="14" y="14" width="72" height="72" rx="14" fill="none" stroke="#757575" stroke-width="6" stroke-dasharray="12 10"/></svg>',
  butterfly: '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + SHAPES.butterfly.parts[0].d + '" fill="' + PAINTS.orange + '"/><path d="' + SHAPES.butterfly.parts[1].d + '" fill="' + PAINTS.blue + '"/><circle cx="27" cy="34" r="6" fill="' + PAINTS.green + '"/><circle cx="73" cy="34" r="6" fill="' + PAINTS.green + '"/><ellipse cx="50" cy="52" rx="3.5" ry="20" fill="#000"/><path d="M48 33 C 44 22, 40 18, 36 16 M52 33 C 56 22, 60 18, 64 16" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + SHAPES.star.parts[0].d + '" fill="' + PAINTS.blue + '" stroke="' + PAINTS.blue + '" stroke-width="6" stroke-linejoin="round"/><circle cx="50" cy="52" r="9" fill="' + PAINTS.orange + '"/></svg>',
  leaf: '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + SHAPES.leaf.parts[0].d + '" fill="' + PAINTS.green + '"/><path d="M50 16 L50 88 M50 40 L35 30 M50 40 L65 30 M50 58 L33 46 M50 58 L67 46 M50 74 L39 66 M50 74 L61 66" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></svg>',
};

const MODE_HELP = { learn: 'Nose tracking', play: 'Head tracking', create: 'More tools' };
const TOOL_DWELL_MS = 2000; // resting on a colour or tool this long picks it, no Enter needed
const HIT_PAD = 40; // tools count as touched this far outside their edges: bigger targets, same look
const PEN_SPEED = 2;
const EDGE = 50; // the pen stays this far inside the canvas

// State
let mode = 'create';
let penX, penY;
let lastNose = null; // smoothed nose-mode pen position
let drawingEnabled = false;
let usingMouthControl = false;
let mouthWasOpen = false;
let paint = 'black';
let tool = 'pen';
let trace = 'none';
let paths = [];
let currentPath = null;
let printing = false;
let uploadedImg = null;
let artLayer;
let dwell = { el: null, since: 0 };

const $ = (id) => document.getElementById(id);

function preload() {
  faceMesh = ml5.faceMesh(options);
}

function setup() {
  const container = $('canvasContainer');
  const myCanvas = createCanvas(container.clientWidth, container.clientHeight);
  myCanvas.parent('canvasContainer');
  frameRate(27.5);
  artLayer = createGraphics(width, height);

  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();
  faceMesh.detectStart(video, gotFaces);

  penX = width / 2;
  penY = height / 2;

  // Keep the canvas the size of its frame (window resize, properties bar opening)
  new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w > 0 && h > 0 && (w !== width || h !== height)) {
      resizeCanvas(w, h);
      artLayer = createGraphics(w, h);
      penX = constrain(penX, EDGE, w - EDGE);
      penY = constrain(penY, EDGE, h - EDGE);
    }
  }).observe(container);

  setupControls();
  setMode('create');
}

function draw() {
  background(255);

  if (mode === 'learn' && !printing) drawVideo();
  if (uploadedImg && !printing) drawUploadedImage();
  if (trace !== 'none' && !printing) drawTrace();

  const face = faces[0];
  if (face && face.keypoints.length > 0) {
    checkMouth(face.keypoints);
    if (mode === 'learn') moveWithNose(face.keypoints);
    else moveWithHead(calculateHeadAngles(face.keypoints));
    if (mode === 'create') checkTools();
    recordPoint();
  }

  drawArt();
  if (mode === 'learn' && !printing) drawNoseMarkers();
  updateCursor();
}

// Callback function for when faceMesh outputs data
function gotFaces(results) {
  faces = results;
}

// ---- Moving the pen ----

// ml5 reports face points in the camera's own resolution (videoWidth x videoHeight).
// The camera is shown filling the canvas at its real proportions (cropped, not stretched);
// this maps a face point onto the canvas the same way, so the nose dot lands on the nose.
function videoFit() {
  const vw = video.elt.videoWidth;
  const vh = video.elt.videoHeight;
  if (!vw || !vh) return null; // camera not ready yet
  const s = Math.max(width / vw, height / vh);
  return { s, x: (width - vw * s) / 2, y: (height - vh * s) / 2, w: vw * s, h: vh * s };
}

function toCanvas(pt) {
  const fit = videoFit();
  if (!fit) return null;
  return { x: fit.x + pt.x * fit.s, y: fit.y + pt.y * fit.s };
}

// Learn: the pen sits ahead of the nose, pushed further the more you turn (from noseTracking.js)
function moveWithNose(keypoints) {
  const nose = keypoints[noseIndex];
  const leftEye = keypoints[leftEyeIndex];
  const rightEye = keypoints[rightEyeIndex];
  const n = toCanvas(nose);
  if (!n) return;

  const yaw = (nose.x - (leftEye.x + rightEye.x) / 2) * 2;
  const pitch = (nose.y - (leftEye.y + rightEye.y) / 2) * 2;
  const moveX = map(yaw, -30, 30, -200, 200);
  const moveY = map(pitch, -30, 30, -200, 50);
  const target = createVector(n.x + moveX * 2, n.y + moveY * 2);

  if (!lastNose) {
    lastNose = target;
  } else if (p5.Vector.dist(target, lastNose) > 30) { // ignore small jitter
    lastNose = p5.Vector.lerp(lastNose, target, 0.2);
  }
  penX = constrain(lastNose.x, EDGE, width - EDGE);
  penY = constrain(lastNose.y, EDGE, height - EDGE);
}

// Play and Create: head angles steer the pen at a constant speed (from neckTracking.js)
function moveWithHead(angles) {
  let dx = (angles.yaw * 0.25 + angles.roll * 0.25) / 2; // yaw and roll move it sideways
  let dy = 0;

  // Pitch between 90 and 100 is a dead zone, so a level head doesn't drift up or down
  if (angles.pitch < 90) dy += angles.pitch * 0.025;
  else if (angles.pitch > 100) dy -= angles.pitch * 0.025;

  const magnitude = Math.sqrt(dx * dx + dy * dy);
  if (magnitude > 0) {
    dx /= magnitude;
    dy /= magnitude;
  }

  penX = constrain(penX + dx * PEN_SPEED, EDGE, width - EDGE);
  penY = constrain(penY + dy * PEN_SPEED, EDGE, height - EDGE);
}

function calculateHeadAngles(keypoints) {
  const leftEye = keypoints[leftEyeIndex];
  const rightEye = keypoints[rightEyeIndex];
  const nose = keypoints[noseIndex];

  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);
  const pitch = Math.atan2(nose.y - (leftEye.y + rightEye.y) / 2, nose.z - (leftEye.z + rightEye.z) / 2) * (180 / Math.PI) - 45;
  const midEye = (leftEye.x + rightEye.x) / 2;
  const yaw = Math.atan2(nose.x - midEye, -nose.z) * (180 / Math.PI);

  return { yaw, pitch, roll };
}

// ---- Drawing ----

function recordPoint() {
  if (!drawingEnabled) return;
  if (!currentPath) {
    currentPath = { color: PAINTS[paint], erase: tool === 'eraser', points: [] };
    paths.push(currentPath);
  }
  const last = currentPath.points[currentPath.points.length - 1];
  if (!last || dist(last.x, last.y, penX, penY) > 1) {
    currentPath.points.push(createVector(penX, penY));
  }
}

function startDrawing() {
  drawingEnabled = true;
}

function stopDrawing() {
  drawingEnabled = false;
  currentPath = null;
}

// Strokes live on their own layer so the eraser never wipes the trace guide or an uploaded image
function drawArt() {
  artLayer.clear();
  artLayer.noFill();
  for (const path of paths) {
    if (path.erase) {
      artLayer.erase();
      artLayer.strokeWeight(40);
    } else {
      artLayer.stroke(path.color);
      artLayer.strokeWeight(4);
    }
    artLayer.beginShape();
    for (const pt of path.points) artLayer.vertex(pt.x, pt.y);
    artLayer.endShape();
    if (path.erase) artLayer.noErase();
  }
  image(artLayer, 0, 0);
}

function drawVideo() {
  const fit = videoFit();
  if (!fit) return;
  push();
  translate(width, 0); // mirror the camera
  scale(-1, 1);
  tint(255, 185); // faded
  image(video, fit.x, fit.y, fit.w, fit.h); // centred, so mirroring keeps the same offset
  pop();
}

function drawUploadedImage() {
  push();
  imageMode(CENTER);
  tint(255, 178); // 70% opacity
  const canvasAspect = width / height;
  const imgAspect = uploadedImg.width / uploadedImg.height;
  let w, h;
  if (imgAspect > canvasAspect) {
    h = height * 0.5;
    w = h * imgAspect;
  } else {
    w = width * 0.5;
    h = w / imgAspect;
  }
  image(uploadedImg, width / 3, height / 2, w, h);
  pop();
}

// Where the Trace shape sits: a square centred on the canvas
function traceBox() {
  const size = Math.min(400, width * 0.6, height * 0.7);
  return { x: (width - size) / 2, y: (height - size) / 2, k: size / 100 };
}

// The chosen Trace shape: a dashed path with a start dot, centred on the canvas
function drawTrace() {
  const shape = SHAPES[trace];
  const box = traceBox();
  const ctx = drawingContext;
  push();
  translate(box.x, box.y);
  scale(box.k);
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3.5]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const part of shape.parts) {
    ctx.strokeStyle = part.color;
    ctx.stroke(new Path2D(part.d));
  }
  ctx.restore();
  noStroke();
  fill(0);
  circle(shape.start[0], shape.start[1], 6);
  ctx.font = '800 4.5px Lexend, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Start', shape.start[0], shape.start[1] - 5.5);
  pop();
}

// Learn: orange dot on the nose, blue line to the pen, orange dot at the pen
function drawNoseMarkers() {
  const face = faces[0];
  const n = face && toCanvas(face.keypoints[noseIndex]);
  if (!n) return;
  stroke(PAINTS.blue);
  strokeWeight(5);
  line(n.x, n.y, penX, penY);
  noStroke();
  fill(PAINTS.orange);
  circle(n.x, n.y, 25);
  circle(penX, penY, 25);
}

// Play and Create: the pen cursor is a layer above the tools (style.css draws the states).
// Pen down: pen with arcs on a small dark dot. Pen up: pen without arcs, lifted, on a faint wide dot.
// It takes the chosen paint's colour, or becomes the eraser.
function updateCursor() {
  const el = $('cursor');
  el.hidden = mode === 'learn';
  if (el.hidden) return;
  el.style.transform = `translate(${penX}px, ${penY}px)`;
  el.style.setProperty('--pen-color', PAINTS[paint]);
  el.classList.toggle('up', !drawingEnabled);
  el.classList.toggle('eraser', tool === 'eraser');
}

// ---- Tools (Create mode) ----

// The pen picks a tool by resting on (or near) it for TOOL_DWELL_MS, so passing over one does nothing
function checkTools() {
  const box = $('canvasContainer').getBoundingClientRect();
  const x = penX + box.left;
  const y = penY + box.top;
  let hit = null;
  for (const el of document.querySelectorAll('#tools button')) {
    const r = el.getBoundingClientRect();
    if (x >= r.left - HIT_PAD && x <= r.right + HIT_PAD && y >= r.top - HIT_PAD && y <= r.bottom + HIT_PAD) {
      hit = el;
      break;
    }
  }

  if (hit !== dwell.el) {
    endDwell();
    dwell = { el: hit, since: millis() };
    if (hit) hit.classList.add('dwelling');
  } else if (hit && dwell.since !== Infinity) {
    const progress = (millis() - dwell.since) / TOOL_DWELL_MS;
    hit.style.setProperty('--progress', Math.min(progress, 1));
    if (progress >= 1) {
      endDwell();
      hit.click();
      dwell = { el: hit, since: Infinity }; // picked: wait until the pen leaves
    }
  }
}

function endDwell() {
  if (!dwell.el) return;
  dwell.el.classList.remove('dwelling');
  dwell.el.style.removeProperty('--progress');
}

function pickPaint(name) {
  paint = name;
  tool = 'pen'; // picking a colour goes back to the pen
  if (drawingEnabled) currentPath = null; // next point starts a stroke in the new colour
  updateToolButtons();
}

function pickTool(name) {
  tool = name;
  if (drawingEnabled) currentPath = null;
  updateToolButtons();
}

function updateToolButtons() {
  for (const el of document.querySelectorAll('[data-paint]')) {
    el.setAttribute('aria-pressed', String(el.dataset.paint === paint && tool === 'pen'));
  }
  for (const el of document.querySelectorAll('[data-tool]')) {
    el.setAttribute('aria-pressed', String(el.dataset.tool === tool));
  }
}

// ---- Pen up / down: Enter, or the mouth when Mouth Draw is on ----

function keyPressed() {
  // Typing in a field shouldn't move the pen, and Enter or Space on a focused button presses that button
  const active = document.activeElement;
  if (active && active.matches('input, textarea, select, [contenteditable]')) return;
  if ((keyCode === ENTER || key === ' ') && active && active.matches('button, a')) return;

  if (key === ' ') {
    restart();
    return false; // don't scroll the page
  } else if (key === 'm' || key === 'M') {
    setMouthControl(!usingMouthControl);
  } else if (keyCode === ENTER) {
    if (usingMouthControl) {
      setMouthControl(false); // Enter during Mouth Draw: switch it off and stop drawing
    } else if (drawingEnabled) {
      stopDrawing();
    } else {
      startDrawing();
    }
  }
}

// Mouth closed draws, mouth open lifts the pen
function checkMouth(keypoints) {
  if (!usingMouthControl) return;
  const upperLip = keypoints[upperLipIndex];
  const lowerLip = keypoints[lowerLipIndex];
  const open = dist(upperLip.x, upperLip.y, lowerLip.x, lowerLip.y) > 10;
  if (open === mouthWasOpen) return; // act only when it changes
  mouthWasOpen = open;
  if (open) stopDrawing();
  else startDrawing();
}

function setMouthControl(on) {
  usingMouthControl = on;
  mouthWasOpen = true;
  stopDrawing();
  $('mouthSwitch').setAttribute('aria-checked', String(on));
  $('mouthHelp').textContent = on ? 'Close to draw, open to lift' : 'Off · press Enter to draw';
}

// Restart (button or Space): clear the drawing and go back to the default black pen, lifted, in the centre
function restart() {
  clearCanvas();
  paint = 'black';
  tool = 'pen';
  updateToolButtons();
  penX = width / 2;
  penY = height / 2;
  lastNose = createVector(penX, penY); // Learn: smooth on from here
}

// ---- Controls ----

function setMode(next) {
  mode = next;
  lastNose = null;
  for (const el of document.querySelectorAll('[data-mode]')) {
    el.setAttribute('aria-checked', String(el.dataset.mode === mode));
  }
  $('modeHelp').textContent = MODE_HELP[mode];
  $('tools').hidden = mode !== 'create';
  if (mode !== 'create') {
    tool = 'pen'; // Learn and Play only have the pen
    updateToolButtons();
  }
  endDwell();
  dwell = { el: null, since: 0 };
}

function setTrace(next) {
  trace = next;
  $('traceThumb').innerHTML = THUMBS[trace];
  $('traceValue').textContent = SHAPES[trace].name;
  for (const el of document.querySelectorAll('#traceList [role="option"]')) {
    el.setAttribute('aria-selected', String(el.dataset.trace === trace));
  }
}

function setTraceMenu(open) {
  $('traceList').hidden = !open;
  $('traceButton').setAttribute('aria-expanded', String(open));
}

function setupControls() {
  // Properties bar: hidden until the therapist opens it
  $('props').classList.add('closed');
  $('propsTab').addEventListener('click', () => {
    const open = $('propertiesBar').hidden;
    $('propertiesBar').hidden = !open;
    $('props').classList.toggle('closed', !open);
    $('propsTab').setAttribute('aria-expanded', String(open));
    if (!open) setTraceMenu(false);
  });

  for (const el of document.querySelectorAll('[data-mode]')) {
    el.addEventListener('click', () => setMode(el.dataset.mode));
  }

  $('mouthSwitch').addEventListener('click', () => setMouthControl(!usingMouthControl));

  // Trace dropdown
  const list = $('traceList');
  for (const id of Object.keys(SHAPES)) {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'option';
    opt.setAttribute('role', 'option');
    opt.dataset.trace = id;
    opt.innerHTML = THUMBS[id] + SHAPES[id].name;
    opt.addEventListener('click', () => {
      setTrace(id);
      setTraceMenu(false);
      $('traceButton').focus();
    });
    list.appendChild(opt);
  }
  $('traceButton').addEventListener('click', () => setTraceMenu(list.hidden));
  document.addEventListener('click', (e) => {
    if (!list.hidden && !e.target.closest('.trace')) setTraceMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !list.hidden) {
      setTraceMenu(false);
      $('traceButton').focus();
    }
  });
  setTrace('none');

  // Upload Image
  $('imageUploadInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImg = loadImage(e.target.result);
    };
    reader.readAsDataURL(file);
    $('uploadName').textContent = file.name;
    $('uploadName').classList.add('has-file');
    $('removeImage').hidden = false;
    event.target.value = '';
  });
  $('removeImage').addEventListener('click', () => {
    uploadedImg = null;
    $('uploadName').textContent = 'Choose image…';
    $('uploadName').classList.remove('has-file');
    $('removeImage').hidden = true;
  });

  // Tools on the canvas also work with a mouse
  for (const el of document.querySelectorAll('[data-paint]')) {
    el.addEventListener('click', () => pickPaint(el.dataset.paint));
  }
  for (const el of document.querySelectorAll('[data-tool]')) {
    el.addEventListener('click', () => pickTool(el.dataset.tool));
  }

  $('restartButton').addEventListener('click', restart);
  $('saveArtButton').addEventListener('click', saveArt);

  // After a mouse click, let go of focus so Enter goes back to drawing (keyboard focus is kept)
  document.addEventListener('click', (e) => {
    const el = e.target.closest('button, a');
    if (el && e.detail > 0 && el.id !== 'traceButton') el.blur();
  });
  document.querySelector('.back').addEventListener('click', (e) => e.preventDefault());
}

// ---- Save ----

// Hide everything but the art, sign it, save a PNG, then start a fresh canvas
function saveArt() {
  printing = true;
  setTimeout(() => {
    noLoop();
    redraw(); // one clean frame: no camera, guide, image or cursor

    const title = $('artworkTitle').value.trim();
    const artist = $('artistname').value.trim();
    const signature = [title, artist && 'by ' + artist].filter(Boolean).join(' ');

    const ctx = drawingContext;
    ctx.save();
    ctx.font = '800 48px Lexend, Inter, sans-serif';
    ctx.fillStyle = '#000000';
    ctx.fillText('all.draw', 30, 80);
    if (signature) ctx.fillText(signature, 30, height - 20);
    ctx.restore();

    saveCanvas(signature || 'all.draw', 'png');

    printing = false;
    clearCanvas();
    loop();
  }, 100);
}

function clearCanvas() {
  paths = [];
  stopDrawing();
}
