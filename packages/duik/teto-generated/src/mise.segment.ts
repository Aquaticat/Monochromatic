/**
 * Generate per-part binary masks using ImageMagick color matching.
 *
 * For each body part, creates a PGM mask by OR-combining color-distance
 * selections, applying spatial bounding-box crops, morphological cleanup,
 * and connected-component filtering.
 *
 * Input: tmp/front.png (from crop step)
 * Output: tmp/masks/*.pgm (one per body part, full crop dimensions)
 *
 * @example
 * ```sh
 * mise run //packages/duik/teto-generated:segment
 * ```
 */
import { existsSync, mkdirSync } from 'node:fs'

import { BACKGROUND, TMP_DIR } from './config.ts'
import { PARTS } from './parts.ts'

import type { ColorSpec, PartDef } from './parts.ts'

/**
 * Run a shell command and throw on non-zero exit.
 *
 * @param cmd - Command tokens to execute
 * @throws Error when the subprocess exits with non-zero status
 */
async function run(cmd: readonly string[]): Promise<void> {
  const proc = Bun.spawn([...cmd], { stdout: 'inherit', stderr: 'inherit' })
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`Command failed (exit ${code}): ${cmd.join(' ')}`)
  }
}

/**
 * Convert a color tolerance (Euclidean RGB distance) to an ImageMagick fuzz percentage.
 * IM fuzz is a percentage of the maximum possible distance (sqrt(3) * 255 ≈ 441.67).
 *
 * @param tolerance - Euclidean distance threshold in RGB space
 * @returns Fuzz percentage string like "12%"
 */
function toleranceToFuzz(tolerance: number): string {
  const maxDist = Math.sqrt(3) * 255
  const pct = Math.round((tolerance / maxDist) * 100)
  return `${pct}%`
}

/**
 * Format an RGB triplet as an ImageMagick color string.
 *
 * @param rgb - RGB values 0-255
 * @returns Color string like "rgb(204,34,68)"
 */
function rgbString(rgb: readonly [number, number, number]): string {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
}

/**
 * Create a single-color binary mask using ImageMagick fuzz matching.
 *
 * Pixels within tolerance of the target color become white (255);
 * all others become black (0).
 *
 * @param input - Source image path
 * @param output - Output PGM path
 * @param color - Target color specification
 */
async function createColorMask({
  input,
  output,
  color,
}: {
  readonly input: string
  readonly output: string
  readonly color: ColorSpec
}): Promise<void> {
  const fuzz = toleranceToFuzz(color.tolerance)
  const rgb = rgbString(color.rgb)

  // Fill everything NOT matching the target color with black,
  // then fill the remaining (matching) pixels with white.
  await run([
    'magick', input,
    '-fuzz', fuzz,
    '-fill', 'black', '+opaque', rgb,
    '-fill', 'white', '-opaque', rgb,
    '-colorspace', 'Gray',
    output,
  ])
}

/**
 * OR-combine multiple mask images into one.
 * Uses ImageMagick Lighten compositing (max of each pixel).
 *
 * @param masks - Paths to mask images to combine
 * @param output - Output combined mask path
 */
async function combineMasks({
  masks,
  output,
}: {
  readonly masks: readonly string[]
  readonly output: string
}): Promise<void> {
  if (masks.length === 0) return
  if (masks.length === 1) {
    await run(['magick', masks[0]!, output])
    return
  }

  // Stack all masks and flatten with Lighten (OR)
  const args: string[] = ['magick', masks[0]!]
  for (let i = 1; i < masks.length; i++) {
    args.push(masks[i]!, '-compose', 'Lighten', '-composite')
  }
  args.push(output)
  await run(args)
}

/**
 * Subtract exclusion colors from a mask.
 * Pixels matching any exclude color are set to black.
 *
 * @param mask - Input mask path (modified in place via output)
 * @param input - Original color image for color matching
 * @param output - Output mask path
 * @param excludes - Colors to subtract
 */
