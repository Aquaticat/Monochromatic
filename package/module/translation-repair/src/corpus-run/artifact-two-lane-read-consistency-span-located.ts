import { ArtifactParseError, } from '../artifact-guard.ts';
import { locateWords, } from '../consistency-fold.ts';
import { carriesOrCutsMarkup, } from '../consistency-markup.ts';
import type {
  ConsistencyRendering,
  UnlocatedReason,
} from '../consistency-count-types.ts';
import { ConsistencyInvariantError, } from '../consistency-invariant-error.ts';
import { rendersAsNothing, } from '../renders-as-nothing.ts';
import type { ArtifactConsistencyRendering, } from './artifact-two-lane-consistency.ts';

//region Artifact consistency span located
// A RECORDED RENDERING OF THE SIXTEENTH SHAPE READ AGAINST THE BALLOTS. The
// quote of a located place is the words the place's English holds where the
// majority's quotes stand, so it is not compared with a judge's string: its
// folded words (`consistency-fold.ts`) are compared with the folded words a
// strict majority of the usable ballots quoted. The English the span stands in
// is not in the file, so "the words stand exactly once there" is the pass's
// check alone, as it is for the first shape.

/**
 The recorded rendering read as the counter's located rendering.

 @param rendering - recorded rendering, located

 @param path - where the rendering sits, for the parse error

 @returns The counter's form, with the recorded offset and, for a frame that
 has one, the slot and its offset in the words

 @throws {@link ArtifactParseError} when a recorded slot does not stand exactly
 once in the words of its quote

 @throws {@link ConsistencyInvariantError} when the rendering records no offset,
 which every rendering of the sixteenth shape does

 @example
 ```ts
 const located = asLocatedBySpan({ rendering, path, },);
 ```
 */
export function asLocatedBySpan(
  {
    rendering,
    path,
  }: {
    readonly rendering: Extract<ArtifactConsistencyRendering, { readonly kind: 'located'; }>;
    readonly path: string;
  },
): Extract<ConsistencyRendering, { readonly kind: 'located'; }> {
  if (rendering.start === undefined) {
    throw new ConsistencyInvariantError({ invariant:
      `the located rendering at ${path} records no offset, and the reader of the sixteenth shape requires one`, },);
  }
  /**
   The counter's form of a rendering without a slot.
   */
  const bare: Extract<ConsistencyRendering, { readonly kind: 'located'; }> = {
    kind: 'located',
    quote: rendering.quote,
    core: rendering.quote,
    start: rendering.start,
  };
  if (rendering.slot === undefined)
    return bare;
  /**
   Where the recorded slot stands in the words.
   */
  const inside = locateWords({
    haystack: rendering.quote,
    words: rendering.slot,
  },);
  if (inside.kind !== 'once') {
    throw new ArtifactParseError({
      path,
      reason: 'a slot that stands exactly once in the words of its quote',
    },);
  }
  return {
    ...bare,
    slot: rendering.slot,
    slotStart: inside.start,
  };
}

/**
 Whether the usable ballots contradict a reason given for a place that was not
 located. A reason is contradicted when the ballots say what it denies, and
 also when it could not have been reached: a reason for a quote beside no agreed
 quote.

 @param reason - the recorded reason

 @param words - the folded words a strict majority quoted, none when no words had a majority

 @returns Whether the ballots say what the reason denies, or the reason names a step the pass never reached

 @example
 ```ts
 const wrong = reasonContradictedBySpan({ reason: 'no-agreement', words: ['the cat naps',], },);
 ```
 */
export function reasonContradictedBySpan(
  {
    reason,
    words,
  }: {
    readonly reason: UnlocatedReason;
    readonly words: readonly string[];
  },
): boolean {
  if (reason === 'not-asked')
    return true;
  if (reason === 'no-english')
    return false;
  /**
   The folded words a strict majority quoted, absent when none had one.
   */
  const [agreed,] = words;
  if (reason === 'no-agreement')
    return agreed !== undefined;
  if (agreed === undefined)
    return true;
  if (reason === 'empty')
    return !rendersAsNothing({ text: agreed, },);
  if (rendersAsNothing({ text: agreed, },))
    return true;
  // WHERE THE WORDS STAND IN THE ENGLISH, AND WHAT THE ENGLISH HOLDS THERE, IS
  // NOT IN THE FILE: not-found, ambiguous, markup and overlaps-another cannot
  // be contradicted, and the slot reasons are refused when the reason is read.
  return !((reason === 'not-found') || (reason === 'ambiguous')
    || (reason === 'markup')
    || (reason === 'overlaps-another'));
}

/**
 Whether the words of a located rendering are ones the pass would have located:
 they show a reader something, hold their markup in pairs, and a slot, where
 there is one, shows something, is not all of the words and holds its markup in
 pairs.

 @param rendering - recorded rendering, located

 @returns Whether the pass would have left the place unlocated, or without a slot, instead

 @example
 ```ts
 const wrong = locatedContradictedBySpan({ rendering, },);
 ```
 */
export function locatedContradictedBySpan(
  { rendering, }: { readonly rendering: Extract<ArtifactConsistencyRendering, { readonly kind: 'located'; }>; },
): boolean {
  if (rendersAsNothing({ text: rendering.quote, },) || carriesOrCutsMarkup({ text: rendering.quote, },))
    return true;
  if (rendering.slot === undefined)
    return false;
  return rendersAsNothing({ text: rendering.slot, },) || (rendering.slot === rendering.quote)
    || carriesOrCutsMarkup({ text: rendering.slot, },);
}

//endregion Artifact consistency span located
