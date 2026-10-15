import {types} from "node:util";
import {SourceCollectionError} from "../collector.mjs";
import {copyMessageData} from "../run-prompt-custody/messages.mjs";
import {assertManagerMessageContent,assertManagerSystemTools} from "./manager-message-content.mjs";
import {dataField,agentMessageFields,systemInputFields,assertSystemInput,bashInput} from './loaded-fields.mjs';
//region Observe manager frames without replacing their native return or failure.
/** Observe manager frames without replacing their native return or failure. */
export function createLoadedManagerInputs({poolState,InputCaptureError,reserve,retainConstructedInput}){
/** Share frame capture and budgets without accepting an origin declaration from the native input. */
 function captureManagerFrame({
   frame,
   method,
   inputOrigin
 }){
   if(poolState.failure)return;
   try{
    reserve();
    if(types.isProxy(frame)||(!types.isArgumentsObject(frame))
      ||(method!=='appendMessage'))throw new SourceCollectionError('Native manager input requires its original appendMessage frame');
    const message=dataField({
      value:frame,
      key:'0'
    }); const role=dataField({
      value:message,
      key:'role'
    });
    const input={
      carrier:frame,
      inputField:'managerInput',
      inputOrigin
    };
    if(role==='bashExecution'){
     const {
       value,
       metadata
     }=bashInput(message);
     retainConstructedInput({
       ...input,
       value,
       metadata:{
         ...metadata,
         method
       }
     });return;
    }
    if(role==='system'){
     const value=copyMessageData({
       ...systemInputFields(message),
       toolsAdded:dataField({
         value:message,
         key:'toolsAdded'
       }),
       toolsRemoved:dataField({
         value:message,
         key:'toolsRemoved'
       })
     });
     assertSystemInput(value);assertManagerSystemTools(value);
     const inputFields=[
       'content',
       ...[
         'sections',
         'toolsAdded',
         'toolsRemoved'
       ].filter(function hasLoadedInputField(field) { return (value[field]!==undefined); })
     ];
     retainConstructedInput({
       ...input,
       value:inputFields.length===1?value.content:value,
       systemInput:{
         message,
         expected:value
       },
       metadata:{
         role,
         method,
         inputFields
       }
     });return;
    }
    const {
      content,
      ...companions
    }=agentMessageFields(message);
    const copied=copyMessageData({
      content,
      companions
    });assertManagerMessageContent(copied.content);
    retainConstructedInput({
      ...input,
      value:copied.content,
      metadata:{
        ...copied.companions,
        method
      }
    });
   }catch(error){
    poolState.failure=new InputCaptureError(error);
    if(!(error instanceof SourceCollectionError))throw error;
   }
 }
return {
captureInitialManagerInput(input){captureManagerFrame({
    ...input,
    inputOrigin:'native-manager-initial-input'
  });},
captureManagerInput(input){captureManagerFrame({
    ...input,
    inputOrigin:'native-manager-input'
  });}
};
}
//endregion
