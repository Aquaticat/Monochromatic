/**
 * Packed shadow-bin trust lifecycle in disposable container. @module
 */
import {
  mkdir,
  readdir,
  writeFile,
} from 'node:fs/promises';
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
