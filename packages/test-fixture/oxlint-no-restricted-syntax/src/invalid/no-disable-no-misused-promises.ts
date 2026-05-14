// Fixture: inline oxlint-disable for typescript/no-misused-promises should be banned.
// Expected violation: no-restricted-syntax(no-disable-no-misused-promises)

// oxlint-disable-next-line typescript/no-misused-promises -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
