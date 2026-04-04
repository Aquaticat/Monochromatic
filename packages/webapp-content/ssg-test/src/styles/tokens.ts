/**
 * Design token CSS custom properties.
 *
 * Defines all color tokens as a `:root` block with dark mode overrides.
 * Every color value in the site references these tokens via `var(--token-name)`.
 */
import { hCss as $, } from '@monochromatic-dev/module-hyperscript/ts';

/**
 * Generates the `:root` block with all color custom properties.
 *
 * @returns CSS string with custom property declarations
 */
export function tokenStyles(): string {
  return $({
    rule: ':root',
    decls: {
      '--color-fg': '#1a1a1a',
      '--color-bg': '#fafafa',
      '--color-link': '#0066cc',
      '--color-link-visited': '#551a8b',
      '--color-code-bg': '#f5f5f5',
      '--color-border': '#e0e0e0',
      '--color-muted': '#666',
      '--color-subtle': '#888',
      '--color-focus-ring': '#0066cc',
      '--hl-keyword': '#a626a4',
      '--hl-string': '#50a14f',
      '--hl-comment': '#a0a1a7',
      '--hl-number': '#986801',
      '--hl-type': '#c18401',
      '--hl-function': '#4078f2',
      '--hl-property': '#e45649',
      '--hl-heading': '#4078f2',
      '--hl-link': '#0066cc',
      '--hl-emphasis': '#c18401',
    },
  },);
}

/**
 * Generates the dark mode override block via `prefers-color-scheme`.
 *
 * Swaps light color values for dark-appropriate alternatives.
 *
 * @returns CSS `@media` block string with dark color overrides
 */
export function darkModeTokenStyles(): string {
  return $({
    at: 'media',
    params: '(prefers-color-scheme: dark)',
    children: [
      $({
        rule: ':root',
        decls: {
          '--color-fg': '#e5e5e5',
          '--color-bg': '#1a1a1a',
          '--color-link': '#6db3f2',
          '--color-link-visited': '#c084fc',
          '--color-code-bg': '#2a2a2a',
          '--color-border': '#333',
          '--color-muted': '#999',
          '--color-subtle': '#aaa',
          '--color-focus-ring': '#6db3f2',
          '--hl-keyword': '#c678dd',
          '--hl-string': '#98c379',
          '--hl-comment': '#5c6370',
          '--hl-number': '#d19a66',
          '--hl-type': '#e5c07b',
          '--hl-function': '#61afef',
          '--hl-property': '#e06c75',
          '--hl-heading': '#61afef',
          '--hl-link': '#6db3f2',
          '--hl-emphasis': '#e5c07b',
        },
      },),
    ],
  },);
}
