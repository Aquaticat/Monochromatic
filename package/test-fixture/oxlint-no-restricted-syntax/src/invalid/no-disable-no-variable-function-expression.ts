// Fixture: inline oxlint-disable for no-restricted-syntax/no-variable-function-expression should be banned.
// Expected violation: no-restricted-syntax(no-disable-no-variable-function-expression)

// oxlint-disable-next-line no-restricted-syntax/no-variable-function-expression -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
