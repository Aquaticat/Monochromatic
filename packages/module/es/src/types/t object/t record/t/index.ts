/**
 * Generic record type alias parameterized by key and value types.
 */
export type $<K extends number | string | symbol, V,> = Record<K, V>;
