import { createHash, } from 'node:crypto';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  admitRealizationAuthorResponse,
  admitRealizationVerifierResponse,
  assertNoDuplicateJsonMembers,
  assertRealizationLedgerBindsShell,
  assertRealizationManifest,
  assertRealizationObligationLedger,
  buildImmutableShell,
  buildRealizationObligationLedger,
  createRealizationManifest,
  normalizeRealizationLineEndings,
  REALIZATION_GLOBAL_CRITERIA,
  realizationCandidateAlias,
  realizationObligationEvidenceDigest,
  realizationVerifierResponseGuard,
  selectRealizationCandidate,
  type RealizationAuthorResponse,
  type RealizationCandidatePlan,
  type RealizationCandidateVerification,
  type RealizationManifest,
  type RealizationObligationLedger,
  type RealizationTargetAnchor,
  type RealizationVerifierResponse,
  type RealizedCandidate,
} from '../dist/final/node/prototype-realization.mjs';

/** Source fixture with two bounded clause obligations in one slot. */
const SOURCE = `---
name: 飞猫
---
第一句。第二😀句。
`;

/** Archive fixture supplying authoritative English front matter. */
const ARCHIVE = `---
name: Carena
---
First sentence. Second sentence.
`;

/** Source fixture creating two source slots and one cross-slot relation. */
const RELATION_SOURCE = `---
name: 飞猫
---
第一句。

第二句。
`;

/** Archive fixture matching two source paragraph slots. */
const RELATION_ARCHIVE = `---
name: Carena
---
First sentence.

Meanwhile, second sentence.
`;

/** Planned verifier identities shared by schema fixtures. */
const VERIFIER_MODELS = ['minimax-m3', 'kimi-k3', 'qwen3.8-flash',] as const;

/** Hashes exact UTF-16 substring bytes as production digest helper does. */
function digest({ text, }: { readonly text: string; }): string {
  return createHash('sha256',).update(text,).digest('hex',);
}

/** Creates exact target range from one fixture slot. */
function anchor({ slotKey, text, quote, }: {
  readonly slotKey: string;
  readonly text: string;
  readonly quote: string;
}): RealizationTargetAnchor {
  const startOffset = text.indexOf(quote,);
  if (startOffset === (-1))
    throw new Error('test anchor quote is absent');
  const endOffset = startOffset + quote.length;
  return { slotKey, startOffset, endOffset, digest: digest({ text: quote, }), };
}

/** Builds shell and deterministic obligation ledger shared by tests. */
function fixture(): {
  readonly shell: ReturnType<typeof buildImmutableShell>;
  readonly ledger: RealizationObligationLedger;
  readonly slotKey: string;
  readonly candidateText: string;
} {
  const shell = buildImmutableShell({ sourceText: SOURCE, archiveText: ARCHIVE, });
  const ledger = buildRealizationObligationLedger({
    sourceBody: shell.body,
    archiveBody: ARCHIVE,
    slots: shell.slots,
    shellDigest: shell.shellDigest,
  },);
  const slotKey = shell.slots[0]?.key;
  if (slotKey === undefined)
    throw new Error('test shell slot is absent');
  return { shell, ledger, slotKey, candidateText: 'First sentence. Second sentence.', };
}

/** Builds immutable manifest around exact fixture author and verifier plan. */
function manifestFor({
  ledger,
  shell,
  candidatePlan,
  verifierModelIds = VERIFIER_MODELS,
  archiveBody = ARCHIVE,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly shell: ReturnType<typeof buildImmutableShell>;
  readonly candidatePlan: readonly RealizationCandidatePlan[];
  readonly verifierModelIds?: readonly string[];
  readonly archiveBody?: string;
}): RealizationManifest {
  return createRealizationManifest({
    ledger,
    shell,
    archiveBody,
    candidatePlan,
    verifierModelIds: verifierModelIds as never,
  },);
}

