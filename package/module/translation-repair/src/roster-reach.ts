import type { ModelReach, } from './budget-routing.ts';
import {
  HYPER_MODELS,
  type HyperServedId,
} from './hyper-catalog.ts';
import {
  HYPER_ONLY_ROSTER_IDS,
  type RosterModelId,
} from './roster-id.ts';
import {
  SYNTHETIC_MODELS,
  type SyntheticModelInfo,
} from './synthetic-catalog.ts';

//region Roster reach
// WHICH PROVIDERS CAN SERVE ONE ROSTER MODEL, and under what spelling, read off
// both catalogs rather than listed by hand.
//
// DERIVED, because a hand-written list goes stale silently. `#136`'s roster
// note makes the same argument about aliases: a roster fact that no build
// checks is a roster fact that changes without anyone noticing.
//
// READING IS NARROWER THAN TALKING. Each provider reports modalities for its
// own serving stack, so a call carrying a picture reaches only providers that
// both serve the roster identity and report image input for it. Asking one
// question for text and images would either send a picture where it cannot be
// read or refuse one that another serving path can accept.

/**
 * Where one roster model can be reached on Charm Hyper.
 *
 * @example
 * ```ts
 * const served = hyperIdFor({ modelId: 'hf:moonshotai/Kimi-K3', },);
 * ```
 */
export type HyperSpelling =
  | {
    /**
     * Discriminator marking a model this provider serves.
     */
    readonly served: true;

    /**
     * Identifier to send, which differs from the roster's for shared models.
     */
    readonly id: HyperServedId;
  }
  | {
    /**
     * Discriminator marking a model this provider does not serve.
     */
    readonly served: false;
  };

/**
 * Every model the roster seats, both providers' contributions unioned.
 *
 * ORDERED SYNTHETIC FIRST, then the models only the second provider serves, so
 * a roster printed in this order reads the way the pipeline grew.
 *
 * @example
 * ```ts
 * const everyone = ROSTER_MODEL_IDS;
 * ```
 */
export const ROSTER_MODEL_IDS: readonly RosterModelId[] = [
  ...Object
    .values(SYNTHETIC_MODELS,)
    .map(function toId(info,): RosterModelId {
      return info.id;
    },),
  ...HYPER_ONLY_ROSTER_IDS,
];

/**
 * How Charm Hyper spells one roster model, where it serves it at all.
 *
 * @param modelId - roster model to look up
 *
 * @returns Wire identifier, or that this provider does not serve it
 *
 * @example
 * ```ts
 * const spelling = hyperIdFor({ modelId, },);
 * ```
 */
export function hyperIdFor(
  { modelId, }: { readonly modelId: RosterModelId; },
): HyperSpelling {
  /**
   * Entry serving this model, whether under its own name or as the shared
   * counterpart of a Synthetic id.
   */
  const entry = Object
    .values(HYPER_MODELS,)
    .find(function serves(info,): boolean {
      return (info.id === modelId) || (info.sharedWith === modelId);
    },);

  if (entry === undefined)
    return { served: false, };

  return {
    served: true,
    id: entry.id,
  };
}

/**
 * What Synthetic knows about one roster model, where it serves it at all.
 *
 * @example
 * ```ts
 * const entry: SyntheticEntry = { served: true, info, };
 * ```
 */
export type SyntheticEntry =
  | {
    /**
     * Discriminator marking a model this provider serves.
     */
    readonly served: true;

    /**
     * Catalog entry, carrying the facts routing and budgeting read.
     */
    readonly info: SyntheticModelInfo;
  }
  | {
    /**
     * Discriminator marking a model this provider does not serve.
     */
    readonly served: false;
  };

/**
 * What Synthetic's catalog says about one roster model.
 *
 * FOUND RATHER THAN INDEXED, mirroring {@link hyperIdFor}. Indexing the record
 * with a roster id needs an assertion that the id is one of its keys, which is
 * the claim this function exists to check.
 *
 * @param modelId - roster model to look up
 *
 * @returns Catalog entry, or that this provider does not serve it
 *
 * @example
 * ```ts
 * const entry = syntheticEntryFor({ modelId, },);
 * ```
 */
