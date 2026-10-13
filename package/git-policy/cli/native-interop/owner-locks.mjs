/**
 Owner locks and birth identities between the incumbent and the native wrapper, both ways.

 1. The incumbent pauses holding its capture lock; the native identity of the holder's PID equals
    the identity the incumbent wrote, byte for byte, and the native acquirer finds the lock busy.
 2. The incumbent is killed holding the landing lock; the native acquirer retires and takes it.
 3. The native probe holds the hook lock; the incumbent's hook dispatcher waits for it.
 4. The native probe is killed holding the hook lock; the incumbent's dispatcher retires it.
 */
/// <reference types="node" />
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import {
  INCUMBENT_BIN,
  REAL_GIT,
  createRepository,
  expect,
  nativeProbeBinary,
  runEnvironment,
  runNativeProbe,
  runOk,
  sleep,
  startBackground,
  waitForFile,
} from './support.mjs';

const PROBE = 'owner_lock::tests::interop_probe';
const binary = await nativeProbeBinary();

/**
 Start an incumbent commit of `a.txt` with a phase marker armed.

 @param {{ fixture: { repository: string, home: string }, marker: string }} request - repository and marker value
 @returns {import('./support.mjs').BackgroundRun} the running commit
 */
function startIncumbentCommit({
  fixture,
  marker,
}) {
  return startBackground({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '--message=paused by the interoperability driver',
      '--',
      'a.txt',
    ],
    cwd: fixture.repository,
    env: runEnvironment({
      home: fixture.home,
      wrapperBin: INCUMBENT_BIN,
      extra: { CLI_GIT_TEST_ONLY_PHASE_SIGNAL: marker },
    }),
  });
}

// 1. A live incumbent lock: identities agree, and the native acquirer leaves it alone.
{
  const fixture = await createRepository({ name: 'locks-live' });
  await writeFile(
    join(
      fixture.repository,
      'a.txt',
    ),
    'second\n',
  );
  const markers = join(
    fixture.root,
    'markers',
  );
  await mkdir(markers);
  const commit = startIncumbentCommit({
    fixture,
    marker: `capture-locked:pause:${markers}`,
  });
  const pausedPid = (await waitForFile({ path: join(
    markers,
    'capture-locked.reached',
  ) })).trim();
  const captureLock = join(
    fixture.repository,
    '.git/cli-git-captures/capture.lock',
  );
  const record = JSON.parse(await readFile(
    join(
      captureLock,
      'owner.json',
    ),
    'utf8',
  ));
  expect({
    condition: String(record.ownerPid) === pausedPid,
    message: `the incumbent's capture lock names its paused process ${pausedPid}`,
  });
  const [identity] = await runNativeProbe({
    binary,
    test: PROBE,
    cwd: fixture.root,
    env: {
      INTEROP_ACTION: 'identity',
      INTEROP_PID: pausedPid,
    },
  });
  expect({
    condition: identity === `identity=${record.ownerBirthIdentity}`,
    message: `native identity ${String(identity)} equals the incumbent's ${String(record.ownerBirthIdentity)}`,
  });
  const [transaction] = (await runOk({
    command: 'ls',
    args: [join(
      fixture.repository,
      '.git/cli-git-transactions',
    )],
    cwd: fixture.root,
    env: runEnvironment({ home: fixture.home }),
  })).split('\n')
    .filter(function isTransaction(name) {
      return /^[0-9a-f-]{36}$/u.test(name);
    });
  const owner = JSON.parse(await readFile(
    join(
      fixture.repository,
      '.git/cli-git-transactions',
      String(transaction),
      'owner.json',
    ),
    'utf8',
  ));
  expect({
    condition: owner.ownerIdentity === record.ownerBirthIdentity,
    message: 'the incumbent transaction owner record carries the same identity',
  });
  const [tryAnswer] = await runNativeProbe({
    binary,
    test: PROBE,
    cwd: fixture.root,
    env: {
      INTEROP_ACTION: 'try',
      INTEROP_LOCK: captureLock,
    },
  });
  expect({
    condition: tryAnswer === 'busy',
    message: 'the native acquirer finds the live incumbent lock busy',
  });
  const after = JSON.parse(await readFile(
    join(
      captureLock,
      'owner.json',
    ),
    'utf8',
  ));
  expect({
    condition: after.token === record.token,
    message: 'the live incumbent lock is untouched',
  });
  await writeFile(
    join(
      markers,
      'capture-locked.release',
    ),
    '',
  );
  const finished = await commit.outcome;
  expect({
    condition: finished.status === 0,
    message: `the released incumbent commit lands (${finished.stderr.trim()})`,
  });
}

// 2. A dead incumbent lock: the native acquirer retires and takes it.
{
  const fixture = await createRepository({ name: 'locks-dead' });
  await writeFile(
    join(
      fixture.repository,
      'a.txt',
    ),
    'second\n',
  );
  const commit = startIncumbentCommit({
    fixture,
    marker: 'landing-locked:kill',
  });
  const killed = await commit.outcome;
  expect({
    condition: killed.signal === 'SIGKILL',
    message: 'the incumbent killed itself holding the landing lock',
  });
  const landingLock = join(
    fixture.repository,
    '.git/cli-git-transactions/landing.lock',
  );
  const dead = JSON.parse(await readFile(
    join(
      landingLock,
      'owner.json',
    ),
    'utf8',
  ));
  const [answer] = await runNativeProbe({
    binary,
    test: PROBE,
    cwd: fixture.root,
    env: {
      INTEROP_ACTION: 'acquire',
      INTEROP_LOCK: landingLock,
    },
  });
  expect({
    condition: answer === 'acquired',
    message: `the native acquirer retired the dead incumbent's landing lock (PID ${String(dead.ownerPid)})`,
  });
}

