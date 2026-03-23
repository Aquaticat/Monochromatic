/**
 * Shared style tokens for editor popup and viewer components.
 *
 * Font, border, and layout constants extracted from individual
 * popup style modules to eliminate cross-file duplication.
 */

import {
  cssCommaList,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';

/** Font size in rem: 13/16. */
export const POPUP_FONT_SIZE = (16 - 2 - 1) / 16;

/** Line height multiplier: 3/2. */
export const CODE_LINE_HEIGHT = (2 + 1) / 2;

/** Border radius in rem: 1/4. */
export const POPUP_BORDER_RADIUS = 1 / (2 * 2);

/** Monospace font stack for editor components. */
export const MONO_FONT_FAMILY = cssCommaList(["'JetBrains Mono'", 'monospace',],);

/**
 * Shared popup border declarations.
 * Spread into a `decls` object to apply the standard popup border.
 *
 * @example
 * ```ts
 * $({
 *   rule: ':host',
 *   decls: { ...POPUP_BORDER_DECLS, color: cssVar('fg') },
 * })
 * ```
 */
export const POPUP_BORDER_DECLS = {
  'border-block-width': cssRem(1 / 16,),
  'border-block-style': 'solid' as const,
  'border-block-color': cssVar('hover-border',),
  'border-inline-width': cssRem(1 / 16,),
  'border-inline-style': 'solid' as const,
  'border-inline-color': cssVar('hover-border',),
};
