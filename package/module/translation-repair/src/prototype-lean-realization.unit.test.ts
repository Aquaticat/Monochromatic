import { createHash, } from 'node:crypto';
import { existsSync, } from 'node:fs';
import {
  mkdtemp,
  readFile,
  readdir,
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
  admitLeanRealizationResponse,
  admitReviewUnitResponse,
  assertLeanRealizationBinding,
  bindReviewUnitClient,
  buildImmutableShell,
  buildRealizationObligationLedger,
  createReviewUnitManifest,
  createReviewUnitPlan,
  LEAN_FRONT_MATTER_AUTHORITY_DIGEST,
  LEAN_FRONT_MATTER_CONTRACTS,
  leanRealizationAuthorMessages,
  leanRealizationGuard,
  leanRealizationVerifierMessages,
  leanRealizationResponseFormat,
  leanVerifierEvidence,
  leanRealizationSlotKeys,
  MAX_LEAN_REALIZATION_PAYLOAD_COUNT,
  reviewUnitResponseFormat,
  runReviewUnitRuntime,
  type RealizationCandidatePlan,
  type ReviewUnitAuthorSettlement,
  type ReviewUnitCandidate,
  type ReviewUnitFinding,
  type ReviewUnitManifest,
  type ReviewUnitPlan,
  type ReviewUnitResponse,
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

/** Disposable private runtime fixture. */
type TemporaryDirectory = AsyncDisposable & { readonly path: string };

/** Creates one disposable runtime root. */
async function temporaryDirectory(): Promise<TemporaryDirectory> {
  const path = await mkdtemp(join(tmpdir(), 'lean-realization-',),);
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

/** Source front matter with identity-bearing alias grammar. */
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

/** Source paragraphs producing exact body-slot cardinality. */
const SOURCE_BODY = `${Array.from({ length: 23, }, function paragraph(_value, index,) {
  return `飞猫的故事第${String(index,)}段。`;
}).join('\n\n',)}\n\n<PhotoScroll photos={['\${path}/photos/fixture.webp']} />\n`;

/** Archive paragraphs providing immutable shell shape. */
const ARCHIVE_BODY = `${Array.from({ length: 23, }, function paragraph(_value, index,) {
  return `Carena archive paragraph ${String(index,)}.`;
}).join('\n\n',)}\n\n<PhotoScroll photos={['\${path}/photos/fixture.webp']} />\n`;

/** Complete fixture source and archive. */
const SOURCE = `${SOURCE_FRONT}${SOURCE_BODY}`;
const ARCHIVE = `${ARCHIVE_FRONT}${ARCHIVE_BODY}`;

/** Exact page image. */
const DATA_URI = 'data:image/webp;base64,AA==';

/** Manifest-bound image evidence. */
const MEDIA = [{
  assetName: 'fixture.webp',
  dataUri: DATA_URI,
  digest: digest(DATA_URI,),
},] as const;

/** Candidate L author roster. */
const CANDIDATE_PLAN = [
  { ordinal: 0, modelId: 'hf:Qwen/Qwen3.8-27B', priority: 0, },
  { ordinal: 1, modelId: 'minimax-m3', priority: 1, },
] as const satisfies readonly RealizationCandidatePlan[];

/** Three-family verifier roster. */
const VERIFIER_PLAN = [
  { ordinal: 0, modelId: 'hf:Qwen/Qwen3.8-27B', },
  { ordinal: 1, modelId: 'hf:zai-org/GLM-5.3-Flash', },
  { ordinal: 2, modelId: 'minimax-m3', },
] as const;

/** Candidate L deterministic fixture. */
type Fixture = {
  readonly shell: ReturnType<typeof buildImmutableShell>;
  readonly ledger: ReturnType<typeof buildRealizationObligationLedger>;
  readonly reviewPlan: ReviewUnitPlan;
  readonly manifest: ReviewUnitManifest;
};

/** Creates exact Candidate L graph fixture. */
function fixture(): Fixture {
  const shell = buildImmutableShell({ sourceText: SOURCE, archiveText: ARCHIVE, });
  const ledger = buildRealizationObligationLedger({
    sourceBody: shell.body,
    archiveBody: ARCHIVE,
    slots: shell.slots,
    shellDigest: shell.shellDigest,
  });
  const reviewPlan = createReviewUnitPlan({
    ledger,
    shell,
    sourceText: SOURCE,
    sourceBody: shell.body,
    archiveBody: ARCHIVE,
    ledgerDigest: digest(JSON.stringify(ledger,),),
  });
  const manifest = createReviewUnitManifest({
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
    authorMode: 'lean-realization',
  });
  return { shell, ledger, reviewPlan, manifest, };
}

/** Complete 27-value author response. */
function authorResponse({
  value,
  authorOrdinal,
}: {
  readonly value: Fixture;
  readonly authorOrdinal: number;
}): { readonly slots: Readonly<Record<string, string>> } {
  const frontMatterValues = [
    'Carena',
    'Flying Cat, Carena',
    'Shanghai',
    'In memory of our friend Carena and everything she brought us.',
  ];
  const frontMatter = Object.fromEntries(value.reviewPlan.frontMatterSubjects.map(function slot(subject, index,) {
    const text = frontMatterValues[index];
    if (text === undefined)
      throw new Error('lean realization front matter fixture value is absent');
    return [subject.targetSlotKey, text,];
  },),);
  const body = Object.fromEntries(value.shell.slots.map(function slot(item, index,) {
    return [item.key, `Author ${String(authorOrdinal,)} complete English paragraph ${String(index,)}.`,];
  },),);
  return { slots: { ...frontMatter, ...body, }, };
}

/** Wrong-meaning defect class wire index. */
const WRONG_MEANING_CLASS_INDEX = 0;

/** Grammar defect class wire index. */
const GRAMMAR_CLASS_INDEX = 7;

/** Paragraph-relation defect class wire index. */
const RELATION_CLASS_INDEX = 11;

/** Canonical overflow boundary plus one defect. */
const OVERFLOW_DEFECT_COUNT = 65;

/** Finds canonical JSON packet in one message sequence. */
function messagePacket(
  messages: readonly unknown[],
  marker: string,
): Readonly<Record<string, unknown>> {
  /** Unknown content parts copied from array-shaped messages. */
  const blocks: readonly unknown[] = messages.flatMap(function message(value,) {
    return isJsonRecord(value,) && Array.isArray(value.content,)
      ? value.content.map(function unknownPart(part,): unknown { return part; })
      : [];
  },);
  /** Exact marked text block after runtime narrowing. */
  const text = blocks.find(function marked(block,) {
    return isJsonRecord(block,)
      && (block.type === 'text')
      && ((typeof block.text) === 'string')
      && block.text.startsWith(marker,);
  },);
  if ((!isJsonRecord(text,)) || ((typeof text.text) !== 'string'))
    throw new Error('lean realization test packet is absent');
  /** Parsed packet before object narrowing. */
  const parsed: unknown = JSON.parse(text.text.slice(marker.length,));
  if (!isJsonRecord(parsed,))
    throw new Error('lean realization test packet is not an object');
  return parsed;
}

/** Finds canonical JSON packet in one request. */
function packet(request: ChatJsonRequest<unknown>, marker: string,): Readonly<Record<string, unknown>> {
  return messagePacket(request.messages, marker,);
}

/** Admits both deterministic Candidate L author responses. */
function admittedCandidates(value: Fixture,): readonly ReviewUnitCandidate[] {
  return CANDIDATE_PLAN.map(function candidate(plan,) {
    return admitLeanRealizationResponse({
      response: authorResponse({ value, authorOrdinal: plan.ordinal, }),
      shell: value.shell,
      manifest: value.manifest,
      reviewPlan: value.reviewPlan,
      plan,
      sourceText: SOURCE,
      archiveText: ARCHIVE,
      sourcePictures: [{ assetName: 'fixture.webp', },],
    });
  },);
}

/** Builds total completed author settlement for admitted fixtures. */
function settlement({
  value,
  candidates,
}: {
  readonly value: Fixture;
  readonly candidates: readonly ReviewUnitCandidate[];
}): ReviewUnitAuthorSettlement {
  return createReviewUnitAuthorSettlement({
    manifest: value.manifest,
    states: candidates.map(function state(candidate,) {
      return {
        record: {
          id: `lean-realization-author-${String(candidate.candidateOrdinal,)}`,
          modelId: candidate.modelId,
          manifestDigest: value.manifest.manifestDigest,
          basePromptDigest: digest(`base-${candidate.candidateId}`,),
          promptDigest: digest(`prompt-${candidate.candidateId}`,),
          startedAt: '2026-09-01T00:00:00.000Z',
          durationMs: 1,
          state: 'completed' as const,
        },
        candidate,
      };
    },),
  });
}

/** Builds exact target anchor inside one candidate slot. */
function targetAnchor({
  candidate,
  slotKey,
}: {
  readonly candidate: ReviewUnitCandidate;
  readonly slotKey: string;
}): ReviewUnitFinding['targetAnchors'][number] {
  const text = candidate.slots[slotKey];
  if (text === undefined)
    throw new Error('lean realization target-anchor slot is absent');
  const endOffset = Math.min(3, text.length,);
  return {
    slotKey,
    startOffset: 0,
    endOffset,
    digest: digest(text.slice(0, endOffset,),),
  };
}

/** Complete clean candidate-scoped response. */
function cleanResponse({
  value,
  candidate,
}: {
  readonly value: Fixture;
  readonly candidate: Readonly<Record<string, unknown>>;
}): ReviewUnitResponse {
  return {
    candidateId: String(candidate.candidateId,),
    candidateDigest: String(candidate.candidateDigest,),
    reviewPlanDigest: value.reviewPlan.reviewPlanDigest,
    deterministicProofDigest: String(candidate.deterministicProofDigest,),
    frontMatterStatuses: 'p'.repeat(value.reviewPlan.frontMatterSubjects.length,),
    clauseStatusesBySlot: value.reviewPlan.slotGroups.map(function status(group,) {
      return 'p'.repeat(group.clauseSubjectIndexes.length,);
    },),
    relationStatuses: 'p'.repeat(value.reviewPlan.relations.length,),
    slotLanguageStatuses: 'c'.repeat(27,),
    globalStatuses: 'c'.repeat(value.reviewPlan.globalCriteria.length,),
    overflow: false,
    findings: [],
  };
}

/** Admits one verifier response through complete Candidate L boundary. */
function admitBallot({
  value,
  candidates,
  response,
}: {
  readonly value: Fixture;
  readonly candidates: readonly ReviewUnitCandidate[];
  readonly response: ReviewUnitResponse;
}): ReturnType<typeof admitReviewUnitResponse> {
  return admitReviewUnitResponse({
    response,
    ledger: value.ledger,
    reviewPlan: value.reviewPlan,
    authorSettlement: settlement({ value, candidates, }),
    candidateOrdinal: 0,
    verifierOrdinal: 1,
    verifierModelId: 'hf:zai-org/GLM-5.3-Flash',
    manifest: value.manifest,
    expectedManifestDigest: value.manifest.manifestDigest,
    shell: value.shell,
    sourceText: SOURCE,
    archiveText: ARCHIVE,
    sourcePictures: [{ assetName: 'fixture.webp', },],
  });
}

/** Scripted provider controls. */
type ClientControls = {
  readonly duplicateAuthorOrdinal?: number;
  readonly failAuthorOrdinal?: number;
};

/** Scripted exact author and verifier client. */
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
      throw new Error('lean realization text route unused');
    },
    chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
      const schema = request.responseFormat?.json_schema.name;
      calls.push(`${request.modelId}:${String(schema,)}`,);
      /** Manifest author ordinal for author-shaped requests. */
      const authorOrdinal = value.manifest.candidatePlan.find(function model(plan,) {
        return plan.modelId === request.modelId;
      },)?.ordinal ?? (-1);
      if ((schema === 'lean_realization_slots') && (authorOrdinal === controls.failAuthorOrdinal)) {
        return {
          kind: 'schema-mismatch',
          rawText: '{}',
          detail: 'fixture author rejected',
          reason: 'caller-guard-rejected',
        };
      }
      const generated = schema === 'lean_realization_slots'
        ? authorResponse({ value, authorOrdinal, })
        : cleanResponse({
          value,
          candidate: packet(request as ChatJsonRequest<unknown>, 'LEAN_REALIZATION_VERIFIER_PACKET:\n',)
            .candidate as Readonly<Record<string, unknown>>,
        });
      if (!request.validate(generated,))
        throw new Error('lean realization scripted response failed guard');
      /** Canonical scripted response text. */
      const serialized = JSON.stringify(generated,);
      /** Optional duplicate-member negative control. */
      const rawText = (schema === 'lean_realization_slots')
        && (authorOrdinal === controls.duplicateAuthorOrdinal)
        ? `{"slots":{},${serialized.slice(1,)}`
        : serialized;
      return {
        kind: 'ok',
        value: generated as ValueT,
        rawText,
      };
    },
    quotas: async () => {
      await Promise.resolve();
      throw new Error('lean realization quota route unused');
    },
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
  const route = bindReviewUnitRouteClient({
    client: scripted,
    providerRouteDigest: value.manifest.providerRouteDigest,
  });
  return bindReviewUnitClient({
    manifest: value.manifest,
    outputDir,
    clients: {
      all: scripted,
      synthetic: scripted,
      hyper: route,
    },
  });
}

