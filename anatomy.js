/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * anatomy.js - how each creature is grown and drawn
 *
 * STREAM A owns this file. Nothing in here moves: creature.js
 * decides where a creature is and how it behaves, then asks its
 * Body to draw itself there.
 *
 * A creature is a species (species.js) on a body plan. The plan says
 * how it is built, the species says its colour, size and a few
 * tweaks (speciesLook below) so two species on one plan read as
 * different animals. Every body is grown from one seed with the
 * techniques from class, so no two look the same but they all cost
 * about the same:
 *   noise (wk 5)       body silhouette, radius around an ellipse wobbled by noise
 *   L-systems (wk 10)  tentacles and fronds, a rule set per plan, angle varies per individual
 *   recursion (wk 9)   branching fins, lure antlers and squid arms, seeded so they are stable
 *   waves (wk 4)       fins, bells and the eel's whole body move with sin() every frame
 *   modulo (wk 3)      which segments carry a light, stripe patterns
 * The still parts are drawn once into a small createGraphics()
 * sprite at birth, so each frame is one image() plus the glowing bits.
 *
 * Interface the rest of the sketch relies on:
 *   new Body(species, seed)              species is the index into speciesList
 *   body.plan, body.species, body.size   read back by creature.js, sound.js, ui.js
 *   body.radius                          collision radius (plan radius times size)
 *   body.render(x, y, heading, flash, lit)
 *   body.renderIcon(x, y, px)            a still lit portrait for the field guide
 *   body.renderSilhouette(x, y, px)      the same footprint, dark and unlit, for locked rows
 *
 * heading is the direction of travel for fish, dragons, squid and
 * eels (they flip so the belly stays down when swimming left). For a
 * jelly it is where the bell points and for a sea pen where it stands
 * (-HALF_PI is upright), as creature.js sends them.
 *
 * References
 *   Reading noise around a circle so an outline joins up without a
 *   seam: Daniel Shiffman, The Coding Train, "Polar Perlin Noise Loops".
 *   The plant rule F -> F[+F]F[-F]F and the bracket turtle:
 *   Prusinkiewicz and Lindenmayer, The Algorithmic Beauty of Plants (1990).
 */

///////////////////////////////////////////////////////////////////
// Plans and genes
// One entry per body plan (same order as bodyPlans in species.js):
// the ranges a plan draws its genome from, and the L-system rule
// set for the plans that grow one. Angles in degrees, lengths in
// pixels at size 1. speciesLook can override any range by name.
///////////////////////////////////////////////////////////////////

let planRadius = [3, 7, 30, 40, 20, 16, 14]; // *** collision radius of each plan at size 1

// *** the seed picks one value inside each range, widen a range for more variety
let planGenes = [
  // 0 - sparkle: only a size and a twinkle speed, hundreds share one halo sprite per species
  { size: [2, 3.6], twinkle: [0.04, 0.12] },
  // 1 - fish: streamlined, a light on every 1st or 2nd belly segment
  { length: [22, 30], height: [0.3, 0.42], wobble: [0.08, 0.2], segments: 8, lightEvery: [1, 2], stripeEvery: [2, 3], eye: [2.2, 3.2], tail: [5, 8], flick: [0.25, 0.4] },
  // 2 - jelly: a dome with tentacles grown from the plant rule
  { bell: [44, 62], dome: [0.55, 0.8], wobble: [0.05, 0.14], scallops: [6, 10], tentacles: [4, 8], rimLights: [8, 14], length: [60, 115], angle: [6, 22], gens: [2, 3], breathe: [0.03, 0.06],
    lsystem: { axiom: "F", rules: { F: "F[+F]F[-F]F" } } },
  // 3 - sea pen: each generation adds two stem steps (G) and a pair of pinnae,
  //     and every pinna already there grows one step before its polyp light (L)
  { stem: [58, 78], stalk: [16, 26], gens: [3, 4], angle: [35, 65], step: [5, 8], weight: [2, 3.2], sway: [0.02, 0.04],
    lsystem: { axiom: "A", rules: { A: "G[+FL][-FL]G[+FL][-FL]A", L: "FL" } } },
  // 4 - dragon: long and dark, an antler lure and a beam
  { length: [100, 130], height: [0.13, 0.18], wobble: [0.06, 0.14], segments: 14, lightEvery: [2, 3], antlerDepth: [3, 4], antlerAngle: [20, 40], antlerLen: [9, 13], rayDepth: [2, 3], beam: [70, 100], flick: [0.12, 0.2], fangs: 4 },
  // 5 - squid: a soft mantle, a skirt of short arms, two long ones that trail
  { mantle: [28, 38], height: [0.36, 0.46], wobble: [0.06, 0.14], segments: 10, lightEvery: [2, 3], arms: [6, 8], armLen: [9, 13], armDepth: [1, 2], longArm: [1, 1.4], fin: [0.3, 0.42], ripple: [0.08, 0.14] },
  // 6 - eel: a ribbon of segments that rides a travelling sine wave
  { length: [60, 90], thick: [5, 8], segments: 16, lightEvery: [2, 3], amp: [6, 10], freq: [0.08, 0.13], waves: [1.1, 1.5], head: [9, 13], wobble: [0.08, 0.16] }
];

///////////////////////////////////////////////////////////////////
// Species look
// Small per-species tweaks, same index as speciesList. A range
// here replaces the plan's range of the same name; the flags turn
// a detail on in the plan's grow function. Species with no entry
// are the plan as it comes. Add to the end, never reorder.
///////////////////////////////////////////////////////////////////

// *** make two species on one plan look like different animals here
let speciesLook = [
  // plan 0 - sparkle
  {}, // 0 Sea sparkle
  { halo: 1.5, size: [2.4, 4] }, // 1 Ember dust: a bigger, warmer glow
  { shimmer: true, halo: 0.8 }, // 2 Rainbow drift: each one a slightly different tint
  // plan 1 - fish
  {}, // 3 Lanternfish
  { length: [16, 22], height: [0.6, 0.75], lightEvery: [1, 1], eye: [3, 3.8] }, // 4 Blue hatchet: tall and flat, lights all along
  { height: [0.24, 0.3], lightEvery: [2, 3], silver: true }, // 5 Dusk sardine: plain silver, few lights
  { glass: true, lightEvery: [2, 2] }, // 6 Dawn glassfish: see-through
  { length: [34, 44], height: [0.15, 0.2], lightEvery: [3, 3], snout: true, stripeEvery: [3, 3] }, // 7 Noon needle: long, a beak
  { height: [0.22, 0.28], lightEvery: [1, 1], rows: 2, bigMouth: true }, // 8 Daylight bristlemouth: two rows of lights, a wide mouth
  // plan 2 - jelly
  {}, // 9 Alarm jelly
  { dome: [0.42, 0.55], tentacles: [14, 20], length: [18, 34], gens: [1, 1], rimLights: [16, 22], rings: true }, // 10 Moon jelly: flat, a short fringe, four rings
  { dome: [0.95, 1.2], bell: [36, 48], scallops: [4, 6], tentacles: [2, 2], gens: [2, 2], combs: true }, // 11 Crimson comb: tall, rows of lights down the bell
  { rays: true, rimLights: [12, 18], tentacles: [6, 10], gens: [2, 2], length: [50, 80] }, // 12 Sun bell: a canal to every scallop
  // plan 3 - sea pen
  {}, // 13 Sea pen
  { angle: [70, 88], gens: [4, 4], step: [6, 9], weight: [2.5, 3.5] }, // 14 Frost fan: a wide fan
  { angle: [12, 24], gens: [2, 3], step: [4, 6], stem: [70, 90], weight: [1.2, 1.8], flare: true }, // 15 Ember whip: thin, lights all at once
  // plan 4 - dragon
  {}, // 16 Stoplight dragon
  { spine: true, fangs: 8, height: [0.12, 0.15], beamStrength: 0.5 }, // 17 Viperfish: lure on a long dorsal spine, more fangs
  { lamp: true, length: [60, 80], height: [0.3, 0.36], beamStrength: 0, antlerDepth: [1, 1] }, // 18 Pale angler: a lamp on a rod, no beam, round body
  // plan 5 - squid
  { armLights: true, lightEvery: [1, 1] }, // 19 Firefly squid: lights down the arms too
  { glass: true, lightEvery: [2, 2] }, // 20 Glass squid: see-through, lights only when it panics
  { web: true, arms: [8, 8], lightEvery: [3, 3], armLen: [12, 16] }, // 21 Vampire squid: a cloak between the arms
  // plan 6 - eel
  { fin: true }, // 22 Ribbon eel: a fin along the back
  { thick: [2.5, 4], lightEvery: [3, 4], amp: [4, 7] }, // 23 Silver thread: thin
  { lightEvery: [2, 2], fin: true, length: [80, 110] }, // 24 Night ribbon: long, more lights
  { mouth: true, head: [22, 28], thick: [7, 10], lightEvery: [4, 4], amp: [4, 7], freq: [0.05, 0.08] } // 25 Gulper: mostly mouth, slow
];

