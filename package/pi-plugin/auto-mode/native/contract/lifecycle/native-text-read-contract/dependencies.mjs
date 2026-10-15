import {
  isAbsolute,
  join
} from 'node:path';
import {
  DependencyCancellationError,
  DependencyConfigurationError,
  DependencyDeadlineError,
  DependencyHandleOwnershipError,
} from '../external-dependency-controls/errors.ts';
import {
  assertRetainedFile,
  observeDeclaredFile
} from '../external-dependency-controls/file-observer.ts';

//region One issuing root/deadline retains all dependencies behind opaque handles.
/** Mechanical freshness is not instruction authority or a human grant. */
export function createDependencyFacade({
  collector,
  rootAdapter,
  deadlineAt,
  rootDirectory,
  files,
  trace,
  now = function readDependencyClock() { return ( performance.now()); }
}) {
  if (((typeof now) !== 'function') || (!Number.isFinite(deadlineAt))) throw new DependencyDeadlineError();
  if (((typeof rootDirectory) !== 'string') || (!isAbsolute(rootDirectory))
    || (!Array.isArray(files))
    || ((typeof trace) !== 'function')) throw new DependencyConfigurationError();
  const handles = new WeakMap();
  const profile = Object.freeze(files.map(function validateDeclaredFileInput(file)  {
    const maxBytes = file.maxBytes ?? 65_536;
    if (((typeof file.relativePath) !== 'string') || (!Number.isInteger(file.requiredMode))
      || (file.requiredMode < 0)
      || (file.requiredMode > 511)
      || (!Number.isInteger(maxBytes))
      || (maxBytes < 1)
      || (maxBytes > 65_536)
      || ((file.read !== undefined) && ((typeof file.read) !== 'function'))) throw new DependencyConfigurationError();
    return Object.freeze({
      relativePath: file.relativePath,
      requiredMode: file.requiredMode,
      maxBytes,
      read: file.read
    });
  }));
  function checkSignal(signal) { if (signal.aborted) throw new DependencyCancellationError(); }
  function checkpoint(signal) {
    checkSignal(signal);
    const current = now();
    if ((!Number.isFinite(current)) || (current >= deadlineAt)) throw new DependencyDeadlineError();
  }
  function observe({
    stage,
    file,
    signal,
    verify = checkpoint
  }) {
    verify(signal);
    trace(`${stage  }.file:${  file.relativePath  }.enter`);
    const observation = observeDeclaredFile({
      root: rootDirectory,
      ...file
    });
    trace(`${stage  }.file:${
       file.relativePath
       }.return`);
    verify(signal);
    return observation;
  }
  function prepare({ signal }) {
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
  }) {
    trace('finalize.handle-check');
    const prepared = handles.get(handle);
    if (prepared === undefined) throw new DependencyHandleOwnershipError();
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
        initial: prepared.observed[index],
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
  function finalize(handle) { return revalidate({
    handle,
    verify:checkpoint
  }); }
  /** Recheck retained dependencies and cancellation, not the completed decision-model clock. */
  function checkRetained(handle) { return revalidate({
    handle,
    verify:checkSignal
  }); }
  /** Read inert original bytes only from the issuing dependency record, never from a caller projection. */
  function originalFile({
    handle,
    absolutePath
  }) {
    const prepared = handles.get(handle);
    if (!prepared) throw new DependencyHandleOwnershipError();
    checkpoint(prepared.signal);
    const index = profile.findIndex(function matchesDeclaredAbsolutePath(file) { return ( join(
      rootDirectory,
      file.relativePath
    ) === absolutePath); });
    if (index === (-1)) return Object.freeze({ kind: 'undeclared-file' });
    const file = profile[index];
    const observation = prepared.observed[index];
    if (file.read !== undefined) return Object.freeze({ kind: 'controlled-file-observer' });
    return Object.freeze({
      kind: 'original-file',
      absolutePath,
      relativePath: file.relativePath,
      dev: String(observation.dev),
      ino: String(observation.ino),
      mode: observation.mode,
      bytesBase64: observation.bytes
        .toString('base64'),
    });
  }
  return Object.freeze({
    prepare,
    finalize,
    checkRetained,
    originalFile
  });
}
//endregion
