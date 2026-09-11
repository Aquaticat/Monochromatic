import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  alterSharedNumber,
  buildReviewedFidelityReference,
  deleteOneSentence,
  FidelityReferenceError,
  type FidelityReferenceSpec,
  hashContent,
  insertBorrowedSentence,
  reviewedFidelityTrials,
  selectReviewedFidelitySpecs,
} from '../dist/final/node/index.mjs';
import { REVIEW_DONOR, REVIEW_REFERENCE, reviewedFixture, } from './fidelity-reference.test-fixture.ts';

/** Rebinds an invented unedited reference, including all expected damage hashes. */
function unedited(reference: string) {
  const fixture = reviewedFixture();
  const damages = [deleteOneSentence({ cleanText: reference }),
    insertBorrowedSentence({ cleanText: reference, donorTexts: [REVIEW_DONOR] }),
    alterSharedNumber({ cleanText: reference, sourceText: fixture.sourceFile })];
  const spec = { ...fixture.spec, archive: { startOffset: 0, endOffset: reference.length, hash: hashContent({ content: reference }) },
    referenceHash: hashContent({ content: reference }), referenceChars: reference.length, edits: [],
    donor: { startOffset: reference.length + 2, endOffset: reference.length + 2 + REVIEW_DONOR.length,
      hash: hashContent({ content: REVIEW_DONOR }) },
    damages: damages.map(damage => {
      if (damage.kind !== 'damaged') throw new Error('Fixture unexpectedly cannot be damaged');
      return { kind: damage.damageKind, hash: hashContent({ content: damage.damagedText }), changedChars: damage.changedChars };
    }) };
  return { sourceFile: fixture.sourceFile, archiveFile: `${reference}\n\n${REVIEW_DONOR}`, spec };
}

