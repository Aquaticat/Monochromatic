// Fixture: inline oxlint-disable for no-restricted-syntax/no-arrow-function should be banned.
// Expected violation: no-restricted-syntax(no-disable-no-arrow-function)

// oxlint-disable-next-line no-restricted-syntax/no-arrow-function -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
