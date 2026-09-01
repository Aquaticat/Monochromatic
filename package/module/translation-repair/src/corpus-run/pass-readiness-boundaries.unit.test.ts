/**
 * Tests that production pass boundaries invoke readiness guards before spend or persistence.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  mkdtemp,
  mkdir,
  readdir,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  NaturalnessCompletenessError,
  type PipelineDigest,
  preparePassEntry,
  persistSettledEntry,
  type SettledArtifact,
  type SyntheticClient,
} from '../../dist/final/node/index.mjs';

/**
 * Pairing roster accepted by canned client.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.3-Flash',
  'hf:Qwen/Qwen3.8-27B',
] as const;

/**
 * Pipeline generation for disposable cache.
 */
const GENERATION = `sha256-tree-v1:${'a'.repeat(64,)}` as PipelineDigest;

/**
 * Logger for production-boundary calls.
 */
const l = tagged({ tag: 'pass-readiness-boundaries-test', },);

/**
 * Builds client whose pairing seats agree only first target block corresponds.
 *
 * @returns Client serving pairing JSON
 *
 * @example
 * ```ts
 * const client = pairingClient();
 * ```
 */
function pairingClient(): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText not used',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /** Stage schema deciding scripted reply. */
      const schema = request.responseFormat?.json_schema.name ?? '';
      /** Pairing or archive-review value. */
      const value: unknown = schema === 'archive_block_review'
        ? {
          disposition: 'editorial-context',
          sourceQuote: '',
          replacementText: '',
          finding: 'This is an archive note.',
        }
        : schema === 'absolute_naturalness_review'
        ? {
          acceptable: true,
          findings: [],
          reason: 'The attribution is natural and publication-ready.',
        }
        : { pairs: [{ source: 0, target: 0, },], };
      if (!request.validate(value,))
        throw new Error(`scripted ${schema} reply failed validator`,);
      return {
        kind: 'ok',
        value,
        rawText: JSON.stringify(value,),
      };
    },
    quotas: async () => {
      throw new Error('quotas not used',);
    },
  };
}

/**
 * Builds artifact shape sufficient to prove persistence guard runs first.
 *
 * @returns Artifact whose contest declined archive and consolidation replaced nothing
 *
 * @example
 * ```ts
 * const artifact = declinedArtifact();
 * ```
 */
function declinedArtifact(): SettledArtifact {
  return {
    comparison: [{
      sliceIndex: 0,
      incumbentKind: 'present',
      incumbentText: 'The cat naps.',
      repairText: 'The cat is asleep.',
      translateText: 'A cat naps.',
      laneRelation: 'both-differ',
      repairOutcome: { kind: 'decided', acceptedText: 'The cat is asleep.', },
      translateOutcome: { kind: 'decided', acceptedText: 'A cat naps.', },
      decisionComparison: { kind: 'comparable', verdict: 'different', },
      repairDelivery: { kind: 'replacement-shipped', },
      translateDelivery: { kind: 'replacement-shipped', },
    },],
    laneSelection: {
      kind: 'contested',
      slices: [{
        sliceIndex: 0,
        verdict: { kind: 'settled-neither', archive: 'declined', },
        ballots: [],
        usable: 10,
      },],
    },
    consolidation: { kind: 'not-run', },
  } as unknown as SettledArtifact;
}

/**
 * Builds artifact whose final body polish lacks absolute review.
 *
 * @returns Artifact final-selection guard accepts and naturalness guard refuses
 *
 * @example
 * ```ts
 * const artifact = unreviewedNaturalnessArtifact();
 * ```
 */
function unreviewedNaturalnessArtifact(): SettledArtifact {
  return {
    comparison: [{
      sliceIndex: 0,
      incumbentKind: 'present',
      incumbentText: 'The cat naps.',
      repairText: 'The cat is asleep.',
      translateText: 'A cat naps.',
      laneRelation: 'both-differ',
      repairOutcome: { kind: 'decided', acceptedText: 'The cat is asleep.', },
      translateOutcome: { kind: 'decided', acceptedText: 'A cat naps.', },
      decisionComparison: { kind: 'comparable', verdict: 'different', },
      repairDelivery: { kind: 'replacement-shipped', },
      translateDelivery: { kind: 'replacement-shipped', },
    },],
    laneSelection: {
      kind: 'contested',
      slices: [{
        sliceIndex: 0,
        verdict: { kind: 'lane-won', lane: 'translate', },
        ballots: [],
        usable: 2,
      },],
    },
    consolidation: {
      kind: 'settled',
      slices: [{
        sliceIndex: 0,
        terminal: 'gate-kept-standing',
        shipped: { kind: 'unchanged', },
        rewrapped: false,
        demoted: false,
        verdicts: [],
        gate: { kind: 'not-asked', },
        polish: {
          kind: 'settled',
          baseText: 'A cat naps.',
          proposedText: 'A cat naps.',
          text: 'A cat naps.',
          changed: false,
          refinersHeard: [],
          contributors: [],
          roundCount: 0,
          findings: [],
        },
      },],
    },
  } as unknown as SettledArtifact;
}

