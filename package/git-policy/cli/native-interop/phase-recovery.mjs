/**
 Native recovery of transactions the incumbent left when it was killed at each phase marker.

 For every phase from `capture-locked` to `index-installed`, the incumbent commits `a.txt` and
 kills itself at the phase (`CLI_GIT_TEST_ONLY_PHASE_SIGNAL=<phase>:kill:<markers>`). The native
 wrapper then runs `git status`. Afterwards the commit landed whole (after `ref-updated`) or not
 at all (before it), the real index equals `HEAD`, the worktree keeps the edit, and no
 transaction directory, shadow repository, `index.lock`, `.keep` or landed-capture record is
 left. The incumbent then lands a follow-up commit in the same repository.
 */
/// <reference types="node" />
import {
  readdir,
  readFile,
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import {
  INCUMBENT_BIN,
  NATIVE_BIN,
  REAL_GIT,
  createRepository,
  expect,
  run,
  runEnvironment,
  runOk,
} from './support.mjs';

/** Phases in transaction order, with whether the commit has landed when the incumbent dies there. */
const PHASES = [
  ['capture-locked', false],
  ['preparation-done', false],
  ['landing-locked', false],
  ['objects-migrated', false],
  ['ref-updated', true],
  ['index-installed', true],
];

/**
 Entry names of a directory, or none when it does not exist.

 @param {string} directory - directory to list
 @returns {Promise<string[]>} entry names
 */
async function namesIn(directory) {
  try {
    return await readdir(directory);
  }
  catch (error) {
    if ((error instanceof Error) && ('code' in error) && (error.code === 'ENOENT'))
      return [];
    throw error;
  }
}

/**
 Run real Git in the repository and return its trimmed output.

 @param {{ repository: string, home: string }} fixture - repository and home
 @param {string[]} args - Git arguments
 @returns {Promise<string>} trimmed standard output
 */
async function realGit(fixture, args) {
  return (await runOk({
    command: REAL_GIT,
    args,
    cwd: fixture.repository,
    env: runEnvironment({ home: fixture.home }),
  })).trim();
}

for (const [phase, landed] of PHASES) {
  const fixture = await createRepository({ name: `phase-${phase}` });
  const markers = join(fixture.root, 'markers');
  await mkdir(markers, { recursive: true });
  const before = await realGit(fixture, ['rev-parse', 'HEAD']);
  await writeFile(join(fixture.repository, 'a.txt'), 'second\n');
  const killed = await run({
    command: 'git',
    args: ['commit', '--quiet', `--message=change at ${phase}`, '--', 'a.txt'],
    cwd: fixture.repository,
    env: runEnvironment({
      home: fixture.home,
      wrapperBin: INCUMBENT_BIN,
      extra: { CLI_GIT_TEST_ONLY_PHASE_SIGNAL: `${phase}:kill:${markers}` },
    }),
  });
  expect({
    condition: (killed.signal === 'SIGKILL') || (killed.status === 137),
    message: `${phase}: the incumbent killed itself (status ${String(killed.status)}, signal ${String(killed.signal)})`,
  });
  expect({
    condition: (await namesIn(markers)).includes(`${phase}.reached`),
    message: `${phase}: the marker was reached`,
  });
  const gitDir = join(fixture.repository, '.git');
  const registry = join(gitDir, 'cli-git-transactions');
  const left = (await namesIn(registry)).filter(function isTransaction(name) {
    return !name.endsWith('.lock');
  });
  expect({
    condition: left.length === 1,
    message: `${phase}: the dead incumbent left one transaction directory (${left.join(', ')})`,
  });
  const status = await run({
    command: 'git',
    args: ['status', '--porcelain'],
    cwd: fixture.repository,
    env: runEnvironment({ home: fixture.home, wrapperBin: NATIVE_BIN }),
  });
  expect({
    condition: status.status === 0,
    message: `${phase}: native git status recovered and ran (${status.stderr.trim()})`,
  });
  const after = await realGit(fixture, ['rev-parse', 'HEAD']);
  const subject = await realGit(fixture, ['log', '-1', '--format=%s']);
  if (landed) {
    expect({
      condition: (after !== before) && (subject === `change at ${phase}`),
      message: `${phase}: the commit landed whole`,
    });
    expect({
      condition: (await realGit(fixture, ['show', 'HEAD:a.txt'])) === 'second',
      message: `${phase}: the landed commit holds the edit`,
    });
  }
  else {
    expect({
      condition: after === before,
      message: `${phase}: the commit did not land`,
    });
  }
  const cached = await run({
    command: REAL_GIT,
    args: ['diff', '--cached', '--quiet'],
    cwd: fixture.repository,
    env: runEnvironment({ home: fixture.home }),
  });
  expect({
    condition: cached.status === 0,
    message: `${phase}: the real index equals HEAD`,
  });
  expect({
    condition: (await readFile(join(fixture.repository, 'a.txt'), 'utf8')) === 'second\n',
    message: `${phase}: the worktree keeps the edit`,
  });
  expect({
    condition: (await namesIn(registry)).filter(function isTransaction(name) {
      return !name.endsWith('.lock');
    }).length === 0,
    message: `${phase}: no transaction directory is left`,
  });
  expect({
    condition: (await namesIn(join(gitDir, 'cli-git', 'shadow'))).length === 0,
    message: `${phase}: no shadow repository is left`,
  });
  expect({
    condition: !(await namesIn(gitDir)).includes('index.lock'),
    message: `${phase}: no index.lock is left`,
  });
  expect({
    condition: (await namesIn(join(gitDir, 'objects', 'pack'))).filter(function isKeep(name) {
      return name.endsWith('.keep');
    }).length === 0,
    message: `${phase}: no .keep is left`,
  });
  expect({
    condition: (await namesIn(join(gitDir, 'cli-git-captures', 'landed'))).length === 0,
    message: `${phase}: no landed-capture record is left`,
  });
  // The incumbent finds consistent state and lands the next commit.
  await writeFile(join(fixture.repository, 'b.txt'), 'follow-up\n');
  await runOk({
    command: REAL_GIT,
    args: ['add', '--', 'b.txt'],
    cwd: fixture.repository,
    env: runEnvironment({ home: fixture.home }),
  });
  await runOk({
    command: 'git',
    args: ['commit', '--quiet', '--message=follow-up', '--', 'b.txt'],
    cwd: fixture.repository,
    env: runEnvironment({ home: fixture.home, wrapperBin: INCUMBENT_BIN, extra: { MONOCHROMATIC_WARN: 'false' } }),
  });
  expect({
    condition: (await realGit(fixture, ['log', '-1', '--format=%s'])) === 'follow-up',
    message: `${phase}: the incumbent then landed a follow-up commit`,
  });
}
