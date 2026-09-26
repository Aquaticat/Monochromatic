import { withoutComments, } from './translate-address-drop.ts';

//region A suicide the passage names
// CLASS ONE HUNDRED FIFTY (shi_Yumiaoya36, 2026-09-26). The original's
// 于 1 月 16 日凌晨吞下大量药物自杀 is a suicide attempt she survived (six
// days in intensive care, then she woke), and the page shipped "she overdosed
// in the early hours of January 16": the attempt the original states was
// gone, and the means the house rule keeps vague stood in its place. The
// polish round chose "attempted suicide by overdosing" 2.5 to 2 with two
// ballots citing the survived-attempt rule, and the polish gate settled on
// neither, so the base shipped. The house rule says a survived attempt is
// still an attempt and the page says she attempted suicide or tried to end her
// life; a rendering with no wording for suicide at all has dropped what the
// ORIGINAL states and is refused before any judge reads it, as a dropped
// address is (class ninety-seven). THE FLOOR IS NARROW: it asks only that the
// suicide be said, never how, so a vague rendering the house rule prefers
// passes, and whether the means are too specific stays with the judges. The
// corpus census of 2026-09-26 found 44 entries whose original names a suicide;
// the archive English of 40 says it, two (shi_Yumiaoya, XIEPT2) are partial
// archives without those passages, and two render a quoted line without the
// word (自杀痛苦 as "the pain of dying", 别自杀 as "please don't follow her"),
// which the floor now refuses as a standing.

/**
 Words the original names a suicide with.
 */
const SUICIDE_WORDS: readonly string[] = [
  '自杀',
  '自尽',
  '轻生',
];

/**
 Start of every English word naming a suicide (suicide, suicides,
 suicidal).
 */
const SUICIDE_STEM = 'suicid';

/**
 Verbs that take a reflexive to name a suicide ("killed herself").
 */
const KILL_VERBS: ReadonlySet<string> = new Set([
  'kill',
  'kills',
  'killed',
  'killing',
]);

/**
 Reflexive pronouns a kill verb takes.
 */
const REFLEXIVES: ReadonlySet<string> = new Set([
  'herself',
  'himself',
  'themself',
  'themselves',
  'myself',
  'yourself',
  'yourselves',
  'ourselves',
  'oneself',
]);

/**
 Verbs that take "life" to name a suicide ("ended her life", "took her own
 life").
 */
const LIFE_VERBS: ReadonlySet<string> = new Set([
  'end',
  'ends',
  'ended',
  'ending',
  'take',
  'takes',
  'took',
  'taken',
  'taking',
]);

/**
 Nouns a life verb takes.
 */
const LIFE_NOUNS: ReadonlySet<string> = new Set([
  'life',
  'lives',
]);

/**
 Possessives that may stand between a life verb and its noun ("her life").
 */
const POSSESSIVES: ReadonlySet<string> = new Set([
  'her',
  'his',
  'their',
  'my',
  'your',
  'our',
]);

/**
 Word that may follow the possessive ("her own life").
 */
const OWN = 'own';

/**
 Whether a character is an ASCII letter.

 @param character - one UTF-16 unit

 @returns True for a to z in either case

 @example
 ```ts
 isLetter({ character: 's', },); // true
 ```
 */
function isLetter({ character, }: { readonly character: string; },): boolean {
  return ((character >= 'a') && (character <= 'z')) || ((character >= 'A') && (character <= 'Z'));
}

/**
 Every run of ASCII letters in a text, lower-cased, in order.

 @param text - rendering, comments already cut

 @returns Words in order

 @example
 ```ts
 wordsOf({ text: 'She tried to end her life.', },); // ['she', 'tried', 'to', 'end', 'her', 'life']
 ```
 */
function wordsOf({ text, }: { readonly text: string; },): readonly string[] {
  /**
   Words found so far.
   */
  const words: string[] = [];
  /**
   Letters of the word being read.
   */
  let current = '';
  for (const character of text) {
    if (isLetter({ character, },)) {
      current += character.toLowerCase();
      continue;
    }
    if (current !== '')
      words.push(current,);
    current = '';
  }
  if (current !== '')
    words.push(current,);
  return words;
}

/**
 Whether the words after a life verb name a life: an optional possessive, an
 optional "own" after it, then "life" or "lives".

 @param words - rendering's words in order

 @param after - offset of the word just past the verb

 @returns True where the phrase closes on a life noun

 @example
 ```ts
 closesOnLife({ words: ['took', 'her', 'own', 'life',], after: 1, },); // true
 ```
 */
function closesOnLife(
  {
    words,
    after,
  }: {
    readonly words: readonly string[];
    readonly after: number;
  },
): boolean {
  /**
   Offset past the possessive, where one stands.
   */
  const pastPossessive = POSSESSIVES.has(words[after] ?? '',) ? after + 1 : after;
  /**
   Offset past "own", where it follows the possessive.
   */
  const pastOwn = ((pastPossessive > after) && (words[pastPossessive] === OWN)) ? pastPossessive + 1 : pastPossessive;
  return LIFE_NOUNS.has(words[pastOwn] ?? '',);
}

/**
 Whether a run of words says a suicide: a word on the suicide stem, a kill
 verb before a reflexive, or a life verb whose phrase closes on a life.

 @param words - rendering's words in order

 @returns True where any of the three stands

 @example
 ```ts
 saysSuicide({ words: ['she', 'took', 'her', 'own', 'life',], },); // true
 ```
 */
function saysSuicide({ words, }: { readonly words: readonly string[]; },): boolean {
  return words.some(function namesIt(
    word,
    index,
  ): boolean {
    if (word.startsWith(SUICIDE_STEM,))
      return true;
    if (KILL_VERBS.has(word,))
      return REFLEXIVES.has(words[index + 1] ?? '',);
    return LIFE_VERBS.has(word,) && closesOnLife({
      words,
      after: index + 1,
    },);
  },);
}

/**
 Findings for a candidate that renders a passage naming a suicide with no
 wording for suicide at all.

 @param sourceText - original slice

 @param candidateText - candidate under validation

 @returns One finding, or none where the original names no suicide or the
 candidate says it

 @example
 ```ts
 const findings = droppedSuicideFindings({ sourceText: '她自杀了。', candidateText: 'She overdosed.', },);
 ```
 */
export function droppedSuicideFindings(
  {
    sourceText,
    candidateText,
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
  },
): readonly string[] {
  /**
   The original outside its comments.
   */
  const original = withoutComments({ text: sourceText, },);
  /**
   Words the original names the suicide with.
   */
  const named = SUICIDE_WORDS.filter(function inOriginal(word,): boolean {
    return original.includes(word,);
  },);
  if (named.length === 0)
    return [];
  if (saysSuicide({ words: wordsOf({ text: withoutComments({ text: candidateText, },), },), },))
    return [];
  return [
    `Your translation drops the suicide the ORIGINAL names: the ORIGINAL passage writes ${named.join(' and ',)}, and your translation carries no wording for suicide at all. A death by suicide is said to be a suicide, and a survived attempt is still an attempt: say that she attempted suicide or tried to end her life, keeping the means as vague as the house rule asks.`,
  ];
}

//endregion A suicide the passage names
