/**
 * Tests the reading of how a page's metadata came to stand.
 *
 * THE FIXTURE IS THE TOKA_LS RELAUNCH OF 2026-09-02, read off its slice cache:
 * the translate lane's seven translators agreed on `alias: Toka` for the
 * source's `瞳華` and the judges chose it at weight 3.5; the lane contest chose
 * the repair lane, which carries the archive's `alias: Nonamev` untouched; the
 * consolidation gate then kept that standing text six ballots to two, every
 * standing ballot reasoning that the declared names attest the alias as
 * `Nonamev`. Read off the translate lane alone the page is a withdrawn
 * replacement and the guard refused it (`incumbent-fallback:
 * replacement-not-carried`, on the record before this reading landed). Read off
 * the gate it is a review of the incumbent by a full panel, which is what it
 * was.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChunkPair,
  fallbackDetailOf,
  frontMatterSlice,
  isReviewedKeep,
  type MetadataEvidence,
  type MetadataStanding,
  metadataStandingOf,
  type SliceSelection,
  splitFrontMatter,
} from '../../dist/final/node/index.mjs';

/**
 * Consolidation record as the evidence carries it.
 */
type Consolidation = MetadataEvidence['consolidation'];

/**
 * One settled slice of the consolidation.
 */
type ConsolidateSlice = Extract<Consolidation, { readonly kind: 'settled'; }>['slices'][number];

/**
 * One gate ballot.
 */
type GateBallot = Extract<ConsolidateSlice['gate'], { readonly kind: 'asked'; }>['ballots'][number];

/**
 * Lane selection record as the evidence carries it.
 */
type LaneSelection = MetadataEvidence['laneSelection'];

/**
 * One contested slice.
 */
type ContestSlice = Extract<LaneSelection, { readonly kind: 'contested'; }>['slices'][number];

/**
 * Toka_ls source page, as the corpus carries it at the pinned commit.
 */
const SOURCE_TEXT = '---\nname: 左橋瞳華\ninfo:\n    alias: 瞳華\n    location: 上海\n---\n\nBody.\n';

/**
 * Toka_ls archive page.
 */
const ARCHIVE_TEXT = '---\nname: Toka Sakyo\ninfo:\n    alias: Nonamev\n    location: Shanghai\n---\n\nBody.\n';

/**
 * Parsed source metadata.
 */
const sourceFrontMatter = splitFrontMatter({ text: SOURCE_TEXT, }).frontMatter;
/**
 * Parsed archive metadata.
 */
const archiveFrontMatter = splitFrontMatter({ text: ARCHIVE_TEXT, }).frontMatter;
if ((sourceFrontMatter === undefined) || (archiveFrontMatter === undefined))
  throw new Error('Toka_ls front matter fixture did not parse',);
/**
 * Archive metadata bytes, which the repair lane carries untouched.
 */
const ARCHIVE_RAW: string = archiveFrontMatter.raw;
/**
 * The translate lane's rendering, which differs from the archive in the alias.
 */
const TRANSLATE_RAW = '---\nname: Toka Sakyo\ninfo:\n    alias: Toka\n    location: Shanghai\n---';
/**
 * Explicit metadata slice over the Toka_ls pair.
 */
const paired = frontMatterSlice({
  source: sourceFrontMatter,
  target: archiveFrontMatter,
},);
if (paired.kind !== 'paired')
  throw new Error('Toka_ls front matter fixture did not pair',);
/**
 * Preparation every case shares.
 */
const SLICES: readonly ChunkPair[] = [paired.slice,];

/**
 * Consolidation that never ran.
 */
const NOT_RUN: Consolidation = { kind: 'not-run', };

/**
 * Contest nobody was asked over.
 */
const PENDING: LaneSelection = { kind: 'pending-human-decision', };

/**
 * Both lanes' texts at the metadata slice beside the archive's.
 */
const ROW: MetadataEvidence['comparison'][number] = {
  sliceIndex: 0,
  incumbentText: ARCHIVE_RAW,
  repairText: ARCHIVE_RAW,
  translateText: TRANSLATE_RAW,
};

/**
 * Incumbent producer nobody reproduced.
 */
const INCUMBENT_ALONE: SliceSelection['producer'] = {
  kind: 'incumbent',
  matched: [],
};

