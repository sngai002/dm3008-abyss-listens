/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * sound.js - one voice per family, and the sound of depth
 *
 * STREAM E owns this file.
 * Uses Tone.js (https://tonejs.github.io, MIT licence) for the synths
 * and effects. p5.sound is not loaded so the two don't share one
 * audio context.
 */

///////////////////////////////////////////////////////////////////
// SoundEngine Object
// Interface used by the rest of the sketch:
//   sound.init()            after the first click (browsers block audio before)
//   sound.ready             true once init() has run
//   sound.update()          once a frame, cools the energy down
//   sound.play(creature)    the line struck this creature
//   sound.setDepth(m)       m = tide.migration, deeper water is more muffled
//   sound.toggleMute()      the sound button and the "m" key
//   sound.muted
//   sound.energy            how busy the music has been lately. creature.js
//                           can read it for a feedback loop (busy = scatter)
//
// STUB: silent, counts energy only. Stream E replaces.
///////////////////////////////////////////////////////////////////

function SoundEngine() {
  this.ready = false;
  this.muted = false;
  this.energy = 0;
}

SoundEngine.prototype.init = function () {
  this.ready = true;
};

SoundEngine.prototype.update = function () {
  this.energy *= 0.97; // *** how fast the music calms down
};

SoundEngine.prototype.play = function (creature) {
  if (!this.ready || this.muted) return false;
  this.energy += 1;
  return true;
};

SoundEngine.prototype.setDepth = function (migration) {};

SoundEngine.prototype.toggleMute = function () {
  this.muted = !this.muted;
};
