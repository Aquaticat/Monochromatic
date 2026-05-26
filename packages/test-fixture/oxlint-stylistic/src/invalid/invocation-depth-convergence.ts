// Fixture: invocation-depth-per-line autofix converges with sibling rules over
// repeated `oxlint --fix` passes (an upstream single-pass limitation).
// Expected: --fix run to a fixed point clears every stylistic violation.

declare const a: any;
declare const b: any;
declare const c: any;
declare const d: any;
declare const e: any;
declare const f: any;
declare const g: any;
declare const other: any;

// Pure self-convergence: a four-deep spine needs two split passes.
const s1 = a(b(c(d())));

// Overlap with argument-per-line: the multi-argument parent and the child spine.
const s2 = a(b(c(d())), other);

// Overlap with object-property-per-line: each property carries a child spine.
const s3 = { x: b(c(d())), y: e(f(g())) };

// Overlap with array-element-per-line: each element carries a child spine.
const s4 = [b(c(d())), e(f(g()))];

export {
  s1,
  s2,
  s3,
  s4,
};
