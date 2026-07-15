// Fixture: multi-declarator var/let/const declarations on a single line.
// Expected violations: stylistic(one-var-declaration-per-line)

const a = 1, b = 2;

let x, y;

let p = 1, q = 2, r = 3;

// for-init position is exempt (parent is ForStatement)
for (let loopIndex = 0, n = 10; loopIndex < n; loopIndex++) {
  void loopIndex;
}

// for-of left position is also exempt (parent is ForOfStatement)
for (const item of [1, 2, 3]) {
  void item;
}

export {
  a,
  b,
  p,
  q,
  r,
  x,
  y,
};
