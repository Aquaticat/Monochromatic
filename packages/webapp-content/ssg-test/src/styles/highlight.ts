/**
 * CSS rules for syntax highlighting via the CSS Custom Highlight API.
 *
 * Uses `::highlight(hl-<group>)` pseudo-elements styled by
 * `--hl-<group>` custom properties defined in `tokens.ts`.
 */

import {
  cssVar,
  hCss as $,
} from '@monochromatic-dev/module-hyperscript/ts';

/**
 * Generates `::highlight()` CSS rules for all syntax highlight groups.
 *
 * @returns CSS string with `::highlight(hl-*)` rules
 *
 * @example
 * ```ts
 * const css = highlightStyles();
 * // '::highlight(hl-keyword) { color: var(--hl-keyword); } ...'
 * ```
 */
export function highlightStyles(): string {
  return [
    $({
      rule: '::highlight(hl-keyword)',
      decls: { color: cssVar('hl-keyword',), },
    },),
    $({
      rule: '::highlight(hl-string)',
      decls: { color: cssVar('hl-string',), },
    },),
    $({
      rule: '::highlight(hl-comment)',
      decls: { color: cssVar('hl-comment',), },
    },),
    $({
      rule: '::highlight(hl-number)',
      decls: { color: cssVar('hl-number',), },
    },),
    $({
      rule: '::highlight(hl-type)',
      decls: { color: cssVar('hl-type',), },
    },),
    $({
      rule: '::highlight(hl-function)',
      decls: { color: cssVar('hl-function',), },
    },),
    $({
      rule: '::highlight(hl-property)',
      decls: { color: cssVar('hl-property',), },
    },),
    $({
      rule: '::highlight(hl-heading)',
      decls: { color: cssVar('hl-heading',), },
    },),
    $({
      rule: '::highlight(hl-link)',
      decls: {
        color: cssVar('hl-link',),
        'text-decoration': 'underline',
      },
    },),
    $({
      rule: '::highlight(hl-emphasis)',
      decls: { color: cssVar('hl-emphasis',), },
    },),
  ]
    .join('',);
}
