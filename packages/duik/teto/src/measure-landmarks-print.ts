/**
 * Landmark measurement output formatting.
 *
 * Prints anatomical landmark comparison tables and key body
 * proportion summaries to stderr for proportion analysis.
 *
 * @module
 */

// oxlint-disable no-magic-numbers -- measurement positions and formatting constants

import {
  contentToAbsY,
  fmtRatio,
  maxWidthInRange,
  minWidthInRange,
} from './measure-profile-query.ts';

import type { MeasurementRow, } from './measure-profile-types.ts';

import type { ProfilePair, } from './measure-landmarks.ts';

/**
 * Prints the landmark measurement comparison table to stderr.
 *
 * @param measurements - computed measurement rows from computeLandmarkMeasurements
 *
 * @example
 * ```ts
 * const rows = computeLandmarkMeasurements(pair);
 * printMeasurementTable(rows);
 * ```
 */
export function printMeasurementTable(measurements: MeasurementRow[],): void {
  console.error('Landmark         relY   refW   cmpW   ratio  diff',);
  console.error('------------------------------------------------------',);

  for (const m of measurements) {
    const name = m.landmark.padEnd(16,);
    const relY = m.relY.toFixed(2,).padStart(5,);
    const refW = String(m.refWidth,).padStart(6,);
    const cmpW = String(m.cmpWidth,).padStart(6,);
    const ratio = m.ratio.padStart(6,);
    const diff = m.diff.padStart(7,);
    console.error(`${name} ${relY} ${refW} ${cmpW} ${ratio} ${diff}`,);
  }

  console.error('',);
}

/**
 * Computes and prints key body proportion comparisons to stderr.
 *
 * Measures max/min widths in head, shoulder, waist, and hip regions
 * for both reference and composite, normalized to content height.
 *
 * @param pair - reference and composite profiles with bounds
 *
 * @example
 * ```ts
 * printKeyProportions({
 *   refProfile,
 *   cmpProfile,
 *   refBounds,
 *   cmpBounds,
 * });
 * ```
 */
export function printKeyProportions(pair: ProfilePair,): void {
  const {
    refProfile,
    cmpProfile,
    refBounds,
    cmpBounds,
  } = pair;

  /** Maximum width in the reference shoulder region (y 0.14-0.22). */
  const shoulderRef = maxWidthInRange(
    refProfile,
    contentToAbsY(
      refBounds,
      0.14,
    ),
    contentToAbsY(
      refBounds,
      0.22,
    ),
  );
  /** Maximum width in the composite shoulder region (y 0.14-0.22). */
  const shoulderCmp = maxWidthInRange(
    cmpProfile,
    contentToAbsY(
      cmpBounds,
      0.14,
    ),
    contentToAbsY(
      cmpBounds,
      0.22,
    ),
  );

  /** Minimum width in the reference waist region (y 0.25-0.35). */
  const waistRef = minWidthInRange(
    refProfile,
    contentToAbsY(
      refBounds,
      0.25,
    ),
    contentToAbsY(
      refBounds,
      0.35,
    ),
  );
  /** Minimum width in the composite waist region (y 0.25-0.35). */
  const waistCmp = minWidthInRange(
    cmpProfile,
    contentToAbsY(
      cmpBounds,
      0.25,
    ),
    contentToAbsY(
      cmpBounds,
      0.35,
    ),
  );

  /** Maximum width in the reference hip/skirt region (y 0.34-0.48). */
  const hipRef = maxWidthInRange(
    refProfile,
    contentToAbsY(
      refBounds,
      0.34,
    ),
    contentToAbsY(
      refBounds,
      0.48,
    ),
  );
  /** Maximum width in the composite hip/skirt region (y 0.34-0.48). */
  const hipCmp = maxWidthInRange(
    cmpProfile,
    contentToAbsY(
      cmpBounds,
      0.34,
    ),
    contentToAbsY(
      cmpBounds,
      0.48,
    ),
  );

  /** Maximum width in the reference head region (y 0-0.1). */
  const headRef = maxWidthInRange(
    refProfile,
    contentToAbsY(
      refBounds,
      0,
    ),
    contentToAbsY(
      refBounds,
      0.1,
    ),
  );
  /** Maximum width in the composite head region (y 0-0.1). */
  const headCmp = maxWidthInRange(
    cmpProfile,
    contentToAbsY(
      cmpBounds,
      0,
    ),
    contentToAbsY(
      cmpBounds,
      0.1,
    ),
  );

  console.error('Key proportions (normalized to content height):',);
  /** Reference content height in pixels for normalizing widths. */
  const refH = refBounds.totalHeight;
  /** Composite content height in pixels for normalizing widths. */
  const cmpH = cmpBounds.totalHeight;
  console.error(
    `  Max head width:      ref=${(headRef.width / refH).toFixed(3,)}  cmp=${
      (headCmp.width / cmpH)
        .toFixed(3,)
    }  ratio=${
      fmtRatio(
        headCmp.width / cmpH,
        headRef.width / refH,
      )
    }`,
  );
  console.error(
    `  Max shoulder width:  ref=${(shoulderRef.width / refH).toFixed(3,)}  cmp=${
      (shoulderCmp.width / cmpH).toFixed(3,)
    }  ratio=${
      fmtRatio(
        shoulderCmp.width / cmpH,
        shoulderRef.width / refH,
      )
    }`,
  );
  console.error(
    `  Min waist width:     ref=${(waistRef.width / refH).toFixed(3,)}  cmp=${
      (waistCmp.width / cmpH)
        .toFixed(3,)
    }  ratio=${
      fmtRatio(
        waistCmp.width / cmpH,
        waistRef.width / refH,
      )
    }`,
  );
  console.error(
    `  Max hip/skirt width: ref=${(hipRef.width / refH).toFixed(3,)}  cmp=${
      (hipCmp.width / cmpH)
        .toFixed(3,)
    }  ratio=${
      fmtRatio(
        hipCmp.width / cmpH,
        hipRef.width / refH,
      )
    }`,
  );
  console.error('',);
}
