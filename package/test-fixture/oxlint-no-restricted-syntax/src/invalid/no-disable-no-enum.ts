// Fixture: inline oxlint-disable for no-restricted-syntax/no-enum should be banned.
// Expected violation: no-restricted-syntax(no-disable-no-enum)

// oxlint-disable-next-line no-restricted-syntax/no-enum -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
