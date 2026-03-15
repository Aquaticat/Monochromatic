/**
 * Jump instruction handlers for the Stak interpreter.
 *
 * @module
 */

import type { ExecutionStep, } from './interpreter-ops.ts';

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
 */
export function resolveJumpTarget(
  op: string,
  arg: string | undefined,
  labels: ReadonlyMap<string, number>,
): ExecutionStep {
  if (arg === undefined)
    throw new Error(`${op} missing label`,);
  const target = labels.get(arg,);
  if (target === undefined)
    throw new Error(`unknown label: ${arg}`,);
  return { jumpTo: target, };
}
