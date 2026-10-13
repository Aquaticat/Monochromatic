/**
 Crash recovery across wrappers, in every writer and reader pairing.

 For each writer (the incumbent or the native wrapper) and each reader, and for each transaction phase from
 `capture-locked` to `index-installed`, the writer commits `a.txt` and kills itself at the phase
 (`CLI_GIT_TEST_ONLY_PHASE_SIGNAL=<phase>:kill:<markers>`). Two recovery routes then run on separate repositories:

 - status route: the reader runs `git status --porcelain`; it must recover the dead transaction and succeed.
 - commit route: the reader commits `b.txt` directly; it must recover the dead transaction and land its own commit.

 Afterwards the dead commit landed whole (from `ref-updated` on) or not at all, the real index matches `HEAD`,
 the worktree keeps the edit, `git fsck` is clean, nothing is left behind, and both wrappers land a follow-up commit.
 The pairings with the same wrapper on both sides are controls: they show which failures belong to the crossing.
 Failures are collected and reported together at the end.
 */
/// <reference types="node" />
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import {
  createMatrix,
  createRepository,
  leftovers,
  namesIn,
  realGit,
  run,
  runEnvironment,
  runOk,
  runThrough,
  REAL_GIT,
} from './support.mjs';

/** Phases in transaction order, with whether the commit has landed when the writer dies there. */
const PHASES = [
  ['capture-locked', false],
  ['preparation-done', false],
  ['landing-locked', false],
  ['objects-migrated', false],
  ['ref-updated', true],
  ['index-installed', true],
];

/** Writer then reader, crossings first. */
const PAIRINGS = [
  ['incumbent', 'native'],
  ['native', 'incumbent'],
  ['incumbent', 'incumbent'],
  ['native', 'native'],
];

const matrix = createMatrix();

/**
 Leave a dead transaction behind: the writer commits `a.txt` and dies at the phase.

 @param {{ writer: 'incumbent' | 'native', phase: string, label: string }} request - writer, phase and fixture label
 @returns {Promise<{ fixture: Awaited<ReturnType<typeof createRepository>>, before: string, tag: string }>} the fixture
   with the dead transaction and the `HEAD` before it
 */
async function leaveDeadTransaction({
  writer,
  phase,
  label,
}) {
  const tag = `${label}: ${writer} dies at ${phase}`;
  const fixture = await createRepository({ name: `${label}-${writer}-${phase}` });
  const markers = join(
    fixture.root,
    'markers',
  );
  await mkdir(
    markers,
    { recursive: true },
  );
  const before = await realGit(
    fixture,
    ['rev-parse', 'HEAD'],
  );
  await writeFile(
    join(
      fixture.repository,
      'a.txt',
    ),
    'second\n',
  );
  const killed = await runThrough({
    wrapper: writer,
    fixture,
    args: [
      'commit',
      '--quiet',
      `--message=change at ${phase}`,
      '--',
      'a.txt',
    ],
    extra: { CLI_GIT_TEST_ONLY_PHASE_SIGNAL: `${phase}:kill:${markers}` },
  });
  matrix.check({
    condition: (killed.signal === 'SIGKILL') || (killed.status === 137),
    message: `${tag}: the writer killed itself (status ${String(killed.status)}, signal ${String(killed.signal)}; ${killed.stderr.trim().slice(0, 300)})`,
  });
  matrix.check({
    condition: (await namesIn(markers)).includes(`${phase}.reached`),
    message: `${tag}: the marker was reached`,
  });
  const left = (await namesIn(join(
    fixture.repository,
    '.git/cli-git-transactions',
  ))).filter(function isTransaction(name) {
    return !name.endsWith('.lock');
  });
  matrix.check({
    condition: left.length === 1,
    message: `${tag}: one transaction directory was left (${left.join(', ')})`,
  });
  return {
    fixture,
    before,
    tag,
  };
}

/**
 Assert the repository is whole after the dead transaction was recovered.

 @param {{ fixture: Awaited<ReturnType<typeof createRepository>>, before: string, tag: string, phase: string,
   landed: boolean, staleLocks: boolean }} request - the fixture, its earlier `HEAD`, the label, the phase,
   whether the commit landed, and whether dead holders' lock directories may remain (a recovery that took no lock)
 */
