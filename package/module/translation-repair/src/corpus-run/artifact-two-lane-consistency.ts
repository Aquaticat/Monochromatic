import type {
  ConsistencyWinner,
  UnlocatedReason,
} from '../consistency-count-types.ts';
import type { UnplacedReason, } from '../repeat-groups-types.ts';

//region Artifact consistency
// WHAT THE PAGE-LEVEL CONSISTENCY PASS DID TO THE SETTLED PAGE (the owner's
// ruling of 2026-10-11). After the slices settle, the pass finds source
// wording or a refrain the page repeats, asks the judge bench which rendering
// every place should follow, and carries the chosen rendering to the others
// where the floors allow. The artifact records every group it looked at, every
// ballot, and the text of each slice it changed, so the artifact and the
// published page agree and a reader can recount the vote.
//
// APPLIED BELOW THE PAGE ASSEMBLY AND ABOVE THE POLISH when a slice's text is
// read (`would-ship-text.ts`): the page passes run over the page the
// consistency pass composed, and what the pass wrote stands over the polish,
// the consolidation and the contest it settled after.
//
// TWO SHAPES, TWO GENERATIONS. Generation fifteen carries the section as the
// first pass to write it recorded it: ballots counted by the exact text of a
// quote, a located place carrying the judge's string, a slot a condition of
// being located, and the chosen words carried by code alone. It stays readable
// as written. GENERATION SIXTEEN is the section the pass writes now: ballots
// agree when their quotes locate one span of the place's own English, a located
// place carries the words and the offset the English holds, a slot is no
// condition of being located, a tie for first is run off among the finalists
// (`verdict.runOff`), and the chosen rendering is carried by writers and a
// choice among candidates (`group.carries`). The keys a generation does not
// write are refused in it by the reader, and the outcome words and winner
// reasons it does not give are refused too.

/**
 What became of one place of a group.

 `chosen` is the place every other place follows. `replaced` is a place whose
 slice now carries the chosen rendering. `consistent` is a place that already
 carried it. `kept-context` is a place a strict majority kept for its
 surroundings. `kept-floor` is a place whose replacement a floor refused.
 `overlapped` is a place whose replacement overlaps one of an earlier group in
 the same slice and was left out for it; it never names an overlap with a
 place of its own group, whose places in one block are carried by one
 replacement. `unlocated` is a place whose rendering the ballots did not pin
 down. `untouched` is a place of a group that decided nothing. `kept-current`
 (generation sixteen) is a place whose carry ended with its own English
 standing: the choice among the candidates kept it, reached no decision, had no
 candidate to choose or failed.
 */
export type ConsistencyOccurrenceOutcome =
  | 'chosen'
  | 'replaced'
  | 'consistent'
  | 'kept-context'
  | 'kept-floor'
  | 'kept-current'
  | 'overlapped'
  | 'unlocated'
  | 'untouched';

/**
 Every outcome a place can have, keyed by the union so the compiler refuses a
 member the record lacks, for a reader checking a recorded one.
 */
export const CONSISTENCY_OCCURRENCE_OUTCOMES: Readonly<Record<ConsistencyOccurrenceOutcome, true>> = {
  chosen: true,
  replaced: true,
  consistent: true,
  'kept-context': true,
  'kept-floor': true,
  'kept-current': true,
  overlapped: true,
  unlocated: true,
  untouched: true,
};

/**
 Every reason a bench can go unasked, keyed by the union, for a reader.
 */
export const CONSISTENCY_NOT_ASKED_REASONS: Readonly<Record<ConsistencyNotAskedReason, true>> = {
  'too-few-placed': true,
  'no-english': true,
  consistent: true,
};

/**
 Why a group was not put to the bench.
 */
export type ConsistencyNotAskedReason = 'too-few-placed' | 'no-english' | 'consistent';

/**
 Where a place's rendering stands, as recorded.

 @example
 ```ts
 const rendering: ArtifactConsistencyRendering = { kind: 'unlocated', reason: 'not-found', };
 ```
 */