/**
 * Translate lane selection for the metadata slice under one decision.
 *
 * @param decision - how the round ended
 *
 * @param origin - whether the winning text was the archive's or fresh
 *
 * @param producer - who wrote the winning text
 *
 * @param voteWeight - weight the winner drew
 *
 * @param shipped - whether the lane's document carries the decision
 *
 * @returns One selection at slice zero
 *
 * @example
 * ```ts
 * const selection = translateSelection({ decision: 'judged', },);
 * ```
 */
function translateSelection(
  {
    decision,
    origin = 'incumbent',
    producer = INCUMBENT_ALONE,
    voteWeight = 0,
    shipped = false,
  }: {
    readonly decision: string;
    readonly origin?: string;
    readonly producer?: SliceSelection['producer'];
    readonly voteWeight?: number;
    readonly shipped?: boolean;
  },
): SliceSelection {
  return {
    sliceIndex: 0,
    origin,
    producer,
    decision,
    voteWeight,
    shipped,
    round: {
      producers: [producer,],
      ballots: [],
    },
  };
}

/**
 * The Toka_ls translate selection: seven translators composed `alias: Toka`
 * and the judges chose it.
 */
const TOKA_TRANSLATE: SliceSelection = translateSelection({
  decision: 'judged',
  origin: 'fresh',
  producer: {
    kind: 'composite',
    contributors: ['hf:zai-org/GLM-5.3-Flash', 'hf:Qwen/Qwen3.8-27B', 'minimax-m3',],
  },
  voteWeight: 3.5,
  shipped: true,
},);

/**
 * One gate ballot.
 *
 * @param choice - rendering this judge would publish
 *
 * @returns Ballot with the Toka_ls reasoning for its side
 *
 * @example
 * ```ts
 * const ballot = gateBallot({ choice: 'standing', },);
 * ```
 */
function gateBallot({ choice, }: { readonly choice: GateBallot['choice']; },): GateBallot {
  return {
    choice,
    unsupported: (choice === 'standing') ? ['consolidated',] : ['standing',],
    unsupportedRaw: [],
    dropped: [],
    droppedRaw: [],
    reason: (choice === 'standing')
      ? 'The declared names attest the translated alias as "Nonamev", which "standing" carries unchanged.'
      : 'The original alias 瞳華 is the given-name form of the same identity, so the alias must be part of "Toka Sakyo".',
  };
}

/**
 * The Toka_ls gate: six ballots for the standing text, two for the consolidated.
 */
const TOKA_GATE_BALLOTS: readonly GateBallot[] = [
  gateBallot({ choice: 'consolidated', },),
  gateBallot({ choice: 'standing', },),
  gateBallot({ choice: 'standing', },),
  gateBallot({ choice: 'consolidated', },),
  gateBallot({ choice: 'standing', },),
  gateBallot({ choice: 'standing', },),
  gateBallot({ choice: 'standing', },),
  gateBallot({ choice: 'standing', },),
];

/**
 * One settled consolidation slice at the metadata slice.
 *
 * @param terminal - how the slice left the stage
 *
 * @param gate - the gate's record, asked or not
 *
 * @returns Consolidation settled at slice zero alone
 *
 * @example
 * ```ts
 * const consolidation = settledAt({ terminal: 'gate-kept-standing', gate: { kind: 'asked', ballots, usable: 8, }, },);
 * ```
 */
function settledAt(
  {
    terminal,
    gate = { kind: 'not-asked', },
  }: {
    readonly terminal: ConsolidateSlice['terminal'];
    readonly gate?: ConsolidateSlice['gate'];
  },
): Consolidation {
  return {
    kind: 'settled',
    slices: [{
      sliceIndex: 0,
      terminal,
      shipped: { kind: 'unchanged', },
      rewrapped: false,
      demoted: false,
      verdicts: [],
      gate,
    },],
  };
}

/**
 * One contested metadata slice.
 *
 * @param verdict - what the roster settled
 *
 * @param usable - ballots that could be counted
 *
 * @returns Contest over slice zero alone
 *
 * @example
 * ```ts
 * const laneSelection = contestedAt({ verdict: { kind: 'lane-won', lane: 'repair', }, usable: 9, },);
 * ```
 */
