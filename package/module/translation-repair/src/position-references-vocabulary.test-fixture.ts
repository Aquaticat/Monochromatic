/**
 The vocabulary of a reference by position (ledger D33), read by
 `position-references.test-fixture.ts` and
 `position-references-text.test-fixture.ts`: the words that point, the words
 before them that make a phrase a pointer, and the words after them that make
 it a comparison.

 WORD LISTS ARE WRITTEN AS ONE SPACED STRING EACH and split once, so a list of
 a hundred nouns reads as a paragraph rather than a hundred lines.

 @module
 */

/**
 A set of the words a spaced list names.

 @param words - words separated by single spaces

 @returns The words as a set

 @example
 ```ts
 wordSet({ words: 'above below', },).has('above',); // true
 ```
 */
function wordSet({ words, }: { readonly words: string; },): ReadonlySet<string> {
  return new Set(words.split(' ',),);
}

//region Vocabulary

/**
 Words that point by position.
 */
export const POSITIONS: ReadonlySet<string> = wordSet({ words: 'above below', },);

/**
 Verbs that, before a position, cite what they point at.
 */
export const REFERENCE_VERBS: ReadonlySet<string> = wordSet({
  words: 'see as noted described shown listed defined stated explained mentioned quoted named discussed given '
    + 'written documented recorded argued said covered introduced cited established',
},);

/**
 Nouns that name a unit of a text, a test file or a program, before a
 position.
 */
export const STRUCTURE_NOUNS: ReadonlySet<string> = wordSet({
  words: 'case cases paragraph paragraphs note notes comment comments section sections rule rules figure figures '
    + 'list lists table tables heading headings region regions test tests example examples entry entries finding '
    + 'findings bullet bullets sentence sentences reasoning explanation caveat proof summary assertion assertions '
    + 'check checks filter literal constant constants helper helpers function functions definition definitions one '
    + 'ones field fields script comparison record records line lines path paths words read republish count counts '
    + 'reason reasons two three four five six seven eight nine ten claim claims point points question questions '
    + 'answer answers option options step steps block blocks item items argument arguments scenario scenarios batch '
    + 'census measurement measurements tally number numbers call calls loop loops branch branches guard guards scan '
    + 'scans class classes probe probes row rows column columns group groups pair pairs addendum addenda',
},);

/**
 Words that, after a position, make it a comparison rather than a pointer:
 "ranks the house rules above its own", "a rate above one".
 */
export const COMPARED_OBJECTS: ReadonlySet<string> = wordSet({
  words: 'the a an its their his her one zero it that this what any every each some all',
},);

/**
 Characters that, after a position, name its target or make it a comparison:
 a figure, a code span, a quoted heading, a sign.
 */
export const NAMING_OPENERS: ReadonlySet<string> = new Set([
  '$',
  '`',
  '"',
  '\u{201C}',
  '-',
  '+',
],);

/**
 Words that open a structure noun before "before this" or "after it".
 */
const DETERMINERS: ReadonlySet<string> = wordSet({ words: 'the this that every each all', },);

/**
 Nouns that, before "before this" or "after it", name a unit of the text.
 */
const SEQUENCE_NOUNS: ReadonlySet<string> = wordSet({
  words: 'case cases test tests paragraph paragraphs section sections note notes comment comments entry entries '
    + 'heading headings bullet bullets sentence sentences list lists table tables figure figures rule rules',
},);

/**
 Words naming the text a reference sits in: "earlier in this file".
 */
const CONTAINERS: ReadonlySet<string> = wordSet({
  words: 'file module doc document section entry ledger test suite list comment region note paragraph chapter log',
},);

/**
 Characters a wrapped string or comment leaves between two words of one
 phrase once its lines are joined: spaces, the quote that closed one line's
 string and the sign that joined the next.
 */
export const JOIN_GAP: ReadonlySet<string> = new Set([
  ' ',
  '\t',
  '\'',
  '`',
  '+',
],);

/**
 Markup a wrapped comment or quote-block line opens with, longest first so a
 doc comment is not read as a plain one.
 */
export const CONTINUATION_MARKERS: readonly string[] = [
  '/**',
  '//',
  '/*',
  '*/',
  '*',
  '>',
];

/**
 Characters of context kept on each side of a reference, which an exemption
 is matched against.
 */
export const WINDOW_REACH = 80;

/**
 Sequences a reference by position spells word by word: a reference verb
 before a position ("see above"), a structure noun before "before this" or
 "after it", a sequence noun before "before this one", a position "in this
 file", its kin "further up in this file", and "the former" or "the latter".
 */
export const SEQUENCES: readonly (readonly ReadonlySet<string>[])[] = [
  [
    REFERENCE_VERBS,
    POSITIONS,
  ],
  [
    DETERMINERS,
    SEQUENCE_NOUNS,
    wordSet({ words: 'before after', },),
    wordSet({ words: 'this it them', },),
  ],
  [
    SEQUENCE_NOUNS,
    wordSet({ words: 'before after', },),
    wordSet({ words: 'this', },),
    wordSet({ words: 'one', },),
  ],
  [
    wordSet({ words: 'earlier later above below', },),
    wordSet({ words: 'in', },),
    wordSet({ words: 'this', },),
    CONTAINERS,
  ],
  [
    wordSet({ words: 'further higher lower', },),
    wordSet({ words: 'up down', },),
    wordSet({ words: 'in', },),
    wordSet({ words: 'this', },),
    CONTAINERS,
  ],
  [
    wordSet({ words: 'the', },),
    wordSet({ words: 'former latter', },),
  ],
];

/**
 A structure noun before a position, a pointer unless what follows compares
 or names.
 */
export const STRUCTURE_THEN_POSITION: readonly ReadonlySet<string>[] = [
  STRUCTURE_NOUNS,
  POSITIONS,
];

//endregion Vocabulary
