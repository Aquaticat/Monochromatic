import { readFile, } from 'node:fs/promises';
import { basename, } from 'node:path';

import {
  errorName,
  failureName,
} from './error-name.ts';

//region Run JSON read
// Reads one JSON file out of a run directory so that NO FAILURE EVER QUOTES IT.
//
// V8 hands a `JSON.parse` refusal a synthetic script whose source IS the text it
// was given, and Node's uncaught-exception report prints that script's line. An
// unguarded parse therefore prints the file it could not read. Measured against
// `ledger-report` on 2026-08-25, which printed a whole contest above the stack:
//
//   <anonymous_script>:1
//   { "task": "whiskerfield-1", "at": "2026-08-25T00:01:00.000Z", "candidates":
//
//   SyntaxError: Bad control character in string literal in JSON at position 110
//
// A run directory holds corpus wording and a person's entry id, and neither is
// ever printed by a reader that was not asked for it. `errorName` exists for the
// same reason on the filesystem side, which its own note records: a message is
// uncontrolled, so a name is reported instead of one.
//
// THE REFUSAL NAMES THE FILE AND THE FAILURE AND NOTHING ELSE. A parse position
// is copied across as DIGITS ONLY, by scanning for the phrase V8 puts in front
// of it, because the offset is what tells an operator a file was truncated and
// it carries none of the text.
//
// THE BASENAME, NOT THE PATH. A run directory path names the run and, under
// `artifacts/`, the file's own stem is a person's entry id. Callers that mean to
// report an entry already hold its id and print it deliberately; this refusal
// does not decide that for them.

/**
 * Answer `indexOf` gives for a phrase that is not in the string.
 */
const NOT_FOUND = -1;

/**
 * Phrase V8 writes immediately before the byte offset a parse stopped at.
 *
 * Matched as a literal rather than by pattern: the surrounding message is
 * uncontrolled text that may quote the file, and a scan that copies only the
 * digits after a fixed phrase cannot carry any of it across by accident.
 */
const POSITION_PHRASE = ' at position ';

/**
 * Stand-in for an offset a refusal did not state.
 *
 * A NAMED SENTINEL rather than an absent value, which is how this package
 * models absence everywhere else: `selectedIndex` reads `number | 'declined'`
 * on the same grounds.
 */
const OFFSET_UNSTATED = 'unstated';

/**
 * Base the offset in a parse refusal is written in.
 */
const DECIMAL = 10;

/**
 * Copies the byte offset out of a parse refusal, taking digits and no text.
 *
 * Returns nothing where the message carries no offset, which is the ordinary
 * case for an empty file: V8 says only that input ended.
 *
 * @param message - refusal text, which may quote the file and is never returned
 *
 * @returns Offset as written, or nothing where the message states none
 *
 * @example
 * ```ts
 * const at = offsetIn({ message: 'Unexpected end of JSON input', },);
 * ```
 */
function offsetIn(
  { message, }: { readonly message: string; },
): number | typeof OFFSET_UNSTATED {
  /**
   * Where the phrase introducing an offset begins.
   */
  const phraseAt = message.indexOf(POSITION_PHRASE,);

  if (phraseAt === NOT_FOUND)
    return OFFSET_UNSTATED;

  /**
   * Leading integer of whatever follows the phrase.
   *
   * `parseInt` IS THE SCAN, and deliberately so. It reads a digit run, stops at
   * the first character that is not one, and never looks past it. Walking the
   * run by hand needed either a mutable cursor or a character array, and the
   * rules covering those two shapes forbid each other; the standard library
   * already does exactly this, and it carries nothing but the number out of a
   * message nobody here wrote.
   */
  const offset = Number.parseInt(
    message.slice(phraseAt + POSITION_PHRASE.length,),
    DECIMAL,
  );

  // A refusal with no digits after the phrase gives `NaN`, which is not a safe
  // integer, so one branch covers both that and any offset too large to trust.
  if ((!Number.isSafeInteger(offset,)) || (offset < 0))
    return OFFSET_UNSTATED;

  return offset;
}

/**
 * A run file that could not be read as JSON, named without being quoted.
 *
 * CARRIES THE FAILURE AS A FIELD so a caller can tell an absent file from an
 * unreadable one. An absent file is an answer for several readers here, and one
 * that could not be opened is not, so folding them together would report a run
 * that was never examined as a run with nothing in it.
 *
 * @example
 * ```ts
 * throw new RunJsonUnreadableError({ file: '000001.json', failure: 'SyntaxError', },);
 * ```
 */
export class RunJsonUnreadableError extends Error {
  /**
   * File that refused, by base name only.
   */
  readonly file: string;

  /**
   * Filesystem code where there was one, class name otherwise.
   */
  readonly failure: string;

  /**
   * Byte offset a parse stopped at, `unstated` for every other failure.
   */
  readonly at: number | typeof OFFSET_UNSTATED;

  /**
   * @param file - base name of the file that refused
   *
   * @param failure - filesystem code or class name, never a message
   *
   * @param at - byte offset a parse stopped at, where it stated one
   */
  constructor(
    {
      file,
      failure,
      at,
    }: {
      readonly file: string;
      readonly failure: string;
      readonly at: number | typeof OFFSET_UNSTATED;
    },
  ) {
    super(
      `could not read ${file} as JSON (${failure}`
        + `${(at === OFFSET_UNSTATED) ? '' : ` at byte ${String(at,)}`})`,
    );
    this.name = 'RunJsonUnreadableError';
    this.file = file;
    this.failure = failure;
    this.at = at;
  }
}

/**
 * Reads one run file's text, refusing without quoting the path.
 *
 * @param path - file to read
 *
 * @returns File's text
 *
 * @throws {@link RunJsonUnreadableError} carrying the filesystem code
 *
 * @example
 * ```ts
 * const text = await textOf({ path, },);
 * ```
 */
async function textOf(
  { path, }: { readonly path: string; },
): Promise<string> {
  try {
    return await readFile(
      path,
      'utf8',
    );
  } catch (error) {
    throw new RunJsonUnreadableError({
      file: basename(path,),
      failure: failureName({ error, },),
      at: OFFSET_UNSTATED,
    },);
  }
}

/**
 * Reads and parses one JSON file from a run directory.
 *
 * USE THIS RATHER THAN `JSON.parse` ON A RUN FILE. A bare parse that reaches
 * the top level prints the file, which the module note records in full.
 *
 * @param path - file to read
 *
 * @returns Parsed value, of unknown shape for a caller's parser to check
 *
 * @throws {@link RunJsonUnreadableError} where it is absent, unopenable, or not JSON
 *
 * @example
 * ```ts
 * const round = parseLedgerRound({ value: await readRunJson({ path, },), from, },);
 * ```
 */
export async function readRunJson(
  { path, }: { readonly path: string; },
): Promise<unknown> {
  /**
   * File as written, read through a refusal that names no path.
   */
  const text = await textOf({ path, },);

  try {
    return JSON.parse(text,) as unknown;
  } catch (error) {
    throw new RunJsonUnreadableError({
      file: basename(path,),
      failure: errorName({ error, },),
      at: Error.isError(error,)
        ? offsetIn({ message: error.message, },)
        : OFFSET_UNSTATED,
    },);
  }
}

//endregion Run JSON read
