// Fixture: inline oxlint-disable for no-restricted-syntax/no-promise-catch should be banned.
// Expected violation: no-restricted-syntax(no-disable-no-promise-catch)

// oxlint-disable-next-line no-restricted-syntax/no-promise-catch -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
