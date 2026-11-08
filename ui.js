/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * ui.js - everything written or clickable on top of the sea
 *
 * STREAM D owns this file. All of it is drawn with p5 (text, rect,
 * circle), there is no HTML. Panels are hit-tested by rectangle in
 * mousePressed(). Everything can be hidden and shown again with a
 * click on its heading or a key.
 */

///////////////////////////////////////////////////////////////////
// Panels Object
// Interface used by sketch.js (screen coordinates, drawn last):
//   ui.render()            title, clock panel, field guide, sound button,
//                          and the start button while sea.state is "surface"
//   ui.mousePressed()      returns true if the click landed on a panel,
//                          so the sketch does not move the lure
//   ui.keyPressed(key)     returns true if the key toggled something
//   ui.toggle(name)        "guide", "clock", "title", "help"
//   ui.shown[name]         which panels are open
//
// Panels read: tide.clockText(), tide.phaseText(), familyLook[],
// sound.ready / sound.muted, sea.state. The start button calls
// sea.begin() and sound.init().
//
// STUB: start button and a bare clock. Stream D replaces.
///////////////////////////////////////////////////////////////////

function Panels() {
  this.shown = { title: true, clock: true, guide: true, help: true };
  this.startBox = { x: 0, y: 0, w: 220, h: 48 };
}

Panels.prototype.toggle = function (name) {
  this.shown[name] = !this.shown[name];
};

Panels.prototype.render = function () {
  push();
  noStroke();

  if (sea.state === "surface") {
    this.startBox.x = width / 2 - this.startBox.w / 2;
    this.startBox.y = height * 0.62;
    fill(95, 243, 216);
    rect(this.startBox.x, this.startBox.y, this.startBox.w, this.startBox.h, 24);
    fill(3, 32, 27);
    textAlign(CENTER, CENTER);
    textSize(15);
    text("Lower the line", width / 2, this.startBox.y + this.startBox.h / 2);

    fill(212, 230, 234);
    textSize(44);
    text("The Abyss Listens", width / 2, height * 0.38);
  }

  if (this.shown.clock) {
    fill(212, 230, 234);
    textAlign(RIGHT, TOP);
    textSize(32);
    text(tide.clockText(), width - 20, 20);
    textSize(13);
    fill(212, 230, 234, 160);
    text(tide.phaseText(), width - 20, 60);
  }
  pop();
};

Panels.prototype.inBox = function (b) {
  return mouseX > b.x && mouseX < b.x + b.w && mouseY > b.y && mouseY < b.y + b.h;
};

Panels.prototype.mousePressed = function () {
  if (sea.state === "surface" && this.inBox(this.startBox)) {
    beginDive();
    return true;
  }
  return false;
};

Panels.prototype.keyPressed = function (k) {
  if (k === "g") this.toggle("guide");
  else if (k === "t") this.toggle("clock");
  else if (k === "i") this.toggle("help");
  else return false;
  return true;
};
