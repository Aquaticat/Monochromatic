import {
  type ProtectedRange,
  protectedRanges,
} from './corpus-run/prose-ranges.ts';
import { isIdeograph, } from './preservation-tokens.ts';
import { withoutComments, } from './translate-address-drop.ts';
import { withoutGlossedTitles, } from './translate-han-title.ts';
import { untranslatedFindings, } from './translate-untranslated.ts';

//region Han residue floor
// LEDGER F-3 AND A2 (shihai4h1 and shihai4h2, 2026-09-26). Both runs shipped
// "Wrong,\n小柿子." where the archive has "Wrong.": a handle left in Han in
// the middle of English prose, which the house rule forbids ("never left in
// Han") and which no floor read. The untranslated floor refuses only a
// candidate that IS the original; a Han word inside English went through.
//
// WHAT IS REFUSED: a run of Han (with any kana and 々 inside it) standing in
// the candidate's prose. Markup is not prose: a tag and its attributes, a JSX
// expression, a link destination, a URL, code, a comment and front matter
// are read by `protectedRanges`, the scanner the page-wide rewrites share.
//
// WHAT IS EXCUSED, each shape measured over 1,264 archive slices and 3,975
// would-ship slices (`~/temp/agent/audit-floor-replay/han-residue-*.mjs`):
// - a run inside parentheses, the gloss the house rule allows after the
//   English (公摊面积 after "shared floor area", 晚安 in a pun's footnote);
// - a title the title floor accepts as kept, cut before the scan exactly as
//   the glossary floors cut it, so the two floors never disagree on one;
// - a line carrying kana and no Latin letter, a Japanese quotation kept as
//   the archives keep their lyrics beside the English;
// - a run the ORIGINAL and the PAGE AS IT STANDS both carry, which the
//   page's translator kept on purpose (the 澪 a name is written with, a
//   hidden line inside an element). THE FLOOR IS RELATIVE TO THE PAGE: it
//   refuses Han a candidate adds, not Han the archive already carries from
//   the original.
//
// Measured before commit: four archive slices refused, all one entry's
// quotations the archive left untranslated and respelt in traditional
// characters where the original writes simplified (一抹陽光 against
// 一抹阳光), so on those slices the incumbent cannot stand in and a lane must
// translate them. Chosen, not overlooked.

/**
 Opening parentheses a gloss sits inside, half and full width.
 */
const GLOSS_OPENERS: ReadonlySet<string> = new Set([
  '(',
  '（',
],);

/**
 Closing parentheses matching those.
 */
const GLOSS_CLOSERS: ReadonlySet<string> = new Set([
  ')',
  '）',
],);

/**
 First code unit of the hiragana and katakana blocks.
 */
const KANA_FIRST = '぀';

/**
 Last code unit of those blocks.
 */
const KANA_LAST = 'ヿ';

/**
 Iteration mark, written inside Han words (人々) and outside every block.
 */
const ITERATION_MARK = '々';

/**
 One run of Han in prose, with what might excuse it.
 */
export type HanRun = {
  /**
   Characters of the run.
   */
  readonly run: string;

  /**
   Whether a parenthesis opened on its line encloses it.
   */
  readonly glossed: boolean;

  /**
   Whether its line carries kana and no Latin letter in prose.
   */
  readonly kanaLine: boolean;
};

/**
 Whether a character is hiragana or katakana.

 @param character - one code unit

 @returns Whether it falls in the kana blocks

 @example
 ```ts
 isKana({ character: 'の', },); // true
 ```
 */
function isKana({ character, }: { readonly character: string; },): boolean {
  return (character >= KANA_FIRST) && (character <= KANA_LAST);
}

/**
 Whether a character belongs inside a run: Han, kana or the iteration mark.

 @param character - one code unit

 @returns Whether a run may carry it

 @example
 ```ts
 isRunCharacter({ character: '々', },); // true
 ```
 */
function isRunCharacter({ character, }: { readonly character: string; },): boolean {
  return isIdeograph(character,)
    || isKana({ character, },)
    || (character === ITERATION_MARK);
}

/**
 Whether a character is an ASCII letter.

 @param character - one code unit

 @returns Whether it is A to Z in either case

 @example
 ```ts
 isLatinLetter({ character: 'q', },); // true
 ```
 */
function isLatinLetter({ character, }: { readonly character: string; },): boolean {
  /**
   Character folded to lower case.
   */
  const lower = character.toLowerCase();
  return (lower >= 'a') && (lower <= 'z');
}

/**
 One flag per code unit of a text, true where the unit is prose.

 @param text - text to read

 @param ranges - protected ranges of that text

 @returns Flags indexed as `charAt` indexes

 @example
 ```ts
 proseFlags({ text: 'a `b`', ranges: [{ start: 2, end: 5, },], },); // [true, true, false, false, false]
 ```
 */
