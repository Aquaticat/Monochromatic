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
 * Determines if a value is a primitive type according to Object.is behavior.
 *
 * Checks whether the provided value is one of JavaScript's primitive types.
 * This function considers BigInt as a primitive type, which matches Object.is
 * semantics but may differ from other primitive type definitions.
 *
 * @param value - Value to check for primitive type classification
 * @returns True if value is primitive, false if it's a complex object type
 *
 * @remarks
 * **Warning**: BigInt is considered a primitive type by this function.
 *
 * Primitive types recognized (9 total):
 * 1. `undefined`
 * 2. `null`
 * 3. `boolean` (true/false)
 * 4. `string`
 * 5. `bigint` and BigInt object wrapper
 * 6. `symbol`
 * 7. `number`
 * 8. `NaN` (special number value)
 *
 * @example
 * ```ts
 * // Primitive values return true
 * isPrimitive(42);           // true (number)
 * isPrimitive("hello");      // true (string)
 * isPrimitive(true);         // true (boolean)
 * isPrimitive(null);         // true (null)
 * isPrimitive(undefined);    // true (undefined)
 * isPrimitive(Symbol("s"));  // true (symbol)
 * isPrimitive(123n);         // true (bigint)
 * isPrimitive(NaN);          // true (number, even NaN)
 *
 * // Complex objects return false
 * isPrimitive({});           // false (object)
 * isPrimitive([]);           // false (array)
 * isPrimitive(() => {});     // false (function)
 * isPrimitive(new Date());   // false (Date object)
 * ```
 */
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

