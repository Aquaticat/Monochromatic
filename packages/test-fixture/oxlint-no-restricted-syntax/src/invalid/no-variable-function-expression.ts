// Fixture: const-bound function expression should be banned (use function declaration).
// Expected violation: no-restricted-syntax(no-variable-function-expression)

const square = function squareImpl(x: number): number {
  return x * x;
};

void square;

export {};
