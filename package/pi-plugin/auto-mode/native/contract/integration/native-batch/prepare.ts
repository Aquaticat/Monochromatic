/**
 Prepare the maintained native SDK graph with retained original source and runtime ownership.

 @module
 */
import {
  copyFile,
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {
  dirname,
  join
} from 'node:path';
import {pathToFileURL} from 'node:url';







import {prepareNativeHost} from '../native-host/prepare.ts';
import {
  createImportEntryReader,
  NativeBatchBuildError
} from './build-entries.ts';
import {createNativeImportRewriter} from './build-rebase.ts';
import {prepareSession} from './prepare-session.ts';
import {prepareResources} from './prepare-resources.ts';
import {prepareAgent} from './prepare-agent.ts';
import {prepareProgram} from './prepare-program.ts';
import {
  sdk,
  core,
  ai,
  codemode,
  tui,
  maintainedRoot
} from '../current-sdk/paths.ts';
import { tagged } from '@monochromatic-dev/module-logger/ts';

//region Qualified native source preparation captures package identities before generated publication

/**
 The native preparation entry keeps its own build diagnostic boundary.
 */
const l = tagged({tag:'auto-mode-native-prepare'});

/**
 Read the qualified original SDK release for the completed build receipt.

 @returns release string from the emitted SDK package manifest

 @throws NativeBatchBuildError when the qualified package version is missing
 */
async function readSdkVersion(): Promise<string> {
 /**
  Release reporting retains a diagnostic boundary separate from source instrumentation.
  */
 const rl=tagged({
   tag:readSdkVersion.name,
   l
 });
 rl.debug('reading qualified native SDK version');
 /**
  Parsed manifest fields remain unknown until the release string is checked.
  */
 const manifest: unknown=JSON.parse(await readFile(
   join(
     sdk,
     'package.json'
   ),
   'utf8'
 ));
 if (((typeof manifest) !== 'object') || (manifest === null)
   || (!('version' in manifest))
   || ((typeof manifest.version) !== 'string')) throw new NativeBatchBuildError('Qualified native SDK package version is unavailable');
 return manifest.version;
}

l.debug('preparing qualified original native source graph');
/**
 The original release is captured before generated modules are published.
 */
const sdkVersion=await readSdkVersion();


/**
 The original provider module supplies installed serializer imports and message conversion.
 */
const providerPath=join(
  ai,
  'dist/api/openai-completions.js'
);
/**
 The original provider dependency resolves from its installed package graph.
 */
const openaiRoot=dirname(createRequire(pathToFileURL(providerPath))
  .resolve('openai'));
/**
 Captured package manifests supply pure import selection during source preparation.
 */
const entry=await createImportEntryReader({roots:[
  core,
  ai,
  codemode,
  tui,
  maintainedRoot,
  openaiRoot
]});
/**
 Native module import rewriting retains original dependency identities and explicit overrides.
 */
const imports=createNativeImportRewriter({entry});

/**
 The copied contract owns this build occurrence's generated native modules.
 */
const output=join(
  import.meta.dirname,
  'generated'
);
await mkdir(
  output,
  {
    recursive:true,
    mode:0o700
  }
);
/**
 The maintained package entry supplies the canonical policy and approval implementation.
 */
const maintainedEntry=entry({root:maintainedRoot});
// The incumbent stager owns import aliases. Native fixtures may change HOME after this link is prepared.
await writeFile(
  join(
    output,
    'maintained-policy.mjs'
  ),
  `import {flushPolicyDiagnostics} from ${JSON.stringify(maintainedEntry)};\nawait flushPolicyDiagnostics();\n`
 +`export {askUser,createAssessmentSender,VERDICT_ENTRY_TYPE,AuthorizationEvidenceError,captureAuthorizationInputs,captureAuthorizationOwnerFactory,MISSING_AUTHORIZATION_EVIDENCE,assertOriginalInputBudget,InputReceiptBudgetError,resolveInstructionEffects,InstructionResolutionInputError,inspectAuthorizationRequirements,resolveGuardOutcome,lowerEstablishedClause,CLAUSE_RELATIONS,createNativeQueryObservation,installNativePolicyHooks,NativePolicyRuntimeError,consumeRequestMaterial,retainRequestMaterialObligations,SemanticAdmissionPolicyError,copySemanticAdmissionPolicy,inspectSemanticAdmissionScope,consumeHeadingContexts,consumeUnitAdoptions,selectUnitAdoptionPairs,UnitAdoptionBindingError,consumeSourceAssociations,PolicyInputBindingError,flushPolicyDiagnostics} from ${JSON.stringify(maintainedEntry)};\n`
    +`export const maintainedPolicyEntry=${JSON.stringify(maintainedEntry)};\nexport const maintainedPackageRoot=${JSON.stringify(maintainedRoot)};\n`,
  {mode:0o600}
);
await prepareResources({
  output,
  entry,
  imports
});
await prepareAgent({
  output,
  entry,
  imports
});
await prepareSession({
  output,
  entry,
  imports,
  providerPath,
  openaiRoot
});
await prepareProgram({
  output,
  imports
});
await copyFile(
  join(
    import.meta.dirname,
    'PI-LICENSE.txt'
  ),
  join(
    output,
    'LICENSE'
  )
);
await prepareNativeHost({output});
console.log(JSON.stringify({
  complete:true,
  SDKVersion:sdkVersion,
  copiedModules:13,
  installedSourcesModified:false
}));

//endregion Qualified native source preparation captures package identities before generated publication
