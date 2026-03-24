/**
 * Site header template with navigation and search stub.
 *
 * Renders the brand logo, site name, and a search popover that
 * always displays empty results (search is deferred).
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

// File justification: 102 lines -- header and search popover are tightly
// coupled; the popover is only used inside the header.
import { t, } from '../lib/i18n.ts';

/**
 * Search icon SVG markup.
 *
 * Inline rather than imported because the icon is a single path element
 * too small to warrant a separate file and build-time import.
 */
const SEARCH_ICON = [
  '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">',
  '<path d="M18.7441 19.0893L14.03 14.3752M16.8333 9.33333',
  'C16.8333 13.0152 13.8486 16 10.1667 16C6.48477 16',
  ' 3.5 13.0152 3.5 9.33333C3.5 5.65143 6.48477 2.66666',
  ' 10.1667 2.66666C13.8486 2.66666 16.8333 5.65143',
  ' 16.8333 9.33333Z" stroke="currentColor" stroke-width="2"/>',
  '</svg>',
]
  .join('',);

/**
 * Renders the site header with brand link and search stub.
 *
 * @param lang - current language code for localized text and links
 *
 * @returns HTML string for the `<header>` element
 */
export function headerFragment(lang: string,): string {
  return h({
    tag: 'header',
    children: [
      h({
        tag: 'a',
        attrs: { href: `/${lang}`, },
        class: 'brand',
        children: [
          h({ tag: 'img', attrs: { src: '/favicon.svg', alt: 'avatar', }, },),
          h({ tag: 'span', class: 'siteName', text: t('siteName', lang,), },),
        ],
      },),
      h({
        tag: 'nav',
        children: [
          h({
            tag: 'button',
            attrs: { popovertarget: 'search', },
            children: [
              h({ tag: 'span', text: 'Search', },),
              ` ${SEARCH_ICON}`,
            ],
          },),
          searchPopover(lang,),
        ],
      },),
    ],
  },);
}

/**
 * Renders the search popover with input and empty results stub.
 *
 * @param lang - current language code for localized placeholder
 *
 * @returns HTML string for the search popover
 */
function searchPopover(lang: string,): string {
  const placeholder = t('searchPlaceholder', lang,);

  return h({
    tag: 'div',
    attrs: { popover: '', id: 'search', },
    children: [
      h({
        tag: 'search',
        children: [
          h({
            tag: 'label',
            text: placeholder,
            children: [
              h({
                tag: 'input',
                attrs: {
                  name: 'q',
                  type: 'search',
                  required: '',
                  placeholder,
                },
              },),
            ],
          },),
        ],
      },),
      h({ tag: 'p', text: t('noResults', lang,), },),
    ],
  },);
}
