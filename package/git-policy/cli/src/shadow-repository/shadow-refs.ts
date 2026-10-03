/**
 Shadow ref store: a snapshot of every real ref plus the private target ref and private `HEAD`.

 Hooks therefore resolve tags,
 other branches,
 and remote-tracking refs as they stood at invocation.
 With the files backend the snapshot is one `packed-refs` file
 and the private target ref is a loose ref written through `update-ref`,
 which takes precedence over a packed entry;
 with reftable the snapshot is one `update-ref --stdin` transaction.

 @module
 */
import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type {
  InvocationCapture,
  PreparationBase,
  SymbolicHeadTarget,
} from '../policy-engine/commit-transaction-capture.ts';
import { runTransactionGit, } from '../policy-engine/commit-transaction-git.ts';

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
 UTF-8 encoder for ref store input.
 */
const ENCODER = new TextEncoder();

/**
 Inherited variables that would redirect a shadow Git command to another repository.
 */
export const REPOSITORY_REDIRECT_VARIABLES: readonly string[] = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_INDEX_FILE',
];

/**
 Header Git writes for a sorted `packed-refs` file without peeled lines.
 The trailing space matches Git's own writer, which older readers require around each trait.
 */
const PACKED_REFS_HEADER = '# pack-refs with: sorted \n';

/**
 Absent shadow directory named as the hooks path of cli-git's own shadow Git commands,
 so a `reference-transaction` or other hook never observes private shadow ref writes.
 */
const NO_HOOKS_DIRECTORY = 'no-hooks';

/**
 One real ref at invocation.
 */
export type RefSnapshotEntry = Readonly<{
  /**
   Full ref name.
   */
  name: string;
  /**
   Object the ref resolves to.
   */
  oid: string;
  /**
   Symbolic target, or an empty string for a direct ref.
   */
  symref: string;
}>;

/**
 Runs Git against the shadow repository with every redirecting variable removed.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @param args - arguments after `--git-dir`

 @param input - optional standard input bytes

 @param allowFailure - whether the caller handles a nonzero exit

 @param environment - additions such as the identity a signed replay commits under

 @param cwd - working directory, the shadow itself unless Git must report paths relative to the worktree root

 @returns captured output

 @example
 ```ts
 await runShadowGit({ gitPath: '/usr/bin/git', shadowPath, args: ['rev-parse', 'HEAD'] });
 ```
 */
export function runShadowGit({
  gitPath,
  shadowPath,
  args,
  input,
  allowFailure = false,
  environment = {},
  cwd = shadowPath,
}: Readonly<{
  gitPath: string;
  shadowPath: string;
  args: readonly string[];
  input?: Uint8Array;
  allowFailure?: boolean;
  environment?: Readonly<Record<string, string>>;
  cwd?: string;
}>,): ReturnType<typeof runTransactionGit> {
  return runTransactionGit({
    gitPath,
    cwd,
    args: [
      `--git-dir=${shadowPath}`,
      // The shadow config names the real hooks directory for native preparation; cli-git's own shadow maintenance runs no hooks.
      '-c',
      `core.hooksPath=${join(
        shadowPath,
        NO_HOOKS_DIRECTORY,
      )}`,
      ...args,
    ],
    unsetEnvironment: REPOSITORY_REDIRECT_VARIABLES,
    allowFailure,
    environment,
    ...(input === undefined ? {} : { input, }),
  },);
}

/**
 Lists every real ref in the owning worktree.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @returns refs in Git byte order

 @example
 ```ts
 await listRealRefs({ gitPath: '/usr/bin/git', cwd: '/repo' });
 ```
 */
export async function listRealRefs({
  gitPath,
  cwd,
}: Readonly<{
  gitPath: string;
  cwd: string;
}>,): Promise<readonly RefSnapshotEntry[]> {
  /**
   NUL-separated fields, one ref per line; ref names cannot contain NUL or newline.
   */
  const listing = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'for-each-ref',
      '--format=%(refname)%00%(objectname)%00%(symref)',
    ],
  },);
  return DECODER.decode(listing.stdout,)
    .split('\n',)
    .filter(function nonempty(line,): boolean {
      return line.length > 0;
    },)
    .map(function parseLine(line,): RefSnapshotEntry {
      /**
       Name, object, and symbolic target.
       */
      const [name, oid, symref,] = line.split('\0',);
      if ((name === undefined) || (oid === undefined)
        || (symref === undefined))
        throw new TypeError(`git for-each-ref returned a malformed line: ${JSON.stringify(line,)}`,);
      return {
        name,
        oid,
        symref,
      };
    },)
    .toSorted(function byteOrder(
      left,
      right,
    ): number {
      return Buffer.compare(
        Buffer.from(
          left.name,
          'utf8',
        ),
        Buffer.from(
          right.name,
          'utf8',
        ),
      );
    },);
}

