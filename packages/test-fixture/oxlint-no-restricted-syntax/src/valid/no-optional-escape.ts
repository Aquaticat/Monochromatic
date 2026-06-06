// Fixture: type slots that look optional-adjacent but are legitimate.
// Expected: zero no-restricted-syntax rule violations.
// Each form here would be a tempting false positive; the rule must leave it.

// Real Symbol sentinel: the sanctioned alternative to a fake-optional union.
const NOT_FOUND = Symbol('requested key not found in store',);

// Bare `(): void` return: only `void` inside a union is banned.
type VoidReturn = () => void;

// Fixed non-empty tuple: a real pair, not a Maybe.
type Pair = [number, string,];

// Leading-element variadic tuple: one-or-more, not a rest-only Maybe.
type OneOrMore = [number, ...string[],];

// Real Symbol sentinel in a union.
type LookupResult = string | typeof NOT_FOUND;

// Non-empty string literal member: a real domain value, not a sentinel.
type WithPending = string | 'pending';

// Non-falsy numeric literal member: a real domain value.
type WithAnswer = string | 42;

// Pure finite literal domain: no non-literal member, so the gate leaves it.
type Level = 0 | 1 | 2;

// Pure finite string-literal domain.
type Direction = 'north' | 'south';

// Real Record: value type is not `never`.
type Counts = Record<string, number>;

// Real Pick: selects an actual key, not `never`.
type JustA = Pick<{ a: string; b: number; }, 'a'>;

// Required mapped type (`-?`): removes optionality, the opposite of the dodge.
type Req<U> = { [K in keyof U]-?: U[K]; };

// Plain mapped type: no optionality modifier added.
type Identity<U> = { [K in keyof U]: U[K]; };

export type {
  Counts,
  Direction,
  Identity,
  JustA,
  Level,
  LookupResult,
  OneOrMore,
  Pair,
  Req,
  VoidReturn,
  WithAnswer,
  WithPending,
};
