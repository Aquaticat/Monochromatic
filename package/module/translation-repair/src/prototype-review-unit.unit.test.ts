import { createHash, } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  admitReviewUnitAuthorResponse,
  admitReviewUnitResponse,
  assertReviewUnitBinding,
  assertReviewUnitFrontMatterSlotKeys,
  assertReviewUnitManifest,
  assertReviewUnitPlan,
  bindReviewUnitClient,
  buildImmutableShell,
  buildRealizationObligationLedger,
  createReviewUnitHyperClient,
  createReviewUnitManifest,
  createReviewUnitPlan,
  diagnoseReviewUnitResponse,
  MAX_REVIEW_UNIT_PAYLOAD_COUNT,
  REVIEW_UNIT_DEFECT_CLASSES,
  REVIEW_UNIT_FINDING_CAP,
  REVIEW_UNIT_FINDING_RULE_DIGEST,
  REVIEW_UNIT_FINDING_RULES,
  REVIEW_UNIT_GLOBAL_CRITERIA,
  REVIEW_UNIT_HYPER_MODELS,
  reviewUnitHyperRouteDigest,
  reviewUnitResponseGuard,
  reviewUnitResponseFormat,
  reviewUnitVerifierMessages,
  runReviewUnitRuntime,
  runReviewUnitVerifierNode,
  selectReviewUnit,
  type RealizationCandidatePlan,
  type ReviewUnitAuthorSettlement,
  type ReviewUnitCandidate,
  type ReviewUnitFinding,
  type ReviewUnitManifest,
  type ReviewUnitPlan,
  type ReviewUnitResponse,
  type ReviewUnitRouteClient,
  type ReviewUnitBallot,
} from '../dist/final/node/prototype-review-unit.mjs';
import {
  bindReviewUnitRouteClient,
  createReviewUnitAuthorSettlement,
} from '../dist/final/node/prototype-review-unit-test-support.mjs';
import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  isJsonRecord,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/** Disposable private runtime fixture root. */
type TemporaryDirectory = AsyncDisposable & { readonly path: string };

/** Creates disposable runtime root. */
async function temporaryDirectory(): Promise<TemporaryDirectory> {
  const path = await mkdtemp(join(tmpdir(), 'review-unit-',),);
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

/** Source carrying several clauses, adjacent slots, and one page image. */
const SOURCE = `---\nname: 猫\n---\n# 猫\n\n猫休息。猫醒来。\n\n猫在窗边看雨。\n\n<PhotoScroll photos={['\${path}/photos/fixture.webp']} />\n`;

/** Archive carrying destination shell authority. */
const ARCHIVE = `---\nname: Cat\n---\n# Cat\n\nThe cat rests. The cat wakes.\n\nThe cat watches rain by the window.\n\n<PhotoScroll photos={['\${path}/photos/fixture.webp']} />\n`;

/** Page image payload attached to every node. */
const DATA_URI = 'data:image/webp;base64,AA==';

/** Page image inventory and exact payload. */
const MEDIA = [{
  assetName: 'fixture.webp',
  dataUri: DATA_URI,
  digest: digest({ text: DATA_URI, }),
},] as const;

/** Complete deterministic fixture. */
type Fixture = {
  readonly source: string;
  readonly archive: string;
  readonly shell: ReturnType<typeof buildImmutableShell>;
  readonly ledger: ReturnType<typeof buildRealizationObligationLedger>;
  readonly reviewPlan: ReviewUnitPlan;
  readonly manifest: ReviewUnitManifest;
};

/** Candidate K three-family author plan. */
const CANDIDATE_PLAN = [
  { ordinal: 0, modelId: 'hf:Qwen/Qwen3.8-27B', priority: 0, },
  { ordinal: 1, modelId: 'hf:zai-org/GLM-5.3-Flash', priority: 1, },
  { ordinal: 2, modelId: 'minimax-m3', priority: 2, },
] as const satisfies readonly RealizationCandidatePlan[];

/** Candidate K three-family verifier plan. */
const VERIFIER_PLAN = [
  { ordinal: 0, modelId: 'hf:Qwen/Qwen3.8-27B', },
  { ordinal: 1, modelId: 'hf:zai-org/GLM-5.3-Flash', },
  { ordinal: 2, modelId: 'minimax-m3', },
] as const;

/** Creates exact Candidate K fixture for supplied complete page. */
function createFixture({
  source = SOURCE,
  archive = ARCHIVE,
}: {
  readonly source?: string;
  readonly archive?: string;
} = {}): Fixture {
  const shell = buildImmutableShell({ sourceText: source, archiveText: archive, });
  const ledger = buildRealizationObligationLedger({
    sourceBody: shell.body,
    archiveBody: archive,
    slots: shell.slots,
    shellDigest: shell.shellDigest,
  },);
  /** Closed-world ledger identity passed into readable plan. */
  const ledgerDigest = digest({ text: JSON.stringify(ledger,), });
  const reviewPlan = createReviewUnitPlan({
    ledger,
    shell,
    sourceText: source,
    sourceBody: shell.body,
    archiveBody: archive,
    ledgerDigest,
  },);
  const manifest = createReviewUnitManifest({
    ledger,
    shell,
    sourceText: source,
    sourceBody: shell.body,
    archiveBody: archive,
    reviewPlan,
    candidatePlan: CANDIDATE_PLAN,
    verifierPlan: VERIFIER_PLAN,
    providerSelection: 'hyper-only',
    sourcePictures: MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, digest: item.digest, };
    },),
  },);
  return { source, archive, shell, ledger, reviewPlan, manifest, };
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
      return [item.key, `Author ${String(plan.ordinal,)} complete English slot ${String(index,)}.`,];
    },),),
  };
}

