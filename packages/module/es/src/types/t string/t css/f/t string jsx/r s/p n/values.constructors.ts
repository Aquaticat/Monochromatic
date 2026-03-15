/**
 * CSS value constructor functions that produce branded {@link CssValue} strings.
 *
 * Each constructor returns a `CssValue` — a branded string that the strict
 * `CssDeclarations` type accepts in any property value position.
 */

import type { CssValue, } from './values.ts';

//region Length constructors

/**
 * Creates a `rem` length value.
 *
 * `rem` is the primary length unit — relative to root font size, predictable across contexts.
 *
 * @param n - numeric value
 *
 * @returns branded CSS length string (e.g. `'1.5rem'`)
 *
 * @example
 * ```ts
 * cssRem(1)     // '1rem'
 * cssRem(0.25)  // '0.25rem'
 * ```
 */
export function cssRem(n: number,): CssValue {
  return `${n}rem` as CssValue;
}

/**
 * Creates an `em` length value.
 *
 * `em` is relative to the element's font size — use for font-relative spacing.
 *
 * @param n - numeric value
 *
 * @returns branded CSS length string (e.g. `'1em'`)
 */
export function cssEm(n: number,): CssValue {
  return `${n}em` as CssValue;
}

/**
 * Creates a percentage value.
 *
 * @param n - numeric value (e.g. `50` for `50%`)
 *
 * @returns branded CSS percentage string (e.g. `'50%'`)
 */
export function cssPercent(n: number,): CssValue {
  return `${n}%` as CssValue;
}

/**
 * Creates an `fr` flex fraction value (for CSS Grid).
 *
 * @param n - numeric value
 *
 * @returns branded CSS flex string (e.g. `'1fr'`)
 */
export function cssFr(n: number,): CssValue {
  return `${n}fr` as CssValue;
}

/**
 * Creates an `lh` line-height-relative length value.
 *
 * @param n - numeric value
 *
 * @returns branded CSS length string (e.g. `'1.5lh'`)
 */
export function cssLh(n: number,): CssValue {
  return `${n}lh` as CssValue;
}

/**
 * Creates a `vi` viewport-inline length value (logical viewport unit).
 *
 * @param n - numeric value
 *
 * @returns branded CSS length string (e.g. `'100vi'`)
 */
export function cssVi(n: number,): CssValue {
  return `${n}vi` as CssValue;
}

/**
 * Creates a `vb` viewport-block length value (logical viewport unit).
 *
 * @param n - numeric value
 *
 * @returns branded CSS length string (e.g. `'100vb'`)
 */
export function cssVb(n: number,): CssValue {
  return `${n}vb` as CssValue;
}

/**
 * Creates a `cqi` container-query-inline length value (logical container unit).
 *
 * @param n - numeric value
 *
 * @returns branded CSS length string (e.g. `'50cqi'`)
 */
export function cssCqi(n: number,): CssValue {
  return `${n}cqi` as CssValue;
}

/**
 * Creates a `cqb` container-query-block length value (logical container unit).
 *
 * @param n - numeric value
 *
 * @returns branded CSS length string (e.g. `'50cqb'`)
 */
export function cssCqb(n: number,): CssValue {
  return `${n}cqb` as CssValue;
}

//endregion

//region Dynamic viewport constructors

/**
 * Creates a `dvb` dynamic-viewport-block length value (logical dynamic viewport unit).
 *
 * `dvb` adapts to the dynamic viewport size (accounts for browser chrome that
 * appears/disappears, e.g. mobile address bar). Logical equivalent of `dvh`
 * in horizontal writing modes.
 *
 * @param n - numeric value
 *
 * @returns branded CSS length string (e.g. `'100dvb'`)
 *
 * @example
 * ```ts
 * cssDvb(100)  // '100dvb'
 * ```
 */
export function cssDvb(n: number,): CssValue {
  return `${n}dvb` as CssValue;
}

/**
 * Creates a `dvi` dynamic-viewport-inline length value (logical dynamic viewport unit).
 *
 * `dvi` adapts to the dynamic viewport size. Logical equivalent of `dvw`
 * in horizontal writing modes.
 *
 * @param n - numeric value
 *
 * @returns branded CSS length string (e.g. `'100dvi'`)
 *
 * @example
 * ```ts
 * cssDvi(100)  // '100dvi'
 * ```
 */
export function cssDvi(n: number,): CssValue {
  return `${n}dvi` as CssValue;
}

//endregion

//region Time constructors

/**
 * Creates a seconds time value.
 *
 * `s` is the only allowed time unit (milliseconds are banned).
 *
 * @param n - numeric value
 *
 * @returns branded CSS time string (e.g. `'0.3s'`)
 */
