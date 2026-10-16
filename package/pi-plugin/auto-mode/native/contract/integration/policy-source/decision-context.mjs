import {createHash} from 'node:crypto';
import {buildVisibleContext} from '../maintained-policy.mjs';
import {sessionEntryToContextMessages} from '../native-batch/generated/session-manager.mjs';
import {captureDecisionMaterial} from './decision-material.mjs';

//region Current policy and visible conversation are selected before semantic candidates.
/** Retained callback receipts authenticate inputs locally; they are not additional current instructions. */
export function captureDecisionContext({snapshot,session,input}){
 const content=session?buildVisibleContext({
   entries:session.sessionManager.buildContextEntries(),
   project:sessionEntryToContextMessages
 }):'';
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
   ...snapshot.contextPromptInputs.filter(function independentContext(source){return source.carrier===undefined;}),
   ...(conversation?[conversation]:[])
 ]);
 const selection=input?.parsePolicy?captureDecisionMaterial({sources,input}):undefined;
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