/** Runtime-bound candidates and total settlement. */
function settledFixture(): Fixture & {
  readonly candidates: readonly ReviewUnitCandidate[];
  readonly settlement: ReviewUnitAuthorSettlement;
} {
  const fixture = createFixture();
  const sourcePictures = MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, };
    },);
  const candidates = fixture.manifest.candidatePlan.map(function candidate(plan,) {
    return admitReviewUnitAuthorResponse({
      response: authorResponse({ fixture, plan, }),
      shell: fixture.shell,
      manifest: fixture.manifest,
      reviewPlan: fixture.reviewPlan,
      plan,
      sourceText: fixture.source,
      archiveText: fixture.archive,
      sourcePictures,
    },);
  },);
  const settlement = createReviewUnitAuthorSettlement({
    manifest: fixture.manifest,
    states: candidates.map(function state(candidate,) {
      return {
        record: {
          id: `review-unit-author-${String(candidate.candidateOrdinal,)}`,
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
  readonly fixture: Pick<Fixture, 'reviewPlan'>;
  readonly candidate: Pick<ReviewUnitCandidate,
    'candidateId' | 'candidateDigest' | 'deterministicProofDigest'>;
}): ReviewUnitResponse {
  return {
    candidateId: candidate.candidateId,
    candidateDigest: candidate.candidateDigest,
    reviewPlanDigest: fixture.reviewPlan.reviewPlanDigest,
    deterministicProofDigest: candidate.deterministicProofDigest,
    frontMatterStatuses: 'p'.repeat(fixture.reviewPlan.frontMatterSubjects.length,),
    clauseStatusesBySlot: fixture.reviewPlan.slotGroups.map(function statuses(group,) {
      return 'p'.repeat(group.clauseSubjectIndexes.length,);
    },),
    relationStatuses: 'p'.repeat(fixture.reviewPlan.relations.length,),
    slotLanguageStatuses: 'c'.repeat(fixture.reviewPlan.slotGroups.length,),
    globalStatuses: 'c'.repeat(fixture.reviewPlan.globalCriteria.length,),
    overflow: false,
    findings: [],
  };
}

/** Builds exact target anchor inside named candidate slot. */
function anchor({
  candidate,
  slotKey,
  startOffset = 0,
  endOffset = 3,
}: {
  readonly candidate: ReviewUnitCandidate;
  readonly slotKey: string;
  readonly startOffset?: number;
  readonly endOffset?: number;
}): ReviewUnitFinding['targetAnchors'][number] {
  const text = candidate.slots[slotKey];
  if (text === undefined)
    throw new Error('review unit test text is absent');
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
  readonly response: ReviewUnitResponse;
}): ReviewUnitBallot {
  const verifierModelId = fixture.manifest.verifierPlan[verifierOrdinal]?.modelId;
  if (verifierModelId === undefined)
    throw new Error('review unit test verifier is absent');
  return admitReviewUnitResponse({
    response,
    ledger: fixture.ledger,
    reviewPlan: fixture.reviewPlan,
    authorSettlement: fixture.settlement,
    candidateOrdinal,
    verifierOrdinal,
    verifierModelId,
    manifest: fixture.manifest,
    expectedManifestDigest: fixture.manifest.manifestDigest,
    shell: fixture.shell,
    sourceText: fixture.source,
    archiveText: fixture.archive,
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
  readonly ballots: readonly ReviewUnitBallot[];
}): ReturnType<typeof selectReviewUnit> {
  return selectReviewUnit({
    authorSettlement: fixture.settlement,
    ballots,
    manifest: fixture.manifest,
    expectedManifestDigest: fixture.manifest.manifestDigest,
    ledger: fixture.ledger,
    reviewPlan: fixture.reviewPlan,
    shell: fixture.shell,
    sourceText: fixture.source,
    archiveText: fixture.archive,
    sourcePictures: MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, };
    },),
  },);
}

/** Candidate evidence in canonical verifier packet. */
type CandidateEvidence = Pick<ReviewUnitCandidate,
  'candidateId' | 'candidateDigest' | 'deterministicProofDigest'>;

/** Guards anonymous candidate evidence. */
function isCandidateEvidence(value: unknown,): value is CandidateEvidence {
  return isJsonRecord(value,)
    && ((typeof value.candidateId) === 'string')
    && ((typeof value.candidateDigest) === 'string')
    && ((typeof value.deterministicProofDigest) === 'string');
}

/** Reads canonical candidate verifier packet from request. */
function verifierPacket(request: ChatJsonRequest<unknown>,): Readonly<Record<string, unknown>> {
  const [, message,] = request.messages;
  if ((message === undefined) || ((typeof message.content) === 'string'))
    throw new Error('review unit verifier packet is absent');
  const textPart = message.content.find(function text(part,) {
    return part.type === 'text';
  },);
  if ((textPart === undefined) || (textPart.type !== 'text'))
    throw new Error('review unit verifier packet text is absent');
  const marker = 'REVIEW_UNIT_VERIFIER_PACKET:\n';
  const start = textPart.text.indexOf(marker,);
  if (start === (-1))
    throw new Error('review unit verifier packet marker is absent');
  const value: unknown = JSON.parse(textPart.text.slice(start + marker.length,),);
  if (!isJsonRecord(value,))
    throw new Error('review unit verifier packet differs');
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
        throw new Error('review unit runtime author differs');
      return authorResponse({ fixture, plan, });
    }
    if (schemaName !== 'candidate_review_unit_ballot')
      throw new Error('review unit runtime schema differs');
    const packet = verifierPacket(request,);
    if (!isCandidateEvidence(packet.candidate,))
      throw new Error('review unit runtime candidate evidence differs');
    return cleanResponse({ fixture, candidate: packet.candidate, });
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
  const expectedVerifiers = controls.failAuthorOrdinal === undefined ? 9 : 6;
  return {
    chatText: async () => {
      await Promise.resolve();
      throw new Error('review unit runtime chatText unused');
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      peak.inFlight += 1;
      peak.value = Math.max(peak.value, peak.inFlight,);
      const schemaName = request.responseFormat?.json_schema.name ?? '';
      calls.push(`${request.modelId}:${schemaName}`,);
      prompts.push(`${request.modelId}:${JSON.stringify(request.messages,)}`,);
      if (request.exchangeTimeoutMs !== 900_000)
        throw new Error('review unit runtime deadline differs');
      const author = schemaName === 'immutable_shell_slots';
      const arrivals = calls.filter(function same(value,) {
        return value.endsWith(`:${schemaName}`,);
      },).length;
      if (author && (arrivals === 3))
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
        throw new Error('review unit scripted response failed guard');
      let rawText = JSON.stringify(value,);
      if ((!author) && (controls.duplicateRawCandidateOrdinal !== undefined)) {
        const packet = verifierPacket(request,);
        if (packet.candidateOrdinal === controls.duplicateRawCandidateOrdinal) {
          const parsed = value as ReviewUnitResponse;
          rawText = `{"candidateId":${JSON.stringify(parsed.candidateId,)},${rawText.slice(1,)}`;
        }
      }
      peak.inFlight -= 1;
      return { kind: 'ok', value: value as ValueT, rawText, };
    },
    quotas: async () => {
      await Promise.resolve();
      throw new Error('review unit runtime quotas unused');
    },
  };
}

/** Builds client aborting only after every verifier sibling enters transport. */
function verifierAbortClient({
  fixture,
  controller,
  reason,
  settled,
}: {
  readonly fixture: Fixture;
  readonly controller: AbortController;
  readonly reason: unknown;
  readonly settled: { value: number };
}): SyntheticClient {
  const responseFor = responseForRequest({ fixture, });
  const authorBarrier = Promise.withResolvers<undefined>();
  const verifierBarrier = Promise.withResolvers<undefined>();
  const arrivals = { authors: 0, verifiers: 0, };
  return {
    chatText: async () => {
      await Promise.resolve();
      throw new Error('review unit abort text route unused');
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      const author = request.responseFormat?.json_schema.name === 'immutable_shell_slots';
      if (author) {
        arrivals.authors += 1;
        if (arrivals.authors === 3)
          authorBarrier.resolve(undefined,);
        await authorBarrier.promise;
        const value = responseFor(request,);
        if (!request.validate(value,))
          throw new Error('review unit abort author response differs');
        return { kind: 'ok', value: value as ValueT, rawText: JSON.stringify(value,), };
      }
      arrivals.verifiers += 1;
      if (arrivals.verifiers === 9) {
        controller.abort(reason,);
        verifierBarrier.resolve(undefined,);
      }
      await verifierBarrier.promise;
      settled.value += 1;
      throw request.signal.reason;
    },
    quotas: async () => {
      await Promise.resolve();
      throw new Error('review unit abort quota route unused');
    },
  };
}

/** Binds scripted client to fixture route digest without provider traffic. */
function scriptedRouteClient({
  fixture,
  client,
}: {
  readonly fixture: Fixture;
  readonly client: SyntheticClient;
}): ReviewUnitRouteClient {
  return bindReviewUnitRouteClient({
    client,
    providerRouteDigest: fixture.manifest.providerRouteDigest,
  },);
}

/** Builds provider client that records any forbidden route use. */
function forbiddenClient({ calls, }: { readonly calls: { value: number } }): SyntheticClient {
  return {
    chatText: async () => {
      calls.value += 1;
      throw new Error('review unit forbidden text provider used');
    },
    chatJson: async <ValueT,>(): Promise<ChatJsonOutcome<ValueT>> => {
      calls.value += 1;
      throw new Error('review unit forbidden JSON provider used');
    },
    quotas: async () => {
      calls.value += 1;
      throw new Error('review unit forbidden quota provider used');
    },
  };
}

