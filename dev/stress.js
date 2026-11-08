/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * dev/stress.js - stream B test harness, not part of the piece
 *
 * Loaded only by dev/stress.html, after everything else.
 * 1. Forces every species to its maximum count whatever the window
 *    size, so the fps readout ("d") shows the worst case.
 * 2. Until anatomy.js grows squid and eels, wraps Body so a species
 *    index becomes the nearest old family index (anatomy.js is not
 *    changed). Squid draw as jellies, eels as fish.
 */

let rarities = ["common", "uncommon", "rare"];
for (let i = 0; i < rarities.length; i++) {
  rarityCount[rarities[i]].min = rarityCount[rarities[i]].max;
}
planktonCount.min = planktonCount.max;

let planToFamily = [0, 1, 2, 3, 4, 2, 1];
let RealBody = Body;
Body = function (species, seed) {
  let plan = speciesList[species].plan;
  let b = new RealBody(planToFamily[plan], seed);
  if (plan === 5) b.radius = 14; // a squid-sized target
  if (plan === 6) b.radius = 12; // an eel-sized target
  return b;
};
