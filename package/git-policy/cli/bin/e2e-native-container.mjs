#!/usr/bin/env node
/**
 Run the concurrent-commit end-to-end suite (`e2e/`) against the native executable.

 Two subcommands, selected by the first argument:

 - `image` builds `localhost/cli-git-concurrent-e2e-native:<tag>` in two stages.
   The first compiles the release `cli-git-native` from a mount-free snapshot of this checkout in `rust:1.97-bookworm`,
   the Debian release of the end-to-end image, so the executable runs there without a glibc mismatch.
   The second starts from `localhost/cli-git-concurrent-e2e:latest` (Node at the engines floor, Git 2.39.5, 2.40.0 and
   2.55.0 under `/opt/git`, `ssh-keygen`) and links the executable as `/opt/native/bin/git`.
   That image has no `/usr/bin/git`, so the native wrapper can only find the scenario's Git through `PATH` order,
   exactly like the incumbent.
 - `run` starts the suite in that image with `E2E_WRAPPER=native` under the incumbent run's bounds
   (2 GiB, 2 CPUs, no network, `e2e/` mounted read-only).
   `usage_seed`, `usage_scenario` and `usage_git` (set by mise from `--seed`, `--scenario` and `--git`)
   select the seed, the scenario names and the Git versions.

 - `surface` runs `e2e/wrapper-surface-probe.ts` once with each wrapper in that image and prints, per command,
   whether the two wrappers agree on exit code, standard output and standard error.
   The probe sends the non-commit Git commands that the scenarios use (and a few the wrapper refuses) through the
   wrapper, so it shows differences on the surface that does not wait for the commit path.

 The base image comes from `mise run //package/git-policy/cli:test:e2e:concurrent:image`; this script never builds it,
 because it needs the packed incumbent and a network the suite does not use.
 */
