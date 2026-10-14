/**
 Preserve original staged module identities when native build inputs move into generated output.

 @module
 */
import {
  readFile,
  realpath
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { type ImportDeclaration, parse } from 'yuku-parser';
import {
  NativeImportBuildError,
  rewriteNativeImports
} from './build-imports.ts';

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
  const rl = tagged({
    tag: readStagedInput.name,
    l
  });
  rl.debug(`reading original native build input: ${sourceUrl.href}`);
  /**
   File bytes are captured before synchronous source transformation.
   */
  const source = await readFile(
    sourceUrl,
    'utf8'
  );
  try {
    return rewriteNativeImports({
      source: sourceUrl.pathname
        .endsWith('.ts') ? stripTypeScriptTypes(source) : source,
      path: sourceUrl.href,
      select: function retainOriginalStaticImport({
        specifier,
        kind
      }): string {
        return (kind === 'static') && specifier.startsWith('.') ? new URL(
          specifier,
          sourceUrl
        ).href : specifier;
      },
    });
  } catch (error) {
    if (error instanceof NativeImportBuildError) throw new StagedImportError(
      `Cannot parse the original native build input: ${sourceUrl.href}`,
      { cause: error }
    );
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
export async function replaceStagedImport({
  source,
  binding,
  expected,
  replacement
}: {
  readonly source: string;
  readonly binding: string;
  readonly expected: URL;
  readonly replacement: string;
}): Promise<string> {
  /**
   Identity checks remain attributable to the original generated binding.
   */
  const rl = tagged({
    tag: replaceStagedImport.name,
    l
  });
  rl.debug(`checking original generated import: ${binding}`);
  /**
   Select the original executable import rather than its formatting or comments.
   */
  const parsed = parse(
    source,
    { sourceType: 'module' }
  );
  if (parsed.diagnostics
    .length
    > 0) throw new StagedImportError('Cannot parse the original generated import');
  /**
   Ambiguous imports cannot be selected by position or first match.
   */
  const declarations: ImportDeclaration[] = [];
  for (const node of parsed.program.body) {
    if ((node.type !== 'ImportDeclaration') || (node.specifiers.length !== 1)) continue;
    /**
     Only the original named binding can select this generated dependency.
     */
    const [specifier] = node.specifiers;
    if ((specifier?.type === 'ImportSpecifier') && (specifier.local
      .name
      === binding)
      && (specifier.imported
        .type
        === 'Identifier')
      && (specifier.imported
        .name
        === binding)) declarations.push(node);
  }
  /**
   Capture the sole candidate before narrowing it for JSON decoding.
   */
  const [declaration] = declarations;
  if ((declarations.length !== 1) || (declaration?.type !== 'ImportDeclaration')) throw new StagedImportError(`Expected one generated import for ${binding}`);
  try {
    /**
     The parser supplies the decoded original module value.
     */
    const specifier = declaration.source
      .value;
    /**
     Query strings and fragments select separate module identities.
     */
    const observed = new URL(specifier);
    if (observed.search || observed.hash) throw new StagedImportError('Generated import must not select a separate module URL');
    if ((await realpath(fileURLToPath(observed))) !== (await realpath(fileURLToPath(expected)))) throw new StagedImportError('Generated import differs from its expected local build input');
  } catch (error) {
    throw new StagedImportError(
      `Cannot verify generated import for ${binding}`,
      { cause: error }
    );
  }
  rl.debug(`verified original generated import: ${binding}`);
  return source.slice(
    0,
    declaration.source
      .start
  ) + JSON.stringify(replacement)
    + source.slice(declaration.source
      .end);
}

//endregion Generated import replacement verifies the original filesystem identity
