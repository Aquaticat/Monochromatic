/**
 Tests that an MDX refusal says where the grammar stopped, never what it read.

 MDX IS THE NEAR MISS, and that is why these cases exist at all. Four of five
 measured failure shapes report a position and an expectation and quote
 nothing, so a single-case probe reports this module as already safe. The
 fifth, an unclosed tag, puts the tag NAME from the source into its reason,
 and `parse-document.ts` used to stringify that straight into a stored
 finding.

 The control, `rawMdxRefusal`, is what keeps the absence assertions honest: it asserts the
 RAW parser does quote, on the same fixture, before anything asserts that the
 wrapper does not.

 Fixture wording is cat-themed invention, so no corpus content appears here.

 @module
 */

import type { Nodes, } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified, } from 'unified';

import {
  caught,
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  MarkdownParseError,
  MdxParseError,
  namesWithoutQuoting,
  parseMarkdownBody,
  parseMdxBody,
  requireMarkdownRefusal,
  requireMdxRefusal,
} from '../dist/final/node/index.mjs';
import { caughtAtStackEdge, } from './stack-edge.test-fixture.ts';

//region MDX refusal disclosure tests

/**
 How every refusal of the strict grammar ends, the account before it varying.
 */
const REFUSAL_ENDING = '; corpus documents compile as MDX upstream, so failure signals corruption or an unsupported '
  + 'construct.';

/**
 Tag name appearing nowhere else in this file, so an assertion of absence
 cannot pass by accident.
 */
const FIXTURE_TAG = 'Tuftmallow';

/**
 Body whose only fault is an unclosed tag, which is the shape that quotes.

 MEASURED: this refuses at `1:1` under `mdast-util-mdx-jsx/end-tag-mismatch`,
 and the raw reason reproduces the tag name.
 */
const REFUSING_BODY = `<${FIXTURE_TAG}>\n\nbody\n`;

/**
 Reads what the MDX grammar says with nothing between it and a reader.

 BUILDS THE SAME PIPELINE `parse-mdx.ts` builds, deliberately, rather than
 calling the wrapper: a control that went through the wrapper would measure
 the wrapper, which is the thing under test.

 @returns Parser's own reason for refusing

 @throws {@link Error} where the control fixture parsed, which would leave the
 absence assertions unproven

 @example
 ```ts
 expect(rawMdxRefusal().includes(FIXTURE_TAG,),).toBe(true,);
 ```
 */
function rawMdxRefusal(): string {
  try {
    unified()
      .use(remarkParse,)
      .use(remarkMdx,)
      .use(remarkGfm,)
      .parse(REFUSING_BODY,);
  }
  catch (error) {
    if (Error.isError(error,))
      return error.message;

    throw error;
  }

  throw new Error('the control fixture parsed, so it proves nothing',);
}

/**
 Parses a body that must refuse, handing the refusal back to be read.

 @returns Refusal the parser raised

 @throws {@link Error} where the fixture parsed, which would mean it no longer
 exercises anything

 @example
 ```ts
 const refusal = mdxRefusal();
 ```
 */
function mdxRefusal(): Error {
  try {
    parseMdxBody({ body: REFUSING_BODY, },);
  }
  catch (error) {
    if (Error.isError(error,))
      return error;

    throw error;
  }

  throw new Error('the fixture parsed, so it no longer exercises a refusal',);
}

/**
 Body opening with a byte order mark, then two paragraphs.
 */
const MARKED_BODY = '\uFEFFThe cat naps.\n\nSecond cat.\n';

/**
 Body opening with a byte order mark, then a tag with an attribute around a paragraph.
 */
const MARKED_TAG_BODY = '\uFEFF<Box tone="warm">\n\nThe cat naps.\n\n</Box>\n';

/**
 Position of a parsed node, read for the whole value.

 @param node - parsed node

 @returns Position the parser set

 @throws {@link Error} when the node carries no position

 @example
 ```ts
 const where = positionOf(root.children[0],);
 ```
 */
