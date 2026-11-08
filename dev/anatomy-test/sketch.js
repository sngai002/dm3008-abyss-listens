/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * dev/anatomy-test/sketch.js - a grid of every family, six seeds each
 *
 * Stream A's test bench. Loads only p5 and anatomy.js. Each cell
 * shows one Body animating: the fish turn so the flip shows, every
 * cell is struck on a timer so the flash fades like the real thing,
 * and the lure's light follows the mouse.
 *
 *   r   reroll all seeds
 *   s   stress swarm behind the grid: 600 sparkles, 100 fish,
 *       6 jellies, 4 sea pens, 1 dragon, to read the fps at full load
 *   i   hide / show the field guide icons
 *   1-5 close-up: one family's six seeds at 3x, 0 back to the grid
 *   p   pixel density 1 or 2, to see the retina cost on a plain screen
 */

let cols = 6;
let bodies = [];
let flashes = [];
let seeds = [];
let showIcons = true;
let stress = false;
let swarm = [];
let closeup = -1; // family shown at 3x, or -1 for the grid
let zoom = 3; // *** close-up scale

function setup() {
  createCanvas(windowWidth, windowHeight);
  reroll();
}

function reroll() {
  bodies = [];
  flashes = [];
  seeds = [];
  for (let f = 0; f < familyLook.length; f++) {
    let row = [];
    let fl = [];
    let sd = [];
    for (let i = 0; i < cols; i++) {
      let seed = random(100000);
      row.push(new Body(f, seed));
      fl.push(0);
      sd.push(seed);
    }
    bodies.push(row);
    flashes.push(fl);
    seeds.push(sd);
  }
}

// The swarm is the main sketch's full population, drifting in
// straight lines with wrap, so only the drawing cost is measured.
function makeSwarm() {
  swarm = [];
  let counts = [600, 100, 6, 4, 1];
  for (let f = 0; f < counts.length; f++) {
    for (let i = 0; i < counts[f]; i++) {
      swarm.push({
        body: new Body(f, random(100000)),
        x: random(width),
        y: random(height),
        vx: random(-1, 1) * (f === 1 ? 2 : 0.4),
        vy: random(-0.3, 0.3),
        flash: 0
      });
    }
  }
}

function draw() {
  background(3, 8, 18);

  if (stress) drawSwarm();

  if (closeup >= 0) {
    drawCloseup();
    return;
  }

  let cellW = width / cols;
  let cellH = (height - 40) / familyLook.length;
  for (let f = 0; f < bodies.length; f++) {
    for (let i = 0; i < cols; i++) {
      let cx = (i + 0.5) * cellW;
      let cy = 40 + (f + 0.5) * cellH;

      // a strike every 150 frames, staggered so the grid never flashes all at once
      if ((frameCount + i * 31 + f * 17) % 150 === 0) flashes[f][i] = 1;
      flashes[f][i] *= 0.94;

      let lit = max(0, 1 - dist(mouseX, mouseY, cx, cy) / 160);
      let heading = sin(frameCount * 0.01 + i) * 2.4; // swings past vertical so the flip shows
      bodies[f][i].render(cx, cy, heading, flashes[f][i], lit);

      if (showIcons) bodies[f][i].renderIcon(cx - cellW / 2 + 22, cy - cellH / 2 + 22, 30);

      noStroke();
      fill(212, 230, 234, 90);
      textSize(10);
      textAlign(LEFT, TOP);
      text(floor(seeds[f][i]), cx - cellW / 2 + 42, cy - cellH / 2 + 8);
    }
    fill(212, 230, 234, 140);
    textSize(11);
    textAlign(LEFT, BOTTOM);
    text(familyLook[f].name, 8, 40 + (f + 1) * cellH - 4);
  }

  fill(212, 230, 234);
  textSize(13);
  textAlign(LEFT, TOP);
  text("fps " + round(frameRate()) + "   r reroll   s stress swarm " + (stress ? "on (" + swarm.length + " bodies)" : "off") + "   i icons   p density " + pixelDensity(), 8, 8);
}

// One family across the screen at 3x, to check the small details.
function drawCloseup() {
  let f = closeup;
  let cellW = width / cols;
  for (let i = 0; i < cols; i++) {
    if ((frameCount + i * 31 + f * 17) % 150 === 0) flashes[f][i] = 1;
    flashes[f][i] *= 0.94;
    let cx = (i + 0.5) * cellW;
    let cy = height * 0.5;
    let lit = max(0, 1 - dist(mouseX, mouseY, cx, cy) / 160);
    let heading = sin(frameCount * 0.01 + i) * 2.4;
    push();
    translate(cx, cy);
    scale(zoom);
    bodies[f][i].render(0, 0, heading, flashes[f][i], lit);
    pop();
    bodies[f][i].renderIcon(cx, height - 60, 48);
  }
  fill(212, 230, 234);
  textSize(13);
  textAlign(LEFT, TOP);
  text("fps " + round(frameRate()) + "   " + familyLook[f].name + " at " + zoom + "x   0 back to the grid", 8, 8);
}

function drawSwarm() {
  for (let i = 0; i < swarm.length; i++) {
    let s = swarm[i];
    s.x += s.vx;
    s.y += s.vy;
    if (s.x < -60) s.x = width + 60;
    if (s.x > width + 60) s.x = -60;
    if (s.y < -60) s.y = height + 60;
    if (s.y > height + 60) s.y = -60;
    if (random() < 0.002) s.flash = 1;
    s.flash *= 0.94;
    let lit = max(0, 1 - dist(mouseX, mouseY, s.x, s.y) / 160);
    s.body.render(s.x, s.y, atan2(s.vy, s.vx), s.flash, lit);
  }
}

function keyPressed() {
  if (key === "r") reroll();
  if (key === "i") showIcons = !showIcons;
  if (key >= "1" && key <= "5") closeup = int(key) - 1;
  if (key === "0") closeup = -1;
  if (key === "p") pixelDensity(pixelDensity() === 1 ? 2 : 1);
  if (key === "s") {
    stress = !stress;
    if (stress && swarm.length === 0) makeSwarm();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
