/**
 * Design tokens for paper2vn CSS.
 *
 * All sizing in `rem` (with `calc()` for derivation), all colors as
 * CSS custom properties so the design language can be retuned in one
 * place. No tokens emit `var(...)` fallbacks per project CSS rules.
 */
import {
  cssCalc,
  cssDvb,
  cssDvi,
  cssNum,
  cssPercent,
  cssRem,
  type CssValue,
} from '@monochromatic-dev/module-hyperscript/ts';

//region Fractional building blocks (max-magnitude 2 per project rules)

/** 1/2 */
const HALF = 1 / 2;

/** 1/4 */
const QUARTER = HALF / 2;

/** 3/4 */
const THREE_QUARTERS = HALF + QUARTER;

/** 1/8 */
const EIGHTH = QUARTER / 2;

//endregion

//region Whole-unit constants

/** Whole unit (100 for percent and viewport units) */
const WHOLE = 100;

/** Bold font weight literal */
const BOLD = 700;

/** Touch-target minimum in rem (48px equivalent at 16px root) */
const TOUCH_TARGET_REM = 3;

//endregion

//region Computed CSS values

/** Full dynamic viewport block size */
export const FULL_DVB: CssValue = cssDvb(WHOLE,);

/** Full dynamic viewport inline size */
export const FULL_DVI: CssValue = cssDvi(WHOLE,);

/** Full percentage (100%) */
export const FULL_PERCENT: CssValue = cssPercent(WHOLE,);

/** Bold weight */
export const FONT_WEIGHT_BOLD: CssValue = cssNum(BOLD,);

/** Quarter rem: smallest spacing unit */
export const SPACE_QUARTER: CssValue = cssRem(QUARTER,);

/** Half rem */
export const SPACE_HALF: CssValue = cssRem(HALF,);

/** Three-quarter rem */
export const SPACE_THREE_QUARTERS: CssValue = cssRem(THREE_QUARTERS,);

/** One rem */
export const SPACE_ONE: CssValue = cssRem(1,);

/** Two rem */
export const SPACE_TWO: CssValue = cssRem(2,);

/** Touch-target minimum size */
export const TOUCH_TARGET: CssValue = cssRem(TOUCH_TARGET_REM,);

/** Border radius: subtle */
export const RADIUS_SMALL: CssValue = cssRem(QUARTER,);

/** Border radius: pill / rounded */
export const RADIUS_LARGE: CssValue = cssRem(1,);

/** Half of full block (used for dialogue box max-block-size) */
export const HALF_DVB: CssValue = cssCalc(`${cssDvb(WHOLE,)} * ${HALF}`,);

/** Eighth rem: shadow offset */
export const SHADOW_OFFSET: CssValue = cssRem(EIGHTH,);

//endregion
