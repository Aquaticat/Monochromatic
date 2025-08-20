import type { UnknownRecord, } from 'type-fest';

/**
 * Creates a function that invokes `fn` with some options pre-applied.
 * This is like `partial`, but designed for functions that take named parameters
 * (options objects) rather than positional parameters.
 *
 * @param config - Configuration object containing the function and pre-applied options
 * @param config.fn - Function to partially apply options to
 * @param config.preApplied - Options to pre-apply to the function
 * @returns New function with pre-applied options merged with additional options
 * @example
 * ```ts
 * import { partialNamed } from '@monochromatic-dev/module-es';
 *
 * const greet = (options: { greeting: string; name: string; punctuation?: string }) =>
 *   `${options.greeting}, ${options.name}${options.punctuation || '!'}`;
 *
 * const sayHello = partialNamed({
 *   fn: greet,
 *   preApplied: { greeting: 'Hello' }
 * });
 *
 * console.log(sayHello({ name: 'World' }));
 * // => 'Hello, World!'
 *
 * console.log(sayHello({ name: 'Alice', punctuation: '.' }));
 * // => 'Hello, Alice.'
 * ```
 */
export function partialNamed<
  const MyFn extends (options: UnknownRecord,) => unknown = (
    options: UnknownRecord,
  ) => unknown,
  const PreApplied extends Partial<Parameters<MyFn>[0]> = Partial<Parameters<MyFn>[0]>,
>(
  { fn, preApplied, }: { fn: MyFn; preApplied: PreApplied; },
): (options: Omit<Parameters<MyFn>[0], keyof PreApplied>,) => ReturnType<MyFn>
{
  return function partiallyAppliedNamed(
    additionalOptions: Omit<Parameters<MyFn>[0], keyof PreApplied>,
  ): ReturnType<MyFn> {
    // Merge pre-applied options with additional options provided at call time
    // Additional options take precedence over pre-applied ones
    const finalOptions = {
      ...preApplied,
      ...additionalOptions,
    };

    return fn(finalOptions) as ReturnType<MyFn>;
  };
}
