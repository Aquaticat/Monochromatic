/**
 * Tests for the end-to-end repair driver over a scripted stub client.
 * The stub discriminates stages by response-format schema name, so one
 * scripted client walks the whole loop without a network.
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
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type ChunkRepairOutcome,
  makeInsertionChunk,
  notApplicableFinding,
  prepareDocumentPair,
  repairPreparedDocument,
  type RepairModels,
  repairTranslation,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Original document of the fixture pair.
 */
const SOURCE_TEXT = `## 简介

猫猫喜欢在窗台上晒太阳。猫猫也喜欢追蝴蝶。
`;

/**
 * Translation with one planted mistranslation.
 */
const TARGET_TEXT = `## Introduction

The cat loves sunbathing on the windowsill. The cat hates butterflies.
`;

/**
 * Role roster; identities only matter as distinct voices.
 */
const MODELS: RepairModels = {
  criticModelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.6-27B', 'hf:moonshotai/Kimi-K3',],
  panelModelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.6-27B', 'hf:moonshotai/Kimi-K3',],
  editorModelIds: ['hf:zai-org/GLM-5.2',],
  judgeModelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.6-27B', 'hf:moonshotai/Kimi-K3',],
  checkerModelIds: ['hf:Qwen/Qwen3.6-27B', 'hf:moonshotai/Kimi-K3',],
};

/**
 * One-based sheet numbers 1 through count.
 */
function oneBasedNumbers(
  { count, }: { readonly count: number; },
): readonly number[] {
  return [...Array.from({ length: count, },).keys(),]
    .map(function toOneBased(index,) {
      return index + 1;
    },);
}

/**
 * Occurrences of one marker in the user prompt,
 * for scripting per-item replies without parsing the sheet.
 */
function countMarker(
  {
    request,
    marker,
  }: {
    readonly request: ChatJsonRequest<unknown>;
    readonly marker: string;
  },
): number {
  /**
   * User prompt content of the request.
   */
  const content = request.messages.at(-1,)?.content ?? '';

  return content.split(marker,).length - 1;
}

/**
 * Stub client scripted per stage; the schema name on the response format
 * names the stage.
 *
 * @param criticIssues - wire issues every critic reports, or a function
 * choosing issues per request so slices script differently
 *
 * @param checkerVerdict - verdict every checker casts on every issue
 *
 * @param proberVerdict - verdict every prober casts on every replaced region
 *
 * @param proberEvidence - wording every prober quotes as introduced damage;
 * the screen decides what it proves, so a quote lifted from the replacement
 * corroborates while one lifted from the baseline is contradicted
 *
 * @param proberOmittedText - wording every prober quotes as content the edit
 * dropped, checked in the opposite direction
 */
function scriptedClient(
  {
    criticIssues,
    checkerVerdict = 'fixed',
    proberVerdict = 'no-introduced-defect-found',
    proberEvidence = '',
    proberOmittedText = '',
  }: {
    readonly criticIssues:
      | readonly Record<string, unknown>[]
      | ((request: ChatJsonRequest<unknown>,) => readonly Record<string, unknown>[]);
    readonly checkerVerdict?: string;
    readonly proberVerdict?: string;
    readonly proberEvidence?: string;
    readonly proberOmittedText?: string;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by the repair pipeline',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Stage name from the structured-output constraint.
       */
      const stage = request.responseFormat?.json_schema.name ?? '';

      /**
       * Scripted wire reply for the stage.
       */
      const scripted: unknown = stage === 'critic_report'
        ? {
          issues: (typeof criticIssues) === 'function'
            ? criticIssues(request as ChatJsonRequest<unknown>,)
            : criticIssues,
        }
        : stage === 'panel_ballot'
        ? {
          verdicts: oneBasedNumbers({
            count: countMarker({ request, marker: '\nCLAIM ', },),
          },)
            .map(function toVerdict(claim,) {
              return {
                claim,
                vote: 'supported',
              };
            },),
        }
        : stage === 'editor_report'
        ? {
          edits: Array.from(
            { length: countMarker({ request, marker: 'REGION ', },) > 0 ? 1 : 0, },
            function toEdit() {
              return {
                region: 1,
                newText: 'The cat also loves chasing butterflies.',
              };
            },
          ),
        }
        : stage === 'resolution_report'
        ? {
          checks: oneBasedNumbers({
            count: countMarker({ request, marker: '\nISSUE ', },),
          },)
            .map(function toCheck(issue,) {
              return {
                issue,
                verdict: checkerVerdict,
              };
            },),
        }
        : stage === 'introduced_defect_report'
        ? {
          checks: oneBasedNumbers({
            // Counted as a fenced heading rather than a line start, because the
            // probe sheet chooses its fence against the enclosed text and so
            // has no fixed-width prefix to anchor on. The trailing space keeps
            // this off the `REPLACED REGIONS` banner.
            count: countMarker({ request, marker: ' REGION ', },),
          },)
            .map(function toCheck(region,) {
              return {
                region,
                verdict: proberVerdict,
                category: proberEvidence === '' ? '' : 'accuracy/mistranslation',
                severity: proberEvidence === '' ? '' : 'major',
                evidence: proberEvidence,
                omittedText: proberOmittedText,
                reason: proberEvidence === '' ? '' : 'absent before the edit',
              };
            },),
        }
        : undefined;
      if (scripted === undefined)
        throw new Error(`stub has no script for stage ${stage}`,);
      if (!request.validate(scripted,))
        throw new Error(`stub script failed the ${stage} guard`,);
      return {
        kind: 'ok',
        value: scripted,
        rawText: JSON.stringify(scripted,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by the repair pipeline',);
    },
  };
}

/**
 * Wraps a scripted client with the two failures a long run actually meets: a
 * caller abort part way through a document, and a critic roster that answers
 * nothing while the run is still live.
 *
 * Modelled on the real transport, which propagates the torn-down stream
 * untouched under an aborted signal rather than returning an outcome.
 *
 * @param base - scripted client serving every stage
 *
 * @param controller - run steering the wrapper may abort
 *
 * @param calls - critic calls attempted, shared with the case
 *
 * @param abortAfterCriticCalls - critic calls served before the wrapper aborts;
 * absent means it never does
 *
 * @param silentCritics - whether every critic call fails while the signal stays
 * live
 *
 * @returns Client honoring the steering
 *
 * @example
 * ```ts
 * const client = steeringClient({ base, controller, calls, silentCritics: true, },);
 * ```
 */
function steeringClient(
  {
    base,
    controller,
    calls,
    abortAfterCriticCalls,
    abortOnStage,
    silentCritics = false,
  }: {
    readonly base: SyntheticClient;
    readonly controller: AbortController;
    readonly calls: { critic: number; };
    readonly abortAfterCriticCalls?: number;
    readonly abortOnStage?: string;
    readonly silentCritics?: boolean;
  },
): SyntheticClient {
  return {
    chatText: base.chatText,
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      if ((abortOnStage !== undefined)
        && (request.responseFormat
            ?.json_schema
            .name
          === abortOnStage))
        controller.abort(new Error('entry deadline reached',),);
      if (request.responseFormat
        ?.json_schema
        .name
        === 'critic_report') {
        calls.critic += 1;
        if ((abortAfterCriticCalls !== undefined)
          && (calls.critic > abortAfterCriticCalls))
          controller.abort(new Error('entry deadline reached',),);
        if (silentCritics)
          throw new Error('critic provider is down',);
      }
      if (request.signal
        .aborted)
        throw new Error('exchange torn down by abort',);
      return await base.chatJson(request,);
    },
    quotas: base.quotas,
  };
}

