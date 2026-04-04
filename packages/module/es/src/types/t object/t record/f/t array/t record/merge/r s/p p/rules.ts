/**
 * Type-based conflict resolution rules for object merging.
 *
 * Each rule receives the conflicting property key and all values of that type,
 * and returns the resolved value. Only needed for properties where multiple
 * objects provide different values of the same type.
 *
 * @example
 * ```ts
 * const rules: Partial<ObjectsMergeRules> = {
 *   number: ({ values }) => Math.max(...values),
 *   string: ({ values }) => values.join(' & '),
 * };
 * ```
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
