/**
 * Packed shadow-bin trust lifecycle in disposable container. @module
 */
import {
  mkdir,
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
  parseJsonObjectLine,
} from './built-consumer-helpers.ts';
import { verifyBuiltArtifactContract, } from './built-artifact-contract.ts';
import { verifyFinalNewlineConsumer, } from './built-final-newline-consumer.ts';
import { verifyForbiddenStringsPolicyConsumer, } from './built-forbidden-strings-policy-consumer.ts';
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
await verifyBuiltArtifactContract();
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
if (untrusted.stdout !== '')
  throw new Error(`untrusted wrapper leaked stdout\n${untrusted.stdout}`,);
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
if (trust.stdout !== `${JSON.stringify({
  schemaVersion: 1,
  type: 'trust-summary',
  configPath,
  trusted: true,
},)}\n`)
  throw new Error(`trust summary compatibility mismatch\n${trust.stdout}`,);
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
/**
 * Canonical trusted status object.
 */
const trustedStatus = parseJsonObjectLine({
  text: status.stdout,
  context: 'trusted status',
},);
if ((trustedStatus.schemaVersion !== 1)
  || (trustedStatus.type !== 'trust-status')
  || (trustedStatus.configPresent !== true)
  || (trustedStatus.trusted !== true)
  || (trustedStatus.unchanged !== true)
  || (trustedStatus.configPath !== configPath)
  || ((typeof trustedStatus.filesystemId) !== 'string')
  || (trustedStatus.reason !== 'trusted'))
  throw new Error(`trusted status compatibility mismatch\n${status.stdout}`,);
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
assertJsonl({
  text: check.stdout,
  expectedCode: 'example/deny/denied',
  context: 'stored policy finding',
},);
if (check.stderr !== '')
  throw new Error(`stored direct check leaked stderr\n${check.stderr}`,);
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
if (changed.stdout !== '')
  throw new Error(`changed wrapper leaked stdout\n${changed.stdout}`,);
/**
 * Direct config-changed failure routed only to stdout.
 */
const directChanged = await execute({
  command: 'git',
  args: [
    'cli-git',
    'check',
    '--all',
  ],
  expectedExit: 2,
  cwd: repository,
  env,
},);
assertJsonl({
  text: directChanged.stdout,
  expectedCode: 'config-changed',
  context: 'changed direct check',
},);
if (directChanged.stderr !== '')
  throw new Error(`changed direct check leaked stderr\n${directChanged.stderr}`,);
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
/**
 * Canonical changed status object.
 */
const changedStatusEvent = parseJsonObjectLine({
  text: changedStatus.stdout,
  context: 'changed status',
},);
if ((changedStatusEvent.schemaVersion !== 1)
  || (changedStatusEvent.type !== 'trust-status')
  || (changedStatusEvent.configPresent !== true)
  || (changedStatusEvent.trusted !== false)
  || (changedStatusEvent.unchanged !== false)
  || (changedStatusEvent.configPath !== configPath)
  || (changedStatusEvent.reason !== 'changed'))
  throw new Error(`changed status compatibility mismatch\n${changedStatus.stdout}`,);
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
if (untrust.stdout !== `${JSON.stringify({
  schemaVersion: 1,
  type: 'untrust-summary',
  configPath,
  removed: true,
  affectedRoots: [],
},)}\n`)
  throw new Error(`untrust summary compatibility mismatch\n${untrust.stdout}`,);
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
/**
 * Canonical untrusted status object.
 */
const untrustedStatus = parseJsonObjectLine({
  text: finalStatus.stdout,
  context: 'untrusted status',
},);
if ((untrustedStatus.schemaVersion !== 1)
  || (untrustedStatus.type !== 'trust-status')
  || (untrustedStatus.configPresent !== true)
  || (untrustedStatus.trusted !== false)
  || (untrustedStatus.unchanged !== false)
  || (untrustedStatus.configPath !== configPath)
  || (untrustedStatus.reason !== 'untrusted'))
  throw new Error(`untrusted status compatibility mismatch\n${finalStatus.stdout}`,);
await verifyRecursiveConsumer({ env, },);
await verifyPolicyConfigConsumer({ env, },);
await verifyPolicyDefaultConsumer({ env, },);
await verifyRepositoryPluginConsumer({ env, },);
await verifyFinalNewlineConsumer({ env, },);
await verifyForbiddenStringsPolicyConsumer({ env, },);
await verifyPostCommitPolicyConsumer({ env, },);
await verifyPostCommitRoutingConsumer({ env, },);
await verifyAutofixTransactionConsumer({ env, },);
await verifyTypeScriptConsumer({ env, },);
console.log('built-trust-consumer-ok',);
