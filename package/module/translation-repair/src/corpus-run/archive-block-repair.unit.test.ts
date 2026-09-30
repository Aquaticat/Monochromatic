/**
 Tests archive-block context, reverse splicing, removal, and the linear
 two-step preparation: one correction round, one re-preparation, remaining
 unclaimed blocks recorded as findings instead of a cycle pause.
 
 Fixtures are cat-themed invention.
 
 @module
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
  prepareDocumentPair,
  preparePassEntry,
  repairArchiveBlocks,
  type BenchSeating,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type PairedReading,
  type PipelineDigest,
  type RosterModelId,
  type SyntheticClient,
  type UnclaimedTargetBlock,
} from '../../dist/final/node/index.mjs';
import {
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_HYPER_ONLY,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_OPENROUTER_DECISIONS,
  SEAT_OPENROUTER_ONLY,
  SEAT_OPENROUTER_ONLY_CHECKER,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from '../roster-seats.test-fixture.ts';

import { NO_OUTSIDE_READS, } from './pass-outside-reads.test-fixture.ts';

/** Four-seat review and selection roster. */
const ROSTER = [
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
] as const;

/** Disposable pipeline generation. */
const GENERATION = `sha256-tree-v1:${'b'.repeat(64,)}` as PipelineDigest;

/** Test logger. */
const l = tagged({ tag: 'archive-block-repair-test', },);

/**
 Creates client selecting scripted block replacements.
 
 @param replacementFor - replacement derived from exact request prompt
 
 @returns Direct scripted client
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
 Constructs block offsets from exact substring.
 
 @param targetText - archive containing block once
 
 @param blockText - exact block wording
 
 @param blockId - parser-like audit id
 
 @returns Unclaimed block fixture
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
        /** Corroborated transcript; the review reads the one the other readers carry most, the fuller on a tie. */
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
        expect(context,).toContain('你好，姐姐。我们一起回家。',);
        // One transcript per picture (2026-09-16): the shorter reading the
        // fuller one carries is not sent beside it.
        expect(context,).not.toContain('手套猫：你好，姐姐。\n',);
        expect(context,).toContain('2 readers agree',);
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

        // CLASS NINETY-FOUR: a removal takes its own separator with it, so
        // the document does not end in the blank line the removed block owned.
        expect(repaired.targetText,).toBe('The cat sleeps.');
        expect(repaired.findings,).toHaveLength(2);
      },
    },),
    it({
      name: 'RETAINS A REVISION THAT IS THE BLOCK WITH ITS SOFT LINE BREAKS ELSEWHERE, which the site renders '
        + 'as the same page, as it retains one repeating the block byte for byte, and still APPLIES one that '
        + 'changes a word (ledger B26)',
      fn: async () => {
        const first = 'The cat naps on the mat\nall afternoon.';
        const second = 'The dog barks.';
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
              return prompt.lastIndexOf('all afternoon',) > prompt.lastIndexOf(second,)
                ? 'The cat naps on the mat all afternoon.'
                : 'The dog sleeps.';
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

        expect(repaired.targetText,).toBe(`${first}\n\nThe dog sleeps.`);
        expect(repaired.findings.some(function retained(finding,): boolean {
          return finding.startsWith('archive block revision repeated its original wording and was retained',);
        },),).toBe(true);
      },
    },),
    it({
      name: 'LEAVES ONE BLANK LINE where a removed block stood between two others, and none where it '
        + 'opened the body (class ninety-four, XingZ627, 2026-09-23: the archive\'s placeholder line was '
        + 'removed and the page shipped three blank lines after its front matter)',
      fn: async () => {
        const front = '---\nname: Mittens\n---';
        const placeholder = '**Come back later!**';
        const kept = 'The cat sleeps.';
        const targetText = `${front}\n\n${placeholder}\n\n${kept}\n\n[REMOVE MIDDLE]\n\nThe cat wakes.`;
        const blocks = [
          blockAt({ targetText, blockText: placeholder, blockId: 'block/0', }),
          blockAt({ targetText, blockText: '[REMOVE MIDDLE]', blockId: 'block/1', }),
        ];
        const sourceContexts = new Map(blocks.map(function context(block,): readonly [string, string] {
          return [archiveBlockIdentity({ block, targetText, }), '猫在睡觉。',] as const;
        },),);
        const repaired = await repairArchiveBlocks({
          client: correctionClient({
            replacementFor: function replacement(): string {
              return '';
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

        expect(repaired.targetText,).toBe(`${front}\n\n${kept}\n\nThe cat wakes.`);
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
          outsideReads: NO_OUTSIDE_READS,
        },);
        await rm(dir, { recursive: true, force: true, },);

        expect(paired.prepared
          .targetText
          .includes('Aside B',),).toBe(true,);
        expect(
          paired.prepared
            .alignmentFindings
            .some(function namesRemaining(finding,): boolean {
              return finding.includes('unclaimed archive blocks remain after the single correction round',);
            },),
        ).toBe(true,);
      },
    },),
  ],
},);

