// Fixture: nested binary/logical expressions with mixed operators and no parens.
// Expected violations: stylistic(no-mixed-operators)

const a = 1;
const b = 2;
const c = 3;
const x = true;
const y = false;
const z = true;

// Mixed arithmetic precedence
const r1 = a + b * c;

// Mixed logical precedence
const r2 = x || y && z;

// Mixed comparison + logical
const r3 = a === b || c === 1;

// Mixed bitwise + arithmetic
const r4 = a & b + c;

// Logical and-or mix
const r5 = x && y || z;

export {
  r1,
  r2,
  r3,
  r4,
  r5,
};
