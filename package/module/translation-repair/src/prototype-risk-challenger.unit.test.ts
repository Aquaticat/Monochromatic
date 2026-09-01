import { createHash, } from 'node:crypto';
import { existsSync, } from 'node:fs';
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
  CANDIDATE_M_ARCHITECTURE,
  CANDIDATE_M_AUTHOR_TIMEOUT_MS,
  CANDIDATE_M_CHALLENGER_ROLES,
  CANDIDATE_M_CHALLENGER_RULES,
  CANDIDATE_M_CHALLENGER_TIMEOUT_MS,
  CANDIDATE_M_MANIFEST_VERSION,
  CANDIDATE_M_RISK_ATTESTATION_DIGEST,
  CANDIDATE_M_RISK_POLICY_DIGEST,
  MAX_CANDIDATE_M_PAYLOAD_COUNT,
  admitRiskAttestedAuthorResponse,
  assertCandidateMChallengerBinding,
  bindReviewUnitClient,
  buildImmutableShell,
  buildRealizationObligationLedger,
  candidateMRiskAttestations,
  createCandidateMManifest,
  createReviewUnitHyperClient,
  createReviewUnitPlan,
  diagnoseRiskAttestedAuthorResponse,
  diagnoseRiskChallenge,
  riskAttestedAuthorMessages,
  riskChallengeResponseFormat,
  runCandidateMRuntime,
  selectCandidateM,
  type CandidateMAuthorResponse,
  type CandidateMChallenge,
  type CandidateMChallengeResponse,
  type CandidateMChallengeState,
  type CandidateMCandidate,
  type CandidateMManifest,
} from '../dist/final/node/prototype-risk-challenger.mjs';
import type {
  RealizationCandidatePlan,
  ReviewUnitPlan,
} from '../dist/final/node/prototype-review-unit.mjs';
import { bindReviewUnitRouteClient, } from '../dist/final/node/prototype-review-unit-test-support.mjs';
import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  isJsonRecord,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/** Disposable private runtime fixture. */
type TemporaryDirectory = AsyncDisposable & { readonly path: string };

/** Creates one disposable runtime root. */
async function temporaryDirectory(): Promise<TemporaryDirectory> {
  const path = await mkdtemp(join(tmpdir(), 'risk-challenger-',),);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

/** SHA-256 over exact text. */
function digest(text: string,): string {
  return createHash('sha256',).update(text,).digest('hex',);
}

/** Source front matter with ordered identity aliases. */
const SOURCE_FRONT = `---
name: 飞猫
info:
    alias: 飞猫, Carena
    location: 上海
desc: 纪念我们的朋友飞猫。
---

`;

/** Archive front matter used only as wording evidence. */
const ARCHIVE_FRONT = `---
name: Carena
info:
    alias: Carena
    location: Shanghai
desc: In memory of our friend Carena.
---

`;

/** Source paragraphs producing exact body slots. */
const SOURCE_BODY = `${Array.from({ length: 23, }, function paragraph(_value, index,) {
  return `飞猫的故事第${String(index,)}段。`;
}).join('\n\n',)}\n\n<PhotoScroll photos={['\${path}/photos/fixture.webp']} />\n`;

/** Archive paragraphs providing immutable shell shape. */
const ARCHIVE_BODY = `${Array.from({ length: 23, }, function paragraph(_value, index,) {
  return `Carena archive paragraph ${String(index,)}.`;
}).join('\n\n',)}\n\n<PhotoScroll photos={['\${path}/photos/fixture.webp']} />\n`;

/** Complete source and archive fixtures. */
const SOURCE = `${SOURCE_FRONT}${SOURCE_BODY}`;
const ARCHIVE = `${ARCHIVE_FRONT}${ARCHIVE_BODY}`;

/** Exact page image data. */
const DATA_URI = 'data:image/webp;base64,AA==';

/** Manifest-bound image evidence. */
const MEDIA = [{
  assetName: 'fixture.webp',
  dataUri: DATA_URI,
  digest: digest(DATA_URI,),
},] as const;

/** Candidate M author roster. */
const CANDIDATE_PLAN = [
  { ordinal: 0, modelId: 'hf:Qwen/Qwen3.8-27B', priority: 0, },
  { ordinal: 1, modelId: 'minimax-m3', priority: 1, },
] as const satisfies readonly RealizationCandidatePlan[];

/** Candidate M verifier roster. */
const VERIFIER_PLAN = [
  { ordinal: 0, modelId: 'hf:Qwen/Qwen3.8-27B', },
  { ordinal: 1, modelId: 'hf:zai-org/GLM-5.3-Flash', },
  { ordinal: 2, modelId: 'minimax-m3', },
] as const;

/** Complete Candidate M deterministic fixture. */
type Fixture = {
  readonly shell: ReturnType<typeof buildImmutableShell>;
  readonly ledger: ReturnType<typeof buildRealizationObligationLedger>;
  readonly reviewPlan: ReviewUnitPlan;
  readonly manifest: CandidateMManifest;
};

/** Creates exact Candidate M fixture. */
function fixture(): Fixture {
  const shell = buildImmutableShell({ sourceText: SOURCE, archiveText: ARCHIVE, });
  const ledger = buildRealizationObligationLedger({
    sourceBody: shell.body,
    archiveBody: ARCHIVE,
    slots: shell.slots,
    shellDigest: shell.shellDigest,
  },);
  const reviewPlan = createReviewUnitPlan({
    ledger,
    shell,
    sourceText: SOURCE,
    sourceBody: shell.body,
    archiveBody: ARCHIVE,
    ledgerDigest: digest(JSON.stringify(ledger,),),
  },);
  const manifest = createCandidateMManifest({
    ledger,
    shell,
    sourceText: SOURCE,
    sourceBody: shell.body,
    archiveBody: ARCHIVE,
    reviewPlan,
    candidatePlan: CANDIDATE_PLAN,
    verifierPlan: VERIFIER_PLAN,
    providerSelection: 'hyper-only',
    sourcePictures: MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, digest: item.digest, };
    },),
  },);
  return { shell, ledger, reviewPlan, manifest, };
}

