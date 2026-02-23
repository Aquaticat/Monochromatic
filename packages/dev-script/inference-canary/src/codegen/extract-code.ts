/**
 * Extracts TypeScript source from model responses that may contain markdown fences.
 */

/**
 * Extracts TypeScript code from a model response, stripping markdown fences.
 * Handles both closed fences and unclosed fences (model truncated its output).
 * @param response - raw model output that may contain markdown code blocks
 * @returns extracted TypeScript source, or the raw response if no fences found
 */
export function extractCode(response: string): string {
  const closedFence = /```(?:typescript|ts)?\n([\s\S]*?)```/.exec(response);
  if (closedFence !== null && closedFence[1] !== undefined) return closedFence[1];

  const openFence = /```(?:typescript|ts)?\n([\s\S]*)/.exec(response);
  if (openFence !== null && openFence[1] !== undefined) return openFence[1];

  return response;
}
