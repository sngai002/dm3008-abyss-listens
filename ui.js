/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * ui.js - everything written or clickable on top of the sea
 *
 * STREAM D owns this file. All of it is drawn with p5 (text, rect,
 * circle), there is no HTML. Panels are hit-tested by rectangle in
 * mousePressed(). Every panel can be collapsed to just its heading
 * with the round button at the end of the heading, a click anywhere
 * on the heading, or the key shown in the tag beside the button.
 *
 * Look: translucent dark rounded panels with a 1 px pale border, a
 * serif display face for titles (Georgia), a clean sans for body
 * text, pale text and one glowing green for anything you can press.
 */

///////////////////////////////////////////////////////////////////
// Panels Object
// Interface used by sketch.js (screen coordinates, drawn last):
//   ui.render()            title, clock, field guide, help, the sound
//                          button, the demo scrubber, and the start
//                          screen while sea.state is "surface" (fading
//                          out while "diving", back in while "rising")
//   ui.mousePressed()      returns true if the click landed on a panel
//                          or button, so the sketch leaves the lure alone
//   ui.keyPressed(key)     returns true if the key toggled something
//   ui.toggle(name)        "guide", "clock", "title", "help"
//   ui.shown[name]         true = open, false = collapsed to its heading
//   ui.frame(name)         the rectangle a panel takes up right now
//                          (hand.js keeps its preview clear of these)
//   ui.panelAlpha(name)    0 to 1, how visible a panel is
//   ui.unlock(species)     creature.js calls this on every strike. The
//                          species index goes into the field guide
//   ui.resetUnlocks()      a new player: clear the guide
//
// Reads: tide.clockText(), tide.phaseText(), tide.isLive(), tide.hour,
// speciesList[], dayPeriods, periodStarts, periodOf(), speciesOfPeriod(),
// sound.muted, sea.state. Calls: beginDive() in sketch.js,
// sound.toggleMute(), tide.setHour(h) and tide.setHour(null).
// Portraits come from Body(species, 1).renderIcon(x, y, size) and
// Body.renderSilhouette(x, y, size) in anatomy.js. Bodies are grown
// one per frame, only for the guide page that is showing, and kept.
///////////////////////////////////////////////////////////////////

