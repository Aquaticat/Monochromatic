// Fixture: destructured properties on the same line.
// Expected violations: stylistic(destructure-per-line)

const point = { x: 1, y: 2, z: 3 };
const { x, y, z } = point;

void x;
void y;
void z;

export {};
