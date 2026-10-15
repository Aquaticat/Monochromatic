import {types} from "node:util";
import {SourceCollectionError} from "../collector.mjs";
import {copyMessageData,assertTextMessageContent} from "../run-prompt-custody/messages.mjs";
import {snapshotToolMetadata} from "./tool-metadata.mjs";
import {dataField,agentMessageFields,systemInputFields,assertSystemInput,agentPromptArray} from './loaded-fields.mjs';
//region Select supported native Agent inputs without copying opaque provider records.
/** Select supported native Agent inputs without copying opaque provider records. */
export function createLoadedAgentInputs({poolState,InputCaptureError,reserve,retainConstructedInput}){

function captureAgentInput({
    frame,
    method
  }){
   if(poolState.failure)return;
   try{
    reserve();
    if(types.isProxy(frame)||(!types.isArgumentsObject(frame))
      ||(![
        'steer',
        'followUp',
        'prompt',
        'state.messages',
        'state.tools'
      ].includes(method)))throw new SourceCollectionError('Native Agent input requires its original observed call frame');
    const message=dataField({
      value:frame,
      key:'0'
    });
    if(method==='state.tools'){
     const {
       value,
       metadata
     }=snapshotToolMetadata(message);
     retainConstructedInput({
       carrier:frame,
       value,
       metadata:{
         ...metadata,
         method
       },
       inputField:'agentInput',
       inputOrigin:'native-agent-input',
       kind:'native-tool-description-input'
     });return;
    }
    if(method==='state.messages'){
     if(types.isProxy(message)||(!Array.isArray(message)))throw new SourceCollectionError('Native Agent state assignment requires its original message array');
     retainConstructedInput({
       carrier:frame,
       value:agentPromptArray(message),
       metadata:{method},
       inputField:'agentInput',
       inputOrigin:'native-agent-input'
     });return;
    }
    if(method==='prompt'){
     if((typeof message)==='string'){
      retainConstructedInput({
        carrier:frame,
        value:message,
        metadata:{method},
        inputField:'agentInput',
        inputOrigin:'native-agent-input'
      });return;
     }
     if(types.isProxy(message))throw new SourceCollectionError('Loaded session inputs require ordinary owned records');
     if(Array.isArray(message)){
      retainConstructedInput({
        carrier:frame,
        value:agentPromptArray(message),
        metadata:{method},
        inputField:'agentInput',
        inputOrigin:'native-agent-input'
      });return;
     }
     if(dataField({
       value:message,
       key:'role'
     })==='system'){
      const value=copyMessageData(systemInputFields(message));assertSystemInput(value);
      retainConstructedInput({
        carrier:frame,
        value:value.sections===undefined?value.content:value,
        metadata:{
          role:'system',
          method,
          inputFields:value.sections===undefined?['content']:[
            'content',
            'sections'
          ]
        },
        inputField:'agentInput',
        inputOrigin:'native-agent-input'
      });return;
     }
    }
    const {
      content,
      ...companions
    }=agentMessageFields(message);
    const metadata={
      ...copyMessageData(companions),
      method
    };
      const value=copyMessageData(content);assertTextMessageContent(value);
    retainConstructedInput({
      carrier:frame,
      value,
      metadata,
      inputField:'agentInput',
      inputOrigin:'native-agent-input'
    });
   }catch(error){
    poolState.failure=new InputCaptureError(error);
    if(!(error instanceof SourceCollectionError))throw error;
   }
  }
return {
captureAgentInput
};
}
//endregion
