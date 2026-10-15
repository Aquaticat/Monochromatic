import {PolicyInputBindingError} from './inputs.mjs';

/** Decode only the original collector's companion metadata, never the serialized model request. */
function readMetadata(source){
 try{return JSON.parse(source.inputLocation
   .metadataJSON);}
 catch(error){throw new PolicyInputBindingError(
   'Original tool declaration source metadata cannot be decoded',
   {cause:error}
 );}
}
/** Validate captured metadata gaps before they become original source obligations. */
function readGaps(source){
 const metadata=readMetadata(source);
 if((!metadata)||Array.isArray(metadata)
   ||(![
     'constructor',
     'state.tools',
     'registerTool',
     'prepareLoadout'
   ].includes(metadata.method))
   ||(metadata.contentFormat!=='native-content-json')
   ||(!Array.isArray(metadata.selectedFields)))throw new PolicyInputBindingError('Original tool declaration source metadata differs from its captured profile');
 const gaps=metadata.unobservedMetadata??[];
 if((!Array.isArray(gaps))||(gaps.length>4_096))throw new PolicyInputBindingError('Original tool declaration metadata gaps exceed their captured profile');
 return Object.freeze(gaps.map(function validateToolMetadataGap(gap) {
  if((!gap)||Array.isArray(gap)
    ||(Object.keys(gap)
      .length
      !==3)
    ||(!Number.isSafeInteger(gap.ordinal))
    ||(gap.ordinal<0)
    ||(gap.ordinal>=4_096)
    ||((typeof gap.key)!=='string')
    ||(Buffer.byteLength(gap.key)>65_536)
    ||(![
      'accessor',
      'non-enumerable',
      'symbol',
      'unsupported-field'
    ].includes(gap.reason)))throw new PolicyInputBindingError('Original tool declaration metadata gap has an unsupported position, field or observation reason');
  return Object.freeze({
    ordinal:gap.ordinal,
    key:gap.key,
    reason:gap.reason
  });
 }));
}

/**
 Unread fields remain explicit obligations even if every captured clause is interpreted as none.
 An empty result means no recorded metadata gap, not complete host-domain coverage or delegation.
 */
export function inspectToolMetadataPremises(source){
 if(![
   'native-tool-description-input',
   'native-resource-tool-input',
   'native-tool-loadout-input'
 ].includes(source.source
   ?.kind))return Object.freeze([]);
 const gaps=readGaps(source.source);
 if(gaps.length === 0)return Object.freeze([]);
 return Object.freeze([Object.freeze({
   premise:'complete-governing-source-coverage-and-delegation',
   kind:'tool-metadata-observation-gap',
   source,
   gaps,
   reason:`Original tool declaration metadata was not captured: ${gaps.map(function describeToolMetadataGap(gap) { return (`entry ${gap.ordinal} field ${JSON.stringify(gap.key)} (${gap.reason})`); })
     .join(', ')}. Interpretations of captured text cannot account for these fields. Restoring the declaration does not repair its original receipt; a supported original-input observation is required.`
 })]);
}
