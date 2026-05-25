// Fixture: type slots expressed without a `| undefined` union.
// Expected: zero no-restricted-syntax rule violations.

// Optional property: `?:` already means "absent or T" under exactOptionalPropertyTypes.
type WithOptional = {
  foo?: string;
};

// Plain type, no union.
type Plain = string;

// `T | null` is out of scope; null is a distinct keyword from undefined.
type Nullable = string | null;

// Named sentinel instead of widening the slot to `| undefined`.
const NOT_FOUND = Symbol('not-found',);

type LookupResult = string | typeof NOT_FOUND;

function lookup(value: WithOptional,): LookupResult {
  if (value.foo === undefined)
    return NOT_FOUND;
  return value.foo;
}

const plain: Plain = 'value';

const nullable: Nullable = null;

void lookup;
void plain;
void nullable;

export type {
  LookupResult,
  Nullable,
  Plain,
  WithOptional,
};
