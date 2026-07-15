// Fixture: function with 2+ positional params should be banned (use destructured object).
// Expected violation: no-restricted-syntax(require-destructured-params)

function combine(left: string, right: string): string {
  return `${left}${right}`;
}

void combine;

export {};
