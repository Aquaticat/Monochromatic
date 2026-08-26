/**
 * Tests for the panel prompt sheet builder and its index maps.
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
  buildAdjudicationMessages,
  type ClaimCluster,
  hashContent,
  messageText,
} from '../dist/final/node/index.mjs';

/**
 * Two clusters: a two-member group then a solo group,
 * numbering claims one through three.
 */
const CLUSTERS: readonly ClaimCluster[] = [
  {
    clusterId: 'cluster/nap',
    position: 5,
    members: [
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
              startOffset: 5,
              endOffset: 20,
              quotedText: 'hunts at noon',
            },
          ],
        },
      },
      {
        claimId: 'issue/paw',
        claim: {
          category: 'accuracy/omission',
          severity: 'minor',
          summary: 'The noon detail is dropped.',
          spans: [
            {
              side: 'target',
              nodeId: 'block/1',
              nodeHash: hashContent({ content: 'The cat hunts at noon.', },),
              startOffset: 12,
              endOffset: 12,
              quotedText: '',
            },
          ],
        },
      },
    ],
  },
  {
    clusterId: 'cluster/chase',
    position: 90,
    members: [
      {
        claimId: 'issue/tail',
        claim: {
          category: 'fluency/grammar',
          severity: 'minor',
          summary: 'Verb agreement slips in the chase sentence.',
          spans: [
            {
              side: 'source',
              nodeId: 'block/2',
              nodeHash: hashContent({ content: '猫猫追蝴蝶。', },),
              startOffset: 90,
              endOffset: 96,
              quotedText: '猫猫追蝴蝶。',
            },
          ],
        },
      },
    ],
  },
];

await describe({
  name: buildAdjudicationMessages.name,
  children: [
    it({
      name: 'requires a claim be checked against its own quoted evidence',
      fn: async () => {
        /** Panelist system instructions. */
        const system = buildAdjudicationMessages({
          sourceText: '猫猫在中午打盹。',
          targetText: 'The cat naps at noon.',
          clusters: CLUSTERS,
        },)
          .messages[0]
          ?.content ?? '';
        // A claim alleging an omission its own target quote contains survived
        // adjudication in the graded sample.
        expect(system,).toContain('check the claim against its OWN quoted evidence',);
        expect(system,).toContain('already carries it',);
        expect(system,).toContain('however confidently it is worded',);
      },
    },),
    it({
      name: 'numbers claims globally and maps ids in prompt order',
      fn: async () => {
        /** Plan for the two-cluster sheet. */
        const plan = buildAdjudicationMessages({
          sourceText: '猫猫在中午打盹，然后追蝴蝶。',
          targetText: 'The cat hunts at noon, then chases butterflies.',
          clusters: CLUSTERS,
        },);
        expect(plan.claimIds,).toEqual([
          'issue/whisker',
          'issue/paw',
          'issue/tail',
        ],);
        expect(plan.clusterIds,).toEqual(['cluster/nap', 'cluster/chase',],);
        /** Sheet text shown to the panelist. */
        const sheet = plan.messages[1]?.content ?? '';
        expect(sheet,).toContain('CLAIM 1',);
        expect(sheet,).toContain('CLAIM 2',);
        expect(sheet,).toContain('CLAIM 3',);
        expect(sheet,).toContain('GROUP 1',);
        expect(sheet,).toContain('GROUP 2',);
      },
    },),

    it({
      name: 'asks the same-defect question only for multi-member groups',
      fn: async () => {
        /** Plan for the two-cluster sheet. */
        const plan = buildAdjudicationMessages({
          sourceText: '原文',
          targetText: 'translation',
          clusters: CLUSTERS,
        },);
        /** Sheet text shown to the panelist. */
        const sheet = plan.messages[1]?.content ?? '';
        expect(sheet,).toContain('GROUP 1 (claims below may describe one defect; answer sameDefect)',);
        expect(sheet.includes('GROUP 2 (claims below',),).toBe(false,);
      },
    },),

    it({
      name: 'presents quoted evidence and insertion points distinctly',
      fn: async () => {
        /** Plan for the two-cluster sheet. */
        const plan = buildAdjudicationMessages({
          sourceText: '原文',
          targetText: 'translation',
          clusters: CLUSTERS,
        },);
        /** Sheet text shown to the panelist. */
        const sheet = plan.messages[1]?.content ?? '';
        expect(sheet,).toContain('- evidence (TRANSLATION): hunts at noon',);
        expect(sheet,).toContain('- evidence (TRANSLATION): insertion point, content claimed missing here',);
        expect(sheet,).toContain('- evidence (ORIGINAL): 猫猫追蝴蝶。',);
      },
    },),

    it({
      name: 'keeps proposer identity out of the sheet',
      fn: async () => {
        /** Plan for the two-cluster sheet. */
        const plan = buildAdjudicationMessages({
          sourceText: '原文',
          targetText: 'translation',
          clusters: CLUSTERS,
        },);
        /** Whole prompt joined for scanning. */
        const wholePrompt = plan
          .messages
          .map(function toContent(message,) {
            return messageText({ message, },);
          },)
          .join('\n',);
        expect(wholePrompt.includes('GLM',),).toBe(false,);
        expect(wholePrompt.includes('issue/',),).toBe(false,);
        expect(wholePrompt.includes('cluster/',),).toBe(false,);
      },
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
        const content = userText({ messages: buildAdjudicationMessages({ sourceText: RULED_SOURCE, targetText: 'Line one.', clusters: [], },).messages, },);

        expect(content.includes('====== ORIGINAL ======',),).toBe(true,);
        expect(content.includes('\n===== ',),).toBe(false,);
        expect(content.includes(RULED_SOURCE,),).toBe(true,);
      },
    },),
  ],
},);
