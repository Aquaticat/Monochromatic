import { producerInputBindings, } from './producer-input-bindings.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import type { ProducerInputHost, } from './producer-input-host-init.ts';
import {
  fieldMatches,
  record,
} from './producer-input-inspect-fields.ts';

/**
 * Verifies every requested bind and rejects all unregistered mounts in the native creation metadata.
 *
 * @param host - initialized host binding owner
 *
 * @param value - native Mounts field
 *
 * @throws ProducerInputRunError when a mount differs or an extra mount appears
 *
 * @example
 * ```ts
 * verifyCreatedBindings({ host, value: inspection.Mounts });
 * ```
 */
export function verifyCreatedBindings({
  host,
  value,
}: {
  readonly host: ProducerInputHost;
  readonly value: unknown
},): void {
  if (!Array.isArray(value))
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'created bind mounts',
    });
  /**
   * The fixed destination set is derived by the same owning boundary as argv construction.
   */
  const expected = producerInputBindings(host);
  /**
   * JSON array elements gain no implicit record authority.
   */
  const rows: readonly unknown[] = value;
  if (rows.length !== expected.length)
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'created bind mount count',
    });
  for (const binding of expected) {
    /**
     * Exactly one row must own each fixed child destination.
     */
    const matches = rows.filter(function destination(row): boolean {
      return record(row) && (row.Destination === binding.target);
    });
    /**
     * A duplicate destination is not resolved by native inspection order.
     */
    const [mount] = matches;
    if ((matches.length !== 1) || (!record(mount)))
      throw new ProducerInputRunError({
        operation: 'launch-container',
        locator: binding.target,
      });
    for (const [name, wanted] of Object.entries({
      Type: 'bind',
      Source: binding.source,
      Destination: binding.target,
      Driver: '',
      Mode: '',
      Options: ['rbind'],
      RW: binding.writable,
      Propagation: 'rprivate'
    }))
      fieldMatches({
        fields: mount,
        name,
        expected: wanted
      });
  }
}
