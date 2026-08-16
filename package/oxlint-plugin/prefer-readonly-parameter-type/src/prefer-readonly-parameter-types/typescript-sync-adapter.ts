/**
 * TypeScript 7 synchronous semantic bridge for Oxlint JavaScript rules.
 *
 * @module
 */

import { existsSync, } from 'node:fs';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { version as typescriptVersion, } from 'typescript';
import {
  API,
  type Snapshot,
} from 'typescript/unstable/sync';

import { resetSemanticEffectCaches, } from './effect-cache-lifecycle.ts';
import {
  cachedProjectForFile,
  type SemanticBridgeCacheStats,
} from './semantic-bridge-cache.ts';
import { SemanticBridgeError, } from './semantic-bridge-error.ts';
import {
  semanticFileSession,
  type SemanticFileSession,
} from './semantic-file-session.ts';
import {
  normalizeSemanticFileName,
  semanticProjectRootKey,
} from './semantic-file-name.ts';
import { overlayFileSystem, } from './semantic-overlay-filesystem.ts';
import { snapshotHoldsSource, } from './semantic-snapshot-presence.ts';
import {
  assertTypeScriptSeven,
  configureNativeApiChildShutdown,
  nativeApiChild,
} from './typescript-sync-native-shutdown.ts';

/**
 * Package logger for semantic bridge lifecycle.
 */
const l = tagged({ tag: 'prefer-readonly-parameter-types', },);

/**
 * Sentinel before native API client starts.
 */
const NO_API: unique symbol = Symbol('TypeScript synchronous API not started',);

/**
 * Sentinel before first semantic snapshot exists.
 */
const NO_SNAPSHOT: unique symbol = Symbol('TypeScript semantic snapshot not created',);

/**
 * Sentinel before bridge tracks current source for rename invalidation.
 */
const NO_ACTIVE_FILE: unique symbol = Symbol('TypeScript semantic bridge has no active source',);

/**
 * UTF-16 byte-order mark restored when Oxlint strips it from source text.
 */
const BYTE_ORDER_MARK = '\uFEFF';

/**
 * TypeScript project-service identity for source outside configured projects.
 */
const INFERRED_PROJECT_CONFIG = '/dev/null/inferred';

/**
 * Mutable process-local bridge state hidden behind exported lifecycle functions.
 */
const bridgeState: {
  api: API | typeof NO_API;
  snapshot: Snapshot | typeof NO_SNAPSHOT;
  readonly overlays: Map<string, string>;
  readonly projectByRoot: Map<string, string>;
  activeFileName: string | typeof NO_ACTIVE_FILE;
  projectDiscoveryCount: number;
  beforeExitHookRegistered: boolean;
} = {
  api: NO_API,
  snapshot: NO_SNAPSHOT,
  overlays: new Map(),
  projectByRoot: new Map(),
  activeFileName: NO_ACTIVE_FILE,
  projectDiscoveryCount: 0,
  beforeExitHookRegistered: false,
};

/**
 * Starts native synchronous API once and registers process cleanup.
 *
 * @returns reusable TypeScript API client.
 *
 * @throws {@link SemanticBridgeError} when API startup fails.
 */
function getApi(): API {
  if (bridgeState.api !== NO_API)
    return bridgeState.api;

  /**
   * Function-tagged semantic lifecycle logger.
   */
  const rl = tagged({
    tag: getApi.name,
    l,
  },);
  assertTypeScriptSeven();
  try {
    /**
     * Newly created API configured before process lifecycle hooks observe it.
     */
    const api = new API({
      cwd: process.cwd(),
      fs: overlayFileSystem({ overlays: bridgeState.overlays, },),
    },);
    /**
     * Native child whose TypeScript-owned cleanup signal must remain quiet.
     */
    const child = nativeApiChild(api,);
    configureNativeApiChildShutdown(child,);
    bridgeState.api = api;
    rl.debug(`started TypeScript ${typescriptVersion} synchronous API`,);
  }
  catch (error) {
    rl.error(`failed to start TypeScript synchronous API: ${String(error,)}`,);
    throw new SemanticBridgeError({
      reason: 'api-unavailable',
      message: `TypeScript ${typescriptVersion} synchronous API failed to start: ${String(error,)}`,
    },);
  }

  if (!bridgeState.beforeExitHookRegistered) {
    process.once(
      'beforeExit',
      closeSemanticBridge,
    );
    bridgeState.beforeExitHookRegistered = true;
  }
  return bridgeState.api;
}

