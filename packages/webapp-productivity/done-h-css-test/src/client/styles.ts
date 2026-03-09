/**
 * Global stylesheet generated via h-css.
 *
 * Replaces `styles.css` with TypeScript-generated CSS string.
 * Imported by page entry scripts and passed to `injectCSS()`.
 */
import { $ as css } from "./css.ts";
import { cssCalc, cssCommaList, cssCompounded, cssCubicBezier, cssDvb, cssOklch, cssPercent, cssRem, cssS, cssScale, cssVar } from "@monochromatic-dev/module-es/h-css";

//region Primitive color tokens -- Raw color values that never change between modes.

const primitiveTokens = css({
  rule: ':root',
  decls: {
    '--gray-dark': '#111',
    '--gray-dark-50': 'rgb(17 17 17 / 0.5)',
    '--gray-dark-darker': '#000',
    '--gray-dark-lighter': '#444',
    '--gray-light': '#eee',
    '--gray-light-50': 'rgb(238 238 238 / 0.5)',
    '--gray-light-lighter': '#fff',
    '--gray-light-darker': '#bbb',
    '--gray-medium': '#888',
    '--red-dark': '#904649',
    '--red-light': '#faa',
    '--purple-dark': '#8d3d8c',
    '--purple-light': '#faf',
    '--yellow-dark': '#626000',
    '--yellow-light': '#ffa',
    '--cyan-dark': '#006769',
    '--cyan-light': '#aff',
    '--blue-dark': '#5754a1',
    '--blue-light': '#aaf',
    '--green-dark': '#106b1c',
    '--green-light': '#afa',
    '--orange-dark': '#90511e',
    '--orange-light': '#fca',
  },
});

//endregion Primitive color tokens

//region Semantic color tokens -- Aliases that flip between light and dark modes.

const semanticTokens = css({
  rule: ':root',
  decls: {
    '--fg': 'var(--gray-dark)',
    '--fg-50': 'var(--gray-dark-50)',
    '--fg-stronger': 'var(--gray-dark-darker)',
    '--fg-weaker': 'var(--gray-dark-lighter)',
    '--bg': 'var(--gray-light)',
    '--bg-50': 'var(--gray-light-50)',
    '--bg-stronger': 'var(--gray-light-lighter)',
    '--bg-weaker': 'var(--gray-light-darker)',
    '--medium': 'var(--medium)',
    '--red-fg': 'var(--red-dark)',
    '--red-bg': 'var(--red-light)',
    '--purple-fg': 'var(--purple-dark)',
    '--purple-bg': 'var(--purple-light)',
    '--yellow-fg': 'var(--yellow-dark)',
    '--yellow-bg': 'var(--yellow-light)',
    '--cyan-fg': 'var(--cyan-dark)',
    '--cyan-bg': 'var(--cyan-light)',
    '--blue-fg': 'var(--blue-dark)',
    '--blue-bg': 'var(--blue-light)',
    '--green-fg': 'var(--green-dark)',
    '--green-bg': 'var(--green-light)',
    '--orange-fg': 'var(--orange-dark)',
    '--orange-bg': 'var(--orange-light)',
    '--overlay-bg': 'rgb(0 0 0 / 0.3)',
    '--hover-bg': 'rgb(0 0 0 / 0.05)',
    '--min-target': cssRem(3),
    '--min-gap': cssRem(1),
    '--min-padding': cssRem(0.5),
    '--gap': cssRem(2),
  },
});

//endregion Semantic color tokens

//region Dark mode

const darkMode = css({
  at: 'media',
  params: '(prefers-color-scheme: dark)',
  children: [
    css({
      rule: ':root',
      decls: {
        '--fg': 'var(--gray-light)',
        '--fg-50': 'var(--gray-light-50)',
        '--fg-stronger': 'var(--gray-light-lighter)',
        '--fg-weaker': 'var(--gray-light-darker)',
        '--bg': 'var(--gray-dark)',
        '--bg-50': 'var(--gray-dark-50)',
        '--bg-stronger': 'var(--gray-dark-darker)',
        '--bg-weaker': 'var(--gray-dark-lighter)',
        '--red-fg': 'var(--red-light)',
        '--red-bg': 'var(--red-dark)',
        '--purple-fg': 'var(--purple-light)',
        '--purple-bg': 'var(--purple-dark)',
        '--yellow-fg': 'var(--yellow-light)',
        '--yellow-bg': 'var(--yellow-dark)',
        '--cyan-fg': 'var(--cyan-light)',
        '--cyan-bg': 'var(--cyan-dark)',
        '--blue-fg': 'var(--blue-light)',
        '--blue-bg': 'var(--blue-dark)',
        '--green-fg': 'var(--green-light)',
        '--green-bg': 'var(--green-dark)',
        '--orange-fg': 'var(--orange-light)',
        '--orange-bg': 'var(--orange-dark)',
        '--overlay-bg': 'rgb(255 255 255 / 0.15)',
        '--hover-bg': 'rgb(255 255 255 / 0.08)',
      },
    }),
  ],
});

//endregion Dark mode

//region Resets

