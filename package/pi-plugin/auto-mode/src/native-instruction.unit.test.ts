/**
 Built original instruction consumers verify identity, source selection, and lifetime boundaries. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createInstructionFixture, createFixtureInstructions } from './native-instruction-fixture.ts';

await describe({
  name: '',
  children: [
    //region Request and prepared-member selectors retain original occurrences and reject foreign ownership.
    it({
      name: 'retains complete-operation decision identity without projecting the archived request body',
      fn: async function originalOperationDecision() {
        const fixture = createInstructionFixture();
        const { instructions, receipt, declarations, input } = fixture;
        const first = instructions.claimOperationDecision();
        assert.equal(instructions.claimOperationDecision(), first);
        assert.equal(declarations[0]?.definitionId, 'operation_decision');
        const binding = instructions.resolveBinding(first);
        assert.equal(binding.identity, receipt.request);
        assert.deepEqual(binding.projection, { claimScope: 'complete-prepared-operation' });
        assert.equal(Object.isFrozen(binding.projection), true);
        assert.notEqual(instructions.claimRequestMaterial(), first);
        assert.throws(function foreignOwner() {
          createFixtureInstructions(input).resolveBinding(first);
        }, { name: 'JudgmentConstructionError' });
        receipt.request = Object.freeze({ ...receipt.request });
        assert.throws(function replacedRequest() {
          instructions.resolveBinding(first);
        }, { name: 'JudgmentConstructionError' });
      },
    }),
    it({
      name: 'retains original request identity, repeated declaration, and independent owner membership',
      fn: async function originalRequest() {
        const fixture = createInstructionFixture();
        const { instructions, receipt, declarations, input } = fixture;
        const first = instructions.claimRequestMaterial();
        assert.equal(instructions.claimRequestMaterial(), first);
        assert.equal(declarations.length, 2);
        assert.equal(declarations[0]?.definitionId, 'request_instruction_content');
        assert.equal(instructions.requestMaterialFor(), receipt.request);
        const binding = instructions.resolveBinding(first);
        assert.equal(binding.identity, receipt.request);
        assert.equal(binding.projection.requestMaterial, receipt.request);
        assert.equal(binding.projection.claimScope, 'program-request');
        assert.equal(Object.isFrozen(binding), true);
        assert.equal(Object.isFrozen(binding.projection), true);
        assert.equal(Object.isFrozen(first), true);
        assert.equal(Object.isFrozen(instructions), true);
        assert.throws(function foreignOwner() { 
          createFixtureInstructions(input).resolveBinding(first); 
        }, { name: 'JudgmentConstructionError' });
        receipt.request = Object.freeze({ ...receipt.request });
        assert.throws(function replacedRequest() { 
          instructions.resolveBinding(first); 
        }, { message: 'Whole-request material lost its original request occurrence' });
      },
    }),
    it({
      name: 'resolves direct members and separates member-clause identity from shared clause meaning',
      fn: async function originalMemberClaims() {
        const { instructions, members, bindings } = createInstructionFixture({ memberCount: 2 });
        const [member] = members;
        assert.ok(member);
        const direct = instructions.claim({ definitionId: 'fixture_member_predicate', memberId: 'member-0' });
        assert.equal(direct, member);
        assert.equal(instructions.resolveBinding(direct), bindings.get(member)?.binding);
        const [rule] = instructions.indexedRuleCandidates();
        assert.ok(rule);
        const first = instructions.claimRuleCandidate({ definitionId: 'fixture_member_predicate', memberId: 'member-0', rule });
        assert.equal(instructions.claimInstruction({ definitionId: 'fixture_member_predicate', memberId: 'member-0', ruleCode: 'AAA' }), first);
        const second = instructions.claimRuleCandidate({ definitionId: 'fixture_member_predicate', memberId: 'member-1', rule });
        assert.notEqual(second, first);
        assert.equal(instructions.resolveBinding(first).projection.memberOrdinal, 0);
        assert.equal(instructions.resolveBinding(second).projection.memberOrdinal, 1);
        const meaning = instructions.claimRuleCandidate({ definitionId: 'states_approval_prerequisite', memberId: 'member-0', rule });
        assert.equal(instructions.claimInstruction({ definitionId: 'states_approval_prerequisite', memberId: 'member-1', ruleCode: 'AAA' }), meaning);
        assert.equal(instructions.resolveBinding(meaning).projection.claimScope, 'instruction');
        bindings.delete(member);
        assert.throws(function retiredMemberClaim() { 
          instructions.resolveBinding(first); 
        }, { message: 'Instruction claim lost its original member or source clause' });
        assert.equal(instructions.resolveBinding(meaning).projection.governingRule, instructions.readRuleCandidate(rule));
        assert.throws(function retiredDirectMember() { 
          instructions.resolveBinding(direct); 
        }, { message: 'Prepared member binding is not owned by this judgment' });
      },
    }),
    //endregion
    //region Original source subjects retain distinct canonical identities and bounded structural opportunities.
    it({
      name: 'retains tagged, unclassified, contextual-heading, and adoption subjects without claiming authority',
      fn: async function originalSourceSubjects() {
        const { instructions, members, bindings } = createInstructionFixture();
        const selection = instructions.readPolicySelection();
        const [rule] = selection.ruleCandidates;
        const [heading] = selection.headingContextCandidates;
        const [pair] = selection.unitAdoptionPairs;
        assert.ok(rule);
        assert.ok(heading);
        assert.ok(pair);
        assert.equal(selection.ruleCandidates.length, 1);
        assert.equal(selection.instructionCandidates.length, 2);
        assert.equal(selection.ruleSourceCoverage.length, 1);
        assert.equal(Object.isFrozen(selection), true);
        for (const value of Object.values(selection)) assert.equal(Object.isFrozen(value), true);
        assert.equal(instructions.indexedUnitAdoptionPairs(), selection.unitAdoptionPairs);
        assert.equal(pair.member, members[0]);
        assert.equal(Object.isFrozen(pair), true);
        const program = instructions.claimProgramRuleCandidate({ definitionId: 'operation_violates_rule', rule });
        assert.equal(instructions.claimProgramRuleCandidate({ definitionId: 'clause_operation_relation', rule }), program);
        assert.equal(instructions.resolveBinding(program).projection.claimScope, 'program-instruction');
        assert.equal(instructions.resolveBinding(program).projection.governingRule, instructions.readRuleCandidate(rule));
        const context = instructions.claimHeadingContext({ candidate: heading });
        assert.equal(instructions.claimHeadingContext({ candidate: heading }), context);
        assert.equal(instructions.resolveBinding(context).identity, heading);
        assert.equal(instructions.resolveBinding(context).projection.headingContext, instructions.readRuleCandidate(heading));
        const adoption = instructions.claimUnitAdoption({ pair });
        assert.equal(instructions.claimUnitAdoption({ pair }), adoption);
        const binding = instructions.resolveBinding(adoption);
        assert.equal(binding.identity, pair);
        assert.equal(binding.projection.memberOrdinal, 0);
        assert.equal(binding.projection.adopter, instructions.readRuleCandidate(pair.adopter));
        assert.equal(binding.projection.target, instructions.readRuleCandidate(pair.target));
        assert.equal(binding.projection.adopter?.authorityEstablishedByIndex, false);
        assert.throws(function copiedPair() { 
          instructions.claimUnitAdoption({ pair: { ...pair } }); 
        }, { message: 'Unit adoption requires an original selected pair from this judgment' });
        assert.ok(pair.member);
        bindings.delete(pair.member);
        assert.throws(function retiredAdoption() { 
          instructions.resolveBinding(adoption); 
        }, { message: 'Unit adoption lost its original member or source units' });
        assert.throws(function redeclaredRetiredPair() { 
          instructions.claimUnitAdoption({ pair }); 
        }, { message: 'Unit adoption requires its original member and same-source units' });
      },
    }),
    it({
      name: 'rejects heading-clause confusion, missing members, unsupported predicates, and foreign candidates',
      fn: async function selectorAdmission() {
        const { instructions } = createInstructionFixture();
        const [rule] = instructions.indexedRuleCandidates();
        const [heading] = instructions.indexedHeadingContextCandidates();
        assert.ok(rule);
        assert.ok(heading);
        assert.throws(function clauseAsHeading() { 
          instructions.claimHeadingContext({ candidate: rule }); 
        }, { message: 'Heading content requires an original contextual-heading group' });
        assert.throws(function headingAsProgramClause() { 
          instructions.claimProgramRuleCandidate({ definitionId: 'clause_operation_relation', rule: heading }); 
        }, { message: 'Heading groups cannot be selected as individual clauses' });
        assert.throws(function headingAsMemberClause() { 
          instructions.claimRuleCandidate({ definitionId: 'fixture', memberId: 'member-0', rule: heading }); 
        }, { message: 'Heading groups cannot be selected as individual clauses' });
        assert.throws(function unsupportedProgramPredicate() { 
          instructions.claimProgramRuleCandidate({ definitionId: 'fixture', rule }); 
        }, { message: 'Unsupported whole-program rule relation definition' });
        assert.throws(function missingDirectMember() { 
          instructions.claim({ definitionId: 'fixture', memberId: 'missing' }); 
        }, { message: 'Requested member was not in the prepared native group' });
        assert.throws(function missingClauseMember() { 
          instructions.claimRuleCandidate({ definitionId: 'fixture', memberId: 'missing', rule }); 
        }, { message: 'Instruction claim member is outside the original prepared group' });
        for (const definitionId of ['operation_violates_rule', 'clause_operation_relation', 'request_instruction_content', 'heading_instruction_content', 'unit_adoption']) {
          assert.throws(function forbiddenMemberSelector() { 
            instructions.claimRuleCandidate({ definitionId, memberId: 'member-0', rule }); 
          }, { message: 'Whole-program rule relation cannot be selected through a member' });
        }
        for (const definitionId of ['operation_violates_rule', 'states_approval_prerequisite', 'request_instruction_content', 'heading_instruction_content', 'unit_adoption']) {
          assert.throws(function dedicatedDirectSelector() { 
            instructions.claim({ definitionId, memberId: 'member-0' }); 
          }, { name: 'JudgmentConstructionError' });
        }
        for (const candidate of [{}, undefined, null, false, 'AAA']) {
          assert.throws(function foreignSourceCandidate() { 
            instructions.readRuleCandidate(candidate); 
          }, { name: 'GoverningRuleBindingError' });
          assert.throws(function foreignClaimHandle() { 
            instructions.resolveBinding(candidate); 
          }, { message: 'Prepared member binding is not owned by this judgment' });
        }
      },
    }),
    //endregion
  ],
});
