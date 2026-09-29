/**
 Guards against functions nothing calls (audit area six, ledger B19, B20,
 B30): a top-level function private to its file must be named in that file
 beyond its own declaration, and every top-level function must be reached
 from production. `isAnchored` outlived the change that stopped reading it,
 and `uniqueRosterModelIds` the loop it served, and nothing reported either.

 REACH, NOT NAMING (ledger B30). The first form of this guard counted a test,
 or a barrel's re-export list, as naming an export, so 57 functions only
 tests called passed it: wrappers over parts production calls apart, modules
 built beside the live path and superseded, and test support shipped as
 package source. Production's roots are every source file's module-level
 code, which is where the runner entries call their main and where tables
 run on import; a function is reached once reached code names it outside a
 type. Matching is by name, so a name two functions share keeps both
 reached, and the error is only toward calling code reached.

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
   Functions production does not reach, the private ones already listed
   left out, and the allowed seams too.
   */
  readonly unreached: readonly string[];

  /**
   Allowed seams production reaches or no file declares, so the allowance
   no longer describes the source.
   */
  readonly staleSeams: readonly string[];
};

/**
 A top-level function, whether its file exports it inline, and the node
 whose names it reaches when it runs.
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

  /**
   Its declaration or function expression.
   */
  readonly body: TreeNode;
};

/**
 A top-level function and the file declaring it.
 */
type LocatedFunction = TopFunction & {
  /**
   File declaring it, relative to `src`.
   */
  readonly path: string;
};

/**
 Seams production never calls and the guard allows, each as `path#name`,
 with why no fixture can stand in for it.

 `resetRunSpend` zeroes the process-wide spend meter between the test cases
 one process runs; the meter is module-private state, which no fixture can
 reach without an export (ledger B30, a choice the owner may veto for a meter
 passed in).
 */
const PACKAGE_SEAMS: ReadonlySet<string> = new Set(['run-spend-meter.ts#resetRunSpend',],);

/**
 Syntax that stands in a type position, whose names run nothing.
 */
const TYPE_POSITIONS: ReadonlySet<string> = new Set([
  'TSTypeAnnotation',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSTypeParameterInstantiation',
  'TSTypeParameterDeclaration',
  'TSTypeQuery',
  'TSTypeReference',
],);

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
 Identifiers a node names where they run, type positions left out.

 @param node - node read

 @returns Names, each once

 @example
 ```ts
 const names = runtimeNames({ node: statement, },);
 ```
 */
function runtimeNames({ node, }: { readonly node: TreeNode; },): ReadonlySet<string> {
  /**
   Names so far.
   */
  const names = new Set<string>();
  /**
   Nodes still to visit.
   */
  const pending: TreeNode[] = [node,];
  while (pending.length > 0) {
    /**
     Node visited now.
     */
    const current = pending.pop() as TreeNode;
    if (!TYPE_POSITIONS.has(current.type,)) {
      if ((current.type === 'Identifier') && ((typeof current.name) === 'string'))
        names.add(current.name as string,);
      pending.push(...childNodes({ node: current, },),);
    }
  }
  return names;
}

/**
 The declaration a top-level statement carries, past an inline `export`.

 @param statement - top-level statement

 @returns The statement, or the declaration its `export` wraps

 @example
 ```ts
 const declaration = declarationOf({ statement, },);
 ```
 */
function declarationOf({ statement, }: { readonly statement: TreeNode; },): TreeNode {
  return ((statement.type === 'ExportNamedDeclaration') && isTreeNode(statement.declaration,))
    ? statement.declaration
    : statement;
}

/**
 The functions one declaration introduces: a function declaration, or
 variables initialised with a function.

 @param declaration - top-level declaration

 @param exported - whether an inline `export` wraps it

 @returns Its functions, none for any other declaration

 @example
 ```ts
 const functions = functionsDeclared({ declaration, exported: false, },);
 ```
 */
function functionsDeclared(
  {
    declaration,
    exported,
  }: {
    readonly declaration: TreeNode;
    readonly exported: boolean;
  },
): readonly TopFunction[] {
  if ((declaration.type === 'FunctionDeclaration') && isTreeNode(declaration.id,)) {
    return [{
      name: declaration.id.name as string,
      exported,
      body: declaration,
    },];
  }
  if (declaration.type !== 'VariableDeclaration')
    return [];
  return (declaration.declarations as readonly TreeNode[]).flatMap(function initialised(item,): readonly TopFunction[] {
    if ((!isTreeNode(item.id,)) || (item.id.type !== 'Identifier') || (!isTreeNode(item.init,)))
      return [];
    if ((item.init.type !== 'ArrowFunctionExpression') && (item.init.type !== 'FunctionExpression'))
      return [];
    return [{
      name: item.id.name as string,
      exported,
      body: item.init,
    },];
  },);
}

