/**
 * Tests for the resolution checker sheet and the verdict guard:
 * issue ids bind by sheet number, claim lines render per issue, both
 * documents fence verbatim, and only listed verdicts pass the guard.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import { hashContent, } from './document-node.ts';
import {
  buildResolutionMessages,
  isResolutionVerdict,
  RESOLUTION_VERDICTS,
} from './resolution-wire.ts';

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
