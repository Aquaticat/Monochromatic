#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';
import { strict as assert } from 'node:assert';

//region Establish that the namespace init reaps an orphan instead of retaining an exited PID
const [expected, output] = process.argv.slice(2);
assert(['zombie', 'reaped'].includes(expected));
process.umask(0o022);
const fixture = 'import os,time\npid=os.fork()\nif pid==0:\n time.sleep(0.15)\n os._exit(0)\nprint(pid,flush=True)\nos._exit(0)\n';
const spawned = spawnSync('python3', ['-c', fixture], { encoding: 'utf8' });
assert.equal(spawned.status, 0, spawned.stderr);
const pid = Number(spawned.stdout.trim());
assert(Number.isSafeInteger(pid) && pid > 1);
let state;
for (let index = 0; index < 150; index++) {
  try {
    const stat = readFileSync('/proc/' + pid + '/stat', 'utf8');
    state = stat.slice(stat.lastIndexOf(')') + 1).trim().split(/\s+/u)[0];
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = 'absent';
  }
  if (state === (expected === 'zombie' ? 'Z' : 'absent')) break;
  await wait(20);
}
const result = { expected, observedState: state, pid, parentHarnessPid: process.pid, namespaceInit: readFileSync('/proc/1/comm', 'utf8').trim() };
writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { mode: 0o644 });
console.log(JSON.stringify(result));
assert.equal(state, expected === 'zombie' ? 'Z' : 'absent');
//endregion
