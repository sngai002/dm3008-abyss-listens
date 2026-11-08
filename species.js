/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * species.js - the full list of creatures, shared by every file
 *
 * A body plan is how a creature is built (anatomy.js grows it, sound.js
 * gives it a voice, creature.js moves it). A species is one named
 * variety of a plan: its own colour, size, depth, hours and story.
 * There are 26 species on 7 plans, and the hours are staggered so
 * that whatever the time, at least 22 of them are within reach.
 *
 * Every other file reads this table by species index, so add to the
 * end, never reorder. Fields:
 *   plan     which body plan, index into bodyPlans
 *   col      the glow colour [r, g, b]
 *   size     1 is the plan's normal size, bigger is bigger (and lower pitched)
 *   band     "shallow", "mid" or "deep": where it sits within the plan's depth range
 *   rarity   "common" (schools, or hundreds for plankton), "uncommon" (a few), "rare" (one or two)
 *   hours    null = any time, or [from, to] in hours, wrapping past midnight.
 *            Out of hours a species sinks out of reach, it does not vanish.
 */

// *** add a body plan here only together with a grow function in anatomy.js
let bodyPlans = ["sparkle", "fish", "jelly", "seapen", "dragon", "squid", "eel"];

// *** change a creature's colour, size, depth, hours or story here
let speciesList = [
  // plan 0 - sparkle (plankton)
  { name: "Sea sparkle", latin: "Lucerna minuta", plan: 0, col: [143, 220, 255], size: 1, band: "shallow", rarity: "common", hours: null,
    blurb: "Tiny drifting lights. Touch one and the glow spreads to its neighbours." },
  { name: "Ember dust", latin: "Cinis rubra", plan: 0, col: [255, 170, 110], size: 1.2, band: "mid", rarity: "common", hours: null,
    blurb: "Warmer and slower than sea sparkle. Burns a moment longer." },
  { name: "Rainbow drift", latin: "Pulvis iridis", plan: 0, col: [200, 160, 255], size: 0.8, band: "deep", rarity: "common", hours: null,
    blurb: "The deepest dust. Faint on its own, bright in a chain." },

  // plan 1 - fish (small schooling fish)
  { name: "Lanternfish", latin: "Diaphus errans", plan: 1, col: [95, 243, 216], size: 1, band: "mid", rarity: "common", hours: null,
    blurb: "Schools that scatter from the line. Higher in the water, higher the note." },
  { name: "Blue hatchet", latin: "Securis caerulea", plan: 1, col: [150, 200, 255], size: 0.8, band: "shallow", rarity: "common", hours: null,
    blurb: "Flat silver bodies that hide by glowing the colour of the sky above." },
  { name: "Dusk sardine", latin: "Sardina vesperis", plan: 1, col: [180, 230, 200], size: 0.9, band: "shallow", rarity: "common", hours: null,
    blurb: "Quick and nervous. The first to flee and the first to come back." },
  { name: "Dawn glassfish", latin: "Vitrea aurorae", plan: 1, col: [255, 190, 210], size: 0.85, band: "shallow", rarity: "common", hours: null,
    blurb: "You can see straight through it, except for its lights." },
  { name: "Noon needle", latin: "Acus meridiana", plan: 1, col: [255, 220, 120], size: 1.3, band: "mid", rarity: "uncommon", hours: [8, 20],
    blurb: "Long and gold. Only hunts while the sun is up." },
  { name: "Daylight bristlemouth", latin: "Cyclothone diei", plan: 1, col: [170, 150, 230], size: 0.7, band: "deep", rarity: "common", hours: [8, 20],
    blurb: "The most numerous fish on Earth, and almost nobody has seen one." },

  // plan 2 - jelly
  { name: "Alarm jelly", latin: "Campana tremula", plan: 2, col: [160, 150, 255], size: 1, band: "mid", rarity: "uncommon", hours: null,
    blurb: "Slow pulsing bells with a ring of lights. Deep, slow tones." },
  { name: "Moon jelly", latin: "Luna pellucida", plan: 2, col: [210, 225, 255], size: 1.3, band: "shallow", rarity: "uncommon", hours: null,
    blurb: "Big, pale and patient. Barely minds the line at all." },
  { name: "Crimson comb", latin: "Pecten ruber", plan: 2, col: [255, 90, 130], size: 0.7, band: "deep", rarity: "rare", hours: [18, 6],
    blurb: "A small red bell that only climbs in the dark." },
  { name: "Sun bell", latin: "Campana solis", plan: 2, col: [255, 200, 90], size: 1.1, band: "shallow", rarity: "uncommon", hours: [6, 18],
    blurb: "Follows the daylight down and up again. Gone by nightfall." },

  // plan 3 - sea pen (anchored colonies)
  { name: "Sea pen", latin: "Penna abyssi", plan: 3, col: [255, 200, 120], size: 1, band: "deep", rarity: "uncommon", hours: null,
    blurb: "A colony that grows like a feather. Brush it and the light runs up the stem." },
  { name: "Frost fan", latin: "Flabellum gelidum", plan: 3, col: [170, 230, 255], size: 1.3, band: "deep", rarity: "uncommon", hours: null,
    blurb: "Wide, cold and slow. Its light takes a long time to climb." },
  { name: "Ember whip", latin: "Flagellum igneum", plan: 3, col: [255, 130, 80], size: 0.7, band: "mid", rarity: "rare", hours: null,
    blurb: "A thin hot thread that flares all at once." },

  // plan 4 - dragon (lone predators with a lure)
  { name: "Stoplight dragon", latin: "Draco signalis", plan: 4, col: [255, 77, 94], size: 1, band: "deep", rarity: "rare", hours: [18, 6],
    blurb: "Rare red light that almost nothing else can see. Only rises at night." },
  { name: "Viperfish", latin: "Vipera lucis", plan: 4, col: [120, 255, 200], size: 0.9, band: "deep", rarity: "rare", hours: null,
    blurb: "A fanged hunter with a lure on a long spine. Patient." },
  { name: "Pale angler", latin: "Lampas pallida", plan: 4, col: [255, 240, 180], size: 1.2, band: "deep", rarity: "rare", hours: [6, 18],
    blurb: "Fishes by day with a lamp of its own, and goes dark when you arrive." },

  // plan 5 - squid (jet, mantle lights, two long arms)
  { name: "Firefly squid", latin: "Ignis lolligo", plan: 5, col: [80, 180, 255], size: 0.8, band: "mid", rarity: "uncommon", hours: [20, 8],
    blurb: "Hundreds of blue lights down its arms. Comes up only at night." },
  { name: "Glass squid", latin: "Vitrum lolligo", plan: 5, col: [160, 240, 230], size: 1, band: "mid", rarity: "uncommon", hours: null,
    blurb: "Nearly invisible until it panics, then the whole mantle lights." },
  { name: "Vampire squid", latin: "Umbra lolligo", plan: 5, col: [200, 60, 80], size: 1.3, band: "deep", rarity: "rare", hours: null,
    blurb: "Dark red and unhurried. Turns itself inside out when startled." },

  // plan 6 - eel (long undulating ribbons)
  { name: "Ribbon eel", latin: "Taenia marina", plan: 6, col: [120, 255, 160], size: 1, band: "mid", rarity: "uncommon", hours: null,
    blurb: "A green ribbon that swims in waves. The note bends as it passes." },
  { name: "Silver thread", latin: "Filum argenteum", plan: 6, col: [220, 230, 240], size: 0.7, band: "shallow", rarity: "uncommon", hours: null,
    blurb: "Thin as a line itself. Easy to miss, quick to flash." },
  { name: "Night ribbon", latin: "Taenia noctis", plan: 6, col: [190, 120, 255], size: 1.2, band: "deep", rarity: "rare", hours: [20, 8],
    blurb: "A long violet ribbon that rises after dark." },
  { name: "Gulper", latin: "Faux inflata", plan: 6, col: [90, 110, 200], size: 1.5, band: "deep", rarity: "rare", hours: null,
    blurb: "Mostly mouth. Slow, deep and heavy, with the lowest note of all." }
];

// True if the species is in its hours right now. hour is 0 to 24.
function speciesActive(i, hour) {
  let h = speciesList[i].hours;
  if (h === null) return true;
  if (h[0] < h[1]) return hour >= h[0] && hour < h[1];
  return hour >= h[0] || hour < h[1]; // wraps past midnight
}

// How many species are reachable at a given hour. Used by the debug
// readout and by the guide's counter.
function speciesActiveCount(hour) {
  let n = 0;
  for (let i = 0; i < speciesList.length; i++) {
    if (speciesActive(i, hour)) n++;
  }
  return n;
}
