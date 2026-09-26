/**
 Fixture helpers for foreign `index.lock` holders and index writers driven through the built wrapper:
 native Git holding the lock in its editor,
 and wrapper runs whose stderr is observed while they wait.

 @module
 */
import type { ChildProcess, } from 'node:child_process';
import { once, } from 'node:events';
import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  barrierSource,
  type LandingRepository,
  type ProcessOutcome,
  REAL_GIT,
  startWrapper,
  waitForFile,
  writeNodeProgram,
} from '../policy-engine/commit-landing-fixture.unit.test.ts';

/**
 Wrapper run observed while it runs.
 */
export type ObservedRun = Readonly<{
  /**
   Standard error so far.
   */
  stderr: () => string;
  /**
   Whether the process exited.
   */
  exited: () => boolean;
  /**
   Outcome after exit.
   */
  outcome: Promise<ProcessOutcome>;
}>;

/**
 Starts the wrapper and observes its output while it runs.

 @param repository - fixture repository

 @param args - wrapper arguments

 @returns observed run
 */
export function observeWrapper({
  repository,
  args,
}: Readonly<{
  repository: LandingRepository;
  args: readonly string[];
}>,): ObservedRun {
  /** Started wrapper. */
  const child = startWrapper({ repository, args, },);
  /** Collected output and exit state. */
  const state = {
    stdout: '',
    stderr: '',
    exited: false,
  };
  child.stdout?.setEncoding('utf8',);
  child.stderr?.setEncoding('utf8',);
  child.stdout?.on('data', function collectStdout(chunk: string,): void {
    state.stdout += chunk;
  },);
  child.stderr?.on('data', function collectStderr(chunk: string,): void {
    state.stderr += chunk;
  },);
  /** Close promise. */
  const closed = once(child, 'close',);
  return {
    stderr: function currentStderr(): string {
      return state.stderr;
    },
    exited: function hasExited(): boolean {
      return state.exited;
    },
    outcome: (async function collect(): Promise<ProcessOutcome> {
      /** Exit code and signal. */
      const result: readonly unknown[] = await closed;
      state.exited = true;
      return {
        exitCode: (typeof result[0]) === 'number' ? result[0] : -1,
        stdout: state.stdout,
        stderr: state.stderr,
      };
    })(),
  };
}

/**
 Waits until a predicate holds.

 @param predicate - condition

 @param timeoutMs - failure deadline

 @throws {@link Error} after the deadline
 */
export async function waitUntil({
  predicate,
  timeoutMs = 20_000,
}: Readonly<{
  predicate: () => boolean;
  timeoutMs?: number;
}>,): Promise<void> {
  /** Deadline. */
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline)
      throw new Error('Condition not reached before the deadline.',);
    // oxlint-disable-next-line no-await-in-loop -- Polling in order.
    await wait(20,);
  }
}

/**
 Native Git `commit --all` held in its editor.
 */
export type NativeHolder = Readonly<{
  /**
   Native Git PID.
   */
  pid: number;
  /**
   Native Git process.
   */
  child: ChildProcess;
  /**
   Releases the editor.
   */
  release: () => Promise<void>;
  /**
   Exit code after exit.
   */
  exitCode: Promise<unknown>;
}>;

/**
 Starts real Git by absolute path, bypassing the wrapper, running `commit --all` whose editor holds `index.lock` at a barrier;
 the repository kills its process group on disposal.

 @param repository - fixture repository

 @param name - barrier name

 @param lockfilePid - whether native Git runs with `core.lockfilePid=true`

 @param message - message the editor writes; empty aborts the commit

 @returns held native commit once the editor waits
 */
export async function holdNativeCommitAll({
  repository,
  name,
  lockfilePid,
  message,
}: Readonly<{
  repository: LandingRepository;
  name: string;
  lockfilePid: boolean;
  message: string;
}>,): Promise<NativeHolder> {
  /** Barrier marker. */
  const ready = join(repository.scratch, `${name}.ready`,);
  /** Barrier release. */
  const release = join(repository.scratch, `${name}.release`,);
  /** Editor program. */
  const editor = join(repository.scratch, `${name}-editor.cjs`,);
  await writeNodeProgram({
    path: editor,
    source: `${barrierSource({ ready, release, },)}\nrequire('node:fs').writeFileSync(process.argv[2], ${JSON.stringify(message,)});`,
  },);
  /** Native Git. */
  const child = repository.processGroups.spawn({
    command: REAL_GIT,
    args: [...(lockfilePid ? ['-c', 'core.lockfilePid=true',] : []), 'commit', '--all', '--quiet',],
    options: {
      cwd: repository.path,
      env: { ...repository.env, GIT_CONFIG_COUNT: '0', GIT_EDITOR: editor, },
      stdio: 'ignore',
    },
  },);
  /** Exit promise. */
  const exited = once(child, 'exit',);
  // A missing PID must never become -1, which process.kill reads as every process the user may signal.
  if (child.pid === undefined)
    throw new Error('Native Git did not start.',);
  await waitForFile({ path: ready, },);
  return {
    pid: child.pid,
    child,
    release: async function releaseEditor(): Promise<void> {
      await writeFile(release, '',);
    },
    exitCode: (async function exitCodeOf(): Promise<unknown> {
      /** Exit code and signal. */
      const result: readonly unknown[] = await exited;
      return result[0] ?? result[1];
    })(),
  };
}