/** Builds two-slot fixture carrying one explicit relation obligation. */
function relationFixture(): {
  readonly shell: ReturnType<typeof buildImmutableShell>;
  readonly ledger: RealizationObligationLedger;
  readonly response: RealizationAuthorResponse;
} {
  const shell = buildImmutableShell({ sourceText: RELATION_SOURCE, archiveText: RELATION_ARCHIVE, });
  const ledger = buildRealizationObligationLedger({
    sourceBody: shell.body,
    archiveBody: RELATION_ARCHIVE,
    slots: shell.slots,
    shellDigest: shell.shellDigest,
  },);
  const firstSlot = shell.slots[0]?.key;
  const secondSlot = shell.slots[1]?.key;
  if ((firstSlot === undefined) || (secondSlot === undefined))
    throw new Error('relation fixture source slots are absent');
  const slots = [
    { slotKey: firstSlot, text: 'First sentence.', },
    { slotKey: secondSlot, text: 'Meanwhile, second sentence.', },
  ];
  const realization = ledger.obligations.map(function claim(obligation,) {
    if (obligation.kind === 'relation') {
      return {
        obligationId: obligation.id,
        targetAnchors: [anchor({ slotKey: secondSlot, text: slots[1]?.text ?? '', quote: 'Meanwhile', }),],
      };
    }
    const targetSlot = obligation.allowedTargetSlotKeys[0];
    if (targetSlot === firstSlot) {
      return {
        obligationId: obligation.id,
        targetAnchors: [anchor({ slotKey: firstSlot, text: slots[0]?.text ?? '', quote: 'First sentence.', }),],
      };
    }
    return {
      obligationId: obligation.id,
      targetAnchors: [anchor({ slotKey: secondSlot, text: slots[1]?.text ?? '', quote: 'second sentence.', }),],
    };
  },);
  return { shell, ledger, response: { slots, realization, }, };
}

/** Recomputes evidence digest after intentional relation mutation. */
function withRelationEvidence(
  obligation: RealizationObligationLedger['obligations'][number],
): RealizationObligationLedger['obligations'][number] {
  return {
    ...obligation,
    evidenceDigest: realizationObligationEvidenceDigest({
      obligation: {
        kind: obligation.kind,
        sourceSpans: obligation.sourceSpans,
        relationEndpoints: obligation.relationEndpoints,
        allowedTargetSlotKeys: obligation.allowedTargetSlotKeys,
        targetCardinality: obligation.targetCardinality,
        authority: obligation.authority,
      },
    },),
  };
}

/** Builds structurally valid author response with non-overlapping obligation ownership. */
function authorResponse({ ledger, slotKey, candidateText, firstQuote = 'First sentence.', }: {
  readonly ledger: RealizationObligationLedger;
  readonly slotKey: string;
  readonly candidateText: string;
  readonly firstQuote?: string;
}): RealizationAuthorResponse {
  const quotes = [firstQuote, 'Second sentence.',];
  return {
    slots: [{ slotKey, text: candidateText, },],
    realization: ledger.obligations.map(function claim(obligation, index,) {
      const quote = quotes[index];
      if (quote === undefined)
        throw new Error('test obligation exceeded clause fixture');
      return {
        obligationId: obligation.id,
        targetAnchors: [anchor({ slotKey, text: candidateText, quote, }),],
      };
    },),
  };
}

/** Admits one fixture author under chosen model and non-priority ordinal. */
function admittedCandidate({ modelId, ordinal, firstQuote, }: {
  readonly modelId: string;
  readonly ordinal: number;
  readonly firstQuote?: string;
}): RealizedCandidate {
  const { shell, ledger, slotKey, candidateText, } = fixture();
  const manifest = manifestFor({
    ledger,
    shell,
    candidatePlan: [{ ordinal, modelId: modelId as never, priority: ordinal, },],
  },);
  return admitRealizationAuthorResponse({
    response: authorResponse({
      ledger,
      slotKey,
      candidateText,
      ...(firstQuote === undefined ? {} : { firstQuote, }),
    },),
    shell,
    ledger,
    manifest,
    expectedManifestDigest: manifest.manifestDigest,
    candidateOrdinal: ordinal,
    sourceText: SOURCE,
    archiveText: ARCHIVE,
    sourcePictures: [],
  },);
}

/** Builds manifest-owned author authorization from admitted fixture candidates. */
function candidatePlan(candidates: readonly RealizedCandidate[],): readonly {
  readonly ordinal: number;
  readonly modelId: RealizedCandidate['modelId'];
  readonly priority: number;
}[] {
  return candidates.map(function plan(candidate,) {
    return {
      ordinal: candidate.candidateOrdinal,
      modelId: candidate.modelId,
      priority: candidate.priority,
    };
  },);
}

