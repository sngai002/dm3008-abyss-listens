/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * sound.js - one voice per family, and the sound of depth
 *
 * STREAM E owns this file.
 * Uses Tone.js (https://tonejs.github.io, MIT licence) for the synths
 * and effects. p5.sound is not loaded so the two don't share one
 * audio context. The engine is adapted from the sound.js of our
 * earlier project Jerebu (same group, DM3008 2026): the same
 * filter -> delay -> reverb -> limiter chain, scale helpers and the
 * energy feedback value, with new voices for the five families.
 */

///////////////////////////////////////////////////////////////////
// Scale
// A minor pentatonic. Five notes with no semitone clashes, so a
// crowd of creatures striking at once still sounds like one chord.
// A step index counts up the scale: 0 is the root, 5 is the root an
// octave up, negative steps go down.
///////////////////////////////////////////////////////////////////

let scaleSteps = [0, 3, 5, 7, 10]; // *** A minor pentatonic in semitones
let rootNote = 45; // *** scale step 0 as a midi number (45 = A2)

// Scale step index -> midi note. floor() keeps negative steps right.
function stepToMidi(step) {
  let n = scaleSteps.length;
  let octave = floor(step / n);
  let within = step - octave * n;
  return rootNote + octave * 12 + scaleSteps[within];
}

// Same formula p5.sound uses, so we don't need the addon for one function.
function midiToFreq(midi) {
  return 440 * pow(2, (midi - 69) / 12);
}

// The scale step above "step" that is a third (3 or 4 semitones) up,
// for the jelly's dyad. Pentatonic steps are sometimes a second
// apart, so we may have to skip one.
function thirdAbove(step) {
  let root = stepToMidi(step);
  for (let k = 1; k <= 2; k++) {
    let gap = stepToMidi(step + k) - root;
    if (gap === 3 || gap === 4) return step + k;
  }
  return step + 1;
}

///////////////////////////////////////////////////////////////////
// SoundEngine Object
// Interface used by the rest of the sketch:
//   sound.init()            after the first click (browsers block audio before)
//   sound.ready             true once init() has run
//   sound.update()          once a frame, cools the energy down
//   sound.play(creature)    the line struck this creature, true if a note sounded
//   sound.setDepth(m)       m = tide.migration, deeper water is more muffled
//   sound.toggleMute()      the sound button and the "m" key
//   sound.muted
//   sound.energy            how busy the music has been lately. creature.js
//                           can read it for a feedback loop (busy = scatter)
//
// Signal path: five PolySynths (one per family, each through its own
// Panner so notes sit where the creature is) -> lowpass filter ->
// feedback delay -> reverb -> limiter -> master volume. A brown-noise
// rumble joins at the limiter so the sea is never silent.
///////////////////////////////////////////////////////////////////

function SoundEngine() {
  this.ready = false;
  this.muted = false;
  this.energy = 0;
  this.notesThisFrame = 0;

  this.maxNotesPerFrame = 4; // *** hard cap when the lure sweeps through a crowd
  this.gap = [45, 30, 150, 300, 500]; // *** ms between notes of one family
  this.voicesPerNote = [1, 1, 2, 2, 5]; // how many synth voices one strike takes
  this.lastNoteAt = [-1e9, -1e9, -1e9, -1e9, -1e9];
  this.defaultRadius = [3, 7, 30, 40, 20]; // matches the stub Body, for when a creature has none
}

// Builds the chain and the voices. Has to run after Tone.start(),
// which sketch.js calls from the first click.
SoundEngine.prototype.init = function () {
  if (this.ready) return;

  // the shared chain, built from the output back
  this.master = new Tone.Volume(-4).toDestination(); // *** overall level
  this.limiter = new Tone.Limiter(-6).connect(this.master);
  this.reverb = new Tone.Reverb({ decay: 7.5, wet: 0.5 }).connect(this.limiter); // *** the size of the water
  this.delay = new Tone.FeedbackDelay({ delayTime: 0.38, feedback: 0.32, wet: 0.22 }).connect(this.reverb); // *** echo off the deep
  this.filter = new Tone.Filter(2400, "lowpass").connect(this.delay); // setDepth moves this

  // a quiet brown-noise bed, filtered very low, wandering with an LFO
  this.rumbleGain = new Tone.Volume(-34).connect(this.limiter); // *** how loud the sea itself is
  this.rumbleFilter = new Tone.Filter(110, "lowpass").connect(this.rumbleGain);
  this.rumble = new Tone.Noise("brown").connect(this.rumbleFilter);
  this.rumbleLfo = new Tone.LFO(0.05, 60, 180); // *** rate in Hz, then the cutoff range
  this.rumbleLfo.connect(this.rumbleFilter.frequency);
  this.rumble.start();
  this.rumbleLfo.start();

  // *** change the sound of each family here (same order as familyLook)
  this.synths = [
    // 0 - sea sparkle: a short sine chime
    new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.004, decay: 0.22, sustain: 0, release: 0.35 }
    }),
    // 1 - lanternfish: an FM pluck, glassy at the start then plain
    new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 6,
      oscillator: { type: "sine" },
      modulation: { type: "sine" },
      envelope: { attack: 0.003, decay: 0.3, sustain: 0, release: 0.3 },
      modulationEnvelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.2 }
    }),
    // 2 - alarm jelly: a slow AM swell that keeps ringing after the bell pulses
    new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 2,
      oscillator: { type: "sine" },
      modulation: { type: "sine" },
      envelope: { attack: 0.5, decay: 0.6, sustain: 0.5, release: 1.8 },
      modulationEnvelope: { attack: 1.0, decay: 0.5, sustain: 0.3, release: 1.4 }
    }),
    // 3 - sea pen: a bowed pad. the filter envelope opens as the light runs up the stem
    new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: "sawtooth" },
      filter: { type: "lowpass", Q: 1, rolloff: -24 },
      filterEnvelope: { attack: 0.9, decay: 0.6, sustain: 0.4, release: 1.4, baseFrequency: 140, octaves: 2.6 },
      envelope: { attack: 0.8, decay: 0.4, sustain: 0.6, release: 1.6 }
    }),
    // 4 - stoplight dragon: a fat detuned triangle, five notes blooming into a chord
    new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fattriangle", count: 3, spread: 30 },
      envelope: { attack: 0.6, decay: 1.0, sustain: 0.7, release: 2.0 }
    })
  ];

  // past this many voices Tone drops the note and warns, so play()
  // checks for room first and skips the strike instead
  let polyphony = [16, 24, 12, 10, 10]; // *** voices per family, more costs CPU
  let volumes = [-18, -15, -12, -11, -9]; // *** balance between families, in dB

  this.panners = [];
  for (let i = 0; i < this.synths.length; i++) {
    this.synths[i].maxPolyphony = polyphony[i];
    this.synths[i].volume.value = volumes[i];
    let panner = new Tone.Panner(0).connect(this.filter);
    this.synths[i].connect(panner);
    this.panners.push(panner);
  }

  this.ready = true;
};

