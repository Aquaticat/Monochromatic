import type { ChunkPair, } from '../chunk-document.ts';
import type { SliceReplacement, } from '../splice-slices.ts';
import { slicesInOrder, } from './assembly-page-text.ts';

//region Archive casing restore
// THE ONE HUNDRED AND TWENTY-FIRST CLASS (mikaela17, 2026-09-25). The archive
// writes a romanised station name in capitals, "XIAWAFANG Station", in the
// body and again in the footnote that explains it, and its translator's note
// says why: the city writes its station names that way. A judge chose a
// candidate writing it "Xiawafang" as "standard capitalization ... instead of
// all-caps", so the page carried the name one way in the body and the
// archive's way in the footnote, which no slice sheet saw together. A word the
// archive writes in capitals more than once and never any other way is the
// page's own form; a title-case spelling of it in a shipped slice is restored
// here, where the page is in view.

/**
 Fewest letters a word needs before its capitals read as a name, not an
 emphasis or an acronym the page may also spell out.
 */
const MIN_LETTERS = 4;

/**
 Fewest times the archive writes the word in capitals, so one shouted word
 is not read as the page's spelling.
 */
const MIN_USES = 2;

/**
 Characters that put a word inside a link destination, a path or an
 attribute rather than in prose.
 */
const NON_PROSE_BEFORE: ReadonlySet<string> = new Set([
  '/',
  '.',
  '#',
  '=',
  '_',
  '-',
],);

/**
 One run of Latin letters and where it starts.
 */
type LatinWord = {
  readonly word: string;
  readonly start: number;
};

/**
 Whether one character is a Latin letter a to z in either case.

 @param character - one UTF-16 unit

 @returns Whether it is a Latin letter

 @example
 ```ts
 isLatinLetter({ character: 'M', },); // true
 ```
 */
function isLatinLetter(
  { character, }: { readonly character: string; },
): boolean {
  return ((character >= 'a') && (character <= 'z')) || ((character >= 'A') && (character <= 'Z'));
}

/**
 Every run of Latin letters in a text, by one index scan.

 @param text - text under scan

 @returns Runs in order

 @example
 ```ts
 latinWords({ text: 'MAOWU Station', },); // [{ word: 'MAOWU', start: 0 }, { word: 'Station', start: 6 }]
 ```
 */
function latinWords(
  { text, }: { readonly text: string; },
): readonly LatinWord[] {
  /**
   Runs read so far.
   */
  const words: LatinWord[] = [];
  for (let at = 0; at < text.length;) {
    if (!isLatinLetter({ character: text.charAt(at,), },)) {
      at += 1;
      continue;
    }
    /**
     Where this run starts.
     */
    const start = at;
    while ((at < text.length) && isLatinLetter({ character: text.charAt(at,), },))
      at += 1;
    words.push({
      word: text.slice(
        start,
        at,
      ),
      start,
    },);
  }
  return words;
}

/**
 Words the archive writes in capitals at least twice and in no other casing
 anywhere.

 @param archiveText - every archive slice joined

 @returns Capital forms, each a word of at least four letters

 @example
 ```ts
 capitalForms({ archiveText: 'MAOWU here, MAOWU there.', },); // Set { 'MAOWU' }
 ```
 */
function capitalForms(
  { archiveText, }: { readonly archiveText: string; },
): ReadonlySet<string> {
  /**
   Every spelling the archive uses for a word, keyed by the word in capitals,
   with how often each spelling occurs.
   */
  const spellings = latinWords({ text: archiveText, },)
    .reduce(
      function tally(
        byWord,
        { word, },
      ): Map<string, Map<string, number>> {
        /**
         The word in capitals.
         */
        const upper = word.toUpperCase();
        /**
         Spellings seen for it so far.
         */
        const seen = byWord.get(upper,) ?? new Map<string, number>();
        seen.set(
          word,
          (seen.get(word,) ?? 0) + 1,
        );
        byWord.set(
          upper,
          seen,
        );
        return byWord;
      },
      new Map<string, Map<string, number>>(),
    );
  return new Set([...spellings,]
    .filter(function onlyCapitals([
      upper,
      seen,
    ],): boolean {
      return (upper.length >= MIN_LETTERS)
        && (seen.size === 1)
        && ((seen.get(upper,) ?? 0) >= MIN_USES);
    },)
    .map(function toUpper([upper,],): string {
      return upper;
    },),);
}

