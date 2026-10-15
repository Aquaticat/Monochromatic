/**
 Tests for the kind of each unit of an English at a span edge (n160 finding Y2): which markup is a boundary, which stays hidden, and
 that the list of block tags written in this package holds every name the Markdown parser keeps.

 Fixtures are cat-themed invention.

 @module
 */

import { createRequire, } from 'node:module';
import { pathToFileURL, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  BOUNDARY_TAG_NAMES,
  unitKindsOf,
} from '../dist/final/node/index.mjs';

/**
 The path of a package as another package resolves it, so a package this one does not depend on is reached through the one that does.

 @param from - file the resolution starts from
 @param name - package name

 @returns The resolved path of the package's entry

 @example
 ```ts
 const entry = resolvedFrom({ from: import.meta.url, name: 'remark-parse', });
 ```
 */
function resolvedFrom({ from, name, }: { readonly from: string; readonly name: string; },): string {
  return createRequire(from,).resolve(name,);
}

/**
 The kinds of the units of an English, as a string with one letter per unit: s shown, h hidden, b boundary.

 @param english - the English

 @returns The letters

 @example
 ```ts
 pattern({ english: 'a<br/>b', },); // 'sbbbbbs'
 ```
 */
function pattern({ english, }: { readonly english: string; },): string {
  return unitKindsOf({ english, },)
    .map(function letter(kind,): string {
      return kind.charAt(0,);
    },)
    .join('',);
}

await describe({
  name: unitKindsOf.name,
  concurrency: 1,
  children: [
    describe({
      name: 'the block tag list',
      children: [
        it({
          name: 'HOLDS every name of the parser\'s own list of HTML block names, read from the installed micromark',
          fn: async () => {
            /**
             The chain of packages from the parser this one depends on to the one that holds the list.
             */
            let at = import.meta.url;
            for (const name of ['remark-parse', 'mdast-util-from-markdown', 'micromark', 'micromark-core-commonmark',] as const)
              at = pathToFileURL(resolvedFrom({ from: at, name, },),).href;
            /**
             The path of the parser's list.
             */
            const listPath = resolvedFrom({ from: at, name: 'micromark-util-html-tag-name', },);
            /**
             The parser's list.
             */
            const { htmlBlockNames, } = await import(pathToFileURL(listPath,).href) as { readonly htmlBlockNames: readonly string[]; };
            expect(htmlBlockNames.length > 40,).toBe(true,);
            expect(
              htmlBlockNames.filter(function missing(name,): boolean {
                return !BOUNDARY_TAG_NAMES.has(name,);
              },),
            ).toEqual([],);
          },
        },),

        it({
          name: 'HOLDS the break, the rule, the image and the two ruby annotation tags beside the parser\'s names',
          fn: async () => {
            for (const name of ['br', 'hr', 'img', 'rt', 'rp',])
              expect(BOUNDARY_TAG_NAMES.has(name,),).toBe(true,);
          },
        },),

        it({
          name: 'LEAVES OUT the tags that only wrap text',
          fn: async () => {
            for (const name of ['b', 'i', 'em', 'strong', 'span', 'a', 'u', 's', 'sub', 'sup', 'ruby', 'code', 'mark', 'small',])
              expect(BOUNDARY_TAG_NAMES.has(name,),).toBe(false,);
          },
        },),
      ],
    },),

    describe({
      name: 'the kinds',
      children: [
        it({
          name: 'READS a break tag as a boundary with or without a slash, and the text around it as shown',
          fn: async () => {
            expect(pattern({ english: 'a<br/>b', },),).toBe('sbbbbbs',);
            expect(pattern({ english: 'a<br />b', },),).toBe('sbbbbbbs',);
          },
        },),

        it({
          name: 'READS the tags of a wrapping element as hidden and of a ruby annotation as boundaries',
          fn: async () => {
            expect(pattern({ english: 'a<b>c</b>d', },),).toBe('shhhshhhhs',);
            expect(pattern({ english: '<ruby>k<rt>j</rt></ruby>', },),).toBe('hhhhhhsbbbbsbbbbbhhhhhhh',);
          },
        },),

        it({
          name: 'READS the pipes and padding of a table row as boundaries and the cell text as shown',
          fn: async () => {
            expect(pattern({ english: '| a | b |\n| - | - |\n| c | d |', },),).toBe('bbsbbbsbbshhhhhhhhhsbbsbbbsbb',);
          },
        },),

        it({
          name: 'READS an image as boundaries and the content of inline code as shown beside hidden backticks',
          fn: async () => {
            expect(pattern({ english: 'a![p](u)b', },),).toBe('sbbbbbbbs',);
            expect(pattern({ english: 'a`kit`b', },),).toBe('shssshs',);
          },
        },),
      ],
    },),
  ],
},);
