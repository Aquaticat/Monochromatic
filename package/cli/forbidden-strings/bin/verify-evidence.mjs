#!/usr/bin/env node
/** Compare retained manifests with current compiled inputs and summarize exact terminal evidence. */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/** Enumerate both sides of the copied source/build/test input set, including newly added current files. */
async function currentInputs({ repository, fuzzing }) {
  const scanner = 'package/cli/forbidden-strings';
  const engine = 'package/rust-module/forbidden-regex';
  const pending = ['clippy.toml', 'forbidden-strings.append.txt',
    ...['Cargo.toml', 'Cargo.lock', 'build.rs', 'src', 'tests', 'data'].map(file => `${scanner}/${file}`),
    ...['Cargo.toml', 'Cargo.lock', 'src'].map(file => `${engine}/${file}`)];
  if (fuzzing) pending.push(...['Cargo.toml', 'Cargo.lock', 'src', 'fuzz_targets', 'seed', 'dictionary'].map(file => `${scanner}.fuzz/${file}`));
  const inputs = new Map();
  while (pending.length !== 0) {
    const path = pending.pop();
    const absolute = join(repository, path);
    if ((await stat(absolute)).isDirectory()) {
      for (const name of await readdir(absolute)) pending.push(`${path}/${name}`);
    } else {
      const bytes = await readFile(absolute);
      inputs.set(path, createHash('sha256').update(bytes).digest('hex'));
    }
  }
  return inputs;
}

/** Report every mismatch rather than treating a Git HEAD as source-snapshot proof. */
async function main() {
  const repository = resolve(import.meta.dirname, '../../../..');
  const roots = [resolve(import.meta.dirname, '../target/verification'), resolve(import.meta.dirname, '../../forbidden-strings.fuzz/target/verification')];
  const records = [];
  for (const root of roots) {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'docs') continue;
      const directory = join(root, entry.name);
      const manifestPath = join(directory, 'manifest.json');
      let manifest;
      try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); }
      catch (error) { console.log(`No readable manifest in ${directory}: ${error.message}`); continue; }
      if (!manifest.sources) continue;
      const differences = [];
      const inputs = await currentInputs({ repository, fuzzing: manifest.sources.some(source => source.path.startsWith('package/cli/forbidden-strings.fuzz/')) });
      const testedPaths = new Set();
      for (const source of manifest.sources) {
        // Task scripts/docs do not enter Cargo's artifact. Guard-injected source intentionally differs and remains separately labeled.
        if (source.path.includes('/bin/') || source.path.endsWith('/mise.toml')) continue;
        testedPaths.add(source.path);
        const current = inputs.get(source.path);
        if (source.sha256 !== current) differences.push({ path: source.path, tested: source.sha256, current });
      }
      for (const [path, current] of inputs) {
        if (!testedPaths.has(path)) differences.push({ path, current, addedAfterSnapshot: true });
      }
      const endings = {};
      for (const file of ['exit.json', 'control.json', 'mutants.out/outcomes.json']) {
        try { endings[file] = JSON.parse(await readFile(join(directory, file), 'utf8')); }
        catch (error) { endings[file] = { unavailable: error.message }; }
      }
      const timestamp = (await stat(manifestPath)).mtime.toISOString();
      records.push({ directory, timestamp, image: manifest.image, sourceSha256: manifest.sourceSha256, command: manifest.command, sources: manifest.sources, differences, endings });
      console.log(`${entry.name}: ${differences.length} compiled-input differences; ${endings['exit.json'].status ?? endings['control.json'].status ?? 'no terminal status'}`);
    }
  }
  const guarded = records.filter(record => record.endings['control.json'].variant === 'protected' && record.endings['control.json'].expected)
    .sort((first, second) => second.timestamp.localeCompare(first.timestamp))[0];
  const guardComparisons = [];
  if (guarded) {
    for (const record of records) {
      if (!record.directory.includes('/guard-without-') || !record.endings['control.json'].expected) continue;
      const first = new Map(guarded.sources.filter(source => !source.path.includes('/bin/') && !source.path.endsWith('/mise.toml')).map(source => [source.path, source.sha256]));
      const second = new Map(record.sources.filter(source => !source.path.includes('/bin/') && !source.path.endsWith('/mise.toml')).map(source => [source.path, source.sha256]));
      const paths = new Set([...first.keys(), ...second.keys()]);
      const differences = [...paths].filter(path => first.get(path) !== second.get(path));
      const comparison = { protected: guarded.directory, disabled: record.directory, differences };
      guardComparisons.push(comparison);
      console.log(`Guard input comparison ${record.directory}: ${differences.join(', ')}`);
    }
  }
  await writeFile(join(roots[0], 'reconciliation.json'), JSON.stringify(records, null, 2) + '\n');
  await writeFile(join(roots[0], 'guard-input-comparisons.json'), JSON.stringify(guardComparisons, null, 2) + '\n');
}

await main();
