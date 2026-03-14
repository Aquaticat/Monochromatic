// oxlint-disable no-magic-numbers, no-non-null-assertion -- measurement script with many dimensional constants and PGM index access where bounds are verified by loop
/**
 * Measures body proportions from the composite SVG and reference image.
 *
 * Renders both to normalized PNGs, converts to binary silhouettes,
 * then scans each row to build a width profile. Extracts key anatomical
 * measurements (head width, shoulder width, waist, hips, etc.) and
 * compares ratios between reference and composite.
 *
 * @example
 * ```sh
 * bun run src/mise.measure.ts
 * ```
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Directory containing individual body part SVG files. */
const PARTS_DIR = join(import.meta.dirname, '..', 'parts')
/** Path to the assembled composite SVG from the build step. */
const COMPOSITE_SVG = join(PARTS_DIR, '_composite_inline.svg')
/** Path to the reference character sheet image for comparison. */
const REF_IMAGE = '/home/user/Nextcloud/Text/Docs/Algonquin/MTM6403/teto_sv_3views.jpg'
/** Temporary directory for intermediate measurement images. */
const TMP = '/tmp/claude-1000'

/** Crop region for front-view character from the reference sheet. */
const REF_CROP = { width: 290, height: 880, x: 1_440, y: 60 }

/** Height to normalize both images to for consistent measurement. */
const NORM_HEIGHT = 1_000

/**
 * Runs a shell command and returns stdout trimmed.
 *
 * @param cmd - shell command string
 *
 * @returns trimmed stdout
 */
function run(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}

/** Always rebuild composite first. */
console.error('--- Rebuilding composite ---')
execSync(`bun run ${join(import.meta.dirname, 'mise.build-composite.ts')}`, { stdio: 'inherit' })

if (!existsSync(REF_IMAGE)) {
  throw new Error(`Reference image not found at ${REF_IMAGE}`)
}

console.error('--- Preparing normalized silhouettes ---')

/**
 * Reference: crop front view, trim background, normalize height,
 * then create binary silhouette.
 */
run(
  `magick "${REF_IMAGE}" ` +
  `-crop ${REF_CROP.width}x${REF_CROP.height}+${REF_CROP.x}+${REF_CROP.y} +repage ` +
  `-fuzz 15% -trim +repage ` +
  `-resize x${NORM_HEIGHT} ` +
  `"${TMP}/measure_ref_trimmed.png"`,
)

run(
  `magick "${TMP}/measure_ref_trimmed.png" ` +
  `-fuzz 20% -fill white -opaque white ` +
  `-fuzz 20% -fill white -opaque "#f0f0f0" ` +
  `-threshold 95% -negate ` +
  `"${TMP}/measure_ref_silhouette.png"`,
)

/**
 * Composite: render SVG, trim background, normalize height,
 * then create binary silhouette.
 */
run(
  `magick "${COMPOSITE_SVG}" ` +
  `-fuzz 5% -trim +repage ` +
  `-resize x${NORM_HEIGHT} ` +
  `"${TMP}/measure_cmp_trimmed.png"`,
)

run(
  `magick "${TMP}/measure_cmp_trimmed.png" ` +
  `-fuzz 10% -fill white -opaque "#f0f0f0" ` +
  `-threshold 95% -negate ` +
  `"${TMP}/measure_cmp_silhouette.png"`,
)

/**
 * Scans a grayscale/binary image row by row to build a width profile.
 *
 * Uses ImageMagick to dump pixel values as text, then parses each row
 * to find the leftmost and rightmost non-zero pixel.
 *
 * @param imagePath - path to the silhouette PNG
 *
 * @returns object with dimensions and per-row width data
 */
