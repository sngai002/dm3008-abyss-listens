/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * creature.js - how the creatures move and react
 *
 * STREAM B owns this file. A Creature is an autonomous agent
 * (week 6 boids) that also drifts on a noise field (week 5),
 * rises and sinks with the tide, and reacts to the fishing line.
 * It does not draw itself, it asks its Body (anatomy.js) to. The
 * Shoal manages the whole population: which period's species are
 * alive, the slow swap when the period changes, and the plankton
 * chain reaction.
 *
 * A creature is one species (species.js) on one body plan. The plan
 * decides how it moves (planBehaviour below), the species decides
 * its depth band, its period of the day and how many there are.
 *
 * Flocking adapted from the Week 6 boids template (Ashley Hi), which
 * is based on Daniel Shiffman's Flocking example for p5.js, by way of
 * our earlier project Jerebu (boid.js and flock.js): neighbours from
 * a spatial grid, alignment and cohesion within one species only, a
 * noise flow field and the energy feedback loop. Rewritten here with
 * plain x and y numbers instead of p5.Vector objects, so 800
 * creatures can move without allocating anything each frame.
 */

///////////////////////////////////////////////////////////////////
// Plan behaviour
// Same index as bodyPlans in species.js. Add to the end, never reorder.
//   maxSpeed, maxForce     how fast it swims and how hard it can turn
//   sep, ali, coh          week 6 weights. 0 means the rule is off
//   flee                   how hard a moving line pushes it, as a
//                          multiple of maxForce
//   sense                  how far away it notices the line, in pixels
//   cool                   frames before it can light up again
//   dayDepth / nightDepth  where the plan sits as fractions of the
//                          canvas height, [shallowest, deepest]. A
//                          species' band picks a third of that range.
//                          Both stay inside the screen, so everything
//                          in the current period is reachable at any
//                          hour: the migration only shifts the set up
//                          at night and down by day. Only a species
//                          out of its period sinks below the screen.
///////////////////////////////////////////////////////////////////

// *** change how each body plan behaves here
let planBehaviour = [
  // 0 - sparkle: drifts only, no flocking. the line's wake nudges it
  { maxSpeed: 0.6, maxForce: 0.02, sep: 0, ali: 0, coh: 0, flee: 2.5, sense: 60, cool: 45, dayDepth: [0.25, 0.95], nightDepth: [0.06, 0.88] },
  // 1 - fish: tight schools that scatter from the line
  { maxSpeed: 2.1, maxForce: 0.045, sep: 1.7, ali: 1.0, coh: 0.75, flee: 14, sense: 110, cool: 45, dayDepth: [0.3, 0.92], nightDepth: [0.1, 0.78] },
  // 2 - jelly: slow, alone, moves in pulses, drifts aside
  { maxSpeed: 0.8, maxForce: 0.02, sep: 0.5, ali: 0, coh: 0, flee: 3, sense: 80, cool: 60, dayDepth: [0.3, 0.94], nightDepth: [0.12, 0.84] },
  // 3 - sea pen: anchored, only sways. speed 0 keeps it still
  { maxSpeed: 0, maxForce: 0, sep: 0, ali: 0, coh: 0, flee: 0, sense: 70, cool: 60, dayDepth: [0.62, 0.96], nightDepth: [0.5, 0.92] },
  // 4 - dragon: hunts alone with wide slow turns
  { maxSpeed: 0.9, maxForce: 0.03, sep: 0, ali: 0, coh: 0, flee: 1, sense: 60, cool: 60, dayDepth: [0.5, 0.95], nightDepth: [0.4, 0.86] },
  // 5 - squid: jets in bursts, then drifts. bolts from the line
  { maxSpeed: 2.6, maxForce: 0.03, sep: 0.6, ali: 0, coh: 0, flee: 12, sense: 100, cool: 50, dayDepth: [0.3, 0.94], nightDepth: [0.1, 0.84] },
  // 6 - eel: a slow travelling sine, keeps its heading, drifts aside
  { maxSpeed: 0.7, maxForce: 0.02, sep: 0.4, ali: 0, coh: 0, flee: 1.5, sense: 70, cool: 120, dayDepth: [0.3, 0.94], nightDepth: [0.15, 0.88] }
];

