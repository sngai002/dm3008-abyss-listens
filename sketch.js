/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * sketch.js - setup, draw order and input
 *
 * Most animals in the open ocean make their own light, usually when
 * something disturbs the water around them. Here you lower a line
 * into the dark. Whatever it brushes against answers with light and
 * a note. The real time of day decides who has risen to meet you:
 * every night the deep sea's animals climb toward the surface to feed
 * and sink back down before dawn (the diel vertical migration), so by
 * day the water is mostly empty and the sound is muffled, and at
 * night it is full and bright.
 *
 * HOW TO INTERACT
 *   The piece opens above the water, at the real hour, with a boat and
 *   the line hanging ready. Click "Lower the line" and the camera sinks
 *   through the surface and the view widens to the whole sea. This
 *   first click also turns the sound on.
 *
 *   mouse        move it to steer the lure. A slow lure drifts past
 *                things, a fast one disturbs them: plankton flare in a
 *                chain, schools scatter, jellies pulse, the sea pen's
 *                light runs up its stem, the dragon's red beam flares
 *   guide        every creature you strike is added to the field guide.
 *                There are 26 species and at least 22 are within reach
 *                at any hour, the rest come and go with the clock
 *   back up      hold the lure at the top edge for a second, or press b,
 *                to return to the boat. The guide keeps what you found.
 *                "Start a new log" on the surface clears it for a new player
 *   h            hand tracking on / off (needs a webcam): the lure
 *                follows your index fingertip, pinch to jig the line.
 *                Hold your hand low on the screen to lower the line from
 *                the boat, hold it high to come back up
 *   v            show / hide the small camera preview
 *   m            mute / unmute (or the button in the clock panel)
 *   g  t  i  y   hide / show the field guide, the clock, the help, the
 *                title. Clicking a panel's heading does the same
 *   k            the demo scrubber: drag the hour to see the sea at any
 *                time of day, then "follow the real time" to let it go
 *   n            force night
 *   d            debug numbers (fps, migration, counts)
 *   idle         leave it alone for 7 seconds and the line drifts on
 *                its own, so it keeps playing as an installation
 *
 * HOW IT WORKS (one technique per file, see each header)
 *   Every creature is grown from one seed: noise shapes the body,
 *   L-system rules grow jelly tentacles and sea pen fronds, seeded
 *   recursion branches the dragon's lure, sine waves move fins and
 *   bells, modulo decides which segments carry a light. Creatures are
 *   boids on a noise flow field, pulled to a depth that follows the
 *   clock, fleeing the line. The sound is one Tone.js voice per family
 *   on a pentatonic scale, and how busy it gets feeds back into how
 *   tightly the schools hold together.
 *
 * FILES
 *   species.js   the 26 species, their body plans, colours and hours
 *   tide.js      real clock (or the scrubber) -> migration (0 noon, 1 midnight)
 *   line.js      the fishing line (Verlet rope) and lure
 *   anatomy.js   how each creature is grown and drawn
 *   creature.js  how creatures move, flock and react
 *   sea.js       sky, surface, dive transition, water, fog
 *   ui.js        panels drawn with p5, toggles, start button
 *   sound.js     one Tone.js voice per family
 *   hand.js      ml5 handPose steering the lure
 *   grid.js      spatial grid for neighbour lookups (from Jerebu)
 */

let tide;
let fline; // the fishing line (not "line", that is a p5 function)
let shoal;
let grid;
let sea;
let sound;
let hand;
let ui;

let showDebug = false;
let lastSeaState = ""; // sea.state last frame, to catch the moment we arrive under water
let lastMove = -1e9; // ms when the pointer last moved, for autopilot

function setup() {
  createCanvas(windowWidth, windowHeight);

  tide = new Tide();
  tide.update();
  tide.migration = tide.target(); // start where the clock says, no fade in

  grid = new Grid(60); // *** keep >= the biggest neighbour distance in creature.js
  sound = new SoundEngine();
  hand = new HandInput();
  buildWorld();
}

// Everything that depends on the canvas size. Called from setup, and
// again from windowResized if the canvas was 0 by 0 when setup ran
// (some embeds do that), since then the line, the sea and every
// creature would have been built at the origin.
function buildWorld() {
  fline = new FishingLine(width / 2, height * 0.42);
  sea = new Sea();
  ui = new Panels();
  shoal = new Shoal();
  shoal.populate();
}

