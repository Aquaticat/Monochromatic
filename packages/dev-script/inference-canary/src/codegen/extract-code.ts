/**
 * Extracts TypeScript source from model responses that may contain markdown fences.
 */

/**
 * Result of attempting to extract code from a model response
 */
export type ExtractResult = {
  /**
   * Extracted TypeScript source (from a code block, or the raw response as fallback)
   */
  readonly source: string;
  /**
   * Whether a code block was found in the response.
   * When false, `source` is the raw response text; the model did not produce
   * a fenced code block and the "source" is likely prose, not valid TypeScript.
   */
  readonly fenced: boolean;
};

/**
 * Optional language tags accepted between the opening backticks and the newline.
 */
const FENCE_LANG_TAGS: readonly string[] = [
  'typescript',
  'ts',
  '',
];

/**
 * Finds the first opening markdown fence (three backticks, optionally
 * followed by `typescript` or `ts`, then a newline) and returns the byte
 * offset just past the newline, or `-1` when no such fence exists.
 *
 * @param response - raw model output
 *
 * @returns byte offset immediately after the opening fence, or `-1`
 */
function findOpeningFenceEnd(response: string,): number {
  /**
   * Position of the first triple-backtick; `-1` ends the search.
   */
  const tickIdx = response.indexOf('```',);
  if (tickIdx === (-1))
    return -1;
  /**
   * Cursor at the byte immediately after the backticks.
   */
  const afterTicks = tickIdx + '```'
    .length;
  /**
   * Walks the language-tag alternatives, returning the first tag that
   * matches the substring after the backticks.
   *
   * @param idx - cursor into `FENCE_LANG_TAGS`
   *
   * @returns byte offset of the newline byte, or `-1` when no tag matches
   */
  function tryLangTag(idx: number,): number {
    if (idx >= FENCE_LANG_TAGS
      .length)
      return -1;
    /**
     * Candidate language tag; empty string represents the no-tag form.
     */
    const tag = FENCE_LANG_TAGS[idx]
      ?? '';
    /**
     * Cursor immediately after the candidate tag in `response`.
     */
    const after = afterTicks + tag
      .length;
    if (
      (response.slice(
        afterTicks,
        after,
      )
        === tag) && (response.charAt(after,)
          === '\n')
    ) {
      return after + 1;
    }
    return tryLangTag(idx + 1,);
  }
  return tryLangTag(0,);
}

/**
 * Outcome of {@link extractFencedBody}: a captured body, or an explicit
 * "no fence" result. A discriminated result avoids a nullish return while
 * still distinguishing a genuinely empty body (`''`) from a missing fence.
 */
type FencedBodyResult =
  | {
    /**
     * A matching fence was found.
     */
    readonly found: true;
    /**
     * Captured body text between the fences (may be empty).
     */
    readonly body: string;
  }
  | {
    /**
     * No matching fence exists in the response.
     */
    readonly found: false;
  };

/**
 * Extracts the body of a fenced code block bounded by triple-backtick
 * fences. When `closing` is true the closing fence terminates the body;
 * when false the body extends to the end of `response` (salvages
 * mid-stream output when the model truncated).
 *
 * @param response - raw model output
 *
 * @param closing - whether to require a closing triple-backtick fence
 *
 * @returns captured body result, or `{ found: false }` when no matching fence exists
 */
function extractFencedBody({
  response,
  closing,
}: {
  readonly response: string;
  readonly closing: boolean;
},): FencedBodyResult {
  /**
   * Byte offset just past the opening fence; `-1` means no fence at all.
   */
  const bodyStart = findOpeningFenceEnd(response,);
  if (bodyStart === (-1))
    return { found: false, };
  if (!closing)
    return {
      found: true,
      body: response.slice(bodyStart,),
    };
  /**
   * Position of the closing backticks; `-1` means the fence is unterminated.
   */
  const closeIdx = response.indexOf(
    '```',
    bodyStart,
  );
  if (closeIdx === (-1))
    return { found: false, };
  return {
    found: true,
    body: response.slice(
      bodyStart,
      closeIdx,
    ),
  };
}

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
  /**
   * Closing-aware fenced extraction; returns the body when both opening
   * and closing fences exist so trailing prose outside the fence is dropped.
   */
  const closed = extractFencedBody({
    response,
    closing: true,
  },);
  if (closed.found) {
    return {
      source: closed.body,
      fenced: true,
    };
  }

  /**
   * Open-fence fallback; salvages mid-stream output when the model truncated.
   */
  const open = extractFencedBody({
    response,
    closing: false,
  },);
  if (open.found) {
    return {
      source: open.body,
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
  return tryExtractCode(response,)
    .source;
}
