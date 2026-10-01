/**
 Read-only bootstrap of the host's configured Codex catalog and native provider. @module
 */

import type {
  CredentialStore,
  Provider,
} from '@earendil-works/pi-ai';
import { ModelRuntime, } from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { CODEX_PROVIDER, } from './constants.ts';
import { FastModelError, } from './fast-model-error.ts';

//region Credential-free catalog bootstrap

/**
 Module logger reports lifecycle without credential or prompt data.
 */
const moduleLogger = tagged({ tag: 'pi-plugin-openai-fast.catalog', },);

/**
 Prevent bootstrap discovery from reading or changing the user's credentials.
 
 @returns credential store that permits only empty metadata reads
 */
export function createCatalogCredentials(): CredentialStore {
  /**
   Credential-store logger records only metadata bootstrap lifecycle.
   */
  const l = tagged({
    tag: createCatalogCredentials.name,
    l: moduleLogger,
  },);
  l.trace('creating credential-free catalog reader',);
  return {
    read: async function read() { return undefined; },
    list: async function list() { return []; },
    modify: async function modify() {
      throw new FastModelError('Read-only Codex catalog bootstrap attempted to change credentials.',);
    },
    delete: async function deleteCredential() {
      throw new FastModelError('Read-only Codex catalog bootstrap attempted to delete credentials.',);
    },
  };
}

/**
 Load configured Codex metadata and persisted catalogs without real credentials or network refresh.
 
 @param modelsPath - optional disposable model configuration for tests
 
 @returns effective native Codex provider whose auth resolves later in the real host
 
 @throws FastModelError when the model configuration or native provider is unavailable
 */
export async function loadCodexProvider({ modelsPath, }: { readonly modelsPath?: string; } = {},): Promise<Provider> {
  /**
   Catalog logger excludes credential and header values.
   */
  const l = tagged({
    tag: loadCodexProvider.name,
    l: moduleLogger,
  },);
  l.debug('loading configured Codex model metadata without credential access',);
  /**
   Disposable metadata runtime has no access to stored real credentials.
   */
  const catalog = await ModelRuntime.create({
    credentials: createCatalogCredentials(),
    refreshOnCreate: false,
    allowModelNetwork: false,
    ...(modelsPath === undefined ? {} : { modelsPath, }),
  },);
  /**
   Native cache restoration runs without network or OAuth refresh.
   */
  const refresh = await catalog.refresh({
    allowNetwork: false,
    providers: [CODEX_PROVIDER,],
  },);
  /**
   Cache restoration errors remain explicit initialization failures.
   */
  const refreshError = refresh.errors
    .get(CODEX_PROVIDER,);
  if (refreshError !== undefined)
    throw new FastModelError(`Cannot restore the Codex model catalog: ${String(refreshError,)}. Correct the cached catalog or model configuration.`,);
  /**
   Configuration diagnostics prevent registering misleading companion entries.
   */
  const problem = catalog.getError();
  if (problem !== undefined)
    throw new FastModelError(`Cannot initialize Codex fast models: ${problem}. Correct the model configuration before loading the fast extension.`,);
  /**
   Effective source includes configured metadata and restored native cache data.
   */
  const provider = catalog.getProvider(CODEX_PROVIDER,);
  if (provider === undefined)
    throw new FastModelError('The native openai-codex provider is unavailable. Restore the native provider before loading the fast extension.',);
  l.debug(`loaded ${provider.getModels()
    .length} base Codex models`,);
  return provider;
}

//endregion
