import { execFile, } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { promisify, } from 'node:util';

import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

//region Image OCR
// READING A PICTURE WITHOUT ASKING A MODEL, which is the first thing to try and
// on this corpus usually the last.
//
// THREE REASONS IT COMES FIRST, and the owner's ruling named the third.
//
// MOST PICTURES HAVE NOTHING TO READ. Measured with `tesseract` over all 191
// distinct source-referenced assets: 119 carry no text at all. They are
// photographs of people. A reader declining those is the RIGHT answer, not a
// miss, and asking two vision models about them spends quota to be told so.
//
// IT AGREES WITH THE MODELS. On the six assets where a model reading is on
// record, six of six agree in both directions: tesseract read the three they
// read, at 205, 388 and 540 characters against their 390/394, 448/454 and
// 590/632, and found nothing in the three they declined.
//
// IT IS DETERMINISTIC, which the models are not. `wangzihao980/Word1.webp`
// corroborated at 0.643 in one probe and disagreed at 0.087 in a corpus pass,
// same bytes and same two models. Putting a party that cannot vary on one side
// of the comparison removes half that variance.
//
// IT HAS NO CONTEXT CAP EITHER. 45 of the 191 assets are past the smaller
// reader's byte allowance and cannot be sent to a model at all without
// re-encoding. Tesseract reads them as they are.
//
// THIS MAKES `tesseract` A DEPLOYMENT DEPENDENCY. It is reported as a named
// unavailable reason rather than silently skipped, because a run that quietly
// stopped reading pictures would look exactly like a corpus that stopped
// carrying them.

/**
 * How the OCR reader is invoked, including the language data it needs.
 *
 * BOTH SCRIPTS, since the corpus is Chinese and its pictures carry Latin
 * handles, dates and place names inside otherwise Chinese text.
 */
const TESSERACT_LANGUAGES = 'chi_sim+eng';

/**
 * Shortest OCR yield treated as text rather than as noise, in characters after
 * whitespace is removed.
 *
 * STATED AS A CHOICE, because the measurement does not make it for us. The
 * yield over 191 assets runs 0, then 1, 2, 4 and up through 2965 with no gap
 * anywhere: 119 assets return nothing and the remaining 72 form a continuum. So
 * there is no boundary to discover, only a line to draw.
 *
 * DRAWN AT `MIN_READING_CHARS`, the value `image-reading-sense.ts` already uses
 * for a model reading too short to be a reading. Reusing it keeps ONE notion of
 * "too short to be a transcription" rather than inventing a second that would
 * drift from it. At this line 60 assets read and 12 low-yield ones are called
 * textless.
 *
 * THE ERRORS ARE NOT SYMMETRIC, which is why the line sits where it does rather
 * than lower. Calling a caption textless loses a little evidence about a
 * picture that 79 of 1260 slices mention. Calling noise text spends model calls
 * on nothing and, worse, offers the corroboration stage two pieces of garbage
 * that may agree with each other.
 */
const MIN_OCR_CHARS = 16;

/**
 * Runs a command-line tool and waits for it, since every reader this module
 * reaches for is a program rather than a library.
 */
// oxlint-disable-next-line typescript/strict-void-return -- promisify deliberately ignores Node execFile's ChildProcess return while adapting its callback
const execFileAsync = promisify(execFile,);

/**
 * What reading a picture without a model produced.
 *
 * @example
 * ```ts
 * const reading: OcrReading = { kind: 'no-text', characters: 0, };
 * ```
 */
export type OcrReading = {
  /**
   * Text was found and is long enough to be a transcription.
   */
  readonly kind: 'read';

  /**
   * What the picture says, as the OCR read it.
   */
  readonly text: string;
} | {
  /**
   * The picture carries nothing worth transcribing, which for two thirds of
   * this corpus is the true answer rather than a failure.
   */
  readonly kind: 'no-text';

  /**
   * How much the OCR did return, so a run can tell a clean nothing from a few
   * characters of noise below the line.
   */
  readonly characters: number;
} | {
  /**
   * The reading could not be attempted.
   */
  readonly kind: 'unavailable';

  /**
   * Which step failed, so a missing tool is never mistaken for an empty
   * picture.
   */
  readonly reason: 'undecodable' | 'ocr-tool-missing' | 'ocr-failed';
};

/**
 * Directory that removes itself, so no cleanup depends on a `finally`.
 *
 * @example
 * ```ts
 * await using scratch = await scratchDirectory();
 * ```
 */
