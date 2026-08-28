/**
 * Tests post-consolidation naturalness rewrite through final fidelity gate.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  polishConsolidation,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Active invented-size roster for every synthetic role.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.2',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
] as const;

/**
 * Literal but faithful base wording.
 */
const BASE = 'She faced life proactively and spent a good time with everyone, while doing her best to stay hopeful and connected to the people around her.';

/**
 * Faithful idiomatic rewrite.
 */
const POLISHED = 'She maintained a positive outlook on life and spent some good times with everyone, doing her best to stay hopeful and connected to those around her.';

/**
 * Client serving rewrite, selection and final gate schemas.
 */
const client: SyntheticClient = {
  chatText: async () => {
    throw new Error('chatText unused by structured polish stages',);
  },
  chatJson: async <ValueT,>(
    request: ChatJsonRequest<ValueT>,
  ): Promise<ChatJsonOutcome<ValueT>> => {
    /**
     * Schema identifying stage role.
     */
    const schema = request.responseFormat
      ?.json_schema
      .name;
    /**
     * Synthetic reply for requested stage.
     */
    const value: unknown = (schema === 'refine_report')
      ? {
        rewrites: [
          {
            paragraph: 1,
            newText: POLISHED,
          },
        ],
      }
      : (schema === 'candidate_ballot')
      ? {
        best: 1,
        reason: 'clear idiomatic improvement with same meaning',
      }
      : (schema === 'consolidation_polish_gate')
      ? {
        choice: 'polished',
        unsupported: [],
        dropped: [],
        reason: 'equally faithful and more idiomatic',
      }
      : {};
    if (!request.validate(value,))
      throw new Error(`synthetic ${String(schema,)} reply failed validation`,);
    return {
      kind: 'ok',
      value,
      rawText: JSON.stringify(value,),
    };
  },
  quotas: async () => {
    throw new Error('quotas unused by polish stages',);
  },
};

await describe({
  name: polishConsolidation.name,
  children: [
    it({
      name: 'SHIPS IDIOMATIC REWRITE only after selection and fidelity-first gate',
      fn: async () => {
        const polish = await polishConsolidation({
          client,
          sourceText: '她曾积极地面对生活，和大家度过了一段不错的时光。',
          archiveText: BASE,
          baseText: BASE,
          lineStructured: false,
          sliceIndex: 1,
          config: {
            refinerModelIds: [ROSTER[0],],
            judgeModelIds: ROSTER,
            gateModelIds: ROSTER,
            declaredNames: [],
            definitions: '',
          },
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-test', },),
        },);
        expect(polish.kind,).toBe('settled',);
        if (polish.kind !== 'settled')
          throw new Error('body polish fixture did not run',);
        expect(polish.changed,).toBe(true,);
        expect(polish.text,).toBe(POLISHED,);
        expect(polish.gate?.ships,).toBe('polished',);
        expect(polish.rounds.length,).toBe(1,);
      },
    },),

    it({
      name: 'SKIPS SYNTAX-BEARING FRONT MATTER before any model call',
      fn: async () => {
        const polish = await polishConsolidation({
          client,
          sourceText: '---\nname: 猫猫\n---\n',
          archiveText: '---\nname: Maomao\n---\n',
          baseText: '---\nname: Maomao\n---\n',
          syntax: 'front-matter',
          lineStructured: false,
          sliceIndex: 0,
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-test', },),
        },);
        expect(polish,).toEqual({
          kind: 'not-run',
          reason: 'front-matter',
        },);
      },
    },),
  ],
},);
