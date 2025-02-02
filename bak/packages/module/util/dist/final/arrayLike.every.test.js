var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/arrayLike.every.test.ts
import { configure } from "@logtape/logtape";

// src/arrayLike.is.ts
var isArray = Array.isArray;
// @__NO_SIDE_EFFECTS__
function isAsyncIterable(value) {
  return typeof value?.[Symbol.asyncIterator] === "function";
}
__name(isAsyncIterable, "isAsyncIterable");
// @__NO_SIDE_EFFECTS__
function isMap(value) {
  return Object.prototype.toString.call(value) === "[object Map]";
}
__name(isMap, "isMap");
// @__NO_SIDE_EFFECTS__
function isWeakMap(value) {
  return Object.prototype.toString.call(value) === "[object WeakMap]";
}
__name(isWeakMap, "isWeakMap");
// @__NO_SIDE_EFFECTS__
function isSet(value) {
  return Object.prototype.toString.call(value) === "[object Set]";
}
__name(isSet, "isSet");
// @__NO_SIDE_EFFECTS__
function isWeakSet(value) {
  return Object.prototype.toString.call(value) === "[object WeakSet]";
}
__name(isWeakSet, "isWeakSet");
// @__NO_SIDE_EFFECTS__
function isObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}
__name(isObject, "isObject");
// @__NO_SIDE_EFFECTS__
function isAsyncGenerator(value) {
  return Object.prototype.toString.call(value) === "[object AsyncGenerator]";
}
__name(isAsyncGenerator, "isAsyncGenerator");
// @__NO_SIDE_EFFECTS__
function isGenerator(value) {
  return Object.prototype.toString.call(value) === "[object Generator]";
}
__name(isGenerator, "isGenerator");

// src/arrayLike.from.ts
// @__NO_SIDE_EFFECTS__
async function arrayFromAsync(arrayLike, mapFn) {
  const arrayLikeArray = isArray(arrayLike) ? arrayLike : await (async (arrayLike2) => {
    const newArrayLikeArray = [];
    for await (const element of arrayLike2) {
      newArrayLikeArray.push(element);
    }
    return newArrayLikeArray;
  })(arrayLike);
  if (!mapFn) {
    return arrayLikeArray;
  }
  const promisableArray = [];
  let index = 0;
  for (const element of arrayLikeArray) {
    promisableArray.push(mapFn(element, index));
    index++;
  }
  return await Promise.all(promisableArray);
}
__name(arrayFromAsync, "arrayFromAsync");
// @__NO_SIDE_EFFECTS__
function arrayFrom(arrayLike, mapFn) {
  const arrayLikeArray = isArray(arrayLike) ? arrayLike : ((arrayLike2) => {
    const newArrayLikeArray = [];
    for (const element of arrayLike2) {
      newArrayLikeArray.push(element);
    }
    return newArrayLikeArray;
  })(arrayLike);
  if (!mapFn) {
    return arrayLikeArray;
  }
  const mappedArray = [];
  let index = 0;
  for (const element of arrayLikeArray) {
    mappedArray.push(mapFn(element, index));
    index++;
  }
  return mappedArray;
}
__name(arrayFrom, "arrayFrom");

// src/arrayLike.map.ts
// @__NO_SIDE_EFFECTS__
async function mapArrayLikeAsync(mappingFn, arrayLike) {
  return await arrayFromAsync(arrayLike, mappingFn);
}
__name(mapArrayLikeAsync, "mapArrayLikeAsync");
// @__NO_SIDE_EFFECTS__
function mapArrayLike(mappingFn, arrayLike) {
  return arrayFrom(arrayLike, mappingFn);
}
__name(mapArrayLike, "mapArrayLike");

// src/boolean.equal.ts
import { getLogger as getLogger3 } from "@logtape/logtape";

// src/error.assert.equal.ts
// @__NO_SIDE_EFFECTS__
function assert(expected, actual) {
  equalsOrThrow(expected)(actual);
}
__name(assert, "assert");
// @__NO_SIDE_EFFECTS__
function assertTrue(actual) {
  /* @__PURE__ */ assert(true, actual);
}
__name(assertTrue, "assertTrue");
// @__NO_SIDE_EFFECTS__
function assertFalse(actual) {
  /* @__PURE__ */ assert(false, actual);
}
__name(assertFalse, "assertFalse");

// src/error.assert.throw.ts
import { getLogger } from "@logtape/logtape";
var l = getLogger(["m", "error.assert.throw"]);
// @__NO_SIDE_EFFECTS__
async function assertThrowAsync(error, fn) {
  try {
    await fn();
  } catch (actualError) {
    l.debug`assertThrowAsync(error: ${error}, fn: ${String(fn)}), actualError: ${// TODO: Raise issue on logtape for better stringify of fn and error
    String(actualError)}`;
    if (typeof error === "function") {
      if (!(actualError instanceof error)) {
        throw new Error(`actualError ${actualError} does not match error: ${error}`);
      }
      return;
    }
    const equalErrorOrThrow = equalsOrThrow(error);
    if (error instanceof Error) {
      equalErrorOrThrow(actualError);
      return;
    }
    if (typeof error !== "string") {
      throw new Error(`unexpected type ${typeof error} of expected error: ${error}`);
    }
    if (error === "Error") {
      if (!(actualError instanceof Error)) {
        throw new Error(`actualError ${actualError} is not an Error`);
      }
      return;
    }
    if (error.endsWith("Error")) {
      equalErrorOrThrow(actualError?.name);
      return;
    }
    equalErrorOrThrow(actualError.message);
    return;
  }
  throw new Error(`fn ${fn} unexpectedly didn't throw`);
}
__name(assertThrowAsync, "assertThrowAsync");
// @__NO_SIDE_EFFECTS__
async function assertThrowRangeErrorAsync(fn) {
  await /* @__PURE__ */ assertThrowAsync("RangeError", fn);
}
__name(assertThrowRangeErrorAsync, "assertThrowRangeErrorAsync");

