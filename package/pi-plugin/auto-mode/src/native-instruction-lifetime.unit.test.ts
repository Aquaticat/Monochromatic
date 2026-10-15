/**
 Built instruction consumers verify lazy source capture, failure publication, and original lifetime. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createFixtureInstructions, createInstructionFixture } from './native-instruction-fixture.ts';

await describe({
  name: '',
  children: [
    //region Lazy admission and original dependency retirement remain distinct from historical diagnostics.
    it({
      name: 'reads original bootstrap properties once in constructor order without eager capability calls',
      fn: async function originalBootstrapReads() {
        const { input, events } = createInstructionFixture();
        const properties = ['ready', 'bindingSegment', 'isBindingSegmentActive', 'readJudgmentSources', 'declaredNames', 'byMember', 'bindings', 'knownSelection', 'parsePolicy', 'receipt', 'issue'];
        const reads: string[] = [];
        const supplied: Record<string, unknown> = {};
        for (const property of properties) {
          Object.defineProperty(supplied, property, { get() { 
            reads.push(property); 
            return input[property]; 
          } });
        }
        const instructions = createFixtureInstructions(supplied);
        assert.deepEqual(reads, properties);
        assert.equal(events.length, 0);
        instructions.claimRequestMaterial();
        assert.deepEqual(reads, properties);
      },
    }),
    it({
      name: 'requires qualified parsing and original host selection only when source claims are reached',
      fn: async function lazySourceAdmission() {
        const fixture = createInstructionFixture();
        const missingParser = createFixtureInstructions({ ...fixture.input, parsePolicy: undefined });
        assert.equal(missingParser.requestMaterialFor(), fixture.receipt.request);
        assert.equal(Object.isFrozen(missingParser.claimRequestMaterial()), true);
        assert.throws(function noParser() { 
          missingParser.indexedRuleCandidates(); 
        }, { message: 'Original host-selected policy and qualified parser are required for instruction claims' });
        fixture.state.hostPolicy = false;
        assert.throws(function noHostPolicy() { 
          fixture.instructions.indexedInstructionCandidates(); 
        }, { message: 'Original host-selected policy and qualified parser are required for instruction claims' });
        fixture.state.hostPolicy = {};
        assert.equal(fixture.instructions.indexedRuleCandidates().length, 1);
      },
    }),
    it({
      name: 'retains active segment selection and caches no opportunities for nonsingleton groups',
      fn: async function originalSourceSegment() {
        const fixture = createInstructionFixture();
        fixture.state.active = true;
        fixture.instructions.indexedInstructionCandidates();
        const [rule] = fixture.instructions.indexedRuleCandidates();
        assert.ok(rule);
        fixture.instructions.readRuleCandidate(rule);
        fixture.instructions.indexedUnitAdoptionPairs();
        assert.equal(fixture.events.some(function segmentEvent(value) { 
          return value.startsWith('enter:'); 
        }), false);
        fixture.state.active = false;
        fixture.instructions.readRuleCandidate(rule);
        assert.equal(fixture.events.includes('enter:readOwnedRule'), true);
        for (const memberCount of [0, 2]) {
          const multiple = createInstructionFixture({ memberCount });
          const pairs = multiple.instructions.indexedUnitAdoptionPairs();
          assert.equal(pairs.length, 0);
          assert.equal(multiple.instructions.indexedUnitAdoptionPairs(), pairs);
          assert.equal(multiple.events.includes('sources'), false);
        }
      },
    }),
    it({
      name: 'rejects selected adoption when its declared member was never prepared',
      fn: async function unpreparedAdoption() {
        const { instructions, byMember } = createInstructionFixture();
        byMember.clear();
        const [pair] = instructions.indexedUnitAdoptionPairs();
        assert.ok(pair);
        assert.equal(Object.hasOwn(pair, 'member'), true);
        assert.equal(pair.member, undefined);
        assert.throws(function missingOriginalMember() { 
          instructions.claimUnitAdoption({ pair }); 
        }, { message: 'Unit adoption requires its original member and same-source units' });
      },
    }),
    it({
      name: 'does not publish member-clause handles when original dependency capture fails',
      fn: async function failedPublication() {
        const { instructions, members, bindings } = createInstructionFixture();
        const [member] = members;
        const [rule] = instructions.indexedRuleCandidates();
        assert.ok(member);
        assert.ok(rule);
        const original = bindings.get(member);
        assert.ok(original);
        bindings.delete(member);
        assert.throws(function missingMemberProjection() { 
          instructions.claimRuleCandidate({ definitionId: 'fixture', memberId: 'member-0', rule }); 
        }, { name: 'TypeError', message: "Cannot read properties of undefined (reading 'binding')" });
        const meaning = instructions.claimRuleCandidate({ definitionId: 'states_approval_prerequisite', memberId: 'member-0', rule });
        assert.equal(instructions.resolveBinding(meaning).projection.claimScope, 'instruction');
        bindings.set(member, original);
        const recovered = instructions.claimRuleCandidate({ definitionId: 'fixture', memberId: 'member-0', rule });
        assert.equal(instructions.claimRuleCandidate({ definitionId: 'fixture', memberId: 'member-0', rule }), recovered);
        assert.equal(instructions.resolveBinding(recovered).projection.memberOrdinal, 0);
      },
    }),
    it({
      name: 'retains absent claim bindings on reached child records and the original missing projection error',
      fn: async function childBindingAbsence() {
        /** Child program publication shares the original member map without a root claim binding. */
        const f = createInstructionFixture();
        /** Isolated map admits both root and child record shapes from original construction. */
        const bindings = new WeakMap<object, object>();
        /** Root handle is the original prepared-member identifier target. */
        const [root] = f.members;
        assert.ok(root);
        /** Original root binding remains observable after a failed projection read. */
        const rootRecord = f.bindings.get(root);
        assert.ok(rootRecord);
        bindings.set(root, rootRecord);
        /** Reached child has a native prepared record without an instruction binding. */
        const child = Object.freeze({});
        bindings.set(child, { prepared: Object.freeze({}), parent: Object.freeze({}) });
        /** Built instruction owner borrows the same mixed membership map. */
        const instructions = createFixtureInstructions({ ...f.input, bindings });
        assert.equal(instructions.resolveBinding(root), rootRecord.binding);
        assert.equal(instructions.resolveBinding(child), undefined);
        /** Replacing the root record exposes the incumbent projection failure boundary. */
        const [rule] = instructions.indexedRuleCandidates();
        assert.ok(rule);
        bindings.set(root, {});
        assert.throws(function missingBindingProjection() {
          instructions.claimRuleCandidate({ definitionId: 'fixture', memberId: 'member-0', rule });
        }, { name: 'TypeError', message: "Cannot read properties of undefined (reading 'projection')" });
        /** Adoption consumes the same original root projection boundary. */
        const [pair] = instructions.indexedUnitAdoptionPairs();
        assert.ok(pair);
        assert.throws(function missingAdoptionProjection() {
          instructions.claimUnitAdoption({ pair });
        }, { name: 'TypeError', message: "Cannot read properties of undefined (reading 'projection')" });
        bindings.set(root, rootRecord);
        /** Failed projection access must not publish a partial claim handle. */
        const recovered = instructions.claimRuleCandidate({ definitionId: 'fixture', memberId: 'member-0', rule });
        assert.equal(instructions.resolveBinding(recovered).projection.memberOrdinal, 0);
        assert.equal(instructions.resolveBinding(instructions.claimUnitAdoption({ pair })).projection.memberOrdinal, 0);
      },
    }),
    ...['clause', 'heading', 'adoption'].map(function originalDependency(kind) {
      return it({
        name: `rejects ${kind} resolution after original source-list replacement`,
        fn: async function retiredOriginalSource() {
          const { instructions, state } = createInstructionFixture();
          const selection = instructions.readPolicySelection();
          const [rule] = selection.ruleCandidates;
          const [heading] = selection.headingContextCandidates;
          const [pair] = selection.unitAdoptionPairs;
          assert.ok(rule);
          assert.ok(heading);
          assert.ok(pair);
          const handle = kind === 'adoption' ? instructions.claimUnitAdoption({ pair }) : kind === 'heading' ? instructions.claimHeadingContext({ candidate: heading }) : instructions.claimProgramRuleCandidate({ definitionId: 'operation_violates_rule', rule });
          state.sources = Object.freeze([...state.sources]);
          assert.throws(function changedSourceList() { 
            instructions.resolveBinding(handle); 
          }, { name: 'GoverningRuleBindingError' });
        },
      });
    }),
    it({
      name: 'propagates exact original lifetime failure for request, source, member, and resolution operations',
      fn: async function originalLifetime() {
        const { instructions, state } = createInstructionFixture();
        const request = instructions.claimRequestMaterial();
        const failure = new Error('original fixture lifetime retired');
        state.failure = failure;
        const operations = [
          function requestRead() { 
            instructions.requestMaterialFor(); 
          },
          function requestClaim() { 
            instructions.claimRequestMaterial(); 
          },
          function memberClaim() { 
            instructions.claim({ definitionId: 'fixture', memberId: 'member-0' }); 
          },
          function sourceSelection() { 
            instructions.indexedRuleCandidates(); 
          },
          function adoptionSelection() { 
            instructions.indexedUnitAdoptionPairs(); 
          },
          function bindingResolution() { 
            instructions.resolveBinding(request); 
          },
        ];
        for (const operation of operations) assert.throws(operation, function exactFailure(error) { 
          return error === failure; 
        });
      },
    }),
    //endregion
  ],
});
