/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * hand.js - steering the lure with a hand on the webcam
 *
 * STREAM F owns this file.
 * Uses ml5.js handPose (https://ml5js.org, MIT licence), which runs
 * Google's MediaPipe hand model in the browser. The video never
 * leaves the computer.
 *
 * Adapted from our Jerebu project's hand.js (DM3008, 2026): the
 * mirrored camera, the adaptive "follow" smoothing, the object-fit
 * cover mapping in toCanvas() and the pinch detection are ported
 * from there. In Jerebu a hand held a string; here it holds the line.
 */

///////////////////////////////////////////////////////////////////
// HandInput Object
// Interface used by sketch.js:
//   hand.start()     turn the camera on, only when asked
//   hand.toggle()    the "h" key: on when off, off when loading or on
//   hand.state       "off", "loading" or "on"
//   hand.update()    once a frame. when a hand is seen, calls
//                    fline.setTarget(x, y) with the fingertip
//   hand.active()    true if a hand was seen recently, so the mouse
//                    and autopilot leave the line alone
//   hand.gesture()   "dive" once after a hand is held low on the
//                    start screen, "surface" once after it is held
//                    high under water, null otherwise
//   hand.render()    fingertip marker, hints, a small mirrored camera view
//   hand.showVideo   the "v" key flips this
//
// Hold up one hand: the lure follows your index fingertip. Pinch
// thumb and index together to jig the lure upwards, open to drop it.
// When the hand leaves, the lure eases back to the mouse instead of
// jumping. Reads lastMove from sketch.js to know if the mouse is idle,
// sea.state to know which hold gesture makes sense, and ui.frame()
// to keep its text off the panels.
///////////////////////////////////////////////////////////////////

function HandInput() {
  this.state = "off"; // "off", "loading" or "on"
  this.showVideo = true;

  this.video = null; // p5 capture, only made in start()
  this.model = null; // ml5 handPose, loaded once and kept between starts
  this.modelReady = false;
  this.videoReady = false;
  this.videoW = 640; // real camera size, read once the stream is up
  this.videoH = 480;
  this.results = []; // latest hands from ml5, usually 0 or 1
  this.session = 0; // counts starts, so a stale camera callback is ignored

  this.tip = null; // smoothed index fingertip in canvas pixels, null until seen
  this.lastSeen = -1e9; // ms when a hand was last in frame
  this.pinched = false;
  this.pinch = 1; // thumb to index gap over palm size, for debugging

  this.releasing = false; // easing the target back to the mouse after the hand left
  this.releaseStart = 0;
  this.releaseFrom = { x: 0, y: 0 };

  this.band = null; // "low", "high" or null: which edge band the fingertip is held in
  this.bandSince = 0; // ms when it entered that band
  this.bandFired = false; // the hold already fired, wait for the hand to leave the band
  this.pending = null; // "dive" or "surface", handed over once by gesture()

  this.status = ""; // one line at the bottom: errors, "hand tracking off"
  this.statusUntil = 0;
  this.statusIsError = false;
  this.cameraReadyAt = 0; // ms, the model load timeout counts from here

  this.minSmoothing = 0.35; // *** how much to ease when the hand is still (lower = less jitter)
  this.fastMove = 30; // *** px jump that counts as "fast", no easing at all past this
  this.pinchClose = 0.25; // *** finger gap / palm size that counts as a pinch
  this.pinchOpen = 0.5; // *** has to open past this to count as released
  this.jigLift = 40; // *** px the lure target is pulled up while pinched
  this.lostTime = 400; // *** ms a hand can go missing before the mouse takes over
  this.releaseTime = 600; // *** ms to ease the target back to the mouse
  this.lowBand = 0.15; // *** bottom part of the screen (fraction) that counts as "held low"
  this.highBand = 0.12; // *** top part of the screen (fraction) that counts as "held high"
  this.holdTime = 600; // *** ms the fingertip has to stay in a band to fire
  this.loadTimeout = 20000; // *** ms to wait for the model once the camera is up
  this.errorTime = 5000; // *** ms an error line stays on screen
  this.noteTime = 2000; // *** ms a plain status line stays on screen
}

///////////////////////////////////////////////////////////////////
// Starting and stopping
// Camera and model load side by side, tracking begins once both
// are ready. Nothing here runs until the "h" key is pressed, so
// mouse users never see a camera prompt.
///////////////////////////////////////////////////////////////////

HandInput.prototype.start = function () {
  if (this.state !== "off") return;

  if (typeof ml5 === "undefined") {
    this.fail("hand tracking library did not load (check the connection)");
    return;
  }
  // getUserMedia only exists on https or localhost
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
    this.fail("the camera needs https or localhost");
    return;
  }

  this.state = "loading";
  this.videoReady = false;
  this.results = [];
  this.session++;
  let session = this.session;
  let self = this;

  // p5's createCapture only logs when the camera fails, it never
  // calls back, so ask for the camera ourselves first to catch
  // "no camera" and "permission denied", then let p5 open it.
  let constraints = { video: { width: 640, height: 480, facingMode: "user" }, audio: false };
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(function (stream) {
      // permission is granted now, so p5's own request below is instant
      let tracks = stream.getTracks();
      for (let i = 0; i < tracks.length; i++) tracks[i].stop();
      // toggled off (or off and on again) while the prompt was up
      if (self.state !== "loading" || self.session !== session) return;
      self.video = createCapture(constraints, function () {
        if (self.session !== session || self.video === null) return;
        self.videoW = self.video.elt.videoWidth || 640;
        self.videoH = self.video.elt.videoHeight || 480;
        self.videoReady = true;
        self.cameraReadyAt = millis();
        self.begin();
      });
      self.video.hide();
    })
    .catch(function (e) {
      if (self.session !== session) return;
      if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") self.fail("no camera found");
      else if (e.name === "NotAllowedError") self.fail("camera permission was denied");
      else self.fail("the camera could not start");
    });

  if (this.model === null) {
    // flipped so moving your hand right moves the lure right, like a mirror
    this.model = ml5.handPose({ maxHands: 1, flipped: true, modelType: "lite" }, function () {
      self.modelReady = true;
      self.begin();
    });
  }
};

