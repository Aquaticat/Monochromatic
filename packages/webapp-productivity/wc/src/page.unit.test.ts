/**
 * Tests for the complete HTML document assembly.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { renderPage, } from './page.ts';

await describe({
  name: renderPage.name,
  children: [
    it({
      name: 'inlines the given CSS and JS into the document',
      fn: async function inlinesCssAndJs(): Promise<void> {
        /**
         * Complete document rendered from fixture CSS/JS strings.
         */
        const html = renderPage(
          {
            css: 'body{color:red}',
            js: 'console.log(1)',
          },
        );

        expect(html.startsWith('<!DOCTYPE html>',),).toBe(true,);
        expect(html,).toContain('<style>body{color:red}</style>',);
        expect(html,).toContain('<script type="module">console.log(1)</script>',);
      },
    },),
    it({
      name: 'includes the input textarea and the frequency table body',
      fn: async function includesInputAndFrequencyBody(): Promise<void> {
        /**
         * Complete document rendered from empty CSS/JS strings.
         */
        const html = renderPage(
          {
            css: '',
            js: '',
          },
        );

        expect(html,).toContain('id="wc-input"',);
        expect(html,).toContain('id="frequency-body"',);
      },
    },),
  ],
},);