function measureWidthProfile(imagePath: string): {
  imageWidth: number
  imageHeight: number
  rows: { y: number; left: number; right: number; width: number }[]
} {
  /** Get image dimensions. */
  const dims = run(`magick identify -format "%w %h" "${imagePath}"`)
  const [imgW, imgH] = dims.split(' ').map(Number)

  /**
   * Dump as single-channel gray values.
   * Output format: "col,row: (value)"
   * We sample every 2nd row for speed.
   */
  const rawDump = run(
    `magick "${imagePath}" -colorspace Gray -depth 8 -compress none PGM:- 2>/dev/null > "${TMP}/measure_dump.pgm" && echo done`,
  )

  /** Read the PGM file directly -- it's a simple text format. */
  const pgmData = readFileSync(`${TMP}/measure_dump.pgm`, 'utf8')
  const pgmLines = pgmData.split('\n')

  /**
   * PGM format: P2, then width height, then max value, then pixel values.
   * Skip comment lines starting with #.
   */
  const dataLines = pgmLines.filter(function skipComments(line) {
    return line.trim().length > 0 && !line.startsWith('#') && line.trim() !== 'P2'
  })

  /** First data line is "width height", second is max value. */
  const [width, height] = dataLines[0]!.trim().split(/\s+/).map(Number)

  /** Collect all pixel values into a flat array. */
  const pixelValues: number[] = []
  for (let i = 2; i < dataLines.length; i++) {
    const vals = dataLines[i]!.trim().split(/\s+/).map(Number)
    for (const v of vals) {
      pixelValues.push(v)
    }
  }

  const rows: { y: number; left: number; right: number; width: number }[] = []

  for (let y = 0; y < height; y++) {
    const rowStart = y * width
    let left = -1
    let right = -1

    for (let x = 0; x < width; x++) {
      const val = pixelValues[rowStart + x]
      if (val !== undefined && val > 128) {
        if (left === -1) left = x
        right = x
      }
    }

    if (left !== -1) {
      rows.push({ y, left, right, width: right - left + 1 })
    }
  }

  return { imageWidth: width, imageHeight: height, rows }
}

console.error('--- Measuring reference ---')
/** Per-row width profile of the reference silhouette. */
const refProfile = measureWidthProfile(`${TMP}/measure_ref_silhouette.png`)

console.error('--- Measuring composite ---')
/** Per-row width profile of the composite silhouette. */
const cmpProfile = measureWidthProfile(`${TMP}/measure_cmp_silhouette.png`)

/**
 * Finds the width at a given relative vertical position (0 = top, 1 = bottom).
 *
 * @param profile - width profile data
 *
 * @param relY - relative y position (0-1)
 *
 * @returns width in pixels at that position, or 0 if no data
 */
function widthAtRelY(
  profile: ReturnType<typeof measureWidthProfile>,
  relY: number,
): number {
  const targetY = Math.round(relY * profile.imageHeight)
  const row = profile.rows.find(function matchRow(r) {
    return r.y === targetY
  })
  return row?.width ?? 0
}

/**
 * Finds the maximum width within a relative y range.
 *
 * @param profile - width profile data
 *
 * @param relYStart - start of range (0-1)
 *
 * @param relYEnd - end of range (0-1)
 *
 * @returns maximum width in that range
 */
function maxWidthInRange(
  profile: ReturnType<typeof measureWidthProfile>,
  relYStart: number,
  relYEnd: number,
): { width: number; relY: number } {
  const yStart = Math.round(relYStart * profile.imageHeight)
  const yEnd = Math.round(relYEnd * profile.imageHeight)
  let maxW = 0
  let maxY = yStart

  for (const row of profile.rows) {
    if (row.y >= yStart && row.y <= yEnd && row.width > maxW) {
      maxW = row.width
      maxY = row.y
    }
  }

  return { width: maxW, relY: maxY / profile.imageHeight }
}

/**
 * Finds the minimum width within a relative y range.
 *
 * @param profile - width profile data
 *
 * @param relYStart - start of range (0-1)
 *
 * @param relYEnd - end of range (0-1)
 *
 * @returns minimum width in that range
 */
