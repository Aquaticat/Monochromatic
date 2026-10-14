import { createLifecyclePath } from './lifecycle.mjs';
import { captureBranchValues } from '../native-manager-dependency-controls/branch-values.mjs';
import {
  NativeManagerSessionIdentityError,
  NativeManagerSnapshotOwnershipError,
  NativeManagerSnapshotStaleError,
  NativeManagerObservationShapeError
} from '../native-manager-dependency-controls/errors.mjs';
import { readNativeGetter } from '../native-manager-dependency-controls/native-read.mjs';

//region Exact returned manager identity owns canonical local epochs, not authority.
/** Duplicate binds share only a manager's registry-local epoch; tokens stay issuer-local. */
export function createNativeManagerRegistry({
  owner,
  sessionOwner,
  readRootOccurrence,
  plannedId,
  trace,
  accounting
}) {
  const states = new WeakMap();
  accounting.registryRequests += 1;
  function stateFor(manager) {
    owner.assertOwned(manager);
    let state = states.get(manager);
    if (state === undefined) {
      state = { epoch: 0 };
      states.set(
        manager,
        state
      );
      accounting.canonicalManagerStatesCreated += 1;
    } else accounting.reusedCanonicalStateBinds += 1;
    return state;
  }
  function bind(manager) {
    accounting.adapterBindAttempts += 1;
    const canonical = stateFor(manager);
    const snapshots = new WeakMap();
    function read({
      phase,
      method,
      label
    }) { return readNativeGetter({
      manager,
      method,
      phase,
      label,
      trace,
      accounting
    }); }
    function observe(phase) {
      const sessionId = read({
        phase,
        method: 'getSessionId',
        label: 'session-id'
      });
      if (sessionId !== plannedId) throw new NativeManagerSessionIdentityError();
      const leafId = read({
        phase,
        method: 'getLeafId',
        label: 'leaf'
      });
      const sessionFile = read({
        phase,
        method: 'getSessionFile',
        label: 'session-file'
      });
      const branch = captureBranchValues(read({
        phase,
        method: 'getBranch',
        label: 'branch'
      }));
      if (((leafId !== null) && ((typeof leafId) !== 'string')) || ((typeof sessionFile) !== 'string')) throw new NativeManagerObservationShapeError('Native leaf or persistent session-file path differs from the declared observation shape');
      return Object.freeze({
        epoch: canonical.epoch,
        sessionId,
        leafId,
        sessionFile,
        branch
      });
    }
    function prepare() {
      accounting.ownedSnapshotPrepareAttempts += 1;
      trace('native.prepare.entry');
      const original = observe('prepare');
      const token = Object.freeze({});
      snapshots.set(
        token,
        original
      );
      accounting.returnedOwnedSnapshots += 1;
      trace('native.prepare.success');
      return token;
    }
    function finalize(token) {
      accounting.nativeSnapshotFinalizeAttempts += 1;
      trace('native.finalize.entry');
      trace('native.finalize.handle-check');
      const original = snapshots.get(token);
      if (original === undefined) throw new NativeManagerSnapshotOwnershipError();
      trace('native.finalize.handle-owned');
      trace('native.finalize.epoch-check');
      if (canonical.epoch !== original.epoch) throw new NativeManagerSnapshotStaleError();
      trace('native.finalize.epoch-current');
      const current = observe('finalize');
      if ((current.leafId !== original.leafId) || (current.sessionFile !== original.sessionFile)
        ||
          (JSON.stringify(current.branch) !== JSON.stringify(original.branch))) throw new NativeManagerSnapshotStaleError();
      accounting.completedNativeSnapshotFinalizations += 1;
      trace('native.finalize.success');
    }
    function invalidate() {
      trace('native.invalidate.entry');
      canonical.epoch += 1;
      trace('native.invalidate.completed');
    }
    accounting.returnedAdapters += 1;
    return Object.freeze({
      prepare,
      finalize,
      invalidate
    });
  }
  accounting.returnedRegistries += 1;
  const lifecycle = createLifecyclePath({
    stateFor,
    sessionOwner,
    trace,
    readRootOccurrence
  });
  return Object.freeze({
    bind,
    lifecycle
  });
}
//endregion