/**
 * Original with two sections, so a case can stop a run between them.
 */
const SOURCE_TWO_SECTIONS = `## 甲

猫猫喜欢在窗台上晒太阳。猫猫也喜欢追蝴蝶。

## 乙

猫猫的尾巴很长。
`;

/**
 * Translation of {@link SOURCE_TWO_SECTIONS}.
 */
const TARGET_TWO_SECTIONS = `## Alpha

The cat loves sunbathing on the windowsill. The cat hates butterflies.

## Beta

The cat has a long tail.
`;

/**
 * Original whose one section is long enough for the naturalness lane to look
 * at, since that lane ignores any paragraph under its length floor.
 */
const SOURCE_LONG_SECTION = `## 午后

猫猫每天下午都在窗台上晒太阳，等阳光慢慢移到地板上的时候，它会不慌不忙地跟着光走，一直走到房间的另一头去。
`;

/**
 * Translation of {@link SOURCE_LONG_SECTION}, one paragraph over that floor.
 */
const TARGET_LONG_SECTION = `## Afternoon

The cat is doing the sunbathing on the windowsill in every afternoon, and when the light is moving across the floor she is following it without any hurry at all, until she reaches the other side of the room.
`;

/**
 * Wire issue for the planted mistranslation, quoting exact fixture bytes.
 */
const MISTRANSLATION_ISSUE = {
  category: 'accuracy/mistranslation',
  severity: 'major',
  summary: 'Chasing butterflies is rendered as hating them.',
  sourceQuote: '猫猫也喜欢追蝴蝶。',
  targetQuote: 'The cat hates butterflies.',
};

