/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * sound.js - one voice per body plan, a note per species, and the sound of the hour
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
// Every species gets its own note colour without a table, because
// there are a hundred of them: bigger species sit lower (about two
// scale steps down per 0.5 of size above 1, and up below it), then a
// hash of the species index nudges it a step either way so siblings
// of the same size still differ. The hash is seeded, so a species
// always lands on the same note. The giants of a plan (size 1.5 and
// up) always take the low nudge, so "the lowest note of all" in the
// field guide stays true against the dragon's A1.
///////////////////////////////////////////////////////////////////

let stepsPerSize = -4; // *** scale steps per 1.0 of size (negative: bigger is lower)
let pitchSeed = 311.7; // *** change to reshuffle which species sit high or low
// how far above or below its home note a plan is still comfortable, in steps
let planRange = [[-3, 3], [-3, 3], [-3, 3], [-3, 3], [-2, 3], [-3, 3], [-3, 2]];

// A number in 0..1 that is always the same for the same species index.
// The usual sin-and-fract one-liner from GLSL shaders (origin unknown,
// widely used), fine here because we only need it stable, not random.
function speciesHash(i) {
  let h = sin(i * 127.1 + pitchSeed) * 43758.5453;
  return h - floor(h);
}

// -1, 0 or 1 from the hash, so the nudge is always a whole scale step.
function speciesNudge(i) {
  return floor(speciesHash(i) * 3) - 1;
}

///////////////////////////////////////////////////////////////////
// VoicePool Object
// A fixed set of mono synths played in turn. Tone's PolySynth builds
// voices on demand and throws idle ones away again, so a sweep
// through a fresh shoal pays a few milliseconds per voice right
// when the frame is busiest. Building the voices once, during the
// dive, keeps play() cheap and makes a dropped-note warning
// impossible: a pool that is full simply retriggers its oldest voice.
//   make(i)   returns a new Tone synth (Synth, FMSynth, AMSynth, MonoSynth)
///////////////////////////////////////////////////////////////////

function VoicePool(count, make, volume, output) {
  this.voices = [];
  this.started = []; // when each voice last started, Tone insists the next start is later
  this.next = 0;
  for (let i = 0; i < count; i++) {
    let v = make(i);
    v.volume.value = volume;
    v.connect(output);
    this.voices.push(v);
    this.started.push(-1);
  }
}

// Plays one note on the next voice and returns that voice, so the
// caller can bend its frequency afterwards (the eel does).
VoicePool.prototype.trigger = function (freq, duration, time, velocity) {
  let i = this.next;
  this.next = (this.next + 1) % this.voices.length;
  if (time <= this.started[i]) time = this.started[i] + 0.001;
  this.started[i] = time;
  this.voices[i].triggerAttackRelease(freq, duration, time, velocity);
  return this.voices[i];
};

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
// Signal path: one VoicePool per body plan, each through its own
// Panner so notes sit where the creature is -> lowpass filter ->
// feedback delay -> reverb -> limiter -> master volume. A brown-noise
// rumble joins at the limiter so the sea is never silent.
///////////////////////////////////////////////////////////////////

