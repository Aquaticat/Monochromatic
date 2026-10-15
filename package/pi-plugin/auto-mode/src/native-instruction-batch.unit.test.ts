/**
 Built original instruction batches preserve explicit semantic uses, bounds, and declaration order. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createInstructionFixture } from './native-instruction-fixture.ts';

await describe({
  name: '',
  children: [
    //region Selected semantic uses preserve original clause, request, heading, and adoption order.
    ...[false, true].flatMap(function clauseUse(clauseRelations) {
      return [false, true].flatMap(function requestUse(requestMaterial) {
        return [false, true].flatMap(function headingUse(headingContexts) {
          return [false, true].map(function adoptionUse(unitAdoptions) {
            return it({
              name: `preserves batch selection ${JSON.stringify({ clauseRelations, requestMaterial, headingContexts, unitAdoptions })}`,
              fn: async function explicitSemanticUses() {
                const { instructions, declarations, batches } = createInstructionFixture();
                const selection = { clauseRelations, requestMaterial, headingContexts, unitAdoptions };
                if ((!clauseRelations) && (!requestMaterial) && (!headingContexts) && (!unitAdoptions)) {
                  assert.throws(function noSemanticUses() { 
                    instructions.issueBoundPolicyBatch(selection); 
                  }, { message: 'Bound policy batch requires explicit code-selected semantic uses' });
                  assert.equal(declarations.length, 0);
                  assert.equal(batches.length, 0);
                  return;
                }
                const batch = instructions.issueBoundPolicyBatch(selection);
                const expected = [
                  ...(clauseRelations ? ['clause_operation_relation', 'clause_operation_relation'] : []),
                  ...(requestMaterial ? ['request_instruction_content'] : []),
                  ...(headingContexts ? ['heading_instruction_content'] : []),
                  ...(unitAdoptions ? ['unit_adoption'] : []),
                ];
                assert.deepEqual(declarations.map(function definition(value) { 
                  return value.definitionId; 
                }), expected);
                assert.equal(batches.length, 1);
                assert.equal(batches[0], batch);
                assert.deepEqual(batch, declarations.map(function declaredHandle(value) { 
                  return value.bindingHandle; 
                }));
              },
            });
          });
        });
      });
    }),
    it({
      name: 'retains tagged versus all-instruction program selection and meaning-before-operation assessment order',
      fn: async function originalBatchProfiles() {
        const tagged = createInstructionFixture();
        tagged.instructions.issueProgramRuleBatch({ definitionId: 'operation_violates_rule' });
        assert.deepEqual(tagged.declarations.map(function definition(value) { 
          return value.definitionId; 
        }), ['operation_violates_rule']);
        const all = createInstructionFixture();
        all.instructions.issueProgramRuleBatch({ definitionId: 'clause_operation_relation' });
        assert.deepEqual(all.declarations.map(function definition(value) { 
          return value.definitionId; 
        }), ['clause_operation_relation', 'clause_operation_relation']);
        const mixed = createInstructionFixture();
        mixed.instructions.issueRuleAssessmentBatch();
        assert.deepEqual(mixed.declarations.map(function definition(value) { 
          return value.definitionId; 
        }), ['states_approval_prerequisite', 'operation_violates_rule']);
        const [meaning, operation] = mixed.declarations;
        assert.ok(meaning);
        assert.ok(operation);
        assert.notEqual(meaning.bindingHandle, operation.bindingHandle);
        assert.equal(mixed.instructions.resolveBinding(meaning.bindingHandle).projection.governingRule, mixed.instructions.resolveBinding(operation.bindingHandle).projection.governingRule);
        assert.throws(function unknownProgramPredicate() { 
          mixed.instructions.issueProgramRuleBatch({ definitionId: 'fixture' }); 
        }, { message: 'Unsupported whole-program rule relation definition' });
      },
    }),
    it({
      name: 'rejects every malformed semantic-use flag before declaring or issuing claims',
      fn: async function malformedSemanticUses() {
        const { instructions, declarations, batches } = createInstructionFixture();
        for (const field of ['clauseRelations', 'requestMaterial', 'headingContexts', 'unitAdoptions']) {
          for (const value of [null, 0, 1, '', 'true', {}, []]) {
            assert.throws(function malformedFlag() { 
              instructions.issueBoundPolicyBatch({ clauseRelations: false, requestMaterial: true, headingContexts: false, unitAdoptions: false, [field]: value }); 
            }, { message: 'Bound policy batch requires explicit code-selected semantic uses' });
          }
        }
        assert.throws(function absentRequiredFlag() { 
          instructions.issueBoundPolicyBatch({ requestMaterial: true }); 
        }, { message: 'Bound policy batch requires explicit code-selected semantic uses' });
        assert.throws(function absentRequestFlag() { 
          instructions.issueBoundPolicyBatch({ clauseRelations: true }); 
        }, { message: 'Bound policy batch requires explicit code-selected semantic uses' });
        assert.equal(declarations.length, 0);
        assert.equal(batches.length, 0);
        instructions.issueBoundPolicyBatch({ clauseRelations: false, requestMaterial: true });
        assert.equal(declarations.length, 1);
      },
    }),
    //endregion
    //region Empty and out-of-profile collections fail before any batch publication.
    it({
      name: 'rejects empty requested subjects while permitting an empty tagged operation batch',
      fn: async function emptySubjects() {
        const empty = createInstructionFixture({ contents: [''] });
        assert.throws(function noInstructionClauses() { 
          empty.instructions.issueBoundPolicyBatch({ clauseRelations: true, requestMaterial: false }); 
        }, { message: 'Clause relation requires one through 256 original instruction candidates' });
        assert.throws(function noProgramClauses() { 
          empty.instructions.issueProgramRuleBatch({ definitionId: 'clause_operation_relation' }); 
        }, { message: 'Clause relation requires one through 256 indexed clauses' });
        assert.throws(function noMixedClauses() { 
          empty.instructions.issueRuleAssessmentBatch(); 
        }, { message: 'Mixed rule assessment requires one through 256 indexed clauses; unclassified prose and larger batches remain unsupported' });
        assert.throws(function noHeadingGroups() { 
          empty.instructions.issueBoundPolicyBatch({ clauseRelations: false, requestMaterial: false, headingContexts: true }); 
        }, { message: 'Heading content requires one through 64 original source groups' });
        assert.throws(function noAdoptionPairs() { 
          empty.instructions.issueBoundPolicyBatch({ clauseRelations: false, requestMaterial: false, unitAdoptions: true }); 
        }, { message: 'No bounded original same-source adoption pairs are available' });
        assert.equal(empty.batches.length, 0);
        empty.instructions.issueProgramRuleBatch({ definitionId: 'operation_violates_rule' });
        assert.deepEqual(empty.batches, [[]]);
      },
    }),
    ...[256, 257].map(function clauseBound(count) {
      return it({
        name: `retains original clause-batch behavior for ${count} tagged candidates`,
        fn: async function originalClauseLimit() {
          const content = Array.from({ length: count }, function originalClause(_value, index) { 
            return `C${index.toString(36).toUpperCase().padStart(2, '0')}: Original fixture clause ${index}.`; 
          }).join('\n\n');
          const { instructions, declarations, batches } = createInstructionFixture({ contents: [content] });
          assert.equal(instructions.indexedRuleCandidates().length, count);
          if (count === 257) {
            assert.throws(function oversizedBoundClauses() { 
              instructions.issueBoundPolicyBatch({ clauseRelations: true, requestMaterial: false }); 
            }, { message: 'Clause relation requires one through 256 original instruction candidates' });
            assert.throws(function oversizedProgramClauses() { 
              instructions.issueProgramRuleBatch({ definitionId: 'clause_operation_relation' }); 
            }, { message: 'Clause relation requires one through 256 indexed clauses' });
            assert.throws(function oversizedMixedClauses() { 
              instructions.issueRuleAssessmentBatch(); 
            }, { message: 'Mixed rule assessment requires one through 256 indexed clauses; unclassified prose and larger batches remain unsupported' });
            assert.equal(declarations.length, 0);
            assert.equal(batches.length, 0);
          } else {
            instructions.issueBoundPolicyBatch({ clauseRelations: true, requestMaterial: false });
            instructions.issueProgramRuleBatch({ definitionId: 'clause_operation_relation' });
            instructions.issueRuleAssessmentBatch();
            assert.deepEqual(batches.map(function batchSize(value) { 
              return value.length; 
            }), [count, count, count * 2]);
          }
        },
      });
    }),
    ...[64, 65].map(function headingBound(count) {
      return it({
        name: `retains original heading-batch behavior for ${count} source groups`,
        fn: async function originalHeadingLimit() {
          const contents = Array.from({ length: count }, function originalHeading(_value, index) { 
            return `# Original heading ${index}\n\nOriginal fixture content.`; 
          });
          const { instructions, declarations, batches } = createInstructionFixture({ contents });
          assert.equal(instructions.indexedHeadingContextCandidates().length, count);
          if (count === 65) {
            assert.throws(function oversizedHeadingBatch() { 
              instructions.issueBoundPolicyBatch({ clauseRelations: false, requestMaterial: false, headingContexts: true }); 
            }, { message: 'Heading content requires one through 64 original source groups' });
            assert.equal(declarations.length, 0);
            assert.equal(batches.length, 0);
          } else {
            instructions.issueBoundPolicyBatch({ clauseRelations: false, requestMaterial: false, headingContexts: true });
            assert.equal(batches[0]?.length, count);
          }
        },
      });
    }),
    it({
      name: 'preserves original issuance failure and canonical declarations on a later retry',
      fn: async function failedIssuance() {
        const { instructions, state, declarations, batches } = createInstructionFixture();
        const failure = new Error('original fixture issuance failure');
        state.issueFailure = failure;
        assert.throws(function rejectedOriginalIssue() { 
          instructions.issueBoundPolicyBatch({ clauseRelations: true, requestMaterial: true }); 
        }, function originalFailure(error) { 
          return error === failure; 
        });
        assert.equal(batches.length, 0);
        const original = declarations.map(function originalHandle(value) { 
          return value.bindingHandle; 
        });
        delete state.issueFailure;
        instructions.issueBoundPolicyBatch({ clauseRelations: true, requestMaterial: true });
        assert.deepEqual(batches[0], original);
      },
    }),
    //endregion
  ],
});