await describe({
  name: '',
  children: [
    it({
      name: 'verifies folded input, original-coordinate edits and every reviewed delta',
      fn: async () => {
        const fixture = reviewedFixture();
        const result = buildReviewedFidelityReference(fixture);
        expect(result.referenceText).toBe(REVIEW_REFERENCE);
        expect(result.damages.map(damage => damage.damageKind)).toEqual(['deletion', 'insertion', 'alteration']);
        expect(result.spec).toStrictEqual(fixture.spec);
        expect(result.spec).not.toBe(fixture.spec);
      },
    }),
    it({
      name: 'preserves an unedited reviewed reference exactly',
      fn: async () => {
        const result = buildReviewedFidelityReference(unedited(REVIEW_REFERENCE));
        expect(result.referenceText).toBe(REVIEW_REFERENCE);
      },
    }),
    it({
      name: 'sorts disjoint edits while keeping all offsets relative to the original folded slice',
      fn: async () => {
        const fixture = reviewedFixture();
        const result = buildReviewedFidelityReference({ ...fixture, spec: { ...fixture.spec, edits: fixture.spec.edits.toReversed() } });
        expect(result.referenceText).toBe(REVIEW_REFERENCE);
      },
    }),
    it({
      name: 'does not let later caller mutation rewrite verified provenance',
      fn: async () => {
        const fixture = reviewedFixture();
        const spec = { ...fixture.spec, edits: fixture.spec.edits.map(edit => ({ ...edit })) };
        const result = buildReviewedFidelityReference({ ...fixture, spec });
        spec.id = 'changed-after-verification';
        const [first,] = spec.edits;
        if (first) first.replacement = 'changed';
        expect(result.spec.id).toBe('invented-reference');
        expect(result.spec.edits[0]?.replacement).toBe('grey-and-white');
      },
    }),
    ...([
      { name: 'source hash drift', change: (spec: FidelityReferenceSpec) => ({ ...spec, source: { ...spec.source, hash: 'wrong' } }) },
      { name: 'negative source offset', change: (spec: FidelityReferenceSpec) => ({ ...spec, source: { ...spec.source, startOffset: -1 } }) },
      { name: 'fractional source offset with otherwise matching bytes', change: (spec: FidelityReferenceSpec) => ({ ...spec,
        source: { ...spec.source, startOffset: spec.source.startOffset + 0.5 } }) },
      { name: 'fractional source end with otherwise matching bytes', change: (spec: FidelityReferenceSpec) => ({ ...spec,
        source: { ...spec.source, endOffset: spec.source.endOffset + 0.5 } }) },
      { name: 'empty source span with matching hash', change: (spec: FidelityReferenceSpec) => ({ ...spec,
        source: { ...spec.source, endOffset: spec.source.startOffset, hash: hashContent({ content: '' }) },
        damages: spec.damages.filter(damage => damage.kind !== 'alteration') }) },
      { name: 'out-of-range donor end whose clamp would match the hash', change: (spec: FidelityReferenceSpec) => ({ ...spec,
        donor: { ...spec.donor, endOffset: spec.donor.endOffset + 1 } }) },
      { name: 'out-of-range archive span', change: (spec: FidelityReferenceSpec) => ({ ...spec, archive: { ...spec.archive, endOffset: 100_000 } }) },
      { name: 'archive hash drift', change: (spec: FidelityReferenceSpec) => ({ ...spec, archive: { ...spec.archive, hash: 'wrong' } }) },
      { name: 'reference hash drift', change: (spec: FidelityReferenceSpec) => ({ ...spec, referenceHash: 'wrong' }) },
      { name: 'reference length drift', change: (spec: FidelityReferenceSpec) => ({ ...spec, referenceChars: spec.referenceChars + 1 }) },
      { name: 'donor hash drift', change: (spec: FidelityReferenceSpec) => ({ ...spec, donor: { ...spec.donor, hash: 'wrong' } }) },
      { name: 'donor overlapping reference', change: (spec: FidelityReferenceSpec) => ({ ...spec, donor: spec.archive }) },
      { name: 'empty damage list', change: (spec: FidelityReferenceSpec) => ({ ...spec, damages: [] }) },
      { name: 'duplicate damage family', change: (spec: FidelityReferenceSpec) => ({ ...spec, damages: [...spec.damages, ...spec.damages] }) },
      { name: 'damage hash drift', change: (spec: FidelityReferenceSpec) => ({ ...spec, damages: spec.damages.map(damage => ({ ...damage, hash: 'wrong' })) }) },
      { name: 'damage count drift', change: (spec: FidelityReferenceSpec) => ({ ...spec, damages: spec.damages.map(damage => ({ ...damage, changedChars: damage.changedChars + 1 })) }) },
      { name: 'unknown damage family', change: (spec: FidelityReferenceSpec) => ({ ...spec,
        damages: spec.damages.slice(0, 1).map(damage => ({ ...damage, kind: 'unsupported' as never })) }) },
      { name: 'stale edit contents', change: (spec: FidelityReferenceSpec) => ({ ...spec, edits: spec.edits.map(edit => ({ ...edit, expectedHash: 'wrong' })) }) },
      { name: 'overlapping edits', change: (spec: FidelityReferenceSpec) => ({ ...spec, edits: [...spec.edits, ...spec.edits] }) },
      { name: 'missing edit author', change: (spec: FidelityReferenceSpec) => ({ ...spec, edits: spec.edits.map(edit => ({ ...edit, author: '' })) }) },
      { name: 'missing edit rationale', change: (spec: FidelityReferenceSpec) => ({ ...spec, edits: spec.edits.map(edit => ({ ...edit, rationale: '' })) }) },
      { name: 'missing review date', change: (spec: FidelityReferenceSpec) => ({ ...spec, reviewedOn: '' }) },
      { name: 'missing reference identity', change: (spec: FidelityReferenceSpec) => ({ ...spec, id: '' }) },
    ]).map(row => it({
      name: `refuses ${row.name} rather than silently relabeling archive text as gold`,
      fn: async () => {
        const fixture = reviewedFixture();
        expect(() => buildReviewedFidelityReference({ ...fixture, spec: row.change(fixture.spec) })).toThrow(FidelityReferenceError);
      },
    })),
    it({
      name: 'rejects a negative coordinate even when slice would recover the reviewed bytes',
      fn: async () => {
        const fixture = reviewedFixture();
        const source = { ...fixture.spec.source,
          startOffset: fixture.spec.source.startOffset - fixture.sourceFile.length };
        expect(fixture.sourceFile.slice(source.startOffset, source.endOffset))
          .toBe(fixture.sourceFile.slice(fixture.spec.source.startOffset, fixture.spec.source.endOffset));
        expect(() => buildReviewedFidelityReference({ ...fixture, spec: { ...fixture.spec, source } }))
          .toThrow(FidelityReferenceError);
      },
    }),
    it({
      name: 'rejects overlapping removals even when reconstruction and all damage hashes would still match',
      fn: async () => {
        const removed = 'very ';
        const original = REVIEW_REFERENCE.replace('quiet flat', `${removed}quiet flat`);
        const fixture = unedited(original);
        const reviewed = unedited(REVIEW_REFERENCE);
        const startOffset = original.indexOf(removed);
        expect(startOffset).toBeGreaterThanOrEqual(0);
        const edit = { startOffset, endOffset: startOffset + removed.length,
          expectedHash: hashContent({ content: removed }), replacement: '',
          author: 'fixture-author', rationale: 'Remove unsupported intensifier.' };
        const spec = { ...fixture.spec, referenceHash: reviewed.spec.referenceHash,
          referenceChars: reviewed.spec.referenceChars, damages: reviewed.spec.damages, edits: [edit] };
        expect(buildReviewedFidelityReference({ ...fixture, spec }).referenceText).toBe(REVIEW_REFERENCE);
        expect(() => buildReviewedFidelityReference({ ...fixture, spec: { ...spec, edits: [edit, edit] } }))
          .toThrow(FidelityReferenceError);
      },
    }),
    it({
      name: 'rejects an overlapping donor independently of insertion-damage hashing',
      fn: async () => {
        const fixture = reviewedFixture();
        const spec = { ...fixture.spec, damages: fixture.spec.damages.filter(damage => damage.kind !== 'insertion') };
        expect(buildReviewedFidelityReference({ ...fixture, spec }).damages).toHaveLength(2);
        expect(() => buildReviewedFidelityReference({ ...fixture, spec: { ...spec, donor: spec.archive } }))
          .toThrow(FidelityReferenceError);
      },
    }),
    it({
      name: 'enforces the natural length floor even with matching hashes and valid damage variants',
      fn: async () => {
        const short = REVIEW_REFERENCE.slice(0, REVIEW_REFERENCE.indexOf('She enjoyed'));
        const fixture = unedited(short);
        expect(short.length).toBeLessThan(400);
        expect(() => buildReviewedFidelityReference(fixture)).toThrow(FidelityReferenceError);
      },
    }),
    it({
      name: 'refuses an unavailable reviewed damage instead of dropping the family',
      fn: async () => {
        const fixture = reviewedFixture();
        const text = 'A cat slept. '.repeat(40);
        const spec = { ...fixture.spec, archive: { startOffset: 0, endOffset: text.length, hash: hashContent({ content: text }) },
          edits: [], referenceHash: hashContent({ content: text }), referenceChars: text.length,
          donor: { startOffset: text.length + 2, endOffset: text.length + 2 + REVIEW_DONOR.length, hash: hashContent({ content: REVIEW_DONOR }) } };
        expect(() => buildReviewedFidelityReference({ sourceFile: fixture.sourceFile, archiveFile: `${text}\n\n${REVIEW_DONOR}`, spec }))
          .toThrow(FidelityReferenceError);
      },
    }),
    it({
      name: 'constructs the fixed direction and position matrix without asserting singleton selection success',
      fn: async () => {
        const reference = buildReviewedFidelityReference(reviewedFixture());
        const rows = reviewedFidelityTrials({ references: [reference], damageKinds: ['deletion', 'insertion', 'alteration'] });
        expect(rows).toHaveLength(12);
        expect(rows.slice(0, 4).map(row => [row.trial.direction, row.trial.cleanFirst]))
          .toEqual([['preserve', true], ['preserve', false], ['replace', true], ['replace', false]]);
        expect(rows.every(row => (row.trial.cleanText === REVIEW_REFERENCE) && (row.trial.contextText === ''))).toBe(true);
        expect(reviewedFidelityTrials({ references: [reference], damageKinds: ['alteration'] })).toHaveLength(4);
        expect(() => reviewedFidelityTrials({ references: [{ ...reference,
          damages: reference.damages.filter(damage => damage.damageKind === 'deletion') }], damageKinds: ['alteration'] }))
          .toThrow(FidelityReferenceError);
        expect(() => reviewedFidelityTrials({ references: [{ ...reference,
          damages: reference.damages.filter(damage => damage.damageKind === 'deletion') }],
          damageKinds: ['deletion', 'alteration'] })).toThrow(FidelityReferenceError);
        expect(() => reviewedFidelityTrials({ references: [], damageKinds: ['deletion'] })).toThrow(FidelityReferenceError);
        expect(() => reviewedFidelityTrials({ references: [reference], damageKinds: [] })).toThrow(FidelityReferenceError);
        expect(() => reviewedFidelityTrials({ references: [reference], damageKinds: ['deletion', 'deletion'] })).toThrow(FidelityReferenceError);
      },
    }),
    it({
      name: 'selects only reviewed identities and preserves manifest order',
      fn: async () => {
        const { spec } = reviewedFixture();
        const second = { ...spec, id: 'second', entryId: 'second-cat' };
        expect(selectReviewedFidelitySpecs({ specs: [spec, second], onlyEntryIds: ['second-cat'] })).toEqual([second]);
        expect(() => selectReviewedFidelitySpecs({ specs: [], onlyEntryIds: [] })).toThrow(FidelityReferenceError);
        expect(() => selectReviewedFidelitySpecs({ specs: [spec, spec], onlyEntryIds: [] })).toThrow(FidelityReferenceError);
        expect(() => selectReviewedFidelitySpecs({ specs: [spec], onlyEntryIds: ['unreviewed'] })).toThrow(FidelityReferenceError);
      },
    }),
  ],
});
