export type $ = number & { __brand: {int: true}; };

export function is$(value: number,): value is $ {
  return Number.isInteger(value,);
}
