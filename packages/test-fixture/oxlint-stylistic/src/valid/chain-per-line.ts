// Fixture: chains that should NOT trigger chain-per-line.
// Expected: zero stylistic rule violations.

declare const a: number;
declare const b: number;
declare const c: number;
declare const d: number;
declare const obj: { b: { c: number; }; };
declare const obj2: { y: number; };

// Depth-1 binary (1 boundary) — never reports.
const r1 = a + b;

// Depth-1 member (1 boundary) — never reports.
const r2 = obj.b;

// Two independent depth-1 chains joined by `+` — no chain has 2+ boundaries.
const r3 = obj.b + obj2.y;

// Already split across lines: each boundary on its own line.
const r4 = a
  + b
  + c
  + d;

const r5 = obj
  .b
  .c;

// Parens isolate inner chains; outer chain has 1 boundary.
const r6 = (a + b) + c;
const r7 = a + (b + c);

export {
  r1,
  r2,
  r3,
  r4,
  r5,
  r6,
  r7,
};
