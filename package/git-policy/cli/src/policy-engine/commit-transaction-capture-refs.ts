/**
 Ref and conclusion-state reads of the invocation capture.

 @module
 */
import type {
  ConclusionKind,
  PreparationBase,
  RefStorageFormat,
  SymbolicHeadTarget,
} from './commit-transaction-capture.ts';
import {
  CommitTransactionGitError,
  runTransactionGit,
} from './commit-transaction-git.ts';

/**
 Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

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
 Reports whether a pseudoref resolves in the owning worktree.

 @param gitPath - real Git executable

 @param cwd - invocation directory

 @param name - pseudoref name

 @returns whether the pseudoref names an object
 */
async function pseudorefExists({
  gitPath,
  cwd,
  name,
}: Readonly<{
  gitPath: string;
  cwd: string;
  name: string;
}>,): Promise<boolean> {
  return (await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--verify',
      '--quiet',
      name,
    ],
    allowFailure: true,
  },)).exitCode === 0;
}

/**
 Resolves the commit kind from the amend flag and the owning worktree's conclusion state.

 @param gitPath - real Git executable

 @param cwd - invocation directory

 @param amend - whether the invocation amends

 @returns conclusion kind

 @example
 ```ts
 await resolveConclusionKind({ gitPath: '/usr/bin/git', cwd: '/repo', amend: false });
 ```
 */
export async function resolveConclusionKind({
  gitPath,
  cwd,
  amend,
}: Readonly<{
  gitPath: string;
  cwd: string;
  amend: boolean;
}>,): Promise<ConclusionKind> {
  if (amend)
    return 'amend';
  /**
   Presence of each conclusion marker, probed concurrently.
   */
  const [merge, cherryPick, revert,] = await Promise.all([
    'MERGE_HEAD',
    'CHERRY_PICK_HEAD',
    'REVERT_HEAD',
  ].map(function probe(name,): Promise<boolean> {
    return pseudorefExists({
      gitPath,
      cwd,
      name,
    },);
  },),);
  if (merge === true)
    return 'merge';
  if (cherryPick === true)
    return 'cherry-pick';
  if (revert === true)
    return 'revert';
  return 'none';
}

/**
 Resolves the symbolic `HEAD` target in the owning worktree.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @returns branch ref or detached

 @example
 ```ts
 await resolveSymbolicHead({ gitPath: '/usr/bin/git', cwd: '/repo' });
 ```
 */
export async function resolveSymbolicHead({
  gitPath,
  cwd,
}: Readonly<{
  gitPath: string;
  cwd: string;
}>,): Promise<SymbolicHeadTarget> {
  /**
   Quiet symbolic-ref probe; exit 1 means detached.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'symbolic-ref',
      '--quiet',
      'HEAD',
    ],
    allowFailure: true,
  },);
  if (result.exitCode === 1)
    return { kind: 'detached', };
  if (result.exitCode !== 0)
    throw new CommitTransactionGitError(`git symbolic-ref HEAD failed: ${result.stderr
      .trim()}`,);
  return {
    kind: 'branch',
    ref: decodeTrimmed(result.stdout,),
  };
}

/**
 Resolves a ref to its commit, or unborn when it names nothing.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param ref - full ref name or `HEAD`

 @returns commit or unborn

 @example
 ```ts
 await resolveRefCommit({ gitPath: '/usr/bin/git', cwd: '/repo', ref: 'refs/heads/main' });
 ```
 */
export async function resolveRefCommit({
  gitPath,
  cwd,
  ref,
}: Readonly<{
  gitPath: string;
  cwd: string;
  ref: string;
}>,): Promise<PreparationBase> {
  /**
   Quiet commit resolution.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--verify',
      '--quiet',
      `${ref}^{commit}`,
    ],
    allowFailure: true,
  },);
  if (result.exitCode !== 0)
    return { kind: 'unborn', };
  return {
    kind: 'commit',
    oid: decodeTrimmed(result.stdout,),
  };
}

/**
 Reads the ref storage backend, treating a Git that cannot report it as the files backend.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @returns ref storage format

 @example
 ```ts
 await resolveRefFormat({ gitPath: '/usr/bin/git', cwd: '/repo' }); // 'files'
 ```
 */
export async function resolveRefFormat({
  gitPath,
  cwd,
}: Readonly<{
  gitPath: string;
  cwd: string;
}>,): Promise<RefStorageFormat> {
  /**
   Ref format report; Git before 2.45 rejects the option.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--show-ref-format',
    ],
    allowFailure: true,
  },);
  return (result.exitCode === 0) && (decodeTrimmed(result.stdout,) === 'reftable') ? 'reftable' : 'files';
}
