import { unnamed as int, } from '../../../number/int/index.ts';

export type $ = {
  readonly startInclusive: int.$;
  readonly endInclusive: int.$;
}
&{ readonly __brand: { readonly isEndInclusiveGreaterThanOrEqualToStartInclusive: true }};

export function is$(
  value: { readonly startInclusive: int.$; readonly endInclusive: int.$; },
): value is $ {
  return value.endInclusive >= value.startInclusive;
}
