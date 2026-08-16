/**
 * Tests for the rendering audit stage: what it asks, what survives screening,
 * and what it takes for a defect to count as corroborated.
 *
 * DRIVEN THROUGH THE WHOLE INSTRUMENT rather than through the screen alone,
 * because the question this exists to answer is whether a defect survives
 * AGGREGATION. A single scripted voice proves only that the stage ran.
 *
 * Fixtures are cat-themed invention, written here. Checked against the corpus
 * at the pinned commit: none of these spans occurs in it.
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
  runRenderingAudit,
  type SyntheticClient,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the audits under test.
 */
const l = tagged({ tag: 'rendering-audit-test', },);

/**
 * Auditors the fixtures configure.
 */
const AUDITORS: readonly SyntheticModelId[] = [
  'hf:Qwen/Qwen3.6-27B',
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  'hf:openai/gpt-oss-120b',
];

/**
 * Original passage, carrying a negation the candidate can drop.
 */
const SOURCE_TEXT = '三只猫住在书店的阁楼里。她们不吃罐头，每天傍晚只喝一碗温牛奶。';

/**
 * Rendering with the negation dropped.
 */
const CANDIDATE_TEXT = 'Three cats live in the attic of the bookshop. They eat canned food, '
  + 'and every evening they drink one bowl of warm milk.';

/**
 * Span of the original the honest finding rests on.
 */
const SOURCE_SPAN = '她们不吃罐头';

/**
 * Span of the candidate it disagrees with.
 */
const CANDIDATE_SPAN = 'They eat canned food';

/**
 * Deadline every fixture call runs under.
 */
const CALL_TIMEOUT_MS = 4_000;

/**
 * What one scripted auditor answers.
 */
type ScriptedVoice = {
  /**
   * Verdict it casts.
   */
  readonly verdict: string;

  /**
   * Findings it claims, already in wire shape.
   */
  readonly findings: readonly {
    readonly category: string;
    readonly sourceQuote: string;
    readonly candidateQuote: string;
    readonly reason: string;
  }[];
};

/**
 * One honest polarity finding, as a voice would send it.
 *
 * @param reason - what this voice says the two spans amount to
 *
 * @returns Finding in wire shape
 *
 * @example
 * ```ts
 * const finding = polarityFinding({ reason: 'the negation is gone', },);
 * ```
 */
function polarityFinding(
  { reason, }: { readonly reason: string; },
): ScriptedVoice['findings'][number] {
  return {
    category: 'altered-polarity',
    sourceQuote: SOURCE_SPAN,
    candidateQuote: CANDIDATE_SPAN,
    reason,
  };
}

/**
 * A voice that found nothing.
 */
const QUIET_VOICE: ScriptedVoice = {
  verdict: 'no-defect-found',
  findings: [],
};

/**
 * Client answering with one scripted reply per auditor, by roster position.
 *
 * @param script - what each auditor answers, keyed by model id
 *
 * @returns Client the stage calls
 *
 * @example
 * ```ts
 * const client = catClient({ script, },);
 * ```
 */
function catClient(
  { script, }: { readonly script: Readonly<Record<string, ScriptedVoice>>; },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by the audit',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * What this auditor was scripted to answer, or silence.
       */
      const scripted: unknown = script[request.modelId];

      if (scripted === undefined) {
        return {
          kind: 'schema-mismatch',
          rawText: '',
          detail: 'scripted silence',
        };
      }
      if (!request.validate(scripted,))
        throw new Error('scripted payload failed the guard',);

      return {
        kind: 'ok',
        value: scripted,
        rawText: JSON.stringify(scripted,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by the audit',);
    },
  };
}

/**
 * Runs one audit over the flipped rendering.
 *
 * @param script - what each auditor answers
 *
 * @returns What the stage reported
 *
 * @example
 * ```ts
 * const report = await auditWith({ script, },);
 * ```
 */
async function auditWith(
  { script, }: { readonly script: Readonly<Record<string, ScriptedVoice>>; },
): Promise<Awaited<ReturnType<typeof runRenderingAudit>>> {
  return runRenderingAudit({
    client: catClient({ script, },),
    subject: {
      sourceText: SOURCE_TEXT,
      candidateText: CANDIDATE_TEXT,
    },
    modelIds: AUDITORS,
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS,),
    perCallTimeoutMs: CALL_TIMEOUT_MS,
    l,
  },);
}

