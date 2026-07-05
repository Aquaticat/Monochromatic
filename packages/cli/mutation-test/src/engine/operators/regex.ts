/**
 * Regex literal mutations: a bounded token-level subset.
 *
 * Stryker delegates its regex family to the weapon-regex library; porting
 * that is out of scope, so this family mutates a fixed token set in one
 * escape-aware linear pass: quantifier swaps, anchor drops, and escape
 * class negations. Documented as a reduced-scope family in the README.
 *
 * @example
 * ```ts
 * regexReplacements({ node, parent: undefined, source });
 * ```
 */

import type {
  EstreeNode,
  Replacement,
} from '../types.ts';

/**
 * Escape class negation swaps applied to `\\d`, `\\w`, `\\s` and their
 * negated forms.
 */
const ESCAPE_SWAPS: Readonly<Record<string, string>> = {
  d: 'D',
  D: 'd',
  w: 'W',
  W: 'w',
  s: 'S',
  S: 's',
};

/**
 * Unescaped single-character token swaps: quantifiers swap, anchors drop.
 */
const TOKEN_SWAPS: Readonly<Record<string, string>> = {
  '+': '*',
  '*': '+',
  '^': '',
  '$': '',
};

/**
 * Emits mutated regex literals for one Literal node carrying a regex.
 *
 * Each mutation rebuilds the whole literal text so the span splice stays
 * a single contiguous replacement.
 *
 * @param options - Node under inspection with parent and source.
 *
 * @returns Replacements, possibly empty.
 *
 * @example
 * ```ts
 * regexReplacements({ node: regexLiteral, parent: undefined, source });
 * ```
 */
export function regexReplacements(options: {
  readonly node: EstreeNode;
  readonly parent: EstreeNode | undefined;
  readonly source: string;
},): readonly Replacement[] {
  if (options.node.type !== 'Literal')
    return [];

  /**
   * Regex descriptor present only on regex literals.
   */
  const regex = options.node.regex as {
    readonly pattern?: string;
    readonly flags?: string;
  } | undefined;

  if ((regex === undefined) || ((typeof regex.pattern) !== 'string'))
    return [];

  /**
   * Original pattern text under mutation.
   */
  const pattern = regex.pattern as string;
  /**
   * Regex flags preserved across mutations.
   */
  const flags = regex.flags ?? '';
  /**
   * Collected replacements, one per mutated pattern variant.
   */
  const replacements: Replacement[] = [];
  /**
   * Scan cursor over the pattern text.
   */
  let cursor = 0;

  while (cursor < pattern.length) {
    /**
     * Character at the cursor.
     */
    const character = pattern[cursor] ?? '';

    if (character === '\\') {
      /**
       * Escaped character following the backslash.
       */
      const escaped = pattern[cursor + 1] ?? '';
      /**
       * Negated escape class for this escape, when applicable.
       */
      const negated = ESCAPE_SWAPS[escaped];

      if (negated !== undefined)
        replacements.push({
          start: options.node.start,
          end: options.node.end,
          text: `/${pattern.slice(
            0,
            cursor + 1,
          )}${negated}${pattern.slice(cursor + 2,)}/${flags}`,
          operator: 'regex',
          description: `negated \\${escaped} escape class`,
        },);

      cursor = cursor + 2;
      continue;
    }

    /**
     * Swap text for this unescaped token, when applicable.
     */
    const swap = TOKEN_SWAPS[character];

    if (swap !== undefined)
      replacements.push({
        start: options.node.start,
        end: options.node.end,
        text: `/${pattern.slice(
          0,
          cursor,
        )}${swap}${pattern.slice(cursor + 1,)}/${flags}`,
        operator: 'regex',
        description: swap === ''
          ? `dropped ${character} token`
          : `swapped ${character} with ${swap}`,
      },);

    cursor = cursor + 1;
  }

  return replacements;
}
