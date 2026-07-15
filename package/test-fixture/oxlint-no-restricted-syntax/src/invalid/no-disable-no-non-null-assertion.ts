// Fixture: inline oxlint-disable for typescript/no-non-null-assertion should be banned.
// Expected violation: no-restricted-syntax(no-disable-no-non-null-assertion)

// oxlint-disable-next-line typescript/no-non-null-assertion -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
