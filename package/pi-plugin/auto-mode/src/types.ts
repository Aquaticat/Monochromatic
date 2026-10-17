/** Session verdict records and native confirmation outcomes. @module */

//region Session audit records retain historical data without reusing permission.
/** Discriminator shared by original native confirmation writers and visible-history readers. */
export const VERDICT_ENTRY_TYPE = 'auto-mode:verdict';

/** Stored verdict shape remains readable across the extension-to-host migration. */
export type VerdictData = {
  /** Human-readable description retained with the original audit event. */
  readonly action: string;
  /** Historical fingerprint remains audit data rather than current authorization. */
  readonly approvalFingerprint?: string;
  /** Historical reuse provenance remains readable but grants no native permission. */
  readonly reusedFromVerdict?: 'approve' | 'user-approve';
  /** Original automated or human outcome. */
  readonly verdict: 'approve' | 'deny' | 'ask' | 'user-approve' | 'user-deny';
  /** Explanation shown for the original decision. */
  readonly reason: string;
};

/** Native confirmation and fixed input protection return an explicit execution outcome. */
export type GuardDecision =
  | { readonly block: true; readonly reason: string }
  | { readonly block: false };

/**
 Narrow unknown session data before reading verdict fields.
 @param value - original session payload
 @returns whether ordinary property checks can inspect the payload
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 Preserve every existing verdict discriminator and optional historical field.
 @param data - original custom-entry payload
 @returns whether visible context can describe this audit record
 */
function isVerdictData(data: unknown): data is VerdictData {
  if (!isRecord(data) || typeof data.action !== 'string' || typeof data.reason !== 'string') return false;
  const { verdict } = data;
  if (verdict !== 'approve' && verdict !== 'deny' && verdict !== 'ask'
    && verdict !== 'user-approve' && verdict !== 'user-deny') return false;
  const { approvalFingerprint } = data;
  if (approvalFingerprint !== undefined && typeof approvalFingerprint !== 'string') return false;
  const { reusedFromVerdict } = data;
  return reusedFromVerdict === undefined || reusedFromVerdict === 'approve' || reusedFromVerdict === 'user-approve';
}

/**
 Recognize original audit entries without turning historical approval into current permission.
 @param entry - original session branch entry
 @returns whether visible context can retain the verdict payload
 */
export function isVerdictEntry(entry: {
  readonly type: string;
  readonly customType?: unknown;
  readonly data?: unknown;
}): entry is { type: 'custom'; customType: typeof VERDICT_ENTRY_TYPE; data: VerdictData } {
  return entry.type === 'custom' && entry.customType === VERDICT_ENTRY_TYPE && isVerdictData(entry.data);
}
//endregion
