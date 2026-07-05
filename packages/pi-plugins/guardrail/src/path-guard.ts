/**
 * Protected-path guard powered by the `ignore` package's gitignore semantics.
 *
 * @module
 */

import ignore, { type Ignore, } from 'ignore';

import {
  extractToolPath,
  normalizeToolPath,
  TOOL_PATH_NOT_FOUND,
  TOOL_PATH_NOT_MATCHABLE,
} from './path-normalize.ts';
import {
  GUARDRAIL_NOT_BLOCKED,
  type GuardrailDecision,
  type PathRule,
} from './types.ts';

//region Sentinels

/**
 * Sentinel returned when no path rule provides a refusal message.
 *
 * @example
 * ```typescript
 * if (rule === PATH_RULE_NOT_FOUND) return GUARDRAIL_NOT_BLOCKED;
 * ```
 */
const PATH_RULE_NOT_FOUND: unique symbol = Symbol('pi-guardrail/path-rule-not-found',);

//endregion Sentinels

//region Types

/**
 * Compiled protected-path matcher.
 */
type PathGuardMatcher = {
  /**
   * Ignore package matcher for final gitignore state.
   */
  readonly ignore: Ignore;
  /**
   * Per-rule matchers used to select custom refusal message without rebuilding matchers per call.
   */
  readonly ruleMatchers: readonly PathRuleMatcher[];
};

/**
 * One path rule paired with its prebuilt matcher.
 */
type PathRuleMatcher = {
  /**
   * Path rule carrying refusal message.
   */
  readonly rule: PathRule;
  /**
   * Matcher containing only this rule's pattern.
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
 * Builds one matcher for final gitignore state and one matcher per rule for
 * refusal-message selection.
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
  const ig = rules.reduce(
    function addRule(
      matcher,
      rule,
    ): Ignore {
      matcher.add(rule.pattern,);
      return matcher;
    },
    ignore({ ignorecase: false, }),
  );
  /**
   * Per-rule matchers built once so blocked tool calls do not allocate matchers per rule.
   */
  const ruleMatchers = rules.map(function buildRuleMatcher(rule,): PathRuleMatcher {
    return {
      rule,
      ignore: ignore({ ignorecase: false, })
        .add(rule.pattern,),
    };
  },);

  return {
    ignore: ig,
    ruleMatchers,
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
 * @returns block decision for matching protected paths, otherwise {@link GUARDRAIL_NOT_BLOCKED}
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
): GuardrailDecision {
  /**
   * Tool target path extracted from external input.
   */
  const rawPath = extractToolPath(input,);
  if (rawPath === TOOL_PATH_NOT_FOUND)
    return GUARDRAIL_NOT_BLOCKED;

  /**
   * Path normalized for gitignore-style matching.
   */
  const relativePath = normalizeToolPath({
    cwd,
    rawPath,
  },);
  if (relativePath === TOOL_PATH_NOT_MATCHABLE)
    return GUARDRAIL_NOT_BLOCKED;

  /**
   * Ignore package match result for final gitignore state.
   */
  const testResult = matcher.ignore
    .test(relativePath,);
  if (!testResult.ignored)
    return GUARDRAIL_NOT_BLOCKED;

  /**
   * Last positive rule matching this path, used only for refusal message selection.
   */
  const rule = findLastMatchingMessageRule({
    ruleMatchers: matcher.ruleMatchers,
    relativePath,
  },);
  if (rule === PATH_RULE_NOT_FOUND)
    return GUARDRAIL_NOT_BLOCKED;

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
 * @param ruleMatchers - ordered path rule matchers
 *
 * @param relativePath - normalized project-relative path
 *
 * @returns matching rule that should provide refusal message
 *
 * @example
 * ```typescript
 * findLastMatchingMessageRule({ ruleMatchers, relativePath: 'pnpm-lock.yaml' });
 * ```
 */
function findLastMatchingMessageRule(
  {
    ruleMatchers,
    relativePath,
  }: {
    readonly ruleMatchers: readonly PathRuleMatcher[];
    readonly relativePath: string;
  },
): PathRule | typeof PATH_RULE_NOT_FOUND {
  /**
   * Last per-rule matcher whose pattern ignores the target path.
   */
  const match = ruleMatchers
    .toReversed()
    .find(function ruleMatchesPath(ruleMatcher,): boolean {
      return ruleMatcher.ignore
        .test(relativePath,)
        .ignored;
    },);
  if (match === undefined)
    return PATH_RULE_NOT_FOUND;
  return match.rule;
}

//endregion Guard evaluation

export {
  createPathGuardMatcher,
  evaluatePathGuard,
  findLastMatchingMessageRule,
  PATH_RULE_NOT_FOUND,
};
export type {
  EvaluatePathGuardOptions,
  PathGuardMatcher,
};
