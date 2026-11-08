/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * species.js - the full list of creatures, shared by every file
 *
 * A body plan is how a creature is built (anatomy.js grows it, sound.js
 * gives it a voice, creature.js moves it). A species is one named
 * variety of a plan: its own colour, size, depth, period and story.
 *
 * The day has four periods and each has its own 25 species, so a
 * player who comes at any hour can find 25, and a player who comes
 * back at another time of day finds a different 25. 100 in all.
 *   morning    05:00 to 11:00   pinks, golds, pale greens
 *   afternoon  11:00 to 17:00   bright blues, greens, white
 *   evening    17:00 to 22:00   amber, violet, copper
 *   night      22:00 to 05:00   deep blues, reds, star white
 *
 * Every other file reads this table by species index, so add to the
 * end of a period's block, never reorder. Fields:
 *   period   "morning", "afternoon", "evening" or "night"
 *   plan     which body plan, index into bodyPlans
 *   col      the glow colour [r, g, b]
 *   size     1 is the plan's normal size, bigger is bigger (and lower pitched)
 *   band     "shallow", "mid" or "deep": where it sits within the plan's depth range
 *   rarity   "common" (schools, or hundreds for plankton), "uncommon" (a few), "rare" (one or two)
 */

// *** add a body plan here only together with a grow function in anatomy.js
let bodyPlans = ["sparkle", "fish", "jelly", "seapen", "dragon", "squid", "eel"];

// *** the periods of the day and when each starts, in hours
let dayPeriods = ["morning", "afternoon", "evening", "night"];
let periodStarts = [5, 11, 17, 22];

