/**
 * Procedural equirect environment painter.
 *
 * Everything the glass reflects comes from this canvas: a dark night
 * base, a hot ceiling light band, vertical accent bars, and a floor
 * glow, matching the corridor's visible emissive geometry.
 */

/**
 * Environment canvas layout: every stop, band, and bar the painter draws.
 * Data instead of inline literals so each number has a name and a place.
 */
const ENV_PAINT = {
  /**
   * Equirect canvas width in pixels; 2:1 aspect as the mapping expects.
   */
  width: 1_024,
  /**
   * Equirect canvas height in pixels.
   */
  height: 512,
  /**
   * Night-gradient stops from ceiling zenith to floor nadir.
   */
  baseStops: [
    {
      at: 0,
      color: '#0d1b2e',
    },
    {
      at: 0.42,
      color: '#060d1a',
    },
    {
      at: 0.6,
      color: '#03060d',
    },
    {
      at: 1,
      color: '#01030a',
    },
  ],
  /**
   * Ceiling light band near the zenith, drawn hot so tone mapping keeps a
   * specular sparkle.
   */
  band: {
    /**
     * Band top edge in pixels.
     */
    top: 30,
    /**
     * Band height in pixels.
     */
    height: 90,
    /**
     * Gradient stops across the band.
     */
    stops: [
      {
        at: 0,
        color: 'rgba(210, 240, 255, 0.95)',
      },
      {
        at: 0.5,
        color: 'rgba(150, 210, 250, 0.55)',
      },
      {
        at: 1,
        color: 'rgba(90, 150, 220, 0)',
      },
    ],
  },
  /**
   * Vertical wall accent bars that give panes streaky highlights.
   */
  bars: {
    /**
     * Bar count around the equirect seam.
     */
    count: 14,
    /**
     * Base spacing between bar centers in pixels.
     */
    stride: 79,
    /**
     * Extra offset per hue cycle so spacing looks irregular.
     */
    wobble: 31,
    /**
     * Bars per hue cycle.
     */
    hueCycle: 3,
    /**
     * Half width of each bar's glow in pixels.
     */
    halfWidth: 9,
    /**
     * Bar top edge in pixels.
     */
    top: 150,
    /**
     * Bar height in pixels.
     */
    height: 210,
    /**
     * Gradient stop where the bar core peaks.
     */
    coreStop: 0.5,
    /**
     * Core alpha appended to the hue prefix.
     */
    coreAlpha: '0.75',
  },
  /**
   * Floor glow pool near the nadir standing in for floor sheen.
   */
  pool: {
    /**
     * Pool top edge in pixels.
     */
    top: 380,
    /**
     * Gradient stops down to the nadir.
     */
    stops: [
      {
        at: 0,
        color: 'rgba(40, 80, 130, 0)',
      },
      {
        at: 1,
        color: 'rgba(50, 95, 150, 0.4)',
      },
    ],
  },
} as const;

/**
 * Paints the procedural equirect environment: dark night base, a bright
 * ceiling light band, vertical accent bars along the walls, and a floor
 * glow. Everything the glass reflects comes from here.
 *
 * @returns canvas holding the equirect environment image
 *
 * @throws Error when the 2d canvas context is unavailable
 *
 * @example
 * ```ts
 * const canvas = paintEnvironmentCanvas();
 * ```
 */
export function paintEnvironmentCanvas(): HTMLCanvasElement {
  /**
   * Equirect canvas sized from the paint spec.
   */
  const canvas = document.createElement('canvas',);
  canvas.width = ENV_PAINT.width;
  canvas.height = ENV_PAINT.height;
  /**
   * 2d context the environment paints through.
   */
  const context = canvas.getContext('2d',);
  if (context === null)
    throw new Error('2d canvas context unavailable for environment texture',);
  //region Base: night gradient, darkest at the floor pole
  /**
   * Vertical gradient from ceiling zenith to floor nadir.
   */
  const base = context.createLinearGradient(
    0,
    0,
    0,
    canvas.height,
  );
  for (const stop of ENV_PAINT.baseStops)
    base.addColorStop(
      stop.at,
      stop.color,
    );
  context.fillStyle = base;
  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height,
  );
  //endregion
  //region Ceiling band: the main light source streaking across glass
  /**
   * Horizontal band gradient near the zenith.
   */
  const band = context.createLinearGradient(
    0,
    ENV_PAINT.band
      .top,
    0,
    ENV_PAINT.band
      .top
      + ENV_PAINT.band
      .height,
  );
  for (const stop of ENV_PAINT.band
    .stops)
    band.addColorStop(
      stop.at,
      stop.color,
    );
  context.fillStyle = band;
  context.fillRect(
    0,
    ENV_PAINT.band
      .top,
    canvas.width,
    ENV_PAINT.band
      .height,
  );
  //endregion
  //region Wall bars: vertical accents that give panes streaky highlights
  for (let bar = 0; bar
    < ENV_PAINT.bars
    .count; bar++) {
    /**
     * Bar center x; irregular spacing avoids a repeating-machine look.
     */
    const x = ((bar
      * ENV_PAINT.bars
      .stride)
      + ((bar
        % ENV_PAINT.bars
        .hueCycle)
        * ENV_PAINT.bars
        .wobble)) % canvas.width;
    /**
     * Alternating cool hues matching the corridor accent lights.
     */
    const hue = (bar
      % ENV_PAINT.bars
      .hueCycle) === 0
      ? 'rgba(190, 235, 255, '
      : (bar
        % ENV_PAINT.bars
        .hueCycle) === 1
      ? 'rgba(120, 170, 255, '
      : 'rgba(150, 120, 255, ';
    /**
     * Horizontal gradient giving each bar a soft core.
     */
    const glow = context.createLinearGradient(
      x
        - ENV_PAINT.bars
        .halfWidth,
      0,
      x
        + ENV_PAINT.bars
        .halfWidth,
      0,
    );
    glow.addColorStop(
      0,
      `${hue}0)`,
    );
    glow.addColorStop(
      ENV_PAINT.bars
        .coreStop,
      `${hue}${ENV_PAINT.bars
        .coreAlpha})`,
    );
    glow.addColorStop(
      1,
      `${hue}0)`,
    );
    context.fillStyle = glow;
    context.fillRect(
      x
        - ENV_PAINT.bars
        .halfWidth,
      ENV_PAINT.bars
        .top,
      ENV_PAINT.bars
        .halfWidth
        * 2,
      ENV_PAINT.bars
        .height,
    );
  }
  //endregion
  //region Floor glow: faint bounce light so downward reflections read
  /**
   * Soft pool gradient near the nadir.
   */
  const pool = context.createLinearGradient(
    0,
    ENV_PAINT.pool
      .top,
    0,
    canvas.height,
  );
  for (const stop of ENV_PAINT.pool
    .stops)
    pool.addColorStop(
      stop.at,
      stop.color,
    );
  context.fillStyle = pool;
  context.fillRect(
    0,
    ENV_PAINT.pool
      .top,
    canvas.width,
    canvas.height
      - ENV_PAINT.pool
      .top,
  );
  //endregion
  return canvas;
}
