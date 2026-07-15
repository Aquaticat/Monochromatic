// Fixture: type slots expressed without a `| null` or `| undefined` union.
// Expected: zero no-restricted-syntax rule violations.

// Optional property: `?:` already means "absent or T" under exactOptionalPropertyTypes.
type WithOptional = {
  foo?: string;
};

// Plain type, no union.
type Plain = string;

// Genuine Symbol sentinel instead of widening the slot to a nullish member.
const NOT_FOUND = Symbol('requested key not found in store',);

type LookupResult = string | typeof NOT_FOUND;

function lookup(value: WithOptional,): LookupResult {
  if (value.foo === undefined)
    return NOT_FOUND;
  return value.foo;
}

const plain: Plain = 'value';

void lookup;
void plain;

export type {
  LookupResult,
  Plain,
  WithOptional,
};
