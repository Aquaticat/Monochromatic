// Fixture: more than two nested invocation heads on one source line.
// Expected violations: stylistic(invocation-depth-per-line) only.
// Declarations are `any`-typed so no sibling per-line rule fires on these spines.

declare const a: any;
declare const b: any;
declare const c: any;
declare const d: any;
declare const A: any;
declare const B: any;
declare const tag: any;

// Plain call spine.
const f1 = a(b(c()));

// Constructors at the head and inside the spine.
const f2 = new A(b(c()));
const f3 = a(new B(c()));

// Optional call in the spine.
const f4 = a(b?.(c()));

// Dynamic import with a single operand.
const f5 = a(import(b(c())));

// Transparent wrappers: await, void, logical-not, spread, grouping, `as`.
const f6 = a(await b(c()));
const f7 = a(void b(c()));
const f8 = a(!b(c()));
const f9 = a(...b(c()));
const f10 = a((b(c())));
const f11 = a(b(c()) as unknown);

// Already split, but the continuation line still carries three heads.
const f12 = a(
  b(c(d())),
);

// Spine descendant inside an object container.
const f13 = a({ value: b(c(d())) });

// Spine descendant inside a tagged-template interpolation.
const f14 = a(tag`${b(c(d()))}`);

// Transparent yield inside a generator.
function* gen(): any {
  return a(yield b(c()));
}

export {};
