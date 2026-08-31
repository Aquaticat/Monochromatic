import { createHash, } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  admitCandidateBallotAuthorResponse,
  admitCandidateBallotResponse,
  assertCandidateBallotManifest,
  bindCandidateBallotClient,
  buildImmutableShell,
  buildRealizationObligationLedger,
  candidateBallotHyperModel,
  candidateBallotHyperRouteDigest,
  candidateBallotModelsIndependent,
  candidateBallotResponseGuard,
  CANDIDATE_BALLOT_FINDING_CAP,
  compileCandidateBallotCandidate,
  compileCandidateBallotDocument,
  CONDITIONAL_DEFECT_CLASSES,
  createCandidateBallotHyperClient,
  createCandidateBallotManifest,
  diagnoseCandidateBallotResponse,
  MAX_CANDIDATE_BALLOT_PAYLOAD_COUNT,
  REALIZATION_GLOBAL_CRITERIA,
  runCandidateBallotRuntime,
  selectCandidateBallot,
  targetBoundariesForShell,
  type CandidateBallotAuthorSettlement,
  type CandidateBallotCandidate,
  type CandidateBallotManifest,
  type CandidateBallotResponse,
  type CandidateBallotRouteClient,
  type CandidateScopedBallot,
  type RealizationCandidatePlan,
} from '../dist/final/node/prototype-candidate-ballot.mjs';
import {
  bindCandidateBallotRouteClient,
  createCandidateBallotAuthorSettlement,
} from '../dist/final/node/prototype-candidate-ballot-test-support.mjs';
import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  isJsonRecord,
  type ModelTransport,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/** Disposable private runtime fixture root. */
type TemporaryDirectory = AsyncDisposable & { readonly path: string };

/** Creates disposable runtime root. */
async function temporaryDirectory(): Promise<TemporaryDirectory> {
  const path = await mkdtemp(join(tmpdir(), 'candidate-ballot-',),);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

/** SHA-256 over exact JavaScript string bytes. */
function digest({ text, }: { readonly text: string }): string {
  return createHash('sha256',).update(text,).digest('hex',);
}

/** Source carrying two clauses and one page image. */
const SOURCE = `---\nname: 猫\n---\n# 猫\n\n猫休息。猫醒来。\n\n<PhotoScroll photos={['\${path}/photos/fixture.webp']} />\n`;

/** Archive carrying destination shell authority. */
const ARCHIVE = `---\nname: Cat\n---\n# Cat\n\nThe cat rests. The cat wakes.\n\n<PhotoScroll photos={['\${path}/photos/fixture.webp']} />\n`;

/** Page image payload attached to every node. */
const DATA_URI = 'data:image/webp;base64,AA==';

/** Page image inventory and exact payload. */
const MEDIA = [{
  assetName: 'fixture.webp',
  dataUri: DATA_URI,
  digest: digest({ text: DATA_URI, }),
},] as const;

/** Sentinel proving expected abort was actually thrown. */
const ABORT_NOT_CAUGHT: unique symbol = Symbol('candidate ballot abort absent',);

/** Deliberately stale route ceiling proving manifest binding. */
const ALTERED_ROUTE_OUTPUT_TOKENS = 31_999;

/** Aborted getter read corresponding to immediate pre-verifier dispatch guard. */
const PRE_VERIFIER_ABORT_READ = 8;

/** Terminated Anthropic text stream for local route mapping control. */
const HYPER_TEXT_BODY = `${[
  { type: 'message_start', message: { usage: { input_tokens: 1, output_tokens: 1, }, }, },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', }, },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok', }, },
  { type: 'content_block_stop', index: 0, },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', }, usage: { output_tokens: 1, }, },
  { type: 'message_stop', },
].map(function line(event,) {
  return `data: ${JSON.stringify(event,)}`;
},).join('\n\n',)  }\n\n`;

/** Builds transport recording Candidate I wire model. */
function recordingCandidateHyperTransport({
  wire,
}: {
  readonly wire: { modelId: string };
}): ModelTransport {
  return async function record(exchange,) {
    const body: unknown = JSON.parse(exchange.bodyJson ?? '{}',);
    if ((!isJsonRecord(body,)) || ((typeof body.model) !== 'string'))
      throw new Error('candidate ballot Hyper wire model is absent');
    wire.modelId = body.model;
    return { status: 200, bodyText: HYPER_TEXT_BODY, };
  };
}

/** Builds signal becoming aborted exactly at selected getter read. */
function stagedAbortSignal({
  reason,
  abortAtRead,
  reads,
}: {
  readonly reason: unknown;
  readonly abortAtRead: number;
  readonly reads: { value: number };
}): AbortSignal {
  /** Real signal supplying event-target methods and internal brand. */
  const real = new AbortController().signal;
  /** Proxy overriding only cancellation observations. */
  const handler: ProxyHandler<AbortSignal> = {
    get(target, property, receiver,): unknown {
      if (property === 'aborted') {
        reads.value += 1;
        return reads.value >= abortAtRead;
      }
      if (property === 'reason')
        return reason;
      const value: unknown = Reflect.get(target, property, receiver,);
      return (typeof value) === 'function' ? value.bind(target,) : value;
    },
  };
  return new Proxy(real, handler,);
}

/** Binds scripted client to fixture route digest without provider traffic. */
function scriptedRouteClient({
  fixture,
  client,
}: {
  readonly fixture: Fixture;
  readonly client: SyntheticClient;
}): CandidateBallotRouteClient {
  return bindCandidateBallotRouteClient({
    client,
    providerRouteDigest: fixture.manifest.providerRouteDigest,
  },);
}

/** Complete deterministic fixture. */
type Fixture = {
  readonly shell: ReturnType<typeof buildImmutableShell>;
  readonly ledger: ReturnType<typeof buildRealizationObligationLedger>;
  readonly manifest: CandidateBallotManifest;
};

/** Creates two-author and three-verifier Hyper-only fixture. */
function createFixture(): Fixture {
  const shell = buildImmutableShell({ sourceText: SOURCE, archiveText: ARCHIVE, });
  const ledger = buildRealizationObligationLedger({
    sourceBody: shell.body,
    archiveBody: ARCHIVE,
    slots: shell.slots,
    shellDigest: shell.shellDigest,
  },);
  const candidatePlan = [
    { ordinal: 0, modelId: 'hf:Qwen/Qwen3.8-27B', priority: 0, },
    { ordinal: 1, modelId: 'minimax-m3', priority: 1, },
  ] as const satisfies readonly RealizationCandidatePlan[];
  const verifierPlan = [
    { ordinal: 0, modelId: 'hf:Qwen/Qwen3.8-27B', },
    { ordinal: 1, modelId: 'hf:zai-org/GLM-5.3-Flash', },
    { ordinal: 2, modelId: 'minimax-m3', },
  ] as const;
  const manifest = createCandidateBallotManifest({
    ledger,
    shell,
    archiveBody: ARCHIVE,
    candidatePlan,
    verifierPlan,
    providerSelection: 'hyper-only',
    sourcePictures: MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, digest: item.digest, };
    },),
  },);
  return { shell, ledger, manifest, };
}