function proseFlags(
  {
    text,
    ranges,
  }: {
    readonly text: string;
    readonly ranges: readonly ProtectedRange[];
  },
): readonly boolean[] {
  /**
   Flags, all prose until a range says otherwise.
   */
  const flags = Array.from(
    { length: text.length, },
    function prose(): boolean {
      return true;
    },
  );
  // ONE PASS PER RANGE over its own span; the ranges do not overlap, so the
  // passes together touch each unit at most once.
  for (const range of ranges) {
    for (let at = range.start; at < range.end; at += 1)
      flags[at] = false;
  }
  return flags;
}

/**
 Prose code units of one line, the only ones a line's kind is read from.

 BY UTF-16 UNIT, NOT CODE POINT: the flags index the text as `charAt` does,
 and spreading the string would shift every flag after an astral character.

 @param line - one line of the text

 @param flags - prose flags of that line's units

 @returns Units in prose, in order

 @example
 ```ts
 proseUnits({ line: 'a `b`', flags: [true, true, false, false, false,], },); // ['a', ' ']
 ```
 */
function proseUnits(
  {
    line,
    flags,
  }: {
    readonly line: string;
    readonly flags: readonly boolean[];
  },
): readonly string[] {
  /**
   Units kept so far.
   */
  const units: string[] = [];
  for (let at = 0; at < line.length; at += 1) {
    if (flags[at] === true)
      units.push(line.charAt(at,),);
  }
  return units;
}

/**
 Whether a line is a kana line: kana in its prose and no Latin letter.

 @param units - prose units of the line

 @returns Whether the line reads as a Japanese quotation

 @example
 ```ts
 isKanaLine({ units: ['君', 'の', '歌',], },); // true
 ```
 */
function isKanaLine({ units, }: { readonly units: readonly string[]; },): boolean {
  /**
   Whether any unit is kana.
   */
  const carriesKana = units.some(function kana(character,): boolean {
    return isKana({ character, },);
  },);
  /**
   Whether any unit is a Latin letter.
   */
  const carriesLatin = units.some(function latin(character,): boolean {
    return isLatinLetter({ character, },);
  },);
  return carriesKana && (!carriesLatin);
}

/**
 Whether a run carries at least one ideograph, which makes it Han rather
 than kana alone.

 @param run - characters of a run

 @returns Whether some unit is an ideograph

 @example
 ```ts
 carriesIdeograph({ run: 'の', },); // false
 ```
 */
function carriesIdeograph({ run, }: { readonly run: string; },): boolean {
  for (let at = 0; at < run.length; at += 1) {
    if (isIdeograph(run.charAt(at,),))
      return true;
  }
  return false;
}

/**
 Offset just past the run that starts at a unit.

 @param line - one line of the text

 @param flags - prose flags of that line's units

 @param start - first unit of the run

 @returns Offset of the first unit that is not a prose run character

 @example
 ```ts
 runEnd({ line: '猫猫 cat', flags: [true, true, true, true, true, true,], start: 0, },); // 2
 ```
 */
function runEnd(
  {
    line,
    flags,
    start,
  }: {
    readonly line: string;
    readonly flags: readonly boolean[];
    readonly start: number;
  },
): number {
  for (let at = start; at < line.length; at += 1) {
    /**
     Whether this unit continues the run.
     */
    const continues = (flags[at] === true)
      && isRunCharacter({ character: line.charAt(at,), },);
    if (!continues)
      return at;
  }
  return line.length;
}

/**
 Han runs of one line, read left to right with the parenthesis depth.

 @param line - one line of the text

 @param flags - prose flags of that line's units

 @returns Runs on the line, in order

 @example
 ```ts
 lineRuns({ line: 'Cat (猫)', flags: [true, true, true, true, true, true, true,], },);
 ```
 */
function lineRuns(
  {
    line,
    flags,
  }: {
    readonly line: string;
    readonly flags: readonly boolean[];
  },
): readonly HanRun[] {
  /**
   Whether the line is a kana line with no Latin letter.
   */
  const kanaLine = isKanaLine({
    units: proseUnits({
      line,
      flags,
    },),
  },);
  /**
   Runs found so far.
   */
  const runs: HanRun[] = [];
  /**
   Parentheses open at the cursor.
   */
  let depth = 0;
  // ONE LINEAR PASS: the cursor only advances, a run's end becoming the next
  // start.
  for (let at = 0; at < line.length;) {
    /**
     Character under the cursor.
     */
    const character = line.charAt(at,);
    if (flags[at] !== true) {
      at += 1;
      continue;
    }
    if (GLOSS_OPENERS.has(character,))
      depth += 1;
    if (GLOSS_CLOSERS.has(character,) && (depth > 0))
      depth -= 1;
    if (!isRunCharacter({ character, },)) {
      at += 1;
      continue;
    }
    /**
     Offset just past the run.
     */
    const end = runEnd({
      line,
      flags,
      start: at,
    },);
    /**
     Characters of the run.
     */
    const run = line.slice(
      at,
      end,
    );
    if (carriesIdeograph({ run, },)) {
      runs.push({
        run,
        glossed: depth > 0,
        kanaLine,
      },);
    }
    at = end;
  }
  return runs;
}

