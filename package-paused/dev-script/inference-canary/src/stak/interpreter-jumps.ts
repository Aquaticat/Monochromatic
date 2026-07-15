/**
 * Jump instruction handlers for the Stak interpreter.
 *
 * @module
 */

import type { ExecutionStep, } from './interpreter-ops.ts';

/**
 * Options for {@link resolveJumpTarget}.
 *
 * @example
 * ```ts
 * const opts: ResolveJumpTargetOptions = {
 *   op: 'JUMP',
 *   arg: 'loop',
 *   labels: new Map([['loop', 5]]),
 * };
 * ```
 */
export type ResolveJumpTargetOptions = {
  /**
   * Opcode name for error messages
   */
  readonly op: string;
  /**
   * Label name argument
   */
  readonly arg?: string;
  /**
   * Label-to-position mapping from the indexing pass
   */
  readonly labels: ReadonlyMap<string, number>;
};

/**
 * Resolves a label to a jump target position.
 *
 * @param op - opcode name for error messages
 *
 * @param arg - label name argument
 *
 * @param labels - label-to-position mapping from the indexing pass
 *
 * @returns jump target position
 *
 * @throws when arg is undefined or label is not found
 *
 * @example
 * ```ts
 * const labels = new Map([['loop', 5]]);
 * const step = resolveJumpTarget({ op: 'JUMP', arg: 'loop', labels });
 * // step.jumpTo === 5
 * ```
 */
export function resolveJumpTarget({
  op,
  arg,
  labels,
}: ResolveJumpTargetOptions,): ExecutionStep {
  if (arg === undefined)
    throw new Error(`${op} missing label`,);
  /**
   * Resolved jump position from the label map; throws below when the label is unknown.
   */
  const target = labels.get(arg,);
  if (target === undefined)
    throw new Error(`unknown label: ${arg}`,);
  return { jumpTo: target, };
}
