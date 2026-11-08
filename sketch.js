/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * sketch.js - setup, draw order and input
 *
 * Most animals in the open ocean make their own light, usually when
 * something disturbs the water around them. Here you lower a line
 * into the dark. Whatever it brushes against answers with light and
 * a note. The real time of day decides who has risen to meet you.
 *
 * HOW TO INTERACT (also shown on screen, press "i" to hide)
 *   start      click "Lower the line" on the surface to sink into the water
 *   mouse      move to steer the lure. moving fast disturbs more
 *   h          hand tracking: hold up a hand, the lure follows your fingertip
 *   m          mute / unmute
 *   g, t, i    hide / show the field guide, the clock, these instructions
 *   n          force night, for demos in the daytime
 *   d          debug numbers
 *
 * FILES
 *   tide.js      real clock -> migration (0 noon, 1 midnight)
 *   line.js      the fishing line (Verlet rope) and lure
 *   anatomy.js   how each creature is grown and drawn        (stream A)
 *   creature.js  how creatures move, flock and react          (stream B)
 *   sea.js       sky, surface, dive transition, water, fog    (stream C)
 *   ui.js        panels drawn with p5, toggles, start button  (stream D)
 *   sound.js     one Tone.js voice per family                 (stream E)
 *   hand.js      ml5 handPose steering the lure               (stream F)
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
  resizeCanvas(windowWidth, windowHeight);
  sea.resize();
}

///////////////////////////////////////////////////////////////////
// Debug
///////////////////////////////////////////////////////////////////

function drawDebug() {
  push();
  noStroke();
  fill(3, 8, 18, 220);
  rect(10, height - 130, 220, 120);
  fill(255);
  textAlign(LEFT, TOP);
  textSize(13);
  let y = height - 122;
  text("fps: " + round(frameRate()), 20, y);
  text("migration: " + nf(tide.migration, 1, 2) + (tide.forceNight ? " (forced night)" : ""), 20, y + 18);
  text("sea: " + sea.state + "  cam " + round(sea.cameraY), 20, y + 36);
  text("creatures: " + shoal.creatures.length, 20, y + 54);
  text("line speed: " + nf(fline.speed, 1, 2), 20, y + 72);
  text("energy: " + nf(sound.energy, 1, 2), 20, y + 90);
  pop();
}
