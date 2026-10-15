import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';

//region Count actual governing-file opens through the built native approval consumer.
const observation={policyOpens:0};
const {openSync:originalOpen}=fs;

/** Keep native filesystem results while measuring repeated reads of the disposable policy. */
function countPolicyOpen(...args){
  const [path]=args;
  if((typeof path==='string')&&path.includes('/pi-native-fixture-')&&path.endsWith('/workspace/AGENTS.md'))
    observation.policyOpens++;
  return Reflect.apply(originalOpen,fs,args);
}

fs.openSync=countPolicyOpen;
syncBuiltinESMExports();
process.argv.splice(2,process.argv.length,'allow','--native-context');
await import('./approval-domain.test.mjs');
assert.ok(observation.policyOpens>0,'The counter must reach the original native governing-file reader');
// The unchanged fixture exceeded 23000 opens before its judgment deadline expired.
// This work bound detects repeated full parent scans without depending on host timing.
assert.ok(observation.policyOpens<10000,`Native source binding validation repeated ${observation.policyOpens} policy opens`);
console.log(JSON.stringify({complete:true,policyOpens:observation.policyOpens}));
//endregion
