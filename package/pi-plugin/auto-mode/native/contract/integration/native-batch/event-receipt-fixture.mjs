import assert from 'node:assert/strict';
import {createEnvironment} from './environment.mjs';
import {
  ExtensionRunner,
  readNativeRunnerDomainEvents
} from './generated/event-runner.mjs';
import {
  assertNativeSessionInputCapture,
  readNativeConstructedInputOrigins
} from './generated/session-manager.mjs';
import {
  createNativeEventObserver
} from './event-observer.ts';

export const env=await createEnvironment();
export function fixture({
  kind,
  handlers
}){
 const manager=env.SessionManager
   .inMemory(env.options
     .cwd);
 const extension={
   path:'fixture-extension',
   handlers:new Map([[
     kind,
     handlers
   ]])
 };
 const runner=new ExtensionRunner(
   [extension],
   {},
   env.options
     .cwd,
   manager,
   {}
 );
 const errors=[];
 runner.onError(function retainNativeError(error){errors.push(error);});
 function observation(){return readNativeRunnerDomainEvents({
   runner,
   kinds:[kind]
 });}
 function records(){
  assertNativeSessionInputCapture(manager);
  return readNativeConstructedInputOrigins(manager)
    .filter(function eventSource(origin){return origin.source
      .inputOrigin
      ==='native-event-handler';})
    .map(function readEmission(origin){return JSON.parse(origin.source
      .content);});
 }
 return {
   manager,
   runner,
   errors,
   observation,
   records
 };
}

export function traversalFixture(){
 const phases=[];
 const observer=createNativeEventObserver(function captureFactory(){return {
   capture(input){phases.push(input.phase);},
   complete(){return undefined;}
 };});
 const extension={path:'fixture'};
 function handler(){return undefined;}
 const traversal=observer.begin({
   kind:'turn_start',
   snapshot:[{
     ext:extension,
     handlers:[handler]
   }]
 });
 const input={
   extension,
   handler,
   event:{type:'turn_start'}
 };
 return {
   phases,
   observer,
   traversal,
   input
 };
}
