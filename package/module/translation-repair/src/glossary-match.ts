import { isAsciiAlphanumeric, } from './ascii-letters.ts';
import { isHanCharacter, } from './han-only-text.ts';

//region Glossary match
// CLASS ONE HUNDRED EIGHTY-SIX (the whole-package audit, 2026-09-27). Every
// glossary match read terms, renderings and refused forms as raw substrings.
// " OD" carried a leading space so it would not match inside MOD, which left
// a line-start OD and every lowercase od unseen: XingZ6010 and XingZ6014
// shipped "I hate od". Refused forms fired inside longer words ("atori" in
// "laboratories", "minor trans" in "minor transgressions") and at the head of
// an accepted rendering ("inside her head" before "mask"); tone-marked pinyin
// escaped the refusal; a rendering counted inside an unrelated word ("cured"
// in "secured") and hid a departure.
//
// ONE READING FOR EVERY GLOSSARY MATCH. A text and a form are folded alike
// (tone marks stripped, lower case, a hyphen read as a space, a run of
// whitespace as one space, and the space between a Latin run and Han dropped,
// as the corpus spaces Latin words inside Chinese), and a form whose edge is a
// Latin letter or a digit matches only where the text's neighbour at that edge
// is not one. Han edges need no boundary, since Chinese writes no spaces.

/**
 How a form may end where the text goes on: exactly, with a plural "s", with
 an inflection, with any ending English adds to a rendering, or open to any
 continuation.
 */
export type FormEnd = 'exact' | 'plural' | 'inflected' | 'rendering' | 'open';

/**
 Endings each closed `FormEnd` accepts before the word boundary; "open" has
 none because it checks no boundary at all. A glossary term takes no "d",
 since OD would then match inside "odd"; a rendering takes it, since "cure"
 is "cured" (ledger C3).
 */
const FORM_END_SUFFIXES: Record<Exclude<FormEnd, 'open'>, readonly string[]> = {
  exact: ['',],
  plural: [
    '',
    's',
  ],
  inflected: [
    '',
    's',
    'ed',
    'ing',
  ],
  rendering: [
    '',
    's',
    'es',
    'd',
    'ed',
    'ing',
  ],
};

/**
 Where one rendering stands in a folded text.
 */
export type GlossarySpan = {
  /**
   Index the rendering starts at.
   */
  readonly start: number;

  /**
   Index just past the rendering as written, before any ending.
   */
  readonly end: number;
};

/**
 First code point of the combining diacritical marks block, which carries
 the tone marks NFD splits off pinyin.
 */
const COMBINING_FIRST = '\u{0300}';

/**
 Last code point of the combining diacritical marks block.
 */
const COMBINING_LAST = '\u{036F}';

/**
 First code point of the Latin-1 letters and the Latin Extended blocks.
 */
const LATIN_EXTENDED_FIRST = '\u{00C0}';

/**
 Last code point of Latin Extended-B.
 */
const LATIN_EXTENDED_LAST = '\u{024F}';

/**
 Characters a hyphen may be written as, each read as a space.
 */
const HYPHENS: ReadonlySet<string> = new Set([
  '-',
  '\u{2010}',
  '\u{2011}',
],);

/**
 Signs inside the Latin-1 range that are not letters.
 */
const LATIN_SIGNS: ReadonlySet<string> = new Set([
  '\u{00D7}',
  '\u{00F7}',
],);

/**
 Whether a character belongs to a Latin word, so a form edge may not stand
 beside it: an ASCII letter or digit, or a letter of the Latin-1 and Latin
 Extended blocks.

 @param character - one character of a folded text, empty past either end

 @returns True for a letter or digit a word may continue with

 @example
 ```ts
 isGlossaryWordCharacter({ character: 'o', },); // true
 isGlossaryWordCharacter({ character: '，', },); // false
 ```
 */
export function isGlossaryWordCharacter({ character, }: { readonly character: string; },): boolean {
  if (character === '')
    return false;
  if (isAsciiAlphanumeric({ character, },))
    return true;
  return (character >= LATIN_EXTENDED_FIRST)
    && (character <= LATIN_EXTENDED_LAST)
    && (!LATIN_SIGNS.has(character,));
}

