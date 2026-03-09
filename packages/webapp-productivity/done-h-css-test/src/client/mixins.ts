/**
 * Shared CSS mixin functions for web component Shadow DOM styles.
 *
 * Replaces the PostCSS `@mixin`/`@apply` pipeline with plain TypeScript
 * functions that return declaration records. Composed via object spread.
 */
import type { CssDeclarations, CssValue } from "@monochromatic-dev/module-es/h-css";
import { cssCalc, cssRem, cssVar, cssInt } from "@monochromatic-dev/module-es/h-css";

//region Layout primitives

/**
 * Flexbox centering on both axes.
 *
 * @returns Declarations for centered flex container
 *
 * @example
 * ```ts
 * $({ rule: '.icon', decls: { ...flexCenter(), 'font-size': '2rem' } })
 * ```
 */
export function flexCenter(): CssDeclarations {
  return {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
  };
}

/**
 * Horizontal flex row with vertically centered items.
 *
 * @returns Declarations for row flex container
 */
export function flexRow(): CssDeclarations {
  return {
    display: 'flex',
    'align-items': 'center',
  };
}

/**
 * Vertical flex column.
 *
 * @returns Declarations for column flex container
 */
export function flexColumn(): CssDeclarations {
  return {
    display: 'flex',
    'flex-direction': 'column',
  };
}

//endregion Layout primitives

//region Visual primitives

/**
 * Fully-rounded corners (pill / circle shape).
 *
 * @returns Border-radius declaration
 */
export function borderRadiusFull(): CssDeclarations {
  return {
    'border-radius': cssRem(62.5),
  };
}

/**
 * Prevents text wrapping.
 *
 * @returns White-space declaration
 */
export function whitespaceNowrap(): CssDeclarations {
  return {
    'white-space': 'nowrap',
  };
}

/**
 * Hides the scrollbar while preserving scroll behavior.
 *
 * @returns Scrollbar-width declaration
 */
export function scrollbarHidden(): CssDeclarations {
  return {
    'scrollbar-width': 'none',
  };
}

//endregion Visual primitives

//region Interactive primitives

/**
 * Strips all browser-default button/anchor chrome.
 *
 * @returns Declarations for unstyled interactive element
 */
export function appearanceNone(): CssDeclarations {
  return {
    'background-color': 'transparent',
    'border-style': 'none',
    cursor: 'pointer',
    'padding-block': 0,
    'padding-inline': 0,
    'font-family': 'inherit',
    'font-size': 'inherit',
    'font-style': 'inherit',
    'font-weight': 'inherit',
    'line-height': 'inherit',
    color: 'inherit',
  };
}

/**
 * Ensures the element meets the 48px (3rem) minimum touch target
 * (Material Design) while allowing it to grow if content demands.
 *
 * @returns Min size declarations
 */
export function minTouchTarget(): CssDeclarations {
  return {
    'min-inline-size': cssRem(3),
    'min-block-size': cssRem(3),
  };
}

/**
 * Light-DOM global resets that shadow DOM cannot inherit.
 *
 * Applied once at the top level of each component's style string
 * so every shadow tree gets consistent disabled and placeholder styling
 * without repeating the declarations in every component.
 *
 * @returns Array of CSS rule strings for shadow DOM globals
 */
export function shadowDomGlobals(): string[] {
  return [
    'button:disabled{opacity:0.45;cursor:not-allowed}',
    'input::placeholder,textarea::placeholder{color:var(--medium)}',
  ];
}

//endregion Interactive primitives

//region Composed patterns

/**
 * Horizontally scrollable row of inline items.
 *
 * @returns Declarations for scroll row
 */
export function scrollRow(): CssDeclarations {
  return {
    display: 'flex',
    gap: cssVar('min-gap'),
    'align-items': 'flex-start',
    'overflow-x': 'auto',
    'overflow-y': 'clip',
    ...scrollbarHidden(),
  };
}

/**
 * Outlined interactive button with token-based colors.
 *
 * @returns Declarations for outlined button
 */
export function buttonOutlined(): CssDeclarations {
  return {
    ...flexCenter(),
    ...minTouchTarget(),
    gap: cssRem(0.5),
    'border-width': cssCalc(`${cssRem(1)} / 16`),
    'border-style': 'solid',
    'border-color': cssVar('fg'),
    'padding-block': cssRem(0.5),
    'padding-inline': cssRem(0.5),
    'background-color': 'transparent',
    color: cssVar('fg'),
    'font-family': 'inherit',
    'font-size': 'inherit',
    'font-style': 'inherit',
    'font-weight': 'inherit',
    'line-height': 'inherit',
    cursor: 'pointer',
  };
}

/**
 * Top-anchored sticky navigation bar.
 *
 * @returns Declarations for sticky bar
 */
export function stickyBar(): CssDeclarations {
  return {
    ...flexRow(),
    gap: cssVar('min-gap'),
    'block-size': cssRem(3),
    'padding-block': 0,
    'padding-inline': cssVar('min-padding'),
    'background-color': cssVar('bg'),
    position: 'sticky',
    'inset-block-start': 0,
    'z-index': cssInt(10),
  };
}

//endregion Composed patterns

//region Focus outline

/**
 * Standard focus-visible outline declarations.
 *
 * @param offset - Outline offset value (default `cssRem(0.125)`)
 * @returns Declarations for focus outline
 */
export function focusOutline({ offset = cssRem(0.125) }: { offset?: CssValue } = {}): CssDeclarations {
  return {
    'outline-width': cssRem(0.125),
    'outline-style': 'solid',
    'outline-color': cssVar('fg'),
    'outline-offset': offset,
  };
}

//endregion Focus outline