function Panels() {
  this.shown = { title: true, clock: true, guide: true, help: true };
  this.keys = { title: "y", clock: "t", guide: "g", help: "i" }; // *** the panel keys

  // *** the palette, shared with the rest of the piece
  this.pale = [212, 230, 234];
  this.glow = [95, 243, 216];
  this.ink = [6, 14, 26]; // panel background

  // *** faces. one family name each: p5 1.11 quotes the whole string as
  // a single family, so a comma list would silently fall back to Times
  this.serif = "Georgia";
  this.sans = "Arial";
  this.mono = "Courier"; // for the key tags

  this.pad = 16; // *** inner margin of every panel
  this.radius = 14; // *** corner radius of panels
  this.fadeMs = 1000; // *** how long the start screen takes to fade

  // the field guide log. Found flags live for the page's lifetime only,
  // so a shared laptop starts clean on reload (no localStorage on purpose)
  this.found = [];
  this.flashAt = []; // ms when each species was found, for the cell flash
  for (let i = 0; i < speciesList.length; i++) {
    this.found.push(false);
    this.flashAt.push(-1e9);
  }
  this.foundCount = 0;
  this.recent = -1; // the species found last
  this.selected = -1; // the cell the player clicked, shown in the detail strip
  this.hoverCell = -1; // the species under the pointer this frame
  this.bodies = {}; // species index -> Body, grown on first use
  this.grewThisFrame = false; // at most one body is grown per frame
  this.toast = null; // { text, at } for about two seconds after a find
  this.toastMs = 2000; // *** how long the "New: ..." toast stays
  this.flashMs = 2000; // *** how long a new cell glows

  // the guide pages, one per period of the day
  this.pages = [];
  for (let p = 0; p < dayPeriods.length; p++) {
    this.pages.push(speciesOfPeriod(dayPeriods[p]));
  }
  this.tab = 0; // which page is showing
  this.tabPinned = false; // true once the player picked a page, else it follows the clock

  // the demo scrubber under the clock
  this.scrubOpen = false;
  this.dragging = false;

  // the start screen fade. alpha 1 on the surface, 0 under water
  this.lastState = "";
  this.startAlpha = 1;
  this.fadeFrom = 1;
  this.fadeTo = 1;
  this.fadeAt = -1e9;
  this.returned = false; // true once the player has come back up

  this.hovering = false; // pointer is over a panel this frame
  this.hot = false; // pointer is over something pressable this frame

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
  let p = this.pad;
  let b = {};

  // title, top left
  b.title = { x: m, y: m, w: min(400, width - 2 * m), h: 100, hh: 52, anchor: "top" };

  // clock, top right. the big time is its heading
  b.clock = { x: width - m - 290, y: m, w: 290, h: 162, hh: 66, anchor: "top" };
  b.soundBtn = { x: b.clock.x + p, y: b.clock.y + 102, w: 140, h: 30 };
  b.hourLink = { x: b.clock.x + p, y: b.clock.y + 140, w: 80, h: 16 };

  // field guide, bottom left: four tabs (one per period of the day),
  // each a grid of 25 portrait cells, and a detail strip for one
  // species at a time. The strip shrinks to one line on short screens.
  let cell = 48; // *** size of one portrait cell
  let gap = 4;
  let gw = min(400, width - 2 * m);
  let cols = max(4, floor((gw - 2 * p + gap) / (cell + gap)));
  let per = this.pages[0].length;
  let rows = ceil(per / cols);
  let gridH = rows * (cell + gap) - gap;
  let tabsH = 36; // *** height of the tab row
  let detailH = height < 720 ? 36 : 88; // *** the detail strip, one line when space is short
  let gh = 44 + tabsH + 6 + gridH + 10 + detailH + 8;
  b.guide = { x: m, y: height - m - gh, w: gw, h: gh, hh: 44, anchor: "bottom", cell: cell, gap: gap, cols: cols, gridH: gridH, tabsH: tabsH, detailH: detailH };

  // help, bottom right. short, the keys sit on the panels now
  b.help = { x: width - m - 300, y: height - m - 96, w: 300, h: 96, hh: 44, anchor: "bottom" };

  // start screen. the waterline sits at 80 percent, so everything
  // stays in the top 70 percent of the frame
  b.start = { x: width / 2 - 130, y: height * 0.52, w: 260, h: 54 };
  b.resetLink = { x: width / 2 - 60, y: b.start.y + b.start.h + 14, w: 120, h: 18 };

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

// The round collapse button at the right end of a heading frame.
Panels.prototype.buttonBox = function (f) {
  return { x: f.x + f.w - this.pad - 20, y: f.y + 12, w: 20, h: 20 };
};

// One tab of the guide.
Panels.prototype.tabBox = function (p) {
  let f = this.frame("guide");
  let b = this.boxes.guide;
  let w = (f.w - 2 * this.pad) / this.pages.length;
  return { x: f.x + this.pad + p * w, y: f.y + 44, w: w, h: b.tabsH };
};

// One portrait cell of the showing page, k is the cell number.
Panels.prototype.cellBox = function (k) {
  let f = this.frame("guide");
  let b = this.boxes.guide;
  let col = k % b.cols;
  let row = floor(k / b.cols);
  let top = f.y + 44 + b.tabsH + 6;
  return { x: f.x + this.pad + col * (b.cell + b.gap), y: top + row * (b.cell + b.gap), w: b.cell, h: b.cell };
};

// The scrubber strip hangs under the clock, wherever its bottom is.
Panels.prototype.scrubBoxes = function () {
  let f = this.frame("clock");
  let strip = { x: f.x, y: f.y + f.h + 8, w: f.w, h: 112 };
  let track = { x: strip.x + this.pad + 8, y: strip.y + 40, w: strip.w - 2 * this.pad - 16, h: 24 };
  let follow = { x: strip.x + this.pad, y: strip.y + 76, w: 150, h: 26 };
  return { strip: strip, track: track, follow: follow };
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

// Which period of the day the clock is in, as an index into dayPeriods.
Panels.prototype.periodNow = function () {
  return dayPeriods.indexOf(periodOf(tide.hour));
};

// "Night . 22:00 to 05:00", with a middle dot. Escaped, since index.html
// sets no charset and a raw UTF-8 character would show as two
Panels.prototype.periodLabel = function (p) {
  let name = dayPeriods[p];
  let from = periodStarts[p];
  let to = periodStarts[(p + 1) % periodStarts.length];
  return name.charAt(0).toUpperCase() + name.slice(1) + " \u00b7 " + nf(from, 2) + ":00 to " + nf(to, 2) + ":00";
};

///////////////////////////////////////////////////////////////////
// The log
// creature.js calls unlock() on every strike. Only the first strike
// of a species does anything.
///////////////////////////////////////////////////////////////////

Panels.prototype.unlock = function (species) {
  if (species < 0 || species >= speciesList.length) return;
  if (this.found[species]) return;
  this.found[species] = true;
  this.foundCount++;
  this.recent = species;
  this.selected = species;
  this.flashAt[species] = millis();
  this.toast = { text: "New: " + speciesList[species].name, at: millis() };
};

Panels.prototype.resetUnlocks = function () {
  for (let i = 0; i < this.found.length; i++) {
    this.found[i] = false;
    this.flashAt[i] = -1e9;
  }
  this.foundCount = 0;
  this.recent = -1;
  this.selected = -1;
  this.toast = null;
};

// How many of one page's species have been found.
Panels.prototype.pageCount = function (p) {
  let list = this.pages[p];
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    if (this.found[list[i]]) n++;
  }
  return n;
};

// The Body that draws a species' portrait. Grown the first time the
// guide needs it, at most one per frame so a fresh page never stalls,
// and kept. null until then, or when anatomy.js cannot draw it.
Panels.prototype.bodyFor = function (i) {
  if (this.bodies[i] !== undefined) return this.bodies[i];
  if (this.grewThisFrame) return null;
  let can = typeof Body === "function" && typeof Body.prototype.renderIcon === "function";
  if (!can) return null;
  this.grewThisFrame = true;
  this.bodies[i] = new Body(i, 1);
  return this.bodies[i];
};

///////////////////////////////////////////////////////////////////
// Render
// Called last by sketch.js, in screen coordinates.
///////////////////////////////////////////////////////////////////

Panels.prototype.render = function () {
  if (width !== this.lastW || height !== this.lastH) this.layout();
  this.updateFade();
  this.updateDrag();
  if (!this.tabPinned) this.tab = this.periodNow();
  this.grewThisFrame = false;

  push();
  textFont(this.sans);
  textStyle(NORMAL);

  this.hovering = false;
  this.hot = false;
  this.hoverCell = -1;
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
    this.controls(this.frame(names[i]), this.keys[names[i]], this.shown[names[i]], a);
  }
  if (this.scrubOpen) this.renderScrub();
  this.renderToast();
  pop();

  this.updateCursor();
};

