/**
 * Tests for deterministic quote location:
 * byte-exact hits, punctuation-normalized rescue, ambiguity refusal,
 * block-crossing splits, and every failure reason.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { locateQuote, } from './locate-quote.ts';
import { parseDocument, } from './parse-document.ts';

/**
 * Invented document carrying a unique phrase, a repeated phrase,
 * curly punctuation for the normalized fallback, mirrored curly single
 * quotes that collide after normalization, and front matter no block
 * node covers.
 */
const DOCUMENT_TEXT =
  '---\nname: 小猫-quote\n---\n\n## 猫的日常\n\n小猫喜欢追蝴蝶，也喜欢晒太阳。\n\n老猫说：“打盹最舒服。”重复的句子。重复的句子。\n\n有人写‘猫’，也有人写’猫‘。\n';

/**
 * Parsed document every location test searches.
 */
const DOCUMENT = parseDocument({ text: DOCUMENT_TEXT, },);

await describe({
  name: locateQuote.name,
  children: [
    //region Byte-exact location

    it({
      name: 'locates a unique byte-exact quote and binds one anchor',
      fn: async () => {
        const located = locateQuote({
          document: DOCUMENT,
          side: 'target',
          quote: '小猫喜欢追蝴蝶',
        },);
        expect(located.located,).toBe(true,);
        if (!located.located)
          throw new Error('unreachable: asserted located',);
        expect(located.anchors,).toHaveLength(1,);
        const [anchor,] = located.anchors;
        expect(anchor?.side,).toBe('target',);
        expect(anchor?.quotedText,).toBe('小猫喜欢追蝴蝶',);
        expect(anchor?.startOffset,).toBe(DOCUMENT.text.indexOf('小猫喜欢追蝴蝶',),);
      },
    },),
    it({
      name: 'refuses a quote occurring twice as ambiguous',
      fn: async () => {
        const located = locateQuote({
          document: DOCUMENT,
          side: 'target',
          quote: '重复的句子。',
        },);
        expect(located,).toEqual({
          located: false,
          reason: 'ambiguous-quote (target)',
        },);
      },
    },),

    //endregion Byte-exact location

    //region Normalized fallback

    it({
      name: 'rescues an ASCII-quoted copy of curly punctuation, anchoring canonical bytes',
      fn: async () => {
        const located = locateQuote({
          document: DOCUMENT,
          side: 'target',
          quote: '老猫说："打盹最舒服。"',
        },);
        expect(located.located,).toBe(true,);
        if (!located.located)
          throw new Error('unreachable: asserted located',);
        const [anchor,] = located.anchors;
        expect(anchor?.quotedText,).toBe('老猫说：“打盹最舒服。”',);
      },
    },),
    it({
      name: 'refuses a normalized quote matching two curly variants as ambiguous',
      fn: async () => {
        const located = locateQuote({
          document: DOCUMENT,
          side: 'target',
          quote: "'猫'",
        },);
        expect(located,).toEqual({
          located: false,
          reason: 'ambiguous-quote (target)',
        },);
      },
    },),

    //endregion Normalized fallback

    //region Failure reasons

    it({
      name: 'refuses an empty quote',
      fn: async () => {
        const located = locateQuote({
          document: DOCUMENT,
          side: 'target',
          quote: '',
        },);
        expect(located,).toEqual({
          located: false,
          reason: 'empty-quote (target)',
        },);
      },
    },),
    it({
      name: 'reports an absent quote as not found',
      fn: async () => {
        const located = locateQuote({
          document: DOCUMENT,
          side: 'source',
          quote: '狗狗喜欢游泳',
        },);
        expect(located,).toEqual({
          located: false,
          reason: 'quote-not-found (source)',
        },);
      },
    },),
    it({
      name: 'refuses a quote only front matter contains as outside blocks',
      fn: async () => {
        const located = locateQuote({
          document: DOCUMENT,
          side: 'source',
          quote: 'name: 小猫-quote',
        },);
        expect(located,).toEqual({
          located: false,
          reason: 'quote-outside-blocks (source)',
        },);
      },
    },),

    //endregion Failure reasons

    //region Block-crossing splits

    it({
      name: 'splits a block-crossing quote into one anchor per touched block',
      fn: async () => {
        /**
         * Quote spanning the heading, the inter-block gap, and the
         * following paragraph's opening characters.
         */
        const quote = '## 猫的日常\n\n小猫';
        const located = locateQuote({
          document: DOCUMENT,
          side: 'target',
          quote,
        },);
        expect(located.located,).toBe(true,);
        if (!located.located)
          throw new Error('unreachable: asserted located',);
        expect(located.anchors.length,).toBeGreaterThanOrEqual(2,);
        for (const anchor of located.anchors) {
          expect(anchor.quotedText,).toBe(
            DOCUMENT.text.slice(
              anchor.startOffset,
              anchor.endOffset,
            ),
          );
        }
        const [first,] = located.anchors;
        const last = located.anchors.at(-1,);
        expect(first?.startOffset,).toBe(DOCUMENT.text.indexOf(quote,),);
        expect(last?.endOffset,).toBe(DOCUMENT.text.indexOf(quote,) + quote.length,);
      },
    },),
    //endregion Block-crossing splits
  ],
},);
