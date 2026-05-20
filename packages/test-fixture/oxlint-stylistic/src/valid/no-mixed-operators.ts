// Fixture: same-operator chains and explicitly parenthesised mixed operators.
// Expected: zero stylistic rule violations.

const a = 1;
const b = 2;
const c = 3;
const x = true;
const y = false;
const z = true;

// Same-operator chains (Pony-style): unambiguous under associativity.
// chain-per-line requires the boundaries to be split across source lines.
const r1 = a
  + b
  + c;
const r2 = a
  * b
  * c;
const r3 = x
  && y
  && z;
const r4 = x
  || y
  || z;

// Mixed operators with explicit parens
const r5 = a + (b * c);
const r6 = (x || y) && z;
const r7 = (a === b) || (c === 1);

// Fully wrapped nested comparisons inside logical expressions
const r8 = (a === b) || ((c === 1) && (a !== c));

// Whitespace inside parens still counts as parenthesised
const r9 = (a + b) * c;

// Identifier / literal operands never trigger the check
const r10 = a + b;
const r11 = x && y;

export {
  r1,
  r10,
  r11,
  r2,
  r3,
  r4,
  r5,
  r6,
  r7,
  r8,
  r9,
};
