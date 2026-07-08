// Fixture: direct array callback references should be banned.
// Expected violation: no-restricted-syntax(no-array-callback-reference)

function isBig(value: number,): boolean {
  return value > 1;
}

function makePredicate(
  fn: (value: number,) => boolean,
): (value: number,) => boolean {
  return fn;
}

const probe = {
  isBig,
};

const direct = [1, 2, 3,].findIndex(isBig,);
const member = [1, 2, 3,].filter(probe.isBig,);
const unknownCallWrapper = [1, 2, 3,].some(makePredicate(isBig,),);

void direct;
void member;
void unknownCallWrapper;

export {};