function contestedAt(
  {
    verdict,
    usable = 9,
  }: {
    readonly verdict: ContestSlice['verdict'];
    readonly usable?: number;
  },
): LaneSelection {
  return {
    kind: 'contested',
    slices: [{
      sliceIndex: 0,
      verdict,
      ballots: [],
      usable,
    },],
  };
}

/**
 * Reads the standing over the Toka_ls preparation and row.
 *
 * @param translateSelections - translate lane's selections
 *
 * @param laneSelection - contest record
 *
 * @param consolidation - consolidation record
 *
 * @param comparison - comparison rows, the Toka_ls row by default
 *
 * @returns The standing read
 *
 * @example
 * ```ts
 * standingWith({ translateSelections: [TOKA_TRANSLATE,], laneSelection: PENDING, consolidation: NOT_RUN, },);
 * ```
 */
function standingWith(
  {
    translateSelections,
    laneSelection,
    consolidation,
    comparison = [ROW,],
  }: {
    readonly translateSelections: readonly SliceSelection[];
    readonly laneSelection: LaneSelection;
    readonly consolidation: Consolidation;
    readonly comparison?: MetadataEvidence['comparison'];
  },
): MetadataStanding {
  return metadataStandingOf({
    slices: SLICES,
    evidence: {
      translateSelections,
      laneSelection,
      consolidation,
      comparison,
    },
  },);
}

