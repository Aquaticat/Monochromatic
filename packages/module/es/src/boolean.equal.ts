import { isError } from './error.is.ts';
import {
  isAsyncGenerator,
  isAsyncIterable,
  isGenerator,
  isMap,
  isObject,
  isSet,
  isWeakMap,
  isWeakSet,
} from './iterable.is.ts';
import { logtapeGetLogger } from './logtape.shared.ts';
import { isObjectDate } from './numeric.is.ts';
import { isPromise } from './promise.is.ts';
import type { NotPromise } from './promise.type.ts';
import {
  isObjectRegexp,
  isString,
} from './string.is.ts';

const l = logtapeGetLogger(['m', 'boolean.equal']);

/* vale alex.Race = NO */
// TODO: Don't consider BigInt a primitive.
// Write three functions in total to better express the intended purpose.

/**
 Warning: BigInt is considered a primitive.

 @param value any value to check

 @returns if the value is primitive.
  A primitive is defined here in terms of what Object.is considers to be primitive:

  1.  undefined
  2.  null
  3.  true
  4.  false
  5.  string
  6.  bigint and BigInt
  7.  symbol
  8.  number
  9.  NaN
 */

/* @__NO_SIDE_EFFECTS__ */
export function isPrimitive(value: any): boolean {
  /* vale alex.Race = YES */
  if (Object.is(value, undefined)) {
    return true;
  }
  if (Object.is(value, null)) {
    return true;
  }
  if (typeof value === 'boolean') {
    return true;
  }
  if (isString(value)) {
    return true;
  }
  if (
    typeof value === 'bigint'
    || Object.prototype.toString.call(value) === '[object BigInt]'
  ) {
    return true;
  }
  if (typeof value === 'symbol') {
    return true;
  }

  // typeof Number.NaN is also number
  if (typeof value === 'number') {
    return true;
  }

  l.debug`value ${value} is not a primitive`;
  return false;
}