/** Complete 27-value plus risk-attestation author response. */
function authorResponse({
  value,
  authorOrdinal,
}: {
  readonly value: Fixture;
  readonly authorOrdinal: number;
}): CandidateMAuthorResponse {
  const frontMatterValues = [
    'Carena',
    'Flying Cat, Carena',
    'Shanghai',
    'In memory of our friend Carena and everything she brought us.',
  ];
  const frontMatter = Object.fromEntries(value.reviewPlan.frontMatterSubjects.map(function slot(subject, index,) {
    const text = frontMatterValues[index];
    if (text === undefined)
      throw new Error('Candidate M front-matter fixture value is absent');
    return [subject.targetSlotKey, text,];
  },),);
  const body = Object.fromEntries(value.shell.slots.map(function slot(item, index,) {
    return [item.key, `Author ${String(authorOrdinal,)} complete English paragraph ${String(index,)}.`,];
  },),);
  return {
    slots: {
      ...frontMatter,
      ...body,
    },
    riskAttestations: candidateMRiskAttestations(),
  };
}

/** Complete guard-valid response failing deterministic alias admission. */
function invalidAliasResponse({
  value,
  authorOrdinal,
}: {
  readonly value: Fixture;
  readonly authorOrdinal: number;
}): CandidateMAuthorResponse {
  const response = authorResponse({ value, authorOrdinal, });
  const aliasKey = value.reviewPlan.frontMatterSubjects[1]?.targetSlotKey;
  if (aliasKey === undefined)
    throw new Error('Candidate M alias fixture key is absent');
  return {
    ...response,
    slots: {
      ...response.slots,
      [aliasKey]: 'Flying Cat, Carena, Extra',
    },
  };
}

/** Admits both Candidate M fixture authors. */
function candidates(value: Fixture,): readonly CandidateMCandidate[] {
  return CANDIDATE_PLAN.map(function candidate(plan,) {
    return admitRiskAttestedAuthorResponse({
      response: authorResponse({ value, authorOrdinal: plan.ordinal, }),
      shell: value.shell,
      manifest: value.manifest,
      reviewPlan: value.reviewPlan,
      plan,
      sourceText: SOURCE,
      archiveText: ARCHIVE,
      sourcePictures: [{ assetName: 'fixture.webp', },],
    },);
  },);
}

/** Extracts exact marked packet from provider request. */
function packet(request: ChatJsonRequest<unknown>, marker: string,): Readonly<Record<string, unknown>> {
  /** Unknown content parts copied from array-shaped messages. */
  const blocks: readonly unknown[] = request.messages.flatMap(function message(value,) {
    return isJsonRecord(value,) && Array.isArray(value.content,)
      ? value.content.map(function unknownPart(part,): unknown { return part; })
      : [];
  },);
  /** Exact marked packet block. */
  const text = blocks.find(function marked(block,) {
    return isJsonRecord(block,)
      && (block.type === 'text')
      && ((typeof block.text) === 'string')
      && block.text.startsWith(marker,);
  },);
  if ((!isJsonRecord(text,)) || ((typeof text.text) !== 'string'))
    throw new Error('Candidate M marked packet is absent');
  const parsed: unknown = JSON.parse(text.text.slice(marker.length,));
  if (!isJsonRecord(parsed,))
    throw new Error('Candidate M packet is not object');
  return parsed;
}

/** Clean challenge from exact request packet. */
function cleanChallenge(request: ChatJsonRequest<unknown>,): CandidateMChallengeResponse {
  const value = packet(request, 'RISK_CHALLENGER_PACKET:\n',);
  const {candidate} = value;
  if (!isJsonRecord(candidate,))
    throw new Error('Candidate M challenge candidate packet is absent');
  return {
    candidateId: String(candidate.candidateId,),
    candidateDigest: String(candidate.candidateDigest,),
    deterministicProofDigest: String(candidate.deterministicProofDigest,),
    sourceReviewPlanDigest: String(value.sourceReviewPlanDigest,),
    role: value.role === 'fidelity' ? 'fidelity' : 'publication-language',
    verdict: 'clean',
    findings: [],
  };
}

