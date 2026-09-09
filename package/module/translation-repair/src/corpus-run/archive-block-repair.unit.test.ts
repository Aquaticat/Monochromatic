/**
 * Tests archive-block context, reverse splicing, removal, and the linear
 * two-step preparation: one correction round, one re-preparation, remaining
 * unclaimed blocks recorded as findings instead of a cycle pause.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  mkdtemp,
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
  archiveBlockIdentity,
  archiveBlockSourceContexts,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type PipelineDigest,
  type PairedReading,
  prepareDocumentPair,
  preparePassEntry,
  repairArchiveBlocks,
  type SyntheticClient,
  type UnclaimedTargetBlock,
} from '../../dist/final/node/index.mjs';

/** Four-seat review and selection roster. */
const ROSTER = [
  'hf:zai-org/GLM-5.3-Flash',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
  'hf:openai/gpt-oss-120b',
] as const;

/** Disposable pipeline generation. */
const GENERATION = `sha256-tree-v1:${'b'.repeat(64,)}` as PipelineDigest;

/** Test logger. */
const l = tagged({ tag: 'archive-block-repair-test', },);

/**
 * Creates client selecting scripted block replacements.
 *
 * @param replacementFor - replacement derived from exact request prompt
 *
 * @returns Direct scripted client
 */
