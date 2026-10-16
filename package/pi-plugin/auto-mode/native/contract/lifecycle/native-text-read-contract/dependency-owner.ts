/**
 Original dependency facade retains root, source, file, deadline, and cancellation ownership. @module
 */
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {nonNullishOrThrow} from '@monochromatic-dev/module-or-throw/ts';
import {createDependencyProfile} from './dependency-profile.ts';
import {requireDependencyRecord} from './dependency-record.ts';
import {createOriginalFileReader} from './dependency-original-file.ts';
import type {
  DependencySources,
  DependencyFacadeInput,
  DependencyFacade,
  DependencyRecord,
  DependencyFileProfile,
  DependencyVerification,
  DependencyProjection
} from './dependency-types.ts';
import type {FileObservation} from '../external-dependency-controls/file-observation-types.ts';
import {isAbsolute} from 'node:path';
import {
  DependencyCancellationError,
  DependencyConfigurationError,
  DependencyClockError,
} from '../external-dependency-controls/errors.ts';
import {
  assertRetainedFile,
  observeDeclaredFile
} from '../external-dependency-controls/file-observer.ts';

/**
 Dependency logs identify lifecycle boundaries without serializing original values.
 */
const l=tagged({tag:'auto-mode-dependency-owner'});

/**
 Read the original native monotonic clock when no bootstrap override is supplied.

 @returns native elapsed clock reading without a new deadline
 */
function readDependencyClock(): number {
  return performance.now();
}

/**
 Retained checks keep original cancellation without reviving the completed model clock.

 @param signal - original observation cancellation

 @throws DependencyCancellationError when original cancellation has fired
 */
function checkSignal(signal: AbortSignal): void {
  if (signal.aborted) throw new DependencyCancellationError();
}

//region One issuing root/deadline retains all dependencies behind opaque handles.
/**
 Bind original root, source, file, deadline, and cancellation observers.
 Mechanical freshness does not establish instruction authority or human permission.

 @param collector - original source capture and freshness capabilities

 @param rootAdapter - original root capture and finalization capabilities

 @param targetAt - fixed preparation-inclusive expiry

 @param rootDirectory - original file selection root

 @param files - declared bounded file observations

 @param trace - original lifecycle observer retaining boundary order

 @param now - original clock used only by live eligibility checks

 @returns frozen dependency operations sharing original opaque records

 @throws DependencyClockError when the original deadline or clock is invalid

 @throws DependencyConfigurationError when the original root or file profile is invalid

 @example createDependencyFacade(input);
 */
