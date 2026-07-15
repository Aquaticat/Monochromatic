// Fixture: `let` at module root should be banned.
// Expected violation: no-restricted-syntax(no-module-root-let)

let counter = 0;

function increment(): void {
  counter = counter + 1;
}

void increment;
void counter;

export {};
