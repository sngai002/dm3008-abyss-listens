/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * sound.js - one voice per body plan, a note per species, and the sound of depth
 *
 * STREAM E owns this file.
 * Uses Tone.js (https://tonejs.github.io, MIT licence) for the synths
 * and effects. p5.sound is not loaded so the two don't share one
 * audio context. The engine is adapted from the sound.js of our
 * earlier project Jerebu (same group, DM3008 2026): the same
 * filter -> delay -> reverb -> limiter chain, scale helpers and the
 * energy feedback value, with new voices for the seven body plans.
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
// Species pitch
// Every species gets its own note colour: bigger species sit lower
// (about two scale steps down per 0.5 of size above 1, and up below
// it), then a small offset per species keeps siblings of the same
// size apart. The offset table is in speciesList order (species.js).
///////////////////////////////////////////////////////////////////

// *** per-species offset in scale steps, same order as speciesList
let speciesOffset = [
  0, -1, 1, // sparkle: sea sparkle, ember dust, rainbow drift
  0, 1, 1, 2, -1, 3, // fish: lanternfish, blue hatchet, dusk sardine, dawn glassfish, noon needle, bristlemouth
  0, -1, 1, 1, // jelly: alarm, moon, crimson comb, sun bell
  0, -1, 1, // sea pen: sea pen, frost fan, ember whip
  0, 1, -1, // dragon: stoplight, viperfish, pale angler
  1, 0, -1, // squid: firefly, glass, vampire
  0, 2, -1, -4 // eel: ribbon, silver thread, night ribbon, gulper (the lowest note of all)
];
let stepsPerSize = -4; // *** scale steps per 1.0 of size (negative: bigger is lower)

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
// play() reads creature.plan (or .family while Stream B keeps both),
// .species, .position, .body.radius and .gen. All of them may be
// missing: it falls back and never throws.
//
// Signal path: one voice per body plan, each through its own Panner
// so notes sit where the creature is -> lowpass filter -> feedback
// delay -> reverb -> limiter -> master volume. A brown-noise rumble
// joins at the limiter so the sea is never silent.
///////////////////////////////////////////////////////////////////

function SoundEngine() {
  this.ready = false;
  this.muted = false;
  this.energy = 0;
  this.notesThisFrame = 0;

  this.maxNotesPerFrame = 4; // *** hard cap when the lure sweeps through a crowd
  // same order as bodyPlans: sparkle, fish, jelly, seapen, dragon, squid, eel
  this.gap = [45, 30, 150, 300, 500, 60, 250]; // *** ms between notes of one plan
  this.voicesPerNote = [1, 1, 2, 2, 5, 1, 1]; // how many synth voices one strike takes
  this.lastNoteAt = [-1e9, -1e9, -1e9, -1e9, -1e9, -1e9, -1e9];
  this.defaultRadius = [3, 7, 30, 40, 20, 14, 12]; // a normal body per plan, for creatures with no species
  this.eelNext = 0; // which of the eel's gliding voices plays next
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

  // *** change the sound of each body plan here (same order as bodyPlans)
  this.synths = [
    // 0 - sparkle: a short sine chime
    new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.004, decay: 0.22, sustain: 0, release: 0.35 }
    }),
    // 1 - fish: an FM pluck, glassy at the start then plain
    new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 6,
      oscillator: { type: "sine" },
      modulation: { type: "sine" },
      envelope: { attack: 0.003, decay: 0.3, sustain: 0, release: 0.3 },
      modulationEnvelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.2 }
    }),
    // 2 - jelly: a slow AM swell that keeps ringing after the bell pulses
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
    // 4 - dragon: a fat detuned triangle, five notes blooming into a chord
    new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fattriangle", count: 3, spread: 30 },
      envelope: { attack: 0.6, decay: 1.0, sustain: 0.7, release: 2.0 }
    }),
    // 5 - squid: the jet. an inharmonic FM burst, over in a blink (the chime is below)
    new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2.37,
      modulationIndex: 14,
      oscillator: { type: "sine" },
      modulation: { type: "square" },
      envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.15 },
      modulationEnvelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.1 }
    }),
    // 6 - eel: see eelVoices below, this slot keeps the indices lined up
    null
  ];

  // the squid's chime, a sine on top of the jet, through the squid's panner
  this.squidChime = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.004, decay: 0.3, sustain: 0, release: 0.5 }
  });
  this.squidChime.maxPolyphony = 12;
  this.squidChime.volume.value = -20; // *** chime level against the jet

  // the eel bends into its note, which needs a glide on the voice's own
  // frequency, so these are plain Synths taken in turns rather than a PolySynth
  this.eelVoices = [];
  for (let i = 0; i < 3; i++) {
    this.eelVoices.push(new Tone.Synth({
      oscillator: { type: "fatsine", count: 2, spread: 12 },
      envelope: { attack: 0.08, decay: 0.3, sustain: 0.5, release: 0.8 }
    }));
    this.eelVoices[i].volume.value = -12; // *** eel level
  }

  // past this many voices Tone drops the note and warns, so play()
  // checks for room first and skips the strike instead
  let polyphony = [16, 24, 12, 10, 10, 12, 0]; // *** voices per plan, more costs CPU
  let volumes = [-18, -15, -12, -11, -9, -14, 0]; // *** balance between plans, in dB

  this.panners = [];
  for (let i = 0; i < this.synths.length; i++) {
    let panner = new Tone.Panner(0).connect(this.filter);
    this.panners.push(panner);
    if (this.synths[i] === null) continue;
    this.synths[i].maxPolyphony = polyphony[i];
    this.synths[i].volume.value = volumes[i];
    this.synths[i].connect(panner);
  }
  this.squidChime.connect(this.panners[5]);
  for (let i = 0; i < this.eelVoices.length; i++) {
    this.eelVoices[i].connect(this.panners[6]);
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

// Which body plan a creature is, from .plan, else .family (Stream B
// keeps both for one round), else sparkle.
SoundEngine.prototype.planOf = function (creature) {
  let n = this.gap.length;
  if (creature && creature.plan >= 0 && creature.plan < n) return floor(creature.plan);
  if (creature && creature.family >= 0 && creature.family < n) return floor(creature.family);
  return 0;
};

// How far above or below the plan's home note this creature sits,
// in scale steps (unrounded). From its species when it has one,
// else from how big its body is against a normal one of its plan.
SoundEngine.prototype.speciesSteps = function (creature, plan, radius) {
  let hasTable = typeof speciesList !== "undefined";
  if (hasTable && creature && creature.species >= 0 && creature.species < speciesList.length) {
    let sp = speciesList[floor(creature.species)];
    let size = sp && sp.size > 0 ? sp.size : 1;
    let offset = speciesOffset[floor(creature.species)];
    if (offset === undefined) offset = 0;
    return stepsPerSize * (size - 1) + offset;
  }
  let size = radius / this.defaultRadius[plan];
  return constrain(stepsPerSize * (size - 1), -4, 4);
};

// Plays the voice for the creature the line just struck.
// Returns false when the note was skipped (not ready, muted, too soon
// after the last note of that plan, too many notes this frame, or
// the voice is full).
SoundEngine.prototype.play = function (creature) {
  if (!this.ready || this.muted) return false;
  if (this.notesThisFrame >= this.maxNotesPerFrame) return false;

  // read the creature carefully, every field may be missing
  let plan = this.planOf(creature);
  let x = width / 2;
  let y = height / 2;
  if (creature && creature.position) {
    if (creature.position.x === creature.position.x) x = creature.position.x; // NaN check
    if (creature.position.y === creature.position.y) y = creature.position.y;
  }
  let radius = this.defaultRadius[plan];
  if (creature && creature.body && creature.body.radius > 0) radius = creature.body.radius;
  let gen = 0;
  if (creature && creature.gen > 0) gen = floor(creature.gen);

  let now = millis();
  if (now - this.lastNoteAt[plan] < this.gap[plan]) return false;
  // a full synth would drop the note with a warning, so skip it quietly
  let synth = this.synths[plan];
  if (synth !== null && synth.activeVoices + this.voicesPerNote[plan] > synth.maxPolyphony) return false;
  if (plan === 5 && this.squidChime.activeVoices + 1 > this.squidChime.maxPolyphony) return false;
  this.lastNoteAt[plan] = now;
  this.notesThisFrame++;
  this.energy += 1;

  // the busier the music, the softer each new note, so a swarm stays comfortable
  let duck = 1 / (1 + this.energy * 0.05); // *** how hard a crowd gets turned down
  let pan = constrain(map(x, 0, width, -0.85, 0.85), -0.85, 0.85);
  this.panners[plan].pan.rampTo(pan, 0.02);

  let sp = this.speciesSteps(creature, plan, radius);
  let t = Tone.now();

  if (plan === 0) {
    // sparkle: the species sets the note, each chain generation climbs and fades
    let step = round(12 + sp) + gen * 2;
    let vel = 0.6 * pow(0.65, gen) * duck;
    synth.triggerAttackRelease(midiToFreq(stepToMidi(step)), 0.12, t, vel);
  } else if (plan === 1) {
    // fish: higher in the water, higher the note, then the species colour
    let step = round(map(constrain(y / height, 0, 1), 0, 1, 12, 5) + sp);
    synth.triggerAttackRelease(midiToFreq(stepToMidi(step)), 0.15, t, 0.7 * duck);
  } else if (plan === 2) {
    // jelly: root and a third above, together. bigger bells are lower
    let step = round(1 + sp);
    let notes = [midiToFreq(stepToMidi(step)), midiToFreq(stepToMidi(thirdAbove(step)))];
    synth.triggerAttackRelease(notes, 0.8, t, 0.6 * duck);
  } else if (plan === 3) {
    // sea pen: a low root, then its fifth as the light reaches the top of the stem
    let root = stepToMidi(round(-1 + sp));
    synth.triggerAttackRelease(midiToFreq(root), 1.4, t, 0.55 * duck);
    synth.triggerAttackRelease(midiToFreq(root + 7), 1.1, t + 0.3, 0.45 * duck);
  } else if (plan === 4) {
    // dragon: A1 E2 C3 G3 D4 for the stoplight, shifted for its cousins, held, blooming.
    // a note that would fall under A1 moves up an octave instead, so the
    // gulper eel keeps the lowest note in the piece
    let chord = [-5, -2, 1, 4, 7]; // *** the dragon's chord as scale steps
    let shift = round(sp);
    for (let i = 0; i < chord.length; i++) {
      let step = chord[i] + shift;
      if (step < -5) step += 5;
      synth.triggerAttackRelease(midiToFreq(stepToMidi(step)), 3.0 - i * 0.08, t + i * 0.08, 0.5 * duck);
    }
  } else if (plan === 5) {
    // squid: a jet of water (the inharmonic burst) with a chime an octave up
    let step = round(7 + sp);
    synth.triggerAttackRelease(midiToFreq(stepToMidi(step)), 0.08, t, 0.8 * duck);
    this.squidChime.triggerAttackRelease(midiToFreq(stepToMidi(step + 5)), 0.1, t + 0.02, 0.6 * duck);
  } else {
    // eel: bends up three semitones into its note as the body passes the line
    let voice = this.eelVoices[this.eelNext];
    this.eelNext = (this.eelNext + 1) % this.eelVoices.length;
    let target = midiToFreq(stepToMidi(round(sp)));
    let from = midiToFreq(stepToMidi(round(sp)) - 3); // *** how far below the bend starts
    voice.triggerAttackRelease(from, 0.7, t, 0.6 * duck);
    voice.frequency.exponentialRampToValueAtTime(target, t + 0.4); // *** how long the bend takes
  }

  return true;
};

// Mutes at the very end of the chain, so the rumble goes quiet too.
SoundEngine.prototype.toggleMute = function () {
  this.muted = !this.muted;
  if (typeof Tone !== "undefined") Tone.Destination.mute = this.muted;
};
