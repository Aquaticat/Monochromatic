import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {SourceCollectionError} from '../collector.mjs';
import {
  copyMessageData,
  copyToolMetadata,
  assertTextMessageContent
} from '../run-prompt-custody/messages.mjs';
import {createInputOnlyPublication} from './handler-publication.mjs';
import {
  assertManagerMessageContent,
  assertManagerSystemTools
} from './manager-message-content.mjs';
import {snapshotToolMetadata} from './tool-metadata.mjs';
import {snapshotToolLoadoutInput} from './tool-loadout-input.mjs';

/** Native loading and message construction continue independently; capture failures are raised on source use. */
export class SessionInputCaptureError extends AggregateError {
 constructor(error){super(
   [error],
   'Original session inputs exceed the supported source capture profile'
 );this.name=this.constructor
   .name;}
}

/** Observe native data fields without adding reads of accessors or proxy traps. */
function dataField({
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
function selectedMessageMetadata({
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
function messageMetadata(input){return copyMessageData(selectedMessageMetadata(input));}

/** Keep message content and its distinguishing companions, not a copy of the complete native message. */
function agentMessageFields(message){
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
function systemInputFields(message){
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
function assertSystemInput(input){
 assertTextMessageContent(input.content);
 const {sections} = input;
 if((sections!==undefined)&&(sections!==null)
   &&(((typeof sections)!=='object')
     ||Array.isArray(sections)
     ||Object.values(sections)
     .some(function isUnsupportedScalar(value) { return ((value!==null)&&((typeof value)!=='string')); })))throw new SourceCollectionError('Loaded system sections require named text or null values');
}

/** One prompt-call array shares one copier budget; borrowed arrays and messages receive no publication or mutation. */
function agentPromptArray(message){
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
function bashInput(message){
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

/**
 Capture owned native loaded values before migration changes their representation.
 The manager owns this occurrence. Saved roles, paths, identifiers and prior issuers confer no authority.
 */
function createInputPool({
  entries,
  maximumInputs,
  maximumSnapshotBytes,
  InputCaptureError
}){
 const occurrence=Object.freeze({});
 const origins=new WeakMap();
 let bytes=0;
 let pendingEventBytes=0;
   let count=0;
   let failure;
   let constructedInputs=Object.freeze([]);
 function reserve(){
  if((++count)>maximumInputs)throw new SourceCollectionError(`Original input receipts exceed the ${maximumInputs}-source profile`);
 }
 function retain({
   carrier,
   value,
   metadata,
   ordinal,
   inputField='sessionMessages',
   inputOccurrence=occurrence,
   inputOrigin='native-load',
   kind='native-session-message-input'
 }){
  const contentFormat=(typeof value)==='string'?'text':'native-content-json';
  const content=contentFormat==='text'?value:JSON.stringify(value??[]);
  if(Buffer.byteLength(content)>65_536)throw new SourceCollectionError('Loaded session message content exceeds the original source byte bound');
  const source=Object.freeze({
    kind,
    content,
    contentFormat,
    inputOrigin,
    inputLocation:Object.freeze({
      field:inputField,
      ...(ordinal===undefined?{}:{ordinal}),
      metadataJSON:JSON.stringify({
        ...metadata,
        contentFormat
      })
    }),
    sha256:createHash('sha256')
      .update(content)
      .digest('hex'),
    occurrence:Object.freeze({}),
    ...(kind==='native-resource-tool-input'?{resourceInputOccurrence:inputOccurrence}:{sessionInputOccurrence:inputOccurrence}),
    registration:undefined,
    historicalIssuer:'not-established',
    permission:false
  });
  bytes+=Buffer.byteLength(JSON.stringify(source));
  if(bytes+pendingEventBytes>maximumSnapshotBytes)throw new SourceCollectionError('Loaded session source observations exceed the original snapshot byte bound');
  const publisher=createInputOnlyPublication(source);publisher.capture(carrier);
  const origin=Object.freeze({
    source,
    publication:publisher.view,
    ...(kind==='native-resource-tool-input'?{resourceInputOccurrence:inputOccurrence}:{sessionInputOccurrence:inputOccurrence})
  });
  origins.set(
    publisher.view,
    origin
  );return origin;
 }
 function retainConstructedInput(input){
  const origin=retain({
    ...input,
    inputOccurrence:Object.freeze({})
  });
  constructedInputs=Object.freeze([
    ...constructedInputs,
    origin
  ]);
 }
 /** Share frame capture and budgets without accepting an origin declaration from the native input. */
 function captureManagerFrame({
   frame,
   method,
   inputOrigin
 }){
   if(failure)return;
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
    failure=new InputCaptureError(error);
    if(!(error instanceof SourceCollectionError))throw error;
   }
 }
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
   }));assertTextMessageContent(value);
   retain({
     carrier:entry,
     value,
     metadata,
     ordinal
   });
  }
 }catch(error){failure=new InputCaptureError(error);}
 return Object.freeze({
  captureQueuedInput({
    message,
    text,
    delivery
  }){
   if(failure)return;
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
   }catch(error){failure=new InputCaptureError(error);}
  },
  captureUninterceptedInput({
    input,
    source,
    streamingBehavior
  }){
   if(failure)return;
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
   }catch(error){failure=new InputCaptureError(error);}
  },
  captureInitialManagerInput(input){captureManagerFrame({
    ...input,
    inputOrigin:'native-manager-initial-input'
  });},
  captureManagerInput(input){captureManagerFrame({
    ...input,
    inputOrigin:'native-manager-input'
  });},
  captureToolLoadoutQuery({
    frame,
    phase='output'
  }){
   if(failure)return;
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
    failure=new InputCaptureError(error);
    if(types.isProxy(error)||(!(error instanceof SourceCollectionError)))throw error;
   }
  },
  captureToolLoadoutInput({frame}){
   if(failure)return;
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
    failure=new InputCaptureError(error);
    if(types.isProxy(error)||(!(error instanceof SourceCollectionError)))throw error;
   }
  },
  /** Group one native emission while copying each callback phase before its borrowed value can change. */
  createEventHandlerCapture(){
   let records=[];
   let retainedBytes=0;
   let part=0;
   let closed=false;
   function publish(){
    if(records.length===0)return;
    pendingEventBytes-=retainedBytes;
    retainConstructedInput({carrier:Object.freeze({records}),value:records,metadata:{method:records[0].kind,part},inputField:'eventHandler',inputOrigin:'native-event-handler'});
    if(bytes+pendingEventBytes>maximumSnapshotBytes)throw new SourceCollectionError('Native event observations exceed the original snapshot byte bound');
    records=[];retainedBytes=0;part++;
   }
   function capture(input){
    if(failure)return;
    try{
     if(closed)throw new SourceCollectionError('Native event source was already completed');
     const record=Object.freeze({kind:input.kind,phase:input.phase,ordinal:input.ordinal,path:input.path,value:copyToolMetadata({value:input.value})});
     const recordBytes=Buffer.byteLength(JSON.stringify(record));
     if(recordBytes+2>65_536)throw new SourceCollectionError('Native event callback value exceeds the original source byte bound');
     if(retainedBytes+recordBytes+1>65_536)publish();
     if(records.length===0)reserve();
     // Array delimiters and commas are charged before any complete emission publication.
     const addedBytes=recordBytes+(records.length===0?2:1);
     if(bytes+pendingEventBytes+addedBytes>maximumSnapshotBytes)throw new SourceCollectionError('Native event observations exceed the original snapshot byte bound');
     records.push(record);retainedBytes+=addedBytes;pendingEventBytes+=addedBytes;
    }catch(error){
     failure=new InputCaptureError(error);
     if(types.isProxy(error)||(!(error instanceof SourceCollectionError)))throw error;
    }
   }
   function complete(){
    if(failure)return;
    try{
     if(closed)throw new SourceCollectionError('Native event source cannot complete twice');
     closed=true;
     publish();
    }catch(error){
     failure=new InputCaptureError(error);
     if(types.isProxy(error)||(!(error instanceof SourceCollectionError)))throw error;
    }
   }
   return Object.freeze({capture,complete});
  },
  /** Retain original context inputs and complete results under the existing manager budget. */
  captureContextHandler(input){
   if(failure)return;
   try{
    reserve();
    const value=copyToolMetadata({value:input.value});
    retainConstructedInput({
      carrier:input,
      value,
      metadata:{method:input.kind,phase:input.phase,ordinal:input.ordinal,path:input.path},
      inputField:'contextHandler',
      inputOrigin:'native-context-handler'
    });
   }catch(error){
    failure=new InputCaptureError(error);
    if(types.isProxy(error)||(!(error instanceof SourceCollectionError)))throw error;
   }
  },
  /** Preserve the complete received result before native callback field selection. */
  captureHandlerResultOutput({frame}){
   if(failure)return;
   try{
    if(types.isProxy(frame)||(!types.isArgumentsObject(frame))
      ||(Object.getOwnPropertyDescriptor(
        frame,
        'length'
      )
        ?.value
        !==1))throw new SourceCollectionError('Handler result requires its original one-argument observation frame');
    const output=dataField({
      value:frame,
      key:'0'
    });
    if(output===undefined)return;
    reserve();
    // Metadata copying retains supported non-enumerable data and charges shared references per occurrence.
    const value=copyToolMetadata({output});
    retainConstructedInput({
      carrier:frame,
      value,
      metadata:{
        method:'before_agent_start',
        phase:'output'
      },
      inputField:'handlerResult',
      inputOrigin:'native-before-agent-start-output'
    });
   }catch(error){
    failure=new InputCaptureError(error);
    if(types.isProxy(error)||(!(error instanceof SourceCollectionError)))throw error;
   }
  },
  captureToolLoadoutOutput({frame}){
   if(failure)return;
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
    failure=new InputCaptureError(error);
    if(types.isProxy(error)||(!(error instanceof SourceCollectionError)))throw error;
   }
  },
  captureExtensionToolInput({frame}){
   if(failure)return;
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
    failure=new InputCaptureError(error);
    if(!(error instanceof SourceCollectionError))throw error;
   }
  },
  captureCustomToolDescriptions({frame}){
   if(failure)return;
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
    failure=new InputCaptureError(error);
    if(!(error instanceof SourceCollectionError))throw error;
   }
  },
  captureAgentInput({
    frame,
    method
  }){
   if(failure)return;
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
    failure=new InputCaptureError(error);
    if(!(error instanceof SourceCollectionError))throw error;
   }
  },
  captureCallInput({
    frame,
    method
  }){
   if(failure)return;
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
    failure=new InputCaptureError(error);
    if(!(error instanceof SourceCollectionError))throw error;
   }
  },
  captureCommandInput({
    context,
    text,
    commandName
  }){
   if(failure)return;
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
    failure=new InputCaptureError(error);
    if(!(error instanceof SourceCollectionError))throw error;
   }
  },
  captureTransformedInput({
    input,
    source,
    streamingBehavior
  }){
   if(failure)return;
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
   }catch(error){failure=new InputCaptureError(error);}
  },
  captureInputEvent(event){
   if(failure)return;
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
   }catch(error){failure=new InputCaptureError(error);}
  },
  captureCustomMessageInput(message){
   if(failure)return;
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
   }catch(error){failure=new InputCaptureError(error);}
  },
  readConstructedInputs(){return constructedInputs;},
  inputUsage(){if(failure)throw failure;return Object.freeze({
    count,
    bytes:bytes+pendingEventBytes
  });},
  captureCreatedInput({
    entry,
    ordinal
  }){
   if(failure)return;
   try{
    const type=dataField({
      value:entry,
      key:'type'
    });
    if(![
      'context_edit',
      'compaction',
      'branch_summary'
    ].includes(type))return;
    if((!Number.isSafeInteger(ordinal))||(ordinal<0))throw new SourceCollectionError('Native appended input requires its original entry position');
    const input={
      entry,
      ordinal,
      inputOccurrence:Object.freeze({}),
      inputOrigin:'native-append'
    };
    if(type==='context_edit')captureEdit(input);else captureSummary({
      ...input,
      type
    });
   }catch(error){failure=new InputCaptureError(error);}
  },
  lookup(publication){return origins.get(publication);},
  assertCaptured(){if(failure)throw failure;}
 });
}

/** Keep all existing Session input paths on their original shared four-MiB record budget. */
export function captureLoadedInputs(entries){return createInputPool({
  entries,
  maximumInputs:128,
  maximumSnapshotBytes:4_194_304,
  InputCaptureError:SessionInputCaptureError
});}

/** Native resource registration failures retain exact causes without replacing the native registration result. */
export class ResourceToolInputCaptureError extends AggregateError {
 constructor(error){super(
   [error],
   'Original extension tool inputs exceed the supported resource capture profile'
 );this.name=this.constructor
   .name;}
}

/** Extend resource-owned receipts under the existing one-MiB resource budget, using the same store and publisher. */
export function captureResourceToolInputs(){return createInputPool({
  entries:[],
  maximumInputs:64,
  maximumSnapshotBytes:1_048_576,
  InputCaptureError:ResourceToolInputCaptureError
});}
