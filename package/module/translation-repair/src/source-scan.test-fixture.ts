import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

// Rolldown's parser (oxc), as the repository's import-attributes plugin reads
// source; TypeScript 7 exposes no stable compiler API to parse with.
import { parseSync, } from 'rolldown/utils';

//region Source scan
// What the package-wide guards over this package's own source share (audit
// area six, ledger B19): the package's TypeScript files as text, each parsed
// once, and a walk over the syntax tree. `duplicate-bodies.unit.test.ts` and
// `dead-code.unit.test.ts` read the source through it.

/**
 One TypeScript file under the package's `src`.
 */
export type SourceText = {
  /**
   Path relative to `src`, which names locations.
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
export type ParsedSource = {
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
 Every TypeScript file under the package's `src`, with its text.

 @returns Files in no particular order

 @example
 ```ts
 const files = await readPackageSource();
 ```
 */
export async function readPackageSource(): Promise<readonly SourceText[]> {
  /**
   Source root, which holds this fixture.
   */
  const srcDir = import.meta.dirname;
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
      path,
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
}

//endregion Source scan
