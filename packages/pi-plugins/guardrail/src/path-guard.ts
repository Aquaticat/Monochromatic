/**
 * Protected-path guard powered by the `ignore` package's gitignore semantics.
 *
 * @module
 */

import ignore, { type Ignore, } from 'ignore';
import {
  relative,
  resolve,
  sep,
} from 'node:path';

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
 * Uses `mark` values to recover the exact final positive rule after
 * `ignore().test(path)`, avoiding a hand-written gitignore matcher.
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
   * Ignore package match result, including marked final rule.
   */
  const testResult = matcher.ignore
    .test(relativePath,);
  if ((!testResult.ignored) || (testResult.rule === undefined))
    return undefined;

  /**
   * Mark assigned in {@link createPathGuardMatcher}; identifies message source.
   */
  const mark = testResult.rule.mark;
  if (mark === undefined)
    return undefined;

  /**
   * Numeric path-rule index decoded from ignore rule mark.
   */
  const ruleIndex = Number(mark,);
  if (!Number.isInteger(ruleIndex,))
    return undefined;

  /**
   * Matched rule carrying custom refusal message.
   */
  const rule = matcher.rules[ruleIndex];
  if (rule === undefined)
    return undefined;

  return {
    block: true,
    reason: rule.message,
  };
}

//endregion Guard evaluation

//region Path normalization

/**
 * Extracts `path` from external pi edit/write input.
 *
 * @param input - unknown tool input
 *
 * @returns string path when present
 *
 * @example
 * ```typescript
 * extractToolPath({ path: 'pnpm-lock.yaml' });
 * ```
 */
function extractToolPath(input: unknown,): string | undefined {
  if (!isRecord(input,))
    return undefined;
  /**
   * Raw path candidate from tool input.
   */
  const path = input.path;
  return ((typeof path) === 'string')
    ? path
    : undefined;
}

/**
 * Normalizes pi tool paths to relative POSIX pathnames accepted by `ignore`.
 *
 * Built-in tools strip a leading `@` before resolving; this guard mirrors that
 * behavior so model-produced file references and plain paths match identically.
 * Paths outside `cwd` are left unguarded because global gitignore-style rules
 * are evaluated relative to the active project root.
 *
 * @param cwd - pi current working directory
 *
 * @param rawPath - raw path from tool input
 *
 * @returns relative POSIX path under cwd, or `undefined` for outside/empty paths
 *
 * @example
 * ```typescript
 * normalizeToolPath({ cwd: '/repo', rawPath: '/repo/pnpm-lock.yaml' });
 * ```
 */
function normalizeToolPath(
  {
    cwd,
    rawPath,
  }: {
    readonly cwd: string;
    readonly rawPath: string;
  },
): string | undefined {
  /**
   * Path after mirroring pi built-in file-reference normalization.
   */
  const unprefixedPath = rawPath.startsWith('@',)
    ? rawPath.slice(1,)
    : rawPath;
  if (unprefixedPath.length === 0)
    return undefined;

  /**
   * Absolute target path resolved against pi cwd.
   */
  const absolutePath = resolve(
    cwd,
    unprefixedPath,
  );
  /**
   * Relative target path from pi cwd.
   */
  const relativePath = relative(
    cwd,
    absolutePath,
  );
  if ((relativePath.length === 0)
    || (relativePath === '..')
    || relativePath.startsWith(`..${sep}`,)) {
    return undefined;
  }

  return relativePath
    .split(sep,)
    .join('/',);
}

/**
 * Returns whether value is a non-array object record.
 *
 * @param value - value to inspect
 *
 * @returns whether value can expose a path field
 */
function isRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return (value !== null)
    && ((typeof value) === 'object')
    && (!Array.isArray(value,));
}

//endregion Path normalization

export {
  createPathGuardMatcher,
  evaluatePathGuard,
  extractToolPath,
  normalizeToolPath,
};
export type {
  EvaluatePathGuardOptions,
  PathGuardMatcher,
};
