/**
 In-memory adapter for the root-discovery filesystem contract.

 A tree is declared as files with content, directories, and symbolic links
 with target text; every ancestor of a declared path is a directory. The
 probes follow the same rules as the `node:fs/promises` adapter:
 `exists` and `readSymbolicLink` look at the entry itself (a dangling link
 exists), while `isDirectory`, `isFile`, and `readTextFile` look through
 links, resolving relative targets against the link's directory.

 Ships in the public entry so marker tests, and callers that hold a tree in
 memory, can walk it with `findRoot` without touching a disk.

 @module
 */

import {
  dirname,
  resolve,
} from '#posix-path';
import {
  ABSENT,
  type RootFilesystem,
} from './root-filesystem-contract.ts';

//region Types

/**
 Tree declaration for {@link createMemoryRootFilesystem}.
 */
export type MemoryTree = {
  /**
   Regular files by absolute path, with their text.
   */
  readonly files?: Readonly<Record<string, string>>;

  /**
   Directories by absolute path. Parents of any declared path are
   directories already; list a directory here when it is empty.
   */
  readonly directories?: readonly string[];

  /**
   Symbolic links by absolute path, with their target text as a link stores
   it: absolute, or relative to the link's directory.
   */
  readonly links?: Readonly<Record<string, string>>;
};

/**
 Kind of entry found at a normalized path, or absence.
 */
type EntryKind = 'absent' | 'directory' | 'file' | 'link';

/**
 Normalized lookup tables built once per adapter.
 */
type Tables = {
  /**
   File text by normalized path.
   */
  readonly files: ReadonlyMap<string, string>;

  /**
   Normalized paths that are directories, declared or implied.
   */
  readonly directories: ReadonlySet<string>;

  /**
   Link target text by normalized path.
   */
  readonly links: ReadonlyMap<string, string>;
};

//endregion Types

//region Tables

/**
 Normalizes a declared path to an absolute POSIX path without dot segments
 or a trailing slash (the root stays `/`).

 @param path - declared path

 @returns normalized absolute path

 @example
 ```ts
 normalizePath('/repo/a/../mise.toml'); // '/repo/mise.toml'
 ```
 */
function normalizePath(path: string,): string {
  return resolve([path,],);
}

/**
 Every ancestor directory of a normalized path, the root included, the
 path itself excluded.

 @param path - normalized absolute path

 @returns ancestors from the nearest parent up to `/`

 @example
 ```ts
 ancestorsOf('/repo/a/b'); // ['/repo/a', '/repo', '/']
 ```
 */
function ancestorsOf(path: string,): readonly string[] {
  /**
   Nearest parent; equal to the path only at the root.
   */
  const parent = dirname(path,);
  if (parent === path)
    return [];
  // Bounded structural walk: one level per call, ending at the root, so
  // the recursion depth is the path depth.
  return [
    parent,
    ...ancestorsOf(parent,),
  ];
}

/**
 Builds the normalized lookup tables from a tree declaration.

 @param tree - declared files, directories, and links

 @returns tables with every implied ancestor directory added

 @example
 ```ts
 const tables = buildTables({ files: { '/repo/mise.toml': '' } });
 ```
 */
function buildTables(tree: MemoryTree,): Tables {
  /**
   File text by normalized path.
   */
  const files = new Map(Object.entries(tree.files ?? {},)
    .map(function normalizeFile([path, text,],): readonly [
      string,
      string,
    ] {
      return [
        normalizePath(path,),
        text,
      ];
    },),);
  /**
   Link target text by normalized path.
   */
  const links = new Map(Object.entries(tree.links ?? {},)
    .map(function normalizeLink([path, target,],): readonly [
      string,
      string,
    ] {
      return [
        normalizePath(path,),
        target,
      ];
    },),);
  /**
   Declared directories, normalized.
   */
  const declaredDirectories = (tree.directories ?? []).map(normalizePath,);
  /**
   Every declared path, whose ancestors are directories by implication.
   */
  const declaredPaths = [
    ...files.keys(),
    ...links.keys(),
    ...declaredDirectories,
  ];
  /**
   Directories: the root, the declared ones, and every ancestor.
   */
  const directories = new Set([
    '/',
    ...declaredDirectories,
    ...declaredPaths.flatMap(ancestorsOf,),
  ],);
  return {
    directories,
    files,
    links,
  };
}