/**
 Prepare a repository whose `pre-commit` hook records that it ran.

 @param {{ name: string }} request - fixture label
 @returns {Promise<{ fixture: { root: string, repository: string, home: string }, ran: string, hookLock: string }>}
   the fixture, the hook's marker file and the hook lock path
 */
async function hookedRepository({ name }) {
  const fixture = await createRepository({ name });
  const ran = join(
    fixture.root,
    'hook-ran',
  );
  await writeFile(
    join(
      fixture.repository,
      '.git/hooks/pre-commit',
    ),
    `#!/bin/sh\necho ran >> ${JSON.stringify(ran)}\n`,
    { mode: 0o755 },
  );
  await writeFile(
    join(
      fixture.repository,
      'a.txt',
    ),
    'second\n',
  );
  await mkdir(join(
    fixture.repository,
    '.git/cli-git',
  ));
  return {
    fixture,
    ran,
    hookLock: join(
      fixture.repository,
      '.git/cli-git/hook.lock',
    ),
  };
}

// 3. A live native lock: the incumbent's dispatcher waits for it.
{
  const { fixture, ran, hookLock } = await hookedRepository({ name: 'locks-native-live' });
  const ready = join(
    fixture.root,
    'probe-ready',
  );
  const release = join(
    fixture.root,
    'probe-release',
  );
  const holder = startBackground({
    command: binary,
    args: [
      '--exact',
      PROBE,
      '--ignored',
      '--nocapture',
      '--test-threads=1',
      '--quiet',
    ],
    cwd: fixture.root,
    env: {
      PATH: '/usr/bin:/bin',
      HOME: fixture.home,
      INTEROP_ACTION: 'hold',
      INTEROP_LOCK: hookLock,
      INTEROP_READY: ready,
      INTEROP_RELEASE: release,
    },
  });
  await waitForFile({ path: ready });
  const commit = startIncumbentCommit({
    fixture,
    marker: '',
  });
  await sleep(2000);
  let ranEarly = true;
  try {
    await readFile(ran);
  }
  catch {
    ranEarly = false;
  }
  expect({
    condition: !ranEarly && commit.child.exitCode === null,
    message: 'the incumbent waits for the hook lock the native probe holds',
  });
  await writeFile(
    release,
    '',
  );
  const held = await holder.outcome;
  expect({
    condition: held.status === 0 && held.stdout.includes('released'),
    message: 'the native probe released its hook lock',
  });
  const finished = await commit.outcome;
  expect({
    condition: finished.status === 0 && (await readFile(
      ran,
      'utf8',
    )) === 'ran\n',
    message: `the incumbent commit then ran its hook once and landed (${finished.stderr.trim()})`,
  });
}

// 4. A dead native lock: the incumbent's dispatcher retires it.
{
  const { fixture, ran, hookLock } = await hookedRepository({ name: 'locks-native-dead' });
  const ready = join(
    fixture.root,
    'probe-ready',
  );
  const holder = startBackground({
    command: binary,
    args: [
      '--exact',
      PROBE,
      '--ignored',
      '--nocapture',
      '--test-threads=1',
      '--quiet',
    ],
    cwd: fixture.root,
    env: {
      PATH: '/usr/bin:/bin',
      HOME: fixture.home,
      INTEROP_ACTION: 'hold',
      INTEROP_LOCK: hookLock,
      INTEROP_READY: ready,
      INTEROP_RELEASE: join(
        fixture.root,
        'never',
      ),
    },
  });
  const holderPid = Number((await waitForFile({ path: ready })).trim());
  process.kill(
    holderPid,
    'SIGKILL',
  );
  const killed = await holder.outcome;
  expect({
    condition: killed.signal === 'SIGKILL',
    message: 'the native probe died holding the hook lock',
  });
  const native = JSON.parse(await readFile(
    join(
      hookLock,
      'owner.json',
    ),
    'utf8',
  ));
  expect({
    condition: native.ownerPid === holderPid && native.ownerBirthIdentity.startsWith('linux:'),
    message: 'the dead native lock names the probe with a Linux identity',
  });
  const commit = startIncumbentCommit({
    fixture,
    marker: '',
  });
  const finished = await commit.outcome;
  expect({
    condition: finished.status === 0 && (await readFile(
      ran,
      'utf8',
    )) === 'ran\n',
    message: `the incumbent retired the dead native lock and landed (${finished.stderr.trim()})`,
  });
  const log = await runOk({
    command: REAL_GIT,
    args: [
      'log',
      '-1',
      '--format=%s',
    ],
    cwd: fixture.repository,
    env: runEnvironment({ home: fixture.home }),
  });
  expect({
    condition: log.trim() === 'paused by the interoperability driver',
    message: 'the commit is on the branch',
  });
}
