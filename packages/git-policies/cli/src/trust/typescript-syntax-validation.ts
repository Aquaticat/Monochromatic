/**
 * TypeScript trust source syntax edge validation. @module
 */

/**
 * Reports whether unknown value is syntax-node-shaped record.
 *
 * @param value - unknown syntax value
 *
 * @returns whether value can expose named fields
 */
function isSyntaxRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object') && (value !== null);
}

/**
 * Reports whether syntax node is computed dynamic import.
 *
 * @param node - ESTree-compatible syntax node
 *
 * @returns whether import source is not string literal
 */
function isComputedDynamicImport(node: Readonly<Record<string, unknown>>,): boolean {
  if (node.type !== 'ImportExpression')
    return false;
  /**
   * Dynamic import source node.
   */
  const {source} = node;
  return ((typeof source) !== 'object') || (source === null)
    || (!('value' in source))
    || ((typeof source.value) !== 'string');
}

/**
 * Rejects computed dynamic imports in tracked TypeScript syntax tree.
 *
 * @param syntax - ESTree-compatible Rolldown syntax tree
 *
 * @example
 * ```ts
 * assertLiteralDynamicImports(program);
 * ```
 */
export function assertLiteralDynamicImports(syntax: unknown,): void {
  /**
   * Bounded structural work stack.
   */
  const pending: unknown[] = [syntax,];
  while (pending.length > 0) {
    /**
     * Next structural value.
     */
    const value = pending.pop();
    if (value === undefined)
      continue;
    if (Array.isArray(value,)) {
      pending.push(...(value as readonly unknown[]),);
      continue;
    }
    if (!isSyntaxRecord(value,))
      continue;
    if (isComputedDynamicImport(value,))
      throw new Error('Dynamic TypeScript imports must use literal specifiers.',);
    pending.push(...Object.values(value,),);
  }
}
