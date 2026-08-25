/**
 * Tests that an MDX refusal says where the grammar stopped, never what it read.
 *
 * MDX IS THE NEAR MISS, and that is why these cases exist at all. Four of five
 * measured failure shapes report a position and an expectation and quote
 * nothing, so a single-case probe reports this module as already safe. The
 * fifth, an unclosed tag, puts the tag NAME from the source into its reason,
 * and `parse-document.ts` used to stringify that straight into a stored
 * finding.
 *
 * The control below is what keeps the absence assertions honest: it asserts the
 * RAW parser does quote, on the same fixture, before anything asserts that the
 * wrapper does not.
 *
 * Fixture wording is cat-themed invention, so no corpus content appears here.
 *
 * @module
 */

import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified, } from 'unified';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  MdxParseError,
  namesWithoutQuoting,
  parseMdxBody,
} from '../dist/final/node/index.mjs';

//region MDX refusal disclosure tests

/**
 * Tag name appearing nowhere else in this file, so an assertion of absence
 * cannot pass by accident.
 */
const FIXTURE_TAG = 'Tuftmallow';

/**
 * Body whose only fault is an unclosed tag, which is the shape that quotes.
 *
 * MEASURED: this refuses at `1:1` under `mdast-util-mdx-jsx/end-tag-mismatch`,
 * and the raw reason reproduces the tag name.
 */
const REFUSING_BODY = `<${FIXTURE_TAG}>\n\nbody\n`;

/**
 * Reads what the MDX grammar says with nothing between it and a reader.
 *
 * BUILDS THE SAME PIPELINE `parse-mdx.ts` builds, deliberately, rather than
 * calling the wrapper: a control that went through the wrapper would measure
 * the wrapper, which is the thing under test.
 *
 * @returns Parser's own reason for refusing
 *
 * @throws {@link Error} where the control fixture parsed, which would leave the
 * absence assertions unproven
 *
 * @example
 * ```ts
 * expect(rawMdxRefusal().includes(FIXTURE_TAG,),).toBe(true,);
 * ```
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
 * Parses a body that must refuse, handing the refusal back to be read.
 *
 * @returns Refusal the parser raised
 *
 * @throws {@link Error} where the fixture parsed, which would mean it no longer
 * exercises anything
 *
 * @example
 * ```ts
 * const refusal = mdxRefusal();
 * ```
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

await describe({
  name: 'MdxParseError says where, never what',
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
         * Refusal as a reader would see it.
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
         * Refusal as a reader would see it.
         */
        const refusal = mdxRefusal();

        expect(refusal.message.includes('at 1:1',),).toBe(true,);
        expect(
          refusal.message.includes('mdast-util-mdx-jsx/end-tag-mismatch',),
        ).toBe(true,);
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
         * Refusal as a reader would see it.
         */
        const refusal = mdxRefusal();

        expect(namesWithoutQuoting(refusal,),).toBe(true,);
      },
    },),
  ],
},);

//endregion MDX refusal disclosure tests
