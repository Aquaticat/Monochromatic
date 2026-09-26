/**
 Single-commit baseline scenarios.
 They prove the harness and its invariant checker sound:
 each must pass against today's build.

 @module
 */

import {
  editText,
  synthesizeText,
} from './content-fixture.ts';
import type { HookEvent, } from './hook-program-fixture.ts';
import { realGit, } from './repository-fixture.ts';
import type { AttemptRecord, } from './ledger-fixture.ts';
import {
  allSucceeded,
  type Expectations,
  type ScenarioDefinition,
} from './scenario-model-fixture.ts';
import {
  repositoryOptions,
  runSequentialWorkers,
  seedTexts,
} from './scenario-helper-fixture.ts';
import { runTraceOperations, } from './trace-execution-fixture.ts';
import {
  planTraceOperations,
  selectTraceWindow,
} from './trace-replay-fixture.ts';
import {
  holdAt,
  reached,
  readWorktree,
  runWrapper,
  startAttempt,
  writeWorktree,
} from './worker-fixture.ts';

//region Constants

/**
 Every hook event the hook scenarios install.
 */
export const ALL_HOOK_EVENTS: readonly HookEvent[] = ['pre-commit', 'prepare-commit-msg', 'commit-msg', 'post-commit',];

/**
 Trace window length for baseline replay.
 */
const BASELINE_TRACE_COMMITS = 12;

/**
 Per-commit change cap for trace replay.
 */
export const TRACE_MAX_CHANGES = 16;

//endregion Constants

//region Scenarios

/**
 Modify,
 add,
 and delete through three sequential explicit-path commits.
 */
const explicitCommit: ScenarioDefinition = {
  name: 'baseline-explicit-commit',
  group: 'baseline',
  summary: 'modify, add, and delete one path each through sequential explicit-path commits',
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({ random, paths: ['modified.txt', 'gone.txt',], },), },);
  },
  async run(context,) {
    /**
     Current bytes of the modified file.
     */
    const current = (await readWorktree({ repository: context.repository, path: 'modified.txt', },)).bytes ?? Buffer.from('x\n',);
    await writeWorktree({ ...context, path: 'modified.txt', bytes: editText({ random: context.random, current, added: 3, deleted: 2, },), },);
    /**
     Modify attempt.
     */
    const modify = await (await startAttempt({ ...context, label: 'modify', paths: ['modified.txt',], mode: 'explicit', },)).finished;
    await writeWorktree({ ...context, path: 'added.txt', bytes: synthesizeText({ random: context.random, size: 300, },), },);
    await runWrapper({ ...context, label: 'add added.txt', args: ['add', '--', 'added.txt',], mustSucceed: true, },);
    /**
     Add attempt.
     */
    const add = await (await startAttempt({ ...context, label: 'add', paths: ['added.txt',], mode: 'explicit', },)).finished;
    await writeWorktree({ ...context, path: 'gone.txt', },);
    /**
     Delete attempt.
     */
    const remove = await (await startAttempt({ ...context, label: 'delete', paths: ['gone.txt',], mode: 'explicit', },)).finished;
    return [allSucceeded({ name: 'all-commits-succeed', attempts: [modify, add, remove,], },),];
  },
};

/**
 Index commit with partial staging and an unrelated unstaged edit.
 */
const indexCommit: ScenarioDefinition = {
  name: 'baseline-index-commit',
  group: 'baseline',
  summary: 'git add two paths, keep an unrelated unstaged edit, commit --no-only',
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({ random, paths: ['one.txt', 'two.txt', 'tail.txt',], },), },);
  },
  async run(context,) {
    await Promise.all(['one.txt', 'two.txt', 'tail.txt',].map(async function rewrite(path,) {
      await writeWorktree({ ...context, path, bytes: synthesizeText({ random: context.random.fork(path,), size: 500, },), },);
    },),);
    await runWrapper({ ...context, label: 'add one two', args: ['add', '--', 'one.txt', 'two.txt',], mustSucceed: true, },);
    /**
     Index attempt.
     */
    const attempt = await (await startAttempt({ ...context, label: 'index', paths: ['one.txt', 'two.txt',], mode: 'index', },)).finished;
    return [allSucceeded({ name: 'all-commits-succeed', attempts: [attempt,], },),];
  },
};

