/**
 Guards against functions nothing calls (audit area six, ledger B19): a
 top-level function private to its file must be named in that file beyond its
 own declaration, and an exported one must be named in another of the
 package's files, source or test, or used in its own. `isAnchored` outlived
 the change that stopped reading it, and `uniqueRosterModelIds` the loop it
 served, and nothing reported either.

 THE FIXTURES COME FIRST, so the package-wide case is read against a scan
 shown able to find each kind (ledger M21). Fixtures are cat-themed; the
 package case reads this package's own source.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { isAsciiAlphanumeric, } from '../dist/final/node/index.mjs';
import {
  childNodes,
  isTreeNode,
  parseSource,
  readPackageSource,
  type SourceText,
  type TreeNode,
} from './source-scan.test-fixture.ts';

/**
 Functions nothing calls, by kind, each as `path#name`.
 */
type DeadFunctions = {
  /**
   Private functions nothing in their file names.
   */
  readonly private: readonly string[];

  /**
   Exported functions no other file names and their own does not use.
   */
  readonly exported: readonly string[];
};

/**
 A top-level function and whether its file exports it inline.
 */
type TopFunction = {
  /**
   Its name.
   */
  readonly name: string;

  /**
   Whether it is declared with `export`.
   */
  readonly exported: boolean;
};

/**
 How often each identifier stands in a file's tree.

 @param program - parsed program

 @returns Count per name

 @example
 ```ts
 const counts = identifierCounts({ program, },);
 ```
 */
function identifierCounts({ program, }: { readonly program: TreeNode; },): ReadonlyMap<string, number> {
  /**
   Counts so far.
   */
  const counts = new Map<string, number>();
  /**
   Nodes still to visit.
   */
  const pending: TreeNode[] = [program,];
  while (pending.length > 0) {
    /**
     Node visited now.
     */
    const node = pending.pop() as TreeNode;
    if ((node.type === 'Identifier') && ((typeof node.name) === 'string'))
      counts.set(node.name as string, (counts.get(node.name as string,) ?? 0) + 1,);
    pending.push(...childNodes({ node, },),);
  }
  return counts;
}

/**
 The functions a file declares at its top level: function declarations, and
 variables initialised with a function.

 @param program - parsed program

 @returns Its top-level functions

 @example
 ```ts
 const functions = topFunctions({ program, },);
 ```
 */
function topFunctions({ program, }: { readonly program: TreeNode; },): readonly TopFunction[] {
  return (program.body as readonly TreeNode[]).flatMap(function declared(statement,): readonly TopFunction[] {
    /**
     Whether the statement exports what it declares.
     */
    const exported = (statement.type === 'ExportNamedDeclaration') && isTreeNode(statement.declaration,);
    /**
     The declaration itself.
     */
    const declaration = exported ? (statement.declaration as TreeNode) : statement;
    if ((declaration.type === 'FunctionDeclaration') && isTreeNode(declaration.id,))
      return [{ name: declaration.id.name as string, exported, },];
    if (declaration.type !== 'VariableDeclaration')
      return [];
    return (declaration.declarations as readonly TreeNode[])
      .filter(function initialisedWithFunction(item,): boolean {
        return isTreeNode(item.id,) && (item.id.type === 'Identifier') && isTreeNode(item.init,)
          && ((item.init.type === 'ArrowFunctionExpression') || (item.init.type === 'FunctionExpression'));
      },)
      .map(function named(item,): TopFunction {
        return {
          name: (item.id as TreeNode).name as string,
          exported,
        };
      },);
  },);
}

/**
 Names a file exports by an export list (`export { name, };`).

 @param program - parsed program

 @returns Local names listed for export

 @example
 ```ts
 const listed = listedExports({ program, },);
 ```
 */
function listedExports({ program, }: { readonly program: TreeNode; },): ReadonlySet<string> {
  return new Set((program.body as readonly TreeNode[])
    .filter(function isExportList(statement,): boolean {
      return (statement.type === 'ExportNamedDeclaration') && (!isTreeNode(statement.declaration,));
    },)
    .flatMap(function names(statement,): readonly string[] {
      return (statement.specifiers as readonly TreeNode[]).map(function local(specifier,): string {
        /**
         Local binding the specifier exports.
         */
        const bound = specifier.local as TreeNode;
        return (bound.name ?? bound.value) as string;
      },);
    },),);
}

/**
 Whether a character can stand inside an identifier the package writes.

 @param character - one character, empty at a text's edge

 @returns Whether it continues an identifier

 @example
 ```ts
 continuesIdentifier({ character: '_', },); // true
 ```
 */
function continuesIdentifier({ character, }: { readonly character: string; },): boolean {
  return isAsciiAlphanumeric({ character, },) || (character === '_') || (character === '$');
}

