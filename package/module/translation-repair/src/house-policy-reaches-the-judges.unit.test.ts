/**
 * Tests that the stages deciding what SHIPS are told what this corpus is
 * written under.
 *
 * WHY THIS FILE EXISTS. Every producing sheet splices `HOUSE_POLICY_BLOCK`, and
 * for a long time no judging sheet did. The judges were therefore the only
 * stages that had never been told about reader protection, while criterion one
 * asks them for every proposition of the original with nothing left out. A
 * candidate keeping a suicide method vague, exactly as the corpus's own rule
 * demands, reads as an omission to a judge with only the numbered list.
 *
 * AND THE TENSE HALF, which was measured rather than imagined. Of the four
 * slates a judge refused ENTIRELY on the consolidation bed, three were refused
 * over tense, one saying every candidate had altered the time reference by
 * rendering a tenseless Chinese copula in the past. The rule that answers that
 * lived in the critic's sheet and reached no judge.
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

import { buildCandidateSelectMessages, } from '../dist/final/node/index.mjs';

/**
 * System half of one judge exchange, which is where standing rules live.
 */
const system = buildCandidateSelectMessages({
  task: 'Each candidate is a rendering of the passage below.',
  criteria: ['Complete coverage: every proposition of the ORIGINAL is rendered, nothing left out.',],
  evidence: [
    {
      label: 'ORIGINAL (Chinese)',
      text: '猫在窗台上睡觉。',
    },
  ],
  rendered: ['The cat sleeps on the windowsill.', 'The cat naps on the sill.',],
},)
  .filter(function isSystem(message,): boolean {
    return message.role === 'system';
  },)
  .map(function toContent(message,): string {
    return message.content;
  },)
  .join('\n',);

await describe({
  name: 'house policy reaches the judges',
  children: [
    it({
      name: 'TELLS a judge that reader protection outranks completeness',
      fn: async () => {
        // The contradiction this closes: criterion one asks for every
        // proposition, and the corpus deliberately keeps some of them vague.
        expect(system.includes('Reader protection outranks completeness',),).toBe(true,);
      },
    },),
    it({
      name: 'RANKS a house rule above a numbered criterion',
      fn: async () => {
        // Judges apply the numbered list literally: three whole-slate refusals
        // were measured doing exactly that, so precedence has to be stated
        // rather than implied by adjacency.
        expect(system.includes('THE HOUSE RULE WINS',),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES to let a forced tense count as a change of time',
      fn: async () => {
        // Chinese marks no tense and English cannot avoid one, so the choice is
        // required rather than added.
        expect(system.includes('Chinese marks no tense',),).toBe(true,);
        expect(system.includes('never a change to the time',),).toBe(true,);
      },
    },),
    it({
      name: 'KEEPS the criteria ahead of the policy in the sheet',
      fn: async () => {
        // The criteria decide; the policy qualifies them. A block arriving
        // first reads as the task.
        const criteria = system.indexOf('Complete coverage',);
        const policy = system.indexOf('Reader protection outranks completeness',);
        expect(criteria,).toBeGreaterThan(-1,);
        expect(policy,).toBeGreaterThan(criteria,);
      },
    },),
  ],
},);
