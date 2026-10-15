import {SourceCollectionError} from '../collector.mjs';
import {isDeepStrictEqual} from 'node:util';
import {freezePromptOptions} from '../base-prompt-custody-v2/copy.mjs';
import {captureRenderInputs} from './render-inputs.mjs';
import {createGuidelineInputs} from './guideline-inputs.mjs';

//region Retain the original render lifetime and system-section publication.
/** Retain the original render lifetime and system-section publication. */
export function createRunRendering({state,check,issuedErrors,record,guard,charge}){
/** The fixed native preparation path renders synchronously within this original run. */
  function render({
    options,
    build
  }){
    const scope=state.active;
    const initial=(scope?.state==='emitted')&&(!state.operating)
      &&(options===scope.delivery);
    const refresh=(scope?.kind==='next-turn-refresh')&&(scope.state==='created')
      &&state.operating;
    if((!scope)||scope.rendering
      ||scope.rendered
      ||((!initial)
      &&(!refresh))
      ||((typeof build)!=='function'))throw new SourceCollectionError('Native prompt rendering requires its original open preparation position');
    check(scope);scope.rendering=true;
    using renderingLifetime={ [Symbol.dispose](){scope.rendering=false;} };
    try{
      const input=freezePromptOptions(options);
        const occurrence=Object.freeze({});
      const guidelines=createGuidelineInputs({
        options:input,
        runOccurrence:scope.handle,
        renderOccurrence:occurrence
      });
      function observeGuideline(value){
        // The rendering lifetime closes this observation window on every exit.
        if((!scope.rendering)||(state.active!==scope))throw new SourceCollectionError('Guideline insertion requires its original active native rendering');
        try{check(scope);guidelines.observe(value);check(scope);}
        catch(error){if(issuedErrors.get(error)!==scope)record({
          scope,
          error,
          at:'native-guideline-insertion'
        });throw guard(scope);}
      }
      const captured=captureRenderInputs({
        output:build(
          options,
          observeGuideline
        ),
        runOccurrence:scope.handle,
        renderOccurrence:occurrence
      });
      check(scope);
      if((!isDeepStrictEqual(
        input,
        freezePromptOptions(options)
      ))||(state.active!==scope))throw new SourceCollectionError('Native prompt inputs changed during construction');
      charge({
        scope,
        value:captured
      });
      scope.rendered=Object.freeze({
        options,
        input,
        occurrence,
        inputs:captured.inputs,
        sections:captured.sections,
        guidelineInputs:guidelines.seal()
      });
      return captured.sections;
    }catch(error){
      if(issuedErrors.get(error)!==scope)record({
        scope,
        error,
        at:'native-render'
      });
      throw guard(scope);
    }
  }
/** Retain the actual native sections publication, not a text-equivalent reconstruction. */
  function captureSystemMessage({
    options,
    message
  }){
    const scope=state.active;
    if((!scope?.rendered)||(scope.rendered
      .options
      !==options)
      ||scope.systemPublication)throw new SourceCollectionError('System contribution requires its original native rendering position');
    if(message===undefined)return;
    const {sections} = message;
      const descriptors=Object.getOwnPropertyDescriptors(sections);
      const aliases=new WeakSet([sections]);
    const complete=isDeepStrictEqual(
      sections,
      scope.rendered
        .sections
    );
    const retirement={error:undefined};
    scope.systemPublication=Object.freeze({
      occurrence:Object.freeze({}),
      renderOccurrence:scope.rendered
        .occurrence,
      runOccurrence:scope.handle,
      complete,
      matchesSections(value){
        if(retirement.error)throw new SourceCollectionError(
          'Original system contribution lost eligibility',
          {cause:retirement.error}
        );
        if(!aliases.has(value))return false;
        if(!isDeepStrictEqual(
          Object.getOwnPropertyDescriptors(value),
          descriptors
        )){
          retirement.error=new SourceCollectionError('Original system sections changed before serializer consumption');throw retirement.error;
        }
        return true;
      }
    });
    scope.captureContextClone=function retainNativePersistenceInputs({
      before,
      after
    }) {
      // Failed provenance must not prevent native persistence of the failure itself.
      if(retirement.error)return;
      for(const [index,original] of before.entries()){
        if((!original)||((typeof original)!=='object'))continue;
        const field=Object.getOwnPropertyDescriptor(
          original,
          'sections'
        );
        if((!field?.enumerable)||(!Object.hasOwn(
          field,
          'value'
        ))
          ||(!aliases.has(field.value)))continue;
        const copiedMessage=after[index];
        const copiedField=copiedMessage&&Object.getOwnPropertyDescriptor(
          copiedMessage,
          'sections'
        );
        const copied=copiedField&&Object.hasOwn(
          copiedField,
          'value'
        )?copiedField.value:undefined;
        if((!copied)||(!isDeepStrictEqual(
          Object.getOwnPropertyDescriptors(field.value),
          descriptors
        ))
          ||(!isDeepStrictEqual(
            Object.getOwnPropertyDescriptors(copied),
            descriptors
          ))){
          retirement.error=new SourceCollectionError('Native context clone changed the original sections contribution');
          return;
        }
        aliases.add(copied);
      }
    };
  }
return {render,captureSystemMessage};
}
//endregion
