/**
 Tests for the one reading of whether the deterministic source floor can
 compare anything on a slice, which the floor reads its `unknown` verdict
 from (ledger B43).

 The cases pin each way a side goes unread, which side it is, and that the
 detail is the one the floor's `unknown` verdict carries for the same slice,
 since two readers that disagreed there would let a slice be bought and
 shipped unchecked.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  FrontMatterParseError,
  readFrontMatterGround,
  readMarkdownGround,
  readSliceSkeleton,
  splitFrontMatter,
  validateTranslatedSlice,
} from '../dist/final/node/index.mjs';

/**
 Original the strict grammar reads.
 */
const SOURCE_TEXT = '猫猫在窗台上打盹。';

/**
 Original carrying an expression the strict grammar never closes.
 */
const UNCLOSED_SOURCE = '猫猫在{窗台上打盹。';

/**
 A page neither grammar reads: plain markdown refuses only when reading
 exhausts the parser, and 16,000 nested quotation markers overflow its stack.
 */
const UNREADABLE_PAGE = `${'>'.repeat(16_000,)} cat`;

/**
 What the floor says of that page, as its own case pins it
 (`translate-validate.unit.test.ts`).
 */
const UNREADABLE_PAGE_DETAIL = 'page could not be read: plain markdown also refused: RangeError: Maximum call '
  + 'stack size exceeded';

/**
 A rendering the floors that read text leave alone.
 */
const CANDIDATE_TEXT = 'The cat naps on the windowsill.';

/**
 Fenced metadata the reader reads.
 */
const SOURCE_METADATA = '---\nname: 猫猫\n---\n';

/**
 Metadata as the page carries it.
 */
const PAGE_METADATA = '---\nname: Maomao\n---\n';

/**
 A rendering of that metadata.
 */
const TRANSLATED_METADATA = '---\nname: Mao\n---\n';

/**
 Metadata written without its fences.
 */
const UNFENCED_METADATA = 'name: 猫猫\n';

/**
 Fenced metadata whose YAML the parser refuses.
 */
const BROKEN_METADATA = '---\nname: [broken\n---\n';

/**
 What the strict grammar says of the unclosed original, read rather than
 written out, since the detail is the grammar's own.

 @returns The grammar's refusal detail

 @throws {@link Error} where the fixture reads, which would mean it no longer
 exercises an unread original

 @example
 ```ts
 const detail = unclosedSourceDetail();
 ```
 */
function unclosedSourceDetail(): string {
  /**
   Strict reading of the fixture.
   */
  const read = readSliceSkeleton({ text: UNCLOSED_SOURCE, },);
  if (read.kind !== 'unparseable')
    throw new Error('the unclosed fixture reads, so it no longer exercises an unread original',);
  return read.detail;
}

/**
 What the splitter says of the broken metadata, which a detail naming it
 carries.

 @returns The refusal's message

 @throws {@link Error} where the fixture parses, which would mean it no
 longer exercises a refusal

 @example
 ```ts
 const message = brokenMetadataMessage();
 ```
 */
function brokenMetadataMessage(): string {
  /**
   What splitting the fixture raised.
   */
  const refusal = caught(function splitBroken(): void {
    splitFrontMatter({ text: BROKEN_METADATA, },);
  },);
  if (!(refusal instanceof FrontMatterParseError))
    throw new Error('the broken fixture raised something other than a YAML refusal',);
  return refusal.message;
}

await describe({
  name: readMarkdownGround.name,
  children: [
    it({
      name: 'READS BOTH SIDES, the page under plain markdown where the strict grammar refuses it and as absent '
        + 'where there is none',
      fn: async () => {
        /**
         Grammar each page was read by, or the ground's kind where none was.
         */
        const grammars = [
          'The cat naps.',
          'The cat dozes {unclosed on the windowsill.',
          '',
        ].map(function grammarOf(pageText,): string {
          /**
           Both sides of one slice.
           */
          const ground = readMarkdownGround({
            sourceText: SOURCE_TEXT,
            pageText,
          },);
          return (ground.kind === 'read') ? ground.pageGrammar : ground.kind;
        },);

        expect(grammars,).toEqual(['strict', 'relaxed', 'absent',],);
      },
    },),
    it({
      name: 'NAMES THE ORIGINAL where the strict grammar cannot read it, whatever the page is',
      fn: async () => {
        expect(readMarkdownGround({
          sourceText: UNCLOSED_SOURCE,
          pageText: UNREADABLE_PAGE,
        },),).toEqual({
          kind: 'blind',
          side: 'original',
          detail: `original could not be read: ${unclosedSourceDetail()}`,
        },);
      },
    },),
    it({
      name: 'NAMES THE PAGE where neither grammar reads it',
      fn: async () => {
        expect(readMarkdownGround({
          sourceText: SOURCE_TEXT,
          pageText: UNREADABLE_PAGE,
        },),).toEqual({
          kind: 'blind',
          side: 'page',
          detail: UNREADABLE_PAGE_DETAIL,
        },);
      },
    },),
  ],
},);

