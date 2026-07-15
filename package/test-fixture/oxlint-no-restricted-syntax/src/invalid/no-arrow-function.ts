// Fixture: arrow function expression should be banned.
// Expected violation: no-restricted-syntax(no-arrow-function)

const double = (x: number): number => x * 2;

void double;

export {};
