/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * creature.js - how the creatures move and react
 *
 * STREAM B owns this file. A Creature is an autonomous agent
 * (week 6 boids) that also drifts on a noise field (week 5),
 * rises and sinks with the tide, and reacts to the fishing line.
 * It does not draw itself, it asks its Body (anatomy.js) to.
 * The Shoal manages the whole population and the plankton chain
 * reaction.
 *
 * Flocking adapted from the Week 6 boids template (Ashley Hi), which
 * is based on Daniel Shiffman's Flocking example for p5.js, by way of
 * our earlier project Jerebu (boid.js and flock.js): neighbours from
 * a spatial grid, alignment and cohesion within one family only, a
 * noise flow field and the energy feedback loop. Rewritten here with
 * plain x and y numbers instead of p5.Vector objects, so 700
 * creatures can move without allocating anything each frame.
 */

///////////////////////////////////////////////////////////////////
// Family behaviour
// Same index as familyLook in anatomy.js. Add to the end, never reorder.
//   maxSpeed, maxForce     how fast it swims and how hard it can turn
//   sep, ali, coh          week 6 weights. 0 means the rule is off
//   flee                   how hard a moving line pushes it, as a
//                          multiple of maxForce
//   sense                  how far away it notices the line, in pixels
//   dayDepth / nightDepth  where the family sits as fractions of the
//                          canvas height, [shallowest, deepest].
//                          Past 1 is below the screen, out of reach.
//   perArea                how many to spawn per 100k pixels of canvas
///////////////////////////////////////////////////////////////////

// *** change how each family behaves here
let familyBehaviour = [
  // 0 - sea sparkle: drifts only, no flocking. the line's wake nudges it
  { maxSpeed: 0.6, maxForce: 0.02, sep: 0, ali: 0, coh: 0, flee: 2.5, sense: 60, dayDepth: [0.62, 1.22], nightDepth: [0.06, 0.92], perArea: 25, min: 150, max: 600 },
  // 1 - lanternfish: tight schools that scatter from the line
  { maxSpeed: 2.1, maxForce: 0.045, sep: 1.7, ali: 1.0, coh: 0.75, flee: 14, sense: 110, dayDepth: [0.78, 1.28], nightDepth: [0.12, 0.82], perArea: 6, min: 30, max: 90 },
  // 2 - alarm jelly: slow, alone, moves in pulses, drifts aside
  { maxSpeed: 0.8, maxForce: 0.02, sep: 0.5, ali: 0, coh: 0, flee: 3, sense: 80, dayDepth: [0.72, 1.22], nightDepth: [0.15, 0.85], perArea: 0.4, min: 3, max: 6 },
  // 3 - sea pen: anchored, only sways. speed 0 keeps it still
  { maxSpeed: 0, maxForce: 0, sep: 0, ali: 0, coh: 0, flee: 0, sense: 70, dayDepth: [0.9, 1.3], nightDepth: [0.55, 0.95], perArea: 0.3, min: 2, max: 5 },
  // 4 - stoplight dragon: one, hunts alone, below the screen by day
  { maxSpeed: 0.9, maxForce: 0.03, sep: 0, ali: 0, coh: 0, flee: 1, sense: 60, dayDepth: [1.35, 1.35], nightDepth: [0.7, 0.7], perArea: 0, min: 1, max: 1 }
];

// Shared tuning. Distances are squared once here so the loops never sqrt.
let neighbourDist = 55; // *** alignment and cohesion range, keep <= the grid cell size (60 in sketch.js)
let neighbourDistSq = neighbourDist * neighbourDist;
let flowScale = 0.002; // *** size of the swirls in the noise field
let flowSpeed = 0.002; // *** how fast the field itself changes
let scatterEnergy = 40; // *** sound.energy at which schools fully break up (one plankton chain is about 16)
let litRange = 160; // *** how far the lure's glow reaches a creature

// Plankton chain reaction (see Shoal.spark). The struck one is
// generation 0, the ones it lights are generation 1, and so on.
let chainFanout = [3, 2, 1]; // *** how many neighbours each generation lights
let chainFlash = [1, 0.8, 0.65, 0.5]; // *** flash strength per generation
let chainDelay = 7; // *** frames between one light and the next
let chainDist = 42; // *** how far a spark can jump, keep <= grid cell size
let chainDistSq = chainDist * chainDist;
let chainMax = 36; // *** lights waiting at once. keeps a sweep through a thick cloud from playing hundreds of notes

// Jelly pulse.
let jellyBeat = 0.04; // *** phase per frame, about one squeeze every 2.5 s
let jellyThrust = 0.06; // *** push on each squeeze

