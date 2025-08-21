import {
  type Abs,

  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expectTypeOf,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('Abs', () => {
  test('should compute absolute value for positive numbers', () => {
    expectTypeOf<Abs<5>>().toEqualTypeOf<5>();
    expectTypeOf<Abs<0>>().toEqualTypeOf<0>();
    expectTypeOf<Abs<42>>().toEqualTypeOf<42>();
    expectTypeOf<Abs<3.14>>().toEqualTypeOf<3.14>();
  });

  test('should compute absolute value for negative numbers', () => {
    expectTypeOf<Abs<-5>>().toEqualTypeOf<5>();
    expectTypeOf<Abs<-42>>().toEqualTypeOf<42>();
    expectTypeOf<Abs<-3.14>>().toEqualTypeOf<3.14>();
    expectTypeOf<Abs<-0>>().toEqualTypeOf<0>();
  });

  test('should work with edge cases', () => {
    expectTypeOf<Abs<-1>>().toEqualTypeOf<1>();
    expectTypeOf<Abs<1>>().toEqualTypeOf<1>();
    expectTypeOf<Abs<-100>>().toEqualTypeOf<100>();
    expectTypeOf<Abs<100>>().toEqualTypeOf<100>();
  });

  test('should work with decimal numbers', () => {
    expectTypeOf<Abs<-2.71>>().toEqualTypeOf<2.71>();
    expectTypeOf<Abs<2.71>>().toEqualTypeOf<2.71>();
    expectTypeOf<Abs<-0.5>>().toEqualTypeOf<0.5>();
    expectTypeOf<Abs<0.5>>().toEqualTypeOf<0.5>();
  });
});