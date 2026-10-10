/**
 Records the committed tree the incumbent wrapper produces for each commit selection mode,
 so the native private index of the same invocation can be compared with it.

 Each scenario starts from the same two committed files, changes both,
 adds one untracked file, applies the scenario's staging, and runs the incumbent's `git commit`.
 Tree identifiers depend only on paths, modes and blob contents, so they are stable across runs.
 The driver prints one `scenario <name> <tree>` line per scenario and a `committed` line of the paths.
 */
/// <reference types="node" />
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  INCUMBENT_BIN,
  REAL_GIT,
  createRepository,
  expect,
  runEnvironment,
  runOk,
} from './support.mjs';

/**
 Scenario table: staging before the commit, the command after `git`, and optional standard input.

 @typedef {{ name: string, stage: readonly string[], args: readonly string[], input?: string, list?: string }} Scenario
 */
/** @type {readonly Scenario[]} */
const scenarios = [
  { name: 'explicit-path', stage: [], args: ['commit', '--quiet', '-m', 'explicit', '--', 'a.txt'] },
  { name: 'index-plain', stage: ['a.txt'], args: ['commit', '--quiet', '--no-only', '-m', 'index'] },
  { name: 'tracked-all', stage: [], args: ['commit', '--quiet', '--no-only', '-a', '-m', 'tracked'] },
  { name: 'include', stage: ['a.txt'], args: ['commit', '--quiet', '-i', '-m', 'include', 'b.txt'] },
  { name: 'pathspec-file-newline', stage: [], args: ['commit', '--quiet', '-m', 'file', '--pathspec-from-file=LIST'], list: 'a.txt\n' },
  { name: 'pathspec-file-nul', stage: [], args: ['commit', '--quiet', '-m', 'nul', '--pathspec-from-file=LIST', '--pathspec-file-nul'], list: 'a.txt\0b.txt\0' },
  { name: 'pathspec-file-stdin', stage: [], args: ['commit', '--quiet', '-m', 'stdin', '--pathspec-from-file=-'], input: 'a.txt\n' },
];

const fixture = await createRepository({ name: 'capture-differential' });
const realEnvironment = runEnvironment({ home: fixture.home });
const incumbentEnvironment = runEnvironment({ home: fixture.home, wrapperBin: INCUMBENT_BIN });

for (const scenario of scenarios) {
  const directory = join(fixture.repository, `scenario-${scenario.name}`);
  await runOk({
    command: REAL_GIT,
    args: ['init', '--quiet', '--initial-branch=main', directory],
    cwd: fixture.home,
    env: realEnvironment,
  });
  await writeFile(join(directory, 'a.txt'), 'a\n');
  await writeFile(join(directory, 'b.txt'), 'b\n');
  await runOk({ command: REAL_GIT, args: ['add', 'a.txt', 'b.txt'], cwd: directory, env: realEnvironment });
  await runOk({ command: REAL_GIT, args: ['commit', '--quiet', '--message=base'], cwd: directory, env: realEnvironment });
  await writeFile(join(directory, 'a.txt'), 'a-changed\n');
  await writeFile(join(directory, 'b.txt'), 'b-changed\n');
  await writeFile(join(directory, 'u.txt'), 'u\n');
  if (scenario.stage.length > 0)
    await runOk({ command: REAL_GIT, args: ['add', ...scenario.stage], cwd: directory, env: realEnvironment });
  const listPath = join(fixture.home, `${scenario.name}.list`);
  if (scenario.list !== undefined)
    await writeFile(listPath, scenario.list);
  const args = scenario.args.map(function substitute(argument) {
    return argument === '--pathspec-from-file=LIST' ? `--pathspec-from-file=${listPath}` : argument;
  });
  await runOk({
    command: 'git',
    args,
    cwd: directory,
    env: incumbentEnvironment,
    ...(scenario.input === undefined ? {} : { input: scenario.input }),
  });
  const tree = (await runOk({
    command: REAL_GIT,
    args: ['rev-parse', 'HEAD^{tree}'],
    cwd: directory,
    env: realEnvironment,
  })).trim();
  const committed = (await runOk({
    command: REAL_GIT,
    args: ['diff-tree', '--no-commit-id', '--name-only', '-r', '--root', 'HEAD'],
    cwd: directory,
    env: realEnvironment,
  })).trim().split('\n').join(',');
  expect({
    condition: /^[0-9a-f]{40}$/u.test(tree),
    message: `${scenario.name} produced a tree`,
  });
  process.stdout.write(`scenario ${scenario.name} ${tree} committed=${committed}\n`);
}