function minWidthInRange(
  profile: ReturnType<typeof measureWidthProfile>,
  relYStart: number,
  relYEnd: number,
): { width: number; relY: number } {
  const yStart = Math.round(relYStart * profile.imageHeight)
  const yEnd = Math.round(relYEnd * profile.imageHeight)
  let minW = Infinity
  let minY = yStart

  for (const row of profile.rows) {
    if (row.y >= yStart && row.y <= yEnd && row.width < minW) {
      minW = row.width
      minY = row.y
    }
  }

  return { width: minW === Infinity ? 0 : minW, relY: minY / profile.imageHeight }
}

/**
 * Finds the topmost and bottommost rows with content.
 *
 * @param profile - width profile data
 *
 * @returns top and bottom y positions (relative 0-1)
 */
function contentBounds(profile: ReturnType<typeof measureWidthProfile>): {
  top: number
  bottom: number
  totalHeight: number
} {
  if (profile.rows.length === 0) return { top: 0, bottom: 0, totalHeight: 0 }
  const top = profile.rows[0]!.y
  const bottom = profile.rows.at(-1)!.y
  return {
    top: top / profile.imageHeight,
    bottom: bottom / profile.imageHeight,
    totalHeight: bottom - top,
  }
}

console.error('--- Proportion Analysis ---')
console.error('')

/** Content bounds (top/bottom y, total height) of the reference silhouette. */
const refBounds = contentBounds(refProfile)
/** Content bounds (top/bottom y, total height) of the composite silhouette. */
const cmpBounds = contentBounds(cmpProfile)

console.error(`Image dimensions:  ref=${refProfile.imageWidth}x${refProfile.imageHeight}  cmp=${cmpProfile.imageWidth}x${cmpProfile.imageHeight}`)
console.error(`Content height:    ref=${refBounds.totalHeight}px  cmp=${cmpBounds.totalHeight}px`)
console.error('')

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
} as const

/** Single row in the proportion comparison table. */
type MeasurementRow = {
  /** Anatomical landmark name (e.g. `shoulders`, `waist`). */
  landmark: string
  /** Relative vertical position within body content (0 = top, 1 = bottom). */
  relY: number
  /** Pixel width of the reference silhouette at this landmark. */
  refWidth: number
  /** Pixel width of the composite silhouette at this landmark. */
  cmpWidth: number
  /** Composite-to-reference width ratio as a formatted string. */
  ratio: string
  /** Percentage difference from reference as a formatted string. */
  diff: string
}

/** Collected measurement rows for the proportion comparison table. */
const measurements: MeasurementRow[] = []

for (const [name, relY] of Object.entries(LANDMARKS)) {
  /** Map relative content position to absolute image position. */
  const refAbsY = refBounds.top + relY * (refBounds.bottom - refBounds.top)
  const cmpAbsY = cmpBounds.top + relY * (cmpBounds.bottom - cmpBounds.top)

  const refW = widthAtRelY(refProfile, refAbsY)
  const cmpW = widthAtRelY(cmpProfile, cmpAbsY)

  /** Normalize widths relative to content height for fair comparison. */
  const refNorm = refW / refBounds.totalHeight
  const cmpNorm = cmpW / cmpBounds.totalHeight

  const ratio = refNorm > 0 ? (cmpNorm / refNorm).toFixed(2) : 'N/A'
  const diffPct = refNorm > 0 ? (((cmpNorm - refNorm) / refNorm) * 100).toFixed(1) : 'N/A'

  measurements.push({
    landmark: name,
    relY,
    refWidth: refW,
    cmpWidth: cmpW,
    ratio,
    diff: `${diffPct}%`,
  })
}

/** Print measurement table. */
console.error('Landmark         relY   refW   cmpW   ratio  diff')
console.error('------------------------------------------------------')

