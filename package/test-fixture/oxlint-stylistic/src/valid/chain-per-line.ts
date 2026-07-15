// Fixture: chains that should NOT trigger chain-per-line.
// Expected: zero stylistic rule violations.
// Declarations are `any`-typed so no sibling per-line rule fires on them.

declare const a: any;
declare const b: any;
declare const c: any;
declare const obj: any;
declare const arr: any;

// One boundary: the only break point has a single segment before it, never reports.
const v1 = a + b;
const v2 = obj.b;

// Leaf plus one member plus a call: the member attaches, the call attaches, no break.
const v3 = obj.method();

// Computed access is never a break point, so all-computed chains stay on one line.
const v4 = arr[0][1];
const v5 = arr[0][1][2];

// Parens isolate the inner chain; the outer chain has a single boundary.
const v6 = (a + b) + c;
const v7 = a + (b + c);

// Already in canonical layout: the region equals its render, so nothing reports.
const v8 = obj.b
  .c
  .d;
const v9 = a + b
  + c;

// Decoupled axes: a single operator whose operand is a one-step member access does not
// break, because the member axis (one step) and the operator axis (one operator) are
// counted separately. The reported regression on `===` and `??`, including inside a
// template-literal interpolation.
const v10 = a.b === c;
const v11 = a.b ?? c;
const v12 = `x: ${obj.a === b ? 'y' : 'z'}`;

export {
  v1,
  v2,
  v3,
  v4,
  v5,
  v6,
  v7,
  v8,
  v9,
  v10,
  v11,
  v12,
};
