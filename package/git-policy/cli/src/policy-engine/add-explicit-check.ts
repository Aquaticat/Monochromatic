import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { parseGlobalOptions, } from '../parse-global-options.ts';
import {
  ADD_ESCAPE_HATCH,
  parseAddRegion,
} from '../parser/add.ts';

/**
 * Logger root for cli-git after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'cli-git', },);

/**
 * Expected add-explicit policy violation.
 */
export class AddExplicitViolationError extends Error {
  /**
   * Creates expected policy violation.
   *
   * @param message - safe rejection explanation
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'AddExplicitViolationError';
  }
}

//region Add-explicit rule

/**
 * Wrapper-only flag that suppresses bulk-add enforcement for one invocation.
 */
const ESCAPE_HATCH = ADD_ESCAPE_HATCH;

/**
 * Rejects `git add` invocations that use bulk-staging patterns, which sweep
 * up changed paths the caller did not intend to stage and leave the index in
 * a state that does not match a single logical change. Specifying paths
 * explicitly (or a single bounded directory) is required by default; the
 * wrapper-only flag `--no-enforce-bulk-add` is the escape hatch for legitimate
 * bulk operations and is stripped before forwarding to real git.
 *
 * Pre-subcommand global options (`git -C /repo add .`, `git -c key=val add -A`)
 * are walked by {@link parseGlobalOptions} so the rule still fires for those
 * forms. The post-subcommand region is parsed by {@link parseAddRegion}'s
 * optique-based parser so option arity is respected and the escape-hatch
 * token cannot be confused with the value of `--pathspec-from-file`.
 *
 * @param args - Raw git arguments (global options + subcommand + flags).
 *
 * @returns Unmodified args when no bulk pattern is present, or args with
 *   `--no-enforce-bulk-add` stripped when the escape hatch is in use.
 *
 * @throws When a bulk-add pattern is present without the escape hatch.
 *
 * @example
 * ```ts
 * checkAddExplicit(['add', 'file.ts']);
 * // => ['add', 'file.ts']
 *
 * checkAddExplicit(['add', '.']);
 * // throws: bulk-staging pattern '.' rejected
 *
 * checkAddExplicit(['add', '.', '--no-enforce-bulk-add']);
 * // => ['add', '.']
 *
 * checkAddExplicit(['-C', '/repo', 'add', '-A']);
 * // throws: bulk-staging pattern '-A' rejected
 * ```
 */
export function checkAddExplicit(args: readonly string[],): readonly string[] {
  /**
   * Position of the `add` (or other) subcommand within args.
   */
  const { subcommandIndex, } = parseGlobalOptions(args,);

  if (args[subcommandIndex]
    !== 'add')
    return args;

  /**
   * Tagged logger for the add-explicit rule.
   */
  const rl = tagged({
    tag: checkAddExplicit.name,
    l,
  },);

  /**
   * Slice of args strictly after the `add` token; the place where pathspecs and flags live.
   */
  const postSubcommandArgs = args.slice(subcommandIndex + 1,);
  /**
   * Add region facts parsed by optique.
   */
  const region = parseAddRegion(postSubcommandArgs,);

  if (region.hasEscapeHatch) {
    rl.debug(`${ESCAPE_HATCH} present, stripping and skipping check`,);
    /**
     * Pre-subcommand region kept verbatim so global options survive the strip.
     */
    const preAndSubcommand = args.slice(
      0,
      subcommandIndex + 1,
    );
    return [
      ...preAndSubcommand,
      ...postSubcommandArgs.filter(function isNotEscapeHatch(arg,) {
        return arg !== ESCAPE_HATCH;
      },),
    ];
  }

  if (region.bulkMatches
    .length
    > 0) {
    throw new AddExplicitViolationError(
      `cli-git: git add rejects bulk-staging patterns (${
        region.bulkMatches
          .join(', ',)
      }) `
        + `because they sweep up paths the caller did not intend to stage, `
        + `leaving the index in a state that does not match a single logical change. `
        + `Name the paths explicitly, or pass ${ESCAPE_HATCH} to bypass for this invocation.`,
    );
  }

  rl.debug('no bulk pattern, passing through',);
  return args;
}

//endregion Add-explicit rule