await describe({
  name: runRenderingAudit.name,
  children: [
    it({
      name:
        'CORROBORATES a defect two auditors found over the same span, and counts the voices rather than '
        + 'the claims: the whole point of a roster here is that one auditor`s opinion and a defect two '
        + 'of them located independently are different facts',
      fn: async () => {
        /**
         * Two auditors finding the dropped negation, one finding nothing.
         */
        const report = await auditWith({
          script: {
            [AUDITORS[0] ?? '']: {
              verdict: 'defects-found',
              findings: [polarityFinding({ reason: 'the original negates this and the candidate does not', },),],
            },
            [AUDITORS[1] ?? '']: {
              verdict: 'defects-found',
              findings: [polarityFinding({ reason: 'the candidate asserts what the original denies', },),],
            },
            [AUDITORS[2] ?? '']: QUIET_VOICE,
          },
        },);
        expect(report.corroborated,).toHaveLength(1,);
        expect(report.corroborated[0]
          ?.category,).toBe('altered-polarity',);
        expect(report.corroborated[0]
          ?.voices,).toBe(2,);
        expect(report.corroborated[0]
          ?.sourceEvidence,).toBe(SOURCE_SPAN,);
        expect(report.corroborated[0]
          ?.reasons,).toHaveLength(2,);
      },
    },),
    it({
      name:
        'REPORTS NO CORROBORATED DEFECT when only one auditor found it, while keeping that auditor`s row: '
        + 'a lone claim is evidence about the auditor as much as about the rendering, and discarding it '
        + 'would destroy what a later calibration of these voices has to read',
      fn: async () => {
        const report = await auditWith({
          script: {
            [AUDITORS[0] ?? '']: {
              verdict: 'defects-found',
              findings: [polarityFinding({ reason: 'the negation is gone', },),],
            },
            [AUDITORS[1] ?? '']: QUIET_VOICE,
            [AUDITORS[2] ?? '']: QUIET_VOICE,
          },
        },);
        expect(report.corroborated,).toEqual([],);
        expect(report.rows,).toHaveLength(AUDITORS.length,);
        expect(
          report.rows
            .filter(function claimed(row,): boolean {
              return row.findings
                .length > 0;
            },),
        ).toHaveLength(1,);
      },
    },),
    it({
      name:
        'does NOT let one auditor corroborate itself by claiming the same span twice, which is the way a '
        + 'count over claims rather than over voices would report agreement nobody reached',
      fn: async () => {
        const report = await auditWith({
          script: {
            [AUDITORS[0] ?? '']: {
              verdict: 'defects-found',
              findings: [
                polarityFinding({ reason: 'the negation is gone', },),
                polarityFinding({ reason: 'saying it again does not make it two opinions', },),
              ],
            },
            [AUDITORS[1] ?? '']: QUIET_VOICE,
            [AUDITORS[2] ?? '']: QUIET_VOICE,
          },
        },);
        expect(report.corroborated,).toEqual([],);
      },
    },),
    it({
      name:
        'drops an unanchored claim before counting, so two auditors agreeing on wording NEITHER text '
        + 'carries corroborate nothing: agreement between voices is not evidence when what they agree on '
        + 'is not in the documents',
      fn: async () => {
        /**
         * Two voices quoting a rendering nobody was shown.
         */
        const invented = {
          category: 'unsupported-addition',
          sourceQuote: '',
          candidateQuote: 'The cats abandoned the attic before winter.',
          reason: 'this sentence is not supported',
        };

        const report = await auditWith({
          script: {
            [AUDITORS[0] ?? '']: {
              verdict: 'defects-found',
              findings: [invented,],
            },
            [AUDITORS[1] ?? '']: {
              verdict: 'defects-found',
              findings: [invented,],
            },
            [AUDITORS[2] ?? '']: QUIET_VOICE,
          },
        },);
        expect(report.corroborated,).toEqual([],);
        expect(
          report.rows
            .flatMap(function toDropped(row,): readonly string[] {
              return row.dropped;
            },),
        ).toEqual([
          'unanchored-quote (candidate)',
          'unanchored-quote (candidate)',
        ],);
      },
    },),
    it({
      name:
        'accounts for an auditor it could not hear rather than reading silence as agreement, and says so '
        + 'in the findings: a lost voice shrinks the roster that could have corroborated anything',
      fn: async () => {
        /**
         * Two auditors answering, one scripted to lose its voice entirely.
         */
        const report = await auditWith({
          script: {
            [AUDITORS[0] ?? '']: {
              verdict: 'defects-found',
              findings: [polarityFinding({ reason: 'the negation is gone', },),],
            },
            [AUDITORS[1] ?? '']: {
              verdict: 'defects-found',
              findings: [polarityFinding({ reason: 'the candidate says the opposite', },),],
            },
          },
        },);
        expect(report.rows,).toHaveLength(2,);
        expect(report.corroborated,).toHaveLength(1,);
        expect(
          report.rows
            .map(function toId(row,): string {
              return row.modelId;
            },),
        ).not
          .toContain(AUDITORS[2],);
      },
    },),
  ],
},);
