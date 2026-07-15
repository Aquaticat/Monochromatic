// Fixture: inline oxlint-disable for typescript-eslint/prefer-regexp-exec should be banned.
// Expected violation: no-restricted-syntax(no-disable-prefer-regexp-exec)

// oxlint-disable-next-line typescript-eslint/prefer-regexp-exec -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
