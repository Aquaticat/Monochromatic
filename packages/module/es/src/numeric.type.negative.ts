/**
 * Type utility that toggles the sign of a numeric literal type.
 * Converts positive numbers to negative and negative numbers to positive,
 * effectively implementing mathematical negation at the type level.
 *
 * The type uses template literal pattern matching to:
 * 1. If the input is already negative (starts with `-`), remove the sign
 * 2. If the input is positive, prepend `-` to make it negative
 * 3. Return `never` for invalid inputs that can't be processed
 *
 * @template T - Numeric literal type to negate
 *
 * @example
 * ```ts
 * // Converting positive to negative
 * type NegativeFive = Negative<5>;        // -5
 * type NegativeZero = Negative<0>;        // -0 (which equals 0)
 * type NegativeFloat = Negative<3.14>;    // -3.14
 *
 * // Converting negative to positive (sign toggle)
 * type PositiveFive = Negative<-5>;       // 5
 * type PositiveFloat = Negative<-2.71>;   // 2.71
 *
 * // Usage in mathematical type operations
 * type Balance = 100;
 * type Debt = Negative<Balance>;          // -100
 * type Repayment = Negative<Debt>;        // 100 (back to positive)
 *
 * // Function signatures with negated types
 * function createDebit<T extends number>(amount: T): Negative<T> {
 *   const result = amount > 0 ? -amount : Math.abs(amount);
 *   return result as Negative<T>;
 * }
 *
 * const debit = createDebit(50);          // Type: -50
 * const credit = createDebit(-30);        // Type: 30
 *
 * // Financial calculations with type safety
 * type Revenue = 1000;
 * type Expenses = Negative<800>;          // -800
 * type NetIncome = Revenue & Expenses;    // Represents the combination
 *
 * // Vector mathematics
 * type VectorX = 5;
 * type VectorY = 3;
 * type OppositeX = Negative<VectorX>;     // -5
 * type OppositeY = Negative<VectorY>;     // -3
 * ```
 */
export type Negative<T extends number,> = `${T}` extends `-${infer Rest extends number}`
  ? Rest
  : `-${T}` extends `${infer Neg extends number}` ? Neg
  : never;
