import {
  readdir,
  stat,
} from 'node:fs/promises';
import {
  join,
  resolve,
} from 'node:path';

import { ARTIFACTS_DIR, } from './artifact-file-name.ts';
import {
  PROMPT_PAYLOADS_DIR,
  SLICE_CACHE_DIR,
} from './runs-layout.ts';

//region Cap census walk
// WHERE THE CAP CENSUS LOOKS FOR LOGS (ledger P10). The agent root holds
// thousands of logs, some large, so the walk names paths only: it opens
// nothing, and a path it cannot read is counted rather than fatal.

/**
 How deep below a named directory the walk goes: the run directories under the
 agent root sit one or two levels down.
 */
const MAX_DEPTH = 3;

/**
 Directories that hold no run log and are large: caches, artifacts, payloads.
 */
const SKIPPED_DIRS: ReadonlySet<string> = new Set([
  SLICE_CACHE_DIR,
  ARTIFACTS_DIR,
  'node_modules',
  PROMPT_PAYLOADS_DIR,
],);

/**
 One path the walk has yet to visit.
 */
type PendingPath = {
  /**
   Path to visit.
   */
  readonly path: string;

  /**
   How far below its named root it sits.
   */
  readonly depth: number;
};

/**
 What visiting one path found.
 */
type Visit =
  | { readonly kind: 'log'; }
  | {
    readonly kind: 'children';
    readonly children: readonly PendingPath[]
  }
  | { readonly kind: 'nothing'; }
  | { readonly kind: 'unreadable'; };

/**
 Says on stderr that a path could not be read, with what the system answered.

 @param path - path the census could not read

 @param error - what the read raised

 @example
 ```ts
 reportCapCensusUnreadable({ path: '/runs/other-session', error, },);
 ```
 */
export function reportCapCensusUnreadable(
  {
    path,
    error,
  }: {
    readonly path: string;
    readonly error: unknown;
  },
): void {
  console.error(`cap-census: cannot read ${path}: ${String(error,)}`,);
}

/**
 Visits one path of the walk.

 @param next - path and depth

 @returns Whether it is a log, a directory with children to visit, nothing to
 read, or unreadable

 @example
 ```ts
 const found = await visit({ next: { path: '/runs', depth: 0, }, },);
 ```
 */
async function visit({ next, }: { readonly next: PendingPath; },): Promise<Visit> {
  try {
    /**
     What the path is.
     */
    const info = await stat(next.path,);
    if (info.isFile())
      return next.path
        .endsWith('.log',) ? { kind: 'log', } : { kind: 'nothing', };
    if ((!info.isDirectory()) || (next.depth > MAX_DEPTH))
      return { kind: 'nothing', };

    /**
     The directory's entries.
     */
    const names = await readdir(next.path,);
    return {
      kind: 'children',
      children: names
        .filter(function visited(name,): boolean {
          return !SKIPPED_DIRS.has(name,);
        },)
        .map(function child(name,): PendingPath {
          return {
            path: join(
              next.path,
              name,
            ),
            depth: next.depth + 1,
          };
        },),
    };
  }
  catch (error) {
    // A PATH THE WALK CANNOT READ IS COUNTED, NOT FATAL: the agent root holds
    // other sessions' directories this user cannot open.
    reportCapCensusUnreadable({
      path: next.path,
      error,
    },);
    return { kind: 'unreadable', };
  }
}

/**
 Every `.log` file under the named paths, files named directly included.

 @param roots - files or directories named on the command line

 @returns Log paths, each once however many named paths reach it, and how many
 paths the walk could not read

 @example
 ```ts
 const { logs, unreadable, } = await capCensusLogsUnder({ roots: ['/runs',], },);
 ```
 */
export async function capCensusLogsUnder(
  { roots, }: { readonly roots: readonly string[]; },
): Promise<{
  readonly logs: readonly string[];
  readonly unreadable: number
}> {
  /**
   Paths still to visit, a work stack so the walk needs no recursion.
   */
  const pending: PendingPath[] = roots.map(function rootOf(path,): PendingPath {
    return {
      path,
      depth: 0,
    };
  },);

  /**
   Log files found.
   */
  const logs: string[] = [];

  /**
   Paths the walk could not read.
   */
  const unreadable: string[] = [];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    /* oxlint-disable no-await-in-loop -- a work-stack walk: each directory's entries decide what is visited next */
    /**
     What this path turned out to be.
     */
    const found = await visit({ next, },);
    /* oxlint-enable no-await-in-loop */
    if (found.kind === 'log')
      logs.push(next.path,);
    else if (found.kind === 'children')
      pending.push(...found.children,);
    else if (found.kind === 'unreadable')
      unreadable.push(next.path,);
    // A PATH THAT IS NEITHER, a file other than a log or a directory past the
    // depth, has nothing to read.
  }
  // A LOG REACHED TWICE IS READ ONCE: a directory and a log inside it, or one
  // log named twice, would otherwise count each of its calls twice and move the
  // 99th percentile the cap rule reads.
  return {
    logs: [...new Map(logs.map(function byResolved(path,): readonly [
      string,
      string
    ] {
      return [
        resolve(path,),
        path,
      ];
    },),)
      .values(),],
    unreadable: unreadable.length,
  };
}

//endregion Cap census walk
