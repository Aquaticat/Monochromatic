/**
 * Tests for the editor stage's guards and early exits.
 *
 * `runEditorStage` had no test. Its judged path is covered through
 * `selectPerEnvelope` and `selectChunkPatch`, which have their own suites, so
 * what this adds is the two places the stage decides NOT to go there.
 *
 * Both are cost properties as much as correctness ones. The provider is
 * flat-rate but not unlimited, and a run spends its capacity on judge calls it
 * did not need or on a fan-out against a roster that could never have been
 * judged. Neither shows up as an error; both show up as a pass that ran out of
 * budget with fewer entries settled.
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
  type AdjudicatedIssue,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type EditableEnvelope,
  EditorRosterError,
  hashContent,
  runEditorStage,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the stages under test.
 */
const l = tagged({ tag: 'editor-stage-test', },);

/**
 * Translation chunk the editors propose against.
 */
const TARGET_TEXT = 'The cat is doing the sleeping on the windowsill.';

/**
 * Original the edits answer to.
 */
const SOURCE_TEXT = '猫猫在窗台上睡觉。';

/**
 * Single editable envelope covering the whole chunk.
 */
const ENVELOPES: readonly EditableEnvelope[] = [
  {
    envelopeId: 'envelope/0',
    startOffset: 0,
    endOffset: TARGET_TEXT.length,
    baseText: TARGET_TEXT,
    baseHash: hashContent({ content: TARGET_TEXT, },),
    issueIds: ['adjudicated/tense',],
  },
];

/**
 * Accepted issue the edit answers.
 */
const ISSUES: readonly AdjudicatedIssue[] = [
  {
    issueId: 'adjudicated/tense',
    status: 'accepted' as const,
    severity: 'major' as const,
    claims: [],
    tallies: {},
  },
];

/**
 * Editors that propose candidates.
 */
const EDITORS = [
  'hf:zai-org/GLM-5.2',
  'hf:moonshotai/Kimi-K3',
] as const;

/**
 * Judges with no stake in either editor's output.
 */
const JUDGES = [
  'hf:Qwen/Qwen3.6-27B',
  'hf:openai/gpt-oss-120b',
] as const;

/**
 * Client answering every editor with one scripted report, counting calls.
 *
 * @param report - report each editor returns
 *
 * @param calls - shared counter the cases assert on
 *
 * @returns Client honoring that script
 *
 * @example
 * ```ts
 * const client = editorClient({ report: { edits: [], }, calls, },);
 * ```
 */
function editorClient(
  {
    report,
    calls,
  }: {
    readonly report: unknown;
    readonly calls: { count: number; };
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      calls.count += 1;
      if (!request.validate(report,))
        throw new Error('scripted report failed the editor guard',);
      return {
        kind: 'ok',
        value: report,
        rawText: JSON.stringify(report,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused',);
    },
  };
}

/**
 * Client that fails the moment it is called, proving a guard ran first.
 *
 * @returns Client refusing every exchange
 *
 * @example
 * ```ts
 * const client = neverCalledClient();
 * ```
 */
function neverCalledClient(): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('the stage called a model it should not have',);
    },
    chatJson: async () => {
      throw new Error('the stage called a model it should not have',);
    },
    quotas: async () => {
      throw new Error('the stage called a model it should not have',);
    },
  };
}

await describe({
  name: runEditorStage.name,
  children: [
    it({
      name: 'REFUSES AN UNJUDGEABLE ROSTER BEFORE CALLING ANYTHING. Selection '
        + 'removes producers from the judge roster, so a roster that looks '
        + 'large enough can leave too few disinterested judges; discovering '
        + 'that after the fan-out would mean paying for a whole editor round '
        + 'whose output could never be judged',
      fn: async () => {
        await expect(
          runEditorStage({
            client: neverCalledClient(),
            editorModelIds: EDITORS,
            // Every judge also edits, so nobody is disinterested.
            judgeModelIds: EDITORS,
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
            envelopes: ENVELOPES,
            issues: ISSUES,
            signal: new AbortController().signal,
            perCallTimeoutMs: 1_000,
            l,
          },),
        ).rejects.toThrow(EditorRosterError,);
      },
    },),

    it({
      name: 'returns the translation UNTOUCHED and calls no judge when every '
        + 'editor proposed nothing, so a slice the editors declined costs one '
        + 'editor round and not a judging round on top of it',
      fn: async () => {
        /**
         * Exchange counter, so judge calls would be visible as extra calls.
         */
        const calls = { count: 0, };

        /**
         * Stage where both editors returned an empty edit list.
         */
        const result = await runEditorStage({
          client: editorClient({
            report: { edits: [], },
            calls,
          },),
          editorModelIds: EDITORS,
          judgeModelIds: JUDGES,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          envelopes: ENVELOPES,
          issues: ISSUES,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);

        expect(result.patch.patchedText,).toBe(TARGET_TEXT,);
        expect(result.patch.applied,).toStrictEqual([],);
        expect(result.heardEditors,).toBe(EDITORS.length,);
        // Exactly one exchange per editor, and nothing more.
        expect(calls.count,).toBe(EDITORS.length,);
      },
    },),

    it({
      name: 'takes the same untouched exit when every proposed operation was '
        + 'REJECTED by the apply gate, since a candidate that landed no '
        + 'operation is the untouched translation and judging identical texts '
        + 'would spend calls to learn nothing',
      fn: async () => {
        /**
         * Exchange counter for this case.
         */
        const calls = { count: 0, };

        /**
         * Stage where both editors named a region that is not on the sheet.
         */
        const result = await runEditorStage({
          client: editorClient({
            report: {
              edits: [
                {
                  region: 9,
                  newText: 'The dog barks.',
                },
              ],
            },
            calls,
          },),
          editorModelIds: EDITORS,
          judgeModelIds: JUDGES,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          envelopes: ENVELOPES,
          issues: ISSUES,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);

        expect(result.patch.patchedText,).toBe(TARGET_TEXT,);
        expect(calls.count,).toBe(EDITORS.length,);
        expect(result.findings.length,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'records how many editors were heard and how many repaired, so a '
        + 'slice decided by half the roster is visible in the scorecard rather '
        + 'than reading like a full-roster result',
      fn: async () => {
        /**
         * Exchange counter for this case.
         */
        const calls = { count: 0, };

        /**
         * Stage where both editors declined to propose anything.
         */
        const result = await runEditorStage({
          client: editorClient({
            report: { edits: [], },
            calls,
          },),
          editorModelIds: EDITORS,
          judgeModelIds: JUDGES,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          envelopes: ENVELOPES,
          issues: ISSUES,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);

        expect(
          result.findings.some(function namesTheCount(finding,) {
            return finding.includes('editor-candidates',)
              && finding.includes('0 repairing',);
          },),
        ).toBe(true,);
      },
    },),
  ],
},);