export type ArtifactConsistencyRendering =
  | {
    /**
     A strict majority quoted words that occur once in the place's English.
     */
    readonly kind: 'located';

    /**
     Generation fifteen: the words the majority quoted, as they quoted them.
     Generation sixteen: the words the place's English holds where their quotes
     stand, without the punctuation that closes them.
     */
    readonly quote: string;

    /**
     Generation sixteen: offset in the place's English where the span starts.
     */
    readonly start?: number;

    /**
     For a frame: the slot words. Generation fifteen: as the majority quoted
     them. Generation sixteen: as the English holds them inside the span, absent
     where the ballots did not pin a slot down.
     */
    readonly slot?: string;
  }
  | {
    /**
     The rendering could not be pinned down.
     */
    readonly kind: 'unlocated';

    /**
     Why.
     */
    readonly reason: UnlocatedReason;
  };

/**
 One place of a group.

 @example
 ```ts
 const occurrence: ArtifactConsistencyOccurrence = { label: 'OCCURRENCE 1', sliceIndex: 0, startOffset: 0, endOffset: 12, line: 1, rendering: { kind: 'unlocated', reason: 'not-asked', }, outcome: 'untouched', };
 ```
 */
export type ArtifactConsistencyOccurrence = {
  /**
   Label the sheet gave the place.
   */
  readonly label: string;

  /**
   Slice (the comparison row's index) holding the place.
   */
  readonly sliceIndex: number;

  /**
   Absolute offset in the original where the place starts.
   */
  readonly startOffset: number;

  /**
   Absolute exclusive offset where it ends.
   */
  readonly endOffset: number;

  /**
   One-based line the place starts on.
   */
  readonly line: number;

  /**
   For a frame: absolute offset where the slot starts.
   */
  readonly slotStartOffset?: number;

  /**
   For a frame: absolute exclusive offset where the slot ends.
   */
  readonly slotEndOffset?: number;

  /**
   Where the place's rendering stands in its English.
   */
  readonly rendering: ArtifactConsistencyRendering;

  /**
   What became of the place.
   */
  readonly outcome: ConsistencyOccurrenceOutcome;
};

/**
 A place no slice holds whole, which stays as it stands.

 @example
 ```ts
 const unplaced: ArtifactConsistencyUnplaced = { startOffset: 22, endOffset: 34, line: 3, reason: 'in-no-slice', };
 ```
 */
export type ArtifactConsistencyUnplaced = {
  /**
   Absolute offset in the original where the place starts.
   */
  readonly startOffset: number;

  /**
   Absolute exclusive offset where it ends.
   */
  readonly endOffset: number;

  /**
   One-based line it starts on.
   */
  readonly line: number;

  /**
   Why no slice holds it whole.
   */
  readonly reason: UnplacedReason;
};

/**
 One heard ballot as recorded.

 @example
 ```ts
 const ballot: ArtifactConsistencyBallot = { seat: 'glm-5.3', reason: 'Same.', quotes: [], choice: 'OCCURRENCE 1', keep: [], };
 ```
 */
export type ArtifactConsistencyBallot = {
  /**
   Seat that answered.
   */
  readonly seat: string;

  /**
   Why the judge chose as it did, written before the choice.
   */
  readonly reason: string;

  /**
   The quotes the judge gave, one per place it quoted.
   */
  readonly quotes: readonly {
    /**
     Label of the place.
     */
    readonly label: string;

    /**
     Words quoted.
     */
    readonly quote: string;

    /**
     For a frame: the slot words quoted.
     */
    readonly slot?: string;
  }[];

  /**
   Label of the place every place should follow.
   */
  readonly choice: string;

  /**
   Labels of the places kept for their surroundings.
   */
  readonly keep: readonly string[];
};

