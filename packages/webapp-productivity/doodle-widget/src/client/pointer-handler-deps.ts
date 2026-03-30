/**
 * Type definitions for pointer event handler dependencies.
 */

/** Active tool mode for the doodle widget */
export type ToolMode = 'draw' | 'erase' | 'text' | 'zoom';

/**
 * Dependencies for pointer event handlers.
 *
 * @example
 * ```ts
 * setupPointerHandlers({
 *   canvas, ctx,
 *   getToolMode: () => 'draw',
 *   getCanvasSize: () => ({ cw: 800, ch: 600 }),
 *   textLayer, pushSnapshot,
 * });
 * ```
 */
export type PointerHandlerDeps = {
  /** Canvas element receiving pointer events */
  canvas: HTMLCanvasElement;
  /** 2D rendering context for immediate stroke rendering */
  ctx: CanvasRenderingContext2D;
  /** Returns the currently active tool mode */
  getToolMode: () => ToolMode;
  /** Returns current canvas dimensions in CSS pixels */
  getCanvasSize: () => {
    cw: number;
    ch: number;
  };
  /** Text layer element for eraser hit testing */
  textLayer: HTMLDivElement;
  /** Pushes current state to undo history after a completed action */
  pushSnapshot: () => void;
  /** Page element for zoom screen-to-content coordinate mapping */
  page: HTMLDivElement;
  /** Zoom layer element for CSS transform application */
  zoomLayer: HTMLDivElement;
};
