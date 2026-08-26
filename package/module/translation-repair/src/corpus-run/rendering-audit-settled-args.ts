import { homedir, } from 'node:os';
import { join, } from 'node:path';

import { StatedRefusalError, } from '../stated-refusal.ts';
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
 * What `indexOf` returns for a flag nobody wrote.
 *
 * SPELLED SEPARATELY FROM {@link NO_CAP} DESPITE SHARING A VALUE. One is a
 * cap and the other is an array position, and a reader who meets `NO_CAP` in
 * an index comparison has to stop and work out whether that is deliberate.
 * Two meanings on one constant is the defect `#170` was opened for.
 */
const FLAG_ABSENT = -1;

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
 * What a flag carried, or that nobody wrote it.
 *
 * NAMED RATHER THAN LEFT NULLISH because the two answers lead to opposite
 * behaviour one line later: an unwritten flag takes a default, and a written
 * one that carries nothing is a typo this refuses. A nullish union puts both
 * behind the same check and invites the collapse that was the defect here.
 */
type FlagValue = {
  readonly kind: 'written';

  /**
   * What was written after the flag.
   */
  readonly value: string;
} | { readonly kind: 'unwritten'; };

/**
 * Marker every flag here starts with, so a missing value is distinguishable
 * from the next flag standing where a value should be.
 */
const FLAG_PREFIX = '--';

/**
 * Reads a value written after a named flag.
 *
 * ABSENT AND EMPTY ARE DIFFERENT ANSWERS, and collapsing them is what this
 * function used to do. Both came back as the empty string, which every caller
 * then read as "not asked for", so `--cap` written at the end of the line
 * bought everything and `--only` written at the end audited everything. Those
 * are the opposite of what the person typing them asked for, and neither said
 * a word about it.
 *
 * @param args - arguments after the script path
 *
 * @param flag - flag to look for
 *
 * @returns Value written after it, or that the flag itself was not written
 *
 * @throws StatedRefusalError when the flag was written with nothing usable
 * after it
 *
 * @example
 * ```ts
 * const asked = valueAfter({ args, flag: '--cap', },);
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
): FlagValue {
  /**
   * Where the flag was written.
   */
  const at = args.indexOf(flag,);
  if (at === FLAG_ABSENT)
    return { kind: 'unwritten', };

  /**
   * What was written after it, empty when the flag ended the line.
   */
  const written = args[at + 1] ?? '';

  if ((written === '') || written.startsWith(FLAG_PREFIX,))
    throw new StatedRefusalError({
      says: `${flag} needs a value written after it`,
    },);

  return {
    kind: 'written',
    value: written,
  };
}

/**
 * Reads how many subjects this run may buy.
 *
 * A CAP THAT IS NOT A NUMBER USED TO BUY NOTHING IN SILENCE. `capped` in
 * `rendering-audit-settled.ts` returns every subject when the cap is negative
 * and `slice(0, cap)` otherwise. `Number('once')` is `NaN`, `NaN < 0` is false
 * and `slice(0, NaN)` is empty, so a mistyped cap audited zero subjects and
 * reported a clean run over the whole archive.
 *
 * @param args - arguments after the script path
 *
 * @returns Cap as asked, or every subject when none was asked for
 *
 * @throws StatedRefusalError when a cap was named that is not a whole number,
 * or is below zero
 *
 * @example
 * ```ts
 * const cap = readCap({ args, },);
 * ```
 */
function readCap(
  { args, }: { readonly args: readonly string[]; },
): number {
  /**
   * Cap as written, absent when none was named.
   */
  const capText = valueAfter({
    args,
    flag: '--cap',
  },);
  if (capText.kind === 'unwritten')
    return NO_CAP;

  /**
   * Cap as a whole number, which a mistyped one is not.
   */
  const asked = Math.trunc(Number(capText.value,),);

  if (!Number.isFinite(asked,))
    throw new StatedRefusalError({
      says: `--cap needs a whole number, and ${capText.value} is not one`,
    },);

  // A NEGATIVE CAP IS REFUSED rather than read as "every subject". `capped`
  // spells "every subject" with the internal `NO_CAP` sentinel, and letting a
  // typed sign reach it meant `--cap -3` audited the whole archive in silence.
  if (asked < 0)
    throw new StatedRefusalError({
      says: `--cap cannot be below zero, and ${capText.value} is; leave it off to audit every subject`,
    },);

  return asked;
}

