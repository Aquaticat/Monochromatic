// Fixture: inline oxlint-disable for no-restricted-syntax/require-destructured-params should be banned.
// Expected violation: no-restricted-syntax(no-disable-require-destructured-params)

// oxlint-disable-next-line no-restricted-syntax/require-destructured-params -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
