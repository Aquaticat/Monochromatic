/**
 * Tests for the resolution checker stage.
 *
 * `runCheckerStage` had no test, and it produces `tallies`, which decide
 * `resolvedIssueIds`. Those feed candidate selection AND the milestone's
 * headline resolution rate, so a defect here does not break a run; it moves the
 * number the milestone is judged on.
 *
 * The stage's own arithmetic lives in `tallyResolutionChecks`, which is tested
 * separately. What is untested here is the wiring: that every heard checker
 * becomes exactly one ballot, that a lost voice reduces the count rather than
 * silently counting as agreement, and that ballot irregularities reach the
 * findings rather than being dropped between the two halves.
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
  runCheckerStage,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the stages under test.
 */
const l = tagged({ tag: 'checker-stage-test', },);

/**
 * Original the checkers judge against.
 */
const SOURCE_TEXT = '猫猫在窗台上睡觉。';

/**
 * Candidate under check.
 */
const PATCHED_TEXT = 'The cat sleeps on the windowsill.';

/**
 * Checker roster, larger than a majority so quorum arithmetic is visible.
 */
const CHECKERS = [
  'hf:zai-org/GLM-5.2',
  'hf:moonshotai/Kimi-K3',
  'hf:Qwen/Qwen3.8-27B',
] as const;

/**
 * Builds one accepted issue the checkers rule on.
 *
 * @param issueId - handle the tallies are keyed by
 *
 * @returns Accepted issue
 *
 * @example
 * ```ts
 * const issue = catIssue({ issueId: 'adjudicated/tense', },);
 * ```
 */
function catIssue({ issueId, }: { readonly issueId: string; },): AdjudicatedIssue {
  return {
    issueId,
    status: 'accepted' as const,
    severity: 'major' as const,
    claims: [],
    tallies: {},
  };
}

/**
 * Client answering each checker with a scripted report, or losing its voice.
 *
 * @param reportFor - report per model; returning undefined loses that voice
 *
 * @returns Client honoring that script
 *
 * @example
 * ```ts
 * const client = checkerClient({ reportFor: () => ({ checks: [], }), },);
 * ```
 */