/**
 * Reads which entries this run may audit.
 *
 * @param args - arguments after the script path
 *
 * @returns Entries named, empty when every entry was asked for
 *
 * @throws StatedRefusalError when `--only` was written naming no entry
 *
 * @example
 * ```ts
 * const onlyIds = readOnlyIds({ args, },);
 * ```
 */
function readOnlyIds(
  { args, }: { readonly args: readonly string[]; },
): readonly string[] {
  /**
   * Entries as written, comma separated, absent when none were named.
   */
  const onlyText = valueAfter({
    args,
    flag: '--only',
  },);
  if (onlyText.kind === 'unwritten')
    return [];

  /**
   * Entries the text actually names, dropping the gaps a stray comma leaves.
   */
  const named = onlyText
    .value
    .split(',',)
    .filter(function isNamed(id,): boolean {
      return id !== '';
    },);

  // A separator with no id beside it names nobody, and returning it empty
  // would read as "every entry" one line later.
  if (named.length === 0)
    throw new StatedRefusalError({
      says: `--only needs at least one entry id, and ${onlyText.value} names none`,
    },);

  return named;
}

/**
 * What the report was told to read and compare.
 *
 * @example
 * ```ts
 * const { run, against, } = readReportArguments({ argv: process.argv, },);
 * ```
 */
export type ReportArguments = {
  /**
   * Run file named with `--run`, in a one-element list, empty when the
   * report should read the newest kept run.
   */
  readonly run: readonly string[];

  /**
   * Earlier run file named with `--against`, in a one-element list, empty
   * when no across-run band was asked for.
   */
  readonly against: readonly string[];
};

/**
 * Reads the report's two flags with the same refusal the audit's flags get.
 *
 * SHARED RATHER THAN COPIED, because the report module had its own reader
 * that collapsed absent and valueless into one empty string, which is exactly
 * the defect this module records as fixed for `--cap` and `--only`: `--run`
 * written last reported the newest run, and `--against` written last printed
 * no across-run band, and neither said a word.
 *
 * @param argv - process arguments
 *
 * @returns Named files, each in a one-element list when written
 *
 * @throws StatedRefusalError when either flag was written with nothing usable
 * after it
 *
 * @example
 * ```ts
 * const { run, } = readReportArguments({ argv: process.argv, },);
 * ```
 */
export function readReportArguments(
  { argv, }: { readonly argv: readonly string[]; },
): ReportArguments {
  /**
   * Arguments after the script path.
   */
  const args = argv.slice(2,);

  /**
   * What `--run` named.
   */
  const run = valueAfter({
    args,
    flag: '--run',
  },);

  /**
   * What `--against` named.
   */
  const against = valueAfter({
    args,
    flag: '--against',
  },);
  return {
    run: (run.kind === 'written') ? [run.value,] : [],
    against: (against.kind === 'written') ? [against.value,] : [],
  };
}

/**
 * Reads what the command line asked for.
 *
 * @param argv - process arguments, passed rather than read so this is testable
 * without a subprocess
 *
 * @returns Archive, clone, entry filter and cap
 *
 * @throws StatedRefusalError when a flag was written without a usable value
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
   * Archive as written, absent when none was named.
   */
  const archiveText = valueAfter({
    args,
    flag: '--archive',
  },);

  /**
   * Clone as written, absent when none was named.
   */
  const cloneText = valueAfter({
    args,
    flag: '--clone',
  },);

  return {
    archiveDir: (archiveText.kind === 'written') ? archiveText.value : DEFAULT_ARCHIVE_DIR,
    cloneDir: (cloneText.kind === 'written') ? cloneText.value : RUN_CORPUS_PIN.cloneDir,
    onlyIds: readOnlyIds({ args, },),
    cap: readCap({ args, },),
  };
}

//endregion Settled rendering audit arguments
