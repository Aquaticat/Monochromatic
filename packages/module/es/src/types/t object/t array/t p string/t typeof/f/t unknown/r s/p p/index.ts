import stringify from 'safe-stringify';
import type { $ as TypeOf, } from '../../../../t/index.ts';

const noFurtherTypeOf = ['undefined', 'symbol',] as const;

export function $(value: unknown,): TypeOf {
  const typeOf = typeof value;

  if (noFurtherTypeOf.includes(typeOf,))
    return typeOf as (typeof noFurtherTypeOf)[number];

  if (typeOf === 'bigint') {
    const myValue = value as bigint;
    if (myValue === 0n)
      return [typeOf, { sign: 0, },];
    if (myValue > 0n)
      return [typeOf, { sign: 'positive', },];
    if (myValue < 0n)
      return [typeOf, { sign: 'negative', },];
    throw new Error(`bigint ${stringify(myValue,)} not equal, >, < 0n`,);
  }

  if (typeOf === 'boolean') {
    const myValue = value as boolean;
    return [typeOf, { true: myValue, },];
  }

  const prototypeString = Object.prototype.toString.call(value,);

  if (typeOf === 'function') {
    if (prototypeString === '[object Function]')
      return [typeOf, { async: false, generator: false, },];
    if (prototypeString === '[object AsyncFunction]')
      return [typeOf, { async: true, generator: false, },];
    if (prototypeString === '[object GeneratorFunction]')
      return [typeOf, { async: false, generator: true, },];
    if (prototypeString === '[object AsyncGeneratorFunction]')
      return [typeOf, { async: true, generator: true, },];
  }
}
