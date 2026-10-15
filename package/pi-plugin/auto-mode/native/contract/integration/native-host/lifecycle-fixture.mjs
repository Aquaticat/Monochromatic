//region Original native services and fixture-owned replacement observations.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createEnvironment } from '../native-batch/environment.mjs';
import { isOwnedProgramDefinition } from '../native-batch/generated/program-definition.mjs';

export const env = await createEnvironment();
export function source(relative) { return pathToFileURL(join(
  env.packageRoot,
  'dist',
  relative
))
  .href; }
const {
  createAgentSessionServices,
  createAgentSessionFromServices
} = await import(source('core/agent-session-services.js'));
export const { nativeHost } = await import('./bootstrap.ts');
const { createCodemodeExtension } = await import(source('extensions/codemode/index.js'));

export const fixtureState = {
  trustCalls: 0,
  constructions: 0,
  cancelReplacement: false,
  replacementCallbacks: 0
};
function observeExtensions(pi) {
  pi.on(
    'session_before_switch',
    function chooseFixtureCancellation() { return ( ({ cancel: fixtureState.cancelReplacement })); }
  );
}
export async function createRuntime({
  cwd,
  agentDir,
  sessionManager,
  sessionStartEvent
}) {
  const services = await createAgentSessionServices({
    cwd,
    agentDir,
    modelRuntime: env.options
      .modelRuntime,
    settingsManager: env.options
      .settingsManager,
    resourceLoaderOptions: {
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      extensionFactories: [
        observeExtensions,
        createCodemodeExtension()
      ]
    },
    resourceLoaderReloadOptions: { async resolveProjectTrust() { fixtureState.trustCalls++;
    return true; } },
  });
  const result = await createAgentSessionFromServices({
    services,
    sessionManager,
    sessionStartEvent,
    model: env.options
      .model,
    noTools: true
  });
  fixtureState.constructions++;
  assert.equal(
    typeof result.session
      .agent
      .executeToolBatch,
    'function'
  );
  assert.equal(
    isOwnedProgramDefinition(result.session
      .getToolDefinition('codemode')),
    true,
    'The native built-in extension must retain the original owned program definition'
  );
  return {
    ...result,
    services
  };
}
//endregion
