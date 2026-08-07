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
      name: 'blocks repair on ensemble-agreed critical non-translation',
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
        expect(result.status,).toBe('blocked-non-translation',);
        expect(result.repairedText,).toBe(TARGET_TEXT,);
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
            persist: async (
              key,
              serialized,
            ) => {
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
        // The standing region ships unchanged while the rest repairs.
        expect(result.repairedText,).toContain('Meow meow meow meow.',);
        expect(result.repairedText,).toContain('The cat also loves chasing butterflies.',);
        expect(result.findings
          .some(function mentionsStanding(finding,) {
            return finding.includes('non-translation votes stand',);
          },),).toBe(true,);
      },
    },),
  ],
},);
