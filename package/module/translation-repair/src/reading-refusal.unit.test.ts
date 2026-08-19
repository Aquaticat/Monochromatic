/**
 * Tests for telling a model declining to read a picture from a model reading
 * one.
 *
 * WHY THIS IS ITS OWN SCREEN. Two refusals corroborate each other. Real traffic
 * on 2026-08-19 returned `There is no text visible in this image.` from one
 * reader and `No legible text is visible.` from the other, and the pair stage
 * marked them corroborated at 0.565 trigram overlap, because two ways of saying
 * "there is nothing here" share their vocabulary exactly as two transcriptions
 * of one passage do. Both had slipped the phrase list by a single word.
 *
 * SO THESE PIN THE SHAPE, not a wording. A refusal negates, names the picture
 * or its text, and is a sentence rather than a passage. All three are required,
 * and one case here removes each in turn to show that each is load-bearing.
 *
 * Fixtures are cat-themed invention, except the two refusals, which are the
 * exact replies that caused this and carry no corpus content.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  latinWords,
  readingMakesSense,
  readsAsRefusal,
} from '../dist/final/node/index.mjs';

/**
 * What one reader answered when it would not read a picture.
 */
const QWEN_REFUSAL = '\n\nThere is no text visible in this image.';

/**
 * What the other reader answered about the same picture, worded differently and
 * meaning the same.
 */
const KIMI_REFUSAL = 'No legible text is visible.';

/**
 * A transcription long enough that no word list is consulted, which happens to
 * discuss both a picture and an absence.
 */
const LONG_TRANSCRIPTION = 'Lost: one tabby cat, answers to Mittens, last seen '
  + 'near the vet on Pearl Street. There is no photo of her winter coat, and the '
  + 'image on this poster was taken in summer, so please do not go by colour '
  + 'alone. Call 555 0134 at any hour. She is chipped and she is missed.';

await describe({
  name: readsAsRefusal.name,
  children: [
    it({
      name: 'REFUSES BOTH REPLIES THAT CORROBORATED EACH OTHER IN PRODUCTION. Neither was caught by '
        + 'the phrase list they were meant to trip, one by word order and one by a word sitting '
        + 'between two others, and a corroborated refusal reaches the translator and the judge as '
        + 'what the picture says',
      fn: async () => {
        expect(readsAsRefusal({ reading: QWEN_REFUSAL, },),).toBe(true,);
        expect(readsAsRefusal({ reading: KIMI_REFUSAL, },),).toBe(true,);
      },
    },),

    it({
      name: 'ACCEPTS A LONG TRANSCRIPTION that negates and names a picture. Length is checked '
        + 'first, so a passage that happens to discuss its own medium is never put to the word '
        + 'lists at all. Without this a real transcription mentioning a photo would be discarded',
      fn: async () => {
        expect(LONG_TRANSCRIPTION.length > 160,).toBe(true,);
        expect(readsAsRefusal({ reading: LONG_TRANSCRIPTION, },),).toBe(false,);
      },
    },),

    it({
      name: 'ACCEPTS A SHORT READING THAT NEGATES WITHOUT NAMING THE PICTURE, since a transcript '
        + 'may say that something is not so. Refusing on a negation alone would discard any '
        + 'notice that reports an absence',
      fn: async () => {
        expect(readsAsRefusal({ reading: 'Mittens has not been seen since Tuesday.', },),).toBe(false,);
      },
    },),

    it({
      name: 'ACCEPTS A SHORT READING THAT NAMES THE PICTURE WITHOUT NEGATING, since a poster may '
        + 'caption its own photograph. Refusing on the word alone would discard every transcript '
        + 'of a caption',
      fn: async () => {
        expect(readsAsRefusal({ reading: 'Photo of Mittens, taken last June.', },),).toBe(false,);
      },
    },),

    it({
      name: 'ACCEPTS `note` AS ITS OWN WORD rather than reading `not` inside it. Substring '
        + 'matching would refuse a transcript of a handwritten note about a picture, which is '
        + 'exactly the kind of thing worth reading',
      fn: async () => {
        expect(latinWords({ text: 'Note on the picture', },),).toEqual([
          'note',
          'on',
          'the',
          'picture',
        ],);
        expect(readsAsRefusal({ reading: 'Note taped to the picture frame.', },),).toBe(false,);
      },
    },),

    it({
      name: 'REFUSES A CONTRACTION WRITTEN WITH A TYPOGRAPHIC APOSTROPHE, which is what a model '
        + 'writing prose reaches for. Folding it onto the straight apostrophe is what lets one '
        + 'spelling in the word list cover both',
      fn: async () => {
        expect(readsAsRefusal({ reading: 'I can’t make out any text here.', },),).toBe(true,);
        expect(readsAsRefusal({ reading: 'I can\'t make out any text here.', },),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES A REPLY PADDED WITH NEWLINES, because the padding is not the reply. Measuring '
        + 'length before trimming would let a refusal buy its way past the bound with whitespace',
      fn: async () => {
        expect(readsAsRefusal({
          reading: `${'\n'.repeat(200,)}No text here.${'\n'.repeat(200,)}`,
        },),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: latinWords.name,
  children: [
    it({
      name: 'SPLITS ON EVERYTHING THAT IS NOT A LETTER and lowercases what it keeps, so a word '
        + 'list needs one spelling of each word and matches whole words rather than substrings',
      fn: async () => {
        expect(latinWords({ text: 'No, TEXT: visible!  (none)', },),).toEqual([
          'no',
          'text',
          'visible',
          'none',
        ],);
      },
    },),

    it({
      name: 'KEEPS A CONTRACTION WHOLE rather than splitting it at the apostrophe, since `can` '
        + 'and `t` are not the word the list carries',
      fn: async () => {
        expect(latinWords({ text: 'I can\'t and it isn’t', },),).toEqual([
          'i',
          'can\'t',
          'and',
          'it',
          'isn\'t',
        ],);
      },
    },),

    it({
      name: 'RETURNS NOTHING FOR TEXT WITH NO LATIN LETTERS, which is what a Chinese transcript '
        + 'is. Every real reading in the measured sample lands here, which is why neither word '
        + 'list can reach one',
      fn: async () => {
        expect(latinWords({ text: '喵。喵喵！', },),).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: `${readingMakesSense.name} shape clause`,
  children: [
    it({
      name: 'REPORTS A SHAPE REFUSAL UNDER THE SAME CLAUSE AS A PHRASE REFUSAL, so a finding reads '
        + 'the same however the reader worded its decline and nobody has to learn two names for '
        + 'one outcome',
      fn: async () => {
        /**
         * Verdict on the reply that slipped the phrase list in production.
         */
        const verdict = readingMakesSense({ reading: QWEN_REFUSAL, },);

        expect(verdict.kind,).toBe('refused',);
        if (verdict.kind !== 'refused')
          throw new Error('refused by construction',);
        expect(verdict.clause,).toBe('reads-as-refusal',);
      },
    },),
  ],
},);
