/**
 Guards class ninety-eight (XingZ629, 2026-09-23): a candidate that keeps a
 work's title the original brackets in 《》 in Han, where the title carries
 no Latin letter and the page the candidate would replace never wrote it,
 is refused before any judge reads it, since a work the original names is
 called by its English title on the page. A title translated, a title kept
 beside its English in parentheses, a title the page itself keeps, and a
 title standing inside an HTML comment are all left to the judges. A title
 that already carries Latin letters is not this floor's: the Han residue
 floor reads its Han (ledger F-3), refusing it bare and passing it glossed.
 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { validateTranslatedSlice, } from '../dist/final/node/index.mjs';

/**
 Original naming the cat's favourite song.
 */
const NAMED = '她最爱的歌是《猫猫摇篮曲》。';

/**
 Rendering that left the title in Han.
 */
const LEFT = 'Her favourite song was 《猫猫摇篮曲》.';

/**
 Rendering that translated the title.
 */
const TRANSLATED = 'Her favourite song was “Kitten Lullaby”.';

/**
 Rendering that translated the title and kept the Han beside it.
 */
const GLOSSED = 'Her favourite song was “Kitten Lullaby” (猫猫摇篮曲).';

/**
 Original naming an album whose title carries Latin letters.
 */
const LATIN_NAMED = '她最爱的专辑是《Nyan物语》。';

/**
 Rendering that kept the Latin-bearing title as written.
 */
const LATIN_KEPT = 'Her favourite album was 《Nyan物语》.';

/**
 Rendering that kept the Latin-bearing title with its English beside it.
 */
const LATIN_GLOSSED = 'Her favourite album was 《Nyan物语》 (Nyan Story).';

/**
 Original naming the song through a link inside the brackets.
 */
const LINKED = '她唱了《[猫猫摇篮曲](https://example.test/song)》。';

/**
 Rendering that kept the link text in Han.
 */
const LINK_LEFT = 'She sang 《[猫猫摇篮曲](https://example.test/song)》.';

/**
 Rendering that translated the link text.
 */
const LINK_TRANSLATED = 'She sang *[Kitten Lullaby](https://example.test/song)*.';

await describe({
  name: 'a work title the original brackets in 《》 (class ninety-eight)',
  children: [
    it({
      name: 'REFUSES a candidate that leaves a linked title\'s text in Han and ACCEPTS it translated',
      fn: async () => {
        /**
         Verdict on the rendering that kept the Han link text.
         */
        const verdict = validateTranslatedSlice({
          sourceText: LINKED,
          candidateText: LINK_LEFT,
        },);
        expect(verdict.kind,).toBe('invalid',);
        if (verdict.kind !== 'invalid')
          throw new Error('unreachable',);
        expect(verdict.findings.join('\n',),).toContain('leaves the title 《猫猫摇篮曲》',);
        expect(validateTranslatedSlice({
          sourceText: LINKED,
          candidateText: LINK_TRANSLATED,
        },).kind,).toBe('valid',);
      },
    },),
    it({
      name: 'REFUSES a candidate that leaves the title in Han where the page never wrote it',
      fn: async () => {
        /**
         Verdict on the rendering that kept the Han title.
         */
        const verdict = validateTranslatedSlice({
          sourceText: NAMED,
          candidateText: LEFT,
        },);
        expect(verdict.kind,).toBe('invalid',);
        if (verdict.kind !== 'invalid')
          throw new Error('unreachable',);
        expect(verdict.findings.join('\n',),).toContain('leaves the title',);
      },
    },),
    it({
      name: 'REFUSES A LATIN-BEARING TITLE LEFT BARE through the Han residue floor, not this one, where it once '
        + 'fell between this floor and the Latin title floor (ledger F-3)',
      fn: async () => {
        /**
         Verdict on the rendering that kept the Latin-bearing title bare.
         */
        const verdict = validateTranslatedSlice({
          sourceText: LATIN_NAMED,
          candidateText: LATIN_KEPT,
        },);
        expect(verdict.kind,).toBe('invalid',);
        if (verdict.kind !== 'invalid')
          throw new Error('unreachable',);
        expect(verdict.findings.join('\n',),).toContain('leaves Han standing',);
        expect(verdict.findings.join('\n',),).not.toContain('leaves the title',);
      },
    },),
    it({
      name: 'ACCEPTS the title translated, glossed, Latin-bearing and glossed, kept by the page, or standing in a comment',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: NAMED,
          candidateText: TRANSLATED,
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: NAMED,
          candidateText: GLOSSED,
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: LATIN_NAMED,
          candidateText: LATIN_GLOSSED,
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: NAMED,
          candidateText: LEFT,
          pageText: LEFT,
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: '<!-- 《猫猫摇篮曲》 -->她睡了。',
          candidateText: 'She slept.',
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