// src/error.is.ts
// @__NO_SIDE_EFFECTS__
function isError(value) {
  return Object.prototype.toString.call(value) === "[object Error]";
}
__name(isError, "isError");

// src/numeric.is.ts
// @__NO_SIDE_EFFECTS__
function isObjectDate(value) {
  return Object.prototype.toString.call(value) === "[object Date]";
}
__name(isObjectDate, "isObjectDate");

// src/promise.is.ts
// @__NO_SIDE_EFFECTS__
function isPromise(value) {
  return typeof value?.then === "function";
}
__name(isPromise, "isPromise");

// src/promise.some.ts
import { getLogger as getLogger2 } from "@logtape/logtape";
var l2 = getLogger2(["m", "promise.some"]);
// @__NO_SIDE_EFFECTS__
async function somePromises(predicate, promises) {
  if (isArray(promises)) {
    try {
      const promiseRaceResult = await Promise.any(
        mapArrayLike(
          /* @__PURE__ */ __name(async function callbackThrowing(input) {
            const awaitedInput = await input;
            const callbackResult = await predicate(awaitedInput);
            if (!callbackResult) {
              throw new Error(
                `callback ${String(predicate)} evals to false for ${awaitedInput}`
              );
            }
            return callbackResult;
          }, "callbackThrowing"),
          promises
        )
      );
      return promiseRaceResult;
    } catch (promiseRaceError) {
      l2.info`${promiseRaceError}`;
      return false;
    }
  }
  for await (const promise of promises) {
    try {
      await predicate(promise);
      return true;
    } catch (callbackError) {
      l2.info`${callbackError}`;
    }
  }
  return false;
}
__name(somePromises, "somePromises");

// src/string.is.ts
// @__NO_SIDE_EFFECTS__
function isString(value) {
  return typeof value === "string";
}
__name(isString, "isString");
// @__NO_SIDE_EFFECTS__
function isRegexp(value) {
  return Object.prototype.toString.call(value) === "[object RegExp]";
}
__name(isRegexp, "isRegexp");

// src/boolean.equal.ts
var l3 = getLogger3(["m", "boolean.equal"]);
// @__NO_SIDE_EFFECTS__
function isPrimitive(value) {
  if (Object.is(value, void 0)) {
    return true;
  }
  if (Object.is(value, null)) {
    return true;
  }
  if (typeof value === "boolean") {
    return true;
  }
  if (isString(value)) {
    return true;
  }
  if (typeof value === "bigint" || Object.prototype.toString.call(value) === "[object BigInt]") {
    return true;
  }
  if (typeof value === "symbol") {
    return true;
  }
  if (typeof value === "number") {
    return true;
  }
  l3.debug`value ${value} is not a primitive`;
  return false;
}
__name(isPrimitive, "isPrimitive");
// @__NO_SIDE_EFFECTS__
function equal(a, b) {
  l3.debug`a: ${String(a)}, b: ${String(b)}`;
  if (Object.is(a, b)) {
    return true;
  }
  l3.debug`ref/primitive eq failed on a: ${String(a)}, b: ${String(b)}`;
  if (/* @__PURE__ */ isPrimitive(a) || /* @__PURE__ */ isPrimitive(b)) {
    l3.debug`At least one of a: ${String(a)} and b: ${String(b)} is primitive`;
    return false;
  }
  l3.debug`non-primitives a: ${a}, b: ${b}`;
  if (isPromise(a) || isPromise(b)) {
    throw new TypeError(`At least one of a: ${a} and b: ${b} is a thenable.
      We cannot handle comparing them in a sync function.
      Try equalAsync()`);
  }
  if (typeof a === "function") {
    if (typeof b !== "function") {
      l3.info`Is it intentional trying to compare a function a: ${a} to not function b: ${b}?`;
      return false;
    }
    l3.warn`cannot compare two functions accurately due to the inherent unpredictability of functions.
    See https://stackoverflow.com/a/32061834 by https://stackoverflow.com/users/1742789/julian-de-bhal
    The string representations of both functions are not normalized before comparison.
    Nor were the functions converted to there AST form.
    Therefore, this comparison has a high chance of giving a false negative or false positive.
    `;
    return `${a}` === `${b}`;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      l3.info`Is it intentional trying to compare an array a: ${a} to not array b: ${b}?`;
      return false;
    }
    l3.debug`arrays a: ${a} b: ${b}`;
    if (a.length !== b.length) {
      return false;
    }
    if (a.length === 0) {
      return true;
    }
    return a.every(
      (aValue, aIndex) => (
        // Have to do a recursion here because the two arrays might not just contain primitives.
        /* @__PURE__ */ equal(aValue, b[aIndex])
      )
    );
  }
  if (typeof a === "object") {
    if (typeof b !== "object") {
      l3.warn`b is not a primitive, not a Promise, not a function, not an array, not an object.
        What is b: ${b}?`;
      return false;
    }
    l3.debug`objects a: ${a} b: ${b}`;
    const aPrototype = Object.prototype.toString.call(a);
    const bPrototype = Object.prototype.toString.call(b);
    if (isAsyncGenerator(a) || isAsyncGenerator(b)) {
      throw new TypeError(`At least one of a: ${a} and b: ${b} is an AsyncGenerator.
          We cannot handle comparing them in a sync function.
          Try equalAsync()`);
    }
    if (isAsyncIterable(a) || isAsyncIterable(b)) {
      throw new TypeError(`At least one of a: ${a} and b: ${b} is an AsyncIterable.
      We cannot handle comparing them in a sync function.
      Try equalAsync()`);
    }
    if (isObjectDate(a)) {
      if (!isObjectDate(b)) {
        l3.info`Is it intentional trying to compare a Date a: ${a} to not a Date b: ${b}?`;
        return false;
      }
      l3.debug`dates a: ${a} b: ${b}`;
      if (a.getTime() === b.getTime()) {
        return true;
      }
      return false;
    }
    if (aPrototype === "[object Boolean]") {
      l3.warn`The use of Boolean() the object wrapper is greatly discouraged. Found a: ${a}`;
      if (bPrototype !== "[object Boolean]") {
        l3.info`Is it intentional trying to compare a Boolean wrapped a: ${a} to not a Boolean wrapped b: ${b}?`;
        return false;
      }
      l3.debug`Boolean wraps a: ${a} b: ${b}`;
      if (a.valueOf() === b.valueOf()) {
        return true;
      }
      return false;
    }
    if (isError(a)) {
      if (!isError(b)) {
        l3.info`Is it intentional trying to compare a error a: ${a} to not error b: ${b}?`;
        return false;
      }
      l3.debug`Errors a: ${a} b: ${b}`;
      if (a.message !== b.message) {
        return false;
      }
      if (a.name !== b.name) {
        l3.info`Is it intentional,
          giving two errors of different classes a: ${a.name} b: ${b.name}
          the same message: ${a.message}?`;
        return false;
      }
      if (/* @__PURE__ */ equal(a?.cause, b?.cause)) {
        return true;
      }
      return false;
    }
    if (isGenerator(a)) {
      if (!isGenerator(b)) {
        l3.info`Is it intentional trying to compare a Generator a: ${a} to not a Generator b: ${b}?`;
        return false;
      }
      l3.info`comparing two Generators would only succeed
        if both of them never takes any parameters.`;
      return /* @__PURE__ */ equal(arrayFrom(a), arrayFrom(b));
    }
    if (isRegexp(a)) {
      if (!isRegexp(b)) {
        l3.info`Is it intentional trying to compare a regex a: ${a} to not a regex b: ${b}?`;
        return false;
      }
      l3.debug`regexps a: ${a} b: ${b}`;
      return `${a}` === `${b}`;
    }
    if (isMap(a)) {
      if (!isMap(b)) {
        l3.info`Is it intentional trying to compare a map a: ${a} to not a map b: ${b}?`;
        return false;
      }
      l3.debug`maps a: ${a} b: ${b}`;
      if (a.size !== b.size) {
        return false;
      }
      if (a.size === 0) {
        return true;
      }
      return /* @__PURE__ */ equal(arrayFrom(a), arrayFrom(b));
    }
    if (isSet(a)) {
      if (!isSet(b)) {
        l3.info`Is it intentional trying to compare a set a: ${a} to not a set b: ${b}?`;
        return false;
      }
      l3.debug`sets a: ${a} b: ${b}`;
      if (a.size !== b.size) {
        return false;
      }
      if (a.size === 0) {
        return true;
      }
      return /* @__PURE__ */ equal(arrayFrom(a), arrayFrom(b));
    }
    if (isWeakMap(a) || isWeakMap(b)) {
      throw new TypeError(`WeakMaps are not enumerable, therefore cannot be compared.`);
    }
    if (isWeakSet(a) || isWeakSet(b)) {
      throw new TypeError(`WeakSets are not enumerable, therefore cannot be compared.`);
    }
    if (isObject(a)) {
      l3.info`Comparing two objects cannot rule out Proxy objects. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy#constructor`;
      if (!isObject(b)) {
        l3.info`Is it intentional trying to compare an object Object a: ${a} to not an object Object b: ${b}?`;
        return false;
      }
      l3.debug`Objects a: ${a} b: ${b}`;
      if (Object.keys(a).length !== Object.keys(b).length) {
        return false;
      }
      return Object.keys(a).every((aKey) => /* @__PURE__ */ equal(a[aKey], b[aKey]));
    }
    throw new TypeError(
      `The comparison of object types ${aPrototype} and ${bPrototype} have not been implemented.`
    );
  }
  throw new TypeError(
    `at least one of a and b are not primitives, not Promises, not functions, not arrays, not objects.
  What are they?
  a: ${a}
  b: ${b}`
  );
}
__name(equal, "equal");

