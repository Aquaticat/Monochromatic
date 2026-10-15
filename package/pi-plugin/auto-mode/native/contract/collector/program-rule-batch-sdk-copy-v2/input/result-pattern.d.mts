/**
 Original pattern materialization keeps parser ownership and native JSON values. @module
 */

/**
 Require the original bounded source profile.

 @param input - original admission condition and diagnostic
 */
export declare function requireProfile(input: Readonly<{ condition: unknown; message: string }>): void;

/**
 Decode original syntax into an owned bounded argument pattern.

 @param input - original syntax and optional prior immutable result binding

 @returns parser-owned pattern
 */
export declare function readPattern(input: Readonly<{
  node: unknown;
  bindingName?: string;
  depth?: number;
}>): object;

/**
 Materialize original data under the source decoder's private pattern membership check.

 @param input - original pattern and optional producer text

 @returns original JSON-compatible argument value
 */
export declare function materializePattern(input: Readonly<{
  pattern: object;
  result?: string;
}>): unknown;

/**
 Original profile failures retain their runtime diagnostic category.
 */
export declare class ResultProgramProfileError extends Error {
  constructor(message: string);
}
