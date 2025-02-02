import {
  isAsyncGenerator,
  isAsyncIterable,
  isError,
  isGenerator,
  isMap,
  isObject,
  isObjectDate,
  isObjectRegexp,
  isPromise,
  isSet,
  isString,
  isWeakMap,
  isWeakSet,
  logtapeGetLogger,
  type NotPromise,
} from '@monochromatic-dev/module-es/ts';

const l = logtapeGetLogger(['m', 'boolean.equal']);

// TODO: Do not consider BigInt a primitive.
// Write three functions in total to better express the intended purpose.

/**
 Warning: BigInt is considered a primitive.

 @param value any value to check

 @returns if the value is primitive.
 We define primitive here in terms of what Object.is considers to be primitive:

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
/* @__NO_SIDE_EFFECTS__ */ export function isPrimitive(value: any): boolean {
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

/* @__NO_SIDE_EFFECTS__ */ export function equal(a: NotPromise, b: NotPromise): boolean {
  // TODO: Check for object value equality, not strict equality.
  // MAYBE: Switch to @std/assert, and use error handling.
  //        It'd be ugly but at least I'd offload the burden.

  // logtape doesn't support serializing BigInt yet,
  // so we have to do it ourselves before reaching the point we can be sure none is BigInt.
  // TODO: Raise an issue to logtape or do a pr
  //
  /* FTL logtape·meta Failed to emit a log record to sink [Function: sink] {
  [length]: 1,
  [name]: 'sink',
  [Symbol(nodejs.dispose)]: [Function (anonymous)] { [length]: 0, [name]: '' }
  }: TypeError: Do not know how to serialize a BigInt
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
  [message]: 'Do not know how to serialize a BigInt'
  } */
  l.debug`a: ${String(a)}, b: ${String(b)}`;

  // Check for referencial equality and equality of primitive values.
  if (Object.is(a, b)) {
    return true;
  }

  l.debug`ref/primitive eq failed on a: ${String(a)}, b: ${String(b)}`;

  // We failed the referencial equality check,
  // and if any of a and b is a primitive value,
  // we have determined they are in fact not equal.
  if (isPrimitive(a) || isPrimitive(b)) {
    l.debug`At least one of a: ${String(a)} and b: ${String(b)} is primitive`;
    return false;
  }

  l.debug`non-primitives a: ${a}, b: ${b}`;

  // a and b are both non-primitive values. What now?
  // Let's narrow down the other cases one by one.

  // We cannot handle comparing Promises in this sync version isEqual.
  // Let's bail.
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
    Nor were the functions converted to there AST form.
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

    // Now that we know a and b are arrays of the same length,
    // let's compare all the values within them.
    return a.every((aValue, aIndex) =>
      // Have to do a recursion here because the two arrays might not just contain primitives.
      equal(aValue, b[aIndex])
    );
  }

  // Not providing a predicate for typeof a === 'object'
  // because it's rarely useful knowing something is an object,
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
          We cannot handle comparing them in a sync function.
          Try equalAsync()`);
    }

    if (isAsyncIterable(a) || isAsyncIterable(b)) {
      throw new TypeError(`At least one of a: ${a} and b: ${b} is an AsyncIterable.
      We cannot handle comparing them in a sync function.
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

      if (a.getTime() === b.getTime()) {
        return true;
      }
      return false;
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

      if (a.valueOf() === b.valueOf()) {
        return true;
      }
      return false;
    }

    if (isError(a)) {
      if (!isError(b)) {
        l.info`Is it intentional trying to compare a error a: ${a} to not error b: ${b}?`;
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

      if (equal(a?.cause, b?.cause)) {
        return true;
      }

      return false;
    }

    if (isGenerator(a)) {
      if (!isGenerator(b)) {
        l
          .info`Is it intentional trying to compare a Generator a: ${a} to not a Generator b: ${b}?`;
        return false;
      }

      l
        .info`comparing two Generators would only succeed
        if both of them never takes any parameters.`;

      return equal(Array.from(a), Array.from(b));
    }

    if (isObjectRegexp(a)) {
      if (!isObjectRegexp(b)) {
        l
          .info`Is it intentional trying to compare a regex a: ${a} to not a regex b: ${b}?`;
        return false;
      }

      l.debug`regexps a: ${a} b: ${b}`;

      // TODO: Is this enough? I sure hope so.
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

      return equal(Array.from(a), Array.from(b));
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

      return equal(Array.from(a), Array.from(b));
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
 We only handle two additional cases than {@inheritDoc equal}:
 1.  Both a and b are Promises
 2.  Both a and b are AsyncGenerators | AsyncIterables
 */
/* @__NO_SIDE_EFFECTS__ */ export async function equalAsync(a: any,
  b: any): Promise<boolean>
{
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
    if both of them never takes any parameters.`;
    return equal(await Array.fromAsync(a), await Array.fromAsync(b));
  }

  if (isAsyncIterable(a) && isAsyncIterable(b)) {
    return equal(await Array.fromAsync(a), await Array.fromAsync(b));
  }

  return equal(a, b);
}

// TODO: Write a better typeof leveraging Object.prototype.toString.call