// src/boolean.not.ts
// @__NO_SIDE_EFFECTS__
function BooleanNot(value) {
  return !value;
}
__name(BooleanNot, "BooleanNot");

// src/function.equals.ts
// @__NO_SIDE_EFFECTS__
function equalsOrThrow(equalTo) {
  return function(input) {
    if (equal(input, equalTo)) {
      return input;
    }
    throw new Error(`input ${input} isn't equal to ${equalTo}`);
  };
}
__name(equalsOrThrow, "equalsOrThrow");

// src/function.is.ts
// @__NO_SIDE_EFFECTS__
function isSyncFunction(fn) {
  return fn.constructor.name === "Function";
}
__name(isSyncFunction, "isSyncFunction");

// src/function.pipe.ts
// @__NO_SIDE_EFFECTS__
function pipeAsync(fn0, fn1, fn2, fn3, fn4, fn5, fn6, fn7, fn8, fn9) {
  if (!fn1) {
    return fn0;
  }
  if (!fn2) {
    if (isSyncFunction(fn0) && isSyncFunction(fn1)) {
      return /* @__PURE__ */ __name(function fn0to1(...inputs) {
        return fn1(fn0(...inputs));
      }, "fn0to1");
    }
    return /* @__PURE__ */ __name(async function fn0to1(...inputs) {
      return await fn1(await fn0(...inputs));
    }, "fn0to1");
  }
  if (!fn3) {
    if (isSyncFunction(fn0) && isSyncFunction(fn1) && isSyncFunction(fn2)) {
      return /* @__PURE__ */ __name(function fn0to2(...inputs) {
        return fn2(fn1(fn0(...inputs)));
      }, "fn0to2");
    }
    return /* @__PURE__ */ __name(async function fn0to2(...inputs) {
      return await fn2(await fn1(await fn0(...inputs)));
    }, "fn0to2");
  }
  if (!fn4) {
    if (isSyncFunction(fn0) && isSyncFunction(fn1) && isSyncFunction(fn2) && isSyncFunction(fn3)) {
      return /* @__PURE__ */ __name(function fn0to3(...inputs) {
        return fn3(fn2(fn1(fn0(...inputs))));
      }, "fn0to3");
    }
    return /* @__PURE__ */ __name(async function fn0to3(...inputs) {
      return await fn3(await fn2(await fn1(await fn0(...inputs))));
    }, "fn0to3");
  }
  if (!fn5) {
    if (isSyncFunction(fn0) && isSyncFunction(fn1) && isSyncFunction(fn2) && isSyncFunction(fn3) && isSyncFunction(fn4)) {
      return /* @__PURE__ */ __name(function fn0to4(...inputs) {
        return fn4(fn3(fn2(fn1(fn0(...inputs)))));
      }, "fn0to4");
    }
    return /* @__PURE__ */ __name(async function fn0to4(...inputs) {
      return await fn4(await fn3(await fn2(await fn1(await fn0(...inputs)))));
    }, "fn0to4");
  }
  if (!fn6) {
    if (isSyncFunction(fn0) && isSyncFunction(fn1) && isSyncFunction(fn2) && isSyncFunction(fn3) && isSyncFunction(fn4) && isSyncFunction(fn5)) {
      return /* @__PURE__ */ __name(function fn0to5(...inputs) {
        return fn5(fn4(fn3(fn2(fn1(fn0(...inputs))))));
      }, "fn0to5");
    }
    return /* @__PURE__ */ __name(async function fn0to5(...inputs) {
      return await fn5(await fn4(await fn3(await fn2(await fn1(await fn0(...inputs))))));
    }, "fn0to5");
  }
  if (!fn7) {
    if (isSyncFunction(fn0) && isSyncFunction(fn1) && isSyncFunction(fn2) && isSyncFunction(fn3) && isSyncFunction(fn4) && isSyncFunction(fn5) && isSyncFunction(fn6)) {
      return /* @__PURE__ */ __name(function fn0to6(...inputs) {
        return fn6(fn5(fn4(fn3(fn2(fn1(fn0(...inputs)))))));
      }, "fn0to6");
    }
    return /* @__PURE__ */ __name(async function fn0to6(...inputs) {
      return await fn6(
        await fn5(await fn4(await fn3(await fn2(await fn1(await fn0(...inputs))))))
      );
    }, "fn0to6");
  }
  if (!fn8) {
    if (isSyncFunction(fn0) && isSyncFunction(fn1) && isSyncFunction(fn2) && isSyncFunction(fn3) && isSyncFunction(fn4) && isSyncFunction(fn5) && isSyncFunction(fn6) && isSyncFunction(fn7)) {
      return /* @__PURE__ */ __name(function fn0to7(...inputs) {
        return fn7(fn6(fn5(fn4(fn3(fn2(fn1(fn0(...inputs))))))));
      }, "fn0to7");
    }
    return /* @__PURE__ */ __name(async function fn0to7(...inputs) {
      return await fn7(
        await fn6(
          await fn5(await fn4(await fn3(await fn2(await fn1(await fn0(...inputs))))))
        )
      );
    }, "fn0to7");
  }
  if (!fn9) {
    if (isSyncFunction(fn0) && isSyncFunction(fn1) && isSyncFunction(fn2) && isSyncFunction(fn3) && isSyncFunction(fn4) && isSyncFunction(fn5) && isSyncFunction(fn6) && isSyncFunction(fn7) && isSyncFunction(fn8)) {
      return /* @__PURE__ */ __name(function fn0to8(...inputs) {
        return fn8(fn7(fn6(fn5(fn4(fn3(fn2(fn1(fn0(...inputs)))))))));
      }, "fn0to8");
    }
    return /* @__PURE__ */ __name(async function fn0to8(...inputs) {
      return await fn8(
        await fn7(
          await fn6(
            await fn5(
              await fn4(
                await fn3(
                  await fn2(
                    await fn1(
                      await fn0(...inputs)
                    )
                  )
                )
              )
            )
          )
        )
      );
    }, "fn0to8");
  }
  if (isSyncFunction(fn0) && isSyncFunction(fn1) && isSyncFunction(fn2) && isSyncFunction(fn3) && isSyncFunction(fn4) && isSyncFunction(fn5) && isSyncFunction(fn6) && isSyncFunction(fn7) && isSyncFunction(fn8) && isSyncFunction(fn9)) {
    return /* @__PURE__ */ __name(function fn0to9(...inputs) {
      return fn9(fn8(fn7(fn6(fn5(fn4(fn3(fn2(fn1(fn0(...inputs))))))))));
    }, "fn0to9");
  }
  return /* @__PURE__ */ __name(async function fn0to9(...inputs) {
    return await fn9(
      await fn8(
        await fn7(
          await fn6(
            await fn5(
              await fn4(
                await fn3(
                  await fn2(
                    await fn1(
                      await fn0(...inputs)
                    )
                  )
                )
              )
            )
          )
        )
      )
    );
  }, "fn0to9");
}
__name(pipeAsync, "pipeAsync");

