/**
 Guards the one way a runner reads its command line (ledger B75): each
 runner hands `process.argv` and its own name to `reportingRefusals`, which
 reads the whole line against the runner's declaration in
 `corpus-run/command-lines.ts` before the body starts. Runners that found
 their own flags in `process.argv` read any spelling but the exact token as
 not written, and one that reads the line for itself again would read flags
 its declaration, its usage line and its refusals never name.

 WHAT THE SCAN READS, in the package's source; tests and test fixtures build
 their own lines and are not read. `argv` read off `process`, or off a
 default or namespace import of `node:process`, written as a member, an
 indexed member, an optional member or through a parenthesis or type
 assertion; `argv` destructured from `process`; `argv` imported by name from
 `node:process`; `parseArgs`, which reads `process.argv` when handed no
 arguments, imported by name from `node:util` or read off a default or
 namespace import of it; and any dynamic import of either module. A read of
 `process.argv` is allowed only as the `argv` a `reportingRefusals` call is
 handed; that call must name its own runner as a written string. Out of the
 scan's reach: `process` reached through `globalThis` or handed on whole, and
 a property name built at run time.

 THE FIXTURE CASE COMES FIRST, so the package-wide case is read against a
 scan shown able to find each form (ledger M21). Fixtures are cat-themed; the
 package case reads this package's own source.

 @module
 */

