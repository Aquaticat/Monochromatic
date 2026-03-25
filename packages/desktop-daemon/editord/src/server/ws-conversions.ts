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
 */
export function extractHoverContent({ hover, }: { hover: LspHover; },): string {
  if (typeof hover.contents === 'string')
    return hover.contents;

  return (hover.contents as LspMarkupContent).value;
}

/**
 * Converts LSP completion items to wire format.
 *
 * @param items - LSP completion items
 *
 * @returns wire-format completion items
 */
export function toWireCompletionItems(
  { items, }: { items: LspCompletionItem[]; },
): CompletionItem[] {
  return items.map(function convertItem(item,) {
    return {
      label: item.label,
      detail: item.detail ?? '',
      insertText: item.insertText ?? item.label,
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
 */
export function toWireInlayHints({ hints, }: { hints: LspInlayHint[]; },): InlayHint[] {
  return hints.map(function convertHint(hint,) {
    const label = typeof hint.label === 'string'
      ? hint.label
      : hint
        .label
        .map(function extractPart(part,) {
          return part.value;
        },)
        .join('',);
    const result: InlayHint = {
      position: hint.position,
      label,
    };
    if (hint.kind !== undefined)
      result.kind = hint.kind;
    if (hint.paddingLeft !== undefined)
      result.paddingLeft = hint.paddingLeft;
    if (hint.paddingRight !== undefined)
      result.paddingRight = hint.paddingRight;
    return result;
  },);
}

/**
 * Converts an LSP selection range (nested chain) to wire format.
 * Recursively converts the `parent` chain.
 *
 * @param lspRange - LSP selection range with nested parents
 *
 * @returns wire-format selection range
 */
export function toWireSelectionRange(
  { lspRange, }: { lspRange: LspSelectionRange; },
): SelectionRange {
  const result: SelectionRange = { range: lspRange.range, };
  if (lspRange.parent !== undefined)
    result.parent = toWireSelectionRange({ lspRange: lspRange.parent, },);
  return result;
}
