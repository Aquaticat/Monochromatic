/**
 Tests for production proof before translating source-only passages.
 
 A live page had one wholly omitted linked factual paragraph, but verbose
 English elsewhere made whole-page length look complete. These cat fixtures
 pin that local destination evidence rescues that class only when whole-page
 coverage independently says the passage is absent.
 
 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  decidePassInsertionAdmission,
  makeInsertionChunk,
  messageText,
  SEAT_SYNTHETIC_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  TranslationRepairInterruptedError,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type ChunkPair,
  type InsertionAdmission,
  type PreparedDocumentPair,
  type RosterModelId,
  type SyntheticClient,
} from '../../dist/final/node/index.mjs';

/**
 Production-shaped test roster.
 */
const ROSTER: readonly RosterModelId[] = [
  SEAT_SYNTHETIC_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
];

/**
 Coverage reply one roster seat returns.
 */
type ScriptedCoverage = {
  readonly coverage: 'full' | 'partial' | 'none';
  readonly quote: string;
};

/**
 Scripted provider voice that fails before returning coverage.
 */
const COVERAGE_VOICE_LOST: unique symbol = Symbol('scripted coverage voice lost',);

/**
 One scripted seat outcome.
 */
type ScriptedCoverageOutcome = ScriptedCoverage | typeof COVERAGE_VOICE_LOST;

/**
 No-op logger accepted by production module.
 */
const l = tagged({ tag: 'pass-insertion-admission-test', },);

/**
 Whole target carrying enough unrelated prose to defeat page shortfall.
 */
const LONG_TARGET = `## Cats\n\n${'The cat sleeps in warm sunlight. '.repeat(20,)}`;

/**
 Builds one prepared source-only passage.
 
 @param sourcePassage - original with no target wording beside it
 
 @param targetText - whole translation searched by coverage
 
 @returns Preparation holding one insertion slice
 
 @example
 ```ts
 const prepared = preparedGap({ sourcePassage: '猫。', targetText: '' });
 ```
 */
function preparedGap(
  {
    sourcePassage,
    targetText,
  }: {
    readonly sourcePassage: string;
    readonly targetText: string;
  },
): PreparedDocumentPair {
  return {
    sourceText: `${sourcePassage}\n${'猫在窗台晒太阳。'.repeat(20,)}`,
    targetText,
    slices: [{
      source: {
        kind: 'content',
        sliceIndex: 0,
        nodes: [],
        startOffset: 0,
        endOffset: sourcePassage.length,
        text: sourcePassage,
      },
      target: makeInsertionChunk({
        sliceIndex: 0,
        offset: 0,
      },),
    },],
    lineStructuredSliceIndices: new Set(),
    declaredNames: [],
    alignmentFindings: [],
    unclaimedTargetBlocks: [],
    alignmentPairCount: 1,
  };
}

/**
 Client returning one scripted coverage reply per seat, or failing that seat.
 
 @param replies - initial roster-order replies
 
 @param followupReplies - replies to prior-verdict challenge
 
 @returns Client serving only coverage stage
 
 @example
 ```ts
 const client = coverageClient({ replies: [{ coverage: 'none', quote: '' }] });
 ```
 */
