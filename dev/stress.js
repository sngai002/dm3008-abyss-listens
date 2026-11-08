/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * dev/stress.js - stream B test harness, not part of the piece
 *
 * Loaded only by dev/stress.html, after everything else. Forces every
 * species to its maximum count whatever the window size, so the fps
 * readout ("d") shows the worst case, about 820 creatures per period
 * and up to two periods alive during a swap.
 */

let rarities = ["common", "uncommon", "rare"];
for (let i = 0; i < rarities.length; i++) {
  rarityCount[rarities[i]].min = rarityCount[rarities[i]].max;
}
planktonCount.min = planktonCount.max;
