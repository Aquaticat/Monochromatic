// TODO: Use error cause param to pass error perfectly.

//region From https://www.totaltypescript.com/how-to-test-your-types

// TODO: Use Assert instead of chaining Expect<Equal<T>>
export type Expect<T extends true,> = T;
export type Equal<X, Y,> = (() => unknown extends X ? 1 : 2) extends
  () => unknown extends Y ? 1 : 2 ? true
  : false;
export type NotEqual<X, Y,> = (() => unknown extends X ? 1 : 2) extends
  () => unknown extends Y ? 1 : 2 ? false
  : true;

//endregion From https://www.totaltypescript.com/how-to-test-your-types
