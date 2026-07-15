// Fixture: direct array callback references should be banned.
// Expected violation: no-restricted-syntax(no-array-callback-reference)

function isBig(value: number,): boolean {
  return value > 1;
}

function hasIndexFootgun(value: number, index: number,): boolean {
  return value > index;
}

function makePredicate(
  fn: (value: number,) => boolean,
): (value: number,) => boolean {
  return fn;
}

const probe = {
  hasIndexFootgun,
};

const direct = [1, 2, 3,].findIndex(hasIndexFootgun,);
const member = [1, 2, 3,].filter(probe.hasIndexFootgun,);
const unknownCallWrapper = [1, 2, 3,].some(makePredicate(isBig,),);

void direct;
void member;
void unknownCallWrapper;

export {};
