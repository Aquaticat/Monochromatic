/**
 * Page-scoped styles for the Search page.
 */
import { cssCalc, cssRem, cssVar } from "@monochromatic-dev/module-es/h-css";
import { $ as css } from "./css.ts";
import { borderRadiusFull, flexCenter, whitespaceNowrap } from "./mixins.ts";

/** Compiled CSS string for search page styling. */
export const searchStyles = [
  css({
    rule: '.search-hint',
    decls: { color: cssVar('fg-weaker'), 'font-size': cssRem(1), 'line-height': 1.5 },
  }),
  css({
    rule: '.tag-chips',
    decls: { display: 'flex', 'flex-wrap': 'wrap', gap: cssVar('min-gap') },
  }),
  css({
    rule: '.tag-chip',
    decls: {
      ...flexCenter(),
      ...whitespaceNowrap(),
      ...borderRadiusFull(),
      'border-width': cssCalc(`${cssRem(1)} / 16`),
      'border-style': 'solid',
      'border-color': cssVar('fg'),
      'padding-block': cssRem(0.5),
      'padding-inline': cssRem(0.5),
      gap: cssRem(0.25),
      cursor: 'pointer',
      'background-color': 'transparent',
      'font-family': 'inherit',
      'font-size': 'inherit',
      'font-style': 'inherit',
      'font-weight': 'inherit',
      'line-height': 'inherit',
    },
    children: [
      css({ rule: '&:hover', decls: { 'background-color': cssVar('hover-bg') } }),
    ],
  }),
  css({
    at: 'media',
    params: '(min-width: 48rem)',
    children: [
      css({ rule: '.search-hint', decls: { 'font-size': cssRem(1.5) } }),
    ],
  }),
].join('');