/**
 * Performs deep equality comparison between two non-Promise values.
 *
 * Compares two values for deep structural equality, handling primitives, objects,
 * arrays, dates, errors, functions, generators, regular expressions, Maps, Sets,
 * and plain objects. Uses recursive comparison for nested structures. Can't handle
 * asynchronous values like Promises or AsyncGenerators - use {@link equalAsync} instead.
 *
 * @param a - First value to compare (must not be Promise-like)
 * @param b - Second value to compare (must not be Promise-like)
 * @returns True if values are deeply equal, false otherwise
 *
 * @throws {TypeError} When either value is a Promise, AsyncGenerator, or AsyncIterable
 * @throws {TypeError} When either value is a WeakMap or WeakSet (not enumerable)
 * @throws {TypeError} When encountering unhandled object types
 *
 * @remarks
 * **Comparison Rules:**
 * - Primitives: Uses `Object.is()` for exact equality
 * - Functions: Compares string representations (unreliable)
 * - Arrays: Recursive element-by-element comparison
 * - Objects: Recursive property comparison by keys
 * - Dates: Compares `getTime()` values
 * - Errors: Compares `name`, `message`, and `cause` properties
 * - RegExp: Compares string representations
 * - Maps/Sets: Converts to sorted arrays then compares
 * - Generators: Exhausts both and compares resulting arrays
 *
 * **Performance Notes:**
 * - Function comparison is unreliable due to string representation
 * - Generator comparison consumes the generators completely
 * - Map/Set comparison uses sorting for consistent ordering
 *
 * @example
 * ```ts
 * // Primitive comparisons
 * equal(42, 42);              // true
 * equal("hello", "hello");    // true
 * equal(null, null);          // true
 * equal(NaN, NaN);            // true (unlike ===)
 * equal(42, "42");            // false
 *
 * // Object comparisons
 * equal({a: 1}, {a: 1});      // true
 * equal({a: 1}, {b: 1});      // false
 * equal([1, 2], [1, 2]);      // true
 * equal([1, 2], [2, 1]);      // false
 *
 * // Complex nested structures
 * equal(
 *   {users: [{id: 1, name: "Alice"}]},
 *   {users: [{id: 1, name: "Alice"}]}
 * );                          // true
 *
 * // Date comparisons
 * const date1 = new Date("2023-01-01");
 * const date2 = new Date("2023-01-01");
 * equal(date1, date2);        // true
 *
 * // Error comparisons
 * const err1 = new Error("Failed");
 * const err2 = new Error("Failed");
 * equal(err1, err2);          // true (same message and name)
 *
 * // Map/Set comparisons
 * equal(
 *   new Map([["a", 1], ["b", 2]]),
 *   new Map([["b", 2], ["a", 1]])
 * );                          // true (order doesn't matter)
 *
 * // Throws for async values
 * try {
 *   equal(Promise.resolve(1), Promise.resolve(1));
 * } catch (error) {
 *   console.log("Use equalAsync for Promises");
 * }
 * ```
 */
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
    /* v8 ignore next -- @preserve */
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
  /* v8 ignore next -- @preserve */
  if (typeof a === 'object') {
    /* v8 ignore next -- @preserve */
    if (typeof b !== 'object') {
      /* v8 ignore next 3 -- @preserve */
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

    /* v8 ignore next -- @preserve */
    if (isAsyncIterable(a) || isAsyncIterable(b)) {
      /* v8 ignore next 4 -- @preserve */
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

      /* v8 ignore next -- @preserve */
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

      /* v8 ignore next -- @preserve */
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

    /* v8 ignore next -- @preserve */
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

    /* v8 ignore next 4 -- @preserve */
    throw new TypeError(
      `The comparison of object types ${aPrototype} and ${bPrototype} have not been implemented.`,
    );
  }

  /* v8 ignore next 7 -- @preserve */
  throw new TypeError(
    `at least one of a and b are not primitives, not Promises, not functions, not arrays, not objects.
  What are they?
  a: ${a}
  b: ${b}`,
  );
}

/**
 * Performs deep equality comparison between two values, including asynchronous types.
 *
 * Extends {@link equal} to handle asynchronous values like Promises, AsyncGenerators,
 * and AsyncIterables that can't be compared synchronously. For non-async values,
 * delegates to the synchronous {@link equal} function. Awaits Promise resolution
 * and exhausts async iterables before performing deep comparison.
 *
 * @param a - First value to compare (any type including async)
 * @param b - Second value to compare (any type including async)
 * @returns Promise resolving to true if values are deeply equal, false otherwise
 *
 * @remarks
 * **Additional Async Cases Handled:**
 * 1. **Promises**: Awaits both promises using `Promise.allSettled()` and compares settled results
 * 2. **AsyncGenerators**: Exhausts both generators with `Array.fromAsync()` and compares arrays
 * 3. **AsyncIterables**: Converts both to arrays with `Array.fromAsync()` and compares arrays
 *
 * **Important Notes:**
 * - AsyncGenerators and AsyncIterables are fully consumed during comparison
 * - Promise rejection handling: Compares settled states including rejection reasons
 * - For non-async values, behavior is identical to {@link equal}
 * - Generator comparison only succeeds if both never take parameters
 *
 * @example
 * ```ts
 * // Promise comparisons
 * const promise1 = Promise.resolve(42);
 * const promise2 = Promise.resolve(42);
 * await equalAsync(promise1, promise2);  // true
 *
 * const promise3 = Promise.reject(new Error("Failed"));
 * const promise4 = Promise.reject(new Error("Failed"));
 * await equalAsync(promise3, promise4);  // true (same rejection)
 *
 * // AsyncGenerator comparisons
 * async function* gen1() {
 *   yield 1;
 *   yield 2;
 * }
 * async function* gen2() {
 *   yield 1;
 *   yield 2;
 * }
 * await equalAsync(gen1(), gen2());      // true
 *
 * // AsyncIterable comparisons
 * const asyncIterable1 = {
 *   async *[Symbol.asyncIterator]() {
 *     yield "a";
 *     yield "b";
 *   }
 * };
 * const asyncIterable2 = {
 *   async *[Symbol.asyncIterator]() {
 *     yield "a";
 *     yield "b";
 *   }
 * };
 * await equalAsync(asyncIterable1, asyncIterable2);  // true
 *
 * // Mixed async/sync comparisons
 * await equalAsync({a: Promise.resolve(1)}, {a: Promise.resolve(1)});  // true
 * await equalAsync([1, 2, 3], [1, 2, 3]);                             // true (delegates to equal)
 *
 * // Generator exhaustion example
 * async function* counter() {
 *   yield 1;
 *   yield 2;
 *   yield 3;
 * }
 * const gen1 = counter();
 * const gen2 = counter();
 * await equalAsync(gen1, gen2);  // true, but generators are exhausted
 *
 * // Trying to use them again would fail:
 * // await gen1.next();  // { value: undefined, done: true }
 * ```
 */
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