await describe({
  name: metadataStandingOf.name,
  children: [
    it({
      name: 'READS THE TOKA_LS CASE AS A GATE KEEP: the translate judges replaced the alias, the '
        + 'contest chose the repair lane, and the consolidation gate kept the standing text six '
        + 'ballots to two, which is a review of the incumbent by a full panel',
      fn: async () => {
        expect(standingWith({
          translateSelections: [TOKA_TRANSLATE,],
          laneSelection: contestedAt({
            verdict: {
              kind: 'lane-won',
              lane: 'repair',
            },
          },),
          consolidation: settledAt({
            terminal: 'gate-kept-standing',
            gate: {
              kind: 'asked',
              ballots: TOKA_GATE_BALLOTS,
              usable: 8,
            },
          },),
        },),).toEqual({
          kind: 'gate-keep',
          usable: 8,
        },);
      },
    },),

    it({
      name: 'READS A GATE THAT SETTLED NEITHER as a fallback under the same terminal, re-settling '
        + 'its ballots with the stage\'s own rule, and a gate never asked as its own fallback',
      fn: async () => {
        expect(standingWith({
          translateSelections: [TOKA_TRANSLATE,],
          laneSelection: contestedAt({
            verdict: {
              kind: 'lane-won',
              lane: 'repair',
            },
          },),
          consolidation: settledAt({
            terminal: 'gate-kept-standing',
            gate: {
              kind: 'asked',
              ballots: [gateBallot({ choice: 'standing', },), gateBallot({ choice: 'consolidated', },),],
              usable: 2,
            },
          },),
        },),).toEqual({
          kind: 'fallback',
          decision: 'gate-neither',
        },);
        expect(standingWith({
          translateSelections: [TOKA_TRANSLATE,],
          laneSelection: PENDING,
          consolidation: settledAt({ terminal: 'gate-kept-standing', },),
        },),).toEqual({
          kind: 'fallback',
          decision: 'gate-not-asked',
        },);
      },
    },),

    it({
      name: 'READS THE OTHER CONSOLIDATION TERMINALS: a consolidated slice as a replacement, an '
        + 'endorsed slate as a slate keep, and a declined or unjudged slate, an incumbent-only '
        + 'floor or an erased difference as fallbacks named by the terminal',
      fn: async () => {
        expect(standingWith({
          translateSelections: [TOKA_TRANSLATE,],
          laneSelection: PENDING,
          consolidation: settledAt({ terminal: 'consolidated', },),
        },),).toEqual({
          kind: 'replaced',
          shipped: true,
        },);
        expect(standingWith({
          translateSelections: [TOKA_TRANSLATE,],
          laneSelection: PENDING,
          consolidation: settledAt({ terminal: 'slate-endorsed-standing', },),
        },),).toEqual({ kind: 'slate-keep', },);
        for (const terminal of [
          'slate-declined-standing',
          'slate-unjudged-standing',
          'incumbent-only',
          'wrap-erased-difference',
        ] as const) {
          expect(standingWith({
            translateSelections: [TOKA_TRANSLATE,],
            laneSelection: PENDING,
            consolidation: settledAt({ terminal, },),
          },),).toEqual({
            kind: 'fallback',
            decision: terminal,
          },);
        }
      },
    },),

    it({
      name: 'READS THE CONTEST where consolidation never ran: a lane won carrying the archive\'s '
        + 'text is a contest keep, a lane won carrying other text is a replacement, neither with '
        + 'the archive endorsed is a contest keep, neither without it and an unmet quorum are '
        + 'fallbacks, and a contested slice with no comparison row is its own fallback',
      fn: async () => {
        expect(standingWith({
          translateSelections: [TOKA_TRANSLATE,],
          laneSelection: contestedAt({
            verdict: {
              kind: 'lane-won',
              lane: 'repair',
            },
          },),
          consolidation: NOT_RUN,
        },),).toEqual({
          kind: 'contest-keep',
          usable: 9,
        },);
        expect(standingWith({
          translateSelections: [TOKA_TRANSLATE,],
          laneSelection: contestedAt({
            verdict: {
              kind: 'lane-won',
              lane: 'translate',
            },
          },),
          consolidation: NOT_RUN,
        },),).toEqual({
          kind: 'replaced',
          shipped: true,
        },);
        expect(standingWith({
          translateSelections: [TOKA_TRANSLATE,],
          laneSelection: contestedAt({
            verdict: {
              kind: 'lane-won',
              lane: 'translate',
            },
          },),
          consolidation: NOT_RUN,
          comparison: [{
            ...ROW,
            translateText: ARCHIVE_RAW,
          },],
        },),).toEqual({
          kind: 'contest-keep',
          usable: 9,
        },);
        expect(standingWith({
          translateSelections: [TOKA_TRANSLATE,],
          laneSelection: contestedAt({
            verdict: {
              kind: 'settled-neither',
              archive: 'endorsed',
            },
            usable: 7,
          },),
          consolidation: NOT_RUN,
        },),).toEqual({
          kind: 'contest-keep',
          usable: 7,
        },);
        expect(standingWith({
          translateSelections: [TOKA_TRANSLATE,],
          laneSelection: contestedAt({ verdict: { kind: 'settled-neither', }, },),
          consolidation: NOT_RUN,
        },),).toEqual({
          kind: 'fallback',
          decision: 'contest-neither',
        },);
        expect(standingWith({
          translateSelections: [TOKA_TRANSLATE,],
          laneSelection: contestedAt({
            verdict: { kind: 'quorum-not-met', },
            usable: 3,
          },),
          consolidation: NOT_RUN,
        },),).toEqual({
          kind: 'fallback',
          decision: 'contest-quorum-not-met',
        },);
        expect(standingWith({
          translateSelections: [TOKA_TRANSLATE,],
          laneSelection: contestedAt({
            verdict: {
              kind: 'lane-won',
              lane: 'repair',
            },
          },),
          consolidation: NOT_RUN,
          comparison: [],
        },),).toEqual({
          kind: 'fallback',
          decision: 'contest-row-missing',
        },);
      },
    },),

    it({
      name: 'READS THE TRANSLATE LANE where the lanes agreed: a judged incumbent win as a judged '
        + 'keep, a sole incumbent every heard translator reproduced as a matched keep, a sole '
        + 'incumbent nobody matched and every decline as fallbacks, and a judged fresh win as a '
        + 'replacement carrying whether the lane shipped it',
      fn: async () => {
        expect(standingWith({
          translateSelections: [translateSelection({
            decision: 'judged',
            voteWeight: 3,
          },),],
          laneSelection: PENDING,
          consolidation: NOT_RUN,
        },),).toEqual({
          kind: 'judged-keep',
          voteWeight: 3,
        },);
        expect(standingWith({
          translateSelections: [translateSelection({
            decision: 'sole-candidate',
            producer: {
              kind: 'incumbent',
              matched: ['hf:zai-org/GLM-5.3-Flash', 'minimax-m3',],
            },
          },),],
          laneSelection: PENDING,
          consolidation: NOT_RUN,
        },),).toEqual({
          kind: 'matched-keep',
          matchedBy: ['hf:zai-org/GLM-5.3-Flash', 'minimax-m3',],
        },);
        expect(standingWith({
          translateSelections: [translateSelection({ decision: 'sole-candidate', },),],
          laneSelection: PENDING,
          consolidation: NOT_RUN,
        },),).toEqual({
          kind: 'fallback',
          decision: 'sole-candidate-unmatched',
        },);
        for (const decision of [
          'declined-indecision',
          'declined-rejection',
          'no-candidate-backed',
          'no-candidate',
          'no-voice-heard',
        ]) {
          expect(standingWith({
            translateSelections: [translateSelection({ decision, },),],
            laneSelection: PENDING,
            consolidation: NOT_RUN,
          },),).toEqual({
            kind: 'fallback',
            decision,
          },);
        }
        expect(standingWith({
          translateSelections: [TOKA_TRANSLATE,],
          laneSelection: PENDING,
          consolidation: NOT_RUN,
        },),).toEqual({
          kind: 'replaced',
          shipped: true,
        },);
      },
    },),

    it({
      name: 'WALKS CONSOLIDATION BEFORE THE CONTEST BEFORE THE LANE, since each later stage was '
        + 'free to replace what the earlier one left',
      fn: async () => {
        expect(standingWith({
          translateSelections: [translateSelection({
            decision: 'judged',
            voteWeight: 3,
          },),],
          laneSelection: contestedAt({
            verdict: {
              kind: 'lane-won',
              lane: 'repair',
            },
          },),
          consolidation: settledAt({ terminal: 'slate-declined-standing', },),
        },),).toEqual({
          kind: 'fallback',
          decision: 'slate-declined-standing',
        },);
        expect(standingWith({
          translateSelections: [translateSelection({ decision: 'declined-indecision', },),],
          laneSelection: contestedAt({
            verdict: {
              kind: 'lane-won',
              lane: 'repair',
            },
          },),
          consolidation: NOT_RUN,
        },),).toEqual({
          kind: 'contest-keep',
          usable: 9,
        },);
      },
    },),

    it({
      name: 'READS a preparation without a metadata slice, or records that never name it, as '
        + 'unrecorded, leaving the structural check to say why',
      fn: async () => {
        expect(metadataStandingOf({
          slices: [],
          evidence: {
            translateSelections: [TOKA_TRANSLATE,],
            laneSelection: PENDING,
            consolidation: NOT_RUN,
            comparison: [ROW,],
          },
        },),).toEqual({ kind: 'unrecorded', },);
        expect(standingWith({
          translateSelections: [],
          laneSelection: PENDING,
          consolidation: NOT_RUN,
        },),).toEqual({ kind: 'unrecorded', },);
      },
    },),
  ],
},);