/**
 * Starts semantic child before Oxlint allocates one fixed AST buffer per worker.
 *
 * Oxlint reserves a multi-gigabyte virtual buffer for every Rust worker when a
 * JavaScript plugin is active. Starting TypeScript after those reservations can
 * make `child_process.spawn` fail with `ENOMEM` on high-core hosts.
 *
 * @example
 * ```ts
 * initializeSemanticBridge();
 * ```
 */
export function initializeSemanticBridge(): void {
  getApi();
}

/**
 * Restores source text exactly as TypeScript sees it.
 *
 * @param sourceText - Oxlint source text.
 *
 * @param hasBOM - Whether Oxlint removed leading byte-order mark.
 *
 * @returns source text with leading mark restored when necessary.
 */
function sourceWithBOM({
  sourceText,
  hasBOM,
}: {
  readonly sourceText: string;
  readonly hasBOM: boolean;
},): string {
  return hasBOM ? `${BYTE_ORDER_MARK}${sourceText}` : sourceText;
}

/**
 * Opens current Oxlint source in reusable TypeScript project snapshot.
 *
 * @param fileName - Source path reported by Oxlint.
 *
 * @param sourceText - Current in-memory source text.
 *
 * @param hasBOM - Whether Oxlint stripped leading byte-order mark.
 *
 * @returns semantic project, checker, source tree, and offset mapper.
 *
 * @throws {@link SemanticBridgeError} when project or source cannot be resolved.
 *
 * @example
 * ```ts
 * const session = openSemanticFile({ fileName, sourceText, hasBOM: false });
 * ```
 */