// *** change a creature's colour, size, depth or story here
let speciesList = [
  // ---------- morning ----------
  { period: "morning", plan: 0, name: "Dawn sparkle", latin: "Lucerna aurorae", col: [255, 210, 225], size: 1, band: "shallow", rarity: "common", blurb: "Pale pink dust that wakes with the light." },
  { period: "morning", plan: 0, name: "Rose dust", latin: "Pulvis roseus", col: [255, 170, 190], size: 1.2, band: "mid", rarity: "common", blurb: "Slow and warm. Burns a moment longer than most." },
  { period: "morning", plan: 0, name: "Gold motes", latin: "Aurum minutum", col: [255, 225, 150], size: 0.8, band: "deep", rarity: "common", blurb: "Faint on its own, bright in a chain." },
  { period: "morning", plan: 1, name: "Dawn glassfish", latin: "Vitrea aurorae", col: [255, 190, 210], size: 0.85, band: "shallow", rarity: "common", blurb: "You can see straight through it, except for its lights." },
  { period: "morning", plan: 1, name: "Blue hatchet", latin: "Securis caerulea", col: [150, 200, 255], size: 0.8, band: "shallow", rarity: "common", blurb: "Flat silver bodies that glow the colour of the sky above." },
  { period: "morning", plan: 1, name: "Morning herring", latin: "Clupea matutina", col: [200, 230, 230], size: 0.9, band: "mid", rarity: "common", blurb: "Tight schools that turn as one." },
  { period: "morning", plan: 1, name: "Pink lantern", latin: "Diaphus roseus", col: [255, 160, 200], size: 1, band: "mid", rarity: "common", blurb: "A lanternfish in dawn colours. Pitched by depth." },
  { period: "morning", plan: 1, name: "Sunrise needle", latin: "Acus orta", col: [255, 210, 120], size: 1.3, band: "mid", rarity: "uncommon", blurb: "Long and gold. Hunts the first hour of light." },
  { period: "morning", plan: 1, name: "Pearl anchovy", latin: "Engraulis margarita", col: [235, 235, 245], size: 0.7, band: "shallow", rarity: "uncommon", blurb: "Tiny and quick. Flashes white when startled." },
  { period: "morning", plan: 2, name: "Moon jelly", latin: "Luna pellucida", col: [210, 225, 255], size: 1.3, band: "shallow", rarity: "uncommon", blurb: "Big, pale and patient. Barely minds the line." },
  { period: "morning", plan: 2, name: "Blush bell", latin: "Campana rubens", col: [255, 170, 200], size: 1, band: "mid", rarity: "uncommon", blurb: "A soft pink bell with a slow pulse." },
  { period: "morning", plan: 2, name: "Mist comb", latin: "Pecten nebulae", col: [220, 235, 240], size: 0.8, band: "deep", rarity: "uncommon", blurb: "Rows of tiny lights ripple down its sides." },
  { period: "morning", plan: 2, name: "Lace medusa", latin: "Medusa textilis", col: [255, 220, 235], size: 0.7, band: "mid", rarity: "rare", blurb: "Fine as lace. Easy to tear, so it stays away." },
  { period: "morning", plan: 3, name: "Frost fan", latin: "Flabellum gelidum", col: [170, 230, 255], size: 1.3, band: "deep", rarity: "uncommon", blurb: "Wide, cold and slow. Its light takes a long time to climb." },
  { period: "morning", plan: 3, name: "Coral quill", latin: "Penna corallina", col: [255, 150, 140], size: 1, band: "deep", rarity: "uncommon", blurb: "A red feather that blushes brighter when brushed." },
  { period: "morning", plan: 3, name: "Pale reed", latin: "Arundo pallida", col: [230, 240, 220], size: 0.7, band: "mid", rarity: "rare", blurb: "A thin pale stem that flares all at once." },
  { period: "morning", plan: 4, name: "Pale angler", latin: "Lampas pallida", col: [255, 240, 180], size: 1.2, band: "deep", rarity: "rare", blurb: "Fishes with a lamp of its own, and goes dark when you arrive." },
  { period: "morning", plan: 4, name: "Dawn viper", latin: "Vipera aurorae", col: [255, 180, 160], size: 0.9, band: "deep", rarity: "rare", blurb: "Fanged and patient, with a lure on a long spine." },
  { period: "morning", plan: 4, name: "Rosy lantern-eye", latin: "Oculus roseus", col: [255, 140, 170], size: 1, band: "mid", rarity: "rare", blurb: "A pink light under each eye that it can switch off." },
  { period: "morning", plan: 5, name: "Glass squid", latin: "Vitrum lolligo", col: [160, 240, 230], size: 1, band: "mid", rarity: "uncommon", blurb: "Nearly invisible until it panics, then the whole mantle lights." },
  { period: "morning", plan: 5, name: "Pink reef squid", latin: "Lolligo rosea", col: [255, 170, 210], size: 0.9, band: "shallow", rarity: "uncommon", blurb: "Ripples colour down its fins as it turns." },
  { period: "morning", plan: 5, name: "Morning dart", latin: "Sagitta matutina", col: [255, 220, 180], size: 0.7, band: "mid", rarity: "rare", blurb: "Small and fast. Jets away before you reach it." },
  { period: "morning", plan: 6, name: "Silver thread", latin: "Filum argenteum", col: [220, 230, 240], size: 0.7, band: "shallow", rarity: "uncommon", blurb: "Thin as a line itself. Easy to miss, quick to flash." },
  { period: "morning", plan: 6, name: "Dawn ribbon", latin: "Taenia aurorae", col: [255, 190, 180], size: 1, band: "mid", rarity: "uncommon", blurb: "A pink ribbon that swims in waves. The note bends as it passes." },
  { period: "morning", plan: 6, name: "Pearl eel", latin: "Anguilla margarita", col: [240, 240, 255], size: 1.3, band: "deep", rarity: "rare", blurb: "A long pale eel with the lowest note of the morning." },
  // ---------- afternoon ----------
  { period: "afternoon", plan: 0, name: "Sea sparkle", latin: "Lucerna minuta", col: [143, 220, 255], size: 1, band: "shallow", rarity: "common", blurb: "Tiny drifting lights. Touch one and the glow spreads." },
  { period: "afternoon", plan: 0, name: "Sun motes", latin: "Pulvis solis", col: [255, 240, 170], size: 1.1, band: "mid", rarity: "common", blurb: "Specks of daylight caught in the water." },
  { period: "afternoon", plan: 0, name: "Green fleck", latin: "Macula viridis", col: [170, 255, 190], size: 0.8, band: "deep", rarity: "common", blurb: "Green dust that drifts just out of the light." },
  { period: "afternoon", plan: 1, name: "Lanternfish", latin: "Diaphus errans", col: [95, 243, 216], size: 1, band: "mid", rarity: "common", blurb: "Schools that scatter from the line. Higher up, higher the note." },
  { period: "afternoon", plan: 1, name: "Noon needle", latin: "Acus meridiana", col: [255, 220, 120], size: 1.3, band: "mid", rarity: "uncommon", blurb: "Long and gold. Only hunts while the sun is high." },
  { period: "afternoon", plan: 1, name: "Daylight bristlemouth", latin: "Cyclothone diei", col: [170, 150, 230], size: 0.7, band: "deep", rarity: "common", blurb: "The most numerous fish on Earth, and almost nobody has seen one." },
  { period: "afternoon", plan: 1, name: "Azure sardine", latin: "Sardina azurea", col: [120, 200, 255], size: 0.9, band: "shallow", rarity: "common", blurb: "Quick and nervous. The first to flee and the first back." },
  { period: "afternoon", plan: 1, name: "Mirror scad", latin: "Speculum natans", col: [230, 240, 250], size: 1, band: "shallow", rarity: "common", blurb: "Flashes the sky back at you." },
  { period: "afternoon", plan: 1, name: "Jade minnow", latin: "Jaspis parva", col: [140, 255, 200], size: 0.7, band: "mid", rarity: "uncommon", blurb: "Tiny green schools that hide in the shafts of light." },
  { period: "afternoon", plan: 2, name: "Sun bell", latin: "Campana solis", col: [255, 200, 90], size: 1.1, band: "shallow", rarity: "uncommon", blurb: "Follows the daylight down and up again." },
  { period: "afternoon", plan: 2, name: "Sky medusa", latin: "Medusa caeli", col: [150, 210, 255], size: 1, band: "mid", rarity: "uncommon", blurb: "Blue bell, blue lights. Hard to see against the day." },
  { period: "afternoon", plan: 2, name: "Crystal comb", latin: "Pecten crystallinus", col: [220, 250, 255], size: 0.8, band: "mid", rarity: "uncommon", blurb: "Clear as glass, with rainbow rows of beating hairs." },
  { period: "afternoon", plan: 2, name: "White drifter", latin: "Vagans alba", col: [245, 245, 245], size: 1.4, band: "deep", rarity: "rare", blurb: "Huge and slow. One pulse a minute." },
  { period: "afternoon", plan: 3, name: "Sea pen", latin: "Penna abyssi", col: [255, 200, 120], size: 1, band: "deep", rarity: "uncommon", blurb: "A colony that grows like a feather. Brush it and the light runs up the stem." },
  { period: "afternoon", plan: 3, name: "Kelp quill", latin: "Penna algae", col: [150, 230, 150], size: 1.2, band: "mid", rarity: "uncommon", blurb: "Green fronds that sway with the schools." },
  { period: "afternoon", plan: 3, name: "Emerald fan", latin: "Flabellum smaragdinum", col: [90, 230, 170], size: 0.8, band: "deep", rarity: "rare", blurb: "A small bright fan that holds its light a long time." },
  { period: "afternoon", plan: 4, name: "Viperfish", latin: "Vipera lucis", col: [120, 255, 200], size: 0.9, band: "deep", rarity: "rare", blurb: "A fanged hunter with a lure on a long spine. Patient." },
  { period: "afternoon", plan: 4, name: "Noon angler", latin: "Lampas meridiana", col: [255, 235, 150], size: 1.2, band: "deep", rarity: "rare", blurb: "Keeps its lamp on even in daylight, just in case." },
  { period: "afternoon", plan: 4, name: "Glass dragon", latin: "Draco vitreus", col: [200, 240, 255], size: 1, band: "mid", rarity: "rare", blurb: "Almost clear. Only the beam gives it away." },
  { period: "afternoon", plan: 5, name: "Reef squid", latin: "Lolligo scopuli", col: [180, 255, 220], size: 1, band: "shallow", rarity: "uncommon", blurb: "Hangs in a row with its friends, then scatters." },
  { period: "afternoon", plan: 5, name: "Sky squid", latin: "Lolligo caeli", col: [140, 200, 255], size: 0.9, band: "mid", rarity: "uncommon", blurb: "Blue on blue. Flashes white when the line comes near." },
  { period: "afternoon", plan: 5, name: "Day dart", latin: "Sagitta diei", col: [255, 250, 200], size: 0.7, band: "mid", rarity: "rare", blurb: "Small and fast. Jets away before you reach it." },
  { period: "afternoon", plan: 6, name: "Ribbon eel", latin: "Taenia marina", col: [120, 255, 160], size: 1, band: "mid", rarity: "uncommon", blurb: "A green ribbon that swims in waves. The note bends as it passes." },
  { period: "afternoon", plan: 6, name: "Jade eel", latin: "Anguilla jaspis", col: [100, 220, 180], size: 1.2, band: "deep", rarity: "uncommon", blurb: "Darker and slower than the ribbon. A longer bend." },
  { period: "afternoon", plan: 6, name: "Gulper", latin: "Faux inflata", col: [90, 110, 200], size: 1.5, band: "deep", rarity: "rare", blurb: "Mostly mouth. Slow, deep and heavy, with the lowest note of all." },
  // ---------- evening ----------
  { period: "evening", plan: 0, name: "Ember dust", latin: "Cinis rubra", col: [255, 170, 110], size: 1.2, band: "mid", rarity: "common", blurb: "Warm and slow. Burns a moment longer." },
  { period: "evening", plan: 0, name: "Dusk motes", latin: "Pulvis vesperis", col: [255, 200, 160], size: 1, band: "shallow", rarity: "common", blurb: "Orange specks that catch the last light." },
  { period: "evening", plan: 0, name: "Copper glint", latin: "Cuprum micans", col: [230, 150, 90], size: 0.8, band: "deep", rarity: "common", blurb: "Deep copper dust. Faint until a chain reaches it." },
  { period: "evening", plan: 1, name: "Dusk sardine", latin: "Sardina vesperis", col: [180, 230, 200], size: 0.9, band: "shallow", rarity: "common", blurb: "Quick and nervous. The first to flee and the first back." },
  { period: "evening", plan: 1, name: "Amber lantern", latin: "Diaphus ambra", col: [255, 190, 100], size: 1, band: "mid", rarity: "common", blurb: "A lanternfish in sunset colours. Pitched by depth." },
  { period: "evening", plan: 1, name: "Violet hatchet", latin: "Securis violacea", col: [200, 160, 255], size: 0.8, band: "shallow", rarity: "common", blurb: "Flat bodies that glow violet as the sky does." },
  { period: "evening", plan: 1, name: "Sunset scad", latin: "Occasus natans", col: [255, 150, 110], size: 1, band: "mid", rarity: "common", blurb: "Schools that turn orange, then grey, as the light goes." },
  { period: "evening", plan: 1, name: "Twilight needle", latin: "Acus crepusculi", col: [255, 160, 140], size: 1.3, band: "mid", rarity: "uncommon", blurb: "Long and rust red. Hunts the hour after sunset." },
  { period: "evening", plan: 1, name: "Rust anchovy", latin: "Engraulis ferrugo", col: [230, 130, 90], size: 0.7, band: "shallow", rarity: "uncommon", blurb: "Tiny and quick. Flashes copper when startled." },
  { period: "evening", plan: 2, name: "Alarm jelly", latin: "Campana tremula", col: [160, 150, 255], size: 1, band: "mid", rarity: "uncommon", blurb: "Slow pulsing bells with a ring of lights. Deep, slow tones." },
  { period: "evening", plan: 2, name: "Amber bell", latin: "Campana ambra", col: [255, 200, 110], size: 1.1, band: "shallow", rarity: "uncommon", blurb: "Glows like a lamp in a window." },
  { period: "evening", plan: 2, name: "Violet comb", latin: "Pecten violaceus", col: [190, 140, 255], size: 0.8, band: "deep", rarity: "uncommon", blurb: "Rows of violet lights ripple down its sides." },
  { period: "evening", plan: 2, name: "Dusk medusa", latin: "Medusa vesperis", col: [255, 140, 120], size: 0.7, band: "mid", rarity: "rare", blurb: "A small red bell that only climbs as the light goes." },
  { period: "evening", plan: 3, name: "Ember whip", latin: "Flagellum igneum", col: [255, 130, 80], size: 0.7, band: "mid", rarity: "rare", blurb: "A thin hot thread that flares all at once." },
  { period: "evening", plan: 3, name: "Copper quill", latin: "Penna cuprea", col: [230, 160, 100], size: 1, band: "deep", rarity: "uncommon", blurb: "A copper feather. The light climbs it slowly." },
  { period: "evening", plan: 3, name: "Dusk fan", latin: "Flabellum vesperis", col: [200, 140, 200], size: 1.3, band: "deep", rarity: "uncommon", blurb: "Wide and violet. Holds its light a long time." },
  { period: "evening", plan: 4, name: "Twilight dragon", latin: "Draco crepusculi", col: [255, 120, 100], size: 1, band: "deep", rarity: "rare", blurb: "Rises with the dusk, red beam first." },
  { period: "evening", plan: 4, name: "Amber angler", latin: "Lampas ambra", col: [255, 200, 120], size: 1.2, band: "deep", rarity: "rare", blurb: "An orange lamp on a spine, swinging slowly." },
  { period: "evening", plan: 4, name: "Copper viper", latin: "Vipera cuprea", col: [230, 150, 110], size: 0.9, band: "deep", rarity: "rare", blurb: "Fanged and patient, in sunset colours." },
  { period: "evening", plan: 5, name: "Sunset squid", latin: "Lolligo occasus", col: [255, 170, 130], size: 1, band: "mid", rarity: "uncommon", blurb: "Ripples orange down its fins as it turns." },
  { period: "evening", plan: 5, name: "Violet dart", latin: "Sagitta violacea", col: [200, 150, 255], size: 0.7, band: "mid", rarity: "rare", blurb: "Small and fast. Jets away before you reach it." },
  { period: "evening", plan: 5, name: "Ember squid", latin: "Lolligo ignea", col: [255, 140, 90], size: 0.9, band: "shallow", rarity: "uncommon", blurb: "Flashes the whole mantle red when startled." },
  { period: "evening", plan: 6, name: "Dusk ribbon", latin: "Taenia vesperis", col: [255, 180, 150], size: 1, band: "mid", rarity: "uncommon", blurb: "An orange ribbon that swims in waves. The note bends as it passes." },
  { period: "evening", plan: 6, name: "Amber eel", latin: "Anguilla ambra", col: [240, 190, 120], size: 1.2, band: "deep", rarity: "uncommon", blurb: "Darker and slower. A longer bend." },
  { period: "evening", plan: 6, name: "Violet thread", latin: "Filum violaceum", col: [210, 170, 255], size: 0.7, band: "shallow", rarity: "rare", blurb: "Thin as a line itself. Easy to miss, quick to flash." },
  // ---------- night ----------
  { period: "night", plan: 0, name: "Rainbow drift", latin: "Pulvis iridis", col: [200, 160, 255], size: 0.8, band: "deep", rarity: "common", blurb: "The deepest dust. Faint on its own, bright in a chain." },
  { period: "night", plan: 0, name: "Midnight sparkle", latin: "Lucerna noctis", col: [120, 200, 255], size: 1, band: "shallow", rarity: "common", blurb: "Blue dust that fills the dark water." },
  { period: "night", plan: 0, name: "Blue ash", latin: "Cinis caerulea", col: [150, 170, 255], size: 1.2, band: "mid", rarity: "common", blurb: "Slow blue flakes. Burn a moment longer." },
  { period: "night", plan: 1, name: "Midnight bristlemouth", latin: "Cyclothone noctis", col: [170, 150, 230], size: 0.7, band: "deep", rarity: "common", blurb: "The most numerous fish on Earth, up for the night." },
  { period: "night", plan: 1, name: "Night lantern", latin: "Diaphus noctis", col: [95, 243, 216], size: 1, band: "mid", rarity: "common", blurb: "Schools that scatter from the line. Higher up, higher the note." },
  { period: "night", plan: 1, name: "Star hatchet", latin: "Securis stellata", col: [220, 230, 255], size: 0.8, band: "shallow", rarity: "common", blurb: "Flat bodies that glow like the stars above." },
  { period: "night", plan: 1, name: "Deep sardine", latin: "Sardina profunda", col: [120, 180, 230], size: 0.9, band: "mid", rarity: "common", blurb: "Quick and nervous. The first to flee and the first back." },
  { period: "night", plan: 1, name: "Ghost needle", latin: "Acus larva", col: [230, 240, 255], size: 1.3, band: "mid", rarity: "uncommon", blurb: "Long and pale. Hunts in the dark hours." },
  { period: "night", plan: 1, name: "Ink minnow", latin: "Atramentum parvum", col: [90, 110, 200], size: 0.7, band: "deep", rarity: "uncommon", blurb: "So dark it is only its lights." },
  { period: "night", plan: 2, name: "Crimson comb", latin: "Pecten ruber", col: [255, 90, 130], size: 0.7, band: "deep", rarity: "rare", blurb: "A small red bell that only climbs in the dark." },
  { period: "night", plan: 2, name: "Night bell", latin: "Campana noctis", col: [130, 150, 255], size: 1, band: "mid", rarity: "uncommon", blurb: "Blue bell, blue ring of lights. Deep, slow tones." },
  { period: "night", plan: 2, name: "Star medusa", latin: "Medusa stellata", col: [230, 235, 255], size: 1.1, band: "shallow", rarity: "uncommon", blurb: "Pale and patient, with lights like a constellation." },
  { period: "night", plan: 2, name: "Black drifter", latin: "Vagans atra", col: [120, 100, 180], size: 1.4, band: "deep", rarity: "uncommon", blurb: "Huge and slow. One pulse a minute." },
  { period: "night", plan: 3, name: "Night quill", latin: "Penna noctis", col: [150, 170, 255], size: 1, band: "deep", rarity: "uncommon", blurb: "A blue feather. Brush it and the light runs up the stem." },
  { period: "night", plan: 3, name: "Blue fan", latin: "Flabellum caeruleum", col: [110, 200, 255], size: 1.3, band: "deep", rarity: "uncommon", blurb: "Wide, cold and slow. Its light takes a long time to climb." },
  { period: "night", plan: 3, name: "Shadow reed", latin: "Arundo umbrae", col: [170, 140, 220], size: 0.7, band: "mid", rarity: "rare", blurb: "A thin violet stem that flares all at once." },
  { period: "night", plan: 4, name: "Stoplight dragon", latin: "Draco signalis", col: [255, 77, 94], size: 1, band: "deep", rarity: "rare", blurb: "Rare red light that almost nothing else can see." },
  { period: "night", plan: 4, name: "Black angler", latin: "Lampas atra", col: [200, 210, 255], size: 1.2, band: "deep", rarity: "rare", blurb: "A white lamp on a spine, and nothing else to see." },
  { period: "night", plan: 4, name: "Midnight viper", latin: "Vipera noctis", col: [120, 255, 200], size: 0.9, band: "deep", rarity: "rare", blurb: "Fanged and patient, with a lure on a long spine." },
  { period: "night", plan: 5, name: "Firefly squid", latin: "Ignis lolligo", col: [80, 180, 255], size: 0.8, band: "mid", rarity: "uncommon", blurb: "Hundreds of blue lights down its arms." },
  { period: "night", plan: 5, name: "Vampire squid", latin: "Umbra lolligo", col: [200, 60, 80], size: 1.3, band: "deep", rarity: "rare", blurb: "Dark red and unhurried. Turns itself inside out when startled." },
  { period: "night", plan: 5, name: "Night dart", latin: "Sagitta noctis", col: [180, 220, 255], size: 0.7, band: "mid", rarity: "uncommon", blurb: "Small and fast. Jets away before you reach it." },
  { period: "night", plan: 6, name: "Night ribbon", latin: "Taenia noctis", col: [190, 120, 255], size: 1.2, band: "deep", rarity: "uncommon", blurb: "A long violet ribbon that rises after dark." },
  { period: "night", plan: 6, name: "Abyss eel", latin: "Anguilla abyssi", col: [90, 110, 200], size: 1.5, band: "deep", rarity: "rare", blurb: "Mostly mouth. Slow, deep and heavy, with the lowest note of all." },
  { period: "night", plan: 6, name: "Shadow thread", latin: "Filum umbrae", col: [160, 170, 230], size: 0.7, band: "shallow", rarity: "uncommon", blurb: "Thin as a line itself. Easy to miss, quick to flash." }
];

// Which period an hour (0 to 24) falls in.
function periodOf(hour) {
  let p = dayPeriods[dayPeriods.length - 1]; // before the first start it is still night
  for (let i = 0; i < periodStarts.length; i++) {
    if (hour >= periodStarts[i]) p = dayPeriods[i];
  }
  return p;
}

// True if the species belongs to the period this hour is in.
function speciesActive(i, hour) {
  return speciesList[i].period === periodOf(hour);
}

// How many species are reachable at a given hour: always 25.
// Kept so the debug readout and the guide can count without knowing that.
function speciesActiveCount(hour) {
  let n = 0;
  for (let i = 0; i < speciesList.length; i++) {
    if (speciesActive(i, hour)) n++;
  }
  return n;
}

// The species indices of one period, in table order. The guide uses
// this for its four pages.
function speciesOfPeriod(period) {
  let list = [];
  for (let i = 0; i < speciesList.length; i++) {
    if (speciesList[i].period === period) list.push(i);
  }
  return list;
}
