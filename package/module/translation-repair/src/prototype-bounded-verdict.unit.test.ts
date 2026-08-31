import { createHash, } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
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
  admitBoundedAuthorResponse,
  admitBoundedVerifierResponse,
  bindBoundedClient,
  BOUNDED_VERDICT_FINDING_CAP,
  boundedVerifierResponseGuard,
  createBoundedVerdictManifest,
  CONDITIONAL_DEFECT_CLASSES,
  maximalBoundedVerifierResponse,
  measureBoundedVerifierEnvelope,
  REALIZATION_GLOBAL_CRITERIA,
  runBoundedRuntime,
  selectBoundedCandidate,
  type BoundedAuthorSettlement,
  type BoundedCandidate,
  type BoundedCandidateVerification,
  type BoundedFinding,
  type BoundedSelection,
  type BoundedVerifierBallot,
  type BoundedVerifierResponse,
  type BoundedVerdictManifest,
} from '../dist/final/node/prototype-bounded-verdict.mjs';
import {
  BOUNDED_LIFECYCLE_ARCHIVE,
  BOUNDED_LIFECYCLE_MEDIA,
  BOUNDED_LIFECYCLE_SOURCE,
  boundedLifecycleResponseForRequest,
  createBoundedAuthorSettlement,
  createBoundedLifecycleFixture,
} from '../dist/final/node/prototype-bounded-verdict-test-support.mjs';
import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  isJsonRecord,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/** Simulated transport outcome whose transmission cannot be disproved. */
class IndeterminateTransmission extends Error {}

/** Disposable private runtime fixture root. */
type TemporaryDirectory = AsyncDisposable & { readonly path: string; };