/** Scripted provider controls. */
type ClientControls = {
  readonly duplicateAuthorOrdinal?: number;
  readonly duplicateSelfChallenge?: boolean;
  readonly failAuthorOrdinal?: number;
  readonly invalidAliasAuthorOrdinal?: number;
  readonly throwAuthorOrdinal?: number;
};

/** Scripted exact Candidate M provider. */
function client({
  value,
  calls,
  controls = {},
}: {
  readonly value: Fixture;
  readonly calls: string[];
  readonly controls?: ClientControls;
}): SyntheticClient {
  return {
    chatText: async () => {
      await Promise.resolve();
      throw new Error('Candidate M text route unused');
    },
    chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
      const schema = request.responseFormat?.json_schema.name;
      calls.push(`${request.modelId}:${String(schema,)}:${String(request.exchangeTimeoutMs,)}`,);
      const authorOrdinal = value.manifest.candidatePlan.find(function model(plan,) {
        return plan.modelId === request.modelId;
      },)?.ordinal ?? (-1);
      if ((schema === 'risk_attested_realization') && (authorOrdinal === controls.throwAuthorOrdinal))
        throw new Error('fixture indeterminate author transport');
      if ((schema === 'risk_attested_realization') && (authorOrdinal === controls.failAuthorOrdinal)) {
        return {
          kind: 'schema-mismatch',
          rawText: '{}',
          detail: 'fixture author rejected',
          reason: 'caller-guard-rejected',
        };
      }
      const generated = schema === 'risk_attested_realization'
        ? authorOrdinal === controls.invalidAliasAuthorOrdinal
          ? invalidAliasResponse({ value, authorOrdinal, })
          : authorResponse({ value, authorOrdinal, })
        : cleanChallenge(request as ChatJsonRequest<unknown>,);
      if (!JSON.stringify(request.messages,).includes(DATA_URI,))
        throw new Error('Candidate M image did not reach scripted request');
      if (!request.validate(generated,))
        throw new Error('Candidate M scripted response failed guard');
      const serialized = JSON.stringify(generated,);
      const challengePacket = schema === 'risk_attested_realization'
        ? undefined
        : packet(request as ChatJsonRequest<unknown>, 'RISK_CHALLENGER_PACKET:\n',);
      const challengeCandidate = isJsonRecord(challengePacket?.candidate,)
        ? challengePacket.candidate
        : undefined;
      const duplicateChallenge = (controls.duplicateSelfChallenge === true)
        && (request.modelId === 'hf:Qwen/Qwen3.8-27B')
        && (challengePacket?.role === 'fidelity')
        && (challengeCandidate?.candidateId === candidates(value,)[0]?.candidateId);
      const rawText = (schema === 'risk_attested_realization')
        && (authorOrdinal === controls.duplicateAuthorOrdinal)
        ? `{"slots":{},${serialized.slice(1,)}`
        : duplicateChallenge
          ? `{"candidateId":"duplicate",${serialized.slice(1,)}`
          : serialized;
      return {
        kind: 'ok',
        value: generated as ValueT,
        rawText,
      };
    },
    quotas: async () => {
      await Promise.resolve();
      throw new Error('Candidate M quota route unused');
    },
  };
}

/** Client cancelling after both Candidate M authors enter transport. */
function authorCancellationClient({
  controller,
  reason,
  settled,
}: {
  readonly controller: AbortController;
  readonly reason: unknown;
  readonly settled: { value: number };
}): SyntheticClient {
  const barrier = Promise.withResolvers<undefined>();
  const arrivals = { value: 0, };
  return {
    chatText: async () => {
      await Promise.resolve();
      throw new Error('Candidate M author cancellation text route unused');
    },
    chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
      arrivals.value += 1;
      if (arrivals.value === 2) {
        controller.abort(reason,);
        barrier.resolve(undefined,);
      }
      await barrier.promise;
      await wait(request.modelId === 'minimax-m3' ? 5 : 1,);
      settled.value += 1;
      throw request.signal.reason;
    },
    quotas: async () => {
      await Promise.resolve();
      throw new Error('Candidate M author cancellation quota route unused');
    },
  };
}

/** Client cancelling after all twelve Candidate M challengers enter transport. */
function challengerCancellationClient({
  value,
  controller,
  reason,
  settled,
}: {
  readonly value: Fixture;
  readonly controller: AbortController;
  readonly reason: unknown;
  readonly settled: { value: number };
}): SyntheticClient {
  const author = client({ value, calls: [], });
  const barrier = Promise.withResolvers<undefined>();
  const arrivals = { value: 0, };
  return {
    chatText: author.chatText,
    chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
      if (request.responseFormat?.json_schema.name === 'risk_attested_realization')
        return await author.chatJson(request,);
      arrivals.value += 1;
      if (arrivals.value === 12) {
        controller.abort(reason,);
        barrier.resolve(undefined,);
      }
      await barrier.promise;
      await wait(request.modelId === 'minimax-m3' ? 5 : 1,);
      settled.value += 1;
      throw request.signal.reason;
    },
    quotas: author.quotas,
  };
}

