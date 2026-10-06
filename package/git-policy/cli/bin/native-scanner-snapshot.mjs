/**
 Snapshot inputs the native wrapper gained by linking the repository's scanner:
 the scanner crate, its matching engine, and the locked registry dependencies both pull in.

 The container has no network, so registry dependencies are vendored on the host from the Cargo cache
 and baked into the image beside the copied path crates.
 */
// The bin scripts sit outside the package tsconfig's include list, so type-aware lint checks them in an inferred
// program that loads no ambient Node types; this reference loads them, so `process` and `node:` imports stay typed
// in this file on its own instead of depending on a sibling module that carries the same reference.
/// <reference types="node" />
import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import {
  join,
  resolve,
} from 'node:path';

import {
  NativeVerificationError,
  runCommand,
} from './native-verification-process.mjs';

/** Image path of the vendored registry sources; the Containerfile copies `vendor` there. */
const imageVendorDirectory = '/work/vendor';

/**
 One file or directory to copy from the repository into the build context.

 @typedef {{ from: string, to: string }} SnapshotEntry
 */

/**
 Copy entries for one path crate, resolved from the wrapper package directory the gate runs in.

 @param {{ context: string, crate: string, names: readonly string[] }} request -
   build context, the crate's directory under `package`, and the entries a library build of it reads
 @returns {SnapshotEntry[]} one entry per name, keeping the repository layout so relative path dependencies resolve
 */
function crateEntries({
  context,
  crate,
  names,
}) {
  return names.map(function crateEntry(name) {
    return {
      from: resolve(
        '../..',
        crate,
        name,
      ),
      to: join(
        context,
        'package',
        crate,
        name,
      ),
    };
  });
}

/**
 Copy entries for the linked scanner and its matching engine.

 @param {{ context: string }} request - build context directory receiving the repository-shaped snapshot
 @returns {SnapshotEntry[]} entries for both path crates;
   the scanner's `build.rs` and `data` hold the embedded baseline its library compiles in
 */
export function scannerSnapshotEntries({ context }) {
  return [
    ...crateEntries({
      context,
      crate: 'cli/forbidden-strings',
      names: [
        'Cargo.toml',
        'Cargo.lock',
        'build.rs',
        'src',
        'data',
      ],
    }),
    ...crateEntries({
      context,
      crate: 'rust-module/forbidden-regex',
      names: [
        'Cargo.toml',
        'Cargo.lock',
        'src',
      ],
    }),
  ];
}

/**
 Vendor the copied wrapper's locked registry dependencies from the host's Cargo cache into the build context,
 and write the Cargo source mapping the image reads them through.
 Every archive the lockfile names must already be in that cache; Cargo fails the gate otherwise.

 @param {{ context: string }} request - build context holding the copied crates and receiving `vendor` and `cargo-config`
 */
export async function vendorLockedDependencies({ context }) {
  const vendor = join(
    context,
    'vendor',
  );
  const vendored = await runCommand({
    command: 'cargo',
    args: [
      'vendor',
      '--manifest-path',
      join(
        context,
        'package/git-policy/cli/Cargo.toml',
      ),
      '--offline',
      '--locked',
      '--versioned-dirs',
      vendor,
    ],
    capture: true,
  });
  // Cargo prints the mapping for the host path; the image holds the same directory elsewhere.
  const mapping = vendored.stdout
    .replaceAll(
      JSON.stringify(vendor),
      JSON.stringify(imageVendorDirectory),
    );
  if (!mapping.includes(`directory = ${JSON.stringify(imageVendorDirectory)}`))
    throw new NativeVerificationError('Cargo vendor did not provide the expected offline source mapping.');
  const configuration = join(
    context,
    'cargo-config',
  );
  await mkdir(
    configuration,
    { recursive: true },
  );
  await writeFile(
    join(
      configuration,
      'config.toml',
    ),
    mapping,
  );
}
