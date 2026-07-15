/**
 * Figma color to Penpot fill/color conversion.
 *
 * Figma stores colors as `{ r, g, b, a }` 0-1 floats; Penpot uses `"#RRGGBB"`
 * hex strings with separate 0-1 opacity.
 *
 * @module figma-to-penpot-color
 */

import {
  type FigmaRecord,
  numberOr,
} from './read.ts';
import type { PenpotFill, } from './types.ts';
import { toHexPadded, } from './uuid.ts';

/**
 * Maximum value of an 8-bit color channel; Figma 0-1 floats scale by this.
 */
const CHANNEL_MAX = 255;

/**
 * Width, in hex digits, of one encoded color channel.
 */
const CHANNEL_HEX_WIDTH = 2;

/**
 * Scale one Figma 0-1 channel float to a 0-255 integer.
 *
 * @param value - raw channel value of unknown type
 *
 * @returns rounded 0-255 channel byte, 0 when value is not numeric
 *
 * @example
 * ```ts
 * channelByte(1); // 255
 * ```
 */
function channelByte(value: unknown,): number {
  return Math.round(numberOr({
    value,
    fallback: 0,
  },) * CHANNEL_MAX,);
}

/**
 * Convert a Figma color struct `{ r, g, b }` (0-1 floats) to a hex string.
 *
 * @param color - Figma color {@link FigmaRecord} with numeric `r`/`g`/`b` channels
 *
 * @returns uppercase `"#RRGGBB"` string
 *
 * @example
 * ```ts
 * figmaColorToHex({ r: 1, g: 0, b: 0, }); // "#FF0000"
 * ```
 */
export function figmaColorToHex(color: FigmaRecord,): string {
  /**
   * Red channel as a 0-255 integer ready for hex encoding.
   */
  const r = channelByte(color.r,);
  /**
   * Green channel as a 0-255 integer ready for hex encoding.
   */
  const g = channelByte(color.g,);
  /**
   * Blue channel as a 0-255 integer ready for hex encoding.
   */
  const b = channelByte(color.b,);
  return `#${
    toHexPadded({
      value: r,
      width: CHANNEL_HEX_WIDTH,
    },)
  }${
    toHexPadded({
      value: g,
      width: CHANNEL_HEX_WIDTH,
    },)
  }${
    toHexPadded({
      value: b,
      width: CHANNEL_HEX_WIDTH,
    },)
  }`
    .toUpperCase();
}

/**
 * Convert a Figma color struct with alpha to a Penpot fill.
 *
 * Penpot separates color and opacity: `fillColor` is hex, `fillOpacity` is 0-1.
 *
 * @param color - Figma color {@link FigmaRecord} with `r`/`g`/`b` and optional `a`
 *
 * @returns Penpot fill with hex color and 0-1 opacity
 *
 * @example
 * ```ts
 * figmaColorToFill({ r: 0, g: 0, b: 0, a: 0.5, });
 * ```
 */
export function figmaColorToFill(color: FigmaRecord,): PenpotFill {
  return {
    fillColor: figmaColorToHex(color,),
    fillOpacity: numberOr({
      value: color.a,
      fallback: 1,
    },),
  };
}
