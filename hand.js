/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * hand.js - steering the lure with a hand on the webcam
 *
 * STREAM F owns this file.
 * Uses ml5.js handPose (https://ml5js.org, MIT licence), which runs
 * Google's MediaPipe hand model in the browser. The video never
 * leaves the computer. Adapted from our Jerebu hand.js.
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
//
// STUB: never turns on. Stream F replaces.
///////////////////////////////////////////////////////////////////

function HandInput() {
  this.state = "off";
  this.showVideo = true;
}

HandInput.prototype.start = function () {};

HandInput.prototype.update = function () {};

HandInput.prototype.active = function () {
  return false;
};

HandInput.prototype.render = function () {};
