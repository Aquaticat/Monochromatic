/**
 * Helper that resolves a Material Symbols icon name to its PUA codepoint.
 *
 * Components call `icon('info')` at render time; the returned string is
 * embedded directly in the HTML as the `<span class="material-symbols-outlined">`
 * child. Using PUA codepoints (instead of the ligature name) is what
 * lets the font subsetter in `src/build/subset-fonts.ts` keep only the
 * specific icon glyphs actually in use.
 *
 * The subsetter also recognises `icon('NAME')` call sites in source
 * files as the canonical list of icons to preserve. Keep call-site
 * arguments as string literals (no `icon(variableName)`) so the regex
 * scan sees them.
 *
 * @example
 * ```ts
 * import { icon, } from '../lib/icon/icon.ts';
 * // inside an h-template:
 * h({
 *   tag: 'span',
 *   class: 'material-symbols-outlined',
 *   text: icon('info'),
 * });
 * ```
 */
import { ICON_CODEPOINTS, } from './codepoints.ts';

/**
 * Resolves a Material Symbols Outlined icon name to its single-codepoint string.
 *
 * @param name - snake_case ligature name (e.g. `'info'`, `'priority_high'`)
 *
 * @returns single-codepoint string in the PUA range
 *
 * @throws when `name` is not present in the upstream codepoints data
 *
 * @example
 * ```ts
 * icon('info'); // '\ue88e'
 * ```
 */
export function icon(name: string,): string {
  /**
   * Lookup separated from the existence check so the error path can name the missing key.
   */
  const codepoint = ICON_CODEPOINTS[name];
  if (codepoint === undefined)
    throw new Error(`Unknown Material Symbols Outlined icon: ${name}`,);
  return codepoint;
}
