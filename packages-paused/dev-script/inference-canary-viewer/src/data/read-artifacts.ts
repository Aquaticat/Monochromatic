/**
 * Artifact reader that builds viewer data from enriched artifact directories.
 *
 * Walks `src/canary-lint/` and groups artifacts by (model, timestamp) to form
 * run entries. Enriched artifacts provide scores, reasoning, timing, and usage.
 * Old pre-enrichment artifacts degrade gracefully with score defaulting to 0.
 */
import type { Dirent, } from 'node:fs';
import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  type ArtifactMeta,
  type FailureArtifactMeta,
  LINT_DIR,
} from '@monochromatic-dev/dev-script-inference-canary/ts';

import type { ArtifactData, } from './viewer-types.ts';

import { buildViewerData, } from './build-viewer-data.ts';
import {
  isEnriched,
  type ParsedArtifact,
} from './parsed-artifact.ts';

export { LINT_DIR, };

export { probeKey, } from './parsed-artifact.ts';

/**
 * Sentinel returned by {@link readOptional} when a file is absent or unreadable.
 * Named so absence is expressed without widening the return type to
 * `string | undefined`, which `exactOptionalPropertyTypes` and the
 * no-nullish-union rule forbid.
 */
const FILE_ABSENT: unique symbol = Symbol('file-absent',);

/**
 * Whether a parsed meta.json is a whole-model failure artifact.
 *
 * @param meta - parsed JSON object from meta.json
 *
 * @returns true when the metadata indicates a whole-model failure
 */
function isFailure(meta: Readonly<Record<string, unknown>>,): meta is FailureArtifactMeta {
  return meta.failed
    === true;
}

/**
 * Type guard narrowing an unknown caught value to `NodeJS.ErrnoException`.
 *
 * @param error - caught error value
 *
 * @returns true when error is an Error with a `code` property
 */
function isErrnoException(error: unknown,): error is NodeJS.ErrnoException {
  return (error instanceof Error) && ('code' in error);
}

/**
 * Reads a file, returning {@link FILE_ABSENT} on any error.
 *
 * @param path - absolute file path
 *
 * @returns file contents, or {@link FILE_ABSENT} when missing or unreadable
 */
async function readOptional(path: string,): Promise<string | typeof FILE_ABSENT> {
  try {
    return await readFile(
      path,
      'utf8',
    );
  }
  catch (error: unknown) {
    // ENOENT is expected for optional files (e.g. canary.ts not saved in old artifacts)
    if ((!isErrnoException(error,)) || (error.code
      !== 'ENOENT')) {
      console.error(
        `[viewer] failed to read ${path}:`,
        error,
      );
    }
    return FILE_ABSENT;
  }
}

/**
 * Reads all artifacts from the canary lint directory and builds viewer data.
 *
 * Groups artifacts by (model, timestamp) to reconstruct per-run entries.
 * Computes overall scores as the mean of per-probe initial-pass scores.
 *
 * @returns entries for charts/tables and per-probe details for overlays
 *
 * @example
 * ```ts
 * const { entries, probeDetails } = await readArtifacts();
 * // entries: ViewerEntry[], probeDetails: Map<string, ProbeDetail>
 * ```
 */