/**
 Offsets each line of a text starts at.

 @param text - text to read

 @returns Start offsets, the first always zero

 @example
 ```ts
 lineStarts({ text: 'a\nbc', },); // [0, 2]
 ```
 */
function lineStarts({ text, }: { readonly text: string; },): readonly number[] {
  /**
   Starts found so far.
   */
  const starts = [0,];
  for (
    let at = text.indexOf('\n',);
    at !== (-1);
    at = text.indexOf(
      '\n',
      at + 1,
    )
  )
    starts.push(at + 1,);
  return starts;
}

/**
 Han runs a text carries in prose.

 @param text - text to read

 @returns Runs in document order

 @example
 ```ts
 hanRuns({ text: 'Wrong,\n小柿子.', },); // one run, 小柿子
 ```
 */
export function hanRuns({ text, }: { readonly text: string; },): readonly HanRun[] {
  /**
   Prose flags of the whole text.
   */
  const flags = proseFlags({
    text,
    ranges: protectedRanges({ text, },),
  },);
  /**
   Where each line starts.
   */
  const starts = lineStarts({ text, },);
  return starts.flatMap(function runsOf(
    start,
    index,
  ): readonly HanRun[] {
    /**
     Offset just past the line, before its newline.
     */
    const end = (starts[index + 1] ?? (text.length + 1)) - 1;
    return lineRuns({
      line: text.slice(
        start,
        end,
      ),
      flags: flags.slice(
        start,
        end,
      ),
    },);
  },);
}

/**
 Findings against a candidate that leaves Han standing in its English prose.

 @param sourceText - original passage

 @param candidateText - rendering under the floor

 @param pageText - text the rendering would replace, empty where the page
 has none

 @returns One finding naming every refused run, none where the candidate
 passes

 @example
 ```ts
 hanResidueFindings({ sourceText: '错了，小柿子。', candidateText: 'Wrong,\n小柿子.', pageText: 'Wrong.', },);
 ```
 */
export function hanResidueFindings(
  {
    sourceText,
    candidateText,
    pageText = '',
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
    readonly pageText?: string;
  },
): readonly string[] {
  /**
   Runs of the original, as written.
   */
  const sourceRuns = new Set(hanRuns({ text: sourceText, },)
    .map(function runOf(found,): string {
      return found.run;
    },),);
  /**
   Runs the page keeps from the original, which the candidate may keep too.
   */
  const kept = new Set(hanRuns({ text: pageText, },)
    .map(function runOf(found,): string {
      return found.run;
    },)
    .filter(function fromOriginal(run,): boolean {
      return sourceRuns.has(run,);
    },),);
  /**
   Candidate as read: comments cut, and titles the title floor accepts cut.
   */
  const read = withoutGlossedTitles({
    sourceText,
    candidateText: withoutComments({ text: candidateText, },),
  },);
  /**
   Distinct runs nothing excuses, in order.
   */
  const refused = [
    ...new Set(hanRuns({ text: read, },)
      .filter(function unexcused(found,): boolean {
        /**
         Whether a gloss, a kana line or the page's own keeping excuses it.
         */
        const excused = found.glossed
          || found.kanaLine
          || kept.has(found.run,);
        return !excused;
      },)
      .map(function runOf(found,): string {
        return found.run;
      },),),
  ];
  if (refused.length === 0)
    return [];
  /**
   Refused runs, quoted for the finding.
   */
  const named = refused
    .map(function quoted(run,): string {
      return `"${run}"`;
    },)
    .join(', ',);
  return [
    `Your translation leaves Han standing in its English text: ${named}. Render each in English: a person's `
      + 'handle is romanized as it is read, with its literal meaning in parentheses the first time it appears; '
      + 'a term or a title is translated; a line the ORIGINAL gives both in Chinese and in English is carried '
      + 'once, in English. The Han may follow the English in parentheses and never stands in its place.',
  ];
}

/**
 Findings for a candidate left untranslated, whole or in part: the
 untranslated floor's when the candidate is the original, else this floor's,
 so a copied original is named once rather than once per run.

 @param sourceText - original passage

 @param candidateText - rendering under the floors

 @param pageText - text the rendering would replace, empty where the page
 has none

 @returns Findings, empty where the candidate passes both

 @example
 ```ts
 untranslatedOrResidueFindings({ sourceText: '猫睡了。', candidateText: '猫睡了。', pageText: '', },);
 ```
 */
export function untranslatedOrResidueFindings(
  {
    sourceText,
    candidateText,
    pageText = '',
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
    readonly pageText?: string;
  },
): readonly string[] {
  /**
   Whole-candidate finding, which reads the copy as one fault.
   */
  const untranslated = untranslatedFindings({
    sourceText,
    candidateText,
  },);
  if (untranslated.length > 0)
    return untranslated;
  return hanResidueFindings({
    sourceText,
    candidateText,
    pageText,
  },);
}

//endregion Han residue floor
