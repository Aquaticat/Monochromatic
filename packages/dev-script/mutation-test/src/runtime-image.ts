/**
 * Runtime image identity and local Podman build orchestration.
 *
 * @example
 * ```ts
 * await runtimeImage({ repoRoot: '/repo', packageRoot: '/repo/packages/dev-script/mutation-test', nodeTag: 'node-latest' });
 * ```
 */

import { readFile, } from 'node:fs/promises';
import {
  arch,
  platform,
} from 'node:os';
import { join, } from 'node:path';
import { createHash, } from 'node:crypto';

import spawn from 'nano-spawn';

import { sanitizeTagFragment, } from './path-utils.ts';
import { stageRuntimeBuildContext, } from './runtime-context.ts';
import { runtimeInputHash, } from './runtime-inputs.ts';
import type {
  RuntimeImage,
  RuntimeImageOptions,
} from './types.ts';

/**
 * Prefix for locally built mutation runtime images.
 */
const IMAGE_PREFIX = 'localhost/monochromatic-mutation-runtime';

/**
 * Ignorefile used to stage a minimal runtime image build context.
 */
const RUNTIME_IGNOREFILE = 'Containerfile.dockerignore';

/**
 * Length of lockfile hash embedded in local image tags.
 */
const TAG_HASH_LENGTH = 16;

/**
 * Computes SHA-256 hex digest for bytes.
 *
 * @param content - Content to hash.
 *
 * @returns Hex digest.
 *
 * @example
 * ```ts
 * sha256Hex(Buffer.from('x'));
 * ```
 */
export function sha256Hex(content: Buffer,): string {
  return createHash('sha256',)
    .update(content,)
    .digest('hex',);
}

/**
 * Returns platform tag fragment used by runtime image identity.
 *
 * @param override - Optional debug override.
 *
 * @returns Sanitised platform fragment.
 *
 * @example
 * ```ts
 * platformTag('linux/arm64');
 * // 'linux-arm64'
 * ```
 */
export function platformTag(override?: string,): string {
  /**
   * Raw platform identifier before OCI tag sanitisation.
   */
  const raw = override ?? `${platform()}-${arch()}`;
  return sanitizeTagFragment(raw,);
}

/**
 * Computes local runtime image identity from lockfile hash and platform.
 *
 * @param options - Repository and runtime package paths.
 *
 * @returns Runtime image reference and diagnostic inputs.
 *
 * @example
 * ```ts
 * await runtimeImage({ repoRoot: '/repo', packageRoot: '/repo/packages/dev-script/mutation-test', nodeTag: 'node-latest' });
 * ```
 */
export async function runtimeImage(options: RuntimeImageOptions,): Promise<RuntimeImage> {
  /**
   * Lockfile bytes used for content-addressed image tagging.
   */
  const lockfile = await readFile(join(
    options.repoRoot,
    'pnpm-lock.yaml',
  ),);
  /**
   * Full SHA-256 lockfile hash.
   */
  const lockHash = sha256Hex(lockfile,);
  /**
   * Sanitised host or override platform tag fragment.
   */
  const selectedPlatform = platformTag(options.platformOverride,);
  /**
   * Hash for runtime source and image-build inputs.
   */
  const runtimeHash = await runtimeInputHash({
    repoRoot: options.repoRoot,
    packageRoot: options.packageRoot,
  },);
  /**
   * Local Podman image reference for current lockfile, runtime source, and platform.
   */
  const reference = `${IMAGE_PREFIX}:${sanitizeTagFragment(options.nodeTag,)}-${lockHash.slice(
    0,
    TAG_HASH_LENGTH,
  )}-${runtimeHash.slice(
    0,
    TAG_HASH_LENGTH,
  )}-${selectedPlatform}`;

  return {
    reference,
    lockHash,
    runtimeHash,
    platform: selectedPlatform,
  };
}

/**
 * Tests whether Podman already has a local image tag.
 *
 * @param image - Image reference to check.
 *
 * @returns True when the image exists locally.
 *
 * @example
 * ```ts
 * await imageExists('localhost/example:tag');
 * ```
 */
export async function imageExists(image: string,): Promise<boolean> {
  try {
    await spawn(
      'podman',
      [
        'image',
        'exists',
        image,
      ],
    );
    return true;
  }
  catch (error) {
    return false;
  }
}

/**
 * Builds Podman arguments for constructing the runtime image.
 *
 * @param options - Build context and image reference.
 *
 * @returns Podman build arguments.
 *
 * @example
 * ```ts
 * buildRuntimeImageArgs({ contextRoot: '/tmp/context', packageRoot: '/tmp/context/packages/dev-script/mutation-test', image: 'localhost/example:tag' });
 * ```
 */
export function buildRuntimeImageArgs(options: {
  readonly contextRoot: string;
  readonly packageRoot: string;
  readonly image: string;
},): readonly string[] {
  /**
   * Absolute path to mutation runtime Containerfile.
   */
  const containerfile = join(
    options.packageRoot,
    'runtime',
    'Containerfile',
  );

  return [
    'build',
    '--pull=missing',
    '--tag',
    options.image,
    '--file',
    containerfile,
    options.contextRoot,
  ];
}

/**
 * Builds the runtime image with a staged minimal build context.
 *
 * @param options - Build context and image reference.
 *
 * @example
 * ```ts
 * await buildRuntimeImage({ repoRoot: '/repo', packageRoot: '/repo/packages/dev-script/mutation-test', image: 'localhost/example:tag' });
 * ```
 */
export async function buildRuntimeImage(options: {
  readonly repoRoot: string;
  readonly packageRoot: string;
  readonly image: string;
},): Promise<void> {
  /**
   * Minimal temporary build context containing manifests and runtime source.
   */
  await using buildContext = await stageRuntimeBuildContext({
    repoRoot: options.repoRoot,
    packageRoot: options.packageRoot,
  },);

  await spawn(
    'podman',
    buildRuntimeImageArgs({
      contextRoot: buildContext.root,
      packageRoot: buildContext.packageRoot,
      image: options.image,
    },),
    {
      stdout: 'inherit',
      stderr: 'inherit',
      stdin: 'inherit',
    },
  );
}

/**
 * Ensures the content-addressed runtime image exists locally.
 *
 * @param options - Image identity inputs and skip flag.
 *
 * @returns Runtime image identity.
 *
 * @example
 * ```ts
 * await ensureRuntimeImage({ repoRoot: '/repo', packageRoot: '/repo/packages/dev-script/mutation-test', nodeTag: 'node-latest', skipBuild: false });
 * ```
 */
export async function ensureRuntimeImage(options: RuntimeImageOptions & {
  readonly skipBuild: boolean;
},): Promise<RuntimeImage> {
  /**
   * Runtime image identity for current lockfile and platform.
   */
  const image = await runtimeImage(options,);

  if (options.skipBuild)
    return image;

  if (await imageExists(image.reference,))
    return image;

  await buildRuntimeImage({
    repoRoot: options.repoRoot,
    packageRoot: options.packageRoot,
    image: image.reference,
  },);

  return image;
}
