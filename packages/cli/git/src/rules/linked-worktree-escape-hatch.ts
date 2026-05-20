import {
  PATHSPEC_SEPARATOR,
  WORKTREE_ENFORCEMENT_ESCAPE_HATCH,
} from './linked-worktree-constants.ts';

//region Linked worktree escape hatch

/** Array index returned by `indexOf` when searched item is absent. */
const INDEX_NOT_FOUND = -1;

/** Options for post-subcommand escape-hatch helpers. */
type PostSubcommandArgsOptions = {
  /** Arguments strictly after guarded subcommand. */
  readonly postSubcommandArgs: readonly string[];
};

/** Options for stripping escape hatch from full argv. */
type StripEscapeHatchOptions = {
  /** Complete git argv. */
  readonly args: readonly string[];
  /** Index where guarded subcommand appears. */
  readonly subcommandIndex: number;
};

/**
 * Returns post-subcommand region where wrapper-only options are recognized.
 *
 * @param postSubcommandArgs - Arguments strictly after guarded subcommand.
 *
 * @returns Arguments before pathspec separator.
 *
 * @example
 * ```ts
 * wrapperOptionRegion({ postSubcommandArgs: ['--no-enforce-worktree', '--', 'file'] });
 * // => ['--no-enforce-worktree']
 * ```
 */
function wrapperOptionRegion({
  postSubcommandArgs,
}: PostSubcommandArgsOptions,): readonly string[] {
  /** Index where user pathspec region starts, or -1 when absent. */
  const pathspecSeparatorIndex = postSubcommandArgs.indexOf(PATHSPEC_SEPARATOR,);

  if (pathspecSeparatorIndex === INDEX_NOT_FOUND)
    return postSubcommandArgs;

  return postSubcommandArgs.slice(
    0,
    pathspecSeparatorIndex,
  );
}

/**
 * Detects escape hatch after guarded subcommand and before pathspec separator.
 *
 * @param postSubcommandArgs - Arguments strictly after guarded subcommand.
 *
 * @returns `true` when wrapper-only escape hatch is present.
 *
 * @example
 * ```ts
 * hasWorktreeEnforcementEscapeHatch({ postSubcommandArgs: ['--no-enforce-worktree'] });
 * // => true
 * ```
 */
export function hasWorktreeEnforcementEscapeHatch({
  postSubcommandArgs,
}: PostSubcommandArgsOptions,): boolean {
  return wrapperOptionRegion({ postSubcommandArgs, },).includes(WORKTREE_ENFORCEMENT_ESCAPE_HATCH,);
}

/**
 * Removes escape hatch from post-subcommand wrapper-option region only.
 *
 * @param postSubcommandArgs - Arguments strictly after guarded subcommand.
 *
 * @returns Post-subcommand args with wrapper-only escape hatch stripped.
 *
 * @example
 * ```ts
 * stripEscapeHatchFromPostSubcommandArgs({ postSubcommandArgs: ['--no-enforce-worktree', 'list'] });
 * // => ['list']
 * ```
 */
function stripEscapeHatchFromPostSubcommandArgs({
  postSubcommandArgs,
}: PostSubcommandArgsOptions,): readonly string[] {
  /** Index where user pathspec region starts, or -1 when absent. */
  const pathspecSeparatorIndex = postSubcommandArgs.indexOf(PATHSPEC_SEPARATOR,);

  if (pathspecSeparatorIndex === INDEX_NOT_FOUND) {
    return postSubcommandArgs.filter(function isNotEscapeHatch(arg,): boolean {
      return arg !== WORKTREE_ENFORCEMENT_ESCAPE_HATCH;
    },);
  }

  /** Region before pathspec separator where wrapper-only options are recognized. */
  const wrapperArgs = postSubcommandArgs.slice(
    0,
    pathspecSeparatorIndex,
  );
  /** Pathspec separator and user path text preserved verbatim. */
  const pathspecArgs = postSubcommandArgs.slice(pathspecSeparatorIndex,);

  return [
    ...wrapperArgs.filter(function isNotEscapeHatch(arg,): boolean {
      return arg !== WORKTREE_ENFORCEMENT_ESCAPE_HATCH;
    },),
    ...pathspecArgs,
  ];
}

/**
 * Removes escape hatch from full git argv while preserving global options.
 *
 * @param args - Complete git argv.
 *
 * @param subcommandIndex - Index where guarded subcommand appears.
 *
 * @returns Git argv with wrapper-only escape hatch stripped.
 *
 * @example
 * ```ts
 * stripWorktreeEnforcementEscapeHatch({ args: ['stash', '--no-enforce-worktree', 'list'], subcommandIndex: 0 });
 * // => ['stash', 'list']
 * ```
 */
export function stripWorktreeEnforcementEscapeHatch({
  args,
  subcommandIndex,
}: StripEscapeHatchOptions,): readonly string[] {
  /** Pre-subcommand region and subcommand kept verbatim so global options survive the strip. */
  const preAndSubcommand = args.slice(
    0,
    subcommandIndex + 1,
  );
  /** Slice of args strictly after guarded subcommand. */
  const postSubcommandArgs = args.slice(subcommandIndex + 1,);

  return [
    ...preAndSubcommand,
    ...stripEscapeHatchFromPostSubcommandArgs({ postSubcommandArgs, },),
  ];
}

//endregion Linked worktree escape hatch
