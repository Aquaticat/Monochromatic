/**
 Preparation lease: the capability the hook dispatcher exports to hook descendants.

 A nested wrapper invocation that inherits a valid lease skips startup transaction recovery and hook-lock acquisition,
 because its outer transaction is live and may hold the hook lock around the very hook that runs it.
 A lease is valid while the named transaction's plan still carries it and its owner is alive.

 @module
 */
import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  classifyTransactionOwner,
  parseTransactionOwner,
} from '../policy-engine/commit-transaction-owner.ts';
import { OWNER_FILENAME, } from '../policy-engine/commit-transaction-registry.ts';
import { PREPARATION_LEASE_ENV, } from './hook-dispatch-plan.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Formats a lease naming the transaction directory and an unguessable token.

 @param directory - transaction directory

 @param token - fresh token

 @returns lease value

 @example
 ```ts
 formatPreparationLease({ directory: '/repo/.git/cli-git-transactions/id', token: 't' });
 ```
 */
export function formatPreparationLease({
  directory,
  token,
}: Readonly<{
  directory: string;
  token: string;
}>,): string {
  return JSON.stringify({
    directory,
    token,
  },);
}

/**
 Reports whether the environment carries a valid lease of a live outer transaction.

 @param environment - process environment

 @returns lease validity; malformed or stale leases are invalid

 @example
 ```ts
 await hasValidInheritedLease(process.env);
 ```
 */
export async function hasValidInheritedLease(environment: Readonly<Record<string, string | undefined>>,): Promise<boolean> {
  /**
   Tagged lease logger.
   */
  const rl = tagged({
    tag: hasValidInheritedLease.name,
    l,
  },);
  /**
   Inherited lease text.
   */
  const lease = environment[PREPARATION_LEASE_ENV];
  if ((lease === undefined) || (lease === ''))
    return false;
  try {
    /**
     Parsed lease.
     */
    const value: unknown = JSON.parse(lease,);
    if (((typeof value) !== 'object') || (value === null) || (!('directory' in value)) || ((typeof value.directory) !== 'string'))
      return false;
    /**
     Named transaction directory.
     */
    const directory = String(value.directory,);
    /**
     Plan the lease must still match.
     */
    const plan: unknown = JSON.parse(await readFile(
      join(
        directory,
        'hooks',
        'plan.json',
      ),
      'utf8',
    ),);
    if (((typeof plan) !== 'object') || (plan === null) || (!('lease' in plan)) || (plan.lease !== lease))
      return false;
    /**
     Owner of the leasing transaction.
     */
    const owner = parseTransactionOwner(new Uint8Array(await readFile(join(
      directory,
      OWNER_FILENAME,
    ),),),);
    return (await classifyTransactionOwner({
      ownerPid: owner.ownerPid,
      ownerIdentity: owner.ownerIdentity,
    },)) === 'alive';
  }
  catch (error: unknown) {
    rl.debug(`inherited preparation lease is invalid: ${error instanceof Error ? error.message : 'unreadable'}`,);
    return false;
  }
}