export function openSemanticFile({
  fileName,
  sourceText,
  hasBOM,
}: {
  readonly fileName: string;
  readonly sourceText: string;
  readonly hasBOM: boolean;
},): SemanticFileSession {
  /**
   * Function-tagged snapshot lifecycle logger.
   */
  const rl = tagged({
    tag: openSemanticFile.name,
    l,
  },);
  /**
   * Canonical source key shared by overlay and project service.
   */
  const normalizedFileName = normalizeSemanticFileName(fileName,);
  /* oxlint-disable no-restricted-syntax/no-sync -- Synchronous Oxlint visitor must classify prior-path deletion before synchronous snapshot update. */
  /**
   * Previously active source removed from disk by rename or deletion.
   */
  const deletedFiles = (bridgeState.activeFileName !== NO_ACTIVE_FILE)
    && (bridgeState.activeFileName !== normalizedFileName)
    && (!existsSync(bridgeState.activeFileName,))
    ? [bridgeState.activeFileName,]
    : [];
  /* oxlint-enable no-restricted-syntax/no-sync */
  bridgeState.activeFileName = normalizedFileName;
  /* Every text handed to this bridge is kept, rather than cleared down to the active source.
   *
   * Clearing left the native server holding the text it was last given for a source the overlay
   * no longer claimed, because only the incoming source is reported through `fileChanges` and
   * nothing ever reported the outgoing one. Reporting it instead would mean a snapshot update on
   * every source, including the reuse path that exists precisely to avoid one, and a snapshot
   * update replaces every `Project` object in the process.
   *
   * Retaining reaches the same invariant for nothing: the server's view of a source is always the
   * text this bridge handed it, never a text it replaced without saying so. Under Oxlint the two
   * agree anyway, since it reads from disk; under a caller supplying an unsaved buffer the buffer
   * is the authority for that source, which is what retaining preserves.
   *
   * Bounded by the sources one process lints, whose text the fingerprint already holds. */
  deletedFiles.forEach(function dropDeletedOverlay(deletedFileName,): void {
    bridgeState.overlays
      .delete(deletedFileName,);
  },);
  bridgeState
    .overlays
    .set(
      normalizedFileName,
      sourceWithBOM({
        sourceText,
        hasBOM,
      },),
    );

  /**
   * Previously discovered configured project path for source.
   */
  const knownProject = cachedProjectForFile({
    fileName: normalizedFileName,
    projectByRoot: bridgeState.projectByRoot,
  },);
  /**
   * Project already materialized in current immutable snapshot.
   */
  const snapshotProject = (knownProject === undefined)
    || (bridgeState.snapshot === NO_SNAPSHOT)
    ? undefined
    : bridgeState
      .snapshot
      .getProject(knownProject,);
  /**
   * Source already materialized in current immutable snapshot.
   */
  const snapshotSourceFile = snapshotProject
    ?.program
    .getSourceFile(normalizedFileName,);
  if ((deletedFiles.length === 0)
    && (snapshotProject !== undefined)
    && (snapshotSourceFile !== undefined)
    && (snapshotSourceFile.text === sourceWithBOM({
      sourceText,
      hasBOM,
    },))) {
    rl.debug(`reused unchanged snapshot for ${normalizedFileName} through ${snapshotProject.configFileName}`,);
    return semanticFileSession({
      fileName: normalizedFileName,
      project: snapshotProject,
      sourceFile: snapshotSourceFile,
      hasBOM,
    },);
  }
  /**
   * Native API client reused across all linted files in process.
   */
  const api = getApi();
  /* No `clearSourceFileCache()` here. It is `sourceFileCache.clear()`, which drops every decoded
   * source for every project, and `updateSnapshot` below already calls `retainForSnapshot` to
   * carry entries forward for exactly the paths the native server did not report as changed.
   * Emptying the store first costs one full re-decode of every project a worker returns to,
   * measured at 154.6ms per project against 0.6ms for a pass that finds them present.
   *
   * What makes dropping it safe is not that the store is hashed. `getRetained` matches on the
   * retained reference and never rechecks the content hash. It is that the only text this bridge
   * ever changes is the active file's overlay, and it reports that file through `fileChanges`
   * below, so retention excludes it and it alone is refetched.
   *
   * Every text this bridge hands over is kept, so the server's view of a source is always the text
   * it was given, and the file it is about to reread is named through `fileChanges`. */
  /**
   * Whether current source is reusable from project this bridge selected for it.
   */
  const sourcePreviouslyKnown = snapshotSourceFile !== undefined;
  /**
   * Snapshot the native service is currently answering from, absent before first update.
   */
  const currentSnapshot = bridgeState.snapshot;
  /* Announcing a source is a different question from reusing one, and deriving the first from the
   * second is how an overlay came to be ignored. A source is created only where the service holds
   * no copy of it at all; where any materialized project holds one, it is changed, and saying
   * created instead leaves the service on the text it read first.
   *
   * The two answers part company whenever the project cache is silent about a source the service
   * already read: a nearer configured project the walk refuses to look past, a source pulled in by
   * an importer under another project, or, before the root key joined one identity, every single
   * lookup on Windows. A cache miss then cost correctness rather than one discovery. */
  /**
   * Whether native service already holds this source under any materialized project.
   */
  const serviceHoldsSource = sourcePreviouslyKnown
    || ((currentSnapshot !== NO_SNAPSHOT)
      && snapshotHoldsSource({
        snapshot: currentSnapshot,
        fileName: normalizedFileName,
      },));
  /**
   * Whether current source requires open-file project association.
   */
  const needsDiscovery = (knownProject === undefined) || (!sourcePreviouslyKnown);
  /**
   * Snapshot used for configured-project discovery on first encounter or created file.
   */
  const discoverySnapshot = needsDiscovery
    ? api.updateSnapshot({
      openFiles: [normalizedFileName,],
      fileChanges: {
        created: serviceHoldsSource ? [] : [normalizedFileName,],
        changed: serviceHoldsSource ? [normalizedFileName,] : [],
        deleted: deletedFiles,
      },
    },)
    : NO_SNAPSHOT;
  /**
   * Config path discovered from temporary open-file association or prior cache.
   */
  const discoveredProject = {
    configFileName: sourcePreviouslyKnown ? knownProject : undefined,
  };
  if ((discoveredProject.configFileName === undefined)
    && (discoverySnapshot !== NO_SNAPSHOT)) {
    bridgeState.projectDiscoveryCount += 1;
    discoveredProject.configFileName = discoverySnapshot
      .getDefaultProjectForFile(normalizedFileName,)
      ?.configFileName;
  }
  /**
   * Configured project identity after discovery narrowing.
   */
  const { configFileName, } = discoveredProject;
  if ((configFileName === undefined)
    || (configFileName === INFERRED_PROJECT_CONFIG)) {
    /**
     * Snapshot closing temporary open-file association after failed discovery.
     */
    const releaseSnapshot = api.updateSnapshot({
      closeFiles: [normalizedFileName,],
    },);
    /* This failure advanced the service twice, and one of those updates may have reported the
     * previously active source as deleted. Keeping the snapshot from before them would leave the
     * bridge describing a service that still holds a source the service has dropped, and the next
     * open of that path would announce it as changed, which creates nothing: the project then omits
     * it and the open fails. The snapshot that closed the association is the current description,
     * so it is the one to keep. */
    if (bridgeState.snapshot !== NO_SNAPSHOT)
      bridgeState
        .snapshot
        .dispose();
    bridgeState.snapshot = releaseSnapshot;
    if (discoverySnapshot !== NO_SNAPSHOT)
      discoverySnapshot.dispose();
    bridgeState.activeFileName = NO_ACTIVE_FILE;
    /* Only this source's text goes. Every other one is text the service still holds and still
     * reads through this map, and dropping those reverts them to disk behind their own snapshot. */
    bridgeState.overlays
      .delete(normalizedFileName,);
    throw new SemanticBridgeError({
      reason: 'project-not-found',
      message: `TypeScript found no configured project for ${normalizedFileName}.`,
    },);
  }
  bridgeState
    .projectByRoot
    .set(
      semanticProjectRootKey(configFileName,),
      configFileName,
    );

  /* This update follows the discovery one, so it describes a service that has already processed
   * whatever discovery reported. The source is held by now either way: discovery announced it, or
   * it was never absent. So it is changed here, never created, and the deletions discovery already
   * carried are not replayed. Sampling the announcement once and sending it twice would describe
   * the service as it was before the first update rather than as it is before this one. */
  /**
   * New immutable project view reading current overlay outside LSP open-file cache.
   */
  const nextSnapshot = api.updateSnapshot({
    ...needsDiscovery
      ? {
        openProjects: [configFileName,],
        closeFiles: [normalizedFileName,],
      }
      : {},
    fileChanges: {
      changed: [normalizedFileName,],
      created: [],
      deleted: needsDiscovery ? [] : deletedFiles,
    },
  },);
  if (bridgeState.snapshot !== NO_SNAPSHOT)
    bridgeState
      .snapshot
      .dispose();
  if (discoverySnapshot !== NO_SNAPSHOT)
    discoverySnapshot.dispose();
  bridgeState.snapshot = nextSnapshot;

  /**
   * Configured project selected through cached project identity.
   */
  const project = nextSnapshot.getProject(configFileName,);
  if (project === undefined) {
    throw new SemanticBridgeError({
      reason: 'project-not-found',
      message: `TypeScript snapshot omitted configured project ${configFileName}.`,
    },);
  }
  /**
   * Source tree loaded from current snapshot overlay.
   */
  const sourceFile = project
    .program
    .getSourceFile(normalizedFileName,);
  if (sourceFile === undefined) {
    throw new SemanticBridgeError({
      reason: 'source-file-not-found',
      message: `TypeScript project ${project.configFileName} omitted ${normalizedFileName}.`,
    },);
  }
  rl.debug(`opened ${normalizedFileName} through ${project.configFileName}`,);

  return semanticFileSession({
    fileName: normalizedFileName,
    project,
    sourceFile,
    hasBOM,
  },);
}

