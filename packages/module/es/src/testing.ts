// eslint-disable prefer-await-to-callbacks
/** Very basic testing framework
 @deprecated - Found a proper testing framework in Bun test.

 @remarks
 Not using something more sentible like Jest or Mocha because they inject their own global variables.
 Not using 'node:test' because that won't be compatible with bun or deno.
 We also won't need mocking.

 The intentional overuse of the `any` type here may or may not be fixed in the future,
 depending on how much impact it has. */

import { getLogger } from '@logtape/logtape';
import type { Promisable } from 'type-fest';

// MAYBE: Change this at to my at
// MAYBE: Change this to my path parser.
const testFileBasename: string = new URL(import.meta.url).pathname.split('/').at(-1)!;

const testedFileName: string = testFileBasename.endsWith('.test.js')
  ? testFileBasename.slice(0, -'.test.js'.length)
  : testFileBasename;

// t is short for test. m is short for module. Sorry, but terminal space is precious.
// TODO: if this doesn't work, try process.argv
const l = getLogger(['t', testedFileName]);

type TestReturn =
  | string
  | { name: string; result: unknown; tooLongPercentage?: number; }
  | { name: string; skip: string; }
  | { name: string; todo: string; result?: unknown; tooLongPercentage?: number; };

type SuiteReturn =
  | {
    name: string;
    result: PromiseSettledResult<
      Promisable<TestReturn | SuiteReturn>
    >[];
  }
  | { name: string; skip: string; }
  | {
    name: string;
    todo: string;
    result: PromiseSettledResult<
      Promisable<TestReturn | SuiteReturn>
    >[];
  };

// TODO: Implement skip and todo.
// skip skips the test or suite, returning its name and a message indicating why it's skipped.
// todo runs the test or suite, and doesn't throw an error when encountering an error.

// TODO: Implement time constraint. Both number and racing.
//       Should we still run it until the end when the time limit is broken?
//       Is terminating it even possible?
//       Luckily this applies to single test only.

/** Pass in an Array of test(...) or suite(...) to create a suite or a supersuite. Fails fast.
 */
/* @__NO_SIDE_EFFECTS__ */ export async function suite(name: string,
  testOrSuites: Promisable<TestReturn | SuiteReturn>[]
): Promise<Extract<SuiteReturn, {
  name: string;
  result: PromiseSettledResult<
    Promisable<TestReturn | SuiteReturn>
  >[];
}>>;
/* @__NO_SIDE_EFFECTS__ */ export async function suite(name: string,
  testOrSuites: Promisable<TestReturn | SuiteReturn>[],
  options: { skip: string; }
): Promise<Extract<SuiteReturn, { name: string; skip: string; }>>;
/* @__NO_SIDE_EFFECTS__ */ export async function suite(name: string,
  testOrSuites: Promisable<TestReturn | SuiteReturn>[],
  options: { todo: string; }
): Promise<Extract<SuiteReturn, {
  name: string;
  todo: string;
  result: PromiseSettledResult<
    Promisable<TestReturn | SuiteReturn>
  >[];
}>>;
/* @__NO_SIDE_EFFECTS__ */ export async function suite(name: string,
  testOrSuites: Promisable<TestReturn | SuiteReturn>[],
  options?: { skip: string; } | { todo: string; }): Promise<SuiteReturn>
{
  // TODO: Also log parent suites' names.
  l.debug`suite ${name} started: ${testOrSuites.length} tests or suites`;

  const result = await Promise.allSettled(testOrSuites);

  if (options) {
    if (Object.hasOwn(options, 'skip')) {
      return { name, skip: (options as { skip: string; }).skip };
    }

    if (Object.hasOwn(options, 'todo')) {
      l.info`suite ${name} finished: ${JSON.stringify(result)}`;
      return { name, todo: (options as { todo: string; }).todo, result };
    }
  }

  const errored = result.find((
    settledResult,
  ) => settledResult.status === 'rejected');
  if (errored) {
    throw new Error(
      `suite ${name} errored with result: ${JSON.stringify(result, null, 2)}`,
      {
        cause: errored.reason,
      },
    );
  }

  // Depromoted suite log level from info to debug when it finishs without error,
  // for a less cluttered terminal.
  l.debug`suite ${name} finished: ${JSON.stringify(result)}`;
  return { name, result };
}

// TODO: Redo this function signature. maybe a data-last style would be better.

/* @__NO_SIDE_EFFECTS__ */ export async function test<
  T_callbackReturn extends undefined | null,
>(name: string, callback: (() => Promisable<T_callbackReturn>) | (() => void), options?: {
  timeLimit?:
    | number
    | // TODO: Support erroring timeLimit compareTo fn
    (() => Promisable<unknown>);
}): Promise<
  string
>;
/* @__NO_SIDE_EFFECTS__ */ export async function test<
  T_callbackReturn extends NonNullable<unknown>,
>(name: string, callback: () => Promisable<T_callbackReturn>,
  options?: { timeLimit?: number | (() => Promisable<unknown>); }
): Promise<
  { name: string; result: T_callbackReturn; }
>;
/* @__NO_SIDE_EFFECTS__ */ export async function test<T_callbackReturn,>(name: string,
  callback: () => Promisable<T_callbackReturn>,
  options: { skip: string; timeLimit?: number | (() => Promisable<unknown>); }
): Promise<
  { name: string; skip: string; }
