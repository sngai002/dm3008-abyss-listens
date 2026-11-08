/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * sea.js - the water, the surface above it, and the dive between them
 *
 * STREAM C owns this file. The piece opens above the water: a boat,
 * the sky, the sun or the moon, the line hanging ready. When the user
 * begins, the camera sinks through the surface into the dark and
 * stays there. The sky follows the real clock (tide.js) too.
 *
 * Techniques from class:
 *   waves (wk 4)        the surface is a sum of sines
 *   noise (wk 5)        marine snow drifts on a noise field
 *   living forest (wk 9) one celestial body on a sine arc, sun by day,
 *                       moon by night, crescent carved with a sky disc
 */

///////////////////////////////////////////////////////////////////
// Sea Object
// World coordinates: y = 0 is the water surface, the underwater
// scene is 0 to height, the sky is above 0. sketch.js draws the
// world inside push() after sea.applyCamera().
//
// The camera is a focus point and a zoom. The focus F is the
// waterline under the boat, (fline.anchorX, 0) in the world. S is
// where F lands on the screen:
//   screen = S + zoom * (world - F)
// At rest above water zoom is 1.6 and S is (width / 2, 0.8 * height),
// so the boat sits centred with the waterline four fifths of the way
// down and the view is pulled in close. Under water zoom is 1 and S
// is (anchorX, 0), which makes the transform the identity. The dive
// eases between the two, so the view widens to the whole sea as the
// camera arrives. cameraY is the world y at the top of the screen
// (-S.y / zoom), kept for the debug readout.
//
// Interface used by sketch.js and line.js:
//   sea.state          "surface", "diving", "under" or "rising"
//   sea.cameraY        world y at the top edge of the screen, 0 when under
//   sea.zoom           1.6 on the surface, 1 under
//   sea.begin()        start the dive (the start button calls this)
//   sea.surface()      come back up to the boat
//   sea.update()       once a frame
//   sea.applyCamera()  the world transform, call inside push()
//   sea.toWorld(sx, sy) screen to world, the inverse of applyCamera
//   sea.renderSky()    sky gradient, stars, sun or moon (world coords, above 0)
//   sea.renderWater()  water gradient, surface, boat, light shafts
//   sea.renderFog()    marine snow, bubbles and depth haze, over the creatures
//   sea.resize()       rebuild the cached gradients
///////////////////////////////////////////////////////////////////

function Sea() {
  this.state = "surface";
  this.restY = 0.8; // *** where the waterline sits on the start screen, as a fraction of the height
  this.zoomSurface = 1.6; // *** how close the start screen is. 1 = no zoom
  this.diveTime = 3500; // *** ms for the camera to sink through the surface (and to rise)
  this.moveStart = 0; // ms when the current dive or rise began
  this.u = 0; // camera blend, 0 at rest on the surface, 1 settled under water

  // camera state, set by placeCamera() every frame
  this.zoom = this.zoomSurface;
  this.fx = width / 2; // focus in the world: the waterline under the boat
  this.fy = 0;
  this.sx = width / 2; // where the focus lands on the screen
  this.sy = height * this.restY;
  this.cameraY = 0;
  this.view = { x0: 0, y0: 0, x1: width, y1: height }; // the world rectangle on screen
  this.skyH = max(1, (height * this.restY) / this.zoomSurface); // world height of sky visible at rest

  this.waveAmp = 8; // *** a little more than the tallest wave, see surfaceY()
  // one cached row per 3 px, the image stretch smooths it. never 0 rows:
  // some embeds give the canvas no size until the first resize, and a
  // 0 px graphics makes image() throw
  this.rows = max(1, ceil(height / 3));
  this.cacheMig = -1; // the migration value the caches were painted with
  this.skyG = null;
  this.waterG = null;
  this.hazeG = null;

  this.stars = [];
  this.snow = [];
  this.bubbles = [];
  this.makeStars();
  this.makeSnow();
  this.paintCaches();
  this.placeCamera();
}

Sea.prototype.begin = function () {
  if (this.state !== "surface") return;
  this.state = "diving";
  this.moveStart = millis();
  this.makeBubbles();
};

// The dive in reverse: back up to the boat, ready to begin() again.
Sea.prototype.surface = function () {
  if (this.state !== "under") return;
  this.state = "rising";
  this.moveStart = millis();
  this.makeBubbles();
};

