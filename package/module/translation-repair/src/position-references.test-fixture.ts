/**
 The scan behind `position-references.unit.test.ts` (ledger D33): the
 functions that find a reference by position in a file and match it against
 the guard's exemptions. Split out of the guard so a probe can print every
 reference the guard would name, whole, where a failing assertion shows a
 truncated list; its vocabulary and its reading of a text sit in the two
 sibling fixtures.

 @module
 */

import { isAsciiDigit, } from '../dist/final/node/index.mjs';
import {
  joinedText,
  type Word,
  wordsOf,
} from './position-references-text.test-fixture.ts';
import {
  COMPARED_OBJECTS,
  JOIN_GAP,
  NAMING_OPENERS,
  POSITIONS,
  SEQUENCES,
  STRUCTURE_THEN_POSITION,
  WINDOW_REACH,
} from './position-references-vocabulary.test-fixture.ts';
import type { PackageText, } from './prose-texts.test-fixture.ts';

//region Scan

/**
 One reference by position.

 @example
 ```ts
 const found: PositionReference = { path: 'src/cat.ts', line: 3, phrase: 'case above', window: '...', };
 ```
 */
export type PositionReference = {
  /**
   File it stands in.
   */
  readonly path: string;

  /**
   Line its first word stands on.
   */
  readonly line: number;

  /**
   The phrase as written.
   */
  readonly phrase: string;

  /**
   Text around it, which an exemption is matched against.
   */
  readonly window: string;
};

/**
 One reference by position the guard leaves, with why.

 @example
 ```ts
 const exempt: PositionExemption = { path: 'src/cat.ts', holds: 'note above the bowl', reason: 'page text', };
 ```
 */
export type PositionExemption = {
  /**
   File it stands in.
   */
  readonly path: string;

  /**
   Text beside it that picks it out.
   */
  readonly holds: string;

  /**
   Why it is not a reference by position.
   */
  readonly reason: string;
};

/**
 Whether two words stand next to each other with nothing but a joining gap
 between them.

 @param flat - joined text

 @param left - earlier word

 @param right - later word

 @returns Whether they join

 @example
 ```ts
 adjoins({ flat, left, right, },);
 ```
 */
function adjoins(
  {
    flat,
    left,
    right,
  }: {
    readonly flat: string;
    readonly left: Word;
    readonly right: Word;
  },
): boolean {
  if (right.start <= left.end)
    return false;
  for (let at = left.end; at < right.start; at += 1) {
    if (!JOIN_GAP.has(flat.charAt(at,),))
      return false;
  }
  return true;
}

/**
 Whether the words from an index on spell a sequence, each from its set and
 each adjoining the last.

 @param flat - joined text

 @param words - every word of it

 @param at - index of the first word

 @param sets - one set per word of the sequence

 @returns Whether they match

 @example
 ```ts
 spells({ flat, words, at: 0, sets: [DETERMINERS, SEQUENCE_NOUNS,], },);
 ```
 */
function spells(
  {
    flat,
    words,
    at,
    sets,
  }: {
    readonly flat: string;
    readonly words: readonly Word[];
    readonly at: number;
    readonly sets: readonly ReadonlySet<string>[];
  },
): boolean {
  return sets.every(function matches(
    set,
    offset,
  ): boolean {
    /**
     Word this set is matched against.
     */
    const word = words[at + offset];
    if ((word === undefined) || (!set.has(word.text,)))
      return false;
    if (offset === 0)
      return true;
    /**
     Word before it in the sequence.
     */
    const previous = words[(at + offset) - 1];
    return (previous !== undefined) && adjoins({
      flat,
      left: previous,
      right: word,
    },);
  },);
}

/**
 Whether what follows a position makes it a comparison or names its target.

 @param flat - joined text

 @param words - every word of it

 @param at - index of the position word

 @returns Whether the position compares or names rather than points

 @example
 ```ts
 comparesOrNames({ flat, words, at, },);
 ```
 */
