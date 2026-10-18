# Things to be fixed

Pending fixes and ideas. The live app is `index.html` + `style.css` + `allDraw.js` (Learn, Play and Create modes in one sketch). `neckTracking.js`, `noseTracking.js` and `sketch.js` are kept as reference only and aren't loaded.

---

## Design / UI (later)

- [ ] **Shape tools (square, circle) are on hold.** They're hidden in the screen design because they were confusing. Before bringing them back, work out:
  - what touching a shape does (stamp a fixed-size shape? draw one by moving the head?), and how a user would know
  - how it fits the rule that tools are big and far apart, for users with severe motor disabilities
  - whether they belong in Create or in a separate mode
  - Design: "all.draw Canvas Screen" (the shapes are still there, just hidden); design system: "all.draw", ShapeTool component.
- [ ] **Decide what Upload Image does.** Right now it shows the picture faded on the canvas (left of centre). The idea: let the therapist upload a custom path for the learner to follow, like the built-in Trace shapes (Butterfly, Star, Leaf). Work out how an uploaded picture becomes a path: an outline? a dashed line? where the start dot goes?
- [x] **Colour-blind-safe palette in the code.** `allDraw.js` uses the Okabe-Ito colours: orange `#E69F00`, blue `#0072B2`, green `#009E73`.
- [x] **Trace dropdown in the code.** Butterfly, Star and Leaf draw as dashed paths with a Start dot; hidden when saving.
- [ ] **Update the design system to match the build:** the Restart button (bottom bar, next to All.draw, Space), tools picked by resting 2 seconds within 40px, a ring that grows while picking, and the cursor taking the paint colour or becoming the eraser.
- [ ] **Space wipes the drawing instantly.** Restart clears everything, and Space is easy to hit by accident. Consider hold-to-restart (hold about a second, the button fills while held).
- [ ] **The pen draws on its way to a tool.** If the pen is down while you steer to a paint blob, the stroke runs into the corner. Consider lifting the pen automatically while it rests on a tool.
- [ ] **Pen icon is clipped near the top edge.** The pen picture sits 90px above its tip, and the tip can go to 50px from the top, so the top of the icon gets cut off there.

---

## Done in `allDraw.js` (October 2026)

- [x] Learn / Play / Create modes in one sketch, switched from the properties bar (replaces the `sketch.js` script-swapping idea).
- [x] Learn mode uses the nose tracking from `noseTracking.js`, now respecting Enter and Mouth Draw, and with the nose dot mapped from the camera's own resolution so it lands on the nose. The camera keeps its proportions (cropped, not stretched).
- [x] The pen reaches the whole canvas (the old `windowHeight + 200` limit is gone).
- [x] Mouth Draw: switch in the properties bar and the M key stay in sync; Enter during Mouth Draw switches it off and lifts the pen; no more empty strokes piling up.
- [x] Typing in Title or By Artist no longer triggers M, Enter or Space.
- [x] Saved filename is "<Title> by <Artist>.png" (no leading space; "all.draw.png" if both are empty).
- [x] Eraser works on its own layer, so it never wipes the trace guide or an uploaded image.
- [x] Pen cursor sits above the tools, shows pen up/down (`pen.png` / `pen-raised.png` with a shadow dot), takes the paint colour, and becomes the eraser.
- [x] Restart (button or Space) clears the drawing and goes back to the black pen in the centre.

---

## Reference files (not loaded)

`neckTracking.js`, `noseTracking.js` and `sketch.js` stay in the repo for reference; their bugs are fixed in `allDraw.js` rather than in place. `noseTracking.js` still has its commented-out random shapes and voice-mode code if those ideas come back.

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

## Git / GitHub setup

- [ ] **`git push` from Terminal fails with a password error.** GitHub stopped accepting account passwords for git in 2021, and the login saved in the macOS Keychain is old or invalid ("Invalid username or token"). Fix it with one of:
  - **GitHub CLI (easiest):** install `gh`, then run `gh auth login` and `gh auth setup-git`, which replaces the saved login.
    - `brew install gh` fails on macOS 13 until the Command Line Tools are installed (`xcode-select --install`).
    - Or download the macOS `.pkg` from https://github.com/cli/cli/releases/latest (under **Assets**, click "Show all assets").
  - **Personal access token:** create one at GitHub → Settings → Developer settings → Personal access tokens. Clear the old login with `printf "host=github.com\nprotocol=https\n\n" | git credential-osxkeychain erase`, then `git push` and paste the token when asked for a password.
- [ ] **Until then:** push from **GitHub Desktop** (Push origin), which has its own login.

---

## Other

- [x] **`V2` branch** now loads `ml5@0.20.0-alpha.4`, the version `flipHorizontal` works with.
- [ ] **`Code Archive/V0 All.Draw/index.html`** still loads both ml5 versions (fine if it stays a frozen snapshot).
- [ ] **Unused images.** `pen (1).png`, `pen1.png`, `pen.svg` and `_by Johnc.png` in the repo root aren't referenced by the live app (it uses `pen.png`, `pen-raised.png` and `eraser.png`). Keep them for the new UI or move them to an `assets/` folder.
