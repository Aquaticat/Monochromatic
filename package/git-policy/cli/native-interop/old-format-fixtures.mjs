/**
 The native wrapper reads on-disk state in the format the retired incumbent wrapper wrote.

 The fixtures under `native-interop/fixture/` are plain files captured from the incumbent (pinned revision
 `f4fc1fa213ece65672e4314983a75266837892f9`) by `capture-fixtures.mjs`; every `.git` directory is stored as `dot-git`,
 and the symbolic links the incumbent's shadow repositories hold are listed in the fixture's `links.tsv`
 (path relative to the fixture, a tab, the absolute target) and recreated on restore.
 Each fixture is restored to the absolute location it was captured at (its records name absolute paths), and then
 only the native wrapper runs against it:

 - `phase-capture-locked` and `phase-preparation-done`: the incumbent died before it touched the landing state.
   A native `git status` must recover the dead transaction; afterwards the commit did not land, the real index
   matches `HEAD`, the worktree keeps the edit, `git fsck` is clean, only a dead holder's lock directory may
   remain, and a native commit lands.
 - `phase-landing-locked`, `phase-objects-migrated`, `phase-ref-updated` and `phase-index-installed`: the records
   name device and inode numbers of files the incumbent created (the real `index.lock`, recovery hard links), and a
   restored copy of those files has other numbers. The native wrapper must read every stored record and either
   recover or refuse with its identity-changed message, never with a message about a malformed or unsupported
   record; the repository must stay whole (`git fsck` clean, `HEAD` at the base or at the landed commit).
   Full recovery of these four phases is proven live by `crash-matrix.mjs`.
 - `completed`: two finished incumbent commits left the capture store and landed-capture records; a native commit
   must land and advance the capture sequence.
 - `hook-lock-dead`: the incumbent died holding the hook lock; a native commit must retire the lock, run the hook and land.
 */
