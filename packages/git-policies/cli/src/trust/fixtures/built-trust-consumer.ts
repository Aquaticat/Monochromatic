/**
 * Packed shadow-bin trust lifecycle in disposable container. @module
 */
import {
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import {
  createRequire,
  isBuiltin,
} from 'node:module';
import {
  delimiter,
  join,
} from 'node:path';
import {
  assertIncludes,
  assertJsonl,
  execute,
} from './built-consumer-helpers.ts';
import { verifyAutofixTransactionConsumer, } from './built-autofix-transaction-consumer.ts';
import { verifyPostCommitPolicyConsumer, } from './built-post-commit-policy-consumer.ts';
import { verifyPostCommitRoutingConsumer, } from './built-post-commit-routing-consumer.ts';
import { verifyPolicyConfigConsumer, } from './built-policy-config-consumer.ts';
import { verifyPolicyDefaultConsumer, } from './built-policy-default-consumer.ts';
import { verifyRecursiveConsumer, } from './built-recursive-consumer.ts';
import { verifyRepositoryPluginConsumer, } from './built-repository-plugin-consumer.ts';
import { verifyTypeScriptConsumer, } from './built-typescript-consumer.ts';

/**
 * Dynamic-import target retained by packed artifact.
 */
type DynamicImportTarget = Readonly<{
  /** Whether import target is static text or computed syntax. */
  kind: 'literal' | 'computed';
  /** Module specifier or exact computed expression source. */
  value: string;
}>;

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
  if (Array.isArray(value,))
    return value.flatMap(function collectChild(child,) {
      return dynamicImportTargets({ value: child, source, },);
    },);
  if (((typeof value) !== 'object') || (value === null))
    return [];
  if (('type' in value) && (value.type === 'ImportExpression')) {
    if ((!('source' in value)) || ((typeof value.source) !== 'object') || (value.source === null))
      throw new Error('packed artifact dynamic import has no syntax source',);
    if (('value' in value.source) && ((typeof value.source.value) === 'string'))
      return [{ kind: 'literal', value: value.source.value, },];
    if ((!('start' in value.source)) || ((typeof value.source.start) !== 'number')
      || (!('end' in value.source)) || ((typeof value.source.end) !== 'number'))
      throw new Error('packed artifact computed import has no source range',);
    return [{
      kind: 'computed',
      value: source.slice(value.source.start, value.source.end,),
    },];
  }
  return Object.values(value,)
    .flatMap(function collectProperty(child,) {
      return dynamicImportTargets({ value: child, source, },);
    },);
}

await execute({
  command: 'apt-get',
  args: ['update',],
},);
await execute({
  command: 'apt-get',
  args: [
    'install',
    '--yes',
    '--no-install-recommends',
    'git',
    'mount',
  ],
},);
await mkdir(
  '/work',
  { recursive: true, },
);
await execute({
  command: 'npm',
  args: [
    'init',
    '--yes',
  ],
  cwd: '/work',
},);
await execute({
  command: 'npm',
  args: [
    'install',
    '--ignore-scripts',
    '/fixture/cli.tgz',
  ],
  cwd: '/work',
},);
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
const { parse, } = createRequire('/work/package.json',)('acorn') as typeof import('acorn');
/**
 * Complete packed artifact syntax tree.
 */
