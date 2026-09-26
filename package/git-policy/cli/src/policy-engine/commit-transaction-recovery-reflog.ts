/**
 Reflog search proving which commit an interrupted transaction landed.

 Only the transaction's own ref movement carries its nonce-bearing reflog action,
 so the nonce stays attributable when later movements push it below the newest entry.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import { CommitTransactionRecoveryError, } from './commit-transaction-recovery-validation.ts';

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
 Ref whose reflog records the transaction's movement; native commit always writes it.
 */
const TRANSACTION_REFLOG_REF = 'HEAD';

/**
 One reflog entry split at its NUL separator.
 */
type ReflogEntry = Readonly<{
  /**
   Commit the entry moved the ref to.
   */
  oid: string;
  /**
   Reflog subject beginning with the reflog action.
   */
  subject: string;
}>;

/**
 Splits one `%H%x00%gs` reflog line.

 @param line - one nonempty reflog line

 @returns entry commit and subject

 @throws {@link CommitTransactionRecoveryError} when the separator is missing
 */
function parseReflogLine(line: string,): ReflogEntry {
  /**
   Unambiguous identity and subject separator.
   */
  const separator = line.indexOf('\0',);
  if (separator === (-1))
    throw new CommitTransactionRecoveryError('Git returned malformed transaction reflog output.',);
  return {
    oid: line.slice(
      0,
      separator,
    ),
    subject: line.slice(separator + 1,),
  };
}

/**
 Lists the distinct commits whose reflog entries on one ref start with a nonce-bearing subject, at any depth.

 @param gitPath - resolved Git executable

 @param cwd - owning worktree directory

 @param ref - ref whose reflog records the movement

 @param subjectPrefix - nonce-bearing subject prefix

 @returns distinct commits, empty when no entry carries the nonce

 @throws {@link CommitTransactionRecoveryError} when the reflog is unreadable

 @example
 ```ts
 await listNonceReflogOids({ gitPath: '/usr/bin/git', cwd: '/repo', ref: 'refs/heads/main', subjectPrefix: 'commit (cli-git 0b6c…):' });
 ```
 */
export async function listNonceReflogOids({
  gitPath,
  cwd,
  ref,
  subjectPrefix,
}: Readonly<{
  gitPath: string;
  cwd: string;
  ref: string;
  subjectPrefix: string;
}>,): Promise<readonly string[]> {
  /**
   Entries Git preselected by fixed-string nonce match, with identity and subject separated without text ambiguity.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'reflog',
      'show',
      '--fixed-strings',
      `--grep-reflog=${subjectPrefix}`,
      '--format=%H%x00%gs',
      ref,
      '--',
    ],
    allowFailure: true,
  },);
  if (result.exitCode !== 0)
    throw new CommitTransactionRecoveryError(`${ref} reflog is unreadable: ${result.stderr.trim()}`,);
  return [
    ...new Set(
      DECODER.decode(result.stdout,)
        .split('\n',)
        .filter(function nonempty(line,): boolean {
          return line.length > 0;
        },)
        .map(parseReflogLine,)
        .filter(function carriesNonceAction({ subject, },): boolean {
          return subject.startsWith(subjectPrefix,);
        },)
        .map(function entryOid({ oid, },): string {
          return oid;
        },),
    ),
  ];
}

/**
 Finds the one commit whose reflog entry carries the transaction's nonce, at any reflog depth.

 @param gitPath - resolved Git executable

 @param cwd - repository directory

 @param reflogAction - transaction's nonce-bearing reflog action

 @returns landed commit OID

 @throws {@link CommitTransactionRecoveryError} when the reflog is unreadable, lacks the nonce, or names several commits

 @example
 ```ts
 await findTransactionLandedOid({ gitPath: '/usr/bin/git', cwd: '/repo', reflogAction: 'cli-git:transaction:0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10' });
 ```
 */
export async function findTransactionLandedOid({
  gitPath,
  cwd,
  reflogAction,
}: Readonly<{
  gitPath: string;
  cwd: string;
  reflogAction: string;
}>,): Promise<string> {
  /**
   Tagged reflog logger.
   */
  const rl = tagged({
    tag: findTransactionLandedOid.name,
    l,
  },);
  /**
   Distinct commits named by nonce-bearing entries.
   */
  const landedOids = await listNonceReflogOids({
    gitPath,
    cwd,
    ref: TRANSACTION_REFLOG_REF,
    subjectPrefix: `${reflogAction}:`,
  },);
  /**
   Sole landed commit when the nonce is unambiguous.
   */
  const [landedOid,] = landedOids;
  if (landedOid === undefined)
    throw new CommitTransactionRecoveryError(`${TRANSACTION_REFLOG_REF} reflog does not identify prepared transaction.`,);
  if (landedOids.length > 1)
    throw new CommitTransactionRecoveryError(`${TRANSACTION_REFLOG_REF} reflog names several commits for prepared transaction: ${landedOids.join(', ',)}`,);
  rl.debug(`transaction nonce ${reflogAction} names ${landedOid}`,);
  return landedOid;
}