/** Complete deterministic author slot map. */
function authorResponse({
  fixture,
  plan,
}: {
  readonly fixture: Fixture;
  readonly plan: RealizationCandidatePlan;
}): { readonly slots: Readonly<Record<string, string>> } {
  return {
    slots: Object.fromEntries(fixture.shell.slots.map(function slot(item, index,) {
      return [
        item.key,
        `Author ${String(plan.ordinal,)} complete English slot ${String(index,)}.`,
      ];
    },),),
  };
}

/** Runtime-bound candidates and total settlement. */
function settledFixture(): Fixture & {
  readonly candidates: readonly CandidateBallotCandidate[];
  readonly settlement: CandidateBallotAuthorSettlement;
} {
  const fixture = createFixture();
  const sourcePictures = MEDIA.map(function picture(item,) {
    return { assetName: item.assetName, };
  },);
  const candidates = fixture.manifest.candidatePlan.map(function candidate(plan,) {
    return admitCandidateBallotAuthorResponse({
      response: authorResponse({ fixture, plan, }),
      shell: fixture.shell,
      manifest: fixture.manifest,
      plan,
      sourceText: SOURCE,
      archiveText: ARCHIVE,
      sourcePictures,
    },);
  },);
  const settlement = createCandidateBallotAuthorSettlement({
    manifest: fixture.manifest,
    states: candidates.map(function state(candidate,) {
      return {
        record: {
          id: `candidate-ballot-author-${String(candidate.candidateOrdinal,)}`,
          modelId: candidate.modelId,
          manifestDigest: fixture.manifest.manifestDigest,
          basePromptDigest: digest({ text: `base-${candidate.candidateId}`, }),
          promptDigest: digest({ text: `prompt-${candidate.candidateId}`, }),
          startedAt: '2026-08-31T00:00:00.000Z',
          durationMs: 1,
          state: 'completed' as const,
        },
        candidate,
      };
    },),
  },);
  return { ...fixture, candidates, settlement, };
}

/** Complete checked-clean response for one candidate. */
function cleanResponse({
  fixture,
  candidate,
}: {
  readonly fixture: Fixture;
  readonly candidate: Pick<CandidateBallotCandidate, 'candidateId' | 'candidateDigest'>;
}): CandidateBallotResponse {
  return {
    candidateId: candidate.candidateId,
    candidateDigest: candidate.candidateDigest,
    obligationStatuses: 'p'.repeat(fixture.ledger.obligations.length,),
    globalStatuses: 'c'.repeat(REALIZATION_GLOBAL_CRITERIA.length,),
    overflow: false,
    findings: [],
  };
}

/** Builds exact target anchor inside first candidate slot. */
function anchor({
  candidate,
  startOffset = 0,
  endOffset = 3,
}: {
  readonly candidate: CandidateBallotCandidate;
  readonly startOffset?: number;
  readonly endOffset?: number;
}): CandidateBallotResponse['findings'][number]['targetAnchors'][number] {
  const [slotKey,] = Object.keys(candidate.slots,);
  if (slotKey === undefined)
    throw new Error('candidate ballot test slot is absent');
  const text = candidate.slots[slotKey];
  if (text === undefined)
    throw new Error('candidate ballot test text is absent');
  return {
    slotKey,
    startOffset,
    endOffset,
    digest: digest({ text: text.slice(startOffset, endOffset,), }),
  };
}