import { basename, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { nodeEntries, } from '../dist/final/node/index.mjs';
import {
  childNodes,
  isTreeNode,
  parseSource,
  readPackageSource,
  type SourceText,
  type TreeNode,
} from './source-scan.test-fixture.ts';

/**
 Specifiers of the module `process` is.
 */
const PROCESS_MODULES: ReadonlySet<string> = new Set(['node:process', 'process',],);

/**
 Specifiers of the module `parseArgs` comes from.
 */
const UTIL_MODULES: ReadonlySet<string> = new Set(['node:util', 'util',],);

/**
 Node kinds that wrap one expression without changing what it names.
 */
const WRAPPER_KINDS: ReadonlySet<string> = new Set([
  'ChainExpression',
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
],);

/**
 The call every runner hands its line to.
 */
const HAND_OFF = 'reportingRefusals';

/**
 Reads allowed outside a runner's hand-off, each as `path: what`, with why.
 */
const ALLOWED: Readonly<Record<string, string>> = {
  'corpus-run/command-line.ts: imports parseArgs from node:util':
    'the one reader of the whole line, which hands parseArgs the arguments after the script and reads its '
    + 'tokens against the declaration',
};

/**
 Folder the runner entries sit in, as the scan names paths.
 */
const RUNNER_FOLDER = 'corpus-run/';

/**
 Name an identifier node carries.

 @param node - node read

 @returns Its name, empty for any other node

 @example
 ```ts
 const name = identifierName({ node: call.callee, },);
 ```
 */
function identifierName({ node, }: { readonly node: unknown; },): string {
  if ((!isTreeNode(node,)) || (node.type !== 'Identifier'))
    return '';
  /**
   The node's name field.
   */
  const { name, } = node;
  return ((typeof name) === 'string') ? (name as string) : '';
}

/**
 Text a string literal node carries.

 @param node - node read

 @returns Its value, empty for any other node

 @example
 ```ts
 const from = literalText({ node: declaration.source, },);
 ```
 */
function literalText({ node, }: { readonly node: unknown; },): string {
  if ((!isTreeNode(node,)) || (node.type !== 'Literal') || ((typeof node.value) !== 'string'))
    return '';
  return node.value as string;
}

/**
 The expression a wrapper holds, unwrapped until it is none.

 @param node - expression read

 @returns The innermost expression the wrappers hold, the node itself when it
 is no wrapper

 @example
 ```ts
 const object = unwrapped({ node: member.object, },); // process for (process as NodeJS.Process)
 ```
 */
function unwrapped({ node, }: { readonly node: unknown; },): unknown {
  /**
   Expression reached so far.
   */
  let inner = node;
  while (isTreeNode(inner,) && WRAPPER_KINDS.has(inner.type,))
    inner = inner.expression;
  return inner;
}

/**
 Name of the property a member expression or object property names, as
 written: an identifier, or a string in brackets or quotes.

 @param node - member expression or property

 @param key - field holding the name: `property` for a member, `key` for a
 property

 @returns The name, empty when it is built at run time

 @example
 ```ts
 const name = propertyName({ node: member, key: 'property', },); // 'argv' for process['argv']
 ```
 */
function propertyName(
  {
    node,
    key,
  }: {
    readonly node: TreeNode;
    readonly key: 'property' | 'key';
  },
): string {
  /**
   The name node.
   */
  const named = node[key];
  if (node.computed === true)
    return literalText({ node: named, },);
  return identifierName({ node: named, },) || literalText({ node: named, },);
}

/**
 Every node under a root, the root included, walked with a stack.

 @param root - node to walk from

 @returns Nodes in no particular order

 @example
 ```ts
 const nodes = nodesUnder({ root: program, },);
 ```
 */
function nodesUnder({ root, }: { readonly root: TreeNode; },): readonly TreeNode[] {
  /**
   Nodes visited.
   */
  const visited: TreeNode[] = [];

  /**
   Nodes still to visit.
   */
  const pending: TreeNode[] = [root,];
  while (pending.length > 0) {
    /**
     Node visited now.
     */
    const node = pending.pop() as TreeNode;
    visited.push(node,);
    pending.push(...childNodes({ node, },),);
  }
  return visited;
}

/**
 Local names a file binds to a whole module, by default or namespace import.

 @param nodes - the file's nodes

 @param modules - specifiers of the module

 @returns Local names

 @example
 ```ts
 const names = wholeModuleNames({ nodes, modules: PROCESS_MODULES, },); // ['proc'] for import proc from 'node:process'
 ```
 */
function wholeModuleNames(
  {
    nodes,
    modules,
  }: {
    readonly nodes: readonly TreeNode[];
    readonly modules: ReadonlySet<string>;
  },
): ReadonlySet<string> {
  return new Set(
    nodes
      .filter(function importsModule(node,): boolean {
        return (node.type === 'ImportDeclaration') && modules.has(literalText({ node: node.source, },),);
      },)
      .flatMap(function wholeNames(declaration,): readonly string[] {
        return (declaration.specifiers as readonly TreeNode[])
          .filter(function isWhole(specifier,): boolean {
            return (specifier.type === 'ImportDefaultSpecifier') || (specifier.type === 'ImportNamespaceSpecifier');
          },)
          .map(function localName(specifier,): string {
            return identifierName({ node: specifier.local, },);
          },);
      },),
  );
}

/**
 What one file's source reads of the command line outside a runner's
 hand-off, and whether it hands its line on as a runner does.

 @param file - file read

 @returns Each read as `path: what`, and whether a hand-off names this file's
 runner and hands it `process.argv`

 @example
 ```ts
 const { reads, handsOff, } = commandLineReadsOf({ file, },);
 ```
 */
function commandLineReadsOf({ file, }: { readonly file: SourceText; },): {
  readonly reads: readonly string[];
  readonly handsOff: boolean;
} {
  /**
   Every node in the file.
   */
  const nodes = nodesUnder({ root: parseSource({ file, },).program, },);

  /**
   Names `process` goes by here: the global and any whole import of it.
   */
  const processNames = new Set([
    'process',
    ...wholeModuleNames({
      nodes,
      modules: PROCESS_MODULES,
    },),
  ],);

  /**
   Names a whole import of the util module goes by here.
   */
  const utilNames = wholeModuleNames({
    nodes,
    modules: UTIL_MODULES,
  },);

  /**
   Whether a member expression reads `argv` off `process`.

   @param node - node read

   @returns True for `process.argv` in any of its spellings

   @example
   ```ts
   const reads = readsArgv({ node, },);
   ```
   */
  function readsArgv({ node, }: { readonly node: unknown; },): boolean {
    /**
     The node without its wrappers.
     */
    const member = unwrapped({ node, },);
    return isTreeNode(member,)
      && (member.type === 'MemberExpression')
      && processNames.has(identifierName({ node: unwrapped({ node: member.object, },), },),)
      && (propertyName({
        node: member,
        key: 'property',
      },) === 'argv');
  }

  /**
   Runner this file is, by its name, when it sits among the runners.
   */
  const runner = file.path.startsWith(RUNNER_FOLDER,)
    ? basename(
      file.path,
      '.ts',
    )
    : '';

  /**
   Start offsets of the `process.argv` reads a hand-off is given.
   */
  const handedOn = new Set<number>();

  /**
   What the file reads, as `path: what`.
   */
  const reads: string[] = [];

  /**
   Whether a hand-off names this file's runner and hands it `process.argv`.
   */
  let handsOff = false;

  for (const node of nodes) {
    if ((node.type !== 'CallExpression') || (identifierName({ node: node.callee, },) !== HAND_OFF))
      continue;
    /**
     The object the call is handed, absent when it is handed none.
     */
    const [options,] = node.arguments as readonly unknown[];
    /**
     Its properties, by name as written.
     */
    const properties = new Map(
      (isTreeNode(options,) && (options.type === 'ObjectExpression')
        ? options.properties as readonly TreeNode[]
        : [])
        .map(function named(property,): [string, TreeNode,] {
          return [
            propertyName({
              node: property,
              key: 'key',
            },),
            property,
          ];
        },),
    );
    /**
     The `argv` the call is handed.
     */
    const argv = properties.get('argv',)?.value;

    /**
     The runner the call names.
     */
    const what = literalText({ node: properties.get('what',)?.value, },);
    if (readsArgv({ node: argv, },))
      handedOn.add((unwrapped({ node: argv, },) as TreeNode).start,);
    else
      reads.push(`${file.path}: hands ${HAND_OFF} an argv other than process.argv`,);
    if ((what === '') || (what !== runner))
      reads.push(`${file.path}: hands ${HAND_OFF} what ${JSON.stringify(what,)}`,);
    if (readsArgv({ node: argv, },) && (runner !== '') && (what === runner))
      handsOff = true;
  }

  for (const node of nodes) {
    if ((node.type === 'MemberExpression') && readsArgv({ node, },) && (!handedOn.has(node.start,)))
      reads.push(`${file.path}: reads argv off process`,);
    if (
      (node.type === 'MemberExpression')
      && utilNames.has(identifierName({ node: unwrapped({ node: node.object, },), },),)
      && (propertyName({
        node,
        key: 'property',
      },) === 'parseArgs')
    )
      reads.push(`${file.path}: reads parseArgs off node:util`,);
    if (
      (node.type === 'VariableDeclarator')
      && isTreeNode(node.id,)
      && (node.id.type === 'ObjectPattern')
      && processNames.has(identifierName({ node: unwrapped({ node: node.init, },), },),)
      && (node.id.properties as readonly TreeNode[]).some(function namesArgv(property,): boolean {
        return (property.type === 'Property') && (propertyName({
          node: property,
          key: 'key',
        },) === 'argv');
      },)
    )
      reads.push(`${file.path}: destructures argv from process`,);
    if (node.type === 'ImportExpression') {
      /**
       Module the dynamic import names, empty when built at run time.
       */
      const from = literalText({ node: node.source, },);
      if (PROCESS_MODULES.has(from,) || UTIL_MODULES.has(from,) || (from === ''))
        reads.push(`${file.path}: imports ${JSON.stringify(from,)} dynamically`,);
    }
    if (node.type === 'ImportDeclaration') {
      /**
       Module the import names.
       */
      const from = literalText({ node: node.source, },);
      for (const specifier of node.specifiers as readonly TreeNode[]) {
        /**
         Name imported, whatever the local alias.
         */
        const imported = identifierName({ node: specifier.imported, },) || literalText({ node: specifier.imported, },);
        if (PROCESS_MODULES.has(from,) && (imported === 'argv'))
          reads.push(`${file.path}: imports argv from node:process`,);
        if (UTIL_MODULES.has(from,) && (imported === 'parseArgs'))
          reads.push(`${file.path}: imports parseArgs from node:util`,);
      }
    }
  }
  return {
    reads,
    handsOff,
  };
}

/**
 What the package's source reads of the command line outside the runners'
 hand-offs, and which files hand their line on.

 @param files - files read; tests and fixtures are skipped

 @returns Reads as `path: what`, sorted with repeats kept, and the files that
 hand their line on, sorted

 @example
 ```ts
 const { reads, handOffs, } = commandLineReads({ files, },);
 ```
 */
function commandLineReads({ files, }: { readonly files: readonly SourceText[]; },): {
  readonly reads: readonly string[];
  readonly handOffs: readonly string[];
} {
  /**
   Each source file's reads and hand-off.
   */
  const scanned = files
    .filter(function isSource({ isTest, },): boolean {
      return !isTest;
    },)
    .map(function scanOne(file,): {
      readonly path: string;
      readonly reads: readonly string[];
      readonly handsOff: boolean;
    } {
      return {
        path: file.path,
        ...commandLineReadsOf({ file, },),
      };
    },);
  return {
    reads: scanned
      .flatMap(function readsOf({ reads, },): readonly string[] {
        return reads;
      },)
      .toSorted(),
    handOffs: scanned
      .filter(function handsOff({ handsOff: hands, },): boolean {
        return hands;
      },)
      .map(function pathOf({ path, },): string {
        return path;
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
  name: 'command-line reads (ledger B75)',
  children: [
    it({
      name: 'FINDS argv read off process in every spelling, destructured or imported, parseArgs imported or read '
        + 'off the module, dynamic imports, and hand-offs naming another runner or another argv, and leaves '
        + 'a runner\'s own hand-off, other names and tests',
      fn: async () => {
        expect(commandLineReads({
          files: [
            fixture({
              path: 'corpus-run/nap-report.ts',
              text: 'await reportingRefusals({ what: \'nap-report\', argv: process.argv, run: async () => {}, },);',
              isTest: false,
            },),
            fixture({
              path: 'corpus-run/purr-report.ts',
              text: [
                'await reportingRefusals({ what: \'nap-report\', argv: process.argv, run: async () => {}, },);',
                'await reportingRefusals({ what: \'purr-report\', argv: [\'node\', \'purr.mjs\',], run: '
                + 'async () => {}, },);',
              ].join('\n',),
              isTest: false,
            },),
            fixture({
              path: 'whiskers.ts',
              text: [
                'import { parseArgs as split, promisify, } from \'node:util\';',
                'import { argv as typed, env, } from \'node:process\';',
                'import proc from \'node:process\';',
                'import * as utils from \'util\';',
                'const { argv, } = process;',
                'const { env: home, } = process;',
                'export const naps = [',
                '  process.argv[2], process[\'argv\'], process?.argv, (process as NodeJS.Process).argv,',
                '  process!.argv, proc.argv, utils.parseArgs, process.env, typed, argv, split, promisify, env,',
                '  home, await import(\'node:process\'), await import(\'node:fs\'),',
                '];',
              ].join('\n',),
              isTest: false,
            },),
            fixture({
              path: 'cat.unit.test.ts',
              text: 'import { parseArgs, } from \'node:util\'; export const nap = [process.argv, parseArgs,];',
              isTest: true,
            },),
          ],
        },),).toEqual({
          reads: [
            'corpus-run/purr-report.ts: hands reportingRefusals an argv other than process.argv',
            'corpus-run/purr-report.ts: hands reportingRefusals what "nap-report"',
            'whiskers.ts: destructures argv from process',
            'whiskers.ts: imports "node:process" dynamically',
            'whiskers.ts: imports argv from node:process',
            'whiskers.ts: imports parseArgs from node:util',
            'whiskers.ts: reads argv off process',
            'whiskers.ts: reads argv off process',
            'whiskers.ts: reads argv off process',
            'whiskers.ts: reads argv off process',
            'whiskers.ts: reads argv off process',
            'whiskers.ts: reads argv off process',
            'whiskers.ts: reads parseArgs off node:util',
          ],
          handOffs: ['corpus-run/nap-report.ts',],
        },);
      },
    },),
    it({
      name: 'READS THE COMMAND LINE only in each runner\'s own hand-off and the one reader, and every runner '
        + 'the build makes hands its line on',
      fn: async () => {
        /**
         Runner entry files, as the scan names paths.
         */
        const runners = Object.entries(nodeEntries,)
          .filter(function isRunner([name,],): boolean {
            return name !== 'index';
          },)
          .map(function scanPath([, path,],): string {
            return path.slice('./src/'.length,);
          },)
          .toSorted();
        expect(commandLineReads({ files: await readPackageSource(), },),).toEqual({
          reads: Object.keys(ALLOWED,).toSorted(),
          handOffs: runners,
        },);
      },
    },),
  ],
},);
