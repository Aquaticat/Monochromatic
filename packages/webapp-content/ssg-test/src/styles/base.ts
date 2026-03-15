/**
 * Minimal base styles via h-css.
 *
 * Functional-first: just enough CSS for a readable site.
 * The user will write production styles later.
 */
import {
  $,
  cssRem,
} from '@monochromatic-dev/module-es/h-css';

/** Maximum content width in rem. */
const MAX_WIDTH = 48;

/** Base line-height ratio. */
const LINE_HEIGHT = 1.6;

/** Standard gap between elements in rem. */
const GAP = 1;

/** Small gap in rem. */
const GAP_SMALL = 1 / 2;

/**
 * Generates the complete site CSS as a single string.
 *
 * @returns concatenated CSS rules
 */
export function generateSiteCss(): string {
  return [
    baseReset(),
    layoutStyles(),
    typographyStyles(),
    headerStyles(),
    postGridStyles(),
    postCardStyles(),
    searchStyles(),
  ].join('\n',);
}

/** Box-sizing reset and base body styles. */
function baseReset(): string {
  return [
    $({ rule: '*, *::before, *::after', decls: { 'box-sizing': 'border-box', }, },),
    $({ rule: 'body', decls: {
      'margin-block': 0,
      'margin-inline': 0,
      'font-family': 'Inter, system-ui, sans-serif',
      'line-height': LINE_HEIGHT,
      color: '#1a1a1a',
      'background-color': '#fafafa',
    }, },),
  ].join('\n',);
}

/** Content area layout constraints. */
function layoutStyles(): string {
  return [
    $({ rule: '.between_header_footer', decls: {
      'max-inline-size': cssRem(MAX_WIDTH,),
      'margin-inline': 'auto',
      'padding-inline': cssRem(GAP,),
      'padding-block': cssRem(GAP,),
    }, },),
  ].join('\n',);
}

/** Base typography for headings, links, and code blocks. */
function typographyStyles(): string {
  return [
    $({ rule: 'a', decls: { color: '#0066cc', }, },),
    $({ rule: 'a:visited', decls: { color: '#551a8b', }, },),
    $({ rule: 'code', decls: { 'font-family': '"Monaspace Neon", monospace', }, },),
    $({ rule: 'pre', decls: {
      'padding-block': cssRem(GAP,),
      'padding-inline': cssRem(GAP,),
      'overflow-x': 'auto',
      'border-radius': cssRem(GAP_SMALL,),
      'background-color': '#f5f5f5',
    }, },),
  ].join('\n',);
}

/** Site header bar. */
function headerStyles(): string {
  return [
    $({ rule: 'header', decls: {
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'space-between',
      'padding-block': cssRem(GAP,),
      'padding-inline': cssRem(GAP,),
      'border-block-end-style': 'solid',
      'border-block-end-width': '1px',
      'border-block-end-color': '#e0e0e0',
    }, },),
    $({ rule: '.brand', decls: {
      display: 'flex',
      'align-items': 'center',
      gap: cssRem(GAP_SMALL,),
      'text-decoration-line': 'none',
      color: 'inherit',
      'font-weight': '600',
    }, },),
    $({ rule: '.brand img', decls: {
      'inline-size': cssRem(2,),
      'block-size': cssRem(2,),
    }, },),
  ].join('\n',);
}

/** Post list grid layout. */
function postGridStyles(): string {
  return [
    $({ rule: '.Posts', decls: {
      display: 'grid',
      'grid-template-columns': `repeat(auto-fit, minmax(${cssRem(16)}, 1fr))`,
      gap: cssRem(GAP,),
      'list-style-type': 'none',
      'padding-inline-start': 0,
    }, },),
  ].join('\n',);
}

/** Individual post card. */
function postCardStyles(): string {
  return [
    $({ rule: '.Post', decls: {
      position: 'relative',
      'padding-block': cssRem(GAP,),
      'padding-inline': cssRem(GAP,),
      'border-style': 'solid',
      'border-width': '1px',
      'border-color': '#e0e0e0',
      'border-radius': cssRem(GAP_SMALL,),
    }, },),
    $({ rule: '.Post .overlay', decls: {
      position: 'absolute',
      inset: '0',
      'font-size': '0',
      'text-decoration-line': 'none',
    }, },),
    $({ rule: '.Post h2', decls: {
      'margin-block-start': 0,
      'margin-block-end': cssRem(GAP_SMALL,),
      'font-size': cssRem(1.25,),
    }, },),
    $({ rule: '.Post .description', decls: {
      'margin-block': 0,
      color: '#666',
    }, },),
    $({ rule: '.Post .tags', decls: {
      display: 'flex',
      gap: cssRem(GAP_SMALL,),
      'list-style-type': 'none',
      'padding-inline-start': 0,
      'flex-wrap': 'wrap',
    }, },),
    $({ rule: '.Post__tag', decls: {
      'font-size': cssRem(0.875,),
      color: '#888',
    }, },),
    $({ rule: '.Post .date', decls: {
      'font-size': cssRem(0.875,),
      color: '#888',
    }, },),
  ].join('\n',);
}

/** Search popover stub styles. */
function searchStyles(): string {
  return [
    $({ rule: '[popover]', decls: {
      'padding-block': cssRem(GAP,),
      'padding-inline': cssRem(GAP,),
      'max-inline-size': cssRem(MAX_WIDTH,),
      'border-style': 'solid',
      'border-width': '1px',
      'border-color': '#e0e0e0',
      'border-radius': cssRem(GAP_SMALL,),
    }, },),
    $({ rule: '[popover] input[type="search"]', decls: {
      'inline-size': '100%',
      'padding-block': cssRem(GAP_SMALL,),
      'padding-inline': cssRem(GAP_SMALL,),
      'font-size': cssRem(1,),
    }, },),
  ].join('\n',);
}