let shadowCol = [58, 68, 88]; // *** the unlit grey of a locked guide row

///////////////////////////////////////////////////////////////////
// Shared sprites
// One soft halo per species, made the first time one is born.
// Drawn with blendMode(ADD) its size alone sets how bright it reads,
// so no tint() is needed (tint() repaints the pixels and is slow).
///////////////////////////////////////////////////////////////////

let haloSprites = [];
let bodiesBorn = 0;
let worldNoiseSeed = 2026; // *** the noise seed the rest of the sketch gets back after a birth

function ensureHalo(species) {
  if (haloSprites[species] !== undefined) return;
  let c = speciesList[species].col;
  let g = createGraphics(64, 64);
  g.noStroke();
  // concentric discs that fade out: a cheap radial gradient
  for (let i = 12; i > 0; i--) {
    let u = i / 12;
    g.fill(c[0], c[1], c[2], 3 + 20 * (1 - u) * (1 - u));
    g.circle(32, 32, 64 * u);
  }
  haloSprites[species] = g;
}

// Growing a body reseeds p5's random() and noise(). This hands them
// back afterwards: noise to one shared seed so the water's drift
// field is the same for everyone, random to the clock so the next
// birth is not a copy of this one.
function releaseSeeds() {
  bodiesBorn++;
  noiseSeed(worldNoiseSeed);
  randomSeed(floor(millis() * 1000) + bodiesBorn);
}

///////////////////////////////////////////////////////////////////
// Body Object
// One per creature. Sets the seed, grows a genome from it, caches
// the still parts in a sprite, then render() draws it at a position.
///////////////////////////////////////////////////////////////////

function Body(species, seed) {
  this.species = species;
  this.info = speciesList[species];
  this.plan = this.info.plan;
  this.look = this.info; // .col is the glow colour
  this.size = this.info.size;
  this.genes = planGenes[this.plan];
  this.tweak = speciesLook[species] !== undefined ? speciesLook[species] : {};
  this.seed = seed;

  // the collision radius, creature.js and the line read this
  this.radius = planRadius[this.plan] * this.size;

  this.sprite = null; // the still parts, drawn once at birth
  this.tentacles = null; // the jelly's hanging part, it sways on its own
  this.shadows = {}; // dark copies of the sprites, made when the guide first asks
  this.ox = 0; // where the creature's position sits inside the sprite
  this.oy = 0;
  this.tox = 0; // same for the tentacle sprite
  this.toy = 0;
  this.lights = []; // photophores in body coordinates: {x, y, r, k}, k is 0..1 along the body
  this.box = { x0: -4, y0: -4, x1: 4, y1: 4 }; // how much room the whole drawing takes, for the portraits
  this.haloY = 0; // where the flash halo is centred
  this.sk = max(1, this.size); // sprites of big species are drawn larger so scaling them up stays sharp

  // from here on every random() and noise() comes from the seed, so
  // the same seed always grows the same body. The species goes into
  // the mix so two species on one plan differ even with equal seeds.
  this.mix = seed + species * 1000003;
  randomSeed(this.mix);
  noiseSeed(this.mix);
  ensureHalo(species);
  this.phase = random(TWO_PI); // so a school's fins are not all in step
  this.bodyCol = mixColour(this.look.col, [10, 16, 32], 0.7); // dull flesh, the glow is the pure colour

  if (this.plan === 0) this.growSparkle();
  else if (this.plan === 1) this.growFish();
  else if (this.plan === 2) this.growJelly();
  else if (this.plan === 3) this.growSeaPen();
  else if (this.plan === 4) this.growDragon();
  else if (this.plan === 5) this.growSquid();
  else this.growEel();

  releaseSeeds();
}

// A gene range: the species' own if it has one, else the plan's.
Body.prototype.gene = function (name) {
  return this.tweak[name] !== undefined ? this.tweak[name] : this.genes[name];
};

///////////////////////////////////////////////////////////////////
// Growing
// One grow function per plan. Each reads its ranges with gene(),
// draws the still parts into this.sprite and fills this.lights with
// where the photophores are. Everything is in size-1 units; render()
// scales the whole body by this.size.
///////////////////////////////////////////////////////////////////

// 0 - sparkle. Hundreds on screen, so no sprite of its own: a dot
// drawn live, and the shared halo only while it flashes.
Body.prototype.growSparkle = function () {
  this.dot = pickGene(this.gene("size")) * this.size;
  this.twinkle = pickGene(this.gene("twinkle"));
  this.halo = this.tweak.halo !== undefined ? this.tweak.halo : 1;
  this.dotCol = this.look.col;
  if (this.tweak.shimmer) {
    // modulo (week 3): the seed picks one of three tints to lean toward
    let tints = [[255, 170, 200], [170, 255, 220], [255, 240, 170]];
    this.dotCol = mixColour(this.look.col, tints[floor(this.mix) % 3], 0.45);
  }
};