/** Binds one scripted Hyper route. */
function boundClient({
  value,
  outputDir,
  scripted,
}: {
  readonly value: Fixture;
  readonly outputDir: string;
  readonly scripted: SyntheticClient;
}): ReturnType<typeof bindReviewUnitClient> {
  return bindReviewUnitClient({
    manifest: value.manifest,
    outputDir,
    clients: {
      all: scripted,
      synthetic: scripted,
      hyper: bindReviewUnitRouteClient({
        client: scripted,
        providerRouteDigest: value.manifest.providerRouteDigest,
      },),
    },
  },);
}

/** Signal becoming aborted after named durable artifact exists. */
function artifactAbortSignal({
  artifactPath,
  reason,
}: {
  readonly artifactPath: string;
  readonly reason: unknown;
}): AbortSignal {
  const real = new AbortController().signal;
  return new Proxy(real, {
    get(target, property, receiver,): unknown {
      if (property === 'aborted')
        return existsSync(artifactPath,);
      if (property === 'reason')
        return reason;
      const value: unknown = Reflect.get(target, property, receiver,);
      return (typeof value) === 'function' ? value.bind(target,) : value;
    },
  });
}

/** One exact body target anchor. */
function targetAnchor(candidate: CandidateMCandidate,): {
  readonly slotKey: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly digest: string;
} {
  const slotKey = candidate.mutableSlotKeys?.[4];
  if (slotKey === undefined)
    throw new Error('Candidate M target slot fixture is absent');
  const text = candidate.slots[slotKey];
  if (text === undefined)
    throw new Error('Candidate M target text fixture is absent');
  const endOffset = Math.min(3, text.length,);
  return {
    slotKey,
    startOffset: 0,
    endOffset,
    digest: digest(text.slice(0, endOffset,),),
  };
}

