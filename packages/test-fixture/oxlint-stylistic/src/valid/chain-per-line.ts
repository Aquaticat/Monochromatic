// Fixture: chains that should NOT trigger chain-per-line.
// Expected: zero stylistic rule violations.

declare const a: number;
declare const b: number;
declare const c: number;
declare const d: number;
declare const obj: { b: { c: number; }; };
declare const obj2: { y: number; };
declare const arr: number[][][];
declare const result: { content: ReadonlyArray<{ type: string; }>; };
declare function foo(): { bar(): string[]; };

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

// Non-breakable `[` chain — JavaScript grammar forbids a newline before
// non-optional `[`, so the rule treats `arr[0][1][2]` as a single inseparable
// chain and never reports it.
const r8 = arr[0][1][2];

// 2-call chain ending in `[0]`: one breakable member (`.bar`) sits on the same
// line as the calls, but the deep-access threshold requires 3+ breakable
// members; the chain stays on one line.
const r9 = foo().bar()[0];

// Member chain with mid-chain `[0]`: 2 breakable members (`.content`, `?.type`),
// below the 3-member deep-access threshold; stays on one line.
const r10 = result.content[0]?.type;

export {
  r1,
  r2,
  r3,
  r4,
  r5,
  r6,
  r7,
  r8,
  r9,
  r10,
};
