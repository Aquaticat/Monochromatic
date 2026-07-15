/**
 * Packed cli-git artifact contract verification.
 *
 * @module
 */
import {
  readFile,
  readdir,
} from 'node:fs/promises';
import {
  createRequire,
  isBuiltin,
} from 'node:module';
import {
  assertIncludes,
  execute,
} from './built-consumer-helpers.ts';

/**
 * Dynamic-import target retained by packed artifact.
 */
type DynamicImportTarget = Readonly<{
  /**
   * Whether import target is static text or computed syntax.
   */
  kind: 'literal' | 'computed';
  /**
   * Module specifier or exact computed expression source.
   */
  value: string;
}>;

/**
 * Parser boundary loaded from packed runtime dependency.
 */
type ArtifactParser = Readonly<{
  /**
   * Parses complete ECMAScript module.
   */
  parse: (
    source: string,
    options: Readonly<{
      allowHashBang: boolean;
      ecmaVersion: 'latest';
      sourceType: 'module';
    }>,
  ) => unknown;
}>;

/**
 * Narrows runtime package value to parser boundary.
 *
 * @param value - package export value
 *
 * @returns whether value exposes callable parser
 */
function isArtifactParser(value: unknown,): value is ArtifactParser {
  return ((typeof value) === 'object')
    && (value !== null)
    && ('parse' in value)
    && ((typeof value.parse) === 'function');
}

/**
 * Collects dynamic import targets from bounded Acorn syntax tree.
 *
 * @param value - syntax node, child collection, or scalar
 *
 * @param source - complete artifact source
 *
 * @returns dynamic import targets in source order
 */
function dynamicImportTargets({
  value,
  source,
}: Readonly<{
  value: unknown;
  source: string;
}>,): readonly DynamicImportTarget[] {
  if (Array.isArray(value,)) {
    return value.flatMap(function collectChild(child,) {
      return dynamicImportTargets({
        value: child,
        source,
      },);
    },);
  }
  if (((typeof value) !== 'object') || (value === null))
    return [];
  if ((!('type' in value)) || (value.type !== 'ImportExpression')) {
    return Object.values(value,)
      .flatMap(function collectProperty(child,) {
        return dynamicImportTargets({
          value: child,
          source,
        },);
      },);
  }
  if (!('source' in value))
    throw new Error('packed artifact dynamic import has no syntax source',);
  /**
   * Acorn import-expression source node.
   */
  const importSource = value.source;
  if (((typeof importSource) !== 'object') || (importSource === null))
    throw new Error('packed artifact dynamic import has invalid syntax source',);
  if (('value' in importSource) && ((typeof importSource.value) === 'string')) {
    return [{
      kind: 'literal',
      value: importSource.value,
    },];
  }
  if (!('start' in importSource))
    throw new Error('packed artifact computed import has no source start',);
  if ((typeof importSource.start) !== 'number')
    throw new Error('packed artifact computed import has invalid source start',);
  if (!('end' in importSource))
    throw new Error('packed artifact computed import has no source end',);
  if ((typeof importSource.end) !== 'number')
    throw new Error('packed artifact computed import has invalid source end',);
  return [{
    kind: 'computed',
    value: source.slice(
      importSource.start,
      importSource.end,
    ),
  },];
}

/**
 * Verifies packed files, dependency closure, import inertness, and dynamic-import exemptions.
 *
 * @example
 * ```ts
 * await verifyBuiltArtifactContract();
 * ```
 */