Sea.prototype.update = function () {
  if (this.state === "diving" || this.state === "rising") {
    let raw = constrain((millis() - this.moveStart) / this.diveTime, 0, 1);
    let e = raw * raw * (3 - 2 * raw); // ease in and out
    this.u = this.state === "diving" ? e : 1 - e;
    if (raw >= 1) this.state = this.state === "diving" ? "under" : "surface";
  }
  this.placeCamera();

  // the gradients follow the clock, but slowly, so repaint them rarely.
  // the extra test keeps the "n" key from stepping visibly
  if (frameCount % 20 === 0 || abs(tide.migration - this.cacheMig) > 0.02) {
    this.paintCaches();
  }

  this.moveSnow();
  this.moveBubbles();
};

///////////////////////////////////////////////////////////////////
// Camera
// screen = S + zoom * (world - F). F is the waterline under the boat,
// S slides from the start screen's spot to F itself as u goes 0 to 1,
// and the zoom eases from zoomSurface to 1, so under water the
// transform is the identity and world coordinates are screen ones.
///////////////////////////////////////////////////////////////////

Sea.prototype.placeCamera = function () {
  let u = this.u;
  // the sea is built before the line only if someone reorders setup(), so be safe
  let ax = typeof fline !== "undefined" ? fline.anchorX : width / 2;
  this.zoom = lerp(this.zoomSurface, 1, u);
  this.fx = ax;
  this.fy = 0;
  this.sx = lerp(width / 2, ax, u);
  this.sy = lerp(height * this.restY, 0, u);

  // the world rectangle that fills the screen, for culling and backgrounds
  let v = this.view;
  v.x0 = this.fx - this.sx / this.zoom;
  v.y0 = this.fy - this.sy / this.zoom;
  v.x1 = this.fx + (width - this.sx) / this.zoom;
  v.y1 = this.fy + (height - this.sy) / this.zoom;
  this.cameraY = v.y0;
};

// The world transform. sketch.js calls this inside push().
Sea.prototype.applyCamera = function () {
  translate(this.sx, this.sy);
  scale(this.zoom);
  translate(-this.fx, -this.fy);
};

// Screen to world, the exact inverse of applyCamera. The lure target
// from the mouse or a hand goes through this.
Sea.prototype.toWorld = function (sx, sy) {
  return {
    x: this.fx + (sx - this.sx) / this.zoom,
    y: this.fy + (sy - this.sy) / this.zoom
  };
};

///////////////////////////////////////////////////////////////////
// Clock
// Everything that reads the time of day. night is tide.migration
// (eased, and 1 when night is forced), so colours never jump. The
// sun's height comes straight from tide.hour.
///////////////////////////////////////////////////////////////////

// Blend two [r, g, b] arrays. Arrays are cheaper than p5 colors here
// because this runs hundreds of times per repaint.
Sea.prototype.mix = function (a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
};

// How much the sun is near the horizon: 1 at sunrise and sunset, 0
// at noon and midnight. Drives the warm band in the sky.
Sea.prototype.dusk = function () {
  let e = -cos((tide.hour / 24) * TWO_PI); // sun height, 1 noon, -1 midnight
  let d = max(0, 1 - abs(e) / 0.3); // *** 0.3 = how long dusk lasts, as a fraction of the arc
  return d * d * (3 - 2 * d);
};

// Sky colour at t, 0 at the top of the visible sky (-skyH), 1 at the water.
Sea.prototype.skyColor = function (t) {
  let night = tide.migration;
  let top = this.mix([64, 126, 198], [3, 6, 18], night); // *** day and night sky, top
  let low = this.mix([168, 204, 228], [18, 30, 58], night); // *** day and night sky, horizon
  let c = this.mix(top, low, t * t);
  // the warm glow of dusk sits low and only when the sun is near the horizon
  let w = this.dusk() * t * t * 0.85;
  return this.mix(c, [236, 140, 84], w);
};

// Water colour at t, 0 at the surface, 1 at the bottom of the screen.
// Light falls off exponentially with depth, so the curve does too.
Sea.prototype.waterColor = function (t) {
  let night = tide.migration;
  let top = this.mix([16, 86, 134], [5, 18, 40], night); // *** day and night water, surface
  let low = this.mix([2, 10, 24], [1, 2, 6], night); // *** day and night water, bottom
  let k = (1 - exp(-2.4 * t)) / (1 - exp(-2.4));
  return this.mix(top, low, k);
};

// A tiny seeded random for the stars, so they never move or flicker
// and so we do not disturb p5's random() for the creatures.
// The sin-fract hash from shader folklore (The Book of Shaders,
// Patricio Gonzalez Vivo).
Sea.prototype.hash = function (n) {
  let v = sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - floor(v);
};

