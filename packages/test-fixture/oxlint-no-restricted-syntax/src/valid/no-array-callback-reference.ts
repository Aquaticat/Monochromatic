// Fixture: explicit callback wrappers and inline functions should not be banned.
// Expected: zero no-restricted-syntax(no-array-callback-reference) violations.

function unary<TArgument, TReturn>(
  fn: (argument: TArgument,) => TReturn,
): (argument: TArgument,) => TReturn {
  return function unaryWrapper(argument: TArgument,): TReturn {
    return fn(argument,);
  };
}

function isBig(value: number,): boolean {
  return value > 1;
}

const wrapped = [1, 2, 3,].findIndex(unary(isBig,),);
const inline = [1, 2, 3,].findIndex(function probeC(value: number,): boolean {
  return isBig(value,);
},);
const builtin = ['1', '2', '3',].map(Number,);

void wrapped;
void inline;
void builtin;

export {};
