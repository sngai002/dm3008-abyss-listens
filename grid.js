/* DM3008 Generative Art, Final Project 2026
 * The Abyss Listens
 * grid.js - spatial grid for finding neighbours fast
 */

///////////////////////////////////////////////////////////////////
// Grid Object
// Splits the canvas into square cells so each boid only checks the
// boids in its own cell and the 8 cells around it, instead of every
// boid on the canvas (n x n checks gets slow past ~200 boids).
//
// Based on "bin-lattice spatial subdivision" from The Nature of Code
// ch.5 (Daniel Shiffman) and Craig Reynolds' "Interaction with
// Groups of Autonomous Characters" (2000). Our own implementation.
///////////////////////////////////////////////////////////////////

function Grid(cellSize) {
  // cell size should be the same as the biggest neighbour distance,
  // otherwise boids can miss neighbours that are two cells away
  this.cellSize = cellSize;
  this.cells = {};
}

// Empties the grid. Called every frame since the boids keep moving.
Grid.prototype.clear = function () {
  this.cells = {};
};

// Turns a column and row into a key like "4,7".
Grid.prototype.key = function (col, row) {
  return col + "," + row;
};

// Drops a boid into the cell it is currently in.
Grid.prototype.insert = function (boid) {
  let col = floor(boid.position.x / this.cellSize);
  let row = floor(boid.position.y / this.cellSize);
  let k = this.key(col, row);

  if (this.cells[k] === undefined) {
    this.cells[k] = [];
  }
  this.cells[k].push(boid);
};

// Returns all boids in the 3 x 3 block of cells around a position.
Grid.prototype.query = function (position) {
  let col = floor(position.x / this.cellSize);
  let row = floor(position.y / this.cellSize);
  let found = [];

  for (let c = col - 1; c <= col + 1; c++) {
    for (let r = row - 1; r <= row + 1; r++) {
      let cell = this.cells[this.key(c, r)];
      if (cell === undefined) continue;

      for (let i = 0; i < cell.length; i++) {
        found.push(cell[i]);
      }
    }
  }

  return found;
};