// The start screen fades out over the first second of the dive and
// back in when the camera rises. One eased fade, retargeted whenever
// the sea changes state.
Panels.prototype.updateFade = function () {
  let s = sea.state;
  if (s !== this.lastState) {
    this.fadeFrom = this.startAlpha;
    this.fadeTo = s === "surface" || s === "rising" ? 1 : 0;
    this.fadeAt = millis();
    if (s === "rising") this.returned = true;
    if (this.lastState === "") this.fadeAt = -1e9; // first frame, no fade
    this.lastState = s;
  }
  let u = constrain((millis() - this.fadeAt) / this.fadeMs, 0, 1);
  this.startAlpha = lerp(this.fadeFrom, this.fadeTo, u);
};

// The scrubber follows the mouse while the button is held.
Panels.prototype.updateDrag = function () {
  if (!this.dragging) return;
  if (!mouseIsPressed || !this.scrubOpen) {
    this.dragging = false;
    return;
  }
  let t = this.scrubBoxes().track;
  tide.setHour(constrain(map(mouseX, t.x, t.x + t.w, 0, 24), 0, 23.999));
};

// A hand over anything pressable, an arrow over panels, and under
// water no pointer at all so the lure is the only thing that moves.
Panels.prototype.updateCursor = function () {
  if (this.hot) cursor(HAND);
  else if (this.startAlpha > 0 || this.hovering || this.scrubOpen) cursor(ARROW);
  else noCursor();
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

// The heading controls: a key tag and the round collapse button at
// the right end of a frame. open decides between minus and plus,
// drawn as lines so no font or charset can turn them into boxes.
Panels.prototype.controls = function (f, key, open, a) {
  let b = this.buttonBox(f);
  let hover = a > 0.5 && this.inBox(b);
  if (hover) this.hot = true;

  // the key, in a small monospace tag
  let tag = { x: b.x - 8 - 22, y: b.y + 1, w: 22, h: 18 };
  stroke(this.pale[0], this.pale[1], this.pale[2], 50 * a);
  strokeWeight(1);
  fill(this.pale[0], this.pale[1], this.pale[2], 10 * a);
  rect(tag.x, tag.y, tag.w, tag.h, 4);
  noStroke();
  textFont(this.mono);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  textSize(11);
  fill(this.pale[0], this.pale[1], this.pale[2], 140 * a);
  text(key, tag.x + tag.w / 2, tag.y + tag.h / 2);
  textStyle(NORMAL);

  // the button
  stroke(this.pale[0], this.pale[1], this.pale[2], (hover ? 170 : 90) * a);
  fill(this.pale[0], this.pale[1], this.pale[2], (hover ? 40 : 14) * a);
  circle(b.x + b.w / 2, b.y + b.h / 2, b.w);
  let cx = b.x + b.w / 2;
  let cy = b.y + b.h / 2;
  stroke(this.pale[0], this.pale[1], this.pale[2], (hover ? 240 : 180) * a);
  strokeWeight(1.5);
  line(cx - 4, cy, cx + 4, cy);
  if (!open) line(cx, cy - 4, cx, cy + 4);
  noStroke();
};

// Serif heading for a panel, italic so it reads as a title.
// Returns its width so something can sit after it.
Panels.prototype.title = function (str, x, y, size, a) {
  textFont(this.serif);
  textStyle(ITALIC);
  textAlign(LEFT, TOP);
  textSize(size);
  fill(this.pale[0], this.pale[1], this.pale[2], 235 * a);
  text(str, x, y);
  let w = textWidth(str);
  textStyle(NORMAL);
  textFont(this.sans);
  return w;
};

// Body text, pale or muted.
Panels.prototype.body = function (str, x, y, w, size, muted, a) {
  textFont(this.sans);
  textAlign(LEFT, TOP);
  textSize(size);
  fill(this.pale[0], this.pale[1], this.pale[2], (muted ? 150 : 225) * a);
  text(str, x, y, w, 200);
};

// A small muted underlined link. Brightens when hovered and marks the
// pointer as over something pressable.
Panels.prototype.link = function (b, label, a) {
  let hover = this.inBox(b);
  if (hover) this.hot = true;
  textFont(this.sans);
  textAlign(LEFT, TOP);
  textSize(11);
  fill(this.pale[0], this.pale[1], this.pale[2], (hover ? 230 : 120) * a);
  text(label, b.x, b.y + 2);
  let w = textWidth(label);
  stroke(this.pale[0], this.pale[1], this.pale[2], (hover ? 160 : 70) * a);
  strokeWeight(1);
  line(b.x, b.y + 14, b.x + w, b.y + 14);
  noStroke();
};

// Pill button. glowing = the green start button, otherwise an outline.
Panels.prototype.pill = function (b, label, glowing, a) {
  let hover = this.inBox(b);
  if (hover) this.hot = true;
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

// A species portrait. The grown body when there is one, a dot until then.
Panels.prototype.portrait = function (i, x, y, size, a) {
  let c = speciesList[i].col;
  let body = this.bodyFor(i);
  if (body !== null) {
    body.renderIcon(x, y, size);
    return;
  }
  noStroke();
  fill(c[0], c[1], c[2], 50 * a);
  circle(x, y, size * 0.8);
  fill(c[0], c[1], c[2], 230 * a);
  circle(x, y, size * 0.28);
};

// A locked species: its dark shape, so you can tell something is there.
Panels.prototype.silhouette = function (i, x, y, size, a) {
  let body = this.bodyFor(i);
  if (body !== null && typeof body.renderSilhouette === "function") {
    body.renderSilhouette(x, y, size);
    return;
  }
  noStroke();
  fill(this.pale[0], this.pale[1], this.pale[2], 22 * a);
  circle(x, y, size * 0.36);
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
  if (!tide.isLive()) {
    let w = textWidth(tide.clockText());
    textFont(this.sans);
    textSize(12);
    fill(this.glow[0], this.glow[1], this.glow[2], 200 * a);
    text("(demo)", f.x + p + w + 10, f.y + 24);
  }
  textFont(this.sans);
  if (!this.shown.clock) return;

  this.body(tide.phaseText(), f.x + p, f.y + 64, f.w - 2 * p, 12, true, a);
  this.body(this.periodLabel(this.periodNow()), f.x + p, f.y + 81, f.w - 2 * p, 12, false, a);
  this.pill(this.boxes.soundBtn, sound.muted ? "Turn sound on" : "Mute sound", false, a);
  this.link(this.boxes.hourLink, "set the hour", a);
};

Panels.prototype.renderGuide = function (a) {
  let f = this.frame("guide");
  let b = this.boxes.guide;
  let p = this.pad;
  this.panel(f, a);
  let tw = this.title("Field guide", f.x + p, f.y + 11, 20, a);
  this.body(this.foundCount + " of " + speciesList.length, f.x + p + tw + 12, f.y + 17, 120, 12, true, a);
  if (!this.shown.guide) return;

  this.renderTabs(a);

  // the grid: one cell per species of the showing page
  let list = this.pages[this.tab];
  let now = millis();
  for (let k = 0; k < list.length; k++) {
    let i = list[k];
    let cb = this.cellBox(k);
    let hover = a > 0.5 && this.inBox(cb);
    if (hover) {
      this.hoverCell = i;
      this.hot = true;
    }
    let c = speciesList[i].col;
    let flash = 1 - constrain((now - this.flashAt[i]) / this.flashMs, 0, 1);

    // the cell: a faint tile, brighter when hovered or selected, glowing when new
    noStroke();
    fill(this.pale[0], this.pale[1], this.pale[2], (hover ? 30 : 10) * a);
    rect(cb.x, cb.y, cb.w, cb.h, 8);
    if (i === this.selected || flash > 0) {
      let pulse = 0.5 + 0.5 * sin(now * 0.012);
      stroke(this.glow[0], this.glow[1], this.glow[2], (i === this.selected ? 110 : 0) * a + 150 * flash * pulse * a);
      strokeWeight(1);
      noFill();
      rect(cb.x + 0.5, cb.y + 0.5, cb.w - 1, cb.h - 1, 8);
      noStroke();
    }
    if (this.found[i]) {
      if (flash > 0) {
        fill(c[0], c[1], c[2], 70 * flash * a);
        circle(cb.x + cb.w / 2, cb.y + cb.h / 2, cb.w * (0.6 + 0.6 * flash));
      }
      this.portrait(i, cb.x + cb.w / 2, cb.y + cb.h / 2, cb.w * 0.7, a);
    } else {
      this.silhouette(i, cb.x + cb.w / 2, cb.y + cb.h / 2, cb.w * 0.7, a);
    }
  }

  // the detail strip: whatever the pointer is over, else the selection
  let dy = f.y + 44 + b.tabsH + 6 + b.gridH + 10;
  let show = this.hoverCell >= 0 ? this.hoverCell : this.selected;
  stroke(this.pale[0], this.pale[1], this.pale[2], 30 * a);
  strokeWeight(1);
  line(f.x + p, dy - 5, f.x + f.w - p, dy - 5);
  noStroke();
  if (b.detailH < 60) this.renderDetailLine(show, f.x + p, dy, f.w - 2 * p, a);
  else this.renderDetail(show, f.x + p, dy, f.w - 2 * p, a);
};

// The four pages. The one for the hour on the clock says "now".
Panels.prototype.renderTabs = function (a) {
  let now = this.periodNow();
  for (let p = 0; p < this.pages.length; p++) {
    let t = this.tabBox(p);
    let hover = a > 0.5 && this.inBox(t);
    if (hover) this.hot = true;
    let on = p === this.tab;
    let name = dayPeriods[p];
    name = name.charAt(0).toUpperCase() + name.slice(1);

    noStroke();
    if (on) {
      fill(this.glow[0], this.glow[1], this.glow[2], 160 * a);
      rect(t.x + 4, t.y + t.h - 2, t.w - 8, 2, 1);
    } else if (hover) {
      fill(this.pale[0], this.pale[1], this.pale[2], 14 * a);
      rect(t.x, t.y, t.w, t.h, 6);
    }
    textFont(this.sans);
    textAlign(LEFT, TOP);
    textSize(12);
    fill(this.pale[0], this.pale[1], this.pale[2], (on ? 235 : 140) * a);
    text(name, t.x + 6, t.y + 4);
    textSize(9);
    fill(this.pale[0], this.pale[1], this.pale[2], (on ? 170 : 110) * a);
    let count = this.pageCount(p) + "/" + this.pages[p].length;
    text(count, t.x + 6, t.y + 20);
    if (p === now) {
      // a glowing dot and the word, so the current period reads at a glance
      let cw = textWidth(count);
      fill(this.glow[0], this.glow[1], this.glow[2], 220 * a);
      circle(t.x + 6 + cw + 9, t.y + 24, 4);
      text("now", t.x + 6 + cw + 15, t.y + 20);
    }
  }
};

// One species written out: portrait, latin name, common name, blurb.
// A locked one shows only a "?", an empty log shows a hint.
Panels.prototype.renderDetail = function (i, x, y, w, a) {
  if (i < 0) {
    this.body("Brush a creature with the line to add it to the log.", x, y + 8, w, 12, true, a);
    return;
  }
  let s = speciesList[i];
  let px = x + 30;
  let py = y + 40;
  let tx = x + 64;
  if (!this.found[i]) {
    this.silhouette(i, px, py, 48, a);
    textFont(this.serif);
    textStyle(ITALIC);
    textAlign(LEFT, TOP);
    textSize(22);
    fill(this.pale[0], this.pale[1], this.pale[2], 200 * a);
    text("?", tx, y + 6);
    textStyle(NORMAL);
    this.body("Not found yet.", tx, y + 40, w - 64, 11, true, a);
    return;
  }
  this.portrait(i, px, py, 52, a);

  // latin name in italic serif, the common name after it in the species colour
  textFont(this.serif);
  textStyle(ITALIC);
  textAlign(LEFT, TOP);
  textSize(15);
  fill(this.pale[0], this.pale[1], this.pale[2], 235 * a);
  text(s.latin, tx, y + 4);
  let lw = textWidth(s.latin);
  textStyle(NORMAL);
  textFont(this.sans);
  textSize(11);
  fill(s.col[0], s.col[1], s.col[2], 220 * a);
  text(s.name.toUpperCase(), tx + lw + 10, y + 8);
  this.body(s.blurb, tx, y + 26, w - 64, 11, true, a);
};

// The same on one line, for short screens: no blurb.
Panels.prototype.renderDetailLine = function (i, x, y, w, a) {
  if (i < 0) {
    this.body("Brush a creature with the line to add it to the log.", x, y + 6, w, 11, true, a);
    return;
  }
  let s = speciesList[i];
  let tx = x + 34;
  if (!this.found[i]) {
    this.silhouette(i, x + 12, y + 14, 24, a);
    textFont(this.serif);
    textStyle(ITALIC);
    textAlign(LEFT, TOP);
    textSize(16);
    fill(this.pale[0], this.pale[1], this.pale[2], 200 * a);
    text("?", tx, y + 4);
    textStyle(NORMAL);
    this.body("Not found yet.", tx + 20, y + 8, w - 60, 11, true, a);
    return;
  }
  this.portrait(i, x + 12, y + 14, 24, a);
  textFont(this.serif);
  textStyle(ITALIC);
  textAlign(LEFT, TOP);
  textSize(14);
  fill(this.pale[0], this.pale[1], this.pale[2], 235 * a);
  text(s.latin, tx, y + 5);
  let lw = textWidth(s.latin);
  textStyle(NORMAL);
  textFont(this.sans);
  textSize(10);
  fill(s.col[0], s.col[1], s.col[2], 220 * a);
  text(s.name.toUpperCase(), tx + lw + 10, y + 9);
};

Panels.prototype.renderHelp = function (a) {
  let f = this.frame("help");
  let p = this.pad;
  this.panel(f, a);
  this.title("How to play", f.x + p, f.y + 11, 20, a);
  if (!this.shown.help) return;
  this.body("move the mouse to steer the lure", f.x + p, f.y + 50, f.w - 2 * p, 12, false, a);
  this.body("h hands   m mute   b back up   k set the hour", f.x + p, f.y + 70, f.w - 2 * p, 12, true, a);
};

///////////////////////////////////////////////////////////////////
// Demo scrubber
// A strip under the clock with the hour on a slider. Drag it to see
// the sea at any time of day. "follow the real time" lets it go.
///////////////////////////////////////////////////////////////////

Panels.prototype.renderScrub = function () {
  let s = this.scrubBoxes();
  let p = this.pad;
  if (this.inBox(s.strip)) this.hovering = true;
  this.panel(s.strip, 1);
  this.controls(s.strip, "k", true, 1);

  // the hour being shown
  textFont(this.sans);
  textAlign(LEFT, TOP);
  textSize(11);
  fill(this.pale[0], this.pale[1], this.pale[2], 150);
  text("set the hour", s.strip.x + p, s.strip.y + 8);
  textFont(this.serif);
  textSize(18);
  fill(this.pale[0], this.pale[1], this.pale[2], 235);
  text(tide.clockText(), s.strip.x + p + 78, s.strip.y + 4);

  // the slider: a track with ticks every six hours and a glowing knob
  let t = s.track;
  let ty = t.y + t.h / 2;
  if (this.inBox(t)) this.hot = true;
  stroke(this.pale[0], this.pale[1], this.pale[2], 70);
  strokeWeight(2);
  line(t.x, ty, t.x + t.w, ty);
  strokeWeight(1);
  textFont(this.sans);
  textAlign(CENTER, TOP);
  textSize(9);
  for (let h = 0; h <= 24; h += 6) {
    let x = map(h, 0, 24, t.x, t.x + t.w);
    stroke(this.pale[0], this.pale[1], this.pale[2], 90);
    line(x, ty - 4, x, ty + 4);
    noStroke();
    fill(this.pale[0], this.pale[1], this.pale[2], 110);
    text(h, x, ty + 8);
  }
  let kx = map(tide.hour, 0, 24, t.x, t.x + t.w);
  noStroke();
  fill(this.glow[0], this.glow[1], this.glow[2], 60);
  circle(kx, ty, 22);
  fill(this.glow[0], this.glow[1], this.glow[2], this.dragging ? 255 : 220);
  circle(kx, ty, 11);

  // the way back to the clock
  this.pill(s.follow, "follow the real time", false, 1);
};

// "New: Firefly squid" floats above the guide for a moment.
Panels.prototype.renderToast = function () {
  if (this.toast === null) return;
  let age = millis() - this.toast.at;
  if (age > this.toastMs) {
    this.toast = null;
    return;
  }
  let a = min(1, (this.toastMs - age) / 500) * min(1, age / 200); // in fast, out gently
  a *= this.panelAlpha("guide"); // goes with the guide, so not over the start screen
  if (a <= 0.01) return;
  let f = this.frame("guide");
  textFont(this.sans);
  textSize(13);
  let w = textWidth(this.toast.text) + 32;
  let x = f.x;
  let y = f.y - 44 - 6 * (1 - a);
  stroke(this.glow[0], this.glow[1], this.glow[2], 170 * a);
  strokeWeight(1);
  fill(this.ink[0], this.ink[1], this.ink[2], 210 * a);
  rect(x, y, w, 32, 16);
  noStroke();
  fill(this.glow[0], this.glow[1], this.glow[2], 240 * a);
  textAlign(LEFT, CENTER);
  text(this.toast.text, x + 16, y + 16);
};

///////////////////////////////////////////////////////////////////
// Start screen
// Shown on the surface. Everything sits in the top 70 percent so
// the boat on the waterline stays clear.
///////////////////////////////////////////////////////////////////

Panels.prototype.renderStart = function (a) {
  // a light wash so the text sits on something calm
  noStroke();
  fill(this.ink[0], this.ink[1], this.ink[2], 110 * a);
  rect(0, 0, width, height);

  let cx = width / 2;
  let ty = height * 0.24;
  textFont(this.serif);
  textStyle(NORMAL);
  textAlign(CENTER, CENTER);
  textSize(min(64, width * 0.09)); // *** title size, shrinks on narrow windows
  fill(this.pale[0], this.pale[1], this.pale[2], 245 * a);
  text("The Abyss Listens", cx, ty);

  textFont(this.sans);
  textSize(15);
  fill(this.pale[0], this.pale[1], this.pale[2], 170 * a);
  text("Most animals of the open ocean make their own light.", cx, ty + 68);
  text("Move the cursor to steer the lure. Whatever it disturbs answers.", cx, ty + 92);
  text("The real time of day decides who has risen to meet you.", cx, ty + 116);

  let back = this.returned || this.foundCount > 0;
  if (back) {
    fill(this.glow[0], this.glow[1], this.glow[2], 200 * a);
    textSize(13);
    text(this.foundCount + " of " + speciesList.length + " found", cx, this.boxes.start.y - 26);
  }
  this.pill(this.boxes.start, back ? "Lower the line again" : "Lower the line", true, a);
  if (back) {
    let r = this.boxes.resetLink;
    let hover = this.inBox(r);
    if (hover) this.hot = true;
    textFont(this.sans);
    textAlign(CENTER, TOP);
    textSize(11);
    fill(this.pale[0], this.pale[1], this.pale[2], (hover ? 230 : 120) * a);
    text("Start a new log", cx, r.y + 2);
    let w = textWidth("Start a new log");
    stroke(this.pale[0], this.pale[1], this.pale[2], (hover ? 160 : 70) * a);
    strokeWeight(1);
    line(cx - w / 2, r.y + 15, cx + w / 2, r.y + 15);
    noStroke();
  }
};

///////////////////////////////////////////////////////////////////
// Input
// sketch.js asks here first, and leaves the lure alone when we
// answer true.
///////////////////////////////////////////////////////////////////

Panels.prototype.mousePressed = function () {
  // the start screen only takes clicks once the camera has settled
  if (sea.state === "surface") {
    if (this.inBox(this.boxes.start)) {
      beginDive();
      return true;
    }
    if ((this.returned || this.foundCount > 0) && this.inBox(this.boxes.resetLink)) {
      this.resetUnlocks();
      return true;
    }
  }

  // the scrubber strip, when it is open
  if (this.scrubOpen) {
    let s = this.scrubBoxes();
    if (this.inBox(this.buttonBox(s.strip))) {
      this.scrubOpen = false;
      return true;
    }
    if (this.inBox(s.follow)) {
      tide.setHour(null);
      this.scrubOpen = false;
      return true;
    }
    if (this.inBox(s.track)) {
      this.dragging = true;
      this.updateDrag();
      return true;
    }
    if (this.inBox(s.strip)) return true;
  }

  let names = ["title", "clock", "guide", "help"];
  for (let i = 0; i < names.length; i++) {
    let n = names[i];
    if (this.panelAlpha(n) <= 0.5) continue; // not visible yet, so not clickable
    if (n === "clock" && this.shown.clock) {
      if (this.inBox(this.boxes.soundBtn)) {
        sound.toggleMute();
        return true;
      }
      if (this.inBox(this.boxes.hourLink)) {
        this.scrubOpen = !this.scrubOpen;
        return true;
      }
    }
    if (n === "guide" && this.shown.guide) {
      for (let p = 0; p < this.pages.length; p++) {
        if (this.inBox(this.tabBox(p))) {
          // picking the page for the hour on the clock lets it follow the clock again
          this.tab = p;
          this.tabPinned = p !== this.periodNow();
          return true;
        }
      }
      let list = this.pages[this.tab];
      for (let k = 0; k < list.length; k++) {
        if (this.inBox(this.cellBox(k))) {
          this.selected = list[k];
          return true;
        }
      }
    }
    // the heading, including its round button, toggles the panel
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
  else if (k === "k") this.scrubOpen = !this.scrubOpen;
  else return false;
  return true;
};
