// Error classes for the two ways a request can fail protocol-version validation.
// Thrown by request validation and converted to JSON-RPC error responses by the dispatcher.

import { SUPPORTED_PROTOCOL_VERSIONS, } from './protocol.ts';

import { META_PROTOCOL_VERSION, } from './protocol-meta.ts';

//region Missing version: request omitted the mandatory `_meta` revision key

/**
 * Thrown when an inbound request carries no protocol revision in its `_meta`.
 * Revision 2026-07-28 requires the key on every request, so its absence is malformed params
 * rather than a version this server declined.
 *
 * @example
 * ```ts
 * throw new MissingProtocolVersionError();
 * ```
 */
export class MissingProtocolVersionError extends Error {
  /**
   * Builds the error with a message naming both the missing key and the revisions on offer.
   */
  constructor() {
    super(
      `Request is missing "${META_PROTOCOL_VERSION}" in params._meta, which MCP revision `
        + `${SUPPORTED_PROTOCOL_VERSIONS.join(', ',)} requires on every request`,
    );
    this.name = 'MissingProtocolVersionError';
  }
}

//endregion

//region Unsupported version: request named a revision this server does not implement

/**
 * Thrown when an inbound request names a protocol revision outside {@link SUPPORTED_PROTOCOL_VERSIONS}.
 * Carries both sides of the mismatch so the dispatcher can build the `data` payload
 * that lets a client retry on a mutually supported revision.
 *
 * @example
 * ```ts
 * throw new UnsupportedProtocolVersionError({ requested: '2025-06-18' });
 * ```
 */
export class UnsupportedProtocolVersionError extends Error {
  /**
   * Revision the client asked for, echoed back in the error `data`.
   */
  readonly requested: string;

  /**
   * Revisions this server implements, listed in the error `data` for the client to choose from.
   */
  readonly supported: readonly string[];

  /**
   * Builds the error from the revision that was refused.
   *
   * @param requested - Revision string the client sent in request metadata.
   */
  constructor({ requested, }: { readonly requested: string; },) {
    super(
      `Unsupported protocol version: ${requested}. `
        + `This server implements ${SUPPORTED_PROTOCOL_VERSIONS.join(', ',)}`,
    );
    this.name = 'UnsupportedProtocolVersionError';
    this.requested = requested;
    this.supported = SUPPORTED_PROTOCOL_VERSIONS;
  }
}

//endregion
