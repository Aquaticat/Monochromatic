/**
 * LSP-to-wire format conversion functions for the WebSocket handler.
 *
 * Transforms LSP protocol types into the simpler wire format
 * sent to the browser client over WebSocket.
 */

import type {
  CompletionItem,
  InlayHint,
  SelectionRange,
} from '../protocol.ts';
import type {
  LspCompletionItem,
  LspHover,
  LspInlayHint,
  LspMarkupContent,
  LspSelectionRange,
} from './lsp/types.ts';

/**
 * Extracts hover content as a plain string from an LSP hover result.
 * Handles MarkupContent objects and plain strings.
 *
 * @param hover - LSP hover result
 *
 * @returns string representation of the hover content
 *
 * @example
 * ```ts
 * const result = extractHoverContent({ hover: { contents: { kind: 'markdown', value: '```ts\nconst x: number\n```' } }, });
 * ```
 */
export function extractHoverContent({ hover, }: { readonly hover: LspHover; },): string {
  if ((typeof hover.contents) === 'string')
    return hover.contents;

  return (hover.contents as LspMarkupContent).value;
}

/**
 * Converts LSP completion items to wire format.
 *
 * @param items - LSP completion items
 *
 * @returns wire-format completion items
 *
 * @example
 * ```ts
 * const result = toWireCompletionItems({ items: [{ label: 'useState', detail: 'function', insertText: 'useState' }], });
 * ```
 */
export function toWireCompletionItems(
  { items, }: { readonly items: readonly LspCompletionItem[]; },
): CompletionItem[] {
  return items.map(function convertItem(item,) {
    return {
      label: item.label,
      detail: item.detail
        ?? '',
      insertText: item.insertText
        ?? item
        .label,
    };
  },);
}

/**
 * Converts LSP inlay hints to wire format.
 * Extracts label text from string or structured label parts.
 *
 * @param hints - LSP inlay hints
 *
 * @returns wire-format inlay hints
 *
 * @example
 * ```ts
 * const result = toWireInlayHints({ hints: [{ position: { line: 3, character: 10 }, label: ': number', kind: 1 }], });
 * ```
 */
export function toWireInlayHints({ hints, }: { readonly hints: readonly LspInlayHint[]; },): InlayHint[] {
  return hints.map(function convertHint(hint,) {
    /**
     * Flat label text; structured `label` parts are concatenated since the wire format is plain string.
     */
    const label = (typeof hint.label) === 'string'
      ? hint.label
      : hint
        .label
        .map(function extractPart(part,) {
          return part.value;
        },)
        .join('',);
    /**
     * Wire payload with optional LSP fields omitted when absent.
     */
    return {
      position: hint.position,
      label,
      ...(hint.kind
        !== undefined ? { kind: hint.kind, } : {}),
      ...(hint.paddingLeft
        !== undefined ? { paddingLeft: hint.paddingLeft, } : {}),
      ...(hint.paddingRight
        !== undefined ? { paddingRight: hint.paddingRight, } : {}),
    };
  },);
}

/**
 * Converts an LSP selection range (nested chain) to wire format.
 * Recursively converts the `parent` chain.
 *
 * @param lspRange - LSP selection range with nested parents
 *
 * @returns wire-format selection range
 *
 * @example
 * ```ts
 * const result = toWireSelectionRange({ lspRange: { range: { start: { line: 0, character: 5 }, end: { line: 0, character: 10 } } }, });
 * ```
 */
export function toWireSelectionRange(
  { lspRange, }: { readonly lspRange: LspSelectionRange; },
): SelectionRange {
  /**
   * Wire payload; optional `parent` stays omitted when the LSP value omits it.
   */
  return {
    range: lspRange.range,
    ...(lspRange.parent
      !== undefined
      ? { parent: toWireSelectionRange({ lspRange: lspRange.parent, },), }
      : {}),
  };
}
