/**
 Governing-source admission checks exact bytes, immutable records, and bounded structural membership. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createGoverningBindings, createGoverningSource, GoverningBindingError, governingBindingError, governingParser } from './native-governing-fixture.ts';

//region Original source admission retains the existing reader and representation guards.
await describe({
  name: '',
  children: [
    it({
      name: 'retains original error message and cause with a stable operation category',
      fn: async function preservesErrorConstruction() {
        /** Original cause identity must survive both ordinary and derived construction. */
        const cause = new Error('original binding cause');
        /** Ordinary construction retains the exported original error category. */
        const error = new GoverningBindingError('original binding diagnostic', { cause });
        assert.equal(error.name, 'GoverningRuleBindingError');
        assert.equal(error.message, 'original binding diagnostic');
        assert.equal(error.cause, cause);
        /** A different new target cannot replace the stable operation category. */
        const derived: unknown = Reflect.construct(GoverningBindingError, ['derived binding diagnostic', { cause }], TypeError);
        assert.ok(derived instanceof TypeError);
        assert.equal(derived.name, 'GoverningRuleBindingError');
        assert.equal(derived.message, 'derived binding diagnostic');
        assert.equal(derived.cause, cause);
      },
    }),
    ...[null, undefined, false, 0, '', 'unowned text', {},
      { content: 'AAA: Original rule.', sha256: 'unowned' },
      Object.freeze({ content: 2, sha256: 'unowned' }),
      Object.freeze({ content: 'AAA: Original rule.', sha256: 2 }),
    ].map(function invalidSource(source, index) {
      return it({
        name: `rejects unavailable or mutable original source ${index}`,
        fn: async function requiresOwnedSource() {
          assert.throws(function bindInvalidSource() {
            createGoverningBindings({ readSource() { 
              return source; 
            }, parse: governingParser.parse });
          }, governingBindingError('Governing-source reader returned no owned immutable text occurrence'));
        },
      });
    }),
    ...['reader', 'parser'].map(function missingCapability(kind) {
      return it({
        name: `requires the original ${kind} capability`,
        fn: async function requiresOriginalCapability() {
          /** Valid original source bytes isolate the missing capability. */
          const source = createGoverningSource('AAA: Original rule.');
          assert.throws(function missingSourceCapability() {
            createGoverningBindings({ readSource: kind === 'reader' ? undefined : function readOriginalSource() { 
              return source; 
            }, parse: kind === 'parser' ? undefined : governingParser.parse });
          }, governingBindingError('Original governing-source reader and qualified Markdown parser are required'));
        },
      });
    }),
    ...['markdown', 'native-json'].map(function changedDigest(profile) {
      return it({
        name: `rejects ${profile} bytes differing from the original selected source digest`,
        fn: async function requiresOriginalDigest() {
          /** The retained source advertises a digest from different original bytes. */
          const source = Object.freeze({
            ...createGoverningSource('AAA: Original rule.'),
            sha256: createGoverningSource('BBB: Other bytes.').sha256,
            ...(profile === 'native-json' ? { kind: 'native-run-handler-message-input', contentFormat: 'native-content-json' } : {}),
          });
          assert.throws(function mismatchedOriginalBytes() {
            createGoverningBindings({ readSource() { 
              return source; 
            }, parse: governingParser.parse });
          }, governingBindingError('Indexed policy bytes differ from the original selected source'));
        },
      });
    }),
    ...[null, undefined, 1, 'AAA', Object.freeze({}), Object.freeze([])].map(function foreignHandle(handle, index) {
      return it({
        name: `rejects foreign original candidate handle ${index}`,
        fn: async function requiresOriginalMembership() {
          /** A legitimate indexed clause gives the negative check a live positive control. */
          const source = createGoverningSource('AAA: Original rule.');
          /** Foreign values cannot borrow that original clause's membership. */
          const binding = createGoverningBindings({ readSource() { 
            return source; 
          }, parse: governingParser.parse });
          assert.equal(binding.read(binding.select('AAA')).text, source.content);
          assert.throws(function foreignOriginalClause() { 
            binding.read(handle); 
          }, governingBindingError('Clause handle is not owned by this original governing-source binding'));
          assert.throws(function absentOriginalCode() { 
            binding.select(handle === 'AAA' ? 'BBB' : handle); 
          }, governingBindingError('Requested clause is not in the original indexed policy'));
        },
      });
    }),
    it({
      name: 'counts retained prose and orphan headings toward the exact 512-clause bound',
      fn: async function boundsEveryRetainedSubject() {
        /** Distinct ordinary paragraphs remain unclassified structural subjects. */
        const content = Array.from({ length: 511 }, function originalParagraph(_value, index) { 
          return `Original prose ${index}.`; 
        }).join('\n\n');
        /** The final orphan heading consumes the last original candidate slot. */
        const source = createGoverningSource(`${content}\n\n# Orphan heading`);
        /** Admission at the exact bound is the positive control for the rejection. */
        const binding = createGoverningBindings({ readSource() { 
          return source; 
        }, parse: governingParser.parse });
        assert.equal(binding.indexedCandidates().length, 0);
        assert.equal(binding.indexedInstructionCandidates().length, 512);
        assert.equal(binding.inspect().unclassified.length, 512);
        /** A second orphan heading exceeds the same original profile. */
        const exceeded = createGoverningSource(`${source.content}\n\n## Another orphan heading`);
        assert.throws(function tooManyOriginalSubjects() {
          createGoverningBindings({ readSource() { 
            return exceeded; 
          }, parse: governingParser.parse });
        }, governingBindingError('Policy clause count exceeds the original question binding profile'));
      },
    }),
    it({
      name: 'rejects a source replaced during original parser construction',
      fn: async function checksCurrentnessBeforePublication() {
        /** Parser execution is observable before the final original source check. */
        const control = { source: createGoverningSource('AAA: Original rule.') };
        assert.throws(function changedWhileIndexing() {
          createGoverningBindings({ readSource() { 
            return control.source; 
          }, parse(input: Readonly<{ source: string; mdx: boolean }>) {
            control.source = Object.freeze({ ...control.source });
            return governingParser.parse(input);
          } });
        }, governingBindingError('Governing-rule binding is no longer current'));
      },
    }),
  ],
});
//endregion
