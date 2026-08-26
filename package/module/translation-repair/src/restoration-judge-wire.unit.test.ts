/**
 * Tests for the restoration judge sheet and the verdict guard:
 * seed ids bind by reference number, each deleted needle renders as a
 * numbered reference beside the repaired text, and only listed
 * verdicts pass the guard.
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
  buildRestorationJudgeMessages,
  isRestorationVerdict,
  messageText,
  RESTORATION_JUDGE_VERDICTS,
} from '../dist/final/node/index.mjs';

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
        it({
          name: 'CARRIES the house rules onto a grader anchored on the Chinese',
          fn: async () => {
            // The 2026-07-17 directive anchors this grade on the source, and an
            // anchor on the source is exactly what makes completeness bias
            // possible: a repair rendered vaguer than the Chinese because
            // reader protection asks for it reads as partial restoration. The
            // block does not move the anchor, it says what a shortfall is.
            const plan = buildRestorationJudgeMessages({
              sourceText: SOURCE_TEXT,
              repairedText: REPAIRED_TEXT,
              references: REFERENCES,
            },);

            /**
             * Standing rules half of the exchange.
             */
            const system = plan.messages[0]?.content ?? '';
            expect(system,).toContain('Reader protection outranks completeness',);
            expect(system,).toContain('Chinese marks no tense',);
            expect(system,).toContain('is restored rather than partial',);
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
        const content = userText({ messages: buildRestorationJudgeMessages({ sourceText: RULED_SOURCE, repairedText: 'Line one.', references: [], },).messages, },);

        expect(content.includes('====== ORIGINAL ======',),).toBe(true,);
        expect(content.includes('\n===== ',),).toBe(false,);
        expect(content.includes(RULED_SOURCE,),).toBe(true,);
      },
    },),
  ],
},);
