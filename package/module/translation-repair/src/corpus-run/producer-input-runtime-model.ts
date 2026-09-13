import type { ProducerInputFileIdentity, } from './producer-input-file.ts';

//region Runtime build description consumed by the owning preparation gate

/**
 * One relative runtime file is bound by raw identity before application import.
 *
 * @example
 * ```ts
 * const file: ProducerRuntimeFile = { path: 'producer-prepare-app.mjs', bytes, sha256 };
 * ```
 */
export type ProducerRuntimeFile = ProducerInputFileIdentity & {
  /** Flat build-relative name; traversal and runtime-manifest self-membership are refused. */
  readonly path: string;
};

/**
 * Exact current sealed-build schema, not an approval or arbitrary dependency manifest.
 * Host image and shared-library binding remain separate launch responsibilities.
 *
 * @example
 * ```ts
 * const manifest: ProducerRuntimeManifest = verifiedManifest;
 * ```
 */
export type ProducerRuntimeManifest = {
  /** Current dedicated sealed-build representation. */
  readonly version: 1;
  /** Identifies build evidence rather than execution approval. */
  readonly kind: 'sealed-node-runtime-build';
  /** The build does not claim to package the operating system. */
  readonly scope: 'application-dependencies-only';
  /** The measured native parser target is deliberately not generalized to other platforms. */
  readonly target: { readonly platform: 'linux'; readonly arch: 'x64'; readonly libc: 'glibc' };
  /** Node binary and embedded component identities are checked before application import. */
  readonly node: {
    /** Full Node version string including its native prefix. */
    readonly version: string;
    /** Exact version map from the build's executed Node. */
    readonly versions: Readonly<Record<string, string>>;
    /** The executed Node file is separate from application inventory. */
    readonly executable: ProducerInputFileIdentity;
  };
  /** Native parser bytes must also appear in the complete runtime inventory. */
  readonly native: ProducerRuntimeFile & {
    /** Fixed optional-package identity owning the Linux GNU asset. */
    readonly package: '@bruits/satteri-linux-x64-gnu';
    /** Actual installed package version, not the generated loader's stale literal. */
    readonly version: string;
  };
  /** These names are declarations from the build, independently enforced by the gate. */
  readonly loaderEnvironment: {
    /** Loader overrides cannot be supplied by a preparation launch. */
    readonly policy: 'must-be-absent-before-import';
    /** Exact build vocabulary; the gate also rejects native dynamic-linker overrides. */
    readonly names: readonly string[];
  };
  /** The recognized build explicitly delegates system libraries to the runner/image contract. */
  readonly systemLibraries: string;
  /** Exact executable and native inventory, excluding declaration-only files. */
  readonly files: readonly ProducerRuntimeFile[];
};

//endregion Runtime build description consumed by the owning preparation gate