function comparesOrNames(
  {
    flat,
    words,
    at,
  }: {
    readonly flat: string;
    readonly words: readonly Word[];
    readonly at: number;
  },
): boolean {
  /**
   The position word.
   */
  const position = words[at];
  if (position === undefined)
    return false;
  /**
   The text after it, from its first non-space character.
   */
  const after = flat.slice(position.end,)
    .trimStart();
  /**
   That character.
   */
  const opener = after.charAt(0,);
  if (NAMING_OPENERS.has(opener,) || isAsciiDigit({ character: opener, },))
    return true;
  /**
   The next word, when the text goes on with one.
   */
  const next = words[at + 1];
  return (next !== undefined)
    && (flat.slice(
      position.end,
      next.start,
    )
      .trim()
      === '')
    && COMPARED_OBJECTS.has(next.text,);
}

/**
 How often one character occurs in a text.

 @param text - text to count in

 @param character - one UTF-16 unit, which every quote mark is

 @returns Occurrences

 @example
 ```ts
 countOf({ text: 'a "b" c', character: '"', },); // 2
 ```
 */
function countOf(
  {
    text,
    character,
  }: {
    readonly text: string;
    readonly character: string;
  },
): number {
  return text.split(character,)
    .length
    - 1;
}

/**
 Whether an offset stands inside double quotes in its paragraph.

 READ FROM THE PARAGRAPH'S START, not the line's: a quotation wrapped across
 two lines opens on one and closes on the next, so counting from the line's
 start reads every phrase after it on the second line as quoted and every
 quoted phrase as bare.

 @param flat - joined text

 @param lineStart - offset its paragraph starts at

 @param offset - offset of the phrase

 @returns Whether an odd number of straight quotes, or more opening than
 closing curly quotes, stand before it in its paragraph

 @example
 ```ts
 insideQuotes({ flat: 'a "see above" rule', lineStart: 0, offset: 3, },); // true
 ```
 */
function insideQuotes(
  {
    flat,
    lineStart,
    offset,
  }: {
    readonly flat: string;
    readonly lineStart: number;
    readonly offset: number;
  },
): boolean {
  /**
   The paragraph before the phrase.
   */
  const before = flat.slice(
    lineStart,
    offset,
  );
  return ((countOf({
    text: before,
    character: '"',
  },) % 2) === 1)
    || (countOf({
      text: before,
      character: '\u{201C}',
    },) > countOf({
      text: before,
      character: '\u{201D}',
    },));
}

/**
 Offset of the paragraph a line belongs to: the line after the last blank one
 at or before it.

 @param flat - joined text

 @param lineStarts - where each line starts

 @param lineIndex - index of the line

 @returns Offset the paragraph starts at

 @example
 ```ts
 paragraphStart({ flat: 'a  b', lineStarts: [0, 1, 2,], lineIndex: 2, },); // 2
 ```
 */
function paragraphStart(
  {
    flat,
    lineStarts,
    lineIndex,
  }: {
    readonly flat: string;
    readonly lineStarts: readonly number[];
    readonly lineIndex: number;
  },
): number {
  for (let at = lineIndex; at > 0; at -= 1) {
    /**
     The line before this one, as joined.
     */
    const previous = flat.slice(
      lineStarts[at - 1] ?? 0,
      lineStarts[at] ?? 0,
    );
    if (previous.trim() === '')
      return lineStarts[at] ?? 0;
  }
  return 0;
}

/**
 How many words of a phrase begin at an index, zero when none does.

 @param flat - joined text

 @param words - every word of it

 @param at - index of the phrase's first word

 @returns Words in the phrase

 @example
 ```ts
 phraseLength({ flat, words, at, },);
 ```
 */
function phraseLength(
  {
    flat,
    words,
    at,
  }: {
    readonly flat: string;
    readonly words: readonly Word[];
    readonly at: number;
  },
): number {
  /**
   The phrase's first word.
   */
  const word = words[at];
  if (word === undefined)
    return 0;
  /**
   The plain sequence spelled here, when one is.
   */
  const spelled = SEQUENCES.find(function spelledHere(sets,): boolean {
    return spells({
      flat,
      words,
      at,
      sets,
    },);
  },);
  if (spelled !== undefined)
    return spelled.length;
  if (
    POSITIONS.has(word.text,)
    && (flat.charAt(word.end,) === ')')
      && ((flat.charAt(word.start - 1,) === '(')
        || flat.slice(
          0,
          word.start,
        )
        .endsWith('(see ',))
  )
    return 1;
  if (
    spells({
      flat,
      words,
      at,
      sets: STRUCTURE_THEN_POSITION,
    },)
    && (!comparesOrNames({
      flat,
      words,
      at: at + 1,
    },))
  )
    return STRUCTURE_THEN_POSITION.length;
  return 0;
}

