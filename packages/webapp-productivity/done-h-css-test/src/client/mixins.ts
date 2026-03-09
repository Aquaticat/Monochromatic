/**
 * Shared CSS mixin functions for web component Shadow DOM styles.
 *
 * Replaces the PostCSS `@mixin`/`@apply` pipeline with plain TypeScript
 * functions that return declaration records. Composed via object spread.
 */
import type { CssDeclarations } from "@monochromatic-dev/module-es/h-css";

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
    'border-radius': '62.5rem',
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
    'padding-block': '0',
    'padding-inline': '0',
    font: 'inherit',
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
    'min-inline-size': '3rem',
    'min-block-size': '3rem',
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
    gap: 'var(--min-gap)',
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
    gap: '0.5rem',
    'border-width': 'calc(1 / 16 * 1rem)',
    'border-style': 'solid',
    'border-color': 'var(--fg)',
    'padding-block': '0.5rem',
    'padding-inline': '0.5rem',
    'background-color': 'transparent',
    color: 'var(--fg)',
    font: 'inherit',
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
    gap: 'var(--min-gap)',
    'block-size': '3rem',
    'padding-block': '0',
    'padding-inline': 'var(--min-padding)',
    'background-color': 'var(--bg)',
    position: 'sticky',
    'inset-block-start': '0',
    'z-index': '10',
  };
}

//endregion Composed patterns

//region Focus outline

/**
 * Standard focus-visible outline declarations.
 *
 * @param offset - Outline offset value (default `'0.125rem'`)
 * @returns Declarations for focus outline
 */
export function focusOutline({ offset = '0.125rem' }: { offset?: string } = {}): CssDeclarations {
  return {
    'outline-width': '0.125rem',
    'outline-style': 'solid',
    'outline-color': 'var(--fg)',
    'outline-offset': offset,
  };
}

//endregion Focus outline
