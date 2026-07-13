/**
 * TypeScript 7 synchronous semantic bridge for Oxlint JavaScript rules.
 *
 * @module
 */

import { resolve, } from 'node:path';

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

import { SemanticBridgeError, } from './semantic-bridge-error.ts';
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
 * UTF-16 byte-order mark restored when Oxlint strips it from source text.
 */
const BYTE_ORDER_MARK = '\uFEFF';

/**
 * Mutable process-local bridge state hidden behind exported lifecycle functions.
 */
const bridgeState: {
  api: API | typeof NO_API;
  snapshot: Snapshot | typeof NO_SNAPSHOT;
  readonly overlays: Map<string, string>;
  readonly projectByFile: Map<string, string>;
  exitHookRegistered: boolean;
} = {
  api: NO_API,
  snapshot: NO_SNAPSHOT,
  overlays: new Map(),
  projectByFile: new Map(),
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

/**
 * Normalizes source path for overlay and project lookup.
 *
 * @param fileName - Host-provided absolute or relative source path.
 *
 * @returns absolute platform-normalized source path.
 *
 * @example
 * ```ts
 * normalizeFileName('src/index.ts');
 * ```
 */
function normalizeFileName(fileName: string,): string {
  return resolve(fileName,);
}

/* oxlint-disable no-restricted-syntax/no-nullish-union -- TypeScript FileSystem callbacks require undefined to delegate to the real filesystem. */
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
    .get(normalizeFileName(fileName,),);
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
    .has(normalizeFileName(fileName,),) ? true : undefined;
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
  const normalizedFileName = normalizeFileName(fileName,);
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
  const knownProject = bridgeState
    .projectByFile
    .get(normalizedFileName,);
  /**
   * Snapshot used for configured-project discovery on first encounter.
   */
  const discoverySnapshot = knownProject === undefined
    ? api.updateSnapshot({
      openFiles: [normalizedFileName,],
      fileChanges: { changed: [normalizedFileName,], },
    },)
    : NO_SNAPSHOT;
  /**
   * Config path discovered from temporary open-file association or prior cache.
   */
  const discoveredProject = { configFileName: knownProject, };
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
  if (configFileName === undefined) {
    throw new SemanticBridgeError({
      reason: 'project-not-found',
      message: `TypeScript found no configured project for ${normalizedFileName}.`,
    },);
  }
  bridgeState
    .projectByFile
    .set(
      normalizedFileName,
      configFileName,
    );

  /**
   * New immutable project view reading current overlay outside LSP open-file cache.
   */
  const nextSnapshot = api.updateSnapshot({
    ...knownProject === undefined
      ? {
        openProjects: [configFileName,],
        closeFiles: [normalizedFileName,],
      }
      : {},
    fileChanges: { changed: [normalizedFileName,], },
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
    .projectByFile
    .clear();
  rl.debug('closed TypeScript synchronous API',);
}
