// Fixture: every statically-detectable type-level fake-optional encoding.
// Expected violation: no-restricted-syntax(no-optional-escape)
// Eighteen distinct sites, one per banned form. `| undefined`/`| null` are
// intentionally absent here: they belong to no-nullish-union.

// Form 1: `T | void` (void widens to accept undefined).
type VoidUnion = string | void;

// Form 2: `T | never` (collapses to T; stubbed absence branch).
type NeverUnion = string | never;

// Form 3: `T | unknown` (widening dodge).
type UnknownUnion = string | unknown;

// Form 4: `T | any` (widening dodge).
type AnyUnion = string | any;

// Form 5: `T | ''` (empty-string falsy sentinel).
type EmptyStringUnion = string | '';

// Form 6: empty template literal type as a falsy sentinel.
type EmptyTemplateUnion = string | ``;

// Form 7: `T | 0` (zero falsy sentinel).
type ZeroUnion = string | 0;

// Form 8: `T | -1` (negative not-found sentinel).
type NegativeUnion = string | -1;

// Form 9: `T | false` (off/absent sentinel).
type FalseUnion = string | false;

// Form 10: `T | {}` (empty object widens to any non-nullish).
type EmptyObjectUnion = string | {};

// Form 11: empty tuple `[]`.
type EmptyTuple = [];

// Form 12: optional tuple element `[T?]`.
type OptionalTupleElement = [string?];

// Form 13: optional named tuple member `[foo?: T]`.
type NamedOptionalTuple = [foo?: string];

// Form 14: rest-only tuple `[...T[]]`.
type RestOnlyTuple = [...string[]];

// Form 15: `Partial<T>`.
type PartialObject = Partial<{ a: string; }>;

// Form 16: `Record<K, never>` (empty-object utility).
type EmptyRecord = Record<string, never>;

// Form 17: `Pick<T, never>` (empty-object utility).
type EmptyPick = Pick<{ a: string; }, never>;

// Form 18: mapped type that adds optionality (hand-rolled Partial).
type HandRolledPartial<U> = { [K in keyof U]?: U[K]; };

export type {
  AnyUnion,
  EmptyObjectUnion,
  EmptyPick,
  EmptyRecord,
  EmptyStringUnion,
  EmptyTemplateUnion,
  EmptyTuple,
  FalseUnion,
  HandRolledPartial,
  NamedOptionalTuple,
  NegativeUnion,
  NeverUnion,
  OptionalTupleElement,
  PartialObject,
  RestOnlyTuple,
  UnknownUnion,
  VoidUnion,
  ZeroUnion,
};
