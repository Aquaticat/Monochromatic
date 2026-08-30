// PROTOTYPE ONLY: Candidate B zero-spend full-graph client.

import { wait, } from '@monochromatic-dev/module-async-time/ts';

import {
  carriesPicture,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type SyntheticClient,
} from './chat-contract.ts';
import { sourceUnitsFor, } from './prototype-brief-editor-plan.ts';
import { compilerBaseDigest, } from './prototype-spec-compiler-plan.ts';

function systemText<ValueT,>({ request, }: { readonly request: ChatJsonRequest<ValueT>; }): string {
  const message = request.messages[0];
  return (message === undefined) || (typeof message.content !== 'string') ? '' : message.content;
}

export function createSpecificationCompilerScriptedClient(
  {
    sourceText,
    archiveText,
    rendererInvalid,
    specificationInvalid,
  }: {
    readonly sourceText: string;
    readonly archiveText: string;
    readonly rendererInvalid: boolean;
    readonly specificationInvalid: boolean;
  },
): SyntheticClient {
  const units = sourceUnitsFor({ sourceText, });
  const realizations = units.map(function realization(unit,) {
    return { sourceUnitId: unit.id, targetQuote: '---', occurrence: 1, };
  },);
  return {
    chatText: async () => {
      await Promise.resolve();
      throw new Error('chatText unused by scripted compiler');
    },
    chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
      if (!carriesPicture({ messages: request.messages, }))
        throw new Error('scripted compiler call omitted images');
      const schema = request.responseFormat?.json_schema.name;
      let value: unknown;
      if (schema === 'source_specification') {
        value = {
          summary: 'Scripted specification.',
          units: units.map(function specified(unit, index,) {
            return {
              sourceUnitId: specificationInvalid && (index === 0) ? 'wrong/0' : unit.id,
              obligations: ['Carry source unit.',],
            };
          },),
        };
      }
      else if (schema === 'specification_linked_document') {
        const system = systemText({ request, });
        if (system.includes('accountable whole-document renderer',)) {
          value = {
            mode: 'render',
            baseDigest: null,
            document: archiveText,
            realizations: rendererInvalid
              ? [{ ...realizations[0]!, sourceUnitId: 'wrong/0', }, ...realizations.slice(1,),]
              : realizations,
            changes: [],
          };
        }
        else if (rendererInvalid) {
          if (request.modelId === 'hf:moonshotai/Kimi-K3')
            await wait(20,);
          value = {
            mode: 'fallback',
            baseDigest: null,
            document: archiveText,
            realizations,
            changes: [],
          };
        }
        else {
          value = {
            mode: 'revision',
            baseDigest: `${compilerBaseDigest({ base: archiveText, })}-wrong`,
            document: archiveText,
            realizations,
            changes: [],
          };
        }
      }
      else
        throw new Error(`scripted compiler received unknown schema ${String(schema,)}`);
      if (!request.validate(value,))
        throw new Error('scripted compiler value failed response schema');
      return { kind: 'ok', value, rawText: JSON.stringify(value,), };
    },
    quotas: async () => {
      await Promise.resolve();
      throw new Error('quotas unused by scripted compiler');
    },
  };
}
