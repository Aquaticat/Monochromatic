/**
 * Detect whether the provided value contains a cyclic reference.
 *
 * Traversal rules:
 * - Arrays: traverses elements.
 * - Map: traverses both keys and values.
 * - Set: traverses elements.
 * - Plain objects: traverses enumerable own string and symbol properties.
 *
 * Terminals (not traversed):
 * - Primitives (string, number, boolean, bigint, symbol, undefined, null)
 * - Date, RegExp
 * - ArrayBuffer, DataView, TypedArrays
 * - WeakMap, WeakSet
 * - Any non-plain object other than Array, Map, or Set
 *
 * Notes:
 * - This inspects reference identity cycles (an edge path that leads back to a previously
 *   encountered object on the current traversal stack).
 * - Only enumerable own properties are considered for plain objects; non-enumerable properties
 *   are ignored by design.
 *
 * @param value - value to inspect for cycles.
 * @returns True if a cycle is found; false otherwise.
 *
 * @example
 * const a: Record\<string, unknown\> = \{\};
 * a.self = a;
 * hasCycle(a); // true
 */
//region Helpers -- Internal type guards and utilities for traversal decisions
function isPlainObject(objectLike: object,): boolean {
  const proto: object | null = Reflect.getPrototypeOf(objectLike,);
  return proto === Object.prototype || proto === null;
}

function isTypedArray(input: unknown,): boolean {
  // DataView is also an ArrayBuffer view, so exclude it explicitly
  return ArrayBuffer.isView(input,) && !(input instanceof DataView);
}

function isTraversableObject(input: unknown,): input is object {
  if (input === null || typeof input !== 'object')
    return false;

  // Built-in terminals
  if (input instanceof Date || input instanceof RegExp)
    return false;
  if (input instanceof ArrayBuffer || input instanceof DataView)
    return false;
  if (isTypedArray(input,))
    return false;
  if (input instanceof WeakMap || input instanceof WeakSet)
    return false;

  // Traversable types handled in dfs: Array, Map, Set, plain objects
  return true;
}
//endregion Helpers

export function unknownHasCycle(value: unknown,): boolean {
  //region DFS -- Depth-first search with ancestor stack to detect back-edges (cycles)

  const ancestors = new WeakSet<object>(); // nodes on current recursion path
  const visited = new WeakSet<object>(); // nodes already fully explored

  function dfs(node: unknown,): boolean {
    if (!isTraversableObject(node,))
      return false;

    const obj: object = node;

    if (ancestors.has(obj,)) {
      // Encountered an object already on the current path => cycle
      return true;
    }
    if (visited.has(obj,)) {
      // Already explored this subgraph on another path
      return false;
    }

    ancestors.add(obj,);
    try {
      // Arrays: traverse elements
      if (Array.isArray(obj,)) {
        for (const item of obj as unknown[]) {
          if (dfs(item,))
            return true;
        }
        return false;
      }

      // Map: traverse keys and values
      if (obj instanceof Map) {
        for (const [key, val,] of obj as Map<unknown, unknown>) {
          if (dfs(key,) || dfs(val,))
            return true;
        }
        return false;
      }

      // Set: traverse elements
      if (obj instanceof Set) {
        for (const item of obj as Set<unknown>) {
          if (dfs(item,))
            return true;
        }
        return false;
      }

      // Plain objects: traverse enumerable own string and symbol properties
      if (isPlainObject(obj,)) {
        // String keys
        const record = obj as Record<string, unknown>;
        for (const key of Object.keys(record,)) {
          if (dfs(record[key],))
            return true;
        }

        // Symbol keys (only enumerable)
        const symbols: readonly symbol[] = Object.getOwnPropertySymbols(obj,);
        for (const sym of symbols) {
          const desc = Object.getOwnPropertyDescriptor(obj, sym,);
          if (desc?.enumerable === true) {
            // Use Reflect.get to access symbol-indexed values safely
            if (dfs(Reflect.get(obj, sym,),))
              return true;
          }
        }

        return false;
      }

      // Other object instances are treated as terminals by default
      return false;
    }
    finally {
      ancestors.delete(obj,);
      visited.add(obj,);
    }
  }

  //endregion DFS

  return dfs(value,);
}
