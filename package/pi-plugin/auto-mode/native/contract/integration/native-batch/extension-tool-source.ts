/**
 Preserve native extension registration frames and resource-owned tool input receipts.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { replaceOnce } from './build-rebase.ts';

//region Original extension registration receives an observation capability through native callers

/**
 Extension source transformations retain a diagnostic boundary independent of runtime receipts.
 */
const l = tagged({ tag: 'auto-mode-native-extension-tool-source' });

/**
 Observe the actual registration frame before native validation and map updates.

 @param source - qualified original extension loader module

 @returns source forwarding one observation capability through every original load entry point

 @throws NativeBatchBuildError when a qualified original call site is absent or duplicated

 @example
 ```ts
 const generated = extensionToolSource(originalExtensionLoader);
 ```
 */
export function extensionToolSource(source: string): string {
 /**
  Loader transformations retain their own diagnostic boundary.
  */
 const rl = tagged({
   tag: extensionToolSource.name,
   l
 });
 rl.debug('preparing original extension registration observations');
 /**
  The native API factory receives the original resource owner's observer.
  */
 const apiSource = replaceOnce({
   source,
   from:'function createExtensionAPI(extension, runtime, cwd, eventBus) {',
   to:'function createExtensionAPI(extension, runtime, cwd, eventBus, observeToolInput) {'
 });
 /**
  Registration captures its actual arguments before any native validation can inspect them.
  */
 const registrationSource = replaceOnce({
   source: apiSource,
   from:'        registerTool(tool) {\n            assertActive();',
   to:'        registerTool(tool) {\n            observeToolInput?.({frame:arguments});\n            assertActive();'
 });
 /**
  Extension initialization forwards the same observer to API construction.
  */
 const initializerSource = replaceOnce({
   source: registrationSource,
   from:'async function initializeExtension(factory, extensionPath, resolvedPath, cwd, eventBus, runtime) {',
   to:'async function initializeExtension(factory, extensionPath, resolvedPath, cwd, eventBus, runtime, observeToolInput) {'
 });
 /**
  The API instance receives the capability at its original construction call.
  */
 const creationSource = replaceOnce({
   source: initializerSource,
   from:'    const load = createExtensionAPI(extension, runtime, cwd, eventBus);',
   to:'    const load = createExtensionAPI(extension, runtime, cwd, eventBus, observeToolInput);'
 });
 /**
  File-based loading retains the observer beside its original cache token.
  */
 const fileSource = replaceOnce({
   source: creationSource,
   from:'async function loadExtension(extensionPath, cwd, eventBus, runtime, cacheToken) {',
   to:'async function loadExtension(extensionPath, cwd, eventBus, runtime, cacheToken, observeToolInput) {'
 });
 /**
  The file-based initializer receives the original observer without changing native result handling.
  */
 const fileCallSource = replaceOnce({
   source: fileSource,
   from:'await initializeExtension(factory, extensionPath, resolvedPath, cwd, eventBus, runtime)',
   to:'await initializeExtension(factory, extensionPath, resolvedPath, cwd, eventBus, runtime, observeToolInput)'
 });
 /**
  Inline factory loading retains the original path default and adds only the observation capability.
  */
 const factorySource = replaceOnce({
   source: fileCallSource,
   from:'export async function loadExtensionFromFactory(factory, cwd, eventBus, runtime, extensionPath = "<inline>") {',
   to:'export async function loadExtensionFromFactory(factory, cwd, eventBus, runtime, extensionPath = "<inline>", observeToolInput) {'
 });
 /**
  Native inline initialization forwards the same capability after resolving the working directory.
  */
 const factoryCallSource = replaceOnce({
   source: factorySource,
   from:'return initializeExtension(factory, extensionPath, extensionPath, resolvedCwd, eventBus, runtime);',
   to:'return initializeExtension(factory, extensionPath, extensionPath, resolvedCwd, eventBus, runtime, observeToolInput);'
 });
 /**
  Batch loading preserves its original cache default and carries the observer into each load.
  */
 const batchSource = replaceOnce({
   source: factoryCallSource,
   from:'async function loadExtensionsInternal(paths, cwd, eventBus, runtime, useCache = false) {',
   to:'async function loadExtensionsInternal(paths, cwd, eventBus, runtime, useCache = false, observeToolInput) {'
 });
 /**
  Every original batch member forwards the original resource observer.
  */
 const batchCallSource = replaceOnce({
   source: batchSource,
   from:'await loadExtension(extPath, resolvedCwd, resolvedEventBus, resolvedRuntime, cacheToken)',
   to:'await loadExtension(extPath, resolvedCwd, resolvedEventBus, resolvedRuntime, cacheToken, observeToolInput)'
 });
 /**
  The uncached entry point preserves its explicit native cache choice.
  */
 const uncachedSource = replaceOnce({
   source: batchCallSource,
   from:'export async function loadExtensions(paths, cwd, eventBus, runtime) {\n    return loadExtensionsInternal(paths, cwd, eventBus, runtime);',
   to:'export async function loadExtensions(paths, cwd, eventBus, runtime, observeToolInput) {\n    return loadExtensionsInternal(paths, cwd, eventBus, runtime, false, observeToolInput);'
 });
 return replaceOnce({
   source: uncachedSource,
   from:'export async function loadExtensionsCached(paths, cwd, eventBus, runtime) {\n    return loadExtensionsInternal(paths, cwd, eventBus, runtime, true);',
   to:'export async function loadExtensionsCached(paths, cwd, eventBus, runtime, observeToolInput) {\n    return loadExtensionsInternal(paths, cwd, eventBus, runtime, true, observeToolInput);'
 });
}

