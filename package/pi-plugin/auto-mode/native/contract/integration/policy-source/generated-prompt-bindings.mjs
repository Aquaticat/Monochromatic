import {GoverningPolicyBindingError} from './governing-source.mjs';

//region Retain original source occurrences and their owning publication checks.
/** Skill descriptions retain their native companion metadata, never an inferred instruction tier. */
export function bindSkillDescriptionSources({governing}){
 const {request} = governing.view;
   const run=request.sources
     .nativeRunComposition;
   const sources=run?.skillDescriptionInputs;
 governing.assertCurrent(governing.view);
 if(request.sources
   .skillDescriptionInputs
   !==sources)throw new GoverningPolicyBindingError('Skill descriptions are not this original run publication');
 return (sources??[]).map(function bindOriginalSkillInput(source) {
  const {
    description,
    ...metadata
  }=run.options
    .skills[source.inputLocation
      .ordinal];
  if((source.runOccurrence!==run.occurrence)||(source.content!==description)
    ||(source.inputLocation
      .metadataJSON
      !==JSON.stringify(metadata)))throw new GoverningPolicyBindingError('Skill description or metadata differs from its original published position');
  const view=Object.freeze({
    kind:'original-run-skill-description-view',
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
if(value!==view)throw new GoverningPolicyBindingError('Skill description view is not this original input binding');

}
function assertCurrent(value){
if(value!==view)throw new GoverningPolicyBindingError('Skill description view is not this original input binding');
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

/** Actual native builder construction does not establish authority or final rendered visibility. */
export function bindBuiltInPromptSources({governing}){
 const {request} = governing.view;
   const run=request.sources
     .nativeRunComposition;
   const sources=run?.builtInPromptInputs;
 governing.assertCurrent(governing.view);
 if(request.sources
   .builtInPromptInputs
   !==sources)throw new GoverningPolicyBindingError('Built-in fragments are not this original run publication');
 return (sources??[]).map(function bindOriginalBuiltInFragment(
   source,
   ordinal
 ) {
  if((!run.renderOccurrence)||(source.renderOccurrence!==run.renderOccurrence)
    ||(source.runOccurrence!==run.occurrence)
    ||(source.inputLocation
      .ordinal
      !==ordinal))throw new GoverningPolicyBindingError('Built-in fragment has no original construction position');
  const view=Object.freeze({
    kind:'original-native-generated-prompt-view',
    source,
    sourceOccurrence:source.occurrence,
    request,
    runOccurrence:run.occurrence,
    renderOccurrence:run.renderOccurrence,
    authority:'not-established',
    priority:'not-established',
    completeGoverningCoverage:false,
    permission:false
  });
  /** Check immutable binding identity and its local publication link within the owning source set. */
function assertBindingIdentity(value){
if(value!==view)throw new GoverningPolicyBindingError('Built-in view is not this original source binding');

}
function assertCurrent(value){
if(value!==view)throw new GoverningPolicyBindingError('Built-in view is not this original source binding');
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

/** Native resource registration receipts remain unregistered, including replaced or rejected declarations. */
export function bindResourceToolSources({governing}){
 const {request} = governing.view;
   const snapshot=governing.view
     .sources
     ??request.sources;
 governing.assertCurrent(governing.view);
 return (snapshot.nativeResourceToolInputs??[]).map(function bindOriginalResourceToolInput(origin) {
  const {
    source,
    publication,
    resourceInputOccurrence
  }=origin;
  if((source.kind!=='native-resource-tool-input')||(resourceInputOccurrence===undefined)
    ||(source.resourceInputOccurrence!==resourceInputOccurrence)
    ||(publication.sourceOccurrence!==source.occurrence)
    ||(!snapshot.governingSources
      .includes(source)))throw new GoverningPolicyBindingError('Extension tool input differs from its original resource-owned receipt');
  const view=Object.freeze({
    kind:'original-extension-tool-input-view',
    source,
    sourceOccurrence:source.occurrence,
    request,
    resourceInputOccurrence,
    resourceInputOrigin:origin,
    authority:'not-established',
    priority:'not-established',
    completeGoverningCoverage:false,
    permission:false
  });
  /** Check immutable binding identity and its local publication link within the owning source set. */
function assertBindingIdentity(value){
if(value!==view)throw new GoverningPolicyBindingError('Extension tool view is not this original resource source');

}
function assertCurrent(value){
if(value!==view)throw new GoverningPolicyBindingError('Extension tool view is not this original resource source');
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