// The "h" key: on when off, off when loading or on.
HandInput.prototype.toggle = function () {
  if (this.state === "off") {
    this.start();
    return;
  }
  this.stop();
  this.say("hand tracking off", false);
};

// Called when the camera or the model is ready, starts once both are.
HandInput.prototype.begin = function () {
  if (this.state !== "loading" || !this.videoReady || !this.modelReady) return;
  let self = this;
  this.model.detectStart(this.video, function (results) {
    self.results = results;
  });
  this.state = "on";
};

// Something went wrong, go back to "off" and say why for a while.
HandInput.prototype.fail = function (message) {
  this.stop();
  this.say(message, true);
};

// Turns the camera off and forgets the hand. The model stays loaded
// so the next start() is instant.
HandInput.prototype.stop = function () {
  if (this.model !== null && this.state === "on") this.model.detectStop();
  if (this.video !== null) {
    this.video.remove(); // also stops the camera stream
    this.video = null;
  }
  this.session++; // any camera callback still in flight is now stale
  this.videoReady = false;
  this.results = [];
  this.tip = null;
  this.lastSeen = -1e9;
  this.pinched = false;
  this.releasing = false;
  this.band = null;
  this.bandFired = false;
  this.pending = null;
  this.state = "off";
};

// One line at the bottom of the screen for a while.
HandInput.prototype.say = function (message, isError) {
  this.status = message;
  this.statusIsError = isError;
  this.statusUntil = millis() + (isError ? this.errorTime : this.noteTime);
};

///////////////////////////////////////////////////////////////////
// Steering
// Once a frame. The smoothed fingertip becomes the lure target,
// lifted while pinched. After the hand leaves, the target eases
// back towards the mouse so control changes hands without a jump.
///////////////////////////////////////////////////////////////////