// 1 - fish. A small countershaded body, a big eye and a row of
// lights along the belly. The sprite is about 32 px wide.
Body.prototype.growFish = function () {
  let c = this.look.col;
  let tw = this.tweak;
  let len = pickGene(this.gene("length"));
  let h = len * pickGene(this.gene("height"));
  let n = this.genes.segments;
  let lightEvery = pickGeneInt(this.gene("lightEvery"));
  let stripeEvery = pickGeneInt(this.gene("stripeEvery"));
  this.len = len;
  this.tail = pickGene(this.gene("tail"));
  this.flick = pickGene(this.gene("flick"));

  // noise (week 5): the silhouette
  let pts = this.outline(len / 2, h / 2, pickGene(this.gene("wobble")), 36);

  let snout = tw.snout ? len * 0.3 : 0;
  this.ox = len / 2 + 2;
  this.oy = h / 2 + 2;
  this.sprite = this.makeSprite(len + 4 + snout, h + 4);
  let s = this.sprite;
  s.translate(this.ox, this.oy);
  if (tw.glass) {
    // a glassfish is mostly water: a faint fill and an edge
    s.fill(c[0], c[1], c[2], 28);
    s.stroke(c[0], c[1], c[2], 110);
    s.strokeWeight(0.8);
  } else {
    s.fill(this.bodyCol[0], this.bodyCol[1], this.bodyCol[2]);
  }
  fillPolygon(s, pts);
  s.noStroke();

  // modulo (week 3): every stripeEvery-th segment is a shade paler
  let pale = mixColour(c, [220, 235, 240], 0.5);
  let segW = len / n;
  if (!tw.glass) {
    for (let i = 1; i < n - 1; i++) {
      if (i % stripeEvery !== 0) continue;
      s.fill(pale[0], pale[1], pale[2], 45);
      fillPolygon(s, outlineStrip(pts, -len / 2 + i * segW, -len / 2 + (i + 1) * segW));
    }
    // a silver belly, dark back: countershading like a real fish
    s.fill(220, 235, 240, tw.silver ? 120 : 60);
    s.ellipse(0, h * 0.12, len * (tw.silver ? 0.75 : 0.6), h * 0.4);
  }

  // the eye, big and near the nose. A needle gets a beak in front of it,
  // a bristlemouth a jaw that runs most of the way back.
  let eye = pickGene(this.gene("eye"));
  s.fill(225, 238, 242);
  s.circle(len * 0.3, -h * 0.08, eye);
  s.fill(4, 8, 16);
  s.circle(len * 0.31, -h * 0.08, eye * 0.55);
  if (tw.snout) {
    s.stroke(this.bodyCol[0], this.bodyCol[1], this.bodyCol[2]);
    s.strokeWeight(1.4);
    s.line(len / 2 - 2, 0, len / 2 + snout, -1);
    s.noStroke();
  }
  if (tw.bigMouth) {
    s.stroke(c[0], c[1], c[2], 120);
    s.strokeWeight(0.7);
    s.line(len / 2 - 1, h * 0.05, len * 0.05, h * 0.3);
    s.noStroke();
  }

  // modulo (week 3) again: a photophore on every lightEvery-th belly
  // segment, and a second row up the flank for species with rows: 2
  for (let i = 1; i < n - 1; i++) {
    if (i % lightEvery !== 0) continue;
    let x = -len / 2 + (i + 0.5) * segW;
    let sl = sliceOutline(pts, x);
    this.lights.push({ x: x, y: sl.bottom - 1.2, r: tw.glass ? 1.6 : 1.3, k: i / n });
    if (tw.rows === 2) this.lights.push({ x: x, y: (sl.top + sl.bottom) * 0.5 + h * 0.08, r: 1, k: i / n });
  }
  this.bakeLights(s, tw.glass ? 140 : 90);
  this.box = { x0: -this.ox - this.tail, y0: -this.oy, x1: len + 4 + snout - this.ox, y1: h + 4 - this.oy };
};

// 2 - jelly. A translucent dome with a scalloped rim, a ring of
// lights round the edge and L-system tentacles hanging below.
// Two sprites: the bell (breathes) and the tentacles (sway).
Body.prototype.growJelly = function () {
  let c = this.look.col;
  let tw = this.tweak;
  let bw = pickGene(this.gene("bell"));
  let bh = bw * pickGene(this.gene("dome"));
  let scallops = pickGeneInt(this.gene("scallops"));
  let nT = pickGeneInt(this.gene("tentacles"));
  let nL = pickGeneInt(this.gene("rimLights"));
  let angle = radians(pickGene(this.gene("angle")));
  let gens = pickGeneInt(this.gene("gens"));
  let tLen = pickGene(this.gene("length"));
  this.breathe = pickGene(this.gene("breathe"));
  this.haloY = -bh * 0.4;

  // noise (week 5): the top half of a wobbled ellipse is the dome.
  // The rim comes back along y = 0 with a sine scallop (waves, week 4).
  let pts = this.outline(bw / 2, bh, pickGene(this.gene("wobble")), 48);
  let half = pts.length / 2;
  let dome = [];
  for (let i = half; i < pts.length; i++) dome.push(pts[i]);
  dome.push(pts[0]);
  let m = scallops * 6;
  for (let j = 1; j < m; j++) {
    let u = j / m;
    dome.push({ x: lerp(pts[0].x, pts[half].x, u), y: abs(sin(u * PI * scallops)) * 3 });
  }

  let sh = bh * 1.2 + 12;
  this.ox = bw / 2 + 4;
  this.oy = bh * 1.2 + 4;
  this.sprite = this.makeSprite(bw + 8, sh);
  let s = this.sprite;
  s.translate(this.ox, this.oy);

  // the bell is see-through, so a soft fill with a brighter edge
  s.fill(c[0], c[1], c[2], 55);
  s.stroke(c[0], c[1], c[2], 150);
  s.strokeWeight(1.2);
  fillPolygon(s, dome);

  // modulo (week 3): a radial canal runs down to every other scallop,
  // or to every one for the sun bell
  s.strokeWeight(0.8);
  s.stroke(c[0], c[1], c[2], 60);
  let canalEvery = tw.rays ? 1 : 2;
  for (let k = 0; k <= scallops; k++) {
    if (k % canalEvery !== 0) continue;
    s.line(0, -bh * 0.85, lerp(pts[0].x, pts[half].x, k / scallops), 0);
  }

  s.noStroke();
  if (tw.rings) {
    // the moon jelly's four horseshoe gonads, seen through the bell
    s.noFill();
    s.stroke(c[0], c[1], c[2], 120);
    s.strokeWeight(1.5);
    for (let k = 0; k < 4; k++) {
      s.arc(lerp(-bw * 0.22, bw * 0.22, k / 3), -bh * 0.45, bw * 0.14, bh * 0.3, PI * 0.1, PI * 0.9);
    }
    s.noStroke();
  } else {
    // the stomach, a smaller dome inside
    s.fill(c[0], c[1], c[2], 90);
    s.push();
    s.translate(0, -bh * 0.22);
    s.scale(0.45, 0.4);
    fillPolygon(s, dome);
    s.pop();
  }

  if (tw.combs) {
    // comb rows: four lines of lights running up the bell, like a ctenophore
    for (let row = 0; row < 4; row++) {
      let u = (row + 0.5) / 4;
      let a = PI + u * PI; // angle round the dome, left rim to right rim
      for (let j = 1; j <= 5; j++) {
        let v = j / 6;
        this.lights.push({ x: cos(a) * bw * 0.5 * v, y: sin(a) * bh * v, r: 1.3, k: v });
      }
    }
  } else {
    // the ring of lights round the rim, every other one bigger (modulo, week 3)
    for (let i = 0; i < nL; i++) {
      let u = (i + 0.5) / nL;
      this.lights.push({ x: lerp(-bw * 0.46, bw * 0.46, u), y: 1.5, r: i % 2 === 0 ? 1.9 : 1.2, k: i / nL });
    }
  }
  this.bakeLights(s, 110);

  // L-system (week 10): the tentacles. The trunk of F[+F]F[-F]F has
  // 3^gens steps, so the step length sets how far they hang.
  let ls = this.genes.lsystem;
  let rule = growLsystem(ls.axiom, ls.rules, gens);
  let step = tLen / pow(3, gens);
  let segs = [];
  let box = { x0: 0, y0: 0, x1: 0, y1: 0 };
  for (let t = 0; t < nT; t++) {
    let u = nT === 1 ? 0.5 : (t + 0.5) / nT;
    let x = lerp(-bw * 0.42, bw * 0.42, u);
    let heading = HALF_PI + (u - 0.5) * 0.5 + random(-0.1, 0.1); // hang down, the outer ones splay
    let walk = walkTurtle(rule, x, 2, heading, step, step, angle * random(0.85, 1.15));
    for (let i = 0; i < walk.segs.length; i++) segs.push(walk.segs[i]);
    box = unionBox(box, walk.box);
  }
  this.tox = -box.x0 + 3;
  this.toy = -box.y0 + 3;
  this.tentacles = this.makeSprite(box.x1 - box.x0 + 6, box.y1 - box.y0 + 6);
  this.tentacles.translate(this.tox, this.toy);
  drawSegments(this.tentacles, segs, c, 1.6, 170);

  this.box = unionBox({ x0: -this.ox, y0: -this.oy, x1: bw + 8 - this.ox, y1: sh - this.oy }, box);
};

