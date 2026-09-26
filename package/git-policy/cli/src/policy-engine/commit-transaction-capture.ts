/**
 Invocation capture: the transaction facts recorded before any Git mutation.

 Every later read of `HEAD` inside a transaction uses the recorded preparation base
 or the landed commit,
 never live `HEAD`.

 @module
 */
import { realpath, } from 'node:fs/promises';
import {
  isAbsolute,
  join,
  resolve,
} from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  CommitTransactionGitError,
  runTransactionGit,
} from './commit-transaction-git.ts';
import {
  resolveConclusionKind,
  resolveRefCommit,
  resolveRefFormat,
  resolveSymbolicHead,
} from './commit-transaction-capture-refs.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Lines the layout request prints: toplevel, Git directory, common directory, index, objects, registry, object format.
 */
const LAYOUT_LINES = 7;

/**
 Preparation base: the target's commit at invocation, or an unborn target.
 */
export type PreparationBase =
  | Readonly<{ kind: 'unborn'; }>
  | Readonly<{
    kind: 'commit';
    oid: string;
  }>;

/**
 Symbolic `HEAD` target at invocation.
 */
export type SymbolicHeadTarget =
  | Readonly<{
    kind: 'branch';
    ref: string;
  }>
  | Readonly<{ kind: 'detached'; }>;

/**
 Commit kind that decides whether a moved target fails instead of replaying.
 */
export type ConclusionKind = 'none' | 'amend' | 'merge' | 'cherry-pick' | 'revert';

/**
 Ref storage backend of the real repository.
 */
export type RefStorageFormat = 'files' | 'reftable';

/**
 Facts recorded at invocation, before any Git mutation.
 */
export type InvocationCapture = Readonly<{
  /**
   Target commit at invocation, or unborn.
   */
  base: PreparationBase;
  /**
   Branch `HEAD` named at invocation, or detached.
   */
  symbolicHead: SymbolicHeadTarget;
  /**
   Ref the landing advances by compare-and-swap: the branch, or `HEAD` itself when detached.
   */
  targetRef: string;
  /**
   Commit kind deciding moved-target behavior.
   */
  conclusion: ConclusionKind;
  /**
   Canonical worktree root.
   */
  repositoryRoot: string;
  /**
   Absolute Git directory of the owning worktree.
   */
  gitDir: string;
  /**
   Absolute common Git directory.
   */
  commonDir: string;
  /**
   Absolute real index path, honoring a caller-set `GIT_INDEX_FILE`.
   */
  realIndexPath: string;
  /**
   Absolute real object directory named by the shadow repository's alternates.
   */
  objectDirectory: string;
  /**
   Absolute per-worktree transaction registry.
   */
  registryRoot: string;
  /**
   Ref storage backend.
   */
  refFormat: RefStorageFormat;
  /**
   Object hash algorithm name.
   */
  objectFormat: string;
  /**
   Empty tree of the repository's object format, standing in for an unborn base.
   */
  emptyTreeOid: string;
  /**
   ISO-8601 invocation start time.
   */
  invokedAt: string;
}>;

/**
 Invocation facts other than the preparation base.
 */
export type InvocationLayout = Omit<InvocationCapture, 'base'>;

/**
 Decodes one trimmed Git output.

 @param bytes - Git stdout

 @returns trimmed text
 */
function decodeTrimmed(bytes: Uint8Array,): string {
  return DECODER.decode(bytes,)
    .trim();
}

/**
 Reads one required line of a fixed-order Git report.

 @param lines - report lines

 @param index - line position

 @returns nonempty line

 @throws {@link CommitTransactionGitError} for a missing or empty line
 */
function requiredLine({
  lines,
  index,
}: Readonly<{
  lines: readonly string[];
  index: number;
}>,): string {
  /**
   Line at the position.
   */
  const line = lines[index] ?? '';
  if (line === '')
    throw new CommitTransactionGitError('Git returned incomplete repository layout.',);
  return line;
}

/**
 Resolves one Git-reported path against the invocation directory.

 @param cwd - invocation directory

 @param lines - fixed-order report lines

 @param index - line position of the path

 @returns absolute path

 @throws {@link CommitTransactionGitError} for an empty report
 */
function absoluteReported({
  cwd,
  lines,
  index,
}: Readonly<{
  cwd: string;
  lines: readonly string[];
  index: number;
}>,): string {
  /**
   Reported path.
   */
  const reported = requiredLine({
    lines,
    index,
  },);
  return isAbsolute(reported,) ? reported : resolve(
    cwd,
    reported,
  );
}

/**
 Captures every invocation fact except the preparation base, before any Git mutation.
 A commit transaction publishes its directory between this and {@link captureInvocationBase},
 so pruning of landed-capture records sees it before it reads its base.

 @param gitPath - real Git executable

 @param cwd - effective invocation directory

 @param amend - whether the invocation amends

 @returns invocation layout

 @throws {@link CommitTransactionGitError} when Git reports an incomplete layout

 @example
 ```ts
 await captureInvocationLayout({ gitPath: '/usr/bin/git', cwd: '/repo', amend: false });
 ```
 */