function SoundEngine() {
  this.ready = false;
  this.muted = false;
  this.energy = 0;
  this.notesThisFrame = 0;

  this.maxNotesPerFrame = 4; // *** hard cap when the lure sweeps through a crowd
  // same order as bodyPlans: sparkle, fish, jelly, seapen, dragon, squid, eel
  this.gap = [45, 30, 150, 300, 500, 60, 250]; // *** ms between notes of one plan
  this.lastNoteAt = [-1e9, -1e9, -1e9, -1e9, -1e9, -1e9, -1e9];
  this.defaultRadius = [3, 7, 30, 40, 20, 14, 12]; // a normal body per plan, for creatures with no species
  this.pools = [null, null, null, null, null, null, null]; // one VoicePool per plan, built one a frame after init()
  this.chime = null; // the squid's second pool, a sine on top of the jet
  this.building = []; // pools still to build, see update()
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

  // one panner per plan, the pools plug into these as they are built
  this.panners = [];
  for (let i = 0; i < this.pools.length; i++) {
    this.panners.push(new Tone.Panner(0).connect(this.filter));
  }

  // *** change the sound of each body plan here (same order as bodyPlans).
  // Each entry is built on its own frame by update(), so the click that
  // starts the dive never stalls. count = voices, then the volume in dB.
  let self = this;
  this.building = [
    // 0 - sparkle: a short sine chime
    { plan: 0, count: 12, volume: -18, make: function () {
      return new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.004, decay: 0.22, sustain: 0, release: 0.35 }
      });
    } },
    // 1 - fish: an FM pluck, glassy at the start then plain
    { plan: 1, count: 16, volume: -15, make: function () {
      return new Tone.FMSynth({
        harmonicity: 3,
        modulationIndex: 6,
        oscillator: { type: "sine" },
        modulation: { type: "sine" },
        envelope: { attack: 0.003, decay: 0.3, sustain: 0, release: 0.3 },
        modulationEnvelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.2 }
      });
    } },
    // 2 - jelly: a slow AM swell that keeps ringing after the bell pulses (two voices a hit)
    { plan: 2, count: 8, volume: -12, make: function () {
      return new Tone.AMSynth({
        harmonicity: 2,
        oscillator: { type: "sine" },
        modulation: { type: "sine" },
        envelope: { attack: 0.5, decay: 0.6, sustain: 0.5, release: 1.8 },
        modulationEnvelope: { attack: 1.0, decay: 0.5, sustain: 0.3, release: 1.4 }
      });
    } },
    // 3 - sea pen: a bowed pad. the filter envelope opens as the light runs up the stem (two voices a hit)
    { plan: 3, count: 6, volume: -11, make: function () {
      return new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        filter: { type: "lowpass", Q: 1, rolloff: -24 },
        filterEnvelope: { attack: 0.9, decay: 0.6, sustain: 0.4, release: 1.4, baseFrequency: 140, octaves: 2.6 },
        envelope: { attack: 0.8, decay: 0.4, sustain: 0.6, release: 1.6 }
      });
    } },
    // 4 - dragon: a fat detuned triangle, five voices blooming into a chord
    { plan: 4, count: 10, volume: -9, make: function () {
      return new Tone.Synth({
        oscillator: { type: "fattriangle", count: 3, spread: 30 },
        envelope: { attack: 0.6, decay: 1.0, sustain: 0.7, release: 2.0 }
      });
    } },
    // 5 - squid: the jet. an inharmonic FM burst, over in a blink (the chime is below)
    { plan: 5, count: 6, volume: -14, make: function () {
      return new Tone.FMSynth({
        harmonicity: 2.37,
        modulationIndex: 14,
        oscillator: { type: "sine" },
        modulation: { type: "square" },
        envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.15 },
        modulationEnvelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.1 }
      });
    } },
    // 5 again - the squid's chime, a sine on top of the jet, through the squid's panner
    { plan: 5, chime: true, count: 6, volume: -20, make: function () {
      return new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.004, decay: 0.3, sustain: 0, release: 0.5 }
      });
    } },
    // 6 - eel: a smooth voice that bends into its note, see play()
    { plan: 6, count: 3, volume: -12, make: function () {
      return new Tone.Synth({
        oscillator: { type: "fatsine", count: 2, spread: 12 },
        envelope: { attack: 0.08, decay: 0.3, sustain: 0.5, release: 0.8 }
      });
    } }
  ];

  this.ready = true;
};

// The feel of each period of the day, all subtle. Same order as
// dayPeriods in species.js: morning, afternoon, evening, night.
// *** change how the hour colours the sound here
let periodFeel = [
  { bright: 1.0, delay: 0.38, reverb: 0.6 }, // morning: wettest, like a wide calm sea at dawn
  { bright: 1.15, delay: 0.34, reverb: 0.45 }, // afternoon: a touch brighter and drier
  { bright: 0.95, delay: 0.42, reverb: 0.5 }, // evening: a little darker, the echo starts to stretch
  { bright: 1.0, delay: 0.5, reverb: 0.55 } // night: the longest echo off the deep
];

// migration: 0 (noon, creatures deep) to 1 (midnight, risen).
// By day the water is a muffled wall; at night it opens up and the
// rumble drops back so the notes can carry. On top of that the
// period of the day (species.js) tints the filter, delay and reverb.
SoundEngine.prototype.setDepth = function (migration) {
  if (!this.ready) return;
  if (frameCount % 30 !== 0) return; // twice a second is plenty for a ramp

  let m = constrain(migration, 0, 1);
  if (m !== m) m = 1; // NaN guard
  let feel = this.feelNow(m);

  // exponential, because we hear pitch on a log scale
  let cutoff = 1400 * pow(3200 / 1400, m) * feel.bright; // *** muffle range, day to night
  this.filter.frequency.rampTo(cutoff, 1);
  this.rumbleGain.volume.rampTo(lerp(-30, -36, m), 1); // *** rumble by day, then by night
  this.delay.delayTime.rampTo(feel.delay, 1);
  this.reverb.wet.rampTo(feel.reverb, 1);
};

// The feel for the current period. Reads periodOf(tide.hour) when
// species.js and the tide are there, else guesses from migration.
SoundEngine.prototype.feelNow = function (migration) {
  let index = 3;
  if (typeof periodOf === "function" && typeof dayPeriods !== "undefined" && typeof tide !== "undefined" && tide && tide.hour >= 0) {
    index = dayPeriods.indexOf(periodOf(tide.hour));
  } else {
    index = migration > 0.5 ? 3 : 1; // deep water means night, shallow means afternoon
  }
  if (index < 0 || index >= periodFeel.length) index = 3;
  return periodFeel[index];
};