/** Admits one candidate-scoped response under planned verifier. */
function ballot({
  fixture,
  candidateOrdinal,
  verifierOrdinal,
  response,
}: {
  readonly fixture: ReturnType<typeof settledFixture>;
  readonly candidateOrdinal: number;
  readonly verifierOrdinal: number;
  readonly response: CandidateBallotResponse;
}): CandidateScopedBallot {
  const verifierModelId = fixture.manifest.verifierPlan[verifierOrdinal]?.modelId;
  if (verifierModelId === undefined)
    throw new Error('candidate ballot test verifier is absent');
  return admitCandidateBallotResponse({
    response,
    ledger: fixture.ledger,
    authorSettlement: fixture.settlement,
    candidateOrdinal,
    verifierOrdinal,
    verifierModelId,
    manifest: fixture.manifest,
    expectedManifestDigest: fixture.manifest.manifestDigest,
    shell: fixture.shell,
    sourceText: SOURCE,
    archiveText: ARCHIVE,
    sourcePictures: MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, };
    },),
  },);
}

/** Selects fixture ballots through full revalidation. */
function selection({
  fixture,
  ballots,
}: {
  readonly fixture: ReturnType<typeof settledFixture>;
  readonly ballots: readonly CandidateScopedBallot[];
}) {
  return selectCandidateBallot({
    authorSettlement: fixture.settlement,
    ballots,
    manifest: fixture.manifest,
    expectedManifestDigest: fixture.manifest.manifestDigest,
    ledger: fixture.ledger,
    shell: fixture.shell,
    sourceText: SOURCE,
    archiveText: ARCHIVE,
    sourcePictures: MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, };
    },),
  },);
}

/** Candidate evidence in canonical verifier packet. */
type CandidateEvidence = Pick<CandidateBallotCandidate, 'candidateId' | 'candidateDigest'>;

/** Guards anonymous candidate evidence. */
function isCandidateEvidence(value: unknown,): value is CandidateEvidence {
  return isJsonRecord(value,)
    && ((typeof value.candidateId) === 'string')
    && ((typeof value.candidateDigest) === 'string');
}

/** Reads canonical candidate verifier packet from request. */
function verifierPacket(
  request: ChatJsonRequest<unknown>,
): Readonly<Record<string, unknown>> {
  const [, message,] = request.messages;
  if ((message === undefined) || ((typeof message.content) === 'string'))
    throw new Error('candidate ballot verifier packet is absent');
  const textPart = message.content.find(function text(part,) {
    return part.type === 'text';
  },);
  if ((textPart === undefined) || (textPart.type !== 'text'))
    throw new Error('candidate ballot verifier packet text is absent');
  const marker = 'CANDIDATE_BALLOT_VERIFIER_PACKET:\n';
  const start = textPart.text.indexOf(marker,);
  if (start === (-1))
    throw new Error('candidate ballot verifier packet marker is absent');
  const value: unknown = JSON.parse(textPart.text.slice(start + marker.length,),);
  if (!isJsonRecord(value,))
    throw new Error('candidate ballot verifier packet differs');
  return value;
}

/** Returns deterministic value for author or scoped verifier request. */
function responseForRequest({ fixture, }: {
  readonly fixture: Fixture;
}): (request: ChatJsonRequest<unknown>) => unknown {
  return function response(request,): unknown {
    const schemaName = request.responseFormat?.json_schema.name;
    if (schemaName === 'immutable_shell_slots') {
      const plan = fixture.manifest.candidatePlan.find(function model(item,) {
        return item.modelId === request.modelId;
      },);
      if (plan === undefined)
        throw new Error('candidate ballot runtime author differs');
      return authorResponse({ fixture, plan, });
    }
    if (schemaName !== 'candidate_scoped_ballot')
      throw new Error('candidate ballot runtime schema differs');
    const packet = verifierPacket(request,);
    if (!isCandidateEvidence(packet.candidate,))
      throw new Error('candidate ballot runtime candidate evidence differs');
    return cleanResponse({
      fixture,
      candidate: packet.candidate,
    });
  };
}

/** Scripted client controls. */
type ScriptedControls = {
  readonly failAuthorOrdinal?: number;
  readonly duplicateRawCandidateOrdinal?: number;
};

/** Builds concurrent scriptable client with prompt evidence. */
function scriptedClient({
  fixture,
  controls = {},
  calls,
  prompts,
  peak,
}: {
  readonly fixture: Fixture;
  readonly controls?: ScriptedControls;
  readonly calls: string[];
  readonly prompts: string[];
  readonly peak: { value: number; inFlight: number };
}): SyntheticClient {
  const responseFor = responseForRequest({ fixture, });
  const authorBarrier = Promise.withResolvers<undefined>();
  const verifierBarrier = Promise.withResolvers<undefined>();
  const expectedVerifiers = controls.failAuthorOrdinal === undefined ? 6 : 3;
  return {
    chatText: async () => {
      await Promise.resolve();
      throw new Error('candidate ballot runtime chatText unused');
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      peak.inFlight += 1;
      peak.value = Math.max(peak.value, peak.inFlight,);
      const schemaName = request.responseFormat?.json_schema.name ?? '';
      calls.push(`${request.modelId}:${schemaName}`,);
      prompts.push(JSON.stringify(request.messages,),);
      const author = schemaName === 'immutable_shell_slots';
      const arrivals = calls.filter(function same(value,) {
        return value.endsWith(`:${schemaName}`,);
      },).length;
      if (author && (arrivals === 2))
        authorBarrier.resolve(undefined,);
      if ((!author) && (arrivals === expectedVerifiers))
        verifierBarrier.resolve(undefined,);
      await (author ? authorBarrier.promise : verifierBarrier.promise);
      if (author) {
        const plan = fixture.manifest.candidatePlan.find(function model(item,) {
          return item.modelId === request.modelId;
        },);
        if (plan?.ordinal === controls.failAuthorOrdinal) {
          peak.inFlight -= 1;
          return {
            kind: 'schema-mismatch',
            rawText: '{}',
            detail: 'caller guard rejected author',
            reason: 'caller-guard-rejected',
          };
        }
      }
      const value = responseFor(request,);
      if (!request.validate(value,))
        throw new Error('candidate ballot scripted response failed guard');
      let rawText = JSON.stringify(value,);
      if ((!author) && (controls.duplicateRawCandidateOrdinal !== undefined)) {
        const packet = verifierPacket(request,);
        if (packet.candidateOrdinal === controls.duplicateRawCandidateOrdinal) {
          const parsed = value as CandidateBallotResponse;
          rawText = `{"candidateId":${JSON.stringify(parsed.candidateId,)},${rawText.slice(1,)}`;
        }
      }
      peak.inFlight -= 1;
      return { kind: 'ok', value: value as ValueT, rawText, };
    },
    quotas: async () => {
      await Promise.resolve();
      throw new Error('candidate ballot runtime quotas unused');
    },
  };
}

