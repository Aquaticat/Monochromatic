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
import {
  locateQuote,
  parseDocument,
} from '../dist/final/node/index.mjs';

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

/**
 * Invented document whose one paragraph soft-wraps, so a quote spanning the
 * wrap holds a line break where a critic returns a space.
 */
const WRAPPED = parseDocument({
  text: '## 猫的午睡\n\n小猫在窗台上打盹，\n阳光晒得暖洋洋。\n',
},);

/**
 * Invented document repeating one soft-wrapped sentence, so collapsing the
 * wrap finds the same quote twice.
 */
const WRAPPED_TWICE = parseDocument({
  text: '## 猫的午睡\n\n小猫趴着睡，\n阳光很暖和。\n\n小猫趴着睡，\n阳光很暖和。\n',
},);

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
          reason: 'quote-not-found (source) needle="狗狗喜欢游泳"',
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

    //region Soft line breaks

    it({
      name: 'LOCATES a quote the wrap explains, which it used only to diagnose. A quote differing from '
        + 'the document by where a paragraph was wrapped is the document text, and refusing it '
        + 'discarded correct evidence: 45 of 844 stored not-found failures were this, and 10 of 11 on '
        + 'the coverage question, whose quotes are whole sentences',
      fn: async () => {
        const located = locateQuote({
          document: WRAPPED,
          side: 'target',
          quote: '小猫在窗台上打盹， 阳光晒得暖洋洋。',
        },);
        expect(located.located,).toBe(true,);
      },
    },),
    it({
      name: 'refuses a wrap-explained quote that collapses onto TWO occurrences as ambiguous, which is '
        + 'what it is: locating it would pick one of two passages by position alone',
      fn: async () => {
        const located = locateQuote({
          document: WRAPPED_TWICE,
          side: 'target',
          quote: '小猫趴着睡， 阳光很暖和。',
        },);
        expect(located,).toEqual({
          located: false,
          reason: 'ambiguous-quote (target)',
        },);
      },
    },),
    it({
      name: 'leaves a genuinely absent quote unsuffixed',
      fn: async () => {
        const located = locateQuote({
          document: WRAPPED,
          side: 'target',
          quote: '狗在院子里跑步',
        },);
        expect(located,).toEqual({
          located: false,
          reason: 'quote-not-found (target) needle="狗在院子里跑步"',
        },);
      },
    },),
    it({
      name: 'TRUNCATES a paragraph-length needle, since a finding is a '
        + 'scorecard line while critics quote whole paragraphs',
      fn: async () => {
        /**
         * Absent quote longer than the preview bound, built from one repeated
         * character so the truncation point is countable rather than guessed.
         */
        const quote = '狗'.repeat(200,);

        /**
         * Failure this miss produced.
         */
        const located = locateQuote({
          document: WRAPPED,
          side: 'target',
          quote,
        },);
        expect(located,).toEqual({
          located: false,
          reason: `quote-not-found (target) needle="${'狗'.repeat(60,)}…"`,
        },);
      },
    },),
    it({
      name: 'FLATTENS a needle carrying a line break onto one line, so a '
        + 'finding stays a single line whatever the critic quoted',
      fn: async () => {
        /**
         * Absent quote carrying its own line break.
         */
        const located = locateQuote({
          document: WRAPPED,
          side: 'target',
          quote: '狗在院子\n里跑步',
        },);
        expect(located,).toEqual({
          located: false,
          reason: 'quote-not-found (target) needle="狗在院子 里跑步"',
        },);
      },
    },),

    //endregion Soft line breaks

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
    it({
      name: 'LOCATES a quote that differs from the document only in where a paragraph was wrapped, '
        + 'since a model copying a sentence out of a wrapped paragraph writes it on one line and the '
        + 'document holds the same characters with a newline in the middle',
      fn: async () => {
        /** Translation whose paragraph is wrapped mid-sentence. */
        const wrappedText = 'The cat sleeps on the windowsill each morning\nand naps on its cushion at noon.\n';

        /** That document as an anchor target. */
        const document = {
          text: wrappedText,
          nodes: parseDocument({ text: wrappedText, },).nodes,
        };

        /** Same sentence as one line, which is how a model copies it back. */
        const located = locateQuote({
          document,
          side: 'target',
          quote: 'on the windowsill each morning and naps on its cushion',
        },);
        expect(located.located,).toBe(true,);
      },
    },),
    it({
      name: 'still refuses to join across a BLANK LINE, since a paragraph break carries two line '
        + 'endings where a space-joined quote carries one space, so collapsing cannot merge passages '
        + 'the document keeps apart',
      fn: async () => {
        /** Two paragraphs, separated as paragraphs are. */
        const twoParagraphs = 'The cat sleeps on the windowsill.\n\nShe watches the birds outside.\n';

        /** That document as an anchor target. */
        const document = {
          text: twoParagraphs,
          nodes: parseDocument({ text: twoParagraphs, },).nodes,
        };
        const located = locateQuote({
          document,
          side: 'target',
          quote: 'on the windowsill. She watches',
        },);
        expect(located.located,).toBe(false,);
      },
    },),
  ],
},);
