// Fixture: `.finally()` on a Promise should be banned (use try/finally or using).
// Expected violation: no-restricted-syntax(no-promise-finally)

async function cleanup(): Promise<void> {
  await Promise.resolve(1).finally(function onSettled(): void {
    void 0;
  });
}

void cleanup;

export {};