/**
 Every reference by position in one file.

 @param file - file with its text

 @returns References, in order

 @example
 ```ts
 positionReferences({ file: { path: 'src/cat.ts', text: '// see above', }, },);
 ```
 */
export function positionReferences({ file, }: { readonly file: PackageText; },): readonly PositionReference[] {
  /**
   The file with its wrapped lines joined.
   */
  const {
    flat,
    lineStarts,
  } = joinedText({ text: file.text, },);
  /**
   Its words.
   */
  const words = wordsOf({ flat, },);
  /**
   References found so far.
   */
  const found: PositionReference[] = [];
  /**
   Offset the last phrase found ends at, so a phrase inside it is not found
   twice.
   */
  let coveredUntil = -1;
  for (const [at, word,] of words.entries()) {
    if (word.start < coveredUntil)
      continue;
    /**
     Words in a phrase starting here.
     */
    const length = phraseLength({
      flat,
      words,
      at,
    },);
    if (length === 0)
      continue;
    /**
     The phrase's last word.
     */
    const last = words[(at + length) - 1] ?? word;
    coveredUntil = last.end;
    /**
     Index of the line the phrase starts on.
     */
    const lineIndex = lineStarts.findLastIndex(function startsBefore(start,): boolean {
      return start <= word.start;
    },);
    if (insideQuotes({
      flat,
      lineStart: paragraphStart({
        flat,
        lineStarts,
        lineIndex,
      },),
      offset: word.start,
    },))
      continue;
    found.push({
      path: file.path,
      line: lineIndex + 1,
      phrase: flat.slice(
        word.start,
        last.end,
      ),
      window: flat.slice(
        Math.max(
          0,
          word.start - WINDOW_REACH,
        ),
        last.end + WINDOW_REACH,
      ),
    },);
  }
  return found;
}

/**
 Every reference by position across files that no exemption names, as
 `path:line phrase`.

 @param files - files to read

 @param exemptions - references left, each with its reason

 @returns Unexempted references

 @example
 ```ts
 unexempted({ files, exemptions: [], },);
 ```
 */
export function unexempted(
  {
    files,
    exemptions,
  }: {
    readonly files: readonly PackageText[];
    readonly exemptions: readonly PositionExemption[];
  },
): readonly string[] {
  return files
    .flatMap(function inFile(file,): readonly PositionReference[] {
      return positionReferences({ file, },);
    },)
    .filter(function isUnexempted(found,): boolean {
      return !exemptions.some(function names(exemption,): boolean {
        return (exemption.path === found.path)
          && found.window
          .includes(exemption.holds,);
      },);
    },)
    .map(function located(found,): string {
      return `${found.path}:${String(found.line,)} ${found.phrase}`;
    },);
}

/**
 Exemptions that no longer name any reference.

 @param files - files to read

 @param exemptions - references left, each with its reason

 @returns The stale ones' texts

 @example
 ```ts
 staleExemptions({ files, exemptions, },);
 ```
 */
export function staleExemptions(
  {
    files,
    exemptions,
  }: {
    readonly files: readonly PackageText[];
    readonly exemptions: readonly PositionExemption[];
  },
): readonly string[] {
  /**
   Every reference across the files.
   */
  const found = files.flatMap(function inFile(file,): readonly PositionReference[] {
    return positionReferences({ file, },);
  },);
  return exemptions
    .filter(function isStale(exemption,): boolean {
      return !found.some(function isNamed(reference,): boolean {
        return (reference.path === exemption.path)
          && reference.window
          .includes(exemption.holds,);
      },);
    },)
    .map(function held(exemption,): string {
      return `${exemption.path}: ${exemption.holds}`;
    },);
}

//endregion Scan
