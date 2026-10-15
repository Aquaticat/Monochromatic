/** Original manager tool publications require every retained membership edge. @module */
import { consumeSourceAssociations, flushPolicyDiagnostics } from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';

/**
 Create one complete original tool source graph with no run-emitted or base-carrier alternatives.
 @param publicationField - original native system or tool publication route
 @returns mutable test-owned memberships consumed through the built package
 */
function fixture(publicationField: 'toolPublication' | 'systemInputPublication') {
  /** Original input identity is distinct from the source and run identities. */
  const inputOccurrence = {};
  /** The source carries no role-derived authority. */
  const source = { occurrence: {}, sessionInputOccurrence: inputOccurrence, inputLocation: { field: 'managerInput' } };
  /** The original publication retains the same source and manager input occurrences. */
  const publication = { sourceOccurrence: source.occurrence, sessionInputOccurrence: inputOccurrence };
  /** Retained origin membership is independently checked by the captured run and source view. */
  const retained = { source, publication, sessionInputOccurrence: inputOccurrence };
  /** No active ancestry or run-emitted source route can explain this input-only declaration. */
  const run = { occurrence: {}, replacementInputs: [], retainedMessageOrigins: [retained] };
  /** Original association includes exact native references, not equal serialized declarations. */
  const publicationFields = publicationField === 'toolPublication' ? { toolPublication: publication } : { systemInputPublication: publication };
  /** The association retains exactly one native emission route. */
  const association = { source, sourceOccurrence: source.occurrence, run, ...publicationFields, retainedMessageOrigin: retained };
  /** Original serialized request occurrence remains opaque to contribution accounting. */
  const request = {};
  /** Distinct contributions may refer to one original manager input containing several declarations. */
  const contribution = { request, contribution: {}, location: { field: 'tools', ordinal: 0 }, association };
  /** The exact contribution array belongs to this request observation. */
  const contributions = [contribution];
  /** The captured original run cannot be replaced by the current live state. */
  const observation = { request, sourceContributions: contributions, sources: { nativeRunComposition: run } };
  /** Source views belong to this exact request and original retained input. */
  const view = { source, sourceOccurrence: source.occurrence, request: observation, retainedMessageOrigin: retained };
  /** Empty alternative carrier lists make every tool membership guard observable. */
  const inputs = { requestObservation: observation, requestSourceContributions: contributions,
    instructionSources: [view], instructionCarriers: [], runInstructionCarriers: [] };
  return { source, publication, retained, run, association, contribution, view, inputs };
}

//region Partial accounting does not become permission or whole-request coverage

await describe({ name: '', children: (['toolPublication', 'systemInputPublication'] as const).map(function publicationRoute(publicationField) {
  return describe({name: publicationField, children: [
  it({ name: 'accounts for original manager tool identity without granting permission or freezing inputs', fn: async function originalTool() {
    /** This fixture has no handler or run source route. */
    const input = fixture(publicationField);
    /** Built consumption must retain the original contribution occurrence. */
    const result = consumeSourceAssociations(input.inputs);
    expect(result.issues).toHaveLength(0);
    expect(result.uses).toHaveLength(1);
    expect(result.uses[0]?.state).toBe('accounted');
    expect(result.uses[0]?.contribution).toBe(input.contribution.contribution);
    expect(result.uses[0]?.coverage).toBe('partial-original-prompt-input-contribution');
    expect(result.uses[0]?.permission).toBe(false);
    expect(Object.isFrozen(input.source)).toBe(false);
    expect(Object.isFrozen(input.publication)).toBe(false);
  } }),
  ...['publication', 'source', 'source occurrence', 'run', 'retained source', 'retained publication',
    'retained membership', 'view membership', 'publication occurrence', 'source input', 'publication input',
    'retained input', 'absent input'].map(function invalidMembership(change) {
    return it({ name: `rejects changed ${change} after a positive original tool control`, fn: async function changedMembership() {
      /** Establish that this same graph is initially accounted through the tool route. */
      const input = fixture(publicationField);
      expect(consumeSourceAssociations(input.inputs).uses[0]?.state).toBe('accounted');
      if (change === 'publication') input.association[publicationField] = { ...input.publication };
      else if (change === 'source') input.association.source = { ...input.source };
      else if (change === 'source occurrence') input.association.sourceOccurrence = {};
      else if (change === 'run') input.association.run = { ...input.run };
      else if (change === 'retained source') input.retained.source = { ...input.source };
      else if (change === 'retained publication') input.retained.publication = { ...input.publication };
      else if (change === 'retained membership') input.run.retainedMessageOrigins = [{ ...input.retained }];
      else if (change === 'view membership') input.view.retainedMessageOrigin = { ...input.retained };
      else if (change === 'publication occurrence') input.publication.sourceOccurrence = {};
      else if (change === 'source input') input.source.sessionInputOccurrence = {};
      else if (change === 'publication input') input.publication.sessionInputOccurrence = {};
      else if (change === 'retained input') input.retained.sessionInputOccurrence = {};
      else {
        // JavaScript absence on every owner must not accidentally satisfy equality checks.
        Reflect.deleteProperty(input.source, 'sessionInputOccurrence');
        Reflect.deleteProperty(input.publication, 'sessionInputOccurrence');
        Reflect.deleteProperty(input.retained, 'sessionInputOccurrence');
      }
      /** The unresolved original contribution remains visible to the independent prerequisite check. */
      const result = consumeSourceAssociations(input.inputs);
      expect(result.uses[0]?.state).toBe('unresolved');
      expect(result.uses[0]?.permission).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.kind).toBe('request-contribution-source-association');
    } });
  }),
] });
}) });
await flushPolicyDiagnostics();

//endregion Partial accounting does not become permission or whole-request coverage