// src/arrayLike.every.ts
// @__NO_SIDE_EFFECTS__
async function everyArrayLikeAsync(testingFn, arrayLike) {
  return !await somePromises(pipeAsync(testingFn, BooleanNot), arrayLike);
}
__name(everyArrayLikeAsync, "everyArrayLikeAsync");
// @__NO_SIDE_EFFECTS__
async function noneFailArrayLikeAsync(testingFn, arrayLike) {
  const fulfills = await Promise.all(await mapArrayLikeAsync(testingFn, arrayLike));
  return !fulfills.some(BooleanNot);
}
__name(noneFailArrayLikeAsync, "noneFailArrayLikeAsync");

// src/logtape.ts
import {
  getConsoleSink,
  getFileSink,
  getLevelFilter,
  withFilter
} from "@logtape/logtape";
// @__NO_SIDE_EFFECTS__
function logtapeConfiguration(appName = "monochromatic") {
  return {
    sinks: {
      console: getConsoleSink(),
      consoleInfoPlus: withFilter(getConsoleSink(), getLevelFilter("info")),
      consoleWarnPlus: withFilter(getConsoleSink(), getLevelFilter("warning")),
      file: getFileSink(`${appName}.log`, {
        formatter(log) {
          return `${JSON.stringify(log, null, 2)}
`;
        }
      })
    },
    filters: {},
    loggers: [
      /* a is short for app, m is short for module, t is short for test
         Sorry, but terminal space is precious. */
      { category: ["a"], level: "debug", sinks: ["file", "consoleInfoPlus"] },
      { category: ["t"], level: "debug", sinks: ["file", "consoleInfoPlus"] },
      { category: ["m"], level: "debug", sinks: ["file", "consoleWarnPlus"] },
      {
        category: ["esbuild-plugin"],
        level: "debug",
        sinks: ["file", "consoleWarnPlus"]
      },
      { category: ["logtape", "meta"], level: "warning", sinks: ["console"] }
    ]
  };
}
__name(logtapeConfiguration, "logtapeConfiguration");