/**
 One heard ballot that only chooses: the run-off's and the choice among a
 place's candidates.

 @example
 ```ts
 const ballot: ArtifactConsistencyChoiceBallot = { seat: 'glm-5.3', reason: 'Reads best.', choice: 'OCCURRENCE 3', };
 ```
 */
export type ArtifactConsistencyChoiceBallot = {
  /**
   Seat that answered.
   */
  readonly seat: string;

  /**
   Why the judge chose as it did, written before the choice.
   */
  readonly reason: string;

  /**
   Label of the place (a run-off) or of the candidate (a carry) chosen.
   */
  readonly choice: string;
};

/**
 The bench asked once more among the places that tied for first.

 @example
 ```ts
 const runOff: ArtifactConsistencyRunOff = { finalists: ['OCCURRENCE 3', 'OCCURRENCE 4',], ballots: [], usable: 0, quorum: 2, };
 ```
 */
export type ArtifactConsistencyRunOff = {
  /**
   Labels of the places that tied, in sheet order, the only places the run-off's
   sheet showed.
   */
  readonly finalists: readonly string[];

  /**
   Every ballot heard, whether or not it could be counted.
   */
  readonly ballots: readonly ArtifactConsistencyChoiceBallot[];

  /**
   Ballots that could be counted.
   */
  readonly usable: number;

  /**
   Voices the run-off's gather closed on.
   */
  readonly quorum: number;
};

/**
 What a candidate text of a carry is: the English the block has now, the chosen
 place's words moved into every receiving place of the block by code, or a text
 a writer wrote.
 */
export type ConsistencyCandidateKind = 'current' | 'splice' | 'writer';

/**
 Every kind a candidate can be, keyed by the union so the compiler refuses a
 member the record lacks, for a reader checking a recorded one.
 */
export const CONSISTENCY_CANDIDATE_KINDS: Readonly<Record<ConsistencyCandidateKind, true>> = {
  current: true,
  splice: true,
  writer: true,
};

/**
 One text the carry to the receiving places of a block chose among.

 @example
 ```ts
 const candidate: ArtifactConsistencyCandidate = { label: 'CANDIDATE 1', kind: 'current', writers: [], text: 'The cat naps.', };
 ```
 */
export type ArtifactConsistencyCandidate = {
  /**
   Label the choice sheet gave the candidate, counted from one in sheet order.
   */
  readonly label: string;

  /**
   `current` is the English the block has now; `splice` is the chosen place's
   words moved into every receiving place of the block by code; `writer` is a
   text a writer wrote.
   */
  readonly kind: ConsistencyCandidateKind;

  /**
   Seats whose reply was exactly this text, which is none for a splice no
   writer wrote and for a current text no writer returned.
   */
  readonly writers: readonly string[];

  /**
   The block's English as this candidate has it: the paragraph or heading that
   holds the receiving places' words, or the whole English of the slice for
   words that lie in no single block.
   */
  readonly text: string;
};

/**
 Why a carry reached no decision among its candidates.
 */
export type ConsistencyCarryNoDecisionReason = 'no-alternative' | 'no-quorum' | 'no-majority';

/**
 Every reason a carry can reach no decision, keyed by the union, for a reader.
 */
export const CONSISTENCY_CARRY_NO_DECISION_REASONS: Readonly<Record<ConsistencyCarryNoDecisionReason, true>> = {
  'no-alternative': true,
  'no-quorum': true,
  'no-majority': true,
};

/**
 What a receiving place's carry decided.

 @example
 ```ts
 const decision: ArtifactConsistencyCarryDecision = { kind: 'none', reason: 'no-alternative', };
 ```
 */
export type ArtifactConsistencyCarryDecision =
  | {
    /**
     A strict majority of the usable ballots chose a candidate.
     */
    readonly kind: 'chosen';

    /**
     Label of the candidate.
     */
    readonly label: string;
  }
  | {
    /**
     No candidate was chosen, so the place's English stands.
     */
    readonly kind: 'none';

    /**
     Why.
     */
    readonly reason: ConsistencyCarryNoDecisionReason;
  }
  | {
    /**
     Trouble stopped the carry before a choice could be counted.
     */
    readonly kind: 'failed';

    /**
     What went wrong, in words naming no corpus text.
     */
    readonly detail: string;
  };

