/**
 * Page-scoped CSS for the Inbox page controls.
 *
 * Separated from inbox.ts to keep the entry script focused on
 * hydration logic rather than style declarations.
 */
import { $ as css } from "./css.ts";
import { cssCalc, cssPercent, cssRem, cssVar } from "@monochromatic-dev/module-es/h-css";

/** Inbox-specific styles for task children, controls, and location options. */
export const inboxStyles = [
  css({
    rule: '.task-children',
    decls: {
      'margin-inline-start': cssRem(1.5),
      'border-inline-start-width': cssRem(0.125),
      'border-inline-start-style': 'solid',
      'border-inline-start-color': cssVar('bg-weaker'),
      'padding-inline-start': cssRem(0.75),
    },
  }),
  css({
    rule: '.controls',
    decls: { display: 'flex', 'flex-wrap': 'wrap', gap: cssVar('gap'), 'align-items': 'flex-start' },
  }),
  css({
    rule: '.control-group',
    decls: {
      display: 'flex',
      'flex-direction': 'column',
      gap: cssVar('min-padding'),
      'flex-grow': 1,
      'flex-shrink': 0,
      'flex-basis': 0,
      'min-inline-size': cssPercent(100),
      'overflow-x': 'hidden',
      'overflow-y': 'hidden',
    },
  }),
  css({
    rule: '.subsection-heading',
    decls: { 'font-size': cssRem(1.25), 'font-weight': 400 },
  }),
  css({
    rule: '.subsection-desc',
    decls: { 'font-size': cssCalc(`${cssRem(15)} / 16`), 'line-height': 1.5, color: cssVar('fg-weaker') },
  }),
  css({
    rule: '.location-options',
    decls: {
      display: 'flex',
      gap: cssVar('min-gap'),
      'align-items': 'center',
      'min-block-size': cssRem(3),
      'flex-wrap': 'wrap',
    },
  }),
  css({
    rule: '.autodetect-toggle',
    decls: {
      display: 'flex',
      gap: cssVar('min-padding'),
      'align-items': 'center',
      cursor: 'pointer',
      'background-color': 'transparent',
      'border-style': 'none',
      'font-family': 'inherit',
      'font-size': 'inherit',
      'font-style': 'inherit',
      'font-weight': 'inherit',
      'line-height': 'inherit',
      color: cssVar('fg'),
      'padding-block': 0,
      'padding-inline': 0,
    },
  }),
].join('');
