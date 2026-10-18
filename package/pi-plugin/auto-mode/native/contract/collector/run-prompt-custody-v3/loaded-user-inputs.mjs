import {types} from "node:util";
import {SourceCollectionError} from "../collector.mjs";
import {copyMessageData,assertTextMessageContent} from "../run-prompt-custody/messages.mjs";
import {dataField,messageMetadata} from './loaded-fields.mjs';
//region Retain original queued, command, and transformed user-input occurrences.
/** Retain original queued, command, and transformed user-input occurrences. */
export function createLoadedUserInputs({poolState,InputCaptureError,reserve,retainConstructedInput}){

function captureQueuedInput({
    message,
    text,
    delivery
  }){
   if(poolState.failure)return;
   try{
    reserve();
    if((![
      'steer',
      'followUp'
    ].includes(delivery))||((typeof text)!=='string')
      ||(dataField({
        value:message,
        key:'role'
      })!=='user'))throw new SourceCollectionError('Queued input requires its native delivery, user construction and text');
    retainConstructedInput({
      carrier:message,
      value:copyMessageData(text),
      metadata:{
        role:'user',
        delivery
      },
      inputField:'queuedMessages',
      inputOrigin:'native-queue'
    });
   }catch(error){poolState.failure=new InputCaptureError(error);}
  }
function captureUninterceptedInput({
    input,
    source,
    streamingBehavior
  }){
   if(poolState.failure)return;
   try{
    reserve();const value=dataField({
      value:input,
      key:'text'
    });
    if((typeof value)!=='string')throw new SourceCollectionError('Native unintercepted input requires original text');
    const metadata=copyMessageData({
      source,
      streamingBehavior
    });
    retainConstructedInput({
      carrier:input,
      value,
      metadata,
      inputField:'uninterceptedInput',
      inputOrigin:'native-unintercepted-input'
    });
   }catch(error){poolState.failure=new InputCaptureError(error);}
  }
function captureCallInput({
    frame,
    method
  }){
   if(poolState.failure)return;
   try{
    reserve();
    if(types.isProxy(frame)||(!types.isArgumentsObject(frame))
      ||(![
        'prompt',
        'steer',
        'followUp'
      ].includes(method)))throw new SourceCollectionError('Native call input requires its original arguments frame and supported method');
    const value=dataField({
      value:frame,
      key:'0'
    });
    if((typeof value)!=='string')throw new SourceCollectionError('Native call input requires original text');
    retainConstructedInput({
      carrier:frame,
      value,
      metadata:{method},
      inputField:'callInput',
      inputOrigin:'native-call-input'
    });
   }catch(error){
    poolState.failure=new InputCaptureError(error);
    // Capture failure is retained in the pool and enforced only by automatic assessment readers.
   }
  }
function captureCommandInput({
    context,
    text,
    commandName
  }){
   if(poolState.failure)return;
   try{
    reserve();
    if(((typeof text)!=='string')||((typeof commandName)!=='string'))throw new SourceCollectionError('Native command input requires original text and parsed command name');
    retainConstructedInput({
      carrier:context,
      value:text,
      metadata:{commandName},
      inputField:'commandInput',
      inputOrigin:'native-command-input'
    });
   }catch(error){
    poolState.failure=new InputCaptureError(error);
    // Capture failure is retained in the pool and enforced only by automatic assessment readers.
   }
  }
function captureTransformedInput({
    input,
    source,
    streamingBehavior
  }){
   if(poolState.failure)return;
   try{
    reserve();const value=dataField({
      value:input,
      key:'text'
    });
    if((typeof value)!=='string')throw new SourceCollectionError('Native transformed input requires original text');
    const metadata=copyMessageData({
      source,
      streamingBehavior
    });
    retainConstructedInput({
      carrier:input,
      value,
      metadata,
      inputField:'transformedInput',
      inputOrigin:'native-transformed-input'
    });
   }catch(error){poolState.failure=new InputCaptureError(error);}
  }
function captureInputEvent(event){
   if(poolState.failure)return;
   try{
    reserve();
    if(dataField({
      value:event,
      key:'type'
    })!=='input')throw new SourceCollectionError('Input event requires its native construction');
    const value=dataField({
      value:event,
      key:'text'
    });
    if((typeof value)!=='string')throw new SourceCollectionError('Native input event requires original text');
    const metadata=copyMessageData({
      source:dataField({
        value:event,
        key:'source'
      }),
      streamingBehavior:dataField({
        value:event,
        key:'streamingBehavior'
      })
    });
    retainConstructedInput({
      carrier:event,
      value,
      metadata,
      inputField:'inputEvent',
      inputOrigin:'native-input-event'
    });
   }catch(error){poolState.failure=new InputCaptureError(error);}
  }
function captureCustomMessageInput(message){
   if(poolState.failure)return;
   try{
    reserve();
    if(dataField({
      value:message,
      key:'role'
    })!=='custom')throw new SourceCollectionError('Custom message input requires its native custom construction');
    const metadata=messageMetadata({
      role:'custom',
      message
    }); const value=copyMessageData(dataField({
      value:message,
      key:'content'
    }));assertTextMessageContent(value);
    retainConstructedInput({
      carrier:message,
      value,
      metadata,
      inputField:'customMessage',
      inputOrigin:'native-custom-construction'
    });
   }catch(error){poolState.failure=new InputCaptureError(error);}
  }
return {
captureQueuedInput,
captureUninterceptedInput,
captureCallInput,
captureCommandInput,
captureTransformedInput,
captureInputEvent,
captureCustomMessageInput
};
}
//endregion
