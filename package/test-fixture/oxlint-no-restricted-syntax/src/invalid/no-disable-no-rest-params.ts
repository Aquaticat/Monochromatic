// Fixture: inline oxlint-disable for no-restricted-syntax/no-rest-params should be banned.
// Expected violation: no-restricted-syntax(no-disable-no-rest-params)

// oxlint-disable-next-line no-restricted-syntax/no-rest-params -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