export async function captureInvocationLayout({
  gitPath,
  cwd,
  amend,
}: Readonly<{
  gitPath: string;
  cwd: string;
  amend: boolean;
}>,): Promise<InvocationLayout> {
  /**
   Tagged capture logger.
   */
  const rl = tagged({
    tag: captureInvocationLayout.name,
    l,
  },);
  /**
   Invocation start time recorded before any Git runs.
   */
  const invokedAt = new Date()
    .toISOString();
  /**
   Absolute layout in one Git request.
   */
  const layout = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--path-format=absolute',
      '--show-toplevel',
      '--absolute-git-dir',
      '--git-common-dir',
      '--git-path',
      'index',
      '--git-path',
      'objects',
      '--git-path',
      'cli-git-transactions',
      '--show-object-format',
    ],
  },);
  /**
   Fixed-order layout lines.
   */
  const lines = decodeTrimmed(layout.stdout,)
    .split('\n',);
  /**
   Symbolic `HEAD` target and every other independent fact.
   */
  const [symbolicHead, conclusion, refFormat, emptyTree,] = await Promise.all([
    resolveSymbolicHead({
      gitPath,
      cwd,
    },),
    resolveConclusionKind({
      gitPath,
      cwd,
      amend,
    },),
    resolveRefFormat({
      gitPath,
      cwd,
    },),
    runTransactionGit({
      gitPath,
      cwd,
      args: [
        'hash-object',
        '-t',
        'tree',
        '--stdin',
      ],
    },),
  ],);
  /**
   Ref the landing advances.
   */
  const targetRef = symbolicHead.kind === 'branch' ? symbolicHead.ref : 'HEAD';
  /**
   Recorded layout.
   */
  const layoutCapture: InvocationLayout = {
    symbolicHead,
    targetRef,
    conclusion,
    repositoryRoot: await realpath(absoluteReported({
      cwd,
      lines,
      index: 0,
    },),),
    gitDir: absoluteReported({
      cwd,
      lines,
      index: 1,
    },),
    commonDir: absoluteReported({
      cwd,
      lines,
      index: 2,
    },),
    realIndexPath: absoluteReported({
      cwd,
      lines,
      index: 3,
    },),
    objectDirectory: absoluteReported({
      cwd,
      lines,
      index: 4,
    },),
    registryRoot: absoluteReported({
      cwd,
      lines,
      index: 5,
    },),
    refFormat,
    objectFormat: requiredLine({
      lines,
      index: LAYOUT_LINES - 1,
    },),
    emptyTreeOid: decodeTrimmed(emptyTree.stdout,),
    invokedAt,
  };
  rl.debug(`captured the layout of ${layoutCapture.targetRef} (${conclusion})`,);
  return layoutCapture;
}

/**
 Completes the invocation capture with the preparation base: the target's commit now.

 @param gitPath - real Git executable

 @param cwd - effective invocation directory

 @param layout - invocation layout

 @returns invocation capture

 @example
 ```ts
 await captureInvocationBase({ gitPath: '/usr/bin/git', cwd: '/repo', layout });
 ```
 */
export async function captureInvocationBase({
  gitPath,
  cwd,
  layout,
}: Readonly<{
  gitPath: string;
  cwd: string;
  layout: InvocationLayout;
}>,): Promise<InvocationCapture> {
  /**
   Target commit at invocation.
   */
  const base = await resolveRefCommit({
    gitPath,
    cwd,
    ref: layout.targetRef,
  },);
  l.debug(`captured ${layout.targetRef} at ${base.kind === 'commit' ? base.oid : 'unborn'}`,);
  return {
    ...layout,
    base,
  };
}

/**
 Captures every invocation fact before any Git mutation.

 @param gitPath - real Git executable

 @param cwd - effective invocation directory

 @param amend - whether the invocation amends

 @returns invocation capture

 @throws {@link CommitTransactionGitError} when Git reports an incomplete layout

 @example
 ```ts
 await captureInvocation({ gitPath: '/usr/bin/git', cwd: '/repo', amend: false });
 ```
 */
export async function captureInvocation({
  gitPath,
  cwd,
  amend,
}: Readonly<{
  gitPath: string;
  cwd: string;
  amend: boolean;
}>,): Promise<InvocationCapture> {
  return await captureInvocationBase({
    gitPath,
    cwd,
    layout: await captureInvocationLayout({
      gitPath,
      cwd,
      amend,
    },),
  },);
}

/**
 Revision the transaction reads as its baseline tree: the base commit, or the empty tree when unborn.

 @param capture - invocation capture

 @returns commit OID or empty tree OID

 @example
 ```ts
 baseRevision(capture);
 ```
 */
export function baseRevision(capture: Pick<InvocationCapture, 'base' | 'emptyTreeOid'>,): string {
  return capture.base
    .kind
    === 'commit' ? capture.base
      .oid : capture.emptyTreeOid;
}

/**
 Shadow repository path derived from the transaction ID,
 so recovery finds it before any record names it.

 @param commonDir - absolute common Git directory

 @param transactionId - transaction ID

 @returns absolute shadow repository path

 @example
 ```ts
 shadowRepositoryPath({ commonDir: '/repo/.git', transactionId });
 ```
 */
export function shadowRepositoryPath({
  commonDir,
  transactionId,
}: Readonly<{
  commonDir: string;
  transactionId: string;
}>,): string {
  return join(
    commonDir,
    'cli-git',
    'shadow',
    transactionId,
  );
}
