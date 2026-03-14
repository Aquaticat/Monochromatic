/**
 * Compare the generated composite against the reference image.
 *
 * Crops and normalizes the reference front view, then runs pixel-level
 * comparison metrics (SSIM, RMSE, PHASH) between the composite render
 * and the reference.
 *
 * Input: parts/_composite.png (from composite step)
 * Output: tmp/comparison.png (side-by-side), metrics printed to stdout
 *
 * @example
 * ```sh
 * mise run //packages/duik/teto-generated:compare
 * ```
 */
import { existsSync } from 'node:fs'

import { FRONT_VIEW_CROP, PARTS_DIR, REFERENCE_PATH, TMP_DIR } from './config.ts'

/**
 * Run a shell command, capture stdout, throw on failure.
 *
 * @param cmd - Command tokens
 * @returns Trimmed stdout string
 * @throws Error on non-zero exit
 */
async function capture(cmd: readonly string[]): Promise<string> {
  const proc = Bun.spawn([...cmd], { stdout: 'pipe', stderr: 'pipe' })
  const stdout = await new Response(proc.stdout).text()
  const code = await proc.exited
  if (code !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`Command failed (exit ${code}): ${cmd.join(' ')}\n${stderr}`)
  }
  return stdout.trim()
}

/**
 * Run a shell command and throw on non-zero exit.
 *
 * @param cmd - Command tokens
 * @throws Error on non-zero exit
 */
async function run(cmd: readonly string[]): Promise<void> {
  const proc = Bun.spawn([...cmd], { stdout: 'inherit', stderr: 'inherit' })
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`Command failed (exit ${code}): ${cmd.join(' ')}`)
  }
}

/** Compares the composite SVG rendering against the reference image. */
async function main(): Promise<void> {
  console.log('Comparing composite against reference')

  const compositePng = `${PARTS_DIR}/_composite.png`
  if (!existsSync(compositePng)) {
    throw new Error(`Composite PNG not found: ${compositePng} — run the composite task first`)
  }

  if (!existsSync(REFERENCE_PATH)) {
    throw new Error(`Reference image not found: ${REFERENCE_PATH}`)
  }

  // Crop and normalize reference front view to match composite dimensions
  const refCropped = `${TMP_DIR}/ref_front_cropped.png`
  const { x, y, width, height } = FRONT_VIEW_CROP

  await run([
    'magick', REFERENCE_PATH,
    '-crop', `${width}x${height}+${x}+${y}`,
    '+repage',
    '-fuzz', '3%',
    '-trim',
    '+repage',
    refCropped,
  ])

  // Get composite dimensions and resize reference to match
  const compositeSize = await capture(['magick', 'identify', '-format', '%wx%h', compositePng])
  const refNormalized = `${TMP_DIR}/ref_normalized.png`

  await run([
    'magick', refCropped,
    '-resize', compositeSize,
    '-background', 'white',
    '-flatten',
    refNormalized,
  ])

  // Normalize composite background too
  const compositeNorm = `${TMP_DIR}/composite_normalized.png`
  await run([
    'magick', compositePng,
    '-background', 'white',
    '-flatten',
    compositeNorm,
  ])

  console.log(`  Reference: ${refCropped} → ${compositeSize}`)

  // Run comparison metrics.
  // magick compare outputs the metric value to STDERR and exits non-zero
  // when images differ, which is normal behavior.
  console.log('\nMetrics:')

  const metrics = ['RMSE', 'SSIM', 'PHASH'] as const
  for (const metric of metrics) {
    const proc = Bun.spawn([
      'magick', 'compare',
      '-metric', metric,
      compositeNorm,
      refNormalized,
      'null:',
    ], { stdout: 'pipe', stderr: 'pipe' })
    const stderr = await new Response(proc.stderr).text()
    await proc.exited
    // The metric value is the first number-like token on stderr
    const value = stderr.trim().split(/\s/)[0] ?? 'n/a'
    console.log(`  ${metric}: ${value}`)
  }

  // Side-by-side comparison image
  const sideBySide = `${TMP_DIR}/comparison.png`
  await run([
    'magick', compositeNorm, refNormalized,
    '+append',
    '-bordercolor', 'gray',
    '-border', '2',
    sideBySide,
  ])
  console.log(`\nSide-by-side: ${sideBySide}`)

  // Difference map (non-fatal, may fail if sizes still differ slightly)
  const diffMap = `${TMP_DIR}/diff_map.png`
  const diffProc = Bun.spawn([
    'magick', 'compare',
    compositeNorm, refNormalized,
    diffMap,
  ], { stdout: 'inherit', stderr: 'inherit' })
  const diffCode = await diffProc.exited
  if (diffCode === 0 || diffCode === 1) {
    console.log(`Difference map: ${diffMap}`)
  } else {
    console.error('  WARN: Difference map generation failed (non-critical)')
  }
}

await main()

export {}