await describe({
  name: repairTranslation.name,
  children: [
    it({
      name: 'repairs a planted mistranslation end to end',
      fn: async () => {
        /** Full run over the scripted client. */
        const result = await repairTranslation({
          client: scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);
        expect(result.status,).toBe('repaired',);
        expect(result.repairedText,).toContain('The cat also loves chasing butterflies.',);
        expect(result.repairedText.includes('The cat hates butterflies.',),).toBe(false,);
        // Untouched text survives byte for byte.
        expect(result.repairedText,).toContain('The cat loves sunbathing on the windowsill.',);
        expect(result.issues.some(function isResolvedAccepted(record,) {
          return (record.issue.status === 'accepted') && record.resolved;
        },),).toBe(true,);
      },
    },),

    it({
      name: 'CARRIES per-chunk critic calibration into the result, so the '
        + 'artifact records who was asked and who raised each claim. Without '
        + 'this the whole attribution path ends in memory: every stage below '
        + 'collects it correctly and nothing durable ever sees it, which is '
        + 'indistinguishable from never having built it',
      fn: async () => {
        /** Full run over the scripted client. */
        const result = await repairTranslation({
          client: scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);

        expect(result.chunkCritics.length,).toBeGreaterThan(0,);

        // The roster is the DENOMINATOR: a critic asked that raised nothing and
        // a critic never asked both leave no attribution entry, so hits are
        // countable without it and rates are not.
        for (const record of result.chunkCritics)
          expect(record.heardCriticIds,)
            .toStrictEqual([...MODELS.criticModelIds,].toSorted(),);

        /** Critics credited with raising something, across every chunk. */
        const raisers = new Set(result.chunkCritics
          .flatMap(function toProposerIds(record,) {
          return record.claimAttributions
            .flatMap(function toIds(attribution,) {
            return attribution.proposers
              .map(function toModelId(proposer,) {
              return proposer.modelId;
            },);
          },);
        },),);

        expect(raisers.size,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'orders chunk records by CHUNK INDEX, so an artifact compared '
        + 'across runs does not differ merely because chunks settled in a '
        + 'different order',
      fn: async () => {
        /** Full run over the scripted client. */
        const result = await repairTranslation({
          client: scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);

        /** Chunk indexes in recorded order. */
        const indexes = result.chunkCritics
          .map(function toIndex(record,) {
          return record.chunkIndex;
        },);

        expect(indexes,).toStrictEqual([...indexes,].toSorted(function ascending(
          left,
          right,
        ) {
          return left - right;
        },),);
      },
    },),

    it({
      name: 'never lets a critic MODEL ID reach any judging prompt, which is '
        + 'the invariant attribution must not break: adjudication is '
        + 'provenance-blind because a real defect can arrive from exactly one '
        + 'critic, so proposer counts may calibrate critics and must never '
        + 'influence whether a claim is accepted',
      fn: async () => {
        /** Every message the pipeline sent, by stage. */
        const sent: { readonly stage: string; readonly text: string; }[] = [];

        /** Scripted client that records what each stage was asked. */
        const recording: SyntheticClient = {
          chatText: async () => {
            throw new Error('chatText unused by the repair pipeline',);
          },
          chatJson: async <ValueT,>(
            request: ChatJsonRequest<ValueT>,
          ): Promise<ChatJsonOutcome<ValueT>> => {
            sent.push({
              stage: request.responseFormat?.json_schema.name ?? '',
              text: request.messages
                .map(function toText(message,) {
                return message.content;
              },)
                .join('\n',),
            },);
            return await scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },)
              .chatJson(request,);
          },
          quotas: async () => {
            throw new Error('quotas unused',);
          },
        };

        /** Full run over the recording client. */
        const result = await repairTranslation({
          client: recording,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);

        // The assertion is vacuous unless attribution actually exists, so this
        // proves the run had proposer identity available to leak.
        expect(
          result.chunkCritics
            .some(function hasProposers(record,) {
            return record.claimAttributions.length > 0;
          },),
        ).toBe(true,);

        /** Judging prompts, which must name no proposer. */
        const judging = sent.filter(function isJudging(message,) {
          return message.stage === 'panel_ballot';
        },);

        expect(judging.length,).toBeGreaterThan(0,);

        // POSITIVE CONTROL. An absence proves nothing from a probe that cannot
        // show a presence, so this confirms the recorder captured real prompt
        // text before the model-id check is allowed to mean anything.
        expect(
          judging.some(function carriesPromptText(message,) {
            return message.text.includes('butterflies',);
          },),
        ).toBe(true,);

        for (const message of judging)
          for (const modelId of MODELS.criticModelIds)
            expect(message.text.includes(modelId,),).toBe(false,);
      },
    },),

    it({
      name: 'gives an accepted issue no envelope could serve no resolution '
        + 'credit, however confidently the checkers call it fixed',
      fn: async () => {
        // Checkers are asked about EVERY accepted issue, including ones that
        // anchor nothing in the translation, and a checker reading the patched
        // text will happily call such an issue fixed. Counting that let a patch
        // touching one issue win on credit for another nothing touched. The
        // scripted checkers here say "fixed" for both.
        /** Claim anchoring only the original, so no envelope can be cut. */
        const sourceOnlyIssue = {
          category: 'accuracy/omission',
          severity: 'major',
          summary: 'Something in the original is unaccounted for.',
          sourceQuote: '猫猫喜欢在窗台上晒太阳。',
        };
        const result = await repairTranslation({
          client: scriptedClient({
            criticIssues: [
              MISTRANSLATION_ISSUE,
              sourceOnlyIssue,
            ],
          },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);

        /** Record of the issue no envelope could serve. */
        const unserved = result.issues
          .find(function isSourceOnly(record,) {
            return record.repairDisposition === 'no-region';
          },);
        expect(unserved,).toBeDefined();
        expect(unserved?.resolved,).toBe(false,);
        expect(unserved?.repairRegions,).toHaveLength(0,);

        // The issue an operation did serve still earns its credit, so the
        // restriction removes false credit rather than all credit.
        expect(
          result.issues
            .some(function isServedAndResolved(record,) {
              return (record.repairDisposition === 'shipped') && record.resolved;
            },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'carries the probe tally onto the records of the issues whose '
        + 'regions were probed, so a graded item and the probe\'s opinion of '
        + 'that same item join up in the artifact',
      fn: async () => {
        const result = await repairTranslation({
          client: scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);

        /** Record of the issue an applied operation served. */
        const shipped = result.issues
          .find(function wasShipped(record,) {
            return record.repairDisposition === 'shipped';
          },);
        expect(shipped?.introducedDefects?.regions,).toHaveLength(1,);
        expect(shipped?.introducedDefects?.configuredProbers,)
          .toBe(MODELS.checkerModelIds
            .length,);
        expect(shipped?.introducedDefects?.heardProbers,)
          .toBe(MODELS.checkerModelIds
            .length,);
        expect(shipped?.introducedDefects?.regions[0]?.noneFound,)
          .toBe(MODELS.checkerModelIds
            .length,);
        expect(shipped?.introducedDefects?.regions[0]?.corroborated,).toBe(0,);
        expect(shipped?.introducedDefects?.regions[0]?.envelopeId,)
          .toBe(shipped?.repairRegions[0]
            ?.envelopeId,);
      },
    },),

    it({
      name: 'ships the repair anyway when every prober corroborates an '
        + 'introduced defect, because the probe is shadow-mode telemetry and '
        + 'nothing has yet measured how often it is wrong',
      fn: async () => {
        // The evidence quotes the replacement the editor stub writes, so the
        // deterministic screen corroborates it: absent from the baseline,
        // present in the new text. This is the strongest claim the probe can
        // produce, and it must still not decide anything.
        const result = await repairTranslation({
          client: scriptedClient({
            criticIssues: [MISTRANSLATION_ISSUE,],
            proberVerdict: 'introduced-defect',
            proberEvidence: 'The cat also loves chasing butterflies.',
          },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);

        /** Record of the issue an applied operation served. */
        const shipped = result.issues
          .find(function wasShipped(record,) {
            return record.repairDisposition === 'shipped';
          },);
        expect(result.status,).toBe('repaired',);
        expect(result.repairedText,).toContain('The cat also loves chasing butterflies.',);
        expect(shipped?.introducedDefects?.regions[0]?.corroborated,)
          .toBe(MODELS.checkerModelIds
            .length,);
        expect(shipped?.introducedDefects?.regions[0]?.contradicted,).toBe(0,);
      },
    },),

    it({
      name: 'records a quote lifted from the baseline as contradicted rather '
        + 'than corroborated, since replacing text cannot introduce wording '
        + 'the text already carried',
      fn: async () => {
        const result = await repairTranslation({
          client: scriptedClient({
            criticIssues: [MISTRANSLATION_ISSUE,],
            proberVerdict: 'introduced-defect',
            proberEvidence: 'The cat',
          },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);

        /** Record of the issue an applied operation served. */
        const shipped = result.issues
          .find(function wasShipped(record,) {
            return record.repairDisposition === 'shipped';
          },);
        expect(shipped?.introducedDefects?.regions[0]?.contradicted,)
          .toBe(MODELS.checkerModelIds
            .length,);
        expect(shipped?.introducedDefects?.regions[0]?.corroborated,).toBe(0,);
      },
    },),

    it({
      name: 'keeps the input when checkers refuse to confirm the fix',
      fn: async () => {
        /** Full run whose checkers vote not-fixed. */
        const result = await repairTranslation({
          client: scriptedClient({
            criticIssues: [MISTRANSLATION_ISSUE,],
            checkerVerdict: 'not-fixed',
          },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);
        expect(result.status,).toBe('unchanged',);
        expect(result.repairedText,).toBe(TARGET_TEXT,);
        expect(result.issues.some(function isResolved(record,) {
          return record.resolved;
        },),).toBe(false,);
      },
    },),

    it({
      name: 'keeps the input when critics find nothing',
      fn: async () => {
        /** Full run with silent critics. */
        const result = await repairTranslation({
          client: scriptedClient({ criticIssues: [], },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);
        expect(result.status,).toBe('unchanged',);
        expect(result.repairedText,).toBe(TARGET_TEXT,);
        expect(result.issues,).toHaveLength(0,);
      },
    },),

    it({
      name: 'REPORTS ensemble-agreed critical non-translation instead of blocking on it, and still '
        + 'names the dominance in its findings. This test asserted the opposite until 2026-08-16, '
        + 'when question 3 answer B made critics evidence and took away every early return they '
        + 'owned; the old exit returned the archive untouched and discarded every slice already '
        + 'repaired, which on a sparse target was the common outcome rather than the rare one',
      fn: async () => {
        /** Full run whose critics all report a non-translation. */
        const result = await repairTranslation({
          client: scriptedClient({
            criticIssues: [
              {
                category: 'accuracy/non-translation',
                severity: 'critical',
                summary: 'The target is not a translation of the source.',
                targetQuote: 'The cat loves sunbathing on the windowsill.',
              },
            ],
          },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);
        expect(result.status,).not
          .toBe('blocked-non-translation',);
        // THE READING SURVIVES THE BLOCK'S REMOVAL. Evidence that stops
        // deciding must not stop being recorded, or a document whose critics
        // all called it untranslated would ship with nothing saying so.
        expect(result.findings
          .some(function namesDominance(finding,) {
            return finding.includes('non-translation dominance',);
          },),).toBe(true,);
      },
    },),

    it({
      name: 'proceeds when content critique contradicts non-translation votes',
      fn: async () => {
        /**
         * Substantive wire issues anchoring critique into target text;
         * three critics each reporting three reach the contradiction
         * floor while every critic also votes non-translation.
         * The summaries and category labels are ACKNOWLEDGED ARBITRARY
         * INVENTION, not coherent review commentary: the scripted stub
         * never interprets them, and the contradiction assessment only
         * needs structurally valid claims, meaning closed-taxonomy
         * categories outside the missing-translation family plus quotes
         * occurring exactly once per side of the tiny fixture pair.
         * The quotes reuse whatever unique fragments the fixture offers,
         * so critique text and quoted text deliberately do not cohere.
         */
        const contentCritiqueIssues = [
          {
            category: 'style/awkward-phrasing',
            severity: 'minor',
            summary: 'Sunbathing clause reads stiffly.',
            sourceQuote: '在窗台上晒太阳',
            targetQuote: 'sunbathing on the windowsill',
          },
          {
            category: 'style/register',
            severity: 'minor',
            summary: 'Butterfly clause drops the playful register.',
            sourceQuote: '追蝴蝶',
            targetQuote: 'hates butterflies',
          },
          {
            category: 'terminology/wrong-term',
            severity: 'major',
            summary: 'Doubled cat endearment is flattened.',
            sourceQuote: '猫猫喜欢',
            targetQuote: 'The cat loves',
          },
        ];

        /** Full run whose non-translation votes stand contradicted. */
        const result = await repairTranslation({
          client: scriptedClient({
            criticIssues: [
              {
                category: 'accuracy/non-translation',
                severity: 'critical',
                summary: 'The target is not a translation of the source.',
                targetQuote: 'The cat loves sunbathing on the windowsill.',
              },
              ...contentCritiqueIssues,
            ],
          },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);
        expect(result.status,).not.toBe('blocked-non-translation',);
        expect(result.findings
          .some(function mentionsContradiction(finding,) {
            return finding.includes('non-translation votes contradicted',);
          },),).toBe(true,);
        // Dismissed votes take their claims along; no adjudicated issue
        // may carry the non-translation category.
        expect(result.issues
          .some(function carriesNonTranslation(record,) {
            return record.issue
              .claims
              .some(function isNonTranslation(claim,) {
                return claim.claim
                  .category
                  === 'accuracy/non-translation';
              },);
          },),).toBe(false,);
      },
    },),

    it({
      name: 'resumes cached slices without recomputing them',
      fn: async () => {
        /**
         * Structured-call counter shared with the wrapping client.
         */
        const calls = { count: 0, };

        /**
         * Base client repairing the planted mistranslation.
         */
        const base = scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },);

        /**
         * Client counting every structured call it serves.
         */
        const counting: SyntheticClient = {
          chatText: base.chatText,
          chatJson: async <ValueT,>(
            request: ChatJsonRequest<ValueT>,
          ): Promise<ChatJsonOutcome<ValueT>> => {
            calls.count += 1;
            return base.chatJson(request,);
          },
          quotas: base.quotas,
        };

        /**
         * Serialized slice outcomes the first run persists, keyed by hash.
         */
        const store = new Map<string, string>();

        /**
         * First run computes and persists every slice.
         */
        const first = await repairTranslation({
          client: counting,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
          sliceCache: {
            resumed: new Map<string, ChunkRepairOutcome>(),
            persist: async ({
              key,
              serialized,
            },) => {
              store.set(
                key,
                serialized,
              );
            },
          },
        },);
        expect(calls.count,).toBeGreaterThan(0,);
        expect(store.size,).toBeGreaterThan(0,);

        /**
         * Resume map parsed from the persisted slices, as the driver does.
         */
        const resumed = new Map<string, ChunkRepairOutcome>(
          [...store.entries(),].map(([key, serialized,],) =>
            [key, JSON.parse(serialized,) as ChunkRepairOutcome,] as const),
        );

        /**
         * Structured calls made before the resumed run began.
         */
        const callsBeforeResume = calls.count;

        /**
         * Second run resumes every slice from the cache.
         */
        const second = await repairTranslation({
          client: counting,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
          sliceCache: {
            resumed,
            persist: async () => {
              throw new Error('a fully cached run must not persist',);
            },
          },
        },);
        // A fully cached document makes no further model call.
        expect(calls.count,).toBe(callsBeforeResume,);
        // The resumed result matches the fresh one.
        expect(second.repairedText,).toBe(first.repairedText,);
        expect(second.status,).toBe(first.status,);
        expect(second.issues
          .length,).toBe(first.issues
          .length,);
      },
    },),

    it({
      name: 'degrades a minority standing region per slice instead of blocking',
      fn: async () => {
        /**
         * Original with a large translated section and a small one whose
         * rendering is gibberish.
         */
        const sourceTwoSections = `## 甲

猫猫喜欢在窗台上晒太阳。猫猫也喜欢追蝴蝶。

## 乙

猫猫的尾巴很长。
`;

        /**
         * Translation whose second section is unrelated noise.
         */
        const targetTwoSections = `## Alpha

The cat loves sunbathing on the windowsill. The cat hates butterflies.

## Beta

Meow meow meow meow.
`;

        /** Full run where only the small section draws standing votes. */
        const result = await repairTranslation({
          client: scriptedClient({
            criticIssues: function perSlice(request,) {
              /**
               * User sheet of this critic call.
               */
              const sheet = request.messages
                .at(-1,)
                ?.content
                ?? '';
              if (sheet.includes('Meow meow meow',)) {
                return [
                  {
                    category: 'accuracy/non-translation',
                    severity: 'critical',
                    summary: 'This section is not a translation of the source.',
                    targetQuote: 'Meow meow meow meow.',
                  },
                ];
              }
              return [MISTRANSLATION_ISSUE,];
            },
          },),
          sourceText: sourceTwoSections,
          targetText: targetTwoSections,
          models: MODELS,
          signal: new AbortController().signal,
        },);
        expect(result.status,).toBe('repaired',);
        // THE STANDING REGION IS REPAIRED NOW RATHER THAN SHIPPED UNCHANGED.
        // This assertion was its own opposite until 2026-08-16, when question 3
        // answer B made critics evidence and took away every early return they
        // owned. What the old exit cost is why: a sparse target draws standing
        // votes on most of what it examines, so it fired precisely where the
        // work was needed and discarded it.
        expect(result.repairedText,).not
          .toContain('Meow meow meow meow.',);
        expect(result.repairedText,).toContain('The cat also loves chasing butterflies.',);
        // THE VOTES ARE STILL REPORTED, which is the half that did not change.
        // Evidence that stops deciding must not also stop being recorded, or
        // the lane would repair a passage its own critics called untranslated
        // and say nothing about it.
        expect(result.findings
          .some(function mentionsStanding(finding,) {
            return finding.includes('non-translation votes stand',);
          },),).toBe(true,);
      },
    },),

    it({
      name: 'repairs a pair PREPARED BY THE CALLER, and reaches the same result '
        + 'as preparing it itself. This is what lets both lanes run over one '
        + 'preparation: two lanes slicing separately would drift the moment '
        + 'either changed a budget, and each would still report slices that '
        + 'look right on their own',
      fn: async () => {
        /**
         * Preparation the caller owns, shared with any other lane.
         */
        const prepared = prepareDocumentPair({
          sourceText: SOURCE_TWO_SECTIONS,
          targetText: TARGET_TWO_SECTIONS,
        },);

        /**
         * Repair driven from that preparation.
         */
        const fromPrepared = await repairPreparedDocument({
          client: scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },),
          prepared,
          models: MODELS,
          signal: new AbortController().signal,
        },);

        /**
         * Repair driven from the two texts, which prepares internally.
         */
        const fromTexts = await repairTranslation({
          client: scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },),
          sourceText: SOURCE_TWO_SECTIONS,
          targetText: TARGET_TWO_SECTIONS,
          models: MODELS,
          signal: new AbortController().signal,
        },);
        expect(fromPrepared.status,).toBe('repaired',);
        expect(fromPrepared.repairedText,).toBe(fromTexts.repairedText,);
        expect(fromPrepared.issues
          .length,).toBe(fromTexts.issues
          .length,);
        expect(fromPrepared.findings,).toEqual(fromTexts.findings,);
      },
    },),

    it({
      name: 'says NOTHING about a slice the archive never translated, and spends nothing discovering '
        + 'that: every stage of this lane reads existing wording, so an anchor would have critics '
        + 'filing complaints about a blank at full roster cost',
      fn: async () => {
        /**
         * Preparation both lanes would share.
         */
        const prepared = prepareDocumentPair({
          sourceText: SOURCE_TWO_SECTIONS,
          targetText: TARGET_TWO_SECTIONS,
        },);

        /**
         * Index the appended anchor holds.
         */
        const anchorIndex = prepared.slices
          .length;

        /**
         * Same preparation with one section the archive never translated,
         * anchored at the end of the document.
         */
        const withAnchor = {
          ...prepared,
          slices: [
            ...prepared.slices,
            {
              source: {
                chunkIndex: anchorIndex,
                nodes: [],
                startOffset: 0,
                endOffset: 0,
                text: '## 丙\n\n猫猫也喜欢晒太阳。',
              },
              target: makeInsertionChunk({
                chunkIndex: anchorIndex,
                offset: TARGET_TWO_SECTIONS.length,
              },),
            },
          ],
        };

        /**
         * Exchanges each run made, so the anchor's cost is measured rather than
         * assumed.
         */
        const spent = {
          plain: 0,
          anchored: 0,
        };

        /**
         * Client counting every exchange it serves into one of those tallies.
         *
         * @param key - which run this client serves
         *
         * @returns Counting client over the scripted one
         *
         * @example
         * ```ts
         * const client = countingClient({ key: 'plain', },);
         * ```
         */
        function countingClient(
          { key, }: { readonly key: 'plain' | 'anchored'; },
        ): SyntheticClient {
          /**
           * Scripted client this one delegates to.
           */
          const inner = scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },);
          return {
            chatText: inner.chatText,
            chatJson: async <ValueT,>(
              request: ChatJsonRequest<ValueT>,
            ): Promise<ChatJsonOutcome<ValueT>> => {
              spent[key] += 1;
              return await inner.chatJson(request,);
            },
            quotas: inner.quotas,
          };
        }

        /**
         * Repair over the preparation as it stands.
         */
        const plain = await repairPreparedDocument({
          client: countingClient({ key: 'plain', },),
          prepared,
          models: MODELS,
          signal: new AbortController().signal,
        },);

        /**
         * Repair over the same preparation plus the anchor.
         */
        const anchored = await repairPreparedDocument({
          client: countingClient({ key: 'anchored', },),
          prepared: withAnchor,
          models: MODELS,
          signal: new AbortController().signal,
        },);
        // NOT ONE MORE EXCHANGE for the extra slice, which is the whole point:
        // an anchor is answered rather than asked about.
        expect(spent.anchored,).toBe(spent.plain,);
        expect(anchored.findings,).toContain(notApplicableFinding({ chunkIndex: anchorIndex, },),);
        // The document is what it would have been without the anchor: this lane
        // fills nothing, and the passage stays missing until the other one does.
        expect(anchored.repairedText,).toBe(plain.repairedText,);
        // Still one row per prepared slice, so a reader joining the two lanes
        // slice by slice does not see a shorter document here.
        expect(anchored.sliceTexts
          .length,).toBe(withAnchor.slices
          .length,);
        expect(anchored.shippedChunkIndices,).not.toContain(anchorIndex,);
      },
    },),

    it({
      name: 'WITHDRAWS a repair that would break a footnote spanning two '
        + 'slices, and records its issue as withdrawn rather than shipped. The '
        + 'per-envelope footnote gate cannot see this: the definition lives in '
        + 'a slice the editor was never shown',
      fn: async () => {
        /**
         * Original whose first section carries a marker and whose last carries
         * the note it points at.
         */
        const sourceWithNote = `## 甲

猫猫喜欢在窗台上晒太阳。猫猫也喜欢追蝴蝶〔1〕。

## 注

〔1〕：那是它最喜欢的活动。
`;

        /**
         * Translation with the same footnote pair, split the same way.
         */
        const targetWithNote = `## Alpha

The cat loves sunbathing on the windowsill. The cat hates butterflies[^1].

## Notes

[^1]: That is its favourite activity.
`;

        /**
         * Issue whose quote CONTAINS the marker, so the envelope cut for it
         * covers the marker and the editor's replacement drops it.
         */
        const markerBearingIssue = {
          category: 'accuracy/mistranslation',
          severity: 'major',
          summary: 'Chasing butterflies is rendered as hating them.',
          sourceQuote: '猫猫也喜欢追蝴蝶〔1〕。',
          targetQuote: 'The cat hates butterflies[^1].',
        };

        /**
         * Run whose only accepted repair would orphan the definition.
         */
        const result = await repairTranslation({
          client: scriptedClient({ criticIssues: [markerBearingIssue,], },),
          sourceText: sourceWithNote,
          targetText: targetWithNote,
          models: MODELS,
          signal: new AbortController().signal,
        },);
        // The document keeps the archive's text, marker and all.
        expect(result.repairedText,).toContain('The cat hates butterflies[^1].',);
        expect(result.status,).toBe('unchanged',);
        expect(result.findings
          .some(function namesWithdrawal(finding,) {
            return finding.startsWith('assembly-footnote-',);
          },),).toBe(true,);
        // The issue may not be credited: no reader ever saw that repair.
        for (const record of result.issues) {
          expect(record.repairDisposition,).toBe('withdrawn',);
          expect(record.resolved,).toBe(false,);
        }
        // The document-level sets say the same thing at slice granularity,
        // which is what a comparison between the two lanes joins on.
        expect(result.withdrawnChunkIndices
          .length,).toBeGreaterThan(0,);
        expect(result.shippedChunkIndices,).toEqual([],);
        for (const chunkIndex of result.withdrawnChunkIndices) {
          expect(result.shippedChunkIndices
            .includes(chunkIndex,),).toBe(false,);
        }
      },
    },),

    it({
      name: 'THROWS on a caller abort part way through a document, and caches '
        + 'nothing for the slices it never bought. Every abandoned exchange '
        + 'reaches the stages as silence, so an unguarded driver files "no '
        + 'validated claims, unchanged" for each remaining slice and writes '
        + 'that to the cache, where the next attempt reads it as a clean slice',
      fn: async () => {
        /**
         * Critic calls attempted across the run.
         */
        const calls = { critic: 0, };

        /**
         * Run steering the client aborts inside the second slice.
         */
        const controller = new AbortController();

        /**
         * Slices that reached the cache before the abort.
         */
        const store = new Map<string, string>();
        await expect(repairTranslation({
          client: steeringClient({
            base: scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },),
            controller,
            calls,
            abortAfterCriticCalls: MODELS.criticModelIds
              .length,
          },),
          sourceText: SOURCE_TWO_SECTIONS,
          targetText: TARGET_TWO_SECTIONS,
          models: MODELS,
          signal: controller.signal,
          sliceCache: {
            resumed: new Map<string, ChunkRepairOutcome>(),
            persist: async ({
              key,
              serialized,
            },) => {
              store.set(
                key,
                serialized,
              );
            },
          },
        },),)
          .rejects
          .toThrow('entry deadline reached',);
        expect(store.size,).toBe(1,);
      },
    },),

    it({
      name: 'THROWS on an abort that lands during REFINEMENT, which the slice '
        + 'loop cannot see. Refinement runs after every slice settled, and its '
        + 'abandoned exchanges reach the stage as silence exactly like the '
        + 'accuracy ones, so an unguarded driver keeps the accuracy text and '
        + 'returns a document that reads as a finished run',
      fn: async () => {
        /**
         * Critic calls attempted across the run, which this case never steers
         * by count.
         */
        const calls = { critic: 0, };

        /**
         * Run steering the client aborts on the first rewrite request.
         */
        const controller = new AbortController();

        /**
         * Roster with the naturalness lane ON, since an off lane returns before
         * spending anything and there would be no refinement to abort.
         */
        const refining: RepairModels = {
          ...MODELS,
          refinerModelIds: ['hf:zai-org/GLM-5.2',],
        };
        await expect(repairTranslation({
          client: steeringClient({
            base: scriptedClient({ criticIssues: [], },),
            controller,
            calls,
            abortOnStage: 'refine_report',
          },),
          // Long enough for the lane to have something to rewrite, and clean
          // enough that nothing else is in the way of reaching it.
          sourceText: SOURCE_LONG_SECTION,
          targetText: TARGET_LONG_SECTION,
          models: refining,
          signal: controller.signal,
        },),)
          .rejects
          .toThrow('entry deadline reached',);
      },
    },),

    it({
      name: 'still FINISHES a fully cached document under an already aborted '
        + 'signal, which is the other half of the same rule: what a stopped run '
        + 'cannot do is BUY what it is missing, and a run that asks nobody '
        + 'anything is missing nothing',
      fn: async () => {
        /**
         * Serialized slice outcomes the first run persists, keyed by hash.
         */
        const store = new Map<string, string>();

        /**
         * First run, which buys and persists every slice.
         */
        const first = await repairTranslation({
          client: scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
          sliceCache: {
            resumed: new Map<string, ChunkRepairOutcome>(),
            persist: async ({
              key,
              serialized,
            },) => {
              store.set(
                key,
                serialized,
              );
            },
          },
        },);

        /**
         * Resume map parsed from the persisted slices, as the driver does.
         */
        const resumed = new Map<string, ChunkRepairOutcome>(
          [...store.entries(),].map(([key, serialized,],) =>
            [key, JSON.parse(serialized,) as ChunkRepairOutcome,] as const),
        );

        /**
         * Caller that gave up before the second run started.
         */
        const spent = new AbortController();
        spent.abort(new Error('entry deadline reached',),);

        /**
         * Second run, resuming everything under that spent deadline.
         */
        const second = await repairTranslation({
          client: {
            chatText: async () => {
              throw new Error('a fully cached run must not ask anybody anything',);
            },
            chatJson: async () => {
              throw new Error('a fully cached run must not ask anybody anything',);
            },
            quotas: async () => {
              throw new Error('quotas unused by the repair pipeline',);
            },
          },
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: spent.signal,
          sliceCache: {
            resumed,
            persist: async () => {
              throw new Error('a fully cached run must not persist',);
            },
          },
        },);
        expect(second.repairedText,).toBe(first.repairedText,);
        expect(second.status,).toBe(first.status,);
      },
    },),

    it({
      name: 'ASKS AGAIN for a twin of a slice no critic answered. The in-run memo may only hold what a '
        + 'warm run could resume, and this slice is deliberately not cached, so reusing it would settle '
        + 'a cold run on a silence a warm run would have re-examined',
      fn: async () => {
        /**
         * Section written twice, so both slices ask one question.
         */
        const SECTION = `## 甲

猫猫喜欢在窗台上晒太阳。猫猫也喜欢追蝴蝶。
`;

        /**
         * Its archive wording, likewise written twice.
         */
        const RENDERED = `## Alpha

The cat loves sunbathing on the windowsill. The cat hates butterflies.
`;

        /**
         * Critic calls one slice of it costs, measured rather than assumed:
         * the roster retries a lost voice, so the count per slice belongs to
         * the gather rather than to the critic list length.
         */
        const single = { critic: 0, };
        await repairTranslation({
          client: steeringClient({
            base: scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },),
            controller: new AbortController(),
            calls: single,
            silentCritics: true,
          },),
          sourceText: SECTION,
          targetText: RENDERED,
          models: MODELS,
          signal: new AbortController().signal,
        },);

        /**
         * Critic calls the same section twice costs.
         */
        const twin = { critic: 0, };

        /**
         * Slices that reached the cache, which must stay empty.
         */
        const store = new Map<string, string>();
        const result = await repairTranslation({
          client: steeringClient({
            base: scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },),
            controller: new AbortController(),
            calls: twin,
            silentCritics: true,
          },),
          sourceText: `${SECTION}\n${SECTION}`,
          targetText: `${RENDERED}\n${RENDERED}`,
          models: MODELS,
          signal: new AbortController().signal,
          sliceCache: {
            resumed: new Map<string, ChunkRepairOutcome>(),
            persist: async ({
              key,
              serialized,
            },) => {
              store.set(
                key,
                serialized,
              );
            },
          },
        },);
        expect(result.sliceCount,).toBe(2,);
        expect(twin.critic,).toBe(single.critic * 2,);
        expect(store.size,).toBe(0,);
      },
    },),

    it({
      name: 'settles a slice NO critic answered, and deliberately does not '
        + 'cache it. Nothing inspected that slice, so caching it records an '
        + 'outage as a clean verdict that every later attempt resumes rather '
        + 'than re-examines',
      fn: async () => {
        /**
         * Critic calls attempted across the run.
         */
        const calls = { critic: 0, };

        /**
         * Slices that reached the cache.
         */
        const store = new Map<string, string>();
        const result = await repairTranslation({
          client: steeringClient({
            base: scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },),
            controller: new AbortController(),
            calls,
            silentCritics: true,
          },),
          sourceText: SOURCE_TWO_SECTIONS,
          targetText: TARGET_TWO_SECTIONS,
          models: MODELS,
          signal: new AbortController().signal,
          sliceCache: {
            resumed: new Map<string, ChunkRepairOutcome>(),
            persist: async ({
              key,
              serialized,
            },) => {
              store.set(
                key,
                serialized,
              );
            },
          },
        },);
        // The document still ships: an unexamined slice keeps its translation.
        expect(result.repairedText,).toBe(TARGET_TWO_SECTIONS,);
        expect(calls.critic,).toBeGreaterThan(0,);
        expect(store.size,).toBe(0,);
      },
    },),

    it({
      name: 'STAMPS a resumed outcome with the index it was ASKED under rather than the one it was '
        + 'computed under, which is what taking the slice index out of the key buys. A record now '
        + 'answers for any slice carrying the same texts, and the index it happens to carry would '
        + 'name the wrong slice in every issue record and replacement built from it',
      fn: async () => {
        /**
         * Slices the first run persists.
         */
        const store = new Map<string, string>();

        /**
         * What the first run settled on, which the resumed run must reproduce.
         */
        const first = await repairTranslation({
          client: scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },),
          sourceText: SOURCE_TWO_SECTIONS,
          targetText: TARGET_TWO_SECTIONS,
          models: MODELS,
          signal: new AbortController().signal,
          sliceCache: {
            resumed: new Map<string, ChunkRepairOutcome>(),
            persist: async ({
              key,
              serialized,
            },) => {
              store.set(
                key,
                serialized,
              );
            },
          },
        },);
        expect(store.size,).toBeGreaterThan(0,);

        /**
         * Same outcomes under the same keys, each carrying an index that names
         * some other slice, which is what a record computed elsewhere looks
         * like once the key stops carrying the index.
         */
        const misfiled = new Map(
          [...store.entries(),].map(function toMisfiled([key, serialized,],) {
            /**
             * Outcome as the cache stored it.
             */
            const outcome = JSON.parse(serialized,) as ChunkRepairOutcome;
            return [
              key,
              {
                ...outcome,
                chunkIndex: outcome.chunkIndex + 1,
              },
            ] as const;
          },),
        );

        /**
         * Run that resumes every slice from those records.
         */
        const resumedRun = await repairTranslation({
          client: scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },),
          sourceText: SOURCE_TWO_SECTIONS,
          targetText: TARGET_TWO_SECTIONS,
          models: MODELS,
          signal: new AbortController().signal,
          sliceCache: {
            resumed: misfiled,
            persist: async () => {
              throw new Error('a fully cached run must not persist',);
            },
          },
        },);
        expect(resumedRun.repairedText,).toBe(first.repairedText,);
        expect(resumedRun.shippedChunkIndices,).toEqual(first.shippedChunkIndices,);
        expect(resumedRun.issues
          .map(function toChunk(record,): number {
            return record.chunkIndex;
          },),).toEqual(first.issues
          .map(function toChunk(record,): number {
            return record.chunkIndex;
          },),);
      },
    },),
  ],
},);
