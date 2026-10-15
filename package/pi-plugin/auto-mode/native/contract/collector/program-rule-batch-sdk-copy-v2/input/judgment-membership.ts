/**
 Original enclosing response validation retains complete native tool membership and JSON snapshot order. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import { requireJSONInput } from './judgment-json.ts';
import { isProgramArray } from './program-array.ts';
import {
  JUDGMENT_JSON_BYTE_LIMIT,
  JUDGMENT_MEMBER_LIMIT,
  type JudgmentResponseInput,
  type JudgmentDeclaredMember,
  type JudgmentMembershipSnapshot
} from './judgment-member-types.ts';

/** Membership diagnostics omit original response text, tool arguments, and native identifiers. */
const l = tagged({ tag: 'auto-mode-judgment-membership' });

/** JSON-decoded tool candidates need original nonempty identity validation before publication. */
type DeclaredToolCandidate = Readonly<{
  type: 'toolCall';
  id?: unknown;
  name?: unknown;
}>;

/**
 Select native tool calls from the JSON-decoded response without treating unrelated parts as members.

 @param value - JSON-decoded response part

 @returns whether the original part declares a native tool call
 */
function isDeclaredTool(value: unknown): value is DeclaredToolCandidate {
  return typeof value === 'object' && value !== null && 'type' in value && value.type === 'toolCall';
}

/**
 Narrow original tool identifiers before checking duplicate membership.

 @param value - JSON-decoded native tool candidate

 @returns whether original identifier and name are nonempty strings
 */
function hasDeclaredIdentity(value: DeclaredToolCandidate): value is DeclaredToolCandidate & JudgmentDeclaredMember {
  return typeof value.id === 'string' && value.id !== '' && typeof value.name === 'string' && value.name !== '';
}

//region Original JSON admission precedes declared group identity publication.
/**
 Capture the original response only after validating every native tool argument.

 @param response - original SDK response carrying already owned content

 @returns bounded original JSON and frozen complete declared member identities

 @throws JudgmentConstructionError for an invalid JSON profile or incomplete native membership

 @throws TypeError when native serialization rejects the original response

 @example captureJudgmentMembership(response);
 */
export function captureJudgmentMembership(response: JudgmentResponseInput): JudgmentMembershipSnapshot {
  /** Diagnostic scope does not inspect original content or invoke caller getters. */
  const rl = tagged({ tag: captureJudgmentMembership.name, l });
  rl.debug('capturing original native membership');
  for (const part of response.content) {
    if (part.type === 'toolCall') requireJSONInput(part.arguments);
  }
  /** Serialize the original content after every native argument has passed value-preservation checks. */
  const parentJSON = JSON.stringify(response.content);
  if (typeof parentJSON !== 'string' || Buffer.byteLength(parentJSON) > JUDGMENT_JSON_BYTE_LIMIT) {
    throw new JudgmentConstructionError('Native enclosing response exceeds the declared JSON profile');
  }
  /** Decoded JSON prevents later caller mutation from changing declared membership. */
  const content: unknown = JSON.parse(parentJSON);
  if (!isProgramArray(content)) throw new JudgmentConstructionError('Native enclosing response has no content array');
  /** Complete tool membership follows original response order. */
  const declared = content.filter(isDeclaredTool);
  if (declared.length === 0 || declared.length > JUDGMENT_MEMBER_LIMIT || !declared.every(hasDeclaredIdentity)
    || new Set(declared.map(function declaredId(value) { return value.id; })).size !== declared.length) {
    throw new JudgmentConstructionError('Enclosing judgment requires complete unique native tool membership');
  }
  /** Fresh frozen identity records retain only the original identifier and native tool name. */
  const declaredNames = Object.freeze(declared.map(function declaredIdentity(value) {
    return Object.freeze({ id: value.id, name: value.name });
  }));
  return { parentJSON, declaredNames };
}
//endregion