//endregion Original extension registration receives an observation capability through native callers

//region Original resource owners retain their bounded tool input store

/**
 Extend the native resource owner with its existing bounded input store.

 @param source - qualified original resource loader module

 @returns source retaining tool receipts on the original resource owner

 @throws NativeBatchBuildError when a qualified original call site is absent or duplicated

 @example
 ```ts
 const generated = resourceToolSource(originalResourceLoader);
 ```
 */
export function resourceToolSource(source: string): string {
 /**
  Resource transformations retain their own diagnostic boundary.
  */
 const rl = tagged({
   tag: resourceToolSource.name,
   l
 });
 rl.debug('preparing original resource-owned tool receipts');
 /**
  Resource instances expose bounded receipt readers without publishing their mutable owner.
  */
 const ownerSource = replaceOnce({
   source,
   from:'export class DefaultResourceLoader {',
   to:`let readExtensionInputs, readExtensionOrigin, readExtensionUsage;
export function readNativeExtensionToolInputs(loader) { return readExtensionInputs(loader); }
export function readNativeExtensionToolOrigin(input) { return readExtensionOrigin(input); }
export function readNativeExtensionToolInputUsage(loader) { return readExtensionUsage(loader); }
export class DefaultResourceLoader {
    #toolInputOwner = captureResourceToolInputs();
    #observeToolInput = input => this.#toolInputOwner.captureExtensionToolInput(input);
    static {
        readExtensionUsage = loader => loader.#toolInputOwner.inputUsage();
        readExtensionInputs = loader => {
            loader.#toolInputOwner.assertCaptured();
            return loader.#toolInputOwner.readConstructedInputs();
        };
        readExtensionOrigin = ({loader,publication}) => {
            loader.#toolInputOwner.assertCaptured();
            return loader.#toolInputOwner.lookup(publication);
        };
    }`
 });
 /**
  Initial loading keeps the native default runtime while forwarding the receipt observer.
  */
 const initialSource = replaceOnce({
   source: ownerSource,
   from:'await loadExtensionsCached(extensionPaths, this.cwd, this.eventBus)',
   to:'await loadExtensionsCached(extensionPaths, this.cwd, this.eventBus, undefined, this.#observeToolInput)'
 });
 /**
  Reloaded non-builtin paths retain their original filter and runtime.
  */
 const reloadSource = replaceOnce({
   source: initialSource,
   from:'await loadExtensionsCached(paths.filter((path) => !isBuiltinPath(path)), this.cwd, this.eventBus, runtime)',
   to:'await loadExtensionsCached(paths.filter((path) => !isBuiltinPath(path)), this.cwd, this.eventBus, runtime, this.#observeToolInput)'
 });
 /**
  Builtin factories retain their original runtime and path at the observer boundary.
  */
 const builtinSource = replaceOnce({
   source: reloadSource,
   from:'await loadExtensionFromFactory(builtin.factory, this.cwd, this.eventBus, result.runtime, path)',
   to:'await loadExtensionFromFactory(builtin.factory, this.cwd, this.eventBus, result.runtime, path, this.#observeToolInput)'
 });
 /**
  Inline factories share the same original resource receipt store.
  */
 const factorySource = replaceOnce({
   source: builtinSource,
   from:'await loadExtensionFromFactory(factory, this.cwd, this.eventBus, runtime, extensionPath)',
   to:'await loadExtensionFromFactory(factory, this.cwd, this.eventBus, runtime, extensionPath, this.#observeToolInput)'
 });
 return `import {captureResourceToolInputs} from ${JSON.stringify(new URL(
   '../../collector/run-prompt-custody-v3/loaded-inputs.mjs',
   import.meta.url
 ).href)
   };\n${
   factorySource}`;
}

//endregion Original resource owners retain their bounded tool input store
