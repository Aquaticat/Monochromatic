/**
 Run the native side of the dependent-version differential harness: the ignored corpus test of the crate, in place or
 in a disposable copy with one planted defect.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  cp,
  mkdtempDisposable,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { HarnessError } from './dependent-version-incumbent-reader.mjs';
import { plants } from './dependent-version-probes.mjs';

/** Repository-relative inputs a disposable copy of the crate needs. */
const crateInputs = [
  'package/git-policy/cli/Cargo.toml',
  'package/git-policy/cli/Cargo.lock',
  'package/git-policy/cli/README.md',
  'package/git-policy/cli/src/native',
  'package/rust-module/jsonc-edit',
];
/** The crate, relative to a repository root. */
const crateDirectory = 'package/git-policy/cli';

/**
 Whether a copied path lies outside a build directory.

 @param {string} source - path being copied
 @returns {boolean} whether to copy it
 */
function outsideTarget(source) {
  return !source.includes('/target');
}

/**
 Copy the crate into a directory and plant one defect.

 @param {{ repositoryRoot: string, plant: string, directory: string }} request - worktree root, plant name and
   destination
 @returns {Promise<void>} resolves when the copy is planted
 */
async function plantInto({
  repositoryRoot,
  plant,
  directory
}) {
  const found = plants.find(function named(candidate) {
    return candidate.name === plant;
  });
  if (found === undefined)
    throw new HarnessError(`unknown plant ${plant}`);
  await Promise.all(crateInputs.map(function copyInput(entry) {
    return cp(
      join(
        repositoryRoot,
        entry
      ),
      join(
        directory,
        entry
      ),
      {
        recursive: true,
        filter: outsideTarget,
      },
    );
  }));
  const file = join(
    directory,
    crateDirectory,
    found.file
  );
  const original = await readFile(
    file,
    'utf8'
  );
  if (original.split(found.from)
    .length
    !== 2)
    throw new HarnessError(`plant ${plant} must match exactly once in ${found.file}`);
  await writeFile(
    file,
    original.replace(
      found.from,
      found.to
    )
  );
}

/**
 Run the ignored corpus test in a crate and read its results.

 @param {{ crate: string, corpus: string, targetDirectory: string | undefined, log: string }} request - crate
   directory, corpus directory, build directory override, and log file name
 @returns {Promise<string[]>} native results, one per case
 */
async function corpusTest({
  crate,
  corpus,
  targetDirectory,
  log
}) {
  const child = spawn(
    'cargo',
    [
      'test',
      '--locked',
      '--offline',
      '--lib',
      'dependent_version_differential_tests::corpus_from_environment',
      '--',
      '--include-ignored',
      '--exact'
    ],
    {
      cwd: crate,
      env: {
        ...process.env,
        DEPENDENT_VERSION_CORPUS: corpus,
        ...(targetDirectory === undefined ? {} : { CARGO_TARGET_DIR: targetDirectory }),
      },
      stdio: [
        'ignore',
        'pipe',
        'pipe',
      ],
    },
  );
  /** @type {Buffer[]} */
  const output = [];
  child.stdout
    .on(
      'data',
      function collect(/** @type {Buffer} */ chunk) {
    output.push(chunk);
  }
    );
  child.stderr
    .on(
      'data',
      function collect(/** @type {Buffer} */ chunk) {
    output.push(chunk);
  }
    );
  await once(
    child,
    'close',
  );
  const code = child.exitCode;
  await writeFile(
    join(
      corpus,
      log
    ),
    Buffer.concat(output)
  );
  if (code !== 0)
    throw new HarnessError(`native corpus test exited ${String(code)}; see ${join(
      corpus,
      log
    )}`);
  return (await readFile(
    join(
      corpus,
      'rust-results.jsonl'
    ),
    'utf8'
  ))
    .trimEnd()
    .split('\n');
}

/**
 Run the native corpus test over a corpus directory, in place or in a planted copy, and read its results.

 @param {{ repositoryRoot: string, corpus: string, plant: string | undefined }} request - worktree root, corpus
   directory and planted defect
 @returns {Promise<string[]>} native results, one per case
 */
export async function nativeResults({
  repositoryRoot,
  corpus,
  plant
}) {
  if (plant === undefined)
    return corpusTest({
      crate: join(
        repositoryRoot,
        crateDirectory
      ),
      corpus,
      targetDirectory: undefined,
      log: 'native-test.log',
    });
  await using disposable = await mkdtempDisposable(join(
    tmpdir(),
    'dependent-version-plant-'
  ));
  await plantInto({
    repositoryRoot,
    plant,
    directory: disposable.path,
  });
  // Awaited here, so the copy is disposed of only after the test finished with it.
  const results = await corpusTest({
    crate: join(
      disposable.path,
      crateDirectory
    ),
    corpus,
    targetDirectory: join(
      disposable.path,
      'target'
    ),
    log: `native-test-${plant}.log`,
  });
  return results;
}
