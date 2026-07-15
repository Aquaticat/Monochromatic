// Fixture: invocation-depth-per-line autofix keeps trailing comments and the
// trailing comma before them, and preserves grouping parentheses.
// Expected: only stylistic(invocation-depth-per-line); --fix converges clean.

declare const a: any;
declare const b: any;
declare const c: any;

// Trailing line comment after the operand.
const k1 = a(b(c()) // keep line
);

// Trailing block comment after the operand.
const k2 = a(b(c()) /* keep block */);

// Grouping parentheses with an interior comment.
const k3 = a((b(c()) /* keep grouped */));

// Existing trailing comma is not doubled.
const k4 = a(b(c()),);

export {};
