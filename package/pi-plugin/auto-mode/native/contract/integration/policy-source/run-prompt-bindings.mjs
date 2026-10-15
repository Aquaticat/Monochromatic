import {GoverningPolicyBindingError} from './governing-source.mjs';

//region Retain original source occurrences and their owning publication checks.
/** Forced text is an original run output, not authority inferred from its system-message position. */
export function bindForcedPromptSource({governing}){
 const {request} = governing.view;
   const run=request.sources
     .nativeRunComposition;
   const source=run?.forcedPromptInput;
 governing.assertCurrent(governing.view);
 if(request.sources
   .forcedPromptInput
   !==source)throw new GoverningPolicyBindingError('Forced prompt input is not this original run publication');
 if(!source)return undefined;
 if((source.runOccurrence!==run.occurrence)||(source.content
   !==run.options
   .forceSystemPrompt))throw new GoverningPolicyBindingError('Forced prompt text differs from its original run input');
 const view=Object.freeze({
   kind:'original-forced-prompt-view',
   source,
   sourceOccurrence:source.occurrence,
   request,
   runOccurrence:run.occurrence,
   authority:'not-established',
   priority:'not-established',
   completeGoverningCoverage:false,
   permission:false
 });
 /** Check immutable binding identity and its local publication link within the owning source set. */
function assertBindingIdentity(value){
if(value!==view)throw new GoverningPolicyBindingError('Forced prompt view is not this original input binding');

}
function assertCurrent(value){
if(value!==view)throw new GoverningPolicyBindingError('Forced prompt view is not this original input binding');
governing.assertCurrent(governing.view);
assertBindingIdentity(value);
}
 assertCurrent(view);return Object.freeze({
   view,
   authority:undefined,
   assertBindingIdentity,
assertCurrent
 });
}

/** Native guideline entries retain their original published positions, not a model-assigned tier. */
export function bindRunGuidelineSources({governing}){
 const {request} = governing.view;
   const run=request.sources
     .nativeRunComposition;
   const sources=run?.promptGuidelineInputs;
   const toolSources=run?.toolGuidelineInputs;
 governing.assertCurrent(governing.view);
 if((request.sources
   .promptGuidelineInputs
   !==sources)||(request.sources
     .toolGuidelineInputs
     !==toolSources))throw new GoverningPolicyBindingError('Guidelines are not this original run publication');
 return [
   ...(sources??[]),
   ...(toolSources??[])
 ].map(function bindOriginalGuidelineInput(source) {
  const tool=source.kind==='native-run-tool-guideline-input';
  const content=tool?run.options
    .toolGuidelines[source.inputLocation
      .toolName][source.inputLocation
        .ordinal]:run.options
          .promptGuidelines[source.ordinal];
  if((source.runOccurrence!==run.occurrence)||(source.content!==content))throw new GoverningPolicyBindingError('Guideline differs from its original published position');
  const view=Object.freeze({
    kind:tool?'original-run-tool-guideline-view':'original-run-guideline-view',
    source,
    sourceOccurrence:source.occurrence,
    request,
    runOccurrence:run.occurrence,
    authority:'not-established',
    priority:'not-established',
    completeGoverningCoverage:false,
    permission:false
  });
  /** Check immutable binding identity and its local publication link within the owning source set. */
function assertBindingIdentity(value){
if(value!==view)throw new GoverningPolicyBindingError('Guideline view is not this original input binding');

}
function assertCurrent(value){
if(value!==view)throw new GoverningPolicyBindingError('Guideline view is not this original input binding');
governing.assertCurrent(governing.view);
assertBindingIdentity(value);
}
  assertCurrent(view);return Object.freeze({
    view,
    authority:undefined,
    assertBindingIdentity,
assertCurrent
  });
 });
}

/** Preserve mapped and replaced run text as original inputs, not authority or visibility. */
export function bindMappedPromptSources({governing}){
 const {request} = governing.view;
   const run=request.sources
     .nativeRunComposition;
   const sources=run?.mappedPromptInputs;
   const replacements=run?.replacementInputs;
 governing.assertCurrent(governing.view);
 if((request.sources
   .mappedPromptInputs
   !==sources)||(request.sources
     .replacementInputs
     !==replacements))throw new GoverningPolicyBindingError('Mapped or replacement inputs are not this original run publication');
 return [
   ...(sources??[]),
   ...(replacements??[])
 ].map(function bindOriginalMappedInput(source) {
  const {
    field,
    key,
    ordinal
  }=source.inputLocation;
    const replacement=source.kind==='native-run-replacement-input';
  const content=!replacement?run.options[field][key]:field==='contextFiles'?run.options
    .contextFiles[ordinal]
    .content:run.options[field];
  if((source.runOccurrence!==run.occurrence)||(source.content!==content))throw new GoverningPolicyBindingError('Mapped or replacement input differs from its original published position');
  const view=Object.freeze({
    kind:replacement?'original-run-replacement-view':'original-run-mapped-prompt-view',
    source,
    sourceOccurrence:source.occurrence,
    request,
    runOccurrence:run.occurrence,
    authority:'not-established',
    priority:'not-established',
    completeGoverningCoverage:false,
    permission:false
  });
  /** Check immutable binding identity and its local publication link within the owning source set. */
function assertBindingIdentity(value){
if(value!==view)throw new GoverningPolicyBindingError('Mapped prompt view is not this original input binding');

}
function assertCurrent(value){
if(value!==view)throw new GoverningPolicyBindingError('Mapped prompt view is not this original input binding');
governing.assertCurrent(governing.view);
assertBindingIdentity(value);
}
  assertCurrent(view);return Object.freeze({
    view,
    authority:undefined,
    assertBindingIdentity,
assertCurrent
  });
 });
}

//endregion
