/**
 Landing lease: the capability a landing-lock holder exports to the Git it forwards.

 A forwarded index writer holds the landing lock while real Git runs,
 and that Git runs hooks and `rebase --exec` commands,
 which can invoke the wrapper again.
 A nested invocation that inherits a lease naming the same,
 still-held landing lock proceeds without waiting for it,
 because its ancestor holds it and only returns once the nested invocation does.
 Without the lease the nested invocation would wait for its own ancestor forever.

 @module
 */
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { readOwnerLockRecord, } from '../owner-lock/owner-lock.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Environment variable carrying the lease.
 */
export const LANDING_LEASE_ENV = 'CLI_GIT_LANDING_LEASE';

/**
 Formats a lease naming the held lock directory and its owner token.

 @param lockDirectory - published landing lock directory

 @param token - token published in the lock

 @returns lease value

 @example
 ```ts
 formatLandingLease({ lockDirectory: '/repo/.git/cli-git-transactions/landing.lock', token: 't' });
 ```
 */
export function formatLandingLease({
  lockDirectory,
  token,
}: Readonly<{
  lockDirectory: string;
  token: string;
}>,): string {
  return JSON.stringify({
    lockDirectory,
    token,
  },);
}

/**
 Reports whether the environment carries a lease for this landing lock that its owner still holds.

 @param environment - process environment

 @param lockDirectory - landing lock directory about to be acquired

 @returns lease validity; malformed, foreign, or released leases are invalid

 @example
 ```ts
 await hasValidLandingLease({ environment: process.env, lockDirectory });
 ```
 */
export async function hasValidLandingLease({
  environment,
  lockDirectory,
}: Readonly<{
  environment: Readonly<NodeJS.ProcessEnv>;
  lockDirectory: string;
}>,): Promise<boolean> {
  /**
   Tagged lease logger.
   */
  const rl = tagged({
    tag: hasValidLandingLease.name,
    l,
  },);
  /**
   Inherited lease text.
   */
  const lease = environment[LANDING_LEASE_ENV];
  if ((lease === undefined) || (lease === ''))
    return false;
  try {
    /**
     Parsed lease.
     */
    const value: unknown = JSON.parse(lease,);
    if (((typeof value) !== 'object') || (value === null)
      || (!('lockDirectory' in value)) || (value.lockDirectory !== lockDirectory)
      || (!('token' in value)) || ((typeof value.token) !== 'string'))
      return false;
    /**
     Current owner of the named lock.
     */
    const owner = await readOwnerLockRecord(lockDirectory,);
    return ((typeof owner) !== 'symbol') && (owner.token === value.token);
  }
  catch (error: unknown) {
    rl.debug(`inherited landing lease is invalid: ${caughtValueText(error,)}`,);
    return false;
  }
}
