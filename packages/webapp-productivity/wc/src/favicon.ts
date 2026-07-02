/**
 * Build-time favicon generator: rasterizes a `w<` wordmark from first
 * principles (no font, no canvas) into a truecolor PNG, inlined by
 * `./build.ts` as a data URI.
 *
 * Geometry decree: every stick shares one length and one width; the
 * w's four sticks tilt so every turn closes at 30 degrees, and the
 * chevron's two sticks close at 60 degrees. Ink is `oklch(0.9 0 0)` on
 * an `oklch(0.1 0 0)` ground, matching the page's dark palette stops.
 */
import { encodePngRgb, } from './favicon-png.ts';

/**
 * Favicon edge length in pixels, exported so tests can assert the
 * encoded IHDR dimensions.
 */
export const FAVICON_SIZE: number = 64;

/**
 * Shared stick length in pixels; every stroke of both glyphs uses it.
 */
const STICK_LENGTH = 24;

/**
 * Half the shared stick width in pixels (a sample within this distance
 * of a stick's spine is ink).
 */
const STICK_HALF_WIDTH = 2.2;

/**
 * Stick count of the w glyph (down, up, down, up).
 */
const W_STICK_COUNT = 2 * 2;

/**
 * Quarter turn in radians, the base the glyph angles derive from.
 */
const QUARTER_TURN_RAD = Math.PI / 2;

/**
 * The w's tilt off vertical in radians: 15 degrees, so two adjacent
 * sticks close each turn at 30 degrees.
 */
const W_TILT_RAD = QUARTER_TURN_RAD / ((2 * 2) + 2);

/**
 * The chevron's half-angle off horizontal in radians: 30 degrees, so
 * its two sticks close at 60 degrees.
 */
const CHEVRON_HALF_RAD = QUARTER_TURN_RAD / (2 + 1);

/**
 * Gap between the two glyphs, as a fraction of {@link STICK_LENGTH}.
 */
const GLYPH_GAP_RATIO = 0.1 * ((2 + 1) + (1 / 2));

/**
 * Ink lightness: the palette's near-white stop, `oklch(0.9 0 0)`.
 */
const INK_LIGHTNESS = 1 - 0.1;

/**
 * Ground lightness: the palette's near-black stop, `oklch(0.1 0 0)`.
 */
const GROUND_LIGHTNESS = 0.1;

/**
 * Luminance below which sRGB's transfer function stays linear.
 */
const SRGB_LINEAR_THRESHOLD = 0.0031308;

/**
 * Slope of sRGB's linear segment.
 */
const SRGB_LINEAR_SLOPE = 12.92;

/**
 * Scale of sRGB's gamma segment.
 */
const SRGB_GAMMA_SCALE = 1.055;

/**
 * Offset of sRGB's gamma segment.
 */
const SRGB_GAMMA_OFFSET = 0.055;

/**
 * Exponent denominator of sRGB's gamma segment.
 */
const SRGB_GAMMA = 2.4;

/**
 * Supersamples per pixel axis; each pixel averages this squared many
 * coverage samples for antialiased stick edges.
 */
const SUBSAMPLES = 2 * 2;

/**
 * One line segment: a stick's spine from `(ax, ay)` to `(bx, by)`.
 */
type Segment = Readonly<{
  /**
   * Spine start x.
   */
  ax: number;
  /**
   * Spine start y.
   */
  ay: number;
  /**
   * Spine end x.
   */
  bx: number;
  /**
   * Spine end y.
   */
  by: number;
}>;

/**
 * Converts an achromatic OKLCH lightness to an 8-bit sRGB channel
 * value. For grays, OKLab lightness is the cube root of CIE luminance
 * Y, so Y is recovered as lightness cubed, then pushed through sRGB's
 * piecewise transfer function.
 *
 * @param lightness - OKLCH lightness in 0 to 1
 *
 * @returns sRGB channel byte in 0 to 255
 *
 * @example
 * ```ts
 * achromaticLightnessToSrgbByte(1); // 255
 * ```
 */
