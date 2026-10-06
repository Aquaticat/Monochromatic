/**
 The real repository as differential input: every tracked path at `HEAD`, with bytes for every workspace manifest,
 the registry configuration and every file under a package's `src/`, and cases that raise one or several versions.

 Git is read through `/usr/bin/git` with read-only commands (`ls-tree`, `cat-file`), bypassing the wrapper,
 as the incumbent's worktree unit test does for its fixture repository.
 Samples are chosen from the actual dependency graph: leaf packages, the most depended-on packages,
 private packages, and packages reached only through bundled development imports.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import { execFileSync } from 'node:child_process';

import { HarnessError, toHex } from './dependent-version-incumbent.mjs';
import { seeded } from './dependent-version-generator.mjs';
import { importsPackage, isNonTestSourcePath } from '@monochromatic-dev/git-policy-repository/ts';

/** Real Git, bypassing the policy wrapper on `PATH`. */
const realGit = '/usr/bin/git';
/** Git modes and the fixture mode names. */
const modes = new Map([['100644', 'regular'], ['100755', 'executable'], ['120000', 'symlink'], ['160000', 'submodule']]);
/** Runtime dependency fields. */
const runtimeFields = ['dependencies', 'peerDependencies', 'optionalDependencies'];
/** Samples per category. */
const perCategory = 4;

/**
 Tracked entries at `HEAD` and the bytes of those the planner can read.

 @param {string} root - worktree root
 @returns {{ entries: { path: string, mode: string, oid: string }[], bytes: Map<string, Buffer>, revision: string }} snapshot
 */
