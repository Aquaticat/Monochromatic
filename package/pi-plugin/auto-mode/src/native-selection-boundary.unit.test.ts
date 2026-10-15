/**
 Selection input guards preserve original membership without consuming failed issuance. @module
 */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createSelectionBinding, createSelectionFixture, selectionError } from './native-selection-fixture.ts';

//region Selection arrays must carry ordinary dense own data membership.
await describe({
  name: '',
  children: [
    ...['nonarray', 'empty', 'sparse', 'extra-key', 'symbol-key', 'prototype', 'accessor', 'hidden', 'duplicate', 'foreign'].map(function invalidSelection(kind) {
      return it({
        name: `rejects ${kind} membership without issuing its original claim`,
        fn: async function rejectsMalformedMembership() {
          /** Fresh original ownership isolates the selected malformed array condition. */
          const selection = createSelectionFixture();
          /** Invalid issuance must leave this original claim unissued. */
          const claim = selection.declare({ definitionId: 'first', bindingHandle: createSelectionBinding() });
          /** Getter counts prove validation inspects descriptors without reading accessor values. */
          const reads = { count: 0 };
          /** Each mutation targets a separate ordinary-array admission condition. */
          const input: unknown[] = [claim];
          if (kind === 'empty') input.length = 0;
          if (kind === 'sparse') input.length = 2;
          if (kind === 'extra-key') Object.defineProperty(input, 'extra', { value: true });
          if (kind === 'symbol-key') Object.defineProperty(input, Symbol('unexpected selection member'), { value: true });
          if (kind === 'prototype') Object.setPrototypeOf(input, Object.prototype);
          if (kind === 'accessor') Object.defineProperty(input, '0', { get() { 
            reads.count += 1;
          return claim; 
          }, enumerable: true });
          if (kind === 'hidden') Object.defineProperty(input, '0', { value: claim, enumerable: false });
          if (kind === 'duplicate') input.push(claim);
          if (kind === 'foreign') input[0] = Object.freeze({});
          /** Exact diagnostics ensure the expected guard, rather than an incidental failure, runs. */
          const message = (kind === 'accessor') || (kind === 'hidden')
            ? 'Question batch has an accessor, hidden member or missing member'
            : kind === 'duplicate' ? 'Question batch repeats a claim'
            : kind === 'foreign' ? 'Claim handle is not owned by this judgment'
            : 'Question batch needs an ordinary dense claim array within the declared bound';
          assert.throws(function issueMalformedArray() { 
            selection.issue(kind === 'nonarray' ? { 0: claim, length: 1 } : input); 
          }, selectionError(message));
          assert.equal(reads.count, 0);
          assert.equal(selection.inspectClaim(claim).issued, false);
          assert.equal(selection.requestFor(selection.issue([claim])).questions.length, 1);
        },
      });
    }),
    ...[null, undefined, 1, 'missing', Object.freeze({})].map(function missingDefinition(definitionId, index) {
      return it({
        name: `rejects unpinned definition ${index} before resolving a binding`,
        fn: async function requiresPinnedDefinition() {
          /** Resolver invocation would reveal ordering drift at catalog admission. */
          const reads = { count: 0 };
          /** Catalog construction admits the capability without invoking it. */
          const selection = createSelectionFixture({ resolveBinding(handle) { 
            reads.count += 1;
          return handle; 
          } });
          assert.throws(function declareUnknown() { 
            selection.declare({ definitionId, bindingHandle: createSelectionBinding() }); 
          }, selectionError('Selected question definition is not in the pinned catalog'));
          assert.equal(reads.count, 0);
        },
      });
    }),
    ...[null, undefined, 1, {}, Object.freeze({}), Object.freeze({ identity: {}, projection: 'mutable identity' }), Object.freeze({ identity: Object.freeze({}) })].map(function invalidBinding(binding, index) {
      return it({
        name: `rejects invalid resolver record ${index}`,
        fn: async function requiresImmutableOccurrence() {
          /** Runtime resolver output remains untrusted even with typed selection ownership. */
          const selection = createSelectionFixture();
          assert.throws(function declareInvalidBinding() { 
            selection.declare({ definitionId: 'first', bindingHandle: binding }); 
          }, selectionError('Binding resolver did not return an immutable owned occurrence'));
          assert.equal(selection.inspectClaim(selection.declare({ definitionId: 'first', bindingHandle: createSelectionBinding() })).issued, false);
        },
      });
    }),
    //endregion
    //region Fixed bounds cover total declarations, per-request membership, batches, and UTF-8 bytes.
    it({
      name: 'admits exactly 1536 declarations and three 512-claim batches',
      fn: async function enforcesOriginalCountBounds() {
        /** One judgment retains the entire declared profile. */
        const selection = createSelectionFixture();
        /** Unique immutable identities make every declaration independently count. */
        const bindings = Array.from({ length: 1_536 }, function originalOccurrence() { 
          return createSelectionBinding(); 
        });
        /** Claim declarations stay canonical at the total bound. */
        const claims = bindings.map(function originalClaim(bindingHandle) { 
          return selection.declare({ definitionId: 'first', bindingHandle }); 
        });
        assert.equal(selection.declare({ definitionId: 'first', bindingHandle: bindings[0] }), claims[0]);
        assert.throws(function extraClaim() { 
          selection.declare({ definitionId: 'first', bindingHandle: createSelectionBinding() }); 
        }, selectionError('Judgment exceeds the declared total claim bound'));
        assert.throws(function oversizedBatch() { 
          selection.issue(claims.slice(0, 513)); 
        }, selectionError('Question batch needs an ordinary dense claim array within the declared bound'));
        for (const offset of [0, 512, 1_024]) {
          /** Every maximum-sized batch remains issuable after a failed oversized attempt. */
          const batch = selection.issue(claims.slice(offset, offset + 512));
          assert.equal(selection.requestFor(batch).questions.length, 512);
        }
        assert.throws(function fourthBatch() { 
          selection.issue([claims[0]]); 
        }, selectionError('Judgment exceeds the declared question batch bound'));
      },
    }),
    it({
      name: 'rejects a fourth batch containing an otherwise unissued claim',
      fn: async function enforcesBatchCountIndependently() {
        /** Four declared claims isolate batch count from claim reuse. */
        const selection = createSelectionFixture();
        /** Original independent membership stays within the declaration cap. */
        const claims = Array.from({ length: 4 }, function originalClaim() { 
          return selection.declare({ definitionId: 'first', bindingHandle: createSelectionBinding() }); 
        });
        for (const claim of claims.slice(0, 3)) selection.issue([claim]);
        assert.throws(function fourthOriginalBatch() { 
          selection.issue([claims[3]]); 
        }, selectionError('Judgment exceeds the declared question batch bound'));
        assert.equal(selection.inspectClaim(claims[3]).issued, false);
      },
    }),
    it({
      name: 'admits the exact four MiB request boundary and rejects one extra UTF-8 byte',
      fn: async function enforcesRequestByteBound() {
        /** The empty projection measures exact fixed serialized overhead. */
        const baseline = createSelectionFixture();
        /** One scalar predicate keeps membership constant while payload bytes change. */
        const baselineClaim = baseline.declare({ definitionId: 'first', bindingHandle: createSelectionBinding('') });
        /** The request's fixed overhead includes the original catalog digest and envelope. */
        const overhead = Buffer.byteLength(
          JSON.stringify(baseline.requestFor(baseline.issue([baselineClaim]))),
        );
        /** Exact remaining bytes contain multibyte text, proving byte rather than code-unit accounting. */
        const available = 4_194_304 - overhead;
        /** The parity suffix fills the exact byte boundary. */
        const projection = `${'é'.repeat(Math.floor(available / 2))}${'a'.repeat(available % 2)}`;
        /** Fresh original ownership prevents a previous batch from consuming this budget. */
        const exact = createSelectionFixture();
        /** Identical membership and envelope isolate the wire-size condition. */
        const exactClaim = exact.declare({ definitionId: 'first', bindingHandle: createSelectionBinding(projection) });
        assert.equal(Buffer.byteLength(
          JSON.stringify(exact.requestFor(exact.issue([exactClaim]))),
        ), 4_194_304);
        /** One additional byte must reject without issuing the original claim. */
        const oversized = createSelectionFixture();
        /** Oversized projection has the same character semantics and one extra ASCII byte. */
        const oversizedClaim = oversized.declare({ definitionId: 'first', bindingHandle: createSelectionBinding(`${projection}a`) });
        assert.throws(function oversizedRequest() { 
          oversized.issue([oversizedClaim]); 
        }, selectionError('Question request exceeds the four MiB wire profile'));
        assert.equal(oversized.inspectClaim(oversizedClaim).issued, false);
      },
    }),
    //endregion
  ],
});
