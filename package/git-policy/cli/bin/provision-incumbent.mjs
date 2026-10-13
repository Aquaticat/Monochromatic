#!/usr/bin/env node
/**
 Provision the retired TypeScript wrapper (the incumbent) from its pinned last revision, on demand.

 The incumbent no longer exists on `main`, so the interoperability matrix (`bin/interop-native-container.mjs`)
 cannot copy a build from the checkout.
 This script rebuilds it the way it was built and published before the retirement:
 a throwaway detached worktree of the pinned revision under the home directory's `temp/agent`,
 `pnpm install` of the package and its workspace dependencies from the lockfile,
 the package's own `pack:npm` mise task (the rolldown bundle `dist/final/node/index.mjs`, then `pnpm pack`),
 and `npm install --ignore-scripts` of that tarball into a staging directory, which is the layout the end-to-end
 image once carried at `/opt/cli-git` (`node_modules/.bin/git` is the incumbent, next to its installed dependencies).
 The worktree is removed afterwards, whether provisioning passed or failed.
 No TypeScript enters this repository: the result is a directory of built files under `target/verification/`.

 Usage: `node bin/provision-incumbent.mjs [--refresh]`.
 The result is cached per revision; `--refresh` rebuilds it.
 Standard output ends with the staging directory's absolute path on its own line.
 */
// The bin scripts sit outside the package tsconfig's include list, so type-aware lint checks them in an inferred
// program that loads no ambient Node types; this reference loads them, so `process` and `node:` imports stay typed
// in this file on its own instead of depending on a sibling module that carries the same reference.
/// <reference types="node" />
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  NativeVerificationError,
  runCommand,
} from './native-verification-process.mjs';

/** The last commit that contains the incumbent; the retirement removed it from the next commit on. */
export const PINNED_INCUMBENT_REVISION = 'f4fc1fa213ece65672e4314983a75266837892f9';
/** Real Git, never the wrapper this repository's `PATH` may start first. */
const realGit = '/usr/bin/git';
/** The package directory the incumbent lived in, relative to the repository root. */
const packagePath = 'package/git-policy/cli';

/**
 The directory a provisioned revision is cached in.

 @param {{ revision?: string }} request - revision to cache, the pinned one by default
 @returns {string} absolute directory below this package's ignored `target/verification`
 */
export function incumbentCacheDirectory({ revision = PINNED_INCUMBENT_REVISION } = {}) {
  return resolve(
    'target/verification',
    `incumbent-${revision}`,
  );
}

/**
 Hash one file's bytes.

 @param {string} path - file to hash
 @returns {Promise<string>} lowercase hexadecimal SHA-256
 */