function positionOf(node: Readonly<Nodes>,): Required<Nodes>['position'] {
  if (node.position === undefined)
    throw new Error('the parsed node carries no position, though the parser sets one on every node',);
  return node.position;
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: 'MdxParseError says where, never what',
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'CONTROL: the grammar itself does quote the tag, so absence is provable',
          fn: async () => {
            expect(rawMdxRefusal().includes(FIXTURE_TAG,),).toBe(true,);
          },
        },),
        it({
          name: 'REFUSES to repeat the markup it could not parse',
          fn: async () => {
            /**
             Refusal as a reader would see it.
             */
            const refusal = mdxRefusal();

            expect(refusal.message.includes(FIXTURE_TAG,),).toBe(false,);
          },
        },),
        it({
          name: 'ACCEPTS only its own class, so the wrapper is what a caller catches',
          fn: async () => {
            expect(mdxRefusal() instanceof MdxParseError,).toBe(true,);
          },
        },),
        it({
          name: 'STATES the position and the rule the grammar named',
          fn: async () => {
            /**
             Refusal as a reader would see it.
             */
            const refusal = mdxRefusal();

            expect(refusal.message,).toBe(
              'MDX body refused to parse at 1:1 (mdast-util-mdx-jsx/end-tag-mismatch); corpus documents compile as MDX '
                + 'upstream, so failure signals corruption or an unsupported construct.',
            );
          },
        },),
        it({
          name: 'CARRIES NO cause, which a reporter would render whether asked to or not',
          fn: async () => {
            expect(mdxRefusal().cause,).toBe(undefined,);
          },
        },),
        it({
          name: 'DECLARES its message safe to forward',
          fn: async () => {
            /**
             Refusal as a reader would see it.
             */
            const refusal = mdxRefusal();

            expect(namesWithoutQuoting(refusal,),).toBe(true,);
          },
        },),
      ],
    },),

    describe({
      name: 'A leading byte order mark',
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'KEEPS every strict-grammar offset in the body as written, the mark counted, so the first paragraph '
            + 'starts after it',
          fn: async () => {
            /**
             Root the strict grammar builds for a body opening with the mark.
             */
            const root = parseMdxBody({ body: MARKED_BODY, },);

            expect(root.position,).toEqual({
              start: { line: 1, column: 1, offset: 0, },
              end: { line: 4, column: 1, offset: MARKED_BODY.length, },
            },);
            expect(root.children.map(positionOf,),).toEqual([
              {
                start: { line: 1, column: 2, offset: 1, },
                end: { line: 1, column: 15, offset: 14, },
              },
              {
                start: { line: 3, column: 1, offset: 16, },
                end: { line: 3, column: 12, offset: 27, },
              },
            ],);
          },
        },),
        it({
          name: 'KEEPS every plain-markdown offset in the body as written, the mark counted, so the first paragraph '
            + 'starts after it',
          fn: async () => {
            /**
             Root the plain grammar builds for a body opening with the mark.
             */
            const root = parseMarkdownBody({ body: MARKED_BODY, },);

            expect(root.position,).toEqual({
              start: { line: 1, column: 1, offset: 0, },
              end: { line: 4, column: 1, offset: MARKED_BODY.length, },
            },);
            expect(root.children.map(positionOf,),).toEqual([
              {
                start: { line: 1, column: 2, offset: 1, },
                end: { line: 1, column: 15, offset: 14, },
              },
              {
                start: { line: 3, column: 1, offset: 16, },
                end: { line: 3, column: 12, offset: 27, },
              },
            ],);
          },
        },),
        it({
          name: 'KEEPS the offsets of a tag, its attribute and the nodes nested in it, all in the body as written',
          fn: async () => {
            /**
             Root the strict grammar builds for a marked body holding a tag with an attribute.
             */
            const root = parseMdxBody({ body: MARKED_TAG_BODY, },);
            expect(root.children,).toEqual([
              {
                type: 'mdxJsxFlowElement',
                name: 'Box',
                attributes: [{
                  type: 'mdxJsxAttribute',
                  name: 'tone',
                  value: 'warm',
                  position: {
                    start: { line: 1, column: 7, offset: 6, },
                    end: { line: 1, column: 18, offset: 17, },
                  },
                },],
                children: [{
                  type: 'paragraph',
                  children: [{
                    type: 'text',
                    value: 'The cat naps.',
                    position: {
                      start: { line: 3, column: 1, offset: 20, },
                      end: { line: 3, column: 14, offset: 33, },
                    },
                  },],
                  position: {
                    start: { line: 3, column: 1, offset: 20, },
                    end: { line: 3, column: 14, offset: 33, },
                  },
                },],
                position: {
                  start: { line: 1, column: 2, offset: 1, },
                  end: { line: 5, column: 7, offset: 41, },
                },
              },
            ],);
          },
        },),
        it({
          name: 'LEAVES a mark that is not the first character where the parser counted it',
          fn: async () => {
            /**
             Root of a body whose second paragraph opens with the mark.
             */
            const root = parseMdxBody({ body: 'The cat naps.\n\n\uFEFFSecond cat.\n', },);

            expect(root.children.map(positionOf,),).toEqual([
              {
                start: { line: 1, column: 1, offset: 0, },
                end: { line: 1, column: 14, offset: 13, },
              },
              {
                start: { line: 3, column: 1, offset: 15, },
                end: { line: 3, column: 13, offset: 27, },
              },
            ],);
          },
        },),
        it({
          name: 'NAMES the column of a first-line refusal in the body as written, the mark counted',
          fn: async () => {
            /**
             Refusal for a stray closing tag after the mark.
             */
            const marked = caught(function parseMarked(): void {
              parseMdxBody({ body: '\uFEFFThe cat naps </b> here\n', },);
            },);
            /**
             Refusal for the same line without the mark.
             */
            const bare = caught(function parseBare(): void {
              parseMdxBody({ body: 'The cat naps </b> here\n', },);
            },);

            if ((!(marked instanceof MdxParseError)) || (!(bare instanceof MdxParseError)))
              throw new Error('both bodies are refused by the strict grammar',);
            expect([marked.line, marked.column,],).toEqual([bare.line, (bare.column ?? 0) + 1,],);
          },
        },),
      ],
    },),

    describe({
      name: requireMdxRefusal.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'RETURNS the refusal a catch around the grammar holds, the same object',
          fn: async () => {
            /**
             Refusal the grammar raised.
             */
            const refusal = mdxRefusal();

            expect(requireMdxRefusal({ error: refusal, },),).toBe(refusal,);
          },
        },),
        it({
          name: 'RETHROWS anything else unchanged, an error or not, since an unexpected state must keep propagating',
          fn: async () => {
            /**
             A failure that is not the grammar's refusal.
             */
            const stray = new TypeError('the cat knocked the parser off the table',);

            expect(caught(function narrowStray(): void {
              requireMdxRefusal({ error: stray, },);
            },),).toBe(stray,);
            expect(caught(function narrowString(): void {
              requireMdxRefusal({ error: 'hairball', },);
            },),).toBe('hairball',);
          },
        },),
      ],
    },),

    describe({
      name: requireMarkdownRefusal.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'RETURNS the refusal plain markdown raises on deep nesting, the same object (ledger B100)',
          fn: async () => {
            /**
             What plain markdown throws on thousands of nested quotation markers.
             */
            const refusal = caught(function parseDeep(): void {
              parseMarkdownBody({ body: `${'>'.repeat(16_000,)} cat`, },);
            },);

            expect(refusal,).toBeInstanceOf(MarkdownParseError,);
            expect(requireMarkdownRefusal({ error: refusal, },),).toBe(refusal,);
          },
        },),
        it({
          name: 'RETHROWS a RangeError that is not the plain grammar\'s refusal, the engine\'s own stack exhaustion '
            + 'among them, since only the refusal parseMarkdownBody raises is a fact about a text',
          fn: async () => {
            /**
             A range failure from anywhere else in the package.
             */
            const stray = new RangeError('the cat is not a position in the slices',);
            /**
             What the engine raises where some other code runs out of stack.
             */
            const exhaustion = new RangeError('Maximum call stack size exceeded',);

            expect(caught(function narrowStray(): void {
              requireMarkdownRefusal({ error: stray, },);
            },),).toBe(stray,);
            expect(caught(function narrowExhaustion(): void {
              requireMarkdownRefusal({ error: exhaustion, },);
            },),).toBe(exhaustion,);
          },
        },),
        it({
          name: 'RETHROWS anything else unchanged, the strict grammar\'s refusal included, since an unexpected '
            + 'state must keep propagating',
          fn: async () => {
            /**
             A failure that is not a stack exhaustion.
             */
            const stray = new TypeError('the cat knocked the parser off the table',);

            expect(caught(function narrowStray(): void {
              requireMarkdownRefusal({ error: stray, },);
            },),).toBe(stray,);
            expect(caught(function narrowMdx(): void {
              requireMarkdownRefusal({ error: mdxRefusal(), },);
            },),).toBeInstanceOf(MdxParseError,);
            expect(caught(function narrowString(): void {
              requireMarkdownRefusal({ error: 'hairball', },);
            },),).toBe('hairball',);
          },
        },),
      ],
    },),

    describe({
      name: 'nesting bound',
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'REFUSES a body nested 257 quotation markers deep before the strict grammar reads it, naming the '
            + 'place and quoting nothing',
          fn: async () => {
            /**
             What the strict grammar throws on a body one marker past the bound.
             */
            const refusal = caught(function parseTooDeep(): void {
              parseMdxBody({ body: `${'>'.repeat(257,)} cat`, },);
            },);

            expect(refusal,).toBeInstanceOf(MdxParseError,);
            expect(String(refusal,),).toBe(
              'MdxParseError: MDX body refused to parse because it is nested too deeply to read: its container '
                + `markers pass the bound of 256 at line 1, column 257${REFUSAL_ENDING}`,
            );
            expect(namesWithoutQuoting(refusal,),).toBe(true,);
            expect(refusal,).toMatchObject({ line: 1, column: 257, },);
          },
        },),
        it({
          name: 'READS a body nested 256 quotation markers deep, the last depth the bound allows',
          fn: async () => {
            expect(parseMdxBody({ body: `${'>'.repeat(256,)} cat`, },).children
              .map(function kindOf(node,): string {
                return node.type;
              },),).toEqual(['blockquote',],);
          },
        },),
        it({
          name: 'NAMES the column of a refused body as written, a leading byte order mark counted',
          fn: async () => {
            expect(caught(function parseTooDeepAfterMark(): void {
              parseMdxBody({ body: `\uFEFF${'>'.repeat(257,)} cat`, },);
            },),).toMatchObject({ line: 1, column: 258, },);
          },
        },),
        it({
          name: 'REFUSES open brackets, open tags and open braces past the bound by the same rule',
          fn: async () => {
            /**
             What the strict grammar throws on 257 open brackets.
             */
            const brackets = caught(function parseTooManyBrackets(): void {
              parseMdxBody({ body: `${'['.repeat(257,)}cat`, },);
            },);
            /**
             What it throws on 257 open tags.
             */
            const tags = caught(function parseTooManyTags(): void {
              parseMdxBody({ body: `${'<div>'.repeat(257,)}cat`, },);
            },);
            /**
             What it throws on 257 open braces.
             */
            const braces = caught(function parseTooManyBraces(): void {
              parseMdxBody({ body: `${'{'.repeat(257,)}1`, },);
            },);

            expect(String(brackets,),).toBe(
              `MdxParseError: MDX body refused to parse because it is nested too deeply to read: its brackets pass `
                + `the bound of 256 at line 1, column 257${REFUSAL_ENDING}`,
            );
            expect(String(tags,),).toBe(
              `MdxParseError: MDX body refused to parse because it is nested too deeply to read: its open tags pass `
                + `the bound of 256 at line 1, column 1285${REFUSAL_ENDING}`,
            );
            expect(String(braces,),).toBe(
              `MdxParseError: MDX body refused to parse because it is nested too deeply to read: its open braces `
                + `pass the bound of 256 at line 1, column 257${REFUSAL_ENDING}`,
            );
          },
        },),
        it({
          name: 'REFUSES a body that exhausts the stack from a shallow text, with the exhaustion as its cause, where '
            + 'the raw parser throws the engine\'s RangeError itself',
          fn: async () => {
            /**
             Text well under the bound, so only the stack left decides it.
             */
            const body = `${'>'.repeat(200,)} cat`;
            /**
             What the parser alone throws from the edge of the stack.
             */
            const raw = caughtAtStackEdge({
              run: function parseRaw(): unknown {
                return unified()
                  .use(remarkParse,)
                  .use(remarkMdx,)
                  .use(remarkGfm,)
                  .parse(body,);
              },
            },);
            /**
             What the strict grammar throws from the edge of the stack.
             */
            const refusal = caughtAtStackEdge({
              run: function parseStrict(): unknown {
                return parseMdxBody({ body, },);
              },
            },);

            expect(raw,).toBeInstanceOf(RangeError,);
            expect(refusal,).toBeInstanceOf(MdxParseError,);
            expect(String(refusal,),).toBe(
              'MdxParseError: MDX body refused to parse because it is nested too deeply to read: the parser '
                + `exhausted its stack${REFUSAL_ENDING}`,
            );
            expect(Error.isError(refusal,) ? refusal.cause : undefined,).toBeInstanceOf(RangeError,);
          },
        },),
        it({
          name: 'REFUSES a body nested 257 quotation markers deep before plain markdown reads it, as a RangeError '
            + 'of its own class naming the place',
          fn: async () => {
            /**
             What plain markdown throws on a body one marker past the bound.
             */
            const refusal = caught(function parseTooDeep(): void {
              parseMarkdownBody({ body: `${'>'.repeat(257,)} cat`, },);
            },);

            expect(refusal,).toBeInstanceOf(MarkdownParseError,);
            expect(refusal,).toBeInstanceOf(RangeError,);
            expect(String(refusal,),).toBe(
              'MarkdownParseError: Plain markdown body refused to parse because it is nested too deeply to read: '
                + 'its container markers pass the bound of 256 at line 1, column 257.',
            );
          },
        },),
        it({
          name: 'READS a body nested 256 quotation markers deep under plain markdown, the last depth the bound allows',
          fn: async () => {
            expect(parseMarkdownBody({ body: `${'>'.repeat(256,)} cat`, },).children
              .map(function kindOf(node,): string {
                return node.type;
              },),).toEqual(['blockquote',],);
          },
        },),
        it({
          name: 'READS 300 open tags and 300 open braces under plain markdown, which nests over neither',
          fn: async () => {
            expect(parseMarkdownBody({ body: `${'<div>'.repeat(300,)}cat`, },).children.length,).toBe(1,);
            expect(parseMarkdownBody({ body: `${'{'.repeat(300,)}1`, },).children.length,).toBe(1,);
          },
        },),
        it({
          name: 'REFUSES plain markdown that exhausts the stack from a shallow text, with the exhaustion as its cause, '
            + 'where the raw parser throws the engine\'s RangeError itself',
          fn: async () => {
            /**
             Text well under the bound, so only the stack left decides it.
             */
            const body = `${'>'.repeat(200,)} cat`;
            /**
             What the parser alone throws from the edge of the stack.
             */
            const raw = caughtAtStackEdge({
              run: function parseRaw(): unknown {
                return unified()
                  .use(remarkParse,)
                  .use(remarkGfm,)
                  .parse(body,);
              },
            },);
            /**
             What plain markdown throws from the edge of the stack.
             */
            const refusal = caughtAtStackEdge({
              run: function parseLoosely(): unknown {
                return parseMarkdownBody({ body, },);
              },
            },);

            expect(raw,).toBeInstanceOf(RangeError,);
            expect(raw,).not.toBeInstanceOf(MarkdownParseError,);
            expect(refusal,).toBeInstanceOf(MarkdownParseError,);
            expect(String(refusal,),).toBe(
              'MarkdownParseError: Plain markdown body refused to parse because it is nested too deeply to read: '
                + 'the parser exhausted its stack.',
            );
            expect(Error.isError(refusal,) ? refusal.cause : undefined,).toBeInstanceOf(RangeError,);
          },
        },),
      ],
    },),
  ],
},);

//endregion MDX refusal disclosure tests