HandInput.prototype.update = function () {
  if (this.state === "loading") {
    // the camera is up but the model never arrived (offline?)
    if (this.videoReady && !this.modelReady && millis() - this.cameraReadyAt > this.loadTimeout) {
      this.fail("hand tracking did not load (check the connection)");
    }
    return;
  }
  if (this.state !== "on") return;

  if (this.results.length > 0) {
    let h = this.results[0];
    let index = this.toCanvas(h.index_finger_tip);

    // first sighting snaps, after that the easing keeps it steady
    if (this.tip === null) this.tip = index;
    else this.tip = this.follow(this.tip, index);

    // dividing by the palm size means a pinch looks the same
    // whether your hand is near the camera or far away
    let palm = dist(h.wrist.x, h.wrist.y, h.index_finger_mcp.x, h.index_finger_mcp.y);
    let gap = dist(h.thumb_tip.x, h.thumb_tip.y, h.index_finger_tip.x, h.index_finger_tip.y);
    this.pinch = gap / max(palm, 1);

    // two thresholds so a half-open hand does not flicker between states
    if (!this.pinched && this.pinch < this.pinchClose) this.pinched = true;
    else if (this.pinched && this.pinch > this.pinchOpen) this.pinched = false;

    this.lastSeen = millis();
    this.releasing = false;
  }

  let since = millis() - this.lastSeen;

  if (since < this.lostTime && this.tip !== null) {
    this.watchBands();
    // on the start screen the line hangs from the boat, same as with the mouse
    if (this.seaState() === "surface") return;
    // the hand steers, a pinch pulls the lure up so it jerks through a school
    let lift = this.pinched ? this.jigLift : 0;
    fline.setTarget(this.tip.x, this.tip.y - lift);
    return;
  }

  // the hand has gone: hand the lure back gently
  if (this.tip !== null) {
    this.tip = null;
    this.pinched = false;
    this.band = null;
    this.bandFired = false;
    this.releasing = true;
    this.releaseStart = millis();
    this.releaseFrom = { x: fline.tx, y: fline.ty };
  }

  if (this.releasing) {
    let u = constrain((millis() - this.releaseStart) / this.releaseTime, 0, 1);
    u = u * u * (3 - 2 * u); // ease in and out
    // when the mouse is idle leave the lure where it is, autopilot drifts from there
    let mouseIdle = typeof lastMove === "number" && millis() - lastMove > 7000;
    if (!mouseIdle) {
      fline.setTarget(lerp(this.releaseFrom.x, mouseX, u), lerp(this.releaseFrom.y, mouseY, u));
    }
    if (u >= 1) this.releasing = false;
  }
};

// True while the hand is steering or easing back, so sketch.js
// leaves the target alone.
HandInput.prototype.active = function () {
  if (this.state !== "on") return false;
  return millis() - this.lastSeen < this.lostTime || this.releasing;
};

// Moves a point towards where the tracking says it is.
// A fixed amount of easing either jitters (too little) or lags (too much).
// So ease a lot when the hand is nearly still, where the jitter shows,
// and barely at all when it moves fast, where the lag shows.
// A simple version of the "1 Euro filter" (Casiez, Roussel & Vogel, 2012).
HandInput.prototype.follow = function (current, target) {
  let moved = dist(current.x, current.y, target.x, target.y);
  let amount = constrain(map(moved, 0, this.fastMove, this.minSmoothing, 1), this.minSmoothing, 1);
  return { x: lerp(current.x, target.x, amount), y: lerp(current.y, target.y, amount) };
};

// ml5 gives points in video pixels. The video is stretched to cover
// the whole canvas (cropping the sides or top), same as
// "object-fit: cover" in CSS, so the fingertip can reach every edge.
HandInput.prototype.toCanvas = function (point) {
  let s = max(width / this.videoW, height / this.videoH);
  let offX = (width - this.videoW * s) / 2;
  let offY = (height - this.videoH * s) / 2;
  return { x: point.x * s + offX, y: point.y * s + offY };
};

///////////////////////////////////////////////////////////////////
// Hold gestures
// A fingertip kept low on the start screen lowers the line, kept
// high under water it brings the line back up. Each hold fires
// once, then the hand has to leave the band before it can fire again.
///////////////////////////////////////////////////////////////////