//endregion Tables

//region Probes

/**
 Kind of the entry at a normalized path, without following links.

 @param tables - lookup tables

 @param path - normalized absolute path

 @returns entry kind, or `absent`

 @example
 ```ts
 entryKind({ tables, path: '/repo/.git' });
 ```
 */
function entryKind({
  tables,
  path,
}: {
  readonly tables: Tables;
  readonly path: string;
},): EntryKind {
  if (tables.links
    .has(path,))
    return 'link';
  if (tables.files
    .has(path,))
    return 'file';
  if (tables.directories
    .has(path,))
    return 'directory';
  return 'absent';
}

/**
 Link hops followed before a cycle is treated as dangling; the same
 budget Linux applies (`ELOOP` after 40).
 */
const MAX_LINK_HOPS = 40;

/**
 Follows links from a normalized path to the path of the entry they end
 at, the way `stat` does; a dangling or absent path resolves to itself.

 @param tables - lookup tables

 @param path - normalized absolute path

 @param hops - links followed so far, bounding a link cycle

 @returns normalized path of the final entry

 @example
 ```ts
 followLinks({ tables, path: '/repo/.git/HEAD', hops: 0 });
 ```
 */
function followLinks({
  tables,
  path,
  hops,
}: {
  readonly tables: Tables;
  readonly path: string;
  readonly hops: number;
},): string {
  /**
   Link target text when the path is a link.
   */
  const target = tables.links
    .get(path,);
  if ((target === undefined) || (hops >= MAX_LINK_HOPS))
    return path;
  // Bounded structural walk: each hop moves to one link target, and the
  // hop budget ends a cycle.
  return followLinks({
    hops: hops + 1,
    path: resolve([
      dirname(path,),
      target,
    ],),
    tables,
  },);
}

/**
 Builds an in-memory root-discovery filesystem from a tree declaration.

 @param tree - files with text, directories, and links with target text

 @returns filesystem whose probes read only the declaration

 @example
 ```ts
 const fs = createMemoryRootFilesystem({
   directories: ['/repo/.git/objects', '/repo/.git/refs', '/repo/a/b'],
   files: { '/repo/.git/HEAD': 'ref: refs/heads/main\n' },
 });
 const root = await findRoot({ cwd: '/repo/a/b', fs, marker: GIT_REPOSITORY });
 ```
 */
export function createMemoryRootFilesystem(tree: MemoryTree = {},): RootFilesystem {
  /**
   Lookup tables built once for this adapter.
   */
  const tables = buildTables(tree,);

  /**
   Kind of the entry a path names after following links.

   @param path - declared or probed path

   @returns entry kind at the end of the link chain, or `absent`

   @example
   ```ts
   resolvedKind('/repo/.git/HEAD');
   ```
   */
  function resolvedKind(path: string,): EntryKind {
    return entryKind({
      path: followLinks({
        hops: 0,
        path: normalizePath(path,),
        tables,
      },),
      tables,
    },);
  }

  return {
    exists: function memoryExists(path: string,): Promise<boolean> {
      return Promise.resolve(entryKind({
        path: normalizePath(path,),
        tables,
      },) !== 'absent',);
    },

    isDirectory: function memoryIsDirectory(path: string,): Promise<boolean> {
      return Promise.resolve(resolvedKind(path,) === 'directory',);
    },

    isFile: function memoryIsFile(path: string,): Promise<boolean> {
      return Promise.resolve(resolvedKind(path,) === 'file',);
    },

    readSymbolicLink: function memoryReadSymbolicLink(path: string,): Promise<string | typeof ABSENT> {
      return Promise.resolve(tables.links
        .get(normalizePath(path,),)
        ?? ABSENT,);
    },

    readTextFile: function memoryReadTextFile(path: string,): Promise<string | typeof ABSENT> {
      return Promise.resolve(tables.files
        .get(followLinks({
        hops: 0,
        path: normalizePath(path,),
        tables,
      },),)
        ?? ABSENT,);
    },
  };
}

//endregion Probes