/* @__NO_SIDE_EFFECTS__ */
export function equal(a: NotPromise, b: NotPromise): boolean {
  // TODO: Check for object value equality, not strict equality.
  // MAYBE: Switch to @std/assert, and use error handling.
  //        It'd be ugly but at least the burden would be offloaded.

  // logtape doesn't support serializing BigInt yet,
  // so it has to be done manually before reaching the point where it can be ensured none is BigInt.
  // TODO: Raise an issue to logtape or do a pr
  //
  /* FTL logtape·meta Failed to emit a log record to sink [Function: sink] {
   [length]: 1,
   [name]: 'sink',
   [Symbol(nodejs.dispose)]: [Function (anonymous)] { [length]: 0, [name]: '' }
   }: TypeError: Don't know how to serialize a BigInt
   at JSON.stringify (<anonymous>)
   at formatter (file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/packages/module/util/dist/final/boolean.equal.test.js:2374:26)
   at sink (file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/.yarn/cache/@jsr-logtape__logtape-npm-0.4.2-d81e45c652-a49422555c.zip/node_modules/@jsr/logtape__logtape/logtape/sink.js:91:42)
   at LoggerImpl.emit (file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/.yarn/cache/@jsr-logtape__logtape-npm-0.4.2-d81e45c652-a49422555c.zip/node_modules/@jsr/logtape__logtape/logtape/logger.js:94:9)
   at LoggerImpl.logTemplate (file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/.yarn/cache/@jsr-logtape__logtape-npm-0.4.2-d81e45c652-a49422555c.zip/node_modules/@jsr/logtape__logtape/logtape/logger.js:144:10)
   at LoggerImpl.debug (file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/.yarn/cache/@jsr-logtape__logtape-npm-0.4.2-d81e45c652-a49422555c.zip/node_modules/@jsr/logtape__logtape/logtape/logger.js:158:12)
   at equal (file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/packages/module/util/dist/final/boolean.equal.test.js:2032:10)
   at file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/packages/module/util/dist/final/boolean.equal.test.js:2513:14
   at test (file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/packages/module/util/dist/final/boolean.equal.test.js:2477:24)
   at file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/packages/module/util/dist/final/boolean.equal.test.js:2512:5 {
   [stack]: [Getter/Setter],
   [message]: 'Don't know how to serialize a BigInt'
   } */
  l.debug`a: ${String(a)}, b: ${String(b)}`;

  // Check for referential equality and equality of primitive values.
  if (Object.is(a, b)) {
    return true;
  }

  l.debug`ref/primitive eq failed on a: ${String(a)}, b: ${String(b)}`;

  // The referential equality check failed,
  // and if any of a and b is a primitive value,
  // it has been determined they're in fact not equal.
  if (isPrimitive(a) || isPrimitive(b)) {
    l.debug`At least one of a: ${String(a)} and b: ${String(b)} is primitive`;
    return false;
  }

  l.debug`non-primitives a: ${a}, b: ${b}`;

  // a and b are both non-primitive values. What now?
  // Let's narrow down the other cases one by one.

  // Comparing Promises can't be handled in this sync version isEqual.
  // The process will stop here.
  if (isPromise(a) || isPromise(b)) {
    throw new TypeError(`At least one of a: ${a} and b: ${b} is a thenable.
      We cannot handle comparing them in a sync function.
      Try equalAsync()`);
  }

  if (typeof a === 'function') {
    if (typeof b !== 'function') {
      l
        .info`Is it intentional trying to compare a function a: ${a} to not function b: ${b}?`;
      return false;
    }

    l
      .warn`cannot compare two functions accurately due to the inherent unpredictability of functions.
    See https://stackoverflow.com/a/32061834 by https://stackoverflow.com/users/1742789/julian-de-bhal
    The string representations of both functions are not normalized before comparison.
    Nor were the functions converted to their AST form.
    Therefore, this comparison has a high chance of giving a false negative or false positive.
    `;
    return `${a}` === `${b}`;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      l.info`Is it intentional trying to compare an array a: ${a} to not array b: ${b}?`;
      return false;
    }

    l.debug`arrays a: ${a} b: ${b}`;

    if (a.length !== b.length) {
      return false;
    }

    if (a.length === 0) {
      return true;
    }

    // Now that it's known that a and b are arrays of the same length,
    // the values within them will be compared.
    return a.every((aValue, aIndex) =>
      // A recursion is necessary here because the two arrays might not just contain primitives.
      equal(aValue, b[aIndex])
    );
  }

  // A predicate for typeof a === 'object' isn't provided
  // because it's not often useful knowing something is an object,
  // but not what subtype of object it is.
  if (typeof a === 'object') {
    if (typeof b !== 'object') {
      l
        .warn`b is not a primitive, not a Promise, not a function, not an array, not an object.
        What is b: ${b}?`;
      return false;
    }

    l.debug`objects a: ${a} b: ${b}`;

    const aPrototype = Object.prototype.toString.call(a);
    const bPrototype = Object.prototype.toString.call(b);

    // Test for gen ahead of iterable because gen may have more behaviors.
    if (
      isAsyncGenerator(a)
      || isAsyncGenerator(b)
    ) {
      throw new TypeError(`At least one of a: ${a} and b: ${b} is an AsyncGenerator.
          Comparing them cannot be handled in a sync function.
          Try equalAsync()`);
    }

    if (isAsyncIterable(a) || isAsyncIterable(b)) {
      throw new TypeError(`At least one of a: ${a} and b: ${b} is an AsyncIterable.
      Comparing them cannot be handled in a sync function.
      Try equalAsync()`);
    }

    if (
      isObjectDate(a)
    ) {
      if (!isObjectDate(b)) {
        l.info`Is it intentional trying to compare a Date a: ${a} to not a Date b: ${b}?`;
        return false;
      }

      l.debug`dates a: ${a} b: ${b}`;

      return a.getTime() === b.getTime();
    }

    if (
      aPrototype === '[object Boolean]'
    ) {
      l
        .warn`The use of Boolean() the object wrapper is greatly discouraged. Found a: ${a}`;

      if (bPrototype !== '[object Boolean]') {
        l
          .info`Is it intentional trying to compare a Boolean wrapped a: ${a} to not a Boolean wrapped b: ${b}?`;
        return false;
      }

      l.debug`Boolean wraps a: ${a} b: ${b}`;

      return a.valueOf() === b.valueOf();
    }

    if (isError(a)) {
      if (!isError(b)) {
        l
          .info`Is it intentional trying to compare an error a: ${a} to not error b: ${b}?`;
        return false;
      }

      l.debug`Errors a: ${a} b: ${b}`;

      if (a.message !== b.message) {
        return false;
      }

      if (a.name !== b.name) {
        l
          .info`Is it intentional,
          giving two errors of different classes a: ${a.name} b: ${b.name}
          the same message: ${a.message}?`;
        return false;
      }

      return equal(a?.cause, b?.cause);
    }

    if (isGenerator(a)) {
      if (!isGenerator(b)) {
        l
          .info`Is it intentional trying to compare a Generator a: ${a} to not a Generator b: ${b}?`;
        return false;
      }

      l
        .info`comparing two Generators would only succeed
        if both of them never take any parameters.`;

      return equal([...a], [...b]);
    }

    if (isObjectRegexp(a)) {
      if (!isObjectRegexp(b)) {
        l
          .info`Is it intentional trying to compare a regex a: ${a} to not a regex b: ${b}?`;
        return false;
      }

      l.debug`regexps a: ${a} b: ${b}`;

      // TODO: Is this enough? This should be sufficient.
      return `${a}` === `${b}`;
    }

    // TODO: Turn those prototype comparisions into type predicates.
    if (isMap(a)) {
      if (!isMap(b)) {
        l.info`Is it intentional trying to compare a map a: ${a} to not a map b: ${b}?`;
        return false;
      }

      l.debug`maps a: ${a} b: ${b}`;

      if (a.size !== b.size) {
        return false;
      }

      if (a.size === 0) {
        return true;
      }

      return equal([...a].toSorted(), [...b].toSorted());
    }

    if (isSet(a)) {
      if (!isSet(b)) {
        l.info`Is it intentional trying to compare a set a: ${a} to not a set b: ${b}?`;
        return false;
      }

      l.debug`sets a: ${a} b: ${b}`;

      if (a.size !== b.size) {
        return false;
      }

      if (a.size === 0) {
        return true;
      }

      return equal([...a].toSorted(), [...b].toSorted());
    }

    if (isWeakMap(a) || isWeakMap(b)) {
      throw new TypeError(`WeakMaps are not enumerable, therefore cannot be compared.`);
    }

    if (isWeakSet(a) || isWeakSet(b)) {
      throw new TypeError(`WeakSets are not enumerable, therefore cannot be compared.`);
    }

    if (isObject(a)) {
      l
        .info`Comparing two objects cannot rule out Proxy objects. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy#constructor`;

      if (!isObject(b)) {
        l
          .info`Is it intentional trying to compare an object Object a: ${a} to not an object Object b: ${b}?`;
        return false;
      }

      l.debug`Objects a: ${a} b: ${b}`;

      if (Object.keys(a).length !== Object.keys(b).length) {
        return false;
      }

      return Object.keys(a).every((aKey) => equal(a[aKey], b[aKey]));
    }

    throw new TypeError(
      `The comparison of object types ${aPrototype} and ${bPrototype} have not been implemented.`,
    );
  }

  throw new TypeError(
    `at least one of a and b are not primitives, not Promises, not functions, not arrays, not objects.
  What are they?
  a: ${a}
  b: ${b}`,
  );
}

/**
 @remarks
 Two additional cases are handled compared to {@inheritDoc equal}:
 1.  Both a and b are Promises
 2.  Both a and b are AsyncGenerators | AsyncIterables
 */

/* @__NO_SIDE_EFFECTS__ */
export async function equalAsync(a: any, b: any): Promise<boolean> {
  if (isPromise(a) || isPromise(b)) {
    l.debug`Promises a: ${a} b: ${b}`;

    // TODO: Test a and b are both rejected with the same reason.
    const [settledA, settledB] = await Promise.allSettled([a, b]);
    l.debug`settled a: ${settledA} b: ${settledB}`;
    return equal(settledA, settledB);
  }

  if (
    isAsyncGenerator(a) && isAsyncGenerator(b)
  ) {
    l.info`Comparing two Generators or AsyncGenerators can only succeed
    if both of them never take any parameters.`;
    return equal(await Array.fromAsync(a), await Array.fromAsync(b));
  }

  if (isAsyncIterable(a) && isAsyncIterable(b)) {
    return equal(await Array.fromAsync(a), await Array.fromAsync(b));
  }

  return equal(a, b);
}

// TODO: Write a better typeof leveraging Object.prototype.toString.call
