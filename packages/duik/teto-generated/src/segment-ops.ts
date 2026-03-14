/**
 * ImageMagick mask operations for body part segmentation.
 *
 * Low-level functions for creating color masks, combining masks,
 * subtracting exclusion colors, applying bounding boxes, and
 * morphological cleanup.
 *
 * @module
 */

import type { ColorSpec } from './parts.ts'

/**
 * Run a shell command and throw on non-zero exit.
 *
 * @param cmd - Command tokens to execute
 *
 * @throws Error when the subprocess exits with non-zero status
 */
export async function run(cmd: readonly string[]): Promise<void> {
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
 *
 * @returns Fuzz percentage string like "12%"
 */
export function toleranceToFuzz(tolerance: number): string {
  const maxDist = Math.sqrt(3) * 255
  const pct = Math.round((tolerance / maxDist) * 100)
  return `${pct}%`
}

/**
 * Format an RGB triplet as an ImageMagick color string.
 *
 * @param rgb - RGB values 0-255
 *
 * @returns Color string like "rgb(204,34,68)"
 */
export function rgbString(rgb: readonly [number, number, number]): string {
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
export async function createColorMask({
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
export async function combineMasks({
  masks,
  output,
}: {
  readonly masks: readonly string[]
  readonly output: string
}): Promise<void> {
  if (masks.length === 0) return
  const firstMask = masks[0]
  if (firstMask === undefined) return
  if (masks.length === 1) {
    await run(['magick', firstMask, output])
    return
  }

  // Stack all masks and flatten with Lighten (OR)
  const args: string[] = ['magick', firstMask]
  for (let i = 1; i < masks.length; i++) {
    const mask = masks[i]
    if (mask === undefined) continue
    args.push(mask, '-compose', 'Lighten', '-composite')
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
export async function subtractColors({
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
    const excludeColor = excludes[i]
    if (excludeColor === undefined) continue
    await createColorMask({ input, output: excPath, color: excludeColor })
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
export async function applyBBox({
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
export async function applyMorphology({
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
 *
 * @returns Width and height in pixels
 */
export async function getImageSize(path: string): Promise<{ width: number; height: number }> {
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
