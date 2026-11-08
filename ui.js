/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * ui.js - everything written or clickable on top of the sea
 *
 * STREAM D owns this file. All of it is drawn with p5 (text, rect,
 * circle), there is no HTML. Panels are hit-tested by rectangle in
 * mousePressed(). Every panel can be collapsed to just its heading
 * and opened again with a click on the heading or a key.
 *
 * Look: translucent dark rounded panels with a 1 px pale border, a
 * serif display face for titles (Georgia), a clean sans for body
 * text, pale text and one glowing green for anything you can press.
 */

///////////////////////////////////////////////////////////////////
// Panels Object
// Interface used by sketch.js (screen coordinates, drawn last):
//   ui.render()            title, clock panel, field guide, help, the
//                          sound button, and the start screen while
//                          sea.state is "surface" (fading out while "diving")
//   ui.mousePressed()      returns true if the click landed on a panel
//                          or button, so the sketch leaves the lure alone
//   ui.keyPressed(key)     returns true if the key toggled something
//   ui.toggle(name)        "guide", "clock", "title", "help"
//   ui.shown[name]         true = open, false = collapsed to its heading
//
// Panels read: tide.clockText(), tide.phaseText(), familyLook[],
// sound.muted, sea.state. The start button calls beginDive() in
// sketch.js, the sound button calls sound.toggleMute().
// If Body.prototype.renderIcon(x, y, size) exists (stream A), the
// field guide draws one Body per family as its portrait.
///////////////////////////////////////////////////////////////////

function Panels() {
  this.shown = { title: true, clock: true, guide: true, help: true };

  // *** the palette, shared with the rest of the piece
  this.pale = [212, 230, 234];
  this.glow = [95, 243, 216];
  this.ink = [6, 14, 26]; // panel background

  // *** faces. one family name each: p5 1.11 quotes the whole string as
  // a single family, so a comma list would silently fall back to Times
  this.serif = "Georgia";
  this.sans = "Arial";

  this.pad = 16; // *** inner margin of every panel
  this.radius = 14; // *** corner radius of panels
  this.fadeMs = 1000; // *** how long the start screen takes to fade once diving

  // one Body per family for the field guide portraits, built once
  this.icons = [];
  if (typeof Body === "function" && typeof Body.prototype.renderIcon === "function") {
    for (let f = 0; f < familyLook.length; f++) {
      this.icons.push(new Body(f, 1));
    }
  }

  this.diveAt = -1; // ms when we first saw the dive begin
  this.startAlpha = 1; // 1 on the surface, fades to 0 while diving
  this.hovering = false; // pointer is over a panel or button this frame

  this.lastW = 0;
  this.lastH = 0;
  this.boxes = {};
  this.layout();
}

///////////////////////////////////////////////////////////////////
// Layout
// One table of boxes that drawing and hit-testing both read, so a
// button is always clickable exactly where it is drawn. Each panel
// has h (open) and hh (collapsed, just the heading). Bottom panels
// hang from the bottom edge, so collapsing them keeps them there.
///////////////////////////////////////////////////////////////////

Panels.prototype.layout = function () {
  this.lastW = width;
  this.lastH = height;
  let m = 20; // *** margin from the canvas edge
  let b = {};

  // title, top left
  b.title = { x: m, y: m, w: min(400, width - 2 * m), h: 100, hh: 52, anchor: "top" };

  // clock, top right. the big time is its heading
  b.clock = { x: width - m - 290, y: m, w: 290, h: 138, hh: 66, anchor: "top" };
  b.soundBtn = { x: b.clock.x + this.pad, y: b.clock.y + 92, w: 140, h: 30 };

  // field guide, bottom left, one row per family
  let rowH = 60; // *** height of one guide row
  let gh = 44 + familyLook.length * rowH + 10;
  b.guide = { x: m, y: height - m - gh, w: min(400, width - 2 * m), h: gh, hh: 44, anchor: "bottom", rowH: rowH };

  // help, bottom right
  b.help = { x: width - m - 300, y: height - m - 116, w: 300, h: 116, hh: 44, anchor: "bottom" };

  // start button, centred on the start screen
  b.start = { x: width / 2 - 120, y: height * 0.66, w: 240, h: 54 };

  this.boxes = b;
};