/**
 Every kind of decision a carry can record, keyed by the union, for a reader.
 */
export const CONSISTENCY_CARRY_DECISION_KINDS: Readonly<Record<ArtifactConsistencyCarryDecision['kind'], true>> = {
  chosen: true,
  none: true,
  failed: true,
};

/**
 How the chosen rendering was carried to one receiving place: the texts
 offered, the ballots that chose among them and what they decided. The
 receiving places of one block are carried to together and share one choice, so
 each of them carries the same texts, ballots and decision under its own label.

 @example
 ```ts
 const carry: ArtifactConsistencyCarry = { label: 'OCCURRENCE 2', candidates: [], ballots: [], usable: 0, quorum: 2, decision: { kind: 'none', reason: 'no-alternative', }, };
 ```
 */
export type ArtifactConsistencyCarry = {
  /**
   Label of the receiving place.
   */
  readonly label: string;

  /**
   The texts the choice was among, in sheet order; the current English first
   when no alternative was offered.
   */
  readonly candidates: readonly ArtifactConsistencyCandidate[];

  /**
   Every ballot heard, whether or not it could be counted; none when the bench
   was not asked.
   */
  readonly ballots: readonly ArtifactConsistencyChoiceBallot[];

  /**
   Ballots that could be counted.
   */
  readonly usable: number;

  /**
   Voices the choice's gather closed on; zero when the bench was not asked.
   */
  readonly quorum: number;

  /**
   What the ballots decided.
   */
  readonly decision: ArtifactConsistencyCarryDecision;
};

/**
 What was asked of the bench about a group and what it answered.

 @example
 ```ts
 const verdict: ArtifactConsistencyVerdict = { kind: 'not-asked', reason: 'consistent', };
 ```
 */
export type ArtifactConsistencyVerdict =
  | {
    /**
     The bench was not asked.
     */
    readonly kind: 'not-asked';

    /**
     Why.
     */
    readonly reason: ConsistencyNotAskedReason;
  }
  | {
    /**
     Trouble stopped the group before the bench's answer could be counted;
     the group's places stay as they stand.
     */
    readonly kind: 'failed';

    /**
     What went wrong, in words naming no corpus text.
     */
    readonly detail: string;
  }
  | {
    /**
     The bench was asked.
     */
    readonly kind: 'asked';

    /**
     Every ballot heard, whether or not it could be counted.
     */
    readonly ballots: readonly ArtifactConsistencyBallot[];

    /**
     Ballots that could be counted.
     */
    readonly usable: number;

    /**
     Voices the gather closed on, which the usable ballots had to reach.
     */
    readonly quorum: number;

    /**
     The place every place followed, or why none. When the choices tied for
     first, the place the run-off chose, or the run-off's reason for none.
     */
    readonly winner: ConsistencyWinner;

    /**
     Generation sixteen: the bench asked once more among the places that tied
     for first; absent when the choices did not tie.
     */
    readonly runOff?: ArtifactConsistencyRunOff;
  };

/**
 The repeated source wording or frame of a group.

 @example
 ```ts
 const repeat: ArtifactConsistencyRepeat = { kind: 'maximal', wording: '小猫在窗台上打盹', };
 ```
 */
export type ArtifactConsistencyRepeat =
  | {
    /**
     A run repeated as it stands.
     */
    readonly kind: 'maximal';

    /**
     The repeated run.
     */
    readonly wording: string;
  }
  | {
    /**
     A frame repeated with a varying slot.
     */
    readonly kind: 'refrain';

    /**
     Characters every place begins with.
     */
    readonly prefix: string;

    /**
     Characters every place ends with.
     */
    readonly suffix: string;
  };

