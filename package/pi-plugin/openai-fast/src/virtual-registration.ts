/** Genuine virtual selections with catalog-derived thinking and input capabilities. @module */

import { getSupportedThinkingLevels, type Api, type Model, } from '@earendil-works/pi-ai';
import type { ExtensionAPI, } from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { CODEX_PROVIDER, FAST_PROVIDER, PRIORITY_TARGET_PREFIX, } from './constants.ts';
import { FastModelError, } from './fast-model-error.ts';

//region Registration state

/** Module logger keeps catalog lifecycle visible without request payloads. */
const moduleLogger = tagged({ tag: 'pi-plugin-openai-fast.virtual-registration', },);

/**
 Create a catalog synchronizer whose registration state belongs to this extension factory.
 @param pi - host registration capability
 @returns synchronizer deriving all companion entries without a compatibility list
 @mutates pi - returned callback registers and removes native virtual selections
 */
export function createFastModelRegistration(pi: ForeignHostCapability<ExtensionAPI>,): (models: readonly Model<Api>[]) => void {
  const l = tagged({ tag: createFastModelRegistration.name, l: moduleLogger, },);
  const signatures = new Map<string, string>();

  /**
   Register changes only, avoiding recursive refresh work for unchanged virtual definitions.
   @param models - effective original Codex catalog
   @mutates models - invokes model capability accessors supplied by the provider
   */
  function synchronize(models: readonly Model<Api>[],): void {
    const sl = tagged({ tag: synchronize.name, l, },);
    const ids = new Set(models.map(function modelId(model,) { return model.id; },),);
    for (const previous of signatures.keys()) {
      if (!ids.has(previous,)) {
        pi.unregisterVirtualModel(FAST_PROVIDER, previous,);
        signatures.delete(previous,);
        sl.debug(`removed companion for ${previous}`,);
      }
    }
    for (const model of models) {
      const targetId = `${PRIORITY_TARGET_PREFIX}${model.id}`;
      if (model.id.startsWith(PRIORITY_TARGET_PREFIX,) || ids.has(targetId,)) {
        throw new FastModelError(`Codex model "${model.id}" conflicts with the fast extension's internal routing namespace. Rename the configured model or remove the fast extension.`,);
      }
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
      if (signatures.get(model.id,) === signature)
        continue;
      pi.registerVirtualModel({
        ...definition,
        route: function route(request, ctx,) {
          const rl = tagged({ tag: route.name, l: sl, },);
          const target = ctx.modelRegistry.find(CODEX_PROVIDER, targetId,);
          if (target === undefined) {
            throw new FastModelError(`Codex fast model "${model.id}" has no current priority target. Refresh models or select an available ordinary model.`,);
          }
          rl.debug(`routing ${request.reason} request for ${model.id}`,);
          return { model: target, thinkingLevel: request.thinkingLevel, };
        },
      },);
      signatures.set(model.id, signature,);
      sl.debug(`registered virtual companion for ${model.id}`,);
    }
    sl.trace(`catalog contains ${ids.size} companion identities`,);
  }
  return synchronize;
}

//endregion
