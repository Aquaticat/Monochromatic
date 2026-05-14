// Fixture: try/finally should be banned (use `using` or `await using`).
// Expected violation: no-restricted-syntax(no-try-finally)

function release(): void {
  try {
    void 0;
  }
  finally {
    void 1;
  }
}

void release;

export {};