/**
 Whether a text names an identifier as a whole word.

 @param text - text searched

 @param name - identifier

 @returns Whether it stands there with no identifier character beside it

 @example
 ```ts
 namesWord({ text: 'feedCat();', name: 'feedCat', },); // true
 ```
 */
function namesWord(
  {
    text,
    name,
  }: {
    readonly text: string;
    readonly name: string;
  },
): boolean {
  /**
   Text between the occurrences, one more piece than there are occurrences.
   */
  const pieces = text.split(name,);
  return pieces
    .slice(0, -1,)
    .some(function wholeAt(before, at,): boolean {
      /**
       Text after this occurrence, read from the whole split rather than the
       slice `some` walks, whose last piece has no successor.
       */
      const after = pieces[at + 1] ?? '';
      return (!continuesIdentifier({ character: before.slice(-1,), },))
        && (!continuesIdentifier({ character: after.charAt(0,), },));
    },);
}

/**
 Every function nothing calls across a set of files; only source files are
 scanned, while every file counts as naming an export.

 @param files - the package's files

 @returns Dead functions by kind

 @example
 ```ts
 const dead = deadFunctions({ files, },);
 ```
 */
function deadFunctions({ files, }: { readonly files: readonly SourceText[]; },): DeadFunctions {
  /**
   Findings per source file.
   */
  const found = files
    .filter(function isSource(file,): boolean {
      return !file.isTest;
    },)
    .map(function scan(file,): DeadFunctions {
      /**
       Parsed file.
       */
      const { program, } = parseSource({ file, },);
      /**
       Identifier counts in it.
       */
      const counts = identifierCounts({ program, },);
      /**
       Names its export lists carry.
       */
      const listed = listedExports({ program, },);
      /**
       Its top-level functions nothing in the file uses beyond their declaration.
       */
      const unused = topFunctions({ program, },).filter(function unusedHere({ name, },): boolean {
        return (counts.get(name,) ?? 0) <= 1;
      },);
      return {
        private: unused
          .filter(function isPrivate({ name, exported, },): boolean {
            return (!exported) && (!listed.has(name,));
          },)
          .map(function located({ name, },): string {
            return `${file.path}#${name}`;
          },),
        exported: unused
          .filter(function namedNowhereElse({ name, exported, },): boolean {
            return (exported || listed.has(name,)) && (!files.some(function names(other,): boolean {
              return (other.path !== file.path) && namesWord({ text: other.text, name, },);
            },));
          },)
          .map(function located({ name, },): string {
            return `${file.path}#${name}`;
          },),
      };
    },);
  return {
    private: found.flatMap(function privateOf(dead,): readonly string[] {
      return dead.private;
    },)
      .toSorted(),
    exported: found.flatMap(function exportedOf(dead,): readonly string[] {
      return dead.exported;
    },)
      .toSorted(),
  };
}

/**
 A fixture file, as the scan reads one.

 @param path - file name

 @param text - file text

 @param isTest - whether it stands for a test

 @returns Source file

 @example
 ```ts
 const file = fixture({ path: 'cat.ts', text: 'function nap() {}', isTest: false, },);
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
  name: 'functions nothing calls',
  children: [
    it({
      name: 'FINDS a private function its file never names and an export no other file names, and leaves the '
        + 'ones called in their file, named in another source file or in a test, or exported by a list',
      fn: async () => {
        expect(deadFunctions({
          files: [
            fixture({
              path: 'cat.ts',
              text: [
                'function nap(): number { return 1; }',
                'function purr(): number { return 2; }',
                'export function loaf(): number { return purr(); }',
                'export function stretch(): number { return 3; }',
                'export const groom = (): number => 4;',
                'const knead = (): number => 5;',
                'export { knead, };',
                'export function yawn(): number { return 6; }',
              ].join('\n',),
              isTest: false,
            },),
            fixture({
              path: 'bowl.ts',
              text: 'import { loaf, knead, } from \'./cat.ts\';\nexport const meal = loaf() + knead();',
              isTest: false,
            },),
            fixture({
              path: 'cat.unit.test.ts',
              text: 'import { groom, } from \'./cat.ts\';\ngroom();\n// stretching is a longer word, which names nothing',
              isTest: true,
            },),
          ],
        },),).toEqual({
          private: ['cat.ts#nap',],
          exported: ['cat.ts#stretch', 'cat.ts#yawn',],
        },);
      },
    },),
    it({
      name: 'FINDS NO FUNCTION NOTHING CALLS across the package\'s source',
      fn: async () => {
        /**
         Every package file, tests among them as namers.
         */
        const files = await readPackageSource();
        expect(files.some(function isSource(file,): boolean {
          return !file.isTest;
        },),).toBe(true,);
        expect(deadFunctions({ files, },),).toEqual({
          private: [],
          exported: [],
        },);
      },
    },),
  ],
},);
