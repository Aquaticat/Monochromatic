import { homedir, } from 'node:os';
import { join, } from 'node:path';

import { RUN_CORPUS_PIN, } from './run-config.ts';

//region Settled rendering audit arguments
// The command line surface of `rendering-audit-settled.ts`, kept apart from the
// probe itself because they answer to different readers: this is what a person
// types, and that is what a roster is asked.
//
// The clone comes from `RUN_CORPUS_PIN` and the COMMIT does not. Only the
// location of a checkout is a run-level fact; which commit a settled artifact
// was read at is a fact about that artifact, and it carries it.

/**
 * Default archive, whose subdirectories are run sets.
 */
const DEFAULT_ARCHIVE_DIR = join(
  homedir(),
  'translation-repair-v2-archive',
);

/**
 * Cap meaning "buy everything", which is what a run with no `--cap` asks for.
 */
const NO_CAP = -1;

/**
 * What the command line asked for.
 *
 * @example
 * ```ts
 * const { archiveDir, cloneDir, onlyIds, cap, } = readAuditArguments();
 * ```
 */
export type AuditArguments = {
  /**
   * Archive whose subdirectories are run sets.
   */
  readonly archiveDir: string;

  /**
   * Corpus clone the artifacts' own commits are read from.
   */
  readonly cloneDir: string;

  /**
   * Entries to audit, empty for every entry.
   */
  readonly onlyIds: readonly string[];

  /**
   * How many subjects to buy, negative for all of them.
   *
   * ZERO IS MEANINGFUL and is half the reason this exists: it reads and
   * verifies the whole archive, prints the population, and asks nobody
   * anything. A run that cannot do that has a wiring fault, and finding one
   * should not cost a roster.
   */
  readonly cap: number;
};

/**
 * Reads a value written after a named flag.
 *
 * @param args - arguments after the script path
 *
 * @param flag - flag to look for
 *
 * @returns Value written after it, empty when the flag is absent
 *
 * @example
 * ```ts
 * const capText = valueAfter({ args, flag: '--cap', },);
 * ```
 */
function valueAfter(
  {
    args,
    flag,
  }: {
    readonly args: readonly string[];
    readonly flag: string;
  },
): string {
  /**
   * Where the flag was written.
   */
  const at = args.indexOf(flag,);
  if (at === NO_CAP)
    return '';
  return args[at + 1] ?? '';
}

/**
 * Reads what the command line asked for.
 *
 * @param argv - process arguments, passed rather than read so this is testable
 * without a subprocess
 *
 * @returns Archive, clone, entry filter and cap
 *
 * @example
 * ```ts
 * const asked = readAuditArguments({ argv: process.argv, },);
 * ```
 */
export function readAuditArguments(
  { argv, }: { readonly argv: readonly string[]; },
): AuditArguments {
  /**
   * Arguments after the script path.
   */
  const args = argv.slice(2,);

  /**
   * Cap as written, when one was named.
   */
  const capText = valueAfter({
    args,
    flag: '--cap',
  },);

  /**
   * Archive as written, when one was named.
   */
  const archiveText = valueAfter({
    args,
    flag: '--archive',
  },);

  /**
   * Clone as written, when one was named.
   */
  const cloneText = valueAfter({
    args,
    flag: '--clone',
  },);

  /**
   * Entries named after `--only`, comma separated.
   */
  const onlyIds = valueAfter({
    args,
    flag: '--only',
  },)
    .split(',',)
    .filter(function isNamed(id,): boolean {
      return id !== '';
    },);

  return {
    archiveDir: (archiveText === '') ? DEFAULT_ARCHIVE_DIR : archiveText,
    cloneDir: (cloneText === '') ? RUN_CORPUS_PIN.cloneDir : cloneText,
    onlyIds,
    cap: (capText === '') ? NO_CAP : Math.trunc(Number(capText,),),
  };
}

//endregion Settled rendering audit arguments
