import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';

import {
  type buildImmutableShell,
  realizationAuthorResponseGuard,
  realizationVerifierResponseGuard,
  type RealizationObligation,
  type RealizationObligationLedger,
  type RealizedCandidate} from '../dist/final/node/prototype-realization.mjs';
import {
  assertRealizationEnvelopesFit,
  measureRealizationEnvelopes,
  realizationEnvelopeWires,
} from '../dist/final/node/prototype-realization-envelope.mjs';

/** Pinned Carena source-slot UTF-16 lengths without restricted wording. */
const CARENA_SLOT_SOURCE_LENGTHS = [
  4,
  24,
  89,
  226,
  241,
  268,
  148,
  534,
  734,
  342,
  439,
  396,
  189,
  13,
  533,
  407,
  56,
  211,
  24,
  10,
  77,
  2,
  93,
] as const;

/** Builds wording-free immutable shell with pinned slot shape. */
function carenaEnvelopeShell(): ReturnType<typeof buildImmutableShell> {
  const slots = CARENA_SLOT_SOURCE_LENGTHS.map(function slot(sourceLength, index,) {
    const startOffset = CARENA_SLOT_SOURCE_LENGTHS.slice(0, index,)
      .reduce(function sum(total, length,) { return total + length; }, 0,);
    return {
      key: `s${String(index,)}`,
      kind: 'text' as const,
      parentKind: 'paragraph' as const,
      source: '字'.repeat(sourceLength,),
      startOffset,
      endOffset: startOffset + sourceLength,
    };
  },);
  const body = slots.map(function source(slot,) { return slot.source; }).join('',);
  return {
    frontMatter: '---\nname: Fixture\n---\n',
    body,
    slots,
    lockedRanges: [],
    controlDocument: body,
    shellDigest: 'a'.repeat(64,),
  };
}

/** Creates one wording-free obligation row used only by wire serializer. */
function envelopeObligation({ kind, index, }: {
  readonly kind: 'clause' | 'relation';
  readonly index: number;
}): RealizationObligation {
  return {
    id: `${kind}-${String(index,).padStart(3, '0',)}`,
    kind,
    sourceSpans: [],
    relationEndpoints: [],
    allowedTargetSlotKeys: ['s0',],
    targetCardinality: 'one-or-more',
    authority: 'source',
    evidenceDigest: 'b'.repeat(64,),
  };
}

/** Builds pinned obligation counts without retaining corpus language. */
function carenaEnvelopeLedger(): RealizationObligationLedger {
  const clauses = Array.from({ length: 112, }, function clause(_value, index,) {
    return envelopeObligation({ kind: 'clause', index, });
  },);
  const relations = Array.from({ length: 22, }, function relation(_value, index,) {
    return envelopeObligation({ kind: 'relation', index, });
  },);
  return {
    offsetEncoding: 'utf16-code-unit',
    rangeConvention: 'half-open',
    lineEndings: 'lf',
    digestAlgorithm: 'sha256',
    shellDigest: 'a'.repeat(64,),
    sourceBodyDigest: 'c'.repeat(64,),
    archiveBodyDigest: 'd'.repeat(64,),
    sourceSlots: [],
    obligations: [...clauses, ...relations,],
  };
}

/** Creates anonymous candidate bindings matching envelope verifier aliases. */
function envelopeCandidates(): readonly RealizedCandidate[] {
  return Array.from({ length: 4, }, function candidate(_value, index,) {
    return {
      candidateId: `candidate-${String(index,).padStart(16, '0',)}`,
      candidateOrdinal: index,
      manifestDigest: 'a'.repeat(64,),
      modelId: 'hf:Qwen/Qwen3.8-27B',
      priority: index,
      document: '',
      documentDigest: 'b'.repeat(64,),
      slotDigest: 'c'.repeat(64,),
      realizationDigest: 'd'.repeat(64,),
      candidateDigest: String(index,).repeat(64,),
      slots: {},
      realization: {},
    };
  },);
}

await describe({
  name: 'Candidate G realization envelope',
  children: [
    it({
      name: 'rejects pinned graph whose compact upper stress witnesses exceed output estimate',
      fn: async () => {
        const shell = carenaEnvelopeShell();
        const ledger = carenaEnvelopeLedger();
        const candidates = envelopeCandidates();
        const report = measureRealizationEnvelopes({ shell, ledger, });
        const wires = realizationEnvelopeWires({ shell, ledger, });
        const authorGuard = realizationAuthorResponseGuard({ shell, ledger, });
        const verifierGuard = realizationVerifierResponseGuard({ ledger, candidates, });
        expect(
          authorGuard(JSON.parse(wires.authorLowerWitnessText,),),
        ).toBe(true,);
        expect(
          authorGuard(JSON.parse(wires.authorUpperStressWitnessText,),),
        ).toBe(true,);
        expect(
          verifierGuard(JSON.parse(wires.verifierLowerWitnessText,),),
        ).toBe(true,);
        expect(
          verifierGuard(JSON.parse(wires.verifierUpperStressWitnessText,),),
        ).toBe(true,);
        expect(report.shellSlotCount,).toBe(23,);
        expect(report.obligationCount,).toBe(134,);
        expect(report.authorSchemaBytes,).toBe(2_994,);
        expect(report.verifierSchemaBytes,).toBe(7_397,);
        expect(report.authorLowerWitness.bytes,).toBe(7_294,);
        expect(report.authorUpperStressWitness.bytes,).toBe(2_820_201,);
        expect(report.verifierLowerWitness.bytes,).toBe(93_488,);
        expect(report.verifierUpperStressWitness.bytes,).toBe(437_076,);
        expect(report.authorLowerWitness.estimatedHeadroomTokens,).toBeGreaterThan(0,);
        expect(report.verifierLowerWitness.estimatedHeadroomTokens,).toBeGreaterThan(0,);
        expect(report.authorUpperStressWitness.estimatedHeadroomTokens,).toBeLessThan(0,);
        expect(report.verifierUpperStressWitness.estimatedHeadroomTokens,).toBeLessThan(0,);
        expect(() => assertRealizationEnvelopesFit({ report, }),)
          .toThrow('upper stress wire exceeds project output ceiling');
      },
    },),
  ],
},);
