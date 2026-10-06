/**
 The real repository as differential input: every tracked path at `HEAD`, with bytes for every workspace manifest,
 the registry configuration and every file under a package's `src/`.

 Git is read through `/usr/bin/git` with read-only commands (`ls-tree`, `cat-file`), bypassing the wrapper,
 as the incumbent's worktree unit test does for its fixture repository.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import { spawn } from 'node:child_process';
import { once } from 'node:events';

import {
  HarnessError,
  toHex,
} from './dependent-version-incumbent-reader.mjs';

/** @typedef {import('./dependent-version-types.mjs').FixtureFile} FixtureFile */
/** @typedef {{ path: string, mode: string, oid: string }} TreeEntry */
/** @typedef {{ entries: TreeEntry[], bytes: Map<string, Buffer>, revision: string }} Snapshot */

/** Real Git, bypassing the policy wrapper on `PATH`. */
const realGit = '/usr/bin/git';
/** Git modes and the fixture mode names. */
const modes = new Map([
  [
    '100644',
    'regular'
  ],
  [
    '100755',
    'executable'
  ],
  [
    '120000',
    'symlink'
  ],
  [
    '160000',
    'submodule'
  ],
]);
/** The registry configuration path. */
export const configPath = 'package/config/pnpr/config.yaml';
/** Segments of a workspace manifest path. */
const manifestSegments = 4;

/**
 Whether a path is `package/<category>/<name>/package.json`.

 @param {string} path - repository path
 @returns {boolean} whether it is a workspace manifest
 */
export function isManifestPath(path) {
  const segments = path.split('/');
  return (segments.length === manifestSegments) && (segments[0] === 'package')
    && (segments[manifestSegments - 1] === 'package.json');
}

/**
 Whether the planner can read a path: a manifest, the configuration, or a file under a package's `src/`.

 @param {string} path - repository path
 @returns {boolean} whether its bytes are provided
 */
function isReadable(path) {
  const segments = path.split('/');
  return isManifestPath(path) || (path === configPath)
    || ((segments.length > manifestSegments) && (segments[0] === 'package')
      && (segments[manifestSegments - 1] === 'src'));
}

/**
 One `ls-tree` line as an entry.

 @param {string} line - `<mode> <type> <oid>\t<path>`
 @returns {TreeEntry} entry
 */
function treeEntry(line) {
  const tab = line.indexOf('\t');
  const [mode = '', , oid = ''] = line.slice(
    0,
    tab
  )
    .split(' ');
  return {
    path: line.slice(tab + 1),
    mode: modes.get(mode) ?? 'regular',
    oid,
  };
}

/**
 The standard output of a read-only Git command, with optional standard input.

 @param {{ root: string, args: readonly string[], input: string }} request - worktree root, arguments and input
 @returns {Promise<Buffer>} standard output
 */
async function gitOutput({
  root,
  args,
  input
}) {
  const child = spawn(
    realGit,
    args,
    {
      cwd: root,
      stdio: [
        'pipe',
        'pipe',
        'inherit',
      ],
    },
  );
  /** @type {Buffer[]} */
  const chunks = [];
  child.stdout
    .on(
    'data',
    function collect(/** @type {Buffer} */ chunk) {
      chunks.push(chunk);
    },
  );
  child.stdin
    .end(input);
  const [code] = await once(
    child,
    'close',
  );
  if (code !== 0)
    throw new HarnessError(`git ${args.join(' ')} exited ${String(code)}`);
  return Buffer.concat(chunks);
}

/**
 Tracked entries at `HEAD` and the bytes of those the planner can read.

 @param {string} root - worktree root
 @returns {Promise<Snapshot>} snapshot
 */
export async function repositorySnapshot(root) {
  const revision = (await gitOutput({
    root,
    args: [
      'rev-parse',
      'HEAD',
    ],
    input: '',
  }))
    .toString('utf8')
    .trim();
  const entries = (await gitOutput({
    root,
    args: [
      'ls-tree',
      '-r',
      '-z',
      '--full-tree',
      revision,
    ],
    input: '',
  }))
    .toString('utf8')
    .split('\0')
    .filter(function nonEmpty(line) {
      return line !== '';
    })
    .map(treeEntry);
  const needed = entries.filter(function isNeeded(entry) {
    return (entry.mode !== 'submodule') && isReadable(entry.path);
  });
  const batch = await gitOutput({
    root,
    args: [
      'cat-file',
      '--batch',
    ],
    input: `${needed.map(function oidOf(entry) {
      return entry.oid;
    })
      .join('\n')}\n`,
  });
  /** @type {Map<string, Buffer>} */
  const bytes = new Map();
  const cursor = { offset: 0 };
  for (const entry of needed) {
    const headerEnd = batch.indexOf(
      '\n',
      cursor.offset,
    );
    const [oid, , size] = batch.subarray(
      cursor.offset,
      headerEnd,
    )
      .toString('utf8')
      .split(' ');
    if (oid !== entry.oid)
      throw new HarnessError(`cat-file answered ${oid ?? 'nothing'} for ${entry.oid}`);
    const end = headerEnd + 1
      + Number(size);
    bytes.set(
      entry.path,
      Buffer.from(batch.subarray(
        headerEnd + 1,
        end,
      )),
    );
    cursor.offset = end + 1;
  }
  return {
    entries,
    bytes,
    revision,
  };
}

/**
 The shared workspace file: every tracked path, bytes where the planner can read them.

 @param {Snapshot} snapshot - repository snapshot
 @returns {FixtureFile[]} fixture files
 */
export function sharedWorkspace(snapshot) {
  return snapshot.entries
    .map(function toFile(entry) {
    const bytes = snapshot.bytes
      .get(entry.path);
    return {
      path: toHex(entry.path),
      mode: entry.mode,
      current: bytes === undefined ? null : toHex(bytes),
      base: bytes === undefined ? null : true,
    };
  });
}
