/**
 * Post list grid and card styles.
 *
 * Covers the `.Posts` grid, individual `.Post` cards, overlays,
 * tag lists, and date displays.
 */
import {
  cssCalc,
  cssCompounded,
  cssInt,
  cssRem,
  cssVar,
  hCss as $,
} from '@monochromatic-dev/module-hyperscript/ts';

import {
  BORDER_WIDTH_REM,
  FONT_SIZE_H2,
  FONT_SIZE_SMALL,
  GAP,
  GAP_SMALL,
  POST_GRID_MIN,
} from './constants.ts';

/**
 * Post list grid and card styles.
 *
 * @returns CSS string for post display rules
 *
 * @example
 * ```ts
 * const css = postStyles();
 * ```
 */
export function postStyles(): string {
  return [
    $({
      rule: '.Posts',
      decls: {
        display: 'grid',
        'grid-template-columns': cssCompounded([
          `repeat(auto-fit, minmax(${cssRem(POST_GRID_MIN,)}, 1fr))`,
        ],),
        gap: cssRem(GAP,),
        'list-style-type': 'none',
        'padding-inline-start': 0,
      },
    },),
    $({
      rule: '.Post',
      decls: {
        position: 'relative',
        'padding-block': cssRem(GAP,),
        'padding-inline': cssRem(GAP,),
        'border-style': 'solid',
        'border-width': cssCalc(BORDER_WIDTH_REM,),
        'border-color': cssVar('color-border',),
        'border-radius': cssRem(GAP_SMALL,),
      },
      children: [
        $({
          rule: '& .overlay',
          decls: {
            position: 'absolute',
            inset: cssInt(0,),
            'font-size': cssInt(0,),
            'text-decoration-line': 'none',
          },
        },),
        $({
          rule: '& h2',
          decls: {
            'margin-block-start': 0,
            'margin-block-end': cssRem(GAP_SMALL,),
            'font-size': cssRem(FONT_SIZE_H2,),
          },
        },),
        $({
          rule: '& .description',
          decls: {
            'margin-block': 0,
            color: cssVar('color-muted',),
          },
        },),
        $({
          rule: '& .tags',
          decls: {
            position: 'relative',
            'z-index': 1,
            display: 'flex',
            gap: cssRem(GAP_SMALL,),
            'list-style-type': 'none',
            'padding-inline-start': 0,
            'flex-wrap': 'wrap',
          },
        },),
        $({
          rule: '& .date',
          decls: {
            'font-size': cssRem(FONT_SIZE_SMALL,),
            color: cssVar('color-subtle',),
          },
        },),
      ],
    },),
    $({
      rule: '.Post__tag',
      decls: {
        'font-size': cssRem(FONT_SIZE_SMALL,),
        color: cssVar('color-subtle',),
      },
    },),
  ]
    .join('\n',);
}
