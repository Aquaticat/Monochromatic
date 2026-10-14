import { createResourceInputOwner } from '../../collector/rule-relevance-sdk-copy/input/resource-owner.mjs';
import { createGoverningPolicyLoader } from '../policy-source/system-slot.mjs';
import {
  DefaultResourceLoader,
  readNativeExtensionToolInputs,
  readNativeExtensionToolOrigin,
  readNativeExtensionToolInputUsage,
} from '../native-batch/generated/resource-loader.mjs';
import {
  readActiveSessionResourceLoader,
  readActiveSessionSystemPrompt,
  readActiveSessionBaseComposition,
  readActiveSessionRunComposition,
  readActiveSessionInputUsage,
  readActiveSessionDomainEvents,
  readActiveSessionConstructedInputs,
} from '../native-batch/generated/agent-session.mjs';
import { registerHostResource } from './resource-reload.mjs';

//region Native services receive the original loader from its policy owner.

/** Bootstrap fixes designation separately from semantic qualification and permission. */
export function createHostResource({
  options,
  designation
}) {
  const owner = createResourceInputOwner({
    DefaultResourceLoader,
    readSessionLoader: readActiveSessionResourceLoader,
    readSessionPrompt: readActiveSessionSystemPrompt,
    readSessionBase: readActiveSessionBaseComposition,
    readSessionRun: readActiveSessionRunComposition,
  });
  const nativeApi = { current: undefined };
  function captureApi(pi) { nativeApi.current = pi; }
  const policyInput = createGoverningPolicyLoader({
    owner,
    readResourceToolInputs: readNativeExtensionToolInputs,
    readResourceToolOrigin: readNativeExtensionToolOrigin,
    readResourceToolUsage: readNativeExtensionToolInputUsage,
    readSessionInputUsage: readActiveSessionInputUsage,
    readSessionDomainEvents: readActiveSessionDomainEvents,
    readSessionConstructedInputs: readActiveSessionConstructedInputs,
    ...designation,
    options: {
      ...options,
      extensionFactories: [
        ...(options.extensionFactories ?? []),
        captureApi
      ]
    },
  });
  const record = Object.freeze({
    loader: policyInput.loader,
    policyInput,
    nativeApi,
    owner
  });
  registerHostResource(record);
  return record;
}

//endregion