/**
 Formats the files-backend snapshot of every direct ref except the private target.

 @param refs - real refs in byte order

 @param targetRef - ref replaced by the private copy

 @returns `packed-refs` text

 @example
 ```ts
 formatPackedRefs({ refs, targetRef: 'refs/heads/main' });
 ```
 */
export function formatPackedRefs({
  refs,
  targetRef,
}: Readonly<{
  refs: readonly RefSnapshotEntry[];
  targetRef: string;
}>,): string {
  return [
    PACKED_REFS_HEADER,
    ...refs
      .filter(function snapshotted(ref,): boolean {
        return (ref.symref === '') && (ref.name !== targetRef);
      },)
      .map(function packedLine(ref,): string {
        return `${ref.oid} ${ref.name}\n`;
      },),
  ].join('',);
}

/**
 Points the shadow `HEAD` at the private target: symbolic to the branch, or detached at the base.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @param symbolicHead - symbolic `HEAD` target at invocation

 @param base - preparation base
 */
async function writeShadowHead({
  gitPath,
  shadowPath,
  symbolicHead,
  base,
}: Readonly<{
  gitPath: string;
  shadowPath: string;
  symbolicHead: SymbolicHeadTarget;
  base: PreparationBase;
}>,): Promise<void> {
  if (symbolicHead.kind === 'branch') {
    if (base.kind === 'commit')
      await runShadowGit({
        gitPath,
        shadowPath,
        args: [
          'update-ref',
          symbolicHead.ref,
          base.oid,
        ],
      },);
    await runShadowGit({
      gitPath,
      shadowPath,
      args: [
        'symbolic-ref',
        'HEAD',
        symbolicHead.ref,
      ],
    },);
    return;
  }
  if (base.kind !== 'commit')
    throw new TypeError('A detached HEAD has no unborn preparation base.',);
  await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      'update-ref',
      '--no-deref',
      'HEAD',
      base.oid,
    ],
  },);
}

/**
 Writes the shadow ref store: the snapshot, symbolic refs, the private target ref, and `HEAD`.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param shadowPath - shadow repository

 @param capture - invocation capture

 @example
 ```ts
 await writeShadowRefs({ gitPath: '/usr/bin/git', cwd: '/repo', shadowPath, capture });
 ```
 */
export async function writeShadowRefs({
  gitPath,
  cwd,
  shadowPath,
  capture,
}: Readonly<{
  gitPath: string;
  cwd: string;
  shadowPath: string;
  capture: InvocationCapture;
}>,): Promise<void> {
  /**
   Tagged ref snapshot logger.
   */
  const rl = tagged({
    tag: writeShadowRefs.name,
    l,
  },);
  /**
   Every real ref.
   */
  const refs = await listRealRefs({
    gitPath,
    cwd,
  },);
  await (capture.refFormat === 'files'
    ? writeFile(
      join(
        shadowPath,
        'packed-refs',
      ),
      formatPackedRefs({
        refs,
        targetRef: capture.targetRef,
      },),
      { mode: 0o600, },
    )
    : runShadowGit({
      gitPath,
      shadowPath,
      args: [
        'update-ref',
        '--stdin',
      ],
      input: ENCODER.encode(refs
        .filter(function snapshotted(ref,): boolean {
          return (ref.symref === '') && (ref.name !== capture.targetRef);
        },)
        .map(function createLine(ref,): string {
          return `create ${ref.name} ${ref.oid}\n`;
        },)
        .join('',),),
    },));
  /**
   Symbolic refs recreated after their targets exist.
   */
  const symbolicRefs = refs.filter(function isSymbolic(ref,): boolean {
    return ref.symref !== '';
  },);
  for (const ref of symbolicRefs) {
    // oxlint-disable-next-line no-await-in-loop -- Each symbolic ref write takes the shadow ref store lock.
    await runShadowGit({
      gitPath,
      shadowPath,
      args: [
        'symbolic-ref',
        ref.name,
        ref.symref,
      ],
    },);
  }
  await writeShadowHead({
    gitPath,
    shadowPath,
    symbolicHead: capture.symbolicHead,
    base: capture.base,
  },);
  rl.debug(`snapshotted ${String(refs.length,)} refs into ${shadowPath}`,);
}