/// <reference types="node" />
import {
  chmod,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import {
  createMatrix,
  leftovers,
  namesIn,
  realGit,
  run,
  runEnvironment,
  runThrough,
  REAL_GIT,
} from './support.mjs';

/** Where the fixtures sit in the image. */
const FIXTURE_SOURCE = '/fixture/native-interop/fixture';
/** Where each fixture is restored: the location it was captured at. */
const FIXTURE_TARGET = '/work/scratch/fixture';
/** Directory name that stands for `.git` in the stored fixtures. */
const STORED_GIT_NAME = 'dot-git';

/** Phases whose records hold no identity of a file that a copy cannot reproduce, with whether the commit had landed. */
const RESTORABLE_PHASES = [
  ['capture-locked', false],
  ['preparation-done', false],
];
/** Phases whose records name device and inode numbers of files the incumbent created. */
const IDENTITY_BOUND_PHASES = [
  ['landing-locked', false],
  ['objects-migrated', false],
  ['ref-updated', true],
  ['index-installed', true],
];
/** Words that would mean the native wrapper could not read a stored record. */
const UNREADABLE_RECORD = /malformed|unsupported|unexpected|not valid|cannot parse|failed to parse/iu;

const matrix = createMatrix();

/**
 Restore one stored directory tree, renaming `dot-git` entries back to `.git` and applying private modes.

 @param {{ from: string, to: string }} request - stored directory and destination
 */
async function restoreTree({
  from,
  to,
}) {
  await mkdir(
    to,
    {
      recursive: true,
      mode: 0o700,
    },
  );
  await chmod(
    to,
    0o700,
  );
  for (const entry of await readdir(
    from,
    { withFileTypes: true },
  )) {
    const name = entry.name === STORED_GIT_NAME ? '.git' : entry.name;
    if (entry.isDirectory()) {
      await restoreTree({
        from: join(
          from,
          entry.name,
        ),
        to: join(
          to,
          name,
        ),
      });
    }
    else {
      const destination = join(
        to,
        name,
      );
      await copyFile(
        join(
          from,
          entry.name,
        ),
        destination,
      );
      await chmod(
        destination,
        name.endsWith('.sh') ? 0o700 : 0o600,
      );
    }
  }
}

/**
 Restore one fixture and the empty directories a repository needs but a stored tree cannot hold.

 @param {string} name - fixture name
 @returns {Promise<{ root: string, repository: string, home: string }>} the restored fixture
 */
async function restoreFixture(name) {
  const root = join(
    FIXTURE_TARGET,
    name,
  );
  await restoreTree({
    from: join(
      FIXTURE_SOURCE,
      name,
    ),
    to: root,
  });
  const repository = join(
    root,
    'repository',
  );
  const home = join(
    root,
    'home',
  );
  await mkdir(
    home,
    { recursive: true },
  );
  const manifest = join(
    root,
    'links.tsv',
  );
  for (const line of (await readFile(
    manifest,
    'utf8',
  ).catch(function noLinks() {
    return '';
  })).split('\n').filter(Boolean)) {
    const [path, target] = line.split('\t');
    await symlink(
      String(target),
      join(
        root,
        String(path),
      ),
    );
  }
  await rm(
    manifest,
    { force: true },
  );
  for (const directory of [
    '.git/objects/pack',
    '.git/objects/info',
    '.git/refs/heads',
    '.git/refs/tags',
    '.git/hooks',
  ]) {
    await mkdir(
      join(
        repository,
        directory,
      ),
      { recursive: true },
    );
  }
  return {
    root,
    repository,
    home,
  };
}

/**
 Read the capture store's sequence number.

 @param {{ repository: string }} fixture - repository
 @returns {Promise<number>} the last allocated sequence
 */
async function captureSequence(fixture) {
  return Number((await readFile(
    join(
      fixture.repository,
      '.git/cli-git-captures/sequence',
    ),
    'utf8',
  )).trim());
}

for (const [phase] of IDENTITY_BOUND_PHASES) {
  const name = `phase-${phase}`;
  const fixture = await restoreFixture(name);
  const base = await realGit(
    fixture,
    ['rev-parse', 'HEAD'],
  );
  const status = await runThrough({
    wrapper: 'native',
    fixture,
    args: ['status', '--porcelain'],
  });
  matrix.check({
    condition: status.status === 0 || /identity changed/u.test(status.stderr + status.stdout),
    message: `${name}: native git status read the stored records and recovered or refused on identity (status ${String(status.status)}; ${(status.stderr + status.stdout).trim().slice(0, 300)})`,
  });
  matrix.check({
    condition: !UNREADABLE_RECORD.test(status.stderr + status.stdout),
    message: `${name}: no stored record was reported unreadable`,
  });
  const head = await realGit(
    fixture,
    ['rev-parse', 'HEAD'],
  );
  const subjects = (await realGit(
    fixture,
    ['log', '--format=%s', `${base}..HEAD`],
  )).split('\n').filter(Boolean);
  matrix.check({
    condition: head === base || subjects.join('|') === `change at ${phase}`,
    message: `${name}: HEAD is at the base or at the incumbent's landed commit (${subjects.join('|') || 'base'})`,
  });
  const fsck = await run({
    command: REAL_GIT,
    args: ['fsck', '--no-dangling'],
    cwd: fixture.repository,
    env: runEnvironment({ home: fixture.home }),
  });
  matrix.check({
    condition: fsck.status === 0,
    message: `${name}: git fsck is clean (${fsck.stderr.trim().slice(0, 300)})`,
  });
}

for (const [phase, landed] of RESTORABLE_PHASES) {
  const name = `phase-${phase}`;
  const fixture = await restoreFixture(name);
  const tag = `${name}`;
  const base = await realGit(
    fixture,
    ['rev-parse', 'HEAD'],
  );
  const dead = (await namesIn(join(
    fixture.repository,
    '.git/cli-git-transactions',
  ))).filter(function isTransaction(entry) {
    return !entry.endsWith('.lock');
  });
  matrix.check({
    condition: dead.length === 1,
    message: `${tag}: the stored incumbent transaction directory is present (${dead.join(', ')})`,
  });
  const status = await runThrough({
    wrapper: 'native',
    fixture,
    args: ['status', '--porcelain'],
  });
  matrix.check({
    condition: status.status === 0,
    message: `${tag}: native git status recovered the stored transaction (status ${String(status.status)}; ${status.stderr.trim().slice(0, 400)})`,
  });
  const subjects = (await realGit(
    fixture,
    ['log', '--format=%s', `${base}..HEAD`],
  )).split('\n').filter(Boolean);
  matrix.check({
    condition: subjects.includes(`change at ${phase}`) === landed,
    message: `${tag}: the commit ${landed ? 'landed whole' : 'did not land'}`,
  });
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
    { staleLocks: true },
  );
  matrix.check({
    condition: left.length === 0,
    message: `${tag}: nothing but a dead holder's lock directory is left (${left.join(', ') || 'none'})`,
  });
  await writeFile(
    join(
      fixture.repository,
      'b.txt',
    ),
    'follow-up\n',
  );
  const follow = await runThrough({
    wrapper: 'native',
    fixture,
    args: [
      'commit',
      '--quiet',
      '--message=native follow-up',
      '--',
      'b.txt',
    ],
  });
  matrix.check({
    condition: follow.status === 0 && (await realGit(
      fixture,
      ['log', '-1', '--format=%s'],
    )) === 'native follow-up',
    message: `${tag}: a native commit then landed (status ${String(follow.status)}; ${follow.stderr.trim().slice(0, 400)})`,
  });
}