// The bin scripts sit outside the package tsconfig's include list, so type-aware lint checks them in an inferred
// program that loads no ambient Node types; this reference loads them, so `process` and `node:` imports stay typed
// in this file on its own instead of depending on a sibling module that carries the same reference.
/// <reference types="node" />
import {
  cp,
  mkdtempDisposable,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';

import {
  scannerSnapshotEntries,
  vendorLockedDependencies,
} from './native-scanner-snapshot.mjs';
import {
  NativeVerificationError,
  runCommand,
} from './native-verification-process.mjs';

/** Concurrent worktrees set GIT_POLICY_NATIVE_IMAGE_TAG so one snapshot never runs another's image. */
const imageTag = process.env
  .GIT_POLICY_NATIVE_IMAGE_TAG
  ?? 'development';
/** Image this script builds and runs. */
const nativeImage = `localhost/cli-git-concurrent-e2e-native:${imageTag}`;
/** Image holding the Git builds, Node, `ssh-keygen`, and the incumbent the native image deliberately does not use. */
const baseImage = 'localhost/cli-git-concurrent-e2e:latest';
/** Compiler image on the same Debian release (bookworm) as the base image's Node image. */
const compilerImage = 'docker.io/library/rust:1.97-bookworm';

/**
 Copy the native crate, its path dependencies and the scanner crates into the build context.
 Copies run concurrently, and every copy settles before this returns or throws.

 @param {{ context: string }} request - build context directory receiving the repository-shaped snapshot
 */
async function copySnapshot({ context }) {
  const subject = join(
    context,
    'package/git-policy/cli',
  );
  const dependency = join(
    context,
    'package/rust-module/jsonc-edit',
  );
  const entries = [
    ...[
      'Cargo.toml',
      'Cargo.lock',
      'README.md',
      'src/native',
    ].map(function crateEntry(name) {
      return {
        from: resolve(name),
        to: join(
          subject,
          name,
        ),
      };
    }),
    ...[
      'Cargo.toml',
      'Cargo.lock',
      'src',
      'fixtures',
    ].map(function dependencyEntry(name) {
      return {
        from: resolve(
          '../../rust-module/jsonc-edit',
          name,
        ),
        to: join(
          dependency,
          name,
        ),
      };
    }),
    ...scannerSnapshotEntries({ context }),
  ];
  const copies = await Promise.allSettled(entries.map(function copyEntry(entry) {
    return cp(
      entry.from,
      entry.to,
      { recursive: true },
    );
  }));
  const failures = copies.filter(function isRejected(copy) {
    return copy.status === 'rejected';
  });
  if (failures.length > 0)
    throw new NativeVerificationError(
      `Copying ${String(failures.length)} snapshot entries into ${context} failed.`,
      { cause: failures },
    );
}

/** Build the two-stage image: compile the release executable, then link it as `git` into the end-to-end image. */
async function buildImage() {
  const base = await runCommand({
    command: 'podman',
    args: [
      'image',
      'exists',
      baseImage,
    ],
    allowFailure: true,
    capture: true,
  });
  if (base.status !== 0)
    throw new NativeVerificationError(
      `${baseImage} does not exist. Build it first: mise run //package/git-policy/cli:test:e2e:concurrent:image`,
    );
  await using context = await mkdtempDisposable(join(
    tmpdir(),
    'cli-git-e2e-native-',
  ));
  await copySnapshot({ context: context.path });
  await vendorLockedDependencies({ context: context.path });
  await writeFile(
    join(
      context.path,
      'Containerfile',
    ),
    [
      `FROM ${compilerImage} AS compile`,
      'COPY package /work/package',
      'COPY vendor /work/vendor',
      'COPY cargo-config /work/.cargo',
      'ENV CARGO_NET_OFFLINE=true CARGO_BUILD_JOBS=2 CARGO_INCREMENTAL=0',
      'WORKDIR /work/package/git-policy/cli',
      'RUN ["cargo", "build", "--offline", "--locked", "--release", "--bin", "cli-git-native"]',
      '',
      `FROM ${baseImage}`,
      'RUN ["mkdir", "--parents", "/opt/native/bin"]',
      // The artifact is named `cli-git-native` so it never shadows Git by accident; inside this disposable image it
      // becomes the `git` the scenarios find first on PATH.
      'COPY --from=compile /work/package/git-policy/cli/target/release/cli-git-native /opt/native/cli-git-native',
      'RUN ["ln", "--symbolic", "/opt/native/cli-git-native", "/opt/native/bin/git"]',
      '',
    ].join('\n'),
  );
  await runCommand({
    command: 'podman',
    args: [
      'build',
      '--network=none',
      '--http-proxy=false',
      '--pull=never',
      '--memory=2g',
      '--cpu-period=100000',
      '--cpu-quota=200000',
      '--tag',
      nativeImage,
      context.path,
    ],
  });
  console.log(`built ${nativeImage}`);
}

/** Run the suite in the native image under the incumbent run's bounds. */
async function runSuite() {
  await runCommand({
    command: 'podman',
    args: [
      'run',
      '--memory=2g',
      '--cpus=2',
      '--rm',
      '--network=none',
      '--env',
      'E2E_WRAPPER=native',
      '--env',
      `E2E_SEED=${process.env
        .usage_seed
        ?? ''}`,
      '--env',
      `E2E_SCENARIOS=${process.env
        .usage_scenario
        ?? ''}`,
      '--env',
      `E2E_GIT_VERSIONS=${process.env
        .usage_git
        ?? ''}`,
      '--volume',
      `${resolve('e2e')}:/fixture/e2e:ro,Z`,
      '--volume',
      `${resolve('../../module/caught-value')}:/fixture/caught-value:ro,Z`,
      nativeImage,
      'node',
      '/fixture/e2e/concurrent-e2e-consumer.ts',
    ],
  });
}

/**
 Run the surface probe in the native image with one wrapper.

 @param {{ wrapper: 'incumbent' | 'native' }} request - wrapper whose `git` the probe drives
 @returns {Promise<string[]>} the probe's result lines, one per command in order,
   each a label, a tab, the exit code, a tab, and the arguments and masked output as JSON
 */
async function runProbe({ wrapper }) {
  const outcome = await runCommand({
    command: 'podman',
    args: [
      'run',
      '--memory=2g',
      '--cpus=2',
      '--rm',
      '--network=none',
      '--env',
      `E2E_WRAPPER=${wrapper}`,
      '--volume',
      `${resolve('e2e')}:/fixture/e2e:ro,Z`,
      '--volume',
      `${resolve('../../module/caught-value')}:/fixture/caught-value:ro,Z`,
      nativeImage,
      'node',
      '/fixture/e2e/wrapper-surface-probe.ts',
    ],
    capture: true,
  });
  return outcome.stdout
    .split('\n')
    .filter(function isResult(line) {
      return line.includes('\t');
    });
}

/** Run the probe with both wrappers, print the comparison, and fail when any command differs. */
async function compareSurface() {
  // Sequential on purpose: both runs relabel the same `e2e/` mount privately (`:Z`), which concurrent containers
  // would contest.
  const incumbent = await runProbe({ wrapper: 'incumbent' });
  const native = await runProbe({ wrapper: 'native' });
  if ((incumbent.length === 0) || (incumbent.length !== native.length))
    throw new NativeVerificationError(
      `The probe produced ${String(incumbent.length)} incumbent and ${String(native.length)} native results.`,
    );
  const differing = incumbent.flatMap(function compare(
    left,
    index
  ) {
    const right = native[index] ?? '';
    const [label, exitCode] = left.split('\t');
    console.log(`${left === right ? 'SAME' : 'DIFF'} ${label} (incumbent exit ${exitCode})`);
    if (left !== right) {
      console.log(`  incumbent: ${left}`);
      console.log(`  native:    ${right}`);
    }
    return left === right ? [] : [label ?? ''];
  });
  console.log(`${String(incumbent.length - differing.length)} of ${String(incumbent.length)} commands agree`);
  if (differing.length > 0)
    throw new NativeVerificationError(`The wrappers differ on: ${differing.join(', ')}`);
}

/** Dispatch on the subcommand. */
async function main() {
  const [subcommand, ...extra] = process.argv
    .slice(2);
  const actions = {
    image: buildImage,
    run: runSuite,
    surface: compareSurface,
  };
  const action = Object.entries(actions)
    .find(function named([name]) {
      return name === subcommand;
    })?.[1];
  if ((extra.length > 0) || (action === undefined))
    throw new NativeVerificationError('Usage: node bin/e2e-native-container.mjs image|run|surface');
  await action();
}

await main();