// src/testing.ts
import { getLogger as getLogger4 } from "@logtape/logtape";
var testFileBasename = new URL(import.meta.url).pathname.split("/").at(-1);
var testedFileName = testFileBasename.endsWith(".test.js") ? testFileBasename.slice(0, -".test.js".length) : testFileBasename;
var l4 = getLogger4(["t", testedFileName]);
// @__NO_SIDE_EFFECTS__
async function suite(name, testOrSuites, options) {
  l4.debug`suite ${name} started: ${testOrSuites.length} tests or suites`;
  const result = await Promise.allSettled(testOrSuites);
  if (options) {
    if (Object.hasOwn(options, "skip")) {
      return { name, skip: options.skip };
    }
    if (Object.hasOwn(options, "todo")) {
      l4.info`suite ${name} finished: ${JSON.stringify(result)}`;
      return { name, todo: options.todo, result };
    }
  }
  const errored = result.find((settledResult) => settledResult.status === "rejected");
  if (errored) {
    throw new Error(`suite ${name} errored with result: ${JSON.stringify(result)}`, {
      cause: errored.reason
    });
  }
  l4.debug`suite ${name} finished: ${JSON.stringify(result)}`;
  return { name, result };
}
__name(suite, "suite");
// @__NO_SIDE_EFFECTS__
async function test(name, callback, options) {
  let timeLimit = 0;
  let took = 0;
  if (options) {
    if (Object.hasOwn(options, "skip")) {
      l4.warn`${name} skipped: ${options.skip}`;
      return { name, skip: options.skip };
    }
    if (Object.hasOwn(options, "timeLimit")) {
      timeLimit = typeof options.timeLimit === "number" ? options.timeLimit : await (async () => {
        const beforeExecutingTimeLimitReferenceCallback = performance.now();
        try {
          await options.timeLimit();
        } catch (timeLimitFnError) {
          l4.info`timeLimit fn threw ${timeLimitFnError}
            If this is intentional, you can ignore this log.
            The test will continue,
            the time it takes would be compared to the time timeLimit fn executed until it errored.`;
        }
        const afterExecutingTimeLimitReferenceCallback = performance.now();
        return afterExecutingTimeLimitReferenceCallback - beforeExecutingTimeLimitReferenceCallback;
      })();
      l4.debug`${name} timeLimit: ${timeLimit}ms`;
    }
    if (Object.hasOwn(options, "todo")) {
      l4.info`${name} started: ${callback} with todo: ${options.todo}`;
      try {
        const beforeExecutingTestingCallback = performance.now();
        const result = await callback();
        const afterExecutingTestingCallback = performance.now();
        took = afterExecutingTestingCallback - beforeExecutingTestingCallback;
        l4.debug`${name} took: ${took}ms`;
        if (result !== void 0 && result !== null) {
          if (took > timeLimit) {
            const tooLongPercentage = 100 * (took - timeLimit) / timeLimit;
            l4.error`${name} with todo: ${options.todo} took: ${took}ms, ${took - timeLimit}ms longer than timeLimit: ${timeLimit}ms, that's ${tooLongPercentage}% too long. finished: ${result}`;
            return {
              name,
              todo: options.todo,
              result,
              tooLongPercentage
            };
          }
          l4.warn`${name} with todo: ${options.todo} finished: ${result}`;
          return { name, todo: options.todo, result };
        }
        if (took > timeLimit) {
          const tooLongPercentage = Math.round(100 * (took - timeLimit) / timeLimit);
          l4.error`${name} with todo: ${options.todo} took: ${Math.round(took)}ms, ${Math.round(took - timeLimit)}ms longer than timeLimit: ${timeLimit}ms, that's ${tooLongPercentage}% too long.`;
          return { name, todo: options.todo, tooLongPercentage };
        }
        l4.warn`${name} with todo: ${options.todo} finished`;
        return { name, todo: options.todo };
      } catch (e) {
        l4.error`${name} with todo: ${options.todo} errored: ${e}`;
        return { name, todo: options.todo, result: e };
      }
    }
  }
  l4.debug`${name} started: ${String(callback).slice(0, 64)}`;
  try {
    const result = await callback();
    if (took > timeLimit) {
      const tooLongPercentage = Math.round(100 * (took - timeLimit) / timeLimit);
      throw new RangeError(
        `${name} took: ${Math.round(took)}ms, ${Math.round(took - timeLimit)}ms longer than timeLimit: ${timeLimit}ms, that's ${tooLongPercentage}% too long. finished: ${result}`
      );
    }
    if (result !== void 0 && result !== null) {
      l4.info`${name} finished: ${result}`;
      return { name, result };
    }
    l4.debug`${name} finished`;
    return name;
  } catch (callbackError) {
    throw new Error(`${name}: ${String(callback)} errored`, { cause: callbackError });
  }
}
__name(test, "test");

