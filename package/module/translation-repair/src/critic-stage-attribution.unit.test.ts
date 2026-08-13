/**
 * Tests for the WIRING that keeps each critic's identity attached to the claim
 * it raised, as opposed to the fold that counts them once they are attached.
 *
 * `collectClaimAttributions` is tested on its own, and passing those cases
 * proves nothing about whether `runCriticStage` ever calls it with real
 * emissions. Measured: deleting the single `emissions.push` in
 * `runCriticStage` left the whole suite green, so the exact discard this work
 * exists to fix was reintroducible without any test noticing. These cases close
 * that, and they are the ones a future edit has to keep passing.
 *
 * That hole is the same shape as the defect it followed: the stage-call cases
 * asserted only that a voice was LOST and never read what the loss recorded,
 * which is how an uninformative warning survived having tests.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  computeIssueClaimId,
  parseDocument,
  runCriticStage,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the stage under test.
 */
const l = tagged({ tag: 'critic-stage-attribution-test', },);

/**
 * Original chunk the critics review.
 */
const SOURCE_TEXT = '猫猫喜欢晒太阳，也喜欢追蝴蝶。\n\n猫猫会打呼噜。\n';

/**
 * Translation chunk under review, missing the butterfly clause.
 */
const TARGET_TEXT = 'The cat likes to nap in the sun.\n\nThe cat purrs.\n';

/**
 * Parsed pair the claims anchor against.
 */
const DOCUMENTS = {
  source: parseDocument({ text: SOURCE_TEXT, },),
  target: parseDocument({ text: TARGET_TEXT, },),
};

/**
 * Two critics, enough to tell independent support from self-repetition.
 */
const CRITICS = [
  'hf:openai/gpt-oss-120b',
  'hf:zai-org/GLM-5.2',
] as const;

/**
 * Wire issue whose quotes both anchor, so resolution succeeds.
 */
const ANCHORING_WIRE = {
  category: 'accuracy/omission',
  severity: 'major',
  summary: '追蝴蝶那句没有翻译。',
  sourceQuote: '也喜欢追蝴蝶',
  targetQuote: 'The cat likes to nap in the sun.',
};

/**
 * Wire issue quoting text that appears in neither document, so resolution
 * fails and it must contribute no attribution.
 */
const UNANCHORABLE_WIRE = {
  category: 'accuracy/omission',
  severity: 'major',
  summary: 'A clause about kneading is missing.',
  sourceQuote: '猫猫踩奶',
  targetQuote: 'The cat kneads the blanket.',
};

/**
 * Client answering each critic with a scripted report.
 *
 * @param reportFor - report each model returns, chosen by model id
 *
 * @returns Client honoring that script
 *
 * @example
 * ```ts
 * const client = criticClient({ reportFor: () => ({ issues: [], }), },);
 * ```
 */
function criticClient(
  {
    reportFor,
  }: {
    readonly reportFor: (modelId: string,) => unknown;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Scripted report for the answering model.
       */
      const scripted = reportFor(request.modelId,);
      if (!request.validate(scripted,))
        throw new Error('scripted report failed the critic guard',);
      return {
        kind: 'ok',
        value: scripted,
        rawText: JSON.stringify(scripted,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused',);
    },
  };
}

/**
 * Runs the critic stage against a scripted client.
 *
 * @param reportFor - report each model returns
 *
 * @returns Stage result including its attribution
 *
 * @example
 * ```ts
 * const critic = await runStage({ reportFor: () => ({ issues: [], }), },);
 * ```
 */
async function runStage(
  {
    reportFor,
  }: {
    readonly reportFor: (modelId: string,) => unknown;
  },
) {
  return await runCriticStage({
    client: criticClient({ reportFor, },),
    criticModelIds: [...CRITICS,],
    sourceText: SOURCE_TEXT,
    targetText: TARGET_TEXT,
    documents: DOCUMENTS,
    signal: new AbortController().signal,
    perCallTimeoutMs: 1_000,
    l,
  },);
}

await describe({
  name: `${runCriticStage.name} attribution`,
  children: [
    it({
      name: 'CARRIES the speaker through resolution, so two critics raising '
        + 'the same defect are recorded as two proposers of one claim. Without '
        + 'this the stage returns no attribution at all, which is the exact '
        + 'discard this work exists to fix and which no other case detects',
      fn: async () => {
        /**
         * Stage result where both critics raise the identical issue.
         */
        const critic = await runStage({
          reportFor: () => ({ issues: [ANCHORING_WIRE,], }),
        },);

        expect(critic.claimAttributions,).toHaveLength(1,);
        expect(critic.claimAttributions[0]?.proposers,).toHaveLength(2,);
        expect(
          critic.claimAttributions[0]?.proposers
            .map(function toId(proposer,) {
              return proposer.modelId;
            },),
        ).toStrictEqual([...CRITICS,].toSorted(),);
      },
    },),

    it({
      name: 'keys attribution by the id computed over the RESOLVED claim, not '
        + 'the wire issue, so the key matches what downstream stages hold: the '
        + 'deterministic identity is defined over anchored spans that only '
        + 'exist after resolution. The stage itself does NOT deduplicate, so '
        + 'two critics leave two identical claims here while attribution has '
        + 'already collapsed to the one id they share, which is exactly why it '
        + 'must be collected before aggregateClaims runs',
      fn: async () => {
        /**
         * Stage result where both critics raise the identical issue.
         */
        const critic = await runStage({
          reportFor: () => ({ issues: [ANCHORING_WIRE,], }),
        },);

        expect(critic.claims,).toHaveLength(2,);
        expect(critic.claimAttributions,).toHaveLength(1,);
        for (const claim of critic.claims)
          expect(critic.claimAttributions[0]?.claimId,)
            .toBe(computeIssueClaimId({ claim, },),);
      },
    },),

    it({
      name: 'records ONE proposer with an emission count of two when a single '
        + 'critic repeats itself while the other stays silent, since crediting '
        + 'that as two proposers would manufacture independent support the '
        + 'ensemble never had',
      fn: async () => {
        /**
         * Stage result where one critic double-reports and one says nothing.
         */
        const critic = await runStage({
          reportFor: (modelId,) => ((modelId === CRITICS[0])
            ? { issues: [ANCHORING_WIRE, ANCHORING_WIRE,], }
            : { issues: [], }),
        },);

        expect(critic.claimAttributions,).toHaveLength(1,);
        expect(critic.claimAttributions[0]?.proposers,).toHaveLength(1,);
        expect(critic.claimAttributions[0]?.proposers[0]?.modelId,)
          .toBe(CRITICS[0],);
        expect(critic.claimAttributions[0]?.proposers[0]?.emissionCount,)
          .toBe(2,);
      },
    },),

    it({
      name: 'attributes NOTHING for an issue whose quotes do not anchor, '
        + 'because a claim the pipeline discarded must not count toward any '
        + 'critic\'s recorded hits, and resolution failure is the commonest '
        + 'way a claim is discarded',
      fn: async () => {
        /**
         * Stage result where every issue fails to resolve.
         */
        const critic = await runStage({
          reportFor: () => ({ issues: [UNANCHORABLE_WIRE,], }),
        },);

        expect(critic.claims,).toHaveLength(0,);
        expect(critic.claimAttributions,).toHaveLength(0,);
        expect(critic.findings.length,).toBeGreaterThan(0,);
      },
    },),
  ],
},);