/** Admits two author models under one immutable manifest. */
function admittedPair(): {
  readonly first: RealizedCandidate;
  readonly second: RealizedCandidate;
  readonly shell: ReturnType<typeof buildImmutableShell>;
  readonly ledger: RealizationObligationLedger;
  readonly manifest: RealizationManifest;
} {
  const { shell, ledger, slotKey, candidateText, } = fixture();
  const plans: readonly RealizationCandidatePlan[] = [
    { ordinal: 0, modelId: 'qwen3.6-flash' as never, priority: 0, },
    { ordinal: 1, modelId: 'qwen3.7-plus' as never, priority: 1, },
  ];
  const manifest = manifestFor({ ledger, shell, candidatePlan: plans, });
  const candidates = plans.map(function admit(plan,) {
    return admitRealizationAuthorResponse({
      response: authorResponse({ ledger, slotKey, candidateText, }),
      shell,
      ledger,
      manifest,
      expectedManifestDigest: manifest.manifestDigest,
      candidateOrdinal: plan.ordinal,
      sourceText: SOURCE,
      archiveText: ARCHIVE,
      sourcePictures: [],
    },);
  },);
  const first = candidates[0];
  const second = candidates[1];
  if ((first === undefined) || (second === undefined))
    throw new Error('paired candidate fixture is incomplete');
  return { first, second, shell, ledger, manifest, };
}

/** Produces full clean verifier matrix for supplied candidates. */
function cleanResponse({ candidates, ledger, }: {
  readonly candidates: readonly RealizedCandidate[];
  readonly ledger: RealizationObligationLedger;
}): RealizationVerifierResponse {
  return {
    candidates: candidates.map(function verification(candidate,) {
      return {
        candidateId: candidate.candidateId,
        candidateDigest: candidate.candidateDigest,
        obligations: ledger.obligations.map(function status(obligation,) {
          return {
            obligationId: obligation.id,
            obligationEvidenceDigest: obligation.evidenceDigest,
            status: 'preserved' as const,
            verifiedTargetAnchors: candidate.realization[obligation.id] ?? [],
          };
        },),
        globalChecks: REALIZATION_GLOBAL_CRITERIA.map(function status(criterion,) {
          return { criterion, status: 'clean' as const, };
        },),
        findings: [],
      };
    },),
  };
}