// 3 - sea pen. An L-system feather on a stalk, standing upright.
Body.prototype.growSeaPen = function () {
  let c = this.look.col;
  let stemH = pickGene(this.gene("stem"));
  let stalk = pickGene(this.gene("stalk"));
  let gens = pickGeneInt(this.gene("gens"));
  let angle = radians(pickGene(this.gene("angle")));
  let step = pickGene(this.gene("step"));
  let weight = pickGene(this.gene("weight"));
  this.sway = pickGene(this.gene("sway"));
  this.stemH = stemH;
  this.base = (stemH - stalk) / 2; // the stem starts here so the whole colony is centred on the position
  this.haloY = this.base - stemH * 0.5;

  // L-system (week 10): the rule in planGenes[3]. Each generation
  // adds two stem steps and a pair of pinnae, and every pinna that
  // already exists grows one step, so the lowest ones are longest.
  let ls = this.genes.lsystem;
  let rule = growLsystem(ls.axiom, ls.rules, gens);
  let walk = walkTurtle(rule, 0, this.base, -HALF_PI, step, stemH / (2 * gens), angle);

  // the polyps light in order of height: k is 0 at the base, 1 at the tip
  for (let i = 0; i < walk.lights.length; i++) {
    let l = walk.lights[i];
    l.r = 1.5;
    l.k = constrain(map(l.y, this.base, this.base - stemH, 0, 1), 0, 1);
    this.lights.push(l);
  }

  let box = unionBox(walk.box, { x0: -4, y0: this.base, x1: 4, y1: this.base + stalk + 3 });
  this.ox = -box.x0 + 4;
  this.oy = -box.y0 + 4;
  this.sprite = this.makeSprite(box.x1 - box.x0 + 8, box.y1 - box.y0 + 8);
  let s = this.sprite;
  s.translate(this.ox, this.oy);

  // the stalk that anchors it in the mud, dull and thick
  let dull = mixColour(c, [40, 30, 30], 0.6);
  s.stroke(dull[0], dull[1], dull[2]);
  s.strokeWeight(weight + 1);
  s.line(0, this.base, 0, this.base + stalk);
  s.noStroke();
  s.fill(dull[0], dull[1], dull[2]);
  s.ellipse(0, this.base + stalk, weight * 3, weight * 2);

  drawSegments(s, walk.segs, c, weight, 200);
  this.bakeLights(s, 100);
  this.box = { x0: box.x0 - 4, y0: box.y0 - 4, x1: box.x1 + 4, y1: box.y1 + 4 };
};

// 4 - dragon. A long dark body, a searchlight under the eye, a
// recursive antler lure on the chin (or a spine, or a lamp) and fin rays.
Body.prototype.growDragon = function () {
  let c = this.look.col;
  let tw = this.tweak;
  let len = pickGene(this.gene("length"));
  let h = len * pickGene(this.gene("height"));
  let n = this.genes.segments;
  let lightEvery = pickGeneInt(this.gene("lightEvery"));
  let depth = pickGeneInt(this.gene("antlerDepth"));
  let spread = radians(pickGene(this.gene("antlerAngle")));
  let aLen = pickGene(this.gene("antlerLen"));
  let rayDepth = pickGeneInt(this.gene("rayDepth"));
  let fangs = tw.fangs !== undefined ? tw.fangs : this.genes.fangs;
  this.len = len;
  this.tail = h * 0.9;
  this.beam = pickGene(this.gene("beam"));
  this.beamStrength = tw.beamStrength !== undefined ? tw.beamStrength : 1;
  this.flick = pickGene(this.gene("flick"));
  this.bodyCol = mixColour(c, [8, 6, 14], 0.88); // nearly black, so it is the lights you see

  // noise (week 5): the silhouette, long and thin
  let pts = this.outline(len / 2, h / 2, pickGene(this.gene("wobble")), 48);

  let top = 18 + (tw.spine || tw.lamp ? 22 : 0);
  let sh = h + top + 54;
  this.ox = len / 2 + 6;
  this.oy = h / 2 + top;
  this.sprite = this.makeSprite(len + 12, sh);
  let s = this.sprite;
  s.translate(this.ox, this.oy);
  s.fill(this.bodyCol[0], this.bodyCol[1], this.bodyCol[2]);
  s.stroke(c[0], c[1], c[2], 70);
  s.strokeWeight(0.8);
  fillPolygon(s, pts);
  s.noStroke();

  // modulo (week 3): a faint stripe on every other segment, and a
  // photophore on every lightEvery-th one along the belly
  let segW = len / n;
  for (let i = 1; i < n - 1; i++) {
    let x0 = -len / 2 + i * segW;
    if (i % 2 === 0) {
      s.fill(c[0], c[1], c[2], 18);
      fillPolygon(s, outlineStrip(pts, x0, x0 + segW));
    }
    if (i % lightEvery === 0) {
      let sl = sliceOutline(pts, x0 + segW / 2);
      this.lights.push({ x: x0 + segW / 2, y: sl.bottom - 1.5, r: 1.4, k: i / n, lure: false });
    }
  }

  // the head: a pale eye, the jaw with its fangs, and the searchlight
  // photophore just under the eye
  let eyeX = len * 0.36;
  let eyeY = -h * 0.1;
  s.fill(225, 225, 235);
  s.circle(eyeX, eyeY, h * 0.34);
  s.fill(4, 4, 10);
  s.circle(eyeX + h * 0.04, eyeY, h * 0.2);
  s.stroke(c[0], c[1], c[2], 110);
  s.strokeWeight(0.8);
  s.line(len / 2 - 1, h * 0.08, len * 0.22, h * 0.3);
  for (let i = 0; i < fangs; i++) {
    let fx = len * 0.46 - i * (len * 0.22 / fangs);
    let fl = 3.5 + (fangs > 4 ? 3 * (i % 2) : 0); // modulo (week 3): a viperfish's fangs alternate long and short
    s.line(fx, h * 0.1 + i * 1.5, fx - 1, h * 0.1 + i * 1.5 - fl);
  }
  this.beamX = eyeX + h * 0.1;
  this.beamY = eyeY + h * 0.32;

  // recursion (week 9): the lure. A dragon hangs it from a chin
  // barbel, a viperfish arches it forward on a long dorsal spine, an
  // angler holds a round lamp on a short rod. A light on every tip.
  let tips = [];
  s.stroke(c[0], c[1], c[2], 140);
  if (tw.spine) {
    let sx = -len * 0.1;
    let sy = sliceOutline(pts, sx).top;
    s.noFill();
    s.bezier(sx, sy, sx + len * 0.2, sy - 26, len * 0.45, sy - 26, len * 0.55, sy - 12);
    this.branch(s, len * 0.55, sy - 12, HALF_PI - 0.3, aLen * 0.8, depth - 1, spread, tips);
  } else if (tw.lamp) {
    let rx = len * 0.3;
    let ry = sliceOutline(pts, rx).top;
    s.line(rx, ry, rx + 10, ry - 16);
    tips.push({ x: rx + 10, y: ry - 16, lamp: true });
  } else {
    let chinX = len * 0.26;
    let chinY = sliceOutline(pts, chinX).bottom;
    s.line(chinX, chinY, chinX - 2, chinY + 10);
    this.branch(s, chinX - 2, chinY + 10, HALF_PI + 0.15, aLen, depth, spread, tips);
  }
  for (let i = 0; i < tips.length; i++) {
    this.lights.push({ x: tips[i].x, y: tips[i].y, r: tips[i].lamp ? 3.2 : 1.1, k: 1, lure: true, lamp: tips[i].lamp === true });
  }

  // recursion (week 9) again, shallower: fin rays above and below near the tail
  s.stroke(c[0], c[1], c[2], 90);
  let finX = -len * 0.26;
  let sl = sliceOutline(pts, finX);
  this.branch(s, finX, sl.top, -HALF_PI - 0.7, 7, rayDepth, 0.3, []);
  this.branch(s, finX, sl.bottom, HALF_PI + 0.7, 6, rayDepth, 0.3, []);

  this.bakeLights(s, 80);
  this.box = { x0: -this.ox - this.tail, y0: -this.oy, x1: len + 12 - this.ox, y1: sh - this.oy };
};

