// Fixture: inline oxlint-disable for tsdoc/require-tsdoc should be banned.
// Expected violation: no-restricted-syntax(no-disable-require-tsdoc)

// oxlint-disable-next-line tsdoc/require-tsdoc -- intentional fixture violation
function placeholder(): void {
  void 0;
}

void placeholder;

export {};
