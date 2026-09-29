/**
 Guards the copies family (audit area six, ledger B1 to B18; the prevention
 doc's "Copies of shared code"): no two functions in the package's source may
 keep one body, in two files or in one, except the frozen copies an artifact
 version recomputes and refuses to disagree with (ledger B15), each listed
 here with the reason it stays.

 THE FIXTURES COME FIRST, so the package-wide case is read against a scan
 shown able to find each kind of copy (ledger M21: a check that could not
 fail). Fixtures are cat-themed; the package case reads this package's own
 source.

 A body is compared as TypeScript prints it with comments removed and every
 whitespace character dropped, so two copies differing only in layout or
 comments are one body; bodies shorter than `SHORTEST_COMPARED` normalized
 characters are left out, as a one-line accessor is no drift risk.

 @module
 */

import { readdir, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
// Rolldown's parser (oxc), as the repository's import-attributes plugin reads
// source; TypeScript 7 exposes no stable compiler API to parse with.
import { parseSync, } from 'rolldown/utils';

/**
 Shortest body, in normalized characters, the scan compares; the census the
 audit ran (`duplicate-bodies.mjs`) used the same floor.
 */
const SHORTEST_COMPARED = 80;

/**
 One source file the scan reads.
 */
type SourceText = {
  /**
   Path relative to the source root, which names locations.
   */
  readonly path: string;

  /**
   File text.
   */
  readonly text: string;
};

/**
 Frozen copies kept on purpose, each group as its sorted locations, with the
 reason it stays. A location is `path#name`.
 */
const FROZEN_COPIES: readonly {
  readonly locations: readonly string[];
  readonly reason: string;
}[] = [
  {
    locations: [
      'corpus-run/artifact-two-lane-comparison.ts#judgeTwoLaneSlice',
      'lane-comparison.ts#judgeSlice',
    ],
    reason: 'the two-lane artifact reader recomputes each slice verdict with the rule its version was written '
      + 'under and refuses a file that disagrees (ledger B15)',
  },
  {
    locations: [
      'absolute-naturalness-review-stage.ts#uniqueFindings',
      'corpus-run/artifact-two-lane-read-naturalness-seat.ts#uniqueNaturalnessFindings',
    ],
    reason: 'the naturalness seat reader recomputes its version\'s findings list and refuses disagreement (B15)',
  },
  {
    locations: [
      'absolute-naturalness-review-stage.ts#firstOccurrence',
      'corpus-run/artifact-two-lane-read-naturalness-seat.ts#firstOccurrence',
    ],
    reason: 'nested inside the frozen copy of uniqueFindings',
  },
  {
    locations: [
      'absolute-naturalness-review-stage.ts#same',
      'corpus-run/artifact-two-lane-read-naturalness-seat.ts#same',
    ],
    reason: 'nested inside the frozen copy of uniqueFindings',
  },
];

/**
 An ESTree node as the scan reads it: its kind, its offsets and its fields.
 */
type TreeNode = Readonly<Record<string, unknown>> & {
  readonly type: string;
  readonly start: number;
  readonly end: number;
};

/**
 Node kinds that carry a function body.
 */
const FUNCTION_KINDS: ReadonlySet<string> = new Set([
  'ArrowFunctionExpression',
  'FunctionDeclaration',
  'FunctionExpression',
],);

/**
 Node kinds whose own name a function held in them takes: a variable, a
 property, a method, a class field.
 */
const NAMING_KINDS: ReadonlySet<string> = new Set([
  'MethodDefinition',
  'Property',
  'PropertyDefinition',
  'VariableDeclarator',
],);

/**
 Name read where a node names nothing.
 */
const UNNAMED = '';

/**
 Name a location takes for a function nothing names.
 */
const ANONYMOUS = '(anonymous)';

/**
 Whether a name read from a node names something.

 @param name - name read, `UNNAMED` where there was none

 @returns Whether it is a name

 @example
 ```ts
 const named = ['', 'nap',].find(isNamed,); // 'nap'
 ```
 */
function isNamed(name: string,): boolean {
  return name !== UNNAMED;
}

/**
 Whether a value is an ESTree node with offsets.

 @param value - field of a node

 @returns Whether it is a node

 @example
 ```ts
 const node = isTreeNode(program.body[0],);
 ```
 */
function isTreeNode(value: unknown,): value is TreeNode {
  return ((typeof value) === 'object') && (value !== null) && ('type' in value) && ((typeof value.type) === 'string')
    && ('start' in value) && ((typeof value.start) === 'number') && ('end' in value) && ((typeof value.end) === 'number');
}

/**
 The identifier a node names, where its name field holds one.

 @param node - node read

 @param field - field holding the name: `id` for a function or a variable, `key` for a property

 @returns The name, or undefined

 @example
 ```ts
 const name = identifierIn({ node, field: 'id', },);
 ```
 */
function identifierIn(
  {
    node,
    field,
  }: {
    readonly node: TreeNode;
    readonly field: 'id' | 'key';
  },
): string {
  /**
   Node in that field.
   */
  const named = node[field];
  return (isTreeNode(named,) && (named.type === 'Identifier') && ((typeof named.name) === 'string'))
    ? named.name
    : UNNAMED;
}

/**
 A body's text with every comment inside it removed and every whitespace
 character dropped.

 @param text - file text

 @param body - body node

 @param comments - the file's comments, in order

 @returns Normalized body

 @example
 ```ts
 const normalized = normalizedBody({ text, body, comments, },);
 ```
 */
function normalizedBody(
  {
    text,
    body,
    comments,
  }: {
    readonly text: string;
    readonly body: TreeNode;
    readonly comments: readonly { readonly start: number; readonly end: number; }[];
  },
): string {
  /**
   Comments lying inside the body.
   */
  const inside = comments.filter(function within(comment,): boolean {
    return (comment.start >= body.start) && (comment.end <= body.end);
  },);
  /**
   Where each run of code between comments starts.
   */
  const starts = [
    body.start,
    ...inside.map(function after(comment,): number {
      return comment.end;
    },),
  ];
  /**
   Where each run ends.
   */
  const ends = [
    ...inside.map(function before(comment,): number {
      return comment.start;
    },),
    body.end,
  ];
  return Array.from(starts.map(function run(start, at,): string {
    return text.slice(
      start,
      ends[at],
    );
  },)
    .join('',),)
    .filter(function visible(character,): boolean {
      return character.trim() !== '';
    },)
    .join('',);
}

/**
 Every compared body in one file, as normalized text beside its location.

 @param file - source file read

 @returns Pairs of normalized body and location

 @throws {@link Error} when the file does not parse, since a file the scan cannot read hides its copies

 @example
 ```ts
 const bodies = bodiesOf({ file: { path: 'cat.ts', text: 'function nap() { return 1; }', }, },);
 ```
 */
function bodiesOf({ file, }: { readonly file: SourceText; },): readonly (readonly [string, string])[] {
  /**
   Parsed file.
   */
  const parsed = parseSync(
    file.path,
    file.text,
  );
  if (parsed.errors.length > 0)
    throw new Error(`${file.path} does not parse: ${parsed.errors.map(String,).join('; ',)}`,);
  /**
   Bodies found so far.
   */
  const found: (readonly [string, string])[] = [];
  /**
   Nodes still to visit, each with the name its holder gives a function.
   */
  const pending: { readonly node: TreeNode; readonly held: string; }[] = [{
    node: parsed.program as unknown as TreeNode,
    held: UNNAMED,
  },];
  while (pending.length > 0) {
    /**
     Node visited now.
     */
    const { node, held, } = pending.pop() as { readonly node: TreeNode; readonly held: string; };
    if (FUNCTION_KINDS.has(node.type,) && isTreeNode(node.body,)) {
      /**
       Body normalized for comparison.
       */
      const normalized = normalizedBody({
        text: file.text,
        body: node.body,
        comments: parsed.comments,
      },);
      if (normalized.length >= SHORTEST_COMPARED) {
        found.push([
          normalized,
          `${file.path}#${[identifierIn({ node, field: 'id', },), held,].find(isNamed,) ?? ANONYMOUS}`,
        ],);
      }
    }
    /**
     Name this node gives a function it holds.
     */
    const gives = NAMING_KINDS.has(node.type,)
      ? ([identifierIn({ node, field: 'id', },), identifierIn({ node, field: 'key', },),].find(isNamed,) ?? UNNAMED)
      : UNNAMED;
    Object.values(node,)
      .flatMap(function children(value,): readonly unknown[] {
        return Array.isArray(value,) ? value : [value,];
      },)
      .filter(isTreeNode,)
      .forEach(function queue(child,): void {
        pending.push({
          node: child,
          held: gives,
        },);
      },);
  }
  return found;
}

/**
 Orders two groups by their first location.

 @param left - one group of sorted locations

 @param right - another

 @returns Negative, zero or positive, as `localeCompare` answers

 @example
 ```ts
 const ordered = groups.toSorted(byFirstLocation,);
 ```
 */
function byFirstLocation(left: readonly string[], right: readonly string[],): number {
  return (left[0] ?? '').localeCompare(right[0] ?? '',);
}

/**
 Groups of two or more functions keeping one body, each as its sorted
 locations, the groups in order of their first location.

 @param files - source files read

 @returns Duplicate groups

 @example
 ```ts
 const groups = duplicateGroups({ files, },);
 ```
 */
function duplicateGroups({ files, }: { readonly files: readonly SourceText[]; },): readonly (readonly string[])[] {
  /**
   Locations per normalized body.
   */
  const byBody = new Map<string, string[]>();
  files.flatMap(function scan(file,) {
    return bodiesOf({ file, },);
  },)
    .forEach(function place([body, location,],): void {
      byBody.set(body, [...(byBody.get(body,) ?? []), location,],);
    },);
  return [...byBody.values(),]
    .filter(function repeated(locations,): boolean {
      return locations.length >= 2;
    },)
    .map(function sorted(locations,): readonly string[] {
      return locations.toSorted();
    },)
    .toSorted(byFirstLocation,);
}

/**
 A cat-themed function whose body clears the compared floor.

 @param name - function name

 @param bowl - identifier the body reads, to make two bodies differ

 @param note - comment written inside the body

 @returns Source text

 @example
 ```ts
 const text = catFunction({ name: 'feedCat', bowl: 'bowl', note: 'kibble first', },);
 ```
 */
function catFunction(
  {
    name,
    bowl,
    note,
  }: {
    readonly name: string;
    readonly bowl: string;
    readonly note: string;
  },
): string {
  return [
    `export function ${name}(${bowl}: readonly number[]): number {`,
    `  // ${note}`,
    `  return ${bowl}.filter((kibble) => kibble > 0).map((kibble) => kibble * 2).reduce((sum, kibble) => sum + kibble, 0);`,
    '}',
  ].join('\n',);
}

await describe({
  name: 'duplicate function bodies',
  children: [
    it({
      name: 'FINDS a body kept in two files whatever their comments and layout, and one kept twice in one file',
      fn: async () => {
        expect(duplicateGroups({
          files: [
            {
              path: 'cat-a.ts',
              text: catFunction({ name: 'feedCat', bowl: 'bowl', note: 'kibble first', },),
            },
            {
              path: 'cat-b.ts',
              text: catFunction({ name: 'serveCat', bowl: 'bowl', note: 'water after', },)
                .replaceAll('(kibble) => kibble > 0', '(kibble)=>kibble>0',),
            },
          ],
        },),).toEqual([['cat-a.ts#feedCat', 'cat-b.ts#serveCat',],],);
        expect(duplicateGroups({
          files: [{
            path: 'cat-c.ts',
            text: [
              catFunction({ name: 'feedCat', bowl: 'bowl', note: 'one', },),
              catFunction({ name: 'feedKitten', bowl: 'bowl', note: 'two', },),
            ].join('\n\n',),
          },],
        },),).toEqual([['cat-c.ts#feedCat', 'cat-c.ts#feedKitten',],],);
      },
    },),
    it({
      name: 'LEAVES bodies that differ in one name, and short bodies kept twice',
      fn: async () => {
        expect(duplicateGroups({
          files: [
            {
              path: 'cat-a.ts',
              text: catFunction({ name: 'feedCat', bowl: 'bowl', note: 'one', },),
            },
            {
              path: 'cat-b.ts',
              text: catFunction({ name: 'feedCat', bowl: 'dish', note: 'one', },),
            },
            {
              path: 'cat-c.ts',
              text: 'export function nap(): number { return 1; }\nexport function doze(): number { return 1; }',
            },
          ],
        },),).toEqual([],);
      },
    },),
    it({
      name: 'KEEPS NO BODY IN TWO PLACES across the package\'s source, but the frozen copies listed with their reasons, '
        + 'and every listed copy still stands',
      fn: async () => {
        /**
         Source root, which holds this test.
         */
        const srcDir = import.meta.dirname;
        /**
         Every non-test source file.
         */
        const paths = (await readdir(srcDir, { recursive: true, },))
          .filter(function isSource(path,): boolean {
            return path.endsWith('.ts',) && (!path.endsWith('.test.ts',)) && (!path.endsWith('.test-fixture.ts',));
          },);
        /**
         Their texts.
         */
        const files = await Promise.all(paths.map(async function read(path,): Promise<SourceText> {
          return {
            path,
            text: await readFile(join(srcDir, path,), 'utf8',),
          };
        },),);
        expect(files.length > 0,).toBe(true,);
        expect(duplicateGroups({ files, },),).toEqual(FROZEN_COPIES
          .map(function locationsOf({ locations, },): readonly string[] {
            return locations.toSorted();
          },)
          .toSorted(byFirstLocation,),);
      },
    },),
  ],
},);
