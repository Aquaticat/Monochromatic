export type $ =  {
  readonly startInclusive: number;
  readonly endInclusive: number
} & {__brand: 'rangeNumber'};

export function is$(value: {readonly startInclusive: number; readonly endInclusive: number}): value is $ {
  return value.endInclusive >= value.startInclusive;
}

// TODO: Migrate to rangeInt
