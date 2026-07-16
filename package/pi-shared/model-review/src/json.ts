/**
 * Balanced JSON extraction for direct reviewer retries.
 *
 * @module
 */

/**
 * Maximum reviewer text copied into malformed-output diagnostics.
 */
const REVIEW_TEXT_DIAGNOSTIC_LIMIT = 200;

/**
 * Locate first balanced JSON object while ignoring braces inside strings.
 *
 * @param text - reviewer output to scan
 *
 * @returns complete object text or empty string
 *
 * @example
 * ```ts
 * findBalancedJsonObject('prefix {"approved":true} suffix');
 * ```
 */
function findBalancedJsonObject(text: string,): string {
  /**
   * Opening object delimiter.
   */
  const start = text.indexOf('{',);
  if (start === (-1))
    return '';

  /* oxlint-disable no-restricted-syntax/no-function-root-let -- Linear JSON boundary scanner updates constant-space cursor state. */
  /**
   * Object nesting depth.
   */
  let depth = 0;
  /**
   * Whether cursor is inside JSON string.
   */
  let inString = false;
  /**
   * Whether current string character is escaped.
   */
  let escaped = false;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  for (let cursor = start; cursor < text.length; cursor++) {
    /**
     * Character at current scanner cursor.
     */
    const character = text[cursor];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (character === '\\')
        escaped = true;
      else if (character === '"')
        inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') {
      depth++;
      continue;
    }
    if (character !== '}')
      continue;
    depth--;
    if (depth === 0)
      return text.slice(
        start,
        cursor + 1,
      );
  }
  return '';
}

/**
 * Parse whole reviewer output or first balanced JSON object.
 *
 * @param text - direct-JSON reviewer output
 *
 * @returns parsed unknown JSON value
 *
 * @throws when output contains no parseable object
 *
 * @example
 * ```ts
 * extractStructuredJson('{"approved":false,"feedback":"missing test"}');
 * ```
 */
function extractStructuredJson(text: string,): unknown {
  try {
    return JSON.parse(text,);
  }
  catch (error) {
    void error;
  }
  /**
   * First balanced object candidate.
   */
  const block = findBalancedJsonObject(text,);
  if (block === '') {
    throw new Error(
      `Structured reviewer returned text without JSON object: ${text.slice(
        0,
        REVIEW_TEXT_DIAGNOSTIC_LIMIT,
      )}`,
    );
  }
  return JSON.parse(block,);
}

export {
  extractStructuredJson,
  findBalancedJsonObject,
};
