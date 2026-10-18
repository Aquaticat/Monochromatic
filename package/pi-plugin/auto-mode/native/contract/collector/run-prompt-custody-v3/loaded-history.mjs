import {SourceCollectionError} from "../collector.mjs";
import {copyMessageData,assertTextMessageContent} from "../run-prompt-custody/messages.mjs";
import {assertManagerMessageContent} from './manager-message-content.mjs';
import {dataField,messageMetadata,systemInputFields,assertSystemInput,bashInput} from './loaded-fields.mjs';
//region Loaded history retains original entry identity.
/** Capture loaded and appended historical inputs through the original pool. */
export function createLoadedHistory({occurrence,reserve,retain,poolState,InputCaptureError}){
function captureSystem({
   carrier,
   message,
   ordinal,
   inputField
 }){
  reserve();
  if(dataField({
    value:message,
    key:'role'
  })!=='system')throw new SourceCollectionError('Loaded system prose requires a native system message');
  // Encode only selected owned prose fields, not saved file bytes or a serialized request.
  const input=copyMessageData(systemInputFields(message));assertSystemInput(input);
  const {sections} = input;
  retain({
    carrier,
    value:sections===undefined?input.content:input,
    ordinal,
    metadata:{
      role:'system',
      inputField,
      inputFields:sections===undefined?['content']:[
        'content',
        'sections'
      ]
    }
  });
 }
function captureSummary({
   entry,
   type,
   ordinal,
   inputOccurrence=occurrence,
   inputOrigin='native-load'
 }){
  reserve();const value=copyMessageData(dataField({
    value:entry,
    key:'summary'
  }));
  if((typeof value)!=='string')throw new SourceCollectionError('Original summary input requires native text');
  retain({
    carrier:entry,
    value,
    metadata:{
      role:type==='compaction'?'compactionSummary':'branchSummary',
      entryType:type
    },
    ordinal,
    inputOccurrence,
    inputOrigin
  });
 }
function captureEdit({
   entry,
   ordinal,
   inputOccurrence=occurrence,
   inputOrigin='native-load'
 }){
  reserve();
  const targetId=dataField({
    value:entry,
    key:'targetId'
  }); const original=dataField({
    value:entry,
    key:'replacement'
  });
  if((typeof targetId)!=='string')throw new SourceCollectionError('Loaded context edits require a native target identifier');
  const replacement=original===null?null:copyMessageData({content:dataField({
    value:original,
    key:'content'
  })});
  if(replacement!==null){
   if(((typeof replacement.content)!=='string')&&(!Array.isArray(replacement.content)))throw new SourceCollectionError('Loaded context edits require native replacement content');
   assertTextMessageContent(replacement.content);
  }
  retain({
    carrier:entry,
    value:{replacement},
    metadata:{
      entryType:'context_edit',
      targetId,
      inputField:'replacement'
    },
    ordinal,
    inputOccurrence,
    inputOrigin
  });
 }
function captureBash({
   entry,
   message,
   ordinal
 }){
  reserve();
  retain({
    carrier:entry,
    ...bashInput(message),
    ordinal
  });
 }
/** Capture initial loaded entries under the same shared budget. */
function captureLoadedEntries(entries){
try{
  for(const [ordinal,entry] of entries.entries()){
   const type=dataField({
     value:entry,
     key:'type'
   });
   if(type==='context_edit'){captureEdit({
     entry,
     ordinal
   });continue;}
   if((type==='compaction')||(type==='branch_summary')){
    captureSummary({
      entry,
      type,
      ordinal
    });
    if(type==='compaction'){
     const companion=dataField({
       value:entry,
       key:'systemMessage'
     });
     if((companion!==undefined)&&(companion!==null))captureSystem({
       carrier:companion,
       message:companion,
       ordinal,
       inputField:'systemMessage'
     });
    }
    continue;
   }
   if((type!=='message')&&(type!=='custom_message'))continue;
   const custom=type==='custom_message';
   const message=custom?entry:dataField({
     value:entry,
     key:'message'
   });
   const role=custom?'custom':dataField({
     value:message,
     key:'role'
   });
   if(!custom){
    if(role==='system'){captureSystem({
      carrier:entry,
      message,
      ordinal,
      inputField:'message'
    });continue;}
    if(role==='bashExecution'){captureBash({
      entry,
      message,
      ordinal
    });continue;}
    if(![
      'user',
      'assistant',
      'toolResult',
      'custom',
      'hookMessage'
    ].includes(role))continue;
   }
   const metadata=messageMetadata({
     role,
     message
   });reserve();
   const value=copyMessageData(dataField({
     value:message,
     key:'content'
   }));assertManagerMessageContent(value);
   retain({
     carrier:entry,
     value,
     metadata,
     ordinal
   });
  }
 }catch(error){poolState.failure=new InputCaptureError(error);}
}
return {captureSummary,captureEdit,captureLoadedEntries};
}
//endregion
