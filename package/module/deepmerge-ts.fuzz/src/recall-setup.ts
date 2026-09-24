/**
 Host-side inputs for the historical-recall run
 (`doc/audit/deepmerge-ts-recall-2026-09-24.md`), written under
 `~/temp/agent` so nothing lands in this repo:

 - `deepmerge-ts-recall-npm/<version>/package`: every stable npm release,
   plus `deps/is-plain-object/package` for the 1.x releases that need it.
 - `deepmerge-ts-recall-trees/<name>/`: upstream `src`, `tests`, and configs
   at v8.0.2 and at each `parent` row's buggy and fixed commits.

 Takes the path of a full-history upstream clone whose push URL is disabled.
 Light work (tarball downloads and `git archive`), so it runs on the host.

 @module
 */

import { execFileSync, } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { homedir, } from 'node:os';
import { join, } from 'node:path';

import { RUNTIME_BUGS, } from './recall-ledger-runtime.ts';

/**
 Scratch root for agent work outside the repo.
 */
const SCRATCH = join(
  homedir(),
  'temp',
  'agent',
);

/**
 Download and extract one npm package version into `dir`.

 @param spec - npm spec, such as `deepmerge-ts@7.1.6`.

 @param dir - Destination; the tarball extracts to `dir/package`.

 @example
 ```ts
 fetchPackage({ dir: '/tmp/x', spec: 'deepmerge-ts@8.0.2', });
 ```
 */
function fetchPackage(
  {
    spec,
    dir,
  }: {
    readonly spec: string;
    readonly dir: string;
  },
): void {
  if (existsSync(join(
    dir,
    'package',
    'package.json',
  ),))
    return;
  mkdirSync(
    dir,
    { recursive: true, },
  );
  execFileSync(
    'npm',
    [
      'pack',
      spec,
      '--pack-destination',
      dir,
      '--silent',
    ],
    { stdio: 'ignore', },
  );
  /**
   Downloaded tarball name.
   */
  const tarball = readdirSync(dir,)
    .find(function isTarball(name,) {
      return name.endsWith('.tgz',);
    },);
  if (tarball === undefined)
    throw new Error(`npm pack ${spec} wrote no tarball`,);
  execFileSync(
    'tar',
    [
      '--extract',
      '--gzip',
      '--file',
      join(
        dir,
        tarball,
      ),
      '--directory',
      dir,
    ],
  );
}

if (import.meta.main) {
  /**
   Full-history upstream clone.
   */
  const [clone,] = process.argv.slice(2,);
  if ((clone === undefined) || (clone === ''))
    throw new Error('usage: recall-setup.ts <full-history deepmerge-ts clone>',);
  /**
   Release directory.
   */
  const npmRoot = join(
    SCRATCH,
    'deepmerge-ts-recall-npm',
  );
  /**
   Every published version.
   */
  const versions: unknown = JSON.parse(execFileSync(
    'npm',
    [
      'view',
      'deepmerge-ts',
      'versions',
      '--json',
    ],
    { encoding: 'utf8', },
  ),);
  if (!Array.isArray(versions,))
    throw new Error('npm view returned no version list',);
  for (const version of versions.map(String,)
    .filter(function isStable(entry,) {
      return !entry.includes('-',);
    },)) {
    fetchPackage({
      dir: join(
        npmRoot,
        version,
      ),
      spec: `deepmerge-ts@${version}`,
    },);
  }
  fetchPackage({
    dir: join(
      npmRoot,
      'deps',
      'is-plain-object',
    ),
    spec: 'is-plain-object@5',
  },);
  /**
   Tree name to revision: v8.0.2 plus both sides of every `parent` row.
   */
  const trees = new Map<string, string>([[
    'v8.0.2',
    'v8.0.2',
  ],],);
  for (const bug of RUNTIME_BUGS) {
    if (bug.source.kind === 'parent') {
      trees.set(
        bug.source.buggyTree,
        `${bug.commit}^`,
      );
      trees.set(
        bug.source.fixedTree,
        bug.commit,
      );
    }
  }
  for (const [name, revision,] of trees) {
    /**
     Tree directory.
     */
    const dir = join(
      SCRATCH,
      'deepmerge-ts-recall-trees',
      name,
    );
    rmSync(
      dir,
      {
        force: true,
        recursive: true,
      },
    );
    mkdirSync(
      dir,
      { recursive: true, },
    );
    execFileSync(
      'tar',
      [
        '--extract',
        '--directory',
        dir,
      ],
      {
        input: execFileSync(
          'git',
          [
            '-C',
            clone,
            'archive',
            '--format=tar',
            revision,
            'src',
            'tests',
            'tsconfig.json',
            'vitest.config.ts',
          ],
        ),
      },
    );
    console.log(`${name} <- ${revision}`,);
  }
}
