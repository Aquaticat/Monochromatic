#!/usr/bin/env node
/**
 Run one native-interoperability driver in a bounded container that holds both wrappers.

 The native gate image has Git 2.56.0 and no Node; the host has Node and an older Git.
 Every proof that compares the native wrapper with the incumbent TypeScript wrapper,
 or runs both against one repository, therefore runs here:
 the gate's Git 2.56.0 base,
 the Node executable of the same Debian release,
 the incumbent build that `node_modules/.bin/git` of the main checkout starts,
 with the dependency closure of the packed incumbent in the end-to-end image,
 and the native executable built in release mode from this snapshot.

 Usage: `node bin/interop-native-container.mjs <driver> [arguments...]`,
 where `<driver>` names a file under `native-interop/` without its `.mjs` suffix.
 */
// The bin scripts sit outside the package tsconfig's include list, so type-aware lint checks them in an inferred
// program that loads no ambient Node types; this reference loads them, so `process` and `node:` imports stay typed
// in this file on its own instead of depending on a sibling module that carries the same reference.
/// <reference types="node" />
import { createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  mkdtempDisposable,
  readFile,
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
/** Image this runner builds and runs. */
const interopImage = `localhost/git-policy-native-interop:${imageTag}`;
/** The audited Git 2.56.0 image the native gate also builds on. */
const gitBase = '6ec87f6d290a2f59bda5b3ffd4197058fe0749d02b4978c877e8edf6dc38802a';
/** Node of the gate base's Debian release (trixie), copied as one executable. */
const nodeImage = 'docker.io/library/node:24-trixie-slim';
/** The end-to-end image whose `/opt/cli-git` holds the packed incumbent and its installed dependencies. */
const incumbentImage = 'localhost/cli-git-concurrent-e2e:latest';
/**
 The incumbent build the installed `git` of the main checkout runs.
 A linked worktree has no build of its own, so it is read from the main worktree,
 the parent of the common Git directory; its hash is recorded with the evidence.
 Real Git answers the question: inside this worktree `git` on the task's `PATH` is the worktree's own
 unbuilt incumbent shim.

 @returns {Promise<string>} absolute path of the incumbent's built executable module
 */
async function incumbentBuildPath() {
  const common = await runCommand({
    command: '/usr/bin/git',
    args: [
      'rev-parse',
      '--path-format=absolute',
      '--git-common-dir',
    ],
    capture: true,
  });
  return resolve(
    common.stdout.trim(),
    '..',
    'package/git-policy/cli/dist/final/node/index.mjs',
  );
}

/**
 Copy the native crate, its path dependencies and the interoperability drivers into the build context.
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
    {
      from: resolve('../../../clippy.toml'),
      to: join(
        context,
        'clippy.toml',
      ),
    },
    {
      from: resolve('native-interop'),
      to: join(
        context,
        'native-interop',
      ),
    },
    {
      from: await incumbentBuildPath(),
      to: join(
        context,
        'incumbent-index.mjs',
      ),
    },
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

/** Build the image once per call, then run the named driver in it under the gate's bounds without a PID cap. */
async function main() {
  const [driver, ...driverArguments] = process.argv.slice(2);
  if (driver === undefined || !/^[a-z0-9-]+$/u.test(driver))
    throw new NativeVerificationError('Name one driver under native-interop/ in lowercase words and dashes.');
  await using context = await mkdtempDisposable(join(
    tmpdir(),
    'cli-git-native-interop-',
  ));
  const evidenceRoot = resolve('target/verification');
  await mkdir(
    evidenceRoot,
    { recursive: true },
  );
  const evidence = await mkdtemp(join(
    evidenceRoot,
    'interop-',
  ));
  await copySnapshot({ context: context.path });
  await vendorLockedDependencies({ context: context.path });
  const incumbentSha256 = createHash('sha256')
    .update(await readFile(join(
      context.path,
      'incumbent-index.mjs',
    )))
    .digest('hex');
  await writeFile(
    join(
      context.path,
      'Containerfile',
    ),
    [
      `FROM ${gitBase}`,
      'COPY package /work/package',
      'COPY --chown=1000:1000 vendor /work/vendor',
      'COPY --chown=1000:1000 cargo-config /work/.cargo',
      'COPY clippy.toml /work/clippy.toml',
      'RUN ["mkdir", "--parents", "/home/tester/.cargo", "/work/scratch"]',
      'RUN ["chown", "--recursive", "1000:1000", "/work/package", "/work/scratch", "/home/tester"]',
      'ENV HOME=/home/tester CARGO_HOME=/home/tester/.cargo CARGO_NET_OFFLINE=true CARGO_BUILD_JOBS=2 CARGO_INCREMENTAL=0',
      `COPY --from=${nodeImage} /usr/local/bin/node /usr/local/bin/node`,
      `COPY --from=${incumbentImage} /opt/cli-git /opt/cli-git`,
      'COPY incumbent-index.mjs /opt/cli-git/node_modules/@monochromatic-dev/git-policy-cli/dist/final/node/index.mjs',
      'COPY native-interop /fixture/native-interop',
      'USER 1000:1000',
      'WORKDIR /work/package/git-policy/cli',
      // The release executable, and the library's ignored probes, which a driver runs with
      // `cargo test --release --lib -- --ignored <name>` to compute a native answer for a fact the incumbent reports.
      'RUN ["cargo", "build", "--offline", "--locked", "--release", "--bin", "cli-git-native"]',
      'RUN ["cargo", "test", "--offline", "--locked", "--release", "--lib", "--no-run"]',
      'USER 0:0',
      'RUN ["mkdir", "--parents", "/opt/native/bin"]',
      // The native executable gets its `git` name only inside this disposable image, never on the host.
      'RUN ["ln", "--symbolic", "/work/package/git-policy/cli/target/release/cli-git-native", "/opt/native/bin/git"]',
      'USER 1000:1000',
      'WORKDIR /work/scratch',
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
      interopImage,
      context.path,
    ],
  });
  const inspected = await runCommand({
    command: 'podman',
    args: [
      'image',
      'inspect',
      interopImage,
      '--format',
      '{{.Id}}',
    ],
    capture: true,
  });
  const image = inspected.stdout
    .trim();
  const limits = [
    '--rm',
    '--init',
    '--network=none',
    '--memory=2g',
    '--cpus=2',
  ];
  await writeFile(
    join(
      evidence,
      'manifest.json',
    ),
    `${JSON.stringify(
      {
        gitBase,
        nodeImage,
        incumbentImage,
        incumbentSha256,
        image,
        limits,
        driver,
        driverArguments,
        user: '1000:1000',
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Native interoperability evidence: ${evidence}`);
  const run = await runCommand({
    command: 'podman',
    args: [
      'run',
      ...limits,
      image,
      'node',
      `/fixture/native-interop/${driver}.mjs`,
      ...driverArguments,
    ],
    capture: true,
    allowFailure: true,
  });
  await writeFile(
    join(
      evidence,
      'stdout.txt',
    ),
    run.stdout,
  );
  await writeFile(
    join(
      evidence,
      'stderr.txt',
    ),
    run.stderr,
  );
  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr);
  if (run.status !== 0)
    throw new NativeVerificationError(`Driver ${driver} exited with ${String(run.status)} (signal ${String(run.signal)}).`);
}

await main();