async function assertRecovered({
  fixture,
  before,
  tag,
  phase,
  landed,
  staleLocks,
}) {
  const subjects = (await realGit(
    fixture,
    ['log', '--format=%s', `${before}..HEAD`],
  )).split('\n').filter(Boolean);
  const deadSubject = `change at ${phase}`;
  matrix.check({
    condition: subjects.includes(deadSubject) === landed,
    message: `${tag}: the dead commit ${landed ? 'landed whole' : 'did not land'} (commits after the base: ${subjects.join(' | ') || 'none'})`,
  });
  if (landed) {
    matrix.check({
      condition: (await realGit(
        fixture,
        ['show', 'HEAD:a.txt'],
      )) === 'second',
      message: `${tag}: the landed tree holds the edit`,
    });
  }
  const cached = await run({
    command: REAL_GIT,
    args: ['diff', '--cached', '--quiet', '--', 'a.txt'],
    cwd: fixture.repository,
    env: runEnvironment({ home: fixture.home }),
  });
  matrix.check({
    condition: cached.status === 0,
    message: `${tag}: the real index equals HEAD for a.txt`,
  });
  matrix.check({
    condition: (await readFile(
      join(
        fixture.repository,
        'a.txt',
      ),
      'utf8',
    )) === 'second\n',
    message: `${tag}: the worktree keeps the edit`,
  });
  const fsck = await run({
    command: REAL_GIT,
    args: ['fsck', '--no-dangling'],
    cwd: fixture.repository,
    env: runEnvironment({ home: fixture.home }),
  });
  matrix.check({
    condition: fsck.status === 0,
    message: `${tag}: git fsck is clean (${fsck.stderr.trim().slice(0, 300)})`,
  });
  const left = await leftovers(
    fixture,
    { staleLocks },
  );
  matrix.check({
    condition: left.length === 0,
    message: `${tag}: nothing is left behind (${left.join(', ') || 'none'})`,
  });
  const landedRecords = await namesIn(join(
    fixture.repository,
    '.git/cli-git-captures/landed',
  ));
  matrix.check({
    condition: landedRecords.length === 0,
    message: `${tag}: no landed-capture record remains (${landedRecords.join(', ') || 'none'})`,
  });
}

for (const [writer, reader] of PAIRINGS) {
  for (const [phase, landed] of PHASES) {
    // Status route.
    {
      const dead = await leaveDeadTransaction({
        writer,
        phase,
        label: `status ${writer}->${reader}`,
      });
      const status = await runThrough({
        wrapper: reader,
        fixture: dead.fixture,
        args: ['status', '--porcelain'],
      });
      matrix.check({
        condition: status.status === 0,
        message: `${dead.tag}: ${reader} git status recovered and ran (status ${String(status.status)}; ${status.stderr.trim().slice(0, 400)})`,
      });
      await assertRecovered({
        ...dead,
        phase,
        landed,
        staleLocks: true,
      });
      for (const follower of new Set([writer, reader])) {
        await writeFile(
          join(
            dead.fixture.repository,
            `follow-${follower}.txt`,
          ),
          'follow-up\n',
        );
        await runOk({
          command: REAL_GIT,
          args: ['add', '--', `follow-${follower}.txt`],
          cwd: dead.fixture.repository,
          env: runEnvironment({ home: dead.fixture.home }),
        });
        const follow = await runThrough({
          wrapper: follower,
          fixture: dead.fixture,
          args: [
            'commit',
            '--quiet',
            `--message=follow-up ${follower}`,
            '--',
            `follow-${follower}.txt`,
          ],
        });
        matrix.check({
          condition: follow.status === 0,
          message: `${dead.tag}: the ${follower} wrapper then landed a follow-up commit (status ${String(follow.status)}; ${follow.stderr.trim().slice(0, 400)})`,
        });
      }
      const afterCommits = await leftovers(dead.fixture);
      matrix.check({
        condition: afterCommits.length === 0,
        message: `${dead.tag}: after the follow-up commits no stale lock remains (${afterCommits.join(', ') || 'none'})`,
      });
    }
    // Commit route.
    {
      const dead = await leaveDeadTransaction({
        writer,
        phase,
        label: `commit ${writer}->${reader}`,
      });
      await writeFile(
        join(
          dead.fixture.repository,
          'b.txt',
        ),
        'reader\n',
      );
      const commit = await runThrough({
        wrapper: reader,
        fixture: dead.fixture,
        args: [
          'commit',
          '--quiet',
          '--message=reader commit',
          '--',
          'b.txt',
        ],
      });
      matrix.check({
        condition: commit.status === 0,
        message: `${dead.tag}: the ${reader} commit recovered the dead transaction and landed (status ${String(commit.status)}; ${commit.stderr.trim().slice(0, 400)})`,
      });
      matrix.check({
        condition: (await realGit(
          dead.fixture,
          ['show', 'HEAD:b.txt'],
        )) === 'reader',
        message: `${dead.tag}: the reader's commit holds b.txt`,
      });
      await assertRecovered({
        ...dead,
        phase,
        landed,
        staleLocks: false,
      });
    }
  }
}

matrix.finish();
console.log('crash-matrix passed');