await describe({
  name: 'pass readiness boundaries',
  children: [
    it({
      name: 'REVIEWS roster-unclaimed editorial archive before lane work',
      fn: async () => {
        const dir = await mkdtemp(join(tmpdir(), 'pass-prepare-readiness-',),);
        const paired = await preparePassEntry({
          client: pairingClient(),
          entryId: 'Cat',
          entryCacheDir: dir,
          pipelineDigest: GENERATION,
          modelIds: ROSTER,
          sourceText: 'Cats nap.',
          targetText: 'Cats nap.\n\nTranslator: Cat Friend.',
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);
        await rm(dir, { recursive: true, force: true, },);

        expect(paired.prepared.targetText,).toContain('Translator: Cat Friend.');
        expect(paired.findings.some(function namesRetainedBlock(finding,): boolean {
          return finding.startsWith('archive block reviewed and retained: ');
        },),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES body without absolute naturalness review before persistence writes page or artifact',
      fn: async () => {
        const root = await mkdtemp(join(tmpdir(), 'pass-persist-naturalness-',),);
        const publishDir = join(root, 'published',);
        const artifactsDir = join(root, 'artifacts',);
        await Promise.all([
          mkdir(publishDir,),
          mkdir(artifactsDir,),
        ],);

        let thrown: unknown;
        try {
          await persistSettledEntry({
            artifact: unreviewedNaturalnessArtifact(),
            slices: [{
              source: {
                kind: 'content',
                sliceIndex: 0,
                nodes: [],
                startOffset: 0,
                endOffset: '猫在睡觉。'.length,
                text: '猫在睡觉。',
              },
              target: {
                kind: 'content',
                sliceIndex: 0,
                nodes: [],
                startOffset: 0,
                endOffset: 'The cat naps.'.length,
                text: 'The cat naps.',
              },
            },],
            archiveText: 'The cat naps.',
            sourceText: '猫在睡觉。',
            entryId: 'Cat',
            publishDir,
            artifactsDir,
            l,
          },);
        }
        catch (error) {
          thrown = error;
        }

        const written = await Promise.all([
          readdir(publishDir,),
          readdir(artifactsDir,),
        ],);
        await rm(root, { recursive: true, force: true, },);

        expect(thrown,).toBeInstanceOf(NaturalnessCompletenessError,);
        expect(written,).toEqual([
          [],
          [],
        ],);
      },
    },),

    it({
      name: 'RECORDS unendorsed archive as a finding instead of refusing final selection',
      fn: async () => {
        const root = await mkdtemp(join(tmpdir(), 'pass-persist-readiness-',),);
        const publishDir = join(root, 'published',);
        const artifactsDir = join(root, 'artifacts',);
        await Promise.all([
          mkdir(publishDir,),
          mkdir(artifactsDir,),
        ],);

        let thrown: unknown;
        try {
          await persistSettledEntry({
            artifact: declinedArtifact(),
            slices: [{
              source: {
                kind: 'content',
                sliceIndex: 0,
                nodes: [],
                startOffset: 0,
                endOffset: '猫在睡觉。'.length,
                text: '猫在睡觉。',
              },
              target: {
                kind: 'content',
                sliceIndex: 0,
                nodes: [],
                startOffset: 0,
                endOffset: 'The cat naps.'.length,
                text: 'The cat naps.',
              },
            },],
            archiveText: 'The cat naps.',
            sourceText: '猫在睡觉。',
            entryId: 'Cat',
            publishDir,
            artifactsDir,
            l,
          },);
        }
        catch (error) {
          thrown = error;
        }

        const written = await Promise.all([
          readdir(publishDir,),
          readdir(artifactsDir,),
        ],);
        await rm(root, { recursive: true, force: true, },);

        // The contest non-endorsement no longer refuses the page: the next
        // boundary this minimal fixture trips is the structural naturalness
        // completeness, proving final selection recorded instead of throwing.
        expect(thrown,).toBeInstanceOf(NaturalnessCompletenessError,);
        expect(written,).toEqual([
          [],
          [],
        ],);
      },
    },),
  ],
},);
