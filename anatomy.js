/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * anatomy.js - how each creature is grown and drawn
 *
 * STREAM A owns this file. Nothing in here moves: creature.js
 * decides where a creature is and how it behaves, then asks its
 * Body to draw itself there.
 *
 * Every creature is grown from one seed with the techniques from
 * class, so no two look the same but they all cost about the same:
 *   noise (wk 5)       body silhouette, radius around an ellipse wobbled by noise
 *   L-systems (wk 10)  tentacles and fronds, a rule set per family, angle varies per individual
 *   recursion (wk 9)   branching fins and lure antlers, seeded so they are stable
 *   waves (wk 4)       fins and bells move with sin() every frame
 *   modulo (wk 3)      which segments carry a light, stripe patterns
 * The still parts are drawn once into a small createGraphics()
 * sprite at birth, so each frame is one image() plus the glowing bits.
 *
 * Interface the rest of the sketch relies on:
 *   familyLook[f]                        name, latin, col, blurb (index shared with creature.js)
 *   new Body(family, seed)               grows one creature, seed is any number
 *   body.radius                          collision radius
 *   body.render(x, y, heading, flash, lit)
 *   body.renderIcon(x, y, size)          a still portrait for the field guide
 *
 * References
 *   Reading noise around a circle so an outline joins up without a
 *   seam: Daniel Shiffman, The Coding Train, "Polar Perlin Noise Loops".
 *   The plant rule F -> F[+F]F[-F]F and the bracket turtle:
 *   Prusinkiewicz and Lindenmayer, The Algorithmic Beauty of Plants (1990).
 */

///////////////////////////////////////////////////////////////////
// Families
// The index is the family id and is shared with creature.js,
// sound.js and ui.js, so add to the end, never reorder.
// This is the look only: colours and the field guide text.
// Behaviour values live in creature.js (familyBehaviour).
///////////////////////////////////////////////////////////////////

// *** change how each family looks and reads here
let familyLook = [
  // 0 - sea sparkle plankton. tiny, many. a chain reaction of light
  { name: "Sea sparkle", latin: "Lucerna minuta", col: [143, 220, 255], blurb: "Tiny drifting lights. Touch one and the glow spreads to its neighbours." },
  // 1 - lanternfish. schools. a row of lights along the belly
  { name: "Lanternfish", latin: "Diaphus errans", col: [95, 243, 216], blurb: "Schools that scatter from the line. Higher in the water, higher the note." },
  // 2 - alarm jelly. L-system tentacles, pulsing bell
  { name: "Alarm jelly", latin: "Campana tremula", col: [160, 150, 255], blurb: "Slow pulsing bells with a ring of lights. Deep, slow tones." },
  // 3 - sea pen colony. L-system fronds, drifts as one
  { name: "Sea pen", latin: "Penna abyssi", col: [255, 200, 120], blurb: "A colony that grows like a feather. Brush it and the light runs up the stem." },
  // 4 - stoplight dragon. rare, red, recursive antler lure. night only
  { name: "Stoplight dragon", latin: "Draco signalis", col: [255, 77, 94], blurb: "Rare red light that almost nothing else can see. Only rises at night." }
];

///////////////////////////////////////////////////////////////////
// Genes
// The ranges each family draws its genome from, and the L-system
// rule set for the two families that grow one. Same index as
// familyLook. Angles are in degrees, lengths in pixels.
///////////////////////////////////////////////////////////////////

