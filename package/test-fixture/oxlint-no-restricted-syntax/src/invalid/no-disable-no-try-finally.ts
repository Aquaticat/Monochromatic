// Fixture: inline oxlint-disable for no-restricted-syntax/no-try-finally should be banned.
// Expected violation: no-restricted-syntax(no-disable-no-try-finally)

// oxlint-disable-next-line no-restricted-syntax/no-try-finally -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
