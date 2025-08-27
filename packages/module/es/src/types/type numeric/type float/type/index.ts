/**
 * Type representing floating-point numeric values
 * Only applies to number type as bigint cannot represent fractions
 * Uses branding to indicate non-integer constraint
 */
export type $ = number & { __brand: {
  int: false;
}; };
