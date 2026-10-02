/**
 Built extension discovery through the real pi CLI in disposable offline state.

 @module
 */
import { spawnSync, } from 'node:child_process';
import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { fileURLToPath, } from 'node:url';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { CODEX_PROVIDER, OPENAI_PROVIDER, } from '../dist/final/node/index.mjs';
import { fixtureHome, } from './host-fixture-home.ts';
import { fixtureModel, } from './host-fixture-model.ts';
import { HOST_TOKEN, } from './host-fixture-provider.ts';

//region Startup discovery uses the built default factory, never manual registration.

await describe({ name: 'built default extension startup', children: [
  it({ name: 'discovers both fast namespaces through pi list-models without inference or personal settings', fn: async function startupDiscovery() {
    /** Every child-created file stays in this fixture's independently disposable home. */
    await using home = await fixtureHome();
    /** Resolved host entry anchors the installed CLI and its native resource directory. */
    const hostEntry = new URL(import.meta.resolve('@earendil-works/pi-coding-agent'),);
    /** Only the consumer artifact is loaded, not package TypeScript implementation. */
    const extension = fileURLToPath(new URL('../dist/final/node/index.mjs', import.meta.url,),);
    /** A shared model ID detects missing registration for either independent namespace. */
    const model = fixtureModel({ id: 'startup-openai-fixture', },);
    await writeFile(home.modelsPath, JSON.stringify({ providers: {
      [CODEX_PROVIDER]: { apiKey: HOST_TOKEN, models: [model,], },
      [OPENAI_PROVIDER]: { apiKey: 'sk-startup-fixture', models: [{ ...model, api: 'openai-responses',
        provider: OPENAI_PROVIDER, baseUrl: 'https://api.openai.com/v1', },], },
    }, },),);
    await writeFile(join(home.agentDir, 'settings.json',), JSON.stringify({ packages: [],
      enableAnalytics: false, enableInstallTelemetry: false, },),);
    /** Listing initializes the real factory but sends no inference request. */
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('cli.js', hostEntry,),),
      '--offline', '--no-approve', '--no-extensions', '--extension', extension,
      '--no-skills', '--no-themes', '--no-prompt-templates', '--no-context-files',
      '--list-models', model.id,], {
      cwd: home.cwd, timeout: 15_000, maxBuffer: 1_048_576, encoding: 'utf8',
      env: { ...process.env, HOME: home.root, PI_CODING_AGENT_DIR: home.agentDir,
        PI_PACKAGE_DIR: fileURLToPath(new URL('../', hostEntry,),), PI_OFFLINE: '1', },
    },);
    if (result.error !== undefined)
      throw result.error;
    expect(result.status,).toBe(0,);
    expect(result.stdout,).toContain('openai-fast',);
    expect(result.stdout,).toContain('openai-codex-fast',);
    expect(result.stdout,).toContain(model.id,);
    expect(result.stderr,).toBe('',);
  }, timeout: 30_000, },),
], },);

//endregion Startup discovery.
