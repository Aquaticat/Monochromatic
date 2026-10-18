import type { ConsistencyBallotWire, } from './consistency-wire.ts';

//region Consistency count types
// The shapes the counting of a repeated wording's ballots reads and returns
// (`consistency-count.ts`).

/**
 One heard ballot with the seat that gave it.

 @example
 ```ts
 const voice: ConsistencyVoice = { seat: 'glm-5.3', reason: 'Same.', quotes: [], choice: 'OCCURRENCE 1', keep: [], };
 ```
 */
export type ConsistencyVoice = ConsistencyBallotWire & {
  /**
   Seat that answered.
   */
  readonly seat: string;
};

/**
 Why a place's rendering could not be located.
 */
export type UnlocatedReason =
  | 'not-asked'
  | 'no-english'
  | 'no-agreement'
  | 'empty'
  | 'not-found'
  | 'ambiguous'
  | 'markup'
  | 'overlaps-another'
  | 'slot-no-agreement'
  | 'slot-empty'
  | 'slot-not-found'
  | 'slot-ambiguous'
  | 'slot-whole';

/**
 Where a place's rendering stands in its English, or why it cannot be found.

 @example
 ```ts
 const rendering: ConsistencyRendering = { kind: 'unlocated', reason: 'not-found', };
 ```
 */
export type ConsistencyRendering =
  | {
    /**
     A strict majority quoted words that stand once in the place's English.
     */
    readonly kind: 'located';

    /**
     The words the place's English holds where the majority's quotes stand,
     without the punctuation that closes them, never a judge's string. A proven
     apostrophe directly beside the words (`consistency-proven-apostrophes.ts`)
     belongs to its word, so the quote starts or ends with it.
     */
    readonly quote: string;

    /**
     The words a replacement takes or gives: the span itself.
     */
    readonly core: string;

    /**
     Offset in the English where the quote starts.
     */
    readonly start: number;

    /**
     The single mark the English holds directly before the span, as the
     English writes it; absent when no single mark stands there or when the mark
     is a proven apostrophe, which the span covers. The span covers no other
     mark, so a replacement leaves it on the page, and the splice
     (`consistency-splice.ts`) compares it between two places.
     */
    readonly markBefore?: string;

    /**
     The single mark the English holds directly after the span, as the English
     writes it; absent when no single mark stands there or when the mark is a
     proven apostrophe, which the span covers.
     */
    readonly markAfter?: string;

    /**
     The single mark the English holds past a run of markup or opening characters before the span, as the English writes
     it (`'*5 cats`: the `'` before the `*`); absent when no mark stands there, when the mark stands directly before the
     span (`markBefore` names it), or when a proven apostrophe is the span's own. It is read from the English the counter
     holds and is NOT recorded: a generation 17 record stores the marks directly beside a span alone, so a reader of the
     record holds no such mark, and the planner reads it only in the pass that counted it.
     */
    readonly markPastBefore?: string;

    /**
     The single mark the English holds past a run of markup or closing characters after the span, as the English writes it
     (`*kittens*’`: the `’` after the `*`); absent as `markPastBefore` is. Not recorded either.
     */
    readonly markPastAfter?: string;

    /**
     For a frame: the slot words the English holds where the majority's slots
     stand inside the span; absent when the ballots did not pin one down.
     */
    readonly slot?: string;

    /**
     For a frame: offset in the core where the slot starts.
     */
    readonly slotStart?: number;
  }
  | {
    /**
     The rendering cannot be found, so the place stays as it stands.
     */
    readonly kind: 'unlocated';

    /**
     Why.
     */
    readonly reason: UnlocatedReason;
  };

/**
 Why the group has no winner. The two run-off reasons are given only after the
 bench was asked again among the places that tied for first: the run-off's
 gather missed its quorum, or the run-off tied or reached no majority too.
 */
export type NoWinnerReason =
  | 'no-quorum'
  | 'no-majority'
  | 'chosen-unlocated'
  | 'run-off-no-quorum'
  | 'run-off-tied';

/**
 Which place every place should follow, or why none.

 @example
 ```ts
 const winner: ConsistencyWinner = { kind: 'none', reason: 'no-quorum', };
 ```
 */
export type ConsistencyWinner =
  | {
    /**
     A strict majority chose a place whose rendering is located.
     */
    readonly kind: 'chosen';

    /**
     Label of the place.
     */
    readonly label: string;
  }
  | {
    /**
     No place won, so the group stays as it stands.
     */
    readonly kind: 'none';

    /**
     Why.
     */
    readonly reason: NoWinnerReason;
  };

/**
 What the ballots of one group come to.

 @example
 ```ts
 const count: ConsistencyCount = { usable: 0, renderings: [], kept: [], winner: { kind: 'none', reason: 'no-quorum', }, finalists: [], };
 ```
 */
export type ConsistencyCount = {
  /**
   Ballots that could be counted.
   */
  readonly usable: number;

  /**
   Each place's rendering, in the order of the places.
   */
  readonly renderings: readonly ConsistencyRendering[];

  /**
   Whether a strict majority keeps each place, in the order of the places.
   */
  readonly kept: readonly boolean[];

  /**
   The place every place should follow, if any.
   */
  readonly winner: ConsistencyWinner;

  /**
   Labels that tie for first among the choices when the ballots reach the
   quorum and no label has a majority, in sheet order; the bench is asked once
   more among them. None when the choices do not tie.
   */
  readonly finalists: readonly string[];
};

//endregion Consistency count types
