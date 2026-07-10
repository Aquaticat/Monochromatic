/**
 * Packed forbidden-strings policy lifecycle consumer.
 *
 * @module
 */
import { delimiter, } from 'node:path';
import { verifyForbiddenFailuresAndSeverity, } from './built-forbidden-strings-failure-consumer.ts';
import {
  SCANNER_DIRECTORY,
  writeForbiddenScanner,
} from './built-forbidden-strings-helpers.ts';
import {
  verifyForbiddenLifecycle,
  verifyForbiddenPostCommit,
} from './built-forbidden-strings-lifecycle-consumer.ts';

/**
 * Runs complete packed optional-policy verification.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyForbiddenStringsPolicyConsumer({ env: process.env });
 * ```
 */
export async function verifyForbiddenStringsPolicyConsumer({
  env,
}: Readonly<{
  env: NodeJS.ProcessEnv;
}>): Promise<void> {
  await writeForbiddenScanner();
  /**
   * PATH resolving fake scanner before packed wrapper dependencies.
   */
  const scannerEnv: NodeJS.ProcessEnv = {
    ...env,
    PATH: `${SCANNER_DIRECTORY}${delimiter}${env.PATH ?? ''}`,
  };
  await verifyForbiddenLifecycle(scannerEnv,);
  await verifyForbiddenPostCommit(scannerEnv,);
  await verifyForbiddenFailuresAndSeverity(scannerEnv,);
}
