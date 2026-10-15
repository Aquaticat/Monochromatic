/**
 Built governing-source consumers retain original intervals, identities, and invalidation diagnostics. @module
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createGoverningBindings, createGoverningSource, governingBindingError, governingParser } from './native-governing-fixture.ts';

//region Original structural subjects preserve source coordinates without instruction qualification.
await describe({
  name: '',
  children: [
    it({
      name: 'retains source-order clauses and independent contextual headings with exact original identity',
      fn: async function retainsOriginalIntervals() {
        /** Astral source text makes incorrect code-point offsets observable. */
        const source = createGoverningSource('# Parent\n\nAAA: Read 🐈 file.\n\nPlain interval.\n\n## Child\n\nBBB: Second rule.\n\n## Orphan\n');
        /** The built parser and original source reader produce the real structural binding. */
        const binding = createGoverningBindings({ readSource() { return source; }, parse: governingParser.parse });
        /** Tagged candidates retain their own literal code order. */
        const tagged = binding.indexedCandidates();
        /** Complete subjects also retain unclassified prose and an orphan heading. */
        const candidates = binding.indexedInstructionCandidates();
        /** A separate aggregate exposes contextual headings without turning them into clauses. */
        const headings = binding.indexedHeadingContextCandidates();
        assert.equal(Object.isFrozen(binding), true);
        assert.equal(Object.isFrozen(tagged), true);
        assert.equal(Object.isFrozen(candidates), true);
        assert.equal(Object.isFrozen(headings), true);
        assert.equal(binding.indexedCandidates(), tagged);
        assert.equal(binding.indexedInstructionCandidates(), candidates);
        assert.equal(binding.indexedHeadingContextCandidates(), headings);
        assert.equal(tagged.length, 2);
        assert.equal(candidates.length, 4);
        assert.equal(headings.length, 1);
        assert.equal(binding.select('AAA'), tagged[0]);
        assert.equal(binding.select('BBB'), tagged[1]);
        assert.deepEqual(candidates.map(function originalText(handle) { return binding.read(handle).text; }), ['AAA: Read 🐈 file.', 'Plain interval.', 'BBB: Second rule.', '## Orphan']);
        for (const handle of candidates) {
          /** Each read returns the same frozen original projection. */
          const projection = binding.read(handle);
          assert.equal(binding.read(handle), projection);
          assert.equal(Object.isFrozen(handle), true);
          assert.equal(Object.isFrozen(projection), true);
          assert.equal(Object.isFrozen(projection.headings), true);
          assert.equal(projection.sourceOccurrence, source.occurrence);
          assert.equal(projection.sourceSHA256, source.sha256);
          assert.equal(projection.authorityEstablishedByIndex, false);
          assert.equal(projection.semanticQualification, 'not-established');
          assert.ok(projection.text !== undefined);
          assert.equal(projection.start, source.content.indexOf(projection.text));
          assert.equal(projection.end, source.content.indexOf(projection.text) + projection.text.length);
          assert.equal(projection.textSHA256, createHash('sha256').update(projection.text).digest('hex'));
        }
        assert.equal(Object.hasOwn(binding.read(tagged[0]), 'kind'), false);
        assert.deepEqual(binding.read(candidates[3]).headings, ['# Parent']);
        /** Context aggregate and diagnostics must share the same original heading projection array. */
        const snapshot = binding.inspect();
        /** The contextual aggregate has no clause interval or literal code. */
        const context = binding.read(headings[0]);
        assert.equal(context.kind, 'source-heading-context');
        assert.equal(Object.hasOwn(context, 'start'), false);
        assert.equal(context.headings, snapshot.contextualHeadings);
        assert.deepEqual(snapshot.contextualHeadings.map(function headingText(heading) { return heading.text; }), ['# Parent', '## Child']);
        assert.equal(snapshot.headingContextCandidate, headings[0]);
        assert.equal(snapshot.instructionCandidates, candidates);
        assert.deepEqual(snapshot.codes, ['AAA', 'BBB']);
        assert.deepEqual(snapshot.unclassified.map(function retainedCandidate(entry) { return entry.candidate; }), [candidates[1], candidates[3]]);
        assert.equal(snapshot.structuralCoverage, 'unclassified-nodes-retained');
        assert.equal(snapshot.stale, false);
        assert.equal(snapshot.failure, undefined);
        assert.equal(Object.hasOwn(snapshot, 'failure'), true);
        assert.equal(Object.isFrozen(snapshot), true);
        assert.equal(Object.isFrozen(snapshot.codes), true);
        assert.equal(Object.isFrozen(snapshot.unclassified), true);
        assert.throws(function copiedCandidate() { binding.read({ ...tagged[0] }); }, governingBindingError('Clause handle is not owned by this original governing-source binding'));
      },
    }),
    it({
      name: 'retains native content JSON as one unclassified interval without invoking Markdown parsing',
      fn: async function preservesNativeContentProfile() {
        /** Text inside native JSON must not be interpreted as a policy tag. */
        const source = Object.freeze({ ...createGoverningSource('[{"type":"text","text":"AAA: retained native text"}]'), kind: 'native-run-handler-message-input', contentFormat: 'native-content-json' });
        /** Parser invocation would prove the native representation boundary was lost. */
        const reads = { parse: 0 };
        /** The parser is required as a capability even when this source profile bypasses it. */
        const binding = createGoverningBindings({ readSource() { return source; }, parse(input: Readonly<{ source: string; mdx: boolean }>) { reads.parse += 1; return governingParser.parse(input); } });
        assert.equal(reads.parse, 0);
        assert.equal(binding.indexedCandidates().length, 0);
        assert.equal(binding.indexedInstructionCandidates().length, 1);
        assert.equal(binding.indexedHeadingContextCandidates().length, 0);
        /** Native content remains exact original evidence without extracted instruction status. */
        const projection = binding.read(binding.indexedInstructionCandidates()[0]);
        assert.equal(projection.kind, 'unclassified-source-span');
        assert.equal(projection.nodeType, 'native-content-json');
        assert.equal(projection.text, source.content);
        assert.equal(projection.start, 0);
        assert.equal(projection.end, source.content.length);
        assert.deepEqual(projection.headings, []);
        assert.equal(binding.inspect().structuralCoverage, 'unclassified-nodes-retained');
      },
    }),
    ...['', 'AAA: One original tagged rule.'].map(function completeSource(content, index) {
      return it({
        name: `retains complete structural coverage without contextual headings ${index}`,
        fn: async function retainsAbsentHeadingContext() {
          /** Both empty and fully tagged original Markdown have no unclassified spans. */
          const source = createGoverningSource(content);
          /** The original qualified parser determines the complete source index. */
          const binding = createGoverningBindings({ readSource() { return source; }, parse: governingParser.parse });
          assert.equal(binding.indexedInstructionCandidates().length, content === '' ? 0 : 1);
          assert.equal(binding.inspect().structuralCoverage, 'all-top-level-nodes-indexed');
          assert.equal(binding.inspect().headingContextCandidate, undefined);
          assert.equal(Object.hasOwn(binding.inspect(), 'headingContextCandidate'), true);
        },
      });
    }),
    //endregion
    //region Original source invalidation is permanent while diagnostic inspection remains retained-only.
    ...['changed', 'throwing'].map(function invalidation(kind) {
      return it({
        name: `permanently invalidates ${kind} source reads and retains the original failure`,
        fn: async function retainsSourceFailure() {
          /** Original source identity cannot be recovered by returning it after a failed read. */
          const original = createGoverningSource('AAA: Original rule.');
          /** A reader-thrown failure must remain the exact retained cause. */
          const failure = new Error('original source reader failed');
          /** Source replacement and reader failure are independently controlled. */
          const control = { source: original, failing: false, reads: 0 };
          /** Read counts distinguish retained inspection from a fresh source read. */
          const binding = createGoverningBindings({ readSource() {
            control.reads += 1;
            if (control.failing) throw failure;
            return control.source;
          }, parse: governingParser.parse });
          /** Existing membership remains retained after source eligibility is lost. */
          const handle = binding.select('AAA');
          if (kind === 'changed') control.source = Object.freeze({ ...original });
          else control.failing = true;
          assert.throws(function invalidatedRead() { binding.read(handle); }, governingBindingError('Governing-rule binding is no longer current'));
          /** Diagnostic inspection itself must not invoke the unavailable source reader. */
          const reads = control.reads;
          /** The first source failure remains available without replacing its cause. */
          const snapshot = binding.inspect();
          assert.equal(control.reads, reads);
          assert.equal(snapshot.stale, true);
          assert.ok(Error.isError(snapshot.failure));
          if (kind === 'throwing') assert.equal(snapshot.failure, failure);
          else assert.equal(snapshot.failure.message, 'Original governing-source occurrence changed');
          control.source = original;
          control.failing = false;
          assert.throws(function recoveredRead() { binding.read(handle); }, governingBindingError('Original governing-rule source was already invalidated'));
          assert.equal(control.reads, reads);
          assert.equal(binding.inspect().failure, snapshot.failure);
          assert.throws(function foreignBeforeStaleness() { binding.read({}); }, governingBindingError('Clause handle is not owned by this original governing-source binding'));
        },
      });
    }),
    //endregion
  ],
});