function draw() {
  background(3, 8, 18);

  tide.update();
  sea.update();
  sound.update();
  sound.setDepth(tide.migration);

  // who is steering the lure: hand, mouse, or the line drifting on its own.
  // while the camera is moving (diving or rising) the lure holds still,
  // otherwise the changing zoom would drag it through the water and
  // strike everything on the way down
  hand.update();
  if (!hand.active() && sea.state === "under") {
    if (millis() - lastMove < 7000) fline.setTarget(mouseX, mouseY);
    else autopilot();
    // the first frame under water: put the lure where the pointer is
    // without a jump, or the jump itself would strike creatures
    if (lastSeaState !== "under") fline.settle();
  }
  lastSeaState = sea.state;
  fline.update();
  checkGestures();

  // the world, seen through the sea's camera (above the water, zoomed,
  // or settled under it). Older sea.js only has cameraY, so fall back.
  push();
  if (sea.applyCamera) sea.applyCamera();
  else translate(0, -sea.cameraY);
  sea.renderSky();
  sea.renderWater();
  shoal.run(grid);
  sea.renderFog();
  fline.render();
  pop();

  hand.render();
  ui.render();
  if (showDebug) drawDebug();
}

// Going down and coming back up without the button.
// A hand held low on the screen lowers the line, a hand held high
// brings it back to the boat (hand.js decides what counts as held).
// With the mouse, keeping the lure at the top edge for a second does
// the same, as does the "b" key.
let topEdgeSince = -1; // ms when the lure target first touched the top edge

function checkGestures() {
  let g = hand.gesture ? hand.gesture() : null;
  if (g === "dive" && sea.state === "surface") beginDive();
  if (g === "surface" && sea.state === "under") surfaceAgain();

  if (sea.state === "under" && !hand.active() && mouseY < height * 0.06 && millis() - lastMove < 7000) {
    if (topEdgeSince < 0) topEdgeSince = millis();
    else if (millis() - topEdgeSince > 1000) surfaceAgain(); // *** 1000 = ms to hold at the top edge
  } else {
    topEdgeSince = -1;
  }
}

// When nobody touches it for a while the line wanders on its own,
// so it keeps playing as an installation.
let autoX = -1; // the autopilot's own target, in screen coordinates
let autoY = -1;

function autopilot() {
  let t = millis() * 0.001;
  let tx = width * (0.5 + 0.8 * (noise(t * 0.07, 11) - 0.5));
  let ty = height * (0.2 + 0.65 * noise(t * 0.07 + 40, 22));
  if (autoX < 0) {
    autoX = mouseX;
    autoY = mouseY;
  }
  autoX = lerp(autoX, tx, 0.03);
  autoY = lerp(autoY, ty, 0.03);
  fline.setTarget(autoX, autoY);
}

// The start button calls this. Sound has to start from a click.
function beginDive() {
  if (!sound.ready) {
    Tone.start();
    sound.init();
  }
  sea.begin();
  lastMove = millis();
}

// Back up to the boat. The guide keeps what you have found, and you
// can lower the line again. Needs sea.surface() from sea.js.
function surfaceAgain() {
  if (sea.state !== "under" || !sea.surface) return;
  sea.surface();
  topEdgeSince = -1;
}

///////////////////////////////////////////////////////////////////
// Input
///////////////////////////////////////////////////////////////////

function mouseMoved() {
  lastMove = millis();
  autoX = -1; // next autopilot starts from wherever the mouse left the lure
}

function mouseDragged() {
  lastMove = millis();
}

function mousePressed() {
  if (ui.mousePressed()) return; // the click was on a panel
  lastMove = millis();
}

function keyPressed() {
  if (ui.keyPressed(key)) return;
  if (key === "m") sound.toggleMute();
  if (key === "h") hand.toggle ? hand.toggle() : hand.start();
  if (key === "b") surfaceAgain();
  if (key === "v") hand.showVideo = !hand.showVideo;
  if (key === "n") tide.forceNight = !tide.forceNight;
  if (key === "d") showDebug = !showDebug;
}

function windowResized() {
  let wasEmpty = width < 2 || height < 2;
  resizeCanvas(windowWidth, windowHeight);
  if (wasEmpty && width > 1 && height > 1) buildWorld();
  else sea.resize();
}

///////////////////////////////////////////////////////////////////
// Debug
///////////////////////////////////////////////////////////////////

function drawDebug() {
  push();
  noStroke();
  fill(3, 8, 18, 220);
  rect(width - 240, 170, 220, 120); // under the clock panel, clear of the guide
  fill(255);
  textAlign(LEFT, TOP);
  textSize(13);
  let x = width - 230;
  let y = 178;
  text("fps: " + round(frameRate()), x, y);
  text("migration: " + nf(tide.migration, 1, 2) + (tide.forceNight ? " (forced night)" : ""), x, y + 18);
  text("sea: " + sea.state + "  cam " + round(sea.cameraY), x, y + 36);
  text("creatures: " + shoal.creatures.length + "  species in reach: " + speciesActiveCount(tide.hour), x, y + 54);
  text("line speed: " + nf(fline.speed, 1, 2), x, y + 72);
  text("energy: " + nf(sound.energy, 1, 2), x, y + 90);
  pop();
}
