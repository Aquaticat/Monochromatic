import { readdir, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  errorName,
  failureName,
} from '../error-name.ts';
import {
  readRunJson,
  RunJsonUnreadableError,
} from '../run-json-read.ts';
import {
  LedgerShapeError,
  parseLedgerRound,
  type ReadRound,
} from './ledger-parse.ts';

//region Ledger directory
// Walks a run's ledger directory and reads every contest in it, reporting the
// files that refused rather than raising on the first one.
//
// SPLIT OUT OF `ledger-report.ts` on 2026-08-25, when guarding the read pushed
// that file past its line budget. The seam is the useful one anyway: this half
// answers WHAT THE DIRECTORY HOLDS and the CLI half decides what to print, so
// the reading is now testable without running a command.
//
// EVERY FILE IS ATTEMPTED. A report exists to say what a run recorded, and one
// unreadable file is not an answer about the others. Stopping at the first would
// also make the report's completeness depend on directory order.

/**
 * Code a filesystem failure carries when the path simply is not there, which
 * is the one failure a run with no ledger is expected to produce.
 */
const DIRECTORY_ABSENT = 'ENOENT';

/**
 * One ledger file that could not be read, said without being quoted.
 */
export type RefusedFile = {
  /**
   * File that refused, by name.
   */
  readonly file: string;

  /**
   * What to tell a reader, carrying no text from the file itself.
   */
  readonly says: string;
};

/**
 * Everything a ledger directory yielded, beside everything it would not.
 */
export type LedgerReading = {
  /**
   * Contests that read cleanly, in judging order.
   */
  readonly rounds: readonly ReadRound[];

  /**
   * Files that refused, which are contests the run recorded and no figure
   * computed from this reading can count.
   */
  readonly refused: readonly RefusedFile[];
};

/**
 * Says why one file refused, without quoting it.
 *
 * PASSES OUR OWN CLASSES' MESSAGES THROUGH, AND NO OTHER'S. `RunJsonUnreadableError`
 * and `LedgerShapeError` are each built to name a file and a reason rather than
 * echo a value, and each records that in its own note. Every other class carries
 * a message nobody here wrote, so only its name is reported.
 *
 * @param error - caught value, of unknown type by construction
 *
 * @param file - file being read when it was thrown
 *
 * @returns Refusal safe to print beside a run directory
 *
 * @example
 * ```ts
 * const refusal = refusalOf({ error, file: '000001.json', },);
 * ```
 */
export function refusalOf(
  {
    error,
    file,
  }: {
    readonly error: unknown;
    readonly file: string;
  },
): RefusedFile {
  if ((error instanceof RunJsonUnreadableError)
    || (error instanceof LedgerShapeError))
    return {
      file,
      says: error.message,
    };

  return {
    file,
    says: `refused by ${errorName({ error, },)}`,
  };
}

/**
 * Lists a ledger directory, reporting an absent one as empty.
 *
 * @param dir - ledger directory to list
 *
 * @returns File names, empty where the directory is not there
 *
 * @throws {@link Error} where the directory exists and could not be listed
 *
 * @example
 * ```ts
 * const names = await namesUnder({ dir, },);
 * ```
 */
async function namesUnder(
  { dir, }: { readonly dir: string; },
): Promise<readonly string[]> {
  try {
    return await readdir(dir,);
  } catch (error) {
    // ONLY AN ABSENT DIRECTORY IS AN ANSWER. Every other failure is re-raised,
    // because a run whose ledger could not be READ and a run that recorded
    // nothing read the same downstream, and treating a permission failure as an
    // empty ledger would report a roster question as unanswerable when the
    // evidence is sitting there.
    if (Error.isError(error,)
      && ('code' in error)
      && (error.code === DIRECTORY_ABSENT))
      return [];

    throw new Error(
      `could not list the ledger directory (${failureName({ error, },)})`,
      { cause: error, },
    );
  }
}

/**
 * One file's outcome: a contest, or the reason it could not be one.
 */
type FileOutcome =
  | {
    readonly kind: 'round';
    readonly round: ReadRound;
  }
  | {
    readonly kind: 'refused';
    readonly refusal: RefusedFile;
  };

/**
 * Reads every contest a ledger directory holds, keeping what refused.
 *
 * @param dir - ledger directory to read
 *
 * @returns Contests in judging order beside the files that would not read
 *
 * @throws {@link Error} where the directory exists and could not be listed
 *
 * @example
 * ```ts
 * const reading = await readLedgerDirectory({ dir, },);
 * ```
 */
export async function readLedgerDirectory(
  { dir, }: { readonly dir: string; },
): Promise<LedgerReading> {
  /**
   * Files the recorder wrote, empty where the directory is not there.
   *
   * AN ABSENT DIRECTORY IS AN ANSWER, not a fault: a run that wrote no ledger
   * is the ordinary case for everything launched before it existed, and the
   * caller reports that rather than raising.
   */
  const names = await namesUnder({ dir, },);

  /**
   * Names in the order the recorder stamped them, which is contest order:
   * every file is named by a zero-padded ordinal.
   */
  const inOrder = names.toSorted(function byName(
    left,
    right,
  ): number {
    return (left < right) ? -1 : 1;
  },);

  /**
   * What each file turned out to be.
   */
  const outcomes = await Promise.all(inOrder.map(async function one(name,): Promise<FileOutcome> {
    try {
      return {
        kind: 'round',
        round: parseLedgerRound({
          value: await readRunJson({
            path: join(
              dir,
              name,
            ),
          },),
          from: name,
        },),
      };
    } catch (error) {
      return {
        kind: 'refused',
        refusal: refusalOf({
          error,
          file: name,
        },),
      };
    }
  },),);

  return {
    rounds: outcomes
      .filter(function read(outcome,): outcome is Extract<FileOutcome, { kind: 'round'; }> {
        return outcome.kind === 'round';
      },)
      .map(function round(outcome,): ReadRound {
        return outcome.round;
      },),
    refused: outcomes
      .filter(function lost(outcome,): outcome is Extract<FileOutcome, { kind: 'refused'; }> {
        return outcome.kind === 'refused';
      },)
      .map(function refusal(outcome,): RefusedFile {
        return outcome.refusal;
      },),
  };
}

//endregion Ledger directory
