/**
 Captures the on-disk state the incumbent wrapper leaves, as the old-format fixtures the native wrapper must read.

 Each fixture is a whole disposable repository under `/work/scratch/fixture/<name>/` (transaction records name
 absolute paths, so the location is fixed):

 - `phase-<phase>`: the incumbent committed `a.txt` and killed itself at the phase, for each of `capture-locked`,
   `preparation-done`, `landing-locked`, `objects-migrated`, `ref-updated` and `index-installed`.
 - `completed`: two commits the incumbent finished, which leave the capture store (`sequence`, `worktree-id`) and the
   landed-capture records.
 - `hook-lock-dead`: the incumbent was killed while its `pre-commit` hook ran, which leaves a dead hook lock.

 The driver prints the fixtures as one tar archive, base64 encoded between the lines `FIXTURE-TAR-BEGIN` and
 `FIXTURE-TAR-END`. The host side of the capture unpacks it into `native-interop/fixture/`, renaming every `.git`
 directory to `dot-git` (a repository cannot track a path named `.git`).
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
  createRepository,
  expect,
  run,
  runEnvironment,
  runOk,
  runThrough,
  sleep,
  startThrough,
  waitForFile,
} from './support.mjs';

const FIXTURES = '/work/scratch/fixture';

/** Phases in transaction order. */
const PHASES = [
  'capture-locked',
  'preparation-done',
  'landing-locked',
  'objects-migrated',
  'ref-updated',
  'index-installed',
];

/**
 Create a fixture repository at its fixed location.

 @param {string} name - fixture name
 @returns {Promise<Awaited<ReturnType<typeof createRepository>>>} the repository
 */
async function fixtureRepository(name) {
  const root = join(
    FIXTURES,
    name,
  );
  await mkdir(
    root,
    { recursive: true },
  );
  return createRepository({
    name,
    fixedRoot: root,
  });
}

for (const phase of PHASES) {
  const fixture = await fixtureRepository(`phase-${phase}`);
  const markers = join(
    fixture.root,
    'markers',
  );
  await mkdir(markers);
  await writeFile(
    join(
      fixture.repository,
      'a.txt',
    ),
    'second\n',
  );
  const killed = await runThrough({
    wrapper: 'incumbent',
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
  expect({
    condition: killed.signal === 'SIGKILL' || killed.status === 137,
    message: `phase-${phase}: the incumbent killed itself`,
  });
}

{
  const fixture = await fixtureRepository('completed');
  for (const name of ['a.txt', 'b.txt']) {
    await writeFile(
      join(
        fixture.repository,
        name,
      ),
      `${name} changed\n`,
    );
    await runOk({
      command: '/usr/bin/git',
      args: ['add', '--', name],
      cwd: fixture.repository,
      env: runEnvironment({ home: fixture.home }),
    });
    const outcome = await runThrough({
      wrapper: 'incumbent',
      fixture,
      args: [
        'commit',
        '--quiet',
        `--message=complete ${name}`,
        '--',
        name,
      ],
    });
    expect({
      condition: outcome.status === 0,
      message: `completed: the incumbent landed ${name} (${outcome.stderr.trim()})`,
    });
  }
}

{
  const fixture = await fixtureRepository('hook-lock-dead');
  const log = join(
    fixture.root,
    'hook.log',
  );
  const hook = join(
    fixture.root,
    'hook.sh',
  );
  await writeFile(
    hook,
    [
      '#!/bin/sh',
      `echo "start" >> '${log}'`,
      'if [ -n "$BLOCK_HOOK" ]; then sleep 600; fi',
      `echo "end" >> '${log}'`,
      '',
    ].join('\n'),
  );
  await chmod(
    hook,
    0o700,
  );
  await runOk({
    command: '/usr/bin/git',
    args: ['config', 'hook.pre-commit.command', hook],
    cwd: fixture.repository,
    env: runEnvironment({ home: fixture.home }),
  });
  await writeFile(
    join(
      fixture.repository,
      'a.txt',
    ),
    'hooked\n',
  );
  const blocked = startThrough({
    wrapper: 'incumbent',
    fixture,
    args: [
      'commit',
      '--quiet',
      '--message=hooked',
      '--',
      'a.txt',
    ],
    extra: { BLOCK_HOOK: '1' },
  });
  await waitForFile({ path: log });
  await sleep(500);
  await run({
    command: 'pkill',
    args: ['--signal', 'KILL', '--full', '/opt/cli-git'],
    cwd: fixture.repository,
    env: runEnvironment({ home: fixture.home }),
  });
  await run({
    command: 'pkill',
    args: ['--signal', 'KILL', '--exact', 'sleep'],
    cwd: fixture.repository,
    env: runEnvironment({ home: fixture.home }),
  });
  await blocked.outcome;
  expect({
    condition: (await readFile(
      join(
        fixture.repository,
        '.git/cli-git/hook.lock/owner.json',
      ),
      'utf8',
    )).length > 0,
    message: 'hook-lock-dead: the dead incumbent left its hook lock record',
  });
}

await runOk({
  command: 'tar',
  args: [
    '--create',
    '--file=/work/scratch/fixtures.tar',
    '--directory=/work/scratch/fixture',
    '--exclude=repository/.git/hooks',
    '--exclude=home',
    '.',
  ],
  cwd: '/work/scratch',
  env: runEnvironment({ home: '/work/scratch' }),
});
const archive = (await readFile('/work/scratch/fixtures.tar')).toString('base64');
console.log('FIXTURE-TAR-BEGIN');
for (let offset = 0; offset < archive.length; offset += 100)
  console.log(archive.slice(
    offset,
    offset + 100,
  ));
console.log('FIXTURE-TAR-END');
