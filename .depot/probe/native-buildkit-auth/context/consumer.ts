
import {strict as assert} from 'node:assert';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';import {availableParallelism,totalmem} from 'node:os';
import {createTaskQueue} from './task-queue.ts';
const manifest=JSON.parse(readFileSync(new URL('./manifest.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('./task-queue.ts',import.meta.url));
const digest=createHash('sha256').update(source).digest('hex');assert.equal(digest,manifest.sourceSha256);
assert.equal(process.version,'v24.22.0');assert.equal(process.arch,'x64');
const local=process.argv[2]==='-';const cpus=availableParallelism();const memory=totalmem();
if(!local){assert(cpus<=16);assert(memory<=32*1024**3);}
const ran=[];const rejected=[];const queue=createTaskQueue();
for(const name of ['one','two','three'])queue.enqueue({run(){ran.push(name);},reject(reason){rejected.push(name+':'+reason);}});
assert.equal(queue.size,3);for(const call of queue.take(2))call.run();assert.deepEqual(ran,['one','two']);
assert.equal(queue.size,1);for(const call of queue.clear())call.reject('owned-control');
assert.deepEqual(rejected,['three:owned-control']);assert.equal(queue.size,0);assert.deepEqual(queue.take(1),[]);
const result={frozenSource:manifest.frozenSource,cohort:manifest.cohort,sourcePath:manifest.sourcePath,sourceSha256:digest,node:process.version,architecture:process.arch,cpuCount:cpus,memoryBytes:memory,hardwareBoundsEnforced:!local,ran,rejected,emptyQueueSize:queue.size,narrowFirstPartyConsumer:true,fullOwningUnitTask:false};
if(local)console.log(JSON.stringify(result));else{mkdirSync('/output',{recursive:true});writeFileSync('/output/result.json',JSON.stringify(result,null,2)+'\n');copyFileSync(new URL('./task-queue.ts',import.meta.url),'/output/task-queue.ts');}