/**
 Sequential trace replay.
 */
const traceSequential: ScenarioDefinition = {
  name: 'baseline-trace-sequential',
  group: 'baseline',
  summary: `replay ${String(BASELINE_TRACE_COMMITS,)} consecutive trace commits one at a time`,
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({ random, paths: ['README.txt',], },), hooks: 'hookdir', hookEvents: ['pre-commit',], },);
  },
  async run(context,) {
    /**
     Window and its operations.
     */
    const { operations, seeds, } = planTraceOperations(selectTraceWindow({
      trace: context.trace,
      random: context.random.fork('window',),
      length: BASELINE_TRACE_COMMITS,
      maxChanges: TRACE_MAX_CHANGES,
    },),);
    await seedTracePaths({ context, seeds, },);
    /**
     Finished attempts.
     */
    const attempts = await runTraceOperations({ context, operations, concurrency: 1, },);
    return [allSucceeded({ name: 'all-commits-succeed', attempts, },),];
  },
};

/**
 Commits trace seed files with real Git before the replay window.

 @param context - scenario context

 @param seeds - seed paths

 @example
 ```ts
 await seedTracePaths({ context, seeds });
 ```
 */
export async function seedTracePaths({
  context,
  seeds,
}: Readonly<{
  context: Parameters<ScenarioDefinition['run']>[0];
  seeds: ReturnType<typeof planTraceOperations>['seeds'];
}>,): Promise<void> {
  if (seeds.length === 0)
    return;
  await Promise.all(seeds.map(async function seed(entry,) {
    await writeWorktree({
      ...context,
      path: entry.path,
      bytes: synthesizeText({ random: context.random.fork(`seed:${entry.path}`,), size: entry.size, },),
    },);
  },),);
  // Seeding bypasses the wrapper and its hooks on purpose: it is fixture setup, not workload.
  await realGit({ repository: context.repository, args: ['add', '--', ...seeds.map(function seedPath(entry,) {
    return entry.path;
  },),], },);
  await realGit({ repository: context.repository, args: ['-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '--no-verify', '--message', 'e2e trace seed',], },);
  await realGit({ repository: context.repository, args: ['push', '--quiet',], },);
}

/**
 Hook scenario body shared by hookdir and config hooks.

 @param context - scenario context

 @returns expectations

 @example
 ```ts
 await runHookedSequence(context);
 ```
 */
async function runHookedSequence(context: Parameters<ScenarioDefinition['run']>[0],): Promise<Awaited<ReturnType<ScenarioDefinition['run']>>> {
  /**
   Finished attempts.
   */
  const attempts = await runSequentialWorkers({
    context,
    plans: [{ label: 'hooked-a', paths: ['a.txt',], }, { label: 'hooked-b', paths: ['b.txt',], },],
  },);
  return [allSucceeded({ name: 'all-commits-succeed', attempts, },),];
}

/**
 Hookdir hooks on sequential commits.
 */
const hookdirHooks: ScenarioDefinition = {
  name: 'baseline-hooks-hookdir',
  group: 'baseline',
  summary: 'pre-commit, prepare-commit-msg, commit-msg, and post-commit hookdir hooks on two sequential commits',
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({ random, paths: ['a.txt', 'b.txt',], },), hooks: 'hookdir', hookEvents: ALL_HOOK_EVENTS, },);
  },
  run: runHookedSequence,
};

/**
 Config-based hooks on sequential commits.
 */
