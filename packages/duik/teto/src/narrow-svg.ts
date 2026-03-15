/**
 * SVG path and attribute transformations for horizontal narrowing.
 *
 * Parses SVG path data and element attributes, applies a horizontal
 * scale factor centered on a fixed x position to make the character
 * proportionally thinner.
 *
 * @module
 */

// oxlint-disable no-magic-numbers -- SVG transform logic with dimensional constants

/** Center x-coordinate for the character in the 800x1200 viewBox. */
const CENTER_X = 400

/**
 * Transforms an x-coordinate by scaling toward CENTER_X.
 *
 * @param x - original x-coordinate
 *
 * @param factor - scale factor (0.75 = narrow by 25%)
 *
 * @returns transformed x-coordinate, rounded to nearest integer
 */
function narrowX(x: number, factor: number): number {
  return Math.round(CENTER_X + (x - CENTER_X) * factor)
}

/**
 * Parses an SVG path `d` attribute and transforms all x-coordinates.
 *
 * Handles M, L, Q, C, Z, H commands and their implicit repeats.
 * Coordinates are assumed to be absolute (uppercase commands).
 *
 * @param d - the SVG path data string
 *
 * @param factor - horizontal narrowing factor
 *
 * @returns transformed path data string
 */
function transformPathD(d: string, factor: number): string {
  /**
   * Tokenize: split into commands and numbers.
   * Commands: M, L, Q, C, Z, H, V, A, S, T (uppercase only since our SVGs use absolute coords).
   */
  const tokens = d.match(/[MLQCZHVASTmlqczhvast]|[-+]?[\d]*\.?\d+/g)
  if (tokens === null) return d

  const result: string[] = []
  let cmd = ''
  let paramIndex = 0

  /**
   * Number of coordinate pairs per command.
   * M/L: 1 pair (x,y)
   * Q: 2 pairs (cx,cy, ex,ey)
   * C: 3 pairs (cx1,cy1, cx2,cy2, ex,ey)
   * H: 1 value (x)
   * V: 1 value (y)
   * Z: 0
   */
  for (const token of tokens) {
    if (/^[MLQCZHVASTmlqczhvast]$/.test(token)) {
      cmd = token
      paramIndex = 0
      result.push(token)
      continue
    }

    const num = Number.parseFloat(token)
    const upperCmd = cmd.toUpperCase()

    if (upperCmd === 'Z') {
      result.push(token)
      continue
    }

    if (upperCmd === 'H') {
      /** H takes a single x value. */
      result.push(String(narrowX(num, factor)))
      paramIndex++
      continue
    }

    if (upperCmd === 'V') {
      /** V takes a single y value -- don't transform. */
      result.push(token)
      paramIndex++
      continue
    }

    if (upperCmd === 'A') {
      /**
       * A has 7 params: rx ry x-rotation large-arc sweep x y
       * Only transform params at index 5 (x) and leave 6 (y) alone.
       * Params 0-4 are arc parameters.
       */
      const arcIndex = paramIndex % 7
      if (arcIndex === 5) {
        result.push(String(narrowX(num, factor)))
      } else {
        result.push(token)
      }
      paramIndex++
      continue
    }

    /**
     * For M, L, Q, C, S, T commands:
     * even paramIndex = x, odd paramIndex = y.
     */
    if (paramIndex % 2 === 0) {
      result.push(String(narrowX(num, factor)))
    } else {
      result.push(token)
    }
    paramIndex++
  }

  return result.join(' ')
}

/**
 * Transforms all coordinates in an SVG file by narrowing x toward center.
 *
 * Handles:
 * - `d="..."` path data attributes
 * - `x1`, `x2`, `cx`, `x` attributes on elements
 * - Preserves `y1`, `y2`, `cy`, `y`, `r`, `rx`, `ry`, width/height
 *
 * @param svgContent - the raw SVG file content
 *
 * @param factor - horizontal narrowing factor
 *
 * @returns transformed SVG content
 */
export function transformSvg(svgContent: string, factor: number): string {
  let result = svgContent

  /** Transform path d attributes. */
  result = result.replaceAll(/\bd="([^"]+)"/g, function transformD(_match, d: string) {
    return `d="${transformPathD(d, factor)}"`
  })

  /** Transform x1 attributes (line elements). */
  result = result.replaceAll(/\bx1="([-\d.]+)"/g, function transformX1(_match, v: string) {
    return `x1="${narrowX(Number.parseFloat(v), factor)}"`
  })

  /** Transform x2 attributes. */
  result = result.replaceAll(/\bx2="([-\d.]+)"/g, function transformX2(_match, v: string) {
    return `x2="${narrowX(Number.parseFloat(v), factor)}"`
  })

  /** Transform cx attributes (circle elements). */
  result = result.replaceAll(/\bcx="([-\d.]+)"/g, function transformCx(_match, v: string) {
    return `cx="${narrowX(Number.parseFloat(v), factor)}"`
  })

  /**
   * Transform x attributes on non-gradient elements.
   * Skip gradient stop x1/x2 and viewBox.
   * Match `x="..."` but not `x1=` or `x2=` (already handled).
   */
  result = result.replaceAll(/\bx="([-\d.]+)"/g, function transformX(_match, v: string) {
    return `x="${narrowX(Number.parseFloat(v), factor)}"`
  })

  return result
}
