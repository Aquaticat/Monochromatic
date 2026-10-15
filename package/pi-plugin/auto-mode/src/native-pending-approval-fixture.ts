/** Load the built native confirmation owner through its consumer contract. @module */

/** Mutable fixture capabilities exercise original host replacement rather than copied approval labels. */
export type PendingApprovalHostFixture = {
  readonly pi: { appendEntry: () => void };
  readonly ctx: { hasUI: boolean; ui: { select: () => void }; abort: () => void };
};

/** Original preparation state remains owned by the fixture's judgment. */
export type PendingApprovalJudgmentFixture = {
  readonly inspect: () => { readonly finalRecord?: unknown; readonly memberExecutions: readonly { readonly state: string }[] };
  readonly assertDependenciesCurrent: () => void;
};

/** This independent consumer contract contains only the behavior exercised by the native tests. */
type PendingApprovalModule = {
  readonly capturePendingSessionApproval: (input: {
    readonly judgment: PendingApprovalJudgmentFixture;
    readonly host?: PendingApprovalHostFixture;
  }) => {
    readonly authorization: { readonly satisfaction: string; readonly channel: string };
    readonly assertCurrent: () => void;
  };
};

/**
 Narrow the built export before allowing the fixture to call it.
 @param value - actual emitted native module namespace
 @throws Error when the original native export is missing
 */
function assertPendingApprovalModule(value: unknown): asserts value is PendingApprovalModule {
  if ((value === null) || (typeof value !== 'object') || !('capturePendingSessionApproval' in value)
    || (typeof value.capturePendingSessionApproval !== 'function'))
    throw new Error('Built native pending session confirmation export is unavailable');
}

/** Tests load the emitted module consumed by native policy evaluation. */
const built: unknown = await import(new URL('../dist/native/contract/integration/action-policy/pending-session-approval.ts', import.meta.url).href);
assertPendingApprovalModule(built);

/** Verified built exports keep tests independent of sibling implementation imports. */
export const nativePendingApproval: PendingApprovalModule = built;