const configHooks: ScenarioDefinition = {
  name: 'baseline-hooks-config',
  group: 'baseline',
  summary: 'the same hooks registered through hook.<name>.command config',
  minimumGit: '2.54.0',
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({ random, paths: ['a.txt', 'b.txt',], },), hooks: 'config', hookEvents: ALL_HOOK_EVENTS, },);
  },
  run: runHookedSequence,
};

/**
 SSH-signed sequential commits.
 */
const sshSigning: ScenarioDefinition = {
  name: 'baseline-ssh-signing',
  group: 'baseline',
  summary: 'two sequential SSH-signed commits',
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({ random, paths: ['a.txt', 'b.txt',], },), signing: true, },);
  },
  run: runHookedSequence,
};

/**
 Kill inside `post-commit`, after native Git released every lock, then recover and commit again.
 This proves the kill machinery and leftover checks against a phase today's build already survives;
 kills in earlier phases are design scenarios (`scenario-sigkill-fixture.ts`).
 */
const sigkillRecovery: ScenarioDefinition = {
  name: 'baseline-sigkill-post-commit',
  group: 'baseline',
  summary: 'SIGKILL one commit in post-commit, run git status to recover, commit again',
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({ random, paths: ['a.txt', 'b.txt',], },), hooks: 'hookdir', hookEvents: ['post-commit',], },);
  },
  async run(context,) {
    await writeWorktree({ ...context, path: 'a.txt', bytes: synthesizeText({ random: context.random.fork('a',), size: 400, },), },);
    /**
     Attempt killed in its hook.
     */
    const victim = await startAttempt({ ...context, label: 'killed', paths: ['a.txt',], mode: 'explicit', },);
    await holdAt({ repository: context.repository, token: victim.token, event: 'post-commit', },);
    await reached({ repository: context.repository, token: victim.token, running: victim.running, event: 'post-commit', },);
    victim.kill();
    await victim.finished;
    await runWrapper({ ...context, label: 'recovery status', args: ['status', '--short',], mustSucceed: true, },);
    await writeWorktree({ ...context, path: 'b.txt', bytes: synthesizeText({ random: context.random.fork('b',), size: 400, },), },);
    /**
     Follow-up attempt.
     */
    const followUp = await (await startAttempt({ ...context, label: 'follow-up', paths: ['b.txt',], mode: 'explicit', },)).finished;
    return [allSucceeded({ name: 'follow-up-commit-succeeds', attempts: [followUp,], },),];
  },
};

/**
 Commits one setup change with real Git so an amend has a token-free commit to replace.

 @param context - scenario context

 @param path - path the setup commit changes

 @returns setup commit ID and its parent

 @example
 ```ts
 await commitAmendBase({ context, path: 'amend.txt' });
 ```
 */
