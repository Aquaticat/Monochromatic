// Fixture: chains with multiple boundaries on a single source line.
// Expected violations: stylistic(chain-per-line)

declare const a: number;
declare const b: number;
declare const c: number;
declare const d: number;
declare const x: boolean;
declare const y: boolean;
declare const z: boolean;
declare const obj: {
  b: { c: { d: number; }; e: number; };
  q?: { r?: { s?: number; }; };
};
declare const nested: { a: { b: { c: number[]; }; }; };
declare function foo(): { bar(): { baz(): number; }; };

// Same-operator binary chain (3 operands, 2 boundaries)
const r1 = a + b + c;

// Same-operator logical chain (3 operands, 2 boundaries)
const r2 = x && y && z;

// Plain member chain (4 segments, 3 member boundaries)
const r3 = obj.b.c.d;

// Optional chaining deep
const r4 = obj.q?.r?.s;

// Mixed dot + computed: dots split, trailing `[0]` stays attached to its dot member.
const r5 = nested.a.b.c[0];

// Call chain (3 calls)
const r6 = foo().bar().baz();

// Member + call mix (multi-step method chain, ≥ 2 calls)
const r7 = obj.b.c.d.toString().trim();

// Long binary chain (4 operands, 3 boundaries)
const r8 = a + b + c + d;

export {
  r1,
  r2,
  r3,
  r4,
  r5,
  r6,
  r7,
  r8,
};
