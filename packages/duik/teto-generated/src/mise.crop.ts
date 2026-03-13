/**
 * Crop the front view from the 3-view reference sheet.
 *
 * Extracts a rectangular region at known pixel coordinates, trims the
 * uniform background, and saves as PNG for downstream segmentation.
 *
 * Output: tmp/front.png
 *
 * @example
 * ```sh
 * mise run //packages/duik/teto-generated:crop
 * ```
 */
import { existsSync, mkdirSync } from 'node:fs'

import { FRONT_VIEW_CROP, REFERENCE_PATH, TMP_DIR } from './config.ts'

/**
 * Run a shell command and throw on non-zero exit.
 *
 * @param cmd - Command tokens to execute
 * @throws Error when the subprocess exits with non-zero status
 */
async function run(cmd: readonly string[]): Promise<void> {
  console.log(`  $ ${cmd.join(' ')}`)
  const proc = Bun.spawn(cmd, { stdout: 'inherit', stderr: 'inherit' })
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`Command failed (exit ${code}): ${cmd.join(' ')}`)
  }
}

async function main(): Promise<void> {
  console.log('Cropping front view from reference sheet')

  if (!existsSync(REFERENCE_PATH)) {
    throw new Error(`Reference image not found: ${REFERENCE_PATH}`)
  }

  if (!existsSync(TMP_DIR)) {
    mkdirSync(TMP_DIR, { recursive: true })
  }

  const { x, y, width, height } = FRONT_VIEW_CROP
  const geometry = `${width}x${height}+${x}+${y}`
  const output = `${TMP_DIR}/front.png`

  // Crop the front view region and trim any uniform border
  await run([
    'magick',
    REFERENCE_PATH,
    '-crop', geometry,
    '+repage',
    '-fuzz', '3%',
    '-trim',
    '+repage',
    output,
  ])

  console.log(`Saved: ${output}`)
}

await main()

export {}
