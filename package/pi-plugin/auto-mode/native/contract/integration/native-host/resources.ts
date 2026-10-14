/**
 Construct original native resources under the existing policy owner.

 @module
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { NativePolicyDesignation } from './bootstrap-types.ts';
import type { NativeCliResource, NativeResourceApi, NativeResourceOptions } from './resource-construction-types.ts';
import {
  createResourceInputOwner,
  createGoverningPolicyLoader,
  DefaultResourceLoader,
  readNativeExtensionToolInputs,
  readNativeExtensionToolOrigin,
  readNativeExtensionToolInputUsage,
  readActiveSessionResourceLoader,
  readActiveSessionSystemPrompt,
  readActiveSessionBaseComposition,
  readActiveSessionRunComposition,
  readActiveSessionInputUsage,
  readActiveSessionDomainEvents,
  readActiveSessionConstructedInputs,
} from './resource-dependencies.mjs';
import { registerHostResource } from './resource-reload.ts';

//region Native services receive the original loader from its policy owner.

/**
 Resource construction keeps its own diagnostic boundary.
 */
const l=tagged({tag:'auto-mode-native-host-resources'});

/**
 Bootstrap fixes designation separately from semantic qualification and permission.

 @param options - original native resource options captured by the host

 @param designation - original governing file and authority selection

 @returns registered original loader, policy input, API publication, and cleanup owner

 @throws Error when original native resources or policy input cannot be constructed

 @example
 ```ts
 const resource=createHostResource({options,designation});
 ```
 */
export function createHostResource({
  options,
  designation
}: {readonly options:NativeResourceOptions;readonly designation:NativePolicyDesignation}): NativeCliResource {
  /**
   Construction diagnostics never serialize original input values or native capabilities.
   */
  const rl=tagged({tag:createHostResource.name,l});
  rl.debug('constructing original native host resources');
  /**
   The incumbent constructor owner retains private loader and source membership.
   */
  const owner = createResourceInputOwner({
    DefaultResourceLoader,
    readSessionLoader: readActiveSessionResourceLoader,
    readSessionPrompt: readActiveSessionSystemPrompt,
    readSessionBase: readActiveSessionBaseComposition,
    readSessionRun: readActiveSessionRunComposition,
  });
  /**
   The original extension callback publishes its latest native API for approval context creation.
   */
  const nativeApi: NativeResourceApi = {};
  /**
   Preserve the current original API after extension loading and resource reload.

   @param pi - original API supplied by native extension loading
   */
  function captureApi(pi: ExtensionAPI): void {
    /**
     API publication retains its own function tag without logging the capability.
     */
    const al=tagged({tag:captureApi.name,l:rl});
    al.debug('capturing original native resource API');
    nativeApi.current = pi;
  }
  /**
   The original policy owner receives existing options and one additional native API observer.
   */
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
  /**
   Registration freezes only this owned outer record; original native capabilities remain borrowed.
   */
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
