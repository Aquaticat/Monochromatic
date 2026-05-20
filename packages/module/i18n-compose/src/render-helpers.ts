/**
 * Small rendering helpers shared across locale renderers.
 *
 * Keep functions in this module locale-agnostic; anything tied to one
 * locale's grammar belongs in that locale's module.
 *
 * @module
 */

import type { Capitalization, } from './grammar-primitives.ts';

/**
 * Identifiers that must never have their first character recased by
 * {@link applyCapitalization}.
 *
 * English `I` is the canonical example: capitalizing it is correct
 * regardless of position, and lowercasing it would surface as `i`. The
 * set is populated by the renderer (English adds `I`); locales that do
 * not need the protection pass an empty set.
 */
export type CaseInvariantSet = ReadonlySet<string>;

/**
 * Options accepted by {@link applyCapitalization}.
 */
type ApplyCapitalizationOptions = Readonly<{
  readonly text: string;
  readonly mode: Capitalization | undefined;
  readonly caseInvariants: ReadonlySet<string>;
}>;

/**
 * Applies a {@link Capitalization} mode to a rendered string.
 *
 * Only the first character of the first token is touched. Tokens whose
 * exact surface matches a member of `caseInvariants` (e.g. English `I`)
 * are preserved as-is.
 *
 * @param options - text, capitalization mode, and case-invariant token set
 *
 * @returns capitalized string
 *
 * @example
 * ```ts
 * applyCapitalization({ text: 'the cat', mode: 'firstLetter', caseInvariants: new Set() }); // 'The cat'
 * applyCapitalization({ text: 'I run',   mode: 'firstLetter', caseInvariants: new Set(['I']) }); // 'I run'
 * ```
 */
export function applyCapitalization(
  options: ApplyCapitalizationOptions,
): string {
  /** Options destructured once so the branch logic reads like the rendered operation. */
  const {
    text,
    mode,
    caseInvariants,
  } = options;
  if ((mode === undefined) || (mode === 'preserve'))
    return text;
  if (text.length === 0)
    return text;
  /** First whitespace-delimited token, used to consult `caseInvariants`. */
  const firstSpace = text.indexOf(' ',);
  /** Substring covering the first token only. */
  const firstToken = firstSpace === (-1) ? text : text.slice(
    0,
    firstSpace,
  );
  if (caseInvariants.has(firstToken,))
    return text;
  /** First Unicode code point of the rendered text. */
  const firstChar = text.charAt(0,);
  return firstChar.toUpperCase() + text.slice(1,);
}

/**
 * Concatenates tokens with single ASCII spaces, dropping empty entries.
 *
 * Renderers typically emit a token list per sentence component and then
 * join them with this helper so a missing optional slot (no adverbials,
 * no object) does not surface as a doubled space.
 *
 * @param tokens - ordered token list; falsy entries are skipped
 *
 * @returns space-joined string
 *
 * @example
 * ```ts
 * joinTokens(['Do', 'I', 'have', '1 cat']); // 'Do I have 1 cat'
 * joinTokens(['Save', undefined, 'now']);   // 'Save now'
 * ```
 */
export function joinTokens(tokens: readonly (string | undefined)[],): string {
  /** Filtered token list with truthy entries only, preserved order. */
  const kept: string[] = [];
  for (const token of tokens) {
    if ((token !== undefined) && (token !== ''))
      kept.push(token,);
  }
  return kept.join(' ',);
}
