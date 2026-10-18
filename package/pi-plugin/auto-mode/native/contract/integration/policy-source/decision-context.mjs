import {createHash} from 'node:crypto';
import {buildVisibleContext} from '../maintained-policy.mjs';
import {sessionEntryToContextMessages} from '../native-batch/generated/session-manager.mjs';

//region Current policy and visible conversation are selected before semantic candidates.
/** A transcript copy of the complete governing file uses the same selected-excerpt boundary. */
function omitCompletePolicyCopies({content,policy}){
 if(content==='')return content;
 const complete=policy.content.trimEnd();
 if(complete==='')return content;
 const projected=JSON.parse(content,function selectedPolicyReference(_key,value){
  return typeof value==='string'?value.replaceAll(complete,'[Project policy content is represented by the selected original rule excerpts.]'):value;
 });
 return JSON.stringify(projected);
}
/** Retained callback receipts authenticate inputs locally; they are not additional current instructions. */
export function captureDecisionContext({snapshot,session,input}){
 const visible=session?buildVisibleContext({
   entries:session.sessionManager.buildContextEntries(),
   project:sessionEntryToContextMessages
 }):'';
 const content=omitCompletePolicyCopies({content:visible,policy:snapshot.hostGoverningPolicy});
 const conversation=content===''?undefined:Object.freeze({
   kind:'native-visible-conversation',
   content,
   sha256:createHash('sha256').update(content).digest('hex'),
   occurrence:Object.freeze({}),
   inputLocation:Object.freeze({field:'visibleConversation'}),
   permission:false
 });
 const sources=Object.freeze([
   snapshot.hostGoverningPolicy,
   ...(snapshot.readablePolicySources??[]),
   ...(conversation?[conversation]:[])
 ]);
 const original=input?.decisionSelection;
 const selection=original?.material?Object.freeze({
  ...original,
  material:Object.freeze([...original.material,...(conversation?[Object.freeze({sourceOrdinal:sources.length-1,content:conversation.content})]:[])])
 }):original;
 return Object.freeze({sources,conversation,selection});
}

/** The collector owns this projection; conversation content does not acquire instruction authority from a saved role. */
export function bindDecisionConversation(governing){
 const source=governing.view.sources.decisionContext?.conversation;
 if(!source)return undefined;
 const view=Object.freeze({
   kind:'original-visible-conversation-view',
   source,
   sourceOccurrence:source.occurrence,
   request:governing.view.request,
   permission:false
 });
 function assertCurrent(value){
   if(value!==view)throw new Error('Visible conversation must retain its original collector binding');
   governing.assertCurrent(governing.view);
 }
 return Object.freeze({view,assertCurrent,assertBindingIdentity:assertCurrent});
}
//endregion Current decision context