// 5 - squid. It swims mantle first, so the mantle is at +x and the
// arms trail behind. The mantle, head, eyes and the skirt of short
// arms are the sprite; the two long arms and the fins move live.
Body.prototype.growSquid = function () {
  let c = this.look.col;
  let tw = this.tweak;
  let ml = pickGene(this.gene("mantle"));
  let mh = ml * pickGene(this.gene("height"));
  let n = this.genes.segments;
  let lightEvery = pickGeneInt(this.gene("lightEvery"));
  let nArms = pickGeneInt(this.gene("arms"));
  let armLen = pickGene(this.gene("armLen"));
  let armDepth = pickGeneInt(this.gene("armDepth"));
  this.ml = ml;
  this.mh = mh;
  this.longArm = ml * pickGene(this.gene("longArm"));
  this.fin = pickGene(this.gene("fin"));
  this.ripple = pickGene(this.gene("ripple"));
  this.haloY = 0;

  // noise (week 5): the mantle, a soft cone from the head to the tip
  let pts = this.outline(ml / 2, mh / 2, pickGene(this.gene("wobble")), 36);
  for (let i = 0; i < pts.length; i++) {
    pts[i].y *= 1.15 - 0.45 * (pts[i].x / ml + 0.5); // tapers toward the tip at +x
    pts[i].x += ml / 2;
  }

  let skirt = armLen * 1.9 + 10;
  let hh = max(mh, 2 * armLen * 0.9) + 8;
  this.ox = skirt + 2;
  this.oy = hh / 2;
  this.sprite = this.makeSprite(ml + skirt + 6, hh);
  let s = this.sprite;
  s.translate(this.ox, this.oy);

  // recursion (week 9): the skirt of short arms, each a tiny branch()
  // tree, fanned out behind the head. The vampire squid's are joined
  // by a web.
  let tips = [];
  let headX = -4;
  s.stroke(this.bodyCol[0], this.bodyCol[1], this.bodyCol[2], 230);
  for (let a = 0; a < nArms; a++) {
    let u = nArms === 1 ? 0.5 : a / (nArms - 1);
    let ang = PI + (u - 0.5) * 1.5;
    this.branch(s, headX - 4, (u - 0.5) * mh * 0.6, ang, armLen, armDepth, 0.3, tips);
  }
  if (tw.web) {
    s.noStroke();
    s.fill(this.bodyCol[0], this.bodyCol[1], this.bodyCol[2], 150);
    s.beginShape();
    s.vertex(headX - 4, -mh * 0.3);
    for (let i = 0; i < tips.length; i += 2) s.vertex(tips[i].x, tips[i].y);
    s.vertex(headX - 4, mh * 0.3);
    s.endShape(CLOSE);
  }
  s.noStroke();

  // the mantle and the head
  if (tw.glass) {
    s.fill(c[0], c[1], c[2], 26);
    s.stroke(c[0], c[1], c[2], 120);
    s.strokeWeight(0.8);
  } else {
    s.fill(this.bodyCol[0], this.bodyCol[1], this.bodyCol[2]);
  }
  fillPolygon(s, pts);
  s.ellipse(headX, 0, 12, mh * 0.85);
  s.noStroke();
  let eyeR = tw.web ? mh * 0.3 : mh * 0.2;
  s.fill(225, 235, 240);
  s.circle(headX, -mh * 0.22, eyeR);
  s.circle(headX, mh * 0.22, eyeR);
  s.fill(4, 8, 16);
  s.circle(headX + 0.5, -mh * 0.22, eyeR * 0.55);
  s.circle(headX + 0.5, mh * 0.22, eyeR * 0.55);

  // modulo (week 3): a light on every lightEvery-th mantle segment,
  // on both flanks
  let segW = ml / n;
  for (let i = 1; i < n - 1; i++) {
    if (i % lightEvery !== 0) continue;
    let x = (i + 0.5) * segW;
    let sl = sliceOutline(pts, x);
    this.lights.push({ x: x, y: sl.top + 1.5, r: 1.2, k: i / n });
    this.lights.push({ x: x, y: sl.bottom - 1.5, r: 1.2, k: i / n });
  }
  if (!tw.glass) this.bakeLights(s, 90); // a glass squid shows nothing until it is lit
  this.box = { x0: -this.ox - this.longArm, y0: -this.oy - mh * 0.3, x1: ml + 6, y1: hh - this.oy + mh * 0.3 };
};

// 6 - eel. Only the head is a sprite. The body is a chain of
// segments that rides a travelling sine wave (waves, week 4), drawn
// live as one tapered shape, with a light on every nth segment.
Body.prototype.growEel = function () {
  let c = this.look.col;
  let tw = this.tweak;
  let n = this.genes.segments;
  this.len = pickGene(this.gene("length"));
  this.thick = pickGene(this.gene("thick"));
  this.segs = n;
  this.amp = pickGene(this.gene("amp"));
  this.freq = pickGene(this.gene("freq")) / this.size; // big eels undulate slowly
  this.waves = pickGene(this.gene("waves"));
  let hl = pickGene(this.gene("head"));
  let lightEvery = pickGeneInt(this.gene("lightEvery"));
  this.haloY = 0;

  // modulo (week 3): which segments carry a light. Their positions
  // move with the wave, so only the segment numbers are kept.
  this.lightSegs = [];
  for (let i = 2; i < n - 1; i++) {
    if (i % lightEvery === 0) this.lightSegs.push(i);
  }

  // noise (week 5): the head, a short wobbled ellipse. The gulper's
  // is mostly an open jaw.
  let hh = tw.mouth ? hl * 0.9 : this.thick * 1.3;
  let pts = this.outline(hl / 2, hh / 2, pickGene(this.gene("wobble")), 24);
  this.ox = hl / 2 + 3;
  this.oy = hh / 2 + 3 + (tw.mouth ? 2 : 0);
  this.sprite = this.makeSprite(hl + 6, hh + 6 + (tw.mouth ? hh * 0.9 : 0));
  let s = this.sprite;
  s.translate(this.ox, this.oy);
  s.fill(this.bodyCol[0], this.bodyCol[1], this.bodyCol[2]);
  fillPolygon(s, pts);
  if (tw.mouth) {
    // the lower jaw hangs open below the head
    s.fill(this.bodyCol[0] * 0.8, this.bodyCol[1] * 0.8, this.bodyCol[2] * 0.8);
    s.triangle(hl * 0.45, 0, -hl * 0.3, hh * 0.1, hl * 0.1, hh * 0.95);
    s.stroke(c[0], c[1], c[2], 90);
    s.strokeWeight(0.8);
    s.line(hl * 0.45, 0, -hl * 0.3, hh * 0.1);
    s.noStroke();
  }
  let eye = tw.mouth ? hh * 0.18 : hh * 0.34;
  s.fill(225, 238, 242);
  s.circle(hl * 0.2, -hh * 0.12, eye);
  s.fill(4, 8, 16);
  s.circle(hl * 0.22, -hh * 0.12, eye * 0.55);
  this.box = { x0: -this.len - 4, y0: -this.amp - this.thick, x1: hl / 2 + 3, y1: this.amp + this.thick + (tw.mouth ? hh : 0) };
};

