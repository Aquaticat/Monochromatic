import { ArtifactParseError, } from '../artifact-guard.ts';
import {
  occurrencesOf,
  quoteCore,
} from '../consistency-count.ts';
import type {
  ConsistencyRendering,
  UnlocatedReason,
} from '../consistency-count-types.ts';
import { rendersAsNothing, } from '../renders-as-nothing.ts';
import type { ArtifactConsistencyRendering, } from './artifact-two-lane-consistency.ts';

//region Artifact consistency located
// A RECORDED LOCATED RENDERING READ AS THE COUNTER'S, for the recount of what
// moving words over it would do. The English the quote was located in is not in
// the file, so its offset is left at zero and the recount compares words only.

/**
 The recorded rendering of a place read as the counter's located rendering, for
 the recount of what moving words over it would do.

 @param rendering - recorded rendering, located

 @param path - where the rendering sits, for the parse error

 @returns The counter's form, its offset in the English left at zero since the
 recount compares words only

 @throws {@link ArtifactParseError} when a frame's slot does not stand once in
 the quote's words

 @example
 ```ts
 const located = asLocated({ rendering, path, },);
 ```
 */
export function asLocated(
  {
    rendering,
    path,
  }: {
    readonly rendering: Extract<ArtifactConsistencyRendering, { readonly kind: 'located'; }>;
    readonly path: string;
  },
): Extract<ConsistencyRendering, { readonly kind: 'located'; }> {
  /**
   The words the quote keeps.
   */
  const core = quoteCore({ quote: rendering.quote, },);
  if (rendering.slot === undefined) {
    return {
      kind: 'located',
      quote: rendering.quote,
      core,
      start: 0,
    };
  }
  /**
   Where the slot stands in the core.
   */
  const found = occurrencesOf({
    haystack: core,
    needle: rendering.slot,
  },);
  if (found.kind !== 'once') {
    throw new ArtifactParseError({
      path,
      reason: 'a slot that stands exactly once in the words of its quote',
    },);
  }
  return {
    kind: 'located',
    quote: rendering.quote,
    core,
    start: 0,
    slot: rendering.slot,
    slotStart: found.at,
  };
}

/**
 Whether the usable ballots contradict a reason given for a place that was not
 located.

 @param reason - the recorded reason

 @param quotes - the quote a strict majority gave, none when no text had a majority

 @param slots - the slot a strict majority gave, none when no text had a majority

 @returns Whether the ballots say what the reason denies

 @example
 ```ts
 const wrong = reasonContradicted({ reason: 'no-agreement', quotes: ['the cat naps',], slots: [], },);
 ```
 */
export function reasonContradicted(
  {
    reason,
    quotes,
    slots,
  }: {
    readonly reason: UnlocatedReason;
    readonly quotes: readonly string[];
    readonly slots: readonly string[];
  },
): boolean {
  if (reason === 'no-agreement')
    return quotes.length > 0;
  if (reason === 'empty') {
    return (quotes.length === 0) || quotes.some(function showsSomething(quote,): boolean {
      return !rendersAsNothing({ text: quoteCore({ quote, },), },);
    },);
  }
  if (reason === 'slot-no-agreement')
    return (quotes.length === 0) || (slots.length > 0);
  if (reason === 'slot-empty') {
    return (slots.length === 0) || slots.some(function showsSomething(slot,): boolean {
      return !rendersAsNothing({ text: slot, },);
    },);
  }
  return reason === 'not-asked';
}

//endregion Artifact consistency located
