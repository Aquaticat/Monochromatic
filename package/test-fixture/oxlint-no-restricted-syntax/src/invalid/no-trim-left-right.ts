// Fixture: `trimLeft` / `trimRight` should be banned (use trimStart / trimEnd).
// Expected violation: no-restricted-syntax(no-trim-left-right)

function clean(value: string): string {
  return value.trimLeft();
}

void clean;

export {};
