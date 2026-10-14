/**
 Walk the qualified parser's structural nodes without recursive JavaScript calls.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type { Node } from 'yuku-parser';

//region Parsed structural children share one iterative traversal

/**
 Syntax traversal diagnostics belong to the build boundary.
 */
const l = tagged({ tag: 'auto-mode-native-build-syntax' });

/**
 Inspect only fields of a qualified parser result.

 @param value - field that may contain another original parsed node

 @returns whether the field exposes a parser node discriminant
 */
function isParsedNode(value: unknown): value is Node {
  return ((typeof value) === 'object') && (value !== null)
    && ('type' in value) && ((typeof value.type) === 'string');
}

/**
 Visit each original node once with a work stack whose size follows source structure.

 @param root - original tree returned by the qualified parser

 @returns original nodes without cloning or mutating their fields

 @example
 ```ts
 for (const node of walkNativeSyntax(parsed.program)) inspect(node);
 ```
 */
export function* walkNativeSyntax(root: Node): Generator<Node> {
  /**
   The traversal owns its work stack while original nodes remain unchanged.
   */
  const pending = [root];
  /**
   Traversal entry is logged independently of callers selecting source edits.
   */
  const rl = tagged({ tag: walkNativeSyntax.name, l });
  rl.debug('walking original native source nodes');
  while (pending.length > 0) {
    /**
     The loop establishes that one original node remains pending.
     */
    const node = nonNullishOrThrow(pending.pop());
    yield node;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) if (isParsedNode(child)) pending.push(child);
      } else if (isParsedNode(value)) pending.push(value);
    }
  }
}

//endregion Parsed structural children share one iterative traversal
