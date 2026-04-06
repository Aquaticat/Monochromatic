/**
 * DOM element references for the doodle widget.
 *
 * All queries execute at module load time and throw if an element
 * is missing, ensuring early failure for missing markup.
 */

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
export function requireElement<T extends Element,>(selector: string,): T {
  /** Query result, possibly null if selector has no match */
  const element = document.querySelector<T>(selector,);
  if (element === null)
    throw new Error(`Missing required element: ${selector}`,);
  return element;
}

/** Canvas container element (scrollable centering viewport) */
export const container: HTMLDivElement = requireElement<HTMLDivElement>(
  '#canvas-container',
);

/** Fixed letter-size page element (coordinate reference for drawing and export) */
export const page: HTMLDivElement = requireElement<HTMLDivElement>('#page',);

/** Drawing canvas element */
export const canvas: HTMLCanvasElement = requireElement<HTMLCanvasElement>(
  '#draw-canvas',
);

/** SVG overlay element for displaying SVG backgrounds with multiply blending */
export const svgOverlay: HTMLDivElement = requireElement<HTMLDivElement>('#svg-overlay',);

/** Draw tool radio input */
export const drawRadio: HTMLInputElement = requireElement<HTMLInputElement>(
  '#tool-draw',
);

/** Erase tool radio input */
export const eraseRadio: HTMLInputElement = requireElement<HTMLInputElement>(
  '#tool-erase',
);

/** Zoom tool radio input */
export const zoomRadio: HTMLInputElement = requireElement<HTMLInputElement>(
  '#tool-zoom',
);

/** Text label overlay layer */
export const textLayer: HTMLDivElement = requireElement<HTMLDivElement>('#text-layer',);

/** Zoom layer wrapper for CSS transform-based zoom and pan */
export const zoomLayer: HTMLDivElement = requireElement<HTMLDivElement>('#zoom-layer',);

/** Tool selection toggle group */
export const toolToggle: HTMLDivElement = requireElement<HTMLDivElement>('#tool-toggle',);

/** Page selection toggle group */
export const pageToggle: HTMLDivElement = requireElement<HTMLDivElement>('#page-toggle',);

/** JSON script element holding page background SVGs */
export const backgroundsScript: HTMLScriptElement = requireElement<HTMLScriptElement>(
  '#page-backgrounds',
);

/** Undo button */
export const undoBtn: HTMLButtonElement = requireElement<HTMLButtonElement>('#undo-btn',);

/** Redo button */
export const redoBtn: HTMLButtonElement = requireElement<HTMLButtonElement>('#redo-btn',);

/** Color picker input */
export const colorPicker: HTMLInputElement = requireElement<HTMLInputElement>(
  '#color-picker',
);

/** Stroke width slider */
export const sizeSlider: HTMLInputElement = requireElement<HTMLInputElement>(
  '#size-slider',
);

/** Clear button */
export const clearBtn: HTMLButtonElement = requireElement<HTMLButtonElement>(
  '#clear-btn',
);

/** Export button */
export const exportBtn: HTMLButtonElement = requireElement<HTMLButtonElement>(
  '#export-btn',
);

/** Export format dropdown */
export const formatSelect: HTMLSelectElement = requireElement<HTMLSelectElement>(
  '#format-select',
);

/** Upload trigger button */
export const uploadBtn: HTMLButtonElement = requireElement<HTMLButtonElement>(
  '#upload-btn',
);

/** Hidden file upload input */
export const uploadInput: HTMLInputElement = requireElement<HTMLInputElement>(
  '#upload-input',
);

/** Zoom instruction toast popover */
export const zoomToast: HTMLDivElement = requireElement<HTMLDivElement>('#zoom-toast',);
