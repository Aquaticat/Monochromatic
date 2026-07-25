/**
 * Canonical judge-model identity formatting.
 *
 * @module
 */

/**
 * Return canonical provider/model slug.
 *
 * @param model - model identity supplied by Pi
 *
 * @returns provider and model id joined by slash
 *
 * @example
 * ```typescript
 * budgetModelSlug({ provider: 'openai', id: 'gpt-5' });
 * ```
 */
function budgetModelSlug(
  model: {
    readonly provider: string;
    readonly id: string;
  },
): string {
  return `${model.provider}/${model.id}`;
}

export { budgetModelSlug, };