/** Builds client proving abort propagation waits for all verifier siblings. */
function delayedVerifierAbortClient({
  fixture,
  controller,
  reason,
  settledSiblingCount,
}: {
  readonly fixture: Fixture;
  readonly controller: AbortController;
  readonly reason: unknown;
  readonly settledSiblingCount: { value: number };
}): SyntheticClient {
  const responseFor = responseForRequest({ fixture, });
  const authorBarrier = Promise.withResolvers<undefined>();
  const verifierBarrier = Promise.withResolvers<undefined>();
  const arrivals = { author: 0, verifier: 0, };
  return {
    chatText: async () => {
      await Promise.resolve();
      throw new Error('candidate ballot abort chatText unused');
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      const author = request.responseFormat?.json_schema.name === 'immutable_shell_slots';
      const barrier = author ? authorBarrier : verifierBarrier;
      if (author) {
        arrivals.author += 1;
        if (arrivals.author === 2)
          authorBarrier.resolve(undefined,);
      }
      else {
        arrivals.verifier += 1;
        if (arrivals.verifier === 6)
          verifierBarrier.resolve(undefined,);
      }
      await barrier.promise;
      const designated = (!author)
        && (request.modelId === 'hf:Qwen/Qwen3.8-27B')
        && (verifierPacket(request,).candidateOrdinal === 0);
      if (designated)
        controller.abort(reason,);
      else if (!author) {
        await wait(50,);
        settledSiblingCount.value += 1;
      }
      const value = responseFor(request,);
      if (!request.validate(value,))
        throw new Error('candidate ballot abort response failed guard');
      return { kind: 'ok', value: value as ValueT, rawText: JSON.stringify(value,), };
    },
    quotas: async () => {
      await Promise.resolve();
      throw new Error('candidate ballot abort quotas unused');
    },
  };
}

/** Client counting forbidden restart calls before refusing them. */
function countingRefusingClient({
  calls,
}: {
  readonly calls: { value: number };
}): SyntheticClient {
  return {
    chatText: async () => {
      calls.value += 1;
      await Promise.resolve();
      throw new Error('counted candidate ballot text client called');
    },
    chatJson: async () => {
      calls.value += 1;
      await Promise.resolve();
      throw new Error('counted candidate ballot json client called');
    },
    quotas: async () => {
      calls.value += 1;
      await Promise.resolve();
      throw new Error('counted candidate ballot quota client called');
    },
  };
}

/** Client proving excluded route or restart made no provider call. */
function refusingClient(): SyntheticClient {
  return {
    chatText: async () => {
      await Promise.resolve();
      throw new Error('excluded candidate ballot text client called');
    },
    chatJson: async () => {
      await Promise.resolve();
      throw new Error('excluded candidate ballot json client called');
    },
    quotas: async () => {
      await Promise.resolve();
      throw new Error('excluded candidate ballot quota client called');
    },
  };
}

