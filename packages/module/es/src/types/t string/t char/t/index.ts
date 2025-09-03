export type $<Type,> = Type extends `${infer FirstChar}${infer Rest}`
  ? Rest extends '' ? Type
  : never
  : never;

function myFn<Type,>(char: $<Type>,) {}

export type $2<Str extends string = string,> = Str extends
  `${infer FirstChar}${infer Rest}` ? Rest extends '' ? $2 : never : never;

const _one: $2 = '1';

const _two: $2 = '12';

const _empty: $2 = '';
