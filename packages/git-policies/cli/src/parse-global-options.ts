import {
  isAbsolute,
  resolve,
} from 'node:path';

/**
 * Global git options that consume the *next* argv entry as their value
 * (separated form). Used to walk past option/value pairs when locating the
 * subcommand. Glued forms like `--git-dir=<path>` are a single argv entry
 * and are handled by the generic dash-prefix branch.
 */
const VALUE_TAKING_GLOBAL_OPTIONS: ReadonlySet<string> = new Set([
  '-c',
  '-C',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--super-prefix',
  '--attr-source',
],);

/**
 * Parsed result of walking the pre-subcommand portion of `git`'s args.
 */
export type GlobalOptionLayout = {
  /**
   * Working directory the subcommand will see after `-C <path>` chaining.
   */
  readonly effectiveCwd: string;
  /**
   * Index of the subcommand within args, or `args.length` if absent.
   */
  readonly subcommandIndex: number;
};

/**
 * Resolve a `-C <path>` against the current effective cwd, per git's rules:
 * empty path leaves cwd unchanged, absolute path replaces it, relative path
 * resolves against the previous effective cwd (not `process.cwd()`).
 *
 * @param from - Effective cwd before this `-C`.
 *
 * @param path - The path argument of the `-C` flag.
 *
 * @returns Effective cwd after applying this `-C`.
 *
 * @example
 * ```ts
 * applyChdir({ from: '/a', path: '' });    // '/a'
 * applyChdir({ from: '/a', path: '/b' });  // '/b'
 * applyChdir({ from: '/a', path: 'sub' }); // '/a/sub'
 * ```
 */
function applyChdir({
  from,
  path,
}: {
  readonly from: string;
  readonly path: string;
},): string {
  if (path === '')
    return from;
  if (isAbsolute(path,))
    return path;
  return resolve(
    from,
    path,
  );
}

/**
 * Recursive walk over args, applying every pre-subcommand `-C <path>` to the
 * effective cwd via {@link applyChdir} and stopping at the first non-option
 * arg (the subcommand). Post-subcommand `-C` is not interpreted (e.g.
 * `git commit -C HEAD~` keeps its own meaning).
 *
 * @param args - Raw git arguments.
 *
 * @param index - Cursor into args.
 *
 * @param cwd - Effective cwd accumulated so far.
 *
 * @returns Effective cwd plus the subcommand index.
 */
function walkGlobalOptions({
  args,
  index,
  cwd,
}: {
  readonly args: readonly string[];
  readonly index: number;
  readonly cwd: string;
},): GlobalOptionLayout {
  if (index >= args
    .length) {
    return {
      effectiveCwd: cwd,
      subcommandIndex: args.length,
    };
  }

  /**
   * Current argv entry under inspection during the recursive walk.
   */
  const arg = args[index];
  if (arg === undefined) {
    return {
      effectiveCwd: cwd,
      subcommandIndex: index,
    };
  }

  if (arg === '-C') {
    /**
     * Path argument that follows `-C`; missing when `-C` is the final argv entry.
     */
    const path = args[index + 1];
    if (path === undefined) {
      // malformed `-C` at end of args; let real git surface the error
      return {
        effectiveCwd: cwd,
        subcommandIndex: index,
      };
    }
    return walkGlobalOptions({
      args,
      index: index + 2,
      cwd: applyChdir({
        from: cwd,
        path,
      },),
    },);
  }

  if (VALUE_TAKING_GLOBAL_OPTIONS.has(arg,)) {
    return walkGlobalOptions({
      args,
      index: index + 2,
      cwd,
    },);
  }

  if (arg.startsWith('-',)) {
    return walkGlobalOptions({
      args,
      index: index + 1,
      cwd,
    },);
  }

  return {
    effectiveCwd: cwd,
    subcommandIndex: index,
  };
}

/**
 * Compute the working directory git will see (`process.cwd()` plus every
 * pre-subcommand `-C <path>`) and locate the subcommand within args.
 * Rules that need to act on a specific subcommand should consult
 * `subcommandIndex` rather than `args[0]`, so they continue to fire when the
 * caller prepends global options such as `-C <path>` or `-c key=val`.
 *
 * @param args - Raw git arguments.
 *
 * @returns Effective cwd plus the subcommand index.
 *
 * @example
 * ```ts
 * parseGlobalOptions(['-C', '/repo', 'status']);
 * // { effectiveCwd: '/repo', subcommandIndex: 2 }
 *
 * parseGlobalOptions(['commit', '-C', 'HEAD~']);
 * // { effectiveCwd: process.cwd(), subcommandIndex: 0 }
 * ```
 */
export function parseGlobalOptions(args: readonly string[],): GlobalOptionLayout {
  return walkGlobalOptions({
    args,
    index: 0,
    cwd: process.cwd(),
  },);
}
