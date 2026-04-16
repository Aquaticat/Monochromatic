/**
 * Site header bar with navigation.
 *
 * Renders the brand logo, site name, and nav shell as a
 * `<site-header>` custom element. The nav contains the
 * `<theme-toggle>` and `<site-search>` sub-components.
 */
import {
  cssCalc,
  cssRem,
  cssVar,
  hCss as $,
  hHtml as h,
} from '@monochromatic-dev/module-hyperscript/ts';

import type { Locales, } from '../i18n/i18n-types.ts';
import { i18nObject, } from '../i18n/i18n-util.ts';
import {
  BORDER_WIDTH_REM,
  GAP,
  GAP_SMALL,
} from '../styles/constants.ts';
import { html as siteSearchHtml, } from './site-search.ts';
import { html as themeToggleHtml, } from './theme-toggle.ts';

//region CSS

/**
 * Header bar layout, brand link, and nav styles.
 *
 * @returns CSS string for the `<site-header>` element
 *
 * @example
 * ```ts
 * const styles = css();
 * ```
 */
export function css(): string {
  return [
    $({
      rule: 'site-header header',
      decls: {
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        'padding-block': cssRem(GAP,),
        'padding-inline': cssRem(GAP,),
        'border-block-end-style': 'solid',
        'border-block-end-width': cssCalc(BORDER_WIDTH_REM,),
        'border-block-end-color': cssVar('color-border',),
      },
    },),
    $({
      rule: 'site-header .brand',
      decls: {
        display: 'flex',
        'align-items': 'center',
        gap: cssRem(GAP_SMALL,),
        'text-decoration-line': 'none',
        color: 'inherit',
        'font-weight': 600,
      },
      children: [
        $({
          rule: '& img',
          decls: {
            'inline-size': cssRem(2,),
            'block-size': cssRem(2,),
          },
        },),
      ],
    },),
    $({
      rule: 'site-header nav',
      decls: {
        display: 'flex',
        'align-items': 'center',
        gap: cssRem(GAP_SMALL,),
      },
    },),
  ]
    .join('\n',);
}

//endregion CSS

//region HTML

/**
 * Renders the site header as a `<site-header>` custom element.
 *
 * @param lang - current language code for localized text and links
 *
 * @returns HTML string for the header
 *
 * @example
 * ```ts
 * const markup = html('en');
 * ```
 */
export function html(lang: Locales,): string {
  const t = i18nObject(lang,);
  return h({
    tag: 'site-header',
    attrs: { 'data-is': '', },
    children: [
      h({
        tag: 'header',
        children: [
          h({
            tag: 'a',
            attrs: { href: `/${lang}`, },
            class: 'brand',
            children: [
              h({
                tag: 'img',
                attrs: {
                  src: '/favicon.svg',
                  alt: 'avatar',
                },
              },),
              h({
                tag: 'span',
                text: t.siteName(),
              },),
            ],
          },),
          h({
            tag: 'nav',
            children: [
              themeToggleHtml(t,),
              siteSearchHtml(t,),
            ],
          },),
        ],
      },),
    ],
  },);
}

//endregion HTML
