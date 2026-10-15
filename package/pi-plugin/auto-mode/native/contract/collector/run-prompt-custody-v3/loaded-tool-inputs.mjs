import {types} from "node:util";
import {SourceCollectionError} from "../collector.mjs";
import {copyMessageData,copyToolMetadata} from "../run-prompt-custody/messages.mjs";
import {snapshotToolMetadata} from "./tool-metadata.mjs";
import {snapshotToolLoadoutInput} from "./tool-loadout-input.mjs";
import {dataField} from './loaded-fields.mjs';
//region Retain tool registration and loadout observations at native call boundaries.
/** Retain tool registration and loadout observations at native call boundaries. */
export function createLoadedToolInputs({poolState,InputCaptureError,reserve,retainConstructedInput}){

return {
captureToolLoadoutQuery({
    frame,
    phase='output'
  }){
   if(poolState.failure)return;
   try{
    if(types.isProxy(frame)||(!types.isArgumentsObject(frame))
      ||(Object.getOwnPropertyDescriptor(
        frame,
        'length'
      )
        ?.value
        !==1))throw new SourceCollectionError('Tool metadata query requires its original one-argument observation frame');
    if(![
      'input',
      'output'
    ].includes(phase))throw new SourceCollectionError('Tool metadata query requires its native input or output phase');
    reserve();const input=dataField({
      value:frame,
      key:'0'
    }); const method=dataField({
      value:input,
      key:'method'
    });
    if(![
      'getExposure',
      'getNamespace',
      'getPromptGuidelines'
    ].includes(method))throw new SourceCollectionError('Tool metadata query is outside the supported native lookup profile');
    const name=dataField({
      value:input,
      key:'name'
    });
      const additionalArguments=dataField({
      value:input,
      key:'additionalArguments'
    });
      const result=phase==='output'?dataField({
      value:input,
      key:'value'
    }):undefined;
    const value=copyToolMetadata(phase==='input'?{
      name,
      additionalArguments
    }:{
      name,
      additionalArguments,
      value:result
    });
    retainConstructedInput({
      carrier:frame,
      value,
      metadata:{
        method:'prepareLoadout',
        phase:'query',
        queryMethod:method,
        queryPhase:phase,
        ...(phase==='output'?{valueKind:result===undefined?'undefined':'value'}:{})
      },
      inputField:'toolLoadoutQuery',
      inputOrigin:'native-tool-loadout-query',
      kind:'native-tool-loadout-query-input'
    });
   }catch(error){
    poolState.failure=new InputCaptureError(error);
    if(types.isProxy(error)||(!(error instanceof SourceCollectionError)))throw error;
   }
  },
captureToolLoadoutInput({frame}){
   if(poolState.failure)return;
   try{
    if(types.isProxy(frame)||(!types.isArgumentsObject(frame))
      ||(Object.getOwnPropertyDescriptor(
        frame,
        'length'
      )
        ?.value
        !==1))throw new SourceCollectionError('Tool loadout input requires its original one-argument observation frame');
    reserve();const input=dataField({
      value:frame,
      key:'0'
    }); const {
      value,
      metadata
    }=snapshotToolLoadoutInput(dataField({
      value:input,
      key:'input'
    }));
    retainConstructedInput({
      carrier:frame,
      value,
      metadata,
      inputField:'toolLoadoutInput',
      inputOrigin:'native-tool-loadout-input',
      kind:'native-tool-loadout-input'
    });
   }catch(error){
    poolState.failure=new InputCaptureError(error);
    if(types.isProxy(error)||(!(error instanceof SourceCollectionError)))throw error;
   }
  },
captureToolLoadoutOutput({frame}){
   if(poolState.failure)return;
   try{
    if(types.isProxy(frame)||(!types.isArgumentsObject(frame))
      ||(Object.getOwnPropertyDescriptor(
        frame,
        'length'
      )
        ?.value
        !==1))throw new SourceCollectionError('Tool loadout output requires its original one-argument observation frame');
    const input=dataField({
      value:frame,
      key:'0'
    });
      const output=dataField({
      value:input,
      key:'output'
    });
    if(output===undefined)return;
    reserve();const value=copyMessageData(output);
    if((!value)||Array.isArray(value)
      ||((typeof value)!=='object'))throw new SourceCollectionError('Tool loadout output requires an ordinary changes record');
    retainConstructedInput({
      carrier:frame,
      value,
      metadata:{
        method:'prepareLoadout',
        phase:'output'
      },
      inputField:'toolLoadoutOutput',
      inputOrigin:'native-tool-loadout-output',
      kind:'native-tool-loadout-output'
    });
   }catch(error){
    poolState.failure=new InputCaptureError(error);
    if(types.isProxy(error)||(!(error instanceof SourceCollectionError)))throw error;
   }
  },
captureExtensionToolInput({frame}){
   if(poolState.failure)return;
   try{
    reserve();
    if(types.isProxy(frame)||(!types.isArgumentsObject(frame))
      ||(Object.getOwnPropertyDescriptor(
        frame,
        'length'
      )
        ?.value
        !==1))throw new SourceCollectionError('Extension tool registration requires its original one-argument frame');
    const tool=dataField({
      value:frame,
      key:'0'
    }); const {
      value,
      metadata
    }=snapshotToolMetadata([tool]);
    retainConstructedInput({
      carrier:frame,
      value,
      metadata:{
        ...metadata,
        method:'registerTool'
      },
      inputField:'extensionTool',
      inputOrigin:'native-extension-register-tool',
      kind:'native-resource-tool-input'
    });
   }catch(error){
    poolState.failure=new InputCaptureError(error);
    if(!(error instanceof SourceCollectionError))throw error;
   }
  },
captureCustomToolDescriptions({frame}){
   if(poolState.failure)return;
   try{
    if(types.isProxy(frame)||(!types.isArgumentsObject(frame)))throw new SourceCollectionError('Native custom tool descriptions require the original Session constructor frame');
    const config=dataField({
      value:frame,
      key:'0'
    }); const tools=dataField({
      value:config,
      key:'customTools'
    });
    if(tools===undefined)return;
    reserve();
    const {
      value,
      metadata
    }=snapshotToolMetadata(tools);
    retainConstructedInput({
      carrier:frame,
      value,
      metadata,
      inputField:'customTools',
      inputOrigin:'native-session-constructor-tools',
      kind:'native-tool-description-input'
    });
   }catch(error){
    poolState.failure=new InputCaptureError(error);
    if(!(error instanceof SourceCollectionError))throw error;
   }
  }
};
}
//endregion
