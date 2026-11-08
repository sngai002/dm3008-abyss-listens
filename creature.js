/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * creature.js - how the creatures move and react
 *
 * STREAM B owns this file. A Creature is an autonomous agent
 * (week 6 boids) that also drifts on a noise field (week 5),
 * rises and sinks with the tide, and reacts to the fishing line.
 * It does not draw itself, it asks its Body (anatomy.js) to.
 * The Shoal manages the whole population.
 */

///////////////////////////////////////////////////////////////////
// Family behaviour
// Same index as familyLook in anatomy.js. Add to the end, never reorder.
//   dayDepth / nightDepth  where the family sits as fractions of the
//                          canvas height, [shallowest, deepest].
//                          Past 1 is below the screen, out of reach.
//   perArea                how many to spawn per 100k pixels of canvas
///////////////////////////////////////////////////////////////////

// *** change how each family behaves here
let familyBehaviour = [
  // 0 - sea sparkle: drift only, no flocking
  { maxSpeed: 0.6, maxForce: 0.02, sep: 0, ali: 0, coh: 0, dayDepth: [0.62, 1.22], nightDepth: [0.06, 0.92], perArea: 25, min: 150, max: 600 },
  // 1 - lanternfish: tight schools
  { maxSpeed: 2.1, maxForce: 0.045, sep: 1.7, ali: 1.0, coh: 0.75, dayDepth: [0.78, 1.28], nightDepth: [0.12, 0.82], perArea: 6, min: 30, max: 90 },
  // 2 - alarm jelly: slow, alone
  { maxSpeed: 0.8, maxForce: 0.02, sep: 0.5, ali: 0, coh: 0, dayDepth: [0.72, 1.22], nightDepth: [0.15, 0.85], perArea: 0.4, min: 3, max: 6 },
  // 3 - sea pen: barely moves, deep
  { maxSpeed: 0.3, maxForce: 0.01, sep: 1.0, ali: 0, coh: 0, dayDepth: [0.9, 1.3], nightDepth: [0.55, 0.95], perArea: 0.3, min: 2, max: 5 },
  // 4 - stoplight dragon: one, hunts alone, night only
  { maxSpeed: 0.9, maxForce: 0.03, sep: 0, ali: 0, coh: 0, dayDepth: [1.35, 1.35], nightDepth: [0.7, 0.7], perArea: 0, min: 1, max: 1 }
];

///////////////////////////////////////////////////////////////////
// Creature Object
// STUB: drifts on noise and sinks to its depth so the sketch runs.
// Stream B replaces the behaviour (flocking, fleeing the line,
// being struck) and keeps this interface:
//   creature.family, .position, .velocity, .body
//   creature.run(neighbours)   move, react, render
//   creature.strike()          the line hit it (flash, sound, ripple)
///////////////////////////////////////////////////////////////////

function Creature(x, y, family) {
  this.family = family;
  this.settings = familyBehaviour[family];
  this.body = new Body(family, random(100000));

  this.position = createVector(x, y);
  this.velocity = p5.Vector.random2D().mult(this.settings.maxSpeed);
  this.acceleration = createVector(0, 0);
  this.maxSpeed = this.settings.maxSpeed;
  this.maxForce = this.settings.maxForce;

  this.pref = random(); // preferred band within the family's depth range
  this.flash = 0; // 1 just after a strike, fades to 0
  this.cooldown = 0; // frames until it can be struck again
  this.seed = random(1000); // for its own noise wander
}

Creature.prototype.run = function (neighbours) {
  this.flock(neighbours);
  this.update();
  this.borders();
  this.render();
};

Creature.prototype.applyForce = function (force) {
  this.acceleration.add(force);
};

// Steering. Placeholder: noise wander plus a pull toward the right depth.
Creature.prototype.flock = function (neighbours) {
  let a = noise(this.position.x * 0.002, this.position.y * 0.002, frameCount * 0.002 + this.seed) * TWO_PI * 2;
  let wander = p5.Vector.fromAngle(a).mult(this.maxForce);
  this.applyForce(wander);

  let want = tide.depthFor(this.pref, this.settings.dayDepth, this.settings.nightDepth);
  let pull = constrain((want - this.position.y) * 0.0004, -this.maxForce, this.maxForce);
  this.applyForce(createVector(0, pull));

  // strike check: the line brushed us
  let hit = fline.nearest(this.position.x, this.position.y, this.body.radius + 20);
  if (hit.d < this.body.radius + 4 && fline.speed > 0.5 && this.cooldown <= 0 && this.position.y < height) {
    this.strike();
  }
};

Creature.prototype.update = function () {
  this.velocity.add(this.acceleration);
  this.velocity.limit(this.maxSpeed * (1 + this.flash * 0.9));
  this.position.add(this.velocity);
  this.acceleration.mult(0);
  this.flash *= 0.94;
  if (this.cooldown > 0) this.cooldown--;
};

// Wrap left and right. Vertical movement is the migration, so no wrap there.
Creature.prototype.borders = function () {
  let r = this.body.radius * 2;
  if (this.position.x < -r) this.position.x = width + r;
  if (this.position.x > width + r) this.position.x = -r;
  if (this.position.y < 12) this.velocity.y += 0.1;
  if (this.position.y > height * 1.5) this.position.y = height * 1.5;
};

// The line struck this creature.
Creature.prototype.strike = function () {
  this.flash = 1;
  this.cooldown = 45; // *** frames before it can be struck again
  fline.strike();
  sound.play(this);
};

Creature.prototype.render = function () {
  if (this.position.y > height + 40) return; // below the screen, skip
  let heading = this.velocity.heading();
  let lit = max(0, 1 - dist(this.position.x, this.position.y, fline.lx, fline.ly) / 160);
  this.body.render(this.position.x, this.position.y, heading, this.flash, lit);
};

///////////////////////////////////////////////////////////////////
// Shoal Object
// All the creatures. Spawns the right number of each family for the
// canvas size, runs them through the grid, and keeps the list sorted
// so big slow things draw behind the small quick ones.
///////////////////////////////////////////////////////////////////

function Shoal() {
  this.creatures = [];
}

// How many of a family this canvas should have.
Shoal.prototype.targetCount = function (family) {
  let s = familyBehaviour[family];
  let n = round((width * height) / 100000 * s.perArea);
  return constrain(n, s.min, s.max);
};

// Fills the sea at the start. Each creature begins near its depth.
Shoal.prototype.populate = function () {
  this.creatures = [];
  for (let f = 0; f < familyBehaviour.length; f++) {
    let n = this.targetCount(f);
    for (let i = 0; i < n; i++) {
      let c = new Creature(random(width), 0, f);
      c.position.y = tide.depthFor(c.pref, c.settings.dayDepth, c.settings.nightDepth) + random(-60, 60);
      this.creatures.push(c);
    }
  }
};

Shoal.prototype.count = function (family) {
  let n = 0;
  for (let i = 0; i < this.creatures.length; i++) {
    if (this.creatures[i].family === family) n++;
  }
  return n;
};

Shoal.prototype.run = function (grid) {
  grid.clear();
  for (let i = 0; i < this.creatures.length; i++) {
    grid.insert(this.creatures[i]);
  }
  for (let i = 0; i < this.creatures.length; i++) {
    let neighbours = grid.query(this.creatures[i].position);
    this.creatures[i].run(neighbours);
  }
};
