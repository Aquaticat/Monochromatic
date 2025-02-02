/* @__NO_SIDE_EFFECTS__ */ export type Assert<X, Y extends X,> = Y;

/* @__NO_SIDE_EFFECTS__ */ export type AssertTrue<Y extends true,> = Y;
/* @__NO_SIDE_EFFECTS__ */ export type AssertFalse<Y extends false,> = Y;

/* @__NO_SIDE_EFFECTS__ */ export type AssertUndefined<Y extends undefined,> = Y;

/* @__NO_SIDE_EFFECTS__ */ export type AssertNull<Y extends null,> = Y;

/* @__NO_SIDE_EFFECTS__ */ export type AssertEmptyObject<
  Y extends Record<string, never>,
> = Y;

/* @__NO_SIDE_EFFECTS__ */ export type Assert0<Y extends 0,> = Y;

/* @__NO_SIDE_EFFECTS__ */ export type Assert1<Y extends 1,> = Y;

/* @__NO_SIDE_EFFECTS__ */ export type AssertNan<Y extends typeof Number.NaN,> = Y;

/* @__NO_SIDE_EFFECTS__ */ export type AssertNegative1<Y extends -1,> = Y;

/* @__NO_SIDE_EFFECTS__ */ export type AssertEmptyArray<Y extends never[],> = Y;

/* @__NO_SIDE_EFFECTS__ */ export type AssertNot<X, Y extends Exclude<any, X>,> = Y;
