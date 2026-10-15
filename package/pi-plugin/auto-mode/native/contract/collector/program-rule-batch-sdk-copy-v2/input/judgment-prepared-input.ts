/**
 Final prepared-member validation retains original identity, frozen input, and JSON serialization order. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import { requireJSONInput } from './judgment-json.ts';
import { isProgramArray } from './program-array.ts';
import {
  JUDGMENT_JSON_BYTE_LIMIT,
  type JudgmentDeclaredMember,
  type JudgmentPreparedCandidate
} from './judgment-member-types.ts';

/**
 Validation diagnostics omit prepared input and declared native identifiers.
 */
const l = tagged({ tag: 'auto-mode-judgment-prepared-input' });

//region Complete immutable membership precedes every input-preservation and byte-bound check.
/**
 Serialize final prepared members only after checking complete original identity and input freezing.

 @param members - original native prepared group

 @param declaredNames - complete identities captured from the original enclosing response

 @returns original bounded prepared-group JSON

 @throws JudgmentConstructionError for changed membership, unsealed input, or an invalid JSON profile

 @throws TypeError when native serialization rejects the original prepared group

 @example capturePreparedJudgmentJSON({ members, declaredNames });
 */
export function capturePreparedJudgmentJSON({
  members,
  declaredNames
}: Readonly<{
  members: readonly JudgmentPreparedCandidate[];
  declaredNames: readonly JudgmentDeclaredMember[];
}>): string {
  /**
   Diagnostic scope is independent of native input and serialization callbacks.
   */
  const rl = tagged({
    tag: capturePreparedJudgmentJSON.name,
    l
  });
  rl.debug('capturing original prepared membership');
  if ((!isProgramArray(members)) || (!Object.isFrozen(members))
    || (members.length !== declaredNames.length)) {
    throw new JudgmentConstructionError('Prepared group differs from complete declared membership');
  }
  for (let index = 0; index < members.length; index += 1) {
    /**
     Original member can still be absent in a malformed sparse group.
     */
    const member = members[index];
    /**
     Complete declared membership has already been authenticated by the original response snapshot.
     */
    const expected = nonNullishOrThrow(declaredNames[index]);
    if ((!member) || (!Object.isFrozen(member))
      || (member.id !== expected.id)
      || (member.name !== expected.name)
      || (!Object.hasOwn(
        member,
        'input'
      ))
      || (!Object.isFrozen(member.input))) {
      throw new JudgmentConstructionError('Prepared member identity or sealed input differs from the native group');
    }
  }
  for (const member of members) requireJSONInput(member.input);
  /**
   Native serialization runs after every member identity and input-value check succeeds.
   */
  const preparedJSON = JSON.stringify(members);
  if (((typeof preparedJSON) !== 'string') || (Buffer.byteLength(preparedJSON) > JUDGMENT_JSON_BYTE_LIMIT)) {
    throw new JudgmentConstructionError('Prepared member data exceeds the declared JSON profile');
  }
  return preparedJSON;
}
//endregion
