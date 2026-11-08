/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * line.js - the fishing line and its lure
 *
 * The line hangs from the surface and the lure follows the pointer
 * (or later, a hand). Whatever it brushes against lights up and
 * makes a sound. The rope is a chain of points held together by
 * distance constraints (Verlet integration), with water drag.
 */

///////////////////////////////////////////////////////////////////
// FishingLine Object
// Call setTarget() with wherever the lure should go, update() once
// a frame, render() after the creatures. Creatures use nearest() to
// find out how close the line is and speed to know if it is moving.
///////////////////////////////////////////////////////////////////

function FishingLine(x, y) {
  this.n = 26; // *** points along the rope
  this.lx = x; // lure position
  this.ly = y;
  this.tx = x; // where the lure is heading
  this.ty = y;
  this.anchorX = x; // top of the line, drifts slowly after the lure like a boat
  this.anchorY = -8; // *** just above the top of the screen (surface)
  this.speed = 0; // how fast the lure moved this frame, eased
  this.lit = 0; // 0 to 1, how much the lure is glowing (hits brighten it)

  this.pts = [];
  for (let i = 0; i < this.n; i++) {
    let py = lerp(this.anchorY, y, i / (this.n - 1));
    this.pts.push({ x: x, y: py, px: x, py: py });
  }
  this.box = { x0: 0, y0: 0, x1: 0, y1: 0 }; // bounding box, for a quick reject in nearest()
}

// Where the lure should go, in screen coordinates. Mouse, autopilot
// and hands all call this. The sea's camera may be zoomed or above
// the water, so the point is mapped into world coordinates here.
FishingLine.prototype.setTarget = function (x, y) {
  if (typeof sea !== "undefined" && sea.toWorld) {
    let w = sea.toWorld(x, y);
    x = w.x;
    y = w.y;
  }
  this.tx = x;
  this.ty = y;
};

// Jump the lure straight to its target with no speed, so nothing
// counts it as a strike. Used the moment the camera settles under water.
FishingLine.prototype.settle = function () {
  this.lx = this.tx;
  this.ly = constrain(this.ty, 24, height - 8);
  this.speed = 0;
};

FishingLine.prototype.update = function () {
  // the top of the line lags far behind, the lure follows closely
  this.anchorX = lerp(this.anchorX, this.tx, 0.015);
  let plx = this.lx;
  let ply = this.ly;
  this.lx = lerp(this.lx, this.tx, 0.18); // *** lure response
  this.ly = lerp(this.ly, this.ty, 0.18);
  this.ly = constrain(this.ly, 24, height - 8);

  let moved = dist(this.lx, this.ly, plx, ply);
  this.speed = lerp(this.speed, moved, 0.3);
  this.lit *= 0.94;

  // rope length stretches a little past the straight distance so it sags
  let total = max(dist(this.anchorX, this.anchorY, this.lx, this.ly) * 1.06, 30);
  let seg = total / (this.n - 1);
  let P = this.pts;

  // Verlet step: keep most of last frame's motion (drag) and sink a little
  for (let i = 1; i < this.n - 1; i++) {
    let p = P[i];
    let vx = (p.x - p.px) * 0.9;
    let vy = (p.y - p.py) * 0.9 + 0.12; // *** 0.12 = how heavy the line is
    p.px = p.x;
    p.py = p.y;
    p.x += vx;
    p.y += vy;
  }

  // pull neighbouring points back to the segment length, a few passes
  for (let k = 0; k < 14; k++) {
    P[0].x = this.anchorX;
    P[0].y = this.anchorY;
    P[this.n - 1].x = this.lx;
    P[this.n - 1].y = this.ly;
    for (let i = 0; i < this.n - 1; i++) {
      let a = P[i];
      let b = P[i + 1];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = max(sqrt(dx * dx + dy * dy), 0.0001);
      let diff = ((d - seg) / d) * 0.5;
      let aPinned = i === 0;
      let bPinned = i + 1 === this.n - 1;
      if (aPinned && !bPinned) {
        b.x -= dx * diff * 2;
        b.y -= dy * diff * 2;
      } else if (!aPinned && bPinned) {
        a.x += dx * diff * 2;
        a.y += dy * diff * 2;
      } else if (!aPinned && !bPinned) {
        a.x += dx * diff;
        a.y += dy * diff;
        b.x -= dx * diff;
        b.y -= dy * diff;
      }
    }
  }
  P[0].x = this.anchorX;
  P[0].y = this.anchorY;
  P[this.n - 1].x = this.lx;
  P[this.n - 1].y = this.ly;

  let b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (let i = 0; i < this.n; i++) {
    b.x0 = min(b.x0, P[i].x);
    b.y0 = min(b.y0, P[i].y);
    b.x1 = max(b.x1, P[i].x);
    b.y1 = max(b.y1, P[i].y);
  }
  this.box = b;
};

// The closest point on the line to (x, y).
// Returns { d, x, y }. d is Infinity when further than pad from the
// whole line, so most creatures skip the segment loop.
FishingLine.prototype.nearest = function (x, y, pad) {
  if (pad === undefined) pad = 90;
  let b = this.box;
  if (x < b.x0 - pad || x > b.x1 + pad || y < b.y0 - pad || y > b.y1 + pad) {
    return { d: Infinity, x: 0, y: 0 };
  }

  let best = { d: Infinity, x: 0, y: 0 };
  let P = this.pts;
  for (let i = 0; i < P.length - 1; i++) {
    let ax = P[i].x;
    let ay = P[i].y;
    let dx = P[i + 1].x - ax;
    let dy = P[i + 1].y - ay;
    let l2 = dx * dx + dy * dy;
    let u = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
    u = constrain(u, 0, 1);
    let cx = ax + u * dx;
    let cy = ay + u * dy;
    let d = dist(x, y, cx, cy);
    if (d < best.d) best = { d: d, x: cx, y: cy };
  }
  return best;
};

// Called by a creature when the line strikes it, so the lure flares.
FishingLine.prototype.strike = function () {
  this.lit = 1;
};

FishingLine.prototype.render = function () {
  let P = this.pts;
  push();
  noFill();
  strokeCap(ROUND);

  // a soft wide pass then a thin bright one reads as a wet line catching light
  stroke(143, 220, 255, 18);
  strokeWeight(4);
  this.path();
  stroke(205, 232, 242, 110);
  strokeWeight(1);
  this.path();

  // the lure: a glow that grows when it moves or strikes
  let s = min(this.speed, 12);
  noStroke();
  fill(95, 243, 216, 40 + this.lit * 60);
  circle(this.lx, this.ly, 40 + s * 3 + this.lit * 30);
  fill(235, 255, 252, 240);
  circle(this.lx, this.ly, 6 + s * 0.5);

  // a small hook under the lure
  noFill();
  stroke(205, 232, 242, 140);
  strokeWeight(1.2);
  arc(this.lx + 4, this.ly + 9, 10, 10, PI * 0.95, PI * 2.05);
  pop();
};

// Smooth curve through the rope points.
FishingLine.prototype.path = function () {
  let P = this.pts;
  beginShape();
  curveVertex(P[0].x, P[0].y);
  for (let i = 0; i < P.length; i++) {
    curveVertex(P[i].x, P[i].y);
  }
  curveVertex(P[P.length - 1].x, P[P.length - 1].y);
  endShape();
};
