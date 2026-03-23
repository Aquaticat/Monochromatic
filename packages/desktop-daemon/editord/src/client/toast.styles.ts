/**
 * Global styles for ephemeral toast notifications.
 *
 * Injected once into the document head by {@link toast.ts}.
 * Dynamic positional properties are set inline per toast instance.
 */

import {
  $,
  cssCommaList,
  cssNum,
  cssPercent,
  cssRem,
  cssTranslateX,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';

/** Font size in rem: 13/16. */
const FONT_SIZE = (16 - 2 - 1) / 16;

/** Border radius in rem: 1/4. */
const BORDER_RADIUS = 1 / (2 * 2);

/** Toast opacity: 9/10. */
const OPACITY = 9 / 10;

/** Horizontal centering offset. */
const CENTER_OFFSET = -50;

/** Global toast styles with nested variant rules. */
export const STYLES = $({
  rule: '.toast',
  decls: {
    position: 'fixed',
    'z-index': cssNum(200,),
    'background-color': cssVar('hover-bg',),
    color: cssVar('fg',),
    'border-radius': cssRem(BORDER_RADIUS,),
    'font-family': cssCommaList(["'JetBrains Mono'", 'monospace',],),
    'font-size': cssRem(FONT_SIZE,),
    'pointer-events': 'none',
    opacity: cssNum(OPACITY,),
  },
  children: [
    $({
      rule: '&[data-variant="fixed"]',
      decls: {
        'inset-block-start': cssRem(1,),
        'inset-inline-start': cssPercent(50,),
        transform: cssTranslateX(cssPercent(CENTER_OFFSET,),),
        'padding-block': cssRem(1 / 2,),
        'padding-inline': cssRem(1,),
      },
    },),
    $({
      rule: '&[data-variant="cursor"]',
      decls: {
        'padding-block': cssRem(1 / (2 * 2),),
        'padding-inline': cssRem(1 / 2,),
      },
    },),
  ],
},);
