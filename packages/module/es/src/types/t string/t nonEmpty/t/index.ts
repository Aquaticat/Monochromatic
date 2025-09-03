// See https://stackoverflow.com/a/79468119
export type $nonEmpty = `${any}${string}`;

const _one: $nonEmpty = '1';
const _two: $nonEmpty = '12';

// @ts-expect-error -- Type '""' is not assignable to type '`${any}${string}`'.ts(2322)
const _empty: $nonEmpty = '';

// No need for a runtime type guard because ...