const artifactSyntax: unknown = parse(
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
if (retainedDynamicImports.some(function hasNonBuiltinLiteral(target,) {
  return (target.kind === 'literal') && (!isBuiltin(target.value,));
},))
  throw new Error(`packed artifact retained non-builtin literal dynamic import: ${JSON.stringify(retainedDynamicImports,)}`,);
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
/**
 * Disposable Git repository.
 */
const repository = '/work/repo';
await mkdir(repository,);
await execute({
  command: '/usr/bin/git',
  args: [
    'init',
    '--quiet',
  ],
  cwd: repository,
},);
/**
 * Repository-root self-contained MJS config.
 */
const configPath = join(
  repository,
  'cli-git.config.mjs',
);
await writeFile(
  configPath,
  `export default {
  plugins: {
    example: {
      name: 'example',
      policies: [{
        name: 'deny',
        defaultSeverity: 'error',
        warnSafe: true,
        triggers: ['direct-check'],
        check: async () => [{ code: 'denied', message: 'built stored plugin ran' }],
      }],
    },
  },
};
`,
);
/**
 * PATH placing packed shadow executable before real Git.
 */
const env: NodeJS.ProcessEnv = {
  ...process.env,
  PATH: `/work/node_modules/.bin${delimiter}${process.env
    .PATH
    ?? ''}`,
};
/**
 * First config-loading use blocked before config execution.
 */
const untrusted = await execute({
  command: 'git',
  args: ['future-command',],
  expectedExit: 2,
  cwd: repository,
  env,
},);
assertJsonl({
  text: untrusted.stderr,
  expectedCode: 'config-untrusted',
  context: 'untrusted wrapper',
},);
/**
 * Explicit noninteractive trust result.
 */
const trust = await execute({
  command: 'git',
  args: [
    'cli-git',
    'trust',
    '--yes',
  ],
  cwd: repository,
  env,
},);
[
  configPath,
  'Filesystem identity:',
  'Filesystem identity stability:',
  'Exact snapshot state: new',
  'full account permissions',
].forEach(function assertDisclosure(expected,) {
  assertIncludes({
    text: trust.stderr,
    expected,
    context: 'trust disclosure',
  },);
},);
assertIncludes({
  text: trust.stdout,
  expected: '"type":"trust-summary"',
  context: 'trust summary',
},);
/**
 * Exact trusted status result.
 */
const status = await execute({
  command: 'git',
  args: [
    'cli-git',
    'status',
  ],
  cwd: repository,
  env,
},);
assertIncludes({
  text: status.stdout,
  expected: '"reason":"trusted"',
  context: 'trusted status',
},);
/**
 * Stored plugin direct finding.
 */
const check = await execute({
  command: 'git',
  args: [
    'cli-git',
    'check',
    '--policy',
    'example/deny',
    '--all',
  ],
  expectedExit: 1,
  cwd: repository,
  env,
},);
assertIncludes({
  text: check.stdout,
  expected: '"policyId":"example/deny"',
  context: 'stored policy finding',
},);
assertIncludes({
  text: check.stdout,
  expected: 'built stored plugin ran',
  context: 'stored policy message',
},);
await execute({
  command: 'git',
  args: [
    'status',
    '--short',
  ],
  cwd: repository,
  env,
},);
await writeFile(
  configPath,
  'export default {};\n',
);
/**
 * Changed-byte block remains pure JSONL.
 */
const changed = await execute({
  command: 'git',
  args: ['future-command',],
  expectedExit: 2,
  cwd: repository,
  env,
},);
assertJsonl({
  text: changed.stderr,
  expectedCode: 'config-changed',
  context: 'changed wrapper',
},);
/**
 * Changed status result.
 */
const changedStatus = await execute({
  command: 'git',
  args: [
    'cli-git',
    'status',
  ],
  cwd: repository,
  env,
},);
assertIncludes({
  text: changedStatus.stdout,
  expected: '"reason":"changed"',
  context: 'changed status',
},);
/**
 * Exact record removal result.
 */
const untrust = await execute({
  command: 'git',
  args: [
    'cli-git',
    'untrust',
  ],
  cwd: repository,
  env,
},);
assertIncludes({
  text: untrust.stdout,
  expected: '"removed":true',
  context: 'untrust summary',
},);
/**
 * Final untrusted status result.
 */
const finalStatus = await execute({
  command: 'git',
  args: [
    'cli-git',
    'status',
  ],
  cwd: repository,
  env,
},);
assertIncludes({
  text: finalStatus.stdout,
  expected: '"reason":"untrusted"',
  context: 'untrusted status',
},);
await verifyRecursiveConsumer({ env, },);
await verifyPolicyConfigConsumer({ env, },);
await verifyPolicyDefaultConsumer({ env, },);
await verifyRepositoryPluginConsumer({ env, },);
await verifyPostCommitPolicyConsumer({ env, },);
await verifyPostCommitRoutingConsumer({ env, },);
await verifyAutofixTransactionConsumer({ env, },);
await verifyTypeScriptConsumer({ env, },);
console.log('built-trust-consumer-ok',);
