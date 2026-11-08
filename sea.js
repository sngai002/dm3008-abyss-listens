/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * sea.js - the water, the surface above it, and the dive between them
 *
 * STREAM C owns this file. The piece opens above the water at night:
 * a boat, the horizon, the moon and stars, the line hanging ready.
 * When the user begins, the camera sinks through the surface into the
 * dark and stays there. The sky follows the real clock (tide.js) too.
 */

///////////////////////////////////////////////////////////////////
// Sea Object
// World coordinates: y = 0 is the water surface, the underwater
// scene is 0 to height, the sky is -height to 0. sketch.js draws
// the world with translate(0, -sea.cameraY), so cameraY is -height
// while above water and 0 once under.
//
// Interface used by sketch.js:
//   sea.state          "surface", "diving" or "under"
//   sea.cameraY        see above
//   sea.begin()        start the dive (the start button calls this)
//   sea.update()       once a frame
//   sea.renderSky()    sky, moon, boat (in world coords, above 0)
//   sea.renderWater()  water gradient, light shafts (in world coords)
//   sea.renderFog()    marine snow and depth haze, drawn over the creatures
///////////////////////////////////////////////////////////////////

function Sea() {
  this.state = "surface";
  this.cameraY = -height;
  this.diveStart = 0;
  this.diveTime = 3500; // *** ms for the camera to sink through the surface
}

Sea.prototype.begin = function () {
  if (this.state !== "surface") return;
  this.state = "diving";
  this.diveStart = millis();
};

Sea.prototype.update = function () {
  if (this.state === "diving") {
    let u = constrain((millis() - this.diveStart) / this.diveTime, 0, 1);
    u = u * u * (3 - 2 * u); // ease in and out
    this.cameraY = lerp(-height, 0, u);
    if (u >= 1) this.state = "under";
  }
};

// STUB: flat night sky and a line for the horizon. Stream C replaces.
Sea.prototype.renderSky = function () {
  push();
  noStroke();
  fill(5, 10, 30);
  rect(0, -height, width, height);
  stroke(120, 140, 170, 120);
  line(0, 0, width, 0);
  pop();
};

// STUB: a flat dark gradient. Stream C replaces.
Sea.prototype.renderWater = function () {
  push();
  noStroke();
  for (let y = 0; y < height; y += 8) {
    let t = y / height;
    fill(lerp(18, 1, t), lerp(62, 3, t), lerp(92, 9, t));
    rect(0, y, width, 8);
  }
  pop();
};

// STUB: nothing yet. Stream C adds marine snow and depth haze.
Sea.prototype.renderFog = function () {};

Sea.prototype.resize = function () {
  if (this.state === "surface") this.cameraY = -height;
};
