/** Original dependency facade retains root, source, file, deadline, and cancellation ownership. @module */
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {nonNullishOrThrow} from '@monochromatic-dev/module-or-throw/ts';
import {createDependencyProfile} from './dependency-profile.ts';
import {requireDependencyRecord} from './dependency-record.ts';
import {createOriginalFileReader} from './dependency-original-file.ts';
import type {DependencySources,DependencyFacadeInput,DependencyFacade,DependencyRecord,DependencyFileProfile,DependencyVerification,DependencyProjection} from './dependency-types.ts';
import type {FileObservation} from '../external-dependency-controls/file-observation-types.ts';
import {isAbsolute} from 'node:path';
import {
  DependencyCancellationError,
  DependencyConfigurationError,
  DependencyDeadlineError,
} from '../external-dependency-controls/errors.ts';
import {
  assertRetainedFile,
  observeDeclaredFile
} from '../external-dependency-controls/file-observer.ts';

/** Dependency logs identify lifecycle boundaries without serializing original values. */
const l=tagged({tag:'auto-mode-dependency-owner'});

//region One issuing root/deadline retains all dependencies behind opaque handles.
/** Mechanical freshness is not instruction authority or a human grant. */
export function createDependencyFacade<const Source extends DependencySources, const Root extends object>({
  collector,
  rootAdapter,
  deadlineAt,
  rootDirectory,
  files,
  trace,
  now = function readDependencyClock() { return ( performance.now()); }
}: DependencyFacadeInput<Source, Root>): DependencyFacade {
  /** Original diagnostics omit root, source, and declared file values. */
  const rl=tagged({tag:createDependencyFacade.name,l});
  rl.debug("binding original dependency facade");
  if (((typeof now) !== 'function') || (!Number.isFinite(deadlineAt))) throw new DependencyDeadlineError();
  if (((typeof rootDirectory) !== 'string') || (!isAbsolute(rootDirectory))
    || (!Array.isArray(files))
    || ((typeof trace) !== 'function')) throw new DependencyConfigurationError();
  /** Original opaque handles remain private to their issuing dependency facade. */
  const handles = new WeakMap<object,DependencyRecord<Source,Root>>();
  /** Original declaration validation remains after owner allocation. */
  const profile=createDependencyProfile(files);
  function checkSignal(signal:AbortSignal):void { if (signal.aborted) throw new DependencyCancellationError(); }
  function checkpoint(signal:AbortSignal):void {
    checkSignal(signal);
    const current = now();
    if ((!Number.isFinite(current)) || (current >= deadlineAt)) throw new DependencyDeadlineError();
  }
  function observe({
    stage,
    file,
    signal,
    verify = checkpoint
  }:Readonly<{stage:string;file:DependencyFileProfile;signal:AbortSignal;verify?:DependencyVerification}>):FileObservation {
    verify(signal);
    trace(`${stage  }.file:${  file.relativePath  }.enter`);
    const observation = observeDeclaredFile({
      root: rootDirectory,
      relativePath:file.relativePath,requiredMode:file.requiredMode,maxBytes:file.maxBytes,
      ...(file.read===undefined?{}:{read:file.read})
    });
    trace(`${stage  }.file:${
       file.relativePath
       }.return`);
    verify(signal);
    return observation;
  }
  function prepare({ signal }:Readonly<{signal:AbortSignal}>):object {
    trace('prepare.entry');
    checkpoint(signal);
    trace('prepare.root.enter');
    const root = rootAdapter.prepare();
    trace('prepare.root.return');
    checkpoint(signal);
    trace('prepare.collector.enter');
    const sources = collector.capture({ signal });
    trace('prepare.collector.return');
    checkpoint(signal);
    const observed = profile.map(function observePreparedFile(file) { return ( observe({
      stage: 'prepare',
      file,
      signal
    })); });
    checkpoint(signal);
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
  function revalidate({
    handle,
    verify
  }:Readonly<{handle:unknown;verify:DependencyVerification}>):DependencyProjection {
    trace('finalize.handle-check');
    const prepared = requireDependencyRecord({handles,handle});
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
    const projection = Object.freeze({
      mechanicalDependenciesCurrent: true,
      decisionDeadlineChecked: verify === checkpoint,
      unqualifiedCoverage: prepared.sources
        .unqualifiedCoverage,
      instructionAuthority: 'not-established',
      humanWitness: 'not-established',
      currentEligibilityEstablished: false,
      productionPermission: false,
      actualSDKRootAdapterQualified: false,
    });
    trace('finalize.success');
    verify(prepared.signal);
    return projection;
  }
  function finalize(handle:unknown):DependencyProjection { return revalidate({
    handle,
    verify:checkpoint
  }); }
  /** Recheck retained dependencies and cancellation, not the completed decision-model clock. */
  function checkRetained(handle:unknown):DependencyProjection { return revalidate({
    handle,
    verify:checkSignal
  }); }
  /** Original file reader shares this exact issuing owner and completed observations. */
  const originalFile=createOriginalFileReader({handles,checkpoint,profile,rootDirectory});
  return Object.freeze({
    prepare,
    finalize,
    checkRetained,
    originalFile
  });
}
//endregion
