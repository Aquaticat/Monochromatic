/**
 Barriers, event readers, and Git helpers shared by the replay, revalidation, and hook-staging tests.

 @module
 */
import {
  type ChildProcess,
  execFileSync,
} from 'node:child_process';
import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import nanoSpawn from 'nano-spawn';
import {
  barrierSource,
  finish,
  git,
  jsonlEvents,
  type LandingRepository,
  type ProcessOutcome,
  REAL_GIT,
  startWrapper,
  waitForFile,
  writeNodeProgram,
} from './commit-landing-fixture.unit.test.ts';

/**
 One commit held at a barrier.
 */
export type HeldCommit = Readonly<{
  /**
   Releases the barrier.
   */
  release: () => Promise<void>;
  /**
   Outcome after release.
   */
  outcome: Promise<ProcessOutcome>;
  /**
   Wrapper process, the leader of its process group.
   */
  child: ChildProcess;
}>;

/**
 Starts a wrapper commit whose message editor waits at a barrier, and waits until it is there.

 @param repository - fixture repository

 @param name - barrier name

 @param args - wrapper arguments, which must open the editor

 @param env - extra environment

 @returns held commit

 @example
 ```ts
 const held = await holdInEditor({ repository, name: 'first', args: ['commit', '-e', '-m', 'x', 'a.txt'] });
 ```
 */
export async function holdInEditor({
  repository,
  name,
  args,
  env = {},
}: Readonly<{
  repository: LandingRepository;
  name: string;
  args: readonly string[];
  env?: NodeJS.ProcessEnv;
}>,): Promise<HeldCommit> {
  /**
   Readiness marker.
   */
  const ready = join(repository.scratch, `${name}.ready`,);
  /**
   Release file.
   */
  const release = join(repository.scratch, `${name}.release`,);
  /**
   Editor program.
   */
  const editor = join(repository.scratch, `${name}-editor.cjs`,);
  await writeNodeProgram({ path: editor, source: barrierSource({ ready, release, },), },);
  /**
   Started commit.
   */
  const child = startWrapper({ repository, args, env: { ...env, GIT_EDITOR: editor, }, },);
  /**
   Outcome collected from the start.
   */
  const outcome = finish(child,);
  await waitForFile({ path: ready, },);
  return {
    release: async function releaseEditor(): Promise<void> {
      await writeFile(release, '',);
    },
    outcome,
    child,
  };
}

/**
 Types of the JSONL events in a wrapper outcome.

 @param outcome - wrapper outcome

 @returns event types in order

 @example
 ```ts
 eventTypes(outcome); // ['landing-race-lost', 'landing-reserved', 'commit-replayed']
 ```
 */
export function eventTypes(outcome: ProcessOutcome,): readonly unknown[] {
  return jsonlEvents(outcome.stderr,)
    .map(function typeOf(event,): unknown {
      return event.type;
    },);
}

/**
 Codes of the core findings in a wrapper outcome.

 @param outcome - wrapper outcome

 @returns finding codes

 @example
 ```ts
 findingCodes(outcome); // ['concurrent-commit/replay-conflict']
 ```
 */
export function findingCodes(outcome: ProcessOutcome,): readonly unknown[] {
  return jsonlEvents(outcome.stderr,)
    .filter(function isCoreFinding(event,): boolean {
      return event.type === 'core-finding';
    },)
    .map(function codeOf(event,): unknown {
      return event.code;
    },);
}

/**
 First JSONL event of a type.

 @param outcome - wrapper outcome

 @param type - event type

 @returns event fields, empty when absent

 @example
 ```ts
 eventOfType({ outcome, type: 'commit-replayed' });
 ```
 */
export function eventOfType({
  outcome,
  type,
}: Readonly<{
  outcome: ProcessOutcome;
  type: string;
}>,): Readonly<Record<string, unknown>> {
  return jsonlEvents(outcome.stderr,)
    .find(function ofType(event,): boolean {
      return event.type === type;
    },) ?? {};
}

/**
 Raw bytes of a Git command's output.

 @param repository - fixture repository

 @param args - Git arguments

 @returns exact standard output

 @example
 ```ts
 gitBytes({ repository, args: ['cat-file', 'commit', 'HEAD'] });
 ```
 */
export function gitBytes({
  repository,
  args,
}: Readonly<{
  repository: LandingRepository;
  args: readonly string[];
}>,): Buffer {
  return execFileSync(REAL_GIT, [...args,], { cwd: repository.path, env: repository.env, },);
}

/**
 Stages content for a path without touching its worktree copy.

 @param repository - fixture repository

 @param path - repository path

 @param content - staged content

 @returns staged blob

 @example
 ```ts
 await stageContent({ repository, path: 'f.txt', content: 'x\n' });
 ```
 */
export async function stageContent({
  repository,
  path,
  content,
}: Readonly<{
  repository: LandingRepository;
  path: string;
  content: string;
}>,): Promise<string> {
  /**
   Written blob.
   */
  const oid = execFileSync(REAL_GIT, ['hash-object', '-w', '--stdin',], { cwd: repository.path, env: repository.env, input: content, },).toString('utf8',).trim();
  await git({ repository, args: ['update-index', '--add', '--cacheinfo', `100644,${oid},${path}`,], },);
  return oid;
}

/**
 Configures SSH commit signing with a key generated in the fixture.

 @param repository - fixture repository

 @example
 ```ts
 await configureSshSigning(repository);
 ```
 */
export async function configureSshSigning(repository: LandingRepository,): Promise<void> {
  /**
   Signing key path.
   */
  const key = join(repository.scratch, 'signing-key',);
  await nanoSpawn('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'landing', '-f', key,],);
  /**
   Public key line.
   */
  const publicKey = (await readFile(`${key}.pub`, 'utf8',)).trim();
  /**
   Allowed signers file for verification.
   */
  const allowed = join(repository.scratch, 'allowed-signers',);
  await writeFile(allowed, `landing@example.invalid ${publicKey}\n`,);
  await git({ repository, args: ['config', 'gpg.format', 'ssh',], },);
  await git({ repository, args: ['config', 'user.signingKey', `${key}.pub`,], },);
  await git({ repository, args: ['config', 'gpg.ssh.allowedSignersFile', allowed,], },);
}

/**
 Ten numbered lines with some replaced, so edits far apart merge as non-overlapping hunks.

 @param replaced - line number to replacement text

 @returns file content

 @example
 ```ts
 numberedLines({ 1: 'first' });
 ```
 */
export function numberedLines(replaced: Readonly<Record<number, string>>,): string {
  return Array.from({ length: 10, }, function line(_value, index,): string {
    return `${replaced[index + 1] ?? `line ${String(index + 1,)}`}\n`;
  },).join('',);
}