await describe({
  name: isReviewedKeep.name,
  children: [
    it({
      name: 'COUNTS the five keeps a panel or a matching slate chose as reviews and nothing else, '
        + 'and names the fallback of everything else, refusing to name one for a review',
      fn: async () => {
        for (const standing of [
          {
            kind: 'judged-keep',
            voteWeight: 3,
          },
          {
            kind: 'matched-keep',
            matchedBy: ['minimax-m3',],
          },
          {
            kind: 'contest-keep',
            usable: 9,
          },
          { kind: 'slate-keep', },
          {
            kind: 'gate-keep',
            usable: 8,
          },
        ] as const) {
          expect(isReviewedKeep({ standing, },),).toBe(true,);
          expect(() => fallbackDetailOf({ standing, },),).toThrow(RangeError,);
        }
        for (const [standing, detail,] of [
          [{ kind: 'fallback', decision: 'gate-neither', }, 'gate-neither',],
          [{ kind: 'replaced', shipped: true, }, 'replacement-not-carried',],
          [{ kind: 'replaced', shipped: false, }, 'replacement-withdrawn',],
          [{ kind: 'unrecorded', }, 'unrecorded',],
        ] as const) {
          expect(isReviewedKeep({ standing, },),).toBe(false,);
          expect(fallbackDetailOf({ standing, },),).toBe(detail,);
        }
      },
    },),
  ],
},);