await describe({
  name: 'Candidate G realization schema',
  children: [
    it({
      name: 'normalizes line endings while retaining UTF-16 coordinate convention',
      fn: async () => {
        expect(normalizeRealizationLineEndings({ text: 'a\r\nb\rc', }),).toBe('a\nb\nc',);
        const { ledger, } = fixture();
        expect(ledger.offsetEncoding,).toBe('utf16-code-unit',);
        expect(ledger.obligations.length,).toBe(2,);
      },
    },),
    it({
      name: 'REFUSES unknown span namespace and obligation metadata drift',
      fn: async () => {
        const { shell, ledger, } = fixture();
        const changed = structuredClone(ledger,) as unknown as {
          offsetEncoding: string;
          obligations: { sourceSpans: { namespace: string; }[]; }[];
        };
        changed.offsetEncoding = 'byte';
        changed.obligations[0]?.sourceSpans.splice(0, 1, {
          ...(ledger.obligations[0]?.sourceSpans[0] as object),
          namespace: 'other',
        } as never,);
        expect(() => assertRealizationObligationLedger({
          ledger: changed as never,
          sourceBody: shell.body,
          archiveBody: ARCHIVE,
        },),).toThrow();
      },
    },),
    it({
      name: 'REFUSES ledger whose source-slot set differs from immutable shell',
      fn: async () => {
        const { shell, ledger, } = relationFixture();
        expect(() => assertRealizationLedgerBindsShell({
          ledger: { ...ledger, sourceSlots: ledger.sourceSlots.slice(0, 1,), },
          shell,
          archiveBody: RELATION_ARCHIVE,
        },),).toThrow('source slots differ');
      },
    },),
    it({
      name: 'requires archive-authority obligation to carry archive namespace evidence',
      fn: async () => {
        const { shell, ledger, slotKey, } = fixture();
        const archiveStart = ARCHIVE.indexOf('Carena',);
        const sourceSpan = ledger.obligations[0]?.sourceSpans[0];
        if ((archiveStart === (-1)) || (sourceSpan === undefined))
          throw new Error('archive authority fixture span is absent');
        const archiveSpan = {
          namespace: 'archive-body' as const,
          startOffset: archiveStart,
          endOffset: archiveStart + 'Carena'.length,
          digest: digest({ text: 'Carena', }),
        };
        const valid = withRelationEvidence({
          id: 'archive-authority-000',
          kind: 'archive-authority',
          sourceSpans: [archiveSpan,],
          relationEndpoints: [],
          allowedTargetSlotKeys: [slotKey,],
          targetCardinality: 'one-or-more',
          authority: 'archive-allowed',
          evidenceDigest: '',
        },);
        assertRealizationObligationLedger({
          ledger: { ...ledger, obligations: [...ledger.obligations, valid,], },
          sourceBody: shell.body,
          archiveBody: ARCHIVE,
        },);
        const invalid = withRelationEvidence({ ...valid, sourceSpans: [sourceSpan,], });
        expect(() => assertRealizationObligationLedger({
          ledger: { ...ledger, obligations: [...ledger.obligations, invalid,], },
          sourceBody: shell.body,
          archiveBody: ARCHIVE,
        },),).toThrow('archive obligation authority differs');
      },
    },),
    it({
      name: 'REFUSES repeated cross-obligation target ownership',
      fn: async () => {
        const { shell, ledger, slotKey, candidateText, } = fixture();
        const repeated = anchor({ slotKey, text: candidateText, quote: 'First sentence.', });
        const response = authorResponse({ ledger, slotKey, candidateText, });
        const manifest = manifestFor({
          ledger,
          shell,
          candidatePlan: [{ ordinal: 0, modelId: 'qwen3.6-flash' as never, priority: 0, },],
        },);
        const changed: RealizationAuthorResponse = {
          ...response,
          realization: response.realization.map(function repeat(claim,) {
            return { ...claim, targetAnchors: [repeated,], };
          },),
        };
        expect(() => admitRealizationAuthorResponse({
          response: changed,
          shell,
          ledger,
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          candidateOrdinal: 0,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [],
        },),).toThrow('ownership overlaps');
      },
    },),
    it({
      name: 'binds realization map into candidate digest and keeps aliases opaque',
      fn: async () => {
        const first = admittedCandidate({ modelId: 'qwen3.6-flash', ordinal: 0, });
        const second = admittedCandidate({ modelId: 'qwen3.6-flash', ordinal: 0, firstQuote: 'First', });
        expect(first.documentDigest,).toBe(second.documentDigest,);
        expect(first.candidateDigest,).not.toBe(second.candidateDigest,);
        expect(first.candidateId,).toBe(realizationCandidateAlias({
          manifestDigest: first.manifestDigest,
          ordinal: 0,
        },),);
        expect(first.candidateId,).not.toContain('qwen',);
      },
    },),
    it({
      name: 'REFUSES duplicate raw JSON object members before ordinary parsing',
      fn: async () => {
        expect(() => assertNoDuplicateJsonMembers({ text: '{"a":1,"a":2}', },),).toThrow('member repeats');
        expect(() => assertNoDuplicateJsonMembers({ text: '{"a":1,"\\u0061":2}', },),).toThrow('member repeats');
        expect(() => assertNoDuplicateJsonMembers({ text: '{"a":1,"nested":{"a":2}}', },),).not.toThrow();
      },
    },),
    it({
      name: 'REFUSES logical duplicate findings even when evidence anchors differ',
      fn: async () => {
        const { ledger, shell, } = fixture();
        const candidate = admittedCandidate({ modelId: 'qwen3.6-flash', ordinal: 0, });
        const manifest = manifestFor({ ledger, shell, candidatePlan: candidatePlan([candidate,]), });
        const clean = cleanResponse({ candidates: [candidate,], ledger, });
        const base = clean.candidates[0] as RealizationCandidateVerification;
        const obligationId = ledger.obligations[0]?.id ?? '';
        const firstAnchor = candidate.realization[obligationId]?.[0];
        const secondAnchor = candidate.realization[ledger.obligations[1]?.id ?? '']?.[0];
        if ((firstAnchor === undefined) || (secondAnchor === undefined))
          throw new Error('test finding anchor is absent');
        const response: RealizationVerifierResponse = {
          candidates: [{
            ...base,
            obligations: base.obligations.map(function defect(status,) {
              return status.obligationId === obligationId ? { ...status, status: 'defect' as const, } : status;
            },),
            findings: [
              { scope: 'obligation', obligationId, defectClass: 'wrong-meaning', targetAnchors: [firstAnchor,], },
              { scope: 'obligation', obligationId, defectClass: 'wrong-meaning', targetAnchors: [secondAnchor,], },
            ],
          },],
        };
        expect(() => admitRealizationVerifierResponse({
          response,
          ledger,
          candidates: [candidate,],
          verifierModelId: 'minimax-m3' as never,
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          shell,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [],
        },),).toThrow('finding repeats');
        const omission: RealizationVerifierResponse = {
          candidates: [{
            ...base,
            obligations: base.obligations.map(function defect(status,) {
              return status.obligationId === obligationId ? { ...status, status: 'defect' as const, } : status;
            },),
            findings: [{
              scope: 'obligation',
              obligationId,
              defectClass: 'omission',
              targetAnchors: [firstAnchor,],
            },],
          },],
        };
        expect(() => admitRealizationVerifierResponse({
          response: omission,
          ledger,
          candidates: [candidate,],
          verifierModelId: 'minimax-m3' as never,
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          shell,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [],
        },),).toThrow('must not claim target anchor');
        const globalOmission: RealizationVerifierResponse = {
          candidates: [{
            ...base,
            globalChecks: base.globalChecks.map(function defect(status,) {
              return status.criterion === 'grammar-usage' ? { ...status, status: 'defect' as const, } : status;
            },),
            findings: [{
              scope: 'global',
              criterion: 'grammar-usage',
              defectClass: 'omission',
              targetAnchors: [firstAnchor,],
            },],
          },],
        };
        expect(() => admitRealizationVerifierResponse({
          response: globalOmission,
          ledger,
          candidates: [candidate,],
          verifierModelId: 'minimax-m3' as never,
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          shell,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [],
        },),).toThrow('must use source obligation scope');
      },
    },),
    it({
      name: 'REFUSES verifier reuse of one target fragment across source obligations',
      fn: async () => {
        const { ledger, shell, } = fixture();
        const candidate = admittedCandidate({ modelId: 'qwen3.6-flash', ordinal: 0, });
        const manifest = manifestFor({ ledger, shell, candidatePlan: candidatePlan([candidate,]), });
        const clean = cleanResponse({ candidates: [candidate,], ledger, });
        const verification = clean.candidates[0];
        const firstAnchor = verification?.obligations[0]?.verifiedTargetAnchors[0];
        if ((verification === undefined) || (firstAnchor === undefined))
          throw new Error('verifier reuse fixture anchor is absent');
        const repeated: RealizationVerifierResponse = {
          candidates: [{
            ...verification,
            obligations: verification.obligations.map(function repeat(status,) {
              return { ...status, verifiedTargetAnchors: [firstAnchor,], };
            },),
          },],
        };
        expect(() => admitRealizationVerifierResponse({
          response: repeated,
          ledger,
          candidates: [candidate,],
          verifierModelId: 'minimax-m3' as never,
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          shell,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [],
        },),).toThrow();
      },
    },),
    it({
      name: 'accepts explicit non-overlapping relation realization and REFUSES empty or wrong-slot claims',
      fn: async () => {
        const { shell, ledger, response, } = relationFixture();
        const manifest = manifestFor({
          ledger,
          shell,
          archiveBody: RELATION_ARCHIVE,
          candidatePlan: [{ ordinal: 0, modelId: 'qwen3.8-flash' as never, priority: 0, },],
        },);
        const admitted = admitRealizationAuthorResponse({
          response,
          shell,
          ledger,
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          candidateOrdinal: 0,
          sourceText: RELATION_SOURCE,
          archiveText: RELATION_ARCHIVE,
          sourcePictures: [],
        },);
        expect(ledger.obligations.filter(function relation(value,) { return value.kind === 'relation'; },).length,).toBe(1,);
        expect(admitted.documentDigest.length,).toBe(64,);
        const relation = ledger.obligations.find(function relationRow(value,) { return value.kind === 'relation'; },);
        const firstClause = ledger.obligations.find(function clause(value,) { return value.kind === 'clause'; },);
        if ((relation === undefined) || (firstClause === undefined))
          throw new Error('relation fixture obligation is absent');
        const emptyRelation: RealizationAuthorResponse = {
          ...response,
          realization: response.realization.map(function empty(claim,) {
            return claim.obligationId === relation.id ? { ...claim, targetAnchors: [], } : claim;
          },),
        };
        expect(() => admitRealizationAuthorResponse({
          response: emptyRelation,
          shell,
          ledger,
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          candidateOrdinal: 0,
          sourceText: RELATION_SOURCE,
          archiveText: RELATION_ARCHIVE,
          sourcePictures: [],
        },),).toThrow('has no target anchor');
        const secondSlot = response.slots[1];
        if (secondSlot === undefined)
          throw new Error('relation candidate second slot is absent');
        const wrongSlot: RealizationAuthorResponse = {
          ...response,
          realization: response.realization.map(function wrong(claim,) {
            return claim.obligationId === firstClause.id
              ? {
                ...claim,
                targetAnchors: [anchor({
                  slotKey: secondSlot.slotKey,
                  text: secondSlot.text,
                  quote: 'second sentence.',
                },),],
              }
              : claim;
          },),
        };
        expect(() => admitRealizationAuthorResponse({
          response: wrongSlot,
          shell,
          ledger,
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          candidateOrdinal: 0,
          sourceText: RELATION_SOURCE,
          archiveText: RELATION_ARCHIVE,
          sourcePictures: [],
        },),).toThrow('slot differs from obligation');
      },
    },),
    it({
      name: 'REFUSES repeated self and non-clause relation endpoints',
      fn: async () => {
        const { shell, ledger, } = relationFixture();
        const relation = ledger.obligations.find(function relationRow(value,) { return value.kind === 'relation'; },);
        const clauses = ledger.obligations.filter(function clause(value,) { return value.kind === 'clause'; },);
        if ((relation === undefined) || (clauses.length !== 2))
          throw new Error('relation fixture ledger differs');
        const repeated = withRelationEvidence({ ...relation, relationEndpoints: [clauses[0]?.id ?? '', clauses[0]?.id ?? '',], });
        const self = withRelationEvidence({ ...relation, relationEndpoints: [relation.id, clauses[1]?.id ?? '',], });
        const extra = withRelationEvidence({ ...relation, id: 'relation-001', });
        const nonClause = withRelationEvidence({ ...relation, relationEndpoints: [clauses[0]?.id ?? '', extra.id,], });
        const variants = [
          ledger.obligations.map(function replace(value,) { return value.id === relation.id ? repeated : value; },),
          ledger.obligations.map(function replace(value,) { return value.id === relation.id ? self : value; },),
          [
            ...ledger.obligations.map(function replace(value,) { return value.id === relation.id ? nonClause : value; },),
            extra,
          ],
        ];
        for (const obligations of variants) {
          expect(() => assertRealizationObligationLedger({
            ledger: { ...ledger, obligations, },
            sourceBody: shell.body,
            archiveBody: RELATION_ARCHIVE,
          },),).toThrow('relation endpoints');
        }
      },
    },),
    it({
      name: 'REFUSES malformed obligation ids and incomplete source coverage',
      fn: async () => {
        const { shell, ledger, } = fixture();
        const first = ledger.obligations[0];
        if (first === undefined)
          throw new Error('coverage fixture obligation is absent');
        const malformed = withRelationEvidence({ ...first, id: 'x-0', });
        expect(() => assertRealizationObligationLedger({
          ledger: { ...ledger, obligations: [malformed, ...ledger.obligations.slice(1,),], },
          sourceBody: shell.body,
          archiveBody: ARCHIVE,
        },),).toThrow('id differs');
        expect(() => assertRealizationObligationLedger({
          ledger: { ...ledger, obligations: [first,], },
          sourceBody: shell.body,
          archiveBody: ARCHIVE,
        },),).toThrow('coverage is incomplete');
      },
    },),
    it({
      name: 'REFUSES internally valid obligation substitution against manifest ledger digest',
      fn: async () => {
        const { shell, ledger, } = fixture();
        const first = ledger.obligations[0];
        const second = ledger.obligations[1];
        if ((first === undefined) || (second === undefined))
          throw new Error('ledger substitution fixture is incomplete');
        const manifest = manifestFor({
          ledger,
          shell,
          candidatePlan: [{ ordinal: 0, modelId: 'qwen3.6-flash' as never, priority: 0, },],
        },);
        const changedLedger: RealizationObligationLedger = {
          ...ledger,
          obligations: [
            withRelationEvidence({ ...first, sourceSpans: second.sourceSpans, }),
            withRelationEvidence({ ...second, sourceSpans: first.sourceSpans, }),
          ],
        };
        assertRealizationObligationLedger({
          ledger: changedLedger,
          sourceBody: shell.body,
          archiveBody: ARCHIVE,
        },);
        expect(() => assertRealizationManifest({
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          ledger: changedLedger,
          shell,
          archiveBody: ARCHIVE,
        },),).toThrow('manifest identity differs');
        const forgedManifest = createRealizationManifest({
          ledger: changedLedger,
          shell,
          archiveBody: ARCHIVE,
          candidatePlan: manifest.candidatePlan,
          verifierModelIds: manifest.verifierModelIds,
        },);
        expect(() => assertRealizationManifest({
          manifest: forgedManifest,
          expectedManifestDigest: manifest.manifestDigest,
          ledger: changedLedger,
          shell,
          archiveBody: ARCHIVE,
        },),).toThrow('manifest identity differs');
      },
    },),
    it({
      name: 'REFUSES stale realization binding during verifier admission',
      fn: async () => {
        const { ledger, shell, } = fixture();
        const candidate = admittedCandidate({ modelId: 'qwen3.6-flash', ordinal: 0, });
        const manifest = manifestFor({ ledger, shell, candidatePlan: candidatePlan([candidate,]), });
        const response = cleanResponse({ candidates: [candidate,], ledger, });
        const firstId = ledger.obligations[0]?.id ?? '';
        const secondId = ledger.obligations[1]?.id ?? '';
        const stale: RealizedCandidate = {
          ...candidate,
          realization: {
            ...candidate.realization,
            [firstId]: candidate.realization[secondId] ?? [],
          },
        };
        expect(() => admitRealizationVerifierResponse({
          response,
          ledger,
          candidates: [stale,],
          verifierModelId: 'minimax-m3' as never,
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          shell,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [],
        },),).toThrow();
        const slotKey = shell.slots[0]?.key ?? '';
        const staleSlots: RealizedCandidate = {
          ...candidate,
          slots: {
            ...candidate.slots,
            [slotKey]: `${candidate.slots[slotKey] ?? ''} changed`,
          },
        };
        expect(() => admitRealizationVerifierResponse({
          response,
          ledger,
          candidates: [staleSlots,],
          verifierModelId: 'minimax-m3' as never,
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          shell,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [],
        },),).toThrow('candidate binding differs');
        const extraKeys: RealizedCandidate = {
          ...candidate,
          slots: { ...candidate.slots, extra: 'not manifested', },
          realization: { ...candidate.realization, extra: [], },
        };
        expect(() => admitRealizationVerifierResponse({
          response,
          ledger,
          candidates: [extraKeys,],
          verifierModelId: 'minimax-m3' as never,
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          shell,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [],
        },),).toThrow('candidate keys differ');
      },
    },),
    it({
      name: 'REFUSES coherently redigested metadata and partial verifier candidate sets',
      fn: async () => {
        const { first, second, ledger, shell, manifest, } = admittedPair();
        const changedModel = 'qwen3.8-flash' as never;
        const forged: RealizedCandidate = {
          ...first,
          modelId: changedModel,
          candidateDigest: digest({ text: JSON.stringify({
            candidateId: first.candidateId,
            candidateOrdinal: first.candidateOrdinal,
            manifestDigest: first.manifestDigest,
            modelId: changedModel,
            priority: first.priority,
            documentDigest: first.documentDigest,
            slotDigest: first.slotDigest,
            realizationDigest: first.realizationDigest,
          },), }),
        };
        expect(() => admitRealizationVerifierResponse({
          response: cleanResponse({ candidates: [forged, second,], ledger, }),
          ledger,
          candidates: [forged, second,],
          verifierModelId: 'minimax-m3' as never,
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          shell,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [],
        },),).toThrow('candidate set authorization differs');
        expect(() => admitRealizationVerifierResponse({
          response: cleanResponse({ candidates: [first,], ledger, }),
          ledger,
          candidates: [first,],
          verifierModelId: 'minimax-m3' as never,
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          shell,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [],
        },),).toThrow('candidate set length differs');
      },
    },),
    it({
      name: 'REFUSES candidate model priority and manifest provenance mutation',
      fn: async () => {
        const { ledger, shell, } = fixture();
        const candidate = admittedCandidate({ modelId: 'qwen3.6-flash', ordinal: 0, });
        const manifest = manifestFor({ ledger, shell, candidatePlan: candidatePlan([candidate,]), });
        const variants: readonly RealizedCandidate[] = [
          { ...candidate, modelId: 'qwen3.7-plus' as never, },
          { ...candidate, priority: candidate.priority + 1, },
          { ...candidate, manifestDigest: '2'.repeat(64,), },
        ];
        for (const changed of variants) {
          expect(() => selectRealizationCandidate({
            candidates: [changed,],
            ballots: [],
            manifest,
            expectedManifestDigest: manifest.manifestDigest,
            ledger,
            shell,
            sourceText: SOURCE,
            archiveText: ARCHIVE,
            sourcePictures: [],
          },),).toThrow();
        }
        const wrongPlanManifest = manifestFor({
          ledger,
          shell,
          candidatePlan: [{ ordinal: 0, modelId: 'qwen3.7-plus' as never, priority: 0, },],
        },);
        expect(() => selectRealizationCandidate({
          candidates: [candidate,],
          ballots: [],
          manifest: wrongPlanManifest,
          expectedManifestDigest: wrongPlanManifest.manifestDigest,
          ledger,
          shell,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [],
        },),).toThrow('candidate set authorization differs');
      },
    },),
    it({
      name: 'REFUSES duplicate candidate aliases at independent selection boundary',
      fn: async () => {
        const { first, second, ledger, shell, manifest, } = admittedPair();
        expect(() => selectRealizationCandidate({
          candidates: [first, { ...second, candidateId: first.candidateId, },],
          ballots: [],
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          ledger,
          shell,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [],
        },),).toThrow('candidate alias differs');
      },
    },),
    it({
      name: 'treats forged partial and duplicate-identity ballots as abstentions',
      fn: async () => {
        const { first, second, ledger, shell, manifest, } = admittedPair();
        const response = cleanResponse({ candidates: [first, second,], ledger, });
        const valid = admitRealizationVerifierResponse({
          response,
          ledger,
          candidates: [first, second,],
          verifierModelId: 'minimax-m3' as never,
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          shell,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [],
        },);
        const stale = { ...valid, manifestDigest: '2'.repeat(64,), };
        const partial = {
          verifierModelId: 'kimi-k3' as never,
          manifestDigest: manifest.manifestDigest,
          response: { candidates: [], },
        } as never;
        const selected = selectRealizationCandidate({
          candidates: [first, second,],
          ballots: [valid, stale, partial,],
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          ledger,
          shell,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [],
        },);
        expect(selected.evidenceFloorMet,).toBe(false,);
        expect(selected.abstainingVerifierModelIds,).toEqual(['kimi-k3', 'minimax-m3', 'qwen3.8-flash',],);
      },
    },),
    it({
      name: 'requires distinct author and verifier identities and records abstention',
      fn: async () => {
        const { first, second, ledger, shell, manifest, } = admittedPair();
        const response = cleanResponse({ candidates: [first, second,], ledger, });
        expect(realizationVerifierResponseGuard({ ledger, candidates: [first, second,], })(response,),).toBe(true,);
        const ballots = ['minimax-m3', 'kimi-k3',].map(function ballot(modelId,) {
          return admitRealizationVerifierResponse({
            response,
            ledger,
            candidates: [first, second,],
            verifierModelId: modelId as never,
            manifest,
            expectedManifestDigest: manifest.manifestDigest,
            shell,
            sourceText: SOURCE,
            archiveText: ARCHIVE,
            sourcePictures: [],
          },);
        },);
        const selected = selectRealizationCandidate({
          candidates: [first, second,],
          ballots,
          manifest,
          expectedManifestDigest: manifest.manifestDigest,
          ledger,
          shell,
          sourceText: SOURCE,
          archiveText: ARCHIVE,
          sourcePictures: [],
        },);
        expect(selected.evidenceFloorMet,).toBe(true,);
        expect(selected.independenceScope,).toBe('distinct-author-and-verifier-model-identities-only',);
        expect(selected.abstainingVerifierModelIds,).toEqual(['qwen3.8-flash',],);
      },
    },),
  ],
},);
