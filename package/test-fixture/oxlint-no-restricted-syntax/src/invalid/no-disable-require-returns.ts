// Fixture: inline oxlint-disable for tsdoc/require-returns should be banned.
// Expected violation: no-restricted-syntax(no-disable-require-returns)

// oxlint-disable-next-line tsdoc/require-returns -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