export function repositorySnapshot(root) {
  const revision = execFileSync(realGit, ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const listing = execFileSync(realGit, ['ls-tree', '-r', '-z', '--full-tree', revision], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
  const entries = listing.toString('utf8').split('\0').filter(line => line !== '').map(line => {
    const [meta, path] = line.split('\t');
    const [mode, , oid] = meta.split(' ');
    return { path, mode: modes.get(mode) ?? 'regular', oid };
  });
  const needed = entries.filter(entry => entry.mode !== 'submodule' && (/^package\/[^/]+\/[^/]+\/(package\.json|src\/.+)$/u.test(entry.path) || entry.path === 'package/config/pnpr/config.yaml'));
  const batch = execFileSync(realGit, ['cat-file', '--batch'], { cwd: root, input: `${needed.map(entry => entry.oid).join('\n')}\n`, maxBuffer: 1024 * 1024 * 1024 });
  /** @type {Map<string, Buffer>} */
  const bytes = new Map();
  let cursor = 0;
  for (const entry of needed) {
    const headerEnd = batch.indexOf(0x0A, cursor);
    const [oid, , size] = batch.subarray(cursor, headerEnd).toString('utf8').split(' ');
    if (oid !== entry.oid)
      throw new HarnessError(`cat-file answered ${oid} for ${entry.oid}`);
    bytes.set(entry.path, Buffer.from(batch.subarray(headerEnd + 1, headerEnd + 1 + Number(size))));
    cursor = headerEnd + 1 + Number(size) + 1;
  }
  return { entries, bytes, revision };
}

/**
 The shared workspace file: every tracked path, bytes where the planner can read them.

 @param {ReturnType<typeof repositorySnapshot>} snapshot - repository snapshot
 @returns {object[]} fixture files
 */
export function sharedWorkspace(snapshot) {
  return snapshot.entries.map(entry => {
    const bytes = snapshot.bytes.get(entry.path);
    return { path: toHex(entry.path), mode: entry.mode, current: bytes === undefined ? null : toHex(bytes), base: bytes === undefined ? null : true };
  });
}

/**
 Facts of every workspace manifest at `HEAD`.

 @param {ReturnType<typeof repositorySnapshot>} snapshot - repository snapshot
 @returns {{ path: string, directory: string, text: string, manifest: any }[]} manifests
 */
function manifests(snapshot) {
  return snapshot.entries
    .filter(entry => /^package\/[^/]+\/[^/]+\/package\.json$/u.test(entry.path))
    .map(entry => {
      const text = snapshot.bytes.get(entry.path)?.toString('utf8') ?? '';
      return { path: entry.path, directory: entry.path.slice(0, -'/package.json'.length), text, manifest: JSON.parse(text) };
    });
}

/**
 Sample packages by category from the actual graph.

 @param {ReturnType<typeof repositorySnapshot>} snapshot - repository snapshot
 @param {number} seed - sample seed
 @returns {{ category: string, names: string[] }[]} samples
 */
export function repositorySamples(snapshot, seed) {
  const all = manifests(snapshot).filter(entry => typeof entry.manifest.version === 'string');
  const keysOf = (/** @type {any} */ manifest, /** @type {string[]} */ fieldNames) => fieldNames.flatMap(field => Object.keys(manifest[field] ?? {}));
  const runtimeCount = (/** @type {string} */ name) => all.filter(entry => keysOf(entry.manifest, runtimeFields).includes(name)).length;
  const anyCount = (/** @type {string} */ name) => all.filter(entry => keysOf(entry.manifest, [...runtimeFields, 'devDependencies']).includes(name)).length;
  const sources = (/** @type {string} */ directory) => [...snapshot.bytes].filter(([path]) => isNonTestSourcePath({ directory, path })).map(([, bytes]) => bytes.toString('utf8'));
  const importOnly = all.filter(candidate => runtimeCount(candidate.manifest.name) === 0
    && all.some(user => keysOf(user.manifest, ['devDependencies']).includes(candidate.manifest.name)
      && sources(user.directory).some(sourceText => importsPackage({ sourceText, packageName: candidate.manifest.name }))));
  const random = seeded(seed);
  const sample = (/** @type {typeof all} */ list) => list
    .map(entry => ({ entry, order: random() }))
    .toSorted((left, right) => left.order - right.order)
    .slice(0, perCategory)
    .map(({ entry }) => /** @type {string} */ (entry.manifest.name));
  const byName = (/** @type {typeof all} */ list) => list.toSorted((left, right) => (left.manifest.name < right.manifest.name ? -1 : 1));
  return [
    { category: 'leaf', names: sample(byName(all.filter(entry => anyCount(entry.manifest.name) === 0))) },
    { category: 'most-depended-on', names: all.toSorted((left, right) => runtimeCount(right.manifest.name) - runtimeCount(left.manifest.name) || (left.manifest.name < right.manifest.name ? -1 : 1)).slice(0, perCategory).map(entry => entry.manifest.name) },
    { category: 'private', names: sample(byName(all.filter(entry => entry.manifest.private === true))) },
    { category: 'source-import-only', names: sample(byName(importOnly)) },
  ];
}

/**
 The manifest text with its version raised by one minor step.

 @param {{ path: string, text: string, manifest: any }} entry - manifest
 @returns {string} raised text
 */
function raisedText(entry) {
  const [major, minor] = entry.manifest.version.split('.');
  const raised = `${major}.${Number(minor) + 1}.0`;
  const text = entry.text.replace(`"version": ${JSON.stringify(entry.manifest.version)}`, `"version": ${JSON.stringify(raised)}`);
  if (JSON.parse(text).version !== raised)
    throw new HarnessError(`could not raise ${entry.path}`);
  return text;
}

/**
 Cases raising sampled packages: one per sample, one raising one of each category, and that raise as the release
 workflow's direct fix.

 @param {ReturnType<typeof repositorySnapshot>} snapshot - repository snapshot
 @param {ReturnType<typeof repositorySamples>} samples - sampled names by category
 @param {string} workspaceFile - shared workspace file name
 @returns {{ name: string, kind: string, input: object, features: string[] }[]} cases
 */
export function repositoryCases(snapshot, samples, workspaceFile) {
  const byName = new Map(manifests(snapshot).map(entry => [entry.manifest.name, entry]));
  const raiseCase = (/** @type {string} */ name, /** @type {string[]} */ names, /** @type {string} */ trigger) => {
    const raised = names.map(raisedName => /** @type {NonNullable<ReturnType<typeof byName.get>>} */ (byName.get(raisedName)));
    return {
      name,
      kind: 'workspace',
      features: [],
      input: {
        workspace: workspaceFile,
        files: raised.map(entry => ({ path: toHex(entry.path), mode: 'regular', current: toHex(raisedText(entry)), base: toHex(entry.text) })),
        trigger,
        forwardsCommit: trigger === 'pre-forward',
        candidates: raised.map(entry => ({ path: toHex(entry.path), change: 'modified' })),
      },
    };
  };
  const single = samples.flatMap(({ category, names }) => names.map(name => raiseCase(`repository ${category} ${name}`, [name], 'pre-forward')));
  const mixed = samples.map(({ names }) => names[0]).filter(name => name !== undefined);
  return [
    ...single,
    raiseCase(`repository mixed ${mixed.join(' ')}`, mixed, 'pre-forward'),
    raiseCase(`repository release-shaped direct fix ${mixed.join(' ')}`, mixed, 'direct-fix'),
  ];
}
