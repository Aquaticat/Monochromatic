/**
 Synthetic encrypted-store fixtures for config tests.
 
 The fixtures use real `age-keygen` and `sops` against disposable temp
 directories. No fixture value is a credential.
 
 @module
 */

import { execFileSync, } from 'node:child_process';
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

/**
 Prefix for disposable fixture directories.
 */
const FIXTURE_PREFIX = 'search-fetch-store-test-';

/**
 Sentinel value written when a test needs a plaintext store.
 */
const PLAINTEXT_SENTINEL = 'plaintext-sentinel-value';

/**
 Resolve the public age recipient from an age-keygen identity file.
 
 @param identityPath - generated identity path
 
 @returns age public recipient
 
 @throws when the identity file has no public-key comment
 */
async function readRecipient(identityPath: string,): Promise<string> {
  /**
   Local value for identityText.
   */
  const identityText = await readFile(identityPath, 'utf8',);
  /**
   Local value for match.
   */
  const match = /public key: (age1[0-9a-z]+)/u.exec(identityText,);
  const recipient = match?.[1];
  if (recipient === undefined)
    throw new Error('synthetic age identity has no public-key comment',);
  return recipient;
}

/**
 Fail with remediation when a real crypto tool is unavailable.
 
 @param command - executable name to probe
 */
function requireTool(command: string,): void {
  try {
    execFileSync('sh', ['-c', `command -v ${command}`,], { stdio: 'ignore', },);
  }
  catch {
    throw new Error(
      `${command} is required for these tests; run them from a mise shell where sops and age are installed.`,
    );
  }
}

/**
 Create a disposable root with an age identity.
 
 @returns fixture root and identity path
 
 @throws when sops or age-keygen is unavailable
 */
async function createIdentityFixture(): Promise<{
  readonly root: string;
  readonly identityPath: string;
}> {
  requireTool('sops',);
  requireTool('age-keygen',);
  /**
   Local value for root.
   */
  const root = await mkdtemp(join(tmpdir(), FIXTURE_PREFIX,),);
  await chmod(root, 0o700,);
  /**
   Local value for identityPath.
   */
  const identityPath = join(root, 'identity.txt',);
  execFileSync('age-keygen', ['--output', identityPath,], { stdio: 'ignore', },);
  await chmod(identityPath, 0o600,);
  return { root, identityPath, };
}

/**
 Create an encrypted store at a fixture root.
 
 @param options - root, identity path, and synthetic values
 
 @returns store path and the environment that decrypts it
 
 @throws when sops encryption fails
 */
async function writeEncryptedStore(
  {
    root,
    identityPath,
    values,
  }: {
    readonly root: string;
    readonly identityPath: string;
    readonly values: Readonly<Record<string, string>>;
  },
): Promise<{
  readonly storePath: string;
  readonly env: Readonly<Record<string, string>>;
}> {
  /**
   Local value for recipient.
   */
  const recipient = await readRecipient(identityPath,);
  /**
   Local value for plaintextPath.
   */
  const plaintextPath = join(root, 'store.plain.json',);
  /**
   Local value for storePath.
   */
  const storePath = join(root, '.env.local.json',);
  await writeFile(plaintextPath, JSON.stringify(values,), 'utf8',);
  execFileSync(
    'sops',
    [
      '--encrypt',
      '--age',
      recipient,
      '--input-type',
      'json',
      '--output-type',
      'json',
      '--output',
      storePath,
      plaintextPath,
    ],
    { stdio: 'ignore', },
  );
  await chmod(storePath, 0o600,);
  await rm(plaintextPath,);
  return {
    storePath,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: root,
      SOPS_AGE_KEY_FILE: identityPath,
    },
  };
}

/**
 Write a plaintext JSON store without sops metadata.
 
 @param root - fixture root
 
 @param values - synthetic values to write
 
 @returns store path
 */
async function writePlaintextStore(
  {
    root,
    values,
  }: {
    readonly root: string;
    readonly values: Readonly<Record<string, string>>;
  },
): Promise<string> {
  /**
   Local value for storePath.
   */
  const storePath = join(root, '.env.local.json',);
  await writeFile(storePath, JSON.stringify(values,), 'utf8',);
  return storePath;
}

export {
  createIdentityFixture,
  PLAINTEXT_SENTINEL,
  writeEncryptedStore,
  writePlaintextStore,
};
