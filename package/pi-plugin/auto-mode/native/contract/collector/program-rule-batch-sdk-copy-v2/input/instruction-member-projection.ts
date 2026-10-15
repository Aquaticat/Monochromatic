/**
 Original root projection access distinguishes absent records from absent claim bindings. @module
 */
import type { InstructionMember } from './instruction-types.ts';

/**
 Preserve original member projection failures before publishing instruction claims.

 @param memberRecord - original shared membership lookup

 @returns original root claim projection by reference

 @throws TypeError when original member record or its root claim binding is absent

 @example memberProjection(memberRecord);
 */
export function memberProjection(memberRecord?: InstructionMember): NonNullable<InstructionMember['binding']>['projection'] {
  if (memberRecord === undefined) throw new TypeError("Cannot read properties of undefined (reading 'binding')");
  /**
   Original root projection access fails before claim publication when its binding is absent.
   */
  const { binding } = memberRecord;
  if (binding === undefined) throw new TypeError("Cannot read properties of undefined (reading 'projection')");
  return binding.projection;
}
