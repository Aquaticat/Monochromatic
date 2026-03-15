/**
 * Anatomical landmark measurement and proportion comparison.
 *
 * Computes body width measurements at key anatomical positions
 * and compares reference and composite silhouettes.
 *
 * @module
 */

// oxlint-disable no-magic-numbers -- measurement positions and formatting constants

import { widthAtRelY, } from './measure-profile-query.ts';

import type {
  ContentBoundsResult,
  MeasurementRow,
  WidthProfile,
} from './measure-profile-types.ts';

/**
 * Anatomical landmark positions as relative fractions of total content height.
 * These approximate where key body parts fall vertically.
 */
const LANDMARKS = {
  headTop: 0,
  headCenter: 0.05,
  chin: 0.12,
  shoulders: 0.17,
  chest: 0.22,
  waist: 0.3,
  hips: 0.36,
  skirtBottom: 0.46,
  midThigh: 0.52,
  knees: 0.6,
  midCalf: 0.72,
  ankles: 0.8,
  feet: 0.9,
} as const;

/** Paired reference and composite profiles with their content bounds. */
export type ProfilePair = {
  /** Reference silhouette width profile. */
  refProfile: WidthProfile;
  /** Composite silhouette width profile. */
  cmpProfile: WidthProfile;
  /** Content bounds of the reference profile. */
  refBounds: ContentBoundsResult;
  /** Content bounds of the composite profile. */
  cmpBounds: ContentBoundsResult;
};

/**
 * Computes landmark width measurements comparing reference and composite.
 *
 * Measures width at each anatomical landmark position, normalizes
 * relative to content height, and computes ratios and differences.
 *
 * @param pair - reference and composite profiles with bounds
 *
 * @returns array of measurement rows for all landmarks
 */
export function computeLandmarkMeasurements(pair: ProfilePair,): MeasurementRow[] {
  const { refProfile, cmpProfile, refBounds, cmpBounds, } = pair;
  const measurements: MeasurementRow[] = [];

  for (const [name, relY,] of Object.entries(LANDMARKS,)) {
    /** Map relative content position to absolute image position. */
    const refAbsY = refBounds.top + relY * (refBounds.bottom - refBounds.top);
    const cmpAbsY = cmpBounds.top + relY * (cmpBounds.bottom - cmpBounds.top);

    const refW = widthAtRelY(refProfile, refAbsY,);
    const cmpW = widthAtRelY(cmpProfile, cmpAbsY,);

    /** Normalize widths relative to content height for fair comparison. */
    const refNorm = refW / refBounds.totalHeight;
    const cmpNorm = cmpW / cmpBounds.totalHeight;

    const ratio = refNorm > 0 ? (cmpNorm / refNorm).toFixed(2,) : 'N/A';
    const diffPct = refNorm > 0
      ? (((cmpNorm - refNorm) / refNorm) * 100).toFixed(1,)
      : 'N/A';

    measurements.push({
      landmark: name,
      relY,
      refWidth: refW,
      cmpWidth: cmpW,
      ratio,
      diff: `${diffPct}%`,
    },);
  }

  return measurements;
}