function correctionClient(
  { replacementFor, }: { readonly replacementFor: (prompt: string) => string; },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText not used',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /** Requested structured role. */
      const schema = request.responseFormat?.json_schema.name ?? '';
      /** Exact messages for replacement routing. */
      const prompt = JSON.stringify(request.messages,);
      /** Scripted valid value. */
      const value: unknown = schema === 'archive_block_review'
        ? {
          disposition: 'revise',
          sourceQuote: '',
          replacementText: replacementFor(prompt,),
          finding: 'Remove unsupported archive-only wording.',
        }
        : schema === 'candidate_ballot'
        ? {
          best: 1,
          reason: 'Correction removes unsupported wording.',
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
 * Constructs block offsets from exact substring.
 *
 * @param targetText - archive containing block once
 *
 * @param blockText - exact block wording
 *
 * @param blockId - parser-like audit id
 *
 * @returns Unclaimed block fixture
 */
function blockAt(
  {
    targetText,
    blockText,
    blockId,
  }: {
    readonly targetText: string;
    readonly blockText: string;
    readonly blockId: string;
  },
): UnclaimedTargetBlock {
  /** Exact start offset. */
  const startOffset = targetText.indexOf(blockText,);
  return {
    location: { kind: 'aligned-pair', pairIndex: 0, },
    blockId,
    startOffset,
    endOffset: startOffset + blockText.length,
  };
}

await describe({
  name: 'archive block repair',
  children: [
    it({
      name: 'SCOPES source support to aligned section named by unclaimed location',
      fn: async () => {
        const prepared = prepareDocumentPair({
          sourceText: 'Cats nap.',
          targetText: 'Cats nap.\n\nAn aside.',
          blockPairings: new Map([[0, [{ source: 0, target: 0, },],],]),
        },);
        const [block,] = prepared.unclaimedTargetBlocks;
        if (block === undefined)
          throw new Error('fixture did not expose unclaimed block',);
        const contexts = archiveBlockSourceContexts({ prepared, });
        expect(
          contexts.get(archiveBlockIdentity({
          block,
          targetText: prepared.targetText,
        },)),
        ).toBe('Cats nap.');
      },
    },),
    it({
      name: 'LIMITS picture support to corroborated assets referenced by the aligned source section',
      fn: async () => {
        /** Aligned source section includes repeated, unavailable and textless references. */
        const sourceText = `<PhotoScroll photos={['\${path}/photos/chat.webp', '\${path}/photos/chat.webp', '\${path}/photos/portrait.webp', '\${path}/photos/unread.webp']} />`;
        /** Unclaimed block in the same aligned section. */
        const blockText = '> Mittens greets her sister.';
        /** Explicit pairing keeps the archive block available for review. */
        const prepared = prepareDocumentPair({
          sourceText,
          targetText: `${sourceText}\n\n${blockText}`,
          blockPairings: new Map([[0, [{ source: 0, target: 0, },],],]),
        },);
        /** Corroborated transcript with each reader's distinct wording preserved. */
        const supported: PairedReading = {
          kind: 'corroborated',
          readings: [
            { modelId: ROSTER[0], text: '手套猫：你好，姐姐。', },
            { modelId: ROSTER[1], text: '你好，姐姐。我们一起回家。', },
          ],
          overlap: 1,
        };
        /** Unrelated and unusable evidence must not license this block. */
        const pictureReadings = new Map<string, PairedReading>([
          ['chat.webp', supported,],
          ['elsewhere.webp', { ...supported, readings: [{ modelId: ROSTER[0], text: '无关内容', },], },],
          ['portrait.webp', { kind: 'no-text', characters: 0, },],
          ['unread.webp', { kind: 'unavailable', reason: 'readers-disagree', transient: false, perReader: [], },],
        ],);
        /** Review contexts produced by the same mapper preparation uses. */
        const contexts = archiveBlockSourceContexts({ prepared, pictureReadings, },);
        /** The block's exact source support. */
        const context = [...contexts.values(),].join('\n',);
        expect(prepared.unclaimedTargetBlocks.length,).toBeGreaterThan(0,);
        expect(context,).toContain('手套猫：你好，姐姐。',);
        expect(context,).toContain('你好，姐姐。我们一起回家。',);
        expect(context,).not.toContain('无关内容',);
        expect(context,).not.toContain('elsewhere.webp',);
        expect(context.split('CORROBORATED PICTURE SOURCE SUPPORT chat.webp',).slice(1,),).toHaveLength(1,);

        /** A target-only location has no source authority even when readings exist. */
        const targetOnly = archiveBlockSourceContexts({
          prepared: {
            ...prepared,
            unclaimedTargetBlocks: prepared.unclaimedTargetBlocks.map(function outside(block,) {
              return { ...block, location: { kind: 'target-section', sectionIndex: 0, }, };
            },),
          },
          pictureReadings,
        },);
        expect([...targetOnly.values(),].every(function empty(value,): boolean {
          return value === '';
        },),).toBe(true,);
      },
    },),
    it({
      name: 'APPLIES multiple selected revisions in reverse offsets including empty removal',
      fn: async () => {
        const first = 'The cat won an award.';
        const second = '[REMOVE BLOCK]';
        const targetText = `${first}\n\n${second}`;
        const blocks = [
          blockAt({ targetText, blockText: first, blockId: 'block/0', }),
          blockAt({ targetText, blockText: second, blockId: 'block/1', }),
        ];
        const sourceContexts = new Map(blocks.map(function context(block,): readonly [string, string] {
          return [archiveBlockIdentity({ block, targetText, }), '猫在睡觉。',] as const;
        },),);
        const repaired = await repairArchiveBlocks({
          client: correctionClient({
            replacementFor: function replacement(prompt,): string {
              return prompt.lastIndexOf(first,) > prompt.lastIndexOf(second,)
                ? 'The cat sleeps.'
                : '';
            },
          },),
          modelIds: ROSTER,
          targetText,
          sourceContexts,
          blocks,
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);

        expect(repaired.targetText,).toBe('The cat sleeps.\n\n');
        expect(repaired.findings,).toHaveLength(2);
      },
    },),
    it({
      name: 'SETTLES after one correction round, recording still-unclaimed blocks as findings',
      fn: async () => {
        const dir = await mkdtemp(join(tmpdir(), 'archive-block-cycle-',),);
        // The corrector that once alternated forever now gets exactly one
        // round: prepare, correct, re-prepare, and whatever stays unclaimed
        // becomes a finding on the returned preparation.
        const paired = await preparePassEntry({
          client: correctionClient({
            replacementFor: function alternate(prompt,): string {
              return prompt.includes('Aside A',) ? 'Aside B' : 'Aside A';
            },
          },),
          entryId: 'Cat',
          entryCacheDir: dir,
          pipelineDigest: GENERATION,
          modelIds: ROSTER,
          sourceText: 'Cats nap.',
          targetText: 'Cats nap.\n\nAside A',
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);
        await rm(dir, { recursive: true, force: true, },);

        expect(paired.prepared
          .targetText
          .includes('Aside B',),).toBe(true,);
        expect(
          paired.findings
            .some(function namesRemaining(finding,): boolean {
              return finding.includes('unclaimed archive blocks remain after the single correction round',);
            },),
        ).toBe(true,);
      },
    },),
  ],
},);
