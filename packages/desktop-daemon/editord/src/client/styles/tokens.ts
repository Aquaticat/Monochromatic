/**
 * Shared style tokens for editor popup and viewer components.
 *
 * Font, border, and layout constants extracted from individual
 * popup style modules to eliminate cross-file duplication.
 */

import {
  cssCommaList,
  cssNum,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-hyperscript/ts';

/** Font size in rem: 13/16. */
export const POPUP_FONT_SIZE = (16 - 2 - 1) / 16;

/** Line height multiplier: 3/2. */
export const CODE_LINE_HEIGHT = (2 + 1) / 2;

/** Border radius in rem: 1/4. */
export const POPUP_BORDER_RADIUS = 1 / (2 * 2);

/** Monospace font stack for editor components. */
export const MONO_FONT_FAMILY = cssCommaList([
  "'JetBrains Mono'",
  'monospace',
],);

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

/**
 * Common `:host` declarations shared by all popup components.
 * Spread into a `:host` rule's `decls` alongside component-specific overrides.
 *
 * Covers: positioning reset, background, foreground, border, radius,
 * font family, font size, and line height.
 *
 * @example
 * ```ts
 * $({
 *   rule: ':host',
 *   decls: { ...POPUP_HOST_DECLS, position: 'fixed', overflow: 'auto' },
 * })
 * ```
 */
export const POPUP_HOST_DECLS = {
  inset: 'auto',
  margin: cssNum(0,),
  'background-color': cssVar('hover-bg',),
  color: cssVar('fg',),
  'border-radius': cssRem(POPUP_BORDER_RADIUS,),
  ...POPUP_BORDER_DECLS,
  'font-family': MONO_FONT_FAMILY,
  'font-size': cssRem(POPUP_FONT_SIZE,),
  'line-height': cssNum(CODE_LINE_HEIGHT,),
};
