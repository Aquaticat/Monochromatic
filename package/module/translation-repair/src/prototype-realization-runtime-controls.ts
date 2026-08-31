// PROTOTYPE ONLY: Candidate G graph restart and isolation controls.

import { link, mkdir, mkdtemp, readFile, readdir, rm, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { wait, } from '@monochromatic-dev/module-async-time/ts';

import { hashContent, } from './document-node.ts';
import {
  createRealizationLifecycleFixture,
  REALIZATION_LIFECYCLE_ARCHIVE,
  REALIZATION_LIFECYCLE_MEDIA,
  REALIZATION_LIFECYCLE_SOURCE,
  realizationLifecycleResponseForRequest,
  type RealizationLifecycleFixture,
} from './prototype-realization-lifecycle-fixture.ts';
import { realizationAuthorMessages, } from './prototype-realization-prompt.ts';
import { acquireRealizationRuntimeLease, } from './prototype-realization-runtime-lease.ts';
import type {
  RealizationBoundClient,
  RealizationRuntimeResult,
} from './prototype-realization-runtime.ts';
import {
  bindRealizationClient,
  runRealizationRuntime,
} from './prototype-realization-runtime.ts';
import { createRealizationScriptedClient, } from './prototype-realization-scripted-client.ts';

/** Executes one graph with fixture prompts and one provider-bound client. */
async function runFixtureGraph({
  outputDir,
  fixture,
  boundClient,
  expectedManifestDigest = fixture.manifest.manifestDigest,
  restart,
  signal = new AbortController().signal,
}: {
  readonly outputDir: string;
  readonly fixture: RealizationLifecycleFixture;
  readonly boundClient: RealizationBoundClient;
  readonly expectedManifestDigest?: string;
  readonly restart: boolean;
  readonly signal?: AbortSignal;
}): Promise<RealizationRuntimeResult> {
  return await runRealizationRuntime({
    outputDir,
    boundClient,
    manifest: fixture.manifest,
    expectedManifestDigest,
    shell: fixture.shell,
    ledger: fixture.ledger,
    sourceText: REALIZATION_LIFECYCLE_SOURCE,
    archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
    media: REALIZATION_LIFECYCLE_MEDIA,
    restart,
    signal,
  },);
}

/** Captures expected rejection without changing thrown identity. */
async function capturedFailure(work: () => Promise<unknown>): Promise<unknown> {
  try {
    await work();
  }
  catch (error) {
    return error;
  }
  throw new Error('realization lifecycle expected rejection was absent');
}

/** Proves internal node and settlement constructors are absent from package API. */
async function assertRealizationInternalsAreBlocked(): Promise<void> {
  const specifiers = [
    '@monochromatic-dev/module-translation-repair/ts/prototype-realization-author-settlement',
    '@monochromatic-dev/module-translation-repair/ts/prototype-realization-author-wave',
    '@monochromatic-dev/module-translation-repair/ts/prototype-realization-verifier-wave',
    '@monochromatic-dev/module-translation-repair/prototype-realization-test-support',
  ];
  for (const specifier of specifiers) {
    let blocked = false;
    try {
      await import(specifier,);
    }
    catch (error) {
      blocked = (typeof error === 'object')
        && (error !== null)
        && ('code' in error)
        && (error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED');
    }
    if (!blocked)
      throw new Error('realization internal package subpath is publicly importable');
  }
}

/** Proves fixed payload count, restart reuse, bindings, raw guard, and provider isolation. */
export async function runRealizationRuntimeControls(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'realization-runtime-',),);
  try {
    await assertRealizationInternalsAreBlocked();
    const fixture = createRealizationLifecycleFixture();
    const responseForRequest = realizationLifecycleResponseForRequest({ fixture, });
    const firstPlan = fixture.manifest.candidatePlan[0];
    const firstMedia = REALIZATION_LIFECYCLE_MEDIA[0];
    if ((firstPlan === undefined) || (firstMedia === undefined))
      throw new Error('realization media binding fixture is absent');
    const mediaFailure = await capturedFailure(async function substitutedImageBytes() {
      await Promise.resolve(realizationAuthorMessages({
        plan: firstPlan,
        manifest: fixture.manifest,
        shell: fixture.shell,
        ledger: fixture.ledger,
        sourceText: REALIZATION_LIFECYCLE_SOURCE,
        archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
        media: [{ ...firstMedia, dataUri: 'data:image/webp;base64,AQ==', },],
      },));
    },);
    if (!(mediaFailure instanceof Error) || !mediaFailure.message.includes('media binding differs'))
      throw new Error('realization exact image payload binding control failed');
    const successDir = join(root, 'success',);
    await mkdir(successDir,);
    const successClient = createRealizationScriptedClient({ responseForRequest, });
    const excludedSyntheticClient = createRealizationScriptedClient({ responseForRequest, });
    const successBoundClient = bindRealizationClient({
      manifest: fixture.manifest,
      outputDir: successDir,
      clients: {
        all: successClient.client,
        synthetic: excludedSyntheticClient.client,
        hyper: successClient.client,
      },
    },);
    const preAbortController = new AbortController();
    const preAbortReason = new Error('realization pre-dispatch exact abort');
    preAbortController.abort(preAbortReason,);
    const preAbortDir = join(root, 'pre-aborted',);
    const preAbortCaught = await capturedFailure(async function preAbortedGraph() {
      await runFixtureGraph({
        outputDir: preAbortDir,
        fixture,
        boundClient: bindRealizationClient({
          manifest: fixture.manifest,
          outputDir: preAbortDir,
          clients: {
            all: successClient.client,
            synthetic: excludedSyntheticClient.client,
            hyper: successClient.client,
          },
        },),
        restart: false,
        signal: preAbortController.signal,
      },);
    },);
    if ((preAbortCaught !== preAbortReason) || (successClient.calls.length !== 0))
      throw new Error('realization pre-aborted graph identity control failed');
    const first = await runFixtureGraph({
      outputDir: successDir,
      fixture,
      boundClient: successBoundClient,
      restart: false,
    },);
    const claimDir = join(successDir, 'prompt-claims', fixture.manifest.manifestDigest,);
    const claimFiles = await readdir(claimDir,);
    const claimStates = await Promise.all(claimFiles.map(async function state(file,) {
      const claim = JSON.parse(await readFile(join(claimDir, file,), 'utf8',),) as {
        readonly state?: string;
      };
      return claim.state;
    },),);
    if ((successClient.calls.length !== fixture.manifest.payloadCeiling)
      || (claimFiles.length !== fixture.manifest.payloadCeiling)
      || claimStates.some(function reusable(state,) { return state !== 'spent-unusable'; })
      || (excludedSyntheticClient.calls.length !== 0)
      || (first.completedNodeCount !== fixture.manifest.payloadCeiling)
      || (first.spentUnusableNodeCount !== 0)
      || (first.authorStates.length !== fixture.manifest.candidatePlan.length)
      || (first.verifierStates.length !== fixture.manifest.verifierModelIds.length)
      || (first.selection?.evidenceFloorMet !== true))
      throw new Error('realization fixed graph execution control failed');
    const promptKeys = first.authorStates.concat(first.verifierStates,)
      .map(function key(state,) { return `${state.record.modelId}:${state.record.basePromptDigest}`; });
    if ((new Set(promptKeys,).size !== promptKeys.length)
      || first.authorStates.concat(first.verifierStates,)
      .some(function absent(state,) { return state.record.replyCacheKey !== state.record.basePromptDigest; }))
      throw new Error('realization prompt uniqueness or cache eligibility control failed');
    const restarted = await runFixtureGraph({
      outputDir: successDir,
      fixture,
      boundClient: successBoundClient,
      restart: true,
    },);
    if ((successClient.calls.length !== fixture.manifest.payloadCeiling)
      || (restarted.completedNodeCount !== fixture.manifest.payloadCeiling)
      || (restarted.selection?.candidate.candidateDigest !== first.selection?.candidate.candidateDigest))
      throw new Error('realization deterministic restart control failed');
    const verifierPlanPath = join(successDir, 'verifier-wave-plan.json',);
    const verifierPlanText = await readFile(verifierPlanPath, 'utf8',);
    const verifierPlanValue = JSON.parse(verifierPlanText,) as Readonly<Record<string, unknown>>;
    await writeFile(verifierPlanPath, `${JSON.stringify({
      ...verifierPlanValue,
      verifierSchemaDigest: 'f'.repeat(64,),
    }, null, 2,)}\n`,);
    const verifierPlanFailure = await capturedFailure(async function driftedVerifierPlan() {
      await runFixtureGraph({
        outputDir: successDir,
        fixture,
        boundClient: successBoundClient,
        restart: true,
      },);
    },);
    await writeFile(verifierPlanPath, verifierPlanText,);
    if (!(verifierPlanFailure instanceof Error)
      || !verifierPlanFailure.message.includes('verifier wave plan restart binding differs')
      || (successClient.calls.length !== fixture.manifest.payloadCeiling))
      throw new Error('realization immutable verifier wave plan control failed');
    const durableReuseClient = createRealizationScriptedClient({ responseForRequest, });
    const durableBoundClient = bindRealizationClient({
      manifest: fixture.manifest,
      outputDir: successDir,
      clients: {
        all: durableReuseClient.client,
        synthetic: excludedSyntheticClient.client,
        hyper: durableReuseClient.client,
      },
    },);
    const durableRestart = await runFixtureGraph({
      outputDir: successDir,
      fixture,
      boundClient: durableBoundClient,
      restart: true,
    },);
    if ((durableReuseClient.calls.length !== 0)
      || (durableRestart.completedNodeCount !== fixture.manifest.payloadCeiling))
      throw new Error('realization durable canonical prompt restart control failed');
    const storedResponsePath = join(successDir, 'response-realization-author-0.json',);
    const storedResponse = await readFile(storedResponsePath, 'utf8',);
    const duplicateStoredResponse = storedResponse.replace('{\n', '{\n  "slots": [],\n',);
    const storedNodePath = join(successDir, 'node-realization-author-0.json',);
    const storedNode = JSON.parse(await readFile(storedNodePath, 'utf8',),) as {
      readonly [key: string]: unknown;
    };
    await writeFile(storedResponsePath, duplicateStoredResponse,);
    await writeFile(storedNodePath, `${JSON.stringify({
      ...storedNode,
      responseDigest: hashContent({ content: duplicateStoredResponse, }),
    }, null, 2,)}\n`,);
    const rawRestartFailure = await capturedFailure(async function duplicateStoredMember() {
      await runFixtureGraph({
        outputDir: successDir,
        fixture,
        boundClient: durableBoundClient,
        restart: true,
      },);
    },);
    if (!(rawRestartFailure instanceof Error)
      || (rawRestartFailure.constructor.name !== 'RealizationJsonMemberError')
      || (successClient.calls.length !== fixture.manifest.payloadCeiling))
      throw new Error('realization restart raw-member revalidation control failed');

    const beforeBindingFailure = successClient.calls.length;
    const bindingFailure = await capturedFailure(async function wrongOutputRoot() {
      await runFixtureGraph({
        outputDir: join(root, 'output-mismatch',),
        fixture,
        boundClient: successBoundClient,
        restart: false,
      },);
    },);
    if (!(bindingFailure instanceof Error)
      || !bindingFailure.message.includes('provider or output binding differs')
      || (successClient.calls.length !== beforeBindingFailure)
      || (excludedSyntheticClient.calls.length !== 0))
      throw new Error('realization one-provider and output binding control failed');
    const digestFailure = await capturedFailure(async function wrongManifestDigest() {
      await runFixtureGraph({
        outputDir: successDir,
        fixture,
        boundClient: successBoundClient,
        expectedManifestDigest: '0'.repeat(64,),
        restart: false,
      },);
    },);
    if (!(digestFailure instanceof Error)
      || !digestFailure.message.includes('manifest identity differs')
      || (successClient.calls.length !== beforeBindingFailure))
      throw new Error('realization exact manifest digest control failed');

    const duplicateDir = join(root, 'duplicate-author',);
    await mkdir(duplicateDir,);
    const duplicatePlan = fixture.manifest.candidatePlan[0];
    if (duplicatePlan === undefined)
      throw new Error('realization duplicate fixture author is absent');
    const duplicateClient = createRealizationScriptedClient({
      responseForRequest,
      duplicateSchemaName: 'verified_realization_author',
      duplicateModelId: duplicatePlan.modelId,
    },);
    const duplicate = await runFixtureGraph({
      outputDir: duplicateDir,
      fixture,
      boundClient: bindRealizationClient({
        manifest: fixture.manifest,
        outputDir: duplicateDir,
        clients: {
          all: duplicateClient.client,
          synthetic: excludedSyntheticClient.client,
          hyper: duplicateClient.client,
        },
      },),
      restart: false,
    },);
    const rejected = duplicate.authorStates.find(function unusable(state,) {
      return state.record.failureType === 'RealizationJsonMemberError';
    },);
    if ((duplicateClient.calls.length !== fixture.manifest.payloadCeiling)
      || (duplicate.authorStates.filter(function admitted(state,) { return state.candidate !== undefined; }).length !== 1)
      || (duplicate.verifierStates.length !== fixture.manifest.verifierModelIds.length)
      || (rejected === undefined))
      throw new Error('realization raw duplicate no-effect control failed');

    const duplicateVerifierDir = join(root, 'duplicate-verifier',);
    await mkdir(duplicateVerifierDir,);
    const duplicateVerifierModelId = fixture.manifest.verifierModelIds[0];
    if (duplicateVerifierModelId === undefined)
      throw new Error('realization duplicate fixture verifier is absent');
    const duplicateVerifierClient = createRealizationScriptedClient({
      responseForRequest,
      duplicateSchemaName: 'verified_realization_ballot',
      duplicateModelId: duplicateVerifierModelId,
    },);
    const duplicateVerifier = await runFixtureGraph({
      outputDir: duplicateVerifierDir,
      fixture,
      boundClient: bindRealizationClient({
        manifest: fixture.manifest,
        outputDir: duplicateVerifierDir,
        clients: {
          all: duplicateVerifierClient.client,
          synthetic: excludedSyntheticClient.client,
          hyper: duplicateVerifierClient.client,
        },
      },),
      restart: false,
    },);
    if ((duplicateVerifierClient.calls.length !== fixture.manifest.payloadCeiling)
      || (duplicateVerifier.verifierStates.filter(function admitted(state,) { return state.ballot !== undefined; }).length !== 1)
      || (duplicateVerifier.selection?.evidenceFloorMet !== false)
      || !duplicateVerifier.verifierStates.some(function rejectedBallot(state,) {
        return state.record.failureType === 'RealizationJsonMemberError';
      },))
      throw new Error('realization verifier raw duplicate abstention control failed');

    const allUnusableDir = join(root, 'all-authors-unusable',);
    await mkdir(allUnusableDir,);
    const allUnusableClient = createRealizationScriptedClient({
      responseForRequest,
      duplicateSchemaName: 'verified_realization_author',
    },);
    const allUnusable = await runFixtureGraph({
      outputDir: allUnusableDir,
      fixture,
      boundClient: bindRealizationClient({
        manifest: fixture.manifest,
        outputDir: allUnusableDir,
        clients: {
          all: allUnusableClient.client,
          synthetic: excludedSyntheticClient.client,
          hyper: allUnusableClient.client,
        },
      },),
      restart: false,
    },);
    if ((allUnusableClient.calls.length !== fixture.manifest.candidatePlan.length)
      || (allUnusable.authorStates.length !== fixture.manifest.candidatePlan.length)
      || (allUnusable.verifierStates.length !== 0)
      || (allUnusable.skippedVerifierModelIds.length !== fixture.manifest.verifierModelIds.length)
      || (allUnusable.selection !== undefined))
      throw new Error('realization all-author terminal no-dynamic-work control failed');

    const handoffDir = join(root, 'lease-handoff',);
    await mkdir(handoffDir,);
    const handoffOwner = await acquireRealizationRuntimeLease({ outputDir: handoffDir, });
    const existingObserved = Promise.withResolvers<void>();
    const permitHandoff = Promise.withResolvers<void>();
    const handoffContender = acquireRealizationRuntimeLease({
      outputDir: handoffDir,
      afterExistingObserved: async function observed() {
        existingObserved.resolve();
        await permitHandoff.promise;
      },
    },);
    await existingObserved.promise;
    await handoffOwner[Symbol.asyncDispose]();
    permitHandoff.resolve();
    const handoffSuccessor = await handoffContender;
    await handoffSuccessor[Symbol.asyncDispose]();

    const ownershipDir = join(root, 'concurrent-owner',);
    await mkdir(ownershipDir,);
    const ownerClient = createRealizationScriptedClient({
      responseForRequest,
      delaySchemaName: 'verified_realization_author',
    },);
    const contenderClient = createRealizationScriptedClient({ responseForRequest, });
    const ownerRun = runFixtureGraph({
      outputDir: ownershipDir,
      fixture,
      boundClient: bindRealizationClient({
        manifest: fixture.manifest,
        outputDir: ownershipDir,
        clients: {
          all: ownerClient.client,
          synthetic: excludedSyntheticClient.client,
          hyper: ownerClient.client,
        },
      },),
      restart: false,
    },);
    for (const _attempt of Array.from({ length: 100, })) {
      if (ownerClient.calls.length > 0)
        break;
      await wait(10,);
    }
    const ownershipFailure = await capturedFailure(async function concurrentContender() {
      await runFixtureGraph({
        outputDir: ownershipDir,
        fixture,
        boundClient: bindRealizationClient({
          manifest: fixture.manifest,
          outputDir: ownershipDir,
          clients: {
            all: contenderClient.client,
            synthetic: excludedSyntheticClient.client,
            hyper: contenderClient.client,
          },
        },),
        restart: false,
      },);
    },);
    const ownerResult = await ownerRun;
    if (!(ownershipFailure instanceof Error)
      || (ownershipFailure.constructor.name !== 'RealizationRuntimeBusyError')
      || (contenderClient.calls.length !== 0)
      || (ownerResult.completedNodeCount !== fixture.manifest.payloadCeiling))
      throw new Error('realization concurrent runtime ownership control failed');
    const staleLeaseDir = join(root, 'stale-runtime-lease',);
    await mkdir(staleLeaseDir,);
    await writeFile(join(staleLeaseDir, 'realization-runtime.lock',), `${JSON.stringify({
      pid: 2_147_483_647,
      processStartIdentity: 'stale-fixture',
      token: 'stale-fixture',
    }, null, 2,)}\n`,);
    await mkdir(join(staleLeaseDir, 'realization-runtime.reclaim',),);
    const deadElectionCandidate = join(staleLeaseDir, 'dead-election-candidate.json',);
    await writeFile(deadElectionCandidate, `${JSON.stringify({
      pid: 2_147_483_647,
      processStartIdentity: 'dead-election',
      token: 'dead-election',
    }, null, 2,)}\n`,);
    await link(
      deadElectionCandidate,
      join(staleLeaseDir, '.realization-runtime.lock.reclaim-stale-fixture',),
    );
    const staleLeaseFirstClient = createRealizationScriptedClient({
      responseForRequest,
      delaySchemaName: 'verified_realization_author',
    },);
    const staleLeaseSecondClient = createRealizationScriptedClient({
      responseForRequest,
      delaySchemaName: 'verified_realization_author',
    },);
    const staleContenders = await Promise.allSettled([
      runFixtureGraph({
        outputDir: staleLeaseDir,
        fixture,
        boundClient: bindRealizationClient({
          manifest: fixture.manifest,
          outputDir: staleLeaseDir,
          clients: {
            all: staleLeaseFirstClient.client,
            synthetic: excludedSyntheticClient.client,
            hyper: staleLeaseFirstClient.client,
          },
        },),
        restart: false,
      },),
      runFixtureGraph({
        outputDir: staleLeaseDir,
        fixture,
        boundClient: bindRealizationClient({
          manifest: fixture.manifest,
          outputDir: staleLeaseDir,
          clients: {
            all: staleLeaseSecondClient.client,
            synthetic: excludedSyntheticClient.client,
            hyper: staleLeaseSecondClient.client,
          },
        },),
        restart: false,
      },),
    ],);
    const staleOwners = staleContenders.filter(function fulfilled(result,) { return result.status === 'fulfilled'; });
    const staleRejected = staleContenders.filter(function rejected(result,) { return result.status === 'rejected'; });
    const staleCallCount = staleLeaseFirstClient.calls.length + staleLeaseSecondClient.calls.length;
    if ((staleOwners.length !== 1)
      || (staleRejected.length !== 1)
      || (staleCallCount !== fixture.manifest.payloadCeiling)
      || !staleRejected.every(function busy(result,) {
        return (result.status === 'rejected')
          && (result.reason instanceof Error)
          && (result.reason.constructor.name === 'RealizationRuntimeBusyError');
      },))
      throw new Error('realization dead runtime lease atomic reclaim control failed');
    const firstHistory = await readdir(staleLeaseDir,);
    const subsequentLease = await acquireRealizationRuntimeLease({ outputDir: staleLeaseDir, });
    await subsequentLease[Symbol.asyncDispose]();
    const secondHistory = await readdir(staleLeaseDir,);
    if (!firstHistory.includes('.realization-runtime.lock.reclaim-stale-fixture',)
      || !firstHistory.every(function retained(name,) { return secondHistory.includes(name,); }))
      throw new Error('realization reclaim election history retention control failed');
    await writeFile(join(staleLeaseDir, 'realization-runtime.lock',), `${JSON.stringify({
      pid: 2_147_483_647,
      processStartIdentity: 'later-stale',
      token: 'later-stale',
    }, null, 2,)}\n`,);
    const laterLease = await acquireRealizationRuntimeLease({ outputDir: staleLeaseDir, });
    await laterLease[Symbol.asyncDispose]();
    const laterHistory = await readdir(staleLeaseDir,);
    if (!laterHistory.some(function later(name,) { return name.includes('reclaim-later-stale',); }))
      throw new Error('realization later stale token election path control failed');
    const unsafeTokenDir = join(root, 'unsafe-lease-token',);
    await mkdir(unsafeTokenDir,);
    await writeFile(join(unsafeTokenDir, 'realization-runtime.lock',), `${JSON.stringify({
      pid: 2_147_483_647,
      processStartIdentity: 'unsafe-token',
      token: '../unsafe',
    }, null, 2,)}\n`,);
    const unsafeTokenClient = createRealizationScriptedClient({ responseForRequest, });
    const unsafeTokenFailure = await capturedFailure(async function unsafeToken() {
      await runFixtureGraph({
        outputDir: unsafeTokenDir,
        fixture,
        boundClient: bindRealizationClient({
          manifest: fixture.manifest,
          outputDir: unsafeTokenDir,
          clients: {
            all: unsafeTokenClient.client,
            synthetic: excludedSyntheticClient.client,
            hyper: unsafeTokenClient.client,
          },
        },),
        restart: false,
      },);
    },);
    if (!(unsafeTokenFailure instanceof Error)
      || !unsafeTokenFailure.message.includes('lease record differs')
      || (unsafeTokenClient.calls.length !== 0))
      throw new Error('realization lease token path safety control failed');

    const transmittedDir = join(root, 'transmitted-failure',);
    await mkdir(transmittedDir,);
    const transmittedTarget = fixture.manifest.candidatePlan[0]?.modelId;
    if (transmittedTarget === undefined)
      throw new Error('realization transmitted fixture author is absent');
    const transmittedClient = createRealizationScriptedClient({
      responseForRequest,
      throwSchemaName: 'verified_realization_author',
      throwModelId: transmittedTarget,
    },);
    const transmitted = await runFixtureGraph({
      outputDir: transmittedDir,
      fixture,
      boundClient: bindRealizationClient({
        manifest: fixture.manifest,
        outputDir: transmittedDir,
        clients: {
          all: transmittedClient.client,
          synthetic: excludedSyntheticClient.client,
          hyper: transmittedClient.client,
        },
      },),
      restart: false,
    },);
    if ((transmittedClient.calls.length !== fixture.manifest.payloadCeiling)
      || (transmitted.authorStates.filter(function usable(state,) { return state.candidate !== undefined; }).length !== 1))
      throw new Error('realization transmitted failure setup control failed');
    const transmittedQuarantineClient = createRealizationScriptedClient({ responseForRequest, });
    const transmittedQuarantineFailure = await capturedFailure(async function quarantineTransmission() {
      await runFixtureGraph({
        outputDir: transmittedDir,
        fixture,
        boundClient: bindRealizationClient({
          manifest: fixture.manifest,
          outputDir: transmittedDir,
          clients: {
            all: transmittedQuarantineClient.client,
            synthetic: excludedSyntheticClient.client,
            hyper: transmittedQuarantineClient.client,
          },
        },),
        restart: false,
      },);
    },);
    if (!(transmittedQuarantineFailure instanceof Error)
      || !transmittedQuarantineFailure.message.includes('author wave settlement restart binding differs')
      || (transmittedQuarantineClient.calls.length !== 0))
      throw new Error('realization transmitted failure durable quarantine control failed');

    for (const wave of ['author', 'verifier',] as const) {
      const abortDir = join(root, `${wave}-wave-abort`,);
      await mkdir(abortDir,);
      const controller = new AbortController();
      const reason = new Error(`realization ${wave} wave exact abort`);
      const targetModelId = wave === 'author'
        ? fixture.manifest.candidatePlan[0]?.modelId
        : fixture.manifest.verifierModelIds[0];
      const delayedModelId = wave === 'author'
        ? fixture.manifest.candidatePlan[1]?.modelId
        : fixture.manifest.verifierModelIds[1];
      if ((targetModelId === undefined) || (delayedModelId === undefined))
        throw new Error('realization concurrent abort fixture model is absent');
      const abortClient = createRealizationScriptedClient({
        responseForRequest,
        abortAfterResponseSchemaName: wave === 'author' ? 'verified_realization_author' : 'verified_realization_ballot',
        abortAfterResponseModelId: targetModelId,
        abortController: controller,
        abortReason: reason,
        delaySchemaName: wave === 'author' ? 'verified_realization_author' : 'verified_realization_ballot',
        delayModelId: delayedModelId,
      },);
      const caught = await capturedFailure(async function abortWave() {
        await runFixtureGraph({
          outputDir: abortDir,
          fixture,
          boundClient: bindRealizationClient({
            manifest: fixture.manifest,
            outputDir: abortDir,
            clients: {
              all: abortClient.client,
              synthetic: excludedSyntheticClient.client,
              hyper: abortClient.client,
            },
          },),
          restart: false,
          signal: controller.signal,
        },);
      },);
      const nodePrefix = wave === 'author' ? 'realization-author' : 'realization-verifier';
      const failureTypes = await Promise.all([0, 1,].map(async function failureType(ordinal,) {
        const record = JSON.parse(await readFile(join(abortDir, `node-${nodePrefix}-${String(ordinal,)}.json`,), 'utf8',),) as {
          readonly failureType?: string;
        };
        return record.failureType;
      },),);
      const expectedCallCount = wave === 'author'
        ? fixture.manifest.candidatePlan.length
        : fixture.manifest.payloadCeiling;
      if ((caught !== reason)
        || (abortClient.calls.length !== expectedCallCount)
        || (failureTypes[0] !== 'CallerAbort')
        || (failureTypes[1] !== 'CallerAbort'))
        throw new Error(`realization ${wave} concurrent exact abort control failed`);
      const quarantineClient = createRealizationScriptedClient({ responseForRequest, });
      const quarantined = await runFixtureGraph({
        outputDir: abortDir,
        fixture,
        boundClient: bindRealizationClient({
          manifest: fixture.manifest,
          outputDir: abortDir,
          clients: {
            all: quarantineClient.client,
            synthetic: excludedSyntheticClient.client,
            hyper: quarantineClient.client,
          },
        },),
        restart: true,
      },);
      if ((quarantineClient.calls.length !== 0)
        || ((wave === 'author') && (quarantined.authorStates.some(function usable(state,) {
          return state.candidate !== undefined;
        },)))
        || ((wave === 'verifier') && (quarantined.verifierStates.some(function usable(state,) {
          return state.ballot !== undefined;
        },))))
        throw new Error(`realization ${wave} aborted-payload quarantine control failed`);
    }
  }
  finally {
    await rm(root, { recursive: true, force: true, },);
  }
}
