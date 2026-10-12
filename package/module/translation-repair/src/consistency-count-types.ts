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
  | 'slot-no-agreement'
  | 'slot-empty'
  | 'slot-not-found'
  | 'slot-ambiguous';

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
     A strict majority quoted words that occur once.
     */
    readonly kind: 'located';

    /**
     The words the majority quoted, as they quoted them.
     */
    readonly quote: string;

    /**
     The quote without the punctuation that closes it: the words a
     replacement takes or gives.
     */
    readonly core: string;

    /**
     Offset in the English where the quote starts.
     */
    readonly start: number;

    /**
     For a frame: the slot words the majority quoted.
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
 Why the group has no winner.
 */
export type NoWinnerReason = 'no-quorum' | 'no-majority' | 'chosen-unlocated';

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
 const count: ConsistencyCount = { usable: 0, renderings: [], kept: [], winner: { kind: 'none', reason: 'no-quorum', }, };
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
};

//endregion Consistency count types