// sea.state, or "under" if there is no sea yet.
HandInput.prototype.seaState = function () {
  if (typeof sea === "undefined" || !sea.state) return "under";
  return sea.state;
};

// Which band the fingertip is in right now, counting only the band
// that means something in the current sea state, so fishing near
// the bottom never starts a dive countdown.
HandInput.prototype.bandAt = function (y) {
  let s = this.seaState();
  if (s === "surface" && y > height * (1 - this.lowBand)) return "low";
  if (s === "under" && y < height * this.highBand) return "high";
  return null;
};

// Called while a hand is steering. Times how long the fingertip
// has stayed in a band and fires once when it has been long enough.
HandInput.prototype.watchBands = function () {
  let b = this.bandAt(this.tip.y);
  if (b !== this.band) {
    this.band = b;
    this.bandSince = millis();
    this.bandFired = false;
  }
  if (b !== null && !this.bandFired && millis() - this.bandSince >= this.holdTime) {
    this.pending = b === "low" ? "dive" : "surface";
    this.bandFired = true;
  }
};

// 0 to 1 while a hold is counting, 0 otherwise.
HandInput.prototype.holdProgress = function () {
  if (this.band === null || this.bandFired) return 0;
  return constrain((millis() - this.bandSince) / this.holdTime, 0, 1);
};

// sketch.js calls this once a frame and acts on the answer.
HandInput.prototype.gesture = function () {
  let g = this.pending;
  this.pending = null;
  return g;
};

///////////////////////////////////////////////////////////////////
// Drawing
// Screen coordinates, drawn after the world and before the panels:
// a status line at the bottom, the fingertip as a pale ring with a
// hint and a hold arc, and a small mirrored camera view bottom right.
///////////////////////////////////////////////////////////////////

HandInput.prototype.render = function () {
  push();
  noStroke();
  textSize(13);

  if (this.state === "off") {
    if (millis() < this.statusUntil) {
      if (this.statusIsError) {
        fill(255, 150, 140, 220);
        this.statusLine("hand tracking: " + this.status);
      } else {
        fill(212, 230, 234, 180);
        this.statusLine(this.status);
      }
    }
    pop();
    return;
  }

  if (this.state === "loading") {
    fill(212, 230, 234, 180);
    this.statusLine("loading hand tracking... (allow the camera)");
    pop();
    return;
  }

  // the camera view, mirrored to match the flipped hand points and
  // tinted the colour of the water so it sits quietly in the corner
  if (this.showVideo && this.videoReady) {
    let w = 160;
    let h = 120;
    // the help panel lives in this corner too, so the preview sits above it
    let bottom = height - 20;
    if (typeof ui !== "undefined" && ui.frame) bottom = ui.frame("help").y - 12;
    push();
    translate(width - 20, bottom - h);
    scale(-1, 1);
    tint(143, 220, 255, 110);
    image(this.video, 0, 0, w, h);
    pop();
    noFill();
    stroke(143, 220, 255, 60);
    strokeWeight(1);
    rect(width - 20 - w, bottom - h, w, h);
    if (this.tip === null) {
      noStroke();
      fill(212, 230, 234, 140);
      textAlign(RIGHT, BOTTOM);
      text("show a hand", width - 20, bottom - 4 - h);
    }
  }

  if (this.tip !== null) this.renderTip();
  pop();
};

// The fingertip: a pale ring, brighter and tighter when pinched,
// with the hold arc and a hint when a hold gesture is on offer.
HandInput.prototype.renderTip = function () {
  let x = this.tip.x;
  let y = this.tip.y;
  let r = this.pinched ? 8 : 12;

  noFill();
  strokeWeight(this.pinched ? 2 : 1.5);
  stroke(235, 255, 252, this.pinched ? 230 : 130);
  circle(x, y, r * 2);
  if (this.pinched) {
    // a faint upward tick shows the lure is being lifted
    line(x, y - 10, x, y - 10 - this.jigLift * 0.5);
  }

  // the hold counting up around the ring
  let p = this.holdProgress();
  if (p > 0) {
    stroke(95, 243, 216, 230);
    strokeWeight(2);
    arc(x, y, r * 2 + 10, r * 2 + 10, -HALF_PI, -HALF_PI + TWO_PI * p);
  }

  // what a hold would do here, shown while it is possible
  let s = this.seaState();
  let hint = null;
  if (s === "surface") hint = "hold low to lower the line";
  else if (s === "under" && y < height * this.highBand * 2) hint = "hold here to come back up";
  if (hint !== null) this.renderHint(hint, x, y, r + 8, p);
};