for (const m of measurements) {
  const name = m.landmark.padEnd(16)
  const relY = m.relY.toFixed(2).padStart(5)
  const refW = String(m.refWidth).padStart(6)
  const cmpW = String(m.cmpWidth).padStart(6)
  const ratio = m.ratio.padStart(6)
  const diff = m.diff.padStart(7)
  console.error(`${name} ${relY} ${refW} ${cmpW} ${ratio} ${diff}`)
}

console.error('')

/**
 * Converts a relative content position to an absolute image y fraction.
 *
 * @param bounds - content bounds from contentBounds()
 *
 * @param relContent - relative position within content (0-1)
 *
 * @returns absolute y fraction (0-1) in image coordinates
 */
function contentToAbsY(
  bounds: ReturnType<typeof contentBounds>,
  relContent: number,
): number {
  const topFrac = bounds.top
  const bottomFrac = bounds.bottom
  return topFrac + relContent * (bottomFrac - topFrac)
}

/** Maximum width in the reference shoulder region (y 0.14-0.22). */
const shoulderRef = maxWidthInRange(refProfile, contentToAbsY(refBounds, 0.14), contentToAbsY(refBounds, 0.22))
/** Maximum width in the composite shoulder region (y 0.14-0.22). */
const shoulderCmp = maxWidthInRange(cmpProfile, contentToAbsY(cmpBounds, 0.14), contentToAbsY(cmpBounds, 0.22))

/** Minimum width in the reference waist region (y 0.25-0.35). */
const waistRef = minWidthInRange(refProfile, contentToAbsY(refBounds, 0.25), contentToAbsY(refBounds, 0.35))
/** Minimum width in the composite waist region (y 0.25-0.35). */
const waistCmp = minWidthInRange(cmpProfile, contentToAbsY(cmpBounds, 0.25), contentToAbsY(cmpBounds, 0.35))

/** Maximum width in the reference hip/skirt region (y 0.34-0.48). */
const hipRef = maxWidthInRange(refProfile, contentToAbsY(refBounds, 0.34), contentToAbsY(refBounds, 0.48))
/** Maximum width in the composite hip/skirt region (y 0.34-0.48). */
const hipCmp = maxWidthInRange(cmpProfile, contentToAbsY(cmpBounds, 0.34), contentToAbsY(cmpBounds, 0.48))

/** Maximum width in the reference head region (y 0-0.1). */
const headRef = maxWidthInRange(refProfile, contentToAbsY(refBounds, 0), contentToAbsY(refBounds, 0.1))
/** Maximum width in the composite head region (y 0-0.1). */
const headCmp = maxWidthInRange(cmpProfile, contentToAbsY(cmpBounds, 0), contentToAbsY(cmpBounds, 0.1))

/**
 * Formats a ratio safely, handling zero denominators.
 *
 * @param cmpVal - composite normalized value
 *
 * @param refVal - reference normalized value
 *
 * @returns formatted ratio string
 */
function fmtRatio(cmpVal: number, refVal: number): string {
  if (refVal === 0) return 'N/A'
  return (cmpVal / refVal).toFixed(2)
}

console.error('Key proportions (normalized to content height):')
/** Reference content height in pixels for normalizing widths. */
const refH = refBounds.totalHeight
/** Composite content height in pixels for normalizing widths. */
const cmpH = cmpBounds.totalHeight
console.error(`  Max head width:      ref=${(headRef.width / refH).toFixed(3)}  cmp=${(headCmp.width / cmpH).toFixed(3)}  ratio=${fmtRatio(headCmp.width / cmpH, headRef.width / refH)}`)
console.error(`  Max shoulder width:  ref=${(shoulderRef.width / refH).toFixed(3)}  cmp=${(shoulderCmp.width / cmpH).toFixed(3)}  ratio=${fmtRatio(shoulderCmp.width / cmpH, shoulderRef.width / refH)}`)
console.error(`  Min waist width:     ref=${(waistRef.width / refH).toFixed(3)}  cmp=${(waistCmp.width / cmpH).toFixed(3)}  ratio=${fmtRatio(waistCmp.width / cmpH, waistRef.width / refH)}`)
console.error(`  Max hip/skirt width: ref=${(hipRef.width / refH).toFixed(3)}  cmp=${(hipCmp.width / cmpH).toFixed(3)}  ratio=${fmtRatio(hipCmp.width / cmpH, hipRef.width / refH)}`)
console.error('')

