import {
  basename,
  isAbsolute,
  resolve,
} from 'node:path';
import { ProducerInputComparisonError, } from './producer-input-comparison-error.ts';
import type { ProducerInputComparisonRequest, } from './producer-input-comparison-model.ts';
import type { ProducerInputFileIdentity, } from './producer-input-file.ts';

//region Own independent launch and reference primitives before asynchronous work

/**
 Canonical SHA-256 width is fixed independently of caller data.
 */
const SHA256_WIDTH = 64;

/**
 Copies only required identity primitives, not an arbitrary caller object graph.
 
 @param value - independently supplied raw file identity
 
 @returns Owned canonical extent and digest
 
 @throws ProducerInputComparisonError when extent or digest grammar is unsupported
 
 @example
 ```ts
 const reference = comparisonIdentity(input.reference);
 ```
 */
function comparisonIdentity(value: ProducerInputFileIdentity): ProducerInputFileIdentity {
  /**
   Each authority primitive is read once before any logger callback or await.
   */
  const {
    bytes,
    sha256,
  } = value;
  if (((typeof bytes) !== 'number') || (!Number.isSafeInteger(bytes))
    || (bytes <= 0)
    || ((typeof sha256) !== 'string')
    || (sha256.length !== SHA256_WIDTH))
    throw new ProducerInputComparisonError({ kind: 'contract', });
  for (const character of sha256) {
    if (!'0123456789abcdef'.includes(character))
      throw new ProducerInputComparisonError({ kind: 'contract', });
  }
  return {
    bytes,
    sha256,
  };
}

/**
 Refuses path normalization rather than allowing the current working directory to select a file.
 
 @param value - caller-authorized absolute path
 
 @returns Unchanged canonical lexical spelling
 
 @throws ProducerInputComparisonError when path spelling is unsupported
 
 @example
 ```ts
 const baseLaunchPath = comparisonPath(input.baseLaunchPath);
 ```
 */
function comparisonPath(value: string): string {
  if (((typeof value) !== 'string') || value.includes('\0')
    || (!isAbsolute(value))
    || (resolve(value) !== value))
    throw new ProducerInputComparisonError({ kind: 'contract', });
  return value;
}

/**
 Owns data authority while retaining the caller's live cancellation signal and logger.
 No logger callback is requested here; the invoking owner adds observable forwarding after this capture.
 No typed scope, self-digest or prior completion record grants root-plan review authority here.
 
 @param input - independent launch, bootstrap and reference configuration
 
 @returns Primitive-owned request for the one fixed input-bootstrap operation
 
 @throws ProducerInputComparisonError when configuration or its accessors cannot be read safely
 
 @example
 ```ts
 const fixed = ownProducerInputComparisonRequest(input);
 ```
 */
export function ownProducerInputComparisonRequest(input: ProducerInputComparisonRequest): ProducerInputComparisonRequest {
  try {
    /**
     Neither file locator may depend on a later current-directory change.
     */
    const baseLaunchPath = comparisonPath(input.baseLaunchPath);
    /**
     Only the existing standalone bootstrap filename is supported.
     */
    const bootstrapPath = comparisonPath(input.bootstrapPath);
    if (basename(bootstrapPath) !== 'producer-prepare.mjs')
      throw new ProducerInputComparisonError({ kind: 'contract', });
    /**
     Caller mutation cannot change either checked launch primitive after this capture.
     */
    const baseLaunchIdentity = comparisonIdentity(input.baseLaunchIdentity);
    /**
     The expected artifact is captured independently of any newly reconstructed output.
     */
    const reference = comparisonIdentity(input.reference);
    /**
     Cancellation remains live rather than being copied into a stale boolean.
     */
    const {signal} = input;
    /**
     Logging is borrowed only after every data authority primitive is owned.
     */
    const {l} = input;
    if (!(signal instanceof AbortSignal))
      throw new ProducerInputComparisonError({ kind: 'contract', });
    return {
      baseLaunchPath,
      baseLaunchIdentity,
      bootstrapPath,
      reference,
      signal,
      l,
    };
  }
  catch (error) {
    // A caller getter may throw this same class; its fields are not owned operation metadata.
    // Discard the value without inspection and reconstruct the only failure this boundary authorizes.
    void error;
    throw new ProducerInputComparisonError({ kind: 'contract', });
  }
}

//endregion Own independent launch and reference primitives before asynchronous work
