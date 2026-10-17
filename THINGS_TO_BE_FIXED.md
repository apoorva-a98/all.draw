# Things to be fixed

Pending fixes and cleanups for the files that aren't in use right now. The live app is `index.html` + `neckTracking.js`, which are not covered here.

---

## `noseTracking.js` (bring back once the UI is designed)

### Bugs
- [ ] **Always drawing.** `draw()` adds to `nosePath` every frame and never checks `drawingEnabled`. Enter and mouth control have no effect.
- [ ] **Mouth control never runs.** `isMouthOpen()` is defined but never called from `draw()`.
- [ ] **Clear doesn't erase the drawing.** `clearCanvas()` (line ~291) resets `paths` and `currentPath`, but the drawing is stored in `nosePath`, which never gets reset.
- [ ] **`clearCanvas()` doesn't turn drawing off.** It uses `let drawingEnabled = false` (line ~295), which creates a new local variable instead of resetting the real one. Drop the `let`.
- [ ] **Nose position scaling is off.** `map(nose.x, 0, 640, 0, width)` (lines 104–105) assumes a 640×480 video, but the video is sized to the full window (line 41). The dot and line only line up when the window is 640×480.
- [ ] **Drawing vanishes when the face is lost.** The path is drawn inside `for (let face of faces)` (line ~145), so it disappears while no face is detected.
- [ ] **Saved filename starts with a space.** `" by " + name` is used as the filename, giving `" by John.png"`.
- [ ] **Signature text lands in the wrong place on Retina screens.** It uses `canvas.clientHeight`, which is in CSS pixels, so check its placement on high-DPI screens.

### Cleanup
- [ ] `paths` / `currentPath` are only used by the Enter/mouth logic, so they're unused until that's wired into `draw()`.
- [ ] Remove the commented-out random shapes code (`spawnRandomShape`, `drawShapes`, `shapes`, `shapeTimer`).
- [ ] Voice mode is commented out (`v` key, `parseResult`). Either finish it with p5.speech or delete it along with `usingVoiceControl`, `myRec` and `speechRec`.
- [ ] There's a duplicate commented-out `remove()` at the bottom of the file.

### Before switching back to it
- [ ] `index.html` currently loads `neckTracking.js` directly. Swapping the script tag is enough for one mode, but switching modes on the fly needs p5 instance mode (see `sketch.js` below).
- [ ] Both scripts attach their own `saveArtButton` click listener. If both ever load, Print Art runs twice.

---

## `sketch.js` (mode switcher, not loaded)

- [ ] **Not loaded.** `index.html` doesn't include it at all.
- [ ] **Buttons are missing.** It looks up `fingerButton`, `noseButton`, `minuteNeckButton` and `moveAroundButton`, none of which exist in `index.html`. `getElementById(...)` returns `null`, so it would crash.
- [ ] **This way of switching can't work.** In p5 *global mode*, removing a `<script>` tag doesn't unload its functions, and p5 won't re-run `setup()` for a new script. Proper switching needs **p5 instance mode** (`new p5(sketch, 'canvasContainer')`), with each mode as its own sketch object.
- [ ] **`canvas` is undefined.** `script.onload` refers to `canvas`, which isn't defined there.
- [ ] **Save button.** It calls `saveCanvas(...)` + `clearCanvas()`, which overlaps with the save logic inside each sketch.
- [ ] **Unused code.** `saveArt()` and `resetButtons()` are never called. The `minuteNeckButton` handler is empty.

---

## `handTracking.js` (finger drawing, not wired up)

- [ ] **Smoothing doesn't work.** It smooths the last point (line 54), then appends the raw fingertip point (line 58), so the path still follows the jittery raw positions.
- [ ] **No way to lift the pen.** It draws one continuous line with no Enter or gesture to start and stop.
- [ ] **Fixed size.** The canvas is 640×480 (line 21), while the other modes use the full window.
- [ ] **No `clearCanvas()`.** Print Art / `sketch.js` would throw.
- [ ] **No print/signature logic** like the face modes have.

---

## `moveAround.js` (body pose drawing, not wired up)

- [ ] **Canvas lands in the wrong place.** `createCanvas` (line 26) has no `.parent("canvasContainer")`, so the canvas is added to the end of the page instead of the drawing area.
- [ ] **Confidence check is off.** The eye confidence check is commented out (line 70), so low-confidence keypoints still move the pen.
- [ ] **Not mirrored.** Unlike the other modes, it doesn't flip horizontally.
- [ ] **No pen up/down, `clearCanvas()` or print logic.**
- [ ] **Unused:** `connections` (lines 12, 36).

---

## All sketch files

- [ ] **Each file defines a global `remove()`.** In p5 global mode this overrides p5's built-in `remove()`. Rename it (e.g. `stopSketch()`) or move to instance mode.
- [ ] **ml5 version.** The app pins `ml5@0.20.0-alpha.4`. Moving to `ml5@1.0.1` means renaming `flipHorizontal` → `flipped` and rechecking the z-based head-angle maths.

---

## Other

- [ ] **`V2` branch** loads `ml5@1.0.1` but still passes `flipHorizontal: true` in `neckTracking.js`, so the video may not be mirrored and left/right steering could be reversed.
- [ ] **`Code Archive/V0 All.Draw/index.html`** still loads both ml5 versions (fine if it stays a frozen snapshot).
- [ ] **Unused images.** `pen (1).png`, `pen1.png`, `pen.svg`, `eraser.png` and `_by Johnc.png` in the repo root aren't referenced by the live app (only `pen.png` is). Keep them for the new UI or move them to an `assets/` folder.