// Short text beside the ring, on whichever side keeps it on screen
// and off the panels. The panels are drawn after us, so when the
// fingertip is under one the hint moves just outside that panel and
// carries its own thin progress line, since the ring is covered.
HandInput.prototype.renderHint = function (msg, x, y, r, p) {
  let w = textWidth(msg) + 12;
  let h = 18;
  let gap = 10;
  // right, left, below, above of the ring, first one that fits wins
  let spots = [
    { x: x + r + gap, y: y - h / 2 },
    { x: x - r - gap - w, y: y - h / 2 },
    { x: x - w / 2, y: y + r + gap },
    { x: x - w / 2, y: y - r - gap - h }
  ];
  let panels = this.panels();
  for (let i = 0; i < panels.length; i++) {
    let f = panels[i];
    if (x < f.x || x > f.x + f.w || y < f.y || y > f.y + f.h) continue;
    spots.push({ x: f.x + f.w + gap, y: y - h / 2 });
    spots.push({ x: f.x - gap - w, y: y - h / 2 });
    spots.push({ x: x - w / 2, y: f.y + f.h + gap });
    spots.push({ x: x - w / 2, y: f.y - gap - h });
  }
  let spot = spots[0];
  for (let i = 0; i < spots.length; i++) {
    if (this.clear(spots[i].x, spots[i].y, w, h)) {
      spot = spots[i];
      break;
    }
  }
  noStroke();
  fill(3, 8, 18, 150);
  rect(spot.x, spot.y, w, h, 6);
  fill(212, 230, 234, 220);
  textAlign(LEFT, CENTER);
  text(msg, spot.x + 6, spot.y + h / 2);
  if (p > 0) {
    stroke(95, 243, 216, 230);
    strokeWeight(2);
    line(spot.x + 4, spot.y + h, spot.x + 4 + (w - 8) * p, spot.y + h);
  }
};

// True if a box is on screen and not over a visible panel.
HandInput.prototype.clear = function (x, y, w, h) {
  if (x < 4 || y < 4 || x + w > width - 4 || y + h > height - 4) return false;
  let panels = this.panels();
  for (let i = 0; i < panels.length; i++) {
    let f = panels[i];
    if (x < f.x + f.w && x + w > f.x && y < f.y + f.h && y + h > f.y) return false;
  }
  return true;
};

// The rectangles of the panels showing right now, from ui.js.
HandInput.prototype.panels = function () {
  let out = [];
  if (typeof ui === "undefined" || !ui.frame || !ui.boxes) return out;
  let names = ["title", "clock", "guide", "help"];
  for (let i = 0; i < names.length; i++) {
    if (!ui.boxes[names[i]]) continue;
    if (ui.panelAlpha && ui.panelAlpha(names[i]) <= 0.01) continue;
    out.push(ui.frame(names[i]));
  }
  return out;
};

// The status line: centred at the bottom edge when the gap between
// the field guide and the help panel is wide enough, else just above them.
HandInput.prototype.statusLine = function (msg) {
  let y = height - 24;
  let panels = this.panels();
  let top = height;
  for (let i = 0; i < panels.length; i++) {
    let f = panels[i];
    if (f.y + f.h < height * 0.5) continue; // top panels do not matter here
    let overlapsX = width / 2 + textWidth(msg) / 2 + 10 > f.x && width / 2 - textWidth(msg) / 2 - 10 < f.x + f.w;
    if (overlapsX) top = min(top, f.y);
  }
  if (top < height) y = top - 10;
  textAlign(CENTER, BOTTOM);
  text(msg, width / 2, y);
};