// Draws each light dimly into the sprite, so the body still reads
// when nothing is lighting it.
Body.prototype.bakeLights = function (g, alpha) {
  let c = this.look.col;
  g.noStroke();
  g.fill(c[0], c[1], c[2], alpha);
  for (let i = 0; i < this.lights.length; i++) {
    g.circle(this.lights[i].x, this.lights[i].y, this.lights[i].r * 1.4);
  }
};

///////////////////////////////////////////////////////////////////
// Techniques
// The generative tools the grow functions share. All of these run
// once at birth, so none of them needs to be fast.
///////////////////////////////////////////////////////////////////

// noise (week 5): walk around an ellipse and wobble the radius with
// noise(seed + angle). The noise is read at a point on a small
// circle in noise space, so the last point meets the first with no
// seam (Shiffman's polar noise loop). Facing right: the nose is at
// index 0, the walk runs round the bottom first (y down is
// positive in p5), then back over the top.
Body.prototype.outline = function (rx, ry, wobble, steps) {
  let pts = [];
  let off = (this.mix % 1000) * 0.37;
  for (let i = 0; i < steps; i++) {
    let a = (i / steps) * TWO_PI;
    let n = noise(off + 1.2 * cos(a), off + 1.2 * sin(a));
    let w = 1 - wobble + 2 * wobble * n;
    pts.push({ x: cos(a) * rx * w, y: sin(a) * ry * w });
  }
  return pts;
};

