#!/usr/bin/env node
// Isolated research harness. Logs cache operations without credential values.
import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { createServer } from 'node:http';

//region Bound request handling and retain cache byte provenance
const token = process.env.DEPOT_CACHE_TOKEN;
const journal = process.env.REUSE_CACHE_JOURNAL;
const backend = process.env.REUSE_CACHE_BACKEND ?? 'https://cache.depot.dev';
if (!token || !journal) throw new Error('Cache identity and a private journal path are required');
let mode = 'normal';
let selectedKey = '';

/** Return reproducible byte identity without recording cached application contents. */
function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Forward one bounded cache exchange and optionally inject an isolated transport fixture. */
async function exchange({ request, response }) {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  const key = path.slice(1);
  if (!/^[a-f0-9]{16,128}$/u.test(key) || !['GET', 'PUT', 'HEAD'].includes(request.method)) {
    response.writeHead(400).end();
    return;
  }
  let inputBytes = 0;
  const parts = [];
  for await (const part of request) {
    inputBytes += part.length;
    if (inputBytes > 128 * 1024 * 1024) throw new Error('Research cache entry exceeds 128 MiB bound');
    parts.push(part);
  }
  const input = Buffer.concat(parts);
  let status;
  let bytes;
  let remoteStatus = null;
  const inject = request.method === 'GET' && (selectedKey === '' || key === selectedKey);
  if (inject && mode === 'missing') {
    status = 404;
    bytes = Buffer.alloc(0);
  } else if (inject && mode === 'corrupt') {
    status = 200;
    bytes = Buffer.from('isolated-corrupt-cache-entry-20261018');
  } else {
    const headers = {
      Authorization: 'Basic ' + Buffer.from('l4zncjjbj5:' + token).toString('base64'),
      'User-Agent': request.headers['user-agent'] ?? 'Gradle/9.8.1',
    };
    if (request.headers['content-type']) headers['Content-Type'] = request.headers['content-type'];
    const upstream = await fetch(backend + path, {
      method: request.method,
      headers,
      body: request.method === 'PUT' ? input : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    remoteStatus = upstream.status;
    status = upstream.status;
    const length = Number(upstream.headers.get('content-length') ?? '0');
    if (length > 128 * 1024 * 1024) throw new Error('Research cache response exceeds 128 MiB bound');
    bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length > 128 * 1024 * 1024) throw new Error('Research cache response exceeded its bound');
    if (inject && mode === 'partial' && status === 200) bytes = bytes.subarray(0, Math.max(1, Math.floor(bytes.length / 2)));
  }
  response.writeHead(status, { 'Content-Length': bytes.length, 'Content-Type': 'application/octet-stream' });
  response.end(bytes);
  appendFileSync(journal, JSON.stringify({ startedAt, elapsedSeconds: (performance.now() - started) / 1000, method: request.method, key, mode, status, remoteStatus, inputBytes, outputBytes: bytes.length, inputSha256: digest(input), outputSha256: digest(bytes) }) + '\n');
}

/** Keep proxy failures visible while returning a bounded HTTP failure to Gradle. */
async function handle({ request, response }) {
  try {
    await exchange({ request, response });
  } catch (error) {
    appendFileSync(journal, JSON.stringify({ recordedAt: new Date().toISOString(), failure: String(error), mode }) + '\n');
    if (!response.headersSent) response.writeHead(502);
    response.end();
  }
}
//endregion

//region IPC isolates fault controls from the build's HTTP interface
const server = createServer(async (request, response) => {
  await handle({ request, response });
});
server.requestTimeout = 45_000;
server.headersTimeout = 10_000;
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Expected a private TCP cache endpoint');
  process.send?.({ port: address.port, backendOrigin: new URL(backend).origin });
});
process.on('message', message => {
  if (message.command === 'mode') {
    if (!['normal', 'missing', 'partial', 'corrupt'].includes(message.mode)) throw new Error('Unknown research fault mode');
    mode = message.mode;
    selectedKey = message.key ?? '';
    process.send?.({ mode, key: selectedKey });
    return;
  }
  if (message.command === 'shutdown') {
    server.close(() => {
      process.disconnect();
    });
    return;
  }
  throw new Error('Unknown research control command');
});
//endregion
