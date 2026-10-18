import {
  isDeepStrictEqual,
  types
} from 'node:util';
import {SourceCollectionError} from '../../collector/collector.mjs';
import {isCustomDataInput} from '../../collector/run-prompt-custody-v3/custom-data-input.mjs';
import {isInputContentDescriptor} from '../../collector/run-prompt-custody-v3/input-content.ts';

/** Shape-check already-owned records without invoking caller accessors or proxy traps. */
function frozenRecord(value){
 if((!value)||((typeof value)!=='object')
   ||types.isProxy(value)
   ||(Object.getPrototypeOf(value)!==Object.prototype)
   ||(!Object.isFrozen(value)))throw new SourceCollectionError('Manager source growth requires original frozen records');
 for(const key of Reflect.ownKeys(value)){
  const field=Object.getOwnPropertyDescriptor(
    value,
    key
  );
  if(field&&isInputContentDescriptor({record:value,key,field}))continue;
  if(((typeof key)!=='string')||(!field?.enumerable)
    ||(!Object.hasOwn(
    field,
    'value'
  )))throw new SourceCollectionError('Manager source growth requires named data fields');
 }
}

/** Inspect a owned reference list, never a copied message inventory. */
function origins(value){
 if(value===undefined)return [];
 if(types.isProxy(value)||(!Array.isArray(value))
   ||(Object.getPrototypeOf(value)!==Array.prototype)
   ||(!Object.isFrozen(value))
   ||(Reflect.ownKeys(value)
     .length
     !==(value.length
     +1)))throw new SourceCollectionError('Manager source growth requires its frozen origin list');
 for(let index=0;index<value.length;index++){
  const field=Object.getOwnPropertyDescriptor(
    value,
    String(index)
  );
  if((!field?.enumerable)||(!Object.hasOwn(
    field,
    'value'
  )))throw new SourceCollectionError('Manager source growth requires dense data entries');
 }
 return value;
}

/**
 Compare already-authenticated source-owner outputs by original reference.
 The caller must authenticate both snapshots; metadata cannot establish ownership or governing scope.
 */
export function assertManagerOriginsAppended({
  before,
  after
}){
 const previous=origins(before);
 const current=origins(after);
 if((current.length<previous.length)||previous.some(function differsFromOriginalOrigin(
   origin,
   index
 ) { return (origin!==current[index]); }))throw new SourceCollectionError('Manager source growth cannot remove, replace or reorder original occurrences');
 const seen=new Set();
 for(const [index,origin] of current.entries()){
  frozenRecord(origin);frozenRecord(origin.source);frozenRecord(origin.publication);
  if(seen.has(origin.source
    .occurrence))throw new SourceCollectionError('Manager source growth cannot duplicate an original occurrence');
  seen.add(origin.source
    .occurrence);
  if(index<previous.length)continue;
  const {
    source,
    publication,
    sessionInputOccurrence
  }=origin;
  const admittedOrigin=isCustomDataInput(origin)||[
    'native-manager-input',
    'native-event-handler'
  ].includes(source.inputOrigin);
  if((source.kind!=='native-session-message-input')||(!admittedOrigin)
    ||(source.registration!==undefined)
    ||(source.permission!==false)
    ||(origin.runOccurrence!==undefined)
    ||(source.runOccurrence!==undefined)
    ||(!source.occurrence)
    ||(!sessionInputOccurrence)
    ||(source.sessionInputOccurrence!==sessionInputOccurrence)
    ||(publication.sessionInputOccurrence!==sessionInputOccurrence)
    ||(publication.sourceOccurrence!==source.occurrence))throw new SourceCollectionError('Only original unregistered manager, native event or custom data inputs may extend this source snapshot');
 }
}

/** Permit only retained manager-reference growth within the same otherwise-identical owned run view. */
export function assertRunManagerGrowth({
  before,
  after
}){
 if((before===undefined)&&(after===undefined))return;
 frozenRecord(before);frozenRecord(after);
 if(before===after)return;
 const oldKeys=Reflect.ownKeys(before)
   .filter(function retainBeforeManagerField(key) { return (key!=='retainedMessageOrigins'); });
 const newKeys=Reflect.ownKeys(after)
   .filter(function retainAfterManagerField(key) { return (key!=='retainedMessageOrigins'); });
 if((oldKeys.length!==newKeys.length)||oldKeys.some(function differsFromManagerField(key) { return ((!Object.hasOwn(
   after,
   key
 ))||(before[key]!==after[key])); }))throw new SourceCollectionError('Manager source growth cannot replace original run material');
 assertManagerOriginsAppended({
   before:before.retainedMessageOrigins,
   after:after.retainedMessageOrigins
 });
}

/**
 Compare authentic base-collector snapshots without a second collector or registry.
 Copied material is compared as data; resource/base/policy identity roots remain exact references.
 Both snapshots must first be authenticated by the enclosing collector's existing ownership map.
 */
export function assertCollectedManagerGrowth({
  before,
  after
}){
 frozenRecord(before);frozenRecord(after);
 const copied=[
   'adapter',
   'mandatoryPolicy',
   'resourceInventory',
   'renderedObservation',
   'unqualifiedCoverage',
   'instructionAuthority',
   'humanWitness'
 ];
 const identities=[
   'resourceInputObservation',
   'nativeBaseComposition',
   'hostGoverningPolicy'
 ];
 const keys=[
   ...copied,
   ...identities,
   'nativeRunComposition'
 ];
 for(const snapshot of [
   before,
   after
 ]){
  if((Reflect.ownKeys(snapshot)
    .length
    !==keys.length)||keys.some(function isMissingSnapshotField(key) { return (!Object.hasOwn(
    snapshot,
    key
  )); }))throw new SourceCollectionError('Manager source growth requires the exact collected material profile');
 }
 if(identities.some(function differsFromCapturedIdentity(key) { return (before[key]!==after[key]); }))throw new SourceCollectionError('Manager source growth cannot replace original resource, base or policy identity');
 if(copied.some(function differsFromCapturedValue(key) { return (!isDeepStrictEqual(
   before[key],
   after[key]
 )); }))throw new SourceCollectionError('Manager source growth cannot change original collected material');
 assertRunManagerGrowth({
   before:before.nativeRunComposition,
   after:after.nativeRunComposition
 });
}
