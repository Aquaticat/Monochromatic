import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import type { ConsistencyRendering, } from '../consistency-count-types.ts';
import type { ConsistencyPlan, } from '../consistency-splice.ts';
import type { DeclaredNamePair, } from '../linked-title-declared-name.ts';
import type { SliceCache, } from '../slice-cache.ts';
import type { StageSettings, } from '../stage-settings.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import type {
  ArtifactConsistencyCarry,
  ArtifactConsistencyRepeat,
  ArtifactConsistencyUnplaced,
  ArtifactConsistencyVerdict,
  ConsistencyOccurrenceOutcome,
} from './artifact-two-lane-consistency.ts';
import type { ConsistencyCacheValue, } from './pass-consistency-cache.ts';
import type { ConsistencyPlace, } from './pass-consistency-group.ts';

//region Pass consistency types
// The shapes the pass hands between settling a group's ballots and carrying the
// chosen rendering to the places that receive it, kept apart from both so
// neither imports the other for a type.

/**
 One replacement a group would make, before the floors have spoken.

 @example
 ```ts
 const edit: PendingEdit = { placePosition: 1, sliceIndex: 3, start: 0, end: 12, text: 'the cat naps', };
 ```
 */
export type PendingEdit = {
  /**
   Position of the receiving place among the group's places.
   */
  readonly placePosition: number;

  /**
   Slice the replacement is made in.
   */
  readonly sliceIndex: number;

  /**
   Offset in the slice's English where the replaced words start.
   */
  readonly start: number;

  /**
   Exclusive offset where they end.
   */
  readonly end: number;

  /**
   The words that go in.
   */
  readonly text: string;
};

/**
 A place with its located rendering.

 @example
 ```ts
 const located: LocatedPlace = { place, rendering, };
 ```
 */
export type LocatedPlace = {
  /**
   The place a slice holds whole.
   */
  readonly place: ConsistencyPlace;

  /**
   Where its rendering stands in its English.
   */
  readonly rendering: Extract<ConsistencyRendering, { readonly kind: 'located'; }>;
};

/**
 A place the chosen rendering is to reach.

 @example
 ```ts
 const receiver: CarryReceiver = { position: 1, label: 'OCCURRENCE 2', place, rendering, plan: { kind: 'unavailable', }, };
 ```
 */
export type CarryReceiver = LocatedPlace & {
  /**
   Position of the place among the group's places.
   */
  readonly position: number;

  /**
   The label the sheet gave the place.
   */
  readonly label: string;

  /**
   What moving the chosen words in by code amounts to.
   */
  readonly plan: ConsistencyPlan;
};

/**
 How a receiving place's carry ended.

 @example
 ```ts
 const carried: PlaceCarried = { carry, edits: [], findings: [], };
 ```
 */
export type PlaceCarried = {
  /**
   The record of the carry: candidates, ballots and decision.
   */
  readonly carry: ArtifactConsistencyCarry;

  /**
   The replacement the winning candidate makes, none when the English stands.
   */
  readonly edits: readonly PendingEdit[];

  /**
   What the carry reported, for the section's findings.
   */
  readonly findings: readonly string[];
};

/**
 What a carry reads beside the two places.

 @example
 ```ts
 const context: CarryContext = { client, writerModelIds, judgeModelIds, cache, text, declared: [], declaredNames: [], signal, l, stageSettings, };
 ```
 */
export type CarryContext = {
  /**
   Provider client.
   */
  readonly client: SyntheticClient;

  /**
   The translate stage's writer bench, as the seat reading left it.
   */
  readonly writerModelIds: readonly RosterModelId[];

  /**
   The judge bench that chooses among the candidates.
   */
  readonly judgeModelIds: readonly RosterModelId[];

  /**
   Store an earlier answer is read from and a settled one kept in.
   */
  readonly cache: SliceCache<ConsistencyCacheValue>;

  /**
   Whole original.
   */
  readonly text: string;

  /**
   Declared identity lines of the page, when it declares any.
   */
  readonly identityContext?: string;

  /**
   Lines of the pages the original cites, when it cites any.
   */
  readonly referenceContext?: string;

  /**
   Whether the entry records a death.
   */
  readonly lifeEnded?: boolean;

  /**
   Names the translation declares for its subject.
   */
  readonly subjectNames?: readonly string[];

  /**
   Name pairs the front matter declares.
   */
  readonly declared: readonly DeclaredNamePair[];

  /**
   Declared name forms.
   */
  readonly declaredNames: readonly string[];

  /**
   Entry deadline and caller abort.
   */
  readonly signal: AbortSignal;

  /**
   Logger the stage writes to.
   */
  readonly l: Logger;

  /**
   Straggler windows the entry file read for this launch.
   */
  readonly stageSettings: StageSettings;
};

/**
 A group with its verdict, its places' renderings and outcomes, and its pending replacements.

 @example
 ```ts
 const settled: SettledGroup = { repeat, places, unplaced, verdict, renderings: [], outcomes: [], edits: [], carries: [], findings: [], };
 ```
 */
export type SettledGroup = {
  /**
   The repeated wording or frame.
   */
  readonly repeat: ArtifactConsistencyRepeat;

  /**
   The places a slice holds whole, in page order.
   */
  readonly places: readonly ConsistencyPlace[];

  /**
   The places no slice holds whole.
   */
  readonly unplaced: readonly ArtifactConsistencyUnplaced[];

  /**
   What was asked of the bench and what it answered.
   */
  readonly verdict: ArtifactConsistencyVerdict;

  /**
   Each place's rendering, in the order of the places.
   */
  readonly renderings: readonly ConsistencyRendering[];

  /**
   Each place's outcome so far, in the order of the places; `replaced` is
   provisional until the floors have spoken.
   */
  readonly outcomes: readonly ConsistencyOccurrenceOutcome[];

  /**
   The replacements the winner would make.
   */
  readonly edits: readonly PendingEdit[];

  /**
   How the chosen rendering was carried to each receiving place, in the order
   of the places.
   */
  readonly carries: readonly ArtifactConsistencyCarry[];

  /**
   What the gathers reported.
   */
  readonly findings: readonly string[];
};

/**
 A group whose ballots are counted and whose receiving places are still to be
 carried to.

 @example
 ```ts
 const decided: DecidedGroup = { ...settled, chosen: [], receivers: [], };
 ```
 */
export type DecidedGroup = SettledGroup & {
  /**
   The chosen place, as a list of zero or one.
   */
  readonly chosen: readonly LocatedPlace[];

  /**
   The places the chosen rendering is to reach, in the order of the places.
   */
  readonly receivers: readonly CarryReceiver[];
};

//endregion Pass consistency types
