/**
 Guards ledger X17: every sheet builder the package defines is rendered by the
 rendered-sheets fixtures, so a guard over "every model-facing sheet" reads
 every one. The fixture once claimed every sheet and rendered fifteen, and a
 British spelling in the picture readers' instruction went unread.

 @module
 */

import {
  readdirSync,
  readFileSync,
} from 'node:fs';
import {
  dirname,
  join,
} from 'node:path';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

/**
 This package's source directory.
 */
const SRC = import.meta.dirname;

/**
 Declaration that opens a sheet builder.
 */
const BUILDER_OPENING = 'export function build';

/**
 Suffix every sheet builder's name carries.
 */
const BUILDER_SUFFIX = 'Messages';

/**
 Names of the sheet builders one source text declares, read by an index scan.

 @param text - source file

 @returns Each `build…Messages` function it exports

 @example
 ```ts
 const names = buildersIn({ text: 'export function buildCatMessages(', },); // ['buildCatMessages']
 ```
 */
function buildersIn({ text, }: { readonly text: string; },): readonly string[] {
  /**
   Names found.
   */
  const names: string[] = [];
  for (
    let at = text.indexOf(BUILDER_OPENING,);
    at !== (-1);
    at = text.indexOf(
      BUILDER_OPENING,
      at + BUILDER_OPENING.length,
    )
  ) {
    /**
     Where the name ends: the parameter list or a type parameter.
     */
    const nameStart = at + 'export function '.length;
    /**
     End of the identifier.
     */
    const open = [
      text.indexOf('(', nameStart,),
      text.indexOf('<', nameStart,),
    ].filter(function found(index,): boolean {
      return index !== (-1);
    },)
      .reduce(function first(least, index,): number {
        return Math.min(least, index,);
      }, text.length,);
    /**
     The function's name.
     */
    const name = text.slice(nameStart, open,)
      .trim();
    if (name.endsWith(BUILDER_SUFFIX,))
      names.push(name,);
  }
  return names;
}

/**
 Every non-test source file under the package's source directory.

 @returns Paths relative to the source directory

 @example
 ```ts
 const files = sourceFiles();
 ```
 */
function sourceFiles(): readonly string[] {
  return readdirSync(SRC, { recursive: true, encoding: 'utf8', },)
    .filter(function isSource(name,): boolean {
      return name.endsWith('.ts',)
        && (!name.endsWith('.test.ts',))
        && (!name.endsWith('.test-fixture.ts',));
    },);
}

/**
 Text of every rendered-sheets fixture.

 @returns The fixtures, joined

 @example
 ```ts
 const fixtures = fixtureText();
 ```
 */
function fixtureText(): string {
  return readdirSync(SRC, { encoding: 'utf8', },)
    .filter(function isSheetFixture(name,): boolean {
      return name.startsWith('rendered-sheets',) && name.endsWith('.test-fixture.ts',);
    },)
    .map(function read(name,): string {
      return readFileSync(join(SRC, name,), 'utf8',);
    },)
    .join('\n',);
}

await describe({
  name: 'rendered-sheets census (ledger X17)',
  children: [
    it({
      name: 'RENDERS EVERY SHEET BUILDER THE PACKAGE DEFINES, so "every sheet" means every sheet',
      fn: async () => {
        /**
         Every builder, by name.
         */
        const builders = sourceFiles().flatMap(function buildersOf(name,): readonly string[] {
          return buildersIn({ text: readFileSync(join(SRC, name,), 'utf8',), },);
        },);
        /**
         The fixtures' text.
         */
        const fixtures = fixtureText();
        expect({
          // The census reads the builders at all: two it must find.
          readsBuilders: builders.includes('buildCriticMessages',) && builders.includes('buildArchiveBlockReviewMessages',),
          unrendered: builders.filter(function unrendered(name,): boolean {
            return !fixtures.includes(`${name}(`,);
          },),
        },).toEqual({
          readsBuilders: true,
          unrendered: [],
        },);
      },
    },),
  ],
},);
