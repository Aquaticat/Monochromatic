/**
 * Light/dark color-scheme custom properties for the wc text-stats tool.
 *
 * Colors are CSS custom properties with light defaults, overridden inside a
 * `prefers-color-scheme: dark` block, so the page follows the OS theme
 * automatically with no client-side toggle.
 */
import {
  cssCompounded,
  cssOklch,
  hCss as $,
} from '@monochromatic-dev/module-hyperscript/ts';

/**
 * Light-theme foreground (body text) color.
 */
const LIGHT_FG = cssOklch(
  {
    l: 0.15,
    c: 0,
    h: 0,
  },
);

/**
 * Light-theme background color.
 */
const LIGHT_BG = cssOklch(
  {
    l: 1,
    c: 0,
    h: 0,
  },
);

/**
 * Light-theme muted text for descriptions and secondary labels.
 */
const LIGHT_MUTED = cssOklch(
  {
    l: 0.42,
    c: 0,
    h: 0,
  },
);

/**
 * Light-theme divider lines between frequency table rows.
 */
const LIGHT_DIVIDER = cssOklch(
  {
    l: 0.85,
    c: 0,
    h: 0,
  },
);

/**
 * Light-theme placeholder text color for the input textarea.
 */
const LIGHT_PLACEHOLDER = cssOklch(
  {
    l: 0.6,
    c: 0,
    h: 0,
  },
);

/**
 * Dark-theme foreground (body text) color.
 */
const DARK_FG = cssOklch(
  {
    l: 0.92,
    c: 0,
    h: 0,
  },
);

/**
 * Dark-theme background color.
 */
const DARK_BG = cssOklch(
  {
    l: 0.16,
    c: 0,
    h: 0,
  },
);

/**
 * Dark-theme muted text for descriptions and secondary labels.
 */
const DARK_MUTED = cssOklch(
  {
    l: 0.65,
    c: 0,
    h: 0,
  },
);

/**
 * Dark-theme divider lines between frequency table rows.
 */
const DARK_DIVIDER = cssOklch(
  {
    l: 0.32,
    c: 0,
    h: 0,
  },
);

/**
 * Dark-theme placeholder text color for the input textarea.
 */
const DARK_PLACEHOLDER = cssOklch(
  {
    l: 0.55,
    c: 0,
    h: 0,
  },
);

/**
 * Declares `:root`'s light-theme custom properties (the defaults) plus
 * `color-scheme: light dark` so native form controls (the textarea's
 * resize handle, scrollbars) also follow the OS theme.
 *
 * @returns CSS rule string for the `:root` custom-property declarations
 *
 * @example
 * ```ts
 * const rootColors = renderRootColors();
 * ```
 */
export function renderRootColors(): string {
  return $(
    {
      rule: ':root',
      decls: {
        'color-scheme': cssCompounded(
          [
            'light',
            'dark',
          ],
        ),
        '--color-fg': LIGHT_FG,
        '--color-bg': LIGHT_BG,
        '--color-muted': LIGHT_MUTED,
        '--color-divider': LIGHT_DIVIDER,
        '--color-placeholder': LIGHT_PLACEHOLDER,
      },
    },
  );
}

/**
 * Declares the `prefers-color-scheme: dark` override for every custom
 * property {@link renderRootColors} declares.
 *
 * @returns CSS at-rule string for the dark-theme override
 *
 * @example
 * ```ts
 * const darkColors = renderDarkColors();
 * ```
 */
export function renderDarkColors(): string {
  return $(
    {
      at: 'media',
      params: '(prefers-color-scheme: dark)',
      children: [
        $(
          {
            rule: ':root',
            decls: {
              '--color-fg': DARK_FG,
              '--color-bg': DARK_BG,
              '--color-muted': DARK_MUTED,
              '--color-divider': DARK_DIVIDER,
              '--color-placeholder': DARK_PLACEHOLDER,
            },
          },
        ),
      ],
    },
  );
}