// How many of a species to spawn, per 100k pixels of canvas, clamped.
// Bigger species are fewer (the count is divided by size).
// *** change the population here
let rarityCount = {
  common: { perArea: 1.8, min: 15, max: 30 }, // schools
  uncommon: { perArea: 0.3, min: 3, max: 5 },
  rare: { perArea: 0.1, min: 1, max: 2 }
};
let planktonCount = { perArea: 15, min: 60, max: 210 }; // *** common plan 0 species, about 600 in all
let goneDepth = 1.3; // *** where a species out of its period waits, as a fraction of height (below the screen)
let swapSeconds = 20; // *** how long a period's set takes to sink away, and the next to rise, at 60 fps
let spawnPerFrame = 6; // *** how many of the new set are born each frame. Growing a body costs about 1 ms, so 6 keeps the frame

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

// Jelly pulse and squid jet.
let jellyBeat = 0.04; // *** phase per frame, about one squeeze every 2.5 s
let jellyThrust = 0.06; // *** push on each squeeze
let squidJetEvery = 130; // *** frames between jets, give or take a third
let squidJet = 2.2; // *** speed a jet adds, in pixels per frame

///////////////////////////////////////////////////////////////////
// Creature Object
// One animal. Each plan has its own way of moving (see run), but
// they all feel the tide and their period, notice the line, and
// light up when struck. Interface the rest of the sketch relies on:
//   creature.species, .plan, .position, .velocity, .body, .gen
//   creature.family            same as .plan, kept for one round
//   creature.run(neighbours)   move, react, render
//   creature.strike()          the line hit it (flash, sound, guide)
///////////////////////////////////////////////////////////////////

function Creature(x, y, species) {
  this.species = species;
  this.info = speciesList[species];
  this.plan = this.info.plan;
  this.family = this.plan; // older files still read family
  this.settings = planBehaviour[this.plan];
  this.body = new Body(species, random(100000));

  this.position = createVector(x, y);
  this.maxSpeed = this.settings.maxSpeed / sqrt(this.info.size); // big things are slower
  this.maxForce = this.settings.maxForce;
  this.velocity = p5.Vector.random2D().mult(this.maxSpeed);
  this.ax = 0; // acceleration as two numbers, so no vectors are made per frame
  this.ay = 0;

  // the band takes a third of the plan's depth range, pref varies inside it
  let third = ["shallow", "mid", "deep"].indexOf(this.info.band);
  if (third < 0) third = 1;
  this.pref = (third + random()) / 3;
  this.present = 0; // 0 waiting below the screen, 1 at its depth. Ramps over swapSeconds
  this.leaving = false; // true once its period is over: present ramps back to 0, then the shoal removes it

  this.flash = 0; // 1 just after a strike, fades to 0
  this.panic = 0; // 1 while the line is shoving it, lets it go faster than it swims
  this.cooldown = 0; // frames until it can light up again
  this.gen = 0; // chain reaction generation of the last flash, sound.js reads it
  this.seed = random(1000); // for its own noise wander

  // plan quirks
  this.angle = this.velocity.heading(); // where a jelly, squid, eel or dragon points
  this.phase = random(TWO_PI); // a jelly's pulse, an eel's wiggle
  this.jetIn = random(squidJetEvery); // frames until a squid's next jet
  this.anchorX = x; // a sea pen never leaves this column
  this.sway = 0; // a sea pen's lean in radians, 0 is upright
  this.swayVel = 0;
}

// Each plan moves its own way, then everyone feels the line.
// Below the screen nothing can be touched or seen, so those two
// steps are skipped there to keep the deep cheap.
Creature.prototype.run = function (neighbours) {
  // coming or going: present ramps so a change of period, or a jump
  // of the clock, is a slow rise or sinking, never a teleport
  let step = 1 / (swapSeconds * 60);
  if (this.leaving) this.present = max(0, this.present - step);
  else this.present = min(1, this.present + step);

  let reachable = this.position.y < height + 40;

  if (!reachable && this.plan !== 3) {
    // out of sight, so only the tide matters. Keeps a waiting set cheap
    this.migrate(2);
  } else if (this.plan === 0) this.drift();
  else if (this.plan === 1) this.school(neighbours);
  else if (this.plan === 2) this.pulse(neighbours);
  else if (this.plan === 3) this.lean();
  else if (this.plan === 4) this.hunt(neighbours);
  else if (this.plan === 5) this.jet(neighbours);
  else this.undulate(neighbours);

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

// Where this creature belongs right now: its band's depth for this
// hour of the migration, or the waiting depth below the screen when
// its species is out of its period, blended by present (smoothstepped
// so the ends of the journey are gentle).
Creature.prototype.wantDepth = function () {
  let home = tide.depthFor(this.pref, this.settings.dayDepth, this.settings.nightDepth);
  let u = this.present * this.present * (3 - 2 * this.present);
  return lerp(height * goneDepth, home, u);
};

// The diel migration: a pull toward wantDepth. Gain is how many
// times maxForce the pull may reach: above 1 it beats the flow
// field, so an up-current cannot hold a creature near the surface.
Creature.prototype.migrate = function (gain) {
  let pull = (this.wantDepth() - this.position.y) * 0.0004; // *** how firmly depth is held
  let limit = this.maxForce * gain;
  this.ay += constrain(pull, -limit, limit);
};

// Turns angle toward a direction by a fraction, the short way round.
Creature.prototype.turnToward = function (to, amount) {
  let diff = atan2(sin(to - this.angle), cos(to - this.angle));
  this.angle += diff * amount;
};

///////////////////////////////////////////////////////////////////
// Ways of moving
// One method per body plan. run() picks the right one.
///////////////////////////////////////////////////////////////////

// Sparkle: carried by the current, no will of its own.
Creature.prototype.drift = function () {
  this.flow(1);
  this.migrate(2);
};

// Fish: the week 6 rules, plus the current and the tide.
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

// Jelly: a thrust on each squeeze of the bell, then it coasts.
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
  this.position.x = this.anchorX;
  this.position.y += (this.wantDepth() - this.position.y) * 0.01;

  let current = sin(frameCount * 0.01 + this.seed) * 0.15; // *** how far the current bends it
  this.swayVel += (current - this.sway) * 0.004; // *** stiffness of the stem
  this.swayVel *= 0.96;
  this.sway += this.swayVel;
};

