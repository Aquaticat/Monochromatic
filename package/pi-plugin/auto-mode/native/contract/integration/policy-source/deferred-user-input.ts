/**
 Classify later native user-input receipts without granting instruction authority.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';

//region The enclosing collector authenticates source identity before this data-only classification.

/**
 Native input metadata stays untrusted data after JSON decoding.
 */
type InputMetadata = Readonly<{
  method?: unknown;
  role?: unknown;
  delivery?: unknown;
  streamingBehavior?: unknown;
}>;

/**
 Original source fields consumed only after caller-owned provenance validation.
 */
type InputOrigin = Readonly<{
  source: Readonly<{
    inputOrigin: string;
    inputLocation: Readonly<{
      field: string;
      metadataJSON: string;
    }>;
  }>;
}>;

/**
 Classifier diagnostics never include input text or imply human authorship.
 */
const log = tagged({ tag: 'auto-mode-deferred-user-input' });

/**
 Narrow decoded metadata without claiming any property's value.

 @param value - decoded original metadata

 @returns whether named optional metadata fields can be inspected
 */
function isInputMetadata(value: unknown): value is InputMetadata {
  return ((typeof value) === 'object') && (value !== null) && (!Array.isArray(value));
}

/**
 Recognize the SDK's deferred delivery modes without accepting message or tool-state replacement.

 @param value - original delivery or method field

 @returns whether the field names steering or follow-up delivery
 */
function isDeferredDelivery(value: unknown): boolean {
  return (value === 'steer') || (value === 'followUp');
}

/**
 Recognize original native call, input-event and queue receipts that may arrive during a provider request.
 The caller still authenticates source/publication identity, absent registration and permission=false.
 This classification never establishes human authorship or changes the original provider request.

 @param source - original source whose enclosing owner has authenticated its provenance

 @returns whether the receipt is supported later user-input data

 @example
 ```ts
 const laterData = isDeferredUserInput(originalOrigin);
 ```
 */
export function isDeferredUserInput({ source }: InputOrigin): boolean {
  /**
   Classification retains the function boundary without logging input contents.
   */
  const l = tagged({ tag: isDeferredUserInput.name, l: log });
  l.debug('checking original deferred user-input data');
  /**
   Field names must agree with the specific native capture owner.
   */
  const { inputOrigin, inputLocation } = source;
  /**
   JSON parsing yields data only, so no caller getter can be invoked through metadata.
   */
  const metadata: unknown = JSON.parse(inputLocation.metadataJSON);
  if (!isInputMetadata(metadata)) return false;
  switch (inputOrigin) {
    case 'native-call-input':
      return (inputLocation.field === 'callInput')
        && ((metadata.method === 'prompt') || isDeferredDelivery(metadata.method));
    case 'native-unintercepted-input':
      return (inputLocation.field === 'uninterceptedInput') && isDeferredDelivery(metadata.streamingBehavior);
    case 'native-input-event':
      return (inputLocation.field === 'inputEvent') && isDeferredDelivery(metadata.streamingBehavior);
    case 'native-transformed-input':
      return (inputLocation.field === 'transformedInput') && isDeferredDelivery(metadata.streamingBehavior);
    case 'native-queue':
      return (inputLocation.field === 'queuedMessages') && (metadata.role === 'user')
        && isDeferredDelivery(metadata.delivery);
    case 'native-agent-input':
      return (inputLocation.field === 'agentInput') && (metadata.role === 'user')
        && isDeferredDelivery(metadata.method);
    default:
      return false;
  }
}

//endregion