// *** the seed picks one value inside each range, widen a range for more variety
let familyGenes = [
  // 0 - sea sparkle: only a size and a twinkle speed, hundreds share one halo sprite
  { size: [2, 3.6], twinkle: [0.04, 0.12] },
  // 1 - lanternfish: streamlined, a light on every 1st or 2nd belly segment
  { length: [22, 30], height: [0.3, 0.42], wobble: [0.08, 0.2], segments: 8, lightEvery: [1, 2], stripeEvery: [2, 3], eye: [2.2, 3.2], tail: [5, 8], flick: [0.25, 0.4] },
  // 2 - alarm jelly: a dome with tentacles grown from the plant rule
  { bell: [44, 62], dome: [0.55, 0.8], wobble: [0.05, 0.14], scallops: [6, 10], tentacles: [4, 8], rimLights: [8, 14], length: [60, 115], angle: [6, 22], gens: [2, 3], breathe: [0.03, 0.06],
    lsystem: { axiom: "F", rules: { F: "F[+F]F[-F]F" } } },
  // 3 - sea pen: each generation adds two stem steps (G) and a pair of pinnae,
  //     and every pinna already there grows one step before its polyp light (L)
  { stem: [58, 78], stalk: [16, 26], gens: [3, 4], angle: [35, 65], step: [5, 8], weight: [2, 3.2], sway: [0.02, 0.04],
    lsystem: { axiom: "A", rules: { A: "G[+FL][-FL]G[+FL][-FL]A", L: "FL" } } },
  // 4 - stoplight dragon: long and dark, an antler lure and a red beam
  { length: [100, 130], height: [0.13, 0.18], wobble: [0.06, 0.14], segments: 14, lightEvery: [2, 3], antlerDepth: [3, 4], antlerAngle: [20, 40], antlerLen: [9, 13], rayDepth: [2, 3], beam: [70, 100], flick: [0.12, 0.2] }
];

///////////////////////////////////////////////////////////////////
// Shared sprites
// One soft halo per family, made the first time a Body is born.
// Drawn with blendMode(ADD) its size alone sets how bright it reads,
// so no tint() is needed (tint() repaints the pixels and is slow).
///////////////////////////////////////////////////////////////////

let haloSprites = [];
let bodiesBorn = 0;
let worldNoiseSeed = 2026; // *** the noise seed the rest of the sketch gets back after a birth

