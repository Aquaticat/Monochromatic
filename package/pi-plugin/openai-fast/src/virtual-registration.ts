/** Genuine virtual selections derived from every current physical Codex model. @module */

import { getSupportedThinkingLevels, type Api, type Model, } from '@earendil-works/pi-ai';
import type { ExtensionAPI, } from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { FAST_PROVIDER, PRIORITY_TARGET_PREFIX, } from './constants.ts';
import { FastModelError, } from './fast-model-error.ts';

//region Registration state

/** Module logger records catalog changes without prompts or authentication. */
const moduleLogger = tagged({ tag: 'pi-plugin-openai-fast.virtual-registration', },);

/**
 Create a guarded synchronizer whose registration state belongs to this extension factory.
 @param pi - host registration capability
 @returns synchronizer without a compatibility list or request-global fast flag
 @mutates pi - returned callback registers and removes native virtual selections
 */
export function createFastModelRegistration(pi: ForeignHostCapability<ExtensionAPI>,): (models: readonly Model<Api>[]) => void {
  const l = tagged({ tag: createFastModelRegistration.name, l: moduleLogger, },);
  const signatures = new Map<string, string>();
  let synchronizing = false;

  /** Register structural changes while nested catalog reads remain side-effect-free. */
  function synchronize(input: readonly Model<Api>[],): void {
    const sl = tagged({ tag: synchronize.name, l, },);
    if (synchronizing) {
      sl.trace('skipping nested catalog registration',);
      return;
    }
    synchronizing = true;
    try {
      const models = input.filter(function physicalModel(model,) { return model.api !== 'pi-virtual'; },);
      const ids = new Set(models.map(function modelId(model,) { return model.id; },),);
      for (const model of models) {
        if (model.id.startsWith(PRIORITY_TARGET_PREFIX,) || ids.has(`${PRIORITY_TARGET_PREFIX}${model.id}`,)) {
          throw new FastModelError(`Codex model "${model.id}" conflicts with the fast extension's internal routing namespace. Rename the configured model or remove the fast extension.`,);
        }
      }
      for (const previous of signatures.keys()) {
        if (!ids.has(previous,)) {
          signatures.delete(previous,);
          pi.unregisterVirtualModel(FAST_PROVIDER, previous,);
          sl.debug(`removed companion for ${previous}`,);
        }
      }
      for (const model of models) {
        const targetId = `${PRIORITY_TARGET_PREFIX}${model.id}`;
        const definition = {
          provider: FAST_PROVIDER,
          id: model.id,
          name: `${model.name} Fast`,
          thinkingLevels: getSupportedThinkingLevels(model,),
          input: model.input,
          contextWindow: model.contextWindow,
          maxTokens: model.maxTokens,
        };
        const signature = JSON.stringify(definition,);
        const previous = signatures.get(model.id,);
        if (previous === signature)
          continue;
        signatures.set(model.id, signature,);
        try {
          pi.registerVirtualModel({
            ...definition,
            route: function route(request, ctx,) {
              const rl = tagged({ tag: route.name, l: sl, },);
              const target = ctx.modelRegistry.find(FAST_PROVIDER, targetId,);
              if (target === undefined)
                throw new FastModelError(`Codex fast model "${model.id}" has no current priority target. Refresh models or select an available ordinary model.`,);
              rl.debug(`routing ${request.reason} request for ${model.id}`,);
              return { model: target, thinkingLevel: request.thinkingLevel, };
            },
          },);
        }
        catch (error) {
          if (previous === undefined)
            signatures.delete(model.id,);
          else
            signatures.set(model.id, previous,);
          sl.error(`virtual registration failed for ${model.id}: ${String(error,)}`,);
          throw error;
        }
        sl.debug(`registered virtual companion for ${model.id}`,);
      }
      sl.trace(`catalog contains ${ids.size} companion identities`,);
    }
    finally {
      synchronizing = false;
    }
  }
  return synchronize;
}

//endregion
