/**
 * Simulates uncatalogued external effect boundary.
 *
 * @param state - Mutable state accepted by external boundary.
 */
export declare function opaqueExternalMutation(state: { value: string; },): void;

/**
 * External same-named lookalike for ECMAScript global String.
 *
 * @param value - Value accepted by unavailable implementation.
 *
 * @returns external text.
 */
export declare function String(value: unknown,): string;

/** External service whose method implementation is unavailable. */
export type OpaqueExternalService = {
  /** Writes state through unknown external implementation. */
  write(): void;
};
