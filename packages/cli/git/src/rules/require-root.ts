import {
  dirname,
  isAbsolute,
  resolve,
} from 'node:path';

import { findUp, } from 'find-up';

import {
  l,
  tagged,
} from '../log.ts';

/**
 * Git subcommands exempt from the repo-root requirement.
 * These either create a repo or query meta information without needing one.
 */
const EXEMPT_SUBCOMMANDS: ReadonlySet<string> = new Set([
  'init',
  'clone',
  'version',
  'help',
],);

/**
 * Flags on `git config` that operate globally and don't require a repo.
 */
const GLOBAL_CONFIG_FLAGS: ReadonlySet<string> = new Set([
  '--global',
  '--system',
  '--list',
  '-l',
],);

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
type GlobalOptionLayout = {
  /** Working directory the subcommand will see after `-C <path>` chaining. */
  readonly effectiveCwd: string;
  /** Index of the subcommand within args, or `args.length` if absent. */
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
 * effective cwd and stopping at the first non-option arg (the subcommand).
 * Post-subcommand `-C` is not interpreted (e.g. `git commit -C HEAD~` keeps
 * its own meaning).
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
  if (index >= args.length)
    return {
      effectiveCwd: cwd,
      subcommandIndex: args.length,
    };

  const arg = args[index];
  if (arg === undefined)
    return {
      effectiveCwd: cwd,
      subcommandIndex: index,
    };

  if (arg === '-C') {
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

  if (VALUE_TAKING_GLOBAL_OPTIONS.has(arg,))
    return walkGlobalOptions({
      args,
      index: index + 2,
      cwd,
    },);

  if (arg.startsWith('-',))
    return walkGlobalOptions({
      args,
      index: index + 1,
      cwd,
    },);

  return {
    effectiveCwd: cwd,
    subcommandIndex: index,
  };
}

/**
 * Compute the working directory git will see (`process.cwd()` plus every
 * pre-subcommand `-C <path>`) and locate the subcommand within args.
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
function parseGlobalOptions(args: readonly string[],): GlobalOptionLayout {
  return walkGlobalOptions({
    args,
    index: 0,
    cwd: process.cwd(),
  },);
}

/**
 * Enforces that, when the effective working directory (after applying
 * pre-subcommand `-C <path>` chaining) lives inside a git repository, it is
 * the root of that repository (where `.git` sits). When `.git` is not found
 * up the tree from the effective cwd, the rule passes the command through to
 * real git, which will surface its own error if the subcommand needs a repo.
 *
 * Exempt subcommands: init, clone, version, help.
 * Also exempts `config` with `--global`, `--system`, or `--list`.
 *
 * @param args - Raw git arguments (subcommand + flags).
 *
 * @returns Unmodified args if the check passes.
 *
 * @throws When inside a repo but not at its root.
 *
 * @example
 * ```ts
 * await requireRoot(['status']);
 * // throws if cwd is inside a repo but not at its root
 *
 * await requireRoot(['-C', '/repo-root', 'status']);
 * // passes even if process.cwd() is elsewhere
 *
 * await requireRoot(['clone', 'https://github.com/...']);
 * // always passes -- clone is exempt
 * ```
 */
export async function requireRoot(args: readonly string[],): Promise<readonly string[]> {
  /** Tagged logger for the require-root rule. */
  const rl = tagged({
    tag: requireRoot.name,
    l,
  },);

  const {
    effectiveCwd,
    subcommandIndex,
  } = parseGlobalOptions(args,);
  const subcommand = args[subcommandIndex];

  rl.debug(`effective cwd: ${effectiveCwd}, subcommand: ${subcommand ?? '(none)'}`,);

  if (subcommand === undefined || EXEMPT_SUBCOMMANDS.has(subcommand,)) {
    rl.debug(`exempt subcommand: ${subcommand ?? '(none)'}`,);
    return args;
  }

  if (subcommand === 'config') {
    const hasGlobalFlag = args.some(function isGlobalConfigFlag(arg,) {
      return GLOBAL_CONFIG_FLAGS.has(arg,);
    },);
    if (hasGlobalFlag) {
      rl.debug('config with global/system/list flag: exempt',);
      return args;
    }
  }

  /** Absolute path to the nearest `.git`, or `undefined` if not in a repo. */
  const gitPath = await findUp(
    '.git',
    {
      type: 'directory',
      cwd: effectiveCwd,
    },
  );

  if (gitPath === undefined) {
    rl.debug('not inside a git repository: forwarding to real git',);
    return args;
  }

  /** Directory containing the found `.git`. */
  const repoRoot = dirname(gitPath,);

  if (repoRoot !== effectiveCwd) {
    throw new Error(
      `cli-git: not at the root of the git repository. `
        + `Repo root is ${repoRoot} but effective cwd is ${effectiveCwd}. `
        + `Tip: cd to ${repoRoot} or pass -C ${repoRoot} before the subcommand.`,
    );
  }

  rl.debug('repo root check passed',);
  return args;
}