// Called once a frame, before the creatures check for strikes.
// Also builds one voice pool a frame until all are there, so the
// first seconds of the dive carry the cost instead of the first strike.
SoundEngine.prototype.update = function () {
  this.notesThisFrame = 0;
  this.energy *= 0.97; // *** how fast the music calms down

  if (this.building.length > 0) {
    let b = this.building.shift();
    let pool = new VoicePool(b.count, b.make, b.volume, this.panners[b.plan]);
    if (b.chime) this.chime = pool;
    else this.pools[b.plan] = pool;
  }
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
// in scale steps (whole). From its species when it has one, else from
// its own size, else from how big its body is against a normal one.
SoundEngine.prototype.speciesSteps = function (creature, plan, radius) {
  let hasTable = typeof speciesList !== "undefined";
  let size = 1;
  let nudge = 0;
  if (hasTable && creature && creature.species >= 0 && creature.species < speciesList.length) {
    let i = floor(creature.species);
    let sp = speciesList[i];
    if (sp && sp.size > 0) size = sp.size;
    nudge = speciesNudge(i);
    if (size >= 1.5) nudge = -1; // the giants keep the lowest note of their plan
  } else if (creature && creature.size > 0) {
    size = creature.size;
  } else {
    size = radius / this.defaultRadius[plan];
  }
  let steps = round(stepsPerSize * (size - 1) + nudge);
  return constrain(steps, planRange[plan][0], planRange[plan][1]);
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
  let pool = this.pools[plan];
  if (pool === null) return false; // still being built, a few frames after init()
  if (plan === 5 && this.chime === null) return false;
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
    let step = 12 + sp + gen * 2;
    let vel = 0.6 * pow(0.65, gen) * duck;
    pool.trigger(midiToFreq(stepToMidi(step)), 0.12, t, vel);
  } else if (plan === 1) {
    // fish: higher in the water, higher the note, then the species colour
    let step = round(map(constrain(y / height, 0, 1), 0, 1, 12, 5)) + sp;
    pool.trigger(midiToFreq(stepToMidi(step)), 0.15, t, 0.7 * duck);
  } else if (plan === 2) {
    // jelly: root and a third above, together. bigger bells are lower
    let step = 1 + sp;
    pool.trigger(midiToFreq(stepToMidi(step)), 0.8, t, 0.6 * duck);
    pool.trigger(midiToFreq(stepToMidi(thirdAbove(step))), 0.8, t, 0.6 * duck);
  } else if (plan === 3) {
    // sea pen: a low root, then its fifth as the light reaches the top of the stem
    let root = stepToMidi(-1 + sp);
    pool.trigger(midiToFreq(root), 1.4, t, 0.55 * duck);
    pool.trigger(midiToFreq(root + 7), 1.1, t + 0.3, 0.45 * duck);
  } else if (plan === 4) {
    // dragon: A1 E2 C3 G3 D4 for the stoplight, shifted for its cousins, held, blooming.
    // a note that would fall under A1 moves up an octave instead, so the
    // gulper eel keeps the lowest note in the piece
    let chord = [-5, -2, 1, 4, 7]; // *** the dragon's chord as scale steps
    let shift = sp;
    for (let i = 0; i < chord.length; i++) {
      let step = chord[i] + shift;
      if (step < -5) step += 5;
      pool.trigger(midiToFreq(stepToMidi(step)), 3.0 - i * 0.08, t + i * 0.08, 0.5 * duck);
    }
  } else if (plan === 5) {
    // squid: a jet of water (the inharmonic burst) with a chime an octave up
    let step = 7 + sp;
    pool.trigger(midiToFreq(stepToMidi(step)), 0.08, t, 0.8 * duck);
    this.chime.trigger(midiToFreq(stepToMidi(step + 5)), 0.1, t + 0.02, 0.6 * duck);
  } else {
    // eel: bends up three semitones into its note as the body passes the line.
    // home is E2, low enough that the giants land under the dragon's A1
    let target = midiToFreq(stepToMidi(-3 + sp));
    let from = midiToFreq(stepToMidi(-3 + sp) - 3); // *** how far below the bend starts
    let voice = pool.trigger(from, 0.7, t, 0.6 * duck);
    voice.frequency.exponentialRampToValueAtTime(target, t + 0.4); // *** how long the bend takes
  }

  return true;
};

// Mutes at the very end of the chain, so the rumble goes quiet too.
SoundEngine.prototype.toggleMute = function () {
  this.muted = !this.muted;
  if (typeof Tone !== "undefined") Tone.Destination.mute = this.muted;
};
