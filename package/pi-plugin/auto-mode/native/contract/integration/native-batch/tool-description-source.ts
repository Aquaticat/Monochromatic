/**
 Preserve original tool descriptions and loadout observations in the qualified Session source.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { replaceOnce } from './build-rebase.ts';

//region Each original callback boundary is transformed exactly once

/**
 Tool input transformations retain a separate diagnostic boundary.
 */
const l = tagged({ tag: 'auto-mode-native-tool-description-source' });

/**
 Observe constructor prose and callback inputs before native mutation or aggregation.

 @param source - qualified original Session module

 @returns generated module retaining original tool input and output occurrences

 @throws NativeBatchBuildError when an original callback site is absent or duplicated

 @example
 ```ts
 const generated = sessionToolDescriptionSource(originalSession);
 ```
 */
export function sessionToolDescriptionSource(source: string): string {
 /**
  Log source preparation without exposing original tool descriptions.
  */
 const rl = tagged({ tag: sessionToolDescriptionSource.name, l });
 rl.debug('capturing original Session tool-description boundaries');
 /**
  Constructor input is captured before loadout preparation can mutate it.
  */
 const constructorSource = replaceOnce({
   source,
   from:'        this.sessionManager = config.sessionManager;',
   to:'        this.sessionManager = config.sessionManager;\n        captureNativeCustomToolDescriptions({manager:this.sessionManager,frame:arguments});'
 });
 /**
  One query observer owns the callbacks of this native loadout occurrence.
  */
 const querySource = replaceOnce({
   source: constructorSource,
   from:'        if (hooks.length > 0) {\n            const loadout = {',
   to:'        if (hooks.length > 0) {\n            const queries = createNativeToolLoadoutQueries(this.sessionManager);\n            const loadout = {'
 });
 /**
  Exposure queries preserve their original arguments and returned value.
  */
 const exposureSource = replaceOnce({
   source: querySource,
   from:'                getExposure: (name) => this._getToolExposure(name),',
   to:'                getExposure: (name, ...additionalArguments) => { queries.input({method:"getExposure",name,additionalArguments}); return queries.observe({method:"getExposure",name,additionalArguments,value:this._getToolExposure(name)}); },'
 });
 /**
  Namespace queries retain the original definition lookup.
  */
 const namespaceSource = replaceOnce({
   source: exposureSource,
   from:'                getNamespace: (name) => this._toolDefinitions.get(name)?.definition.namespace,',
   to:'                getNamespace: (name, ...additionalArguments) => { queries.input({method:"getNamespace",name,additionalArguments}); return queries.observe({method:"getNamespace",name,additionalArguments,value:this._toolDefinitions.get(name)?.definition.namespace}); },'
 });
 /**
  Guideline queries preserve the native empty-list fallback.
  */
 const guidelineSource = replaceOnce({
   source: namespaceSource,
   from:'                getPromptGuidelines: (name) => this._toolPromptGuidelines.get(name) ?? [],',
   to:'                getPromptGuidelines: (name, ...additionalArguments) => { queries.input({method:"getPromptGuidelines",name,additionalArguments}); return queries.observe({method:"getPromptGuidelines",name,additionalArguments,value:this._toolPromptGuidelines.get(name) ?? []}); },'
 });
 /**
  Each hook receives its own original input observation.
  */
 const inputSource = replaceOnce({
   source: guidelineSource,
   from:'            for (const { definition, sourceInfo } of hooks) {\n                try {',
   to:'            for (const { definition, sourceInfo } of hooks) {\n                captureNativeToolLoadoutInput({manager:this.sessionManager,input:loadout});\n                try {'
 });
 /**
  Returned changes remain attached to their original hook call.
  */
 const outputSource = replaceOnce({
   source: inputSource,
   from:'                    const changes = definition.prepareLoadout?.(loadout);',
   to:'                    const changes = definition.prepareLoadout?.(loadout);\n                    queries.assertHealthy();\n                    captureNativeToolLoadoutOutput({manager:this.sessionManager,output:changes});'
 });
 /**
  Observation failures cannot be swallowed by native extension error reporting.
  */
 const errorSource = replaceOnce({
   source: outputSource,
   from:'                catch (error) {\n                    this._extensionRunner.emitError({\n                        extensionPath: sourceInfo.path,\n                        event: "prepare_loadout",',
   to:'                catch (error) {\n                    rethrowNativeLoadoutObservation(error);\n                    try {\n                    this._extensionRunner.emitError({\n                        extensionPath: sourceInfo.path,\n                        event: "prepare_loadout",'
 });
 /**
  Report failures retain both causes before the next hook is entered.
  */
 const completedSource = replaceOnce({
   source: errorSource,
   from:'                    });\n                }\n            }\n            declared = tools.map((tool) => {',
   to:'                    });\n                    } catch (reportError) { queries.reportFailed({nativeError:error,reportError}); }\n                }\n                queries.assertHealthy();\n            }\n            declared = tools.map((tool) => {'
 });
 return `import {captureNativeCustomToolDescriptions,captureNativeToolLoadoutInput,captureNativeToolLoadoutOutput,rethrowNativeLoadoutObservation,createNativeToolLoadoutQueries} from "./session-manager.js";\n${completedSource}`;
}

//endregion Each original callback boundary is transformed exactly once
