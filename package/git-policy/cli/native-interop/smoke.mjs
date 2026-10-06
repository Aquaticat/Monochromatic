/**
 Proves the interoperability image holds what every other driver relies on:
 Node,
 Git 2.56.0,
 an incumbent wrapper that commits,
 and a native wrapper started through `PATH`.
 */
/// <reference types="node" />
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  INCUMBENT_BIN,
  NATIVE_BIN,
  REAL_GIT,
  createRepository,
  expect,
  runEnvironment,
  runOk,
} from './support.mjs';

const fixture = await createRepository({ name: 'smoke' });
const realVersion = await runOk({
  command: REAL_GIT,
  args: ['--version'],
  cwd: fixture.repository,
  env: runEnvironment({ home: fixture.home }),
});
expect({
  condition: realVersion.trim() === 'git version 2.56.0',
  message: `real Git is 2.56.0 (${realVersion.trim()})`,
});
expect({
  condition: process.version.startsWith('v24.'),
  message: `Node is a 24 release (${process.version})`,
});
await writeFile(
  join(
    fixture.repository,
    'a.txt',
  ),
  'second\n',
);
const incumbentEnvironment = runEnvironment({
  home: fixture.home,
  wrapperBin: INCUMBENT_BIN,
});
await runOk({
  command: 'git',
  args: [
    'commit',
    '--quiet',
    '--message=through the incumbent',
    '--',
    'a.txt',
  ],
  cwd: fixture.repository,
  env: incumbentEnvironment,
});
const subject = await runOk({
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
  condition: subject.trim() === 'through the incumbent',
  message: 'the incumbent landed a commit',
});
const nativeVersion = await runOk({
  command: 'git',
  args: ['--version'],
  cwd: fixture.repository,
  env: runEnvironment({
    home: fixture.home,
    wrapperBin: NATIVE_BIN,
  }),
});
expect({
  condition: nativeVersion.includes('git version 2.56.0'),
  message: `the native wrapper forwards --version to real Git (${nativeVersion.trim()})`,
});
