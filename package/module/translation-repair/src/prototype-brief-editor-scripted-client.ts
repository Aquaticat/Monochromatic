// PROTOTYPE ONLY: Candidate C zero-spend full-graph client.

import { wait, } from '@monochromatic-dev/module-async-time/ts';

import {
  carriesPicture,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type SyntheticClient,
} from './chat-contract.ts';
import { sourceUnitsFor, } from './prototype-brief-editor-plan.ts';

export function createPrototypeBriefEditorScriptedClient(
  {
    sourceText,
    archiveText,
  }: {
    readonly sourceText: string;
    readonly archiveText: string;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      await Promise.resolve();
      throw new Error('chatText unused by scripted brief editor');
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      const schemaName = request.responseFormat?.json_schema.name;
      if (schemaName === 'located_preparation_brief') {
        const value: unknown = { summary: 'Scripted empty brief.', items: [], };
        if (!request.validate(value,))
          throw new Error('scripted preparation brief failed schema');
        return { kind: 'ok', value, rawText: JSON.stringify(value,), };
      }
      if (schemaName !== 'brief_informed_complete_document')
        throw new Error(`scripted client received unknown schema ${schemaName}`);
      if (!carriesPicture({ messages: request.messages, }))
        throw new Error('scripted editor did not receive visual evidence');
      if (request.modelId === 'hf:moonshotai/Kimi-K3')
        await wait(20,);
      const targetQuote = archiveText.split('\n',).find(function nonempty(line,) {
        return line !== '';
      },) ?? archiveText;
      const value: unknown = {
        document: archiveText,
        realizations: sourceUnitsFor({ sourceText, }).map(function realization(unit,) {
          return { sourceUnitId: unit.id, targetQuote, };
        },),
        briefDispositions: [],
      };
      if (!request.validate(value,))
        throw new Error('scripted editor document failed schema');
      return { kind: 'ok', value, rawText: JSON.stringify(value,), };
    },
    quotas: async () => {
      await Promise.resolve();
      throw new Error('quotas unused by scripted brief editor');
    },
  };
}
