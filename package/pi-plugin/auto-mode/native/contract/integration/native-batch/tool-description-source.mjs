import assert from 'node:assert/strict';

/** Observe original constructor prose and callback inputs/outputs before native mutation or aggregation. */
export function sessionToolDescriptionSource(source){
 function replace({
   before,
   after
 }){
  assert.equal(
    source.split(before)
      .length,
    2,
    `Original Session tool-input boundary: ${before}`
  );
  source=source.replace(
    before,
    after
  );
 }
 replace({
   before:'        this.sessionManager = config.sessionManager;',
   after:'        this.sessionManager = config.sessionManager;\n        captureNativeCustomToolDescriptions({manager:this.sessionManager,frame:arguments});'
 });
 replace({
   before:'        if (hooks.length > 0) {\n            const loadout = {',
   after:'        if (hooks.length > 0) {\n            const queries = createNativeToolLoadoutQueries(this.sessionManager);\n            const loadout = {'
 });
 replace({
   before:'                getExposure: (name) => this._getToolExposure(name),',
   after:'                getExposure: (name, ...additionalArguments) => { queries.input({method:"getExposure",name,additionalArguments}); return queries.observe({method:"getExposure",name,additionalArguments,value:this._getToolExposure(name)}); },'
 });
 replace({
   before:'                getNamespace: (name) => this._toolDefinitions.get(name)?.definition.namespace,',
   after:'                getNamespace: (name, ...additionalArguments) => { queries.input({method:"getNamespace",name,additionalArguments}); return queries.observe({method:"getNamespace",name,additionalArguments,value:this._toolDefinitions.get(name)?.definition.namespace}); },'
 });
 replace({
   before:'                getPromptGuidelines: (name) => this._toolPromptGuidelines.get(name) ?? [],',
   after:'                getPromptGuidelines: (name, ...additionalArguments) => { queries.input({method:"getPromptGuidelines",name,additionalArguments}); return queries.observe({method:"getPromptGuidelines",name,additionalArguments,value:this._toolPromptGuidelines.get(name) ?? []}); },'
 });
 replace({
   before:'            for (const { definition, sourceInfo } of hooks) {\n                try {',
   after:'            for (const { definition, sourceInfo } of hooks) {\n                captureNativeToolLoadoutInput({manager:this.sessionManager,input:loadout});\n                try {'
 });
 replace({
   before:'                    const changes = definition.prepareLoadout?.(loadout);',
   after:'                    const changes = definition.prepareLoadout?.(loadout);\n                    queries.assertHealthy();\n                    captureNativeToolLoadoutOutput({manager:this.sessionManager,output:changes});'
 });
 replace({
   before:'                catch (error) {\n                    this._extensionRunner.emitError({\n                        extensionPath: sourceInfo.path,\n                        event: "prepare_loadout",',
   after:'                catch (error) {\n                    rethrowNativeLoadoutObservation(error);\n                    try {\n                    this._extensionRunner.emitError({\n                        extensionPath: sourceInfo.path,\n                        event: "prepare_loadout",'
 });
 replace({
   before:'                    });\n                }\n            }\n            declared = tools.map((tool) => {',
   after:'                    });\n                    } catch (reportError) { queries.reportFailed({nativeError:error,reportError}); }\n                }\n                queries.assertHealthy();\n            }\n            declared = tools.map((tool) => {'
 });
 return `import {captureNativeCustomToolDescriptions,captureNativeToolLoadoutInput,captureNativeToolLoadoutOutput,rethrowNativeLoadoutObservation,createNativeToolLoadoutQueries} from "./session-manager.js";\n${source}`;
}
