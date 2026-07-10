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
} from './built-consumer-helpers.ts';
import { verifyPolicyConfigConsumer, } from './built-policy-config-consumer.ts';
import { verifyPolicyDefaultConsumer, } from './built-policy-default-consumer.ts';
import { verifyRecursiveConsumer, } from './built-recursive-consumer.ts';
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
await verifyTypeScriptConsumer({ env, },);
console.log('built-trust-consumer-ok',);
