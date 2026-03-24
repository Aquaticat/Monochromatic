/**
 * Multi-page state management for the doodle widget.
 *
 * Each page stores its own strokes, text entries, and SVG background.
 * Switching pages saves the current page state and restores the target.
 */

import {
  endStroke,
  getStrokes,
  redraw,
  setStrokes,
  type StrokeData,
} from './drawing.ts';
import {
  restoreTextEntries,
  serializeTextEntries,
  type TextEntryData,
} from './text-page.ts';
import {
  clearTextEntries,
  finalizeActiveInput,
} from './text.ts';

/**
 * Saved state for a single page.
 *
 * @example
 * ```ts
 * const page: PageState = {
 *   strokes: [],
 *   textEntries: [],
 *   svgBackground: '<svg>...</svg>',
 * };
 * ```
 */
export type PageState = {
  /** Drawing strokes on this page */
  strokes: StrokeData[];
  /** Serialized text input entries */
  textEntries: TextEntryData[];
  /** SVG overlay innerHTML for this page's background */
  svgBackground: string;
};

/** All page states indexed by page number */
let pages: PageState[] = [];

/** Zero-based index of the currently active page */
let currentIndex = 0;

/**
 * Initializes page states from default SVG backgrounds.
 *
 * Sets the first page as active and renders its background
 * in the SVG overlay.
 *
 * @param backgrounds - processed SVG markup strings, one per page
 *
 * @param overlay - SVG overlay element to set initial background
 */
export function initPages({ backgrounds, overlay, }: {
  backgrounds: readonly string[];
  overlay: HTMLElement;
},): void {
  pages = backgrounds.map(function createPage(svg,): PageState {
    return { strokes: [], textEntries: [], svgBackground: svg, };
  },);
  currentIndex = 0;
  /** First page state for initial background rendering */
  const [firstPage,] = pages;
  if (firstPage === undefined)
    throw new Error('No page backgrounds provided',);
  overlay.innerHTML = firstPage.svgBackground;
}

/**
 * Returns the zero-based index of the active page.
 *
 * @returns current page index
 */
export function getCurrentPageIndex(): number {
  return currentIndex;
}

/**
 * Switches to a different page, saving current state and restoring target.
 *
 * Finalizes any in-progress stroke or text input before saving.
 * No-op if the target index matches the current page or is out of range.
 *
 * @param index - target page index (zero-based)
 *
 * @param ctx - canvas rendering context for redraw
 *
 * @param cw - current canvas width in CSS pixels
 *
 * @param ch - current canvas height in CSS pixels
 *
 * @param overlay - SVG overlay element
 *
 * @param textLayer - text layer element
 */
export function switchToPage({ index, ctx, cw, ch, overlay, textLayer, }: {
  index: number;
  ctx: CanvasRenderingContext2D;
  cw: number;
  ch: number;
  overlay: HTMLElement;
  textLayer: HTMLDivElement;
},): void {
  if (index === currentIndex)
    return;
  if (index < 0 || index >= pages.length)
    return;
  endStroke();

  //region Save current page
  const currentPage = pages[currentIndex];
  if (currentPage === undefined)
    throw new Error(`Page state missing for current index ${String(currentIndex,)}`,);
  finalizeActiveInput();
  currentPage.strokes = [...getStrokes(),];
  currentPage.textEntries = serializeTextEntries(textLayer,);
  currentPage.svgBackground = overlay.innerHTML;
  //endregion Save current page

  //region Restore target page
  const targetPage = pages[index];
  if (targetPage === undefined)
    throw new Error(`Page state missing for target index ${String(index,)}`,);
  setStrokes(targetPage.strokes,);
  clearTextEntries();
  restoreTextEntries({ entries: targetPage.textEntries, layer: textLayer, },);
  overlay.innerHTML = targetPage.svgBackground;
  currentIndex = index;
  //endregion Restore target page

  redraw({ ctx, cw, ch, },);
}

/**
 * Snapshots all page states, saving the current page's live state first.
 *
 * The current page's strokes, text entries, and SVG background are read
 * from their respective live sources (drawing module, text layer DOM,
 * SVG overlay DOM) and persisted into the pages array before returning.
 *
 * @param overlay - SVG overlay element for reading current background
 *
 * @param textLayer - text layer element for serializing current text entries
 *
 * @returns shallow copy of all page states
 *
 * @example
 * ```ts
 * const allPages = snapshotAllPages({ overlay, textLayer });
 * for (const page of allPages) {
 *   console.log(page.strokes.length, page.textEntries.length);
 * }
 * ```
 */
export function snapshotAllPages({ overlay, textLayer, }: {
  overlay: HTMLElement;
  textLayer: HTMLDivElement;
},): readonly PageState[] {
  endStroke();
  /** Current page state to save live data into */
  const currentPage = pages[currentIndex];
  if (currentPage !== undefined) {
    finalizeActiveInput();
    currentPage.strokes = [...getStrokes(),];
    currentPage.textEntries = serializeTextEntries(textLayer,);
    currentPage.svgBackground = overlay.innerHTML;
  }
  return [...pages,];
}
