/**
 * Type-level utility that computes the absolute value of a number type.
 * Removes the negative sign from negative numbers and leaves positive numbers unchanged.
 *
 * @template T - Number type to compute absolute value for
 *
 * @example
 * ```ts
 * type PositiveFive = Abs<5>;    // 5
 * type AlsoFive = Abs<-5>;       // 5
 * type Zero = Abs<0>;            // 0
 * type PositiveFloat = Abs<3.14>; // 3.14
 * type AbsFloat = Abs<-2.71>;    // 2.71
 *
 * // Practical usage in type constraints
 * function processDistance<T extends number>(
 *   value: T
 * ): Abs<T> {
 *   return Math.abs(value) as Abs<T>;
 * }
 *
 * const distance1 = processDistance(-10); // Type: 10
 * const distance2 = processDistance(5);   // Type: 5
 * ```
 */
export type Abs<T extends number,> = `${T}` extends `-${infer Rest extends number}` ? Rest
  : T;
