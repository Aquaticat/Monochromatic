/**
 * Tests for the restoration judge sheet and the verdict guard:
 * seed ids bind by reference number, each deleted needle renders as a
 * numbered reference beside the repaired text, and only listed
 * verdicts pass the guard.
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
  buildRestorationJudgeMessages,
  isRestorationVerdict,
  RESTORATION_JUDGE_VERDICTS,
} from '../dist/final/neutral/index.mjs';

/**
 * Invented zh source the judge anchors restoration against.
 */
const SOURCE_TEXT = '## 猫的日常\n\n小猫喜欢晒太阳。小猫也喜欢追蝴蝶。\n';

/**
 * Repaired translation under judgment.
 */
const REPAIRED_TEXT =
  '## A cat\'s day\n\nThe kitten loves sunbathing. The kitten also chases butterflies.\n';

/**
 * Deleted needles the judge checks for restoration.
 */
const REFERENCES = [
  {
    seedId: 'seed/omission-0',
    deletedText: 'The kitten also chases butterflies.',
  },
] as const;

await describe({
  name: '',
  children: [
    describe({
      name: buildRestorationJudgeMessages.name,
      children: [
        it({
          name: 'binds seed ids in reference-number order',
          fn: async () => {
            const plan = buildRestorationJudgeMessages({
              sourceText: SOURCE_TEXT,
              repairedText: REPAIRED_TEXT,
              references: REFERENCES,
            },);
            expect(plan.seedIds,).toEqual(['seed/omission-0',],);
          },
        },),
        it({
          name: 'shows source, repaired translation, and numbered references',
          fn: async () => {
            const plan = buildRestorationJudgeMessages({
              sourceText: SOURCE_TEXT,
              repairedText: REPAIRED_TEXT,
              references: REFERENCES,
            },);

            /**
             * User sheet carrying all three fenced sections.
             */
            const sheet = plan.messages[1]?.content ?? '';
            expect(sheet,).toContain(SOURCE_TEXT,);
            expect(sheet,).toContain('REPAIRED TRANSLATION',);
            expect(sheet,).toContain(REPAIRED_TEXT,);
            expect(sheet,).toContain('REFERENCE 1: The kitten also chases butterflies.',);
          },
        },),
      ],
    },),
    describe({
      name: isRestorationVerdict.name,
      children: [
        ...RESTORATION_JUDGE_VERDICTS.map(function toCase(verdict,) {
          return it({
            name: `admits ${verdict}`,
            fn: async () => {
              expect(isRestorationVerdict(verdict,),).toBe(true,);
            },
          },);
        },),
        it({
          name: 'rejects unlisted strings and non-strings',
          fn: async () => {
            expect(isRestorationVerdict('mostly-there',),).toBe(false,);
            expect(isRestorationVerdict(1,),).toBe(false,);
          },
        },),
      ],
    },),
  ],
},);
