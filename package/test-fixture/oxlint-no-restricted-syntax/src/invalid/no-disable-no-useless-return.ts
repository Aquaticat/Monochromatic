// Fixture: inline oxlint-disable for eslint/no-useless-return should be banned.
// Expected violation: no-restricted-syntax(no-disable-no-useless-return)

// oxlint-disable-next-line eslint/no-useless-return -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
