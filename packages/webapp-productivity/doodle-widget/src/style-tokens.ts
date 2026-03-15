/**
 * Design tokens for the doodle widget CSS.
 *
 * Defines shared constants (spacing, colors, font weights, border radii)
 * consumed by style rule modules.
 */
import {
  cssDvb,
  cssNum,
  cssOklch,
  cssPercent,
  cssRem,
  type CssValue,
} from '@monochromatic-dev/module-es/h-css';

//region Fractional building blocks

/** Whole unit (100 for viewport/percent) */
const WHOLE = 100;

/** Bold font weight value */
const BOLD = 700;

/** 1/2 */
const HALF = 1 / 2;

/** 1/4 */
const QUARTER = HALF / 2;

/** 3/4 */
const THREE_QUARTERS = HALF + QUARTER;

/** 3/8 */
const THREE_EIGHTHS = THREE_QUARTERS / 2;

//endregion Fractional building blocks

//region Computed CSS values

/** Full dynamic viewport block size */
export const FULL_DVB: CssValue = cssDvb(WHOLE,);

/** Full percentage (100%) */
export const FULL_PERCENT: CssValue = cssPercent(WHOLE,);

/** Bold font weight */
export const FONT_WEIGHT_BOLD: CssValue = cssNum(BOLD,);

/** Standard toolbar gap between items */
export const TOOLBAR_GAP: CssValue = cssRem(THREE_QUARTERS,);

/** Vertical padding for toolbar */
export const TOOLBAR_PADDING_BLOCK: CssValue = cssRem(HALF,);

/** Horizontal padding for toolbar */
export const TOOLBAR_PADDING_INLINE: CssValue = cssRem(1,);

/** Vertical padding for buttons */
export const BUTTON_PADDING_BLOCK: CssValue = cssRem(THREE_EIGHTHS,);

/** Horizontal padding for buttons */
export const BUTTON_PADDING_INLINE: CssValue = cssRem(THREE_QUARTERS,);

/** Button corner radius */
export const BUTTON_RADIUS: CssValue = cssRem(QUARTER,);

/** Shared border color for toolbar controls */
export const BORDER_COLOR: CssValue = cssOklch({ l: 0.8, c: 0, h: 0, },);

//endregion Computed CSS values
