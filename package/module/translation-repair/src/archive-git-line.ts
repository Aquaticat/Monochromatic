import { foldCarriageReturns, } from './line-endings.ts';

//region Git document lines
// Protocol newlines must not turn a real bare-CR EOF into an invented CRLF ending.

/**
 * Applies corpus line-ending normalization with known physical termination.
 *
 * @param text - document line without Git's protocol newline
 *
 * @param terminated - whether the physical line actually had a newline
 *
 * @returns Normalized line without its physical separator
 *
 * @example
 * ```ts
 * foldGitDocumentLine({ text: 'cat\r', terminated: false }); // retains bare CR
 * ```
 */
export function foldGitDocumentLine({
  text,
  terminated,
}: {
  readonly text: string;
  readonly terminated: boolean;
},): string {
  /**
   * Restore only a proven physical separator before using shared normalization.
   */
  const normalized = foldCarriageReturns({ text: terminated ? `${text}\n` : text, },)
    .text;
  return terminated ? normalized.slice(
    0,
    -1,
  ) : normalized;
}

//endregion Git document lines