// src/fixture.array.0to999.ts
var array0to999 = [
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  64,
  65,
  66,
  67,
  68,
  69,
  70,
  71,
  72,
  73,
  74,
  75,
  76,
  77,
  78,
  79,
  80,
  81,
  82,
  83,
  84,
  85,
  86,
  87,
  88,
  89,
  90,
  91,
  92,
  93,
  94,
  95,
  96,
  97,
  98,
  99,
  100,
  101,
  102,
  103,
  104,
  105,
  106,
  107,
  108,
  109,
  110,
  111,
  112,
  113,
  114,
  115,
  116,
  117,
  118,
  119,
  120,
  121,
  122,
  123,
  124,
  125,
  126,
  127,
  128,
  129,
  130,
  131,
  132,
  133,
  134,
  135,
  136,
  137,
  138,
  139,
  140,
  141,
  142,
  143,
  144,
  145,
  146,
  147,
  148,
  149,
  150,
  151,
  152,
  153,
  154,
  155,
  156,
  157,
  158,
  159,
  160,
  161,
  162,
  163,
  164,
  165,
  166,
  167,
  168,
  169,
  170,
  171,
  172,
  173,
  174,
  175,
  176,
  177,
  178,
  179,
  180,
  181,
  182,
  183,
  184,
  185,
  186,
  187,
  188,
  189,
  190,
  191,
  192,
  193,
  194,
  195,
  196,
  197,
  198,
  199,
  200,
  201,
  202,
  203,
  204,
  205,
  206,
  207,
  208,
  209,
  210,
  211,
  212,
  213,
  214,
  215,
  216,
  217,
  218,
  219,
  220,
  221,
  222,
  223,
  224,
  225,
  226,
  227,
  228,
  229,
  230,
  231,
  232,
  233,
  234,
  235,
  236,
  237,
  238,
  239,
  240,
  241,
  242,
  243,
  244,
  245,
  246,
  247,
  248,
  249,
  250,
  251,
  252,
  253,
  254,
  255,
  256,
  257,
  258,
  259,
  260,
  261,
  262,
  263,
  264,
  265,
  266,
  267,
  268,
  269,
  270,
  271,
  272,
  273,
  274,
  275,
  276,
  277,
  278,
  279,
  280,
  281,
  282,
  283,
  284,
  285,
  286,
  287,
  288,
  289,
  290,
  291,
  292,
  293,
  294,
  295,
  296,
  297,
  298,
  299,
  300,
  301,
  302,
  303,
  304,
  305,
  306,
  307,
  308,
  309,
  310,
  311,
  312,
  313,
  314,
  315,
  316,
  317,
  318,
  319,
  320,
  321,
  322,
  323,
  324,
  325,
  326,
  327,
  328,
  329,
  330,
  331,
  332,
  333,
  334,
  335,
  336,
  337,
  338,
  339,
  340,
  341,
  342,
  343,
  344,
  345,
  346,
  347,
  348,
  349,
  350,
  351,
  352,
  353,
  354,
  355,
  356,
  357,
  358,
  359,
  360,
  361,
  362,
  363,
  364,
  365,
  366,
  367,
  368,
  369,
  370,
  371,
  372,
  373,
  374,
  375,
  376,
  377,
  378,
  379,
  380,
  381,
  382,
  383,
  384,
  385,
  386,
  387,
  388,
  389,
  390,
  391,
  392,
  393,
  394,
  395,
  396,
  397,
  398,
  399,
  400,
  401,
  402,
  403,
  404,
  405,
  406,
  407,
  408,
  409,
  410,
  411,
  412,
  413,
  414,
  415,
  416,
  417,
  418,
  419,
  420,
  421,
  422,
  423,
  424,
  425,
  426,
  427,
  428,
  429,
  430,
  431,
  432,
  433,
  434,
  435,
  436,
  437,
  438,
  439,
  440,
  441,
  442,
  443,
  444,
  445,
  446,
  447,
  448,
  449,
  450,
  451,
  452,
  453,
  454,
  455,
  456,
  457,
  458,
  459,
  460,
  461,
  462,
  463,
  464,
  465,
  466,
  467,
  468,
  469,
  470,
  471,
  472,
  473,
  474,
  475,
  476,
  477,
  478,
  479,
  480,
  481,
  482,
  483,
  484,
  485,
  486,
  487,
  488,
  489,
  490,
  491,
  492,
  493,
  494,
  495,
  496,
  497,
  498,
  499,
  500,
  501,
  502,
  503,
  504,
  505,
  506,
  507,
  508,
  509,
  510,
  511,
  512,
  513,
  514,
  515,
  516,
  517,
  518,
  519,
  520,
  521,
  522,
  523,
  524,
  525,
  526,
  527,
  528,
  529,
  530,
  531,
  532,
  533,
  534,
  535,
  536,
  537,
  538,
  539,
  540,
  541,
  542,
  543,
  544,
  545,
  546,
  547,
  548,
  549,
  550,
  551,
  552,
  553,
  554,
  555,
  556,
  557,
  558,
  559,
  560,
  561,
  562,
  563,
  564,
  565,
  566,
  567,
  568,
  569,
  570,
  571,
  572,
  573,
  574,
  575,
  576,
  577,
  578,
  579,
  580,
  581,
  582,
  583,
  584,
  585,
  586,
  587,
  588,
  589,
  590,
  591,
  592,
  593,
  594,
  595,
  596,
  597,
  598,
  599,
  600,
  601,
  602,
  603,
  604,
  605,
  606,
  607,
  608,
  609,
  610,
  611,
  612,
  613,
  614,
  615,
  616,
  617,
  618,
  619,
  620,
  621,
  622,
  623,
  624,
  625,
  626,
  627,
  628,
  629,
  630,
  631,
  632,
  633,
  634,
  635,
  636,
  637,
  638,
  639,
  640,
  641,
  642,
  643,
  644,
  645,
  646,
  647,
  648,
  649,
  650,
  651,
  652,
  653,
  654,
  655,
  656,
  657,
  658,
  659,
  660,
  661,
  662,
  663,
  664,
  665,
  666,
  667,
  668,
  669,
  670,
  671,
  672,
  673,
  674,
  675,
  676,
  677,
  678,
  679,
  680,
  681,
  682,
  683,
  684,
  685,
  686,
  687,
  688,
  689,
  690,
  691,
  692,
  693,
  694,
  695,
  696,
  697,
  698,
  699,
  700,
  701,
  702,
  703,
  704,
  705,
  706,
  707,
  708,
  709,
  710,
  711,
  712,
  713,
  714,
  715,
  716,
  717,
  718,
  719,
  720,
  721,
  722,
  723,
  724,
  725,
  726,
  727,
  728,
  729,
  730,
  731,
  732,
  733,
  734,
  735,
  736,
  737,
  738,
  739,
  740,
  741,
  742,
  743,
  744,
  745,
  746,
  747,
  748,
  749,
  750,
  751,
  752,
  753,
  754,
  755,
  756,
  757,
  758,
  759,
  760,
  761,
  762,
  763,
  764,
  765,
  766,
  767,
  768,
  769,
  770,
  771,
  772,
  773,
  774,
  775,
  776,
  777,
  778,
  779,
  780,
  781,
  782,
  783,
  784,
  785,
  786,
  787,
  788,
  789,
  790,
  791,
  792,
  793,
  794,
  795,
  796,
  797,
  798,
  799,
  800,
  801,
  802,
  803,
  804,
  805,
  806,
  807,
  808,
  809,
  810,
  811,
  812,
  813,
  814,
  815,
  816,
  817,
  818,
  819,
  820,
  821,
  822,
  823,
  824,
  825,
  826,
  827,
  828,
  829,
  830,
  831,
  832,
  833,
  834,
  835,
  836,
  837,
  838,
  839,
  840,
  841,
  842,
  843,
  844,
  845,
  846,
  847,
  848,
  849,
  850,
  851,
  852,
  853,
  854,
  855,
  856,
  857,
  858,
  859,
  860,
  861,
  862,
  863,
  864,
  865,
  866,
  867,
  868,
  869,
  870,
  871,
  872,
  873,
  874,
  875,
  876,
  877,
  878,
  879,
  880,
  881,
  882,
  883,
  884,
  885,
  886,
  887,
  888,
  889,
  890,
  891,
  892,
  893,
  894,
  895,
  896,
  897,
  898,
  899,
  900,
  901,
  902,
  903,
  904,
  905,
  906,
  907,
  908,
  909,
  910,
  911,
  912,
  913,
  914,
  915,
  916,
  917,
  918,
  919,
  920,
  921,
  922,
  923,
  924,
  925,
  926,
  927,
  928,
  929,
  930,
  931,
  932,
  933,
  934,
  935,
  936,
  937,
  938,
  939,
  940,
  941,
  942,
  943,
  944,
  945,
  946,
  947,
  948,
  949,
  950,
  951,
  952,
  953,
  954,
  955,
  956,
  957,
  958,
  959,
  960,
  961,
  962,
  963,
  964,
  965,
  966,
  967,
  968,
  969,
  970,
  971,
  972,
  973,
  974,
  975,
  976,
  977,
  978,
  979,
  980,
  981,
  982,
  983,
  984,
  985,
  986,
  987,
  988,
  989,
  990,
  991,
  992,
  993,
  994,
  995,
  996,
  997,
  998,
  999
];

