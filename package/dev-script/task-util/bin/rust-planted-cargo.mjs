#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { parseCases } from './rust-planted-junit.mjs';

//region Preserve existing planted-control assertions while executing Rust cases through Nextest
const args = process.argv.slice(2);
assert.deepEqual(args, ['test', '--lib', '--offline', '--locked', '--', '--test-threads=2']);
assert(process.env.RESEARCH_REAL_CARGO && process.env.RESEARCH_PLANT_RECEIPTS);
const parent = process.env.RESEARCH_PLANT_RECEIPTS;
mkdirSync(parent, { recursive: true });
const key = String(readdirSync(parent).length).padStart(4, '0');
const directory = join(parent, key);
mkdirSync(directory);
const config = join(directory, 'nextest.toml');
writeFileSync(config, '[store]\ndir = ' + JSON.stringify(directory) + '\n[profile.default]\nslow-timeout = { period = "90s", terminate-after = 1, grace-period = "10s" }\n[profile.default.junit]\npath = "actual.xml"\nreport-skipped = "all"\nstore-failure-output = true\n');
const nextestArgs = ['nextest', '--config-file', config, 'run', '--lib', '--offline', '--locked', '--no-fail-fast'];
const result = spawnSync(process.env.RESEARCH_REAL_CARGO, nextestArgs, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
if (result.error) throw result.error;
const output = result.stdout + '\n' + result.stderr;
writeFileSync(join(directory, 'actual-nextest.log'), output);
const report = join(directory, 'default/actual.xml');
const cases = [];
if (existsSync(report)) {
  const xml = readFileSync(report, 'utf8');
  cases.push(...parseCases(xml));
}
writeFileSync(join(directory, 'adapter.json'), JSON.stringify({ input: args, actualCommand: [process.env.RESEARCH_REAL_CARGO, ...nextestArgs], status: result.status, signal: result.signal, cwd: process.cwd(), parsedCases: cases, originalOwnerThreads: 2, nextestConcurrency: 'default', applicationSourceEditedByAdapter: false }, null, 2) + '\n');
process.stdout.write(output);
for (const item of cases) process.stdout.write('test ' + item.name + ' ... ' + item.status + '\n');
process.exitCode = result.status ?? 1;
//endregion
