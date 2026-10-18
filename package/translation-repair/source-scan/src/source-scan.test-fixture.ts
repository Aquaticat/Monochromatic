import { readFileSync, } from 'node:fs';
import {
  readdir,
  readFile,
} from 'node:fs/promises';
import {
  join,
  resolve,
} from 'node:path';

// Rolldown's parser (oxc), as the repository's import-attributes plugin reads
// source; TypeScript 7 exposes no stable compiler API to parse with.
import { parseSync, } from 'rolldown/utils';

//region Source scan
// What the package-wide guards over the translation-repair family's source share (audit
// area six, ledger B19): the family's TypeScript files as text, each parsed
// once, a walk over the syntax tree, and the reading of names and wrapped
// expressions the scans share. Every scan that parses the source parses it
// here (scans that read the text alone, such as `log-root-scan.unit.test.ts`,
// list the files themselves); the walk and name helpers came here with ledger
// B77, and the scans written before it still carry copies of their own.
//
// ONE PROGRAM, ONE KEY. The family is split into packages under
// `package/translation-repair`, and the scans measure it as the one program it was
// before the split. Every file is named by its package directory and its path under that
// package's `src`, joined by a slash (`adjudication/adjudicate-prompt.ts`,
// `run/corpus-run/cli-refusal.ts`), since every package has a `src/index.ts` and a bare
// path would name several files. Allowlists, findings and locations all use this key.

/**
 One TypeScript file under a family package's `src`.
 */
export type SourceText = {
  /**
   Package directory and path relative to that package's `src`, joined by a slash, which names locations.
   */
  readonly path: string;

  /**
   File text.
   */
  readonly text: string;

  /**
   Whether it is a test or a test fixture rather than package source.
   */
  readonly isTest: boolean;
};

/**
 An ESTree node as the scans read it: its kind, its offsets and its fields.
 */
export type TreeNode = Readonly<Record<string, unknown>> & {
  readonly type: string;
  readonly start: number;
  readonly end: number;
};

/**
 A parsed file: its program and its comments, in order.
 */
type ParsedSource = {
  /**
   Program node.
   */
  readonly program: TreeNode;

  /**
   Comments with their offsets.
   */
  readonly comments: readonly {
    readonly start: number;
    readonly end: number
  }[];
};

/**
 Whether a value is an ESTree node with offsets.

 @param value - field of a node

 @returns Whether it is a node

 @example
 ```ts
 const node = isTreeNode(program.body[0],);
 ```
 */
export function isTreeNode(value: unknown,): value is TreeNode {
  return ((typeof value) === 'object') && (value !== null)
    && ('type' in value)
    && ((typeof value.type) === 'string')
    && ('start' in value)
    && ((typeof value.start) === 'number')
    && ('end' in value)
    && ((typeof value.end) === 'number');
}

/**
 Every node held in a node's fields, lists flattened.

 @param node - node read

 @returns Its child nodes

 @example
 ```ts
 const children = childNodes({ node: program, },);
 ```
 */
export function childNodes({ node, }: { readonly node: TreeNode; },): readonly TreeNode[] {
  return Object.values(node,)
    .flatMap(function children(value,): readonly unknown[] {
      return Array.isArray(value,) ? value : [value,];
    },)
    .filter(isTreeNode,);
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
export function nodesUnder({ root, }: { readonly root: TreeNode; },): readonly TreeNode[] {
  /**
   Nodes visited.
   */
  const visited: TreeNode[] = [];

  /**
   Nodes still to visit.
   */
  const pending: TreeNode[] = [root,];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    visited.push(node,);
    pending.push(...childNodes({ node, },),);
  }
  return visited;
}

/**
 Every node of a parsed file with the node that holds it.

 @param program - file's program

 @returns Each node's parent, the program having none

 @example
 ```ts
 const parents = parentsOf({ program, },);
 ```
 */
export function parentsOf({ program, }: { readonly program: TreeNode; },): ReadonlyMap<TreeNode, TreeNode> {
  /**
   Parents found so far.
   */
  const parents = new Map<TreeNode, TreeNode>();
  /**
   Nodes still to visit.
   */
  const pending: TreeNode[] = [program,];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    for (const child of childNodes({ node, },)) {
      parents.set(
        child,
        node,
      );
      pending.push(child,);
    }
  }
  return parents;
}

