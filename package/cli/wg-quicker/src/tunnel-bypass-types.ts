/**
 * Address-family flag accepted by `ip`.
 */
export type BypassProto = '-4' | '-6';

/**
 * Persisted application-bypass ownership state.
 */
export type BypassState = {
  /**
   * State schema version.
   */
  readonly version: 1;

  /**
   * Interface whose exempt mark owns state.
   */
  readonly interfaceName: string;

  /**
   * Socket mark selected by config.
   */
  readonly mark: number;

  /**
   * Dynamically allocated bypass table.
   */
  readonly table: number;

  /**
   * Dynamically allocated rule preference.
   */
  readonly preference: number;

  /**
   * Random owner token stored in cooperative locks.
   */
  readonly ownerId: string;
};

/**
 * Private route protocol tagging bypass-owned defaults and rules.
 *
 * Linux treats values at or above static as opaque;
 * 201 is absent from installed kernel assigned protocol constants.
 */
export const BYPASS_ROUTE_PROTOCOL = 201;

/**
 * Families covered by socket-mark policy rules.
 */
export const BYPASS_PROTOS: readonly BypassProto[] = [
  '-4',
  '-6',
];
