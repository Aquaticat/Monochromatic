import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApprovedChangeControl} from './approved-change-controls.ts';

//region Select and validate one authored native-domain contrast before constructing resources.
export async function readDomainFixtureSettings(){
const relation=process.argv[2]??'prohibition';
  const requireResolution=process.argv
    .includes('--require-resolution');
assert.ok([
  'permission',
  'prohibition',
  'none'
].includes(relation));
const text={
  permission:'The complete proposed operation is permitted.',
  prohibition:'The complete proposed operation is prohibited.',
  none:'Use sentence case in the final response.'
}[relation];
const unobservedContext=process.argv
  .includes('--unobserved-event');
const observedContext=process.argv
  .includes('--observed-context');
const observedProgress=process.argv
  .includes('--observed-progress');
const nextDecision=process.argv
  .includes('--next-decision');
const approvedChange=process.argv
  .find(function changeArgument(argument){return argument.startsWith('--approved-change=');})
  ?.slice('--approved-change='.length);
const changeControl=createApprovedChangeControl(approvedChange);
const nextInput='The later received input prohibits the complete proposed operation.';
const nextResult='The later received result prohibits the complete proposed operation.';
assert.ok(
  (!nextDecision)||observedProgress,
  'Next-decision receipt controls require original progress delivery'
);
const throwingContext=process.argv
  .includes('--throwing-context');
const httpTransport=process.argv
  .includes('--http-transport');
const operatingPolicy=process.argv
  .includes('--operating-policy');
const unconfiguredPolicies=process.argv
  .includes('--unconfigured-policies');
assert.ok(
  !(operatingPolicy&&unconfiguredPolicies),
  'Unconfigured-policy verification cannot also select operating policies'
);
const singleCall=process.argv
  .find(function isSingleCallOption(argument) { return (argument.startsWith('--single-call=')); })
  ?.slice('--single-call='.length);
assert.ok((singleCall===undefined)||[
  'direct',
  'binding'
].includes(singleCall));
const expectedExecutions=singleCall===undefined?3:1;
const extensionManifestArgument=process.argv
  .find(function isExtensionManifestArgument(argument){return argument.startsWith('--extension-manifest=');});
const configuredExtensions=extensionManifestArgument===undefined?[]:JSON.parse(await readFile(
  extensionManifestArgument.slice('--extension-manifest='.length),
  'utf8'
));
assert.ok(Array.isArray(configuredExtensions));
assert.ok(configuredExtensions.every(function originalExtensionPath(resource){return ((typeof resource.path)==='string')&&(resource.enabled===true);}));
const lowConfidenceClause=process.argv
  .includes('--low-confidence-clause');
const unresolvedClause=process.argv
  .includes('--unknown-clause')?'unknown':process.argv
    .includes('--unsupported-clause')?'unsupported':undefined;
assert.ok(
  (!(lowConfidenceClause||unresolvedClause))||operatingPolicy,
  'Admission contrasts require the adopted operating policy'
);
assert.ok(
  (!throwingContext)||observedContext,
  'Throwing context controls require the observed native context route'
);
const sdkStream=process.argv
  .includes('--sdk-stream');
const receiptControl=process.argv
  .includes('--copied-payload')?'copied-payload':process.argv
    .includes('--copied-transcript')?'copied-transcript':process.argv
      .includes('--copied-system')?'copied-system':process.argv
        .includes('--copied-tool')?'copied-tool':process.argv
          .includes('--copied-tools')?'copied-tools':process.argv
            .includes('--changed-tool')?'changed-tool':undefined;
assert.ok(
  (!receiptControl)||sdkStream,
  'Serializer receipt controls exercise the normal SDK stream'
);
const providerMetadata=process.argv
  .find(function metadataArgument(argument){return argument.startsWith('--provider-metadata=');})
  ?.slice('--provider-metadata='.length);
assert.ok((providerMetadata===undefined)||[
  'thinking',
  'extension'
].includes(providerMetadata));
assert.ok(
  (!providerMetadata)||sdkStream,
  'Provider metadata contrasts require original SDK serialization'
);
 return {relation,requireResolution,text,unobservedContext,observedContext,observedProgress,nextDecision,approvedChange,changeControl,nextInput,nextResult,throwingContext,httpTransport,operatingPolicy,unconfiguredPolicies,singleCall,expectedExecutions,extensionManifestArgument,configuredExtensions,lowConfidenceClause,unresolvedClause,sdkStream,receiptControl,providerMetadata};
}
//endregion