/**
 Whether a character is a combining mark NFD split off a letter.

 @param character - one code point

 @returns True inside the combining diacritical marks block

 @example
 ```ts
 isCombiningMark({ character: '\u{0300}', },); // true
 ```
 */
function isCombiningMark({ character, }: { readonly character: string; },): boolean {
  return (character >= COMBINING_FIRST) && (character <= COMBINING_LAST);
}

/**
 Whether a character separates words the way a space does: whitespace of any
 kind, or a hyphen.

 @param character - one code point

 @returns True for whitespace and hyphens

 @example
 ```ts
 isSpaceLike({ character: '-', },); // true
 ```
 */
function isSpaceLike({ character, }: { readonly character: string; },): boolean {
  return HYPHENS.has(character,) || (character.trim() === '');
}

/**
 Folds a text or a form for glossary matching: tone marks stripped, lower
 case, hyphens and whitespace runs as one space, and the space between a Han
 character and anything else dropped.

 THREE LINEAR PASSES over the characters, since a text is unbounded: mark
 and case, then runs of spaces collapsed, then each remaining space kept
 only between two neighbours alike in being Han or not.

 @param text - original, candidate, term, rendering or refused form

 @returns Folded text, in which match positions are read

 @example
 ```ts
 foldForGlossary({ text: '写 MOD，Yào Niáng', },); // => '写mod，yao niang'
 ```
 */
export function foldForGlossary({ text, }: { readonly text: string; },): string {
  /**
   Characters with tone marks stripped, lower-cased, every separator a space.
   Code points on purpose, not graphemes: the point of NFD here is to part a
   tone mark from its letter so the mark can be dropped.
   */
  const lowered = Array.from(text.normalize('NFD',),)
    .filter(function unmarked(character,): boolean {
      return !isCombiningMark({ character, },);
    },)
    .map(function asMatched(character,): string {
      return isSpaceLike({ character, },) ? ' ' : character.toLowerCase();
    },);
  /**
   Characters with each run of spaces cut to its first space.
   */
  const collapsed = lowered.filter(function opensRun(
    character,
    at,
  ): boolean {
    return (character !== ' ') || (lowered[at - 1] !== ' ');
  },);
  return collapsed
    .filter(function kept(
      character,
      at,
    ): boolean {
      if (character !== ' ')
        return true;
      /**
       Character before the space, undefined at the start.
       */
      const previous = collapsed[at - 1];
      /**
       Character after the space, undefined at the end.
       */
      const next = collapsed[at + 1];
      return (previous !== undefined)
        && (next !== undefined)
        && (isHanCharacter({ character: previous, },) === isHanCharacter({ character: next, },));
    },)
    .join('',);
}

/**
 Every index at which a needle starts in a text, overlapping starts included.

 @param text - folded text

 @param needle - folded form looked for

 @returns Start indices in ascending order, empty where the needle is absent

 @example
 ```ts
 occurrenceStarts({ text: 'head and head', needle: 'head', },);
 // => [0, 9]
 ```
 */
export function occurrenceStarts(
  {
    text,
    needle,
  }: {
    readonly text: string;
    readonly needle: string;
  },
): readonly number[] {
  if (needle === '')
    return [];
  /**
   Starts found so far; a linear cursor scan, since the text is unbounded.
   */
  const starts: number[] = [];
  /**
   Index the next search starts from.
   */
  let cursor = text.indexOf(needle,);
  while (cursor !== (-1)) {
    starts.push(cursor,);
    cursor = text.indexOf(
      needle,
      cursor + 1,
    );
  }
  return starts;
}

/**
 Every start of a folded form in a folded text where its Latin edges stand
 at word boundaries.

 @param folded - folded text

 @param form - folded form

 @param end - how the form may end where the text goes on

 @returns Start indices in ascending order

 @example
 ```ts
 formStarts({ folded: 'an odd od', form: 'od', end: 'inflected', },); // => [7]
 ```
 */
