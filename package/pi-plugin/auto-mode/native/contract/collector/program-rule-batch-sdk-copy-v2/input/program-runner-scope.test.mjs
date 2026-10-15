import assert from 'node:assert/strict';
import { setImmediate, setTimeout } from 'node:timers/promises';
import { acquireProgramQueue, requireProgramScope } from './program-runner-scope.mjs';

//region Original recorder ownership is stable across reached groups

/** Observable constructor supplied through the same interface as the native recorder. */
class FixtureRecorder { entries = []; }

const runner = { scopes: new Map(), queueTail: Promise.resolve() };
const carrier = { token: Object.freeze({}) };
const parentId = 'original-parent';
const scope = requireProgramScope({ runner, carrier, parentId, NestedCallRecorder: FixtureRecorder });
assert.ok(scope.recorder instanceof FixtureRecorder);
assert.equal(scope.owner, carrier.token);
assert.equal(scope.nextId, 1);
assert.equal(scope.holdsQueue, false);
assert.equal(runner.scopes.get(parentId), scope);
assert.equal(runner.scopes.get(carrier.token), scope);
assert.equal(requireProgramScope({ runner, carrier, parentId, NestedCallRecorder: FixtureRecorder }), scope);
assert.throws(function rejectAnotherOwner() {
  requireProgramScope({ runner, carrier: { token: Object.freeze({}) }, parentId, NestedCallRecorder: FixtureRecorder });
}, { message: 'Native root recorder label already belongs to another scope' });
assert.equal(runner.scopes.size, 2);

//endregion Original recorder ownership is stable across reached groups

//region A held queue turn blocks its successor and releases on either exit

/** Race a successor with a deadline so missing cleanup fails instead of hanging verification. */
async function requireReleasedTurn(pending) {
  const deadline = new AbortController();
  using cleanup = { [Symbol.dispose]() { deadline.abort(); } };
  async function deadlineResult() {
    try {
      return await setTimeout(1000, 'queue-release-missing', { signal: deadline.signal });
    } catch (error) {
      assert.equal(error.name, 'AbortError');
      return 'deadline-cancelled';
    }
  }
  const result = await Promise.race([pending, deadlineResult()]);
  assert.notEqual(result, 'queue-release-missing');
  assert.notEqual(result, 'deadline-cancelled');
  return result;
}

/** Both ordinary return and exceptional exit must unblock the same successor. */
async function verifyQueueRelease(throwAfterAcquisition) {
  const pending = [];
  const failure = new Error('fixture dispatch failed after acquiring its queue turn');
  try {
    using first = await acquireProgramQueue(runner);
    pending.push(acquireProgramQueue(runner));
    assert.equal(await Promise.race([pending[0], setImmediate('still-waiting')]), 'still-waiting');
    if (throwAfterAcquisition) throw failure;
  } catch (error) {
    assert.equal(error, failure);
    assert.equal(throwAfterAcquisition, true);
  }
  using second = await requireReleasedTurn(pending[0]);
}

await verifyQueueRelease(false);
await verifyQueueRelease(true);
console.log(JSON.stringify({ complete: true, originalRecorder: true, normalQueueRelease: true, failedQueueRelease: true }));

//endregion A held queue turn blocks its successor and releases on either exit