export async function commitAmendBase({
  context,
  path,
}: Readonly<{
  context: Parameters<ScenarioDefinition['run']>[0];
  path: string;
}>,): Promise<Readonly<{ base: string; parent: string; }>> {
  await writeWorktree({ ...context, path, bytes: synthesizeText({ random: context.random.fork('amend-base',), size: 300, },), },);
  await realGit({ repository: context.repository, args: ['-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '--no-verify', '--message', 'e2e amend base', '--', path,], },);
  await realGit({ repository: context.repository, args: ['push', '--quiet',], },);
  return {
    base: (await realGit({ repository: context.repository, args: ['rev-parse', 'HEAD',], },)).trim(),
    parent: (await realGit({ repository: context.repository, args: ['rev-parse', 'HEAD^',], },)).trim(),
  };
}

/**
 Expectation that a successful amend replaced exactly the commit `HEAD` named at invocation.

 @param context - scenario context

 @param amend - finished amend attempt

 @param parent - parent of the commit being amended

 @returns expectation record

 @example
 ```ts
 await amendReplacedBase({ context, amend, parent });
 ```
 */
export async function amendReplacedBase({
  context,
  amend,
  parent,
}: Readonly<{
  context: Parameters<ScenarioDefinition['run']>[0];
  amend: AttemptRecord;
  parent: string;
}>,): Promise<Expectations[number]> {
  if (amend.outcome.exitCode !== 0)
    return { name: 'amend-safe', holds: true, detail: '', };
  /**
   Parent of the commit carrying the amend token.
   */
  const landedParent = (await realGit({
    repository: context.repository,
    args: ['log', '--branches', '--format=%P', `--grep=\\[${amend.token}\\]`,],
  },)).trim();
  return {
    name: 'amend-safe',
    holds: landedParent === parent,
    detail: `amend landed on parent ${landedParent.slice(0, 12,)}, expected ${parent.slice(0, 12,)}`,
  };
}

/**
 Amend of a token-free setup commit.
 */
const amend: ScenarioDefinition = {
  name: 'baseline-amend',
  group: 'baseline',
  summary: 'amend a setup commit with new bytes for its path',
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({ random, paths: ['amend.txt',], },), },);
  },
  async run(context,) {
    /**
     Setup commit and its parent.
     */
    const { parent, } = await commitAmendBase({ context, path: 'amend.txt', },);
    await writeWorktree({ ...context, path: 'amend.txt', bytes: synthesizeText({ random: context.random.fork('amend',), size: 300, },), },);
    /**
     Amend attempt.
     */
    const attempt = await (await startAttempt({ ...context, label: 'amend', paths: ['amend.txt',], mode: 'amend', },)).finished;
    return [
      allSucceeded({ name: 'all-commits-succeed', attempts: [attempt,], },),
      await amendReplacedBase({ context, amend: attempt, parent, },),
    ];
  },
};

/**
 lint-staged-style hook on a partially staged index commit in a linked worktree.
 */
const lintStaged: ScenarioDefinition = {
  name: 'baseline-lint-staged',
  group: 'baseline',
  summary: 'lint-staged backup stash and hide-unstaged hook on one partially staged index commit (linked worktree)',
  repository(random,) {
    return repositoryOptions({
      seedFiles: seedTexts({ random, paths: ['partial.txt',], },),
      worktree: 'linked',
      hooks: 'hookdir',
      hookEvents: ['pre-commit',],
      hookMode: 'lint-staged',
    },);
  },
  async run(context,) {
    await stagePartially({ context, path: 'partial.txt', },);
    /**
     Index attempt.
     */
    const attempt = await (await startAttempt({ ...context, label: 'lint-staged', paths: ['partial.txt',], mode: 'index', },)).finished;
    return [allSucceeded({ name: 'all-commits-succeed', attempts: [attempt,], },),];
  },
};

/**
 Stages new bytes for a path, then leaves a different unstaged tail in the worktree.

 @param context - scenario context

 @param path - tracked path

 @example
 ```ts
 await stagePartially({ context, path: 'partial.txt' });
 ```
 */
export async function stagePartially({
  context,
  path,
}: Readonly<{
  context: Parameters<ScenarioDefinition['run']>[0];
  path: string;
}>,): Promise<void> {
  /**
   Staged version.
   */
  const staged = synthesizeText({ random: context.random.fork(`${path}:staged`,), size: 600, },);
  await writeWorktree({ ...context, path, bytes: staged, },);
  await runWrapper({ ...context, label: `add ${path}`, args: ['add', '--', path,], mustSucceed: true, },);
  await writeWorktree({ ...context, path, bytes: editText({ random: context.random.fork(`${path}:tail`,), current: staged, added: 2, deleted: 0, },), },);
}

/**
 Baseline scenarios in report order.
 */
export const BASELINE_SCENARIOS: readonly ScenarioDefinition[] = [
  explicitCommit,
  indexCommit,
  traceSequential,
  hookdirHooks,
  configHooks,
  sshSigning,
  sigkillRecovery,
  amend,
  lintStaged,
];

//endregion Scenarios