/** Width profile CSV for external analysis. */
const csvLines = ['y_rel,ref_width_norm,cmp_width_norm']

for (let i = 0; i <= 100; i++) {
  const relY = i / 100
  const refAbsY = refBounds.top + relY * (refBounds.bottom - refBounds.top)
  const cmpAbsY = cmpBounds.top + relY * (cmpBounds.bottom - cmpBounds.top)

  const refW = widthAtRelY(refProfile, refAbsY) / refBounds.totalHeight
  const cmpW = widthAtRelY(cmpProfile, cmpAbsY) / cmpBounds.totalHeight

  csvLines.push(`${relY.toFixed(2)},${refW.toFixed(4)},${cmpW.toFixed(4)}`)
}

writeFileSync(`${TMP}/width_profile.csv`, csvLines.join('\n'))
console.error(`Width profile CSV: ${TMP}/width_profile.csv`)

/**
 * Width of the SVG width-profile chart in pixels.
 * Draws ref profile in blue and composite in red, plotted vertically
 * (y = body position top-to-bottom, x = width).
 */
const CHART_W = 600
/** Height of the SVG width-profile chart in pixels. */
const CHART_H = 800
/** Horizontal scale multiplier converting normalized widths to chart pixels. */
const SCALE_X = CHART_W * 2

/** SVG polyline coordinate pairs for the reference width profile. */
const refPoints: string[] = []
/** SVG polyline coordinate pairs for the composite width profile. */
const cmpPoints: string[] = []

for (let i = 0; i <= 100; i++) {
  const relY = i / 100
  const refAbsY = contentToAbsY(refBounds, relY)
  const cmpAbsY = contentToAbsY(cmpBounds, relY)

  const refW = widthAtRelY(refProfile, refAbsY) / refH
  const cmpW = widthAtRelY(cmpProfile, cmpAbsY) / cmpH

  const chartY = Math.round(relY * CHART_H)
  refPoints.push(`${Math.round(refW * SCALE_X)},${chartY}`)
  cmpPoints.push(`${Math.round(cmpW * SCALE_X)},${chartY}`)
}

/** Assembled SVG markup for the side-by-side width profile chart. */
const chartSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART_W} ${CHART_H}" width="${CHART_W}" height="${CHART_H}">
  <rect width="${CHART_W}" height="${CHART_H}" fill="white"/>
  <text x="10" y="20" font-size="14" fill="blue">Reference</text>
  <text x="10" y="38" font-size="14" fill="red">Composite</text>
  <polyline points="${refPoints.join(' ')}" fill="none" stroke="blue" stroke-width="2"/>
  <polyline points="${cmpPoints.join(' ')}" fill="none" stroke="red" stroke-width="2"/>
</svg>`

writeFileSync(`${TMP}/width_profile_chart.svg`, chartSvg)

/** Also render to PNG. */
try {
  run(`magick "${TMP}/width_profile_chart.svg" "${TMP}/width_profile_chart.png"`)
} catch {
  /* SVG is sufficient if PNG rendering fails. */
}

console.error(`Width profile chart: ${TMP}/width_profile_chart.svg  (blue=ref, red=composite)`)
console.error('')
console.error('Silhouettes saved to:')
console.error(`  ${TMP}/measure_ref_silhouette.png`)
console.error(`  ${TMP}/measure_cmp_silhouette.png`)
