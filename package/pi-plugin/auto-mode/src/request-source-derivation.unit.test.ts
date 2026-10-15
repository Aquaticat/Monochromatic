/** Complete request use requires both native field coverage and original source memberships. @module */
import { consumeSourceAssociations, flushPolicyDiagnostics } from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import { createContributionFixture } from './source-contribution-test-fixture.ts';

/**
 Model an authenticated native field receipt without claiming that this fixture authenticates native owners.
 @returns disposable original source graph and mutable field proof for contrasts
 */
function fixture() {
  /** Base-carrier membership isolates complete-field checks from native system-specific branches. */
  const input = createContributionFixture('base');
  /** One serialized message is entirely represented by its original contribution. */
  const field = { field: 'messages' as const, ordinal: 0, contributions: [input.contribution.contribution] };
  /** The native owner binds coverage to its exact request and contribution list. */
  const derivation = { profile: 'native-text-messages-and-tool-declarations' as const,
    request: input.observation.request, contributions: input.observation.sourceContributions,
    messageCount: 1, toolCount: 0, fields: [field] };
  input.observation.sourceDerivation = derivation;
  return { input, field, derivation };
}

//region Field completeness cannot be inferred from partial source accounting alone

await describe({ name: '', children: [
  it({ name: 'consumes complete native field coverage without granting permission or freezing borrowed proof', fn: async function representedUse() {
    /** Positive control uses the same built source consumer as native compilation. */
    const f = fixture();
    /** The complete request use remains separate from every partial contribution result. */
    const result = consumeSourceAssociations(f.input.inputs);
    expect(result.governingUse?.state).toBe('represented-by-original-inputs');
    expect(result.governingUse?.request).toBe(f.input.observation.request);
    expect(result.governingUse?.permission).toBe(false);
    expect(result.uses[0]?.coverage).toBe('partial-original-prompt-input-contribution');
    expect(Object.isFrozen(f.derivation)).toBe(false);
    expect(Object.isFrozen(f.field)).toBe(false);
    expect(Object.isFrozen(result.governingUse)).toBe(true);
  } }),
  ...['absent', 'empty', 'message-count', 'tool-count', 'negative-count', 'fractional-count', 'duplicate-position',
    'negative-ordinal', 'outside-ordinal', 'unknown-field', 'empty-contributions', 'copied-occurrence',
    'wrong-location', 'unresolved-source', 'duplicate-contribution', 'unknown-profile'].map(function invalidProof(change) {
    return it({ name: `retains unresolved request use for ${change} after an accounted positive control`, fn: async function incompleteUse() {
      /** All negative cases begin with the exact graph accepted by the positive control. */
      const f = fixture();
      expect(consumeSourceAssociations(f.input.inputs).governingUse?.state).toBe('represented-by-original-inputs');
      if (change === 'absent') Reflect.deleteProperty(f.input.observation, 'sourceDerivation');
      else if (change === 'empty') f.derivation.fields = [];
      else if (change === 'message-count') f.derivation.messageCount = 2;
      else if (change === 'tool-count') f.derivation.toolCount = 1;
      else if (change === 'negative-count') f.derivation.toolCount = -1;
      else if (change === 'fractional-count') f.derivation.messageCount = 1.5;
      else if (change === 'duplicate-position') {
        f.derivation.messageCount = 2;
        f.derivation.fields.push({ ...f.field });
      } else if (change === 'negative-ordinal') f.field.ordinal = -1;
      else if (change === 'outside-ordinal') f.field.ordinal = 1;
      else if (change === 'unknown-field') Reflect.set(f.field, 'field', 'unknown');
      else if (change === 'empty-contributions') f.field.contributions = [];
      else if (change === 'copied-occurrence') f.field.contributions = [{}];
      else if (change === 'wrong-location') f.input.contribution.location = { field: 'tools', ordinal: 0 };
      else if (change === 'unresolved-source') f.input.runCarrier.sourceOccurrences = [];
      else if (change === 'duplicate-contribution') {
        /** Duplicate identities must not be hidden by an indexing map. */
        const repeated = [f.input.contribution, f.input.contribution];
        f.input.observation.sourceContributions = repeated;
        f.input.inputs.requestSourceContributions = repeated;
        f.derivation.contributions = repeated;
      } else Reflect.set(f.derivation, 'profile', 'unknown');
      /** Losing field proof never promotes partial accounting into complete represented use. */
      const result = consumeSourceAssociations(f.input.inputs);
      expect(result.governingUse?.state).toBe('unresolved');
      expect(result.governingUse?.permission).toBe(false);
    } });
  }),
  ...['request', 'contribution-list'].map(function foreignBinding(change) {
    return it({ name: `rejects foreign original ${change} identity`, fn: async function foreignProof() {
      /** Exact request and list identities are independently guarded. */
      const f = fixture();
      expect(consumeSourceAssociations(f.input.inputs).governingUse?.state).toBe('represented-by-original-inputs');
      if (change === 'request') f.derivation.request = {};
      else f.derivation.contributions = [...f.derivation.contributions];
      expect(function consumeForeignProof() { consumeSourceAssociations(f.input.inputs); })
        .toThrow('Request field derivation belongs to another original request or contribution list');
    } });
  }),
] });
await flushPolicyDiagnostics();

//endregion Field completeness cannot be inferred from partial source accounting alone
