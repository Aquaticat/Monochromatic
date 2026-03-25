/**
 * Silhouette preparation for body proportion measurement.
 *
 * Renders reference and composite images to normalized binary
 * silhouettes using ImageMagick for consistent width comparison.
 *
 * @module
 */

import { execSync, } from 'node:child_process';

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

/** Parameters for silhouette preparation. */
export type PrepareSilhouettesParams = {
  /** Path to reference character sheet image. */
  refImage: string;
  /** Path to assembled composite SVG. */
  compositeSvg: string;
  /** Crop region for front-view character from the reference sheet. */
  refCrop: {
    width: number;
    height: number;
    x: number;
    y: number
  };
  /** Height to normalize both images to for consistent measurement. */
  normHeight: number;
  /** Temporary directory for intermediate images. */
  tmpDir: string;
};

/** Paths to the generated silhouette images. */
export type PrepareSilhouettesResult = {
  /** Path to reference binary silhouette PNG. */
  refSilhouette: string;
  /** Path to composite binary silhouette PNG. */
  cmpSilhouette: string;
};

/**
 * Prepares normalized binary silhouettes from reference and composite images.
 *
 * Crops the reference front-view, trims background, normalizes height,
 * then converts both to binary silhouettes for width measurement.
 *
 * @param params - preparation configuration
 *
 * @returns paths to generated silhouette images
 */
export function prepareSilhouettes(
  params: PrepareSilhouettesParams,
): PrepareSilhouettesResult {
  const {
    refImage,
    compositeSvg,
    refCrop,
    normHeight,
    tmpDir,
  } = params;

  /**
   * Reference: crop front view, trim background, normalize height,
   * then create binary silhouette.
   */
  run(
    `magick "${refImage}" `
      + `-crop ${refCrop.width}x${refCrop.height}+${refCrop.x}+${refCrop.y} +repage `
      + `-fuzz 15% -trim +repage `
      + `-resize x${normHeight} `
      + `"${tmpDir}/measure_ref_trimmed.png"`,
  );

  run(
    `magick "${tmpDir}/measure_ref_trimmed.png" `
      + `-fuzz 20% -fill white -opaque white `
      + `-fuzz 20% -fill white -opaque "#f0f0f0" `
      + `-threshold 95% -negate `
      + `"${tmpDir}/measure_ref_silhouette.png"`,
  );

  /**
   * Composite: render SVG, trim background, normalize height,
   * then create binary silhouette.
   */
  run(
    `magick "${compositeSvg}" `
      + `-fuzz 5% -trim +repage `
      + `-resize x${normHeight} `
      + `"${tmpDir}/measure_cmp_trimmed.png"`,
  );

  run(
    `magick "${tmpDir}/measure_cmp_trimmed.png" `
      + `-fuzz 10% -fill white -opaque "#f0f0f0" `
      + `-threshold 95% -negate `
      + `"${tmpDir}/measure_cmp_silhouette.png"`,
  );

  return {
    refSilhouette: `${tmpDir}/measure_ref_silhouette.png`,
    cmpSilhouette: `${tmpDir}/measure_cmp_silhouette.png`,
  };
}