// Phase of the real moon, 0 new, 0.5 full, from the date.
// Reference new moon 6 Jan 2000 18:14 UTC, synodic month 29.530588
// days (Meeus, Astronomical Algorithms).
Sea.prototype.moonPhase = function () {
  let days = Date.now() / 86400000 - 10962.76;
  let p = (days / 29.530588) % 1;
  return p < 0 ? p + 1 : p;
};

///////////////////////////////////////////////////////////////////
// Sky
// A cached gradient, seeded stars that fade in with the migration,
// and one celestial body: the sun by day that becomes the moon by
// night, arcing on a sine path from the hour.
///////////////////////////////////////////////////////////////////

Sea.prototype.makeStars = function () {
  this.stars = [];
  let n = 420; // *** how many stars over the whole sky. about a third are on screen at a time
  for (let i = 0; i < n; i++) {
    this.stars.push({
      fx: this.hash(i * 3 + 1),
      fy: pow(this.hash(i * 3 + 2), 0.7), // crowd the top of the sky a little
      size: 0.8 + this.hash(i * 3 + 3) * 1.4,
      ph: this.hash(i * 7 + 5) * TWO_PI
    });
  }
};

Sea.prototype.renderSky = function () {
  let v = this.view;
  if (v.y0 >= 0) return; // no sky on screen once we are under

  push();
  noStroke();
  // the gradient covers the sky visible at rest, and the top colour
  // fills anything above it (only seen if the zoom is tweaked down)
  let top = this.skyColor(0);
  fill(top[0], top[1], top[2]);
  rect(v.x0, v.y0 - 10, v.x1 - v.x0, -this.skyH - v.y0 + 10);
  image(this.skyG, v.x0, -this.skyH, v.x1 - v.x0, this.skyH);
  this.renderStars();
  this.renderBody();
  pop();
};

Sea.prototype.renderStars = function () {
  let night = tide.migration;
  if (night < 0.04) return;
  let a = 230 * night * night; // stars arrive late in the dusk
  let t = frameCount * 0.02;
  let v = this.view;
  // the sky is wide enough for the boat to drift to either edge
  let span = 1 + 1 / this.zoomSurface;
  strokeCap(ROUND);
  for (let i = 0; i < this.stars.length; i++) {
    let s = this.stars[i];
    let x = (s.fx * span - (span - 1) / 2) * width;
    let y = -this.skyH * s.fy;
    if (x < v.x0 || x > v.x1 || y < v.y0) continue; // off screen
    let tw = 0.8 + 0.2 * sin(t + s.ph); // very slow breathing, not a flicker
    stroke(220, 228, 255, a * tw * pow(s.fy, 0.5)); // dimmer near the horizon
    strokeWeight(s.size);
    point(x, y);
  }
};

// Where the sun or moon is right now, in world coords. Shared with
// the reflection. p is 0 as it rises, 1 as it sets. The day arc runs
// 6 to 18, the night arc 18 to 6, and the jump between them happens
// below the horizon where nobody sees it. The arc spans the current
// view: something that far away does not shift when the boat drifts.
Sea.prototype.bodyPos = function () {
  let p = (((tide.hour - 6) % 12) + 12) % 12 / 12;
  let v = this.view;
  let x = lerp(v.x0 + (v.x1 - v.x0) * 0.1, v.x1 - (v.x1 - v.x0) * 0.1, p);
  let y = 14 - this.skyH * 0.8 * sin(p * PI); // *** 0.8 = how high the arc climbs
  return { x: x, y: y, p: p };
};

