/**
 * Named highlight groups for the CSS Custom Highlight API.
 *
 * Shared between the build-time Lezer tag mapper (`tags.ts`) and the
 * client-side highlight registrar (`index.ts`). Extracted to its own
 * module so the client bundle can import the array without pulling in
 * `@lezer/highlight`.
 */

/**
 * Named highlight groups used with the CSS Custom Highlight API.
 * Each group gets a `::highlight(hl-<name>)` CSS rule and a `--hl-<name>` color variable.
 */
export const HIGHLIGHT_GROUPS = [
  'keyword',
  'string',
  'comment',
  'number',
  'type',
  'function',
  'property',
  'heading',
  'link',
  'emphasis',
] as const;

/**
 * Union type of all highlight group names.
 */
export type HighlightGroup = typeof HIGHLIGHT_GROUPS[number];