/**
 The functions a file declares at its top level.

 @param program - parsed program

 @returns Its top-level functions

 @example
 ```ts
 const functions = topFunctions({ program, },);
 ```
 */
function topFunctions({ program, }: { readonly program: TreeNode; },): readonly TopFunction[] {
  return (program.body as readonly TreeNode[]).flatMap(function declared(statement,): readonly TopFunction[] {
    return functionsDeclared({
      declaration: declarationOf({ statement, },),
      exported: (statement.type === 'ExportNamedDeclaration') && isTreeNode(statement.declaration,),
    },);
  },);
}

/**
 A file's module-level code: every top-level statement but imports, export
 lists and the functions it declares, which run only when named.

 @param program - parsed program

 @returns Statements that run when the file loads

 @example
 ```ts
 const roots = moduleLevelCode({ program, },);
 ```
 */
function moduleLevelCode({ program, }: { readonly program: TreeNode; },): readonly TreeNode[] {
  return (program.body as readonly TreeNode[]).filter(function runsOnLoad(statement,): boolean {
    if ((statement.type === 'ImportDeclaration') || (statement.type === 'ExportAllDeclaration'))
      return false;
    if ((statement.type === 'ExportNamedDeclaration') && (!isTreeNode(statement.declaration,)))
      return false;
    return functionsDeclared({
      declaration: declarationOf({ statement, },),
      exported: false,
    },)
      .length === 0;
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
 Private functions nothing in their file names beyond their declaration.

 @param path - file path, for the location

 @param program - parsed program

 @returns Each as `path#name`

 @example
 ```ts
 const unnamed = unnamedPrivates({ path: 'cat.ts', program, },);
 ```
 */
function unnamedPrivates(
  {
    path,
    program,
  }: {
    readonly path: string;
    readonly program: TreeNode;
  },
): readonly string[] {
  /**
   Identifier counts in the file.
   */
  const counts = identifierCounts({ program, },);
  /**
   Names its export lists carry.
   */
  const listed = listedExports({ program, },);
  return topFunctions({ program, },)
    .filter(function unnamedPrivate({ name, exported, },): boolean {
      return (!exported) && (!listed.has(name,)) && ((counts.get(name,) ?? 0) <= 1);
    },)
    .map(function located({ name, },): string {
      return `${path}#${name}`;
    },);
}

/**
 Functions production's module-level code reaches, by walking the names
 reached code carries.

 @param functions - every top-level function in the source files

 @param roots - every source file's module-level code

 @returns Functions reached

 @example
 ```ts
 const reached = reachedFunctions({ functions, roots, },);
 ```
 */
function reachedFunctions(
  {
    functions,
    roots,
  }: {
    readonly functions: readonly LocatedFunction[];
    readonly roots: readonly TreeNode[];
  },
): ReadonlySet<LocatedFunction> {
  /**
   Functions under each name; two files may declare the same one.
   */
  const byName = Map.groupBy(
    functions,
    function nameOf({ name, },): string {
      return name;
    },
  );
  /**
   Functions reached so far.
   */
  const reached = new Set<LocatedFunction>();
  /**
   Reached code whose names are still to read.
   */
  const pending: TreeNode[] = [...roots,];
  while (pending.length > 0) {
    /**
     Code read now.
     */
    const code = pending.pop() as TreeNode;
    /**
     Functions its names reach for the first time.
     */
    const fresh = [...runtimeNames({ node: code, },),]
      .flatMap(function named(name,): readonly LocatedFunction[] {
        return byName.get(name,) ?? [];
      },)
      .filter(function unseen(located,): boolean {
        return !reached.has(located,);
      },);
    for (const located of fresh) {
      reached.add(located,);
      pending.push(located.body,);
    }
  }
  return reached;
}

/**
 Every function nothing calls across a set of files; only source files are
 scanned and only source files reach, so a test naming a function never
 makes it reached.

 @param files - the package's files

 @param seams - functions allowed to go unreached, each as `path#name`

 @returns Dead functions by kind, and allowances that no longer hold

 @example
 ```ts
 const dead = deadFunctions({ files, seams: PACKAGE_SEAMS, },);
 ```
 */
function deadFunctions(
  {
    files,
    seams,
  }: {
    readonly files: readonly SourceText[];
    readonly seams: ReadonlySet<string>;
  },
): DeadFunctions {
  /**
   Every source file, parsed once.
   */
  const parsed = files
    .filter(function isSource(file,): boolean {
      return !file.isTest;
    },)
    .map(function parse(file,): {
      readonly path: string;
      readonly program: TreeNode;
    } {
      return {
        path: file.path,
        program: parseSource({ file, },).program,
      };
    },);
  /**
   Private functions their file never names.
   */
  const unnamed = parsed
    .flatMap(unnamedPrivates,)
    .toSorted();
  /**
   Every top-level function, located.
   */
  const functions = parsed.flatMap(function located({ path, program, },): readonly LocatedFunction[] {
    return topFunctions({ program, },).map(function withPath(top,): LocatedFunction {
      return {
        ...top,
        path,
      };
    },);
  },);
  /**
   Functions production reaches.
   */
  const reached = reachedFunctions({
    functions,
    roots: parsed.flatMap(function rootsOf({ program, },): readonly TreeNode[] {
      return moduleLevelCode({ program, },);
    },),
  },);
  /**
   Every function production does not reach, as `path#name`.
   */
  const notReached = functions
    .filter(function unreachedHere(located,): boolean {
      return !reached.has(located,);
    },)
    .map(function toKey({ path, name, },): string {
      return `${path}#${name}`;
    },);
  return {
    private: unnamed,
    unreached: notReached
      .filter(function unlisted(key,): boolean {
        return (!unnamed.includes(key,)) && (!seams.has(key,));
      },)
      .toSorted(),
    staleSeams: [...seams,]
      .filter(function heldNoLonger(key,): boolean {
        return !notReached.includes(key,);
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

/**
 The cat fixtures: one source file holding a function of every kind, a
 barrel re-exporting two, a bowl calling two at module level, and a test
 calling one.
 */
const CAT_FILES: readonly SourceText[] = [
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
      'function hiss(): number { return 7; }',
      'export function pounce(): number { return hiss(); }',
      'export function shape(): number { return 8; }',
      'export type Shape = ReturnType<typeof shape>;',
      'export const PERCH = 9 as unknown as ReturnType<typeof shape>;',
      'export function tally(): number { return 10; }',
      'export const TOTAL = tally();',
      'export function reset(): void {}',
    ].join('\n',),
    isTest: false,
  },),
  fixture({
    path: 'barrel.ts',
    text: 'export { yawn, pounce, reset, } from \'./cat.ts\';',
    isTest: false,
  },),
  fixture({
    path: 'bowl.ts',
    text: 'import { loaf, knead, } from \'./cat.ts\';\nexport const meal = loaf() + knead();',
    isTest: false,
  },),
  fixture({
    path: 'cat.unit.test.ts',
    text: 'import { groom, reset, } from \'./cat.ts\';\ngroom();\nreset();',
    isTest: true,
  },),
];

await describe({
  name: 'functions nothing calls',
  children: [
    it({
      name: 'FINDS a private function its file never names, and every function production does not reach: '
        + 'one nothing names, one only a test calls, ones only a barrel re-exports and the private one '
        + 'only they call, and one named only in types; KEEPS the ones module-level code reaches, directly '
        + 'or through another, and the allowed seam',
      fn: async () => {
        expect(deadFunctions({
          files: CAT_FILES,
          seams: new Set(['cat.ts#reset',],),
        },),).toEqual({
          private: ['cat.ts#nap',],
          unreached: [
            'cat.ts#groom',
            'cat.ts#hiss',
            'cat.ts#pounce',
            'cat.ts#shape',
            'cat.ts#stretch',
            'cat.ts#yawn',
          ],
          staleSeams: [],
        },);
      },
    },),
    it({
      name: 'NAMES an allowed seam production reaches, or no file declares, as stale',
      fn: async () => {
        expect(deadFunctions({
          files: CAT_FILES,
          seams: new Set([
            'cat.ts#reset',
            'cat.ts#tally',
            'cat.ts#scratch',
          ],),
        },).staleSeams,).toEqual(['cat.ts#scratch', 'cat.ts#tally',],);
      },
    },),
    it({
      name: 'FINDS NO FUNCTION NOTHING CALLS across the package\'s source, and no stale seam',
      fn: async () => {
        /**
         Every package file, tests among them, which never reach.
         */
        const files = await readPackageSource();
        expect(files.some(function isSource(file,): boolean {
          return !file.isTest;
        },),).toBe(true,);
        expect(deadFunctions({
          files,
          seams: PACKAGE_SEAMS,
        },),).toEqual({
          private: [],
          unreached: [],
          staleSeams: [],
        },);
      },
    },),
  ],
},);