// The hook view: the incumbent's pre-commit hook records what Git reports to a hook, for comparison with the shadow.
{
  const directory = join(fixture.repository, 'hook-view');
  await runOk({
    command: REAL_GIT,
    args: ['init', '--quiet', '--initial-branch=main', directory],
    cwd: fixture.home,
    env: realEnvironment,
  });
  await writeFile(join(directory, 'a.txt'), 'a\n');
  await runOk({ command: REAL_GIT, args: ['add', 'a.txt'], cwd: directory, env: realEnvironment });
  await runOk({ command: REAL_GIT, args: ['commit', '--quiet', '--message=base'], cwd: directory, env: realEnvironment });
  const head = (await runOk({ command: REAL_GIT, args: ['rev-parse', 'HEAD'], cwd: directory, env: realEnvironment })).trim();
  await runOk({ command: REAL_GIT, args: ['remote', 'add', 'origin', 'https://example.invalid/repo.git'], cwd: directory, env: realEnvironment });
  await runOk({ command: REAL_GIT, args: ['update-ref', 'refs/remotes/origin/main', head], cwd: directory, env: realEnvironment });
  await runOk({ command: REAL_GIT, args: ['config', 'branch.main.remote', 'origin'], cwd: directory, env: realEnvironment });
  await runOk({ command: REAL_GIT, args: ['config', 'branch.main.merge', 'refs/heads/main'], cwd: directory, env: realEnvironment });
  await writeFile(join(directory, '.git', 'branch.config'), '[x]\n\tv = onbranch\n');
  await runOk({ command: REAL_GIT, args: ['config', '--file', join(directory, '.git', 'config'), 'includeIf.onbranch:main.path', 'branch.config'], cwd: directory, env: realEnvironment });
  const recordPath = join(fixture.home, 'hook-view.txt');
  const hookScript = [
    '#!/bin/sh',
    `git rev-parse HEAD > ${recordPath}.head`,
    `git rev-parse --abbrev-ref '@{upstream}' > ${recordPath}.upstream`,
    `git config --get x.v > ${recordPath}.onbranch`,
    `git rev-parse --git-dir > ${recordPath}.gitdir`,
    '',
  ].join('\n');
  await writeFile(join(directory, '.git', 'hooks', 'pre-commit'), hookScript, { mode: 0o755 });
  await writeFile(join(directory, 'a.txt'), 'a-changed\n');
  await runOk({ command: REAL_GIT, args: ['add', 'a.txt'], cwd: directory, env: realEnvironment });
  await runOk({
    command: 'git',
    args: ['commit', '--quiet', '--no-only', '--message=hook view'],
    cwd: directory,
    env: incumbentEnvironment,
  });
  const read = async (suffix) => (await readFile(`${recordPath}.${suffix}`, 'utf8')).trim();
  const gitDir = (await read('gitdir')).replace(/cli-git\/shadow\/[0-9a-f-]+/u, 'cli-git/shadow/<transaction>');
  process.stdout.write(`hook head=${(await read('head')) === head ? 'base' : 'other'} upstream=${await read('upstream')} onbranch=${await read('onbranch')} gitdir=${gitDir}\n`);
}
