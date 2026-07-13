/**
 * TypeScript 7 synchronous semantic bridge for Oxlint JavaScript rules.
 *
 * @module
 */

import { existsSync, } from 'node:fs';
import { dirname, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { version as typescriptVersion, } from 'typescript';
import {
  API,
  type Checker,
  type Project,
  type Snapshot,
} from 'typescript/unstable/sync';
import type {
  Node,
  SourceFile,
} from 'typescript/unstable/ast';

import {
  cachedProjectForFile,
  type SemanticBridgeCacheStats,
} from './semantic-bridge-cache.ts';
import { SemanticBridgeError, } from './semantic-bridge-error.ts';
import { normalizeSemanticFileName, } from './semantic-file-name.ts';
import {
  findNodeAtOffset,
  typescriptOffset,
} from './typescript-node-map.ts';

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
  exitHookRegistered: boolean;
} = {
  api: NO_API,
  snapshot: NO_SNAPSHOT,
  overlays: new Map(),
  projectByRoot: new Map(),
  activeFileName: NO_ACTIVE_FILE,
  exitHookRegistered: false,
};

/**
 * Semantic handles for one current source snapshot.
 *
 * @example
 * ```ts
 * const session = openSemanticFile({ fileName, sourceText, hasBOM: false });
 * const type = session.checker.getTypeAtLocation(session.nodeAtOffset(10));
 * ```
 */
export type SemanticFileSession = {
  /**
   * Canonical absolute source path used by TypeScript project service.
   */
  readonly fileName: string;
  /**
   * Configured or inferred project selected for source.
   */
  readonly project: Project;
  /**
   * Project checker tied to active snapshot.
   */
  readonly checker: Checker;
  /**
   * Source tree including current virtual overlay.
   */
  readonly sourceFile: SourceFile;
  /**
   * Maps Oxlint range offset to deepest TypeScript node.
   */
  readonly nodeAtOffset: (offset: number) => Node;
};

/* oxlint-disable no-restricted-syntax/no-nullish-union -- TypeScript FileSystem callbacks require undefined fallback sentinels. */
/**
 * Overlay file text or TypeScript's real-filesystem delegation sentinel.
 */
type OverlayFileTextOrRealFileSystemFallback = string | undefined;

/**
 * Positive overlay presence or TypeScript's real-filesystem delegation sentinel.
 */
type OverlayPresenceOrRealFileSystemFallback = true | undefined;

/**
 * Reads virtual current-file content or delegates to TypeScript real filesystem.
 *
 * @param fileName - Path requested by native TypeScript process.
 *
 * @returns overlay content or undefined for real-filesystem fallback.
 *
 * @example
 * ```ts
 * readFileFromOverlayOrDelegate('/repo/src/index.ts');
 * ```
 */
function readFileFromOverlayOrDelegate(
  fileName: string,
): OverlayFileTextOrRealFileSystemFallback {
  return bridgeState
    .overlays
    .get(normalizeSemanticFileName(fileName,),);
}

/**
 * Reports positive overlay presence or delegates unknown paths to real filesystem.
 *
 * @param fileName - Path requested by native TypeScript process.
 *
 * @returns true for overlay file or delegation sentinel for every other path.
 *
 * @example
 * ```ts
 * reportOverlayPresenceOrDelegate('/repo/src/index.ts');
 * ```
 */
function reportOverlayPresenceOrDelegate(
  fileName: string,
): OverlayPresenceOrRealFileSystemFallback {
  return bridgeState
    .overlays
    .has(normalizeSemanticFileName(fileName,),) ? true : undefined;
}
/* oxlint-enable no-restricted-syntax/no-nullish-union */

/**
 * Verifies installed compiler belongs to selected unstable major.
 *
 * @throws {@link SemanticBridgeError} when runtime compiler major is not 7.
 */
function assertTypeScriptSeven(): void {
  /**
   * Major component before first version separator.
   */
  const [major,] = typescriptVersion.split('.',);
  if (major !== '7') {
    throw new SemanticBridgeError({
      reason: 'api-unavailable',
      message: `Expected TypeScript 7 semantic bridge, received ${typescriptVersion}.`,
    },);
  }
}

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
    bridgeState.api = new API({
      cwd: process.cwd(),
      fs: {
        readFile: readFileFromOverlayOrDelegate,
        fileExists: reportOverlayPresenceOrDelegate,
      },
    },);
    rl.debug(`started TypeScript ${typescriptVersion} synchronous API`,);
  }
  catch (error) {
    rl.error(`failed to start TypeScript synchronous API: ${String(error,)}`,);
    throw new SemanticBridgeError({
      reason: 'api-unavailable',
      message: `TypeScript ${typescriptVersion} synchronous API failed to start: ${String(error,)}`,
    },);
  }

  if (!bridgeState.exitHookRegistered) {
    process.once(
      'exit',
      closeSemanticBridge,
    );
    bridgeState.exitHookRegistered = true;
  }
  return bridgeState.api;
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
  bridgeState.overlays
    .clear();
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
   * Native API client reused across all linted files in process.
   */
  const api = getApi();
  // Invalidate client-decoded source objects before native server reports changed overlay.
  api
    .clearSourceFileCache();
  /**
   * Previously discovered configured project path for source.
   */
  const knownProject = cachedProjectForFile({
    fileName: normalizedFileName,
    projectByRoot: bridgeState.projectByRoot,
  },);
  /**
   * Whether active snapshot already contains current source path.
   */
  const sourcePreviouslyKnown = (knownProject !== undefined)
    && (bridgeState.snapshot !== NO_SNAPSHOT)
    && (bridgeState.snapshot
      .getProject(knownProject,)
      ?.program
      .getSourceFile(normalizedFileName,)
      !== undefined);
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
        created: sourcePreviouslyKnown ? [] : [normalizedFileName,],
        changed: sourcePreviouslyKnown ? [normalizedFileName,] : [],
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
    releaseSnapshot.dispose();
    if (discoverySnapshot !== NO_SNAPSHOT)
      discoverySnapshot.dispose();
    bridgeState.activeFileName = NO_ACTIVE_FILE;
    bridgeState.overlays
      .clear();
    throw new SemanticBridgeError({
      reason: 'project-not-found',
      message: `TypeScript found no configured project for ${normalizedFileName}.`,
    },);
  }
  bridgeState
    .projectByRoot
    .set(
      dirname(configFileName,),
      configFileName,
    );

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
      changed: sourcePreviouslyKnown ? [normalizedFileName,] : [],
      created: sourcePreviouslyKnown ? [] : [normalizedFileName,],
      deleted: deletedFiles,
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

  return {
    fileName: normalizedFileName,
    project,
    checker: project.checker,
    sourceFile,
    nodeAtOffset(offset: number,): Node {
      return findNodeAtOffset({
        sourceFile,
        offset: typescriptOffset({
          offset,
          hasBOM,
        },),
      },);
    },
  };
}

export type { SemanticBridgeCacheStats, } from './semantic-bridge-cache.ts';

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
  };
}

/**
 * Disposes active snapshot and native TypeScript API process.
 *
 * Idempotent so tests and process exit may both invoke cleanup.
 *
 * @example
 * ```ts
 * closeSemanticBridge();
 * ```
 */
export function closeSemanticBridge(): void {
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
  rl.debug('closed TypeScript synchronous API',);
}
