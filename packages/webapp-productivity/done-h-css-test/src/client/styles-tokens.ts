/**
 * Primitive and semantic color tokens plus dark-mode overrides.
 */
import {
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';
import { $ as css, } from './css.ts';

//region Primitive color tokens -- Raw color values that never change between modes.

/** Raw color values that never change between light and dark modes. */
export const primitiveTokens = css({
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
},);

//endregion Primitive color tokens

//region Semantic color tokens -- Aliases that flip between light and dark modes.

/** Semantic aliases that map to primitives, plus spacing/sizing tokens. */
export const semanticTokens = css({
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
    '--min-target': cssRem(3,),
    '--min-gap': cssRem(1,),
    '--min-padding': cssRem(0.5,),
    '--gap': cssRem(2,),
  },
},);

//endregion Semantic color tokens

//region Dark mode

/** Dark mode overrides -- swaps foreground/background primitives. */
export const darkMode = css({
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
    },),
  ],
},);

//endregion Dark mode
