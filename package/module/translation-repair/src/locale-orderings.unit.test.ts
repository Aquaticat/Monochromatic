/**
 Guards against text ordered or cased by the runtime's locale (ledger B95).
 `localeCompare` orders by the locale and collation data of whatever machine
 runs it, so a benchmark draw broke its ties one way on one machine and
 another way on the next. The package orders text with `compareCodePoints`
 (`code-points.ts`), the same on every machine, and cases it with the
 locale-free `toLowerCase` and `toUpperCase`.

 WHAT THE SCAN READS, in the package's source and its tests alike: a member
 named `localeCompare`, `toLocaleLowerCase`, `toLocaleUpperCase`,
 `toLocaleString`, `toLocaleDateString` or `toLocaleTimeString`, called or
 handed on, written plainly or computed from a string; and `Intl.Collator`.
 Reads are keyed `path#site: form`, where the site is the nearest enclosing
 named function. Out of the scan's reach: `Intl` reached through
 `globalThis` or another name, and a member named through a variable.

 THE FIXTURE CASE COMES FIRST, so the package-wide case is read against a
 scan shown able to find each form (ledger M21). Fixtures are cat-themed; the
 package case reads this package's own source.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  childNodes,
  identifierName,
  isTreeNode,
  memberName,
  parseSource,
  readPackageSource,
  type SourceText,
  type TreeNode,
  unwrapped,
} from './source-scan.test-fixture.ts';

//region Locale orderings
// The scan itself: which nodes order or case text by the runtime's locale, and
// the walk that keys each by its file and enclosing named function.

/**
 Node kinds that open a function, which names the site of the reads inside.
 */
const FUNCTION_KINDS: ReadonlySet<string> = new Set([
  'ArrowFunctionExpression',
  'FunctionDeclaration',
  'FunctionExpression',
],);

/**
 String and date members whose answer follows the runtime's locale.
 */
const LOCALE_MEMBERS: ReadonlySet<string> = new Set([
  'localeCompare',
  'toLocaleDateString',
  'toLocaleLowerCase',
  'toLocaleString',
  'toLocaleTimeString',
  'toLocaleUpperCase',
],);

/**
 The locale-dependent read a node makes itself, where it makes one.

 @param node - node read

 @returns The read's form as the key writes it, empty where the node makes
 none

 @example
 ```ts
 const read = localeReadOf({ node, },); // 'localeCompare'
 ```
 */
function localeReadOf({ node, }: { readonly node: TreeNode; },): string {
  if (node.type !== 'MemberExpression')
    return '';
  /**
   The member read.
   */
  const member = memberName({ node, },);
  if (LOCALE_MEMBERS.has(member,))
    return member;
  return ((member === 'Collator') && (identifierName({ node: unwrapped({ node: node.object, },).inner, },) === 'Intl'))
    ? 'Intl.Collator'
    : '';
}

/**
 Every locale-dependent read in the files given, keyed `path#site: form`, one
 entry per read.

 @param files - files read, tests among them

 @returns Keys sorted, repeated once per read

 @example
 ```ts
 const reads = localeReads({ files, },);
 ```
 */
function localeReads({ files, }: { readonly files: readonly SourceText[]; },): readonly string[] {
  /**
   Keys found so far.
   */
  const found: string[] = [];
  for (const file of files) {
    /**
     Nodes still to visit, each with its enclosing named function.
     */
    const pending: {
      readonly node: TreeNode;
      readonly site: string;
    }[] = [{
      node: parseSource({ file, },).program,
      site: '<module>',
    },];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      /**
       Node visited now, and the site it sits in.
       */
      const {
        node,
        site,
      } = next;
      /**
       Enclosing named function for the node's children.
       */
      const here = (FUNCTION_KINDS.has(node.type,) && isTreeNode(node.id,)) ? identifierName({ node: node.id, },) : site;
      /**
       The read the node makes, where it makes one.
       */
      const read = localeReadOf({ node, },);
      if (read !== '')
        found.push(`${file.path}#${here}: ${read}`,);
      pending.push(...childNodes({ node, },).map(function withSite(child,) {
        return {
          node: child,
          site: here,
        };
      },),);
    }
  }
  return found.toSorted();
}

//endregion Locale orderings

/**
 A source file for the fixture case.

 @param path - file name

 @param text - file text

 @param isTest - whether it stands for a test

 @returns Source file

 @example
 ```ts
 const file = fixture({ path: 'cat.ts', text: 'export const nap = 1;', isTest: false, },);
 ```
 */
function fixture(
  {
    path,
    text,
    isTest,
  }: {
    readonly path: string;
    readonly text: string;
    readonly isTest: boolean;
  },
): SourceText {
  return {
    path,
    text,
    isTest,
  };
}

await describe({
  name: 'locale orderings (ledger B95)',
  children: [
    it({
      name: 'FINDS localeCompare called, handed on or computed, the toLocale casing and formatting members, and '
        + 'Intl.Collator, in source and tests alike, and leaves toLowerCase, toUpperCase, toString and other '
        + 'objects\' Collator',
      fn: async () => {
        expect(localeReads({
          files: [
            fixture({
              path: 'litter.ts',
              text: [
                'export function byName(left: string, right: string,): number {',
                '  return left.localeCompare(right,);',
                '}',
                'export const order = String.prototype.localeCompare;',
                'export const kitten = \'Tabby\'[\'localeCompare\'](\'mooncat\',);',
                'export const loud = \'purr\'.toLocaleUpperCase() + \'MEOW\'.toLocaleLowerCase();',
                'export const shown = (7).toLocaleString() + new Date().toLocaleDateString()'
                + ' + new Date().toLocaleTimeString();',
                'export const collator = new Intl.Collator(\'en\',);',
                'export const plain = \'Purr\'.toLowerCase() + \'purr\'.toUpperCase() + (7).toString();',
                'export const other = { Collator: 1, }.Collator;',
              ].join('\n',),
              isTest: false,
            },),
            fixture({
              path: 'catnip.unit.test.ts',
              text: 'export const sorted = [\'b\', \'a\',].toSorted((left, right,) => left.localeCompare(right,),);',
              isTest: true,
            },),
          ],
        },),).toEqual([
          'catnip.unit.test.ts#<module>: localeCompare',
          'litter.ts#<module>: Intl.Collator',
          'litter.ts#<module>: localeCompare',
          'litter.ts#<module>: localeCompare',
          'litter.ts#<module>: toLocaleDateString',
          'litter.ts#<module>: toLocaleLowerCase',
          'litter.ts#<module>: toLocaleString',
          'litter.ts#<module>: toLocaleTimeString',
          'litter.ts#<module>: toLocaleUpperCase',
          'litter.ts#byName: localeCompare',
        ],);
      },
    },),
    it({
      name: 'ORDERS AND CASES NO TEXT BY THE RUNTIME\'S LOCALE in the package\'s source or tests',
      fn: async () => {
        /**
         Every package file, tests among them.
         */
        const files = await readPackageSource();
        expect(files.some(function isSource(file,): boolean {
          return !file.isTest;
        },),).toBe(true,);
        expect(localeReads({ files, },),).toEqual([],);
      },
    },),
  ],
},);