/**
 The nodes holding a node, nearest first.

 @param node - node read

 @param parents - each node's parent

 @returns Its ancestors up to the program

 @example
 ```ts
 const chain = ancestorsOf({ node, parents, },);
 ```
 */
export function ancestorsOf(
  {
    node,
    parents,
  }: {
    readonly node: TreeNode;
    readonly parents: ReadonlyMap<TreeNode, TreeNode>;
  },
): readonly TreeNode[] {
  /**
   Ancestors found so far.
   */
  const chain: TreeNode[] = [];
  for (let at = parents.get(node,); at !== undefined; at = parents.get(at,))
    chain.push(at,);
  return chain;
}

/**
 Name an identifier node carries.

 @param node - node read, of any kind or none

 @returns Its name, empty for any other node

 @example
 ```ts
 const name = identifierName({ node: call.callee, },);
 ```
 */
export function identifierName({ node, }: { readonly node: unknown; },): string {
  if ((!isTreeNode(node,)) || (node.type !== 'Identifier'))
    return '';
  /**
   The node's name field.
   */
  const { name, } = node;
  return ((typeof name) === 'string') ? name : '';
}

/**
 Name a member expression reads, written plainly or computed from a string.

 @param node - member expression read

 @returns The member's name, empty where it is computed from anything but a
 string literal

 @example
 ```ts
 const member = memberName({ node: call.callee, },); // 'now' for Date['now']
 ```
 */
