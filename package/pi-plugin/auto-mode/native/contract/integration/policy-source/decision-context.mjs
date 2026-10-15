import {createHash} from 'node:crypto';
import {buildVisibleContext} from '../maintained-policy.mjs';
import {sessionEntryToContextMessages} from '../native-batch/generated/session-manager.mjs';

//region Current policy and visible conversation are selected before semantic candidates.
/** Retained callback receipts authenticate inputs locally; they are not additional current instructions. */
export function captureDecisionContext({snapshot,session}){
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
   ...(snapshot.hostPromptInput?[snapshot.hostPromptInput]:[]),
   ...(snapshot.resourceSystemInput?[snapshot.resourceSystemInput]:[]),
   ...snapshot.appendPromptInputs,
   ...snapshot.contextPromptInputs.filter(function independentContext(source){return source.carrier===undefined;}),
   ...(snapshot.forcedPromptInput?[snapshot.forcedPromptInput]:[]),
   ...(snapshot.promptGuidelineInputs??[]),
   ...(snapshot.toolGuidelineInputs??[]),
   ...(snapshot.skillDescriptionInputs??[]),
   ...(snapshot.builtInPromptInputs??[]),
   ...(conversation?[conversation]:[])
 ]);
 return Object.freeze({sources,conversation});
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
