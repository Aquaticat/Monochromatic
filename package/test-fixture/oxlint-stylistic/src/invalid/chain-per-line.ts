// Fixture: chains whose layout is not canonical. Expected: stylistic(chain-per-line).
// Declarations are `any`-typed so only chain-per-line fixes apply, making the
// autofix output deterministic. Same-operator and member/call chains are used
// so no-mixed-operators never wraps a region first.

declare const a: any;
declare const b: any;
declare const c: any;
declare const d: any;
declare const x: any;
declare const y: any;
declare const z: any;
declare const obj: any;
declare const ctx: any;
declare function foo(): any;
declare const items: any;
declare const aa: any;
declare const dd: any;

// Plain member chain (head keeps leaf plus one member).
const b1 = obj.foo.bar;

// Member chain ending in a call.
const b2 = ctx.sc.getText();

// One member per line after the head.
const b3 = obj.b.c.d;

// Head holds two segments when `.bar` arrives; trailing `[0]` stays attached.
const b4 = foo().bar()[0];

// Method chain: one call step per continuation line.
const b5 = items.map(a).filter(b).filter(c);

// Same-operator binary chain keeps the first two operands on the head line.
const b6 = a + b + c + d;

// Same-operator logical chain.
const b7 = x && y && z;

// Operator chain whose operands are member chains: each operand breaks on its own
// member axis, and the single operator takes its own line because an operand broke.
const b8 = aa.b().c() + dd.e().f();

// Mixed member and call steps.
const b9 = obj.b.c.d.toString().trim();

// Single operator with a multi-step member operand: the member chain breaks, so the
// operator moves to its own line (decoupled axes; a one-step operand would stay inline).
const b10 = obj.a.b > c;

export {
  b1,
  b2,
  b3,
  b4,
  b5,
  b6,
  b7,
  b8,
  b9,
  b10,
};
