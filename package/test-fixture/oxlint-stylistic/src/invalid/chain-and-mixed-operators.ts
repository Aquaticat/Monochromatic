// Fixture: chain-per-line and no-mixed-operators must converge after running
// --fix twice. oxlint applies one fix per overlapping byte region per pass,
// so when no-mixed-operators wraps a region containing the chain-per-line
// target, chain-per-line waits until the next pass.
//
// Expected violations on the original source:
//   - stylistic(no-mixed-operators) for the mixed `+` and `*`.
//   - stylistic(chain-per-line) for the 3-segment member chain on one line.

declare const a: number;
declare const b: number;
declare const obj: { d: { e: { f: number; }; }; };

// Mixed arithmetic (forces no-mixed-operators paren wrap)
// + 3-member chain `obj.d.e.f` (forces chain-per-line break)
const r = a + b * obj.d.e.f;

export { r, };
