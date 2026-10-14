/**
 Preserve original staged module identities when native build inputs move into generated output.

 @module
 */
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { NativeImportBuildError, rewriteNativeImports } from './build-imports.ts';

//region Staged source reads retain original module bases

/**
 Staged module identity failures remain separate from policy judgments.
 */
export class StagedImportError extends Error {
  /**
   Build failures identify their original source-validation boundary.
   */
  override readonly name = 'StagedImportError';
}

/**
 Diagnostics retain the stage and transformation function tags.
 */
const l = tagged({ tag: 'auto-mode-native-staged-import' });

/**
 Preserve static dependency targets when the original source moves into the generated directory.

 @param sourceUrl - original input whose relative imports retain this base

 @returns original source with relative static dependencies encoded as absolute URLs

 @throws StagedImportError when the original input cannot be parsed

 @example
 ```ts
 const source = await readStagedInput(new URL('./original.mjs', import.meta.url));
 ```
 */
export async function readStagedInput(sourceUrl: URL): Promise<string> {
  /**
   Read failures identify the affected original input.
   */
  const rl = tagged({ tag: readStagedInput.name, l });
  rl.debug(`reading original native build input: ${sourceUrl.href}`);
  /**
   File bytes are captured before synchronous source transformation.
   */
  const source = await readFile(sourceUrl, 'utf8');
  try {
    return rewriteNativeImports({
      source,
      path: sourceUrl.href,
      select: function retainOriginalStaticImport({ specifier, kind }): string {
        return kind === 'static' && specifier.startsWith('.') ? new URL(specifier, sourceUrl).href : specifier;
      },
    });
  } catch (error) {
    if (error instanceof NativeImportBuildError) throw new StagedImportError(`Cannot parse the original native build input: ${sourceUrl.href}`, { cause: error });
    throw error;
  }
}

//endregion Staged source reads retain original module bases

//region Generated import replacement verifies the original filesystem identity

/**
 Rewrite one generated import only when its file still resolves to the expected original input.

 @param source - original staged source containing the generated JSON-string import

 @param binding - exact generated binding whose dependency is being redirected

 @param expected - original input file selected by the qualified stage

 @param replacement - generated module URL encoded at the JavaScript boundary

 @returns source with the verified import redirected

 @throws StagedImportError when source spelling, URL selection, or file identity differs

 @example
 ```ts
 await replaceStagedImport({ source, binding: 'run', expected, replacement });
 ```
 */
export async function replaceStagedImport({ source, binding, expected, replacement }: {
  readonly source: string;
  readonly binding: string;
  readonly expected: URL;
  readonly replacement: string;
}): Promise<string> {
  /**
   Identity checks remain attributable to the original generated binding.
   */
  const rl = tagged({ tag: replaceStagedImport.name, l });
  rl.debug(`checking original generated import: ${binding}`);
  /**
   The qualified generator emits this exact binding spelling.
   */
  const prefix = `import {${binding}} from `;
  /**
   Ambiguous imports cannot be selected by position or first match.
   */
  const lines = source.split('\n').filter(function matchesStagedImportPrefix(line): boolean {
    return line.startsWith(prefix);
  });
  /**
   Capture the sole candidate before narrowing it for JSON decoding.
   */
  const [line] = lines;
  if (lines.length !== 1 || line === undefined || !line.endsWith(';')) throw new StagedImportError(`Expected one generated import for ${binding}`);
  try {
    /**
     Parsing remains unknown until the generated module specifier is checked.
     */
    const specifier: unknown = JSON.parse(line.slice(prefix.length, -1));
    if (typeof specifier !== 'string') throw new StagedImportError('Generated import must name a file URL');
    /**
     Query strings and fragments select separate module identities.
     */
    const observed = new URL(specifier);
    if (observed.search || observed.hash) throw new StagedImportError('Generated import must not select a separate module URL');
    if ((await realpath(fileURLToPath(observed))) !== (await realpath(fileURLToPath(expected)))) throw new StagedImportError('Generated import differs from its expected local build input');
  } catch (error) {
    throw new StagedImportError(`Cannot verify generated import for ${binding}`, { cause: error });
  }
  rl.debug(`verified original generated import: ${binding}`);
  return source.replace(line, `${prefix}${JSON.stringify(replacement)};`);
}

//endregion Generated import replacement verifies the original filesystem identity
