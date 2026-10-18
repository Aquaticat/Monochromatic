import {SourceCollectionError} from '../collector.mjs';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {freezePromptOptions} from '../base-prompt-custody-v2/copy.mjs';
import {republishBaseInputs} from './base-inputs.mjs';
import {captureHandlerOptionInputs} from './handler-option-inputs.mjs';
import {createInputOnlyPublication} from './handler-publication.mjs';
import {createForcedPublication} from './forced-publication.mjs';
import {captureMessageInputs} from './message-inputs.mjs';
import {createGuidelineInputs} from './guideline-inputs.mjs';

//region Publish immutable run ancestry using the existing source capabilities.
/** Publish immutable run ancestry using the existing source capabilities. */
export function createRunPublication({state,check,base,requireRenderCapture}){
function publishScope(scope){
    check(scope);const publishedBase=base();
    const republished=republishBaseInputs({
      input:scope.delivery??scope.working,
      base:scope.base,
      runOccurrence:scope.handle
    });
    const options=freezePromptOptions(republished.options);
    if(requireRenderCapture&&(!scope.rendered))throw new SourceCollectionError('Native run requires its original prompt construction capture');
    if(scope.rendered&&((scope.rendered
      .options
      !==(scope.delivery??scope.working))||(!isDeepStrictEqual(
      scope.rendered
        .input,
      options
    ))))throw new SourceCollectionError('Native run publication differs from its original prompt construction inputs');
    const builtInPromptInputs=scope.rendered
      ?.inputs
      ??Object.freeze([]);
    check(scope);
    if(state.active!==scope)throw new SourceCollectionError('Run source occurrence changed before publication');
    const observations=Object.freeze(scope.slots
      .map(function snapshotHandlerSlot(slot) { return (Object.freeze({
        ordinal:slot.ordinal,
        path:slot.path,
        state:slot.state,
        before:slot.before,
        after:slot.after,
        failures:Object.freeze(slot.failures
          .map(function snapshotHandlerFailure(
            failure,
            ordinal
          ) { return (Object.freeze({
            occurrence:failure.identity,
            ordinal,
            at:failure.at
          })); }))
      })); }));
    const handlerOptionInputs=captureHandlerOptionInputs({
        observations,
        runOccurrence:scope.handle
    });
    const handlerOptionPublications=Object.freeze(handlerOptionInputs.map(function captureHandlerOptionPublication(
      source,
      index
    ) {
      const publication=createInputOnlyPublication({source});publication.capture(observations[index]
        .before);return publication.view;
    }));
    scope.handlerOptionOrigins=Object.freeze(handlerOptionInputs.map(function linkHandlerOptionOrigin(
      source,
      index
    ) { return (Object.freeze({
      source,
      publication:handlerOptionPublications[index],
      runOccurrence:scope.handle
    })); }));
    const forcedPromptInput=options.forceSystemPrompt===undefined?undefined:Object.freeze({
      kind:'native-run-forced-prompt-input',
      content:options.forceSystemPrompt,
      sha256:createHash('sha256')
        .update(options.forceSystemPrompt)
        .digest('hex'),
      occurrence:Object.freeze({}),
      runOccurrence:scope.handle,
      registration:undefined,
      permission:false
    });
    scope.forcedPublication=forcedPromptInput?createForcedPublication(forcedPromptInput):undefined;
    const {
      promptGuidelineInputs,
      toolGuidelineInputs
    }=scope.rendered
      ?.guidelineInputs
      ??createGuidelineInputs({
        options,
        runOccurrence:scope.handle
      })
      .seal();
    const mappedPromptInputs=Object.freeze([
      'toolSnippets',
      'sections'
    ].flatMap(function captureMappedPromptField(field) { return (Object.entries(options[field])
      .map(function captureMappedPromptEntry([key,content]) { return (Object.freeze({
        kind:'native-run-mapped-prompt-input',
        content,
        inputLocation:Object.freeze({
          field,
          key
        }),
        sha256:createHash('sha256')
          .update(content)
          .digest('hex'),
        occurrence:Object.freeze({}),
        runOccurrence:scope.handle,
        registration:undefined,
        permission:false
      })); })); }));
    const skillDescriptionInputs=Object.freeze(options.skills
      .map(function captureSkillDescription(
        {
          description,
          ...metadata
        },
        ordinal
      ) { return (Object.freeze({
        kind:'native-run-skill-description-input',
        content:description,
        inputLocation:Object.freeze({
          field:'skills',
          ordinal,
          metadataJSON:JSON.stringify(metadata)
        }),
        sha256:createHash('sha256')
          .update(description)
          .digest('hex'),
        occurrence:Object.freeze({}),
        runOccurrence:scope.handle,
        registration:undefined,
        pathToRawFileIdentity:'not-established',
        permission:false
      })); }));
    const handlerMessageInputs=scope.handlerMessageInputs??captureMessageInputs({
      messages:[],
      runOccurrence:scope.handle
    });
    const handlerPublications=Object.freeze((scope.handlerPublications??[]).map(function readPublicationView(publication) { return (publication.view); }));
    scope.node=Object.freeze({
      retainedOnly:true,
      expandedPromptInput:scope.expandedPromptInput,
      expandedPromptPublication:scope.expandedPromptPublication
        ?.view,
      systemPublication:scope.systemPublication,
      forcedPublication:scope.forcedPublication
        ?.view,
      builtInPromptInputs,
      renderOccurrence:scope.rendered
        ?.occurrence,
      handlerMessageInputs,
      handlerPublications,
      skillDescriptionInputs,
      baseInputCarriers:republished.baseInputCarriers,
      replacementInputs:republished.replacementInputs,
      forcedPromptInput,
      promptGuidelineInputs,
      toolGuidelineInputs,
      mappedPromptInputs,
      occurrence:scope.handle,
      ordinal:scope.ordinal,
      kind:scope.kind,
      inputBase:scope.base,
      publishedBase,
      inputRun:scope.parent
        ?.handle,
      inputRunOrdinal:scope.parent
        ?.ordinal,
      options,
      handlerObservations:observations,
      handlerOptionInputs,
      handlerOptionPublications,
      emitterOptions:scope.emitted
        ?.options,
      emitterMessages:scope.emitted
        ?.messages,
      sourceAuthority:'not-established',
      otherInputCoverage:'not-established'
    });
    const ancestors=[];let {parent} = scope;
    const seen=new Set();
    while(parent){
      if(seen.has(parent))throw new SourceCollectionError('Run source ancestry contains a cycle');
      seen.add(parent);ancestors.push(parent.node);parent=parent.parent;
    }
    scope.view=Object.freeze({
      ...scope.node,
      ancestors:Object.freeze(ancestors)
    });
    scope.state='published';state.current=scope;state.active=undefined;return options;
  }
return {publishScope};
}
//endregion
