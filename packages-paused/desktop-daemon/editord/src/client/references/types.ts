/**
 * Types for the references popup component.
 *
 * Shared between the popup class and its rendering helpers.
 */

/**
 * Single reference location with display label.
 */
export type ReferenceLocation = {
  /**
   * Absolute file path.
   */
  readonly path: string;
  /**
   * 0-based line number.
   */
  readonly line: number;
  /**
   * 0-based character offset within the line.
   */
  readonly character: number;
  /**
   * Display label (relative path).
   */
  readonly label: string;
};

/**
 * Detail emitted with the `reference-select` event.
 */
export type ReferenceSelectDetail = {
  /**
   * Absolute file path.
   */
  readonly path: string;
  /**
   * 1-based line number for navigation.
   */
  readonly line: number;
  /**
   * 0-based character offset within the line.
   */
  readonly character: number;
};
