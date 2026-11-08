/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * dev/stress.js - stream B test harness, not part of the piece
 *
 * Forces every family to its maximum count whatever the window size,
 * so the fps readout ("d") shows the worst case: about 600 plankton
 * and 90 lanternfish. Loaded only by dev/stress.html.
 */

for (let f = 0; f < familyBehaviour.length; f++) {
  familyBehaviour[f].min = familyBehaviour[f].max;
}
