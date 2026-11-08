/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * tide.js - the real clock and the daily migration
 *
 * Every night the biggest migration on Earth happens in the sea:
 * animals rise from the deep to feed near the surface, then sink
 * back down before dawn. The clock on the computer drives it here.
 */

///////////////////////////////////////////////////////////////////
// Tide Object
// Reads the real time and turns it into one number, migration,
// which everything else reads: 1 at midnight (creatures risen),
// 0 at noon (creatures deep). It eases so the change is never a jump.
///////////////////////////////////////////////////////////////////

function Tide() {
  this.hour = 0; // 0 to 24, with minutes as a fraction
  this.migration = 1; // eased, 0 (noon) to 1 (midnight)
  this.forceNight = false; // demo switch, see keyPressed in sketch.js
}

// Called once a frame.
Tide.prototype.update = function () {
  let d = new Date();
  this.hour = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;

  let target = this.target();
  this.migration = lerp(this.migration, target, 0.01); // *** how slowly the water changes
};

// Where the migration should be right now, before easing.
Tide.prototype.target = function () {
  if (this.forceNight) return 1;
  let m = 0.5 + 0.5 * cos((this.hour / 24) * TWO_PI); // 1 at midnight, 0 at noon
  return m * m * (3 - 2 * m); // smoothstep, so dusk and dawn are gentle
};

// "23:41"
Tide.prototype.clockText = function () {
  let h = floor(this.hour) % 24;
  let m = floor((this.hour % 1) * 60);
  return nf(h, 2) + ":" + nf(m, 2);
};

// One line about what the creatures are doing at this hour.
Tide.prototype.phaseText = function () {
  let m = this.target();
  if (m > 0.7) return "Night. The creatures have risen to feed.";
  if (m < 0.3) return "Day. Most creatures are sheltering in the deep.";
  if (this.hour >= 12) return "Dusk. The migration is rising toward you.";
  return "Dawn. The migration is sinking back down.";
};

// Helper every creature uses: where it wants to be in the water,
// given its preferred band (0 shallow to 1 deep) and the two depth
// ranges for day and night, as fractions of the canvas height.
// Depths past 1 are below the bottom of the screen, out of reach.
Tide.prototype.depthFor = function (pref, dayRange, nightRange) {
  let day = height * lerp(dayRange[0], dayRange[1], pref);
  let night = height * lerp(nightRange[0], nightRange[1], pref);
  return lerp(day, night, this.migration);
};