// The rectangle a panel takes up right now, open or collapsed.
Panels.prototype.frame = function (name) {
  let b = this.boxes[name];
  let h = this.shown[name] ? b.h : b.hh;
  let y = b.anchor === "bottom" ? b.y + b.h - h : b.y;
  return { x: b.x, y: y, w: b.w, h: h };
};

// The heading strip of a panel, which is what you click to toggle it.
Panels.prototype.heading = function (name) {
  let f = this.frame(name);
  return { x: f.x, y: f.y, w: f.w, h: this.boxes[name].hh };
};

Panels.prototype.inBox = function (b) {
  return mouseX > b.x && mouseX < b.x + b.w && mouseY > b.y && mouseY < b.y + b.h;
};

Panels.prototype.toggle = function (name) {
  this.shown[name] = !this.shown[name];
};

// Title, guide and help only appear once the dive begins. The clock
// stays, since the time of day is the point of the piece.
Panels.prototype.panelAlpha = function (name) {
  if (name === "clock") return 1;
  return 1 - this.startAlpha;
};

///////////////////////////////////////////////////////////////////
// Render
// Called last by sketch.js, in screen coordinates.
///////////////////////////////////////////////////////////////////

Panels.prototype.render = function () {
  if (width !== this.lastW || height !== this.lastH) this.layout();
  this.updateFade();

  push();
  textFont(this.sans);
  textStyle(NORMAL);

  this.hovering = false;
  if (this.startAlpha > 0) this.renderStart(this.startAlpha);

  let names = ["title", "clock", "guide", "help"];
  for (let i = 0; i < names.length; i++) {
    let a = this.panelAlpha(names[i]);
    if (a <= 0.01) continue;
    if (a > 0.5 && this.inBox(this.frame(names[i]))) this.hovering = true;
    if (names[i] === "title") this.renderTitle(a);
    if (names[i] === "clock") this.renderClock(a);
    if (names[i] === "guide") this.renderGuide(a);
    if (names[i] === "help") this.renderHelp(a);
  }
  pop();

  this.updateCursor();
};

// The start screen fades over the first second of the dive.
Panels.prototype.updateFade = function () {
  if (sea.state === "surface") {
    this.diveAt = -1;
    this.startAlpha = 1;
    return;
  }
  if (this.diveAt < 0) this.diveAt = millis();
  this.startAlpha = 1 - constrain((millis() - this.diveAt) / this.fadeMs, 0, 1);
};

// A hand over anything pressable, an arrow over panels, and under
// water no pointer at all so the lure is the only thing that moves.
Panels.prototype.updateCursor = function () {
  if (this.startAlpha > 0) {
    let overStart = sea.state === "surface" && this.inBox(this.boxes.start);
    if (overStart || (this.hovering && this.inBox(this.boxes.soundBtn) && this.shown.clock)) cursor(HAND);
    else cursor(ARROW);
    return;
  }
  if (this.hovering) {
    let overBtn = this.shown.clock && this.inBox(this.boxes.soundBtn);
    cursor(overBtn ? HAND : ARROW);
  } else {
    noCursor();
  }
};

///////////////////////////////////////////////////////////////////
// Drawing helpers
// Shared bits so every panel and button looks the same.
///////////////////////////////////////////////////////////////////

// Translucent dark rounded panel with a 1 px pale border.
Panels.prototype.panel = function (f, a) {
  stroke(this.pale[0], this.pale[1], this.pale[2], 55 * a);
  strokeWeight(1);
  fill(this.ink[0], this.ink[1], this.ink[2], 170 * a);
  rect(f.x, f.y, f.w, f.h, this.radius);
  noStroke();
};

