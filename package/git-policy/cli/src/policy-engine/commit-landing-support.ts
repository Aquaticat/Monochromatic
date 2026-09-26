/**
 Landing helpers:
 target comparison,
 the expected old value of a payload,
 file identities for landing records,
 and the nonce-bearing reflog message.

 @module
 */
import { lstat, } from 'node:fs/promises';
import type {
  InvocationCapture,
  PreparationBase,
} from './commit-transaction-capture.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import type { FileIdentity, } from './commit-transaction-journal-states.ts';
import type { LandingPayload, } from './commit-landing.ts';

/**
 Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Reports whether two target values are equal.

 @param left - first value

 @param right - second value

 @returns equality

 @example
 ```ts
 sameTarget({ left: capture.base, right: current });
 ```
 */
export function sameTarget({
  left,
  right,
}: Readonly<{
  left: PreparationBase;
  right: PreparationBase;
}>,): boolean {
  if ((left.kind === 'unborn') || (right.kind === 'unborn'))
    return left.kind === right.kind;
  return left.oid === right.oid;
}

/**
 Expected old target value of a payload.

 @param payload - landing payload

 @param capture - invocation capture

 @returns replay parent or preparation base

 @example
 ```ts
 expectedOldTarget({ payload, capture });
 ```
 */
export function expectedOldTarget({
  payload,
  capture,
}: Readonly<{
  payload: LandingPayload;
  capture: InvocationCapture;
}>,): PreparationBase {
  return payload.operation === 'commit' ? payload.expectedOld : capture.base;
}

/**
 Reads a file's device and inode.

 @param path - file path

 @returns identity

 @example
 ```ts
 await fileIdentity('/repo/.git/cli-git-transactions/id/post-1.index');
 ```
 */
export async function fileIdentity(path: string,): Promise<FileIdentity> {
  /**
   Non-followed metadata.
   */
  const metadata = await lstat(
    path,
    { bigint: true, },
  );
  return {
    device: String(metadata.dev,),
    inode: String(metadata.ino,),
  };
}

/**
 Builds the nonce-bearing reflog message.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param nonce - transaction ID

 @param oid - landed commit

 @returns `commit (cli-git <nonce>): <subject>`

 @example
 ```ts
 await landingReflogMessage({ gitPath: '/usr/bin/git', cwd: '/repo', nonce, oid });
 ```
 */
export async function landingReflogMessage({
  gitPath,
  cwd,
  nonce,
  oid,
}: Readonly<{
  gitPath: string;
  cwd: string;
  nonce: string;
  oid: string;
}>,): Promise<string> {
  /**
   Commit subject.
   */
  const subject = DECODER.decode((await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'show',
      '--no-patch',
      '--format=%s',
      oid,
    ],
  },)).stdout,)
    .trim();
  return `${landingReflogPrefix(nonce,)} ${subject}`;
}

/**
 Reflog subject prefix carrying the transaction nonce.

 @param nonce - transaction ID

 @returns prefix before the subject

 @example
 ```ts
 landingReflogPrefix(id); // 'commit (cli-git <id>):'
 ```
 */
export function landingReflogPrefix(nonce: string,): string {
  return `commit (cli-git ${nonce}):`;
}