async function subtractColors({
  mask,
  input,
  output,
  excludes,
}: {
  readonly mask: string
  readonly input: string
  readonly output: string
  readonly excludes: readonly ColorSpec[]
}): Promise<void> {
  if (excludes.length === 0) {
    await run(['magick', mask, output])
    return
  }

  // Create an exclusion mask (white = pixels to REMOVE)
  const excPaths: string[] = []
  for (let i = 0; i < excludes.length; i++) {
    const excPath = output.replace('.pgm', `_exc${i}.pgm`)
    await createColorMask({ input, output: excPath, color: excludes[i]! })
    excPaths.push(excPath)
  }

  // Combine exclusion masks
  const combinedExc = output.replace('.pgm', '_exc_combined.pgm')
  await combineMasks({ masks: excPaths, output: combinedExc })

  // Subtract: mask AND (NOT exclusion)
  await run([
    'magick', mask, combinedExc,
    '-compose', 'MinusSrc', '-composite',
    output,
  ])
}

/**
 * Apply spatial bounding box: zero out pixels outside the part's region.
 *
 * @param mask - Input mask path
 * @param output - Output mask path
 * @param bbox - Fractional bounding box [x, y, w, h]
 * @param imgWidth - Image width in pixels
 * @param imgHeight - Image height in pixels
 */
async function applyBBox({
  mask,
  output,
  bbox,
  imgWidth,
  imgHeight,
}: {
  readonly mask: string
  readonly output: string
  readonly bbox: readonly [number, number, number, number]
  readonly imgWidth: number
  readonly imgHeight: number
}): Promise<void> {
  const bx = Math.round(bbox[0] * imgWidth)
  const by = Math.round(bbox[1] * imgHeight)
  const bw = Math.round(bbox[2] * imgWidth)
  const bh = Math.round(bbox[3] * imgHeight)

  // Draw a white rectangle on black canvas, then AND with mask
  // This zeros everything outside the bbox
  await run([
    'magick', mask,
    '(', '-size', `${imgWidth}x${imgHeight}`, 'xc:black',
    '-fill', 'white', '-draw', `rectangle ${bx},${by} ${bx + bw},${by + bh}`,
    ')',
    '-compose', 'Darken', '-composite',
    output,
  ])
}

/**
 * Apply morphological close (dilate then erode) and open (erode then dilate).
 *
 * @param mask - Input mask path
 * @param output - Output mask path
 * @param closeK - Close kernel radius; skipped if < 2
 * @param openK - Open kernel radius; skipped if < 2
 */
async function applyMorphology({
  mask,
  output,
  closeK,
  openK,
}: {
  readonly mask: string
  readonly output: string
  readonly closeK: number
  readonly openK: number
}): Promise<void> {
  const args: string[] = ['magick', mask]

  if (closeK >= 2) {
    args.push('-morphology', `Close:${closeK}`, 'Disk')
  }
  if (openK >= 2) {
    args.push('-morphology', `Open:${openK}`, 'Disk')
  }

  args.push(output)
  await run(args)
}

/**
 * Get image dimensions using magick identify.
 *
 * @param path - Image file path
 * @returns Width and height in pixels
 */
async function getImageSize(path: string): Promise<{ width: number; height: number }> {
  const proc = Bun.spawn(['magick', 'identify', '-format', '%w %h', path], {
    stdout: 'pipe',
    stderr: 'inherit',
  })
  const text = await new Response(proc.stdout).text()
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`magick identify failed for ${path}`)
  }
  const parts = text.trim().split(' ')
  return { width: Number(parts[0]), height: Number(parts[1]) }
}

/**
 * Process a single body part: color mask, bbox crop, morphology, save.
 *
 * @param part - Part definition
 * @param inputImage - Cropped front view path
 * @param imgWidth - Image width
 * @param imgHeight - Image height
 * @param fgMask - Path to foreground mask
 */
