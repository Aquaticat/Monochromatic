import {
  isAbsolute,
  normalize,
} from 'node:path';
import { parseArgs, } from 'node:util';
import { PRODUCER_INPUT_CHILD_SENTINEL, } from './producer-input-container.ts';
import { PRODUCER_INPUT_METADATA_BYTES, } from './producer-input-bounds.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import type { ProducerInputFileIdentity, } from './producer-input-file.ts';

/**
 * Human launch arguments expose one operation; the child branch is an internal fixed sentinel only.
 */
export type ProducerInputArguments = { readonly kind: 'help'; } | { readonly kind: 'child'; } | {
  /**
   * Independently bound host reconstruction.
   */
  readonly kind: 'host';
  /**
   * Canonical absolute launch locator.
   */
  readonly launchPath: string;
  /**
   * Separately supplied extent and digest, not derived from the supplied launch file.
   */
  readonly expected: ProducerInputFileIdentity;
};
/**
 * CLI digest grammar is fixed independently from input text.
 */
const SHA256_WIDTH = 64;

/**
 * Parses only explicit launch identity or the private exact child sentinel.
 * Native argument errors are sanitized rather than echoing arbitrary supplied tokens.
 *
 * @param arguments_ - owned CLI tokens excluding Node and the bootstrap filename
 *
 * @returns One closed execution branch
 *
 * @throws ProducerInputRunError when syntax, identity or required paths differ
 *
 * @example
 * ```ts
 * const input = readProducerInputArguments(process.argv.slice(2));
 * ```
 */
export function readProducerInputArguments(arguments_: readonly string[]): ProducerInputArguments {
  if ((arguments_.length === 1) && (arguments_[0] === PRODUCER_INPUT_CHILD_SENTINEL))
    return { kind: 'child' };
  try {
    /**
     * Native parsing rejects unknown options and all positional arguments.
     */
    const {
      values,
      tokens
    } = parseArgs({
      args: [...arguments_],
      strict: true,
      allowPositionals: false,
      tokens: true,
      options: {
      launch: { type: 'string' },
      'launch-sha256': { type: 'string' },
      'launch-bytes': { type: 'string' },
      help: { type: 'boolean' },
    }
    });
    /**
     * Repeated flags cannot hide a second launch identity behind native last-value behavior.
     */
    const names = tokens.map(function option(token: Readonly<(typeof tokens)[number]>): string {
      if (token.kind !== 'option')
        throw new ProducerInputRunError({
          operation: 'read-launch',
          locator: 'CLI argument tokens',
        });
      return token.name;
    });
    if (new Set(names).size !== names.length)
      throw new ProducerInputRunError({
        operation: 'read-launch',
        locator: 'duplicate CLI option',
      });
    if (values.help === true) {
      if (arguments_.length !== 1)
        throw new ProducerInputRunError({
          operation: 'read-launch',
          locator: 'CLI arguments',
        });
      return { kind: 'help' };
    }
    /**
     * CLI identities do not become canonical through permissive numeric conversion.
     */
    const bytes = Number(values['launch-bytes']);
    /**
     * Digest text is checked without a regular-expression or Unicode reinterpretation.
     */
    const sha256 = values['launch-sha256'];
    /**
     * Canonical spelling avoids CWD and path-normalization ambiguity at the public boundary.
     */
    const launchPath = values.launch;
    if ((launchPath === undefined) || (!isAbsolute(launchPath))
      || (normalize(launchPath) !== launchPath)
      || launchPath.includes('\0')
      || (!Number.isSafeInteger(bytes))
      || (bytes <= 0)
      || (bytes > PRODUCER_INPUT_METADATA_BYTES)
      || (String(bytes) !== values['launch-bytes'])
      || (sha256 === undefined)
      || (sha256.length !== SHA256_WIDTH))
      throw new ProducerInputRunError({
        operation: 'read-launch',
        locator: 'CLI launch identity',
      });
    for (let index = 0; index < sha256.length; index += 1) {
      if (!'0123456789abcdef'.includes(sha256.charAt(index)))
        throw new ProducerInputRunError({
          operation: 'read-launch',
          locator: 'CLI launch digest',
        });
    }
    return {
      kind: 'host',
      launchPath,
      expected: {
        bytes,
        sha256
      }
    };
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({
      operation: 'read-launch',
      locator: 'CLI arguments',
    });
  }
}