{
  const tag = 'completed';
  const fixture = await restoreFixture('completed');
  const before = await captureSequence(fixture);
  const landedBefore = await namesIn(join(
    fixture.repository,
    '.git/cli-git-captures/landed',
  ));
  matrix.check({
    condition: before > 0,
    message: `${tag}: the stored capture sequence is ${String(before)} and ${String(landedBefore.length)} landed-capture records are stored`,
  });
  await writeFile(
    join(
      fixture.repository,
      'a.txt',
    ),
    'native after the incumbent\n',
  );
  const commit = await runThrough({
    wrapper: 'native',
    fixture,
    args: [
      'commit',
      '--quiet',
      '--message=native after the incumbent',
      '--',
      'a.txt',
    ],
  });
  matrix.check({
    condition: commit.status === 0,
    message: `${tag}: a native commit landed over the incumbent's capture store (status ${String(commit.status)}; ${commit.stderr.trim().slice(0, 400)})`,
  });
  const after = await captureSequence(fixture);
  matrix.check({
    condition: after > before,
    message: `${tag}: the capture sequence advanced from ${String(before)} to ${String(after)}`,
  });
  matrix.check({
    condition: (await realGit(
      fixture,
      ['show', 'HEAD:a.txt'],
    )) === 'native after the incumbent',
    message: `${tag}: the native commit holds the edit`,
  });
  const left = await leftovers(fixture);
  matrix.check({
    condition: left.length === 0,
    message: `${tag}: nothing is left behind (${left.join(', ') || 'none'})`,
  });
}

{
  const tag = 'hook-lock-dead';
  const fixture = await restoreFixture('hook-lock-dead');
  const lock = join(
    fixture.repository,
    '.git/cli-git/hook.lock/owner.json',
  );
  matrix.check({
    condition: (await stat(lock)).size > 0,
    message: `${tag}: the stored incumbent hook lock record is present`,
  });
  const log = join(
    fixture.root,
    'hook.log',
  );
  const startsBefore = (await readFile(
    log,
    'utf8',
  )).split('\n').filter(Boolean).length;
  const commit = await runThrough({
    wrapper: 'native',
    fixture,
    args: [
      'commit',
      '--quiet',
      '--message=native over the dead hook lock',
      '--',
      'a.txt',
    ],
  });
  matrix.check({
    condition: commit.status === 0,
    message: `${tag}: a native commit retired the dead lock and landed (status ${String(commit.status)}; ${commit.stderr.trim().slice(0, 400)})`,
  });
  const lines = (await readFile(
    log,
    'utf8',
  )).split('\n').filter(Boolean);
  matrix.check({
    condition: lines.slice(startsBefore).join(',') === 'start,end',
    message: `${tag}: the hook ran once to the end (${lines.slice(startsBefore).join(',')})`,
  });
  const left = await leftovers(fixture);
  matrix.check({
    condition: left.length === 0,
    message: `${tag}: nothing is left behind (${left.join(', ') || 'none'})`,
  });
}

matrix.finish();
console.log('old-format-fixtures passed');
