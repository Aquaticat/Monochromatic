/**
 * Page-scoped CSS for the Inbox page controls.
 *
 * Separated from inbox.ts to keep the entry script focused on
 * hydration logic rather than style declarations.
 */
import { $ as css } from "./css.ts";

/** Inbox-specific styles for task children, controls, and location options. */
export const inboxStyles = [
  css({
    rule: '.task-children',
    decls: {
      'margin-inline-start': '1.5rem',
      'border-inline-start-width': '0.125rem',
      'border-inline-start-style': 'solid',
      'border-inline-start-color': 'var(--bg-weaker)',
      'padding-inline-start': '0.75rem',
    },
  }),
  css({
    rule: '.controls',
    decls: { display: 'flex', 'flex-wrap': 'wrap', gap: 'var(--gap)', 'align-items': 'flex-start' },
  }),
  css({
    rule: '.control-group',
    decls: {
      display: 'flex',
      'flex-direction': 'column',
      gap: 'var(--min-padding)',
      flex: '1 0 0',
      'min-inline-size': '100%',
      overflow: 'hidden',
    },
  }),
  css({
    rule: '.subsection-heading',
    decls: { 'font-size': '1.25rem', 'font-weight': '400' },
  }),
  css({
    rule: '.subsection-desc',
    decls: { 'font-size': 'calc(15 / 16 * 1rem)', 'line-height': '1.5', color: 'var(--fg-weaker)' },
  }),
  css({
    rule: '.location-options',
    decls: {
      display: 'flex',
      gap: 'var(--min-gap)',
      'align-items': 'center',
      'min-block-size': '3rem',
      'flex-wrap': 'wrap',
    },
  }),
  css({
    rule: '.autodetect-toggle',
    decls: {
      display: 'flex',
      gap: 'var(--min-padding)',
      'align-items': 'center',
      cursor: 'pointer',
      'background-color': 'transparent',
      'border-style': 'none',
      font: 'inherit',
      color: 'var(--fg)',
      'padding-block': '0',
      'padding-inline': '0',
    },
  }),
].join('');