Sea.prototype.renderBody = function () {
  let night = tide.migration;
  let b = this.bodyPos();
  let r = lerp(26, 17, night); // *** sun and moon radius
  let col = this.mix([255, 236, 186], [226, 232, 246], night);
  // how much of the moon is lit, 0 new to 1 full. kept a little rounder
  // than the real moon so there is always a crescent to see
  let lit = max(0.3, 0.5 - 0.5 * cos(this.moonPhase() * TWO_PI));
  let glow = lerp(1, 0.5 * lit, night); // a thin moon barely glows

  noStroke();
  fill(col[0], col[1], col[2]);
  circle(b.x, b.y, r * 2);

  // the crescent: overdraw a sky-coloured disc, offset by the phase.
  // only the moon has one, so it fades in with the night
  if (night > 0.02) {
    let d = 2 * r * lit; // thickness of the lit part
    let side = this.moonPhase() < 0.5 ? -1 : 1; // waxing moons are lit on the right
    let sky = this.skyColor(constrain(1 + b.y / this.skyH, 0, 1)); // the sky behind the moon
    fill(sky[0], sky[1], sky[2], 255 * night * night); // squared, so the dawn sun loses its bite early
    circle(b.x + side * d, b.y, r * 2 + 0.5);
  }

  // halo: a stack of faint additive discs, biggest first, so the
  // light piles up toward the body without hard rings. Drawn last so
  // the carved part of the moon glows like the sky around it
  blendMode(ADD);
  let steps = 12; // *** more steps, smoother halo
  for (let k = 0; k < steps; k++) {
    let f = 1 - k / steps;
    fill(col[0], col[1], col[2], (5 + 7 * (k / steps) * (k / steps)) * glow);
    circle(b.x, b.y, r * 2 * (1 + 2.6 * f * f));
  }
  blendMode(BLEND);
};

///////////////////////////////////////////////////////////////////
// Surface
// The waterline is a sum of sines. It is drawn in renderWater so
// the boat can sit in it and the water gradient can fill below it.
///////////////////////////////////////////////////////////////////

// Height of the surface at x, in world coords (negative is up).
// Three waves of different lengths and speeds, two running one way
// and one the other, so the pattern never repeats visibly.
Sea.prototype.surfaceY = function (x) {
  let t = millis() * 0.001;
  return sin(x * 0.012 + t * 0.9) * 3.2 + sin(x * 0.031 - t * 1.4) * 1.6 + sin(x * 0.0051 + t * 0.5) * 2.4; // *** wave sizes
};

Sea.prototype.renderSurface = function () {
  let amp = this.waveAmp;
  let step = 6; // *** px between wave points
  let v = this.view;
  let x0 = v.x0 - step;
  let x1 = v.x1 + step;
  let pts = [];
  for (let x = x0; x <= x1; x += step) {
    pts.push({ x: x, y: this.surfaceY(x) });
  }

  noStroke();
  // sky in the troughs, water in the crests. both polygons share the wave
  let sky = this.skyColor(1);
  fill(sky[0], sky[1], sky[2]);
  beginShape();
  vertex(x0, -amp - 2);
  for (let i = 0; i < pts.length; i++) vertex(pts[i].x, pts[i].y);
  vertex(x1, -amp - 2);
  endShape(CLOSE);

  let wat = this.waterColor(0);
  fill(wat[0], wat[1], wat[2]);
  beginShape();
  for (let i = 0; i < pts.length; i++) vertex(pts[i].x, pts[i].y);
  vertex(x1, amp + 2);
  vertex(x0, amp + 2);
  endShape(CLOSE);

  // the waterline itself, brighter while the camera passes through it
  noFill();
  stroke(170, 210, 235, 70 + 120 * sin(this.u * PI));
  strokeWeight(1.2);
  beginShape();
  for (let i = 0; i < pts.length; i++) vertex(pts[i].x, pts[i].y);
  endShape();

  this.renderReflection();
};

// A thin trail of light under the sun or moon: a bright stretch of
// waterline and short dashes fading down into the water.
Sea.prototype.renderReflection = function () {
  let b = this.bodyPos();
  if (b.y > -10) return; // body below the horizon
  let night = tide.migration;
  let col = this.mix([255, 236, 186], [226, 232, 246], night);
  let bright = lerp(0.6, 1, night) * constrain(-b.y / 80, 0, 1); // dim when it sits on the horizon
  let t = millis() * 0.001;

  blendMode(ADD);
  noStroke();
  for (let k = 0; k < 8; k++) {
    let y = this.surfaceY(b.x) + 5 + k * 6;
    let w = 18 + k * 7 + sin(t * 1.7 + k * 1.3) * 9;
    let x = b.x + sin(t * 1.1 + k * 2.1) * (3 + k);
    fill(col[0], col[1], col[2], 50 * bright * (1 - k / 8));
    rect(x - w / 2, y, w, 1.5);
  }
  // the crest glint
  stroke(col[0], col[1], col[2], 120 * bright);
  strokeWeight(1.5);
  noFill();
  beginShape();
  for (let x = b.x - 40; x <= b.x + 40; x += 5) {
    vertex(x, this.surfaceY(x));
  }
  endShape();
  blendMode(BLEND);
};

