/**
 * Syntax highlighting wrapper around nue-glow.
 *
 * Produces static HTML with semantic tags (`<b>` for keywords, `<em>` for strings,
 * `<sup>` for comments, `<strong>` for tag names, `<i>` for operators).
 * Styled via glow.css -- no client-side JavaScript required.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- nue-glow ships without type declarations
// @ts-expect-error -- nue-glow has no TypeScript type declarations
import { glow, } from 'nue-glow';

/**
 * Highlights TypeScript source code to static HTML.
 * Returns a `<code>` element with numbered lines and semantic token tags.
 * @param source - raw TypeScript source code
 * @returns HTML string ready to embed in a `<pre>` wrapper
 *
 * @example
 * ```ts
 * highlightTs('const x = 1;');
 * // '<code language="js"><span><b>const</b> ...</span></code>'
 * ```
 */
export function highlightTs(source: string): string {
  return glow(source, { language: 'js', numbered: true, }) as string;
}
