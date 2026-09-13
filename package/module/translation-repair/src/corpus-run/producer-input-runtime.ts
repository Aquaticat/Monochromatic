import { readdir, } from 'node:fs/promises';
import { basename, join, } from 'node:path';
import { isDeepStrictEqual, } from 'node:util';
import { mapOverlapped, } from '../overlapped-map.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import { readProducerInputFile, verifyProducerInputFile, type ProducerInputFileIdentity, } from './producer-input-file.ts';
import { PRODUCER_INPUT_PATHS, } from './producer-input-paths.ts';
import type { ProducerRuntimeManifest, } from './producer-input-runtime-model.ts';
import { isProducerRuntimeManifest, } from './producer-input-runtime-shape.ts';

//region Actual frozen runtime observation before application import

/**
 * Reads and validates only the exact sealed manifest named by the launch authority.
 *
 * @param dir - fixed runtime mount or host frozen-runtime directory
 *
 * @param expected - independently recorded manifest identity and extent
 *
 * @returns Owned recognized build metadata, never execution approval
 *
 * @throws ProducerInputRunError when bytes, decoding or build schema differ
 *
 * @example
 * ```ts
 * const manifest = await readProducerRuntimeManifest({ dir, expected });
 * ```
 */
export async function readProducerRuntimeManifest({ dir, expected, }: {
  readonly dir: string;
  readonly expected: ProducerInputFileIdentity;
},): Promise<ProducerRuntimeManifest> {
  /** The filename is fixed by the build contract rather than selected from JSON. */
  const path = join(dir, 'sealed-runtime.json');
  /** No JSON field is interpreted before exact raw bytes are verified. */
  const bytes = await readProducerInputFile({ path, expected, operation: 'verify-runtime', });
  try {
    /** The manifest is data, and decoder/parser errors must not carry its contents outward. */
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true, }).decode(bytes));
    if (!isProducerRuntimeManifest(value))
      throw new ProducerInputRunError({ operation: 'verify-runtime', locator: path, });
    return value;
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({ operation: 'verify-runtime', locator: path, });
  }
}

/**
 * Rehashes every runtime file and refuses ambient executable or declaration files in the execution directory.
 *
 * @param dir - frozen application directory, never a normal development dist with extra declarations
 *
 * @param manifest - fresh recognized metadata from the independently identified manifest
 *
 * @returns Verified runtime filenames in their manifest order
 *
 * @throws ProducerInputRunError when inventory, native membership or any file identity differs
 *
 * @example
 * ```ts
 * const files = await verifyProducerRuntimeInventory({ dir, manifest });
 * ```
 */
export async function verifyProducerRuntimeInventory({ dir, manifest, }: {
  readonly dir: string;
  readonly manifest: ProducerRuntimeManifest;
},): Promise<readonly string[]> {
  try {
    /** The inventory cannot change through a caller-owned reference while hashing yields. */
    const fixed = structuredClone(manifest);
    /** Duplicate names cannot hide a missing executable. */
    const names = fixed.files.map(function name(file): string { return file.path; });
    if (new Set(names).size !== names.length || !names.includes(basename(PRODUCER_INPUT_PATHS.application)))
      throw new ProducerInputRunError({ operation: 'verify-runtime', locator: dir, });
    /** Native metadata and generic inventory must describe the same exact asset. */
    const nativeFile = fixed.files.find(function native(file): boolean { return file.path === fixed.native.path; });
    if (nativeFile === undefined || nativeFile.bytes !== fixed.native.bytes || nativeFile.sha256 !== fixed.native.sha256)
      throw new ProducerInputRunError({ operation: 'verify-runtime', locator: dir, });
    /** A read-only runtime directory is not a license to load unlisted or symlinked files. */
    const entries = await readdir(dir, { withFileTypes: true, });
    if (entries.some(function nonfile(entry): boolean { return !entry.isFile(); })
      || !isDeepStrictEqual(entries.map(function name(entry): string { return entry.name; }).toSorted(), [...names, 'sealed-runtime.json'].toSorted()))
      throw new ProducerInputRunError({ operation: 'verify-runtime', locator: dir, });
    /** Serial hashing bounds descriptor use and retains exact inventory order. */
    const verifiedFiles = await mapOverlapped({
      items: fixed.files,
      overlap: 1,
      oneItem: async function verified({ item, }): Promise<string> {
        await verifyProducerInputFile({ path: join(dir, item.path), expected: item, operation: 'verify-runtime', });
        return item.path;
      },
    });
    /** Final directory observation catches additions or replacements visible before import. */
    const finalEntries = await readdir(dir, { withFileTypes: true, });
    if (finalEntries.some(function nonfile(entry): boolean { return !entry.isFile(); })
      || !isDeepStrictEqual(finalEntries.map(function name(entry): string { return entry.name; }).toSorted(), [...names, 'sealed-runtime.json'].toSorted()))
      throw new ProducerInputRunError({ operation: 'verify-runtime', locator: dir, });
    return verifiedFiles;
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({ operation: 'verify-runtime', locator: dir, });
  }
}

/**
 * Cross-checks the executing Node and GNU target before application import.
 * Node and its dynamic libraries have already executed; the trusted host launch owns their pre-start binding.
 *
 * @param manifest - fresh recognized metadata from the independently identified application build
 *
 * @returns Verified Node executable identity
 *
 * @throws ProducerInputRunError when target, embedded versions or executed bytes differ
 *
 * @example
 * ```ts
 * await verifyProducerNodeRuntime(manifest);
 * ```
 */
export async function verifyProducerNodeRuntime(manifest: ProducerRuntimeManifest): Promise<ProducerInputFileIdentity> {
  /** Node's report is inspected without serializing its environment or process data. */
  const report: unknown = process.report.getReport();
  if (process.platform !== 'linux' || process.arch !== 'x64' || process.version !== manifest.node.version
    || !isDeepStrictEqual(process.versions, manifest.node.versions)
    || typeof report !== 'object' || report === null || !('header' in report)
    || typeof report.header !== 'object' || report.header === null || !('glibcVersionRuntime' in report.header)
    || typeof report.header.glibcVersionRuntime !== 'string')
    throw new ProducerInputRunError({ operation: 'verify-runtime', locator: 'executing Node target', });
  return await verifyProducerInputFile({ path: process.execPath, expected: manifest.node.executable, operation: 'verify-runtime', });
}

//endregion Actual frozen runtime observation before application import
