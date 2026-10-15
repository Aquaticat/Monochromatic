/** Native confirmation availability never grants execution or answers a generic authorization requirement. @module */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import { nativePendingApproval, type PendingApprovalHostFixture, type PendingApprovalJudgmentFixture } from './native-pending-approval-fixture.ts';

/** Fixture capability identity is sufficient; calling it would be an unexpected presentation side effect. */
function unexpectedPresentation(): never {
  throw new Error('Capturing confirmation facts must not present or record a response');
}

/**
 Create an independent original prepared group and native channel for each test.
 @returns mutable fixture state with original host and judgment capabilities
 */
function fixture() {
  /** Tests change completion and execution state independently of host availability. */
  const state: { finalRecord?: unknown; memberExecutions: { state: string }[] } = { memberExecutions: [{ state: 'unentered' }] };
  /** A source change must preserve the original dependency owner's failure. */
  const dependency: { failure?: Error } = {};
  /** Borrowed host capabilities remain mutable so replacement guards can be exercised. */
  const host: PendingApprovalHostFixture = { pi: { appendEntry: unexpectedPresentation }, ctx: { hasUI: true, ui: { select: unexpectedPresentation }, abort: unexpectedPresentation } };
  /** Native policy supplies these original readers before evidence closure. */
  const judgment: PendingApprovalJudgmentFixture = {
    inspect() { return state; },
    assertDependenciesCurrent() { if (dependency.failure !== undefined) throw dependency.failure; },
  };
  return { state, dependency, host, judgment };
}

//region Original availability and pending state are independent of instruction meaning

await describe({ name: '', children: [
  it({ name: 'captures a pending native channel without presenting, approving or freezing borrowed capabilities', fn: async function availableChannel() {
    /** The same built owner is called by the original native policy evaluator. */
    const f = fixture();
    /** Fresh response facts are constraints rather than an affirmative permission. */
    const pending = nativePendingApproval.capturePendingSessionApproval(f);
    expect(pending.authorization).toEqual({ satisfaction: 'unsatisfied', channel: 'incumbent-approval' });
    expect(Object.isFrozen(pending.authorization)).toBe(true);
    expect(Object.isFrozen(f.host)).toBe(false);
    expect(Object.isFrozen(f.host.ctx)).toBe(false);
    pending.assertCurrent();
    f.state.finalRecord = {};
    f.state.memberExecutions[0] = { state: 'entered' };
    pending.assertCurrent();
  } }),
  ...['absent', 'headless'].map(function unavailable(mode) {
    return it({ name: `retains unsupported confirmation for an ${mode} host`, fn: async function unavailableChannel() {
      /** Missing presentation cannot be promoted to current human authority. */
      const f = fixture();
      f.host.ctx.hasUI = false;
      /** A missing host and a noninteractive host have distinct original inputs. */
      const pending = nativePendingApproval.capturePendingSessionApproval({ judgment: f.judgment, ...(mode === 'headless' ? { host: f.host } : {}) });
      expect(pending.authorization).toEqual({ satisfaction: 'unsatisfied', channel: 'unsupported' });
      pending.assertCurrent();
    } });
  }),
  ...['closed', 'entered', 'empty'].map(function lateCapture(mode) {
    return it({ name: `rejects fresh confirmation capture for ${mode} preparation`, fn: async function invalidCapture() {
      /** Each rejected shape begins with a working original positive control. */
      const f = fixture();
      nativePendingApproval.capturePendingSessionApproval(f).assertCurrent();
      if (mode === 'closed') f.state.finalRecord = {};
      else f.state.memberExecutions = mode === 'empty' ? [] : [{ state: 'entered' }];
      expect(function captureLate() { nativePendingApproval.capturePendingSessionApproval(f); }).toThrow('before the original prepared group');
    } });
  }),
  ...['ui', 'select', 'record', 'abort', 'availability'].map(function replacement(mode) {
    return it({ name: `rejects replaced native ${mode} after a working positive control`, fn: async function replacedCapability() {
      /** Original host identities are retained independently of function behavior. */
      const f = fixture();
      /** Capture precedes the specific capability replacement. */
      const pending = nativePendingApproval.capturePendingSessionApproval(f);
      pending.assertCurrent();
      if (mode === 'ui') f.host.ctx.ui = { select: unexpectedPresentation };
      else if (mode === 'select') f.host.ctx.ui.select = function replacementSelect() { unexpectedPresentation(); };
      else if (mode === 'record') f.host.pi.appendEntry = function replacementRecord() { unexpectedPresentation(); };
      else if (mode === 'abort') f.host.ctx.abort = function replacementAbort() { unexpectedPresentation(); };
      else f.host.ctx.hasUI = false;
      expect(pending.assertCurrent).toThrow('confirmation capabilities changed');
    } });
  }),
  it({ name: 'preserves original dependency failure before capture and at later use', fn: async function dependencyChange() {
    /** Dependency ownership remains with the original judgment. */
    const f = fixture();
    /** Capture succeeds before the original owner retires its dependency. */
    const pending = nativePendingApproval.capturePendingSessionApproval(f);
    f.dependency.failure = new Error('Original policy dependency retired');
    expect(pending.assertCurrent).toThrow(f.dependency.failure);
    expect(function recaptureRetired() { nativePendingApproval.capturePendingSessionApproval(f); }).toThrow(f.dependency.failure);
  } }),
] });

//endregion Original pending-channel controls