const resets = [
  css({
    rule: '*, *::before, *::after',
    decls: {
      'box-sizing': 'border-box',
      'margin-block': 0,
      'margin-inline': 0,
      'padding-block': 0,
      'padding-inline': 0,
    },
  }),
  css({
    rule: 'input, textarea, select, button',
    decls: {
      'font-family': 'inherit',
      'font-size': 'inherit',
      'font-style': 'inherit',
      'font-weight': 'inherit',
      'line-height': 'inherit',
    },
  }),
  css({
    rule: 'button:disabled',
    decls: { opacity: 0.45, cursor: 'not-allowed' },
  }),
  css({
    rule: 'input::placeholder, textarea::placeholder',
    decls: { color: cssVar('medium') },
  }),
].join('');

//endregion Resets

//region Layout shell

const layoutShell = [
  css({ rule: ':root', decls: { '--sidebar-basis': cssRem(22) } }),
  css({
    rule: 'body',
    decls: {
      'font-family': cssCommaList(['Inter', 'system-ui', 'sans-serif']),
      color: cssVar('fg'),
      'background-color': cssVar('bg'),
      'max-inline-size': cssCalc(`${cssRem(1194)} / 16`),
      'margin-inline': 'auto',
      'overflow-x': 'hidden',
      'min-block-size': cssDvb(100),
      display: 'flex',
      'flex-direction': 'row',
    },
  }),
  css({
    rule: 'side-drawer',
    decls: {
      'flex-shrink': 0,
      'flex-basis': 0,
      position: 'sticky',
      'inset-block-start': 0,
      'align-self': 'flex-start',
      'max-block-size': cssDvb(100),
    },
  }),
  css({
    at: 'media',
    params: '(min-width: 48rem)',
    children: [
      css({ rule: 'side-drawer', decls: { 'flex-basis': cssVar('sidebar-basis') } }),
    ],
  }),
  css({
    rule: '.page-wrapper',
    decls: {
      display: 'flex',
      'flex-direction': 'column',
      'min-block-size': cssDvb(100),
      'flex-grow': 1,
      'min-inline-size': 0,
    },
  }),
  css({
    rule: '#app',
    decls: {
      display: 'flex',
      'flex-direction': 'column',
      'padding-block': cssVar('gap'),
      'padding-inline': cssVar('min-gap'),
      gap: cssVar('gap'),
      'overflow-x': 'hidden',
    },
  }),
].join('');

//endregion Layout shell

//region Multi-page utilities

const utilities = [
  css({
    rule: '.task-list',
    decls: { display: 'flex', 'flex-direction': 'column', gap: cssVar('gap'), 'list-style': 'none' },
  }),
  css({
    rule: '.divider',
    decls: {
      'block-size': cssCalc(`${cssRem(1)} / 16`),
      'background-color': cssVar('fg'),
      'inline-size': cssPercent(100),
    },
  }),
  css({ rule: '.empty', decls: { color: cssVar('medium') } }),
].join('');

//endregion Multi-page utilities

//region New-task panel

const newTaskPanel = [
  css({
    at: 'keyframes',
    params: 'fab-to-surface',
    children: [
      css({
        rule: 'from',
        decls: { transform: cssScale(0.15), 'border-radius': cssPercent(50), opacity: 0.6 },
      }),
      css({
        rule: 'to',
        decls: {
          transform: cssScale(1),
          'border-start-start-radius': cssRem(1),
          'border-start-end-radius': cssRem(1),
          'border-end-start-radius': 0,
          'border-end-end-radius': 0,
          opacity: 1,
        },
      }),
    ],
  }),
  css({
    rule: '.new-task-panel',
    decls: {
      position: 'fixed',
      'inset-block-start': 'auto',
      'inset-block-end': 0,
      'inset-inline-start': 'auto',
      'inset-inline-end': cssRem(1),
      'margin-block': 0,
      'margin-inline': 0,
      'border-style': 'none',
      'padding-block': 0,
      'padding-inline': 0,
      'background-color': cssVar('bg'),
      color: cssVar('fg'),
      'inline-size': cssCalc(`${cssRem(393)} / 16`),
      'max-block-size': cssDvb(80),
      'overflow-y': 'auto',
      'border-start-start-radius': cssRem(1),
      'border-start-end-radius': cssRem(1),
      'border-end-start-radius': 0,
      'border-end-end-radius': 0,
      'box-shadow': cssCompounded([0, cssRem(-0.25), cssRem(1), cssOklch({ l: 0, c: 0, h: 0, a: 0.2 })]),
      'transform-origin': cssCompounded(['bottom', 'right']),
    },
    children: [
      css({
        rule: '&[data-animating]',
        decls: {
          'animation-name': 'fab-to-surface',
          'animation-duration': cssS(0.25),
          'animation-timing-function': cssCubicBezier([0.4, 0, 0.2, 1]),
          'animation-fill-mode': 'both',
        },
      }),
    ],
  }),
].join('');

//endregion New-task panel

/** Complete global stylesheet string */
export const globalStyles = [
  primitiveTokens,
  semanticTokens,
  darkMode,
  resets,
  layoutShell,
  utilities,
  newTaskPanel,
].join('');