// A small dark boat at the top of the line. The line's anchor is at
// (fline.anchorX, -8), so the rod ends there and the hull sits just
// behind it, bobbing on the wave.
Sea.prototype.renderBoat = function () {
  let ax = fline.anchorX;
  let bx = ax - 24;
  let sy = this.surfaceY(bx);
  let night = tide.migration;

  push();
  translate(bx, sy);
  noStroke();
  fill(5, 7, 13);
  // hull with a raked bow and stern
  beginShape();
  vertex(-36, -6);
  vertex(36, -6);
  vertex(27, 5);
  vertex(-27, 5);
  endShape(CLOSE);
  // a low cabin and a short mast
  rect(-16, -17, 20, 11, 2);
  rect(-2, -30, 1.5, 13);
  pop();

  // the rod, from the cabin to where the line leaves the boat
  stroke(5, 7, 13);
  strokeWeight(1.5);
  line(bx + 8, sy - 12, ax, fline.anchorY);

  // a lantern on the mast, warmer and brighter the darker it gets
  let l = 0.25 + 0.75 * night;
  blendMode(ADD);
  noStroke();
  fill(255, 190, 110, 40 * l);
  circle(bx - 1, sy - 30, 22);
  fill(255, 210, 150, 220 * l);
  circle(bx - 1, sy - 30, 3);
  blendMode(BLEND);
};

///////////////////////////////////////////////////////////////////
// Water
// A cached depth gradient that follows the clock, the surface and
// boat, sunlight shafts by day, and the bright band of the dive.
///////////////////////////////////////////////////////////////////

Sea.prototype.renderWater = function () {
  let v = this.view;
  push();
  noStroke();
  image(this.waterG, v.x0, 0, v.x1 - v.x0, height);
  this.renderSurface();
  this.renderShafts();
  if (this.state === "diving" || this.state === "rising") this.renderDiveBand();
  this.renderBoat();
  pop();
};

// Slanted columns of sunlight that sway slowly and fade with depth,
// drawn additively. They disappear as the migration rises.
Sea.prototype.renderShafts = function () {
  let day = 1 - tide.migration;
  if (day < 0.03) return;
  let t = millis() * 0.0002;
  let n = 10; // *** how many shafts, spread a little past both edges
  let depth = height * 0.8; // *** how deep the light reaches
  let segs = 4;

  blendMode(ADD);
  noStroke();
  for (let i = 0; i < n; i++) {
    let x0 = width * (-0.25 + (1.5 * (i + 0.5)) / n) + sin(t * 1.3 + i * 1.7) * width * 0.03;
    let lean = 90 + sin(t + i) * 50; // px the shaft drifts sideways over its depth
    let w0 = 22 + this.hash(i + 3) * 30;
    let flicker = 0.75 + 0.25 * sin(t * 6 + i * 2.3);
    for (let k = 0; k < segs; k++) {
      let a0 = k / segs;
      let a1 = (k + 1) / segs;
      let hw0 = (w0 * (1 + a0 * 1.6)) / 2;
      let hw1 = (w0 * (1 + a1 * 1.6)) / 2;
      fill(90, 150, 190, 20 * day * flicker * (1 - a0)); // *** 20 = shaft brightness
      quad(x0 + lean * a0 - hw0, depth * a0, x0 + lean * a0 + hw0, depth * a0, x0 + lean * a1 + hw1, depth * a1, x0 + lean * a1 - hw1, depth * a1);
    }
  }
  blendMode(BLEND);
};

// The underside of the surface as we pass through it: a bright band
// that swells and fades over the dive, and again on the way up.
Sea.prototype.renderDiveBand = function () {
  let a = 70 * sin(this.u * PI);
  let bands = 10;
  let v = this.view;
  blendMode(ADD);
  noStroke();
  for (let k = 0; k < bands; k++) {
    fill(120, 190, 230, a * (1 - k / bands));
    rect(v.x0, k * 8, v.x1 - v.x0, 8);
  }
  blendMode(BLEND);
};

///////////////////////////////////////////////////////////////////
// Fog
// Drawn over the creatures: marine snow drifting on noise, the
// bubbles of the dive, and a haze that thickens toward the bottom
// so deep things look far away.
///////////////////////////////////////////////////////////////////

Sea.prototype.makeSnow = function () {
  this.snow = [];
  let n = 90; // *** flakes of marine snow
  for (let i = 0; i < n; i++) {
    this.snow.push({
      x: random(width),
      y: random(height),
      size: random(0.8, 2.3),
      fall: random(0.12, 0.45), // *** how fast the snow sinks
      seed: random(1000)
    });
  }
};