await describe({
  name: readFrontMatterGround.name,
  children: [
    it({
      name: 'READS BOTH SIDES, and reads no page as none rather than as unread',
      fn: async () => {
        expect(readFrontMatterGround({
          sourceText: SOURCE_METADATA,
          pageText: PAGE_METADATA,
        },),).toEqual({
          kind: 'read',
          source: splitFrontMatter({ text: SOURCE_METADATA, },).frontMatter,
          page: splitFrontMatter({ text: PAGE_METADATA, },).frontMatter,
        },);
        expect(readFrontMatterGround({
          sourceText: SOURCE_METADATA,
          pageText: '',
        },),).toEqual({
          kind: 'read',
          source: splitFrontMatter({ text: SOURCE_METADATA, },).frontMatter,
        },);
      },
    },),
    it({
      name: 'NAMES THE SIDE carrying no fenced block, the original before the page',
      fn: async () => {
        expect(readFrontMatterGround({
          sourceText: UNFENCED_METADATA,
          pageText: UNFENCED_METADATA,
        },),).toEqual({
          kind: 'blind',
          side: 'original',
          detail: 'source front matter could not be read',
        },);
        expect(readFrontMatterGround({
          sourceText: SOURCE_METADATA,
          pageText: UNFENCED_METADATA,
        },),).toEqual({
          kind: 'blind',
          side: 'page',
          detail: 'page front matter could not be read',
        },);
      },
    },),
    it({
      name: 'NAMES THE SIDE whose YAML is refused, with the refusal, rather than raising it (ledger B44)',
      fn: async () => {
        expect(readFrontMatterGround({
          sourceText: BROKEN_METADATA,
          pageText: PAGE_METADATA,
        },),).toEqual({
          kind: 'blind',
          side: 'original',
          detail: `source front matter could not be read: ${brokenMetadataMessage()}`,
        },);
        expect(readFrontMatterGround({
          sourceText: SOURCE_METADATA,
          pageText: BROKEN_METADATA,
        },),).toEqual({
          kind: 'blind',
          side: 'page',
          detail: `page front matter could not be read: ${brokenMetadataMessage()}`,
        },);
      },
    },),
  ],
},);

await describe({
  name: 'the floor\'s unknown verdict',
  children: [
    it({
      name: 'CARRIES THE GROUND\'S OWN DETAIL for each way a side goes unread, the one definition the floor reads',
      fn: async () => {
        /**
         What each blind ground said beside the floor's verdict on the same
         slice, with a candidate no text floor refuses.
         */
        const answers = [
          {
            ground: readMarkdownGround({
              sourceText: UNCLOSED_SOURCE,
              pageText: '',
            },),
            floor: validateTranslatedSlice({
              sourceText: UNCLOSED_SOURCE,
              pageText: '',
              candidateText: CANDIDATE_TEXT,
            },),
          },
          {
            ground: readMarkdownGround({
              sourceText: SOURCE_TEXT,
              pageText: UNREADABLE_PAGE,
            },),
            floor: validateTranslatedSlice({
              sourceText: SOURCE_TEXT,
              pageText: UNREADABLE_PAGE,
              candidateText: CANDIDATE_TEXT,
            },),
          },
          {
            ground: readFrontMatterGround({
              sourceText: BROKEN_METADATA,
              pageText: PAGE_METADATA,
            },),
            floor: validateTranslatedSlice({
              sourceText: BROKEN_METADATA,
              pageText: PAGE_METADATA,
              candidateText: TRANSLATED_METADATA,
              syntax: 'front-matter',
            },),
          },
          {
            ground: readFrontMatterGround({
              sourceText: SOURCE_METADATA,
              pageText: UNFENCED_METADATA,
            },),
            floor: validateTranslatedSlice({
              sourceText: SOURCE_METADATA,
              pageText: UNFENCED_METADATA,
              candidateText: TRANSLATED_METADATA,
              syntax: 'front-matter',
            },),
          },
        ].map(function detailsOf({
          ground,
          floor,
        },) {
          return {
            ground: (ground.kind === 'blind') ? ground.detail : ground.kind,
            floor: (floor.kind === 'unknown') ? floor.detail : floor.kind,
          };
        },);

        expect(answers,).toEqual([
          `original could not be read: ${unclosedSourceDetail()}`,
          UNREADABLE_PAGE_DETAIL,
          `source front matter could not be read: ${brokenMetadataMessage()}`,
          'page front matter could not be read',
        ].map(function bothSay(detail,) {
          return {
            ground: detail,
            floor: detail,
          };
        },),);
      },
    },),
  ],
},);
