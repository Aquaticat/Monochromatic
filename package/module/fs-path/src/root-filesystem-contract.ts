/**
 Filesystem contract shared by the upward-walk root discovery and its two
 backends (`root-filesystem.node.ts`, `root-filesystem.neutral.ts`). Lives
 apart from both so neither backend imports the walker and no cycle forms.

 @module
 */

/**
 Sentinel returned by {@link RootFilesystem.readTextFile} when a path is absent.
 A unique `Symbol` distinguishes "file missing" from empty content without a
 nullish union; matchers narrow with `content !== ABSENT` before inspecting it.
 */
export const ABSENT: unique symbol = Symbol('root discovery path content absent on filesystem',);

/**
 Filesystem operations needed by upward root discovery.
 */
export type RootFilesystem = {
  /**
   Reads UTF-8 text, returning {@link ABSENT} when path is absent.
   */
  readonly readTextFile: (path: string,) => Promise<string | typeof ABSENT>;

  /**
   Reads symbolic-link target text,
   returning {@link ABSENT} when path is absent or not a symbolic link.
   */
  readonly readSymbolicLink: (path: string,) => Promise<string | typeof ABSENT>;

  /**
   Checks whether path exists as any filesystem entry kind.
   */
  readonly exists: (path: string,) => Promise<boolean>;

  /**
   Checks whether path resolves to a directory.
   */
  readonly isDirectory: (path: string,) => Promise<boolean>;

  /**
   Checks whether path resolves to a regular file.
   */
  readonly isFile: (path: string,) => Promise<boolean>;

  /**
   Resolves path against a containing directory with runtime-native semantics.
   */
  readonly resolvePath: (options: {
    readonly from: string;
    readonly path: string;
  },) => string;
};

/**
 Returns absence for runtimes without symbolic links.

 @param _path - ignored symbolic-link path

 @returns promise resolving to {@link ABSENT}

 @example
 ```ts
 await unsupportedReadSymbolicLink('/repo/.git/HEAD');
 ```
 */
export function unsupportedReadSymbolicLink(_path: string,): Promise<typeof ABSENT> {
  return Promise.resolve(ABSENT,);
}
