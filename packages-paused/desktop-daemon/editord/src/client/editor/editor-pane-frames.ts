/**
 * rAF state container for the editor pane.
 *
 * Groups every deferred-frame ID tracked by the editor pane into a single
 * record so cleanup stays in sync as new schedulers are added. Without this
 * grouping, each scheduler needed its own private field plus a matching
 * cancel call in `disconnectedCallback`, and the two sides drifted apart.
 */

/**
 * rAF IDs tracked by an editor pane instance.
 */
export type EditorPaneFrames = {
  /**
   * Pending syntax highlight rAF ID.
   */
  highlight: number;
  /**
   * Pending resize re-measurement rAF ID.
   */
  resizeMeasure: number;
  /**
   * Pending diagnostic highlight rAF ID.
   */
  diagnosticHighlight: number;
  /**
   * Pending inlay annotation rAF ID.
   */
  inlayAnnotation: number;
};

/**
 * Creates a fresh rAF state record with every ID zeroed.
 *
 * @returns initial rAF state record
 *
 * @example
 * ```ts
 * const frames = createEditorPaneFrames();
 * ```
 */
export function createEditorPaneFrames(): EditorPaneFrames {
  return {
    highlight: 0,
    resizeMeasure: 0,
    diagnosticHighlight: 0,
    inlayAnnotation: 0,
  };
}

/**
 * Cancels every pending rAF tracked by the given state record.
 *
 * @param frames - rAF state record whose frames should be cancelled
 *
 * @example
 * ```ts
 * cancelEditorPaneFrames({ frames, });
 * ```
 */
export function cancelEditorPaneFrames({
  frames,
}: {
  readonly frames: Readonly<EditorPaneFrames>;
},): void {
  cancelAnimationFrame(frames.highlight,);
  cancelAnimationFrame(frames.resizeMeasure,);
  cancelAnimationFrame(frames.diagnosticHighlight,);
  cancelAnimationFrame(frames.inlayAnnotation,);
}

/**
 * Dispatches a bubbling, composed `contentchange` custom event on the given target.
 *
 * Extracted so the editor-pane lifecycle stays small enough for the
 * project's max-lines cap; the event shape is unchanged.
 *
 * @param target - element on which to dispatch the event
 *
 * @example
 * ```ts
 * dispatchContentChange({ target: this, });
 * ```
 */
export function dispatchContentChange({
  target,
}: {
  readonly target: EventTarget;
},): void {
  target.dispatchEvent(
    new CustomEvent(
      'contentchange',
      {
        bubbles: true,
        composed: true,
      },
    ),
  );
}
