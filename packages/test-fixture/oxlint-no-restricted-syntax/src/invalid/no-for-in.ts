// Fixture: `for...in` loop should be banned (use Object.entries instead).
// Expected violation: no-restricted-syntax(no-for-in)

function dump(obj: Record<string, unknown>): void {
  for (const key in obj) {
    void obj[key];
  }
}

void dump;

export {};