// migration: 0 (noon, creatures deep) to 1 (midnight, risen).
// By day the water is a muffled wall; at night it opens up and the
// rumble drops back so the notes can carry.
SoundEngine.prototype.setDepth = function (migration) {
  if (!this.ready) return;
  if (frameCount % 30 !== 0) return; // twice a second is plenty for a ramp

  let m = constrain(migration, 0, 1);
  // exponential, because we hear pitch on a log scale
  let cutoff = 1400 * pow(3200 / 1400, m); // *** muffle range, day to night
  this.filter.frequency.rampTo(cutoff, 1);
  this.rumbleGain.volume.rampTo(lerp(-30, -36, m), 1); // *** rumble by day, then by night
};

// Called once a frame, before the creatures check for strikes.
SoundEngine.prototype.update = function () {
  this.notesThisFrame = 0;
  this.energy *= 0.97; // *** how fast the music calms down
};

// Plays the voice for the creature the line just struck.
// Returns false when the note was skipped (not ready, muted, too soon
// after the last note of that family, or too many notes this frame).
SoundEngine.prototype.play = function (creature) {
  if (!this.ready || this.muted) return false;
  if (this.notesThisFrame >= this.maxNotesPerFrame) return false;

  // read the creature carefully, every field may be missing
  let family = 0;
  if (creature && creature.family >= 0 && creature.family < this.synths.length) family = creature.family;
  let x = width / 2;
  let y = height / 2;
  if (creature && creature.position) {
    x = creature.position.x;
    y = creature.position.y;
  }
  let radius = this.defaultRadius[family];
  if (creature && creature.body && creature.body.radius > 0) radius = creature.body.radius;
  let gen = 0;
  if (creature && creature.gen > 0) gen = creature.gen;

  let now = millis();
  if (now - this.lastNoteAt[family] < this.gap[family]) return false;
  // a full synth would drop the note with a warning, so skip it quietly
  let synth = this.synths[family];
  if (synth.activeVoices + this.voicesPerNote[family] > synth.maxPolyphony) return false;
  this.lastNoteAt[family] = now;
  this.notesThisFrame++;
  this.energy += 1;

  // the busier the music, the softer each new note, so a swarm stays comfortable
  let duck = 1 / (1 + this.energy * 0.05); // *** how hard a crowd gets turned down
  let pan = constrain(map(x, 0, width, -0.85, 0.85), -0.85, 0.85);
  this.panners[family].pan.rampTo(pan, 0.02);

  let t = Tone.now();

  if (family === 0) {
    // sea sparkle: small bodies are high, each chain generation climbs and fades
    let step = round(map(radius, 1.5, 6, 15, 10)) + gen * 2;
    let vel = 0.6 * pow(0.65, gen) * duck;
    synth.triggerAttackRelease(midiToFreq(stepToMidi(step)), 0.12, t, vel);
  } else if (family === 1) {
    // lanternfish: higher in the water, higher the note
    let step = round(map(constrain(y / height, 0, 1), 0, 1, 12, 5));
    synth.triggerAttackRelease(midiToFreq(stepToMidi(step)), 0.15, t, 0.7 * duck);
  } else if (family === 2) {
    // alarm jelly: a bigger bell is lower. root and a third above, together
    let step = round(map(radius, 20, 45, 3, -1));
    let notes = [midiToFreq(stepToMidi(step)), midiToFreq(stepToMidi(thirdAbove(step)))];
    synth.triggerAttackRelease(notes, 0.8, t, 0.6 * duck);
  } else if (family === 3) {
    // sea pen: a low root, then its fifth as the light reaches the top of the stem
    let step = round(map(radius, 30, 50, 0, -2));
    let root = stepToMidi(step);
    synth.triggerAttackRelease(midiToFreq(root), 1.4, t, 0.55 * duck);
    synth.triggerAttackRelease(midiToFreq(root + 7), 1.1, t + 0.3, 0.45 * duck);
  } else {
    // stoplight dragon: A1 E2 C3 G3 D4, held, each note a breath after the last
    let chord = [33, 40, 48, 55, 62]; // *** the dragon's chord as midi numbers
    for (let i = 0; i < chord.length; i++) {
      synth.triggerAttackRelease(midiToFreq(chord[i]), 3.0 - i * 0.08, t + i * 0.08, 0.5 * duck);
    }
  }

  return true;
};

// Mutes at the very end of the chain, so the rumble goes quiet too.
SoundEngine.prototype.toggleMute = function () {
  this.muted = !this.muted;
  if (typeof Tone !== "undefined") Tone.Destination.mute = this.muted;
};
