// Fixture: spines that should NOT trigger invocation-depth-per-line.
// Expected: zero stylistic(invocation-depth-per-line) violations.
// Some lines trip sibling rules (argument-per-line on the multi-argument call),
// so the test filters to invocation-depth-per-line rather than expecting silence.

declare const a: any;
declare const b: any;
declare const c: any;
declare const other: any;
declare const opts: any;
declare const tag: any;
declare const factory: any;

// Depth two stays on one line.
const v1 = a(b());

// Threshold-only: already split, every line within the limit.
const v2 = a(b(
  c(),
));

// Callee chains belong to chain-per-line, not this rule.
const v3 = factory()()();

// Multi-argument parent breaks the spine; argument-per-line owns the layout.
const v4 = a(b(c()), other);

// Dynamic import with options stops the source spine.
const v5 = a(import(b(c()), opts));

// Tagged-template wrapper breaks the outer spine; the interpolation is depth two.
const v6 = a(tag`${b(c())}`);

// Object container breaks the spine; the descendant is depth two.
const v7 = a({ value: b(c()) });

export {};
