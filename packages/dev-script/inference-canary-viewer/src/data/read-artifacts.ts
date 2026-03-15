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
} from '@monochromatic-dev/dev-script-inference-canary/src/linter-artifacts.ts';

import type { ArtifactData, } from './viewer-types.ts';

import { buildViewerData, } from './build-viewer-data.ts';
import {
  isEnriched,
  type ParsedArtifact,
} from './parsed-artifact.ts';

export { LINT_DIR, };

export { probeKey, } from './parsed-artifact.ts';

/**
 * Whether a parsed meta.json is a whole-model failure artifact.
 *
 * @param meta - parsed JSON object from meta.json
 *
 * @returns true when the metadata indicates a whole-model failure
 */
function isFailure(meta: Record<string, unknown>,): meta is FailureArtifactMeta {
  return meta['failed'] === true;
}

/**
 * Reads a file, returning undefined on any error.
 *
 * @param path - absolute file path
 *
 * @returns file contents or undefined
 */
async function readOptional(path: string,): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8',);
  }
  catch (error) {
    // ENOENT is expected for optional files (e.g. canary.ts not saved in old artifacts)
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      console.error(`[viewer] failed to read ${path}:`, error,);
    return undefined;
  }
}

/**
 * Reads all artifacts from the canary lint directory and builds viewer data.
 *
 * Groups artifacts by (model, timestamp) to reconstruct per-run entries.
 * Computes overall scores as the mean of per-probe initial-pass scores.
 *
 * @returns entries for charts/tables and per-probe details for overlays
 */
export async function readArtifacts(): Promise<ArtifactData> {
  /** Initial-pass artifacts grouped by run key (model::timestamp) then by probe name */
  const initialByRun = new Map<string, Map<string, ParsedArtifact>>();
  /** Fix-pass artifacts grouped identically */
  const fixByRun = new Map<string, Map<string, ParsedArtifact>>();
  /** Whole-model failure artifacts */
  const failures: FailureArtifactMeta[] = [];

  let modelDirents: Dirent[];
  try {
    modelDirents = await readdir(LINT_DIR, { withFileTypes: true, },);
  }
  catch {
    console.error('[viewer] no artifact directory found, skipping artifact loading',);
    return { entries: [], probeDetails: new Map(), };
  }

  for (const modelDirent of modelDirents.filter(function isDir(dirent,) {
    return dirent.isDirectory();
  },)) {
    const modelPath = join(LINT_DIR, modelDirent.name,);
    let subdirents: Dirent[];
    try {
      subdirents = await readdir(modelPath, { withFileTypes: true, },);
    }
    catch (error) {
      console.error(`[viewer] failed to read model directory ${modelPath}:`, error,);
      continue;
    }

    for (const subdirent of subdirents.filter(function isDir(dirent,) {
      return dirent.isDirectory();
    },)) {
      const dirPath = join(modelPath, subdirent.name,);
      const metaRaw = await readOptional(join(dirPath, 'meta.json',),);
      if (metaRaw === undefined)
        continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(metaRaw,) as Record<string, unknown>;
      }
      catch (error) {
        console.error(`[viewer] malformed meta.json in ${dirPath}:`, error,);
        continue;
      }

      if (isFailure(parsed,)) {
        failures.push(parsed,);
        continue;
      }

      // Old artifacts without label fall back to the directory name
      const meta: ArtifactMeta = {
        ...(parsed as ArtifactMeta),
        /* oxlint-disable-next-line typescript/no-unnecessary-condition -- label is typed as required but old artifacts may omit it; ?? fallback is intentional */
        label: (parsed as ArtifactMeta).label ?? modelDirent.name,
      };
      const [source, response,] = await Promise.all([
        readOptional(join(dirPath, 'canary.ts',),),
        readOptional(join(dirPath, 'response.txt',),),
      ],);
      const artifact: ParsedArtifact = { meta, source, response, dir: dirPath, };
      const runKey = `${meta.label}::${meta.timestamp}`;

      const target = meta.pass === 'initial' ? initialByRun : fixByRun;
      const probes = target.get(runKey,) ?? new Map<string, ParsedArtifact>();
      probes.set(meta.probe, artifact,);
      target.set(runKey, probes,);
    }
  }

  return buildViewerData(initialByRun, fixByRun, failures,);
}