///////////////////////////////////////////////////////////////////
// Creature Object
// One animal. Each family has its own way of moving (see run), but
// they all feel the tide, notice the line, and light up when struck.
// Interface the rest of the sketch relies on:
//   creature.family, .position, .velocity, .body, .gen
//   creature.run(neighbours)   move, react, render
//   creature.strike()          the line hit it (flash, sound, lure flare)
///////////////////////////////////////////////////////////////////

function Creature(x, y, family) {
  this.family = family;
  this.settings = familyBehaviour[family];
  this.body = new Body(family, random(100000));

  this.position = createVector(x, y);
  this.velocity = p5.Vector.random2D().mult(this.settings.maxSpeed);
  this.ax = 0; // acceleration as two numbers, so no vectors are made per frame
  this.ay = 0;
  this.maxSpeed = this.settings.maxSpeed;
  this.maxForce = this.settings.maxForce;

  this.pref = random(); // preferred band within the family's depth range
  this.flash = 0; // 1 just after a strike, fades to 0
  this.panic = 0; // 1 while the line is shoving it, lets it go faster than it swims
  this.cooldown = 0; // frames until it can light up again
  this.gen = 0; // chain reaction generation of the last flash, sound.js reads it
  this.seed = random(1000); // for its own noise wander

  // family quirks
  this.angle = this.velocity.heading(); // where a jelly's bell or the dragon's head points
  this.phase = random(TWO_PI); // where a jelly is in its pulse
  this.anchorX = x; // a sea pen never leaves this column
  this.sway = 0; // a sea pen's lean in radians, 0 is upright
  this.swayVel = 0;
}

// Each family moves its own way, then everyone feels the line.
// Below the screen nothing can be touched or seen, so those two
// steps are skipped there to keep the deep cheap.
Creature.prototype.run = function (neighbours) {
  let reachable = this.position.y < height + 40;

  if (this.family === 0) this.drift();
  else if (this.family === 1) this.school(neighbours);
  else if (this.family === 2) this.pulse(neighbours);
  else if (this.family === 3) this.lean();
  else this.hunt(neighbours);

  if (reachable) this.sense();
  this.update();
  this.borders();
  if (reachable) this.render();
};

// Adds a steering force the Reynolds way: the caller passes desired
// velocity minus current velocity, this caps it at limit.
Creature.prototype.steer = function (fx, fy, limit) {
  let m2 = fx * fx + fy * fy;
  if (m2 > limit * limit) {
    let s = limit / sqrt(m2);
    fx *= s;
    fy *= s;
  }
  this.ax += fx;
  this.ay += fy;
};

// Noise flow field (week 5). One field for the whole sea, so
// neighbours swirl the same way, like a current. w scales the force.
Creature.prototype.flow = function (w) {
  let a = noise(this.position.x * flowScale, this.position.y * flowScale, frameCount * flowSpeed) * TWO_PI * 2;
  this.steer(cos(a) * this.maxSpeed - this.velocity.x, sin(a) * this.maxSpeed - this.velocity.y, this.maxForce * w);
};

// The diel migration: a pull toward where the tide says this one
// belongs right now. Gain is how many times maxForce the pull may
// reach: above 1 it beats the flow field, so an up-current cannot
// hold a creature near the surface all day.
Creature.prototype.migrate = function (gain) {
  let want = tide.depthFor(this.pref, this.settings.dayDepth, this.settings.nightDepth);
  let pull = (want - this.position.y) * 0.0004; // *** how firmly depth is held
  let limit = this.maxForce * gain;
  this.ay += constrain(pull, -limit, limit);
};

///////////////////////////////////////////////////////////////////
// Ways of moving
// One method per family. run() picks the right one.
///////////////////////////////////////////////////////////////////

// Sea sparkle: carried by the current, no will of its own.
Creature.prototype.drift = function () {
  this.flow(1);
  this.migrate(2);
};

// Lanternfish: the week 6 rules, plus the current and the tide.
Creature.prototype.school = function (neighbours) {
  // Feedback loop from Jerebu: the busier the music gets, the less
  // the fish care about each other, so the school breaks up and the
  // music thins out. Once it is quiet again, they regroup.
  let calm = constrain(map(sound.energy, 0, scatterEnergy, 1, 0), 0, 1);

  this.separate(neighbours, this.settings.sep);
  this.align(neighbours, this.settings.ali * calm);
  this.cohesion(neighbours, this.settings.coh * calm);
  this.flow(lerp(1.2, 0.4, calm));
  this.migrate(2);
};

