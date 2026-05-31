/**
 * Shared editor position type.
 *
 * Defines the 0-based line/character position type used throughout
 * the editord client for cursor resolution and LSP requests.
 */

/**
 * 0-based text position in the editor.
 */
export type EditorPosition = {
  /**
   * 0-based line index.
   */
  readonly line: number;
  /**
   * 0-based character offset within the line.
   */
  readonly character: number;
};