function achromaticLightnessToSrgbByte(lightness: number,): number {
  /**
   * CIE luminance Y recovered from the achromatic OKLab lightness.
   */
  const luminance = lightness ** (2 + 1);

  /**
   * Nonlinear sRGB channel value in 0 to 1, via the piecewise sRGB
   * transfer function.
   */
  const channel = luminance <= SRGB_LINEAR_THRESHOLD
    ? luminance * SRGB_LINEAR_SLOPE
    : (SRGB_GAMMA_SCALE * (luminance ** (1 / SRGB_GAMMA))) - SRGB_GAMMA_OFFSET;

  return Math.round(channel * 255,);
}

/**
 * Builds the spines of all six sticks: the w's four alternating
 * down/up strokes, then the chevron's two strokes meeting at a left
 * apex, horizontally centered as one group and vertically centered on
 * the icon.
 *
 * @returns stick spines in drawing order
 */
function buildGlyphSegments(): readonly Segment[] {
  /**
   * Horizontal run of one w stick.
   */
  const wStickDx = STICK_LENGTH * Math.sin(W_TILT_RAD,);

  /**
   * Vertical run of one w stick.
   */
  const wStickDy = STICK_LENGTH * Math.cos(W_TILT_RAD,);

  /**
   * Horizontal run of one chevron stick.
   */
  const chevronDx = STICK_LENGTH * Math.cos(CHEVRON_HALF_RAD,);

  /**
   * Vertical run of one chevron stick.
   */
  const chevronDy = STICK_LENGTH * Math.sin(CHEVRON_HALF_RAD,);

  /**
   * Full inline extent of the w glyph.
   */
  const wWidth = wStickDx * W_STICK_COUNT;

  /**
   * Gap between the w and the chevron in pixels.
   */
  const glyphGap = STICK_LENGTH * GLYPH_GAP_RATIO;

  /**
   * Inline extent of both glyphs plus the gap between them.
   */
  const contentWidth = (wWidth + glyphGap) + chevronDx;

  /**
   * Left edge of the w, centering the whole wordmark horizontally.
   */
  const startX = (FAVICON_SIZE - contentWidth) / 2;

  /**
   * Vertical center both glyphs align on.
   */
  const centerY = FAVICON_SIZE / 2;

  /**
   * Top y of the w's peaks.
   */
  const wTop = centerY - (wStickDy / 2);

  /**
   * Bottom y of the w's valleys.
   */
  const wBottom = centerY + (wStickDy / 2);

  /**
   * The w's four sticks: vertices alternate top, bottom, top, bottom,
   * top from left to right.
   */
  const wSegments = Array.from(
    { length: W_STICK_COUNT, },
    function wStick(
      _unused,
      index,
    ): Segment {
      /**
       * Whether this stick starts at a peak (even index) or a valley.
       */
      const startsAtTop = (index % 2) === 0;

      return {
        ax: startX + (wStickDx * index),
        ay: startsAtTop ? wTop : wBottom,
        bx: startX + (wStickDx * (index + 1)),
        by: startsAtTop ? wBottom : wTop,
      };
    },
  );

  /**
   * X of the chevron's left-pointing apex.
   */
  const apexX = (startX + wWidth) + glyphGap;

  return [
    ...wSegments,
    {
      ax: apexX,
      ay: centerY,
      bx: apexX + chevronDx,
      by: centerY - chevronDy,
    },
    {
      ax: apexX,
      ay: centerY,
      bx: apexX + chevronDx,
      by: centerY + chevronDy,
    },
  ];
}

/**
 * Distance from a point to the nearest point on a segment's spine,
 * clamping the projection to the segment so stick ends get round caps.
 *
 * @param x - sample x
 *
 * @param y - sample y
 *
 * @param segment - stick spine measured against
 *
 * @returns distance in pixels
 */
function distanceToSegment(
  {
    x,
    y,
    segment,
  }: Readonly<{
    x: number;
    y: number;
    segment: Segment;
  }>,
): number {
  /**
   * Spine run along x.
   */
  const dx = segment.bx - segment.ax;

  /**
   * Spine run along y.
   */
  const dy = segment.by - segment.ay;

  /**
   * Unclamped projection parameter of the sample onto the spine.
   */
  const projected = (((x - segment.ax) * dx) + ((y - segment.ay) * dy))
    / ((dx * dx) + (dy * dy));

  /**
   * Projection clamped into the segment.
   */
  const t = Math.min(
    1,
    Math.max(
      0,
      projected,
    ),
  );

  return Math.hypot(
    x - (segment.ax + (t * dx)),
    y - (segment.ay + (t * dy)),
  );
}

