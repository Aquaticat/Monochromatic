import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const staging = join(import.meta.dirname, 'stage-private');
export const sourceManifest = JSON.parse(readFileSync(join(staging, 'manifest.json'), 'utf8'));
const {repoRoot} = sourceManifest;
const currentOutput = sourceManifest.output ?? staging;
if (typeof repoRoot !== 'string') throw new Error('Current SDK manifest has no repository dependency root');
const installedSdk = realpathSync(join(repoRoot, 'package/pi-plugin/auto-mode/node_modules/@earendil-works/pi-coding-agent'));
export const sdk = join(currentOutput, 'coding-agent');
export const core = join(currentOutput, 'agent');
export const ai = join(currentOutput, 'ai');
export const codemode = realpathSync(join(dirname(installedSdk), 'pi-codemode'));
export const tui = realpathSync(join(dirname(installedSdk), 'pi-tui'));
export const installedRoots = new Map([
  ['pi-coding-agent', sdk], ['pi-agent-core', core], ['pi-ai', ai],
  ['pi-codemode', codemode], ['pi-tui', tui],
]);
const parserRequire = createRequire(import.meta.url);
export const parserPath = parserRequire.resolve('yuku-parser');
