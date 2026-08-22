export { caught, } from './caught.ts';

export { describe, } from './describe.ts';
export type {
  DescribeChild,
  DescribeOptions,
  DescribeResult,
} from './describe.ts';

export type { TestDescriptor, } from './descriptor.ts';

export { it, } from './it.ts';
export type {
  ItOptions,
  ItResult,
  TestContext,
} from './it.ts';

export {
  createScopedExpect,
  expect,
} from './expect.ts';
export type {
  AssertionTracker,
  AsyncMatcherSet,
  ExpectResult,
  MatcherSet,
  ScopedExpect,
} from './expect.ts';

export type { DisposableSandbox, } from './sinon.ts';

export { expectTypeOf, } from 'expect-type';

//region Internals reached only by this package's own tests
// Exported so those tests import the bundle a consumer loads rather than the
// module beside them, which is what `require-eventual-artifact` asks for. None
// of these is part of the supported surface.

/**
 * Renders the assertion at one line of a source file as a single line, so a
 * value-only failure message can carry the code that produced it.
 *
 * @internal
 */
export { extractAssertionExpression, } from './assertion-source.ts';

/**
 * Pulls the `path:line:col` substring out of one stack frame, with any URL
 * scheme stripped so the result is a plain filesystem path.
 *
 * @internal
 */
export { extractLocationSubstring, } from './assertion-source.ts';

/**
 * Reports whether a string is a non-empty run of ASCII digits, which is how
 * stack-frame line and column segments are validated without a regex.
 *
 * @internal
 */
export { isIntegerString, } from './assertion-source.ts';

/**
 * Walks an error and its `cause` and `AggregateError.errors` tree to the first
 * non-harness frame, reads that source file, and renders the assertion behind
 * each failure. Node-only, since it reads off disk.
 *
 * @internal
 */
export { readAssertionSites, } from './assertion-source.ts';

/**
 * Renders an error and every error beneath it as single-line strings, one per
 * link in the `cause` chain.
 *
 * @internal
 */
export { formatErrorDeep, } from './format-error.ts';

/**
 * Fuses a summary with the rendered error beneath it, so only the first line
 * carries the caller's tag.
 *
 * @internal
 */
export { formatFailure, } from './format-error.ts';

//endregion