/** Snapshots every private artifact by relative path and digest. */
async function snapshot({
  root,
  relative = '',
}: {
  readonly root: string;
  readonly relative?: string;
}): Promise<Readonly<Record<string, string>>> {
  const path = relative === '' ? root : join(root, relative,);
  const entries = await readdir(path, { withFileTypes: true, });
  const rows = await Promise.all(entries.map(async function entry(value,) {
    const child = relative === '' ? value.name : join(relative, value.name,);
    if (value.isDirectory())
      return await snapshot({ root, relative: child, });
    return { [child]: digest(await readFile(join(root, child,), 'utf8',),), };
  },));
  return Object.fromEntries(rows.flatMap(function rowEntries(row,) {
    return Object.entries(row,);
  },),);
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

/** Client aborting after both lean authors enter transport. */
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
      throw new Error('lean author cancellation text route unused');
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
      throw new Error('lean author cancellation quota route unused');
    },
  };
}

/** Client aborting after all six Candidate L verifiers enter transport. */
function verifierCancellationClient({
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
      if (request.responseFormat?.json_schema.name === 'lean_realization_slots')
        return await author.chatJson(request,);
      arrivals.value += 1;
      if (arrivals.value === 6) {
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

await describe({
  name: 'Candidate L lean realization',
  children: [
    it({
      name: 'authors exactly twenty-seven mutable values without audit plan',
      fn: async () => {
        await Promise.resolve();
        const value = fixture();
        expect(value.shell.slots.length).toBe(23,);
        expect(value.reviewPlan.frontMatterSubjects.length).toBe(4,);
        expect(value.manifest.version).toBe(2,);
        expect(value.manifest.frontMatterAuthorityDigest).toBe(LEAN_FRONT_MATTER_AUTHORITY_DIGEST,);
        expect(LEAN_FRONT_MATTER_CONTRACTS.map(function identity(contract,) {
          return {
            path: contract.path,
            kind: contract.kind,
            authority: contract.authority,
            grammar: contract.grammar,
          };
        },)).toEqual([
          {
            path: ['name',],
            kind: 'name',
            authority: 'identity',
            grammar: {
              nonempty: true,
              singleLine: true,
              equalsAliasMember: true,
            },
          },
          {
            path: ['info', 'alias',],
            kind: 'alias',
            authority: 'identity',
            grammar: {
              nonempty: true,
              singleLine: true,
              sourceDelimiter: ',',
              targetDelimiter: ', ',
              memberCount: 'source-exact',
              memberOrder: 'source-exact',
              protectedCasedMember: 'exact-at-position',
            },
          },
          {
            path: ['info', 'location',],
            kind: 'location',
            authority: 'location',
            grammar: {
              nonempty: true,
              singleLine: true,
            },
          },
          {
            path: ['desc',],
            kind: 'description',
            authority: 'description',
            grammar: {
              nonempty: true,
              singleLine: true,
            },
          },
        ],);
        expect(value.manifest.payloadCountCeiling).toBe(MAX_LEAN_REALIZATION_PAYLOAD_COUNT,);
        const keys = leanRealizationSlotKeys({ shell: value.shell, reviewPlan: value.reviewPlan, });
        expect(keys.length).toBe(27,);
        const response = authorResponse({ value, authorOrdinal: 0, });
        expect(leanRealizationGuard({ shell: value.shell, reviewPlan: value.reviewPlan, })(response,)).toBe(true,);
        const messages = leanRealizationAuthorMessages({
          plan: CANDIDATE_PLAN[0],
          manifest: value.manifest,
          shell: value.shell,
          reviewPlan: value.reviewPlan,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
        });
        const serialized = JSON.stringify(messages,);
        expect(serialized.includes('reviewPlan')).toBe(false,);
        expect(serialized.includes('findingRules')).toBe(false,);
        expect(serialized.includes('Statuses')).toBe(false,);
        const formatText = JSON.stringify(leanRealizationResponseFormat({
          shell: value.shell,
          reviewPlan: value.reviewPlan,
        }),);
        expect(keys.every(function represented(key,) {
          return formatText.includes(JSON.stringify(key,),);
        },)).toBe(true,);
      },
    }),
    it({
      name: 'compiles identity-bound front matter and refuses alias drift',
      fn: async () => {
        await Promise.resolve();
        const value = fixture();
        const response = authorResponse({ value, authorOrdinal: 0, });
        const candidate = admitLeanRealizationResponse({
          response,
          shell: value.shell,
          manifest: value.manifest,
          reviewPlan: value.reviewPlan,
          plan: CANDIDATE_PLAN[0],
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [{ assetName: 'fixture.webp', },],
        });
        expect(candidate.mutableSlotKeys?.length).toBe(27,);
        expect(candidate.document.includes('alias: Flying Cat, Carena',)).toBe(true,);
        expect(candidate.document.includes('location: Shanghai',)).toBe(true,);
        expect(() => assertLeanRealizationBinding({
          candidate,
          manifest: value.manifest,
          reviewPlan: value.reviewPlan,
          shell: value.shell,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [{ assetName: 'fixture.webp', },],
        })).not.toThrow();
        const nameKey = value.reviewPlan.frontMatterSubjects[0]?.targetSlotKey;
        const aliasKey = value.reviewPlan.frontMatterSubjects[1]?.targetSlotKey;
        if ((nameKey === undefined) || (aliasKey === undefined))
          throw new Error('lean realization identity fixture is absent');
        expect(() => admitLeanRealizationResponse({
          response: { slots: { ...response.slots, [aliasKey]: 'Flying Cat, Other', }, },
          shell: value.shell,
          manifest: value.manifest,
          reviewPlan: value.reviewPlan,
          plan: CANDIDATE_PLAN[0],
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [{ assetName: 'fixture.webp', },],
        })).toThrow();
        for (const slots of [
          { ...response.slots, [aliasKey]: 'Carena', },
          { ...response.slots, [aliasKey]: 'Carena, Flying Cat', },
          { ...response.slots, [nameKey]: 'Someone Else', },
        ]) {
          expect(() => admitLeanRealizationResponse({
            response: { slots, },
            shell: value.shell,
            manifest: value.manifest,
            reviewPlan: value.reviewPlan,
            plan: CANDIDATE_PLAN[0],
            sourceText: SOURCE,
            archiveText: ARCHIVE,
            sourcePictures: [{ assetName: 'fixture.webp', },],
          })).toThrow();
        }
      },
    }),
    it({
      name: 'projects candidate front matter without archive target fields',
      fn: async () => {
        await Promise.resolve();
        const value = fixture();
        const [candidate,] = admittedCandidates(value,);
        if (candidate === undefined)
          throw new Error('lean realization projected candidate is absent');
        const messages = leanRealizationVerifierMessages({
          manifest: value.manifest,
          shell: value.shell,
          reviewPlan: value.reviewPlan,
          candidate,
          authorSettlementDigest: digest('settlement',),
          verifierPlanDigest: digest('verifier-plan',),
          defectClasses: [],
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          media: MEDIA,
        });
        const serialized = JSON.stringify(messages,);
        const verifierPacket = messagePacket(
          messages,
          'LEAN_REALIZATION_VERIFIER_PACKET:\n',
        );
        const projectedPlan = verifierPacket.reviewPlan;
        const shellEvidence = verifierPacket.shell;
        if ((!isJsonRecord(projectedPlan,))
          || (!Array.isArray(projectedPlan.frontMatterSubjects,))
          || (!isJsonRecord(shellEvidence,))
          || (!Array.isArray(shellEvidence.frontMatterSlots,)))
          throw new Error('lean realization source projection shape differs');
        const expectedKeys = [
          'authority',
          'grammar',
          'kind',
          'path',
          'sourceDigest',
          'sourceText',
          'subjectIndex',
          'targetSlotKey',
        ];
        for (const subjects of [
          projectedPlan.frontMatterSubjects,
          shellEvidence.frontMatterSlots,
        ]) {
          expect(subjects.every(function exact(subject,) {
            return isJsonRecord(subject,)
              && (JSON.stringify(Object.keys(subject,).toSorted(),) === JSON.stringify(expectedKeys,));
          },)).toBe(true,);
        }
        const [unprojected,] = value.reviewPlan.frontMatterSubjects;
        expect(unprojected === undefined ? false : Object.keys(unprojected,).includes('targetText',)).toBe(true,);
        expect(unprojected === undefined ? false : Object.keys(unprojected,).includes('targetDigest',)).toBe(true,);
        expect(Object.keys(projectedPlan,).includes('reviewPlanDigest',)).toBe(false,);
        const projected = leanVerifierEvidence({
          reviewPlan: value.reviewPlan,
          candidate,
        });
        const candidateSubjectKeys = [
          ...expectedKeys,
          'aliasMemberPairs',
          'candidateAliasMembers',
          'candidateDigest',
          'candidateText',
          'protectedCasedMembers',
          'sourceAliasMembers',
        ].toSorted();
        expect(projected.candidateFrontMatterSubjects.every(function exact(subject,) {
          return JSON.stringify(Object.keys(subject,).toSorted(),)
            === JSON.stringify(candidateSubjectKeys,);
        },)).toBe(true,);
        expect(projected.candidateFrontMatterSubjects.some(function name(subject,) {
          return (subject.candidateText === 'Carena') && (subject.authority === 'identity');
        },)).toBe(true,);
        expect(projected.candidateFrontMatterSubjects.some(function location(subject,) {
          return (subject.candidateText === 'Shanghai') && (subject.authority === 'location');
        },)).toBe(true,);
        const aliasSubject = projected.candidateFrontMatterSubjects.find(function alias(subject,) {
          return subject.kind === 'alias';
        },);
        expect(aliasSubject?.sourceAliasMembers).toEqual(['飞猫', 'Carena',],);
        expect(aliasSubject?.candidateAliasMembers).toEqual(['Flying Cat', 'Carena',],);
        expect(aliasSubject?.aliasMemberPairs).toEqual([
          {
            index: 0,
            sourceMember: '飞猫',
            candidateMember: 'Flying Cat',
            protectedCased: false,
          },
          {
            index: 1,
            sourceMember: 'Carena',
            candidateMember: 'Carena',
            protectedCased: true,
          },
        ],);
        expect(aliasSubject?.protectedCasedMembers).toEqual(['Carena',],);
        expect(aliasSubject?.grammar).toEqual({
          nonempty: true,
          singleLine: true,
          sourceDelimiter: ',',
          targetDelimiter: ', ',
          memberCount: 'source-exact',
          memberOrder: 'source-exact',
          protectedCasedMember: 'exact-at-position',
        },);
        const expectedSourceReviewPlanDigest = digest(JSON.stringify(projected.sourceReviewPlan,),);
        expect(projected.sourceReviewPlanDigest).toBe(expectedSourceReviewPlanDigest,);
        expect(projected.admissionReviewPlanDigest).toBe(value.reviewPlan.reviewPlanDigest,);
        expect(verifierPacket.sourceReviewPlanDigest).toBe(projected.sourceReviewPlanDigest,);
        expect(verifierPacket.admissionReviewPlanDigest).toBe(projected.admissionReviewPlanDigest,);
        expect(
          serialized.includes(String(value.manifest.frontMatterAuthorityDigest,),),
        ).toBe(true,);
      },
    }),
    it({
      name: 'maps front-matter and body language defects to exact mutable indexes',
      fn: async () => {
        await Promise.resolve();
        const value = fixture();
        const candidates = admittedCandidates(value,);
        const [candidate,] = candidates;
        if ((candidate === undefined) || (candidate.mutableSlotKeys === undefined))
          throw new Error('lean realization language candidate is absent');
        for (const subjectIndex of [0, 3, 4, 26,]) {
          const slotKey = candidate.mutableSlotKeys[subjectIndex];
          if (slotKey === undefined)
            throw new Error('lean realization language slot is absent');
          const clean = cleanResponse({ value, candidate, });
          const response: ReviewUnitResponse = {
            ...clean,
            slotLanguageStatuses: `${'c'.repeat(subjectIndex,)}d${'c'.repeat(
              candidate.mutableSlotKeys.length - subjectIndex - 1,
            )}`,
            findings: [{
              scope: 'sl',
              subjectIndex,
              defectClassIndex: GRAMMAR_CLASS_INDEX,
              sourceEvidenceIndexes: [],
              imageEvidenceIndexes: [],
              targetAnchors: [targetAnchor({ candidate, slotKey, }),],
            },],
          };
          const ballot = admitBallot({ value, candidates, response, });
          expect(ballot.statusRows.some(function exact(row,) {
            return (row.scope === 'sl') && (row.subjectIndex === subjectIndex) && (row.status === 'd');
          },)).toBe(true,);
        }
      },
    }),
    it({
      name: 'retains canonical first sixty-four defects across Candidate L scopes',
      fn: async () => {
        await Promise.resolve();
        const value = fixture();
        const candidates = admittedCandidates(value,);
        const [candidate,] = candidates;
        if ((candidate === undefined) || (candidate.mutableSlotKeys === undefined))
          throw new Error('lean realization overflow candidate is absent');
        const relationDefectCount = OVERFLOW_DEFECT_COUNT
          - value.reviewPlan.frontMatterSubjects.length
          - value.reviewPlan.clauses.length
          - candidate.mutableSlotKeys.length
          - value.reviewPlan.globalCriteria.length;
        if ((relationDefectCount < 1) || (relationDefectCount > value.reviewPlan.relations.length))
          throw new Error('lean realization overflow relation count differs');
        const frontMatterFindings: readonly ReviewUnitFinding[] = value.reviewPlan.frontMatterSubjects
          .map(function finding(subject,) {
          return {
            scope: 'fm',
            subjectIndex: subject.subjectIndex,
            defectClassIndex: WRONG_MEANING_CLASS_INDEX,
            sourceEvidenceIndexes: [],
            imageEvidenceIndexes: [],
            targetAnchors: [targetAnchor({ candidate, slotKey: subject.targetSlotKey, }),],
          };
        },);
        const clauseFindings: readonly ReviewUnitFinding[] = value.reviewPlan.clauses
          .map(function finding(subject,) {
          const [slotKey,] = subject.allowedTargetSlotKeys;
          if (slotKey === undefined)
            throw new Error('lean realization clause target is absent');
          return {
            scope: 'c',
            subjectIndex: subject.subjectIndex,
            defectClassIndex: WRONG_MEANING_CLASS_INDEX,
            sourceEvidenceIndexes: subject.sourceEvidenceIndexes,
            imageEvidenceIndexes: [],
            targetAnchors: [targetAnchor({ candidate, slotKey, }),],
          };
        },);
        const relationFindings: readonly ReviewUnitFinding[] = value.reviewPlan.relations
          .slice(0, relationDefectCount,)
          .map(function finding(subject,) {
          const [slotKey,] = subject.allowedTargetSlotKeys;
          if (slotKey === undefined)
            throw new Error('lean realization relation target is absent');
          return {
            scope: 'r',
            subjectIndex: subject.subjectIndex,
            defectClassIndex: RELATION_CLASS_INDEX,
            sourceEvidenceIndexes: subject.sourceEvidenceIndexes,
            imageEvidenceIndexes: [],
            targetAnchors: [targetAnchor({ candidate, slotKey, }),],
          };
        },);
        const languageFindings: readonly ReviewUnitFinding[] = candidate.mutableSlotKeys
          .map(function finding(slotKey, subjectIndex,) {
          return {
            scope: 'sl',
            subjectIndex,
            defectClassIndex: GRAMMAR_CLASS_INDEX,
            sourceEvidenceIndexes: [],
            imageEvidenceIndexes: [],
            targetAnchors: [targetAnchor({ candidate, slotKey, }),],
          };
        },);
        const globalFindings: readonly ReviewUnitFinding[] = value.reviewPlan.globalCriteria
          .slice(0, -1,)
          .map(function finding(_criterion, subjectIndex,) {
          const [slotKey,] = candidate.mutableSlotKeys ?? [];
          if (slotKey === undefined)
            throw new Error('lean realization global target is absent');
          return {
            scope: 'g',
            subjectIndex,
            defectClassIndex: GRAMMAR_CLASS_INDEX,
            sourceEvidenceIndexes: [],
            imageEvidenceIndexes: [],
            targetAnchors: [targetAnchor({ candidate, slotKey, }),],
          };
        },);
        const findings = [
          ...frontMatterFindings,
          ...clauseFindings,
          ...relationFindings,
          ...languageFindings,
          ...globalFindings,
        ];
        expect(findings.length).toBe(64,);
        const response: ReviewUnitResponse = {
          ...cleanResponse({ value, candidate, }),
          frontMatterStatuses: 'd'.repeat(value.reviewPlan.frontMatterSubjects.length,),
          clauseStatusesBySlot: value.reviewPlan.slotGroups.map(function status(group,) {
            return 'd'.repeat(group.clauseSubjectIndexes.length,);
          },),
          relationStatuses: `${'d'.repeat(relationDefectCount,)}${'p'.repeat(
            value.reviewPlan.relations.length - relationDefectCount,
          )}`,
          slotLanguageStatuses: 'd'.repeat(candidate.mutableSlotKeys.length,),
          globalStatuses: 'd'.repeat(value.reviewPlan.globalCriteria.length,),
          overflow: true,
          findings,
        };
        expect(() => admitBallot({ value, candidates, response, })).not.toThrow();
        const [first, second,] = findings;
        if ((first === undefined) || (second === undefined))
          throw new Error('lean realization overflow prefix is absent');
        expect(() => admitBallot({
          value,
          candidates,
          response: {
            ...response,
            findings: [second, first, ...findings.slice(2,),],
          },
        })).toThrow();
      },
    }),
    it({
      name: 'runs eight static nodes and restarts without provider calls',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const value = fixture();
        const calls: string[] = [];
        const scripted = client({ value, calls, });
        const result = await runReviewUnitRuntime({
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
        });
        expect(calls.length).toBe(8,);
        expect(result.completedNodeCount).toBe(8,);
        expect(result.selection?.productionEligible).toBe(true,);
        expect(result.selection?.candidate.candidateOrdinal).toBe(0,);
        expect((await readdir(join(directory.path, 'prompt-claims', value.manifest.manifestDigest,))).length).toBe(8,);
        const beforeRestart = await snapshot({ root: directory.path, });
        const restartCalls: string[] = [];
        const restartClient = client({ value, calls: restartCalls, });
        const restarted = await runReviewUnitRuntime({
          outputDir: directory.path,
          boundClient: boundClient({ value, outputDir: directory.path, scripted: restartClient, }),
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
        });
        expect(restartCalls.length).toBe(0,);
        expect(restarted).toEqual(result,);
        expect(await snapshot({ root: directory.path, })).toEqual(beforeRestart,);
      },
    }),
    it({
      name: 'skips exactly three verifiers after unusable lean author',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const value = fixture();
        const calls: string[] = [];
        const scripted = client({
          value,
          calls,
          controls: { failAuthorOrdinal: 1, },
        });
        const result = await runReviewUnitRuntime({
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
        });
        expect(calls.length).toBe(5,);
        expect(result.spentUnusableNodeCount).toBe(1,);
        expect(result.skippedNodeCount).toBe(3,);
        expect(result.selection?.candidate.candidateOrdinal).toBe(0,);
        expect(result.selection?.productionEligible).toBe(true,);
      },
    }),
    it({
      name: 'spends duplicate raw author response without dependent dispatch',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const value = fixture();
        const calls: string[] = [];
        const scripted = client({
          value,
          calls,
          controls: { duplicateAuthorOrdinal: 1, },
        });
        const result = await runReviewUnitRuntime({
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
        });
        expect(calls.length).toBe(5,);
        expect(result.spentUnusableNodeCount).toBe(1,);
        expect(result.skippedNodeCount).toBe(3,);
        const restartCalls: string[] = [];
        const restarted = await runReviewUnitRuntime({
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
        });
        expect(restartCalls.length).toBe(0,);
        expect(restarted).toEqual(result,);
      },
    }),
    it({
      name: 'settles both lean authors before forwarding exact cancellation',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const value = fixture();
        const controller = new AbortController();
        const reason = new Error('exact in-flight Candidate L author cancellation');
        const settled = { value: 0, };
        const scripted = authorCancellationClient({ controller, reason, settled, });
        await expect(runReviewUnitRuntime({
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
          signal: controller.signal,
        })).rejects.toBe(reason,);
        expect(settled.value).toBe(2,);
      },
    }),
    it({
      name: 'forwards exact cancellation between Candidate L waves',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const value = fixture();
        const calls: string[] = [];
        const scripted = client({ value, calls, });
        const reason = new Error('exact between-wave Candidate L cancellation');
        await expect(runReviewUnitRuntime({
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
          signal: artifactAbortSignal({
            artifactPath: join(directory.path, 'review-unit-author-settlement.json',),
            reason,
          }),
        })).rejects.toBe(reason,);
        expect(calls.length).toBe(2,);
      },
    }),
    it({
      name: 'settles six lean verifiers before forwarding exact cancellation',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const value = fixture();
        const controller = new AbortController();
        const reason = new Error('exact in-flight Candidate L verifier cancellation');
        const settled = { value: 0, };
        const scripted = verifierCancellationClient({
          value,
          controller,
          reason,
          settled,
        });
        await expect(runReviewUnitRuntime({
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
          signal: controller.signal,
        })).rejects.toBe(reason,);
        expect(settled.value).toBe(6,);
      },
    }),
    it({
      name: 'forwards exact pre-author cancellation without provider calls',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const value = fixture();
        const calls: string[] = [];
        const scripted = client({ value, calls, });
        const controller = new AbortController();
        const reason = new Error('exact Candidate L cancellation');
        controller.abort(reason,);
        await expect(runReviewUnitRuntime({
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
          signal: controller.signal,
        })).rejects.toBe(reason,);
        expect(calls.length).toBe(0,);
      },
    }),
    it({
      name: 'expands verifier language schema over all mutable values',
      fn: async () => {
        await Promise.resolve();
        const value = fixture();
        const candidate: ReviewUnitCandidate = admitLeanRealizationResponse({
          response: authorResponse({ value, authorOrdinal: 0, }),
          shell: value.shell,
          manifest: value.manifest,
          reviewPlan: value.reviewPlan,
          plan: CANDIDATE_PLAN[0],
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [{ assetName: 'fixture.webp', },],
        });
        const schema = reviewUnitResponseFormat({
          reviewPlan: value.reviewPlan,
          candidate,
          pictureCount: 1,
        });
        const schemaText = JSON.stringify(schema,);
        expect(schemaText.includes('"minLength":27',)).toBe(true,);
        expect(schemaText.includes('"maxLength":27',)).toBe(true,);
      },
    }),
  ],
});
