/* @__NO_SIDE_EFFECTS__ */ export type Abs<T extends number,> = `${T}` extends
  `-${infer Rest extends number}` ? Rest : T;
