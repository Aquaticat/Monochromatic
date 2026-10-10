/**
 Records the committed tree the incumbent wrapper produces for each commit selection mode,
 so the native private index of the same invocation can be compared with it.

 Each scenario starts from the same two committed files, changes both,
 adds one untracked file, applies the scenario's staging, and runs the incumbent's `git commit`.
 Tree identifiers depend only on paths, modes and blob contents, so they are stable across runs.
 The driver prints one `scenario <name> <tree>` line per scenario and a `committed` line of the paths.
 */
/// <reference types="node" />
import { writeFile } from 'node:fs/promises';
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
  { name: 'index-plain', stage: ['a.txt'], args: ['commit', '--quiet', '-m', 'index'] },
  { name: 'tracked-all', stage: [], args: ['commit', '--quiet', '-a', '-m', 'tracked'] },
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