export function syntheticEntryFor(
  { modelId, }: { readonly modelId: RosterModelId; },
): SyntheticEntry {
  /**
   * Entry naming this model, if this provider has one.
   */
  const info = Object
    .values(SYNTHETIC_MODELS,)
    .find(function serves(candidate,): boolean {
      return candidate.id === modelId;
    },);

  if (info === undefined)
    return { served: false, };

  return {
    served: true,
    info,
  };
}

/**
 * Which providers can take a text call for one roster model.
 *
 * @param modelId - roster model to route
 *
 * @returns Reach for the budget router to decide on
 *
 * @example
 * ```ts
 * const reach = reachOf({ modelId, },);
 * ```
 */
export function reachOf(
  { modelId, }: { readonly modelId: RosterModelId; },
): ModelReach {
  /**
   * Synthetic's entry, which is also whether it serves this model at all.
   */
  const entry = syntheticEntryFor({ modelId, },);

  /**
   * Hyper's spelling, which is also whether it serves this model at all.
   */
  const spelling = hyperIdFor({ modelId, },);

  return {
    onSynthetic: entry.served,
    onHyper: spelling.served,
  };
}

/**
 * Whether Synthetic will show one roster model a picture.
 *
 * @param modelId - roster model to look up
 *
 * @returns Whether this provider serves it AND reports vision for it
 *
 * @example
 * ```ts
 * const shows = syntheticShowsPictures({ modelId, },);
 * ```
 */
function syntheticShowsPictures(
  { modelId, }: { readonly modelId: RosterModelId; },
): boolean {
  /**
   * Synthetic's entry, which is also whether it serves this model at all.
   */
  const entry = syntheticEntryFor({ modelId, },);

  if (!entry.served)
    return false;

  /**
   * What that provider reports about this model's modalities.
   */
  const { readsImages: shows, } = entry.info;

  return shows;
}

/**
 * Whether Charm Hyper will show one roster model a picture.
 *
 * @param modelId - roster model to look up
 *
 * @returns Whether this provider serves it AND reports vision for it
 *
 * @example
 * ```ts
 * const shows = hyperShowsPictures({ modelId, },);
 * ```
 */
function hyperShowsPictures(
  { modelId, }: { readonly modelId: RosterModelId; },
): boolean {
  /**
   * Hyper's spelling, which is also whether it serves this model at all.
   */
  const spelling = hyperIdFor({ modelId, },);

  if (!spelling.served)
    return false;

  /**
   * What that provider reports about this model's modalities.
   */
  const { readsImages: shows, } = HYPER_MODELS[spelling.id];

  return shows;
}

/**
 * Which providers can take a call carrying a picture for one roster model.
 *
 * NARROWER THAN {@link reachOf} AND DERIVED PER PROVIDER. A later catalog
 * change can alter one serving stack's image support without altering another.
 *
 * @param modelId - roster model to route
 *
 * @returns Reach restricted to providers that report vision for it
 *
 * @example
 * ```ts
 * const reach = visionReachOf({ modelId, },);
 * ```
 */
export function visionReachOf(
  { modelId, }: { readonly modelId: RosterModelId; },
): ModelReach {
  return {
    onSynthetic: syntheticShowsPictures({ modelId, },),
    onHyper: hyperShowsPictures({ modelId, },),
  };
}

/**
 * Whether any provider can show one roster model a picture.
 *
 * @param modelId - roster model to look up
 *
 * @returns Whether a picture reaches it anywhere
 *
 * @example
 * ```ts
 * const reads = readsImages({ modelId, },);
 * ```
 */
export function readsImages(
  { modelId, }: { readonly modelId: RosterModelId; },
): boolean {
  /**
   * Providers that report vision for this model.
   */
  const reach = visionReachOf({ modelId, },);

  return reach.onSynthetic || reach.onHyper;
}

//endregion Roster reach
