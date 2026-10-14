import assert from 'node:assert/strict';
import {createEnvironment} from './environment.mjs';
import {ExtensionRunner,readNativeRunnerDomainEvents} from './generated/event-runner.mjs';
import {assertNativeSessionInputCapture,readNativeConstructedInputOrigins,readNativeSessionInputUsage} from './generated/session-manager.mjs';
import {isNativeEventObservation,createNativeEventObserver} from './event-observer.ts';

const env=await createEnvironment();
function fixture({kind,handlers}){
 const manager=env.SessionManager.inMemory(env.options.cwd);
 const extension={path:'fixture-extension',handlers:new Map([[kind,handlers]])};
 const runner=new ExtensionRunner([extension],{},env.options.cwd,manager,{});
 const errors=[];
 runner.onError(function retainNativeError(error){errors.push(error);});
 function observation(){return readNativeRunnerDomainEvents({runner,kinds:[kind]});}
 function records(){
  assertNativeSessionInputCapture(manager);
  return readNativeConstructedInputOrigins(manager).filter(function eventSource(origin){return origin.source.inputOrigin==='native-event-handler';}).map(function readEmission(origin){return JSON.parse(origin.source.content);});
 }
 return {manager,runner,errors,observation,records};
}

try{
 // More callback phases than the source count allowance still form one bounded emission.
 const original={type:'turn_start',text:'original'};
 const grouped=fixture({kind:'turn_start',handlers:Array.from({length:30},function handlerAt(_,ordinal){return function retainPhase(event){event.text=`mutation-${ordinal}`;return {unused:`output-${ordinal}`};};})});
 const before=grouped.observation();
 assert.ok(isNativeEventObservation(before));
 assert.equal(isNativeEventObservation({...before}),false);
 await grouped.runner.emit(original);
 const [records]=grouped.records();
 assert.equal(records.length,90);
 assert.equal(readNativeSessionInputUsage(grouped.manager).count,1);
 assert.deepEqual(records.slice(0,3).map(function phase(record){return record.phase;}),['input','output','after']);
 assert.equal(records[0].value.value.text,'original');
 assert.equal(records[1].value.value.unused,'output-0');
 assert.equal(records[2].value.value.text,'mutation-0');
 original.text='later mutation';
 assert.equal(records[0].value.value.text,'original');
 assert.equal(grouped.observation().pending,0);
 assert.notEqual(grouped.observation(),before);
 assert.equal(grouped.observation(),grouped.observation());

 // Pi's original await captures the result before a later queued mutation.
 let result;
 let mutated=false;
 const delayed=fixture({kind:'turn_start',handlers:[function delayedResult(){
  result={unused:'original result'};
  const deferred=Promise.withResolvers();
  queueMicrotask(function settle(){deferred.resolve(result);queueMicrotask(function later(){result.unused='later result';mutated=true;});});
  return deferred.promise;
 }]});
 await delayed.runner.emit({type:'turn_start'});
 assert.equal(mutated,true);
 assert.equal(delayed.records()[0][1].value.value.unused,'original result');

 // Native cancellation and block returns preserve their result and skip later callbacks.
 for(const kind of ['session_before_switch','tool_call']){
  let laterCalls=0;
  const returned=kind==='tool_call'?{block:true,reason:'fixture block'}:{cancel:true};
  const native=fixture({kind,handlers:[function stop(){return returned;},function later(){laterCalls++;}]});
  const actual=kind==='tool_call'?await native.runner.emitToolCall({type:kind}):await native.runner.emit({type:kind});
  assert.equal(actual,returned);
  assert.equal(laterCalls,0);
  assert.equal(native.observation().pending,0);
  assert.equal(native.records()[0].length,3);
 }

 // Generic native error reporting and unhandled tool-call error identity remain distinct.
 for(const kind of ['turn_start','tool_call']){
  const thrown={original:'fixture failure'};
  const native=fixture({kind,handlers:[function mutateThenThrow(event){event.changed='before failure';throw thrown;}]});
  if(kind==='tool_call'){
   let caught;
   try{await native.runner.emitToolCall({type:kind});}catch(error){caught=error;}
   assert.equal(caught,thrown);
  }else{await native.runner.emit({type:kind});assert.equal(native.errors.length,1);}
  assert.equal(native.records()[0].at(-1).value.value.changed,'before failure');
  assert.equal(native.observation().pending,0);
 }

 // Dedicated native message, tool-result, boundary, and Bash return branches remain reachable.
 const message=fixture({kind:'message_end',handlers:[function replaceMessage(){return {message:{role:'assistant',content:'replacement'},unused:'retained'};}]});
 assert.equal((await message.runner.emitMessageEnd({type:'message_end',message:{role:'assistant',content:'original'}})).content,'replacement');
 assert.equal(message.records()[0][1].value.value.unused,'retained');
 const tool=fixture({kind:'tool_result',handlers:[function replaceToolResult(){return {content:[{type:'text',text:'replacement'}],unused:'retained'};}]});
 assert.equal((await tool.runner.emitToolResult({type:'tool_result',content:[],details:{},isError:false})).content[0].text,'replacement');
 assert.equal(tool.records()[0][1].value.value.unused,'retained');
 const boundary=fixture({kind:'turn_end',handlers:[function replaceBoundary(){return {entries:[],continue:true,unused:'retained'};}]});
 assert.equal((await boundary.runner.emitBoundary({type:'turn_end'},async function buildContext(){return [];})).continue,true);
 assert.equal(boundary.records()[0][1].value.value.unused,'retained');
 const bashResult={result:{output:'fixture',exitCode:0,cancelled:false,truncated:false}};
 const bash=fixture({kind:'user_bash',handlers:[function handledBash(){return bashResult;}]});
 assert.equal(await bash.runner.emitUserBash({type:'user_bash',command:'fixture'}),bashResult);
 assert.equal(bash.observation().pending,0);

 // Overlapping original emissions remain pending until each callback settles.
 const pending=Promise.withResolvers();
 const overlapping=fixture({kind:'turn_start',handlers:[function waitForRelease(){return pending.promise;}]});
 const first=overlapping.runner.emit({type:'turn_start'});
 const second=overlapping.runner.emit({type:'turn_start'});
 assert.equal(overlapping.observation().pending,2);
 pending.resolve(undefined);
 await Promise.all([first,second]);
 assert.equal(overlapping.observation().pending,0);
 assert.equal(overlapping.records().length,2);

 // Empty native dispatch retains the same observation and spends no source allowance.
 const empty=fixture({kind:'turn_start',handlers:[]});
 const unchanged=empty.observation();
 await empty.runner.emit({type:'turn_start'});
 assert.equal(empty.observation(),unchanged);
 assert.equal(readNativeSessionInputUsage(empty.manager).count,0);

 // Native observation failures preserve even nullish thrown values after retirement.
 for(const originalFailure of [undefined,null,'failure',new Error('fixture capture failure')]){
  const observer=createNativeEventObserver(function captureFactory(){return {capture(){throw originalFailure;},complete(){}};});
  const extension={path:'fixture'};
  function handler(){}
  const traversal=observer.begin({kind:'turn_start',snapshot:[{ext:extension,handlers:[handler]}]});
  let wrapped;
  try{traversal.before({extension,handler,event:{type:'turn_start'}});}catch(error){wrapped=error;}
  let caught=false;
  try{traversal.aborted(wrapped);}catch(error){caught=true;assert.equal(error,originalFailure);}
  assert.equal(caught,true);
  assert.equal(observer.read(['turn_start']).failed,true);
  assert.equal(observer.read(['turn_start']).pending,0);
 }
 console.log(JSON.stringify({complete:true,nativeEventMethods:6,groupedCallbackPhases:90,groupedSources:1}));
}finally{await env.drain();}