export function cssS(n: number,): CssValue {
  return `${n}s` as CssValue;
}

//endregion

//region Angle constructors

/**
 * Creates a `turn` angle value.
 *
 * `turn` is the only allowed angle unit (`deg` and `rad` are banned).
 *
 * @param n - numeric value (1 = full rotation)
 *
 * @returns branded CSS angle string (e.g. `'0.25turn'`)
 */
export function cssTurn(n: number,): CssValue {
  return `${n}turn` as CssValue;
}

//endregion

//region Color constructors

/**
 * Creates an `oklch()` color value.
 *
 * `oklch()` is the primary color function — perceptually uniform, wide gamut.
 * All other color functions (`rgb`, `hsl`, `hwb`, `lab`, `lch`, `oklab`) are banned.
 *
 * @param l - lightness (0 to 1)
 *
 * @param c - chroma (0 to ~0.4)
 *
 * @param h - hue (0 to 360)
 *
 * @param a - alpha (0 to 1, optional)
 *
 * @returns branded CSS color string (e.g. `'oklch(0.5 0.2 250)'`)
 *
 * @example
 * ```ts
 * cssOklch({ l: 0.5, c: 0.2, h: 250 })        // 'oklch(0.5 0.2 250)'
 * cssOklch({ l: 0.5, c: 0.2, h: 250, a: 0.5 }) // 'oklch(0.5 0.2 250 / 0.5)'
 * ```
 */
export function cssOklch(
  { l, c, h, a, }: { l: number; c: number; h: number; a?: number; },
): CssValue {
  if (a !== undefined)
    return `oklch(${l} ${c} ${h} / ${a})` as CssValue;

  return `oklch(${l} ${c} ${h})` as CssValue;
}

/**
 * Creates a `color()` function value for wide-gamut color spaces.
 *
 * Use when `oklch()` is insufficient and a specific color space is needed
 * (e.g. `display-p3`, `srgb-linear`, `a98-rgb`).
 *
 * @param space - color space name (e.g. `'display-p3'`, `'srgb'`)
 *
 * @param channels - space-separated channel values
 *
 * @param a - alpha (0 to 1, optional)
 *
 * @returns branded CSS color string
 *
 * @example
 * ```ts
 * cssColorFn({ space: 'display-p3', channels: '1 0 0' })
 * // 'color(display-p3 1 0 0)'
 * ```
 */
export function cssColorFn(
  { space, channels, a, }: { space: string; channels: string; a?: number; },
): CssValue {
  if (a !== undefined)
    return `color(${space} ${channels} / ${a})` as CssValue;

  return `color(${space} ${channels})` as CssValue;
}

//endregion

//region Reference constructors

/**
 * Creates a `var()` custom property reference.
 *
 * @param name - custom property name WITHOUT the `--` prefix
 *
 * @returns branded CSS var reference (e.g. `'var(--fg)'`)
 *
 * @example
 * ```ts
 * cssVar('fg')         // 'var(--fg)'
 * cssVar('min-gap')    // 'var(--min-gap)'
 * ```
 */
export function cssVar(name: string,): CssValue {
  return `var(--${name})` as CssValue;
}

/**
 * Creates a `calc()` expression.
 *
 * Accepts a raw expression string — use other constructors inside template literals
 * for the operands, then wrap with `cssCalc()`.
 *
 * @param expr - calc expression (e.g. `'1rem + 2rem'`, `'100% - 3rem'`)
 *
 * @returns branded CSS calc expression
 *
 * @example
 * ```ts
 * cssCalc('1rem + 2rem')      // 'calc(1rem + 2rem)'
 * cssCalc('100% - 3rem')      // 'calc(100% - 3rem)'
 * cssCalc('1 / 16 * 1rem')    // 'calc(1 / 16 * 1rem)'
 * ```
 */
export function cssCalc(expr: string,): CssValue {
  return `calc(${expr})` as CssValue;
}

//endregion

//region Number constructors

/**
 * Creates a unitless number value (for properties like `opacity`, `flex-grow`, `line-height`).
 *
 * @param n - numeric value
 *
 * @returns branded CSS number string (e.g. `'0.5'`)
 */
export function cssNum(n: number,): CssValue {
  return `${n}` as CssValue;
}

/**
 * Creates a unitless integer value (for properties like `z-index`, `order`, `column-count`).
 *
 * @param n - integer value
 *
 * @returns branded CSS integer string (e.g. `'10'`)
 */
export function cssInt(n: number,): CssValue {
  return `${Math.round(n,)}` as CssValue;
}

//endregion

//region Transform function constructors

