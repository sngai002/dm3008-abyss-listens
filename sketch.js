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
 *   through the surface. This first click also turns the sound on.
 *
 *   mouse        move it to steer the lure. A slow lure drifts past
 *                things, a fast one disturbs them: plankton flare in a
 *                chain, schools scatter, jellies pulse, the sea pen's
 *                light runs up its stem, the dragon's red beam flares
 *   h            hand tracking (needs a webcam): the lure follows your
 *                index fingertip, pinch to jig the line upward
 *   v            show / hide the small camera preview
 *   m            mute / unmute (or the button in the clock panel)
 *   g  t  i  y   hide / show the field guide, the clock, the help, the
 *                title. Clicking a panel's heading does the same
 *   n            force night, for demos in the daytime
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
 *   tide.js      real clock -> migration (0 noon, 1 midnight)
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
let lastMove = -1e9; // ms when the pointer last moved, for autopilot

function setup() {
  createCanvas(windowWidth, windowHeight);

  tide = new Tide();
  tide.update();
  tide.migration = tide.target(); // start where the clock says, no fade in

  fline = new FishingLine(width / 2, height * 0.42);
  grid = new Grid(60); // *** keep >= the biggest neighbour distance in creature.js
  sea = new Sea();
  sound = new SoundEngine();
  hand = new HandInput();
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

  // who is steering the lure: hand, mouse, or the line drifting on its own
  hand.update();
  if (!hand.active() && sea.state !== "surface") {
    if (millis() - lastMove < 7000) fline.setTarget(mouseX, mouseY);
    else autopilot();
  }
  fline.update();

  // the world, with the camera above or below the surface
  push();
  translate(0, -sea.cameraY);
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

// When nobody touches it for a while the line wanders on its own,
// so it keeps playing as an installation.
function autopilot() {
  let t = millis() * 0.001;
  let tx = width * (0.5 + 0.8 * (noise(t * 0.07, 11) - 0.5));
  let ty = height * (0.2 + 0.65 * noise(t * 0.07 + 40, 22));
  fline.setTarget(lerp(fline.tx, tx, 0.03), lerp(fline.ty, ty, 0.03));
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

///////////////////////////////////////////////////////////////////
// Input
///////////////////////////////////////////////////////////////////

function mouseMoved() {
  lastMove = millis();
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
  if (key === "h") hand.start();
  if (key === "v") hand.showVideo = !hand.showVideo;
  if (key === "n") tide.forceNight = !tide.forceNight;
  if (key === "d") showDebug = !showDebug;
}

function windowResized() {
  let wasEmpty = width === 0 || height === 0;
  resizeCanvas(windowWidth, windowHeight);
  sea.resize();
  // if the window was 0 by 0 when setup ran (some embeds), everything
  // spawned at the origin, so fill the sea again now that it has a size
  if (wasEmpty && width > 0 && height > 0) shoal.populate();
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
  text("creatures: " + shoal.creatures.length, x, y + 54);
  text("line speed: " + nf(fline.speed, 1, 2), x, y + 72);
  text("energy: " + nf(sound.energy, 1, 2), x, y + 90);
  pop();
}
