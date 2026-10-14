/**
 Native constructor capabilities and their original-result ownership boundary.

 @module
 */
import type { SessionManager } from '@earendil-works/pi-coding-agent';

//region Constructor method signatures remain dictated by the qualified native API

/**
 Named native entry points retained by the constructor owner.
 */
export type ManagerConstructorName = 'create' | 'open' | 'inMemory' | 'continueRecent' | 'forkFrom';

/**
 Every published constructor retains Pi's actual positional calling contract.
 */
export type ManagerConstructors = Pick<typeof SessionManager, ManagerConstructorName>;

/**
 Optional resume and fork capabilities are checked when their native entry points are invoked.
 */
export type ManagerConstructorInput = Pick<ManagerConstructors, 'create' | 'open' | 'inMemory'>
  & {
    /**
     Earlier native bootstrap profiles may omit recent-session lookup.
     */
    readonly continueRecent?: ManagerConstructors['continueRecent'];
    /**
     Earlier native bootstrap profiles may omit cross-directory fork construction.
     */
    readonly forkFrom?: ManagerConstructors['forkFrom'];
  };

/**
 Ownership is private membership of original constructor results, never a matching class shape.
 */
export type ManagerConstructorOwner = {
  /**
   Native entry points publish only their original returned managers.
   */
  readonly managers: ManagerConstructors;
  /**
   Require private membership before the caller uses a manager for native session construction.
   */
  readonly assertOwned: (manager: unknown) => void;
  /**
   Return detached counts without exposing constructor results or membership storage.
   */
  readonly diagnostics: () => Readonly<Record<ManagerConstructorName, number>>;
};

//endregion Constructor method signatures remain dictated by the qualified native API
