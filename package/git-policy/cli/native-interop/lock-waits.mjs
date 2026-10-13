/**
 Lock waits across wrappers, with real commits on both sides.

 A holder commits `a.txt` and pauses at a transaction phase (`CLI_GIT_TEST_ONLY_PHASE_SIGNAL=<phase>:pause:<markers>`),
 which keeps the lock that phase takes. A waiter of the other wrapper then runs a command that must wait for that lock:

 - `capture-locked`: the capture lock is held; a commit of `b.txt` waits to capture.
 - `landing-locked`: the landing lock and the real `index.lock` are held; a `git add` waits for them,
   and a commit of `b.txt` prepares but waits to land.

 The waiter must still be running after a blocked window, and must finish successfully after the holder is released,
 with both commits on the branch, the staged path installed and nothing left behind.
 A dead holder (killed at the phase) must not block `git add`: the waiter retires its locks and succeeds.
 The pairings with the same wrapper on both sides are controls. Failures are collected and reported at the end.
 */
/// <reference types="node" />
import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import {
  createMatrix,
  createRepository,
  leftovers,
  realGit,
  sleep,
  startThrough,
  runThrough,
  waitForFile,
} from './support.mjs';

/** Time a waiter must stay blocked before the holder is released, in milliseconds. */
const BLOCKED_WINDOW_MS = 3000;

/** Writer then waiter, crossings first. */
const PAIRINGS = [
  ['incumbent', 'native'],
  ['native', 'incumbent'],
  ['incumbent', 'incumbent'],
  ['native', 'native'],
];

/** Waiting scenarios: the phase the holder pauses at, the waiter's command and what it proves. */
const WAITS = [
  ['capture-locked', 'commit', ['commit', '--quiet', '--message=waiter', '--', 'b.txt']],
  ['landing-locked', 'add', ['add', '--', 'b.txt']],
  ['landing-locked', 'commit', ['commit', '--quiet', '--message=waiter', '--', 'b.txt']],
];

const matrix = createMatrix();

/**
 Start the holder: a commit of `a.txt` paused at the phase.

 @param {{ holder: 'incumbent' | 'native', phase: string, mode: 'pause' | 'kill', label: string }} request -
   holder wrapper, phase, whether it pauses or dies, and fixture label
 @returns {Promise<{ fixture: Awaited<ReturnType<typeof createRepository>>, markers: string, held: import('./support.mjs').BackgroundRun }>}
   the fixture, the marker directory and the running holder
 */
async function startHolder({
  holder,
  phase,
  mode,
  label,
}) {
  const fixture = await createRepository({ name: label });
  const markers = join(
    fixture.root,
    'markers',
  );
  await mkdir(
    markers,
    { recursive: true },
  );
  await writeFile(
    join(
      fixture.repository,
      'a.txt',
    ),
    'holder\n',
  );
  await writeFile(
    join(
      fixture.repository,
      'b.txt',
    ),
    'waiter\n',
  );
  const held = startThrough({
    wrapper: holder,
    fixture,
    args: [
      'commit',
      '--quiet',
      '--message=holder',
      '--',
      'a.txt',
    ],
    extra: { CLI_GIT_TEST_ONLY_PHASE_SIGNAL: `${phase}:${mode}:${markers}` },
  });
  await waitForFile({ path: join(
    markers,
    `${phase}.reached`,
  ) });
  return {
    fixture,
    markers,
    held,
  };
}

for (const [holder, waiter] of PAIRINGS) {
  for (const [phase, kind, args] of WAITS) {
    const tag = `${holder} holds ${phase}, ${waiter} ${kind}`;
    const { fixture, markers, held } = await startHolder({
      holder,
      phase,
      mode: 'pause',
      label: `wait-${holder}-${waiter}-${phase}-${kind}`,
    });
    const blocked = startThrough({
      wrapper: waiter,
      fixture,
      args,
    });
    await sleep(BLOCKED_WINDOW_MS);
    matrix.check({
      condition: blocked.child.exitCode === null && blocked.child.signalCode === null,
      message: `${tag}: the waiter is still waiting after ${String(BLOCKED_WINDOW_MS)} ms`,
    });
    await writeFile(
      join(
        markers,
        `${phase}.release`,
      ),
      '',
    );
    const [heldOutcome, waiterOutcome] = await Promise.all([
      held.outcome,
      blocked.outcome,
    ]);
    matrix.check({
      condition: heldOutcome.status === 0,
      message: `${tag}: the released holder landed (status ${String(heldOutcome.status)}; ${heldOutcome.stderr.trim().slice(0, 400)})`,
    });
    matrix.check({
      condition: waiterOutcome.status === 0,
      message: `${tag}: the waiter finished after the release (status ${String(waiterOutcome.status)}; ${waiterOutcome.stderr.trim().slice(0, 400)})`,
    });
    if (kind === 'commit') {
      const subjects = (await realGit(
        fixture,
        ['log', '--format=%s', '-3'],
      )).split('\n');
      matrix.check({
        condition: subjects.includes('holder') && subjects.includes('waiter'),
        message: `${tag}: both commits are on the branch (${subjects.join(' | ')})`,
      });
    }
    else {
      matrix.check({
        condition: (await realGit(
          fixture,
          ['diff', '--cached', '--name-only'],
        )) === 'b.txt',
        message: `${tag}: the added path is staged after the holder's index installed`,
      });
    }
    const left = await leftovers(fixture);
    matrix.check({
      condition: left.length === 0,
      message: `${tag}: nothing is left behind (${left.join(', ') || 'none'})`,
    });
  }
  for (const phase of ['capture-locked', 'landing-locked']) {
    const tag = `${holder} dies at ${phase}, ${waiter} add`;
    const { fixture, held } = await startHolder({
      holder,
      phase,
      mode: 'kill',
      label: `dead-${holder}-${waiter}-${phase}`,
    });
    const killed = await held.outcome;
    matrix.check({
      condition: killed.signal === 'SIGKILL',
      message: `${tag}: the holder died at the phase`,
    });
    const added = await runThrough({
      wrapper: waiter,
      fixture,
      args: ['add', '--', 'b.txt'],
    });
    matrix.check({
      condition: added.status === 0,
      message: `${tag}: the waiter retired the dead holder's locks and added (status ${String(added.status)}; ${added.stderr.trim().slice(0, 400)})`,
    });
    const left = await leftovers(
      fixture,
      { staleLocks: true },
    );
    matrix.check({
      condition: left.length === 0,
      message: `${tag}: nothing but a stale lock directory is left (${left.join(', ') || 'none'})`,
    });
  }
}

matrix.finish();
console.log('lock-waits passed');
