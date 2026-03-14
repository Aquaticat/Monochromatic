/**
 * Entry point for the doodle widget client-side application.
 *
 * Queries DOM elements, configures event listeners for drawing and
 * background upload, reads tool mode from radio inputs, and sets up
 * canvas resize handling via ResizeObserver.
 *
 * Exceeds 100 lines: entry-point wiring between drawing state, text
 * state, background management, and DOM event handlers that must share
 * canvas dimension variables.
 */

import { setRasterBackground, setSvgBackground, } from './background.ts';
import {
  clearStrokes,
  configureCtx,
  continueStroke,
  endStroke,
  normalizePointer,
  redraw,
  startStroke,
} from './drawing.ts';
import {
  clearTextEntries,
  discardActiveInput,
  placeTextInput,
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
function requireElement<T extends Element>(selector: string): T {
  /** Query result, possibly null if selector has no match */
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

//region DOM element references

/** Canvas container element */
const container = requireElement<HTMLDivElement>('#canvas-container');

/** Drawing canvas element */
const canvas = requireElement<HTMLCanvasElement>('#draw-canvas');

/** Hidden file input for background image upload */
const uploadInput = requireElement<HTMLInputElement>('#upload-input');

/** Button that triggers the file upload dialog */
const uploadBtn = requireElement<HTMLButtonElement>('#upload-btn');

/** Button that clears all drawn strokes and text */
const clearBtn = requireElement<HTMLButtonElement>('#clear-btn');

/** SVG overlay element for displaying SVG backgrounds */
const svgOverlay = requireElement<HTMLDivElement>('#svg-overlay');

/** Draw tool radio input */
const drawRadio = requireElement<HTMLInputElement>('#tool-draw');

/** Text label overlay layer */
const textLayer = requireElement<HTMLDivElement>('#text-layer');

//endregion DOM element references

/** Maybe-null canvas rendering context before validation */
const maybeCtx = canvas.getContext('2d');
if (maybeCtx === null) {
  throw new Error('Canvas 2D context unavailable');
}

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
  redraw({ ctx, cw: canvasWidth, ch: canvasHeight, });
}

//region Tool mode switching

/**
 * Updates canvas cursor based on the selected tool radio.
 */
function syncCursorToTool(): void {
  if (isDrawMode()) {
    canvas.style.cursor = 'crosshair';
    discardActiveInput();
  } else {
    canvas.style.cursor = 'text';
  }
}

/** Toggle group container holding tool radios */
const toggleGroup = requireElement<HTMLDivElement>('.toggle-group');

toggleGroup.addEventListener('change', syncCursorToTool);

/** Set initial cursor */
syncCursorToTool();

//endregion Tool mode switching

//region Pointer event handlers

canvas.addEventListener('pointerdown', function handlePointerDown(event: PointerEvent): void {
  if (!isDrawMode()) {
    /** Bounding rect of the canvas element */
    const rect = canvas.getBoundingClientRect();
    placeTextInput([
      (event.clientX - rect.left) / canvasWidth,
      (event.clientY - rect.top) / canvasHeight,
    ]);
    return;
  }

  canvas.setPointerCapture(event.pointerId);
  /** Normalized pointer position at stroke start */
  const point = normalizePointer({ event, canvas, cw: canvasWidth, ch: canvasHeight, });
  startStroke(point);
});

canvas.addEventListener('pointermove', function handlePointerMove(event: PointerEvent): void {
  if (!isDrawMode()) {
    return;
  }

  /** Normalized pointer position for stroke continuation */
  const point = normalizePointer({ event, canvas, cw: canvasWidth, ch: canvasHeight, });
  /** Line segment to draw incrementally, or null if not drawing */
  const segment = continueStroke(point);
  if (segment === null) {
    return;
  }
  configureCtx(ctx);
  ctx.beginPath();
  ctx.moveTo(segment.from[0] * canvasWidth, segment.from[1] * canvasHeight);
  ctx.lineTo(segment.to[0] * canvasWidth, segment.to[1] * canvasHeight);
  ctx.stroke();
});

canvas.addEventListener('pointerup', function handlePointerUp(): void {
  if (isDrawMode()) {
    endStroke();
  }
});

canvas.addEventListener('pointercancel', function handlePointerCancel(): void {
  if (isDrawMode()) {
    endStroke();
  }
});

//endregion Pointer event handlers

//region Toolbar handlers

clearBtn.addEventListener('click', function handleClear(): void {
  clearStrokes();
  clearTextEntries();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
});

uploadBtn.addEventListener('click', function handleUploadClick(): void {
  uploadInput.click();
});

/**
 * Processes a user-selected background file.
 *
 * SVG files are read as text and rendered in the overlay layer.
 * Raster images are set as a CSS background via object URL.
 *
 * @param file - uploaded image file
 *
 * @returns once background is applied and canvas is resized
 */
async function processBackgroundFile(file: File): Promise<void> {
  clearStrokes();
  clearTextEntries();
  if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
    /** Raw SVG markup read from the uploaded file */
    const svgMarkup = await file.text();
    setSvgBackground({ svgMarkup, overlay: svgOverlay, container, });
  } else {
    setRasterBackground({ file, overlay: svgOverlay, container, });
  }
  sizeCanvas();
}

uploadInput.addEventListener('change', function handleFileChange(): void {
  /** Selected file from the upload input */
  const file = uploadInput.files?.item(0) ?? null;
  if (file === null) {
    return;
  }
  void processBackgroundFile(file);
});

//endregion Toolbar handlers

//region Initialization

setTextLayer(textLayer);
new ResizeObserver(sizeCanvas).observe(container);
sizeCanvas();

//endregion Initialization
