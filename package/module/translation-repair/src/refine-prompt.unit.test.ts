/**
 * Tests for the rewriter sheet.
 *
 * `buildRefineMessages` had no test, and it carries more weight than the
 * editor's prompt. The editor works from issues a panel already accepted, and
 * checkers afterwards prove each one gone. Refinement has no accepted issue
 * behind it, and on a slice with no accepted issues at all, nothing downstream
 * re-examines the meaning either. So the sheet's structure is the thing
 * standing between an unnecessary rewrite and shipped text.
 *
 * The fence cases are the point. Both the original chunk and every paragraph
 * are interpolated between fences, so a fixed fence is forgeable: enclosed text
 * carrying a line of the fence character would close its own block early and
 * the rest of that paragraph would read to the model as instructions. The old
 * fixed value was `=====`, which is ordinary Markdown, a setext heading
 * underline, so this is a shape real documents contain.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildRefineMessages,
  type EditableEnvelope,
  hashContent,
  messageText,
} from '../dist/final/node/index.mjs';

/**
 * Builds one eligible paragraph.
 *
 * @param baseText - paragraph text the sheet shows
 *
 * @param index - position, so ids differ
 *
 * @returns Envelope in prompt numbering order
 *
 * @example
 * ```ts
 * const envelope = paragraph({ baseText: 'The cat naps.', index: 0, },);
 * ```
 */
function paragraph(
  {
    baseText,
    index,
  }: {
    readonly baseText: string;
    readonly index: number;
  },
): EditableEnvelope {
  return {
    envelopeId: `paragraph/${String(index,)}`,
    startOffset: 0,
    endOffset: baseText.length,
    baseText,
    baseHash: hashContent({ content: baseText, },),
    issueIds: [],
  };
}

/**
 * Reads the user message, which is where all enclosed content lives.
 *
 * @param plan - built prompt plan
 *
 * @returns User message content
 *
 * @example
 * ```ts
 * const sheet = userSheet({ plan, },);
 * ```
 */
function userSheet({ plan, }: { readonly plan: ReturnType<typeof buildRefineMessages>; },): string {
  return plan.messages
    .filter(function isUser(message,) {
      return message.role === 'user';
    },)
    .map(function toContent(message,) {
      return messageText({ message, },);
    },)
    .join('\n',);
}

