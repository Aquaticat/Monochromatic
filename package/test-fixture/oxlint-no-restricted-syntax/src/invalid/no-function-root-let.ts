// Fixture: `let` at function-body root should be banned.
// Expected violation: no-restricted-syntax(no-function-root-let)

function compute(items: readonly number[]): void {
  let total = 0;
  for (const item of items) {
    total = total + item;
  }
  if (total > 0) {
    void total;
  }
  void total;
}

void compute;

export {};
