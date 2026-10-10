/**
 Tests acceptance confirmation uses distinct same-candidate responsibility.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  confirmAbsoluteNaturalness,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';
import { SEAT_SYNTHETIC_VISION_WITHHELD, } from './roster-seats.test-fixture.ts';
import { HANG_STOP_MS, } from './hang-stop.test-fixture.ts';

await describe({
  name: confirmAbsoluteNaturalness.name,
  children: [
    it({
      name: 'SENDS DISTINCT PROMPTS to same model for discovery and challenge',
      fn: async () => {
        /** Exact serialized prompts observed at model-facing boundary. */
        const prompts: string[] = [];
        const client: SyntheticClient = {
          chatText: async () => {
            throw new Error('chatText unused by confirmation fixture',);
          },
          chatJson: async <ValueT,>(
            request: ChatJsonRequest<ValueT>,
          ): Promise<ChatJsonOutcome<ValueT>> => {
            prompts.push(JSON.stringify(request.messages,),);
            const value: unknown = {
              acceptable: true,
              findings: [],
              reason: 'fixture accepts exact candidate',
            };
            if (!request.validate(value,))
              throw new Error('confirmation fixture response failed validation',);
            return {
              kind: 'ok',
              value,
              rawText: JSON.stringify(value,),
            };
          },
          quotas: async () => {
            throw new Error('quotas unused by confirmation fixture',);
          },
        };
        const confirmed = await confirmAbsoluteNaturalness({
          client,
          modelIds: [SEAT_SYNTHETIC_VISION_WITHHELD,],
          subject: {
            lineStructured: false,
            sourceText: '猫在睡觉。',
            candidateText: 'The cat is sleeping.',
            paragraphs: ['The cat is sleeping.',],
          },
          signal: AbortSignal.timeout(HANG_STOP_MS,),
          exchangeTimeoutMs: HANG_STOP_MS,
          l: tagged({ tag: 'absolute-confirmation-test', },),
        },);
        expect(confirmed.review.verdict,).toBe('acceptable',);
        expect(confirmed.confirmations,).toHaveLength(1,);
        expect(prompts,).toHaveLength(2,);
        expect(new Set(prompts,).size,).toBe(2,);
      },
    },),
  ],
},);
