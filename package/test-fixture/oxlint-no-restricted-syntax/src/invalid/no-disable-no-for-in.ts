// Fixture: inline oxlint-disable for no-restricted-syntax/no-for-in should be banned.
// Expected violation: no-restricted-syntax(no-disable-no-for-in)

// oxlint-disable-next-line no-restricted-syntax/no-for-in -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