export function createDependencyFacade<const Source extends DependencySources, const Root extends object>({
  collector,
  rootAdapter,
  targetAt,
  rootDirectory,
  files,
  trace,
  now = readDependencyClock
}: DependencyFacadeInput<Source, Root>): DependencyFacade {
  /**
   Original diagnostics omit root, source, and declared file values.
   */
  const rl=tagged({
    tag:createDependencyFacade.name,
    l
  });
  rl.debug("binding original dependency facade");
  if (((typeof now) !== 'function') || (!Number.isFinite(targetAt))) throw new DependencyClockError();
  if (((typeof rootDirectory) !== 'string') || (!isAbsolute(rootDirectory))
    || (!Array.isArray(files))
    || ((typeof trace) !== 'function')) throw new DependencyConfigurationError();
  /**
   Original opaque handles remain private to their issuing dependency facade.
   */
  const handles = new WeakMap<object,DependencyRecord<Source,Root>>();
  /**
   Original declaration validation remains after owner allocation.
   */
  const profile=createDependencyProfile(files);
  /**
   Live checks observe cancellation before the fixed original deadline.

   @param signal - original dependency cancellation

   @throws DependencyClockError when the clock is non-finite or the original deadline has expired
   */
  function checkpoint(signal:AbortSignal):void {
    checkSignal(signal);
    /**
     Original clock remains unread during retained-only revalidation.
     */
    const current = now();
    if (!Number.isFinite(current)) throw new DependencyClockError();
  }
  /**
   Observe one original file between the selected live or retained checks.

   @param stage - original preparation or finalization trace phase

   @param file - validated original selected file

   @param signal - original record cancellation

   @param verify - original live deadline or retained cancellation verifier

   @returns completed original descriptor-bound observation
   */
  function observe({
    stage,
    file,
    signal,
    verify = checkpoint
  }:Readonly<{
    stage:string;
    file:DependencyFileProfile;
    signal:AbortSignal;
    verify?:DependencyVerification
  }>):FileObservation {
    verify(signal);
    trace(`${stage  }.file:${  file.relativePath  }.enter`);
    /**
     Completed file observation retains the original synchronous freshness boundary.
     */
    const observation = observeDeclaredFile({
      root: rootDirectory,
      relativePath:file.relativePath,
      requiredMode:file.requiredMode,
      maxBytes:file.maxBytes,
      ...(file.read===undefined?{}:{read:file.read})
    });
    trace(`${stage  }.file:${
       file.relativePath
       }.return`);
    verify(signal);
    return observation;
  }
  /**
   Capture original roots and sources before observing declared files and publishing ownership.

   @param signal - cancellation retained by this preparation occurrence

   @returns opaque original handle after the final preparation check
   */
  function prepare({ signal }:Readonly<{signal:AbortSignal}>):object {
    trace('prepare.entry');
    checkpoint(signal);
    trace('prepare.root.enter');
    /**
     Original root identity remains private behind the issued handle.
     */
    const root = rootAdapter.prepare();
    trace('prepare.root.return');
    checkpoint(signal);
    trace('prepare.collector.enter');
    /**
     Original source capture retains the caller's exact collection.
     */
    const sources = collector.capture({ signal });
    trace('prepare.collector.return');
    checkpoint(signal);
    /**
     Completed observations preserve original declaration order.
     */
    const observed = profile.map(function observePreparedFile(file) { 
      return ( observe({
      stage: 'prepare',
      file,
      signal
    })); 
    });
    checkpoint(signal);
    /**
     Only this opaque occurrence identity can retrieve the retained record.
     */
    const handle = Object.freeze({});
    handles.set(
      handle,
      Object.freeze({
        signal,
        root,
        sources,
        observed: Object.freeze(observed)
      })
    );
    trace('prepare.success');
    checkpoint(signal);
    return handle;
  }
  /**
   Recheck original ownership, root, source, and files before returning mechanical evidence.

   @param handle - candidate original occurrence identity

   @param verify - original live or retained eligibility boundary

   @returns mechanical projection without policy authority or permission
   */
  function revalidate({
    handle,
    verify
  }:Readonly<{
    handle:unknown;
    verify:DependencyVerification
  }>):DependencyProjection {
    trace('finalize.handle-check');
    /**
     Foreign handles fail before any original dependency callbacks run.
     */
    const prepared = requireDependencyRecord({
      handles,
      handle
    });
    trace('finalize.handle-owned');
    trace('finalize.entry');
    verify(prepared.signal);
    trace('finalize.root.enter');
    rootAdapter.finalize(prepared.root);
    trace('finalize.root.return');
    verify(prepared.signal);
    trace('finalize.collector.enter');
    collector.assertObservedFresh(prepared.sources);
    trace('finalize.collector.return');
    verify(prepared.signal);
    for (const [index, file] of profile.entries()) {
      /**
       Reobservation completes before comparing retained descriptor identity and bytes.
       */
      const current = observe({
        stage: 'finalize',
        file,
        signal: prepared.signal,
        verify
      });
      assertRetainedFile({
        initial: nonNullishOrThrow(prepared.observed[index]),
        current
      });
    }
    /**
     Mechanical status explicitly withholds instruction authority and human permission.
     */
    const projection = Object.freeze({
      mechanicalDependenciesCurrent: true,
      decisionClockChecked: verify === checkpoint,
      unqualifiedCoverage: prepared.sources
        .unqualifiedCoverage,
      instructionAuthority: 'not-established',
      humanWitness: 'not-established',
      currentEligibilityEstablished: false,
      productionPermission: false,
      actualSDKRootAdapterQualified: false,
    } satisfies DependencyProjection);
    trace('finalize.success');
    verify(prepared.signal);
    return projection;
  }
  /**
   Revalidate original live dependencies using the preparation-inclusive deadline.

   @param handle - original issued occurrence

   @returns current mechanical projection after the final live check
   */
  function finalize(handle:unknown):DependencyProjection { 
    return revalidate({
    handle,
    verify:checkpoint
  }); 
  }
  /**
   Recheck retained dependencies and cancellation after model evidence closes.

   @param handle - original issued occurrence

   @returns retained mechanical projection without asserting current model lifetime
   */
  function checkRetained(handle:unknown):DependencyProjection { 
    return revalidate({
    handle,
    verify:checkSignal
  }); 
  }
  /**
   Original file reader shares this exact issuing owner and completed observations.
   */
  const originalFile=createOriginalFileReader({
    handles,
    checkpoint,
    profile,
    rootDirectory
  });
  return Object.freeze({
    prepare,
    finalize,
    checkRetained,
    originalFile
  });
}
//endregion