Sea.prototype.moveSnow = function () {
  let t = frameCount * 0.004;
  for (let i = 0; i < this.snow.length; i++) {
    let s = this.snow[i];
    s.x += (noise(s.seed, t) - 0.5) * 0.8; // sideways drift on a noise field
    s.y += s.fall * (0.6 + 0.8 * noise(s.seed + 50, t));
    if (s.y > height + 4) s.y = -4;
    if (s.x < -4) s.x = width + 4;
    if (s.x > width + 4) s.x = -4;
  }
};

Sea.prototype.renderSnow = function () {
  let dim = 0.7 + 0.3 * (1 - tide.migration); // a little dimmer at night
  strokeCap(ROUND);
  for (let i = 0; i < this.snow.length; i++) {
    let s = this.snow[i];
    stroke(196, 214, 232, (40 + s.size * 40) * dim);
    strokeWeight(s.size);
    point(s.x, s.y);
  }
};

// Bubbles are let go once, when the dive begins, and rise until
// they reach the waterline.
Sea.prototype.makeBubbles = function () {
  this.bubbles = [];
  let n = 36; // *** bubbles in the dive
  for (let i = 0; i < n; i++) {
    this.bubbles.push({
      x: fline.anchorX + random(-width * 0.3, width * 0.3),
      y: random(20, height * 0.7),
      r: random(1.5, 4.5),
      rise: random(0.5, 1.4),
      ph: random(TWO_PI)
    });
  }
};

Sea.prototype.moveBubbles = function () {
  for (let i = this.bubbles.length - 1; i >= 0; i--) {
    let b = this.bubbles[i];
    b.y -= b.rise;
    b.x += sin(frameCount * 0.05 + b.ph) * 0.3;
    if (b.y < this.surfaceY(b.x) + b.r) this.bubbles.splice(i, 1);
  }
};

Sea.prototype.renderBubbles = function () {
  noFill();
  strokeWeight(1);
  for (let i = 0; i < this.bubbles.length; i++) {
    let b = this.bubbles[i];
    stroke(200, 230, 255, 130);
    circle(b.x, b.y, b.r * 2);
    stroke(255, 255, 255, 180);
    point(b.x - b.r * 0.4, b.y - b.r * 0.4);
  }
};

Sea.prototype.renderFog = function () {
  push();
  this.renderSnow();
  if (this.bubbles.length > 0) this.renderBubbles();
  noStroke();
  image(this.hazeG, this.view.x0, 0, this.view.x1 - this.view.x0, height);
  pop();
};

///////////////////////////////////////////////////////////////////
// Caches and resize
// The three gradients (sky, water, haze) are painted into narrow
// createGraphics() strips, one row per 3 px, and stretched over the
// canvas with image(). Repainted every 20 frames and on resize.
///////////////////////////////////////////////////////////////////

Sea.prototype.paintCaches = function () {
  if (this.skyG === null) {
    this.skyG = createGraphics(2, this.rows);
    this.waterG = createGraphics(2, this.rows);
    this.hazeG = createGraphics(2, this.rows);
  }
  this.cacheMig = tide.migration;
  let night = tide.migration;
  let hazeCol = this.mix([4, 16, 34], [1, 3, 9], night);

  this.skyG.noStroke();
  this.waterG.noStroke();
  this.hazeG.noStroke();
  this.hazeG.clear();
  for (let r = 0; r < this.rows; r++) {
    let t = r / (this.rows - 1);
    let s = this.skyColor(t);
    this.skyG.fill(s[0], s[1], s[2]);
    this.skyG.rect(0, r, 2, 1);

    let w = this.waterColor(t);
    this.waterG.fill(w[0], w[1], w[2]);
    this.waterG.rect(0, r, 2, 1);

    // haze: nothing in the top third, then thickening to the bottom
    let h = constrain((t - 0.35) / 0.65, 0, 1);
    this.hazeG.fill(hazeCol[0], hazeCol[1], hazeCol[2], 200 * pow(h, 1.6)); // *** 200 = how thick the deep haze gets
    this.hazeG.rect(0, r, 2, 1);
  }
};

Sea.prototype.resize = function () {
  this.skyH = max(1, (height * this.restY) / this.zoomSurface);
  this.placeCamera();
  this.rows = max(1, ceil(height / 3));
  // throw the old strips away so paintCaches makes new ones at the new height
  this.skyG.remove();
  this.waterG.remove();
  this.hazeG.remove();
  this.skyG = null;
  this.paintCaches();
  this.makeSnow();
};
