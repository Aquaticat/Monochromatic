import assert from 'node:assert/strict';
import {
  env,
  source,
  createRuntime,
  nativeHost
} from '../dist/native/contract/integration/native-host/lifecycle-fixture.mjs';
import { fixtureResponse } from '../dist/native/contract/integration/native-batch/fixture-response.mjs';
import { nativeOpenAIStream } from '../dist/native/contract/integration/native-batch/source-association.mjs';

//region Original host actions must leave the next prompt usable.
const mode = process.argv[2];
assert.ok([
  'switch',
  'tree',
  'retry',
  'reload',
  'abort'
].includes(mode));
env.options
  .modelRuntime
  .registerProvider(
    'batch-fixture',
    {
  baseUrl: 'https://fixture.invalid/v1',
  api: 'openai-completions',
  streamSimple: nativeOpenAIStream,
  models: [{ ...env.options
    .model }]
}
  );
const requests = [];
globalThis.fetch = async function fixtureFetch(input) {
  requests.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if ((mode === 'retry') && (requests.length === 1)) throw new TypeError('Fixture connection failure');
  return fixtureResponse({ proposal: false });
};
const { createAgentSessionRuntime } = await import(source('core/agent-session-runtime.js'));
const manager = nativeHost.managers
  .inMemory(env.options
    .cwd);
const runtime = await createAgentSessionRuntime(
  createRuntime,
  {
  cwd: env.options
    .cwd,
  agentDir: env.options
    .agentDir,
  sessionManager: manager
}
);
const {session} = runtime;
session.agent
  .getApiKey = function readFixtureCredential() { return process.env
    .FIXTURE_API_KEY; };
const messages = [];
session.subscribe(function observeResponse(event) {
  if (event.type === 'message_end') messages.push(event.message);
});
await using cleanup = { async [Symbol.asyncDispose]() { await runtime.dispose();
await env.drain(); } };
await session.prompt('Reply briefly without using tools.');
const first = manager.getBranch()
  .find(function firstUser(entry) {
  return (entry.type === 'message') && (entry.message
    .role
    === 'user');
});
assert.ok(first);
const initialLease = nativeHost.lifecycle
  .capture({
    session,
    manager
  });
assert.equal(
  messages.at(-1)
    ?.stopReason,
  mode === 'retry' ? 'error' : 'stop'
);
if (mode === 'switch') await session.setModel({
  ...env.options
    .model,
  baseUrl: 'https://second.invalid/v1'
});
if (mode === 'reload') await session.reload();
if (mode === 'tree') {
  const result = await session.navigateTree(first.id);
  assert.equal(
    result.cancelled,
    false
  );
  assert.throws(function rejectOldBranch() { nativeHost.lifecycle
    .assertActive(initialLease); });
}
if (mode === 'abort') await session.abort();
await session.prompt('Reply again without using tools.');
const last = messages.at(-1);
assert.equal(
  last?.stopReason,
  'stop',
  `Follow-up after ${mode}: ${last?.errorMessage}`
);
assert.deepEqual(
  requests,
  [
  'https://fixture.invalid/v1/chat/completions',
  mode === 'switch' ? 'https://second.invalid/v1/chat/completions' : 'https://fixture.invalid/v1/chat/completions'
]
);
console.log(JSON.stringify({
  complete: true,
  mode,
  requests: requests.length,
  errors: messages.filter(function failed(message) { return message.stopReason === 'error'; })
    .map(function diagnostic(message) { return message.errorMessage; })
}));
//endregion Original host actions must leave the next prompt usable.
