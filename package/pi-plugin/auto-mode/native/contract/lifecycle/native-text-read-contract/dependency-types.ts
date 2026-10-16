/**
 Native dependency facade capabilities retain original mechanical evidence boundaries. @module
 */
import type {
  FileObservationInput,
  FileObservation
} from '../external-dependency-controls/file-observation-types.ts';

/**
 Source projection preserves original unqualified coverage without implying authority.
 */
export type DependencySources = Readonly<{ unqualifiedCoverage?: unknown }>;

/**
 Root and source observers retain their exact caller-owned identities across revalidation.
 */
export type DependencyFacadeInput<Source extends DependencySources, Root extends object> = Readonly<{
  collector: Readonly<{
    capture: (input: Readonly<{ signal: AbortSignal }>) => Source;
    assertObservedFresh: (sources: Source) => unknown;
  }>;
  rootAdapter: Readonly<{
    prepare: () => Root;
    finalize: (root: Root) => unknown
  }>;
  targetAt: number;
  rootDirectory: string;
  files: readonly Omit<FileObservationInput, 'root'>[];
  trace: (event: string) => void;
  now?: () => number;
}>;

/**
 Successful dependency inspection never establishes instruction authority or execution permission.
 */
export type DependencyProjection = Readonly<{
  mechanicalDependenciesCurrent: true;
  decisionClockChecked: boolean;
  unqualifiedCoverage: unknown;
  instructionAuthority: 'not-established';
  humanWitness: 'not-established';
  currentEligibilityEstablished: false;
  productionPermission: false;
  actualSDKRootAdapterQualified: false;
}>;

/**
 Inert original file reads distinguish undeclared paths from controlled observers and owned bytes.
 */
export type DependencyOriginalFile = Readonly<{ kind: 'undeclared-file' | 'controlled-file-observer' }>
  | Readonly<{
    kind: 'original-file';
    absolutePath: unknown;
    relativePath: string;
    dev: string;
    ino: string;
    mode: number;
    bytesBase64: string;
  }>;

/**
 Original handle ownership is checked before live or retained dependency revalidation.
 */
export type DependencyFacade = Readonly<{
  prepare: (input: Readonly<{ signal: AbortSignal }>) => object;
  finalize: (handle: unknown) => DependencyProjection;
  checkRetained: (handle: unknown) => DependencyProjection;
  originalFile: (input: Readonly<{
    handle: unknown;
    absolutePath: unknown
  }>) => DependencyOriginalFile;
}>;

/**
 Declared observations retain an explicit default bound and original optional reader.
 */
export type DependencyFileProfile = Readonly<{
  relativePath: string;
  requiredMode: number;
  maxBytes: number;
  read: FileObservationInput['read'];
}>;

/**
 Original native handles retain exact root, source, cancellation, and completed file identities.
 */
export type DependencyRecord<Source extends DependencySources, Root extends object> = Readonly<{
  signal: AbortSignal;
  root: Root;
  sources: Source;
  observed: readonly FileObservation[];
}>;

/**
 Live checks use the original deadline; retained checks observe original cancellation only.
 */
export type DependencyVerification = (signal: AbortSignal) => void;
