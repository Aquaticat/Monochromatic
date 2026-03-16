/**
 * Design token CSS custom properties.
 *
 * Defines all color tokens as a `:root` block. Every color value
 * in the site references these tokens via `var(--token-name)`.
 */
import { $, } from '@monochromatic-dev/module-es/h-css';

/**
 * Generates the `:root` block with all color custom properties.
 *
 * @returns CSS string with custom property declarations
 */
export function tokenStyles(): string {
  return $({ rule: ':root', decls: {
    '--color-fg': '#1a1a1a',
    '--color-bg': '#fafafa',
    '--color-link': '#0066cc',
    '--color-link-visited': '#551a8b',
    '--color-code-bg': '#f5f5f5',
    '--color-border': '#e0e0e0',
    '--color-muted': '#666',
    '--color-subtle': '#888',
    '--color-focus-ring': '#0066cc',
  }, },);
}