// src/fixture.generator.0to999.ts
// @__NO_SIDE_EFFECTS__
function* gen0to999() {
  for (let i = 0; i < 1e3; i++) {
    yield i;
  }
}
__name(gen0to999, "gen0to999");
// @__NO_SIDE_EFFECTS__
function* gen0to999error() {
  for (let i = 0; i < 999; i++) {
    yield i;
  }
  throw new RangeError(`fixture reached 999`);
}
__name(gen0to999error, "gen0to999error");
// @__NO_SIDE_EFFECTS__
async function* gen0to999Async() {
  for (let i = 0; i < 1e3; i++) {
    yield i;
  }
}
__name(gen0to999Async, "gen0to999Async");
// @__NO_SIDE_EFFECTS__
async function* gen0to999errorAsync() {
  for (let i = 0; i < 999; i++) {
    yield i;
  }
  throw new RangeError(`fixture reached 999`);
}
__name(gen0to999errorAsync, "gen0to999errorAsync");
// @__NO_SIDE_EFFECTS__
async function* gen0to999AsyncSlow() {
  for (let i = 0; i < 1e3; i++) {
    await new Promise((resolve) => setTimeout(resolve, i));
    yield i;
  }
}
__name(gen0to999AsyncSlow, "gen0to999AsyncSlow");
// @__NO_SIDE_EFFECTS__
async function* gen0to999errorAsyncSlow() {
  for (let i = 0; i < 999; i++) {
    await new Promise((resolve) => setTimeout(resolve, i));
    yield i;
  }
  throw new RangeError(`fixture reached 999`);
}
__name(gen0to999errorAsyncSlow, "gen0to999errorAsyncSlow");

