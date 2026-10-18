#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';

//region Retain the unchanged host fixture's actual protocol without rewriting any message
assert(process.env.RESEARCH_REAL_CODEX && process.env.RESEARCH_CODEX_PROTOCOL_DIRECTORY);
const directory = process.env.RESEARCH_CODEX_PROTOCOL_DIRECTORY;
mkdirSync(directory, { recursive: true, mode: 0o700 });
const input = createWriteStream(join(directory, 'client.jsonl'), { mode: 0o600 });
const output = createWriteStream(join(directory, 'host.jsonl'), { mode: 0o600 });
const configuration = readFileSync(join(process.env.CODEX_HOME, 'config.toml'), 'utf8');
const original = new URL(/^base_url = '([^']+)'$/mu.exec(configuration)?.[1]);
assert.equal(original.hostname, '127.0.0.1');
assert.equal(original.protocol, 'http:');
let sequence = 0;
const proxy = createServer((request, response) => {
  const number = String(sequence++).padStart(3, '0');
  const incoming = createWriteStream(join(directory, number + '.request.json'), { mode: 0o600 });
  const outgoing = createWriteStream(join(directory, number + '.response.txt'), { mode: 0o600 });
  const target = new URL(request.url, original.origin);
  const upstream = httpRequest(target, { method: request.method, headers: { ...request.headers, host: original.host } }, received => {
    response.writeHead(received.statusCode, received.headers);
    received.on('data', bytes => outgoing.write(bytes));
    received.on('end', () => outgoing.end());
    received.pipe(response);
  });
  let bytesSeen = 0;
  request.on('data', bytes => {
    bytesSeen += bytes.length;
    if (bytesSeen > 16 * 1024 * 1024) request.destroy(new Error('Local fixture request exceeds capture bound'));
    incoming.write(bytes);
  });
  request.on('end', () => incoming.end());
  upstream.on('error', error => { process.stderr.write(error.stack + '\n'); response.destroy(error); });
  request.pipe(upstream);
});
// The sole configuration change routes the same local Responses bytes through a recording relay.
proxy.listen(0, '127.0.0.1', () => {
const forwarded = process.argv.slice(2);
forwarded.unshift('--config', 'model_providers.local-fixture.base_url="http://127.0.0.1:' + proxy.address().port + original.pathname + '"');
writeFileSync(join(directory, 'loopback-relay.json'), JSON.stringify({ original: original.href, forwarded, requestBodyMaximumBytes: 16777216 }, null, 2) + '\n');
const child = spawn(process.env.RESEARCH_REAL_CODEX, forwarded, { stdio: ['pipe', 'pipe', 'inherit'] });
process.stdin.on('data', bytes => input.write(bytes));
process.stdin.pipe(child.stdin);
child.stdout.on('data', bytes => output.write(bytes));
child.stdout.pipe(process.stdout);
child.on('error', error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
child.on('exit', (status, signal) => {
  input.end();
  output.end();
  proxy.closeAllConnections();
  proxy.close();
  if (signal) process.stderr.write('Actual Codex exited on ' + signal + '\n');
  process.exitCode = status ?? 1;
});
});
//endregion
