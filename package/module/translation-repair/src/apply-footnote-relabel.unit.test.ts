/**
 Tests for the simultaneous syntax-positioned footnote relabel rewrite.
 Fixtures are cat-themed invention mirroring corpus structure only.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { applyFootnoteRelabel, } from '../dist/final/node/index.mjs';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: applyFootnoteRelabel.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'returns text unchanged when a self-rename finds no footnote markers in it at all',
          fn: async () => {
            const text = 'Cats nap all afternoon, holding no footnote markers at all.';
            expect(applyFootnoteRelabel({
              text,
              map: [{ from: 'whisker', to: 'whisker', },],
            },),).toBe(text,);
          },
        },),
        it({
          name: 'relabels a page holding an autolink literal micromark did not tokenize beside its '
            + 'footnote, rather than refusing the whole page (ledger B123)',
          fn: async () => {
            /**
             Literal shapes micromark leaves untokenized and the autolink
             transform then rebuilds nodes for without positions
             (the probe inputs of ledger B123).
             */
            const literals = [
              '"www.example.com"',
              '[www.example.com',
              '，www.example.com。',
              ',www.example.com',
            ];
            for (const literal of literals) {
              /**
               Page whose footnote sits beside that literal.
               */
              const text = `A cat[^1] naps.\n\n[^1]: The cat.\n\n${literal}\n`;
              /**
               The same page under the one-label relabel, every byte outside
               the two markers unchanged.
               */
              const expected = `A cat[^2] naps.\n\n[^2]: The cat.\n\n${literal}\n`;
              expect(applyFootnoteRelabel({
                text,
                map: [{ from: '1', to: '2', },],
              },),).toBe(expected,);
            }
          },
        },),
        it({
          name: 'bounds a run at both the head and the tail of its parent, the whole paragraph one '
            + 'untokenized literal',
          fn: async () => {
            /**
             Paragraph whose only child is the untokenized literal, so the
             run sits at both bounds of its parent's children.
             */
            const text = 'A cat[^1] naps.\n\n[^1]: The cat.\n\n[www.example.com\n';
            const expected = 'A cat[^2] naps.\n\n[^2]: The cat.\n\n[www.example.com\n';
            expect(applyFootnoteRelabel({
              text,
              map: [{ from: '1', to: '2', },],
            },),).toBe(expected,);
          },
        },),
        it({
          name: 'relabels a literal-looking reference riding with an autolink literal micromark did not '
            + 'tokenize, since an undefined call stays in its text (ledger B123)',
          fn: async () => {
            /**
             Pages whose untokenized literal holds an undefined reference:
             micromark's call tokenizer refuses an identifier no definition
             names, so `[^9]` stays in the rebuilt text (ledger B123).
             */
            const texts = [
              'A cat[^1] naps.\n\n[^1]: The cat.\n\n，www.example.com[^9] tail.\n',
              'A cat[^1] naps.\n\n[^1]: The cat.\n\n[www.example.com[^9]\n',
            ];
            for (const text of texts) {
              expect(applyFootnoteRelabel({
                text,
                map: [{ from: '9', to: 'x', },],
              },),).toBe(text.replaceAll('[^9]', '[^x]',),);
            }
          },
        },),
        it({
          name: 'keeps an escaped opening beside an autolink literal byte-identical while the footnote '
            + 'relabels (ledger B123)',
          fn: async () => {
            const text = 'A cat[^1] naps.\n\n[^1]: The cat.\n\n，www.example.com \\[^9\\]\n';
            const expected = 'A cat[^2] naps.\n\n[^2]: The cat.\n\n，www.example.com \\[^9\\]\n';
            expect(applyFootnoteRelabel({
              text,
              map: [{ from: '1', to: '2', },],
            },),).toBe(expected,);
          },
        },),
        it({
          name: 'keeps malformed openings beside an autolink literal byte-identical, since none of them '
            + 'is a marker (ledger B123)',
          fn: async () => {
            const text = 'A cat[^1] naps.\n\n[^1]: The cat.\n\n，www.example.com[^] [^a b] [^x\n';
            const expected = 'A cat[^2] naps.\n\n[^2]: The cat.\n\n，www.example.com[^] [^a b] [^x\n';
            expect(applyFootnoteRelabel({
              text,
              map: [{ from: '1', to: '2', },],
            },),).toBe(expected,);
          },
        },),
      ],
    },),
  ],
},);