/** Creates disposable runtime root. */
async function temporaryDirectory(): Promise<TemporaryDirectory> {
  const path = await mkdtemp(join(tmpdir(), 'bounded-verdict-',),);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

/** SHA-256 over exact UTF-16-selected JavaScript string bytes. */
function digest({ text, }: { readonly text: string; }): string {
  return createHash('sha256',).update(text,).digest('hex',);
}

/** Builds exact half-open anchor inside candidate slot. */
function anchor({
  candidate,
  startOffset,
  endOffset,
}: {
  readonly candidate: BoundedCandidate;
  readonly startOffset: number;
  readonly endOffset: number;
}): BoundedFinding['targetAnchors'][number] {
  const slotKey = Object.keys(candidate.slots,)[0];
  if (slotKey === undefined)
    throw new Error('bounded test candidate slot is absent');
  const text = candidate.slots[slotKey];
  if (text === undefined)
    throw new Error('bounded test candidate text is absent');
  return {
    slotKey,
    startOffset,
    endOffset,
    digest: digest({ text: text.slice(startOffset, endOffset,), }),
  };
}

/** Builds runtime-bound candidate and complete settlement fixture. */
function settledFixture(): {
  readonly manifest: BoundedVerdictManifest;
  readonly ledger: ReturnType<typeof createBoundedLifecycleFixture>['ledger'];
  readonly shell: ReturnType<typeof createBoundedLifecycleFixture>['shell'];
  readonly candidates: readonly BoundedCandidate[];
  readonly settlement: BoundedAuthorSettlement;
} {
  const { manifest, ledger, shell, } = createBoundedLifecycleFixture();
  const sourcePictures = BOUNDED_LIFECYCLE_MEDIA.map(function picture(item,) {
    return { assetName: item.assetName, };
  },);
  const candidates = manifest.candidatePlan.map(function candidate(plan,) {
    return admitBoundedAuthorResponse({
      response: {
        slots: Object.fromEntries(shell.slots.map(function slot(item, index,) {
          return [
            item.key,
            `Author ${String(plan.ordinal,)} complete English slot ${String(index,)}.`,
          ];
        },),),
      },
      shell,
      manifest,
      plan,
      sourceText: BOUNDED_LIFECYCLE_SOURCE,
      archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
      sourcePictures,
    },);
  },);
  const settlement = createBoundedAuthorSettlement({
    manifest,
    states: candidates.map(function state(candidate,) {
      return {
        record: {
          id: `bounded-author-${String(candidate.candidateOrdinal,)}`,
          modelId: candidate.modelId,
          manifestDigest: manifest.manifestDigest,
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
  return { manifest, ledger, shell, candidates, settlement, };
}

/** Builds complete checked-clean response for every candidate. */
function cleanResponse({
  fixture,
}: {
  readonly fixture: ReturnType<typeof settledFixture>;
}): BoundedVerifierResponse {
  return {
    candidates: fixture.candidates.map(function row(candidate,) {
      return {
        candidateId: candidate.candidateId,
        candidateDigest: candidate.candidateDigest,
        obligationStatuses: fixture.ledger.obligations.map(function preserved() {
          return 'p' as const;
        },),
        globalStatuses: REALIZATION_GLOBAL_CRITERIA.map(function clean() {
          return 'c' as const;
        },),
        overflow: false,
        findings: [],
      };
    },),
  };
}

/** Replaces one candidate row without changing complete candidate set. */
function replaceRow({
  response,
  candidateId,
  row,
}: {
  readonly response: BoundedVerifierResponse;
  readonly candidateId: string;
  readonly row: BoundedCandidateVerification;
}): BoundedVerifierResponse {
  return {
    candidates: response.candidates.map(function replace(value,) {
      return value.candidateId === candidateId ? row : value;
    },),
  };
}

/** Admits response under one planned verifier identity. */
function ballot({
  fixture,
  response,
  verifierOrdinal = 0,
}: {
  readonly fixture: ReturnType<typeof settledFixture>;
  readonly response: BoundedVerifierResponse;
  readonly verifierOrdinal?: number;
}): BoundedVerifierBallot {
  const verifierModelId = fixture.manifest.verifierModelIds[verifierOrdinal];
  if (verifierModelId === undefined)
    throw new Error('bounded test verifier identity is absent');
  return admitBoundedVerifierResponse({
    response,
    ledger: fixture.ledger,
    authorSettlement: fixture.settlement,
    verifierModelId,
    manifest: fixture.manifest,
    expectedManifestDigest: fixture.manifest.manifestDigest,
    shell: fixture.shell,
    sourceText: BOUNDED_LIFECYCLE_SOURCE,
    archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
    sourcePictures: BOUNDED_LIFECYCLE_MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, };
    },),
  },);
}

/** Selects from fixture ballots through full revalidation boundary. */
function selection({
  fixture,
  ballots,
}: {
  readonly fixture: ReturnType<typeof settledFixture>;
  readonly ballots: readonly BoundedVerifierBallot[];
}): BoundedSelection {
  return selectBoundedCandidate({
    authorSettlement: fixture.settlement,
    ballots,
    manifest: fixture.manifest,
    expectedManifestDigest: fixture.manifest.manifestDigest,
    ledger: fixture.ledger,
    shell: fixture.shell,
    sourceText: BOUNDED_LIFECYCLE_SOURCE,
    archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
    sourcePictures: BOUNDED_LIFECYCLE_MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, };
    },),
  },);
}

/** Finds canonical defect class index or refuses stale vocabulary. */
function defectClassIndex({ name, }: {
  readonly name: typeof CONDITIONAL_DEFECT_CLASSES[number];
}): number {
  const index = CONDITIONAL_DEFECT_CLASSES.indexOf(name,);
  if (index < 0)
    throw new Error('bounded test defect class is absent');
  return index;
}

/** Builds scriptable client with concurrency and prompt evidence. */
function scriptedClient({
  responseFor,
  calls,
  prompts,
  peak,
}: {
  readonly responseFor: ReturnType<typeof boundedLifecycleResponseForRequest>;
  readonly calls: string[];
  readonly prompts: string[];
  readonly peak: { value: number; inFlight: number; };
}): SyntheticClient {
  return {
    chatText: async () => {
      await Promise.resolve();
      throw new Error('bounded runtime chatText unused');
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      peak.inFlight += 1;
      peak.value = Math.max(peak.value, peak.inFlight,);
      const schemaName = request.responseFormat?.json_schema.name ?? '';
      calls.push(schemaName,);
      prompts.push(JSON.stringify(request.messages,),);
      const requiredArrivals = schemaName === 'immutable_shell_slots' ? 4 : 3;
      while (calls.filter(function same(value,) {
        return value === schemaName;
      },).length < requiredArrivals)
        await wait(1,);
      const value = responseFor(request,);
      peak.inFlight -= 1;
      if (!request.validate(value,))
        throw new Error('bounded scripted response failed request guard');
      return {
        kind: 'ok',
        value,
        rawText: JSON.stringify(value,),
      };
    },
    quotas: async () => {
      await Promise.resolve();
      throw new Error('bounded runtime quotas unused');
    },
  };
}

/** Client that proves excluded provider route is masked. */
function refusingClient(): SyntheticClient {
  return {
    chatText: async () => {
      await Promise.resolve();
      throw new Error('excluded bounded text client called');
    },
    chatJson: async () => {
      await Promise.resolve();
      throw new Error('excluded bounded json client called');
    },
    quotas: async () => {
      await Promise.resolve();
      throw new Error('excluded bounded quota client called');
    },
  };
}

await describe({
  name: 'Candidate H bounded verdict',
  children: [
    it({
      name: 'ACCEPTS complete clean matrix and exact candidate set',
      fn: async () => {
        const fixture = settledFixture();
        const response = cleanResponse({ fixture, });
        expect(boundedVerifierResponseGuard({
          ledger: fixture.ledger,
          candidates: fixture.candidates,
        },)(response,),).toBe(true,);
        expect(ballot({ fixture, response, }).response,).toEqual(response,);
      },
    },),

    it({
      name: 'REFUSES hidden parsed members at every verifier object boundary',
      fn: async () => {
        const fixture = settledFixture();
        const clean = cleanResponse({ fixture, });
        const guard = boundedVerifierResponseGuard({
          ledger: fixture.ledger,
          candidates: fixture.candidates,
        },);
        expect(guard({ ...clean, priority: 0, },),).toBe(false,);
        const first = clean.candidates[0];
        const candidate = fixture.candidates[0];
        if ((first === undefined) || (candidate === undefined))
          throw new Error('bounded hidden-member fixture is absent');
        const hiddenRow = { ...first, priority: 0, };
        expect(guard(replaceRow({
          response: clean,
          candidateId: first.candidateId,
          row: hiddenRow,
        },),),).toBe(false,);
        const target = anchor({ candidate, startOffset: 0, endOffset: 3, });
        const defectRow = {
          ...first,
          globalStatuses: first.globalStatuses.map(function defect(code, index,) {
            return index === 0 ? 'd' : code;
          },),
          findings: [{
            scope: 'g' as const,
            manifestIndex: 0,
            defectClassIndex: defectClassIndex({ name: 'grammar-usage', }),
            targetAnchors: [target,],
            priority: 0,
          },],
        };
        expect(guard(replaceRow({
          response: clean,
          candidateId: first.candidateId,
          row: defectRow,
        },),),).toBe(false,);
        const hiddenAnchor = { ...target, priority: 0, };
        const hiddenAnchorRow = {
          ...defectRow,
          findings: [{
            scope: 'g' as const,
            manifestIndex: 0,
            defectClassIndex: defectClassIndex({ name: 'grammar-usage', }),
            targetAnchors: [hiddenAnchor,],
          },],
        };
        expect(guard(replaceRow({
          response: clean,
          candidateId: first.candidateId,
          row: hiddenAnchorRow,
        },),),).toBe(false,);
      },
    },),

    it({
      name: 'REFUSES incomplete arrays and absent finding for defect status',
      fn: async () => {
        const fixture = settledFixture();
        const clean = cleanResponse({ fixture, });
        const first = clean.candidates[0];
        if (first === undefined)
          throw new Error('bounded test row is absent');
        const incomplete = replaceRow({
          response: clean,
          candidateId: first.candidateId,
          row: {
            ...first,
            obligationStatuses: first.obligationStatuses.slice(1,),
          },
        },);
        expect(boundedVerifierResponseGuard({
          ledger: fixture.ledger,
          candidates: fixture.candidates,
        },)(incomplete,),).toBe(false,);
        const missingFinding = replaceRow({
          response: clean,
          candidateId: first.candidateId,
          row: {
            ...first,
            obligationStatuses: first.obligationStatuses.map(function status(
              code,
              index,
            ) { return index === 0 ? 'd' : code; }),
          },
        },);
        expect(() => ballot({ fixture, response: missingFinding, }),).toThrow();
      },
    },),

    it({
      name: 'ACCEPTS source-located omission without target anchor',
      fn: async () => {
        const fixture = settledFixture();
        const clean = cleanResponse({ fixture, });
        const first = clean.candidates[0];
        if (first === undefined)
          throw new Error('bounded omission row is absent');
        const response = replaceRow({
          response: clean,
          candidateId: first.candidateId,
          row: {
            ...first,
            obligationStatuses: first.obligationStatuses.map(function defect(
              code,
              index,
            ) { return index === 0 ? 'd' : code; }),
            findings: [{
              scope: 'o',
              manifestIndex: 0,
              defectClassIndex: defectClassIndex({ name: 'omission', }),
              targetAnchors: [],
            },],
          },
        },);
        expect(ballot({ fixture, response, }).response,).toEqual(response,);
        expect(fixture.ledger.obligations[0]?.sourceSpans.length,).toBeGreaterThan(0,);
        const globalOmission = replaceRow({
          response: clean,
          candidateId: first.candidateId,
          row: {
            ...first,
            globalStatuses: first.globalStatuses.map(function defect(code, index,) {
              return index === 0 ? 'd' : code;
            },),
            findings: [{
              scope: 'g',
              manifestIndex: 0,
              defectClassIndex: defectClassIndex({ name: 'omission', }),
              targetAnchors: [],
            },],
          },
        },);
        expect(() => ballot({ fixture, response: globalOmission, }),).toThrow();
      },
    },),

    it({
      name: 'ACCEPTS three disjoint anchors and REFUSES overlap',
      fn: async () => {
        const fixture = settledFixture();
        const clean = cleanResponse({ fixture, });
        const first = clean.candidates[0];
        const candidate = fixture.candidates[0];
        if ((first === undefined) || (candidate === undefined))
          throw new Error('bounded anchor fixture is absent');
        const anchors = [
          anchor({ candidate, startOffset: 0, endOffset: 3, }),
          anchor({ candidate, startOffset: 4, endOffset: 7, }),
          anchor({ candidate, startOffset: 8, endOffset: 11, }),
        ];
        const row: BoundedCandidateVerification = {
          ...first,
          globalStatuses: first.globalStatuses.map(function defect(code, index,) {
            return index === 0 ? 'd' : code;
          },),
          findings: [{
            scope: 'g',
            manifestIndex: 0,
            defectClassIndex: defectClassIndex({ name: 'grammar-usage', }),
            targetAnchors: anchors,
          },],
        };
        expect(ballot({
          fixture,
          response: replaceRow({
            response: clean,
            candidateId: first.candidateId,
            row,
          },),
        }).response.candidates,).toHaveLength(fixture.candidates.length,);
        const firstFinding = row.findings[0];
        const firstAnchor = anchors[0];
        if ((firstFinding === undefined) || (firstAnchor === undefined))
          throw new Error('bounded overlap fixture is absent');
        const overlapping: BoundedCandidateVerification = {
          ...row,
          findings: [{
            ...firstFinding,
            targetAnchors: [
              firstAnchor,
              anchor({ candidate, startOffset: 2, endOffset: 6, }),
            ],
          },],
        };
        expect(() => ballot({
          fixture,
          response: replaceRow({
            response: clean,
            candidateId: first.candidateId,
            row: overlapping,
          },),
        }),).toThrow();
      },
    },),

    it({
      name: 'REQUIRES exact overflow algebra and bounded distinct certificates',
      fn: async () => {
        const fixture = settledFixture();
        const clean = cleanResponse({ fixture, });
        const first = clean.candidates[0];
        const candidate = fixture.candidates[0];
        if ((first === undefined) || (candidate === undefined))
          throw new Error('bounded overflow fixture is absent');
        const globalStatuses = first.globalStatuses.map(function defect(
          code,
          index,
        ) { return index <= BOUNDED_VERDICT_FINDING_CAP ? 'd' : code; });
        const findings = Array.from(
          { length: BOUNDED_VERDICT_FINDING_CAP, },
          function finding(_value, index,): BoundedFinding {
            return {
              scope: 'g',
              manifestIndex: index,
              defectClassIndex: defectClassIndex({ name: 'grammar-usage', }),
              targetAnchors: [anchor({ candidate, startOffset: 0, endOffset: 3, }),],
            };
          },
        );
        const overflowRow: BoundedCandidateVerification = {
          ...first,
          globalStatuses,
          overflow: true,
          findings,
        };
        const overflow = replaceRow({
          response: clean,
          candidateId: first.candidateId,
          row: overflowRow,
        },);
        expect(ballot({ fixture, response: overflow, }).response,).toEqual(overflow,);
        expect(() => ballot({
          fixture,
          response: replaceRow({
            response: clean,
            candidateId: first.candidateId,
            row: { ...overflowRow, overflow: false, },
          },),
        }),).toThrow();
      },
    },),

    it({
      name: 'ADMITS maximum bounded verifier witness with estimated headroom',
      fn: async () => {
        const fixture = settledFixture();
        const response = maximalBoundedVerifierResponse({
          ledger: fixture.ledger,
          candidates: fixture.candidates,
        },);
        expect(ballot({ fixture, response, }).response,).toEqual(response,);
        expect(response.candidates.every(function capped(row,) {
          return row.overflow
            && (row.findings.length === BOUNDED_VERDICT_FINDING_CAP)
            && row.findings.every(function anchored(finding,) {
              return finding.targetAnchors.length === 3;
            },);
        },),).toBe(true,);
        const measurement = measureBoundedVerifierEnvelope({
          ledger: fixture.ledger,
          candidates: fixture.candidates,
          response,
        },);
        expect(measurement.bytes,).toBeGreaterThan(0,);
        expect(measurement.estimatedHeadroomTokens,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'BINDS maximum graph to seven payloads in two waves',
      fn: async () => {
        const fixture = createBoundedLifecycleFixture();
        const manifest = createBoundedVerdictManifest({
          ledger: fixture.ledger,
          shell: fixture.shell,
          archiveBody: BOUNDED_LIFECYCLE_ARCHIVE,
          candidatePlan: [
            { ordinal: 0, modelId: 'hf:Qwen/Qwen3.8-27B', priority: 0, },
            { ordinal: 1, modelId: 'hf:moonshotai/Kimi-K3', priority: 1, },
            { ordinal: 2, modelId: 'hf:zai-org/GLM-5.3-Flash', priority: 2, },
            { ordinal: 3, modelId: 'hf:openai/gpt-oss-120b', priority: 3, },
          ],
          verifierModelIds: [
            'minimax-m3',
            'deepseek-v4-flash-0731',
            'deepseek-v4-pro-0813',
          ],
          providerSelection: 'hyper-only',
          sourcePictures: BOUNDED_LIFECYCLE_MEDIA.map(function picture(item,) {
            return { assetName: item.assetName, digest: item.digest, };
          },),
        },);
        expect(manifest.payloadCountCeiling,).toBe(7,);
        expect(manifest.dependencyWaves,).toBe(2,);
        expect(manifest.findingCap,).toBe(BOUNDED_VERDICT_FINDING_CAP,);
        expect(() => createBoundedVerdictManifest({
          ledger: fixture.ledger,
          shell: fixture.shell,
          archiveBody: BOUNDED_LIFECYCLE_ARCHIVE,
          candidatePlan: manifest.candidatePlan,
          verifierModelIds: [
            ...manifest.verifierModelIds,
            'gemma-4-26b-a4b-it',
          ],
          providerSelection: 'hyper-only',
          sourcePictures: manifest.sourcePictures,
        },),).toThrow();
        expect(() => createBoundedVerdictManifest({
          ledger: fixture.ledger,
          shell: fixture.shell,
          archiveBody: BOUNDED_LIFECYCLE_ARCHIVE,
          candidatePlan: manifest.candidatePlan,
          verifierModelIds: [
            'hf:Qwen/Qwen3.8-27B',
            'minimax-m3',
            'deepseek-v4-pro-0813',
          ],
          providerSelection: 'hyper-only',
          sourcePictures: manifest.sourcePictures,
        },),).toThrow();
      },
    },),

    it({
      name: 'ABSTAINS whole malformed ballot and duplicate verifier identity',
      fn: async () => {
        const fixture = settledFixture();
        const clean = cleanResponse({ fixture, });
        const first = clean.candidates[0];
        if (first === undefined)
          throw new Error('bounded malformed ballot row is absent');
        const cleanZero = ballot({ fixture, response: clean, verifierOrdinal: 0, });
        const cleanOne = ballot({ fixture, response: clean, verifierOrdinal: 1, });
        const malformed: BoundedVerifierBallot = {
          ...cleanOne,
          response: replaceRow({
            response: cleanOne.response,
            candidateId: first.candidateId,
            row: {
              ...first,
              candidateDigest: '0'.repeat(64,),
            },
          },),
        };
        const malformedSelection = selection({
          fixture,
          ballots: [cleanZero, malformed,],
        },);
        expect(malformedSelection.evidenceFloorMet,).toBe(false,);
        expect(malformedSelection.abstainingVerifierModelIds,).toContain(
          cleanOne.verifierModelId,
        );
        const duplicateSelection = selection({
          fixture,
          ballots: [cleanZero, cleanZero, cleanOne,],
        },);
        expect(duplicateSelection.evidenceFloorMet,).toBe(false,);
        expect(duplicateSelection.abstainingVerifierModelIds,).toContain(
          cleanZero.verifierModelId,
        );
        const sameFamilySelection = selection({
          fixture,
          ballots: [cleanZero, cleanOne,],
        },);
        expect(sameFamilySelection.cleanVerifierModelIds,).toHaveLength(2,);
        expect(sameFamilySelection.evidenceFloorMet,).toBe(false,);
      },
    },),

    it({
      name: 'USES two clean identities for floor and dissent blocks production eligibility',
      fn: async () => {
        const fixture = settledFixture();
        const clean = cleanResponse({ fixture, });
        const twoClean = [
          ballot({ fixture, response: clean, verifierOrdinal: 0, }),
          ballot({ fixture, response: clean, verifierOrdinal: 2, }),
        ];
        const selected = selectBoundedCandidate({
          authorSettlement: fixture.settlement,
          ballots: twoClean,
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          ledger: fixture.ledger,
          shell: fixture.shell,
          sourceText: BOUNDED_LIFECYCLE_SOURCE,
          archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
          sourcePictures: BOUNDED_LIFECYCLE_MEDIA.map(function picture(item,) {
            return { assetName: item.assetName, };
          },),
        },);
        expect(selected.evidenceFloorMet,).toBe(true,);
        expect(selected.productionEligible,).toBe(true,);
        const first = clean.candidates[0];
        if (first === undefined)
          throw new Error('bounded dissent row is absent');
        const dissentResponse = replaceRow({
          response: clean,
          candidateId: first.candidateId,
          row: {
            ...first,
            obligationStatuses: first.obligationStatuses.map(function defect(
              code,
              index,
            ) { return index === 0 ? 'd' : code; }),
            findings: [{
              scope: 'o',
              manifestIndex: 0,
              defectClassIndex: defectClassIndex({ name: 'omission', }),
              targetAnchors: [],
            },],
          },
        },);
        const withDissent = selectBoundedCandidate({
          authorSettlement: fixture.settlement,
          ballots: [
            ...twoClean,
            ballot({ fixture, response: dissentResponse, verifierOrdinal: 1, }),
          ],
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          ledger: fixture.ledger,
          shell: fixture.shell,
          sourceText: BOUNDED_LIFECYCLE_SOURCE,
          archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
          sourcePictures: BOUNDED_LIFECYCLE_MEDIA.map(function picture(item,) {
            return { assetName: item.assetName, };
          },),
        },);
        expect(withDissent.evidenceFloorMet,).toBe(true,);
        expect(withDissent.productionEligible,).toBe(false,);
      },
    },),

    it({
      name: 'SETTLES duplicate-member authors unusable without verifier work',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createBoundedLifecycleFixture();
        const responseFor = boundedLifecycleResponseForRequest({ fixture, });
        const calls: string[] = [];
        const client: SyntheticClient = {
          chatText: async () => {
            await Promise.resolve();
            throw new Error('bounded duplicate chatText unused');
          },
          chatJson: async <ValueT,>(
            request: ChatJsonRequest<ValueT>,
          ): Promise<ChatJsonOutcome<ValueT>> => {
            const schemaName = request.responseFormat?.json_schema.name ?? '';
            calls.push(schemaName,);
            if (schemaName !== 'immutable_shell_slots')
              throw new Error('bounded duplicate fixture reached verifier');
            const value = responseFor(request,);
            if (!request.validate(value,))
              throw new Error('bounded duplicate fixture failed author guard');
            const serialized = JSON.stringify(value,);
            const body = serialized.slice(1, -1,);
            return {
              kind: 'ok',
              value,
              rawText: `{${body},${body}}`,
            };
          },
          quotas: async () => {
            await Promise.resolve();
            throw new Error('bounded duplicate quotas unused');
          },
        };
        const boundClient = bindBoundedClient({
          manifest: fixture.manifest,
          outputDir: directory.path,
          clients: { all: client, synthetic: client, hyper: client, },
        },);
        const result = await runBoundedRuntime({
          outputDir: directory.path,
          boundClient,
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: BOUNDED_LIFECYCLE_SOURCE,
          archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
          media: BOUNDED_LIFECYCLE_MEDIA,
          restart: false,
          signal: new AbortController().signal,
        },);
        expect(calls,).toEqual([
          'immutable_shell_slots',
          'immutable_shell_slots',
          'immutable_shell_slots',
          'immutable_shell_slots',
        ],);
        expect(result.authorSettlement.rows.every(function unusable(row,) {
          return row.state === 'spent-unusable';
        },),).toBe(true,);
        expect(result.verifierStates,).toEqual([],);
        expect(result.skippedVerifierModelIds,).toEqual(
          fixture.manifest.verifierModelIds,
        );
        expect(result.selection,).toBeUndefined();
      },
      timeout: 20_000,
    },),

    it({
      name: 'QUARANTINES indeterminate author transmission across restart',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createBoundedLifecycleFixture();
        const responseFor = boundedLifecycleResponseForRequest({ fixture, });
        let calls = 0;
        const client: SyntheticClient = {
          chatText: async () => {
            await Promise.resolve();
            throw new Error('bounded indeterminate chatText unused');
          },
          chatJson: async <ValueT,>(
            request: ChatJsonRequest<ValueT>,
          ): Promise<ChatJsonOutcome<ValueT>> => {
            calls += 1;
            if ((request.responseFormat?.json_schema.name === 'immutable_shell_slots')
              && (request.modelId === fixture.manifest.candidatePlan[0]?.modelId)) {
              await wait(5,);
              throw new IndeterminateTransmission('bounded transmission unknown');
            }
            const value = responseFor(request,);
            if (!request.validate(value,))
              throw new Error('bounded indeterminate fixture failed guard');
            return { kind: 'ok', value, rawText: JSON.stringify(value,), };
          },
          quotas: async () => {
            await Promise.resolve();
            throw new Error('bounded indeterminate quotas unused');
          },
        };
        const boundClient = bindBoundedClient({
          manifest: fixture.manifest,
          outputDir: directory.path,
          clients: { all: client, synthetic: client, hyper: client, },
        },);
        const first = await runBoundedRuntime({
          outputDir: directory.path,
          boundClient,
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: BOUNDED_LIFECYCLE_SOURCE,
          archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
          media: BOUNDED_LIFECYCLE_MEDIA,
          restart: false,
          signal: new AbortController().signal,
        },);
        expect(calls,).toBe(7,);
        expect(first.authorSettlement.rows[0]?.state,).toBe('spent-unusable',);
        expect(first.authorSettlement.rows[1]?.state,).toBe('completed',);
        const record = await readFile(join(
          directory.path,
          'node-bounded-author-0.json',
        ), 'utf8',);
        expect(record.includes('"failureType": "IndeterminateTransmission"',),).toBe(true,);
        const callsAfterFirstRun = calls;
        const restarted = await runBoundedRuntime({
          outputDir: directory.path,
          boundClient: bindBoundedClient({
            manifest: fixture.manifest,
            outputDir: directory.path,
            clients: {
              all: refusingClient(),
              synthetic: refusingClient(),
              hyper: refusingClient(),
            },
          },),
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: BOUNDED_LIFECYCLE_SOURCE,
          archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
          media: BOUNDED_LIFECYCLE_MEDIA,
          restart: true,
          signal: new AbortController().signal,
        },);
        expect(restarted.authorSettlement.rows[0]?.state,).toBe('spent-unusable',);
        expect(calls,).toBe(callsAfterFirstRun,);
      },
      timeout: 20_000,
    },),

    it({
      name: 'QUARANTINES indeterminate verifier transmission across restart',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createBoundedLifecycleFixture();
        const responseFor = boundedLifecycleResponseForRequest({ fixture, });
        let calls = 0;
        const client: SyntheticClient = {
          chatText: async () => {
            await Promise.resolve();
            throw new Error('bounded verifier indeterminate chatText unused');
          },
          chatJson: async <ValueT,>(
            request: ChatJsonRequest<ValueT>,
          ): Promise<ChatJsonOutcome<ValueT>> => {
            calls += 1;
            if ((request.responseFormat?.json_schema.name === 'bounded_verdict_ballot')
              && (request.modelId === fixture.manifest.verifierModelIds[0]))
              throw new IndeterminateTransmission('bounded verifier transmission unknown');
            const value = responseFor(request,);
            if (!request.validate(value,))
              throw new Error('bounded verifier indeterminate fixture failed guard');
            return { kind: 'ok', value, rawText: JSON.stringify(value,), };
          },
          quotas: async () => {
            await Promise.resolve();
            throw new Error('bounded verifier indeterminate quotas unused');
          },
        };
        const first = await runBoundedRuntime({
          outputDir: directory.path,
          boundClient: bindBoundedClient({
            manifest: fixture.manifest,
            outputDir: directory.path,
            clients: { all: client, synthetic: client, hyper: client, },
          },),
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: BOUNDED_LIFECYCLE_SOURCE,
          archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
          media: BOUNDED_LIFECYCLE_MEDIA,
          restart: false,
          signal: new AbortController().signal,
        },);
        expect(calls,).toBe(7,);
        expect(first.verifierStates.filter(function admitted(state,) {
          return state.ballot !== undefined;
        },),).toHaveLength(2,);
        const record = await readFile(join(
          directory.path,
          'node-bounded-verifier-0.json',
        ), 'utf8',);
        expect(record.includes('"failureType": "IndeterminateTransmission"',),).toBe(true,);
        const callsAfterFirstRun = calls;
        await runBoundedRuntime({
          outputDir: directory.path,
          boundClient: bindBoundedClient({
            manifest: fixture.manifest,
            outputDir: directory.path,
            clients: {
              all: refusingClient(),
              synthetic: refusingClient(),
              hyper: refusingClient(),
            },
          },),
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: BOUNDED_LIFECYCLE_SOURCE,
          archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
          media: BOUNDED_LIFECYCLE_MEDIA,
          restart: true,
          signal: new AbortController().signal,
        },);
        expect(calls,).toBe(callsAfterFirstRun,);
      },
      timeout: 20_000,
    },),

    it({
      name: 'ABSTAINS fresh duplicate-member verifier without suspension',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createBoundedLifecycleFixture();
        const responseFor = boundedLifecycleResponseForRequest({ fixture, });
        let verifierOrdinal = 0;
        const client: SyntheticClient = {
          chatText: async () => {
            await Promise.resolve();
            throw new Error('bounded abstention chatText unused');
          },
          chatJson: async <ValueT,>(
            request: ChatJsonRequest<ValueT>,
          ): Promise<ChatJsonOutcome<ValueT>> => {
            const schemaName = request.responseFormat?.json_schema.name;
            const current = schemaName === 'bounded_verdict_ballot'
              ? verifierOrdinal
              : (-1);
            if (schemaName === 'bounded_verdict_ballot')
              verifierOrdinal += 1;
            const value = responseFor(request,);
            if (!request.validate(value,))
              throw new Error('bounded abstention fixture failed guard');
            const serialized = JSON.stringify(value,);
            if (current === 0) {
              const body = serialized.slice(1, -1,);
              return {
                kind: 'ok',
                value,
                rawText: `{${body},${body}}`,
              };
            }
            return { kind: 'ok', value, rawText: serialized, };
          },
          quotas: async () => {
            await Promise.resolve();
            throw new Error('bounded abstention quotas unused');
          },
        };
        const result = await runBoundedRuntime({
          outputDir: directory.path,
          boundClient: bindBoundedClient({
            manifest: fixture.manifest,
            outputDir: directory.path,
            clients: { all: client, synthetic: client, hyper: client, },
          },),
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: BOUNDED_LIFECYCLE_SOURCE,
          archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
          media: BOUNDED_LIFECYCLE_MEDIA,
          restart: false,
          signal: new AbortController().signal,
        },);
        expect(result.verifierStates,).toHaveLength(3,);
        expect(result.verifierStates.filter(function admitted(state,) {
          return state.ballot !== undefined;
        },),).toHaveLength(2,);
        expect(result.selection?.evidenceFloorMet,).toBe(true,);
        expect(result.selection?.productionEligible,).toBe(true,);
      },
      timeout: 20_000,
    },),

    it({
      name: 'RUNS two waves through Hyper mask and restarts without redispatch',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createBoundedLifecycleFixture();
        const responseFor = boundedLifecycleResponseForRequest({ fixture, });
        const calls: string[] = [];
        const prompts: string[] = [];
        const peak = { value: 0, inFlight: 0, };
        const hyper = scriptedClient({ responseFor, calls, prompts, peak, });
        const boundClient = bindBoundedClient({
          manifest: fixture.manifest,
          outputDir: directory.path,
          clients: {
            all: refusingClient(),
            synthetic: refusingClient(),
            hyper,
          },
        },);
        expect(Object.isFrozen(boundClient,),).toBe(true,);
        const result = await runBoundedRuntime({
          outputDir: directory.path,
          boundClient,
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: BOUNDED_LIFECYCLE_SOURCE,
          archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
          media: BOUNDED_LIFECYCLE_MEDIA,
          restart: false,
          signal: new AbortController().signal,
        },);
        expect(calls,).toEqual([
          'immutable_shell_slots',
          'immutable_shell_slots',
          'immutable_shell_slots',
          'immutable_shell_slots',
          'bounded_verdict_ballot',
          'bounded_verdict_ballot',
          'bounded_verdict_ballot',
        ],);
        expect(peak.value,).toBe(4,);
        expect(prompts.every(function image(prompt,) {
          return prompt.includes('image_url',);
        },),).toBe(true,);
        expect(prompts.some(function authority(prompt,) {
          return prompt.includes('"priority":');
        },),).toBe(false,);
        expect(result.selection?.evidenceFloorMet,).toBe(true,);
        expect(result.selection?.productionEligible,).toBe(true,);
        const restartCalls: string[] = [];
        const restartClient = bindBoundedClient({
          manifest: fixture.manifest,
          outputDir: directory.path,
          clients: {
            all: refusingClient(),
            synthetic: refusingClient(),
            hyper: scriptedClient({
              responseFor,
              calls: restartCalls,
              prompts: [],
              peak: { value: 0, inFlight: 0, },
            },),
          },
        },);
        const restarted = await runBoundedRuntime({
          outputDir: directory.path,
          boundClient: restartClient,
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: BOUNDED_LIFECYCLE_SOURCE,
          archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
          media: BOUNDED_LIFECYCLE_MEDIA,
          restart: true,
          signal: new AbortController().signal,
        },);
        expect(restartCalls,).toEqual([],);
        expect(restarted.selection?.candidate.candidateDigest,).toBe(
          result.selection?.candidate.candidateDigest,
        );
      },
      timeout: 20_000,
    },),

    it({
      name: 'REFUSES restart after durable prompt digest tampering',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createBoundedLifecycleFixture();
        const responseFor = boundedLifecycleResponseForRequest({ fixture, });
        const client = scriptedClient({
          responseFor,
          calls: [],
          prompts: [],
          peak: { value: 0, inFlight: 0, },
        },);
        await runBoundedRuntime({
          outputDir: directory.path,
          boundClient: bindBoundedClient({
            manifest: fixture.manifest,
            outputDir: directory.path,
            clients: { all: client, synthetic: client, hyper: client, },
          },),
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: BOUNDED_LIFECYCLE_SOURCE,
          archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
          media: BOUNDED_LIFECYCLE_MEDIA,
          restart: false,
          signal: new AbortController().signal,
        },);
        const nodePath = join(directory.path, 'node-bounded-author-0.json',);
        const node: unknown = JSON.parse(await readFile(nodePath, 'utf8',),);
        if (!isJsonRecord(node,))
          throw new Error('bounded prompt tamper node fixture differs');
        await writeFile(nodePath, `${JSON.stringify({
          ...node,
          promptDigest: '0'.repeat(64,),
        }, null, 2,)}\n`,);
        let caught: unknown;
        try {
          await runBoundedRuntime({
            outputDir: directory.path,
            boundClient: bindBoundedClient({
              manifest: fixture.manifest,
              outputDir: directory.path,
              clients: {
                all: refusingClient(),
                synthetic: refusingClient(),
                hyper: refusingClient(),
              },
            },),
            manifest: fixture.manifest,
            expectedManifestDigest: fixture.manifest.manifestDigest,
            shell: fixture.shell,
            ledger: fixture.ledger,
            sourceText: BOUNDED_LIFECYCLE_SOURCE,
            archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
            media: BOUNDED_LIFECYCLE_MEDIA,
            restart: true,
            signal: new AbortController().signal,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(Error.isError(caught,) ? caught.message : '',).toBe(
          'immutable shell restart binding differs at bounded-author-0',
        );
      },
      timeout: 20_000,
    },),

    it({
      name: 'REFUSES duplicate members in stored restart text before parsing',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createBoundedLifecycleFixture();
        const responseFor = boundedLifecycleResponseForRequest({ fixture, });
        const calls: string[] = [];
        const client = scriptedClient({
          responseFor,
          calls,
          prompts: [],
          peak: { value: 0, inFlight: 0, },
        },);
        await runBoundedRuntime({
          outputDir: directory.path,
          boundClient: bindBoundedClient({
            manifest: fixture.manifest,
            outputDir: directory.path,
            clients: { all: client, synthetic: client, hyper: client, },
          },),
          manifest: fixture.manifest,
          expectedManifestDigest: fixture.manifest.manifestDigest,
          shell: fixture.shell,
          ledger: fixture.ledger,
          sourceText: BOUNDED_LIFECYCLE_SOURCE,
          archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
          media: BOUNDED_LIFECYCLE_MEDIA,
          restart: false,
          signal: new AbortController().signal,
        },);
        const responsePath = join(
          directory.path,
          'response-bounded-verifier-0.json',
        );
        const response: unknown = JSON.parse(await readFile(responsePath, 'utf8',),);
        if (!isJsonRecord(response,) || !Array.isArray(response.candidates,))
          throw new Error('bounded stored response fixture differs');
        const member = `"candidates":${JSON.stringify(response.candidates,)}`;
        const duplicate = `{${member},${member}}`;
        await writeFile(responsePath, duplicate,);
        const nodePath = join(directory.path, 'node-bounded-verifier-0.json',);
        const node: unknown = JSON.parse(await readFile(nodePath, 'utf8',),);
        if (!isJsonRecord(node,))
          throw new Error('bounded stored node fixture differs');
        await writeFile(nodePath, `${JSON.stringify({
          ...node,
          responseDigest: digest({ text: duplicate, }),
        }, null, 2,)}\n`,);
        let caught: unknown;
        try {
          await runBoundedRuntime({
            outputDir: directory.path,
            boundClient: bindBoundedClient({
              manifest: fixture.manifest,
              outputDir: directory.path,
              clients: {
                all: refusingClient(),
                synthetic: refusingClient(),
                hyper: refusingClient(),
              },
            },),
            manifest: fixture.manifest,
            expectedManifestDigest: fixture.manifest.manifestDigest,
            shell: fixture.shell,
            ledger: fixture.ledger,
            sourceText: BOUNDED_LIFECYCLE_SOURCE,
            archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
            media: BOUNDED_LIFECYCLE_MEDIA,
            restart: true,
            signal: new AbortController().signal,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(Error,);
        expect(Error.isError(caught,) ? caught.message : '',).toBe(
          'realization JSON object member repeats',
        );
      },
      timeout: 20_000,
    },),

    it({
      name: 'BLOCKS internal node and settlement package subpaths',
      fn: async () => {
        const specifiers = [
          '@monochromatic-dev/module-translation-repair/ts/prototype-bounded-verdict-author-wave',
          '@monochromatic-dev/module-translation-repair/ts/prototype-bounded-verdict-family',
          '@monochromatic-dev/module-translation-repair/ts/prototype-bounded-verdict-lifecycle-fixture',
          '@monochromatic-dev/module-translation-repair/ts/prototype-bounded-verdict-prompt',
          '@monochromatic-dev/module-translation-repair/ts/prototype-bounded-verdict-runtime-support',
          '@monochromatic-dev/module-translation-repair/ts/prototype-bounded-verdict-settlement',
          '@monochromatic-dev/module-translation-repair/ts/prototype-bounded-verdict-verifier-wave',
        ];
        for (const specifier of specifiers) {
          let caught: unknown;
          try {
            await import(specifier,);
          }
          catch (error) {
            caught = error;
          }
          expect(
            isJsonRecord(caught,) ? caught.code : undefined,
          ).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED',);
        }
      },
    },),

    it({
      name: 'FORWARDS pre-dispatch abort without provider call',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createBoundedLifecycleFixture();
        const controller = new AbortController();
        const reason = new Error('bounded pre-dispatch abort identity');
        controller.abort(reason,);
        let caught: unknown;
        try {
          await runBoundedRuntime({
            outputDir: directory.path,
            boundClient: bindBoundedClient({
              manifest: fixture.manifest,
              outputDir: directory.path,
              clients: {
                all: refusingClient(),
                synthetic: refusingClient(),
                hyper: refusingClient(),
              },
            },),
            manifest: fixture.manifest,
            expectedManifestDigest: fixture.manifest.manifestDigest,
            shell: fixture.shell,
            ledger: fixture.ledger,
            sourceText: BOUNDED_LIFECYCLE_SOURCE,
            archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
            media: BOUNDED_LIFECYCLE_MEDIA,
            restart: false,
            signal: controller.signal,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBe(reason,);
      },
    },),

    it({
      name: 'REFUSES mismatched output binding before provider dispatch',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createBoundedLifecycleFixture();
        const boundClient = bindBoundedClient({
          manifest: fixture.manifest,
          outputDir: join(directory.path, 'other-root',),
          clients: {
            all: refusingClient(),
            synthetic: refusingClient(),
            hyper: refusingClient(),
          },
        },);
        let caught: unknown;
        try {
          await runBoundedRuntime({
            outputDir: directory.path,
            boundClient,
            manifest: fixture.manifest,
            expectedManifestDigest: fixture.manifest.manifestDigest,
            shell: fixture.shell,
            ledger: fixture.ledger,
            sourceText: BOUNDED_LIFECYCLE_SOURCE,
            archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
            media: BOUNDED_LIFECYCLE_MEDIA,
            restart: false,
            signal: new AbortController().signal,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(Error.isError(caught,) ? caught.message : '',).toBe(
          'bounded runtime provider or output binding differs',
        );
      },
    },),

    it({
      name: 'FORWARDS exact abort after concurrent author siblings settle',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createBoundedLifecycleFixture();
        const responseFor = boundedLifecycleResponseForRequest({ fixture, });
        const controller = new AbortController();
        const reason = new Error('bounded caller abort identity');
        let authorCalls = 0;
        const client = scriptedClient({
          responseFor: function aborting(request,) {
            if (request.responseFormat?.json_schema.name === 'immutable_shell_slots') {
              authorCalls += 1;
              if (authorCalls === fixture.manifest.candidatePlan.length)
                controller.abort(reason,);
            }
            return responseFor(request,);
          },
          calls: [],
          prompts: [],
          peak: { value: 0, inFlight: 0, },
        },);
        const boundClient = bindBoundedClient({
          manifest: fixture.manifest,
          outputDir: directory.path,
          clients: { all: client, synthetic: client, hyper: client, },
        },);
        let caught: unknown;
        try {
          await runBoundedRuntime({
            outputDir: directory.path,
            boundClient,
            manifest: fixture.manifest,
            expectedManifestDigest: fixture.manifest.manifestDigest,
            shell: fixture.shell,
            ledger: fixture.ledger,
            sourceText: BOUNDED_LIFECYCLE_SOURCE,
            archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
            media: BOUNDED_LIFECYCLE_MEDIA,
            restart: false,
            signal: controller.signal,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBe(reason,);
        const records = await Promise.all(fixture.manifest.candidatePlan.map(
          async function record(plan,) {
            return await readFile(join(
              directory.path,
              `node-bounded-author-${String(plan.ordinal,)}.json`,
            ), 'utf8',);
          },
        ));
        expect(records.every(function spent(text,) {
          return text.includes('"failureType": "CallerAbort"',);
        },),).toBe(true,);
      },
      timeout: 20_000,
    },),

    it({
      name: 'FORWARDS exact abort after concurrent verifier siblings settle',
      fn: async () => {
        await using directory = await temporaryDirectory();
        const fixture = createBoundedLifecycleFixture();
        const responseFor = boundedLifecycleResponseForRequest({ fixture, });
        const controller = new AbortController();
        const reason = new Error('bounded verifier abort identity');
        let verifierCalls = 0;
        const client = scriptedClient({
          responseFor: function aborting(request,) {
            if (request.responseFormat?.json_schema.name === 'bounded_verdict_ballot') {
              verifierCalls += 1;
              if (verifierCalls === fixture.manifest.verifierModelIds.length)
                controller.abort(reason,);
            }
            return responseFor(request,);
          },
          calls: [],
          prompts: [],
          peak: { value: 0, inFlight: 0, },
        },);
        const boundClient = bindBoundedClient({
          manifest: fixture.manifest,
          outputDir: directory.path,
          clients: { all: client, synthetic: client, hyper: client, },
        },);
        let caught: unknown;
        try {
          await runBoundedRuntime({
            outputDir: directory.path,
            boundClient,
            manifest: fixture.manifest,
            expectedManifestDigest: fixture.manifest.manifestDigest,
            shell: fixture.shell,
            ledger: fixture.ledger,
            sourceText: BOUNDED_LIFECYCLE_SOURCE,
            archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
            media: BOUNDED_LIFECYCLE_MEDIA,
            restart: false,
            signal: controller.signal,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBe(reason,);
        const records = await Promise.all(fixture.manifest.verifierModelIds.map(
          async function record(_modelId, ordinal,) {
            return await readFile(join(
              directory.path,
              `node-bounded-verifier-${String(ordinal,)}.json`,
            ), 'utf8',);
          },
        ));
        expect(records.every(function spent(text,) {
          return text.includes('"failureType": "CallerAbort"',);
        },),).toBe(true,);
      },
      timeout: 20_000,
    },),
  ],
},);
