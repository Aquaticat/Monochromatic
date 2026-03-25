/**
 * Width profile visualization as CSV and SVG chart.
 *
 * Generates a CSV of normalized width measurements at each relative
 * body position, and an SVG chart overlaying reference and composite
 * width profiles for visual comparison.
 *
 * @module
 */

// oxlint-disable no-magic-numbers -- chart dimensions and measurement steps

import { execSync, } from 'node:child_process';
import { writeFileSync, } from 'node:fs';

import {
  contentToAbsY,
  widthAtRelY,
} from './measure-profile-query.ts';

import type {
  ContentBoundsResult,
  WidthProfile,
} from './measure-profile-types.ts';

/**
 * Runs a shell command and returns stdout trimmed.
 *
 * @param cmd - shell command string
 *
 * @returns trimmed stdout
 */
function run(cmd: string,): string {
  return execSync(
    cmd,
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe',], },
  ).trim();
}

/** Parameters for width profile output generation. */
export type WidthProfileOutputParams = {
  /** Reference silhouette width profile. */
  refProfile: WidthProfile;
  /** Composite silhouette width profile. */
  cmpProfile: WidthProfile;
  /** Content bounds of the reference profile. */
  refBounds: ContentBoundsResult;
  /** Content bounds of the composite profile. */
  cmpBounds: ContentBoundsResult;
  /** Temporary directory for output files. */
  tmpDir: string;
};

/**
 * Generates CSV and SVG chart of width profiles for external analysis.
 *
 * Writes a CSV with normalized ref/cmp widths at each percent of body height,
 * and an SVG chart with blue (reference) and red (composite) polylines.
 *
 * @param params - profiles, bounds, and output directory
 */
export function generateWidthProfileOutput(params: WidthProfileOutputParams,): void {
  const {
    refProfile,
    cmpProfile,
    refBounds,
    cmpBounds,
    tmpDir,
  } = params;
  const refH = refBounds.totalHeight;
  const cmpH = cmpBounds.totalHeight;

  /** Width profile CSV for external analysis. */
  const csvLines = ['y_rel,ref_width_norm,cmp_width_norm',];

  for (let i = 0; i <= 100; i++) {
    const relY = i / 100;
    const refAbsY = refBounds.top + relY * (refBounds.bottom - refBounds.top);
    const cmpAbsY = cmpBounds.top + relY * (cmpBounds.bottom - cmpBounds.top);

    const refW = widthAtRelY(
      refProfile,
      refAbsY,
    ) / refBounds.totalHeight;
    const cmpW = widthAtRelY(
      cmpProfile,
      cmpAbsY,
    ) / cmpBounds.totalHeight;

    csvLines.push(`${relY.toFixed(2,)},${refW.toFixed(4,)},${cmpW.toFixed(4,)}`,);
  }

  writeFileSync(
    `${tmpDir}/width_profile.csv`,
    csvLines.join('\n',),
  );
  console.error(`Width profile CSV: ${tmpDir}/width_profile.csv`,);

  /**
   * Width of the SVG width-profile chart in pixels.
   * Draws ref profile in blue and composite in red, plotted vertically
   * (y = body position top-to-bottom, x = width).
   */
  const CHART_W = 600;
  /** Height of the SVG width-profile chart in pixels. */
  const CHART_H = 800;
  /** Horizontal scale multiplier converting normalized widths to chart pixels. */
  const SCALE_X = CHART_W * 2;

  /** SVG polyline coordinate pairs for the reference width profile. */
  const refPoints: string[] = [];
  /** SVG polyline coordinate pairs for the composite width profile. */
  const cmpPoints: string[] = [];

  for (let i = 0; i <= 100; i++) {
    const relY = i / 100;
    const refAbsY = contentToAbsY(
      refBounds,
      relY,
    );
    const cmpAbsY = contentToAbsY(
      cmpBounds,
      relY,
    );

    const refW = widthAtRelY(
      refProfile,
      refAbsY,
    ) / refH;
    const cmpW = widthAtRelY(
      cmpProfile,
      cmpAbsY,
    ) / cmpH;

    const chartY = Math.round(relY * CHART_H,);
    refPoints.push(`${Math.round(refW * SCALE_X,)},${chartY}`,);
    cmpPoints.push(`${Math.round(cmpW * SCALE_X,)},${chartY}`,);
  }

  /** Assembled SVG markup for the side-by-side width profile chart. */
  const chartSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART_W} ${CHART_H}" width="${CHART_W}" height="${CHART_H}">
  <rect width="${CHART_W}" height="${CHART_H}" fill="white"/>
  <text x="10" y="20" font-size="14" fill="blue">Reference</text>
  <text x="10" y="38" font-size="14" fill="red">Composite</text>
  <polyline points="${refPoints.join(' ',)}" fill="none" stroke="blue" stroke-width="2"/>
  <polyline points="${cmpPoints.join(' ',)}" fill="none" stroke="red" stroke-width="2"/>
</svg>`;

  writeFileSync(
    `${tmpDir}/width_profile_chart.svg`,
    chartSvg,
  );

  /** Also render to PNG. */
  try {
    run(
      `magick "${tmpDir}/width_profile_chart.svg" "${tmpDir}/width_profile_chart.png"`,
    );
  }
  catch {
    /* SVG is sufficient if PNG rendering fails. */
  }

  console.error(
    `Width profile chart: ${tmpDir}/width_profile_chart.svg  (blue=ref, red=composite)`,
  );
}