/**
 * Reports whether one supersample lands on ink: within
 * {@link STICK_HALF_WIDTH} of any stick spine.
 *
 * @param x - sample x
 *
 * @param y - sample y
 *
 * @param segments - stick spines to test against
 *
 * @returns true when the sample is ink
 */
function sampleIsInk(
  {
    x,
    y,
    segments,
  }: Readonly<{
    x: number;
    y: number;
    segments: readonly Segment[];
  }>,
): boolean {
  return segments.some(function withinStick(segment,): boolean {
    return distanceToSegment(
      {
        x,
        y,
        segment,
      },
    ) <= STICK_HALF_WIDTH;
  },);
}

/**
 * Rasterizes the wordmark into packed RGB bytes: per pixel, the ink
 * coverage over a {@link SUBSAMPLES}-squared grid blends the ink and
 * ground grays.
 *
 * @param segments - stick spines to draw
 *
 * @returns `FAVICON_SIZE * FAVICON_SIZE * 3` packed RGB bytes
 */
function rasterize(
  { segments, }: Readonly<{ segments: readonly Segment[]; }>,
): Uint8Array {
  /**
   * Ink gray byte, from the near-white palette stop.
   */
  const inkByte = achromaticLightnessToSrgbByte(INK_LIGHTNESS,);

  /**
   * Ground gray byte, from the near-black palette stop.
   */
  const groundByte = achromaticLightnessToSrgbByte(GROUND_LIGHTNESS,);

  /**
   * Channels per packed RGB pixel.
   */
  const channels = 2 + 1;

  /**
   * Pixel count of the square icon.
   */
  const pixelCount = FAVICON_SIZE * FAVICON_SIZE;

  /**
   * Packed RGB output, rows top to bottom.
   */
  const pixels = new Uint8Array(pixelCount * channels,);

  /**
   * Total supersamples averaged per pixel.
   */
  const samplesPerPixel = SUBSAMPLES * SUBSAMPLES;

  for (let pixelY = 0; pixelY < FAVICON_SIZE; pixelY += 1) {
    for (let pixelX = 0; pixelX < FAVICON_SIZE; pixelX += 1) {
      /**
       * Ink hits among this pixel's supersamples.
       */
      let inkHits = 0;

      for (let subY = 0; subY < SUBSAMPLES; subY += 1) {
        for (let subX = 0; subX < SUBSAMPLES; subX += 1) {
          if (
            sampleIsInk(
              {
                x: pixelX + ((subX + (1 / 2)) / SUBSAMPLES),
                y: pixelY + ((subY + (1 / 2)) / SUBSAMPLES),
                segments,
              },
            )
          ) {
            inkHits += 1;
          }
        }
      }

      /**
       * Gray byte blended by ink coverage.
       */
      const gray = Math.round(
        groundByte + ((inkByte - groundByte) * (inkHits / samplesPerPixel)),
      );

      /**
       * Offset of this pixel's R byte inside pixels.
       */
      const offset = ((pixelY * FAVICON_SIZE) + pixelX) * channels;

      pixels[offset] = gray;
      pixels[offset + 1] = gray;
      pixels[offset + 2] = gray;
    }
  }

  return pixels;
}

/**
 * Renders the complete favicon PNG, base64-encoded for inlining as a
 * data URI.
 *
 * @returns base64 PNG bytes
 *
 * @example
 * ```ts
 * const href = `data:image/png;base64,${await renderFaviconPngBase64()}`;
 * ```
 */
export async function renderFaviconPngBase64(): Promise<string> {
  /**
   * Complete favicon PNG bytes.
   */
  const png = await encodePngRgb(
    {
      width: FAVICON_SIZE,
      height: FAVICON_SIZE,
      pixels: rasterize({ segments: buildGlyphSegments(), },),
    },
  );

  return png.toString('base64',);
}
