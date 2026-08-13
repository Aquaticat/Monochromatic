/**
 * Tests for seating judges that did not propose the claim they judge.
 *
 * The cases that matter are the two that would produce a confident wrong
 * number: a claim every seated model proposed, which must be reported rather
 * than dropped, and a rate over a population too small to carry one.
 *
 * Model ids are the real roster, since the rule under test is about the
 * relationship between authorship and the seats available. No corpus text is
 * involved.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  MIN_JUDGED_CLAIMS,
  renderJudgedRate,
  seatJudges,
} from '../../dist/final/node/index.mjs';

/**
 * Roster the seatings run against, which is the shipped one.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.2',
  'hf:zai-org/GLM-4.7-Flash',
  'hf:Qwen/Qwen3.6-27B',
  'hf:moonshotai/Kimi-K3',
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  'hf:openai/gpt-oss-120b',
] as const;

await describe({
  name: seatJudges.name,
  children: [
    it({
      name: 'bars the single proposer and seats the rest, which is the common '
        + 'case: attribution measured sole=10 against multi=7, so most claims '
        + 'leave five of six models free to re-examine them',
      fn: async () => {
        /**
         * Claim raised by one critic.
         */
        const seating = seatJudges({
          proposers: ['hf:moonshotai/Kimi-K3',],
          roster: ROSTER,
        },);

        expect(seating.judges,).toHaveLength(5,);
        expect(seating.judges,).not.toContain('hf:moonshotai/Kimi-K3',);
        expect(seating.barred,).toStrictEqual(['hf:moonshotai/Kimi-K3',],);
        expect(seating.judgeable,).toBe(true,);
      },
    },),

    it({
      name: 'bars EVERY proposer when several critics agreed, since agreement '
        + 'makes a claim better supported without making any of its authors '
        + 'disinterested about it',
      fn: async () => {
        /**
         * Claim three critics raised.
         */
        const seating = seatJudges({
          proposers: [
            'hf:moonshotai/Kimi-K3',
            'hf:zai-org/GLM-5.2',
            'hf:openai/gpt-oss-120b',
          ],
          roster: ROSTER,
        },);

        expect(seating.judges,).toHaveLength(3,);
        expect(seating.barred,).toHaveLength(3,);
      },
    },),

    it({
      name: 'reports a claim NOBODY may judge as unjudgeable rather than '
        + 'returning an empty roster a caller might read as "no objections". '
        + 'Dropping it would shrink the denominator and lift every rate above '
        + 'it while looking entirely ordinary, which is a defect already found '
        + 'and fixed once in the attribution reader',
      fn: async () => {
        /**
         * Claim every seated model proposed.
         */
        const seating = seatJudges({
          proposers: [...ROSTER,],
          roster: ROSTER,
        },);

        expect(seating.judges,).toHaveLength(0,);
        expect(seating.judgeable,).toBe(false,);
        expect(seating.barred,).toHaveLength(ROSTER.length,);
      },
    },),

    it({
      name: 'ignores a proposer that is not on the judging roster rather than '
        + 'throwing, since a roster may legitimately shrink between the run '
        + 'that recorded the claim and the crosscheck that re-examines it',
      fn: async () => {
        expect(seatJudges({
          proposers: ['hf:someone/Retired-1',],
          roster: ROSTER,
        },).judges,).toHaveLength(ROSTER.length,);
      },
    },),

    it({
      name: 'keeps ROSTER ORDER in both lists, so two readings of the same run '
        + 'render identically and a diff between them means something changed',
      fn: async () => {
        expect(seatJudges({
          proposers: [
            'hf:openai/gpt-oss-120b',
            'hf:zai-org/GLM-5.2',
          ],
          roster: ROSTER,
        },).barred,).toStrictEqual([
          'hf:zai-org/GLM-5.2',
          'hf:openai/gpt-oss-120b',
        ],);
      },
    },),
  ],
},);

await describe({
  name: renderJudgedRate.name,
  children: [
    it({
      name: 'REFUSES to render a rate under the minimum population, naming how '
        + 'far short it is. The eligible population on 2026-08-13 was 2 entries '
        + 'and 17 chunks, and a rate over that reads exactly like a rate over a '
        + 'thousand',
      fn: async () => {
        expect(renderJudgedRate({
          count: 3,
          judged: 4,
          digits: 2,
        },),).toBe(`n/a (4 of ${String(MIN_JUDGED_CLAIMS,)} needed)`,);
      },
    },),

    it({
      name: 'renders a rate once the population carries one',
      fn: async () => {
        expect(renderJudgedRate({
          count: 20,
          judged: 40,
          digits: 2,
        },),).toBe('0.50',);
      },
    },),

    it({
      name: 'reports INCONSISTENT when the numerator exceeds the denominator, '
        + 'rather than a rate above one. More judgements than judged claims is '
        + 'a contradiction in the record, and dividing it would hide that',
      fn: async () => {
        expect(renderJudgedRate({
          count: 50,
          judged: 40,
          digits: 2,
        },),).toBe('INCONSISTENT',);
      },
    },),

    it({
      name: 'reports INCONSISTENT rather than n/a when a nonzero count sits '
        + 'over a zero denominator, so an empty population and a broken join '
        + 'stay distinguishable',
      fn: async () => {
        expect(renderJudgedRate({
          count: 1,
          judged: 0,
          digits: 2,
        },),).toBe('INCONSISTENT',);
      },
    },),
  ],
},);