/**
 * Creates a `translateX()` transform value.
 *
 * @param offset - horizontal translation (branded CSS value from a length/percentage constructor)
 *
 * @returns branded CSS transform string (e.g. `'translateX(-50%)'`)
 *
 * @example
 * ```ts
 * cssTranslateX(cssPercent(-50))  // 'translateX(-50%)'
 * cssTranslateX(cssRem(2))        // 'translateX(2rem)'
 * ```
 */
export function cssTranslateX(offset: CssValue,): CssValue {
  return `translateX(${offset})` as CssValue;
}

/**
 * Creates a `translateY()` transform value.
 *
 * @param offset - vertical translation (branded CSS value from a length/percentage constructor)
 *
 * @returns branded CSS transform string (e.g. `'translateY(-50%)'`)
 *
 * @example
 * ```ts
 * cssTranslateY(cssPercent(-50))  // 'translateY(-50%)'
 * ```
 */
export function cssTranslateY(offset: CssValue,): CssValue {
  return `translateY(${offset})` as CssValue;
}

/**
 * Creates a `rotate()` transform value.
 *
 * @param angle - rotation angle (branded CSS value from `cssTurn` or another angle constructor)
 *
 * @returns branded CSS transform string (e.g. `'rotate(-0.125turn)'`)
 *
 * @example
 * ```ts
 * cssRotate(cssTurn(-0.125))  // 'rotate(-0.125turn)'
 * cssRotate(cssTurn(0.25))    // 'rotate(0.25turn)'
 * ```
 */
export function cssRotate(angle: CssValue,): CssValue {
  return `rotate(${angle})` as CssValue;
}

/**
 * Creates a `scale()` transform value.
 *
 * @param factor - scale factor (unitless number)
 *
 * @returns branded CSS transform string (e.g. `'scale(0.15)'`)
 *
 * @example
 * ```ts
 * cssScale(0.15)  // 'scale(0.15)'
 * cssScale(1)     // 'scale(1)'
 * ```
 */
export function cssScale(factor: number,): CssValue {
  return `scale(${factor})` as CssValue;
}

//endregion

//region Composition constructors

/**
 * Creates a `cubic-bezier()` easing function value.
 *
 * `cubic-bezier()` defines a custom timing curve for CSS animations and transitions.
 * The four values are the x/y coordinates of the two control points (P1 and P2).
 *
 * @param values - four control point coordinates `[x1, y1, x2, y2]`
 *
 * @returns branded CSS timing function string (e.g. `'cubic-bezier(0.4, 0, 0.2, 1)'`)
 *
 * @example
 * ```ts
 * cssCubicBezier([0.4, 0, 0.2, 1])  // 'cubic-bezier(0.4, 0, 0.2, 1)'
 * cssCubicBezier([0, 0, 0.2, 1])    // 'cubic-bezier(0, 0, 0.2, 1)'
 * ```
 */
export function cssCubicBezier(values: readonly number[],): CssValue {
  return `cubic-bezier(${values.join(', ',)})` as CssValue;
}

/**
 * Creates a comma-separated CSS value list.
 *
 * Joins items with `, ` — use for multi-value properties like `font-family`,
 * `transition-property`, `animation-name` (multiple), or `background-image`.
 *
 * @param values - list items (branded CSS values or plain identifier strings)
 *
 * @returns branded CSS comma-separated list
 *
 * @example
 * ```ts
 * cssCommaList(['Inter', 'system-ui', 'sans-serif'])
 * // 'Inter, system-ui, sans-serif'
 *
 * cssCommaList(['inset-inline-start', 'inset-inline-end'])
 * // 'inset-inline-start, inset-inline-end'
 * ```
 */
export function cssCommaList(values: readonly (CssValue | string)[],): CssValue {
  return values.join(', ',) as CssValue;
}

/**
 * Creates a space-separated compound CSS value.
 *
 * Joins items with ` ` — use for multi-part values like `box-shadow`,
 * `transform-origin`, `grid-template`, or any property that takes
 * space-separated components.
 *
 * @param values - value parts (branded CSS values, keyword strings, or numbers)
 *
 * @returns branded CSS compound value
 *
 * @example
 * ```ts
 * cssCompounded(['bottom', 'right'])
 * // 'bottom right'
 *
 * cssCompounded([0, cssRem(-0.25), cssRem(1), cssOklch({ l: 0, c: 0, h: 0, a: 0.2 })])
 * // '0 -0.25rem 1rem oklch(0 0 0 / 0.2)'
 * ```
 */
export function cssCompounded(
  values: readonly (CssValue | string | number)[],
): CssValue {
  return values.join(' ',) as CssValue;
}

//endregion