async function sha256Of(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

/**
 Run a command, capture its output and return the trimmed standard output.

 @param {{ command: string, args: readonly string[], cwd?: string }} request - as for `runCommand`
 @returns {Promise<string>} trimmed standard output
 */
async function captureOutput(request) {
  const outcome = await runCommand({
    ...request,
    capture: true,
  });
  return outcome.stdout.trim();
}

/**
 Build the tarball in a throwaway worktree and install it into a staging directory.
 The worktree is removed in every case, with its administrative entry.

 @param {{ revision: string, staging: string }} request - revision to build and empty directory receiving the result
 @returns {Promise<{ tarballSha256: string, indexSha256: string, versions: Record<string, string> }>} evidence
 */
async function buildIncumbent({
  revision,
  staging,
}) {
  const parent = join(
    homedir(),
    'temp',
    'agent',
  );
  await mkdir(
    parent,
    {
      recursive: true,
      mode: 0o700,
    },
  );
  const worktree = await mkdtemp(join(
    parent,
    `incumbent-${revision.slice(
      0,
      12,
    )}-`,
  ));
  try {
    await runCommand({
      command: realGit,
      args: [
        'worktree',
        'add',
        '--detach',
        worktree,
        revision,
      ],
    });
    const cli = join(
      worktree,
      packagePath,
    );
    // The mise task graph of the pinned revision must not inherit the outer task's project selection.
    const env = Object.fromEntries(Object.entries(process.env)
      .filter(function keepOuterVariable([name]) {
        return !name.startsWith('MISE_') && !name.startsWith('usage_');
      }));
    await runCommand({
      command: 'pnpm',
      args: [
        'install',
        '--frozen-lockfile',
        '--prefer-offline',
        '--filter',
        '@monochromatic-dev/git-policy-cli...',
      ],
      cwd: worktree,
      env,
    });
    await runCommand({
      command: 'mise',
      args: [
        'run',
        `//${packagePath}:pack:npm`,
      ],
      cwd: worktree,
      env,
    });
    const packed = join(
      cli,
      'dist/pack',
    );
    const tarballs = (await readdir(packed))
      .filter(function isTarball(name) {
        return name.endsWith('.tgz');
      });
    if (tarballs.length !== 1)
      throw new NativeVerificationError(`Expected one tarball in ${packed}, found ${tarballs.join(', ') || 'none'}.`);
    const tarball = join(
      packed,
      String(tarballs[0]),
    );
    await runCommand({
      command: 'npm',
      args: [
        'init',
        '--yes',
      ],
      cwd: staging,
      capture: true,
    });
    await runCommand({
      command: 'npm',
      args: [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        tarball,
      ],
      cwd: staging,
    });
    const installedIndex = await realpath(join(
      staging,
      'node_modules/.bin/git',
    ));
    return {
      tarballSha256: await sha256Of(tarball),
      indexSha256: await sha256Of(installedIndex),
      versions: {
        node: process.version,
        pnpm: await captureOutput({
          command: 'pnpm',
          args: ['--version'],
        }),
        npm: await captureOutput({
          command: 'npm',
          args: ['--version'],
        }),
      },
    };
  }
  finally {
    await runCommand({
      command: realGit,
      args: [
        'worktree',
        'remove',
        '--force',
        worktree,
      ],
      allowFailure: true,
    });
    await rm(
      worktree,
      {
        recursive: true,
        force: true,
      },
    );
    await runCommand({
      command: realGit,
      args: [
        'worktree',
        'prune',
      ],
      allowFailure: true,
    });
  }
}

/**
 Provision the incumbent, reusing the cached result of an earlier run unless a refresh is asked for.

 @param {{ refresh?: boolean, revision?: string }} request - whether to rebuild, and the revision (pinned by default)
 @returns {Promise<{ staging: string, manifest: Record<string, unknown> }>} the directory to install as `/opt/cli-git`
   and the evidence recorded beside it
 */
export async function provisionIncumbent({
  refresh = false,
  revision = PINNED_INCUMBENT_REVISION,
} = {}) {
  const cache = incumbentCacheDirectory({ revision });
  const staging = join(
    cache,
    'opt-cli-git',
  );
  const manifestPath = join(
    cache,
    'manifest.json',
  );
  if (!refresh) {
    try {
      const manifest = JSON.parse(await readFile(
        manifestPath,
        'utf8',
      ));
      if (manifest.revision === revision) {
        await realpath(join(
          staging,
          'node_modules/.bin/git',
        ));
        console.log(`Reusing the incumbent provisioned from ${revision}.`);
        return {
          staging,
          manifest,
        };
      }
    }
    catch (error) {
      console.log(`No usable cached incumbent (${error instanceof Error ? error.message : String(error)}); building.`);
    }
  }
  await rm(
    cache,
    {
      recursive: true,
      force: true,
    },
  );
  const partial = `${cache}.partial`;
  await rm(
    partial,
    {
      recursive: true,
      force: true,
    },
  );
  await mkdir(
    join(
      partial,
      'opt-cli-git',
    ),
    { recursive: true },
  );
  const evidence = await buildIncumbent({
    revision,
    staging: join(
      partial,
      'opt-cli-git',
    ),
  });
  const manifest = {
    revision,
    ...evidence,
  };
  await writeFile(
    join(
      partial,
      'manifest.json',
    ),
    `${JSON.stringify(
      manifest,
      null,
      2,
    )}\n`,
  );
  await rename(
    partial,
    cache,
  );
  return {
    staging,
    manifest,
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { staging, manifest } = await provisionIncumbent({ refresh: process.argv.includes('--refresh') });
  console.log(JSON.stringify(
    manifest,
    null,
    2,
  ));
  console.log(staging);
}
