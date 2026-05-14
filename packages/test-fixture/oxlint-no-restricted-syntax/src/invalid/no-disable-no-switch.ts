// Fixture: inline oxlint-disable for no-restricted-syntax/no-switch should be banned.
// Expected violation: no-restricted-syntax(no-disable-no-switch)

// oxlint-disable-next-line no-restricted-syntax/no-switch -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
