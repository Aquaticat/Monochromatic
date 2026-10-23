import type { RosterModelId, } from '@monochromatic-dev/translation-repair-shared-contract';
import {
  buildReviewedFidelityReference,
  type EditorFidelityTrial,
  type ReviewedFidelityReference,
} from '../dist/final/node/index.mjs';
import { reviewedFixture, } from './fidelity-reference.test-fixture.ts';

//region Invented editor fidelity fixtures
// One invented reviewed reference, built through the real reference builder so its damaged twins are the ones the
// builders make, and the cards the cases seat. Cat-themed invention; no corpus content.

/**
 The card the cases seat alone.
 */
export const LOW_CARD: RosterModelId = 'claude-sonnet-5-5-effort-low';

/**
 A second card of the same wire model, which a run may bench in its own gather.
 */
export const HIGH_CARD: RosterModelId = 'claude-sonnet-5-5-effort-high';

/**
 A card of the other wire model, whose prices differ.
 */
export const HAIKU_CARD: RosterModelId = 'claude-haiku-5-5-effort-low';

/**
 The invented reference with its three damaged twins, a deletion, an insertion and an alteration.

 @returns The reference as the reader would hand it

 @example
 ```ts
 const reference = inventedReference();
 ```
 */
export function inventedReference(): ReviewedFidelityReference {
  /**
   Files and specification the invented reference is built from.
   */
  const {
    sourceFile,
    archiveFile,
    spec,
  } = reviewedFixture();
  return buildReviewedFidelityReference({
    sourceFile,
    archiveFile,
    spec,
  },);
}

/**
 The region of the damaged text.

 @param trial - trial whose region is read

 @returns The text the envelope holds

 @example
 ```ts
 const region = regionOf({ trial: ALTERATION, },);
 ```
 */
export function regionOf({ trial, }: { readonly trial: EditorFidelityTrial; },): string {
  return trial.damagedText
    .slice(
    trial.region
      .startOffset,
    trial.region
      .endOffset,
    );
}

//endregion Invented editor fidelity fixtures
