/**
 * Deferred highlight and annotation scheduling for the editor pane.
 *
 * Batches DOM-intensive operations into `requestAnimationFrame` callbacks
 * to prevent jank during rapid edits.
 */

import type { Parser, } from '@lezer/common';

import type {
  Diagnostic,
  InlayHint,
} from '../../../protocol.ts';
import {
  applyDiagnosticHighlights,
  clearDiagnosticHighlights,
} from '../diagnostics/layer.ts';
import {
  applyHighlights,
  clearHighlights,
} from '../highlight/highlighter.ts';
import {
  applyInlayAnnotations,
  clearInlayAnnotations,
} from '../inlay/layer.ts';
import { measureInlayOffsets, } from '../inlay/measure.ts';

/**
 * Schedules diagnostic highlight rendering for the next animation frame.
 *
 * @param editor - contenteditable container element
 *
 * @param diagnostics - current diagnostics from the language server
 *
 * @returns animation frame ID for cancellation
 *
 * @example
 * ```ts
 * const result = scheduleDiagnosticHighlights({ editor: editor, diagnostics: [], });
 * ```
 */
export function scheduleDiagnosticHighlights({
  editor,
  diagnostics,
}: {
  editor: HTMLDivElement;
  diagnostics: Diagnostic[];
},): number {
  return requestAnimationFrame(function applyScheduledDiagnostics() {
    if (diagnostics.length === 0) {
      clearDiagnosticHighlights();
      return;
    }
    applyDiagnosticHighlights({
      editor,
      diagnostics,
    },);
  },);
}

/**
 * Schedules inlay annotation rendering for the next animation frame.
 * Combines inlay hints and diagnostics into per-line annotations.
 *
 * @param editor - contenteditable container element
 *
 * @param hints - current inlay hints from the language server
 *
 * @param diagnostics - current diagnostics from the language server
 *
 * @returns animation frame ID for cancellation
 *
 * @example
 * ```ts
 * const result = scheduleInlayAnnotations({ editor: editor, hints: [{ position: { line: 3, character: 10 }, label: ": number" }], diagnostics: [], });
 * ```
 */
export function scheduleInlayAnnotations({
  editor,
  hints,
  diagnostics,
}: {
  editor: HTMLDivElement;
  hints: InlayHint[];
  diagnostics: Diagnostic[];
},): number {
  return requestAnimationFrame(function applyScheduledInlayAnnotations() {
    if (hints.length === 0 && diagnostics.length === 0) {
      clearInlayAnnotations({ editor, },);
      return;
    }
    applyInlayAnnotations({
      editor,
      hints,
      diagnostics,
    },);
    /** Measure ::before heights after layout to set line number offsets. */
    requestAnimationFrame(function measureAfterLayout() {
      measureInlayOffsets({ editor, },);
    },);
  },);
}

/**
 * Schedules syntax highlight rendering for the next animation frame.
 *
 * @param editor - contenteditable container element
 *
 * @param parser - Lezer parser for the current language
 *
 * @returns animation frame ID for cancellation
 *
 * @example
 * ```ts
 * const result = scheduleHighlight({ editor: editor, parser: lezerParser, });
 * ```
 */
export function scheduleHighlight({
  editor,
  parser,
}: {
  editor: HTMLDivElement;
  parser: Parser | null;
},): number {
  return requestAnimationFrame(function applyScheduledHighlight() {
    if (parser === null) {
      clearHighlights();
      return;
    }
    applyHighlights({
      editor,
      parser,
    },);
  },);
}

/**
 * Schedules a re-measurement of inlay indent positions.
 * Called on editor resize to update positions after wrapping changes.
 *
 * @param editor - contenteditable container element
 *
 * @returns animation frame ID for cancellation
 *
 * @example
 * ```ts
 * const result = scheduleInlayMeasure({ editor: editor, });
 * ```
 */
export function scheduleInlayMeasure({ editor, }: { editor: HTMLDivElement; },): number {
  return requestAnimationFrame(function remeasureInlayOffsets() {
    measureInlayOffsets({ editor, },);
  },);
}
