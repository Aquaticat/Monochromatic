/**
 * Spatial and morphological mask operations for body part segmentation.
 *
 * Bounding box application and morphological cleanup (close/open).
 *
 * @module
 */
import { run } from './segment-utils.ts'

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
