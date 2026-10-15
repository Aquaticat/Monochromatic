/**
 Original judgment membership retains native declared identities independently of prepared values. @module
 */

/** Native response parts remain owned by the enclosing SDK response before serialization. */
export type JudgmentResponsePart = Readonly<{
  type: string;
  arguments?: unknown;
}>;

/** Original response content is read separately for argument validation and serialization. */
export type JudgmentResponseInput = Readonly<{
  content: readonly JudgmentResponsePart[];
}>;

/** Complete original native identities determine final prepared membership and order. */
export type JudgmentDeclaredMember = Readonly<{
  id: string;
  name: string;
}>;

/** Frozen native response metadata contains no execution permission. */
export type JudgmentMembershipSnapshot = Readonly<{
  parentJSON: string;
  declaredNames: readonly JudgmentDeclaredMember[];
}>;

/** Prepared candidates retain unknown values until the original identity and JSON checks finish. */
export type JudgmentPreparedCandidate = Readonly<{
  id?: unknown;
  name?: unknown;
  input?: unknown;
}>;

/** Original declared JSON limit is shared by enclosing response and final prepared-group snapshots. */
export const JUDGMENT_JSON_BYTE_LIMIT = 1_048_576;

/** Original enclosing response can declare at most this many native tool calls. */
export const JUDGMENT_MEMBER_LIMIT = 64;