// Alarm jelly: a thrust on each squeeze of the bell, then it coasts.
Creature.prototype.pulse = function (neighbours) {
  // the bell turns slowly on its own noise
  this.angle += (noise(this.seed, frameCount * 0.003) - 0.5) * 0.03; // *** how much a jelly wanders

  // sin() gives the beat; cubing it makes a short squeeze and a long rest
  this.phase += jellyBeat;
  let beat = max(0, sin(this.phase));
  beat = beat * beat * beat;
  this.ax += cos(this.angle) * beat * jellyThrust;
  this.ay += sin(this.angle) * beat * jellyThrust;

  // the water slows it between beats
  this.velocity.mult(0.965); // *** drag

  this.separate(neighbours, this.settings.sep);
  this.migrate(2);
};

// Sea pen: anchored, so it only rises and sinks with the tide and
// leans in the current. The lean is a spring the line can knock.
Creature.prototype.lean = function () {
  let want = tide.depthFor(this.pref, this.settings.dayDepth, this.settings.nightDepth);
  this.position.x = this.anchorX;
  this.position.y += (want - this.position.y) * 0.01;

  let current = sin(frameCount * 0.01 + this.seed) * 0.15; // *** how far the current bends it
  this.swayVel += (current - this.sway) * 0.004; // *** stiffness of the stem
  this.swayVel *= 0.96;
  this.sway += this.swayVel;
};

// Stoplight dragon: slow, wide turns on its own noise, and it leans
// toward any lanternfish it can see. By day its depth is below the
// screen, so it only comes within reach at night.
Creature.prototype.hunt = function (neighbours) {
  this.angle += (noise(this.seed, frameCount * 0.004) - 0.5) * 0.06; // *** how wide the turns are

  let bestD = neighbourDistSq * 4; // it sees a little past the grid, but only what the grid returns
  let tx = 0;
  let ty = 0;
  for (let i = 0; i < neighbours.length; i++) {
    let other = neighbours[i];
    if (other.family !== 1) continue;
    let dx = other.position.x - this.position.x;
    let dy = other.position.y - this.position.y;
    let d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      bestD = d2;
      tx = dx;
      ty = dy;
    }
  }
  if (tx !== 0 || ty !== 0) {
    let to = atan2(ty, tx);
    let diff = atan2(sin(to - this.angle), cos(to - this.angle)); // shortest way round
    this.angle += diff * 0.03; // *** how keenly it turns toward prey
  }

  this.steer(cos(this.angle) * this.maxSpeed - this.velocity.x, sin(this.angle) * this.maxSpeed - this.velocity.y, this.maxForce);
  this.migrate(3);
};

///////////////////////////////////////////////////////////////////
// Rules of Flocking
// Same rules as the Week 6 template, but looping over neighbours
// from the grid and written with plain numbers. Alignment and
// cohesion only count the same family. Separation counts everyone
// except plankton, which are too small to swim around.
///////////////////////////////////////////////////////////////////

// Separation
// Steers away from anything inside its personal space.
Creature.prototype.separate = function (neighbours, w) {
  if (w === 0) return;
  let sx = 0;
  let sy = 0;
  let count = 0;

  for (let i = 0; i < neighbours.length; i++) {
    let other = neighbours[i];
    if (other === this || other.family === 0) continue;

    // personal space grows with both bodies, but stays inside the grid's reach
    let space = min(this.body.radius + other.body.radius + 10, 58);
    let dx = this.position.x - other.position.x;
    let dy = this.position.y - other.position.y;
    let d2 = dx * dx + dy * dy;

    if (d2 > 0 && d2 < space * space) {
      // away from the neighbour, weighted by distance (unit vector / d)
      sx += dx / d2;
      sy += dy / d2;
      count++;
    }
  }

  if (count > 0) {
    // Reynolds: steering = desired - velocity
    let m = sqrt(sx * sx + sy * sy);
    if (m > 0) {
      let fx = (sx / m) * this.maxSpeed - this.velocity.x;
      let fy = (sy / m) * this.maxSpeed - this.velocity.y;
      this.steer(fx, fy, this.maxForce * w);
    }
  }
};