export async function readArtifacts(): Promise<ArtifactData> {
  /**
   * Initial-pass artifacts grouped by run key (model::timestamp) then by probe name
   */
  const initialByRun = new Map<string, Map<string, ParsedArtifact>>();
  /**
   * Fix-pass artifacts grouped identically
   */
  const fixByRun = new Map<string, Map<string, ParsedArtifact>>();
  /**
   * Whole-model failure artifacts
   */
  const failures: FailureArtifactMeta[] = [];

  /**
   * Top-level entries under `LINT_DIR`, one per model directory; empty on read failure.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- try/catch with early-return-from-parent on missing dir; helper extraction would require a sentinel value
  let modelDirents: Dirent[] = [];
  try {
    modelDirents = await readdir(
      LINT_DIR,
      { withFileTypes: true, },
    );
  }
  catch {
    console.error('[viewer] no artifact directory found, skipping artifact loading',);
    return {
      entries: [],
      probeDetails: new Map(),
    };
  }

  for (const modelDirent of modelDirents.filter(function isDir(dirent,) {
    return dirent.isDirectory();
  },)) {
    /**
     * Absolute path to the model subdirectory currently being walked.
     */
    const modelPath = join(
      LINT_DIR,
      modelDirent.name,
    );
    /**
     * Run subdirectories under `modelPath`; empty when the directory cannot be read.
     */
    let subdirents: Dirent[] = [];
    try {
      // oxlint-disable-next-line no-await-in-loop -- sequential directory reads with per-iteration error handling
      subdirents = await readdir(
        modelPath,
        { withFileTypes: true, },
      );
    }
    catch (error) {
      console.error(
        `[viewer] failed to read model directory ${modelPath}:`,
        error,
      );
      continue;
    }

    for (const subdirent of subdirents.filter(function isDir(dirent,) {
      return dirent.isDirectory();
    },)) {
      /**
       * Absolute path to the run subdirectory currently being processed.
       */
      const dirPath = join(
        modelPath,
        subdirent.name,
      );
      /* oxlint-disable no-await-in-loop -- sequential per-artifact reads with individual error handling */
      /**
       * Raw `meta.json` contents; undefined when the file is missing or unreadable.
       */
      const metaRaw = await readOptional(join(
        dirPath,
        'meta.json',
      ),);
      /* oxlint-enable no-await-in-loop */
      if (metaRaw === FILE_ABSENT)
        continue;

      /**
       * Parsed `meta.json` object; populated below or replaced with `{}` on parse failure.
       */
      let parsed: Record<string, unknown> = {};
      try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse returns any; shape validated by isFailure guard and field access below
        parsed = JSON.parse(metaRaw,) as Record<string, unknown>;
      }
      catch (error) {
        console.error(
          `[viewer] malformed meta.json in ${dirPath}:`,
          error,
        );
        continue;
      }

      if (isFailure(parsed,)) {
        failures.push(parsed,);
        continue;
      }

      /* oxlint-disable typescript/no-unsafe-type-assertion -- validated via isFailure guard; shape matches ArtifactMeta */
      /**
       * Parsed artifact metadata in its declared shape, before the fallback label is applied.
       */
      const parsedMeta = parsed as ArtifactMeta;
      /* oxlint-enable typescript/no-unsafe-type-assertion */
      /**
       * Artifact metadata with a guaranteed `label`; old artifacts without one fall back to the directory name.
       */
      const meta: ArtifactMeta = {
        ...parsedMeta,
        label: parsedMeta.label
          ?? modelDirent
          .name,
      };
      /* oxlint-disable no-await-in-loop -- sequential per-artifact reads grouped by run */
      /**
       * Optional source and response file contents loaded together for this artifact directory.
       */
      const [source, response,] = await Promise.all([
        readOptional(join(
          dirPath,
          'canary.ts',
        ),),
        readOptional(join(
          dirPath,
          'response.txt',
        ),),
      ],);
      /* oxlint-enable no-await-in-loop */
      /**
       * Assembled parsed artifact bundling metadata with optional source and response files.
       */
      const artifact: ParsedArtifact = {
        meta,
        dir: dirPath,
        ...(source !== FILE_ABSENT ? { source, } : {}),
        ...(response !== FILE_ABSENT ? { response, } : {}),
      };
      /**
       * Composite key grouping artifacts for the same run across probes.
       */
      const runKey = `${meta.label}::${meta.timestamp}`;

      /**
       * Per-pass bucket selected by `meta.pass`; new artifacts are inserted into this Map.
       */
      const target = meta.pass
        === 'initial' ? initialByRun : fixByRun;
      /**
       * Existing probe-to-artifact map for the run, or a fresh empty Map when first seen.
       */
      const probes = target.get(runKey,)
        ?? new Map<string, ParsedArtifact>();
      probes.set(
        meta.probe,
        artifact,
      );
      target.set(
        runKey,
        probes,
      );
    }
  }

  return buildViewerData({
    initialByRun,
    fixByRun,
    failures,
  },);
}
