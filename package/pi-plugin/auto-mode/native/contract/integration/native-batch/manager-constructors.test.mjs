import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createEnvironment } from './environment.mjs';
import { createRootSessionFactory } from './session-root.mjs';

//region Exercise native persisted and external-entry constructors through their actual consumer.

const env = await createEnvironment();
const factory = createRootSessionFactory(env);
const cwd = env.options.cwd;
const sessions = join(env.options.agentDir, 'constructor-sessions');
const targetCwd = join(cwd, 'fork-target');
await mkdir(targetCwd);

const originalId = randomUUID();
const parentSession = join(sessions, 'declared-parent.jsonl');
const original = factory.managers.create(cwd, sessions, { id: originalId, parentSession });
assert.equal(original.getSessionId(), originalId);
assert.equal(original.getHeader().parentSession, parentSession);
const content = 'Original persisted constructor input';
original.appendMessage({ role: 'user', content, timestamp: 1 });
const originalPath = original.getSessionFile();
const persistedBytes = await readFile(originalPath, 'utf8');
assert(persistedBytes.includes(content));

const reopened = factory.managers.open(originalPath, sessions, targetCwd);
assert.equal(reopened.getCwd(), targetCwd);
assert.equal(reopened.getSessionDir(), sessions);
assert.equal(reopened.getSessionId(), originalId);
assert.equal(reopened.getSessionFile(), originalPath);

const recent = factory.managers.continueRecent(cwd, sessions);
assert.equal(recent.getSessionId(), originalId);
assert.equal(recent.getSessionFile(), originalPath);
const emptyRecent = factory.managers.continueRecent(cwd, join(sessions, 'empty'));
assert.notEqual(emptyRecent.getSessionId(), originalId);
assert.deepEqual(emptyRecent.getEntries(), []);

const forkId = randomUUID();
const forked = factory.managers.forkFrom(originalPath, targetCwd, join(sessions, 'fork'), { id: forkId });
assert.equal(forked.getSessionId(), forkId);
assert.equal(forked.getCwd(), targetCwd);
assert.equal(forked.getHeader().parentSession, originalPath);
assert.notEqual(forked.getSessionFile(), originalPath);
assert((await readFile(forked.getSessionFile(), 'utf8')).includes(content));
assert.equal(await readFile(originalPath, 'utf8'), persistedBytes);

const memoryId = randomUUID();
const memory = factory.managers.inMemory(cwd, { id: memoryId, parentSession: originalPath }, original.getEntries());
assert.equal(memory.getSessionId(), memoryId);
assert.equal(memory.getHeader().parentSession, originalPath);
assert.equal(memory.getSessionFile(), undefined);
assert.equal(memory.isPersisted(), false);

for (const manager of [recent, forked, memory]) {
  const result = await factory.createFromManager({ options: env.options, manager });
  assert.equal(result.root.manager, manager);
  assert.equal(result.session.sessionManager, manager);
  assert(result.session.messages.some(function retainsMessage(message) {
    return message.role === 'user' && message.content === content;
  }));
  factory.lifecycle.assertActive(factory.lifecycle.capture(result.root));
  result.session.dispose();
  assert.equal(env.readSessionDisposalState(result.session).completed, true);
}
await env.drain();
console.log(JSON.stringify({ complete: true, nativeConstructors: ['create', 'open', 'continueRecent', 'forkFrom', 'inMemory'],
  sessionConstructions: 3, originalHistoryRetained: true, originalFileUnchangedByFork: true,
  explicitSessionIds: true, workingDirectoryOverride: true, emptyRecentCreatesSession: true,
  providerRequests: 0 }));

//endregion
