import assert from 'node:assert/strict';

/** Add receipt observation to the actual registration frame without replacing native validation or map updates. */
export function extensionToolSource(source){
 function replace({
   before,
   after
 }){assert.equal(
   source.split(before)
     .length,
   2,
   `Native extension receipt edit: ${before}`
 );source=source.replace(
   before,
   after
 );}
 replace({
   before:'function createExtensionAPI(extension, runtime, cwd, eventBus) {',
   after:'function createExtensionAPI(extension, runtime, cwd, eventBus, observeToolInput) {'
 });
 replace({
   before:'        registerTool(tool) {\n            assertActive();',
   after:'        registerTool(tool) {\n            observeToolInput?.({frame:arguments});\n            assertActive();'
 });
 replace({
   before:'async function initializeExtension(factory, extensionPath, resolvedPath, cwd, eventBus, runtime) {',
   after:'async function initializeExtension(factory, extensionPath, resolvedPath, cwd, eventBus, runtime, observeToolInput) {'
 });
 replace({
   before:'    const load = createExtensionAPI(extension, runtime, cwd, eventBus);',
   after:'    const load = createExtensionAPI(extension, runtime, cwd, eventBus, observeToolInput);'
 });
 replace({
   before:'async function loadExtension(extensionPath, cwd, eventBus, runtime, cacheToken) {',
   after:'async function loadExtension(extensionPath, cwd, eventBus, runtime, cacheToken, observeToolInput) {'
 });
 replace({
   before:'await initializeExtension(factory, extensionPath, resolvedPath, cwd, eventBus, runtime)',
   after:'await initializeExtension(factory, extensionPath, resolvedPath, cwd, eventBus, runtime, observeToolInput)'
 });
 replace({
   before:'export async function loadExtensionFromFactory(factory, cwd, eventBus, runtime, extensionPath = "<inline>") {',
   after:'export async function loadExtensionFromFactory(factory, cwd, eventBus, runtime, extensionPath = "<inline>", observeToolInput) {'
 });
 replace({
   before:'return initializeExtension(factory, extensionPath, extensionPath, resolvedCwd, eventBus, runtime);',
   after:'return initializeExtension(factory, extensionPath, extensionPath, resolvedCwd, eventBus, runtime, observeToolInput);'
 });
 replace({
   before:'async function loadExtensionsInternal(paths, cwd, eventBus, runtime, useCache = false) {',
   after:'async function loadExtensionsInternal(paths, cwd, eventBus, runtime, useCache = false, observeToolInput) {'
 });
 replace({
   before:'await loadExtension(extPath, resolvedCwd, resolvedEventBus, resolvedRuntime, cacheToken)',
   after:'await loadExtension(extPath, resolvedCwd, resolvedEventBus, resolvedRuntime, cacheToken, observeToolInput)'
 });
 replace({
   before:'export async function loadExtensions(paths, cwd, eventBus, runtime) {\n    return loadExtensionsInternal(paths, cwd, eventBus, runtime);',
   after:'export async function loadExtensions(paths, cwd, eventBus, runtime, observeToolInput) {\n    return loadExtensionsInternal(paths, cwd, eventBus, runtime, false, observeToolInput);'
 });
 replace({
   before:'export async function loadExtensionsCached(paths, cwd, eventBus, runtime) {\n    return loadExtensionsInternal(paths, cwd, eventBus, runtime, true);',
   after:'export async function loadExtensionsCached(paths, cwd, eventBus, runtime, observeToolInput) {\n    return loadExtensionsInternal(paths, cwd, eventBus, runtime, true, observeToolInput);'
 });
 return source;
}

/** Extend the native resource owner with the existing bounded input store; no external registry is introduced. */
export function resourceToolSource(source){
 function replace({
   before,
   after
 }){assert.equal(
   source.split(before)
     .length,
   2,
   `Native resource tool receipt edit: ${before}`
 );source=source.replace(
   before,
   after
 );}
 replace({
   before:'export class DefaultResourceLoader {',
   after:`let readExtensionInputs, readExtensionOrigin, readExtensionUsage;
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
 replace({
   before:'await loadExtensionsCached(extensionPaths, this.cwd, this.eventBus)',
   after:'await loadExtensionsCached(extensionPaths, this.cwd, this.eventBus, undefined, this.#observeToolInput)'
 });
 replace({
   before:'await loadExtensionsCached(paths.filter((path) => !isBuiltinPath(path)), this.cwd, this.eventBus, runtime)',
   after:'await loadExtensionsCached(paths.filter((path) => !isBuiltinPath(path)), this.cwd, this.eventBus, runtime, this.#observeToolInput)'
 });
 replace({
   before:'await loadExtensionFromFactory(builtin.factory, this.cwd, this.eventBus, result.runtime, path)',
   after:'await loadExtensionFromFactory(builtin.factory, this.cwd, this.eventBus, result.runtime, path, this.#observeToolInput)'
 });
 replace({
   before:'await loadExtensionFromFactory(factory, this.cwd, this.eventBus, runtime, extensionPath)',
   after:'await loadExtensionFromFactory(factory, this.cwd, this.eventBus, runtime, extensionPath, this.#observeToolInput)'
 });
 return `import {captureResourceToolInputs} from ${JSON.stringify(new URL(
   '../../collector/run-prompt-custody-v3/loaded-inputs.mjs',
   import.meta.url
 ).href)
   };\n${
   source}`;
}
