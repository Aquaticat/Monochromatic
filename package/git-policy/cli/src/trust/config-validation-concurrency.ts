/**
 Validation of the concurrent-commit tuning keys in trusted configuration.

 None of these keys disables the concurrent transaction;
 they only tune hook serialization,
 foreign `index.lock` patience,
 and landing starvation.

 @module
 */
import { ConfigValidationError, } from './config-validation-error.ts';

/**
 Validated concurrent-commit tuning with every default applied.
 */
export type ConcurrencyConfig = Readonly<{
  /**
   Hook serialization tuning.
   */
  hooks: Readonly<{
    /**
     Whether hooks from concurrent commits may overlap instead of serializing through the hook lock.
     */
    concurrentCommits: boolean;
  }>;
  /**
   Foreign `index.lock` tuning.
   */
  indexLock: Readonly<{
    /**
     Backoff budget in milliseconds for a foreign `index.lock` whose owner is dead or unproven.
     */
    unprovenOwnerTimeoutMs: number;
  }>;
  /**
   Landing starvation tuning.
   */
  landing: Readonly<{
    /**
     Lost landing races after which a transaction asks for the landing reservation.
     */
    reserveAfterLostRaces: number;
  }>;
}>;

/**
 Default backoff budget for a foreign `index.lock` whose owner cannot be proven alive.
 */
const DEFAULT_UNPROVEN_OWNER_TIMEOUT_MS = 1_000;

/**
 Default lost landing races before a transaction reserves the next landing slot.
 */
const DEFAULT_RESERVE_AFTER_LOST_RACES = 2;

/**
 Concurrency defaults used when config is absent, untrusted, or omits a key,
 and always by startup recovery, which runs before config loading.
 */
export const DEFAULT_CONCURRENCY_CONFIG: ConcurrencyConfig = {
  hooks: { concurrentCommits: false, },
  indexLock: { unprovenOwnerTimeoutMs: DEFAULT_UNPROVEN_OWNER_TIMEOUT_MS, },
  landing: { reserveAfterLostRaces: DEFAULT_RESERVE_AFTER_LOST_RACES, },
};

/**
 Top-level config keys owned by concurrency validation.
 */
export const CONCURRENCY_CONFIG_KEYS: readonly string[] = [
  'hooks',
  'indexLock',
  'landing',
];

/**
 Reads one optional nested object and rejects keys outside its one allowed key.

 @param value - untrusted top-level value, possibly absent

 @param section - top-level key named in diagnostics

 @param allowedKey - the only nested key the section accepts

 @returns nested value, or `undefined` when the section or key is absent

 @throws {@link ConfigValidationError} when the section is not an object or holds an unknown key
 */
function readNestedValue({
  value,
  section,
  allowedKey,
}: Readonly<{
  value: unknown;
  section: string;
  allowedKey: string;
}>,): unknown {
  if (value === undefined)
    return undefined;
  if (((typeof value) !== 'object')
    || (value === null)
    || Array.isArray(value,))
    throw new ConfigValidationError(`Configuration key ${section} must be an object.`,);
  /**
   First nested key outside the section's contract.
   */
  const unknownKey = Object.keys(value,)
    .find(function isUnknownNestedKey(key,): boolean {
      return key !== allowedKey;
    },);
  if (unknownKey !== undefined)
    throw new ConfigValidationError(`Unknown configuration key: ${section}.${unknownKey}`,);
  return Reflect.get(
    value,
    allowedKey,
  );
}

/**
 Validates one optional safe integer against an inclusive lower bound.

 @param value - untrusted nested value, possibly absent

 @param name - dotted key named in diagnostics

 @param minimum - smallest accepted value

 @param fallback - default when absent

 @returns accepted value

 @throws {@link ConfigValidationError} for a non-number, fractional, unsafe, or out-of-range value
 */
function validateBoundedInteger({
  value,
  name,
  minimum,
  fallback,
}: Readonly<{
  value: unknown;
  name: string;
  minimum: number;
  fallback: number;
}>,): number {
  if (value === undefined)
    return fallback;
  if (((typeof value) !== 'number')
    || (!Number.isSafeInteger(value,))
    || (value < minimum))
    throw new ConfigValidationError(`Configuration key ${name} must be a safe integer of at least ${String(minimum,)}.`,);
  return value;
}

/**
 Validates the concurrent-commit keys of one trusted config object.

 @param config - untrusted top-level config record

 @returns validated concurrency tuning with defaults applied

 @throws {@link ConfigValidationError} for unknown nested keys, wrong types, fractional values, and out-of-range values

 @example
 ```ts
 validateConcurrencyConfig({ hooks: { concurrentCommits: true } }).hooks.concurrentCommits; // true
 ```
 */
export function validateConcurrencyConfig(config: Readonly<Record<string, unknown>>,): ConcurrencyConfig {
  /**
   Optional hook serialization switch.
   */
  const concurrentCommits = readNestedValue({
    value: config.hooks,
    section: 'hooks',
    allowedKey: 'concurrentCommits',
  },);
  if ((concurrentCommits !== undefined) && ((typeof concurrentCommits) !== 'boolean'))
    throw new ConfigValidationError('Configuration key hooks.concurrentCommits must be a boolean.',);
  return {
    hooks: { concurrentCommits: concurrentCommits === true, },
    indexLock: {
      unprovenOwnerTimeoutMs: validateBoundedInteger({
        value: readNestedValue({
          value: config.indexLock,
          section: 'indexLock',
          allowedKey: 'unprovenOwnerTimeoutMs',
        },),
        name: 'indexLock.unprovenOwnerTimeoutMs',
        minimum: 0,
        fallback: DEFAULT_UNPROVEN_OWNER_TIMEOUT_MS,
      },),
    },
    landing: {
      reserveAfterLostRaces: validateBoundedInteger({
        value: readNestedValue({
          value: config.landing,
          section: 'landing',
          allowedKey: 'reserveAfterLostRaces',
        },),
        name: 'landing.reserveAfterLostRaces',
        minimum: 1,
        fallback: DEFAULT_RESERVE_AFTER_LOST_RACES,
      },),
    },
  };
}