function ensureSharedSprites() {
  if (haloSprites.length > 0) return;
  for (let f = 0; f < familyLook.length; f++) {
    let c = familyLook[f].col;
    let g = createGraphics(64, 64);
    g.noStroke();
    // concentric discs that fade out: a cheap radial gradient
    for (let i = 12; i > 0; i--) {
      let u = i / 12;
      g.fill(c[0], c[1], c[2], 3 + 20 * (1 - u) * (1 - u));
      g.circle(32, 32, 64 * u);
    }
    haloSprites.push(g);
  }
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

function Body(family, seed) {
  this.family = family;
  this.seed = seed;
  this.look = familyLook[family];
  this.genes = familyGenes[family];

  // the collision radius, creature.js and the line read this
  this.radius = [3, 7, 30, 40, 20][family];

  this.sprite = null; // the still parts, drawn once at birth
  this.tentacles = null; // the jelly's hanging part, it sways on its own
  this.ox = 0; // where the creature's position sits inside the sprite
  this.oy = 0;
  this.tox = 0; // same for the tentacle sprite
  this.toy = 0;
  this.lights = []; // photophores in body coordinates: {x, y, r, k}, k is 0..1 along the body
  this.box = { x0: -4, y0: -4, x1: 4, y1: 4 }; // how much room the whole drawing takes, for the icon
  this.haloY = 0; // where the flash halo is centred

  // from here on every random() and noise() comes from the seed,
  // so the same seed always grows the same body
  randomSeed(seed);
  noiseSeed(seed);
  ensureSharedSprites();
  this.phase = random(TWO_PI); // so a school's fins are not all in step
  this.bodyCol = mixColour(this.look.col, [10, 16, 32], 0.7); // dull flesh, the glow is the pure colour

  if (family === 0) this.growSparkle();
  else if (family === 1) this.growLanternfish();
  else if (family === 2) this.growJelly();
  else if (family === 3) this.growSeaPen();
  else this.growDragon();

  releaseSeeds();
}

///////////////////////////////////////////////////////////////////
// Growing
// One grow function per family. Each reads its ranges from
// familyGenes, draws the still parts into this.sprite and fills
// this.lights with where the photophores are.
///////////////////////////////////////////////////////////////////

// 0 - sea sparkle. Hundreds on screen, so no sprite of its own:
// a dot drawn live, and the shared halo only while it flashes.
Body.prototype.growSparkle = function () {
  this.size = pickGene(this.genes.size);
  this.twinkle = pickGene(this.genes.twinkle);
};

// 1 - lanternfish. A small countershaded body, a big eye and a row
// of lights along the belly. The sprite is about 32 px wide.
Body.prototype.growLanternfish = function () {
  let g = this.genes;
  let c = this.look.col;
  let len = pickGene(g.length);
  let h = len * pickGene(g.height);
  let n = g.segments;
  let lightEvery = pickGeneInt(g.lightEvery);
  let stripeEvery = pickGeneInt(g.stripeEvery);
  this.len = len;
  this.tail = pickGene(g.tail);
  this.flick = pickGene(g.flick);

  // noise (week 5): the silhouette
  let pts = this.outline(len / 2, h / 2, pickGene(g.wobble), 36);

  this.ox = len / 2 + 2;
  this.oy = h / 2 + 2;
  this.sprite = makeSprite(len + 4, h + 4);
  let s = this.sprite;
  s.translate(this.ox, this.oy);
  s.fill(this.bodyCol[0], this.bodyCol[1], this.bodyCol[2]);
  fillPolygon(s, pts);

  // modulo (week 3): every stripeEvery-th segment is a shade paler
  let pale = mixColour(c, [220, 235, 240], 0.5);
  let segW = len / n;
  for (let i = 1; i < n - 1; i++) {
    if (i % stripeEvery !== 0) continue;
    s.fill(pale[0], pale[1], pale[2], 45);
    fillPolygon(s, outlineStrip(pts, -len / 2 + i * segW, -len / 2 + (i + 1) * segW));
  }

  // a silver belly, dark back: countershading like a real fish
  s.fill(220, 235, 240, 60);
  s.ellipse(0, h * 0.12, len * 0.6, h * 0.4);

  // lanternfish have big eyes, set near the nose
  let eye = pickGene(g.eye);
  s.fill(225, 238, 242);
  s.circle(len * 0.3, -h * 0.08, eye);
  s.fill(4, 8, 16);
  s.circle(len * 0.31, -h * 0.08, eye * 0.55);

  // modulo (week 3) again: a photophore on every lightEvery-th belly segment
  for (let i = 1; i < n - 1; i++) {
    if (i % lightEvery !== 0) continue;
    let x = -len / 2 + (i + 0.5) * segW;
    let sl = sliceOutline(pts, x);
    this.lights.push({ x: x, y: sl.bottom - 1.2, r: 1.3, k: i / n });
  }
  this.bakeLights(s, 90);
  this.box = { x0: -this.ox - this.tail, y0: -this.oy, x1: len + 4 - this.ox, y1: h + 4 - this.oy };
};

// 2 - alarm jelly. A translucent dome with a scalloped rim, a ring
// of lights round the edge and L-system tentacles hanging below.
// Two sprites: the bell (breathes) and the tentacles (sway).
Body.prototype.growJelly = function () {
  let g = this.genes;
  let c = this.look.col;
  let bw = pickGene(g.bell);
  let bh = bw * pickGene(g.dome);
  let scallops = pickGeneInt(g.scallops);
  let nT = pickGeneInt(g.tentacles);
  let nL = pickGeneInt(g.rimLights);
  let angle = radians(pickGene(g.angle));
  let gens = pickGeneInt(g.gens);
  let tLen = pickGene(g.length);
  this.breathe = pickGene(g.breathe);
  this.haloY = -bh * 0.4;

  // noise (week 5): the top half of a wobbled ellipse is the dome.
  // The rim comes back along y = 0 with a sine scallop (waves, week 4).
  let pts = this.outline(bw / 2, bh, pickGene(g.wobble), 48);
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
  this.sprite = makeSprite(bw + 8, sh);
  let s = this.sprite;
  s.translate(this.ox, this.oy);

  // the bell is see-through, so a soft fill with a brighter edge
  s.fill(c[0], c[1], c[2], 55);
  s.stroke(c[0], c[1], c[2], 150);
  s.strokeWeight(1.2);
  fillPolygon(s, dome);

  // modulo (week 3): a radial canal runs down to every other scallop
  s.strokeWeight(0.8);
  s.stroke(c[0], c[1], c[2], 60);
  for (let k = 0; k <= scallops; k++) {
    if (k % 2 !== 0) continue;
    s.line(0, -bh * 0.85, lerp(pts[0].x, pts[half].x, k / scallops), 0);
  }

  // the stomach, a smaller dome inside
  s.noStroke();
  s.fill(c[0], c[1], c[2], 90);
  s.push();
  s.translate(0, -bh * 0.22);
  s.scale(0.45, 0.4);
  fillPolygon(s, dome);
  s.pop();

  // the ring of lights round the rim, every other one bigger (modulo, week 3)
  for (let i = 0; i < nL; i++) {
    let u = (i + 0.5) / nL;
    this.lights.push({ x: lerp(-bw * 0.46, bw * 0.46, u), y: 1.5, r: i % 2 === 0 ? 1.9 : 1.2, k: i / nL });
  }
  this.bakeLights(s, 110);

  // L-system (week 10): the tentacles. The trunk of F[+F]F[-F]F has
  // 3^gens steps, so the step length sets how far they hang.
  let rule = growLsystem(g.lsystem.axiom, g.lsystem.rules, gens);
  let step = tLen / pow(3, gens);
  let segs = [];
  let box = { x0: 0, y0: 0, x1: 0, y1: 0 };
  for (let t = 0; t < nT; t++) {
    let u = (t + 0.5) / nT;
    let x = lerp(-bw * 0.42, bw * 0.42, u);
    let heading = HALF_PI + (u - 0.5) * 0.5 + random(-0.1, 0.1); // hang down, the outer ones splay
    let walk = walkTurtle(rule, x, 2, heading, step, step, angle * random(0.85, 1.15));
    for (let i = 0; i < walk.segs.length; i++) segs.push(walk.segs[i]);
    box = unionBox(box, walk.box);
  }
  this.tox = -box.x0 + 3;
  this.toy = -box.y0 + 3;
  this.tentacles = makeSprite(box.x1 - box.x0 + 6, box.y1 - box.y0 + 6);
  this.tentacles.translate(this.tox, this.toy);
  drawSegments(this.tentacles, segs, c, 1.6, 170);

  this.box = unionBox({ x0: -this.ox, y0: -this.oy, x1: bw + 8 - this.ox, y1: sh - this.oy }, box);
};

// 3 - sea pen. An L-system feather on a stalk, standing upright.
Body.prototype.growSeaPen = function () {
  let g = this.genes;
  let c = this.look.col;
  let stemH = pickGene(g.stem);
  let stalk = pickGene(g.stalk);
  let gens = pickGeneInt(g.gens);
  let angle = radians(pickGene(g.angle));
  let step = pickGene(g.step);
  let weight = pickGene(g.weight);
  this.sway = pickGene(g.sway);
  this.stemH = stemH;
  this.base = (stemH - stalk) / 2; // the stem starts here so the whole colony is centred on the position
  this.haloY = this.base - stemH * 0.5;

  // L-system (week 10): the rule in familyGenes[3]. Each generation
  // adds two stem steps and a pair of pinnae, and every pinna that
  // already exists grows one step, so the lowest ones are longest.
  let rule = growLsystem(g.lsystem.axiom, g.lsystem.rules, gens);
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
  this.sprite = makeSprite(box.x1 - box.x0 + 8, box.y1 - box.y0 + 8);
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

// 4 - stoplight dragon. A long dark body, a red searchlight under
// the eye, a recursive antler lure on the chin and fin rays.
Body.prototype.growDragon = function () {
  let g = this.genes;
  let c = this.look.col;
  let len = pickGene(g.length);
  let h = len * pickGene(g.height);
  let n = g.segments;
  let lightEvery = pickGeneInt(g.lightEvery);
  let depth = pickGeneInt(g.antlerDepth);
  let spread = radians(pickGene(g.antlerAngle));
  let aLen = pickGene(g.antlerLen);
  let rayDepth = pickGeneInt(g.rayDepth);
  this.len = len;
  this.tail = h * 0.9;
  this.beam = pickGene(g.beam);
  this.flick = pickGene(g.flick);
  this.bodyCol = mixColour(c, [8, 6, 14], 0.88); // nearly black, so it is the lights you see

  // noise (week 5): the silhouette, long and thin
  let pts = this.outline(len / 2, h / 2, pickGene(g.wobble), 48);

  let sh = h + 72;
  this.ox = len / 2 + 6;
  this.oy = h / 2 + 18;
  this.sprite = makeSprite(len + 12, sh);
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

  // the head: a pale eye, the jaw with a few fangs, and the
  // searchlight photophore just under the eye
  let eyeX = len * 0.36;
  let eyeY = -h * 0.1;
  s.fill(225, 225, 235);
  s.circle(eyeX, eyeY, h * 0.34);
  s.fill(4, 4, 10);
  s.circle(eyeX + h * 0.04, eyeY, h * 0.2);
  s.stroke(c[0], c[1], c[2], 110);
  s.strokeWeight(0.8);
  s.line(len / 2 - 1, h * 0.08, len * 0.22, h * 0.3);
  for (let i = 0; i < 4; i++) {
    let fx = len * 0.46 - i * 4;
    s.line(fx, h * 0.1 + i * 2, fx - 1, h * 0.1 + i * 2 - 3.5);
  }
  this.beamX = eyeX + h * 0.1;
  this.beamY = eyeY + h * 0.32;

  // recursion (week 9): the chin barbel ends in an antler, a light on every tip
  let chinX = len * 0.26;
  let chinY = sliceOutline(pts, chinX).bottom;
  s.stroke(c[0], c[1], c[2], 140);
  s.line(chinX, chinY, chinX - 2, chinY + 10);
  let tips = [];
  this.branch(s, chinX - 2, chinY + 10, HALF_PI + 0.15, aLen, depth, spread, tips);
  for (let i = 0; i < tips.length; i++) {
    this.lights.push({ x: tips[i].x, y: tips[i].y, r: 1.1, k: 1, lure: true });
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
  let off = (this.seed % 1000) * 0.37;
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
  if (depth === 0) {
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

// A fresh transparent sprite to draw still parts into.
function makeSprite(w, h) {
  let g = createGraphics(ceil(w), ceil(h));
  g.noStroke();
  return g;
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
//   heading  direction of travel in radians (0 = facing right)
//   flash    0 to 1, how recently the line struck it
//   lit      0 to 1, how close the lure is (ambient light from it)
Body.prototype.render = function (x, y, heading, flash, lit) {
  if (this.family === 0) {
    this.drawSparkle(x, y, flash, lit, frameCount);
    return;
  }
  push();
  translate(x, y);
  if (this.family === 1 || this.family === 4) {
    rotate(heading);
    if (cos(heading) < 0) scale(1, -1); // swimming left: flip so the belly stays down
  } else {
    rotate(cos(heading) * 0.1); // drifting things only lean into their motion a little
  }
  this.drawStill(frameCount);
  this.drawLive(flash, lit, frameCount);
  pop();
};

// A still portrait for the field guide, fitted inside size pixels.
Body.prototype.renderIcon = function (x, y, size) {
  let c = this.look.col;
  push();
  translate(x, y);
  if (this.family === 0) {
    noStroke();
    blendMode(ADD);
    image(haloSprites[0], -size / 2, -size / 2, size, size);
    blendMode(BLEND);
    fill(c[0], c[1], c[2], 230);
    circle(0, 0, size * 0.3);
  } else {
    let b = this.box;
    let k = size / max(b.x1 - b.x0, b.y1 - b.y0);
    scale(k);
    translate(-(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2);
    this.drawStill(0);
    this.drawLive(0.45, 1, 0);
  }
  pop();
};

// 0 - sea sparkle, the cheap path: no push(), no rotate(), one
// circle, and the shared halo only while it flashes.
Body.prototype.drawSparkle = function (x, y, flash, lit, t) {
  let c = this.look.col;
  // waves (week 4): a slow twinkle on its own phase
  let tw = 0.5 + 0.5 * sin(t * this.twinkle + this.phase);
  noStroke();
  fill(c[0], c[1], c[2], 80 + 100 * tw + 75 * max(flash, lit));
  circle(x, y, this.size * (1 + 1.5 * flash + 0.5 * lit));
  if (flash > 0.05) {
    blendMode(ADD);
    let d = 10 + 34 * flash;
    image(haloSprites[0], x - d / 2, y - d / 2, d, d);
    blendMode(BLEND);
  }
};

// The cached still parts, placed so the creature's position is at
// the origin. The jelly breathes and the sea pen sways here (waves,
// week 4); the fish just blit.
Body.prototype.drawStill = function (t) {
  if (this.family === 2) {
    let b = sin(t * this.breathe + this.phase);
    push();
    shearX(0.1 * sin(t * this.breathe * 0.6 + this.phase)); // the tentacles trail behind the pulse
    image(this.tentacles, -this.tox, -this.toy);
    pop();
    let sx = 1 + 0.07 * b; // the bell widens as it flattens
    let sy = 1 - 0.06 * b;
    image(this.sprite, -this.ox * sx, -this.oy * sy, this.sprite.width * sx, this.sprite.height * sy);
  } else if (this.family === 3) {
    // sway about the foot of the stalk. Left in place so the lights follow.
    let foot = this.box.y1 - 4;
    translate(0, foot);
    rotate(0.05 * sin(t * this.sway + this.phase));
    translate(0, -foot);
    image(this.sprite, -this.ox, -this.oy);
  } else {
    image(this.sprite, -this.ox, -this.oy);
  }
};

// The parts that change every frame: the tail, the halo, the lights.
Body.prototype.drawLive = function (flash, lit, t) {
  let c = this.look.col;
  noStroke();
  if (this.family === 1 || this.family === 4) this.drawTail(t, flash);

  blendMode(ADD);
  if (flash > 0.05) {
    let d = this.radius * (3 + 4 * flash);
    image(haloSprites[this.family], -d / 2, this.haloY - d / 2, d, d);
  }
  if (this.family === 1) this.drawFishLights(c, flash, lit);
  else if (this.family === 2) this.drawJellyLights(c, flash, lit, t);
  else if (this.family === 3) this.drawSeaPenLights(c, flash, lit);
  else this.drawDragonLights(c, flash, lit, t);
  blendMode(BLEND);
};

// waves (week 4): the tail flicks with sin(), harder when struck.
// Drawn behind the body in the flesh colour, before the glows.
Body.prototype.drawTail = function (t, flash) {
  let k = sin(t * this.flick + this.phase) * 0.4 * (1 + flash);
  let b = this.bodyCol;
  let tl = this.tail;
  push();
  translate(-this.len / 2 + 1, 0);
  rotate(k);
  fill(b[0], b[1], b[2], 220);
  if (this.family === 4) quad(0, 0, -tl, -tl * 0.5, -tl * 0.7, 0, -tl, tl * 0.5);
  else triangle(0, 0, -tl, -tl * 0.55, -tl, tl * 0.55);
  pop();
};

// Photophores brighten with the flash and with the lure's light.
Body.prototype.drawFishLights = function (c, flash, lit) {
  let b = 0.2 + 0.8 * max(flash, lit);
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
  let L = this.lights;
  for (let i = 0; i < L.length; i++) {
    let run = 0.5 + 0.5 * sin(t * 0.35 - L[i].k * TWO_PI * 2);
    let b = min(1, 0.15 + 0.5 * lit + flash * (0.4 + 0.8 * run));
    fill(c[0], c[1], c[2], 255 * b);
    circle(L[i].x * sx, L[i].y, L[i].r * (1.4 + 1.5 * flash * run));
  }
};

// The light runs up the stem while the flash fades: struck at the
// base, it reaches the tip as flash gets small, lighting each polyp
// as it passes.
Body.prototype.drawSeaPenLights = function (c, flash, lit) {
  let pos = 1 - flash;
  let f = sqrt(flash);
  let L = this.lights;
  for (let i = 0; i < L.length; i++) {
    let near = max(0, 1 - abs(L[i].k - pos) * 3);
    let b = min(1, 0.12 + 0.5 * lit + f * near);
    fill(c[0], c[1], c[2], 255 * b);
    circle(L[i].x, L[i].y, L[i].r * (1.4 + 2 * f * near));
  }
  if (flash > 0.03) {
    let y = this.base - pos * this.stemH;
    fill(c[0], c[1], c[2], 220 * f);
    circle(0, y, 3 + 3 * f);
    let d = 8 + 24 * f;
    image(haloSprites[3], -d / 2, y - d / 2, d, d);
  }
};

// Belly lights, the lure flickering to tempt prey (waves, week 4),
// and the red searchlight sweeping slowly ahead of the eye.
Body.prototype.drawDragonLights = function (c, flash, lit, t) {
  let b = 0.15 + 0.85 * max(flash, lit);
  let L = this.lights;
  for (let i = 0; i < L.length; i++) {
    let l = L[i];
    let a = l.lure ? 0.35 + 0.35 * sin(t * 0.09 + this.phase + l.x) + 0.3 * flash : b;
    fill(c[0], c[1], c[2], 255 * min(1, a));
    circle(l.x, l.y, l.r * (1.4 + 1.2 * flash));
  }
  let sweep = 0.12 * sin(t * 0.017 + this.phase);
  let glow = 0.1 + 0.55 * max(flash, lit * 0.7);
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
};
