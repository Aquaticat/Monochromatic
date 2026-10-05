#!/usr/bin/env node
/** Compare retained manifests with current compiled inputs and summarize exact terminal evidence. */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

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
      for (const source of manifest.sources) {
        // Task scripts/docs do not enter Cargo's artifact. Guard-injected source intentionally differs and remains separately labeled.
        if (source.path.includes('/bin/') || source.path.endsWith('/mise.toml')) continue;
        let bytes;
        try { bytes = await readFile(join(repository, source.path)); }
        catch (error) { console.log(`Snapshot-only source ${source.path}: ${error.message}`); }
        const current = bytes === undefined ? undefined : createHash('sha256').update(bytes).digest('hex');
        if (source.sha256 !== current) differences.push({ path: source.path, tested: source.sha256, current });
      }
      const endings = {};
      for (const file of ['exit.json', 'control.json', 'mutants.out/outcomes.json']) {
        try { endings[file] = JSON.parse(await readFile(join(directory, file), 'utf8')); }
        catch (error) { endings[file] = { unavailable: error.message }; }
      }
      const timestamp = (await stat(manifestPath)).mtime.toISOString();
      records.push({ directory, timestamp, image: manifest.image, sourceSha256: manifest.sourceSha256, command: manifest.command, differences, endings });
      console.log(`${entry.name}: ${differences.length} compiled-input differences; ${endings['exit.json'].status ?? endings['control.json'].status ?? 'no terminal status'}`);
    }
  }
  await writeFile(join(roots[0], 'reconciliation.json'), JSON.stringify(records, null, 2) + '\n');
}

await main();
