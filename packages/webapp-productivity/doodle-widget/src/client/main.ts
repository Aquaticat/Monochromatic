/**
 * Entry point for the doodle widget client-side application.
 *
 * Queries DOM elements, delegates toolbar handler setup, configures
 * page switching, and initializes canvas resize handling.
 */

import { redraw, } from './drawing.ts';
import {
  initPages,
  switchToPage,
} from './pages.ts';
import { setupPointerHandlers, } from './pointer-handlers.ts';
import {
  discardActiveInput,
  setTextLayer,
} from './text.ts';
import { setupToolbarHandlers, } from './toolbar-handlers.ts';

/**
 * Queries a required DOM element by CSS selector.
 *
 * @param selector - CSS selector string
 *
 * @returns matched element, guaranteed non-null
 *
 * @throws Error if no element matches the selector
 *
 * @example
 * ```ts
 * const btn = requireElement<HTMLButtonElement>('#my-btn');
 * ```
 */
function requireElement<T extends Element,>(selector: string,): T {
  /** Query result, possibly null if selector has no match */
  const element = document.querySelector<T>(selector,);
  if (element === null)
    throw new Error(`Missing required element: ${selector}`,);
  return element;
}

//region DOM element references

/** Canvas container element */
const container = requireElement<HTMLDivElement>('#canvas-container',);

/** Drawing canvas element */
const canvas = requireElement<HTMLCanvasElement>('#draw-canvas',);

/** SVG overlay element for displaying SVG backgrounds */
const svgOverlay = requireElement<HTMLDivElement>('#svg-overlay',);

/** Draw tool radio input */
const drawRadio = requireElement<HTMLInputElement>('#tool-draw',);

/** Text label overlay layer */
const textLayer = requireElement<HTMLDivElement>('#text-layer',);

/** Tool selection toggle group */
const toolToggle = requireElement<HTMLDivElement>('#tool-toggle',);

/** Page selection toggle group */
const pageToggle = requireElement<HTMLDivElement>('#page-toggle',);

/** JSON script element holding page background SVGs */
const backgroundsScript = requireElement<HTMLScriptElement>('#page-backgrounds',);

//endregion DOM element references

/** Maybe-null canvas rendering context before validation */
const maybeCtx = canvas.getContext('2d',);
if (maybeCtx === null)
  throw new Error('Canvas 2D context unavailable',);

/** 2D rendering context for the drawing canvas */
const ctx: CanvasRenderingContext2D = maybeCtx;

/** Current canvas width in CSS pixels */
let canvasWidth = 0;

/** Current canvas height in CSS pixels */
let canvasHeight = 0;

/**
 * Reads the currently selected tool from the radio group.
 *
 * @returns `true` when draw mode is active, `false` for text mode
 */
function isDrawMode(): boolean {
  return drawRadio.checked;
}

/**
 * Returns current canvas dimensions in CSS pixels.
 *
 * @returns width and height as `cw` and `ch`
 */
function getCanvasSize(): { cw: number; ch: number; } {
  return { cw: canvasWidth, ch: canvasHeight, };
}

/**
 * Resizes the canvas to match its container and redraws all strokes.
 */
function sizeCanvas(): void {
  canvasWidth = container.clientWidth;
  canvasHeight = container.clientHeight;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  redraw({ ctx, cw: canvasWidth, ch: canvasHeight, },);
}

//region Tool mode switching

/**
 * Updates canvas cursor based on the selected tool radio.
 */
function syncCursorToTool(): void {
  if (isDrawMode()) {
    canvas.style.cursor = 'crosshair';
    discardActiveInput();
  }
  else {
    canvas.style.cursor = 'text';
  }
}

toolToggle.addEventListener('change', syncCursorToTool,);
syncCursorToTool();

//endregion Tool mode switching

//region Page switching

pageToggle.addEventListener('change', function handlePageChange(event: Event,): void {
  const { target, } = event;
  if (!(target instanceof HTMLInputElement))
    return;
  /** Zero-based page index from the radio value */
  const pageIndex = Number(target.value,);
  switchToPage({
    index: pageIndex, ctx,
    cw: canvasWidth, ch: canvasHeight,
    overlay: svgOverlay, textLayer,
  },);
},);

//endregion Page switching

//region Handler setup and initialization

setupPointerHandlers({ canvas, ctx, isDrawMode, getCanvasSize, },);

setupToolbarHandlers({
  colorPicker: requireElement<HTMLInputElement>('#color-picker',),
  sizeSlider: requireElement<HTMLInputElement>('#size-slider',),
  clearBtn: requireElement<HTMLButtonElement>('#clear-btn',),
  exportBtn: requireElement<HTMLButtonElement>('#export-btn',),
  formatSelect: requireElement<HTMLSelectElement>('#format-select',),
  uploadBtn: requireElement<HTMLButtonElement>('#upload-btn',),
  uploadInput: requireElement<HTMLInputElement>('#upload-input',),
  container, svgOverlay, drawCanvas: canvas, textLayer,
  ctx, getCanvasSize, sizeCanvas,
},);

/** Page background SVGs parsed from the embedded JSON script tag */
const parsed: unknown = JSON.parse(backgroundsScript.textContent,);
if (!Array.isArray(parsed,))
  throw new Error('Page backgrounds data is not an array',);
/** Validated array of page background SVG markup strings */
const backgrounds: readonly string[] = parsed;

initPages({ backgrounds, overlay: svgOverlay, },);
setTextLayer(textLayer,);
new ResizeObserver(sizeCanvas,).observe(container,);
sizeCanvas();

//endregion Handler setup and initialization
