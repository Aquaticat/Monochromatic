/* @__NO_SIDE_EFFECTS__ */ export type WithoutFirst<T extends any[],> = T extends [
  any,
  ...infer Rest,
] ? Rest
  : never;

/* @__NO_SIDE_EFFECTS__ */ export type WithoutFirst2<T extends any[],> = T extends [
  any,
  any,
  ...infer Rest,
] ? Rest
  : never;

/* @__NO_SIDE_EFFECTS__ */ export type WithoutFirst3<T extends any[],> = T extends [
  any,
  any,
  any,
  ...infer Rest,
] ? Rest
  : never;

/* @__NO_SIDE_EFFECTS__ */ export type WithoutFirst4<T extends any[],> = T extends [
  any,
  any,
  any,
  any,
  ...infer Rest,
] ? Rest
  : never;

/* @__NO_SIDE_EFFECTS__ */ export type WithoutFirst5<T extends any[],> = T extends [
  any,
  any,
  any,
  any,
  any,
  ...infer Rest,
] ? Rest
  : never;

/* @__NO_SIDE_EFFECTS__ */ export type WithoutFirst6<T extends any[],> = T extends [
  any,
  any,
  any,
  any,
  any,
  any,
  ...infer Rest,
] ? Rest
  : never;

/* @__NO_SIDE_EFFECTS__ */ export type WithoutFirst7<T extends any[],> = T extends [
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  ...infer Rest,
] ? Rest
  : never;

/* @__NO_SIDE_EFFECTS__ */ export type WithoutFirst8<T extends any[],> = T extends [
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  ...infer Rest,
] ? Rest
  : never;

/* @__NO_SIDE_EFFECTS__ */ export type WithoutFirst9<T extends any[],> = T extends [
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  ...infer Rest,
] ? Rest
  : never;

/* @__NO_SIDE_EFFECTS__ */ export type WithoutFirst10<T extends any[],> = T extends [
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  ...infer Rest,
] ? Rest
  : never;