/**
 Whether a word is written title case: one capital, then lower case only.

 @param word - run of Latin letters

 @returns Whether it is title case

 @example
 ```ts
 isTitleCase({ word: 'Maowu', },); // true
 ```
 */
function isTitleCase(
  { word, }: { readonly word: string; },
): boolean {
  /**
   First letter.
   */
  const head = word.charAt(0,);
  /**
   The letters after it.
   */
  const tail = word.slice(1,);
  /**
   Whether the first letter is a capital.
   */
  const capitalHead = head === head.toUpperCase();
  /**
   Whether every later letter is lower case.
   */
  const lowerTail = (tail.length > 0) && (tail === tail.toLowerCase());
  return capitalHead && lowerTail;
}

/**
 Rewrites every title-case spelling of an archive capital form in one text.

 @param text - shipped text

 @param forms - the archive's capital forms

 @returns Rewritten text and each spelling it changed

 @example
 ```ts
 recase({ text: 'at Maowu', forms: new Set(['MAOWU']), },);
 ```
 */
function recase(
  {
    text,
    forms,
  }: {
    readonly text: string;
    readonly forms: ReadonlySet<string>;
  },
): {
  readonly text: string;
  readonly changed: readonly string[];
} {
  /**
   Words to rewrite, in order.
   */
  const targets = latinWords({ text, },)
    .filter(function restorable({
      word,
      start,
    },): boolean {
      return forms.has(word.toUpperCase(),)
        && isTitleCase({ word, },)
        && (!NON_PROSE_BEFORE.has(text.charAt(start - 1,),));
    },);
  /**
   Text rebuilt around the rewritten words.
   */
  const pieces = targets.reduce(
    function splice(
      built,
      {
        word,
        start,
      },
    ): {
      readonly parts: readonly string[];
      readonly from: number;
    } {
      return {
        parts: [
          ...built.parts,
          text.slice(
            built.from,
            start,
          ),
          word.toUpperCase(),
        ],
        from: start + word.length,
      };
    },
    {
      parts: [] as readonly string[],
      from: 0,
    },
  );
  return {
    text: [
      ...pieces.parts,
      text.slice(pieces.from,),
    ].join('',),
    changed: targets.map(function spelling({ word, },): string {
      return word;
    },),
  };
}

/**
 Restores the archive's all-capitals form of a word wherever a shipped slice
 writes it title case.

 @param slices - prepared pairs, whose archive text carries the forms

 @param replacements - what the page would write per slice

 @returns Replacements with the forms restored, the rewritten rows alone,
 and one finding per distinct spelling changed in a slice

 @example
 ```ts
 const restored = restoreArchiveCasing({ slices, replacements, },);
 ```
 */
export function restoreArchiveCasing(
  {
    slices,
    replacements,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly replacements: readonly SliceReplacement[];
  },
): {
  readonly replacements: readonly SliceReplacement[];
  readonly restored: readonly SliceReplacement[];
  readonly findings: readonly string[];
} {
  /**
   The archive's capital forms across the whole page.
   */
  const forms = capitalForms({
    archiveText: slicesInOrder({ slices, },)
      .map(function archiveOf(slice,): string {
        return slice.target
          .text;
      },)
      .join('\n',),
  },);
  /**
   Findings, one per distinct spelling changed in a slice.
   */
  const findings: string[] = [];
  /**
   Every replacement, the rewritten ones swapped in.
   */
  const rewritten = replacements.map(function restore(row,): SliceReplacement {
    if (forms.size === 0)
      return row;
    /**
     The row's text with the forms restored.
     */
    const recased = recase({
      text: row.replacementText,
      forms,
    },);
    [...new Set(recased.changed,),].forEach(function report(spelling,): void {
      findings.push(
        `archive-casing-restored (slice ${String(row.sliceIndex,)}: "${spelling}" to "${spelling.toUpperCase()}")`,
      );
    },);
    return {
      sliceIndex: row.sliceIndex,
      replacementText: recased.text,
    };
  },);
  /**
   Rows this pass changed.
   */
  const restored = rewritten.filter(function changed(
    row,
    index,
  ): boolean {
    /**
     Row as it came in.
     */
    const before = replacements[index];
    return row.replacementText !== before?.replacementText;
  },);
  return {
    replacements: rewritten,
    restored,
    findings,
  };
}
//endregion Archive casing restore
