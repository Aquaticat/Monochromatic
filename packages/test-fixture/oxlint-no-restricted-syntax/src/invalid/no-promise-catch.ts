// Fixture: `.catch()` on a Promise should be banned (use try/catch instead).
// Expected violation: no-restricted-syntax(no-promise-catch)

async function load(): Promise<void> {
  await Promise.resolve(1).catch(function onReject(): void {
    void 0;
  });
}

void load;

export {};
