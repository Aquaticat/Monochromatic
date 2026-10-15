import assert from 'node:assert/strict';
import {fixture} from './event-receipt-fixture.mjs';
import {readNativeSessionInputUsage} from './generated/session-manager.mjs';

//region Preserve the original native event assertions and their fixture-owned observations.
export async function verifyEventMethods(){
 // Dedicated native message, tool-result, boundary, and Bash return branches remain reachable.
 const message=fixture({
   kind:'message_end',
   handlers:[function replaceMessage(){return {
     message:{
       role:'assistant',
       content:'replacement'
     },
     unused:'retained'
   };}]
 });
 assert.equal(
   (await message.runner
     .emitMessageEnd({
       type:'message_end',
       message:{
         role:'assistant',
         content:'original'
       }
     })).content,
   'replacement'
 );
 assert.equal(
   message.records()[0][1]
     .value
     .value
     .unused,
   'retained'
 );
 const tool=fixture({
   kind:'tool_result',
   handlers:[function replaceToolResult(){return {
     content:[{
       type:'text',
       text:'replacement'
     }],
     unused:'retained'
   };}]
 });
 assert.equal(
   (await tool.runner
     .emitToolResult({
       type:'tool_result',
       content:[],
       details:{},
       isError:false
     })).content[0]
     .text,
   'replacement'
 );
 assert.equal(
   tool.records()[0][1]
     .value
     .value
     .unused,
   'retained'
 );
 const boundary=fixture({
   kind:'turn_end',
   handlers:[function replaceBoundary(){return {
     entries:[],
     continue:true,
     unused:'retained'
   };}]
 });
 assert.equal(
   (await boundary.runner
     .emitBoundary(
       {type:'turn_end'},
       async function buildContext(){return [];}
     )).continue,
   true
 );
 assert.equal(
   boundary.records()[0][1]
     .value
     .value
     .unused,
   'retained'
 );
 const bashResult={result:{
   output:'fixture',
   exitCode:0,
   cancelled:false,
   truncated:false
 }};
 const bash=fixture({
   kind:'user_bash',
   handlers:[function handledBash(){return bashResult;}]
 });
 assert.equal(
   await bash.runner
     .emitUserBash({
       type:'user_bash',
       command:'fixture'
     }),
   bashResult
 );
 assert.equal(
   bash.observation()
     .pending,
   0
 );

 // Overlapping original emissions remain pending until each callback settles.
 const pending=Promise.withResolvers();
 const overlapping=fixture({
   kind:'turn_start',
   handlers:[function waitForRelease(){return pending.promise;}]
 });
 const first=overlapping.runner
   .emit({type:'turn_start'});
 const second=overlapping.runner
   .emit({type:'turn_start'});
 assert.equal(
   overlapping.observation()
     .pending,
   2
 );
 pending.resolve(undefined);
 await Promise.all([
   first,
   second
 ]);
 assert.equal(
   overlapping.observation()
     .pending,
   0
 );
 assert.equal(
   overlapping.records()
     .length,
   2
 );

 // Empty native dispatch retains the same observation and spends no source allowance.
 const empty=fixture({
   kind:'turn_start',
   handlers:[]
 });
 const unchanged=empty.observation();
 await empty.runner
   .emit({type:'turn_start'});
 assert.equal(
   empty.observation(),
   unchanged
 );
 assert.equal(
   readNativeSessionInputUsage(empty.manager)
     .count,
   0
 );

}
//endregion
