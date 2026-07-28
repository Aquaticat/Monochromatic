import { spawn as spawnChild, } from 'node:child_process';
import { once, } from 'node:events';
import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { text, } from 'node:stream/consumers';
import { fileURLToPath, } from 'node:url';

/**
 * Address record returned by deterministic resolver fixtures.
 */
type LookupAddress = {
  readonly address: string;
};

/**
 * ASN fixture networks keyed by normalized ASN.
 */
type AsnNetworkRecords = Readonly<Record<string, readonly string[]>>;

/**
 * Disposable temporary directory used by built-CLI tests.
 */
export type TempDir = {
  readonly path: string;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Captured built-CLI process result.
 */
export type CliResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

/**
 * Built command path resolved relative to this test helper.
 */
const BIN_PATH = fileURLToPath(new URL(
  '../dist/final/node/index.mjs',
  import.meta.url,
),);

/**
 * Error raised when a fixture receives an unregistered hostname.
 */
class UnexpectedLookupError extends Error {
  /**
   * Stable error type name.
   */
  override name = 'UnexpectedLookupError';
}

/**
 * Deterministic operating-system-style failure for a hostname that does not exist.
 */
class FixtureDnsNotFoundError extends Error {
  /**
   * Stable resolver error code consumed by domain handling.
   */
  readonly code = 'ENOTFOUND';

  /**
   * Stable error type name.
   */
  override name = 'FixtureDnsNotFoundError';
}

/**
 * Error raised when a fixture receives an unregistered ASN.
 */
class UnexpectedAsnLookupError extends Error {
  /**
   * Stable error type name.
   */
  override name = 'UnexpectedAsnLookupError';
}

/**
 * Error raised when a child process closes without a numeric exit code.
 */
class ProcessExitError extends Error {
  /**
   * Stable error type name.
   */
  override name = 'ProcessExitError';
}

/**
 * Error raised when an operation expected to fail instead resolves.
 */
class ExpectedFailureError extends Error {
  /**
   * Stable error type name.
   */
  override name = 'ExpectedFailureError';
}

/**
 * Deterministic resolver records shared by unit tests.
 */
const LOOKUP_RECORDS: Readonly<Record<string, readonly LookupAddress[]>> = {
  'allowed.example': [
    { address: '192.0.2.1', },
    { address: '2001:db8::1', },
  ],
  'disallowed.example': [
    { address: '192.0.2.1', },
  ],
  'empty.example': [],
  'inline#comment.example': [
    { address: '198.51.100.7', },
  ],
  'invalid-address.example': [
    { address: 'not-an-ip', },
  ],
};

/**
 * Hostnames that reproduce Node's operating-system `ENOTFOUND` resolver failure.
 */
const NOT_FOUND_HOSTNAMES: ReadonlySet<string> = new Set([
  'missing-one.example',
  'missing-two.example',
],);

/**
 * Deterministic ASN networks covering CIDR, single-address, empty, and invalid records.
 */
const ASN_NETWORK_RECORDS: AsnNetworkRecords = {
  AS64500: [
    '192.0.2.0/24',
    '2001:db8:100::/48',
  ],
  AS64501: [
    '192.0.2.0/25',
    '2001:db8:100::/49',
  ],
  AS64502: [
    '198.51.100.9',
    '2001:db8::9',
  ],
  AS64503: [],
  AS64504: ['not-a-network',],
};

/**
 * Deterministically resolves fixture hostnames.
 *
 * @param hostname - Fixture hostname to resolve.
 *
 * @returns Registered fixture addresses.
 *
 * @throws {@link UnexpectedLookupError} when hostname has no fixture.
 *
 * @example
 * ```ts
 * await fixtureLookup({ hostname: 'allowed.example' });
 * ```
 */
export function fixtureLookup(
  { hostname, }: { readonly hostname: string; },
): readonly LookupAddress[] {
  if (NOT_FOUND_HOSTNAMES.has(hostname,))
    throw new FixtureDnsNotFoundError(`getaddrinfo ENOTFOUND ${hostname}`,);
  /**
   * Registered addresses for requested hostname.
   */
  const records = LOOKUP_RECORDS[hostname];
  if (records === undefined)
    throw new UnexpectedLookupError(`Unexpected lookup: ${hostname}`,);
  return records;
}

/**
 * Deterministically resolves fixture ASNs.
 *
 * @param asn - Normalized fixture ASN.
 *
 * @returns Registered network and single-address records.
 *
 * @throws {@link UnexpectedAsnLookupError} when ASN has no fixture.
 *
 * @example
 * ```ts
 * fixtureAsnLookup({ asn: 'AS64500' });
 * ```
 */
export function fixtureAsnLookup(
  { asn, }: { readonly asn: string; },
): readonly string[] {
  /**
   * Registered networks for requested ASN.
   */
  const records = ASN_NETWORK_RECORDS[asn];
  if (records === undefined)
    throw new UnexpectedAsnLookupError(`Unexpected ASN lookup: ${asn}`,);
  return records;
}

/**
 * Creates a disposable temporary directory for input-file fixtures.
 *
 * @returns Directory removed recursively when its asynchronous disposer runs.
 *
 * @example
 * ```ts
 * await using directory = await makeTempDir();
 * ```
 */
export async function makeTempDir(): Promise<TempDir> {
  /**
   * Fresh operating-system temporary path.
   */
  const path = await mkdtemp(join(
    tmpdir(),
    'wg-allowedips-',
  ),);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        path,
        {
          force: true,
          recursive: true,
        },
      );
    },
  };
}

/**
 * Runs the built command and captures both success and process failure.
 *
 * @param args - Arguments passed after built command path.
 *
 * @returns Exit code and exact output streams.
 *
 * @example
 * ```ts
 * await runCli({ args: [] });
 * ```
 */
export async function runCli({ args, }: { readonly args: readonly string[]; },): Promise<CliResult> {
  /**
   * Built command subprocess with all output captured as exact bytes decoded to text.
   */
  const subprocess = spawnChild(
    'node',
    [
      BIN_PATH,
      ...args,
    ],
    { stdio: 'pipe', },
  );
  /**
   * Exact stdout, exact stderr, and close event awaited concurrently.
   */
  const [stdout, stderr,] = await Promise.all([
    text(subprocess.stdout,),
    text(subprocess.stderr,),
    once(
      subprocess,
      'close',
    ),
  ],);
  /**
   * Numeric process exit code established by close event.
   */
  const { exitCode, } = subprocess;
  if (exitCode === null)
    throw new ProcessExitError('Built CLI closed without a numeric exit code.',);
  return {
    exitCode,
    stdout,
    stderr,
  };
}

/**
 * Captures rejection value from one asynchronous operation.
 *
 * @param operation - Operation expected to reject.
 *
 * @returns Rejection value.
 *
 * @throws {@link ExpectedFailureError} when operation resolves.
 *
 * @example
 * ```ts
 * const error = await captureError({ operation: async () => { throw new Error('fixture'); } });
 * ```
 */
export async function captureError(
  { operation, }: { readonly operation: () => Promise<unknown>; },
): Promise<unknown> {
  try {
    await operation();
  }
  catch (error: unknown) {
    return error;
  }
  throw new ExpectedFailureError('Expected operation to reject.',);
}
