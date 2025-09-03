// TypeScript cannot get length from a const string immediately, but this type still has value because we essentially use it as branded type.
// Why not use an actual branded type? Because '1'.length is indeed 1.
export type $ = string & { length: 1; };

// Type assertion needed because ...
const _one: $ = '1' as $;

// @ts-expect-error -- Type 'string' is not assignable to type '$'. Type 'string' is not assignable to type '{ length: 1; }'.ts(2322)
const _two: $ = '12';

// @ts-expect-error -- Type 'string' is not assignable to type '$'. Type 'string' is not assignable to type '{ length: 1; }'.ts(2322)
const _empty: $ = '';
