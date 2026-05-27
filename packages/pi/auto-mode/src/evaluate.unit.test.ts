/**
 * Tests for evaluate verdict-to-decision helpers.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import { decisionForDenyVerdict, } from './evaluate.ts';

await describe({
  name: decisionForDenyVerdict.name,
  children: [
    it({
      name: 'returns judge reason and guidance in blocked decision',
      fn: async function returnsReasonAndGuidance() {
        /** Decision returned to the tool-call handler for a judge deny verdict. */
        const decision = decisionForDenyVerdict({
          verdict: {
            verdict: 'deny',
            reason: 'This command can delete user data.',
            guidance: 'Use a dry-run command first.',
          },
        },);

        expect(decision.block,).toBe(true,);
        if (!decision.block)
          throw new Error('Expected judge deny verdict to block the tool call.',);
        expect(decision.reason,).toContain(
          'Guardrail reason: This command can delete user data.',
        );
        expect(decision.reason,).toContain('Guidance: Use a dry-run command first.',);
      },
    },),
  ],
},);
