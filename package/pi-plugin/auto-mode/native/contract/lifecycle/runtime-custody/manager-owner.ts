/**
 Retain original native constructor results under one fixed bootstrap owner.

 @module
 */
import type { SessionManager, NewSessionOptions, FileEntry } from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { RootLeaseOwnershipError } from '../runtime-root-lifecycle/errors.ts';
import type { ManagerConstructorInput, ManagerConstructorName, ManagerConstructorOwner, ManagerConstructors } from './manager-types.ts';

//region Native constructor results establish ownership independently of metadata

/**
 Constructor ownership diagnostics retain their module boundary.
 */
const l = tagged({ tag: 'auto-mode-native-manager-owner' });

/**
 Capture the native constructor capabilities before publishing the owner facade.

 @param nativeManager - original constructor selected by qualified native bootstrap

 @returns constructor facade and private-membership checks for its returned managers

 @throws RootLeaseOwnershipError when required native constructor capabilities are absent

 @example
 ```ts
 const owner = createManagerConstructorOwner(SessionManager);
 const manager = owner.managers.inMemory(cwd);
 owner.assertOwned(manager);
 ```
 */
export function createManagerConstructorOwner(nativeManager: ForeignBorrowed<ManagerConstructorInput>): ManagerConstructorOwner {
  /**
   The constructor factory keeps diagnostics separate from runtime root transitions.
   */
  const rl = tagged({ tag: createManagerConstructorOwner.name, l });
  /**
   Membership contains only actual results returned by the captured native constructors.
   */
  const owned = new WeakSet<object>();
  /**
   Counts describe constructor use without retaining the managers themselves.
   */
  const counts: Record<ManagerConstructorName, number> = { create: 0, open: 0, inMemory: 0, continueRecent: 0, forkFrom: 0 };
  /**
   Capabilities retain their original identity and receiver even if a caller later replaces class properties.
   */
  const { create, open, inMemory, continueRecent, forkFrom } = nativeManager;
  if (typeof create !== 'function' || typeof open !== 'function' || typeof inMemory !== 'function')
    throw new RootLeaseOwnershipError('Native manager constructors are unavailable');
  rl.debug('captured native manager constructors');

  /**
   Publish membership only after the native constructor returned its original manager.

   @param value - original result retained directly from a captured native constructor

   @param kind - native constructor whose successful result is being published

   @returns original returned manager without a copy or replacement

   @throws RootLeaseOwnershipError when a runtime caller violates the native object-result contract
   */
  function register({ value, kind }: { readonly value: SessionManager; readonly kind: ManagerConstructorName }): SessionManager {
    /**
     Runtime JavaScript callers still receive the original diagnostic for invalid constructor results.
     */
    const candidate: unknown = value;
    if (candidate === null || typeof candidate !== 'object')
      throw new RootLeaseOwnershipError('Native constructor did not return a manager object');
    /**
     Registration retains both the native method and the registration function tags.
     */
    const registerLog = tagged({ tag: register.name, l: tagged({ tag: managers[kind].name, l: rl }) });
    owned.add(candidate);
    counts[kind] += 1;
    registerLog.debug('registered original native manager result');
    return value;
  }

  /**
   Positional wrappers mirror Pi's constructor API and preserve its original receiver.
   */
  const managers: ManagerConstructors = Object.freeze({
    /** {@inheritDoc SessionManager.create} */
    create(cwd: string, sessionDir?: string, options?: ForeignBorrowed<NewSessionOptions>): SessionManager {
      return register({ value: Reflect.apply(create, nativeManager, [cwd, sessionDir, options]), kind: 'create' });
    },
    /** {@inheritDoc SessionManager.open} */
    open(path: string, sessionDir?: string, cwdOverride?: string): SessionManager {
      return register({ value: Reflect.apply(open, nativeManager, [path, sessionDir, cwdOverride]), kind: 'open' });
    },
    /** {@inheritDoc SessionManager.inMemory} */
    inMemory(cwd?: string, options?: ForeignBorrowed<NewSessionOptions>, entries?: ForeignBorrowed<FileEntry[]>): SessionManager {
      return register({ value: Reflect.apply(inMemory, nativeManager, [cwd, options, entries]), kind: 'inMemory' });
    },
    /** {@inheritDoc SessionManager.continueRecent} */
    continueRecent(cwd: string, sessionDir?: string): SessionManager {
      if (typeof continueRecent !== 'function') throw new RootLeaseOwnershipError('Native continueRecent constructor is unavailable');
      return register({ value: Reflect.apply(continueRecent, nativeManager, [cwd, sessionDir]), kind: 'continueRecent' });
    },
    /** {@inheritDoc SessionManager.forkFrom} */
    forkFrom(sourcePath: string, targetCwd: string, sessionDir?: string, options?: ForeignBorrowed<NewSessionOptions>): SessionManager {
      if (typeof forkFrom !== 'function') throw new RootLeaseOwnershipError('Native forkFrom constructor is unavailable');
      return register({ value: Reflect.apply(forkFrom, nativeManager, [sourcePath, targetCwd, sessionDir, options]), kind: 'forkFrom' });
    },
  });

  /**
   Reject copied or foreign managers before they enter original session construction.

   @param manager - candidate whose exact constructor-result membership must be established

   @throws RootLeaseOwnershipError when the candidate was not returned by this owner
   */
  function assertOwned(manager: unknown): void {
    /**
     Membership failures remain attributable to the original constructor owner.
     */
    const checkLog = tagged({ tag: assertOwned.name, l: rl });
    if (manager === null || typeof manager !== 'object' || !owned.has(manager))
      throw new RootLeaseOwnershipError('Manager was not returned by this declared constructor owner');
    checkLog.debug('original native manager membership verified');
  }

  /**
   Expose detached counts without publishing mutable owner state.

   @returns copied native construction counts
   */
  function diagnostics(): Readonly<Record<ManagerConstructorName, number>> {
    /**
     Diagnostic reads retain their own function boundary.
     */
    const diagnosticLog = tagged({ tag: diagnostics.name, l: rl });
    diagnosticLog.debug('reading native constructor counts');
    return Object.freeze({ ...counts });
  }
  return Object.freeze({ managers, assertOwned, diagnostics });
}

//endregion Native constructor results establish ownership independently of metadata