// Serif heading for a panel, italic so it reads as a title.
Panels.prototype.title = function (str, x, y, size, a) {
  textFont(this.serif);
  textStyle(ITALIC);
  textAlign(LEFT, TOP);
  textSize(size);
  fill(this.pale[0], this.pale[1], this.pale[2], 235 * a);
  text(str, x, y);
  textStyle(NORMAL);
  textFont(this.sans);
};

// Body text, pale or muted.
Panels.prototype.body = function (str, x, y, w, size, muted, a) {
  textFont(this.sans);
  textAlign(LEFT, TOP);
  textSize(size);
  fill(this.pale[0], this.pale[1], this.pale[2], (muted ? 150 : 225) * a);
  text(str, x, y, w, 200);
};

// Pill button. glowing = the green start button, otherwise an outline.
Panels.prototype.pill = function (b, label, glowing, a) {
  let hover = this.inBox(b);
  let r = b.h / 2;
  if (glowing) {
    // two soft halos behind it so it looks lit, brighter when hovered
    noStroke();
    fill(this.glow[0], this.glow[1], this.glow[2], (hover ? 40 : 22) * a);
    rect(b.x - 10, b.y - 10, b.w + 20, b.h + 20, r + 10);
    fill(this.glow[0], this.glow[1], this.glow[2], (hover ? 70 : 40) * a);
    rect(b.x - 4, b.y - 4, b.w + 8, b.h + 8, r + 4);
    fill(this.glow[0], this.glow[1], this.glow[2], (hover ? 255 : 215) * a);
    rect(b.x, b.y, b.w, b.h, r);
    fill(3, 32, 27, 255 * a);
  } else {
    stroke(this.pale[0], this.pale[1], this.pale[2], (hover ? 160 : 90) * a);
    strokeWeight(1);
    fill(this.pale[0], this.pale[1], this.pale[2], (hover ? 36 : 12) * a);
    rect(b.x, b.y, b.w, b.h, r);
    noStroke();
    fill(this.pale[0], this.pale[1], this.pale[2], 225 * a);
  }
  textFont(this.sans);
  textAlign(CENTER, CENTER);
  textSize(glowing ? 16 : 12);
  text(label, b.x + b.w / 2, b.y + b.h / 2);
};

///////////////////////////////////////////////////////////////////
// The panels
///////////////////////////////////////////////////////////////////

Panels.prototype.renderTitle = function (a) {
  let f = this.frame("title");
  let p = this.pad;
  this.panel(f, a);
  this.title("The Abyss Listens", f.x + p, f.y + 13, 24, a);
  if (!this.shown.title) return;
  this.body("Lower the line into the dark. Whatever it disturbs answers with light and sound.", f.x + p, f.y + 52, f.w - 2 * p, 13, true, a);
};

Panels.prototype.renderClock = function (a) {
  let f = this.frame("clock");
  let p = this.pad;
  this.panel(f, a);

  // the real time, big. this is the heading
  textFont(this.serif);
  textStyle(NORMAL);
  textAlign(LEFT, TOP);
  textSize(40);
  fill(this.pale[0], this.pale[1], this.pale[2], 240 * a);
  text(tide.clockText(), f.x + p, f.y + 12);
  textFont(this.sans);
  if (!this.shown.clock) return;

  this.body(tide.phaseText(), f.x + p, f.y + 64, f.w - 2 * p, 12, true, a);
  this.pill(this.boxes.soundBtn, sound.muted ? "Turn sound on" : "Mute sound", false, a);
};

