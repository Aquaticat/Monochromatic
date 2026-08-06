import {
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  parsePreGrades,
  scoreGradeAgreement,
  scoreGradedPrecision,
} from '../grade-agreement.ts';
import { parseGradedSheet, } from '../grade-sheet-read.ts';
import { DEFAULT_SAMPLE_SEED, } from '../sample-grading.ts';
import { resolveRunsDir, } from './run-config.ts';

//region Score agreement
// Reads a graded detection sheet and, when one exists, the blind pre-grades
// recorded beside it, then prints precision and pre-grade agreement.
//
// Prints COUNTS AND POSITIONS ONLY. The sheet quotes UNLICENSED corpus text and
// this output is meant to be pasteable into a verdict or a message, so nothing
// it emits carries a quote, a claim, or a grader's rationale.
//
// Precision is reported whether or not pre-grades exist, because that is the
// milestone gate number and it must not depend on a calibration artifact being
// present.

/**
 * File name pattern for the blind pre-grades of one draw.
 *
 * @param seed - draw seed the pre-grades belong to
 *
 * @returns File name beside the sheet
 *
 * @example
 * ```ts
 * const name = preGradeName({ seed: DEFAULT_SAMPLE_SEED, },);
 * ```
 */
function preGradeName({ seed, }: { readonly seed: string; },): string {
  return `pre-grades-${seed}.json`;
}

/**
 * Reads one command-line option's value.
 *
 * @param flag - long-form flag, including leading dashes
 *
 * @returns Value following the flag; empty when the flag was not passed, which
 * is also how an override left blank is treated, since neither names a file
 *
 * @example
 * ```ts
 * const sheet = optionValue({ flag: '--sheet', },);
 * ```
 */
function optionValue({ flag, }: { readonly flag: string; },): string {
  /**
   * Where the flag sits among the arguments.
   */
  const at = process.argv
    .indexOf(flag,);
  if (at === (-1))
    return '';
  return process.argv
    .at(at + 1,)
    ?? '';
}

/**
 * What reading an optional file found.
 *
 * @example
 * ```ts
 * const reading: FileReading = { found: false, };
 * ```
 */
type FileReading =
  | {
    /**
     * File is not there, which for pre-grades is the ordinary case.
     */
    readonly found: false;
  }
  | {
    /**
     * File was read.
     */
    readonly found: true;

    /**
     * Its contents.
     */
    readonly text: string;
  };

/**
 * Reads a file, naming its absence rather than returning nothing.
 *
 * @param path - file to read
 *
 * @returns Contents, or a named absence when the file does not exist
 *
 * @throws Whatever `readFile` raised when the failure was not a plain absence,
 * because a permissions or IO fault must not read as "no pre-grades recorded"
 *
 * @example
 * ```ts
 * const reading = await readOptional({ path, },);
 * ```
 */
async function readOptional(
  { path, }: { readonly path: string; },
): Promise<FileReading> {
  try {
    return {
      found: true,
      text: await readFile(
        path,
        'utf8',
      ),
    };
  }
  catch (error) {
    // An absent pre-grade file is the ordinary case before calibration starts;
    // anything else is a real fault and must surface.
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      return { found: false, };
    throw error;
  }
}

/**
 * Renders one rate to three places, naming an empty denominator rather than
 * printing a division by zero.
 *
 * @param numerator - items counted in favor
 *
 * @param denominator - items the rate is taken over
 *
 * @returns Rate text
 *
 * @example
 * ```ts
 * const text = rate({ numerator: 37, denominator: 47, },);
 * ```
 */
function rate(
  {
    numerator,
    denominator,
  }: {
    readonly numerator: number;
    readonly denominator: number;
  },
): string {
  if (denominator === 0)
    return 'n/a';
  return (numerator / denominator)
    .toFixed(3,);
}

/**
 * Prints precision and, when pre-grades exist, agreement against them.
 *
 * @example
 * ```ts
 * await reportGrades();
 * ```
 */
async function reportGrades(): Promise<void> {
  /**
   * Durable, gitignored output root.
   */
  const runsDir = await resolveRunsDir();

  /**
   * Graded sheet path, defaulting to this seed's final sheet.
   */
  const sheetPath = optionValue({ flag: '--sheet', },)
    || join(
      runsDir,
      `grading-sheet-${DEFAULT_SAMPLE_SEED}.md`,
    );

  /**
   * Human's grades read off the sheet.
   */
  const human = parseGradedSheet({
    text: await readFile(
      sheetPath,
      'utf8',
    ),
  },);

  /**
   * Precision over the items the human scored.
   */
  const precision = scoreGradedPrecision({ human, },);

  // Three rates, because a declined item has three defensible readings and the
  // recorded verdicts quote all of them. Round two's archived sheet reproduces
  // its published 0.740 / 0.787 / 0.800 exactly through these, which is the
  // check that this reader agrees with how the number was reported before.
  console.log(
    `PRECISION items=${String(human.length,)} scored=${
      String(precision.scored,)
    } realDefects=${String(precision.realDefects,)} strict=${
      rate({
        numerator: precision.realDefects,
        denominator: human.length,
      },)
    } excluded=${
      rate({
        numerator: precision.realDefects,
        denominator: precision.scored,
      },)
    } lenient=${
      rate({
        numerator: precision.realDefects
          + precision.unscored
          .length,
        denominator: human.length,
      },)
    } unscored=${
      precision.unscored
        .length
        === 0
        ? 'none'
        : precision.unscored
          .join(',',)
    }`,
  );

  /**
   * Blind pre-grades, when calibration recorded any for this draw.
   */
  const preGrades = await readOptional({
    path: optionValue({ flag: '--pre-grades', },)
      || join(
        runsDir,
        preGradeName({ seed: DEFAULT_SAMPLE_SEED, },),
      ),
  },);
  if (!preGrades.found) {
    console.log('AGREEMENT none: no pre-grades recorded for this draw',);
    return;
  }

  /**
   * Agreement between the blind pre-grades and the human's grades.
   */
  const agreement = scoreGradeAgreement({
    agent: parsePreGrades({ text: preGrades.text, },),
    human,
  },);
  console.log(
    `AGREEMENT compared=${String(agreement.compared,)} agreed=${
      String(agreement.agreed,)
    } rate=${
      rate({
        numerator: agreement.agreed,
        denominator: agreement.compared,
      },)
    } disagreed=${
      agreement.disagreed
        .length
        === 0
        ? 'none'
        : agreement.disagreed
          .join(',',)
    }`,
  );
}

if (import.meta.main)
  await reportGrades();

//endregion Score agreement
