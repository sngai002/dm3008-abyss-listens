/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * dev/anatomy-test/sketch.js - every species, three seeds each
 *
 * Stream A's test bench. Loads only p5, species.js and anatomy.js.
 * Each species gets a cell with three seeds animating and its name
 * under them. Every body is struck on a timer so the flash fades
 * like the real thing, and the lure's light follows the mouse.
 *
 *   r    reroll all seeds
 *   s    stress swarm behind the grid: 600 plankton, 150 fish and
 *        40 others, the main sketch's full population, for the fps
 *   1-7  close-up: one plan's species at 2.5x, 0 back to the grid
 *   i    show the guide portraits (lit, and the dark silhouette) in each cell
 *   p    pixel density 1 or 2, to see the retina cost on a plain screen
 */

let seedsPer = 3;
let perRow = 4; // *** species cells per row
let bodies = []; // bodies[species][seed]
let flashes = [];
let showIcons = true;
let stress = false;
let swarm = [];
let closeup = -1; // plan shown at 2.5x, or -1 for the grid
let zoom = 2.5; // *** close-up scale

function setup() {
  createCanvas(windowWidth, windowHeight);
  reroll();
}

function reroll() {
  bodies = [];
  flashes = [];
  for (let sp = 0; sp < speciesList.length; sp++) {
    let set = [];
    let fl = [];
    for (let i = 0; i < seedsPer; i++) {
      set.push(new Body(sp, random(100000)));
      fl.push(0);
    }
    bodies.push(set);
    flashes.push(fl);
  }
}

// The heading each plan expects: travel direction for swimmers,
// where the bell points for a jelly, upright plus a lean for a sea pen.
function headingFor(plan, i) {
  if (plan === 2) return -HALF_PI + sin(frameCount * 0.007 + i) * 0.5;
  if (plan === 3) return -HALF_PI + sin(frameCount * 0.01 + i) * 0.15;
  return sin(frameCount * 0.01 + i) * 2.4; // swings past vertical so the flip shows
}

// The swarm is the main sketch's full population, drifting in
// straight lines with wrap, so only the drawing cost is measured.
function makeSwarm() {
  swarm = [];
  let plankton = [0, 1, 2];
  let fish = [3, 4, 5, 6, 7, 8];
  let others = [];
  for (let sp = 9; sp < speciesList.length; sp++) others.push(sp);
  addSwarm(plankton, 600);
  addSwarm(fish, 150);
  addSwarm(others, 40);
}

function addSwarm(species, count) {
  for (let i = 0; i < count; i++) {
    let sp = species[i % species.length]; // modulo, round robin over the species
    let plan = speciesList[sp].plan;
    swarm.push({
      body: new Body(sp, random(100000)),
      plan: plan,
      x: random(width),
      y: random(height),
      vx: random(-1, 1) * (plan === 1 ? 2 : 0.4),
      vy: random(-0.3, 0.3),
      flash: 0
    });
  }
}

function draw() {
  background(3, 8, 18);
  if (stress) drawSwarm();
  if (closeup >= 0) {
    drawCloseup();
    return;
  }

  let rows = ceil(speciesList.length / perRow);
  let cellW = width / perRow;
  let cellH = (height - 30) / rows;
  let k = min(1, cellH / 150); // shrink the cells on a small window
  for (let sp = 0; sp < speciesList.length; sp++) {
    let info = speciesList[sp];
    let col = sp % perRow;
    let rowIndex = floor(sp / perRow);
    let cx0 = col * cellW;
    let cy = 30 + (rowIndex + 0.5) * cellH;
    for (let i = 0; i < seedsPer; i++) {
      let cx = cx0 + (i + 0.5) * (cellW / seedsPer);
      strikeTimer(sp, i);
      let lit = max(0, 1 - dist(mouseX, mouseY, cx, cy) / 160);
      push();
      translate(cx, cy);
      scale(k);
      bodies[sp][i].render(0, 0, headingFor(info.plan, i + sp), flashes[sp][i], lit);
      pop();
    }
    if (showIcons) {
      bodies[sp][0].renderIcon(cx0 + 16, cy - cellH / 2 + 18, 24);
      bodies[sp][0].renderSilhouette(cx0 + 44, cy - cellH / 2 + 18, 24);
    }
    noStroke();
    fill(info.col[0], info.col[1], info.col[2], 200);
    textSize(11);
    textAlign(CENTER, BOTTOM);
    text(info.name + "  (" + bodyPlans[info.plan] + " x" + info.size + ")", cx0 + cellW / 2, cy + cellH / 2 - 3);
  }
  readout("fps " + round(frameRate()) + "   r reroll   s stress swarm " + (stress ? "on (" + swarm.length + " bodies)" : "off") + "   1-7 close-up   i portraits   p density " + pixelDensity());
}

// a strike every 150 frames, staggered so the grid never flashes all at once
function strikeTimer(sp, i) {
  if ((frameCount + i * 31 + sp * 17) % 150 === 0) flashes[sp][i] = 1;
  flashes[sp][i] *= 0.94;
}

// One plan's species across the screen at 2.5x, to check the details.
function drawCloseup() {
  let list = [];
  for (let sp = 0; sp < speciesList.length; sp++) {
    if (speciesList[sp].plan === closeup) list.push(sp);
  }
  let cellW = width / list.length;
  let cellH = (height - 30) / seedsPer;
  for (let n = 0; n < list.length; n++) {
    let sp = list[n];
    for (let i = 0; i < seedsPer; i++) {
      strikeTimer(sp, i);
      let cx = (n + 0.5) * cellW;
      let cy = 30 + (i + 0.5) * cellH;
      let lit = max(0, 1 - dist(mouseX, mouseY, cx, cy) / 160);
      push();
      translate(cx, cy);
      scale(zoom);
      bodies[sp][i].render(0, 0, headingFor(closeup, i + sp), flashes[sp][i], lit);
      pop();
    }
    fill(speciesList[sp].col[0], speciesList[sp].col[1], speciesList[sp].col[2], 220);
    noStroke();
    textSize(13);
    textAlign(CENTER, BOTTOM);
    text(speciesList[sp].name, (n + 0.5) * cellW, height - 8);
  }
  readout("fps " + round(frameRate()) + "   " + bodyPlans[closeup] + " at " + zoom + "x   0 back to the grid");
}

function drawSwarm() {
  for (let i = 0; i < swarm.length; i++) {
    let s = swarm[i];
    s.x += s.vx;
    s.y += s.vy;
    if (s.x < -80) s.x = width + 80;
    if (s.x > width + 80) s.x = -80;
    if (s.y < -80) s.y = height + 80;
    if (s.y > height + 80) s.y = -80;
    if (random() < 0.002) s.flash = 1;
    s.flash *= 0.94;
    let lit = max(0, 1 - dist(mouseX, mouseY, s.x, s.y) / 160);
    let heading = s.plan === 2 || s.plan === 3 ? -HALF_PI : atan2(s.vy, s.vx);
    s.body.render(s.x, s.y, heading, s.flash, lit);
  }
}

function readout(msg) {
  noStroke();
  fill(212, 230, 234);
  textSize(13);
  textAlign(LEFT, TOP);
  text(msg, 8, 8);
}

function keyPressed() {
  if (key === "r") reroll();
  if (key === "i") showIcons = !showIcons;
  if (key === "s") {
    stress = !stress;
    if (stress && swarm.length === 0) makeSwarm();
  }
  if (key >= "1" && key <= "7") closeup = int(key) - 1;
  if (key === "0") closeup = -1;
  if (key === "p") pixelDensity(pixelDensity() === 1 ? 2 : 1);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
