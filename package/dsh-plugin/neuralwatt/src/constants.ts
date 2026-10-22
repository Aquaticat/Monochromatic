/**
 NeuralWatt route constants: route identity, endpoint, credential reference,
 and the listing fetch bound. @module
 */

//region Public API

/**
 Provider route key the agent settings name (`neuralwatt/mimo-v2.6-pro`) and
 the `providers` dict key the shipped adapter registers.
 */
export const NEURALWATT_ROUTE = 'neuralwatt';

/**
 Wire protocol the route speaks: the OpenAI chat-completions surface the
 shipped pi-ai adapter already streams over.
 */
export const NEURALWATT_API = 'openai-completions';

/**
 Chat endpoint base; the shipped adapter appends its completions path.
 */
export const NEURALWATT_BASE_URL = 'https://api.neuralwatt.com/v1/';

/**
 Public model-listing endpoint the mount fetch reads; the listing carries no
 credential requirement.
 */
export const NEURALWATT_LISTING_URL = 'https://api.neuralwatt.com/v1/models';

/**
 Credential reference every request resolves through `ctx.credentials`, the
 same environment name the profile's hand-declared block resolved.
 */
export const NEURALWATT_API_KEY_ENV = 'NEURALWATT_API_KEY';

/**
 Bound on the mount listing fetch: the checked-in snapshot serves until the
 fetch lands, so a slow endpoint delays fresh metadata instead of delaying
 route registration.
 */
export const NEURALWATT_LISTING_TIMEOUT_MS = 10_000;

//endregion Public API
