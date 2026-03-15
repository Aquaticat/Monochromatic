/**
 * Type-based conflict resolution rules for object merging.
 */

/**
 * Rules configuration for object merging behavior based on JavaScript types.
 */
export type ObjectsMergeRules = {
  readonly function: (params: {
    readonly key: string;
    readonly values: ((...args: unknown[]) => unknown)[];
  },) => unknown;
  readonly string: (params: {
    readonly key: string;
    readonly values: string[];
  },) => unknown;
  readonly number: (params: {
    readonly key: string;
    readonly values: number[];
  },) => unknown;
  readonly boolean: (params: {
    readonly key: string;
    readonly values: boolean[];
  },) => unknown;
  readonly object: (params: {
    readonly key: string;
    readonly values: object[];
  },) => unknown;
  readonly undefined: (params: {
    readonly key: string;
    readonly values: undefined[];
  },) => unknown;
  readonly bigint: (params: {
    readonly key: string;
    readonly values: bigint[];
  },) => unknown;
  readonly symbol: (params: {
    readonly key: string;
    readonly values: symbol[];
  },) => unknown;
};