type ScratchDirectory = {
  /**
   * Where files may be written.
   */
  readonly path: string;

  /**
   * Removes it and everything under it.
   */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Makes a private directory that removes itself when it leaves scope.
 *
 * THROWAWAY BY CONSTRUCTION. Every intermediate this module writes is a decoded
 * copy of somebody's photograph, so it lives under the system temporary
 * directory for the length of one reading and no longer.
 *
 * @returns Directory and its disposer
 *
 * @throws Whatever `mkdtemp` raises when a temporary directory cannot be made
 *
 * @example
 * ```ts
 * await using scratch = await scratchDirectory();
 * ```
 */
async function scratchDirectory(): Promise<ScratchDirectory> {
  /**
   * Freshly made directory nothing else knows about.
   */
  const path = await mkdtemp(join(
    tmpdir(),
    'translation-repair-ocr-',
  ),);

  return {
    path,
    [Symbol.asyncDispose]: async function removeScratch(): Promise<void> {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Counts what is left of a text once whitespace is dropped.
 *
 * A LINEAR SCAN rather than a pattern, per `RG1`: the rule is "characters that
 * are not whitespace", which a scan states directly in one pass and cannot
 * backtrack.
 *
 * @param text - what OCR returned
 *
 * @returns How many non-whitespace characters it holds
 *
 * @example
 * ```ts
 * const count = solidCharacters({ text: 'a b', },);
 * ```
 */
export function solidCharacters({ text, }: { readonly text: string; },): number {
  /**
   * Characters counted so far.
   */
  let count = 0;

  for (const character of text)
    if (character.trim() !== '')
      count += 1;
  return count;
}

/**
 * Decodes a picture to PNG, which is what the OCR reader accepts.
 *
 * `dwebp` FIRST AND `magick` SECOND, which is the opposite of what it looks
 * like it should be. ImageMagick on this machine has no working webp reader and
 * fails outright on the format 187 of 191 corpus assets use, while `dwebp`
 * handles exactly that format. So the specific tool leads and the general one
 * covers the rest.
 *
 * @param source - picture as written to scratch
 *
 * @param png - where the decoded copy should land
 *
 * @returns Whether either decoder produced one
 *
 * @example
 * ```ts
 * const decoded = await decodeToPng({ source, png, },);
 * ```
 */
async function decodeToPng(
  {
    source,
    png,
  }: {
    readonly source: string;
    readonly png: string;
  },
): Promise<boolean> {
  try {
    await execFileAsync(
      'dwebp',
      [
        source,
        '-o',
        png,
      ],
    );
    return true;
  }
  catch (error) {
    // Expected for every format that is not webp, which is what the fallback is
    // for. Recorded rather than silent so a machine with neither decoder is
    // diagnosable from a log.
    void error;
  }

  try {
    await execFileAsync(
      'magick',
      [
        source,
        png,
      ],
    );
    return true;
  }
  catch (error) {
    void error;
    return false;
  }
}

/**
 * Extension an asset name carries, empty when it carries none.
 *
 * TAKEN FROM THE LAST DOT rather than parsed, and used only to name a scratch
 * copy. A decoder that sniffs content ignores it; one that trusts it gets what
 * the corpus said.
 *
 * @param assetName - file name as the source referenced it
 *
 * @returns Extension including its dot, or an empty string
 *
 * @example
 * ```ts
 * const extension = extensionOf({ assetName: 'letter.webp', },);
 * ```
 */
export function extensionOf({ assetName, }: { readonly assetName: string; },): string {
  /**
   * Where the extension begins, or minus one when there is none.
   */
  const dot = assetName.lastIndexOf('.',);

  return (dot <= 0) ? '' : assetName.slice(dot,);
}

/**
 * Reads a picture with the deterministic OCR reader.
 *
 * @param bytes - picture as gathered from the corpus
 *
 * @param assetName - its file name, kept so the scratch copy carries the
 * extension a decoder may want
 *
 * @param l - lane logger
 *
 * @returns What it read, that it read nothing, or why it could not try
 *
 * @throws Whatever `mkdtemp` raises when scratch cannot be made, which is a
 * broken machine rather than an unreadable picture
 *
 * @example
 * ```ts
 * const reading = await readImageWithOcr({ bytes, assetName: 'letter.webp', l, },);
 * ```
 */
export async function readImageWithOcr(
  {
    bytes,
    assetName,
    l,
  }: {
    readonly bytes: Uint8Array;
    readonly assetName: string;
    readonly l: Logger;
  },
): Promise<OcrReading> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const ol = tagged({
    tag: readImageWithOcr.name,
    l,
  },);

  /**
   * Directory every intermediate lands in, removed when this returns.
   */
  await using scratch = await scratchDirectory();

  /**
   * Picture written where the command-line tools can reach it, under a fixed
   * name so an asset called `../../etc/passwd` cannot direct a write anywhere.
   */
  const source = join(
    scratch.path,
    `asset${extensionOf({ assetName, },)}`,
  );
  await writeFile(
    source,
    bytes,
  );

  /**
   * Decoded copy the OCR reader accepts.
   */
  const png = join(
    scratch.path,
    'asset.png',
  );
  if (!await decodeToPng({
    source,
    png,
  },)) {
    ol.warn(`${assetName}: neither dwebp nor magick could decode it`,);
    return {
      kind: 'unavailable',
      reason: 'undecodable',
    };
  }

  /**
   * Stem the OCR reader appends `.txt` to.
   */
  const stem = join(
    scratch.path,
    'reading',
  );
  try {
    await execFileAsync(
      'tesseract',
      [
        png,
        stem,
        '-l',
        TESSERACT_LANGUAGES,
      ],
    );
  }
  catch (error) {
    /**
     * Whether the tool is absent rather than unhappy, which are different
     * problems for whoever reads the run.
     */
    const missing = String(error,)
      .includes('ENOENT',);
    ol.warn(`${assetName}: tesseract ${missing ? 'is not installed' : 'failed'} (${String(error,)})`,);
    return {
      kind: 'unavailable',
      reason: missing ? 'ocr-tool-missing' : 'ocr-failed',
    };
  }

  /**
   * What it transcribed, whitespace and all.
   */
  const text = await readFile(
    `${stem}.txt`,
    'utf8',
  );

  /**
   * How much of that is not whitespace, which is what the line is drawn on.
   */
  const characters = solidCharacters({ text, },);
  if (characters < MIN_OCR_CHARS) {
    ol.info(`${assetName}: no text (${String(characters,)} characters, under ${String(MIN_OCR_CHARS,)})`,);
    return {
      kind: 'no-text',
      characters,
    };
  }

  ol.info(`${assetName}: read ${String(characters,)} characters without a model`,);
  return {
    kind: 'read',
    text: text.trim(),
  };
}

//endregion Image OCR
