// PROTOTYPE ONLY: Candidate G zero-spend lifecycle client.

import { wait, } from '@monochromatic-dev/module-async-time/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import type { RosterModelId, } from './roster-id.ts';

/** One observed scripted provider dispatch without response wording. */
export type RealizationScriptedCall = {
  readonly modelId: RosterModelId;
  readonly schemaName: string;
};

/** Extracts fixture response from image-bearing lifecycle prompt. */
function scriptedResponseText({ request, }: {
  readonly request: Parameters<SyntheticClient['chatJson']>[0];
}): string {
  const message = request.messages[0];
  if ((message === undefined) || (typeof message.content === 'string'))
    throw new Error('realization scripted prompt omitted content parts');
  const textPart = message.content.find(function text(part,) { return part.type === 'text'; });
  if ((textPart === undefined) || (textPart.type !== 'text'))
    throw new Error('realization scripted prompt omitted response text');
  const marker = 'SCRIPTED_RESPONSE=';
  const start = textPart.text.indexOf(marker,);
  if (start < 0)
    throw new Error('realization scripted prompt omitted response marker');
  return textPart.text.slice(start + marker.length,);
}

/** Adds duplicate decoded top-level member while retaining later valid value. */
function duplicateTopLevelMember({ schemaName, rawText, }: {
  readonly schemaName: string;
  readonly rawText: string;
}): string {
  if (schemaName === 'verified_realization_author')
    return `{"slots":[],${rawText.slice(1,)}`;
  if (schemaName === 'verified_realization_ballot')
    return `{"candidates":[],${rawText.slice(1,)}`;
  return rawText;
}

/** Creates deterministic response client with optional duplicate and abort arms. */
export function createRealizationScriptedClient({
  responseForRequest,
  duplicateSchemaName,
  duplicateModelId,
  abortSchemaName,
  abortModelId,
  abortController,
  abortReason,
  abortAfterResponseSchemaName,
  abortAfterResponseModelId,
  delaySchemaName,
  delayModelId,
  throwSchemaName,
  throwModelId,
}: {
  readonly responseForRequest?: (request: Parameters<SyntheticClient['chatJson']>[0]) => unknown;
  readonly duplicateSchemaName?: string;
  readonly duplicateModelId?: RosterModelId;
  readonly abortSchemaName?: string;
  readonly abortModelId?: RosterModelId;
  readonly abortController?: AbortController;
  readonly abortReason?: Error;
  readonly abortAfterResponseSchemaName?: string;
  readonly abortAfterResponseModelId?: RosterModelId;
  readonly delaySchemaName?: string;
  readonly delayModelId?: RosterModelId;
  readonly throwSchemaName?: string;
  readonly throwModelId?: RosterModelId;
} = {}): {
  readonly client: SyntheticClient;
  readonly calls: RealizationScriptedCall[];
} {
  const calls: RealizationScriptedCall[] = [];
  return {
    calls,
    client: {
      chatText: async function unusedText() {
        await Promise.resolve();
        throw new Error('realization scripted text call is unused');
      },
      chatJson: async function scriptedJson(request,) {
        const schemaName = request.responseFormat?.json_schema.name ?? '';
        calls.push({ modelId: request.modelId, schemaName, });
        if ((schemaName === abortSchemaName)
          && ((abortModelId === undefined) || (abortModelId === request.modelId))) {
          if ((abortController === undefined) || (abortReason === undefined))
            throw new Error('realization scripted abort fixture is incomplete');
          abortController.abort(abortReason,);
          throw request.signal.reason;
        }
        if ((schemaName === throwSchemaName)
          && ((throwModelId === undefined) || (throwModelId === request.modelId)))
          throw new Error('realization scripted potentially transmitted failure');
        if ((schemaName === delaySchemaName)
          && ((delayModelId === undefined) || (delayModelId === request.modelId))) {
          for (let elapsedMs = 0; elapsedMs < 1_000; elapsedMs += 10) {
            if (request.signal.aborted)
              throw request.signal.reason;
            await wait(10,);
          }
        }
        const value: unknown = responseForRequest === undefined
          ? JSON.parse(scriptedResponseText({ request, }),)
          : responseForRequest(request,);
        const responseText = JSON.stringify(value,);
        const rawText = (schemaName === duplicateSchemaName)
          && ((duplicateModelId === undefined) || (duplicateModelId === request.modelId))
          ? duplicateTopLevelMember({ schemaName, rawText: responseText, })
          : responseText;
        if ((schemaName === abortAfterResponseSchemaName)
          && ((abortAfterResponseModelId === undefined) || (abortAfterResponseModelId === request.modelId))) {
          if ((abortController === undefined) || (abortReason === undefined))
            throw new Error('realization scripted post-response abort fixture is incomplete');
          abortController.abort(abortReason,);
        }
        return request.validate(value,)
          ? { kind: 'ok', value, rawText, }
          : {
            kind: 'schema-mismatch',
            rawText,
            reason: 'caller-guard-rejected',
            detail: 'realization scripted caller guard rejected fixture',
          };
      },
      quotas: async function unusedQuotas() {
        await Promise.resolve();
        throw new Error('realization scripted quota call is unused');
      },
    },
  };
}
