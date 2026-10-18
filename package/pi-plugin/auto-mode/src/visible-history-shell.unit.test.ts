/** Earlier incomplete shell records remain context data without weakening current operation review. @module */
import {describe,expect,it} from '@monochromatic-dev/module-test/ts';
import {buildVisibleContext} from '../dist/final/node/index.mjs';
import {projectReviewInput} from '../dist/final/node/native-policy.mjs';
import {contextFromBranch,assistantToolCall,userMessage} from './visible-context-fixture.ts';

/** Partial source represents the interrupted provider response without executing any command. */
const partial="printf 'UNFINISHED_HISTORY";

await describe({name:'historical shell context',children:[
 it({
  name:'keeps aborted partial Bash and subsequent user input without exporting raw command source',
  fn:async function retainAbortedHistory():Promise<void>{
   /** Real host projection receives the same aborted-message shape as the retained RPC incident. */
   const context=buildVisibleContext(contextFromBranch({branch:[
    userMessage('Original request before interruption'),
    {type:'message',message:{role:'assistant',stopReason:'aborted',errorMessage:'Request was aborted',content:[
     {type:'toolCall',id:'partial-call',name:'bash',arguments:{command:partial,timeout:17}}
    ]}},
    userMessage('Inspect the policy-input files now')
   ]}));
   expect(context).toContain('"syntax":"unavailable"');
   expect(context).toContain('"effects":"not-established"');
   expect(context).toContain('"timeout":17');
   expect(context).toContain('"stopReason":"aborted"');
   expect(context).toContain('Request was aborted');
   expect(context).toContain('Inspect the policy-input files now');
   expect(context).not.toContain(partial);
  }
 }),
 it({
  name:'retains historical Bash options when its command field was never completed',
  fn:async function retainMissingHistoricalCommand():Promise<void>{
   /** Missing command is valid historical partial tool data, not an executable proposal. */
   const context=buildVisibleContext(contextFromBranch({branch:[
    assistantToolCall({name:'bash',args:{timeout:23}})
   ]}));
   expect(context).toContain('"reason":"command-not-available"');
   expect(context).toContain('"timeout":23');
  }
 }),
 it({
  name:'preserves incomplete historical process-start metadata without raw source',
  fn:async function retainHistoricalProcessStart():Promise<void>{
   /** Process-start uses the same historical syntax boundary as Bash. */
   const context=buildVisibleContext(contextFromBranch({branch:[
    assistantToolCall({name:'process',args:{action:'start',command:partial,cwd:'retained-history-root',name:'retained-job'}})
   ]}));
   expect(context).toContain('"syntax":"unavailable"');
   expect(context).toContain('retained-history-root');
   expect(context).toContain('retained-job');
   expect(context).not.toContain(partial);
  }
 }),
 it({
  name:'preserves failed direct Bash activity output and cancellation metadata',
  fn:async function retainDirectBashFailure():Promise<void>{
   /** Interactive Bash history can contain syntax errors which were visible to the human. */
   const context=buildVisibleContext(contextFromBranch({branch:[
    {type:'message',message:{role:'bashExecution',command:partial,output:'Original parser rejection',exitCode:2,cancelled:false,truncated:false}}
   ]}));
   expect(context).toContain('"syntax":"unavailable"');
   expect(context).toContain('Original parser rejection');
   expect(context).toContain('"exitCode":2');
   expect(context).toContain('"cancelled":false');
   expect(context).not.toContain(partial);
  }
 }),
 it({
  name:'keeps valid historical shell structure and unrelated command-looking tool data',
  fn:async function retainValidStructureAndLiteralData():Promise<void>{
   /** Valid history still retains complete syntax while arbitrary tool arguments remain literal data. */
   const context=buildVisibleContext(contextFromBranch({branch:[
    assistantToolCall({name:'bash',args:{command:'printf HISTORICAL_LITERAL | cat'}}),
    assistantToolCall({name:'fixture-data',args:{command:partial}})
   ]}));
   expect(context).toContain('"language":"bash"');
   expect(context).toContain('HISTORICAL_LITERAL');
   expect(context).toContain(partial);
   expect(context).not.toContain('"syntax":"unavailable"');
  }
 }),
 it({
  name:'rejects incomplete current Bash and process-start proposals while accepting valid current syntax',
  fn:async function preserveStrictCurrentOperation():Promise<void>{
   /** Successful strict control proves that malformed checks exercise the actual exported operation projector. */
   const current=projectReviewInput({name:'bash',input:{command:'printf CURRENT_LITERAL'}});
   expect(current).toHaveProperty('shell.language','bash');
   expect(current).toHaveProperty('shell.syntax.type','Script');
   expect(function rejectCurrentBash(){
    projectReviewInput({name:'bash',input:{command:partial}});
   })
    .toThrow('complete parsed operation');
   expect(function rejectCurrentProcess(){
    projectReviewInput({name:'process',input:{action:'start',command:partial}});
   })
    .toThrow('complete parsed operation');
   expect(function rejectMissingCurrentCommand(){
    projectReviewInput({name:'bash',input:{timeout:23}});
   })
    .toThrow('no command string');
  }
 }),
 it({
  name:'propagates an unrelated context failure instead of disguising it as unavailable shell syntax',
  fn:async function preserveUnexpectedFailure():Promise<void>{
   /** First-read failure would be hidden by an indiscriminate recovery catch. */
   const reads={command:0};
   /** Owned fixture error must retain its original failure boundary. */
   const failure=new Error('Original context getter failure');
   /** Second read is ordinary data so a broad-catch mutant cannot fail for the same incidental getter. */
   const input={get command():string{
    reads.command+=1;
    if(reads.command===1)throw failure;
    return 'printf SECOND_READ';
   }};
   expect(function projectUnexpectedFailure(){
    buildVisibleContext(contextFromBranch({branch:[assistantToolCall({name:'bash',args:input})]}));
   }).toThrow('Original context getter failure');
   expect(reads.command).toBe(1);
  }
 })
]});
