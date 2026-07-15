#!/usr/bin/env node
/**
 * Independent final-newline workflow fixture using only typed Node orchestration.
 *
 * @module
 */

import {
  mkdtempDisposable,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { findGitRepoRoot, } from '@monochromatic-dev/module-fs-path/ts';
import nanoSpawn from 'nano-spawn';

//region Isolated workflow fixture -- Clone, verify discovery, trust core config, and run direct check.

/**
 * Checked-out repository that supplies cli-git source without loading root task configuration.
 */
const workspace = process.cwd();
/**
 * Disposable parent prevents policy checks from observing or changing checkout state.
 */
await using tempDirectory = await mkdtempDisposable(join(
  tmpdir(),
  'cli-git-final-newline-',
),);
/**
 * Isolated clone used as direct-check target.
 */
const scanRoot = join(
  tempDirectory.path,
  'repository',
);

await nanoSpawn(
  '/usr/bin/git',
  [
    'clone',
    '--local',
    '--no-hardlinks',
    workspace,
    scanRoot,
  ],
  { cwd: tempDirectory.path, },
);
await writeFile(
  join(
    scanRoot,
    'cli-git.config.mjs',
  ),
  'export default {};\n',
  'utf8',
);

/**
 * Clone administrative directory required before policy execution.
 */
const gitDirectory = await stat(join(
  scanRoot,
  '.git',
),);
/**
 * Explicit core-only config required before trust enrollment.
 */
const configFile = await stat(join(
  scanRoot,
  'cli-git.config.mjs',
),);
if ((!gitDirectory.isDirectory()) || (!configFile.isFile()))
  throw new TypeError('Independent final-newline fixture is incomplete.',);

/**
 * Root returned through production repository discovery.
 */
const discoveredRoot = await findGitRepoRoot({ cwd: scanRoot, },);
if (discoveredRoot !== scanRoot)
  throw new TypeError(`Cli-git repository discovery mismatch: ${discoveredRoot}`,);

/**
 * Source entry invoked directly so retired hk behavior and root mise tasks remain outside this workflow.
 */
const cliEntry = join(
  workspace,
  'packages/git-policy/cli/src/index.ts',
);
await nanoSpawn(
  process.execPath,
  [
    cliEntry,
    'cli-git',
    'trust',
    '--yes',
  ],
  { cwd: scanRoot, },
);
await nanoSpawn(
  process.execPath,
  [
    cliEntry,
    'cli-git',
    'check',
    '--policy',
    'final-newline',
    '--all',
  ],
  { cwd: scanRoot, },
);

//endregion Isolated workflow fixture
