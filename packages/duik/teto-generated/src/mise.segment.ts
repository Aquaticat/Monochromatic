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
import {
  applyBBox,
  applyMorphology,
  combineMasks,
  createColorMask,
  getImageSize,
  rgbString,
  run,
  subtractColors,
  toleranceToFuzz,
} from './segment-ops.ts'

import type { PartDef } from './parts.ts'

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
      const color = part.colors[i]
      if (color === undefined) continue
      await createColorMask({ input: inputImage, output: colorPath, color })
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

/**
 * Main segmentation entry point.
 * Creates foreground mask, then processes each body part sequentially.
 */
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