export function memberName({ node, }: { readonly node: TreeNode; },): string {
  if (node.computed !== true)
    return identifierName({ node: node.property, },);
  /**
   The computed key.
   */
  const { property, } = node;
  if ((!isTreeNode(property,)) || (property.type !== 'Literal'))
    return '';
  /**
   The literal's value.
   */
  const { value, } = property;
  return ((typeof value) === 'string') ? value as string : '';
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
export function literalText({ node, }: { readonly node: unknown; },): string {
  if ((!isTreeNode(node,)) || (node.type !== 'Literal'))
    return '';
  /**
   The literal's value, of whatever kind.
   */
  const { value, } = node;
  return ((typeof value) === 'string') ? value : '';
}

/**
 Node kinds that wrap one expression without changing the value it holds.
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
 The wrappers around an expression, outermost first, and what they hold.

 @param node - expression read

 @returns Each wrapper in turn, and the innermost expression, the node itself
 when it is no wrapper

 @example
 ```ts
 const { wrappers, inner, } = unwrapped({ node: declarator.init, },); // inner is the object of ({ tabby: 1 }) as const
 ```
 */
export function unwrapped({ node, }: { readonly node: unknown; },): {
  readonly wrappers: readonly TreeNode[];
  readonly inner: unknown;
} {
  /**
   Wrappers passed so far.
   */
  const wrappers: TreeNode[] = [];
  for (let inner: unknown = node; ;) {
    if ((!isTreeNode(inner,)) || (!WRAPPER_KINDS.has(inner.type,))) {
      return {
        wrappers,
        inner,
      };
    }
    wrappers.push(inner,);
    inner = inner.expression;
  }
}

/**
 Parses one file.

 @param file - file read

 @returns Its program and comments

 @throws {@link Error} when the file does not parse, since a file a scan cannot read hides what it holds

 @example
 ```ts
 const { program, comments, } = parseSource({ file, },);
 ```
 */
export function parseSource({ file, }: { readonly file: SourceText; },): ParsedSource {
  /**
   Parser result.
   */
  const parsed = parseSync(
    file.path,
    file.text,
  );
  if (parsed.errors
    .length
    > 0)
    throw new Error(`${file.path} does not parse: ${parsed.errors
      .map(String,)
      .join('; ',)}`,);
  /**
   Program node, checked to carry the offsets the scans read.
   */
  const program: unknown = parsed.program;
  if (!isTreeNode(program,))
    throw new Error(`${file.path} parsed to a program without offsets`,);
  return {
    program,
    comments: parsed.comments,
  };
}

/**
 Directory holding the family's packages, one directory each.
 */
export const FAMILY_ROOT: string = resolve(
  import.meta.dirname,
  '..',
  '..',
);

/**
 Names of the family's package directories, which prefix every location.

 @returns Directory names, sorted, those without a `src` directory left out

 @example
 ```ts
 const packages = await familyPackages(); // ['adjudication', 'archive', ...]
 ```
 */
export async function familyPackages(): Promise<readonly string[]> {
  /**
   Entries of the family directory.
   */
  const entries = await readdir(
    FAMILY_ROOT,
    { withFileTypes: true, },
  );
  /**
   Directories among them that hold a `src` directory.
   */
  const withSource = await Promise.all(entries
    .filter(function isDirectory(entry,): boolean {
      return entry.isDirectory();
    },)
    .map(async function hasSource({ name, },): Promise<string> {
      return (await readdir(join(
        FAMILY_ROOT,
        name,
      ),)).includes('src',) ? name : '';
    },),);
  return withSource
    .filter(function named(name,): boolean {
      return name !== '';
    },)
    .toSorted();
}

/**
 Every TypeScript file under every family package's `src`, with its text.

 @returns Files in no particular order, each located as the package directory and its path under `src`

 @example
 ```ts
 const files = await readPackageSource(); // paths like 'adjudication/adjudicate-prompt.ts'
 ```
 */
export async function readPackageSource(): Promise<readonly SourceText[]> {
  return (await Promise.all((await familyPackages()).map(async function readPackage(name,): Promise<readonly SourceText[]> {
    /**
     Source root of this package.
     */
    const srcDir = join(
      FAMILY_ROOT,
      name,
      'src',
    );
    /**
     Paths of the TypeScript files under it.
     */
    const paths = (await readdir(
      srcDir,
      { recursive: true, },
    ))
      .filter(function isTypeScript(path,): boolean {
        return path.endsWith('.ts',);
      },);
    return await Promise.all(paths.map(async function read(path,): Promise<SourceText> {
      return {
        path: `${name}/${path}`,
        text: await readFile(
          join(
            srcDir,
            path,
          ),
          'utf8',
        ),
        isTest: path.endsWith('.test.ts',) || path.endsWith('.test-fixture.ts',),
      };
    },),);
  },),)).flat();
}

/**
 Path of a location under its package's `src`, the package directory cut away.

 @param path - location as `readPackageSource` names it

 @returns The path relative to the package's `src`

 @example
 ```ts
 const underSrc = pathUnderSrc({ path: 'run/corpus-run/cli-refusal.ts', },); // 'corpus-run/cli-refusal.ts'
 ```
 */
export function pathUnderSrc({ path, }: { readonly path: string; },): string {
  return path.slice(path.indexOf('/',) + 1,);
}

/**
 Package directory of a location.

 @param path - location as `readPackageSource` names it

 @returns The directory name of the package holding the file

 @example
 ```ts
 const directory = packageDirectoryOf({ path: 'run/corpus-run/cli-refusal.ts', },); // 'run'
 ```
 */
export function packageDirectoryOf({ path, }: { readonly path: string; }): string {
  return path.slice(
    0,
    path.indexOf('/',),
  );
}

/**
 Resolves a relative module specifier against the file that holds it.

 @param fromPath - importing file's location

 @param specifier - relative specifier the import or re-export names

 @returns The location it names

 @example
 ```ts
 resolveSpecifier({ fromPath: 'run/corpus-run/a.test.ts', specifier: '../b.test-fixture.ts', },); // 'run/b.test-fixture.ts'
 ```
 */
export function resolveSpecifier(
  {
    fromPath,
    specifier,
  }: {
    readonly fromPath: string;
    readonly specifier: string;
  },
): string {
  /**
   Directory segments of the importing file, its own file name dropped.
   */
  const resolved = fromPath
    .split('/',)
    .slice(
      0,
      -1,
    );
  for (const segment of specifier.split('/',)) {
    if (segment === '..')
      resolved.pop();
    else if ((segment !== '.') && (segment !== ''))
      resolved.push(segment,);
  }
  return resolved.join('/',);
}

/**
 What a family package specifier names: the package directory, and the path under `src` after `/ts/`, empty for
 the package's index (`<name>` or `<name>/ts`).
 */
const FAMILY_SPECIFIER = /^@monochromatic-dev\/translation-repair-(?<directory>[a-z0-9-]+)(?:\/ts(?:\/(?<subpath>.+))?)?$/u;

/**
 Declaring module of every name a family package's index re-exports, read once per package.
 */
const INDEX_DECLARERS = new Map<string, ReadonlyMap<string, string>>();

/**
 The module that declares each name a package's `src/index.ts` re-exports.

 @param directory - package directory

 @returns Exported name to the location of the module the index re-exports it from

 @example
 ```ts
 const declarers = indexDeclarers({ directory: 'archive', },); // 'confirmAbsoluteNaturalness' to 'archive/absolute-naturalness-confirmation.ts'
 ```
 */
function indexDeclarers({ directory, }: { readonly directory: string; },): ReadonlyMap<string, string> {
  /**
   Table read earlier.
   */
  const cached = INDEX_DECLARERS.get(directory,);
  if (cached !== undefined)
    return cached;
  /**
   Location the index goes by.
   */
  const indexPath = `${directory}/index.ts`;
  /**
   The index parsed.
   */
  const { program, } = parseSource({
    file: {
      path: indexPath,
      text: readFileSync(
        join(
          FAMILY_ROOT,
          directory,
          'src',
          'index.ts',
        ),
        'utf8',
      ),
      isTest: false,
    },
  },);
  /**
   Table built from its re-exports.
   */
  const declarers = new Map<string, string>();
  for (const statement of (program.body as readonly TreeNode[])) {
    if (statement.type !== 'ExportNamedDeclaration')
      continue;
    /**
     Module the statement re-exports from, empty for an export list of the index's own names.
     */
    const from = literalText({ node: statement.source, },);
    if (from === '')
      continue;
    for (const specifier of (statement.specifiers as readonly TreeNode[])) {
      declarers.set(
        identifierName({ node: specifier.exported, },) || literalText({ node: specifier.exported, },),
        resolveSpecifier({
          fromPath: indexPath,
          specifier: from,
        },),
      );
    }
  }
  INDEX_DECLARERS.set(
    directory,
    declarers,
  );
  return declarers;
}

/**
 The module a name imported through a specifier is declared in: the file a relative specifier names, the file
 under `src` a family package's `/ts/<path>` names, the module a family package's index (`<name>` or
 `<name>/ts`) re-exports the name from, or the specifier itself for any other package.

 @param fromPath - importing file's location

 @param specifier - module specifier the import or re-export names

 @param imported - name taken from the module, `*` for a namespace and `default` for a default

 @returns The declaring module's location, the package's index when it re-exports no such name, or the specifier
 for a package outside the family

 @example
 ```ts
 const at = declaringModule({ fromPath: 'run/a.ts', specifier: '@monochromatic-dev/translation-repair-archive/ts', imported: 'confirmAbsoluteNaturalness', },);
 ```
 */
export function declaringModule(
  {
    fromPath,
    specifier,
    imported,
  }: {
    readonly fromPath: string;
    readonly specifier: string;
    readonly imported: string;
  },
): string {
  if (specifier.startsWith('.',)) {
    return resolveSpecifier({
      fromPath,
      specifier,
    },);
  }
  /**
   The family package the specifier names, absent for any other package.
   */
  const family = FAMILY_SPECIFIER.exec(specifier,)?.groups;
  if (family === undefined)
    return specifier;
  /**
   Package directory the specifier names.
   */
  const directory = family['directory'] as string;
  /**
   Path after `/ts/`, absent for the package's index.
   */
  const subpath = family['subpath'];
  if (subpath !== undefined)
    return `${directory}/${subpath}`;
  return indexDeclarers({ directory, },).get(imported,) ?? `${directory}/index.ts`;
}

//endregion Source scan