/** Runs full fixture graph through provider-neutral client. */
async function runFixture({
  fixture,
  outputDir,
  client,
  allClient = client,
  syntheticClient = client,
  restart,
  signal = new AbortController().signal,
}: {
  readonly fixture: Fixture;
  readonly outputDir: string;
  readonly client: SyntheticClient;
  readonly allClient?: SyntheticClient;
  readonly syntheticClient?: SyntheticClient;
  readonly restart: boolean;
  readonly signal?: AbortSignal;
}): Promise<Awaited<ReturnType<typeof runReviewUnitRuntime>>> {
  return await runReviewUnitRuntime({
    outputDir,
    boundClient: bindReviewUnitClient({
      manifest: fixture.manifest,
      outputDir,
      clients: {
        all: allClient,
        synthetic: syntheticClient,
        hyper: scriptedRouteClient({ fixture, client, }),
      },
    },),
    manifest: fixture.manifest,
    expectedManifestDigest: fixture.manifest.manifestDigest,
    shell: fixture.shell,
    ledger: fixture.ledger,
    reviewPlan: fixture.reviewPlan,
    sourceText: fixture.source,
    archiveText: fixture.archive,
    media: MEDIA,
    restart,
    signal,
  },);
}

await describe({
  name: 'Candidate K review units',
  children: [
    it({
      name: 'compiles readable clause relation and global ownership plan',
      fn: async () => {
        await Promise.resolve();
        const fixture = createFixture();
        expect(fixture.reviewPlan.clauses.length).toBe(fixture.ledger.obligations.filter(function clause(value,) {
          return value.kind === 'clause';
        },).length,);
        expect(fixture.reviewPlan.relations.length).toBe(fixture.ledger.obligations.filter(function relation(value,) {
          return value.kind === 'relation';
        },).length,);
        expect(fixture.reviewPlan.slotGroups.length).toBe(fixture.shell.slots.length,);
        expect(fixture.reviewPlan.globalCriteria).toEqual(REVIEW_UNIT_GLOBAL_CRITERIA,);
        expect(fixture.reviewPlan.priorGlobalOwnership.length).toBe(10,);
        expect(fixture.reviewPlan.sourceEvidence.every(function readable(value,) {
          return value.text.length > 0;
        },)).toBe(true,);
      },
    }),
    it({
      name: 'refuses readable source evidence and relation direction mutation',
      fn: async () => {
        await Promise.resolve();
        const fixture = createFixture();
        const [firstEvidence,] = fixture.reviewPlan.sourceEvidence;
        if (firstEvidence === undefined)
          throw new Error('review unit source evidence fixture absent');
        expect(() => assertReviewUnitPlan({
          plan: {
            ...fixture.reviewPlan,
            sourceEvidence: [{ ...firstEvidence, text: `${firstEvidence.text}x`, }, ...fixture.reviewPlan.sourceEvidence.slice(1,),],
          },
          ledger: fixture.ledger,
          shell: fixture.shell,
          sourceText: fixture.source,
          sourceBody: fixture.shell.body,
          archiveBody: fixture.archive,
          ledgerDigest: fixture.manifest.ledgerDigest,
        },)).toThrow();
        const [relation,] = fixture.reviewPlan.relations;
        if (relation === undefined)
          throw new Error('review unit relation fixture absent');
        for (const plan of [
          {
            ...fixture.reviewPlan,
            frontMatterStructureDigest: digest({ text: 'stale-structure', }),
          },
          {
            ...fixture.reviewPlan,
            frontMatterScalarDigest: digest({ text: 'stale-scalar', }),
          },
        ]) {
          expect(() => assertReviewUnitPlan({
            plan,
            ledger: fixture.ledger,
            shell: fixture.shell,
            sourceText: fixture.source,
            sourceBody: fixture.shell.body,
            archiveBody: fixture.archive,
            ledgerDigest: fixture.manifest.ledgerDigest,
          })).toThrow();
        }
        expect(() => assertReviewUnitPlan({
          plan: {
            ...fixture.reviewPlan,
            relations: [{
              ...relation,
              endpointClauseSubjectIndexes: relation.endpointClauseSubjectIndexes.toReversed(),
            }, ...fixture.reviewPlan.relations.slice(1,),],
          },
          ledger: fixture.ledger,
          shell: fixture.shell,
          sourceText: fixture.source,
          sourceBody: fixture.shell.body,
          archiveBody: fixture.archive,
          ledgerDigest: fixture.manifest.ledgerDigest,
        },)).toThrow();
      },
    }),
    it({
      name: 'requires exact non-string front-matter scalar survival',
      fn: async () => {
        await Promise.resolve();
        const source = SOURCE.replace('name: 猫', 'name: 猫\nrating: 1',);
        const archive = ARCHIVE.replace('name: Cat', 'name: Cat\nrating: 2',);
        expect(() => createFixture({ source, archive, })).toThrow();
        const mapSource = SOURCE.replace('name: 猫', 'name: 猫\nempty: {}',);
        const sequenceArchive = ARCHIVE.replace('name: Cat', 'name: Cat\nempty: []',);
        expect(() => createFixture({ source: mapSource, archive: sequenceArchive, })).toThrow();
        const negativeZeroSource = SOURCE.replace('name: 猫', 'name: 猫\nrating: -0',);
        const zeroArchive = ARCHIVE.replace('name: Cat', 'name: Cat\nrating: 0',);
        expect(() => createFixture({ source: negativeZeroSource, archive: zeroArchive, })).toThrow();
        const unsafeSource = SOURCE.replace('name: 猫', 'name: 猫\nrating: 9007199254740993',);
        const unsafeArchive = ARCHIVE.replace('name: Cat', 'name: Cat\nrating: 9007199254740993',);
        expect(() => createFixture({ source: unsafeSource, archive: unsafeArchive, })).toThrow();
        const nonfiniteSource = SOURCE.replace('name: 猫', 'name: 猫\nrating: .nan',);
        const nonfiniteArchive = ARCHIVE.replace('name: Cat', 'name: Cat\nrating: .nan',);
        expect(() => createFixture({
          source: nonfiniteSource,
          archive: nonfiniteArchive,
        })).toThrow();
        const supportedScalars = '\nemptyMap: {}\nemptyList: []\nenabled: true\nunset: null\ncount: 42\nratio: 1.5';
        const supportedSource = SOURCE.replace('name: 猫', `name: 猫${supportedScalars}`,);
        const supportedArchive = ARCHIVE.replace('name: Cat', `name: Cat${supportedScalars}`,);
        expect(() => createFixture({
          source: supportedSource,
          archive: supportedArchive,
        })).not.toThrow();
      },
    }),
    it({
      name: 'refuses synthetic front-matter and body-slot key collision',
      fn: async () => {
        await Promise.resolve();
        const fixture = createFixture();
        const [subject,] = fixture.reviewPlan.frontMatterSubjects;
        if (subject === undefined)
          throw new Error('review unit collision subject absent');
        expect(() => assertReviewUnitFrontMatterSlotKeys({
          subjects: [subject,],
          bodySlotKeys: [subject.targetSlotKey,],
        })).toThrow();
      },
    }),
    it({
      name: 'invokes collision guard from review-plan compiler',
      fn: async () => {
        await Promise.resolve();
        const fixture = createFixture();
        const [firstSlot, ...otherSlots] = fixture.shell.slots;
        if (firstSlot === undefined)
          throw new Error('review unit compiler collision slot absent');
        const oldKey = firstSlot.key;
        const collisionKey = fixture.reviewPlan.frontMatterSubjects[0]?.targetSlotKey;
        if (collisionKey === undefined)
          throw new Error('review unit compiler collision key absent');
        const shell = {
          ...fixture.shell,
          slots: [{ ...firstSlot, key: collisionKey, }, ...otherSlots,],
        };
        const ledger = {
          ...fixture.ledger,
          sourceSlots: fixture.ledger.sourceSlots.map(function slot(value,) {
            return value.slotKey === oldKey ? { ...value, slotKey: collisionKey, } : value;
          },),
          obligations: fixture.ledger.obligations.map(function obligation(value,) {
            return {
              ...value,
              allowedTargetSlotKeys: value.allowedTargetSlotKeys.map(function key(item,) {
                return item === oldKey ? collisionKey : item;
              },),
            };
          },),
        };
        expect(() => createReviewUnitPlan({
          ledger,
          shell,
          sourceText: fixture.source,
          sourceBody: shell.body,
          archiveBody: fixture.archive,
          ledgerDigest: digest({ text: JSON.stringify(ledger,), }),
        })).toThrow();
      },
    }),
    it({
      name: 'binds three authors nine verifiers routes caps and deadlines',
      fn: async () => {
        await Promise.resolve();
        const fixture = createFixture();
        expect(fixture.manifest.candidatePlan.length).toBe(3,);
        expect(fixture.manifest.verifierPlan.length).toBe(3,);
        expect(fixture.manifest.payloadCountCeiling).toBe(MAX_REVIEW_UNIT_PAYLOAD_COUNT,);
        expect(MAX_REVIEW_UNIT_PAYLOAD_COUNT).toBe(12,);
        expect(REVIEW_UNIT_HYPER_MODELS.map(function cap(route,) {
          return route.requestOutputTokens;
        },)).toEqual([
          32_000,
          32_000,
          32_000,
        ],);
        expect(REVIEW_UNIT_HYPER_MODELS.map(function deadline(route,) {
          return route.requestTimeoutMs;
        },)).toEqual([
          900_000,
          900_000,
          900_000,
        ],);
        expect(reviewUnitHyperRouteDigest({ routes: REVIEW_UNIT_HYPER_MODELS, })).toBe(
          fixture.manifest.providerRouteDigest,
        );
        expect(fixture.manifest.verifierRuleDigest).toBe(REVIEW_UNIT_FINDING_RULE_DIGEST,);
      },
    }),
    it({
      name: 'refuses stale review plan and provider route manifest bindings',
      fn: async () => {
        await Promise.resolve();
        const fixture = createFixture();
        expect(() => assertReviewUnitManifest({
          manifest: { ...fixture.manifest, reviewPlanDigest: digest({ text: 'stale', }), },
          ledger: fixture.ledger,
          shell: fixture.shell,
          sourceText: fixture.source,
          sourceBody: fixture.shell.body,
          archiveBody: fixture.archive,
          reviewPlan: fixture.reviewPlan,
          expectedManifestDigest: fixture.manifest.manifestDigest,
        },)).toThrow();
        expect(() => assertReviewUnitManifest({
          manifest: { ...fixture.manifest, verifierRuleDigest: digest({ text: 'stale-rule', }), },
          ledger: fixture.ledger,
          shell: fixture.shell,
          sourceText: fixture.source,
          sourceBody: fixture.shell.body,
          archiveBody: fixture.archive,
          reviewPlan: fixture.reviewPlan,
          expectedManifestDigest: fixture.manifest.manifestDigest,
        },)).toThrow();
        const [firstRoute, ...otherRoutes] = fixture.manifest.providerRoutes;
        if (firstRoute === undefined)
          throw new Error('review unit route fixture absent');
        expect(() => assertReviewUnitManifest({
          manifest: {
            ...fixture.manifest,
            providerRoutes: [{ ...firstRoute, requestTimeoutMs: 899_999 as 900_000, }, ...otherRoutes,],
          },
          ledger: fixture.ledger,
          shell: fixture.shell,
          sourceText: fixture.source,
          sourceBody: fixture.shell.body,
          archiveBody: fixture.archive,
          reviewPlan: fixture.reviewPlan,
          expectedManifestDigest: fixture.manifest.manifestDigest,
        },)).toThrow();
      },
    }),
    it({
      name: 'binds author candidate and deterministic proof to admitted slots',
      fn: async () => {
        await Promise.resolve();
        const fixture = settledFixture();
        const [candidate,] = fixture.candidates;
        if (candidate === undefined)
          throw new Error('review unit candidate fixture absent');
        expect(candidate.deterministicProofDigest.length).toBe(64,);
        expect(() => assertReviewUnitBinding({
          candidate: { ...candidate, documentDigest: digest({ text: 'changed', }), },
          manifest: fixture.manifest,
          reviewPlan: fixture.reviewPlan,
          shell: fixture.shell,
          sourceText: fixture.source,
          archiveText: fixture.archive,
          sourcePictures: MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, };
    },),
        },)).toThrow();
      },
    }),
    it({
      name: 'accepts exact nested statuses and rejects binding length and alphabet drift',
      fn: async () => {
        await Promise.resolve();
        const fixture = settledFixture();
        const [candidate,] = fixture.candidates;
        if (candidate === undefined)
          throw new Error('review unit candidate fixture absent');
        const response = cleanResponse({ fixture, candidate, });
        expect(reviewUnitResponseGuard({
          reviewPlan: fixture.reviewPlan,
          candidate,
          pictureCount: MEDIA.length,
        },)(response,)).toBe(true,);
        expect(diagnoseReviewUnitResponse({
          value: { ...response, reviewPlanDigest: digest({ text: 'stale', }), },
          reviewPlan: fixture.reviewPlan,
          candidate,
          pictureCount: MEDIA.length,
        },)).toEqual({ kind: 'rejected', failure: 'candidate-binding', },);
        expect(diagnoseReviewUnitResponse({
          value: { ...response, clauseStatusesBySlot: response.clauseStatusesBySlot.slice(1,), },
          reviewPlan: fixture.reviewPlan,
          candidate,
          pictureCount: MEDIA.length,
        },)).toEqual({ kind: 'rejected', failure: 'status-length', },);
        expect(diagnoseReviewUnitResponse({
          value: { ...response, globalStatuses: `x${response.globalStatuses.slice(1,)}`, },
          reviewPlan: fixture.reviewPlan,
          candidate,
          pictureCount: MEDIA.length,
        },)).toEqual({ kind: 'rejected', failure: 'status-alphabet', },);
      },
    }),
    it({
      name: 'carries digest-bound scope rules in every verifier packet',
      fn: async () => {
        await Promise.resolve();
        const fixture = settledFixture();
        const [candidate,] = fixture.candidates;
        if (candidate === undefined)
          throw new Error('review unit rule packet candidate absent');
        const messages = reviewUnitVerifierMessages({
          manifest: fixture.manifest,
          shell: fixture.shell,
          reviewPlan: fixture.reviewPlan,
          candidate,
          authorSettlementDigest: fixture.settlement.settlementDigest,
          verifierPlanDigest: digest({ text: 'rule-packet-plan', }),
          defectClasses: REVIEW_UNIT_DEFECT_CLASSES,
          sourceText: fixture.source,
          archiveText: fixture.archive,
          media: MEDIA,
        },);
        const packet = verifierPacket({
          modelId: 'minimax-m3',
          messages,
          validate: (_value: unknown): _value is unknown => true,
          signal: new AbortController().signal,
        },);
        expect(packet.findingRuleDigest).toBe(REVIEW_UNIT_FINDING_RULE_DIGEST,);
        expect(packet.findingRules).toEqual(REVIEW_UNIT_FINDING_RULES,);
      },
    }),
    it({
      name: 'admits clause omission and ordered relation witnesses',
      fn: async () => {
        await Promise.resolve();
        const fixture = settledFixture();
        const [candidate,] = fixture.candidates;
        const [clause,] = fixture.reviewPlan.clauses;
        const [relation,] = fixture.reviewPlan.relations;
        if ((candidate === undefined) || (clause === undefined) || (relation === undefined))
          throw new Error('review unit evidence fixture absent');
        const base = cleanResponse({ fixture, candidate, });
        const clauseGroupIndex = fixture.reviewPlan.slotGroups.findIndex(function group(value,) {
          return value.clauseSubjectIndexes.includes(clause.subjectIndex,);
        },);
        const clausePosition = fixture.reviewPlan.slotGroups[clauseGroupIndex]
          ?.clauseSubjectIndexes.indexOf(clause.subjectIndex,) ?? (-1);
        const clauseStatuses = [...base.clauseStatusesBySlot,];
        const clauseGroup = clauseStatuses[clauseGroupIndex] ?? '';
        clauseStatuses[clauseGroupIndex] = `${clauseGroup.slice(0, clausePosition)}d${clauseGroup.slice(clausePosition + 1,)}`;
        const omission: ReviewUnitFinding = {
          scope: 'c',
          subjectIndex: clause.subjectIndex,
          defectClassIndex: REVIEW_UNIT_DEFECT_CLASSES.indexOf('omission',),
          sourceEvidenceIndexes: clause.sourceEvidenceIndexes,
          imageEvidenceIndexes: [],
          targetAnchors: [],
        };
        expect(() => ballot({
          fixture,
          candidateOrdinal: candidate.candidateOrdinal,
          verifierOrdinal: 1,
          response: { ...base, clauseStatusesBySlot: clauseStatuses, findings: [omission,], },
        })).not.toThrow();
        const relationSlotKeys = relation.allowedTargetSlotKeys;
        const relationFinding: ReviewUnitFinding = {
          scope: 'r',
          subjectIndex: relation.subjectIndex,
          defectClassIndex: REVIEW_UNIT_DEFECT_CLASSES.indexOf('paragraph-relation',),
          sourceEvidenceIndexes: relation.sourceEvidenceIndexes,
          imageEvidenceIndexes: [],
          targetAnchors: relationSlotKeys.map(function target(slotKey,) {
            return anchor({ candidate, slotKey, });
          },),
        };
        const relationStatuses = `d${base.relationStatuses.slice(1,)}`;
        expect(() => ballot({
          fixture,
          candidateOrdinal: candidate.candidateOrdinal,
          verifierOrdinal: 1,
          response: { ...base, relationStatuses, findings: [relationFinding,], },
        })).not.toThrow();
      },
    }),
    it({
      name: 'requires image evidence for visual global and target evidence for language',
      fn: async () => {
        await Promise.resolve();
        const fixture = settledFixture();
        const [candidate,] = fixture.candidates;
        const visualIndex = REVIEW_UNIT_GLOBAL_CRITERIA.indexOf('source-image-target-relation',);
        const [firstSlot,] = fixture.reviewPlan.slotGroups;
        const slotKey = firstSlot?.slotKey;
        if ((candidate === undefined) || (slotKey === undefined))
          throw new Error('review unit visual fixture absent');
        const base = cleanResponse({ fixture, candidate, });
        const globals = `${base.globalStatuses.slice(0, visualIndex)}d${base.globalStatuses.slice(visualIndex + 1,)}`;
        const visual: ReviewUnitFinding = {
          scope: 'g',
          subjectIndex: visualIndex,
          defectClassIndex: REVIEW_UNIT_DEFECT_CLASSES.indexOf('image-relation',),
          sourceEvidenceIndexes: [],
          imageEvidenceIndexes: [0,],
          targetAnchors: [anchor({ candidate, slotKey, }),],
        };
        expect(() => ballot({
          fixture,
          candidateOrdinal: candidate.candidateOrdinal,
          verifierOrdinal: 1,
          response: { ...base, globalStatuses: globals, findings: [visual,], },
        })).not.toThrow();
        expect(() => ballot({
          fixture,
          candidateOrdinal: candidate.candidateOrdinal,
          verifierOrdinal: 1,
          response: {
            ...base,
            globalStatuses: globals,
            findings: [{ ...visual, imageEvidenceIndexes: [], },],
          },
        })).toThrow();
        expect(() => ballot({
          fixture,
          candidateOrdinal: candidate.candidateOrdinal,
          verifierOrdinal: 1,
          response: {
            ...base,
            globalStatuses: `d${base.globalStatuses.slice(1,)}`,
            findings: [{ ...visual, subjectIndex: 0, },],
          },
        })).toThrow();
        expect(() => ballot({
          fixture,
          candidateOrdinal: candidate.candidateOrdinal,
          verifierOrdinal: 1,
          response: {
            ...base,
            globalStatuses: globals,
            findings: [{
              ...visual,
              defectClassIndex: REVIEW_UNIT_DEFECT_CLASSES.indexOf('wrong-meaning',),
              imageEvidenceIndexes: [],
            },],
          },
        })).toThrow();
      },
    }),
    it({
      name: 'reviews semantic front matter through exact synthetic target anchors',
      fn: async () => {
        await Promise.resolve();
        const fixture = settledFixture();
        const [candidate,] = fixture.candidates;
        const [subject,] = fixture.reviewPlan.frontMatterSubjects;
        if ((candidate === undefined) || (subject === undefined))
          throw new Error('review unit front matter fixture absent');
        const base = cleanResponse({ fixture, candidate, });
        const finding: ReviewUnitFinding = {
          scope: 'fm',
          subjectIndex: subject.subjectIndex,
          defectClassIndex: REVIEW_UNIT_DEFECT_CLASSES.indexOf('wrong-meaning',),
          sourceEvidenceIndexes: [],
          imageEvidenceIndexes: [],
          targetAnchors: [anchor({ candidate, slotKey: subject.targetSlotKey, }),],
        };
        expect(() => ballot({
          fixture,
          candidateOrdinal: candidate.candidateOrdinal,
          verifierOrdinal: 1,
          response: {
            ...base,
            frontMatterStatuses: `d${base.frontMatterStatuses.slice(1,)}`,
            findings: [finding,],
          },
        })).not.toThrow();
      },
    }),
    it({
      name: 'refuses every scope-incompatible defect class',
      fn: async () => {
        await Promise.resolve();
        const fixture = settledFixture();
        const [candidate,] = fixture.candidates;
        const [frontMatter,] = fixture.reviewPlan.frontMatterSubjects;
        const [clause,] = fixture.reviewPlan.clauses;
        const [relation,] = fixture.reviewPlan.relations;
        const [slot,] = fixture.reviewPlan.slotGroups;
        if ((candidate === undefined)
          || (frontMatter === undefined)
          || (clause === undefined)
          || (relation === undefined)
          || (slot === undefined))
          throw new Error('review unit scope fixture absent');
        const base = cleanResponse({ fixture, candidate, });
        /** Invalid front-matter image defect. */
        const invalidFrontMatter: ReviewUnitResponse = {
          ...base,
          frontMatterStatuses: `d${base.frontMatterStatuses.slice(1,)}`,
          findings: [{
            scope: 'fm',
            subjectIndex: 0,
            defectClassIndex: REVIEW_UNIT_DEFECT_CLASSES.indexOf('image-relation',),
            sourceEvidenceIndexes: [],
            imageEvidenceIndexes: [],
            targetAnchors: [anchor({ candidate, slotKey: frontMatter.targetSlotKey, }),],
          },],
        };
        /** Invalid clause image defect. */
        const clauseStatuses = [...base.clauseStatusesBySlot,];
        const [firstClauseStatuses = '',] = clauseStatuses;
        clauseStatuses[0] = `d${firstClauseStatuses.slice(1,)}`;
        const invalidClause: ReviewUnitResponse = {
          ...base,
          clauseStatusesBySlot: clauseStatuses,
          findings: [{
            scope: 'c',
            subjectIndex: clause.subjectIndex,
            defectClassIndex: REVIEW_UNIT_DEFECT_CLASSES.indexOf('image-relation',),
            sourceEvidenceIndexes: clause.sourceEvidenceIndexes,
            imageEvidenceIndexes: [],
            targetAnchors: [anchor({ candidate, slotKey: clause.slotKey, }),],
          },],
        };
        /** Invalid relation omission. */
        const invalidRelation: ReviewUnitResponse = {
          ...base,
          relationStatuses: `d${base.relationStatuses.slice(1,)}`,
          findings: [{
            scope: 'r',
            subjectIndex: relation.subjectIndex,
            defectClassIndex: REVIEW_UNIT_DEFECT_CLASSES.indexOf('omission',),
            sourceEvidenceIndexes: relation.sourceEvidenceIndexes,
            imageEvidenceIndexes: [],
            targetAnchors: relation.allowedTargetSlotKeys.map(function target(slotKey,) {
              return anchor({ candidate, slotKey, });
            },),
          },],
        };
        /** Invalid language meaning defect. */
        const invalidLanguage: ReviewUnitResponse = {
          ...base,
          slotLanguageStatuses: `d${base.slotLanguageStatuses.slice(1,)}`,
          findings: [{
            scope: 'sl',
            subjectIndex: slot.groupIndex,
            defectClassIndex: REVIEW_UNIT_DEFECT_CLASSES.indexOf('wrong-meaning',),
            sourceEvidenceIndexes: [],
            imageEvidenceIndexes: [],
            targetAnchors: [anchor({ candidate, slotKey: slot.slotKey, }),],
          },],
        };
        /** Invalid global omission. */
        const invalidGlobal: ReviewUnitResponse = {
          ...base,
          globalStatuses: `d${base.globalStatuses.slice(1,)}`,
          findings: [{
            scope: 'g',
            subjectIndex: 0,
            defectClassIndex: REVIEW_UNIT_DEFECT_CLASSES.indexOf('omission',),
            sourceEvidenceIndexes: [],
            imageEvidenceIndexes: [],
            targetAnchors: [anchor({ candidate, slotKey: slot.slotKey, }),],
          },],
        };
        for (const response of [
          invalidFrontMatter,
          invalidClause,
          invalidRelation,
          invalidLanguage,
          invalidGlobal,
        ]) {
          expect(() => ballot({
            fixture,
            candidateOrdinal: candidate.candidateOrdinal,
            verifierOrdinal: 1,
            response,
          })).toThrow();
        }
      },
    }),
    it({
      name: 'refuses four anchors in every three-anchor scope',
      fn: async () => {
        await Promise.resolve();
        const fixture = settledFixture();
        const [candidate,] = fixture.candidates;
        const [frontMatter,] = fixture.reviewPlan.frontMatterSubjects;
        const [clause,] = fixture.reviewPlan.clauses;
        const [slot,] = fixture.reviewPlan.slotGroups;
        if ((candidate === undefined)
          || (frontMatter === undefined)
          || (clause === undefined)
          || (slot === undefined))
          throw new Error('review unit anchor cardinality fixture absent');
        /** Explicitly narrowed candidate captured by local helper. */
        const boundCandidate: ReviewUnitCandidate = candidate;
        /** Four disjoint anchors in requested target slot. */
        function fourAnchors(
          slotKey: string,
        ): readonly ReviewUnitFinding['targetAnchors'][number][] {
          return [
            anchor({ candidate: boundCandidate, slotKey, startOffset: 0, endOffset: 1, }),
            anchor({ candidate: boundCandidate, slotKey, startOffset: 1, endOffset: 2, }),
            anchor({ candidate: boundCandidate, slotKey, startOffset: 2, endOffset: 3, }),
            anchor({ candidate: boundCandidate, slotKey, startOffset: 3, endOffset: 4, }),
          ];
        }
        const base = cleanResponse({ fixture, candidate, });
        const frontResponse: ReviewUnitResponse = {
          ...base,
          frontMatterStatuses: `d${base.frontMatterStatuses.slice(1,)}`,
          findings: [{
            scope: 'fm',
            subjectIndex: 0,
            defectClassIndex: REVIEW_UNIT_DEFECT_CLASSES.indexOf('wrong-meaning',),
            sourceEvidenceIndexes: [],
            imageEvidenceIndexes: [],
            targetAnchors: fourAnchors(frontMatter.targetSlotKey,),
          },],
        };
        const clauseStatuses = [...base.clauseStatusesBySlot,];
        const [firstClauseStatuses = '',] = clauseStatuses;
        clauseStatuses[0] = `d${firstClauseStatuses.slice(1,)}`;
        const clauseResponse: ReviewUnitResponse = {
          ...base,
          clauseStatusesBySlot: clauseStatuses,
          findings: [{
            scope: 'c',
            subjectIndex: clause.subjectIndex,
            defectClassIndex: REVIEW_UNIT_DEFECT_CLASSES.indexOf('wrong-meaning',),
            sourceEvidenceIndexes: clause.sourceEvidenceIndexes,
            imageEvidenceIndexes: [],
            targetAnchors: fourAnchors(clause.slotKey,),
          },],
        };
        const languageResponse: ReviewUnitResponse = {
          ...base,
          slotLanguageStatuses: `d${base.slotLanguageStatuses.slice(1,)}`,
          findings: [{
            scope: 'sl',
            subjectIndex: slot.groupIndex,
            defectClassIndex: REVIEW_UNIT_DEFECT_CLASSES.indexOf('grammar-usage',),
            sourceEvidenceIndexes: [],
            imageEvidenceIndexes: [],
            targetAnchors: fourAnchors(slot.slotKey,),
          },],
        };
        for (const response of [frontResponse, clauseResponse, languageResponse,]) {
          expect(() => ballot({
            fixture,
            candidateOrdinal: candidate.candidateOrdinal,
            verifierOrdinal: 1,
            response,
          })).toThrow();
        }
      },
    }),
    it({
      name: 'requires canonical first sixty-four defect subjects under overflow',
      fn: async () => {
        await Promise.resolve();
        const sentences = Array.from({ length: 70, }, function sentence(_value, index,) {
          return `猫${String(index,)}。`;
        }).join('',);
        const source = `---\nname: 猫\n---\n# 猫\n\n${sentences}\n\n<PhotoScroll photos={['\${path}/photos/fixture.webp']} />\n`;
        const archive = `---\nname: Cat\n---\n# Cat\n\n${'The cat rests. '.repeat(70,)}\n\n<PhotoScroll photos={['\${path}/photos/fixture.webp']} />\n`;
        const fixture = createFixture({ source, archive, });
        const candidates = fixture.manifest.candidatePlan.map(function admit(plan,) {
          return admitReviewUnitAuthorResponse({
            response: authorResponse({ fixture, plan, }),
            shell: fixture.shell,
            manifest: fixture.manifest,
            reviewPlan: fixture.reviewPlan,
            plan,
            sourceText: fixture.source,
            archiveText: fixture.archive,
            sourcePictures: MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, };
    },),
          },);
        },);
        const [candidate,] = candidates;
        if (candidate === undefined)
          throw new Error('review unit overflow author absent');
        const base = cleanResponse({ fixture, candidate, });
        const clauses = fixture.reviewPlan.clauses.slice(0, 65,);
        const statuses = [...base.clauseStatusesBySlot,];
        for (const clause of clauses) {
          const groupIndex = fixture.reviewPlan.slotGroups.findIndex(function group(value,) {
            return value.clauseSubjectIndexes.includes(clause.subjectIndex,);
          },);
          const position = fixture.reviewPlan.slotGroups[groupIndex]
            ?.clauseSubjectIndexes.indexOf(clause.subjectIndex,) ?? (-1);
          const current = statuses[groupIndex] ?? '';
          statuses[groupIndex] = `${current.slice(0, position)}d${current.slice(position + 1,)}`;
        }
        const findings = clauses.slice(0, REVIEW_UNIT_FINDING_CAP,).map(function finding(clause,) {
          return {
            scope: 'c' as const,
            subjectIndex: clause.subjectIndex,
            defectClassIndex: REVIEW_UNIT_DEFECT_CLASSES.indexOf('omission',),
            sourceEvidenceIndexes: clause.sourceEvidenceIndexes,
            imageEvidenceIndexes: [],
            targetAnchors: [],
          };
        },);
        const settlement = createReviewUnitAuthorSettlement({
          manifest: fixture.manifest,
          states: candidates.map(function state(value,) {
            return {
              record: {
                id: `review-unit-author-${String(value.candidateOrdinal,)}`,
                modelId: value.modelId,
                manifestDigest: fixture.manifest.manifestDigest,
                basePromptDigest: digest({ text: `overflow-base-${value.candidateId}`, }),
                promptDigest: digest({ text: `overflow-prompt-${value.candidateId}`, }),
                startedAt: '2026-08-31T00:00:00.000Z',
                durationMs: 1,
                state: 'completed' as const,
              },
              candidate: value,
            };
          },),
        },);
        expect(() => admitReviewUnitResponse({
          response: { ...base, clauseStatusesBySlot: statuses, overflow: true, findings, },
          ledger: fixture.ledger,
          reviewPlan: fixture.reviewPlan,
          authorSettlement: settlement,
          candidateOrdinal: 0,
          verifierOrdinal: 1,
          verifierModelId: 'hf:zai-org/GLM-5.3-Flash',
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          sourceText: fixture.source,
          archiveText: fixture.archive,
          sourcePictures: MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, };
    },),
        },)).not.toThrow();
        expect(() => admitReviewUnitResponse({
          response: { ...base, clauseStatusesBySlot: statuses, overflow: true, findings: findings.toReversed(), },
          ledger: fixture.ledger,
          reviewPlan: fixture.reviewPlan,
          authorSettlement: settlement,
          candidateOrdinal: 0,
          verifierOrdinal: 1,
          verifierModelId: 'hf:zai-org/GLM-5.3-Flash',
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          sourceText: fixture.source,
          archiveText: fixture.archive,
          sourcePictures: MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, };
    },),
        },)).toThrow();
      },
    }),
    it({
      name: 'qualifies GLM candidate from clean Qwen and MiniMax nonself families',
      fn: async () => {
        await Promise.resolve();
        const fixture = settledFixture();
        const [, candidate,] = fixture.candidates;
        if (candidate === undefined)
          throw new Error('review unit GLM candidate absent');
        const response = cleanResponse({ fixture, candidate, });
        const selected = selection({
          fixture,
          ballots: [
            ballot({ fixture, candidateOrdinal: 1, verifierOrdinal: 0, response, }),
            ballot({ fixture, candidateOrdinal: 1, verifierOrdinal: 2, response, }),
          ],
        });
        expect(selected.candidate.candidateOrdinal).toBe(1,);
        expect(selected.evidenceFloorMet).toBe(true,);
        expect(selected.productionEligible).toBe(true,);
      },
    }),
    it({
      name: 'ignores self clean evidence and lets valid self defect veto',
      fn: async () => {
        await Promise.resolve();
        const fixture = settledFixture();
        const [, candidate,] = fixture.candidates;
        const [firstSlot,] = fixture.reviewPlan.slotGroups;
        const slotKey = firstSlot?.slotKey;
        if ((candidate === undefined) || (slotKey === undefined))
          throw new Error('review unit self evidence fixture absent');
        const clean = cleanResponse({ fixture, candidate, });
        const onlySelf = selection({
          fixture,
          ballots: [ballot({ fixture, candidateOrdinal: 1, verifierOrdinal: 1, response: clean, }),],
        });
        expect(onlySelf.evidenceFloorMet).toBe(false,);
        const oneNonself = selection({
          fixture,
          ballots: [ballot({ fixture, candidateOrdinal: 1, verifierOrdinal: 0, response: clean, }),],
        });
        expect(oneNonself.evidenceFloorMet).toBe(false,);
        const language = `d${clean.slotLanguageStatuses.slice(1,)}`;
        const selfDefect = ballot({
          fixture,
          candidateOrdinal: 1,
          verifierOrdinal: 1,
          response: {
            ...clean,
            slotLanguageStatuses: language,
            findings: [{
              scope: 'sl',
              subjectIndex: 0,
              defectClassIndex: REVIEW_UNIT_DEFECT_CLASSES.indexOf('grammar-usage',),
              sourceEvidenceIndexes: [],
              imageEvidenceIndexes: [],
              targetAnchors: [anchor({ candidate, slotKey, }),],
            },],
          },
        });
        const selected = selection({
          fixture,
          ballots: [
            ballot({ fixture, candidateOrdinal: 1, verifierOrdinal: 0, response: clean, }),
            ballot({ fixture, candidateOrdinal: 1, verifierOrdinal: 2, response: clean, }),
            selfDefect,
          ],
        });
        expect(selected.productionEligible).toBe(false,);
        expect(selected.dissentingVerifierModelIds).toEqual(['hf:zai-org/GLM-5.3-Flash',],);
      },
    }),
    it({
      name: 'refuses stale deterministic proof before verifier transport',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = settledFixture();
        const [candidate,] = fixture.candidates;
        if (candidate === undefined)
          throw new Error('review unit pre-dispatch candidate absent');
        const mutated = {
          ...candidate,
          deterministicProofDigest: digest({ text: 'stale-proof', }),
        };
        let calls = 0;
        const client: SyntheticClient = {
          chatText: async () => {
            calls += 1;
            throw new Error('review unit stale proof reached text transport');
          },
          chatJson: async <ValueT,>(): Promise<ChatJsonOutcome<ValueT>> => {
            calls += 1;
            throw new Error('review unit stale proof reached JSON transport');
          },
          quotas: async () => {
            calls += 1;
            throw new Error('review unit stale proof reached quota transport');
          },
        };
        const messages = reviewUnitVerifierMessages({
          manifest: fixture.manifest,
          shell: fixture.shell,
          reviewPlan: fixture.reviewPlan,
          candidate: mutated,
          authorSettlementDigest: fixture.settlement.settlementDigest,
          verifierPlanDigest: digest({ text: 'fixture-verifier-plan', }),
          defectClasses: REVIEW_UNIT_DEFECT_CLASSES,
          sourceText: fixture.source,
          archiveText: fixture.archive,
          media: MEDIA,
        },);
        await expect(runReviewUnitVerifierNode({
          outputDir: directory.path,
          client,
          candidate: mutated,
          verifierOrdinal: 0,
          verifierModelId: 'hf:Qwen/Qwen3.8-27B',
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          messages,
          authorSettlement: fixture.settlement,
          shell: fixture.shell,
          ledger: fixture.ledger,
          reviewPlan: fixture.reviewPlan,
          sourceText: fixture.source,
          archiveText: fixture.archive,
          sourcePictures: MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, };
    },),
          restart: false,
          signal: new AbortController().signal,
        },)).rejects.toThrow();
        expect(calls).toBe(0,);
      },
    }),
    it({
      name: 'forwards exact cancellation before verifier dispatch with zero calls',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = settledFixture();
        const [candidate,] = fixture.candidates;
        if (candidate === undefined)
          throw new Error('review unit cancellation candidate absent');
        let calls = 0;
        const client: SyntheticClient = {
          chatText: async () => {
            calls += 1;
            throw new Error('review unit cancellation reached text transport');
          },
          chatJson: async <ValueT,>(): Promise<ChatJsonOutcome<ValueT>> => {
            calls += 1;
            throw new Error('review unit cancellation reached JSON transport');
          },
          quotas: async () => {
            calls += 1;
            throw new Error('review unit cancellation reached quota transport');
          },
        };
        const messages = reviewUnitVerifierMessages({
          manifest: fixture.manifest,
          shell: fixture.shell,
          reviewPlan: fixture.reviewPlan,
          candidate,
          authorSettlementDigest: fixture.settlement.settlementDigest,
          verifierPlanDigest: digest({ text: 'cancellation-verifier-plan', }),
          defectClasses: REVIEW_UNIT_DEFECT_CLASSES,
          sourceText: fixture.source,
          archiveText: fixture.archive,
          media: MEDIA,
        },);
        const controller = new AbortController();
        const reason = new Error('exact Candidate K cancellation');
        controller.abort(reason,);
        await expect(runReviewUnitVerifierNode({
          outputDir: directory.path,
          client,
          candidate,
          verifierOrdinal: 0,
          verifierModelId: 'hf:Qwen/Qwen3.8-27B',
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          messages,
          authorSettlement: fixture.settlement,
          shell: fixture.shell,
          ledger: fixture.ledger,
          reviewPlan: fixture.reviewPlan,
          sourceText: fixture.source,
          archiveText: fixture.archive,
          sourcePictures: MEDIA.map(function picture(item,) {
            return { assetName: item.assetName, };
          },),
          restart: false,
          signal: controller.signal,
        },)).rejects.toBe(reason,);
        expect(calls).toBe(0,);
      },
    }),
    it({
      name: 'settles every verifier sibling before forwarding exact cancellation',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createFixture();
        const controller = new AbortController();
        const reason = new Error('exact Candidate K wave cancellation');
        const settled = { value: 0, };
        await expect(runFixture({
          fixture,
          outputDir: directory.path,
          client: verifierAbortClient({ fixture, controller, reason, settled, }),
          restart: false,
          signal: controller.signal,
        })).rejects.toBe(reason,);
        expect(settled.value).toBe(9,);
      },
    }),
    it({
      name: 'masks every provider route except manifest-bound Hyper',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createFixture();
        const forbiddenCalls = { value: 0, };
        const client = scriptedClient({
          fixture,
          calls: [],
          prompts: [],
          peak: { value: 0, inFlight: 0, },
        });
        await runFixture({
          fixture,
          outputDir: directory.path,
          client,
          allClient: forbiddenClient({ calls: forbiddenCalls, }),
          syntheticClient: forbiddenClient({ calls: forbiddenCalls, }),
          restart: false,
        });
        expect(forbiddenCalls.value).toBe(0,);
      },
    }),
    it({
      name: 'runs twelve static nodes in two concurrent waves and restarts without dispatch',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createFixture();
        const calls: string[] = [];
        const prompts: string[] = [];
        const peak = { value: 0, inFlight: 0, };
        const client = scriptedClient({ fixture, calls, prompts, peak, });
        const result = await runFixture({
          fixture,
          outputDir: directory.path,
          client,
          restart: false,
        });
        expect(calls.length).toBe(12,);
        expect(new Set(prompts,).size).toBe(12,);
        expect(prompts.every(function image(prompt,) {
          return prompt.includes('"image_url"',);
        },)).toBe(true,);
        expect((await readdir(join(
          directory.path,
          'prompt-claims',
          fixture.manifest.manifestDigest,
        ))).length).toBe(12,);
        expect(peak.value).toBe(9,);
        expect(result.completedNodeCount).toBe(12,);
        expect(result.spentUnusableNodeCount).toBe(0,);
        expect(result.skippedNodeCount).toBe(0,);
        const restartCalls: string[] = [];
        await runFixture({
          fixture,
          outputDir: directory.path,
          client: scriptedClient({
            fixture,
            calls: restartCalls,
            prompts: [],
            peak: { value: 0, inFlight: 0, },
          }),
          restart: true,
        });
        expect(restartCalls.length).toBe(0,);
        expect(
          JSON.parse(await readFile(join(directory.path, 'review-unit-plan.json',), 'utf8',)),
        ).toEqual(
          fixture.reviewPlan,
        );
      },
    }),
    it({
      name: 'skips exactly three verifier nodes after one unusable author',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createFixture();
        const calls: string[] = [];
        const client = scriptedClient({
          fixture,
          controls: { failAuthorOrdinal: 1, },
          calls,
          prompts: [],
          peak: { value: 0, inFlight: 0, },
        });
        const result = await runFixture({ fixture, outputDir: directory.path, client, restart: false, });
        expect(calls.length).toBe(9,);
        expect(result.completedNodeCount).toBe(8,);
        expect(result.spentUnusableNodeCount).toBe(1,);
        expect(result.skippedNodeCount).toBe(3,);
        const restartCalls: string[] = [];
        await runFixture({
          fixture,
          outputDir: directory.path,
          client: scriptedClient({
            fixture,
            controls: { failAuthorOrdinal: 1, },
            calls: restartCalls,
            prompts: [],
            peak: { value: 0, inFlight: 0, },
          }),
          restart: true,
        });
        expect(restartCalls.length).toBe(0,);
      },
    }),
    it({
      name: 'atomically spends duplicate raw verifier response',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createFixture();
        const client = scriptedClient({
          fixture,
          controls: { duplicateRawCandidateOrdinal: 0, },
          calls: [],
          prompts: [],
          peak: { value: 0, inFlight: 0, },
        });
        const result = await runFixture({ fixture, outputDir: directory.path, client, restart: false, });
        expect(result.verifierStates.filter(function spent(state,) {
          return state.record.state === 'spent-unusable';
        },).length).toBe(3,);
        expect(result.verifierStates.filter(function duplicate(state,) {
          return state.record.failureCategory === 'raw-duplicate';
        },).length).toBe(3,);
      },
    }),
    it({
      name: 'uses exact zero-retry canonical Hyper routes',
      fn: async () => {
        const fixture = createFixture();
        let attempts = 0;
        const routeClient = createReviewUnitHyperClient({
          apiKey: 'fixture',
          manifest: fixture.manifest,
          transport: async () => {
            attempts += 1;
            return { status: 500, bodyText: 'fixture', };
          },
        });
        let caught: unknown;
        try {
          await routeClient.client.chatText({
            modelId: 'hf:zai-org/GLM-5.3-Flash',
            messages: [{ role: 'user', content: 'fixture', },],
            signal: new AbortController().signal,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(attempts).toBe(1,);
        expect(Error.isError(caught,)).toBe(true,);
      },
    }),
    it({
      name: 'bounds strict response schema serialization below request ceiling numeral',
      fn: async () => {
        await Promise.resolve();
        const fixture = settledFixture();
        const [candidate,] = fixture.candidates;
        if (candidate === undefined)
          throw new Error('review unit envelope candidate absent');
        const format = reviewUnitResponseFormat({
          reviewPlan: fixture.reviewPlan,
          candidate,
          pictureCount: MEDIA.length,
        },);
        expect(JSON.stringify(format,).length < 32_000).toBe(true,);
        expect(REVIEW_UNIT_FINDING_CAP).toBe(64,);
      },
    }),
  ],
});
