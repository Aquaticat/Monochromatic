// Fixture: catch without a binding should be banned.
// Expected violation: no-restricted-syntax(catch-binding)

function parseFallback(value: string,): unknown {
  try {
    return JSON.parse(value,) as unknown;
  }
  catch {
    return value;
  }
}

void parseFallback;

export {};
