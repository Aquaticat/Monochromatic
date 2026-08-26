/**
 * Tests for the resolution checker sheet and the verdict guard:
 * issue ids bind by sheet number, claim lines render per issue, both
 * documents fence verbatim, and only listed verdicts pass the guard.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type AdjudicatedIssue,
  buildResolutionMessages,
  hashContent,
  isResolutionVerdict,
  messageText,
  RESOLUTION_VERDICTS,
} from '../dist/final/node/index.mjs';

/**
 * Accepted issue whose fix the checkers must confirm.
 */
const NAP_ISSUE: AdjudicatedIssue = {
  issueId: 'issue/whisker',
  status: 'accepted',
  severity: 'major',
  claims: [
    {
      claimId: 'issue/whisker',
      claim: {
        category: 'accuracy/mistranslation',
        severity: 'major',
        summary: 'Napping is rendered as hunting.',
        spans: [
          {
            side: 'target',
            nodeId: 'block/1',
            nodeHash: hashContent({ content: 'The cat hunts at noon.', },),
            startOffset: 4,
            endOffset: 9,
            quotedText: 'hunts',
          },
        ],
      },
    },
  ],
  tallies: {},
};

await describe({
  name: '',
  children: [
    describe({
      name: buildResolutionMessages.name,
      children: [
        it({
          name: 'binds issue ids in sheet order and renders claim lines',
          fn: async () => {
            const plan = buildResolutionMessages({
              sourceText: '猫猫在中午打盹。',
              patchedText: 'The cat naps at noon.',
              issues: [NAP_ISSUE,],
            },);
            expect(plan.issueIds,).toEqual(['issue/whisker',],);

            /**
             * User sheet carrying documents and issue blocks.
             */
            const sheet = plan.messages[1]?.content ?? '';
            expect(sheet,).toContain('ISSUE 1',);
            expect(sheet,).toContain(
              '- (accuracy/mistranslation, major): Napping is rendered as hunting.',
            );
          },
        },),
        it({
          name: 'fences the original beside the revised translation',
          fn: async () => {
            const plan = buildResolutionMessages({
              sourceText: '猫猫在中午打盹。',
              patchedText: 'The cat naps at noon.',
              issues: [NAP_ISSUE,],
            },);

            /**
             * User sheet carrying the fenced pair.
             */
            const sheet = plan.messages[1]?.content ?? '';
            expect(sheet,).toContain('ORIGINAL',);
            expect(sheet,).toContain('猫猫在中午打盹。',);
            expect(sheet,).toContain('REVISED TRANSLATION',);
            expect(sheet,).toContain('The cat naps at noon.',);
          },
        },),
      ],
    },),
    describe({
      name: isResolutionVerdict.name,
      children: [
        ...RESOLUTION_VERDICTS.map(function toCase(verdict,) {
          return it({
            name: `admits ${verdict}`,
            fn: async () => {
              expect(isResolutionVerdict(verdict,),).toBe(true,);
            },
          },);
        },),
        it({
          name: 'rejects unlisted strings and non-strings',
          fn: async () => {
            expect(isResolutionVerdict('pounced',),).toBe(false,);
            expect(isResolutionVerdict(1,),).toBe(false,);
          },
        },),
      ],
    },),
  ],
},);

/**
 * Original carrying a row of five equals signs, the fence the builder once
 * used, on a line of its own.
 */
const RULED_SOURCE = '第一行。\n=====\n第二行。';

/**
 * User message of a plan, as text.
 *
 * @param messages - messages the builder returned
 *
 * @returns Last message's text
 *
 * @throws {@link Error} when the builder returned no message
 *
 * @example
 * ```ts
 * const content = userText({ messages, },);
 * ```
 */
function userText({ messages, }: { readonly messages: readonly ChatMessage[]; },): string {
  /**
   * Last message, which is the user turn.
   */
  const asked = messages.at(-1,);
  if (asked === undefined)
    throw new Error('the builder returned no message',);
  return messageText({ message: asked, },);
}

await describe({
  name: 'fence choice',
  children: [
    it({
      name: 'FENCES the blocks with a delimiter the enclosed text cannot reproduce, so a passage holding a row '
        + 'of five equals signs cannot close its own block and turn what follows into instructions',
      fn: async () => {
        const content = userText({ messages: buildResolutionMessages({ sourceText: RULED_SOURCE, patchedText: 'Line one.', issues: [], },).messages, },);

        expect(content.includes('====== ORIGINAL ======',),).toBe(true,);
        expect(content.includes('\n===== ',),).toBe(false,);
        expect(content.includes(RULED_SOURCE,),).toBe(true,);
      },
    },),
  ],
},);