export function formStarts(
  {
    folded,
    form,
    end,
  }: {
    readonly folded: string;
    readonly form: string;
    readonly end: FormEnd;
  },
): readonly number[] {
  /**
   Whether the form opens on a Latin letter or digit, so its start needs a
   boundary.
   */
  const opensWord = isGlossaryWordCharacter({ character: form.charAt(0,), },);
  /**
   Whether the form closes on a Latin letter or digit, so its end needs a
   boundary.
   */
  const closesWord = isGlossaryWordCharacter({ character: form.at(-1,) ?? '', },);
  return occurrenceStarts({
    text: folded,
    needle: form,
  },)
    .filter(function standsApart(start,): boolean {
      if (opensWord && isGlossaryWordCharacter({ character: folded.charAt(start - 1,), },))
        return false;
      if ((!closesWord) || (end === 'open'))
        return true;
      /**
       Index just past the form.
       */
      const after = start + form.length;
      /**
       Endings the form may take before its boundary.
       */
      const suffixes = FORM_END_SUFFIXES[end];
      return suffixes.some(function endsThere(suffix,): boolean {
        return folded.startsWith(
          suffix,
          after,
        )
          && (!isGlossaryWordCharacter({ character: folded.charAt(after + suffix.length,), },));
      },);
    },);
}

/**
 Stems English writes when it inflects a rendering whose last letter changes:
 a final e drops before "ing" (curing, soothing), and a final y turns to "ie"
 before "s" or "d" (communities, studied).

 @param form - folded rendering

 @returns Inflected spellings the endings in `FORM_END_SUFFIXES` cannot reach,
 empty for a rendering whose last letter stays

 @example
 ```ts
 changedStems({ form: 'cure', },); // => ['curing']
 changedStems({ form: 'trans community', },); // => ['trans communities', 'trans communitied']
 ```
 */
function changedStems({ form, }: { readonly form: string; },): readonly string[] {
  /**
   Rendering without its last letter.
   */
  const stem = form.slice(
    0,
    -1,
  );
  if (form.endsWith('e',))
    return [`${stem}ing`,];
  if (form.endsWith('y',)) {
    return [
      `${stem}ies`,
      `${stem}ied`,
    ];
  }
  return [];
}

/**
 Every span at which an accepted rendering stands in a folded text,
 inflected as English inflects it (ledger C3: "to cure", "trans
 communities" and "a healing cat" carry their words), opening and closing at
 word boundaries (ledger C4 on the opening side, and "Atri" never inside
 "atrium" on the closing side).

 @param folded - folded text

 @param rendering - rendering as the glossary writes it

 @returns Spans in the order their spellings were searched

 @example
 ```ts
 renderingSpans({ folded: 'hard to cure', rendering: 'cure', },); // => [{ start: 8, end: 12 }]
 ```
 */
export function renderingSpans(
  {
    folded,
    rendering,
  }: {
    readonly folded: string;
    readonly rendering: string;
  },
): readonly GlossarySpan[] {
  /**
   Rendering folded as the text is.
   */
  const form = foldForGlossary({ text: rendering, },);
  return [
    form,
    ...changedStems({ form, },),
  ].flatMap(function spansOf(spelling,): readonly GlossarySpan[] {
    return formStarts({
      folded,
      form: spelling,
      end: 'rendering',
    },)
      .map(function toSpan(start,): GlossarySpan {
        return {
          start,
          end: start + spelling.length,
        };
      },);
  },);
}

/**
 Whether a text carries a form at word boundaries, both folded here.

 @param text - text to read, comments already cut where they should be

 @param form - term, rendering or refused form as the glossary writes it

 @param end - how the form may end where the text goes on

 @returns True where one bounded occurrence exists

 @example
 ```ts
 textCarriesForm({ text: 'I hate od.', form: 'OD', end: 'inflected', },); // true
 ```
 */
export function textCarriesForm(
  {
    text,
    form,
    end,
  }: {
    readonly text: string;
    readonly form: string;
    readonly end: FormEnd;
  },
): boolean {
  /**
   Bounded starts of the form in the text.
   */
  const starts = formStarts({
    folded: foldForGlossary({ text, },),
    form: foldForGlossary({ text: form, },),
    end,
  },);
  return starts.length > 0;
}

//endregion Glossary match