await describe({
  name: buildRefineMessages.name,
  children: [
    it({
      name: 'numbers paragraphs from one in document order and returns the '
        + 'same envelopes in that order, so a reply\'s numbers resolve against '
        + 'exactly what was shown',
      fn: async () => {
        /**
         * Sheet over two paragraphs.
         */
        const plan = buildRefineMessages({
          sourceText: '猫猫在窗台上睡觉。',
          envelopes: [
            paragraph({
              baseText: 'The cat naps on the windowsill.',
              index: 0,
            },),
            paragraph({
              baseText: 'She wakes when the sun moves.',
              index: 1,
            },),
          ],
        },);

        /**
         * User-facing sheet content.
         */
        const sheet = userSheet({ plan, },);

        expect(sheet,).toContain('PARAGRAPH 1',);
        expect(sheet,).toContain('PARAGRAPH 2',);
        expect(sheet.indexOf('PARAGRAPH 1',),).toBeLessThan(sheet.indexOf('PARAGRAPH 2',),);
        expect(plan.envelopes.map(function toId(envelope,) {
          return envelope.envelopeId;
        },),).toStrictEqual([
          'paragraph/0',
          'paragraph/1',
        ],);
      },
    },),

    it({
      name: 'CHOOSES A FENCE LONGER than any run inside a paragraph, so a '
        + 'paragraph carrying the old fixed fence cannot close its own block '
        + 'and turn the rest of itself into instructions',
      fn: async () => {
        /**
         * Paragraph carrying a line of the fence character.
         */
        const hostile = 'The cat naps.\n=====\nAnd then she wakes.';

        /**
         * Sheet built around that paragraph.
         */
        const sheet = userSheet({
          plan: buildRefineMessages({
            sourceText: '猫猫在窗台上睡觉。',
            envelopes: [
              paragraph({
                baseText: hostile,
                index: 0,
              },),
            ],
          },),
        },);

        // The paragraph survives whole.
        expect(sheet,).toContain(hostile,);
        // And no line of the sheet equals the run the paragraph carried, which
        // is what a forged boundary would look like.
        expect(
          sheet.split('\n',).some(function isForgedBoundary(line,) {
            return line === '=====';
          },),
        ).toBe(true,);
        // The real fence is strictly longer, so the forged line closes nothing.
        expect(
          sheet.split('\n',).some(function isRealFence(line,) {
            return (line.length > '====='.length)
              && (line.replaceAll('=', '',) === '');
          },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'chooses the fence against the SOURCE text too, since the original '
        + 'chunk is fenced in the same sheet and a setext heading in the '
        + 'Chinese would otherwise close the original block early',
      fn: async () => {
        /**
         * Original carrying a setext heading underline.
         */
        const hostileSource = '标题\n=====\n猫猫在窗台上睡觉。';

        /**
         * Sheet built around that original.
         */
        const sheet = userSheet({
          plan: buildRefineMessages({
            sourceText: hostileSource,
            envelopes: [
              paragraph({
                baseText: 'The cat naps on the windowsill.',
                index: 0,
              },),
            ],
          },),
        },);

        expect(sheet,).toContain(hostileSource,);
        expect(
          sheet.split('\n',).some(function isLongerFence(line,) {
            return (line.length > '====='.length)
              && (line.replaceAll('=', '',) === '');
          },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'grows the fence past the LONGEST run anywhere in the sheet, not '
        + 'just past the first one found, so one paragraph cannot be fenced '
        + 'against while another escapes',
      fn: async () => {
        /**
         * Sheet where a later paragraph carries a longer run than an earlier.
         */
        const sheet = userSheet({
          plan: buildRefineMessages({
            sourceText: '猫猫在窗台上睡觉。',
            envelopes: [
              paragraph({
                baseText: 'The cat naps.\n=====\nShe wakes.',
                index: 0,
              },),
              paragraph({
                baseText: 'She chases butterflies.\n==========\nShe loves them.',
                index: 1,
              },),
            ],
          },),
        },);

        /**
         * Longest all-equals line in the sheet, which must be the fence.
         */
        const longestRun = Math.max(...sheet.split('\n',)
          .filter(function isEqualsLine(line,) {
            return (line.length > 0)
              && (line.replaceAll('=', '',) === '');
          },)
          .map(function toLength(line,) {
            return line.length;
          },),);

        expect(longestRun,).toBeGreaterThan('=========='.length,);
      },
    },),

    it({
      name: 'omits the identity block entirely when the document declares no '
        + 'names, rather than emitting an empty labelled section a model would '
        + 'try to satisfy',
      fn: async () => {
        expect(
          userSheet({
            plan: buildRefineMessages({
              sourceText: '猫猫在窗台上睡觉。',
              envelopes: [
                paragraph({
                  baseText: 'The cat naps on the windowsill.',
                  index: 0,
                },),
              ],
            },),
          },),
        ).not.toContain('DECLARED NAMES',);
      },
    },),

    it({
      name: 'includes declared names when the document has them, since the '
        + 'sheet instructs that handles survive a rewrite exactly and the '
        + 'rewriter cannot honor that without seeing them',
      fn: async () => {
        expect(
          userSheet({
            plan: buildRefineMessages({
              sourceText: '猫猫在窗台上睡觉。',
              envelopes: [
                paragraph({
                  baseText: 'Mittens naps on the windowsill.',
                  index: 0,
                },),
              ],
              identityContext: 'Mittens (@mittens_the_cat)',
            },),
          },),
        ).toContain('Mittens (@mittens_the_cat)',);
      },
    },),

    it({
      name: 'builds a sheet with no paragraph blocks when nothing was '
        + 'eligible, rather than throwing, since an ineligible slice is an '
        + 'ordinary outcome the lane skips',
      fn: async () => {
        /**
         * Plan over an empty envelope list.
         */
        const plan = buildRefineMessages({
          sourceText: '猫猫在窗台上睡觉。',
          envelopes: [],
        },);

        expect(plan.envelopes,).toStrictEqual([],);
        expect(userSheet({ plan, },),).not.toContain('PARAGRAPH 1',);
      },
    },),

    it({
      name: 'keeps the leave-it-alone instruction in the system message, which '
        + 'is the main thing standing between an unnecessary rewrite and '
        + 'shipped text on a slice nothing downstream re-examines',
      fn: async () => {
        /**
         * System message of a plain sheet.
         */
        const system = buildRefineMessages({
          sourceText: '猫猫在窗台上睡觉。',
          envelopes: [
            paragraph({
              baseText: 'The cat naps on the windowsill.',
              index: 0,
            },),
          ],
        },)
          .messages
          .filter(function isSystem(message,) {
            return message.role === 'system';
          },)
          .map(function toContent(message,) {
            return messageText({ message, },);
          },)
          .join('\n',);

        expect(system,).toContain('leave it out of your reply entirely',);
        expect(system,).toContain('Returning an empty list is a correct and common answer',);
      },
    },),
  ],
},);
