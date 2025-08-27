/**
 * Type representing integer numeric values
 * For number type, uses branding to indicate integer constraint
 * BigInt is inherently an integer type
 */
export type $ = (number & { __brand: {
  int: true;
}; }) | bigint;
