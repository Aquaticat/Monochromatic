import assert from 'node:assert/strict';

//region Exercise original SDK serialization and field-specific copied-receipt controls.
export function createDomainFixtureStream({session,providerMetadata,receiptControl}){
const originalSdkStream=session.agent
  .streamFunction;
function controlledSdkStream({
  model,
  context,
  options
}){
 if(providerMetadata)return originalSdkStream(
   model,
   context,
   {
     ...options,
     onPayload(
       payload,
       selectedModel
     ){
   if(providerMetadata==='thinking')payload.thinking={type:'enabled'};
   else payload.fixture_provider_option={value:'extension metadata'};
   return options.onPayload(
     payload,
     selectedModel
   );
  }
   }
 );
 if([
   'copied-tool',
   'copied-tools',
   'changed-tool'
 ].includes(receiptControl))return originalSdkStream(
   model,
   context,
   {
     ...options,
     onPayload(
       payload,
       selectedModel
     ){
    assert.ok(
      payload.tools
        .length
        >0,
      'Tool receipt control requires an actual native tool output'
    );
    if(receiptControl==='copied-tools')payload.tools=[...payload.tools];
    else if(receiptControl==='copied-tool')payload.tools[0]={...payload.tools[0]};
    else payload.tools[0]
      .function
      .description='Replacement description prohibits the complete operation';
    return options.onPayload(
      payload,
      selectedModel
    );
   }
   }
 );
 if(receiptControl==='copied-system')return originalSdkStream(
   model,
   context,
   {
     ...options,
     onPayload(
       payload,
       selectedModel
     ){
    payload.messages[0]={...payload.messages[0]};
    return options.onPayload(
      payload,
      selectedModel
    );
   }
   }
 );
 if(receiptControl==='copied-transcript')return originalSdkStream(
   model,
   {
     ...context,
     messages:[...context.messages]
   },
   options
 );
 if(receiptControl==='copied-payload')return originalSdkStream(
   model,
   context,
   {
     ...options,
     onPayload(
       payload,
       selectedModel
     ){return options.onPayload(
       structuredClone(payload),
       selectedModel
     );}
   }
 );
 return originalSdkStream(
   model,
   context,
   options
 );
}
 return controlledSdkStream;
}
//endregion
