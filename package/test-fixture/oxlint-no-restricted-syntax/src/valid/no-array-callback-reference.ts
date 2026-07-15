// Fixture: explicit callback wrappers and inline functions should not be banned.
// Expected: zero no-restricted-syntax(no-array-callback-reference) violations.

function unary<TArgument, TReturn>(
  fn: (argument: TArgument,) => TReturn,
): (argument: TArgument,) => TReturn {
  return function unaryWrapper(argument: TArgument,): TReturn {
    return fn(argument,);
  };
}

function binary<TFirstArgument, TSecondArgument, TReturn>(
  fn: (firstArgument: TFirstArgument, secondArgument: TSecondArgument,) => TReturn,
): (firstArgument: TFirstArgument, secondArgument: TSecondArgument,) => TReturn {
  return function binaryWrapper(
    firstArgument: TFirstArgument,
    secondArgument: TSecondArgument,
  ): TReturn {
    return fn(
      firstArgument,
      secondArgument,
    );
  };
}

function isBig(value: number,): boolean {
  return value > 1;
}

const directUnary = [1, 2, 3,].findIndex(isBig,);
const wrapped = [1, 2, 3,].findIndex(unary(isBig,),);
const binaryWrapped = [1, 2, 3,].map(binary(function renderWithIndex(
  value: number,
  index: number,
): string {
  return `${index}:${value}`;
},),);
const inline = [1, 2, 3,].findIndex(function probeC(value: number,): boolean {
  return isBig(value,);
},);
const probe = {
  isBig,
};
const memberUnary = [1, 2, 3,].findIndex(probe.isBig,);
const builtin = ['1', '2', '3',].map(Number,);

void directUnary;
void wrapped;
void binaryWrapped;
void inline;
void memberUnary;
void builtin;

export {};
