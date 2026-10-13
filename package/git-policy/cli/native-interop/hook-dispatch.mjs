/**
 Hook dispatch and the hook lock between the incumbent and the native wrapper, both ways.

 1. The native dispatcher holds the hook lock; the incumbent's commit waits for it, and the reverse.
 2. The incumbent's dispatcher holds the hook lock; the native dispatcher waits for it, and the reverse.
 3. A native dispatcher's hook runs the incumbent nested; the incumbent accepts the preparation lease and does not wait
    for the lock the outer dispatcher holds. A tampered lease must block the nested commit (positive control).
 4. An incumbent dispatcher's hook runs the native validator and a native read-only command nested; native accepts the
    incumbent's lease. A tampered lease must be refused (positive control).

 Every wait is observed through a log file that the hook writes, so ordering is measured, not assumed.
 */
/// <reference types="node" />
import {
  chmod,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import {
  INCUMBENT_BIN,
  NATIVE_BIN,
  SYSTEM_PATH,
  createRepository,
  expect,
  nativeProbeBinary,
  runEnvironment,
  runOk,
  sleep,
  startBackground,
  REAL_GIT,
} from './support.mjs';

/** The probe test that `native-interop` drives in the release test binary. */
const PROBE = 'hook_dispatch::tests::interop_probe';

/** Bounded wait for a log line, in milliseconds. */
const WAIT_LIMIT_MS = 30_000;

/** Time a waiting party is observed to stay blocked, in milliseconds. */
const BLOCKED_WINDOW_MS = 1500;

/** Locates the native probe binary once per driver run. */
const binary = await nativeProbeBinary();

/**
 Write the hook script every scenario uses.
 It logs its start, and nests a command when `ACTION` is `nest`; when `ACTION` is `wait` it blocks
 until `RELEASE_FILE` exists, and it logs its end.

 @param {string} path - file to write
 @param {string} log - shared log file
 @returns {Promise<void>}
 */
async function writeHook(path, log) {
  const script = [
    '#!/bin/sh',
    `LOG='${log}'`,
    'if [ -n "$NESTED" ]; then echo "nested $TAG" >> "$LOG"; exit 0; fi',
    'echo "start $TAG" >> "$LOG"',
    'if [ "$ACTION" = "nest" ]; then',
    '  NESTED=1 sh -c "$NESTED_COMMAND"',
    '  status=$?',
    '  echo "nest-exit $TAG $status" >> "$LOG"',
    '  if [ "$status" -ne 0 ]; then exit "$status"; fi',
    'fi',
    'if [ "$ACTION" = "wait" ]; then',
    '  i=0',
    '  while [ ! -e "$RELEASE_FILE" ] && [ "$i" -lt 2000 ]; do sleep 0.02; i=$((i + 1)); done',
    'fi',
    'echo "end $TAG" >> "$LOG"',
    '',
  ].join('\n');
  await writeFile(path, script, 'utf8');
  await chmod(path, 0o700);
}

/**
 Read the log, or nothing when it does not exist yet.

 @param {string} log - log file
 @returns {Promise<string[]>} its lines
 */
async function logLines(log) {
  try {
    return (await readFile(log, 'utf8')).split('\n').filter(Boolean);
  }
  catch (error) {
    if (error.code === 'ENOENT')
      return [];
    throw error;
  }
}

/**
 Wait until the log holds a line, failing after the bound.

 @param {string} log - log file
 @param {string} line - exact line awaited
 @returns {Promise<void>}
 */
async function waitForLine(log, line) {
  const started = Date.now();
  while (!(await logLines(log)).includes(line)) {
    if (Date.now() - started > WAIT_LIMIT_MS)
      throw new Error(`timed out waiting for "${line}"`);
    await sleep(50);
  }
}

/**
 Build the native probe's environment for one dispatch of a live transaction.

 @param {{ repository: string, home: string, tag: string, action: string, extra?: Record<string, string> }} request -
   repository, home, caller tag, hook action and extra variables
 @returns {Record<string, string>} environment
 */
function probeEnvironment({ repository, home, tag, action, extra = {} }) {
  return {
    ...runEnvironment({ home }),
    INTEROP_ACTION: 'dispatch-live',
    INTEROP_REPOSITORY: repository,
    INTEROP_EXECUTABLE: join(NATIVE_BIN, 'git'),
    TAG: tag,
    ACTION: action,
    ...extra,
  };
}

/**
 Start one incumbent commit of a changed file, from the incumbent wrapper.

 @param {{ repository: string, home: string, tag: string, action: string, extra?: Record<string, string> }} request -
   as for `probeEnvironment`
 @returns {import('./support.mjs').BackgroundRun} the running commit
 */
function startIncumbentCommit({ repository, home, tag, action, extra = {} }) {
  return startBackground({
    command: 'git',
    args: ['commit', '--quiet', '--message=hook dispatch interop', '--', 'a.txt'],
    cwd: repository,
    env: runEnvironment({
      home,
      wrapperBin: INCUMBENT_BIN,
      extra: { TAG: tag, ACTION: action, ...extra },
    }),
  });
}

/**
 Start the native probe that dispatches one live transaction, in the background.

 @param {{ repository: string, home: string, tag: string, action: string, extra?: Record<string, string> }} request -
   as for `probeEnvironment`
 @returns {import('./support.mjs').BackgroundRun} the running dispatch
 */
function startNativeDispatch(request) {
  return startBackground({
    command: binary,
    args: ['--exact', PROBE, '--ignored', '--nocapture', '--test-threads=1', '--quiet'],
    cwd: request.repository,
    env: {
      PATH: SYSTEM_PATH,
      ...probeEnvironment(request),
    },
  });
}

/**
 Make a fresh repository with its hook script configured and a changed file ready to commit.

 @param {string} name - directory label
 @returns {Promise<{ repository: string, home: string, root: string, log: string }>} fixture
 */
async function fixtureRepository(name) {
  const fixture = await createRepository({ name });
  const log = join(fixture.root, 'events.log');
  const hook = join(fixture.root, 'hook.sh');
  await writeHook(hook, log);
  // Git's config-based hooks name their event with `hook.<name>.event`, per git-hook(1).
  await runOk({
    command: REAL_GIT,
    args: ['config', 'hook.interop.command', hook],
    cwd: fixture.repository,
    env: runEnvironment({ home: fixture.home }),
  });
  await runOk({
    command: REAL_GIT,
    args: ['config', 'hook.interop.event', 'pre-commit'],
    cwd: fixture.repository,
    env: runEnvironment({ home: fixture.home }),
  });
  // The native dispatcher probe runs outside a transaction, which would have created this directory already.
  await mkdir(join(fixture.repository, '.git', 'cli-git'), { recursive: true });
  await writeFile(join(fixture.repository, 'a.txt'), `changed ${name}\n`, 'utf8');
  return { ...fixture, log };
}

/**
 Scenario 1 and 2: whichever party holds the hook lock, the other waits until the release.

 @param {{ holder: 'native' | 'incumbent' }} request - the party that starts first
 @returns {Promise<void>}
 */
async function lockBlocksBothWays({ holder }) {
  const fixture = await fixtureRepository(`lock-${holder}-first`);
  const release = join(fixture.root, 'release');
  const shared = { repository: fixture.repository, home: fixture.home, action: 'wait', extra: { RELEASE_FILE: release } };
  const other = holder === 'native' ? 'incumbent' : 'native';
  const first = holder === 'native'
    ? startNativeDispatch({ ...shared, tag: 'native' })
    : startIncumbentCommit({ ...shared, tag: 'incumbent' });
  await waitForLine(fixture.log, `start ${holder}`);
  const second = other === 'native'
    ? startNativeDispatch({ ...shared, tag: 'native' })
    : startIncumbentCommit({ ...shared, tag: 'incumbent' });
  await sleep(BLOCKED_WINDOW_MS);
  const early = (await logLines(fixture.log)).includes(`start ${other}`);
  expect({
    condition: !early,
    message: `${other} dispatcher waits while ${holder} holds the hook lock`,
  });
  await writeFile(release, '', 'utf8');
  const [firstOutcome, secondOutcome] = await Promise.all([first.outcome, second.outcome]);
  expect({
    condition: firstOutcome.status === 0 && secondOutcome.status === 0,
    message: `both dispatches finish after the release (${String(firstOutcome.status)}, ${String(secondOutcome.status)})`,
  });
  expect({
    condition: (await logLines(fixture.log)).join(' | ') === `start ${holder} | end ${holder} | start ${other} | end ${other}`,
    message: `hook runs are serialized in order: ${holder}, then ${other}`,
  });
}

/**
 Scenario 3: a native dispatcher's hook runs the incumbent nested, which must accept the preparation lease.

 @param {{ tampered: boolean }} request - whether the nested invocation carries a tampered lease
 @returns {Promise<void>}
 */
async function incumbentNestedInNative({ tampered }) {
  const fixture = await fixtureRepository(`nested-incumbent-${tampered ? 'tampered' : 'valid'}`);
  const nested = [
    tampered ? 'CLI_GIT_PREPARATION_LEASE=\'{"directory":"/nonexistent","token":"t"}\'' : '',
    `PATH='${INCUMBENT_BIN}':"$PATH"`,
    'TAG=incumbent-nested timeout 8 git commit --quiet --allow-empty --no-only --message=nested',
  ].filter(Boolean).join(' ');
  const outer = startNativeDispatch({
    repository: fixture.repository,
    home: fixture.home,
    tag: 'native',
    action: 'nest',
    extra: { NESTED_COMMAND: nested },
  });
  const outcome = await outer.outcome;
  const lines = await logLines(fixture.log);
  if (tampered) {
    expect({
      condition: lines.includes('nest-exit native 124') && outcome.status === 124,
      message: 'a tampered lease leaves the nested incumbent waiting for the hook lock until its bound',
    });
    return;
  }
  expect({
    condition: outcome.status === 0,
    message: `the incumbent nested in a native dispatcher accepts the lease (${String(outcome.status)})`,
  });
  expect({
    condition: lines.includes('nested incumbent-nested'),
    message: 'the nested incumbent commit ran its own hook without waiting for the outer lock',
  });
}

/**
 Scenario 4: an incumbent dispatcher's hook runs the native validator and read-only command nested.

 @param {{ tampered: boolean }} request - whether the nested validator sees a tampered lease
 @returns {Promise<void>}
 */
async function nativeNestedInIncumbent({ tampered }) {
  const fixture = await fixtureRepository(`nested-native-${tampered ? 'tampered' : 'valid'}`);
  const nested = [
    tampered ? 'CLI_GIT_PREPARATION_LEASE=\'{"directory":"/nonexistent","token":"t"}\'' : '',
    `INTEROP_ACTION=lease '${binary}' --exact ${PROBE} --ignored --nocapture --test-threads=1 --quiet`,
    `&& PATH='${NATIVE_BIN}':"$PATH" git status --porcelain`,
  ].filter(Boolean).join(' ');
  const outer = startBackground({
    command: 'git',
    args: ['commit', '--quiet', '--message=hook dispatch interop', '--', 'a.txt'],
    cwd: fixture.repository,
    env: runEnvironment({
      home: fixture.home,
      wrapperBin: INCUMBENT_BIN,
      extra: { TAG: 'incumbent', ACTION: 'nest', NESTED_COMMAND: nested },
    }),
  });
  const outcome = await outer.outcome;
  const expected = tampered ? 'lease-valid=false' : 'lease-valid=true';
  expect({
    condition: outcome.stdout.includes(expected) || outcome.stderr.includes(expected),
    message: `the native validator reports ${expected} for the incumbent's lease`,
  });
  expect({
    condition: outcome.status === 0,
    message: `the native read-only command runs nested in the incumbent's hook (${String(outcome.status)})`,
  });
}

await lockBlocksBothWays({ holder: 'native' });
await lockBlocksBothWays({ holder: 'incumbent' });
await incumbentNestedInNative({ tampered: false });
await incumbentNestedInNative({ tampered: true });
await nativeNestedInIncumbent({ tampered: false });
await nativeNestedInIncumbent({ tampered: true });
console.log('hook-dispatch interoperability passed');
