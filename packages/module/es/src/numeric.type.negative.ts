/* @__NO_SIDE_EFFECTS__ */ export type Negative<T extends number,> = `${T}` extends
  `-${infer Rest extends number}` ? Rest
  : `-${T}` extends `${infer Neg extends number}` ? Neg
  : never;
