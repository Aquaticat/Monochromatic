/** Publish immutable manager-input snapshots without copying every retained prefix on append. @module */
import assert from 'node:assert/strict';
import {captureLoadedInputs} from '../dist/native/contract/collector/run-prompt-custody-v3/loaded-inputs.mjs';

const INPUT_COUNT=50_000;
const CPU_BUDGET_MICROSECONDS=4_000_000;
const pool=captureLoadedInputs([]);
/** Every occurrence comes from its original manager argument frame. */
function appendMessage(message){
  assert.equal(arguments[0],message);
  pool.captureManagerInput({frame:arguments,method:'appendMessage'});
}
const empty=pool.readConstructedInputs();
appendMessage({role:'user',content:'Original manager input.'});
const first=pool.readConstructedInputs();
globalThis.gc();
const start=process.cpuUsage();
for(let index=1;index<INPUT_COUNT;index++)appendMessage({role:'user',content:'Original manager input.'});
const cpu=process.cpuUsage(start);
const cpuMicroseconds=cpu.user+cpu.system;
pool.assertCaptured();
const complete=pool.readConstructedInputs();
assert.equal(empty.length,0);
assert.equal(first.length,1);
assert.ok(Object.isFrozen(first));
assert.ok(Object.isFrozen(complete));
assert.equal(complete.length,INPUT_COUNT);
assert.equal(complete[0],first[0]);
assert.equal(pool.readConstructedInputs(),complete);
assert.equal(new Set(complete.map(function originalPublication(origin){return origin.publication;})).size,INPUT_COUNT);
appendMessage({role:'user',content:'A different later input.'});
const changed=pool.readConstructedInputs();
assert.notEqual(changed,complete);
assert.equal(changed.length,INPUT_COUNT+1);
assert.equal(complete.length,INPUT_COUNT);
assert.notEqual(changed.at(-1).source.sha256,complete[0].source.sha256);
assert.ok(cpuMicroseconds>0,'Positive control: the genuine append path consumes measured process CPU');
assert.ok(cpuMicroseconds<CPU_BUDGET_MICROSECONDS,`Manager append uses ${cpuMicroseconds} CPU microseconds, exceeding ${CPU_BUDGET_MICROSECONDS}`);
console.log(JSON.stringify({complete:true,inputs:complete.length,cpuMicroseconds,
  oldSnapshotsUnchanged:true,stableReads:true,distinctPublications:true,changedInput:true}));
