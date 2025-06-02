export type PositiveInt = number & { __brand: 'PositiveInt'; };
export type PositiveFloat = number & { __brand: 'PositiveFloat'; };
export type NegativeInt = number & { __brand: 'NegativeInt'; };
export type NegativeFloat = number & { __brand: 'NegativeFloat'; };
export type PositiveNumber = PositiveInt | PositiveFloat;
export type Float = PositiveFloat | NegativeFloat;
export type Int = PositiveInt | NegativeInt | 0;
export type NegativeNumber = NegativeInt | NegativeFloat;
export type NonNegativeInt = PositiveInt | 0;
export type NonPositiveInt = NegativeInt | 0;
export type IntBigint = bigint & { __brand: 'IntBigint'; };
export type Numeric = number | bigint;

export type MinusOne<T extends number,> = T extends 1 ? 0
  : T extends 2 ? 1
  : T extends 3 ? 2
  : T extends 4 ? 3
  : T extends 5 ? 4
  : T extends 6 ? 5
  : T extends 7 ? 6
  : T extends 8 ? 7
  : T extends 9 ? 8
  : T extends 10 ? 9
  : never;
