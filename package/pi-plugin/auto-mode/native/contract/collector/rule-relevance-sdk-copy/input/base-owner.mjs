import {SourceCollectionError} from "../../collector.mjs";
import {assertBoundResourceInputs,readBoundResourceFrame} from "./resource-owner.mjs";
import {freezePromptOptions} from "../../base-prompt-custody-v2/copy.mjs";

export class BaseCompositionError extends AggregateError{
  constructor(failures){super(failures.map(value=>value.error),'Native base prompt has no current qualified resource derivation. Inspect its input/linkage failure, supply the original loader binding, or rebuild through the owning session before using it.');this.name=this.constructor.name;this.failures=Object.freeze([...failures]);}
}
/** Each native session privately owns one instance; there is no global session map. */
export function createBaseCompositionOwner(){
  const history=[];let active,current;
  function failure({scope,error,at}){const item=Object.freeze({ordinal:scope.failures.length,identity:Object.freeze({}),error,at});scope.failures.push(item);return item;}
  function build({binding,loader,read,normalize}){
    if(active){failure({scope:active,error:new SourceCollectionError('Native base composition cannot reenter'),at:'entry'});throw new BaseCompositionError(active.failures);}
    const scope={binding,loader,ordinal:history.length,status:'preparing',failures:[],linkFailures:[],view:undefined};history.push(scope);active=scope;current=undefined;
    try{
      let frame;
      // Missing source linkage does not claim an authority or tear down partially constructed native state.
      // The protected reader rejects this unlinked composition once the session exists.
      try{frame=readBoundResourceFrame({binding,loader});}catch(error){scope.linkFailures.push(Object.freeze({error,at:'resource-entry'}));}
      let captured;
      try{captured=read();}catch(error){failure({scope,error,at:'native-input'});throw new BaseCompositionError(scope.failures);}
      if(frame)try{assertBoundResourceInputs({binding,loader,frame,...captured.resources});}catch(error){scope.linkFailures.push(Object.freeze({error,at:'resource-inputs'}));}
      const {input,resources}=captured;
      if(input.contextFiles!==resources.contextFiles||input.customPrompt!==resources.systemPrompt||input.appendSystemPrompt!==resources.appendSystemPrompt.join('\n\n'))throw new SourceCollectionError('Native normalized input does not use its recorded resource fields');
      let normalized;
      try{normalized=normalize(input);}catch(error){failure({scope,error,at:'native-normalization'});throw new BaseCompositionError(scope.failures);}
      const options=freezePromptOptions(normalized);
      if(frame)try{assertBoundResourceInputs({binding,loader,frame,...resources});}catch(error){scope.linkFailures.push(Object.freeze({error,at:'resource-return'}));}
      if(scope.failures.length)throw new BaseCompositionError(scope.failures);
      scope.status=scope.linkFailures.length?'unlinked':'ready';
      scope.view=Object.freeze({retainedOnly:true,occurrence:Object.freeze({}),ordinal:scope.ordinal,status:scope.status,resourceFrame:frame,options,linkFailures:Object.freeze([...scope.linkFailures]),sourceAuthority:'not-established',otherInputCoverage:'not-established'});
      current=scope;return options;
    }catch(error){
      if(!(error instanceof BaseCompositionError))failure({scope,error,at:'composition'});
      scope.status='failed';throw new BaseCompositionError(scope.failures);
    }finally{active=undefined;}
  }
  /** Internal native reader supplies its canonical field, not a mutable working copy. */
  function read(request){
    const scope=current;
    if(!request||typeof request!=='object'||Reflect.ownKeys(request).length!==1||!Object.hasOwn(request,'options')||!Object.hasOwn(Object.getOwnPropertyDescriptor(request,'options'),'value'))throw new BaseCompositionError([Object.freeze({error:new SourceCollectionError('Native base read requires its canonical options field'),at:'read-input'})]);
    if(active||!scope||scope.status!=='ready'||scope.view.options!==request.options){
      const retained=scope?[...scope.failures,...scope.linkFailures]:[];
      throw new BaseCompositionError(retained.length?retained:[Object.freeze({error:new SourceCollectionError('Native base composition is pending, failed, unlinked or replaced'),at:'current-base'})]);
    }
    try{
      const frame=readBoundResourceFrame({binding:scope.binding,loader:scope.loader});
      if(frame!==scope.view.resourceFrame||current!==scope||active)throw new SourceCollectionError('Original resource occurrence or native base changed before current read');
    }catch(error){
      failure({scope,error,at:'resource-current'});scope.status='stale';if(current===scope)current=undefined;throw new BaseCompositionError(scope.failures);
    }
    return scope.view;
  }
  function inspect(){return Object.freeze({retainedOnly:true,pending:active!==undefined,currentOrdinal:current?.ordinal,history:Object.freeze(history.map(scope=>Object.freeze({ordinal:scope.ordinal,status:scope.status,view:scope.view,failures:Object.freeze([...scope.failures]),linkFailures:Object.freeze([...scope.linkFailures])})))});}
  return Object.freeze({build,read,inspect});
}