function coverageClient(
  {
    replies,
    followupReplies = [],
  }: {
    readonly replies: readonly ScriptedCoverageOutcome[];
    readonly followupReplies?: readonly ScriptedCoverageOutcome[];
  },
): SyntheticClient {
  /**
   Iterator advancing one response per roster seat.
   */
  const responses = replies.values();
  /**
   Follow-up responses advanced independently from initial recovery retries.
   */
  const followups = followupReplies.values();
  return {
    chatText: async () => {
      throw new Error('chatText unused by coverage',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       Next scripted seat outcome, which must exist for every requested seat.
       */
      /**
       Whether latest unresolved verdict is present in this prompt.
       */
      const isFollowup = request.messages.some(function hasPriorVerdict(message,): boolean {
        return messageText({ message, },).includes('PRIOR UNRESOLVED VERDICT',);
      },);
      const next = isFollowup ? followups.next() : responses.next();
      if (next.done === true)
        throw new Error('coverage stage asked beyond scripted roster',);
      const { value: reply, } = next;
      if ((typeof reply) === 'symbol') {
        if (reply === COVERAGE_VOICE_LOST)
          throw new Error('scripted lost coverage voice',);
        throw new Error('unknown scripted coverage outcome',);
      }
      const value: unknown = {
        ...reply,
        reason: 'scripted',
      };
      if (!request.validate(value,))
        throw new Error('scripted coverage reply failed wire guard',);
      return {
        kind: 'ok',
        value: value as ValueT,
        rawText: JSON.stringify(value,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by coverage',);
    },
  };
}

/**
 Runs one admission case.
 
 @param sourcePassage - insertion source
 
 @param targetText - whole target page
 
 @param replies - initial roster replies
 
 @param followupReplies - replies to prior-verdict challenge
 
 @returns Admission from production module
 
 @example
 ```ts
 const admission = await runAdmission({ sourcePassage: '猫。', targetText: '', replies: [] });
 ```
 */
async function runAdmission(
  {
    sourcePassage,
    targetText,
    replies,
    followupReplies,
  }: {
    readonly sourcePassage: string;
    readonly targetText: string;
    readonly replies: readonly ScriptedCoverageOutcome[];
    readonly followupReplies?: readonly ScriptedCoverageOutcome[];
  },
): Promise<InsertionAdmission> {
  return await decidePassInsertionAdmission({
    client: coverageClient({
      replies,
      ...((followupReplies === undefined) ? {} : { followupReplies, }),
    },),
    prepared: preparedGap({ sourcePassage, targetText, },),
    modelIds: ROSTER,
    overlap: 1,
    signal: new AbortController().signal,
    perCallTimeoutMs: 1_000,
    l,
  },);
}

/**
 Opening half of a disclosure block the archive never carried: the tag and
 its summary, which the slicer gives to the first block inside the container.
 */
const OPEN_HALF = '<details style="margin-top: 0.5rem;">\n<summary>猫的故事</summary>';

/**
 Closing half of the same block: its last paragraph and the closing tag.
 */
const CLOSE_HALF = '猫在夜里回家了。\n\n</details>';

/**
 Builds a preparation whose two source-only slices own one container's halves.

 @param targetText - whole translation searched by coverage

 @returns Preparation holding the opening half at slice 0 and the closing half at slice 1

 @example
 ```ts
 const prepared = preparedHalves({ targetText: 'Cat.', },);
 ```
 */
function preparedHalves({ targetText, }: { readonly targetText: string; },): PreparedDocumentPair {
  /**
   Offset of the closing half in the source.
   */
  const closeStart = OPEN_HALF.length + 2;
  return {
    sourceText: `${OPEN_HALF}\n\n${CLOSE_HALF}\n${'猫在窗台晒太阳。'.repeat(20,)}`,
    targetText,
    slices: [
      {
        source: {
          kind: 'content',
          sliceIndex: 0,
          nodes: [],
          startOffset: 0,
          endOffset: OPEN_HALF.length,
          text: OPEN_HALF,
        },
        target: makeInsertionChunk({ sliceIndex: 0, offset: 0, },),
      },
      {
        source: {
          kind: 'content',
          sliceIndex: 1,
          nodes: [],
          startOffset: closeStart,
          endOffset: closeStart + CLOSE_HALF.length,
          text: CLOSE_HALF,
        },
        target: makeInsertionChunk({ sliceIndex: 1, offset: 0, },),
      },
    ],
    lineStructuredSliceIndices: new Set(),
    declaredNames: [],
    alignmentFindings: [],
    unclaimedTargetBlocks: [],
    alignmentPairCount: 2,
  };
}

/**
 Repeats one reply across whole roster.
 
 @param reply - answer every seat gives
 
 @returns One answer per roster seat
 
 @example
 ```ts
 const replies = unanimous({ coverage: 'none', quote: '' });
 ```
 */
function unanimous(reply: ScriptedCoverage,): readonly ScriptedCoverage[] {
  return ROSTER.map(function sameReply(): ScriptedCoverage {
    return reply;
  },);
}

await describe({
  name: decidePassInsertionAdmission.name,
  children: [
    it({
      name: 'ADMITS a linked factual passage on destination evidence when roster says whole passage is absent, '
        + 'even though unrelated verbosity makes whole page look long enough',
      fn: async () => {
        const admission = await runAdmission({
          sourcePassage: 'The cat record is linked at [memo](https://example.test/cat-record).',
          targetText: LONG_TARGET,
          replies: unanimous({ coverage: 'none', quote: '', },),
        },);
        expect([...admission.positions,],).toEqual([0,],);
      },
    },),
    it({
      name: 'ADMITS a link-free passage within whole-page shortfall when roster says it is absent',
      fn: async () => {
        const admission = await runAdmission({
          sourcePassage: '猫的记录没有译文。',
          targetText: 'Cat.',
          replies: unanimous({ coverage: 'none', quote: '', },),
        },);
        expect([...admission.positions,],).toEqual([0,],);
      },
    },),
    it({
      name: 'REFUSES an absent verdict with neither deterministic corroborator, preserving duplicate protection',
      fn: async () => {
        // Not admitted and not thrown: the round settles once and the refusal
        // lives on the findings instead of pausing the entry.
        const admission = await runAdmission({
          sourcePassage: '猫的记录没有译文。',
          targetText: LONG_TARGET,
          replies: unanimous({ coverage: 'none', quote: '', },),
        },);
        expect([...admission.positions,],).toEqual([],);
        expect(
          admission.findings
            .some(function namesUnresolved(finding,): boolean {
              return finding.includes('insertion-unresolved-after-single-round',);
            },),
        ).toBe(true,);
      },
    },),
    it({
      name: 'RECORDS full coverage as carried elsewhere instead of insertion or interruption',
      fn: async () => {
        const admission = await runAdmission({
          sourcePassage: '[Cat](https://example.test/cat-record) sleeps.',
          targetText: LONG_TARGET,
          replies: unanimous({ coverage: 'full', quote: '## Cats\n\nThe cat sleeps in warm sunlight.', },),
        },);
        expect([...admission.positions,],).toEqual([],);
        expect(admission.carried,).toEqual([{
          position: 0,
          sliceIndex: 0,
          sourceText: '[Cat](https://example.test/cat-record) sleeps.',
          evidence: [
            '## Cats\n\nThe cat sleeps in warm sunlight.',
            '## Cats\n\nThe cat sleeps in warm sunlight.',
            '## Cats\n\nThe cat sleeps in warm sunlight.',
          ],
        },],);
      },
    },),
    it({
      name: 'REFUSES partial coverage because inserting whole passage would duplicate carried content',
      fn: async () => {
        // An empty follow-up script doubles as the no-re-ask proof: any second
        // coverage round would throw inside the scripted client.
        const admission = await runAdmission({
          sourcePassage: '[Cat](https://example.test/cat-record) sleeps and dreams.',
          targetText: LONG_TARGET,
          replies: unanimous({ coverage: 'partial', quote: 'The cat sleeps in warm sunlight.', },),
        },);
        expect([...admission.positions,],).toEqual([],);
        expect(admission.carried,).toEqual([],);
        expect(
          admission.findings
            .some(function namesUnresolved(finding,): boolean {
              return finding.includes('insertion-unresolved-after-single-round (slice 0',);
            },),
        ).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES a split roster in one round rather than treating one absence voice as proof',
      fn: async () => {
        // The scripted follow-up would prove absence, but no follow-up may be
        // asked: the single round records the split and moves on.
        // THE FULL QUOTE MUST ANCHOR: the bare sentence occurs twenty times in
        // the target and locates nowhere (ambiguous-quote), which left this
        // fixture split between an absence and an unanchorable claim, the shape
        // class forty-eight now admits by the shortfall; the heading makes it
        // unique, so the split here is between two anchored, opposite votes.
        const admission = await runAdmission({
          sourcePassage: '[Cat](https://example.test/cat-record) sleeps.',
          targetText: LONG_TARGET,
          replies: [
            { coverage: 'full', quote: '## Cats\n\nThe cat sleeps in warm sunlight.', },
            { coverage: 'none', quote: '', },
            COVERAGE_VOICE_LOST,
          ],
          followupReplies: unanimous({ coverage: 'none', quote: '', },),
        },);
        expect([...admission.positions,],).toEqual([],);
        expect(
          admission.findings
            .some(function namesUnresolved(finding,): boolean {
              return finding.includes('insertion-unresolved-after-single-round',);
            },),
        ).toBe(true,);
      },
    },),
    it({
      name: 'ADMITS THE OPENING HALF OF A CONTAINER BESIDE ITS ADMITTED CLOSING HALF when the roster split on '
        + 'the summary alone (class fifty-seven, XingZ607: two disclosure blocks lost their opening halves, '
        + 'the closing tags shipped alone, and the translate lane withdrew every slice)',
      fn: async () => {
        // Slice 0, the summary, splits one full against one partial against one
        // absent, all anchored, so on its own it stays unresolved; slice 1, the
        // block's end, is absent by every voice and the page is short of it.
        const admission = await decidePassInsertionAdmission({
          client: coverageClient({
            replies: [
              { coverage: 'full', quote: 'Cat.', },
              { coverage: 'partial', quote: 'Cat.', },
              { coverage: 'none', quote: '', },
              ...unanimous({ coverage: 'none', quote: '', },),
            ],
          },),
          prepared: preparedHalves({ targetText: 'Cat.', },),
          modelIds: ROSTER,
          overlap: 1,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect([...admission.positions,].toSorted(function ascending(
          left,
          right,
        ): number {
          return left - right;
        },),).toEqual([0, 1,],);
        expect(
          admission.findings
            .some(function namesTheHalf(finding,): boolean {
              return finding.startsWith('insertion-container-half-admitted (slice 0 beside slice 1',);
            },),
        ).toBe(true,);
      },
    },),
    it({
      name: 'LEAVES BOTH HALVES UNFILLED when neither is admitted on its own evidence, so the rule widens '
        + 'nothing without a corroborated half',
      fn: async () => {
        const admission = await decidePassInsertionAdmission({
          client: coverageClient({
            replies: [
              { coverage: 'full', quote: 'Cat.', },
              { coverage: 'partial', quote: 'Cat.', },
              { coverage: 'none', quote: '', },
              { coverage: 'full', quote: 'Cat.', },
              { coverage: 'partial', quote: 'Cat.', },
              { coverage: 'none', quote: '', },
            ],
          },),
          prepared: preparedHalves({ targetText: 'Cat.', },),
          modelIds: ROSTER,
          overlap: 1,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect([...admission.positions,],).toEqual([],);
        expect(
          admission.findings
            .some(function namesTheHalf(finding,): boolean {
              return finding.startsWith('insertion-container-half-admitted',);
            },),
        ).toBe(false,);
      },
    },),
    it({
      name: 'THROWS provider-unavailable when every coverage voice is lost, never a quality refusal',
      fn: async () => {
        let thrown: unknown;
        try {
          await runAdmission({
            sourcePassage: '[Cat](https://example.test/cat-record) sleeps.',
            targetText: LONG_TARGET,
            replies: [ COVERAGE_VOICE_LOST, COVERAGE_VOICE_LOST, COVERAGE_VOICE_LOST, ],
          },);
        }
        catch (error) {
          thrown = error;
        }
        expect(thrown,).toBeInstanceOf(TranslationRepairInterruptedError,);
        expect((thrown as TranslationRepairInterruptedError).reason,).toBe('provider-unavailable');
      },
    },),
    it({
      name: 'TREATS trailing-slash destination spellings as same address rather than false local corroboration',
      fn: async () => {
        const admission = await runAdmission({
          sourcePassage: '[Cat](https://example.test/cat-record/) sleeps.',
          targetText: `${LONG_TARGET}\nhttps://example.test/cat-record`,
          replies: unanimous({ coverage: 'none', quote: '', },),
        },);
        expect([...admission.positions,],).toEqual([],);
      },
    },),
    it({
      name: 'READS a reference-style source destination as local corroboration',
      fn: async () => {
        const admission = await runAdmission({
          sourcePassage: '[Cat memo][memo]\n\n[memo]: https://example.test/cat-record',
          targetText: LONG_TARGET,
          replies: unanimous({ coverage: 'none', quote: '', },),
        },);
        expect([...admission.positions,],).toEqual([0,],);
      },
    },),
  ],
},);

/**
 Paragraph the archive never carried, holding a source link and a marker:
 the link admits it on destination evidence whatever the budget has left.
 */
const MARKER_PASSAGE = '猫的记录见[备忘](https://example.test/cat-record)[^1]。';

/**
 Builds a preparation whose two source-only slices are a marker's paragraph and a definition.

 @param definition - definition block standing last, as definitions do

 @returns Preparation holding the paragraph at slice 0 and the definition at slice 1

 @example
 ```ts
 const prepared = preparedDefinition({ definition: '[^1]: 猫。', },);
 ```
 */
function preparedDefinition({ definition, }: { readonly definition: string; },): PreparedDocumentPair {
  /**
   Offset of the definition in the source.
   */
  const definitionStart = MARKER_PASSAGE.length + 2;
  return {
    sourceText: `${MARKER_PASSAGE}\n\n${definition}\n`,
    targetText: LONG_TARGET,
    slices: [
      {
        source: {
          kind: 'content',
          sliceIndex: 0,
          nodes: [],
          startOffset: 0,
          endOffset: MARKER_PASSAGE.length,
          text: MARKER_PASSAGE,
        },
        target: makeInsertionChunk({ sliceIndex: 0, offset: 0, },),
      },
      {
        source: {
          kind: 'content',
          sliceIndex: 1,
          nodes: [],
          startOffset: definitionStart,
          endOffset: definitionStart + definition.length,
          text: definition,
        },
        target: makeInsertionChunk({ sliceIndex: 1, offset: 0, },),
      },
    ],
    lineStructuredSliceIndices: new Set(),
    declaredNames: [],
    alignmentFindings: [],
    unclaimedTargetBlocks: [],
    alignmentPairCount: 2,
  };
}

await describe({
  name: 'a definition the budget refused beside the marker that references it (class fifty-nine, XingZ608)',
  children: [
    it({
      name: 'ADMITS THE DEFINITION BESIDE THE ADMITTED MARKER when the whole-page budget has no room left '
        + '(XingZ608: the budget ran out 80 code points before the definitions and the assembly withdrew '
        + 'every marker carrier)',
      fn: async () => {
        // Both slices are absent by every voice; the page is long, so only the
        // link admits slice 0, and slice 1 is admitted by slice 0's marker.
        const admission = await decidePassInsertionAdmission({
          client: coverageClient({
            replies: [
              ...unanimous({ coverage: 'none', quote: '', },),
              ...unanimous({ coverage: 'none', quote: '', },),
            ],
          },),
          prepared: preparedDefinition({ definition: '[^1]: 猫在夜里回家了。', },),
          modelIds: ROSTER,
          overlap: 1,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect([...admission.positions,].toSorted(function ascending(
          left,
          right,
        ): number {
          return left - right;
        },),).toEqual([
          0,
          1,
        ],);
        expect(
          admission.findings
            .some(function namesDefinition(finding,): boolean {
              return finding.startsWith('insertion-definition-admitted (slice 1 defines 1, referenced by slice 0',);
            },),
        ).toBe(true,);
      },
    },),
    it({
      name: 'LEAVES A DEFINITION NOTHING REFERENCES unresolved under the same budget',
      fn: async () => {
        const admission = await decidePassInsertionAdmission({
          client: coverageClient({
            replies: [
              ...unanimous({ coverage: 'none', quote: '', },),
              ...unanimous({ coverage: 'none', quote: '', },),
            ],
          },),
          prepared: preparedDefinition({ definition: '[^2]: 猫不喜欢洗澡。', },),
          modelIds: ROSTER,
          overlap: 1,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect([...admission.positions,],).toEqual([0,],);
        expect(
          admission.findings
            .some(function namesUnresolved(finding,): boolean {
              return finding.startsWith('insertion-unresolved-after-single-round (slice 1',);
            },),
        ).toBe(true,);
      },
    },),
  ],
},);

/**
 Source paragraph the archive translated, standing before the tail.
 */
const TRANSLATED_SOURCE = '橘猫在窗台上睡了整个下午，阳光把它的毛烤得暖烘烘的。';

/**
 Its archive rendering, running long enough that the whole-page budget reads the page as complete.
 */
const TRANSLATED_TARGET = 'The orange cat slept on the windowsill all afternoon while the sun warmed its fur through. '
  .repeat(3,);

/**
 Source paragraph after the archive's last agreed pair, never translated,
 larger than the last pair's rendering could have absorbed.
 */
const TAIL_SOURCE = '猫在夜里回家了，蜷在暖炉旁边睡着了。它梦见了窗台上的阳光，梦见了院子里的麻雀，梦见了那只总在墙头等它的白猫。'
  + '天亮以后，它会再一次出门，沿着老路走到河边去。';

/**
 Builds a preparation whose archive stops after one agreed pair.

 @param tailLast - whether the source-only slice stands after the pair (the tail) or before it (interior)

 @returns Preparation holding one paired slice and one source-only slice

 @example
 ```ts
 const prepared = preparedStoppedArchive({ tailLast: true, },);
 ```
 */
function preparedStoppedArchive({ tailLast, }: { readonly tailLast: boolean; },): PreparedDocumentPair {
  /**
   Slice the archive translated.
   */
  const paired: ChunkPair = {
    source: {
      kind: 'content',
      sliceIndex: tailLast ? 0 : 1,
      nodes: [],
      startOffset: 0,
      endOffset: TRANSLATED_SOURCE.length,
      text: TRANSLATED_SOURCE,
    },
    target: {
      kind: 'content',
      sliceIndex: tailLast ? 0 : 1,
      nodes: [],
      startOffset: 0,
      endOffset: TRANSLATED_TARGET.length,
      text: TRANSLATED_TARGET,
    },
  };
  /**
   Slice the archive never reached.
   */
  const missing: ChunkPair = {
    source: {
      kind: 'content',
      sliceIndex: tailLast ? 1 : 0,
      nodes: [],
      startOffset: 0,
      endOffset: TAIL_SOURCE.length,
      text: TAIL_SOURCE,
    },
    target: makeInsertionChunk({ sliceIndex: tailLast ? 1 : 0, offset: 0, },),
  };
  return {
    sourceText: tailLast
      ? `${TRANSLATED_SOURCE}\n\n${TAIL_SOURCE}\n`
      : `${TAIL_SOURCE}\n\n${TRANSLATED_SOURCE}\n`,
    targetText: TRANSLATED_TARGET,
    slices: tailLast
      ? [
        paired,
        missing,
      ]
      : [
        missing,
        paired,
      ],
    lineStructuredSliceIndices: new Set(),
    declaredNames: [],
    alignmentFindings: [],
    unclaimedTargetBlocks: [],
    alignmentPairCount: 1,
  };
}

await describe({
  name: 'an archive that stops before the source does (owner, 2026-09-19; XingZ608)',
  children: [
    it({
      name: 'ADMITS THE UNTRANSLATED TAIL on the pairing\'s evidence when the translated part runs long enough '
        + 'to spend the whole-page budget',
      fn: async () => {
        const admission = await decidePassInsertionAdmission({
          client: coverageClient({ replies: unanimous({ coverage: 'none', quote: '', },), },),
          prepared: preparedStoppedArchive({ tailLast: true, },),
          modelIds: ROSTER,
          overlap: 1,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect([...admission.positions,],).toEqual([1,],);
        expect(
          admission.findings
            .some(function namesTail(finding,): boolean {
              return finding.includes('insertion-corroboration (slice 1, tail admitted',);
            },),
        ).toBe(true,);
      },
    },),
    it({
      name: 'STILL REFUSES an interior passage on the same long page, since the tail is read off the pairing '
        + 'and the interior keeps the whole-page budget',
      fn: async () => {
        const admission = await decidePassInsertionAdmission({
          client: coverageClient({ replies: unanimous({ coverage: 'none', quote: '', },), },),
          prepared: preparedStoppedArchive({ tailLast: false, },),
          modelIds: ROSTER,
          overlap: 1,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect([...admission.positions,],).toEqual([],);
      },
    },),
  ],
},);