function checkerClient(
  { reportFor, }: { readonly reportFor: (modelId: string,) => unknown; },
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
      if (scripted === undefined) {
        return {
          kind: 'schema-mismatch',
          rawText: '',
          detail: 'scripted voice loss',
        };
      }
      if (!request.validate(scripted,))
        throw new Error('scripted report failed the resolution guard',);
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
 * Runs the checker stage against a scripted client.
 *
 * @param client - scripted checker client
 *
 * @param issues - accepted issues under check
 *
 * @returns Stage result
 *
 * @example
 * ```ts
 * const result = await runStage({ client, issues, },);
 * ```
 */
async function runStage(
  {
    client,
    issues,
  }: {
    readonly client: SyntheticClient;
    readonly issues: readonly AdjudicatedIssue[];
  },
) {
  return await runCheckerStage({
    client,
    checkerModelIds: CHECKERS,
    sourceText: SOURCE_TEXT,
    patchedText: PATCHED_TEXT,
    issues,
    signal: new AbortController().signal,
    perCallTimeoutMs: 1_000,
    l,
  },);
}

await describe({
  name: runCheckerStage.name,
  children: [
    it({
      name: 'resolves an issue every checker called fixed, which is the '
        + 'ordinary case the resolution rate is built from',
      fn: async () => {
        /**
         * Stage where all three checkers agree the defect is gone.
         */
        const result = await runStage({
          client: checkerClient({
            reportFor: () => ({
              checks: [
                {
                  issue: 1,
                  verdict: 'fixed',
                },
              ],
            }),
          },),
          issues: [catIssue({ issueId: 'adjudicated/tense', },),],
        },);

        expect(result.heardCheckers,).toBe(CHECKERS.length,);
        expect(result.tallies['adjudicated/tense']?.resolved,).toBe(true,);
      },
    },),

    it({
      name: 'refuses to resolve an issue the checkers split on, since a '
        + 'resolution rate built from ties would credit repairs no majority '
        + 'agreed had landed',
      fn: async () => {
        /**
         * Checkers that call the issue fixed; the rest disagree.
         */
        const agreeing: ReadonlySet<string> = new Set([CHECKERS[0],],);

        /**
         * Stage where one checker says fixed and two say not.
         */
        const result = await runStage({
          client: checkerClient({
            reportFor: (modelId,) => ({
              checks: [
                {
                  issue: 1,
                  verdict: agreeing.has(modelId,)
                    ? 'fixed'
                    : 'not-fixed',
                },
              ],
            }),
          },),
          issues: [catIssue({ issueId: 'adjudicated/tense', },),],
        },);

        expect(result.tallies['adjudicated/tense']?.resolved,).toBe(false,);
      },
    },),

    it({
      name: 'COUNTS ONLY HEARD CHECKERS, so a lost voice reduces the count '
        + 'rather than passing silently as agreement: a stage that reported a '
        + 'full roster while two voices were lost would let one checker decide '
        + 'the resolution rate',
      fn: async () => {
        /**
         * Checker that answers; the others lose their voices.
         */
        const answering: ReadonlySet<string> = new Set([CHECKERS[0],],);

        /**
         * Stage where only one of three checkers replied.
         */
        const result = await runStage({
          client: checkerClient({
            reportFor: (modelId,) => 
              answering.has(modelId,)
                ? {
                  checks: [
                    {
                      issue: 1,
                      verdict: 'fixed',
                    },
                  ],
                }
                : undefined
            ,
          },),
          issues: [catIssue({ issueId: 'adjudicated/tense', },),],
        },);

        expect(result.heardCheckers,).toBe(1,);
        expect(result.findings.length,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'produces a tally for EVERY issue it was asked about, including '
        + 'ones no checker mentioned, so an issue silently dropped from a '
        + 'reply reads as unresolved rather than vanishing from the '
        + 'denominator',
      fn: async () => {
        /**
         * Stage over two issues where every reply mentions only the first.
         */
        const result = await runStage({
          client: checkerClient({
            reportFor: () => ({
              checks: [
                {
                  issue: 1,
                  verdict: 'fixed',
                },
              ],
            }),
          },),
          issues: [
            catIssue({ issueId: 'adjudicated/tense', },),
            catIssue({ issueId: 'adjudicated/meaning', },),
          ],
        },);

        expect(Object.keys(result.tallies,).toSorted(),).toStrictEqual([
          'adjudicated/meaning',
          'adjudicated/tense',
        ],);
        expect(result.tallies['adjudicated/meaning']?.resolved,).toBe(false,);
      },
    },),

    it({
      name: 'carries BALLOT irregularities into the findings alongside quorum '
        + 'ones, so a checker numbering an issue that was never on its sheet '
        + 'reaches the scorecard instead of being dropped between the fan-out '
        + 'and the tally',
      fn: async () => {
        /**
         * Stage where every checker names an issue number off the sheet.
         */
        const result = await runStage({
          client: checkerClient({
            reportFor: () => ({
              checks: [
                {
                  issue: 9,
                  verdict: 'fixed',
                },
              ],
            }),
          },),
          issues: [catIssue({ issueId: 'adjudicated/tense', },),],
        },);

        expect(result.heardCheckers,).toBe(CHECKERS.length,);
        expect(result.findings.length,).toBeGreaterThan(0,);
        expect(result.tallies['adjudicated/tense']?.resolved,).toBe(false,);
      },
    },),

    it({
      name: 'records a WORSE majority as a regression rather than merely as an '
        + 'absent resolution, because selection ranks a regression above total '
        + 'resolution and needs the two told apart',
      fn: async () => {
        /**
         * Stage where every checker says the revision damaged the region.
         */
        const result = await runStage({
          client: checkerClient({
            reportFor: () => ({
              checks: [
                {
                  issue: 1,
                  verdict: 'worse',
                },
              ],
            }),
          },),
          issues: [catIssue({ issueId: 'adjudicated/tense', },),],
        },);

        expect(result.tallies['adjudicated/tense']?.resolved,).toBe(false,);
        expect(result.tallies['adjudicated/tense']?.regressed,).toBe(true,);
      },
    },),

    it({
      name: 'returns empty tallies when there was nothing to check, so a slice '
        + 'with no accepted issues costs no checker calls and reports no '
        + 'resolutions',
      fn: async () => {
        /**
         * Stage over an empty issue list.
         */
        const result = await runStage({
          client: checkerClient({ reportFor: () => ({ checks: [], }), },),
          issues: [],
        },);

        expect(Object.keys(result.tallies,),).toStrictEqual([],);
      },
    },),
  ],
},);
