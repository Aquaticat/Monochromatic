import {
  inProse,
  type ProtectedRange,
} from './prose-ranges.ts';

//region Canadian spelling
// CLASS ONE HUNDRED THIRTY-FOUR (hulicaijia19, 2026-09-25): the house policy
// says English already on the page in another variety's spelling is respelled
// the Canadian way, yet "compound liquorice tablets" stood on a slice no lane
// rewrote. A closed list of words whose Canadian spelling differs, each with
// no second sense a respelling could damage, is respelled in lower case only:
// a capitalised word mid-sentence is a name or a title ("Lincoln Center",
// "The Color Purple"), and names, titles and quoted English keep their own
// spelling. Words with a second sense (meter, check, tire, mum) are left to
// the judges.

/**
 American or British spelling to the Canadian one, lower case.
 */
const CANADIAN_SPELLINGS: ReadonlyMap<string, string> = new Map([
  [
    'color',
    'colour',
  ],
  [
    'colors',
    'colours',
  ],
  [
    'colored',
    'coloured',
  ],
  [
    'colorful',
    'colourful',
  ],
  [
    'behavior',
    'behaviour',
  ],
  [
    'behaviors',
    'behaviours',
  ],
  [
    'behavioral',
    'behavioural',
  ],
  [
    'favorite',
    'favourite',
  ],
  [
    'favorites',
    'favourites',
  ],
  [
    'honor',
    'honour',
  ],
  [
    'honored',
    'honoured',
  ],
  [
    'neighbor',
    'neighbour',
  ],
  [
    'neighbors',
    'neighbours',
  ],
  [
    'neighborhood',
    'neighbourhood',
  ],
  [
    'humor',
    'humour',
  ],
  [
    'flavor',
    'flavour',
  ],
  [
    'flavors',
    'flavours',
  ],
  [
    'rumor',
    'rumour',
  ],
  [
    'rumors',
    'rumours',
  ],
  [
    'center',
    'centre',
  ],
  [
    'centers',
    'centres',
  ],
  [
    'centered',
    'centred',
  ],
  [
    'theater',
    'theatre',
  ],
  [
    'theaters',
    'theatres',
  ],
  [
    'liquorice',
    'licorice',
  ],
  // CLASS ONE HUNDRED SIXTY-NINE (TianqiChen6667, 2026-09-26): "she used this
  // id on basically all of her social media platforms" for 这个id. The pinned
  // archive writes ID on three pages and lowercase id on none, and the
  // psychoanalytic id appears nowhere in the corpus, so the word has no second
  // sense a respelling could damage here.
  [
    'id',
    'ID',
  ],
  [
    'gray',
    'grey',
  ],
  [
    'traveled',
    'travelled',
  ],
  [
    'traveling',
    'travelling',
  ],
  [
    'traveler',
    'traveller',
  ],
  [
    'canceled',
    'cancelled',
  ],
  [
    'catalog',
    'catalogue',
  ],
  [
    'defense',
    'defence',
  ],
  [
    'offense',
    'offence',
  ],
  [
    'aluminium',
    'aluminum',
  ],
  [
    'maths',
    'math',
  ],
  [
    'realise',
    'realize',
  ],
  [
    'realised',
    'realized',
  ],
  [
    'realising',
    'realizing',
  ],
  [
    'recognise',
    'recognize',
  ],
  [
    'recognised',
    'recognized',
  ],
  [
    'organise',
    'organize',
  ],
  [
    'organised',
    'organized',
  ],
  [
    'apologise',
    'apologize',
  ],
  [
    'apologised',
    'apologized',
  ],
  [
    'criticise',
    'criticize',
  ],
  [
    'emphasise',
    'emphasize',
  ],
  [
    'memorise',
    'memorize',
  ],
  [
    'sympathise',
    'sympathize',
  ],
  [
    'analyse',
    'analyze',
  ],
  [
    'analysed',
    'analyzed',
  ],
  [
    'paralysed',
    'paralyzed',
  ],
],);

/**
 Characters that put a word inside a path, an identifier or an address
 rather than in prose.
 */
const NON_PROSE_NEIGHBOURS: ReadonlySet<string> = new Set([
  '/',
  '#',
  '=',
  '_',
  '@',
  '\\',
],);

/**
 One word respelled, with the span it covered.
 */
export type SpellingRewrite = {
  readonly start: number;
  readonly end: number;
  readonly from: string;
  readonly to: string;
};

/**
 Whether one character is a Latin letter a to z in either case.

 @param character - one UTF-16 unit

 @returns Whether it is a Latin letter

 @example
 ```ts
 isLatinLetter({ character: 'c', },); // true
 ```
 */
function isLatinLetter(
  { character, }: { readonly character: string; },
): boolean {
  return ((character >= 'a') && (character <= 'z')) || ((character >= 'A') && (character <= 'Z'));
}

/**
 Whether the character at one offset puts the word beside it outside prose: a
 listed neighbour, or a dot with a letter or digit on its far side (a file
 name or a domain), where a sentence's closing dot is prose.

 @param text - text under scan

 @param at - offset of the neighbour

 @param away - step from the neighbour away from the word, 1 or -1

 @returns Whether the neighbour marks a path, an identifier or an address

 @example
 ```ts
 outsideProse({ text: 'the color.css', at: 9, away: 1, },); // true
 ```
 */
function outsideProse(
  {
    text,
    at,
    away,
  }: {
    readonly text: string;
    readonly at: number;
    readonly away: 1 | -1;
  },
): boolean {
  /**
   The neighbour.
   */
  const neighbour = text.charAt(at,);
  if (NON_PROSE_NEIGHBOURS.has(neighbour,))
    return true;
  if (neighbour !== '.')
    return false;
  /**
   Character past the dot.
   */
  const far = text.charAt(at + away,);
  return isLatinLetter({ character: far, },) || ((far >= '0') && (far <= '9'));
}

/**
 Every listed word in a text's prose, respelled the Canadian way.

 @param text - text under scan

 @param ranges - the text's non-prose ranges

 @returns Rewrites in order

 @example
 ```ts
 canadianSpellings({ text: 'her favorite color', ranges: [], },);
 ```
 */
export function canadianSpellings(
  {
    text,
    ranges,
  }: {
    readonly text: string;
    readonly ranges: readonly ProtectedRange[];
  },
): readonly SpellingRewrite[] {
  /**
   Rewrites found so far.
   */
  const rewrites: SpellingRewrite[] = [];
  for (let at = 0; at < text.length;) {
    if (!isLatinLetter({ character: text.charAt(at,), },)) {
      at += 1;
      continue;
    }
    /**
     Where this word starts.
     */
    const start = at;
    while ((at < text.length) && isLatinLetter({ character: text.charAt(at,), },))
      at += 1;
    /**
     The word as written.
     */
    const word = text.slice(
      start,
      at,
    );
    /**
     Its Canadian spelling, where the list names it.
     */
    const canadian = CANADIAN_SPELLINGS.get(word,);
    if ((canadian === undefined)
      || outsideProse({
        text,
        at: start - 1,
        away: -1,
      },)
      || outsideProse({
        text,
        at,
        away: 1,
      },)
      || (!inProse({
        ranges,
        start,
        end: at,
      },)))
      continue;
    rewrites.push({
      start,
      end: at,
      from: word,
      to: canadian,
    },);
  }
  return rewrites;
}
//endregion Canadian spelling