/**
 Review rosters an alternating hook hands over in turn, disjoint from each
 other and from the fixture's own.
 */
const ALTERNATES: readonly (readonly RosterModelId[])[] = [
  [
    SEAT_HYPER_ONLY,
    SEAT_OPENROUTER_ONLY,
  ],
  [
    SEAT_OPENROUTER_DECISIONS,
    SEAT_OPENROUTER_ONLY_CHECKER,
  ],
];

/**
 One structured call: the seat asked, and how many rosters the hook had
 handed over when it was asked.
 */
type ReviewAsk = {
  /**
   Seat the call asked.
   */
  readonly seat: RosterModelId;
  /**
   Handovers so far, zero before the first.
   */
  readonly handover: number;
};

/**
 Roster the alternating hook handed over at a handover.

 @param handover - handovers so far

 @returns That handover's roster, none before the first

 @example
 ```ts
 const roster = alternateAt({ handover: 1, },);
 ```
 */
function alternateAt({ handover, }: { readonly handover: number; },): readonly RosterModelId[] {
  return (handover === 0) ? [] : (ALTERNATES[(handover - 1) % ALTERNATES.length] ?? []);
}

/**
 Reviews two unclaimed blocks, recording every call's seat and handover.

 @param alternating - whether a hook hands over the alternates in turn, or
 none is given

 @returns Every structured call the review made

 @example
 ```ts
 const asks = await reviewsAsked({ alternating: true, },);
 ```
 */
async function reviewsAsked(
  { alternating, }: { readonly alternating: boolean; },
): Promise<readonly ReviewAsk[]> {
  /**
   Handovers the hook made so far.
   */
  const hook = { handovers: 0, };
  /**
   Every structured call.
   */
  const asks: ReviewAsk[] = [];
  /**
   Scripted reviewer removing each block.
   */
  const inner = correctionClient({
    replacementFor: function replacement(): string {
      return '';
    },
  },);
  /**
   Two archive blocks the pairing left unclaimed.
   */
  const targetText = 'The cat won an award.\n\nThe cat won a second award.';
  /**
   Those blocks.
   */
  const blocks = [
    blockAt({ targetText, blockText: 'The cat won an award.', blockId: 'block/0', }),
    blockAt({ targetText, blockText: 'The cat won a second award.', blockId: 'block/1', }),
  ];
  await repairArchiveBlocks({
    client: {
      chatText: inner.chatText,
      chatJson: async (request,) => {
        asks.push({ seat: request.modelId, handover: hook.handovers, },);
        return await inner.chatJson(request,);
      },
      quotas: inner.quotas,
    },
    modelIds: ROSTER,
    targetText,
    sourceContexts: new Map(blocks.map(function context(block,): readonly [string, string] {
      return [archiveBlockIdentity({ block, targetText, }), '猫在睡觉。',] as const;
    },),),
    blocks,
    signal: new AbortController().signal,
    exchangeTimeoutMs: 5_000,
    l,
    ...(alternating
      ? {
        beforeBlock: async (): Promise<BenchSeating> => {
          hook.handovers += 1;
          return { modelIds: alternateAt({ handover: hook.handovers, },), };
        },
      }
      : {}),
  },);
  return asks;
}

await describe({
  name: `${repairArchiveBlocks.name} re-seated under a hold (ledger X12)`,
  children: [
    it({
      name: 'REVIEWS EACH BLOCK ON THE ROSTER ITS HOOK LAST HANDED OVER, so a roster re-read after a provider '
        + 'dry-out reviews the blocks after it rather than any roster read before it',
      fn: async () => {
        /**
         Calls a caller with no hook made.
         */
        const control = await reviewsAsked({ alternating: false, },);
        /**
         Calls made while the hook alternates the rosters.
         */
        const moved = await reviewsAsked({ alternating: true, },);
        expect({
          controlAskedAny: control.length > 0,
          controlOffRoster: control.filter(function offRoster(ask,): boolean {
            return !(ROSTER as readonly RosterModelId[]).includes(ask.seat,);
          },),
          firstBlockAsked: moved.some(function atFirstHandover(ask,): boolean {
            return ask.handover === 1;
          },),
          secondBlockAsked: moved.some(function atSecondHandover(ask,): boolean {
            return ask.handover === 2;
          },),
          movedStrayed: moved.filter(function strayed(ask,): boolean {
            return !alternateAt({ handover: ask.handover, },).includes(ask.seat,);
          },),
        },).toEqual({
          controlAskedAny: true,
          controlOffRoster: [],
          firstBlockAsked: true,
          secondBlockAsked: true,
          movedStrayed: [],
        },);
      },
    },),
  ],
},);
