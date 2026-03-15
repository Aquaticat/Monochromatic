/**
 * Comparison metrics and visual output generation.
 *
 * Runs pixel-level comparison metrics (RMSE, SSIM, PHASH) between two
 * normalized images and generates side-by-side and difference map outputs.
 *
 * @module
 */
import { run, } from './segment-utils.ts';

/**
 * Comparison metric names supported by ImageMagick.
 *
 * @example
 * ```ts
 * for (const m of METRICS) console.log(m)
 * ```
 */
const METRICS = ['RMSE', 'SSIM', 'PHASH',] as const;

/**
 * Run RMSE, SSIM, and PHASH comparison metrics between two images.
 *
 * ImageMagick `compare` outputs the metric value to stderr and exits non-zero
 * when images differ, which is normal behavior.
 *
 * @param compositeNorm - Path to normalized composite image
 *
 * @param refNormalized - Path to normalized reference image
 */
export async function runComparisonMetrics(
  compositeNorm: string,
  refNormalized: string,
): Promise<void> {
  console.log('\nMetrics:',);

  for (const metric of METRICS) {
    // eslint-disable-next-line no-await-in-loop -- sequential metric execution; each spawns a process that must finish before the next
    const proc = Bun.spawn([
      'magick',
      'compare',
      '-metric',
      metric,
      compositeNorm,
      refNormalized,
      'null:',
    ], { stdout: 'pipe', stderr: 'pipe', },);
    // eslint-disable-next-line no-await-in-loop -- must read stderr before next metric
    const stderr = await new Response(proc.stderr,).text();
    // eslint-disable-next-line no-await-in-loop -- process must exit before parsing
    await proc.exited;
    const value = stderr.trim().split(/\s/,)[0] ?? 'n/a';
    console.log(`  ${metric}: ${value}`,);
  }
}

/**
 * Generate side-by-side comparison and difference map images.
 *
 * @param compositeNorm - Path to normalized composite image
 *
 * @param refNormalized - Path to normalized reference image
 *
 * @param tmpDir - Output directory for comparison images
 */
export async function generateComparisonImages(
  compositeNorm: string,
  refNormalized: string,
  tmpDir: string,
): Promise<void> {
  const sideBySide = `${tmpDir}/comparison.png`;
  await run([
    'magick',
    compositeNorm,
    refNormalized,
    '+append',
    '-bordercolor',
    'gray',
    '-border',
    '2',
    sideBySide,
  ],);
  console.log(`\nSide-by-side: ${sideBySide}`,);

  const diffMap = `${tmpDir}/diff_map.png`;
  const diffProc = Bun.spawn([
    'magick',
    'compare',
    compositeNorm,
    refNormalized,
    diffMap,
  ], { stdout: 'inherit', stderr: 'inherit', },);
  const diffCode = await diffProc.exited;
  if (diffCode === 0 || diffCode === 1)
    console.log(`Difference map: ${diffMap}`,);
  else
    console.error('  WARN: Difference map generation failed (non-critical)',);
}
