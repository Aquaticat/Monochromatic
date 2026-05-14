/**
 * Extracts TypeScript source from model responses that may contain markdown fences.
 */

/** Result of attempting to extract code from a model response */
export type ExtractResult = {
  /** Extracted TypeScript source (from a code block, or the raw response as fallback) */
  readonly source: string;
  /**
   * Whether a code block was found in the response.
   * When false, `source` is the raw response text; the model did not produce
   * a fenced code block and the "source" is likely prose, not valid TypeScript.
   */
  readonly fenced: boolean;
};

/**
 * Attempts to extract TypeScript code from a model response, stripping markdown fences.
 * Handles both closed fences and unclosed fences (model truncated its output).
 *
 * When no fenced code block is found, returns the raw response with `fenced: false`
 * so callers can distinguish "model wrote bad code" from "model didn't write code at all."
 *
 * @param response - raw model output that may contain markdown code blocks
 *
 * @returns extraction result with source and whether a code block was found
 *
 * @example
 * ```ts
 * const result = tryExtractCode('```typescript\nconsole.log("hi");\n```');
 * // { source: 'console.log("hi");\n', fenced: true }
 *
 * const fallback = tryExtractCode('Sorry, I cannot write code.');
 * // { source: 'Sorry, I cannot write code.', fenced: false }
 * ```
 */
export function tryExtractCode(response: string,): ExtractResult {
  /** Match for a fully closed fenced block; preferred path so trailing prose outside the fence is dropped. */
  const closedFence = /```(?:typescript|ts)?\n([\s\S]*?)```/.exec(response,);
  if ((closedFence !== null) && (closedFence[1] !== undefined)) {
    return {
      source: closedFence[1],
      fenced: true,
    };
  }

  /** Fallback match for a fence whose closing backticks were truncated; salvages mid-stream output. */
  const openFence = /```(?:typescript|ts)?\n([\s\S]*)/.exec(response,);
  if ((openFence !== null) && (openFence[1] !== undefined)) {
    return {
      source: openFence[1],
      fenced: true,
    };
  }

  return {
    source: response,
    fenced: false,
  };
}

/**
 * Extracts TypeScript code from a model response, stripping markdown fences.
 * Handles both closed fences and unclosed fences (model truncated its output).
 *
 * Use {@link tryExtractCode} when you need to know whether extraction succeeded.
 *
 * @param response - raw model output that may contain markdown code blocks
 *
 * @returns extracted TypeScript source, or the raw response if no fences found
 *
 * @example
 * ```ts
 * extractCode('```typescript\nconst x = 1;\n```'); // "const x = 1;\n"
 * ```
 */
export function extractCode(response: string,): string {
  return tryExtractCode(response,).source;
}
