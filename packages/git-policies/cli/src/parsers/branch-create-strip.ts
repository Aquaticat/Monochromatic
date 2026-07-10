import { PATHSPEC_SEPARATOR, } from '../escape-hatch.ts';
import { consumesNextValue, } from './branch-create-dispatch.ts';
import {
  BRANCH_WORKTREE_ESCAPE_HATCH,
  type BranchCreationSubcommand,
} from './branch-create-types.ts';

//region Escape-hatch stripping

/**
 * Removes the {@link BRANCH_WORKTREE_ESCAPE_HATCH} flag from one guarded
 * invocation. Skips the value position of options that
 * {@link consumesNextValue} reports, and stops rewriting at
 * {@link PATHSPEC_SEPARATOR}, where every later token becomes a pathspec.
 *
 * @param args - Complete git argv.
 *
 * @param subcommandIndex - Index where guarded subcommand appears.
 *
 * @param subcommand - Guarded subcommand whose option grammar applies.
 *
 * @returns Args with flag-position escape hatch removed.
 *
 * @example
 * ```ts
 * stripBranchCreationEscapeHatch({
 *   args: ['switch', '--create', 'topic', '--no-enforce-worktree-branch'],
 *   subcommandIndex: 0,
 *   subcommand: 'switch',
 * });
 * // => ['switch', '--create', 'topic']
 * ```
 */
export function stripBranchCreationEscapeHatch({
  args,
  subcommandIndex,
  subcommand,
}: {
  readonly args: readonly string[];
  readonly subcommandIndex: number;
  readonly subcommand: BranchCreationSubcommand;
},): readonly string[] {
  /**
   * Pre-subcommand region and subcommand kept verbatim.
   */
  const preAndSubcommand = args.slice(
    0,
    subcommandIndex + 1,
  );
  /**
   * Args after guarded subcommand where wrapper-only flag can appear.
   */
  const postSubcommandArgs = args.slice(subcommandIndex + 1,);
  /**
   * Filtered post-subcommand args.
   */
  const filtered: string[] = [];

  for (let index = 0; index < postSubcommandArgs.length; index += 1) {
    /**
     * Current argv token being copied or stripped.
     */
    const arg = postSubcommandArgs[index];

    if (arg === undefined)
      continue;

    if (arg === PATHSPEC_SEPARATOR) {
      filtered.push(...postSubcommandArgs.slice(index,),);
      break;
    }

    if (consumesNextValue({
      subcommand,
      arg,
    },)) {
      /**
       * Value token following a separated-value option; preserved even when it equals escape hatch text.
       */
      const value = postSubcommandArgs[index + 1];
      filtered.push(arg,);

      if (value !== undefined) {
        filtered.push(value,);
        index += 1;
      }
      continue;
    }

    if (arg !== BRANCH_WORKTREE_ESCAPE_HATCH)
      filtered.push(arg,);
  }

  return [
    ...preAndSubcommand,
    ...filtered,
  ];
}

//endregion Escape-hatch stripping
