/**
 * Entry point for the doodle widget client-side application.
 *
 * Imports DOM references, delegates handler setup, configures
 * page switching, and initializes canvas resize handling.
 */

import {
  backgroundsScript, canvas, container, drawRadio, eraseRadio,
  pageToggle, redoBtn, requireElement, svgOverlay, textLayer,
  toolToggle, undoBtn,
} from './dom-refs.ts';
import { redraw, } from './drawing.ts';
import {
  initPages,
  switchToPage,
} from './pages.ts';
import {
  type ToolMode,
  setupPointerHandlers,
} from './pointer-handlers.ts';
import {
  discardActiveInput,
  setTextLayer,
} from './text.ts';
import { setupToolbarHandlers, } from './toolbar-handlers.ts';
import { initHistory, } from './undo-history.ts';
import { setupUndoHandlers, } from './undo-handlers.ts';

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
 * @returns active tool mode based on which radio is checked
 */
function getToolMode(): ToolMode {
  if (drawRadio.checked)
    return 'draw';
  if (eraseRadio.checked)
    return 'erase';
  return 'text';
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
  const mode = getToolMode();
  if (mode === 'draw') {
    canvas.style.cursor = 'crosshair';
    discardActiveInput();
  }
  else if (mode === 'erase') {
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

//region Initialization and handler setup

/** Page background SVGs parsed from the embedded JSON script tag */
const parsed: unknown = JSON.parse(backgroundsScript.textContent,);
if (!Array.isArray(parsed,))
  throw new Error('Page backgrounds data is not an array',);
/** Validated array of page background SVG markup strings */
const backgrounds: readonly string[] = parsed;

initPages({ backgrounds, overlay: svgOverlay, },);
initHistory(backgrounds.length,);
setTextLayer(textLayer,);

/** Undo system functions for snapshot capture and button state refresh */
const { pushSnapshot, updateUndoButtons, } = setupUndoHandlers({
  undoBtn, redoBtn, ctx, getCanvasSize, textLayer,
},);

textLayer.addEventListener('textfinalized', pushSnapshot,);

setupPointerHandlers({
  canvas, ctx, getToolMode, getCanvasSize, textLayer, pushSnapshot,
},);

setupToolbarHandlers({
  colorPicker: requireElement<HTMLInputElement>('#color-picker',),
  sizeSlider: requireElement<HTMLInputElement>('#size-slider',),
  clearBtn: requireElement<HTMLButtonElement>('#clear-btn',),
  exportBtn: requireElement<HTMLButtonElement>('#export-btn',),
  formatSelect: requireElement<HTMLSelectElement>('#format-select',),
  uploadBtn: requireElement<HTMLButtonElement>('#upload-btn',),
  uploadInput: requireElement<HTMLInputElement>('#upload-input',),
  container, svgOverlay, drawCanvas: canvas,
  textLayer, ctx, getCanvasSize, sizeCanvas, pushSnapshot,
},);

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
  updateUndoButtons();
},);

new ResizeObserver(sizeCanvas,).observe(container,);
sizeCanvas();

//endregion Initialization and handler setup