await describe({
  name: 'Candidate I candidate-scoped ballots',
  children: [
    it({
      name: 'BINDS GLM canonical identity to vetted Hyper image route',
      fn: async () => {
        expect(candidateBallotHyperModel({
          modelId: 'hf:zai-org/GLM-5.3-Flash',
        },),).toEqual({
          requestId: 'hf:zai-org/GLM-5.3-Flash',
          id: 'glm-5.3-flash',
          requestOutputTokens: 32_000,
          readsImages: true,
        },);
        expect(candidateBallotHyperModel({
          modelId: 'hf:Qwen/Qwen3.8-27B',
        },).id,).toBe('qwen3.8-27b',);
        expect(candidateBallotHyperModel({
          modelId: 'minimax-m3',
        },).id,).toBe('minimax-m3',);
        const fixture = createFixture();
        expect(fixture.manifest.providerRoutes,).toHaveLength(3,);
        expect(fixture.manifest.providerRouteDigest,).toHaveLength(64,);
        const changedRoutes = fixture.manifest.providerRoutes.map(function mutate(route,) {
          return route.id === 'glm-5.3-flash'
            ? { ...route, requestOutputTokens: ALTERED_ROUTE_OUTPUT_TOKENS, }
            : route;
        },);
        const changedManifest: CandidateBallotManifest = {
          ...fixture.manifest,
          providerRoutes: changedRoutes,
          providerRouteDigest: candidateBallotHyperRouteDigest({ routes: changedRoutes, }),
        };
        expect(() => assertCandidateBallotManifest({
          manifest: changedManifest,
          ledger: fixture.ledger,
          shell: fixture.shell,
          archiveBody: ARCHIVE,
          expectedManifestDigest: fixture.manifest.manifestDigest,
        },),).toThrow();
        const routeCalls: string[] = [];
        const staleRouteClient = scriptedRouteClient({
          fixture,
          client: scriptedClient({
            fixture,
            calls: routeCalls,
            prompts: [],
            peak: { value: 0, inFlight: 0, },
          }),
        });
        expect(() => bindCandidateBallotClient({
          manifest: changedManifest,
          outputDir: 'candidate-ballot-stale-route',
          clients: {
            all: refusingClient(),
            synthetic: refusingClient(),
            hyper: staleRouteClient,
          },
        },),).toThrow();
        expect(routeCalls,).toHaveLength(0,);
        const wire = { modelId: '', };
        const reply = await createCandidateBallotHyperClient({
          apiKey: 'private-test-key',
          manifest: fixture.manifest,
          transport: recordingCandidateHyperTransport({ wire, }),
        },).client.chatText({
          modelId: 'hf:zai-org/GLM-5.3-Flash',
          messages: [{ role: 'user', content: 'meow', },],
          signal: new AbortController().signal,
        },);
        expect(wire.modelId,).toBe('glm-5.3-flash',);
        expect(reply.text,).toBe('ok',);
      },
    },),

    it({
      name: 'OWNS spaces after links, footnotes, code, and HTML while punctuation stays attached',
      fn: async () => {
        const source = '# 猫\n\n[猫](https://example.com)醒。猫[^n]醒。`猫`醒。<span>猫</span>醒。**猫**醒。*猫*醒。~~猫~~醒。{cat}醒。\n\n[^n]: 注。\n';
        const archive = '# Cat\n\n[Cat](https://example.com) wakes. Cat[^n] wakes. `cat` wakes. <span>Cat</span> wakes. **Cat** wakes. *Cat* wakes. ~~Cat~~ wakes. {cat} wakes.\n\n[^n]: Note.\n';
        const shell = buildImmutableShell({ sourceText: source, archiveText: archive, });
        const boundaries = targetBoundariesForShell({ shell, });
        expect(boundaries.some(function link(item,) {
          return (item.edge === 'before') && (item.syntaxRole === 'link');
        },),).toBe(true,);
        expect(boundaries.some(function footnote(item,) {
          return (item.edge === 'after') && (item.syntaxRole === 'footnote');
        },),).toBe(true,);
        const compilation = compileCandidateBallotCandidate({
          shell,
          boundaries,
          response: {
            slots: Object.fromEntries(shell.slots.map(function text(slot,) {
              return [slot.key, slot.source === '。' ? '.' : 'English',];
            },),),
          },
        },);
        expect(compilation.document.includes(') English',),).toBe(true,);
        expect(compilation.document.includes('English[^n]',),).toBe(true,);
        expect(compilation.document.includes('` English',),).toBe(true,);
        expect(compilation.document.includes('> English',),).toBe(true,);
        expect(compilation.document.includes('** English',),).toBe(true,);
        expect(compilation.document.includes('* English',),).toBe(true,);
        expect(compilation.document.includes('~~ English',),).toBe(true,);
        expect(compilation.document.includes('} English',),).toBe(true,);
        const linkBoundary = boundaries.find(function link(item,) {
          return (item.edge === 'before') && (item.syntaxRole === 'link');
        },);
        if (linkBoundary === undefined)
          throw new Error('candidate ballot link boundary is absent');
        expect(compilation.slots[linkBoundary.slotKey]?.startsWith(' ',),).toBe(true,);
        expect(compilation.resolvedBoundaries.find(function same(item,) {
          return (item.slotKey === linkBoundary.slotKey) && (item.edge === 'before');
        },)?.separator,).toBe(' ',);
        const punctuation = compileCandidateBallotDocument({
          shell,
          boundaries,
          response: {
            slots: Object.fromEntries(shell.slots.map(function text(slot,) {
              return [slot.key, slot.key === linkBoundary.slotKey ? '.' : 'English',];
            },),),
          },
        },);
        expect(punctuation.includes(').',),).toBe(true,);
      },
    },),

    it({
      name: 'CLASSIFIES exact finite parsed guard failures without reviewer wording',
      fn: async () => {
        const fixture = settledFixture();
        const [candidate,] = fixture.candidates;
        if (candidate === undefined)
          throw new Error('candidate ballot guard candidate is absent');
        const clean = cleanResponse({ fixture, candidate, });
        expect(candidateBallotResponseGuard({ ledger: fixture.ledger, candidate, })(clean,),).toBe(true,);
        expect(diagnoseCandidateBallotResponse({
          value: { ...clean, hidden: true, },
          ledger: fixture.ledger,
          candidate,
        },),).toEqual({ kind: 'rejected', failure: 'key-set', },);
        expect(diagnoseCandidateBallotResponse({
          value: { ...clean, candidateDigest: 'x', },
          ledger: fixture.ledger,
          candidate,
        },),).toEqual({ kind: 'rejected', failure: 'candidate-binding', },);
        expect(diagnoseCandidateBallotResponse({
          value: { ...clean, obligationStatuses: clean.obligationStatuses.slice(1,), },
          ledger: fixture.ledger,
          candidate,
        },),).toEqual({ kind: 'rejected', failure: 'status-length', },);
        expect(diagnoseCandidateBallotResponse({
          value: { ...clean, obligationStatuses: `x${clean.obligationStatuses.slice(1,)}`, },
          ledger: fixture.ledger,
          candidate,
        },),).toEqual({ kind: 'rejected', failure: 'status-alphabet', },);
        expect(diagnoseCandidateBallotResponse({
          value: { ...clean, overflow: 'false', },
          ledger: fixture.ledger,
          candidate,
        },),).toEqual({ kind: 'rejected', failure: 'overflow', },);
        expect(diagnoseCandidateBallotResponse({
          value: { ...clean, findings: [{ scope: 'o', },], },
          ledger: fixture.ledger,
          candidate,
        },),).toEqual({ kind: 'rejected', failure: 'finding-shape', },);
        expect(diagnoseCandidateBallotResponse({
          value: {
            ...clean,
            findings: [{
              scope: 'g',
              manifestIndex: 0,
              defectClassIndex: 1,
              targetAnchors: [{ slotKey: 1, startOffset: 0, endOffset: 1, digest: 'x', },],
            },],
          },
          ledger: fixture.ledger,
          candidate,
        },),).toEqual({ kind: 'rejected', failure: 'anchor', },);
      },
    },),

    it({
      name: 'REQUIRES two nonself clean families and lets valid self defect veto publication',
      fn: async () => {
        const fixture = settledFixture();
        const [candidate,] = fixture.candidates;
        if (candidate === undefined)
          throw new Error('candidate ballot selection candidate is absent');
        const clean = cleanResponse({ fixture, candidate, });
        expect(candidateBallotModelsIndependent({
          authorModelId: 'deepseek-v4-pro-0813',
          verifierModelId: 'deepseek-v4-flash-0731',
        },),).toBe(false,);
        expect(candidateBallotModelsIndependent({
          authorModelId: 'hf:Qwen/Qwen3.8-27B',
          verifierModelId: 'minimax-m3',
        },),).toBe(true,);
        const cleanBallots = [0, 1, 2,].map(function verifier(verifierOrdinal,) {
          return ballot({ fixture, candidateOrdinal: 0, verifierOrdinal, response: clean, });
        },);
        const selected = selection({ fixture, ballots: cleanBallots, });
        const [firstBallot,] = cleanBallots;
        if (firstBallot === undefined)
          throw new Error('candidate ballot expanded row fixture is absent');
        expect(firstBallot.statusRows,).toHaveLength(
          fixture.ledger.obligations.length + REALIZATION_GLOBAL_CRITERIA.length,
        );
        const [firstStatusRow,] = firstBallot.statusRows;
        expect(firstStatusRow,).toEqual({
          scope: 'o',
          manifestIndex: 0,
          status: 'p',
        },);
        expect(selected.cleanVerifierModelIds,).toEqual([
          'hf:zai-org/GLM-5.3-Flash',
          'minimax-m3',
        ],);
        expect(selected.evidenceFloorMet,).toBe(true,);
        expect(selected.productionEligible,).toBe(true,);
        const selfDefect: CandidateBallotResponse = {
          ...clean,
          globalStatuses: `d${clean.globalStatuses.slice(1,)}`,
          findings: [{
            scope: 'g',
            manifestIndex: 0,
            defectClassIndex: CONDITIONAL_DEFECT_CLASSES.indexOf('grammar-usage',),
            targetAnchors: [anchor({ candidate, }),],
          },],
        };
        const vetoed = selection({
          fixture,
          ballots: [
            ballot({ fixture, candidateOrdinal: 0, verifierOrdinal: 0, response: selfDefect, }),
            ...cleanBallots.slice(1,),
          ],
        },);
        expect(vetoed.evidenceFloorMet,).toBe(true,);
        expect(vetoed.productionEligible,).toBe(false,);
        expect(vetoed.dissentingVerifierModelIds,).toEqual(['hf:Qwen/Qwen3.8-27B',],);
      },
    },),

    it({
      name: 'ABSTAINS duplicated identity atomically and retains private fallback below floor',
      fn: async () => {
        const fixture = settledFixture();
        const [candidate,] = fixture.candidates;
        if (candidate === undefined)
          throw new Error('candidate ballot duplicate candidate is absent');
        const clean = cleanResponse({ fixture, candidate, });
        const glm = ballot({ fixture, candidateOrdinal: 0, verifierOrdinal: 1, response: clean, });
        const selected = selection({
          fixture,
          ballots: [
            glm,
            glm,
            ballot({ fixture, candidateOrdinal: 0, verifierOrdinal: 2, response: clean, }),
          ],
        },);
        expect(selected.candidate.candidateOrdinal,).toBe(0,);
        expect(selected.evidenceFloorMet,).toBe(false,);
        expect(selected.productionEligible,).toBe(false,);
        expect(selected.abstainingVerifierModelIds,).toContain('hf:zai-org/GLM-5.3-Flash',);
      },
    },),

    it({
      name: 'ENFORCES overflow algebra and exact located findings',
      fn: async () => {
        const fixture = settledFixture();
        const [candidate,] = fixture.candidates;
        if (candidate === undefined)
          throw new Error('candidate ballot overflow candidate is absent');
        const clean = cleanResponse({ fixture, candidate, });
        const missingFinding: CandidateBallotResponse = {
          ...clean,
          globalStatuses: `d${clean.globalStatuses.slice(1,)}`,
        };
        expect(() => ballot({
          fixture,
          candidateOrdinal: 0,
          verifierOrdinal: 1,
          response: missingFinding,
        },),).toThrow();
        const obligationCount = fixture.ledger.obligations.length;
        const defectCount = obligationCount + REALIZATION_GLOBAL_CRITERIA.length;
        expect(defectCount,).toBeGreaterThan(CANDIDATE_BALLOT_FINDING_CAP,);
        const omissionIndex = CONDITIONAL_DEFECT_CLASSES.indexOf('omission',);
        const grammarIndex = CONDITIONAL_DEFECT_CLASSES.indexOf('grammar-usage',);
        const obligationFindings = fixture.ledger.obligations
          .map(function omission(obligation, manifestIndex,) {
            return obligation.sourceSpans.length === 0
              ? []
              : [{
                scope: 'o' as const,
                manifestIndex,
                defectClassIndex: omissionIndex,
                targetAnchors: [],
              },];
          },)
          .flat();
        const globalFindings = REALIZATION_GLOBAL_CRITERIA.map(function global(
          criterion,
          manifestIndex,
        ) {
          if (criterion.length === 0)
            throw new Error('candidate ballot global criterion is absent');
          return {
            scope: 'g' as const,
            manifestIndex,
            defectClassIndex: grammarIndex,
            targetAnchors: [anchor({ candidate, }),],
          };
        },);
        const findings = [...obligationFindings, ...globalFindings,]
          .slice(0, CANDIDATE_BALLOT_FINDING_CAP,);
        expect(findings,).toHaveLength(CANDIDATE_BALLOT_FINDING_CAP,);
        const overflow: CandidateBallotResponse = {
          ...clean,
          obligationStatuses: 'd'.repeat(obligationCount,),
          globalStatuses: 'd'.repeat(REALIZATION_GLOBAL_CRITERIA.length,),
          overflow: true,
          findings,
        };
        expect(ballot({
          fixture,
          candidateOrdinal: 0,
          verifierOrdinal: 1,
          response: overflow,
        },).response,).toEqual(overflow,);
      },
    },),

    it({
      name: 'RUNS exactly eight finite payloads in two concurrent waves and restarts without calls',
      fn: async () => {
        await using root = await temporaryDirectory();
        const fixture = createFixture();
        const calls: string[] = [];
        const prompts: string[] = [];
        const peak = { value: 0, inFlight: 0, };
        const client = scriptedClient({ fixture, calls, prompts, peak, });
        const boundClient = bindCandidateBallotClient({
          manifest: fixture.manifest,
          outputDir: root.path,
          clients: {
            all: refusingClient(),
            synthetic: refusingClient(),
            hyper: scriptedRouteClient({ fixture, client, }),
          },
        },);
        const first = await runCandidateBallotRuntime({
          outputDir: root.path,
          boundClient,
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
          restart: false,
          signal: new AbortController().signal,
        },);
        expect(calls,).toHaveLength(MAX_CANDIDATE_BALLOT_PAYLOAD_COUNT,);
        expect(first.completedNodeCount,).toBe(MAX_CANDIDATE_BALLOT_PAYLOAD_COUNT,);
        expect(first.spentUnusableNodeCount,).toBe(0,);
        expect(first.skippedNodeCount,).toBe(0,);
        expect(first.selection?.productionEligible,).toBe(true,);
        expect(peak.value,).toBe(6,);
        expect(prompts.every(function image(prompt,) {
          return prompt.includes(DATA_URI,);
        },),).toBe(true,);
        expect(new Set(prompts.map(function claim(prompt, index,) {
          return `${calls[index] ?? ''}:${prompt}`;
        },)).size,).toBe(prompts.length,);
        const restartCalls = { value: 0, };
        const restartClient = bindCandidateBallotClient({
          manifest: fixture.manifest,
          outputDir: root.path,
          clients: {
            all: refusingClient(),
            synthetic: refusingClient(),
            hyper: scriptedRouteClient({
              fixture,
              client: countingRefusingClient({ calls: restartCalls, }),
            }),
          },
        },);
        const restarted = await runCandidateBallotRuntime({
          outputDir: root.path,
          boundClient: restartClient,
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
          restart: true,
          signal: new AbortController().signal,
        },);
        expect(restarted.completedNodeCount,).toBe(MAX_CANDIDATE_BALLOT_PAYLOAD_COUNT,);
        expect(restarted.selection?.candidate.candidateDigest,)
          .toBe(first.selection?.candidate.candidateDigest,);
        expect(restartCalls.value,).toBe(0,);
      },
    },),

    it({
      name: 'REFUSES wave-two dispatch when cancellation arrives during verifier-plan persistence',
      fn: async () => {
        await using root = await temporaryDirectory();
        const fixture = createFixture();
        const calls: string[] = [];
        const reason = { operation: 'candidate-ballot-pre-verifier-abort', };
        const reads = { value: 0, };
        const signal = stagedAbortSignal({
          reason,
          abortAtRead: PRE_VERIFIER_ABORT_READ,
          reads,
        });
        const caught = await (async function captureAbort(): Promise<unknown> {
          try {
            await runCandidateBallotRuntime({
              outputDir: root.path,
              boundClient: bindCandidateBallotClient({
                manifest: fixture.manifest,
                outputDir: root.path,
                clients: {
                  all: refusingClient(),
                  synthetic: refusingClient(),
                  hyper: scriptedRouteClient({
                    fixture,
                    client: scriptedClient({
                      fixture,
                      calls,
                      prompts: [],
                      peak: { value: 0, inFlight: 0, },
                    }),
                  }),
                },
              },),
              manifest: fixture.manifest,
              expectedManifestDigest: fixture.manifest.manifestDigest,
              shell: fixture.shell,
              ledger: fixture.ledger,
              sourceText: SOURCE,
              archiveText: ARCHIVE,
              media: MEDIA,
              restart: false,
              signal,
            },);
          }
          catch (error) {
            return error;
          }
          return ABORT_NOT_CAUGHT;
        })();
        expect(caught,).toBe(reason,);
        expect(calls,).toHaveLength(2,);
        expect(reads.value,).toBe(PRE_VERIFIER_ABORT_READ,);
      },
    },),

    it({
      name: 'WAITS for every verifier sibling before forwarding exact caller abort identity',
      fn: async () => {
        await using root = await temporaryDirectory();
        const fixture = createFixture();
        const controller = new AbortController();
        const reason = { operation: 'candidate-ballot-abort-control', };
        const settledSiblingCount = { value: 0, };
        const caught = await (async function captureAbort(): Promise<unknown> {
          try {
            await runCandidateBallotRuntime({
              outputDir: root.path,
              boundClient: bindCandidateBallotClient({
                manifest: fixture.manifest,
                outputDir: root.path,
                clients: {
                  all: refusingClient(),
                  synthetic: refusingClient(),
                  hyper: scriptedRouteClient({
                    fixture,
                    client: delayedVerifierAbortClient({
                      fixture,
                      controller,
                      reason,
                      settledSiblingCount,
                    }),
                  }),
                },
              },),
              manifest: fixture.manifest,
              expectedManifestDigest: fixture.manifest.manifestDigest,
              shell: fixture.shell,
              ledger: fixture.ledger,
              sourceText: SOURCE,
              archiveText: ARCHIVE,
              media: MEDIA,
              restart: false,
              signal: controller.signal,
            },);
          }
          catch (error) {
            return error;
          }
          return ABORT_NOT_CAUGHT;
        })();
        expect(caught,).toBe(reason,);
        expect(settledSiblingCount.value,).toBe(5,);
      },
    },),

    it({
      name: 'SKIPS three verifier nodes after one unusable author without generated replacement work',
      fn: async () => {
        await using root = await temporaryDirectory();
        const fixture = createFixture();
        const calls: string[] = [];
        const client = scriptedClient({
          fixture,
          controls: { failAuthorOrdinal: 0, },
          calls,
          prompts: [],
          peak: { value: 0, inFlight: 0, },
        },);
        const result = await runCandidateBallotRuntime({
          outputDir: root.path,
          boundClient: bindCandidateBallotClient({
            manifest: fixture.manifest,
            outputDir: root.path,
            clients: {
              all: refusingClient(),
              synthetic: refusingClient(),
              hyper: scriptedRouteClient({ fixture, client, }),
            },
          },),
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
          restart: false,
          signal: new AbortController().signal,
        },);
        expect(calls,).toHaveLength(5,);
        expect(result.completedNodeCount,).toBe(4,);
        expect(result.spentUnusableNodeCount,).toBe(1,);
        expect(result.skippedNodeCount,).toBe(3,);
        expect(result.skippedVerifierNodes.every(function skipped(node,) {
          return node.candidateOrdinal === 0;
        },),).toBe(true,);
        expect(result.selection?.candidate.candidateOrdinal,).toBe(1,);
        expect(result.selection?.productionEligible,).toBe(true,);
      },
    },),

    it({
      name: 'PERSISTS raw duplicate category and never retries spent verifier on restart',
      fn: async () => {
        await using root = await temporaryDirectory();
        const fixture = createFixture();
        const calls: string[] = [];
        const first = await runCandidateBallotRuntime({
          outputDir: root.path,
          boundClient: bindCandidateBallotClient({
            manifest: fixture.manifest,
            outputDir: root.path,
            clients: {
              all: refusingClient(),
              synthetic: refusingClient(),
              hyper: scriptedRouteClient({
                fixture,
                client: scriptedClient({
                  fixture,
                  controls: { duplicateRawCandidateOrdinal: 0, },
                  calls,
                  prompts: [],
                  peak: { value: 0, inFlight: 0, },
                }),
              }),
            },
          },),
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
          restart: false,
          signal: new AbortController().signal,
        },);
        expect(first.spentUnusableNodeCount,).toBe(3,);
        expect(first.verifierStates.filter(function spent(state,) {
          return state.record.failureCategory === 'raw-duplicate';
        },),).toHaveLength(3,);
        const nodeText = await readFile(
          join(root.path, 'node-candidate-ballot-verifier-0-1.json',),
          'utf8',
        );
        expect(nodeText,).toContain('"failureCategory": "raw-duplicate"',);
        const restartCalls = { value: 0, };
        const restarted = await runCandidateBallotRuntime({
          outputDir: root.path,
          boundClient: bindCandidateBallotClient({
            manifest: fixture.manifest,
            outputDir: root.path,
            clients: {
              all: refusingClient(),
              synthetic: refusingClient(),
              hyper: scriptedRouteClient({
                fixture,
                client: countingRefusingClient({ calls: restartCalls, }),
              }),
            },
          },),
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
          restart: true,
          signal: new AbortController().signal,
        },);
        expect(restarted.spentUnusableNodeCount,).toBe(3,);
        expect(calls,).toHaveLength(MAX_CANDIDATE_BALLOT_PAYLOAD_COUNT,);
        expect(restartCalls.value,).toBe(0,);
      },
    },),
  ],
},);
