// Fixture: `switch` statement should be banned (use if/else or Record lookup).
// Expected violation: no-restricted-syntax(no-switch)

function classify(kind: string): number {
  switch (kind) {
    case 'a': {
      return 1;
    }
    default: {
      return 0;
    }
  }
}

void classify;

export {};
