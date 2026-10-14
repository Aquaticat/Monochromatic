/**
 Resolve the qualified emitted graph and its installed dependencies before native hooks start.

 @module
 */
import { readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tagged } from '@monochromatic-dev/module-logger/ts';

//region Emitted modules retain their package-relative dependency boundary

/**
 Path resolution diagnostics identify the module before native hooks are registered.
 */
const l = tagged({ tag: 'auto-mode-native-paths' });

/**
 Artifact root is independent of the source checkout and the user's current home directory.
 */
export const nativeRoot: string = fileURLToPath(new URL('../../../', import.meta.url));

/**
 Maintained package owns the emitted artifact and the installed dependency boundary.
 */
export const maintainedRoot: string = fileURLToPath(new URL('../../', new URL('../../../', import.meta.url)));

l.debug('reading native artifact source manifest');

/**
 Retain parsed metadata without treating unchecked JSON as a typed release contract.
 */
export const sourceManifest: unknown = JSON.parse(await readFile(join(nativeRoot, 'source-manifest.json'), 'utf8'));

/**
 Installed SDK's real location selects sibling dependencies from the same package-manager graph.
 */
const installedSdk = await realpath(join(maintainedRoot, 'node_modules/@earendil-works/pi-coding-agent'));

/**
 Native coding-agent source was emitted from the qualified revision.
 */
export const sdk: string = join(nativeRoot, 'pi/coding-agent');

/**
 Native Agent source shares the host's qualified revision.
 */
export const core: string = join(nativeRoot, 'pi/agent');

/**
 Native provider source shares the host's qualified revision.
 */
export const ai: string = join(nativeRoot, 'pi/ai');

/**
 Codemode resolves from the installed host's actual sibling dependency.
 */
export const codemode: string = await realpath(join(dirname(installedSdk), 'pi-codemode'));

/**
 Terminal UI resolves from the installed host's actual sibling dependency.
 */
export const tui: string = await realpath(join(dirname(installedSdk), 'pi-tui'));

/**
 Only these native package names acquire the corresponding original module identities.
 */
export const installedRoots: ReadonlyMap<string, string> = new Map([
  ['pi-coding-agent', sdk],
  ['pi-agent-core', core],
  ['pi-ai', ai],
  ['pi-codemode', codemode],
  ['pi-tui', tui],
]);

/**
 Parser resolution uses the declared maintained dependency rather than a store-version spelling.
 */
const parserRequire = createRequire(import.meta.url);

/**
 Qualified parser entry remains available to native build consumers.
 */
export const parserPath: string = parserRequire.resolve('yuku-parser');

l.debug('native artifact paths resolved');

//endregion Emitted modules retain their package-relative dependency boundary