export async function verifyBuiltArtifactContract(): Promise<void> {
  /**
   * Packed JavaScript and declaration artifact names.
   */
  const artifactFiles = (await readdir('/work/node_modules/@monochromatic-dev/cli-git/dist/final/node',))
    .toSorted();
  /**
   * Exact files permitted in packed runtime artifact directory.
   */
  const expectedArtifactFiles = [
    'index.d.mts',
    'index.mjs',
  ];
  if (JSON.stringify(artifactFiles,) !== JSON.stringify(expectedArtifactFiles,))
    throw new Error(`packed cli-git artifact files mismatch: ${artifactFiles.join(', ')}`,);
  /**
   * Packed executable source used for syntax-boundary audit.
   */
  const artifactSource = await readFile(
    '/work/node_modules/@monochromatic-dev/cli-git/dist/final/node/index.mjs',
    'utf8',
  );
  /**
   * Acorn parser resolved from packed cli-git runtime dependencies.
   */
  const parser: unknown = createRequire('/work/package.json',)('acorn');
  if (!isArtifactParser(parser,))
    throw new Error('packed acorn dependency has no parse function',);
  /**
   * Complete packed artifact syntax tree.
   */
  const artifactSyntax = parser.parse(
    artifactSource,
    {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowHashBang: true,
    },
  );
  /**
   * Dynamic imports permitted only at documented library and trusted-ESM boundaries.
   */
  const retainedDynamicImports = dynamicImportTargets({
    value: artifactSyntax,
    source: artifactSource,
  },);
  /**
   * Literal runtime imports permitted only at lazy trust-build boundary.
   */
  const permittedLiteralImports: ReadonlySet<string> = new Set(['rolldown',],);
  if (retainedDynamicImports.some(function hasUnknownLiteral(target,) {
    return (target.kind === 'literal')
      && (!isBuiltin(target.value,))
      && (!permittedLiteralImports.has(target.value,));
  },))
    throw new Error(`packed artifact retained unknown literal dynamic import: ${JSON.stringify(retainedDynamicImports,)}`,);
  if (!retainedDynamicImports.some(function hasLazyRolldownImport(target,) {
    return (target.kind === 'literal') && (target.value === 'rolldown');
  },))
    throw new Error('packed artifact omitted lazy direct Rolldown trust-build import',);
  /**
   * Known computed imports: cross-runtime path library and exact stored-MJS execution.
   */
  const permittedComputedImports: ReadonlySet<string> = new Set([
    'nodePathSpecifier',
    'executableUrl.href',
  ],);
  if (retainedDynamicImports.some(function hasUnknownComputedImport(target,) {
    return (target.kind === 'computed') && (!permittedComputedImports.has(target.value,));
  },))
    throw new Error(`packed artifact retained unknown computed dynamic import: ${JSON.stringify(retainedDynamicImports,)}`,);
  if (!retainedDynamicImports.some(function hasStoredMjsImport(target,) {
    return (target.kind === 'computed') && (target.value === 'executableUrl.href');
  },))
    throw new Error('packed artifact omitted exact stored-MJS execution import',);
  /**
   * Published TypeScript source retained for explicit source consumers.
   */
  const sourceFiles = await readdir(
    '/work/node_modules/@monochromatic-dev/cli-git/src',
    { recursive: true, },
  );
  if (!sourceFiles.includes('index.ts',))
    throw new Error('packed cli-git omitted public TypeScript source entry',);
  if (sourceFiles.some(function isDevelopmentOnlySource(path,) {
    return path.endsWith('.unit.test.ts',)
      || path.endsWith('.host-evidence.ts',)
      || path.startsWith('maintenance/',)
      || path.startsWith('trust/fixture/',);
  },))
    throw new Error('packed cli-git retained development-only TypeScript source',);
  /**
   * Installed packages in private workspace scope.
   */
  const scopedPackages = (await readdir('/work/node_modules/@monochromatic-dev',))
    .toSorted();
  if (JSON.stringify(scopedPackages,) !== JSON.stringify(['cli-git',],))
    throw new Error(`packed cli-git retained private workspace packages: ${scopedPackages.join(', ')}`,);
  /**
   * Package-root import proving policy export and inert executable boundary.
   */
  const packageImport = await execute({
    command: 'node',
    args: [
      '--input-type=module',
      '--eval',
      `import { repositoryPolicyPlugin } from '@monochromatic-dev/cli-git';
console.log(JSON.stringify({ name: repositoryPolicyPlugin.name, exitCode: process.exitCode ?? null }));`,
    ],
    cwd: '/work',
  },);
  assertIncludes({
    text: packageImport.stdout,
    expected: '{"name":"repository","exitCode":null}',
    context: 'packed package-root import',
  },);
}