// Alignment
// Matches the average velocity of nearby creatures of the same family.
Creature.prototype.align = function (neighbours, w) {
  if (w === 0) return;
  let sx = 0;
  let sy = 0;
  let count = 0;

  for (let i = 0; i < neighbours.length; i++) {
    let other = neighbours[i];
    if (other === this || other.family !== this.family) continue;
    let dx = other.position.x - this.position.x;
    let dy = other.position.y - this.position.y;
    if (dx * dx + dy * dy < neighbourDistSq) {
      sx += other.velocity.x;
      sy += other.velocity.y;
      count++;
    }
  }

  if (count > 0) {
    let m = sqrt(sx * sx + sy * sy);
    if (m > 0) {
      let fx = (sx / m) * this.maxSpeed - this.velocity.x;
      let fy = (sy / m) * this.maxSpeed - this.velocity.y;
      this.steer(fx, fy, this.maxForce * w);
    }
  }
};

// Cohesion
// Seeks the average position of nearby creatures of the same family.
Creature.prototype.cohesion = function (neighbours, w) {
  if (w === 0) return;
  let sx = 0;
  let sy = 0;
  let count = 0;

  for (let i = 0; i < neighbours.length; i++) {
    let other = neighbours[i];
    if (other === this || other.family !== this.family) continue;
    let dx = other.position.x - this.position.x;
    let dy = other.position.y - this.position.y;
    if (dx * dx + dy * dy < neighbourDistSq) {
      sx += other.position.x;
      sy += other.position.y;
      count++;
    }
  }

  if (count > 0) {
    // seek the centre: desired is toward it at full speed
    let dx = sx / count - this.position.x;
    let dy = sy / count - this.position.y;
    let m = sqrt(dx * dx + dy * dy);
    if (m > 0) {
      let fx = (dx / m) * this.maxSpeed - this.velocity.x;
      let fy = (dy / m) * this.maxSpeed - this.velocity.y;
      this.steer(fx, fy, this.maxForce * w);
    }
  }
};

///////////////////////////////////////////////////////////////////
// The line
// A still line is just another thing in the water. A moving one
// pushes water ahead of it, so creatures feel it coming and move
// away: schools bolt, jellies drift aside, plankton swirl in the
// wake. Touching a body while moving is a strike.
///////////////////////////////////////////////////////////////////

Creature.prototype.sense = function () {
  let s = this.settings;
  let hit = fline.nearest(this.position.x, this.position.y, s.sense);
  if (hit.d > s.sense) return; // Infinity when the line is nowhere near

  // 0 for a lure hanging still, 1 for a fast one
  let moving = constrain((fline.speed - 0.4) / 4, 0, 1); // *** how fast counts as a disturbance
  if (moving > 0) {
    let dx = this.position.x - hit.x;
    let dy = this.position.y - hit.y;
    let d = max(hit.d, 1);
    let near = 1 - d / s.sense;

    if (s.flee > 0) {
      let push = moving * near * this.maxForce * s.flee;
      this.ax += (dx / d) * push;
      this.ay += (dy / d) * push;
      this.panic = max(this.panic, moving * near);
    }
    if (this.family === 3) {
      // the wake knocks the frond sideways, away from the line
      this.swayVel += (dx > 0 ? 1 : -1) * moving * near * 0.004; // *** how hard the line rocks a sea pen
    }
  }

  if (hit.d < this.body.radius + 4 && fline.speed > 0.5 && this.cooldown <= 0) {
    this.strike();
  }
};

// The line struck this creature.
Creature.prototype.strike = function () {
  fline.strike();
  this.ignite(1, 0);
};

// Lights up and sounds. Chain reaction flashes come through here
// too, weaker and with a later generation. A struck plankton asks
// the shoal to spread the light to its neighbours.
Creature.prototype.ignite = function (strength, gen) {
  this.flash = strength;
  this.gen = gen; // set before play() so the sound can climb with it
  this.cooldown = 45; // *** frames before it can light again
  sound.play(this);
  if (this.family === 0 && gen < chainFanout.length) shoal.spark(this, gen);
};

///////////////////////////////////////////////////////////////////
// Moving and drawing
///////////////////////////////////////////////////////////////////

Creature.prototype.update = function () {
  let v = this.velocity;
  v.x += this.ax;
  v.y += this.ay;
  this.ax = 0;
  this.ay = 0;

  // a struck or frightened creature can go faster than it swims
  let limit = this.maxSpeed * (1 + this.flash * 0.9 + this.panic); // *** panic doubles the speed
  let m2 = v.x * v.x + v.y * v.y;
  if (m2 > limit * limit) {
    let s = m2 > 0 ? limit / sqrt(m2) : 0;
    v.x *= s;
    v.y *= s;
  }

  this.position.x += v.x;
  this.position.y += v.y;
  this.flash *= 0.94; // *** how fast the light fades
  this.panic *= 0.96;
  if (this.cooldown > 0) this.cooldown--;
};

