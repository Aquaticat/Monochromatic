/**
 * Tag a single parsed TOML scalar as a toml-test tagged value.
 *
 * Reads the kind-bearing `toml-eslint-parser` value node directly rather than
 * the lossy `getStaticTOMLValue` projection, because the runner distinguishes
 * the four datetime kinds and integers past 2^53 that the projection collapses.
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

import {
  KIND_TO_TAG,
  type TaggedValue,
} from './tagged-types.ts';

/**
 * Render a finite-or-special float as the toml-test float payload.
 *
 * The runner parses the payload with Go's `ParseFloat` and compares
 * numerically, so the non-finite spellings match TOML's `inf` / `-inf` / `nan`
 * and finite values use the shortest round-tripping decimal.
 *
 * @param value - Parsed numeric value carried by the float node.
 *
 * @returns toml-test float payload string.
 *
 * @example
 * ```ts
 * floatToPayload(Number.POSITIVE_INFINITY); // 'inf'
 * floatToPayload(3.5);                       // '3.5'
 * ```
 */
function floatToPayload(value: number,): string {
  if (Number.isNaN(value,))
    return 'nan';
  if (value === Number.POSITIVE_INFINITY)
    return 'inf';
  if (value === Number.NEGATIVE_INFINITY)
    return '-inf';
  return String(value,);
}

/**
 * Convert one parsed scalar node into a tagged value.
 *
 * Integers use the node's exact `bigint` so 64-bit values survive; offset
 * datetimes normalize to RFC 3339 UTC via the parsed instant (the runner
 * compares instants); local datetimes keep their source spelling, which the
 * runner normalizes for its wall-clock comparison.
 *
 * @param node - Parsed scalar value node.
 *
 * @returns Tagged value mirroring the node's kind and payload.
 *
 * @throws Error when the node carries an unrecognized kind, so a future parser
 *         kind surfaces rather than being silently dropped.
 *
 * @example
 * ```ts
 * leafToTagged({ node, }); // { type: 'integer', value: '255' }
 * ```
 */
export function leafToTagged({ node, }: { readonly node: AST.TOMLValue; },): TaggedValue {
  if (node.kind === 'string')
    return {
      type: KIND_TO_TAG[node.kind],
      value: node.value,
    };
  if (node.kind === 'integer')
    return {
      type: KIND_TO_TAG[node.kind],
      value: node.bigint
        .toString(),
    };
  if (node.kind === 'float')
    return {
      type: KIND_TO_TAG[node.kind],
      value: floatToPayload(node.value,),
    };
  if (node.kind === 'boolean')
    return {
      type: KIND_TO_TAG[node.kind],
      value: node.value ? 'true' : 'false',
    };
  if (node.kind === 'offset-date-time')
    return {
      type: KIND_TO_TAG[node.kind],
      value: node.value
        .toISOString(),
    };
  if ((node.kind === 'local-date-time') || (node.kind === 'local-date')
    || (node.kind === 'local-time'))
    return {
      type: KIND_TO_TAG[node.kind],
      value: node.datetime,
    };
  throw new Error(`Unhandled TOML value kind: ${String((node as { kind: unknown; }).kind,)}`,);
}
