// Fixture: inline oxlint-disable for max-lines should be banned.
// Expected violation: no-restricted-syntax(no-disable-max-lines)

// oxlint-disable-next-line eslint/max-lines -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
