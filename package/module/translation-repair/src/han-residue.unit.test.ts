/**
 Guards ledger F-3 and A2 (shihai4h1 and shihai4h2, 2026-09-26): a handle
 left in Han inside English prose is refused, while a parenthesized gloss, a
 Japanese quotation line, a title the title floor accepts, markup, and Han the
 original and the page both carry pass. Cat-themed invention throughout; no
 corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  hanResidueFindings,
  untranslatedOrResidueFindings,
  validateTranslatedSlice,
} from '../dist/final/node/index.mjs';

/**
 Original naming a cat by her handle.
 */
const HANDLE_SOURCE = '不对，小橘子。';

/**
 Page that renders the line without the handle.
 */
const HANDLE_PAGE = 'Wrong.';

/**
 Candidate adding the handle in Han, the shape both runs shipped.
 */
const HANDLE_LEFT = 'Wrong,\n小橘子.';

await describe({
  name: hanResidueFindings.name,
  children: [
    it({
      name: 'REFUSES A HANDLE LEFT IN HAN in English prose, naming it (the shihai4h shape)',
      fn: async () => {
        /**
         Findings against the candidate carrying the handle in Han.
         */
        const findings = hanResidueFindings({
          sourceText: HANDLE_SOURCE,
          candidateText: HANDLE_LEFT,
          pageText: HANDLE_PAGE,
        },);
        expect(findings.length,).toBe(1,);
        expect(findings.join(' ',),).toContain('"小橘子"',);
        expect(hanResidueFindings({
          sourceText: HANDLE_SOURCE,
          candidateText: 'Wrong,\nXiao Juzi (Little Tangerine).',
          pageText: HANDLE_PAGE,
        },),).toEqual([],);
      },
    },),
    it({
      name: 'PASSES A PARENTHESIZED GLOSS, half or full width, and REFUSES the same Han leading the English',
      fn: async () => {
        /**
         Original naming the cat's favourite fruit.
         */
        const sourceText = '猫最爱橘子。';
        expect(hanResidueFindings({
          sourceText,
          candidateText: 'The cat loves tangerines (橘子) most.',
        },),).toEqual([],);
        expect(hanResidueFindings({
          sourceText,
          candidateText: 'The cat loves tangerines（橘子）most.',
        },),).toEqual([],);
        expect(hanResidueFindings({
          sourceText,
          candidateText: 'The cat loves 橘子 (tangerines) most.',
        },).join(' ',),).toContain('"橘子"',);
      },
    },),
    it({
      name: 'PASSES A JAPANESE QUOTATION LINE kept beside its English, and REFUSES the Chinese line of a pair '
        + 'the ORIGINAL gives in both languages',
      fn: async () => {
        expect(hanResidueFindings({
          sourceText: '> 猫はねむい\n>\n> 猫很困',
          candidateText: '> 猫はねむい\n>\n> The cat is sleepy',
        },),).toEqual([],);
        expect(hanResidueFindings({
          sourceText: '> 猫很困\n>\n> The cat is sleepy',
          candidateText: '> 猫很困\n>\n> The cat is sleepy',
          pageText: '> The cat is sleepy',
        },).join(' ',),).toContain('"猫很困"',);
      },
    },),
    it({
      name: 'PASSES HAN THE ORIGINAL AND THE PAGE BOTH CARRY, and refuses the same run where the page does not',
      fn: async () => {
        /**
         Original asking what a cat's name is written with.
         */
        const sourceText = '我的名字是「澪」吗？';

        /**
         Candidate keeping the character the name is written with.
         */
        const candidateText = 'Is my name written 澪?';
        expect(hanResidueFindings({
          sourceText,
          candidateText,
          pageText: 'Is my name 澪, you ask?',
        },),).toEqual([],);
        expect(hanResidueFindings({
          sourceText,
          candidateText,
          pageText: 'Is that my name, you ask?',
        },).join(' ',),).toContain('"澪"',);
      },
    },),
    it({
      name: 'PASSES HAN IN MARKUP: code, a link destination, a tag attribute and an HTML comment',
      fn: async () => {
        expect(hanResidueFindings({
          sourceText: '猫写了日记。',
          candidateText: 'The cat wrote `猫` in [her diary](https://example.com/猫日记) '
            + '<span title="猫">here</span> <!-- 猫 -->.',
        },),).toEqual([],);
      },
    },),
    it({
      name: 'PASSES A TITLE THE TITLE FLOOR ACCEPTS AS GLOSSED, and refuses the title standing bare',
      fn: async () => {
        /**
         Original naming a cat's favourite song.
         */
        const sourceText = '她最爱《猫猫摇篮曲》。';
        expect(hanResidueFindings({
          sourceText,
          candidateText: 'Her favourite was 《猫猫摇篮曲》 (Kitty Lullaby).',
        },),).toEqual([],);
        expect(hanResidueFindings({
          sourceText,
          candidateText: 'Her favourite was 《猫猫摇篮曲》.',
        },).join(' ',),).toContain('"猫猫摇篮曲"',);
      },
    },),
    it({
      name: 'READS PROSE BY UTF-16 UNIT, so a character outside the basic plane before a code span neither '
        + 'unmasks the span nor masks the prose after it',
      fn: async () => {
        expect(hanResidueFindings({
          sourceText: '猫说：喵。',
          candidateText: 'The cat 🐱 wrote `喵` today.',
        },),).toEqual([],);
        expect(hanResidueFindings({
          sourceText: '猫说：喵。',
          candidateText: 'The cat 🐱 said 喵.',
        },).join(' ',),).toContain('"喵"',);
      },
    },),
  ],
},);

await describe({
  name: untranslatedOrResidueFindings.name,
  children: [
    it({
      name: 'NAMES A COPIED ORIGINAL ONCE, by the untranslated floor, rather than once per run',
      fn: async () => {
        /**
         Findings against a candidate that is the original.
         */
        const findings = untranslatedOrResidueFindings({
          sourceText: '猫睡了。',
          candidateText: '猫睡了。',
        },);
        expect(findings.length,).toBe(1,);
        expect(findings.join(' ',),).toContain('repeats the ORIGINAL untranslated',);
      },
    },),
  ],
},);

await describe({
  name: validateTranslatedSlice.name,
  children: [
    it({
      name: 'REFUSES THE HANDLE LEFT IN HAN through the composed verdict, readable original or not (ledger F-5)',
      fn: async () => {
        /**
         Verdict on the handle left in Han against a readable original.
         */
        const readable = validateTranslatedSlice({
          sourceText: HANDLE_SOURCE,
          candidateText: 'Wrong, 小橘子.',
          pageText: HANDLE_PAGE,
        },);
        expect(readable.kind,).toBe('invalid',);
        expect((readable.kind === 'invalid') ? readable.findings.join(' ',) : '',).toContain('"小橘子"',);

        /**
         Verdict against an original the strict grammar refuses.
         */
        const unreadable = validateTranslatedSlice({
          sourceText: '小橘子 <未闭合 的标签 在这里。',
          candidateText: 'Little 小橘子 is here.',
        },);
        expect(unreadable.kind,).toBe('invalid',);
        expect((unreadable.kind === 'invalid') ? unreadable.findings.join(' ',) : '',).toContain('"小橘子"',);
      },
    },),
  ],
},);
