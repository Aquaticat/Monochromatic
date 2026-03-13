/**
 * Entry point for the doodle widget client-side application.
 *
 * Queries DOM elements, configures event listeners for drawing, text
 * placement, and background upload, and sets up canvas resize handling
 * via ResizeObserver.
 *
 * Exceeds 100 lines: entry-point wiring between drawing state, text
 * state, background management, and DOM event handlers that must share
 * canvas dimension variables and tool mode.
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
  addTextEntry,
  clearTextEntries,
  redrawTexts,
} from './text.ts';

//region Tool mode

/** Active drawing tool */
type ToolMode = 'draw' | 'text';

/** Currently selected tool mode */
let toolMode: ToolMode = 'draw';

//endregion Tool mode

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

/** Draw tool button */
const drawToolBtn = requireElement<HTMLButtonElement>('#tool-draw');

/** Text tool button */
const textToolBtn = requireElement<HTMLButtonElement>('#tool-text');

/** Text input overlay for entering text content */
const textInput = requireElement<HTMLInputElement>('#text-input');

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
 * Resizes the canvas to match its container and redraws all content.
 */
function sizeCanvas(): void {
  canvasWidth = container.clientWidth;
  canvasHeight = container.clientHeight;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  redraw({ ctx, cw: canvasWidth, ch: canvasHeight, });
  redrawTexts({ ctx, cw: canvasWidth, ch: canvasHeight, });
}

//region Tool mode switching

/** CSS class applied to the currently active tool button */
const ACTIVE_TOOL_CLASS = 'tool-active';

/**
 * Switches the active tool mode and updates toolbar button states.
 *
 * @param mode - tool to activate
 */
function setToolMode(mode: ToolMode): void {
  toolMode = mode;

  drawToolBtn.classList.toggle(ACTIVE_TOOL_CLASS, mode === 'draw');
  textToolBtn.classList.toggle(ACTIVE_TOOL_CLASS, mode === 'text');

  if (mode === 'draw') {
    canvas.style.cursor = 'crosshair';
    hideTextInput();
  } else {
    canvas.style.cursor = 'text';
  }
}

drawToolBtn.addEventListener('click', function handleDrawToolClick(): void {
  setToolMode('draw');
});

textToolBtn.addEventListener('click', function handleTextToolClick(): void {
  setToolMode('text');
});

/** Initialize draw mode as active */
setToolMode('draw');

//endregion Tool mode switching

//region Text input management

/**
 * Hides the text input overlay and clears its value.
 */
function hideTextInput(): void {
  textInput.style.display = 'none';
  textInput.value = '';
}

/**
 * Shows the text input at the given canvas-relative pixel position.
 *
 * @param x - horizontal offset in CSS pixels from canvas left edge
 *
 * @param y - vertical offset in CSS pixels from canvas top edge
 */
function showTextInput({ x, y }: { x: number; y: number }): void {
  textInput.style.display = 'block';
  textInput.style.insetInlineStart = `${String(x)}px`;
  textInput.style.insetBlockStart = `${String(y)}px`;
  textInput.value = '';
  textInput.focus();
}

/**
 * Commits the current text input content as a text entry and hides the input.
 */
function commitTextInput(): void {
  /** Trimmed input value */
  const content = textInput.value.trim();
  if (content === '') {
    hideTextInput();
    return;
  }

  /** Pixel position of the text input relative to canvas container */
  const x = parseFloat(textInput.style.insetInlineStart);
  const y = parseFloat(textInput.style.insetBlockStart);

  if (canvasWidth === 0 || canvasHeight === 0) {
    hideTextInput();
    return;
  }

  addTextEntry({
    position: [x / canvasWidth, y / canvasHeight],
    content,
  });

  hideTextInput();
  redraw({ ctx, cw: canvasWidth, ch: canvasHeight, });
  redrawTexts({ ctx, cw: canvasWidth, ch: canvasHeight, });
}

textInput.addEventListener('keydown', function handleTextKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitTextInput();
  } else if (event.key === 'Escape') {
    hideTextInput();
  }
});

textInput.addEventListener('blur', function handleTextBlur(): void {
  commitTextInput();
});

//endregion Text input management

//region Pointer event handlers

canvas.addEventListener('pointerdown', function handlePointerDown(event: PointerEvent): void {
  if (toolMode === 'text') {
    /** Bounding rect of the canvas element */
    const rect = canvas.getBoundingClientRect();
    showTextInput({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    return;
  }

  canvas.setPointerCapture(event.pointerId);
  /** Normalized pointer position at stroke start */
  const point = normalizePointer({ event, canvas, cw: canvasWidth, ch: canvasHeight, });
  startStroke(point);
});

canvas.addEventListener('pointermove', function handlePointerMove(event: PointerEvent): void {
  if (toolMode === 'text') {
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
  if (toolMode !== 'text') {
    endStroke();
  }
});

canvas.addEventListener('pointercancel', function handlePointerCancel(): void {
  if (toolMode !== 'text') {
    endStroke();
  }
});

//endregion Pointer event handlers

//region Toolbar handlers

clearBtn.addEventListener('click', function handleClear(): void {
  clearStrokes();
  clearTextEntries();
  hideTextInput();
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
  hideTextInput();
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

new ResizeObserver(sizeCanvas).observe(container);
sizeCanvas();

//endregion Initialization