await describe({
  name: 'Candidate M risk challengers',
  children: [
    it({
      name: 'binds version three architecture separate risk policy and exact attestation identities',
      fn: async () => {
        await Promise.resolve();
        const value = fixture();
        expect(value.manifest.version).toBe(CANDIDATE_M_MANIFEST_VERSION,);
        expect(value.manifest.architecture).toBe(CANDIDATE_M_ARCHITECTURE,);
        expect(value.manifest.payloadCountCeiling).toBe(MAX_CANDIDATE_M_PAYLOAD_COUNT,);
        expect(CANDIDATE_M_RISK_POLICY_DIGEST === CANDIDATE_M_RISK_ATTESTATION_DIGEST).toBe(false,);
        expect(value.manifest.riskPolicyDigest).toBe(CANDIDATE_M_RISK_POLICY_DIGEST,);
        expect(value.manifest.riskAttestationDigest).toBe(CANDIDATE_M_RISK_ATTESTATION_DIGEST,);
        const messages = riskAttestedAuthorMessages({
          plan: CANDIDATE_PLAN[0],
          manifest: value.manifest,
          shell: value.shell,
          reviewPlan: value.reviewPlan,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
        },);
        const serialized = JSON.stringify(messages,);
        expect(serialized.includes('riskRegister',)).toBe(true,);
        expect(serialized.includes('reviewPlan',)).toBe(false,);
        expect(serialized.includes('obligation',)).toBe(false,);
      },
    }),
    it({
      name: 'admits exactly ordered attestations and rejects order code missing and extra drift',
      fn: async () => {
        await Promise.resolve();
        const value = fixture();
        const response = authorResponse({ value, authorOrdinal: 0, });
        expect(diagnoseRiskAttestedAuthorResponse({
          value: response,
          shell: value.shell,
          reviewPlan: value.reviewPlan,
        })).toEqual({ kind: 'accepted', },);
        const variants: unknown[] = [
          {
            slots: response.slots,
            riskAttestations: Object.fromEntries(Object.entries(response.riskAttestations,).toReversed(),),
          },
          {
            slots: response.slots,
            riskAttestations: { ...response.riskAttestations, actorAttribution: 'clean', },
          },
          {
            slots: response.slots,
            riskAttestations: Object.fromEntries(Object.entries(response.riskAttestations,).slice(1,),),
          },
          {
            slots: response.slots,
            riskAttestations: { ...response.riskAttestations, extra: 'checked', },
          },
        ];
        expect(variants.every(function rejected(variant,) {
          return diagnoseRiskAttestedAuthorResponse({
            value: variant,
            shell: value.shell,
            reviewPlan: value.reviewPlan,
          }).kind === 'rejected';
        },)).toBe(true,);
      },
    }),
    it({
      name: 'carries executable role scope and cardinality rules while narrowing role schemas',
      fn: async () => {
        await Promise.resolve();
        const value = fixture();
        const [candidate,] = candidates(value,);
        if (candidate === undefined)
          throw new Error('Candidate M candidate fixture is absent');
        expect(CANDIDATE_M_CHALLENGER_RULES.evidenceCardinality.length).toBe(16,);
        expect(CANDIDATE_M_CHALLENGER_RULES.sourceScopes.relation.includes('chronology',)).toBe(true,);
        const fidelity = JSON.stringify(riskChallengeResponseFormat({
          candidate,
          reviewPlan: value.reviewPlan,
          role: 'fidelity',
          sourceReviewPlanDigest: digest('source-plan',),
          pictureCount: 1,
        },),);
        const language = JSON.stringify(riskChallengeResponseFormat({
          candidate,
          reviewPlan: value.reviewPlan,
          role: 'publication-language',
          sourceReviewPlanDigest: digest('source-plan',),
          pictureCount: 1,
        },),);
        expect(fidelity.includes('wrong-meaning',)).toBe(true,);
        expect(fidelity.includes('grammar-usage',)).toBe(false,);
        expect(language.includes('grammar-usage',)).toBe(true,);
        expect(language.includes('wrong-meaning',)).toBe(false,);
        expect(fidelity.length < 32_000).toBe(true,);
        expect(language.length < 32_000).toBe(true,);
        const planNode = {
          candidateOrdinal: 0,
          verifierOrdinal: 0,
          verifierModelId: 'hf:Qwen/Qwen3.8-27B' as const,
          role: 'fidelity' as const,
          state: 'dispatch' as const,
          sourceReviewPlanDigest: digest('source-plan',),
          schemaDigest: digest('schema',),
        };
        expect(() => assertCandidateMChallengerBinding({
          node: planNode,
          sourceReviewPlanDigest: digest('source-plan',),
          schemaDigest: digest('schema',),
        },)).not.toThrow();
        expect(() => assertCandidateMChallengerBinding({
          node: planNode,
          sourceReviewPlanDigest: digest('other-source-plan',),
          schemaDigest: digest('schema',),
        },)).toThrow();
        expect(() => assertCandidateMChallengerBinding({
          node: planNode,
          sourceReviewPlanDigest: digest('source-plan',),
          schemaDigest: digest('other-schema',),
        },)).toThrow();
      },
    }),
    it({
      name: 'accepts clean and exact shared defect then diagnoses role scope cardinality and anchor drift',
      fn: async () => {
        await Promise.resolve();
        const value = fixture();
        const [candidate,] = candidates(value,);
        if (candidate === undefined)
          throw new Error('Candidate M candidate fixture is absent');
        const binding = {
          candidateId: candidate.candidateId,
          candidateDigest: candidate.candidateDigest,
          deterministicProofDigest: candidate.deterministicProofDigest,
          sourceReviewPlanDigest: digest('source-plan',),
          role: 'fidelity' as const,
        };
        const clean = { ...binding, verdict: 'clean' as const, findings: [], };
        expect(diagnoseRiskChallenge({
          value: clean,
          role: 'fidelity',
          candidate,
          reviewPlan: value.reviewPlan,
          sourceReviewPlanDigest: binding.sourceReviewPlanDigest,
          pictureCount: 1,
        })).toEqual({ kind: 'accepted', },);
        expect(diagnoseRiskChallenge({
          value: { ...clean, candidateId: 'stale-candidate', },
          role: 'fidelity',
          candidate,
          reviewPlan: value.reviewPlan,
          sourceReviewPlanDigest: binding.sourceReviewPlanDigest,
          pictureCount: 1,
        })).toEqual({ kind: 'rejected', failure: 'candidate-binding', },);
        const finding = {
          defectClass: 'actor-reference' as const,
          sourceEvidence: [{ scope: 'clause' as const, subjectIndex: 0, },],
          targetAnchors: [targetAnchor(candidate,),],
          imageEvidenceIndexes: [],
        };
        const defect = { ...binding, verdict: 'defect' as const, findings: [finding,], };
        for (const cardinalityDrift of [
          { ...clean, findings: [finding,], },
          { ...defect, findings: [], },
          { ...defect, findings: [finding, finding,], },
        ]) {
          expect(diagnoseRiskChallenge({
            value: cardinalityDrift,
            role: 'fidelity',
            candidate,
            reviewPlan: value.reviewPlan,
            sourceReviewPlanDigest: binding.sourceReviewPlanDigest,
            pictureCount: 1,
          })).toEqual({ kind: 'rejected', failure: 'verdict-finding-cardinality', },);
        }
        expect(diagnoseRiskChallenge({
          value: defect,
          role: 'fidelity',
          candidate,
          reviewPlan: value.reviewPlan,
          sourceReviewPlanDigest: binding.sourceReviewPlanDigest,
          pictureCount: 1,
        })).toEqual({ kind: 'accepted', },);
        for (const [mutated, failure,] of [
          [{ ...defect, findings: [{ ...finding, defectClass: 'grammar-usage', },], }, 'role',],
          [{ ...defect, findings: [{ ...finding, sourceEvidence: [{ scope: 'relation', subjectIndex: value.reviewPlan.relations.length, },], },], }, 'source-scope',],
          [{ ...defect, findings: [{ ...finding, sourceEvidence: [], },], }, 'finding-shape',],
          [{ ...defect, findings: [{ ...finding, targetAnchors: [{ ...targetAnchor(candidate,), digest: digest('wrong',), },], },], }, 'anchor',],
        ] as const) {
          expect(diagnoseRiskChallenge({
            value: mutated,
            role: 'fidelity',
            candidate,
            reviewPlan: value.reviewPlan,
            sourceReviewPlanDigest: binding.sourceReviewPlanDigest,
            pictureCount: 1,
          })).toEqual({ kind: 'rejected', failure, },);
        }
      },
    }),
    it({
      name: 'runs fourteen static nodes with role deadlines strict floors and zero-call restart',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const value = fixture();
        const calls: string[] = [];
        const scripted = client({ value, calls, });
        const result = await runCandidateMRuntime({
          outputDir: directory.path,
          boundClient: boundClient({ value, outputDir: directory.path, scripted, }),
          manifest: value.manifest,
          expectedManifestDigest: value.manifest.manifestDigest,
          shell: value.shell,
          ledger: value.ledger,
          reviewPlan: value.reviewPlan,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
          restart: false,
          signal: new AbortController().signal,
        },);
        expect(calls.length).toBe(14,);
        expect(calls.filter(function author(call,) {
          return call.includes(`:${String(CANDIDATE_M_AUTHOR_TIMEOUT_MS,)}`,);
        },).length).toBe(2,);
        expect(calls.filter(function challenger(call,) {
          return call.includes(`:${String(CANDIDATE_M_CHALLENGER_TIMEOUT_MS,)}`,);
        },).length).toBe(12,);
        expect(result.completedNodeCount).toBe(14,);
        expect(result.skippedNodeCount).toBe(0,);
        expect(result.challengerPlan.nodes.length).toBe(12,);
        const terminalIds = [
          ...result.authorStates,
          ...result.challengerStates,
        ].map(function id(state,) { return state.record.id; });
        expect(new Set(terminalIds,).size).toBe(14,);
        expect(terminalIds.toSorted()).toEqual([
          'risk-challenger-author-0',
          'risk-challenger-author-1',
          ...CANDIDATE_PLAN.flatMap(function author(authorPlan,) {
            return VERIFIER_PLAN.flatMap(function verifier(verifierPlan,) {
              return CANDIDATE_M_CHALLENGER_ROLES.map(function challengeRole(roleName,) {
                return `risk-challenger-verifier-${String(authorPlan.ordinal,)}-${String(verifierPlan.ordinal,)}-${roleName}`;
              },);
            },);
          },),
        ].toSorted(),);
        expect(result.selection?.candidate.candidateOrdinal).toBe(0,);
        expect(result.selection?.evidenceFloorMet).toBe(true,);
        expect(result.selection?.productionEligible).toBe(true,);
        expect(Object.keys(result.selection?.cleanFamiliesByRole ?? {}).toSorted()).toEqual([
          ...CANDIDATE_M_CHALLENGER_ROLES,
        ].toSorted(),);
        const restartCalls: string[] = [];
        const restarted = await runCandidateMRuntime({
          outputDir: directory.path,
          boundClient: boundClient({
            value,
            outputDir: directory.path,
            scripted: client({ value, calls: restartCalls, }),
          }),
          manifest: value.manifest,
          expectedManifestDigest: value.manifest.manifestDigest,
          shell: value.shell,
          ledger: value.ledger,
          reviewPlan: value.reviewPlan,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
          restart: true,
          signal: new AbortController().signal,
        },);
        expect(restartCalls.length).toBe(0,);
        expect(restarted).toEqual(result,);
      },
    }),
    it({
      name: 'forwards exact pre-author and between-wave cancellation without challenger dispatch',
      fn: async () => {
        await using preDirectory = await temporaryDirectory();
        const value = fixture();
        const preCalls: string[] = [];
        const preScripted = client({ value, calls: preCalls, });
        const preController = new AbortController();
        const preReason = new Error('exact Candidate M pre-author cancellation');
        preController.abort(preReason,);
        await expect(runCandidateMRuntime({
          outputDir: preDirectory.path,
          boundClient: boundClient({ value, outputDir: preDirectory.path, scripted: preScripted, }),
          manifest: value.manifest,
          expectedManifestDigest: value.manifest.manifestDigest,
          shell: value.shell,
          ledger: value.ledger,
          reviewPlan: value.reviewPlan,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
          restart: false,
          signal: preController.signal,
        },)).rejects.toBe(preReason,);
        expect(preCalls.length).toBe(0,);

        await using betweenDirectory = await temporaryDirectory();
        const calls: string[] = [];
        const scripted = client({ value, calls, });
        const betweenReason = new Error('exact Candidate M between-wave cancellation');
        await expect(runCandidateMRuntime({
          outputDir: betweenDirectory.path,
          boundClient: boundClient({ value, outputDir: betweenDirectory.path, scripted, }),
          manifest: value.manifest,
          expectedManifestDigest: value.manifest.manifestDigest,
          shell: value.shell,
          ledger: value.ledger,
          reviewPlan: value.reviewPlan,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
          restart: false,
          signal: artifactAbortSignal({
            artifactPath: join(betweenDirectory.path, 'risk-challenger-author-settlement.json',),
            reason: betweenReason,
          }),
        },)).rejects.toBe(betweenReason,);
        expect(calls.length).toBe(2,);
        expect(
          existsSync(join(betweenDirectory.path, 'risk-challenger-plan.json',)),
        ).toBe(false,);
        const restartCalls: string[] = [];
        const restarted = await runCandidateMRuntime({
          outputDir: betweenDirectory.path,
          boundClient: boundClient({
            value,
            outputDir: betweenDirectory.path,
            scripted: client({ value, calls: restartCalls, }),
          }),
          manifest: value.manifest,
          expectedManifestDigest: value.manifest.manifestDigest,
          shell: value.shell,
          ledger: value.ledger,
          reviewPlan: value.reviewPlan,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
          restart: true,
          signal: new AbortController().signal,
        },);
        expect(restartCalls.length).toBe(12,);
        expect(restarted.completedNodeCount).toBe(14,);
        expect(restarted.selection?.productionEligible).toBe(true,);
      },
    }),
    it({
      name: 'settles both authors and all twelve challengers before forwarding exact in-flight cancellation',
      fn: async () => {
        const value = fixture();
        await using authorDirectory = await temporaryDirectory();
        const authorController = new AbortController();
        const authorReason = new Error('exact Candidate M author-wave cancellation');
        const authorSettled = { value: 0, };
        const authorScripted = authorCancellationClient({
          controller: authorController,
          reason: authorReason,
          settled: authorSettled,
        });
        await expect(runCandidateMRuntime({
          outputDir: authorDirectory.path,
          boundClient: boundClient({ value, outputDir: authorDirectory.path, scripted: authorScripted, }),
          manifest: value.manifest,
          expectedManifestDigest: value.manifest.manifestDigest,
          shell: value.shell,
          ledger: value.ledger,
          reviewPlan: value.reviewPlan,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
          restart: false,
          signal: authorController.signal,
        },)).rejects.toBe(authorReason,);
        expect(authorSettled.value).toBe(2,);

        await using challengerDirectory = await temporaryDirectory();
        const challengerController = new AbortController();
        const challengerReason = new Error('exact Candidate M challenger-wave cancellation');
        const challengerSettled = { value: 0, };
        const challengerScripted = challengerCancellationClient({
          value,
          controller: challengerController,
          reason: challengerReason,
          settled: challengerSettled,
        });
        await expect(runCandidateMRuntime({
          outputDir: challengerDirectory.path,
          boundClient: boundClient({ value, outputDir: challengerDirectory.path, scripted: challengerScripted, }),
          manifest: value.manifest,
          expectedManifestDigest: value.manifest.manifestDigest,
          shell: value.shell,
          ledger: value.ledger,
          reviewPlan: value.reviewPlan,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
          restart: false,
          signal: challengerController.signal,
        },)).rejects.toBe(challengerReason,);
        expect(challengerSettled.value).toBe(12,);
      },
    }),
    it({
      name: 'skips exactly six challengers after unusable author and spends duplicate raw author atomically',
      fn: async () => {
        await Promise.all([
          { failAuthorOrdinal: 0, },
          { duplicateAuthorOrdinal: 0, },
          { invalidAliasAuthorOrdinal: 0, },
          { throwAuthorOrdinal: 0, },
        ].map(async function scenario(controls,) {
          await using directory = await temporaryDirectory();
          const value = fixture();
          const calls: string[] = [];
          const scripted = client({ value, calls, controls, });
          const result = await runCandidateMRuntime({
            outputDir: directory.path,
            boundClient: boundClient({ value, outputDir: directory.path, scripted, }),
            manifest: value.manifest,
            expectedManifestDigest: value.manifest.manifestDigest,
            shell: value.shell,
            ledger: value.ledger,
            reviewPlan: value.reviewPlan,
            sourceText: SOURCE,
            archiveText: ARCHIVE,
            media: MEDIA,
            restart: false,
            signal: new AbortController().signal,
          },);
          expect(calls.length).toBe(8,);
          expect(result.spentUnusableNodeCount).toBe(1,);
          expect(result.skippedNodeCount).toBe(6,);
          expect(result.skippedChallengerNodes.length).toBe(6,);
          expect(result.authorSettlement.rows[0]?.candidate).toBe(undefined,);
          expect(result.selection?.candidate.candidateOrdinal).toBe(1,);
          if (controls.duplicateAuthorOrdinal === 0)
            expect(result.authorStates[0]?.record.failureCategory).toBe('raw-duplicate',);
          if (controls.invalidAliasAuthorOrdinal === 0)
            expect(result.authorStates[0]?.record.failureCategory).toBe('candidate-binding',);
          if ((controls.duplicateAuthorOrdinal === 0)
            || (controls.invalidAliasAuthorOrdinal === 0)
            || (controls.throwAuthorOrdinal === 0)) {
            const restartCalls: string[] = [];
            const restarted = await runCandidateMRuntime({
              outputDir: directory.path,
              boundClient: boundClient({
                value,
                outputDir: directory.path,
                scripted: client({ value, calls: restartCalls, }),
              }),
              manifest: value.manifest,
              expectedManifestDigest: value.manifest.manifestDigest,
              shell: value.shell,
              ledger: value.ledger,
              reviewPlan: value.reviewPlan,
              sourceText: SOURCE,
              archiveText: ARCHIVE,
              media: MEDIA,
              restart: true,
              signal: new AbortController().signal,
            },);
            expect(restartCalls.length).toBe(0,);
            expect(restarted).toEqual(result,);
          }
        },),);
      },
    }),
    it({
      name: 'spends duplicate raw self challenge without weakening nonself evidence floor',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const value = fixture();
        const calls: string[] = [];
        const scripted = client({
          value,
          calls,
          controls: { duplicateSelfChallenge: true, },
        });
        const result = await runCandidateMRuntime({
          outputDir: directory.path,
          boundClient: boundClient({ value, outputDir: directory.path, scripted, }),
          manifest: value.manifest,
          expectedManifestDigest: value.manifest.manifestDigest,
          shell: value.shell,
          ledger: value.ledger,
          reviewPlan: value.reviewPlan,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
          restart: false,
          signal: new AbortController().signal,
        },);
        expect(calls.length).toBe(14,);
        expect(result.completedNodeCount).toBe(13,);
        expect(result.spentUnusableNodeCount).toBe(1,);
        const spent = result.challengerStates.find(function unusable(state,) {
          return state.record.state === 'spent-unusable';
        },);
        expect(spent?.record.failureCategory).toBe('raw-duplicate',);
        expect(result.selection?.candidate.candidateOrdinal).toBe(0,);
        expect(result.selection?.evidenceFloorMet).toBe(true,);
        expect(result.selection?.productionEligible).toBe(true,);
      },
    }),
    it({
      name: 'uses defects as vetoes excludes self clean and treats abstention only as floor absence',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const value = fixture();
        const scripted = client({ value, calls: [], });
        const result = await runCandidateMRuntime({
          outputDir: directory.path,
          boundClient: boundClient({ value, outputDir: directory.path, scripted, }),
          manifest: value.manifest,
          expectedManifestDigest: value.manifest.manifestDigest,
          shell: value.shell,
          ledger: value.ledger,
          reviewPlan: value.reviewPlan,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
          restart: false,
          signal: new AbortController().signal,
        },);
        const [candidate0, candidate1,] = candidates(value,);
        if ((candidate0 === undefined) || (candidate1 === undefined))
          throw new Error('Candidate M selection fixtures are absent');
        const selfState = result.challengerStates.find(function self(state,) {
          return (state.challenge?.candidateId === candidate0.candidateId)
            && (state.challenge.verifierModelId === candidate0.modelId);
        },);
        if (selfState?.challenge === undefined)
          throw new Error('Candidate M self challenge fixture is absent');
        const selfDefect: CandidateMChallenge = {
          ...selfState.challenge,
          verdict: 'defect',
          findings: [{
            defectClass: 'actor-reference',
            sourceEvidence: [{ scope: 'clause', subjectIndex: 0, },],
            targetAnchors: [targetAnchor(candidate0,),],
            imageEvidenceIndexes: [],
          },],
        };
        const vetoStates: CandidateMChallengeState[] = result.challengerStates.map(function replace(state,) {
          return state === selfState ? { ...state, challenge: selfDefect, } : state;
        },);
        const selected = selectCandidateM({
          candidates: [candidate0, candidate1,],
          states: vetoStates,
          manifest: value.manifest,
        },);
        expect(selected.candidate.candidateOrdinal).toBe(1,);
        expect(selected.productionEligible).toBe(true,);
        const withoutGlm = selectCandidateM({
          candidates: [candidate0, candidate1,],
          states: result.challengerStates.filter(function noGlm(state,) {
            return state.challenge?.verifierModelId !== 'hf:zai-org/GLM-5.3-Flash';
          },),
          manifest: value.manifest,
        },);
        expect(withoutGlm.candidate.candidateOrdinal).toBe(0,);
        expect(withoutGlm.evidenceFloorMet).toBe(false,);
        expect(withoutGlm.productionEligible).toBe(false,);
        expect(withoutGlm.dissentingVerifierModelIds.length).toBe(0,);
      },
    }),
    it({
      name: 'refuses stale manifest version and wrong provider-output binding',
      fn: async () => {
        await using boundDirectory = await temporaryDirectory();
        await using wrongDirectory = await temporaryDirectory();
        const value = fixture();
        const fakeClient = client({ value, calls: [], });
        const bound = bindReviewUnitClient({
          manifest: value.manifest,
          outputDir: boundDirectory.path,
          clients: {
            all: fakeClient,
            synthetic: fakeClient,
            hyper: bindReviewUnitRouteClient({
              client: fakeClient,
              providerRouteDigest: value.manifest.providerRouteDigest,
            },),
          },
        });
        await expect(runCandidateMRuntime({
          outputDir: wrongDirectory.path,
          boundClient: bound,
          manifest: value.manifest,
          expectedManifestDigest: value.manifest.manifestDigest,
          shell: value.shell,
          ledger: value.ledger,
          reviewPlan: value.reviewPlan,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
          restart: false,
          signal: new AbortController().signal,
        },)).rejects.toThrow();
        const stale = { ...value.manifest, version: 2, };
        expect(() => admitRiskAttestedAuthorResponse({
          response: authorResponse({ value, authorOrdinal: 0, }),
          shell: value.shell,
          manifest: stale as CandidateMManifest,
          reviewPlan: value.reviewPlan,
          plan: CANDIDATE_PLAN[0],
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [{ assetName: 'fixture.webp', },],
        })).toThrow();
        expect(createReviewUnitHyperClient({
          apiKey: 'fixture',
          manifest: value.manifest,
          transport: async () => ({ status: 500, bodyText: 'fixture', }),
        }).providerRouteDigest).toBe(value.manifest.providerRouteDigest,);
      },
    }),
  ],
});