// Wrap left and right. Vertical movement is the migration, so no
// wrap there, just a nudge off the surface and a floor well below.
Creature.prototype.borders = function () {
  let r = this.body.radius * 2;
  if (this.position.x < -r) this.position.x = width + r;
  if (this.position.x > width + r) this.position.x = -r;
  if (this.position.y < 12) this.velocity.y += 0.1;
  if (this.position.y > height * 1.5) this.position.y = height * 1.5;
};

// Asks the body to draw itself. Heading is the direction of travel,
// except a sea pen stands up (minus half pi) and leans by its sway,
// and jellies and the dragon face where they are pointing.
Creature.prototype.render = function () {
  let heading;
  if (this.family === 3) heading = -HALF_PI + this.sway;
  else if (this.family === 2 || this.family === 4) heading = this.angle;
  else heading = atan2(this.velocity.y, this.velocity.x);

  // ambient light from the lure when it is close
  let dx = fline.lx - this.position.x;
  let dy = fline.ly - this.position.y;
  let d2 = dx * dx + dy * dy;
  let lit = d2 < litRange * litRange ? 1 - sqrt(d2) / litRange : 0;

  this.body.render(this.position.x, this.position.y, heading, this.flash, lit);
};

///////////////////////////////////////////////////////////////////
// Shoal Object
// All the creatures. Spawns the right number of each family for the
// canvas size, runs them through the grid, and holds the queue of
// plankton waiting to light up in a chain reaction.
///////////////////////////////////////////////////////////////////

// *** back to front: big slow families draw behind small quick ones
let drawOrder = [3, 2, 4, 1, 0];

function Shoal() {
  this.creatures = [];
  this.queue = []; // plankton about to light: { c, gen, at }
  this.grid = null; // the grid from the last run(), for spark()
}

// How many of a family this canvas should have.
Shoal.prototype.targetCount = function (family) {
  let s = familyBehaviour[family];
  let n = round((width * height) / 100000 * s.perArea);
  return constrain(n, s.min, s.max);
};

// Fills the sea at the start. Each creature begins near its depth,
// pushed in draw order so the list never needs sorting.
Shoal.prototype.populate = function () {
  this.creatures = [];
  this.queue = [];
  for (let k = 0; k < drawOrder.length; k++) {
    let f = drawOrder[k];
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
  // rebuild the grid first so every creature sees the same snapshot
  this.grid = grid;
  grid.clear();
  for (let i = 0; i < this.creatures.length; i++) {
    grid.insert(this.creatures[i]);
  }

  this.chain();

  for (let i = 0; i < this.creatures.length; i++) {
    let c = this.creatures[i];
    // plankton and sea pens ignore their neighbours, so skip the lookup for them
    let neighbours = c.family === 0 || c.family === 3 ? null : grid.query(c.position);
    c.run(neighbours);
  }
};

///////////////////////////////////////////////////////////////////
// Chain reaction
// Sea sparkle (Noctiluca) glows when disturbed, and one flash can
// set off the next. When one is struck it lights up to 3 unlit
// neighbours after a short delay, each of those lights 2, each of
// those 1, every flash a little weaker. The waiting lights sit in
// a queue stamped with the frame they should go off.
///////////////////////////////////////////////////////////////////

// Queues the nearest unlit plankton around "from". gen is the
// generation of "from"; the ones it lights are gen + 1.
Shoal.prototype.spark = function (from, gen) {
  if (this.grid === null || this.queue.length >= chainMax) return;
  let near = this.grid.query(from.position);
  let want = chainFanout[gen];

  for (let k = 0; k < want; k++) {
    // take the closest one not yet taken
    let best = null;
    let bestD = chainDistSq;
    for (let i = 0; i < near.length; i++) {
      let other = near[i];
      if (other === from || other.family !== 0 || other.cooldown > 0) continue;
      let dx = other.position.x - from.position.x;
      let dy = other.position.y - from.position.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < bestD) {
        bestD = d2;
        best = other;
      }
    }
    if (best === null) break;
    best.cooldown = 60; // taken, so nothing else lights it before its turn
    this.queue.push({ c: best, gen: gen + 1, at: frameCount + chainDelay });
  }
};

// Lights whatever in the queue is due. Walks backwards so splice is safe.
Shoal.prototype.chain = function () {
  for (let i = this.queue.length - 1; i >= 0; i--) {
    let q = this.queue[i];
    if (frameCount < q.at) continue;
    this.queue.splice(i, 1);
    q.c.ignite(chainFlash[q.gen], q.gen);
  }
};
