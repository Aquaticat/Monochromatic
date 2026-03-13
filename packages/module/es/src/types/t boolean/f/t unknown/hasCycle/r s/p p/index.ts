/**
 * Detect whether a value contains circular references.
 *
 * Uses stack-based iterative traversal to avoid call-stack overflow
 * on deeply nested structures. Returns `false` immediately for
 * non-object / `null` inputs.
 *
 * @param value - value to inspect for cyclic references
 *
 * @returns `true` when value contains at least one cycle
 *
 * @example
 * Cyclic object detection:
 * ```ts
 * const obj: Record<string, unknown> = {};
 * obj.self = obj;
 * $(obj); // true
 * ```
 *
 * @example
 * Acyclic values:
 * ```ts
 * $({ a: 1, b: { c: 2 } }); // false
 * $(42); // false
 * $(null); // false
 * ```
 */
export function $(value: unknown,): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  /** Tracks visited object references. */
  const seen = new WeakSet();

  /** Stack-based iterative cycle detection. */
  const stack: unknown[] = [value,];

  // Intentional mutation: stack is consumed during traversal
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- stack shrinks via pop
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current !== 'object' || current === null) {
      continue;
    }
    if (seen.has(current,)) {
      return true;
    }
    seen.add(current,);
    for (const child of Object.values(current,)) {
      stack.push(child,);
    }
  }

  return false;
}
