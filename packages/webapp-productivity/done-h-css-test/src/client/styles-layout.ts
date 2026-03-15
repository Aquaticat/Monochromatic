/**
 * Global CSS resets and layout shell rules.
 */
import { cssCalc, cssCommaList, cssDvb, cssRem, cssVar } from "@monochromatic-dev/module-es/h-css";
import { $ as css } from "./css.ts";

//region Resets

/** Box-model reset and form element font inheritance. */
export const resets = [
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

/** Body, sidebar, page-wrapper, and app container layout rules. */
export const layoutShell = [
  css({ rule: ':root', decls: { '--sidebar-basis': cssRem(22) } }),
  css({
    rule: 'body',
    decls: {
      'font-family': cssCommaList(['Inter', 'system-ui', 'sans-serif']),
      color: cssVar('fg'),
      'background-color': cssVar('bg'),
      'max-inline-size': cssCalc(`${cssRem(1_194)} / 16`),
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

// Multi-page utilities are in styles-utilities.ts