// src/arrayLike.every.test.ts
await configure(logtapeConfiguration());
suite("everyArrayLikeAsync", [
  suite("Array", [
    test("empty", async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, []));
    }),
    test("one", async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, [1]));
    }),
    test("two", async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, [1, 2]));
    }),
    test("two[1] - false", async () => {
      assertFalse(await everyArrayLikeAsync(Boolean, [1, 0]));
    }),
    test("two[0] - false", async () => {
      assertFalse(await everyArrayLikeAsync(Boolean, [0, 1]));
    }),
    // demo of how diff every... and noneFail... is
    // if (element === 999) {throw new RangeError(`999 is not allowed`)}
    // return false;
    // every would probably not throw an error and return false.
    // noneFail would throw an error for sure.
    test("fail fast - false", async () => {
      assertFalse(await everyArrayLikeAsync((element) => {
        if (element === 999) {
          throw new RangeError(`999 is not allowed`);
        }
        return false;
      }, array0to999));
    })
    // MAYBE: Add timeLimit-ed tests.
  ]),
  suite("Iterable", [
    test("empty", async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, function* () {
      }()));
    }),
    test("one", async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, function* () {
        yield 1;
      }()));
    }),
    test("two", async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, function* () {
        yield 1;
        yield 2;
      }()));
    }),
    test("two[1] - false", async () => {
      assertFalse(await everyArrayLikeAsync(Boolean, function* () {
        yield 1;
        yield 0;
      }()));
    }),
    test("two[0] - false", async () => {
      assertFalse(await everyArrayLikeAsync(Boolean, function* () {
        yield 0;
        yield 1;
      }()));
    }),
    test("fail fast - false", async () => {
      assertFalse(await everyArrayLikeAsync((element) => {
        if (element === 999) {
          throw new RangeError(`999 is not allowed`);
        }
        return false;
      }, gen0to999()));
    }),
    // MAYBE: Add timeLimit-ed tests.
    test("iterable throws - fail fast - false", async () => {
      assertFalse(await everyArrayLikeAsync(() => false, gen0to999error()));
    })
  ]),
  suite("AsyncIterable", [
    test("empty", async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, async function* () {
      }()));
    }),
    test("one", async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, async function* () {
        yield 1;
      }()));
    }),
    test("two", async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, async function* () {
        yield 1;
        yield 2;
      }()));
    }),
    test("two[1] - false", async () => {
      assertFalse(await everyArrayLikeAsync(Boolean, async function* () {
        yield 1;
        yield 0;
      }()));
    }),
    test("two[0] - false", async () => {
      assertFalse(await everyArrayLikeAsync(Boolean, async function* () {
        yield 0;
        yield 1;
      }()));
    }),
    test("fail fast - false", async () => {
      assertFalse(await everyArrayLikeAsync((element) => {
        if (element === 999) {
          throw new RangeError(`999 is not allowed`);
        }
        return false;
      }, gen0to999Async()));
    }),
    test("iterable throws - fail fast - false", async () => {
      assertFalse(await everyArrayLikeAsync(() => false, gen0to999errorAsync()));
    }),
    test("fail fast - false && fast", async () => {
      assertFalse(await everyArrayLikeAsync((element) => {
        if (element === 999) {
          throw new RangeError(`999 is not allowed`);
        }
        return false;
      }, gen0to999AsyncSlow()));
    }, {
      // Give or take.
      timeLimit: 50
    }),
    test("iterable throws - fail fast - false", async () => {
      assertFalse(await everyArrayLikeAsync(() => false, gen0to999errorAsyncSlow()));
    }, { timeLimit: 50 })
  ])
]);
suite("noneFailArrayLikeAsync", [
  suite("Array", [
    test("empty", async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, []));
    }),
    test("one", async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, [1]));
    }),
    test("two", async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, [1, 2]));
    }),
    test("two[1] - false", async () => {
      assertFalse(await noneFailArrayLikeAsync(Boolean, [1, 0]));
    }),
    test("two[0] - false", async () => {
      assertFalse(await noneFailArrayLikeAsync(Boolean, [0, 1]));
    }),
    // demo of how diff every... and noneFail... is
    // if (element === 999) {throw new RangeError(`999 is not allowed`)}
    // return false;
    // every would probably not throw an error and return false.
    // noneFail would throw an error for sure.
    test("run everything - throw", async () => {
      await assertThrowRangeErrorAsync(async () => {
        await noneFailArrayLikeAsync((element) => {
          if (element === 999) {
            throw new RangeError(`999 is not allowed`);
          }
          return false;
        }, array0to999);
      });
    })
  ]),
  suite("Iterable", [
    test("empty", async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, function* () {
      }()));
    }),
    test("one", async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, function* () {
        yield 1;
      }()));
    }),
    test("two", async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, function* () {
        yield 1;
        yield 2;
      }()));
    }),
    test("two[1] - false", async () => {
      assertFalse(await noneFailArrayLikeAsync(Boolean, function* () {
        yield 1;
        yield 0;
      }()));
    }),
    test("two[0] - false", async () => {
      assertFalse(await noneFailArrayLikeAsync(Boolean, function* () {
        yield 0;
        yield 1;
      }()));
    }),
    test("throw", async () => {
      assertThrowRangeErrorAsync(async () => {
        await noneFailArrayLikeAsync((element) => {
          if (element === 999) {
            throw new RangeError(`999 is not allowed`);
          }
          return false;
        }, gen0to999());
      });
    }),
    test("iterable throws - throw", async () => {
      assertThrowRangeErrorAsync(async () => {
        await noneFailArrayLikeAsync(() => false, gen0to999error());
      });
    })
  ]),
  suite("AsyncIterable", [
    test("empty", async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, async function* () {
      }()));
    }),
    test("one", async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, async function* () {
        yield 1;
      }()));
    }),
    test("two", async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, async function* () {
        yield 1;
        yield 2;
      }()));
    }),
    test("two[1] - false", async () => {
      assertFalse(await noneFailArrayLikeAsync(Boolean, async function* () {
        yield 1;
        yield 0;
      }()));
    }),
    test("two[0] - false", async () => {
      assertFalse(await noneFailArrayLikeAsync(Boolean, async function* () {
        yield 0;
        yield 1;
      }()));
    }),
    test("throw", async () => {
      assertThrowRangeErrorAsync(async () => {
        await noneFailArrayLikeAsync((element) => {
          if (element === 999) {
            throw new RangeError(`999 is not allowed`);
          }
          return false;
        }, gen0to999Async());
      });
    }),
    test("iterable throws - throw", async () => {
      assertThrowRangeErrorAsync(async () => {
        await noneFailArrayLikeAsync(() => false, gen0to999errorAsync());
      });
    })
  ])
]);
//# sourceMappingURL=arrayLike.every.test.js.map