>;
/* @__NO_SIDE_EFFECTS__ */ export async function test<
  T_callbackReturn extends undefined | null,
>(name: string, callback: (() => Promisable<T_callbackReturn>) | (() => void),
  options: { todo: string; timeLimit?: number | (() => Promisable<unknown>); }
): Promise<
  { name: string; todo: string; result?: unknown; }
>;
/* @__NO_SIDE_EFFECTS__ */ export async function test<
  T_callbackReturn extends NonNullable<unknown>,
>(name: string, callback: () => Promisable<T_callbackReturn>,
  options: { todo: string; timeLimit?: number | (() => Promisable<unknown>); }
): Promise<
  { name: string; todo: string; result: unknown; }
>;
/* @__NO_SIDE_EFFECTS__ */ export async function test<T_callbackReturn,>(name: string,
  callback: () => Promisable<T_callbackReturn>, options?: {
    skip?: string;
    todo?: string;
    /* If number, has to be in ms.
       https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DurationFormat
       seems to be a way to express a duration more clearly,
       but it's unsupported for node. */
    timeLimit?: number | (() => Promisable<unknown>);
  }
): Promise<
  | string
  | { name: string; result: T_callbackReturn; tooLongPercentage?: number; }
  | { name: string; skip: string; }
  | { name: string; todo: string; result?: unknown; tooLongPercentage?: number; }
> {
  let timeLimit: number = 0;
  let took: number = 0;

  if (options) {
    // TODO: Write a type assertion function for Object.hasOwn
    if (Object.hasOwn(options, 'skip')) {
      l.warn`${name} skipped: ${options.skip}`;
      return { name, skip: options.skip! };
    }

    if (Object.hasOwn(options, 'timeLimit')) {
      timeLimit = typeof options.timeLimit === 'number'
        ? options.timeLimit
        : await (async (): Promise<number> => {
          const beforeExecutingTimeLimitReferenceCallback = performance.now();
          try {
            await (options.timeLimit as () => Promisable<unknown>)();
          } catch (timeLimitFnError) {
            l.info`timeLimit fn threw ${timeLimitFnError}
            If this is intentional, you can ignore this log.
            The test will continue,
            the time it takes would be compared to the time timeLimit fn executed until it errored.`;
          }
          const afterExecutingTimeLimitReferenceCallback = performance.now();
          return afterExecutingTimeLimitReferenceCallback
            - beforeExecutingTimeLimitReferenceCallback;
        })();
      l.debug`${name} timeLimit: ${timeLimit}ms`;
    }

    if (Object.hasOwn(options, 'todo')) {
      l.info`${name} started: ${callback} with todo: ${options.todo}`;

      try {
        const beforeExecutingTestingCallback = performance.now();
        const result = await callback();
        const afterExecutingTestingCallback = performance.now();
        took = afterExecutingTestingCallback - beforeExecutingTestingCallback;
        l.debug`${name} took: ${took}ms`;

        if (result !== undefined && result !== null) {
          if (took > timeLimit) {
            const tooLongPercentage = 100 * (took - timeLimit) / timeLimit;
            l.error`${name} with todo: ${options.todo} took: ${took}ms, ${
              took - timeLimit
            }ms longer than timeLimit: ${timeLimit}ms, that's ${tooLongPercentage}% too long. finished: ${result}`;
            return {
              name,
              todo: options.todo!,
              result,
              tooLongPercentage: tooLongPercentage,
            };
          }

          l.warn`${name} with todo: ${options.todo} finished: ${result}`;
          return { name, todo: options.todo!, result };
        }

        if (took > timeLimit) {
          const tooLongPercentage = Math.round(100 * (took - timeLimit) / timeLimit);
          l.error`${name} with todo: ${options.todo} took: ${Math.round(took)}ms, ${
            Math.round(took - timeLimit)
          }ms longer than timeLimit: ${timeLimit}ms, that's ${tooLongPercentage}% too long.`;
          return { name, todo: options.todo!, tooLongPercentage: tooLongPercentage };
        }

        l.warn`${name} with todo: ${options.todo} finished`;
        return { name, todo: options.todo! };
      } catch (e) {
        l.error`${name} with todo: ${options.todo} errored: ${e}`;
        return { name, todo: options.todo!, result: e };
      }
    }
  }

  l.debug`${name} started: ${String(callback).slice(0, 64)}`;

  // May error, and that's okay. We're failing fast here.
  // Well nope, we do need to catch the error and rethrow, at least to add the name of the test.
  try {
    const result = await callback();

    if (took > timeLimit) {
      const tooLongPercentage = Math.round(100 * (took - timeLimit) / timeLimit);
      throw new RangeError(
        `${name} took: ${Math.round(took)}ms, ${
          Math.round(took - timeLimit)
        }ms longer than timeLimit: ${timeLimit}ms, that's ${tooLongPercentage}% too long. finished: ${result}`,
      );
    }

    if (result !== undefined && result !== null) {
      l.info`${name} finished: ${result}`;
      return { name, result };
    }

    // Depromoted single test log level from info to debug when it finishs without a result,
    // for a less cluttered terminal.
    l.debug`${name} finished`;
    return name;
  } catch (callbackError: any) {
    throw new Error(`${name}: ${String(callback)} errored`, { cause: callbackError });
  }
}
