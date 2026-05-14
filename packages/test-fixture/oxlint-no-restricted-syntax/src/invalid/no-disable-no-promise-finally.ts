// Fixture: inline oxlint-disable for no-restricted-syntax/no-promise-finally should be banned.
// Expected violation: no-restricted-syntax(no-disable-no-promise-finally)

// oxlint-disable-next-line no-restricted-syntax/no-promise-finally -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