Panels.prototype.renderGuide = function (a) {
  let f = this.frame("guide");
  let b = this.boxes.guide;
  let p = this.pad;
  this.panel(f, a);
  this.title("Field guide", f.x + p, f.y + 11, 20, a);
  if (!this.shown.guide) return;

  let textX = f.x + p + 48;
  let textW = f.w - p - 48 - p;
  for (let i = 0; i < familyLook.length; i++) {
    let fam = familyLook[i];
    let ry = f.y + 44 + i * b.rowH;
    let c = fam.col;

    // portrait: the real body if stream A gave us one, a lit dot until then
    if (this.icons.length > i) {
      this.icons[i].renderIcon(f.x + p + 18, ry + 22, 32);
    } else {
      noStroke();
      fill(c[0], c[1], c[2], 50 * a);
      circle(f.x + p + 18, ry + 22, 26);
      fill(c[0], c[1], c[2], 230 * a);
      circle(f.x + p + 18, ry + 22, 9);
    }

    // latin name in italic serif, the common name after it in the family colour
    textFont(this.serif);
    textStyle(ITALIC);
    textAlign(LEFT, TOP);
    textSize(15);
    fill(this.pale[0], this.pale[1], this.pale[2], 235 * a);
    text(fam.latin, textX, ry + 2);
    let lw = textWidth(fam.latin);
    textStyle(NORMAL);
    textFont(this.sans);
    textSize(11);
    fill(c[0], c[1], c[2], 220 * a);
    text(fam.name.toUpperCase(), textX + lw + 10, ry + 6);

    this.body(fam.blurb, textX, ry + 23, textW, 11, true, a);
  }
};

Panels.prototype.renderHelp = function (a) {
  let f = this.frame("help");
  let p = this.pad;
  this.panel(f, a);
  this.title("How to play", f.x + p, f.y + 11, 20, a);
  if (!this.shown.help) return;
  this.body("move the mouse to steer the lure", f.x + p, f.y + 50, f.w - 2 * p, 12, false, a);
  this.body("h hands   m mute   g guide", f.x + p, f.y + 70, f.w - 2 * p, 12, true, a);
  this.body("t clock   i help   y title   n night", f.x + p, f.y + 90, f.w - 2 * p, 12, true, a);
};

///////////////////////////////////////////////////////////////////
// Start screen
// Shown on the surface, fades out over the first second of the dive.
///////////////////////////////////////////////////////////////////

Panels.prototype.renderStart = function (a) {
  // a light wash so the text sits on something calm
  noStroke();
  fill(this.ink[0], this.ink[1], this.ink[2], 110 * a);
  rect(0, 0, width, height);

  let cx = width / 2;
  let ty = height * 0.34;
  textFont(this.serif);
  textStyle(NORMAL);
  textAlign(CENTER, CENTER);
  textSize(min(64, width * 0.09)); // *** title size, shrinks on narrow windows
  fill(this.pale[0], this.pale[1], this.pale[2], 245 * a);
  text("The Abyss Listens", cx, ty);

  textFont(this.sans);
  textSize(15);
  fill(this.pale[0], this.pale[1], this.pale[2], 170 * a);
  text("Most animals of the open ocean make their own light.", cx, ty + 72);
  text("Move the cursor to steer the lure. Whatever it disturbs answers.", cx, ty + 96);
  text("The real time of day decides who has risen to meet you.", cx, ty + 120);

  this.pill(this.boxes.start, "Lower the line", true, a);
};

///////////////////////////////////////////////////////////////////
// Input
// sketch.js asks here first, and leaves the lure alone when we
// answer true.
///////////////////////////////////////////////////////////////////

Panels.prototype.mousePressed = function () {
  if (sea.state === "surface" && this.inBox(this.boxes.start)) {
    beginDive();
    return true;
  }

  let names = ["title", "clock", "guide", "help"];
  for (let i = 0; i < names.length; i++) {
    let n = names[i];
    if (this.panelAlpha(n) <= 0.5) continue; // not visible yet, so not clickable
    if (n === "clock" && this.shown.clock && this.inBox(this.boxes.soundBtn)) {
      sound.toggleMute();
      return true;
    }
    if (this.inBox(this.heading(n))) {
      this.toggle(n);
      return true;
    }
    if (this.inBox(this.frame(n))) return true; // on the panel body, swallow it
  }
  return false;
};

// *** the key map. unused keys return false so sketch.js can have them
Panels.prototype.keyPressed = function (k) {
  if (k === "g") this.toggle("guide");
  else if (k === "t") this.toggle("clock");
  else if (k === "i") this.toggle("help");
  else if (k === "y") this.toggle("title");
  else return false;
  return true;
};
