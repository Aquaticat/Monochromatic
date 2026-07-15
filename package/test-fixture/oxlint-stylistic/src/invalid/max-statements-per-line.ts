// Fixture: multiple statements on a single source line.
// Expected violations: stylistic(max-statements-per-line)

const a = 1; const b = 2;

const c = 3; const d = 4; const e = 5;

if (true) console.log('yes'); else console.log('no');

// Single-child exemption: this line has the IfStatement plus only its consequent.
// It should NOT be flagged.
if (true) console.log('only branch');

export {};
