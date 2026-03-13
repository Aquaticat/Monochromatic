/**
 * Text entry state and rendering for the doodle widget.
 *
 * Manages text labels placed at normalized [0..1] coordinates so they
 * persist through canvas resizes, matching the stroke normalization
 * strategy in drawing.ts.
 */

import type { NormalizedPoint } from './drawing.ts';

//region Types

/**
 * Text label placed at a normalized canvas position.
 *
 * @example
 * ```ts
 * const entry: TextEntry = { position: [0.5, 0.5], content: 'Hello' };
 * ```
 */
export type TextEntry = {
  /** Normalized [x, y] position where the text anchor sits */
  readonly position: NormalizedPoint;
  /** User-supplied text content */
  readonly content: string;
};

//endregion Types

//region Constants

/** Text fill color in OKLCH color space, matching stroke color */
const TEXT_COLOR = 'oklch(0.3 0 0)';

/**
 * Base font size in CSS pixels at a reference canvas height of 800px.
 *
 * Actual rendered size scales linearly with canvas height.
 */
const BASE_FONT_SIZE = 20;

/** Reference canvas height used for font size scaling */
const REFERENCE_HEIGHT = 800;

/** Font family stack for rendered text */
const FONT_FAMILY = 'system-ui, sans-serif';

//endregion Constants

//region State

/** All committed text entries */
let entries: TextEntry[] = [];

//endregion State

/**
 * Commits a new text entry at the given position.
 *
 * @param position - normalized [0..1] coordinate for text placement
 *
 * @param content - text string to display
 */
export function addTextEntry({ position, content }: {
  position: NormalizedPoint;
  content: string;
}): void {
  entries.push({ position, content });
}

/**
 * Removes all stored text entries.
 */
export function clearTextEntries(): void {
  entries = [];
}

/**
 * Returns a defensive copy of all text entries.
 *
 * @returns array of committed text entries
 */
export function getTextEntries(): readonly TextEntry[] {
  return entries;
}

/**
 * Renders all text entries onto the canvas at denormalized positions.
 *
 * Font size scales proportionally with canvas height so text maintains
 * visual consistency across resizes.
 *
 * @param ctx - canvas 2D rendering context
 *
 * @param cw - current canvas width in CSS pixels
 *
 * @param ch - current canvas height in CSS pixels
 */
export function redrawTexts({ ctx, cw, ch }: {
  ctx: CanvasRenderingContext2D;
  cw: number;
  ch: number;
}): void {
  if (entries.length === 0) {
    return;
  }

  /** Scaled font size based on current canvas height */
  const fontSize = Math.round(BASE_FONT_SIZE * (ch / REFERENCE_HEIGHT));

  ctx.save();
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = `${String(fontSize)}px ${FONT_FAMILY}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'start';

  for (const entry of entries) {
    ctx.fillText(entry.content, entry.position[0] * cw, entry.position[1] * ch);
  }

  ctx.restore();
}