/**
 One repeated wording and what the pass did about it.

 @example
 ```ts
 const group: ArtifactConsistencyGroup = { repeat: { kind: 'maximal', wording: '小猫在窗台上打盹', }, occurrences: [], unplaced: [], verdict: { kind: 'not-asked', reason: 'too-few-placed', }, };
 ```
 */
export type ArtifactConsistencyGroup = {
  /**
   The repeated wording or frame.
   */
  readonly repeat: ArtifactConsistencyRepeat;

  /**
   Places a slice holds whole, in page order.
   */
  readonly occurrences: readonly ArtifactConsistencyOccurrence[];

  /**
   Places no slice holds whole, which stay as they stand.
   */
  readonly unplaced: readonly ArtifactConsistencyUnplaced[];

  /**
   What was asked of the bench and what it answered.
   */
  readonly verdict: ArtifactConsistencyVerdict;

  /**
   Generation sixteen: how the chosen rendering was carried to each receiving
   place, in the order of the places, the places of one block sharing one
   record; empty where no place received one.
   */
  readonly carries?: readonly ArtifactConsistencyCarry[];
};

/**
 The text a changed slice now carries.

 @example
 ```ts
 const slice: ArtifactConsistencySlice = { sliceIndex: 3, text: 'The cat naps all day.', };
 ```
 */
export type ArtifactConsistencySlice = {
  /**
   Slice (the comparison row's index) that changed.
   */
  readonly sliceIndex: number;

  /**
   Text the slice carries, before the archive's typography is restored.
   */
  readonly text: string;
};

/**
 The consistency pass's outcome recorded in a settled artifact.

 @example
 ```ts
 const consistency: ArtifactConsistency = { groups: [], slices: [], findings: [], };
 ```
 */
export type ArtifactConsistency = {
  /**
   Every group the pass looked at, in the page order of its first place.
   */
  readonly groups: readonly ArtifactConsistencyGroup[];

  /**
   Slices whose text the pass changed, one row per slice.
   */
  readonly slices: readonly ArtifactConsistencySlice[];

  /**
   What the pass reports beside its groups: what the gathers reported, why a
   run-off was asked, what the carries reported (a writer's text a floor
   refused or that could not be read, writers that were not asked and why, a
   carry that failed), a replacement a floor refused, and trouble that stopped
   the pass.
   */
  readonly findings: readonly string[];
};

/**
 Consistency of an artifact whose pass changed nothing, and of every artifact
 written before the pass existed.
 */
export const NO_CONSISTENCY: ArtifactConsistency = {
  groups: [],
  slices: [],
  findings: [],
};

/**
 What the consistency pass says about one slice.

 @example
 ```ts
 const override: ConsistencyOverride = { kind: 'replaced', text: 'The cat naps.', };
 ```
 */
export type ConsistencyOverride =
  | {
    /**
     The page carries this text, the settled text with chosen wording carried in.
     */
    readonly kind: 'replaced';

    /**
     Text the page carries.
     */
    readonly text: string;
  }
  | {
    /**
     The pass left this slice as the stages settled it.
     */
    readonly kind: 'untouched';
  };

/**
 Reads what the consistency pass did to one slice.

 @param consistency - recorded section

 @param sliceIndex - slice asked about

 @returns The override, or that there is none

 @example
 ```ts
 const override = consistencyOverrideAt({ consistency, sliceIndex: 14, },);
 ```
 */
export function consistencyOverrideAt(
  {
    consistency,
    sliceIndex,
  }: {
    readonly consistency: ArtifactConsistency;
    readonly sliceIndex: number;
  },
): ConsistencyOverride {
  /**
   The recorded row for this slice, at most one: the reader refuses a file
   holding two.
   */
  const replaced = consistency
    .slices
    .find(function namesIt(row,): boolean {
      return row.sliceIndex === sliceIndex;
    },);
  if (replaced === undefined)
    return { kind: 'untouched', };
  return {
    kind: 'replaced',
    text: replaced.text,
  };
}

//endregion Artifact consistency
