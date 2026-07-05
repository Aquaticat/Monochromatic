/**
 * Protected-path guard powered by the `ignore` package's gitignore semantics.
 *
 * @module
 */

import ignore, { type Ignore, } from 'ignore';

import {
  extractToolPath,
  normalizeToolPath,
} from './path-normalize.ts';
import type {
  GuardrailBlockDecision,
  PathRule,
} from './types.ts';

//region Types

/**
 * Compiled protected-path matcher.
 */
type PathGuardMatcher = {
  /**
   * Ordered rules used to build the matcher.
   */
  readonly rules: readonly PathRule[];
  /**
   * Ignore package matcher with each rule marked by its index.
   */
  readonly ignore: Ignore;
};

/**
 * Options for path guard evaluation.
 */
type EvaluatePathGuardOptions = {
  /**
   * External tool input from pi edit/write calls.
   */
  readonly input: unknown;
  /**
   * Pi session current working directory.
   */
  readonly cwd: string;
  /**
   * Compiled matcher.
   */
  readonly matcher: PathGuardMatcher;
};

//endregion Types

//region Matcher construction

/**
 * Builds an `ignore` matcher from ordered path rules.
 *
 * Uses `mark` values to recover rule provenance for debugging while the matcher
 * itself supplies the final gitignore ignored/unignored decision.
 *
 * @param rules - ordered protected-path rules
 *
 * @returns compiled path guard matcher
 *
 * @example
 * ```typescript
 * const matcher = createPathGuardMatcher([{ pattern: 'pnpm-lock.yaml', message: 'run pnpm install' }]);
 * ```
 */
function createPathGuardMatcher(rules: readonly PathRule[],): PathGuardMatcher {
  /**
   * Ignore matcher with all patterns installed in order.
   */
  const ig = rules.reduce(function addRule(matcher, rule, index,): Ignore {
    matcher.add({
      pattern: rule.pattern,
      mark: String(index,),
    },);
    return matcher;
  }, ignore({ ignorecase: false, }),);

  return {
    rules,
    ignore: ig,
  };
}

//endregion Matcher construction

//region Guard evaluation

/**
 * Applies protected-path rules to a pi edit/write tool input.
 *
 * @param input - pi tool input
 *
 * @param cwd - pi current working directory
 *
 * @param matcher - compiled gitignore-style matcher
 *
 * @returns block decision for matching protected paths, otherwise `undefined`
 *
 * @example
 * ```typescript
 * evaluatePathGuard({ input: { path: 'pnpm-lock.yaml' }, cwd, matcher });
 * ```
 */
function evaluatePathGuard(
  {
    input,
    cwd,
    matcher,
  }: EvaluatePathGuardOptions,
): GuardrailBlockDecision | undefined {
  /**
   * Tool target path extracted from external input.
   */
  const rawPath = extractToolPath(input,);
  if (rawPath === undefined)
    return undefined;

  /**
   * Path normalized for gitignore-style matching.
   */
  const relativePath = normalizeToolPath({
    cwd,
    rawPath,
  },);
  if (relativePath === undefined)
    return undefined;

  /**
   * Ignore package match result for final gitignore state.
   */
  const testResult = matcher.ignore
    .test(relativePath,);
  if (!testResult.ignored)
    return undefined;

  /**
   * Last positive rule matching this path, used only for refusal message selection.
   */
  const rule = findLastMatchingMessageRule({
    rules: matcher.rules,
    relativePath,
  },);
  if (rule === undefined)
    return undefined;

  return {
    block: true,
    reason: rule.message,
  };
}

/**
 * Finds the last path rule whose own gitignore pattern matches a relative path.
 *
 * The full matcher decides whether the final state is ignored. This helper is
 * only for selecting the message after a positive final state, so duplicate
 * user rules can override built-in messages without reimplementing gitignore
 * matching.
 *
 * @param rules - ordered path rules
 *
 * @param relativePath - normalized project-relative path
 *
 * @returns matching rule that should provide refusal message
 *
 * @example
 * ```typescript
 * findLastMatchingMessageRule({ rules, relativePath: 'pnpm-lock.yaml' });
 * ```
 */
function findLastMatchingMessageRule(
  {
    rules,
    relativePath,
  }: {
    readonly rules: readonly PathRule[];
    readonly relativePath: string;
  },
): PathRule | undefined {
  return rules
    .toReversed()
    .find(function ruleMatchesPath(rule,): boolean {
      return ignore({ ignorecase: false, })
        .add(rule.pattern,)
        .test(relativePath,)
        .ignored;
    },);
}

//endregion Guard evaluation

export {
  createPathGuardMatcher,
  evaluatePathGuard,
  extractToolPath,
  findLastMatchingMessageRule,
  normalizeToolPath,
};
export type {
  EvaluatePathGuardOptions,
  PathGuardMatcher,
};
