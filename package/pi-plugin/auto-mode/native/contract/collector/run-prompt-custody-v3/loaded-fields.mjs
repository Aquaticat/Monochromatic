import {types} from "node:util";
import {SourceCollectionError} from "../collector.mjs";
import {copyMessageData,assertTextMessageContent} from "../run-prompt-custody/messages.mjs";
//region Selected native fields avoid accessors and opaque companion data.
/** Observe native data fields without adding reads of accessors or proxy traps. */
export function dataField({
  value,
  key
}){
 if((!value)||((typeof value)!=='object')
   ||types.isProxy(value)
   ||(Object.getPrototypeOf(value)!==Object.prototype))throw new SourceCollectionError('Loaded session inputs require ordinary owned records');
 const field=Object.getOwnPropertyDescriptor(
   value,
   key
 );
 if(field&&((!field.enumerable)||(!Object.hasOwn(
   field,
   'value'
 ))))throw new SourceCollectionError('Loaded session inputs require native data properties');
 return field?.value;
}
/** Select companion data without inspecting opaque provider or tool records. */
export function selectedMessageMetadata({
  role,
  message
}){
 if((role==='custom')||(role==='hookMessage'))return {
   role,
   customType:dataField({
     value:message,
     key:'customType'
   }),
   display:dataField({
     value:message,
     key:'display'
   })
 };
 if(role==='toolResult')return {
   role,
   toolName:dataField({
     value:message,
     key:'toolName'
   }),
   toolCallId:dataField({
     value:message,
     key:'toolCallId'
   }),
   isError:dataField({
     value:message,
     key:'isError'
   })
 };
 return {role};
}
/** Validate selected companions under the incumbent ordinary-tree profile. */
export function messageMetadata(input){return copyMessageData(selectedMessageMetadata(input));}
/** Keep message content and its distinguishing companions, not a copy of the complete native message. */
export function agentMessageFields(message){
 const role=dataField({
   value:message,
   key:'role'
 });
 if(![
   'user',
   'custom',
   'assistant',
   'toolResult',
   'hookMessage'
 ].includes(role))throw new SourceCollectionError('Native Agent input requires a supported text-message role');
 return {
   ...selectedMessageMetadata({
     role,
     message
   }),
   content:dataField({
     value:message,
     key:'content'
   })
 };
}
/** Select native system prose without inspecting tool declarations or treating the role as authority. */
export function systemInputFields(message){
 return {
   content:dataField({
     value:message,
     key:'content'
   }),
   sections:dataField({
     value:message,
     key:'sections'
   })
 };
}
/** Apply the incumbent loaded-system text and nullable-section profile after ordinary data copying. */
export function assertSystemInput(input){
 assertTextMessageContent(input.content);
 const {sections} = input;
 if((sections!==undefined)&&(sections!==null)
   &&(((typeof sections)!=='object')
     ||Array.isArray(sections)
     ||Object.values(sections)
     .some(function isUnsupportedScalar(value) { return ((value!==null)&&((typeof value)!=='string')); })))throw new SourceCollectionError('Loaded system sections require named text or null values');
}
/** One prompt-call array shares one copier budget; borrowed arrays and messages receive no publication or mutation. */
export function agentPromptArray(message){
 const length=Object.getOwnPropertyDescriptor(
   message,
   'length'
 )
   ?.value;
 if((Object.getPrototypeOf(message)!==Array.prototype)||(!Number.isSafeInteger(length))
   ||(length<0)
   ||(length>4_096)
   ||(Reflect.ownKeys(message)
     .length
     !==(length
     +1)))throw new SourceCollectionError('Native Agent prompt requires a bounded dense message array');
 const selected=[];
 for(let index=0;index<length;index++){
  const field=Object.getOwnPropertyDescriptor(
    message,
    String(index)
  );
  if((!field?.enumerable)||(!Object.hasOwn(
    field,
    'value'
  )))throw new SourceCollectionError('Native Agent prompt array requires native data entries');
  const entry=field.value;
  selected.push(dataField({
    value:entry,
    key:'role'
  })==='system'?{
    role:'system',
    ...systemInputFields(entry)
  }:agentMessageFields(entry));
 }
 const value=copyMessageData(selected);
 for(const entry of value){if(entry.role==='system')assertSystemInput(entry);else assertTextMessageContent(entry.content);}
 return value;
}
/** Select bash prose and its existing companions without establishing an execution fact. */
export function bashInput(message){
 const {
   command,
   output,
   ...metadata
 }=copyMessageData({
   role:'bashExecution',
   command:dataField({
     value:message,
     key:'command'
   }),
   output:dataField({
     value:message,
     key:'output'
   }),
   exitCode:dataField({
     value:message,
     key:'exitCode'
   }),
   cancelled:dataField({
     value:message,
     key:'cancelled'
   }),
   truncated:dataField({
     value:message,
     key:'truncated'
   }),
   fullOutputPath:dataField({
     value:message,
     key:'fullOutputPath'
   }),
   excludeFromContext:dataField({
     value:message,
     key:'excludeFromContext'
   })
 });
 if(((typeof command)!=='string')||((typeof output)!=='string'))throw new SourceCollectionError('Loaded bash inputs require native command and output text');
 return {
   value:{
     command,
     output
   },
   metadata
 };
}
//endregion