// Where the outline crosses the vertical line at x: the top and
// bottom of the body there. Used to place segments and belly lights.
function sliceOutline(pts, x) {
  let top = 0;
  let bottom = 0;
  for (let i = 0; i < pts.length; i++) {
    let a = pts[i];
    let b = pts[(i + 1) % pts.length];
    if ((a.x <= x && b.x > x) || (b.x <= x && a.x > x)) {
      let y = a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return { top: top, bottom: bottom };
}

// The piece of the outline between two vertical lines, as a closed
// shape that follows the body edge exactly: along the top from left
// to right, then back along the bottom. Used for stripes.
function outlineStrip(pts, x0, x1) {
  let a = sliceOutline(pts, x0);
  let b = sliceOutline(pts, x1);
  let half = pts.length / 2;
  let poly = [{ x: x0, y: a.top }];
  for (let i = half; i < pts.length; i++) {
    if (pts[i].x > x0 && pts[i].x < x1) poly.push(pts[i]);
  }
  poly.push({ x: x1, y: b.top });
  poly.push({ x: x1, y: b.bottom });
  for (let i = 0; i <= half; i++) {
    if (pts[i].x > x0 && pts[i].x < x1) poly.push(pts[i]);
  }
  poly.push({ x: x0, y: a.bottom });
  return poly;
}

// L-system (week 10): rewrite every letter of the string with its
// rule, gens times. Letters without a rule stay as they are.
function growLsystem(axiom, rules, gens) {
  let s = axiom;
  for (let g = 0; g < gens; g++) {
    let next = "";
    for (let i = 0; i < s.length; i++) {
      let ch = s.charAt(i);
      next += rules[ch] !== undefined ? rules[ch] : ch;
    }
    s = next;
  }
  return s;
}

// L-system (week 10): the turtle from the plant demo. F and G step
// forward (G is the thicker stem step), + and - turn, [ and ] save
// and restore the state, L marks a light. We keep our own x, y and
// heading instead of translate()/rotate() so we can remember where
// the lights are. Returns the line segments, the lights and the
// box they fit in, all in the caller's coordinates.
function walkTurtle(s, x, y, heading, step, stemStep, angle) {
  let segs = [];
  let lights = [];
  let stack = [];
  let depth = 0;
  let box = { x0: x, y0: y, x1: x, y1: y };
  for (let i = 0; i < s.length; i++) {
    let ch = s.charAt(i);
    if (ch === "F" || ch === "G") {
      let len = ch === "G" ? stemStep : step;
      let nx = x + cos(heading) * len;
      let ny = y + sin(heading) * len;
      segs.push({ x0: x, y0: y, x1: nx, y1: ny, depth: depth });
      x = nx;
      y = ny;
      box = unionBox(box, { x0: x, y0: y, x1: x, y1: y });
    } else if (ch === "+") {
      heading += angle;
    } else if (ch === "-") {
      heading -= angle;
    } else if (ch === "[") {
      stack.push({ x: x, y: y, heading: heading });
      depth++;
    } else if (ch === "]") {
      let st = stack.pop();
      x = st.x;
      y = st.y;
      heading = st.heading;
      depth--;
    } else if (ch === "L") {
      lights.push({ x: x, y: y, r: 1.5, k: 0 });
    }
  }
  return { segs: segs, lights: lights, box: box };
}

// recursion (week 9): the branch() tree from class, kept shallow.
// Draws one line, then calls itself twice from its end, turned left
// and right, until depth runs out. The angles jitter with random(),
// which is stable because the seed was set at birth. Tips are
// collected so a light can hang on each one.
Body.prototype.branch = function (g, x, y, heading, len, depth, spread, tips) {
  let nx = x + cos(heading) * len;
  let ny = y + sin(heading) * len;
  g.strokeWeight(0.5 + depth * 0.35);
  g.line(x, y, nx, ny);
  if (depth <= 0) {
    tips.push({ x: nx, y: ny });
    return;
  }
  this.branch(g, nx, ny, heading + spread * random(0.7, 1.3), len * 0.68, depth - 1, spread, tips);
  this.branch(g, nx, ny, heading - spread * random(0.7, 1.3), len * 0.68, depth - 1, spread, tips);
};

// Strokes a list of turtle segments. Deeper branches get thinner
// and fainter, so the trunk reads as the trunk.
function drawSegments(g, segs, c, weight, alpha) {
  for (let i = 0; i < segs.length; i++) {
    let s = segs[i];
    g.stroke(c[0], c[1], c[2], alpha * pow(0.8, s.depth));
    g.strokeWeight(max(weight * pow(0.55, s.depth), 0.6));
    g.line(s.x0, s.y0, s.x1, s.y1);
  }
}

function fillPolygon(g, pts) {
  g.beginShape();
  for (let i = 0; i < pts.length; i++) g.vertex(pts[i].x, pts[i].y);
  g.endShape(CLOSE);
}

// A fresh transparent sprite, w by h body units, drawn sk times
// larger so a big species scaled up by render() stays sharp.
Body.prototype.makeSprite = function (w, h) {
  let g = createGraphics(ceil(w * this.sk), ceil(h * this.sk));
  g.scale(this.sk);
  g.noStroke();
  return g;
};

// Draws a sprite at its body-unit size, or a dark copy of it for a
// locked guide row.
Body.prototype.blit = function (name, x, y, w, h, shadow) {
  let g = this[name];
  if (shadow) {
    if (this.shadows[name] === undefined) this.shadows[name] = shadowSprite(g);
    g = this.shadows[name];
  }
  if (w === undefined) {
    w = g.width / this.sk;
    h = g.height / this.sk;
  }
  image(g, x, y, w, h);
};

// A dark copy of a sprite, made once when the guide first asks:
// the same shape and alpha in one flat colour.
function shadowSprite(g) {
  let d = createGraphics(g.width, g.height);
  d.image(g, 0, 0);
  d.loadPixels();
  for (let i = 0; i < d.pixels.length; i += 4) {
    d.pixels[i] = shadowCol[0];
    d.pixels[i + 1] = shadowCol[1];
    d.pixels[i + 2] = shadowCol[2];
  }
  d.updatePixels();
  return d;
}

function unionBox(a, b) {
  return { x0: min(a.x0, b.x0), y0: min(a.y0, b.y0), x1: max(a.x1, b.x1), y1: max(a.y1, b.y1) };
}

// Between two [r, g, b] colours, t = 0 is the first.
function mixColour(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// A value from a [low, high] range, chosen with the seeded random().
function pickGene(range) {
  return random(range[0], range[1]);
}

function pickGeneInt(range) {
  return floor(random(range[0], range[1] + 1));
}

///////////////////////////////////////////////////////////////////
// Rendering
// render() runs every frame for every creature on screen, so it is
// one image() for the still body plus a few shapes for the parts
// that move or glow. Glows use blendMode(ADD), reset to BLEND after.
///////////////////////////////////////////////////////////////////

// Draws the creature.
//   x, y     position
//   heading  see the header: travel direction, or where a bell points
//   flash    0 to 1, how recently the line struck it
//   lit      0 to 1, how close the lure is (ambient light from it)
Body.prototype.render = function (x, y, heading, flash, lit) {
  if (this.plan === 0) {
    this.drawSparkle(x, y, flash, lit, frameCount, false);
    return;
  }
  push();
  translate(x, y);
  if (this.plan === 2 || this.plan === 3) {
    rotate(heading + HALF_PI); // drawn pointing up, so -HALF_PI is upright
  } else {
    rotate(heading);
    if (cos(heading) < 0) scale(1, -1); // swimming left: flip so the belly stays down
  }
  if (this.size !== 1) scale(this.size);
  this.drawStill(frameCount, false);
  this.drawMoving(frameCount, flash, false);
  this.drawLights(flash, lit, frameCount);
  pop();
};

// A still lit portrait for the field guide, fitted inside px pixels.
Body.prototype.renderIcon = function (x, y, px) {
  this.portrait(x, y, px, false);
};

// The same footprint dark and unlit, for a row not yet found.
Body.prototype.renderSilhouette = function (x, y, px) {
  this.portrait(x, y, px, true);
};

Body.prototype.portrait = function (x, y, px, shadow) {
  let c = this.look.col;
  push();
  translate(x, y);
  noStroke();
  if (this.plan === 0) {
    if (shadow) {
      fill(shadowCol[0], shadowCol[1], shadowCol[2]);
    } else {
      blendMode(ADD);
      image(haloSprites[this.species], -px / 2, -px / 2, px, px);
      blendMode(BLEND);
      fill(c[0], c[1], c[2], 230);
    }
    circle(0, 0, px * 0.3);
  } else {
    // the fit ignores this.size so every guide row has the same footprint
    let b = this.box;
    let k = px / max(b.x1 - b.x0, b.y1 - b.y0);
    scale(k);
    translate(-(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2);
    this.drawStill(0, shadow);
    this.drawMoving(0, 0.4, shadow);
    if (!shadow) this.drawLights(0.45, 1, 0);
  }
  pop();
};

// 0 - sparkle, the cheap path: no push(), no rotate(), one circle,
// and the shared halo only while it flashes.
Body.prototype.drawSparkle = function (x, y, flash, lit, t) {
  let c = this.dotCol;
  // waves (week 4): a slow twinkle on its own phase
  let tw = 0.5 + 0.5 * sin(t * this.twinkle + this.phase);
  noStroke();
  fill(c[0], c[1], c[2], 80 + 100 * tw + 75 * max(flash, lit));
  circle(x, y, this.dot * (1 + 1.5 * flash + 0.5 * lit));
  if (flash > 0.05) {
    blendMode(ADD);
    let d = (10 + 34 * flash) * this.halo * this.size;
    image(haloSprites[this.species], x - d / 2, y - d / 2, d, d);
    blendMode(BLEND);
  }
};

// The cached still parts, placed so the creature's position is at
// the origin. The jelly breathes and the sea pen sways here (waves,
// week 4); the others just blit.
Body.prototype.drawStill = function (t, shadow) {
  if (this.plan === 2) {
    let b = sin(t * this.breathe + this.phase);
    push();
    shearX(0.1 * sin(t * this.breathe * 0.6 + this.phase)); // the tentacles trail behind the pulse
    this.blit("tentacles", -this.tox, -this.toy, undefined, undefined, shadow);
    pop();
    let sx = 1 + 0.07 * b; // the bell widens as it flattens
    let sy = 1 - 0.06 * b;
    this.blit("sprite", -this.ox * sx, -this.oy * sy, (this.sprite.width / this.sk) * sx, (this.sprite.height / this.sk) * sy, shadow);
  } else if (this.plan === 3) {
    // sway about the foot of the stalk. Left in place so the lights follow.
    let foot = this.box.y1 - 4;
    translate(0, foot);
    rotate(0.05 * sin(t * this.sway + this.phase));
    translate(0, -foot);
    this.blit("sprite", -this.ox, -this.oy, undefined, undefined, shadow);
  } else {
    this.blit("sprite", -this.ox, -this.oy, undefined, undefined, shadow);
  }
};

// The parts that move every frame and are flesh, not light: the
// fish and dragon tail, the squid's long arms and fins, the eel's
// whole body. Drawn in the shadow colour for a locked guide row.
Body.prototype.drawMoving = function (t, flash, shadow) {
  let b = shadow ? shadowCol : this.bodyCol;
  noStroke();
  if (this.plan === 1 || this.plan === 4) this.drawTail(t, flash, b);
  else if (this.plan === 5) this.drawSquidArms(t, flash, b, shadow);
  else if (this.plan === 6) this.drawEelBody(t, b, shadow);
};

// waves (week 4): the tail flicks with sin(), harder when struck.
Body.prototype.drawTail = function (t, flash, b) {
  let k = sin(t * this.flick + this.phase) * 0.4 * (1 + flash);
  let tl = this.tail;
  push();
  translate(-this.len / 2 + 1, 0);
  rotate(k);
  fill(b[0], b[1], b[2], 220);
  if (this.plan === 4) quad(0, 0, -tl, -tl * 0.5, -tl * 0.7, 0, -tl, tl * 0.5);
  else triangle(0, 0, -tl, -tl * 0.55, -tl, tl * 0.55);
  pop();
};

// waves (week 4): the two long arms trail and wave behind the squid,
// the fins at the mantle tip ripple. The firefly squid has lights
// down the arms, on every third point (modulo, week 3).
Body.prototype.drawSquidArms = function (t, flash, b, shadow) {
  let c = this.look.col;
  let steps = 7;
  let armX = -10;
  let sway = 0.2 + flash; // a struck squid thrashes
  stroke(b[0], b[1], b[2], 220);
  strokeWeight(1.3);
  noFill();
  for (let side = -1; side <= 1; side += 2) {
    beginShape();
    for (let i = 0; i <= steps; i++) {
      let u = i / steps;
      let y = side * (2 + u * u * this.mh * 0.45) + sin(t * 0.08 + this.phase + u * 4) * 4 * u * sway;
      curveVertex(armX - u * this.longArm, y);
      if (i === 0 || i === steps) curveVertex(armX - u * this.longArm, y);
    }
    endShape();
  }
  noStroke();
  if (this.tweak.armLights && !shadow) {
    blendMode(ADD);
    fill(c[0], c[1], c[2], 120 + 135 * flash);
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 1; i <= steps; i++) {
        if (i % 3 !== 0) continue;
        let u = i / steps;
        let y = side * (2 + u * u * this.mh * 0.45) + sin(t * 0.08 + this.phase + u * 4) * 4 * u * sway;
        circle(armX - u * this.longArm, y, 1.6 + flash);
      }
    }
    blendMode(BLEND);
  }
  // the fins: a pair of rhombs at the tip, rippling
  let r = 1 + 0.3 * sin(t * this.ripple + this.phase);
  let fx = this.ml * 0.55;
  let fw = this.ml * 0.42;
  let fh = this.mh * this.fin * 1.6 * r;
  fill(b[0], b[1], b[2], 170);
  triangle(fx, -this.mh * 0.2, fx + fw * 0.45, -this.mh * 0.3 - fh, fx + fw, -this.mh * 0.05);
  triangle(fx, this.mh * 0.2, fx + fw * 0.45, this.mh * 0.3 + fh, fx + fw, this.mh * 0.05);
};

// waves (week 4): where segment i of the eel is right now. A sine
// travels down the body, the head barely moves and the tail swings.
Body.prototype.eelY = function (i, t) {
  let u = i / this.segs;
  return this.amp * (0.1 + 0.9 * u) * sin(t * this.freq - u * TWO_PI * this.waves + this.phase);
};

// The eel's body as one tapered shape along the wave, and a fin
// along the back for the ribbon species.
Body.prototype.drawEelBody = function (t, b, shadow) {
  let n = this.segs;
  let segLen = this.len / n;
  let c = this.look.col;
  let ys = [];
  for (let i = 0; i <= n; i++) ys.push(this.eelY(i, t));

  if (this.tweak.fin) {
    if (shadow) fill(b[0], b[1], b[2], 120);
    else fill(c[0], c[1], c[2], 60);
    beginShape();
    for (let i = 1; i < n; i++) vertex(-i * segLen, ys[i] - this.thick * 0.5 - 3 - 2 * sin(i * 0.9 + t * 0.1));
    for (let i = n - 1; i >= 1; i--) vertex(-i * segLen, ys[i]);
    endShape(CLOSE);
  }

  fill(b[0], b[1], b[2]);
  beginShape();
  for (let i = 0; i <= n; i++) {
    let w = this.thick * 0.5 * pow(1 - i / n, 0.7) + 0.3;
    vertex(-i * segLen, ys[i] - w);
  }
  for (let i = n; i >= 0; i--) {
    let w = this.thick * 0.5 * pow(1 - i / n, 0.7) + 0.3;
    vertex(-i * segLen, ys[i] + w);
  }
  endShape(CLOSE);
};

// The glowing parts, added onto the water: the flash halo and the
// photophores of each plan.
Body.prototype.drawLights = function (flash, lit, t) {
  let c = this.look.col;
  noStroke();
  blendMode(ADD);
  if (flash > 0.05) {
    let d = planRadius[this.plan] * (3 + 4 * flash);
    image(haloSprites[this.species], -d / 2, this.haloY - d / 2, d, d);
  }
  if (this.plan === 1 || this.plan === 5) this.drawRowLights(c, flash, lit);
  else if (this.plan === 2) this.drawJellyLights(c, flash, lit, t);
  else if (this.plan === 3) this.drawSeaPenLights(c, flash, lit);
  else if (this.plan === 4) this.drawDragonLights(c, flash, lit, t);
  else this.drawEelLights(c, flash, lit, t);
  blendMode(BLEND);
};

// Photophores brighten with the flash and with the lure's light.
// A glass creature stays dark until something lights it.
Body.prototype.drawRowLights = function (c, flash, lit) {
  let base = this.tweak.glass ? 0.05 : 0.2;
  let b = base + (1 - base) * max(flash, lit);
  fill(c[0], c[1], c[2], 255 * b);
  let L = this.lights;
  for (let i = 0; i < L.length; i++) {
    circle(L[i].x, L[i].y, L[i].r * (1.4 + 1.2 * flash));
  }
};

// The alarm: a pulse of light runs round the ring of rim lights
// (waves, week 4, offset by each light's place k in the ring).
Body.prototype.drawJellyLights = function (c, flash, lit, t) {
  let sx = 1 + 0.07 * sin(t * this.breathe + this.phase); // follow the breathing bell
  let sy = 1 - 0.06 * sin(t * this.breathe + this.phase);
  let L = this.lights;
  for (let i = 0; i < L.length; i++) {
    let run = 0.5 + 0.5 * sin(t * 0.35 - L[i].k * TWO_PI * 2);
    let b = min(1, 0.15 + 0.5 * lit + flash * (0.4 + 0.8 * run));
    fill(c[0], c[1], c[2], 255 * b);
    circle(L[i].x * sx, L[i].y * sy, L[i].r * (1.4 + 1.5 * flash * run));
  }
};

// The light runs up the stem while the flash fades: struck at the
// base, it reaches the tip as flash gets small, lighting each polyp
// as it passes. The ember whip flares all at once instead.
Body.prototype.drawSeaPenLights = function (c, flash, lit) {
  let pos = 1 - flash;
  let f = sqrt(flash);
  let L = this.lights;
  for (let i = 0; i < L.length; i++) {
    let near = this.tweak.flare ? 1 : max(0, 1 - abs(L[i].k - pos) * 3);
    let b = min(1, 0.12 + 0.5 * lit + f * near);
    fill(c[0], c[1], c[2], 255 * b);
    circle(L[i].x, L[i].y, L[i].r * (1.4 + 2 * f * near));
  }
  if (flash > 0.03 && !this.tweak.flare) {
    let y = this.base - pos * this.stemH;
    fill(c[0], c[1], c[2], 220 * f);
    circle(0, y, 3 + 3 * f);
    let d = 8 + 24 * f;
    image(haloSprites[this.species], -d / 2, y - d / 2, d, d);
  }
};

// Belly lights, the lure flickering to tempt prey (waves, week 4),
// and the searchlight sweeping slowly ahead of the eye. The angler's
// lamp goes dark as the lure comes close, then flares when struck.
Body.prototype.drawDragonLights = function (c, flash, lit, t) {
  let b = 0.15 + 0.85 * max(flash, lit);
  let L = this.lights;
  for (let i = 0; i < L.length; i++) {
    let l = L[i];
    let a = b;
    if (l.lamp) a = 0.7 * (1 - lit) + flash;
    else if (l.lure) a = 0.35 + 0.35 * sin(t * 0.09 + this.phase + l.x) + 0.3 * flash;
    fill(c[0], c[1], c[2], 255 * min(1, a));
    circle(l.x, l.y, l.r * (1.4 + 1.2 * flash));
    if (l.lamp) {
      let d = 18 + 20 * a;
      image(haloSprites[this.species], l.x - d / 2, l.y - d / 2, d, d);
    }
  }
  if (this.beamStrength > 0) {
    let sweep = 0.12 * sin(t * 0.017 + this.phase);
    let glow = (0.1 + 0.55 * max(flash, lit * 0.7)) * this.beamStrength;
    push();
    translate(this.beamX, this.beamY);
    rotate(sweep);
    fill(c[0], c[1], c[2], 70 * glow);
    triangle(0, 0, this.beam, -this.beam * 0.24, this.beam, this.beam * 0.24);
    fill(c[0], c[1], c[2], 110 * glow);
    triangle(0, 0, this.beam * 0.8, -this.beam * 0.1, this.beam * 0.8, this.beam * 0.1);
    fill(c[0], c[1], c[2], 255 * min(1, 0.5 + glow));
    circle(0, 0, 2.6 + 2 * flash);
    pop();
  }
};

// The eel's lights sit on the moving segments, so they are placed
// from the same wave as the body. A pulse runs tailward when struck.
Body.prototype.drawEelLights = function (c, flash, lit, t) {
  let segLen = this.len / this.segs;
  let S = this.lightSegs;
  for (let i = 0; i < S.length; i++) {
    let k = S[i] / this.segs;
    let run = 0.5 + 0.5 * sin(t * 0.3 - k * 8);
    let b = min(1, 0.2 + 0.6 * lit + flash * (0.4 + 0.6 * run));
    fill(c[0], c[1], c[2], 255 * b);
    circle(-S[i] * segLen, this.eelY(S[i], t), 1.8 + 1.5 * flash);
  }
};