async function processPart({
  part,
  inputImage,
  imgWidth,
  imgHeight,
  fgMask,
}: {
  readonly part: PartDef
  readonly inputImage: string
  readonly imgWidth: number
  readonly imgHeight: number
  readonly fgMask: string
}): Promise<void> {
  const masksDir = `${TMP_DIR}/masks`
  const workDir = `${TMP_DIR}/work`
  const base = `${workDir}/${part.name}`

  // When colors array is empty, use all foreground pixels (for parts
  // whose color matches the background, like epaulettes and accessories).
  const fgIntersected = `${base}_fg.pgm`

  if (part.colors.length === 0) {
    // Skip color matching; use raw foreground mask
    await run(['magick', fgMask, fgIntersected])
  } else {
    // Step 1: Create per-color masks
    const colorPaths: string[] = []
    for (let i = 0; i < part.colors.length; i++) {
      const colorPath = `${base}_c${i}.pgm`
      await createColorMask({ input: inputImage, output: colorPath, color: part.colors[i]! })
      colorPaths.push(colorPath)
    }

    // Step 2: Combine color masks (OR)
    const combined = `${base}_combined.pgm`
    await combineMasks({ masks: colorPaths, output: combined })

    // Step 3: Subtract excluded colors
    const excluded = `${base}_excluded.pgm`
    await subtractColors({
      mask: combined,
      input: inputImage,
      output: excluded,
      excludes: part.excludeColors ?? [],
    })

    // Step 4: Intersect with foreground mask
    await run([
      'magick', excluded, fgMask,
      '-compose', 'Darken', '-composite',
      fgIntersected,
    ])
  }

  // Step 5: Apply spatial bounding box
  const bboxed = `${base}_bbox.pgm`
  await applyBBox({ mask: fgIntersected, output: bboxed, bbox: part.bbox, imgWidth, imgHeight })

  // Step 6: Morphological cleanup
  const cleaned = `${base}_clean.pgm`
  await applyMorphology({
    mask: bboxed,
    output: cleaned,
    closeK: part.morphClose ?? 5,
    openK: part.morphOpen ?? 3,
  })

  // Step 7: Filter out small noise blobs via area threshold.
  // Cannot use keep-top=1 because the black background is the largest component.
  // Instead, remove components smaller than 1% of the bbox area.
  const bboxArea = Math.round(part.bbox[2] * imgWidth * part.bbox[3] * imgHeight)
  const areaThreshold = Math.max(20, Math.round(bboxArea * 0.01))
  const final = `${masksDir}/${part.name}.pgm`
  await run([
    'magick', cleaned,
    '-define', `connected-components:area-threshold=${areaThreshold}`,
    '-define', 'connected-components:mean-color=true',
    '-connected-components', '4',
    final,
  ])

  console.log(`  ${part.name}: done`)
}

async function main(): Promise<void> {
  console.log('Segmenting body parts from front view')

  const inputImage = `${TMP_DIR}/front.png`
  if (!existsSync(inputImage)) {
    throw new Error(`Cropped front view not found at ${inputImage} — run the crop task first`)
  }

  for (const dir of [`${TMP_DIR}/masks`, `${TMP_DIR}/work`]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  const { width: imgWidth, height: imgHeight } = await getImageSize(inputImage)
  console.log(`  Front view: ${imgWidth}x${imgHeight}`)

  // Create global foreground mask (remove background)
  const fgMask = `${TMP_DIR}/work/foreground.pgm`
  const bgRgb = rgbString(BACKGROUND.color)
  const bgFuzz = toleranceToFuzz(BACKGROUND.tolerance)

  // Background pixels → black, everything else → white
  await run([
    'magick', inputImage,
    '-fuzz', bgFuzz,
    '-fill', 'black', '-opaque', bgRgb,
    '-fill', 'white', '+opaque', 'black',
    '-colorspace', 'Gray',
    fgMask,
  ])
  console.log('  Created foreground mask')

  // Process each part sequentially (ImageMagick is already fast per-call)
  for (const part of PARTS) {
    await processPart({ part, inputImage, imgWidth, imgHeight, fgMask })
  }

  console.log(`Segmentation complete: ${PARTS.length} masks in ${TMP_DIR}/masks/`)
}

await main()

export {}
