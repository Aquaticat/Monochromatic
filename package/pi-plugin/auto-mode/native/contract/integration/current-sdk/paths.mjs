import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const nativeRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const maintainedRoot = fileURLToPath(new URL('../../', new URL('../../../', import.meta.url)));
export const sourceManifest = JSON.parse(readFileSync(join(nativeRoot, 'source-manifest.json'), 'utf8'));
const installedSdk = realpathSync(join(maintainedRoot, 'node_modules/@earendil-works/pi-coding-agent'));
export const sdk = join(nativeRoot, 'pi/coding-agent');
export const core = join(nativeRoot, 'pi/agent');
export const ai = join(nativeRoot, 'pi/ai');
export const codemode = realpathSync(join(dirname(installedSdk), 'pi-codemode'));
export const tui = realpathSync(join(dirname(installedSdk), 'pi-tui'));
export const installedRoots = new Map([
  ['pi-coding-agent', sdk], ['pi-agent-core', core], ['pi-ai', ai],
  ['pi-codemode', codemode], ['pi-tui', tui],
]);
const parserRequire = createRequire(import.meta.url);
export const parserPath = parserRequire.resolve('yuku-parser');
