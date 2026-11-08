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
//   hand.start()     turn the camera on (the "h" key), only when asked
//   hand.state       "off", "loading" or "on"
//   hand.update()    once a frame. when a hand is seen, calls
//                    fline.setTarget(x, y) with the fingertip
//   hand.active()    true if a hand was seen recently, so the mouse
//                    and autopilot leave the line alone
//   hand.render()    fingertip marker and a small mirrored camera view
//   hand.showVideo   the "v" key flips this
//
// Hold up one hand: the lure follows your index fingertip. Pinch
// thumb and index together to jig the lure upwards, open to drop it.
// When the hand leaves, the lure eases back to the mouse instead of
// jumping. Reads lastMove from sketch.js to know if the mouse is idle.
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

  this.tip = null; // smoothed index fingertip in canvas pixels, null until seen
  this.lastSeen = -1e9; // ms when a hand was last in frame
  this.pinched = false;
  this.pinch = 1; // thumb to index gap over palm size, for debugging

  this.releasing = false; // easing the target back to the mouse after the hand left
  this.releaseStart = 0;
  this.releaseFrom = { x: 0, y: 0 };

  this.error = ""; // shown for a few seconds when the camera fails
  this.errorUntil = 0;
  this.cameraReadyAt = 0; // ms, the model load timeout counts from here

  this.minSmoothing = 0.35; // *** how much to ease when the hand is still (lower = less jitter)
  this.fastMove = 30; // *** px jump that counts as "fast", no easing at all past this
  this.pinchClose = 0.25; // *** finger gap / palm size that counts as a pinch
  this.pinchOpen = 0.5; // *** has to open past this to count as released
  this.jigLift = 40; // *** px the lure target is pulled up while pinched
  this.lostTime = 400; // *** ms a hand can go missing before the mouse takes over
  this.releaseTime = 600; // *** ms to ease the target back to the mouse
  this.loadTimeout = 20000; // *** ms to wait for the model once the camera is up
  this.errorTime = 5000; // *** ms the error line stays on screen
}

///////////////////////////////////////////////////////////////////
// Starting
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
      if (self.state !== "loading") return;
      self.video = createCapture(constraints, function () {
        self.videoW = self.video.elt.videoWidth || 640;
        self.videoH = self.video.elt.videoHeight || 480;
        self.videoReady = true;
        self.cameraReadyAt = millis();
        self.begin();
      });
      self.video.hide();
    })
    .catch(function (e) {
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
  this.error = message;
  this.errorUntil = millis() + this.errorTime;
};

// Turns the camera off. The model stays loaded for the next start().
HandInput.prototype.stop = function () {
  if (this.model !== null && this.state === "on") this.model.detectStop();
  if (this.video !== null) {
    this.video.remove(); // also stops the camera stream
    this.video = null;
  }
  this.videoReady = false;
  this.results = [];
  this.tip = null;
  this.pinched = false;
  this.state = "off";
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
    // the hand steers, a pinch pulls the lure up so it jerks through a school
    let lift = this.pinched ? this.jigLift : 0;
    fline.setTarget(this.tip.x, this.tip.y - lift);
    return;
  }

  // the hand has gone: hand the lure back gently
  if (this.tip !== null) {
    this.tip = null;
    this.pinched = false;
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
// Drawing
// Screen coordinates, drawn after the world and before the panels:
// a status line while loading or after an error, the fingertip as
// a pale ring, and a small mirrored camera view bottom right.
///////////////////////////////////////////////////////////////////

HandInput.prototype.render = function () {
  push();
  noStroke();
  textAlign(CENTER, BOTTOM);
  textSize(13);

  if (this.state === "off") {
    if (millis() < this.errorUntil) {
      fill(255, 150, 140, 220);
      text("hand tracking: " + this.error, width / 2, height - 24);
    }
    pop();
    return;
  }

  if (this.state === "loading") {
    fill(212, 230, 234, 180);
    text("loading hand tracking... (allow the camera)", width / 2, height - 24);
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

  // the fingertip: a pale ring, brighter and tighter when pinched
  if (this.tip !== null) {
    noFill();
    strokeWeight(this.pinched ? 2 : 1.5);
    stroke(235, 255, 252, this.pinched ? 230 : 130);
    circle(this.tip.x, this.tip.y, this.pinched ? 16 : 24);
    if (this.pinched) {
      // a faint upward tick shows the lure is being lifted
      line(this.tip.x, this.tip.y - 10, this.tip.x, this.tip.y - 10 - this.jigLift * 0.5);
    }
  }
  pop();
};