export type { SemanticBridgeCacheStats, } from './semantic-bridge-cache.ts';
export type { SemanticFileSession, } from './semantic-file-session.ts';

/**
 * Reads bounded cache counts without exposing mutable bridge storage.
 *
 * @returns current overlay and configured-project root counts.
 *
 * @example
 * ```ts
 * semanticBridgeCacheStats();
 * ```
 */
export function semanticBridgeCacheStats(): SemanticBridgeCacheStats {
  return {
    overlayCount: bridgeState.overlays
      .size,
    projectRootCount: bridgeState.projectByRoot
      .size,
    projectDiscoveryCount: bridgeState.projectDiscoveryCount,
  };
}

/**
 * Disposes active snapshot and native TypeScript API process.
 *
 * Idempotent so tests and natural process shutdown may both invoke cleanup.
 *
 * @example
 * ```ts
 * closeSemanticBridge();
 * ```
 */
export function closeSemanticBridge(): void {
  resetSemanticEffectCaches();
  /**
   * Function-tagged cleanup lifecycle logger.
   */
  const rl = tagged({
    tag: closeSemanticBridge.name,
    l,
  },);
  if (bridgeState.snapshot !== NO_SNAPSHOT) {
    bridgeState
      .snapshot
      .dispose();
    bridgeState.snapshot = NO_SNAPSHOT;
  }
  if (bridgeState.api !== NO_API) {
    bridgeState
      .api
      .close();
    bridgeState.api = NO_API;
  }
  bridgeState
    .overlays
    .clear();
  bridgeState
    .projectByRoot
    .clear();
  bridgeState.activeFileName = NO_ACTIVE_FILE;
  bridgeState.projectDiscoveryCount = 0;
  rl.debug('closed TypeScript synchronous API',);
}