// Dragon: slow, wide turns on its own noise, and it leans toward
// any fish it can see.
Creature.prototype.hunt = function (neighbours) {
  this.angle += (noise(this.seed, frameCount * 0.004) - 0.5) * 0.06; // *** how wide the turns are

  let bestD = neighbourDistSq * 4; // it sees a little past the grid, but only what the grid returns
  let tx = 0;
  let ty = 0;
  for (let i = 0; i < neighbours.length; i++) {
    let other = neighbours[i];
    if (other.plan !== 1) continue;
    let dx = other.position.x - this.position.x;
    let dy = other.position.y - this.position.y;
    let d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      bestD = d2;
      tx = dx;
      ty = dy;
    }
  }
  if (tx !== 0 || ty !== 0) this.turnToward(atan2(ty, tx), 0.03); // *** how keenly it turns toward prey

  this.steer(cos(this.angle) * this.maxSpeed - this.velocity.x, sin(this.angle) * this.maxSpeed - this.velocity.y, this.maxForce);
  this.migrate(3);
};

// Squid: a jet every couple of seconds in the direction it faces,
// then it drifts, slows, and turns a little on noise before the next.
Creature.prototype.jet = function (neighbours) {
  this.angle += (noise(this.seed, frameCount * 0.005) - 0.5) * 0.05; // *** how much it turns between jets

  this.jetIn--;
  if (this.jetIn <= 0) {
    this.velocity.x += cos(this.angle) * squidJet;
    this.velocity.y += sin(this.angle) * squidJet;
    this.jetIn = squidJetEvery * random(0.66, 1.33);
  }
  this.velocity.mult(0.975); // *** drag between jets

  this.separate(neighbours, this.settings.sep);
  this.migrate(2);
};

// Eel: keeps a heading that only turns slowly, and swims along it in
// a travelling sine (week 4), swaying side to side as it goes.
Creature.prototype.undulate = function (neighbours) {
  this.angle += (noise(this.seed, frameCount * 0.002) - 0.5) * 0.02; // *** how slowly it changes course
  this.phase += 0.05; // *** how fast it wiggles

  // forward along the heading, plus a sideways sway at right angles to it
  let sway = sin(this.phase) * 0.6; // *** how wide the wiggle is, as a fraction of speed
  let dx = cos(this.angle) - sin(this.angle) * sway;
  let dy = sin(this.angle) + cos(this.angle) * sway;
  this.steer(dx * this.maxSpeed - this.velocity.x, dy * this.maxSpeed - this.velocity.y, this.maxForce * 3); // 3 so the sway is not flattened by the cap

  this.separate(neighbours, this.settings.sep);
  this.migrate(2);
};

