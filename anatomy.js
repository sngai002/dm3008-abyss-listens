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
// Body Object
// One per creature. Grows a genome from the seed and caches the
// still parts of the drawing. render() draws it at a position.
//
// STUB: the placeholder below draws a circle so the sketch runs.
// Stream A replaces everything from here down.
///////////////////////////////////////////////////////////////////

function Body(family, seed) {
  this.family = family;
  this.seed = seed;
  this.look = familyLook[family];

  // the collision radius, creature.js and the line read this
  this.radius = [3, 7, 30, 40, 20][family];
}

// Draws the creature.
//   x, y     position
//   heading  direction of travel in radians (0 = facing right)
//   flash    0 to 1, how recently the line struck it
//   lit      0 to 1, how close the lure is (ambient light from it)
Body.prototype.render = function (x, y, heading, flash, lit) {
  let c = this.look.col;
  push();
  translate(x, y);
  rotate(heading);
  noStroke();
  if (flash > 0.02) {
    fill(c[0], c[1], c[2], 80 * flash);
    circle(0, 0, this.radius * 4 * flash + this.radius * 2);
  }
  fill(c[0], c[1], c[2], 90 + 120 * max(flash, lit));
  ellipse(0, 0, this.radius * 2, this.radius * 1.2);
  pop();
};
