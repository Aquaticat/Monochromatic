// PROTOTYPE ONLY: Candidate G exact abort and indeterminate node controls.

import { mkdir, mkdtemp, readFile, rm, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { createRealizationAuthorSettlement, } from './prototype-realization-author-settlement.ts';
import { runRealizationAuthorNode, } from './prototype-realization-author-wave.ts';
import {
  createRealizationLifecycleFixture,
  REALIZATION_LIFECYCLE_ARCHIVE,
  REALIZATION_LIFECYCLE_MEDIA,
  REALIZATION_LIFECYCLE_PICTURES,
  REALIZATION_LIFECYCLE_SOURCE,
  realizationLifecycleResponseForRequest,
} from './prototype-realization-lifecycle-fixture.ts';
import {
  realizationAuthorMessages,
  realizationVerifierMessages,
} from './prototype-realization-prompt.ts';
import { createRealizationScriptedClient, } from './prototype-realization-scripted-client.ts';
import { runRealizationVerifierNode, } from './prototype-realization-verifier-wave.ts';
import type { SlotNodeRecord, } from './prototype-slot-runtime.ts';

/** Rewrites completed fixture node as transmitted without terminal settlement. */
async function markNodeDispatched({ outputDir, id, }: {
  readonly outputDir: string;
  readonly id: string;
}): Promise<void> {
  const path = join(outputDir, `node-${id}.json`,);
  const record = JSON.parse(await readFile(path, 'utf8',),) as SlotNodeRecord;
  const dispatched = {
    id: record.id,
    modelId: record.modelId,
    manifestDigest: record.manifestDigest,
    basePromptDigest: record.basePromptDigest,
    promptDigest: record.promptDigest,
    startedAt: record.startedAt,
    state: 'dispatched',
  } as const;
  await writeFile(path, `${JSON.stringify(dispatched, null, 2,)}\n`,);
  await rm(join(outputDir, `response-${id}.json`,), { force: true, });
}

/** Reads settled node evidence without trusting prior in-memory state. */
async function readNode({ outputDir, id, }: {
  readonly outputDir: string;
  readonly id: string;
}): Promise<SlotNodeRecord> {
  return JSON.parse(await readFile(join(outputDir, `node-${id}.json`,), 'utf8',),) as SlotNodeRecord;
}

/** Captures caller-abort identity from one node invocation. */
async function abortIdentity(work: () => Promise<unknown>): Promise<unknown> {
  try {
    await work();
  }
  catch (error) {
    return error;
  }
  throw new Error('realization abort fixture did not reject');
}

/** Proves both waves preserve exact abort identity and never redispatch transmitted nodes. */
export async function runRealizationNodeLifecycleControls(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'realization-node-lifecycle-',),);
  try {
    const fixture = createRealizationLifecycleFixture();
    const plan = fixture.manifest.candidatePlan[0];
    const secondPlan = fixture.manifest.candidatePlan[1];
    const verifierModelId = fixture.manifest.verifierModelIds[0];
    if ((plan === undefined) || (secondPlan === undefined) || (verifierModelId === undefined))
      throw new Error('realization lifecycle manifest fixture is empty');
    const responseForRequest = realizationLifecycleResponseForRequest({ fixture, });
    const authorMessages = realizationAuthorMessages({
      plan,
      manifest: fixture.manifest,
      shell: fixture.shell,
      ledger: fixture.ledger,
      sourceText: REALIZATION_LIFECYCLE_SOURCE,
      archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
      media: REALIZATION_LIFECYCLE_MEDIA,
    },);
    const authorDir = join(root, 'author-indeterminate',);
    await mkdir(authorDir,);
    const authorInitial = createRealizationScriptedClient({ responseForRequest, });
    const firstAuthorState = await runRealizationAuthorNode({
      outputDir: authorDir,
      client: authorInitial.client,
      plan,
      manifest: fixture.manifest,
      expectedManifestDigest: fixture.manifest.manifestDigest,
      messages: authorMessages,
      shell: fixture.shell,
      ledger: fixture.ledger,
      sourceText: REALIZATION_LIFECYCLE_SOURCE,
      archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
      sourcePictures: REALIZATION_LIFECYCLE_PICTURES,
      restart: false,
      signal: new AbortController().signal,
    },);
    const secondAuthorState = await runRealizationAuthorNode({
      outputDir: authorDir,
      client: authorInitial.client,
      plan: secondPlan,
      manifest: fixture.manifest,
      expectedManifestDigest: fixture.manifest.manifestDigest,
      messages: realizationAuthorMessages({
        plan: secondPlan,
        manifest: fixture.manifest,
        shell: fixture.shell,
        ledger: fixture.ledger,
        sourceText: REALIZATION_LIFECYCLE_SOURCE,
        archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
        media: REALIZATION_LIFECYCLE_MEDIA,
      },),
      shell: fixture.shell,
      ledger: fixture.ledger,
      sourceText: REALIZATION_LIFECYCLE_SOURCE,
      archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
      sourcePictures: REALIZATION_LIFECYCLE_PICTURES,
      restart: false,
      signal: new AbortController().signal,
    },);
    const authorSettlement = createRealizationAuthorSettlement({
      states: [firstAuthorState, secondAuthorState,],
      manifest: fixture.manifest,
    },);
    const cacheMismatchClient = createRealizationScriptedClient({ responseForRequest, });
    const promptMismatch = await abortIdentity(async function changedPromptRestart() {
      await runRealizationAuthorNode({
        outputDir: authorDir,
        client: cacheMismatchClient.client,
        plan,
        manifest: fixture.manifest,
        expectedManifestDigest: fixture.manifest.manifestDigest,
        messages: realizationAuthorMessages({
          plan,
          manifest: fixture.manifest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: `${REALIZATION_LIFECYCLE_SOURCE}drift`,
          archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
          media: REALIZATION_LIFECYCLE_MEDIA,
        },),
        shell: fixture.shell,
        ledger: fixture.ledger,
        sourceText: REALIZATION_LIFECYCLE_SOURCE,
        archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
        sourcePictures: REALIZATION_LIFECYCLE_PICTURES,
        restart: true,
        signal: new AbortController().signal,
      },);
    },);
    if (!(promptMismatch instanceof Error)
      || !promptMismatch.message.includes('restart binding differs')
      || (cacheMismatchClient.calls.length !== 0))
      throw new Error('realization author restart prompt binding control failed');
    const responsePath = join(authorDir, 'response-realization-author-0.json',);
    const responseText = await readFile(responsePath, 'utf8',);
    await writeFile(responsePath, `${responseText} `,);
    const responseDigestMismatch = await abortIdentity(async function changedResponseRestart() {
      await runRealizationAuthorNode({
        outputDir: authorDir,
        client: cacheMismatchClient.client,
        plan,
        manifest: fixture.manifest,
        expectedManifestDigest: fixture.manifest.manifestDigest,
        messages: authorMessages,
        shell: fixture.shell,
        ledger: fixture.ledger,
        sourceText: REALIZATION_LIFECYCLE_SOURCE,
        archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
        sourcePictures: REALIZATION_LIFECYCLE_PICTURES,
        restart: true,
        signal: new AbortController().signal,
      },);
    },);
    await writeFile(responsePath, responseText,);
    if (!(responseDigestMismatch instanceof Error)
      || !responseDigestMismatch.message.includes('response digest differs')
      || (cacheMismatchClient.calls.length !== 0))
      throw new Error('realization author restart response digest control failed');
    await markNodeDispatched({ outputDir: authorDir, id: 'realization-author-0', });
    const authorRestart = createRealizationScriptedClient({ responseForRequest, });
    const authorIndeterminate = await runRealizationAuthorNode({
      outputDir: authorDir,
      client: authorRestart.client,
      plan,
      manifest: fixture.manifest,
      expectedManifestDigest: fixture.manifest.manifestDigest,
      messages: authorMessages,
      shell: fixture.shell,
      ledger: fixture.ledger,
      sourceText: REALIZATION_LIFECYCLE_SOURCE,
      archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
      sourcePictures: REALIZATION_LIFECYCLE_PICTURES,
      restart: true,
      signal: new AbortController().signal,
    },);
    if ((authorRestart.calls.length !== 0)
      || (authorIndeterminate.record.failureType !== 'IndeterminateTransmission'))
      throw new Error('realization author indeterminate transmission control failed');

    const candidates = authorSettlement.rows.flatMap(function candidate(row,) {
      return row.state === 'completed' ? [row.candidate,] : [];
    },);
    const verifierMessages = realizationVerifierMessages({
      manifest: fixture.manifest,
      shell: fixture.shell,
      ledger: fixture.ledger,
      candidates,
      authorSettlementDigest: authorSettlement.settlementDigest,
      verifierPlanDigest: '8'.repeat(64,),
      sourceText: REALIZATION_LIFECYCLE_SOURCE,
      archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
      media: REALIZATION_LIFECYCLE_MEDIA,
    },);
    const verifierDir = join(root, 'verifier-indeterminate',);
    await mkdir(verifierDir,);
    const verifierInitial = createRealizationScriptedClient({ responseForRequest, });
    await runRealizationVerifierNode({
      outputDir: verifierDir,
      client: verifierInitial.client,
      verifierOrdinal: 0,
      verifierModelId,
      manifest: fixture.manifest,
      expectedManifestDigest: fixture.manifest.manifestDigest,
      messages: verifierMessages,
      authorSettlement,
      shell: fixture.shell,
      ledger: fixture.ledger,
      sourceText: REALIZATION_LIFECYCLE_SOURCE,
      archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
      sourcePictures: REALIZATION_LIFECYCLE_PICTURES,
      restart: false,
      signal: new AbortController().signal,
    },);
    const verifierCacheMismatchClient = createRealizationScriptedClient({ responseForRequest, });
    const verifierPromptMismatch = await abortIdentity(async function changedVerifierPromptRestart() {
      await runRealizationVerifierNode({
        outputDir: verifierDir,
        client: verifierCacheMismatchClient.client,
        verifierOrdinal: 0,
        verifierModelId,
        manifest: fixture.manifest,
        expectedManifestDigest: fixture.manifest.manifestDigest,
        messages: realizationVerifierMessages({
          manifest: fixture.manifest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          candidates,
          authorSettlementDigest: authorSettlement.settlementDigest,
          verifierPlanDigest: '9'.repeat(64,),
          sourceText: REALIZATION_LIFECYCLE_SOURCE,
          archiveText: `${REALIZATION_LIFECYCLE_ARCHIVE}drift`,
          media: REALIZATION_LIFECYCLE_MEDIA,
        },),
        authorSettlement,
        shell: fixture.shell,
        ledger: fixture.ledger,
        sourceText: REALIZATION_LIFECYCLE_SOURCE,
        archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
        sourcePictures: REALIZATION_LIFECYCLE_PICTURES,
        restart: true,
        signal: new AbortController().signal,
      },);
    },);
    if (!(verifierPromptMismatch instanceof Error)
      || !verifierPromptMismatch.message.includes('restart binding differs')
      || (verifierCacheMismatchClient.calls.length !== 0))
      throw new Error('realization verifier restart prompt binding control failed');
    await markNodeDispatched({ outputDir: verifierDir, id: 'realization-verifier-0', });
    const verifierRestart = createRealizationScriptedClient({ responseForRequest, });
    const verifierIndeterminate = await runRealizationVerifierNode({
      outputDir: verifierDir,
      client: verifierRestart.client,
      verifierOrdinal: 0,
      verifierModelId,
      manifest: fixture.manifest,
      expectedManifestDigest: fixture.manifest.manifestDigest,
      messages: verifierMessages,
      authorSettlement,
      shell: fixture.shell,
      ledger: fixture.ledger,
      sourceText: REALIZATION_LIFECYCLE_SOURCE,
      archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
      sourcePictures: REALIZATION_LIFECYCLE_PICTURES,
      restart: true,
      signal: new AbortController().signal,
    },);
    if ((verifierRestart.calls.length !== 0)
      || (verifierIndeterminate.record.failureType !== 'IndeterminateTransmission'))
      throw new Error('realization verifier indeterminate transmission control failed');

    for (const wave of ['author', 'verifier',] as const) {
      const outputDir = join(root, `${wave}-abort`,);
      await mkdir(outputDir,);
      const controller = new AbortController();
      const reason = new Error(`realization ${wave} exact abort`);
      const aborted = createRealizationScriptedClient({
        responseForRequest,
        abortSchemaName: wave === 'author' ? 'verified_realization_author' : 'verified_realization_ballot',
        abortController: controller,
        abortReason: reason,
      },);
      const caught = wave === 'author'
        ? await abortIdentity(async function abortAuthor() {
          await runRealizationAuthorNode({
            outputDir,
            client: aborted.client,
            plan,
            manifest: fixture.manifest,
            expectedManifestDigest: fixture.manifest.manifestDigest,
            messages: authorMessages,
            shell: fixture.shell,
            ledger: fixture.ledger,
            sourceText: REALIZATION_LIFECYCLE_SOURCE,
            archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
            sourcePictures: REALIZATION_LIFECYCLE_PICTURES,
            restart: false,
            signal: controller.signal,
          },);
        },)
        : await abortIdentity(async function abortVerifier() {
          await runRealizationVerifierNode({
            outputDir,
            client: aborted.client,
            verifierOrdinal: 0,
            verifierModelId,
            manifest: fixture.manifest,
            expectedManifestDigest: fixture.manifest.manifestDigest,
            messages: verifierMessages,
            authorSettlement,
            shell: fixture.shell,
            ledger: fixture.ledger,
            sourceText: REALIZATION_LIFECYCLE_SOURCE,
            archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
            sourcePictures: REALIZATION_LIFECYCLE_PICTURES,
            restart: false,
            signal: controller.signal,
          },);
        },);
      const nodeId = wave === 'author' ? 'realization-author-0' : 'realization-verifier-0';
      const record = await readNode({ outputDir, id: nodeId, });
      if ((caught !== reason) || (record.failureType !== 'CallerAbort'))
        throw new Error(`realization ${wave} exact abort identity control failed`);
    }
  }
  finally {
    await rm(root, { recursive: true, force: true, },);
  }
}
