/**
 * Tests for the introduced-defect probe stage itself: what it asks, what it
 * skips, and how it accounts for probers it could not hear.
 * Fixtures are cat-themed invention mirroring corpus structure only.
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
  messageText,
  EMPTY_INTRODUCED_DEFECT_REPORT,
  type RepairRegion,
  runIntroducedDefectProbe,
  type SyntheticClient,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the probes under test.
 */
const l = tagged({ tag: 'introduced-defect-probe-test', },);

/**
 * Probers the fixtures configure.
 */
const PROBERS: readonly SyntheticModelId[] = [
  'hf:Qwen/Qwen3.8-27B',
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  'hf:openai/gpt-oss-120b',
];

/**
 * Region the editors replaced, dropping the second clause.
 */
const REGION: RepairRegion = {
  envelopeId: 'envelope/nap',
  issueIds: ['adjudicated/nap',],
  before: 'The cat is doing the sleeping, and she wakes at dusk.',
  editorAfter: 'The cat sleeps.',
};

/**
 * Client answering with one scripted check per region, or refusing.
 *
 * @param verdict - verdict every prober casts on every region
 *
 * @param evidence - added-damage quote every prober offers
 *
 * @param silentModelIds - probers whose voice is always lost
 *
 * @param prompts - shared log of every user sheet the stage sent
 *
 * @returns Client the stage calls
 *
 * @example
 * ```ts
 * const client = catClient({ verdict: 'uncertain', },);
 * ```
 */
function catClient(
  {
    verdict = 'no-introduced-defect-found',
    evidence = '',
    silentModelIds = [],
    prompts = [],
  }: {
    readonly verdict?: string;
    readonly evidence?: string;
    readonly silentModelIds?: readonly string[];
    readonly prompts?: string[];
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by the probe',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Last message, whose text the probe records.
       */
      const asked = request.messages.at(-1,);
      prompts.push((asked === undefined) ? '' : messageText({ message: asked, },),);
      if (silentModelIds.includes(request.modelId,)) {
        return {
          kind: 'schema-mismatch',
          rawText: '',
          detail: 'scripted silence',
        };
      }

      /**
       * One check for the single fixture region.
       */
      const scripted: unknown = {
        checks: [
          {
            region: 1,
            verdict,
            category: '',
            severity: '',
            evidence,
            omittedText: '',
            reason: '',
          },
        ],
      };
      if (!request.validate(scripted,))
        throw new Error('scripted payload failed the guard',);
      return {
        kind: 'ok',
        value: scripted,
        rawText: JSON.stringify(scripted,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by the probe',);
    },
  };
}

await describe({
  name: runIntroducedDefectProbe.name,
  children: [
    it({
      name: 'asks nobody when no region was replaced, since a chunk that '
        + 'changed nothing cannot have introduced anything',
      fn: async () => {
        /** Sheets the stage sent, which must stay empty. */
        const prompts: string[] = [];

        const report = await runIntroducedDefectProbe({
          client: catClient({ prompts, },),
          proberModelIds: PROBERS,
          sourceText: '猫在睡觉。',
          baselineText: 'The cat naps.',
          regions: [],
          issues: [],
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect(prompts,).toHaveLength(0,);
        expect(report,).toEqual(EMPTY_INTRODUCED_DEFECT_REPORT,);
      },
    },),

    it({
      name: 'keeps the configured roster size beside the heard count, because '
        + 'two of three heard and two of six configured are different evidence '
        + 'and only the pair tells them apart',
      fn: async () => {
        const report = await runIntroducedDefectProbe({
          client: catClient({ silentModelIds: ['hf:openai/gpt-oss-120b',], },),
          proberModelIds: PROBERS,
          sourceText: '猫在睡觉。',
          baselineText: REGION.before,
          regions: [REGION,],
          issues: [],
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect(report.heardProbers,).toBe(2,);
        expect(report.configuredProbers,).toBe(3,);
        expect(report.regions,).toHaveLength(1,);
        expect(report.regions[0]
          ?.noneFound,).toBe(2,);
      },
    },),

    it({
      name: 'screens each heard prober\'s claim rather than trusting it, so a '
        + 'quote every prober lifted from the baseline lands as contradicted',
      fn: async () => {
        const report = await runIntroducedDefectProbe({
          client: catClient({
            verdict: 'introduced-defect',
            evidence: 'The cat',
          },),
          proberModelIds: PROBERS,
          sourceText: '猫在睡觉。',
          baselineText: REGION.before,
          regions: [REGION,],
          issues: [],
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect(report.regions[0]
          ?.contradicted,).toBe(PROBERS.length,);
        expect(report.regions[0]
          ?.corroborated,).toBe(0,);
        expect(report.regions[0]
          ?.claims,).toHaveLength(PROBERS.length,);
      },
    },),

    it({
      name: 'sends no pre-existing defect list at all by default, which is what '
        + 'stopped the stage answering the same way whether or not damage was '
        + 'present, while still sending both texts the prober has to compare',
      fn: async () => {
        /** Sheets the stage sent. */
        const prompts: string[] = [];

        await runIntroducedDefectProbe({
          client: catClient({ prompts, },),
          proberModelIds: ['hf:Qwen/Qwen3.8-27B',],
          sourceText: '猫在睡觉。',
          baselineText: REGION.before,
          regions: [REGION,],
          issues: [],
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);

        /** Single sheet the one prober received. */
        const sheet = prompts[0] ?? '';
        expect(sheet.includes('PRE-EXISTING',),).toBe(false,);
        expect(sheet.includes('(none recorded)',),).toBe(false,);
        expect(sheet.includes(REGION.editorAfter,),).toBe(true,);
        expect(sheet.includes(REGION.before,),).toBe(true,);
      },
    },),

    it({
      name: 'still renders the list on request, and still shows a prober only '
        + 'the accepted issues of the region it is being asked about, which is '
        + 'what keeps one region\'s prior defects from reading as another\'s',
      fn: async () => {
        /** Sheets the stage sent. */
        const prompts: string[] = [];

        await runIntroducedDefectProbe({
          client: catClient({ prompts, },),
          proberModelIds: ['hf:Qwen/Qwen3.8-27B',],
          sourceText: '猫在睡觉。',
          baselineText: REGION.before,
          regions: [REGION,],
          issues: [],
          disclosure: 'rendered',
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);

        /** Single sheet the one prober received. */
        const sheet = prompts[0] ?? '';
        expect(sheet.includes('PRE-EXISTING',),).toBe(true,);
        expect(sheet.includes('(none recorded)',),).toBe(true,);
      },
    },),
  ],
},);
