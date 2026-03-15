/**
 * Entry point for the doodle widget client-side application.
 *
 * Queries DOM elements, configures event listeners for drawing and
 * background upload, reads tool mode from radio inputs, and sets up
 * canvas resize handling via ResizeObserver.
 */

import {
  setRasterBackground,
  setSvgBackground,
} from './background.ts';
import {
  clearStrokes,
  redraw,
} from './drawing.ts';
import { setupPointerHandlers, } from './pointer-handlers.ts';
import {
  clearTextEntries,
  discardActiveInput,
  setTextLayer,
} from './text.ts';

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

/** Hidden file input for background image upload */
const uploadInput = requireElement<HTMLInputElement>('#upload-input',);

/** Button that triggers the file upload dialog */
const uploadBtn = requireElement<HTMLButtonElement>('#upload-btn',);

/** Button that clears all drawn strokes and text */
const clearBtn = requireElement<HTMLButtonElement>('#clear-btn',);

/** SVG overlay element for displaying SVG backgrounds */
const svgOverlay = requireElement<HTMLDivElement>('#svg-overlay',);

/** Draw tool radio input */
const drawRadio = requireElement<HTMLInputElement>('#tool-draw',);

/** Text label overlay layer */
const textLayer = requireElement<HTMLDivElement>('#text-layer',);

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

/** Toggle group container holding tool radios */
const toggleGroup = requireElement<HTMLDivElement>('.toggle-group',);

toggleGroup.addEventListener('change', syncCursorToTool,);

/** Set initial cursor */
syncCursorToTool();

//endregion Tool mode switching

//region Pointer & toolbar handlers

setupPointerHandlers({
  canvas,
  ctx,
  isDrawMode,
  getCanvasSize: function getCanvasSize(): { cw: number; ch: number; } {
    return { cw: canvasWidth, ch: canvasHeight, };
  },
},);

clearBtn.addEventListener('click', function handleClear(): void {
  clearStrokes();
  clearTextEntries();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight,);
},);

uploadBtn.addEventListener('click', function handleUploadClick(): void {
  uploadInput.click();
},);

/**
 * Processes a user-selected background file.
 *
 * SVG files are read as text and rendered in the overlay layer.
 * Raster images are set as a CSS background via object URL.
 *
 * @param file - uploaded image file
 */
async function processBackgroundFile(file: File,): Promise<void> {
  clearStrokes();
  clearTextEntries();
  if (file.type === 'image/svg+xml' || file.name.endsWith('.svg',)) {
    /** Raw SVG markup read from the uploaded file */
    const svgMarkup = await file.text();
    setSvgBackground({ svgMarkup, overlay: svgOverlay, container, },);
  }
  else {
    setRasterBackground({ file, overlay: svgOverlay, container, },);
  }
  sizeCanvas();
}

uploadInput.addEventListener('change', function handleFileChange(): void {
  /** Selected file from the upload input */
  const file = uploadInput.files?.item(0,) ?? null;
  if (file === null)
    return;
  void processBackgroundFile(file,);
},);

//endregion Pointer & toolbar handlers

//region Initialization

setTextLayer(textLayer,);
new ResizeObserver(sizeCanvas,).observe(container,);
sizeCanvas();

//endregion Initialization
