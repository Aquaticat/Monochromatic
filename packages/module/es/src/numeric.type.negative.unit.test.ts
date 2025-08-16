import {
  type Negative,

  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expectTypeOf,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('Negative', () => {
  test('should convert positive numbers to negative', () => {
    expectTypeOf<Negative<5>>().toEqualTypeOf<-5>();
    expectTypeOf<Negative<42>>().toEqualTypeOf<-42>();
    expectTypeOf<Negative<1>>().toEqualTypeOf<-1>();
    expectTypeOf<Negative<100>>().toEqualTypeOf<-100>();
  });

  test('should convert negative numbers to positive', () => {
    expectTypeOf<Negative<-5>>().toEqualTypeOf<5>();
    expectTypeOf<Negative<-42>>().toEqualTypeOf<42>();
    expectTypeOf<Negative<-1>>().toEqualTypeOf<1>();
    expectTypeOf<Negative<-100>>().toEqualTypeOf<100>();
  });

  test('should handle zero correctly', () => {
    expectTypeOf<Negative<0>>().toEqualTypeOf<0>();
    expectTypeOf<Negative<-0>>().toEqualTypeOf<0>();
  });

  test('should work with decimal numbers', () => {
    expectTypeOf<Negative<3.14>>().toEqualTypeOf<-3.14>();
    expectTypeOf<Negative<-3.14>>().toEqualTypeOf<3.14>();
    expectTypeOf<Negative<2.71>>().toEqualTypeOf<-2.71>();
    expectTypeOf<Negative<-2.71>>().toEqualTypeOf<2.71>();
  });

  test('should work with fractional numbers', () => {
    expectTypeOf<Negative<0.5>>().toEqualTypeOf<-0.5>();
    expectTypeOf<Negative<-0.5>>().toEqualTypeOf<0.5>();
    expectTypeOf<Negative<0.123>>().toEqualTypeOf<-0.123>();
    expectTypeOf<Negative<-0.999>>().toEqualTypeOf<0.999>();
  });

  test('should toggle signs correctly (double negation)', () => {
    expectTypeOf<Negative<Negative<5>>>().toEqualTypeOf<5>();
    expectTypeOf<Negative<Negative<-5>>>().toEqualTypeOf<-5>();
    expectTypeOf<Negative<Negative<0>>>().toEqualTypeOf<0>();
    expectTypeOf<Negative<Negative<3.14>>>().toEqualTypeOf<3.14>();
  });

  test('should work in complex type scenarios', () => {
    type Balance = 100;
    type Debt = Negative<Balance>;
    type Repayment = Negative<Debt>;

    expectTypeOf<Debt>().toEqualTypeOf<-100>();
    expectTypeOf<Repayment>().toEqualTypeOf<100>();
  });

  test('should work with large numbers', () => {
    expectTypeOf<Negative<999999>>().toEqualTypeOf<-999999>();
    expectTypeOf<Negative<-999999>>().toEqualTypeOf<999999>();
  });
});