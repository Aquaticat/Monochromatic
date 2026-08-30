/**
 * Tests archive-block context, reverse splicing, removal, and preparation cycles.
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
  prepareDocumentPair,
  preparePassEntry,
  repairArchiveBlocks,
  type SyntheticClient,
  TranslationRepairInterruptedError,
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
      name: 'PAUSES alternating archive preparations on repeated exact page state',
      fn: async () => {
        const dir = await mkdtemp(join(tmpdir(), 'archive-block-cycle-',),);
        let thrown: unknown;
        try {
          await preparePassEntry({
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
        }
        catch (error) {
          thrown = error;
        }
        await rm(dir, { recursive: true, force: true, },);

        expect(thrown,).toBeInstanceOf(TranslationRepairInterruptedError,);
        expect((thrown as TranslationRepairInterruptedError).reason,).toBe('archive-block-unresolved');
      },
    },),
  ],
},);
