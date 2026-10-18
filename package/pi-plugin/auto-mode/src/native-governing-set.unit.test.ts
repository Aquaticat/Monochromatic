/**
 Original governing source sets preserve duplicate-code ambiguity, list identity, and complete bounds. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createGoverningSet, createGoverningSource, governingBindingError, governingParser } from './native-governing-fixture.ts';

//region Equal source content and repeated literal codes never collapse original source membership.
await describe({
  name: '',
  children: [
    ...['AAA', 'BBB'].map(function secondCode(code) {
      return it({
        name: `retains independent original sources when the second code is ${code}`,
        fn: async function preservesSourceMembership() {
          /** Original sources retain distinct occurrence identities even when text matches. */
          const sources = Object.freeze([createGoverningSource('# Scope\n\nAAA: Original rule.'), createGoverningSource(`# Scope\n\n${code}: Original rule.`)]);
          /** The set composes original source indexes without merging text or code values. */
          const set = createGoverningSet({ readSources() { 
            return sources; 
          }, parse: governingParser.parse });
          /** Both original source handles remain independently selectable by identity. */
          const candidates = set.indexedCandidates();
          /** Contextual headings also retain separate source-owned aggregates. */
          const headings = set.indexedHeadingContextCandidates();
          assert.equal(Object.isFrozen(set), true);
          assert.equal(Object.isFrozen(candidates), true);
          assert.equal(Object.isFrozen(headings), true);
          assert.equal(candidates.length, 2);
          assert.equal(headings.length, 2);
          assert.notEqual(candidates[0], candidates[1]);
          assert.equal(set.indexedCandidates(), candidates);
          assert.equal(set.indexedHeadingContextCandidates(), headings);
          assert.deepEqual(set.indexedInstructionCandidates(), candidates);
          for (const [ordinal, handle] of candidates.entries()) {
            /** Augmented projections preserve each original source occurrence and ordinal. */
            const projection = set.read(handle);
            assert.equal(set.read(handle), projection);
            assert.equal(Object.isFrozen(projection), true);
            assert.equal(projection.sourceOrdinal, ordinal);
            assert.equal(projection.sourceOccurrence, sources[ordinal]?.occurrence);
            assert.equal(projection.sourceSHA256, sources[ordinal]?.sha256);
            assert.equal(projection.authorityEstablishedByIndex, false);
            assert.equal(projection.semanticQualification, 'not-established');
          }
          /** Set inspection retains original source order without sharing mutable arrays. */
          const snapshots = set.inspect();
          assert.equal(Object.isFrozen(snapshots), true);
          assert.equal(snapshots.length, 2);
          for (const [ordinal, snapshot] of snapshots.entries()) {
            assert.equal(Object.isFrozen(snapshot), true);
            assert.equal(snapshot.sourceOrdinal, ordinal);
            assert.equal(snapshot.sourceOccurrence, sources[ordinal]?.occurrence);
            assert.equal(snapshot.headingContextCandidate, headings[ordinal]);
          }
          if (code === 'AAA') assert.throws(function ambiguousOriginalCode() { 
            set.select('AAA'); 
          }, governingBindingError('Rule code occurs in multiple sources; select its original clause handle'));
          else {
            assert.equal(set.select('AAA'), candidates[0]);
            assert.equal(set.select('BBB'), candidates[1]);
          }
          assert.throws(function missingCode() { 
            set.select('ZZZ'); 
          }, governingBindingError('Requested clause is not in the original source set'));
          assert.throws(function foreignClause() { 
            set.read({}); 
          }, governingBindingError('Clause handle is not owned by this original source set'));
        },
      });
    }),
    ...['changed', 'throwing'].map(function retirement(kind) {
      return it({
        name: `permanently retires ${kind} original source-list reads`,
        fn: async function retainsSourceListFailure() {
          /** Exact list identity belongs to the original enclosing source owner. */
          const original = Object.freeze([createGoverningSource('AAA: Original rule.')]);
          /** Reader failure remains the first retained set failure by identity. */
          const failure = new Error('original source-list reader failed');
          /** The reader can replace equal lists or throw independently. */
          const control = { sources: original, failing: false, reads: 0 };
          /** The original set must not recover after either kind of invalidation. */
          const set = createGoverningSet({ readSources() {
            control.reads += 1;
            if (control.failing) throw failure;
            return control.sources;
          }, parse: governingParser.parse });
          /** Owned membership is retained before source-list eligibility ends. */
          const handle = set.select('AAA');
          if (kind === 'changed') control.sources = Object.freeze([...original]);
          else control.failing = true;
          assert.throws(function staleOriginalSet() { 
            set.read(handle); 
          }, function originalFailure(error) {
            return kind === 'throwing' ? error === failure : governingBindingError('Original governing source list changed')(error);
          });
          /** Retired operations must not call the source reader again after apparent recovery. */
          const {reads} = control;
          control.sources = original;
          control.failing = false;
          assert.throws(function recoveredSetRead() { 
            set.indexedCandidates(); 
          }, governingBindingError('Original governing source set lost eligibility'));
          assert.throws(function retiredSetInspection() { 
            set.inspect(); 
          }, governingBindingError('Original governing source set lost eligibility'));
          assert.equal(control.reads, reads);
          assert.throws(function foreignBeforeRetirement() { 
            set.read({}); 
          }, governingBindingError('Clause handle is not owned by this original source set'));
        },
      });
    }),
    //endregion
    //region Complete source lists preserve immutable and unique occurrence membership.
    ...['mutable', 'empty', 'nonarray', 'repeated'].map(function invalidList(kind) {
      return it({
        name: `rejects ${kind} original source lists`,
        fn: async function requiresOriginalSourceList() {
          /** One valid original source isolates list admission from source indexing. */
          const source = createGoverningSource('AAA: Original rule.');
          /** Duplicate source occurrences remain invalid even when their record objects differ. */
          const sources = kind === 'mutable' ? [source]
            : kind === 'empty' ? Object.freeze([])
            : kind === 'nonarray' ? Object.freeze({ 0: source, length: 1 })
            : Object.freeze([source, Object.freeze({ ...source })]);
          assert.throws(function invalidOriginalList() {
            createGoverningSet({ readSources() { 
              return sources; 
            }, parse: governingParser.parse });
          }, governingBindingError(kind === 'repeated' ? 'Original governing source occurrence is repeated' : 'Original governing sources require a nonempty immutable source list'));
        },
      });
    }),
    it({
      name: 'admits original empty sources beyond the former count ceiling without inventing candidates',
      fn: async function admitsExactSourceBound() {
        /** Empty Markdown produces no clauses but still consumes original source-list membership. */
        const sources = Object.freeze(Array.from({ length: 129 }, function originalEmptySource() { 
          return createGoverningSource(''); 
        }));
        /** Real indexes preserve every source occurrence. */
        const set = createGoverningSet({ readSources() { 
          return sources; 
        }, parse: governingParser.parse });
        assert.equal(set.inspect().length, 129);
        assert.equal(set.indexedInstructionCandidates().length, 0);
      },
    }),
    it({
      name: 'retains combined clauses beyond the former aggregate ceiling',
      fn: async function boundsCombinedMembership() {
        /** Each source stays independently inside the per-source clause bound. */
        const content = Array.from({ length: 256 }, function originalParagraph(_value, index) { 
          return `Original prose ${index}.`; 
        }).join('\n\n');
        /** Equal text still creates distinct original occurrence membership. */
        const sources = Object.freeze([createGoverningSource(content), createGoverningSource(content)]);
        /** Complete set enumeration observes both independent original indexes. */
        const set = createGoverningSet({ readSources() { 
          return sources; 
        }, parse: governingParser.parse });
        assert.equal(set.indexedInstructionCandidates().length, 512);
        assert.equal(set.indexedCandidates().length, 0);
        /** One extra independent source clause exceeds only the combined bound. */
        const exceeded = Object.freeze([...sources, createGoverningSource('One more original clause.')]);
        const expanded = createGoverningSet({ readSources() {
            return exceeded; 
          }, parse: governingParser.parse });
        assert.equal(expanded.indexedInstructionCandidates().length, 513);
      },
    }),
    //endregion
  ],
});