///////////////////////////////////////////////////////////////////
// Rules of Flocking
// Same rules as the Week 6 template, but looping over neighbours
// from the grid and written with plain numbers. Alignment and
// cohesion only count the same species, so each kind of fish keeps
// its own school. Separation counts everyone except plankton, which
// are too small to swim around.
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
    if (other === this || other.plan === 0) continue;

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
// Matches the average velocity of nearby creatures of the same species.
Creature.prototype.align = function (neighbours, w) {
  if (w === 0) return;
  let sx = 0;
  let sy = 0;
  let count = 0;

  for (let i = 0; i < neighbours.length; i++) {
    let other = neighbours[i];
    if (other === this || other.species !== this.species) continue;
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
// Seeks the average position of nearby creatures of the same species.
Creature.prototype.cohesion = function (neighbours, w) {
  if (w === 0) return;
  let sx = 0;
  let sy = 0;
  let count = 0;

  for (let i = 0; i < neighbours.length; i++) {
    let other = neighbours[i];
    if (other === this || other.species !== this.species) continue;
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
// away: schools and squid bolt, jellies and eels drift aside,
// plankton swirl in the wake. Touching a body while moving is a strike.
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
      // eels drift aside without hurrying, everyone else may bolt
      if (this.plan !== 6) this.panic = max(this.panic, moving * near);
    }
    if (this.plan === 5) {
      // a startled squid lights its whole mantle, no note until it is touched
      this.flash = max(this.flash, moving * near * 0.6); // *** how brightly a squid startles
    }
    if (this.plan === 3) {
      // the wake knocks the frond sideways, away from the line
      this.swayVel += (dx > 0 ? 1 : -1) * moving * near * 0.004; // *** how hard the line rocks a sea pen
    }
  }

  if (hit.d < this.body.radius + 4 && fline.speed > 0.5 && this.cooldown <= 0) {
    this.strike();
  }
};

// The line struck this creature. The lure flares and the field
// guide learns the species.
Creature.prototype.strike = function () {
  fline.strike();
  this.ignite(1, 0);
  if (typeof ui !== "undefined" && ui.unlock) ui.unlock(this.species);
};

// Lights up and sounds. Chain reaction flashes come through here
// too, weaker and with a later generation. A struck plankton asks
// the shoal to spread the light to its neighbours.
Creature.prototype.ignite = function (strength, gen) {
  this.flash = strength;
  this.gen = gen; // set before play() so the sound can climb with it
  this.cooldown = this.settings.cool;
  sound.play(this);
  if (this.plan === 0 && gen < chainFanout.length) shoal.spark(this, gen);
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

  // a leaving creature must keep up with its sinking target even if it
  // is slower than the tide, so it also closes the gap directly, the
  // way a sea pen follows its depth
  if (this.leaving) this.position.y += max(0, this.wantDepth() - this.position.y) * 0.01;
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

// Asks the body to draw itself. Heading is the direction of travel
// for sparkle, fish and squid; a sea pen stands up (minus half pi)
// and leans by its sway; jellies, the dragon and eels face their own
// angle, so an eel's ribbon keeps its course while its path wiggles.
Creature.prototype.render = function () {
  let heading;
  if (this.plan === 3) heading = -HALF_PI + this.sway;
  else if (this.plan === 2 || this.plan === 4 || this.plan === 6) heading = this.angle;
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
// All the creatures. Keeps the species of the current period alive
// (species.js, periodOf), spawns the right number of each for the
// canvas size, swaps sets slowly when the period changes, runs
// everyone through the grid, and holds the queue of plankton waiting
// to light up in a chain reaction.
//   shoal.period             name of the period whose set is current
//   shoal.nextPeriod         a period waiting its turn, or null
//   shoal.creatures.length   how many are alive (two sets during a swap)
//   shoal.pending            how many of the new set are still to be born
///////////////////////////////////////////////////////////////////

// *** back to front: big slow plans draw behind small quick ones
let drawOrder = [3, 2, 5, 6, 4, 1, 0];

function Shoal() {
  this.creatures = [];
  this.period = null; // set by populate()
  this.nextPeriod = null; // a change waiting until the set now leaving has gone
  this.births = []; // species still to spawn for the current period, one entry per creature, in draw order
  this.pending = 0;
  this.queue = []; // plankton about to light: { c, gen, at }
  this.grid = null; // the grid from the last run(), for spark()
}

// How many of a species this canvas should have.
Shoal.prototype.targetCount = function (species) {
  let info = speciesList[species];
  let r = rarityCount[info.rarity];
  if (info.plan === 0 && info.rarity === "common") r = planktonCount;
  let n = round(((width * height) / 100000) * r.perArea / info.size);
  return constrain(n, r.min, r.max);
};

// Fills the sea at the start with the current period's set, every
// creature already at its depth. Plans go in draw order so the list
// never needs sorting.
Shoal.prototype.populate = function () {
  this.creatures = [];
  this.queue = [];
  this.births = [];
  this.pending = 0;
  this.period = periodOf(tide.hour);
  this.schedule(this.period);
  while (this.births.length > 0) {
    let c = this.spawn(this.births.pop());
    c.present = 1;
    c.position.y = c.wantDepth() + random(-60, 60);
  }
};

// Lists what is missing from a period's set, in draw order, as one
// entry per creature to be born. Species already alive (a set that
// was leaving and has been called back) are not born again.
Shoal.prototype.schedule = function (period) {
  this.births = [];
  let list = speciesOfPeriod(period);
  // pop() takes from the end, so push the last plan to draw first
  for (let k = drawOrder.length - 1; k >= 0; k--) {
    for (let j = 0; j < list.length; j++) {
      let s = list[j];
      if (speciesList[s].plan !== drawOrder[k]) continue;
      let missing = this.targetCount(s) - this.count(s);
      for (let i = 0; i < missing; i++) this.births.push(s);
    }
  }
  this.pending = this.births.length;
};

// Births one creature below the screen, ready to rise.
Shoal.prototype.spawn = function (species) {
  let c = new Creature(random(width), height * random(1.1, 1.45), species);
  this.creatures.push(c);
  return c;
};

// The clock has crossed into another period. Everyone not in it
// starts sinking away, anyone of it who was sinking turns back, and
// whatever the new set is missing is queued to be born below the
// screen over the next frames. Anyone already out of sight is dropped
// at once.
//
// Only two sets may be alive: the one leaving and the one arriving.
// If a set is still leaving and the new period is a third one (the
// scrubber crossed two boundaries in under a swap), the change waits
// in nextPeriod until the leaving set has gone.
Shoal.prototype.changePeriod = function (period) {
  if (this.periodsAlive(period) > 2) {
    this.nextPeriod = period;
    return;
  }
  this.nextPeriod = null;
  this.period = period;
  for (let i = this.creatures.length - 1; i >= 0; i--) {
    let c = this.creatures[i];
    c.leaving = speciesList[c.species].period !== period;
    if (c.leaving && c.position.y > height + 40) this.creatures.splice(i, 1);
  }
  this.schedule(period);
};

// How many different periods would be alive if this one joined.
Shoal.prototype.periodsAlive = function (period) {
  let seen = [period];
  for (let i = 0; i < this.creatures.length; i++) {
    let p = speciesList[this.creatures[i].species].period;
    if (seen.indexOf(p) < 0) seen.push(p);
  }
  return seen.length;
};

Shoal.prototype.count = function (species) {
  let n = 0;
  for (let i = 0; i < this.creatures.length; i++) {
    if (this.creatures[i].species === species && !this.creatures[i].leaving) n++;
  }
  return n;
};

Shoal.prototype.countPlan = function (plan) {
  let n = 0;
  for (let i = 0; i < this.creatures.length; i++) {
    if (this.creatures[i].plan === plan) n++;
  }
  return n;
};

Shoal.prototype.run = function (grid) {
  // the period of the day decides who is alive. A change that had to
  // wait is tried again every frame until the old set has gone
  let period = periodOf(tide.hour);
  if (period !== this.period) this.changePeriod(period);
  else this.nextPeriod = null;

  // a few births a frame, so the swap never costs one long frame
  for (let i = 0; i < spawnPerFrame && this.births.length > 0; i++) {
    this.spawn(this.births.pop());
  }
  this.pending = this.births.length;

  // rebuild the grid first so every creature sees the same snapshot
  this.grid = grid;
  grid.clear();
  for (let i = 0; i < this.creatures.length; i++) {
    grid.insert(this.creatures[i]);
  }

  this.chain();

  // in list order, which is draw order. A creature that has sunk out
  // of sight is removed on the way (and the index stepped back)
  for (let i = 0; i < this.creatures.length; i++) {
    let c = this.creatures[i];
    if (c.leaving && c.present <= 0 && c.position.y > height + 40) {
      this.creatures.splice(i, 1);
      i--;
      continue;
    }
    // plankton and sea pens ignore their neighbours, so skip the lookup for them
    let neighbours = c.plan === 0 || c.plan === 3 ? null : grid.query(c.position);
    c.run(neighbours);
  }
};

///////////////////////////////////////////////////////////////////
// Chain reaction
// Sea sparkle (Noctiluca) glows when disturbed, and one flash can
// set off the next. When one is struck it lights up to 3 unlit
// neighbours after a short delay, each of those lights 2, each of
// those 1, every flash a little weaker. The waiting lights sit in
// a queue stamped with the frame they should go off. Any plankton
// species can pass the light to any other.
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
      if (other === from || other.plan !== 0 || other.cooldown > 0) continue;
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
