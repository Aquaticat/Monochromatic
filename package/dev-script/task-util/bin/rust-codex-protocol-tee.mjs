#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';

//region Retain the unchanged host fixture's actual protocol without rewriting any message
assert(process.env.RESEARCH_REAL_CODEX && process.env.RESEARCH_CODEX_PROTOCOL_DIRECTORY);
const directory = process.env.RESEARCH_CODEX_PROTOCOL_DIRECTORY;
mkdirSync(directory, { recursive: true, mode: 0o700 });
const input = createWriteStream(join(directory, 'client.jsonl'), { mode: 0o600 });
const output = createWriteStream(join(directory, 'host.jsonl'), { mode: 0o600 });
const child = spawn(process.env.RESEARCH_REAL_CODEX, process.argv.slice(2), { stdio: ['pipe', 'pipe', 'inherit'] });
process.stdin.on('data', bytes => input.write(bytes));
process.stdin.pipe(child.stdin);
child.stdout.on('data', bytes => output.write(bytes));
child.stdout.pipe(process.stdout);
child.on('error', error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
child.on('exit', (status, signal) => {
  input.end();
  output.end();
  if (signal) process.stderr.write('Actual Codex exited on ' + signal + '\n');
  process.exitCode = status ?? 1;
});
//endregion
