/**
 * Tests for model-facing block feedback formatting.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { formatModelBlockReason, } from './model-feedback.ts';
import { DEFAULT_DENY_GUIDANCE, } from './system-prompt.ts';

await describe({
  name: formatModelBlockReason.name,
  children: [
    it({
      name: 'includes guardrail reason and guidance',
      fn: async function includesReasonAndGuidance() {
        /** Feedback returned to the main model when auto-mode blocks a tool call. */
        const feedback = formatModelBlockReason({
          guardrailReason: 'This reads a secret file.',
          guidance: 'Ask the user to provide the value directly.',
        },);

        expect(feedback,).toContain('Guardrail reason: This reads a secret file.',);
        expect(feedback,).toContain(
          'Guidance: Ask the user to provide the value directly.',
        );
      },
    },),

    it({
      name: 'falls back to default guidance when judge guidance is empty',
      fn: async function fallsBackToDefaultGuidance() {
        /** Feedback returned when the judge omits actionable deny guidance. */
        const feedback = formatModelBlockReason({
          guardrailReason: 'This command is too risky.',
          guidance: '',
        },);

        expect(feedback,).toContain('Guardrail reason: This command is too risky.',);
        expect(feedback,).toContain(`Guidance: ${DEFAULT_DENY_GUIDANCE}`,);
      },
    },),
  ],
},);
